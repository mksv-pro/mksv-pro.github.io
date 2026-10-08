"""The workshop's tool rack, after André-Jacob Roubo's L'Art du menuisier (1769, plates 12-14; the
Académie des sciences' Descriptions des arts et métiers, companion to the Encyclopédie's plates),
from Wikimedia Commons (public domain).

  uv run python site/_tools/fetch_outils.py     (from EnvS/)

Each tool cut from its plate (TOOLS: the box of its figure, as fractions of the plate; found by
labelling the plate's ink, see the note at the end); its silhouette the paper the ink encloses (the
ink dilated until its lines close, the white reaching the box's edge the background), a frame
saw's large blanks inside it taken out; scaled to the
rack, three tones of its material by the engraving's darkness (quantiles) and an outline (not on bars a
pixel wide: they keep their colour, to be seen on the dark wall). A chisel's
blade is iron, its handle wood; hung blade down.
Writes assets/data/real/outils.json: {"sprites": [{w, h, px, on}], "captions"} (on: it stands on the
rack's bar instead of hanging from it).
"""
import io

import numpy as np
from PIL import Image
from scipy import ndimage

import real

T = "File:A-J Roubo - L'Art du Menuisier - Planche {}.png"
TOOLS = [  # [plate, box (x0, y0, x1, y1), height, material (or the iron part's fraction from the top), flipped, on the bar, name]
    ("012", (0.085, 0.065, 0.335, 0.32), 13, "wood", False, False, "a frame saw for ripping planks (pl. 12, fig. 1)"),
    ("014", (0.08, 0.345, 0.17, 0.635), 13, 0.52, True, False, "a firmer chisel (pl. 14, fig. 8)"),
    ("014", (0.09, 0.18, 0.25, 0.315), 10, "wood", False, False, "a try square (pl. 14, fig. 3)"),
    ("012", (0.68, 0.125, 0.835, 0.318), 11, "wood", False, False, "a smaller frame saw (pl. 12, fig. 3)"),
    ("014", (0.288, 0.345, 0.375, 0.635), 13, 0.5, True, False, "a broad chisel (pl. 14, fig. 10)"),
    ("014", (0.47, 0.368, 0.72, 0.503), 7, "wood", False, True, "a smoothing plane (pl. 14, fig. 12)"),
    ("013", (0.135, 0.075, 0.61, 0.19), 5, "wood", False, True, "a long plane for truing boards (pl. 13, fig. 1)"),
]
RAMPS = {"wood": ["TIMBER_HI", "TIMBER", "TIMBER_SH"], "iron": ["ARM_HI", "ARM", "ARM_SH"]}
NAMES = RAMPS["wood"] + RAMPS["iron"] + ["OUTLINE"]


def tool(g, H, mat, flip, frame):
    ink = g < 160
    r = max(2, int(min(g.shape) * 0.03))
    lab, _ = ndimage.label(~ndimage.binary_dilation(ink, iterations=r))
    border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    sil = ndimage.binary_fill_holes(ndimage.binary_erosion(~np.isin(lab, [b for b in border if b]), iterations=r))
    lab, n = ndimage.label(sil); sil = lab == 1 + int(np.argmax(ndimage.sum(sil, lab, range(1, n + 1))))
    lab, n = ndimage.label(sil & ~ndimage.binary_dilation(ink, iterations=2))  # (a frame saw's inside, blank paper: open)
    for c in range(1, n + 1 if frame else 1):
        m = lab == c
        if m.sum() > 0.06 * sil.sum():
            sil &= ~m
    ys, xs = np.nonzero(sil); sl = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1)); g, sil = g[sl], sil[sl]
    if flip:
        g, sil = g[::-1], sil[::-1]
    W = max(2, round(sil.shape[1] * H / sil.shape[0]))
    down = lambda a: np.asarray(Image.fromarray(a.astype(np.uint8)).resize((W, H), Image.BOX), float)
    S = down(sil * 255) / 255; L = down(np.where(sil, g, 0)) / np.maximum(S, 1e-3)
    inside = S > 0.32  # (a chisel's blade is a sliver)
    tone = np.digitize(-L, np.quantile(-L[inside], [0.33, 0.7]))  # (0 light .. 2 dark)
    idx = np.full((H, W), 255, np.uint8)
    for y in range(H):
        part = mat if isinstance(mat, str) else ("iron" if (H - 1 - y if flip else y) < mat * H else "wood")
        for x in range(W):
            if inside[y, x]:
                idx[y, x] = NAMES.index(RAMPS[part][tone[y, x]])
    core = ndimage.binary_erosion(inside)  # (the outline where the tool is thick; a bar one pixel wide keeps its wood)
    idx[inside & ~core & ndimage.binary_dilation(core)] = NAMES.index("OUTLINE")
    return idx


def main():
    sprites, caps, pages = [], [], {}
    for k, (pl, (x0, y0, x1, y1), H, mat, flip, on, name) in enumerate(TOOLS):
        url, lic, page = real.commons_url(T.format(pl), 1600)
        assert real.free(lic), (pl, lic)
        pages[pl] = (page, lic)
        g = np.asarray(Image.open(io.BytesIO(real.fetch(url))).convert("L"), float)
        g = g[int(y0 * g.shape[0]):int(y1 * g.shape[0]), int(x0 * g.shape[1]):int(x1 * g.shape[1])]
        idx = tool(g, H, mat, flip, "saw" in name); real.preview(idx, NAMES, f"outil-{k}.png", 10)
        sprites.append({"w": idx.shape[1], "h": idx.shape[0], "px": real.b64(idx), "on": on}); caps.append(name)
        print(f"  {name:48s} {idx.shape[1]} x {idx.shape[0]}")
    real.write_asset("outils", {"names": NAMES, "sprites": sprites, "captions": caps},
                     [{"title": f"L'Art du menuisier, plate {int(pl)}", "author": "André-Jacob Roubo", "year": "1769", "source": p, "licence": lic} for pl, (p, lic) in pages.items()])


if __name__ == "__main__":
    main()

# The boxes: each plate's ink (darker than 150, its frame and title cut off) closed by 4 px and labelled;
# the components' boxes, printed and drawn over the plate, picked by eye and padded a little.
