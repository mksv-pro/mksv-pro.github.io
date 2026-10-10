/* The front gate: on a bare visit to the site (wide screen, no section, no preview), a console boots and
   asks how to visit: `visit castle`, `visit terminal` (the scrying engine in the castle's scriptorium:
   ui/05-engine.js opens it on the 'gate' event), the CV, the tour. Click a way, or type it (first letter
   completes, Tab completes, Enter runs; `--always` remembers).

   Behind it, site percolation on the console's own character grid: each cell has its own threshold, drawn
   once (quenched disorder); a smooth field sweeps over the grid (Gaussian swells on Lissajous paths, a
   travelling wave, one more under the pointer) and a cell lights up as the field passes its threshold;
   lit neighbours are joined by a box-drawing stroke where their bond (its own threshold) is open, so
   clusters are mazes, not a mesh; lone cells are glyphs. Pointing at a way condenses the
   field into its picture in ASCII (the castle, a terminal window), on the free side of the screen. */
(function () {
  const root = document.documentElement;
  const gate = document.getElementById('gate');
  if (!gate || !root.classList.contains('gated')) { if (gate) gate.remove(); return; }
  const cv = gate.querySelector('canvas'); const ctx = cv.getContext('2d');
  const box = gate.querySelector('.gate-box');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CW = 11; const CH = 20; const BANDS = 8; // (css px: a character cell; alpha levels batched per stroke)
  const INK = '207,200,184'; const ACC = '224,162,58';
  let W = 0; let H = 0; let dpr = 1; let raf = 0; let last = 0; let t = 0; let swells = []; let cells = []; let nx = 0; let ny = 0;
  let px = -1e4; let py = -1e4; let ph = 0; // the pointer's swell: where, how high (rises on a move, sinks when still)
  let pic = null; let picM = 0; let picOn = null; let atlas = null; // the way's picture: { mask, c0, r0 }, its weight 0..1, which way
  const rnd = Math.random;
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  // the ways' pictures, one character a cell ('#': lit; 'o': a lone glyph)
  const ART = {
    castle: [
      '                 #   #   #',
      '                 #########',
      '                 #       #',
      '   # # #         #   #   #         # # #',
      '   #####         #  ###  #         #####',
      '   #   #  # # #  #  # #  #  # # #  #   #',
      '   #   #  #####  #       #  #####  #   #',
      '   #   ####   ####       ####   ####   #',
      '   #   #         #  ###  #         #   #',
      '   #   #   ###   #  # #  #   ###   #   #',
      '   #   #   # #   #  # #  #   # #   #   #',
      '#########################################'],
    terminal: [
      '##################################',
      '# o o o                          #',
      '##################################',
      '#                                #',
      '#  o ####                        #',
      '#                                #',
      '#  o ##########  #####           #',
      '#                                #',
      '#  o ######  #       ##          #',
      '#                                #',
      '##################################'],
    tour: [
      '            o',
      '           ###',
      '          #   #',
      '         #  o  #',
      '          #   #',
      '           ###',
      '            #',
      '            #',
      '   #######################'],
  };

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
  function placePic() { // the hovered way's picture, centred in the room the console leaves free
    if (!picOn || !ART[picOn]) { pic = null; return; }
    const art = ART[picOn]; const aw = Math.max(...art.map((l) => l.length)); const ah = art.length;
    const br = box.getBoundingClientRect(); const free0 = Math.ceil(br.right / CW) + 3; const free = nx - 2 - free0;
    if (free < aw) { pic = null; return; } // (no room beside the console: no picture)
    const c0 = free0 + Math.floor((free - aw) / 2); const r0 = Math.floor((ny - ah) / 2);
    const mask = new Map(); art.forEach((l, r) => [...l].forEach((ch, c) => { if (ch !== ' ') mask.set((r0 + r) * nx + c0 + c, ch); }));
    pic = { mask, c0, r0, c1: c0 + aw, r1: r0 + ah };
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const m = Math.max(W, H);
    swells = Array.from({ length: 5 }, () => ({ // (centre's path, its periods in seconds, its width, its height)
      cx: rnd(), cy: rnd(), ax: 0.3 + rnd() * 0.3, ay: 0.25 + rnd() * 0.3, px: 16 + rnd() * 14, py: 20 + rnd() * 16,
      ph: rnd() * 6.28, s: m * (0.06 + rnd() * 0.07), h: 0.5 + rnd() * 0.5 }));
    nx = Math.ceil(W / CW) + 1; ny = Math.ceil(H / CH) + 1;
    cells = Array.from({ length: nx * ny }, () => ({ u: 0.3 + 0.6 * rnd(), b: 0.55 + 0.45 * rnd(), bo: [rnd(), rnd()], on: 0, hot: 0 })); // (bo: its two bonds' own thresholds)
    atlas = makeAtlas(); placePic();
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
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0b0a08'; ctx.fillRect(0, 0, W, H);
    const grid = new Path2D(); // the empty grid: a faint point a cell
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) grid.rect(i * CW + CW / 2, j * CH + CH / 2, 1, 1);
    ctx.fillStyle = 'rgba(207,200,184,.07)'; ctx.fill(grid);
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const p = cells[j * nx + i]; const x = i * CW + CW / 2; const y = j * CH + CH / 2;
      let v = field(x, y); let hot = ph * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * 120 * 120));
      v += hot * 0.9;
      if (pic && picM > 0 && i >= pic.c0 - 3 && i < pic.c1 + 3 && j >= pic.r0 - 2 && j < pic.r1 + 2) { // (the picture: lit where drawn, quiet round it)
        const ch = pic.mask.get(j * nx + i); v = v * (1 - picM) + picM * (ch === '#' ? 1.3 : ch === 'o' ? 0.66 : 0);
        if (ch) hot = Math.max(hot, picM * 0.6); // (drawn in the accent)
      }
      p.on = smooth(p.u - 0.07, p.u + 0.07, v); p.v = v; p.hot = hot; p.joined = false;
    }
    const lines = Array.from({ length: BANDS * 2 }, () => new Path2D());
    const glyphs = [];
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const p = cells[j * nx + i]; if (p.on < 0.03) continue;
      const x = i * CW + CW / 2; const y = j * CH + CH / 2; const warm = p.hot > 0.35 ? BANDS : 0;
      let deg = 0;
      [[i + 1, j], [i, j + 1]].forEach(([a, b], d) => { // right and down neighbours: one stroke each
        if (a >= nx || b >= ny) return; const q = cells[b * nx + a]; const s = Math.min(p.on, q.on);
        if (s < 0.3 || p.bo[d] > (pic && pic.mask.has(j * nx + i) && pic.mask.has(b * nx + a) ? 1 : 0.62) * s) return; deg += 1; q.joined = true; // (the picture's strokes always join)
        const k = Math.min(BANDS - 1, Math.floor(s * p.b * BANDS)); lines[k + warm].moveTo(x, y); lines[k + warm].lineTo(d ? x : x + CW, d ? y + CH : y);
      });
      if (!deg && !(p.joined)) glyphs.push([x, y, p.on, warm, p.u]); // (a lone cell: a glyph)
    }
    ctx.lineWidth = 1;
    lines.forEach((path, k) => { ctx.strokeStyle = `rgba(${k < BANDS ? INK : ACC},${((((k % BANDS) + 1) / BANDS) * 0.55).toFixed(3)})`; ctx.stroke(path); });
    glyphs.forEach(([x, y, on, warm, u]) => {
      const g = on > 0.7 ? (u > 0.6 ? 3 : 2) : on > 0.35 ? 1 : 0; const k = Math.min(BANDS - 1, Math.floor(on * BANDS)) + warm;
      ctx.drawImage(atlas, g * CW * dpr, k * CH * dpr, CW * dpr, CH * dpr, x - CW / 2, y - CH / 2, CW, CH);
    });
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (last && now - last < 30) return; // (about 30 frames a second: the field is slow)
    const dt = Math.min(0.06, last ? (now - last) / 1000 : 0.033); last = now; t += dt;
    ph = Math.max(0, ph - dt * 0.25);
    picM += ((picOn && pic ? 1 : 0) - picM) * Math.min(1, dt * 5);
    draw();
  }
  function start() { if (reduce) { draw(); return; } last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  t = rnd() * 100; resize(); start();
  addEventListener('resize', () => { resize(); if (reduce) draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (root.classList.contains('gated')) start(); });
  gate.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; ph = Math.min(1, ph + 0.08); });

  /* ---- the console: boot, the prompt, the ways ---- */
  const ways = [...gate.querySelectorAll('.gate-ways [data-key]')];
  const nameOf = (el) => el.querySelector('.gw-n').textContent;
  const live = () => ways.filter((el) => el.offsetParent !== null); // (the tour is hidden on touch screens)
  const typedEl = gate.querySelector('.gate-typed'); const ghostEl = gate.querySelector('.gate-ghost'); const errEl = gate.querySelector('.gate-err');
  let typed = ''; let leaving = false; let quiet = false; // (quiet: the boot's own focus, no picture yet)
  function show(name) { // a way pointed at (hover, focus, typing): lit in the list and pictured behind
    ways.forEach((el) => el.classList.toggle('on', nameOf(el) === name));
    const art = name === 'cv' ? null : name; if (art !== picOn) { picOn = art; placePic(); }
  }
  ways.forEach((el) => {
    el.addEventListener('pointerenter', () => show(nameOf(el)));
    el.addEventListener('focus', () => { if (!quiet) show(nameOf(el)); });
  });
  gate.querySelector('.gate-ways').addEventListener('pointerleave', () => show(typed ? match(typed) : document.activeElement && ways.includes(document.activeElement) ? nameOf(document.activeElement) : null));
  const match = (s) => { const w = s.trim().split(/\s+/)[0]; const el = w && live().find((x) => nameOf(x).startsWith(w)); return el ? nameOf(el) : null; };
  function render() {
    typedEl.textContent = typed;
    const w = typed.split(/\s+/)[0]; const full = match(typed);
    ghostEl.textContent = !typed ? '' : !typed.includes(' ') && full ? full.slice(w.length) : typed.endsWith(' ') && full === w && full !== 'cv' ? '--always' : '';
    show(full);
  }
  function run(text) {
    const words = text.trim().split(/\s+/); const w = words[0]; const el = live().find((x) => nameOf(x) === w || (w.length === 1 && x.dataset.key === w));
    if (!el) { errEl.textContent = w === 'help' || w === '?' ? 'ways: castle, terminal, cv, tour (add --always to be remembered)' : `visit: no way called '${w}'; try castle, terminal, cv or tour`; typed = ''; render(); return; }
    errEl.textContent = '';
    if (words.includes('--always') || words.includes('-a')) gate.querySelector('#gate-keep').checked = true;
    el.click();
  }

  // the boot: each line printed at once, a beat apart (any key or click: all of it now)
  const lns = [...gate.querySelectorAll('.gate-ln')]; const beats = [0, 380, 900, 1060, 1140, 1220, 1300, 1300, 1450, 1520];
  let booted = false; const timers = [];
  function boot() {
    if (booted) return; booted = true; timers.forEach(clearTimeout); gate.classList.add('booted');
    if (!document.activeElement || !gate.contains(document.activeElement)) { quiet = true; live()[0].focus({ preventScroll: true }); quiet = false; }
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
      typed = ''; render(); bs[(i + d + bs.length) % bs.length].focus(); e.preventDefault();
    } else if (k === 'Tab' && ghostEl.textContent) { typed += ghostEl.textContent; render(); e.preventDefault(); }
    else if (k === 'Enter' && typed.trim()) { run(typed); e.preventDefault(); }
    else if (k === 'Backspace') { typed = typed.slice(0, -1); render(); e.preventDefault(); }
    else if (k === 'Escape') { typed = ''; errEl.textContent = ''; render(); }
    else if (k === ' ' && !typed) { /* (Space on a focused way: its default action) */ }
    else if (k.length === 1 && typed.length < 40) {
      const one = !typed && live().find((x) => x.dataset.key === k.toLowerCase()); // (a way's key on an empty prompt: the whole name)
      typed = one ? `${nameOf(one)}` : typed + k; errEl.textContent = ''; render(); e.preventDefault();
      const el = live().find((x) => nameOf(x) === match(typed)); if (el) el.focus({ preventScroll: true });
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

  function close(way) {
    if (leaving) return; leaving = true; boot();
    if (gate.querySelector('#gate-keep').checked && way !== 'tour') try { localStorage.setItem('gate', way); } catch { /* (no storage: it asks again) */ }
    let ms = reduce ? 0 : 900;
    if (way === 'terminal' && !reduce) { gate.classList.add('out-term'); ms = 1050; } // (the screen switched off, then the engine in the castle)
    else { picOn = way === 'tour' ? 'tour' : 'castle'; placePic(); gate.classList.add('out'); if (reduce) start(); } // (the castle drawn in the field, then gone)
    setTimeout(() => {
      cancelAnimationFrame(raf); clearInterval(barT); root.classList.remove('gated'); gate.remove(); removeEventListener('keydown', hush, true);
      dispatchEvent(new CustomEvent('gate', { detail: way }));
    }, ms);
  }
  gate.addEventListener('click', (e) => { const b = e.target.closest('[data-gate]'); if (b) close(b.dataset.gate); });
  quiet = true; live()[0].focus({ preventScroll: true }); quiet = false;
}());
