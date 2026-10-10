/* Siege: a first-person game under the castle, five against five with bots, rounds and an economy, a
   keg of powder to plant or to defuse (after the tactical shooters, in the castle's century). The world
   is a grid of blocks drawn by ray casting (Lodev's DDA, a ray a column; the floor cast row by row),
   textured from textures.js in the castle's palette; actors, smoke, fire and thrown things are sprites
   against a depth buffer. 320 x 180 pixels, scaled up whole. Loaded on demand (ui: the `siege` command,
   the descent's stair); its arms in weapons.js, its bots in bots.js. */
(function () {
  const ARMS = window.SIEGE_ARMS; const MODELS = window.SIEGE_MODELS; const BOTS = window.SIEGE_BOTS; const PAL = window.HOURS_PALETTE; const TEX = window.TEXTURES;
  let W = 960; let H = 540; // (the picture, scaled up whole to the screen: settings.quality picks it)
  const QUALITY = [[640, 360], [960, 540], [1280, 720]];
  const WALL_H = 2.2; // a wall's height, in the units of the grid (a man is 0.86, his eyes at 0.62)
  /* The town: the defenders' gate north (d), the attackers' camp south (t); A, the chapel's yard (a), east,
     open to the sky; B, the granary (b), west, under its roof; between them the market street (mid, its
     doors), short A, long A under an arch (^), the vaulted tunnels to B (_), the attackers' yard (:). */
  const MAP = [ // walls: # ashlar, W planks, R brick, M mossy, H half-timber, L limewash, N a window, F and E the sides' banners, D a door, 1 and 2 the sites' signs, C crates
    '############################################',
    '################F####F####F#################',
    '##WWWWWWWWWWHHR#dddddddddddd#RHLNLLLLNLLLL##',
    '#Wbbbbbbbbbb,,,,ddddddwddddd,,,aaaaaaaaaaaL#',
    '#Wbbbbbbbbbb,,,,dddddddddddd,,,aaaaawaaaaaL#',
    '#Wbbbbbbbbbb2HRFdddddddddddd#RNaaaaaaaaaaaL#',
    '#WbbbCCbbbbbW###F###....##F###LaaaCCaaaaaaL#',
    '#WbbbCbbbbbbW######H....H#####LaaaCaaaaaaaN#',
    '#WbbbbbbbbbbW######H....H#####LaaaaaaaaaaaL#',
    '#WbbbbbbbhbbW#######D..D######LaaaaaaaCaaaL#',
    '#WbobbbbbhbbW######H....H#####NaoaaaaaaaaaL#',
    '#WbbbbbbbbbbW######N....N#####LaaoaaaaaaaaL#',
    '##WWWW___2WW#######H....HNHHH1..aaaaaaaaaaN#',
    '#####R___R#########H............LNLLL1,,,,R#',
    '#####R___RRRRR#####H............N####H,,,,H#',
    '####R_________RRRRRR....HHHHNHHH#####Ho,,,R#',
    '####R_______________.o..N############H,,,,H#',
    '####R_________RRRRRR....H############H,,,,H#',
    '####R____RRRRR#####H....H############R^^^^R#',
    '####R____R#########H....H############H^^^^H#',
    '####R____R##########C...H############R,,,,R#',
    '####R____R#########N....N############H,,,,H#',
    '####R____R#########H...hH############H,,,C##',
    '####R____R#########H....H############R,,,,R#',
    '####R____R##M#M##M#H....H##M#M##M#M##H,,,,H#',
    '#####:::::::::::::::::::::::::::::::::::::##',
    '####M:::::::C::::::::::::o::::CC::::::::::##',
    '#####:::::::::::::::::::::::::::::::::::::M#',
    '######M#M##M#M#tttttttttttttt##M#M##M#M##M##',
    '##############EttttttttttttotE##############',
    '###############tthttttttttttt###############',
    '###############tttttttttttttt###############',
    '#################E####E####E################',
    '############################################',
  ];
  const MW = MAP[0].length; const MH = MAP.length;
  const WALLS = { '#': 'ashlar', W: 'planksUpright', R: 'brickRunning', M: 'mossyStone', C: 'staves', H: 'halfTimber', L: 'limewash', N: 'limewash+window', F: 'ashlar+banner:fleurDeLis:def', E: 'ashlar+banner:chevrony:att', D: 'halfTimber+door', 1: 'limewash+sign:A', 2: 'planksUpright+sign:B' };
  const FLOORS = { '.': 'flagstones', ',': 'cobbles', ':': 'beatenEarth', a: 'terracotta', b: 'herringbone', d: 'cobbles', t: 'beatenEarth', _: 'beatenEarth', '^': 'flagstones' };
  const ROOFS = { b: 'oakPlanks', _: 'brickRunning', '^': 'ashlar' }; // (covered floors: their ceilings)
  const PROPS = { o: 'barrel', h: 'hay', w: 'well' }; // (they stop a man, not a shot)
  const RADAR_FLOOR = { '.': '#6c6862', ',': '#5f5b55', ':': '#6e5e46', _: '#4a4036', '^': '#5c5852', o: '#6c6862', h: '#6c6862', w: '#6c6862' };
  const T = 64; // texture size: each texture of textures.js at twice its own scale, given relief (texOf)
  const pack = (c) => (255 << 24) | (Math.max(0, Math.min(255, c[2] | 0)) << 16) | (Math.max(0, Math.min(255, c[1] | 0)) << 8) | Math.max(0, Math.min(255, c[0] | 0));
  const unpack = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /* A texture baked for the game: textures.js at twice its scale (its pattern keeps its size on a wall),
     each texel shaded a little at random (grain), and lit or shadowed where its colour changes from the
     texel above or to the left (a bevel: the joints sink, the stones stand out). */
  const tex = {}; const texOf = (name) => (tex[name] ||= name.includes('+') ? decor(name) : (() => {
    const f = TEX[name].fn; const base = new Array(T * T);
    for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) base[y * T + x] = PAL.colourOf(f(x >> 1, y >> 1));
    const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; const t = new Uint32Array(T * T);
    for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) {
      const c = base[y * T + x]; const up = base[((y + T - 1) % T) * T + x]; const lf = base[y * T + ((x + T - 1) % T)]; const dn = base[((y + 1) % T) * T + x];
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; const grain = 0.94 + (n - Math.floor(n)) * 0.12;
      const bevel = lum(c) - lum(up) > 18 || lum(c) - lum(lf) > 18 ? 1.14 : lum(dn) - lum(c) > 18 ? 0.8 : 1;
      t[y * T + x] = pack(c.map((v) => v * grain * bevel));
    }
    return t;
  })());
  /* A wall made for one place (a banner, a window, a door, a site's letter): 64 wide by 256 tall (a whole
     wall, 2.2 units, uses rows 0 to 140, its foot at 140), the base texture repeated and the thing painted on. */
  const GLYPH = { A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'] };
  function decor(name) {
    const [base, what] = name.split('+'); const [kind, a1, a2] = what.split(':'); const b = texOf(base); const t = new Uint32Array(T * 256);
    for (let y = 0; y < 256; y += 1) for (let x = 0; x < T; x += 1) t[y * T + x] = b[(y & (T - 1)) * T + x];
    const put = (x, y, c) => { if (x >= 0 && x < T && y >= 0 && y < 256) t[y * T + x] = pack(c); }; const get = (x, y) => unpack(t[y * T + x]);
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
      for (let j = 0; j < 7; j += 1) for (let i = 0; i < 5; i += 1) { if (gl[j][i] !== '1') continue; for (let y = 0; y < 6; y += 1) for (let x = 0; x < 6; x += 1) { const X = 17 + i * 6 + x; const Y = 44 + j * 6 + y; const c = get(X, Y); put(X, Y, [c[0] * 0.25 + 170, c[1] * 0.2 + 20, c[2] * 0.2 + 16]); } }
      for (let k = 0; k < 9; k += 1) { const x = 18 + ((k * 37) % 28); for (let y = 86; y < 86 + ((k * 13) % 9); y += 1) put(x, y, [150, 24, 20]); } // (the paint ran)
    }
    return t;
  }

  /* ---- the actors' sprites, 24 x 48, painted from parts: a steel helmet, a face (or the back of a head),
     a tabard of the side's colour with its charge (the defenders a white cross, the attackers a gold
     chevron), mail sleeves, hose, boots; four walking frames, a pose aiming at you (the muzzle a dark round,
     its flash), and the fall in three frames (the standing figure turned about its feet). Outlined dark so it
     reads against the stone. */
  const sprites = {};
  function soldier(team, view, pose, frame) {
    const key = `${team}${view}${pose}${frame}`; if (sprites[key]) return sprites[key];
    const SW = 24; const SH = 48; const px = new Int32Array(SW * SH); const P = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < SW && y < SH) px[y * SW + x] = pack(c); };
    const R = (x, y, w, h, c) => { for (let j2 = 0; j2 < h; j2 += 1) for (let i2 = 0; i2 < w; i2 += 1) P(x + i2, y + j2, c); };
    const cloth = team === 'def' ? [[70, 110, 230], [44, 72, 170], [28, 46, 120]] : [[224, 64, 50], [160, 36, 32], [104, 22, 22]];
    const steel = [[214, 220, 230], [150, 158, 172], [90, 96, 112]]; const skin = [[240, 190, 150], [206, 146, 110]]; const hose = [[96, 72, 56], [66, 50, 40]]; const boot = [[46, 36, 30], [26, 20, 18]];
    if (pose === 'dead') { const st = soldier(team, view, 'idle', 0); const ang = [0.5, 1.1, Math.PI / 2][frame]; const D = 96; const out = { w: D, h: D, px: new Int32Array(D * D) };
      for (let y = 0; y < D; y += 1) for (let x = 0; x < D; x += 1) { const dx = x - D / 2; const dy = y - (D - 1); const sx = Math.round(dx * Math.cos(ang) + dy * Math.sin(ang) + st.w / 2); const sy = Math.round(-dx * Math.sin(ang) + dy * Math.cos(ang) + st.h - 1); if (sx >= 0 && sy >= 0 && sx < st.w && sy < st.h) out.px[y * D + x] = st.px[sy * st.w + sx]; }
      return (sprites[key] = out); }
    const step = pose === 'walk' ? [0, 1, 0, -1][frame] : 0;
    // legs and boots
    [[8, step], [13, -step]].forEach(([lx, s2]) => { R(lx + s2, 31, 4, 13, hose[0]); R(lx + 3 + s2, 31, 1, 13, hose[1]); R(lx - 1 + s2 * 1.4, 43 - Math.abs(s2), 5, 5, boot[0]); R(lx - 1 + s2 * 1.4, 47 - Math.abs(s2), 5, 1, boot[1]); });
    // torso: mail under, tabard over, its charge, the belt
    R(6, 14, 12, 18, steel[2]); R(7, 15, 10, 17, cloth[0]); R(15, 15, 2, 17, cloth[1]); R(7, 30, 10, 2, cloth[2]);
    if (view === 'front') { if (team === 'def') { R(11, 16, 2, 12, [240, 240, 240]); R(8, 20, 8, 2, [240, 240, 240]); } else for (let k = 0; k < 5; k += 1) { P(8 + k, 22 - k, [240, 200, 80]); P(15 - k, 22 - k, [240, 200, 80]); P(8 + k, 23 - k, [240, 200, 80]); P(15 - k, 23 - k, [240, 200, 80]); } }
    R(6, 26, 12, 2, [92, 60, 34]); P(12, 26, [230, 190, 90]);
    // arms: down at the sides, or raised to aim at you
    if (pose === 'aim' && view === 'front') { R(3, 15, 4, 7, steel[1]); R(17, 15, 4, 7, steel[1]); R(6, 19, 12, 4, steel[1]); R(9, 18, 6, 6, [110, 76, 44]); R(10, 19, 4, 4, [30, 26, 24]); R(7, 19, 3, 3, skin[0]); R(14, 19, 3, 3, skin[0]); if (frame) { R(8, 16, 8, 8, [255, 220, 120]); R(10, 18, 4, 4, [255, 255, 220]); } }
    else { const sw = pose === 'walk' ? [0, 1, 0, -1][frame] : 0; R(3, 15 + sw, 3, 13, steel[1]); R(18, 15 - sw, 3, 13, steel[1]); R(3, 28 + sw, 3, 3, skin[1]); R(18, 28 - sw, 3, 3, skin[1]); }
    // the head: helmet, face or nape
    R(9, 10, 6, 5, view === 'front' ? skin[0] : [120, 84, 56]); if (view === 'front') { P(10, 11, [30, 24, 30]); P(13, 11, [30, 24, 30]); R(10, 13, 4, 1, skin[1]); }
    for (let y = 2; y < 11; y += 1) for (let x = 6; x < 18; x += 1) { const d = Math.hypot((x - 11.5) / 6, (y - 9) / 7); if (d < 1 && y < 9 + (view === 'front' ? 0 : 2)) P(x, y, d < 0.45 ? steel[0] : x > 14 ? steel[2] : steel[1]); }
    R(5, 9, 14, 1, steel[2]); // the brim
    // outline
    const out = new Int32Array(px); for (let y = 0; y < SH; y += 1) for (let x = 0; x < SW; x += 1) { if (px[y * SW + x]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx; const Y = y + dy; return X >= 0 && Y >= 0 && X < SW && Y < SH && px[Y * SW + X]; })) out[y * SW + x] = pack([16, 12, 18]); }
    // twice as fine: each pixel four, shaded by what it is (mail in rings, cloth in folds), lit from the upper left
    const W2 = SW * 2; const H2 = SH * 2; const fine = new Int32Array(W2 * H2);
    for (let y = 0; y < H2; y += 1) for (let x = 0; x < W2; x += 1) {
      const v = out[(y >> 1) * SW + (x >> 1)]; if (!v) continue; const c = unpack(v);
      const grey = Math.abs(c[0] - c[1]) < 14 && Math.abs(c[1] - c[2]) < 18 && c[0] > 70; const isCloth = c[team === 'def' ? 2 : 0] > 120 && !grey;
      let k = 1.12 - (x / W2) * 0.22 - (y / H2) * 0.1; // (the light)
      if (grey) k *= (x + y) % 2 ? 1.08 : 0.9; // (rings of mail, a helmet's sheen)
      if (isCloth) k *= 0.92 + 0.14 * Math.sin(x * 0.9 + (y >> 3)); // (folds)
      fine[y * W2 + x] = v === pack([16, 12, 18]) ? v : pack(c.map((q) => q * k));
    }
    return (sprites[key] = { w: W2, h: H2, px: fine });
  }
  /* The props, painted once: a barrel (staves, two iron hoops), a bale of hay (straw, its twine), the well
     (a ring of stones, two posts and a beam with its bucket). Twice as fine as drawn, as the men are. */
  function propSprite(kind) {
    const key = `prop-${kind}`; if (sprites[key]) return sprites[key];
    const [SW, SH] = { barrel: [20, 26], hay: [30, 20], well: [32, 36] }[kind]; const px = new Int32Array(SW * SH);
    const P = (x, y, c) => { if (x >= 0 && y >= 0 && x < SW && y < SH) px[y * SW + x] = pack(c); }; const n = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
    if (kind === 'barrel') for (let y = 0; y < SH; y += 1) { const bulge = Math.sin((y / (SH - 1)) * Math.PI) * 2; const w = 7 + bulge; for (let x = Math.round(10 - w); x <= Math.round(9 + w); x += 1) { const u = (x - (10 - w)) / (2 * w); const st = Math.floor(u * 7) % 2; const k = 0.62 + Math.sin(u * Math.PI) * 0.5;
      const hoop = y === 3 || y === 4 || y === SH - 5 || y === SH - 4; P(x, y, hoop ? [70 * k, 70 * k, 78 * k] : y < 2 ? [70, 46, 26] : [(st ? 150 : 132) * k, (st ? 96 : 84) * k, (st ? 52 : 44) * k]); } }
    if (kind === 'hay') for (let y = 2; y < SH; y += 1) for (let x = 1; x < SW - 1; x += 1) { const k = 0.7 + (1 - y / SH) * 0.4 + (n(x, y) - 0.5) * 0.3; const tw = x === 8 || x === 21; P(x, y, tw ? [120, 90, 50] : [220 * k, 186 * k, 90 * k]); }
    if (kind === 'well') { for (let y = 20; y < SH; y += 1) for (let x = 2; x < SW - 2; x += 1) { const row = Math.floor((y - 20) / 4); const joint = (y - 20) % 4 === 0 || (x + row * 3) % 7 === 0; const k = 0.8 + (n(x >> 2, row) - 0.5) * 0.3; P(x, y, joint ? [90, 86, 80] : [168 * k, 162 * k, 150 * k]); }
      for (let y = 2; y < 20; y += 1) { P(4, y, [110, 74, 40]); P(5, y, [90, 60, 32]); P(SW - 5, y, [110, 74, 40]); P(SW - 6, y, [90, 60, 32]); } for (let x = 3; x < SW - 3; x += 1) { P(x, 2, [130, 88, 48]); P(x, 3, [96, 64, 34]); }
      for (let y = 4; y < 11; y += 1) P(16, y, [200, 190, 160]); for (let y = 11; y < 16; y += 1) for (let x = 13; x < 20; x += 1) P(x, y, y === 11 ? [70, 70, 76] : [120, 82, 46]); }
    const out = new Int32Array(px); for (let y = 0; y < SH; y += 1) for (let x = 0; x < SW; x += 1) { if (px[y * SW + x]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx; const Y = y + dy; return X >= 0 && Y >= 0 && X < SW && Y < SH && px[Y * SW + X]; })) out[y * SW + x] = pack([16, 12, 18]); }
    const W2 = SW * 2; const H2 = SH * 2; const fine = new Int32Array(W2 * H2); for (let y = 0; y < H2; y += 1) for (let x = 0; x < W2; x += 1) fine[y * W2 + x] = out[(y >> 1) * SW + (x >> 1)];
    return (sprites[key] = { w: W2, h: H2, px: fine });
  }
  const props = []; // [{ x, y, img, h, wk }], found once
  function prepProps() { props.length = 0; MAP.forEach((r, y) => [...r].forEach((c, x) => { const k = PROPS[c]; if (!k) return; const [h, wk] = { barrel: [0.92, 0.66], hay: [0.6, 0.95], well: [1.3, 1.1] }[k]; props.push({ x: x + 0.5, y: y + 0.5, img: propSprite(k), h, wk }); })); }
  const KEG = { w: 7, h: 6, px: [0, 3, 3, 3, 3, 3, 0, 3, 2, 2, 2, 2, 2, 3, 3, 1, 1, 1, 1, 1, 3, 3, 2, 2, 2, 2, 2, 3, 3, 1, 1, 1, 1, 1, 3, 0, 3, 3, 3, 3, 3, 0].map((v) => [0, pack([120, 80, 44]), pack([150, 104, 60]), pack([60, 60, 70])][v]) };

  /* ---- the visitor's settings: mouse sensitivity (radians a count: 0.0011 is about a tactical shooter's 2.5 at 800 dpi), field of view, inverted look ---- */
  const settings = { sens: 0.0011, fov: 1.6, invert: false, ...(JSON.parse(localStorage.getItem('siege-settings') || '{}') || {}) };
  const saveSettings = () => { try { localStorage.setItem('siege-settings', JSON.stringify(settings)); } catch { /* (no storage: for this time only) */ } };

  /* ---- the game ---------------------------------------------------------------------------------- */
  let g = null; let raf = 0; let root = null; let cv; let ctx; let img; let buf; let zbuf; let ui = {};
  const keys = new Set(); let mouseDown = [false, false, false];
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { /* (no storage: nothing kept) */ } return null; };
  const wallAt = (x, y) => { if (x < 0 || y < 0 || x >= MW || y >= MH) return '#'; const c = MAP[y][x]; return WALLS[c] ? c : null; };
  const blocked = (x, y) => Boolean(wallAt(x, y)) || Boolean(PROPS[MAP[y][x]]); // (a wall, or a barrel, the hay, the well)

  function newActor(team, idx, isBot, name) {
    return { team, idx, isBot, name, x: 0, y: 0, z: 0, vz: 0, a: 0, vx: 0, vy: 0, hp: 100, armour: 0, helm: false, alive: true, money: 800, weapons: { 1: null, 2: team === 'def' ? 'wheellock' : 'wheellock', 3: 'knife' },
      slot: 2, ammo: {}, gear: {}, tools: false, kills: 0, deaths: 0, lastShot: 0, shotN: 0, blindUntil: 0, reloadUntil: 0, moving: false, ai: {}, crouch: false };
  }
  function give(a, id) { const w = ARMS.W[id]; a.weapons[w.slot] = id; a.ammo[id] = { mag: w.mag || 0, res: (w.mag || 0) * 3 }; a.slot = w.slot; }
  const cur = (a) => a.weapons[a.slot] || a.weapons[2] || 'knife';

  function start(opts = {}) {
    if (g) return;
    const knife = store('siege-knife') || ARMS.randomKnife(); store('siege-knife', knife);
    g = { w: MW, h: MH, now: 0, actors: [], noises: [], nades: [], smokes: [], fires: [], fx: [], feed: [], arms: ARMS, difficulty: store('siege-diff') || 'normal',
      keg: {}, sites: [], posts: { def: [] }, round: 0, score: { def: 0, att: 0 }, phase: 'buy', phaseUntil: 0, frozen: true, lossStreak: { def: 0, att: 0 }, attSite: 0,
      knife: ARMS.knife(knife), knifeRecipe: knife, eyeH: 0.62, bobT: 0, drawAt: 0, sway: 0, hitMarkAt: -9, hitHead: false, heavySwing: false, pitch: 0, punch: 0, kick: 0, inspect: -1, swing: -1, flashUntil: 0, flashAt: 0, hurtAt: -9, scoped: false, msg: '', msgUntil: 0, opts, paused: false };
    g.wall = blocked; g.give = give; Object.assign(g, api); // (the bots' handle on the game: what they read, what they do through it)
    // the sites, the gates, the posts the defenders hold
    const cells = (ch) => { const out = []; MAP.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x + 0.5, y + 0.5]); })); return out; };
    const free = (x, y) => { let best = null; let bd = 1e9; MAP.forEach((r, yy) => [...r].forEach((c, xx) => { if (WALLS[c] || PROPS[c]) return; const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); if (d < bd) { bd = d; best = [xx + 0.5, yy + 0.5]; } })); return best; }; // (the open cell nearest a point: a centre may fall on a crate)
    ['a', 'b'].forEach((ch) => { const cs = cells(ch); const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length; const cy = cs.reduce((s, c) => s + c[1], 0) / cs.length; g.sites.push({ name: ch.toUpperCase(), cells: cs, c: free(cx, cy) }); });
    g.spawns = { def: cells('d'), att: cells('t') };
    g.lanes = [[[39.5, 21.5], [27.5, 13.5]], [[6.5, 20.5], [16.5, 16.5]]]; // (to A: long, or short by mid; to B: the tunnels, or lower mid)
    g.posts.def = [g.sites[0].c, g.sites[1].c, free(27, 13), free(7, 13), free(21, 8)];
    // the sides: the visitor and four bots against five
    g.player = newActor('def', 0, false, 'You'); g.actors.push(g.player);
    const NAMES = ['Aymeric', 'Bertrand', 'Clotilde', 'Driss', 'Enguerrand', 'Fulk', 'Gersende', 'Hugues', 'Isabeau', 'Jehan'];
    for (let k = 1; k < 5; k += 1) g.actors.push(newActor('def', k, true, NAMES[k - 1]));
    for (let k = 0; k < 5; k += 1) g.actors.push(newActor('att', k, true, NAMES[k + 4]));
    [W, H] = QUALITY[settings.quality ?? 1];
    build(); prepCells(); prepProps(); prepLight(); prepSky(); bind(); newRound(true);
    let last = performance.now();
    const loop = (t) => { raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t; if (!g.paused) { g.now += dt; update(dt); } render(); hud(); };
    raf = requestAnimationFrame(loop);
    say('Siege. Defend the two sites, A and B, from the keg. Click to take the mouse; B to buy; Esc to pause.', 6);
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; if (document.pointerLockElement) document.exitPointerLock();
    unbind(); if (root) root.remove(); root = null; g = null; if (audio) { audio.close(); audio = null; }
  }

  /* ---- rounds and money (after the tactical shooters' rules, in crowns) ---- */
  const START_MONEY = 800; const MAX_MONEY = 16000; const ROUND_S = 115; const KEG_S = 40; const BUY_S = 7;
  const KILL_REWARD = { knife: 1500, wheellock: 300, pepperbox: 300, blunderbuss: 900, repeater: 600, arquebus: 300, caliver: 300, greatbow: 100, he: 300, fire: 300 };
  function newRound(first) {
    g.round += 1; g.lastBought = g.bought && g.bought.length ? g.bought : g.lastBought; g.bought = [];
    if (!first && g.round === 8) { // the sides change at the half; money starts again
      g.actors.forEach((a) => { a.team = a.team === 'def' ? 'att' : 'def'; a.money = START_MONEY; a.weapons = { 1: null, 2: 'wheellock', 3: 'knife' }; a.armour = 0; a.helm = false; a.gear = {}; a.tools = false; });
      g.score = { def: g.score.att, att: g.score.def }; g.lossStreak = { def: 0, att: 0 }; say('The sides change: now you carry the keg. Plant it on A or B (stand on a site, hold E).', 5);
    }
    const dspawn = g.spawns.def.slice().sort(() => Math.random() - 0.5); const aspawn = g.spawns.att.slice().sort(() => Math.random() - 0.5);
    let di = 0; let ai2 = 0;
    g.actors.forEach((a) => {
      if (!a.alive) { a.weapons = { 1: null, 2: 'wheellock', 3: 'knife' }; a.armour = 0; a.helm = false; a.gear = {}; a.tools = false; }
      const s = a.team === 'def' ? dspawn[di++ % dspawn.length] : aspawn[ai2++ % aspawn.length];
      Object.assign(a, { x: s[0], y: s[1], z: 0, vz: 0, vx: 0, vy: 0, hp: 100, alive: true, blindUntil: 0, reloadUntil: 0, shotN: 0, ai: {}, a: a.team === 'def' ? Math.PI / 2 : -Math.PI / 2 });
      Object.keys(ARMS.W).forEach((id) => { if (ARMS.W[id].mag) a.ammo[id] = { mag: ARMS.W[id].mag, res: ARMS.W[id].mag * 3 }; });
      a.slot = a.weapons[1] ? 1 : 2;
      if (a.isBot) BOTS.buy(a, g);
    });
    g.attSite = Math.random() < 0.5 ? 0 : 1;
    const atts = g.actors.filter((a) => a.team === 'att'); const carrier = atts[Math.floor(Math.random() * atts.length)];
    g.keg = { carrier, planted: false, dropped: false, x: 0, y: 0, plantP: 0, defuseP: 0, until: 0, beepAt: 0 };
    g.nades = []; g.smokes = []; g.fires = []; g.fx = [];
    g.phase = 'buy'; g.phaseUntil = g.now + BUY_S; g.frozen = true;
    if (carrier === g.player) say('You carry the keg.', 3);
  }
  function endRound(winner, why) {
    if (g.phase === 'over') return;
    g.phase = 'over'; g.phaseUntil = g.now + 5; g.score[winner] += 1;
    const loser = winner === 'def' ? 'att' : 'def';
    g.lossStreak[winner] = 0; g.lossStreak[loser] = Math.min(4, g.lossStreak[loser] + 1);
    g.actors.forEach((a) => { a.money = Math.min(MAX_MONEY, a.money + (a.team === winner ? (why === 'keg' || why === 'defused' ? 3500 : 3250) : 1400 + 500 * (g.lossStreak[loser] - 1) + (loser === 'att' && g.keg.planted ? 800 : 0))); });
    const mine = winner === g.player.team;
    g.banner = { t: g.now, team: winner, mine, text: winner === 'def' ? 'The defenders win' : 'The attackers win', sub: { elim: 'every one of the other side down', time: 'time ran out', keg: 'the keg went up', defused: 'the keg defused' }[why] };
    sfx(mine ? 'win' : 'lose');
    if (g.score[winner] >= 8) { g.matchOver = winner; say(mine ? 'The match is yours, 8 rounds won. Esc: again or leave.' : 'The match is lost. Esc: again or leave.', 99); }
  }
  function say(t, s = 3) { g.msg = t; g.msgUntil = g.now + s; }

  /* ---- moving: speed, acceleration and friction as in the tactical shooters; walls block a circle of 0.22 ---- */
  const R = 0.22;
  function move(a, dx, dy, dt, speedK = 1) {
    const w = ARMS.W[cur(a)]; const max = 3.6 * (w.speed || 1) * speedK * (a.crouch ? 0.34 : 1) * (a.scoped ? 0.6 : 1);
    const n = Math.hypot(dx, dy); const tx = n ? (dx / n) * max : 0; const ty = n ? (dy / n) * max : 0;
    const k = Math.min(1, dt * (n ? 14 : 9)); a.vx += (tx - a.vx) * k; a.vy += (ty - a.vy) * k; // (quick to start and to stop, as in the tactical shooters)
    const nx = a.x + a.vx * dt; const ny = a.y + a.vy * dt;
    const free = (x, y) => !blocked(Math.floor(x - R), Math.floor(y - R)) && !blocked(Math.floor(x + R), Math.floor(y - R)) && !blocked(Math.floor(x - R), Math.floor(y + R)) && !blocked(Math.floor(x + R), Math.floor(y + R));
    if (free(nx, a.y)) a.x = nx; else a.vx = 0;
    if (free(a.x, ny)) a.y = ny; else a.vy = 0;
    a.moving = Math.hypot(a.vx, a.vy) > 0.6;
    if (a.moving && !a.crouch && !(a === g.player && keys.has('ShiftLeft'))) { a.stepAt ||= 0; if (g.now > a.stepAt) { a.stepAt = g.now + 0.36; noise(a, 7); if (a !== g.player) sfx('step', a); } }
  }
  function noise(a, r) { g.noises.push({ x: a.x, y: a.y, t: g.now, r, team: a.team }); if (g.noises.length > 60) g.noises.splice(0, 20); }

  /* ---- seeing and shooting ---- */
  /** The distance along a ray from (x, y) at angle ang to the first wall (DDA). */
  function wallDist(x, y, ang, max = 40) {
    const dx = Math.cos(ang); const dy = Math.sin(ang); let mx = Math.floor(x); let my = Math.floor(y);
    const ddx = Math.abs(1 / dx); const ddy = Math.abs(1 / dy); const sx = dx < 0 ? -1 : 1; const sy = dy < 0 ? -1 : 1;
    let sdx = (dx < 0 ? x - mx : mx + 1 - x) * ddx; let sdy = (dy < 0 ? y - my : my + 1 - y) * ddy;
    for (let k = 0; k < 200; k += 1) { if (sdx < sdy) { sdx += ddx; mx += sx; if (wallAt(mx, my)) return sdx - ddx; } else { sdy += ddy; my += sy; if (wallAt(mx, my)) return sdy - ddy; } if (Math.min(sdx, sdy) > max) return max; }
    return max;
  }
  const smokeHides = (ax, ay, bx, by) => g.smokes.some((s) => { if (g.now > s.until) return false; const vx = bx - ax; const vy = by - ay; const L2 = vx * vx + vy * vy || 1; const t = clamp(((s.x - ax) * vx + (s.y - ay) * vy) / L2, 0, 1); return Math.hypot(ax + vx * t - s.x, ay + vy * t - s.y) < s.r * Math.min(1, (g.now - s.t0) / 1.5); });
  function sees(a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y); return wallDist(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), d + 1) >= d - 0.05 && !smokeHides(a.x, a.y, b.x, b.y); }
  function damage(t, dmg, pierce, head, by, wid) {
    if (!t.alive) return;
    const armoured = t.armour > 0 && (!head || t.helm);
    let d = dmg; if (armoured) { const taken = d * pierce; t.armour = Math.max(0, t.armour - (d - taken) * 0.5); d = taken; }
    t.hp -= d; t.hitAt = g.now; if (t === g.player) { g.hurtAt = g.now; g.hurtFrom = by ? Math.atan2(by.y - t.y, by.x - t.x) : null; }
    if (head) sfx(t.helm ? 'tink' : 'thud', t);
    if (t.hp <= 0) { t.diedAt = g.now;
      t.alive = false; t.hp = 0; t.deaths += 1;
      if (by && by.team !== t.team) { by.kills += 1; by.money = Math.min(MAX_MONEY, by.money + (KILL_REWARD[wid] || 300)); }
      g.feed.unshift({ by: by ? by.name : '', byTeam: by ? by.team : '', w: wid, head, who: t.name, team: t.team, t: g.now }); g.feed.length = Math.min(6, g.feed.length);
      if (g.keg.carrier === t && !g.keg.planted) { g.keg.carrier = null; g.keg.dropped = true; g.keg.x = t.x; g.keg.y = t.y; }
      if (t === g.player) { g.scoped = false; say('You fell. The round goes on without you.', 3); }
      checkElim();
    }
  }
  function checkElim() {
    if (g.phase === 'over') return;
    const alive = (team) => g.actors.some((a) => a.alive && a.team === team);
    if (!alive('att') && !g.keg.planted) endRound('def', 'elim');
    else if (!alive('def')) endRound('att', 'elim');
  }
  /** A shot by actor a along (yaw, pitch); the actors it can hit: the first in the line, before any wall. */
  function hitscan(a, yaw, pitch, w, wid) {
    const wd = wallDist(a.x, a.y, yaw); const eye = (a.crouch ? 0.45 : 0.62) + a.z; let best = null; let bd = wd;
    g.actors.forEach((o) => {
      if (o === a || !o.alive || o.team === a.team) return;
      const vx = o.x - a.x; const vy = o.y - a.y; const along = vx * Math.cos(yaw) + vy * Math.sin(yaw); if (along <= 0 || along >= bd) return;
      const off = Math.abs(-vx * Math.sin(yaw) + vy * Math.cos(yaw)); if (off > 0.24) return;
      const hz = eye + Math.tan(pitch) * along; const top = o.crouch ? 0.65 : 0.9; if (hz < 0 || hz > top) return;
      best = { o, head: hz > top - 0.15, d: along, z: hz }; bd = along;
    });
    if (smokeHides(a.x, a.y, a.x + Math.cos(yaw) * bd, a.y + Math.sin(yaw) * bd) && best && best.d > 2) best = null; // (a shot into smoke: no telling where it goes)
    const end = best ? best.d : wd - 0.05; const ex = a.x + Math.cos(yaw) * end; const ey = a.y + Math.sin(yaw) * end; const ez = best ? best.z : eye + Math.tan(pitch) * wd;
    g.fx.push({ kind: 'trail', x0: a.x + Math.cos(yaw) * 0.4, y0: a.y + Math.sin(yaw) * 0.4, z0: eye - 0.08, x1: ex, y1: ey, z1: ez, t: g.now }); // (the shot's trail)
    const burst = (kind, n, sp) => ({ kind, t: g.now, parts: Array.from({ length: n }, () => ({ x: ex, y: ey, z: ez, vx: (Math.random() - 0.5) * sp - Math.cos(yaw) * sp * 0.4, vy: (Math.random() - 0.5) * sp - Math.sin(yaw) * sp * 0.4, vz: Math.random() * sp })) });
    if (best) { g.fx.push(burst('blood', 10, 2.2)); if (a === g.player) { g.hitMarkAt = g.now; g.hitHead = best.head; sfx(best.head ? 'tink' : 'hit'); } damage(best.o, w.dmg * (best.head ? w.head : 1) * (1 - (w.fall || 0)) ** (best.d / 10), w.pierce ?? 1, best.head, a, wid); }
    else g.fx.push(burst('spark', 7, 3)); // (stone chips and a spark off the wall)
    return best;
  }
  function spreadOf(a, w) {
    const sp = Math.hypot(a.vx, a.vy); let s = w.spread + (w.mspread || 0) * clamp(sp / 3.6, 0, 1) + (a.z > 0.02 ? 6 : 0);
    if (a.crouch) s *= 0.7; if (w.scoped && a.scoped) s = w.scoped + (w.mspread || 0) * clamp(sp / 3.6, 0, 1) * 0.6;
    return s;
  }
  /** Fire the current weapon of actor a (the visitor: the aim; a bot: at target with an aim error, degrees). */
  function shoot(a, target, errDeg) {
    const wid = cur(a); const w = ARMS.W[wid]; if (g.frozen || !a.alive || g.now < a.reloadUntil) return;
    if (g.now - a.lastShot < 1 / w.rate) return;
    if (w.melee) { a.lastShot = g.now; if (a === g.player) { g.swing = 0; g.heavySwing = mouseDown[2]; if (!g.heavySwing) g.swingSide = -(g.swingSide || 1); sfx('swish'); } stab(a, target); return; }
    const am = a.ammo[wid]; if (!am || am.mag <= 0) { reload(a); return; }
    am.mag -= 1; a.shotsAll = (a.shotsAll || 0) + 1; if (g.now - a.lastShot > 0.45) a.shotN = 0; a.lastShot = g.now; noise(a, 18); sfx('shot', a, wid);
    const rec = w.recoil[Math.min(a.shotN, w.recoil.length - 1)]; a.shotN += 1;
    const deg = Math.PI / 180; const pellets = w.pellets || 1;
    for (let p = 0; p < pellets; p += 1) {
      const s = spreadOf(a, w) * (Math.random() + Math.random() - 1);
      const s2 = spreadOf(a, w) * (Math.random() + Math.random() - 1);
      if (a === g.player) hitscan(a, a.a + (rec[0] + s) * deg, g.pitch + (rec[1] * 0.9 + s2 * 0.6) * deg, w, wid);
      else { // a bot: towards its target, off by its error
        const yaw = Math.atan2(target.y - a.y, target.x - a.x) + (errDeg * (Math.random() + Math.random() - 1) + rec[0] * 0.5) * deg;
        const d = Math.hypot(target.x - a.x, target.y - a.y); const aimZ = (target.crouch ? 0.4 : 0.55) + (Math.random() < 0.18 ? 0.25 : 0);
        hitscan(a, yaw, Math.atan2(aimZ - 0.62 + (errDeg * (Math.random() - 0.5)) * deg * d, d), w, wid);
      }
    }
    if (a === g.player) { g.punch += rec[1] * 0.012 + 0.004; g.kick = 1; g.flashFrame = true; if (am.mag === 0) reload(a); }
    if (am.mag === 0 && a.isBot) reload(a);
  }
  function stab(a, target) {
    const t = target || g.actors.find((o) => o.alive && o.team !== a.team && Math.hypot(o.x - a.x, o.y - a.y) < 1.1 && Math.abs(wrap(Math.atan2(o.y - a.y, o.x - a.x) - a.a)) < 0.6);
    if (!t || Math.hypot(t.x - a.x, t.y - a.y) > 1.1) return;
    const back = Math.abs(wrap(t.a - Math.atan2(t.y - a.y, t.x - a.x))) < 0.8; const heavy = a === g.player && mouseDown[2];
    damage(t, back ? (heavy ? 180 : 90) : heavy ? 65 : 34, 0.85, false, a, 'knife'); sfx('stab', t);
  }
  function reload(a) {
    const wid = cur(a); const w = ARMS.W[wid]; const am = a.ammo[wid]; if (!w.mag || !am || am.res <= 0 || am.mag === w.mag || g.now < a.reloadUntil) return;
    a.reloadUntil = g.now + w.reload; a.reloadId = wid; sfx('reload', a); // (done in update, on the game's clock)
  }

  /* ---- the keg ---- */
  const onSite = (a) => { const k = g.sites.findIndex((s) => s.cells.some(([x, y]) => Math.floor(x) === Math.floor(a.x) && Math.floor(y) === Math.floor(a.y))); return k < 0 ? null : k; };
  function plant(a, dt) {
    const k = g.keg; if (k.planted || k.carrier !== a || onSite(a) === null || g.phase !== 'live') return;
    k.plantP += dt / 3.2; a.vx = 0; a.vy = 0; if (Math.random() < dt * 3) sfx('click', a);
    if (k.plantP >= 1) { Object.assign(k, { planted: true, carrier: null, x: a.x, y: a.y, until: g.now + KEG_S, site: onSite(a), beepAt: g.now }); g.phase = 'planted'; a.money += 300; say(`The keg is planted on ${g.sites[k.site].name}.`, 4); sfx('planted'); }
  }
  function defuse(a, dt) {
    const k = g.keg; if (!k.planted || Math.hypot(k.x - a.x, k.y - a.y) > 1 || g.phase !== 'planted') return;
    k.defuser = a; k.defuseP += dt / (a.tools ? 3.5 : 7); a.vx = 0; a.vy = 0; if (Math.random() < dt * 4) sfx('click', a);
    if (k.defuseP >= 1) { k.planted = false; k.defused = true; endRound('def', 'defused'); }
  }

  /* ---- thrown things: bounce off walls and floor, then go off ---- */
  function throwIt(a, kind, target) {
    const key = { he: 'he', smoke: 'smoke', flash: 'flash', fire: 'fire' }[kind]; if (!a.gear[key] || g.frozen) return;
    a.gear[key] -= 1; let yaw = a.a; let up = 0.35;
    if (a === g.player) up = 0.35 + g.pitch; else if (target) { yaw = Math.atan2(target.y - a.y, target.x - a.x); const d = Math.hypot(target.x - a.x, target.y - a.y); up = clamp(0.15 + d * 0.025, 0.1, 0.6); }
    const sp = 9; g.nades.push({ kind, x: a.x, y: a.y, z: 0.6, vx: Math.cos(yaw) * sp * Math.cos(up), vy: Math.sin(yaw) * sp * Math.cos(up), vz: sp * Math.sin(up), t0: g.now, by: a, still: 0 });
    sfx('throw', a);
  }
  function updateNades(dt) {
    g.nades = g.nades.filter((n) => {
      n.vz -= 18 * dt; const nx = n.x + n.vx * dt; const ny = n.y + n.vy * dt;
      if (blocked(Math.floor(nx), Math.floor(n.y))) n.vx *= -0.5; else n.x = nx;
      if (blocked(Math.floor(n.x), Math.floor(ny))) n.vy *= -0.5; else n.y = ny;
      n.z += n.vz * dt; if (n.z < 0) { n.z = 0; n.vz *= -0.4; n.vx *= 0.7; n.vy *= 0.7; if (n.kind === 'fire') { goOff(n); return false; } }
      const age = g.now - n.t0; const slow = Math.hypot(n.vx, n.vy) < 0.4 && n.z < 0.05;
      if ((n.kind === 'he' && age > 1.6) || (n.kind === 'flash' && age > 1.4) || (n.kind === 'smoke' && (slow || age > 2.5))) { goOff(n); return false; }
      return true;
    });
    g.smokes = g.smokes.filter((s) => g.now < s.until); g.fires = g.fires.filter((f) => g.now < f.until && !g.smokes.some((s) => Math.hypot(s.x - f.x, s.y - f.y) < s.r));
    g.fires.forEach((f) => g.actors.forEach((a) => { if (a.alive && Math.hypot(a.x - f.x, a.y - f.y) < f.r && Math.random() < dt * 4) damage(a, 8, 1, false, f.by, 'fire'); }));
    g.fx = g.fx.filter((f) => g.now - f.t < 0.9);
  }
  function goOff(n) {
    const at = { x: n.x, y: n.y };
    if (n.kind === 'he') { sfx('boom', at); g.fx.push({ kind: 'blast', x: n.x, y: n.y, z: 0.3, t: g.now }); g.actors.forEach((a) => { const d = Math.hypot(a.x - n.x, a.y - n.y); if (a.alive && d < 3.5 && wallDist(n.x, n.y, Math.atan2(a.y - n.y, a.x - n.x), d + 1) >= d - 0.1) damage(a, 98 * (1 - d / 3.5), 0.5, false, n.by, 'he'); }); noise(at, 25); }
    if (n.kind === 'smoke') { g.smokes.push({ x: n.x, y: n.y, r: 2.3, t0: g.now, until: g.now + 15 }); sfx('hiss', at); }
    if (n.kind === 'fire') { g.fires.push({ x: n.x, y: n.y, r: 1.7, until: g.now + 7, by: n.by }); sfx('whoosh', at); }
    if (n.kind === 'flash') {
      sfx('flash', at);
      g.actors.forEach((a) => {
        if (!a.alive) return; const d = Math.hypot(a.x - n.x, a.y - n.y); if (d > 18 || wallDist(n.x, n.y, Math.atan2(a.y - n.y, a.x - n.x), d + 1) < d - 0.1) return;
        const facing = Math.cos(wrap(Math.atan2(n.y - a.y, n.x - a.x) - a.a)); const s = clamp((0.4 + 0.6 * Math.max(0, facing)) * (1 - d / 20) * 4.2, 0.3, 4.2);
        a.blindUntil = g.now + s; if (a === g.player) { g.flashUntil = g.now + s; g.flashAt = g.now; }
      });
    }
  }

  /* ---- each frame ---- */
  function update(dt) {
    const p = g.player;
    // the phases
    if (g.phase === 'buy' && g.now > g.phaseUntil) { g.phase = 'live'; g.phaseUntil = g.now + ROUND_S; g.frozen = false; closeBuy(); }
    else if (g.phase === 'live' && g.now > g.phaseUntil) endRound('def', 'time');
    else if (g.phase === 'planted') {
      const k = g.keg; const left = k.until - g.now; const every = clamp(left / 40, 0.12, 1);
      if (g.now > k.beepAt) { k.beepAt = g.now + every; sfx('beep', k); noise({ x: k.x, y: k.y, team: 'att' }, 30); }
      if (left <= 0) { sfx('bigboom', k); g.fx.push({ kind: 'blast', x: k.x, y: k.y, z: 0.4, t: g.now, big: true }); endRound('att', 'keg'); g.actors.forEach((a) => { const d = Math.hypot(a.x - k.x, a.y - k.y); if (a.alive && d < 12) damage(a, 500 * (1 - d / 12) ** 1.5, 1, false, null, 'keg'); }); }
      if (k.defuser && (!k.defuser.alive || Math.hypot(k.defuser.x - k.x, k.defuser.y - k.y) > 1)) { k.defuser = null; k.defuseP = 0; }
    } else if (g.phase === 'over' && g.now > g.phaseUntil && !g.matchOver) newRound(false);
    // the visitor
    if (p.alive) {
      const turn = (keys.has('ArrowLeft') ? -1 : 0) + (keys.has('ArrowRight') ? 1 : 0); p.a += turn * dt * 2.2;
      g.pitch = clamp(g.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * dt * 1.2, -0.6, 0.6);
      const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0); const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      p.crouch = keys.has('ControlLeft') || keys.has('KeyC');
      const dx = Math.cos(p.a) * fwd + Math.cos(p.a + Math.PI / 2) * side; const dy = Math.sin(p.a) * fwd + Math.sin(p.a + Math.PI / 2) * side;
      if (!g.frozen) move(p, dx, dy, dt, keys.has('ShiftLeft') ? 0.52 : 1);
      if (keys.has('Space') && p.z === 0 && !g.frozen) { p.vz = 4.2; keys.delete('Space'); }
      p.vz -= 13 * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0) p.vz = 0;
      const w = ARMS.W[cur(p)];
      if (mouseDown[0] && (w.auto || !p.heldShot)) { shoot(p); p.heldShot = true; }
      if (!mouseDown[0]) p.heldShot = false;
      if (keys.has('KeyE')) { if (g.keg.carrier === p) plant(p, dt); else if (g.keg.planted) defuse(p, dt); }
      else if (g.keg.carrier === p) g.keg.plantP = 0; else if (g.keg.defuser === p) { g.keg.defuseP = 0; g.keg.defuser = null; }
      if (g.keg.dropped && p.team === 'att' && Math.hypot(g.keg.x - p.x, g.keg.y - p.y) < 0.7) { g.keg.dropped = false; g.keg.carrier = p; say('You pick up the keg.', 2); }
    }
    g.punch *= Math.exp(-dt * 6); g.kick = Math.max(0, g.kick - dt * 7); g.sway *= Math.exp(-dt * 9);
    g.eyeH += ((p.crouch ? 0.45 : 0.62) - g.eyeH) * Math.min(1, dt * 12); g.bobT += dt * 9 * Math.min(1, Math.hypot(p.vx, p.vy) / 3.6) * (p.z > 0 ? 0 : 1);
    if (g.inspect >= 0) { g.inspect += dt / 2.4; if (g.inspect > 1) g.inspect = -1; }
    if (g.swing >= 0) { g.swing += dt * 4; if (g.swing > 1) g.swing = -1; }
    // reloads done
    g.actors.forEach((a) => { if (!a.reloadId || g.now < a.reloadUntil) return; const w = ARMS.W[a.reloadId]; const am = a.ammo[a.reloadId]; if (am && cur(a) === a.reloadId) { const n = Math.min(w.mag - am.mag, am.res); am.mag += n; am.res -= n; } a.reloadId = null; });
    // the bots
    g.actors.forEach((b) => { if (b.isBot) { BOTS.think(b, g, dt); if (b.alive && g.keg.dropped && b.team === 'att' && Math.hypot(g.keg.x - b.x, g.keg.y - b.y) < 0.7) { g.keg.dropped = false; g.keg.carrier = b; } } });
    updateNades(dt);
  }
  // what the bots call
  const api = { move: (a, dx, dy, dt) => move(a, dx, dy, dt), fire: (a, t, e) => shoot(a, t, e), plant, defuse, throw: throwIt, sees, onSite };

  /* ---- drawing ---- */
  const cellWall = []; const cellFloor = []; const cellRoof = []; // (each cell's textures, found once; a prop's floor and roof are its neighbours')
  function prepCells() {
    const under = (x, y) => { let c = MAP[y][x]; if (!PROPS[c]) return c; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = MAP[y + dy]?.[x + dx]; if (n && FLOORS[n]) { c = n; break; } } return c; };
    for (let y = 0; y < MH; y += 1) for (let x = 0; x < MW; x += 1) { const c = MAP[y][x]; const u = under(x, y); cellWall[y * MW + x] = WALLS[c] ? texOf(WALLS[c]) : null; cellFloor[y * MW + x] = texOf(FLOORS[u] || 'flagstones'); cellRoof[y * MW + x] = ROOFS[u] ? texOf(ROOFS[u]) : null; }
  }
  const FOG_D = 46; const SKY = [80, 136, 210]; const HAZE = [206, 214, 224];
  /* The light: a grid of four samples a cell, each [r, g, b] (1 = daylight in the yard's shade). Torches on
     the walls, found once with their shadows (a sample sees a torch, or not, through the grid); the light of
     the moment (shots, fires, blasts, the planted keg) added each frame without shadows. */
  const LR = 4; const LW = MW * LR; const LH = MH * LR; const lmStatic = new Float32Array(LW * LH * 3); const lm = new Float32Array(LW * LH * 3);
  const AMB = [0.62, 0.64, 0.7]; let torches = [];
  function prepLight() {
    torches = [];
    for (let y = 1; y < MH - 1; y += 1) for (let x = 1; x < MW - 1; x += 1) { // a torch on a wall where a floor cell faces it, about one in eight
      if (WALLS[MAP[y][x]] || PROPS[MAP[y][x]] || (x * 7 + y * 13) % (cellRoof[y * MW + x] ? 5 : 8)) continue; // (thicker under a roof)
      const face = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dy]) => WALLS[MAP[y + dy][x + dx]] && MAP[y + dy][x + dx] !== 'C'); if (!face) continue;
      torches.push({ x: x + 0.5 + face[0] * 0.42, y: y + 0.5 + face[1] * 0.42, ph: Math.random() * 6 });
    }
    for (let j = 0; j < LH; j += 1) for (let i = 0; i < LW; i += 1) {
      const sx = (i + 0.5) / LR; const sy = (j + 0.5) / LR; const o = (j * LW + i) * 3; const roofed = cellRoof[Math.floor(sy) * MW + Math.floor(sx)]; let r = AMB[0] * (roofed ? 0.42 : 1); let gg = AMB[1] * (roofed ? 0.42 : 1); let b = AMB[2] * (roofed ? 0.46 : 1); // (dim under a roof)
      torches.forEach((t) => { const d = Math.hypot(t.x - sx, t.y - sy); if (d > 6) return; if (d > 0.3 && wallDist(t.x, t.y, Math.atan2(sy - t.y, sx - t.x), d + 0.1) < d - 0.15) return; const k = (1 - d / 6) ** 2 * 1.3; r += k; gg += k * 0.72; b += k * 0.42; });
      lmStatic[o] = r; lmStatic[o + 1] = gg; lmStatic[o + 2] = b;
    }
  }
  function lightFrame() {
    lm.set(lmStatic); const now = g.now; const add = (x, y, R, c) => { const i0 = Math.max(0, Math.floor((x - R) * LR)); const i1 = Math.min(LW - 1, Math.ceil((x + R) * LR)); const j0 = Math.max(0, Math.floor((y - R) * LR)); const j1 = Math.min(LH - 1, Math.ceil((y + R) * LR));
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) { const d = Math.hypot((i + 0.5) / LR - x, (j + 0.5) / LR - y); if (d >= R) continue; const k = (1 - d / R) ** 2; const o = (j * LW + i) * 3; lm[o] += c[0] * k; lm[o + 1] += c[1] * k; lm[o + 2] += c[2] * k; } };
    torches.forEach((t) => { const f = 0.15 * Math.sin(now * 13 + t.ph) * Math.sin(now * 7.3 + t.ph * 2); add(t.x, t.y, 2.5, [f, f * 0.7, f * 0.3]); }); // (they flicker)
    g.actors.forEach((a) => { if (a.alive && now - a.lastShot < 0.06 && cur(a) !== 'knife') add(a.x + Math.cos(a.a) * 0.5, a.y + Math.sin(a.a) * 0.5, 3.5, [1.4, 1.1, 0.6]); }); // (muzzle flashes)
    g.fires.forEach((f) => add(f.x, f.y, 4, [1, 0.55, 0.2]));
    g.fx.forEach((f) => { if (f.kind === 'blast') add(f.x, f.y, f.big ? 12 : 6, [3 * (1 - (now - f.t) / 0.9), 2 * (1 - (now - f.t) / 0.9), 0.8 * (1 - (now - f.t) / 0.9)]); });
    if (g.keg.planted && Math.floor(now * 4) % 2) add(g.keg.x, g.keg.y, 2, [1.2, 0.3, 0.1]);
  }
  const lightAt = (x, y) => { const i = clamp(Math.floor(x * LR), 0, LW - 1); const j = clamp(Math.floor(y * LR), 0, LH - 1); return (j * LW + i) * 3; };
  /** A packed colour lit by the light at lm offset o (times sh), then mixed towards the haze by k (0..1). */
  const litFog = (v, o, k, sh = 1) => {
    const a = Math.round(k * 256); const b = 256 - a;
    const r = Math.min(255, (v & 255) * lm[o] * sh); const gg = Math.min(255, ((v >> 8) & 255) * lm[o + 1] * sh); const bb = Math.min(255, ((v >> 16) & 255) * lm[o + 2] * sh);
    return (255 << 24) | (((bb * b + HAZE[2] * a) >> 8) << 16) | (((gg * b + HAZE[1] * a) >> 8) << 8) | ((r * b + HAZE[0] * a) >> 8);
  };
  const fogged = (v, k) => { const a = Math.round(k * 256); const b = 256 - a; return (255 << 24) | ((((v >> 16) & 255) * b + HAZE[2] * a) >> 8) << 16 | ((((v >> 8) & 255) * b + HAZE[1] * a) >> 8) << 8 | (((v & 255) * b + HAZE[0] * a) >> 8); };
  /** The sky's clouds: a band all round the horizon (value noise), seen by the way you face. */
  let clouds = null;
  /* The sky all round, painted once (gradient, clouds, the sun's disc and glow) at SKW columns by H rows
     above the horizon; each frame only reads it. */
  const SKW = 2048; let skyTex = null;
  function paintSky() {
    skyTex = new Uint32Array(SKW * H); const sunA = 2.4; const cl = clouds;
    for (let r = 0; r < H; r += 1) { const k = clamp(r / (H * 0.8), 0, 1); const base = SKY.map((v, i) => HAZE[i] + (v - HAZE[i]) * k); const cy = Math.floor(clamp(r / (H * 0.55), 0, 0.999) * cl.h);
      for (let c = 0; c < SKW; c += 1) { const ang = (c / SKW) * 2 * Math.PI; const a = cl.a[cy * cl.w + Math.floor((c / SKW) * cl.w)]; const sd = Math.hypot(wrap(ang - sunA) * 4, r / H * 6 - 1.2); const gl = sd < 1.2 ? (1.2 - sd) : 0;
        skyTex[r * SKW + c] = sd < 0.25 ? 0xffe6faff : pack([base[0] + (248 - base[0]) * a * 0.9 + gl * 40, base[1] + (248 - base[1]) * a * 0.9 + gl * 36, base[2] + (252 - base[2]) * a * 0.9 + gl * 24]); } }
  }
  function prepSky() { const CW = 1024; const CH = 128; clouds = { w: CW, h: CH, a: new Float32Array(CW * CH) }; const n = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    const sm = (x, y) => { const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi; const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf); const w = (i) => ((i % (CW / 16)) + CW / 16) % (CW / 16); return (n(w(xi), yi) * (1 - u) + n(w(xi + 1), yi) * u) * (1 - v) + (n(w(xi), yi + 1) * (1 - u) + n(w(xi + 1), yi + 1) * u) * v; };
    for (let y = 0; y < CH; y += 1) for (let x = 0; x < CW; x += 1) { let a = 0; let amp = 0.55; let f = 1 / 16; for (let o = 0; o < 4; o += 1) { a += sm(x * f, y * f * 2.5) * amp; amp *= 0.5; f *= 2; } clouds.a[y * CW + x] = clamp((a - 0.52) * 3, 0, 1) * (1 - y / CH * 0.3); } }
  /** Where a point of the world lands on the screen: [x, y, depth, scale], or null behind. */
  let cam = null;
  /** Whose eyes: the visitor's, or (fallen) a living one of the side, chosen by clicking. */
  function camActor() { const me = g.player; if (me.alive) return me; const mates = g.actors.filter((a) => a.alive && a.team === me.team); return mates.length ? mates[(g.specIdx || 0) % mates.length] : me; }
  function toScreen(x, y, z) { const c = cam; const rx = x - c.px; const ry = y - c.py; const ty = c.inv * (-c.plY * rx + c.plX * ry); if (ty < 0.05) return null; const tx = c.inv * (c.dirY * rx - c.dirX * ry); const sc = H / ty / (c.pl * 2); return [(W / 2) * (1 + tx / ty), c.hor + (c.eye - z) * sc, ty, sc]; }
  function render() {
    const me = g.player; const p = camActor(); const self = p === me; // (dead: the eyes of a living one of your side)
    const eye = (self ? g.eyeH : p.crouch ? 0.45 : 0.62) + p.z; const fov = settings.fov * (self && p.scoped ? 0.25 : 1);
    const hor = Math.floor(H / 2 + (self ? g.pitch + g.punch : 0) * H * 0.9);
    const dirX = Math.cos(p.a); const dirY = Math.sin(p.a); const pl = Math.tan(fov / 2); const plX = -dirY * pl; const plY = dirX * pl;
    cam = { px: p.x, py: p.y, dirX, dirY, plX, plY, pl, hor, eye, inv: 1 / (plX * dirY - dirX * plY) };
    lightFrame();
    // the sky: read from its panorama by the way each column looks
    if (!skyTex || skyTex.length !== SKW * H) paintSky();
    const colS = new Int32Array(W); for (let x = 0; x < W; x += 1) { const ang = p.a + Math.atan(((2 * x) / W - 1) * pl); colS[x] = Math.floor(((ang / (2 * Math.PI)) % 1 + 1) % 1 * SKW); }
    // and the ceilings of the covered places, cast as the floor is (at the walls' height); the sky where there is none
    const rx0 = dirX - plX; const ry0 = dirY - plY; const rx1 = dirX + plX; const ry1 = dirY + plY; const posZ = eye * H; const posC = (WALL_H - eye) * H;
    for (let y = 0; y < Math.min(H, hor); y += 1) {
      const row = Math.min(H - 1, hor - y) * SKW; let o = y * W; const rowD = posC / ((hor - y) * 2 * pl);
      if (rowD > 40) { for (let x = 0; x < W; x += 1) buf[o + x] = skyTex[row + colS[x]]; continue; }
      let fx = p.x + rowD * rx0; let fy = p.y + rowD * ry0; const sx = (rowD * (rx1 - rx0)) / W; const sy = (rowD * (ry1 - ry0)) / W; const fog = clamp(rowD / FOG_D, 0, 1) * 0.85;
      const fa = Math.round(fog * 256); const fb = 256 - fa; const hr = HAZE[0] * fa; const hg = HAZE[1] * fa; const hb = HAZE[2] * fa;
      for (let x = 0; x < W; x += 1, o += 1, fx += sx, fy += sy) {
        const cx = fx | 0; const cy = fy | 0; const t = fx >= 0 && fy >= 0 && cx < MW && cy < MH ? cellRoof[cy * MW + cx] : null;
        if (!t) { buf[o] = skyTex[row + colS[x]]; continue; }
        const v = t[((((fy - cy) * T) | 0) & (T - 1)) * T + ((((fx - cx) * T) | 0) & (T - 1))]; const lo = (((fy * LR) | 0) * LW + ((fx * LR) | 0)) * 3;
        let r = (v & 255) * lm[lo] * 0.75; let gg = ((v >> 8) & 255) * lm[lo + 1] * 0.75; let bb = ((v >> 16) & 255) * lm[lo + 2] * 0.75; if (r > 255) r = 255; if (gg > 255) gg = 255; if (bb > 255) bb = 255;
        buf[o] = 0xff000000 | (((bb * fb + hb) >> 8) << 16) | (((gg * fb + hg) >> 8) << 8) | ((r * fb + hr) >> 8);
      }
    }
    // the floor, row by row (each pixel's place on it, its cell's texture, its light)
    for (let y = Math.max(0, hor + 1); y < H; y += 1) {
      const rowD = posZ / ((y - hor) * 2 * pl); const fog = clamp(rowD / FOG_D, 0, 1) * 0.85;
      let fx = p.x + rowD * rx0; let fy = p.y + rowD * ry0; const sx = (rowD * (rx1 - rx0)) / W; const sy = (rowD * (ry1 - ry0)) / W; let o = y * W;
      const fa = Math.round(fog * 256); const fb = 256 - fa; const hr = HAZE[0] * fa; const hg = HAZE[1] * fa; const hb = HAZE[2] * fa;
      for (let x = 0; x < W; x += 1, o += 1) { // (inlined: the texel, lit, fogged)
        const cx = fx | 0; const cy = fy | 0; const inside = fx >= 0 && fy >= 0 && cx < MW && cy < MH; const t = inside ? cellFloor[cy * MW + cx] : cellFloor[0];
        const v = t[((((fy - cy) * T) | 0) & (T - 1)) * T + ((((fx - cx) * T) | 0) & (T - 1))]; const lo = inside ? (((fy * LR) | 0) * LW + ((fx * LR) | 0)) * 3 : 0;
        let r = (v & 255) * lm[lo]; let gg = ((v >> 8) & 255) * lm[lo + 1]; let bb = ((v >> 16) & 255) * lm[lo + 2]; if (r > 255) r = 255; if (gg > 255) gg = 255; if (bb > 255) bb = 255;
        buf[o] = 0xff000000 | (((bb * fb + hb) >> 8) << 16) | (((gg * fb + hg) >> 8) << 8) | ((r * fb + hr) >> 8); fx += sx; fy += sy; }
    }
    // the walls, a ray a column (lit by the light in front of them; darker at their foot)
    for (let x = 0; x < W; x += 1) {
      const camx = (2 * x) / W - 1; const rdx = dirX + plX * camx; const rdy = dirY + plY * camx;
      let mx = Math.floor(p.x); let my = Math.floor(p.y); const ddx = Math.abs(1 / rdx); const ddy = Math.abs(1 / rdy); const sx = rdx < 0 ? -1 : 1; const sy = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? p.x - mx : mx + 1 - p.x) * ddx; let sdy = (rdy < 0 ? p.y - my : my + 1 - p.y) * ddy; let side = 0; let t = null;
      for (let k = 0; k < 90 && !t; k += 1) { if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; } t = mx < 0 || my < 0 || mx >= MW || my >= MH ? cellWall[0] || texOf('ashlar') : cellWall[my * MW + mx]; }
      const perp = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy); zbuf[x] = perp;
      const lh = H / perp / (pl * 2); const top = Math.floor(hor - lh * (WALL_H - eye)); const bot = Math.floor(hor + lh * eye);
      let wx = side === 0 ? p.y + perp * rdy : p.x + perp * rdx; wx -= Math.floor(wx); let tx = (wx * T) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = T - 1 - tx;
      const lo = lightAt(p.x + rdx * (perp - 0.03), p.y + rdy * (perp - 0.03));
      const fog = clamp(perp / FOG_D, 0, 1) * 0.85; const shade = side ? 0.82 : 1; const span = bot - top;
      const fa = Math.round(fog * 256); const fb = 256 - fa; const hr = HAZE[0] * fa; const hg = HAZE[1] * fa; const hb = HAZE[2] * fa;
      const lr = lm[lo] * shade; const lg = lm[lo + 1] * shade; const lb = lm[lo + 2] * shade; const dv = (T * WALL_H) / span; const tm = t.length > T * T ? 255 : T - 1; const y0 = Math.max(0, top); const y1 = Math.min(H, bot); const aoY = top + span * 0.85;
      let tv = (y0 - top) * dv; let o = y0 * W + x;
      for (let y = y0; y < y1; y += 1, o += W, tv += dv) { // (inlined: the texel down the column, lit, darker at the foot, fogged)
        const v = t[((tv | 0) & tm) * T + tx]; const ao = y > aoY ? 1 - ((y - aoY) / span) * 2 : 1;
        let r = (v & 255) * lr * ao; let gg = ((v >> 8) & 255) * lg * ao; let bb = ((v >> 16) & 255) * lb * ao; if (r > 255) r = 255; if (gg > 255) gg = 255; if (bb > 255) bb = 255;
        buf[o] = 0xff000000 | (((bb * fb + hb) >> 8) << 16) | (((gg * fb + hg) >> 8) << 8) | ((r * fb + hr) >> 8);
      }
    }
    // the sprites, far to near
    const spr = []; const now = g.now;
    g.actors.forEach((a) => {
      if (a === p) return; const toMe = Math.atan2(p.y - a.y, p.x - a.x); const view = Math.abs(wrap(toMe - a.a)) < Math.PI / 2 ? 'front' : 'back';
      let img; let h = 0.9; let wk = 0.45;
      if (!a.alive) { const f = Math.min(2, Math.floor((now - (a.diedAt || 0)) / 0.12)); img = soldier(a.team, view, 'dead', f); h = 0.9; wk = 0.9; }
      else if (now - a.lastShot < 0.18 && view === 'front' && cur(a) !== 'knife') img = soldier(a.team, view, 'aim', now - a.lastShot < 0.06 ? 1 : 0);
      else img = soldier(a.team, view, a.moving ? 'walk' : 'idle', a.moving ? Math.floor(now * 8 + a.idx) % 4 : 0);
      spr.push({ x: a.x, y: a.y, img, h: a.crouch ? h * 0.72 : h, z: 0, wk, hit: now - (a.hitAt || -9) < 0.1, lit: true, lo: lightAt(a.x, a.y) });
    });
    torches.forEach((t) => spr.push({ x: t.x, y: t.y, z: 1.15, h: 0.32, wk: 0.16, torch: t })); // (the torches: a bracket, a flame)
    props.forEach((q) => spr.push({ x: q.x, y: q.y, img: q.img, h: q.h, wk: q.wk, z: 0, lit: true, lo: lightAt(q.x, q.y) }));
    if (g.keg.dropped || g.keg.planted) spr.push({ x: g.keg.x, y: g.keg.y, img: KEG, h: 0.22, z: 0, wk: 0.26, glow: g.keg.planted && Math.floor(now * 4) % 2 });
    g.nades.forEach((n) => spr.push({ x: n.x, y: n.y, z: n.z, h: 0.1, wk: 0.1, dot: n.kind === 'flash' ? [240, 240, 255] : n.kind === 'smoke' ? [150, 150, 150] : [120, 80, 40] }));
    g.smokes.forEach((sm) => { const k = Math.min(1, (now - sm.t0) / 1.5) * Math.min(1, (sm.until - now) / 2); for (let j = 0; j < 16; j += 1) { const q = j * 2.39996 + now * 0.05; const r = Math.sqrt(j / 16) * sm.r * k; spr.push({ x: sm.x + Math.cos(q) * r, y: sm.y + Math.sin(q) * r, z: 0, h: 1.5 * k, wk: 1.5 * k, cloud: [182, 184, 190], alpha: 0.85 }); } });
    g.fires.forEach((f) => { for (let j = 0; j < 10; j += 1) { const q = j * 2.39996 + now; const r = Math.sqrt(j / 10) * f.r; spr.push({ x: f.x + Math.cos(q) * r, y: f.y + Math.sin(q) * r, z: 0, h: 0.4 + Math.random() * 0.25, wk: 0.3, flame: true }); } });
    g.fx.forEach((f) => { if (f.kind === 'blast') spr.push({ x: f.x, y: f.y, z: 0, h: f.big ? 3 : 1.5, wk: f.big ? 4 : 1.7, flame: true }); });
    spr.forEach((s2) => { const rx = s2.x - p.x; const ry = s2.y - p.y; s2.ty = cam.inv * (-plY * rx + plX * ry); s2.tx = cam.inv * (dirY * rx - dirX * ry); });
    spr.filter((s2) => s2.ty > 0.1).sort((a, b) => b.ty - a.ty).forEach((s2) => {
      const scale = H / s2.ty / (pl * 2); const sx = (W / 2) * (1 + s2.tx / s2.ty);
      const hgt = s2.h * scale; const wid = s2.wk * scale; const bot = hor + (eye - s2.z) * scale; const top = bot - hgt; const fog = clamp(s2.ty / FOG_D, 0, 1) * 0.8;
      for (let x = Math.max(0, Math.floor(sx - wid / 2)); x < Math.min(W, sx + wid / 2); x += 1) {
        if (s2.ty >= zbuf[x]) continue; const u = (x - (sx - wid / 2)) / wid;
        for (let y = Math.max(0, Math.floor(top)); y < Math.min(H, bot); y += 1) {
          const v = (y - top) / hgt; const o = y * W + x;
          if (s2.img) { let c = s2.img.px[Math.floor(v * s2.img.h) * s2.img.w + Math.floor(u * s2.img.w)]; if (!c) continue; if (s2.glow) c = pack([255, 120, 60]); if (s2.hit) c = pack(unpack(c).map((q) => q + (255 - q) * 0.7)); buf[o] = s2.lit ? litFog(c, s2.lo, fog) : fogged(c, fog); }
          else if (s2.dot) { if (Math.hypot(u - 0.5, v - 0.5) < 0.5) buf[o] = pack(s2.dot); }
          else if (s2.cloud) { const r = Math.hypot(u - 0.5, (v - 0.5) * 1.2); if (r < 0.5) { const al = clamp(s2.alpha * (1 - r * 1.7), 0, 1); const c = unpack(buf[o]); buf[o] = pack(c.map((q, i) => q + (s2.cloud[i] - q) * al)); } }
          else if (s2.torch) { if (v > 0.55) { if (Math.abs(u - 0.5) < 0.12) buf[o] = pack([60, 44, 30]); } else { const fl = Math.sin(now * 14 + s2.torch.ph + v * 6) * 0.08; const r = Math.hypot((u - 0.5 - fl) * 1.6, (v - 0.32) * 1.1); if (r < 0.32) buf[o] = pack(r < 0.12 ? [255, 250, 200] : r < 0.22 ? [255, 190, 70] : [230, 90, 20]); } }
          else if (s2.flame) { const r = Math.hypot(u - 0.5, (v - 0.72)); if (r < 0.5 && Math.random() < 0.9 - r) buf[o] = pack(r < 0.16 ? [255, 244, 180] : r < 0.3 ? [255, 168, 56] : [214, 64, 22]); }
        }
      }
    });
    // particles in the world: sparks off stone, blood off a hit, the trails of shots (each against the depth)
    const dot = (X, Y, d, c, r = 1) => { X |= 0; Y |= 0; for (let j = -r + 1; j < r; j += 1) for (let i2 = -r + 1; i2 < r; i2 += 1) { const xx = X + i2; const yy = Y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H && d < zbuf[xx]) buf[yy * W + xx] = pack(c); } };
    g.fx.forEach((f) => {
      const age = now - f.t;
      if (f.kind === 'spark' || f.kind === 'blood') f.parts.forEach((q) => { const pz = q.z + q.vz * age - 4.9 * age * age; if (pz < 0) return; const sp = toScreen(q.x + q.vx * age, q.y + q.vy * age, pz); if (sp) dot(sp[0], sp[1], sp[2], f.kind === 'blood' ? [150, 10, 14] : age < 0.08 ? [255, 250, 200] : [200, 180, 140], Math.max(1, Math.round(sp[3] / 90))); });
      if (f.kind === 'trail' && age < 0.07) { const n = 24; for (let k = 0; k <= n; k += 1) { const u = k / n; const sp = toScreen(f.x0 + (f.x1 - f.x0) * u, f.y0 + (f.y1 - f.y0) * u, f.z0 + (f.z1 - f.z0) * u); if (sp && u > 0.1) dot(sp[0], sp[1], sp[2], [255, 236, 160]); } }
    });
    // in the hand
    if (self && p.alive && !p.scoped) {
      const wid = cur(p); const sp = Math.hypot(p.vx, p.vy) / 3.6; const ph = g.bobT; const lo = lightAt(p.x, p.y);
      const raise = clamp((now - g.drawAt) / 0.32, 0, 1); const rl = now < p.reloadUntil ? 1 - (p.reloadUntil - now) / ARMS.W[wid].reload : -1;
      MODELS.view({ buf, W, H }, wid, g.knife, {
        kick: g.kick, bobX: Math.sin(ph) * 7 * sp + g.sway * 0.6, bobY: Math.abs(Math.cos(ph)) * 5 * sp + (p.z > 0 ? -6 : 0), sway: -g.sway, raise,
        inspect: g.inspect, swing: g.swing, heavy: g.heavySwing, side: g.swingSide || 1, drawT: wid === 'knife' ? clamp((now - g.drawAt) / 0.9, 0, 1) : -1, reload: rl, flash: g.flashFrame,
        shots: p.shotsAll || 0, cycle: now - p.lastShot, now, amb: [lm[lo], lm[lo + 1], lm[lo + 2]], team: p.team,
      });
      g.flashFrame = false;
    }
    // the scope: a ring of brass, dark outside, its crosshair
    if (self && p.scoped) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const r = Math.hypot(x - W / 2, y - H / 2); const o = y * W + x; if (r > H * 0.47) buf[o] = pack([6, 6, 8]); else if (r > H * 0.455) buf[o] = pack([176, 136, 56]); else if (Math.abs(x - W / 2) < 1 || Math.abs(y - H / 2) < 1) buf[o] = pack([16, 16, 16]); }
    // blinded, hurt, dead
    const fl = self && now < g.flashUntil ? clamp((g.flashUntil - now) / 1.2, 0, 1) : 0;
    if (fl > 0) for (let o = 0; o < W * H; o += 1) { const c = unpack(buf[o]); buf[o] = pack(c.map((v) => v + (255 - v) * fl)); }
    if (self && now - g.hurtAt < 0.4) { const k = 1 - (now - g.hurtAt) / 0.4; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 1) { const e = Math.max(Math.abs(x / W - 0.5), Math.abs(y / H - 0.5)) * 2; if (e > 0.7) { for (let yy = y; yy < Math.min(H, y + 2); yy += 1) { const o = yy * W + x; const c = unpack(buf[o]); const m = k * (e - 0.7) / 0.3; buf[o] = pack([c[0] + (210 - c[0]) * m * 0.7, c[1] * (1 - m * 0.6), c[2] * (1 - m * 0.6)]); } } } }
    if (!me.alive && self) for (let o = 0; o < W * H; o += 1) { const c = unpack(buf[o]); const m = (c[0] + c[1] + c[2]) / 3; buf[o] = pack([m * 0.8, m * 0.75, m * 0.7]); }
    ctx.putImageData(img, 0, 0);
    // the crosshair (its gap the spread), and the mark of a hit
    if (self && p.alive && !p.scoped && cur(p) !== 'knife') {
      const gap = 4 + spreadOf(p, ARMS.W[cur(p)]) * 3; const L = 8; ctx.fillStyle = 'rgba(0,0,0,.6)';
      [[gap, -1, L, 4], [-gap - L, -1, L, 4], [-1, gap, 4, L], [-1, -gap - L, 4, L]].forEach(([x, y, w, h]) => ctx.fillRect(W / 2 + x - 1, H / 2 + y - 1, w + 2 - 2, h - 2 + 2));
      ctx.fillStyle = '#8cff6e'; [[gap, 0, L, 2], [-gap - L, 0, L, 2], [0, gap, 2, L], [0, -gap - L, 2, L]].forEach(([x, y, w, h]) => ctx.fillRect(W / 2 + x - 1, H / 2 + y - 1, w, h));
    }
    if (now - g.hitMarkAt < 0.18) { ctx.strokeStyle = g.hitHead ? '#ff4a3a' : '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a2, b2]) => { ctx.moveTo(W / 2 + a2 * 6, H / 2 + b2 * 6); ctx.lineTo(W / 2 + a2 * 13, H / 2 + b2 * 13); }); ctx.stroke(); }
    if (self && g.hurtFrom !== null && g.hurtFrom !== undefined && now - g.hurtAt < 1) { const a2 = wrap(g.hurtFrom - p.a) - Math.PI / 2; ctx.fillStyle = `rgba(230,40,30,${1 - (now - g.hurtAt)})`; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(a2 + Math.PI / 2); ctx.beginPath(); ctx.moveTo(-14, -70); ctx.lineTo(14, -70); ctx.lineTo(0, -88); ctx.fill(); ctx.restore(); } // (where the hit came from)
    drawRadar();
  }
  /* The radar: the map painted once (walls with a lit edge, floors by kind, the sites), turned each frame
     with the one you watch facing up, a circle of about thirteen cells; the side's men, enemies some of
     them see, the keg; the sites' letters held at the rim when off it. */
  const RS = 8; let radarMap = null;
  function prepRadar() {
    const c = document.createElement('canvas'); c.width = MW * RS; c.height = MH * RS; const x = c.getContext('2d');
    const FLOORC = { a: '#8a6a3a', b: '#8a6a3a', d: '#3e5276', t: '#74403a' };
    for (let y = 0; y < MH; y += 1) for (let X = 0; X < MW; X += 1) { const ch = MAP[y][X]; const wall = WALLS[ch]; x.fillStyle = wall ? (ch === 'C' ? '#4a3420' : '#15120f') : FLOORC[ch] || RADAR_FLOOR[ch] || '#5c5852'; x.fillRect(X * RS, y * RS, RS, RS); if (PROPS[ch]) { x.fillStyle = '#4a3420'; x.fillRect(X * RS + 1, y * RS + 1, RS - 2, RS - 2); } if (ROOFS[ch]) { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(X * RS, y * RS, RS, RS); } }
    x.fillStyle = '#b8ac90'; for (let y = 0; y < MH; y += 1) for (let X = 0; X < MW; X += 1) { if (!WALLS[MAP[y][X]]) continue; [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => { if (wallAt(X + dx, y + dy)) return; x.fillRect(X * RS + (dx === 1 ? RS - 1 : 0), y * RS + (dy === 1 ? RS - 1 : 0), dx ? 1 : RS, dy ? 1 : RS); }); }
    radarMap = c;
  }
  function drawRadar() {
    const r = ui.radar; const c = r.getContext('2d'); const S = r.width; const half = S / 2; const k = half / (13 * RS); const v = camActor(); const an = -v.a - Math.PI / 2;
    if (!radarMap) prepRadar();
    c.clearRect(0, 0, S, S); c.save(); c.beginPath(); c.arc(half, half, half - 3, 0, 6.2832); c.clip(); c.fillStyle = '#0b0908'; c.fillRect(0, 0, S, S);
    c.translate(half, half); c.rotate(an); c.scale(k, k); c.translate(-v.x * RS, -v.y * RS); c.drawImage(radarMap, 0, 0);
    const dot = (x, y, col, rr, a) => { c.fillStyle = col; c.beginPath(); c.arc(x * RS, y * RS, rr / k, 0, 6.2832); c.fill(); if (a !== undefined) { c.strokeStyle = col; c.lineWidth = 2 / k; c.beginPath(); c.moveTo(x * RS, y * RS); c.lineTo(x * RS + Math.cos(a) * 9 / k, y * RS + Math.sin(a) * 9 / k); c.stroke(); } };
    g.smokes.forEach((sm) => { c.fillStyle = 'rgba(200,200,205,.45)'; c.beginPath(); c.arc(sm.x * RS, sm.y * RS, sm.r * RS, 0, 6.2832); c.fill(); });
    const me = g.player; const spotted = (a) => g.actors.some((m) => m.alive && m.team === me.team && sees(m, a));
    g.actors.forEach((a) => { if (a === v) return; const mine = a.team === me.team;
      if (!a.alive) { if (mine) { c.strokeStyle = '#6a7aa0'; c.lineWidth = 1.5 / k; const s2 = 3 / k; c.beginPath(); c.moveTo(a.x * RS - s2, a.y * RS - s2); c.lineTo(a.x * RS + s2, a.y * RS + s2); c.moveTo(a.x * RS + s2, a.y * RS - s2); c.lineTo(a.x * RS - s2, a.y * RS + s2); c.stroke(); } return; }
      if (mine) dot(a.x, a.y, a === me ? '#ffffff' : '#6aa0ff', 3.5, a.a); else if (spotted(a)) dot(a.x, a.y, '#ff4a3a', 3.8); });
    if (g.keg.planted || g.keg.dropped || (g.keg.carrier && g.keg.carrier.team === me.team)) { const kx = g.keg.carrier ? g.keg.carrier.x : g.keg.x; const ky = g.keg.carrier ? g.keg.carrier.y : g.keg.y; c.fillStyle = g.keg.planted && Math.floor(g.now * 4) % 2 ? '#ff5020' : '#ffb040'; c.fillRect(kx * RS - 3 / k, ky * RS - 3 / k, 6 / k, 6 / k); }
    c.restore();
    c.font = 'bold 15px "EB Garamond", Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    g.sites.forEach((st) => { const dx = (st.c[0] - v.x) * RS * k; const dy = (st.c[1] - v.y) * RS * k; let X = dx * Math.cos(an) - dy * Math.sin(an); let Y = dx * Math.sin(an) + dy * Math.cos(an); const d = Math.hypot(X, Y); const m = half - 14; if (d > m) { X *= m / d; Y *= m / d; }
      c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(half + X, half + Y, 9, 0, 6.2832); c.fill(); c.fillStyle = '#ffd86a'; c.fillText(st.name, half + X, half + Y + 1); });
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(half, half - 7); c.lineTo(half + 5, half + 5); c.lineTo(half, half + 2); c.lineTo(half - 5, half + 5); c.fill(); // (you, or whom you watch, facing up)
    c.strokeStyle = '#b08a3a'; c.lineWidth = 3; c.beginPath(); c.arc(half, half, half - 2, 0, 6.2832); c.stroke();
    c.fillStyle = '#d8c8a0'; c.font = '10px sans-serif'; c.fillText('N', half + Math.cos(an - Math.PI / 2) * (half - 9), half + Math.sin(an - Math.PI / 2) * (half - 9));
  }

  /* ---- the interface laid over the picture, at its size (the page's own, crisp): the score and the men
     of each side, the clock; health and armour; money (and what it just gained or lost); the weapon and
     its rounds; the slots; the feed of the fallen with each weapon's drawing; the round's end; planting
     and defusing; whom you watch when fallen ---- */
  function build() {
    root = document.createElement('div'); root.className = 'siege';
    root.innerHTML = `<div class="sg-stage"><canvas width="${W}" height="${H}"></canvas><canvas class="sg-radar" width="200" height="200"></canvas>
<div class="sg-top"><div class="sg-side sg-l"><span class="sg-pips"></span><b class="sg-sc"></b></div><div class="sg-clock"><span class="sg-time"></span><small class="sg-round"></small></div><div class="sg-side sg-r"><b class="sg-sc"></b><span class="sg-pips"></span></div></div>
<div class="sg-money"><span class="sg-cash"></span><span class="sg-delta"></span></div>
<div class="sg-feed"></div><div class="sg-msg"></div><div class="sg-banner" hidden></div><div class="sg-prog" hidden><span></span><i></i></div><div class="sg-spec" hidden></div>
<div class="sg-vit"><div class="sg-hp"><i class="sg-i-hp"></i><b></b><span class="sg-bar"><i></i></span></div><div class="sg-ar"><i class="sg-i-ar"></i><b></b><span class="sg-bar"><i></i></span></div><div class="sg-kegc" hidden>✹ the keg</div></div>
<div class="sg-slots"></div><div class="sg-ammo"><div class="sg-wname"></div><div class="sg-rounds"><b class="sg-mag"></b><span class="sg-res"></span></div><div class="sg-ticks"></div></div>
<div class="sg-menu" hidden></div><div class="sg-help">Click: take the mouse · WASD/ZQSD move · Shift walk · Ctrl crouch · Space jump · R reload · 1 2 3 4 weapons · G throw · E plant/defuse · B buy · F inspect · Tab scores · K knife · Esc pause</div></div>`;
    document.body.append(root);
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d'); img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W);
    const q = (sel) => root.querySelector(sel);
    ui = { radar: q('.sg-radar'), time: q('.sg-time'), round: q('.sg-round'), sides: [...root.querySelectorAll('.sg-side')], cash: q('.sg-cash'), delta: q('.sg-delta'), feed: q('.sg-feed'), msg: q('.sg-msg'), banner: q('.sg-banner'), prog: q('.sg-prog'), spec: q('.sg-spec'),
      hp: q('.sg-hp'), ar: q('.sg-ar'), kegc: q('.sg-kegc'), slots: q('.sg-slots'), ammo: q('.sg-ammo'), wname: q('.sg-wname'), mag: q('.sg-mag'), res: q('.sg-res'), ticks: q('.sg-ticks'), menu: q('.sg-menu'), help: q('.sg-help') };
    hudKey = {};
  }
  const MODEL_OF = { he: 'firepot', smoke: 'incense', flash: 'vial', fire: 'flask', keg: 'firepot' };
  const iconURLs = {}; const iconURL = (id) => { const key = id === 'knife' ? `knife:${g.knife.name}` : id; return (iconURLs[key] ||= icon(MODEL_OF[id] || id, 96, 30, g.knife).toDataURL()); };
  let hudKey = {}; const setIf = (k, v, f) => { if (hudKey[k] !== v) { hudKey[k] = v; f(v); } };
  function hud() {
    if (!g) return; const p = g.player; const mine = p.team; const other = mine === 'def' ? 'att' : 'def'; const now = g.now;
    const left = Math.max(0, g.phase === 'planted' ? g.keg.until - now : g.phaseUntil - now); const mm = Math.floor(left / 60); const ss = String(Math.floor(left % 60)).padStart(2, '0');
    setIf('time', g.phase === 'planted' ? `✹ ${Math.ceil(left)}` : g.phase === 'buy' ? `${mm}:${ss}` : `${mm}:${ss}`, (v) => { ui.time.textContent = v; });
    ui.time.classList.toggle('sg-red', g.phase === 'planted' || (g.phase === 'live' && left < 10)); ui.time.classList.toggle('sg-buyt', g.phase === 'buy');
    setIf('round', g.phase === 'buy' ? `round ${g.round} · buy` : `round ${g.round}`, (v) => { ui.round.textContent = v; });
    [mine, other].forEach((team, k) => { const el = ui.sides[k]; const pips = g.actors.filter((a) => a.team === team).map((a) => `<i class="${a.alive ? '' : 'dead'}${a === p ? ' me' : ''}"></i>`).join('');
      setIf(`side${k}`, `${team}|${g.score[team]}|${pips}`, () => { el.className = `sg-side ${k ? 'sg-r' : 'sg-l'} sg-${team}`; el.querySelector('.sg-sc').textContent = g.score[team]; el.querySelector('.sg-pips').innerHTML = pips; el.title = team === 'def' ? 'Defenders' : 'Attackers'; }); });
    if (g.cashShown !== p.money) { const d = p.money - (g.cashShown ?? p.money); if (d && g.cashShown !== undefined) { ui.delta.textContent = `${d > 0 ? '+' : '−'}${Math.abs(d)}`; ui.delta.className = `sg-delta ${d > 0 ? 'up' : 'down'}`; ui.delta.getAnimations().forEach((an) => an.cancel()); ui.delta.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'translateY(-10px)' }], 1800); } g.cashShown = p.money; ui.cash.textContent = `${p.money} crowns`; }
    setIf('hp', `${Math.ceil(p.hp)}`, (v) => { ui.hp.querySelector('b').textContent = v; ui.hp.querySelector('.sg-bar i').style.width = `${v}%`; ui.hp.classList.toggle('low', p.hp <= 25); });
    setIf('ar', `${Math.ceil(p.armour)}|${p.helm}`, () => { ui.ar.querySelector('b').textContent = Math.ceil(p.armour); ui.ar.querySelector('.sg-bar i').style.width = `${Math.ceil(p.armour)}%`; ui.ar.classList.toggle('helm', p.helm); ui.ar.title = p.helm ? 'Gambeson and helm' : 'Gambeson'; });
    ui.kegc.hidden = g.keg.carrier !== p;
    const wid = cur(p); const w = ARMS.W[wid]; const am = p.ammo[wid]; const rel = now < p.reloadUntil;
    setIf('ammo', `${wid}|${am ? am.mag : ''}|${am ? am.res : ''}|${rel}|${g.knife.name}|${p.alive}`, () => {
      ui.ammo.hidden = !p.alive; ui.wname.textContent = wid === 'knife' ? g.knife.name : w.name; ui.ammo.classList.toggle('rel', rel);
      ui.mag.textContent = am && w.mag ? am.mag : ''; ui.res.textContent = am && w.mag ? `/ ${am.res}` : '';
      ui.ticks.innerHTML = am && w.mag ? Array.from({ length: Math.min(w.mag, 30) }, (_, k) => `<i class="${k < Math.round((am.mag / w.mag) * Math.min(w.mag, 30)) ? '' : 'out'}"></i>`).join('') : ''; ui.mag.classList.toggle('low', am && w.mag && am.mag <= w.mag * 0.2); });
    const slotRow = (n, id, label) => `<p class="${p.slot === n || (n === 4 && g.nade && label) ? 'on' : ''}"><kbd>${n}</kbd>${id ? `<img src="${iconURL(id)}" alt="">` : ''}<span>${label}</span></p>`;
    const nades = ['he', 'flash', 'smoke', 'fire'].filter((k) => p.gear[k]);
    setIf('slots', `${JSON.stringify(p.weapons)}|${p.slot}|${nades.map((k) => k + p.gear[k]).join()}|${g.knife.name}|${g.nade}`, () => {
      ui.slots.innerHTML = [1, 2, 3].filter((n) => p.weapons[n]).map((n) => slotRow(n, p.weapons[n], n === 3 ? g.knife.shape.name : ARMS.W[p.weapons[n]].name)).join('')
        + (nades.length ? `<p class="${g.nade ? 'on' : ''}"><kbd>4</kbd>${nades.map((k) => `<img class="sm" src="${iconURL(k)}" alt="" title="${k}">${p.gear[k] > 1 ? `×${p.gear[k]}` : ''}`).join('')}</p>` : '');
      g.slotAt = now; });
    ui.slots.classList.toggle('show', now - (g.slotAt || -9) < 2.5 || g.phase === 'buy'); ui.slots.hidden = !p.alive; root.querySelector('.sg-vit').hidden = !p.alive;
    const feed = g.feed.filter((f) => now - f.t < 7);
    setIf('feed', feed.map((f) => f.t).join(), () => { ui.feed.innerHTML = feed.map((f) => `<p class="${f.by === p.name || f.who === p.name ? 'me' : ''}"><span class="sg-${f.byTeam}">${f.by || ''}</span><img src="${iconURL(f.w)}" alt="${f.w}">${f.head ? '<i class="sg-hs" title="to the head"></i>' : ''}<span class="sg-${f.team}">${f.who}</span></p>`).join(''); });
    setIf('msg', now < g.msgUntil ? g.msg : '', (v) => { ui.msg.textContent = v; ui.msg.hidden = !v; });
    const bn = g.banner && now - g.banner.t < 4.5 ? g.banner : null;
    setIf('banner', bn ? bn.t : '', () => { ui.banner.hidden = !bn; if (bn) { ui.banner.className = `sg-banner sg-${bn.team}${bn.mine ? ' won' : ''}`; ui.banner.innerHTML = `<b>${bn.text}</b><span>${bn.sub}</span>`; } });
    const k = g.keg; const pr = k.plantP > 0 && !k.planted && k.carrier === p ? ['Planting the keg', k.plantP] : k.defuseP > 0 && k.defuser === p ? [p.tools ? 'Defusing (with tools)' : 'Defusing', k.defuseP] : null;
    setIf('prog', pr ? `${pr[0]}|${Math.round(pr[1] * 100)}` : '', () => { ui.prog.hidden = !pr; if (pr) { ui.prog.querySelector('span').textContent = pr[0]; ui.prog.querySelector('i').style.width = `${Math.round(pr[1] * 100)}%`; } });
    const v = camActor(); setIf('spec', v !== p ? v.name : '', (n) => { ui.spec.hidden = !n; ui.spec.innerHTML = n ? `Watching <b>${n}</b> · click: another` : ''; });
  }
  /* ---- menus: buy (B, in the buying time), scores (Tab), pause (Esc), the knife's forge (K) ---- */
  function openMenu(html, cls) { ui.menu.innerHTML = html; ui.menu.className = `sg-menu ${cls}`; ui.menu.hidden = false; if (document.pointerLockElement) document.exitPointerLock(); }
  function closeMenu() { ui.menu.hidden = true; }
  const closeBuy = () => { if (ui.menu && ui.menu.classList.contains('sg-buy')) closeMenu(); };
  /* The buying menu: a tab per shelf (the number keys pick a tab, then an item), a card per piece with its
     drawing, price and bars; owned and unaffordable pieces marked; R buys again what was bought last round. */
  const icon = (id, w, h, kn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h); new Uint32Array(im.data.buffer).set(MODELS.icon(id, w, h, kn).buf); x.putImageData(im, 0, 0); return c; };
  const TABS = () => [...ARMS.SHELVES.map(([n, ids]) => [n, ids.map((id) => ['w', id])]), ['Throwables', ['firepot', 'incense', 'vial', 'flask'].map((id) => ['g', id])], ['Gear', ['gambeson', 'helm', 'tools'].map((id) => ['g', id])]];
  function owns(p, kind, id) {
    if (kind === 'w') return Object.values(p.weapons).includes(id); const o = ARMS.GEAR[id];
    if (o.armour) return p.armour >= 100 && (p.helm || !o.helm); if (o.tools) return p.tools; return (p.gear[o.kind] || 0) >= o.max;
  }
  function purchase(kind, id) {
    const p = g.player; const o = kind === 'w' ? ARMS.W[id] : ARMS.GEAR[id]; if (p.money < o.price || owns(p, kind, id)) return false;
    if (kind === 'w') give(p, id);
    else if (o.armour) { p.armour = 100; if (o.helm) p.helm = true; }
    else if (o.tools) { if (p.team !== 'def') return false; p.tools = true; }
    else p.gear[o.kind] = (p.gear[o.kind] || 0) + 1;
    p.money -= o.price; sfx('buy'); (g.bought ||= []).push([kind, id]); return true;
  }
  function buyMenu(tab = g.buyTab || 0) {
    if (g.phase !== 'buy' && !(g.phase === 'live' && g.now < g.phaseUntil - ROUND_S + 15)) { say('The buying time is over.', 2); return; }
    const p = g.player; const tabs = TABS(); g.buyTab = tab = clamp(tab, 0, tabs.length - 1);
    const bar = (v) => `<i style="--v:${Math.round(clamp(v, 0, 1) * 100)}%"></i>`;
    const cards = tabs[tab][1].map(([kind, id], k) => { const o = kind === 'w' ? ARMS.W[id] : ARMS.GEAR[id]; const have = owns(p, kind, id); const poor = p.money < o.price; const no = kind === 'g' && o.tools && p.team !== 'def';
      const st = kind === 'w' ? Object.entries(ARMS.STATS(o)).map(([n, v]) => `<li><span>${n}</span>${bar(v)}</li>`).join('') : `<li class="dim">${o.kind ? `up to ${o.max}` : o.helm ? 'stops headshots' : o.armour ? 'halves the damage' : 'defenders only'}</li>`;
      return `<button class="sg-card${have ? ' own' : ''}" data-buy="${kind}:${id}" ${poor || have || no ? 'disabled' : ''}><kbd>${k + 1}</kbd><span class="sg-ic" data-ic="${id}"></span><b>${o.name}</b><em>${have ? 'owned' : `${o.price}`}</em><ul>${st}</ul></button>`; }).join('');
    openMenu(`<h3>Buy <span class="sg-purse">${p.money} crowns</span></h3><nav class="sg-tabs">${tabs.map(([n], k) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}"><kbd>${k + 1}</kbd> ${n}</button>`).join('')}</nav>
<div class="sg-cards">${cards}</div><p class="dim"><button class="sg-rebuy" data-act="rebuy" ${g.lastBought && g.lastBought.length ? '' : 'disabled'}>R · buy again last round's</button> Shift+number: a tab; number: buy · B or Esc to close.</p>`, 'sg-buy');
    ui.menu.querySelectorAll('[data-ic]').forEach((el) => el.append(icon(el.dataset.ic, 150, 60, g.knife)));
    ui.menu.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => buyMenu(Number(b.dataset.tab))));
    ui.menu.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => { const [kind, id] = b.dataset.buy.split(':'); if (purchase(kind, id)) buyMenu(tab); }));
    ui.menu.querySelector('[data-act="rebuy"]').addEventListener('click', () => rebuy());
  }
  function rebuy() { (g.lastBought || []).forEach(([kind, id]) => purchase(kind, id)); if (!ui.menu.hidden && ui.menu.classList.contains('sg-buy')) buyMenu(); }
  /** Number keys while buying: Shift+n a tab, n the tab's n-th item; R buys again. True when the key was used. */
  function buyKey(e) {
    if (ui.menu.hidden || !ui.menu.classList.contains('sg-buy')) return false;
    if (e.code === 'KeyR') { rebuy(); return true; }
    const m = /^Digit([1-9])$/.exec(e.code); if (!m) return false; const n = Number(m[1]) - 1;
    if (e.shiftKey) { buyMenu(n); return true; }
    const it = TABS()[g.buyTab || 0][1][n]; if (it && purchase(...it)) buyMenu(); return true;
  }
  function scores(on) {
    if (!on) { if (ui.menu.classList.contains('sg-scores')) closeMenu(); return; }
    const rows = (team) => g.actors.filter((a) => a.team === team).sort((a, b) => b.kills - a.kills).map((a) => `<tr class="${a.alive ? '' : 'dim'}"><td>${a.name}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.money}</td></tr>`).join('');
    openMenu(`<h3>Round ${g.round} · defenders ${g.score.def}, attackers ${g.score.att}</h3><table><tr><th>Defenders</th><th>kills</th><th>deaths</th><th>crowns</th></tr>${rows('def')}<tr><th>Attackers</th><th></th><th></th><th></th></tr>${rows('att')}</table>`, 'sg-scores');
  }
  function pauseMenu() {
    g.paused = true;
    openMenu(`<h3>Siege, paused</h3><button data-act="resume">Resume</button><button data-act="knife">The knife's forge</button><button data-act="diff">Bots: ${g.difficulty}</button>
<div class="sg-set"><span>Mouse</span><button data-act="sens-">−</button><b>${(settings.sens * 1000).toFixed(2)}</b><button data-act="sens+">+</button></div>
<div class="sg-set"><span>Field of view</span><button data-act="fov-">−</button><b>${Math.round(settings.fov * 180 / Math.PI)}°</b><button data-act="fov+">+</button></div>
<button data-act="quality">Picture: ${W} × ${H}</button>
<button data-act="invert">Look: ${settings.invert ? 'inverted' : 'normal'}</button><button data-act="again">A new match</button><button data-act="leave">Leave (back to the castle)</button>`, 'sg-pause');
    ui.menu.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'resume') { g.paused = false; closeMenu(); cv.requestPointerLock?.(); }
      if (act === 'knife') forge();
      if (act === 'sens-' || act === 'sens+') { settings.sens = clamp(settings.sens * (act === 'sens+' ? 1.15 : 1 / 1.15), 0.0002, 0.006); saveSettings(); pauseMenu(); }
      if (act === 'fov-' || act === 'fov+') { settings.fov = clamp(settings.fov + (act === 'fov+' ? 0.08 : -0.08), 1.1, 2); saveSettings(); pauseMenu(); }
      if (act === 'quality') { settings.quality = ((settings.quality ?? 1) + 1) % QUALITY.length; saveSettings(); [W, H] = QUALITY[settings.quality]; cv.width = W; cv.height = H; img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W); pauseMenu(); }
      if (act === 'invert') { settings.invert = !settings.invert; saveSettings(); pauseMenu(); }
      if (act === 'diff') { g.difficulty = { easy: 'normal', normal: 'hard', hard: 'easy' }[g.difficulty]; store('siege-diff', g.difficulty); pauseMenu(); }
      if (act === 'again') { const o = g.opts; stop(); start(o); }
      if (act === 'leave') { const o = g.opts; stop(); if (o.onLeave) o.onLeave(); }
    }));
  }
  function forge() { // the knife: its shape, its finish, a new one at random; drawn as it is held
    g.paused = true; const k = g.knifeRecipe;
    openMenu(`<h3>The knife's forge</h3><span class="sg-knife"></span><p class="sg-kname"></p>
<div class="sg-cols"><div><h4>Shape</h4>${Object.entries(ARMS.SHAPES).map(([id, s]) => `<button data-shape="${id}" ${k.shape === id ? 'class="on"' : ''}>${s.name}</button>`).join('')}</div>
<div><h4>Finish</h4>${Object.entries(ARMS.FINISHES).map(([id, f]) => `<button data-finish="${id}" ${k.finish === id ? 'class="on"' : ''}>${f.name}</button>`).join('')}</div></div>
<button data-act="roll">Forge one at random</button> <button data-act="back">Back</button>`, 'sg-forge');
    const show = () => { const kn = ARMS.knife(g.knifeRecipe); g.knife = kn; store('siege-knife', g.knifeRecipe); ui.menu.querySelector('.sg-knife').replaceChildren(icon('knife', 360, 110, kn));
      ui.menu.querySelector('.sg-kname').textContent = `${kn.name} · ${kn.wearName} (${kn.wear.toFixed(3)}) · pattern ${kn.seed}`; };
    ui.menu.querySelectorAll('[data-shape],[data-finish]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.shape) g.knifeRecipe.shape = b.dataset.shape; else g.knifeRecipe.finish = b.dataset.finish; forge(); }));
    ui.menu.querySelector('[data-act="roll"]').addEventListener('click', () => { g.knifeRecipe = ARMS.randomKnife(); forge(); });
    ui.menu.querySelector('[data-act="back"]').addEventListener('click', () => pauseMenu());
    show();
  }

  /* ---- input ---- */
  const H_ = {};
  function bind() {
    H_.key = (e) => {
      if (!g) return; if (e.code === 'Escape') { e.preventDefault(); if (!ui.menu.hidden && !ui.menu.classList.contains('sg-pause')) { closeMenu(); g.paused = false; } else if (g.paused) { g.paused = false; closeMenu(); } else pauseMenu(); return; }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      e.stopImmediatePropagation(); keys.add(e.code); const p = g.player;
      if (buyKey(e)) return;
      if (e.code === 'Tab') scores(true);
      if (e.code === 'KeyB') { if (ui.menu.classList.contains('sg-buy') && !ui.menu.hidden) closeMenu(); else buyMenu(); }
      if (e.code === 'KeyR') reload(p);
      if (e.code === 'KeyF') { g.inspect = 0; if (cur(p) === 'knife') sfx('swish'); }
      if (e.code === 'KeyK') forge();
      if (/^Digit[1-4]$/.test(e.code)) { const s = Number(e.code.slice(5)); if (s === 4) { g.nadeIx = ((g.nadeIx ?? -1) + 1) % 4; const order = ['he', 'flash', 'smoke', 'fire']; for (let k = 0; k < 4; k += 1) { const n = order[(g.nadeIx + k) % 4]; if (p.gear[n]) { g.nade = n; say(`Ready: ${n}. G throws it.`, 1.5); break; } } } else if (p.weapons[s] && p.slot !== s) { p.slot = s; p.scoped = false; g.inspect = -1; g.drawAt = g.now; g.slotAt = g.now; p.reloadUntil = 0; p.reloadId = null; sfx('draw'); } }
      if (e.code === 'KeyG') { const n = g.nade || ['he', 'flash', 'smoke', 'fire'].find((q) => p.gear[q]); if (n) throwIt(p, n); }
    };
    H_.up = (e) => { keys.delete(e.code); if (e.code === 'Tab') scores(false); };
    H_.mouse = (e) => { if (!g || document.pointerLockElement !== cv || g.paused) return; const k = settings.sens * (g.player.scoped ? 0.3 : 1); g.player.a += e.movementX * k; g.pitch = clamp(g.pitch - e.movementY * k * (settings.invert ? -1 : 1), -0.7, 0.7); g.sway = clamp(g.sway + e.movementX * 0.06, -14, 14); };
    H_.down = (e) => {
      if (!g || !root.contains(e.target) || e.target.closest('.sg-menu')) return;
      if (document.pointerLockElement !== cv) { cv.requestPointerLock?.(); if (!audio) audioOn(); return; }
      if (!g.player.alive) { g.specIdx = (g.specIdx || 0) + 1; return; } // (fallen: watch another)
      mouseDown[e.button] = true;
      if (e.button === 2) { const w = ARMS.W[cur(g.player)]; if (w.scoped) { g.player.scoped = !g.player.scoped; sfx('click'); } else if (w.melee) shoot(g.player); }
    };
    H_.mup = (e) => { mouseDown[e.button] = false; };
    H_.ctx = (e) => { if (root && root.contains(e.target)) e.preventDefault(); };
    H_.lock = () => { if (g && document.pointerLockElement !== cv && !g.paused && ui.menu.hidden) pauseMenu(); }; // (the browser lets go of the mouse on Esc: pause)
    addEventListener('keydown', H_.key, true); addEventListener('keyup', H_.up, true); addEventListener('mousemove', H_.mouse); addEventListener('mousedown', H_.down); addEventListener('mouseup', H_.mup); addEventListener('contextmenu', H_.ctx); document.addEventListener('pointerlockchange', H_.lock);
  }
  function unbind() { removeEventListener('keydown', H_.key, true); removeEventListener('keyup', H_.up, true); removeEventListener('mousemove', H_.mouse); removeEventListener('mousedown', H_.down); removeEventListener('mouseup', H_.mup); removeEventListener('contextmenu', H_.ctx); document.removeEventListener('pointerlockchange', H_.lock); keys.clear(); }

  /* ---- sound: made here (WebAudio), placed by where it comes from, fainter far off ---- */
  let audio = null; let noiseBuf = null;
  function audioOn() { try { audio = new AudioContext(); noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1; } catch { audio = null; } }
  function sfx(kind, from, wid) {
    if (!audio || !g) return; const p = g.player; let pan = 0; let vol = 1;
    if (from && from !== p) { const d = Math.hypot(from.x - p.x, from.y - p.y); vol = 1 / (1 + d * 0.35); pan = clamp(Math.sin(wrap(Math.atan2(from.y - p.y, from.x - p.x) - p.a)), -1, 1); }
    const t = audio.currentTime; const out = audio.createStereoPanner(); out.pan.value = pan; out.connect(audio.destination);
    const nz = (f, dur, v, type = 'bandpass') => { const s = audio.createBufferSource(); s.buffer = noiseBuf; const fl = audio.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const gn = audio.createGain(); gn.gain.setValueAtTime(v * vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(gn).connect(out); s.start(t); s.stop(t + dur); };
    const tn = (f0, f1, dur, v, type = 'sine') => { const o = audio.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); const gn = audio.createGain(); gn.gain.setValueAtTime(v * vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(gn).connect(out); o.start(t); o.stop(t + dur); };
    ({
      shot: () => { const big = ['arquebus', 'caliver', 'greatbow', 'blunderbuss'].includes(wid); nz(big ? 900 : 1600, big ? 0.35 : 0.2, 0.5); tn(big ? 120 : 200, 40, 0.25, 0.4); },
      reload: () => { nz(3000, 0.05, 0.2, 'highpass'); setTimeout(() => sfx('click', from), 600); },
      hit: () => tn(1900, 1700, 0.05, 0.1, 'square'), // (the mark of a hit)
      click: () => nz(4000, 0.03, 0.15, 'highpass'), draw: () => nz(2500, 0.08, 0.12), buy: () => tn(880, 1320, 0.12, 0.08),
      swish: () => nz(1800, 0.18, 0.18), stab: () => { nz(600, 0.12, 0.3, 'lowpass'); tn(160, 80, 0.12, 0.2); },
      step: () => nz(300, 0.08, 0.12, 'lowpass'), tink: () => tn(3200, 2900, 0.25, 0.2), thud: () => tn(140, 60, 0.15, 0.3),
      throw: () => nz(1200, 0.15, 0.12), boom: () => { nz(150, 0.9, 0.9, 'lowpass'); tn(80, 30, 0.8, 0.6); }, bigboom: () => { nz(90, 2.2, 1, 'lowpass'); tn(60, 20, 2, 0.8); },
      hiss: () => nz(5000, 2.5, 0.12, 'highpass'), whoosh: () => nz(700, 1, 0.3), flash: () => { tn(4200, 3800, 1.5, 0.15); nz(2000, 0.1, 0.4); },
      beep: () => tn(1400, 1400, 0.09, 0.2, 'square'), planted: () => [0, 0.15, 0.3].forEach((d) => setTimeout(() => tn(1000, 1000, 0.1, 0.2, 'square'), d * 1000)),
      win: () => [523, 659, 784].forEach((f, k) => setTimeout(() => tn(f, f, 0.4, 0.15, 'triangle'), k * 160)), lose: () => [392, 330, 262].forEach((f, k) => setTimeout(() => tn(f, f, 0.45, 0.15, 'triangle'), k * 180)),
    }[kind] || (() => {}))();
  }

  window.Siege = { start, stop, state: () => g && { phase: g.phase, round: g.round, score: { ...g.score }, alive: g.actors.filter((a) => a.alive).length, player: { hp: g.player.hp, x: g.player.x, y: g.player.y, money: g.player.money } }, debug: () => g, sim: (sec) => { for (let k = 0; k < sec * 60 && g; k += 1) { g.now += 1 / 60; update(1 / 60); } } }; // (sim: the game run ahead without drawing, for the tests)
}());
