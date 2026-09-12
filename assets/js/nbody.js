'use strict';

// Direct-summation N-body, kick-drift-kick leapfrog, G = 1. Drawn by window.Demo (script.js)
// in one bit; trails fade by clearing random pixels, a dithered decay.
(() => {
  const fig = document.querySelector('[data-demo="nbody"]');
  if (!fig || !window.Demo) return;
  const W = fig.querySelector('canvas').width;
  const C = (W - 1) / 2;

  // mulberry32: a fixed seed, so the cold collapse is the same cloud on every visit
  function rng(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PRESETS = {
    // Figure eight: Chenciner & Montgomery, Ann. Math. 152, 881 (2000); initial conditions of
    // Simo (2002), period ~6.3259.
    eight: {
      dt: 1e-3, steps: 14, eps: 0, scale: 95, fade: 0.004, dot: 3, tEnd: Infinity,
      init() {
        const p = [0.97000436, -0.24308753];
        const v3 = [-0.93240737, -0.86473146];
        return {
          m: [1, 1, 1],
          x: [p[0], -p[0], 0], y: [p[1], -p[1], 0], z: [0, 0, 0],
          vx: [-v3[0] / 2, -v3[0] / 2, v3[0]], vy: [-v3[1] / 2, -v3[1] / 2, v3[1]], vz: [0, 0, 0],
        };
      },
    },
    // Cold collapse: N bodies at rest, uniform in the unit sphere, total mass 1, Plummer
    // softening eps; free-fall time pi/2 * sqrt(R^3 / 2GM) ~ 1.11.
    collapse: {
      dt: 2e-3, steps: 4, eps: 0.05, scale: 80, fade: 0.35, dot: 1, tEnd: 12,
      init() {
        const N = 200;
        const rand = rng(1888);
        const s = { m: [], x: [], y: [], z: [], vx: [], vy: [], vz: [] };
        while (s.x.length < N) {
          const x = 2 * rand() - 1; const y = 2 * rand() - 1; const z = 2 * rand() - 1;
          if (x * x + y * y + z * z > 1) continue;
          s.m.push(1 / N); s.x.push(x); s.y.push(y); s.z.push(z);
          s.vx.push(0); s.vy.push(0); s.vz.push(0);
        }
        return s;
      },
    },
  };

  let P = PRESETS.eight;
  let s; let ax; let ay; let az; let t; let E0;

  function accel() {
    const n = s.m.length;
    const e2 = P.eps * P.eps;
    ax.fill(0); ay.fill(0); az.fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const dx = s.x[j] - s.x[i]; const dy = s.y[j] - s.y[i]; const dz = s.z[j] - s.z[i];
        const r2 = dx * dx + dy * dy + dz * dz + e2;
        const inv3 = 1 / (r2 * Math.sqrt(r2));
        ax[i] += s.m[j] * dx * inv3; ay[i] += s.m[j] * dy * inv3; az[i] += s.m[j] * dz * inv3;
        ax[j] -= s.m[i] * dx * inv3; ay[j] -= s.m[i] * dy * inv3; az[j] -= s.m[i] * dz * inv3;
      }
    }
  }

  /** Total energy, with the softened potential that matches the softened force. */
  function energy() {
    const n = s.m.length;
    const e2 = P.eps * P.eps;
    let k = 0; let u = 0;
    for (let i = 0; i < n; i += 1) {
      k += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2 + s.vz[i] ** 2);
      for (let j = i + 1; j < n; j += 1) {
        const dx = s.x[j] - s.x[i]; const dy = s.y[j] - s.y[i]; const dz = s.z[j] - s.z[i];
        u -= (s.m[i] * s.m[j]) / Math.sqrt(dx * dx + dy * dy + dz * dz + e2);
      }
    }
    return k + u;
  }

  function step(dt) {
    const n = s.m.length;
    for (let i = 0; i < n; i += 1) {
      s.vx[i] += 0.5 * dt * ax[i]; s.vy[i] += 0.5 * dt * ay[i]; s.vz[i] += 0.5 * dt * az[i];
      s.x[i] += dt * s.vx[i]; s.y[i] += dt * s.vy[i]; s.z[i] += dt * s.vz[i];
    }
    accel();
    for (let i = 0; i < n; i += 1) {
      s.vx[i] += 0.5 * dt * ax[i]; s.vy[i] += 0.5 * dt * ay[i]; s.vz[i] += 0.5 * dt * az[i];
    }
  }

  const sim = {
    mask: new Uint8Array(W * W),
    done: false,
    reset() {
      s = P.init();
      const n = s.m.length;
      ax = new Float64Array(n); ay = new Float64Array(n); az = new Float64Array(n);
      accel();
      t = 0;
      E0 = energy();
      this.mask.fill(0);
      this.done = false;
      this.draw();
    },
    draw() {
      const m = this.mask;
      for (let i = 0; i < m.length; i += 1) if (m[i] && Math.random() < P.fade) m[i] = 0;
      for (let i = 0; i < s.m.length; i += 1) {
        const px = Math.round(C + P.scale * s.x[i]);
        const py = Math.round(C - P.scale * s.y[i]);
        for (let a = 0; a < P.dot; a += 1) {
          for (let b = 0; b < P.dot; b += 1) {
            const X = px + a; const Y = py + b;
            if (X >= 0 && X < W && Y >= 0 && Y < W) m[Y * W + X] = 1;
          }
        }
      }
    },
    frame() {
      for (let k = 0; k < P.steps; k += 1) step(P.dt);
      t += P.steps * P.dt;
      this.draw();
      if (t >= P.tEnd) this.done = true;
      return !this.done;
    },
    readout() {
      const dE = Math.abs((energy() - E0) / E0);
      const e = dE.toExponential(1).replace('e', '×10^');
      return `N = ${s.m.length} · t = ${t.toFixed(2)} · |ΔE/E| = ${e}`;
    },
  };

  sim.reset();
  const demo = window.Demo(fig, sim);
  const presetBtns = fig.querySelectorAll('[data-act="preset"]');
  presetBtns.forEach((btn) => btn.addEventListener('click', () => {
    P = PRESETS[btn.dataset.preset];
    presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    demo.restart();
  }));
})();
