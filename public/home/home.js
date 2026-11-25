/* The front page: who, what is sought, and the site's pages as a list: click one, or press its key (once
   to point at it, again or Enter to go), or the arrows then Enter.

   Behind it, the random-field Ising model at zero temperature (Sethna et al., PRL 70, 3347, 1993): a spin
   s = +-1 a CELL px square, coupled to its four neighbours (J = 1), each with its own frozen random field
   h ~ N(0, R^2), all in a uniform field H swept slowly up, then down. A spin flips when its local field
   J sum(s_j) + h + H turns to the sweep's sign; its flip may tip its neighbours, and theirs: an avalanche,
   spread GEN generations a frame with H held still, and painted its own colour: full when the spin is up,
   dark when down, its arrow cut in; whitened when just flipped. Where nothing would flip, H jumps to
   the next spin that will. The pointer adds a local field along the sweep, and sets avalanches off. */
(function () {
  const gate = document.getElementById('gate');
  if (!gate) return;
  const cv = gate.querySelector('canvas'); const ctx = cv.getContext('2d'); const say = gate.querySelector('.gb-on');
  const box = gate.querySelector('.gate-box'); const rnd = Math.random;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CELL = 8; // css px a spin: its arrow, 8 x 8
  const J = 1; const R = 0.95; // coupling; disorder (2D square lattice: R_c ~ 0.54, so domains stay finite)
  const RATE = 0.12; // field units a second, between avalanches
  const GEN = 3; // generations an avalanche spreads a frame
  const HMAX = 5; const PAUSE = 1.5; const FLASH = 0.5; // (|H| turned at; s still at each end; s a flip stays white)
  const BUMP = 2.2; const REACH = 60; // the pointer's field, and its reach in px
  const IDS = 65536; // (avalanche colours, reused round)

  let W = 0; let H = 0; let dpr = 1; let nx = 0; let ny = 0; let n = 0; let raf = 0; let last = 0; let t = 0;
  let s; let h; let col; let tf; let inQ; let size; let img; let pix; let hot = []; // (hot: spins to repaint)
  const off = document.createElement('canvas'); const octx = off.getContext('2d');
  let field = -HMAX; let dir = 1; let pause = 0; let M = 0; let id = 0; let front = []; let biggest = 0;
  let px = -1e4; let py = -1e4;

  const pal = new Uint8Array(IDS * 3); // a random bright colour an avalanche; 0: never flipped
  const hsl = (hh, ss, ll) => { const a = ss * Math.min(ll, 1 - ll); const f = (k) => { const q = (k + hh * 12) % 12; return ll - a * Math.max(-1, Math.min(q - 3, 9 - q, 1)); }; return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)); };
  for (let k = 0; k < IDS; k += 1) pal.set(k ? hsl(Math.random(), 0.65 + 0.25 * Math.random(), 0.52 + 0.1 * Math.random()) : [70, 66, 58], k * 3);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    nx = Math.ceil(W / CELL); ny = Math.ceil(H / CELL); n = nx * ny;
    s = new Int8Array(n).fill(-1); h = new Float32Array(n); col = new Uint16Array(n); tf = new Float32Array(n).fill(-9);
    inQ = new Uint8Array(n); size = new Uint32Array(IDS);
    for (let k = 0; k < n; k += 1) h[k] = R * gauss();
    off.width = nx * CELL; off.height = ny * CELL; img = octx.createImageData(nx * CELL, ny * CELL); pix = img.data; hot = [];
    field = -HMAX; dir = 1; pause = 0; M = -n; front = []; biggest = 0;
  }
  /** The pointer's field at spin k, along the sweep. */
  function bump(k) {
    if (px < -1e3) return 0;
    const x = ((k % nx) + 0.5) * CELL - px; const y = (Math.floor(k / nx) + 0.5) * CELL - py; const r2 = x * x + y * y;
    return r2 < 4 * REACH * REACH ? dir * BUMP * Math.exp(-r2 / (2 * (REACH / 2) ** 2)) : 0;
  }
  /** The local field on spin k, but for H (free edges). */
  function local(k) {
    const i = k % nx; let v = h[k];
    if (i > 0) v += J * s[k - 1]; if (i < nx - 1) v += J * s[k + 1]; if (k >= nx) v += J * s[k - nx]; if (k < n - nx) v += J * s[k + nx];
    return v + bump(k);
  }
  /** New avalanches: every spin against the sweep whose local field has turned. */
  function seed() {
    for (let k = 0; k < n; k += 1) {
      if (s[k] !== -dir || inQ[k] || dir * (local(k) + field) <= 0) continue;
      id = (id % (IDS - 1)) + 1; size[id] = 0; col[k] = id; inQ[k] = 1; front.push(k);
    }
  }
  /** Where H must go for the next spin to flip (the sweep's dead stretch skipped). */
  function next() {
    let best = dir * Infinity;
    for (let k = 0; k < n; k += 1) if (s[k] === -dir) { const v = -local(k); if (dir > 0 ? v < best : v > best) best = v; }
    return best;
  }
  /** g generations of the avalanches under way. */
  function spread(g) {
    for (; g > 0 && front.length; g -= 1) {
      const nxt = [];
      for (const k of front) {
        inQ[k] = 0; if (s[k] !== -dir) continue;
        s[k] = dir; M += 2 * dir; tf[k] = t; hot.push(k); size[col[k]] += 1; if (size[col[k]] > biggest) biggest = size[col[k]];
        const i = k % nx;
        for (const q of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) {
          if (q < 0 || q >= n || s[q] !== -dir || inQ[q] || dir * (local(q) + field) <= 0) continue;
          inQ[q] = 1; col[q] = col[k]; nxt.push(q);
        }
      }
      front = nxt;
    }
  }
  /** The drive: H held while an avalanche runs, else on at RATE (or straight to the next flip), turned at the ends. */
  function step(dt, g) {
    t += dt;
    if (pause > 0) { pause -= dt; if (pause <= 0) { dir = -dir; biggest = 0; } return; }
    if (!front.length) {
      field += dir * RATE * dt; seed();
      if (!front.length) { // (nothing flips at this H: on to where the next spin will, or to the end)
        const nf = next();
        if (!Number.isFinite(nf) || dir * (nf - dir * HMAX) >= 0) { field = dir * HMAX; pause = PAUSE; return; }
        if (dir * (nf - field) > 0) { field = nf + dir * 1e-6; seed(); }
      }
    }
    spread(g);
  }

  /* The arrows, 8 x 8 ('#': the arrow; '.': its ground). */
  const UP = ['........', '...##...', '..####..', '.#.##.#.', '...##...', '...##...', '...##...', '........'].join('');
  const DOWN = UP.match(/.{8}/g).reverse().join('');
  /** Spin k's square, into the picture: its avalanche's colour, full when up, dark when down, the arrow cut in. */
  function paint(k) {
    const c = col[k] * 3; const up = s[k] > 0; const f = Math.max(0, 1 - (t - tf[k]) / FLASH);
    let r = pal[c]; let g = pal[c + 1]; let b = pal[c + 2];
    if (f > 0) { r += (255 - r) * 0.7 * f; g += (255 - g) * 0.7 * f; b += (255 - b) * 0.7 * f; }
    const mask = up ? UP : DOWN; const ground = up ? 1 : 0.22; const on = up ? 0.55 : 0.5; const ow = nx * CELL; // (the colour fills the square as before; the arrow is cut in, darker when up, lighter when down)
    const x0 = (k % nx) * CELL; const y0 = Math.floor(k / nx) * CELL;
    for (let yy = 0; yy < CELL; yy += 1) for (let xx = 0; xx < CELL; xx += 1) {
      const a = mask[yy * CELL + xx] === '#' ? on : ground; const p = ((y0 + yy) * ow + x0 + xx) * 4;
      pix[p] = 11 + r * a; pix[p + 1] = 10 + g * a; pix[p + 2] = 8 + b * a; pix[p + 3] = 255;
    }
  }
  function paintAll() { for (let k = 0; k < n; k += 1) paint(k); octx.putImageData(img, 0, 0); }
  /** Repaint what flipped or is still white (only that region goes up), then the picture. */
  function draw() {
    let i0 = nx; let j0 = ny; let i1 = -1; let j1 = -1; const keep = [];
    for (const k of hot) {
      paint(k); const i = k % nx; const j = Math.floor(k / nx);
      if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
      if (t - tf[k] < FLASH + 0.1) keep.push(k);
    }
    hot = keep;
    if (i1 >= 0) octx.putImageData(img, 0, 0, i0 * CELL, j0 * CELL, (i1 - i0 + 1) * CELL, (j1 - j0 + 1) * CELL);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0);
  }
  const sign = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
  function report() { say.textContent = `behind: random-field Ising model, live · H ${sign(field)} · M ${sign(M / n)} · largest avalanche ${biggest.toLocaleString('en')}`; }
  /** A history before the first frame: up from saturation until a third has flipped (all of it when motion is reduced). */
  function warm(to) { // (in steps of H, each avalanche run out: a frame's work each, not one an avalanche)
    field = next() - 0.01; // (from just before the first flip: nothing happens below it)
    while (M / n < to && field < HMAX) { field += 0.02; t += 0.02; seed(); spread(1e9); }
  }
  let tick = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (wash) { washStep(now); return; }
    if (last && now - last < 30) return; // (about 30 frames a second)
    const dt = Math.min(0.06, last ? (now - last) / 1000 : 0.033); last = now;
    step(dt, GEN); draw(); tick += dt; if (tick > 0.25) { tick = 0; report(); }
  }

  /* Leaving for a page: a last avalanche from the link chosen, every spin turned to the page's colour;
     its front roughened by the spins' own random fields (a pinned interface), WASH_S to the far corner.
     The page then starts under the same colour and lets it go (partials/arrive.html). */
  const WASH_S = 0.55;
  const COLOUR = { about: '#ffffff', castle: matchMedia('(min-width: 75rem) and (min-aspect-ratio: 1/1)').matches ? '#f2ead8' : '#12100c', shinbun: '#e3241b', siege: '#000000' };
  let wash = null; // { rgb, order, at, i, t0, done }
  function takeover(name, ox, oy, done) {
    const hex = COLOUR[name] || '#000000'; const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    let far = 0; const at = new Float32Array(n);
    for (let k = 0; k < n; k += 1) { const d = Math.hypot(((k % nx) + 0.5) * CELL - ox, (Math.floor(k / nx) + 0.5) * CELL - oy); at[k] = d; if (d > far) far = d; }
    for (let k = 0; k < n; k += 1) at[k] = Math.max(0, (at[k] / far) * WASH_S + (0.025 * h[k]) / R);
    const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => at[a] - at[b]);
    wash = { hex, rgb, order, at, i: 0, t0: performance.now(), done }; last = 0;
  }
  function washStep(now) {
    const w = wash; const el = (now - w.t0) / 1000; const ow = nx * CELL; const [r, g, b] = w.rgb;
    for (; w.i < n && w.at[w.order[w.i]] <= el; w.i += 1) {
      const k = w.order[w.i]; const mask = s[k] > 0 ? UP : DOWN; const x0 = (k % nx) * CELL; const y0 = Math.floor(k / nx) * CELL;
      for (let yy = 0; yy < CELL; yy += 1) for (let xx = 0; xx < CELL; xx += 1) { // (the arrows stay, cut in a shade darker)
        const a = mask[yy * CELL + xx] === '#' ? 0.88 : 1; const p = ((y0 + yy) * ow + x0 + xx) * 4;
        pix[p] = r * a; pix[p + 1] = g * a; pix[p + 2] = b * a; pix[p + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0);
    if (w.i >= n && el > w.at[w.order[n - 1]] + 0.06) { const d = w.done; w.done = null; if (d) d(); }
  }
  function start() { if (reduce) { draw(); return; } last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  function reset() { layout(); warm(reduce ? 0 : -0.35); paintAll(); hot = hot.filter((k) => t - tf[k] < FLASH + 0.1); report(); draw(); }
  reset(); start();
  let pending = 0; addEventListener('resize', () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; reset(); }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else start(); });
  gate.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; });
  gate.addEventListener('pointerleave', () => { px = -1e4; py = -1e4; });

  /** A page pointed at (hover, focus, typing): lit in the list. */
  function show(name) { ways.forEach((el) => el.classList.toggle('on', el.querySelector('.gw-n').textContent === name)); }

  /* ---- the ways in ---- */
  const ways = [...gate.querySelectorAll('.gate-ways [data-key]')];
  const nameOf = (el) => el.querySelector('.gw-n').textContent;
  let leaving = false;
  const showRedraw = (name) => { show(name); if (reduce) draw(performance.now()); };
  ways.forEach((el) => {
    el.addEventListener('pointerenter', () => showRedraw(nameOf(el)));
    el.addEventListener('focus', () => showRedraw(nameOf(el)));
  });
  gate.querySelector('.gate-ways').addEventListener('pointerleave', () => showRedraw(ways.includes(document.activeElement) ? nameOf(document.activeElement) : null));
  addEventListener('keydown', (e) => {
    if (leaving || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key; const i = ways.indexOf(document.activeElement);
    if (k === 'ArrowUp' || k === 'ArrowDown') { // (nothing chosen yet: the first arrow picks an end)
      const d = k === 'ArrowUp' ? -1 : 1; const el = ways[i < 0 ? (d > 0 ? 0 : ways.length - 1) : (i + d + ways.length) % ways.length]; el.focus(); showRedraw(nameOf(el)); e.preventDefault();
    } else if (k === 'Escape') { if (i >= 0) document.activeElement.blur(); showRedraw(null); }
    else if (k.length === 1) {
      const el = ways.find((x) => x.dataset.key === k.toLowerCase()); if (!el) return;
      e.preventDefault(); if (document.activeElement === el) el.click(); else { el.focus({ preventScroll: true }); showRedraw(nameOf(el)); } // (no focus event in a window without focus)
    }
  });

  // the status bar: Paris's hour and the moon's phase (mean synodic month from the new moon of 2000-01-06 18:14 UTC)
  function bar() {
    gate.querySelector('.gb-time').textContent = `Paris ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}`;
    const P = 29.530588; const age = (((Date.now() / 864e5 - 10962.76) % P) + P) % P; const lit = Math.round(50 * (1 - Math.cos((2 * Math.PI * age) / P)));
    gate.querySelector('.gb-moon').textContent = `moon ${age < P / 2 ? 'waxing' : 'waning'} ${lit}%`;
  }
  bar(); setInterval(bar, 15000);

  /** The box's letters go to noise, then to nothing (0.45 s). */
  function scrambleOut() {
    const nodes = []; const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) nodes.push([walk.currentNode, walk.currentNode.nodeValue]);
    const t0 = performance.now(); const NOISE = '·:+×#%';
    const step = () => {
      const u = (performance.now() - t0) / 450;
      nodes.forEach(([nd, s]) => { nd.nodeValue = [...s].map((ch) => (ch === ' ' ? ' ' : rnd() < u * 1.6 - 0.6 ? ' ' : rnd() < u * 1.5 ? NOISE[Math.floor(rnd() * NOISE.length)] : ch)).join(''); });
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  /** A page chosen: the box's letters scramble away, then the page opens (a new tab or window: at once). */
  gate.addEventListener('click', (e) => {
    const a = e.target.closest('.gate-ways a'); if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault(); if (leaving) return; leaving = true; gate.classList.add('leaving'); show(nameOf(a)); scrambleOut();
    let gone = false; const go = () => { if (gone) return; gone = true; try { sessionStorage.setItem('via-gate', COLOUR[nameOf(a)] || '#000000'); } catch (x) {} location.href = a.href; };
    if (reduce) { go(); return; }
    const r = a.getBoundingClientRect(); const pointed = e.detail > 0 && e.clientX; // (a click: from the pointer; Enter: from the line's end)
    takeover(nameOf(a), pointed ? e.clientX : r.right, pointed ? e.clientY : r.top + r.height / 2, go);
    if (!raf) start();
    setTimeout(go, 1500); // (should the frames stop: a hidden tab)
  });
  // back here from the history (the browser kept the page as it was left, scrambled): start it over
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
}());
