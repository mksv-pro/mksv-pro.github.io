'use strict';

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
      const want = {
        dark: 'dark', terminal: 'dark', light: 'hours', hours: 'hours', colour: 'hours',
      }[arg] || nextTheme();
      if (!WIDE.matches && want === 'hours') return print(esc(T.narrowTheme));
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
    case 'music':
      setMusic(arg ? arg !== 'off' : !musicOn);
      return print(esc(T.musicSet(musicOn)));
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
  if (line.trim()) cmdHistory.push(line);
  histAt = cmdHistory.length;
  cmdIn.value = '';
  run(line);
});
/* Tab completes the word under the cursor: a command or a room first, then what that command
   takes; one match is completed, several are completed to their common start and listed. */
const COMMANDS = ['help', 'look', 'ls', 'map', 'cd', 'take', 'inventory', 'use', 'rumour', 'descend',
  'cv', 'mail', 'github', 'theme', 'sky', 'weather', 'photo', 'tour', 'tower', 'village', 'banner', 'music', 'volume', 'keys', 'quit', 'clear', 'go'];
const roomWords = () => ROOM_IDS.map((id) => WORLD[id].label.toLowerCase());
const ARGS = {
  cd: roomWords, open: roomWords, go: () => ['north', 'south', 'east', 'west'], walk: () => ['north', 'south', 'east', 'west'],
  theme: () => ['terminal', 'hours'], sky: () => Object.keys(SKY_ALT).concat('now'), keys: () => ['on', 'off'],
  weather: () => WX_KINDS.concat('now'), music: () => ['on', 'off'],
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
