"""Pixel-art 'illuminations' for the project cards: each emblem is drawn from the
physics of its project, set on a pigment ground inside a gilded manuscript frame.

Output: assets/img/illum-<name>.png, SIZE x SIZE, shown at an integer scale with
image-rendering: pixelated.
"""
import numpy as np
from PIL import Image

SIZE = 80          # full tile, frame included
INNER = 64         # emblem field
OFF = (SIZE - INNER) // 2

# Medieval pigments: gold leaf, its shadow, vermilion, ultramarine, verdigris, parchment, ink.
GOLD, GOLD_D = (217, 164, 65), (138, 100, 32)
VERM, ULTRA, VERD = (184, 64, 42), (47, 79, 143), (63, 110, 72)
PARCH, INK = (239, 228, 200), (42, 29, 16)


def frame(img, ground):
    """Gilded border: ink rule, gold band studded with ink dots, ink rule, vermilion fillet;
    quatrefoil-ish gold corner blocks with a vermilion heart."""
    a = img
    a[:, :] = INK
    a[1:-1, 1:-1] = GOLD
    a[4:-4, 4:-4] = INK
    a[5:-5, 5:-5] = VERM
    a[6:-6, 6:-6] = ground
    for i in range(6, SIZE - 6, 4):     # dotted band
        for (y, x) in ((2, i), (SIZE - 3, i), (i, 2), (i, SIZE - 3)):
            a[y, x] = GOLD_D
    for cy, cx in ((0, 0), (0, SIZE - 9), (SIZE - 9, 0), (SIZE - 9, SIZE - 9)):
        a[cy:cy + 9, cx:cx + 9] = INK
        a[cy + 1:cy + 8, cx + 1:cx + 8] = GOLD
        a[cy + 3:cy + 6, cx + 3:cx + 6] = VERM
        a[cy + 4, cx + 4] = GOLD
        for (dy, dx) in ((1, 4), (7, 4), (4, 1), (4, 7)):
            a[cy + dy, cx + dx] = GOLD_D
    return a


def paint(img, mask, colour):
    field = img[OFF:OFF + INNER, OFF:OFF + INNER]
    field[mask] = colour


def scattering():
    """Plane wave from the left, outgoing spherical wave from the nucleus: Re[e^{ikx} + f e^{ikr}/sqrt(r)]."""
    img = frame(np.zeros((SIZE, SIZE, 3), np.uint8), ULTRA)
    y, x = np.mgrid[0:INNER, 0:INNER].astype(float)
    cx, cy = INNER * 0.42, INNER / 2
    r = np.hypot(x - cx, y - cy) + 1e-9
    k = 2 * np.pi / 7.0
    incoming = np.cos(k * x) * np.where(x < cx, 1.0, 0.35)   # shadowed behind the target
    outgoing = 2.4 * np.cos(k * r) / np.sqrt(r)
    u = incoming + outgoing
    paint(img, u > 0.75, GOLD)
    paint(img, (u > 0.35) & (u <= 0.75), GOLD_D)
    paint(img, r < 5.5, INK)
    paint(img, r < 4.5, VERM)
    paint(img, r < 2.0, GOLD)
    return img


def dla(n=900, seed=3):
    """Diffusion-limited aggregation on a square lattice from a central seed."""
    rng = np.random.default_rng(seed)
    grid = np.zeros((INNER, INNER), bool)
    c = INNER // 2
    grid[c, c] = True
    rmax = 1
    steps = np.array([(0, 1), (0, -1), (1, 0), (-1, 0)])
    stuck = 0
    while stuck < n and rmax < c - 3:
        t = rng.uniform(0, 2 * np.pi)
        y, x = int(c + (rmax + 3) * np.sin(t)), int(c + (rmax + 3) * np.cos(t))
        while True:
            dy, dx = steps[rng.integers(4)]
            y, x = y + dy, x + dx
            if (y - c) ** 2 + (x - c) ** 2 > (rmax + 8) ** 2 or not (1 <= y < INNER - 1 and 1 <= x < INNER - 1):
                break  # wandered off: relaunch
            if grid[y - 1:y + 2, x - 1:x + 2].any():
                grid[y, x] = True
                stuck += 1
                rmax = max(rmax, int(np.hypot(y - c, x - c)) + 1)
                break
    img = frame(np.zeros((SIZE, SIZE, 3), np.uint8), VERD)
    yy, xx = np.mgrid[0:INNER, 0:INNER]
    rr = np.hypot(yy - c, xx - c)
    paint(img, grid, GOLD)
    paint(img, grid & (rr < rmax * 0.35), PARCH)   # the old core, bleached
    paint(img, rr < 1.5, VERM)
    return img


def figure_eight(steps=4000):
    """Chenciner-Montgomery choreography: three equal masses chasing one figure-eight (G = m = 1)."""
    x = np.array([[0.97000436, -0.24308753], [-0.97000436, 0.24308753], [0.0, 0.0]])
    v3 = np.array([-0.93240737, -0.86473146])
    v = np.array([-v3 / 2, -v3 / 2, v3])
    T = 6.32591398
    dt = T / steps

    def acc(p):
        a = np.zeros_like(p)
        for i in range(3):
            for j in range(3):
                if i != j:
                    d = p[j] - p[i]
                    a[i] += d / np.linalg.norm(d) ** 3
        return a

    trail = []
    a = acc(x)
    for _ in range(steps):                 # velocity Verlet
        v += 0.5 * dt * a
        x += dt * v
        a = acc(x)
        v += 0.5 * dt * a
        trail.append(x[0].copy())
    trail = np.array(trail)

    img = frame(np.zeros((SIZE, SIZE, 3), np.uint8), ULTRA)
    field = img[OFF:OFF + INNER, OFF:OFF + INNER]
    to_px = lambda p: (int(round(INNER / 2 - p[1] * 24)), int(round(INNER / 2 + p[0] * 29)))
    rng = np.random.default_rng(7)
    for _ in range(40):                    # a sprinkling of fixed stars
        sy, sx = rng.integers(0, INNER, 2)
        field[sy, sx] = GOLD_D
    for p in trail:
        py, px = to_px(p)
        field[py, px] = GOLD
    for body in x:                         # the three bodies at the end of the period
        py, px = to_px(body)
        field[py - 2:py + 3, px - 1:px + 2] = INK
        field[py - 1:py + 2, px - 2:px + 3] = INK
        field[py - 1:py + 2, px - 1:px + 2] = VERM
        field[py, px] = PARCH
    return img


def build(out):
    for name, fn in (("nuclear", scattering), ("dla", dla), ("nbody", figure_eight)):
        Image.fromarray(fn(), "RGB").save(out / f"illum-{name}.png", optimize=True)
        print("illumination:", name)
