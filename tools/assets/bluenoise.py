"""A 64 x 64 tile of blue noise (Ulichney's void-and-cluster, 1993) for the castle's dithers:
castle/js/hours/bluenoise.js, its 4096 thresholds (0..255) in base64.

Blue noise has no low frequencies: thresholded at any level it gives evenly spread dots with no
grid (a Bayer matrix's cross-hatch) and no clumps (white noise's). The tile wraps (a toroidal
Gaussian energy), so it repeats without seams.

  uv run --no-project --with numpy python tools/assets/bluenoise.py
"""
import base64
from pathlib import Path

import numpy as np

N = 64
SIGMA = 1.5  # (Ulichney's; wider blurs the dots together, narrower lets white noise back in)
OUT = Path(__file__).resolve().parents[2] / "public" / "castle" / "js" / "hours" / "bluenoise.js"


def void_and_cluster(n=N, sigma=SIGMA, seed=1888):
    rng = np.random.default_rng(seed)
    d = np.minimum(np.arange(n), n - np.arange(n))
    kernel = np.fft.fft2(np.exp(-(d[:, None] ** 2 + d[None, :] ** 2) / (2 * sigma**2)))
    energy = lambda m: np.real(np.fft.ifft2(np.fft.fft2(m) * kernel))  # noqa: E731
    tightest = lambda m: int(np.argmax(np.where(m, energy(m), -np.inf)))  # noqa: E731
    largest_void = lambda m: int(np.argmin(np.where(m, np.inf, energy(m))))  # noqa: E731
    # the initial pattern: a tenth of the cells, then swapped (tightest cluster -> largest void) until stable
    m = np.zeros(n * n, bool)
    m[rng.choice(n * n, n * n // 10, replace=False)] = True
    m = m.reshape(n, n)
    while True:
        c = tightest(m)
        m.flat[c] = False
        v = largest_void(m)
        m.flat[v] = True
        if v == c:
            break
    ones = int(m.sum())
    rank = np.zeros(n * n, int)
    mm = m.copy()
    for r in range(ones - 1, -1, -1):  # phase 1: the pattern's own dots, tightest first, ranked down
        c = tightest(mm)
        mm.flat[c] = False
        rank[c] = r
    mm = m.copy()
    for r in range(ones, n * n):  # phases 2 and 3: the voids filled, largest first, ranked up
        v = largest_void(mm)
        mm.flat[v] = True
        rank[v] = r
    return (rank * 256 // (n * n)).astype(np.uint8)


def main():
    t = void_and_cluster()
    assert np.bincount(t, minlength=256).min() == N * N // 256  # (every level as often: a flat histogram)
    b64 = base64.b64encode(t.tobytes()).decode()
    OUT.write_text(
        "/* A 64 x 64 tile of blue noise, thresholds 0..255 (void-and-cluster, tools/assets/bluenoise.py, generated):\n"
        "   the castle's dissolves and the graphics card's dithers draw from it (no grid, no clumps). */\n"
        f"window.HOURS_BLUE = Uint8Array.from(atob('{b64}'), (c) => c.charCodeAt(0));\n")
    print(f"  {OUT.relative_to(OUT.parents[3])} ({len(b64)} chars)")


if __name__ == "__main__":
    main()
