"""Pixel assets for the hours theme: _tools/icons.txt -> assets/img/icons/<name>.svg, the pixel
frame of the boxes (frame.svg, a 9-slice for border-image) and the menu's pointer (cursor.svg).

Same shading rule as shadeSprite in assets/js/hours.js: each material lit on its right side and,
dithered, on top; shaded on the left and underneath; a 1 px outline around the silhouette.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATS = {  # letter: (highlight, mid, shadow); a..z as in hours.js, plus s (stone), n (raven)
    'a': ('#e8ecf2', '#a9b1be', '#666e80'), 'r': ('#d04a3a', '#a02a2a', '#681826'),
    'w': ('#a8743e', '#7e5230', '#553620'), 'g': ('#f6d77a', '#d8a838', '#9a6a1e'),
    'h': ('#8a5a3a', '#6a4028', '#462a1a'), 'e': ('#ffffff', '#dcd8d0', '#a29e98'),
    'z': ('#6a90f0', '#3058c0', '#1e3478'), 's': ('#b8b0a8', '#8c8680', '#5e5a58'),
    'n': ('#5a5a80', '#363650', '#20202e'),
}
FLAT = {'k': '#16121c', 'R': '#ff5030', 'y': '#ffe070', 'c': '#fff6dc'}
OUTLINE = '#16121c'


def shade(rows):
    h0, w0 = len(rows), max(map(len, rows))
    at = lambda x, y: rows[y][x] if 0 <= y < h0 and 0 <= x < len(rows[y]) else '.'
    same = lambda q, c: q != '.' and q not in FLAT and q.lower() == c.lower()
    px = {}
    for y in range(-1, h0 + 1):
        for x in range(-1, w0 + 1):
            c = at(x, y)
            if c == '.':
                if any(at(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    px[x + 1, y + 1] = OUTLINE
            elif c in FLAT:
                px[x + 1, y + 1] = FLAT[c]
            else:
                hi, mid, sh = MATS[c.lower()]
                if c != c.lower():
                    v = sh
                elif not same(at(x + 1, y), c) or (at(x, y - 1) == '.' and (x + y) % 2 == 0):
                    v = hi
                elif not same(at(x - 1, y), c) or not same(at(x, y + 1), c):
                    v = sh
                else:
                    v = mid
                px[x + 1, y + 1] = v
    return px, w0 + 2, h0 + 2


def svg(px, w, h):
    rects = []  # horizontal runs of one colour
    for y in range(h):
        x = 0
        while x < w:
            c = px.get((x, y))
            n = 1
            while c and px.get((x + n, y)) == c:
                n += 1
            if c:
                rects.append(f'<rect x="{x}" y="{y}" width="{n}" height="1" fill="{c}"/>')
            x += n
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 2}" '
            f'height="{h * 2}" shape-rendering="crispEdges">{"".join(rects)}</svg>\n')


FRAME = """
.ooooooo.
ohhhhhhho
ohgggggso
ohgooogso
ohgo.ogso
ohgooogso
ohgggggso
ossssssso
.ooooooo.
"""
CURSOR = """
o....
oho..
ohgo.
ohggo
ohgo.
oho..
o....
"""
# the castle's pointers (cursor-*.svg, drawn at 2x; the hotspot is in styles.css): a gauntlet on what can be
# looked at, a key on a door, a magnifier on a thing with a picture inside, a quill over a card's text
CURSORS = {
    'hand': """
..oo.........
.omho........
.omho........
.omho........
.omhooo......
.omhomhoo....
.omhomhomoo..
oomhomhomhmo.
ohmmmmmmmmmo.
ohmmmmmmmmmo.
ohmmmmmmmmdo.
.ommmmmmmdo..
..odddddddo..
..odddddddo..
..ooooooooo..
""",
    'key': """
.ooo.....
ohggo....
ohgo.....
oggo.....
ohgooo...
oggggo...
ohgooo...
oggo.....
ohgo.....
oggo.....
.oggo....
ogoogo...
oho.ogo..
ogoogo...
.oooo....
""",
    'quill': """
..........oo
.........owo
........owfo
.......owfo.
......owfo..
.....owfo...
....owfo....
...owfo.....
..owfo......
..ofo.......
.odo........
.do.........
o...........
""",
    'loupe': """
..oooo......
.obbbbo.....
obwwbbbo....
obwbbbbo....
obbbbbbo....
obbbbbbo....
.obbbbo.....
..oooodo....
......oeeo..
.......oeeo.
........oeeo
.........oo.
""",
}
PIX = {'o': '#16121c', 'h': '#f6d77a', 'g': '#d8a838', 's': '#9a6a1e', 'm': '#b4b4c4', 'd': '#6a6a7c',
       'w': '#fbf6e6', 'f': '#d8d0bc', 'b': '#9ccce0', 'e': '#7a4a24'}


def pixels(art, k=1):
    """SVG of a small pixel drawing (one rect per pixel; '.' and ' ' are transparent), shown at k x."""
    rows = [r for r in art.strip('\n').split('\n')]
    w, h = max(map(len, rows)), len(rows)
    rects = ''.join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{PIX[c]}"/>'
                    for y, r in enumerate(rows) for x, c in enumerate(r) if c in PIX)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * k}" height="{h * k}" '
            f'shape-rendering="crispEdges">{rects}</svg>\n')


TINCTURES = {'O': '#e8b840', 'A': '#f0f0f0', 'G': '#c0302a', 'B': '#2f50b0', 'V': '#2f7a3a', 'S': '#1e1e26',
             'P': '#63003c', 'R': '#8a1538', 'N': '#1d2a57', 'C': '#2a6fd0'}


def blocks(text):
    """`== name` blocks of rows from an ASCII drawing file."""
    for block in re.split(r'^== ', text, flags=re.M)[1:]:
        lines = block.rstrip('\n').split('\n')
        yield lines[0].strip(), [r.rstrip() for r in lines[1:] if r.strip()]


def arms():
    """_tools/arms.txt -> one SVG per coat (flat tinctures, dark outline) and assets/js/arms.js
    (the same rows, for the canvas of hours.js)."""
    coats = dict(blocks((ROOT / '_tools/arms.txt').read_text()))
    out = ROOT / 'assets/img/arms'
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in coats.items():
        h0, w0 = len(rows), max(map(len, rows))
        at = lambda x, y, rows=rows, h0=h0: rows[y][x] if 0 <= y < h0 and 0 <= x < len(rows[y]) else '.'
        px = {}
        for y in range(-1, h0 + 1):
            for x in range(-1, w0 + 1):
                c = at(x, y)
                if c != '.':
                    px[x + 1, y + 1] = TINCTURES[c]
                elif any(at(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    px[x + 1, y + 1] = OUTLINE
        (out / f'{name}.svg').write_text(svg(px, w0 + 2, h0 + 2))
    js = ('/* Generated by _tools/icons.py from _tools/arms.txt: do not edit. */\n'
          f'window.ARMS = {json.dumps(coats, separators=(",", ":"))};\n')
    (ROOT / 'assets/js/arms.js').write_text(js)
    print(f'  arms: {len(coats)} coats, arms.js')


def main():
    text = (ROOT / '_tools/icons.txt').read_text()
    out = ROOT / 'assets/img/icons'
    out.mkdir(parents=True, exist_ok=True)
    for block in re.split(r'^== ', text, flags=re.M)[1:]:
        lines = block.rstrip('\n').split('\n')
        rows = [r.rstrip() for r in lines[1:] if r.strip()]
        (out / f'{lines[0].strip()}.svg').write_text(svg(*shade(rows)))
        print(f'  icons/{lines[0].strip()}.svg')
    arms()
    for name, art in (('frame', FRAME), ('cursor', CURSOR)):  # 9-slice box border, menu pointer
        (ROOT / f'assets/img/{name}.svg').write_text(pixels(art))
        print(f'  {name}.svg')
    for name, art in CURSORS.items():
        (ROOT / f'assets/img/cursor-{name}.svg').write_text(pixels(art, 2))
        print(f'  cursor-{name}.svg')


if __name__ == '__main__':
    main()
