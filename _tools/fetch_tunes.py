"""Real tunes for the castle's lute (and, at night, Satie for a harp), from the Mutopia Project's
MIDI files (public domain, or CC BY-SA for the editions marked so); and the market's dances, for
pipes and drum (estampies, saltarelli, branles: medieval and Renaissance tunes, public domain),
from abc transcriptions collected by abcnotation.com, through the MIDI it renders from them. The
notes only, re-played by sound.js's own instruments.

  uv run --with mido python site/_tools/fetch_tunes.py     (from EnvS/)

Each piece reduced to two voices, the tune (the highest note sounding at each onset) and a bass
(the lowest), in beats; at most about two and a half minutes of it.
Writes assets/data/real/tunes.json: {"tunes": [{id, title, composer, year, when, bpm, notes:
[[beat, beats, midi, voice]], tonic}]}; `when` says when the castle plays it (day, evening, night,
december, market); `tonic`, the last melody note's pitch class (the market's drone).
"""
import html
import io
import re

import mido

import real

M = "https://www.mutopiaproject.org/ftp/"
PIECES = [  # [id, file, title, composer, year, when, licence]
    ("greensleeves", "Traditional/Greensleaves/Greensleaves.mid", "Greensleeves", "traditional", "16th c.", "day", "public domain"),
    ("saltarello", "GalileiV/saltarello/saltarello.mid", "Saltarello", "Vincenzo Galilei", "16th c.", "day", "public domain"),
    ("bourree", "BachJS/BWV996/bourree/bourree.mid", "Bourrée in E minor, BWV 996", "J. S. Bach", "1700s", "day", "public domain"),
    ("pavan", "MilanL/milan-pavan2/milan-pavan2.mid", "Pavan no. 2", "Luis Milán", "1536", "evening", "public domain"),
    ("unquiet", "DowlandJ/ALS1/UnquietThoughts/UnquietThoughts.mid", "Unquiet Thoughts", "John Dowland", "1597", "evening", "public domain"),
    ("comeagain", "DowlandJ/ALS17/ComeAgain/ComeAgain.mid", "Come Again", "John Dowland", "1597", "evening", "public domain"),
    ("old100", "BourgeoisL/Old100/Old100.mid", "Old Hundredth", "Louis Bourgeois", "1551", "evening", "public domain"),
    ("rose", "Anonymous/es_ist_ein_ros_entsprungen/es_ist_ein_ros_entsprungen.mid", "Es ist ein Ros' entsprungen", "anonymous, arr. Michael Praetorius", "1609", "december", "public domain"),
    ("gnossienne1", "SatieE/Gnossienne/no_1/no_1.mid", "Gnossienne no. 1", "Erik Satie", "1890", "night", "CC BY-SA 4.0 (Mutopia edition)"),
    ("gnossienne3", "SatieE/Gnossienne/no_3/no_3.mid", "Gnossienne no. 3", "Erik Satie", "1890", "night", "CC BY-SA 4.0 (Mutopia edition)"),
]
ABC = "https://abcnotation.com"
DANCES = [  # [id, abcnotation tune page (?a=), title, composer, year]: the market's, for pipes and drum
    ("schiarazula", "trillian.mit.edu/~jc/music/abc/mirror/mindspring.com/~dmilewski/ecdp/3lfpublic/0113", "Schiarazula Marazula", "Giorgio Mainerio", "1578"),
    ("tourdion", "abcplus.sourceforge.net/Choral/Tourdion/0002", "Tourdion", "anonymous, ed. Pierre Attaingnant", "1530"),
    ("saltarello-lon", "trillian.mit.edu/~jc/music/abc/demo/Tunes/Saltarello/0000", "Saltarello", "anonymous, Tuscany", "c. 1400"),
    ("branle-haye", "anamnese.online.fr/site2/abc/arbeau_ps/0059", "Branle de la Haye", "Thoinot Arbeau, Orchésographie", "1589"),
    ("branle-montarde", "anamnese.online.fr/site2/abc/arbeau_ps/0058", "Branle de la Montarde", "Thoinot Arbeau, Orchésographie", "1589"),
    ("ductia", "trillian.mit.edu/~jc/music/abc/mirror/musicaviva.com/france/ductia01/0000", "Ductia", "anonymous", "13th c."),
    ("estampie", "trillian.mit.edu/~jc/music/abc/mirror/galouvielle.free.fr/Provence/0048", "Estampie", "anonymous", "14th c."),
    ("estampie-reale", "trillian.mit.edu/~jc/music/abc/mirror/galouvielle.free.fr/Provence/0047", "Estampie royale", "anonymous", "13th c."),
    ("tristano", "richardrobinson.tunebook.org.uk/static/tunebook/02713", "Lamento di Tristano and La Rotta", "anonymous, Tuscany", "c. 1400"),
]
MAX_BEATS = 260


def notes_of(data):
    mid = mido.MidiFile(file=io.BytesIO(data)); tpb = mid.ticks_per_beat
    tempo = next((m.tempo for tr in mid.tracks for m in tr if m.type == "set_tempo"), 500000)
    on = {}; out = []
    for tr in mid.tracks:
        t = 0
        for m in tr:
            t += m.time
            if m.type == "note_on" and m.velocity > 0 and m.channel != 9:
                on[(m.channel, m.note)] = t
            elif m.type in ("note_off", "note_on") and (m.channel, m.note) in on:
                t0 = on.pop((m.channel, m.note)); out.append((t0 / tpb, (t - t0) / tpb, m.note))
    return sorted(out), 60e6 / tempo


def two_voices(notes):
    """The highest and the lowest note of each onset (rounded to a 16th), quantised."""
    by = {}
    for b, d, n in notes:
        by.setdefault(round(b * 4) / 4, []).append((n, d))
    out = []
    for b in sorted(by):
        if b > MAX_BEATS:
            break
        grp = sorted(by[b]); hi = grp[-1]; lo = grp[0]
        out.append([b, max(0.25, round(hi[1] * 4) / 4), hi[0], 0])
        if lo[0] < hi[0] - 4:
            out.append([b, max(0.25, round(lo[1] * 4) / 4), lo[0], 1])
    return out


def dance(a):
    """A tune page's MIDI (abcnotation renders it from the abc) and the abc's transcriber (its Z: line)."""
    page = real.fetch(f"{ABC}/tunePage?a={a}", binary=False)
    mid = html.unescape(re.search(r'href="(/getResource/downloads/media/[^"]+)"', page).group(1))
    txt = html.unescape(re.search(r'href="(/getResource/downloads/text_/[^"]+)"', page).group(1))
    z = re.search(r"^Z:\s*(.+)$", real.fetch(ABC + txt, binary=False), re.M)
    return real.fetch(ABC + mid), z.group(1).strip() if z else "unnamed"


def main():
    tunes = []; credits = []
    def add(tid, title, comp, year, when, data):
        notes, bpm = notes_of(data)
        v = two_voices(notes); tonic = next((n[2] for n in reversed(v) if n[3] == 0), 60) % 12
        tunes.append({"id": tid, "title": title, "composer": comp, "year": year, "when": when, "bpm": round(bpm), "notes": v, "tonic": tonic})
        print(f"  {tid:15s} {round(bpm):3d} bpm, {len(v):4d} notes, {v[-1][0] if v else 0:.0f} beats")
    for tid, f, title, comp, year, when, lic in PIECES:
        add(tid, title, comp, year, when, real.fetch(M + f))
        credits.append({"title": title, "author": comp, "year": year, "source": M + f.rsplit("/", 1)[0] + "/", "licence": f"{lic}; notes from the Mutopia Project"})
    for tid, a, title, comp, year in DANCES:
        data, who = dance(a)
        add(tid, title, comp, year, "market", data)
        credits.append({"title": title, "author": comp, "year": year, "source": f"{ABC}/tunePage?a={a}",
                        "licence": f"tune in the public domain; abc transcription by {who}, via abcnotation.com"})
    real.write_asset("tunes", {"tunes": tunes}, credits)


if __name__ == "__main__":
    main()
