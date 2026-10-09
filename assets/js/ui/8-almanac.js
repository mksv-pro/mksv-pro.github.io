// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

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
let skyShift = 0; // (ms: the sun dragged across the sky, hours.js scrub)
function skyNow() {
  const at0 = skyBase(); return skyShift ? new Date(at0.getTime() + skyShift) : at0;
}
/** The sun or moon dragged by `ms` (null: let go, the sky goes back to now in a second and a half). */
let scrubRaf = 0;
function scrub(ms) {
  cancelAnimationFrame(scrubRaf);
  if (ms !== null) { skyShift = ms; scrubRaf = requestAnimationFrame(() => { updateSky(); const d = skyNow(); say(T.skyAt(`${d.getHours()}:${pad(d.getMinutes())}`), null, { now: true }); }); return; }
  const from = skyShift; const t0 = performance.now();
  const back = (now) => { const e = Math.min(1, (now - t0) / 1500); skyShift = from * (1 - e) ** 2; updateSky(); if (e < 1) scrubRaf = requestAnimationFrame(back); else { skyShift = 0; updateSky(); } };
  scrubRaf = requestAnimationFrame(back);
}
function skyBase() {
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

// offline (sw.js): on the real site only, not on a local port (the preview and the checks stay uncached)
if ('serviceWorker' in navigator && !location.port && !FRAMED) navigator.serviceWorker.register(new URL('sw.js', SITE)).catch(() => {});
