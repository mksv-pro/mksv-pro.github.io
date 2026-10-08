"""Furniture after Viollet-le-Duc's Dictionnaire raisonné du mobilier français (1858-1875; tome 1, the
article BANC; the engravings on Wikimedia Commons, public domain): a bench with dragons' heads for the
great hall, a bench-chest with pierced quatrefoils for the rookery.

  uv run python site/_tools/fetch_mobilier.py     (from EnvS/)

An engraving in tone, cropped to its piece: the ink (darker than 170) dilated until the lines close, the
white that still reaches the border is the background, the rest (holes filled, eroded back) the
piece, less the blank paper that runs down to the floor (between the legs). Scaled to the room (box averages): a cell is a line (OUTLINE) where the ink is dense, else one
of three tones of wood by the hatching's density around it (its quantiles in the piece). A drawing in
outline: see lineart.
Writes assets/data/real/mobilier.json: "sprites" and "captions", in FIGS's order.
"""
import io

import numpy as np
from PIL import Image
from scipy import ndimage

import real

T = "File:Viollet-le-Duc - Dictionnaire raisonné du mobilier français de l'époque carlovingienne à la Renaissance (1873-1874), tome 1-{}.png"
FIGS = [  # [file's number, crop (x0, y0, x1, y1) as fractions, height in room pixels, name, caption, drawn in outline or in tone]
    ("48", (0, 0.15, 1, 0.88), 24, "A bench with dragons' heads", "its posts ending in beasts' heads and lions' paws, its back pierced with round-headed arches, a cushion along its top and a footstool before it (article BANC, fig. 3)", "line"),
    ("49", (0, 0.05, 1, 0.5), 14, "A bench-chest", "a long chest to sit on, its front pierced with quatrefoils (article BANC, fig. 4)", "tone"),
]
NAMES = ["TIMBER_HI", "TIMBER", "TIMBER_SH", "OUTLINE"]


def piece(g, H):
    ink = g < 170
    r = max(3, int(g.shape[0] * 0.022))
    lab, _ = ndimage.label(~ndimage.binary_dilation(ink, iterations=r))
    border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    sil = ndimage.binary_fill_holes(ndimage.binary_erosion(~np.isin(lab, [b for b in border if b]), iterations=r))
    lab, n = ndimage.label(sil); sil = lab == 1 + int(np.argmax(ndimage.sum(sil, lab, range(1, n + 1))))
    ys, xs = np.nonzero(sil); ink, sil = ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1], sil[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    W = max(3, round(sil.shape[1] * H / sil.shape[0]))
    down = lambda a: np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((W, H), Image.BOX), float) / 255
    S, D = down(sil), down(ink & sil)
    inside = S > 0.5; d = np.where(inside, D / np.maximum(S, 1e-3), 0)
    soft = ndimage.gaussian_filter(d, 1.2)  # (the hatching's tone, over a few pixels)
    idx = np.digitize(soft, np.quantile(soft[inside], [0.35, 0.75])).astype(np.uint8)
    idx[d > max(0.38, np.quantile(d[inside], 0.8))] = 3  # (a carved edge, a stile: a line of its own)
    lab, n = ndimage.label(inside & (d < 0.04))  # (paper left blank down to the floor: the space between the legs)
    for c in range(1, n + 1):
        m = lab == c
        if m.sum() >= 4 and m[-1].any():
            inside &= ~m
    idx[inside & ~ndimage.binary_erosion(inside)] = 3
    idx[~inside] = 255
    return idx


def lineart(g, H):
    """A drawing in outline: each white region the lines close is a part, wood (two tones, turn and
    turn about) or, if small, an opening through which the wall shows; the white reaching the border is
    the background. The lines themselves are lines (OUTLINE) where they are dense enough in a cell."""
    raw = g < 170; ink = ndimage.binary_dilation(raw, iterations=3)  # (3 px: the drawing's gaps closed; 2 leaves its back open)
    lab, n = ndimage.label(~ink); sizes = ndimage.sum(~ink, lab, range(1, n + 1))
    border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    cls = np.full(g.shape, 9, np.uint8)  # 0 background, 1 and 2 wood, 3 line, 9 a line's margin (yet to say)
    for c in range(1, n + 1):  # (sizes in this figure: the panels 1-9% of it, the arches 0.2-0.4%, specks less)
        a = sizes[c - 1] / g.size
        cls[lab == c] = 0 if c in border or 0.0012 <= a <= 0.005 else 1 + c % 2 if a > 0.005 else 9
    _, (iy, ix) = ndimage.distance_transform_edt(cls == 9, return_indices=True)
    cls = cls[iy, ix]; cls[raw] = 3  # (a margin is the region it borders; the ink, line)
    ys, xs = np.nonzero(cls); cls = cls[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    W = max(3, round(cls.shape[1] * H / cls.shape[0]))
    frac = [np.asarray(Image.fromarray(((cls == k) * 255).astype(np.uint8)).resize((W, H), Image.BOX), float) / 255 for k in range(4)]
    idx = np.array([255, 0, 1], np.uint8)[np.argmax(np.stack(frac[:3]), 0)]
    idx[frac[3] > 0.22] = 3
    return idx


def main():
    frames, caps, credits = [], [], []
    for k, (fid, (x0, y0, x1, y1), H, name, text, how) in enumerate(FIGS):
        url, lic, page = real.commons_url(T.format(fid), 1200)
        assert real.free(lic), (fid, lic)
        g = np.asarray(Image.open(io.BytesIO(real.fetch(url))).convert("L"), float)
        g = g[int(y0 * g.shape[0]):int(y1 * g.shape[0]), int(x0 * g.shape[1]):int(x1 * g.shape[1])]
        idx = (lineart if how == "line" else piece)(g, H); real.preview(idx, NAMES, f"mobilier-{k}.png", 8)
        frames.append({"w": idx.shape[1], "h": idx.shape[0], "px": real.b64(idx)}); caps.append({"name": name, "text": text})
        credits.append({"title": f"Dictionnaire raisonné du mobilier français, tome 1, article BANC ({name.lower()})", "author": "Eugène Viollet-le-Duc",
                        "year": "1858-1875", "source": page, "licence": lic})
        print(f"  {fid}: {idx.shape[1]} x {idx.shape[0]}")
    real.write_asset("mobilier", {"names": NAMES, "sprites": frames, "captions": caps}, credits)


if __name__ == "__main__":
    main()
