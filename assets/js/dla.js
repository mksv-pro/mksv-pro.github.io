'use strict';

// Diffusion-limited aggregation (Witten & Sander, PRL 47, 1400, 1981) on a square lattice,
// with the mass-radius estimate of the fractal dimension. Drawn by window.Demo (script.js).
(() => {
  const fig = document.querySelector('[data-demo="dla"]');
  if (!fig || !window.Demo) return;
  const canvas = fig.querySelector('canvas');
  const W = canvas.width;
  const C = (W - 1) / 2; // seed at the centre; W odd
  const STEPS_PER_FRAME = 60000;

  const sim = {
    mask: new Uint8Array(W * W),
    done: false,
    n: 0,
    rmax: 0,
    radii: [], // distance of each stuck particle to the seed
    reset() {
      this.mask.fill(0);
      this.mask[C * W + C] = 1;
      this.n = 1;
      this.rmax = 0;
      this.radii = [0];
      this.done = false;
    },
    frame() {
      for (let budget = STEPS_PER_FRAME; budget > 0 && !this.done;) budget -= this.walk();
      return !this.done;
    },
    /** One walker, from launch to sticking; returns the steps it used. Outside the launch circle
     *  it jumps to a uniform point of a circle that cannot reach the cluster, where Brownian
     *  motion would first cross it (exact up to lattice rounding). Indexing is safe: neighbours
     *  are read only within rmax + 6 <= C - 2 of the seed. */
    walk() {
      const launch = this.rmax + 4;
      const kill = 2 * this.rmax + 20;
      let a = Math.random() * 2 * Math.PI;
      let x = Math.round(C + launch * Math.cos(a));
      let y = Math.round(C + launch * Math.sin(a));
      const m = this.mask;
      for (let steps = 1; ; steps += 1) {
        const dx = x - C; const dy = y - C;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > kill) { // lost: release a new walker
          a = Math.random() * 2 * Math.PI;
          x = Math.round(C + launch * Math.cos(a));
          y = Math.round(C + launch * Math.sin(a));
          continue;
        }
        if (r > launch + 2) {
          const jump = r - launch;
          a = Math.random() * 2 * Math.PI;
          x = Math.round(x + jump * Math.cos(a));
          y = Math.round(y + jump * Math.sin(a));
          continue;
        }
        const i = y * W + x;
        if (m[i - 1] || m[i + 1] || m[i - W] || m[i + W]) {
          m[i] = 1;
          this.n += 1;
          this.radii.push(r);
          if (r > this.rmax) this.rmax = r;
          if (this.rmax > C - 8) this.done = true;
          return steps;
        }
        switch ((Math.random() * 4) | 0) {
          case 0: x += 1; break;
          case 1: x -= 1; break;
          case 2: y += 1; break;
          default: y -= 1;
        }
        if (steps > 1e6) return steps; // never reached in practice; keeps a frame bounded
      }
    },
    /** Least-squares slope of log N(<r) against log r, over 3 <= r <= rmax/2. */
    dimension() {
      if (this.rmax < 24) return null;
      const rs = this.radii.slice().sort((p, q) => p - q);
      const xs = []; const ys = [];
      for (let r = 3; r <= this.rmax / 2; r *= 1.15) {
        let lo = 0; let hi = rs.length; // count of radii < r
        while (lo < hi) { const mid = (lo + hi) >> 1; if (rs[mid] < r) lo = mid + 1; else hi = mid; }
        xs.push(Math.log(r)); ys.push(Math.log(lo));
      }
      const k = xs.length;
      const mx = xs.reduce((s, v) => s + v, 0) / k;
      const my = ys.reduce((s, v) => s + v, 0) / k;
      let sxy = 0; let sxx = 0;
      for (let i = 0; i < k; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      return sxy / sxx;
    },
    readout() {
      const d = this.dimension();
      const ds = d === null ? '–' : d.toFixed(2);
      const txt = `N = ${this.n} · D ≈ ${ds}`;
      return this.done ? `${txt} · ${fig.dataset.done}` : txt;
    },
  };

  sim.reset();
  fig.querySelector('[data-act="reset"]').addEventListener('click', () => demo.restart());
  const demo = window.Demo(fig, sim);
})();
