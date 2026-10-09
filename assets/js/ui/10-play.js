// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

/* ---- things to do in the castle's cards: a game of merels on the hall's table, the copyist's page ---- */

/* Nine men's morris (merels), against the house. The board: three squares, eight points each (ring r,
   point k going round from the top-left corner), the midpoints of their sides joined across. Each side
   places nine men, then moves them along the lines; three in a row (a mill) takes a man of the other
   side, not one in a mill unless all are; down to three men, a side may fly anywhere; down to two, or
   unable to move, it has lost. The house plays: make a mill, else block one, else the best-joined point. */
const MER_XY = [0, 1, 2].flatMap((r) => [[r, r], [3, r], [6 - r, r], [6 - r, 3], [6 - r, 6 - r], [3, 6 - r], [r, 6 - r], [r, 3]]);
const MER_ADJ = MER_XY.map((_, i) => {
  const r = Math.floor(i / 8); const k = i % 8; const out = [r * 8 + ((k + 1) % 8), r * 8 + ((k + 7) % 8)];
  if (k % 2) { if (r > 0) out.push(i - 8); if (r < 2) out.push(i + 8); } // (the side's middle: joined across)
  return out;
});
const MER_MILLS = [
  ...[0, 1, 2].flatMap((r) => [[0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0]].map((m) => m.map((k) => r * 8 + k))),
  ...[1, 3, 5, 7].map((k) => [k, 8 + k, 16 + k]),
];
function mountMerels(box) {
  const g = { b: Array(24).fill(0), hand: [0, 9, 9], turn: 1, take: false, sel: -1, over: false, said: 'Your men are the pale ones: place one on a point.' };
  const count = (p) => g.b.filter((v) => v === p).length;
  const inMill = (i, b = g.b) => MER_MILLS.some((m) => m.includes(i) && m.every((j) => b[j] === b[i] && b[i]));
  const flying = (p) => g.hand[p] === 0 && count(p) === 3;
  const moves = (p) => { // [from, to]: from -1 while placing
    if (g.hand[p] > 0) return g.b.map((v, i) => (v ? null : [-1, i])).filter(Boolean);
    const out = [];
    g.b.forEach((v, i) => { if (v !== p) return; (flying(p) ? g.b.map((w, j) => (w ? -1 : j)).filter((j) => j >= 0) : MER_ADJ[i].filter((j) => !g.b[j])).forEach((j) => out.push([i, j])); });
    return out;
  };
  const takeable = (p) => { const theirs = g.b.map((v, i) => (v === p ? i : -1)).filter((i) => i >= 0); const free = theirs.filter((i) => !inMill(i)); return free.length ? free : theirs; };
  const lost = (p) => (g.hand[p] === 0 && count(p) < 3) || (!moves(p).length && !g.take);
  const play = (p, [from, to]) => { if (from >= 0) g.b[from] = 0; else g.hand[p] -= 1; g.b[to] = p; cue('drop'); return inMill(to); };
  const after = (p, milled) => {
    if (milled) { g.take = true; if (p === 2) houseTakes(); return; }
    g.turn = 3 - p; check();
    if (!g.over && g.turn === 2) setTimeout(house, 450);
  };
  const check = () => {
    if (lost(1)) { g.over = true; g.said = 'The house wins. Click the board to play again.'; }
    else if (lost(2)) { g.over = true; g.said = 'You win: the house has no move left, or fewer than three men. Click the board to play again.'; }
  };
  const house = () => { // a mill if it can, else block the visitor's, else the point with the most free neighbours
    const ms = moves(2); if (!ms.length) { check(); draw(); return; }
    const after2 = (m, p) => { const b = g.b.slice(); if (m[0] >= 0) b[m[0]] = 0; b[m[1]] = p; return b; };
    const makes = ms.find((m) => inMill(m[1], after2(m, 2)));
    const threat = MER_MILLS.find((mm) => mm.filter((j) => g.b[j] === 1).length === 2 && mm.some((j) => !g.b[j]));
    const block = threat && ms.find((m) => threat.includes(m[1]) && !g.b[m[1]]);
    const m = makes || block || ms.sort((a, b) => MER_ADJ[b[1]].filter((j) => !g.b[j]).length - MER_ADJ[a[1]].filter((j) => !g.b[j]).length + (Math.random() - 0.5))[0];
    g.said = makes ? 'The house makes a mill.' : 'The house has played: your turn.';
    after(2, play(2, m)); draw();
  };
  const houseTakes = () => { // the visitor's man nearest to a mill
    const c = takeable(1); const near = c.find((i) => MER_MILLS.some((mm) => mm.includes(i) && mm.filter((j) => g.b[j] === 1).length === 2)) ?? c[0];
    if (near !== undefined) g.b[near] = 0; g.take = false; g.said = 'The house takes one of your men. Your turn.'; g.turn = 1; check(); draw();
  };
  const click = (i) => {
    if (g.over) { box.replaceChildren(); mountMerels(box); return; }
    if (g.turn !== 1) return;
    if (g.take) { if (!takeable(2).includes(i)) { g.said = 'Take one of the house\'s men (not one in a mill, unless all are).'; draw(); return; } g.b[i] = 0; g.take = false; g.said = 'Taken.'; cue('seal'); g.turn = 2; check(); draw(); if (!g.over) setTimeout(house, 450); return; }
    const legal = moves(1);
    if (g.hand[1] > 0) { const m = legal.find((q) => q[1] === i); if (!m) return; const mill = play(1, m); g.said = mill ? 'A mill: take one of the house\'s men.' : ''; after(1, mill); draw(); return; }
    if (g.b[i] === 1) { g.sel = i; g.said = flying(1) ? 'Three men left: this one may fly to any free point.' : 'Now a free point next to it.'; draw(); return; }
    const m = legal.find((q) => q[0] === g.sel && q[1] === i); if (!m) return;
    g.sel = -1; const mill = play(1, m); g.said = mill ? 'A mill: take one of the house\'s men.' : ''; after(1, mill); draw();
  };
  const draw = () => {
    const P = (i) => MER_XY[i].map((v) => 8 + v * 14);
    const lines = [0, 1, 2].map((r) => { const a = 8 + r * 14; const b = 92 - r * 14; return `<rect x="${a}" y="${a}" width="${b - a}" height="${b - a}"/>`; }).join('')
      + [[50, 8, 50, 36], [50, 64, 50, 92], [8, 50, 36, 50], [64, 50, 92, 50]].map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('');
    const pts = MER_XY.map((_, i) => { const [x, y] = P(i); const v = g.b[i];
      return `<circle cx="${x}" cy="${y}" r="${v ? 5 : 2.2}" class="${v === 1 ? 'm-you' : v === 2 ? 'm-house' : 'm-pt'}${i === g.sel ? ' m-sel' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="Point ${i + 1}${v === 1 ? ', your man' : v === 2 ? ', the house\'s man' : ''}"/>`; }).join('');
    box.innerHTML = `<svg class="merels" viewBox="0 0 100 100">${lines}${pts}</svg><p class="merels-say">${esc(g.said || ' ')}</p>`
      + `<p class="dim">In hand: you ${g.hand[1]}, the house ${g.hand[2]}. On the board: ${count(1)} to ${count(2)}.</p>`;
    box.querySelectorAll('[data-i]').forEach((c) => { c.addEventListener('click', () => click(Number(c.dataset.i))); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(Number(c.dataset.i)); } }); });
  };
  draw();
}

/* The copyist's page: draw on it with his pen (a pixel at a time, brown-black ink); the ink dries to
   sepia and fades within ten minutes, as his own do (kept on this device: [x, y, when] dots). */
const QUILL_LIFE = 600e3;
function quillDots() { try { return (JSON.parse(localStorage.getItem('quill')) || []).filter((d) => Date.now() - d[2] < QUILL_LIFE); } catch { return []; } }
function mountQuill(box) {
  const W = 96; const H = 64;
  box.innerHTML = `<canvas class="quill-page" width="${W}" height="${H}" aria-label="The copyist's page: draw on it"></canvas><p class="dim">Draw with the pen. The ink dries, then fades: in ten minutes the page is clean again.</p>`;
  const cv = box.querySelector('canvas'); const g = cv.getContext('2d'); let dots = quillDots(); let last = null; let down = false;
  const save = () => { try { localStorage.setItem('quill', JSON.stringify(dots.slice(-3000))); } catch { /* (no storage: the page forgets) */ } };
  const paint = () => {
    if (!cv.isConnected) return;
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(160, 120, 70, .25)'; for (let y = 8; y < H; y += 8) g.fillRect(4, y, W - 8, 1); // (ruled)
    const now = Date.now(); dots = dots.filter((d) => now - d[2] < QUILL_LIFE);
    dots.forEach(([x, y, t]) => { const age = (now - t) / QUILL_LIFE; const wet = Math.max(0, 1 - (now - t) / 20e3);
      g.fillStyle = `rgba(${Math.round(30 + 80 * (1 - wet))}, ${Math.round(18 + 50 * (1 - wet))}, ${Math.round(8 + 20 * (1 - wet))}, ${(1 - age) ** 0.7})`; g.fillRect(x, y, 1, 1); });
    setTimeout(paint, 1000);
  };
  const at = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left) / r.width) * W), Math.floor(((e.clientY - r.top) / r.height) * H)]; };
  const dot = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) dots.push([x, y, Date.now()]); };
  cv.addEventListener('pointerdown', (e) => { down = true; last = at(e); dot(...last); try { cv.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ } paintNow(); });
  cv.addEventListener('pointermove', (e) => { if (!down) return; const p = at(e); const n = Math.max(Math.abs(p[0] - last[0]), Math.abs(p[1] - last[1]), 1); for (let k = 1; k <= n; k += 1) dot(Math.round(last[0] + ((p[0] - last[0]) * k) / n), Math.round(last[1] + ((p[1] - last[1]) * k) / n)); last = p; paintNow(); });
  const up = () => { if (down) { down = false; save(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  let queued = 0; const paintNow = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; const t = Date.now(); g.fillStyle = 'rgb(30, 18, 8)'; dots.filter((d) => t - d[2] < 50).forEach(([x, y]) => g.fillRect(x, y, 1, 1)); }); };
  paint();
}
