"""Four portraits for the schoolroom, beside the board, one for each of its standing equations
(Wikimedia Commons, public domain): Schrödinger (his photograph of 1933), Einstein (at the patent
office in Bern, 1904, the year before his paper on Brownian motion and diffusion), Boltzmann (about
1902) and William Rowan Hamilton (a daguerreotype, about 1845).

  uv run python site/_tools/fetch_portraits.py     (from EnvS/)

Each cropped to the head and shoulders (the box below, fractions of the picture), its levels
stretched, scaled to 11 x 14 (the wall beside the board has room for no more), read as five tones of
a sepia print (no dither: at this size it is noise).
Writes assets/data/real/portraits.json: "frames" (44 x 56, the card's, sepia dithered), "small" (11 x 14,
the wall's) and "captions", in the board's order.
"""
import io

import numpy as np
from PIL import Image, ImageOps

import real

FACES = [  # [Commons file, crop, name, his equation, the picture]
    ("Erwin Schrödinger (1933).jpg", (0.05, 0.0, 0.95, 0.85), "Erwin Schrödinger", "the wave equation, 1926 (the board's first line)", "photographed in 1933, the year of his Nobel prize"),
    ("Einstein patentoffice.jpg", (0.12, 0.05, 0.95, 0.85), "Albert Einstein", "diffusion: the jiggling of small grains in water explained by molecules, 1905 (the second line)", "at the patent office in Bern, 1904"),
    ("Boltzmann2.jpg", (0.18, 0.02, 0.98, 0.82), "Ludwig Boltzmann", "the weight e^-βE of each state, from which the partition function Z (the third line)", "about 1902"),
    ("William Rowan Hamilton portrait oval combined.png", (0.2, 0.08, 0.92, 0.8), "William Rowan Hamilton", "the principal function of mechanics, 1834, that Jacobi and then Bellman took up (the last line)", "a daguerreotype, about 1845"),
]
W, H = 11, 14
BW, BH = 44, 56
RAMP = ["OUTLINE", "LEATHER_SH", "LEATHER", "SKIN_SH", "CREAM"]


def main():
    frames, small, caps, credits = [], [], [], []
    for k, (f, (x0, y0, x1, y1), name, eq, pic) in enumerate(FACES):
        url, lic, page = real.commons_url(f"File:{f}", 600)
        assert real.free(lic), (f, lic)
        im = Image.open(io.BytesIO(real.fetch(url))).convert("L")
        im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
        im = ImageOps.autocontrast(im, cutoff=2)
        g = np.asarray(im.resize((W, H), Image.LANCZOS), float) / 255
        idx = np.clip((g ** 0.9 * len(RAMP)).astype(int), 0, len(RAMP) - 1).astype(np.uint8)
        real.preview(idx, RAMP, f"portrait-{k}.png", 10)
        small.append(real.b64(idx))
        rgb = np.asarray(im.convert("RGB").resize((BW, BH), Image.LANCZOS), float)  # (the card's: larger, dithered over the same five tones)
        lum = rgb.mean(2, keepdims=True) / 255; pal = np.array([real.palette()[n] for n in RAMP], float)

        sep = np.stack([np.interp(lum[..., 0] ** 0.9, np.linspace(0, 1, len(RAMP)), pal[:, c]) for c in range(3)], -1)
        frames.append(real.b64(real.quantize(sep, RAMP, "fs"))); caps.append({"name": name, "text": f"{eq}; {pic}."})
        credits.append({"title": f"Portrait of {name} ({pic})", "author": "unknown photographer", "year": "", "source": page, "licence": lic})
    real.write_asset("portraits", {"w": BW, "h": BH, "names": RAMP, "frames": frames, "small": {"w": W, "h": H, "frames": small}, "captions": caps}, credits)


if __name__ == "__main__":
    main()
