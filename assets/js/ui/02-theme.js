// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

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
    const parsed = document.readyState === 'loading' ? new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true })) : Promise.resolve(); // (the page's other scripts first: the castle is handed their functions)
    hoursLoading ||= parsed.then(() => load(ARMS_SRC)).then(() => load(TEX_SRC)).then(() => load(ART_SRC)).then(() => load(PHYSICS_SRC)).then(() => load(HOURS_SRC)).then(() => window.Hours.start({
      plate: document.querySelector('.plate-img'),
      sky: () => skyAt(skyNow()),
      reduceMotion,
      heraldry: DATA.heraldry,
      say, // the scene's characters answer in the message line
      items: roomItems, // what each room holds, to be drawn as things
      fresh: (id) => { const seen = lookedAt()[id] || []; return roomItems(id).map((t, k) => (seen.includes(t.label) || ['door', 'ladder', 'hanging'].includes(t.kind) ? -1 : k)).filter((k) => k >= 0); }, // (what the wizard points at)
      spots: setSpots, // and where those things ended up
      rumour: () => RUMOURS[Math.floor(Math.random() * RUMOURS.length)], // the knight tells it
      descend, // the descent (the cellar's steps, >)
      cellar: () => { location.hash = '#cellar'; }, // the door in the rock: into the cellar
      maps: () => { location.hash = '#maproom'; }, // the cartographer's sign in the village: up to the map room
      go: (id) => { location.hash = `#${id}`; }, // a part of the castle clicked: into its room
      doors: roomDoors, // the doors in the rooms' side walls
      clock: skyNow, // the instant shown: dawn mist, the night's meteor shower
      scrub, // the sun or the moon dragged: another hour
      rose: (dir, kmh) => showRose(dir, kmh), // the weathervane clicked: the compass rose
      ink: () => quillDots().length, // how much is drawn on the copyist's page (its miniature on his desk)
      marks: (id) => Object.keys(bookmarks()[id] || {}), // the books left open at a page: a ribbon out of them
      pins: (id) => (pins()[id] || []).map((p) => ({ kind: 'pinned', label: `Pinned: ${p.label}`, html: p.html })), // the cards pinned up on its walls
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
  const li = document.querySelector('#news .news li:not(.now)'); // (what is under way is no news)
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
let earX = 0; addEventListener('pointermove', (e) => { earX = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
function soundState() {
  const room = root.dataset.room || null;
  return {
    on: soundOn && root.getAttribute('data-theme') === 'hours' && !document.hidden,
    wx: currentWx(), night: root.getAttribute('data-sky') === 'night', room, ear: earX, // (where the pointer is across the screen: the room's sounds placed from it) open: Boolean(window.Hours && window.Hours.windowOpen && window.Hours.windowOpen()),
    echo: ['talks', 'experience', 'contact', 'work'].includes(room), // the stone rooms
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
