// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

/* ---- dialogs: help (?), map (m), inventory (i), the end screen (quit) --- */

const dialog = document.createElement('dialog');
dialog.className = 'scroll';
dialog.setAttribute('aria-labelledby', 'dlg-h');
document.body.append(dialog);
dialog.addEventListener('click', (e) => {
  const use = e.target.closest('[data-use]');
  if (use) { dialog.close(); useItem(use.dataset.use); return; }
  const go = e.target.closest('[data-go]'); // the map's places in the landscape
  if (go) {
    dialog.close(); const k = go.dataset.go;
    if (k === 'cellar') { if (root.getAttribute('data-theme') === 'hours') location.hash = '#cellar'; else descend(); return; }
    if (k === 'maproom') { location.hash = '#maproom'; return; }
    if (root.dataset.room) leaveRoom();
    setTimeout(() => { if (window.Hours) window.Hours[k === 'tower' ? 'tower' : 'village'](); }, root.dataset.room ? 900 : 0);
    return;
  }
  if (e.target.closest('.map a')) { // let the link navigate, out of the descent too
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    return;
  }
  if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
});

function showDialog(titleHtml, bodyHtml) {
  dialog.innerHTML = `<h2 id="dlg-h">${titleHtml}</h2>${bodyHtml}
<p class="dlg-foot"><button type="button" data-close>${T.close}</button></p>`;
  if (dialog.open) dialog.close();
  dialog.showModal();
}


/* The tavern's billiard table: a stadium, two half-discs joined by straight cushions (Bunimovich,
   1979). Two balls set off from the same spot, their directions a millionth of a radian apart: after
   a few cushions they part for good, and each in time covers the whole table (chaos, ergodicity).
   On a round table they would keep their angle at every cushion and stay together. */
function showBilliard() {
  findCurio('billiard');
  showDialog(T.billiardTitle, `<canvas class="billiard" width="320" height="168" aria-label="${T.billiardAlt}"></canvas><p>${T.billiardText}</p><p class="dim billiard-count"></p>${fareHtml(true)}`);
  const cv = dialog.querySelector('canvas.billiard'); const g = cv.getContext('2d');
  const A = 70; const R = 60; const cx = 160; const cy = 84; // the straight part's half-length, the ends' radius
  const ball = (a) => ({ x: -20, y: 10, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6 });
  const balls = [ball(0.7), ball(0.7 + 1e-6)]; let hits = 0;
  g.fillStyle = '#2f5a3a'; g.strokeStyle = '#6a4028'; g.lineWidth = 8;
  const table = () => { g.beginPath(); g.arc(cx - A, cy, R, Math.PI / 2, (3 * Math.PI) / 2); g.lineTo(cx + A, cy - R); g.arc(cx + A, cy, R, -Math.PI / 2, Math.PI / 2); g.closePath(); };
  table(); g.fill(); g.stroke();
  const move = (b) => {
    b.x += b.vx; b.y += b.vy;
    if (Math.abs(b.x) <= A) { if (Math.abs(b.y) > R) { b.vy = -b.vy; b.y = Math.sign(b.y) * (2 * R - Math.abs(b.y)); return 1; } return 0; }
    const c = Math.sign(b.x) * A; const dx = b.x - c; const d = Math.hypot(dx, b.y);
    if (d <= R) return 0;
    const nx = dx / d; const ny = b.y / d; const dot = b.vx * nx + b.vy * ny; // reflect off the round cushion
    b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; b.x = c + nx * (2 * R - d); b.y = ny * (2 * R - d); return 1;
  };
  const tick = () => {
    if (!dialog.open || !dialog.contains(cv)) return;
    g.save(); table(); g.clip(); g.fillStyle = 'rgba(47, 90, 58, 0.04)'; g.fillRect(0, 0, cv.width, cv.height); // old tracks fade
    for (let k = 0; k < (reduceMotion ? 40 : 8); k += 1) {
      balls.forEach((b, j) => { const x0 = b.x; const y0 = b.y; const hit = move(b); if (j === 0) hits += hit; g.strokeStyle = j ? 'rgba(220, 80, 60, 0.7)' : 'rgba(250, 240, 210, 0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + x0, cy + y0); g.lineTo(cx + b.x, cy + b.y); g.stroke(); });
    }
    balls.forEach((b, j) => { g.fillStyle = j ? '#dc503c' : '#faf0d2'; g.beginPath(); g.arc(cx + b.x, cy + b.y, 3, 0, 2 * Math.PI); g.fill(); });
    g.restore();
    dialog.querySelector('.billiard-count').textContent = T.billiardCount(hits, Math.hypot(balls[0].x - balls[1].x, balls[0].y - balls[1].y));
    requestAnimationFrame(tick);
  };
  tick();
}

const showHelp = () => { showDialog(T.helpTitle, T.help(document.querySelectorAll('.tabs a[href*="#"]:not([href$="#cellar"])').length)); dialog.classList.add('is-help'); dialog.scrollTop = 0; dialog.addEventListener('close', () => dialog.classList.remove('is-help'), { once: true }); };
const showInventory = () => showDialog(T.invTitle, lootHtml() || `<p>${T.packEmpty}</p>`);

function showEnd() {
  const mins = Math.floor((Date.now() - Number(session('since') || Date.now())) / 60000);
  showDialog(
    T.endTitle,
    T.end((lootHtml() || T.emptyHanded) + curiosHtml(), visited().length, ROOM_IDS.length, T.minutes(mins)),
  );
}

/** ASCII map of the grid. Visited rooms are named, their neighbours shown as '?', the
 *  rest left dark; '@' marks the reader. Named rooms are links. */
function mapHtml(at) {
  const seen = visited();
  const lit = (id) => seen.includes(id) || id === at;
  const known = new Set(ROOM_IDS.filter(lit));
  LINKS.forEach(([a, b]) => {
    if (lit(a)) known.add(b);
    if (lit(b)) known.add(a);
  });
  const cell = {};
  ROOM_IDS.forEach((id) => { cell[`${WORLD[id].c},${WORLD[id].r}`] = id; });
  const linked = (a, b) => a && b && (lit(a) || lit(b))
    && LINKS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const BOX = 13; // inner width
  const pad = (s) => {
    const l = Math.floor((BOX - s.length) / 2);
    return [' '.repeat(l), ' '.repeat(BOX - s.length - l)];
  };
  let out = '';
  const cols = 1 + Math.max(...ROOM_IDS.map((id) => WORLD[id].c));
  const rows = 1 + Math.max(...ROOM_IDS.map((id) => WORLD[id].r));
  for (let r = 0; r < rows; r += 1) {
    const ids = Array.from({ length: cols }, (_, c) => cell[`${c},${r}`]);
    const edge = ids.map((id) => (known.has(id) ? `+${'-'.repeat(BOX)}+` : ' '.repeat(BOX + 2))).join('   ');
    let mid = '';
    ids.forEach((id, c) => {
      if (!known.has(id)) mid += ' '.repeat(BOX + 2);
      else if (!lit(id)) { const [a, b] = pad('?'); mid += `|${a}?${b}|`; } else {
        const label = (id === at ? '@' : '') + WORLD[id].label;
        const [a, b] = pad(label);
        mid += `|${a}<a href="${esc(roomHref(id))}">${esc(label)}</a>${b}|`;
      }
      if (c < cols - 1) mid += linked(id, ids[c + 1]) ? '---' : '   ';
    });
    out += `${edge}\n${mid}\n${edge}\n`;
    if (r < rows - 1) {
      out += ids.map((id, c) => {
        const half = ' '.repeat(Math.floor((BOX + 2) / 2));
        return `${half}${linked(id, cell[`${c},${r + 1}`]) ? '|' : ' '}${half}`;
      }).join('   ').replace(/\s+$/, '') + '\n';
    }
  }
  return `<pre class="map" aria-label="Map of the rooms; visited rooms are links">${out.replace(/[ \n]+$/, '')}</pre>`;
}
/* In the hours theme the map goes on with the realm: Paris in pixels, the Seine, a pennant in
   each school's colours where it stands (hours.js draws it), the arms in the key below. */
const REALM_NAMES = {
  sorbonne: 'Sorbonne Université', paris1: 'Paris 1 Panthéon-Sorbonne', pariscite: 'Université Paris Cité',
  sciencespo: 'Sciences Po', dauphine: 'Paris Dauphine-PSL', ceremade: 'CEREMADE (at Dauphine)',
  saclay: 'Université Paris-Saclay (Orsay, off the map)', ijclab: 'IJCLab (Orsay, off the map)',
};
function realmHtml() {
  const ids = [...new Set((DATA.heraldry.tapestry || []).map(([id]) => id))].filter((id) => REALM_NAMES[id]);
  return `<h3>${T.realmTitle}</h3><canvas class="realm" width="240" height="150" role="img" aria-label="${T.realmLabel}"></canvas>
<ul class="realm-key">${ids.map((id) => `<li><img src="${new URL(`assets/img/arms/${id}.svg`, SITE).href}" alt="" width="13" height="15"> ${REALM_NAMES[id]}</li>`).join('')}</ul>`;
}
function showMap() {
  const realm = root.getAttribute('data-theme') === 'hours' && window.Hours;
  const domain = realm ? `<h3>The domain</h3><p class="domain">${[['village', 'the village and its market'], ['tower', 'up the watchtower'], ['maproom', 'the map room'], ['cellar', 'down to the cellar']]
    .map(([k, l]) => `<button type="button" data-go="${k}">[${l}]</button>`).join(' ')}</p>` : '';
  showDialog(T.mapTitle, mapHtml(here) + domain + (realm ? realmHtml() : ''));
  if (realm) window.Hours.realm(dialog.querySelector('canvas.realm'));
}

/* ---- the guided tour (`tour`): a minute round the castle; any key or click stops it ---------- */
let touring = null;
function tour() {
  if (!window.Hours || root.getAttribute('data-theme') !== 'hours') { say('The tour is for the castle theme.'); return; }
  const H = window.Hours; const steps = [
    [0, () => { if (root.dataset.room) leaveRoom(); say('A one-minute tour. This landscape keeps the real hour, sky and weather over Paris; the castle holds the site, a room for each section.'); }],
    [4000, () => { H.village(); say('The village below the castle: its market, its tavern, its people. Nothing here is needed to read the site.'); }], [11000, () => H.back()],
    [13000, () => { H.tower(); say('The watchtower: the view all round. Click what you see; much of it answers.'); }], [17000, () => H.turn(1)], [20500, () => H.turn(1)], [24000, () => H.turn(1)], [27500, () => H.back()],
    [30000, () => { goTo('experience'); say('The observatory is Experience: every position held. Each thing on the table opens one.'); }],
    [37000, () => { goTo('work'); say('The workshop is Work: a working model for each project, its report and its code.'); }], [44000, () => leaveRoom()],
    [46500, () => say('That is the tour. The menu leads to every room; the button at the bottom right opens the plain text version.')],
  ];
  const timers = steps.map(([ms, f]) => setTimeout(f, ms));
  const stop = (e) => { if (e && e.isTrusted === false) return; timers.forEach(clearTimeout); touring = null; removeEventListener('keydown', stop, true); removeEventListener('pointerdown', stop, true); };
  touring = stop;
  setTimeout(() => { addEventListener('keydown', stop, true); addEventListener('pointerdown', stop, true); }, 300);
  setTimeout(() => { if (touring === stop) stop(); }, 47000);
}

/* ---- the descent (>): first person, loaded on demand ------------------- */

let dungeonLoading = null;
function descend() {
  dungeonLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = DUNGEON_SRC;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
  dungeonLoading.then(() => window.Dungeon.open({
    start: here || 'about',
    world: WORLD,
    links: LINKS,
    site: SITE,
    palette: () => [tokenRGB('--bg'), tokenRGB('--ink'), tokenRGB('--accent')],
    reduceMotion,
    items: (id) => (ITEMS[id] && !pack().includes(id) ? ITEMS[id].name : null),
    enter: (id) => enterRoom(id, true),
    pickUp,
    map: (id) => showDialog(T.mapTitle, mapHtml(id)),
    inventory: showInventory,
    read: (id) => goTo(id),
    vintages: () => vintages().map((v) => v.note),
  }));
}
/** Each year of study as a wine (the descent's racks, the tower's cellar): its year, a tasting note, its courses. */
function vintages() {
  return [...document.querySelectorAll('#coursework .ledger-year')].map((y) => {
    const n = y.querySelectorAll('li').length; const progs = [...y.querySelectorAll('.ledger-prog')].map((p) => p.textContent.split('\u00b7')[0].trim());
    const body = n > 14 ? 'full-bodied' : n > 8 ? 'well-structured' : n > 4 ? 'light and lively' : 'a rare small cuvée';
    const year = y.querySelector('h3').textContent;
    return { year, note: `"${year}", from ${progs.join(' and ')}: ${body}, ${n} courses in the blend.`, html: y.innerHTML };
  });
}
$('descend').addEventListener('click', descend);
document.querySelectorAll('[data-descend]').forEach((b) => b.addEventListener('click', descend));

/* ---- wizard mode (the Konami code) ------------------------------------- */

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiAt = 0;
const dlvl = $('st-dlvl');
const align = $('st-align');
const plain = { dlvl: dlvl.textContent, align: align.textContent };

function toggleWizard() {
  const on = root.classList.toggle('wizard');
  dlvl.textContent = on ? 'WIZ' : plain.dlvl;
  align.textContent = on ? 'chaotic' : plain.align;
  say(on ? T.wizardOn : T.wizardOff);
  print(on ? T.wizardOn : T.wizardOff);
}

/* ---- single-key shortcuts (WCAG 2.1.4: can be switched off) ------------ */

const keysToggle = $('keys-toggle');
const allTabs = [...document.querySelectorAll('.tabs a')];
let keysOn = store('keys') !== 'off';

function setKeys(on) {
  keysOn = on;
  store('keys', on ? 'on' : 'off');
  keysToggle.setAttribute('aria-pressed', String(on));
  keysToggle.querySelector('b').textContent = on ? T.on : T.off;
}
setKeys(keysOn);
keysToggle.addEventListener('click', () => setKeys(!keysOn));

document.addEventListener('keydown', (e) => {
  if (!keysOn || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('dialog[open]')) return; // the dialogs handle their own keys

  konamiAt = e.key === KONAMI[konamiAt] ? konamiAt + 1 : (e.key === KONAMI[0] ? 1 : 0);
  if (konamiAt === KONAMI.length) { konamiAt = 0; toggleWizard(); return; }

  const act = {
    ':': openCmd, '/': () => { openCmd(); cmdIn.value = 'search '; }, '?': showHelp, m: showMap, i: showInventory, '>': descend, p: togglePhoto,
    ',': () => say(here ? pickUp(here) : T.nothingHere),
  }[e.key];
  if (act) { e.preventDefault(); act(); return; }
  const i = Number(e.key) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= allTabs.length) return;
  const link = allTabs[i];
  if (link.getAttribute('href').startsWith('#')) {
    e.preventDefault();
    location.hash = link.getAttribute('href');
  } else {
    link.click();
  }
});

/* ---- arrows move through the menu, as in a game's choice box -----------
   Inside the menu: arrows go to the nearest entry that way (by position on screen, so the
   same code serves the one-row tab bar and the hours theme's two-column box), wrapping at the
   ends; Home and End; Enter follows the link and the cursor stays in the menu (openWindow). From
   anywhere but a control, Left or Right (which do not scroll the page) bring the cursor back to
   the current entry, when single-key shortcuts are on. */

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function nextTab(from, [dx, dy]) {
  const c = (a) => { const r = a.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const [x0, y0] = c(from);
  let best = null; let bestD = Infinity;
  allTabs.forEach((a) => {
    if (a === from) return;
    const [x, y] = c(a);
    const along = (x - x0) * dx + (y - y0) * dy; // distance in the arrow's direction
    const across = Math.abs((x - x0) * dy) + Math.abs((y - y0) * dx);
    if (along <= 1) return;
    const d = along + across * 3; // stay in the same row or column when there is one
    if (d < bestD) { bestD = d; best = a; }
  });
  if (best) return best;
  const i = allTabs.indexOf(from); // nothing further that way: wrap round in reading order
  return allTabs[(i + (dx + dy > 0 ? 1 : -1) + allTabs.length) % allTabs.length];
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  const inMenu = e.target.closest && e.target.closest('.tabs a');
  if (inMenu) {
    let to = null;
    if (ARROWS[e.key]) to = nextTab(inMenu, ARROWS[e.key]);
    else if (e.key === 'Home') [to] = allTabs;
    else if (e.key === 'End') to = allTabs[allTabs.length - 1];
    if (to) { e.preventDefault(); to.focus(); }
    return;
  }
  if (!keysOn || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  if (e.target.closest('a, button, input, textarea, select, summary, [contenteditable]')) return; // a control has the keys
  e.preventDefault();
  (allTabs.find((a) => a.getAttribute('aria-current')) || allTabs[0]).focus();
});

/* ---- Shift held, in a room of the castle: every thing that can be looked at is outlined ---- */
addEventListener('keydown', (e) => { if (e.key === 'Shift' && !e.repeat && window.Hours && window.Hours.reveal && root.classList.contains('room-ready')) window.Hours.reveal(true); });
addEventListener('keyup', (e) => { if (e.key === 'Shift' && window.Hours && window.Hours.reveal) window.Hours.reveal(false); });
addEventListener('blur', () => { if (window.Hours && window.Hours.reveal) window.Hours.reveal(false); });

/* ---- the weathervane's compass rose: where the wind comes from, how hard ---- */
function showRose(dir, kmh) {
  const pts = Array.from({ length: 16 }, (_, k) => { const a = (k * Math.PI) / 8; const r = k % 4 === 0 ? 46 : k % 2 ? 22 : 32; return `${(Math.sin(a) * r).toFixed(1)},${(-Math.cos(a) * r).toFixed(1)}`; });
  const star = Array.from({ length: 16 }, (_, k) => `0,0 ${pts[k]} ${pts[(k + 1) % 16]}`).map((p, k) => `<polygon points="${p}" class="${k % 2 ? 'r-b' : 'r-a'}"/>`).join('');
  const a = (dir * Math.PI) / 180; const ax = Math.sin(a) * 40; const ay = -Math.cos(a) * 40;
  showDialog('The wind over Paris', `<svg class="rose" viewBox="-60 -60 120 120" role="img" aria-label="Wind from ${Math.round(dir)} degrees, ${Math.round(kmh)} km/h">${star}`
    + ['N', 'E', 'S', 'W'].map((l, k) => `<text x="${[0, 54, 0, -54][k]}" y="${[-50, 4, 58, 4][k]}">${l}</text>`).join('')
    + `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${(-ax * 0.6).toFixed(1)}" y2="${(-ay * 0.6).toFixed(1)}" class="r-wind"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3" class="r-wind-from"/></svg>`
    + `<p>From ${Math.round(dir)}°, ${Math.round(kmh)} km/h (Open-Meteo, Paris). The vane points into the wind.</p>`);
}
// the keys 1 to 8 just after the bell was rung: the carillon (and not the menu's shortcuts)
document.addEventListener('keydown', (e) => {
  if (!/^[1-8]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey || !window.Hours || !window.Hours.carillon) return;
  if (e.target instanceof Element && e.target.closest('input, textarea')) return;
  if (window.Hours.carillon(Number(e.key))) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
