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
# cue: [(take, seconds of silence before it)]
CUES = {
    "door": [("doorOpen_2", 0), ("doorClose_1", 0.12)],  # into a room: the hinges, then the door shuts
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


def main(src):
    src = Path(src)
    src = src / "OGG" if (src / "OGG").is_dir() else src
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for cue, takes in CUES.items():
            parts = []
            for k, (name, gap) in enumerate(takes):
                p = Path(tmp) / f"{cue}{k}.wav"
                pad = f"adelay={int(gap * 1000)}|{int(gap * 1000)}," if gap else ""
                trim = (TRIM + ",areverse," + TRIM + ",areverse,")  # the take's silences cut at both ends
                run("ffmpeg", "-y", "-i", str(src / f"{name}.ogg"), "-af", f"{trim}{pad}aformat=channel_layouts=mono",
                    "-ar", "22050", str(p))
                parts.append(p)
            joined = Path(tmp) / f"{cue}.wav"
            inputs = sum((["-i", str(p)] for p in parts), [])
            run("ffmpeg", "-y", *inputs, "-filter_complex", f"concat=n={len(parts)}:v=0:a=1", str(joined))
            run("ffmpeg", "-y", "-i", str(joined), "-af", TREAT, "-ac", "1", "-ar", "22050",
                "-c:a", "libmp3lame", "-b:a", "48k", str(OUT / f"{cue}.mp3"))
            print(f"  assets/snd/{cue}.mp3 ({(OUT / f'{cue}.mp3').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
