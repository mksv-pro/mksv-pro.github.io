"""Pen-work ornaments for the castle's texts: flat ink colours (lapis, vermilion, gold, green) on
the vellum, no outline, one SVG pixel per image pixel (shown at the UI pixel, --upx).

  python3 _tools/ornaments.py        -> assets/img/orn/*.svg

Each kind comes in several designs, all on the same canvas (the design centred in it), so the
page can swap one for another without changing any size; script.js picks a design per text.

band-*:    under a title, a tile repeated across (canvas height 19): vine, interlace, lozenges,
           leaves, ribbon
fleuron-*: either side of a title (9 x 11): quatrefoil, lily, rosette, trefoil
tail-*:    the cul-de-lampe closing a text (33 x 15): triangle, drop, ribbon
tendril-*: the flourish from the initial down the margin, repeated down (9 x 24), in r, b or G
droll-*:   marginal drolleries (18 x 12): snail, bird, rabbit, fish, dragonet, cat
diamond-*: the list bullets, blue and red in turn
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img" / "orn"
INK = {"b": "#2a4caa", "r": "#b03020", "g": "#b8862a", "G": "#3f7238", "y": "#e0b850", "k": "#3a2a1c",
       "w": "#f6efe0", "h": "#7a5432"}


def svg(px, w, h):
    rects = []
    for y in range(h):
        x = 0
        while x < w:
            c = px.get((x, y))
            n = 1
            while c and px.get((x + n, y)) == c:
                n += 1
            if c:
                rects.append(f'<rect x="{x}" y="{y}" width="{n}" height="1" fill="{INK[c]}"/>')
            x += n
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'shape-rendering="crispEdges">{"".join(rects)}</svg>\n')


def rows(*lines):
    """ASCII art to pixels: '.' is empty, any other letter an ink of INK."""
    px = {(x, y): c for y, r in enumerate(lines) for x, c in enumerate(r) if c != "."}
    return px, max(map(len, lines)), len(lines)


def canvas(art, w, h):
    """Centre a design on a canvas of w x h (keeps a tile's own width when w is None)."""
    px, w0, h0 = art
    W = w0 if w is None else w
    dx, dy = (W - w0) // 2, (h - h0) // 2
    return {(x + dx, y + dy): c for (x, y), c in px.items()}, W, h


def vine(px, pts, c="G"):
    """Join successive points with unbroken 1 px runs (no gaps where the line is steep)."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            px[x0, y] = c
        px[x1, y1] = c


# ---- bands -----------------------------------------------------------------------------

def band_vine():
    """A rinceau: an unbroken vine; a red bud above each crest, a blue one below each trough;
    small green curls and gold buds between them. Period 32."""
    w, h = 32, 19
    px = {}
    yv = lambda x: 9 + round(3.5 * math.sin(2 * math.pi * x / w))
    vine(px, [(x, yv(x)) for x in range(w)])
    for cx, up, c in ((24, True, "r"), (8, False, "b")):  # y grows down: the crest is at 24
        y = yv(cx); d = -1 if up else 1
        px[cx, y + d] = "G"
        for dx, dy in ((0, 2), (-1, 2), (1, 2), (0, 3), (-1, 3), (1, 3), (0, 4), (-2, 2), (2, 2)):
            px[cx + dx, y + d * dy] = c
    for cx, up in ((3, True), (13, False), (19, False), (29, True)):
        y = yv(cx); d = -1 if up else 1
        for dx, dy in ((0, 1), (1, 2), (1, 3), (0, 3), (-1, 2)):
            px[cx + dx, y + d * dy] = "G"
    for x, up in ((0, True), (16, False)):
        y = yv(x); d = -1 if up else 1
        px[x % w, y + d] = "g"; px[x % w, y + 2 * d] = "y"
    return px, w, h


def band_interlace():
    """Two strands, gold and blue, crossing over and under in turn. Period 16."""
    w, h = 16, 19
    px = {}
    a = [(x, 9 + round(3 * math.sin(2 * math.pi * x / w))) for x in range(w)]
    b = [(x, 9 - round(3 * math.sin(2 * math.pi * x / w))) for x in range(w)]
    vine(px, b, "b")
    vine(px, a, "g")
    for x in (0, 8):  # at each crossing, the strand on top alternates
        top = "b" if x == 0 else "g"
        for y in range(7, 12):
            px[x, y] = top
        px[(x - 1) % w, 9] = top; px[(x + 1) % w, 9] = top
    for x in (4, 12):  # a red dot in each loop
        px[x, 9] = "r"
    return px, w, h


def band_lozenges():
    """A chain of red lozenges with a blue heart, joined by a gold line. Period 12."""
    w, h = 12, 19
    px = {(x, 9): "g" for x in range(w)}
    for dx, dy in ((0, -3), (-1, -2), (1, -2), (-2, -1), (2, -1), (-3, 0), (3, 0), (-2, 1), (2, 1),
                   (-1, 2), (1, 2), (0, 3)):
        px[6 + dx, 9 + dy] = "r"
    for dx, dy in ((0, 0), (0, -1), (0, 1), (-1, 0), (1, 0)):
        px[6 + dx, 9 + dy] = "b"
    px[0, 8] = "y"; px[0, 10] = "y"
    return px, w, h


def band_leaves():
    """A straight green stem, leaves springing from it in pairs, a red berry between. Period 10."""
    w, h = 10, 19
    px = {(x, 9): "G" for x in range(w)}
    for dx, dy in ((1, -1), (2, -2), (3, -2), (2, -3), (1, 1), (2, 2), (3, 2), (2, 3)):
        px[1 + dx, 9 + dy] = "G"
    px[7, 8] = "r"; px[8, 8] = "r"; px[7, 7] = "r"
    return px, w, h


def band_ribbon():
    """A gold-edged ribbon of red and blue in turn, a cream stitch through it. Period 8."""
    w, h = 8, 19
    px = {}
    for x in range(w):  # a light ribbon: gold edges, three rows of colour, a stitch of cream
        px[x, 7] = "g"; px[x, 11] = "g"
        for y in range(8, 11):
            px[x, y] = "r" if x < 4 else "b"
        if x % 4 == 1:
            px[x, 9] = "w"
    return px, w, h


# ---- fleurons ---------------------------------------------------------------------------

def fleuron_quatrefoil():
    return rows("....g....", "...grg...", "..g.r.g..", ".bb.g.bb.", "bbbgggbbb", ".bb.g.bb.",
                "..g.r.g..", "...grg...", "....g....")


def fleuron_lily():
    return rows("....b....", "...bbb...", "...bbb...", ".b.bbb.b.", "bb.bbb.bb", "b..bbb..b",
                ".bb.b.bb.", "..ggggg..", "...bbb...", "..b.b.b..", ".b..b..b.")


def fleuron_rosette():
    return rows("...r.r...", "..rrrrr..", ".rr.r.rr.", "rrryyyrrr", ".rrygyrr.", "rrryyyrrr",
                ".rr.r.rr.", "..rrrrr..", "...r.r...")


def fleuron_trefoil():
    return rows("...GGG...", "..GGGGG..", "GG.GGG.GG", "GGGGGGGGG", ".GGGgGGG.", "...grg...",
                "....g....", "....g....", "...ggg...", "....r....")


# ---- tailpieces -------------------------------------------------------------------------

def tail_triangle():
    """An inverted triangle: a gold rule, a row of red and blue lozenges, vines narrowing to a drop."""
    w, h = 33, 15
    px = {}
    for x in range(2, w - 2):
        px[x, 0] = "g"
    for k, x in enumerate(range(4, w - 4, 4)):
        c = "r" if k % 2 == 0 else "b"
        for dx, dy in ((0, 2), (-1, 3), (0, 3), (1, 3), (0, 4)):
            px[x + dx, dy] = c
    mid = w // 2
    for y in range(6, 13):
        half = (13 - y) * 2
        px[mid - half, y] = "G"; px[mid + half, y] = "G"
        if y % 2 == 0:
            px[mid - half + 1, y] = "g"; px[mid + half - 1, y] = "g"
    for dy in (12, 13, 14):
        px[mid, dy] = "r"
    px[mid - 1, 13] = "r"; px[mid + 1, 13] = "r"
    return px, w, h


def tail_drop():
    """Lozenges shrinking down a gold stem, two leaves, a red drop."""
    w, h = 33, 15
    mid = w // 2
    px = {(mid, y): "g" for y in range(0, 13)}
    for top, r, c in ((0, 3, "b"), (6, 2, "r"), (10, 1, "b")):
        for dy in range(-r, r + 1):
            for dx in range(-(r - abs(dy)), r - abs(dy) + 1):
                px[mid + dx, top + r + dy] = c
    for dx, dy in ((-2, 9), (-3, 8), (-4, 8), (2, 9), (3, 8), (4, 8)):
        px[mid + dx, dy] = "G"
    px[mid, 13] = "r"; px[mid, 14] = "r"
    return px, w, h


def tail_ribbon():
    """A ribbon falling away on each side of a blue knot, three gold dots below."""
    w, h = 33, 15
    mid = w // 2
    px = {}
    for x in range(w):
        d = abs(x - mid)
        y = 4 + round(2 * math.sin(d / 3)) + d // 6
        if 2 < d < 16:
            px[x, y] = "r"; px[x, y + 1] = "r"
    for dx, dy in ((0, 3), (-1, 4), (1, 4), (0, 5), (-1, 2), (1, 2)):
        px[mid + dx, dy] = "b"
    for k in (-1, 0, 1):
        px[mid + 2 * k, 11] = "g"
    return px, w, h


# ---- tendrils, drolleries, bullets -----------------------------------------------------

def tendril(c, bud):
    """The flourish down the margin from the initial: a line swaying, a curl to each side with a
    bud. Period 24, so it repeats down."""
    w, h = 9, 24
    px = {}
    vine(px, [(4 + round(2 * math.sin(2 * math.pi * y / h)), y) for y in range(h)], c)
    for (x, y) in ((6, 5), (7, 4), (8, 4), (2, 17), (1, 16), (0, 16)):
        px[x, y] = c
    px[8, 3] = bud; px[7, 3] = bud; px[0, 15] = "g"; px[1, 15] = "y"
    return px, w, h


DROLLS = {
    "snail": rows("......kkkk......", ".....k.hh.k.....", "....k.h..h.k....", "....k.h.h..k....",
                  "k.k.k..hh.k.....", ".kgggkkkkkgggg..", "gggggggggggggggg"),
    "bird": rows(".....bb.....", "....bbkb....", "y..bbbbb....", ".ybbbbbbbb..", "...bbbbbbbbb",
                 "....bbbbb..b", ".....y.y....", "....y..y...."),
    "rabbit": rows("..h.h.......", "..h.h.......", ".hhhh.......", "hhkhh.......", ".hhhhhhhhh..",
                   "..hhhhhhhhhw", "..hhhhhhhhh.", "..h..h..h.h."),
    "fish": rows(".....bbbb.....", "...bbbbbbbb..b", ".bkbbrbbbbbbbb", "bbbbbbbbbbbbb.", ".bbbbrbbbbbbbb",
                 "...bbbbbbbb..b", ".....bbbb....."),
    "dragonet": rows(".........G.G....", "..GG....GGGG....", ".GkGG..GGGGGG...", "GGGGGGGGGGGGGG..",
                     "..r..GGGGGGGGGGG", ".r....GG..GG..GG", "......G...G....G"),
    "cat": rows("k.k.........", "kkk.........", "kgkk........", "kkkkkkkkk...", ".kkkkkkkkk.k",
                ".kkkkkkkkkk.", ".k.k...k.k.."),
}


def diamond(c):
    return {(1, 0): c, (0, 1): c, (1, 1): c, (2, 1): c, (1, 2): c}, 3, 3


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.svg"):  # designs dropped from here leave no stale file behind
        f.unlink()
    arts = {
        **{f"band-{n}": canvas(f(), None, 19) for n, f in (
            ("vine", band_vine), ("interlace", band_interlace), ("lozenges", band_lozenges),
            ("leaves", band_leaves), ("ribbon", band_ribbon))},
        **{f"fleuron-{n}": canvas(f(), 9, 11) for n, f in (
            ("quatrefoil", fleuron_quatrefoil), ("lily", fleuron_lily), ("rosette", fleuron_rosette),
            ("trefoil", fleuron_trefoil))},
        **{f"tail-{n}": canvas(f(), 33, 15) for n, f in (
            ("triangle", tail_triangle), ("drop", tail_drop), ("ribbon", tail_ribbon))},
        **{f"tendril-{c}": tendril(c, b) for c, b in (("r", "b"), ("b", "r"), ("G", "r"))},
        **{f"droll-{n}": canvas(a, 18, 12) for n, a in DROLLS.items()},
        "diamond-b": diamond("b"), "diamond-r": diamond("r"),
    }
    for name, art in arts.items():
        (OUT / f"{name}.svg").write_text(svg(*art))
    print(f"  {len(arts)} ornaments in assets/img/orn/")


if __name__ == "__main__":
    main()
