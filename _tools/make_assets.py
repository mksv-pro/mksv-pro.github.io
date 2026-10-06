"""Build the site's generated images from _tools/src/ into assets/img/.

Run from the site root:  python _tools/make_assets.py [engraving illuminations monogram og figures]
(no argument: all). Needs Pillow + NumPy. Colours must match the tokens at the top of styles.css.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import illuminations
from colour import rgb

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_tools" / "src"
OUT = ROOT / "assets" / "img"
FONT = ROOT / "assets" / "fonts" / "DepartureMono-Regular.woff2"
# Report figures, from the nuclear-emulators project of the EnvS workspace (published as-is, resized).
FIGURES = ROOT.parent / "projects" / "nuclear-emulators" / "src" / "nuclear_emulators" / "outputs" / "figures"

# (background, ink) of the terminal theme's plate: the engraved lines lit on the dark.
THEMES = {
    "dark": ("#12100c", "#cdb98f"),
}


def atkinson(gray):
    """1-bit Atkinson dither of a float array in [0, 1]; returns bool (True = light).
    Only 6/8 of the error is diffused, which keeps engraved blacks and whites clean."""
    a = gray.astype(np.float64).copy()
    h, w = a.shape
    out = np.zeros_like(a, dtype=bool)
    for y in range(h):
        for x in range(w):
            old = a[y, x]
            new = 1.0 if old >= 0.5 else 0.0
            out[y, x] = new > 0
            e = (old - new) / 8.0
            for dx, dy in ((1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and yy < h:
                    a[yy, xx] += e
    return out


def two_tone(mask, bg, ink, name):
    """mask True = ink. Saved as a 2-colour indexed PNG (a few kB)."""
    im = Image.fromarray(mask.astype(np.uint8), "P")
    im.putpalette(list(rgb(bg)) + list(rgb(ink)))
    im.save(OUT / name, optimize=True)


def engraving(width=380):
    # Flammarion, L'atmosphere (1888): the pilgrim and the starred vault, portrait crop.
    im = Image.open(SRC / "flammarion-1888.jpg").convert("L")
    im = im.crop((110, 110, 1130, 1500))
    h = round(im.height * width / im.width)
    g = np.asarray(im.resize((width, h), Image.LANCZOS), dtype=np.float64) / 255.0
    paper = atkinson(g)
    two_tone(~paper, THEMES["dark"][0], THEMES["dark"][1], "flammarion-dark.png")   # lines lit
    print(f"engraving: {width}x{h}")


# Lombardic "MS" monogram, the letterform of illuminated initials; X = ink.
MONOGRAM = """
..XXX...XXX.....XXXX.
.XXXXX.XXXXX...XX..XX
XX..XXXX..XX..XX....X
XX...XX...XX..XX.....
XX...XX...XX...XXX...
XX...XX...XX....XXXX.
XX...XX...XX......XXX
XX...XX...XX.......XX
.XX..XX...XX..X....XX
..X..XX..XXX..XX..XX.
.....X...X.....XXXX..
""".strip("\n").splitlines()


def monogram_rects(ox=0, oy=0):
    """One <rect> per horizontal run of ink, offset by (ox, oy)."""
    out = []
    for y, row in enumerate(MONOGRAM):
        x = 0
        while x < len(row):
            if row[x] == "X":
                x0 = x
                while x < len(row) and row[x] == "X":
                    x += 1
                out.append(f'<rect x="{ox + x0}" y="{oy + y}" width="{x - x0}" height="1"/>')
            else:
                x += 1
    return "".join(out)


def og_card():
    """1200x630 share card: the dark plate on the left, name and line on the right."""
    bg, ink = THEMES["dark"]
    accent = "#e0a23a"
    card = Image.new("RGB", (1200, 630), rgb(bg))
    plate = Image.open(OUT / "flammarion-dark.png").convert("RGB")
    k = 630 / plate.height
    plate = plate.resize((round(plate.width * k), 630), Image.NEAREST)
    card.paste(plate, (0, 0))
    d = ImageDraw.Draw(card)
    x0 = plate.width + 1
    d.line([(x0, 0), (x0, 630)], fill=rgb("#4d4230"), width=2)
    px = 7  # monogram pixel size
    for y, row in enumerate(MONOGRAM):
        for x, c in enumerate(row):
            if c == "X":
                d.rectangle([x0 + 60 + x * px, 120 + y * px,
                             x0 + 60 + (x + 1) * px - 1, 120 + (y + 1) * px - 1], fill=rgb(accent))
    big = ImageFont.truetype(str(FONT), 72)
    small = ImageFont.truetype(str(FONT), 28)
    d.text((x0 + 60, 250), "Mike Silva", font=big, fill=rgb("#efe3c4"))
    d.text((x0 + 60, 345), "physics \u00b7 complex systems", font=small, fill=rgb(accent))
    d.text((x0 + 60, 385), "stochastic processes \u00b7 simulation", font=small, fill=rgb(ink))
    d.text((x0 + 60, 520), "mksv-pro.github.io", font=small, fill=rgb("#968768"))
    card.save(OUT / "og.png", optimize=True)
    print("og card: 1200x630")


def figures():
    """Copy two report figures into assets/img/projects/, at most `width` px wide."""
    dest = OUT / "projects"
    dest.mkdir(exist_ok=True)
    for src, name, width in (("f2_validation.png", "nuclear-validation.png", 1400),
                             ("n40Ca_cat_S00.png", "nuclear-cost-n40Ca.png", 1000)):
        im = Image.open(FIGURES / src).convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im = im.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
        im.save(dest / name, optimize=True)
        print(f"figure: {name} {im.width}x{im.height}")


def monogram():
    w, h = len(MONOGRAM[0]), len(MONOGRAM)
    n = w + 4  # square favicon, glyph centred
    (OUT / "monogram.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
        f'<rect width="{n}" height="{n}" fill="#12100c"/>'
        f'<rect x=".5" y=".5" width="{n - 1}" height="{n - 1}" fill="none" stroke="#e0a23a"/>'
        f'<g fill="#e0a23a">{monogram_rects(2, (n - h) // 2)}</g></svg>\n')
    print(f"inline header svg (viewBox 0 0 {w + 2} {h + 2}):")
    print(monogram_rects(1, 1))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    steps = {"engraving": engraving, "illuminations": lambda: illuminations.build(OUT),
             "monogram": monogram, "og": og_card, "figures": figures}
    for name in sys.argv[1:] or steps:
        steps[name]()
