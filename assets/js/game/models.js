/* Siege's weapons in three dimensions, as the shooters of the late nineties drew them: low-poly models
   (side profiles extruded, turned pieces, tubes), rasterised in software with a depth buffer, lit per
   pixel (a key light, the room's own light, a rim, a reflection of sky and ground on the metals), the
   materials solid procedural textures (wood grain, blued steel, brass, leather), dithered to 5 bits a
   channel and outlined dark. In the hand: gloved hands and sleeves, the moves (kick, bob, reload with
   the magazine or the ramrod, inspection, the knives' own keyframes); in profile for the menus.
   Units: metres; model space x right, y up, z forward (the barrel, the blade). Loaded after weapons.js. */
(function () {
  /* ---- 3x4 matrices [r00 r01 r02 tx  r10 r11 r12 ty  r20 r21 r22 tz] ---- */
  const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const mul = (a, b) => { const o = new Array(12); for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0); return o; };
  const tr = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
  const rx = (t) => { const c = Math.cos(t); const s = Math.sin(t); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; }; // (+t: +z turns down)
  const ry = (t) => { const c = Math.cos(t); const s = Math.sin(t); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; }; // (+t: +z turns right)
  const rz = (t) => { const c = Math.cos(t); const s = Math.sin(t); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
  const sc = (x, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
  const chain = (...ms) => ms.reduce(mul, I()); // (the last applied first)
  const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
  const apN = (m, n) => [m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[4] * n[0] + m[5] * n[1] + m[6] * n[2], m[8] * n[0] + m[9] * n[1] + m[10] * n[2]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { const f = Math.max(0, Math.min(1, t)); return f * f * (3 - 2 * f); };

  /* ---- materials: each (x, y, z in its part's space, out) writes [r, g, b, specular, shininess, metal
     (the highlight and reflection take the colour), emissive] ---- */
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  const set = (o, r, g, b, sp, sh, metal = 0, em = 0) => { o[0] = r; o[1] = g; o[2] = b; o[3] = sp; o[4] = sh; o[5] = metal; o[6] = em; };
  const wood = (base, k) => (x, y, z, o) => { // the grain runs along z, wavering; pores
    const g = Math.sin(y * 260 * k + x * 90 + Math.sin(z * 16 + y * 50) * 2.6) * 0.5 + 0.5; const pore = hash(Math.floor(z * 500), Math.floor(y * 900), Math.floor(x * 900)) > 0.9 ? 0.82 : 1;
    const f = (0.78 + 0.3 * g * g) * pore; set(o, base[0] * f, base[1] * f, base[2] * f, 0.35, 18);
  };
  let sleeveRGB = [52, 82, 170]; let bladeAt = () => [190, 196, 206]; let bladeL = 0.17; let bladeCurve = () => 0; let bladeH = () => 0.01;
  const MATS = {
    walnut: wood([118, 56, 30], 1), oak: wood([176, 122, 70], 0.8), darkwood: wood([92, 58, 36], 1.2),
    blued: (x, y, _z, o) => { const b = 0.92 + hash(0, Math.floor(y * 1600), Math.floor(x * 1600)) * 0.12; set(o, 46 * b, 48 * b, 56 * b, 1, 34, 0.55); },
    steel: (x, y, _z, o) => { const b = 0.94 + hash(0, Math.floor(y * 1800), Math.floor(x * 1800)) * 0.1; set(o, 170 * b, 174 * b, 182 * b, 1, 50, 0.8); },
    iron: (x, y, z, o) => { const pit = hash(Math.floor(x * 700), Math.floor(y * 700), Math.floor(z * 700)) > 0.92 ? 0.7 : 1; set(o, 104 * pit, 100 * pit, 96 * pit, 0.7, 22, 0.55); },
    black: (_x, _y, _z, o) => set(o, 30, 30, 34, 0.5, 30, 0.3),
    brass: (x, y, z, o) => { const b = 0.94 + hash(Math.floor(x * 900), Math.floor(y * 900), Math.floor(z * 300)) * 0.1; set(o, 222 * b, 170 * b, 74 * b, 1, 30, 1); },
    glove: (x, y, z, o) => { const p = 0.9 + hash(Math.floor(x * 800), Math.floor(y * 800), Math.floor(z * 800)) * 0.16; set(o, 66 * p, 52 * p, 44 * p, 0.35, 12); },
    cuff: (x, y, z, o) => { const s = Math.abs(((x + y + z) * 160) % 1) < 0.18 ? 0.7 : 1; set(o, 120 * s, 84 * s, 50 * s, 0.2, 8); },
    sleeve: (x, y, z, o) => { // a gambeson's sleeve, quilted in diamonds
      const u = (x + z) * 34; const v = y * 34; const st = Math.abs((u + v) % 1) < 0.08 || Math.abs((u - v + 100) % 1) < 0.08 ? 0.62 : 1; const w = 0.94 + hash(Math.floor(x * 1200), Math.floor(y * 1200), Math.floor(z * 1200)) * 0.1;
      set(o, sleeveRGB[0] * st * w, sleeveRGB[1] * st * w, sleeveRGB[2] * st * w, 0.08, 6);
    },
    mail: (x, y, z, o) => { const r = (Math.floor(x * 420) + Math.floor(y * 420) + Math.floor(z * 420)) % 2 ? 1.12 : 0.78; set(o, 132 * r, 136 * r, 146 * r, 0.9, 24, 0.6); },
    horn: (_x, y, z, o) => { const s = Math.sin(z * 90 + Math.sin(y * 300) * 2) > 0.7 ? 0.7 : 1; set(o, 218 * s, 204 * s, 168 * s, 0.6, 30); },
    cord: (x, y, z, o) => { const s = Math.abs(((z * 120 + Math.atan2(y, x) / 6.283) % 1 + 1) % 1 - 0.5) < 0.12 ? 0.66 : 1; set(o, 74 * s, 50 * s, 34 * s, 0.15, 8); },
    string: (_x, _y, _z, o) => set(o, 228, 218, 186, 0.1, 6),
    glow: (_x, _y, _z, o) => { const f = 0.8 + Math.random() * 0.4; set(o, 255 * f, 140 * f, 40 * f, 0, 1, 0, 1); },
    lens: (_x, _y, _z, o) => set(o, 40, 70, 120, 1.4, 80, 0, 0),
    glassb: (_x, _y, _z, o) => set(o, 90, 140, 210, 1.2, 60, 0.2),
    glassg: (_x, _y, _z, o) => set(o, 70, 150, 90, 1.2, 60, 0.2),
    clay: (x, y, z, o) => { const b = 0.9 + hash(Math.floor(x * 300), Math.floor(y * 300), Math.floor(z * 300)) * 0.15; set(o, 176 * b, 92 * b, 54 * b, 0.15, 8); },
    quilt: (_x, y, z, o) => { const st = Math.abs((y * 30) % 1) < 0.1 || Math.abs((z * 30 + 50) % 1) < 0.1 ? 0.7 : 1; set(o, 214 * st, 196 * st, 156 * st, 0.08, 6); },
    tabardDef: (x, y, _z, o) => { const cross = Math.abs(x) < 0.03 || Math.abs(y - 0.28) < 0.03; const w = 0.92 + hash(Math.floor(x * 300), Math.floor(y * 300), 1) * 0.12; if (cross) set(o, 236 * w, 236 * w, 230 * w, 0.1, 6); else set(o, 50 * w, 78 * w, 176 * w, 0.1, 6); }, // (the defenders: a white cross on blue)
    tabardAtt: (x, y, _z, o) => { const ch = Math.abs(y - 0.2 - (0.12 - Math.abs(x)) * 0.9) < 0.028; const w = 0.92 + hash(Math.floor(x * 300), Math.floor(y * 300), 2) * 0.12; if (ch) set(o, 232 * w, 190 * w, 70 * w, 0.4, 20, 0.4); else set(o, 160 * w, 40 * w, 34 * w, 0.1, 6); }, // (the attackers: a gold chevron on red)
    hose: (x, y, z, o) => { const w = 0.9 + hash(Math.floor(x * 500), Math.floor(y * 500), Math.floor(z * 500)) * 0.15; set(o, 84 * w, 66 * w, 52 * w, 0.05, 4); },
    boot: (x, y, z, o) => { const w = 0.9 + hash(Math.floor(x * 600), Math.floor(y * 600), Math.floor(z * 600)) * 0.12; set(o, 52 * w, 38 * w, 28 * w, 0.4, 14); },
    skin: (_x, _y, _z, o) => set(o, 222, 170, 132, 0.2, 10),
    staves: (x, y, z, o) => { const a = Math.atan2(z, x); const seam = Math.abs(((a / 6.2832) * 18 + 100) % 1 - 0.5) > 0.44; const w = 0.88 + hash(Math.floor(a * 3), Math.floor(y * 40), 3) * 0.2; set(o, (seam ? 70 : 142) * w, (seam ? 44 : 92) * w, (seam ? 26 : 50) * w, 0.2, 10); },
    straw: (x, y, z, o) => { const w = 0.75 + hash(Math.floor(x * 120), Math.floor(y * 400), Math.floor(z * 120)) * 0.4; set(o, 222 * w, 188 * w, 96 * w, 0.05, 4); },
    stone: (x, y, z, o) => { const row = Math.floor(y * 9); const joint = (y * 9) % 1 < 0.12 || ((Math.atan2(z, x) * 2 + row * 0.7 + 50) % 1) < 0.08; const w = 0.85 + hash(row, Math.floor(Math.atan2(z, x) * 2), 4) * 0.25; set(o, (joint ? 90 : 170) * w, (joint ? 86 : 162) * w, (joint ? 80 : 150) * w, 0.1, 6); },
    leaf: (x, y, z, o) => { const w = 0.6 + hash(Math.floor(x * 30), Math.floor(y * 30), Math.floor(z * 30)) * 0.55; set(o, 58 * w, 116 * w, 46 * w, 0.15, 6); },
    bark: (x, y, z, o) => { const w = 0.7 + Math.abs(Math.sin(Math.atan2(z, x) * 7 + y * 3)) * 0.35; set(o, 96 * w, 72 * w, 50 * w, 0.05, 4); },
    shingle: (x, _y, z, o) => { const w = ((Math.floor(z * 14) + Math.floor(x * 14)) % 2 ? 0.85 : 1.05) * (0.9 + hash(Math.floor(x * 14), Math.floor(z * 14), 5) * 0.15); set(o, 132 * w, 70 * w, 50 * w, 0.15, 8); },
    keg: (x, y, z, o) => { const band = Math.abs(y - 0.06) < 0.012 || Math.abs(y - 0.26) < 0.012; const a = Math.atan2(z, x); const seam = Math.abs(((a / 6.2832) * 14 + 100) % 1 - 0.5) > 0.44; set(o, band ? 60 : seam ? 54 : 104, band ? 60 : seam ? 36 : 66, band ? 66 : seam ? 22 : 38, band ? 0.8 : 0.15, 18, band ? 0.5 : 0); },
    spark: (_x, _y, _z, o) => { const f = 0.8 + Math.random() * 0.4; set(o, 255 * f, 220 * f, 120 * f, 0, 1, 0, 1); },
    blade: (_x, y, z, o) => { // the knife's finish: u along the blade, v across it (0 at the edge)
      const u = Math.max(0, Math.min(1, (z - 0.05) / bladeL)); const h = bladeH(u) || 0.001; const v = Math.max(0, Math.min(1, (y - bladeCurve(u) + h) / (2 * h)));
      const c = bladeAt(u, v); set(o, c[0], c[1], c[2], 1.3, 70, 0.75);
    },
  };
  const MATN = Object.keys(MATS); const MATF = MATN.map((k) => MATS[k]); const MID = Object.fromEntries(MATN.map((k, i) => [k, i]));

  /* ---- building: triangles into a part (positions and normals, 9 numbers a triangle each) ---- */
  function triangulate(poly) { // ear clipping; a simple polygon, either way round
    let area = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; }); const sg = area > 0 ? 1 : -1;
    const idx = poly.map((_, i) => i); const out = [];
    const inT = (p, a, b, c) => { const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]); const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]); const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    for (let guard = 0; idx.length > 3 && guard < 500; guard += 1) {
      let cut = false;
      for (let i = 0; i < idx.length; i += 1) {
        const ia = idx[(i + idx.length - 1) % idx.length]; const ib = idx[i]; const ic = idx[(i + 1) % idx.length]; const a = poly[ia]; const b = poly[ib]; const c = poly[ic];
        if (((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * sg <= 1e-12) continue;
        if (idx.some((j) => j !== ia && j !== ib && j !== ic && inT(poly[j], a, b, c))) continue;
        out.push([ia, ib, ic]); idx.splice(i, 1); cut = true; break;
      }
      if (!cut) break;
    }
    if (idx.length === 3) out.push(idx.slice());
    return out;
  }
  function builder() {
    const P = []; const N = []; const M = []; let m = I(); const stack = [];
    const b = {
      with(t, f) { stack.push(m); m = mul(m, t); f(); m = stack.pop(); },
      tri(p0, p1, p2, mat, n0, n1, n2) {
        const q0 = ap(m, p0); const q1 = ap(m, p1); const q2 = ap(m, p2); let a; let bb; let c;
        if (n0) { a = norm(apN(m, n0)); bb = norm(apN(m, n1)); c = norm(apN(m, n2)); } else { a = bb = c = norm(cross(sub(q1, q0), sub(q2, q0))); }
        P.push(...q0, ...q1, ...q2); N.push(...a, ...bb, ...c); M.push(MID[mat]);
      },
      quad(a, bb, c, d, mat, na, nb, nc, nd) { b.tri(a, bb, c, mat, na, nb, nc); b.tri(a, c, d, mat, na, nc, nd); },
      /** A 2D profile extruded: axis 'x' takes [z, y] points, 'z' takes [x, y], 'y' takes [x, z]; from a0 to a1 along the axis. */
      extrude(poly, axis, a0, a1, mat, o = {}) {
        const pt = (p, a) => (axis === 'x' ? [a, p[1], p[0]] : axis === 'z' ? [p[0], p[1], a] : [p[0], a, p[1]]);
        const n = poly.length; const nrm2 = (i) => { const p = poly[(i + n - 1) % n]; const q = poly[(i + 1) % n]; const d = [q[0] - p[0], q[1] - p[1]]; return [d[1], -d[0]]; };
        const n3 = (v) => norm(axis === 'x' ? [0, v[1], v[0]] : axis === 'z' ? [v[0], v[1], 0] : [v[0], 0, v[1]]);
        for (let i = 0; i < n; i += 1) { const j = (i + 1) % n;
          if (o.smooth) { const ni = n3(nrm2(i)); const nj = n3(nrm2(j)); b.quad(pt(poly[i], a0), pt(poly[j], a0), pt(poly[j], a1), pt(poly[i], a1), mat, ni, nj, nj, ni); } else b.quad(pt(poly[i], a0), pt(poly[j], a0), pt(poly[j], a1), pt(poly[i], a1), mat); }
        triangulate(poly).forEach(([i, j, k]) => { b.tri(pt(poly[i], a0), pt(poly[j], a0), pt(poly[k], a0), o.cap || mat); b.tri(pt(poly[i], a1), pt(poly[k], a1), pt(poly[j], a1), o.cap || mat); });
      },
      box(c, s, mat) { const [x, y, z] = c; const [w, h, d] = s; b.extrude([[z - d / 2, y - h / 2], [z + d / 2, y - h / 2], [z + d / 2, y + h / 2], [z - d / 2, y + h / 2]], 'x', x - w / 2, x + w / 2, mat); },
      /** A turned piece about the axis p0 to p1: prof [[radius, t 0..1], ...]; seg sides (few and flat: an octagonal barrel). */
      lathe(prof, p0, p1, seg, mat, o = {}) {
        const ax = sub(p1, p0); const L = Math.hypot(...ax); const az = norm(ax); const ref = Math.abs(az[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = norm(cross(ref, az)); const v = cross(az, u);
        const at = (r, t, ph) => [p0[0] + ax[0] * t + (u[0] * Math.cos(ph) + v[0] * Math.sin(ph)) * r, p0[1] + ax[1] * t + (u[1] * Math.cos(ph) + v[1] * Math.sin(ph)) * r, p0[2] + ax[2] * t + (u[2] * Math.cos(ph) + v[2] * Math.sin(ph)) * r];
        const nAt = (i, ph) => { const a = prof[Math.max(0, i - 1)]; const c = prof[Math.min(prof.length - 1, i + 1)]; const dr = c[0] - a[0]; const dl = (c[1] - a[1]) * L; const l = Math.hypot(dr, dl) || 1; const rr = dl / l; const aa = -dr / l;
          return [(u[0] * Math.cos(ph) + v[0] * Math.sin(ph)) * rr + az[0] * aa, (u[1] * Math.cos(ph) + v[1] * Math.sin(ph)) * rr + az[1] * aa, (u[2] * Math.cos(ph) + v[2] * Math.sin(ph)) * rr + az[2] * aa]; };
        const ph0 = o.phase || 0;
        for (let i = 0; i + 1 < prof.length; i += 1) for (let k = 0; k < seg; k += 1) {
          const a = ph0 + (k / seg) * 6.2832; const c = ph0 + ((k + 1) / seg) * 6.2832;
          const p00 = at(prof[i][0], prof[i][1], a); const p01 = at(prof[i][0], prof[i][1], c); const p11 = at(prof[i + 1][0], prof[i + 1][1], c); const p10 = at(prof[i + 1][0], prof[i + 1][1], a);
          if (o.flat) b.quad(p00, p01, p11, p10, mat); else b.quad(p00, p01, p11, p10, mat, nAt(i, a), nAt(i, c), nAt(i + 1, c), nAt(i + 1, a));
        }
        [[0, -1], [prof.length - 1, 1]].forEach(([i, s]) => { const r = prof[i][0]; if (r < 1e-4 || o.open) return; const cc = at(0, prof[i][1], 0); for (let k = 0; k < seg; k += 1) { const a = ph0 + (k / seg) * 6.2832; const c = ph0 + ((k + 1) / seg) * 6.2832; if (s < 0) b.tri(cc, at(r, prof[i][1], c), at(r, prof[i][1], a), o.cap || mat); else b.tri(cc, at(r, prof[i][1], a), at(r, prof[i][1], c), o.cap || mat); } });
      },
      cyl(p0, p1, r0, r1, seg, mat, o) { b.lathe([[r0, 0], [r1, 1]], p0, p1, seg, mat, o); },
      sphere(c, r, seg, mat) { const prof = []; for (let k = 0; k <= seg / 2; k += 1) { const t = k / (seg / 2); prof.push([Math.sin(t * Math.PI) * r, t]); } b.lathe(prof, [c[0], c[1] - r, c[2]], [c[0], c[1] + r, c[2]], seg, mat); },
      /** A tube along a polyline (fingers, rings, a bow), rounded at the joints. */
      tube(pts, r, seg, mat, o = {}) { for (let i = 0; i + 1 < pts.length; i += 1) b.cyl(pts[i], pts[i + 1], Array.isArray(r) ? r[i] : r, Array.isArray(r) ? r[i + 1] : r, seg, mat, { open: true }); if (!o.bare) pts.forEach((p, i) => b.sphere(p, (Array.isArray(r) ? r[i] : r) * 0.98, Math.max(4, seg - 2), mat)); },
      done() { return { P: new Float32Array(P), N: new Float32Array(N), M: new Uint8Array(M), n: M.length }; },
    };
    return b;
  }
  /** A model: named parts, each built by its own function. */
  function model(f) { const parts = {}; f((name, g) => { const b = builder(); g(b); parts[name] = b.done(); }); return parts; }

  /* A gloved hand round a grip: in its own frame the grip runs along y (radius r, centred at the origin),
     the palm on the +x side, the fingers round the front (+z) to the -x side, the thumb round the back;
     the wrist, its cuff and the quilted sleeve go off along `arm` (a unit vector) for `len`. */
  function hand(b, r, arm, len = 0.5, curl = 1) {
    const R0 = r + 0.001; const R1 = r + 0.017; const arc = []; const n = 7;
    for (let k = 0; k <= n; k += 1) { const th = -2.0 + (k / n) * 2.5; arc.push([R0 * Math.cos(th), R0 * Math.sin(th)]); }
    for (let k = n; k >= 0; k -= 1) { const th = -2.0 + (k / n) * 2.5; arc.push([R1 * Math.cos(th), R1 * Math.sin(th)]); }
    b.extrude(arc, 'y', -0.044, 0.04, 'glove', { smooth: true }); // the palm and the back of the hand, round the grip's back and right
    const Rf = r + 0.0085;
    [[0.029, 1], [0.009, 1.03], [-0.011, 1], [-0.03, 0.88]].forEach(([y, l]) => {
      const pts = []; const t1 = 0.45 + 2.85 * l * curl; for (let k = 0; k <= 5; k += 1) { const th = 0.45 + ((t1 - 0.45) * k) / 5; pts.push([Rf * Math.cos(th), y, Rf * Math.sin(th)]); }
      b.tube(pts, 0.0086, 7, 'glove', { bare: true }); b.sphere(pts[5], 0.0084, 6, 'glove'); b.sphere(pts[0], 0.0095, 6, 'glove');
    });
    const Rt = r + 0.0095; b.tube([[-1.85, 0.036], [-2.4, 0.043], [-2.95, 0.043], [2.75, 0.037]].map(([th, y]) => [Rt * Math.cos(th), y, Rt * Math.sin(th)]), [0.0108, 0.0102, 0.0096, 0.009], 7, 'glove'); // the thumb
    const w0 = [R1 * 0.35, -0.04, -R1 * 0.55]; const at = (d) => [w0[0] + arm[0] * d, w0[1] + arm[1] * d, w0[2] + arm[2] * d];
    b.cyl(at(-0.01), at(0.05), 0.026, 0.03, 8, 'glove'); b.cyl(at(0.045), at(0.085), 0.034, 0.035, 8, 'cuff');
    b.lathe([[0.036, 0], [0.041, 0.3], [0.05, 1]], at(0.08), at(len), 8, 'sleeve');
  }
  // the hand's frame onto a grip: the grip's axis up (tilted back by t), or along a fore-end (the left hand, mirrored)
  const onGrip = (x, y, z, t) => chain(tr(x, y, z), rx(t));
  const armFor = (t, v) => norm(apN(rx(-t), norm(v))); // (an arm's way in the gun's space, into the hand's tilted frame)
  const onForeEnd = (x, y, z) => [0, 0, 1, x, -1, 0, 0, y, 0, 1, 0, z];
  const LARM = norm([0.55, -0.62, -0.56]);

  /* ---- the guns ---- */
  const MODELS = {};
  MODELS.ak47 = () => model((mk) => {
    mk('body', (b) => {
      b.extrude([[-0.12, 0.026], [-0.41, -0.012], [-0.415, -0.128], [-0.385, -0.13], [-0.15, -0.036], [-0.12, -0.03]], 'x', -0.019, 0.019, 'walnut'); // the stock
      b.extrude([[-0.418, -0.13], [-0.408, -0.13], [-0.403, -0.011], [-0.413, -0.012]], 'x', -0.02, 0.02, 'blued'); // its butt plate
      b.extrude([[-0.021, -0.03], [0.021, -0.03], [0.021, 0.02], [0.015, 0.033], [0, 0.038], [-0.015, 0.033], [-0.021, 0.02]], 'z', -0.13, 0.175, 'blued', { smooth: true }); // the receiver
      b.box([0, -0.012, 0.09], [0.044, 0.03, 0.06], 'blued'); // the magazine well
      b.box([0.022, 0.013, 0.03], [0.004, 0.006, 0.17], 'black'); // the ejection port's edge (the far side)
      b.box([0.024, 0.016, 0.12], [0.014, 0.008, 0.012], 'steel'); // the charging handle
      b.box([-0.0215, 0.004, 0.09], [0.002, 0.016, 0.07], 'black'); // the magazine well's stamped dimple (the near side)
      [[-0.1, 0.02], [-0.1, -0.02], [0.04, -0.022], [0.14, -0.022], [0.16, 0.02]].forEach(([z, y]) => b.sphere([-0.0212, y, z], 0.0028, 6, 'steel')); // rivets
      b.extrude([[-0.02, 0.034], [0.17, 0.034], [0.17, 0.04], [-0.02, 0.04]], 'x', -0.017, 0.017, 'blued'); // the dust cover's lip
      b.extrude([[0.03, 0.022], [0.075, 0.016], [0.075, 0.01], [0.03, 0.016]], 'x', 0.021, 0.025, 'steel'); // the selector (the far side)
      b.box([-0.0215, -0.02, -0.02], [0.002, 0.012, 0.04], 'blued'); // the trigger pin plate
      b.extrude([[0.02, -0.03], [0.034, -0.03], [0.012, -0.14], [-0.022, -0.14], [-0.03, -0.128]], 'x', -0.016, 0.016, 'darkwood'); // the pistol grip
      b.tube([[0.05, -0.03, 0], [0.05, -0.055, 0], [0.0, -0.058, 0], [-0.02, -0.04, 0], [-0.02, -0.03, 0]].map(([z, y]) => [0, y, z]), 0.003, 5, 'blued'); // the trigger guard
      b.tube([[0, -0.03, 0.025], [0, -0.045, 0.02], [0, -0.05, 0.03]], 0.0028, 4, 'black'); // the trigger
      b.extrude([[-0.024, -0.004], [-0.022, -0.024], [-0.012, -0.034], [0.012, -0.034], [0.022, -0.024], [0.024, -0.004], [0.017, 0.012], [-0.017, 0.012]], 'z', 0.175, 0.39, 'walnut', { smooth: true }); // the lower handguard
      b.extrude([[-0.017, 0.024], [0.017, 0.024], [0.016, 0.044], [0.008, 0.052], [-0.008, 0.052], [-0.016, 0.044]], 'z', 0.2, 0.37, 'walnut', { smooth: true }); // the upper, over the gas tube
      b.box([0, 0.02, 0.385], [0.03, 0.06, 0.03], 'blued'); // the gas block
      b.cyl([0, 0.038, 0.37], [0, 0.038, 0.52], 0.0095, 0.0095, 8, 'blued'); // the gas tube
      b.cyl([0, 0.012, 0.17], [0, 0.012, 0.62], 0.012, 0.0095, 10, 'blued'); // the barrel
      b.cyl([0, 0.012, 0.62], [0, 0.012, 0.655], 0.0115, 0.0115, 8, 'black'); // the muzzle nut
      b.box([0, 0.032, 0.6], [0.02, 0.04, 0.016], 'blued'); b.box([0, 0.058, 0.6], [0.0035, 0.018, 0.004], 'black'); // the front sight
      b.box([0, 0.046, 0.2], [0.026, 0.014, 0.04], 'blued'); b.box([0, 0.054, 0.21], [0.02, 0.006, 0.05], 'black'); // the rear sight
      b.cyl([0, -0.008, 0.4], [0, -0.008, 0.6], 0.003, 0.003, 4, 'steel'); // the cleaning rod
    });
    mk('mag', (b) => { // the curved magazine
      const back = [[0.065, -0.026], [0.07, -0.08], [0.083, -0.13], [0.102, -0.18], [0.128, -0.226]]; const front = [[0.118, -0.026], [0.125, -0.075], [0.142, -0.124], [0.165, -0.17], [0.19, -0.212]];
      b.extrude([...back, ...front.reverse()], 'x', -0.0135, 0.0135, 'blued');
      for (let k = 1; k < 4; k += 1) { const t = k / 4; const p = [lerp(0.067, 0.125, t * t), lerp(-0.03, -0.215, t)]; b.box([-0.0138, p[1], p[0] + 0.025], [0.002, 0.004, 0.05], 'steel'); }
    });
    mk('rhand', (b) => b.with(onGrip(0, -0.085, 0.007, 0.33), () => hand(b, 0.017, armFor(0.33, [0.5, -0.5, -0.7]))));
    mk('lhand', (b) => b.with(onForeEnd(0, -0.008, 0.29), () => hand(b, 0.026, LARM)));
  });
  /* The long guns of the century: a stock (its butt, its wrist, its fore-end under the barrel), the barrel
     (octagonal or round), bands, the lock on the near side (match: the serpentine and its glowing cord;
     flint: the cock and frizzen), the ramrod under the barrel (pulled out to reload). */
  const longGun = (o) => () => { const by = 0.02; const L = o.len; const md = model((mk) => {
    mk('body', (b) => {
      b.extrude([[-0.06, by + 0.004], [L * 0.72, by - 0.002], [L * 0.72, by - 0.016], [-0.03, -0.022], [-0.1, -0.036], [-0.17, -0.07], [-0.42, -0.125], [-0.43, -0.122], [-0.43, -0.006], [-0.4, 0.0], [-0.17, -0.006], [-0.1, 0.012]], 'x', -0.018, 0.018, o.wood); // the stock
      b.cyl([0, by, -0.08], [0, by, L], o.r * 1.1, o.r, o.oct ? 8 : 10, o.metal, { flat: o.oct, phase: o.oct ? 0.39 : 0 }); // the barrel
      if (o.flare) b.lathe([[o.r, 0], [o.r * 1.4, 0.4], [o.r * 3, 1]], [0, by, L], [0, by, L + 0.12], 12, o.metal, { open: true });
      [L * 0.25, L * 0.5].forEach((z) => b.box([0, by - 0.006, z], [0.04, 0.03, 0.012], 'brass')); // the bands
      b.box([0, by + o.r + 0.004, L - 0.02], [0.003, 0.008, 0.006], 'brass'); // the bead
      b.extrude([[-0.07, -0.004], [0.06, -0.004], [0.06, 0.03], [-0.05, 0.03]], 'x', -0.021, -0.017, 'iron'); // the lock plate (the near side)
      if (o.lock === 'match') {
        b.tube([[-0.021, -0.02, -0.05], [-0.024, 0.005, -0.035], [-0.024, 0.03, -0.02], [-0.024, 0.036, 0.0]], 0.0022, 5, 'brass'); // the serpentine
        b.tube([[-0.024, 0.036, 0.0], [-0.026, 0.034, 0.03]], 0.0018, 4, 'cord'); b.sphere([-0.026, 0.034, 0.032], 0.003, 6, 'glow'); // the match, alight
        b.box([-0.024, 0.024, 0.045], [0.012, 0.006, 0.018], 'brass'); // the pan
      } else {
        b.tube([[-0.024, 0.0, -0.04], [-0.026, 0.03, -0.035], [-0.026, 0.05, -0.02]], 0.0035, 5, 'steel'); b.box([-0.026, 0.05, -0.012], [0.006, 0.01, 0.014], 'black'); // the cock and its flint
        b.extrude([[0.0, 0.024], [0.012, 0.024], [0.012, 0.06], [0.004, 0.058]], 'x', -0.028, -0.022, 'steel'); // the frizzen
      }
      b.tube([[0, -0.03, -0.02], [0, -0.06, 0.0], [0, -0.06, 0.06], [0, -0.03, 0.08]], 0.003, 5, 'iron'); b.tube([[0, -0.03, 0.03], [0, -0.05, 0.028]], 0.003, 4, 'iron'); // the guard, the trigger
    });
    mk('rod', (b) => b.cyl([0, by - o.r - 0.006, 0.0], [0, by - o.r - 0.006, L * 0.7], 0.0035, 0.0035, 5, 'steel'));
    mk('rhand', (b) => b.with(onGrip(0, -0.022, -0.13, 0.95), () => hand(b, 0.018, armFor(0.95, [0.45, -0.45, -0.77]))));
    mk('lhand', (b) => b.with(onForeEnd(0, by - 0.018, L * 0.36), () => hand(b, 0.024, LARM)));
  }); md.info = { rodLen: L * 0.7, rodDy: o.r + 0.006, handZ: L * 0.36, handDy: 0.018 - o.r - 0.006, muzzleZ: L + (o.flare ? 0.12 : 0) }; return md; };
  MODELS.arquebus = longGun({ len: 0.86, r: 0.0135, oct: true, metal: 'iron', wood: 'walnut', lock: 'match' });
  MODELS.caliver = longGun({ len: 0.74, r: 0.012, oct: false, metal: 'steel', wood: 'darkwood', lock: 'flint' });
  MODELS.blunderbuss = longGun({ len: 0.4, r: 0.016, oct: false, metal: 'brass', wood: 'walnut', lock: 'flint', flare: true });
  /* The pistols: a bird's-head grip ending in a ball, the barrel (or six turning), the lock. */
  const pistol = (o) => () => model((mk) => {
    const by = 0.03;
    mk('body', (b) => {
      b.extrude([[-0.03, by + 0.01], [0.06, by + 0.004], [0.06, by - 0.016], [0.02, 0.0], [0.0, -0.03], [-0.04, -0.09], [-0.075, -0.1], [-0.065, -0.06], [-0.05, -0.0]], 'x', -0.014, 0.014, 'walnut');
      b.sphere([0, -0.098, -0.07], 0.022, 8, o.pommel);
      b.extrude([[-0.03, 0.0], [0.05, 0.0], [0.05, 0.035], [-0.02, 0.035]], 'x', -0.018, -0.014, 'iron'); // the lock plate
      b.tube([[0, 0.0, 0.03], [0, -0.03, 0.035], [0, -0.035, 0.0], [0, -0.02, -0.02]], 0.0028, 5, 'iron'); b.tube([[0, 0.0, 0.01], [0, -0.022, 0.012]], 0.0028, 4, 'iron');
      if (!o.pepper) { b.cyl([0, by, 0.0], [0, by, 0.3], 0.012, 0.0105, 8, 'iron', { flat: true, phase: 0.39 }); b.cyl([0, by, 0.29], [0, by, 0.31], 0.0125, 0.0125, 8, 'brass'); b.box([0, by + 0.014, 0.29], [0.003, 0.006, 0.005], 'brass');
        b.tube([[-0.018, -0.0, -0.03], [-0.02, 0.05, -0.01], [-0.02, 0.052, 0.012]], 0.003, 5, 'steel'); } // (the dog, its jaws)
      else { b.cyl([0, by, -0.005], [0, by, 0.012], 0.024, 0.024, 10, 'iron'); b.tube([[0, by + 0.024, -0.03], [0, by + 0.036, -0.02], [0, by + 0.028, 0.0]], 0.0035, 5, 'steel'); } // (the frame, the hammer)
    });
    if (o.pepper) mk('wheel', (b) => { for (let k = 0; k < 6; k += 1) { const a = (k / 6) * 6.283; b.cyl([Math.cos(a) * 0.0135, by + Math.sin(a) * 0.0135, 0.012], [Math.cos(a) * 0.0135, by + Math.sin(a) * 0.0135, 0.15], 0.0074, 0.007, 7, 'steel'); b.cyl([Math.cos(a) * 0.0135, by + Math.sin(a) * 0.0135, 0.149], [Math.cos(a) * 0.0135, by + Math.sin(a) * 0.0135, 0.151], 0.0042, 0.0042, 6, 'black'); } });
    else mk('wheel', (b) => { b.cyl([-0.021, 0.02, 0.012], [-0.017, 0.02, 0.012], 0.014, 0.014, 10, 'brass'); b.box([-0.022, 0.02, 0.012], [0.002, 0.004, 0.024], 'iron'); });
    mk('rhand', (b) => b.with(onGrip(0, -0.05, -0.037, 0.42), () => hand(b, 0.015, armFor(0.42, [0.5, -0.5, -0.7]))));
  });
  MODELS.wheellock = pistol({ pommel: 'brass' });
  MODELS.pepperbox = pistol({ pommel: 'horn', pepper: true });
  /* The crossbows: the tiller, the bow across (its string to the nut), the box of bolts on the repeater,
     the stirrup and a brass glass on the great one. */
  const crossbow = (o) => () => model((mk) => {
    const L = o.len;
    mk('body', (b) => {
      b.extrude([[-0.36, -0.12], [-0.36, -0.01], [-0.16, 0.004], [L, 0.012], [L, -0.012], [-0.02, -0.024], [-0.1, -0.036], [-0.18, -0.07]], 'x', -0.02, 0.02, o.wood);
      if (o.box) b.extrude([[0.02, 0.018], [0.42, 0.018], [0.42, 0.11], [0.06, 0.11]], 'x', -0.016, 0.016, 'oak');
      if (o.glass) { b.lathe([[0.016, 0], [0.013, 0.15], [0.013, 0.85], [0.019, 1]], [0, 0.07, -0.05], [0, 0.07, 0.25], 10, 'brass'); b.cyl([0, 0.07, 0.249], [0, 0.07, 0.252], 0.016, 0.016, 10, 'lens'); b.box([0, 0.045, 0.1], [0.008, 0.03, 0.04], 'brass'); }
      if (o.stirrup) b.tube([[0, 0.0, L], [0.04, -0.01, L + 0.07], [0, -0.012, L + 0.1], [-0.04, -0.01, L + 0.07], [0, 0.0, L]], 0.004, 5, 'iron');
      const pts = []; for (let k = -6; k <= 6; k += 1) { const x = (k / 6) * o.span; pts.push([x, 0.018, L - 0.03 - 0.07 * (k / 6) ** 2 + (Math.abs(k) === 6 ? 0.012 : 0)]); }
      b.tube(pts, o.prod, 6, o.prodMat);
      b.box([0, 0.024, -0.02], [0.03, 0.014, 0.03], 'iron'); // the nut
    });
    mk('string', (b) => { const z = L - 0.03 - 0.07 + 0.012; b.tube([[-o.span, 0.018, z], [0, 0.024, -0.02], [o.span, 0.018, z]], 0.0018, 4, 'string', { bare: true }); b.cyl([0, 0.03, -0.02], [0, 0.03, 0.3], 0.004, 0.004, 5, 'darkwood'); b.cyl([0, 0.03, 0.3], [0, 0.03, 0.33], 0.005, 0.0, 5, 'steel'); });
    if (o.box) mk('lever', (b) => b.tube([[0, 0.11, 0.06], [0, 0.17, -0.08], [0, 0.04, -0.12]], 0.007, 6, 'darkwood'));
    mk('rhand', (b) => b.with(onGrip(0, -0.015, -0.11, 0.95), () => hand(b, 0.019, armFor(0.95, [0.45, -0.45, -0.77]))));
    mk('lhand', (b) => b.with(onForeEnd(0, -0.006, L * 0.5), () => hand(b, 0.026, LARM)));
  });
  MODELS.repeater = crossbow({ len: 0.46, wood: 'oak', box: true, span: 0.3, prod: 0.011, prodMat: 'horn' });
  MODELS.greatbow = crossbow({ len: 0.6, wood: 'walnut', glass: true, stirrup: true, span: 0.38, prod: 0.012, prodMat: 'steel' });

  /* ---- the knives: the handle along -z, the guard, the blade along +z from 0.05 (its half-width by the
     shape, curved, waved, single-edged with a spine or double-edged); the karambit's ring, the balisong's
     two handles, the push dagger's cross-grip ---- */
  const DOUBLE = { dagger: 1, kris: 1, push: 1, misericorde: 1, stiletto: 1 };
  const knifeModels = {};
  function knifeModel(kn) {
    const id = kn.shapeId; if (knifeModels[id]) return knifeModels[id]; const sh = kn.shape;
    const L = 0.17 * sh.len; const curve = (u) => sh.curve * Math.sin(u * Math.PI * 0.85) * 0.03 + (sh.wave ? Math.sin(u * Math.PI * 7) * 0.004 : 0); const half = (u) => Math.max(0.0012, sh.blade(u) * 0.014);
    const md = model((mk) => {
      mk('blade', (b) => {
        const n = 26; const t = 0.0024; const rows = [];
        for (let k = 0; k <= n; k += 1) { const u = k / n; const y = curve(u); const h = half(u) * (k === n ? 0.2 : 1); const z = 0.05 + L * u; const clip = sh.clip && u > 0.68 ? (u - 0.68) * 0.9 : 0; const tk = t * (1 - u * 0.6);
          rows.push(DOUBLE[id] ? [[0, y + h, z], [tk, y, z], [0, y - h, z], [-tk, y, z]] : [[tk, y + h * (0.5 - clip * 2), z], [tk * 0.9, y - h * 0.15, z], [0, y - h, z], [-tk * 0.9, y - h * 0.15, z], [-tk, y + h * (0.5 - clip * 2), z]]); }
        for (let k = 0; k < n; k += 1) { const A = rows[k]; const B = rows[k + 1]; for (let i = 0; i < A.length; i += 1) { const j = (i + 1) % A.length; b.quad(A[i], A[j], B[j], B[i], 'blade'); } }
        const last = rows[n]; for (let i = 1; i + 1 < last.length; i += 1) b.tri(last[0], last[i], last[i + 1], 'blade');
        if (sh.fuller) b.box([0, curve(0.35) + half(0.35) * 0.1, 0.05 + L * 0.35], [0.0052, 0.003, L * 0.5], 'black');
      });
      mk('handle', (b) => {
        if (sh.push) { b.cyl([-0.045, 0, 0.035], [0.045, 0, 0.035], 0.013, 0.013, 8, 'darkwood'); b.box([0, 0, 0.045], [0.03, 0.022, 0.02], 'steel'); return; }
        if (sh.fold) { b.extrude([[-0.075, -0.012], [0.05, -0.014], [0.05, 0.012], [-0.07, 0.014], [-0.08, 0.0]], 'x', -0.009, 0.009, id === 'navaja' ? 'horn' : 'black'); b.cyl([-0.0095, 0, 0.044], [0.0095, 0, 0.044], 0.005, 0.005, 6, 'brass'); return; }
        if (id === 'butterfly') { b.box([0.0055, -0.002, -0.012], [0.007, 0.022, 0.13], 'steel'); b.cyl([-0.009, 0, 0.044], [0.009, 0, 0.044], 0.004, 0.004, 6, 'brass'); return; }
        const mat = { karambit: 'cord', kukri: 'darkwood', kris: 'horn', bowie: 'walnut', bayonet: 'black', misericorde: 'cord', falchion: 'walnut' }[id] || 'walnut';
        if (id === 'karambit') { b.tube([[0, 0, 0.045], [0, -0.006, -0.01], [0, -0.016, -0.055]], 0.012, 8, mat); b.tube(Array.from({ length: 13 }, (_, k) => { const a = (k / 12) * 6.283; return [0, -0.03 + Math.cos(a) * 0.017, -0.075 + Math.sin(a) * 0.017]; }), 0.0045, 6, 'steel', { bare: true }); }
        else if (id === 'kris') b.tube([[0, 0, 0.045], [0, 0.004, 0.0], [0, -0.012, -0.05], [0, -0.03, -0.07]], [0.012, 0.013, 0.012, 0.015], 8, mat);
        else b.lathe([[0.011, 0], [0.0135, 0.25], [0.0125, 0.7], [0.0145, 0.88], [0.012, 1]], [0, 0, 0.045], [0, 0, -0.07], 8, mat);
        if (id !== 'karambit' && id !== 'kris') b.sphere([0, 0, -0.072], 0.012, 8, id === 'bowie' || id === 'falchion' ? 'brass' : 'steel'); // the pommel
        const gw = { dagger: 0.034, bayonet: 0.028, bowie: 0.03, falchion: 0.036, misericorde: 0.03, kukri: 0.02 }[id] || 0.018;
        b.box([0, 0, 0.047], [0.012, gw * 2, 0.007], id === 'bayonet' ? 'blued' : 'brass'); // the guard
        if (id === 'bayonet') b.tube(Array.from({ length: 13 }, (_, k) => { const a = (k / 12) * 6.283; return [Math.cos(a) * 0.011, gw + 0.002 + Math.sin(a) * 0.011, 0.047]; }), 0.0025, 5, 'blued', { bare: true });
      });
      if (id === 'butterfly') mk('h2', (b) => b.box([-0.0055, -0.002, -0.012], [0.007, 0.022, 0.13], 'steel'));
      mk('rhand', (b) => b.with(rx(Math.PI / 2), () => hand(b, 0.013, norm([0.35, -0.9, 0.2]), 0.55)));
    });
    md.info = { L, curve, half, pivot: sh.pivot === 'ring' ? [0, -0.03, -0.075] : [0, 0, 0] };
    return (knifeModels[id] = md);
  }

  /* ---- the gear, for the menus (turned pots, a vial, a flask, the gambeson, the helm, the tools) ---- */
  MODELS.firepot = () => model((mk) => mk('body', (b) => { b.lathe([[0.0, 0], [0.04, 0.05], [0.05, 0.3], [0.04, 0.75], [0.016, 0.88], [0.02, 1]], [0, -0.05, 0], [0, 0.05, 0], 12, 'clay'); b.tube([[0, 0.05, 0], [0.01, 0.07, 0.01], [0.0, 0.085, 0.03]], 0.004, 5, 'cord'); }));
  MODELS.incense = () => model((mk) => mk('body', (b) => { b.lathe([[0.0, 0], [0.045, 0.1], [0.05, 0.45], [0.03, 0.8], [0.008, 1]], [0, -0.05, 0], [0, 0.04, 0], 12, 'brass'); b.tube([[0, 0.04, 0], [0, 0.07, 0]], 0.003, 5, 'iron'); }));
  MODELS.vial = () => model((mk) => mk('body', (b) => { b.lathe([[0.0, 0], [0.024, 0.05], [0.026, 0.55], [0.01, 0.75], [0.01, 1]], [0, -0.05, 0], [0, 0.05, 0], 10, 'glassb'); b.cyl([0, 0.05, 0], [0, 0.065, 0], 0.011, 0.012, 8, 'darkwood'); }));
  MODELS.flask = () => model((mk) => mk('body', (b) => { b.lathe([[0.0, 0], [0.045, 0.06], [0.048, 0.45], [0.014, 0.7], [0.012, 1]], [0, -0.05, 0], [0, 0.05, 0], 12, 'glassg'); b.tube([[0, 0.05, 0], [0.01, 0.07, 0.0], [0.02, 0.08, 0.01]], 0.006, 5, 'quilt'); }));
  MODELS.gambeson = () => model((mk) => mk('body', (b) => { b.extrude([[-0.05, -0.06], [0.05, -0.06], [0.055, 0.03], [0.09, 0.02], [0.1, 0.035], [0.05, 0.06], [0.02, 0.055], [0, 0.045], [-0.02, 0.055], [-0.05, 0.06], [-0.1, 0.035], [-0.09, 0.02], [-0.055, 0.03]], 'x', -0.02, 0.02, 'quilt'); }));
  MODELS.helm = () => model((mk) => mk('body', (b) => { b.lathe([[0.075, 0], [0.072, 0.08], [0.05, 0.16], [0.05, 0.5], [0.035, 0.8], [0.0, 1]], [0, -0.03, 0], [0, 0.06, 0], 14, 'steel'); }));
  MODELS.tools = () => model((mk) => mk('body', (b) => { b.tube([[0, -0.03, -0.08], [0, 0.0, 0.0], [0, 0.03, 0.05]], 0.005, 6, 'iron'); b.tube([[0, 0.03, -0.08], [0, 0.0, 0.0], [0, -0.025, 0.05]], 0.005, 6, 'iron'); b.cyl([0.0, 0.0, -0.1], [0, 0.0, -0.07], 0.008, 0.008, 6, 'darkwood'); }));
  const cache = {}; const get = (id) => (cache[id] ||= MODELS[id] && MODELS[id]());

  /* ---- the men in the world: jointed low-poly figures (each part built about its own joint: the hips, the
     waist, the neck, the shoulders carrying the weapon, the knees); metres, feet at the origin, facing +z ---- */
  const MEN = {};
  function manModel(team) {
    if (MEN[team]) return MEN[team];
    const md = model((mk) => {
      mk('pelvis', (b) => { b.box([0, 0, 0], [0.32, 0.14, 0.2], 'hose'); b.box([0, 0.07, 0], [0.35, 0.04, 0.22], 'cuff'); b.lathe([[0.16, 0], [0.21, 1]], [0, 0.07, 0], [0, -0.16, 0], 8, 'mail', { open: true }); });
      mk('torso', (b) => { // about the waist
        b.extrude([[-0.16, 0], [0.16, 0], [0.21, 0.4], [0.15, 0.48], [-0.15, 0.48], [-0.21, 0.4]], 'z', -0.11, 0.11, team === 'def' ? 'tabardDef' : 'tabardAtt');
        b.sphere([0.2, 0.42, 0], 0.075, 6, 'mail'); b.sphere([-0.2, 0.42, 0], 0.075, 6, 'mail'); b.cyl([0, 0.46, 0], [0, 0.55, 0], 0.048, 0.048, 6, 'skin');
      });
      mk('head', (b) => { // about the neck
        b.sphere([0, 0.11, 0.01], 0.1, 8, 'skin'); b.box([0.036, 0.125, 0.094], [0.022, 0.014, 0.01], 'black'); b.box([-0.036, 0.125, 0.094], [0.022, 0.014, 0.01], 'black'); b.box([0, 0.075, 0.1], [0.05, 0.012, 0.01], 'boot');
        if (team === 'def') b.lathe([[0.21, 0], [0.2, 0.06], [0.115, 0.18], [0.115, 0.62], [0.08, 0.88], [0, 1]], [0, 0.13, 0], [0, 0.33, 0], 10, 'steel'); // (a kettle hat)
        else { b.lathe([[0.125, 0], [0.122, 0.45], [0.09, 0.82], [0, 1]], [0, 0.1, 0], [0, 0.31, 0], 10, 'steel'); b.box([0, 0.3, -0.02], [0.012, 0.05, 0.22], 'brass'); b.box([0, 0.12, -0.12], [0.2, 0.04, 0.08], 'steel'); } // (a morion, its comb)
      });
      mk('arms', (b) => { // about the shoulders' line: both reach forward to the weapon
        b.tube([[0.2, 0, 0], [0.17, -0.2, 0.13], [0.06, -0.12, 0.31]], [0.055, 0.05, 0.043], 6, 'mail'); b.sphere([0.06, -0.12, 0.33], 0.046, 6, 'glove');
        b.tube([[-0.2, 0, 0], [-0.15, -0.19, 0.19], [-0.03, -0.1, 0.45]], [0.055, 0.05, 0.043], 6, 'mail'); b.sphere([-0.03, -0.1, 0.47], 0.046, 6, 'glove');
      });
      mk('thigh', (b) => b.tube([[0, 0, 0], [0, -0.44, 0.02]], [0.075, 0.06], 6, 'hose'));
      mk('shin', (b) => { b.tube([[0, 0, 0], [0, -0.38, -0.01]], [0.06, 0.048], 6, 'hose'); b.box([0, -0.43, 0.04], [0.1, 0.1, 0.23], 'boot'); });
    });
    return (MEN[team] = md);
  }
  // where each weapon's right hand is in its model (to put it in a man's)
  const GRIP = { ak47: [0, -0.085, 0.007], wheellock: [0, -0.05, -0.037], pepperbox: [0, -0.05, -0.037], repeater: [0, -0.015, -0.11], greatbow: [0, -0.015, -0.11] };
  const gripOf = (id) => GRIP[id] || [0, -0.022, -0.13];
  /* The props, the keg (its fuse burning down), each in metres. */
  MODELS.barrel = () => model((mk) => mk('body', (b) => { b.lathe([[0.25, 0], [0.29, 0.5], [0.25, 1]], [0, 0, 0], [0, 0.88, 0], 12, 'staves'); b.cyl([0, 0.879, 0], [0, 0.881, 0], 0.25, 0.25, 12, 'oak'); [0.12, 0.76].forEach((y) => b.lathe([[0.275, 0], [0.276, 1]], [0, y, 0], [0, y + 0.03, 0], 12, 'iron', { open: true })); }));
  MODELS.hay = () => model((mk) => mk('body', (b) => { b.box([0, 0.3, 0], [0.95, 0.6, 0.55], 'straw'); [-0.25, 0.25].forEach((x) => b.box([x, 0.3, 0], [0.025, 0.62, 0.57], 'cord')); b.box([0.1, 0.75, 0.05], [0.7, 0.3, 0.5], 'straw'); }));
  MODELS.well = () => model((mk) => mk('body', (b) => { b.lathe([[0.95, 0], [0.95, 1], [0.78, 1], [0.78, 0]], [0, 0, 0], [0, 0.85, 0], 14, 'stone'); b.cyl([0, 0.5, 0], [0, 0.52, 0], 0.78, 0.78, 14, 'black');
    [-0.85, 0.85].forEach((x) => b.box([x, 1.3, 0], [0.12, 1.1, 0.12], 'oak')); b.cyl([-0.9, 1.75, 0], [0.9, 1.75, 0], 0.06, 0.06, 6, 'oak'); b.cyl([0, 1.75, 0], [0, 1.2, 0], 0.012, 0.012, 4, 'string'); b.lathe([[0.12, 0], [0.15, 1]], [0, 1.0, 0], [0, 1.2, 0], 8, 'oak');
    b.extrude([[-1.15, 1.85], [1.15, 1.85], [0, 2.5]], 'z', -0.7, 0.7, 'shingle'); }));
  MODELS.cart = () => model((mk) => mk('body', (b) => { b.box([0, 0.75, 0], [1.1, 0.12, 1.8], 'oak'); [-0.55, 0.55].forEach((x) => b.box([x, 0.98, 0], [0.06, 0.35, 1.8], 'oak')); b.box([0, 0.98, -0.9], [1.1, 0.35, 0.06], 'oak');
    [-0.62, 0.62].forEach((x) => { b.cyl([x - 0.04, 0.5, 0.2], [x + 0.04, 0.5, 0.2], 0.5, 0.5, 12, 'darkwood'); b.cyl([x - 0.06, 0.5, 0.2], [x + 0.06, 0.5, 0.2], 0.1, 0.1, 6, 'iron'); }); [-0.4, 0.4].forEach((x) => b.cyl([x, 0.7, 0.9], [x * 0.8, 0.45, 2.1], 0.04, 0.035, 5, 'oak')); b.box([0.2, 1.0, -0.3], [0.5, 0.4, 0.5], 'straw'); }));
  MODELS.tree = () => model((mk) => mk('body', (b) => { b.lathe([[0.32, 0], [0.22, 0.15], [0.18, 0.6], [0.14, 1]], [0, 0, 0], [0, 3.4, 0], 8, 'bark'); b.tube([[0, 2.6, 0], [0.7, 3.4, 0.2]], 0.08, 5, 'bark'); b.tube([[0, 2.9, 0], [-0.6, 3.7, -0.3]], 0.07, 5, 'bark');
    [[0, 4.4, 0, 1.5], [0.9, 3.9, 0.4, 1.1], [-0.9, 4.1, -0.3, 1.15], [0.2, 3.7, -1.0, 1.0], [-0.3, 3.8, 1.0, 1.0], [0.1, 5.2, 0.1, 0.9]].forEach(([x, y, z, r]) => b.sphere([x, y, z], r, 8, 'leaf')); }));
  MODELS.keg = () => model((mk) => { mk('body', (b) => { b.lathe([[0.17, 0], [0.2, 0.5], [0.17, 1]], [0, 0, 0], [0, 0.34, 0], 10, 'keg'); b.cyl([0, 0.339, 0], [0, 0.341, 0], 0.17, 0.17, 10, 'darkwood'); b.box([0, 0.2, 0.19], [0.14, 0.1, 0.02], 'quilt'); });
    mk('fuse', (b) => b.tube([[0, 0, 0], [0.03, 0.08, 0], [0.0, 0.16, 0.03], [-0.03, 0.24, 0]], 0.008, 4, 'cord', { bare: true })); mk('spark', (b) => b.sphere([0, 0, 0], 0.022, 6, 'spark')); });

  // a fist for holding small things (its grip along +z), the keg tools' pliers
  MODELS.fist = () => model((mk) => mk('rhand', (b) => b.with(rx(Math.PI / 2), () => hand(b, 0.015, norm([0.35, -0.9, 0.2]), 0.55))));
  MODELS.pliers = () => model((mk) => mk('body', (b) => { b.tube([[-0.012, 0, -0.08], [0.004, 0, 0.0], [0.002, 0, 0.05]], 0.004, 5, 'steel'); b.tube([[0.012, 0, -0.08], [-0.004, 0, 0.0], [-0.002, 0, 0.05]], 0.004, 5, 'steel'); b.tube([[-0.012, 0, -0.08], [-0.02, 0, -0.16]], 0.008, 5, 'tabardAtt'); b.tube([[0.012, 0, -0.08], [0.02, 0, -0.16]], 0.008, 5, 'tabardAtt'); }));

  /* ---- rasterising: a part through matrix m into the target (buf, W, H), into the shared depth buffer ---- */
  const NEAR = 0.1; let ZB = null; const box = [0, 0, 0, 0]; const mo = new Float32Array(7); // (nearer than NEAR is cut: the stock and the sleeves leave the screen as in the old shooters)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 9);
  let light = null; // { amb [r,g,b], key [x,y,z], flash }
  let TID = null; let KA = null; let KB = null; let tris = []; // (the visibility buffer: each pixel's nearest triangle and its weights; shaded once, after)
  /** Start drawing into target t (its own buffers; t.keepZ: draw against the depth already in t.ZB, the world's). */
  function begin(t) { const n = t.W * t.H; if (!t.TID || t.TID.length !== n) { if (!t.keepZ) t.ZB = new Float32Array(n); t.TID = new Int32Array(n); t.KA = new Float32Array(n); t.KB = new Float32Array(n); }
    ZB = t.ZB; TID = t.TID; KA = t.KA; KB = t.KB; if (!t.keepZ) ZB.fill(1e9); TID.fill(-1); tris = []; box[0] = t.W; box[1] = t.H; box[2] = -1; box[3] = -1; }
  function shade(t, x, y, mat, lx, ly, lz, nx, ny, nz, vx, vy, vz) {
    MATF[mat](lx, ly, lz, mo); let r = mo[0]; let g = mo[1]; let b = mo[2];
    if (!mo[6]) {
      const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1; const dx = vx / vl; const dy = vy / vl; const dz = vz / vl;
      if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz; } // (lit from either side: the camera sees the face)
      const K = light.key; const nd = nx * K[0] + ny * K[1] + nz * K[2]; const dif = Math.max(0, nd * 0.75 + 0.25) * (light.kk ?? 1); // (a wrapped key light)
      const rim = Math.max(0, nx * 0.55 + ny * 0.25 + nz * 0.8) * 0.35; const A = light.amb;
      const hx = K[0] - dx; const hy = K[1] - dy; const hz = K[2] - dz; const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1; const sp = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), mo[4]) * mo[3];
      const rdy = dy - 2 * (nx * dx + ny * dy + nz * dz) * ny; const env = rdy > 0 ? 150 + 105 * rdy : 120 + 60 * rdy; // (the sky above, the ground below, in the metals)
      const lr = A[0] * 0.5 + dif * 0.95 + rim * A[0]; const lg = A[1] * 0.5 + dif * 0.92 + rim * A[1]; const lb = A[2] * 0.5 + dif * 0.86 + rim * A[2];
      const m = mo[5]; const e = m * 0.55;
      r = r * lr * (1 - e) + (env * r / 255) * e * 1.6 + sp * (m ? r * 1.4 : 200) + light.flash * r * 0.6;
      g = g * lg * (1 - e) + (env * g / 255) * e * 1.6 + sp * (m ? g * 1.4 : 200) + light.flash * g * 0.4;
      b = b * lb * (1 - e) + (env * b / 255) * e * 1.6 + sp * (m ? b * 1.4 : 200) + light.flash * b * 0.15;
    }
    const d = BAYER[(y & 3) * 4 + (x & 3)];
    r = Math.max(0, Math.min(255, r + d)) & 0xf8; g = Math.max(0, Math.min(255, g + d)) & 0xf8; b = Math.max(0, Math.min(255, b + d)) & 0xf8;
    t.buf[y * t.W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
  }
  function raster(t, A, B, C, mat) { // A, B, C: [X, Y, Z, lx, ly, lz, nx, ny, nz] in the view
    const W = t.W; const H = t.H; const f = t.f; const cx = t.cx ?? W / 2; const cy = t.cy ?? H / 2; const orth = t.ortho;
    const pa = orth ? [cx + A[0] * orth, cy - A[1] * orth] : [cx + (f * A[0]) / A[2], cy - (f * A[1]) / A[2]];
    const pb = orth ? [cx + B[0] * orth, cy - B[1] * orth] : [cx + (f * B[0]) / B[2], cy - (f * B[1]) / B[2]];
    const pc = orth ? [cx + C[0] * orth, cy - C[1] * orth] : [cx + (f * C[0]) / C[2], cy - (f * C[1]) / C[2]];
    const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]); if (Math.abs(area) < 1e-9) return;
    const x0 = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0]))); const x1 = Math.min(W - 1, Math.ceil(Math.max(pa[0], pb[0], pc[0])));
    const y0 = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1]))); const y1 = Math.min(H - 1, Math.ceil(Math.max(pa[1], pb[1], pc[1])));
    if (x0 > x1 || y0 > y1) return;
    const id = tris.length; tris.push([A, B, C, mat, light]);
    const ia = orth ? 1 : 1 / A[2]; const ib = orth ? 1 : 1 / B[2]; const ic = orth ? 1 : 1 / C[2];
    // the weights as planes over the screen: wA = a0 + ax x + ay y (and wB), wC = 1 - wA - wB
    const ax = (pb[1] - pc[1]) / area; const ay = (pc[0] - pb[0]) / area; const a0 = ((pb[0] * pc[1]) - (pc[0] * pb[1])) / area;
    const bx = (pc[1] - pa[1]) / area; const by = (pa[0] - pc[0]) / area; const b0 = ((pc[0] * pa[1]) - (pa[0] * pc[1])) / area;
    if (x0 < box[0]) box[0] = x0; if (y0 < box[1]) box[1] = y0; if (x1 > box[2]) box[2] = x1; if (y1 > box[3]) box[3] = y1;
    for (let y = y0; y <= y1; y += 1) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x += 1) {
        const px = x + 0.5; const wa = a0 + ax * px + ay * py; const wb = b0 + bx * px + by * py; const wc = 1 - wa - wb;
        if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
        const iw = wa * ia + wb * ib + wc * ic; const z = orth ? wa * A[2] + wb * B[2] + wc * C[2] : 1 / iw; const o = y * W + x;
        if (z >= ZB[o]) continue; ZB[o] = z; TID[o] = id;
        KA[o] = orth ? wa : (wa * ia) / iw; KB[o] = orth ? wb : (wb * ib) / iw;
      }
    }
  }
  /** Shade each pixel once from its triangle: the attributes at its weights, then the light. */
  function resolve(t) {
    const W = t.W; const orth = t.ortho;
    for (let y = Math.max(0, box[1]); y <= box[3]; y += 1) for (let x = Math.max(0, box[0]); x <= box[2]; x += 1) {
      const o = y * W + x; const id = TID[o]; if (id < 0) continue; const T4 = tris[id]; const A = T4[0]; const B = T4[1]; const C = T4[2]; const mat = T4[3]; light = T4[4]; const ka = KA[o]; const kb = KB[o]; const kc = 1 - ka - kb;
      let nx = ka * A[6] + kb * B[6] + kc * C[6]; let ny = ka * A[7] + kb * B[7] + kc * C[7]; let nz = ka * A[8] + kb * B[8] + kc * C[8]; const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      shade(t, x, y, mat, ka * A[3] + kb * B[3] + kc * C[3], ka * A[4] + kb * B[4] + kc * C[4], ka * A[5] + kb * B[5] + kc * C[5], nx, ny, nz,
        orth ? 0 : ka * A[0] + kb * B[0] + kc * C[0], orth ? 0 : ka * A[1] + kb * B[1] + kc * C[1], orth ? 1 : ZB[o]);
    }
  }
  function drawPart(t, part, m) {
    if (!part) return; const P = part.P; const N = part.N;
    for (let k = 0; k < part.n; k += 1) {
      const v = [0, 1, 2].map((i) => { const o = k * 9 + i * 3; const p = [P[o], P[o + 1], P[o + 2]]; const q = ap(m, p); const n = apN(m, [N[o], N[o + 1], N[o + 2]]); if (t.mirror) { q[0] = -q[0]; n[0] = -n[0]; } return [q[0], q[1], q[2], p[0], p[1], p[2], n[0], n[1], n[2]]; });
      if (t.ortho) { raster(t, v[0], v[1], v[2], part.M[k]); continue; }
      const ins = v.filter((q) => q[2] >= NEAR).length; if (!ins) continue;
      if (ins === 3) { raster(t, v[0], v[1], v[2], part.M[k]); continue; }
      const poly = []; // (cut at the near plane)
      for (let i = 0; i < 3; i += 1) { const a = v[i]; const b = v[(i + 1) % 3]; if (a[2] >= NEAR) poly.push(a); if ((a[2] >= NEAR) !== (b[2] >= NEAR)) { const s = (NEAR - a[2]) / (b[2] - a[2]); poly.push(a.map((q, j) => q + (b[j] - q) * s)); } }
      for (let i = 1; i + 1 < poly.length; i += 1) raster(t, poly[0], poly[i], poly[i + 1], part.M[k]);
    }
  }
  /** The outline: a dark pixel round what was drawn, a darker line where the depth jumps (one piece over another). */
  function outline(t) {
    const W = t.W; const H = t.H; const x0 = Math.max(1, box[0] - 1); const y0 = Math.max(1, box[1] - 1); const x1 = Math.min(W - 2, box[2] + 1); const y1 = Math.min(H - 2, box[3] + 1);
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const o = y * W + x; const z = ZB[o];
      if (z >= 1e9) { if (ZB[o - 1] < 1e9 || ZB[o + 1] < 1e9 || ZB[o - W] < 1e9 || ZB[o + W] < 1e9) t.buf[o] = 0xff0a0c10; continue; }
      const zr = ZB[o + 1]; const zd = ZB[o + W];
      if ((zr < 1e9 && zr - z > z * 0.06) || (zd < 1e9 && zd - z > z * 0.06)) { const v = t.buf[o]; t.buf[o] = 0xff000000 | ((((v >> 16) & 255) * 0.45) << 16) | ((((v >> 8) & 255) * 0.45) << 8) | ((v & 255) * 0.45); }
    }
  }

  /* ---- in the hand ---- */
  // where each is held: its origin in the view [x, y, z], yaw, pitch, roll; its reload ('mag', 'ram', 'crank', 'turn'); its muzzle (model space)
  const HOLD = {
    ak47: { at: [0.2, -0.13, 0.45], yaw: -0.2, pitch: 0.0, roll: 0.06, reload: 'mag', muzzle: [0, 0.012, 0.66], smoke: 0.15 },
    arquebus: { at: [0.19, -0.115, 0.44], yaw: -0.18, pitch: 0.0, roll: 0.07, reload: 'ram', muzzle: [0, 0.02, 0.87], smoke: 1 },
    caliver: { at: [0.19, -0.115, 0.44], yaw: -0.18, pitch: 0.0, roll: 0.07, reload: 'ram', muzzle: [0, 0.02, 0.75], smoke: 1 },
    blunderbuss: { at: [0.19, -0.115, 0.44], yaw: -0.18, pitch: 0.0, roll: 0.07, reload: 'ram', muzzle: [0, 0.02, 0.53], smoke: 1.4 },
    wheellock: { at: [0.15, -0.105, 0.33], yaw: -0.22, pitch: 0.0, roll: 0.05, reload: 'turn', muzzle: [0, 0.03, 0.31], smoke: 0.8 },
    pepperbox: { at: [0.15, -0.105, 0.33], yaw: -0.22, pitch: 0.0, roll: 0.05, reload: 'turn', muzzle: [0, 0.03, 0.155], smoke: 0.8 },
    repeater: { at: [0.19, -0.115, 0.44], yaw: -0.18, pitch: 0.0, roll: 0.05, reload: 'crank', muzzle: [0, 0.03, 0.34] },
    greatbow: { at: [0.19, -0.115, 0.44], yaw: -0.18, pitch: 0.0, roll: 0.05, reload: 'crank', muzzle: [0, 0.03, 0.34] },
  };
  /** A pose from keyframes [[t, {name: value}], ...] at t: each value eased between its keys (0 where unset). */
  function keys(ks, t, names) { // (a Catmull-Rom spline through the keys: the move flows through each, not stopping at it)
    let k = 0; while (k < ks.length - 2 && t > ks[k + 1][0]) k += 1;
    const i0 = Math.max(0, k - 1); const i3 = Math.min(ks.length - 1, k + 2); const [t1, b] = ks[k]; const [t2, c] = ks[Math.min(k + 1, ks.length - 1)]; const a = ks[i0][1]; const d = ks[i3][1];
    const f = t2 > t1 ? Math.min(1, Math.max(0, (t - t1) / (t2 - t1))) : 1; const f2 = f * f; const f3 = f2 * f;
    const out = {}; names.forEach((n) => { const p0 = a[n] ?? 0; const p1 = b[n] ?? 0; const p2 = c[n] ?? 0; const p3 = d[n] ?? 0;
      out[n] = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3); }); return out;
  }
  const GUN_INSPECT = [[0, {}], [0.18, { yaw: 0.18, roll: -0.75, pitch: -0.12, x: -0.04, y: 0.035, z: -0.02 }], [0.5, { yaw: 0.2, roll: -0.8, pitch: -0.12, x: -0.04, y: 0.038, z: -0.02 }], [0.68, { yaw: -0.15, pitch: -0.3, roll: 0.6, y: 0.02 }], [0.86, { yaw: -0.15, pitch: -0.3, roll: 0.6, y: 0.02 }], [1, {}]];
  const puffs = []; const trail = []; let post = []; // (drawn after the shading: the flash, the trail)
  /**
   * Draw what the visitor holds into t = { buf, W, H } (the frame already drawn behind).
   * a: { kick, bobX, bobY, sway, raise (0..1), reload (0..1, or -1), inspect (0..1, or -1), swing (0..1, or -1), heavy, side,
   *      drawT (the knife's drawing out, 0..1), flash, shots, now, amb [r, g, b], team }
   */
  let low = null;
  function view(t, wid, kn, a) {
    // drawn at half the picture's size (or less: about 300 rows) and enlarged whole, as the consoles' 3D was
    const k = Math.max(1, Math.round(t.H / 300)); const w = Math.ceil(t.W / k); const h = Math.ceil(t.H / k);
    if (!low || low.W !== w || low.H !== h) low = { buf: new Uint32Array(w * h), W: w, H: h }; low.f = (h / 2) / Math.tan(0.5); low.ortho = 0; t.f = (t.H / 2) / Math.tan(0.5);
    sleeveRGB = a.team === 'att' ? [158, 44, 36] : [52, 82, 170];
    const amb = (a.amb || [1, 1, 1]).map((v) => Math.min(1.5, v));
    light = { amb, key: norm([-0.35, 0.75, -0.55]), flash: a.flash ? 1.2 : 0 };
    begin(low); post = []; low.mirror = a.hand === 'left';
    if (a.defuseT >= 0) viewDefuse(low, a); else if (wid === 'knife') viewKnife(low, kn, a); else if (wid === 'nade') viewNade(low, a); else if (wid === 'keg') viewKeg(low, a); else viewGun(low, wid, a);
    resolve(low); outline(low);
    const x0 = Math.max(0, box[0] - 1); const x1 = Math.min(w - 1, box[2] + 1); const y0 = Math.max(0, box[1] - 1); const y1 = Math.min(h - 1, box[3] + 1);
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) { const o = y * w + x; const v = low.buf[o]; if (!v) continue; low.buf[o] = 0;
      for (let j = 0; j < k; j += 1) { const Y = y * k + j; if (Y >= t.H) break; const row = Y * t.W; for (let i = 0; i < k; i += 1) { const X = x * k + i; if (X < t.W) t.buf[row + X] = v; } } }
    post.forEach((f) => f(t));
    // the powder smoke, drifting up and away from the muzzle (view space), dithered
    const now = a.now || 0;
    for (let i = puffs.length - 1; i >= 0; i -= 1) { const p = puffs[i]; const age = now - p.t; if (age > 1.6) { puffs.splice(i, 1); continue; }
      const z = p.z + age * 0.25; const x = p.x + age * p.vx; const y = p.y + age * 0.06; const r = (0.02 + age * 0.05) * p.s; const al = (1 - age / 1.6) * 0.5;
      const sx = t.W / 2 + (t.f * x) / z; const sy = t.H / 2 - (t.f * y) / z; const sr = (t.f * r) / z;
      for (let yy = Math.max(0, Math.floor(sy - sr)); yy < Math.min(t.H, sy + sr); yy += 1) for (let xx = Math.max(0, Math.floor(sx - sr)); xx < Math.min(t.W, sx + sr); xx += 1) {
        const d = Math.hypot(xx - sx, yy - sy) / sr; if (d > 1) continue; const k = al * (1 - d * d); if (k * 16 < BAYER[(yy & 3) * 4 + (xx & 3)] / 9 * 16 + 8) continue;
        const o = yy * t.W + xx; const v = t.buf[o]; const m = Math.min(1, k * 1.6); const c = 196;
        t.buf[o] = 0xff000000 | (((((v >> 16) & 255) * (1 - m) + c * m) | 0) << 16) | (((((v >> 8) & 255) * (1 - m) + c * m) | 0) << 8) | (((v & 255) * (1 - m) + c * m) | 0); }
    }
  }
  const landDip = (a) => (a.land >= 0 && a.land < 0.35 ? Math.sin((a.land / 0.35) * Math.PI) * Math.min(0.045, (a.landV || 0) * 0.007) : 0); // (a landing: the weapon dips and comes back)
  function gunMatrix(h, a, extra) {
    const kick = a.kick || 0; const raise = a.raise ?? 1; const d = 1 - ease(raise);
    const dip = landDip(a); const br = Math.sin((a.now || 0) * 1.6) * 0.0025; // (breathing, at rest)
    return chain(tr(h.at[0] + (a.bobX || 0) * 0.0012 + extra.x, h.at[1] - (a.bobY || 0) * 0.0012 - d * 0.22 + kick * 0.004 + extra.y - dip + br, h.at[2] - kick * 0.035 + extra.z),
      ry(h.yaw + (a.sway || 0) * 0.003 + extra.yaw), rx(h.pitch - kick * 0.09 + d * 0.7 + extra.pitch + (a.swayY || 0) * 0.003 + dip * 2), rz(h.roll + extra.roll + d * 0.4 - (a.sway || 0) * 0.002));
  }
  function viewGun(t, wid, a) {
    const md = get(wid); const h = HOLD[wid]; if (!md || !h) return;
    const ex = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
    if (a.inspect >= 0) Object.assign(ex, keys(GUN_INSPECT, a.inspect, ['x', 'y', 'z', 'yaw', 'pitch', 'roll']));
    const rl = a.reload; let mag = null; let rod = null; let lh = null; let str = null; let wheel = 0;
    if (rl >= 0) {
      const tilt = ease(rl / 0.2) * (1 - ease((rl - 0.82) / 0.18));
      if (h.reload === 'mag') { ex.roll += 0.55 * tilt; ex.pitch += 0.12 * tilt; ex.y -= 0.025 * tilt; ex.yaw += 0.12 * tilt;
        const out = ease((rl - 0.15) / 0.22); const back = ease((rl - 0.5) / 0.22); const off = out * (1 - back);
        mag = chain(tr(0, -0.3 * off, 0.06 * off), tr(0, -0.026, 0.065), rx(0.5 * off), tr(0, 0.026, -0.065));
        if (rl > 0.36 && rl < 0.5) mag = null; // (the old one gone, the new one not yet up)
        lh = tr(0, -0.32 * ease((rl - 0.08) / 0.2) * (1 - ease((rl - 0.62) / 0.2)) + 0.0, 0);
        if (rl > 0.78 && rl < 0.9) ex.z -= 0.012 * Math.sin(((rl - 0.78) / 0.12) * Math.PI); // (the bolt racked)
      } else if (h.reload === 'ram') { ex.pitch -= 0.5 * tilt; ex.y -= 0.1 * tilt; ex.z += 0.06 * tilt; ex.roll += 0.35 * tilt; ex.x -= 0.07 * tilt; ex.yaw += 0.1 * tilt;
        const r1 = ease((rl - 0.18) / 0.2); const r2 = ease((rl - 0.4) / 0.22); const r3 = ease((rl - 0.66) / 0.14); const I2 = md.info; // (drawn out past the muzzle, rammed down the bore, drawn and put back)
        const dz = (I2.muzzleZ + 0.02) * r1 - (I2.rodLen * 0.7) * r2 * (1 - r3) - (I2.muzzleZ + 0.02) * r3; const dy = I2.rodDy * r1 * (1 - r3);
        rod = tr(0, dy, dz); // (the left hand holds its end, the far one)
        lh = rl > 0.12 && rl < 0.84 ? tr(0, dy + I2.handDy, dz + I2.rodLen - I2.handZ) : tr(0, -0.3 * ease((rl - 0.04) / 0.08) * (1 - ease((rl - 0.84) / 0.1)), 0);
      } else if (h.reload === 'crank') { ex.pitch += 0.45 * tilt; ex.y -= 0.04 * tilt; ex.roll -= 0.2 * tilt; str = tr(0, 0, 0.22 * (1 - ease((rl - 0.3) / 0.45))); lh = tr(0, -0.3 * tilt, 0); }
      else { ex.roll += 0.9 * tilt; ex.pitch -= 0.3 * tilt; ex.y -= 0.03 * tilt; wheel = rl * 18; }
    }
    if (h.reload === 'crank' && rl < 0 && a.cycle < 0.25) str = tr(0, 0, 0.2 * (1 - a.cycle / 0.25));
    const M = gunMatrix(h, a, ex);
    drawPart(t, md.body, M);
    if (md.mag && mag !== null) drawPart(t, md.mag, mul(M, mag)); else if (md.mag && rl < 0) drawPart(t, md.mag, M);
    if (md.rod) drawPart(t, md.rod, rod ? mul(M, rod) : M);
    if (md.string) drawPart(t, md.string, str ? mul(M, str) : M);
    if (md.lever) drawPart(t, md.lever, a.cycle < 0.2 ? mul(M, chain(tr(0, 0.11, 0.06), rx(-0.5 * Math.sin((a.cycle / 0.2) * Math.PI)), tr(0, -0.11, -0.06))) : M);
    if (md.wheel) { const c = wid === 'pepperbox' ? (a.shots || 0) * (Math.PI / 3) + wheel : wheel + (a.cycle < 0.15 ? a.cycle * 40 : 0); drawPart(t, md.wheel, mul(M, wid === 'pepperbox' ? chain(tr(0, 0.03, 0), rz(c), tr(0, -0.03, 0)) : chain(tr(-0.019, 0.02, 0.012), rx(c), tr(0.019, -0.02, -0.012)))); }
    drawPart(t, md.rhand, M);
    if (md.lhand) drawPart(t, md.lhand, lh ? mul(M, lh) : M);
    if (a.flash) { const p = ap(M, h.muzzle); if (t.mirror) p[0] = -p[0]; post.push((T) => muzzleFlash(T, p)); if (h.smoke) for (let k = 0; k < 3; k += 1) puffs.push({ x: p[0], y: p[1], z: p[2], vx: (Math.random() - 0.6) * 0.06, s: h.smoke * (0.8 + Math.random() * 0.5), t: (a.now || 0) - k * 0.03 }); }
  }
  /* A throwable in the right fist: drawn back while the button is held (the fuse lit), swung forward and let go. */
  function viewNade(t, a) {
    const id = { he: 'firepot', smoke: 'incense', flash: 'vial', fire: 'flask' }[a.nade] || 'firepot'; const pot = get(id); const fist = get('fist'); const d = 1 - ease(a.raise ?? 1);
    const wind = a.pinT >= 0 ? ease(a.pinT / 0.3) : 0; const sw = a.throwT >= 0 && a.throwT < 0.7 ? a.throwT / 0.7 : -1; const dip = landDip(a);
    let x = 0.17 + (a.bobX || 0) * 0.0012 + 0.03 * wind; let y = -0.17 - (a.bobY || 0) * 0.0012 + 0.07 * wind - d * 0.2 - dip; let z = 0.42 - 0.08 * wind; let pr = -0.55 - 0.5 * wind;
    if (sw >= 0) { const e = Math.sin(Math.min(1, sw * 1.6) * Math.PI * 0.5); x -= 0.06 * e; y += 0.1 * Math.sin(sw * Math.PI) - 0.35 * Math.max(0, sw - 0.45); z += 0.25 * e; pr += 1.3 * e; }
    const M = chain(tr(x, y, z), ry(-0.32 + (a.sway || 0) * 0.003), rx(pr + (a.swayY || 0) * 0.003), rz(-0.25));
    drawPart(t, fist.rhand, M);
    if (sw < 0 || sw < 0.22) { const P = mul(M, chain(tr(0, 0.02, 0.06), rx(-Math.PI / 2), sc(0.55))); Object.values(pot).forEach((part) => { if (part.P) drawPart(t, part, P); });
      if (wind > 0.5 && (a.nade === 'he' || a.nade === 'fire')) drawPart(t, get('keg').spark, mul(P, chain(tr(0, 0.09, 0.02), sc(0.7)))); }
  }
  /* The keg in both hands; planting: set down before you, the fuse struck alight (sparks), the hands drawn back. */
  function viewKeg(t, a) {
    const kg = get('keg'); const fist = get('fist'); const d = 1 - ease(a.raise ?? 1); const p = a.plantT >= 0 ? a.plantT : -1; const dip = landDip(a);
    const down = p >= 0 ? ease(p / 0.55) : 0; const strike = p > 0.55 ? Math.sin(((p - 0.55) / 0.45) * Math.PI * 7) : 0;
    const K = chain(tr(0.04 + (a.bobX || 0) * 0.001, -0.4 - (a.bobY || 0) * 0.001 - down * 0.22 - d * 0.25 - dip, 0.78 + down * 0.08), ry(0.25 + (a.sway || 0) * 0.002), rx(-0.15 + down * 0.25));
    drawPart(t, kg.body, K); const fz = mul(K, tr(0, 0.34, 0)); drawPart(t, kg.fuse, fz);
    if (p > 0.72) drawPart(t, kg.spark, mul(K, tr(-0.03, 0.58, 0)));
    const lift = p > 0.55 ? 1 : 0; // (the right hand goes to the fuse with the flint; the left steadies the keg)
    drawPart(t, fist.rhand, mul(K, chain(tr(0.21 - lift * 0.17, 0.18 + lift * (0.34 + strike * 0.02), 0.0), ry(-Math.PI / 2 + lift * 1.2), rx(-0.3 - lift * 0.8))));
    drawPart(t, fist.rhand, mul(K, chain(sc(-1, 1, 1), tr(0.21, 0.18 - down * 0.05, 0.0), ry(-Math.PI / 2), rx(-0.3))));
  }
  /* Defusing: the keg below and before you, its fuse burning; the tools' pliers (or bare fingers) pinch it out. */
  function viewDefuse(t, a) {
    const kg = get('keg'); const fist = get('fist'); const p = a.defuseT; const cut = Math.sin(p * Math.PI * (a.tools ? 16 : 10));
    const K = chain(tr(0.0, -0.62, 0.8), ry(0.4), rx(0.3)); drawPart(t, kg.body, K);
    const burn = Math.max(0.05, (1 - (a.burn || 0)) * (1 - p * 0.3)); drawPart(t, kg.fuse, mul(K, chain(tr(0, 0.34, 0), sc(1, burn, 1)))); if (p < 0.97) drawPart(t, kg.spark, mul(K, tr(-0.03 * burn, 0.34 + 0.24 * burn, 0)));
    const R = mul(K, chain(tr(0.07 - 0.01 * cut, 0.34 + 0.24 * burn + 0.02, -0.16), ry(-0.5), rx(-0.25))); drawPart(t, fist.rhand, R);
    if (a.tools) drawPart(t, get('pliers').body, mul(R, chain(tr(0, 0.0, 0.07), sc(1 + cut * 0.15, 1, 1))));
    drawPart(t, fist.rhand, mul(K, chain(sc(-1, 1, 1), tr(0.22, 0.16, 0), ry(-Math.PI / 2), rx(-0.2))));
  }
  function muzzleFlash(t, p) {
    if (p[2] < NEAR) return; const sx = t.W / 2 + (t.f * p[0]) / p[2]; const sy = t.H / 2 - (t.f * p[1]) / p[2]; const R = (t.f * 0.07) / p[2]; const rays = 7; const ph = Math.random() * 6.283;
    const len = Array.from({ length: rays }, () => 0.5 + Math.random() * 0.7);
    for (let y = Math.max(0, Math.floor(sy - R)); y < Math.min(t.H, sy + R); y += 1) for (let x = Math.max(0, Math.floor(sx - R)); x < Math.min(t.W, sx + R); x += 1) {
      const dx = x - sx; const dy = (y - sy) * 1.3; const d = Math.hypot(dx, dy) / R; const an = Math.atan2(dy, dx) - ph; const k = ((an / 6.283) * rays % rays + rays) % rays; const ray = len[Math.floor(k)] * (1 - Math.abs((k % 1) - 0.5) * 1.5);
      if (d > Math.max(0.28, ray)) continue; const c = d < 0.18 ? [255, 255, 236] : d < 0.4 ? [255, 222, 120] : [250, 140, 40]; t.buf[y * t.W + x] = 0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0];
    }
  }
  /* The knife: the fist at the right, the blade forward and up; drawn out and inspected by the shape's own
     keyframes (rot: about the view's axis, x and y: offsets, spin: turns about its pivot, roll: the flat to
     the light, open: a folding blade), swung from one side then the other (light), or thrust (heavy). */
  function viewKnife(t, kn, a) {
    const md = knifeModel(kn); const sh = kn.shape; const info = md.info;
    bladeAt = kn.colour; bladeL = info.L; bladeCurve = info.curve; bladeH = info.half;
    const P = window.SIEGE_ARMS.pose; let ps = { rot: 0, x: 0, y: 0, spin: 0, roll: 0, open: 1 };
    if (a.drawT >= 0 && a.drawT < 1) ps = P(sh.draw, a.drawT); else if (a.inspect >= 0) ps = P(sh.inspect, a.inspect);
    const side = a.side || 1;
    const arm = (mirror, lag) => {
      let sx = 0; let sy = 0; let sz = 0; let syaw = 0; let spitch = 0; let sroll = 0;
      if (a.swing >= 0) { const s = Math.max(0, Math.min(1, a.swing - lag)); const e = ease(s); const hump = Math.sin(s * Math.PI);
        if (a.heavy) { sz = 0.11 * hump; sy = 0.03 * hump; spitch = 0.75 * hump; sx = -0.04 * hump; }
        else { sx = (0.05 - 0.17 * e) * side; sy = 0.04 * hump; syaw = (0.6 - 1.5 * e) * side; sroll = (-0.9 + 1.6 * e) * side; spitch = 0.3 * hump; } }
      const d = 1 - ease(a.raise ?? 1);
      const br = Math.sin((a.now || 0) * 1.6) * 0.003 - landDip(a);
      return chain(sc(mirror, 1, 1), tr(0.13 + (a.bobX || 0) * 0.0012 + sx + ps.x * 0.0012, -0.1 - (a.bobY || 0) * 0.0012 + sy - ps.y * 0.0018 - d * 0.2 + br, 0.33 + sz),
        ry(-0.42 + syaw + (a.sway || 0) * 0.003), rx(-0.75 + spitch + d * 0.6), rz(-0.3 + sroll - ps.rot * 0.8));
    };
    const one = (mirror, lag) => {
      const M = arm(mirror, lag); const pv = info.pivot;
      const K = mul(M, chain(tr(...pv), rx(-ps.spin * 6.2832), tr(-pv[0], -pv[1], -pv[2]), rz(ps.roll * Math.PI * 0.5)));
      const fold = sh.fold || kn.shapeId === 'butterfly' ? (1 - ps.open) * Math.PI * 0.97 : 0;
      const B = fold ? mul(K, chain(tr(0, 0, 0.044), rx(-fold), tr(0, 0, -0.044))) : K;
      drawPart(t, md.handle, K); drawPart(t, md.blade, B);
      if (md.h2) drawPart(t, md.h2, mul(K, chain(tr(0, 0, 0.044), rx(Math.sin(ps.open * Math.PI) * 2.6), tr(0, 0, -0.044))));
      drawPart(t, md.rhand, M);
      if (a.swing >= 0) { const tip = ap(B, [0, info.curve(1), 0.05 + info.L]); if (t.mirror) tip[0] = -tip[0]; trail.push([tip, a.now || 0]); }
    };
    one(1, 0); if (sh.twin) one(-1, 0.15);
    // the swing's trail: where the tip has been, a thin bright arc fading (drawn over the shading)
    post.push((T) => {
    for (let i = trail.length - 1; i >= 0; i -= 1) if ((a.now || 0) - trail[i][1] > 0.12 || a.swing < 0) trail.splice(i, 1);
    for (let i = 1; i < trail.length; i += 1) { const p = trail[i - 1][0]; const q = trail[i][0]; if (p[2] < NEAR || q[2] < NEAR) continue;
      const x0 = T.W / 2 + (T.f * p[0]) / p[2]; const y0 = T.H / 2 - (T.f * p[1]) / p[2]; const x1 = T.W / 2 + (T.f * q[0]) / q[2]; const y1 = T.H / 2 - (T.f * q[1]) / q[2]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let k = 0; k <= n; k += 1) { const x = Math.round(x0 + ((x1 - x0) * k) / n); const y = Math.round(y0 + ((y1 - y0) * k) / n); if (x < 0 || y < 0 || x >= T.W || y >= T.H) continue; const o = y * T.W + x; const v = T.buf[o]; const m = 0.55 * (i / trail.length);
        T.buf[o] = 0xff000000 | (((((v >> 16) & 255) * (1 - m) + 255 * m) | 0) << 16) | (((((v >> 8) & 255) * (1 - m) + 250 * m) | 0) << 8) | (((v & 255) * (1 - m) + 240 * m) | 0); } }
    });
  }

  /* ---- in profile: side on, the muzzle (or the blade) to the right, filling w x h; into put(x, y, packed) ---- */
  function icon(id, w, h, kn, bg = 0) {
    const t = { buf: new Uint32Array(w * h).fill(bg), W: w, H: h }; let parts;
    if (id === 'knife') { const md = knifeModel(kn); bladeAt = kn.colour; bladeL = md.info.L; bladeCurve = md.info.curve; bladeH = md.info.half; parts = ['handle', 'blade', 'h2'].map((k) => md[k]).filter(Boolean); }
    else { const md = get(id); if (!md) return t; parts = Object.entries(md).filter(([k, p]) => p.P && !/hand/.test(k)).map(([, p]) => p); }
    sleeveRGB = [52, 82, 170]; light = { amb: [1, 1, 1], key: norm([-0.4, 0.7, -0.6]), flash: 0 };
    let z0 = 1e9; let z1 = -1e9; let y0 = 1e9; let y1 = -1e9; parts.forEach((p) => { for (let i = 0; i < p.P.length; i += 3) { z0 = Math.min(z0, p.P[i + 2]); z1 = Math.max(z1, p.P[i + 2]); y0 = Math.min(y0, p.P[i + 1]); y1 = Math.max(y1, p.P[i + 1]); } });
    const s = Math.min((w * 0.92) / (z1 - z0), (h * 0.86) / (y1 - y0)); t.ortho = s;
    const M = [0, 0, 1, -(z0 + z1) / 2, 0, 1, 0, -(y0 + y1) / 2, 1, 0, 0, 1]; // (model z to the right, y up; seen from its -x side)
    begin(t); parts.forEach((p) => drawPart(t, p, M)); resolve(t); outline(t);
    return t;
  }

  /* ---- in the world: the men, the props, the keg, weapons lying, things thrown; drawn against the world's
     depth (t.ZB), shaded once, outlined where they stand against what is behind them ---- */
  /** The matrix from a thing's model (metres, scale k) at (x, y, z) facing ang, to the camera's view. */
  function placeIn(cam, x, y, z, ang, k) {
    const rx2 = -Math.sin(ang); const ry2 = Math.cos(ang); const fx = Math.cos(ang); const fy = Math.sin(ang); const rcx = -cam.dirY; const rcy = cam.dirX; const fcx = cam.dirX; const fcy = cam.dirY; const dx = x - cam.px; const dy = y - cam.py;
    return [k * (rx2 * rcx + ry2 * rcy), 0, k * (fx * rcx + fy * rcy), dx * rcx + dy * rcy, 0, k, 0, z - cam.eye, k * (rx2 * fcx + ry2 * fcy), 0, k * (fx * fcx + fy * fcy), dx * fcx + dy * fcy];
  }
  const UNIT = 0.49; // (metres to the world's units: a man of 1.76 m is 0.86)
  /** A man's parts and their matrices, posed: walking (by his stride), crouched, in the air, kneeling at the keg, aiming (pitch), fallen. */
  function manParts(a, M0, now, kn) {
    const md = manModel(a.team); const out = [];
    const sp = Math.min(1, Math.hypot(a.vx || 0, a.vy || 0) / 3.4); const ph = a.stride || 0; const air = a.z > (a.ground ?? a.z) + 0.05;
    let hip = 0.92; let lean = 0; let tL = Math.sin(ph) * 0.62 * sp; let tR = -tL; let sL = Math.max(0, Math.sin(ph - 1.3)) * 1.0 * sp + 0.05; let sR = Math.max(0, Math.sin(ph + Math.PI - 1.3)) * 1.0 * sp + 0.05;
    let armP = -(a.aimPitch || 0); hip += Math.abs(Math.cos(ph)) * 0.025 * sp;
    if (a.crouch) { hip = 0.66; tL = -1.25 + tL * 0.3; tR = -1.25 + tR * 0.3; sL = 1.9; sR = 1.9; lean = 0.22; }
    if (air) { tL = -0.75; tR = -0.45; sL = 1.3; sR = 0.9; }
    if (a.planting || a.defusing) { hip = 0.5; tR = -1.5; sR = 1.6; tL = -0.25; sL = 1.85; lean = 0.55; armP = 0.95; }
    let base = M0;
    if (!a.alive) { const f = ease((now - (a.diedAt || now)) / 0.7); const dir = a.fallDir || 1; base = mul(M0, chain(rx(-dir * f * 1.5), rz(f * 0.25 * dir))); sL += f * 0.8; sR += f * 0.5; armP += f * 0.8; } // (falling about the feet, away from the shot)
    const kick = now - (a.lastShot || -9) < 0.1 ? 1 - (now - a.lastShot) / 0.1 : 0; const flinch = now - (a.hitAt || -9) < 0.15 ? 0.15 : 0;
    const pel = mul(base, tr(0, hip, 0)); out.push([md.pelvis, pel]);
    const tor = mul(base, chain(tr(0, hip + 0.07, 0), rx(lean + flinch))); out.push([md.torso, tor]);
    out.push([md.head, mul(tor, chain(tr(0, 0.52, 0), rx(armP * 0.4)))]);
    const arms = mul(tor, chain(tr(0, 0.42, 0), rx(armP - lean), tr(0, 0, -0.03 * kick))); out.push([md.arms, arms]);
    const wid = a.wid; const hand = [0.06, -0.12, 0.33];
    if (wid === 'knife' && kn) { const km = knifeModel(kn); const K = mul(arms, chain(tr(...hand), rx(Math.PI / 2 - 0.9))); bladeAt = kn.colour; bladeL = km.info.L; bladeCurve = km.info.curve; bladeH = km.info.half; out.push([km.handle, K], [km.blade, K]); }
    else if (wid && get(wid)) { const gm = get(wid); const gp = gripOf(wid); const G = mul(arms, tr(hand[0] - gp[0], hand[1] - gp[1], hand[2] - gp[2])); Object.entries(gm).forEach(([k, part]) => { if (part.P && !/hand/.test(k) && k !== 'rod') out.push([part, G]); }); }
    if (a.hasKeg) { const kg = get('keg'); out.push([kg.body, mul(tor, chain(tr(0, 0.12, -0.24), rx(Math.PI / 2), sc(0.8)))]); }
    [[0.1, tR, sR], [-0.1, tL, sL]].forEach(([x, t, s2]) => { const th = mul(base, chain(tr(x, hip - 0.02, 0), rx(t))); out.push([md.thigh, th], [md.shin, mul(th, chain(tr(0, -0.44, 0.02), rx(s2)))]); });
    return out;
  }
  /**
   * Draw the things of the world into t = { buf, W, H, ZB (the world's depth), F, hor }.
   * items: [{ man: actor (x, y, z, a, team, wid, ...) } | { model: id, x, y, z, a, k, lying } | { keg, x, y, z, burn (0..1) } | { nade: id, x, y, z, spin }], each with light: [r, g, b].
   */
  function world(t, cam, items, sunView, now, kn) {
    t.keepZ = true; t.f = cam.F; t.cx = t.W / 2; t.cy = cam.hor; t.ortho = 0; begin(t); sleeveRGB = [52, 82, 170];
    items.forEach((it) => {
      const L = it.light || [1, 1, 1]; const lum = (L[0] + L[1] + L[2]) / 3; light = { amb: L.map((v) => Math.min(1.4, v * 0.62)), key: sunView, kk: Math.max(0.12, Math.min(1, (lum - 0.5) * 1.8)), flash: it.flash || 0 };
      if (it.man) { const a = it.man; const M0 = placeIn(cam, a.x, a.y, a.z, a.a, UNIT); manParts(a, M0, now, kn).forEach(([part, m]) => drawPart(t, part, m)); return; }
      if (it.keg) { const kg = get('keg'); const M0 = placeIn(cam, it.x, it.y, it.z, it.a || 0, UNIT); drawPart(t, kg.body, M0); const f = mul(M0, chain(tr(0, 0.34, 0), sc(1, Math.max(0.05, 1 - it.burn), 1))); drawPart(t, kg.fuse, f);
        if (it.burn < 1) drawPart(t, kg.spark, mul(M0, tr(-0.03 * (1 - it.burn), 0.34 + 0.24 * (1 - it.burn), 0))); return; }
      const md = get(it.model || it.nade); if (!md) return; let M0 = placeIn(cam, it.x, it.y, it.z, it.a || 0, it.k || UNIT);
      if (it.lying) M0 = mul(M0, chain(tr(0, 0.025, 0), rz(Math.PI / 2))); if (it.nade) M0 = mul(M0, chain(sc(0.6), rx(it.spin || 0)));
      Object.entries(md).forEach(([k, part]) => { if (part.P && !/hand/.test(k) && k !== 'rod') drawPart(t, part, M0); });
    });
    resolve(t);
    // the outline: where a figure stands against what is behind it, a dark edge
    const W = t.W; const H = t.H; const x0 = Math.max(1, box[0] - 1); const y0 = Math.max(1, box[1] - 1); const x1 = Math.min(W - 2, box[2] + 1); const y1 = Math.min(H - 2, box[3] + 1);
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) { const o = y * W + x; if (TID[o] >= 0) continue; const z = ZB[o];
      for (const n of [o - 1, o + 1, o - W, o + W]) if (TID[n] >= 0 && ZB[n] < z - 0.05) { const v = t.buf[o]; t.buf[o] = 0xff000000 | ((((v >> 16) & 255) * 0.35) << 16) | ((((v >> 8) & 255) * 0.35) << 8) | ((v & 255) * 0.35); break; } }
  }

  window.SIEGE_MODELS = { view, icon, world, HOLD, knifeModel, mat: { tr, rx, ry, rz, chain } };
}());
