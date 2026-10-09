// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

const root = document.documentElement;
const SITE = new URL('../../../', document.currentScript.src); // the site root (this file is assets/js/ui/1-core.js)
const DUNGEON_SRC = document.currentScript.dataset.dungeon; // loaded on the first descent
const HOURS_SRC = document.currentScript.dataset.hours; // loaded with the hours theme
const ARMS_SRC = document.currentScript.dataset.arms; // its coats of arms, before it
const TEX_SRC = document.currentScript.dataset.textures; // and its textures
const ART_SRC = document.currentScript.dataset.art; // and its drawings
const PHYSICS_SRC = document.currentScript.dataset.physics; // and its small simulations
const SOUND_SRC = document.currentScript.dataset.sound; // ambient sound, loaded when switched on
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// the sections' old names (before experience and work), in links made since: read as the new ones
const RENAMED = { '#research': '#experience', '#projects': '#work' };
if (RENAMED[location.hash]) history.replaceState(history.state, '', location.pathname + location.search + RENAMED[location.hash]);
// ?og: the view _tools/og.py photographs for the link preview (the name over the landscape)
if (new URLSearchParams(location.search).has('og')) document.documentElement.classList.add('og');

/* ---- the world: one grid for the exits, the map (m) and the descent (>) ---
   From _src/site.toml, via the JSON that build.py writes into every page. Column c, row r;
   `page` rooms are project pages, the others sections of the index. */

const DATA = JSON.parse(document.getElementById('site-data').textContent);
const WORLD = DATA.world;
const LINKS = DATA.links;
const ROOM_IDS = Object.keys(WORLD);

/** URL of a room: a section of the index. */
function roomHref(id) {
  return new URL(`#${id}`, SITE).href;
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
  wxName: { clear: 'Clear skies', cloudy: 'Some clouds', overcast: 'Overcast', fog: 'Fog', drizzle: 'Drizzle', showers: 'Showers',
    rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm' },
  weather: (w) => `${T.wxName[w.kind]} over Paris${w.temp == null ? '' : `, ${w.temp} \u00b0C`}`,
  wxSet: (k) => (k === 'now' ? 'The weather is the true one again.' : `The weather turns: ${k}.`),
  wxHint: 'weather clear|cloudy|overcast|fog|drizzle|showers|rain|snow|storm|now (seen in the hours theme)',
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
  engineOpen: '[the engine]', engineClose: '[back to the castle]', engineTitle: 'The scrying engine (Esc closes it)',
  bell: (h) => `The castle bell rings: the hour of ${h}.`,
  realmTitle: 'The realm',
  realmLabel: 'A pixel map of Paris: the Seine, and a pennant where each of the schools stands.',
  leave: '[leave the room \u00b7 Esc]',
  backTo: (room) => `Back to ${room}, where you left off?`,
  backYes: '[yes, take me]',
  backGone: 'The castle, as it stands today.',
  youSee: 'You see',
  examineHint: 'examine &lt;thing&gt; looks closer (x for short).',
  examineWhat: 'Examine what? look lists what is here.',
  noThing: (a) => `There is no ${a} here. look lists what is.`,
  pin: '[pin it to the wall]',
  unpin: '[take it down]',
  pinnedUp: (l) => `You pin it to the wall: ${l}.`,
  takenDown: (l) => `You take it down: ${l}.`,
  breakSeal: 'Break the seal and read the letter',
  breakHint: 'Drag the seal away to break it (or press Enter).',
  planTitle: 'The plan of the castle',
  planNote: (k, n) => `${k} of ${n} rooms walked this visit (inked); click one to go there.`,
  skyAt: (hm) => `The sky over Paris at ${hm}: let go, and it goes back to now.`,
  narrowTheme: 'The castle needs a wider window: hours opens on screens from 1200 px.',
  notebook: 'The notebook on the desk',
  vintage: 'Vintage', stairDown: 'The steps going down',
  lookHint: '(Whatever glints can be looked at: point at it, or Tab to it and press Enter.)',
  charter: 'A charter of enrolment, sealed with the arms of the school.',
  register: 'The register by the door',
  shelf: (name) => `Shelf: ${name}`,
  // a few ways to say a shelf is not catalogued yet, so the sixteen do not all say the same
  shelfEmpty: ['Its catalogue is still to be written.', 'The labels on this shelf are still blank.',
    'No one has catalogued this shelf yet.', 'Dust, and books waiting for their entry in the catalogue.'],
  source: 'where to read it',
  ledger: 'The book of courses',
  pages: 'Pages', prevPage: 'Previous page', nextPage: 'Next page',
  themeSet: (name) => `The lamp turns: ${name}.`,
  skySet: (s) => (s === 'now' ? 'The sky keeps the true hour again.' : `The sky turns to ${s}.`),
  skyHint: 'sky dawn|noon|dusk|night|now (seen in the hours theme)',
  keysSet: (on) => `Single-key shortcuts ${on ? 'on' : 'off'}.`,
  wizardOn: 'You feel a strange vibration under your feet. Wizard mode.',
  wizardOff: 'You feel less magical.',
  seeHere: (item) => `You see here ${item}. (, to pick it up)`,
  nothingHere: 'There is nothing here to pick up.',
  eventsAre: 'event &lt;name&gt;, one of:', noEvent: (n) => `No event called "${n}". Type event alone for the list.`,
  borrowed: 'What the castle borrows from the world (turned into its pixels and its music)',
  signName: 'Your name:', signIt: 'sign',
  signedHere: 'Signed here from this browser (the page stays with you; nothing is sent):',
  signNone: 'No one has signed from this browser yet. The page stays with you; nothing is sent.',
  signDone: (n) => `The ink dries: ${n}, in the castle's register.`,
  billiardTitle: "The tavern's billiard table",
  billiardAlt: 'A stadium-shaped billiard table, two balls drawing their tracks',
  billiardText: 'At the back of the tavern, a table the shape of a stadium: two half-circles joined by straight cushions (Bunimovich, 1979). Two balls leave the same spot a millionth of a radian apart. For a few cushions they run together; then they part for good, and each in time crosses every part of the table: chaos. On a round table they would stay together for ever.',
  billiardCount: (n, d) => `${n} cushions; the balls are ${d < 0.01 ? d.toExponential(1) : d.toFixed(1)} px apart.`,
  peddlerWants: 'The peddler leans on his barrow: "A tale for a trinket, traveller. Seen anything curious hereabouts? Come back when you have."',
  peddlerGives: (what, letter) => `You tell the peddler about ${what}. "Worth a brass astrolabe, that one." (${letter} - in your pack: i)`,
  peddlerDone: 'The peddler tips his hat: "Mind the astrolabe, it was my grandmother\'s."',
  picked: (letter, item) => `${letter} - ${item}.`,
  noSuchItem: (l) => `You don't have that object ('${l}').`,
  rumour: (r) => `You hear a rumour: ${r}`,
  close: '[close]',
  helpTitle: 'Keys and commands',
  help: (nTabs) => `<div class="help">
<section><h3>Keys</h3>
<dl class="keys">
  <div><dt><kbd>1</kbd>&ndash;<kbd>${nTabs}</kbd></dt><dd>open a section</dd></div>
  <div><dt><kbd>&larr;</kbd><kbd>&rarr;</kbd><kbd>&uarr;</kbd><kbd>&darr;</kbd></dt><dd>the menu; <kbd>Enter</kbd></dd></div>
  <div><dt><kbd>m</kbd></dt><dd>the map</dd></div>
  <div><dt><kbd>i</kbd> <kbd>,</kbd></dt><dd>your pack &middot; pick up</dd></div>
  <div><dt><kbd>&gt;</kbd></dt><dd>descend, in first person</dd></div>
  <div><dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>the curiosities in sight</dd></div>
  <div><dt><kbd>p</kbd></dt><dd>photo of the landscape</dd></div>
  <div><dt><kbd>:</kbd> <kbd>?</kbd></dt><dd>command line &middot; this help</dd></div>
  <div><dt><kbd>Esc</kbd></dt><dd>close, leave</dd></div>
</dl>
<p class="dim">Single keys off: <b>keys</b>, in the status line.</p></section>
<section><h3>Walking</h3>
<dl class="keys">
  <div><dt>look</dt><dd>describe the room</dd></div>
  <div><dt>n s e w</dt><dd>through an exit</dd></div>
  <div><dt>cd &lt;room&gt;</dt><dd>go there (or just its name)</dd></div>
  <div><dt>ls &middot; map</dt><dd>the rooms &middot; their map</dd></div>
  <div><dt>descend</dt><dd>walk it in first person</dd></div>
  <div><dt>take &middot; i &middot; use</dt><dd>pick up, look, use</dd></div>
</dl></section>
<section><h3>The castle</h3>
<dl class="keys">
  <div><dt>sky &lt;hour&gt;</dt><dd>dawn, noon, dusk, night</dd></div>
  <div><dt>weather &lt;kind&gt;</dt><dd>rain, snow, fog, storm&hellip;</dd></div>
  <div><dt>event &lt;name&gt;</dt><dd>dragon, bolt, rider&hellip;</dd></div>
  <div><dt>tour</dt><dd>a minute's guided walk</dd></div>
  <div><dt>tower &middot; village</dt><dd>the view &middot; the market</dd></div>
  <div><dt>photo</dt><dd>the landscape, to save</dd></div>
  <div><dt>rumour</dt><dd>listen to the knight</dd></div>
  <div><dt>engine</dt><dd>the terminal, and back</dd></div>
  <div><dt>gate</dt><dd>the front page asks again</dd></div>
  <div><dt>search &lt;words&gt; &middot; /</dt><dd>what in the site holds them</dd></div>
  <div><dt>whoami &middot; history</dt><dd>the site in brief &middot; your commands</dd></div>
  <div><dt>paper</dt><dd>the terminal on light paper</dd></div>
</dl></section>
<section><h3>Music</h3>
<dl class="keys">
  <div><dt>music list</dt><dd>the book of tunes</dd></div>
  <div><dt>music &lt;n&gt;</dt><dd>play a tune (number or word)</dd></div>
  <div><dt>music next</dt><dd>another, for the hour</dd></div>
  <div><dt>music air</dt><dd>the lute's own air</dd></div>
  <div><dt>music off &middot; on</dt><dd>silence, or play again</dd></div>
  <div><dt>volume &lt;0&ndash;10&gt;</dt><dd>how loud</dd></div>
</dl></section>
<section><h3>The rest</h3>
<dl class="keys">
  <div><dt>cv &middot; mail</dt><dd>the CV &middot; write to me</dd></div>
  <div><dt>github</dt><dd>the code</dd></div>
  <div><dt>keys on|off</dt><dd>single-key shortcuts</dd></div>
  <div><dt>quit</dt><dd>end the visit</dd></div>
</dl></section>
</div>`,
  mapTitle: 'Map',
  invTitle: 'Inventory',
  packEmpty: 'Your pack is empty.',
  endTitle: 'Do you want your possessions identified? [ynq] (n) y',
  end: (loot, k, n, mins) => `${loot}
<p>You explored ${k} of ${n} rooms in ${mins}, and leave with your sanity intact.</p>
<p class="dim">Goodbye, traveller.</p>`,
  emptyHanded: '<p>You leave empty-handed.</p>',
  volume: 'Volume of the sound', musicSet: (on) => `The lute ${on ? 'plays again' : 'falls silent'}.`, volumeSet: (v) => `Volume ${v} of 10.`,
  musicState: (on) => (on ? 'The lute is playing.' : 'The lute is silent.'), nowPlaying: (t) => `Now: <b>${t}</b>.`,
  musicHint: 'music list: the tunes; music &lt;n&gt;: one of them; music next, music air, music off.',
  musicCastle: 'The music plays in the castle: the terminal is silent (engine, to go back).',
  airName: "the lute's own air, made up as it goes, in the mode of the hour's planet",
  tunesHint: 'music &lt;n&gt; or a word of its title plays it now; then the hour chooses again.',
  airNow: "Back to the lute's own air.", noTunes: 'The book of tunes has not come (offline?).',
  noSuchTune: (w) => `No tune "${w}" in the book: music list shows them.`,
  photoSave: '[save the picture]', photoClose: '[back \u00b7 p or Esc]',
  photoOnly: 'Photo mode is for the castle: switch theme first.',
  curiosFound: (k, n) => `You found ${k} of the land's ${n} curiosities:`,
  allCurios: 'You know every curiosity of this land. The wizard nods, impressed.',
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

/* Visits from this browser (kept): the visitor's own oak in the castle's meadow puts on a ring each. */
if (!session('counted')) {
  session('counted', '1');
  store('visits', String(Number(store('visits') || 0) + 1));
  if (!store('firstVisit')) store('firstVisit', String(Date.now()));
}
const visits = () => ({ n: Number(store('visits') || 1), first: Number(store('firstVisit')) || null });

const $ = (id) => document.getElementById(id);
/** decodeURIComponent that gives back its input when the URL holds a malformed escape (%E0). */
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ---- message line ------------------------------------------------------ */

const msgText = document.querySelector('.msg-text');
const moreLink = document.querySelector('.more');
let moreAction = null; // when set, --More-- runs this instead of following its link

/* What was said is kept (the chronicle: the last twenty, a click on the line shows them). A line that
   comes while the last has been up less than a second and a half waits its turn: --More-- shows it at
   once, else it comes after two seconds and a half. `now`: a line that replaces (a dragged sun, a choice
   being made): it never waits. */
const chronicle = [[`${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}`, msgText.textContent.trim()]]; const pending = []; let saidAt = 0; let pendTimer = 0; let moreLabel = null;
function say(text, action = null, { now: at0 = false } = {}) {
  if (!text || text === msgText.textContent) { moreAction = action ?? moreAction; return; }
  if (!at0 && performance.now() - saidAt < 1500 && msgText.textContent) {
    if (pending.length < 3) pending.push([text, action]);
    showMore(); clearTimeout(pendTimer); pendTimer = setTimeout(nextSaid, 2500); return;
  }
  show(text, action);
}
function show(text, action) {
  msgText.textContent = text; moreAction = action; saidAt = performance.now();
  const d = new Date(); chronicle.unshift([`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`, text]); chronicle.length = Math.min(chronicle.length, 20);
  showMore();
}
function nextSaid() { const n = pending.shift(); if (n) show(...n); if (pending.length) pendTimer = setTimeout(nextSaid, 2500); }
function showMore() { // --More (2)--: lines waiting; else the link's own words
  const lbl = moreLink.querySelector('.lbl'); moreLabel ??= lbl.innerHTML;
  lbl.innerHTML = pending.length ? `--More (${pending.length})--` : moreLabel;
}
moreLink.addEventListener('click', (e) => {
  if (pending.length) { e.preventDefault(); clearTimeout(pendTimer); nextSaid(); return; }
  if (!moreAction) return;
  e.preventDefault();
  moreAction();
});
{ // the chronicle: a click on the line (not on its link) unrolls what was said, newest first
  const box = document.createElement('div'); box.className = 'chronicle'; box.hidden = true; box.setAttribute('role', 'log'); box.setAttribute('aria-label', 'What was said');
  document.body.append(box);
  msgText.addEventListener('click', () => {
    if (root.classList.contains('climb')) return; // (the tower's line opens on a tap: its own)
    if (!box.hidden) { box.hidden = true; return; }
    box.innerHTML = chronicle.length ? `<ol>${chronicle.map(([t, x]) => `<li><time>${t}</time> ${esc(x)}</li>`).join('')}</ol>` : '<p>Nothing said yet.</p>';
    box.style.top = `${document.querySelector('.msgline').getBoundingClientRect().bottom}px`; box.hidden = false;
  });
  document.addEventListener('pointerdown', (e) => { if (!box.hidden && !box.contains(e.target) && e.target !== msgText) box.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) { box.hidden = true; e.stopImmediatePropagation(); } }, true);
  msgText.title = 'Click: what was said';
}

{ // the glass's afterglow: 80 ms of trail on scrolling (cmdline: glass)
  let off = 0;
  addEventListener('scroll', () => { if (!root.hasAttribute('data-glass')) return; root.classList.add('scrolling'); clearTimeout(off); off = setTimeout(() => root.classList.remove('scrolling'), 80); }, { passive: true });
}
