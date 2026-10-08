"""Eadweard Muybridge's sequences (public domain, Wikimedia Commons): The Horse in Motion (Sallie
Gardner at a gallop, Palo Alto, 19 June 1878, 11 frames) and a man walking (Animal Locomotion,
1887, 12 frames), for the messenger's horse and the passers-by.

  uv run python site/_tools/fetch_muybridge.py     (from EnvS/)

Each frame's silhouette (dark horse on a light ground, light man on a dark one; the largest blob,
cleaned) is scaled to scene size and written as text in the scene's material letters, so hours.js
shades and outlines it with shadeSprite like its own sprites: the horse 'h' (leather), its rider a
cloak 'd' with a face 'f'; the walker a hood 'p', a face 'f', a coat 'd', breeches 'h'.
Writes assets/data/real/muybridge.json: {"rider": [text...], "walker": [text...]} (both facing right).
"""
import io

import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage

import real


def frames(title):
    url, lic, page = real.commons_url(f"File:{title}")
    assert real.free(lic), (title, lic)
    im = Image.open(io.BytesIO(real.fetch(url)))
    return [np.asarray(f.convert("L"), float) for f in ImageSequence.Iterator(im)], page, lic


def silhouette(g, dark, thr, trim=None, blur=0, close=0, opening=2):
    if blur:
        g = ndimage.gaussian_filter(g, blur)  # (a figure's own shadows would cut it in pieces)
    m = g < thr if dark else g > thr
    if trim:  # (the frame's own margins: numbers, the track's lines)
        x0, y0, x1, y1 = trim; mm = np.zeros_like(m); mm[y0:y1, x0:x1] = m[y0:y1, x0:x1]; m = mm
    if close:
        m = ndimage.binary_closing(m, iterations=close)
    m = ndimage.binary_opening(m, iterations=opening)
    lab, n = ndimage.label(m)
    if not n:
        return None
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = ndimage.binary_fill_holes(lab == 1 + int(np.argmax(sizes)))
    ys, xs = np.nonzero(keep)
    return keep[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def scaled(mask, h, w=None):
    w = w or max(2, round(mask.shape[1] * h / mask.shape[0]))
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)) > 120


def rider_text(m):
    """The rider: what stands above the horse's back (the first row where the blob is wide)."""
    h, w = m.shape
    widths = m.sum(1); back = next((y for y in range(h) if widths[y] > 0.45 * w), h // 3)
    rows = []
    for y in range(h):
        row = ""
        for x in range(w):
            if not m[y, x]:
                row += "."
            elif y < back and 0.28 * w < x < 0.68 * w:  # (above the back, over the saddle: not the horse's neck)
                row += "f" if y < max(2, back * 0.3) else "d"
            else:
                row += "h"
        rows.append(row)
    return "\n".join(rows)


def walker_text(m):
    h, w = m.shape
    rows = []
    for y in range(h):
        k = y / h
        c = "p" if k < 0.08 else "f" if k < 0.18 else "d" if k < 0.55 else "h"
        rows.append("".join(c if m[y, x] else "." for x in range(w)))
    return "\n".join(rows)


def main():
    horse, hp, hl = frames("The Horse in Motion-anim.gif")
    rider = []
    for g in horse:
        s = silhouette(g, True, 90, trim=(0, 22, g.shape[1], g.shape[0] - 25))
        rider.append(rider_text(scaled(s, 14, 24)))
    man, mp, ml = frames("Muybridge human male walking animated.gif")
    walker = []
    for g in man:
        s = silhouette(g, False, 85, trim=(0, 0, g.shape[1], g.shape[0] - 60), blur=2.5, close=4, opening=3)
        s = ndimage.binary_dilation(np.pad(s, 30), iterations=22)  # (a body 1 px wide at this size does not read: thickened,
        walker.append(walker_text(scaled(s, 11, max(4, round(s.shape[1] * 11 / s.shape[0] * 1.6)))))  # and widened, as pixel figures are)
    print(rider[3], "\n\n", walker[0])
    real.write_asset("muybridge", {"rider": rider, "walker": walker}, [
        {"title": "The Horse in Motion (Sallie Gardner at a gallop)", "author": "Eadweard Muybridge", "year": "1878", "source": hp, "licence": hl},
        {"title": "Animal Locomotion: a man walking", "author": "Eadweard Muybridge", "year": "1887", "source": mp, "licence": ml},
    ])


if __name__ == "__main__":
    main()
