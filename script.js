'use strict';

const root = document.documentElement;
const SITE = new URL('.', document.currentScript.src); // the site root: script.js lives there
const DUNGEON_SRC = document.currentScript.dataset.dungeon; // loaded on the first descent
const HOURS_SRC = document.currentScript.dataset.hours; // loaded with the hours theme
const ARMS_SRC = document.currentScript.dataset.arms; // its coats of arms, before it
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
  themeName: { dark: 'terminal', hours: 'hours' },
  bell: (h) => `The castle bell rings: the hour of ${h}.`,
  realmTitle: 'The realm',
  realmLabel: 'A pixel map of Paris: the Seine, and a pennant where each of the schools stands.',
  narrowTheme: 'The castle needs a wider window: hours opens on screens from 1200 px.',
  leave: '[leave the room \u00b7 Esc]',
  notebook: 'The notebook on the desk',
  lookHint: '(Whatever glints can be looked at: point at it, or Tab to it and press Enter.)',
  charter: 'A charter of enrolment, sealed with the arms of the school.',
  register: 'The register by the door',
  shelf: (name) => `Shelf: ${name}`,
  // a few ways to say a shelf is not catalogued yet, so the sixteen do not all say the same
  shelfEmpty: ['Its catalogue is still to be written.', 'The labels on this shelf are still blank.',
    'No one has catalogued this shelf yet.', 'Dust, and books waiting for their entry in the catalogue.'],
  source: 'where to read it',
  themeSet: (name) => `The lamp turns: ${name}.`,
  skySet: (s) => (s === 'now' ? 'The sky keeps the true hour again.' : `The sky turns to ${s}.`),
  skyHint: 'sky dawn|noon|dusk|night|now (seen in the hours theme)',
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
  <div><dt>&larr; &rarr; &uarr; &darr;</dt><dd>move through the menu, Enter to open</dd></div>
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
  <div><dt>theme &middot; keys on|off</dt><dd>terminal or hours &middot; single-key shortcuts</dd></div>
  <div><dt>sky &lt;hour&gt;</dt><dd>dawn, noon, dusk, night or now, in the hours theme</dd></div>
  <div><dt>quit</dt><dd>end the visit</dd></div>
</dl>`,
  mapTitle: 'Map',
  invTitle: 'Inventory',
  packEmpty: 'Your pack is empty.',
  endTitle: 'Do you want your possessions identified? [ynq] (n) y',
  end: (loot, k, n, mins) => `${loot}
<p>You explored ${k} of ${n} rooms in ${mins}, and leave with your sanity intact.</p>
<p class="dim">Goodbye, traveller.</p>`,
  emptyHanded: '<p>You leave empty-handed.</p>',
  pickTitle: 'Two ways in',
  pick: `<p>The same site, two ways to walk it. You can switch at any time with the button at the bottom right.</p>
<div class="pick">
  <button type="button" data-pick="hours"><b>[the castle]</b><span>a pixel-art landscape under the real sky of Paris; each section is a room to explore</span></button>
  <button type="button" data-pick="dark"><b>[the terminal]</b><span>a text console, quick to read: every section one key away</span></button>
</div>`,
  minutes: (m) => (m < 1 ? 'under a minute' : m === 1 ? 'one minute' : `${m} minutes`),
};

// Overheard in the corridors. Each one is true; most come from the pages themselves.
const RUMOURS = [
  'the learning reduced-order model is the cheaper emulator on all four benchmark systems.',
  'the DBMM solver and an independent R-matrix code agree closely on every benchmark.',
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
    if (value === null) window[area].removeItem(key);
    else window[area].setItem(key, value);
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
/** decodeURIComponent that gives back its input when the URL holds a malformed escape (%E0). */
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
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
const THEMES = ['dark', 'hours']; // the toggle's cycle
// the theme follows the screen (as in the head script): hours needs a wide one
const WIDE = matchMedia('(min-width: 75rem)');
const qTheme = new URLSearchParams(location.search).get('theme');
const chosenTheme = () => (!WIDE.matches ? 'dark' : ((qTheme || store('theme')) === 'dark' ? 'dark' : 'hours'));
const nextTheme = () => THEMES[(THEMES.indexOf(root.getAttribute('data-theme')) + 1) % THEMES.length];

let hoursLoading = null;
function applyTheme(theme, persist) {
  root.setAttribute('data-theme', theme);
  $('theme-next').textContent = `[${T.themeName[nextTheme()]}]`;
  themeColor.setAttribute('content', getComputedStyle(root).getPropertyValue('--bar').trim());
  if (persist) store('theme', theme);
  if (theme === 'hours') {
    const load = (src) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
    hoursLoading ||= load(ARMS_SRC).then(() => load(HOURS_SRC)).then(() => window.Hours.start({
      plate: document.querySelector('.plate-img'),
      sky: () => skyAt(skyNow()),
      reduceMotion,
      heraldry: DATA.heraldry,
      say, // the scene's characters answer in the message line
      items: roomItems, // what each room holds, to be drawn as things
      spots: setSpots, // and where those things ended up
      rumour: () => RUMOURS[Math.floor(Math.random() * RUMOURS.length)], // the knight tells it
      descend, // the cellar door in the rock
      doors: roomDoors, // the doors in the rooms' side walls
    })).then(() => { if (session('ended')) window.Hours.hoist(true); });
  }
}

applyTheme(root.getAttribute('data-theme'), false);
themeToggle.addEventListener('click', () => applyTheme(nextTheme(), true));
WIDE.addEventListener('change', () => applyTheme(chosenTheme(), false));

/** Theme colours as [r, g, b], for the canvases. */
function tokenRGB(prop) {
  const h = getComputedStyle(root).getPropertyValue(prop).trim();
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/* ---- the 404 tombstone names the missing path ------------------------- */

if ($('rip-path')) {
  $('rip-path').textContent = decode(location.pathname);
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
  return `<ul class="loot">${p.map((id, i) => `<li data-item="${id}"><b>${LETTERS[i]}</b> - ${esc(ITEMS[id].name)} `
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
const windows = [...document.querySelectorAll('main > section:not([hidden])')];
const host = document.querySelector('.host');
const isIndex = tabLinks.length > 0;

// deno-lint-ignore no-unused-vars -- cmdline.js
function currentWindow() {
  return windows.find((w) => !w.classList.contains('is-off')) || windows[0];
}

function openWindow(hash, { userAction, animate = userAction }) {
  const target = (hash && document.getElementById(decode(hash.slice(1)))) || null;
  const win = target ? target.closest('main > section') : windows[0];
  if (!windows.includes(win)) return; // e.g. the skip link's #main: leave the windows alone

  windows.forEach((w) => w.classList.toggle('is-off', w !== win));
  tabLinks.forEach((a) => {
    if (a.getAttribute('href') === `#${win.id}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  enterRoom(win.id, !userAction);
  // the hours theme: a section shown is a room of the castle; no hash at all, the landscape
  if (target) root.dataset.room = win.id; else delete root.dataset.room;
  if (target && userAction && root.getAttribute('data-theme') === 'hours') {
    const empty = win.querySelector('.empty:not([hidden])');
    const hint = !session('hinted') && wideRooms() ? T.lookHint : ''; // once a visit: how the rooms work
    if (hint) session('hinted', '1');
    say([win.dataset.look, empty && empty.textContent.trim(), hint].filter(Boolean).join(' '));
  }
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

/* ---- leaving a room (hours theme): Esc, the parchment's button; on a project page, home ---- */

function leaveRoom() {
  if (!isIndex) { location.href = SITE.href; return; }
  history.pushState(null, '', location.pathname + location.search);
  openWindow('', { userAction: false, animate: true });
  const cur = [...document.querySelectorAll('.tabs a')].find((a) => a.getAttribute('aria-current'));
  if (cur) cur.focus();
}
if (!isIndex) { // a project page is a room already: the workshop
  const page = ROOM_IDS.find((id) => WORLD[id].page && location.pathname.endsWith(WORLD[id].page));
  if (page) { root.dataset.room = page; if (!window.Hours) root.classList.add('room-ready'); }
}
{
  const leave = document.createElement('button');
  leave.type = 'button';
  leave.className = 'leave';
  leave.textContent = T.leave;
  leave.addEventListener('click', leaveRoom);
  document.body.append(leave); // outside main: in the castle's rooms main is for readers only
}
/* ---- the hours theme's rooms: what a section holds, as things in the room ----------------
   Each piece of a section (a lab, a project, a book, a letter, a degree...) becomes an object
   the room draws (hours.js, from this list); here, a real button lies over it, and opens a card
   beside it with the piece itself. The section stays in the page for readers without the
   picture; the card only shows it where the object is. */

/** The castle's rooms show their content as things only on wide screens (the plate fills the page). */
const wideRooms = () => matchMedia('(min-width: 75rem)').matches;

function roomItems(id) {
  const sec = isIndex && document.getElementById(id);
  if (!sec) return [];
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const of = (sel, kind, f) => [...sec.querySelectorAll(sel)].map((el) => ({ kind, ...f(el) }));
  switch (id) {
    case 'about': {
      const sheet = sec.querySelector('.sheet').cloneNode(true);
      [...sheet.children].forEach((d) => { if (d.querySelector('[data-arms]')) d.remove(); });
      return [{ kind: 'desk-book', label: T.notebook, html: `<h3>${T.notebook}</h3>${sec.querySelector('.lede').outerHTML}${sheet.outerHTML}` },
        ...of('.sheet span[data-arms]', 'charter', (el) => ({ arms: el.dataset.arms, label: text(el), html: `<h3>${esc(text(el))}</h3><p>${T.charter}</p>` }))];
    }
    case 'research': return of('.entry', 'scroll', (el) => ({ arms: el.dataset.arms, label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'projects': return of('article.project', 'model', (el) => ({ model: el.id, label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'publications': { // the works face out on the ledge; then the shelves, and the volumes on them
      const lib = DATA.library || {};
      const vols = (lib.volumes || []).map((b) => ({ ...b, url: /^https?:\/\//.test(b.url || '') ? b.url : '' })); // web links only
      const volume = (b) => `<b>${b.url ? `<a href="${esc(b.url)}" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</b>`
        + `, ${esc(b.author)}${b.year ? ` (${esc(b.year)})` : ''}${b.note ? `<br><span class="dim">${esc(b.note)}</span>` : ''}`;
      return [
        ...of('.pub', 'book', (el) => ({ label: text(el.querySelector('.pub-title')), html: el.innerHTML })),
        ...(lib.shelves || []).map(([sid, name], k) => {
          const here = vols.filter((b) => b.shelf === sid);
          return { kind: 'shelf', shelf: sid, label: T.shelf(name), html: `<h3>${esc(T.shelf(name))}</h3>`
            + (here.length ? `<ul>${here.map((b) => `<li>${volume(b)}</li>`).join('')}</ul>` : `<p>${T.shelfEmpty[k % T.shelfEmpty.length]}</p>`) };
        }),
        ...vols.map((b) => ({ kind: 'volume', shelf: b.shelf, label: b.title, html: `<h3>${esc(b.title)}</h3>`
          + `<p>${esc(b.author)}${b.year ? `, ${esc(b.year)}` : ''}</p>${b.note ? `<p class="dim">${esc(b.note)}</p>` : ''}`
          + (b.url ? `<p><a href="${esc(b.url)}" rel="noopener">${T.source}</a></p>` : '') })),
      ];
    }
    case 'news': return of('.news li', 'letter', (el) => ({ label: text(el.querySelector('time')), html: el.innerHTML }));
    case 'talks': return of('.entry', 'banner', (el) => ({ label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'teaching': return of('.entry', 'course', (el) => ({ label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'contact': {
      const things = [...sec.querySelectorAll('.kv div')].map((d) => {
        const k = text(d.querySelector('dt'));
        return { kind: { email: 'letterbox', code: 'lodestone', based: 'map' }[k] || 'note', label: k, html: `<h3>${esc(k)}</h3><p>${d.querySelector('dd').innerHTML}</p>` };
      });
      const col = sec.querySelector('.colophon');
      if (col) things.push({ kind: 'register', label: T.register, html: `<h3>${T.register}</h3>${col.outerHTML}` });
      return things;
    }
    default: return [];
  }
}

const spots = document.createElement('div');
spots.className = 'spots';
document.body.append(spots);
const card = document.createElement('div');
card.className = 'card';
card.hidden = true;
card.setAttribute('role', 'dialog');
card.innerHTML = `<button type="button" class="card-close" aria-label="${T.close}">&times;</button><div class="card-body"></div>`;
document.body.append(card);
let spotItems = []; let cardFrom = null;

/** hours.js hands over where the objects are (viewport px) and what they are. */
function setSpots(rects, items) {
  spotItems = items;
  closeCard(false);
  spots.replaceChildren(...rects.flatMap((r, i) => { // (no rect: the thing found no room in the picture)
    if (!r) return [];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    Object.assign(b.style, { left: `${r.l}px`, top: `${r.t}px`, width: `${r.w}px`, height: `${r.h}px` });
    b.setAttribute('aria-label', items[i].label);
    b.dataset.label = items[i].label;
    const lit = (on) => window.Hours && window.Hours.highlight(on ? i : -1);
    b.addEventListener('pointerenter', () => lit(true));
    b.addEventListener('pointerleave', () => lit(document.activeElement === b));
    b.addEventListener('focus', () => lit(true));
    b.addEventListener('blur', () => lit(false));
    b.addEventListener('click', () => openCard(i, b));
    return [b];
  }));
}
/** The doors out of room `id`, from the section's exits: { dir: n|e|s|w, label, go }. */
function roomDoors(id) {
  const sec = document.getElementById(id);
  return sec ? [...sec.querySelectorAll('.exits li')].map((li) => {
    const a = li.querySelector('a'); const dir = li.querySelector('.dir').textContent.trim();
    const href = a.getAttribute('href'); // '#research', or a project page's path
    const go = ROOM_IDS.find((r) => href === `#${r}` || (WORLD[r].page && href.endsWith(WORLD[r].page))) || null;
    return { kind: 'door', dir: dir[0], label: `${dir}: ${a.textContent.trim()}`, go, html: '' };
  }).filter((d) => d.go) : [];
}

function openCard(i, from) {
  const it = spotItems[i];
  if (it.go) { goTo(it.go); return; } // a door: through it
  card.querySelector('.card-body').innerHTML = it.html;
  card.dataset.kind = it.kind;
  card.setAttribute('aria-label', it.label);
  card.hidden = false;
  const r = from.getBoundingClientRect();
  const cw = card.offsetWidth; const ch = card.offsetHeight;
  const top0 = document.querySelector('.msgline').getBoundingClientRect().bottom + 12;
  const bot0 = document.querySelector('.status').getBoundingClientRect().top - 12;
  let left = r.right + 18; let side = 'left';
  if (left + cw > innerWidth - 12) { left = r.left - 18 - cw; side = 'right'; }
  left = Math.max(12, Math.min(innerWidth - cw - 12, left));
  const top = Math.max(top0, Math.min(bot0 - ch, r.top + r.height / 2 - ch / 2));
  Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  card.dataset.side = side;
  card.style.setProperty('--tail-y', `${Math.max(14, Math.min(ch - 14, r.top + r.height / 2 - top))}px`);
  cardFrom = from;
  card.querySelector('.card-close').focus();
}
function closeCard(refocus = true) {
  if (card.hidden) return;
  card.hidden = true;
  if (refocus && cardFrom) cardFrom.focus();
}
card.querySelector('.card-close').addEventListener('click', () => closeCard());
card.addEventListener('keydown', (e) => { // Tab stays in the card while it is open; Esc (below) closes it
  if (e.key !== 'Tab') return;
  const f = [...card.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.closest('[hidden]'));
  if (!f.length) return;
  const first = f[0]; const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
document.addEventListener('pointerdown', (e) => {
  if (!card.hidden && !card.contains(e.target) && !e.target.closest('.spot')) closeCard(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !root.dataset.room || root.getAttribute('data-theme') !== 'hours') return;
  if (document.querySelector('dialog[open]') || cmdOpen()) return;
  e.preventDefault();
  if (!card.hidden) { closeCard(); return; } // Esc: first the card, then the room
  leaveRoom();
});

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
  const pick = e.target.closest('[data-pick]');
  if (pick) { dialog.close(); applyTheme(pick.dataset.pick, true); return; }
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

/* First visit on a wide screen, no choice stored: offer the two themes (the castle is drawn behind).
   Narrow screens have the terminal only, so nothing to choose. */
if (WIDE.matches && !qTheme && !store('theme')) {
  showDialog(T.pickTitle, T.pick);
  dialog.addEventListener('close', () => { if (!store('theme')) store('theme', root.getAttribute('data-theme')); }, { once: true });
}

const showHelp = () => showDialog(T.helpTitle, T.help(document.querySelectorAll('.tabs a').length));
const showInventory = () => showDialog(T.invTitle, lootHtml() || `<p>${T.packEmpty}</p>`);

function showEnd() {
  const mins = Math.floor((Date.now() - Number(session('since') || Date.now())) / 60000);
  showDialog(
    T.endTitle,
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
  showDialog(T.mapTitle, mapHtml(here) + (realm ? realmHtml() : ''));
  if (realm) window.Hours.realm(dialog.querySelector('canvas.realm'));
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
  }));
}
$('descend').addEventListener('click', descend);

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

/* ---- BibTeX: [bib] links copy their .bib file; without JS they open it -- */

document.addEventListener('click', async (e) => {
  const link = e.target.closest('.copy-bib');
  if (!link) return;
  e.preventDefault();
  const label = link.textContent;
  link.textContent = (await copyFrom(link.href)) ? T.copied : T.copyFailed;
  setTimeout(() => { link.textContent = label; }, 1500);
});

/* ---- almanac: clock, planetary hour, moon, for Paris ------------------- */


function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return n + s;
}

const pad = (n) => String(n).padStart(2, '0');

/* The hours theme's sky can be set to another hour (`sky` command, or ?sky= in the URL, for
   screenshots): the same day in Paris at a sun altitude of SKY_ALT[name] degrees. */
const SKY_ALT = { dawn: 4, noon: 38, dusk: -4, night: -30 }; // dusk: below the -3 deg night line
const skyParam = new URLSearchParams(location.search).get('sky');
if (Object.hasOwn(SKY_ALT, skyParam || '')) session('sky', skyParam);

/** The instant the sky shows: now, or the hour of today whose sun altitude is SKY_ALT[name],
 *  morning side for dawn, evening side for dusk and night (found by bisection). */
function skyNow() {
  const name = session('sky');
  const now = new Date();
  if (!Object.hasOwn(SKY_ALT, name || '')) return now;
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  const alt = (t) => Math.asin(skyAt(new Date(t)).sun[2]) / rad;
  if (name === 'noon') return new Date(t0);
  const sign = name === 'dawn' ? -1 : 1;
  let lo = 0; let hi = 12 * 3600e3; // from noon outwards: the altitude only falls
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (alt(t0 + sign * mid) > SKY_ALT[name]) lo = mid; else hi = mid;
  }
  return new Date(t0 + sign * lo);
}

/** data-sky: the hours theme's day or night palette (same threshold as the inline head script). */
function updateSky() {
  const night = Math.asin(skyAt(skyNow()).sun[2]) / rad < -3;
  if (root.getAttribute('data-sky') !== (night ? 'night' : 'day')) {
    root.setAttribute('data-sky', night ? 'night' : 'day');
    themeColor.setAttribute('content', getComputedStyle(root).getPropertyValue('--bar').trim());
  }
  if (window.Hours) window.Hours.update();
}

function tick() {
  const now = new Date();
  const p = planetaryHour(now);
  const ph = { day: T.planet[p.day], hour: T.planet[p.hour] };
  const m = moon(now);
  m.phase = T.phase[m.phase];

  $('clock').textContent = `${now.getHours()}:${pad(now.getMinutes())}`;
  $('alm-date').textContent = T.date(T.weekday[now.getDay()], T.month[now.getMonth()], now.getDate());
  $('alm-hour').textContent = T.hour(ph.day, ph.hour);
  $('alm-moon').textContent = T.moon(m.phase, m.age);

  $('st-hour').textContent = T.stHour(ph.hour);
  $('st-moon').textContent = T.stMoon(m.waxing);
  updateSky();
  if (lastHour && ph.hour !== lastHour && window.Hours) { // the castle bell marks the turn of the hour
    window.Hours.ring();
    if (root.getAttribute('data-theme') === 'hours') say(T.bell(ph.hour));
  }
  lastHour = ph.hour;
}
let lastHour = null;

tick();
setTimeout(() => { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000);
