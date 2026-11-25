"""The front gate's pictures (home/home.js), drawn here once as dot bitmaps: each character cell of
the gate's grid holds 2 x 4 dots, as a braille cell does, so a picture is (2 cols) x (4 rows) dots.

  castle   a castle like the site's (round towers, conical roofs, a keep and its belfry, on a rock): only
           where the landscape itself is not there to be read (gate.js draws the live one in dots)
  about    the plain page drawn as a sheet: the name and the sought block beside sections of entries
  terminal no bitmap: a few real commands and their answers, text from site.toml

Shading is Atkinson-dithered (as the engraving of the terminal theme); outlines are drawn solid.
Writes home/art.js. Run from EnvS/: uv run python site/tools/assets/gate_art.py
"""
import base64
import json
import tomllib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"  # (what is served)
SS = 8  # supersampling of the vector drawing


def atkinson(a):
    """a: float array 0..1 (1 = dot); returns a bool array."""
    a = a.astype(float).copy(); h, w = a.shape; out = np.zeros_like(a, bool)
    for y in range(h):
        for x in range(w):
            o = a[y, x] >= 0.5; out[y, x] = o; e = (a[y, x] - o) / 8
            for dx, dy in ((1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
                if 0 <= x + dx < w and y + dy < h:
                    a[y + dy, x + dx] += e
    return out


class Pen:
    """Shading drawn supersampled then dithered; outlines drawn at dot resolution, one dot wide and
    solid, so they never blur or dither away."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.shade = Image.new("L", (w * SS, h * SS), 0); self.ink = Image.new("1", (w, h), 0); self.clear = Image.new("1", (w, h), 0)
        self.ds, self.di, self.dc = ImageDraw.Draw(self.shade), ImageDraw.Draw(self.ink), ImageDraw.Draw(self.clear)

    def poly(self, pts, v, outline=True):
        self.ds.polygon([(x * SS, y * SS) for x, y in pts], fill=int(v * 255))
        if outline: # (an opaque shape: what it covers, drawn before, is hidden)
            q = [(round(x), round(y)) for x, y in pts]; self.di.polygon(q, fill=0); self.dc.polygon(q, fill=0); self.di.line(q + [q[0]], fill=1)

    def rect(self, x0, y0, x1, y1, v, outline=True):
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], v, outline)

    def hole(self, x0, y0, x1, y1, arch=True): # a window or a door: a dark opening ringed by a line
        x0, y0, x1, y1 = round(x0), round(y0), round(x1), round(y1); r = (x1 - x0) / 2
        if x1 - x0 < 2 or y1 - y0 < 3: # (too small to ring: a dark dot)
            self.dc.point([(x0, y0)], fill=1); return
        self.ds.rectangle([x0 * SS, y0 * SS, (x1 + 1) * SS, (y1 + 1) * SS], fill=0)
        self.dc.rectangle([x0 + 1, y0 + (2 if arch else 1), x1 - 1, y1 - 1], fill=1)
        self.di.line([(x0, y1), (x0, y0 + (1 if arch else 0)), (x1, y0 + (1 if arch else 0)), (x1, y1)], fill=1)
        if arch and r >= 1:
            self.di.point([(x0 + 1, y0), (x1 - 1, y0)] if r >= 1.5 else [], fill=1); self.di.line([(x0 + 1, y0 - 1), (x1 - 1, y0 - 1)], fill=1)

    def line(self, pts, width=1):
        q = [(round(x), round(y)) for x, y in pts]; self.di.line(q, fill=1); self.dc.line(q, fill=0)

    def bits(self):
        s = np.asarray(self.shade.resize((self.w, self.h), Image.BOX), float) / 255
        return (atkinson(s) | np.asarray(self.ink, bool)) & ~np.asarray(self.clear, bool)


def castle(p, ox, oy, k=1.0):
    """The castle in a box about 112 x 96 dots at k = 1, its foot at (ox, oy + 96 k)."""
    X = lambda x: ox + x * k; Y = lambda y: oy + y * k

    def tower(cx, w, top, bot, rh, v):
        p.rect(X(cx - w / 2), Y(top), X(cx + w / 2), Y(bot), v)
        p.rect(X(cx - w / 2), Y(top), X(cx - w / 2 + w * 0.3), Y(bot), min(1, v + 0.2), outline=False) # (the lit side: round)
        p.poly([(X(cx - w / 2 - 2), Y(top)), (X(cx + w / 2 + 2), Y(top)), (X(cx), Y(top - rh))], 0.55)
        p.line([(X(cx), Y(top - rh)), (X(cx), Y(top - rh - 7))]); p.line([(X(cx), Y(top - rh - 7)), (X(cx + 5), Y(top - rh - 5.5)), (X(cx), Y(top - rh - 4))])
        for y in range(int(top + 8), int(bot - 10), 16):
            p.hole(X(cx - 1.5), Y(y), X(cx + 1.5), Y(y + 6))

    def crenels(x0, x1, y, v):
        x = x0
        while x + 4 <= x1:
            p.rect(X(x), Y(y - 3), X(x + 2.5), Y(y), v); x += 4.5

    p.poly([(X(4), Y(96)), (X(12), Y(86)), (X(28), Y(83)), (X(50), Y(85)), (X(66), Y(82)), (X(86), Y(85)), (X(100), Y(84)), (X(108), Y(96))], 0.18) # the rock
    p.rect(X(20), Y(62), X(92), Y(85), 0.22); crenels(20, 92, 62, 0.22) # the curtain wall
    p.hole(X(50), Y(72), X(62), Y(85)) # the gate, its portcullis half down
    for x in (53, 56, 59):
        p.line([(X(x), Y(72)), (X(x), Y(79))])
    p.line([(X(51), Y(75)), (X(61), Y(75))]); p.line([(X(51), Y(78)), (X(61), Y(78))])
    p.rect(X(40), Y(30), X(72), Y(62), 0.28); crenels(39, 73, 30, 0.28) # the keep
    for x in (45, 54.5, 64):
        p.hole(X(x), Y(39), X(x + 4), Y(48))
    tower(56, 10, 20, 30, 15, 0.3) # its belfry
    tower(20, 14, 42, 86, 24, 0.3); tower(92, 14, 42, 86, 24, 0.3)
    tower(36, 9, 52, 63, 14, 0.25); tower(76, 9, 52, 63, 14, 0.25)


def draw_castle():
    p = Pen(116, 108); castle(p, 2, 10); return p.bits()


def draw_about():
    """A sheet of the plain page: the bar (name, links), the diffuse banner with the name and the logos,
    paragraphs, then headed lists, then the footer band."""
    w, h = 96, 84; b = np.zeros((h, w), bool); rng = np.random.default_rng(7)
    b[0, :] = b[-1, :] = b[:, 0] = b[:, -1] = True
    b[3, 4:20] = True; b[3, 56:92:2] = True; b[6, 1:95] = True  # the bar
    yy, xx = np.mgrid[7:27, 1:95]  # the banner: diffuse colour (two soft swells, dithered), the name, role and logos cut out
    glow = 0.25 + 0.5 * np.exp(-((xx - 18) ** 2 / 500 + (yy - 9) ** 2 / 60)) + 0.4 * np.exp(-((xx - 82) ** 2 / 400 + (yy - 25) ** 2 / 60))
    b[7:27, 1:95] = rng.random(glow.shape) < glow
    b[11:15, 30:66] = False; b[16:18, 36:60] = False
    for x0 in range(22, 74, 11):
        b[21:23, x0:x0 + 8] = False
    y = 28
    for n in (3, 4):  # the opening paragraphs
        for k in range(n):
            b[y, 20:76 if k < n - 1 else 20 + int(rng.integers(20, 50))] = True; y += 2
        y += 1
    while y < h - 12:  # headed lists
        b[y:y + 2, 20:34] = True; y += 4
        for _ in range(int(rng.integers(2, 4))):
            if y > h - 12:
                break
            b[y, 21] = True; b[y, 24:76] = True; b[y + 2, 24:24 + int(rng.integers(20, 50))] = True; y += 4
        y += 1
    b[h - 9:h - 1, 1:95] = True; b[h - 7, 20:44] = False; b[h - 4, 20:36] = False  # the footer band
    return b


def pack(b):
    h, w = b.shape
    return {"w": w, "h": h, "bits": base64.b64encode(np.packbits(b.ravel()).tobytes()).decode()}


def terminal_lines():
    t = tomllib.loads((ROOT / "src/site.toml").read_text())
    p = t["site"]; rooms = [r["label"] for r in t["world"]["rooms"].values()]
    pub = t["publications"][0]["title"]
    return [["$ ", "whoami"], ["", f"{p['name']} · {p['role'].lower()} · {p['place']}"], ["$ ", "ls"], ["", "rooms: " + "  ".join(rooms[:4]) + "  …"],
            ["$ ", "cat publications"], ["", f"{pub} (2026)"], ["$ ", ""]]


def main():
    art = {
        "castle": {**pack(draw_castle()), "mode": "grow", "seed": "foot"},
        "about": {**pack(draw_about()), "mode": "scan"},
    }
    art["terminal"] = {"mode": "type", "lines": terminal_lines()}
    out = PUBLIC / "home/art.js"
    out.write_text("// generated by tools/assets/gate_art.py: the front gate's pictures (2 x 4 dots a character cell)\n"
                   f"window.GATE_ART = {json.dumps(art, ensure_ascii=False, separators=(',', ':'))};\n")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
