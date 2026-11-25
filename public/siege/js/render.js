/* Siege drawn by the graphics card (WebGL2). The map is one mesh: each cell's top, the faces where it stands
   above its neighbour, the roofs' slabs with their ceilings; textured from textures.js in the castle's palette
   (baked once into an array, with a relief map from each texture's own light and shade), the walls dressed
   for their place (banners, windows, a door, the sites' letters) as overlays. Lit by the sun (a shadow map,
   soft at its edges) and by the sky and the torches (siege.js's light grid, a texture each frame); fogged
   towards the haze far off. The men, props and weapons are models.js's parts, each uploaded once, its
   material made in the shader (the same procedural woods, steels and cloths as the menus' drawings); what
   the visitor holds in a pass of its own. Smoke, fire, sparks, trails and the marks of the fight are
   billboards. Drawn at the screen's own size with four samples a pixel, then the flash, the hurt, death
   and the scope in a last pass. Loaded after models.js; siege.js makes the scene. */
(function () {
  const U = window.SIEGE_GLU; const m4 = U.m4; const PAL = window.HOURS_PALETTE; const TEX = window.TEXTURES; const M = window.SIEGE_MAP; const MODELS = window.SIEGE_MODELS;
  const T = 64; const DH = 160; // (a wall's dressing: 64 by 160, its foot at row 140)

  /* ---- textures, baked from textures.js: a tile of five units (160 of the pattern's pixels: courses of 4, 5, 8, 10
     or 16 meet at its edges), each pattern pixel three texels, its edges softened to a texel; a little grain; a bevel
     where the colour changes (the joints sink, the stones stand out); its relief from its own brightness ---- */
  const TP = 160; const TK = 3; const TS = TP * TK; const TILE = TP / 32; // (32 pattern pixels a unit)
  function bake(name) {
    const f = TEX[name].fn; const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; const pat = new Array(TP * TP); const at = (x, y) => pat[((y + TP) % TP) * TP + ((x + TP) % TP)];
    for (let y = 0; y < TP; y += 1) for (let x = 0; x < TP; x += 1) pat[y * TP + x] = PAL.colourOf(f(x, y));
    const hs = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
    const px = new Float32Array(TP * TP * 3); // (each pattern pixel: grain and bevel)
    for (let y = 0; y < TP; y += 1) for (let x = 0; x < TP; x += 1) { const c = at(x, y); const up = at(x, y - 1); const lf = at(x - 1, y); const dn = at(x, y + 1);
      const k = (0.94 + hs(x, y) * 0.12) * (lum(c) - lum(up) > 18 || lum(c) - lum(lf) > 18 ? 1.12 : lum(dn) - lum(c) > 18 ? 0.82 : 1); for (let i = 0; i < 3; i += 1) px[(y * TP + x) * 3 + i] = c[i] * k; }
    const rgba = new Uint8Array(TS * TS * 4); const nrm = new Uint8Array(TS * TS * 4); const h = new Float32Array(TS * TS);
    const sharp = (t) => Math.max(0, Math.min(1, (t - 0.5) * 2.4 + 0.5));
    const pl = (o) => px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11;
    for (let y = 0; y < TS; y += 1) { const v = (y + 0.5) / TK - 0.5; const y0 = Math.floor(v);
      for (let x = 0; x < TS; x += 1) { const u = (x + 0.5) / TK - 0.5; const x0 = Math.floor(u); const o = (y * TS + x) * 4;
        const q = (xx, yy) => ((((yy + TP) % TP) * TP) + ((xx + TP) % TP)) * 3; const a = q(x0, y0); const b = q(x0 + 1, y0); const c = q(x0, y0 + 1); const d = q(x0 + 1, y0 + 1);
        const la = pl(a); const lb = pl(b); const lc = pl(c); const ld = pl(d); const edge = Math.max(0, Math.min(1, (Math.max(la, lb, lc, ld) - Math.min(la, lb, lc, ld) - 30) / 40)); // (a joint: sharp; the grain within a stone: smooth)
        const fx = (u - x0) + (sharp(u - x0) - (u - x0)) * edge; const fy = (v - y0) + (sharp(v - y0) - (v - y0)) * edge;
        const fine = 0.965 + hs(x * 0.7 + 3.1, y * 1.3) * 0.07; let L = 0;
        for (let i = 0; i < 3; i += 1) { const val = ((px[a + i] * (1 - fx) + px[b + i] * fx) * (1 - fy) + (px[c + i] * (1 - fx) + px[d + i] * fx) * fy) * fine; rgba[o + i] = Math.max(0, Math.min(255, val)); L += val * [0.3, 0.59, 0.11][i]; }
        rgba[o + 3] = 255; h[y * TS + x] = L / 255; } }
    for (let y = 0; y < TS; y += 1) for (let x = 0; x < TS; x += 1) { // (the slope of the brightness: up where bright)
      const hx = h[y * TS + ((x + 1) % TS)] - h[y * TS + ((x + TS - 1) % TS)]; const hy = h[((y + 1) % TS) * TS + x] - h[((y + TS - 1) % TS) * TS + x];
      const nx = -hx * 3.2; const ny = -hy * 3.2; const l = Math.hypot(nx, ny, 1); const o = (y * TS + x) * 4;
      nrm[o] = (nx / l * 0.5 + 0.5) * 255; nrm[o + 1] = (ny / l * 0.5 + 0.5) * 255; nrm[o + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
    }
    return { rgba, nrm };
  }
  /* A wall's dressing, painted on nothing (64 wide, 160 rows; the wall's foot at row 140, so a storey of 2.19
     units above it): a banner on its rod, a window, a door, a site's letter (its paint run). */
  const GLYPH = { A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'] };
  function dressing(what) {
    const [kind, a1, a2] = what.split(':'); const px = new Uint8Array(T * DH * 4);
    const put = (x, y, c) => { if (x < 0 || x >= T || y < 0 || y >= DH) return; const o = (y * T + x) * 4; for (let i = 0; i < 3; i += 1) px[o + i] = Math.max(0, Math.min(255, c[i])); px[o + 3] = 255; };
    if (kind === 'banner') { const tint = a2 === 'def' ? [60, 96, 200] : [186, 46, 40]; const f = TEX[a1].fn;
      for (let x = 14; x <= 50; x += 1) for (let y = 10; y < 13; y += 1) put(x, y, y === 10 ? [150, 110, 60] : [86, 58, 30]); // (the rod)
      for (let y = 13; y < 106; y += 1) for (let x = 18; x <= 46; x += 1) { if (y > 92 && Math.abs(x - 32) < (y - 92) * 1.1) continue; // (the swallowtail)
        const c = PAL.colourOf(f(x >> 1, y >> 1)); const lum = (c[0] + c[1] + c[2]) / 765; const fold = 0.82 + 0.22 * Math.sin((x - 18) * 0.55); const edge = x === 18 || x === 46 ? 0.6 : 1;
        put(x, y, tint.map((v) => (v * 0.55 + v * lum * 0.9 + (lum > 0.7 ? 60 : 0)) * fold * edge)); }
    } else if (kind === 'window') {
      for (let y = 30; y < 100; y += 1) for (let x = 18; x <= 46; x += 1) { const ar = y < 44 ? Math.hypot(x - 32, y - 44) : Math.abs(x - 32); if (ar > 14) continue;
        const frame = ar > 12 || y > 96; const g2 = PAL.colourOf(TEX.leadedGlass.fn(x >> 1, y >> 1)); put(x, y, frame ? [206, 196, 176] : g2.map((v) => v * 0.55)); }
      for (let x = 15; x <= 49; x += 1) for (let y = 98; y < 102; y += 1) put(x, y, y === 98 ? [228, 220, 200] : [150, 140, 124]); // (the sill)
    } else if (kind === 'door') {
      for (let y = 46; y < 141; y += 1) for (let x = 12; x <= 52; x += 1) { const ar = y < 66 ? Math.hypot(x - 32, y - 66) : Math.abs(x - 32); if (ar > 20) continue;
        if (ar > 18) { put(x, y, [176, 166, 148]); continue; } const plank = ((x - 14) % 7 === 0) ? 0.6 : 1; const c = PAL.colourOf(TEX.oakPlanks.fn(x >> 1, y >> 1)).map((v) => v * 0.8 * plank);
        put(x, y, (y === 82 || y === 83 || y === 120 || y === 121) ? [44, 42, 46] : c); }
      for (let a = 0; a < 6.28; a += 0.2) put(Math.round(40 + Math.cos(a) * 3), Math.round(102 + Math.sin(a) * 3), [190, 160, 70]); // (the ring)
    } else if (kind === 'sign') { const gl = GLYPH[a1];
      for (let j = 0; j < 7; j += 1) for (let i = 0; i < 5; i += 1) { if (gl[j][i] !== '1') continue; for (let y = 0; y < 6; y += 1) for (let x = 0; x < 6; x += 1) { const X = 17 + i * 6 + x; const Y = 44 + j * 6 + y; const n = Math.sin(X * 12.9898 + Y * 78.233) * 43758.5453; const w = 0.88 + (n - Math.floor(n)) * 0.2; put(X, Y, [196 * w, 30 * w, 24 * w]); } }
      for (let k = 0; k < 9; k += 1) { const x = 18 + ((k * 37) % 28); for (let y = 86; y < 86 + ((k * 13) % 9); y += 1) put(x, y, [150, 24, 20]); } // (the paint ran)
    }
    return px;
  }

  /* ---- the map as one mesh: per vertex x y z, its normal, u v (a texture repeat a unit: on tops the cell's own
     x, y; on a face, along it as seen from the open side and down from the world's z), the texture's layer
     (1000 and up: a dressing), the ambient occlusion ---- */
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const AOL = [0.52, 0.68, 0.84, 1];
  function buildWorld(layerOf, dressOf) {
    const MW = M.W; const MH = M.H; const out = []; const deco = [];
    const inside = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
    const hAt = (x, y) => (inside(x, y) ? M.h[y * MW + x] : 1e9); const rfAt = (x, y) => (inside(x, y) ? M.roof[y * MW + x] : Infinity);
    // a roof is a slab from its underside up to the walls beside it (at least 0.4 thick); a cell's solid: its ground, its slab
    const slabTop = (x, y) => { const rf = rfAt(x, y); let t = rf + 0.4; D4.forEach(([dx, dy]) => { const h = hAt(x + dx, y + dy); if (h < 1e8 && h > rf) t = Math.max(t, h); }); return t; };
    const solid = (x, y) => { if (!inside(x, y)) return [[-1, 1e9]]; const rf = rfAt(x, y); return rf < 1e9 ? [[-1, hAt(x, y)], [rf, slabTop(x, y)]] : [[-1, hAt(x, y)]]; };
    const minus = (A, B) => { let r = A.map((i) => i.slice()); B.forEach(([b0, b1]) => { const n = []; r.forEach(([a0, a1]) => { if (b1 <= a0 || b0 >= a1) { n.push([a0, a1]); return; } if (b0 > a0) n.push([a0, b0]); if (b1 < a1) n.push([b1, a1]); }); r = n; }); return r.filter(([a, b]) => b - a > 1e-4); };
    const quad = (arr, P, n, UV, layer, AO) => { // (split along the diagonal that keeps the occlusion smooth)
      (AO[0] + AO[2] < AO[1] + AO[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3]).forEach((i) => arr.push(P[i][0], P[i][1], P[i][2], n[0], n[1], n[2], UV[i][0], UV[i][1], layer, AO[i]));
    };
    const CN = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let y = 0; y < MH; y += 1) for (let x = 0; x < MW; x += 1) {
      const h = hAt(x, y); const L = M.LEGEND[M.MAT[y][x]]; const rf = rfAt(x, y);
      // the top: darker in the corners where the ground rises beside it
      const occl = (xx, yy) => (hAt(xx, yy) > h + 0.3 ? 1 : 0);
      const lvl = (i, j) => { const sx = i ? 1 : -1; const sy = j ? 1 : -1; const a = occl(x + sx, y); const b = occl(x, y + sy); const c = occl(x + sx, y + sy); return a && b ? 0 : 3 - (a + b + c); };
      quad(out, CN.map(([i, j]) => [x + i, y + j, h]), [0, 0, 1], CN.map(([i, j]) => [(x + i) / TILE, (y + j) / TILE]), layerOf(L.top), CN.map(([i, j]) => AOL[lvl(i, j)]));
      if (rf < 1e9) { // the ceiling under a roof, and the roof's top
        quad(out, CN.map(([i, j]) => [x + i, y + j, rf]), [0, 0, -1], CN.map(([i, j]) => [(x + i) / TILE, (y + j) / TILE]), layerOf(L.ceil || 'oakPlanks'), [0.75, 0.75, 0.75, 0.75]);
        const st = slabTop(x, y); quad(out, CN.map(([i, j]) => [x + i, y + j, st]), [0, 0, 1], CN.map(([i, j]) => [(x + i) / TILE, (y + j) / TILE]), layerOf('shingles'), [1, 1, 1, 1]);
      }
      // the faces: what of this cell's solid its neighbour's leaves bare, facing the neighbour
      const dec = M.DECOR[`${x},${y}`]; const layer = layerOf(dec ? dec.split('+')[0] : L.side);
      D4.forEach(([dx, dy]) => {
        const nx = x + dx; const ny = y + dy; if (!inside(nx, ny)) return; const bare = minus(solid(x, y), solid(nx, ny)); if (!bare.length) return;
        const n = [dx, dy, 0]; const r = [dy, -dx]; // (r: to the right of one looking at the face from the open side)
        let A; let B; if (dx === 1) { A = [x + 1, y]; B = [x + 1, y + 1]; } else if (dx === -1) { A = [x, y]; B = [x, y + 1]; } else if (dy === 1) { A = [x, y + 1]; B = [x + 1, y + 1]; } else { A = [x, y]; B = [x + 1, y]; }
        if ((B[0] - A[0]) * r[0] + (B[1] - A[1]) * r[1] < 0) [A, B] = [B, A];
        const uA = (A[0] * r[0] + A[1] * r[1]) / TILE; const uB = uA + 1 / TILE; const hn = hAt(nx, ny);
        const face = (za, zb, aoA, aoB) => quad(out, [[A[0], A[1], za], [B[0], B[1], za], [B[0], B[1], zb], [A[0], A[1], zb]], n, [[uA, -za / TILE], [uB, -za / TILE], [uB, -zb / TILE], [uA, -zb / TILE]], layer, [aoA, aoA, aoB, aoB]);
        bare.forEach(([z0, z1]) => {
          const foot = Math.abs(z0 - hn) < 1e-4; // (rising from the neighbour's floor: darker at its foot)
          if (foot && z1 - z0 > 0.32) { face(z0, z0 + 0.3, 0.6, 1); face(z0 + 0.3, z1, 1, 1); } else face(z0, z1, foot ? 0.6 : 1, 1);
          if (dec && foot && z1 - z0 > 2) { const zt = z0 + 140 / 64; const o = 0.004; const P = (q, z) => [q[0] + dx * o, q[1] + dy * o, z];
            quad(deco, [P(A, z0), P(B, z0), P(B, zt), P(A, zt)], n, [[0, 140 / DH], [1, 140 / DH], [1, 0], [0, 0]], 1000 + dressOf(dec.split('+')[1]), [1, 1, 1, 1]); }
        });
      });
    }
    return new Float32Array([...out, ...deco]);
  }

  /** The sky's clouds: value noise in a band round the horizon (1024 x 128, wrapping round). */
  function clouds() {
    const CW = 1024; const CH = 128; const a = new Uint8Array(CW * CH); const n = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    const sm = (x, y) => { const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi; const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf); const w = (i) => ((i % (CW / 16)) + CW / 16) % (CW / 16); return (n(w(xi), yi) * (1 - u) + n(w(xi + 1), yi) * u) * (1 - v) + (n(w(xi), yi + 1) * (1 - u) + n(w(xi + 1), yi + 1) * u) * v; };
    for (let y = 0; y < CH; y += 1) for (let x = 0; x < CW; x += 1) { let s = 0; let amp = 0.55; let f = 1 / 16; for (let o = 0; o < 4; o += 1) { s += sm(x * f, y * f * 2.5) * amp; amp *= 0.5; f *= 2; } a[y * CW + x] = Math.max(0, Math.min(1, (s - 0.52) * 3)) * (1 - (y / CH) * 0.3) * 255; }
    return { a, w: CW, h: CH };
  }

  /* ---- shaders ---- */
  const HEAD = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2DArray; precision highp sampler2DShadow;\n';
  const LIGHT = `
uniform sampler2D uLight; uniform vec2 uLightK; uniform sampler2DShadow uShadow; uniform mat4 uSunVP; uniform float uShadowTexel;
uniform vec3 uSun, uSunC, uHaze, uEye; uniform float uFogD;
float sunShadow(vec3 p, vec3 n) { // (nine taps of the hardware's 2 x 2 comparison: soft edges)
  vec4 s = uSunVP * vec4(p + n * 0.03, 1.0); vec3 q = s.xyz / s.w * 0.5 + 0.5;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
  float r = 0.0; for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) r += texture(uShadow, vec3(q.xy + vec2(i, j) * uShadowTexel, q.z - 0.0005));
  return r / 9.0;
}
vec3 ambAt(vec3 p, vec3 n) { return texture(uLight, (p.xy + n.xy * 0.13) * uLightK).rgb; } // (the sky's light and the torches', at the floor in front)
vec3 fogged(vec3 c, vec3 p) { return mix(c, uHaze, clamp(distance(p, uEye) / uFogD, 0.0, 1.0) * 0.85); }
`;
  const WORLD_VS = `${HEAD}
layout(location = 0) in vec3 aPos; layout(location = 1) in vec3 aNrm; layout(location = 2) in vec2 aUV; layout(location = 3) in float aLayer; layout(location = 4) in float aAO;
uniform mat4 uVP; out vec3 vPos; out vec3 vN; out vec2 vUV; flat out float vLayer; out float vAO;
void main() { vPos = aPos; vN = aNrm; vUV = aUV; vLayer = aLayer; vAO = aAO; gl_Position = uVP * vec4(aPos, 1.0); }`;
  const WORLD_FS = `${HEAD}${LIGHT}
uniform sampler2DArray uTex, uNrm, uDress;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn3(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
in vec3 vPos; in vec3 vN; in vec2 vUV; flat in float vLayer; in float vAO; out vec4 o;
void main() {
  vec3 N = normalize(vN); vec3 n = N; vec3 alb;
  if (vLayer > 999.5) { vec4 d = texture(uDress, vec3(vUV, vLayer - 1000.0)); if (d.a < 0.5) discard; alb = d.rgb; }
  else {
    alb = texture(uTex, vec3(vUV, vLayer)).rgb; vec3 t = texture(uNrm, vec3(vUV, vLayer)).xyz * 2.0 - 1.0;
    vec3 Tg = abs(N.z) > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(N.y, -N.x, 0.0); vec3 Bg = abs(N.z) > 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, -1.0);
    n = normalize(Tg * t.x + Bg * t.y + N * t.z);
    float near = clamp(1.0 - distance(vPos, uEye) / 9.0, 0.0, 1.0); // (up close, a finer grain than the texture's: the stone's own)
    if (near > 0.0) alb *= 1.0 + (vn3(vPos * 23.0) * 0.6 + vn3(vPos * 67.0) * 0.4 - 0.5) * 0.16 * near;
  }
  vec3 amb = ambAt(vPos, N) * vAO * (0.86 + 0.14 * N.z);
  float ndl = dot(N, uSun) > 0.0 ? max(dot(n, uSun), 0.0) : 0.0; float sh = ndl > 0.0 ? sunShadow(vPos, N) : 0.0;
  vec3 c = alb * (amb + uSunC * 1.45 * ndl * sh);
  o = vec4(fogged(c, vPos), 1.0);
}`;
  const MODEL_VS = `${HEAD}
layout(location = 0) in vec3 aPos; layout(location = 1) in vec3 aNrm; layout(location = 2) in float aMat;
uniform mat4 uVP, uModel; out vec3 vObj; out vec3 vPos; out vec3 vN; flat out int vMat;
void main() { vObj = aPos; vec4 w = uModel * vec4(aPos, 1.0); vPos = w.xyz; vN = mat3(uModel) * aNrm; vMat = int(aMat + 0.5); gl_Position = uVP * w; }`;
  // the materials of models.js, the same patterns (an integer hash like its own), each [rgb 0..255, specular, shininess, metal, emissive]
  const MATS_GLSL = () => `${MODELS.MATN.map((n, i) => `#define M_${n} ${i}`).join('\n')}
uniform vec3 uSleeve; uniform sampler2D uBlade; uniform vec2 uBladeCH[33]; uniform float uBladeL; uniform float uTime;
float hsh(int x, int y, int z) { int h = x * 374761393 + y * 668265263 + z * 1274126177; h = (h ^ int(uint(h) >> 13u)) * 1274126177; return float((h ^ int(uint(h) >> 16u)) & 1023) / 1023.0; }
int fl(float v) { return int(floor(v)); }
float tm(float v) { return v - trunc(v); } // (JavaScript's v % 1)
float flick() { return 0.8 + 0.4 * fract(sin(floor(uTime * 30.0) * 91.7) * 43758.5); }
void wood(vec3 p, vec3 base, float k, out vec3 c, out vec4 q) {
  float g = sin(p.y * 260.0 * k + p.x * 90.0 + sin(p.z * 16.0 + p.y * 50.0) * 2.6) * 0.5 + 0.5; float pore = hsh(fl(p.z * 500.0), fl(p.y * 900.0), fl(p.x * 900.0)) > 0.9 ? 0.82 : 1.0;
  c = base * (0.78 + 0.3 * g * g) * pore; q = vec4(0.35, 18.0, 0.0, 0.0);
}
void material(int id, vec3 p, out vec3 c, out vec4 q) {
  float x = p.x; float y = p.y; float z = p.z; q = vec4(0.0); c = vec3(255.0, 0.0, 255.0);
  switch (id) {
    case M_walnut: wood(p, vec3(118.0, 56.0, 30.0), 1.0, c, q); break;
    case M_oak: wood(p, vec3(176.0, 122.0, 70.0), 0.8, c, q); break;
    case M_darkwood: wood(p, vec3(92.0, 58.0, 36.0), 1.2, c, q); break;
    case M_blued: { float b = 0.92 + hsh(0, fl(y * 1600.0), fl(x * 1600.0)) * 0.12; c = vec3(46.0, 48.0, 56.0) * b; q = vec4(1.0, 34.0, 0.55, 0.0); break; }
    case M_steel: { float b = 0.94 + hsh(0, fl(y * 1800.0), fl(x * 1800.0)) * 0.1; c = vec3(170.0, 174.0, 182.0) * b; q = vec4(1.0, 50.0, 0.8, 0.0); break; }
    case M_iron: { float pit = hsh(fl(x * 700.0), fl(y * 700.0), fl(z * 700.0)) > 0.92 ? 0.7 : 1.0; c = vec3(104.0, 100.0, 96.0) * pit; q = vec4(0.7, 22.0, 0.55, 0.0); break; }
    case M_black: c = vec3(30.0, 30.0, 34.0); q = vec4(0.5, 30.0, 0.3, 0.0); break;
    case M_brass: { float b = 0.94 + hsh(fl(x * 900.0), fl(y * 900.0), fl(z * 300.0)) * 0.1; c = vec3(222.0, 170.0, 74.0) * b; q = vec4(1.0, 30.0, 1.0, 0.0); break; }
    case M_glove: { float b = 0.9 + hsh(fl(x * 800.0), fl(y * 800.0), fl(z * 800.0)) * 0.16; c = vec3(66.0, 52.0, 44.0) * b; q = vec4(0.35, 12.0, 0.0, 0.0); break; }
    case M_cuff: { float s = abs(tm((x + y + z) * 160.0)) < 0.18 ? 0.7 : 1.0; c = vec3(120.0, 84.0, 50.0) * s; q = vec4(0.2, 8.0, 0.0, 0.0); break; }
    case M_sleeve: { float u = (x + z) * 34.0; float v = y * 34.0; float st = abs(tm(u + v)) < 0.08 || abs(tm(u - v + 100.0)) < 0.08 ? 0.62 : 1.0; float w = 0.94 + hsh(fl(x * 1200.0), fl(y * 1200.0), fl(z * 1200.0)) * 0.1; c = uSleeve * st * w; q = vec4(0.08, 6.0, 0.0, 0.0); break; }
    case M_mail: { float r = ((fl(x * 420.0) + fl(y * 420.0) + fl(z * 420.0)) & 1) != 0 ? 1.12 : 0.78; c = vec3(132.0, 136.0, 146.0) * r; q = vec4(0.9, 24.0, 0.6, 0.0); break; }
    case M_horn: { float s = sin(z * 90.0 + sin(y * 300.0) * 2.0) > 0.7 ? 0.7 : 1.0; c = vec3(218.0, 204.0, 168.0) * s; q = vec4(0.6, 30.0, 0.0, 0.0); break; }
    case M_cord: { float s = abs(fract(z * 120.0 + atan(y, x) / 6.283) - 0.5) < 0.12 ? 0.66 : 1.0; c = vec3(74.0, 50.0, 34.0) * s; q = vec4(0.15, 8.0, 0.0, 0.0); break; }
    case M_string: c = vec3(228.0, 218.0, 186.0); q = vec4(0.1, 6.0, 0.0, 0.0); break;
    case M_glow: c = vec3(255.0, 140.0, 40.0) * flick(); q = vec4(0.0, 1.0, 0.0, 1.0); break;
    case M_lens: c = vec3(40.0, 70.0, 120.0); q = vec4(1.4, 80.0, 0.0, 0.0); break;
    case M_glassb: c = vec3(90.0, 140.0, 210.0); q = vec4(1.2, 60.0, 0.2, 0.0); break;
    case M_glassg: c = vec3(70.0, 150.0, 90.0); q = vec4(1.2, 60.0, 0.2, 0.0); break;
    case M_clay: { float b = 0.9 + hsh(fl(x * 300.0), fl(y * 300.0), fl(z * 300.0)) * 0.15; c = vec3(176.0, 92.0, 54.0) * b; q = vec4(0.15, 8.0, 0.0, 0.0); break; }
    case M_quilt: { float st = abs(tm(y * 30.0)) < 0.1 || abs(tm(z * 30.0 + 50.0)) < 0.1 ? 0.7 : 1.0; c = vec3(214.0, 196.0, 156.0) * st; q = vec4(0.08, 6.0, 0.0, 0.0); break; }
    case M_tabardDef: { bool cr = abs(x) < 0.03 || abs(y - 0.28) < 0.03; float w = 0.92 + hsh(fl(x * 300.0), fl(y * 300.0), 1) * 0.12; c = (cr ? vec3(236.0, 236.0, 230.0) : vec3(50.0, 78.0, 176.0)) * w; q = vec4(0.1, 6.0, 0.0, 0.0); break; }
    case M_tabardAtt: { bool ch = abs(y - 0.2 - (0.12 - abs(x)) * 0.9) < 0.028; float w = 0.92 + hsh(fl(x * 300.0), fl(y * 300.0), 2) * 0.12; if (ch) { c = vec3(232.0, 190.0, 70.0) * w; q = vec4(0.4, 20.0, 0.4, 0.0); } else { c = vec3(160.0, 40.0, 34.0) * w; q = vec4(0.1, 6.0, 0.0, 0.0); } break; }
    case M_hose: { float w = 0.9 + hsh(fl(x * 500.0), fl(y * 500.0), fl(z * 500.0)) * 0.15; c = vec3(84.0, 66.0, 52.0) * w; q = vec4(0.05, 4.0, 0.0, 0.0); break; }
    case M_boot: { float w = 0.9 + hsh(fl(x * 600.0), fl(y * 600.0), fl(z * 600.0)) * 0.12; c = vec3(52.0, 38.0, 28.0) * w; q = vec4(0.4, 14.0, 0.0, 0.0); break; }
    case M_skin: c = vec3(222.0, 170.0, 132.0); q = vec4(0.2, 10.0, 0.0, 0.0); break;
    case M_staves: { float a = atan(z, x); bool seam = abs(fract(a / 6.2832 * 18.0 + 100.0) - 0.5) > 0.44; float w = 0.88 + hsh(fl(a * 3.0), fl(y * 40.0), 3) * 0.2; c = (seam ? vec3(70.0, 44.0, 26.0) : vec3(142.0, 92.0, 50.0)) * w; q = vec4(0.2, 10.0, 0.0, 0.0); break; }
    case M_straw: { float w = 0.75 + hsh(fl(x * 120.0), fl(y * 400.0), fl(z * 120.0)) * 0.4; c = vec3(222.0, 188.0, 96.0) * w; q = vec4(0.05, 4.0, 0.0, 0.0); break; }
    case M_stone: { int row = fl(y * 9.0); bool joint = tm(y * 9.0) < 0.12 || fract(atan(z, x) * 2.0 + float(row) * 0.7 + 50.0) < 0.08; float w = 0.85 + hsh(row, fl(atan(z, x) * 2.0), 4) * 0.25; c = (joint ? vec3(90.0, 86.0, 80.0) : vec3(170.0, 162.0, 150.0)) * w; q = vec4(0.1, 6.0, 0.0, 0.0); break; }
    case M_leaf: { float w = 0.6 + hsh(fl(x * 30.0), fl(y * 30.0), fl(z * 30.0)) * 0.55; c = vec3(58.0, 116.0, 46.0) * w; q = vec4(0.15, 6.0, 0.0, 0.0); break; }
    case M_bark: { float w = 0.7 + abs(sin(atan(z, x) * 7.0 + y * 3.0)) * 0.35; c = vec3(96.0, 72.0, 50.0) * w; q = vec4(0.05, 4.0, 0.0, 0.0); break; }
    case M_shingle: { float w = (((fl(z * 14.0) + fl(x * 14.0)) & 1) != 0 ? 0.85 : 1.05) * (0.9 + hsh(fl(x * 14.0), fl(z * 14.0), 5) * 0.15); c = vec3(132.0, 70.0, 50.0) * w; q = vec4(0.15, 8.0, 0.0, 0.0); break; }
    case M_keg: { bool band = abs(y - 0.06) < 0.012 || abs(y - 0.26) < 0.012; float a = atan(z, x); bool seam = abs(fract(a / 6.2832 * 14.0 + 100.0) - 0.5) > 0.44; c = band ? vec3(60.0, 60.0, 66.0) : seam ? vec3(54.0, 36.0, 22.0) : vec3(104.0, 66.0, 38.0); q = vec4(band ? 0.8 : 0.15, 18.0, band ? 0.5 : 0.0, 0.0); break; }
    case M_spark: c = vec3(255.0, 220.0, 120.0) * flick(); q = vec4(0.0, 1.0, 0.0, 1.0); break;
    case M_blade: { // the knife's finish (a baked picture: u along the blade, v across from the edge), its curve and width from a table
      float u = clamp((z - 0.05) / uBladeL, 0.0, 1.0); float k = u * 32.0; int i = int(floor(k)); vec2 ch = mix(uBladeCH[i], uBladeCH[min(i + 1, 32)], fract(k));
      float h = max(ch.y, 0.001); float v = clamp((y - ch.x + h) / (2.0 * h), 0.0, 1.0); c = texture(uBlade, vec2(u, v)).rgb * 255.0; q = vec4(1.3, 70.0, 0.75, 0.0); break; }
  }
}`;
  const MODEL_FS = () => `${HEAD}${LIGHT}${MATS_GLSL()}
uniform int uMode; uniform vec3 uAmbV, uKey, uUp, uRim; uniform float uFlash;
in vec3 vObj; in vec3 vPos; in vec3 vN; flat in int vMat; out vec4 o;
void main() { // (models.js's light: a wrapped key light, the room's light, a rim, sky and ground in the metals; in the world the sun's shadow)
  vec3 col; vec4 q; material(vMat, vObj, col, q); vec3 c;
  if (q.w > 0.5) c = col;
  else {
    vec3 n = normalize(vN); vec3 V = normalize(vPos - uEye); float nv = dot(n, V); if (nv > 0.0) { n = -n; nv = -nv; }
    float kk = 1.0; vec3 A = uAmbV;
    if (uMode == 0) { kk = 0.12 + 0.88 * sunShadow(vPos, n); A = min(ambAt(vPos, n) * 0.8, vec3(1.4)); } else kk = 0.8;
    float dif = max(0.0, dot(n, uKey) * 0.75 + 0.25) * kk; float rim = max(0.0, dot(n, uRim)) * 0.35;
    vec3 h = normalize(uKey - V); float qq = 1.0 - (1.0 - dot(n, h)) * q.y * 0.25; float sp = qq > 0.0 ? qq * qq * qq * qq * q.x * kk : 0.0;
    float rdy = dot(V - 2.0 * nv * n, uUp); float env = rdy > 0.0 ? 150.0 + 105.0 * rdy : 120.0 + 60.0 * rdy;
    vec3 L = A * (uMode == 0 ? 0.5 : 0.36) + dif * vec3(0.95, 0.92, 0.86) + rim * A; float e = q.z * 0.55; float ek = env / 255.0 * e * 1.6;
    c = col * (L * (1.0 - e) + ek + uFlash * vec3(0.6, 0.4, 0.15)) + sp * (q.z > 0.0 ? col * 1.4 : vec3(200.0));
  }
  c /= 255.0; if (uMode == 0) c = fogged(c, vPos);
  o = vec4(c, 1.0);
}`;
  const SHADOW_VS = `${HEAD}
layout(location = 0) in vec3 aPos; uniform mat4 uSunVP, uModel;
void main() { gl_Position = uSunVP * uModel * vec4(aPos, 1.0); }`;
  const SHADOW_FS = `${HEAD}void main() {}`;
  const FULL_VS = `${HEAD}
out vec2 vP; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vP = p; gl_Position = vec4(p, 0.0, 1.0); }`;
  const SKY_FS = `${HEAD}
uniform vec3 uF, uR, uU, uSun, uSky, uHaze; uniform sampler2D uClouds; in vec2 vP; out vec4 o;
void main() {
  vec3 d = normalize(uF + vP.x * uR + vP.y * uU); float e = d.z;
  vec3 base = mix(uHaze, uSky, clamp(e * 2.2, 0.0, 1.0));
  float cl = e > 0.0 ? texture(uClouds, vec2(atan(d.y, d.x) / 6.2831853, clamp(e * 1.8, 0.0, 0.98))).r * (1.0 - smoothstep(0.32, 0.54, e)) : 0.0; // (the band thins towards the zenith)
  vec3 c = base + (vec3(0.973, 0.973, 0.988) - base) * cl * 0.9;
  float sd = max(dot(d, uSun), 0.0); c += vec3(0.24, 0.2, 0.12) * pow(sd, 48.0); if (sd > 0.9993) c = vec3(1.0, 0.98, 0.9);
  o = vec4(e < 0.0 ? uHaze : c, 1.0);
}`;
  const BB_VS = `${HEAD}
layout(location = 0) in vec3 aPos; layout(location = 1) in vec2 aUV; layout(location = 2) in vec4 aCol; layout(location = 3) in float aKind;
uniform mat4 uVP; out vec2 vUV; out vec4 vCol; flat out int vKind;
void main() { vUV = aUV; vCol = aCol; vKind = int(aKind + 0.5); gl_Position = uVP * vec4(aPos, 1.0); }`;
  // (premultiplied: an alpha of 0 adds light, so one blending serves smoke, flames and marks)
  const BB_FS = `${HEAD}
uniform float uTime; in vec2 vUV; in vec4 vCol; flat in int vKind; out vec4 o;
float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUV; float r = length(p); vec4 c = vec4(0.0);
  if (vKind == 0) { float a = vCol.a * smoothstep(1.0, 0.15, r) * (0.75 + 0.25 * vn(p * 2.5 + vCol.rg * 40.0)); c = vec4(vCol.rgb * a, a); } // (smoke, a puff)
  else if (vKind == 1) { // a flame: a tongue licking up
    float fk = vn(vec2(p.x * 3.0 + vCol.a * 7.0, p.y * 2.2 - uTime * 7.0)); float s = length(vec2(p.x * 1.7, (p.y + 0.45) * 0.85)) + max(0.0, p.y + 0.45) * 0.3 - fk * 0.38;
    float k = smoothstep(0.78, 0.22, s); vec3 col = mix(vec3(0.85, 0.22, 0.05), vec3(1.0, 0.95, 0.7), smoothstep(0.35, 0.95, k)); c = vec4(col * k * 1.3, 0.0); }
  else if (vKind == 2) { float k = smoothstep(1.0, 0.55, r); c = vec4(vCol.rgb * k, vCol.a * k); } // (a spark, a drop, a chip)
  else if (vKind == 3) { float k = (1.0 - abs(p.y)) * vCol.a; c = vec4(vCol.rgb * k, 0.0); } // (a trail)
  else if (vKind == 4) { float k = smoothstep(1.0, 0.75, r); float core = smoothstep(0.6, 0.35, r); c = vec4(0.0, 0.0, 0.0, k * (0.45 + 0.5 * core)); } // (a hole)
  else if (vKind == 5) { float nn = vn(p * 3.0 + vCol.a * 17.0); float k = smoothstep(0.92, 0.62, r + (nn - 0.5) * 0.55); c = vec4(vec3(0.4, 0.02, 0.03) * k * 0.85, k * 0.85); } // (blood)
  else if (vKind == 6) { float an = atan(p.y, p.x); float ray = 0.45 + 0.55 * abs(sin(an * 3.5 + vCol.a * 6.0)); float k = smoothstep(max(0.3, ray), 0.0, r); // (the muzzle's flash)
    vec3 col = mix(vec3(0.98, 0.55, 0.16), vec3(1.0, 1.0, 0.92), smoothstep(0.25, 0.9, k)); c = vec4(col * k * 1.4, 0.0); }
  if (c.r + c.g + c.b + c.a < 0.004) discard;
  o = c;
}`;
  // the smoke: a ray from the eye through its volume (a 3D texture) to whatever stands behind it (the depth), wisps from noise
  const SMOKE_FS = `${HEAD}precision highp sampler3D;
uniform sampler3D uSmoke, uNoise; uniform sampler2D uDepth; uniform vec3 uMin, uMax, uSize, uEye, uF, uR, uU; uniform float uNear, uFar, uTime; in vec2 vP; out vec4 o;
void main() {
  vec3 dr = uF + vP.x * uR + vP.y * uU; float k = 1.0 / length(dr); vec3 d = dr * k; // (k: the ray's share of the forward way)
  vec3 inv = 1.0 / d; vec3 a = (uMin - uEye) * inv; vec3 b = (uMax - uEye) * inv; vec3 lo = min(a, b); vec3 hi = max(a, b);
  float t0 = max(max(lo.x, lo.y), max(lo.z, 0.0)); float t1 = min(min(hi.x, hi.y), hi.z);
  float zd = texelFetch(uDepth, ivec2(gl_FragCoord.xy * 2.0), 0).r * 2.0 - 1.0; /* (drawn at half size) */ float vz = 2.0 * uNear * uFar / (uFar + uNear - zd * (uFar - uNear));
  t1 = min(t1, vz / k); if (t1 <= t0) discard;
  float t = t0 + 0.12 * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); float T = 1.0; vec3 c = vec3(0.0);
  for (int i = 0; i < 140; i++) {
    if (t > t1 || T < 0.015) break; vec3 p = uEye + d * t; float den = texture(uSmoke, p / uSize).r; float st = 0.17;
    if (den > 0.002) {
      st = 0.075; float n = texture(uNoise, p * 0.45 + vec3(uTime * 0.03, 0.0, uTime * 0.05)).r * 0.6 + texture(uNoise, p * 1.4 - vec3(0.0, uTime * 0.04, 0.0)).r * 0.4;
      float dd = clamp(den * (0.3 + n * 1.35) - 0.16, 0.0, 1.0); float al = 1.0 - exp(-dd * 9.0 * st);
      float lit = 0.56 + 0.4 * clamp((p.z - uMin.z) / 2.2, 0.0, 1.0) + 0.22 * (n - 0.5);
      c += T * al * vec3(0.75, 0.76, 0.79) * lit; T *= 1.0 - al;
    }
    t += st;
  }
  o = vec4(c, 1.0 - T);
}`;
  const UP_FS = `${HEAD}uniform sampler2D uHalf; in vec2 vP; out vec4 o; void main() { o = texture(uHalf, vP * 0.5 + 0.5); }`;
  const POST_FS = `${HEAD}
uniform sampler2D uImg, uSnap; uniform float uFlash, uSnapK, uHurt, uDead, uScope; uniform vec2 uRes; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5; vec3 c = texture(uImg, uv).rgb;
  if (uSnapK > 0.0) c = mix(c, texture(uSnap, uv).rgb, uSnapK); // (blinded: the picture of that moment burnt in)
  c = mix(c, vec3(1.0), uFlash);
  if (uHurt > 0.0) { float e = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0; if (e > 0.7) { float m = uHurt * (e - 0.7) / 0.3; c = vec3(c.r + (0.82 - c.r) * m * 0.7, c.g * (1.0 - m * 0.6), c.b * (1.0 - m * 0.6)); } }
  if (uDead > 0.0) { float m = (c.r + c.g + c.b) / 3.0; c = vec3(m * 0.8, m * 0.75, m * 0.7); }
  if (uScope > 0.0) { vec2 d = (uv - 0.5) * uRes; float rr = length(d) / uRes.y; float px = uRes.y / 540.0;
    if (rr > 0.47) c = vec3(0.024, 0.024, 0.03); else if (rr > 0.455) c = vec3(0.69, 0.53, 0.22); else if (abs(d.x) < px || abs(d.y) < px) c = vec3(0.06); }
  o = vec4(c, 1.0);
}`;

  /* ---- the renderer ---- */
  /** A renderer on canvas, or null where WebGL2 is not to be had. o.keep: the picture kept after it is shown (for screenshots in the tests). */
  function create(canvas, o = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.keep });
    if (!gl) return null;
    let S = null; // (everything made on the card: made again if the context is lost and given back)
    let lost = false;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { lost = false; S = null; init(); });

    function init() {
      const P = {
        world: U.program(gl, WORLD_VS, WORLD_FS), model: U.program(gl, MODEL_VS, MODEL_FS()), shadow: U.program(gl, SHADOW_VS, SHADOW_FS),
        sky: U.program(gl, FULL_VS, SKY_FS), bb: U.program(gl, BB_VS, BB_FS), post: U.program(gl, FULL_VS, POST_FS), smoke: U.program(gl, FULL_VS, SMOKE_FS), up: U.program(gl, FULL_VS, UP_FS),
      };
      // the textures: each name the map uses (and the roofs' shingles), then the walls' dressings
      const names = [...new Set([...Object.values(M.LEGEND).flatMap((L) => [L.top, L.side, L.ceil || 'oakPlanks']), ...Object.values(M.DECOR).map((d) => d.split('+')[0]), 'shingles', 'oakPlanks'])];
      const baked = names.map(bake); const lay = Object.fromEntries(names.map((n, i) => [n, i]));
      const dress = [...new Set(Object.values(M.DECOR).map((d) => d.split('+')[1]))]; const dlay = Object.fromEntries(dress.map((n, i) => [n, i]));
      const tex = U.arrayTexture(gl, TS, TS, baked.map((b) => b.rgba), { mag: 'linear', aniso: 16 }); const nrm = U.arrayTexture(gl, TS, TS, baked.map((b) => b.nrm), { mag: 'linear', aniso: 16 });
      const dressTex = U.arrayTexture(gl, T, DH, dress.map(dressing), { clamp: true, aniso: 8 });
      const verts = buildWorld((n) => lay[n] ?? 0, (n) => dlay[n] ?? 0);
      const world = U.vertexArray(gl, verts, [[0, 3], [1, 3], [2, 2], [3, 1], [4, 1]]); world.n = verts.length / 10;
      const cl = clouds(); const cloudTex = U.texture(gl, cl.w, cl.h, gl.R8, gl.RED, gl.UNSIGNED_BYTE, cl.a, gl.LINEAR, gl.REPEAT);
      // the sun's shadow map: depth only, compared in the lookup
      const SM = 2048; const shadowTex = U.texture(gl, SM, SM, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      const shadowFB = U.framebuffer(gl, [[gl.DEPTH_ATTACHMENT, shadowTex]]);
      const bladeTex = U.texture(gl, 64, 64, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR);
      const empty = gl.createVertexArray();
      const NZ = 32; const nz = new Uint8Array(NZ * NZ * NZ); const hz = (i, j, k) => { const v = Math.sin(((i % NZ) + NZ) % NZ * 127.1 + (((j % NZ) + NZ) % NZ) * 311.7 + (((k % NZ) + NZ) % NZ) * 74.7) * 43758.5453; return v - Math.floor(v); };
      for (let k = 0; k < NZ; k += 1) for (let j = 0; j < NZ; j += 1) for (let i = 0; i < NZ; i += 1) { let v = 0; let amp = 0.5; for (let o = 1; o <= 4; o *= 2) { const f = (x) => x * o / 4; const xi = Math.floor(f(i)); const yi = Math.floor(f(j)); const zi = Math.floor(f(k)); const fx = f(i) - xi; const fy = f(j) - yi; const fz = f(k) - zi;
        const w = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t); const s2 = (dz) => w(w(hz(xi, yi, zi + dz), hz(xi + 1, yi, zi + dz), fx), w(hz(xi, yi + 1, zi + dz), hz(xi + 1, yi + 1, zi + dz), fx), fy); v += w(s2(0), s2(1), fz) * amp; amp /= 2; } nz[(k * NZ + j) * NZ + i] = Math.min(255, v * 290); }
      const noiseTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, noiseTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, NZ, NZ, NZ, 0, gl.RED, gl.UNSIGNED_BYTE, nz); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R].forEach((w) => gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT)); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const bbBuf = U.vertexArray(gl, new Float32Array(60), [[0, 3], [1, 2], [2, 4], [3, 1]], gl.DYNAMIC_DRAW);
      // the fixed units: 0 textures, 1 relief, 2 dressings, 3 light grid, 4 shadow, 5 blade, 6 clouds, 7 picture, 8 burnt-in picture
      P.world.use(); gl.uniform1i(P.world.u.uTex, 0); gl.uniform1i(P.world.u.uNrm, 1); gl.uniform1i(P.world.u.uDress, 2); gl.uniform1i(P.world.u.uLight, 3); gl.uniform1i(P.world.u.uShadow, 4);
      P.model.use(); gl.uniform1i(P.model.u.uLight, 3); gl.uniform1i(P.model.u.uShadow, 4); gl.uniform1i(P.model.u.uBlade, 5);
      P.sky.use(); gl.uniform1i(P.sky.u.uClouds, 6); P.post.use(); gl.uniform1i(P.post.u.uImg, 7); gl.uniform1i(P.post.u.uSnap, 8);
      P.up.use(); gl.uniform1i(P.up.u.uHalf, 12); P.smoke.use(); gl.uniform1i(P.smoke.u.uSmoke, 9); gl.uniform1i(P.smoke.u.uNoise, 10); gl.uniform1i(P.smoke.u.uDepth, 11);
      S = { P, tex, nrm, dressTex, world, cloudTex, SM, shadowTex, shadowFB, bladeTex, bladeOf: null, empty, bbBuf, noiseTex, smokeTex: null, smokePrev: null, parts: new WeakMap(), lightTex: null, lw: 0, lh: 0, W: 0, H: 0,
        samples: Math.min(4, gl.getParameter(gl.MAX_SAMPLES)) };
    }
    /** The targets at the picture's size: four samples a pixel, the picture resolved, the copy kept when blinded. */
    function resize(W, H) {
      ['msFB', 'resFB', 'snapFB', 'depFB'].forEach((k) => S[k] && gl.deleteFramebuffer(S[k])); ['msColor', 'msDepth'].forEach((k) => S[k] && gl.deleteRenderbuffer(S[k])); ['resTex', 'snapTex', 'depTex', 'halfTex'].forEach((k) => S[k] && gl.deleteTexture(S[k])); if (S.halfFB) gl.deleteFramebuffer(S.halfFB);
      S.hw = Math.ceil(W / 2); S.hh = Math.ceil(H / 2); S.halfTex = U.texture(gl, S.hw, S.hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR); S.halfFB = U.framebuffer(gl, [[gl.COLOR_ATTACHMENT0, S.halfTex]]);
      S.depTex = U.texture(gl, W, H, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null, gl.NEAREST); S.depFB = U.framebuffer(gl, [[gl.DEPTH_ATTACHMENT, S.depTex]]);
      S.msColor = U.renderbuffer(gl, S.samples, gl.RGBA8, W, H); S.msDepth = U.renderbuffer(gl, S.samples, gl.DEPTH_COMPONENT24, W, H);
      S.msFB = U.framebuffer(gl, [[gl.COLOR_ATTACHMENT0, S.msColor], [gl.DEPTH_ATTACHMENT, S.msDepth]]);
      S.resTex = U.texture(gl, W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR); S.resFB = U.framebuffer(gl, [[gl.COLOR_ATTACHMENT0, S.resTex]]);
      S.snapTex = U.texture(gl, W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR); S.snapFB = U.framebuffer(gl, [[gl.COLOR_ATTACHMENT0, S.snapTex]]);
      S.W = W; S.H = H;
    }
    /** A part's triangles on the card, once: per vertex its position, normal, material. */
    function partVAO(part) {
      let v = S.parts.get(part); if (v) return v;
      const n = part.n * 3; const d = new Float32Array(n * 7);
      for (let i = 0; i < n; i += 1) { const o = i * 7; d[o] = part.P[i * 3]; d[o + 1] = part.P[i * 3 + 1]; d[o + 2] = part.P[i * 3 + 2]; d[o + 3] = part.N[i * 3]; d[o + 4] = part.N[i * 3 + 1]; d[o + 5] = part.N[i * 3 + 2]; d[o + 6] = part.M[Math.floor(i / 3)]; }
      v = U.vertexArray(gl, d, [[0, 3], [1, 3], [2, 1]]); v.n = n; S.parts.set(part, v); return v;
    }
    /** The knife's finish into its picture, and its curve and width into the table (when the knife changes). */
    function knifeOn(kn) {
      if (!kn || S.bladeOf === kn) return; S.bladeOf = kn; const md = MODELS.knifeModel(kn); const px = new Uint8Array(64 * 64 * 4);
      for (let y = 0; y < 64; y += 1) for (let x = 0; x < 64; x += 1) { const c = kn.colour(x / 63, y / 63); const o = (y * 64 + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; }
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, S.bladeTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
      S.bladeCH = new Float32Array(66); for (let k = 0; k <= 32; k += 1) { S.bladeCH[k * 2] = md.info.curve(k / 32); S.bladeCH[k * 2 + 1] = md.info.half(k / 32); } S.bladeL = md.info.L;
    }

    /* the billboards of a frame: quads gathered, sorted far to near, then written out */
    const quads = [];
    function quad(c, ax, ay, col, kind, d) { quads.push({ c, ax, ay, col, kind, d }); } // (centre, half-axes, colour [r, g, b, a], kind, distance)
    function ribbon(p0, p1, w0, w1, eye, col, kind) { // (a strip from p0 to p1 turned to the eye)
      const dx = p1[0] - p0[0]; const dy = p1[1] - p0[1]; const dz = p1[2] - p0[2]; const vx = p0[0] - eye[0]; const vy = p0[1] - eye[1]; const vz = p0[2] - eye[2];
      let sx = dy * vz - dz * vy; let sy = dz * vx - dx * vz; let sz = dx * vy - dy * vx; const l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
      quads.push({ strip: [p0, p1, w0, w1, [sx, sy, sz]], col, kind, d: Math.hypot(vx, vy, vz) });
    }
    function flushQuads(vp) {
      if (!quads.length) return; quads.sort((a, b) => b.d - a.d);
      const need = quads.length * 60; gl.bindBuffer(gl.ARRAY_BUFFER, S.bbBuf.buf);
      if (!S.bbData || S.bbData.length < need) { S.bbData = new Float32Array(need * 2); gl.bufferData(gl.ARRAY_BUFFER, S.bbData.byteLength, gl.DYNAMIC_DRAW); }
      const D = S.bbData; let o = 0;
      const vtx = (p, u, v, q) => { D[o] = p[0]; D[o + 1] = p[1]; D[o + 2] = p[2]; D[o + 3] = u; D[o + 4] = v; D[o + 5] = q.col[0]; D[o + 6] = q.col[1]; D[o + 7] = q.col[2]; D[o + 8] = q.col[3]; D[o + 9] = q.kind; o += 10; };
      quads.forEach((q) => {
        let a; let b; let c; let d;
        if (q.strip) { const [p0, p1, w0, w1, s] = q.strip; a = [p0[0] - s[0] * w0, p0[1] - s[1] * w0, p0[2] - s[2] * w0]; b = [p1[0] - s[0] * w1, p1[1] - s[1] * w1, p1[2] - s[2] * w1]; c = [p1[0] + s[0] * w1, p1[1] + s[1] * w1, p1[2] + s[2] * w1]; d = [p0[0] + s[0] * w0, p0[1] + s[1] * w0, p0[2] + s[2] * w0]; }
        else { const C = q.c; const X = q.ax; const Y = q.ay; a = [C[0] - X[0] - Y[0], C[1] - X[1] - Y[1], C[2] - X[2] - Y[2]]; b = [C[0] + X[0] - Y[0], C[1] + X[1] - Y[1], C[2] + X[2] - Y[2]]; c = [C[0] + X[0] + Y[0], C[1] + X[1] + Y[1], C[2] + X[2] + Y[2]]; d = [C[0] - X[0] + Y[0], C[1] - X[1] + Y[1], C[2] - X[2] + Y[2]]; }
        vtx(a, -1, -1, q); vtx(b, 1, -1, q); vtx(c, 1, 1, q); vtx(a, -1, -1, q); vtx(c, 1, 1, q); vtx(d, -1, 1, q);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, S.bbBuf.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, D, 0, o);
      const P = S.P.bb; P.use(); gl.uniformMatrix4fv(P.u.uVP, false, vp); gl.bindVertexArray(S.bbBuf.vao); gl.drawArrays(gl.TRIANGLES, 0, o / 10); quads.length = 0;
    }

    const mm = new Float32Array(16); const IDENT = m4.ident(); const NEAR_W = 0.03; const FAR_W = 160; // (the world's near and far)
    function drawRecs(P, recs, shadow) { // (the parts recorded by models.js, each by its own matrix)
      recs.forEach((r) => { const v = partVAO(r.part); gl.uniformMatrix4fv(P.u.uModel, false, m4.from34(r.m, mm)); if (!shadow) gl.uniform1f(P.u.uFlash, r.flash || 0); gl.bindVertexArray(v.vao); gl.drawArrays(gl.TRIANGLES, 0, v.n); });
    }
    let sunVP = null; let sunKey = '';
    function sunMatrix(sun) { // (an orthographic view along the sunlight round the whole map)
      const key = sun.join(); if (key === sunKey) return sunVP; sunKey = key;
      const F = [-sun[0], -sun[1], -sun[2]]; let R = [F[1], -F[0], 0]; const l = Math.hypot(R[0], R[1]) || 1; R = [R[0] / l, R[1] / l, 0];
      const Uu = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]]; const c = [M.W / 2, M.H / 2, 2]; const eye = [c[0] + sun[0] * 80, c[1] + sun[1] * 80, c[2] + sun[2] * 80];
      const V = m4.view(R, Uu, F, eye); let x0 = 1e9; let x1 = -1e9; let y0 = 1e9; let y1 = -1e9; let z0 = 1e9; let z1 = -1e9;
      [0, M.W].forEach((x) => [0, M.H].forEach((y) => [-1, 8].forEach((z) => { const px = V[0] * x + V[4] * y + V[8] * z + V[12]; const py = V[1] * x + V[5] * y + V[9] * z + V[13]; const pz = V[2] * x + V[6] * y + V[10] * z + V[14];
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); })));
      sunVP = m4.mul(m4.ortho(x0, x1, y0, y1, -z1 - 1, -z0 + 1), V); return sunVP;
    }
    const setLight = (P, s) => { gl.uniform1f(P.u.uShadowTexel, 1 / S.SM); gl.uniformMatrix4fv(P.u.uSunVP, false, sunVP); gl.uniform3fv(P.u.uSun, s.sun); gl.uniform3fv(P.u.uSunC, s.sunC); gl.uniform3fv(P.u.uHaze, s.haze); gl.uniform3fv(P.u.uEye, s.cam.eye); gl.uniform1f(P.u.uFogD, s.fogD); gl.uniform2f(P.u.uLightK, 1 / M.W, 1 / M.H); };

    /**
     * Draw a frame. s: { cam: { eye, R, U, F (unit vectors: right, up, forward), fov (horizontal) }, now, sun, sunC, sky, haze, fogD,
     * light: { data (rgb, the sky and the torches), w, h }, world: models.js's records, knife,
     * view: models.js's viewRec plus amb, or null; fx: { torches, fires, smokes, fx, decals }, post: { flash, snapK, snap, hurt, dead, scope } }
     */
    function frame(s) {
      if (lost || !S) return; const W = canvas.width; const H = canvas.height; if (!W || !H) return; if (S.W !== W || S.H !== H) resize(W, H);
      const cam = s.cam; const aspect = W / H; const fovY = 2 * Math.atan(Math.tan(cam.fov / 2) / aspect);
      const VP = m4.mul(m4.persp(fovY, aspect, NEAR_W, FAR_W), m4.view(cam.R, cam.U, cam.F, cam.eye)); sunMatrix(s.sun); knifeOn(s.knife);
      // the light grid
      if (!S.lightTex || S.lw !== s.light.w || S.lh !== s.light.h) { S.lightTex = U.texture(gl, s.light.w, s.light.h, gl.RGB16F, gl.RGB, gl.FLOAT, s.light.data, gl.LINEAR); S.lw = s.light.w; S.lh = s.light.h; }
      else { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, S.lightTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, s.light.w, s.light.h, gl.RGB, gl.FLOAT, s.light.data); }
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(true);
      // the sun's shadows: the map and everything standing in it
      gl.bindFramebuffer(gl.FRAMEBUFFER, S.shadowFB); gl.viewport(0, 0, S.SM, S.SM); gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 3);
      let P = S.P.shadow; P.use(); gl.uniformMatrix4fv(P.u.uSunVP, false, sunVP); gl.uniformMatrix4fv(P.u.uModel, false, IDENT); gl.bindVertexArray(S.world.vao); gl.drawArrays(gl.TRIANGLES, 0, S.world.n);
      drawRecs(P, s.world, true); gl.disable(gl.POLYGON_OFFSET_FILL);
      // the textures in their units
      const bind = (unit, target, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, t); };
      bind(0, gl.TEXTURE_2D_ARRAY, S.tex); bind(1, gl.TEXTURE_2D_ARRAY, S.nrm); bind(2, gl.TEXTURE_2D_ARRAY, S.dressTex); bind(3, gl.TEXTURE_2D, S.lightTex); bind(4, gl.TEXTURE_2D, S.shadowTex); bind(5, gl.TEXTURE_2D, S.bladeTex); bind(6, gl.TEXTURE_2D, S.cloudTex);
      // the picture: the sky, the map, the things in it
      gl.bindFramebuffer(gl.FRAMEBUFFER, S.msFB); gl.viewport(0, 0, W, H); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); P = S.P.sky; P.use();
      const tx = Math.tan(cam.fov / 2); const ty = Math.tan(fovY / 2);
      gl.uniform3fv(P.u.uF, cam.F); gl.uniform3f(P.u.uR, cam.R[0] * tx, cam.R[1] * tx, cam.R[2] * tx); gl.uniform3f(P.u.uU, cam.U[0] * ty, cam.U[1] * ty, cam.U[2] * ty); gl.uniform3fv(P.u.uSun, s.sun); gl.uniform3fv(P.u.uSky, s.sky); gl.uniform3fv(P.u.uHaze, s.haze);
      gl.bindVertexArray(S.empty); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      P = S.P.world; P.use(); gl.uniformMatrix4fv(P.u.uVP, false, VP); setLight(P, s); gl.bindVertexArray(S.world.vao); gl.drawArrays(gl.TRIANGLES, 0, S.world.n);
      P = S.P.model; P.use(); gl.uniformMatrix4fv(P.u.uVP, false, VP); setLight(P, s); gl.uniform1i(P.u.uMode, 0); gl.uniform1f(P.u.uTime, s.now);
      gl.uniform3fv(P.u.uKey, s.sun); gl.uniform3f(P.u.uUp, 0, 0, 1); gl.uniform3f(P.u.uRim, cam.R[0] * 0.55 + cam.U[0] * 0.25 + cam.F[0] * 0.8, cam.R[1] * 0.55 + cam.U[1] * 0.25 + cam.F[1] * 0.8, cam.R[2] * 0.55 + cam.U[2] * 0.25 + cam.F[2] * 0.8);
      gl.uniform3f(P.u.uSleeve, 52, 82, 170); if (S.bladeCH) { gl.uniform2fv(P.u.uBladeCH, S.bladeCH); gl.uniform1f(P.u.uBladeL, S.bladeL); }
      drawRecs(P, s.world, false);
      // the marks, then smoke, fire and sparks (no depth written; marks pulled towards the eye)
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      worldQuads(s, cam); P = S.P.bb; P.use(); gl.uniform1f(P.u.uTime, s.now);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -8); const marks = quads.filter((q) => q.kind === 4 || q.kind === 5); const rest = quads.filter((q) => q.kind !== 4 && q.kind !== 5);
      quads.length = 0; quads.push(...marks); flushQuads(VP); gl.disable(gl.POLYGON_OFFSET_FILL); quads.push(...rest); flushQuads(VP);
      smoke(s, cam, fovY);
      // in the hand: a pass of its own (its own nearness, its own field of view), over the world
      if (s.view) {
        gl.disable(gl.BLEND); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
        const VPv = m4.mul(m4.persp(1.0, aspect, 0.05, 10), new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1])); // (view space with z forward; half a radian up and down, as models.js drew it)
        P = S.P.model; P.use(); gl.uniformMatrix4fv(P.u.uVP, false, VPv); gl.uniform1i(P.u.uMode, 1); gl.uniform3f(P.u.uEye, 0, 0, 0);
        const k = [-0.35, 0.75, -0.55]; const kl = Math.hypot(...k); gl.uniform3f(P.u.uKey, k[0] / kl, k[1] / kl, k[2] / kl); gl.uniform3f(P.u.uUp, 0, 1, 0); gl.uniform3f(P.u.uRim, 0.55, 0.25, 0.8);
        gl.uniform3fv(P.u.uAmbV, s.view.amb.map((v) => Math.min(1.5, v))); gl.uniform3fv(P.u.uSleeve, s.view.sleeve);
        drawRecs(P, s.view.parts, false);
        gl.enable(gl.BLEND); gl.depthMask(false); viewQuads(s.view); P = S.P.bb; P.use(); gl.uniform1f(P.u.uTime, s.now); flushQuads(VPv);
      }
      gl.disable(gl.BLEND); gl.depthMask(true);
      // four samples to one; kept when blinded; then the last pass to the screen
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.msFB); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.resFB); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      if (s.post.snap) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.resFB); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.snapFB); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
      bind(7, gl.TEXTURE_2D, S.resTex); bind(8, gl.TEXTURE_2D, S.snapTex);
      P = S.P.post; P.use(); const q = s.post; gl.uniform1f(P.u.uFlash, q.flash || 0); gl.uniform1f(P.u.uSnapK, q.snapK || 0); gl.uniform1f(P.u.uHurt, q.hurt || 0); gl.uniform1f(P.u.uDead, q.dead ? 1 : 0); gl.uniform1f(P.u.uScope, q.scope ? 1 : 0); gl.uniform2f(P.u.uRes, W, H);
      gl.bindVertexArray(S.empty); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    }
    /** The smokes' volume: its changed voxels sent up, then a ray through it for every pixel where it may show. */
    function smoke(s, cam, fovY) {
      const sm = s.smoke; const [w, h, d] = sm.dims;
      if (!S.smokeTex) { S.smokeTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_3D, S.smokeTex); gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, w, h, d, 0, gl.RED, gl.UNSIGNED_BYTE, null);
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R].forEach((q) => gl.texParameteri(gl.TEXTURE_3D, q, gl.CLAMP_TO_EDGE)); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
      const B = sm.box; const A = S.smokePrev; S.smokePrev = B ? B.slice() : null; const U2 = B && A ? [0, 1, 2].map((i) => Math.min(A[i], B[i])).concat([3, 4, 5].map((i) => Math.max(A[i], B[i]))) : B || A;
      if (U2) { gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_3D, S.smokeTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w); gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, h);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, U2[0]); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, U2[1]); gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, U2[2]);
        gl.texSubImage3D(gl.TEXTURE_3D, 0, U2[0], U2[1], U2[2], U2[3] - U2[0] + 1, U2[4] - U2[1] + 1, U2[5] - U2[2] + 1, gl.RED, gl.UNSIGNED_BYTE, sm.grid);
        [gl.UNPACK_ROW_LENGTH, gl.UNPACK_IMAGE_HEIGHT, gl.UNPACK_SKIP_PIXELS, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_IMAGES].forEach((q) => gl.pixelStorei(q, 0)); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); }
      if (!B) return;
      const W = S.W; const H = S.H; gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.msFB); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.depFB); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, S.halfFB); gl.viewport(0, 0, S.hw, S.hh); gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_3D, S.noiseTex); gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, S.depTex);
      const k = w / sm.size[0]; const P = S.P.smoke; P.use(); gl.disable(gl.DEPTH_TEST);
      gl.uniform3f(P.u.uMin, B[0] / k, B[1] / k, B[2] / k); gl.uniform3f(P.u.uMax, (B[3] + 1) / k, (B[4] + 1) / k, (B[5] + 1) / k); gl.uniform3fv(P.u.uSize, sm.size); gl.uniform3fv(P.u.uEye, cam.eye);
      const tx = Math.tan(cam.fov / 2); const ty = Math.tan(fovY / 2); gl.uniform3fv(P.u.uF, cam.F); gl.uniform3f(P.u.uR, cam.R[0] * tx, cam.R[1] * tx, cam.R[2] * tx); gl.uniform3f(P.u.uU, cam.U[0] * ty, cam.U[1] * ty, cam.U[2] * ty);
      gl.uniform1f(P.u.uNear, NEAR_W); gl.uniform1f(P.u.uFar, FAR_W); gl.uniform1f(P.u.uTime, s.now); gl.bindVertexArray(S.empty); gl.drawArrays(gl.TRIANGLES, 0, 3);
      // laid over the picture, enlarged
      gl.bindFramebuffer(gl.FRAMEBUFFER, S.msFB); gl.viewport(0, 0, W, H); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, S.halfTex);
      S.P.up.use(); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.DEPTH_TEST);
    }
    const hAt = (x, y) => (x < 0 || y < 0 || x >= M.W || y >= M.H ? 9 : M.h[Math.floor(y) * M.W + Math.floor(x)]);
    /** The world's billboards: torches' flames, fires, blasts, sparks and drops, the trails of shots, the marks. */
    function worldQuads(s, cam) {
      const e = s.cam.eye; const R = cam.R; const Uu = cam.U; const now = s.now; const F = s.fx;
      const dist = (p) => Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
      const face = (p, w, h, col, kind) => quad(p, [R[0] * w, R[1] * w, R[2] * w], [Uu[0] * h, Uu[1] * h, Uu[2] * h], col, kind, dist(p));
      const up = (p, w, h, col, kind) => { const l = Math.hypot(R[0], R[1]) || 1; quad(p, [R[0] / l * w, R[1] / l * w, 0], [0, 0, h], col, kind, dist(p)); }; // (standing upright: a flame)
      F.torches.forEach((t) => up([t.x, t.y, t.z + 0.07], 0.065, 0.11, [1, 1, 1, t.ph], 1));
      F.fires.forEach((f) => f.flames.forEach((q) => { const h = 0.17 + Math.sin(now * 9 + q[2]) * 0.05; up([q[0], q[1], f.z + h * 0.8], 0.17, h, [1, 1, 1, q[2]], 1); }));
      F.fx.forEach((f) => { const age = now - f.t;
        if (f.kind === 'blast') { const k = Math.max(0, 1 - age / 0.9); const r = (f.big ? 2.2 : 1.1) * (0.4 + age); if (k > 0) up([f.x, f.y, f.z + r * 0.5], r, r * 0.9, [1, 1, 1, f.t], 1); }
        if (f.parts) f.parts.forEach((q) => { const pz = q.z + q.vz * age - 4.9 * age * age; const qx = q.x + q.vx * age; const qy = q.y + q.vy * age; if (pz < hAt(qx, qy)) return;
          const col = f.kind === 'blood' ? [0.55, 0.04, 0.05, 1] : f.kind === 'splinter' ? [0.62, 0.45, 0.26, 1] : f.kind === 'debris' ? [0.34, 0.32, 0.3, 1] : age < 0.08 ? [1, 0.98, 0.78, 0] : [0.8, 0.7, 0.5, 0];
          const r = f.kind === 'debris' ? 0.035 : f.kind === 'spark' ? 0.018 : 0.022; face([qx, qy, pz], r, r, col, 2); });
        if (f.kind === 'trail' && age < 0.07) { const a = 1 - age / 0.07; const p0 = [f.x0, f.y0, f.z0]; const p1 = [f.x1, f.y1, f.z1]; ribbon(p0, p1, 0.0016 * dist(p0) + 0.002, 0.0016 * dist(p1) + 0.002, e, [1, 0.92, 0.62, a * 0.8], 3); }
      });
      F.decals.forEach((d) => { const n = d.n || [0, 0, 1]; const t1 = Math.abs(n[2]) > 0.5 ? [1, 0, 0] : [-n[1], n[0], 0]; const t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
        const r = d.kind === 'blood' ? 0.1 : 0.028; const p = [d.x + n[0] * 0.003, d.y + n[1] * 0.003, d.z + n[2] * 0.003];
        quad(p, t1.map((v) => v * r), t2.map((v) => v * r), [0, 0, 0, (d.x * 7.3 + d.y * 3.1) % 1], d.kind === 'blood' ? 5 : 4, dist(p)); });
    }
    /** In the hand: the muzzle's flash, the powder smoke, the knife's trail (view space: x right, y up, z forward). */
    function viewQuads(v) {
      const R = [1, 0, 0]; const Uu = [0, 1, 0]; const d = (p) => Math.hypot(...p);
      v.puffs.forEach(([x, y, z, r, a]) => quad([x, y, z], R.map((c) => c * r), Uu.map((c) => c * r), [0.77, 0.77, 0.77, Math.min(0.85, a * 1.5)], 0, d([x, y, z])));
      if (v.flash) { const p = v.flash; quad(p, [0.075, 0, 0], [0, 0.06, 0], [1, 1, 1, Math.random()], 6, 0); }
      for (let i = 1; i < v.trail.length; i += 1) { const a = v.trail[i - 1]; const b = v.trail[i]; ribbon(a, b, 0.003, 0.003, [0, 0, 0], [1, 0.98, 0.94, b[3]], 3); }
    }
    /** For the tests: a frame read back (the picture resolved): the spread of its brightness, and the card's name. */
    function probe() { // (call it right after a frame: the screen's own picture is only there until it is shown)
      if (!S || !S.W) return null; const W = S.W; const H = S.H; const px = new Uint8Array(W * H * 4);
      const stats = (fb) => { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        let mn = 255; let mx = 0; let sum = 0; let n = 0; for (let i = 0; i < px.length; i += 4 * 97) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; mn = Math.min(mn, l); mx = Math.max(mx, l); sum += l; n += 1; } return { min: mn, max: mx, mean: Math.round(sum / n) }; };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info'); const pic = stats(S.resFB); const screen = stats(null);
      return { ...pic, screen, W, H, samples: S.samples, card: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), error: gl.getError() };
    }
    try { init(); } catch (err) { console.error(err); window.SIEGE_RENDER.error = String(err.message || err); return null; } // (the reason, for the message and the tests)
    return { frame, probe, gl };
  }

  window.SIEGE_RENDER = { create };
}());
