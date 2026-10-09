/* The castle's small simulations, pure functions of their own state: random numbers and noise, lichen
   (diffusion-limited growth), the ferryman's Q-learning, Stam's stable fluid (the fire's smoke), the
   2D wave equation (ripples), the ants' double bridge, the shoal (boids), El Farol at the market,
   the dielectric breakdown of a bolt. Loaded before hours.js. */
(function () {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Smooth 1D value noise in [0, 1], period n. */
  function noise1(rng, n = 64) {
    const t = Array.from({ length: n }, rng);
    return (x) => {
      const i = Math.floor(x); const f = x - i;
      const a = t[((i % n) + n) % n]; const b = t[(((i + 1) % n) + n) % n];
      return a + (b - a) * f * f * (3 - 2 * f);
    };
  }
  function lichenInit(plane, WE, H, y0, y1, rng, rock) {
    const on = new Uint8Array(WE * H); const list = [];
    for (let y = y0; y < y1; y += 1) for (let x = 0; x < WE; x += 1) if (rock.has(plane[y * WE + x])) { on[y * WE + x] = 1; list.push(y * WE + x); }
    const patches = [];
    for (let tries = 0; patches.length < 3 && list.length && tries < 400; tries += 1) {
      const i = list[Math.floor(rng() * list.length)]; const x = i % WE; const y = (i - x) / WE;
      if (y < y0 + 3 || patches.some((p) => Math.hypot(p.x - x, p.y - y) < 18)) continue;
      on[i] = 2 + patches.length; patches.push({ x, y, cells: [[x, y]], r: 0, w: null, sum: [x, y, x * x + y * y], hist: [], species: patches.length % 3 === 1 ? 'xanthoria' : 'lecanora' });
    }
    return { on, WE, patches, max: 120, stick: 0.3 }; // (sticking below 1: a crust more than a fern)
  }
  /** Spend `budget` walker steps over the patches still growing; returns the cells added. */
  function lichenGrow(lc, budget) {
    const { on, WE } = lc; let added = 0;
    const live = lc.patches.filter((p) => p.cells.length < lc.max);
    if (!live.length) return 0;
    const per = Math.ceil(budget / live.length);
    lc.patches.forEach((p, k) => {
      if (p.cells.length >= lc.max) return;
      const me = 2 + k; // (a walker takes hold on its own patch only: they would merge, and r with them)
      for (let s = 0; s < per && p.cells.length < lc.max; s += 1) {
        if (!p.w) { // launch on a ring just outside the patch, on rock
          const a = Math.random() * 6.283; const R = p.r + 5;
          const x = Math.round(p.x + Math.cos(a) * R); const y = Math.round(p.y + Math.sin(a) * R);
          if (on[y * WE + x] !== 1) continue;
          p.w = [x, y];
        }
        const [x, y] = p.w; const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        const nx = x + d[0]; const ny = y + d[1];
        if (on[ny * WE + nx] === 1) p.w = [nx, ny]; // (off the rock: it stays where it is)
        const [wx, wy] = p.w;
        if (Math.hypot(wx - p.x, wy - p.y) > 2 * p.r + 10) { p.w = null; continue; }
        const touch = on[wy * WE + wx + 1] === me || on[wy * WE + wx - 1] === me || on[(wy + 1) * WE + wx] === me || on[(wy - 1) * WE + wx] === me;
        if (touch && Math.random() < lc.stick) {
          on[wy * WE + wx] = me; p.cells.push([wx, wy]); p.r = Math.max(p.r, Math.hypot(wx - p.x, wy - p.y)); p.w = null; added += 1;
          const n = p.cells.length; const q = p.sum; q[0] += wx; q[1] += wy; q[2] += wx * wx + wy * wy;
          const rg2 = q[2] / n - (q[0] / n) ** 2 - (q[1] / n) ** 2; // radius of gyration, squared
          if (n >= 10) p.hist.push([Math.log(n), 0.5 * Math.log(rg2)]);
        }
      }
    });
    return added;
  }
  /** Fractal dimension D from each patch's growth, N ~ Rg^D (least squares of log N on log Rg),
   *  averaged over the patches. (Mass within r of the seed undercounts on clusters this small:
   *  the outer rim is still filling in: 0.9 to 1.3 where this gives 1.6 to 1.8.) */
  function lichenDim(lc) {
    const fit = (pts) => {
      const mx = pts.reduce((a, q) => a + q[1], 0) / pts.length; const my = pts.reduce((a, q) => a + q[0], 0) / pts.length;
      return pts.reduce((a, q) => a + (q[1] - mx) * (q[0] - my), 0) / pts.reduce((a, q) => a + (q[1] - mx) ** 2, 0);
    };
    const ds = lc.patches.filter((p) => p.hist.length >= 10).map((p) => fit(p.hist));
    return ds.length ? ds.reduce((a, d) => a + d, 0) / ds.length : null;
  }
  const FX = 8; // the drift he can be off by, either side
  function ferryNew(L) { // his prior: the jetty is where to be (Q = -|drift|); the current he must learn
    const Q = new Float32Array((L + 1) * (2 * FX + 1) * 3);
    for (let i = 0; i < Q.length; i += 1) Q[i] = -Math.abs((Math.floor(i / 3) % (2 * FX + 1)) - FX);
    return { L, Q, r: 0, dx: 0, px: 0, dir: 1, wait: 60, errs: [], n: 0 };
  }
  const fq = (f, r, dx, a) => f.Q[((r * (2 * FX + 1)) + dx + FX) * 3 + a];
  function ferryChoose(f) {
    const eps = Math.max(0.05, 0.5 * 0.95 ** f.n);
    if (Math.random() < eps) return Math.floor(Math.random() * 3);
    let best = 0; for (let a = 1; a < 3; a += 1) if (fq(f, f.r, f.dx, a) > fq(f, f.r, f.dx, best)) best = a;
    return best;
  }
  /** One row of the crossing: act, drift, learn. Returns the landing error when he lands. */
  function ferryRow(f, current) {
    const a = ferryChoose(f); const drift = current + (Math.random() - 0.5) * 1.2;
    const dx2 = clamp(Math.round(f.dx + (a - 1) + drift), -FX, FX); const r2 = f.r + 1;
    const cost = a === 1 ? 0 : 0.05; const i = ((f.r * (2 * FX + 1)) + f.dx + FX) * 3 + a;
    let target; let landed = null;
    if (r2 >= f.L) { landed = Math.abs(dx2); target = -cost - landed; }
    else target = -cost + Math.max(fq(f, r2, dx2, 0), fq(f, r2, dx2, 1), fq(f, r2, dx2, 2));
    f.Q[i] += 0.3 * (target - f.Q[i]);
    f.r = r2; f.dx = dx2; f.last = a;
    return landed;
  }
  function fluidNew(w, h) { const n = w * h; return { w, h, u: new Float32Array(n), v: new Float32Array(n), d: new Float32Array(n), p: new Float32Array(n), div: new Float32Array(n) }; }
  function fluidAdvect(f, q, u, v) {
    const { w, h } = f; const out = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x; const sx = clamp(x - u[i], 0.5, w - 1.5); const sy = clamp(y - v[i], 0.5, h - 1.5);
      const x0 = Math.floor(sx); const y0 = Math.floor(sy); const fx = sx - x0; const fy = sy - y0; const j = y0 * w + x0;
      out[i] = (q[j] * (1 - fx) + q[j + 1] * fx) * (1 - fy) + (q[j + w] * (1 - fx) + q[j + w + 1] * fx) * fy;
    }
    return out;
  }
  function fluidProject(f) {
    const { w, h, u, v, p, div } = f;
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) { const i = y * w + x; div[i] = -0.5 * (u[i + 1] - u[i - 1] + v[i + w] - v[i - w]); p[i] = 0; }
    for (let it = 0; it < 14; it += 1) for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) { const i = y * w + x; p[i] = (div[i] + p[i - 1] + p[i + 1] + p[i - w] + p[i + w]) / 4; }
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) { const i = y * w + x; u[i] -= 0.5 * (p[i + 1] - p[i - 1]); v[i] -= 0.5 * (p[i + w] - p[i - w]); }
  }
  function fluidStep(f, src, wind) {
    const { w, h } = f; const cx = w >> 1;
    f.k = (f.k || 0) + 1; const sway = Math.sin(f.k * 0.07) * 0.5 + Math.sin(f.k * 0.023) * 0.4; // (the flames gutter)
    for (let x = cx - 2; x <= cx + 2; x += 1) { const i = (h - 3) * w + x; f.d[i] = Math.min(2, f.d[i] + src * (0.4 + Math.random() * 0.6)); f.v[i] -= 0.12; f.u[i] += sway * 0.3 + (Math.random() - 0.5) * 1.2; }
    for (let i = 0; i < w * h; i += 1) { f.v[i] = f.v[i] * 0.99 - 0.007 * f.d[i]; f.u[i] = f.u[i] * 0.995 + wind * 0.004 * (1 - (i / w) / h); }
    fluidProject(f); const u2 = fluidAdvect(f, f.u, f.u, f.v); f.v = fluidAdvect(f, f.v, f.u, f.v); f.u = u2; fluidProject(f);
    const d = fluidAdvect(f, f.d, f.u, f.v); const d2 = new Float32Array(w * h); // carried, then spread a little: the plume widens as it rises
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) { const i = y * w + x; d2[i] = (d[i] * 0.8 + (d[i - 1] + d[i + 1] + d[i - w] + d[i + w]) * 0.05) * 0.988; }
    f.d = d2;
  }
  function waveStep(wv) {
    const { w, h, wet } = wv; const un = new Float32Array(w * h); let e = 0;
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x; if (!wet[i]) continue;
      const lap = wv.u[i - 1] + wv.u[i + 1] + wv.u[i - w] + wv.u[i + w] - 4 * wv.u[i];
      un[i] = (2 * wv.u[i] - wv.up[i] + 0.3 * lap) * 0.975; e += Math.abs(un[i]);
    }
    wv.up = wv.u; wv.u = un; wv.live = e > 0.5 ? 1 : 0;
  }
  function antsNew(x0, y0) {
    const walk = (dip) => { // an arc from the nest to the apple, a pixel a step (its length: the time it takes)
      const out = [[x0, y0]];
      for (let u = 0; u <= 1; u += 0.002) {
        const p = [x0 + Math.round(30 * u), y0 + Math.round(Math.sin(u * Math.PI) * dip)]; const q = out[out.length - 1];
        if (p[0] !== q[0] || p[1] !== q[1]) out.push(p);
      }
      return out;
    };
    const ways = [walk(1.5), walk(-10)]; // short, and long: round the pebble
    return { x0, y0, ways, tau: [1, 1], k: 5, ants: Array.from({ length: 16 }, (_, j) => ({ way: j % 2, s: -j * 3, dir: 1 })), picks: [] };
  }
  function antsStep(a) {
    a.tau = a.tau.map((v) => v * 0.997); // the marks fade
    const choose = () => { const [s0, l0] = a.tau.map((v) => (a.k + v) ** 2); const w = Math.random() < s0 / (s0 + l0) ? 0 : 1; a.picks.push(w); if (a.picks.length > 40) a.picks.shift(); return w; };
    a.ants.forEach((n) => {
      if (n.s < 0) { n.s += 1; return; } // (still in the nest: they leave one by one)
      n.s += 1; const len = a.ways[n.way].length;
      if (n.s < len) return;
      a.tau[n.way] += 1; // there: mark the way taken, turn round, choose again
      n.dir = -n.dir; n.way = choose(); n.s = 0;
    });
  }
  function shoalStep(f, x0, x1, top, bot) {
    f.forEach((a) => {
      let cx = 0; let cy = 0; let vx = 0; let vy = 0; let n = 0; let sx = 0; let sy = 0;
      f.forEach((b) => {
        if (a === b) return; const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < 12) { cx += b.x; cy += b.y; vx += b.vx; vy += b.vy; n += 1; }
        if (d < 2.5) { sx += a.x - b.x; sy += a.y - b.y; }
      });
      if (n) { a.vx += ((cx / n - a.x) * 0.004) + ((vx / n - a.vx) * 0.06); a.vy += ((cy / n - a.y) * 0.004) + ((vy / n - a.vy) * 0.06); }
      a.vx += sx * 0.05 + (Math.random() - 0.5) * 0.02; a.vy += sy * 0.05 + (Math.random() - 0.5) * 0.01;
      if (a.x < x0 + 4) a.vx += 0.02; if (a.x > x1 - 4) a.vx -= 0.02;
      const t0 = top(Math.round(a.x)) + 2; const b0 = bot(Math.round(a.x)) - 2;
      if (a.y < t0) a.vy += 0.03; if (a.y > b0) a.vy -= 0.03;
      const sp = Math.hypot(a.vx, a.vy); const k = sp > 0.45 ? 0.45 / sp : sp < 0.12 ? 0.12 / (sp || 1) : 1;
      a.vx *= k; a.vy *= k * 0.6; a.x += a.vx; a.y += a.vy;
    });
  }
  function marketGame(pull, { kappa = 0.35, eps = 0.04, sigma = 0.06, gamma = 0.95, rounds = 300 } = {}) {
    const N = pull.length; const Q = new Float64Array(N * 3); const V = new Float64Array(N); const pol = new Float64Array(N * 3);
    let mbar = new Float64Array(N).fill(1 / N); let m = mbar.slice();
    const reply = (iters) => { // soft value iteration against the crowd mbar (warm-started: V carries over)
      for (let it = 0; it < iters; it += 1) {
        for (let x = 0; x < N; x += 1) {
          const c = kappa * N * mbar[x] - pull[x]; let mn = Infinity;
          for (let a = 0; a < 3; a += 1) {
            const y = x + a - 1; const q = y < 0 || y >= N ? Infinity : c + (a === 1 ? 0 : eps) + gamma * V[y];
            Q[x * 3 + a] = q; mn = Math.min(mn, q);
          }
          let z = 0; for (let a = 0; a < 3; a += 1) z += Math.exp(-(Q[x * 3 + a] - mn) / sigma);
          V[x] = mn - sigma * Math.log(z);
          for (let a = 0; a < 3; a += 1) pol[x * 3 + a] = Math.exp(-(Q[x * 3 + a] - mn) / sigma) / z;
        }
      }
    };
    const forward = (iters) => { // the crowd that policy makes, run towards its stationary law
      for (let it = 0; it < iters; it += 1) {
        const m2 = new Float64Array(N);
        for (let x = 0; x < N; x += 1) for (let a = 0; a < 3; a += 1) if (pol[x * 3 + a]) m2[x + a - 1] += m[x] * pol[x * 3 + a];
        m = m2;
      }
    };
    for (let k = 0; k < rounds; k += 1) {
      reply(k ? 20 : 200); forward(k ? 40 : 400);
      mbar = mbar.map((v, x) => v + (m[x] - v) / (k + 2));
    }
    reply(300); m = mbar.slice(); forward(2000); // how far mbar is from the crowd its own best reply makes
    const gap = m.reduce((s, v, x) => s + Math.abs(v - mbar[x]), 0);
    return { m: mbar, pol, gap, rounds };
  }
  function fbm(rng, oct = 4) {
    const ns = Array.from({ length: oct }, () => noise1(rng));
    return (x) => {
      let s = 0; let a = 1; let w = 0;
      for (let k = 0; k < oct; k += 1) { s += a * ns[k](x * 2 ** k); w += a; a /= 2; }
      return s / w;
    };
  }
  function boltNew(w, h, x0, y0) {
    const phi = Float32Array.from({ length: w * h }, (_, i) => Math.floor(i / w) / (h - 1));
    const on = new Uint8Array(w * h); const par = new Int32Array(w * h).fill(-1); const c0 = w >> 1;
    on[c0] = 1; phi[c0] = 0;
    return { w, h, x0, y0, phi, on, par, cells: [c0], done: false, main: null };
  }
  function boltGrow(b, steps, eta = 1.6) {
    const { w, h, phi, on, par } = b;
    for (let s0 = 0; s0 < steps && !b.done; s0 += 1) {
      for (let it = 0; it < 4; it += 1) {
        for (let y = 1; y < h - 1; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const i = y * w + x; if (on[i]) continue;
            const l = phi[x ? i - 1 : i + 1]; const r = phi[x < w - 1 ? i + 1 : i - 1];
            phi[i] += 1.85 * ((l + r + phi[i - w] + phi[i + w]) / 4 - phi[i]);
          }
        }
      }
      const cand = []; let tot = 0; // the channel's free neighbours, weighted
      b.cells.forEach((i) => {
        const x = i % w; // (eight neighbours: the channel may run on the diagonal)
        [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i + w, i - w, x > 0 ? i + w - 1 : -1, x < w - 1 ? i + w + 1 : -1].forEach((j) => {
          if (j < w || j >= w * h || on[j]) return;
          const p = Math.max(0, phi[j]) ** eta; tot += p; cand.push([j, i, p]);
        });
      });
      if (!tot) { b.done = true; break; }
      let r = Math.random() * tot; let k = 0; while (k < cand.length - 1 && (r -= cand[k][2]) > 0) k += 1;
      const [j, from] = cand[k];
      on[j] = 1; phi[j] = 0; par[j] = from; b.cells.push(j);
      if (j >= w * (h - 1)) { // it has reached the ground: the main channel, back up the tree
        b.done = true; b.main = new Set(); for (let q = j; q >= 0; q = par[q]) b.main.add(q);
      }
    }
  }
  window.HOURS_PHYSICS = { mulberry32, noise1, fbm, lichenInit, lichenGrow, lichenDim, ferryNew, ferryChoose, ferryRow, fluidNew, fluidAdvect, fluidProject, fluidStep, waveStep, antsNew, antsStep, shoalStep, marketGame, boltNew, boltGrow };
}());
