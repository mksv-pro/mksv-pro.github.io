"""Vermis-style halftone of the project illuminations, for the hours theme.

assets/img/illum-<p>.png -> assets/img/trame-<p>.png (160 px): an amplitude-modulated screen at
45 deg (dark ink dots, area proportional to darkness) over a paper tinted by a duotone map, deep
green in the shadows to ochre in the lights (palette sampled from the Vermis I cover).
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SIZE, CELL = 160, 5.0  # output px, screen period in px
INK = np.array([0x16, 0x1c, 0x17], float)
PAPER = [(0.0, (0x1e, 0x4d, 0x2c)), (0.45, (0x3f, 0x65, 0x34)), (0.75, (0x6e, 0x79, 0x38)), (1.0, (0xc8, 0xa0, 0x3a))]


def paper(lum):
    xs = [p for p, _ in PAPER]
    return np.stack([np.interp(lum, xs, [c[i] for _, c in PAPER]) for i in range(3)], -1)


def trame(src, dst):
    # thin bright strokes would vanish under the screen: thicken them first
    im = Image.open(src).convert('RGB').filter(ImageFilter.MaxFilter(3)).resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(im, float) / 255
    lum = a @ [0.2126, 0.7152, 0.0722]
    lum = ((lum - lum.min()) / (np.ptp(lum) + 1e-9)) ** 0.55  # lift the mid-tones
    y, x = np.mgrid[0:SIZE, 0:SIZE] + 0.5
    u, v = (x + y) / np.sqrt(2) / CELL, (x - y) / np.sqrt(2) / CELL  # the screen, turned 45 deg
    d = np.hypot(u - np.round(u), v - np.round(v))  # distance to the nearest dot centre, in cells
    r = np.sqrt((1 - lum) / np.pi) * 1.05  # dot radius: inked area = darkness
    out = np.where((d < r)[..., None], INK, paper(lum))
    Image.fromarray(out.astype(np.uint8)).save(dst, optimize=True)
    print(f'  {dst.relative_to(ROOT)}')


if __name__ == '__main__':
    for p in ('nuclear', 'dla', 'nbody'):
        trame(ROOT / f'assets/img/illum-{p}.png', ROOT / f'assets/img/trame-{p}.png')
