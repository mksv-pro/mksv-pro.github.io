"""Polyphonic transcription of one audio file with Spotify's Basic Pitch (Bittner et al., ICASSP 2022),
for mp3_to_tune.py. Basic Pitch needs TensorFlow, which has no wheel for the workspace's Python, so it
runs apart, in a throwaway environment:

  uv run --no-project --python 3.11 --with "basic-pitch[onnx]" --with "setuptools<70" \\
      python site/_tools/basic_pitch_notes.py <audio> <out.json> [start] [seconds]

Writes [[t0, t1, midi, amplitude]] (seconds from `start`).
"""
import json
import sys
import tempfile
from pathlib import Path

import librosa
import soundfile as sf
from basic_pitch import ICASSP_2022_MODEL_PATH
from basic_pitch.inference import predict


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    start = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0; secs = float(sys.argv[4]) if len(sys.argv) > 4 else None
    y, sr = librosa.load(src, sr=22050, mono=True, offset=start, duration=secs)
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "cut.wav"; sf.write(wav, y, sr)
        _, _, events = predict(str(wav), ICASSP_2022_MODEL_PATH, onset_threshold=0.5, frame_threshold=0.3, minimum_note_length=80)
    out.write_text(json.dumps([[round(float(a), 4), round(float(b), 4), int(m), round(float(v), 3)] for a, b, m, v, *_ in events]))
    print(f"{src.name}: {len(events)} notes")


if __name__ == "__main__":
    main()
