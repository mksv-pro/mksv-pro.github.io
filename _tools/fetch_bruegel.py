"""Pieter Bruegel the Elder, Hunters in the Snow (1565; Vienna, Kunsthistorisches Museum), from
Wikimedia Commons (public domain): its hunters, their hounds and the skaters on the ponds, cut out
as sprites for the castle's snowy days.

  uv run python site/_tools/fetch_bruegel.py     (from EnvS/)

The figures are dark on white snow (or on grey-green ice): each is a box on the 1200 px wide view
(below), thresholded on lightness, its largest connected blob kept, scaled to scene size, and
reduced to the scene's palette (no dither: at 6 to 13 px a figure is a few colours).
Writes assets/data/real/bruegel.json: {"sprites": [{w, h, px, role}]} (role hunter, hound, skater).
"""
import io

import numpy as np
from PIL import Image
from scipy import ndimage

import real

TITLE = "File:Pieter Bruegel the Elder - Hunters in the Snow (Winter) - Google Art Project.jpg"
# [role, box on the 1200 px view (x0, y0, x1, y1), height in scene px, lightness threshold]
FIGURES = [
    ("hunter", (318, 560, 475, 775), 13, 175),  # the nearest, his spear on his shoulder
    ("hunter", (280, 465, 400, 640), 12, 175),  # with the fox on his back
    ("hound", (40, 605, 168, 692), 8, 175),  # the grey wolfhound
    ("hound", (287, 628, 345, 690), 7, 175),  # the small one with a collar (the others overlap too much to cut out)
]
SKATE_BOX = (780, 450, 1130, 610)  # the frozen pond, its skaters
NAMES = ["OUTLINE", "CLOAK_SH", "CLOAK", "LEATHER_SH", "LEATHER", "LEATHER_HI", "TIMBER_SH", "TIMBER", "RUST_SH", "RUST",
         "CLOTH_SH", "CLOTH", "SKIN_SH", "SKIN", "HAT_SH", "HAT"]  # (no greys: they were the snow)


def blob(a, box, thr, scale):
    x0, y0, x1, y1 = (int(v * scale) for v in box)
    crop = a[y0:y1, x0:x1]
    lum = crop @ [0.3, 0.59, 0.11]
    sat = (crop.max(-1) - crop.min(-1)) / (crop.max(-1) + 1)
    snow = ((lum > thr) & (sat < 0.2)) | ((lum > 140) & (crop[..., 2] > crop[..., 0] + 4))  # (snow, and its bluish shadows; the figures are the rest)
    m = ndimage.binary_closing(~snow, iterations=2)
    m = ndimage.binary_opening(m, iterations=2)
    lab, n = ndimage.label(m)
    if not n:
        return None
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = lab == (1 + int(np.argmax(sizes)))
    keep = ndimage.binary_fill_holes(keep)
    ys, xs = np.nonzero(keep)
    return crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1], keep[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def sprite(rgb, mask, h):
    w = max(2, round(rgb.shape[1] * h / rgb.shape[0]))
    fill = np.median(rgb[mask], 0)  # (the edges average with the figure, not with the snow)
    im = Image.fromarray(np.where(mask[..., None], rgb, fill).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    mk = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)) > 140
    idx = real.quantize(np.asarray(im), NAMES, "none", alpha=mk)
    idx = np.pad(idx, 1, constant_values=255); mk = np.pad(mk, 1)  # a dark outline round the figure, as the scene's sprites have
    ring = ndimage.binary_dilation(mk) & ~mk
    idx[ring] = NAMES.index("OUTLINE")
    return idx


def main():
    url, lic, page = real.commons_url(TITLE, 3840)
    assert real.free(lic), lic
    a = np.asarray(Image.open(io.BytesIO(real.fetch(url))).convert("RGB"), float)
    scale = a.shape[1] / 1200
    sprites = []
    for k, (role, box, h, thr) in enumerate(FIGURES):
        rgb, mask = blob(a, box, thr, scale)
        idx = sprite(rgb, mask, h)
        real.preview(idx, NAMES, f"bruegel-{k}-{role}.png", 10)
        Image.fromarray(np.where(mask[..., None], rgb, [255, 0, 255]).astype(np.uint8)).save(real.CACHE.parent / "preview" / f"bruegel-mask-{k}.png")  # (to check)
        sprites.append({"w": idx.shape[1], "h": idx.shape[0], "px": real.b64(idx), "role": role})
    # the skaters: every dark blob of a skater's size on the pond, scaled together (they are far)
    x0, y0, x1, y1 = (int(v * scale) for v in SKATE_BOX)
    pond = a[y0:y1, x0:x1]
    m = (pond @ [0.3, 0.59, 0.11]) < 95
    lab, n = ndimage.label(m)
    found = 0
    for sl in ndimage.find_objects(lab):
        hh = sl[0].stop - sl[0].start; ww = sl[1].stop - sl[1].start
        if not (14 * scale / 3.2 < hh < 60 * scale / 3.2 and ww < hh * 1.4):  # (a standing figure, not a sledge or a shadow)
            continue
        sub = pond[sl]; mk = lab[sl] > 0
        idx = sprite(sub, mk, 5)
        sprites.append({"w": idx.shape[1], "h": idx.shape[0], "px": real.b64(idx), "role": "skater"})
        found += 1
        if found >= 10:
            break
    print(f"  {len(FIGURES)} hunters and hounds, {found} skaters")
    real.write_asset("bruegel", {"names": NAMES, "sprites": sprites},
                     {"title": "Hunters in the Snow", "author": "Pieter Bruegel the Elder", "year": "1565", "source": page, "licence": lic})


if __name__ == "__main__":
    main()
