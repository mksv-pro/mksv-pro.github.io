/* The front gate: on a bare visit to the site (wide screen, no section, no preview), a black page asks
   how to visit, the castle or the terminal (the scrying engine in the castle's scriptorium: ui/5-engine.js
   opens it on the 'gate' event).

   Behind it, site percolation on a triangular lattice: each site has its own threshold, drawn once
   (quenched disorder); a smooth field sweeps over the lattice (Gaussian swells on Lissajous paths, a
   travelling wave) and a site lights up as the field passes its threshold; lit neighbours are joined.
   Clusters grow, merge, span and break up as the swells go by, isolated sites flicker at their edges.
   The field also nudges each site along its gradient (the lattice breathes); all of it continuous in
   space and time: nothing jumps. */
(function () {
  const root = document.documentElement;
  const gate = document.getElementById('gate');
  if (!gate || !root.classList.contains('gated')) { if (gate) gate.remove(); return; }
  const cv = gate.querySelector('canvas'); const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GAP = 26; const RMAX = 2.1; const BANDS = 10; // (css px: the lattice step, the largest dot; alpha levels batched per stroke)
  let W = 0; let H = 0; let dpr = 1; let raf = 0; let last = 0; let t = 0; let leaving = 0; let swells = []; let sites = []; let nx = 0; let ny = 0;
  const rnd = Math.random;
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const m = Math.max(W, H);
    swells = Array.from({ length: 5 }, () => ({ // (centre's path, its periods in seconds, its width, its height)
      cx: rnd(), cy: rnd(), ax: 0.3 + rnd() * 0.3, ay: 0.25 + rnd() * 0.3, px: 16 + rnd() * 14, py: 20 + rnd() * 16,
      ph: rnd() * 6.28, s: m * (0.07 + rnd() * 0.08), h: 0.5 + rnd() * 0.5 }));
    const dy = GAP * 0.866; nx = Math.ceil(W / GAP) + 2; ny = Math.ceil(H / dy) + 2; sites = [];
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) sites.push({ x0: (i - 1 + (j % 2) * 0.5) * GAP, y0: (j - 1) * dy, u: 0.25 + 0.6 * rnd(), b: 0.6 + 0.4 * rnd() });
  }
  /** The field at (x, y), now: roughly 0 to 1.2. */
  function field(x, y) {
    let v = 0.18 + 0.12 * Math.sin(x * 0.006 - y * 0.004 + t * 0.45); // a long wave crossing the screen
    swells.forEach((s) => {
      const sx = (s.cx + s.ax * Math.sin((6.283 * t) / s.px + s.ph)) * W; const sy = (s.cy + s.ay * Math.sin((6.283 * t) / s.py + s.ph * 1.7)) * H;
      v += s.h * Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / (2 * s.s * s.s));
    });
    return v;
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const e = 3; // (the gradient's step, px)
    sites.forEach((p) => {
      const v = field(p.x0, p.y0); const gx = (field(p.x0 + e, p.y0) - v) / e; const gy = (field(p.x0, p.y0 + e) - v) / e;
      p.x = p.x0 + gx * 260; p.y = p.y0 + gy * 260; // (pushed up the slope: the lattice gathers under a swell)
      p.on = smooth(p.u - 0.07, p.u + 0.07, v); p.v = v;
      if (leaving) { const R = ((performance.now() - leaving) / 650) * Math.hypot(W, H) * 0.55; p.on *= smooth(R - 140, R, Math.hypot(p.x0 - W / 2, p.y0 - H / 2)); } // (on the way out: a widening hole from the middle)
    });
    const bands = Array.from({ length: BANDS }, () => new Path2D());
    const at = (i, j) => (i >= 0 && i < nx && j >= 0 && j < ny ? sites[j * nx + i] : null);
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) { // each site's three forward neighbours on the triangular lattice
      const p = sites[j * nx + i]; if (p.on < 0.02) continue;
      const odd = j % 2;
      [at(i + 1, j), at(i + odd, j + 1), at(i - 1 + odd, j + 1)].forEach((q) => {
        if (!q || q.on < 0.02) return; const a = Math.min(p.on, q.on) * 0.42;
        const k = Math.min(BANDS - 1, Math.floor(a * BANDS / 0.42)); if (k < 1) return;
        bands[k].moveTo(p.x, p.y); bands[k].lineTo(q.x, q.y);
      });
    }
    ctx.lineWidth = 0.6;
    bands.forEach((path, k) => { ctx.strokeStyle = `rgba(220,224,232,${((k + 0.5) / BANDS * 0.42).toFixed(3)})`; ctx.stroke(path); });
    const dots = Array.from({ length: BANDS }, () => new Path2D());
    sites.forEach((p) => {
      const a = (0.1 + 0.9 * p.on) * p.b; const r = 0.55 + (RMAX - 0.55) * p.on * Math.min(1, p.v);
      const k = Math.min(BANDS - 1, Math.floor(a * BANDS)); dots[k].moveTo(p.x + r, p.y); dots[k].arc(p.x, p.y, r, 0, 6.283);
    });
    dots.forEach((path, k) => { ctx.fillStyle = `rgba(${k > 7 ? '255,255,255' : '214,218,226'},${((k + 0.5) / BANDS).toFixed(3)})`; ctx.fill(path); });
  }
  function frame(now) {
    t += Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    draw(); raf = requestAnimationFrame(frame);
  }
  function start() { if (reduce) { draw(); return; } last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  t = rnd() * 100; resize(); start();
  addEventListener('resize', () => { resize(); if (reduce) draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (root.classList.contains('gated')) start(); });

  // while the gate is up, the page's single-key shortcuts behind it stay quiet; the arrows go from one
  // choice to the other (Tab, Enter and Space keep their default actions: those are not listeners)
  const hush = (e) => {
    if (!root.classList.contains('gated')) return;
    e.stopImmediatePropagation();
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const bs = [...gate.querySelectorAll('[data-gate]')]; const i = bs.indexOf(document.activeElement);
    bs[(i + 1) % bs.length].focus(); e.preventDefault();
  };
  addEventListener('keydown', hush, true);
  function close(way) {
    if (leaving) return;
    if (gate.querySelector('#gate-keep').checked && way !== 'tour') try { localStorage.setItem('gate', way); } catch { /* (no storage: it asks again) */ }
    leaving = performance.now(); gate.classList.add('out'); if (reduce) start();
    setTimeout(() => {
      cancelAnimationFrame(raf); root.classList.remove('gated'); gate.remove(); removeEventListener('keydown', hush, true);
      dispatchEvent(new CustomEvent('gate', { detail: way }));
    }, reduce ? 0 : 800);
  }
  gate.addEventListener('click', (e) => { const b = e.target.closest('[data-gate]'); if (b) close(b.dataset.gate); });
  gate.querySelector('[data-gate]').focus({ preventScroll: true });
}());
