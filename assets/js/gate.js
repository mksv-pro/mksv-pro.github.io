/* The front gate: on a bare visit to the site (wide screen, no section, no preview), a black page asks
   how to visit, the castle or the terminal (the scrying engine in the castle's scriptorium: script.js
   opens it on the 'gate' event).

   Behind it, a halftone: a square grid of rust-coloured dots, each dot's radius and light the value
   there of a smooth field, a few broad Gaussian swells drifting on slow Lissajous paths over a ramp
   from the top left. Nothing jumps: the field is continuous in space and time. */
(function () {
  const root = document.documentElement;
  const gate = document.getElementById('gate');
  if (!gate || !root.classList.contains('gated')) { if (gate) gate.remove(); return; }
  const cv = gate.querySelector('canvas'); const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GAP = 23; const RMAX = 3.8; // (css px: the grid's step, the largest dot's radius)
  let W = 0; let H = 0; let dpr = 1; let raf = 0; let last = 0; let t = 0; let swells = [];
  const rnd = Math.random;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const m = Math.max(W, H);
    swells = Array.from({ length: 4 }, (_, k) => ({ // (centre's path, its periods in seconds, its width)
      cx: rnd(), cy: rnd(), ax: 0.25 + rnd() * 0.25, ay: 0.2 + rnd() * 0.25, px: 70 + rnd() * 60, py: 90 + rnd() * 70,
      ph: rnd() * 6.28, s: m * (0.1 + rnd() * 0.1), h: k === 0 ? 1 : 0.55 + rnd() * 0.4 }));
  }
  /** The field at (x, y), time t: 0 (no dot) to 1 (the largest). */
  function field(x, y) {
    let v = 0.4 * Math.max(0, 1 - (x / W) * 0.9 - (y / H) * 0.5); // the ramp, bright at the top left
    swells.forEach((s) => {
      const sx = (s.cx + s.ax * Math.sin((6.283 * t) / s.px + s.ph)) * W; const sy = (s.cy + s.ay * Math.sin((6.283 * t) / s.py + s.ph * 1.7)) * H;
      v += s.h * Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / (2 * s.s * s.s));
    });
    return 1 - Math.exp(-2.2 * v); // (saturating softly: no flat plateau where swells overlap)
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const nx = Math.ceil(W / GAP); const ny = Math.ceil(H / GAP); const ox = (W - (nx - 1) * GAP) / 2; const oy = (H - (ny - 1) * GAP) / 2;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const x = ox + i * GAP; const y = oy + j * GAP; const v = field(x, y);
      const r = 0.6 + (RMAX - 0.6) * v; const a = 0.08 + 0.85 * v ** 1.2; // (even the faintest dot shows: the grid stays legible)
      ctx.fillStyle = `rgba(${Math.round(150 + 50 * v)},${Math.round(62 + 26 * v)},${Math.round(22 + 8 * v)},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
  }
  function frame(now) {
    t += Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    draw(); raf = requestAnimationFrame(frame);
  }
  function start() { if (reduce) { draw(); return; } last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  t = rnd() * 200; resize(); start();
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
    gate.classList.add('out');
    setTimeout(() => {
      cancelAnimationFrame(raf); root.classList.remove('gated'); gate.remove(); removeEventListener('keydown', hush, true);
      dispatchEvent(new CustomEvent('gate', { detail: way }));
    }, reduce ? 0 : 700);
  }
  gate.addEventListener('click', (e) => { const b = e.target.closest('[data-gate]'); if (b) close(b.dataset.gate); });
  gate.querySelector('[data-gate]').focus({ preventScroll: true });
}());
