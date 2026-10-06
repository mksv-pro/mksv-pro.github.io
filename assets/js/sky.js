// deno-lint-ignore-file no-unused-vars -- read by the scripts loaded after this one
'use strict';

/* ---- the sky over Paris: sun, moon, planetary hours, the armillary's rings ----------
   Pure functions, no DOM: script.js (almanac, hours theme) and armillary.js use them. */

const LAT = 48.8566;
const LON = 2.3522;
const DAY_MS = 86400000;
// DAY_RULER[weekday] indexes the Chaldean order (T.planet in script.js), Sunday first.
const DAY_RULER = [3, 6, 2, 5, 1, 4, 0];
const rad = Math.PI / 180;

/** Sun's mean anomaly M and ecliptic longitude lambda (degrees), `days` after J2000.0. */
function sunEcliptic(days) {
  const M = (357.5291 + 0.98560028 * days) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  return { M, lambda: (M + C + 180 + 102.9372) % 360 };
}

/** Sunrise and sunset (Date) for the local calendar day of `d`, NOAA low-precision
 *  algorithm (~1 min). Paris never has polar day, so both events always exist. */
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
  return { day: DAY_RULER[weekday], hour: (DAY_RULER[weekday] + n) % 7 }; // indices, Chaldean order
}

/** Moon age in days since the last new moon (mean synodic month, ~0.5 day accuracy). */
function moon(now) {
  const synodic = 29.530588853;
  const jd = now.getTime() / DAY_MS + 2440587.5;
  const age = (((jd - 2451550.1) % synodic) + synodic) % synodic;
  const bounds = [1.85, 7.38, 9.23, 14.77, 16.61, 22.15, 24.0, 27.68];
  const i = bounds.findIndex((b) => age < b);
  return { age: Math.floor(age), phase: i < 0 ? 8 : i, waxing: age < 14.77 }; // phase: index of T.phase
}

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
