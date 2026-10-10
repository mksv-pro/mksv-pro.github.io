/* The front gate: on a bare visit to the site (wide screen, no section, no preview), a console boots and
   asks how to visit: `visit castle`, `visit terminal` (the scrying engine in the castle's scriptorium:
   ui/05-engine.js opens it on the 'gate' event), the CV, the tour. Click a way, or type it (first letter
   completes, Tab completes, Enter runs; `--always` remembers).

   Behind it, site percolation on the console's own character grid: each cell has its own threshold, drawn
   once (quenched disorder); a smooth field sweeps over the grid (Gaussian swells on Lissajous paths, a
   travelling wave, one more under the pointer) and a cell lights up as the field passes its threshold;
   lit neighbours are joined by a box-drawing stroke where their bond (its own threshold) is open, so
   clusters are mazes, not a mesh; lone cells are glyphs.

   Pointing at a way draws its picture on the free side (gate-art.js, from _tools/gate_art.py: dot
   bitmaps, 2 x 4 dots a cell as braille): the dots come one by one, an invading cluster grown from a seed
   (the castle from its foot, the tour along its road), the CV printed line by line, the terminal typed;
   the field goes quiet where the front has passed. */
(function () {
  const root = document.documentElement;
  const gate = document.getElementById('gate');
  if (!gate || !root.classList.contains('gated')) { if (gate) gate.remove(); return; }
  const cv = gate.querySelector('canvas'); const ctx = cv.getContext('2d');
  const box = gate.querySelector('.gate-box');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CW = 11; const CH = 20; const BANDS = 8; // (css px: a character cell; alpha levels batched per stroke)
  const DX = CW / 2; const DY = CH / 4; // (a picture's dot pitch at full size)
  const FORM = 1.5; const FRONT = 0.14; const UNFORM = 0.35; // (s: a picture drawn, a dot's glow as the front passes, a picture undone)
  const INK = '207,200,184'; const ACC = '224,162,58';
  let W = 0; let H = 0; let dpr = 1; let raf = 0; let last = 0; let t = 0; let swells = []; let cells = []; let nx = 0; let ny = 0;
  let px = -1e4; let py = -1e4; let ph = 0; // the pointer's swell: where, how high (rises on a move, sinks when still)
  let pics = []; let atlas = null; // the pictures on screen: { name, art, x0, y0, k, t0, gone, quiet }
  const rnd = Math.random;
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  /* The pictures, decoded once: their dots and each dot's moment, 0..1 of the drawing. */
  const ARTS = {};
  Object.entries(window.GATE_ART || {}).forEach(([name, a]) => {
    if (a.mode === 'type') { ARTS[name] = typed(a.lines); return; }
    const bin = atob(a.bits); const dots = [];
    for (let i = 0; i < a.w * a.h; i += 1) if (bin.charCodeAt(i >> 3) & (128 >> (i & 7))) dots.push({ x: i % a.w, y: Math.floor(i / a.w), at: 1 });
    if (a.mode === 'scan') dots.forEach((d) => { d.at = 0.9 * (d.y / a.h) + 0.08 * (d.x / a.w) + 0.02 * rnd(); }); // (printed, top to bottom)
    else { // grown from the seed: breadth first over dots two apart at most (dithering leaves gaps), the unreached by distance
      const at = new Map(dots.map((d) => [d.y * a.w + d.x, d]));
      const s = a.seed === 'foot' ? dots.reduce((b, d) => (Math.abs(d.x - a.w / 2) + (a.h - d.y) * 2 < Math.abs(b.x - a.w / 2) + (a.h - b.y) * 2 ? d : b))
        : dots.reduce((b, d) => (Math.hypot(d.x - a.seed[0], d.y - a.seed[1]) < Math.hypot(b.x - a.seed[0], b.y - a.seed[1]) ? d : b));
      s.n = 0; const q = [s]; let max = 1;
      for (let h = 0; h < q.length; h += 1) {
        const d = q[h];
        for (let oy = -2; oy <= 2; oy += 1) for (let ox = -2; ox <= 2; ox += 1) {
          const e = at.get((d.y + oy) * a.w + d.x + ox); if (!e || e.n !== undefined || d.x + ox < 0 || d.x + ox >= a.w) continue;
          e.n = d.n + 1; max = Math.max(max, e.n); q.push(e);
        }
      }
      dots.forEach((d) => { d.at = 0.85 * (d.n !== undefined ? d.n / max : Math.min(1, Math.hypot(d.x - s.x, d.y - s.y) / Math.hypot(a.w, a.h))) + 0.15 * rnd(); });
    }
    ARTS[name] = { w: a.w, h: a.h, dots };
  });
  /** The terminal's picture: a window whose lines are typed (commands a key at a time, answers a line at once). */
  function typed(lines) {
    const steps = lines.reduce((k, [p, s]) => k + (p ? s.length + 3 : 4), 0); let n = 0;
    const rows = lines.map(([p, s]) => { // each character's moment: the prompt and an answer at once, a command key by key
      const at = [...(p + s)].map((_, c) => 0.12 + (0.88 * (p && c >= p.length ? n + c - p.length + 1 : n)) / steps);
      n += p ? s.length + 3 : 4; return { p, s, at };
    });
    const cols = Math.max(...lines.map(([p, s]) => p.length + s.length)) * 0.6 * 13 / CW + 4; // (13 px Plex Mono: 0.6 em a character)
    return { w: Math.ceil(cols * 2), h: (lines.length + 3) * 4, cols, rows: lines.length + 3, lines: rows, type: true };
  }

  /** The landscape behind the gate (hours.js's canvas, drawn already) as dots over the whole screen, each
   *  where its pixels are: what the castle will show. Built from the ground up, from the middle out;
   *  null when there is no landscape (a touch screen, not drawn yet). */
  const SCENE_FORM = 2.4;
  function sceneArt() {
    const src = [...document.querySelectorAll('.plate-img canvas')].find((c) => !c.classList.contains('room') && !c.classList.contains('twinkle') && c.width);
    if (!src || root.getAttribute('data-theme') !== 'hours') return null;
    const gw = Math.ceil(W / DX); const gh = Math.ceil(H / DY); const r = src.getBoundingClientRect();
    const off = document.createElement('canvas'); off.width = gw; off.height = gh; const o = off.getContext('2d', { willReadFrequently: true });
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    try { o.drawImage(src, r.left / DX, r.top / DY, r.width / DX, r.height / DY); } catch { return null; }
    const px = o.getImageData(0, 0, gw, gh).data; const n = gw * gh; const lum = new Float32Array(n); const vals = [];
    for (let i = 0; i < n; i += 1) { lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255; if (px[i * 4 + 3]) vals.push(lum[i]); }
    if (vals.length < 100) return null;
    vals.sort((a, b) => a - b); // histogram equalised: a night's dark meadow keeps as much detail as its sky
    const eq = new Float32Array(n); for (let i = 0; i < n; i += 1) { let l = 0; let h = vals.length - 1; while (l < h) { const m = (l + h) >> 1; if (vals[m] < lum[i]) l = m + 1; else h = m; } eq[i] = l / vals.length; }
    const a = new Float32Array(n); const L = (x, y) => eq[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))];
    for (let y = 0; y < gh; y += 1) for (let x = 0; x < gw; x += 1) { // brightness, lowered, and edges (Sobel), so outlines carry the picture
      const i = y * gw + x; if (!px[i * 4 + 3]) continue;
      const gx = L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1);
      const gy = L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1);
      a[i] = Math.min(1, Math.max(0, 0.42 * eq[i] ** 1.6 + 0.3 * Math.hypot(gx, gy)));
    }
    const lit = new Uint8Array(n); // Atkinson dithering, as the engraving of the terminal theme
    for (let y = 0; y < gh; y += 1) for (let x = 0; x < gw; x += 1) {
      const i = y * gw + x; const on = a[i] >= 0.5 ? 1 : 0; lit[i] = on; const e = (a[i] - on) / 8;
      if (x + 1 < gw) a[i + 1] += e; if (x + 2 < gw) a[i + 2] += e;
      if (y + 1 < gh) { if (x) a[i + gw - 1] += e; a[i + gw] += e; if (x + 1 < gw) a[i + gw + 1] += e; }
      if (y + 2 < gh) a[i + 2 * gw] += e;
    }
    const at = (x, y) => 0.68 * (1 - y / gh) + 0.17 * (Math.abs(x - gw / 2) / gw); const dots = [];
    const hue = (i) => { // the pixel's own colour, brought up to a dot's brightness and half mixed with the console's ink; 4 levels a channel
      const r0 = px[i * 4]; const g0 = px[i * 4 + 1]; const b0 = px[i * 4 + 2]; const m = Math.max(r0, g0, b0, 1); const q = (v, ink) => Math.round(((v / m) * 235 * 0.55 + ink * 0.45) / 64) * 64;
      return `${Math.min(255, q(r0, 207))},${Math.min(255, q(g0, 200))},${Math.min(255, q(b0, 184))}`;
    };
    for (let i = 0; i < n; i += 1) if (lit[i]) { const x = i % gw; const y = Math.floor(i / gw); dots.push({ x: x * DX + DX / 2 - 0.85, y: y * DY + DY / 2 - 0.85, at: at(x, y) + 0.15 * rnd(), c: hue(i) }); }
    dots.sort((p, q) => p.at - q.at);
    return { scene: true, form: SCENE_FORM, gw, gh, lit, at, dots };
  }

  function makeAtlas() { // the lone cells' glyphs, prerendered once per colour and band
    const chars = ['·', ':', '+', '×']; const c = document.createElement('canvas');
    c.width = CW * chars.length * dpr; c.height = CH * BANDS * 2 * dpr; const g = c.getContext('2d');
    g.scale(dpr, dpr); g.font = `13px "IBM Plex Mono", ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < BANDS * 2; k += 1) {
      g.fillStyle = `rgba(${k < BANDS ? INK : ACC},${(((k % BANDS) + 1) / BANDS).toFixed(3)})`;
      chars.forEach((ch, i) => g.fillText(ch, i * CW + CW / 2, k * CH + CH / 2 + 1));
    }
    return c;
  }
  /** Where picture `art` goes: centred in the room the console leaves, shrunk if it must (not below 0.6). */
  function placeOf(art) {
    if (art.scene) return { k: 1, x0: 0, y0: 0 }; // (the scene: where the landscape is)
    const br = box.getBoundingClientRect(); const l = br.right + 3 * CW; const fw = W - l - 2 * CW; const fh = H - 6 * CH;
    const k = Math.min(1, fw / (art.w * DX), fh / (art.h * DY)); if (k < 0.6) return null;
    return { k, x0: Math.round(l + (fw - art.w * DX * k) / 2), y0: Math.round((H - art.h * DY * k) / 2) };
  }
  /** The cells under a picture, each with the moment the front reaches it (from its dots, spread a little). */
  function quietOf(p) {
    if (p.art.scene) { // (the scene: every cell, as the front goes up the screen)
      const q = new Float32Array(nx * ny); for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) q[j * nx + i] = p.art.at((i * CW + CW / 2) / DX, (j * CH + CH / 2) / DY) - 0.02;
      return { c0: 0, r0: 0, cw: nx, rh: ny, q };
    }
    const { art, x0, y0, k } = p; const c0 = Math.floor(x0 / CW) - 2; const r0 = Math.floor(y0 / CH) - 1;
    const cw = Math.ceil((art.w * DX * k) / CW) + 5; const rh = Math.ceil((art.h * DY * k) / CH) + 3; const q = new Float32Array(cw * rh).fill(2);
    const mark = (x, y, at) => { const i = Math.floor((x - c0 * CW) / CW); const j = Math.floor((y - r0 * CH) / CH); if (i >= 0 && i < cw && j >= 0 && j < rh) q[j * cw + i] = Math.min(q[j * cw + i], at); };
    if (!art.type) art.dots.forEach((d) => mark(x0 + d.x * DX * k, y0 + d.y * DY * k, d.at));
    if (art.type) for (let j = 0; j < rh; j += 1) for (let i = 0; i < cw; i += 1) q[j * cw + i] = Math.min(q[j * cw + i], 0.1); // (a window: quiet all over)
    for (let pass = 0; pass < 3; pass += 1) for (let j = 0; j < rh; j += 1) for (let i = 0; i < cw; i += 1) { // (and round it, a little later)
      let m = q[j * cw + i]; if (i) m = Math.min(m, q[j * cw + i - 1] + 0.05); if (j) m = Math.min(m, q[(j - 1) * cw + i] + 0.05);
      if (i < cw - 1) m = Math.min(m, q[j * cw + i + 1] + 0.05); if (j < rh - 1) m = Math.min(m, q[(j + 1) * cw + i] + 0.05); q[j * cw + i] = m;
    }
    return { c0, r0, cw, rh, q };
  }
  function show(name) { // a way pointed at (hover, focus, typing): lit in the list and drawn behind
    ways.forEach((el) => el.classList.toggle('on', el.querySelector('.gw-n').textContent === name));
    const cur = pics.find((p) => !p.gone);
    if (cur && cur.name === name) return;
    if (cur) cur.gone = performance.now();
    const art = name && (((name === 'castle' || name === 'tour') && sceneArt()) || ARTS[name] || (name === 'tour' && ARTS.castle)); const at = art && placeOf(art); if (!at) return;
    const p = { name, art, ...at, t0: performance.now() + (cur ? 150 : 0), gone: 0 }; p.quiet = quietOf(p); pics.push(p);
  }
  /** How far picture p is drawn now: 0..1+ forming; while going, its own clock runs back. */
  const formOf = (p) => (p.art.form || FORM) / (p.fast || 1);
  const clockOf = (p, now) => (reduce ? (p.gone ? -1 : 2) : p.gone ? Math.min((p.gone - p.t0) / 1000 / formOf(p), 1.2) - (now - p.gone) / 1000 / UNFORM * 1.2 : (now - p.t0) / 1000 / formOf(p));
  function hurry(p, fast) { const c = clockOf(p, performance.now()); p.fast = fast; p.t0 = performance.now() - c * formOf(p) * 1000; } // (the same moment, the clock faster)

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const m = Math.max(W, H);
    swells = Array.from({ length: 5 }, () => ({ // (centre's path, its periods in seconds, its width, its height)
      cx: rnd(), cy: rnd(), ax: 0.3 + rnd() * 0.3, ay: 0.25 + rnd() * 0.3, px: 16 + rnd() * 14, py: 20 + rnd() * 16,
      ph: rnd() * 6.28, s: m * (0.06 + rnd() * 0.07), h: 0.5 + rnd() * 0.5 }));
    nx = Math.ceil(W / CW) + 1; ny = Math.ceil(H / CH) + 1;
    cells = Array.from({ length: nx * ny }, () => ({ u: 0.3 + 0.6 * rnd(), b: 0.55 + 0.45 * rnd(), bo: [rnd(), rnd()], on: 0, hot: 0 })); // (bo: its two bonds' own thresholds)
    atlas = makeAtlas();
    pics = pics.filter((p) => !p.gone).map((p) => { const at = placeOf(p.art); if (!at) return null; const q = { ...p, ...at }; q.quiet = quietOf(q); return q; }).filter(Boolean);
  }
  /** The field at (x, y), now: roughly 0 to 1.2. */
  function field(x, y) {
    let v = 0.16 + 0.12 * Math.sin(x * 0.006 - y * 0.004 + t * 0.45); // a long wave crossing the screen
    swells.forEach((s) => {
      const sx = (s.cx + s.ax * Math.sin((6.283 * t) / s.px + s.ph)) * W; const sy = (s.cy + s.ay * Math.sin((6.283 * t) / s.py + s.ph * 1.7)) * H;
      v += s.h * Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / (2 * s.s * s.s));
    });
    return v;
  }
  function drawField(now) {
    const grid = new Path2D(); // the empty grid: a faint point a cell
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) grid.rect(i * CW + CW / 2, j * CH + CH / 2, 1, 1);
    ctx.fillStyle = 'rgba(207,200,184,.07)'; ctx.fill(grid);
    const quiets = pics.map((p) => [p.quiet, clockOf(p, now)]);
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const p = cells[j * nx + i]; const x = i * CW + CW / 2; const y = j * CH + CH / 2;
      let v = field(x, y); const hot = ph * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * 120 * 120));
      v += hot * 0.9;
      quiets.forEach(([q, c]) => { // (where a picture's front has passed, the field lies down)
        const a = i - q.c0; const b = j - q.r0; if (a < 0 || b < 0 || a >= q.cw || b >= q.rh) return;
        v *= 1 - 0.92 * smooth(q.q[b * q.cw + a] - 0.05, q.q[b * q.cw + a] + 0.1, c);
      });
      p.on = smooth(p.u - 0.07, p.u + 0.07, v); p.hot = hot; p.joined = false;
    }
    const lines = Array.from({ length: BANDS * 2 }, () => new Path2D());
    const glyphs = [];
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const p = cells[j * nx + i]; if (p.on < 0.03) continue;
      const x = i * CW + CW / 2; const y = j * CH + CH / 2; const warm = p.hot > 0.35 ? BANDS : 0;
      let deg = 0;
      [[i + 1, j], [i, j + 1]].forEach(([a, b], d) => { // right and down neighbours: one stroke each, if their bond is open
        if (a >= nx || b >= ny) return; const q = cells[b * nx + a]; const s = Math.min(p.on, q.on);
        if (s < 0.3 || p.bo[d] > 0.62 * s) return; deg += 1; q.joined = true;
        const k = Math.min(BANDS - 1, Math.floor(s * p.b * BANDS)); lines[k + warm].moveTo(x, y); lines[k + warm].lineTo(d ? x : x + CW, d ? y + CH : y);
      });
      if (!deg && !p.joined) glyphs.push([x, y, p.on, warm, p.u]); // (a lone cell: a glyph)
    }
    ctx.lineWidth = 1;
    lines.forEach((path, k) => { ctx.strokeStyle = `rgba(${k < BANDS ? INK : ACC},${((((k % BANDS) + 1) / BANDS) * 0.55).toFixed(3)})`; ctx.stroke(path); });
    glyphs.forEach(([x, y, on, warm, u]) => {
      const g = on > 0.7 ? (u > 0.6 ? 3 : 2) : on > 0.35 ? 1 : 0; const k = Math.min(BANDS - 1, Math.floor(on * BANDS)) + warm;
      ctx.drawImage(atlas, g * CW * dpr, k * CH * dpr, CW * dpr, CH * dpr, x - CW / 2, y - CH / 2, CW, CH);
    });
  }
  function drawPics(now) {
    pics = pics.filter((p) => !p.gone || clockOf(p, now) > -0.05);
    pics.forEach((p) => {
      const c = clockOf(p, now); const { art, x0, y0, k } = p; const f = FRONT / (art.form || FORM);
      if (art.scene) { drawScene(p, c); return; }
      if (art.type) { drawTyped(p, c); return; }
      const settled = new Path2D(); const front = new Path2D(); const r = Math.max(1.2, 1.7 * k);
      art.dots.forEach((d) => {
        if (c < d.at) return; const x = x0 + d.x * DX * k; const y = y0 + d.y * DY * k;
        if (c < d.at + f && !p.gone) front.rect(x - 0.6, y - 0.6, r + 1.2, r + 1.2); else settled.rect(x, y, r, r);
      });
      ctx.fillStyle = `rgba(${INK},.92)`; ctx.fill(settled); ctx.fillStyle = `rgba(${ACC},1)`; ctx.fill(front);
    });
  }
  /** The scene: settled dots kept on their own canvas (tens of thousands), the front drawn each frame. */
  function drawScene(p, c) {
    const ds = p.art.dots; const f = FRONT / p.art.form;
    if (!p.buf) { p.buf = document.createElement('canvas'); p.buf.width = cv.width; p.buf.height = cv.height; p.bx = p.buf.getContext('2d'); p.bx.setTransform(dpr, 0, 0, dpr, 0, 0); p.ptr = 0; }
    if (!p.gone) { // (the dots settled since the last frame, a path a colour)
      const by = new Map(); while (p.ptr < ds.length && ds[p.ptr].at <= c - f) { const d = ds[p.ptr++]; if (!by.has(d.c)) by.set(d.c, new Path2D()); by.get(d.c).rect(d.x, d.y, 1.8, 1.8); }
      by.forEach((path, col) => { p.bx.fillStyle = `rgba(${col},.95)`; p.bx.fill(path); });
    }
    ctx.globalAlpha = p.gone ? Math.min(1, Math.max(0, c)) : 1; ctx.drawImage(p.buf, 0, 0, W, H); ctx.globalAlpha = 1;
    if (p.gone) return;
    const front = new Path2D(); for (let i = p.ptr; i < ds.length && ds[i].at <= c; i += 1) front.rect(ds[i].x - 0.6, ds[i].y - 0.6, 2.9, 2.9);
    ctx.fillStyle = `rgb(${ACC})`; ctx.fill(front);
  }
  /* The castle chosen: the dots develop into the landscape's own pixels, the sky first, the ground last;
     each lit dot flares amber, then its cell opens on the page beneath (the gate's canvas is cut away). */
  let dev = null; const DEV = 1.6; const FLASH = 0.07;
  function develop(p, done) {
    const { gw, gh } = p.art; const n = gw * gh; const tt = new Float32Array(n);
    for (let i = 0; i < n; i += 1) tt[i] = 0.72 * (Math.floor(i / gw) / gh) + 0.28 * rnd();
    const order = Uint32Array.from({ length: n }, (_, i) => i).sort((a, b) => tt[a] - tt[b]);
    const mask = document.createElement('canvas'); mask.width = cv.width; mask.height = cv.height; const m = mask.getContext('2d'); m.setTransform(dpr, 0, 0, dpr, 0, 0);
    dev = { p, tt, order, mask, m, ptr: 0, t0: performance.now(), done }; gate.classList.add('developing');
  }
  function drawDevelop(now) {
    const e = (now - dev.t0) / 1000 / DEV; const { p, tt, order, m } = dev; const { gw, lit } = p.art;
    ctx.fillStyle = '#0b0a08'; ctx.fillRect(0, 0, W, H); drawScene(p, 9);
    const holes = new Path2D(); while (dev.ptr < order.length && tt[order[dev.ptr]] <= e - FLASH) { const i = order[dev.ptr++]; holes.rect((i % gw) * DX - 0.25, Math.floor(i / gw) * DY - 0.25, DX + 0.5, DY + 0.5); } m.fill(holes);
    const fl = new Path2D(); for (let k = dev.ptr; k < order.length && tt[order[k]] <= e; k += 1) { const i = order[k]; if (lit[i]) fl.rect((i % gw) * DX + DX / 2 - 1.5, Math.floor(i / gw) * DY + DY / 2 - 1.5, 3, 3); }
    ctx.fillStyle = `rgb(${ACC})`; ctx.fill(fl);
    ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(dev.mask, 0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    if (e > 1 + FLASH && dev.done) { const d = dev.done; dev.done = null; d(); }
  }
  function drawTyped(p, c) { // the window: its frame drawn round, then its lines typed
    const { art, x0, y0, k } = p; const w = art.cols * CW * k; const h = art.rows * CH * k;
    const per = 2 * (w + h); const run = Math.min(1, c / 0.12) * per; // (the frame, drawn from its top left corner)
    ctx.strokeStyle = `rgba(${INK},.7)`; ctx.lineWidth = 1; ctx.beginPath();
    const pts = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]]; let left = run;
    ctx.moveTo(x0 + 0.5, y0 + 0.5);
    for (let s = 1; s < pts.length && left > 0; s += 1) {
      const [ax, ay] = pts[s - 1]; const [bx, by] = pts[s]; const L = Math.hypot(bx - ax, by - ay); const u = Math.min(1, left / L);
      ctx.lineTo(ax + (bx - ax) * u + 0.5, ay + (by - ay) * u + 0.5); left -= L;
    }
    ctx.stroke();
    if (c > 0.12) { ctx.beginPath(); ctx.moveTo(x0, y0 + CH * k * 1.2); ctx.lineTo(x0 + w * Math.min(1, (c - 0.12) / 0.08), y0 + CH * k * 1.2); ctx.stroke(); }
    ctx.font = `${Math.round(13 * k)}px "IBM Plex Mono", ui-monospace, monospace`; ctx.textBaseline = 'middle';
    if (c > 0.1) { ctx.fillStyle = `rgba(${INK},.55)`; ctx.fillText('scrying engine', x0 + CW * k, y0 + CH * k * 0.62); }
    let cur = null; const lx = x0 + 2 * CW * k;
    art.lines.forEach(({ p: ps, s, at }, r) => {
      const n = at.filter((a) => c >= a).length; if (!n) return; const y = y0 + (r + 2.15) * CH * k;
      const a = (ps + s).slice(0, n); const pw = ctx.measureText(a.slice(0, ps.length)).width;
      ctx.fillStyle = `rgb(${ACC})`; ctx.fillText(a.slice(0, ps.length), lx, y);
      ctx.fillStyle = ps ? '#fff' : `rgba(${INK},.8)`; ctx.fillText(a.slice(ps.length), lx + pw, y);
      cur = [lx + ctx.measureText(a).width + 1, y];
    });
    if (cur && (c < 1 || Math.floor(performance.now() / 530) % 2)) { ctx.fillStyle = `rgb(${ACC})`; ctx.fillRect(cur[0], cur[1] - CH * k * 0.32, CW * k * 0.62, CH * k * 0.62); } // (the cursor, after the last key)
  }
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dev) { drawDevelop(now); return; }
    ctx.fillStyle = '#0b0a08'; ctx.fillRect(0, 0, W, H);
    drawField(now); drawPics(now);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (last && now - last < 30) return; // (about 30 frames a second: the field is slow)
    const dt = Math.min(0.06, last ? (now - last) / 1000 : 0.033); last = now; t += dt;
    ph = Math.max(0, ph - dt * 0.25);
    draw(now);
  }
  function start() { if (reduce) { draw(performance.now()); return; } last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  t = rnd() * 100; resize(); start();
  addEventListener('resize', () => { resize(); if (reduce) draw(performance.now()); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (root.classList.contains('gated')) start(); });
  gate.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; ph = Math.min(1, ph + 0.08); });

  /* ---- the console: boot, the prompt, the ways ---- */
  const ways = [...gate.querySelectorAll('.gate-ways [data-key]')];
  const nameOf = (el) => el.querySelector('.gw-n').textContent;
  const live = () => ways.filter((el) => el.offsetParent !== null); // (the tour is hidden on touch screens)
  const typedEl = gate.querySelector('.gate-typed'); const ghostEl = gate.querySelector('.gate-ghost'); const errEl = gate.querySelector('.gate-err');
  let typedS = ''; let leaving = false; let quiet = false; // (quiet: the boot's own focus, no picture yet)
  const showRedraw = (name) => { show(name); if (reduce) draw(performance.now()); };
  ways.forEach((el) => {
    el.addEventListener('pointerenter', () => showRedraw(nameOf(el)));
    el.addEventListener('focus', () => { if (!quiet) showRedraw(nameOf(el)); });
  });
  gate.querySelector('.gate-ways').addEventListener('pointerleave', () => showRedraw(typedS ? match(typedS) : document.activeElement && ways.includes(document.activeElement) ? nameOf(document.activeElement) : null));
  const match = (s) => { const w = s.trim().split(/\s+/)[0]; const el = w && live().find((x) => nameOf(x).startsWith(w)); return el ? nameOf(el) : null; };
  function render() {
    typedEl.textContent = typedS;
    const w = typedS.split(/\s+/)[0]; const full = match(typedS);
    ghostEl.textContent = !typedS ? '' : !typedS.includes(' ') && full ? full.slice(w.length) : typedS.endsWith(' ') && full === w && full !== 'cv' ? '--always' : '';
    showRedraw(full);
  }
  function run(text) {
    const words = text.trim().split(/\s+/); const w = words[0]; const el = live().find((x) => nameOf(x) === w || (w.length === 1 && x.dataset.key === w));
    if (!el) { errEl.textContent = w === 'help' || w === '?' ? 'ways: castle, terminal, cv, tour (add --always to be remembered)' : `visit: no way called '${w}'; try castle, terminal, cv or tour`; typedS = ''; render(); return; }
    errEl.textContent = '';
    if (words.includes('--always') || words.includes('-a')) gate.querySelector('#gate-keep').checked = true;
    el.click();
  }

  // the boot: each line printed at once, a beat apart (any key or click: all of it now)
  const lns = [...gate.querySelectorAll('.gate-ln')]; const beats = [0, 380, 900, 1060, 1140, 1220, 1300, 1300, 1450, 1520];
  let booted = false; const timers = [];
  function boot() {
    if (booted) return; booted = true; timers.forEach(clearTimeout); gate.classList.add('booted');
  }
  if (reduce) boot();
  else { lns.forEach((l, k) => timers.push(setTimeout(() => l.classList.add('shown'), beats[Math.min(k, beats.length - 1)]))); timers.push(setTimeout(boot, 1600)); }
  gate.addEventListener('pointerdown', boot);

  // while the gate is up, the page's single-key shortcuts behind it stay quiet; keys go to the prompt
  const hush = (e) => {
    if (!root.classList.contains('gated')) return;
    e.stopImmediatePropagation();
    if (leaving || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (!booted) { boot(); if (k.length !== 1) { e.preventDefault(); return; } }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) {
      const bs = live(); const i = bs.indexOf(document.activeElement); const d = k === 'ArrowUp' || k === 'ArrowLeft' ? -1 : 1;
      typedS = ''; render(); bs[i < 0 ? (d > 0 ? 0 : bs.length - 1) : (i + d + bs.length) % bs.length].focus(); e.preventDefault(); // (nothing chosen on arrival: the first arrow picks an end)
    } else if (k === 'Tab' && ghostEl.textContent) { typedS += ghostEl.textContent; render(); e.preventDefault(); }
    else if (k === 'Enter' && typedS.trim()) { run(typedS); e.preventDefault(); }
    else if (k === 'Backspace') { typedS = typedS.slice(0, -1); render(); e.preventDefault(); }
    else if (k === 'Escape') { typedS = ''; errEl.textContent = ''; render(); }
    else if (k === ' ' && !typedS) { /* (Space on a focused way: its default action) */ }
    else if (k.length === 1 && typedS.length < 40) {
      const one = !typedS && live().find((x) => x.dataset.key === k.toLowerCase()); // (a way's key on an empty prompt: the whole name)
      typedS = one ? nameOf(one) : typedS + k; errEl.textContent = ''; render(); e.preventDefault();
      const el = live().find((x) => nameOf(x) === match(typedS)); if (el) { quiet = true; el.focus({ preventScroll: true }); quiet = false; }
    }
  };
  addEventListener('keydown', hush, true);

  // the status bar: Paris's hour and the moon's phase (mean synodic month from the new moon of 2000-01-06 18:14 UTC)
  function bar() {
    gate.querySelector('.gb-time').textContent = `Paris ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}`;
    const P = 29.530588; const age = (((Date.now() / 864e5 - 10962.76) % P) + P) % P; const lit = Math.round(50 * (1 - Math.cos((2 * Math.PI * age) / P)));
    gate.querySelector('.gb-moon').textContent = `moon ${age < P / 2 ? 'waxing' : 'waning'} ${lit}%`;
  }
  bar(); const barT = setInterval(bar, 15000);

  /** The console's letters go to noise, then to nothing (0.45 s). */
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
  function close(way) {
    if (leaving) return; leaving = true; boot();
    if (gate.querySelector('#gate-keep').checked && way !== 'tour') try { localStorage.setItem('gate', way); } catch { /* (no storage: it asks again) */ }
    const finish = () => {
      cancelAnimationFrame(raf); clearInterval(barT); root.classList.remove('gated'); gate.remove(); removeEventListener('keydown', hush, true);
      dispatchEvent(new CustomEvent('gate', { detail: way }));
    };
    if (reduce) { gate.classList.add('out'); finish(); return; }
    if (way === 'terminal') { gate.classList.add('out-term'); setTimeout(finish, 1050); return; } // (the screen switched off, then the engine in the castle)
    // the castle (or the tour): the console scrambles away, the landscape in dots finishes building, faster, then develops
    show(way === 'tour' ? 'tour' : 'castle'); gate.classList.add('leaving'); scrambleOut();
    const p = pics.find((q) => !q.gone);
    if (!p || !p.art.scene) { setTimeout(() => gate.classList.add('out'), 700); setTimeout(finish, 1150); return; } // (no landscape to develop: a fade)
    hurry(p, 1.8); const rest = Math.max(0, formOf(p) * 1000 * (1.05 - clockOf(p, performance.now())));
    setTimeout(() => develop(p, finish), Math.max(500, rest));
  }
  gate.addEventListener('click', (e) => { const b = e.target.closest('[data-gate]'); if (b) close(b.dataset.gate); });
}());
