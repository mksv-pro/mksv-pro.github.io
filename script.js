'use strict';

const root = document.documentElement;
const SITE = new URL('.', document.currentScript.src); // the site root: script.js lives there
const DUNGEON_SRC = document.currentScript.dataset.dungeon; // loaded on the first descent
const HOURS_SRC = document.currentScript.dataset.hours; // loaded with the hours theme
const ARMS_SRC = document.currentScript.dataset.arms; // its coats of arms, before it
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
// the theme as in the head script: the castle, whose narrow form is the tower (.climb)
const WIDE = matchMedia('(min-width: 75rem) and (min-aspect-ratio: 1/1)'); // (as in the head script)
const qTheme = new URLSearchParams(location.search).get('theme');
const FRAMED = window.self !== window.top; // this page is the terminal in the castle's scrying engine
// a touch screen (or ?touch=1): below 75rem it gets the tower; a computer's narrow window, the terminal
const TOUCH = matchMedia('(pointer: coarse)');
const touchy = () => TOUCH.matches || /[?&]touch=1/.test(location.search);
const chosenTheme = () => (FRAMED || qTheme === 'dark' || (!WIDE.matches && (!touchy() || store('entry') === 'engine')) ? 'dark' : 'hours');
const climbing = () => root.classList.contains('climb');
const nextTheme = () => THEMES[(THEMES.indexOf(root.getAttribute('data-theme')) + 1) % THEMES.length];

let hoursLoading = null;
function applyTheme(theme, persist) {
  root.setAttribute('data-theme', theme);
  document.querySelectorAll('.lbl[data-castle]').forEach((e) => { // the bars' words: the castle's, or the terminal's
    e.dataset.term ||= e.textContent; e.textContent = theme === 'hours' ? e.dataset.castle : e.dataset.term;
  });
  $('theme-next').textContent = FRAMED ? T.engineClose : theme === 'hours' ? T.engineOpen : `[${T.themeName[nextTheme()]}]`;
  root.classList.toggle('climb', theme === 'hours' && !WIDE.matches && !FRAMED);
  themeToggle.hidden = !FRAMED && theme !== 'hours' && !WIDE.matches && !touchy(); // (a computer's narrow window has the terminal only)
  document.querySelectorAll('#cellar, .tabs .to-cellar').forEach((e) => { e.hidden = !root.classList.contains('climb'); });
  themeColor.setAttribute('content', getComputedStyle(root).getPropertyValue('--bar').trim());
  if (persist) store('theme', theme);
  // the terminal on a narrow screen (who chose it): under a banner of the living landscape (unless `banner off`)
  root.classList.toggle('banner', !FRAMED && !WIDE.matches && store('banner') !== 'off' && theme !== 'hours');
  if (theme === 'hours' || root.classList.contains('banner')) {
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
      descend, // the descent (the cellar's steps, >)
      cellar: () => { location.hash = '#cellar'; }, // the door in the rock: into the cellar
      doors: roomDoors, // the doors in the rooms' side walls
      clock: skyNow, // the instant shown: dawn mist, the night's meteor shower
      found: findCurio, // a curiosity of the landscape, clicked
      curios: () => ({ found: curios(), all: CURIOS }), // for the gatehouse's cabinet
      now: nowHtml, // the tavern's slate: what is going on, from the page itself
      visits, // the visitor's oak, a ring a visit
      news: latestNews, // the wizard's reading, the messenger's letter
      dreams: dreamsOf, // what the knight dreams of, asleep by the fire
      trade, // the peddler's bargain
      staleness, // cobwebs in the rooms left alone
      billiard: showBilliard, // the tavern's table, through its door (the village close up)
    })).then(() => { if (session('ended')) window.Hours.hoist(true); showWeather(); fetchKp(); });
  }
}

applyTheme(root.getAttribute('data-theme'), false);
themeToggle.addEventListener('click', () => engineToggle());
WIDE.addEventListener('change', () => { applyTheme(chosenTheme(), false); openWindow(location.hash, { userAction: false }); });

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

/* ---- for the castle's people: the latest news (and how old), what the knight dreams of ---- */

/** The newest piece of news: its text and its age in days (from its <time>, a month: its first). */
function latestNews() {
  const li = document.querySelector('#news .news li');
  if (!li) return null;
  const t = li.querySelector('time'); const when = new Date(`${t ? t.getAttribute('datetime') : ''}`.padEnd(10, '-01').slice(0, 10));
  const span = li.querySelector('span');
  const age = new URLSearchParams(location.search).has('rider') ? 1 : (Date.now() - when) / 864e5;
  return { text: (span || li).textContent.replace(/\s+/g, ' ').trim(), age: Number.isFinite(age) ? age : 999 };
}
/** The research and the projects, as dreams: a name and a few words to find a picture by. */
function dreamsOf() {
  const pick = (sel) => [...document.querySelectorAll(sel)].map((el) => ({
    name: el.querySelector('h3').textContent.trim(), words: el.textContent.replace(/\s+/g, ' ').slice(0, 400) }));
  return [...pick('#experience .entry'), ...pick('#work article.project')];
}

/* ---- objects lying in the rooms, and the pack -------------------------- */

const cvHref = () => document.querySelector('.links a[href*="CV"]').href;

const ITEMS = {
  about: { name: 'a scroll labelled CURRICULUM VITAE', verb: 'read', use: () => { location.href = cvHref(); } },
  publications: { name: 'a scroll labelled BIBTEX', verb: 'copy', use: () => copyFrom(new URL(DATA.bib, SITE).href) },
  contact: { name: 'a raven quill', verb: 'write', use: () => { location.href = `mailto:${DATA.email}`; } },
  work: { name: 'a lodestone that points to github', verb: 'follow', use: () => { location.href = DATA.github; } },
  // the peddler's, for a tale of something curious (the hours theme's landscape)
  astrolabe: { name: "a brass astrolabe, the peddler's", verb: 'sight', use: () => {
    const alt = Math.asin(skyAt(skyNow()).sun[2]) / rad;
    say(alt > 0 ? `You sight the Sun through the astrolabe: ${alt.toFixed(0)}\u00b0 above the horizon of Paris.` : `The Sun is ${(-alt).toFixed(0)}\u00b0 below the horizon; you sight the pole star instead, ${LAT_DEG.toFixed(0)}\u00b0 up, as high as Paris is north.`);
  } },
};
const LAT_DEG = 48.8566;
/** The peddler offers his astrolabe for the tale of a curiosity found (one, once). */
function trade() {
  const c = curios().filter((k) => k !== 'peddler'); // (a tale of something else than himself)
  if (pack().includes('astrolabe')) return T.peddlerDone;
  if (!c.length) return T.peddlerWants;
  const p = pack(); p.push('astrolabe'); session('pack', JSON.stringify(p));
  return T.peddlerGives(CURIOS[c[Math.floor(Math.random() * c.length)]], LETTERS[p.length - 1]);
}
const LETTERS = 'abcdefgh';

const pack = () => sessionList('pack').map((id) => (id === 'projects' ? 'work' : id)); // (a pack filled before the rename)

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

/* ---- ambient sound (castle theme), off by default; the choice is remembered ------------
   Browsers start audio only after a gesture: a stored 'on' waits for the first click or key. */

const soundBtn = $('sound-toggle');
let soundOn = store('sound') === 'on'; let soundLoading = null;
function soundState() {
  const r = root.dataset.room || null; const room = r && WORLD[r] && WORLD[r].page ? 'workshop' : r; // project pages: the workshop
  return {
    on: soundOn && root.getAttribute('data-theme') === 'hours' && !document.hidden,
    wx: currentWx(), night: root.getAttribute('data-sky') === 'night', room,
    echo: ['talks', 'experience', 'contact', 'work', 'workshop'].includes(room), // the stone rooms
    summer: [5, 6, 7].includes(new Date().getMonth()),
    ...(() => { // where, close up; the hour in Paris (the angelus, the birds); what goes on in the village
      const d = skyNow(); const p = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const h = p.getHours(); const wd = p.getDay(); const alt = Math.asin(skyAt(d).sun[2]) / rad;
      return {
        place: root.classList.contains('village') ? 'village' : root.classList.contains('lookout') ? 'tower' : null,
        sunAlt: alt, planet: planetaryHour(d).hour, // (the dawn chorus by the light; the lute's mode by the planetary hour)
        pan: window.Hours && window.Hours.pans ? window.Hours.pans() : {}, // where things stand on the screen
        cinema: Boolean(window.Hours && window.Hours.cinema && window.Hours.cinema()), // the lantern show (its clatter)
        office: window.Hours && window.Hours.office ? window.Hours.office() : null, // the chapel's office now (its chant)
        hour: h, minute: p.getMinutes(), day: p.toDateString(), month: p.getMonth(), dawn: alt > -6 && alt < 10 && h < 12,
        market: window.Hours && window.Hours.market ? window.Hours.market() : [0, 3, 5, 6].includes(wd) && alt > 0, forge: wd !== 0 && h >= 7 && h < 18, tavern: h >= 18 || h < 1,
      };
    })(),
  };
}
/** A sound for something that just happened (when the sound is on). */
const cue = (name) => { if (soundOn && window.Sound) window.Sound.cue(name); };
function setSound(on) {
  soundOn = on;
  store('sound', on ? 'on' : 'off');
  soundBtn.setAttribute('aria-pressed', String(on));
  root.classList.toggle('sound-on', on);
  soundBtn.querySelector('b').textContent = on ? T.on : T.off;
  if (!on) { if (window.Sound) window.Sound.stop(); return; }
  soundLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = SOUND_SRC; s.onload = resolve; s.onerror = reject; document.head.append(s);
  });
  soundLoading.then(() => { window.Sound.setMusic(musicOn); applyVolume(); window.Sound.start(soundState); });
}
soundBtn.addEventListener('click', () => setSound(!soundOn));
const volume = document.createElement('input'); // its volume, beside it while the sound is on
Object.assign(volume, { type: 'range', min: 0, max: 10, step: 1, className: 'sound-volume' });
volume.setAttribute('aria-label', T.volume);
volume.value = String(Math.round(Number(store('volume') ?? 6)));
soundBtn.after(volume);
const applyVolume = () => { store('volume', volume.value); if (window.Sound) window.Sound.setVolume(Number(volume.value) / 10); };
volume.addEventListener('input', applyVolume);
let musicOn = store('music') !== 'off';
// deno-lint-ignore no-unused-vars -- cmdline.js
function setMusic(on) { musicOn = on; store('music', on ? 'on' : 'off'); if (window.Sound) window.Sound.setMusic(on); }
if (soundOn) {
  soundBtn.setAttribute('aria-pressed', 'true'); soundBtn.querySelector('b').textContent = T.on;
  const wake = () => { setSound(true); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);
}

/* ---- photo mode (p): the landscape alone; the picture of the moment can be saved ----- */

const photoBar = document.createElement('div');
photoBar.className = 'photo-bar';
photoBar.hidden = true;
photoBar.innerHTML = `<button type="button" data-photo="save">${T.photoSave}</button> <button type="button" data-photo="close">${T.photoClose}</button>`;
document.body.append(photoBar);
function togglePhoto(on = !root.classList.contains('photo')) {
  if (on && root.getAttribute('data-theme') !== 'hours') { say(T.photoOnly); return; }
  root.classList.toggle('photo', on);
  photoBar.hidden = !on;
  if (on) photoBar.querySelector('button').focus();
}
function savePhoto() { // the scene's own pixels, enlarged without blur
  const src = document.querySelector('.plate-img canvas');
  if (!src) return;
  const k = Math.max(1, Math.round(1920 / src.width));
  const out = document.createElement('canvas');
  out.width = src.width * k; out.height = src.height * k;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, out.width, out.height);
  // a cartouche at the foot: where, when, the weather, whose castle
  const d = skyNow(); const w = currentWx();
  const when = d.toLocaleString('en-GB', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const line = `Paris, ${when}${w ? ` \u00b7 ${T.weather(w).replace(' over Paris', '')}` : ''} \u00b7 ${new URL(SITE).host}`;
  const fs = Math.round(out.height / 42); g.font = `${fs}px "Departure Mono", monospace`;
  const tw = g.measureText(line).width; const pad = fs * 0.7;
  g.fillStyle = 'rgba(244, 236, 216, 0.92)'; g.fillRect(pad, out.height - fs * 2.6, tw + 2 * pad, fs * 1.9);
  g.strokeStyle = '#16121c'; g.lineWidth = Math.max(2, fs / 8); g.strokeRect(pad, out.height - fs * 2.6, tw + 2 * pad, fs * 1.9);
  g.fillStyle = '#16121c'; g.fillText(line, 2 * pad, out.height - fs * 1.25);
  out.toBlob(async (blob) => {
    const name = `castle-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { // a phone: share it
      try { await navigator.share({ files: [file], title: 'The castle, now' }); return; } catch { /* declined: save it instead */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
photoBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-photo]');
  if (b) { if (b.dataset.photo === 'save') savePhoto(); else togglePhoto(false); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && root.classList.contains('photo')) { e.preventDefault(); togglePhoto(false); }
});

/* ---- curiosities: the things of the hours landscape that answer a click (this session) ---- */

const CURIOS = {
  wizard: 'the wizard', knight: 'the knight', shield: "the knight's arms", fire: 'the fire', cat: 'the cats',
  horse: "the knight's horse", cellar: 'the cellar door', mill: 'the windmill', heron: 'the heron',
  angler: 'the patient angler', owl: 'the owl (by night)', meteor: 'a wish on a falling star (clear nights)',
  lichen: 'the lichen on the rock', watch: 'the view from the watchtower', planet: 'a planet (twilight, night)',
  murmuration: 'starlings at dusk (autumn, winter)', fireflies: 'fireflies (summer nights)', burn: "Saint John's fire (23 June)", seep: 'the springs after rain',
  ferry: 'the ferryman', flock: 'the flock', joust: 'a tournament (first Sundays)', wmill: 'the water mill', quarry: 'the quarry', falls: 'the waterfall', bees: 'the bees', orchard: 'the orchard', market: 'the market crowd (close up, on market days)',
  sapling: 'your own oak', gauge: 'the river gauge', dream: "the knight's dream (late at night)", peddler: 'the peddler (on the road, now and then)',
  scribe: 'the copyist at his window (evenings)', ants: 'the ants (warm days)', shoal: 'the shoal (bright days)',
  skip: 'a stone skimmed on the river', billiard: "the tavern's billiard table",
  facade: "the castle's stone, in Monet's light", hunters: "Bruegel's hunters (snowy days)", skaters: 'the skaters (hard frost)',
};
const curios = () => sessionList('curios');
function showCurios() {
  const el = $('st-curios');
  if (!el) return;
  el.hidden = !curios().length;
  el.querySelector('b').textContent = `${curios().length}/${Object.keys(CURIOS).length}`;
}
function findCurio(kind) {
  const c = curios();
  if (!CURIOS[kind] || c.includes(kind)) return;
  c.push(kind);
  session('curios', JSON.stringify(c));
  showCurios();
  if (c.length === Object.keys(CURIOS).length) setTimeout(() => say(T.allCurios), 2500);
}
function curiosHtml() {
  const c = curios();
  return c.length ? `<p>${T.curiosFound(c.length, Object.keys(CURIOS).length)} ${c.map((k) => esc(CURIOS[k])).join(', ')}.</p>` : '';
}
showCurios();

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
const windows = [...document.querySelectorAll('main > section:not([hidden]):not(#cellar)')];
const host = document.querySelector('.host');
const isIndex = tabLinks.length > 0;

// deno-lint-ignore no-unused-vars -- cmdline.js
function currentWindow() {
  return windows.find((w) => !w.classList.contains('is-off')) || windows[0];
}

function openWindow(hash, { userAction, animate = userAction }) {
  const target = (hash && document.getElementById(decode(hash.slice(1)))) || null;
  const win = target ? target.closest('main > section') : windows[0];
  towerLayout();
  if (target && win === cellar && !climbing()) { // the castle's cellar (through the door in the rock): a room of its own, out of the menu
    if (root.getAttribute('data-theme') !== 'hours') { descend(); return; }
    windows.forEach((w) => w.classList.add('is-off'));
    tabLinks.forEach((a) => a.removeAttribute('aria-current'));
    root.dataset.room = 'cellar';
    if (userAction) { say(cellar.dataset.look); cue('door'); }
    if (window.Hours) window.Hours.room('cellar', { animate });
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
  if (target) root.dataset.room = win.id; else delete root.dataset.room;
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
const wideRooms = () => WIDE.matches;

// ?fill=N (a check): each room that grows with the years given N of its things, copies of its own (or
// made up where it has none yet), to see it hold them: the room shows what fits and archives the rest
const FILL = Math.min(200, Number(new URLSearchParams(location.search).get('fill')) || 0);
const GROWS = { experience: 'scroll', work: 'model', publications: 'book', talks: 'banner', teaching: 'course', news: 'letter' };
function roomItems(id) {
  const items = roomItemsOf(id); const kind = GROWS[id];
  if (!FILL || !kind) return items;
  const mine = items.filter((t) => (t.kind || 'book') === kind); const rest = items.filter((t) => (t.kind || 'book') !== kind);
  const seed = mine.length ? mine : [{ kind, label: `A ${kind}`, html: `<h3>A ${kind}</h3><p>Made up by ?fill.</p>` }];
  return [...Array.from({ length: FILL }, (_, k) => ({ ...seed[k % seed.length], label: `${seed[k % seed.length].label} (${k + 1})` })), ...rest];
}
function roomItemsOf(id) {
  const sec = isIndex && document.getElementById(id);
  if (!sec) return [];
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const of = (sel, kind, f) => [...sec.querySelectorAll(sel)].map((el) => ({ kind, ...f(el) }));
  switch (id) {
    case 'about': {
      const sheet = sec.querySelector('.sheet').cloneNode(true);
      [...sheet.children].forEach((d) => { if (d.querySelector('[data-arms]')) d.remove(); });
      return [{ kind: 'desk-book', label: T.notebook, html: `<h3>${T.notebook}</h3>${sec.querySelector('.lede').outerHTML}${sheet.outerHTML}` },
        ...of('.sheet span[data-arms]', 'charter', (el) => ({ arms: el.dataset.arms, label: text(el), html: `<h3>${esc(text(el))}</h3><p>${T.charter}</p>` })),
        ...(() => { // the book of courses, open on its lectern by the desk
          const led = document.getElementById('coursework');
          if (!led) return [];
          const body = [...led.querySelectorAll('.ledger-year')].map((y) => y.outerHTML).join('');
          return [{ kind: 'ledger', label: T.ledger, html: `<h3>${T.ledger}</h3><p class="dim">${esc(text(led.querySelector('summary .meta')))}</p>${body}` }];
        })()];
    }
    case 'experience': return of('.entry', 'scroll', (el) => ({ arms: el.dataset.arms, label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'work': return of('article.project', 'model', (el) => ({ model: el.id, label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'publications': { // the works face out on the ledge; then the shelves, and the volumes on them
      const lib = DATA.library || {};
      const vols = (lib.volumes || []).map((b) => ({ ...b, url: /^https?:\/\//.test(b.url || '') ? b.url : '' })); // web links only
      const volume = (b) => `<b>${b.url ? `<a href="${esc(b.url)}" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</b>`
        + `, ${esc(b.author)}${b.year ? ` (${esc(b.year)})` : ''}${b.note ? `<br><span class="dim">${esc(b.note)}</span>` : ''}`;
      return [
        ...of('.pub', 'book', (el) => { // its title becomes the book's heading
          const c = el.cloneNode(true); const t = c.querySelector('.pub-title');
          if (t) t.outerHTML = `<h3>${t.innerHTML}</h3>`;
          const fig = /nuclear-emulators/.test(el.innerHTML) ? '<figure class="pub-fig"><canvas width="260" height="80"></canvas><figcaption>A wave packet meets a nuclear barrier: part goes through, part comes back (computed as you watch).</figcaption></figure>' : '';
          return { label: text(el.querySelector('.pub-title')), html: c.innerHTML + fig };
        }),
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
    case 'news': return of('.news li', 'letter', (el) => { // the date heads the letter, the rest is its text
      const t = el.querySelector('time'); const rest = el.cloneNode(true); rest.querySelector('time').remove();
      return { label: text(t), html: `<h3>${t.outerHTML}</h3><p>${rest.innerHTML.trim()}</p>` };
    });
    case 'talks': return of('.entry', 'banner', (el) => ({ label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'teaching': return of('.entry', 'course', (el) => ({ label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'cellar': // a rack for each year of study, and the steps on down (the descent)
      return [...vintages().map((v) => ({ kind: 'vintage', label: `${T.vintage} ${v.year}`, html: `<p class="dim">${esc(v.note)}</p>${v.html}` })),
        { kind: 'stair', label: T.stairDown, act: descend }];
    case 'contact': {
      const things = [...sec.querySelectorAll('.kv div')].map((d) => {
        const k = text(d.querySelector('dt'));
        return { kind: { email: 'letterbox', code: 'lodestone', based: 'map' }[k] || 'note', label: k, html: `<h3>${esc(k)}</h3><p>${d.querySelector('dd').innerHTML}</p>` };
      });
      const col = sec.querySelector('.colophon');
      const mail = sec.querySelector('a[href^="mailto:"]');
      const sign = mail ? `<p><a href="${mail.getAttribute('href')}?subject=${encodeURIComponent("The castle's guestbook")}&amp;body=${encodeURIComponent('Name:\nFrom:\n\nA word for the register:\n')}">[sign the guestbook]</a> <span class="dim">(it opens a letter; I copy the kind ones in by hand)</span></p>` : '';
      const book = `<form class="sign-form"><label>${T.signName} <input name="who" maxlength="40" autocomplete="nickname" required></label> <button type="submit">[${T.signIt}]</button></form><div class="signed">${signedHtml()}</div>`;
      if (col) things.push({ kind: 'register', label: T.register, html: `<h3>${T.register}</h3>${col.outerHTML}${book}${sign}${creditsHtml()}` });
      return things;
    }
    default: return [];
  }
}

/** Whose works the castle borrows (paintings, films, scores, texts...), as hours.js's index lists them. */
function creditsHtml() {
  const c = window.Hours && window.Hours.credits ? window.Hours.credits() : [];
  const seen = new Set(); const rows = c.filter((x) => { const k = `${x.title}|${x.author}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!rows.length) return '';
  const link = (x) => (/^https?:\/\//.test(x.source || '') ? `<a href="${esc(x.source)}" rel="noopener">${esc(x.title)}</a>` : esc(x.title));
  return `<h4>${T.borrowed}</h4><ul class="credits">${rows.map((x) => `<li>${link(x)}${x.author ? `, ${esc(x.author)}` : ''}${x.year ? ` (${esc(x.year)})` : ''}${x.licence ? ` <span class="dim">${esc(x.licence)}</span>` : ''}</li>`).join('')}</ul>`;
}
/** The register's local page: names signed in this browser (never sent anywhere). */
const signatures = () => { try { return JSON.parse(store('signatures') || '[]'); } catch { return []; } };
function signedHtml() {
  const s = signatures();
  return s.length ? `<p class="dim">${T.signedHere}</p><ul>${s.map(([n, t]) => `<li>${esc(n)}, ${new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</li>`).join('')}</ul>` : `<p class="dim">${T.signNone}</p>`;
}
document.addEventListener('submit', (e) => {
  const f = e.target.closest('.sign-form');
  if (!f) return;
  e.preventDefault();
  const who = f.who.value.trim().slice(0, 40);
  if (!who) return;
  const s = signatures(); s.push([who, Date.now()]); store('signatures', JSON.stringify(s.slice(-30)));
  f.reset(); f.nextElementSibling.innerHTML = signedHtml(); say(T.signDone(who));
});

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

/** What is going on, gathered from the page: the studies under way, the last news, the projects. */
/** Today's fare at the tavern (hours.js: from Taillevent's Viandier), as HTML; '' before it has come. */
function fareHtml(full) {
  const f = window.Hours && window.Hours.fare ? window.Hours.fare() : null;
  if (!f || !f.dishes.length) return '';
  const day = `${f.lean ? 'a lean day' : 'a fat day'} (${f.why}): ${f.lean ? 'fish, no meat' : 'meat'}`;
  if (!full) return `<p><b>Today's fare</b>, ${day}: ${f.dishes.map((d) => esc(d.name)).join('; ')}.</p>`;
  return `<h4>Today's fare</h4><p class="dim">From the <i>Viandier</i> of Taillevent, cook to Charles V; ${day}. The book's own words under each dish.</p><ul class="fare">`
    + f.dishes.map((d) => `<li><b>${esc(d.name)}</b>: ${esc(d.what.join(', '))}.<details><summary>Taillevent</summary><i lang="frm">${esc(d.text)}</i></details></li>`).join('') + '</ul>';
}
function nowHtml() {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const studying = [...document.querySelectorAll('#about .sheet dd')][0];
  const news = document.querySelector('#news .news li');
  const projects = [...document.querySelectorAll('#work article.project h3')].map(txt);
  return `<h3>On the tavern's slate</h3><p class="dim">What is going on, chalked up by the landlord.</p>`
    + (studying ? `<p><b>Studying:</b> ${txt(studying)}</p>` : '') + (news ? `<p><b>Latest news:</b> ${txt(news)}</p>` : '')
    + (projects.length ? `<p><b>At the workbench:</b> ${projects.join('; ')}.</p>` : '') + fareHtml(false);
}

/* The report's figure, alive: a wave packet meets a nuclear barrier (Woods-Saxon), part through,
   part back; |psi|^2 by Crank-Nicolson on a 1D grid (hbar = m = 1). The dynamics the emulators
   in the report learn to reproduce, not one of its results. */
function waveFig(canvas) {
  const N = 220; const dx = 0.25; const dt = 0.05; const L = N * dx;
  const V = Array.from({ length: N }, (_, j) => { const x = j * dx - L * 0.55; return 1.3 / (1 + Math.exp((Math.abs(x) - 2.2) / 0.35)); });
  let re; let im;
  const reset = () => {
    re = new Float64Array(N); im = new Float64Array(N);
    for (let j = 0; j < N; j += 1) { const x = j * dx - L * 0.25; const g = Math.exp(-(x * x) / 4); re[j] = g * Math.cos(1.5 * x); im[j] = g * Math.sin(1.5 * x); }
  };
  reset();
  const step = () => { // (1 + iH dt/2) psi' = (1 - iH dt/2) psi, Thomas algorithm on the complex tridiagonal system
    const a = dt / (4 * dx * dx); const br = new Float64Array(N); const bi = new Float64Array(N);
    for (let j = 0; j < N; j += 1) {
      const l = j ? j - 1 : j; const r = j < N - 1 ? j + 1 : j; const d = 2 * a + (dt / 2) * V[j];
      // rhs = psi - i (dt/2) H psi, with (dt/2) H psi = -a (psi_r + psi_l) + d psi
      const hr = -a * (re[r] + re[l]) + d * re[j]; const hi = -a * (im[r] + im[l]) + d * im[j];
      br[j] = re[j] + hi; bi[j] = im[j] - hr;
    }
    const cr = new Float64Array(N); const ci = new Float64Array(N); const dr = new Float64Array(N); const di = new Float64Array(N);
    // matrix: diag 1 + i d_j, off-diag -i a
    for (let j = 0; j < N; j += 1) {
      let mRe = 1; let mIm = 2 * a + (dt / 2) * V[j]; let rRe = br[j]; let rIm = bi[j]; // the diagonal, 1 + i d_j; the rhs
      if (j) { // m -= (-i a) * c[j-1]; r -= (-i a) * d[j-1]
        mRe -= a * ci[j - 1]; mIm += a * cr[j - 1]; rRe -= a * di[j - 1]; rIm += a * dr[j - 1];
      }
      const den = mRe * mRe + mIm * mIm;
      cr[j] = (-a * mIm) / den; ci[j] = (-a * mRe) / den; // c = (-i a) / m
      dr[j] = (rRe * mRe + rIm * mIm) / den; di[j] = (rIm * mRe - rRe * mIm) / den;
    }
    for (let j = N - 1; j >= 0; j -= 1) {
      if (j < N - 1) { dr[j] -= cr[j] * re[j + 1] - ci[j] * im[j + 1]; di[j] -= cr[j] * im[j + 1] + ci[j] * re[j + 1]; }
      re[j] = dr[j]; im[j] = di[j];
    }
  };
  let tick = 0;
  const draw = () => {
    if (!canvas.isConnected) return;
    for (let k = 0; k < 4; k += 1) step();
    if ((tick += 1) > 260) { reset(); tick = 0; }
    const g = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height; const ink = getComputedStyle(canvas).color;
    g.clearRect(0, 0, w, h); g.strokeStyle = ink; g.globalAlpha = 0.35; g.beginPath();
    V.forEach((v, j) => { const x = (j / N) * w; const y = h - 4 - v * h * 0.5; if (j) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    g.globalAlpha = 1; g.beginPath();
    for (let j = 0; j < N; j += 1) { const x = (j / N) * w; const y = h - 4 - (re[j] ** 2 + im[j] ** 2) * h * 0.8; if (j) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    if (!reduceMotion) requestAnimationFrame(draw);
  };
  draw();
}

/** hours.js hands over where the objects are (viewport px) and what they are. */
function setSpots(rects, items) {
  spotItems = items;
  closeCard(false);
  // the tower: the buttons ride in the picture's frame as it scrolls (viewport px made the picture's own)
  const inTower = climbing(); const pr = plateEl.getBoundingClientRect(); const dx = inTower ? pr.left : 0; const dy = inTower ? pr.top : 0;
  const home0 = inTower ? plateEl : document.body; if (spots.parentElement !== home0) home0.append(spots);
  spots.replaceChildren(...rects.flatMap((r, i) => { // (no rect: the thing found no room in the picture)
    if (!r) return [];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    Object.assign(b.style, { left: `${r.l - dx}px`, top: `${r.t - dy}px`, width: `${r.w}px`, height: `${r.h}px` });
    b.setAttribute('aria-label', items[i].label);
    b.dataset.label = items[i].label;
    const lit = (on) => window.Hours && window.Hours.highlight(on ? i : -1);
    b.addEventListener('pointerenter', () => lit(true));
    b.addEventListener('pointerleave', () => lit(document.activeElement === b));
    b.addEventListener('focus', () => lit(true));
    b.addEventListener('blur', () => lit(false));
    if (items[i].kind === 'ladder') { // the library's ladder slides along its rail: drag it, or the arrow keys
      let x0 = null; let moved = false;
      const to = (r2) => { if (r2) b.style.left = `${r2.l - dx}px`; };
      b.addEventListener('pointerdown', (e) => { x0 = e.clientX; moved = false; try { b.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ } });
      b.addEventListener('pointermove', (e) => { if (x0 === null || (!moved && Math.abs(e.clientX - x0) < 4)) return; moved = true; to(window.Hours.ladderTo(e.clientX)); });
      b.addEventListener('pointerup', () => { x0 = null; });
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); e.stopPropagation(); to(window.Hours.ladderBy(e.key === 'ArrowLeft' ? -1 : 1));
      });
      b.addEventListener('click', (e) => { if (moved) { e.stopImmediatePropagation(); moved = false; } }); // (a drag is not a click)
    }
    b.dataset.kind = items[i].kind;
    b.addEventListener('click', () => (items[i].kind === 'engine' ? openEngine(b) : openCard(i, b)));
    return [b];
  }));
}
/* ---- the scrying engine (the scriptorium, About): the terminal, a site in the site ------------
   The same page in an iframe (framed, it takes the terminal: see the head script), in a window over
   the castle. Opening: the room's picture zooms on the engine, then the window grows out of its glass;
   closing runs it back. Esc, [back to the castle] (from inside: postMessage) or a click outside closes. */
let engine = null;
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
  const cv = document.querySelector('.plate-img'); const sr = spot.getBoundingClientRect(); const cr = cv.getBoundingClientRect(); // (the picture: the landscape's canvas and the room's)
  const fx = sr.left + sr.width / 2; const fy = sr.top + sr.height * 0.4; // (the glass, in the hood's upper part)
  const Z = 2.6; const ms = reduceMotion ? 0 : 900;
  cv.style.transformOrigin = `${fx - cr.left}px ${fy - cr.top}px`;
  cv.style.transition = `transform ${ms}ms cubic-bezier(.6, 0, .3, 1)`;
  const vx = innerWidth / 2; const vy = innerHeight / 2; // the glass is brought to the middle, where the window opens
  cv.style.transform = `translate(${vx - fx}px, ${vy - fy}px) scale(${Z})`;
  root.classList.add('engine-on'); cue('door');
  const wrap = document.createElement('div'); wrap.className = 'engine';
  wrap.innerHTML = `<div class="engine-win" role="dialog" aria-label="${T.engineTitle}"><p class="engine-bar"><span>${T.engineTitle}</span><button type="button" class="engine-x">${T.engineClose}</button></p><iframe title="${T.engineTitle}" src="${location.pathname}"></iframe></div>`;
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
  setTimeout(() => { wrap.remove(); cv.style.transform = ''; }, reduceMotion ? 0 : 400);
  setTimeout(() => { root.classList.remove('engine-on'); cv.style.transition = ''; cv.style.transformOrigin = ''; if (from.isConnected) from.focus(); }, (reduceMotion ? 0 : 400) + ms);
}
function engineToggle() {
  if (FRAMED) { parent.postMessage({ engine: 'close' }, location.origin); return; }
  if (engine) closeEngine();
  else if (root.getAttribute('data-theme') === 'hours') enterEngine();
  else { if (!WIDE.matches) store('entry', 'castle'); applyTheme(nextTheme(), true); openWindow(location.hash, { userAction: false }); }
}
window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.engine === 'close') closeEngine(); });
/** The front gate's ways in (gate.js): the castle (a touch screen showing the terminal goes back up the
 *  tower), the terminal (in the scriptorium's engine; on a touch screen the page itself), the tour. */
function gateWay(way) {
  if (way === 'terminal') { if (WIDE.matches) enterEngine(); else { store('entry', 'engine'); applyTheme('dark', true); } }
  else if (way === 'tour') tour();
  else if (root.getAttribute('data-theme') !== 'hours' && touchy()) { store('entry', 'castle'); applyTheme('hours', true); openWindow(location.hash, { userAction: false }); }
}
addEventListener('gate', (e) => gateWay(e.detail));
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
    const href = a.getAttribute('href'); // '#experience', or a project page's path
    const go = ROOM_IDS.find((r) => href === `#${r}` || (WORLD[r].page && href.endsWith(WORLD[r].page))) || null;
    return { kind: 'door', dir: dir[0], label: `${dir}: ${a.textContent.trim()}`, go, html: '' };
  }).filter((d) => d.go) : [];
}

/* ---- the cards as manuscript: a rubricated title between fleurons over a vine scroll, a
   pen-flourished initial (blue, a red tendril down the margin), a tailpiece to close; the books
   (the book of courses, the notebook, the works) open as a two-page spread, turned leaf by leaf */

const BOOKISH = new Set(['ledger', 'desk-book', 'book', 'volume']);
const ROMAN = (n) => { // folio numbers
  let out = '';
  for (const [v, r] of [[50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) while (n >= v) { out += r; n -= v; }
  return out;
};

/* each text its own ornaments, drawn from its name (the same text always looks the same) */
const ORN = { band: ['vine', 'interlace', 'lozenges', 'leaves', 'ribbon'], fleuron: ['quatrefoil', 'lily', 'rosette', 'trefoil'],
  tail: ['triangle', 'drop', 'ribbon'], droll: ['snail', 'bird', 'rabbit', 'fish', 'dragonet', 'cat'] };
const INKS = [['#2a4caa', 'r'], ['#a82c1c', 'b'], ['#8a621a', 'G']]; // the initial's ink, its flourish's
const ornUrl = (name) => `url('${new URL(`assets/img/orn/${name}.svg`, SITE).href}')`; // single quotes: it goes into style="" too
function hashOf(text) { let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; }
const pick = (list, h, salt) => list[hashOf(`${h}:${salt}`) % list.length]; // each kind drawn on its own
function drollery(h, side) { // a creature in the margin for about one text in two
  if ((h >>> 20) % 2) return '';
  return `<span class="droll at-${side}${(h >>> 23) % 2 ? ' flip' : ''}" aria-hidden="true" style="--droll:${ornUrl(`droll-${pick(ORN.droll, h, 9)}`)}"></span>`;
}

function illuminate(body, key) {
  const h = hashOf(key);
  card.style.setProperty('--orn-band', ornUrl(`band-${pick(ORN.band, h, 0)}`));
  card.style.setProperty('--orn-fleuron', ornUrl(`fleuron-${pick(ORN.fleuron, h, 3)}`));
  card.style.setProperty('--orn-tail', ornUrl(`tail-${pick(ORN.tail, h, 6)}`));
  const [ink, flourish] = pick(INKS, h, 12);
  card.style.setProperty('--ini', ink); card.style.setProperty('--orn-tendril', ornUrl(`tendril-${flourish}`));
  card.droll = drollery(h, (h >>> 16) % 2 ? 'left' : 'right');
  const title = body.querySelector('h3');
  if (title) {
    title.classList.add('card-title');
    (title.closest('.entry-head') || title).insertAdjacentHTML('afterend', '<div class="orn-band" aria-hidden="true"></div>');
  }
  const opening = [...body.querySelectorAll('p')].find((p) => (!p.className || p.classList.contains('lede')) && p.textContent.trim().length > 60);
  if (opening) opening.classList.add('opening');
}

/** The text cut into pages that fit: blocks are measured one by one in a page of the spread;
 *  a list may break between items, a heading (or a year's ornament) keeps with what follows.
 *  Returns the pages' HTML. */
function paginate(src, probe) {
  const seq = []; // blocks: { el, list (its ul, for an item), keep }
  const walk = (el) => [...el.children].forEach((n) => {
    if (n.matches('.ledger-year')) { // between two years, a fleuron on a rule (each its own); it keeps with the year
      if (n.previousElementSibling && n.previousElementSibling.matches('.ledger-year')) {
        const orn = document.createElement('div'); orn.className = 'year-orn'; orn.setAttribute('aria-hidden', 'true');
        orn.style.setProperty('--year-fleuron', ornUrl(`fleuron-${ORN.fleuron[seq.length % ORN.fleuron.length]}`));
        seq.push({ el: orn, keep: true });
      }
      walk(n);
    } else if (n.matches('ul, ol, .sheet, .kv')) [...n.children].forEach((li) => seq.push({ el: li, list: n })); // (a sheet breaks between its rows)
    else seq.push({ el: n, keep: n.matches('h3, .ledger-prog, .entry-head, .orn-band, .card-title') });
  });
  walk(src);
  const H = probe.clientHeight; const pages = []; let page; let ul = null; let listOf = null;
  const fresh = () => { page = document.createElement('div'); probe.replaceChildren(page); pages.push(page); ul = null; listOf = null; };
  const fits = (spare = 0) => page.offsetHeight <= H - spare - 2; // the content's height (scrollHeight never drops below H)
  const place = (a) => {
    if (a.list) {
      if (!ul || listOf !== a.list) { ul = a.list.cloneNode(false); listOf = a.list; page.append(ul); }
      return ul.appendChild(a.el.cloneNode(true));
    }
    ul = null; listOf = null;
    return page.appendChild(a.el.cloneNode(true));
  };
  const unplace = (node) => { const parent = node.parentElement; node.remove(); if (parent !== page && !parent.children.length) parent.remove(); };
  fresh();
  seq.forEach((a) => {
    let node = place(a);
    // a heading needs room for a few lines after it, or it goes over to the next page
    if (!fits(a.keep ? 70 : 0) && page.childElementCount + (ul ? ul.childElementCount : 0) > 1) { unplace(node); fresh(); node = place(a); }
  });
  probe.replaceChildren();
  return pages.map((pg) => pg.outerHTML); // with the wrapper they were measured in
}

function bind(body) { // the book's spread: two pages side by side, filled from paginate()
  const src = document.createElement('div');
  src.innerHTML = body.innerHTML;
  card.bookSrc = body.innerHTML;
  card.classList.remove('one-leaf'); // measured at the full page height
  body.innerHTML = `<div class="spread"><div class="page"></div><div class="page"></div></div>
<nav class="pager" aria-label="${T.pages}"><button type="button" data-turn="-1" aria-label="${T.prevPage}">‹</button><span class="folio"></span><button type="button" data-turn="1" aria-label="${T.nextPage}">›</button></nav>`;
  const probe = body.querySelector('.page');
  const whole = document.createElement('div'); whole.innerHTML = src.innerHTML; probe.append(whole);
  const short = whole.offsetHeight <= probe.clientHeight * 1.5; // a short text: one leaf, read through, rather than a spread half empty
  probe.replaceChildren();
  card.bookPages = short ? [whole.outerHTML] : paginate(src, probe);
  card.bookAt = 0;
  card.classList.toggle('one-leaf', card.bookPages.length === 1);
}
function turn(dir) {
  const pgs = card.bookPages;
  if (!pgs || !card.classList.contains('as-book')) return;
  const n = Math.ceil(pgs.length / 2);
  const was = card.bookAt;
  card.bookAt = Math.max(0, Math.min(n - 1, card.bookAt + dir));
  if (dir && card.bookAt !== was) cue('page');
  if (dir && card.bookAt !== was && !reduceMotion) { // a leaf turning over the gutter, in a few steps
    const leaf = document.createElement('div');
    leaf.className = `leaf-turn ${dir > 0 ? 'to-left' : 'to-right'}`;
    card.querySelector('.spread').append(leaf);
    leaf.addEventListener('animationend', () => leaf.remove(), { once: true });
  }
  const [left, right] = card.querySelectorAll('.page');
  left.innerHTML = pgs[card.bookAt * 2]; right.innerHTML = pgs[card.bookAt * 2 + 1] || '';
  [left, right].forEach((pg, k) => { // a drollery at the foot of some pages, outer margin
    const n = card.bookAt * 2 + k;
    if (pg.innerHTML && pg.firstElementChild.offsetHeight < pg.clientHeight - 30) pg.insertAdjacentHTML('beforeend', drollery(hashOf(`${card.getAttribute('aria-label')}${n}`), k ? 'right' : 'left'));
  });
  card.querySelector('.folio').textContent = `${ROMAN(card.bookAt * 2 + 1)} · ${ROMAN(card.bookAt * 2 + 2)}  (${card.bookAt + 1}/${n})`;
  card.querySelector('[data-turn="-1"]').disabled = card.bookAt === 0;
  card.querySelector('[data-turn="1"]').disabled = card.bookAt === n - 1;
}
card.addEventListener('click', (e) => { const b = e.target.closest('[data-turn]'); if (b) turn(Number(b.dataset.turn)); });
card.addEventListener('keydown', (e) => {
  if (!card.querySelector('.spread') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault(); turn(e.key === 'ArrowLeft' ? -1 : 1);
});

function openCard(i, from) {
  const it = spotItems[i];
  if (!it) return; // a button of the room just left
  if (it.go) { goTo(it.go); return; } // a door: through it
  if (it.act) { it.act(); return; } // the cellar's steps: down
  const body = card.querySelector('.card-body');
  body.innerHTML = it.html;
  illuminate(body, it.label);
  const book = BOOKISH.has(it.kind) && root.getAttribute('data-theme') === 'hours';
  card.classList.toggle('as-book', book); card.classList.remove('one-leaf');
  card.dataset.kind = it.kind;
  card.setAttribute('aria-label', it.label);
  card.hidden = false;
  if (!book && card.droll) body.insertAdjacentHTML('beforeend', card.droll);
  // what each kind of thing is made of: a letter is sealed, a charter has its seal hanging on a
  // cord, a scroll keeps its rolled ends (decorations outside .card-body are cleared each time)
  card.querySelectorAll(':scope > .deco').forEach((d) => d.remove());
  const deco = { letter: ['wax'], charter: ['hang-seal'], hanging: ['hang-seal'], scroll: ['roll at-top', 'roll at-bottom'] }[it.kind] || [];
  deco.forEach((c) => card.insertAdjacentHTML('beforeend', `<span class="deco ${c}" aria-hidden="true"></span>`));
  cue(it.kind === 'letter' ? 'seal' : it.kind === 'letterbox' ? 'drop' : 'card'); // (the letterbox: a letter falling inside the door)
  const runFigs = () => card.querySelectorAll('.pub-fig canvas').forEach((cv) => { if (!cv.running) { cv.running = true; waveFig(cv); } }); // (a property: the pages are clones)
  runFigs(); setTimeout(runFigs, 400); setTimeout(runFigs, 1500); // (and again once a book has been paginated)
  card.querySelectorAll('.real-fig').forEach(paintFig); // the real things' pictures (paintings, films...)
  card.querySelectorAll('canvas.astrolabe').forEach((cv) => { // the astrolabe, kept set while its card is open
    const tick = () => { if (card.hidden || !card.contains(cv) || !window.Hours || !window.Hours.astrolabe) return; cv.nextElementSibling.innerHTML = window.Hours.astrolabe(cv); setTimeout(tick, 1000); };
    tick();
  });
  if (book) { // pages are measured, so the card is shown first; again once its fonts have loaded
    bind(body); turn(0);
    const src = card.bookSrc;
    document.fonts.ready.then(() => {
      if (card.hidden || card.bookSrc !== src) return;
      const at = card.bookAt; body.innerHTML = src; bind(body); card.bookAt = 0; turn(at);
    });
  }
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
/** A real asset's figure in a card: its canvas painted by hours.js, its caption; [◄] [►] turn it. */
function paintFig(fig) {
  if (!window.Hours || !window.Hours.paint) return;
  fig.querySelector('figcaption').innerHTML = window.Hours.paint(fig.querySelector('canvas'), fig.dataset.real, Number(fig.dataset.i));
}
card.addEventListener('click', (e) => {
  const b = e.target.closest('[data-real-step]'); if (!b) return;
  const fig = b.closest('.real-fig'); const n = Number(fig.dataset.n);
  fig.dataset.i = String((Number(fig.dataset.i) + Number(b.dataset.realStep) + n) % n); paintFig(fig); cue('page');
});
function closeCard(refocus = true) {
  if (card.hidden) return;
  card.hidden = true;
  cue('close');
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
  const use = e.target.closest('[data-use]');
  if (use) { dialog.close(); useItem(use.dataset.use); return; }
  const go = e.target.closest('[data-go]'); // the map's places in the landscape
  if (go) {
    dialog.close(); const k = go.dataset.go;
    if (k === 'cellar') { if (root.getAttribute('data-theme') === 'hours') location.hash = '#cellar'; else descend(); return; }
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
  const domain = realm ? `<h3>The domain</h3><p class="domain">${[['village', 'the village and its market'], ['tower', 'up the watchtower'], ['cellar', 'down to the cellar']]
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
    ':': openCmd, '?': showHelp, m: showMap, i: showInventory, '>': descend, p: togglePhoto,
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
const AT = new Date(new URLSearchParams(location.search).get('at') || ''); // ?at=2026-08-12T18:10Z: an instant to preview (eclipses)
function skyNow() {
  if (!Number.isNaN(AT.getTime())) return AT;
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
    cue('bell');
    if (root.getAttribute('data-theme') === 'hours') say(T.bell(ph.hour));
  }
  lastHour = ph.hour;
}
let lastHour = null;

/* ---- the weather over Paris: Open-Meteo (CC BY 4.0, no key, no tracking), at most every 30 min ----
   The almanac says it; the castle's sky shows it. ?weather=<kind> or `:weather <kind>` previews one. */

const WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522'
  + '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,relative_humidity_2m,snow_depth&timezone=Europe%2FParis'
  + '&hourly=precipitation&daily=precipitation_sum,temperature_2m_min&past_days=7&forecast_days=1'; // the week behind: the river's level, its ice, the puddles
const WX_KINDS = ['clear', 'cloudy', 'overcast', 'fog', 'drizzle', 'showers', 'rain', 'snow', 'storm'];
const WX_MS = 30 * 60e3;
let wxNow = null;
{
  const q = new URLSearchParams(location.search).get('weather');
  if (WX_KINDS.includes(q)) session('weather', q);
}

/** WMO weather code -> one of WX_KINDS. */
function wxKind(code) {
  if (code <= 1) return 'clear';
  if (code === 2) return 'cloudy';
  if (code === 3) return 'overcast';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code >= 80 && code <= 82) return 'showers';
  if (code <= 67) return 'rain';
  if (code <= 77 || code === 85 || code === 86) return 'snow';
  return 'storm';
}

/** The weather shown: a previewed kind, else the real one (null before the first answer). */
function currentWx() {
  const forced = session('weather');
  const w = WX_KINDS.includes(forced)
    ? { kind: forced, cover: { clear: 0.1, cloudy: 0.5, showers: 0.6 }[forced] ?? 0.95, wind: 18, dir: 250, temp: null } : wxNow;
  const q = new URLSearchParams(location.search); // ?rain7=60&frost=-6: a wet week, a hard frost (previews)
  // (and ?dryH=3 puddles, ?snowDepth=0.2 snow lying, ?humid=97 a damp night, ?precip=4 mm/h)
  const extra = Object.fromEntries(['rain7', 'frost', 'temp', 'dryH', 'snowDepth', 'humid', 'precip'].filter((k) => q.has(k)).map((k) => [k, Number(q.get(k))]));
  return w && Object.keys(extra).length ? { ...w, ...extra } : w;
}

function showWeather() {
  const w = currentWx();
  if (!w) return;
  $('alm-weather').textContent = T.weather(w);
  if (window.Hours) window.Hours.weather(w);
}

async function fetchWeather() {
  try {
    const c = JSON.parse(session('wx') || 'null');
    if (c && Date.now() - c.t < WX_MS) { wxNow = c.w; showWeather(); return; }
    const res = await fetch(WX_URL);
    if (!res.ok) return;
    const { current: k, daily: dy, hourly: hr } = await res.json();
    const past = (a) => (a || []).slice(0, -1).filter((v) => v != null); // the seven days before today
    // hours since it last rained (>= 0.2 mm in an hour): the puddles dry in about half a day
    const nowI = hr ? hr.time.findLastIndex((t) => t <= k.time) : -1;
    const lastWet = nowI < 0 ? -1 : hr.precipitation.slice(0, nowI + 1).findLastIndex((v) => v >= 0.2);
    wxNow = { kind: wxKind(k.weather_code), cover: k.cloud_cover / 100, wind: k.wind_speed_10m, dir: k.wind_direction_10m, temp: Math.round(k.temperature_2m),
      rain7: past(dy && dy.precipitation_sum).reduce((a, v) => a + v, 0), frost: Math.min(9, ...past(dy && dy.temperature_2m_min).slice(-3)),
      precip: k.precipitation ?? 0, humid: k.relative_humidity_2m ?? 70, snowDepth: k.snow_depth ?? 0, dryH: lastWet < 0 ? 99 : nowI - lastWet };
    session('wx', JSON.stringify({ t: Date.now(), w: wxNow }));
    showWeather();
  } catch { /* offline: the sky stays as drawn, the almanac says nothing */ }
}
showWeather();
fetchWeather();
setInterval(fetchWeather, WX_MS);

/* Geomagnetic activity (NOAA SWPC planetary Kp, 3-hourly): aurorae over Paris want Kp >= 7, a few
   nights a decade; the watchtower's north view shows them then. ?kp=8 previews. */
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
async function fetchKp() {
  const forced = Number(new URLSearchParams(location.search).get('kp'));
  if (forced) { if (window.Hours) window.Hours.weather({ kp: forced }); return; }
  try {
    const c = JSON.parse(session('kp') || 'null');
    let kp = c && Date.now() - c.t < 3600e3 ? c.kp : null;
    if (kp === null) {
      const res = await fetch(KP_URL);
      if (!res.ok) return;
      const rows = await res.json(); const last = rows[rows.length - 1];
      kp = Number(Array.isArray(last) ? last[1] : last.Kp); // (the feed has been both shapes)
      if (!Number.isFinite(kp)) return;
      session('kp', JSON.stringify({ t: Date.now(), kp }));
    }
    if (window.Hours) window.Hours.weather({ kp });
  } catch { /* offline: no aurora */ }
}
fetchKp();
setInterval(fetchKp, 3600e3);

tick();
setTimeout(() => { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000);
