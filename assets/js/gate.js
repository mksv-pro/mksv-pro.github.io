/* The front gate: on a bare visit to the site (wide screen, no section, no preview), a black page asks
   how to visit, the castle or the terminal, over a slow network of points.

   The network: points drawn from an uneven density (a few Gaussian clusters over a uniform floor),
   each tied to a home that drifts on a slow flow, jittered by an Ornstein-Uhlenbeck velocity; each
   fades in, lives, fades out and is drawn anew elsewhere, out of step with the others. Edges are the
   Gabriel graph (a subgraph of the Delaunay triangulation: i-j is kept when no point lies in the
   circle on [ij]), made continuous: a point inside that circle dims the edge by its opacity, weighted
   by how deep it lies, so nothing pops as points come and go. Only pairs closer than R are tried. */
(function () {
  const root = document.documentElement;
  const gate = document.getElementById('gate');
  if (!gate || !root.classList.contains('gated')) { if (gate) gate.remove(); return; }
  const cv = gate.querySelector('canvas'); const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0; let H = 0; let dpr = 1; let R = 60; let pts = []; let clusters = []; let raf = 0; let last = 0; let t = 0;
  const rnd = Math.random; const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  function sample() { // a place from the uneven density (clusters 65%, the floor 35%)
    if (rnd() < 0.35) return [rnd() * W, rnd() * H];
    const c = clusters[Math.floor(rnd() * clusters.length)];
    for (;;) { const x = c.x + gauss() * c.s; const y = c.y + gauss() * c.s * c.e; if (x > 0 && x < W && y > 0 && y < H) return [x, y]; }
  }
  function spawn(p, young) { // a point, at a new place, with a new life (seconds): fade in, hold, fade out
    const [x, y] = sample();
    p.hx = x; p.hy = y; p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = 10 + rnd() * 22; p.fade = 2.5 + rnd() * 3; p.age = young ? rnd() * p.life : 0;
    p.b = 0.5 + 0.5 * rnd() ** 0.7; p.r = 0.55 + rnd() * rnd() * 1.1; p.glow = rnd() < 0.05;
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const m = Math.min(W, H);
    clusters = Array.from({ length: 4 + Math.floor(rnd() * 3) }, () => ({ x: rnd() * W, y: rnd() * H, s: m * (0.08 + rnd() * 0.16), e: 0.6 + rnd() * 0.8 }));
    const n = Math.max(160, Math.min(520, Math.round((W * H) / 3200)));
    R = Math.sqrt((W * H) / n) * 1.7; // (a little over the mean spacing: the floor's points find a few neighbours, a cluster's many)
    pts = Array.from({ length: n }, () => { const p = {}; spawn(p, true); return p; });
  }
  const alphaOf = (p) => smooth(0, p.fade, p.age) * (1 - smooth(p.life - p.fade, p.life, p.age));

  function step(dt) {
    const th = 0.6; const sg = 5; const k = 0.08; // OU: relaxation (1/s), noise (px/s per sqrt s); the pull home (1/s)
    pts.forEach((p) => {
      p.age += dt; if (p.age >= p.life) spawn(p, false);
      const fx = Math.sin(p.hy * 0.004 + t * 0.05) + 0.5 * Math.sin(p.hx * 0.007 - t * 0.03); // the home's slow flow
      const fy = Math.cos(p.hx * 0.004 - t * 0.04) + 0.5 * Math.cos(p.hy * 0.006 + t * 0.02);
      p.hx = (p.hx + fx * 2.2 * dt + W) % W; p.hy = (p.hy + fy * 2.2 * dt + H) % H;
      p.vx += -th * p.vx * dt + sg * Math.sqrt(dt) * gauss(); p.vy += -th * p.vy * dt + sg * Math.sqrt(dt) * gauss();
      let dx = p.hx - p.x; let dy = p.hy - p.y; if (Math.abs(dx) > W / 2 || Math.abs(dy) > H / 2) { p.x = p.hx; p.y = p.hy; dx = 0; dy = 0; } // (its home wrapped round the edge: it goes with it, faded or not)
      p.x += (p.vx + k * dx) * dt; p.y += (p.vy + k * dy) * dt;
      p.a = alphaOf(p);
    });
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const live = pts.filter((p) => p.a > 0.01); const cell = new Map(); const key = (cx, cy) => cx * 4096 + cy;
    live.forEach((p, i) => { const kk = key(Math.floor(p.x / R), Math.floor(p.y / R)); if (!cell.has(kk)) cell.set(kk, []); cell.get(kk).push(i); });
    const near = (p) => { const out = []; const cx = Math.floor(p.x / R); const cy = Math.floor(p.y / R); for (let a = -1; a <= 1; a += 1) for (let b = -1; b <= 1; b += 1) { const c = cell.get(key(cx + a, cy + b)); if (c) out.push(...c); } return out; };
    ctx.lineWidth = 0.6;
    live.forEach((p, i) => {
      const cand = near(p);
      cand.forEach((j) => {
        if (j <= i) return; const q = live[j]; const dx = q.x - p.x; const dy = q.y - p.y; const d2 = dx * dx + dy * dy;
        if (d2 > R * R) return;
        const mx = (p.x + q.x) / 2; const my = (p.y + q.y) / 2; const r2 = d2 / 4; let s = Math.min(p.a, q.a);
        for (const k of cand) { // the Gabriel test, soft: whoever stands in the circle on [pq] dims the edge
          if (k === i || k === j) continue; const o = live[k]; const e2 = (o.x - mx) ** 2 + (o.y - my) ** 2;
          if (e2 < r2) { s *= 1 - o.a * smooth(1, 0.8, Math.sqrt(e2 / r2)); if (s < 0.01) return; }
        }
        const fall = (1 - Math.sqrt(d2) / R) ** 1.4; const al = s * fall * 0.32;
        if (al < 0.01) return;
        ctx.strokeStyle = `rgba(225,228,235,${al.toFixed(3)})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });
    });
    live.forEach((p) => {
      const a = p.a * p.b;
      if (p.glow) { ctx.fillStyle = `rgba(255,255,255,${(a * 0.08).toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = `rgba(${p.b > 0.8 ? '255,255,255' : '214,218,226'},${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; t += dt;
    step(dt); draw(); raf = requestAnimationFrame(frame);
  }
  function start() { if (reduce) { step(0); draw(); return; } last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  resize(); start();
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
  function close() {
    gate.classList.add('out');
    setTimeout(() => { cancelAnimationFrame(raf); root.classList.remove('gated'); gate.remove(); removeEventListener('keydown', hush, true); }, reduce ? 0 : 700);
  }
  gate.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gate]'); if (!b) return;
    if (b.dataset.gate === 'terminal') location.assign(`${location.pathname}?theme=dark`);
    else close();
  });
  gate.querySelector('[data-gate]').focus({ preventScroll: true });
}());
