// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

/* ---- rooms visited (this browser session) ------------------------------ */

const explored = $('st-explored');
if (!session('since')) session('since', String(Date.now()));
const visited = () => sessionList('visited');
let here = null; // the room the reader stands in

/* When each room was last entered from this browser (kept): a room left alone a while gathers
   cobwebs in the castle. `seenBefore` is the record as this visit found it. */
const seenBefore = (() => { try { return JSON.parse(store('roomSeen') || '{}'); } catch { return {}; } })();
/** Days since room `id` was last entered before this visit; Infinity if never. */
const staleness = (id) => (seenBefore[id] ? (Date.now() - seenBefore[id]) / 864e5 : Infinity);

/** The plan of the castle (the status line's Rooms): its rooms on their grid, the doors between them,
 *  those visited inked, the others in outline; a room clicked, there. */
function showPlan() {
  const v = visited(); const ids = ROOM_IDS.filter((id) => WORLD[id].c !== undefined);
  const C = Math.max(...ids.map((id) => WORLD[id].c)) + 1; const R = Math.max(...ids.map((id) => WORLD[id].r)) + 1;
  const cw = 120; const ch = 54; const g = 26; const at = (id) => [12 + WORLD[id].c * (cw + g), 12 + WORLD[id].r * (ch + g)];
  const doors = LINKS.filter(([a, b]) => WORLD[a] && WORLD[b]).map(([a, b]) => { const [x1, y1] = at(a); const [x2, y2] = at(b); return `<line x1="${x1 + cw / 2}" y1="${y1 + ch / 2}" x2="${x2 + cw / 2}" y2="${y2 + ch / 2}"/>`; }).join('');
  const rooms = ids.map((id) => { const [x, y] = at(id); const seen = v.includes(id);
    return `<a href="#${id}" class="${seen ? 'seen' : ''}${id === here ? ' here' : ''}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}"/><text x="${x + cw / 2}" y="${y + ch / 2 + 5}">${esc(WORLD[id].name)}</text></a>`; }).join('');
  showDialog(T.planTitle, `<svg class="plan" viewBox="0 0 ${24 + C * cw + (C - 1) * g} ${24 + R * ch + (R - 1) * g}" role="img" aria-label="${T.planTitle}"><g class="doors">${doors}</g>${rooms}</svg><p class="dim">${T.planNote(v.length, ids.length)}</p>`);
  dialog.querySelectorAll('.plan a').forEach((a) => a.addEventListener('click', () => dialog.close()));
}
explored.addEventListener('click', showPlan);

/** The reader enters room `id`; `quiet` keeps the message line as it is (first paint). */
function enterRoom(id, quiet = false) {
  here = WORLD[id] ? id : null;
  if (here) { try { const m = JSON.parse(store('roomSeen') || '{}'); m[id] = Date.now(); store('roomSeen', JSON.stringify(m)); } catch { /* */ } }
  const v = visited();
  if (here && !v.includes(id)) {
    v.push(id);
    session('visited', JSON.stringify(v));
  }
  explored.hidden = false;
  explored.querySelector('b').textContent = `${v.length}/${ROOM_IDS.length}`;
  if (v.length === ROOM_IDS.length && !session('ended')) {
    session('ended', '1');
    if (window.Hours) window.Hours.hoist(false); // your banner goes up the keep
    say(T.explored, showEnd);
    return;
  }
  if (quiet || !here) return;
  if (ITEMS[id] && !pack().includes(id)) say(T.seeHere(ITEMS[id].name));
  else if (Math.random() < 0.3) say(T.rumour(RUMOURS[Math.floor(Math.random() * RUMOURS.length)]));
}

/* ---- one window at a time, addressed by the URL hash ------------------- */

const tabLinks = [...document.querySelectorAll('.tabs a[href^="#"]')];
const windows = [...document.querySelectorAll('main > section:not([hidden]):not(#cellar):not(#maproom)')];
const host = document.querySelector('.host');
const isIndex = tabLinks.length > 0;

function currentWindow() {
  return windows.find((w) => !w.classList.contains('is-off')) || windows[0];
}

/* fig. 0's stars twinkle (the terminal): the engraving's stars found once, blots of one ink in its upper
   part (4-connected pixels, 5 to 15 wide, about as wide as high, filling a third to two thirds of their box); fifteen of them brightened in turn, each
   at its own pace, more by night over Paris. Drawn over the picture as CSS cover places it. */
function twinkle() {
  const pic = document.querySelector('.plate-img'); if (!pic || reduceMotion) return;
  const img = new Image(); img.src = new URL('assets/img/flammarion-dark.png', SITE).href;
  img.onload = () => {
    const w = img.width; const h = img.height; const c0 = document.createElement('canvas'); c0.width = w; c0.height = h;
    const g0 = c0.getContext('2d'); g0.drawImage(img, 0, 0); const d = g0.getImageData(0, 0, w, h).data;
    const seen = new Uint8Array(w * h); const blots = []; const light = (k) => d[k * 4] >= 128;
    for (let y0 = 0; y0 < h * 0.6; y0 += 1) for (let x0 = 0; x0 < w; x0 += 1) { // (a star is a small blot of either ink: dark in the light band, light on the night)
      const i0 = y0 * w + x0; if (seen[i0]) continue;
      const on = light(i0); const px = []; const stack = [i0]; seen[i0] = 1;
      while (stack.length) { const i = stack.pop(); if (px.length < 200) px.push(i); const x = i % w; const y = (i - x) / w;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx; const Y = y + dy; const k = Y * w + X; if (X >= 0 && X < w && Y >= 0 && Y < h && !seen[k] && light(k) === on) { seen[k] = 1; stack.push(k); } }); }
      if (px.length < 8 || px.length >= 200) continue;
      const xs = px.map((i) => i % w); const ys = px.map((i) => Math.floor(i / w)); const bw = Math.max(...xs) - Math.min(...xs); const bh = Math.max(...ys) - Math.min(...ys);
      const fill = px.length / ((bw + 1) * (bh + 1)); // (a star fills a third to two thirds of its box; a hatch stroke, less)
      if (bw >= 5 && bh >= 5 && bw < 16 && bh < 16 && bw / bh > 0.7 && bw / bh < 1.4 && fill > 0.35 && fill < 0.75 && Math.min(...xs) > w * 0.33) blots.push(px); // (the left third is the wheel and the clouds)
    }
    const stars = blots.sort(() => Math.random() - 0.5).slice(0, 15).map((px) => ({ px, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.2 }));
    const cv = document.createElement('canvas'); cv.className = 'twinkle'; cv.setAttribute('aria-hidden', 'true'); pic.after(cv); const g = cv.getContext('2d'); // (beside the picture, not in it: its canvases are the castle's)
    let last = 0;
    const draw = (now) => {
      requestAnimationFrame(draw);
      if (now - last < 120 || root.getAttribute('data-theme') !== 'dark' || document.hidden || root.classList.contains('siege-on')) return; last = now;
      const dpr = devicePixelRatio || 1; const W = pic.clientWidth; const H = pic.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      Object.assign(cv.style, { left: `${pic.offsetLeft}px`, top: `${pic.offsetTop}px`, width: `${W}px`, height: `${H}px` }); // (over the picture, in the sticky figure)
      const s = Math.max(W / w, H / h) * dpr; const ox = (W * dpr - w * s) / 2; const oy = H * dpr - h * s; // (background: center bottom / cover)
      const amp = root.dataset.sky === 'night' ? 1 : 0.5; const t = now / 1000; const all = /[?&]twinkle=all/.test(location.search); // (?twinkle=all, a check: every star lit)
      g.clearRect(0, 0, cv.width, cv.height);
      stars.forEach((st) => {
        const a = all ? 1 : amp * Math.max(0, Math.sin(t * st.sp + st.ph)) ** 6; if (a < 0.03) return;
        g.fillStyle = all ? 'rgb(255, 40, 40)' : `rgba(255, 246, 214, ${a.toFixed(2)})`;
        st.px.forEach((i) => g.fillRect(Math.floor(ox + (i % w) * s), Math.floor(oy + Math.floor(i / w) * s), Math.ceil(s), Math.ceil(s)));
      });
    };
    requestAnimationFrame(draw);
  };
}
twinkle();

/** Down the stair to the cellar, seen as one goes down it: the steps in perspective sinking towards a
 *  point ahead, brick walls either side and a vault over them, torches going by, the dark gaining;
 *  low resolution like the castle, over the picture. `then` (the room) starts halfway. */
function stairDown(then) {
  const pic = document.querySelector('.plate-img'); const r = pic.getBoundingClientRect();
  const cv = document.createElement('canvas'); const W = 192; const H = 108; cv.width = W; cv.height = H; cv.className = 'stairdown';
  Object.assign(cv.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  document.body.append(cv); const g = cv.getContext('2d'); const im = g.createImageData(W, H); const t0 = performance.now(); let started = false;
  const A = 30; const SLOPE = 1.25; // (depth scale; how fast the stair widens towards us)
  const frame = (now) => {
    const p = Math.min(1, (now - t0) / 1500);
    if (root.dataset.room !== 'cellar') { cv.remove(); return; } // (left on the way down: no room under it)
    if (!started && p > 0.6) { started = true; then(); }
    const travel = p * 1.6; const vx = W / 2; const vy = 30 + Math.sin(travel * 3 * Math.PI * 2) * 1.2; // (five steps down, a bob at each)
    const dim = 1 - 0.7 * p;
    const torches = [];
    for (let n = 1; n < 6; n += 1) { const st = n * 2.5 - (travel % 2.5); if (st > 0.4) [-1, 1].forEach((side) => torches.push([vx + side * SLOPE * (A / st) * 0.95, vy + (A / st) * 0.25, st])); }
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const dy = y - vy; const dx = Math.abs(x - vx); let v; let warm = 1;
      const kk = dy > 0 ? (A / dy + travel) * 3 : 0; const nose = dy > 0 ? A / (Math.floor(kk) / 3 - travel + 1e-3) : 0; // (three steps a depth unit; the row of this step's nosing)
      if (dy > 0 && dx <= Math.min(dy, nose > 0 ? nose : dy) * SLOPE) { // the stair: each step a band, lit at its nosing, in shadow under the next; its edge on the walls a stair too
        const sd = A / dy; const f = kk - Math.floor(kk);
        v = (f > 0.82 ? 0.78 : f < 0.22 ? 0.1 : 0.5) / (1 + sd * 0.1);
      } else { // the walls and the vault: joints running to the point ahead, courses across them
        const q = Math.max(dx / SLOPE, Math.abs(dy), 0.5); const sd = A / q; const k = (sd + travel) * 2;
        const ang = Math.atan2(dy, dx); const joint = Math.abs(((ang * 7) % 1 + 1) % 1 - 0.5) > 0.45 || k - Math.floor(k) < 0.08;
        v = (joint ? 0.1 : dy < 0 && dx < -dy * SLOPE ? 0.2 : 0.34) / (1 + sd * 0.1); warm = 0.9;
      }
      let glow = 0; torches.forEach(([tx, ty, st]) => { const d = Math.hypot(x - tx, (y - ty) * 1.3); glow += Math.max(0, 1 - d / (14 / Math.sqrt(st))) * 0.5; });
      const b = Math.min(1, v + glow * 0.6) * dim * 255; const i = (y * W + x) * 4;
      im.data[i] = b * warm; im.data[i + 1] = b * 0.82 * warm; im.data[i + 2] = b * 0.62; im.data[i + 3] = 255 * (p < 0.82 ? 1 : 1 - (p - 0.82) / 0.18);
    }
    torches.forEach(([tx, ty, st]) => { if (st < 6) { const k = (Math.round(ty) * W + Math.round(tx)) * 4; if (k >= 0 && k < im.data.length - 4) { im.data[k] = 255; im.data[k + 1] = 190; im.data[k + 2] = 90; } } }); // (the flames)
    g.putImageData(im, 0, 0);
    if (p < 1) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

function openWindow(hash, { userAction, animate = userAction }) {
  const target = (hash && document.getElementById(decode(hash.slice(1)))) || null;
  const win = target ? target.closest('main > section') : windows[0];
  towerLayout();
  if (target && win === maproom && !climbing()) { // the map room (by the cartographer's sign in the village): out of the menu, the castle's only
    if (root.getAttribute('data-theme') !== 'hours') return;
    windows.forEach((w) => w.classList.add('is-off'));
    tabLinks.forEach((a) => a.removeAttribute('aria-current'));
    root.dataset.room = 'maproom';
    if (userAction) { say(maproom.dataset.look); cue('door'); }
    if (window.Hours) window.Hours.room('maproom', { animate });
    return;
  }
  if (target && win === cellar && !climbing()) { // the castle's cellar (through the door in the rock): a room of its own, out of the menu
    if (root.getAttribute('data-theme') !== 'hours') { descend(); return; }
    windows.forEach((w) => w.classList.add('is-off'));
    tabLinks.forEach((a) => a.removeAttribute('aria-current'));
    root.dataset.room = 'cellar';
    if (userAction) { say(cellar.dataset.look); cue('door'); }
    const enter = (anim) => { if (window.Hours && root.dataset.room === 'cellar') window.Hours.room('cellar', { animate: anim }); };
    if (animate && !reduceMotion) stairDown(() => enter(false)); else enter(animate); // (down the stair: the cellar is there as it ends, never the landscape again)
    return;
  }
  if (climbing() && (!target || floors().includes(win))) { // the tower: every floor on the page; the one asked for is scrolled to (climbFloor does the rest)
    windows.forEach((w) => w.classList.remove('is-off'));
    if (target) target.scrollIntoView({ behavior: userAction && !reduceMotion ? 'smooth' : 'instant' });
    else if (userAction) window.scrollTo({ top: 0 });
    climbFloor();
    return;
  }
  if (!windows.includes(win)) return; // e.g. the skip link's #main: leave the windows alone

  windows.forEach((w) => w.classList.toggle('is-off', w !== win));
  tabLinks.forEach((a) => {
    if (a.getAttribute('href') === `#${win.id}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  enterRoom(win.id, !userAction);
  // the hours theme: a section shown is a room of the castle; no hash at all, the landscape
  if (target) { root.dataset.room = win.id; store('lastRoom', win.id); } else delete root.dataset.room;
  if (FRAMED && target) parent.postMessage({ engine: 'room', id: win.id }, location.origin); // (the castle behind the glass goes there too)
  if (target && userAction && root.getAttribute('data-theme') === 'hours') {
    const empty = win.querySelector('.empty:not([hidden])');
    const hint = !session('hinted') && wideRooms() ? T.lookHint : ''; // once a visit: how the rooms work
    if (hint) session('hinted', '1');
    say([win.dataset.look, empty && empty.textContent.trim(), hint].filter(Boolean).join(' '));
  }
  if (target && userAction && root.getAttribute('data-theme') === 'hours') cue('door'); // into a room
  if (window.Hours) window.Hours.room(target ? win.id : null, { animate });
  else root.classList.toggle('room-ready', Boolean(target)); // no castle (yet): show the text at once
  if (!userAction) return;
  win.classList.add('opening');
  win.addEventListener('animationend', () => win.classList.remove('opening'), { once: true });

  if (target && target !== win) {
    target.scrollIntoView();
  } else {
    // keep the header in view if it already was; otherwise bring the tab bar back to the top
    const msgH = document.querySelector('.msgline').getBoundingClientRect().height;
    const top = host.getBoundingClientRect().bottom + window.scrollY - msgH;
    if (window.scrollY > top) window.scrollTo({ top });
  }
  if (cmdOpen()) return; // walking from the command line: leave the focus in it
  if (tabBar.contains(document.activeElement)) return; // chosen from the menu: the cursor stays there
  const heading = win.querySelector('.room');
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/* The tower (narrow screens, .climb; the layout in styles.css). Upright, each floor opens with its
   room in a frame; the one live picture moves into the frame most in sight (none in sight: it
   stays, so reading never changes anything), the frame it leaves keeps a snapshot. On its side
   (.side), the picture is a column on the left and shows the floor read at 40% of the height.
   Going down a floor the room slides up past its floor slab, and the other way (hours.js 'climb'). */
const SIDE = matchMedia('(orientation: landscape) and (min-width: 36rem)');
const plateEl = document.querySelector('.plate');
const ribbon = document.querySelector('.msgline');
const towerTools = ['cmd-toggle', 'theme-toggle', 'sound-toggle'].map((k) => $(k)).filter(Boolean);
const roofSlot = document.createElement('div');
roofSlot.className = 'floor-slot roof';
let floor; // (undefined: not yet placed)
const roofLine = msgText.textContent;
const cellar = document.getElementById('cellar'); // the tower's foot (shown by applyTheme in the tower only)
const maproom = document.getElementById('maproom'); // the map room (the castle's, reached from the village)
const floors = () => (cellar && !cellar.hidden ? [...windows, cellar] : windows);
const slotOf = (id) => (id ? document.getElementById(id).querySelector(':scope > .floor-slot') : roofSlot);
function mount(slot) { // the live picture into frame `slot`; the frame left keeps its last picture
  const old = plateEl.parentElement;
  if (!slot || old === slot) return;
  if (old.classList.contains('floor-slot')) {
    try { if (window.Hours && window.Hours.picture) old.style.setProperty('--snap', `url(${window.Hours.picture()})`); } catch { /* (a tainted canvas: no snapshot) */ }
  }
  slot.style.removeProperty('--snap');
  slot.append(plateEl);
}
// a frame never visited shows a still of its room, drawn a little before it comes into sight
const stills = new IntersectionObserver((es) => es.forEach(({ target: f, isIntersecting: near }) => {
  const paint = () => {
    if (!f.isConnected || f.style.getPropertyValue('--snap') || f.contains(plateEl) || !climbing()) return;
    const url = window.Hours && window.Hours.snapshot && window.Hours.snapshot(f.parentElement.id);
    if (url) f.style.setProperty('--snap', `url(${url})`); else setTimeout(paint, 700); // (the castle not ready, or busy)
  };
  if (near) paint();
}), { rootMargin: '600px 0px' });
function towerLayout() {
  const on = climbing();
  root.classList.toggle('side', on && SIDE.matches);
  if (on) {
    if (!roofSlot.isConnected) plateEl.before(roofSlot);
    if (isIndex) floors().forEach((w) => {
      if (w.querySelector(':scope > .floor-slot')) return;
      const f = document.createElement('div'); f.className = 'floor-slot'; f.dataset.look = w.dataset.look || ''; f.setAttribute('aria-hidden', 'true');
      w.prepend(f); stills.observe(f);
    });
    if (ribbon.parentElement !== plateEl) plateEl.append(ribbon); // the herald under the picture
    let tools = tabBar.querySelector('.tower-tools');
    if (!tools) { tools = document.createElement('p'); tools.className = 'tower-tools'; tabBar.append(tools); }
    tools.append(...towerTools);
    mount(SIDE.matches || !isIndex ? roofSlot : slotOf(floor ?? null));
  } else if (roofSlot.isConnected) { // back to the page's own order
    roofSlot.before(plateEl); roofSlot.remove();
    document.querySelector('.shell').before(ribbon);
    $('keys-toggle').before(...towerTools);
    ribbon.classList.remove('open');
  }
}
ribbon.addEventListener('click', (e) => { // the herald's whole line, or back to two
  if (climbing() && !e.target.closest('a')) ribbon.classList.toggle('open');
});
function climbFloor() {
  if (!climbing() || !isIndex) return;
  const fl = floors();
  let id;
  if (SIDE.matches) {
    const line = innerHeight * 0.4;
    const win = fl.filter((w) => w.getBoundingClientRect().top < line).pop() || null;
    id = win ? win.id : null;
  } else {
    const seen = (el) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); };
    id = floor === undefined ? null : floor; let most = floor === undefined ? -1 : seen(slotOf(floor)) + 24; // (24 px: no flicker between two frames half in sight)
    [null, ...fl.map((w) => w.id)].forEach((k) => { const v = seen(slotOf(k)); if (v > most) { most = v; id = k; } });
  }
  if (id === floor) return;
  const at = (k) => [null, ...fl.map((w) => w.id)].indexOf(k);
  const dir = floor === undefined ? 0 : at(id) > at(floor) ? 1 : -1;
  floor = id;
  if (!SIDE.matches) mount(slotOf(id));
  ribbon.classList.remove('open');
  tabLinks.forEach((a) => { if (id && a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (id) { root.dataset.room = id; enterRoom(id, dir === 0); } else delete root.dataset.room;
  history.replaceState(null, '', id ? `#${id}` : location.pathname + location.search);
  const win = id && document.getElementById(id);
  if (dir) say(win ? win.dataset.look || '' : roofLine); // (back on the roof: the page's own first line)
  if (window.Hours) window.Hours.room(id, { animate: dir !== 0, dir });
  else root.classList.toggle('room-ready', Boolean(id));
}
{
  let queued = 0;
  addEventListener('scroll', () => { if (!queued && climbing()) queued = requestAnimationFrame(() => { queued = 0; climbFloor(); }); }, { passive: true });
  SIDE.addEventListener('change', () => { towerLayout(); climbFloor(); });
}

// the tab bar wraps on narrow screens: anchors must clear its real height (scroll-padding-top)
const tabBar = document.querySelector('.tabs');
new ResizeObserver(() => {
  root.style.setProperty('--tabs-h', `${tabBar.getBoundingClientRect().height}px`);
}).observe(tabBar);


root.classList.add('windowed');
openWindow(location.hash, { userAction: false });
// The browser's own jump to the fragment happened before the other windows closed:
// redo it, instantly, on the now-short page.
window.addEventListener('load', () => {
  const t = location.hash && document.getElementById(location.hash.slice(1));
  if (!t || !t.closest('main > section')) return;
  root.style.scrollBehavior = 'auto';
  if (t.closest('main > section') !== t) t.scrollIntoView();
  else window.scrollTo(0, 0);
  root.style.scrollBehavior = '';
});
window.addEventListener('hashchange', () => openWindow(location.hash, { userAction: true }));
window.addEventListener('popstate', () => { // back to the landscape (an entry made by leaveRoom)
  if (!location.hash && isIndex) openWindow('', { userAction: false, animate: true });
});

/* ---- leaving a room (hours theme): Esc, the parchment's button; off the index, home ---- */

function leaveRoom() {
  if (!isIndex) { location.href = SITE.href; return; }
  history.pushState(null, '', location.pathname + location.search);
  openWindow('', { userAction: false, animate: true });
  const cur = [...document.querySelectorAll('.tabs a')].find((a) => a.getAttribute('aria-current'));
  if (cur) cur.focus();
}
{
  const leave = document.createElement('button');
  leave.type = 'button';
  leave.className = 'leave';
  leave.textContent = T.leave;
  leave.addEventListener('click', leaveRoom);
  document.body.append(leave); // outside main: in the castle's rooms main is for readers only
}
