'use strict';

/* ---- command line (:) --------------------------------------------------- */

const cmdForm = $('cmdline');
const cmdIn = $('cmd-in');
const cmdOut = $('cmd-out');
const cmdToggle = $('cmd-toggle');
const cmdHistory = (() => { try { return JSON.parse(store('cmd-history') || '[]').slice(-50); } catch { return []; } })(); // (kept on this device: the last fifty)
let histAt = cmdHistory.length;

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
  cmdIn.value = ''; ghost.textContent = '';
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
  if (!isIndex) session('cmd-walk', '1');
  goTo(id);
}

/* Weather events: a state of the ground or the sky, until the next real reading (30 min at most). */
const WX_EVENTS = {
  snowfall: [{ kind: 'snow', snowDepth: 0.2 }, 'Snow falls and lies, twenty centimetres of it.'], thaw: [{ snowDepth: 0, temp: 8 }, 'The snow melts away.'],
  puddles: [{ dryH: 0 }, 'It has just rained: puddles on the path and in the meadow.'], frost: [{ temp: -6, frost: -6 }, 'A hard frost: ice on the river, ferns of frost on the windows.'],
  flood: [{ rain7: 70 }, 'A wet week: the river is over its banks.'], drought: [{ rain7: 0 }, 'A dry week: the river runs low, its gravel showing.'],
  aurora: [{ kp: 8 }, 'A great geomagnetic storm: an aurora in the north, seen from the watchtower at night.'],
};
const eventNames = () => [...window.Hours.events(), ...Object.keys(WX_EVENTS), ...WX_KINDS].sort();

/* The music command: the lute's book of tunes (assets/data/real/tunes.json, read here without the
   sound: the list is shown before anything plays), one of them now, the lute's own air, another. */
let tuneListP = null;
const tuneList = () => (tuneListP ||= fetch(new URL('assets/data/real/index.json', SITE), { cache: 'no-cache' }).then((r) => r.json())
  .then((ix) => (ix.tunes ? fetch(new URL(`assets/data/real/tunes.json?v=${ix.tunes.v}`, SITE)).then((r) => r.json()) : { tunes: [] }))
  .then((o) => o.tunes).catch(() => []));
const WHEN = { day: 'by day', evening: 'in the evening', december: 'in December', night: 'at night, on the harp', market: 'at the market, pipes and drum' };
const nowPlaying = () => { const n = window.Sound && window.Sound.now ? window.Sound.now() : null; return n ? `${esc(n.title)}, ${esc(n.composer)}${n.year ? ` (${esc(n.year)})` : ''}` : null; };
/** Sound and music on, in the castle (the terminal is silent); the promise of the sound, or null. */
function hearing() {
  if (root.getAttribute('data-theme') !== 'hours') { print(esc(T.musicCastle)); return null; }
  if (!musicOn) setMusic(true);
  if (!soundOn) setSound(true);
  return soundLoading;
}
function musicCmd([sub = '', ...rest]) {
  const what = [sub, ...rest].join(' ');
  if (!sub || sub === 'now') {
    const n = nowPlaying();
    return print(`${esc(T.musicState(soundOn && musicOn))}${n ? ` ${T.nowPlaying(n)}` : ''} <span class="dim">${T.musicHint}</span>`);
  }
  if (sub === 'on' || sub === 'off') { setMusic(sub === 'on'); if (sub === 'on' && !soundOn) setSound(true); return print(esc(T.musicSet(sub === 'on'))); }
  if (sub === 'list' || sub === 'ls') {
    return tuneList().then((list) => {
      const playing = window.Sound && window.Sound.now && window.Sound.now();
      const rows = Object.keys(WHEN).map((w) => [w, list.map((q, k) => [q, k + 1]).filter(([q]) => q.when === w)]).filter(([, l]) => l.length)
        .map(([w, l]) => `<div><dt>${WHEN[w]}</dt><dd>${l.map(([q, k]) => `<b>${k}</b> ${esc(q.title)} <span class="dim">${esc(q.composer)}</span>${playing && playing.title === q.title ? ' &#9834;' : ''}`).join('<br>')}</dd></div>`);
      print(`<dl class="tunes"><div><dt>any hour</dt><dd><b>0</b> ${T.airName}</dd></div>${rows.join('')}</dl><p class="dim">${T.tunesHint}</p>`);
    });
  }
  if (sub === 'air' || what === '0' || sub === 'lute') {
    const p = hearing(); if (!p) return undefined;
    return p.then(() => { window.Sound.air(); print(esc(T.airNow)); });
  }
  if (sub === 'next' || sub === 'skip' || sub === 'another') {
    const p = hearing(); if (!p) return undefined;
    return p.then(() => window.Sound.next()).then((q) => print(q ? T.nowPlaying(`${esc(q.title)}, ${esc(q.composer)}`) : esc(T.noTunes)));
  }
  return tuneList().then((list) => { // a tune by its number, its id, or words of its title or composer
    const k = Number(what);
    const q = Number.isInteger(k) && k >= 1 ? list[k - 1] : list.find((t) => t.id === what) || list.find((t) => `${t.title} ${t.composer}`.toLowerCase().includes(what));
    if (!q) { print(esc(T.noSuchTune(what))); return; }
    const p = hearing(); if (!p) return;
    p.then(() => window.Sound.play(q.id)).then((ok) => print(ok ? T.nowPlaying(`${esc(q.title)}, ${esc(q.composer)}`) : esc(T.noTunes)));
  });
}

/** search: each entry of the site (a post, a work, a reference, a talk, a course, a news, a line of the
 *  About sheet, a year of courses) that holds every word, accents aside; by section, linked to it. */
function search(words) {
  if (!words.length) return print(esc('search <words>: what in the site holds them, by section.'));
  const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
  const ws = words.map(norm);
  const found = [...document.querySelectorAll('main > section.pane')].map((sec) => [sec, [...sec.querySelectorAll('.entry, article.project, .pub, .news li, .sheet > div, .ledger-year, .ledger-prog')]
    .filter((el) => ws.every((w) => norm(el.textContent).includes(w)))]).filter(([, f]) => f.length);
  if (!found.length) return print(esc(`Nothing in the site holds "${words.join(' ')}".`));
  const head = (el) => (el.querySelector('h3, .pub-title, dt, time') || el).textContent.replace(/\s+/g, ' ').trim().slice(0, 90);
  return print(`<dl class="found">${found.map(([sec, f]) => `<div><dt><a href="#${sec.id}">${esc(sec.querySelector('h2').textContent.replace(/~/g, '').trim())}</a></dt>`
    + `<dd>${f.slice(0, 6).map((el) => esc(head(el))).join('<br>')}${f.length > 6 ? `<br><span class="dim">and ${f.length - 6} more</span>` : ''}</dd></div>`).join('')}</dl>`);
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
    case 'whoami': { // the site in twenty seconds (the header's glance)
      const g = document.querySelector('.glance');
      return print(`<p><b>${esc(DATA.name || document.querySelector('.name').textContent)}</b>, ${esc(document.querySelector('.role').textContent.replace(/\s+/g, ' ').trim())}</p>${g ? g.outerHTML.replace('class="glance"', 'class="glance shown"') : ''}`);
    }
    case 'history':
      if (arg === 'clear') { cmdHistory.length = 0; histAt = 0; store('cmd-history', null); return print('History cleared.'); }
      return print(cmdHistory.length ? `<ol class="history">${cmdHistory.slice(-15).map((l) => `<li>${esc(l)}</li>`).join('')}</ol><p class="dim">history clear forgets them</p>` : 'No commands yet.');
    case 'paper': { // the terminal on light paper, and back (kept on this device)
      const on = arg === 'off' ? false : arg === 'on' ? true : !root.hasAttribute('data-paper');
      root.toggleAttribute('data-paper', on); store('paper', on ? '1' : null);
      return print(on ? 'The terminal on paper (paper off to go back).' : 'The terminal in the dark again.');
    }
    case 'search': case 'find': case 'grep':
      return search(args);
    case 'gate': // the front gate asks again on the next bare visit (after "remember my choice")
      store('gate', null);
      return print('The front gate will ask again on your next visit.');
    case 'cv':
      location.href = cvHref();
      return undefined;
    case 'mail': case 'email':
      location.href = `mailto:${DATA.email}`;
      return undefined;
    case 'github': case 'code':
      location.href = DATA.github;
      return undefined;
    case 'theme': case 'engine': case 'castle': {
      if (FRAMED || root.getAttribute('data-theme') === 'hours') { engineToggle(); return undefined; } // (the castle and the terminal in its engine)
      const want = {
        dark: 'dark', terminal: 'dark', light: 'hours', hours: 'hours', colour: 'hours',
      }[arg] || nextTheme();
      if (!WIDE.matches && want === 'hours') { if (!touchy()) return print(esc(T.narrowTheme)); engineToggle(); return undefined; } // (a touch screen: back up the tower)
      applyTheme(want, true);
      return print(T.themeSet(T.themeName[want]));
    }
    case 'sky': {
      if (!Object.hasOwn(SKY_ALT, arg) && arg !== 'now') return print(esc(T.skyHint));
      session('sky', arg === 'now' ? null : arg);
      updateSky();
      return print(esc(T.skySet(arg)));
    }
    case 'weather': {
      if (!WX_KINDS.includes(arg) && arg !== 'now') return print(esc(T.wxHint));
      session('weather', arg === 'now' ? null : arg);
      showWeather();
      return print(esc(T.wxSet(arg)));
    }
    case 'event': case 'do': { // call up an event of the castle's landscape (hours theme)
      if (root.getAttribute('data-theme') !== 'hours' || !window.Hours) return print(esc(T.photoOnly.replace('Photo mode', 'Events')));
      if (!arg) return print(`<span class="dim">${T.eventsAre}</span> ${eventNames().join('  ')}`);
      if (WX_KINDS.includes(arg)) { session('weather', arg); showWeather(); return print(esc(T.wxSet(arg))); }
      if (WX_EVENTS[arg]) { window.Hours.weather(WX_EVENTS[arg][0]); return print(esc(WX_EVENTS[arg][1])); }
      if (!window.Hours.events().includes(arg)) return print(esc(T.noEvent(arg)));
      if (root.dataset.room && !['embers', 'banner', 'cinema'].includes(arg)) leaveRoom();
      closeCmd();
      { const m = window.Hours.trigger(arg); if (m) say(m); } // (a skimmed stone says its own)
      if (arg === 'cinema' && root.dataset.room !== 'talks') goTo('talks'); // (the show is in the great hall)
      return undefined;
    }
    case 'music': case 'tune': case 'tunes':
      return musicCmd(cmd === 'music' ? args : ['list']);
    case 'volume': {
      const v = Math.max(0, Math.min(10, Math.round(Number(arg))));
      if (!Number.isFinite(v)) return print(esc(T.volumeSet(volume.value)));
      volume.value = String(v); applyVolume();
      return print(esc(T.volumeSet(v)));
    }
    case 'keys':
      setKeys(arg ? arg !== 'off' : !keysOn);
      return print(T.keysSet(keysOn));
    case 'photo': case 'p':
      closeCmd();
      return togglePhoto(true);
    case 'tour':
      closeCmd();
      return tour();
    case 'banner': // the narrow screens' landscape banner, on or off
      store('banner', arg === 'on' || (!arg && store('banner') === 'off') ? 'on' : 'off');
      applyTheme(root.getAttribute('data-theme'), false);
      return print(`The landscape banner is ${store('banner') === 'off' ? 'off' : 'on'} (narrow screens).`);
    case 'tower': case 'watch':
      closeCmd();
      if (window.Hours && root.getAttribute('data-theme') === 'hours') return window.Hours.tower();
      return print(T.photoOnly.replace('Photo mode', 'The watchtower'));
    case 'village': case 'market':
      closeCmd();
      if (window.Hours && root.getAttribute('data-theme') === 'hours') return window.Hours.village();
      return print(T.photoOnly.replace('Photo mode', 'The village'));
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
  if (line.trim() && line !== cmdHistory.at(-1)) { cmdHistory.push(line); store('cmd-history', JSON.stringify(cmdHistory.slice(-50))); }
  histAt = cmdHistory.length;
  cmdIn.value = '';
  run(line);
});
/* Tab completes the word under the cursor: a command or a room first, then what that command
   takes; one match is completed, several are completed to their common start and listed. */
const COMMANDS = ['help', 'look', 'ls', 'map', 'cd', 'take', 'inventory', 'use', 'rumour', 'descend',
  'cv', 'mail', 'github', 'theme', 'sky', 'weather', 'event', 'photo', 'tour', 'tower', 'village', 'banner', 'music', 'volume', 'keys', 'quit', 'clear', 'go', 'gate', 'search', 'whoami', 'history', 'paper'];
const roomWords = () => ROOM_IDS.map((id) => WORLD[id].label.toLowerCase());
const ARGS = {
  cd: roomWords, open: roomWords, go: () => ['north', 'south', 'east', 'west'], walk: () => ['north', 'south', 'east', 'west'],
  theme: () => ['terminal', 'hours'], sky: () => Object.keys(SKY_ALT).concat('now'), keys: () => ['on', 'off'],
  weather: () => WX_KINDS.concat('now'), music: () => ['on', 'off'], event: () => (window.Hours ? eventNames() : []), do: () => (window.Hours ? eventNames() : []),
  use: () => pack().map((_, i) => LETTERS[i]),
};

function complete() {
  const line = cmdIn.value.slice(0, cmdIn.selectionStart).toLowerCase();
  const words = line.split(/\s+/);
  const word = words.pop();
  const pool = words.length ? (ARGS[words[0]] || (() => []))() : [...COMMANDS, ...roomWords()];
  const hits = [...new Set(pool)].filter((w) => w.startsWith(word)).sort();
  if (!hits.length) return;
  let common = hits[0];
  hits.forEach((h) => { while (!h.startsWith(common)) common = common.slice(0, -1); });
  const done = hits.length === 1 ? `${common} ` : common;
  cmdIn.value = line.slice(0, line.length - word.length) + done + cmdIn.value.slice(cmdIn.selectionStart);
  const at = line.length - word.length + done.length;
  cmdIn.setSelectionRange(at, at);
  print(hits.length > 1 ? hits.map(esc).join('  ') : '');
}

/* the completion shown in grey as one types (what Tab would add), accepted by Tab or the right arrow at the end */
const ghost = document.createElement('span'); ghost.className = 'cmd-ghost'; ghost.setAttribute('aria-hidden', 'true'); cmdIn.after(ghost);
function ghostOf() {
  const line = cmdIn.value; if (!line || cmdIn.selectionStart !== line.length) return '';
  const words = line.toLowerCase().split(/\s+/); const word = words.pop(); if (!word) return '';
  const pool = words.length ? (ARGS[words[0]] || (() => []))() : [...COMMANDS, ...roomWords()];
  const hits = [...new Set(pool)].filter((w) => w.startsWith(word));
  return hits.length === 1 ? hits[0].slice(word.length) : '';
}
const showGhost = () => { ghost.textContent = ghostOf(); ghost.style.left = `calc(${cmdIn.offsetLeft}px + ${cmdIn.value.length}ch)`; };
cmdIn.addEventListener('input', showGhost);
cmdIn.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' && ghost.textContent && cmdIn.selectionStart === cmdIn.value.length) { e.preventDefault(); cmdIn.value += ghost.textContent; showGhost(); }
});
cmdIn.addEventListener('keyup', (e) => { if (e.key === 'Tab' || e.key.startsWith('Arrow')) showGhost(); });
cmdIn.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closeCmd(); return; }
  if (e.key === 'Tab' && !e.shiftKey && cmdIn.value.trim()) { e.preventDefault(); complete(); return; }
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
