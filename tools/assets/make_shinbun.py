"""The newspaper page's pictures (shinbun/), computed: each is the physics of the work it heads.
(The top one, the condensate, is computed in the page itself.)

  uv run python site/tools/assets/make_shinbun.py [nucleus] [dla] [galaxies]     (from EnvS/; all by default)

- nucleus: a halo nucleus, 11Be (a 10Be core and one neutron far out in a diffuse cloud), sent at a
  208Pb target: nucleons as shaded balls packed at random (protons red, neutrons white), the halo as
  a stipple of density exp(-2r/a), the projectile's path bending in the target's Coulomb field.
- dla: diffusion-limited aggregation on a square lattice, walkers launched on a circle and moved by
  jumps of the free distance while far from the cluster (walk-on-circles); the newest tenth in red.
- galaxies: two disk galaxies passing each other on a parabolic orbit, as Toomre & Toomre (1972):
  two softened point masses, each with a disk of test stars on circular orbits; the tidal tails and
  the bridge they draw after pericentre. One galaxy's stars white, the other's red.
Drawn at 3x and reduced. Seeded: the same pictures on every run.
"""
import numpy as np
from PIL import Image, ImageDraw

import real

IMG = real.PUBLIC / "shinbun" / "img"
PAPER, RED, BLACK = (232, 226, 214), (227, 36, 27), (11, 11, 11)


# ---- a halo nucleus on a heavy target -----------------------------------------------------------

def packed(n, rng, d=1.0):
    """n points in a ball, no two closer than d (random sequential packing, the ball grown as needed)."""
    R = 0.62 * d * n ** (1 / 3)
    pts = []
    while len(pts) < n:
        p = rng.uniform(-R, R, 3)
        if p @ p <= R * R and all(np.sum((p - q) ** 2) >= d * d for q in pts):
            pts.append(p)
        R *= 1.0004
    return np.array(pts)


def ball(dr, cx, cy, r, col, ss):
    """A shaded ball: concentric discs lightening towards a highlight up and to the left."""
    for k in range(12, 0, -1):
        f = k / 12
        shade = tuple(int(c * (0.35 + 0.65 * (1 - f) ** 0.6) + 255 * 0.25 * (1 - f) ** 3) for c in col)
        off = (1 - f) * r * 0.35
        dr.ellipse([cx - off - f * r, cy - off - f * r, cx - off + f * r, cy - off + f * r], fill=tuple(min(255, s) for s in shade))
    dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=BLACK, width=max(1, ss // 2))


def nucleus(seed=5):
    rng = np.random.default_rng(seed)
    W, H, ss = 420, 280, 3
    img = Image.new("RGB", (W * ss, H * ss), BLACK)
    dr = ImageDraw.Draw(img)
    u = 11.5 * ss  # px per fm-ish unit (nucleon spacing 1)
    # the projectile's path: in from the left, bending away from the target (Coulomb), dashed
    tx, ty = 305 * ss, 165 * ss
    path = [(tx + u * x, ty - u * (7.5 + 0.01 * (x + 2) ** 2)) for x in np.linspace(-27, 10, 140)]
    for i in range(0, len(path) - 1, 3):
        dr.line([path[i], path[i + 1]], fill=(120, 116, 108), width=ss)
    # the target, 208Pb: 82 protons, 126 neutrons, back to front
    tgt = packed(208, rng)
    kind = rng.permutation([1] * 82 + [0] * 126)
    for p, k in sorted(zip(tgt, kind), key=lambda pk: pk[0][2]):
        ball(dr, tx + p[0] * u, ty - p[1] * u, 0.56 * u, RED if k else PAPER, ss)
    # the projectile, 11Be: the halo's stipple, a compact 10Be core (4 p, 6 n), the halo neutron
    px, py = path[46]
    for _ in range(1600):
        r = rng.exponential(2.2)
        t = rng.uniform(0, 2 * np.pi)
        x, y = px + r * u * np.cos(t), py + r * u * np.sin(t)
        dr.ellipse([x - ss * .6, y - ss * .6, x + ss * .6, y + ss * .6], fill=(95, 92, 86))
    core = packed(10, rng)
    ck = rng.permutation([1] * 4 + [0] * 6)
    for p, k in sorted(zip(core, ck), key=lambda pk: pk[0][2]):
        ball(dr, px + p[0] * u, py - p[1] * u, 0.56 * u, RED if k else PAPER, ss)
    ball(dr, px + 3.4 * u, py + 2.6 * u, 0.56 * u, PAPER, ss)
    img.resize((W, H), Image.LANCZOS).save(IMG / "nucleus.png", optimize=True)


# ---- diffusion-limited aggregation ---------------------------------------------------------------

def dla(n=9000, L=421, seed=7):
    rng = np.random.default_rng(seed)
    grid = np.zeros((L, L), bool)
    c = L // 2
    grid[c, c] = True
    order = np.zeros((L, L), np.int32)
    rmax = 1.0
    steps = np.array([(1, 0), (-1, 0), (0, 1), (0, -1)])
    for p in range(1, n):
        t = rng.uniform(0, 2 * np.pi)
        x, y = c + (rmax + 4) * np.cos(t), c + (rmax + 4) * np.sin(t)
        while True:
            r = np.hypot(x - c, y - c)
            if r > 2 * rmax + 40:  # wandered off: relaunch
                t = rng.uniform(0, 2 * np.pi)
                x, y = c + (rmax + 4) * np.cos(t), c + (rmax + 4) * np.sin(t)
                continue
            if r > rmax + 3:  # far: jump the free distance in a random direction
                t = rng.uniform(0, 2 * np.pi)
                x, y = x + (r - rmax - 2) * np.cos(t), y + (r - rmax - 2) * np.sin(t)
                continue
            i, j = int(round(x)), int(round(y))
            if grid[i - 1:i + 2, j - 1:j + 2].any() and (grid[i - 1, j] or grid[i + 1, j] or grid[i, j - 1] or grid[i, j + 1]):
                grid[i, j] = True
                order[i, j] = p
                rmax = max(rmax, np.hypot(i - c, j - c))
                break
            x, y = (i, j) + steps[rng.integers(4)]
        if rmax > L / 2 - 45:
            break
    n = order.max()
    img = np.zeros((L, L, 3), np.uint8)
    img[:] = BLACK
    img[grid] = PAPER
    img[order > 0.9 * n] = RED
    ii, jj = np.nonzero(grid)
    m = 12  # the cluster's box, square, with a margin
    h = max(ii.max() - ii.min(), jj.max() - jj.min()) // 2 + m
    ci, cj = (ii.max() + ii.min()) // 2, (jj.max() + jj.min()) // 2
    img = img[ci - h:ci + h, cj - h:cj + h]
    big = Image.fromarray(img).resize((2 * h * 2, 2 * h * 2), Image.NEAREST)
    big.save(IMG / "dla.png", optimize=True)
    return n


# ---- two galaxies passing ---------------------------------------------------------------------------

def galaxies(n=3000, soft=0.1, dt=0.003, seed=2):
    """Restricted N-body: the two centres move under each other's softened gravity (G = M = 1 each),
    the test stars under both. Disks of rings, r in [0.15, 1.3], prograde, in the orbital plane;
    the pair starts on a parabolic orbit with pericentre 2.4 and is drawn 5.5 time units after it."""
    rng = np.random.default_rng(seed)
    q = 2.4  # pericentre; start at separation 10 on the parabola, rP = 2q / (1 + cos f)
    f0 = -np.arccos(2 * q / 10 - 1)
    r0 = 2 * q / (1 + np.cos(f0))
    rel = r0 * np.array([np.cos(f0), np.sin(f0)])
    vmag = np.sqrt(2 * 2 / r0)  # parabolic, total mass 2
    vdir = np.array([-np.sin(f0), 1 + np.cos(f0)])
    vrel = vmag * vdir / np.linalg.norm(vdir)
    c = np.array([-rel / 2, rel / 2])
    cv = np.array([-vrel / 2, vrel / 2])
    stars, owner = [], []
    for g in range(2):
        r = np.sqrt(rng.uniform(0.15 ** 2, 1.3 ** 2, n))
        t = rng.uniform(0, 2 * np.pi, n)
        vc = r / (r * r + soft * soft) ** 0.75  # circular: v^2 = r |a| for a softened point mass
        pos = c[g] + np.stack([r * np.cos(t), r * np.sin(t)], 1)
        vel = cv[g] + np.stack([-vc * np.sin(t), vc * np.cos(t)], 1)  # counter-clockwise, as both orbit the centre of mass
        stars.append(np.hstack([pos, vel]))
        owner += [g] * n
    s = np.vstack(stars)
    owner = np.array(owner)

    def field(p, centres):
        a = np.zeros_like(p)
        for cc in centres:
            d = cc - p
            a += d / (np.sum(d * d, -1, keepdims=True) + soft * soft) ** 1.5
        return a

    tp = None
    t = 0.0
    while True:
        ac = np.array([field(c[0:1], c[1:2])[0], field(c[1:2], c[0:1])[0]])
        cv += ac * dt / 2
        s[:, 2:] += field(s[:, :2], c) * dt / 2
        c += cv * dt
        s[:, :2] += s[:, 2:] * dt
        ac = np.array([field(c[0:1], c[1:2])[0], field(c[1:2], c[0:1])[0]])
        cv += ac * dt / 2
        s[:, 2:] += field(s[:, :2], c) * dt / 2
        t += dt
        sep = np.linalg.norm(c[1] - c[0])
        if tp is None and sep < q * 1.02:
            tp = t
        if tp is not None and t > tp + 5.5:
            break
    W, H, ss = 420, 280, 3
    img = Image.new("RGB", (W * ss, H * ss), BLACK)
    dr = ImageDraw.Draw(img)
    d = c[1] - c[0]  # turn the pair's axis to lie nearly flat, then frame the stars
    a = -np.arctan2(d[1], d[0]) + 0.35
    rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
    s[:, :2], c = s[:, :2] @ rot.T, c @ rot.T
    lo, hi = np.percentile(s[:, :2], 1, 0), np.percentile(s[:, :2], 99, 0)
    mid = (lo + hi) / 2
    scale = 0.9 * min(W / (hi[0] - lo[0]), H / (hi[1] - lo[1]))
    for (x, y), g in zip(s[:, :2], owner):
        X, Y = (W / 2 + (x - mid[0]) * scale) * ss, (H / 2 - (y - mid[1]) * scale) * ss
        if 0 < X < W * ss and 0 < Y < H * ss:
            dr.ellipse([X - .9 * ss, Y - .9 * ss, X + .9 * ss, Y + .9 * ss], fill=RED if g else PAPER)
    for (x, y) in c:
        X, Y = (W / 2 + (x - mid[0]) * scale) * ss, (H / 2 - (y - mid[1]) * scale) * ss
        dr.ellipse([X - 3 * ss, Y - 3 * ss, X + 3 * ss, Y + 3 * ss], fill=PAPER)
    img.resize((W, H), Image.LANCZOS).save(IMG / "galaxies.png", optimize=True)


def main(which=("nucleus", "dla", "galaxies")):
    """`which`: the pictures to make (the DLA takes about four minutes)."""
    IMG.mkdir(parents=True, exist_ok=True)
    if "nucleus" in which:
        nucleus()
        print("  nucleus.png")
    if "dla" in which:
        print(f"  dla.png ({dla()} particles)")
    if "galaxies" in which:
        galaxies()
        print("  galaxies.png")


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or ("nucleus", "dla", "galaxies"))
