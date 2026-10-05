'use strict';

const root = document.documentElement;
const SITE = new URL('.', document.currentScript.src); // the site root: script.js lives there
const DUNGEON_SRC = document.currentScript.dataset.dungeon; // loaded on the first descent
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- the world: one grid for the exits, the map (m) and the descent (>) ---
   From _src/site.toml, via the JSON that build.py writes into every page. Column c, row r;
   `page` rooms are project pages, the others sections of the index. */

const DATA = JSON.parse(document.getElementById('site-data').textContent);
const WORLD = DATA.world;
const LINKS = DATA.links;
const ROOM_IDS = Object.keys(WORLD);

/** URL of a room: a section of the index, or a project page. */
function roomHref(id) {
  return new URL(WORLD[id].page || `#${id}`, SITE).href;
}

/* ---- strings ----------------------------------------------------------- */

const T = {
  weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  month: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'],
  // Chaldean order, slowest to swiftest, as they follow "of"
  planet: ['Saturn', 'Jupiter', 'Mars', 'the Sun', 'Venus', 'Mercury', 'the Moon'],
  phase: ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous',
    'last quarter', 'waning crescent', 'new'],
  date: (d, m, n) => `${d}, the ${ordinal(n)} of ${m}`,
  hour: (day, hour) => `Day of ${day}, hour of ${hour}`,
  moon: (phase, age) => `Moon ${phase}, ${age} days old`,
  stHour: (hour) => `Hour of ${hour}`,
  stMoon: (waxing) => `Moon: ${waxing ? 'waxing' : 'waning'}`,
  on: 'on', off: 'off',
  copied: '[copied]', copyFailed: '[copy failed]',
  explored: 'You have walked every room of this place.',
  unknown: (c) => `Unknown command '${c}'. Try help.`,
  noExit: "You can't go that way.",
  exits: 'Obvious exits',
  noRoom: (r) => `There is no room called '${r}' here.`,
  rooms: 'Rooms',
  nothing: 'Nothing happens.',
  themeSet: (t) => `The lamp turns: ${t === 'light' ? 'folio' : 'terminal'}.`,
  keysSet: (on) => `Single-key shortcuts ${on ? 'on' : 'off'}.`,
  wizardOn: 'You feel a strange vibration under your feet. Wizard mode.',
  wizardOff: 'You feel less magical.',
  seeHere: (item) => `You see here ${item}. (, to pick it up)`,
  nothingHere: 'There is nothing here to pick up.',
  picked: (letter, item) => `${letter} - ${item}.`,
  noSuchItem: (l) => `You don't have that object ('${l}').`,
  rumour: (r) => `You hear a rumour: ${r}`,
  close: '[close]',
  helpTitle: 'Keys and commands',
  help: (nTabs) => `<h3>Keys</h3>
<dl class="keys">
  <div><dt>1&ndash;${nTabs}</dt><dd>open a section</dd></div>
  <div><dt>m</dt><dd>map of the place</dd></div>
  <div><dt>i &middot; ,</dt><dd>inventory &middot; pick up what lies here</dd></div>
  <div><dt>&gt;</dt><dd>descend: walk the site in first person</dd></div>
  <div><dt>:</dt><dd>command line</dd></div>
  <div><dt>?</dt><dd>this help</dd></div>
  <div><dt>Esc</dt><dd>close</dd></div>
</dl>
<p class="dim">Single-key shortcuts can be switched off with <b>keys</b> in the status line.</p>
<h3>Commands, after <kbd>:</kbd></h3>
<dl class="keys">
  <div><dt>look</dt><dd>describe the room</dd></div>
  <div><dt>n s e w</dt><dd>walk through an exit (<i>go north</i> works too)</dd></div>
  <div><dt>ls &middot; map</dt><dd>list the rooms &middot; draw the map</dd></div>
  <div><dt>cd &lt;room&gt;</dt><dd>go to a room, or just type its name</dd></div>
  <div><dt>take &middot; i &middot; use &lt;a-d&gt;</dt><dd>pick up, inventory, use an object</dd></div>
  <div><dt>descend</dt><dd>first-person view (arrows or WASD, Enter reads, Esc leaves)</dd></div>
  <div><dt>rumour</dt><dd>listen</dd></div>
  <div><dt>cv &middot; mail &middot; github</dt><dd>take what you came for</dd></div>
  <div><dt>theme &middot; keys on|off</dt><dd>terminal or folio &middot; single-key shortcuts</dd></div>
  <div><dt>quit</dt><dd>end the visit</dd></div>
</dl>`,
  mapTitle: 'Map',
  invTitle: 'Inventory',
  packEmpty: 'Your pack is empty.',
  endTitleDark: 'Do you want your possessions identified? [ynq] (n) y',
  endTitleLight: 'Finis',
  end: (loot, k, n, mins) => `${loot}
<p>You explored ${k} of ${n} rooms in ${mins}, and leave with your sanity intact.</p>
<p class="dim">Goodbye, traveller.</p>`,
  emptyHanded: '<p>You leave empty-handed.</p>',
  minutes: (m) => (m < 1 ? 'under a minute' : m === 1 ? 'one minute' : `${m} minutes`),
};

// Overheard in the corridors. Each one is true; most come from the pages themselves.
const RUMOURS = [
  'the learning reduced-order model is the cheaper emulator on all four benchmark systems.',
  'the DBMM solver and the R-matrix code agree to a few parts in ten thousand on the diagonal.',
  'a diffusion-limited aggregate in two dimensions has a fractal dimension near 1.71.',
  'the figure-eight orbit of three equal masses was found by Moore in 1993.',
  'planetary hours are unequal: twelve from sunrise to sunset, twelve through the night.',
  'a mean-field game couples a Hamilton-Jacobi-Bellman equation, backward in time, to a Fokker-Planck equation, forward.',
  'Atkinson dithering diffuses only six eighths of the error, which keeps blacks and whites clean.',
  'never trust an emulator outside its parameter box.',
  'the engraving on the wall was printed in 1888 and nobody knows who cut it.',
  'a leapfrog integrator does not conserve energy exactly, but its error does not grow.',
];

/* ---- storage ----------------------------------------------------------- */

function store(key, value, area = 'localStorage') {
  try {
    if (value === undefined) return window[area].getItem(key);
    window[area].setItem(key, value);
  } catch {
    return null; // private mode: preferences just don't persist
  }
  return null;
}
const session = (key, value) => store(key, value, 'sessionStorage');
function sessionList(key) {
  try { return JSON.parse(session(key) || '[]'); } catch { return []; }
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ---- message line ------------------------------------------------------ */

const msgText = document.querySelector('.msg-text');
const moreLink = document.querySelector('.more');
let moreAction = null; // when set, --More-- runs this instead of following its link

function say(text, action = null) {
  msgText.textContent = text;
  moreAction = action;
}
moreLink.addEventListener('click', (e) => {
  if (!moreAction) return;
  e.preventDefault();
  moreAction();
});

/* ---- theme ------------------------------------------------------------- */

const themeToggle = $('theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme, persist) {
  root.setAttribute('data-theme', theme);
  themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
  themeColor.setAttribute('content', theme === 'light' ? '#efe4c8' : '#12100c');
  if (persist) store('theme', theme);
}

applyTheme(root.getAttribute('data-theme'), false);
themeToggle.addEventListener('click', () => {
  applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
});

/** Theme colours as [r, g, b], for the canvases. */
function tokenRGB(prop) {
  const h = getComputedStyle(root).getPropertyValue(prop).trim();
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/* ---- the 404 tombstone names the missing path ------------------------- */

if ($('rip-path')) {
  $('rip-path').textContent = decodeURIComponent(location.pathname);
  $('rip-path').parentElement.hidden = false;
}

/* ---- objects lying in the rooms, and the pack -------------------------- */

const cvHref = () => document.querySelector('.links a[href*="CV"]').href;

const ITEMS = {
  about: { name: 'a scroll labelled CURRICULUM VITAE', verb: 'read', use: () => { location.href = cvHref(); } },
  publications: { name: 'a scroll labelled BIBTEX', verb: 'copy', use: () => copyFrom(new URL(DATA.bib, SITE).href) },
  contact: { name: 'a raven quill', verb: 'write', use: () => { location.href = `mailto:${DATA.email}`; } },
  projects: { name: 'a lodestone that points to github', verb: 'follow', use: () => { location.href = DATA.github; } },
};
const LETTERS = 'abcdefgh';

const pack = () => sessionList('pack');

function pickUp(id) {
  const p = pack();
  if (!ITEMS[id] || p.includes(id)) return T.nothingHere;
  p.push(id);
  session('pack', JSON.stringify(p));
  return T.picked(LETTERS[p.length - 1], ITEMS[id].name);
}

function useItem(letter) {
  const id = pack()[LETTERS.indexOf(letter)];
  if (!id) return T.noSuchItem(letter);
  ITEMS[id].use();
  return '';
}

function lootHtml() {
  const p = pack();
  if (!p.length) return '';
  return `<ul class="loot">${p.map((id, i) => `<li><b>${LETTERS[i]}</b> - ${esc(ITEMS[id].name)} `
    + `<button type="button" data-use="${LETTERS[i]}">[${ITEMS[id].verb}]</button></li>`).join('')}</ul>`;
}

async function copyFrom(href) {
  try {
    const res = await fetch(href);
    if (!res.ok) throw new Error(res.status);
    await navigator.clipboard.writeText(await res.text());
    say('The scroll is copied to your clipboard.');
    return true;
  } catch {
    window.open(href, '_blank', 'noopener');
    return false;
  }
}

/* ---- rooms visited (this browser session) ------------------------------ */

const explored = $('st-explored');
if (!session('since')) session('since', String(Date.now()));
const visited = () => sessionList('visited');
let here = null; // the room the reader stands in

/** The reader enters room `id`; `quiet` keeps the message line as it is (first paint). */
function enterRoom(id, quiet = false) {
  here = WORLD[id] ? id : null;
  const v = visited();
  if (here && !v.includes(id)) {
    v.push(id);
    session('visited', JSON.stringify(v));
  }
  explored.hidden = false;
  explored.querySelector('b').textContent = `${v.length}/${ROOM_IDS.length}`;
  if (v.length === ROOM_IDS.length && !session('ended')) {
    session('ended', '1');
    say(T.explored, showEnd);
    return;
  }
  if (quiet || !here) return;
  if (ITEMS[id] && !pack().includes(id)) say(T.seeHere(ITEMS[id].name));
  else if (Math.random() < 0.3) say(T.rumour(RUMOURS[Math.floor(Math.random() * RUMOURS.length)]));
}

/* ---- one window at a time, addressed by the URL hash ------------------- */

const tabLinks = [...document.querySelectorAll('.tabs a[href^="#"]')];
const windows = [...document.querySelectorAll('main > section:not([hidden])')];
const host = document.querySelector('.host');
const isIndex = tabLinks.length > 0;

function currentWindow() {
  return windows.find((w) => !w.classList.contains('is-off')) || windows[0];
}

function openWindow(hash, { userAction }) {
  const target = (hash && document.getElementById(decodeURIComponent(hash.slice(1)))) || null;
  const win = target ? target.closest('main > section') : windows[0];
  if (!windows.includes(win)) return; // e.g. the skip link's #main: leave the windows alone

  windows.forEach((w) => w.classList.toggle('is-off', w !== win));
  tabLinks.forEach((a) => {
    if (a.getAttribute('href') === `#${win.id}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  enterRoom(win.id, !userAction);
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
  const heading = win.querySelector('.room');
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
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

/** Go to room `id`, by hash on the index, by page load elsewhere. */
function goTo(id) {
  const url = new URL(roomHref(id));
  if (isIndex && !WORLD[id].page) location.hash = url.hash;
  else location.href = url.href;
}

/* ---- dialogs: help (?), map (m), inventory (i), the end screen (quit) --- */

const dialog = document.createElement('dialog');
dialog.className = 'scroll';
dialog.setAttribute('aria-labelledby', 'dlg-h');
document.body.append(dialog);
dialog.addEventListener('click', (e) => {
  const use = e.target.closest('[data-use]');
  if (use) { dialog.close(); useItem(use.dataset.use); return; }
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

const showHelp = () => showDialog(T.helpTitle, T.help(document.querySelectorAll('.tabs a').length));
const showInventory = () => showDialog(T.invTitle, lootHtml() || `<p>${T.packEmpty}</p>`);

function showEnd() {
  const mins = Math.floor((Date.now() - Number(session('since') || Date.now())) / 60000);
  showDialog(
    `<span class="when-dark">${T.endTitleDark}</span><span class="when-light">${T.endTitleLight}</span>`,
    T.end(lootHtml() || T.emptyHanded, visited().length, ROOM_IDS.length, T.minutes(mins)),
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
const showMap = () => showDialog(T.mapTitle, mapHtml(here));

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
  }));
}
$('descend').addEventListener('click', descend);

/* ---- command line (:) --------------------------------------------------- */

const cmdForm = $('cmdline');
const cmdIn = $('cmd-in');
const cmdOut = $('cmd-out');
const cmdToggle = $('cmd-toggle');
const cmdHistory = [];
let histAt = 0;

function cmdOpen() { return !cmdForm.hidden; }

function openCmd() {
  cmdForm.hidden = false;
  cmdToggle.setAttribute('aria-expanded', 'true');
  root.classList.add('cmd-on');
  cmdIn.focus();
}
function closeCmd() {
  cmdForm.hidden = true;
  cmdToggle.setAttribute('aria-expanded', 'false');
  root.classList.remove('cmd-on');
  cmdIn.value = '';
  cmdToggle.focus();
}
cmdToggle.addEventListener('click', () => (cmdOpen() ? closeCmd() : openCmd()));

function print(html) { cmdOut.innerHTML = html; }

const DIRS = {
  n: 'n', north: 'n',
  s: 's', south: 's',
  e: 'e', east: 'e',
  w: 'w', west: 'w',
  u: 'u', up: 'u',
  d: 'd', down: 'd',
};

function roomName(win) {
  return win.querySelector('.room').textContent.replace(/~/g, '').trim();
}

function exitList(win) {
  return [...win.querySelectorAll('.exits li')].map((li) => {
    const dir = li.querySelector('.dir').textContent;
    return `${dir} (${esc(li.querySelector('a').textContent)})`;
  }).join(', ');
}

function follow(a) {
  const href = a.getAttribute('href');
  if (href.startsWith('#')) {
    location.hash = href;
  } else {
    session('cmd-walk', '1'); // reopen the command line on the next page
    location.href = a.href;
  }
}

/** Room id for a name typed after cd: an id, a map label, or a tab label. */
function findRoom(name) {
  if (WORLD[name]) return name;
  const byLabel = ROOM_IDS.find((id) => WORLD[id].label === name || WORLD[id].name.toLowerCase() === name);
  if (byLabel) return byLabel;
  const tab = [...document.querySelectorAll('.tabs a')].find((a) => a.textContent.replace(/^\d:/, '').trim() === name);
  return tab ? tab.getAttribute('href').split('#')[1] : null;
}

function walkTo(id) {
  if (!isIndex || WORLD[id].page) session('cmd-walk', '1');
  goTo(id);
}

function run(line) {
  const words = line.trim().toLowerCase().split(/\s+/);
  let [cmd, ...args] = words;
  const arg = args.join(' ');
  if (!cmd) return;
  if (['go', 'walk'].includes(cmd) && args.length) [cmd] = args;

  const win = currentWindow();
  if (DIRS[cmd]) {
    const a = win.querySelector(`.exits li[data-dir="${DIRS[cmd]}"] a`);
    if (!a) return print(T.noExit);
    print('');
    return follow(a);
  }
  switch (cmd) {
    case 'help': case 'h': case '?':
      return showHelp();
    case 'look': case 'l':
      return print(`<b>${esc(roomName(win))}</b><br>${esc(win.dataset.look || '')}<br>`
        + (here && ITEMS[here] && !pack().includes(here) ? `${esc(T.seeHere(ITEMS[here].name))}<br>` : '')
        + `<span class="dim">${T.exits}:</span> ${exitList(win)}.`);
    case 'ls': case 'dir': case 'rooms':
      return print(`<span class="dim">${T.rooms}:</span> ${ROOM_IDS.map((id) => esc(WORLD[id].label)).join('  ')}`);
    case 'map': case 'm':
      return showMap();
    case 'cd': case 'open': case 'cat': {
      if (!arg || arg === '~' || arg === '..') return walkTo('about');
      const id = findRoom(arg);
      if (!id) return print(esc(T.noRoom(arg)));
      print('');
      return walkTo(id);
    }
    case 'take': case 'get': case 'pick': case ',':
      return print(esc(here ? pickUp(here) : T.nothingHere));
    case 'i': case 'inv': case 'inventory':
      return showInventory();
    case 'use': case 'apply': case 'read': case 'quaff':
      return print(esc(useItem(arg || 'a')));
    case 'rumour': case 'rumor': case 'listen':
      return print(esc(T.rumour(RUMOURS[Math.floor(Math.random() * RUMOURS.length)])));
    case 'descend': case '>': case 'down':
      closeCmd();
      return descend();
    case 'cv':
      location.href = cvHref();
      return undefined;
    case 'mail': case 'email':
      location.href = `mailto:${DATA.email}`;
      return undefined;
    case 'github': case 'code':
      location.href = DATA.github;
      return undefined;
    case 'theme': {
      const want = { dark: 'dark', terminal: 'dark', light: 'light', folio: 'light' }[arg]
        || (root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
      applyTheme(want, true);
      return print(T.themeSet(want));
    }
    case 'keys':
      setKeys(arg ? arg !== 'off' : !keysOn);
      return print(T.keysSet(keysOn));
    case 'quit': case 'q': case 'exit':
      return showEnd();
    case 'clear': case 'cls':
      return print('');
    case 'xyzzy': case 'plugh':
      return print(T.nothing);
    case 'wizard': case '#wizard':
      return toggleWizard();
    default: {
      const id = findRoom(words.join(' '));
      if (id) { print(''); return walkTo(id); }
      return print(esc(T.unknown(line.trim())));
    }
  }
}

cmdForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const line = cmdIn.value;
  if (line.trim()) cmdHistory.push(line);
  histAt = cmdHistory.length;
  cmdIn.value = '';
  run(line);
});
cmdIn.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closeCmd(); return; }
  if (e.key === 'ArrowUp' && histAt > 0) { histAt -= 1; cmdIn.value = cmdHistory[histAt]; e.preventDefault(); }
  if (e.key === 'ArrowDown' && histAt < cmdHistory.length) {
    histAt += 1;
    cmdIn.value = cmdHistory[histAt] || '';
    e.preventDefault();
  }
});
if (session('cmd-walk')) {
  sessionStorage.removeItem('cmd-walk');
  openCmd();
}

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
    ':': openCmd, '?': showHelp, m: showMap, i: showInventory, '>': descend,
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

/* ---- BibTeX: [bib] links copy their .bib file; without JS they open it -- */

document.addEventListener('click', async (e) => {
  const link = e.target.closest('.copy-bib');
  if (!link) return;
  e.preventDefault();
  const label = link.textContent;
  link.textContent = (await copyFrom(link.href)) ? T.copied : T.copyFailed;
  setTimeout(() => { link.textContent = label; }, 1500);
});

/* ---- live demos: a 1-bit canvas driven by a simulation ------------------ */

/** Run `sim` in the <figure data-demo> `fig`. `sim` owns a Uint8Array `mask` (1 = ink) of the
 *  canvas size and provides frame() -> bool (false once finished), reset(), readout() -> string,
 *  and a `done` flag. Autoplays while visible unless the reader prefers reduced motion. */
window.Demo = function Demo(fig, sim) {
  const canvas = fig.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const runBtn = fig.querySelector('[data-act="run"]');
  const out = fig.querySelector('.demo-read');
  let wanted = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = false;
  let raf = 0;
  let ink;

  const rgbOf = (prop) => {
    const h = getComputedStyle(root).getPropertyValue(prop).trim();
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  function palette() { ink = [rgbOf('--panel'), rgbOf('--accent')]; }

  function paint() {
    const d = img.data;
    const m = sim.mask;
    for (let i = 0, j = 0; i < m.length; i += 1, j += 4) {
      const c = ink[m[i] ? 1 : 0];
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    out.textContent = sim.readout();
  }

  function label() { runBtn.textContent = wanted && !sim.done ? fig.dataset.pause : fig.dataset.run; }

  function loop() {
    raf = 0;
    if (!(wanted && visible)) return;
    const more = sim.frame();
    paint();
    if (!more) { wanted = false; label(); return; }
    raf = requestAnimationFrame(loop);
  }
  function sync() {
    label();
    if (wanted && visible && !raf) raf = requestAnimationFrame(loop);
  }

  runBtn.addEventListener('click', () => {
    if (sim.done) { sim.reset(); wanted = true; } else wanted = !wanted;
    sync();
  });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }).observe(canvas);
  new MutationObserver(() => { palette(); paint(); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  palette();
  paint();
  sync();
  return {
    restart() { sim.reset(); paint(); wanted = true; sync(); },
    paint,
  };
};

/* ---- almanac: clock, planetary hour, moon, for Paris ------------------- */

const LAT = 48.8566;
const LON = 2.3522;
const DAY_MS = 86400000;
// DAY_RULER[weekday] indexes the Chaldean order of T.planet, Sunday first.
const DAY_RULER = [3, 6, 2, 5, 1, 4, 0];
const rad = Math.PI / 180;

/** Sunrise and sunset (Date) for the local calendar day of `d`, NOAA low-precision
 *  algorithm (~1 min). Paris never has polar day, so both events always exist. */
/** Sun's mean anomaly M and ecliptic longitude lambda (degrees), `days` after J2000.0. */
function sunEcliptic(days) {
  const M = (357.5291 + 0.98560028 * days) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  return { M, lambda: (M + C + 180 + 102.9372) % 360 };
}

function sunTimes(d) {
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const n = Math.round(noon.getTime() / DAY_MS + 2440587.5 - 2451545.0);
  const Jstar = n - LON / 360;
  const { M, lambda } = sunEcliptic(Jstar);
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const decl = Math.asin(Math.sin(lambda * rad) * Math.sin(23.44 * rad));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(decl))
    / (Math.cos(LAT * rad) * Math.cos(decl));
  const H = Math.acos(cosH) / rad;
  const toDate = (jd) => new Date((jd - 2440587.5) * DAY_MS);
  return { rise: toDate(Jtransit - H / 360), set: toDate(Jtransit + H / 360) };
}

/** Planetary hour ruling `now`: 12 unequal hours from sunrise to sunset, 12 from sunset to the
 *  next sunrise; the planetary day starts at sunrise, so before dawn it is still yesterday's. */
function planetaryHour(now) {
  const today = sunTimes(now);
  let dayStart; let n;
  if (now < today.rise) {
    const y = new Date(now.getTime() - DAY_MS);
    const ys = sunTimes(y).set;
    dayStart = y;
    n = 12 + Math.floor((now - ys) / ((today.rise - ys) / 12));
  } else if (now < today.set) {
    dayStart = now;
    n = Math.floor((now - today.rise) / ((today.set - today.rise) / 12));
  } else {
    const tr = sunTimes(new Date(now.getTime() + DAY_MS)).rise;
    dayStart = now;
    n = 12 + Math.floor((now - today.set) / ((tr - today.set) / 12));
  }
  const weekday = dayStart.getDay();
  return { day: T.planet[DAY_RULER[weekday]], hour: T.planet[(DAY_RULER[weekday] + n) % 7] };
}

/** Moon age in days since the last new moon (mean synodic month, ~0.5 day accuracy). */
function moon(now) {
  const synodic = 29.530588853;
  const jd = now.getTime() / DAY_MS + 2440587.5;
  const age = (((jd - 2451550.1) % synodic) + synodic) % synodic;
  const bounds = [1.85, 7.38, 9.23, 14.77, 16.61, 22.15, 24.0, 27.68];
  const i = bounds.findIndex((b) => age < b);
  return { age: Math.floor(age), phase: T.phase[i < 0 ? 8 : i], waxing: age < 14.77 };
}

function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return n + s;
}

const pad = (n) => String(n).padStart(2, '0');

function tick() {
  const now = new Date();
  const ph = planetaryHour(now);
  const m = moon(now);

  $('clock').textContent = `${now.getHours()}:${pad(now.getMinutes())}`;
  $('alm-date').textContent = T.date(T.weekday[now.getDay()], T.month[now.getMonth()], now.getDate());
  $('alm-hour').textContent = T.hour(ph.day, ph.hour);
  $('alm-moon').textContent = T.moon(m.phase, m.age);

  $('st-hour').textContent = T.stHour(ph.hour);
  $('st-moon').textContent = T.stMoon(m.waxing);
}

tick();
setTimeout(() => { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000);

/* ---- armillary sphere: the sky over Paris, now (over the plate) -------- */

/** Equatorial (right ascension, declination; radians) from ecliptic (lambda, beta; degrees),
 *  obliquity of J2000. */
function eclipticToEquatorial(lambda, beta) {
  const e = 23.4393 * rad; const l = lambda * rad; const b = beta * rad;
  return {
    ra: Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)),
  };
}

/** Unit vector (x east, y north, z up) seen from Paris for hour angle H and declination dec. */
function horizontal(H, dec) {
  const p = LAT * rad;
  return [
    -Math.cos(dec) * Math.sin(H),
    Math.cos(p) * Math.sin(dec) - Math.sin(p) * Math.cos(dec) * Math.cos(H),
    Math.sin(p) * Math.sin(dec) + Math.cos(p) * Math.cos(dec) * Math.cos(H),
  ];
}

/** Rings and bodies of the sphere at `now`: horizon and meridian stay put; the equator, the
 *  ecliptic and the pole axis turn with local sidereal time. Moon: ecliptic longitude and
 *  latitude to first order (~1 deg), enough at this size. */
function skyAt(now) {
  const d = now.getTime() / DAY_MS + 2440587.5 - 2451545.0;
  const lst = ((280.46061837 + 360.98564736629 * d + LON) % 360) * rad;
  const eq = (o) => horizontal(lst - o.ra, o.dec);
  const ring = (f) => Array.from({ length: 97 }, (_, i) => f((i / 96) * 2 * Math.PI));
  const Mm = (134.963 + 13.064993 * d) * rad;
  const F = (93.272 + 13.229350 * d) * rad;
  const moonLambda = 218.316 + 13.176396 * d + 6.289 * Math.sin(Mm);
  return {
    rings: [
      { pts: ring((t) => [Math.cos(t), Math.sin(t), 0]), bold: true }, // horizon
      { pts: ring((t) => [0, Math.cos(t), Math.sin(t)]) }, // meridian
      { pts: ring((t) => horizontal(t, 0)) }, // celestial equator
      { pts: ring((t) => eq(eclipticToEquatorial((t / rad), 0))) }, // ecliptic
      { pts: [horizontal(0, -Math.PI / 2), horizontal(0, Math.PI / 2)] }, // pole axis
    ],
    sun: eq(eclipticToEquatorial(sunEcliptic(d).lambda, 0)),
    moon: eq(eclipticToEquatorial(moonLambda, 5.128 * Math.sin(F))),
  };
}

const armillary = $('armillary');
if (armillary) {
  const canvas = armillary.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const N = canvas.width;
  const img = ctx.createImageData(N, N);
  const buf = new Uint8Array(N * N); // 0 ground, 1 ink, 2 accent
  const R = N / 2 - 4;
  const PITCH = 0.42; // camera above the horizon plane, radians
  let yaw = 2.2;
  let spinning = !reduceMotion;
  let sky = skyAt(new Date());
  let last = 0;

  const project = ([x, y, z]) => {
    const c = Math.cos(yaw); const s = Math.sin(yaw);
    const xr = x * c - y * s; const yr = x * s + y * c;
    return [N / 2 + xr * R, N / 2 - (yr * Math.sin(PITCH) + z * Math.cos(PITCH)) * R,
      yr * Math.cos(PITCH) - z * Math.sin(PITCH)]; // last: depth, > 0 behind the centre
  };
  const plot = (x, y, v) => {
    if (x >= 0 && x < N && y >= 0 && y < N) buf[y * N + x] = Math.max(buf[y * N + x], v);
  };
  function line(a, b, bold) {
    let [x0, y0] = [Math.round(a[0]), Math.round(a[1])];
    const [x1, y1] = [Math.round(b[0]), Math.round(b[1])];
    const back = a[2] + b[2] > 0;
    const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!back || (x0 + y0) % 3 === 0) { // the far half dotted, so the sphere reads as solid
        plot(x0, y0, 1);
        if (bold && !back) plot(x0, y0 + 1, 1);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function disc(v, r, fill) {
    const [cx, cy] = project(v).map(Math.round);
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        const q = x * x + y * y;
        if (q <= r * r + r && (fill || q >= (r - 1) * (r - 1) + r - 1)) plot(cx + x, cy + y, 2);
      }
    }
  }
  function draw() {
    buf.fill(0);
    sky.rings.forEach(({ pts, bold }) => {
      const p = pts.map(project);
      for (let i = 1; i < p.length; i += 1) line(p[i - 1], p[i], bold);
    });
    disc(sky.sun, 3, true);
    disc(sky.moon, 2, false);
    const pal = [tokenRGB('--bg'), tokenRGB('--ink'), tokenRGB('--accent')];
    for (let i = 0, j = 0; i < buf.length; i += 1, j += 4) {
      const c = pal[buf[i]];
      img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  function frame(t) {
    if (!spinning) return;
    if (t - last > 66) { // ~15 frames a second is plenty for one turn a minute
      yaw += ((t - last) / 60000) * 2 * Math.PI;
      last = t;
      draw();
    }
    requestAnimationFrame(frame);
  }
  armillary.addEventListener('click', () => {
    spinning = !spinning;
    armillary.setAttribute('aria-pressed', String(!spinning));
    if (spinning) requestAnimationFrame((t) => { last = t; frame(t); });
  });
  setInterval(() => { sky = skyAt(new Date()); if (!spinning) draw(); }, 60000);
  new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  draw();
  if (spinning) requestAnimationFrame((t) => { last = t; frame(t); });
}
