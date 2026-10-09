// deno-lint-ignore-file no-unused-vars -- read by the scripts loaded after this one
'use strict';

/* ---- the sky over Paris: sun, moon, planetary hours, the armillary's rings ----------
   Pure functions, no DOM: assets/js/ui (almanac, hours theme) and armillary.js use them. */

const LAT = 48.8566;
const LON = 2.3522;
const DAY_MS = 86400000;
// DAY_RULER[weekday] indexes the Chaldean order (T.planet in assets/js/ui), Sunday first.
const DAY_RULER = [3, 6, 2, 5, 1, 4, 0];
const rad = Math.PI / 180;

/** Sun's mean anomaly M and apparent ecliptic longitude lambda (degrees, equinox of date), `days` after J2000.0. */
function sunEcliptic(days) {
  const M = (357.5291 + 0.98560028 * days) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  // + the precession since J2000 (1.397 deg a century): the longitude of date, as the Moon's and the
  // sidereal time are; - aberration (20.5")
  return { M, lambda: (M + C + 180 + 102.9372 + 1.397 * (days / 36525) - 0.0057) % 360 };
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

/** The Moon's geocentric ecliptic longitude, latitude (degrees) and distance (km), `days` after
 *  J2000.0: the largest terms of Meeus, Astronomical Algorithms ch. 47 (~0.01 deg, enough to
 *  find the eclipses at their hour). */
const MOON_LR = [ // D M M' F, sum l (1e-6 deg), sum r (m)
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210], [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056], [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];
const MOON_B = [ // D M M' F, sum b (1e-6 deg)
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324], [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
];
function moonEcliptic(days) {
  const T = days / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T; const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T; const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.2720950 + 483202.0175233 * T; const E = 1 - 0.002516 * T;
  const A1 = 119.75 + 131.849 * T; const A2 = 53.09 + 479264.29 * T; const A3 = 313.45 + 481266.484 * T;
  const arg = (d, m, mp, f) => (d * D + m * M + mp * Mp + f * F) * rad;
  const ecc = (m) => (Math.abs(m) === 1 ? E : m ? E * E : 1);
  let l = 3958 * Math.sin(A1 * rad) + 1962 * Math.sin((Lp - F) * rad) + 318 * Math.sin(A2 * rad); let r = 0;
  MOON_LR.forEach(([d, m, mp, f, cl, cr]) => { const a = arg(d, m, mp, f); l += cl * ecc(m) * Math.sin(a); r += cr * ecc(m) * Math.cos(a); });
  let b = -2235 * Math.sin(Lp * rad) + 382 * Math.sin(A3 * rad) + 175 * Math.sin((A1 - F) * rad) + 175 * Math.sin((A1 + F) * rad)
    + 127 * Math.sin((Lp - Mp) * rad) - 115 * Math.sin((Lp + Mp) * rad);
  MOON_B.forEach(([d, m, mp, f, cb]) => { b += cb * ecc(m) * Math.sin(arg(d, m, mp, f)); });
  return { lambda: (((Lp + l / 1e6) % 360) + 360) % 360, beta: b / 1e6, dist: 385000.56 + r / 1000 };
}

/** Planets' heliocentric orbits: Keplerian elements at J2000 and their rates per century
 *  (Standish, JPL, valid 1800-2050): a (au), e, I, L, long. perihelion, long. node (deg). */
const ORBITS = {
  Mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  Venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  Earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  Mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  Jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  Saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};
function heliocentric(name, days) {
  const [e0, de] = ORBITS[name]; const T = days / 36525;
  const [a, e, I, L, w, N] = e0.map((v, k) => v + de[k] * T);
  const Mo = ((((L - w) % 360) + 540) % 360 - 180) * rad; let E = Mo + e * Math.sin(Mo);
  for (let k = 0; k < 6; k += 1) E -= (E - e * Math.sin(E) - Mo) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e); const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const o = (w - N) * rad; const n = N * rad; const i = I * rad;
  const x = (Math.cos(o) * Math.cos(n) - Math.sin(o) * Math.sin(n) * Math.cos(i)) * xp + (-Math.sin(o) * Math.cos(n) - Math.cos(o) * Math.sin(n) * Math.cos(i)) * yp;
  const y = (Math.cos(o) * Math.sin(n) + Math.sin(o) * Math.cos(n) * Math.cos(i)) * xp + (-Math.sin(o) * Math.sin(n) + Math.cos(o) * Math.cos(n) * Math.cos(i)) * yp;
  const z = Math.sin(o) * Math.sin(i) * xp + Math.cos(o) * Math.sin(i) * yp;
  return [x, y, z];
}
/** Geocentric ecliptic longitude (equinox of date) and latitude (degrees) of a planet, and its distance (au). */
function planetEcliptic(name, days) {
  const p = heliocentric(name, days); const g = heliocentric('Earth', days);
  const x = p[0] - g[0]; const y = p[1] - g[1]; const z = p[2] - g[2];
  const lambda = Math.atan2(y, x) / rad + 1.397 * (days / 36525); // (to the equinox of date)
  return { lambda: ((lambda % 360) + 360) % 360, beta: Math.atan2(z, Math.hypot(x, y)) / rad, dist: Math.hypot(x, y, z) };
}
const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

/** Angle between two unit vectors (radians). */
const sep = (u, v) => Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])));

/** Rings and bodies of the sphere at `now`: horizon and meridian stay put; the equator, the
 *  ecliptic and the pole axis turn with local sidereal time. */
function skyAt(now) {
  const d = now.getTime() / DAY_MS + 2440587.5 - 2451545.0;
  const lst = ((280.46061837 + 360.98564736629 * d + LON) % 360) * rad;
  const eq = (o) => horizontal(lst - o.ra, o.dec);
  const ring = (f) => Array.from({ length: 97 }, (_, i) => f((i / 96) * 2 * Math.PI));
  const mo = moonEcliptic(d); const moonGeo = eq(eclipticToEquatorial(mo.lambda, mo.beta));
  // seen from Paris, not from the Earth's centre: the horizontal parallax (~1 deg) lowers the Moon
  const par = Math.asin(6378.14 / mo.dist) * Math.sqrt(1 - moonGeo[2] ** 2);
  const h = Math.hypot(moonGeo[0], moonGeo[1]) || 1; const alt = Math.asin(moonGeo[2]) - par;
  const moonV = [(moonGeo[0] / h) * Math.cos(alt), (moonGeo[1] / h) * Math.cos(alt), Math.sin(alt)];
  const su = sunEcliptic(d); const sunV = eq(eclipticToEquatorial(su.lambda, 0));
  const sunR = 0.2666 * rad; const moonR = Math.asin(1737.4 / mo.dist); const moonPar = Math.asin(6378.14 / mo.dist);
  return {
    rings: [
      { pts: ring((t) => [Math.cos(t), Math.sin(t), 0]), bold: true }, // horizon
      { pts: ring((t) => [0, Math.cos(t), Math.sin(t)]) }, // meridian
      { pts: ring((t) => horizontal(t, 0)) }, // celestial equator
      { pts: ring((t) => eq(eclipticToEquatorial((t / rad), 0))) }, // ecliptic
      { pts: [horizontal(0, -Math.PI / 2), horizontal(0, Math.PI / 2)] }, // pole axis
    ],
    sun: sunV, moon: moonV, sunR, moonR,
    planets: PLANETS.map((name) => { const p = planetEcliptic(name, d); return { name, v: eq(eclipticToEquatorial(p.lambda, p.beta)), dist: p.dist }; }),
    // eclipses: the Moon's disc over the Sun's (seen from Paris); the Moon in the Earth's shadow
    // (umbra and penumbra radii at the Moon's distance, Danjon's 1/50 enlargement)
    solar: { sep: sep(moonV, sunV), touch: sunR + moonR },
    lunar: { sep: sep(moonGeo, sunV.map((c) => -c)), umbra: 1.02 * (0.99834 * moonPar - sunR + 4.26e-5), penumbra: 1.02 * (0.99834 * moonPar + sunR + 4.26e-5), moonR },
  };
}
