// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

/* ---- the scrying engine (the scriptorium, About): the terminal, a site in the site ------------
   The same page in an iframe (framed, it takes the terminal: see the head script), in a window over
   the castle. Opening: the room's picture zooms on the engine, then the window grows out of its glass;
   closing runs it back. Esc, [back to the castle] (from inside: postMessage) or a click outside closes. */
const GEAR_PATH = (() => { // a ten-toothed wheel
  const pts = []; for (let k = 0; k < 40; k += 1) { const a = (k / 40) * 2 * Math.PI; const r = k % 4 < 2 ? 11 : 8.5; pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`); }
  return `M${pts.join('L')}Z`;
})();
let engine = null; let engineClosing = []; // (the closing's timers: opened again before they ran, they would undo the new zoom)
function enterEngine() { // from anywhere: into the scriptorium, then the engine
  if (FRAMED || engine) return;
  if (!window.Hours) { setTimeout(enterEngine, 200); return; }
  if (root.dataset.room !== 'about') { if (location.hash === '#about') openWindow('#about', { userAction: true }); else location.hash = '#about'; }
  const t0 = Date.now();
  const wait = () => {
    const b = spots.querySelector('.spot[data-kind="engine"]');
    if (b && root.classList.contains('room-ready')) setTimeout(() => openEngine(b), 350);
    else if (Date.now() - t0 < 8000) setTimeout(wait, 120);
  };
  wait();
}
function openEngine(spot) {
  if (FRAMED || engine) return;
  engineClosing.forEach(clearTimeout); engineClosing = [];
  const cv = document.querySelector('.plate-img');
  cv.style.transition = 'none'; cv.style.transform = ''; cv.getBoundingClientRect(); // (still zoomed from a closing: measure it unzoomed)
  const sr = spot.getBoundingClientRect(); const cr = cv.getBoundingClientRect(); // (the picture: the landscape's canvas and the room's)
  const fx = sr.left + sr.width / 2; const fy = sr.top + sr.height * 0.4; // (the glass, in the hood's upper part)
  const Z = 2.6; const ms = reduceMotion ? 0 : 900;
  cv.style.transformOrigin = `${fx - cr.left}px ${fy - cr.top}px`;
  cv.style.transition = `transform ${ms}ms cubic-bezier(.6, 0, .3, 1)`;
  const vx = innerWidth / 2; const vy = innerHeight / 2; // the glass is brought to the middle, where the window opens
  cv.style.transform = `translate(${vx - fx}px, ${vy - fy}px) scale(${Z})`;
  root.classList.add('engine-on'); cue('door');
  const wrap = document.createElement('div'); wrap.className = 'engine';
  const gear = (c) => `<svg class="engine-gear ${c}" viewBox="-12 -12 24 24" aria-hidden="true"><path d="${GEAR_PATH}"/><circle r="3"/></svg>`;
  wrap.innerHTML = `<div class="engine-win" role="dialog" aria-label="${T.engineTitle}">${gear('g1')}${gear('g2')}${gear('g3')}<p class="engine-bar"><span>${T.engineTitle}</span>`
    + `<span class="engine-gauge" aria-hidden="true"><i class="engine-needle"></i></span><button type="button" class="engine-x">${T.engineClose}</button></p><iframe title="${T.engineTitle}" src="${location.pathname}"></iframe></div>`;
  engine = { wrap, cv, fx: vx, fy: vy, ms, from: spot };
  setTimeout(() => {
    if (!engine) return;
    document.body.append(wrap);
    const win = wrap.querySelector('.engine-win'); const wr = win.getBoundingClientRect();
    const s0 = Math.max(0.04, (sr.width * Z * 0.5) / wr.width); // grown from the glass, as large as it looks zoomed
    win.style.transform = `translate(${vx - (wr.left + wr.width / 2)}px, ${vy - (wr.top + wr.height / 2)}px) scale(${s0})`; win.style.opacity = '0';
    win.getBoundingClientRect(); // (commit the start)
    win.style.transition = `transform ${reduceMotion ? 0 : 520}ms cubic-bezier(.2, .8, .2, 1), opacity ${reduceMotion ? 0 : 300}ms`;
    win.style.transform = ''; win.style.opacity = '';
    engine.win = win; engine.s0 = win.style.transform;
    const fr = wrap.querySelector('iframe'); fr.addEventListener('load', () => { try { fr.contentWindow.focus(); } catch { /* (another origin: never here) */ } }, { once: true });
  }, ms);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('.engine-x')) closeEngine(); });
}
function closeEngine() {
  if (!engine) return;
  const { wrap, cv, fx, fy, ms, from } = engine; engine = null;
  const win = wrap.querySelector('.engine-win'); const wr = win.getBoundingClientRect();
  win.style.transform = `translate(${fx - (wr.left + wr.width / 2)}px, ${fy - (wr.top + wr.height / 2)}px) scale(0.05)`; win.style.opacity = '0';
  wrap.style.pointerEvents = 'none';
  setTimeout(() => wrap.remove(), reduceMotion ? 0 : 400);
  engineClosing = [setTimeout(() => { cv.style.transform = ''; }, reduceMotion ? 0 : 400)];
  engineClosing.push(setTimeout(() => { root.classList.remove('engine-on'); cv.style.transition = ''; cv.style.transformOrigin = ''; if (from.isConnected) from.focus(); }, (reduceMotion ? 0 : 400) + ms));
}
function engineToggle() {
  if (FRAMED) { parent.postMessage({ engine: 'close' }, location.origin); return; }
  if (engine) closeEngine();
  else if (root.getAttribute('data-theme') === 'hours') enterEngine();
  else { if (!WIDE.matches) store('entry', 'castle'); applyTheme(nextTheme(), true); openWindow(location.hash, { userAction: false }); }
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || FRAMED) return;
  const m = e.data;
  if (m.engine === 'close') closeEngine();
  else if (m.engine === 'room' && engine && WORLD[m.id]) { history.replaceState(null, '', `#${m.id}`); openWindow(`#${m.id}`, { userAction: false }); } // walking in the terminal walks the castle behind it
  else if (m.engine === 'pins' && window.Hours && window.Hours.refresh) window.Hours.refresh();
  else if (m.engine === 'key' && engine) engineTurn(1);
  else if (m.engine === 'out' && engine) engineGauge(m.n);
  else if (m.engine === 'err' && engine) { cue('ding'); engineTurn(-3); }
});
/* The engine at work: its gears turn a tooth a key, its gauge reads how much the last answer said,
   its bell rings at a command it does not know. */
function engineTurn(k) {
  if (!engine || !engine.wrap) return; engine.turn = (engine.turn || 0) + k * 15;
  engine.wrap.querySelectorAll('.engine-gear').forEach((g, j) => { g.style.transform = `rotate(${(j % 2 ? -1 : 1) * engine.turn * (j % 2 ? 1.5 : 1)}deg)`; });
  if (Math.abs(k) === 1 && Math.random() < 0.5) cue('tick');
}
function engineGauge(n) {
  const nd = engine && engine.wrap && engine.wrap.querySelector('.engine-needle'); if (!nd) return;
  nd.style.transform = `rotate(${-70 + 140 * Math.min(1, Math.log10(1 + n) / 3.6)}deg)`; // (a few words: low; a page: high)
}
/** The front gate's ways in (gate.js): the castle (a touch screen showing the terminal goes back up the
 *  tower), the terminal (in the scriptorium's engine; on a touch screen the page itself), the tour. */
function gateWay(way) {
  if (way === 'terminal') { if (WIDE.matches) enterEngine(); else { store('entry', 'engine'); applyTheme('dark', true); } }
  else if (way === 'tour') tour();
  else if (root.getAttribute('data-theme') !== 'hours' && touchy()) { store('entry', 'castle'); applyTheme('hours', true); openWindow(location.hash, { userAction: false }); }
}
addEventListener('gate', (e) => gateWay(e.detail));
/** Back where the last visit left off: the herald offers the room (and the card) for five seconds. */
function offerReturn() {
  const id = store('lastRoom'); const label = store('lastCard');
  if (!id || !WORLD[id] || location.hash || root.getAttribute('data-theme') !== 'hours' || climbing() || FRAMED) return;
  if (!window.Hours || !window.Hours.roomName) { if ((offerReturn.n = (offerReturn.n || 0) + 1) < 20) setTimeout(offerReturn, 300); return; } // (the castle's names come with it)
  const lbl = moreLink.querySelector('.lbl'); const was = lbl.innerHTML; const line = T.backTo(window.Hours.roomName(id) || WORLD[id].name);
  say(line, () => {
    lbl.innerHTML = was; goTo(id);
    if (!label) return; const t0 = Date.now();
    const find = () => { const b = [...spots.querySelectorAll('.spot')].find((x) => x.dataset.label === label); if (b) b.click(); else if (Date.now() - t0 < 6000) setTimeout(find, 250); };
    setTimeout(find, 800);
  }, { now: true });
  lbl.innerHTML = T.backYes;
  setTimeout(() => { if (msgText.textContent === line) { say(T.backGone, null, { now: true }); } lbl.innerHTML = was; }, 5000);
}
addEventListener('gate', (e) => { if (e.detail === 'castle') setTimeout(offerReturn, 600); });
if (!root.classList.contains('gated') && isIndex && !location.search) setTimeout(offerReturn, 1500);
if (!root.classList.contains('gated') && !FRAMED && isIndex && !location.hash && !location.search && store('gate') === 'terminal' && WIDE.matches) enterEngine(); // (told to remember it)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (engine && !FRAMED) { e.stopImmediatePropagation(); closeEngine(); return; }
  if (FRAMED && !document.querySelector('dialog[open]') && $('cmdline').hidden) parent.postMessage({ engine: 'close' }, location.origin);
}, true);

/** The doors out of room `id`, from the section's exits: { dir: n|e|s|w, label, go }. */
function roomDoors(id) {
  const sec = document.getElementById(id);
  return sec ? [...sec.querySelectorAll('.exits li')].map((li) => {
    const a = li.querySelector('a'); const dir = li.querySelector('.dir').textContent.trim();
    const href = a.getAttribute('href'); // '#experience'
    const go = ROOM_IDS.find((r) => href.endsWith(`#${r}`)) || null;
    return { kind: 'door', dir: dir[0], label: `${dir}: ${a.textContent.trim()}`, go, html: '' };
  }).filter((d) => d.go) : [];
}
