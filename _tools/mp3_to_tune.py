"""A recording turned into a tune for the castle's tavern band: the notes only, re-played by sound.js's
own instruments, as the real tunes of fetch_tunes.py are.

  uv run --with librosa --with soundfile python site/_tools/mp3_to_tune.py <song.mp3> --id bbp \\
      --title "BBP (Broke Before Prime)" --composer Jolagreen23 [--saltarello] [--modal] [--start 12 --seconds 150]

The parts come from the song's stems (htdemucs: <name>_(Bass|Drums|Other|Vocals)_htdemucs.flac beside
it; without them, a harmonic/percussive split of the mix, and no singer). The pitched stems are
transcribed by Basic Pitch (basic_pitch_notes.py, in its own Python 3.11; a constant-Q salience
tracker of our own if that cannot run):

  voice 3  a cantor: the singer's own line (Vocals), on its own pitches, each syllable on the vowel
           actually said (its first two formants, by LPC); or, with --voice, the singer's own voice,
           as if heard across the tavern (a band 220 Hz - 3.8 kHz, tape saturation, a stone room's
           reverb), an audio file kept in step with the band: the part that makes a song known
  voice 0  the shawm: the top line of the beat's loop (Other)
  voice 4  the lute: the loop's other notes (its chords), up to two under the top
  voice 1  the lute, low: the bass (Bass), its 808 glides held as notes
  voice 2  the tabor: the drums (Drums), each hit sorted by its spectrum: kick 36, snare 38, hat 42

Times go on a constant grid (the drums' tempo and phase) quantised to the 16th (to the triplet with
--saltarello: the 16ths of each beat folded into a 6/8 lilt). Pitches are kept; with --modal they are
snapped into a church mode on the key's tonic (Krumhansl-Kessler), Dorian for a minor key,
Mixolydian for a major one (it sounds older, and further from the song).

Writes assets/data/local/tunes.json (gitignored: never published; sound.js reads it on a local server
only: ?tune=<id>, or `music <id>`) and _smoke/<id>-preview.wav, the first minute as the band plays it.
"""
import argparse
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import butter, fftconvolve, lfilter

ROOT = Path(__file__).resolve().parent.parent
SR = 22050; HOP = 256 # (11.6 ms frames)
MODES = {"dorian": [0, 2, 3, 5, 7, 9, 10], "mixolydian": [0, 2, 4, 5, 7, 9, 10]}
VOWELS = {"a": (730, 1090), "e": (530, 1840), "i": (300, 2200), "o": (500, 900), "u": (330, 750)} # (men's F1, F2: sound.js FORMANTS)
KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]


def stems_of(song, start, seconds):
    """{part: mono signal at SR}, cut to [start, start + seconds]; Vocals may be None."""
    load = lambda p: librosa.load(p, sr=SR, mono=True, offset=start, duration=seconds)[0]
    found = {k: song.with_name(f"{song.stem}_({k})_htdemucs.flac") for k in ("Bass", "Drums", "Other", "Vocals")}
    if all(p.exists() for p in found.values()):
        print("stems: htdemucs"); return {k: load(p) for k, p in found.items()}, found
    print("stems: none beside the song, a harmonic/percussive split of the mix (no singer)")
    y = load(song); h, p = librosa.effects.hpss(y)
    return {"Bass": h, "Drums": p, "Other": h, "Vocals": None}, {"Bass": song, "Other": song}


class Grid:
    """The song's pulse: its tempo (median beat period, beat tracking on the drums) and phase (the beats'
    median offset from that period), constant: produced music does not drift."""

    def __init__(self, drums):
        _, bt = librosa.beat.beat_track(y=drums, sr=SR, hop_length=HOP, units="time")
        self.period = float(np.median(np.diff(bt))); self.bpm = 60 / self.period
        k = np.round((bt - bt[0]) / self.period); self.t0 = float(np.median(bt - k * self.period))
        self.t0 -= np.ceil(self.t0 / self.period) * self.period # (back to the song's start: an intro without drums keeps its notes)
        print(f"tempo: {self.bpm:.1f} bpm, first beat at {self.t0:.3f} s")

    def beat(self, t):
        return (t - self.t0) / self.period


def key_of(y):
    """(tonic pitch class, 'major' | 'minor'), the best Krumhansl-Kessler correlation of the mean chroma."""
    c = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=HOP * 4).mean(axis=1)
    best = max(((np.corrcoef(c, np.roll(prof, k))[0, 1], k, q) for q, prof in (("major", KK_MAJOR), ("minor", KK_MINOR)) for k in range(12)))
    return best[1], best[2]


def snap(m, tonic, scale):
    """MIDI note m moved to the nearest note of the mode (ties go down)."""
    pcs = [(tonic + s) % 12 for s in scale]
    return min((m + d for d in (0, -1, 1, -2, 2) if (m + d) % 12 in pcs), key=lambda x: (abs(x - m), x))


def line_of(y, lo, hi, harmonics, min_s=0.07, rel=0.3):
    """A monophonic line [(t0, t1, midi)] out of a part that may hold several: in each frame, the pitch
    between MIDI lo and hi with the most harmonic salience on a constant-Q spectrum (3 bins a semitone;
    harmonic h weighs 0.8^(h-1)), voiced when that salience passes `rel` of its 95th percentile; cut
    where the pitch moves or an onset falls (a note struck again)."""
    B = 3; c0 = 24 # (C1)
    C = np.abs(librosa.cqt(y, sr=SR, hop_length=HOP, fmin=librosa.midi_to_hz(c0), n_bins=7 * 12 * B, bins_per_octave=12 * B))
    C = np.maximum(C, np.roll(C, 1, axis=0)); C = np.maximum(C, np.roll(C, -1, axis=0)) # (a bin's neighbours: a slightly mistuned harmonic still counts)
    cand = np.arange((lo - c0) * B, (hi - c0) * B + 1, B)
    sal = np.zeros((len(cand), C.shape[1]))
    for h in range(1, harmonics + 1):
        k = cand + int(round(12 * B * np.log2(h))); okk = k < C.shape[0]
        sal[okk] += 0.8 ** (h - 1) * C[k[okk]]
    best = sal.argmax(axis=0); top = sal.max(axis=0)
    mid = lo + best; voiced = top > rel * np.percentile(top, 95)
    mid = np.round(np.array([np.median(mid[max(0, i - 2):i + 3]) for i in range(len(mid))])).astype(int) # (a 5-frame median: no flicker)
    ons = set(librosa.onset.onset_detect(y=y, sr=SR, hop_length=HOP).tolist())
    out = []; run = []
    def close():
        if len(run) * HOP / SR >= min_s:
            out.append((run[0] * HOP / SR, (run[-1] + 1) * HOP / SR, int(mid[run[0]])))
    for i in range(len(mid)):
        if voiced[i] and run and mid[i] == mid[run[0]] and i not in ons:
            run.append(i); continue
        close(); run = [i] if voiced[i] else []
    close()
    return out


def basic_pitch(path, start, seconds):
    """Basic Pitch's notes [(t0, t1, midi, amplitude)] for one stem, or None if it cannot run here."""
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "notes.json"
        cmd = ["uv", "run", "--no-project", "--python", "3.11", "--with", "basic-pitch[onnx]", "--with", "setuptools<70",
               "python", str(Path(__file__).with_name("basic_pitch_notes.py")), str(path), str(out), str(start), str(seconds)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode or not out.exists():
            print(f"Basic Pitch could not run ({path.name}): the salience tracker instead"); return None
        return [tuple(n) for n in json.loads(out.read_text())]


def top_line(notes, gap=0.03):
    """A monophonic line out of polyphonic notes: at each onset the highest note; a note is cut where the
    next one starts. The rest go back as `under` (the chords)."""
    notes = sorted(notes, key=lambda n: (n[0], -n[2])); line = []; under = []
    for n in notes:
        if line and n[0] - line[-1][0] < gap:
            under.append(n); continue
        if line and line[-1][1] > n[0]:
            line[-1] = (line[-1][0], n[0], *line[-1][2:])
        line.append(n)
    return line, under


def drum_hits(y):
    """[(t, 36 | 38 | 42)]: each onset's first 60 ms, by where its energy lies (a sixth below 200 Hz: a kick;
    half above 5 kHz: a hat; else a snare or a clap)."""
    out = []
    for t in librosa.onset.onset_detect(y=y, sr=SR, hop_length=HOP, units="time", backtrack=True):
        seg = y[int(t * SR):int((t + 0.06) * SR)]
        if len(seg) < 256 or np.sqrt(np.mean(seg ** 2)) < 0.01:
            continue
        sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; f = np.fft.rfftfreq(len(seg), 1 / SR); e = sp.sum() + 1e-12
        lo = sp[f < 200].sum() / e; hi = sp[f > 5000].sum() / e
        out.append((t, 36 if lo > 0.15 else 42 if hi > 0.5 else 38)) # (thresholds from BBP's hits: a quarter carry > 15 % below 200 Hz)
    return out


def vowel_of(seg):
    """The vowel nearest the segment's first two formants (LPC roots), or 'a'."""
    if len(seg) < 400 or not np.any(seg):
        return "a"
    x = librosa.resample(seg, orig_sr=SR, target_sr=10000); x = x * np.hamming(len(x))
    x = lfilter([1, -0.63], 1, x) # (pre-emphasis)
    try:
        a = librosa.lpc(x, order=10)
    except Exception: # (a silent or degenerate frame)
        return "a"
    r = [z for z in np.roots(a) if np.imag(z) > 0]
    fs = sorted(f for f, bw in ((np.angle(z) * 10000 / (2 * np.pi), -np.log(abs(z)) * 10000 / np.pi) for z in r) if 200 < f < 3200 and bw < 500)
    if len(fs) < 2:
        return "a"
    return min(VOWELS, key=lambda v: np.log(fs[0] / VOWELS[v][0]) ** 2 + np.log(fs[1] / VOWELS[v][1]) ** 2)


def place(t0, t1, grid, div, fold):
    """Seconds to (beat, beats) on the grid: div steps a beat (4, or 3 with the 6/8 fold)."""
    b0 = grid.beat(t0); b1 = grid.beat(t1)
    q = lambda b: np.floor(b) + (min(3, round((b % 1) * 4)) * 2 // 3 / 3 if fold else round((b % 1) * div) / div) # (fold: 16ths 0,1,2,3 to triplets 0,0,1,2)
    s = q(b0); return float(s), float(max(1 / div, q(b1) - s))


def vowels_at(y, t0s):
    """The vowel said just after each onset (seconds), from the vocal stem."""
    return [vowel_of(y[int((t + 0.03) * SR):int((t + 0.07) * SR)]) for t in t0s]


def tune_of(song, a):
    st, paths = stems_of(song, a.start, a.seconds)
    grid = Grid(st["Drums"]); tonic, kind = key_of(st["Other"] + st["Bass"])
    mode = "dorian" if kind == "minor" else "mixolydian"; scale = MODES[mode]
    print(f"key: {librosa.midi_to_note(60 + tonic, octave=False)} {kind}" + (f", snapped into {mode}" if a.modal else ""))
    pitch = (lambda m: snap(m, tonic, scale)) if a.modal else (lambda m: m)
    bp = (lambda k: basic_pitch(paths[k], a.start, a.seconds)) if not a.no_basic_pitch else (lambda k: None)
    div = 3 if a.saltarello else 4; notes = []
    def put(t0, t1, m, v, extra=()):
        b, d = place(t0, t1, grid, div, a.saltarello)
        if b >= 0:
            notes.append([round(b, 4), round(d, 4), int(pitch(m)), v, *extra])
    loop = bp("Other")
    if loop is None:
        loop = [(t0, t1, m, 1.0) for t0, t1, m in line_of(st["Other"], 55, 84, 5)]
    top, under = top_line([n for n in loop if n[3] > 0.25])
    for t0, t1, m, _ in top:
        put(t0, t1, m, 0)
    per = {}
    for t0, t1, m, amp in sorted(under, key=lambda n: -n[3]): # (the chords: the two loudest under the top, at each onset)
        k = round(grid.beat(t0) * div)
        if len(per.setdefault(k, [])) < 2:
            per[k].append(m); put(t0, t1, m, 4)
    bass = bp("Bass")
    bass = [(t0, t1, m) for t0, t1, m, _ in top_line([(t0, t1, -m, v) for t0, t1, m, v in bass])[0]] if bass else line_of(st["Bass"], 28, 55, 2, min_s=0.1, rel=0.2)
    for t0, t1, m in bass: # (the lowest note at each onset: top_line on negated pitches)
        put(t0, t1, abs(m), 1)
    for t, m in drum_hits(st["Drums"]):
        put(t, t + 0.05, m, 2)
    if st["Vocals"] is not None and not a.voice:
        voc = bp("Vocals")
        voc = top_line([n for n in voc if n[3] > 0.2])[0] if voc else [(t0, t1, m, 1) for t0, t1, m in line_of(st["Vocals"], 40, 76, 4)]
        for (t0, t1, m, _), v in zip(voc, vowels_at(st["Vocals"], [n[0] for n in voc])):
            put(t0, t1, m, 3, (v,))
    notes.sort(key=lambda n: (n[0], n[3], -n[2]))
    seen = set(); clean = [] # one note per voice, step and pitch; a line's notes do not overlap
    for n in notes:
        k = (n[0], n[3], n[2] if n[3] == 4 else 0)
        if k not in seen:
            seen.add(k); clean.append(n)
    last = {}
    for n in clean:
        if n[3] in (0, 1, 3) and n[3] in last and last[n[3]][0] + last[n[3]][1] > n[0]:
            last[n[3]][1] = round(max(1 / div, n[0] - last[n[3]][0]), 4)
        if n[3] in (0, 1, 3):
            last[n[3]] = n
    count = lambda v: sum(n[3] == v for n in clean)
    print(f"notes: {count(3)} cantor, {count(0)} shawm, {count(4)} lute chords, {count(1)} bass, {count(2)} tabor")
    return {"id": a.id, "title": a.title or song.stem, "composer": a.composer, "year": a.year, "when": "tavern",
            "bpm": round(grid.bpm, 2), "tonic": tonic, "mode": mode if a.modal else "as recorded", "drums": True, "local": True,
            "source": song.name, "at": round(a.start + grid.t0, 4), "notes": clean} # (at: the song's second on beat 0)


# ---- the preview: the band as sound.js plays it, roughly (not the same synthesis, the same parts)
def midi_hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def saw(f, n):
    t = np.arange(n) / SR; return 2 * ((t * f) % 1) - 1


def bandpass(x, f, q):
    w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q)
    return lfilter([al, 0, -al], [1 + al, -2 * np.cos(w), 1 - al], x)


def env(n, att, rel):
    e = np.ones(n); a = min(n, int(att * SR)); r = min(n, int(rel * SR))
    e[:a] = np.linspace(0, 1, a); e[n - r:] *= np.linspace(1, 0, r); return e


def tavern_voice(path, at, seconds):
    """The vocal stem from the song's second `at` on (silence first if `at` < 0), as if heard across a
    tavern: band-limited, its peaks rounded by a tape's saturation, a stone room's reverb (decaying
    noise, its highs dying first, 0.22 s time constant)."""
    y = librosa.load(path, sr=SR, mono=True, offset=max(0.0, at), duration=seconds + min(0.0, at))[0]
    if at < 0:
        y = np.concatenate([np.zeros(int(-at * SR)), y])
    y = lfilter(*butter(2, [220, 3800], btype="band", fs=SR), y)
    y = np.tanh(2.2 * y / (np.abs(y).max() + 1e-9)) / np.tanh(2.2)
    n = int(0.9 * SR); ir = lfilter([0.3], [1, -0.7], np.random.default_rng(1).standard_normal(n) * np.exp(-np.arange(n) / (0.22 * SR)))
    wet = fftconvolve(y, ir)[:len(y)]; wet *= np.abs(y).max() / (np.abs(wet).max() + 1e-9)
    out = 0.8 * y + 0.35 * wet
    return out / np.abs(out).max() * 0.9


def preview(tu, path, secs=60, voice=None):
    bd = 60 / tu["bpm"]; out = np.zeros(int(SR * (secs + 3)))
    def add(y, at):
        i = int(at * SR)
        if 0 <= i < len(out):
            out[i:i + len(y)] += y[:len(out) - i]
    d = tu["tonic"] + 38 + (12 if tu["tonic"] < 4 else 0)
    drone = (saw(midi_hz(d), len(out)) + saw(midi_hz(d + 7), len(out))) * 0.03
    out += lfilter([0.08], [1, -0.92], drone)
    for b, du, m, v, *x in tu["notes"]:
        at = b * bd
        if at > secs:
            break
        if v == 0: # shawm
            while m > 79: m -= 12
            while m < 55: m += 12
            n = int(max(0.08, du * bd * 0.92) * SR); y = saw(midi_hz(m) * 1.0023, n) + saw(midi_hz(m) / 1.0023, n)
            add((0.6 * y + bandpass(y, 1400, 1.2) * 2) * env(n, 0.025, 0.06) * 0.05, at)
        elif v in (1, 4): # lute: the bass low, the chords in the middle
            lo, hi = (36, 60) if v == 1 else (50, 74)
            while m > hi: m -= 12
            while m < lo: m += 12
            n = int(max(0.3, du * bd * 1.8) * SR); t = np.arange(n) / SR
            y = sum(abs(np.sin(k * np.pi * 0.2)) / k ** 2 * np.sin(2 * np.pi * k * midi_hz(m) * t) * np.exp(-t * 5 * (1 + 0.35 * (k - 1)) / (du * bd * 1.8)) for k in range(1, 9))
            add(y * (0.12 if v == 1 else 0.06), at)
        elif v == 2: # tabor
            n = int(0.2 * SR); t = np.arange(n) / SR; f = (150 if m == 36 else 190) * np.exp(-t * 8)
            vol = 0.22 if m == 36 else 0.1 if m == 38 else 0.04
            y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 25) * (1 if m != 42 else 0.2)
            y += bandpass(np.random.randn(n), 2600 if m != 42 else 7000, 0.8) * np.exp(-t * (30 if m == 36 else 45)) * 0.5
            add(y * vol, at)
        else: # cantor: a sawtooth through the vowel's formants
            n = int(max(0.12, du * bd) * SR); y = saw(midi_hz(m), n) + saw(midi_hz(m) * 1.003, n)
            F1, F2 = VOWELS.get(x[0] if x else "a", VOWELS["a"])
            add((bandpass(y, F1, 6) + 0.45 * bandpass(y, F2, 9) + 0.2 * bandpass(y, 2450, 12)) * env(n, 0.03, 0.06) * 0.06, at)
    out = lfilter([1, 1], [2], out); out /= np.abs(out).max() * 1.1
    if voice is not None: # (the singer over the band, a little in front)
        k = min(len(out), len(voice)); out[:k] = out[:k] * 0.7 + voice[:k] * 0.55; out /= np.abs(out).max() * 1.05
    save_wav(out, path)


def save_wav(y, path):
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("song", type=Path); ap.add_argument("--id", required=True); ap.add_argument("--title", default="")
    ap.add_argument("--composer", default="unknown"); ap.add_argument("--year", default="")
    ap.add_argument("--start", type=float, default=0.0); ap.add_argument("--seconds", type=float, default=150.0)
    ap.add_argument("--saltarello", action="store_true", help="fold the 16ths into a 6/8 lilt")
    ap.add_argument("--modal", action="store_true", help="snap the pitches into a church mode")
    ap.add_argument("--no-basic-pitch", action="store_true", help="our own salience tracker only")
    ap.add_argument("--voice", action="store_true", help="the singer's own voice (treated) instead of the cantor")
    a = ap.parse_args()
    tu = tune_of(a.song.expanduser(), a)
    out = ROOT / "assets/data/local/tunes.json"; out.parent.mkdir(parents=True, exist_ok=True)
    have = json.loads(out.read_text())["tunes"] if out.exists() else []
    out.write_text(json.dumps({"tunes": [t for t in have if t["id"] != tu["id"]] + [tu]}, ensure_ascii=False, separators=(",", ":")))
    voice = None
    if a.voice: # the treated voice, beside the tune, as Opus (ffmpeg)
        src = a.song.expanduser(); src = src.with_name(f"{src.stem}_(Vocals)_htdemucs.flac")
        voice = tavern_voice(src, tu["at"], a.seconds); tu["voice"] = f"{tu['id']}-voice.ogg"
        with tempfile.TemporaryDirectory() as d:
            w = Path(d) / "v.wav"; save_wav(voice, w)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(w), "-c:a", "libopus", "-b:a", "64k", str(out.parent / tu["voice"])], check=True)
        out.write_text(json.dumps({"tunes": [t for t in have if t["id"] != tu["id"]] + [tu]}, ensure_ascii=False, separators=(",", ":")))
    wav = ROOT / "_smoke" / f"{tu['id']}-preview.wav"; wav.parent.mkdir(exist_ok=True); preview(tu, wav, voice=voice)
    print(f"wrote {out.relative_to(ROOT)} and {wav.relative_to(ROOT)}; hear it at http://127.0.0.1:8765/?tune={tu['id']} (sound on)")


if __name__ == "__main__":
    main()
