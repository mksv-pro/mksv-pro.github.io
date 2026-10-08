"""Georges Méliès, Le Voyage dans la Lune (1902; public domain, Internet Archive), for the magic
lantern shows in the great hall: the shot of the cannon, the flight, the rocket in the Moon's eye,
the Earth rising, the dream among the stars.

  uv run python site/_tools/fetch_melies.py     (from EnvS/; needs ffmpeg)

Two passages of the film, 5 frames a second, 56 x 42, four greys (an ordered dither, as a lantern
slide's grain), each frame's levels stretched; packed 2 bits a pixel, deflated (the browser
inflates them with DecompressionStream), base64.
Writes assets/data/real/melies.json: {w, h, n, fps, data}.
"""
import base64
import subprocess
import zlib

import numpy as np

import real

ITEM = "a-trip-to-the-moon-le-voyage-dans-la-lune-1902"
FILE = "A Trip to the moon (Le voyage dans la lune) (1902).mp4"
PASSAGES = [(325, 380), (395, 425)]  # seconds in that copy: the launch to the Moon's eye; the Earthrise and the dream
W, H, FPS = 56, 42, 5
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16


def main():
    import urllib.parse
    src = real.CACHE / "melies.mp4"
    if not src.exists():
        real.fetch(f"https://archive.org/download/{ITEM}/{urllib.parse.quote(FILE)}", "melies.mp4")
    frames = []
    for a, b in PASSAGES:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", str(src),
                              "-vf", f"fps={FPS},crop=iw:iw*3/4,scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                             capture_output=True, check=True).stdout
        frames += [np.frombuffer(raw[k:k + W * H], np.uint8).reshape(H, W).astype(float) for k in range(0, len(raw) - W * H + 1, W * H)]
    th = BAYER[np.arange(H)[:, None] % 4, np.arange(W)[None, :] % 4]
    packed = bytearray()
    for f in frames:
        lo, hi = np.percentile(f, 2), np.percentile(f, 98)
        v = np.clip((f - lo) / max(1, hi - lo), 0, 1) * 3  # 0..3
        q = np.clip(np.floor(v + th - 0.5 + 0.5), 0, 3).astype(np.uint8)  # (ordered dither between the four greys)
        flat = q.ravel()
        packed += bytes((flat[0::4] << 6) | (flat[1::4] << 4) | (flat[2::4] << 2) | flat[3::4])
    data = base64.b64encode(zlib.compress(bytes(packed), 9)).decode()
    print(f"  {len(frames)} frames, {len(packed) // 1024} KB packed, {len(data) // 1024} KB stored")
    real.write_asset("melies", {"w": W, "h": H, "n": len(frames), "fps": FPS, "data": data},
                     {"title": "Le Voyage dans la Lune", "author": "Georges Méliès", "year": "1902",
                      "source": f"https://archive.org/details/{ITEM}", "licence": "public domain (Internet Archive, Public Domain Mark)"})


if __name__ == "__main__":
    main()
