"""Pen-work ornaments for the castle's texts: flat ink colours (lapis, vermilion, gold, green) on
the vellum, no outline, one SVG pixel per image pixel (shown at the UI pixel, --upx).

  python3 _tools/ornaments.py        -> assets/img/orn/{band,fleuron,tail,tendril,diamond-*}.svg

band:     the vine scroll under a title, a tile that repeats across (period 24)
fleuron:  a quatrefoil either side of a title
tail:     the cul-de-lampe closing a text
tendril:  the flourish trailing from the initial down the margin, a tile that repeats down
diamond:  the list bullets, blue and red in turn
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img" / "orn"
INK = {"b": "#2a4caa", "r": "#b03020", "g": "#b8862a", "G": "#3f7238", "y": "#e0b850"}


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


def vine(px, pts, c="G"):
    """Join successive points with unbroken 1 px runs (no gaps where the line is steep)."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            px[x0, y] = c
        px[x1, y1] = c


def band():
    """A rinceau: an unbroken vine; a red leaf on a stem above each crest, a blue one below each
    trough; small green curls and gold buds between them. Period 32, so the tile repeats."""
    w, h = 32, 19
    px = {}
    yv = lambda x: 9 + round(3.5 * math.sin(2 * math.pi * x / w))
    vine(px, [(x, yv(x)) for x in range(w)])
    for cx, up, c in ((24, True, "r"), (8, False, "b")):  # y grows down: the crest is at 24  # leaves on their stems
        y = yv(cx); d = -1 if up else 1
        px[cx, y + d] = "G"
        for dx, dy in ((0, 2), (-1, 2), (1, 2), (0, 3), (-1, 3), (1, 3), (0, 4), (-2, 2), (2, 2)):
            px[cx + dx, y + d * dy] = c
    for cx, up in ((3, True), (13, False), (19, False), (29, True)):  # curls springing off the vine
        y = yv(cx); d = -1 if up else 1
        for dx, dy in ((0, 1), (1, 2), (1, 3), (0, 3), (-1, 2)):
            px[cx + dx, y + d * dy] = "G"
    for x, up in ((0, True), (16, False)):  # gold buds where the vine crosses the middle
        y = yv(x); d = -1 if up else 1
        px[x % w, y + d] = "g"; px[x % w, y + 2 * d] = "y"
    return px, w, h


def fleuron():
    rows = ["....g....", "...grg...", "..g.r.g..", ".bb.g.bb.", "bbbgggbbb", ".bb.g.bb.",
            "..g.r.g..", "...grg...", "....g...."]
    return {(x, y): c for y, r in enumerate(rows) for x, c in enumerate(r) if c != "."}, 9, 9


def tail():
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
        for x in (mid - half, mid + half):
            px[x, y] = "G"
        if y % 2 == 0:
            px[mid - half + 1, y] = "g"
            px[mid + half - 1, y] = "g"
    for dy, c in ((12, "r"), (13, "r"), (14, "r")):
        px[mid, dy] = c
    px[mid - 1, 13] = "r"
    px[mid + 1, 13] = "r"
    return px, w, h


def tendril():
    """The flourish down the margin from the initial: an unbroken red line swaying, a curl
    to each side with a bud (blue, then gold). Period 24, so it repeats down."""
    w, h = 9, 24
    px = {}
    vine(px, [(4 + round(2 * math.sin(2 * math.pi * y / h)), y) for y in range(h)], "r")
    for (x, y) in ((6, 5), (7, 4), (8, 4)):
        px[x, y] = "r"
    px[8, 3] = "b"; px[7, 3] = "b"
    for (x, y) in ((2, 17), (1, 16), (0, 16)):
        px[x, y] = "r"
    px[0, 15] = "g"; px[1, 15] = "y"
    return px, w, h


def diamond(c):
    return {(1, 0): c, (0, 1): c, (1, 1): c, (2, 1): c, (1, 2): c}, 3, 3


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, art in (("band", band()), ("fleuron", fleuron()), ("tail", tail()), ("tendril", tendril()), ("diamond-b", diamond("b")), ("diamond-r", diamond("r"))):
        (OUT / f"{name}.svg").write_text(svg(*art))
        print(f"  assets/img/orn/{name}.svg")


if __name__ == "__main__":
    main()
