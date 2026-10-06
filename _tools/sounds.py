"""The castle's recorded sounds: real foley, made to sit with the pixel art and the synthesised
ambience. Source: Kenney, "RPG Audio" (CC0, https://opengameart.org/content/50-rpg-sound-effects).

  python3 _tools/sounds.py DIR      DIR: the unzipped pack (its OGG/ folder) -> assets/snd/*.mp3

Each cue is a few takes, their silences trimmed, laid end to end, then the same treatment for
all: mono 22 kHz, the top softened, a light bit-crush (the grain of an old cartridge), a short stone-room echo, loudness
normalised so the cues sit together. Needs ffmpeg.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "snd"
# cue: [(take, seconds after the previous take ends: < 0 overlaps it, tempo)]
CUES = {
    "door": [("doorOpen_2", 0, 1.2), ("doorClose_1", -0.75)],  # the hinges, and the door shut on them
    "card": [("cloth3", 0), ("bookFlip2", 0.0)],         # a sheet of vellum taken up and unfolded
    "seal": [("bookOpen", 0), ("cloth1", 0.05)],         # the wax snaps, the letter is opened
    "page": [("bookFlip1", 0)],                          # a page turned
    "close": [("bookClose", 0)],                         # a book or a sheet laid down
}
TRIM = "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01"
TREAT = ("highpass=f=90,lowpass=f=6500,acrusher=bits=11:mode=log:aa=1,"
         "aecho=0.7:0.5:45|90:0.22|0.12,loudnorm=I=-17:TP=-2:LRA=7")


def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def duration(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         check=True, capture_output=True, text=True).stdout
    return float(out)


def main(src):
    src = Path(src)
    src = src / "OGG" if (src / "OGG").is_dir() else src
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for cue, takes in CUES.items():
            parts = []; at = 0.0
            for k, (name, gap, *tempo) in enumerate(takes):
                p = Path(tmp) / f"{cue}{k}.wav"
                trim = (TRIM + ",areverse," + TRIM + ",areverse,")  # the take's silences cut at both ends
                speed = f"atempo={tempo[0]}," if tempo else ""
                run("ffmpeg", "-y", "-i", str(src / f"{name}.ogg"), "-af", f"{trim}{speed}aformat=channel_layouts=mono",
                    "-ar", "22050", str(p))
                start = max(0.0, at + gap) if k else 0.0
                parts.append((p, start))
                at = start + duration(p)
            joined = Path(tmp) / f"{cue}.wav"
            inputs = sum((["-i", str(p)] for p, _ in parts), [])
            delays = "".join(f"[{k}]adelay={int(t * 1000)}:all=1[d{k}];" for k, (_, t) in enumerate(parts))
            mix = "".join(f"[d{k}]" for k in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0"
            run("ffmpeg", "-y", *inputs, "-filter_complex", delays + mix, str(joined))
            run("ffmpeg", "-y", "-i", str(joined), "-af", TREAT, "-ac", "1", "-ar", "22050",
                "-c:a", "libmp3lame", "-b:a", "48k", str(OUT / f"{cue}.mp3"))
            print(f"  assets/snd/{cue}.mp3 ({(OUT / f'{cue}.mp3').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
