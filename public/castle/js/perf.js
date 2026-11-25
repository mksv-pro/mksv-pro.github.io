/* The ?perf overlay (also the `perf` command): what a frame costs, measured in this browser and shown
   only here (nothing is sent). The castle's last 256 frames as stacked bars (the simulation's step, the
   drawing, the copy to the canvas: Hours.perf), the screen's own frame interval, the interactions'
   latency (Event Timing: INP is the 98th percentile of the slowest event of each interaction), and,
   where the browser has it (Chromium), the long animation frames and the script that made each. */
'use strict';
(() => {
  const W = 256; const H = 64; const BUDGET = 16.7; // ms: one frame at 60 Hz
  let box = null; let cv = null; let g = null; let raf = 0; let lastT = 0;
  const gaps = new Float32Array(256); let gn = 0; // the screen's frame intervals (rAF to rAF), ms
  const inter = new Map(); // interactionId -> its slowest event, ms
  const loafs = []; // [duration, the script that took longest]
  const has = (t) => (PerformanceObserver.supportedEntryTypes || []).includes(t);
  const watch = (type, fn, opt = {}) => { if (!has(type)) return null; const o = new PerformanceObserver((l) => l.getEntries().forEach(fn)); o.observe({ type, buffered: true, ...opt }); return o; };
  const obs = [
    watch('event', (e) => { if (e.interactionId) inter.set(e.interactionId, Math.max(inter.get(e.interactionId) || 0, e.duration)); }, { durationThreshold: 16 }),
    watch('long-animation-frame', (e) => {
      const s = (e.scripts || []).reduce((a, x) => (x.duration > (a ? a.duration : 0) ? x : a), null);
      loafs.push([e.duration, s ? `${(s.sourceURL || '').split('/').pop().split('?')[0]} ${s.sourceFunctionName || s.invoker || ''}`.trim() : '']); if (loafs.length > 50) loafs.shift();
    }),
  ];
  const q = (arr, n, p) => { const v = Array.from(arr.slice(0, Math.min(n, arr.length))).filter((x) => x > 0).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : 0; };
  const f1 = (x) => x.toFixed(1);

  function draw(t) {
    raf = requestAnimationFrame(draw);
    if (lastT) gaps[gn++ & 255] = t - lastT; lastT = t;
    if (gn % 6) return; // (the overlay itself: ten times a second)
    const P = window.Hours && window.Hours.perf ? window.Hours.perf() : null;
    g.clearRect(0, 0, W, H);
    const y = (ms) => H - Math.min(H, (ms / (2 * BUDGET)) * H); // (the box: 0 to 33 ms)
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, Math.round(y(BUDGET)), W, 1);
    if (P) {
      for (let i = 0; i < 256; i += 1) {
        const k = (P.n + i) & 255; let b = H;
        [[P.step[k], '#6fa8dc'], [P.draw[k], '#e0b050'], [P.put[k], '#d06060']].forEach(([v, c]) => { const h = (v / (2 * BUDGET)) * H; g.fillStyle = c; g.fillRect(i, b - h, 1, h); b -= h; });
      }
    }
    g.strokeStyle = '#9fdf9f'; g.beginPath();
    for (let i = 0; i < 256; i += 1) { const v = gaps[(gn + i) & 255]; if (i) g.lineTo(i, y(v)); else g.moveTo(i, y(v)); }
    g.stroke();
    const n = Math.min(gn, 256); const iv = [...inter.values()].sort((a, b) => a - b);
    const inp = iv.length ? iv[Math.min(iv.length - 1, Math.floor(iv.length * 0.98))] : 0;
    const worst = loafs.reduce((a, l) => (l[0] > a[0] ? l : a), [0, '']);
    box.querySelector('.ph-txt').innerHTML = [
      P ? `castle ${P.size ? P.size.join('×') : '-'} px · ${P.state}${P.lite ? ' · lite' : ''}${P.running ? '' : ' · still'}` : 'castle: not running',
      P ? `<b style="color:#6fa8dc">step</b> ${f1(q(P.step, 256, 0.5))}/${f1(q(P.step, 256, 0.95))} · <b style="color:#e0b050">draw</b> ${f1(q(P.draw, 256, 0.5))}/${f1(q(P.draw, 256, 0.95))} · <b style="color:#d06060">put</b> ${f1(q(P.put, 256, 0.5))}/${f1(q(P.put, 256, 0.95))} ms (p50/p95)` : '',
      `<b style="color:#9fdf9f">frame</b> ${f1(q(gaps, n, 0.5))}/${f1(q(gaps, n, 0.95))} ms · ${Math.round(1000 / (q(gaps, n, 0.5) || 1000))} fps`,
      has('event') ? `INP ${Math.round(inp)} ms over ${iv.length} interaction${iv.length === 1 ? '' : 's'}` : 'INP: no Event Timing here',
      P && P.sections ? `<span style="color:#e0b050">${P.sections.map(([k, v]) => `${k} ${f1(v)}`).join(' \u00b7 ')}</span>` : '',
      has('long-animation-frame') ? `long frames ${loafs.length}${worst[0] ? `, worst ${Math.round(worst[0])} ms ${worst[1]}` : ''}` : '',
    ].filter(Boolean).join('<br>');
  }

  function toggle() {
    if (box) { cancelAnimationFrame(raf); box.remove(); box = null; return; }
    box = document.createElement('aside'); box.className = 'perf-hud'; box.setAttribute('aria-label', 'Frame timings');
    box.style.cssText = 'position:fixed;left:8px;bottom:44px;z-index:99;background:rgba(10,10,16,.86);color:#ddd;font:11px/1.35 ui-monospace,monospace;padding:6px 8px;border:1px solid #555;pointer-events:none';
    box.innerHTML = `<canvas width="${W}" height="${H}" style="display:block;width:${W}px;height:${H}px;image-rendering:pixelated"></canvas><p class="ph-txt" style="margin:4px 0 0"></p>`;
    document.body.append(box); cv = box.querySelector('canvas'); g = cv.getContext('2d'); lastT = 0;
    raf = requestAnimationFrame(draw);
  }
  window.PerfHud = { toggle, stop: () => obs.forEach((o) => o && o.disconnect()) };
})();
