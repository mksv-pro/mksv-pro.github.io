// (one global scope across castle/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

/* ---- other hands: a gamepad, a finger, vim's keys, hints to type ------------------------------- */

/** A key pressed for the page's own handlers (they listen on the document). */
const press = (key, opt = {}) => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opt }));

/* The gamepad (Gamepad API, standard mapping): the stick or the cross go from thing to thing as the
   arrow keys do, A opens (Enter), B closes (Esc), the shoulders take the previous or next room in the
   menu's order, Start the help. Polled only while a pad is connected; a short rumble when a card opens.
   The game under the castle (Siege) reads the pad itself. */
{
  let polling = false; let held = {}; let next = 0;
  const tabsInOrder = () => [...document.querySelectorAll('.tabs a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)).filter((id) => WORLD[id]);
  const room = (k) => { const ids = tabsInOrder(); const i = ids.indexOf(root.dataset.room); goTo(ids[(i + k + ids.length) % ids.length] || ids[0]); };
  const BUTTONS = { 0: () => { const a = document.activeElement; if (a && a !== document.body && a.click) a.click(); else press('Enter'); }, 1: () => press('Escape'), 4: () => room(-1), 5: () => room(1), 9: () => showHelp() };
  function poll(t) {
    const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
    if (!pad) { polling = false; return; }
    requestAnimationFrame(poll);
    if (root.classList.contains('siege-on') || document.hidden) return;
    pad.buttons.forEach((b, k) => { const on = b.pressed; if (on && !held[k] && BUTTONS[k]) BUTTONS[k](); held[k] = on; });
    const [ax, ay] = pad.axes; const dpad = [[12, 'ArrowUp'], [13, 'ArrowDown'], [14, 'ArrowLeft'], [15, 'ArrowRight']].find(([k]) => pad.buttons[k] && pad.buttons[k].pressed);
    const dir = dpad ? dpad[1] : Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6 ? (Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'ArrowLeft' : 'ArrowRight') : (ay < 0 ? 'ArrowUp' : 'ArrowDown')) : null;
    if (!dir) { next = 0; return; }
    if (t >= next) { press(dir); next = t + (next ? 140 : 320); } // (held: a first step, a pause, then steady steps)
  }
  addEventListener('gamepadconnected', () => { if (!polling) { polling = true; requestAnimationFrame(poll); } });
  /** A short rumble on the pad, if it has one (a card opening, a door). */
  window.rumble = (ms = 60, k = 0.35) => {
    const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
    if (pad && pad.vibrationActuator) pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: k * 0.5, weakMagnitude: k }).catch(() => {});
  };
}

/* A finger on the castle (a touch screen showing it whole, not the tower): a long press outlines the
   room's things, as Shift does; a swipe across the picture goes through the door on that side (a
   swipe to the right brings the room on the left, as a page turned). Pinch zoom is the browser's. */
{
  let t0 = 0; let x0 = 0; let y0 = 0; let long = 0; let revealed = false; let id = null;
  const plate = document.querySelector('.plate');
  const castle = () => root.getAttribute('data-theme') === 'hours' && !root.classList.contains('climb') && window.Hours;
  plate.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !castle()) return;
    id = e.pointerId; t0 = performance.now(); x0 = e.clientX; y0 = e.clientY;
    long = setTimeout(() => { revealed = true; window.Hours.reveal(true); if (navigator.vibrate) navigator.vibrate(12); }, 450);
  });
  plate.addEventListener('pointermove', (e) => { if (e.pointerId === id && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) clearTimeout(long); });
  const up = (e) => {
    if (e.pointerId !== id) return; id = null; clearTimeout(long);
    if (revealed) { revealed = false; window.Hours.reveal(false); e.preventDefault(); return; }
    const dx = e.clientX - x0; const dy = e.clientY - y0;
    if (e.type !== 'pointerup' || performance.now() - t0 > 600 || Math.abs(dx) < 80 || Math.abs(dx) < 2 * Math.abs(dy) || !root.classList.contains('room-ready')) return;
    const doors = roomDoors(root.dataset.room); const side = dx > 0 ? ['w', 'n'] : ['e', 's'];
    const d = doors.find((x) => x.dir === side[0]) || doors.find((x) => x.dir === side[1]);
    if (d) goTo(d.go);
  };
  plate.addEventListener('pointerup', up); plate.addEventListener('pointercancel', up);
  plate.addEventListener('contextmenu', (e) => { if (revealed) e.preventDefault(); }); // (the long press is ours)
}

/* The terminal, read with vim's keys (the terminal theme, the engine's glass): j k a line, d u half a
   page, gg G the top and the bottom, n N the next and the last place holding what was searched for
   (/ or search), M then a letter sets a mark where you are, ' then the letter goes back to it. */
{
  let pending = ''; let hitAt = -1;
  const marks = (() => { try { return JSON.parse(session('marks') || '{}'); } catch { return {}; } })();
  const hits = () => { const ws = (session('lastSearch') || '').split(' ').filter(Boolean); if (!ws.length) return [];
    return [...document.querySelectorAll('main .entry, main article.project, main .pub, main .news li, main .ledger-prog')].filter((el) => el.offsetParent && ws.every((w) => el.textContent.toLowerCase().includes(w))); };
  const flash = (el) => { el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'instant' : 'smooth' }); el.classList.remove('vim-hit'); void el.offsetWidth; el.classList.add('vim-hit'); };
  document.addEventListener('keydown', (e) => {
    if (root.getAttribute('data-theme') !== 'dark' || !keysOn || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    const k = e.key; const line = 40; const half = innerHeight / 2;
    if (pending) {
      const p = pending; pending = '';
      if (p === 'g' && k === 'g') { window.scrollTo({ top: 0, behavior: 'instant' }); e.preventDefault(); return; }
      if (p === 'M' && /^[a-z]$/.test(k)) { marks[k] = [root.dataset.room || '', window.scrollY]; session('marks', JSON.stringify(marks)); say(T.markSet(k)); e.preventDefault(); return; }
      if (p === "'" && /^[a-z]$/.test(k)) { const m = marks[k]; e.preventDefault(); if (!m) { say(T.noMark(k)); return; } if (m[0] && m[0] !== root.dataset.room) goTo(m[0]); setTimeout(() => window.scrollTo({ top: m[1], behavior: 'instant' }), 60); return; }
    }
    const act = { j: () => window.scrollBy({ top: line, behavior: 'instant' }), k: () => window.scrollBy({ top: -line, behavior: 'instant' }), d: () => window.scrollBy({ top: half, behavior: 'instant' }), u: () => window.scrollBy({ top: -half, behavior: 'instant' }),
      G: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
      n: () => { const h = hits(); if (h.length) { hitAt = (hitAt + 1) % h.length; flash(h[hitAt]); } else say(T.noSearch); },
      N: () => { const h = hits(); if (h.length) { hitAt = (hitAt - 1 + h.length) % h.length; flash(h[hitAt]); } else say(T.noSearch); } }[k];
    if (act) { e.preventDefault(); act(); return; }
    if (k === 'g' || k === 'M' || k === "'") { pending = k; e.preventDefault(); }
  });
}

/* Hints to type (as Vimium's): f shows a letter or two on every thing of the room (the castle) or every
   link of the page (the terminal); typing them follows it; Esc or a wrong letter takes them down. Each
   hint stands at its thing by CSS anchor positioning (anchor-name on the thing, position-anchor on the
   hint), else it is placed once from the thing's box. */
{
  const ABC = 'asdfghjklqweruiop'; let hints = null; let typed = '';
  const anchored = CSS.supports('position-anchor: --a');
  const codes = (n) => { if (n <= ABC.length) return [...ABC].slice(0, n); const out = []; for (const a of ABC) for (const b of ABC) { out.push(a + b); if (out.length === n) return out; } return out; };
  function down() { if (!hints) return; hints.layer.remove(); hints.els.forEach((el) => { el.style.anchorName = ''; }); hints = null; typed = ''; }
  function up() {
    const castle = root.getAttribute('data-theme') === 'hours';
    const els = castle ? [...document.querySelectorAll('.spots .spot'), ...document.querySelectorAll('.tabs a')]
      : [...document.querySelectorAll('main section:not(.is-off) a[href], .tabs a, .status button:not([hidden])')];
    const shown = els.filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; });
    if (!shown.length) return;
    const cs = codes(shown.length); const layer = document.createElement('div'); layer.className = 'kbd-hints'; layer.setAttribute('aria-hidden', 'true');
    shown.forEach((el, i) => {
      const h = document.createElement('span'); h.className = 'kbd-hint'; h.textContent = cs[i]; h.dataset.code = cs[i];
      if (anchored) { el.style.anchorName = `--hint-${i}`; h.style.positionAnchor = `--hint-${i}`; } else { const r = el.getBoundingClientRect(); Object.assign(h.style, { left: `${r.left}px`, top: `${r.top}px` }); }
      layer.append(h);
    });
    document.body.append(layer); hints = { layer, els: shown, codes: cs };
  }
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (hints) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Escape' || !/^[a-z]$/.test(e.key)) { down(); return; }
      typed += e.key; const i = hints.codes.indexOf(typed);
      if (i >= 0) { const el = hints.els[i]; down(); el.focus({ preventScroll: true }); el.click(); return; }
      if (!hints.codes.some((c) => c.startsWith(typed))) { down(); return; }
      hints.layer.querySelectorAll('.kbd-hint').forEach((h) => { h.classList.toggle('off', !h.dataset.code.startsWith(typed)); });
      return;
    }
    if (e.key !== 'f' || !keysOn || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) || document.querySelector('dialog[open]') || cmdOpen()) return;
    e.preventDefault(); up();
  }, true);
  addEventListener('scroll', down, { passive: true }); addEventListener('resize', down);
}
