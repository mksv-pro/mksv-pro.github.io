'use strict';

/* The hours theme's plate: a pixel-art landscape under the sky over Paris at the true hour. A
   castle on a rock above a lake, mountains, a forest edge; in front, a knight resting at a bonfire
   and a wizard who holds the menu (the .tabs box is placed over his hat through --wiz-x/--wiz-y).
   Loaded by ui/01-core.js with the theme: window.Hours.start({ plate, sky, reduceMotion }), then
   update() once a minute.

   The scene is generated once per size (seeded: every visit sees the same place) as seven planes
   of palette indices, sky to foreground, each a little wider than the screen; the pointer slides
   them by amounts that grow with nearness (parallax), the meadow sheared from the hill's rate at
   its top to the foreground's at the bottom so the path never breaks. The palette follows the
   sun's altitude (keyframes below, interpolated), so the same pixels pass from noon to night.
   Fine detail is kept for the near planes and thins out with distance, as in landscape painting.
   Per frame, on top: stars, sun, moon, clouds, birds, a dragon now and then, the castle's life
   (windows, pennants, torches, sentries, chimney smoke), the lake's reflection, butterflies or
   fireflies, the characters, the fire (smoothed cellular automaton), embers, wind in the tall
   grass, firelight. */

(function () {
  const REAL_BASE = new URL('../../data/real/', document.currentScript.src); // (things from the real world: see realGet)
  let FPS_MS = 83; // ~12 frames a second: pixel fire looks right at that rate (halved on a slow machine, see frame)
  let renderMs = 0; let lite = false;
  const deg = Math.PI / 180;
  const PARALLAX = 7; // scene px the nearest plane moves, pointer at an edge
  const MARGIN = 9; // each plane overhangs the screen by this much on both sides

  // planes, back to front, and their parallax rates (GROUND is sheared: see groundOff)
  const L = { SKY: 0, FAR: 1, NEAR: 2, TREES: 3, MID: 4, GROUND: 5, FG: 6 };
  const RATE = [0, 0.1, 0.2, 0.3, 0.45, 0.45, 1.15];
  const GROUND_END = 0.9; // the meadow's rate at the bottom edge
  const CLEAR = 255; // transparent in a plane

  /* ---- palette -------------------------------------------------------- */

  // [name, daylight colour, aerial-perspective depth (0 near, 1 = the horizon's colour)]
  const SURFACES = [
    ['CLOUD', '#f6f9fb', 0], ['CLOUD_SH', '#bfd3e3', 0],
    ['MT_FAR', '#8aa0b6', 0.5], ['MT_FAR_SH', '#667c96', 0.5], ['SNOW', '#f2f6fa', 0.35], ['SNOW_SH', '#b4c4d6', 0.35],
    ['MT_NEAR', '#5f8486', 0.3], ['MT_NEAR_SH', '#46656c', 0.3],
    ['TREES_FAR', '#3d6a58', 0.25], ['TREES_FAR_SH', '#2c5446', 0.25],
    ['HILL', '#5a9a4e', 0.1], ['HILL_SH', '#3c7444', 0.1], ['HILL_HI', '#7db55e', 0.1],
    ['ROCK_HI', '#c2b8a4', 0.1], ['ROCK', '#968c7c', 0.1], ['ROCK_SH', '#6a6258', 0.1], ['ROCK_DK', '#443e38', 0.1],
    ['WALL_HI', '#e2cfb6', 0.1], ['WALL', '#bba28c', 0.1], ['WALL_SH', '#8c7666', 0.1], ['WALL_DK', '#5a4a46', 0.1],
    ['ROOF_HI', '#cc5c58', 0.1], ['ROOF', '#a3404a', 0.1], ['ROOF_SH', '#702c3a', 0.1],
    ['SLATE_HI', '#7e90b8', 0.1], ['SLATE', '#55618a', 0.1], ['SLATE_SH', '#3a4262', 0.1],
    ['DOME_HI', '#8fd0b8', 0.1], ['DOME', '#5aa08a', 0.1], ['DOME_SH', '#3a6e62', 0.1],
    ['TIMBER_HI', '#b0885a', 0.1], ['TIMBER', '#7e5a38', 0.1], ['TIMBER_SH', '#553a24', 0.1],
    ['WIN_DARK', '#2e2836', 0.1], ['WIN_LIT', '#2e2836', 0.1],
    ['BANNER', '#b82a2a', 0.1], ['BANNER_SH', '#7a1a22', 0.1], ['BANNER_GOLD', '#e8b840', 0.1],
    ['IVY', '#4f8a3e', 0.1], ['IVY_SH', '#36622e', 0.1],
    ['FLAG', '#c8302a', 0.1], ['FLAG2', '#2f50b0', 0.1], ['FLAG3', '#e8b840', 0.1],
    ['GUARD', '#3a3a50', 0.1], ['GUARD_HI', '#8a3030', 0.1],
    ['WATER', '#3c6a8a', 0], ['WATER_HI', '#6a9ab0', 0], ['MUD', '#5a4a3a', 0], ['REED', '#6a8a3a', 0], ['REED_SH', '#45602a', 0],
    ['PATH_HI', '#e2c39a', 0.02], ['PATH', '#cfa77e', 0.02], ['PATH_SH', '#a5805e', 0.02],
    ['PINE', '#2f6650', 0.06], ['PINE_SH', '#1f4a3e', 0.06], ['PINE_HI', '#46845e', 0.06],
    ['BUSH', '#3f7a3a', 0], ['BUSH_SH', '#2c5a2c', 0], ['BUSH_HI', '#5e9a48', 0],
    ['GRASS', '#467a3e', 0], ['GRASS_SH', '#335f34', 0], ['GRASS_HI', '#629548', 0], ['GRASS_LT', '#86b856', 0],
    ['FL_RED', '#e04848', 0], ['FL_YEL', '#f2d24a', 0], ['FL_WHITE', '#f4f0e8', 0], ['FL_BLUE', '#7a96f0', 0],
    ['FL_VIOLET', '#a070d0', 0],
    ['MOSS', '#6a9a3a', 0], ['MOSS_HI', '#9ac050', 0],
    ['CAP', '#d03a30', 0], ['CAP_SH', '#8a2228', 0], ['CAP_BR', '#9a6a3e', 0], ['STEM', '#f0e6d0', 0],
    ['FERN', '#4e8c3a', 0], ['FERN_SH', '#33602a', 0],
    ['DIRT', '#7a5c44', 0], ['DIRT_SH', '#5a4232', 0],
    ['STONE_HI', '#b4b2b8', 0], ['STONE', '#8c8a90', 0], ['STONE_SH', '#5e5c68', 0],
    ['BLADE', '#d0d4dc', 0], ['BLADE_SH', '#828896', 0], ['HILT', '#6a4a2a', 0],
    ['FG_PINE_HI', '#2a4e40', 0], ['FG_PINE', '#1c3b33', 0], ['FG_PINE_SH', '#122a26', 0],
    ['OUTLINE', '#16121c', 0], ['CREAM', '#fff6dc', 0],
    // heraldic tinctures (_tools/arms.txt letters O A G B V S)
    ['T_OR', '#e8b840', 0], ['T_ARGENT', '#f0f0f0', 0], ['T_GULES', '#c0302a', 0], ['T_AZURE', '#2f50b0', 0],
    ['T_VERT', '#2f7a3a', 0], ['T_SABLE', '#1e1e26', 0],
    ['T_PRUNE', '#63003c', 0], ['T_BORDEAUX', '#8a1538', 0], ['T_NAVY', '#1d2a57', 0], ['T_BRIGHT', '#2a6fd0', 0],
    ['FURROW', '#9a7048', 0.08], ['FURROW_SH', '#74523a', 0.08], ['WHEAT', '#e2c050', 0.08], ['WHEAT_SH', '#b8962e', 0.08],
    ['SNOWFIELD', '#e8eef4', 0.08], ['BLOSSOM', '#f4b8c8', 0], ['LEAF', '#d07a2a', 0], ['LEAF2', '#e8b03a', 0],
    // the countryside: broadleaf trees through the seasons, vines, thatch, willow, water lilies
    ['OAK_HI', '#74b04e', 0.06], ['OAK', '#4f8c3c', 0.06], ['OAK_SH', '#356a32', 0.06],
    ['RUST_HI', '#eaa040', 0.06], ['RUST', '#c86a2a', 0.06], ['RUST_SH', '#8e4626', 0.06],
    ['BARK', '#5e4838', 0.06], ['BIRCH', '#e8e4d8', 0.06],
    ['VINE', '#5f8e36', 0.1], ['VINE_AUT', '#b85a2a', 0.1], ['GRAPE', '#5a2c5e', 0.1],
    ['THATCH', '#c9a252', 0.1], ['THATCH_SH', '#97752f', 0.1],
    ['WILLOW_HI', '#b0cc66', 0], ['WILLOW', '#7ea44c', 0], ['WILLOW_SH', '#577c3a', 0],
    ['LILY', '#4f8c3e', 0], ['LILY_FL', '#f6c4d4', 0],
    // inside the castle
    ['PLASTER_HI', '#e2d6b8', 0], ['PLASTER', '#cdbf9e', 0], ['PLASTER_SH', '#ad9e7e', 0],
    ['LIME_HI', '#ece8dc', 0], ['LIME', '#d8d2c2', 0], ['LIME_SH', '#b8b0a0', 0],
    ['BRICK_HI', '#a85a40', 0], ['BRICK', '#8a4632', 0], ['BRICK_SH', '#6a3426', 0],
    ['CORK', '#d0a46a', 0], ['CORK_SH', '#9a7046', 0], ['SLATEB', '#2b312d', 0], ['SLATEB_HI', '#3a423c', 0],
  ];
  // sprite materials: letter -> [name, highlight, mid, shadow]; _tools/icons.py shades the icons
  // with the same rule and colours
  const MATS = {
    a: ['ARM', '#e8ecf2', '#a9b1be', '#666e80'], r: ['CLOTH', '#d04a3a', '#a02a2a', '#681826'],
    d: ['CLOAK', '#565c78', '#363a52', '#202234'], w: ['WOOD', '#a8743e', '#7e5230', '#553620'],
    g: ['GOLD', '#f6d77a', '#d8a838', '#9a6a1e'], h: ['LEATHER', '#8a5a3a', '#6a4028', '#462a1a'],
    u: ['ROBE', '#5a7ee0', '#2f50b0', '#1c2f72'], p: ['HAT', '#7a6a8a', '#58486a', '#3a2e4a'],
    f: ['SKIN', '#f0c8a0', '#d89c74', '#a8704e'], e: ['BEARD', '#ffffff', '#dcd8d0', '#a29e98'],
    x: ['DRAKE', '#f0604a', '#c8302a', '#82202a'], z: ['WING', '#6a90f0', '#3058c0', '#1e3478'],
    n: ['RAVEN', '#6a6a90', '#3a3a58', '#22223a'], b: ['BLACKFUR', '#4a4a5e', '#2c2c38', '#18181f'],
    q: ['WHITEFUR', '#ffffff', '#e6e2da', '#b6b0a6'], t: ['TABBY', '#d8a868', '#a87a48', '#6e4a2a'],
  };
  const ALIAS = { l: 'a', m: 'a', v: 'u', o: 'h' }; // same material, separate part: the seam is shaded
  const FLAT = { k: 'OUTLINE', '*': 'ORB', y: 'GOLD_HI', c: 'CREAM', E: 'EYE' };
  const EMISSIVE = { ORB: '#c8fbff', EYE: '#dcf05a' }; // cats' eyes shine, in any light

  // sky stops come first: stars, sun, moon and clouds draw only on those indices
  const N_SKY = 5;
  const NAMES = ['SKY0', 'SKY1', 'SKY2', 'SKY3', 'SKY4', ...SURFACES.map((s) => s[0])];
  Object.values(MATS).forEach(([n]) => NAMES.push(`${n}_HI`, n, `${n}_SH`));
  NAMES.push(...Object.keys(EMISSIVE));
  const I = Object.fromEntries(NAMES.map((n, i) => [n, i]));
  const DAYLIGHT = NAMES.map(() => '#000000'); // each index's own colour, before any light
  SURFACES.forEach(([n, h]) => { DAYLIGHT[I[n]] = n === 'WIN_LIT' ? '#ffb048' : h; });
  Object.values(MATS).forEach(([n, hi, mid, sh]) => { DAYLIGHT[I[`${n}_HI`]] = hi; DAYLIGHT[I[n]] = mid; DAYLIGHT[I[`${n}_SH`]] = sh; });
  Object.entries(EMISSIVE).forEach(([n, h]) => { DAYLIGHT[I[n]] = h; });
  const FAR = I.MT_NEAR_SH; // firelight skips the sky, the clouds and the mountains
  const CASTLE = new Set(['WALL_HI', 'WALL', 'WALL_SH', 'WALL_DK', 'ROOF_HI', 'ROOF', 'ROOF_SH', 'SLATE_HI', 'SLATE',
    'SLATE_SH', 'DOME_HI', 'DOME', 'DOME_SH', 'TIMBER_HI', 'TIMBER', 'TIMBER_SH', 'BANNER', 'BANNER_SH', 'BANNER_GOLD',
    'IVY', 'IVY_SH', 'WIN_DARK', 'WIN_LIT'].map((n) => I[n]));

  // what snow does on each material: 1 it lies all over (grass, fields, bare earth), 2 it caps the top
  // edges (roofs, trees, rocks, walls), 3 it lies thin (the trodden path); SNOWDARK: shaded side
  const SNOWS = new Uint8Array(NAMES.length); const SNOWDARK = new Uint8Array(NAMES.length);
  [[1, 'GRASS GRASS_SH GRASS_HI GRASS_LT HILL HILL_SH HILL_HI FURROW FURROW_SH WHEAT WHEAT_SH FL_RED FL_YEL FL_WHITE FL_BLUE FL_VIOLET MOSS MOSS_HI DIRT DIRT_SH LEAF LEAF2'],
    [2, 'ROOF_HI ROOF ROOF_SH SLATE_HI SLATE SLATE_SH THATCH THATCH_SH DOME_HI DOME DOME_SH WALL_HI WALL WALL_SH WALL_DK ROCK_HI ROCK ROCK_SH ROCK_DK PINE PINE_SH PINE_HI TREES_FAR TREES_FAR_SH FG_PINE_HI FG_PINE FG_PINE_SH OAK_HI OAK OAK_SH RUST_HI RUST RUST_SH BARK BIRCH BUSH BUSH_SH BUSH_HI STONE_HI STONE STONE_SH TIMBER_HI TIMBER TIMBER_SH VINE VINE_AUT'],
    [3, 'PATH PATH_HI PATH_SH']].forEach(([g, names]) => names.split(' ').forEach((n) => { SNOWS[I[n]] = g; SNOWDARK[I[n]] = /_SH|_DK|^FG_/.test(n) ? 1 : 0; }));

  // [sun altitude (deg), sky stops top -> horizon, ambient light (multiplies daylight), fog]
  const KEYS = [
    [-14, ['#0b1024', '#0f1830', '#14223e', '#1b3048', '#24405a'], [0.3, 0.38, 0.6], 0.5],
    [-7, ['#121838', '#1c2650', '#2a3a66', '#3e4f7a', '#5c6a8c'], [0.4, 0.42, 0.66], 0.8],
    [-2, ['#22244a', '#3a2d5c', '#5e3058', '#93404a', '#d36a42'], [0.68, 0.46, 0.56], 1],
    [5, ['#3a6ab0', '#5e8cc8', '#9cb4d4', '#e8c09a', '#f7d79c'], [1.04, 0.9, 0.74], 1],
    [18, ['#2f7fd8', '#4a9be8', '#6fb5f0', '#a0d0f4', '#d2ebf8'], [1, 1, 1], 1],
  ];

  // fire levels, 0 empty
  const FIRE = ['', '#4a1610', '#7a2418', '#b8341e', '#e85a24', '#f88a2e', '#fbbf45', '#fff0a8'];
  const FIRE_MAX = FIRE.length - 1;

  /* ---- sprites: silhouettes in material letters, shaded and outlined by shadeSprite ---- */

  const { KNIGHT, KNIGHT_HEAD, WIZARD, ORB, HORSE, DEER, OWL, HERON, MINSTREL, ANGLER, SNOWMAN, DUCK, WIZ_HEAD_X, RIDER, DREAMS, DRAGON_BODY, WING_UP, WING_DOWN, DRAGON_MOUTH, CATS, WORLD_MAP, PERSON, NEAR_SP, FRAME_SP, RAVEN, GLYPHS, PEASANT, PUPIL, MONK, HAIR, TUNIC } = window.HOURS_ART; // (the drawings: hours/art.js)




  /* Each room's floor, rug and vault, from textures.js (its `textures` command shows them all). */
  const ROOM_LOOK = {
    about: { floor: 'oakPlanks', rug: 'medallion' }, publications: { floor: 'herringbone', rug: 'kilim' }, research: { floor: 'flagstones' },
    projects: { floor: 'brickBasket' }, talks: { floor: 'checkerMarble', vault: 'starsVault' }, teaching: { floor: 'basketParquet' },
    news: { floor: 'rushes' }, contact: { floor: 'cobbles' }, cellar: { floor: 'beatenEarth' }, maproom: { floor: 'basketParquet', rug: 'kilim' },
  };
  /** Texture `name`'s colour index at (x, y), from textures.js (stone if it has not come). */
  const texAt = (name, x, y) => { const t = window.TEXTURES && window.TEXTURES[name]; return t ? I[t.fn(x, y)] ?? I.ROCK : I.ROCK; };
  const DWELLERS = { // [H, B, A, L, X, beard?, what they say]
    research: ['u', 'u', 'u', 'd', 'g', true, ['The astronomer, without looking up: "Saturn rises at ten. Come back then."', 'The astronomer: "The labs send their reports rolled and sealed. I read them by the candle, after the stars."']],
    projects: ['h', 'h', 'f', 'd', 'a', false, ['The smith wipes his hands: "Each of those models works. Ask it, it will show you."', 'The smith: "The bucket is for quenching. Not for drinking."']],
    publications: ['p', 'p', 'p', 'h', 'g', true, ['The librarian, in a whisper: "Face out on the shelf of honour: the one book of this house so far."', 'The librarian: "The ladder slides. Mind the cat."']],
    contact: ['a', 'a', 'a', 'd', 'r', false, ['The guard: "Letters go in the slot. The register is on the table, if you would sign."', 'The guard: "No one passes after the bell. Except the cat."']],
    maproom: ['p', 'w', 'w', 'd', 'g', true, ['The cartographer, dividers in hand: "Every place on it was walked, not copied. Orsay is off the edge: I ran out of vellum."', 'The cartographer: "The pennants are in the colours of each house. Click one: it will tell you what was done there."']],
    talks: ['r', 'u', 'r', 'd', 'g', false, ['The herald, his staff under his arm: "Each scroll on the table is a talk given. The chairs remember who sat in them."', 'The herald: "The clock is right twice a day. The other times it is astronomical."']],
    cellar: ['h', 'd', 'd', 'h', 'r', true, ['The cellarer, a candle in his hand: "One rack for each year. The young ones are still settling."', 'The cellarer: "Mind the steps. The drip has been there since the vault was built."']],
    news: ['d', 'v', 'v', 'h', 'g', false, ['The falconer, a raven on his fist: "They bring the news as it comes. Dated, always."', 'The falconer: "That one is Hugin. The other two never tell me their names."']],
  };
  /** Where the eyes ('E') are in a shaded sprite (outline adds one pixel all round). */
  const eyesOf = (text) => text.trim().split('\n').flatMap((r, y) => [...r].map((c, x) => (c === 'E' ? [x + 1, y + 1] : null)).filter(Boolean));

  /* ---- helpers --------------------------------------------------------- */

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const pack = (c) => (255 << 24) | (clamp(Math.round(c[2]), 0, 255) << 16)
    | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[0]), 0, 255);
  const unpack = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const { mulberry32, noise1, fbm, lichenInit, lichenGrow, lichenDim, ferryNew, ferryRow, fluidNew, fluidStep, waveStep, antsNew, antsStep, shoalStep, marketGame, boltNew, boltGrow } = window.HOURS_PHYSICS; // (the small simulations: hours/physics.js)

  /* ---- lichen on the castle rock: diffusion-limited aggregation (Witten & Sander 1981) ----
     on[i]: 1 rock, 2 + k lichen of patch k, over the MID plane. Walkers start on a ring just outside a patch,
     step to a 4-neighbour (only over rock) and stick, with probability `stick`, on touching it;
     too far, they start again. */

  /* ---- the ferryman: tabular Q-learning (Watkins 1989) of a river crossing. State: the row
     reached (0..L) and the drift from the jetty's line (-X..X); action: an oar stroke to either
     side or none; the current, set by the real wind, pushes him each row, with some chop
     (tested offline: mean landing error 2.7 px over the first ten crossings, 0.6 after eighty).
     Reward: minus the landing error at the far jetty, minus a little per stroke. One table for
     both ways (the current pushes the same way); a constant step size so he re-learns when the
     wind turns. ---- */
  /** The current, in px a row: the real wind's west-east part, held under what one stroke undoes. */
  const ferryCurrent = () => clamp(windX() * 0.6, -0.9, 0.9);

  /* ---- the campfire's smoke: stable fluids (Stam 1999) on a small grid over the flames. Each step:
     smoke and heat come in at the bottom; warm smoke rises (buoyancy), the real wind leans it; the
     velocity is made divergence-free (a pressure solve, Gauss-Seidel), then carries itself and the
     smoke along, semi-Lagrangian (unconditionally stable: the step never blows up). ---- */

  /* ---- skimming stones: the river's surface as a 2D wave equation (leapfrog, damped, banks held
     still), in the MID plane's coordinates; a stone's touches set it ringing ---- */
  function waveNew(s0) {
    const y0 = s0.yl0 - 3; const h = s0.yg + 2 - y0; const w = s0.WE; const mid = s0.planes[L.MID];
    const wet = new Uint8Array(w * h); for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const c = mid[(y0 + y) * w + x]; wet[y * w + x] = c === I.WATER || c === I.WATER_HI ? 1 : 0; }
    return { w, h, y0, wet, u: new Float32Array(w * h), up: new Float32Array(w * h), live: 0 };
  }

  /* ---- the tavern's last customer, at night: a random walk along the bank, a pace either way at
     random, a hundred paces a walk (then he sits down). After n paces he is about sqrt(n) from the
     door: the root mean square over his walks is kept. ---- */
  const drunk = { x: 0, n: 0, ends: [] };
  function drunkStep() {
    drunk.x += Math.random() < 0.5 ? -1 : 1; drunk.n += 1;
    if (drunk.n >= 100) { drunk.ends.push(drunk.x * drunk.x); if (drunk.ends.length > 60) drunk.ends.shift(); drunk.x = 0; drunk.n = 0; }
  }

  /* ---- things from the real world (paintings, films, scores, texts, furniture, maps), turned into
     the scene's palette by _tools/real.py and its fetch_*.py scripts: small JSON assets, loaded once.
     An image asset's palette names map to this palette's indices, so it is lit like the rest. ---- */
  const real = {}; const realWait = {}; let realIndex = null; let realIndexP = null;
  const realIx = () => (realIndexP ||= fetch(new URL('index.json', REAL_BASE), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null).then((ix) => { realIndex = ix || {}; return realIndex; }));
  function decodeReal(o) {
    const map = (o.names || []).map((n) => (I[n] === undefined ? I.OUTLINE : I[n]));
    const dec = (b) => { const t = atob(b); const a = new Uint8Array(t.length); for (let i = 0; i < t.length; i += 1) a[i] = t.charCodeAt(i); return a; };
    const idx = (b) => Int16Array.from(dec(b), (v) => (v === 255 ? -1 : map[v]));
    if (o.px) o.idx = idx(o.px);
    if (o.frames) o.frameIdx = o.frames.map(idx);
    if (o.small) decodeReal(Object.assign(o.small, { names: o.names }));
    if (o.sprites) o.sprites = o.sprites.map((sp) => ({ ...sp, px: idx(sp.px) })); // ({w, h, px} as shadeSprite gives)
    return o;
  }
  /** Bytes from base64 deflate (zlib) data, inflated by the browser. */
  async function inflate(b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  }
  /** The asset `name` if it has arrived, else null (and it is asked for). */
  function realGet(name) {
    if (real[name]) return real[name];
    realWait[name] ||= realIx().then((ix) => (ix[name] ? fetch(new URL(`${name}.json?v=${ix[name].v}`, REAL_BASE)).then((r) => (r.ok ? r.json() : null)) : null))
      .then(async (o) => { if (o && o.data && o.n) o.film = await inflate(o.data); return o; }) // (a film: its frames deflated)
      .then((o) => { if (o) { real[name] = decodeReal(o); realArrived(name); } return real[name] || null; }).catch(() => null);
    return null;
  }
  // what an arrival changes: the landscape's planes, the room shown, the watchtower's panorama
  const REAL_SCENE = new Set(); const REAL_ROOM = new Set(['heures', 'licorne', 'melies', 'mobilier', 'outils', 'portraits']); const REAL_PANO = new Set(['paris']); const REAL_LIGHT = new Set(['heures', 'monet']);
  function realArrived(name) {
    if (!scene) return;
    if (REAL_SCENE.has(name)) { scene.W = -1; resize(); }
    if (REAL_ROOM.has(name) && interior && view.id) { interior = makeInterior(view.id); lightInterior(); if (view.state === 'room') publishSpots(true); }
    if (REAL_PANO.has(name)) pano = tower && tower.on ? makePano(scene.W, scene.H) : null;
    if (REAL_LIGHT.has(name)) relight();
    if (!running && isOn()) render(now());
  }

  /** Muybridge's frames as shaded sprites (both ways), the passer-by's coat in its colour; null before they come. */
  const muyCache = {};
  function muySprites(kind) {
    const a = real.muybridge; if (!a) return null;
    const rid = kind === 'rider'; const key = rid ? 'rider' : kind;
    if (!muyCache[key]) {
      const coat = { messenger: 'r', peddler: 'w', lantern: 'd' }[kind] || 'd';
      const right = (rid ? a.rider : a.walker).map((txt) => shadeSprite(rid ? txt.replace(/d/g, 'r') : txt.replace(/d/g, coat))); // (the rider in red, as the messenger was)
      muyCache[key] = { right, left: right.map(flip) };
    }
    return muyCache[key];
  }

  /* ---- the ants: the double bridge (Goss, Aron, Deneubourg & Pasteels 1989). From the nest to a
     fallen apple run two ways round a pebble, a short one and a long one. At either end an ant
     takes the short way with p = (k + ts)^2 / ((k + ts)^2 + (k + tl)^2), t the pheromone on each,
     and marks the way it took when it gets there; the marks fade. The short way's ants come back
     sooner, so it is marked faster, and the colony settles on it: no ant knows which is shorter. */
  const antAt = (a, n) => { const w = a.ways[n.way]; const k = Math.min(w.length - 1, Math.max(0, n.s)); return n.dir > 0 ? w[k] : w[w.length - 1 - k]; };

  /* ---- a shoal in the river on bright days (Reynolds 1987): each fish steers towards its neighbours'
     middle and heading, away from any too close, and keeps to the water ---- */

  /* ---- the Saturday market's crowd: a stationary mean-field game (Lasry & Lions 2007) on a line
     of N places along the bank. Cost of standing at x: the crush there (kappa N m(x)) less the
     stalls' pull; eps per step taken; entropy sigma (each villager a little whimsical); discount
     gamma. Solved by fictitious play (Cardaliaguet & Hadikhanloo 2017): the best reply to the
     average crowd so far, the crowd that reply makes, averaged in. gap: L1 distance between the
     crowd found and the one its own best reply makes (0 at a Nash equilibrium). */


  /** Shaded sprite from a silhouette: each material is lit on the side facing the fire (+x) and,
   *  dithered, on top; shaded on the far side and underneath. Seams between parts and a 1 px
   *  outline come out of the same rule. Returns { w, h, px }, px = palette index or -1. */
  function shadeSprite(text) {
    const rows = text.trim().split('\n');
    const w0 = Math.max(...rows.map((r) => r.length));
    const h0 = rows.length;
    const at = (x, y) => (y >= 0 && y < h0 && x >= 0 && x < rows[y].length ? rows[y][x] : '.');
    const w = w0 + 2; const h = h0 + 2;
    const px = new Int16Array(w * h).fill(-1);
    for (let y = -1; y <= h0; y += 1) {
      for (let x = -1; x <= w0; x += 1) {
        const c = at(x, y);
        let v = -1;
        if (c === '.') {
          if (NEIGH.some(([dx, dy]) => at(x + dx, y + dy) !== '.')) v = I.OUTLINE;
        } else if (FLAT[c]) {
          v = I[FLAT[c]];
        } else {
          const name = MATS[ALIAS[c.toLowerCase()] || c.toLowerCase()][0];
          const same = (q) => q !== '.' && !FLAT[q] && q.toLowerCase() === c.toLowerCase();
          if (c !== c.toLowerCase()) v = I[`${name}_SH`];
          else if (!same(at(x + 1, y)) || (at(x, y - 1) === '.' && (x + y) % 2 === 0)) v = I[`${name}_HI`];
          else if (!same(at(x - 1, y)) || !same(at(x, y + 1))) v = I[`${name}_SH`];
          else v = I[name];
        }
        px[(y + 1) * w + x + 1] = v;
      }
    }
    return { w, h, px };
  }

  function flip(s) {
    const px = new Int16Array(s.px.length);
    for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) px[y * s.w + x] = s.px[y * s.w + s.w - 1 - x];
    return { w: s.w, h: s.h, px };
  }

  /** Lay silhouette `top` over `base` from row dy: behind it (only where base is empty) or in front. */
  function overlay(base, top, dy, behind) {
    const b = base.trim().split('\n'); const t = top.trim().split('\n');
    const h = Math.max(b.length, t.length + dy);
    const w = Math.max(...b.map((r) => r.length), ...t.map((r) => r.length));
    const out = Array.from({ length: h }, (_, y) => (b[y] || '').padEnd(w, '.').split(''));
    t.forEach((r, y) => r.split('').forEach((c, x) => {
      if (c !== '.' && (!behind || out[y + dy][x] === '.')) out[y + dy][x] = c;
    }));
    return out.map((r) => r.join('')).join('\n');
  }

  const SPRITES = {};
  function sprites() {
    if (SPRITES.knight) return;
    SPRITES.knight = shadeSprite(KNIGHT);
    SPRITES.wizard = shadeSprite(WIZARD);
    // the schoolmaster: not the wizard of the camp, a doctor in a red gown and a black cap, his
    // staff a plain pointer with a gilt knob
    // (his gown let down by six rows, rows repeated: an adult of the rooms' scale under the cap)
    const gown = WIZARD.trim().split('\n').flatMap((r, y) => ([19, 21, 23, 24, 26, 28].includes(y) ? [r, r] : [r])).join('\n');
    SPRITES.master = shadeSprite(gown.replace(/[uv]/g, 'r').replace(/p/g, 'b').replace(/y/g, 'g').replace(/\*/g, 'g'));
    SPRITES.masterL = flip(SPRITES.master); // (turned round, to the class)
    // the body from row 6 of the frame: the raised wing behind it, the lowered one over its belly
    const body = `${'.\n'.repeat(6)}${DRAGON_BODY.trim()}`;
    SPRITES.dragon = [shadeSprite(overlay(body, WING_UP, 0, true)), shadeSprite(overlay(body, WING_DOWN, 13, false))];
    SPRITES.dragonL = SPRITES.dragon.map(flip);
    SPRITES.cats = Object.fromEntries(Object.entries(CATS).map(([k, txt]) => [k, { ...shadeSprite(txt), eyes: eyesOf(txt) }]));
    const lf = SPRITES.cats.blackLoaf; // she faces the fire: mirrored
    SPRITES.cats.blackLoaf = { ...flip(lf), eyes: lf.eyes.map(([x, y]) => [lf.w - 1 - x, y]) };
    SPRITES.raven = shadeSprite(RAVEN);
    SPRITES.peasant = PEASANT.map(shadeSprite);
    SPRITES.horse = HORSE.map(shadeSprite);
    SPRITES.deer = DEER.map(shadeSprite);
    SPRITES.owl = shadeSprite(OWL);
    SPRITES.heron = shadeSprite(HERON);
    SPRITES.duck = shadeSprite(DUCK);
    SPRITES.duckR = flip(SPRITES.duck);
    SPRITES.minstrel = shadeSprite(MINSTREL);
    SPRITES.snowman = shadeSprite(SNOWMAN);
    SPRITES.angler = shadeSprite(ANGLER);
    SPRITES.walkerL = SPRITES.peasant.map(flip);
    SPRITES.rider = RIDER.map(shadeSprite); SPRITES.riderR = SPRITES.rider.map(flip);
    SPRITES.frame = Object.fromEntries(Object.entries(FRAME_SP).map(([k, v]) => [k, shadeSprite(v)]));
    SPRITES.frame.ratL = flip(SPRITES.frame.rat); SPRITES.frame.bbSit = SPRITES.cats.spotted;
  }

  /* ---- the scene: seven planes of palette indices, generated once per size ---- */

  function generate(W, H, Ws) {
    sprites();
    const rng = mulberry32(1888);
    const M = MARGIN; const WE = W + 2 * M; // plane width; stage x = M + screen x
    const planes = Array.from({ length: RATE.length }, () => new Uint8Array(WE * H).fill(CLEAR));
    let cur = L.SKY;
    const on = (l) => { cur = l; };
    const set = (x, y, i) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < WE && y >= 0 && y < H) planes[cur][y * WE + x] = i;
    };
    const get = (x, y, l = cur) => (x >= 0 && x < WE && y >= 0 && y < H ? planes[l][y * WE + x] : CLEAR);
    const rect = (x, y, w, h, i) => {
      for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) {
        for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) set(xx, yy, i);
      }
    };
    const u = Math.min(Ws / 125, H / 175); // castle and hill scale, from the visible stage
    const v = u * 0.78; // heights: the castle stands back, under a wide sky

    const yg = Math.round(H * 0.77); // top of the meadow (the GROUND plane)
    const yl0 = yg - Math.max(10, Math.round(H * 0.1)); // top of the lake
    const rockH = Math.round(H * 0.07);
    const crest = yl0 - Math.round(H * 0.12) - rockH; // the castle's foot, on its rock
    const top = crest + rockH; // the hill's summit, at the rock's foot
    const yHor = yl0 - 0.05 * H; // altitude 0, for the sun and the moon
    const cx = M + Math.round(0.64 * Ws);
    const castleW = 46 * u;
    const fire = { x: M + Math.round(0.55 * Ws), y: yg + Math.round((H - yg) * 0.62) };
    const yfg = H - Math.round(H * 0.13); // the foreground strip begins here

    // sky: five stops, solid bands joined by ordered dither
    on(L.SKY);
    for (let y = 0; y < H; y += 1) {
      const g = clamp(y / yHor) * (N_SKY - 1);
      const j = Math.min(N_SKY - 2, Math.floor(g));
      const t = clamp((g - j - 0.3) / 0.5);
      for (let x = 0; x < WE; x += 1) set(x, y, t > bayer(x, y) ? j + 1 : j);
    }

    // mountains: ridged multi-octave noise (sharp crests, a main peak every `span` px), facets
    // lit from the left; gullies are scattered, of random length, and wander as they run down
    function range(y0top, depth, span, light, shade, snowLine) {
      const n = fbm(rng);
      const oct = Array.from({ length: 4 }, () => noise1(rng));
      const ridge = (x) => {
        let s0 = 0; let a = 1; let w = 0;
        for (let k = 0; k < 4; k += 1) { s0 += a * (1 - Math.abs(2 * oct[k](x * 2 ** k) - 1)) ** 1.6; w += a; a *= 0.45; }
        return s0 / w;
      };
      const ys = new Float32Array(WE + 1);
      // stretch the ridge's range so crests are peaks, not a plateau
      for (let x = 0; x <= WE; x += 1) ys[x] = y0top + (1 - clamp((ridge(x / span + 3) - 0.2) / 0.55) ** 1.3) * depth;
      const gully = new Uint8Array(WE * H);
      for (let g = 0; g < WE / 6; g += 1) {
        let gx0 = rng() * WE; const len = 3 + rng() * depth * 0.5;
        const y0 = Math.round(ys[clamp(Math.round(gx0), 0, WE)]) + 2;
        for (let y = y0; y < y0 + len && y < H; y += 1) {
          gx0 += (n(y * 0.3 + g * 7) - 0.5) * 1.6;
          if (rng() < 0.85) gully[y * WE + clamp(Math.round(gx0), 0, WE - 1)] = 1;
        }
      }
      for (let x = 0; x < WE; x += 1) {
        const y0 = Math.round(ys[x]);
        const slope = ys[x + 1] - ys[Math.max(0, x - 1)];
        const snowDepth = snowLine === null ? 0 : (snowLine - y0) * 0.8 + (n(x * 0.9) - 0.5) * 4;
        for (let y = Math.max(0, y0); y < yg; y += 1) {
          // facets run diagonally down from the crests, as rock does, not in vertical bands
          const lit = slope * 1.5 + (n((x - y * 0.9) * 0.11 + 31) - 0.5) * 2.4 + (n((x + y) * 0.07 + 57) - 0.5) * 1.2 > 0;
          const gl = gully[y * WE + x] === 1;
          if (y - y0 < snowDepth + (gl ? 4 : 0)) set(x, y, lit && !gl ? I.SNOW : I.SNOW_SH);
          else set(x, y, lit && !gl ? light : shade);
        }
      }
    }
    // ?season= previews another time of year (screenshots); the month follows it
    const qSeason = new URLSearchParams(location.search).get('season');
    const month = { winter: 0, spring: 4, summer: 6, autumn: 9 }[qSeason] ?? today().getMonth(); const season = SEASON(month);
    on(L.FAR); range(yg - 0.6 * H, 0.24 * H, 70, I.MT_FAR, I.MT_FAR_SH, yg - (season === 'winter' ? 0.43 : 0.5) * H);
    on(L.NEAR); range(yg - 0.44 * H, 0.15 * H, 95, I.MT_NEAR, I.MT_NEAR_SH, null);

    // west of the castle, on the near range: a watchtower on the crest (its signal fire burns at night)
    const crestAt = (x) => { for (let y = 0; y < H; y += 1) if (get(x, y, L.NEAR) !== CLEAR) return y; return H; };
    // far off, it is a silhouette in the range's own colours (the haze is on it too), standing on
    // the highest point near its place, its foot sunk in the rock
    const watch = { x: M + Math.round(0.17 * Ws) };
    for (let x = watch.x - 10; x <= watch.x + 10; x += 1) if (crestAt(x) < crestAt(watch.x)) watch.x = x;
    {
      const yb = crestAt(watch.x) + 3; const x0 = watch.x - 2;
      rect(x0, yb - 9, 4, 10, I.ROCK_SH); rect(x0, yb - 9, 1, 10, I.ROCK); rect(x0 + 3, yb - 9, 1, 10, I.ROCK_DK); // shaft, lit on the west
      rect(x0 - 1, yb - 1, 6, 2, I.ROCK_SH); set(x0 - 1, yb - 1, I.ROCK); // its footing in the rock
      set(x0, yb - 10, I.ROCK_SH); set(x0 + 2, yb - 10, I.ROCK_SH); set(x0 + 3, yb - 10, I.ROCK_DK); // merlons
      set(x0 + 1, yb - 6, I.ROCK_DK); // a loophole
      watch.y = yb - 11; // where the fire burns
    }
    const VINES = { autumn: month >= 9 ? [I.VINE_AUT, I.RUST_HI] : [I.VINE, I.GRAPE], summer: [I.VINE, month === 7 ? I.GRAPE : I.VINE],
      spring: [I.VINE, I.OAK_HI], winter: [I.BARK, I.BARK] }[season];
    /** A broadleaf tree (oak, now and then a birch) in the current plane, dressed for the season:
     *  leaves, blossom in spring, rust and gold in autumn, bare branches in winter. */
    function broadleaf(xc, yb, h) {
      const kind = rng(); const birch = kind < 0.2;
      const trunkH = Math.max(2, Math.round(h * 0.38));
      const rx = Math.max(2, h * 0.36); const ry = Math.max(2, h * 0.32); const cy = yb - trunkH - ry + 1;
      for (let y = 0; y < trunkH + (season === 'winter' ? ry : 0); y += 1) set(xc, yb - y, birch && y % 3 !== 1 ? I.BIRCH : I.BARK);
      if (season === 'winter') { // bare: forking branches, a few twigs
        [0.2, 0.55].forEach((f, j) => [-1, 1].forEach((dir) => {
          for (let k = 1; k <= rx * (1 - j * 0.3); k += 1) set(xc + dir * k, Math.round(cy + ry * (0.6 - f) - k * 0.8), I.BARK);
        }));
        return;
      }
      const P = season === 'autumn'
        ? (kind < 0.45 ? [I.RUST_HI, I.RUST, I.RUST_SH] : kind < 0.8 ? [I.LEAF2, I.RUST_HI, I.RUST] : [I.OAK_HI, I.OAK, I.OAK_SH])
        : [I.OAK_HI, I.OAK, I.OAK_SH];
      for (let dy = -Math.ceil(ry); dy <= ry; dy += 1) {
        for (let dx = -Math.ceil(rx); dx <= rx; dx += 1) {
          const x = Math.round(xc + dx); const y = Math.round(cy + dy);
          if ((dx / rx) ** 2 + (dy / ry) ** 2 + (bayer(x, y) - 0.5) * 0.4 > 1) continue; // a lumpy edge
          let c = dx + dy < -rx * 0.3 ? P[0] : dx + dy > rx * 0.35 || dy > ry * 0.45 ? P[2] : P[1];
          if (season === 'spring' && kind > 0.5 && bayer(x, y) < 0.14) c = I.BLOSSOM;
          set(x, y, c);
        }
      }
    }

    // the forest: two rows of small conifers, irregularly spaced and sized, over a dark understorey
    on(L.TREES);
    const tn = fbm(rng, 3);
    [[0.12, 4, 8, I.TREES_FAR, I.TREES_FAR_SH], [0.07, 6, 12, I.PINE, I.PINE_SH]].forEach(([dy, hMin, hMax, lit, sh], row) => {
      const edge = (x) => Math.round(yl0 - dy * H + (tn(x / 40 + row * 9) - 0.5) * 0.06 * H);
      for (let x = 0; x < WE; x += 1) for (let y = edge(x) + 2; y < yg; y += 1) set(x, y, sh);
      for (let x = Math.floor(rng() * 3); x < WE; x += 2 + Math.floor(rng() * 4)) {
        const h = hMin + rng() * (hMax - hMin) * (0.5 + tn(x / 25 + row)); const base = edge(x) + 3;
        if (row === 1 && tn(x / 18 + 40) > 0.55) { broadleaf(x, base, h * 0.85); x += 2; continue; } // groves of broadleaf
        for (let r = 0; r < h; r += 1) {
          const half = (h - r) * 0.3 + (r % 3 === 0 ? 0.6 : 0); // tiers
          for (let dx = -Math.round(half); dx <= Math.round(half); dx += 1) set(x + dx, base - r, dx < 0 || (dx === 0 && r % 2) ? lit : sh);
        }
      }
    });

    // behind the hamlet the forest gives way to a vineyard on the gentle slope: rows of vines
    // across it, green, then grapes in late summer, red-gold in October, bare stakes in winter
    { // a small plot: rows of separate vine stocks over bare earth, wider down the slope, framed by trees
      const xa = M + Math.round(0.06 * Ws); const xb = M + Math.round(0.19 * Ws);
      const top0 = (x) => Math.round(yl0 - 0.12 * H + (tn(x / 40) - 0.5) * 0.06 * H) + 6;
      for (let rw = 0; rw < 4; rw += 1) {
        const inset = (3 - rw) * 3 + Math.round(rng() * 2);
        for (let x = xa + inset; x < xb - inset; x += 1) {
          const y = top0(x) + rw * 3; const k = x - xa;
          if (y + 2 >= yl0 - 9) continue; // the hamlet's roofs below
          set(x, y + 2, I.FURROW_SH);
          if (k % 3 === 2) { set(x, y, I.HILL_SH); set(x, y + 1, I.FURROW_SH); continue; } // between two stocks
          const leaf = season === 'winter' ? I.BARK : (k * 5 + rw) % 7 === 0 ? VINES[1] : (k + rw) % 3 === 0 ? I.VINE : VINES[0];
          set(x, y, leaf); set(x, y + 1, season === 'winter' ? I.FURROW_SH : (k % 3 === 0 ? I.VINE_AUT === leaf ? I.VINE : leaf : leaf));
        }
      }
      for (let x = xa - 3; x < xb + 4; x += 4 + Math.floor(rng() * 4)) { // small conifers along its top
        const h = 5 + Math.floor(rng() * 4); const b = top0(x) - 1;
        for (let rr = 0; rr < h; rr += 1) { const half = Math.round((h - rr) * 0.3); for (let dx = -half; dx <= half; dx += 1) set(x + dx, b - rr, dx < 0 ? I.PINE : I.PINE_SH); }
      }
    }

    /* MID: hill, rock, castle, lake, the upper path, its pines and bushes */
    on(L.MID);
    const hn = fbm(rng); const hn2 = fbm(rng, 3);
    const patch = (n1, n2, x, y) => Math.sqrt(n1(x * 0.21 + y * 0.83) * n2(x * 0.17 - y * 0.71 + 40)) * 1.15; // blotches, no stripes
    const hill = new Float32Array(WE);
    for (let x = 0; x < WE; x += 1) {
      const b = Math.exp(-(((x - cx) / (0.3 * Ws)) ** 2));
      hill[x] = yl0 - 3 - b * (yl0 - 3 - top) + (hn(x / 30) - 0.5) * 5 * u * (1 - b);
    }
    for (let x = 0; x < WE; x += 1) {
      const y0 = Math.round(hill[x]);
      for (let y = y0; y < yg; y += 1) {
        const t = patch(hn, hn2, x, y);
        let c = y === y0 ? I.HILL_HI : t > 0.62 ? I.HILL_SH : (t < 0.22 && bayer(x, y) < 0.5) ? I.HILL_HI : I.HILL;
        if ((x * 3 + y * 7) % 31 === 0 && y > y0 + 1) c = I.HILL_SH; // sparse tufts: it is far
        set(x, y, c);
      }
    }

    // the rock under the castle: warped strata, cracks, lit from the left
    const cracks = new Set(Array.from({ length: Math.round(castleW / 5) }, () => Math.round(cx - castleW / 2 + rng() * castleW)));
    // its flanks wander (one noise per side), strata come in broken lengths, ledges hold grass
    const rl = fbm(rng, 3); const rr = fbm(rng, 3); const st = fbm(rng, 3);
    for (let y = crest; y < yl0; y += 1) {
      const dy = y - crest;
      const a = cx - castleW / 2 - 6 * u - dy * (0.5 + rl(dy * 0.02) * 0.6) - (rl(dy * 0.25 + 5) - 0.5) * 6;
      const b = cx + castleW / 2 + 6 * u + dy * (0.5 + rr(dy * 0.02) * 0.6) + (rr(dy * 0.25 + 5) - 0.5) * 6;
      for (let x = Math.round(a); x <= Math.round(b); x += 1) {
        if (y > hill[clamp(x, 0, WE - 1)] + 2 + hn(x * 0.7) * 3) continue;
        const k = (x - a) / (b - a);
        let c = k < 0.1 ? I.ROCK_HI : k < 0.5 ? I.ROCK : k < 0.93 ? I.ROCK_SH : I.ROCK_DK;
        const stratum = (dy + Math.round(hn(x * 0.08 + 9) * 7)) % 5 === 4 && st(x * 0.15 + dy) > 0.45;
        if (stratum) c = c === I.ROCK_HI ? I.ROCK : I.ROCK_DK;
        if (cracks.has(x + ((y >> 2) & 1)) && rng() < 0.7) c = I.ROCK_DK;
        if (y === crest || x === Math.round(a)) c = I.ROCK_HI;
        set(x, y, c);
        if (stratum && k < 0.75 && rng() < 0.25) set(x, y - 1, rng() < 0.5 ? I.HILL_HI : I.HILL); // a tuft on the ledge
      }
    }

    // a cellar door cut into the rock, left of the stair: the way down (the descent, `>`)
    const cellar = { x: Math.round(cx - castleW * 0.3), y: crest + Math.max(3, Math.round(rockH * 0.35)), w: 5, h: 6 };
    for (let y = 0; y < cellar.h; y += 1) {
      for (let x = 0; x < cellar.w; x += 1) {
        const arch = y === 0 && (x === 0 || x === cellar.w - 1);
        if (!arch) set(cellar.x + x, cellar.y + y, y > cellar.h - 3 && x === y - 2 ? I.ROCK_SH : I.OUTLINE); // dark, a step or two going down
      }
    }
    for (let x = -1; x <= cellar.w; x += 1) set(cellar.x + x, cellar.y - 1, I.ROCK_HI); // its lintel
    set(cellar.x - 1, cellar.y + 2, I.TIMBER); set(cellar.x - 1, cellar.y + 3, I.TIMBER_SH); // a post with a lamp hook

    // the path: from the bottom edge to the foot of the rock, then steps cut up to the gate
    const pathX = new Float32Array(H).fill(-99); const pathW = new Float32Array(H);
    for (let y = top; y < H; y += 1) {
      const t = (H - y) / (H - top); // 0 at the bottom, 1 at the rock
      pathX[y] = M + 0.8 * Ws + (cx + 2 - M - 0.8 * Ws) * t + 0.07 * Ws * Math.sin(t * 5) * (1 - t);
      pathW[y] = Math.max(1, 5 * (1 - t) ** 1.2 + 1);
    }
    function drawPath(y) {
      const xc = pathX[y]; const hw = pathW[y];
      for (let x = Math.floor(xc - hw); x <= Math.ceil(xc + hw); x += 1) {
        const e = Math.abs(x - xc);
        let c = e > hw - 0.8 ? I.PATH_SH : (bayer(x, y) < 0.12 ? I.PATH_SH : (bayer(x + 1, y) < 0.08 ? I.PATH_HI : I.PATH));
        if (y > yg && hw > 3 && rng() < 0.03) c = I.STONE; // pebbles, only near
        set(x, y, c);
      }
    }
    for (let y = top + 2; y < yg; y += 1) drawPath(y);
    { // up the rock in three flights, turning on small landings; a parapet on the drop side
      const yA = top + 1; const hh = yA - crest - 1; const sw = Math.round(7 * u);
      const pts = [[cx + 2, yA], [cx + 1 - sw, yA - Math.round(hh / 3)], [cx + 2 + sw, yA - Math.round((2 * hh) / 3)], [cx + 1, crest + 1]];
      for (let k = 0; k < 3; k += 1) {
        const [xa, ya] = pts[k]; const [xb, yb] = pts[k + 1]; const dir = Math.sign(xb - xa);
        for (let y = ya; y >= yb; y -= 1) {
          const f = ya === yb ? 1 : (ya - y) / (ya - yb); const xc = Math.round(xa + (xb - xa) * f);
          for (let x = xc - 1; x <= xc + 1; x += 1) set(x, y, (y + k) % 2 ? I.PATH_HI : I.PATH);
          set(xc + 2 * dir, y, I.PATH_SH); // the step's riser, towards the climb
          set(xc - 2 * dir, y + 1, I.ROCK_DK); // the parapet's shadow below the treads
        }
        rect(xb - 2, yb, 5, 1, I.PATH_HI); // the landing
      }
    }

    // the river: across the whole width, its banks wandering and the bed meandering a little;
    // shallows paler at the edges, a muddy near bank, reed clumps; a stone bridge for the path
    const ln = fbm(rng, 3); const ln2 = fbm(rng, 3); const ln3 = fbm(rng, 3);
    const bend = (x) => Math.round((ln3(x * 0.015) - 0.5) * 5);
    const riverTop = (x) => Math.round(yl0 + 1 + ln(x * 0.06) * 2.5) + bend(x);
    const ln4 = fbm(rng, 2);
    const riverBot = (x) => Math.round(yg - 3 - ln2(x * 0.05) * 3 - (ln4(x * 0.02) < 0.35 ? 3 : 0)) + bend(x); // narrows here and there
    const islet = { x: M + Math.round(0.3 * Ws), y: 0, rx: 8, ry: 2 };
    islet.y = Math.round((riverTop(islet.x) + riverBot(islet.x)) / 2);
    const onIslet = (x, y) => ((x - islet.x) / islet.rx) ** 2 + ((y - islet.y) / islet.ry) ** 2 < 1;
    const isWater = (x, y) => y >= riverTop(x) && y <= riverBot(x) && !onIslet(x, y);
    for (let x = 0; x < WE; x += 1) {
      for (let y = riverTop(x); y <= riverBot(x); y += 1) {
        const edge = !isWater(x, y - 1) || !isWater(x, y + 1) || !isWater(x, y + 2);
        set(x, y, edge && bayer(x, y) < 0.7 ? I.WATER_HI : I.WATER);
      }
      const yb = riverBot(x) + 1;
      set(x, yb, I.MUD); if (bayer(x, yb) < 0.45) set(x, yb + 1, I.MUD); // the near bank
      if (ln(x * 0.4 + 70) > 0.62) for (let k = 0; k < 1 + (x % 3); k += 1) set(x, riverTop(x) - k, k ? I.REED : I.REED_SH);
      if (ln2(x * 0.35 + 90) > 0.68) for (let k = 0; k < 2 + (x % 3); k += 1) set(x, riverBot(x) - k, k % 2 ? I.REED : I.REED_SH);
    }
    for (let y = islet.y - islet.ry - 1; y <= islet.y + islet.ry; y += 1) { // the islet: mud, grass, a bush, reeds
      for (let x = islet.x - islet.rx; x <= islet.x + islet.rx; x += 1) {
        if (!onIslet(x, y)) continue;
        set(x, y, onIslet(x, y - 1) ? (onIslet(x, y + 1) ? I.GRASS : I.MUD) : I.GRASS_HI);
      }
    }
    for (let k = -1; k <= 1; k += 1) set(islet.x + 3 + k, islet.y - islet.ry - 1, I.BUSH);
    set(islet.x + 3, islet.y - islet.ry - 2, I.BUSH_HI);
    [-5, -4, 6].forEach((dx) => { set(islet.x + dx, islet.y - 2, I.REED); set(islet.x + dx, islet.y - 3, I.REED_SH); });
    for (let k = 0; k < Math.round(WE / 70); k += 1) { // stones in the current, foam on their lee
      const x = Math.round(rng() * WE); const y = Math.round(riverTop(x) + 1 + rng() * Math.max(1, riverBot(x) - riverTop(x) - 2));
      if (!isWater(x, y) || Math.abs(x - pathX[clamp(y, 0, H - 1)]) < 12) continue;
      set(x, y, I.STONE); set(x + 1, y, I.STONE_SH); set(x, y - 1, I.STONE_HI); set(x + 2, y, I.WATER_HI); set(x + 3, y + (rng() < 0.5 ? 0 : 1), I.WATER_HI);
    }
    // water lilies in the slack water, west by the hamlet and east by the willow (none in winter)
    if (season !== 'winter') {
      [0.07, 0.15, 0.8, 0.86].forEach((f, j) => {
        const x0 = M + Math.round(f * Ws);
        for (let k = 0; k < 5; k += 1) {
          const x = x0 + Math.round((rng() - 0.5) * 10); const y = riverTop(x) + 2 + Math.floor(rng() * Math.max(1, riverBot(x) - riverTop(x) - 3));
          if (!isWater(x, y) || !isWater(x + 1, y)) continue;
          set(x, y, season === 'autumn' ? I.RUST_SH : I.LILY); set(x + 1, y, season === 'autumn' ? I.RUST : I.LILY);
          if (season !== 'autumn' && (k + j) % 2 === 0) set(x, y - 1, I.LILY_FL);
        }
      });
    }
    { // the bridge: a humped stone deck with parapets, its arch open over the water on the near side
      const yA = Math.min(...[-2, 0, 2].map((d) => riverTop(Math.round(pathX[yl0 + 4]) + d))) - 2;
      const yB = Math.max(...[-2, 0, 2].map((d) => riverBot(Math.round(pathX[yg - 2]) + d))) + 1;
      for (let y = yA; y <= yB; y += 1) {
        const xc = pathX[clamp(y, top, H - 1)]; const hw = pathW[clamp(y, top, H - 1)] + 1.5;
        for (let x = Math.round(xc - hw); x <= Math.round(xc + hw); x += 1) {
          const e = x - (xc - hw);
          const post = (y - yA) % 3 === 0; // parapet posts, a little proud of the rail
          set(x, y, e < 1 ? (post ? I.WALL_DK : I.WALL_HI) : e > 2 * hw - 1 ? (post ? I.WALL_DK : I.WALL_SH) : (y % 2 ? I.PATH : I.PATH_SH));
          if (post && (e < 1 || e > 2 * hw - 1)) set(x + (e < 1 ? -1 : 1), y, I.WALL);
        }
      }
      const xc = pathX[clamp(yB, top, H - 1)]; const hw = pathW[clamp(yB, top, H - 1)] + 1.5;
      for (let x = Math.round(xc - hw); x <= Math.round(xc + hw); x += 1) { // the near face and its arch
        const ax = (x - xc) / (hw - 1);
        set(x, yB + 1, I.WALL); set(x, yB + 2, Math.abs(ax) < 0.75 ? I.WALL_DK : I.WALL_SH);
        if (Math.abs(ax) < 0.55) set(x, yB + 3, I.WATER_HI);
      }
    }

    function blob(x0, y0, rx, ry, [hi, mid, sh], shadow = I.GRASS_SH) {
      for (let y = -ry; y <= ry; y += 1) {
        for (let x = -rx; x <= rx; x += 1) {
          const q = (x / rx) ** 2 + (y / ry) ** 2;
          if (q > 1) continue;
          set(x0 + x, y0 + y, q > 0.7 && x + y > 0 ? sh : x + y < -rx * 0.4 ? hi : x + y > rx * 0.4 ? sh : mid);
        }
      }
      if (shadow !== null) for (let x = -rx + 1; x < rx; x += 1) set(x0 + x, y0 + ry + 1, shadow);
    }
    // the month's field, on the hill west of the castle: ploughed in autumn, ripe in summer,
    // green rows in spring, under snow in winter; its labourer walks it by day (see step)
    // east of the rock (the menu box hangs over the west slope), the path spared
    const rockEast = Math.round(cx + castleW / 2 + 6 * u + (yl0 - crest) * 0.9); // the flank's widest reach
    const field = { x0: rockEast + 3 };
    field.x1 = Math.min(field.x0 + Math.round(0.16 * Ws), M + Ws - 12);
    field.top = (x) => Math.round(hill[clamp(x, 0, WE - 1)]) + 2; // it follows the slope
    field.bot = yl0 - 2;
    if (field.x1 - field.x0 > 12 && field.bot - field.top(field.x1) > 4) {
      // the farming year, day by day (a field of wheat sown in autumn): dormant shoots in winter,
      // green in spring, tall in May, ripening at midsummer, reaped from mid-July (the cut part
      // stubble with its sheaves), stubble, then ploughed from late September, sown in November;
      // `cut` is how far (0..1, from the west edge) the day's work has gone
      const doy = qSeason ? { winter: 20, spring: 100, summer: 190, autumn: 280 }[qSeason] : dayOfYear(today());
      const ramp = (a, b) => clamp((doy - a) / (b - a));
      const stage = doy < 69 ? 'dormant' : doy < 121 ? 'shoots' : doy < 171 ? 'green' : doy < 196 ? 'ripen'
        : doy < 222 ? 'harvest' : doy < 263 ? 'stubble' : doy < 305 ? 'plough' : 'sown';
      const cut = stage === 'harvest' ? ramp(196, 222) : stage === 'plough' ? ramp(263, 305) : 0;
      Object.assign(field, { stage, cut });
      for (let x = field.x0; x <= field.x1; x += 1) {
        const y0 = field.top(x) + (rng() < 0.3 ? 1 : 0); // ragged edges, a rim of grass below
        const y1 = field.bot - 2 - (rng() < 0.4 ? 1 : 0);
        if (y1 - y0 < 2) continue;
        const done = (x - field.x0) / (field.x1 - field.x0) < cut; // west of the day's work
        for (let y = y0; y <= y1; y += 1) {
          if (Math.abs(x - pathX[y]) <= pathW[y] + 2) continue;
          const row = (y + Math.floor(x / 3)) % 2; const b = bayer(x, y); // furrows, gently slanting
          let c;
          if (stage === 'dormant') c = row ? I.FURROW_SH : b < 0.25 ? I.HILL_SH : I.FURROW;
          else if (stage === 'shoots') c = row ? (b < ramp(69, 121) * 0.6 ? I.HILL_SH : I.FURROW_SH) : b < 0.3 + 0.6 * ramp(69, 121) ? I.HILL_HI : I.FURROW;
          else if (stage === 'green') c = row ? I.HILL_SH : b < 0.2 ? I.GRASS_LT : I.HILL_HI;
          else if (stage === 'ripen') c = b < ramp(171, 196) ? (row ? I.WHEAT_SH : I.WHEAT) : (row ? I.HILL_SH : I.HILL_HI);
          else if (stage === 'harvest' && !done) c = row ? I.WHEAT_SH : I.WHEAT;
          else if (stage === 'harvest' || stage === 'stubble') c = row ? I.THATCH_SH : b < 0.3 ? I.FURROW : I.THATCH;
          else if (stage === 'plough') c = done ? (row ? I.FURROW_SH : I.FURROW) : (row ? I.THATCH_SH : b < 0.3 ? I.FURROW : I.THATCH);
          else c = row ? I.FURROW_SH : b < ramp(305, 366) * 0.3 ? I.HILL_SH : I.FURROW; // sown: the first green
          set(x, y, c);
        }
        if (stage === 'harvest' && done && (x - field.x0) % 7 === 3) { // the sheaves, stood up in the stubble
          const ys = Math.round((y0 + y1) / 2); set(x, ys - 2, I.WHEAT); set(x, ys - 1, I.WHEAT_SH); set(x - 1, ys - 1, I.WHEAT); set(x + 1, ys - 1, I.WHEAT); set(x, ys, I.THATCH_SH);
        }
      }
    } else field.none = true;
    field.season = season;

    // a windmill above the field, its sails turning with the real wind over Paris (see draw)
    const mill = { x: field.none ? Math.round(rockEast + 12) : field.x1 - 4 };
    {
      const base = Math.round(hill[clamp(mill.x, 0, WE - 1)]) + 3; const bh = Math.max(10, Math.round(13 * u * 0.85));
      for (let y = 0; y < bh; y += 1) {
        const half = Math.round(3.5 - (y / bh) * 1.4);
        for (let dx = -half; dx <= half; dx += 1) set(mill.x + dx, base - y, dx === -half ? I.WALL_HI : dx === half ? I.WALL_SH : I.WALL);
      }
      const capY = base - bh;
      for (let k = 0; k < 4; k += 1) for (let dx = -(3 - k); dx <= 3 - k; dx += 1) set(mill.x + dx, capY - k, dx < 0 ? I.ROOF_HI : I.ROOF_SH);
      rect(mill.x - 1, base - 3, 2, 3, I.TIMBER_SH); // its door
      mill.win = [mill.x, Math.round(base - bh * 0.6)];
      mill.hub = [mill.x, capY - 1]; mill.len = Math.max(7, Math.round(9 * u * 0.8));
    }

    for (let k = 0; k < WE / 30; k += 1) { // a few bushes on the hill
      const x = Math.round(rng() * WE); const y = Math.round(hill[clamp(x, 0, WE - 1)] + 2 + rng() * 6);
      if ((Math.abs(x - cx) < castleW / 2 + 8) || get(x, y) === I.WATER || get(x, y + 3) === I.WATER || y >= yg - 2) continue;
      if (Math.abs(x - pathX[clamp(y, 0, H - 1)]) < pathW[clamp(y, 0, H - 1)] + 3) continue;
      blob(x, y, 3, 2, [I.BUSH_HI, I.BUSH, I.BUSH_SH], I.HILL_SH);
      if (season === 'spring') { set(x - 1, y - 1, I.BLOSSOM); set(x + 2, y, I.BLOSSOM); }
    }

    /* the castle, back to front: asymmetric, an observatory, a gallery, sentries, a chimney */
    const windows = []; const flags = []; const torches = [];
    const darker = { [I.WALL_HI]: I.WALL, [I.WALL]: I.WALL_SH, [I.WALL_SH]: I.WALL_DK, [I.WALL_DK]: I.WALL_DK };
    const masonry = (x, y, c, t0) => { // courses every third row, staggered joints
      const row = y - t0;
      return row % 3 === 2 && ((x + ((Math.floor(row / 3) & 1) * 2)) & 3) === 0 ? darker[c] : c;
    };
    /** Window of a kind: 0 slit, 1 tall slit, 2 paired lights, 3 great window with a mullion. */
    function windowAt(x, y, kind) {
      const pts = [[x, y + 1]];
      if (kind >= 1) pts.push([x, y], [x, y + 2]);
      if (kind >= 2) pts.push([x + 1, y + 1], [x + 1, y + 2]);
      if (kind === 3) { pts.push([x + 2, y + 1], [x + 2, y + 2], [x, y + 3], [x + 2, y + 3], [x + 1, y]); }
      windows.push({ pts, lit: rng() < 0.3, big: kind >= 2 });
      const sill = kind === 3 ? 3 : kind >= 2 ? 2 : 1;
      for (let k = 0; k < sill; k += 1) set(x + k, y + (kind === 3 ? 4 : kind >= 1 ? 3 : 2), I.WALL_HI);
    }
    function crenels(x0, x1, y) { // merlons of uneven width, one broken here and there
      let x = x0;
      while (x < x1) {
        const w = 1 + Math.floor(rng() * 2.4);
        const broken = rng() < 0.12;
        for (let k = 0; k < w && x + k < x1; k += 1) {
          set(x + k, y - 1, I.WALL);
          if (!broken) set(x + k, y - 2, k === 0 ? I.WALL_HI : I.WALL);
        }
        x += w + 1 + Math.floor(rng() * 1.6);
      }
    }
    function cone(mid, y0, half0, rh, [hi, md, sh]) {
      for (let r = 0; r < rh; r += 1) {
        const half = half0 * (1 - r / rh) ** 0.9;
        for (let x = Math.round(mid - half); x < Math.round(mid + half); x += 1) {
          const k = (x - (mid - half)) / (2 * half);
          let c = k < 0.3 ? hi : k < 0.68 ? md : sh;
          if (r % 2 === 1 && (x + r) % 3 === 0) c = c === hi ? md : sh; // shingles
          set(x, y0 - r, c);
        }
      }
      set(Math.round(mid - 0.5), y0 - rh, I.WALL_DK);
      set(Math.round(mid - 0.5), y0 - rh - 1, I.WALL_DK);
      return y0 - rh - 1;
    }
    function body(x0, ww, t0, round) { // masonry; round towers get a lit band left of centre
      for (let y = t0; y < crest; y += 1) {
        for (let x = x0; x < x0 + ww; x += 1) {
          const k = (x - x0 + 0.5) / ww;
          const c = round
            ? (k < 0.1 ? I.WALL : k < 0.38 ? I.WALL_HI : k < 0.7 ? I.WALL : k < 0.9 ? I.WALL_SH : I.WALL_DK)
            : (k < 0.08 ? I.WALL_HI : k > 0.88 ? I.WALL_SH : I.WALL);
          set(x, y, masonry(x, y, c, t0));
        }
      }
    }
    function tower(dx, w, h, roof, opt = {}) {
      const ww = Math.max(4, Math.round(w * u));
      const x0 = Math.round(cx + dx * u - ww / 2);
      const t0 = Math.round(crest - h * v);
      body(x0, ww, t0, true);
      for (let x = x0 - 1; x <= x0 + ww; x += 1) { // corbelled parapet over machicolations
        set(x, t0, ((x - x0) & 1) ? I.WALL_DK : I.WALL_SH);
        set(x, t0 - 1, x < x0 + ww * 0.4 ? I.WALL_HI : I.WALL);
      }
      if (ww >= 5) {
        const stepY = Math.max(6, Math.round((6 + rng() * 3) * u));
        for (let y = t0 + 4; y < crest - 6; y += stepY) {
          const kind = ww >= 9 ? (rng() < 0.5 ? 2 : 1) : ww >= 6 ? (rng() < 0.6 ? 1 : 0) : 0;
          windowAt(x0 + Math.floor(ww * (0.3 + rng() * 0.25)), y, kind);
        }
      }
      if (roof) {
        const tip = cone(x0 + ww / 2, t0 - 2, ww / 2 + 2, Math.max(4, Math.round(roof * v)),
          opt.slate ? [I.SLATE_HI, I.SLATE, I.SLATE_SH] : [I.ROOF_HI, I.ROOF, I.ROOF_SH]);
        for (let x = x0 - 2; x <= x0 + ww + 1; x += 1) set(x, t0 - 1, I.WALL_DK); // eave
        if (opt.flag) flags.push({ x: Math.round(x0 + ww / 2 + 0.5), y: tip, c: opt.flag, long: opt.long });
      } else {
        crenels(x0 - 1, x0 + ww + 1, t0 - 1);
      }
      return { x0, ww, t0 };
    }
    let scope = null; // the observatory's telescope: drawn each frame, aimed (see draw)
    function observatory(dx, w, h) { // a round tower under a verdigris dome, its glass out
      const ww = Math.max(6, Math.round(w * u)); const x0 = Math.round(cx + dx * u - ww / 2);
      const t0 = Math.round(crest - h * v);
      body(x0, ww, t0, true);
      for (let x = x0 - 1; x <= x0 + ww; x += 1) set(x, t0, ((x - x0) & 1) ? I.WALL_DK : I.WALL_SH);
      const r = ww / 2 + 1; const mid = x0 + ww / 2 - 0.5;
      for (let y = 0; y <= r; y += 1) {
        for (let x = -Math.ceil(r); x <= r; x += 1) {
          if (x * x + y * y > r * r) continue;
          const k = (x + r) / (2 * r);
          set(mid + x, t0 - 1 - y, k < 0.3 ? I.DOME_HI : k < 0.7 ? I.DOME : I.DOME_SH);
        }
      }
      for (let y = 1; y < r * 0.8; y += 1) set(mid + 1, t0 - 1 - y, I.OUTLINE); // the slit
      scope = { x: Math.round(mid + 1), y: t0 - Math.round(r * 0.55), slit: Math.round(r * 0.8), t0 };
      set(mid, t0 - 2 - r, I.WALL_DK); set(mid, t0 - 3 - r, I.WALL_DK); // vane
      flags.push({ x: Math.round(mid + 1), y: Math.round(t0 - 3 - r), c: I.FLAG3, long: true });
      const stepY = Math.max(6, Math.round(7 * u));
      for (let y = t0 + 4; y < crest - 6; y += stepY) windowAt(Math.round(mid - 1), y, 0);
      return { x0, ww, t0 };
    }
    function keep(dx, w, h) { // square donjon, flat faces, windows of two sizes
      const ww = Math.round(w * u); const x0 = Math.round(cx + dx * u - ww / 2); const t0 = Math.round(crest - h * v);
      body(x0, ww, t0, false);
      for (let x = x0 - 1; x <= x0 + ww; x += 1) { set(x, t0, ((x - x0) & 1) ? I.WALL_DK : I.WALL_SH); set(x, t0 - 1, I.WALL); }
      crenels(x0 - 1, x0 + ww + 1, t0 - 1);
      const stepY = Math.max(7, Math.round(8 * u));
      let row = 0;
      for (let y = t0 + 5; y < crest - 7; y += stepY, row += 1) {
        windowAt(x0 + Math.round(ww * 0.2), y, row % 2 ? 1 : 2);
        windowAt(x0 + Math.round(ww * 0.62), y, row === 1 ? 3 : 1);
      }
      return { x0, ww, t0 };
    }
    function hall(dx0, dx1, h, roof) { // long hall, slate roof seen side-on, great windows, a chimney
      const x0 = Math.round(cx + dx0 * u); const x1 = Math.round(cx + dx1 * u); const t0 = Math.round(crest - h * v);
      for (let y = t0; y < crest; y += 1) {
        for (let x = x0; x < x1; x += 1) set(x, y, masonry(x, y, x === x0 ? I.WALL_HI : I.WALL, t0));
      }
      const rh = Math.max(4, Math.round(roof * v));
      for (let r = 0; r < rh; r += 1) {
        const a = Math.round(x0 - 1 + r * 0.7); const b = Math.round(x1 + 1 - r * 0.7);
        for (let x = a; x <= b; x += 1) set(x, t0 - 1 - r, x === a || r === rh - 1 ? I.SLATE_HI : r % 2 ? I.SLATE : I.SLATE_SH);
      }
      for (let x = x0 + 3; x < x1 - 3; x += Math.max(5, Math.round(6 * u))) windowAt(x, t0 + 3, 3);
      const chx = Math.round(x1 - 4 * u); const cht = t0 - rh - 3;
      rect(chx, cht, 2, rh + 2, I.WALL); set(chx + 1, cht, I.WALL_SH); rect(chx - 1, cht - 1, 4, 1, I.WALL_DK);
      return { x: chx + 0.5, y: cht - 2 };
    }
    function gallery(xa, xb, y) { // a covered timber walk between two towers
      for (let x = xa; x <= xb; x += 1) {
        set(x, y - 4, I.SLATE_HI); set(x, y - 3, I.SLATE);
        set(x, y - 2, (x - xa) % 3 ? I.TIMBER : I.TIMBER_SH);
        set(x, y - 1, (x - xa) % 3 ? I.TIMBER_HI : I.TIMBER_SH);
        set(x, y, I.TIMBER_SH);
        if ((x - xa) % 3 === 0) set(x, y + 1, I.TIMBER_SH); // corbels
      }
      for (let x = xa + 2; x < xb - 1; x += 3) windows.push({ pts: [[x, y - 2]], lit: rng() < 0.5 });
    }

    const rooms = {};
    const room = (id, x, y, w, h) => { rooms[id] = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }; };
    const obs = observatory(-19, 7, 47);
    room('research', obs.x0 - 1, obs.t0 - obs.ww / 2 - 5, obs.ww + 2, crest - obs.t0 + obs.ww / 2 + 5);
    const castleTop = Math.round(crest - 56 * v - 15 * v - 4); // over the tallest spire
    const tall = tower(9, 8, 56, 15, { flag: I.FLAG2 });
    // the belfry: an opening high in the tall tower, where the bell hangs (rung each planetary hour)
    const bell = { x: tall.x0 + Math.floor(tall.ww / 2), y: tall.t0 + 2 };
    rect(bell.x - 2, bell.y - 1, 5, 6, I.OUTLINE); set(bell.x - 2, bell.y - 1, I.WALL_SH); set(bell.x + 2, bell.y - 1, I.WALL_SH);
    rect(bell.x - 3, bell.y + 5, 7, 1, I.WALL_HI);
    const tallTip = flags.find((f) => f.c === I.FLAG2);
    room('talks', tall.x0 - 2, tall.t0 - 15 * v - 3, tall.ww + 4, (crest - tall.t0) * 0.55 + 15 * v + 3);
    const nWin = windows.length; const kp = keep(-2, 14, 37);
    const scribeWin = windows.slice(nWin).find((w) => w.pts.length === 10); // the scriptorium's great window (kind 3: ten panes)
    const keepTop = { x: kp.x0 + Math.floor(kp.ww / 2), y: kp.t0 - 3 }; // where the visitor's banner goes up
    room('about', kp.x0, kp.t0 - 3, kp.ww, crest - kp.t0 - 12 * v);
    const pep = tower(-8.5, 3.5, 44, 7, { slate: true }); // a pepperpot turret on the keep's corner
    room('news', pep.x0 - 2, pep.t0 - 7 * v - 3, pep.ww + 4, 7 * v + 10);
    gallery(obs.x0 + obs.ww, kp.x0 - 1, Math.round(crest - 31 * v));
    const chimney = hall(6, 20, 25, 9);
    room('publications', cx + 6 * u, crest - 25 * v - 9 * v, 7 * u, 25 * v + 9 * v - 12 * v);
    room('projects', cx + 13 * u, crest - 25 * v - 9 * v - 4, 7 * u, 25 * v + 13 * v - 12 * v);
    const right = tower(21, 9, 39, 13, { flag: I.FLAG });
    room('teaching', right.x0 - 1, right.t0 - 13 * v, right.ww + 2, crest - right.t0 + 13 * v - 12 * v);
    // curtain wall: uneven crenellations, walkway, banners, ivy
    const wTop = Math.round(crest - 12 * v);
    const wx0 = Math.round(cx - castleW / 2); const wx1 = Math.round(cx + castleW / 2);
    for (let y = wTop; y < crest; y += 1) {
      for (let x = wx0; x < wx1; x += 1) set(x, y, masonry(x, y, y === wTop ? I.WALL_HI : I.WALL, wTop));
    }
    crenels(wx0, wx1, wTop);
    for (let x = wx0; x < wx1; x += 1) set(x, wTop + 1, ((x - wx0) % 2) ? I.WALL_DK : I.WALL_SH);
    // the wall flies the colours of the three schools of now (Saclay prune, Sorbonne navy,
    // Dauphine blue), each charged with a pale argent, swallow-tailed
    [[-0.36, I.T_PRUNE], [-0.22, I.T_NAVY], [0.27, I.T_AZURE]].forEach(([f, field], k) => {
      const bx = Math.round(cx + f * castleW); const bh = Math.max(6, Math.round((k === 1 ? 9 : 7) * v));
      for (let y = 0; y < bh; y += 1) {
        for (let x = 0; x < 3; x += 1) {
          if (y === bh - 1 && x === 1) continue;
          set(bx + x, wTop + 2 + y, x === 1 ? I.T_ARGENT : x === 2 && y % 2 ? I.OUTLINE : field);
        }
      }
    });
    for (let k = 0; k < 6; k += 1) { // ivy climbing from the foot of the wall
      const ix = Math.round(wx0 + rng() * castleW); const ih = (3 + rng() * 7) * v;
      for (let y = crest - 1; y > crest - ih; y -= 1) {
        for (let x = -2; x <= 2; x += 1) {
          if (bayer(ix + x, y) < 0.55 * (1 - (crest - y) / ih)) set(ix + x, y, (x + y) % 3 ? I.IVY : I.IVY_SH);
        }
      }
    }
    tower(-23, 8, 25, 10, { flag: I.FLAG, long: true });
    tower(24, 7, 20, 0); // the other corner, unroofed: the castle is not symmetrical
    tower(-5.5, 4.5, 17, 6);
    tower(5.5, 4.5, 15, 6);
    const gw = Math.max(4, Math.round(5 * u)); const gh = Math.max(5, Math.round(8 * v));
    const gx = Math.round(cx + 1 - gw / 2);
    for (let y = 0; y < gh; y += 1) {
      for (let x = 0; x < gw; x += 1) {
        const ex = (x + 0.5 - gw / 2) / (gw / 2); const ey = (y - gw / 2) / (gw / 2);
        if (y < gw / 2 && ex * ex + ey * ey > 1) continue;
        const grid = x % 2 === 1 || (gh - y) % 3 === 0;
        set(gx + x, crest - gh + y, grid && y > 1 ? I.WALL_SH : I.WALL_DK);
      }
    }
    torches.push({ x: gx - 2, y: crest - Math.round(gh * 0.6) }, { x: gx + gw + 1, y: crest - Math.round(gh * 0.6) });
    room('contact', gx - 6 * u, crest - 17 * v - 6 * v, gw + 12 * u, 17 * v + 6 * v);
    torches.forEach((tc) => set(tc.x, tc.y + 1, I.WALL_DK));
    const sentries = [ // they walk the curtain wall, behind the merlons
      { x: wx0 + 4, a: wx0 + 3, b: cx - gw, v: 0.07, pause: 0, wall: wTop },
      { x: wx1 - 6, a: cx + gw, b: wx1 - 3, v: -0.06, pause: 0, wall: wTop },
    ];

    // a village by the river, west of the castle: a back row up the slope (a barn, a dovecote, a
    // cottage), then along the bank cottages under thatch, the chapel and its spire, a well, the
    // forge and the tavern; chimneys smoke, windows and lanterns light up after dark
    const hamlet = { x0: M + Math.round(0.05 * Ws), x1: 0 }; const nWin0 = windows.length;
    const chimneys = []; const doors = []; const eaves = []; let spire = null;
    windows.push({ pts: [mill.win], lit: true });
    {
      const baseAt = (x, w) => Math.min(...Array.from({ length: w }, (_, k) => riverTop(x + k))) - 2;
      const walls = (x, yb, w, h, [hi, mid, sh]) => {
        for (let yy = yb - h + 1; yy <= yb; yy += 1) for (let xx = x; xx < x + w; xx += 1) set(xx, yy, xx === x ? hi : xx === x + w - 1 ? sh : mid);
      };
      const gable = (x, yb, w, h, R) => { // a gable roof seen from the side, overhanging; returns its height
        const rh = Math.ceil(w / 3);
        for (let k = 0; k < rh; k += 1) for (let xx = x - 1 + k; xx <= x + w - k; xx += 1) set(xx, yb - h - k, k === rh - 1 || xx > x + w / 2 ? R[1] : R[0]);
        return rh;
      };
      const chimney = (chx, yb, h, rh) => { rect(chx, yb - h - rh - 1, 1, rh, I.WALL_SH); chimneys.push({ x: chx, y: yb - h - rh - 2 }); };
      const WALLS = [I.WALL_HI, I.WALL, I.WALL_SH]; const STONE3 = [I.ROCK_HI, I.ROCK, I.ROCK_SH];
      const THATCH = [I.THATCH, I.THATCH_SH]; const TILES = [I.ROOF_HI, I.ROOF_SH]; const SLATES = [I.SLATE_HI, I.SLATE_SH];
      const places = {};
      function building(x, yb, w, h, kind, j) {
        if (!places[kind]) places[kind] = { x, yb, w, h };
        if (kind === 'well') { // a stone ring, two posts, a little roof, the bucket
          set(x, yb - 1, I.ROCK_HI); set(x + 1, yb - 1, I.OUTLINE); set(x + 2, yb - 1, I.ROCK_SH);
          set(x, yb, I.ROCK); set(x + 1, yb, I.ROCK); set(x + 2, yb, I.ROCK_SH);
          rect(x, yb - 4, 1, 3, I.TIMBER_SH); rect(x + 2, yb - 4, 1, 3, I.TIMBER_SH); set(x + 1, yb - 3, I.GOLD_SH);
          rect(x - 1, yb - 5, 5, 1, I.ROOF_SH); set(x - 1, yb - 5, I.ROOF_HI);
          return;
        }
        if (kind === 'lamp') { rect(x, yb - 4, 1, 5, I.TIMBER_SH); set(x + 1, yb - 4, I.TIMBER_SH); set(x + 1, yb - 3, I.ARM_SH); windows.push({ pts: [[x + 1, yb - 3]], lit: true }); return; }
        if (kind === 'chapel') { // a narrow nave and its spire, a bell under the cap
          walls(x, yb, w, h, WALLS);
          for (let k = 0; k < 6; k += 1) for (let dx = -Math.floor(k / 2); dx <= Math.floor(k / 2); dx += 1) set(x + 2 + dx, yb - h - 6 + k, dx < 0 ? I.SLATE_HI : I.SLATE_SH);
          set(x + 2, yb - h - 7, I.GOLD); set(x + 2, yb - h + 2, I.GOLD_SH); spire = [x + 2, yb - h - 8];
          set(x + 2, yb - 5, I.T_GULES); set(x + 2, yb - 4, I.T_AZURE); set(x + 2, yb - 3, I.T_OR); // its stained-glass slit
          return;
        }
        if (kind === 'dovecote') { // a round tower of the birds, its cap pointed, holes under the eaves
          walls(x, yb, w, h, WALLS);
          for (let k = 0; k < 5; k += 1) for (let dx = -Math.floor(k / 2); dx <= Math.floor(k / 2) + 1; dx += 1) set(x + 1 + dx, yb - h - 4 + k, dx <= 0 ? I.ROOF_HI : I.ROOF_SH);
          set(x + 1, yb - h + 2, I.OUTLINE); set(x + 2, yb - h + 2, I.OUTLINE); set(x + 1, yb - h + 4, I.OUTLINE);
          return;
        }
        if (kind === 'barn') { // planks, the great doors crossed, hay under thatch
          for (let yy = yb - h + 1; yy <= yb; yy += 1) for (let xx = x; xx < x + w; xx += 1) set(xx, yy, (xx - x) % 2 ? I.TIMBER_SH : I.TIMBER);
          const dx0 = x + Math.floor(w / 2) - 2;
          for (let k = 0; k < 4; k += 1) { set(dx0 + k, yb - 3 + k, I.TIMBER_HI); set(dx0 + 3 - k, yb - 3 + k, I.TIMBER_HI); }
          gable(x, yb, w, h, THATCH); set(x + 2, yb - h - 1, I.FL_YEL);
          return;
        }
        if (kind === 'forge') { // stone, a slate roof, its mouth open on the fire, the anvil before it
          walls(x, yb, w, h, STONE3);
          const rh = gable(x, yb, w, h, SLATES);
          rect(x + 1, yb - 3, 4, 3, I.OUTLINE); set(x + 2, yb - 1, I.RUST_HI); set(x + 3, yb - 1, I.FL_YEL); set(x + 2, yb - 2, I.RUST);
          windows.push({ pts: [[x + 3, yb - 1]], lit: true }); // the fire: it glows by day and night
          set(x + 6, yb - 1, I.ARM_SH); set(x + 5, yb - 1, I.ARM_SH); set(x + 6, yb, I.OUTLINE);
          rect(x + w - 2, yb - h - rh - 3, 2, rh + 2, I.ROCK_SH); chimneys.push({ x: x + w - 2, y: yb - h - rh - 4 });
          eaves.push([x - 1, x + w, yb - h]);
          return;
        }
        walls(x, yb, w, h, WALLS);
        if (kind === 'tavern') { // two storeys, timber-framed, the upper one jutting; its sign on a bracket
          rect(x, yb - 4, w, 1, I.TIMBER_SH);
          for (let yy = yb - h + 1; yy < yb - 4; yy += 1) { set(x - 1, yy, I.WALL_HI); set(x + w, yy, I.WALL_SH); set(x + 3, yy, I.TIMBER_SH); set(x + w - 4, yy, I.TIMBER_SH); }
          set(x + 1, yb - 6, I.TIMBER_SH); set(x + 2, yb - 7, I.TIMBER_SH); // a brace
          windows.push({ pts: [[x + 5, yb - 7], [x + 1, yb - 2], [x + w - 2, yb - 2]], lit: true, village: true, tavern: true });
          set(x + w, yb - 6, I.TIMBER_SH); set(x + w + 1, yb - 6, I.TIMBER_SH); rect(x + w + 1, yb - 5, 2, 2, I.GOLD); set(x + w + 2, yb - 4, I.GOLD_SH);
        }
        const rh = gable(x, yb, w, h, kind === 'thatch' ? THATCH : TILES);
        chimney(x + (j % 2 ? 2 : w - 3), yb, h, rh);
        const dxd = kind === 'tavern' ? Math.floor(w / 2) - 1 : 1 + (j % 3);
        set(x + dxd, yb - 1, I.TIMBER_SH); set(x + dxd, yb - 2, I.TIMBER_SH); // a door
        doors.push([x + dxd, yb]); eaves.push([x - 1, x + w, yb - h]);
        if (kind !== 'tavern') windows.push({ pts: [[x + w - 3, yb - 3]], lit: rng() < 0.6, village: true });
      }
      // the back row first, up the slope: the bank's row stands in front of it
      [[3, 10, 6, 'barn'], [24, 4, 11, 'dovecote'], [40, 8, 5, 'roof'], [63, 7, 5, 'thatch']].forEach(([dx, w, h, kind], j) => {
        const x = hamlet.x0 + dx; building(x, baseAt(x, w) - 6, w, h, kind, j + 1);
      });
      let x = hamlet.x0;
      [[9, 6, 'thatch'], [5, 9, 'chapel'], [1, 0, 'lamp'], [11, 6, 'roof'], [3, 4, 'well'], [8, 6, 'forge'], [10, 9, 'tavern'], [1, 0, 'lamp'], [8, 5, 'thatch']]
        .forEach(([w, h, kind], j) => {
          building(x, baseAt(x, w), w, h, kind, j);
          x += w + (kind === 'tavern' ? 4 : 2); // (room for the tavern's sign)
        });
      hamlet.x1 = x; hamlet.places = places;
    }
    /* the village's lights at night as a spin glass (Sherrington-Kirkpatrick: each pair of houses
       coupled at random, for or against, J ~ N(0, 1/N)); annealed through the night (see step) */
    const glass = { wins: windows.slice(nWin0), J: null, s: null, T: 2, E: 0 };
    {
      const rg = mulberry32(1987); // (its own seed: the scene's draws after this stay as they were)
      const N = glass.wins.length; const g = () => Math.sqrt(-2 * Math.log(1 - rg())) * Math.cos(6.283 * rg()); // (a normal draw)
      glass.J = new Float32Array(N * N); for (let i = 0; i < N; i += 1) for (let j = i + 1; j < N; j += 1) { const v = g() / Math.sqrt(N); glass.J[i * N + j] = v; glass.J[j * N + i] = v; }
      glass.s = Int8Array.from({ length: N }, () => (rg() < 0.5 ? -1 : 1)); glass.wins.forEach((w) => { w.glass = true; });
    }

    // pines on the hill, smaller and sparser with distance
    function pine(xc, yb, h, [hi, mid, sh]) {
      const trunk = Math.max(1, Math.round(h * 0.08));
      rect(xc, yb - trunk, 1, trunk, I.DIRT_SH);
      const tiers = Math.max(2, Math.round(h / 7));
      const th = (h - trunk) / tiers;
      for (let r = 0; r < h - trunk; r += 1) {
        const y = yb - trunk - r;
        const inTier = (r - Math.floor(r / th) * th) / th; // 0 at a tier's skirt
        const half = (h * 0.24) * (1 - r / (h - trunk)) * (1 - 0.35 * inTier) + 0.5;
        for (let x = Math.round(xc - half); x <= Math.round(xc + half); x += 1) {
          const k = (x - (xc - half)) / (2 * half + 1e-9);
          let c = k < 0.2 && bayer(x, y) < 0.6 ? hi : k > 0.55 ? sh : mid;
          if (inTier < 0.15 && bayer(x, y) < 0.5) c = sh;
          set(x, y, c);
        }
      }
    }
    const mids = [];
    for (let k = 0; k < Math.round(WE / 5); k += 1) {
      const x = Math.round(rng() * WE);
      if (Math.abs(x - cx) < castleW / 2 + 5) continue;
      const hx = hill[clamp(x, 0, WE - 1)];
      const yb = Math.round(hx + 3 + rng() * Math.max(1, yl0 - hx - 3));
      if (get(x, yb) === I.WATER) continue;
      if (!field.none && x >= field.x0 - 3 && x <= field.x1 + 3 && yb <= field.bot + 6) continue;
      if (x > hamlet.x0 - 4 && x < hamlet.x1 + 4) continue; // the hamlet's clearing
      if (Math.abs(x - mill.x) < 8) continue;
      mids.push([x, yb, (6 + rng() * 9) * u * (0.6 + (0.4 * (yb - top)) / (yl0 - top + 1))]);
    }
    mids.sort((a, b) => a[1] - b[1]).forEach(([x, yb, h], k) => ((x * 7 + k) % 3 === 0
      ? broadleaf(x, yb, Math.max(5, h * 0.8)) : pine(x, yb, Math.max(5, h), [I.PINE_HI, I.PINE, I.PINE_SH])));

    /* GROUND: the meadow, denser in detail towards the viewer */
    on(L.GROUND);
    const gn = fbm(rng, 3); const gn2 = fbm(rng, 3);
    const near = (y) => clamp((y - yg) / (H - yg)); // 0 at the meadow's top, 1 at the bottom
    for (let y = yg; y < H; y += 1) {
      for (let x = 0; x < WE; x += 1) {
        const t = patch(gn, gn2, x, y);
        set(x, y, y === yg ? I.GRASS_HI : t > 0.6 ? I.GRASS_SH : (t < 0.25 && bayer(x, y) > 0.5) ? I.GRASS_HI : I.GRASS);
      }
    }
    for (let x = 0; x < WE; x += 1) { // its far edge is ragged, grass over the bank (not the path)
      if (Math.abs(x - pathX[yg]) <= pathW[yg] + 2) continue;
      const h = Math.floor(gn(x * 0.3 + 11) * 4 + (bayer(x, yg) < 0.3 ? 1 : 0));
      for (let k = 1; k <= h; k += 1) set(x, yg - k, k === h ? I.GRASS_HI : I.GRASS);
    }
    for (let y = yg; y < H; y += 1) drawPath(y);
    const meadow = (x, y) => [I.GRASS, I.GRASS_SH, I.GRASS_HI].includes(get(x, y, L.GROUND)) && y > yg;
    const watchers = (x, y) => x > fire.x - 76 && x < fire.x + 34 && y > fire.y - 36 && y < fire.y + 18;
    // the knight's track, trodden down from the path to the fire
    for (let k = 0; k <= 40; k += 1) {
      const t = k / 40;
      const x = fire.x + 12 + (pathX[fire.y + 3] - fire.x - 12) * t; const y = fire.y + 3 + Math.sin(t * 3) * 2;
      for (let dx = -1; dx <= 1; dx += 1) if (bayer(Math.round(x + dx), Math.round(y)) < 0.45) set(x + dx, y, I.DIRT);
    }
    for (let k = 0; k < WE * 1.6; k += 1) { // tufts: little v's, more of them near
      const x = Math.floor(rng() * WE); const y = yg + 2 + Math.floor((rng() ** 0.6) * (H - yg - 2));
      if (!meadow(x, y) || rng() > 0.3 + 0.7 * near(y)) continue;
      set(x, y, I.GRASS_SH); set(x - 1, y - 1, I.GRASS_HI); set(x + 1, y - 1, I.GRASS_HI);
    }
    const FL = [I.FL_RED, I.FL_YEL, I.FL_WHITE, I.FL_BLUE, I.FL_VIOLET];
    for (let k = 0; k < WE / 3; k += 1) { // flowers in small clusters of one colour
      const x0 = rng() * WE; const y0 = yg + 3 + (rng() ** 0.7) * (H - yg - 4); const c = FL[Math.floor(rng() * FL.length)];
      const n = 2 + Math.round(5 * near(y0));
      for (let j = 0; j < n; j += 1) {
        const x = Math.round(x0 + (rng() - 0.5) * 8); const y = Math.round(y0 + (rng() - 0.5) * 3);
        if (!meadow(x, y) || watchers(x, y)) continue;
        set(x, y, c);
        if (near(y) > 0.5) { set(x, y + 1, I.GRASS_SH); if (rng() < 0.5) set(x + 1, y, c); } // nearer: bigger heads, stems
      }
    }
    for (let k = 0; k < WE / 30; k += 1) {
      const x = Math.round(rng() * WE); const y = Math.round(yg + 4 + rng() * (H - yg - 6));
      if (meadow(x, y) && !watchers(x, y) && Math.abs(x - pathX[y]) > pathW[y] + 3) {
        blob(x, y, 2 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 2), [I.STONE_HI, I.STONE, I.STONE_SH]);
        if (rng() < 0.5) set(x - 1, y - 1, I.MOSS);
      }
    }
    for (let k = 0; k < WE / 26; k += 1) { // bushes along the meadow's far edge
      const x = Math.round(rng() * WE); const y = Math.round(yg + 1 + rng() * 4);
      if (watchers(x, y) || Math.abs(x - pathX[y]) < pathW[y] + 3) continue;
      blob(x, y, 3 + Math.floor(rng() * 2), 2 + Math.floor(rng() * 2), [I.BUSH_HI, I.BUSH, I.BUSH_SH]);
    }

    // a great oak on the near bank, east of the bridge: a crown of clumps, each lit from the
    // west and each its own shade of the season (no single block of colour); bare in winter
    let bigOak = null;
    {
      const wy = yg + 6; let wx = M + Math.round(0.84 * Ws);
      while (Math.abs(wx - pathX[wy]) < pathW[wy] + 18 && wx < M + Ws) wx += 2; // clear of the path
      const h = Math.round(0.19 * H); const trunk = Math.round(h * 0.42);
      bigOak = { x: wx, y: wy, h };
      rect(wx - 1, wy - trunk, 3, trunk, I.BARK); set(wx - 1, wy - trunk, I.DIRT_SH); set(wx - 2, wy, I.BARK); set(wx + 2, wy, I.BARK);
      [[-1, 0.62], [1, 0.58]].forEach(([dir, f]) => { for (let k = 0; k < h * 0.22; k += 1) set(wx + dir * (1 + k), Math.round(wy - trunk - k * 0.9 + h * 0.08 * f), I.BARK); });
      const PAL = season === 'autumn' ? [[I.RUST_HI, I.RUST, I.RUST_SH], [I.LEAF2, I.RUST_HI, I.RUST], [I.OAK_HI, I.OAK, I.OAK_SH], [I.RUST_HI, I.RUST, I.RUST_SH]]
        : [[I.OAK_HI, I.OAK, I.OAK_SH]];
      const clumps = [[0, -0.92, 0.15], [-0.2, -0.84, 0.14], [0.21, -0.83, 0.14], [-0.36, -0.68, 0.13], [0.37, -0.67, 0.13],
        [-0.12, -0.7, 0.15], [0.12, -0.72, 0.15], [-0.42, -0.52, 0.11], [0.43, -0.53, 0.11], [-0.2, -0.53, 0.13], [0.22, -0.54, 0.12], [0, -0.57, 0.14]];
      if (season === 'winter') {
        clumps.forEach(([fx, fy]) => { for (let k = 0; k < 6; k += 1) set(wx + Math.round(fx * h * (k / 5)), Math.round(wy - trunk - (fy * -h - trunk) * (k / 5) * 0.9), I.BARK); });
      } else {
        clumps.forEach(([fx, fy, fr], j) => {
          const P = PAL[j % PAL.length]; const R = fr * h; const cx0 = wx + fx * h; const cy0 = wy + fy * h;
          for (let dy = -Math.ceil(R); dy <= R; dy += 1) for (let dx = -Math.ceil(R); dx <= R; dx += 1) {
            const x = Math.round(cx0 + dx); const y = Math.round(cy0 + dy); const q = (dx * dx + dy * dy) / (R * R);
            if (q + (bayer(x, y) - 0.5) * 0.35 > 1) continue;
            let c = dx + dy < -R * 0.45 ? P[0] : dx + dy > R * 0.35 || q > 0.75 && dy > 0 ? P[2] : P[1];
            if (bayer(x * 3, y * 5) < 0.12) c = c === P[1] ? P[2] : P[1]; // leaves, not a flat fill
            if (season === 'spring' && bayer(x, y) < 0.08) c = I.BLOSSOM;
            set(x, y, c);
          }
        });
      }
      for (let x = -9; x <= 9; x += 1) if (bayer(x, 1) < 0.5) set(wx + x, wy + 1, I.GRASS_SH); // its shade
    }

    // the bonfire: scorched ground, a ring of stones, a sword driven into the coals
    for (let y = -4; y <= 4; y += 1) {
      for (let x = -11; x <= 11; x += 1) {
        if ((x / 11) ** 2 + (y / 4) ** 2 < 1 && bayer(x, y) < 0.7) set(fire.x + x, fire.y + y, I.DIRT_SH);
      }
    }
    for (let k = 0; k < 11; k += 1) {
      const a = (k / 11) * 2 * Math.PI;
      const sx = Math.round(fire.x + Math.cos(a) * 8); const sy = Math.round(fire.y + Math.sin(a) * 3);
      rect(sx - 1, sy - 1, 3, 2, I.STONE); set(sx - 1, sy - 1, I.STONE_HI); rect(sx - 1, sy + 1, 3, 1, I.STONE_SH);
    }
    const bx = fire.x + 1; const tip = fire.y - 1; const blade = 13;
    rect(bx, tip - blade, 1, blade, I.BLADE); rect(bx + 1, tip - blade, 1, blade, I.BLADE_SH);
    rect(bx - 3, tip - blade, 8, 1, I.HILT); rect(bx, tip - blade - 4, 2, 4, I.HILT); set(bx, tip - blade - 5, I.BLADE_SH);
    // firewood stacked by the ring
    for (let k = 0; k < 3; k += 1) rect(fire.x + 10, fire.y + 1 - k * 2 + (k === 1 ? 0 : 0), 6 - k, 2, k % 2 ? I.DIRT : I.DIRT_SH);

    // the watchers and their shadows
    const kn = SPRITES.knight; const wz = SPRITES.wizard;
    const knight = { x: fire.x - 9 - kn.w, y: fire.y + 4 - kn.h };
    const wizard = { x: knight.x - wz.w - 2, y: fire.y + 6 - wz.h };
    const C = SPRITES.cats; const low = (dy, s0) => Math.min(H - 1, fire.y + dy) - s0.h;
    // each cat lives in one place: these two by the fire; the thin black one in the observatory,
    // the white one in the library
    const cats = [ // [sprite, x, y]: by the fire, at the knight's feet
      [C.blackLoaf, fire.x + 13, low(6, C.blackLoaf)],
      [C.spotted, knight.x + 16, low(12, C.spotted)],
    ].map(([sp, x, y], k) => ({ sp, x, y, ph: k * 1.7 }));
    { // in memory of Blanc Blanc (the spotted cat, d. night of 6-7 October 2026): forget-me-nots
      // around him, in every season; he himself is left exactly as he was
      const bb = cats[1]; const yb = bb.y + bb.sp.h;
      [[-3, -1], [-5, 1], [bb.sp.w + 1, -2], [bb.sp.w + 3, 0], [3, 2], [7, 3]].forEach(([dx, dy]) => {
        const x = bb.x + dx; const y = yb + dy;
        set(x, y + 1, I.GRASS_SH); set(x, y + 2, I.GRASS_SH); // the stem
        set(x, y, I.FL_YEL); set(x - 1, y, I.FL_BLUE); set(x + 1, y, I.FL_BLUE); set(x, y - 1, I.FL_BLUE); set(x, y + 1, I.FL_BLUE);
      });
    }
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -13; x <= 13; x += 1) {
        if ((x / 13) ** 2 + (y / 2) ** 2 < 1 && bayer(x, y) < 0.5) {
          set(knight.x + kn.w * 0.45 + x, fire.y + 4 + y, I.GRASS_SH);
          if (Math.abs(x) < 8) set(wizard.x + wz.w * 0.4 + x, fire.y + 6 + y, I.GRASS_SH);
        }
      }
    }

    // the knight's horse grazes east of the fire (tail swishing, see draw), clear of the path
    // (east of the cat if the path leaves room, else west of the wizard)
    const hsp = SPRITES.horse[0]; const hpy = clamp(fire.y + 6, 0, H - 1);
    const horse = { x: fire.x + 28, y: fire.y + 9 - hsp.h };
    if (horse.x + hsp.w > pathX[hpy] - pathW[hpy] - 3) horse.x = wizard.x - hsp.w - 4;
    for (let x = 2; x < hsp.w - 2; x += 1) if (bayer(x, 0) < 0.6) set(horse.x + x, fire.y + 8, I.GRASS_SH); // its shadow
    // deer come out at the forest's edge at dawn and dusk (west, on the meadow's far rim)
    const deer = [0.1, 0.155].map((f, k) => ({ x: M + Math.round(f * Ws), y: yg + 6 + k * 3, ph: k * 2.3 }));

    /* FG: the nearest plane, the big pines; at their feet, drawn into the meadow so they stay where
       they stand as it slides (a plane of their own slid faster and they drifted over the path):
       mossy rocks, mushrooms, ferns, a stump, a fallen branch */
    on(L.GROUND);
    const FGP = [I.FG_PINE_HI, I.FG_PINE, I.FG_PINE_SH];
    const free = (x, y = H - 1) => !(x > fire.x - 70 && x < fire.x + 22) && Math.abs(x - pathX[Math.min(H - 1, y)]) > pathW[Math.min(H - 1, y)] + 6;
    function mossyRock(x0, y0, rx, ry) {
      blob(x0, y0, rx, ry, [I.STONE_HI, I.STONE, I.STONE_SH], null);
      for (let x = -rx + 1; x < rx; x += 1) { // moss on its crown, lit at the top
        const yTop = y0 - Math.floor(ry * Math.sqrt(1 - (x / rx) ** 2));
        set(x0 + x, yTop, bayer(x0 + x, yTop) < 0.5 ? I.MOSS_HI : I.MOSS);
        if (rng() < 0.6) set(x0 + x, yTop + 1, I.MOSS);
      }
    }
    function mushroom(x, y, red) {
      const cap = red ? [I.CAP, I.CAP_SH] : [I.CAP_BR, I.DIRT_SH];
      set(x, y, I.STEM); set(x, y - 1, I.STEM);
      for (let dx = -2; dx <= 2; dx += 1) set(x + dx, y - 2, Math.abs(dx) === 2 ? cap[1] : cap[0]);
      for (let dx = -1; dx <= 1; dx += 1) set(x + dx, y - 3, cap[0]);
      if (red) { set(x - 1, y - 3, I.FL_WHITE); set(x + 1, y - 2, I.FL_WHITE); }
    }
    function fern(x0, y0, h, dir) {
      for (let r = 0; r < h; r += 1) {
        const x = x0 + dir * Math.round((r / h) ** 2 * h * 0.6); const y = y0 - r;
        set(x, y, I.FERN);
        if (r % 2 === 0 && r < h - 1) { set(x - 1, y, I.FERN_SH); set(x + 1, y, I.FERN); set(x + 2 * dir, y + 1, I.FERN_SH); }
      }
    }
    for (let k = 0; k < Math.max(2, Math.round(WE / 90)); k += 1) {
      const x = Math.round(rng() * WE); if (!free(x)) continue;
      mossyRock(x, H - 2 - Math.floor(rng() * 4), 4 + Math.floor(rng() * 3), 3 + Math.floor(rng() * 2));
    }
    for (let k = 0; k < Math.round(WE / 25); k += 1) {
      const x = Math.round(rng() * WE); const y = H - 1 - Math.floor(rng() * (H - yfg)); if (!free(x, y)) continue;
      mushroom(x, y, rng() < 0.55);
      if (rng() < 0.5) mushroom(x + 3, y + 1, false);
    }
    for (let k = 0; k < Math.round(WE / 30); k += 1) {
      const x = Math.round(rng() * WE); if (!free(x)) continue;
      const y = H - Math.floor(rng() * 5);
      for (let j = 0; j < 4; j += 1) fern(x + j * 2 - 3, y, 6 + Math.floor(rng() * 6), j < 2 ? -1 : 1);
    }
    const stumpX = M + Math.round(0.7 * Ws);
    if (free(stumpX)) { // a stump with its rings, a branch fallen beside it
      rect(stumpX - 4, H - 9, 9, 9, I.DIRT); rect(stumpX + 2, H - 9, 3, 9, I.DIRT_SH); rect(stumpX - 4, H - 9, 1, 9, I.TIMBER_HI);
      rect(stumpX - 4, H - 10, 9, 1, I.TIMBER_HI); set(stumpX, H - 10, I.TIMBER); set(stumpX - 2, H - 10, I.TIMBER);
      set(stumpX - 3, H - 6, I.MOSS); set(stumpX - 3, H - 5, I.MOSS_HI);
      for (let k = 0; k < 16; k += 1) set(stumpX + 6 + k, H - 3 - Math.round(k * 0.15), k % 5 ? I.DIRT : I.DIRT_SH);
      set(stumpX + 10, H - 5, I.DIRT); set(stumpX + 11, H - 6, I.DIRT); set(stumpX + 15, H - 6, I.DIRT_SH);
    }

    on(L.FG);
    { // nothing of the foreground stands over the grazing horse: what touches its box goes, whole (a mushroom on its head)
      const fg = planes[L.FG]; const x0 = horse.x - 2; const x1 = horse.x + hsp.w + 2; const y0 = horse.y; const y1 = Math.min(H, horse.y + hsp.h);
      for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
        if (x < 0 || x >= WE || fg[y * WE + x] === CLEAR) continue;
        const stack = [y * WE + x];
        while (stack.length) {
          const i = stack.pop(); if (fg[i] === CLEAR) continue; fg[i] = CLEAR; const xx = i % WE;
          if (xx > 0) stack.push(i - 1); if (xx < WE - 1) stack.push(i + 1); if (i >= WE) stack.push(i - WE); if (i < WE * (H - 1)) stack.push(i + WE);
        }
      }
    }
    // the big pines last: they stand in front of the rocks, mushrooms and ferns at their feet
    const clearOf = wizard.x - 3; // the left pines' skirts stop short of the wizard
    pine(Math.min(M + Math.round(-0.08 * Ws), Math.round(clearOf - 0.24 * 0.78 * H)), H + 2, 0.78 * H, FGP);
    pine(Math.min(M + Math.round(0.05 * Ws), Math.round(clearOf - 0.24 * 0.5 * H)), H + 2, 0.5 * H, FGP);
    pine(M + Math.round(Ws * 1.02), H + 2, 0.66 * H, FGP);
    pine(M + Math.round(Ws * 0.93), H + 2, 0.42 * H, FGP);
    // a bare branch out of that pine's west side, where an owl perches at night
    const owl = { x: M + Math.round(Ws * 0.93) - Math.round(0.12 * 0.42 * H) - 7, y: Math.round(H + 2 - 0.42 * H * 0.52) };
    rect(owl.x - 1, owl.y, Math.round(0.12 * 0.42 * H) + 8, 1, I.BARK); set(owl.x - 2, owl.y - 1, I.BARK);
    owl.y -= SPRITES.owl.h - 1;

    // tall grass along the bottom, in tufts of three blades fanning out; drawn each frame (wind)
    const blades = [];
    const GR = [I.GRASS_HI, I.GRASS, I.GRASS, I.REED, I.GRASS_SH, I.GRASS_HI, I.GRASS_LT];
    for (let k = 0; k < WE * 0.3; k += 1) {
      const x = Math.floor(rng() * WE); const y = H + 1 - Math.floor((rng() ** 2.2) * (H - yfg));
      if (x > fire.x - 76 && x < fire.x + 34 && y < fire.y + 18) continue; // not in front of the camp
      if (x > horse.x - 3 && x < horse.x + hsp.w + 3 && y < horse.y + hsp.h + 6) continue; // nor across the horse
      const nf = clamp((y - yfg) / (H - yfg));
      const h = 2 + rng() * 3 + nf * 4; const c = GR[Math.floor(rng() * GR.length)];
      for (let j = -1; j <= 1; j += 1) blades.push({ x: x + j, y, h: Math.round(h * (j ? 0.75 : 1)), spread: j * (1 + rng()), c });
    }

    // stars, clouds: screen coordinates (the sky does not move)
    const stars = [];
    for (let k = 0; k < (W * yHor) / 70; k += 1) {
      stars.push({ x: Math.floor(rng() * W), y: Math.floor(rng() * yHor), big: rng() < 0.06,
        ph: rng() * 6.28, sp: 0.6 + rng() * 2, tint: rng() });
    }
    const clouds = [];
    for (let k = 0; k < Math.max(3, Math.round(W / 70)); k += 1) {
      const cw = Math.round((24 + rng() * 30) * u); const ch = Math.max(4, Math.round(cw * 0.42));
      const m = new Uint8Array(cw * ch);
      const nb = 4 + Math.floor(rng() * 3);
      for (let b = 0; b < nb; b += 1) {
        const bx2 = cw * (0.14 + (0.72 * b) / (nb - 1));
        const r = ch * (0.26 + 0.24 * Math.sin((Math.PI * b) / (nb - 1))) * (0.9 + 0.2 * rng());
        const by = ch - 1 - r * 0.8;
        for (let y = 0; y < ch; y += 1) {
          for (let x = 0; x < cw; x += 1) {
            if ((x - bx2) ** 2 + (y - by) ** 2 < r * r) m[y * cw + x] = y > ch * 0.7 || (y > ch * 0.55 && bayer(x, y) < 0.5) ? 2 : 1;
          }
        }
      }
      clouds.push({ m, w: cw, h: ch, x: rng() * (W + cw), y: Math.round(yHor * (0.06 + rng() * 0.45)), v: 0.6 + rng() * 0.8 });
    }
    for (let k = 0; k < Math.max(2, Math.round(W / 120)); k += 1) {
      const cw = Math.round((30 + rng() * 40) * u); const m = new Uint8Array(cw * 3);
      for (let x = 0; x < cw; x += 1) {
        if (x > cw * 0.2 && x < cw * 0.85) m[x] = 1;
        m[cw + x] = 2;
        if (x > cw * 0.4 && x < cw * 0.95) m[2 * cw + x] = 2;
      }
      clouds.push({ m, w: cw, h: 3, x: rng() * (W + cw), y: Math.round(yHor * (0.55 + rng() * 0.3)), v: 0.25 });
    }

    // more of the countryside (their moving parts in draw and step):
    on(L.MID);
    // a water mill past the market, its wheel in the river
    const wmill = { x: hamlet.x1 + 40, y: 0 };
    {
      const x0 = wmill.x - 10; const yb = Math.min(riverTop(x0), riverTop(x0 + 8)) - 2;
      for (let y = yb - 6; y <= yb; y += 1) for (let x = x0; x < x0 + 8; x += 1) set(x, y, x === x0 ? I.WALL_HI : x === x0 + 7 ? I.WALL_SH : (y - yb) % 3 === 0 ? I.WALL_SH : I.WALL);
      for (let k = 0; k < 3; k += 1) for (let x = x0 - 1 + k; x <= x0 + 8 - k; x += 1) set(x, yb - 7 - k, k === 2 || x > x0 + 4 ? I.THATCH_SH : I.THATCH);
      set(x0 + 2, yb - 1, I.TIMBER_SH); set(x0 + 2, yb - 2, I.TIMBER_SH); windows.push({ pts: [[x0 + 5, yb - 4]], lit: true });
      rect(x0 + 8, yb - 4, 2, 1, I.TIMBER_SH); // the axle
      wmill.y = yb - 3; wmill.x = x0 + 12;
    }
    // a quarry cut into the hill left of the castle rock: a pale face, blocks squared and stacked
    const quarry = { x: Math.round(cx - castleW / 2 - 16 * u), y: 0 };
    {
      const x0 = quarry.x; const yb = Math.round(hill[clamp(x0, 0, WE - 1)]) + 8; const w = Math.round(12 * u); const h = 6;
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w - y; x += 1) set(x0 + x, yb - h + y, y === 0 ? I.STONE_HI : (x + (y % 2) * 2) % 4 === 0 || y % 2 === 0 && x % 4 === 2 ? I.STONE_SH : I.STONE);
      for (let k = 0; k < 3; k += 1) { rect(x0 + w + k * 3, yb - 2, 2, 2, I.STONE_HI); set(x0 + w + k * 3 + 1, yb - 1, I.STONE_SH); }
      rect(x0 + w + 1, yb - 4, 2, 2, I.STONE); set(x0 + w + 2, yb - 3, I.STONE_SH);
      quarry.y = yb; quarry.w = w;
    }
    // a waterfall down the near range, east of the watchtower (drawn where the rock shows)
    const falls = { x: M + Math.round(0.42 * Ws), y0: 0, len: Math.round(0.11 * H) };
    for (let x = falls.x - 8; x <= falls.x + 8; x += 1) if (crestAt(x) > crestAt(falls.x)) falls.x = x; // in a gully
    falls.y0 = crestAt(falls.x) + 4;
    // an orchard in the meadow, west: apple trees for the season, two straw hives under them
    on(L.GROUND);
    const orchard = { trees: [], skeps: [] };
    {
      const nearG = (y) => clamp((y - yg) / (H - yg));
      [[0.17, 0.42], [0.225, 0.3], [0.265, 0.48]].forEach(([fx, fy], j) => {
        const x = M + Math.round(fx * Ws); const yb = Math.round(yg + fy * (H - yg)); const h = Math.round(H * (0.06 + 0.05 * nearG(yb)));
        const r = Math.max(4, Math.round(h * 0.42)); const trunk = Math.round(h * 0.4); const cy0 = yb - trunk - r + 2;
        rect(x - 1, yb - trunk, 2, trunk + 1, I.BARK); set(x - 2, yb, I.BARK); set(x + 1, yb, I.BARK);
        for (let k = 1; k < r * 0.7; k += 1) { set(x - k, yb - trunk - Math.round(k * 0.7), I.BARK); set(x + k, yb - trunk - Math.round(k * 0.8), I.BARK); }
        if (season !== 'winter') {
          const P = season === 'autumn' && j === 1 ? [I.LEAF2, I.RUST_HI, I.RUST] : [I.OAK_HI, I.OAK, I.OAK_SH];
          for (let dy = -r; dy <= r; dy += 1) for (let dx = -r - 2; dx <= r + 2; dx += 1) {
            const q = (dx / (r + 2)) ** 2 + (dy / r) ** 2; const X = x + dx; const Y = cy0 + dy;
            if (q + (bayer(X, Y) - 0.5) * 0.3 > 1) continue;
            let c = dx + dy < -r * 0.4 ? P[0] : dx + dy > r * 0.4 ? P[2] : P[1];
            if (season === 'spring' && bayer(X * 3, Y * 7) < 0.3) c = (X + Y) % 3 ? I.BLOSSOM : I.FL_WHITE;
            if ((season === 'summer' || season === 'autumn') && bayer(X * 5, Y * 3) < 0.06) c = season === 'autumn' ? I.FL_RED : I.GRASS_LT; // apples
            set(X, Y, c);
          }
          if (season === 'autumn') for (let k = 0; k < 3; k += 1) set(x - r + k * r, yb + 1 + (k % 2), I.FL_RED); // fallen ones
        }
        orchard.trees.push({ x, yb, r, cy0 });
      });
      const t0 = orchard.trees[1]; const sx0 = t0.x + 6; const sy0 = t0.yb + 2; // the bench and its hives
      rect(sx0 - 1, sy0, 12, 1, I.TIMBER); set(sx0, sy0 + 1, I.TIMBER_SH); set(sx0 + 9, sy0 + 1, I.TIMBER_SH);
      [0, 6].forEach((dx) => {
        const hx = sx0 + dx;
        for (let k = 0; k < 4; k += 1) for (let x = -2 + Math.floor(k / 3); x <= 2 - Math.floor(k / 3); x += 1) set(hx + 2 + x, sy0 - 1 - k, k % 2 ? I.THATCH_SH : I.THATCH);
        set(hx + 2, sy0 - 5, I.THATCH_SH); set(hx + 2, sy0 - 1, I.OUTLINE); // the top, the bees' door
        orchard.skeps.push({ x: hx + 2, y: sy0 - 3 });
      });
    }

    // the lichen's patches on the rock, grown part-way now (see step)
    const lichen = lichenInit(planes[L.MID], WE, H, crest, yl0, rng, new Set([I.ROCK_HI, I.ROCK, I.ROCK_SH, I.ROCK_DK]));
    // springs at the rock's foot: site percolation (p = 0.62, just over the threshold 0.593) through
    // the rock's pixels; where an open path from the top reaches the bottom, rain seeps out (see draw)
    const seeps = [];
    {
      const on = lichen.on; const open = new Uint8Array(WE * H); const seen = new Uint8Array(WE * H); const q = [];
      const xa = Math.round(cx - castleW / 2 - (yl0 - crest) * 1.1); const xb = Math.round(cx + castleW / 2 + (yl0 - crest) * 1.1); // (the castle's rock only)
      for (let i = 0; i < on.length; i += 1) if (on[i] && rng() < 0.62 && i % WE >= xa && i % WE <= xb) open[i] = 1;
      for (let x = 0; x < WE; x += 1) { const i = (crest + 1) * WE + x; if (open[i]) { seen[i] = 1; q.push(i); } }
      while (q.length) {
        const i = q.pop(); const x = i % WE;
        [i + 1, i - 1, i + WE, i - WE].forEach((j) => { if (j >= 0 && j < on.length && Math.abs((j % WE) - x) <= 1 && open[j] && !seen[j]) { seen[j] = 1; q.push(j); } });
      }
      const foot = []; // each column's lowest rock pixel, if the water reaches it
      for (let x = xa; x <= xb; x += 1) { let y = yl0; while (y > crest && !on[y * WE + x]) y -= 1; if (y > crest + 3 && seen[y * WE + x]) foot.push(y * WE + x); }
      foot.sort((a, b) => (a % WE) - (b % WE)).forEach((i) => { const x = i % WE; if (!seeps.length || x - seeps[seeps.length - 1].x > 10) seeps.push({ x, y: (i - x) / WE }); });
      seeps.splice(4);
    }
    lichen.max = reduce ? 130 : 45; for (let k = 0; k < 40; k += 1) lichenGrow(lichen, 3000); lichen.max = 130;

    /* ---- what the date, the weather and the visitor leave on the land (a seed of their own: the
       rest of the place stays where it was) ---- */
    const rng2 = mulberry32(2027);
    on(L.GROUND);
    { // fallen leaves under the broadleaf trees, thicker as the autumn goes on (mid-September to late November)
      const doy = dayOfYear(today());
      const litter = qSeason ? (qSeason === 'autumn' ? 0.6 : 0) : doy >= 258 && doy < 350 ? clamp((doy - 258) / 70) : 0;
      const LEAVES = [I.LEAF, I.LEAF2, I.RUST, I.RUST_SH, I.RUST_HI];
      if (litter > 0) [[bigOak.x, bigOak.y + 1, bigOak.h * 0.55], ...orchard.trees.map((tr) => [tr.x, tr.yb + 1, tr.r * 1.7])].forEach(([x0, y0, R]) => {
        for (let k = 0; k < R * R * 0.6 * litter; k += 1) {
          const a = rng2() * 6.283; const d = Math.sqrt(rng2()) * R;
          const x = Math.round(x0 + Math.cos(a) * d); const y = Math.round(y0 + Math.sin(a) * d * 0.3);
          if (meadow(x, y) && !watchers(x, y)) set(x, y, LEAVES[Math.floor(rng2() * LEAVES.length)]);
        }
      });
    }
    // where water stands after rain: hollows of the path, and a few in the meadow; each pixel's q is
    // how far it lies from its puddle's middle (0..1): the edges dry first
    const puddles = [];
    {
      const sites = [];
      for (let k = 0; k < 4; k += 1) {
        const y = Math.round(yg + 8 + ((k + 0.4) / 4) * (H - yg - 14));
        sites.push([pathX[y] + (rng2() - 0.5) * pathW[y], y, Math.max(2, pathW[y] * 0.8), y > yg + 25 ? 2 : 1]);
      }
      for (let k = 0; k < 6 && sites.length < 7; k += 1) {
        const x = Math.round(M + rng2() * Ws); const y = Math.round(yg + 6 + rng2() * (H - yg - 12));
        if (meadow(x, y) && !watchers(x, y)) sites.push([x, y, 3 + rng2() * 3, 1]);
      }
      sites.forEach(([xc, yc, rx, ry]) => {
        for (let dy = -ry; dy <= ry; dy += 1) for (let dx = -Math.ceil(rx); dx <= rx; dx += 1) {
          const x = Math.round(xc + dx); const y = yc + dy; const q = Math.hypot(dx / (rx + 0.5), dy / (ry + 0.5));
          if (q < 1 && y < H && y > yg && get(x, y) !== CLEAR && !watchers(x, y)) puddles.push({ i: y * WE + x, x, y, q });
        }
      });
    }
    // the visitor's own oak, planted on the first visit, a ring a visit (see visitsOf): a seedling,
    // then a sapling on its stake with a red ribbon, then a young tree for the season
    const sapling = { x: M + Math.round(0.13 * Ws), y: Math.round(yg + 0.42 * (H - yg)) };
    {
      const { n } = visitsOf(); const h = Math.min(Math.round(0.11 * H), Math.round(4 + 4 * Math.log2(Math.max(1, n))));
      const { x, y } = sapling; sapling.h = h; sapling.n = n;
      for (let k = 0; k < Math.max(2, Math.round(h * 0.45)); k += 1) set(x, y - k, I.BARK);
      set(x + 2, y, I.TIMBER_SH); for (let k = 1; k < Math.max(4, h * 0.5); k += 1) set(x + 2, y - k, I.TIMBER); // its stake, a red ribbon round it
      set(x + 1, y - 3, I.FLAG); set(x + 3, y - 3, I.FLAG); set(x + 3, y - 2, I.FLAG);
      if (h < 8) { set(x - 1, y - h + 2, I.OAK_HI); set(x + 1, y - h + 1, I.OAK); set(x, y - h + 1, I.OAK_HI); set(x - 1, y - h + 1, I.OAK); }
      else {
        const r = h * 0.32; const cy = y - h + r;
        if (season === 'winter') for (let k = 1; k < r; k += 1) { set(x - k, Math.round(cy - k * 0.6), I.BARK); set(x + k, Math.round(cy - k * 0.7), I.BARK); }
        else {
          const P = season === 'autumn' ? [I.LEAF2, I.RUST_HI, I.RUST] : [I.OAK_HI, I.OAK, I.OAK_SH];
          for (let dy = -Math.ceil(r); dy <= r; dy += 1) for (let dx = -Math.ceil(r * 1.2); dx <= r * 1.2; dx += 1) {
            if ((dx / (r * 1.2)) ** 2 + (dy / r) ** 2 + (bayer(x + dx, cy + dy) - 0.5) * 0.4 > 1) continue;
            set(x + dx, cy + dy, dx + dy < -r * 0.4 ? P[0] : dx + dy > r * 0.4 ? P[2] : P[1]);
          }
        }
      }
      for (let dx = -2; dx <= 3; dx += 1) set(x + dx, y + 1, I.GRASS_SH); // its shade
    }
    { // the ants' nest, the pebble between its two ways, the fallen apple they go for (see antsStep)
      const ax = M + Math.round(0.28 * Ws); const ay = H - 15;
      set(ax - 2, ay, I.DIRT); set(ax - 1, ay - 1, I.DIRT); set(ax, ay - 1, I.DIRT_SH); set(ax + 1, ay, I.DIRT_SH); set(ax, ay, I.OUTLINE); set(ax - 1, ay, I.DIRT_SH); // the mound and its door
      blob(ax + 15, ay - 2, 3, 2, [I.STONE_HI, I.STONE, I.STONE_SH], null); // the pebble
      set(ax + 31, ay, I.CAP); set(ax + 32, ay, I.CAP_SH); set(ax + 31, ay - 1, I.CAP); set(ax + 32, ay - 1, I.FL_RED); set(ax + 31, ay - 2, I.BARK); // the apple
    }
    // the river gauge, on a post by the bridge's east pier: marks a pixel apart, the water at its level
    const gauge = { x: Math.round(pathX[yl0 + 4] + pathW[yl0 + 4] + 6) };
    gauge.top = riverTop(gauge.x) - 6; gauge.bot = riverBot(gauge.x);

    // the rows each plane covers, so compositing skips the empty ones
    const rows = planes.map((p) => {
      let a = H; let b = 0;
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < WE; x += 1) if (p[y * WE + x] !== CLEAR) { a = Math.min(a, y); b = y + 1; break; }
      }
      return [a, b];
    });

    return {
      W, H, Ws, WE, M, planes, rows, yHor, castleTop, rooms, yl0, yg, windows, flags, torches, sentries, chimney, stars, clouds,
      bell, keepTop, tallTip: tallTip && { x: tallTip.x, y: tallTip.y }, cellar, riverTop, riverBot, path: { x: pathX, w: pathW },
      ferry: null, hoist: null, ringUntil: 0,
      fire, knight, wizard, blades, cats, field, season, shieldSp: null,
      peasant: field.none ? null : { x: Math.round((field.x0 + field.x1) / 2), dir: 1, seeds: [] },
      falling: Array.from({ length: Math.round(WE / 8) }, () => ({ x: rng() * WE, y: rng() * H, ph: rng() * 6, c: rng() < 0.5 })),
      fw: 11, fh: 22, cells: new Float32Array(11 * 22), embers: [], smoke: [], fumes: [], sparks: [],
      flies: Array.from({ length: 22 }, () => ({ x: M + rng() * Math.min(W, Ws), y: yl0 + (rng() ** 0.5) * (H - yl0), ph: rng() * 6 })),
      butterflies: Array.from({ length: 3 }, (_, k) => ({ x: M + rng() * Math.min(W, Ws), y: yg + 6 + rng() * (H - yg - 12), ph: rng() * 6, c: [I.FL_WHITE, I.FL_YEL, I.FL_BLUE][k] })),
      birds: null, dragon: null, nextDragon: null,
      // the countryside (see draw and step)
      watch, mill, chimneys, horse, deer, owl, month, hamlet: { doors, eaves, spire, x0: hamlet.x0, x1: hamlet.x1, places: hamlet.places }, fireworks: [], notes: [],
      pathX, pathW, top, walker: null, zzz: [], fish: null,
      angler: (() => { const x = M + Math.round(0.135 * Ws); return { x, y: yg + 3 - SPRITES.angler.h, wy: riverBot(x + 6) - 1 }; })(),
      bonfires: [[mill.x + 16, Math.round(hill[clamp(mill.x + 16, 0, WE - 1)]) + 1, L.MID], [hamlet.x1 + 7, riverTop(hamlet.x1 + 7) - 3, L.MID],
        [M + Math.round(0.33 * Ws), crestAt(M + Math.round(0.33 * Ws)) + 1, L.NEAR]],
      heron: (() => { const x = M + Math.round(0.74 * Ws); return { x, y: riverTop(x) + 4 - SPRITES.heron.h }; })(),
      ducks: [0, 1, 2].map((k) => ({ x: pathX[yl0 + 4] + 20 + k * 9, a: pathX[yl0 + 4] + 16, b: M + Math.round(0.92 * Ws), dir: k % 2 ? 1 : -1, ph: k })),
      geese: null, swallows: null, meteors: [], millAngle: 0, lichen, seeps, wmill, quarry, falls, orchard, wheel: 0, bridgeK: 0, hill, flock: null,
      gate: { x: gx, w: gw, h: gh, crest },
      puddles, sapling, gauge, prints: [], bolt: null, boltGen: null, scribeWin, scope, glass, fluid: fluidNew(24, 44), wave: null, skip: null,
      ants: antsNew(M + Math.round(0.28 * Ws), H - 15), shoal: null, dream: null, hoots: [],
    };
  }

  /* ---- inside the castle: one room per section ------------------------------------------
     Built from a few pieces of furniture (procedural, in the scene's palette), lit by candles,
     a hearth or torches; the window shows the true sky. `Wi` is the part of the width the
     parchment leaves free (wide screens: the left half), where the furniture stands. */

  const ROOM_NAMES = {
    about: 'the scriptorium', experience: 'the observatory', work: 'the workshop',
    publications: 'the library', talks: 'the great hall', teaching: 'the schoolroom',
    news: 'the rookery', contact: 'the gatehouse', cellar: 'the cellar', // (the cellar: the tower's foot, phones only)
    maproom: 'the map room', // (out of the menu: up from the cartographer's shop in the village)
  };
  // a section's room kind: the drawing keeps the rooms' old names (the observatory is 'research', the
  // workshop 'projects')
  const KIND = { experience: 'research', work: 'projects' };
  // each room its light, to know it at a glance: the cast of its walls (r, g, b factors) and what its
  // candles turn things to (lights in drawInterior): the scriptorium amber, the observatory blue, the
  // workshop the forge's red; the others the plain warm of a candle
  const ROOM_TONE = { about: [1.06, 1, 0.9], research: [0.9, 0.97, 1.12], projects: [1.1, 0.94, 0.86] };
  const ROOM_LIGHT = {
    research: (c) => [Math.min(200, c[0] * 1.3 + 18), Math.min(205, c[1] * 1.35 + 22), Math.min(235, c[2] * 1.45 + 34)],
    projects: (c) => [Math.min(245, c[0] * 1.9 + 44), Math.min(160, c[1] * 1.15 + 8), Math.min(120, c[2] * 0.95)],
  };
  const candleLit = (c) => [Math.min(235, c[0] * 1.7 + 34), Math.min(190, c[1] * 1.3 + 14), Math.min(150, c[2] * 1.02)];
  const roomOf = (id) => KIND[id] || (ROOM_NAMES[id] ? id : 'projects');

  /* ---- heraldry: coats from assets/js/arms.js (window.ARMS), flat tinctures, dark outline ---- */
  const TINCT = { O: 'T_OR', A: 'T_ARGENT', G: 'T_GULES', B: 'T_AZURE', V: 'T_VERT', S: 'T_SABLE', P: 'T_PRUNE', R: 'T_BORDEAUX', N: 'T_NAVY', C: 'T_BRIGHT' };
  const armsCache = {};
  function armsSprite(id) {
    if (armsCache[id]) return armsCache[id];
    const rows = (window.ARMS || {})[id];
    if (!rows) return null;
    const h0 = rows.length; const w0 = Math.max(...rows.map((r) => r.length));
    const at = (x, y) => (y >= 0 && y < h0 && x >= 0 && x < rows[y].length ? rows[y][x] : '.');
    const w = w0 + 2; const h = h0 + 2; const px = new Int16Array(w * h).fill(-1);
    for (let y = -1; y <= h0; y += 1) {
      for (let x = -1; x <= w0; x += 1) {
        const c = at(x, y);
        if (c !== '.') px[(y + 1) * w + x + 1] = I[TINCT[c]];
        else if (NEIGH.some(([dx, dy]) => at(x + dx, y + dy) !== '.')) px[(y + 1) * w + x + 1] = I.OUTLINE;
      }
    }
    armsCache[id] = { w, h, px };
    return armsCache[id];
  }

  const CHALK = ['iħ∂ψ/∂t=Hψ', '∂ρ/∂t=D∇²ρ', 'Z=Σexp(-βE)', '-∂u/∂t+H(∇u)=0'];

  // the labour of the month, as in a book of hours (sower in autumn, reaper in summer...)
  const OVERLAPS = /[?&]overlaps=1/.test(location.search);
  /* The rooms' standard: every room is drawn once at RW x RH (16:9), whatever the window, on a canvas
     of its own scaled by a whole number of device pixels, the largest that fits, centred (layoutRoom).
     The rest of the plate is a wall of black brick and a gilt frame (paintFrame): thicker above and
     below on a squarer window, at the sides on a wider one. */
  const RW = 240; const RH = 135;
  let roomCv; let rctx; let rimg; let robuf; let roomBox = { l: 0, t: 0, k: 1 }; let fbuf = null; let frameGeo = null; // (roomBox: css px in the plate, k: css px a room pixel)
  const SEASON = (m) => (m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn');

  const pupilCache = {};
  const pupil = (k) => {
    const key = `${k % 6}${k === 4 ? 'q' : ''}`; // the fifth asks a question
    pupilCache[key] ||= shadeSprite(PUPIL[k === 4 ? 1 : 0].replace(/1/g, HAIR[k % 6]).replace(/2/g, TUNIC[(k * 5 + 1) % 6]));
    return pupilCache[key];
  };

  function generateInterior(id, W, H) {
    const rng = mulberry32(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const idx = new Uint8Array(W * H); const out = new Uint8Array(W * H);
    const front = new Uint8Array(W * H); let frontOn = false; // what stands before a figure walking at the back (the schoolroom's desks and pupils)
    const furn = new Uint8Array(W * H); let furnOn = false; // what the furniture covers (on once the shell is built): late pieces look for a free place
    // ?overlaps=1 (a check, slow): each piece's pixels signed with the line of this function that drew
    // them; one piece painted over another is counted, line against line, in window.overlaps[id]
    const audit = OVERLAPS && new Int32Array(W * H); const clash = audit && new Map();
    const lineOf = () => { const f = new Error().stack.split('\n').find((l) => l.startsWith('generateInterior@')); return f ? Number(f.split(':').at(-2)) : 0; };
    const set = (x, y, i, o = 0) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < W && y >= 0 && y < H) {
        idx[y * W + x] = i; out[y * W + x] = o; if (frontOn) front[y * W + x] = 1; if (furnOn) furn[y * W + x] = 1;
        if (audit && furnOn) { const k = y * W + x; const l = lineOf(); if (audit[k] && audit[k] !== l) { const key = `${audit[k]}>${l}`; clash.set(key, (clash.get(key) || 0) + 1); } audit[k] = l; }
      }
    };
    /** The first x along `xs` where a w x h box with its foot on yb is clear of the furniture (and of
     *  the animated pieces, `deco`), or null. */
    const clearAt = (xs, yb, w, h) => xs.find((x0) => {
      if (x0 < 0 || x0 + w > W) return false;
      for (let y = Math.max(0, yb - h); y <= Math.min(H - 1, yb + 1); y += 1) for (let x = x0 - 1; x <= x0 + w; x += 1) if (furn[y * W + x]) return false;
      return !deco.some((d) => d.x !== undefined && d.y !== undefined && d.x + (d.w || 6) >= x0 - 1 && d.x - 6 <= x0 + w && d.y + (d.h || 6) >= yb - h && d.y - 6 <= yb + 1);
    }) ?? null;
    const rect = (x, y, w, h, i) => { for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) set(xx, yy, i); };
    const lights = []; const flames = []; const stars = []; const motes = []; const blinks = []; const camps = []; const deco = [];
    const stamp = (sp, x0, y0) => { for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const c = sp.px[y * sp.w + x]; if (c >= 0) set(x0 + x, y0 + y, c); } };
    const yf = Math.round(H * 0.8); // the floor's edge
    const sn = fbm(rng, 3);
    const kind = roomOf(id);
    // a room as a box (prototype: the scriptorium): the back wall between BL and BR, two side walls
    // in perspective; sideBot(x) is where floor meets wall (the near edge at the bottom of the view)
    // each room its shape, after what it is (flat beamed ceilings: one great building): a plain box,
    // a deep library lined with shelves, a narrow stone tower room, a sooty brick workshop, a wide
    // hall on pillars, a schoolroom lit from the side, a plank-lined rookery, a stone gate passage
    const SHAPES = {
      about: { side: 0.17, mat: 'wainscot' }, publications: { side: 0.25, mat: 'shelves' },
      research: { side: 0.11, mat: 'stone' }, projects: { side: 0.15, mat: 'brick' },
      talks: { side: 0.09, mat: 'ashlar', pillars: true }, teaching: { side: 0.17, mat: 'lime', sideWindow: true },
      news: { side: 0.16, mat: 'boards' }, contact: { side: 0.2, mat: 'ashlar' }, cellar: { side: 0.18, mat: 'ashlar' },
      maproom: { side: 0.14, mat: 'wainscot' },
    };
    const SHAPE = SHAPES[kind] || SHAPES.contact;
    const box3d = Boolean(SHAPE);
    const BL = box3d ? Math.round(W * SHAPE.side) : 0; const BR = W - BL;
    const sideBot = (x) => (x < BL ? H - (H - yf) * (x / BL) : x >= BR ? H - (H - yf) * ((W - 1 - x) / BL) : yf);
    const noise2 = (x, y) => sn(x * 0.11 + y * 0.37) * 0.6 + sn(x * 0.31 - y * 0.13 + 50) * 0.4;

    /* walls: each room its own material, at a grain that reads at this size */
    function stones(bw, bh, [hi, mid, sh, joint]) { // courses of blocks bw x bh, staggered
      for (let y = 0; y < yf; y += 1) {
        const course = Math.floor(y / bh); const off = (course % 2) * Math.floor(bw / 2);
        for (let x = 0; x < W; x += 1) {
          const j = y % bh === bh - 1 || (x + off) % bw === 0;
          const t = noise2(x + course * 13, y);
          set(x, y, j ? joint : t > 0.6 ? sh : t < 0.3 ? hi : mid);
        }
      }
    }
    function plaster(top, [hi, mid, sh]) {
      for (let y = top; y < yf; y += 1) for (let x = 0; x < W; x += 1) {
        const t = noise2(x, y);
        set(x, y, t > 0.66 ? sh : t < 0.22 && bayer(x, y) < 0.5 ? hi : mid);
      }
      for (let k = 0; k < 3; k += 1) { // a crack or two
        let cx0 = Math.floor(rng() * W); for (let y = top + Math.floor(rng() * 10); y < top + 14; y += 1) { cx0 += rng() < 0.5 ? 0 : (rng() < 0.5 ? -1 : 1); set(cx0, y, sh); }
      }
    }
    function panels(top, bottom, pw, rh = 14) { // wooden panelling: stiles, rails (every rh rows), sunk panels
      for (let y = top; y < bottom; y += 1) for (let x = 0; x < W; x += 1) {
        const stile = x % pw < 2; const rail = (y - top) % rh < 2 || y >= bottom - 2;
        const edge = x % pw === 2 || (y - top) % rh === 2;
        set(x, y, stile || rail ? (x % pw === 0 || (y - top) % 14 === 0 ? I.TIMBER_HI : I.TIMBER) : edge ? I.TIMBER_SH : (noise2(x, y) > 0.55 ? I.TIMBER_SH : I.TIMBER));
      }
      for (let x = 0; x < W; x += 1) set(x, top, I.TIMBER_HI);
    }
    const STONE = [I.ROCK_HI, I.ROCK, I.ROCK_SH, I.ROCK_DK];
    const LOOK = ROOM_LOOK[kind] || ROOM_LOOK.contact; // its floor, its rugs, its vault (textures.js)
    if (kind === 'maproom') { plaster(0, [I.LIME_HI, I.LIME, I.LIME_SH]); panels(yf - 22, yf, 14, 40); }
    else if (kind === 'about') {
      plaster(0, [I.PLASTER_HI, I.PLASTER, I.PLASTER_SH]); panels(yf - 26, yf, 18, 40);
      for (let x = 0; x < W; x += 1) { // a frieze painted under the beams: ochre bands, a red running scroll
        set(x, 7, I.GOLD_SH); set(x, 15, I.GOLD_SH); const u = x % 12;
        for (let y = 8; y < 15; y += 1) { const wave = Math.round(11 + 2.5 * Math.sin((x / 12) * Math.PI * 2)); if (Math.abs(y - wave) < 0.6 || (u === 3 && Math.abs(y - 10) < 1) || (u === 9 && Math.abs(y - 13) < 1)) set(x, y, I.CLOTH_SH); }
      }
    } // (one row of tall plain panels: a wainscot, not a chest of drawers)
    else if (kind === 'publications') panels(0, yf, 12);
    else if (kind === 'research') stones(6, 3, STONE);
    else if (kind === 'projects') { // brick, blackened by the forge towards the top
      stones(5, 2, [I.BRICK_HI, I.BRICK, I.BRICK_SH, I.ROCK_DK]);
      for (let y = 0; y < yf * 0.45; y += 1) for (let x = 0; x < W; x += 1) if (bayer(x, y) < 0.6 * (1 - y / (yf * 0.45))) set(x, y, I.ROCK_DK);
    } else if (kind === 'talks') stones(10, 4, STONE);
    else if (kind === 'teaching') { plaster(0, [I.LIME_HI, I.LIME, I.LIME_SH]); panels(yf - Math.round(H * 0.16), yf, 8); }
    else if (kind === 'news') { // the rookery: plank walls
      for (let y = 0; y < yf; y += 1) for (let x = 0; x < W; x += 1) set(x, y, y % 5 === 4 ? I.TIMBER_SH : (noise2(x, y) > 0.6 ? I.TIMBER_SH : (x * 7 + y * 3) % 31 === 0 ? I.TIMBER_HI : I.TIMBER));
    } else stones(9, 4, STONE); // the gatehouse: big ashlar

    // the ceiling's beams (the observatory has its dome, the rookery its rafters)
    // each room its ceiling, the band along the top: plain beams (the scriptorium), a vault's ribs on
    // stone (the hall), painted coffers with gilt studs (the library), joists black with soot (the
    // workshop), rafters under the roof's slope (the rookery), plastered with one beam (the schoolroom),
    // a stone vault (the gatehouse); the observatory has its dome and the cellar its barrel vault
    if (kind === 'talks' || kind === 'contact') { // ribs springing from the walls, stone between
      const bay = kind === 'talks' ? 40 : 30;
      for (let x = 0; x < W; x += 1) for (let y = 0; y < 9; y += 1) {
        const u = ((x % bay) / bay) * 2 - 1; const rib = Math.abs(y - (8 - Math.round(8 * u * u))) < 1;
        set(x, y, rib ? I.ROCK_HI : y === 8 ? I.ROCK_DK : LOOK.vault ? texAt(LOOK.vault, x, y) : (x + y * 3) % 7 === 0 ? I.ROCK_SH : I.ROCK);
      }
    } else if (kind === 'publications') { // coffers, dark blue, a gilt stud at each crossing
      for (let x = 0; x < W; x += 1) for (let y = 0; y < 8; y += 1) {
        const edge = x % 12 === 0 || y === 0 || y === 7;
        set(x, y, edge ? I.TIMBER : x % 12 === 6 && y === 3 ? I.GOLD : I.SLATE_SH);
      }
      for (let x = 0; x < W; x += 12) set(x, 7, I.GOLD_SH);
    } else if (kind === 'news') { // the rafters: the roof's two slopes meeting over the middle
      for (let x = 0; x < W; x += 1) for (let y = 0; y < 10; y += 1) {
        const ridge = Math.abs(x - W / 2) / (W / 2); const rafter = (Math.round(x + y * (x < W / 2 ? 2 : -2)) % 14 + 14) % 14 < 2;
        if (y > 9 - Math.round(ridge * 6)) set(x, y, rafter ? I.TIMBER : I.TIMBER_SH); else set(x, y, I.OUTLINE);
      }
    } else if (kind === 'projects') { // joists, sooted
      for (let x = 0; x < W; x += 1) { rect(x, 0, 1, 4, bayer(x, 0) < 0.5 ? I.ROCK_DK : I.OUTLINE); }
      for (let x = 3; x < W; x += 16) { rect(x, 0, 5, 6, I.TIMBER_SH); rect(x, 0, 5, 1, I.ROCK_DK); rect(x, 6, 5, 1, I.OUTLINE); }
    } else if (kind === 'teaching') { // plaster, one great beam across
      for (let x = 0; x < W; x += 1) { rect(x, 0, 1, 5, I.LIME_SH); rect(x, 5, 1, 2, I.TIMBER); set(x, 7, I.TIMBER_SH); }
    } else if (kind !== 'research' && kind !== 'cellar') { // plain beams
      for (let x = 0; x < W; x += 1) { rect(x, 0, 1, 3, I.TIMBER_SH); set(x, 3, I.OUTLINE); }
      for (let x = 4; x < W; x += 22) { rect(x, 0, 4, 5, I.TIMBER); rect(x, 0, 1, 5, I.TIMBER_HI); rect(x, 5, 4, 1, I.OUTLINE); }
    }
    for (let x = 0; x < W; x += 1) { set(x, yf - 1, I.TIMBER_SH); set(x, yf - 2, kind === 'talks' || kind === 'contact' ? I.ROCK_SH : I.TIMBER); } // skirting

    /* the floor in perspective: each pixel's place on the floor (u across, v in depth, in floor units:
       a unit a pixel at the near edge) looked up in the room's floor texture */
    const vx = box3d ? W / 2 : W * 0.42; const vy = yf - (H - yf) * 1.4;
    for (let y = yf; y < H; y += 1) {
      const z = (H - vy) / (y - vy); // (1 at the near edge, more further back)
      for (let x = 0; x < W; x += 1) set(x, y, texAt(LOOK.floor, Math.floor(vx + (x - vx) * z + 600), Math.floor((H - y) * z * 1.6 + 40)));
    }
    const pools = []; // pale light under each window (lit in lightInterior, no dither)
    const sills = []; // the windows' sills, where the season's vase stands
    const doorList = [];
    if (box3d) { // the side walls, receding: each room's own material and ceiling
      const hw = yf + H; // wall height, back units: the walls run up out of sight, under a flat ceiling
      const topOf = (x) => sideBot(x) - hw * (sideBot(x) / yf); // where a side wall's top runs (y, may be < 0)
      const LOG8 = Math.log(0.8);
      const BOOKS = [I.CLOTH, I.ROBE, I.GOLD_SH, I.HAT, I.DRAKE_SH, I.WING_SH, I.LEATHER, I.FERN_SH];
      const texel = (x, y, sx, bot, k) => { // the wall's material at (x, y); depth cells shrink as they recede
        const v = (bot - y) / k; const jf = Math.log(Math.max(1e-3, 1 - sx / BL)) / LOG8; const m = SHAPE.mat;
        if (m === 'wainscot' || m === 'lime') {
          const wain = Math.round(H * (m === 'lime' ? 0.16 : 0.26));
          if (v < wain) {
            const st = Math.abs(jf - Math.round(jf)) < 0.08; const rail = Math.abs(v - wain) < 1 || Math.abs(v - 2) < 0.8;
            return st || rail ? I.TIMBER_HI : (noise2(x, y) > 0.55 ? I.TIMBER_SH : I.TIMBER);
          }
          const P = m === 'lime' ? [I.LIME_HI, I.LIME, I.LIME_SH] : [I.PLASTER_HI, I.PLASTER, I.PLASTER_SH];
          return noise2(x + 7, y) > 0.66 ? P[2] : P[1];
        }
        if (m === 'shelves') { // bookcases lining the wall: uprights, boards, spines
          const f = jf - Math.floor(jf); const row = Math.floor(v / 9);
          if (f < 0.1 || v % 9 < 1.1) return f < 0.1 ? I.TIMBER_HI : I.TIMBER;
          if (v % 9 > 7.5) return I.OUTLINE; // the dark above each row of books
          const spine = Math.floor(jf * 7);
          return (jf * 7) % 1 < 0.14 ? I.OUTLINE : BOOKS[(spine * 7 + row * 3 + (spine >> 2)) % BOOKS.length];
        }
        if (m === 'boards') return v % 5 < 1 ? I.TIMBER_SH : (noise2(x, y) > 0.6 ? I.TIMBER_SH : I.TIMBER);
        const brick = m === 'brick'; const ch = brick ? 2 : m === 'ashlar' ? 4 : 3; // stone courses
        const row = Math.floor(v / ch); const cells = brick ? 2.5 : 1.2;
        const g = jf * cells + (row % 2) * 0.5;
        const joint = v % ch < 0.9 || g % 1 < 0.1;
        const pal = brick ? [I.BRICK_HI, I.BRICK, I.BRICK_SH, I.ROCK_DK] : [I.ROCK_HI, I.ROCK, I.ROCK_SH, I.ROCK_DK];
        if (joint) return pal[3];
        if (brick && v > yf * 0.55 && bayer(x, y) < 0.5) return I.ROCK_DK; // soot
        const t = noise2(x + row * 13, y); return t > 0.6 ? pal[2] : t < 0.3 ? pal[0] : pal[1];
      };
      const darker = { [I.PLASTER_HI]: I.PLASTER, [I.PLASTER]: I.PLASTER_SH, [I.PLASTER_SH]: I.ROCK_SH, [I.LIME_HI]: I.LIME,
        [I.LIME]: I.LIME_SH, [I.LIME_SH]: I.ROCK_SH, [I.TIMBER_HI]: I.TIMBER, [I.TIMBER]: I.TIMBER_SH, [I.ROCK_HI]: I.ROCK,
        [I.ROCK]: I.ROCK_SH, [I.ROCK_SH]: I.ROCK_DK, [I.BRICK_HI]: I.BRICK, [I.BRICK]: I.BRICK_SH, [I.BRICK_SH]: I.ROCK_DK };
      const roofAt = (_x, y) => (y % 2 ? I.TIMBER : I.TIMBER_SH); // the ceiling's boards
      for (let x = 0; x < W; x += 1) {
        if (x >= BL && x < BR) continue;
        const left = x < BL; const sx = left ? x : W - 1 - x; const bot = sideBot(x); const k = bot / yf; const top = topOf(x);
        for (let y = 0; y < bot; y += 1) {
          if (y < top) { set(x, y, roofAt(x, y)); continue; }
          let c = texel(x, y, sx, bot, k);
          if (bayer(x, y) < 0.5 * (1 - sx / BL) + (left ? 0 : 0.2)) c = darker[c] ?? c; // turning away from the light
          set(x, y, c);
        }
        if (top > 0) set(x, Math.round(top), I.TIMBER_SH); // the wall plate
        set(x, Math.round(bot), I.TIMBER_SH); // the skirting
      }
      {
        for (let x = 0; x < BL; x += 1) { // the cornice under the ceiling, falling towards us
          const yc = Math.round(5 * (1 - x / BL)) - 1; set(x, yc + 4, I.TIMBER_SH); set(W - 1 - x, yc + 4, I.TIMBER_SH);
          for (let y = 0; y < yc + 4; y += 1) { set(x, y, I.TIMBER); set(W - 1 - x, y, I.TIMBER_SH); }
        }
      }
      for (let y = 0; y < yf; y += 1) { set(BL, y, I.ROCK_SH); set(BR - 1, y, I.ROCK_SH); } // the corners
      if (SHAPE.pillars) [BL, BR - 6].forEach((px0) => { // the hall's pillars at the corners
        rect(px0, 0, 6, yf, I.ROCK); rect(px0, 0, 1, yf, I.ROCK_HI); rect(px0 + 5, 0, 1, yf, I.ROCK_SH);
        rect(px0 - 1, yf - 3, 8, 3, I.ROCK_SH); for (let y = 6; y < yf; y += 7) rect(px0, y, 6, 1, I.ROCK_SH);
      });
      // doors in the side walls: west and north on the left, east and south on the right;
      // a window in the side with fewer doors, where the room has one there (the schoolroom)
      const sides = { l: [], r: [] };
      (doorsOf(id) || []).forEach((d) => sides[d.dir === 'w' || d.dir === 'n' ? 'l' : 'r'].push(d));
      const toX = (side, f0, f1) => { const a = Math.round(BL * f0); const b = Math.round(BL * f1); return side === 'l' ? [a, b] : [W - 1 - b, W - 1 - a]; };
      if (SHAPE.sideWindow) {
        const side = sides.l.length <= sides.r.length ? 'l' : 'r'; const [xa, xb] = toX(side, 0.45, 0.85);
        for (let x = xa - 2; x <= xb; x += 1) {
          const bot = sideBot(x); const k = bot / yf; const y0 = Math.round(bot - yf * 0.86 * k); const y1 = Math.round(bot - yf * 0.36 * k);
          if (x < xa) { for (let y = y0 - 1; y <= y1 + 1; y += 1) set(x, y, x === xa - 2 ? I.LIME_HI : I.LIME_SH); continue; } // the reveal: the wall's thickness, lit on its edge
          const ym = Math.round((y0 + y1) / 2);
          for (let y = y0; y <= y1; y += 1) {
            const frame = x === xa || x === xb || y === y0 || y === y1; const mull = x === Math.round((xa + xb) / 2) || y === ym;
            const g = clamp((y - y0) / (y1 - y0 + 1)) * (N_SKY - 1); const j = Math.min(N_SKY - 2, Math.floor(g));
            if (frame || mull) set(x, y, frame ? I.TIMBER_SH : I.TIMBER); else set(x, y, (g - j) > bayer(x, y) ? j + 1 : j, 1);
          }
          set(x, y1 + 1, I.LIME_HI);
        }
        pools.push({ x: side === 'l' ? BL + 6 : BR - 6, w: 10, y0: yf }); pools.push({ x: side === 'l' ? BL + 40 : BR - 40, w: 30, y0: yf + 2 }); // (and on the desks nearest it)
        sides[side] = sides[side].slice(0, 1); // the window takes the far place
      }
      // a door in a side wall: set into it, in its perspective (each column scaled by its depth k),
      // under a round arch, a stone jamb round it; oak planks, two iron straps, a ring. The far place
      // first (by the back wall, where it reads as a door, not a plank across the view); the near one
      // only for a second exit on that side
      const dh = Math.round(yf * 0.36); // (scale: an adult ~30 px at the back wall; a door ~1.3 of him)
      Object.entries(sides).forEach(([side, list]) => list.slice(0, 2).forEach((d, n) => {
        const [xa, xb] = toX(side, ...(n === 0 ? [0.56, 0.86] : [0.16, 0.46]));
        const wd = xb - xa; let top = H; let bottom = 0;
        for (let x = xa - 1; x <= xb + 1; x += 1) {
          const bot = sideBot(x); const k = bot / yf; const u = (x - xa) / Math.max(1, wd); // (0..1 across the door)
          const arch = Math.round((1 - Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))) * 4 * k); // the arch's fall at this column
          const yt = Math.round(bot - dh * k) + arch;
          if (x < xa || x > xb) { for (let y = yt - 1; y < bot; y += 1) set(x, y, x < xa === (side === 'l') ? I.ROCK_SH : I.ROCK_HI); continue; } // the jamb
          top = Math.min(top, yt); bottom = Math.max(bottom, Math.round(bot));
          set(x, yt - 1, I.ROCK_HI); set(x, yt - 2, I.ROCK); // the voussoirs
          for (let y = yt; y < bot; y += 1) {
            const f = (bot - y) / (dh * k); const strap = Math.abs(f - 0.25) < 0.025 || Math.abs(f - 0.7) < 0.025;
            set(x, y, y === yt ? I.OUTLINE : strap ? I.ARM_SH : (x - xa) % 3 === 0 ? I.TIMBER_SH : (x - xa) % 3 === 1 ? I.TIMBER : I.TIMBER_HI);
          }
        }
        const rx = side === 'l' ? xb - 2 : xa + 2; const rb = sideBot(rx); const ry = Math.round(rb - dh * (rb / yf) * 0.45);
        set(rx, ry, I.GOLD); set(rx, ry + 1, I.GOLD_SH); // the ring
        const pm = Math.round((xa + xb) / 2); const pt = Math.round(sideBot(pm) - dh * (sideBot(pm) / yf)) - 5;
        rect(pm - 3, pt, 7, 2, I.GOLD_SH); rect(pm - 2, pt, 5, 1, I.GOLD_HI); // its plaque
        doorList.push({ t: d, b: { x: xa - 1, y: pt - 1, w: wd + 3, h: bottom - pt + 1 } });
      }));
    }

    /* cobwebs in the upper corners of a room left alone (stalenessOf: days since the visitor was last
       in it, Infinity if never): none after a day or two, full grown after a month */
    {
      const d = stalenessOf(id); const k = d === Infinity ? 0 : clamp((d - 2) / 28); // (never seen from here: no history, no webs)
      const web = (cx, cy, dir, R) => {
        const spokes = [0.05, 0.4, 0.8, 1.15, 1.52];
        spokes.forEach((a) => { for (let r = 0; r <= R; r += 0.5) set(cx + dir * Math.cos(a) * r, cy + Math.sin(a) * r, I.LIME); });
        for (let ring = 1; ring <= 3; ring += 1) { // the spiral, sagging between the spokes
          const rr = (R * ring) / 3.4;
          for (let q = 0; q < spokes.length - 1; q += 1) {
            for (let f = 0; f <= 1; f += 0.08) { const a = spokes[q] + (spokes[q + 1] - spokes[q]) * f; const r = rr - Math.sin(f * Math.PI) * 0.7; const X = Math.round(cx + dir * Math.cos(a) * r); const Y = Math.round(cy + Math.sin(a) * r); if (bayer(X, Y) < 0.6) set(X, Y, I.LIME_SH); }
          }
        }
        if (R > 8) { const sx = Math.round(cx + dir * R * 0.55); for (let y = cy + Math.round(R * 0.25); y < cy + R * 0.9; y += 1) set(sx, y, I.LIME); rect(sx, Math.round(cy + R * 0.9), 2, 2, I.OUTLINE); } // its spider, let down on a thread
      };
      if (k > 0) { web(BL + 1, 6, 1, 3 + 9 * k); if (k > 0.5) web(BR - 2, 6, -1, 2 + 6 * k); }
    }

    furnOn = true;
    // pieces of furniture
    // windows to one scale: about 36 px high (1.2 adults), the sill at the height of a table's top plus
    // a hand (yf - 28), unless the room says otherwise; winY(h): the top for that sill
    const winY = (h) => yf - 28 - h;
    function windowArch(x0, y0, w, h) { // shows the sky and a line of far mountains
      const r = w / 2;
      for (let y = y0 - 2; y < y0 + h + 2; y += 1) {
        for (let x = x0 - 2; x < x0 + w + 2; x += 1) {
          const ax = x + 0.5 - (x0 + r); const ay = y - (y0 + r);
          const inside = y >= y0 + r ? x >= x0 && x < x0 + w && y < y0 + h : ax * ax + ay * ay < r * r;
          const frame = y >= y0 + r - 2 ? x >= x0 - 2 && x < x0 + w + 2 && y < y0 + h + 2 : ax * ax + ay * ay < (r + 2) ** 2;
          if (inside) {
            const g = clamp((y - y0) / h) * (N_SKY - 1);
            const j = Math.min(N_SKY - 2, Math.floor(g));
            let c = (g - j) > bayer(x, y) ? j + 1 : j;
            // looking out from the castle: the far edge of the forest, the meadow, the river below
            const edge = y0 + h * (0.66 + 0.05 * Math.abs(Math.sin(x * 0.9)) + 0.04 * ((x * 7) % 3));
            if (y > edge) c = I.FG_PINE;
            if (y > y0 + h * 0.76) c = (x + y) % 5 ? I.GRASS : I.GRASS_SH;
            if (y > y0 + h * 0.9) c = y === Math.ceil(y0 + h * 0.9) ? I.WATER_HI : I.WATER;
            set(x, y, c, 1);
          } else if (frame) set(x, y, I.WALL_HI);
        }
      }
      rect(x0 + Math.floor(r) - 1, y0, 2, h, I.TIMBER_SH); // mullion and transom
      rect(x0, y0 + Math.round(h * 0.45), w, 1, I.TIMBER_SH);
      rect(x0 - 3, y0 + h + 1, w + 6, 2, I.WALL_HI); rect(x0 - 3, y0 + h + 3, w + 6, 1, I.WALL_SH); // sill
      for (let k = 0; k < (w * h) / 18; k += 1) stars.push({ x: x0 + Math.floor(rng() * w), y: y0 + Math.floor(rng() * h * 0.6), ph: rng() * 6 });
      // the camp, far below: seen from the castle it is mirrored, so the knight and the wizard sit
      // to the right of their fire (outside, from the meadow's side, they are to its left)
      camps.push({ x: x0 + Math.max(1, Math.round(w * 0.3)), y: Math.round(y0 + h * 0.83) });
      pools.push({ x: x0 + w / 2, w, y0: y0 + h }); // a pale fall of light on the floor below it
      sills.push({ x0, w, y: y0 + h + 1, top: y0 }); // (y: the sill's top row)
      for (let k = 0; k < 10; k += 1) motes.push({ x: x0 + rng() * w, y: y0 + h + rng() * (yf - y0 - h), ph: rng() * 6 });
    }
    /** A rose window: eight petals in the colours of the schools between lead cames, a gold heart,
     *  a stone ring. Lit by the day like the windows (out = 1: the outdoor palette), dark at night. */
    function roseWindow(cx, cy, R) {
      const GLASS = [I.T_PRUNE, I.T_NAVY, I.T_AZURE, I.T_BORDEAUX, I.T_BRIGHT, I.T_GULES, I.T_PRUNE, I.T_NAVY];
      for (let y = -R - 2; y <= R + 2; y += 1) for (let x = -R - 2; x <= R + 2; x += 1) {
        const d = Math.hypot(x, y); const a = Math.atan2(y, x) + Math.PI; const sec = (a / (2 * Math.PI)) * 8;
        if (d > R + 2) continue;
        if (d > R + 0.6) { set(cx + x, cy + y, (x + y) % 3 ? I.ROCK_HI : I.ROCK); continue; } // the tracery's stone
        const lead = Math.abs(d - R) < 0.7 || Math.abs(d - R * 0.42) < 0.6 || (d > R * 0.42 && Math.abs(sec - Math.round(sec)) * d * 0.8 < 0.55);
        const c = lead ? I.OUTLINE : d < R * 0.42 ? (d < 1.2 ? I.T_GULES : I.T_OR) : GLASS[Math.floor(sec) % 8];
        set(cx + x, cy + y, c, lead ? 0 : 1);
      }
      pools.push({ x: cx, w: R * 1.6, y0: cy + R }); // its light on the floor
    }
    // the candles burn down through the evening (lit at five, out by six in the morning), new by day
    const hNow = clockFn().getHours() + clockFn().getMinutes() / 60; const since = (hNow + 24 - 17) % 24;
    const burnt = since < 13 ? since / 13 : 0;
    function candle(x, y, big) {
      const h = Math.max(1, Math.round((big ? 4 : 3) * (1 - 0.75 * burnt)));
      rect(x, y - h, 1, h, I.STEM); set(x, y, I.GOLD_SH); set(x - 1, y, I.GOLD); set(x + 1, y, I.GOLD);
      if (burnt > 0.3) set(x + 1, y - 1, I.STEM); // a run of wax down the stick
      flames.push({ x, y: y - h - 1 }); lights.push({ x, y: y - h, r: (big ? 0.5 : 0.38) * H * (1 - 0.25 * burnt) });
    }
    function desk(x, y, w) { // y: the top's height
      rect(x, y, w, 1, I.TIMBER_HI); rect(x, y + 1, w, 2, I.TIMBER); rect(x, y + 3, w, 1, I.TIMBER_SH);
      rect(x + 1, y + 4, 2, yf - y - 3, I.TIMBER_SH); rect(x + w - 3, y + 4, 2, yf - y - 3, I.TIMBER_SH);
    }
    const BOOK = [I.CLOTH, I.ROBE, I.GOLD_SH, I.HAT, I.DRAKE_SH, I.WING_SH, I.LEATHER, I.FERN_SH];
    function books(x, y, n, lean) { // spines standing on y
      let xx = x;
      for (let k = 0; k < n; k += 1) {
        const h = 4 + Math.floor(rng() * 4); const c = BOOK[Math.floor(rng() * BOOK.length)];
        rect(xx, y - h, 2, h, c); set(xx, y - h + 1, I.GOLD); set(xx + 1, y - h, c === I.GOLD_SH ? I.CLOTH : I.GOLD_SH);
        xx += 2 + (rng() < 0.2 ? 1 : 0);
        if (lean && k === n - 1) { set(xx, y - 1, c); set(xx + 1, y - 2, c); set(xx + 2, y - 3, c); }
      }
      return xx;
    }
    function openBook(x, y, w) {
      rect(x, y - 1, w, 1, I.LEATHER_SH);
      for (let k = 0; k < w; k += 1) {
        const hump = Math.round(Math.sin((k / (w - 1)) * Math.PI * 2) ** 2 * 1.5);
        set(x + k, y - 2 - hump, I.BEARD); set(x + k, y - 3 - hump, k === Math.floor(w / 2) ? I.BEARD_SH : I.BEARD_HI);
        if (k % 3 === 1 && k !== Math.floor(w / 2)) set(x + k, y - 2 - hump, I.BEARD_SH); // lines of text
      }
    }
    function shelf(x, y, w, h) { // a bookcase standing on the floor, top at y; returns its shelves
      rect(x, y, w, h, I.TIMBER_SH); rect(x, y, w, 1, I.TIMBER_HI); rect(x, y, 1, h, I.TIMBER_HI);
      const rows = [];
      for (let sy = y + 9; sy < y + h; sy += 9) {
        rect(x + 1, sy - 8, w - 2, 8, I.OUTLINE);
        books(x + 2, sy, Math.floor((w - 4) / 2.2), rng() < 0.5);
        rect(x + 1, sy, w - 2, 1, I.TIMBER);
        rows.push({ x: x + 1, y: sy - 8, w: w - 2, h: 9 });
      }
      return rows;
    }
    function rug(x, y, w) { // a fringed border, the room's weave inside (textures.js, squashed: we see it from above, far off)
      for (let r = 0; r < 4; r += 1) for (let k = 0; k < w; k += 1) set(x + k, y + r, r === 0 || r === 3 || k === 0 || k === w - 1 ? I.GOLD_SH : texAt(LOOK.rug || 'kilim', k * 2, r * 4 + 2));
      for (let k = 1; k < w - 1; k += 2) { set(x + k, y - 1, I.BEARD_SH); set(x + k, y + 4, I.BEARD_SH); } // (the fringe)
    }
    function lantern(x, y) { set(x, y - 1, I.OUTLINE); rect(x - 1, y, 3, 3, I.ARM_SH); set(x, y + 1, I.WIN_LIT); flames.push({ x, y: y + 1, small: true }); lights.push({ x, y: y + 1, r: 0.3 * H }); }

    const floorY = (k) => yf + Math.round(k * (H - yf)); // k in [0, 1]: from the wall to the near edge
    const cat = (name, x, yb) => { const c = SPRITES.cats[name]; if (c) stamp(c, x, yb - c.h); };

    function chandelier(cx0, y0 = 12) { // hangs from the beams on its chain: a ring of candles
      for (let y = 4; y < y0; y += 1) set(cx0, y, y % 2 ? I.ARM_SH : I.ARM);
      rect(cx0 - 7, y0, 15, 1, I.ARM_SH); rect(cx0 - 6, y0 + 1, 13, 1, I.ARM);
      [-6, -2, 2, 6].forEach((dx) => candle(cx0 + dx, y0 - 1, false));
    }

    /* the year inside too: a brazier and frost in winter, a vase of the season on the sill (or by the
       wall), apples in autumn; pumpkins and a cobweb on All Hallows, holly in December, lily of the
       valley on May Day. After the room's furniture, so it stands in front. */
    function seasonal() {
      const qs = new URLSearchParams(location.search).get('season');
      const d = today(); const season = ['spring', 'summer', 'autumn', 'winter'].includes(qs) ? qs : SEASON(d.getMonth());
      const fest = festival(d); const kind = fest && fest[0];
      const S = (f) => Math.round(BL + f * (BR - BL)); // a place on the back wall
      const sill = sills[0]; const corner = BR - 12; const fy = floorY(0.22);
      const vase = (x, yb, flower) => { // a jug and its bunch: stems fanning out, a flower on each
        rect(x, yb - 5, 5, 5, I.ROBE); rect(x, yb - 5, 1, 5, I.ROBE_HI); rect(x + 4, yb - 5, 1, 5, I.ROBE_SH); rect(x - 1, yb - 6, 7, 1, I.ROBE_SH);
        [[-3, 5], [-1, 7], [2, 8], [5, 7], [7, 5]].forEach(([dx, hgt], k) => {
          for (let j = 1; j < hgt; j += 1) set(x + 2 + Math.round((dx * j) / hgt), yb - 6 - j, I.FERN_SH);
          const fx = x + 2 + dx; const fy = yb - 6 - hgt; const c = flower[k % flower.length];
          set(fx, fy, c); set(fx - 1, fy, c); set(fx + 1, fy, c); set(fx, fy - 1, c); set(fx, fy + 1, I.FL_YEL);
        });
      };
      const vx = sill ? Math.round(sill.x0 + sill.w * 0.7) : S(0.08); const vy = sill ? sill.y : yf - 2;
      if (kind === 'may') vase(vx, vy, [I.FL_WHITE, I.FERN, I.FL_WHITE]);
      else if (season === 'spring') vase(vx, vy, [I.BLOSSOM, I.FL_YEL, I.FL_VIOLET]);
      else if (season === 'summer') vase(vx, vy, [I.FL_YEL, I.LEAF2, I.FL_YEL]);
      const along = (from, to) => Array.from({ length: Math.max(0, Math.floor(Math.abs(to - from) / 2) + 1) }, (_, k) => from + Math.sign(to - from) * 2 * k);
      const rk = roomOf(id); // (each room its own autumn: what that room would have in it)
      if (season === 'autumn' && kind !== 'samhain') {
        const free = (w, h, xs) => clearAt(xs || [...along(corner, S(0.55)), ...along(S(0.05), S(0.45))], fy, w, h);
        if (rk === 'contact') { const bx = free(11, 26); if (bx !== null) basket(bx + 1); } // the apples, delivered at the gate
        else if (rk === 'projects') { const bx = free(16, 14); if (bx !== null) logs(bx + 1); } // the winter's wood, laid in by the forge
        else if (rk === 'cellar') { const bx = free(14, 12); if (bx !== null) squashes(bx + 1); }
        // and leaves blown in under the window, wherever there is one
        const lx = sill ? sill.x0 + Math.round(sill.w / 2) : S(0.5);
        for (let k = 0; k < 9; k += 1) set(lx - 8 + Math.floor(rng() * 16), floorY(0.06 + rng() * 0.3), k % 3 ? I.LEAF : I.LEAF2);
      }
      function logs(x0) { // split logs stacked three, two, one: their ends to us, rings showing
        [[0, 0], [5, 0], [10, 0], [2, -4], [7, -4], [5, -8]].forEach(([dx, dy]) => {
          for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) if (x * x + y * y <= 5) set(x0 + 2 + dx + x, fy - 3 + dy + y, x * x + y * y <= 1 ? I.TIMBER_HI : x * x + y * y >= 4 ? I.TIMBER_SH : I.TIMBER);
        });
      }
      function squashes(x0) { // three squashes, ribbed, a stalk each
        [[0, 6, I.RUST], [7, 5, I.FL_YEL], [3, 4, I.RUST_HI]].forEach(([dx, r, c], k) => {
          const cx = x0 + dx + 3; const cy = fy - Math.round(r / 2) - (k === 2 ? 3 : 0);
          for (let y = -Math.round(r / 2); y <= Math.round(r / 2); y += 1) for (let x = -r / 2 - 1; x <= r / 2 + 1; x += 1) if ((x / (r / 2 + 1)) ** 2 + (y / (r / 2)) ** 2 <= 1) set(cx + x, cy + y, Math.round(x) % 2 ? c : I.RUST_SH);
          set(cx, cy - Math.round(r / 2) - 1, I.FERN_SH);
        });
      }
      function basket(corner) {
        rect(corner, fy - 5, 9, 5, I.TIMBER); rect(corner, fy - 5, 9, 1, I.TIMBER_HI); for (let k = 1; k < 9; k += 2) rect(corner + k, fy - 4, 1, 4, I.TIMBER_SH);
        [[1, -7], [3, -7], [5, -7], [7, -7], [2, -8], [4, -8], [6, -8], [3, -9], [5, -9]].forEach(([dx, dy], k) => { set(corner + dx, fy + dy, k % 3 ? I.CAP : I.LEAF2); set(corner + dx + 1, fy + dy, k % 3 ? I.CAP_SH : I.LEAF); });
      }
      if (season === 'spring' && !['research', 'cellar'].includes(rk)) { // a nest under a beam, two eggs in it (not under the dome nor the vault)
        const nx = [S(0.22), S(0.32), S(0.14), S(0.42)].find((x) => { for (let y = 5; y < 10; y += 1) for (let xx = x; xx < x + 8; xx += 1) if (furn[y * W + xx]) return false; return true; });
        if (nx !== undefined) { for (let k = 0; k < 8; k += 1) { set(nx + k, 9, I.TIMBER_SH); if (k > 0 && k < 7) set(nx + k, 8, k % 2 ? I.TIMBER : I.TIMBER_SH); } set(nx, 7, I.TIMBER_SH); set(nx + 7, 7, I.TIMBER_SH); set(nx + 3, 7, I.BEARD_HI); set(nx + 4, 7, I.WATER_HI); }
      }
      if (season === 'winter') { // icicles under each window's transom; blankets folded by the wall
        sills.forEach(({ x0: wx, w, top: wt, y: wb }) => { const ty = wt + Math.round((wb - wt) * 0.45) + 1; for (let x = wx + 1; x < wx + w - 1; x += 2) { const L = 1 + ((x * 7) % 3); for (let k = 0; k < L; k += 1) set(x, ty + k, k === L - 1 ? I.CLOUD : I.CLOUD_SH, 1); } });
        const bx = clearAt([S(0.08), S(0.9), S(0.18), S(0.8)], floorY(0.3), 10, 6);
        if (bx !== null) { const by = floorY(0.3); [[I.CLOTH, I.CLOTH_SH], [I.ROBE, I.ROBE_SH]].forEach(([c, c2], k) => { rect(bx, by - 3 - k * 3, 9, 3, c); for (let x = 0; x < 9; x += 3) set(bx + x, by - 2 - k * 3, c2); set(bx + 8, by - 3 - k * 3, c2); }); }
      }
      if (season === 'winter') (() => { // a brazier glowing by the wall (a free place); frost in the window's corners
        const by = floorY(0.3); const b0 = clearAt([...along(S(0.1), S(0.45)), ...along(S(0.9), S(0.55))], by, 9, 24); if (b0 === null) return; const bx = b0 + 4;
        rect(bx - 3, by - 3, 7, 1, I.ARM_SH); rect(bx - 2, by - 2, 5, 2, I.ARM); set(bx - 2, by, I.ARM_SH); set(bx + 2, by, I.ARM_SH);
        for (let k = -2; k <= 2; k += 2) flames.push({ x: bx + k, y: by - 4, small: true });
        lights.push({ x: bx, y: by - 5, r: 0.45 * H });
      })();
      // a freezing day: ferns of frost on the glass, grown up from the sill and the frame by
      // diffusion-limited aggregation (a random walker freezes where it touches the ice)
      if ((weather.temp ?? 9) <= 0 || (weather.frost ?? 9) <= -3) sills.forEach(({ x0: wx, w, y, top: wt }) => {
        const h = y - wt; const ice = new Uint8Array(w * h);
        const glass = (x, yy) => x >= 0 && x < w && yy >= 0 && yy < h && out[(wt + yy) * W + wx + x] === 1;
        const freeze = (x, yy) => { ice[yy * w + x] = 1; set(wx + x, wt + yy, bayer(x, yy) < 0.5 ? I.CLOUD : I.CLOUD_SH, 1); };
        for (let yy = 0; yy < h; yy += 1) for (let x = 0; x < w; x += 1) { // seeds: each pane's lower edge, its sides low down
          if (glass(x, yy) && (!glass(x, yy + 1) || ((!glass(x - 1, yy) || !glass(x + 1, yy)) && rng() < 0.3))) freeze(x, yy);
        }
        const iced = (x, yy) => x >= 0 && x < w && yy >= 0 && yy < h && ice[yy * w + x];
        const cold = clamp(-(weather.temp ?? -3) / 8, 0.3, 1); const target = Math.round(w * h * 0.16 * cold);
        for (let grown = 0, tries = 0; grown < target && tries < target * 30; tries += 1) {
          let x = Math.floor(rng() * w); let yy = Math.floor(h * rng());
          for (let st = 0; st < 1500 && glass(x, yy) && !ice[yy * w + x]; st += 1) {
            if (iced(x + 1, yy) || iced(x - 1, yy) || iced(x, yy + 1) || iced(x, yy - 1)) { freeze(x, yy); grown += 1; break; }
            const d = NEIGH[Math.floor(rng() * 4)]; const nx = x + d[0]; const ny = yy + d[1] + (rng() < 0.06 ? 1 : 0); // (a slight fall: the cold glass is lower down)
            if (glass(nx, ny)) { x = nx; yy = ny; } // (the leading and the frame turn it back)
          }
        }
      });
      if (kind === 'samhain') { // a carved pumpkin by the wall, lit; a cobweb in the corner
        const px0 = corner; const py = fy;
        rect(px0, py - 4, 6, 4, I.RUST_HI); rect(px0, py - 4, 6, 1, I.RUST); set(px0 + 3, py - 5, I.FERN_SH);
        set(px0 + 1, py - 3, I.FL_YEL); set(px0 + 4, py - 3, I.FL_YEL); rect(px0 + 2, py - 2, 2, 1, I.FL_YEL);
        lights.push({ x: px0 + 3, y: py - 3, r: 0.25 * H });
        const cx = BL + 1; const cy = 6;
        for (let k = 0; k < 9; k += 1) { set(cx + k, cy + Math.floor(k / 2), I.PLASTER_HI); set(cx + Math.floor(k / 2), cy + k, I.PLASTER_HI); }
        for (let k = 2; k < 8; k += 3) for (let j = 0; j <= k; j += 1) set(cx + k - j, cy + j, I.PLASTER);
      }
      if (kind === 'advent' || kind === 'christmas') { // holly along the beams, a wreath on the back wall
        for (let x = BL; x < BR; x += 1) { const y = 7 + Math.round(Math.abs(Math.sin((x - BL) / 7)) * 2); set(x, y, I.FERN_SH); if (x % 4 === 0) set(x, y + 1, I.CAP); }
        const wx = sill ? (sill.x0 > (BL + BR) / 2 ? S(0.2) : S(0.8)) : S(0.5); const wy = Math.round(H * 0.16); // beside the window, not behind it
        for (let a = 0; a < 6.28; a += 0.3) set(wx + Math.round(Math.cos(a) * 4), wy + Math.round(Math.sin(a) * 4), a % 0.9 < 0.3 ? I.CAP : I.FERN);
        set(wx, wy + 4, I.CAP); set(wx - 1, wy + 5, I.CAP); set(wx + 1, wy + 5, I.CAP);
      }
    }

    const things = itemsOf(id) || [];
    const slots = [];
    // a thing's own pixels (what drawing it changed in its box, with what was under), so the room can
    // lift it when pointed at and take it out of its place while its card is open: mark(() => draw it, return its box)
    const owned = new Map();
    const mark = (fn) => {
      const snap = idx.slice(); const b = fn(); if (!b) return b;
      const px = [];
      for (let y = Math.max(0, b.y - 1); y <= Math.min(H - 1, b.y + b.h); y += 1) for (let x = Math.max(0, b.x - 1); x <= Math.min(W - 1, b.x + b.w); x += 1) { const i = y * W + x; if (idx[i] !== snap[i]) px.push(i, snap[i], idx[i]); }
      owned.set(b, px); return b;
    };
    { // the room's things
    /* ---- the rooms of the castle: each piece of the section is a thing in the room ---------
       (assets/js/ui lists them: `things`); laid out on a table seen from a little above, a shelf,
       a wall, a board; a second row when the first is full, so more content only means more
       things. slots[i]: where thing i is, for its hotspot. */
    const S = (f) => Math.round(BL + f * (BR - BL)); // a place on the back wall (fraction of it)
    const Sw = (f) => Math.round(f * (BR - BL)); // a width on it
    const box = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    const shadow = (xc, y, w) => { for (let x = -Math.floor(w / 2); x <= Math.floor(w / 2); x += 1) if (bayer(xc + x, y) < 0.7) set(xc + x, y, I.TIMBER_SH); };
    function table3d(xc, w, depth = 7) { // the top a trapezoid (we look down on it), then its edge and legs
      const half = w / 2; const fy = floorY(0.5); const yTop = fy - 14 - depth; // (its near edge 14 px over the floor: an adult's hip)
      for (let r = 0; r < depth; r += 1) {
        const ins = depth - 1 - r;
        for (let x = Math.round(xc - half + ins); x <= Math.round(xc + half - ins); x += 1) set(x, yTop + r, r === 0 ? I.TIMBER_HI : (x * 3 + r * 7) % 13 === 0 ? I.TIMBER_SH : I.TIMBER);
      }
      rect(xc - half, yTop + depth, w + 1, 3, I.TIMBER_SH); rect(xc - half, yTop + depth, w + 1, 1, I.TIMBER);
      const legY = yTop + depth + 3;
      [xc - half + depth - 1, xc + half - depth - 1].forEach((lx) => rect(lx, legY, 2, fy - legY - 4, I.OUTLINE)); // the far legs
      [xc - half + 1, xc + half - 3].forEach((lx) => { rect(lx, legY, 3, fy - legY, I.TIMBER_SH); set(lx, legY, I.TIMBER); });
      return { l: Math.round(xc - half + depth + 1), r: Math.round(xc + half - depth - 1), back: yTop + 3, front: yTop + depth };
    }
    /** n places along [l, r], `per` apart at least; overflow goes to further rows. Drawn back rows first. */
    /** The places a holder of width r - l has, one every `per` px: their middles. A room's places are
     *  its own, whatever it holds: what comes later takes the next free one, nothing moves. */
    const places = (l, r, per) => { const fit = Math.max(1, Math.floor((r - l) / per)); return Array.from({ length: fit }, (_, k) => Math.round(l + ((k + 0.5) * (r - l)) / fit)); };
    /** An empty place: a frame on its nail with nothing in it yet (a charter's size). */
    const reserved = []; // (the empty places: the room's later pieces keep off them)
    function emptyFrame(xc, y) {
      const w = 15; const h = 18; const x = xc - 7; set(xc, y - 1, I.OUTLINE); reserved.push(box(x - 1, y - 2, w + 2, h + 3));
      for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) if (xx === x || xx === x + w - 1 || yy === y || yy === y + h - 1) set(xx, yy, (xx + yy) % 2 ? I.TIMBER_SH : I.TIMBER);
    }
    /** A small brass plate, blank: where a thing will stand. */
    const plateAt = (xc, y) => { rect(xc - 1, y, 3, 1, I.GOLD_SH); set(xc, y, I.GOLD_HI); };
    /** A school's charter pinned to the wall: a sheet of parchment, its lines of writing, a red initial,
     *  its foot folded up and a wax seal hanging from it on a cord, the wax the colour of the school's
     *  field (the shields themselves hang in the council chamber). */
    const fieldOf = (armsId) => { const rows = (window.ARMS || {})[armsId]; return rows ? I[TINCT[rows[1][1]]] : I.CAP; };
    function charter(xc, y, armsId) {
      const w = 15; const h = 18; const x = xc - 7;
      rect(x, y, w, h, I.BEARD_HI); rect(x + w - 1, y + 1, 1, h - 1, I.BEARD_SH); rect(x + 1, y + h - 1, w - 1, 1, I.BEARD_SH); // the sheet, its shadow side
      rect(x, y + h - 3, w, 1, I.BEARD_SH); // the fold
      set(x + 2, y + 2, I.CLOTH); set(x + 3, y + 2, I.CLOTH); set(x + 2, y + 3, I.CLOTH); // the initial
      for (let r = 0; r < 5; r += 1) rect(x + (r ? 2 : 5), y + 3 + r * 2, w - (r ? 4 : 7) - (r === 4 ? 4 : 0), 1, I.BEARD_SH); // lines
      set(xc, y - 1, I.OUTLINE); // its nail
      for (let k = 0; k < 3; k += 1) set(xc, y + h + k, I.CLOTH_SH); // the cord
      const f = fieldOf(armsId); // the seal
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (dx * dx + dy * dy <= 5) set(xc + dx, y + h + 5 + dy, dx * dx + dy * dy >= 4 ? I.OUTLINE : dx + dy < 0 ? I.GOLD_HI : f);
      return box(x - 1, y - 2, w + 2, h + 9);
    }
    function scrollThing(xc, yb, armsId) { // a rolled report, tied, its seal the colour of the lab's field
      const x = xc - 7;
      rect(x + 1, yb - 4, 12, 4, I.PLASTER_HI); rect(x + 1, yb - 4, 12, 1, I.PLASTER_HI); rect(x + 1, yb - 1, 12, 1, I.PLASTER_SH);
      rect(x, yb - 4, 1, 4, I.PLASTER_SH); rect(x + 13, yb - 4, 1, 4, I.PLASTER_SH); set(x, yb - 3, I.PLASTER_HI); set(x + 13, yb - 3, I.PLASTER_HI);
      rect(x + 4, yb - 4, 1, 4, I.CLOTH); rect(x + 9, yb - 4, 1, 4, I.CLOTH);
      const rows = (window.ARMS || {})[armsId]; const f = rows ? I[TINCT[rows[1][1]]] : I.CAP;
      rect(x + 5, yb - 3, 4, 3, f); set(x + 6, yb - 2, I.GOLD); set(x + 7, yb - 2, I.GOLD);
      shadow(xc, yb, 13);
      return box(x - 1, yb - 6, 16, 8);
    }
    function model(xc, yb, mid) { // each project as a working model on its plinth
      rect(xc - 5, yb - 1, 11, 1, I.TIMBER_SH); rect(xc - 4, yb - 2, 9, 1, I.TIMBER);
      if (mid === 'nuclear-emulators') { // a nucleus and two orbits, on a brass rod
        rect(xc, yb - 7, 1, 5, I.ARM_SH);
        for (let a = 0; a < 6.28; a += 0.25) { set(xc + Math.round(Math.cos(a) * 5), yb - 11 + Math.round(Math.sin(a) * 2), I.ARM_HI); set(xc + Math.round(Math.cos(a) * 2), yb - 11 + Math.round(Math.sin(a) * 4), I.GOLD); }
        [[0, 0, I.CAP], [1, 0, I.WING], [0, 1, I.WING], [1, 1, I.CAP], [-1, 0, I.WING_SH], [0, -1, I.CAP_SH]].forEach(([dx, dy, c]) => set(xc + dx, yb - 11 + dy, c));
      } else if (mid === 'urban-morphogenesis') { // a jar where a little city has grown like a crystal
        for (let y = yb - 13; y < yb - 2; y += 1) { set(xc - 4, y, I.PLASTER_SH); set(xc + 4, y, I.PLASTER_HI); }
        rect(xc - 4, yb - 14, 9, 1, I.TIMBER); rect(xc - 3, yb - 15, 7, 1, I.TIMBER_HI);
        [[0, 0], [0, -1], [-1, -2], [1, -2], [0, -3], [-2, -3], [2, -4], [-1, -5], [1, -5], [-3, -5], [0, -6], [2, -7], [-2, -7], [1, -8], [-1, -9], [3, -6]]
          .forEach(([dx, dy]) => set(xc + dx, yb - 3 + dy, I.GOLD_HI));
      } else if (mid === 'n-body') { // three masses on wires round a centre
        rect(xc, yb - 8, 1, 6, I.ARM_SH);
        [[-4, -10, I.CAP], [4, -11, I.WING_HI], [1, -14, I.GOLD_HI]].forEach(([dx, dy, c]) => {
          for (let k = 0; k <= 8; k += 1) set(xc + Math.round((dx * k) / 8), yb - 8 + Math.round(((dy + 8) * k) / 8), I.ARM);
          rect(xc + dx - 1, yb + dy - 1, 2, 2, c);
        });
      } else { rect(xc - 4, yb - 9, 9, 7, I.TIMBER); rect(xc - 4, yb - 9, 9, 1, I.TIMBER_HI); set(xc, yb - 6, I.GOLD); } // a crate
      rect(xc + 5, yb - 4, 3, 2, I.PLASTER_HI); set(xc + 4, yb - 4, I.OUTLINE); // its paper tag
      shadow(xc, yb, 10);
      return box(xc - 6, yb - 17, 15, 18);
    }
    function bookFace(xc, yb, k) { // a book shown face out, gilt title
      const c = BOOK[k % BOOK.length]; const x = xc - 4;
      rect(x, yb - 12, 9, 12, c); rect(x, yb - 12, 1, 12, I.OUTLINE);
      rect(x + 2, yb - 11, 6, 1, I.GOLD); rect(x + 2, yb - 2, 6, 1, I.GOLD); rect(x + 3, yb - 8, 4, 1, I.GOLD_HI); rect(x + 3, yb - 6, 4, 1, I.GOLD_HI);
      return box(x - 1, yb - 13, 11, 14);
    }
    function letterThing(xc, y, k) { // a sealed letter pinned up, a little askew
      const x = xc - 6 + ((k * 7) % 3) - 1; const yy = y + ((k * 5) % 3) - 1;
      rect(x, yy, 12, 9, I.PLASTER_HI); rect(x, yy, 12, 1, I.PLASTER_HI); rect(x + 11, yy, 1, 9, I.PLASTER_SH); rect(x, yy + 8, 12, 1, I.PLASTER_SH);
      for (let r = 0; r < 3; r += 1) rect(x + 2, yy + 3 + r * 2, 7 - (r === 2 ? 3 : 0), 1, I.PLASTER_SH);
      rect(x + 8, yy + 5, 2, 2, I.CAP); set(x + 5, yy - 1, I.GOLD); set(x + 5, yy, I.ARM_SH);
      return box(x - 1, yy - 2, 14, 12);
    }
    function door(a, b, t) { // a great door under a round arch
      const r = (b - a) / 2;
      for (let y = t - 3; y < yf; y += 1) for (let x = a - 3; x < b + 3; x += 1) {
        const ax = (x + 0.5 - a - r) / r; const ay = (y - t - r) / r;
        const inArch = y >= t + r ? x >= a && x < b : ax * ax + ay * ay <= 1;
        const inStone = y >= t + r ? x >= a - 3 && x < b + 3 : ax * ax + ay * ay <= ((r + 3) / r) ** 2;
        if (inArch) set(x, y, (x - a) % 5 === 0 ? I.TIMBER_SH : (y - t) % 12 === 6 ? I.ARM_SH : noise2(x, y) > 0.6 ? I.TIMBER_SH : I.TIMBER);
        else if (inStone) set(x, y, (x + y) % 7 === 0 ? I.ROCK_DK : I.ROCK_HI);
      }
      set(b - 4, Math.round((t + yf) / 2) + 4, I.GOLD); set(b - 4, Math.round((t + yf) / 2) + 5, I.GOLD_SH);
    }
    const n = things.length;
    /* a room that grows with the years shows what fits, newest first, and keeps the rest in its archive:
       one thing whose card holds the others in full (late: placed once the room is furnished, on free floor) */
    const late = [];
    const shown = (cap) => (n > cap ? Math.max(0, cap - 1) : n); // (a place kept for the archive itself)
    function archive(style, hidden, title, at, fallback) { // (fallback: the piece that holds them when the floor has no room)
      if (!hidden.length) return;
      const card = { kind: 'archive', label: `${title} (${hidden.length} more)`, html: `<h3>${escHtml(title)}</h3><p class="dim">${hidden.length} more, older first-seen last:</p>`
        + hidden.map((i) => `<section class="archived">${things[i].html}</section>`).join('<hr>') };
      if (at) { extra.push({ t: card, b: at }); return; } // (an existing piece holds them: the rookery's chest)
      const fy = floorY(0.3); const w = style === 'crate' ? 14 : 12; const h = style === 'crate' ? 10 : 9;
      const x = clearAt([S(0.62), S(0.7), S(0.78), S(0.38), S(0.3), S(0.22), S(0.86), S(0.14), S(0.5)], fy, w + 2, h + 4); if (x === null) { if (fallback) extra.push({ t: card, b: fallback }); return; }
      if (style === 'crate') { // a crate, its slats, straw at the top
        rect(x, fy - h, w, h, I.TIMBER); for (let y = fy - h + 3; y < fy; y += 3) rect(x, y, w, 1, I.TIMBER_SH); rect(x, fy - h, 1, h, I.TIMBER_HI); rect(x + w - 1, fy - h, 1, h, I.TIMBER_SH);
        for (let k = 0; k < w; k += 2) set(x + k, fy - h - 1, I.CORK);
      } else if (style === 'pile') { // bound volumes stacked, tied with string
        [[0, I.CLOTH], [1, I.ROBE], [0, I.LEATHER], [2, I.FERN_SH]].forEach(([dx, c], k) => { rect(x + dx, fy - 2 - k * 2, w - 3, 2, c); set(x + dx, fy - 2 - k * 2, I.GOLD); });
        rect(x + 4, fy - 9, 1, 9, I.BEARD_SH);
      } else { // a wicker basket of rolled scrolls
        rect(x, fy - 6, w, 6, I.CORK); for (let k = 1; k < w; k += 2) rect(x + k, fy - 5, 1, 5, I.CORK_SH); rect(x, fy - 6, w, 1, I.CORK_SH);
        [1, 4, 7, 9].forEach((dx, k) => { rect(x + dx, fy - 9 - (k % 2), 2, 4, I.BEARD_HI); set(x + dx, fy - 9 - (k % 2), I.BEARD); });
      }
      extra.push({ t: card, b: box(x - 1, fy - h - 3, w + 2, h + 4) });
    }
    /* the path so far, as wall hangings: each school or lab its own small tapestry on a rod,
       the schools in the council chamber, the labs in the observatory; each one can be looked at */
    const LABS = new Set(['ijclab', 'ceremade', 'sciencespo']);
    const hangs = (heraldry.tapestry || []).filter(([aid]) => (kind === 'research' ? LABS.has(aid) : kind === 'talks' ? !LABS.has(aid) : false));
    const extra = [];
    const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    /** In the observatory a lab is a chart of the sky in a frame, its emblem in the corner; in the
     *  council chamber, a school's shield on a woven hanging. */
    function hanging(xc, y0, [aid, name, desc], k) {
      if (kind === 'research') {
        const w = 18; const h = 16; const x = xc - 9; const cy = y0 + 3; const rng2 = mulberry32(aid.length * 131 + k);
        set(xc, y0, I.OUTLINE); // its nail
        rect(x, cy, w, h, I.TIMBER); rect(x, cy, w, 1, I.TIMBER_HI); rect(x + 1, cy + 1, w - 2, h - 2, I.T_NAVY);
        for (let n = 0; n < 11; n += 1) set(x + 2 + Math.floor(rng2() * (w - 4)), cy + 2 + Math.floor(rng2() * (h - 4)), n % 4 ? I.PLASTER_HI : I.GOLD_HI); // its stars
        for (let a = 0; a < 6.28; a += 0.2) set(Math.round(x + w / 2 + Math.cos(a) * 5), Math.round(cy + h / 2 + Math.sin(a) * 3), I.GOLD_SH); // the ecliptic
        rect(x + w - 6, cy + h - 6, 5, 5, fieldOf(aid)); rect(x + w - 6, cy + h - 6, 5, 1, I.GOLD_SH); // the lab's emblem, small
        extra.push({ t: { kind: 'hanging', label: name, html: `<h3>${escHtml(name)}</h3><p>${escHtml(desc)}</p>` }, b: box(x - 1, y0, w + 2, h + 4) });
        return;
      }
      const w = 17; const h = 19; const x = xc - 8; const cy = y0 + 2;
      rect(x - 2, y0, w + 4, 1, I.TIMBER_SH); set(x - 3, y0, I.GOLD); set(x + w + 2, y0, I.GOLD); // the rod and its finials
      set(x + 2, y0 + 1, I.OUTLINE); set(x + w - 3, y0 + 1, I.OUTLINE); // its rings
      for (let y = 0; y < h; y += 1) for (let xx = 0; xx < w; xx += 1) {
        const edge = xx === 0 || xx === w - 1 || y === 0 || y === h - 1;
        set(x + xx, cy + y, edge ? I.GOLD_SH : (xx + y * 3 + k) % 7 === 0 ? I.PLASTER : I.PLASTER_HI); // woven, a little uneven
      }
      for (let xx = 0; xx < w; xx += 2) set(x + xx, cy + h, I.GOLD); // the fringe
      const sp = armsSprite(aid); if (sp) stamp(sp, x + 2, cy + 2);
      extra.push({ t: { kind: 'hanging', label: name, html: `<h3>${escHtml(name)}</h3><p>${escHtml(desc)}</p>` }, b: box(x - 2, y0, w + 4, h + 4) });
    }
    const of = (kind) => things.map((t, i) => [t, i]).filter(([t]) => t.kind === kind);
    function mobilier(k, x, yb) { // a piece after Viollet-le-Duc (_tools/fetch_mobilier.py) standing on yb, x its left
      const mb = realGet('mobilier'); if (!mb) return;
      const sp = mb.sprites[k]; const y0 = yb - sp.h + 1; const c = mb.captions[k];
      for (let y = 0; y < sp.h; y += 1) for (let xx = 0; xx < sp.w; xx += 1) { const v = sp.px[y * sp.w + xx]; if (v >= 0) set(x + xx, y0 + y, v === I.OUTLINE ? I.TIMBER_SH : v); } // (the engraving's black lines as dark oak: black outlined it like a cartoon)
      rect(x + 1, yb + 1, sp.w - 2, 1, I.OUTLINE); // (its shadow on the floor)
      extra.push({ t: { kind: 'mobilier', label: c.name, get html() { return `<h3>${escHtml(c.name)}</h3><p>${escHtml(c.text)}.</p>${provenance('mobilier', k)}`; } }, b: box(x - 1, y0 - 1, sp.w + 2, sp.h + 2) });
    }

    if (kind === 'about') { // the scriptorium, laid out left to right along the back wall: the bookcase, the
      // great book of courses on its lectern, the copyist at his desk, the table under the window, the book
      // of hours on its lectern, the scrying engine alone in the corner on a stone dais; the charters above
      const ww = 20; windowArch(S(0.5) - Math.round(ww / 2), winY(38), ww, 38); // the great window, over the table
      const shTop = yf - 45; shelf(S(0.01), shTop, Sw(0.11), yf - shTop); // (five shelves: a head and a half over a man) // the bookcase, against the left
      // the charters either side of the window, over all the rest: as many places as the wall holds,
      // each a nail and a frame; a charter in it, or the frame empty for the next one
      const ch = of('charter'); const cy0 = Math.round(H * 0.12);
      const byWindow = (a, b) => Math.abs(a[0] - S(0.5)) - Math.abs(b[0] - S(0.5)); // (from the window outwards, either side in turn)
      const row = (l, r, y) => places(l, r, 22).map((xc) => [xc, y]);
      const cplaces = [...[...row(S(0.1), S(0.43), cy0), ...row(S(0.58), S(0.8), cy0)].sort(byWindow), // a second row under the first, clear of the bookcase
        ...[...row(S(0.15), S(0.43), cy0 + 30), ...row(S(0.58), S(0.8), cy0 + 30)].sort(byWindow)];
      cplaces.forEach(([xc, y], k) => { if (ch[k]) slots[ch[k][1]] = mark(() => charter(xc, y, ch[k][0].arms)); else emptyFrame(xc, y); });
      { // the great book of courses, open on its lectern: a post, a slanted desk, the book, a red ribbon
        const lc = S(0.2); const lx = lc - 11; const top = yf - 22;
        rect(lc - 1, top + 6, 3, yf - top - 6, I.TIMBER_SH); rect(lc - 5, yf - 1, 11, 1, I.TIMBER_SH); // post and foot
        for (let k = 0; k < 23; k += 1) set(lx + k, top + 4 + Math.floor(k / 8), I.TIMBER_HI); // the desk
        rect(lx, top + 1, 23, 1, I.GOLD_SH); openBook(lx + 1, top + 1, 21); // the book, its gilt edge
        for (let k = 0; k < 5; k += 1) set(lc, top + k, I.CLOTH); // the ribbon
        of('ledger').forEach(([, i]) => { slots[i] = box(lx - 1, top - 6, 25, 12); });
      }
      { // the copyist on his stool at a sloping desk his own size, an inkhorn in it (realGet: cards.copyist)
        const fy = floorY(0.12); const mx = S(0.28); const sp = shadeSprite(MONK);
        rect(mx, fy - 7, 8, 1, I.TIMBER_HI); rect(mx + 1, fy - 6, 1, 7, I.TIMBER_SH); rect(mx + 6, fy - 6, 1, 7, I.TIMBER_SH); // the stool
        stamp(sp, mx, fy - 7 - sp.h + 2);
        const dx = mx + 10; const top = fy - 20; // the desk: a slanted board on two legs, the page on it
        rect(dx + 1, top + 6, 1, fy - top - 6, I.TIMBER_SH); rect(dx + 10, top + 3, 1, fy - top - 3, I.TIMBER_SH); rect(dx, fy, 12, 1, I.OUTLINE);
        for (let k = 0; k < 12; k += 1) { set(dx + k, top + 5 - Math.floor(k / 3), I.TIMBER_HI); set(dx + k, top + 6 - Math.floor(k / 3), I.TIMBER); }
        for (let k = 1; k < 10; k += 1) { set(dx + k, top + 4 - Math.floor(k / 3), I.BEARD_HI); set(dx + k, top + 3 - Math.floor(k / 3), k % 2 ? I.BEARD_SH : I.BEARD_HI); }
        set(dx + 11, top + 1, I.OUTLINE); set(dx + 11, top, I.LEATHER_SH); set(dx + 12, top - 1, I.BEARD_HI); // the inkhorn, a quill in it
        deco.push({ type: 'copyist', x: dx + 1, y: top + 3 });
        realGet('rose');
        extra.push({ t: { kind: 'quill', label: 'The copyist', get html() { return `${cards.copyist()}<h3>His page</h3><div class="play"></div>`; } }, b: box(mx - 1, top - 3, 24, fy - top + 4) }); // (his card, and his page to draw on: ui/10-play.js)
        deco.push({ type: 'inked', x: dx + 2, y: top + 1 }); // (what the visitor drew, small, on his page)
      }
      const tb = table3d(S(0.53), 28); // the table under the window: the notebook, two candles, the hourglass
      of('desk-book').forEach(([, i]) => { slots[i] = mark(() => { openBook(S(0.53) - 8, tb.front, 16); return box(S(0.53) - 9, tb.front - 6, 18, 7); }); });
      candle(tb.l - 1, tb.back, true); candle(tb.r + 1, tb.back, false);
      deco.push({ type: 'hourglass', x: tb.r - 4, y: tb.front - 10 });
      rug(S(0.36), floorY(0.62), Sw(0.3));
      const bh = realGet('heures'); // the book of hours, open at this month's page, on its lectern right of the window
      if (bh) {
        const lx = S(0.63); const top = yf - 22; const pg = bh.small; const m = today().getMonth();
        rect(lx + 12, top + 6, 3, yf - top - 6, I.TIMBER_SH); rect(lx + 8, yf - 1, 11, 1, I.TIMBER_SH); // its post and foot
        for (let k = 0; k < 28; k += 1) set(lx + k, top + 4 + Math.floor(k / 9), I.TIMBER_HI); // the slanted desk
        rect(lx, top - 13, 13, 16, I.BEARD_HI); for (let r = 0; r < 6; r += 1) rect(lx + 2, top - 11 + r * 2, 9 - (r % 2) * 2, 1, I.BEARD_SH); // the left page: text
        set(lx + 2, top - 11, I.CLOTH); set(lx + 3, top - 11, I.CLOTH); // (a red initial)
        for (let y = 0; y < pg.h; y += 1) for (let x = 0; x < pg.w; x += 1) { const c = pg.frameIdx[m][y * pg.w + x]; if (c >= 0) set(lx + 14 + x, top - 13 + y, c); } // the right page: the miniature
        rect(lx + 13, top - 13, 1, 16, I.LEATHER_SH); rect(lx - 1, top + 3, 28, 1, I.LEATHER); // the gutter, the binding
        extra.push({ t: { kind: 'hours', label: 'The book of hours', get html() { return cards.hours(); } }, b: box(lx - 2, top - 15, 31, 20) });
      }
      { // the scrying engine, alone in the right corner on a stone dais: an old cabinet of oak and brass,
        // keys like an organ's, a round glass that glows; the terminal opens in it (ui/05-engine.js: openEngine).
        // Its screen, orb and halo live in drawInterior
        const ex = BR - 26; const eb = yf + 4; const cb = eb - 3; // (cb: the cabinet's foot, on four legs)
        rect(ex - 3, eb - 1, 26, 3, I.ROCK); rect(ex - 3, eb - 1, 26, 1, I.ROCK_HI); rect(ex - 3, eb + 2, 26, 1, I.ROCK_DK); // the dais
        [0, 3, 16, 19].forEach((dx) => rect(ex + dx, cb + 1, 1, 1, dx === 0 || dx === 19 ? I.TIMBER_SH : I.OUTLINE)); // the legs
        rect(ex, cb - 8, 20, 9, I.TIMBER_SH); rect(ex + 1, cb - 7, 18, 7, I.TIMBER); rect(ex, cb - 8, 20, 1, I.TIMBER_HI); // the cabinet
        [[2, 7], [11, 7]].forEach(([dx, w]) => { rect(ex + dx, cb - 6, w, 5, I.TIMBER_HI); rect(ex + dx + 1, cb - 5, w - 2, 3, I.TIMBER); }); // two panels
        [[0, -8], [19, -8], [0, 0], [19, 0]].forEach(([dx, dy]) => set(ex + dx, cb + dy, I.GOLD)); // brass corners
        rect(ex + 1, cb - 10, 18, 2, I.TIMBER_SH); for (let k = 0; k < 16; k += 1) set(ex + 2 + k, cb - 10, k % 3 === 2 ? I.OUTLINE : I.CREAM); // the keys
        const ht = cb - 25; // the brass hood, arched
        for (let y = 0; y < 15; y += 1) for (let x = 0; x < 16; x += 1) {
          const arch = y < 3 && (Math.min(x, 15 - x) < 3 - y); if (arch) continue;
          const rim = y === 0 || x === 0 || x === 15 || (y < 3 && Math.min(x, 15 - x) === 3 - y);
          set(ex + 2 + x, ht + y, rim ? (x < 8 ? I.GOLD_HI : I.GOLD) : (x + y) % 5 === 0 ? I.GOLD : I.GOLD_SH);
        }
        for (let k = 0; k < 3; k += 1) { set(ex, ht + 4 + k * 4, I.GOLD); set(ex + 1, ht + 4 + k * 4, I.GOLD_HI); set(ex, ht + 5 + k * 4, I.GOLD_SH); } // three dials, on the side
        rect(ex + 18, ht + 8, 2, 1, I.ARM_SH); rect(ex + 20, ht + 5, 1, 4, I.ARM_SH); set(ex + 20, ht + 4, I.CLOTH); set(ex + 21, ht + 4, I.CLOTH); // the crank
        rect(ex + 9, ht - 3, 2, 3, I.GOLD_SH); set(ex + 8, ht - 1, I.GOLD); set(ex + 11, ht - 1, I.GOLD); // the stem, its collar
        deco.push({ type: 'engine', x: ex + 5, y: ht + 3, w: 10, h: 10, ox: ex + 10, oy: ht - 6, halo: true });
        lights.push({ x: ex + 10, y: ht + 8, r: 0.16 * H });
        extra.push({ t: { kind: 'engine', label: 'The scrying engine: the site as a terminal', html: '' }, b: box(ex - 3, ht - 8, 26, cb - ht + 13) });
      }
    } else if (kind === 'research') { // the observatory, left to right: the loom (the Ising weave), the
      // telescope on its tripod aimed out of the window, the window under the dome, the astrolabe, the
      // chart table with a map of the sky and the labs' reports, the orrery; the labs' star charts above
      for (let y = 4; y < Math.round(H * 0.42); y += 1) {
        const half = Math.sqrt(Math.max(0, 1 - ((Math.round(H * 0.42) - y) / (H * 0.4)) ** 2)) * W * 0.5; // (over the side walls too: the dome caps the whole tower)
        for (let x = 0; x < W; x += 1) if (Math.abs(x - W / 2) > half) set(x, y, (x + Math.round(y * 1.5)) % 9 === 0 ? I.SLATE_HI : (x + y) % 5 ? I.SLATE_SH : I.SLATE);
      }
      const sw = 22; const wx0 = S(0.47) - Math.round(sw / 2); const wy0 = winY(42); windowArch(wx0, wy0, sw, 42); // the observing window, wide open
      const winL = wx0 - 3; const winR = wx0 + sw + 3; const hy = Math.round(H * 0.18);
      { // the telescope: a brass tube on a wooden tripod, its eyepiece low, its mouth to the window's sky
        const fx = S(0.3); const fy = floorY(0.08); const hx = fx; const hy0 = fy - 22; // the tripod's head
        [[-7, 0], [0, 2], [7, 0]].forEach(([dx, dy]) => { for (let r = 0; r <= 22; r += 1) set(Math.round(hx + (dx * r) / 22), hy0 + r + Math.round((dy * r) / 22), r === 22 ? I.TIMBER_SH : I.TIMBER); });
        const tx0 = hx - 6; const ty0 = hy0 + 4; const tx1 = wx0 + 6; const ty1 = wy0 + 14; const n2 = Math.max(Math.abs(tx1 - tx0), Math.abs(ty1 - ty0));
        for (let k = 0; k <= n2; k += 1) { const x = Math.round(tx0 + ((tx1 - tx0) * k) / n2); const y = Math.round(ty0 + ((ty1 - ty0) * k) / n2); const w2 = k > n2 * 0.6 ? 2 : 1; for (let d = 0; d <= w2; d += 1) set(x, y + d, d === 0 ? I.GOLD_HI : d === w2 ? I.GOLD_SH : I.GOLD); }
        rect(tx0 - 2, ty0, 3, 2, I.ARM_SH); // the eyepiece
        deco.push({ type: 'eyepiece', x: tx0 - 2, y: ty0 });
      }
      { // the astrolabe on its shackle, right of the window (its card: cards.astrolabe)
        const ax = winR + 9; const ay = wy0 + 18; const R = 6; realGet('astrolabe');
        for (let y = -R; y <= R; y += 1) for (let x = -R; x <= R; x += 1) { const r = Math.hypot(x, y); if (r <= R + 0.2) set(ax + x, ay + y, r > R - 1.2 ? I.GOLD : (x * 3 + y * 5) % 7 === 0 ? I.OUTLINE : I.GOLD_SH); }
        for (let k = -4; k <= 4; k += 1) set(ax + k, ay - Math.round(Math.sqrt(Math.max(0, 16 - k * k)) * 0.6) + 1, I.GOLD_HI); // the rete
        set(ax, ay, I.CREAM); set(ax, ay - R - 1, I.GOLD); set(ax, ay - R - 2, I.GOLD_HI); // the pin, the ring
        extra.push({ t: { kind: 'astrolabe', label: 'The astrolabe', get html() { return cards.astrolabe(); } }, b: box(ax - R - 1, ay - R - 3, 2 * R + 3, 2 * R + 4) });
      }
      // the labs' star charts, either side of the window, out from its edges (none where no room)
      const taken = [[winR + 1, winR + 17]];
      const fits = (xc) => xc - 10 >= BL + 1 && xc + 11 <= BR - 2 && !taken.some(([a0, b0]) => xc + 11 >= a0 && xc - 10 <= b0);
      hangs.forEach((e, k) => {
        const sides = k < Math.ceil(hangs.length / 2) ? [-1, 1] : [1, -1];
        for (const d of sides) {
          let xc = d < 0 ? winL - 11 : winR + 10; while (!fits(xc) && xc - 10 > BL && xc + 11 < BR) xc += d;
          if (!fits(xc)) continue;
          hanging(xc, hy, e, k); taken.push([xc - 10, xc + 11]); break;
        }
      });
      const orX = BR - 12; // the orrery, by the cabinet
      { // the cabinet of pigeonholes, a report rolled in each (its seal on a ribbon hanging out); the empty ones wait
        const CC = 4; const CR = 3; const cw = 9; const chh = 7; const cbw = CC * cw + 3; const cbh = CR * chh + 3;
        const cx0 = Math.min(S(0.72) - Math.round(cbw / 2), orX - 10 - cbw); const ctop = yf - 12 - cbh;
        rect(cx0, ctop, cbw, cbh, I.TIMBER); rect(cx0 - 1, ctop - 2, cbw + 2, 2, I.TIMBER_HI); rect(cx0 - 1, ctop + cbh, cbw + 2, 1, I.TIMBER_SH);
        rect(cx0 + 1, ctop + cbh + 1, 2, yf - ctop - cbh - 1, I.TIMBER_SH); rect(cx0 + cbw - 3, ctop + cbh + 1, 2, yf - ctop - cbh - 1, I.TIMBER_SH); // its legs
        const nS = shown(CC * CR); reserved.push(box(cx0 - 1, ctop - 6, cbw + 2, cbh + 8)); // (no one stands before it)
        for (let k = 0; k < CC * CR; k += 1) {
          const x = cx0 + 2 + (k % CC) * cw; const y = ctop + 2 + Math.floor(k / CC) * chh;
          rect(x, y, cw - 2, chh - 2, I.OUTLINE); set(x, y, I.TIMBER_SH); // the hole
          if (k < nS) slots[k] = mark(() => { // the report, end on: its roll, its seal hanging on a ribbon
            const f = fieldOf(things[k].arms); rect(x + 1, y + 1, 4, 3, I.PLASTER_HI); set(x + 1, y + 1, I.PLASTER); set(x + 4, y + 3, I.PLASTER_SH); set(x + 2, y + 2, I.PLASTER_SH);
            set(x + 5, y + 2, I.CLOTH); set(x + 5, y + 3, I.CLOTH); set(x + 5, y + 4, f); set(x + 6, y + 4, f); set(x + 5, y + 5, f);
            return box(x - 1, y - 1, cw, chh + 1);
          });
          else plateAt(x + Math.floor((cw - 2) / 2), y + chh - 2); // (an empty hole: its blank plate)
        }
        late.push(() => archive('basket', things.map((_, i) => i).slice(nS), 'The basket of older reports', null, box(cx0, ctop, cbw, cbh)));
        candle(cx0 + cbw - 3, ctop - 2, true); // (on the cabinet: to read by at night)
      }
      deco.push({ type: 'orrery', x: orX, y: floorY(0.1) - 14 });
      { // the loom: two posts from the floor, a beam at the top and one at the foot, the weave between
        const w = 22; const h = 28; const x = S(0.05); const y0 = yf - h - 14;
        rect(x - 3, y0 - 4, 2, yf - y0 + 4, I.TIMBER); rect(x + w + 1, y0 - 4, 2, yf - y0 + 4, I.TIMBER); // the posts
        rect(x - 4, y0 - 4, w + 8, 2, I.TIMBER_HI); rect(x - 4, y0 + h + 2, w + 8, 2, I.TIMBER_SH); // the beams
        for (let xx = 0; xx < w; xx += 3) set(x + xx, y0 - 2, I.BEARD_SH); // the warp's threads over the top
        deco.push({ type: 'ising', x, y: y0, w, h });
        extra.push({ t: { kind: 'loom', label: "The weaver's loom", get html() { return loomCard(); } }, b: box(x - 4, y0 - 4, w + 8, yf - y0 + 4) });
      }
      cat('thin', S(0.4), floorY(0.4));
    } else if (kind === 'projects') { // the workshop, left to right: the forge (a raised hearth under its
      // hood, the bellows, the anvil on its stump, a winch with its gears over it), the bench with the
      // working models, the tool board over it, the map of the realm on the wall, Young's slits on a stand
      const hx = S(0.02); const hw = 32; const hb = yf - 10; // the forge's hearth: a stone base, the fire on it
      rect(hx - 2, hb, hw + 4, yf - hb, I.ROCK); rect(hx - 2, hb, hw + 4, 1, I.ROCK_HI); for (let x = hx; x < hx + hw; x += 6) rect(x, hb + 1, 1, yf - hb - 1, I.ROCK_DK);
      rect(hx, hb - 3, hw, 3, I.OUTLINE); // the fire bed (the flames: drawInterior)
      for (let y = 0; y < 24; y += 1) { const ins = Math.round((y / 24) * 11); rect(hx - 2 + ins, hb - 4 - y, hw + 4 - 2 * ins, 1, y === 0 ? I.BRICK_HI : (y % 3 ? I.BRICK : I.BRICK_SH)); } // the hood, narrowing
      const fx0 = hx + Math.round(hw / 2) - 5; for (let y = 0; y < hb - 28; y += 1) rect(fx0, y, 10, 1, y % 3 ? I.BRICK : I.BRICK_SH); // the flue, up through the ceiling
      for (let y = hb - 22; y < hb - 4; y += 1) for (let x = hx + 6; x < hx + hw - 6; x += 1) if (bayer(x, y) < 0.5) set(x, y, I.ROCK_DK); // soot on the hood
      flames.push({ x: hx + hw / 2, y: hb - 1, hearth: true, w: hw - 8 }); lights.push({ x: hx + hw / 2, y: hb - 6, r: 0.6 * H, hearth: true });
      { const bx = hx + hw + 3; const by = hb - 2; // the bellows: two boards, leather between, the nozzle to the fire
        for (let k = 0; k < 10; k += 1) { set(bx + k, by - 4 + Math.floor(k / 4), I.TIMBER_HI); set(bx + k, by + 3 - Math.floor(k / 4), I.TIMBER_SH); for (let y = by - 3 + Math.floor(k / 4); y < by + 3 - Math.floor(k / 4); y += 1) set(bx + k, y, I.LEATHER); }
        rect(bx - 3, by - 1, 3, 1, I.ARM_SH); rect(bx + 10, by - 1, 4, 1, I.TIMBER); // nozzle, handle
        deco.push({ type: 'bellows', x: bx, y: by }); }
      for (let k = 0; k < 7; k += 1) { set(hx + hw - 2 + Math.round(k * 0.3), hb - 18 + k, I.ARM_SH); set(hx + hw + 1 - Math.round(k * 0.3), hb - 18 + k, I.ARM_SH); } // tongs hung on the hood
      const ax = hx + hw + 4; const ay = floorY(0.35); // the anvil on its stump, before the forge
      rect(ax + 3, ay - 9, 11, 9, I.TIMBER_SH); rect(ax + 3, ay - 9, 11, 1, I.TIMBER_HI); for (let y = ay - 8; y < ay; y += 3) rect(ax + 3, y, 11, 1, I.TIMBER); // the stump
      rect(ax, ay - 15, 17, 4, I.ARM_HI); rect(ax, ay - 15, 17, 1, I.BLADE); rect(ax - 4, ay - 14, 4, 2, I.ARM_HI); set(ax - 5, ay - 14, I.ARM_SH); rect(ax + 4, ay - 11, 9, 2, I.ARM_SH); // the anvil, its horn, its waist
      deco.push({ type: 'anvil', x: ax, y: ay - 15, w: 17, h: 15 });
      { const wx = ax + 6; const wy = Math.round(H * 0.22); // the winch over the anvil: a beam, two meshed wheels, the rope, the hook
        rect(wx - 12, wy - 8, 24, 2, I.TIMBER); rect(wx - 12, wy - 8, 24, 1, I.TIMBER_HI);
        deco.push({ type: 'gear', x: wx - 4, y: wy - 1, r: 4, sp: 0.5 }, { type: 'gear', x: wx + 4, y: wy + 3, r: 3, sp: -0.5 * 4 / 3 });
        for (let y = wy + 6; y < ay - 22; y += 1) set(wx + 4, y, I.LEATHER_SH); set(wx + 3, ay - 22, I.ARM_SH); set(wx + 5, ay - 22, I.ARM_SH); set(wx + 4, ay - 21, I.ARM_SH); }
      const benchMax = 2 * Math.min(S(0.56) - (ax + 20), BR - 32 - S(0.56)); const capM = Math.max(1, Math.floor((benchMax - 10) / 16)); // (between the anvil and Young's stand)
      const tb = table3d(S(0.56), capM * 16 + 10); const cx = Math.round((tb.l + tb.r) / 2); // the bench, its whole length: a place for each model to come
      const shY = tb.back - 21; rect(tb.l - 2, shY, tb.r - tb.l + 4, 2, I.TIMBER_HI); rect(tb.l - 2, shY + 2, tb.r - tb.l + 4, 1, I.TIMBER_SH); // and a shelf over it, as many places again
      [tb.l + 2, tb.r - 3].forEach((x) => { set(x, shY + 3, I.ARM_SH); set(x, shY + 4, I.ARM_SH); set(x + 1, shY + 4, I.ARM_SH); }); // (its brackets)
      reserved.push(box(tb.l - 2, shY - 18, tb.r - tb.l + 4, 23));
      const capAll = 2 * capM; const nAll = n > capAll ? capAll - 1 : n; // (the shelf's last place keeps the crate's, when they are more)
      const placeM = (k) => ({ xc: Math.round(tb.l + (((k % capM) + 0.5) * (tb.r - tb.l)) / capM), yb: k < capM ? tb.front + 2 : shY });
      for (let k = nAll; k < capAll; k += 1) { const { xc, yb } = placeM(k); rect(xc - 5, yb - 1, 11, 1, I.TIMBER_SH); rect(xc - 4, yb - 2, 9, 1, I.TIMBER); plateAt(xc, yb); } // (an empty plinth, its plate)
      late.push(() => archive('crate', things.map((_, i) => i).slice(nAll), 'The crate of earlier models', null, box(tb.l, tb.back - 4, tb.r - tb.l, tb.front - tb.back + 8)));
      things.slice(0, nAll).forEach((t, k) => { const { xc, yb } = placeM(k); slots[k] = mark(() => model(xc, yb, t.model)); }); // (each model at its own size: half a man; the bench first, then the shelf)
      const ry = Math.round(H * 0.12); const ou = realGet('outils'); // Roubo's tools (_tools/fetch_outils.py): over the bench, hung from the rail, the planes on the board's shelf
      { const hung = ou ? ou.sprites.filter((sp) => !sp.on) : []; const stand = ou ? ou.sprites.filter((sp) => sp.on) : [];
        const hw0 = ou ? hung.reduce((a2, sp) => a2 + sp.w + 2, 0) : 7 * 5; const sw0 = stand.reduce((a2, sp) => a2 + sp.w + 2, 0);
        const bw = hw0 + sw0 + 4; const bh = Math.max(16, ...hung.map((sp) => sp.h + 3)); const x0 = cx - Math.round(bw / 2);
        rect(x0 - 1, ry - 1, bw + 2, bh + 2, I.TIMBER_SH); rect(x0, ry, bw, bh, I.PLASTER_HI); // the whitewashed board, so dark iron and wood read on it
        for (let x = x0 + 4; x < x0 + bw - 1; x += 6) rect(x, ry, 1, bh, I.PLASTER); // (its planks)
        rect(x0, ry, hw0 + 1, 1, I.TIMBER_SH); // the rail
        let tx = x0 + 1;
        if (ou) hung.forEach((sp) => { set(tx + Math.floor(sp.w / 2), ry, I.ARM_SH); for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const v = sp.px[y * sp.w + x]; if (v >= 0) set(tx + x, ry + 1 + y, v); } tx += sp.w + 2; });
        else for (let k = 0; k < 7; k += 1) { rect(tx + 2, ry + 1, 1, 6 + (k % 3) * 2, k % 2 ? I.ARM_SH : I.TIMBER); rect(tx + 1, ry + 6 + (k % 3) * 2, 3, 2, I.ARM_HI); tx += 5; }
        const shY = ry + bh - 3; tx += 2; rect(tx - 1, shY, sw0 + 1, 1, I.TIMBER_SH); rect(tx - 1, shY + 1, sw0 + 1, 1, I.TIMBER); // the shelf for the planes
        stand.forEach((sp) => { for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const v = sp.px[y * sp.w + x]; if (v >= 0) set(tx + x, shY - sp.h + y, v); } tx += sp.w + 2; });
        if (ou) extra.push({ t: { kind: 'outils', label: 'The tool rack', get html() { return `<h3>The tool rack</h3><p>${ou.captions.map(escHtml).join('; ')}.</p>${provenance('outils')}`; } }, b: box(x0 - 1, ry - 1, bw + 2, bh + 2) });
        lantern(x0 + bw + 6, ry + 2);
      }
        { // the map of the realm: a region for each project
          const mx0 = BR - 30; const my0 = Math.round(H * 0.18); const mw = 26; const mh = 19; // on the right of the wall
        const models = things.filter((tt) => tt.kind === 'model');
        for (let y = 0; y < mh; y += 1) for (let x = 0; x < mw; x += 1) {
          const edge = x === 0 || y === 0 || x === mw - 1 || y === mh - 1;
          if (edge && (x * 7 + y * 3) % 5 === 0) continue; // a worn edge
          set(mx0 + x, my0 + y, edge ? I.PLASTER : I.PLASTER_HI);
        }
        const TINT = [I.T_GULES, I.T_AZURE, I.T_VERT, I.T_OR, I.T_PRUNE];
        const seeds = models.map((_, k) => [mx0 + Math.round(((k + 0.5) / Math.max(1, models.length)) * mw), my0 + Math.round(mh * (0.35 + 0.3 * (k % 2)))]);
        for (let y = 2; y < mh - 2; y += 1) for (let x = 2; x < mw - 2; x += 1) { // Voronoi regions, their borders dotted
          const X = mx0 + x; const Y = my0 + y; let best = 0; let d1 = 1e9; let d2 = 1e9;
          seeds.forEach(([sx, sy], k) => { const d = (X - sx) ** 2 + ((Y - sy) * 1.6) ** 2; if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d; });
          if (Math.sqrt(d2) - Math.sqrt(d1) < 1.2) { if ((x + y) % 2) set(X, Y, I.TIMBER_SH); } else if ((x * 3 + y * 5) % 4 === 0) set(X, Y, TINT[best % TINT.length]);
        }
        for (let x = 2; x < mw - 2; x += 1) set(mx0 + x, my0 + Math.round(mh * 0.75 + Math.sin(x * 0.4) * 1.5), I.WATER); // a river across it
        seeds.forEach(([sx, sy]) => { set(sx, sy, I.OUTLINE); set(sx, sy - 1, I.FLAG); }); // the capitals
        set(mx0 + mw - 4, my0 + 3, I.OUTLINE); set(mx0 + mw - 4, my0 + 2, I.FLAG); set(mx0 + mw - 5, my0 + 3, I.TIMBER_SH); set(mx0 + mw - 3, my0 + 3, I.TIMBER_SH); set(mx0 + mw - 4, my0 + 4, I.TIMBER_SH); // a compass
        const regions = models.map((m) => { const href = (m.html.match(/href="([^"]+)"/) || [])[1]; return href ? `<a href="${href}">${m.label}</a>` : m.label; });
          extra.push({ t: { kind: 'realm', label: 'The map of the realm', html: cards.realm(regions) }, b: box(mx0, my0, mw, mh) });
        }
        { // Young's slits in a dark box: a faint lamp, a plate with two slits, the screen where hits gather
          const sw = 28; const mh = 15; const bx = BR - 30; const y2 = yf - 30; const ih = mh - 2; const iy = y2 + 1; // on its own stand
          rect(bx + 4, y2 + mh, 2, yf - y2 - mh, I.TIMBER_SH); rect(bx + sw - 6, y2 + mh, 2, yf - y2 - mh, I.TIMBER_SH); rect(bx, y2 + mh, sw, 2, I.TIMBER); // the stand
          rect(bx, y2, sw, mh, I.TIMBER_SH); rect(bx + 1, iy, sw - 2, ih, I.SLATEB);
          rect(bx + 2, iy + Math.round(ih / 2) - 1, 3, 3, I.ARM_SH); set(bx + 3, iy + Math.round(ih / 2), I.WIN_LIT); // the lamp
          for (let y = 0; y < ih; y += 1) if (Math.abs(y - ih / 2) > 2 || Math.abs(y - ih / 2) < 1) set(bx + 12, iy + y, I.ARM_SH); // the plate, two slits in it
          rect(bx + sw - 9, iy, 1, ih, I.TIMBER); rect(bx + sw - 8, iy, 6, ih, I.OUTLINE); // the screen
          deco.push({ type: 'slits', x: bx + sw - 8, y: iy, w: 6, h: ih });
          extra.push({ t: { kind: 'slits', label: "Young's slits", get html() { return cards.slits(); } }, b: box(bx, y2, sw, mh) });
        }
      for (let k = 0; k < 18; k += 1) { const cx2 = tb.l + Math.floor(rng() * (tb.r - tb.l)); const cy2 = floorY(0.05 + rng() * 0.25); set(cx2, cy2, k % 3 ? I.TIMBER_HI : I.BEARD); } // shavings under the bench
    } else if (kind === 'publications') { // the library: each work face out on the display shelf
      // the two bookcases: each shelf a subject (site.toml [library]), each catalogued volume a gilt spine on it
      const CAPP = 4; const pubs = of('book'); const np = pubs.length; const nP = np > CAPP ? CAPP - 1 : np; // (four works face out: the niche's places, the empty ones waiting)
      const half = Math.ceil((CAPP * 13 + 6) / 2) + 3;
      const ez0 = S(0.5) - half; const ez1 = S(0.5) + half; // (the niche of honour, in the middle: the bookcases stop short of it)
      const rx = Math.max(S(0.76), ez1 + 2); const lw0 = Math.min(Sw(0.22), ez0 - 2 - (S(0) + 2));
      const shelfRows = [...shelf(S(0) + 2, 7, Math.max(12, lw0), yf - 7), ...shelf(rx, 7, Math.max(12, BR - rx - 2), yf - 7)];
      const rowOf = {};
      of('shelf').forEach(([t, i], k) => { if (shelfRows[k]) { slots[i] = box(shelfRows[k].x, shelfRows[k].y, shelfRows[k].w, shelfRows[k].h); rowOf[t.shelf] = shelfRows[k]; } });
      const onShelf = {};
      of('volume').forEach(([t, i]) => {
        const sr = rowOf[t.shelf]; if (!sr) return;
        const j = onShelf[t.shelf] = (onShelf[t.shelf] || 0) + 1; const x = sr.x + sr.w - 1 - j * 4;
        if (x < sr.x + 1) return; // a full shelf: the rest are in the catalogue only
        slots[i] = mark(() => { rect(x, sr.y + 1, 3, 7, I.CLOTH_SH); rect(x, sr.y + 2, 3, 1, I.GOLD_HI); rect(x, sr.y + 6, 3, 1, I.GOLD); set(x + 1, sr.y + 4, I.GOLD); return box(x - 1, sr.y, 5, 9); });
      });
      // the shelf of honour: an arched niche in the panelling between the bookcases, the works face out
      // in it, a small lamp over it; under it the window, high (where the ladder's rail leaves it room)
      const nw2 = CAPP * 13 + 6; const nl = S(0.5) - Math.round(nw2 / 2); const nb = yf - 30; const nt = nb - 22;
      for (let y = nt; y < nb; y += 1) for (let x = nl; x < nl + nw2; x += 1) { const u = (x - nl) / (nw2 - 1) * 2 - 1; const arch = y - nt < 6 && (y - nt) < 6 * (1 - Math.sqrt(Math.max(0, 1 - u * u))); if (!arch) set(x, y, x === nl || x === nl + nw2 - 1 ? I.TIMBER_HI : I.OUTLINE); }
      rect(nl - 2, nb, nw2 + 4, 2, I.TIMBER_HI); rect(nl - 2, nb + 2, nw2 + 4, 1, I.TIMBER_SH); // its sill
      places(nl + 3, nl + nw2 - 3, 13).slice(0, CAPP).forEach((xc, k) => { // a work face out on its stand, or the stand empty
        if (k < nP) slots[pubs[k][1]] = mark(() => bookFace(xc, nb, k));
        else { rect(xc - 3, nb - 1, 7, 1, I.TIMBER_HI); for (let y = 2; y < 9; y += 1) set(xc + 1 + Math.floor(y / 4), nb - y, I.TIMBER); plateAt(xc, nb + 1); }
      });
      late.push(() => archive('pile', pubs.slice(nP).map(([, i]) => i), 'Works still to be shelved', null, box(nl - 2, nb, nw2 + 4, 3)));
      lantern(S(0.5), nt - 5);
      windowArch(S(0.5) - 7, 9, 14, Math.max(14, nt - 9 - 10)); // (high, under the ladder's rail at 6, over the lamp)
      { // the game of life: a board of squares on a games table on the rug, two stools; its cells live in drawInterior
        const lw = 22; const lh = 8; const gy = floorY(0.32); const lx = S(0.5) - lw / 2; const ly = gy - 12;
        rug(lx - 16, gy - 1, lw + 32); // the rug under it
        rect(lx - 2, ly - 1, lw + 4, lh + 2, I.TIMBER); rect(lx - 2, ly - 1, lw + 4, 1, I.TIMBER_HI); rect(lx - 2, ly + lh + 1, lw + 4, 2, I.TIMBER_SH); // the table's top, its edge
        [lx, lx + lw - 2].forEach((x) => rect(x, ly + lh + 3, 2, gy - ly - lh - 3, I.TIMBER_SH)); // its legs
        [lx - 9, lx + lw + 3].forEach((x) => { rect(x, gy - 6, 6, 2, I.TIMBER_HI); rect(x + 1, gy - 4, 1, 4, I.TIMBER_SH); rect(x + 4, gy - 4, 1, 4, I.TIMBER_SH); }); // the stools
        deco.push({ type: 'life', x: lx, y: ly, w: lw, h: lh, board: true });
        extra.push({ t: { kind: 'life', label: 'The game of life', get html() { return cards.life(); } }, b: box(lx - 2, ly - 1, lw + 4, lh + 4) });
        const small = shadeSprite(`
.q.q.....
qkqkqqqT.
qqqqqTqqq
.qq..qq.T`); stamp(small, lx + lw + 11, gy - small.h + 2); // a cat at a room's scale (the camp's are drawn for the landscape), asleep by the stool
      }
      { // the library's ladder on its brass rail, slid along the shelves (by the visitor: see ladderTo)
        const a = S(0) + 2; const b = BR - 10; rect(a, 6, b - a + 8, 1, I.GOLD_SH);
        const lx = Math.round(a + (b - a) * ladderF);
        deco.push({ type: 'ladder', a, b, top: 6, foot: yf - 1 });
        extra.push({ t: { kind: 'ladder', label: 'The library ladder', html: "<h3>The library ladder</h3><p>On its brass rail, it slides from one bookcase to the other: drag it (or the arrow keys, once it has the focus) to reach the top shelves.</p>" }, b: box(lx - 1, 6, 10, yf - 6) });
      }
    } else if (kind === 'talks') { // the great hall: a banner on the pole for each talk; the tapestry
      // the schools' hangings along the wall, each on its own rod (one row; spread when there is room)
      const gap = clamp(Math.floor((BR - BL - 6) / Math.max(1, hangs.length)), 21, 24); const tw = hangs.length * gap; const narrow = BR - (tw + S(0.05) + 10) < 72;
      const tx = narrow ? Math.max(BL + 2, Math.round(BL + (BR - BL - tw) / 2)) : S(0.05); const ty = 9;
      // a narrow room: the rose window in the middle of the row, the hangings parted either side of it
      let RR = 10; while (RR > 5 && tw + 2 * RR + 10 > BR - BL - 4) RR -= 1; // smaller when the wall is short
      const G = 2 * RR + 10; let rose = null;
      for (let y = ty - 3; y < ty + 27; y += 1) for (let x = BL + 1; x < BR - 1; x += 1) { // the frieze the shields hang on: dyed cloth between two gilt borders
        const edge = y === ty - 3 || y === ty + 26; const inner = y === ty - 2 || y === ty + 25;
        set(x, y, edge ? I.GOLD_SH : inner ? I.GOLD : (x + y) % 9 === 0 ? I.BANNER_SH : I.BANNER);
      }
      if (narrow && tw + G <= BR - BL - 4) {
        const half = Math.ceil(hangs.length / 2); const x0 = Math.round((BL + BR - tw - G) / 2);
        hangs.forEach((e, k) => hanging(x0 + 12 + k * gap + (k >= half ? G : 0), ty + (k % 2) * 2, e, k));
        rose = [x0 + half * gap + Math.round(G / 2) + 3, ty + 14];
      } else hangs.forEach((e, k) => hanging(tx + 12 + k * gap, ty + (k % 2) * 2, e, k));
      // the council chamber: a round table, high-backed chairs about it, a chandelier over it;
      // each talk a scroll laid at a place (from the far side round to the near), more at the centre
      // the table takes the room right of the tapestry, whole: it never runs off the edges
      // (a narrow room: the table stands in front of the tapestry, which hangs on the wall behind it)
      // the floor shared out, left to right: the bench and the lectern by it, the table and its end
      // chairs, a corner kept for the season's basket (each in its own span: nothing on another)
      const benchW = 34; const lx = BL + 2 + benchW + 3; const right = BR - 21;
      const free0 = Math.max(narrow ? S(0.1) : tx + tw + 10, lx + 9 + 8);
      const rx = Math.max(16, Math.min(32, Math.floor((right - free0 - 7) / 2))); // (two men and a half across)
      const tcx = Math.round(free0 + 7 + rx); const ry = Math.max(6, Math.round(rx * 0.28));
      const tcy = Math.min(yf + 2, H - ry - 14);
      const onEllipse = (ang, k = 1) => [Math.round(tcx + Math.cos(ang) * rx * k), Math.round(tcy + Math.sin(ang) * ry * k)];
      const far = [-0.78, -0.5, -0.22].map((f) => f * Math.PI); // the places behind the table
      const hangLow = ty + 27; // (the hangings' fringes: the backs stop short of them, and of the clock)
      const clockR = 9; const clockX = rose ? rose[0] : Math.round((BL + BR) / 2); const clockY = hangLow + clockR + 4; // (under the rose, on the axis of the wall)
      far.forEach((ang) => { // a high back rising behind the table's far edge (the table hides the seat)
        const [x, y] = onEllipse(ang, 1); const low = x + 4 >= clockX - clockR - 2 ? Math.max(hangLow, clockY + clockR + 1) : hangLow;
        const bh = Math.max(5, Math.min(18, y - low - 2)); // (a high back, to the shoulder)
        rect(x - 3, y - bh, 7, bh + 1, I.TIMBER); rect(x - 3, y - bh, 7, 1, I.TIMBER_HI); rect(x - 3, y - bh, 1, bh + 1, I.TIMBER_HI);
        set(x, y - bh - 1, I.GOLD); rect(x - 1, y - bh + 3, 3, 4, I.CLOTH);
      });
      for (let y = -ry; y <= ry; y += 1) { // the top, an ellipse seen from a little above
        const half = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2));
        for (let x = -half; x <= half; x += 1) set(tcx + x, tcy + y, y === -ry || Math.abs(x) === half ? I.TIMBER_HI : ((x * 3 + y * 5) % 13 === 0 ? I.TIMBER_SH : I.TIMBER));
      }
      for (let x = -rx + 1; x < rx; x += 1) { const yy = tcy + Math.round(ry * Math.sqrt(1 - (x / rx) ** 2)); rect(tcx + x, yy + 1, 1, 3, I.TIMBER_SH); } // its edge
      rect(tcx - 3, tcy + ry + 4, 7, Math.max(2, floorY(0.85) - tcy - ry - 4), I.TIMBER_SH); rect(tcx - 8, floorY(0.85) - 1, 17, 2, I.TIMBER_SH); // the pedestal
      [Math.PI, 0].forEach((ang) => { // the two ends: chairs seen from the side, against the table
        const x = Math.round(tcx + Math.cos(ang) * (rx + 3)); const dir = Math.cos(ang) > 0 ? 1 : -1;
        rect(x + dir * 2, tcy - 17, 2, 23, I.TIMBER); set(x + dir * 2, tcy - 18, I.GOLD); // the back
        rect(x - 2, tcy + 2, 6, 2, I.TIMBER_HI); rect(x - 2, tcy + 4, 1, 6, I.TIMBER_SH); rect(x + 3, tcy + 4, 1, 6, I.TIMBER_SH); // seat, legs
      });
      for (let a2 = 0; a2 < 6.28; a2 += 0.35) set(tcx + Math.round(Math.cos(a2) * rx * 0.25), tcy + Math.round(Math.sin(a2) * ry * 0.25), I.GOLD_SH); // a carved rose
      rect(tcx, tcy - 3, 1, 3, I.GOLD_SH); rect(tcx - 3, tcy - 3, 7, 1, I.GOLD); // the candelabrum
      [-3, 0, 3].forEach((dx) => candle(tcx + dx, tcy - 4, false));
      lights.splice(-2, 2); // (the three flames light as one: three lights stacked burnt an orange patch on the wall)
      [[-0.6, -0.3], [0.55, -0.2], [0.15, 0.45]].forEach(([fx, fy]) => { const gx = tcx + Math.round(fx * rx); const gy = tcy + Math.round(fy * ry); rect(gx, gy - 3, 2, 2, I.GOLD); set(gx, gy - 1, I.GOLD_SH); set(gx + 1, gy - 1, I.GOLD_SH); }); // goblets
      { // a board of merels on the table, three squares one in another (its game: ui/10-play.js)
        const bx = tcx - Math.round(rx * 0.45); const by = tcy + Math.round(ry * 0.15); rect(bx - 1, by - 1, 13, 7, I.TIMBER_SH); rect(bx, by, 11, 5, I.PLASTER_HI);
        [[0, 0, 11, 5], [2, 1, 7, 3], [4, 2, 3, 1]].forEach(([x0, y0, w, h]) => { for (let k = 0; k < w; k += 1) { set(bx + x0 + k, by + y0, I.TIMBER_SH); set(bx + x0 + k, by + y0 + h - 1, I.TIMBER_SH); } for (let k = 0; k < h; k += 1) { set(bx + x0, by + y0 + k, I.TIMBER_SH); set(bx + x0 + w - 1, by + y0 + k, I.TIMBER_SH); } });
        set(bx + 1, by, I.T_GULES); set(bx + 9, by + 4, I.FL_WHITE); set(bx + 5, by + 1, I.T_GULES); // (a few men on it)
        extra.push({ t: { kind: 'merels', label: 'A game of merels', html: '<h3>A game of merels</h3><p>Nine men each. Place them, then move them along the lines; three in a row is a mill and takes a man of the other side. Down to three men, you may fly; down to two, you have lost.</p><div class="play"></div>' }, b: box(bx - 2, by - 2, 15, 9) });
      }
      set(tcx + Math.round(rx * 0.45), tcy + 1, I.OUTLINE); set(tcx + Math.round(rx * 0.45) + 1, tcy, I.PLASTER_HI); // the quill in its pot
      // the talks: a scroll at each place, far side first, then the ends, then the near side; the rest at the centre
      const places = [...far, -0.92 * Math.PI, -0.08 * Math.PI, 0.75 * Math.PI, 0.25 * Math.PI];
      const nT = shown(places.length);
      things.slice(0, nT).forEach((_t, k) => { const [x, y] = onEllipse(places[k], 0.72); slots[k] = mark(() => scrollThing(x, y + 2, null)); });
      late.push(() => archive('basket', things.map((_, i) => i).slice(nT), 'The basket of earlier talks', null, box(tcx - rx, tcy - ry, 2 * rx, 2 * ry)));
      [0.72, 0.28].map((f) => f * Math.PI).forEach((ang) => { // the near chairs: their backs, seen from behind, against the near edge
        const [x, y] = onEllipse(ang, 1);
        rect(x - 4, y - 9, 9, 15, I.TIMBER_SH); rect(x - 4, y - 9, 9, 1, I.TIMBER);
        for (let k = 1; k < 8; k += 2) rect(x - 4 + k, y - 7, 1, 11, I.TIMBER);
        rect(x - 4, y + 6, 1, Math.max(1, floorY(0.95) - y - 6), I.TIMBER_SH); rect(x + 4, y + 6, 1, Math.max(1, floorY(0.95) - y - 6), I.TIMBER_SH);
      });
      { // the rose window: over the table, left of the chandelier's chain; under the hangings in a narrow room
        // (else sized to the wall left between the hangings, or the beams, and the chairs' high backs)
        const top = narrow ? ty + 32 : Math.round(H * 0.16); const bottom = tcy - ry - 15;
        const R = Math.min(11, Math.floor((bottom - top) / 2) - 2);
        if (rose) roseWindow(rose[0], rose[1], RR);
        else if (R >= 5) roseWindow(narrow ? Math.round((BL + BR) / 2) : Math.round(tcx - rx * 0.5), Math.round((top + bottom) / 2), R);
      }
      if (!narrow) chandelier(tcx, Math.max(Math.round(H * 0.3), tcy - ry - 26)); // low over the table, clear of the menu's beam
      if (cinemaOn()) { // the lantern show: a sheet hung over the middle of the wall, the magic lantern on the table
        const fm = realGet('melies'); const sw = 58; const sh = 44; const sx = Math.round((BL + BR - sw) / 2); const sy = ty + 1;
        rect(sx - 2, sy - 2, sw + 4, sh + 4, I.PLASTER_HI); rect(sx - 3, sy - 3, sw + 6, 1, I.TIMBER_SH); set(sx - 4, sy - 3, I.GOLD); set(sx + sw + 3, sy - 3, I.GOLD); // the sheet on its pole
        rect(tcx - 3, tcy - 9, 7, 5, I.ARM_SH); rect(tcx + 3, tcy - 8, 2, 3, I.GOLD_SH); set(tcx, tcy - 10, I.ARM); // the lantern, its lens towards the sheet
        if (fm) {
          deco.push({ type: 'cinema', x: sx, y: sy, w: sw, h: sh, lx: tcx, ly: tcy - 7 });
          extra.push({ t: { kind: 'cinema', label: 'The magic lantern show', get html() { return `<h3>Le Voyage dans la Lune</h3><p>Méliès, 1902: astronomers fired to the Moon from a cannon, the rocket in its eye. Shown in the great hall on Saturday evenings.</p>${provenance('melies')}`; } }, b: box(sx - 2, sy - 2, sw + 4, sh + 4) });
        }
      }
      const lcN = realGet('licorne'); const benchTop = yf - 1 - 24; // (the bench sprite is 24 high)
      if (!lcN || ty + 25 + (lcN.h >> 1) + 2 < benchTop) mobilier(0, BL + 2, yf - 1); // the bench with dragons' heads, along the wall under the tapestry (when the tapestry clears it)
      const lc = realGet('licorne'); // La Dame à la licorne, the tapestry of this visit's sense, under the schools' hangings
      if (lc) {
        const k = senseNow(); const x0 = BL + 4; const y0 = ty + 25;
        const sm = { w: lc.w >> 1, h: lc.h >> 1 }; const big = lc.frameIdx[k]; // half the card's size, each stitch the commonest colour of its 2 x 2 (sharper than the small copy)
        const px = (x, y) => { const q = [big[2 * y * lc.w + 2 * x], big[2 * y * lc.w + 2 * x + 1], big[(2 * y + 1) * lc.w + 2 * x], big[(2 * y + 1) * lc.w + 2 * x + 1]];
          return q.reduce((b, c) => (q.filter((v) => v === c).length > q.filter((v) => v === b).length ? c : b), q[0]); };
        rect(x0 - 2, y0 - 1, sm.w + 4, 1, I.TIMBER_SH); set(x0 - 3, y0 - 1, I.GOLD); set(x0 + sm.w + 2, y0 - 1, I.GOLD); // its rod and finials
        for (let y = 0; y < sm.h; y += 1) for (let x = 0; x < sm.w; x += 1) { const c = px(x, y); if (c >= 0) set(x0 + x, y0 + y, c); }
        for (let x = 0; x < sm.w; x += 2) set(x0 + x, y0 + sm.h, I.GOLD_SH); // the fringe
        extra.push({ t: { kind: 'licorne', label: 'The tapestry of the lady and the unicorn', get html() { return cards.licorne(); } }, b: box(x0 - 3, y0 - 2, sm.w + 6, sm.h + 4) });
      }
      { // the speaker's pulpit, by the bench, facing the table: a panelled box on a step, a sloped desk, a sheet on it
        const px0 = lx - 2; const pw = 13; const pt = yf - 22;
        rect(px0 - 2, yf - 3, pw + 4, 3, I.ROCK); rect(px0 - 2, yf - 3, pw + 4, 1, I.ROCK_HI); // the step
        rect(px0, pt, pw, yf - 3 - pt, I.TIMBER); rect(px0, pt, pw, 1, I.TIMBER_HI); rect(px0 + pw - 1, pt, 1, yf - 3 - pt, I.TIMBER_SH);
        rect(px0 + 2, pt + 4, pw - 4, yf - 3 - pt - 7, I.TIMBER_SH); rect(px0 + 3, pt + 5, pw - 6, yf - 3 - pt - 9, I.TIMBER); // its panel
        for (let k = 0; k < pw + 2; k += 1) set(px0 - 1 + k, pt - 1 - Math.floor(k / 5), I.TIMBER_HI); // the sloped desk
        rect(px0 + 3, pt - 4, 6, 2, I.BEARD_HI); // a sheet on it
      }
      { // the astronomical clock on the east pillar: a 24-hour dial, the sun's sign, the moon's phase
        const cx = clockX; const R = clockR; const cy = clockY; // (under the hangings' fringes: above)
        for (let y = -R - 1; y <= R + 1; y += 1) for (let x = -R - 1; x <= R + 1; x += 1) { const q = Math.hypot(x, y); if (q <= R + 1) set(cx + x, cy + y, q > R ? I.GOLD_SH : I.T_NAVY); }
        deco.push({ type: 'astroclock', x: cx, y: cy, r: R });
        extra.push({ t: { kind: 'astroclock', label: 'The astronomical clock', get html() { return cards.astroclock(); } }, b: box(cx - R - 1, cy - R - 1, 2 * R + 3, 2 * R + 3) });
      }
      (narrow ? [] : [S(0.95), S(0.86)]).forEach((bx) => { // the council's two banners on the end wall
        const by = Math.round(H * 0.24);
        for (let r = 0; r < 16; r += 1) for (let c = 0; c < 5; c += 1) { if (r === 15 && c === 2) continue; set(bx + c, by + r, c === 2 ? I.T_OR : c === 4 ? I.BANNER_SH : I.BANNER); }
        rect(bx - 1, by - 1, 7, 1, I.TIMBER_SH);
      });
    } else if (kind === 'teaching') { // the schoolroom: each course a line of chalk on the board
      const ptS = realGet('portraits'); const pm = ptS ? ptS.small.w + 9 : 4; // (the portraits hang either side: the board leaves them the wall)
      const bl = Math.max(S(0.16), BL + pm); const br = Math.min(S(0.84), BR - pm); const bt = Math.round(H * 0.2); const CAPC = 4; const nC = shown(CAPC); const bb = Math.min(Math.round(H * 0.6), bt + CAPC * 7 + 40); // (four lines kept for the courses, the equations under them; as tall as its chalk: ~1.2 m; the lines it cannot hold go in the register)
      const ptLow = ptS ? bt + 2 * ptS.small.h + 9 : 0; // (the portraits' foot: the Galton board and the globe under it)
      for (let y = bt - 3; y < bb + 3; y += 1) for (let x = bl - 3; x < br + 3; x += 1) {
        const fr = x < bl || x >= br || y < bt || y >= bb;
        set(x, y, fr ? ((x === bl - 3 || y === bt - 3) ? I.TIMBER_HI : I.TIMBER) : (noise2(x, y) > 0.62 ? I.SLATEB_HI : I.SLATEB));
      }
      rect(bl - 3, bb + 3, br - bl + 6, 2, I.TIMBER_HI); set(bl + 4, bb + 2, I.FL_WHITE); set(bl + 5, bb + 2, I.FL_WHITE); set(br - 8, bb + 2, I.FL_YEL);
      board = { l: bl, r: br, t: bt, b: bb }; // (where chalk takes: the chalk mode)
      extra.push({ t: { kind: 'chalk', label: 'The chalk', act: () => chalkMode(!chalk.on) }, b: box(bl + 2, bb + 1, 6, 3) });
      things.slice(0, nC).forEach((_t, k) => { // a line of chalk, then a little sketch at its end
        const y = bt + 5 + k * 7; let x = bl + 4;
        while (x < br - 10) { const w = 2 + ((x * 7 + k) % 4); for (let c = 0; c < w; c += 1) set(x + c, y + ((c + k) % 3 === 0 ? -1 : 0), I.FL_WHITE); x += w + 2; }
        slots[k] = box(bl + 2, y - 3, br - bl - 4, 6);
      });
      for (let k = nC; k < CAPC; k += 1) { const y = bt + 5 + k * 7; for (let x = bl + 4; x < br - 10; x += 3) set(x, y, I.STONE_SH); set(bl + 2, y, I.FL_WHITE); } // (a ruled line waiting, a dot of chalk at its head)
      const pt = realGet('portraits'); // over the board, the four whose equations it keeps (_tools/fetch_portraits.py)
      if (pt) {
        const sm = pt.small; // two either side of the board, beside its lines (over it, the menu would hide them)
        const xs = [0, 1, 2, 3].map((k) => (k < 2 ? bl - 7 - sm.w : br + 6)); const ys = [0, 1, 2, 3].map((k) => bt + 2 + (k % 2) * (sm.h + 5));
        xs.forEach((x, k) => { const py = ys[k];
          rect(x - 1, py - 1, sm.w + 2, sm.h + 2, I.GOLD_SH); set(x - 1, py - 1, I.GOLD); set(x + sm.w, py + sm.h, I.GOLD); // the frame
          for (let y = 0; y < sm.h; y += 1) for (let xx = 0; xx < sm.w; xx += 1) set(x + xx, py + y, sm.frameIdx[k][y * sm.w + xx]);
          const c = pt.captions[k];
          extra.push({ t: { kind: 'portrait', label: `A portrait: ${c.name}`, get html() { return `<h3>${escHtml(c.name)}</h3>${figHtml('portraits', k, 4)}<p class="dim">Hung beside the board, by the line that is his.</p>${provenance('portraits', k)}`; } }, b: box(x - 1, py - 1, sm.w + 2, sm.h + 2) });
        });
        deco.push({ type: 'portraits', xs, ys, w: sm.w, h: sm.h });
      }
      // under the courses, the board's standing equations, in chalk: Schrödinger, diffusion,
      // the partition function, Hamilton-Jacobi-Bellman (the M1, the projects, the masters)
      let ey = bt + 4 + CAPC * 7;
      CHALK.forEach((line) => {
        const w = [...line].reduce((a, ch) => a + (GLYPHS[ch] ? GLYPHS[ch][0].length + 1 : 2), 0);
        if (ey + 5 > bb - 2 || w > br - bl - 4) return; // what does not fit the board is not written
        let ex = Math.round(bl + (br - bl - w) / 2);
        [...line].forEach((ch) => { const g = GLYPHS[ch]; if (g) g.forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '1') set(ex + rx, ey + ry, (ex + ey + rx) % 7 ? I.FL_WHITE : I.PLASTER); })); ex += g ? g[0].length + 1 : 2; });
        ey += 8;
      });
      let galtonOnDesk = false;
      { // a Galton board on the wall over the master's desk: pegs in a triangle, bins below
        // (under the right-hand portraits and over the desk: the bins shorten when the wall is low)
        const gw = 17; const dx0 = S(0.86); const gx0 = Math.round(dx0 + (Math.max(10, BR - dx0 - 2) - gw) / 2);
        // (on the wall under the portraits; else standing on the master's desk, where the globe was)
        let gy0 = Math.max(yf - 54, ptLow + 2); let bh = Math.min(15, yf - 22 - (gy0 + 21)); galtonOnDesk = bh < 8;
        if (galtonOnDesk) { bh = 8; gy0 = yf - 13 - 21 - bh; }
        if (gx0 > br + 4 && gx0 + gw < BR - 1) {
          rect(gx0 - 1, gy0 - 1, gw + 2, bh + 21, I.TIMBER); rect(gx0, gy0, gw, bh + 19, I.PLASTER_HI);
          for (let r = 0; r < 7; r += 1) for (let k = 0; k <= r; k += 1) set(gx0 + 8 - r + 2 * k, gy0 + 3 + r * 2, I.ARM_SH); // the pegs
          for (let k = 0; k <= 8; k += 1) rect(gx0 + 2 * k, gy0 + 19, 1, bh, I.TIMBER_SH); // the bins' walls
          set(gx0 + 8, gy0 - 3, I.ARM_SH); set(gx0 + 7, gy0 - 2, I.ARM_SH); set(gx0 + 9, gy0 - 2, I.ARM_SH); // its nail and cord
          deco.push({ type: 'galton', x: gx0, y: gy0, bh });
          extra.push({ t: { kind: 'galton', label: 'The Galton board', get html() { return cards.galton(); } }, b: box(gx0 - 1, gy0 - 1, gw + 2, bh + 21) });
        }
      }
      const dx = S(0.86); const dw = Math.max(10, BR - dx - 2); desk(dx, yf - 13, dw); candle(dx + dw - 3, yf - 14, true);
      if (SEASON(today().getMonth()) === 'autumn') { set(dx + 3, yf - 15, I.CAP); set(dx + 4, yf - 15, I.CAP_SH); set(dx + 3, yf - 16, I.CAP); set(dx + 3, yf - 17, I.FERN_SH); } // an apple for the master
      if (n > nC) { openBook(dx + 2, yf - 13, 11); archive('', things.map((_, i) => i).slice(nC), 'The register of courses', box(dx + 1, yf - 19, 13, 7)); } // (the courses the board cannot hold)
      else { for (let k = 0; k < 5; k += 1) set(dx + 3 + k * 2, yf - 15, k % 2 ? I.CAP : I.GOLD); rect(dx + 2, yf - 16, 11, 1, I.TIMBER_SH); }
      // the class: two rows, each a long desk, the pupils on their chairs before it (we see their
      // backs: they face the board); the master at the board's left, his staff on the equations
      { const ms = SPRITES.master; const xa = bl - ms.w + 4; const xb = Math.round(bl + (br - bl) * 0.55); // the master's dais along the board (before the class: they sit in front of it)
        rect(xa - 3, yf - 3, xb - xa + ms.w + 6, 4, I.TIMBER); rect(xa - 3, yf - 3, xb - xa + ms.w + 6, 1, I.TIMBER_HI); rect(xa - 3, yf + 1, xb - xa + ms.w + 6, 1, I.TIMBER_SH); }
      const rowAt = [yf + 7, Math.min(H - 2, yf + 16)];
      let pk = 0; const heads = []; frontOn = true;
      rowAt.forEach((fy, row) => {
        const l = bl - 4 - row * 5; const r = Math.min(row ? br + 2 : br - 4, S(0.86) - 3); /* (short of the master's desk) */ const seats = Math.max(2, Math.floor((r - l) / 19));
        const dt = fy - 11; // the desks' tops, beyond the pupils: each pupil his own desk, a gap between
        for (let k = 0; k < seats; k += 1) {
          const xc = Math.round(l + ((k + 0.5) * (r - l)) / seats); const dl = xc - 8; const dwk = 16;
          rect(dl, dt, dwk, 1, I.TIMBER_HI); rect(dl, dt + 1, dwk, 2, I.TIMBER); rect(dl, dt + 3, dwk, 1, I.TIMBER_SH); set(dl, dt, I.OUTLINE); set(dl + dwk - 1, dt, I.OUTLINE);
          rect(dl + 1, dt + 4, 1, 6, I.OUTLINE); rect(dl + dwk - 2, dt + 4, 1, 6, I.OUTLINE); // its legs
          rect(xc + 5, dt - 1, 5, 1, I.SLATEB); rect(xc + 5, dt - 2, 5, 1, I.TIMBER); // a slate on the desk, an inkpot
          set(xc - 8, dt - 1, I.OUTLINE); set(xc - 8, dt - 2, I.ARM_SH);
          const sp = pupil(pk); const asleep = pk === 2; const hand = pk === 4; pk += 1;
          const py = fy - 5 - sp.h + 2 + (asleep ? 3 : 0); // (asleep: his head down on his arms)
          stamp(sp, xc - 4, py); heads.push({ x: xc - 4 + (sp.w >> 1), y: py, row, w: sp.w, h: sp.h });
          if (asleep) { rect(xc - 4, py + 3, sp.w, 1, I.SKIN_SH); deco.push({ type: 'zzz', x: xc + 3, y: py - 2 }); } // his arms on the desk; his z's (drawInterior)
          if (hand) { rect(xc + 3, py - 7, 1, 8, I.SKIN); rect(xc + 2, py - 9, 3, 2, I.SKIN); } // a hand up: he knows
          // the chair's back, between us and the pupil: posts, top rail, a slat; the seat's edge below
          rect(xc - 6, fy - 11, 2, 11, I.TIMBER_SH); rect(xc + 4, fy - 11, 2, 11, I.TIMBER_SH); set(xc - 6, fy - 11, I.TIMBER_HI);
          rect(xc - 6, fy - 11, 12, 2, I.TIMBER); rect(xc - 6, fy - 11, 12, 1, I.TIMBER_HI); rect(xc - 4, fy - 7, 8, 1, I.TIMBER);
          rect(xc - 6, fy - 4, 12, 1, I.TIMBER_SH); rect(xc - 6, fy - 1, 1, 1, I.OUTLINE); rect(xc + 5, fy - 1, 1, 1, I.OUTLINE);
        }
      });
      frontOn = false;
      { // the master walks along the board, stops to point at a line, turns round now and then (see drawInterior)
        const ms = SPRITES.master; const xa = bl - ms.w + 4; const xb = Math.round(bl + (br - bl) * 0.55);
        deco.push({ type: 'master', xa, xb, yb: yf - 3, top: bt, rows: Math.max(1, Math.floor((ey - bt - 4) / 7)) });
        deco.push({ type: 'chatter', heads });
      }
      if (!galtonOnDesk && ptLow < yf - 24) { const gx0 = dx + Math.round(dw / 2); const gy = yf - 19; // a globe on the master's desk
        for (let y = -3; y <= 3; y += 1) for (let x = -3; x <= 3; x += 1) if (x * x + y * y <= 10) set(gx0 + x, gy + y, (x + y * 2) % 4 === 0 ? I.FERN : I.WATER);
        rect(gx0, gy + 4, 1, 2, I.GOLD_SH); rect(gx0 - 2, gy + 5, 5, 1, I.GOLD); set(gx0 - 4, gy, I.GOLD_SH); set(gx0 + 4, gy, I.GOLD_SH); }
      [[2, I.CLOTH], [1, I.ROBE], [3, I.FERN_SH]].forEach(([w, c], k) => rect(dx + 2, yf + 2 - k * 2, 4 + w, 2, c)); // books stacked under the master's desk
      rect(bl + 3, bb + 2, 4, 1, I.CLOTH_SH); // the duster on the ledge
    } else if (kind === 'news') { // the rookery: the ravens' pigeonholes in the left wall, the window they
      // come and go by, the cork with each piece of news pinned on it (sized to them), the newest under a
      // lamp; an iron-bound chest under it, its lid ajar, letters showing
      const nw = 22; const wx0 = S(0.42) - Math.round(nw / 2); windowArch(wx0, winY(38), nw, 38); // where they come and go
      const rv = SPRITES.raven; const ph0 = Math.round(H * 0.16); // the pigeonholes: three rows of arched niches, a perch under each row
      const nx0 = S(0.02); const cols = 3; const cw2 = rv.w + 5; const rh2 = rv.h + 6;
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < cols; c += 1) {
        const x0 = nx0 + c * cw2; const y0 = ph0 + r * rh2;
        for (let y = 0; y < rh2 - 3; y += 1) for (let x = 0; x < cw2 - 2; x += 1) { const u = (x / (cw2 - 3)) * 2 - 1; const arch = y < 3 && y < 3 * (1 - Math.sqrt(Math.max(0, 1 - u * u))); if (!arch) set(x0 + x, y0 + y, x === 0 || y === 0 ? I.TIMBER_SH : I.OUTLINE); }
        if (c === 0) rect(nx0 - 2, y0 + rh2 - 3, cols * cw2, 2, I.TIMBER); // the perch along the row
        if ((r * 2 + c) % 3 !== 1) deco.push({ type: 'raven', x: x0 + 1, y: y0 + rh2 - 3 - rv.h + 1, ph: rng() * 20 }); // a raven home, or out
      }
      const fit = 4; const rows2 = 2; const nN = shown(fit * rows2); // the cork, eight places (the older letters go in the chest)
      const cl = wx0 + nw + 10; const cr = cl + fit * 15 + 6; const ct = winY(38) - 2; const cb = ct + rows2 * 13 + 6;
      for (let y = ct - 2; y < cb + 2; y += 1) for (let x = cl - 2; x < cr + 2; x += 1) {
        const fr = x < cl || x >= cr || y < ct || y >= cb;
        set(x, y, fr ? I.TIMBER_SH : (x * 7 + y * 3) % 5 === 0 ? I.CORK_SH : I.CORK);
      }
      things.slice(0, nN).forEach((_t, k) => { slots[k] = mark(() => letterThing(cl + 9 + (k % fit) * 15, ct + 4 + Math.floor(k / fit) * 13, k)); });
      reserved.push(box(cl - 2, ct - 2, cr - cl + 4, cb - ct + 4));
      for (let k = nN; k < fit * rows2; k += 1) { const xc = cl + 9 + (k % fit) * 15; const y = ct + 4 + Math.floor(k / fit) * 13; set(xc, y - 1, I.GOLD); set(xc, y, I.ARM_SH); set(xc + 1, y, I.CORK_SH); } // (a pin waiting)
      lantern(cl + 9, ct - 6); // (over the newest)
      { // the chest under the board: iron bands, the lid ajar on its hinges, letters at the gap
        const kx = cl + 4; const kw = 26; const ky = yf - 14; // (a chest, not a table: as deep as it is high, on the floor)
        rect(kx, ky, kw, 14, I.LEATHER); for (let y = ky + 2; y < ky + 14; y += 3) rect(kx, y, kw, 1, I.LEATHER_SH); rect(kx, ky + 13, kw, 1, I.OUTLINE); // its planks
        [2, Math.round(kw / 2) - 1, kw - 4].forEach((dx) => { rect(kx + dx, ky, 2, 14, I.ARM_SH); set(kx + dx, ky + 3, I.ARM_HI); set(kx + dx, ky + 9, I.ARM_HI); }); // iron bands, their rivets
        rect(kx + Math.round(kw / 2) - 2, ky + 4, 4, 4, I.GOLD_SH); set(kx + Math.round(kw / 2) - 1, ky + 5, I.OUTLINE); // the lock
        for (let k = -1; k <= kw; k += 1) { const ly = ky - 5 - Math.round((k / kw) * 3); rect(kx + k, ly, 1, 3, k % 6 === 2 ? I.ARM_SH : I.LEATHER); set(kx + k, ly, I.TIMBER_HI); } // the lid, lifted on its hinges
        rect(kx, ky - 2, kw, 2, I.OUTLINE); // the dark gap
        archive('', things.map((_, i) => i).slice(nN), 'The chest of older letters', box(kx - 1, ky - 9, kw + 2, 24));
        [[4, 0], [10, 1], [17, 0]].forEach(([dx, dy]) => rect(kx + dx, ky - 3 - dy, 5, 3, I.BEARD_HI)); // the letters showing
      }
      for (let k = 0; k < 7; k += 1) set(S(0.1) + Math.floor(rng() * S(0.8)), floorY(0.2 + rng() * 0.6), I.BEARD_SH); // feathers
      { // the feeder: a wooden trough of grain on the floor; a click brings the ravens down to it
        const fx = S(0.3); const fy = floorY(0.45); rect(fx - 6, fy - 2, 13, 2, I.TIMBER); rect(fx - 6, fy - 3, 13, 1, I.TIMBER_HI); for (let k = -5; k <= 5; k += 2) set(fx + k, fy - 4, I.WHEAT);
        deco.push({ type: 'feeder', x: fx, y: fy - 4 });
        extra.push({ t: { kind: 'feeder', label: 'The ravens\' feeder', act: () => feedRavens() }, b: box(fx - 7, fy - 6, 15, 7) });
      }
    } else if (kind === 'maproom') { // the map room: the realm engraved large on the back wall (as drawRealm), a pennant for each place
      const mx0 = S(0.08); const mx1 = S(0.92); const my0 = 14; const my1 = yf - 34; const Wm = mx1 - mx0; const Hm = my1 - my0;
      rect(mx0 - 3, my0 - 3, Wm + 6, Hm + 6, I.TIMBER); rect(mx0 - 3, my0 - 3, Wm + 6, 1, I.TIMBER_HI); rect(mx0 - 3, my1 + 2, Wm + 6, 1, I.TIMBER_SH); // its frame
      const P = (lon, lat) => [mx0 + Math.round(((lon - 2.22) / 0.25) * Wm), my0 + Math.round(((48.905 - lat) / 0.09) * Hm)];
      for (let y = my0; y < my1; y += 1) for (let x = mx0; x < mx1; x += 1) set(x, y, (x * 7 + y * 13) % 29 === 0 ? I.BEARD : I.BEARD_HI); // the vellum, its grain
      const blob = (lon, lat, rx, ry) => { const [cx, cy] = P(lon, lat); for (let y = -ry; y <= ry; y += 1) for (let x = -rx; x <= rx; x += 1) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1 && (x + y) % 3) set(cx + x, cy + y, I.FERN); };
      blob(2.25, 48.862, Math.round(Wm * 0.04), Math.round(Hm * 0.1)); blob(2.435, 48.835, Math.round(Wm * 0.05), Math.round(Hm * 0.07)); // the woods of Boulogne and Vincennes
      for (let a = 0; a < 6.283; a += 0.02) { const [x, y] = P(2.345 + Math.cos(a) * 0.105, 48.858 + Math.sin(a) * 0.038); if (Math.floor(a * 60) % 2) set(x, y, I.WALL_SH); } // the old walls' ring
      const SEINE2 = [[2.47, 48.815], [2.41, 48.83], [2.37, 48.845], [2.35, 48.853], [2.33, 48.86], [2.30, 48.862], [2.29, 48.857], [2.27, 48.849], [2.255, 48.838], [2.243, 48.832], [2.236, 48.845], [2.248, 48.868], [2.258, 48.889], [2.23, 48.905]];
      for (let k = 1; k < SEINE2.length; k += 1) { const [x0, y0] = P(...SEINE2[k - 1]); const [x1, y1] = P(...SEINE2[k]); const m = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let j = 0; j <= m; j += 1) { const x = Math.round(x0 + ((x1 - x0) * j) / m); const y = Math.round(y0 + ((y1 - y0) * j) / m); set(x, y, I.WATER); set(x, y + 1, I.WATER); } }
      { const [ix, iy] = P(2.347, 48.8545); rect(ix - 2, iy, 5, 1, I.PATH); set(ix, iy - 1, I.ROOF); } // the Île de la Cité
      for (let k = 0; k < 9; k += 1) { const a = (k / 8) * Math.PI * 2; set(mx1 - 7 + Math.round(Math.cos(a) * 4), my0 + 6 + Math.round(Math.sin(a) * 4), I.GOLD_SH); } set(mx1 - 7, my0 + 1, I.CLOTH); set(mx1 - 7, my0 + 6, I.GOLD); // a compass rose
      things.forEach((t, k) => { // a pennant in the place's field colour (those of Orsay at the map's foot, off its edge)
        const at = REALM[t.arms]; if (!at) return;
        const [px0, py0] = P(...at); const x = clamp(px0, mx0 + 3, mx1 - 7); const y = clamp(py0 + (k % 2) * 3, my0 + 8, my1 - 2);
        rect(x, y - 8, 1, 9, I.OUTLINE); rect(x + 1, y - 8, 4, 3, fieldOf(t.arms)); rect(x + 1, y - 5, 2, 1, fieldOf(t.arms)); set(x + 1, y - 8, I.GOLD_HI); rect(x - 1, y + 1, 3, 1, I.OUTLINE);
        slots[k] = box(x - 2, y - 9, 8, 12);
      });
      const tb = table3d(S(0.5), Sw(0.34)); // the chart table: dividers, a rolled map, a candle
      rect(tb.l + 4, tb.back, 10, 2, I.BEARD_HI); set(tb.l + 4, tb.back, I.BEARD); // a rolled map
      for (let k = 0; k < 5; k += 1) { set(tb.r - 12 + k, tb.back + 1 + Math.floor(k / 2), I.ARM_HI); set(tb.r - 12 + k, tb.back + 3 - Math.floor(k / 2), I.ARM_HI); } // the dividers
      candle(Math.round((tb.l + tb.r) / 2), tb.back + 1, false);
      chainLamp(S(0.2), 8); chainLamp(S(0.8), 8);
    } else if (kind === 'cellar') { // the cellar: a rack for each year of study, casks, the steps on down
      { // a barrel vault: above the back wall's arch, its curved courses going dark into the corners
        const yA = (x) => Math.round(H * 0.34 * (1 - Math.sqrt(Math.max(0, 1 - ((x - W / 2) / (W / 2)) ** 2))));
        for (let x = 0; x < W; x += 1) {
          for (let y = 0; y < yA(x); y += 1) {
            const course = Math.floor((x - W / 2) / 7 + (y / (yA(x) + 1)) * 2);
            set(x, y, (x * 3 + y * 5) % 23 === 0 || Math.abs(((x - W / 2) / 7) % 1) < 0.12 ? I.ROCK_DK : course % 2 ? I.ROCK_SH : I.ROCK);
          }
          set(x, yA(x), I.ROCK_DK);
        }
      }
      const bottle = (x, y, k) => { rect(x, y, 2, 2, (k * 7) % 5 ? I.PINE_SH : I.FG_PINE_SH); set(x, y, I.PINE_HI); };
      const racks = of('vintage'); const rl = S(0.02); const rr = S(0.62);
      const tiers = (rr - rl) / Math.max(1, racks.length) < 11 ? 2 : 1; const cols = Math.ceil(racks.length / tiers); // (a narrow cellar: racks on racks)
      const per = Math.floor((rr - rl) / Math.max(1, cols)); const top = tiers === 1 ? yf - 46 : Math.round(H * 0.24); const th = Math.floor((yf - 2 - top) / tiers); // (one tier: a head over a man)
      racks.forEach(([, i], k) => { // a rack: an oak frame, its bottles' ends in rows, a slate tag on top
        const x0 = rl + (k % cols) * per; const w = per - 2; const y0 = top + Math.floor(k / cols) * th + 5; const y1 = top + (Math.floor(k / cols) + 1) * th;
        // a diamond lattice in an oak frame, a bottle's end in each diamond (some racks fuller than others)
        rect(x0, y0, w, y1 - y0, I.OUTLINE); rect(x0, y0, w, 1, I.TIMBER_HI); rect(x0, y0, 1, y1 - y0, I.TIMBER); rect(x0 + w - 1, y0, 1, y1 - y0, I.TIMBER_SH); rect(x0, y1 - 1, w, 1, I.TIMBER_SH);
        const full = 0.45 + 0.55 * ((k * 5 + 3) % 7) / 6;
        for (let y = y0 + 1; y < y1 - 1; y += 1) for (let x = x0 + 1; x < x0 + w - 1; x += 1) { const u = x - x0; const v = y - y0; if ((u + v) % 6 === 0 || ((u - v) % 6 + 6) % 6 === 0) set(x, y, (u + v) % 6 === 0 ? I.TIMBER : I.TIMBER_SH); }
        for (let y = y0 + 3; y < y1 - 3; y += 1) for (let x = x0 + 2; x < x0 + w - 2; x += 1) { const u = x - x0; const v = y - y0; if ((u + v) % 6 === 3 && ((u - v) % 6 + 6) % 6 === 3 && rng() < full) bottle(x - 1, y - 1, x + y); }
        rect(x0 + Math.round(w / 2) - 3, y0 - 4, 7, 4, I.STONE_SH); set(x0 + Math.round(w / 2) - 1, y0 - 3, I.LIME_HI); set(x0 + Math.round(w / 2) + 1, y0 - 2, I.LIME_HI); // chalk on the slate
        slots[i] = box(x0 - 1, y0 - 5, w + 2, y1 - y0 + 6);
      });
      function cask(xc, yb, r) { // a cask standing, seen from the side: bellied staves, two iron hoops, its lid
        const h = Math.round(r * 2.6);
        for (let y = 0; y < h; y += 1) {
          const half = Math.round(r * (0.78 + 0.22 * Math.sin((Math.PI * (y + 0.5)) / h)));
          const hoop = Math.abs(y - h * 0.22) < 0.6 || Math.abs(y - h * 0.78) < 0.6;
          for (let x = -half; x <= half; x += 1) {
            const edge = Math.abs(x) === half;
            set(xc + x, yb - y, edge ? I.OUTLINE : hoop ? (x > 0 ? I.ARM_HI : I.ARM_SH) : (x + half) % 3 === 0 ? I.TIMBER_SH : x > half * 0.3 ? I.TIMBER_HI : I.TIMBER);
          }
        }
        rect(xc - Math.round(r * 0.78), yb - h, Math.round(r * 1.56) + 1, 1, I.TIMBER_SH);
        shadow(xc, yb + 1, 2 * r);
        return yb - h;
      }
      const cr = Math.max(4, Math.min(7, Math.floor((S(0.98) - S(0.66)) / 4.4))); const cx0 = S(0.66) + cr;
      const lid = cask(cx0, yf - 1, cr); cask(cx0 + 2 * cr + 2, yf + 1, cr); // two, one a little nearer
      [[cx0, yf - 1], [cx0 + 2 * cr + 2, yf + 1]].forEach(([xc, yb], k) => { // each knocked on (how full it sounds) or drawn from at its spigot
        const h = Math.round(cr * 2.6); rect(xc - 1, yb - Math.round(h * 0.3), 2, 1, I.GOLD_SH); set(xc - 2, yb - Math.round(h * 0.3), I.GOLD); // (the spigot)
        extra.push({ t: { kind: 'cask', label: `The ${k ? 'nearer' : 'farther'} cask`, act: () => caskTap(k) }, b: box(xc - cr, yb - h, 2 * cr + 1, Math.round(h * 0.6)) });
        extra.push({ t: { kind: 'spigot', label: `The ${k ? 'nearer' : 'farther'} cask's spigot`, act: () => caskDraw(k, xc - 2, yb - Math.round(h * 0.3)) }, b: box(xc - 3, yb - Math.round(h * 0.3) - 2, 5, 5) });
      });
      candle(cx0, lid - 1, false);
      // (the way down is not drawn: the descent is the status line's Rank, > or `descend`)
      { // a cobweb in the vault's left corner; a drop forming on the vault, falling now and then (drawInterior)
        const cx = BR - 2; const cy = Math.round(H * 0.3); // (the right corner: the racks fill the left)
        [0.05, 0.45, 0.85, 1.25].forEach((q) => { for (let r = 0; r <= 10; r += 1) set(cx - Math.cos(q) * r, cy + Math.sin(q) * r - 8, I.PLASTER); });
        for (let ring = 3; ring <= 9; ring += 3) for (let q = 0.05; q <= 1.25; q += 0.08) set(cx - Math.cos(q) * ring, cy + Math.sin(q) * ring - 8 + Math.sin(q * 3) * 0.6, I.PLASTER_SH);
        deco.push({ type: 'drip', x: Math.round(W * 0.58), y: Math.round(H * 0.1), floor: floorY(0.2) });
        deco.push({ type: 'puddle', x: Math.round(W * 0.58), y: floorY(0.2) + 1 }); // (it grows while it really rains over Paris)
      }
      lantern(S(0.66), Math.round(H * 0.3));
    } else { // contact: the letterbox in the door, a lodestone and the register on the table, a map of Paris
      const a = S(0.42); const b = S(0.62); const dt = yf - 52; door(a, b, dt); // (a great door: ~1.7 adults)
      deco.push({ type: 'portcullis', a, b, t: dt }); // (its iron grid before the door, raised by the winch: drawInterior)
      lantern(b + 6, dt + 14);
      for (let k = 0; k < 3; k += 1) { set(a - 6 + k * 2, dt + 18, I.GOLD); set(a - 6 + k * 2, dt + 19, I.GOLD_SH); }
      const tb = table3d(S(0.2), Sw(0.26));
      things.forEach((t, i) => {
        if (t.kind === 'letterbox') { // a bronze plate, its slot, the knocker's ring over it
          const lx = Math.round((a + b) / 2) - 5; const ly = dt + 26;
          rect(lx, ly, 11, 7, I.GOLD_SH); rect(lx, ly, 11, 1, I.GOLD_HI); rect(lx, ly, 1, 7, I.GOLD); rect(lx + 2, ly + 3, 7, 1, I.OUTLINE); set(lx + 1, ly + 1, I.GOLD_HI); set(lx + 9, ly + 5, I.GOLD_HI);
          const kx = lx + 5; const ky = ly - 7; for (let q = 0; q < 6.28; q += 0.4) set(kx + Math.round(Math.cos(q) * 3), ky + Math.round(Math.sin(q) * 3), I.GOLD); set(kx, ky - 3, I.GOLD_HI); set(kx, ky - 4, I.GOLD_SH); // the ring, its boss
          slots[i] = box(lx - 1, ky - 5, 13, ly - ky + 13); }
        else if (t.kind === 'lodestone') { const xc = tb.l + 4; rect(xc - 3, tb.front - 4, 7, 4, I.STONE); rect(xc - 3, tb.front - 4, 7, 1, I.STONE_HI); rect(xc - 4, tb.front - 3, 5, 1, I.CAP); rect(xc + 1, tb.front - 3, 4, 1, I.WING); shadow(xc, tb.front, 8); slots[i] = box(xc - 5, tb.front - 6, 11, 7); }
        else if (t.kind === 'map') { const mx0 = S(0.66); const my = Math.round(H * 0.24); rect(mx0, my, 18, 13, I.TIMBER); rect(mx0 + 1, my + 1, 16, 11, I.BEARD); // (by the door: the winch of the portcullis keeps the corner)
          for (let x = 0; x < 16; x += 1) set(mx0 + 1 + x, my + 6 + Math.round(Math.sin(x * 0.5) * 2), I.WATER); [[5, 3], [10, 8], [13, 3]].forEach(([dx, dy]) => set(mx0 + dx, my + dy, I.CAP)); slots[i] = box(mx0 - 1, my - 1, 20, 15); }
        else if (t.kind === 'register') { slots[i] = mark(() => { openBook(tb.r - 12, tb.front, 11); return box(tb.r - 13, tb.front - 6, 13, 7); }); }
        else { const xc = tb.l + 14; rect(xc - 3, tb.front - 3, 6, 3, I.BEARD); slots[i] = box(xc - 4, tb.front - 4, 8, 5); }
      });
      candle(tb.r - 2, tb.back, true);
      { // a pyramid of cannonballs by the door, packed as tight as balls can be (Kepler's conjecture)
        const bx0 = Math.max(b + 4, Math.min(b + 4, Math.min(BR - 17, S(0.72) + 24) - 15)); const by0 = floorY(0.35); // (left of the cabinet)
        const ball = (x, y) => { rect(x, y, 3, 3, I.ARM); set(x, y, I.ARM_HI); set(x + 2, y + 2, I.ARM_SH); set(x + 1, y + 2, I.ARM_SH); set(x + 2, y + 1, I.ARM_SH); set(x, y + 2, I.OUTLINE); set(x + 2, y, I.OUTLINE); };
        for (let r = 0; r < 4; r += 1) for (let k = 0; k < 4 - r; k += 1) ball(bx0 + k * 3 + r * 1.5, by0 - 3 - r * 2.6);
        shadow(bx0 + 6, by0 + 1, 13);
        extra.push({ t: { kind: 'kepler', label: 'The cannonballs', html: cards.kepler() }, b: box(bx0 - 1, by0 - 14, 15, 15) });
      }
      if (Math.round((tb.r + a) / 2) + 6 < a - 3) { // an arrow slit high in the wall, when the door leaves it room; on a sunny day its light makes fringes on the floor (see drawInterior)
        const sx = Math.round((tb.r + a) / 2) + 2; const sy0 = Math.round(H * 0.2); const sh = Math.round(H * 0.18);
        rect(sx - 1, sy0 - 1, 3, sh + 2, I.ROCK_HI); for (let y = 0; y < sh; y += 1) set(sx, sy0 + y, I.SKY2, 1);
        rect(sx - 2, sy0 + (sh >> 1), 5, 1, I.ROCK_HI); set(sx, sy0 + (sh >> 1), I.SKY2, 1); // the cross-slit
        deco.push({ type: 'fringes', x: sx, y: sy0, h: sh });
        extra.push({ t: { kind: 'fringes', label: 'The arrow slit', get html() { return cards.fringes(); } }, b: box(sx - 3, sy0 - 1, 7, sh + 2) });
      }
      windowArch(S(0.06), winY(32), 14, 32);
      { // the cabinet of curiosities: a shelf-place for each thing of the landscape found so far
        // a glazed cabinet, a little over a man's height: a cornice, four shelves behind two glass doors, a plinth
        const cw = 22; const cx0 = BR - cw - 3; const ch = 38; const cy0 = yf - ch;
        if (cx0 > b + 8) {
          rect(cx0 - 1, cy0 - 3, cw + 2, 3, I.TIMBER_HI); rect(cx0 - 1, cy0 - 1, cw + 2, 1, I.TIMBER_SH); // the cornice
          rect(cx0, cy0, cw, ch, I.TIMBER); rect(cx0 + 2, cy0 + 2, cw - 4, ch - 7, I.TIMBER_SH); // (dark oak inside, not black: the keepsakes must show)
          for (let k = 1; k < 4; k += 1) rect(cx0 + 2, cy0 + 2 + k * 8, cw - 4, 1, I.TIMBER_HI); // the shelves
          rect(cx0 + Math.floor(cw / 2), cy0 + 2, 1, ch - 7, I.TIMBER); rect(cx0, cy0 + ch - 5, cw, 5, I.TIMBER); rect(cx0, cy0 + ch - 5, cw, 1, I.TIMBER_HI); // the doors' meeting, the plinth
          for (let k = 0; k < 5; k += 1) { set(cx0 + 3 + k, cy0 + 4 + k, I.PLASTER_HI); set(cx0 + Math.floor(cw / 2) + 3 + k, cy0 + 20 + k, I.PLASTER_HI); } // the glass catching the light
          set(cx0 + Math.floor(cw / 2) - 2, cy0 + 18, I.GOLD); set(cx0 + Math.floor(cw / 2) + 2, cy0 + 18, I.GOLD); // the key, the handle
          deco.push({ type: 'cabinet', x: cx0 + 1, y: cy0 + 2, w: cw - 2 });
          extra.push({ t: { kind: 'cabinet', label: 'The cabinet of curiosities', get html() {
            const { found: f, all } = curiosOf(); const miss = Object.keys(all).filter((k) => !f.includes(k));
            return `<h3>The cabinet of curiosities</h3><p>A keepsake for each thing of the landscape that answered you (this visit). On the top shelf, always, a little white cat with black patches: Blanc Blanc, who loved to hide in places like this one.</p>`
              + (f.length ? `<ul>${f.map((k) => `<li>${all[k]}</li>`).join('')}</ul>` : '<p class="dim">Its shelves are bare: click about the landscape.</p>')
              + `<p class="dim">${miss.length} still to find${miss.some((k) => /\(/.test(all[k])) ? `, among them ${miss.filter((k) => /\(/.test(all[k])).map((k) => all[k]).slice(0, 3).join('; ')}` : ''}.</p>`;
          } }, b: box(cx0, cy0, cw, ch) });
        }
      }
    }
    late.forEach((f) => f());
    /* the rooms furnished: what a room lived in has on its walls and floor besides the things to click
       (sconces, shelves of jars and books, a trophy of arms, stores hung from the vault, a cage...), each
       piece only where the wall is bare (wallFree: no furniture, no hotspot, nothing that moves), else left out */
    const wallFree = (x, y, w, h) => {
      x = Math.round(x); y = Math.round(y);
      if (x < BL + 1 || x + w > BR - 1 || y < 4 || y + h > yf + 4) return false;
      if (x + w > W * 0.6 && y < 22) return false; // (the menu and its 'leave' cover the top right)
      for (let yy = y - 1; yy <= y + h; yy += 1) for (let xx = x - 1; xx <= x + w; xx += 1) if (furn[yy * W + xx]) return false;
      const hit = (b) => b && x <= b.x + b.w && x + w >= b.x && y <= b.y + b.h && y + h >= b.y;
      return !slots.some(hit) && !reserved.some(hit) && !extra.some((e) => hit(e.b)) && !doorList.some((e) => hit(e.b))
        && !deco.some((d) => d.x !== undefined && d.y !== undefined && hit({ x: d.x - 4, y: d.y - 4, w: (d.w || 8) + 8, h: (d.h || 8) + 8 }));
    };
    /** The first free place for a w x h piece: each x of `xs` at y, then a little lower or higher. */
    const placeOn = (xs, y, w, h) => { for (const d of [0, 4, -4, 8, -8, 12]) for (const x of xs) if (wallFree(x, y + d, w, h)) return [Math.round(x), Math.round(y + d)]; return null; };
    // the cards the visitor pinned up (ui/04-things.js: pins): each a small sheet nailed to the wall, its card again on a click
    {
      const along = [0.06, 0.94, 0.14, 0.86, 0.22, 0.78, 0.3, 0.7, 0.38, 0.62].map(S);
      (pinsOf(id) || []).forEach((t) => {
        const p = placeOn(along, Math.round(H * 0.3), 7, 10) || placeOn(along, Math.round(H * 0.5), 7, 10); if (!p) return;
        const [x, y] = p; const before = idx.slice();
        set(x + 3, y, I.OUTLINE); rect(x, y + 1, 7, 9, I.BEARD); rect(x, y + 1, 7, 1, I.BEARD_HI); rect(x + 6, y + 2, 1, 8, I.BEARD_SH); set(x, y + 9, I.BEARD_SH);
        for (let k = 0; k < 3; k += 1) rect(x + 1, y + 3 + k * 2, k === 2 ? 3 : 5, 1, I.BEARD_SH); set(x + 3, y + 1, I.OUTLINE); set(x + 5, y + 8, I.T_GULES); // (lines of writing, the nail, a red seal)
        const b = box(x - 1, y - 1, 9, 12); const px = []; for (let yy = b.y; yy < b.y + b.h; yy += 1) for (let xx = b.x; xx < b.x + b.w; xx += 1) { const i = yy * W + xx; if (i >= 0 && i < W * H && idx[i] !== before[i]) px.push(i, before[i], idx[i]); }
        owned.set(b, px); extra.push({ t, b });
      });
    }
    function sconce(x, y) { // an iron bracket out from the wall, a candle in its cup (y: the cup)
      rect(x - 1, y, 3, 1, I.ARM); set(x, y + 1, I.ARM_SH); set(x + 1, y + 2, I.ARM_SH); rect(x + 1, y + 3, 2, 3, I.ARM_SH); set(x + 1, y + 3, I.ARM);
      candle(x, y - 1, false);
    }
    const JAR = { // small things standing on a shelf, by name: [w, draw(x, yb)]
      jar: [3, (x, yb) => { rect(x, yb - 4, 3, 4, I.PLASTER); set(x, yb - 4, I.PLASTER_HI); rect(x, yb - 1, 3, 1, I.PLASTER_SH); set(x + 1, yb - 5, I.CLOTH_SH); }],
      pot: [5, (x, yb) => { rect(x + 1, yb - 4, 3, 1, I.RUST); rect(x, yb - 3, 5, 2, I.RUST); set(x, yb - 3, I.RUST_HI); rect(x + 1, yb - 1, 3, 1, I.RUST_SH); set(x + 2, yb - 5, I.RUST_SH); }],
      green: [3, (x, yb) => { rect(x, yb - 3, 3, 3, I.FERN); set(x, yb - 3, I.LEAF2); set(x + 1, yb - 4, I.FERN_SH); set(x + 1, yb - 5, I.FERN_SH); }],
      bottle: [2, (x, yb) => { rect(x, yb - 4, 2, 4, I.PINE_SH); set(x, yb - 5, I.PINE_SH); set(x, yb - 6, I.CLOTH_SH); set(x, yb - 4, I.PINE_HI); }],
      books: [7, (x, yb) => { books(x, yb, 3, false); }],
      roll: [6, (x, yb) => { rect(x, yb - 2, 6, 2, I.BEARD_HI); set(x, yb - 2, I.BEARD); rect(x + 2, yb - 2, 1, 2, I.CLOTH); }],
      globe: [5, (x, yb) => { for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) if (xx * xx + yy * yy <= 5) set(x + 2 + xx, yb - 5 + yy, (xx + 2 * yy) % 3 ? I.WATER : I.FERN); rect(x + 2, yb - 2, 1, 1, I.GOLD_SH); rect(x + 1, yb - 1, 3, 1, I.GOLD); }],
      glass: [3, (x, yb) => { rect(x, yb - 5, 3, 1, I.GOLD); rect(x, yb - 1, 3, 1, I.GOLD); set(x + 1, yb - 4, I.FL_YEL); set(x + 1, yb - 3, I.GOLD_SH); set(x + 1, yb - 2, I.FL_YEL); }], // an hourglass
      skull: [4, (x, yb) => { rect(x, yb - 4, 4, 3, I.BEARD_HI); set(x + 1, yb - 3, I.OUTLINE); set(x + 3, yb - 3, I.OUTLINE); rect(x + 1, yb - 1, 2, 1, I.BEARD); }],
      crucible: [4, (x, yb) => { rect(x, yb - 3, 4, 3, I.STONE); set(x, yb - 3, I.STONE_HI); rect(x + 1, yb - 3, 2, 1, I.OUTLINE); }],
      coil: [5, (x, yb) => { for (let q = 0; q < 6.28; q += 0.4) set(x + 2 + Math.round(Math.cos(q) * 2), yb - 3 + Math.round(Math.sin(q) * 2), q > 3 ? I.LEATHER : I.LEATHER_HI); }],
    };
    /** A plank on two brackets, `w` long, its top at y, the things of `what` along it (cycled). */
    function wallShelf(x, y, w, what) {
      rect(x, y, w, 1, I.TIMBER_HI); rect(x, y + 1, w, 1, I.TIMBER_SH);
      [x + 2, x + w - 3].forEach((bx) => { set(bx, y + 2, I.TIMBER_SH); set(bx, y + 3, I.TIMBER_SH); set(bx + 1, y + 2, I.TIMBER); });
      let xx = x + 1; let k = 0;
      while (true) { const [jw, draw] = JAR[what[k % what.length]]; if (xx + jw > x + w - 1) break; draw(xx, y); xx += jw + 1 + (rng() < 0.4 ? 1 : 0); k += 1; }
    }
    function trophy(xc, y) { // a shield on two crossed swords
      for (let k = 0; k < 16; k += 1) { set(xc - 8 + k, y + 1 + k, I.ARM_HI); set(xc + 7 - k, y + 1 + k, I.ARM); } // the blades
      [[-8, 1], [7, 1]].forEach(([dx, dy]) => { rect(xc + dx - 1, y + dy - 1, 3, 1, I.GOLD); set(xc + dx, y + dy - 2, I.GOLD_SH); }); // their hilts, high
      for (let yy = 0; yy < 12; yy += 1) { const half = yy < 7 ? 5 : Math.max(0, 5 - (yy - 6)); for (let xx = -half; xx <= half; xx += 1) set(xc + xx, y + 3 + yy, Math.abs(xx) === half || yy === 0 ? I.GOLD_SH : yy > 2 && yy < 6 ? I.FL_WHITE : I.CLOTH); } // the shield, a white fess on red
    }
    function chainLamp(x, y) { for (let yy = 4; yy < y; yy += 1) set(x, yy, yy % 2 ? I.ARM_SH : I.ARM); lantern(x, y + 1); }
    function niche(x, y) { // an arched niche in the wall, a stone jug in it
      for (let yy = 0; yy < 14; yy += 1) for (let xx = 0; xx < 10; xx += 1) { const u = (xx - 4.5) / 5; if (yy < 4 && yy < 4 * (1 - Math.sqrt(Math.max(0, 1 - u * u)))) continue; set(x + xx, y + yy, xx === 0 || yy === 13 ? I.ROCK_HI : I.OUTLINE); }
      rect(x + 3, y + 8, 4, 5, I.STONE); set(x + 3, y + 8, I.STONE_HI); set(x + 7, y + 9, I.STONE_SH); set(x + 7, y + 10, I.STONE_SH); rect(x + 4, y + 7, 2, 1, I.STONE_SH);
    }
    const floorFree = (xs, k, w, h) => clearAt(xs, floorY(k), w, h);
    if (kind === 'about') {
      chainLamp(S(0.5) + 16, 30);
      [S(0.5) - 17, S(0.5) + 16].forEach((x) => { if (wallFree(x - 2, 54, 5, 12)) sconce(x, 60); });
      let p = placeOn([S(0.12), S(0.15), S(0.2)], 56, 28, 9); if (p) wallShelf(p[0], p[1] + 7, 28, ['jar', 'books', 'pot', 'roll', 'bottle', 'jar']);
      p = placeOn([S(0.6), S(0.64), S(0.68)], 52, 24, 9); if (p) wallShelf(p[0], p[1] + 7, 24, ['skull', 'glass', 'books', 'green']);
    } else if (kind === 'research') {
      let p = placeOn([BL + 4, BL + 8, S(0.08)], 40, 30, 9); if (p) wallShelf(p[0], p[1] + 7, 30, ['globe', 'books', 'glass', 'roll', 'bottle']);
      p = placeOn([BR - 26, BR - 30, S(0.82)], 40, 24, 24);
      if (p) { // a mural quadrant: a brass arc of a quarter circle, graduated, its plumb line from the centre
        const [qx, qy] = [p[0] + 22, p[1]]; const R = 21;
        for (let q = 0; q <= Math.PI / 2; q += 0.02) { const X = qx - Math.cos(q) * R; const Y = qy + Math.sin(q) * R; set(X, Y, I.GOLD); set(X + 1, Y, I.GOLD_SH); }
        for (let q = 0; q <= Math.PI / 2 + 0.01; q += Math.PI / 18) { set(qx - Math.cos(q) * (R - 2), qy + Math.sin(q) * (R - 2), I.GOLD_HI); }
        for (let k = 0; k <= R; k += 1) { set(qx - k, qy, I.GOLD_SH); set(qx, qy + k, I.GOLD_SH); }
        for (let k = 0; k < R - 3; k += 1) set(qx - Math.round(k * 0.55), qy + Math.round(k * 0.83), I.ARM); set(qx, qy, I.GOLD_HI);
      }
    } else if (kind === 'projects') {
      let p = placeOn([S(0.38), S(0.42), S(0.46), S(0.34)], 48, 40, 8); if (p) wallShelf(p[0], p[1] + 6, 40, ['crucible', 'pot', 'coil', 'bottle', 'crucible', 'jar', 'coil']);
      p = placeOn([S(0.5), S(0.56), S(0.44), S(0.62), S(0.3), S(0.26)], 60, 34, 16);
      if (p) [[0, 1, 15], [17, -1, 12]].forEach(([dx, dy, w]) => { // plans pinned to the brick: blue sheets, white lines, a pin at each corner
        const x = p[0] + dx; const y = p[1] + 2 + dy; rect(x, y, w, 13, I.T_NAVY); rect(x, y, w, 1, I.T_AZURE);
        for (let k = 2; k < w - 2; k += 1) { set(x + k, y + 4 + Math.round(Math.sin(k * 0.7 + dx) * 1.5), I.PLASTER_HI); if (k % 4 === 0) set(x + k, y + 9, I.PLASTER); }
        rect(x + 2, y + 9, w - 4, 1, I.PLASTER); [[0, 0], [w - 1, 0], [0, 12], [w - 1, 12]].forEach(([a, b]) => set(x + a, y + b, I.CAP));
      });
      p = placeOn([S(0.86), S(0.8), S(0.9)], 62, 16, 5); // three horseshoes nailed up, points high, for luck
      if (p) for (let k = 0; k < 3; k += 1) { const hx = p[0] + k * 6; rect(hx, p[1] + 3, 4, 1, I.ARM_SH); rect(hx, p[1], 1, 3, I.ARM); rect(hx + 3, p[1], 1, 3, I.ARM); set(hx + 1, p[1] + 3, I.ARM); }
    } else if (kind === 'publications') {
      const gx = floorFree([S(0.12), S(0.86), S(0.2), S(0.78)], 0.6, 9, 15);
      if (gx !== null) { // a terrestrial globe on its stand, before the bookcases (the sphere drawn live: drawInterior, 'globe')
        const fy = floorY(0.6); const cx = gx + 4; const cy = fy - 12;
        for (let q = -0.6; q <= 3.8; q += 0.08) set(cx + Math.round(Math.cos(q) * 5), cy + Math.round(Math.sin(q) * 5), I.GOLD_SH); // its meridian
        rect(cx, cy + 5, 1, 5, I.TIMBER_SH); rect(cx - 3, fy - 1, 7, 1, I.TIMBER); set(cx - 3, fy, I.TIMBER_SH); set(cx + 3, fy, I.TIMBER_SH);
        deco.push({ type: 'globe', x: cx, y: cy, r: 4.2 });
      }
      const pubs0 = things.map((t, i) => [t, i]).filter(([t]) => t.kind === 'book');
      const onLectern = [...pubs0, ...things.map((t, i) => [t, i]).filter(([t]) => t.kind === 'volume')]; // (it turns: the works, then the catalogue's volumes)
      const lx = pubs0.length ? floorFree([S(0.32), S(0.68), S(0.26), S(0.74), S(0.2), S(0.8), S(0.38), S(0.62)], 0.72, 13, 8) : null;
      if (lx !== null) { // a reading lectern, the newest work open on it (its card: that work's)
        const fy = floorY(0.72); const top = fy - 17;
        rect(lx + 5, top + 5, 3, fy - top - 5, I.TIMBER_SH); rect(lx + 1, fy - 1, 11, 1, I.TIMBER_SH); // its post and foot
        for (let k = 0; k < 13; k += 1) set(lx + k, top + 3 + Math.floor(k / 5), I.TIMBER_HI);
        openBook(lx, top + 2, 13); const lt = onLectern[lecternIx % onLectern.length][0];
        rect(lx + 6, top + 1, 1, 3, BOOK[lecternIx % BOOK.length]); // (its ribbon, the book's colour: another book, another colour)
        extra.push({ t: { ...lt, kind: 'lectern', book: lt.kind, label: `On the lectern: ${lt.label}`, count: onLectern.length }, b: box(lx - 1, top - 3, 15, fy - top + 3) });
      }
    } else if (kind === 'talks') {
      const cl = deco.find((d) => d.type === 'astroclock');
      if (cl) [cl.x - cl.r - 9, cl.x + cl.r + 9].forEach((x) => { if (wallFree(x - 2, cl.y - 4, 5, 12)) sconce(x, cl.y + 2); });
      const p = placeOn([S(0.72), S(0.66), S(0.78), S(0.3), S(0.36)], 44, 17, 18); if (p) trophy(p[0] + 8, p[1]);
    } else if (kind === 'news') {
      let p = placeOn([S(0.56), S(0.6), S(0.3)], 12, 9, 18);
      if (p) { // a cage hung from the rafters, a finch in it
        const [x, y] = p; for (let yy = 4; yy < y + 4; yy += 1) set(x + 4, yy, I.ARM_SH);
        for (let yy = 0; yy < 12; yy += 1) for (let xx = 0; xx < 9; xx += 1) { const u = (xx - 4) / 4.5; if (yy < 3 && yy < 3 * (1 - Math.sqrt(Math.max(0, 1 - u * u)))) continue; if (xx % 2 === 0 || yy === 11 || yy === 6) set(x + xx, y + 4 + yy, yy === 11 ? I.TIMBER : I.ARM_SH); }
        rect(x + 3, y + 12, 3, 2, I.FL_YEL); set(x + 5, y + 11, I.FL_YEL); set(x + 6, y + 11, I.GOLD_SH);
      }
      p = placeOn([S(0.02), S(0.05)], 74, 30, 10);
      if (p) { // the falconer's pegs: a hood, a glove, a leash
        rect(p[0], p[1], 30, 1, I.TIMBER_SH); [3, 13, 23].forEach((dx) => set(p[0] + dx, p[1] + 1, I.TIMBER));
        rect(p[0] + 2, p[1] + 2, 4, 3, I.LEATHER); set(p[0] + 3, p[1] + 1, I.FL_RED); // the hood, its plume
        rect(p[0] + 12, p[1] + 2, 3, 6, I.LEATHER_HI); rect(p[0] + 11, p[1] + 6, 2, 2, I.LEATHER_HI); // the glove
        for (let k = 0; k < 7; k += 1) set(p[0] + 23 + (k % 2), p[1] + 2 + k, I.LEATHER_SH); // the leash
      }
      const sx = floorFree([S(0.82), S(0.88), S(0.3), S(0.22)], 0.28, 12, 9);
      if (sx !== null) { const fy = floorY(0.28); rect(sx, fy - 7, 7, 7, I.CORK); rect(sx + 1, fy - 8, 5, 1, I.CORK_SH); set(sx + 3, fy - 9, I.CORK_SH); rect(sx + 8, fy - 4, 4, 4, I.TIMBER); rect(sx + 8, fy - 4, 4, 1, I.ARM_SH); } // a sack of grain, a bucket
      for (let k = 0; k < 40; k += 1) { const x = S(0.05) + Math.floor(rng() * Sw(0.9)); const y = floorY(0.1 + rng() * 0.8); if (!furn[y * W + x]) { set(x, y, k % 2 ? I.CORK : I.GOLD_SH); set(x + 1, y - (k % 3 ? 0 : 1), I.CORK); } } // straw
    } else if (kind === 'contact') {
      let p = placeOn([S(0.2), S(0.24), S(0.16), S(0.28)], 30, 17, 18); if (p) trophy(p[0] + 8, p[1]);
      p = placeOn([S(0.64), S(0.66)], 74, 12, 9);
      if (p) { rect(p[0], p[1], 12, 6, I.TIMBER); rect(p[0], p[1], 12, 1, I.TIMBER_HI); for (let k = 0; k < 3; k += 1) { set(p[0] + 2 + k * 4, p[1] + 2, I.ARM_SH); rect(p[0] + 2 + k * 4, p[1] + 3, 1, 4 + (k % 2), I.GOLD); set(p[0] + 3 + k * 4, p[1] + 6 + (k % 2), I.GOLD_SH); } } // the keys on their board
      p = placeOn([BR - 22, BR - 26, S(0.86)], 26, 17, 17);
      if (p) { // the winch of the portcullis: a spoked wheel, its chain going up (turned: a drag, or a click to raise or lower it all)
        const cx = p[0] + 8; const cy = p[1] + 8; extra.push({ t: { kind: 'winch', label: 'The winch of the portcullis', act: () => winchTo(gate.to > 0.5 ? 0 : 1) }, b: box(cx - 8, cy - 8, 17, 17) });
        for (let q = 0; q < 6.28; q += 0.05) { set(cx + Math.round(Math.cos(q) * 7), cy + Math.round(Math.sin(q) * 7), I.TIMBER); set(cx + Math.round(Math.cos(q) * 6), cy + Math.round(Math.sin(q) * 6), I.TIMBER_SH); }
        for (let q = 0; q < 6.28; q += 6.28 / 6) for (let r = 0; r < 6; r += 1) set(cx + Math.round(Math.cos(q) * r), cy + Math.round(Math.sin(q) * r), I.TIMBER_HI);
        rect(cx - 1, cy - 1, 3, 3, I.ARM_SH); for (let yy = 4; yy < cy - 7; yy += 1) set(cx + 7, yy, yy % 2 ? I.ARM_SH : I.ARM);
      }
    } else if (kind === 'cellar') {
      let p = placeOn([S(0.7), S(0.74), S(0.66)], 36, 40, 16);
      if (p) { // a pole across, a ham and strings of garlic and onions hung from it
        const [x, y] = p; rect(x, y, 40, 1, I.TIMBER); rect(x, y + 1, 40, 1, I.TIMBER_SH);
        [[4, 'ham'], [13, 'garlic'], [19, 'onion'], [26, 'ham'], [35, 'garlic']].forEach(([dx, what]) => {
          const hx = x + dx; set(hx, y + 2, I.CLOTH_SH);
          if (what === 'ham') { for (let yy = 0; yy < 10; yy += 1) { const half = Math.round(1 + Math.sin(((yy + 1) / 11) * Math.PI) * 2); for (let xx = -half; xx <= half; xx += 1) set(hx + xx, y + 3 + yy, xx === -half ? I.RUST_HI : xx === half ? I.RUST_SH : I.RUST); } set(hx, y + 13, I.BEARD_HI); }
          else for (let k = 0; k < 4; k += 1) { const c = what === 'garlic' ? I.BEARD_HI : I.GOLD_SH; rect(hx - 1 + (k % 2), y + 3 + k * 3, 2, 2, c); set(hx + (k % 2), y + 3 + k * 3, what === 'garlic' ? I.BEARD : I.GOLD); }
        });
      }
      p = placeOn([S(0.7), S(0.74), S(0.66)], 58, 32, 9); if (p) wallShelf(p[0], p[1] + 7, 32, ['jar', 'pot', 'bottle', 'bottle', 'jar', 'pot']);
      p = placeOn([S(0.3), S(0.22), S(0.4), S(0.12)], 26, 10, 14); if (p) niche(p[0], p[1]);
    }
    doorList.forEach((e) => extra.push(e));
    seasonal();
    { // the foreground piece: low in the view, at a free place, its bottom cut by the edge
      const sp = NEAR_SP[kind] && shadeSprite(NEAR_SP[kind]);
      // (twice the size: it is nearer us than anything else; its last row or two under the edge)
      if (sp) {
        const w2 = sp.w * 2; const y0 = H - sp.h * 2 + 3; const xs = [S(0.06), S(0.84), S(0.14), S(0.76), S(0.24), S(0.68)];
        const x0 = xs.find((x) => { for (let y = y0; y < H; y += 1) for (let xx = x - 1; xx < x + w2 + 1; xx += 1) if (furn[y * W + xx]) return false; return true; });
        if (x0 !== undefined) for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const c = sp.px[y * sp.w + x]; if (c >= 0) rect(x0 + 2 * x, y0 + 2 * y, 2, 2, c); }
      }
    }
    if (DWELLERS[kind]) { // the room's dweller, standing on the floor at a free place, near the back
      const [h, b, a, l, x, beard, lines] = DWELLERS[kind];
      const sea = (() => { const q = new URLSearchParams(location.search).get('season'); return ['spring', 'summer', 'autumn', 'winter'].includes(q) ? q : SEASON(today().getMonth()); })();
      const dress = (art) => { // the season's clothes: bare arms in summer, a red scarf and a darker hood in winter
        const rows = art.split('\n');
        if (sea === 'summer') return rows.map((r, y) => (y > 11 ? r.replace(/A/g, 'f') : r)).join('\n');
        if (sea === 'winter') return rows.map((r, y) => (y === 8 ? r.replace(/B/g, 'r') : y < 3 ? r.replace(/H/g, 'a') : r)).join('\n');
        return art;
      };
      const txt = dress(PERSON).replace(/H/g, h).replace(/B/g, b).replace(/A/g, a).replace(/L/g, l).replace(/X/g, x).replace(/e/g, beard ? 'e' : 'f');
      const sp = shadeSprite(txt); let fy = floorY(0.18);
      const xs = [0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.12, 0.88, 0.5, 0.25, 0.75, 0.35, 0.65, 0.05, 0.95].map(S);
      const boxes = [...slots.filter(Boolean), ...reserved, ...deco.filter((d) => d.x !== undefined && d.y !== undefined).map((d) => ({ x: d.x - 8, y: d.y - 8, w: (d.w || 0) + 16, h: (d.h || 0) + 16 })),
        ...flames.filter((f) => f.hearth).map((f) => ({ x: f.x - f.w / 2 - 2, y: f.y - 10, w: f.w + 4, h: 14 }))]; // (nor before the fire)
      const hides = (x) => boxes.some((b) => x < b.x + b.w && x + sp.w > b.x && fy - sp.h < b.y + b.h && fy > b.y); // (never in front of a thing to click, nor of one that moves)
      const feetFree = (x) => { let n2 = 0; for (let y = fy - 8; y <= fy + 1; y += 1) for (let xx = x - 1; xx <= x + sp.w; xx += 1) if (furn[y * W + xx]) n2 += 1; return n2 < 4; }; // (a fallen leaf is no obstacle)
      const spot = () => xs.find((x) => feetFree(x) && !hides(x)) ?? null; // (his feet on free floor; the wall behind him may hold things)
      let x0 = spot(); if (x0 === null) { fy = floorY(0.42); x0 = spot(); } // (no room by the wall: a step into the room)
      if (x0 !== null) { // (drawn by drawInterior: he walks a few steps along his free floor, waits, walks back)
        let fig = sp;
        if (kind === 'news') { // the raven on his fist, one figure with him
          const rv = shadeSprite(RAVEN); const w2 = Math.max(sp.w, sp.w - 4 + rv.w); const px = new Int16Array(w2 * sp.h).fill(-1);
          for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) px[y * w2 + x] = sp.px[y * sp.w + x];
          for (let y = 0; y < rv.h; y += 1) for (let x = 0; x < rv.w; x += 1) { const c = rv.px[y * rv.w + x]; if (c >= 0 && y + 8 < sp.h) px[(y + 8) * w2 + x + sp.w - 4] = c; }
          fig = { w: w2, h: sp.h, px };
        }
        let xa = x0; let xb = x0; // (how far he may go either way: free feet, nothing to click or that moves behind him)
        while (xa > x0 - 16 && feetFree(xa - 1) && !hides(xa - 1)) xa -= 1;
        while (xb < x0 + 16 && feetFree(xb + 1) && !hides(xb + 1)) xb += 1;
        const stops = [x0, xa, x0, xb].filter((v, k, a) => k === 0 || v !== a[k - 1]);
        const look = (dx) => { // the face turned a pixel that way (the eyes and the mouth rows, inside the head's columns 3 to 8)
          const px = fig.px.slice();
          for (let y = 4; y <= 7; y += 1) for (let x = 3; x <= 8; x += 1) { const from = x - dx; px[y * fig.w + x] = from >= 3 && from <= 8 ? fig.px[y * fig.w + from] : fig.px[3 * fig.w + 4]; }
          return { ...fig, px };
        };
        deco.push({ type: 'dweller', kind, x: x0, y: fy - fig.h + 1, w: fig.w, h: fig.h, lines, fig, figL: look(-1), figR: look(1), stops, ph: rng() * 30 });
      }
    }
    { // contact shadows: under the foot of each thing that stands on the floor, the floor darkened two
      // rows down, dithered, a little to the right (the light comes from the window and the fire, before us)
      const DARK = { [I.TIMBER_HI]: I.TIMBER, [I.TIMBER]: I.TIMBER_SH, [I.TIMBER_SH]: I.OUTLINE, [I.ROCK_HI]: I.ROCK, [I.ROCK]: I.ROCK_SH, [I.ROCK_SH]: I.ROCK_DK, [I.ROCK_DK]: I.OUTLINE };
      const feet = [];
      for (let x = 0; x < W; x += 1) for (let y = yf; y < H - 1; y += 1) if (furn[y * W + x] && !furn[(y + 1) * W + x]) feet.push([x, y]);
      feet.forEach(([x, y]) => [[0, 1], [1, 1], [1, 2], [2, 2]].forEach(([dx, dy]) => { const X = x + dx; const Y = y + dy; if (Y >= H || X >= W || furn[Y * W + X]) return; const i = Y * W + X; if (DARK[idx[i]] !== undefined && bayer(X, Y) < (dy === 1 ? 0.75 : 0.4)) idx[i] = DARK[idx[i]]; }));
    }
    extra.forEach(({ t, b }) => { slots[things.length] = b; things.push(t); }); // the hangings and the doors can be looked at too
    }
    if (clash) (window.overlaps ||= {})[id] = { W, H, pairs: [...clash].sort((a, b) => b[1] - a[1]) };
    return { id, W, H, idx, out, front, lights, flames, stars, motes, blinks, camps, deco, pools, sills, yf, slots, things, cells: new Float32Array(9 * 14),
      pix: slots.map((b) => owned.get(b) || null), doors: doorList.map((e) => e.b),
      ladderK: things.findIndex((tt) => tt.kind === 'ladder') };
  }

  /* ---- palette from the sun's altitude -------------------------------- */

  // at night the volumes go flat (no sun to model them): each group is pulled to its mean
  const FLATTEN = [['MT_FAR', 'MT_FAR_SH'], ['SNOW', 'SNOW_SH'], ['MT_NEAR', 'MT_NEAR_SH'],
    ['TREES_FAR', 'TREES_FAR_SH'], ['HILL_HI', 'HILL', 'HILL_SH'], ['ROCK_HI', 'ROCK', 'ROCK_SH'],
    ['WALL_HI', 'WALL', 'WALL_SH'], ['ROOF_HI', 'ROOF', 'ROOF_SH'], ['SLATE_HI', 'SLATE', 'SLATE_SH'],
    ['DOME_HI', 'DOME', 'DOME_SH'], ['PINE_HI', 'PINE', 'PINE_SH'], ['TIMBER_HI', 'TIMBER', 'TIMBER_SH']];
  // small near things keep some colour after dark (the eye looks for them), the path does not
  const DETAIL = new Set(['FL_RED', 'FL_YEL', 'FL_WHITE', 'FL_BLUE', 'FL_VIOLET', 'CAP', 'CAP_SH', 'CAP_BR',
    'STEM', 'MOSS', 'MOSS_HI', 'FERN', 'FERN_SH', 'GRASS_LT']);

  // which colours the month's miniature pulls: 1 the greens, 2 the earths (0, the sky, in paletteAt)
  const TINTED = {}; 'GRASS GRASS_SH GRASS_HI GRASS_LT HILL HILL_SH HILL_HI BUSH BUSH_SH BUSH_HI OAK OAK_SH OAK_HI'.split(' ').forEach((n) => { TINTED[n] = 1; });
  'FURROW FURROW_SH PATH PATH_SH PATH_HI DIRT DIRT_SH'.split(' ').forEach((n) => { TINTED[n] = 2; });
  'WALL_HI WALL WALL_SH WALL_DK'.split(' ').forEach((n) => { TINTED[n] = 3; }); // (3: the stone, after Monet)
  /** Monet's Rouen canvas for this hour and weather (clear, grey, fog), its stone colour interpolated
   *  between the two canvases nearest in hour; null at night or before the canvases have come. */
  function monetTint() {
    const a = real.monet; if (!a) return null;
    const kind = weather.kind === 'fog' ? 'fog' : ['overcast', 'drizzle', 'rain', 'showers', 'snow', 'storm'].includes(weather.kind) ? 'grey' : 'clear';
    const d = clockFn(); const h = d.getHours() + d.getMinutes() / 60; if (h < 6 || h > 21) return null;
    const cs = a.canvases.filter((c) => c.kind === kind).sort((p, q) => p.hour - q.hour); if (!cs.length) return null;
    let i = cs.findIndex((c) => c.hour > h); if (i < 0) i = cs.length; const lo = cs[Math.max(0, i - 1)]; const hi = cs[Math.min(cs.length - 1, i)];
    const k = hi === lo ? 0 : clamp((h - lo.hour) / (hi.hour - lo.hour));
    return { rgb: mix(lo.rgb, hi.rgb, k), title: (k < 0.5 ? lo : hi).title, year: (k < 0.5 ? lo : hi).year };
  }
  /** c moved by k towards colour q brought to c's own brightness (the hue moves, not the light). */
  const toward = (c, q, k) => { const lum = (v) => 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2] + 1; const f = lum(c) / lum(q); return mix(c, q.map((v) => Math.min(255, v * f)), k); };
  /** [sky, green, earth] of this month's miniature (null before the book has come). */
  const monthTint = () => { const a = real.heures; return a && a.tint ? a.tint[today().getMonth()] : null; };

  /** Palette for a sun altitude (deg); `moonlit` in [0, 1]: lit fraction of the disc times its height. */
  function paletteAt(alt, moonlit = 0) {
    let k = 0;
    while (k < KEYS.length - 2 && alt > KEYS[k + 1][0]) k += 1;
    const [a0, s0, am0, f0] = KEYS[k]; const [a1, s1, am1, f1] = KEYS[k + 1];
    const t = clamp((alt - a0) / (a1 - a0));
    const night = clamp((-alt - 1) / 8);
    const mt = monthTint(); // the month's miniature in the book of hours: its blues, greens and earths, a little
    const wt = monetTint(); // and the stone of the walls as Monet saw Rouen's at this hour, in this weather
    const sky = s0.map((c, i) => { const q = mix(hex(c), hex(s1[i]), t); return mt && mt[0] ? toward(q, mt[0], 0.08 * (1 - night)) : q; });
    const moon = moonlit * night;
    const amb = mix(am0, am1, t).map((a, j) => a * (1 + moon * [0.45, 0.55, 0.7][j])); // cold moonlight
    const fog = f0 + (f1 - f0) * t;
    const horizon = sky[N_SKY - 1];
    const lit = (h, depth, a = amb) => mix((typeof h === 'string' ? hex(h) : h).map((c, j) => c * a[j]), horizon, depth * fog);
    const ambDetail = amb.map((a) => a ** 0.55);
    const pal = new Array(NAMES.length);
    sky.forEach((c, i) => { pal[i] = c; });
    SURFACES.forEach(([n, h, depth]) => {
      const g = TINTED[n];
      const base = g === 3 ? (wt ? toward(hex(h), wt.rgb, 0.3 * (1 - night)) : h) : mt && g !== undefined && mt[g] ? toward(hex(h), mt[g], [0, 0.12, 0.1][g]) : h;
      let c = lit(base, depth, DETAIL.has(n) ? ambDetail : amb);
      if (n.startsWith('PATH')) c = c.map((q) => q * (1 - 0.35 * night));
      if (n === 'CLOUD' || n === 'CLOUD_SH') c = mix(c, night > 0.5 ? sky[2] : horizon, 0.3 + 0.3 * night);
      if (n === 'WIN_LIT') c = mix(c, [255, 176, 72], night);
      if (n === 'OUTLINE') c = hex(h);
      pal[I[n]] = c;
    });
    Object.values(MATS).forEach(([n, hi, mid, sh]) => {
      pal[I[`${n}_HI`]] = lit(hi, 0); pal[I[n]] = lit(mid, 0); pal[I[`${n}_SH`]] = lit(sh, 0);
    });
    Object.entries(EMISSIVE).forEach(([n, h]) => { pal[I[n]] = hex(h); });
    const flat = 0.7 * night * (1 - 0.5 * moon);
    FLATTEN.forEach((g) => {
      const mean = g.map((n) => pal[I[n]]).reduce((a, c) => a.map((q, j) => q + c[j] / g.length), [0, 0, 0]);
      g.forEach((n) => { pal[I[n]] = mix(pal[I[n]], mean, flat); });
    });
    return {
      pal, night, stars: clamp((-alt - 4) / 6),
      sun: alt > 6 ? [255, 246, 208] : [255, 176, 96],
      smoke: mix([200, 200, 206], [58, 56, 72], night),
      bird: lit('#2a2a3a', 0.3),
    };
  }

  /* ---- runtime ------------------------------------------------------- */

  const root = document.documentElement;
  let plate; let canvas; let ctx; let img; let buf; let obuf; let idxNow; let pal32; let planeColour;
  let backBuf; let backIdx; let backKey = ''; // the still planes, composed (see draw)
  let ipal32; let interior = null; let ibase; let ibuf; let iprev;
  let view = { state: 'scene', id: null, t0: 0 }; // scene | in | room | out | swap
  let hoverId = null; let pendingRoom = null; let pendingHoist = false;
  let heraldry = { own: 'silva', tapestry: [] }; let say = () => {}; let rumour = () => '';
  let curiosOf = () => ({ found: [], all: {} }); let nowOf = () => '';
  let visitsOf = () => ({ n: 1, first: null }); // the visitor's visits (ui/01-core.js): their oak's rings
  let newsOf = () => null; let dreamsOf = () => []; let tradeWith = () => ''; // (ui/02-theme.js: the latest news, the knight's dreams, the peddler's bargain)
  let pointer = null; // where the mouse is over the landscape, scene px (the black cat watches it)
  let billiardShow = () => {}; // the tavern's billiard table (ui/07-dialogs.js: a dialog)
  let stalenessOf = () => 0; // days since the visitor was last in a room (assets/js/ui): its cobwebs
  let ladderF = 0.15; // where the library's ladder stands on its rail, 0..1 (kept between visits)
  /* what the visitor has used most this visit, for the great hall's tapestry (La Dame à la licorne):
     touch the clicks, taste the village and its tavern, smell the fire and the orchard, hearing the
     sound on, sight the watchtower and the photo mode. Kept for the browser session. */
  const SENSES = ['touch', 'taste', 'smell', 'hearing', 'sight'];
  const senses = (() => { try { return { touch: 0, taste: 0, smell: 0, hearing: 0, sight: 0, ...JSON.parse(sessionStorage.getItem('senses') || '{}') }; } catch { return { touch: 0, taste: 0, smell: 0, hearing: 0, sight: 0 }; } })();
  const sense = (k, n = 1) => { senses[k] += n; try { sessionStorage.setItem('senses', JSON.stringify(senses)); } catch { /* private mode */ } };
  /** The tapestry for this visit: the most used sense, if one stands out; else "À mon seul désir" (5). */
  const senseNow = () => { const v = SENSES.map((k) => senses[k]); const m = Math.max(...v); const s2 = [...v].sort((a, b) => b - a)[1]; return m >= 4 && m > s2 * 1.3 ? v.indexOf(m) : 5; };
  /** A magic lantern show in the great hall: Saturday evenings (7 to 11 pm), or called up (event cinema). */
  const cinemaOn = () => (forced.cinema || 0) > now() || (clockFn().getDay() === 6 && clockFn().getHours() >= 19 && clockFn().getHours() < 23);
  let cinemaT0 = 0;
  let shelterUntil = 0; // (the event command can put the shelter up without rain)
  const forced = {}; // event name -> until when (now() s): what the event command has called up
  /* The chapel's offices by the sun (the canonical hours kept by the light, as monasteries did): lauds
     at first light, prime about sunrise, vespers at sunset, compline at nightfall. */
  const OFFICES = { lauds: 'Lauds, the morning office', prime: 'Prime, the hour of sunrise', vespers: 'Vespers, the evening office', compline: 'Compline, the last office of the day' };
  function officeNow(plain = false) {
    if (!plain && forced.chant && forced.chant.until > now()) return forced.chant.office;
    if (!bodies) return null;
    const a = bodies.sun[2] / deg; const h = today().getHours();
    if (h < 12) return a > -12 && a < -2 ? 'lauds' : a >= -2 && a < 8 ? 'prime' : null;
    if (a > -3 && a < 6) return 'vespers';
    return h >= 20 && h < 23 && a < -6 ? 'compline' : null;
  }
  let fireFed = 0; // when a log last went on the workshop's fire (it burns down in three minutes)
  const heatOf = () => clamp(1 - (now() - fireFed - 90) / 90, 0.15, 1);
  let found = () => {}; let itemsOf = () => []; let spotsTo = () => {}; let descendTo = () => {}; let cellarTo = () => descendTo(); let mapsTo = () => {}; let goTo = () => {}; let doorsOf = () => []; let hl = -1; // the room's things, their hotspots, the one pointed at
  let scene = null; let look = null; let skyFn; let reduce = false; let px = 3;
  let running = false; let visible = true; let raf = 0; let last = 0; let tick = 0;
  let bodies = null; let lastEclipse = null; let label0 = ''; let castUntil = 0;
  let par = 0; let parTarget = 0; // pointer parallax, -1 (left) .. 1 (right)
  // the weather over Paris (assets/js/ui, from Open-Meteo): kind clear|cloudy|overcast|fog|drizzle|rain|snow|storm,
  // cover 0..1 (cloud cover), wind (km/h)
  let weather = { kind: 'clear', cover: 0.3, wind: 10, dir: 270 };

  /* ---- the observatory's loom: a 2D Ising model (J = 1, no field, periodic edges), woven live by
     Metropolis checkerboard sweeps, at a temperature set by Paris's: T/Tc = 2^((t - 15 °C) / 20),
     so a 15 °C day weaves the critical point, Tc = 2 / ln(1 + √2) (Onsager 1944). w, h even. */
  /* ---- lightning: the dielectric breakdown model (Niemeyer, Pietronero & Wiesmann 1984). The
     channel grows down from the cloud a cell at a time, onto a neighbouring cell with probability
     ~ phi^eta, phi the potential (0 on the channel and the cloud, 1 at the ground), relaxed between
     steps (SOR); eta ~ 1.6 gives the forked bolts of real lightning (eta 1: a DLA bush, higher: a rod). A bolt grows
     over a few frames before it can strike; cells 2 px. ---- */

  const TC = 2 / Math.log(1 + Math.SQRT2);
  let loom = null;
  const loomT = () => TC * 2 ** (((weather.temp ?? 15) - 15) / 20);
  function loomSweep() {
    const { w, h, s } = loom; const b = 1 / loomT(); const p4 = Math.exp(-4 * b); const p8 = Math.exp(-8 * b);
    for (let par = 0; par < 2; par += 1) {
      for (let y = 0; y < h; y += 1) {
        for (let x = (y + par) % 2; x < w; x += 2) {
          const i = y * w + x;
          const n = s[y * w + (x + 1) % w] + s[y * w + (x + w - 1) % w] + s[((y + 1) % h) * w + x] + s[((y + h - 1) % h) * w + x];
          const dE = 2 * s[i] * n;
          if (dE <= 0 || Math.random() < (dE === 4 ? p4 : p8)) s[i] = -s[i];
        }
      }
    }
    loom.sweeps += 1;
  }
  function loomOf(w, h) { // (kept from one visit of the room to the next)
    if (!loom || loom.w !== w || loom.h !== h) {
      loom = { w, h, s: Int8Array.from({ length: w * h }, () => (Math.random() < 0.5 ? 1 : -1)), sweeps: 0 };
      for (let k = 0; k < 300; k += 1) loomSweep();
    }
    return loom;
  }
  /* ---- the rooms' other experiments: a Galton board (schoolroom), Conway's Life (library). State
     kept between visits. */
  let galton = null; let life = null;
  function galtonOf(rows) {
    if (!galton || galton.rows !== rows) galton = { rows, bins: new Array(rows + 1).fill(0), ball: null, n: 0 };
    return galton;
  }
  function galtonStep() { // one ball, a row a frame: left or right at each peg
    const g = galton;
    if (!g.ball) g.ball = { r: 0, k: 0 };
    else if (g.ball.r < g.rows) { g.ball.k += Math.random() < 0.5 ? 0 : 1; g.ball.r += 1; }
    else { g.bins[g.ball.k] += 1; g.n += 1; g.ball = null; if (Math.max(...g.bins) > 12) { g.bins.fill(0); } }
  }
  function lifeOf(w, h) {
    if (!life || life.w !== w || life.h !== h) life = { w, h, g: Uint8Array.from({ length: w * h }, () => (Math.random() < 0.35 ? 1 : 0)), gen: 0, seen: new Map() };
    return life;
  }
  function lifeStep() { // B3/S23 on a torus; a fresh soup when it settles or repeats
    const L = life; const { w, h, g } = L; const n = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (dx || dy) c += g[((y + dy + h) % h) * w + ((x + dx + w) % w)];
      n[y * w + x] = c === 3 || (c === 2 && g[y * w + x]) ? 1 : 0;
    }
    L.g = n; L.gen += 1;
    const key = n.join('');
    if (L.seen.has(key) || L.gen > 400) { life = null; lifeOf(w, h); return; }
    L.seen.set(key, L.gen); if (L.seen.size > 60) L.seen.delete(L.seen.keys().next().value);
  }
  let slits = null;
  /** One photon through Young's two slits: where it lands on the screen (0..h), drawn from
   *  I(y) ~ cos^2(pi y / fringe) sinc^2(pi y / envelope), by rejection. */
  function slitsHit(h) {
    const c = h / 2;
    for (;;) {
      const y = Math.random() * h; const u = (y - c) / h;
      const sinc = u === 0 ? 1 : Math.sin(Math.PI * u * 1.6) / (Math.PI * u * 1.6);
      if (Math.random() < Math.cos(Math.PI * u * 9) ** 2 * sinc ** 2) return y;
    }
  }
  /* ---- the schoolroom's life: the master's round (30 s: four stops along the board; at each he
     points at a line 4 s, turns to the class 1.5 s, walks on 2 s) and the pupils' whispering ---- */
  function masterAt(d, t) {
    const T0 = 7.5; const stop = Math.floor(t / T0) % 4; const ph = t % T0; const at = (k) => d.xa + ((d.xb - d.xa) * k) / 3;
    const back = stop === 3; const from = at(stop); const to = back ? at(0) : at(stop + 1); // (from the last stop back to the first)
    if (reduce) return { x: from, facing: 1, pointing: true, stop };
    if (ph < 4) return { x: from, facing: 1, pointing: true, stop };
    if (ph < 5.5) { const prev = chatAt(interior.deco.find((q) => q.type === 'chatter').heads, t - (ph - 4) - 0.1); return { x: from, facing: -1, stop, caught: Boolean(prev) && ph < 5 }; }
    const k = (ph - 5.5) / 2; return { x: from + (to - from) * k * k * (3 - 2 * k), facing: to >= from ? 1 : -1, walking: true, stop };
  }
  /** Which two neighbours whisper at time t (or null): a new pair every 5 s, talking 3.5 s of it. */
  function chatAt(heads, t) {
    const slot = Math.floor(t / 5); if (t % 5 > 3.5 || heads.length < 2) return null;
    const pairs = []; for (let i = 0; i + 1 < heads.length; i += 1) if (heads[i].row === heads[i + 1].row) pairs.push([heads[i], heads[i + 1]]);
    if (!pairs.length || (slot * 7919) % 5 === 0) return null; // (and some moments everyone works)
    return pairs[(slot * 2654435761 >>> 0) % pairs.length];
  }
  const PUPIL_TALK = ['"Psst. What is that h with a bar through it?"', '"He wrote the Z wrong. No, I am sure he did."', '"Will the Hamilton-Jacobi one be in the test?"',
    '"I bet you a sweet the Galton board makes a bell again."', '"Shh, he is turning round!"', '"Lend me your slate, mine is full of sums."', '"Why does heat only go one way?"',
    '"My father says the castle is older than the mountains."'];
  const MASTER_TALK = ['"The partition function, children: the whole of a system in one sum."', '"Who is whispering at the back? I have eyes in my cap."',
    '"Schrodinger first: write it out three times, neatly."', '"Diffusion is patience: every particle wanders, and the crowd spreads."', '"Hands up, not voices."'];

  /** A figure of a real asset in a card: ui/04-things.js paints its canvas (Hours.paint) and turns its frames. */
  const figHtml = (name, i, n) => `<figure class="real-fig" data-real="${name}" data-i="${i}" data-n="${n}"><canvas></canvas><figcaption></figcaption>`
    + (n > 1 ? '<p class="real-steps"><button type="button" data-real-step="-1">[&#9664;]</button> <button type="button" data-real-step="1">[&#9654;]</button></p>' : '') + '</figure>';
  const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const PHASE_NAMES = ['new', 'a waxing crescent', 'at first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'at last quarter', 'a waning crescent', 'new'];
  const RULERS = ['Saturn', 'Jupiter', 'Mars', 'the Sun', 'Venus', 'Mercury', 'the Moon']; // (Chaldean order, as in sky.js)
  /* ---- the astrolabe (the observatory's; its stars from the Bright Star Catalogue: _tools/fetch_astrolabe.py).
     The plate for the latitude of Paris: the sphere projected from the south pole onto the equator
     (stereographic), the tropic of Capricorn at its rim; the almucantars every 10 degrees of altitude,
     the horizon, the zenith. The rete over it, turned to the local sidereal time: the ecliptic ring, the
     star pointers (J2000, precessed to the date along the ecliptic, 50.29" a year). The Sun on the
     ecliptic, the rule through it to the hour on the limb. South up, east to the left, as on the instrument. ---- */
  const PARIS = [48.8566, 2.3522];
  function astrolabeDraw(cv, d) {
    const ab = realGet('astrolabe'); const N = 180; cv.width = N; cv.height = N;
    const g = cv.getContext('2d'); const im = g.createImageData(N, N); const C = N / 2; const R0 = N / 2 - 2; const R = R0 - 11;
    const n = d.getTime() / 864e5 + 2440587.5 - 2451545; const eps = 23.4393 * deg; const phi = PARIS[0];
    const lst = (((280.46061837 + 360.98564736629 * n + PARIS[1]) % 360) + 360) % 360; // (Meeus 12.4)
    const ga = (357.528 + 0.9856003 * n) * deg; const lam = (((280.46 + 0.9856474 * n + 1.915 * Math.sin(ga) + 0.02 * Math.sin(2 * ga)) % 360) + 360) % 360; // the Sun's longitude
    const eqOf = (l, b = 0) => { const L = l * deg; const B = b * deg; const y = Math.cos(B) * Math.sin(L) * Math.cos(eps) - Math.sin(B) * Math.sin(eps);
      return [((Math.atan2(y, Math.cos(B) * Math.cos(L)) / deg) + 360) % 360, Math.asin(Math.cos(B) * Math.sin(L) * Math.sin(eps) + Math.sin(B) * Math.cos(eps)) / deg]; };
    const eclOf = (ra, dec) => { const A = ra * deg; const D = dec * deg; const y = Math.cos(D) * Math.sin(A); const z = Math.sin(D);
      return [((Math.atan2(y * Math.cos(eps) + z * Math.sin(eps), Math.cos(D) * Math.cos(A)) / deg) + 360) % 360, Math.asin(z * Math.cos(eps) - y * Math.sin(eps)) / deg]; };
    const rp = (dec) => R * Math.tan(((90 - dec) / 2) * deg) / Math.tan(((90 + 23.4393) / 2) * deg);
    const at = (ra, dec) => { const H = (lst - ra) * deg; const r = rp(dec); return [r * Math.sin(H), r * Math.cos(H)]; }; // (x east-left, y south-up)
    const P = (name) => hex(DAYLIGHT[I[name]]);
    const put = (x, y, c, clip = R0) => { if (Math.hypot(x, y) > clip) return; const X = Math.round(C + x); const Y = Math.round(C - y); if (X >= 0 && Y >= 0 && X < N && Y < N) im.data.set([...c, 255], (Y * N + X) * 4); };
    const ring = (cx, cy, r, c, clip) => { const k = Math.max(24, Math.ceil(2 * Math.PI * r * 1.5)); for (let i = 0; i < k; i += 1) { const a = (i / k) * 2 * Math.PI; put(cx + r * Math.cos(a), cy + r * Math.sin(a), c, clip); } };
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) { const r = Math.hypot(x - C, y - C); if (r <= R0) im.data.set([...P(r > R ? 'GOLD' : 'GOLD_SH'), 255], (y * N + x) * 4); }
    for (let k = 0; k < 120; k += 1) { const a = (k / 120) * 2 * Math.PI; const l = k % 5 ? 3 : 7; for (let q = 0; q < l; q += 1) put((R0 - 1 - q) * Math.sin(a), (R0 - 1 - q) * Math.cos(a), P('GOLD_SH')); } // the limb: 24 hours, 12 minutes apiece
    const ink = P('OUTLINE'); ring(0, 0, rp(0), ink, R); ring(0, 0, rp(23.4393), ink, R); // the equator, the tropic of Cancer
    for (let h = 0; h < 90; h += 10) { // the almucantars
      const z = 90 - h; const ya = rp(phi - z); const yb = phi + z <= 90 ? rp(phi + z) : -rp(180 - phi - z);
      ring(0, (ya + yb) / 2, Math.abs(ya - yb) / 2, h ? ink : P('CLOTH'), R);
    }
    for (let q = -R; q <= R; q += 1) { put(0, q, ink, R); put(q, 0, ink, R); } // the meridian, the east-west line
    const zy = rp(phi); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => put(a, zy + b, P('CLOTH'))); // the zenith
    const brass = P('GOLD_HI'); ring(0, 0, R, brass, R0); // the rete: its rim, its ecliptic ring
    for (let l = 0; l < 360; l += 0.5) { const [x, y] = at(...eqOf(l)); put(x, y, brass, R); if (l % 30 === 0) { const [x2, y2] = at(...eqOf(l + 0.01)); put(x * 0.97, y * 0.97, brass, R); put(x2 * 1.03, y2 * 1.03, brass, R); } }
    const prec = (50.29 / 3600) * (n / 365.25); const up = [];
    (ab ? ab.stars : []).forEach(([name, , ra, dec]) => {
      const [l, b] = eclOf(ra, dec); const [ra2, dec2] = eqOf(l + prec, b); const [x, y] = at(ra2, dec2);
      const H = (lst - ra2) * deg; if (Math.sin(phi * deg) * Math.sin(dec2 * deg) + Math.cos(phi * deg) * Math.cos(dec2 * deg) * Math.cos(H) > 0) up.push(name);
      const r = Math.hypot(x, y); if (r > R) return; const ux = r ? x / r : 0; const uy = r ? y / r : 1;
      for (let q = 0; q < 5; q += 1) put(x - ux * q, y - uy * q, brass, R); put(x, y, P('CREAM'), R); // a pointer, its tip on the star
    });
    const [sra, sdec] = eqOf(lam); const [sx, sy] = at(sra, sdec); const sr = Math.hypot(sx, sy);
    for (let q = 0; q < R0 - 1; q += 0.7) put((sx / sr) * q, (sy / sr) * q, P('CREAM')); // the rule, through the Sun
    for (let a = -2; a <= 2; a += 1) for (let b = -2; b <= 2; b += 1) if (a * a + b * b <= 5) put(sx + a, sy + b, P('WIN_LIT'));
    g.putImageData(im, 0, 0);
    const Hs = (((lst - sra + 540) % 360) - 180) / 15; const sol = (Hs + 12 + 24) % 24; // the Sun's hour angle: the hour of the day by the Sun
    const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const hm = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    return `Set for Paris now. The rete stands at sidereal time ${hm(lst / 15)}; the Sun at ${Math.floor(lam % 30)}\u00b0 of ${SIGNS[Math.floor(lam / 30)]}, and the rule through it reads ${hm(sol)} by the Sun on the limb. Above the horizon (the red circle): ${up.length ? up.join(', ') : 'none of the rete\'s stars'}.`;
  }
  const escCard = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  /* How each real thing was brought into the castle (_tools/fetch_*.py, _tools/real.py), told at the
     foot of its card under its source in a line (index.json's first credit; the register has them all). */
  const METHOD = {
    heures: 'Resized with a Lanczos filter to 72 &times; 100, then each pixel mapped to the nearest colour of the castle\'s own palette in CIELAB (distances there look like distances), with Floyd&ndash;Steinberg error diffusion at 0.8 so gradients survive as grain. The lectern\'s page is the same at 12 &times; 16, undithered (at that size dither is noise). Each month also gives three colours, sky, green and earth, that the landscape leans towards.',
    licorne: 'Fitted into 64 &times; 56 (proportions kept, transparent margins) and mapped to the castle\'s palette, nearest colour in CIELAB with Floyd&ndash;Steinberg error diffusion. On the hall\'s wall each stitch is the commonest colour of a 2 &times; 2 block of that: a mode filter keeps the edges an average would muddy.',
    portraits: 'Cropped to head and shoulders, levels stretched (2% clipped at each end), Lanczos-resized and mapped to five sepia tones: Floyd&ndash;Steinberg dithered at 44 &times; 56 for this card, undithered at 11 &times; 14 on the wall.',
    mobilier: 'The engraving segmented: ink is whatever is darker than 170/255; dilated until its lines close, the white still connected to the border (a flood fill) is the background, the rest, holes filled and eroded back, is the piece. Box-averaged down to the room; a cell is a line where the ink is dense, else one of three tones of wood by the density of the hatching around it (its quantiles in the piece).',
    outils: 'Each figure found by labelling the plate\'s connected regions of ink; its silhouette is the paper the ink encloses (dilate the ink, flood the background in from the box\'s edge). Box-averaged to the rack, then three tones of iron or wood by the engraving\'s darkness (quantiles) and an outline.',
    melies: 'Two passages decoded with ffmpeg at 5 frames a second and 56 &times; 42, levels stretched frame by frame, four greys with an ordered (Bayer) dither like a lantern slide\'s grain; packed 2 bits a pixel and deflated. The browser inflates them with DecompressionStream and the hall plays them.',
    astrolabe: 'The stars\' J2000 positions and magnitudes read from the catalogue\'s fixed-width columns. The rest is drawn live: the sphere projected stereographically from the south pole onto the equator for 48.86&deg; N, the rete turned to the local sidereal time, each star precessed to today along the ecliptic (50.29&Prime; a year).',
    rose: 'The text split on its page markers (even pages the Old French, odd ones the translation); the verses are the indented lines, line numbers and footnote calls stripped. Stored as deflated JSON; the copyist\'s line is the minute since the epoch, modulo the book.',
  };
  function provenance(name, k = 0) { // k: which credit, where the asset has one per picture
    const c = ((realIndex || {})[name] || {}).credits || []; if (!c.length) return '';
    const x = c[Math.min(k, c.length - 1)]; const t = x.source ? `<a href="${escCard(x.source)}">${escCard(x.title)}</a>` : escCard(x.title);
    return `<p class="src dim">Source: ${t}${x.author ? `, ${escCard(x.author)}` : ''}${x.year ? ` (${escCard(x.year)})` : ''}.</p>`
      + (METHOD[name] ? `<details class="how"><summary>How it got here</summary><p>${METHOD[name]}</p></details>` : '');
  }
  const cards = {
    licorne: () => {
      const k = senseNow(); const why = k === 5 ? 'no sense has led this visit yet, so the sixth hangs here: the heart, or the giving up of the other five' : `this visit has gone mostly by ${['touch (your clicks)', 'taste (the village and its tavern)', 'smell (the fire, the hives, the orchard)', 'hearing (the castle\'s sounds)', 'sight (the watchtower, the photographs)'][k]}`;
      return `<h3>The lady and the unicorn</h3><p>Six tapestries, one for each sense and a sixth, <i>À mon seul désir</i>. The hall hangs the one for the sense you have used most: ${why}.</p>${figHtml('licorne', k, 6)}${provenance('licorne', k)}`;
    },
    astrolabe: () => '<h3>The astrolabe</h3><p>A flat model of the sky, as astronomers carried from al-Andalus to Chaucer\'s England: a plate engraved for one latitude, here Paris (the circles of equal altitude, the horizon), and over it the pierced rete, its pointers on the bright stars, turned as the sky turns. This one keeps itself set to the true sky.</p><figure class="astro-fig"><canvas class="astrolabe" width="180" height="180" aria-label="The astrolabe, set for now"></canvas><figcaption></figcaption></figure>' + provenance('astrolabe'),
    copyist: () => {
      const rz = real.rose;
      if (!rz || !rz.film) return '<h3>The copyist</h3><p>Bent over his page, he does not look up.</p>';
      rz.text ||= JSON.parse(new TextDecoder().decode(rz.film));
      const ms = clockFn().getTime(); const i = Math.floor(ms / 6e4) % rz.n; const sec = (ms / 1000) % 60;
      const side = i % 64; const folio = `${Math.floor(i / 64) + 1}${side < 32 ? 'r' : 'v'}`; const from = i - (side % 32);
      const line = (j) => { const t2 = rz.text.old[j]; return /^Ci /.test(t2) ? `<span class="rubric">${escCard(t2)}</span>` : escCard(t2); };
      const lines = []; for (let j = Math.max(from, i - 9); j < i; j += 1) lines.push(line(j));
      const cur = rz.text.old[i]; lines.push(`${escCard(cur.slice(0, Math.round(cur.length * sec / 60)))}<span class="quill">|</span>`);
      const pg = rz.pages.findIndex(([a, n]) => i >= a && i < a + n); const [a, n] = rz.pages[pg]; const tr = rz.text.new[pg];
      const j = Math.min(tr.length - 1, Math.round(((i - a) / n) * tr.length));
      const left = Math.round((rz.n - i) / 1440 * 10) / 10;
      return `<h3>The copyist</h3><p>He copies <i>Le Roman de la Rose</i> (Guillaume de Lorris, about 1230), a line each time his hourglass runs out, so a line a minute (the brothers take turns at the desk, day and night): folio ${folio}, line ${i + 1} of ${rz.n.toLocaleString('en')}. ${left >= 1 ? `${left} days more` : 'A few hours more'} and he will reach the end of the first book, and start again.</p>`
        + `<p class="rose-page">${lines.join('<br>')}</p><p class="dim">In the French of 1878, about there: <i>${escCard(tr[Math.max(0, j - 1)])} / ${escCard(tr[j])}</i></p>${provenance('rose')}`;
    },
    hours: () => { const m = today().getMonth(); return `<h3>The book of hours</h3><p>Open at this month. The landscape takes a little of its colours each month.</p>${figHtml('heures', m, 12)}<p class="dim">The arrows turn the pages.</p>${provenance('heures', m)}`; },
    kepler: () => '<h3>The cannonballs</h3><p>Stacked as greengrocers stack oranges: each layer sits in the hollows of the one below. Kepler guessed (1611) no packing of equal balls fills space better: &pi;/&radic;18, about 74%. It took until Hales (1998), with a computer, and a proof checked by machine in 2014 (Flyspeck), to be sure.</p><p>Ten balls here: 4 + 3 + 2 + 1, seen from the front, a tetrahedral pile of 1 + 3 + 6.</p>',
    fringes: () => '<h3>The arrow slit</h3><p>A slit so narrow that light coming through it spreads out. On sunny days its patch on the floor has a bright middle and faint bands at its sides, each colour at its own spacing, red widest: Fraunhofer diffraction, I(x) ~ sinc&sup2;(&pi;ax/&lambda;L), the bands &lambda;L/a apart.</p>',
    astroclock: () => {
      const d = clockFn(); const days = d.getTime() / 864e5 + 2440587.5 - 2451545.0;
      const lam = window.sunEcliptic ? window.sunEcliptic(days).lambda : 0; const mo = window.moon ? window.moon(d) : null; const ph = window.planetaryHour ? window.planetaryHour(d) : null;
      return '<h3>The astronomical clock</h3><p>A clock of the old kind, like those of Strasbourg or Prague, set for Paris. Its gilt sun goes round the 24-hour dial (noon at the top): '
        + `${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. The red mark on the inner ring is the sign the Sun is in: ${SIGNS[Math.floor(lam / 30) % 12]} (ecliptic longitude ${lam.toFixed(0)}&deg;).</p>`
        + (mo ? `<p>In the middle, the Moon, ${PHASE_NAMES[mo.phase]}, ${mo.age} days old.${ph ? ` This is the hour of ${RULERS[ph.hour]}, on the day of ${RULERS[ph.day]}.` : ''}</p>` : '');
    },
    slits: () => `<h3>Young's slits, one photon at a time</h3><p>A lamp so faint that one photon at a time crosses two slits to the screen. Each lands at one spot, at random; no single one interferes. Only the count shows the stripes: each photon went through both slits (Taylor 1909; Tonomura's electrons, 1989).</p><p>${slits ? slits.hits.length : 0} on the screen.</p>`,
    realm: (regions) => `<h3>The map of the realm</h3><p>Each project, a region of its own; a road from one to the next where they share a method.</p><ul>${regions.map((r) => `<li>${r}</li>`).join('')}</ul>`,
    galton: () => {
      const g = galton; const tot = g ? g.bins.reduce((a, v) => a + v, 0) : 0;
      const C = (n, k) => { let c = 1; for (let j = 0; j < k; j += 1) c = (c * (n - j)) / (j + 1); return c; };
      return '<h3>The Galton board</h3><p>Each ball meets a peg at every row and goes left or right, even odds. The bins fill as the binomial law says, and, for many rows, as the bell curve: the central limit theorem, in beech and lead shot.</p>'
        + (g && tot ? `<p>This run: ${g.bins.join(' &middot; ')} (expected, out of ${tot}: ${g.bins.map((_, k) => ((tot * C(g.rows, k)) / 2 ** g.rows).toFixed(1)).join(' &middot; ')}).</p>` : '');
    },
    life: () => `<h3>The game of life</h3><p>On this board each square lives or dies by its eight neighbours: born with three, surviving with two or three (Conway, 1970). A random soup boils down to blocks, blinkers and gliders; when it settles, a new soup is poured.</p><p>Generation ${life ? life.gen : 0}, ${life ? life.g.reduce((a, v) => a + v, 0) : 0} alive.</p>`,
  };
  function loomCard() {
    const lm = loom; const T = loomT(); const t = weather.temp;
    const m = Math.abs(lm.s.reduce((a, v) => a + v, 0)) / lm.s.length;
    const phase = T < 0.9 * TC ? 'Below it one colour wins and wide patches form: a cold day.'
      : T > 1.1 * TC ? 'Above it the colours mix into a fine noise: a warm day.'
        : 'Near it there are patches of every size, the weave is critical: a mild day.';
    return '<h3>The weaver\'s loom</h3><p>Each stitch of this tapestry is a spin, red or blue, that would rather match its four '
      + `neighbours, while the heat shakes it loose: the Ising model, woven live by the Metropolis rule (${lm.sweeps} sweeps so far).</p>`
      + `<p>The loom keeps the temperature of Paris: ${t == null ? 'no reading today, so it holds the critical point' : `${t}&nbsp;°C outside`}, `
      + `so T&nbsp;=&nbsp;${T.toFixed(2)}, against the critical T<sub>c</sub>&nbsp;=&nbsp;2.27 (Onsager, 1944). ${phase}</p>`
      + `<p>Magnetisation |m|&nbsp;=&nbsp;${m.toFixed(2)}.</p>`;
  }
  /** The wind across the screen, +x to the right: we look south, so east is on the left and a
   *  west wind (dir 270, where it comes from) pushes things left. About -1..1 for 0..30 km/h. */
  const windX = () => Math.sin((weather.dir ?? 270) * Math.PI / 180) * clamp(weather.wind / 30, 0.1, 1.5);
  const qBolt = new URLSearchParams(location.search).has('bolt');
  /** Seconds from the flash to the thunder: in truth ~3 s a km (343 m/s), here squeezed to under 3 s,
   *  so the two still belong together; nearer, sooner. */
  const thunderDelay = (km) => 0.15 + km * 0.65;
  const WET = { drizzle: 0.35, showers: 0.7, rain: 1, storm: 1.4 }; // rain: drops, relative
  /** Snow lying, 0..1: the real depth (12 cm and more covers all), a light cover while it snows. */
  const snowCover = () => Math.max(clamp((weather.snowDepth ?? 0) / 0.12), weather.kind === 'snow' ? 0.35 : 0);
  /** How wet the ground is, 0..1: raining now, else drying over the twelve hours since it last rained. */
  /** The ants are out on warm dry days. */
  /** Now and then the wizard reads (14 s in 45; always with ?read, for previews). */
  const qRead = new URLSearchParams(location.search).has('read');
  const wizardReads = (t) => qRead || (forced.read || 0) > t || (!reduce && t % 45 > 26 && t % 45 < 40);
  const antsOut = () => (forced.ants || 0) > now() || (weather.temp ?? 15) >= 10 && scene.season !== 'winter' && look.night < 0.3 && !WET[weather.kind] && snowCover() < 0.2;
  /** The copyist works late in the scriptorium: from dusk to one in the morning, his window lit. */
  const scribeLate = () => { const h = clockFn().getHours(); return look.night > 0.2 && (h >= 16 || h < 1); };
  const wetness = () => (WET[weather.kind] ? 1 : clamp(1 - (weather.dryH ?? 99) / 12));
  let clockFn = () => new Date(); // the instant the sky shows (assets/js/ui: now, or a previewed hour)
  // meteor showers: [month (0-11), day of peak, ZHR, half-width in days]; IMO calendar, rounded
  const SHOWERS = [[0, 3, 110, 0.6], [3, 22, 18, 1], [4, 6, 50, 4], [7, 12, 100, 4], [9, 8, 10, 0.5],
    [9, 21, 20, 3], [10, 17, 15, 1], [11, 14, 150, 1.5]];
  /** The day the landscape keeps: today (the sky's instant), or ?date=MM-DD for a preview. */
  function today() {
    const q = /^(\d\d)-(\d\d)$/.exec(new URLSearchParams(location.search).get('date') || '');
    const d = clockFn();
    return q ? new Date(d.getFullYear(), Number(q[1]) - 1, Number(q[2]), d.getHours(), d.getMinutes()) : d;
  }
  const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); // 1 Jan = 1
  /** Market days in the hamlet: Wednesday, Friday, Saturday and Sunday. */
  const marketDay = (d) => [0, 3, 5, 6].includes(d.getDay());
  /** The festival kept on day d, if any: [name, its line for the message bar]. */
  function festival(d) {
    const m = d.getMonth() + 1; const day = d.getDate(); const md = m * 100 + day;
    if (md >= 1030 && md <= 1101) return ['samhain', 'All Hallows: the hamlet has carved its pumpkins.'];
    if (md === 621) return ['music', 'Midsummer and the feast of music: a minstrel has joined the fire.'];
    if (md >= 623 && md <= 624) return ['stjohn', "Saint John's Eve: fires burn on the hills tonight."];
    if (md === 714) return ['fireworks', 'The fourteenth of July: fireworks over the castle tonight.'];
    if (md === 1231 || md === 101) return ['fireworks', 'The year turns: fireworks over the castle tonight.'];
    if (md >= 1224 && md <= 1226) return ['christmas', 'Christmas: a star shines over the chapel.'];
    if (m === 12) return ['advent', 'Advent: lights along the eaves of the hamlet.'];
    if (md === 401) return ['april', "The first of April. Look at the knight's back."];
    if (md === 501) return ['may', 'The first of May: lily of the valley by the fire.'];
    return null;
  }

  /** Meteors an hour under a dark sky on date d: the showers near their peak, plus ~6 sporadic. */
  function meteorRate(d) {
    if (new URLSearchParams(location.search).has('meteors')) return 150; // preview
    return 6 + SHOWERS.reduce((a, [m, day, zhr, w]) => {
      const peak = new Date(d.getFullYear(), m, day); const dd = (d - peak) / 864e5;
      return a + zhr * Math.exp(-((dd / w) ** 2));
    }, 0);
  }
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  // on, as the castle theme (the tower on narrow screens) or as the narrow terminal's banner (the landscape only)
  const banner = () => root.getAttribute('data-theme') !== 'hours' && root.classList.contains('banner');
  const isOn = () => root.getAttribute('data-theme') === 'hours' || root.classList.contains('banner');
  const SCENE_LABEL = 'Pixel-art landscape under the sky over Paris at this hour: a castle with an observatory on a '
    + 'rock above a river, mountains and a forest; in front, a knight resting by a bonfire with a sword driven '
    + 'into its coals, and a wizard with a glowing staff, in tall grass.';

  const shift = (rate) => Math.round(-par * rate * PARALLAX);
  /** The meadow's slide at row y: the hill's at its top, the foreground's near the bottom. */
  const groundOff = (y) => shift(RATE[L.MID] + (GROUND_END - RATE[L.MID]) * clamp((y - scene.yg) / (scene.H - scene.yg)));
  const planeOff = (l, y) => (l === L.GROUND ? groundOff(y) : shift(RATE[l]));

  function project(v) {
    const { W, H, Ws, yHor } = scene;
    const phi = Math.atan2(v[0], -v[1]); // from south, east positive
    const alt = Math.asin(clamp(v[2], -1, 1));
    const mid = Math.min(W, Ws) / 2; // south sits over the middle of the visible stage
    return [mid - (phi / (75 * deg)) * mid, yHor - (alt / (62 * deg)) * (yHor - Math.max(4, 0.06 * H)), alt];
  }

  /** Which eclipse is on and visible from Paris, if any (sky.js gives the geometry). */
  function eclipseNow(sky) {
    if (sky.solar.sep < sky.solar.touch && sky.sun[2] > -0.01) return 'solar';
    if (sky.lunar.sep < sky.lunar.umbra + sky.lunar.moonR && sky.moon[2] > -0.01) return 'lunar';
    return null;
  }
  /** Fraction of the Sun's diameter covered (the eclipse's magnitude, 0..1). */
  const solarCover = (sky) => clamp((sky.solar.touch - sky.solar.sep) / (2 * sky.sunR));
  const PLANET_LOOK = { Mercury: [[200, 190, 170], 0], Venus: [[255, 252, 230], 2], Mars: [[240, 140, 100], 1], Jupiter: [[250, 236, 200], 2], Saturn: [[236, 214, 150], 1] };

  function relight() {
    const sky = skyFn();
    const elong0 = Math.acos(clamp(sky.sun[0] * sky.moon[0] + sky.sun[1] * sky.moon[1] + sky.sun[2] * sky.moon[2], -1, 1));
    const moonlit = ((1 - Math.cos(elong0)) / 2) * clamp(sky.moon[2] / Math.sin(25 * deg)); // phase x height
    look = paletteAt(Math.asin(sky.sun[2]) / deg, moonlit);
    pal32 = look.pal.map(pack);
    backKey = ''; // new colours: compose the still planes again
    planeColour = scene.planes.map((p) => {
      const c = new Uint32Array(p.length);
      for (let i = 0; i < p.length; i += 1) if (p[i] !== CLEAR) c[i] = pal32[p[i]];
      return c;
    });
    bakeGround();
    const ik = 0.62 * (1 - 0.45 * look.night); // (the rooms dark and bluer by night: the candles carry them)
    ipal32 = NAMES.map((_n, i) => (i < N_SKY ? pal32[i] : pack(hex(DAYLIGHT[i]).map((c, j) => c * ik * (j === 2 ? 1 + 0.2 * look.night : 1)))));
    if (interior) lightInterior();
    const sun = project(sky.sun); const moon = project(sky.moon);
    const elong = Math.acos(clamp(sky.sun[0] * sky.moon[0] + sky.sun[1] * sky.moon[1] + sky.sun[2] * sky.moon[2], -1, 1));
    const d = [sun[0] - moon[0], sun[1] - moon[1]]; const n = Math.hypot(...d) || 1;
    bodies = { sun, moon, light: [(d[0] / n) * Math.sin(elong), (d[1] / n) * Math.sin(elong), -Math.cos(elong)], sky,
      planets: sky.planets.map((p) => ({ ...p, at: project(p.v) })), anti: project(sky.sun.map((c) => -c)) };
    const ecl = eclipseNow(sky);
    if (ecl && ecl !== lastEclipse) say(ecl === 'solar' ? `An eclipse of the Sun over Paris: the Moon covers ${Math.round(100 * solarCover(sky))}% of its disc.`
      : 'An eclipse of the Moon: it passes through the Earth\'s shadow and turns the colour of copper.');
    lastEclipse = ecl;
  }

  /** What lies on the land: the real snow (its depth), puddles after rain (they shrink as the hours
   *  pass dry). Baked into the planes' colours at each relight (once a minute, and when the weather
   *  changes), so it costs nothing a frame. */
  function bakeGround() {
    const { WE, planes } = scene; const snow = snowCover();
    if (snow > 0) {
      const lit = pal32[I.SNOW]; const sh = pal32[I.SNOW_SH];
      [L.TREES, L.MID, L.GROUND, L.FG].forEach((l) => {
        const p = planes[l]; const col = planeColour[l];
        for (let i = WE; i < p.length; i += 1) {
          const c = p[i]; const g = SNOWS[c]; if (!g || c === CLEAR) continue;
          const x = i % WE; const y = (i - x) / WE;
          const b = g === 2 ? bayer(x, y) : (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 997) / 997; // (lying snow: speckled, not a grid)
          let on;
          if (g === 1) on = b < snow * 1.25;
          else if (g === 3) on = b < snow * 0.7;
          else {
            const top = (j) => j < 0 || p[j] === CLEAR || SNOWS[p[j]] !== 2; // nothing that holds snow above
            on = top(i - WE) ? b < 0.35 + snow : snow > 0.45 && top(i - 2 * WE) && b < snow - 0.3;
          }
          if (on) col[i] = SNOWDARK[c] ? sh : lit;
        }
      });
    }
    const wet = wetness();
    if (wet > 0 && snow < 0.2) {
      const frozen = (weather.temp ?? 9) <= 0; const col = planeColour[L.GROUND];
      const skyC = unpack(pal32[3]); const water = unpack(pal32[I.WATER]);
      scene.puddles.forEach((q) => {
        if (q.q > wet) return;
        const edge = q.q > wet * 0.7;
        col[q.i] = frozen ? pal32[edge ? I.SNOW_SH : I.SNOWFIELD] : pack(mix(skyC, water, edge ? 0.7 : 0.3).map((v) => v * (edge ? 0.8 : 1)));
      });
    }
  }

  /** The stage: the part of the plate left of the text column (full-page layout), else all of it. */
  function stageWidth(r, W) {
    if (getComputedStyle(plate.parentElement).position !== 'fixed') return W;
    const term = document.querySelector('.term').getBoundingClientRect();
    const Ws = Math.floor((term.left - r.left) / px) - 2;
    return Ws < 110 ? W : Ws;
  }

  let plateRect = null; let wizPx = null;
  function anchorMenu(r = plateRect) { // the top of the wizard's hat, in viewport pixels
    plateRect = r;
    const x = Math.round(r.left + (scene.wizard.x - scene.M + groundOff(scene.fire.y) + WIZ_HEAD_X) * px);
    if (x === wizPx) return;
    wizPx = x;
    root.style.setProperty('--wiz-x', `${x}px`);
    root.style.setProperty('--wiz-y', `${Math.round(r.top + scene.wizard.y * px)}px`);
  }

  function resize() {
    const r = plate.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    // ~200 scene rows whatever the screen, so the watchers keep their size; integer scales, even
    // from 4 up, so the interface's pixels (--upx, half as big) stay on the same grid
    const raw = r.height / 200;
    px = raw < 1.5 ? 1 : raw < 2.5 ? 2 : raw < 3.5 ? 3 : raw < 5 ? 4 : raw < 7 ? 6 : 8; // (1: a phone's banner, 11rem tall)
    root.style.setProperty('--px', `${px}px`);
    root.style.setProperty('--upx', `${Math.max(2, Math.round(px / 2))}px`);
    const W = Math.ceil(r.width / px); const H = Math.ceil(r.height / px);
    const Ws = stageWidth(r, W);
    if (scene && scene.W === W && scene.H === H && scene.Ws === Ws) { wizPx = null; anchorMenu(r); if (view.state === 'room') publishSpots(true); return false; }
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    obuf = new Uint32Array(img.data.buffer);
    buf = new Uint32Array(W * H); fbuf = null; // (the room's own buffers are RW x RH: start)
    backBuf = new Uint32Array(W * H); backIdx = new Uint8Array(W * H); backKey = '';
    idxNow = new Uint8Array(W * H);
    const hoisted = scene && scene.hoist;
    scene = generate(W, H, Ws);
    if (hoisted || pendingHoist) { scene.hoist = { t0: -99 }; pendingHoist = false; }
    wizPx = null;
    anchorMenu(r);
    layoutRoom();
    if (view.id) { interior = makeInterior(view.id); hl = -1; }
    relight();
    if (view.state === 'room') publishSpots(true);
    for (let k = 0; k < 40; k += 1) stepFire(); // a lit fire from the first frame
    for (let k = 0; k < 90; k += 1) fluidStep(scene.fluid, 0.5, windX()); // and its smoke already up
    return true;
  }

  /** Demo-scene fire: each cell is the smoothed cell below it (shifted by the wind) less a random
   *  cooling, stronger towards the edges so the flame tapers. */
  function stepFire() { stepCells(scene.cells, scene.fw, scene.fh); }
  function stepCells(cells, fw, fh, heat = 1) {
    const p = (FIRE_MAX + 1) / (fh * 0.8);
    const wind = Math.sin(performance.now() / 700) * 0.6;
    for (let x = 0; x < fw; x += 1) {
      const e = Math.abs((2 * x) / (fw - 1) - 1);
      cells[(fh - 1) * fw + x] = (FIRE_MAX + 0.9) * (1 - e * e) * (0.75 + 0.25 * Math.random()) * heat;
    }
    const at = (x, y) => cells[y * fw + clamp(x, 0, fw - 1)];
    for (let y = 0; y < fh - 1; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const sx = x + Math.round(wind + Math.random() - 0.5);
        const c = (at(sx - 1, y + 1) + 2 * at(sx, y + 1) + at(sx + 1, y + 1)) / 4;
        const e = Math.abs((2 * x) / (fw - 1) - 1);
        cells[y * fw + x] = Math.max(0, c - p * Math.random() * 2 * (1 + 1.6 * e * e));
      }
    }
  }

  /** Copy plane l into the frame at its parallax offset (row by row: the meadow is sheared). */
  function composite(l) {
    const { W, WE, M, planes, rows } = scene;
    const src = planes[l]; const col = planeColour[l];
    const [y0, y1] = rows[l];
    let off = planeOff(l, y0);
    for (let y = y0; y < y1; y += 1) {
      if (l === L.GROUND) off = groundOff(y);
      const from = y * WE + M - off; const to = y * W;
      for (let x = 0; x < W; x += 1) {
        const i = src[from + x];
        if (i !== CLEAR) { buf[to + x] = col[from + x]; idxNow[to + x] = i; }
      }
    }
  }

  /** Mix buf[i] towards (r, g, b) by a (0..1), integer maths: it runs over the whole frame. */
  function tint(i, r, g, b, a) {
    const v = buf[i]; const k = Math.round(a * 256); const j = 256 - k;
    buf[i] = 0xff000000 | ((((v >> 16) & 255) * j + b * k) >> 8) << 16 | ((((v >> 8) & 255) * j + g * k) >> 8) << 8 | (((v & 255) * j + r * k) >> 8);
  }
  /** Overcast: a grey veil over the sky, hiding sun and stars as the cover closes. */
  function skyVeil() {
    const wet = WET[weather.kind];
    const a = clamp((weather.cover - 0.5) * 2) * (wet || weather.kind === 'snow' || weather.kind === 'fog' ? 0.92 : 0.7);
    if (a <= 0) return;
    const g = look.night > 0.5 ? [36, 40, 52] : wet ? [112, 118, 130] : [166, 170, 178];
    const { W, yl0 } = scene;
    for (let y = 0; y < yl0; y += 1) for (let x = 0; x < W; x += 1) { const i = y * W + x; if (idxNow[i] < N_SKY) tint(i, g[0], g[1], g[2], a); }
  }
  /** Fog: far things fade first; rain dims the whole land a little. */
  function landVeil() {
    const { W, H, yl0 } = scene;
    const fog = weather.kind === 'fog'; const wet = WET[weather.kind] || 0;
    if (!fog && !wet && weather.kind !== 'snow') return;
    const c = look.night > 0.5 ? [52, 56, 68] : fog ? [196, 200, 204] : [120, 128, 140];
    for (let y = 0; y < H; y += 1) {
      const far = clamp(1 - (y - yl0 * 0.6) / (H - yl0 * 0.6)); // 1 up to the far hills, 0 at the bottom
      const a = fog ? 0.12 + 0.6 * far : (0.06 + 0.12 * far) * Math.max(wet, 0.5);
      for (let x = 0; x < W; x += 1) { const i = y * W + x; if (idxNow[i] >= N_SKY) tint(i, c[0], c[1], c[2], fog ? a * (1 - fogAt(x, y)) : a); }
    }
    if (fogClear) for (let k = 0; k < fogClear.length; k += 1) fogClear[k] *= 0.985; // (it closes in again)
  }
  /** Rain streaks or snowflakes, in front of everything; a lightning flash in a storm. */
  function precipitation(put, blend) {
    const k = weather.kind;
    if (WET[k]) {
      const c = look.night > 0.5 ? [130, 145, 170] : [226, 234, 246]; const slant = clamp(windX() * 0.75, -1, 1);
      const n = Math.round(scene.drops.length * Math.min(1, WET[k] / 1.4));
      const sh = scene.shelter; const dry = (x, y) => sh && x >= sh.xl && x <= sh.xr + 1 && y > sh.top(x) && y < scene.fire.y + 6;
      for (let j = 0; j < n; j += 1) { const d = scene.drops[j]; for (let q = 0; q < 5; q += 1) if (!dry(Math.round(d.x - q * slant * 0.5), Math.round(d.y - q))) blend(d.x - q * slant * 0.5, d.y - q, c, 0.75 - q * 0.12, false); }
    } else if (k === 'snow') {
      const c = pack([240, 244, 250]);
      scene.drops.forEach((d, j) => { if (j % 2 === 0) put(d.x + Math.sin(now() * 0.8 + d.ph) * 2, d.y, c, false); });
    }
    if (scene.flash > 0) for (let i = 0; i < buf.length; i += 1) tint(i, 236, 240, 255, 0.28 * scene.flash);
  }

  /* ---- the village, close up: the camera eases in on the hamlet (an integer zoom Z once there,
     the background's pixels Z times bigger), and the market is drawn again over it at the canvas's
     own pixel size: stalls, vendors and villagers with faces, hats and baskets. ---- */
  let zoom = null; // { on, t0, done, vx, vy, Z }
  const ZOOM_S = 0.7;
  const backBtn = document.createElement('button');
  backBtn.type = 'button'; backBtn.className = 'village-back'; backBtn.textContent = '[step back · Esc]';
  backBtn.addEventListener('click', () => zoomTo(false));
  function zoomTo(on) {
    if (on && banner()) return;
    if (!scene || (on && zoom && zoom.on) || (!on && !zoom)) return;
    zoom = { on, t0: now() - (zoom && !reduce ? Math.max(0, ZOOM_S - (now() - zoom.t0)) : 0), done: false };
    if (on) { parTarget = 0; if (!backBtn.isConnected) document.body.append(backBtn); }
    root.classList.toggle('village', on);
    if (!running && isOn()) render(now());
  }
  // the village's shop signs, after those Atget photographed (_tools/fetch_atget.py, same order): a ground, a 5 x 4 emblem
  const SIGN_INK = { G: 'GOLD', W: 'FL_WHITE', I: 'OUTLINE', S: 'STONE_HI', Y: 'FL_YEL', B: 'T_AZURE', R: 'CLOTH' };
  const SHOP_SIGNS = [
    ['CLOTH', ['.GG.G', 'GGGG.', '.GGG.', 'G..G.']], // Au Griffon
    ['T_AZURE', ['W..W.', 'WW.WW', '.W..W', '.....']], // Aux deux Pigeons
    ['CREAM', ['IIIII', 'I...I', 'SSSSS', 'SBBBS']], // Au Bon Puits
    ['GRASS_HI', ['.Y...', 'YYY.Y', '.YYYY', '..YY.']], // Aux Canettes
    ['CREAM', ['..I..', '.III.', 'I.I.I', '.III.']], // À l'Ancre
    ['T_AZURE', ['GGGGG', 'G.G.G', 'GGGGG', '.GGG.']], // a lion's head
    ['CLOTH', ['G..G.', 'GGGGG', '.GGGG', '.G..G']], // Au Lion d'Or
    ['CREAM', ['..I..', '.III.', '..I..', '.I.I.']], // a carved figure
  ];
  /** The view: the hamlet and the bank of the market, centred; Z the zoom that fits them. */
  function villageFrame() {
    const { W, H, hamlet: hm, M } = scene;
    // the market and the bank's last houses at Z = 3 (4 on a narrow plate); the arrow keys pan along
    const Z = W < 300 ? 4 : 3; const a = hm.x0 - 6; const b = hm.x1 + 34; const half = W / Z / 2;
    const xm = clamp(hm.x1 - 8 + (zoom ? zoom.pan || 0 : 0), a + half, b - half);
    if (zoom) zoom.pan = xm - (hm.x1 - 8);
    const xc = xm - M + shift(RATE[L.MID]);
    return { Z, xc, yc: scene.riverTop(hm.x1) - 16, W, H }; // (the village, and a strip of the river)
  }
  function zoomed(t) {
    const { Z, xc, yc, W, H } = villageFrame();
    const e = reduce ? 1 : clamp((t - zoom.t0) / ZOOM_S); const k = e * e * (3 - 2 * e);
    if (!zoom.on && e >= 1) { zoom = null; obuf.set(buf); backBtn.remove(); return; }
    const z = zoom.on ? 1 + (Z - 1) * k : Z - (Z - 1) * k;
    zoom.done = zoom.on && e >= 1;
    const vw = W / z; const vh = H / z;
    const vx = Math.round(clamp(xc - vw / 2, 0, W - vw)); const vy = Math.round(clamp(yc - vh / 2, 0, H - vh));
    for (let y = 0; y < H; y += 1) {
      const row = Math.min(H - 1, Math.floor(vy + y / z)) * W;
      for (let x = 0; x < W; x += 1) obuf[y * W + x] = buf[row + Math.min(W - 1, Math.floor(vx + x / z))];
    }
    Object.assign(zoom, { vx, vy, Z, z });
    if (zoom.done) villageView(t);
  }
  function villageView(t) {
    const { W, H, M } = scene; const { vx, vy, Z } = zoom; const lm = shift(RATE[L.MID]) - M;
    const d = today(); const market = marketDay(d) && look.night < 0.3;
    const ox = (X) => (X + lm - vx) * Z; const oy = (Y) => (Y - vy) * Z;
    const P = (n) => pal32[I[n]];
    const shade = (c, a) => pack(mix(unpack(c), [0, 0, 0], a));
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) obuf[y * W + x] = c; };
    const blend = (x, y, rgb, a) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) obuf[y * W + x] = pack(mix(unpack(obuf[y * W + x]), rgb, a)); };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) put(x + i, y + j, c); };
    function person(cx, feet, f, still) { // 5 x 12, cx its middle column
      const hair = [P('HAT'), P('FL_WHITE'), P('BEARD'), P('TIMBER'), P('OUTLINE'), P('RUST_SH')][f.k % 6];
      const coat = pal32[f.c]; const dark = shade(coat, 0.3); const top = feet - 11; const x0 = cx - 2;
      const dir = f.dir || 1; const walk = !still && Math.floor(t * 6 + f.k) % 2;
      rect(x0 + 1, top, 3, 1, hair); rect(x0 + (f.k % 6 === 0 ? 0 : 1), top + 1, f.k % 6 === 0 ? 5 : 3, 1, hair); // hat brim or hair
      rect(x0 + 1, top + 2, 3, 3, P('SKIN')); put(x0 + (dir > 0 ? 3 : 1), top + 3, P('OUTLINE'));
      if (f.k % 6 === 1) { put(x0 + 1, top + 2, hair); put(x0 + 3, top + 2, hair); } // a coif
      rect(x0 + 1, top + 5, 3, 1, coat); rect(x0, top + 6, 5, 3, coat); rect(x0 + 1, top + 9, 3, 1, coat);
      put(x0, top + 6, dark); put(x0, top + 7, dark); put(x0 + 4, top + 6, dark); put(x0 + 4, top + 7, dark); // the arms
      put(x0 + (dir > 0 ? 4 : 0), top + 8, P('SKIN')); // a hand
      const leg = P('CLOAK_SH');
      put(x0 + 1 + (walk ? 0 : 0), feet - 1, leg); put(x0 + 3, feet - 1, leg);
      put(x0 + 1 - (walk ? 1 : 0), feet, leg); put(x0 + 3 + (walk ? 1 : 0), feet, leg);
      if (f.k % 3 === 0) { const bx = dir > 0 ? x0 + 5 : x0 - 2; rect(bx, top + 7, 2, 2, P('TIMBER_HI')); put(bx + (dir > 0 ? 0 : 1), top + 6, P('TIMBER_SH')); } // a basket
    }
    { // the hills and woods behind the roofs, hazed with distance: magnified as they are, they would stand as close as the houses
      const roof = oy(Math.min(...scene.hamlet.eaves.map((e) => e[2])) - 7); const haze = unpack(pal32[4]);
      for (let y = 0; y < Math.min(H, roof); y += 1) { const a = 0.18 + 0.4 * clamp((roof - y) / roof); for (let x = 0; x < W; x += 1) obuf[y * W + x] = pack(mix(unpack(obuf[y * W + x]), haze, a)); }
    }
    const x0 = scene.hamlet.x1 + 1; const mk = market ? marketOf(d.getHours()) : { folk: [], m: [], N: 0, x0: 0 };
    if (market) [[0, I.FLAG, mk.wares[0]], [9, I.FLAG2, mk.wares[1]]].forEach(([dx, c, kind], s) => {
      const X = x0 + dx; const L0 = ox(X); const Y = scene.riverTop(X) - 3; const w = 7 * Z;
      const ground = oy(Y) + Z - 1; const counter = oy(Y - 2); const aw = oy(Y - 6);
      // the vendor, behind the counter, turning now and then
      person(L0 + Math.round(w / 2), counter + 6, { k: 4 + s * 3, c: s ? I.FLAG2 : I.RUST, dir: Math.sin(t * 0.4 + s * 2) > 0 ? 1 : -1 }, true);
      rect(L0 + Math.round(w / 2) - 2, counter - 2, 5, 2, P('FL_WHITE')); // the apron's bib
      rect(L0, aw + 2 * Z, 2, ground - aw - 2 * Z + 1, P('TIMBER_SH')); rect(L0 + w - 2, aw + 2 * Z, 2, ground - aw - 2 * Z + 1, P('TIMBER_SH')); // the poles
      for (let i = 0; i < 7; i += 1) { // the awning, a scallop under each stripe
        const col = i % 2 ? pal32[c] : P('FL_WHITE');
        rect(L0 + i * Z, aw, Z, 2 * Z, col);
        rect(L0 + i * Z + 1, aw + 2 * Z, Z - 2, 1, col); if (Z > 3) rect(L0 + i * Z + 2, aw + 2 * Z + 1, Z - 4, 1, col);
      }
      for (let i = 0; i < w; i += 1) put(L0 + i, aw, shade(obuf[Math.max(0, aw) * W + Math.max(0, Math.min(W - 1, L0 + i))], 0.25));
      rect(L0 - 1, counter, w + 2, Z, P('TIMBER')); rect(L0 - 1, counter, w + 2, 1, P('TIMBER_HI')); // the counter
      rect(L0 + 1, counter + Z, 1, ground - counter - Z + 1, P('TIMBER_SH')); rect(L0 + w - 2, counter + Z, 1, ground - counter - Z + 1, P('TIMBER_SH'));
      for (let i = 0; i < 4; i += 1) { // the wares
        const wx = L0 + 2 + i * Math.floor((w - 4) / 4);
        if (kind === 'bread') { rect(wx, counter - 2, 4, 2, P('GOLD_SH')); rect(wx + 1, counter - 2, 2, 1, P('TIMBER_HI')); }
        else if (kind === 'fish') { rect(wx, counter - 1, 4, 1, P('ARM_HI')); put(wx + 4, counter - 2, P('ARM_SH')); put(wx + 4, counter, P('ARM_SH')); put(wx + 1, counter - 2, P('ARM')); }
        else if (kind === 'cheese') { rect(wx, counter - 2, 3, 2, P('WHEAT')); put(wx + 1, counter - 3, P('WHEAT_SH')); put(wx + 2, counter - 1, P('FL_WHITE')); }
        else if (kind === 'fruit') { put(wx, counter - 1, P('FL_RED')); put(wx + 1, counter - 1, P('RUST_HI')); put(wx + 2, counter - 1, P('FL_RED')); put(wx + 1, counter - 2, P('FL_YEL')); }
        else if (kind === 'flowers') { put(wx + 1, counter - 1, P('GRASS_HI')); put(wx, counter - 3, P(['FL_RED', 'FL_BLUE', 'FL_YEL', 'FL_VIOLET'][i])); put(wx + 1, counter - 4, P(['FL_YEL', 'FL_RED', 'FL_WHITE', 'FL_BLUE'][i])); put(wx + 2, counter - 3, P('FL_WHITE')); }
        else rect(wx, counter - 3, 3, 3, [P('FLAG'), P('FL_YEL'), P('GRASS_HI'), P('FLAG2')][i]);
      }
    });
    if (market && scene.marketShow > t) mk.m.forEach((v, k) => { // the equilibrium density, a bar per place
      const X = mk.x0 + k; const base = oy(scene.riverTop(X) - 10);
      for (let j = 0; j < Math.round(v * mk.N * 1.5 * Z); j += 1) for (let i = 0; i < Z - 1; i += 1) blend(ox(X) + i, base - j, [255, 244, 214], 0.55);
    });
    const at = real.atget; zoom.signs = []; // the shop signs Atget photographed in old Paris, one on an iron bracket by each house's door
    const front = scene.hamlet.doors.filter(([, Y]) => Y >= Math.max(...scene.hamlet.doors.map((q) => q[1])) - 3); // (the row along the bank: the back row's would hang over its roofs)
    const tv0 = scene.hamlet.places.tavern; const eaves = scene.hamlet.eaves; let ks = 0;
    const shops = front.filter(([X]) => !(tv0 && X >= tv0.x && X < tv0.x + tv0.w)); const carto = shops[shops.length - 1]; // (the last house on the bank: the cartographer's, the map room over it)
    if (at) front.forEach(([X, Y]) => { // a small painted board with the sign's emblem, out from the wall's corner on an iron arm, as signs hang across a street
      const isCarto = carto && X === carto[0] && Y === carto[1];
      if (!isCarto && (ks >= SHOP_SIGNS.length || ks >= at.captions.length || (tv0 && X >= tv0.x && X < tv0.x + tv0.w))) return; // (the tavern has its own sign)
      const e = eaves.filter((q) => X > q[0] && X < q[1] && q[2] < Y && Y - q[2] < 16).sort((p, q) => q[2] - p[2])[0]; if (!e) return;
      const k = isCarto ? 'maps' : ks; if (!isCarto) ks += 1;
      const free = (x0, x1) => !eaves.some((q) => q !== e && q[2] > e[2] - 6 && q[0] < x1 && q[1] > x0); // (no house there, at that height)
      const left = free(e[0] - 3, e[0] + 1) || !free(e[1], e[1] + 4); // the door's side (left) unless a neighbour stands against it
      const [ground, rows] = isCarto ? ['CREAM', ['..R..', '.RGR.', 'RGGGR', '.RGR.']] : SHOP_SIGNS[k]; const w = 7; const h = 6; const arm = w + 2; // (the cartographer's: a compass rose)
      const wx = left ? Math.round(ox(e[0] + 1)) : Math.round(ox(e[1])); const ay = Math.round(oy(e[2] + 1)) + 1; // the wall's corner, under the eaves
      const ax0 = left ? wx - arm : wx; const sx = left ? wx - arm : wx + 2; const sy = ay + 2;
      rect(ax0, ay, arm, 1, P('ARM_SH')); put(left ? wx - 1 : wx, ay + 1, P('ARM_SH')); put(left ? wx - 2 : wx + 1, ay + 2, P('ARM_SH')); // the arm and its strut
      put(sx + 1, ay + 1, P('ARM_SH')); put(sx + w - 2, ay + 1, P('ARM_SH')); // the rings
      rect(sx, sy, w, h, P('TIMBER_SH')); rect(sx + 1, sy + 1, w - 2, h - 2, P(ground));
      rows.forEach((row, yy) => [...row].forEach((c, xx) => { if (c !== '.') put(sx + 1 + xx, sy + 1 + yy, P(SIGN_INK[c])); }));
      zoom.signs.push({ x: sx, y: sy, w, h, k });
    });
    const life = villageLife(d, t);
    zoom.actors = life.map((a) => ({ ...a, sx: Math.round(ox(a.x) + Z / 2) }));
    zoom.actors.forEach((a) => {
      const fy = oy(a.y) + Z - 1 - (a.hop ? 2 : 0);
      if (a.small) { // a child: smaller, bareheaded
        const x0 = a.sx - 1; rect(x0, fy - 7, 3, 2, P('TIMBER')); rect(x0, fy - 5, 3, 2, P('SKIN')); rect(x0, fy - 3, 3, 2, pal32[a.c]); put(x0, fy - 1, P('CLOAK_SH')); put(x0 + 2, fy - 1, P('CLOAK_SH')); put(x0, fy, P('CLOAK_SH')); put(x0 + 2, fy, P('CLOAK_SH'));
        return;
      }
      person(a.sx, fy, a, a.role !== 'faithful');
      if (a.role === 'smith') { // the hammer up and down, sparks off the anvil
        const up = !reduce && Math.floor(t * 3) % 2; put(a.sx - 3, fy - 7 - (up ? 2 : 0), P('ARM_SH')); put(a.sx - 3, fy - 6 - (up ? 2 : 0), P('TIMBER_SH'));
        if (!up) for (let k = 0; k < 3; k += 1) put(a.sx - 4 - k, fy - 4 - ((k + Math.floor(t * 6)) % 3), pack([255, 220, 140]));
      }
      if (a.role === 'minstrel') { rect(a.sx + 2, fy - 6, 2, 3, P('TIMBER_HI')); put(a.sx + 4, fy - 7, P('TIMBER_SH')); if (!reduce) put(a.sx + 3, fy - 12 - (Math.floor(t * 2) % 4), P('CREAM')); }
      if (a.role === 'drinker') { rect(a.sx + 2 * (a.dir || 1), fy - 5, 2, 2, P('GOLD_SH')); } // a mug
    });
    mk.folk.forEach((f) => { // the villagers, walking by the game's policy
      const X = mk.x0 + f.pos; const feet = oy(scene.riverTop(Math.round(X)) - 3) + Z - 1;
      f.dir = f.to > f.pos ? 1 : f.to < f.pos ? -1 : (f.dir || 1);
      person(Math.round(ox(X) + Z / 2), feet, f, Math.abs(f.to - f.pos) < 0.01);
    });
  }
  /** Close up, a click: a villager answers (a line for their role), else the market explains itself. */
  function villageClick(x, y) {
    if (!zoom || !zoom.done) return;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const who = (zoom.actors || []).find((a) => Math.abs(x - a.sx) <= 3 && y < (a.y - zoom.vy + 1) * zoom.Z && y > (a.y - zoom.vy) * zoom.Z - 14);
    const sg = (zoom.signs || []).find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
    if (sg && sg.k === 'maps') { say("The cartographer's sign, a compass rose. Up the stairs over the shop: the map room."); mapsTo(); return; }
    if (sg && real.atget) { const c = real.atget.captions[sg.k]; say(`A shop sign: "${c.name}", after one at ${c.text.replace(/^(.*), photographed by (.*) \((.*)\)\.$/, '$1 that $2 photographed ($3).')}`); return; }
    if (who) {
      if (who.role === 'drunk') { // his walk, and what the walks so far add up to
        const e = drunk.ends; const rms = e.length ? Math.sqrt(e.reduce((a, v) => a + v, 0) / e.length) : null;
        say(`"Home's this way. Or that way." He takes a pace left or right at random: ${drunk.n} paces so far tonight, and he is ${Math.abs(drunk.x)} from the tavern door. A walk of n such paces ends about sqrt(n) away${rms ? `: over his last ${e.length} walks of a hundred, ${rms.toFixed(1)} paces on average (root mean square), against sqrt(100) = 10` : ''}. The random walk, as of molecules and of prices.`);
      } else say(pick(LINES[who.role]));
      return;
    }
    const tv = scene.hamlet.places.tavern; const lm0 = shift(RATE[L.MID]) - scene.M;
    const ch = scene.hamlet.places.chapel;
    if (ch && x >= (ch.x - 1 + lm0 - zoom.vx) * zoom.Z && x < (ch.x + ch.w + 1 + lm0 - zoom.vx) * zoom.Z && y > (ch.yb - ch.h - 8 - zoom.vy) * zoom.Z && y < (ch.yb + 1 - zoom.vy) * zoom.Z) { say(chapelLine()); return; }
    if (tv && Math.abs(x - (tv.x + Math.floor(tv.w / 2) - 1 + lm0 - zoom.vx) * zoom.Z) < 6 && y > (tv.yb - 4 - zoom.vy) * zoom.Z && y < (tv.yb + 1 - zoom.vy) * zoom.Z) { sense('taste', 3); billiardShow(); return; } // the door: in, to the billiard table
    if (tv && Math.abs(x - (tv.x + tv.w + 1.5 + lm0 - zoom.vx) * zoom.Z) < 6 && Math.abs(y - (tv.yb - 4.5 - zoom.vy) * zoom.Z) < 8) { // the sign: the landlord's slate
      const div = document.createElement('div'); div.innerHTML = nowOf(); say(div.textContent.replace(/\s+/g, ' ').trim()); return;
    }
    const mk = scene.market; const lm = shift(RATE[L.MID]) - scene.M;
    if (mk && marketDay(today()) && look.night < 0.3) {
      const f = mk.folk.find((q) => Math.abs(x - ((mk.x0 + q.pos + lm - zoom.vx) * zoom.Z + zoom.Z / 2)) <= 3 && Math.abs(y - (scene.riverTop(Math.round(mk.x0 + q.pos)) - 4 - zoom.vy) * zoom.Z) < 10);
      if (f) { say(pick(LINES.buyer)); return; }
      const st = [5, 14].find((c) => Math.abs(x - ((mk.x0 + c + lm - zoom.vx) * zoom.Z)) < 8 && Math.abs(y - (scene.riverTop(mk.x0 + c) - 5 - zoom.vy) * zoom.Z) < 8);
      if (st !== undefined) { say(pick(LINES.vendor)); return; }
    }
    const wl = scene.hamlet.places.well;
    if (wl && Math.abs(x - (wl.x + 1 + lm0 - zoom.vx) * zoom.Z) < 8 && y > (wl.yb - 6 - zoom.vy) * zoom.Z && y < (wl.yb + 1 - zoom.vy) * zoom.Z) { // a coin in the well: the splash tells its depth
      const fall = Math.sqrt((2 * WELL_M) / 9.81); const back = WELL_M / 343; coin = { t0: now(), fall: fall + back }; sfx('coin');
      setTimeout(() => { sfx('drop'); say(`Plouf, ${(fall + back).toFixed(2)} s after it left your hand: ${fall.toFixed(2)} s falling (√(2h/g)), ${(back * 1000).toFixed(0)} ms for the sound to come back up at 343 m/s. The water is about ${WELL_M} m down.`); }, (fall + back) * 1000);
      return;
    }
    if (villageHit(x, y)) talk({ kind: 'market' });
  }
  /* The knight's quotations (Gutenberg's old books: _tools/fetch_quotes.py), the one that best fits the
     weather, the season, the hour and the month; none of the last six again. */
  let quoted = null; const quotedLast = [];
  const QUOTE_KEYS = [['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'wind', 'frost'], ['spring', 'summer', 'autumn', 'winter'], ['dawn', 'day', 'dusk', 'night'],
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']];
  function quoteNow() {
    const qs = realGet('quotes'); if (!qs) return null;
    const k = weather.kind; const a = bodies ? bodies.sun[2] / deg : 30;
    const now2 = new Set([
      { clear: 'clear', cloudy: 'cloudy', overcast: 'cloudy', drizzle: 'rain', showers: 'rain', rain: 'rain', storm: 'storm', snow: 'snow', fog: 'fog' }[k] || 'clear',
      (weather.wind ?? 0) > 25 ? 'wind' : '', (weather.temp ?? 9) <= 0 || (weather.frost ?? 9) <= -3 ? 'frost' : '', scene.season,
      look.night > 0.45 ? 'night' : a < 8 ? (today().getHours() < 12 ? 'dawn' : 'dusk') : 'day',
      QUOTE_KEYS[3][today().getMonth()]]);
    if (now2.has('storm')) { now2.add('rain'); now2.add('wind'); }
    const score = (q) => (q.keys.includes('any') ? 0.4 : QUOTE_KEYS.reduce((n, g) => { // each kind of key the quotation has: +1 if one fits now, -0.5 if none does
      const ks = q.keys.filter((key) => g.includes(key)); return ks.length ? n + (ks.some((key) => now2.has(key)) ? 1 : -0.5) : n;
    }, 0));
    const pool = qs.quotes.filter((q) => !quotedLast.includes(q)); const best = Math.max(...pool.map(score));
    if (best < 0.5) return null;
    const top = pool.filter((q) => score(q) >= best - 0.01); const q = top[Math.floor(Math.random() * top.length)];
    quotedLast.push(q); if (quotedLast.length > 6) quotedLast.shift();
    return q;
  }
  /* The tavern's bill of fare from Taillevent's Viandier (_tools/fetch_viandier.py): fish on lean days
     (Wednesday, Friday, Saturday, and all Lent: from Ash Wednesday, 46 days before Easter), meat on the
     others; three dishes and a sauce, the same all day. */
  function easter(y) { // the Gregorian computus (the "anonymous" algorithm, Meeus/Jones/Butcher)
    const a = y % 19; const b = Math.floor(y / 100); const c = y % 100; const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
    const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  }
  function fareNow() {
    const vi = realGet('viandier'); if (!vi) return null;
    const d = today(); const day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const e = easter(d.getFullYear());
    const lent = day0 >= new Date(e.getTime() - 46 * 864e5) && day0 < e;
    const lean = lent || [3, 5, 6].includes(d.getDay());
    const why = lent ? 'in Lent' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
    const r = mulberry32(d.getFullYear() * 400 + dayOfYear(d)); const pick = (a, n) => { const b = [...a]; const out = []; while (out.length < n && b.length) out.push(b.splice(Math.floor(r() * b.length), 1)[0]); return out; };
    const dishes = [...pick(vi.dishes.filter((q) => q.lean === lean && q.what.length >= 2), 3), ...pick(vi.dishes.filter((q) => q.lean === null && q.what.length >= 2), 1)];
    return { lean, why, dishes };
  }
  /** What the chapel sings at this hour (GregoBase's transcriptions: _tools/fetch_chant.py). */
  function chapelLine() {
    const o = officeNow(); const cs = real.chant ? real.chant.chants.filter((c) => c.office === o) : [];
    if (!o) return 'The chapel is quiet. The brothers sing lauds at first light, prime at sunrise, vespers at sunset and compline at nightfall.';
    if (!cs.length) return `${OFFICES[o]}: the brothers are singing.`;
    const c = cs[0]; const kind = { Hymnus: 'the hymn', Antiphona: 'the antiphon' }[c.part] || 'the hymn';
    return `${OFFICES[o]}: the brothers sing ${kind} "${c.title}" (mode ${c.mode}), "${c.text.split(/(?<=[,;:.])\s/).slice(0, 2).join(' ').replace(/[,;:.]$/, '')}..."${cs.length > 1 ? `, then "${cs[1].title}"` : ''}. From ${c.book}.`;
  }
  /** Close up, is canvas pixel (x, y) on the market (the stalls and the bank around them)? */
  function villageHit(x, y) {
    if (!zoom || !zoom.done || !marketDay(today()) || look.night >= 0.3 || !scene.market) return false;
    const mk = scene.market; const { vx, vy, Z } = zoom;
    const sx = vx + x / Z - (shift(RATE[L.MID]) - scene.M); const sy = vy + y / Z; const top = scene.riverTop(mk.x0 + 5);
    return sx >= mk.x0 && sx < mk.x0 + mk.N && sy > top - 14 && sy < top + 1;
  }
  /* ---- the watchtower, up top: a 360° view, a quarter per screen width, N E S W. From the near
     range (the landscape looks south): the high mountains to the south, the castle east along the
     range, the river, the village and the far city to the north, hills and vineyards west. The
     panorama is indexed in the scene's palette, so it is lit by the hour; the sun and the moon
     stand at their true azimuths, the clouds and the weather are the real ones. ---- */
  let tower = null; // { on, t0, yaw, to }
  let pano = null; // { P (indices, 4W x H), W, H, yh, clouds, fires }
  const TOWER_S = 0.6;
  const DIRS = [['North', 'the river, the village and, far off, Paris'], ['East', 'the castle on its rock, along the range'],
    ['South', 'the high mountains, their snow and their glaciers'], ['West', 'the hills going down, vines and forest, where the sun sets']];
  const towerBar = document.createElement('div');
  towerBar.className = 'tower-bar';
  towerBar.innerHTML = '<button type="button" data-turn="-1">[◄]</button> <button type="button" data-turn="0">[step down · Esc]</button> <button type="button" data-turn="1">[►]</button>';
  towerBar.addEventListener('click', (e) => { const b = e.target.closest('[data-turn]'); if (!b) return; const k = Number(b.dataset.turn); if (k) turnTower(k); else towerTo(false); });
  function towerTo(on) {
    if (on && banner()) return;
    if (!scene || (on && tower && tower.on) || (!on && !tower)) return;
    if (on) { realGet('paris'); if (!pano || pano.W !== scene.W || pano.H !== scene.H) pano = makePano(scene.W, scene.H); tower = { on: true, t0: now(), yaw: 2, to: 2 }; document.body.append(towerBar); }
    else tower = { ...tower, on: false, t0: now() };
    root.classList.toggle('lookout', on);
    if (on) sfx('steps', { floor: 'stair', n: 7 });
    if (on) say(`Atop the watchtower. Facing ${DIRS[2][0].toLowerCase()}: ${DIRS[2][1]}. The arrow keys turn you round; Esc goes down.`);
    if (!running && isOn()) render(now());
  }
  /** Up the tower, canvas pixel (x, y): one of Paris's monuments, named (OpenStreetMap's heights). */
  function towerClick(x, y) {
    if (!pano || !pano.city.length) return;
    const X = (((Math.round(tower.yaw * scene.W) + x) % pano.PW) + pano.PW) % pano.PW;
    const c = pano.city.filter((q) => Math.abs(q.x - X) <= 3 && y >= q.top - 2 && y <= q.base + 2).sort((a, b) => Math.abs(a.x - X) - Math.abs(b.x - X))[0];
    if (c) say(`${c.m.name[0].toUpperCase()}${c.m.name.slice(1)}: ${Math.round(c.m.h)} m tall, ${c.m.d.toFixed(1)} km off, as seen from the terrace of Meudon (its height from OpenStreetMap).`);
    else if (pano.city.some((q) => Math.abs(q.x - X) < 70) && Math.abs(y - pano.yh) < 8) say('Paris, far off in the haze, as from the terrace of Meudon: click a tower or a dome to have it named.');
  }
  function turnTower(k) {
    if (!tower || !tower.on) return;
    tower.to += k; tower.from = tower.yaw; tower.tt = now();
    const d = DIRS[((tower.to % 4) + 4) % 4]; say(`${d[0]}: ${d[1]}.`);
  }
  /** Sines of whole periods round the circle: noise that joins up at north again. */
  function ring(rng, terms) {
    const ks = terms.map(([k, a]) => [k, a, rng() * 6.283]);
    return (x, PW) => ks.reduce((s, [k, a, ph]) => s + a * Math.sin((6.283 * k * x) / PW + ph), 0);
  }
  function makePano(W, H) {
    const rng = mulberry32(4471); const PW = 4 * W; const P = new Uint8Array(PW * H).fill(CLEAR); const city = []; // (city: Paris's monuments where drawn, for the clicks)
    const yh = Math.round(H * 0.5); // the horizon: we are up high
    const set = (x, y, i) => { x = ((Math.round(x) % PW) + PW) % PW; y = Math.round(y); if (y >= 0 && y < H) P[y * PW + x] = i; };
    const az = (x) => ((x / W - 0.5) * 90 + 360) % 360; // column -> azimuth (degrees from north)
    const near = (x, a0, w) => { const d = Math.abs(((az(x) - a0 + 540) % 360) - 180); return Math.exp(-((d / w) ** 2)); };
    const winter = scene.season === 'winter'; const autumn = scene.season === 'autumn';
    for (let y = 0; y < H; y += 1) { // the sky, as in the landscape
      const g = clamp(y / yh) * (N_SKY - 1); const j = Math.min(N_SKY - 2, Math.floor(g)); const t = clamp((g - j - 0.3) / 0.5);
      for (let x = 0; x < PW; x += 1) P[y * PW + x] = t > bayer(x, y) ? j + 1 : j;
    }
    // the ranges all round, the high ones south: ridged multi-octave peaks; facets run diagonally
    // down from the crests (as in the landscape), lit from the west; snow under the crests
    const nf = fbm(rng);
    const ridged = (octs) => { // 1 - |sin| over whole periods: sharp crests, closing up at north
      const o = octs.map(([k, a]) => [k, a, rng() * 6.283]);
      const w = o.reduce((q, [, a]) => q + a, 0);
      return (x) => o.reduce((q, [k, a, ph]) => q + a * (1 - Math.abs(Math.sin((3.1416 * k * x) / PW + ph))) ** 1.6, 0) / w;
    };
    function range(top, light, shade, snowLine, depth) {
      const ys = new Float32Array(PW + 1);
      for (let x = 0; x <= PW; x += 1) ys[x] = top(x);
      for (let x = 0; x < PW; x += 1) {
        const y0 = Math.round(ys[x]); const slope = ys[x + 1] - ys[Math.max(0, x - 1)];
        const sd = snowLine === null ? 0 : (snowLine(x) - y0) * 0.8 + (nf(x * 0.9) - 0.5) * 4;
        for (let y = Math.max(0, y0); y < yh + depth; y += 1) {
          const lit = slope * 1.5 + (nf((x - y * 0.9) * 0.11 + 31) - 0.5) * 2.4 + (nf((x + y) * 0.07 + 57) - 0.5) * 1.2 > 0;
          set(x, y, y - y0 < sd ? (lit ? I.SNOW : I.SNOW_SH) : lit ? light : shade);
        }
      }
    }
    const hi = ridged([[6, 1], [13, 0.5], [29, 0.25], [61, 0.12]]); const lo = ridged([[5, 1], [11, 0.5], [23, 0.25], [53, 0.12]]);
    const south = (x) => near(x, 180, 65);
    // (low away from the south: a sun or moon a few degrees up stays in sight over them)
    range((x) => yh - H * ((0.015 + 0.04 * lo(x)) * (0.4 + 0.6 * south(x)) + south(x) * (0.1 + 0.26 * clamp((hi(x) - 0.2) / 0.6) ** 1.3)), I.MT_FAR, I.MT_FAR_SH,
      (x) => yh - H * ((winter ? 0.12 : 0.2) - 0.04 * (1 - south(x))), 4);
    const mid = ridged([[4, 1], [9, 0.5], [19, 0.25], [41, 0.12]]);
    range((x) => yh - H * (0.01 + 0.025 * mid(x) + 0.05 * south(x) + 0.03 * near(x, 90, 30)), I.MT_NEAR, I.MT_NEAR_SH, winter ? (x) => yh - H * 0.06 + 0 * x : null, 8);
    const leaf = winter ? [I.TREES_FAR_SH, I.TREES_FAR_SH] : [I.TREES_FAR, I.TREES_FAR_SH];
    for (let x = 0; x < PW; x += 1) for (let y = yh + 2; y < yh + 7; y += 1) set(x, y, I.TREES_FAR_SH);
    for (let x = 0; x < PW; x += 2 + Math.floor(rng() * 2)) { // a fringe of small conifers
      const h = 2 + Math.floor(rng() * 3); const by = yh + 3;
      for (let r = 0; r < h; r += 1) for (let dx = -Math.floor((h - r) / 2); dx <= Math.floor((h - r) / 2); dx += 1) set(x + dx, by - r, autumn && (x * 7) % 5 === 0 ? I.RUST_SH : leaf[dx > 0 ? 1 : 0]);
    }
    // the land below: a soft patchwork in perspective (bands taller towards us), hedges as rows of
    // dots, copses as dark blobs; vines in rows to the west; the forest falls away to the south
    const rows = []; for (let y = yh + 7, h = 2; y < H; y += h, h = Math.min(16, Math.round(h * 1.3 + 1))) rows.push([y, h]);
    const FIELDS = winter ? [I.SNOWFIELD, I.SNOWFIELD, I.SNOWFIELD, I.HILL_SH] : autumn ? [I.HILL, I.HILL, I.HILL_HI, I.FURROW, I.WHEAT_SH, I.HILL_SH]
      : [I.HILL, I.HILL, I.HILL_HI, I.GRASS_HI, I.WHEAT, I.FURROW];
    rows.forEach(([y0, h], r) => {
      let x = Math.floor(rng() * 6); const cw = 6 + r * 4;
      while (x < PW) {
        const w = Math.round(cw * (0.6 + rng() * 0.9)); const a = az(x);
        let c = FIELDS[Math.floor(rng() * FIELDS.length)];
        const vines = !winter && a > 240 && a < 300 && rng() < 0.6; // (the forest is laid over the fields below, its edge ragged: a field's straight side made a seam)
        for (let yy = y0; yy < y0 + h && yy < H; yy += 1) for (let xx = x; xx < x + w; xx += 1) {
          let k = c;
          if (vines) k = (yy - y0) % 2 ? I.HILL_SH : (xx % 2 ? (autumn ? I.VINE_AUT : I.VINE) : I.HILL_SH);
          else if (c === I.FURROW && (yy - y0) % 2) k = I.FURROW_SH;
          set(xx, yy, k);
        }
        if (r > 0 && rng() < 0.45) for (let xx = x; xx < x + w; xx += 2) set(xx, y0, I.BUSH_SH); // a hedge along it
        x += w;
      }
    });
    for (let k = 0; k < 90; k += 1) { // copses, bigger the nearer
      const x = rng() * PW; const a = az(x); const y = yh + 8 + (rng() ** 1.6) * (H * 0.36); const r = 1 + (y - yh) * 0.05;
      if (a > 140 && a < 220) continue;
      for (let dy = -r; dy <= r * 0.6; dy += 1) for (let dx = -r * 1.6; dx <= r * 1.6; dx += 1) {
        if ((dx / (r * 1.6)) ** 2 + (dy / r) ** 2 > 1) continue;
        set(x + dx, y + dy, autumn && k % 3 === 0 ? (dx + dy < 0 ? I.RUST_HI : I.RUST) : dx + dy < -r * 0.3 ? I.OAK_HI : dx + dy > r * 0.4 ? I.OAK_SH : I.OAK);
      }
    }
    { // south: the forest, its edge frayed into the fields; darker and lighter stands, a few clearings
      for (let y = yh + 7; y < H; y += 1) for (let x = 0; x < PW; x += 1) {
        const d = Math.abs(az(x) - 180); if (d > 60) continue;
        const edge = (46 - d) / 8 + (nf(x * 0.05 + y * 0.31 + 11) - 0.5) * 2.2;
        const glade = nf(x * 0.03 + 77) * nf(y * 0.21 + 5) > 0.42 && d < 30; // (a clearing, now and then)
        if (edge > bayer(x, y) && !glade) set(x, y, nf(x * 0.02 + y * 0.09 + 3) > 0.55 ? (bayer(x, y) < 0.5 ? I.PINE : I.PINE_SH) : bayer(x, y) < 0.25 ? I.PINE : I.PINE_SH);
      }
    }
    for (let k = 0; k < 2600; k += 1) { // south: the forest going down, a pine at each point, bigger the nearer
      const x = Math.round(((140 + rng() * 80) / 90 + 0.5) * W); const y = Math.round(yh + 8 + (rng() ** 1.3) * (H - yh - 8)); const h = 2 + Math.round((y - yh) * 0.09);
      if (Math.abs(az(x) - 180) > 44 - 10 * nf(x * 0.05 + y * 0.31 + 11)) continue;
      for (let r = 0; r < h; r += 1) { const half = Math.floor(((h - r) * 0.45)); for (let dx = -half; dx <= half; dx += 1) set(x + dx, y - r, dx < 0 ? (winter && r > h / 2 ? I.SNOW : I.PINE_HI) : dx === 0 ? I.PINE : I.PINE_SH); }
    }
    { // south: a lake in the valley floor, under the mountains
      const lx = Math.round((180 / 90 + 0.5) * W) + Math.round(W * 0.12); const ly = yh + 10;
      for (let dy = -1; dy < 7; dy += 1) for (let dx = -30; dx <= 30; dx += 1) { // an oval, its shore ragged, reeds and a beach round it
        const q = (dx / 27) ** 2 + ((dy - 2.5) / 3.6) ** 2 + (nf(dx * 0.4 + dy + 91) - 0.5) * 0.35;
        if (q < 1) set(lx + dx, ly + dy, dy <= 0 || (dx * 3 + dy * 7) % 11 === 0 ? I.WATER_HI : I.WATER);
        else if (q < 1.25) set(lx + dx, ly + dy, (dx + dy) % 3 ? I.HILL_HI : I.GRASS_HI);
      }
    }
    const xAt = (a) => Math.round((a / 90 + 0.5) * W); // azimuth -> column
    { // north: the river across the plain, winding, the village on it, the city on the horizon
      const rv = ring(rng, [[6, 1], [14, 0.4]]);
      for (let x = xAt(-55 + 360) - PW; x < xAt(55); x += 1) {
        const yc = yh + 0.2 * H + rv(x, PW) * 0.03 * H; const w = 1.5 + 0.02 * H * clamp((yc - yh) / (0.4 * H));
        for (let y = Math.round(yc - w); y <= yc + w; y += 1) set(x, y, Math.abs(y - yc) > w - 1 ? I.WATER_HI : I.WATER);
      }
      const vx = xAt(-18 + 360); const vy = Math.round(yh + 0.2 * H + rv(vx, PW) * 0.03 * H) - 4;
      [[0, 4, 3, I.THATCH], [6, 3, 4, I.ROOF], [11, 2, 6, I.SLATE], [15, 5, 3, I.ROOF], [22, 4, 3, I.THATCH], [3, 3, 2, I.THATCH]].forEach(([dx, w, h, roof], k) => {
        const y0 = vy - (k === 5 ? 3 : 0);
        for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) set(vx + dx + x, y0 - y, x === 0 ? I.WALL_HI : I.WALL);
        for (let x = -1; x <= w; x += 1) set(vx + dx + x, y0 - h, roof);
        if (roof === I.SLATE) { set(vx + dx, y0 - h - 1, I.SLATE); set(vx + dx + 1, y0 - h - 1, I.SLATE); set(vx + dx, y0 - h - 2, I.SLATE); } // the spire
      });
      if (!real.paris) {
      const cx0 = xAt(10); // the city: low roofs, two towers of a cathedral, a dome, in the haze
      for (let x = -26; x <= 26; x += 1) {
        const hgt = 1 + ((x * 7919) % 5 + 5) % 3 + (Math.abs(x) < 3 ? 6 : 0) + (x === 12 || x === 13 ? 4 : 0) + (x === -10 ? 8 : 0);
        for (let y = 0; y < hgt; y += 1) set(cx0 + x, yh + 1 - y, I.MT_FAR_SH);
      }
      for (let x = 10; x <= 15; x += 1) set(cx0 + x, yh - 4 - Math.round(Math.sqrt(Math.max(0, 6 - (x - 12.5) ** 2))), I.MT_FAR_SH);
      }
    }
    { // east: the castle on its rock, a little way along the range
      const cx = xAt(92); const base = yh + Math.round(0.07 * H); const k = 1.6; const q = (v) => Math.round(v * k);
      for (let y = 0; y < q(12); y += 1) for (let x = -q(14) - y; x <= q(14) + y; x += 1) { // the rock
        const e = (x + q(14) + y) / (2 * (q(14) + y));
        set(cx + x, base + y, e < 0.15 ? I.ROCK_HI : e > 0.75 ? I.ROCK_SH : (x * 3 + y * 5) % 17 === 0 ? I.ROCK_DK : I.ROCK);
      }
      for (let y = 0; y < q(8); y += 1) for (let x = -q(12); x <= q(12); x += 1) set(cx + x, base - y, x === -q(12) ? I.WALL_HI : x === q(12) ? I.WALL_SH : I.WALL); // the curtain wall
      for (let x = -q(12); x <= q(12); x += 2) set(cx + x, base - q(8), I.WALL);
      [[-12, 14, I.ROOF], [-5, 17, I.ROOF], [-1, 22, I.ROOF], [5, 12, I.SLATE], [10, 15, I.ROOF]].forEach(([dx, h, roof]) => { // towers, their caps
        const w = q(4); const x0 = cx + q(dx); const hh = q(h);
        for (let y = 0; y < hh; y += 1) for (let x = 0; x < w; x += 1) set(x0 + x, base - y, x === 0 ? I.WALL_HI : x === w - 1 ? I.WALL_SH : I.WALL);
        const ch = Math.ceil(w / 2) + 2;
        for (let j = 0; j < ch; j += 1) { const hw = (w / 2 + 1) * (1 - j / ch); for (let x = Math.round(-hw); x <= Math.round(hw); x += 1) set(x0 + Math.floor(w / 2) + x, base - hh - j, x < 0 ? (roof === I.ROOF ? I.ROOF_HI : I.SLATE_HI) : roof); }
        set(x0 + 1, base - Math.round(hh * 0.55), I.WIN_DARK); set(x0 + 1, base - Math.round(hh * 0.55) + 1, I.WIN_DARK);
      });
      const fy = base - q(22) - Math.ceil(q(4) / 2) - 3; const fx = cx + q(-1) + Math.floor(q(4) / 2);
      for (let y = 0; y < 4; y += 1) set(fx, fy - y, I.TIMBER_SH); set(fx + 1, fy - 3, I.FLAG); set(fx + 2, fy - 3, I.FLAG); set(fx + 1, fy - 2, I.FLAG);
      for (let y = 0; y < q(3); y += 1) for (let x = 0; x < 2; x += 1) set(cx + 1 + x, base - y, I.OUTLINE); // the gate
    }
    // the parapet all round: a wall's top, merlons and crenels, the stone lit from above
    const wallY = H - Math.round(0.11 * H); const mer = Math.round(0.08 * H); const pitch = Math.round(W / 5);
    for (let x = 0; x < PW; x += 1) {
      const m = x % pitch; const merlon = m < pitch * 0.45;
      const top = merlon ? wallY - mer : wallY;
      for (let y = top; y < H; y += 1) {
        const edge = y === top || (merlon && (m === 0 || m === Math.floor(pitch * 0.45) - 1));
        const course = (y - wallY) % 5 === 0 || (x + (Math.floor((y - wallY) / 5) % 2) * 4) % 8 === 0;
        set(x, y, edge ? (m === 0 ? I.ROCK_HI : I.ROCK_HI) : course ? I.ROCK_SH : y > H - 4 ? I.ROCK_DK : I.ROCK);
      }
    }
    const clouds = Array.from({ length: 14 }, () => ({ x: rng() * PW, y: H * (0.05 + rng() * 0.25), w: 10 + rng() * 22, h: 3 + rng() * 4 }));
    const birds = Array.from({ length: 3 }, (_, k) => ({ x: rng() * PW, y: H * (0.15 + k * 0.08), ph: rng() * 6 }));
    const pr = real.paris; // Paris as from the terrace of Meudon (_tools/fetch_paris.py), turned to lie north here: its roofs, its monuments, over all else
    if (pr) {
      const K = 8; const pax = (a) => xAt(10 + a - 48); // (a negative azimuth: set() wraps the column) // (8 px a degree of altitude: the panorama's squeezed sky would hide it)
      const roofAt = (a) => { const r = pr.roofs; const k = clamp(Math.floor(a - r[0][0]), 0, r.length - 2); const f = clamp(a - r[k][0], 0, 1); return r[k][1] * (1 - f) + r[k + 1][1] * f; };
      for (let x = pax(pr.roofs[0][0]); x <= pax(pr.roofs.at(-1)[0]); x += 1) {
        const a = 48 + (x - xAt(10)) / (W / 90); const top = Math.round(yh - roofAt(a) * K);
        const hx = ((x * 2654435761) >>> 0) % 7; // (a column's house: its roof one pixel up or not, its front lit or in shade)
        for (let y = top - (hx < 3 ? 1 : 0); y <= yh + 5; y += 1) set(x, y, y <= top - (hx < 3 ? 1 : 0) ? I.SLATE_SH : hx === 5 || (y + x) % 4 === 0 ? I.MT_FAR_SH : I.WALL_SH);
      }
      pr.monuments.forEach((m) => {
        const x = pax(m.az); const top = Math.round(yh - m.alt * K); const base = Math.round(yh - roofAt(m.az) * K) + 1; const c = I.MT_FAR;
        if (m.kind === 'eiffel') { for (let y = top; y <= base; y += 1) { const w = Math.round(((y - top) / Math.max(1, base - top)) ** 2 * 3); set(x - w, y, I.MT_FAR_SH); set(x + w, y, I.MT_FAR_SH); if (y === top + Math.round((base - top) * 0.55)) for (let q = -w; q <= w; q += 1) set(x + q, y, I.MT_FAR_SH); } }
        else if (m.kind === 'tower') for (let y = top; y <= base; y += 1) { set(x, y, c); set(x + 1, y, c); }
        else if (m.kind === 'spire') for (let y = top; y <= base; y += 1) set(x, y, c);
        else if (m.kind === 'arch') { for (let y = top; y <= base; y += 1) for (let q = -2; q <= 2; q += 1) if (!(y > top + 1 && Math.abs(q) < 1)) set(x + q, y, c); }
        else { // a dome on its drum, a lantern; the Sacré-Cœur with its little domes
          for (let y = top + 2; y <= base; y += 1) for (let q = -1; q <= 1; q += 1) set(x + q, y, c);
          [-2, -1, 0, 1, 2].forEach((q) => set(x + q, top + 2, c)); [-1, 0, 1].forEach((q) => set(x + q, top + 1, c)); set(x, top, c);
          if (m.kind === 'domes') [-3, 3].forEach((q) => { set(x + q, top + 3, c); set(x + q, top + 4, c); });
        }
        city.push({ x, top, base, m });
      });
    }
    return { P, W, H, PW, yh, clouds, birds, xAt, city, fire: { x: pitch * 2 + Math.round(pitch * 0.7), y: wallY - 1 } };
  }
  function drawTower(t) {
    const { W, H } = scene; const { P, PW, yh, xAt } = pano;
    if (tower.tt !== undefined) { const e = reduce ? 1 : clamp((t - tower.tt) / 0.5); tower.yaw = tower.from + (tower.to - tower.from) * e * e * (3 - 2 * e); }
    const ox = Math.round(tower.yaw * W); // the view's left column: yaw 0 has north in the middle, 1 east...
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x; const c = P[y * PW + (((ox + x) % PW) + PW) % PW];
        idxNow[i] = c; buf[i] = pal32[c];
      }
    }
    const put = (x, y, c, skyOnly) => { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= W || y < 0 || y >= H) return; const i = y * W + x; if (!skyOnly || idxNow[i] < N_SKY) buf[i] = c; };
    const blend = (x, y, rgb, a, skyOnly) => { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return; const i = y * W + x; if (skyOnly && idxNow[i] >= N_SKY) return; buf[i] = pack(mix(unpack(buf[i]), rgb, a)); };
    const sx = (X) => { let d = (((X - ox) % PW) + PW) % PW; if (d > PW / 2) d -= PW; return d; }; // panorama column -> screen
    const sky = skyFn();
    const at = (v) => { const a = (Math.atan2(v[0], v[1]) / deg + 360) % 360; const alt = Math.asin(clamp(v[2], -1, 1)); return [sx(xAt(a)), yh - (alt / (62 * deg)) * (yh - 4), alt]; };
    if (look.stars > 0) for (let k = 0; k < 160; k += 1) { // the stars wheel round too
      const X = (k * 7919) % PW; const Y = (k * 104729) % Math.round(yh * 0.95);
      blend(sx(X), Y, [255, 255, 255], look.stars * (reduce ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2 + k)), true);
    }
    const sun = at(sky.sun); const moon = at(sky.moon);
    if (sun[2] > -3 * deg) for (let y = -8; y <= 8; y += 1) for (let x = -8; x <= 8; x += 1) {
      const q = Math.hypot(x, y);
      if (q <= 5) put(sun[0] + x, sun[1] + y, pack(look.sun), true); else if (q <= 8 && bayer(x + 8, y + 8) < 0.5 - (q - 5) / 8) blend(sun[0] + x, sun[1] + y, look.sun, 0.45, true);
    }
    if (sun[2] > -3 * deg && sky.solar.sep < sky.solar.touch) { // an eclipse: the Moon's disc on the Sun
      const k = 5 / sky.sunR; const dx = moon[0] - sun[0]; const dy = moon[1] - sun[1]; const n = Math.hypot(dx, dy) || 1;
      const cx = sun[0] + (dx / n) * sky.solar.sep * k; const cy = sun[1] + (dy / n) * sky.solar.sep * k; const rr = sky.lunar.moonR * k;
      for (let y = -7; y <= 7; y += 1) for (let x = -7; x <= 7; x += 1) if (Math.hypot(x, y) <= rr) put(cx + x, cy + y, pack([24, 26, 40]), true);
    }
    const anti = at(sky.sun.map((c) => -c)); const LS = sky.lunar;
    const shadow = (x, y) => { // 2 umbra, 1 penumbra, at moon pixel (x, y) (6 px a moon radius)
      if (LS.sep > LS.penumbra + LS.moonR) return 0;
      const k = 6 / LS.moonR; const dx = anti[0] - moon[0]; const dy = anti[1] - moon[1]; const n = Math.hypot(dx, dy) || 1;
      const d = Math.hypot(x - (dx / n) * LS.sep * k, y - (dy / n) * LS.sep * k);
      return d < LS.umbra * k ? 2 : d < LS.penumbra * k ? 1 : 0;
    };
    if (moon[2] > -3 * deg) {
      const d = [sun[0] - moon[0], sun[1] - moon[1]]; const n = Math.hypot(...d) || 1;
      const elong = Math.acos(clamp(sky.sun[0] * sky.moon[0] + sky.sun[1] * sky.moon[1] + sky.sun[2] * sky.moon[2], -1, 1));
      const L = [(d[0] / n) * Math.sin(elong), (d[1] / n) * Math.sin(elong), -Math.cos(elong)];
      for (let y = -6; y <= 6; y += 1) for (let x = -6; x <= 6; x += 1) {
        const q = (x * x + y * y) / 36; if (q > 1) continue;
        const sh = shadow(x, y);
        if (sh) put(moon[0] + x, moon[1] + y, pack(sh === 2 ? [158, 70, 46] : [190, 186, 170]), true);
        else if ((x / 6) * L[0] + (y / 6) * L[1] + Math.sqrt(1 - q) * L[2] > 0) put(moon[0] + x, moon[1] + y, pack([240, 238, 220]), true);
        else blend(moon[0] + x, moon[1] + y, [240, 238, 220], 0.12, true);
      }
    }
    sky.planets.forEach((p) => { // the planets, as in the landscape
      const [c, size] = PLANET_LOOK[p.name]; const show = clamp((-sun[2] / deg - (size === 2 ? 1 : 5)) / 5); const q = at(p.v);
      if (q[2] <= 0 || show <= 0) return;
      blend(q[0], q[1], c, show, true);
      if (size >= 1) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => blend(q[0] + dx, q[1] + dy, c, show * (size === 2 ? 0.55 : 0.3), true));
    });
    skyVeil();
    const nC = Math.round(pano.clouds.length * clamp(0.15 + weather.cover)); const cc = unpack(pal32[I.CLOUD]); const cs = unpack(pal32[I.CLOUD_SH]);
    pano.clouds.slice(0, nC).forEach((c) => { // the real cover, drifting with the real wind
      if (!reduce) c.x = (c.x + windX() * 0.08 + PW) % PW;
      const x0 = sx(c.x);
      for (let y = -c.h; y <= c.h; y += 1) for (let x = -c.w; x <= c.w; x += 1) {
        const q = (x / c.w) ** 2 + (y / c.h) ** 2; if (q > 1 || bayer(x0 + x, c.y + y) > 1.6 - q * 1.2) continue;
        blend(x0 + x, c.y + y, y > c.h * 0.3 ? cs : cc, look.night > 0.5 ? 0.35 : 0.95, true);
      }
    });
    if (look.night < 0.6) pano.birds.forEach((b) => { // swifts wheeling over the valley
      if (!reduce) b.x = (b.x + 0.3 + PW) % PW;
      const x = sx(b.x); const y = b.y + Math.sin(t * 1.3 + b.ph) * 3; const f = Math.floor(t * 4 + b.ph) % 2;
      put(x, y, pal32[I.OUTLINE], true); put(x - 1, y - f, pal32[I.OUTLINE], true); put(x + 1, y - f, pal32[I.OUTLINE], true);
    });
    if ((weather.kp || 0) >= 7 && look.night > 0.5) { // an aurora low in the north: green curtains, red above
      const k = clamp((weather.kp - 6.5) / 2); const xN = sx(xAt(0));
      for (let x = -W; x <= W; x += 1) {
        const ax = xN + x; if (ax < 0 || ax >= W) continue;
        const fall = Math.exp(-((x / (W * 0.45)) ** 2)) * k;
        const h = (14 + 10 * Math.sin(x * 0.07 + t * 0.6) + 6 * Math.sin(x * 0.19 - t * 1.1)) * fall; const base = yh - 2;
        for (let j = 0; j < h * 2.2; j += 1) {
          const f = j / (h * 2.2); const ray = 0.6 + 0.4 * Math.sin(x * 0.9 + t * 2 + j * 0.05);
          blend(ax, base - j, f < 0.55 ? [90, 255, 150] : [255, 90, 110], (1 - f) * 0.5 * ray * fall, true);
        }
      }
    }
    landVeil();
    if (look.night > 0.2) { // the castle's windows and the village's, lit; the signal fire on the parapet
      [[92, 0], [-18, 1]].forEach(([a, k]) => { const x = sx(xAt((a + 360) % 360)); const y = yh + (k ? Math.round(0.2 * H) - 6 : Math.round(0.07 * H) - 10);
        for (let j = 0; j < 3; j += 1) blend(x + j * 4 - 4, y - (j % 2), [255, 200, 110], look.night, false); });
      const f = pano.fire; const x = sx(f.x); const hot = reduce || Math.random() < 0.6;
      put(x, f.y, pack(hex(FIRE[hot ? 7 : 5])), false); put(x, f.y - 1, pack(hex(FIRE[hot ? 5 : 4])), false); put(x + (hot ? 1 : -1), f.y - 2, pack(hex(FIRE[3])), false);
      for (let y = -6; y <= 4; y += 1) for (let dx = -6; dx <= 6; dx += 1) { const q = Math.hypot(dx, y) / 6; if (q < 1 && bayer(x + dx, f.y + y) < (1 - q) * 0.8) blend(x + dx, f.y + y, [255, 160, 70], 0.35 * look.night, false); }
    }
    precipitation(put, blend);
  }
  function renderTower(t) {
    const e = reduce ? 1 : clamp((t - tower.t0) / TOWER_S); const th = tower.on ? e : 1 - e;
    if (th < 1) { draw(t); obuf.set(buf); }
    drawTower(t);
    if (th >= 1) obuf.set(buf);
    else for (let i = 0; i < buf.length; i += 1) { const x = i % scene.W; const y = (i - x) / scene.W; if (bayer(x, y) < th) obuf[i] = buf[i]; }
    if (!tower.on && e >= 1) { tower = null; towerBar.remove(); if (!running && isOn()) render(now()); }
  }

  /** Who is about in the village at instant d (plane x, feet y, coat, what they do): the smith
   *  at his forge on working days, drinkers at the tavern's door at night (and a minstrel on
   *  Fridays, Saturdays and feast days), the faithful at the chapel on Sunday morning, children
   *  on the bank on warm dry afternoons. */
  function villageLife(d, t) {
    const pl = scene.hamlet.places; const h = d.getHours() + d.getMinutes() / 60; const day = d.getDay(); const out = [];
    const feet = (x) => scene.riverTop(x) - 3;
    const add = (x, c, role, k, extra = {}) => out.push({ x, y: feet(Math.round(x)), c, role, k, ...extra });
    if (pl.forge && day !== 0 && h >= 7 && h < 18) add(pl.forge.x + 7, I.RUST_SH, 'smith', 7, { dir: -1 });
    if (pl.tavern && (h >= 18 || h < 1)) {
      add(pl.tavern.x + pl.tavern.w + 1, I.ROBE, 'drinker', 1, { dir: -1 }); add(pl.tavern.x - 2, I.FLAG2, 'drinker', 2, { dir: 1 });
      if (day === 5 || day === 6 || festival(d)) add(pl.tavern.x + pl.tavern.w + 3, I.FLAG, 'minstrel', 5, { dir: -1 });
    }
    if (pl.tavern && (h >= 21 || h < 2)) add(pl.tavern.x + Math.floor(pl.tavern.w / 2) - 1 + Math.round(drunk.x * 0.7), I.TIMBER, 'drunk', 3, { dir: drunk.x >= 0 ? 1 : -1 }); // the last one out
    if (pl.chapel && day === 0 && h >= 9 && h < 11.5) [-5, -3, 6, 8].forEach((dx, k) => add(pl.chapel.x + dx, [I.CLOAK, I.ROBE, I.RUST, I.TIMBER][k], 'faithful', k, { dir: dx < 0 ? 1 : -1 }));
    const warm = (weather.temp ?? 15) >= 15 && !WET[weather.kind] && weather.kind !== 'snow';
    if (pl.well && warm && h >= 14 && h < 19 && look.night < 0.3) [0, 1].forEach((k) => {
      const x = pl.well.x + 1 + Math.sin(t * (0.9 + k * 0.3) + k * 2) * 6; add(x, k ? I.FL_YEL : I.GRASS_HI, 'child', 9 + k, { small: true, dir: Math.cos(t * (0.9 + k * 0.3) + k * 2) > 0 ? 1 : -1, hop: Math.abs(Math.sin(t * 5 + k)) > 0.7 });
    });
    return out;
  }
  const LINES = {
    smith: ['"Iron wants a hot fire and a patient arm."', '"The castle\'s gate hinges? Mine. Every one."', '"Mind the sparks, traveller."'],
    drinker: ['"Another round, and a song if the minstrel is sober."', '"They say the ferryman finally learned the river."', '"Rain tomorrow. My knee says so."'],
    minstrel: ['"A ballad of the dragon, three verses and a chorus. Coin optional, applause compulsory."', '"I know the old tunes and the new; the new are the old ones, faster."'],
    faithful: ['"The bell rang late again. The bell-ringer counts in his own hours."', '"Good morrow."'],
    child: ['"You can\'t catch me!"', '"I saw a fish as long as my arm!"', '"Is it true the wizard is a thousand years old?"'],
    buyer: ['"The bread is better on Wednesdays."', '"I came for cloth and I am leaving with apples."', '"Too many people at the bread stall; I\'ll wait."', '"Everyone queues where everyone queues."'],
    vendor: ['"Fresh this morning!"', '"Two for the price of three. No, wait."', '"Finest cloth this side of the mountains."'],
  };

  /** The market's equilibrium for hour h (bread in the morning, cloth after noon), solved once an
   *  hour, and its villagers: x0, the bank's first place (MID plane); folk at places (floats). */
  /** Each market day its two stalls and their pull through the day: [wares, morning, afternoon]. */
  const STALLS = { 3: [['bread', 1, 0.4], ['cloth', 0.4, 1]], 5: [['fish', 1.2, 0.2], ['cheese', 0.5, 0.8]],
    6: [['fruit', 0.8, 0.7], ['cloth', 0.5, 1]], 0: [['bread', 1, 0.6], ['flowers', 0.6, 0.6]] };
  /* The market's game is solved off the main thread (~40 ms, once an hour, would stall a frame):
     a Worker made from marketGame's own source; without one, solved here as before. */
  let solver; let solving = null;
  function solverOf() {
    if (solver === undefined) {
      try {
        const src = `${marketGame.toString()}\nonmessage = (e) => postMessage({ key: e.data.key, g: marketGame(e.data.pull) });`;
        solver = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        solver.onmessage = (e) => { if (solving && e.data.key === solving.key) { settleMarket(solving, e.data.g); solving = null; } };
      } catch { solver = null; }
    }
    return solver;
  }
  function settleMarket(job, g) {
    const { h, day, N, x0, sa, sb } = job; const mk = scene.market;
    const draw1 = () => { let r = Math.random(); let x = 0; while (x < N - 1 && (r -= g.m[x]) > 0) x += 1; return x; };
    const COATS = [I.ROBE, I.CLOAK, I.FLAG, I.FLAG2, I.RUST, I.TIMBER];
    const folk = mk && mk.folk.length ? mk.folk : Array.from({ length: 14 }, (_, k) => { const x = draw1(); return { pos: x, to: x, c: COATS[k % COATS.length], k }; });
    scene.market = { h, day, x0, N, folk, wares: [sa[0], sb[0]], ...g };
  }
  function marketOf(h) {
    const mk = scene.market; const day = today().getDay();
    if (mk && mk.h === h && mk.day === day) return mk;
    const N = 32; const x0 = scene.hamlet.x1 - 1; const s0 = 5; const s1 = 14; // (clear of the houses; the stalls' middles, see draw)
    const late = clamp((h - 9) / 8); const [sa, sb] = STALLS[day] || STALLS[3];
    const A0 = sa[1] + (sa[2] - sa[1]) * late; const A1 = sb[1] + (sb[2] - sb[1]) * late;
    const pull = Array.from({ length: N }, (_, x) => A0 * Math.exp(-(((x - s0) / 2.5) ** 2)) + A1 * Math.exp(-(((x - s1) / 2.5) ** 2)) - (0.16 * Math.abs(x - (s0 + s1) / 2)) / N);
    const job = { key: `${day}-${h}`, h, day, N, x0, sa, sb };
    const w = solverOf();
    if (!w) { settleMarket(job, marketGame(pull)); return scene.market; }
    if (!solving || solving.key !== job.key) { solving = job; w.postMessage({ key: job.key, pull }); }
    // meanwhile: the last hour's crowd, or, the first time, everyone standing still where they are
    return mk || { h: -1, day, x0, N, folk: [], wares: [sa[0], sb[0]], m: new Float64Array(N), pol: new Float64Array(N * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), gap: 0, rounds: 0 };
  }
  function draw(t) {
    const { W, H, M, fire, fw, fh, cells, yl0, yg, yHor } = scene;
    const put = (x, y, c, skyOnly) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const i = y * W + x;
      if (!skyOnly || idxNow[i] < N_SKY) buf[i] = c;
    };
    const blend = (x, y, rgb, a, skyOnly) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
      const i = y * W + x;
      if (skyOnly && idxNow[i] >= N_SKY) return;
      buf[i] = pack(mix(unpack(buf[i]), rgb, a));
    };
    const halo = (x0, y0, r, rgb, a) => { // a dithered glow ring
      for (let y = -Math.ceil(r); y <= r; y += 1) {
        for (let x = -Math.ceil(r); x <= r; x += 1) {
          const q = Math.hypot(x, y);
          if (q > 1 && q < r && bayer(x0 + x, y0 + y) < 0.7 - q / (r * 1.4)) blend(x0 + x, y0 + y, rgb, a, false);
        }
      }
    };
    const rect2 = (x0, y0, w, h, c) => { for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) put(x0 + x, y0 + y, c, false); };
    const blit = (s, x0, y0, maxY = H, sh = null) => {
      for (let y = 0; y < s.h; y += 1) {
        const yy = y0 + y + (sh ? sh(y) : 0);
        if (yy >= maxY) continue;
        for (let x = 0; x < s.w; x += 1) {
          const c = s.px[y * s.w + x];
          if (c >= 0) put(x0 + x, yy, pal32[c], false);
        }
      }
    };
    const mx = (x) => x - M + shift(RATE[L.MID]); // castle and hill things, plane to screen
    const gx = (x, y) => x - M + groundOff(y); // meadow things

    // the planes from the sky to the castle are still between parallax steps and relights: kept
    // composed in backBuf (5 planes, ~0.3 MB a frame otherwise); what moves over them draws on
    // sky pixels only, or (the dragon) on the far ones, so the result is the same as in order
    const key = RATE.slice(0, L.GROUND).map((r) => shift(r)).join();
    if (key !== backKey) {
      [L.SKY, L.FAR, L.NEAR, L.TREES, L.MID].forEach(composite);
      backBuf.set(buf); backIdx.set(idxNow); backKey = key;
    } else { buf.set(backBuf); idxNow.set(backIdx); }

    { // the waterfall, where the near range shows: streaks running down; still ice in a hard frost
      const f = scene.falls; const x0 = f.x - M + shift(RATE[L.NEAR]); const frozen = (weather.frost ?? 9) <= -4;
      const NEARS = [I.MT_NEAR, I.MT_NEAR_SH];
      for (let y = f.y0; y < f.y0 + f.len; y += 1) {
        const w = 2 + Math.round((y - f.y0) / f.len * 1.5); const wob = Math.round(Math.sin(y * 0.07) * 1.2); // (a slow bend with the rock: a quick one zigzagged like lightning)
        for (let dx = 0; dx <= w; dx += 1) {
          const x = x0 + dx - Math.floor(w / 2) + wob; if (x < 0 || x >= W || !NEARS.includes(idxNow[y * W + x])) continue;
          const run = frozen || reduce ? (dx + y) % 3 : ((Math.floor(y - t * 9 + dx * 5) % 6) + 6) % 6;
          put(x, y, frozen ? (run ? pal32[I.WATER_HI] : pal32[I.SNOWFIELD]) : dx === 0 || dx === w ? pal32[I.WATER] : run === 0 ? pal32[I.CLOUD] : pal32[I.WATER_HI]);
        }
      }
      if (!frozen && !reduce) for (let k = 0; k < 5; k += 1) { const y = f.y0 + f.len - 1 - (k % 2); const x = x0 - 2 + k; if (x >= 0 && x < W && NEARS.includes(idxNow[y * W + x])) blend(x, y - Math.round(Math.sin(t * 3 + k)), unpack(pal32[I.CLOUD]), 0.5); }
    }
    { // the drawbridge: raised for the night (it rises as the dusk deepens), lowered at dawn
      const g = scene.gate; const k = scene.bridgeK; const hgt = Math.round(k * g.h); const x0 = mx(g.x);
      for (let y = 0; y < hgt; y += 1) for (let x = 0; x < g.w; x += 1) put(x0 + x, g.crest - 1 - y, pal32[y % 3 === 1 ? I.ARM_SH : x % 2 ? I.TIMBER_SH : I.TIMBER]);
      if (hgt > 1) for (let j = 0; j < 3; j += 1) { put(x0 - 1, g.crest - hgt - j, pal32[I.ARM_SH]); put(x0 + g.w, g.crest - hgt - j, pal32[I.ARM_SH]); } // the chains
    }
    { // the river: ice after days of hard frost, its banks overrun after a wet week
      const frost = weather.frost ?? 9; const flood = clamp(((weather.rain7 ?? 0) - 35) / 30);
      const low = WET[weather.kind] || weather.rain7 == null ? 0 : clamp((6 - weather.rain7) / 6); // a dry week: the gravel shows
      if (low > 0 && frost > -3) {
        const off = shift(RATE[L.MID]) - M; const gravel = [pal32[I.MUD], pal32[I.STONE_SH], pal32[I.STONE], pal32[I.DIRT_SH]];
        for (let x = 0; x < W; x += 1) {
          const X = x - off; const top = scene.riverTop(X); const bot = scene.riverBot(X);
          const n = Math.round(low * (1.5 + (X % 7 === 0 ? 1 : 0))); // bars here and there wider
          for (let y = top; y <= bot; y += 1) {
            const i = y * W + x; if (idxNow[i] !== I.WATER && idxNow[i] !== I.WATER_HI) continue;
            if (y < top + n || y > bot - Math.round(n * 0.7)) { buf[i] = gravel[(x * 3 + y * 5) % 4]; idxNow[i] = I.MUD; } // (not mirrored over)
          }
        }
      }
      if (frost <= -3 || flood > 0) {
        const off = shift(RATE[L.MID]) - M; const BANK = [I.GRASS, I.GRASS_SH, I.GRASS_HI, I.MUD, I.REED, I.REED_SH, I.HILL, I.HILL_SH];
        for (let x = 0; x < W; x += 1) {
          const X = x - off; const top = scene.riverTop(X); const bot = scene.riverBot(X);
          if (frost <= -3) { // the whole breadth, the reflections dimmed under it; cracks here and there
            const ice = mix(unpack(pal32[I.SNOWFIELD]), unpack(pal32[I.WATER_HI]), 0.35);
            for (let y = top; y <= bot; y += 1) { const i = y * W + x; if (idxNow[i] < N_SKY) continue; buf[i] = pack(mix(unpack(buf[i]), (x * 7 + y * 13) % 29 === 0 ? unpack(pal32[I.WATER]) : ice, bayer(x, y) < 0.2 ? 0.6 : 0.82)); }
          }
          else for (let y = top - Math.round(flood * 2); y < top; y += 1) { const i = y * W + x; if (BANK.includes(idxNow[i])) buf[i] = pal32[bayer(x, y) < 0.3 ? I.WATER_HI : I.WATER]; }
        }
      }
    }
    if ((weather.rain7 ?? 0) > 10 || WET[weather.kind]) scene.seeps.forEach((sp, k) => { // the springs run after rain
      const x = mx(sp.x); for (let j = 1; j < 4; j += 1) blend(x, sp.y - j, unpack(pal32[I.WATER]), 0.35, false);
      const ph = reduce ? 1 : (t * 2 + k * 0.7) % 1; put(x, sp.y + Math.round(ph * 4), pal32[I.WATER_HI], false);
    });
    { // the lichen on the rock: the newest cells, at the rim, are the palest
      const ROCKS = [I.ROCK_HI, I.ROCK, I.ROCK_SH, I.ROCK_DK];
      scene.lichen.patches.forEach((p) => {
        const [body, rim] = p.species === 'xanthoria' ? [I.LEAF, I.LEAF2] : [I.MOSS, I.MOSS_HI];
        const n = p.cells.length;
        p.cells.forEach(([x, y], k) => {
          const sx = mx(x); if (sx < 0 || sx >= W) return;
          const i = y * W + sx;
          if (ROCKS.includes(idxNow[i])) blend(sx, y, unpack(pal32[k > n * 0.85 ? rim : body]), 0.8, false);
        });
      });
    }

    if (look.stars > 0.2) { // Blanc Blanc's star, rising each night over the fire where he sleeps
      const sx0 = scene.cats[1].x - M + groundOff(fire.y) + 3; const sy0 = Math.round(yHor * 0.3);
      const a = look.stars * (reduce ? 1 : 0.85 + 0.15 * Math.sin(t * 1.3));
      const warm = [255, 240, 200]; // (a little warmer and larger than the others: his)
      if (a > 0.6) put(sx0, sy0, pack([255, 253, 240]), true); else blend(sx0, sy0, [255, 255, 245], a, true);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { blend(sx0 + dx, sy0 + dy, warm, a * 0.75, true); blend(sx0 + 2 * dx, sy0 + 2 * dy, warm, a * 0.35, true); });
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dy]) => blend(sx0 + dx, sy0 + dy, warm, a * 0.2, true));
      scene.bbStar = [sx0, sy0];
    } else scene.bbStar = null;
    // stars
    if (look.stars > 0) {
      scene.stars.forEach((s) => {
        const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
        const a = Math.round(look.stars * tw * 4) / 4;
        const c = s.tint < 0.15 ? [255, 228, 170] : s.tint > 0.88 ? [180, 205, 255] : [255, 255, 255];
        blend(s.x, s.y, c, a, true);
        if (s.big && a > 0.5) NEIGH.forEach(([dx, dy]) => blend(s.x + dx, s.y + dy, c, a * 0.5, true));
      });
    }

    // shooting stars: streaks with a bright head, fading as they go
    scene.meteors.forEach((m) => {
      const a = 1 - m.age / m.life;
      for (let k = 0; k < 7; k += 1) blend(m.x - m.dx * k * 0.6, m.y - m.dy * k * 0.6, [255, 250, 230], a * (1 - k / 7) * 0.9, true);
    });

    // the planets at their true places, in twilight already (Venus first), each its colour
    const sunAlt = bodies.sun[2] / deg;
    bodies.planets.forEach((p) => {
      const [c, size] = PLANET_LOOK[p.name]; const show = clamp((-sunAlt - (size === 2 ? 1 : 5)) / 5);
      if (p.at[2] <= 0 || show <= 0) return;
      const x = Math.round(p.at[0]); const y = Math.round(p.at[1]);
      blend(x, y, c, show, true);
      if (size >= 1) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => blend(x + dx, y + dy, c, show * (size === 2 ? 0.55 : 0.3), true));
    });
    if (bodies.sky.solar.sep < bodies.sky.solar.touch && bodies.sun[2] > 0) { // the land darkens with the eclipse
      const f = solarCover(bodies.sky) ** 2 * 0.6;
      for (let i = 0; i < buf.length; i += 1) tint(i, 20, 24, 44, f);
    }
    // sun: disc and a dithered halo; moon: lit where it faces the sun (phase and tilt follow)
    const { sun, moon, light } = bodies;
    if (sun[2] > -3 * deg) {
      const rs = 5;
      for (let y = -rs - 3; y <= rs + 3; y += 1) {
        for (let x = -rs - 3; x <= rs + 3; x += 1) {
          const q = Math.hypot(x, y); const X = Math.round(sun[0]) + x; const Y = Math.round(sun[1]) + y;
          if (q <= rs) put(X, Y, pack(look.sun), true);
          else if (q <= rs + 3 && bayer(X, Y) < 0.5 - (q - rs) / 8) blend(X, Y, look.sun, 0.45, true);
        }
      }
      const sk = bodies.sky;
      if (sk.solar.sep < sk.solar.touch) { // the Moon's dark disc on it, offset towards the Moon
        const k = rs / sk.sunR; const dx = moon[0] - sun[0]; const dy = moon[1] - sun[1]; const n = Math.hypot(dx, dy) || 1;
        const mx0 = sun[0] + (dx / n) * sk.solar.sep * k; const my0 = sun[1] + (dy / n) * sk.solar.sep * k; const rr = sk.lunar.moonR * k;
        for (let y = -rr - 1; y <= rr + 1; y += 1) for (let x = -rr - 1; x <= rr + 1; x += 1) if (Math.hypot(x, y) <= rr) put(mx0 + x, my0 + y, pack([24, 26, 40]), true);
      }
    }
    const shadowAt = (x, y, rm) => { // 2 in the umbra, 1 in the penumbra, for moon pixel (x, y)
      const L = bodies.sky.lunar; if (L.sep > L.penumbra + L.moonR) return 0;
      const k = rm / L.moonR; const dx = bodies.anti[0] - moon[0]; const dy = bodies.anti[1] - moon[1]; const n = Math.hypot(dx, dy) || 1;
      const d = Math.hypot(x - (dx / n) * L.sep * k, y - (dy / n) * L.sep * k);
      return d < L.umbra * k ? 2 : d < L.penumbra * k ? 1 : 0;
    };
    if (moon[2] > -3 * deg) {
      const rm = 6;
      for (let y = -rm; y <= rm; y += 1) {
        for (let x = -rm; x <= rm; x += 1) {
          const q = (x * x + y * y) / (rm * rm);
          if (q > 1) continue;
          const lit = (x / rm) * light[0] + (y / rm) * light[1] + Math.sqrt(1 - q) * light[2] > 0;
          const X = Math.round(moon[0]) + x; const Y = Math.round(moon[1]) + y;
          const crater = (x * 7 + y * 13) % 11 === 0 && q < 0.6;
          const sh = shadowAt(x, y, rm);
          if (sh) { put(X, Y, pack(sh === 2 ? (crater ? [120, 50, 36] : [158, 70, 46]) : (crater ? [150, 150, 140] : [190, 186, 170])), true); continue; }
          if (lit) put(X, Y, pack(crater ? [196, 196, 186] : [240, 238, 220]), true);
          else blend(X, Y, [240, 238, 220], 0.12, true);
        }
      }
    }

    if (scene.starlings) scene.starlings.forEach((b) => put(b.x, b.y, pal32[I.OUTLINE], true)); // the murmuration
    skyVeil();
    // clouds drift west, as many as the real cover, as fast as the wind; at night, thin dithered wisps
    // under a closed sky the clouds turn grey and a second rank fills the gaps
    const grey = clamp((weather.cover - 0.6) * 2.5) * (look.night > 0.5 ? 0 : 1);
    const gc = (i, g) => pack(mix(unpack(pal32[i]), g, grey * 0.75));
    const pc = gc(I.CLOUD, WET[weather.kind] ? [126, 132, 144] : [178, 182, 190]); const ps = gc(I.CLOUD_SH, WET[weather.kind] ? [94, 100, 112] : [140, 146, 156]);
    const veil = 1 - 0.65 * look.night;
    const nCloud = Math.round(scene.clouds.length * clamp(0.15 + weather.cover)); const gust = 0.4 + clamp(weather.wind / 25, 0, 2);
    const ranks = weather.cover > 0.7 ? [[0, 0], [0.5, 0.18]] : [[0, 0]];
    ranks.forEach(([dx, dy]) => scene.clouds.forEach((c, j) => {
      if (j >= nCloud) return;
      const x0 = Math.round(((c.x + dx * W + (reduce ? 0 : t * c.v * gust * (windX() < 0 ? -1 : 1))) % (W + c.w) + (W + c.w)) % (W + c.w) - c.w);
      const y0 = c.y + Math.round(dy * scene.yHor);
      c.sx = x0; c.sy = y0; // where it is, for its shadow on the land
      for (let y = 0; y < c.h; y += 1) {
        for (let x = 0; x < c.w; x += 1) {
          const k = c.m[y * c.w + x];
          if (k && (veil === 1 || bayer(x0 + x, y0 + y) < veil)) put(x0 + x, y0 + y, k === 1 ? pc : ps, true);
        }
      }
    }));
    // a rainbow when it rains with the sun out, opposite the sun and 42 deg round its antisolar
    // point (so only while the sun is under 42 deg); on the sky and the far mountains
    {
      const alt = Math.asin(Math.sin(sun[2])) / deg; // sun[2]: its altitude, radians
      if ((WET[weather.kind] && weather.kind !== 'storm') && weather.cover < 0.9 && alt > 1 && alt < 41 && look.night < 0.2) {
        const span = yHor - Math.max(4, 0.06 * H); const R = (42 / 62) * span;
        const ax = clamp(W - sun[0], W * 0.15, W * 0.85); const ay = yHor + (alt / 62) * span;
        const bands = [[226, 70, 60], [240, 150, 60], [244, 220, 90], [110, 190, 90], [80, 130, 220], [140, 90, 200]];
        const bw = Math.max(1, Math.round(R * 0.03)); const a0 = 0.34 * (1 - weather.cover * 0.5);
        for (let y = Math.max(0, Math.floor(ay - R)); y < Math.min(yl0, ay); y += 1) {
          for (let x = Math.max(0, Math.floor(ax - R)); x < Math.min(W, ax + R); x += 1) {
            const k = Math.floor((R - Math.hypot(x - ax, y - ay)) / bw);
            if (k < 0 || k >= bands.length || idxNow[y * W + x] > FAR) continue;
            blend(x, y, bands[k], a0 * clamp((ay - y) / (R * 0.3)), false); // it fades into the haze low down
          }
        }
      }
    }
    if (scene.bolt) { // the lightning: its branches faint, the main channel white with a glow; behind the ranges
      const { b } = scene.bolt; const sky = (x, y) => x >= 0 && x < W && y >= 0 && y < H && idxNow[y * W + x] < I.MT_FAR;
      const at = (i) => [b.x0 + ((i % b.w) - (b.w >> 1)) * 2 + ((i * 7919) % 3) - 1, b.y0 + Math.floor(i / b.w) * 2]; // (a jag of its own per cell)
      b.cells.forEach((i) => {
        if (b.par[i] < 0) return;
        const [x1, y1] = at(i); const [x0, y0] = at(b.par[i]); const main = b.main.has(i);
        for (let k = 0; k <= 2; k += 1) {
          const x = Math.round(x0 + ((x1 - x0) * k) / 2); const y = Math.round(y0 + ((y1 - y0) * k) / 2);
          if (!sky(x, y)) continue;
          if (main) { put(x, y, pack([250, 246, 255]), false); [[1, 0], [-1, 0]].forEach(([dx]) => { if (sky(x + dx, y)) blend(x + dx, y, [190, 170, 255], 0.5, false); }); }
          else blend(x, y, [200, 190, 255], 0.55, false);
        }
      });
    }
    if (scene.geese) { // a V of geese, wings beating: south-west in autumn, back north-east in March
      const gc = pack(mix(look.bird, [90, 90, 96], 0.3));
      scene.geese.forEach((g, k) => {
        const up = (Math.floor(t * 3) + k) % 2;
        put(g.x, g.y, gc, true); put(g.x + 1, g.y, gc, true); put(g.x - 1, g.y - up, gc, true); put(g.x + 2, g.y - up, gc, true);
      });
    }
    scene.fireworks.forEach((f) => { // rockets climbing, then their sparks falling and fading
      if (f.rocket) { put(f.x, f.y, pack([255, 230, 180]), false); put(f.x, f.y + 1, pack([200, 120, 60]), false); return; }
      const a = 1 - f.age / f.life; put(f.x, f.y, pack(mix(f.c, [40, 30, 60], 1 - a)), false);
      if (a > 0.6) blend(f.x + 1, f.y, f.c, 0.4, false);
    });
    if (scene.birds) {
      const bc = pack(look.bird);
      scene.birds.forEach((b, k) => {
        const up = (Math.floor(t * 4) + k) % 2;
        put(b.x, b.y + up, bc, true); put(b.x + 1, b.y + 1, bc, true); put(b.x + 2, b.y + up, bc, true);
      });
    }

    // the dragon, high up: in front of the mountains, behind the trees and the castle
    const dg = scene.dragon;
    if (dg) {
      const sat = dg.land && dg.land.phase !== 'fly';
      const far = (x, y) => x >= 0 && x < W && y >= 0 && y < yl0 && (sat || idxNow[y * W + x] <= FAR);
      const sp = (dg.dir > 0 ? SPRITES.dragon : SPRITES.dragonL)[sat ? 1 : Math.floor(tick / 3) % 2];
      const x0 = Math.round(dg.x); const y0 = Math.round(dg.y);
      for (let y = 0; y < sp.h; y += 1) {
        for (let x = 0; x < sp.w; x += 1) {
          const c = sp.px[y * sp.w + x];
          if (c >= 0 && far(x0 + x, y0 + y)) buf[(y0 + y) * W + x0 + x] = pal32[c];
        }
      }
      dg.flames.forEach((f) => { if (far(Math.round(f.x), Math.round(f.y))) put(f.x, f.y, pack(hex(FIRE[Math.max(1, Math.round(FIRE_MAX * (1 - f.age / f.life)))])), false); });
    }

    if (look.night > 0.4) { // the watchtower's signal fire on the crest
      const wx = scene.watch.x - M + shift(RATE[L.NEAR]); const wy = scene.watch.y;
      const f = reduce ? 0 : Math.floor(t * 8) % 3;
      if (wx >= 0 && wx < W && idxNow[wy * W + wx] <= FAR) {
        put(wx, wy, pack(hex(FIRE[6 - f])), false); put(wx, wy - 1 - (f === 2 ? 1 : 0), pack(hex(FIRE[4 + f])), false);
        halo(wx, wy, 4, [255, 170, 70], 0.4 * look.night);
      }
    }

    // the castle's life: windows (glowing at night), pennants, torches, chimney smoke, sentries
    const wl = pal32[I.WIN_LIT]; const wd = pal32[I.WIN_DARK];
    if (scene.scribeWin && scribeLate()) scene.scribeWin.lit = true;
    const hh = clockFn().getHours(); const abed = hh >= 23 || hh < 6; // (the village goes to bed at eleven; the tavern keeps its lamps)
    scene.windows.forEach((w) => {
      const lit = w.lit && !(abed && w.village && !w.tavern);
      w.pts.forEach(([x, y]) => put(mx(x), y, lit ? wl : wd, false));
      if (w === scene.scribeWin && scribeLate()) { // the copyist bent over his desk, against the candlelight; his hand moves
        const [x0, y0] = w.pts[0]; const sil = pal32[I.OUTLINE];
        put(mx(x0 + 1), y0, sil, false); put(mx(x0 + 1), y0 + 1, sil, false); put(mx(x0), y0 + 1, sil, false);
        if (reduce || Math.floor(t * 2) % 3) put(mx(x0 + 2), y0 + 1, sil, false);
      }
      if (lit && w.big && look.night > 0.3) {
        const [x, y] = w.pts[1];
        [[-1, 0], [-1, 1], [2, 0], [2, 1]].forEach(([dx, dy]) => blend(mx(x + dx), y + dy, [255, 170, 70], 0.18 * look.night, false));
      }
    });
    scene.flags.forEach((f, k) => {
      const c = pal32[f.c]; const wave = (Math.floor(t * 3) + k) % 2; const x = mx(f.x);
      put(x, f.y, c); put(x + 1, f.y + wave, c); put(x + 2, f.y, c); put(x + 3, f.y + 1 - wave, c);
      put(x, f.y + 1, c); put(x + 1, f.y + 1, c); put(x + 2, f.y + 1, c);
      if (f.long) { put(x + 4, f.y + wave, c); put(x + 5, f.y + 1, c); }
    });
    { // the observatory: by night its slit opens and the telescope follows the highest planet (else the
      // Moon); by day it is parked, aimed high to the east
      const sc = scene.scope; const open = look.night > 0.4;
      const up = open && bodies ? [...bodies.planets.filter((q) => q.at[2] > 3 * deg)].sort((a, b) => b.at[2] - a.at[2])[0] : null;
      const tgt = up ? up.at : open && bodies && bodies.moon[2] > 3 * deg ? bodies.moon : null;
      if (open) for (let y = 1; y < sc.slit; y += 1) { put(mx(sc.x - 1), sc.t0 - 1 - y, pal32[I.OUTLINE], false); put(mx(sc.x + 1), sc.t0 - 1 - y, pal32[I.OUTLINE], false); }
      let ang = -Math.PI + 0.8; // (parked: up and to the east, on the left)
      if (tgt) ang = Math.atan2(tgt[1] - sc.y, tgt[0] - mx(sc.x)); // towards it on the screen
      ang = clamp(ang, -Math.PI + 0.35, -0.35); // (out through the slit, never down)
      for (let k = 1; k <= 5; k += 1) { const x = mx(sc.x) + Math.round(Math.cos(ang) * k); const y = sc.y + Math.round(Math.sin(ang) * k); put(x, y, pal32[k === 5 ? I.BLADE_SH : I.BLADE], false); put(x, y + 1, pal32[I.BLADE_SH], false); }
      scene.scopeAt = up ? up.name : tgt ? 'the Moon' : null;
    }
    scene.fumes.forEach((p) => {
      const a = (1 - p.age / p.life) * 0.6;
      for (let y = 0; y < p.r; y += 1) {
        for (let x = 0; x < p.r; x += 1) if (bayer(Math.round(p.x) + x, Math.round(p.y) + y) < a) blend(mx(p.x) + x, p.y + y, look.smoke, 0.7, false);
      }
    });
    { // the windmill's sails: four lattice arms, the cloth on their trailing side
      const [hx0, hy] = scene.mill.hub; const hx = mx(hx0); const L0 = scene.mill.len;
      const spar = pal32[I.TIMBER_SH]; const cloth = pal32[I.PLASTER_HI];
      for (let a = 0; a < 4; a += 1) {
        const ang = scene.millAngle + (a * Math.PI) / 2; const c = Math.cos(ang); const sn = Math.sin(ang);
        for (let k = 1; k <= L0; k += 1) {
          put(hx + c * k, hy + sn * k, spar, false);
          if (k > 2) { put(hx + c * k - sn, hy + sn * k + c, cloth, false); if (k > 3) put(hx + c * k - sn * 2, hy + sn * k + c * 2, (k % 2 ? cloth : spar), false); }
        }
      }
      put(hx, hy, pal32[I.OUTLINE], false);
    }
    if (look.night > 0.15) { // bats about the towers from dusk on, in jerky loops
      const bc = pack([30, 26, 38]); const top0 = scene.castleTop;
      for (let k = 0; k < 5; k += 1) {
        const ph = t * (1.1 + k * 0.13) + k * 1.9;
        const bx = mx(M + Math.round(0.64 * scene.Ws)) + Math.round(Math.sin(ph) * (14 + k * 4) + Math.sin(ph * 2.7) * 3); // round the castle
        const by = Math.round(top0 + 10 + k * 3 + Math.cos(ph * 1.3) * 8);
        const up = Math.floor(t * 10 + k) % 2;
        put(bx, by, bc, false); put(bx - 1, by - up, bc, false); put(bx + 1, by - up, bc, false);
      }
    }
    const guard = pal32[I.GUARD]; const tabard = pal32[I.GUARD_HI]; const spear = pal32[I.BLADE_SH];
    scene.sentries.forEach((s) => {
      const x = mx(Math.round(s.x)); const y = s.wall;
      put(x, y - 4, guard); put(x, y - 3, tabard); put(x, y - 2, tabard); put(x, y - 1, guard);
      put(x + 1, y - 5, spear); put(x + 1, y - 4, spear); put(x + 1, y - 3, spear);
      if (look.night > 0.3) { put(x - 1, y - 3, pack([255, 214, 120])); halo(x - 1, y - 3, 3, [255, 190, 90], 0.35 * look.night); }
    });
    if (scene.raven === undefined) { const nw = newsOf(); scene.raven = nw && nw.age < 7 && !session0('raven') ? { t0: t + 2 } : null; if (scene.raven) session0('raven', '1'); }
    if (scene.raven && t > scene.raven.t0) { // a raven with fresh news, from the west to the rookery's tower, once a visit
      const rv = scene.raven; const rk = scene.rooms[roomOf('news')]; const e = (t - rv.t0) / 7;
      if (e >= 1 || !rk) scene.raven = null;
      else {
        const tx = mx(rk.x) + rk.w / 2; const ty = rk.y + 2; const x = -6 + (tx + 6) * e; const y = H * 0.18 + (ty - H * 0.18) * e - Math.sin(e * Math.PI) * H * 0.08 + Math.sin(t * 9) * 0.6;
        const up = Math.floor(t * 8) % 2; const ink = pal32[I.OUTLINE];
        [[0, 0], [1, 0], [-1, up ? -1 : 1], [-2, up ? -1 : 1], [2, up ? -1 : 1], [3, up ? -1 : 1], [1, -1]].forEach(([dx, dy]) => put(Math.round(x) + dx, Math.round(y) + dy, ink, false));
      }
    }
    const hl = hoverId && view.state === 'scene' && scene.rooms[roomOf(hoverId)];
    if (hl) { // the part of the castle the menu points at: its stones warm, its windows lit, a mark
      const x0 = mx(hl.x); const pulse = 0.2 + 0.12 * Math.sin(t * 5);
      for (let y = Math.max(0, hl.y); y < Math.min(H, hl.y + hl.h); y += 1) {
        for (let x = Math.max(0, x0); x < Math.min(W, x0 + hl.w); x += 1) if (CASTLE.has(idxNow[y * W + x])) blend(x, y, [255, 214, 120], pulse, false);
      }
      scene.windows.forEach((w) => {
        if (w.pts[0][0] >= hl.x && w.pts[0][0] < hl.x + hl.w && w.pts[0][1] >= hl.y && w.pts[0][1] < hl.y + hl.h) w.pts.forEach(([x, y]) => put(mx(x), y, pack([255, 190, 80]), false));
      });
      const bob = Math.floor(t * 3) % 2; const mxc = x0 + Math.floor(hl.w / 2); const myc = hl.y - 4 - bob;
      [[0, 0], [-1, 1], [1, 1], [0, 2], [0, 1]].forEach(([dx, dy]) => put(mxc + dx, myc + dy, pal32[dx === 0 && dy === 1 ? I.GOLD_HI : I.GOLD], false));
      [[0, -1], [-2, 1], [2, 1], [0, 3]].forEach(([dx, dy]) => put(mxc + dx, myc + dy, pal32[I.OUTLINE], false));
    }
    if (look.night > 0.2) {
      scene.torches.forEach((tc, k) => {
        const hot = reduce || Math.sin(t * 17 + k * 3) > -0.3; const x = mx(tc.x);
        put(x, tc.y, pack([255, 220, 120]));
        put(x, tc.y - 1, pack(hot ? [255, 140, 50] : [220, 80, 30]));
        halo(x, tc.y, 3.5, [255, 170, 80], 0.4 * look.night);
      });
    }

    // the labourer of the month, by day: walks his field, sowing (or reaping) as he goes
    const pz = scene.peasant;
    if (pz && look.night < 0.4) {
      const f = scene.field; const frame0 = Math.floor(t * 3) % 2;
      const sp = pz.dir > 0 ? SPRITES.peasant[frame0] : flip(SPRITES.peasant[frame0]);
      const fy = Math.round((f.top(Math.round(pz.x)) + f.bot) / 2);
      blit(sp, mx(Math.round(pz.x)), fy - sp.h + 3, H);
      pz.seeds.forEach((q) => put(mx(q.x), q.y, pal32[f.season === 'summer' ? I.WHEAT : I.FL_YEL], false));
    }

    { // the bell: still, or swinging (and its peal in rings) for a while after the hour turns
      const b = scene.bell; const bx = mx(b.x); const ringing = t < scene.ringUntil;
      const sw = ringing && !reduce ? Math.round(Math.sin(t * 9)) : 0;
      put(bx, b.y, pal32[I.ARM_SH]);
      [[0, 1], [-1, 2], [0, 2], [1, 2], [-1, 3], [0, 3], [1, 3]].forEach(([dx, dy]) => put(bx + dx + (dy > 1 ? sw : 0), b.y + dy, pal32[dy === 3 ? I.GOLD_SH : I.GOLD], false));
      if (ringing) {
        const r = 4 + Math.floor((t * 4) % 4);
        for (let a = -0.9; a <= 0.9; a += 0.3) { blend(bx + Math.round(Math.cos(a) * r), b.y + 2 + Math.round(Math.sin(a) * r), [255, 240, 190], 0.5, true); blend(bx - Math.round(Math.cos(a) * r), b.y + 2 + Math.round(Math.sin(a) * r), [255, 240, 190], 0.5, true); }
      }
    }
    if (scene.hoist) { // the visitor's banner, up the keep's pole once every room has been seen
      const k = reduce ? 1 : clamp((t - scene.hoist.t0) / 3); const top = scene.keepTop; const x = mx(top.x);
      for (let y = 0; y < 14; y += 1) put(x, top.y - y, pal32[I.TIMBER_SH], false); // the pole
      put(x, top.y - 14, pal32[I.GOLD], false);
      const rowsA = (window.ARMS || {})[heraldry.own];
      if (rowsA) { // a small standard in the arms' two tinctures (the castle is too small for the whole coat)
        const field = pal32[I[TINCT[rowsA[1][1]]]];
        const charge = pal32[I[TINCT[[...rowsA.join('')].find((c) => c !== '.' && c !== rowsA[1][1]) || 'O']]];
        const by = Math.round(top.y - 4 - k * 10); const wave = reduce ? 0 : Math.floor(t * 2) % 2;
        for (let y = 0; y < 8; y += 1) for (let xx = 0; xx < 6; xx += 1) {
          if (y === 7 && (xx === 2 || xx === 3)) continue; // swallow-tailed
          const c = (xx >= 2 && xx <= 3 && y >= 2 && y <= 4) || (y === 3 && xx >= 1 && xx <= 4) ? charge : field;
          if (by + y < top.y - 1) put(x + 1 + xx, by + y + (xx > 3 ? wave : 0), c, false);
        }
      }
    }
    if (look.night > 0.3) { // a lamp at the cellar door
      const c = scene.cellar; const lx = mx(c.x - 1); const ly = c.y + 1;
      put(lx, ly, pack([255, 214, 120])); halo(lx, ly, 3, [255, 190, 90], 0.35 * look.night);
    }

    // the lake mirrors what stands above it, rippled, with a glint now and then
    const water = look.pal[I.WATER];
    for (let y = yl0; y < yg; y += 1) {
      const d = y - yl0; const sy = yl0 - 1 - d * 2; // squeezed: the castle shows in it
      if (sy < 0) continue;
      for (let x = 0; x < W; x += 1) {
        if (idxNow[y * W + x] !== I.WATER) continue;
        const off = reduce ? 0 : Math.round(Math.sin(y * 1.3 + t * 2.2 + x * 0.04) * (0.4 + d * 0.12));
        let c = mix(unpack(buf[sy * W + clamp(x + off, 0, W - 1)]), water, 0.35 + 0.02 * d).map((q) => q * 0.88);
        if (!reduce && ((((x - Math.floor(t * 5)) * 7 + y * 13) % 61) + 61) % 61 === 0) c = mix(c, [255, 255, 255], 0.45 * (1 - look.night * 0.6)); // glints drift with the current
        buf[y * W + x] = pack(c);
      }
    }
    if (moon[2] > 0 && look.night > 0.3) { // the moon's road: glints under it, shivering
      for (let y = yl0; y < yg; y += 1) {
        const spread = 1 + (y - yl0) * 0.35;
        for (let x = Math.floor(moon[0] - spread); x <= moon[0] + spread; x += 1) {
          if (x < 0 || x >= W || idxNow[y * W + x] !== I.WATER) continue;
          if (reduce ? bayer(x, y) < 0.3 : Math.sin(x * 3.1 + y * 7.7 + t * 4) > 0.55) blend(x, y, [240, 238, 210], 0.55 * look.night, false);
        }
      }
    }

    if (scene.wave && scene.wave.live) { // rings on the river where the stone touched: crests bright, troughs dark
      const wv = scene.wave; const off = shift(RATE[L.MID]) - M;
      for (let y = 1; y < wv.h - 1; y += 1) {
        const Y = wv.y0 + y;
        for (let x = 0; x < W; x += 1) {
          const X = x - off; if (X < 1 || X >= wv.w - 1) continue; const v = wv.u[y * wv.w + X];
          if (v > 0.1) blend(x, Y, [236, 246, 255], Math.min(0.7, v * 1.6), false); else if (v < -0.1) blend(x, Y, [20, 34, 60], Math.min(0.28, -v * 0.5), false);
        }
      }
    }
    if (scene.skip) { // the stone in the air between its touches
      const sk = scene.skip; const k = sk.hits.findIndex((q) => t < q.t);
      if (k >= 0) {
        const a = k ? sk.hits[k - 1] : sk.from; const b = sk.hits[k]; const f = clamp((t - a.t) / (b.t - a.t));
        put(mx(a.x + (b.x - a.x) * f), a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * (k ? 2 : 5), pal32[I.STONE_SH], false);
      }
    }
    if (real.bruegel && (weather.frost ?? 9) <= -3 && look.night < 0.4) { // on the ice, Bruegel's skaters, gliding to and fro before the hamlet
      const sk = real.bruegel.sprites.filter((q) => q.role === 'skater'); const hm = scene.hamlet;
      sk.slice(0, 7).forEach((sp, k) => {
        const span = hm.x1 + 30 - hm.x0; const ph = (reduce ? k * 0.9 : t * (0.05 + k * 0.011)) + k * 1.3;
        const X = hm.x0 + span * (0.5 + 0.45 * Math.sin(ph)); const dir = Math.cos(ph) >= 0 ? 1 : -1;
        const top = scene.riverTop(Math.round(X)); const bot = scene.riverBot(Math.round(X)); const Y = Math.round(top + 2 + ((k * 7) % Math.max(1, bot - top - 3)));
        const sx = mx(Math.round(X));
        for (let yy = 0; yy < sp.h; yy += 1) for (let xx = 0; xx < sp.w; xx += 1) { const c = sp.px[yy * sp.w + (dir > 0 ? xx : sp.w - 1 - xx)]; if (c >= 0) put(sx + xx, Y - sp.h + yy + 1, pal32[c], false); }
      });
    }
    if (scene.shoal) { // the shoal, dark backs under the surface, a flash of a flank now and then
      const dk = mix(unpack(pal32[I.WATER]), [10, 14, 24], 0.55);
      scene.shoal.forEach((f, k) => {
        const x = mx(Math.round(f.x)); const y = Math.round(f.y); const tx = x - Math.sign(f.vx || 1);
        [[x, y], [tx, y]].forEach(([X, Y]) => { if (X >= 0 && X < W && idxNow[Y * W + X] === I.WATER) blend(X, Y, dk, 0.75, false); });
        if (!reduce && Math.sin(t * 3 + k * 1.7) > 0.97) put(x, y, pal32[I.WATER_HI], false);
      });
    }
    { // the ferryman crosses the river, the current pushing him off his line (see step); the jetties
      const J = M + Math.round(0.52 * scene.Ws); const top = scene.riverTop(J); const bot = scene.riverBot(J);
      scene.ferry ||= Object.assign(ferryNew(Math.max(4, bot - top - 3)), { J, top, bot });
      const f = scene.ferry;
      [[top - 1, 1], [bot + 1, -1]].forEach(([y]) => { for (let x = -2; x <= 2; x += 1) put(mx(J + x), y, pal32[x % 2 ? I.TIMBER : I.TIMBER_HI], false); put(mx(J - 2), y + 1, pal32[I.TIMBER_SH], false); put(mx(J + 2), y + 1, pal32[I.TIMBER_SH], false); });
      const prog = f.wait > 0 ? 0 : clamp((f.tick || 0) / 8); // between two rows
      const row = f.r + (f.wait > 0 ? 0 : prog); const y = Math.round(f.dir > 0 ? top + 1 + row : bot - 1 - row);
      const x = mx(J + f.px);
      for (let k = -3; k <= 3; k += 1) { put(x + k, y, pal32[I.TIMBER], false); put(x + k, y + 1, pal32[I.TIMBER_SH], false); }
      put(x - 4, y - 1, pal32[I.TIMBER_HI], false); put(x + 4, y - 1, pal32[I.TIMBER_HI], false);
      [[0, -1, I.CLOAK_SH], [0, -2, I.CLOAK], [0, -3, I.SKIN], [0, -4, I.HAT]].forEach(([dx, dy, c]) => put(x + dx, y + dy, pal32[c], false));
      const oar = f.last === 0 ? -1 : f.last === 2 ? 1 : 0; // the stroke he took, an oar out to that side
      if (oar && f.wait <= 0) { put(x + oar * 2, y - 1, pal32[I.TIMBER_SH], false); put(x + oar * 3, y, pal32[I.TIMBER_SH], false); }
      if (!reduce && f.wait <= 0) put(x - Math.sign(ferryCurrent() || 1) * 5, y + 1, pal32[I.WATER_HI], false); // the wash
      if (look.night > 0.3) put(x + 2, y - 2, pack([255, 214, 120]), false);
    }

    { // the heron in the shallows; the ducks paddle up and down the reach east of the bridge
      const hn = scene.heron; blit(SPRITES.heron, mx(hn.x), hn.y + (reduce ? 0 : Math.floor(t / 3) % 5 === 0 ? 1 : 0));
      scene.ducks.forEach((d) => {
        const x = Math.round(d.x); const sp = d.dir < 0 ? SPRITES.duck : SPRITES.duckR;
        const y = Math.round((scene.riverTop(x) + scene.riverBot(x)) / 2) - sp.h + 2;
        blit(sp, mx(x) - Math.floor(sp.w / 2), y, scene.riverBot(x) + 1);
        if (!reduce && Math.floor(t * 2 + d.ph) % 2) put(mx(x) + d.dir * -4, y + sp.h - 1, pal32[I.WATER_HI], false); // its wake
      });
    }
    { // mist on the river at dawn, and in fog
      const alt = Math.asin(Math.sin(sun[2])) / deg; const morning = clockFn().getHours() < 12;
      const k = weather.kind === 'fog' ? 1 : morning && alt > -6 && alt < 9 ? 1 - Math.abs(alt - 1.5) / 7.5 : 0;
      if (k > 0) {
        const c = look.night > 0.5 ? [150, 160, 180] : [228, 232, 238];
        for (let y = yl0 - 5; y < yg + 2; y += 1) {
          const fade = 1 - Math.abs(y - (yl0 + yg) / 2) / ((yg - yl0) / 2 + 6);
          for (let x = 0; x < W; x += 1) {
            const n = Math.sin(x * 0.06 + t * 0.25 + y * 0.4) + Math.sin(x * 0.021 - t * 0.13 + y * 0.9) * 0.8;
            if (n > 0.35) blend(x, y, c, 0.42 * k * fade * Math.min(1, n - 0.35 + 0.3) * (1 - fogAt(x, y)), false);
          }
        }
      }
    }

    const wk = scene.walker; // a passer-by on the castle road, far part (the hill, the bridge): drawn small, smaller further off
    /** The passer-by at height h px (4 far .. 8 near the meadow), feet at (x, y): legs that step, a coat,
     *  a head, a hat when big enough; by night a lantern lights its bearer, so the figure shows round its light. */
    const smallWalker = (x, y, h, k) => {
      const coat = { messenger: I.FLAG, peddler: I.TIMBER, rider: I.CLOTH }[k.kind] || I.CLOAK;
      const lit = k.kind === 'lantern' && look.night > 0.4; const C = (i) => (lit ? pack(mix(unpack(pal32[i]), mix(hex(DAYLIGHT[i]), [255, 196, 120], 0.35), 0.75)) : pal32[i]); // (by its own lantern: near its day colours, warmed)
      const legH = Math.max(1, Math.round(h * 0.3)); const bodyH = Math.max(1, Math.round(h * 0.4)); const wide = h >= 6;
      const step = !reduce && Math.floor(t * 4) % 2;
      if (k.kind === 'rider') { for (let dx = -2; dx <= 2; dx += 1) { put(x + dx, y - legH, C(I.LEATHER), false); if (Math.abs(dx) === 2) put(x + dx, y - (step ? 0 : 1), C(I.LEATHER_SH), false); } put(x - 2 * (k.dir < 0 ? 1 : -1), y - legH - 1, C(I.LEATHER), false); } // his horse
      else for (let r = 0; r < legH; r += 1) { if (wide) { put(x - 1 + (step && r === legH - 1 ? -1 : 0), y - r, C(I.CLOAK_SH), false); put(x + 1 + (!step && r === legH - 1 ? 1 : 0), y - r, C(I.CLOAK_SH), false); } else put(x, y - r, C(I.CLOAK_SH), false); }
      const by = y - legH - (k.kind === 'rider' ? 1 : 0);
      for (let r = 0; r < bodyH; r += 1) for (let dx = wide ? -1 : 0; dx <= (wide ? 1 : 0); dx += 1) put(x + dx, by - r, C(coat), false);
      const hy = by - bodyH; put(x, hy, C(I.SKIN), false); if (h >= 7) { put(x, hy - 1, C(I.SKIN), false); put(x - 1, hy - 2, C(I.HAT), false); put(x, hy - 2, C(I.HAT), false); put(x + 1, hy - 2, C(I.HAT), false); }
      if (k.kind === 'lantern') { const lx = x + (wide ? 2 : 1); const ly = by - Math.floor(bodyH / 2); put(lx, ly, pack([255, 214, 120]), false); halo(lx, ly, 2 + h * 0.4, [255, 190, 90], 0.4 * look.night); }
      if (k.kind === 'peddler') { const cx0 = x - k.dir * (wide ? 3 : 2); put(cx0, y - 1, C(I.TIMBER), false); put(cx0 - k.dir, y - 1, C(I.FL_RED), false); put(cx0, y, C(I.OUTLINE), false); if (wide) { put(cx0 - k.dir, y - 2, C(I.FL_YEL), false); put(cx0 - k.dir, y, C(I.OUTLINE), false); } } // his barrow
      if (k.kind === 'messenger' && h >= 5) { for (let r = 0; r < h; r += 1) put(x + 2, y - r, C(I.TIMBER_SH), false); put(x + 3, y - h + 1, C(I.FLAG), false); }
    };
    /** Its size on the road: 4 px over the hill, growing across the bridge and the meadow's edge, then the full sprite. */
    const walkerH = (y) => (y < scene.yl0 - 2 ? 4 : Math.min(8, Math.round(5 + ((y - scene.yl0) / (yg + 10 - scene.yl0)) * 3)));
    if (wk && wk.y < yg) { const y = Math.round(wk.y); smallWalker(mx(Math.round(scene.pathX[y])), y, walkerH(y), wk); }
    { // market day (see marketDay): two stalls with striped awnings by the hamlet, folk about them
      const d = today(); const close = zoom && zoom.done; // (close up, villageView draws them)
      if (marketDay(d) && look.night < 0.3) {
        const x0 = scene.hamlet.x1 + 1;
        if (!close) [[0, I.FLAG], [9, I.FLAG2]].forEach(([dx, c]) => {
          const x = mx(x0 + dx); const y = scene.riverTop(x0 + dx) - 3;
          for (let k = 0; k < 7; k += 1) { put(x + k, y - 6, k % 2 ? pal32[c] : pal32[I.FL_WHITE], false); put(x + k, y - 5, k % 2 ? pal32[c] : pal32[I.FL_WHITE], false); }
          put(x, y - 4, pal32[I.TIMBER_SH], false); put(x + 6, y - 4, pal32[I.TIMBER_SH], false);
          for (let k = 0; k < 7; k += 1) put(x + k, y - 2, pal32[I.TIMBER], false);
          put(x + 1, y - 3, pal32[I.RUST_HI], false); put(x + 3, y - 3, pal32[I.GRASS_HI], false); put(x + 5, y - 3, pal32[I.FL_YEL], false); // the wares
        });
        const mk = marketOf(d.getHours());
        if (!close && scene.marketShow > t) mk.m.forEach((v, k) => { // its density, shown a while on a click
          const x = mx(mk.x0 + k); const y = scene.riverTop(mk.x0 + k) - 11; // (over the awnings)
          for (let j = 0; j < Math.round(v * mk.m.length * 3); j += 1) blend(x, y - j, [255, 244, 214], 0.7, false);
        });
        if (!close) mk.folk.forEach((f) => { // the villagers, each walking by the game's policy (see step)
          const px0 = mk.x0 + f.pos; const x = mx(Math.round(px0)); const y = scene.riverTop(Math.round(px0)) - 3;
          put(x, y - 1, pal32[f.c], false); put(x, y, pal32[f.c === I.ROBE ? I.ROBE_SH : I.CLOAK_SH], false); put(x, y - 2, pal32[I.SKIN], false);
        });
      }
    }

    { // the shepherd's flock on the hill east of the path (high in summer, low in winter), or, on the
      // first Sunday of the month, a tournament there instead
      const d = today(); const h = d.getHours();
      if (d.getDay() === 0 && d.getDate() <= 7 && h >= 10 && h < 17 && look.night < 0.3) {
        const jt = scene.joust ||= (() => { const x0 = M + Math.round(0.74 * scene.Ws); return { x0, y: Math.round(scene.hill[x0] + 6), len: 26 }; })();
        const y = jt.y; for (let k = 0; k < jt.len; k += 1) put(mx(jt.x0 + k), y, pal32[k % 4 ? I.TIMBER : I.TIMBER_SH], false); // the tilt
        [[-4, I.FLAG], [jt.len + 3, I.FLAG2]].forEach(([dx, c]) => { const x = mx(jt.x0 + dx); for (let r = 0; r < 4; r += 1) for (let q = -r; q <= r; q += 1) put(x + q, y - 4 + r, pal32[(q + r) % 2 ? c : I.FL_WHITE], false); }); // pavilions
        const ph = reduce ? 0.3 : (t % 6) / 6; const run = clamp(ph * 1.25);
        [[jt.x0 + run * jt.len, 1, I.FLAG, -1], [jt.x0 + jt.len - run * jt.len, -1, I.FLAG2, 1]].forEach(([X, dir, c, side]) => {
          const x = mx(Math.round(X)); const yy = y + side * 2;
          put(x, yy, pal32[I.TIMBER_SH], false); put(x + 1, yy, pal32[I.TIMBER_SH], false); put(x - 1, yy, pal32[I.TIMBER_SH], false); put(x + dir, yy - 1, pal32[I.TIMBER_SH], false); // the horse
          put(x, yy - 1, pal32[c], false); put(x, yy - 2, pal32[I.ARM_HI], false); // the knight
          for (let k = 1; k <= 3; k += 1) put(x + dir * k, yy - 2, pal32[I.TIMBER_HI], false); // the lance
        });
        if (Math.abs(run - 0.5) < 0.04) put(mx(Math.round(jt.x0 + jt.len / 2)), y - 3, pal32[I.CREAM], false); // a lance splinters
      } else if (look.night < 0.5) {
        const fl = scene.flock ||= (() => { // the pasture: the widest open stretch of grass on the east hill
          const summer = [5, 6, 7, 8].includes(d.getMonth()); const mid = scene.planes[L.MID]; const WE = scene.WE;
          const GRASS = new Set([I.HILL_HI, I.HILL, I.HILL_SH, I.GRASS, I.GRASS_HI, I.GRASS_SH, I.GRASS_LT]);
          const top = (x) => Math.round(scene.hill[clamp(Math.round(x), 0, WE - 1)]) + (summer ? 2 : 5); // higher in summer
          const open = (x) => { for (let y = top(x); y < top(x) + 9; y += 1) if (!GRASS.has(mid[y * WE + x])) return false; return true; };
          let best = [0, 0]; let run = 0;
          for (let x = M + Math.round(0.58 * scene.Ws); x < M + Math.round(0.95 * scene.Ws); x += 1) { run = open(x) ? run + 1 : 0; if (run > best[1] - best[0]) best = [x - run + 1, x + 1]; }
          const [a, b] = best[1] - best[0] >= 24 ? best : [M + Math.round(0.74 * scene.Ws), M + Math.round(0.84 * scene.Ws)];
          const mid0 = (a + b) / 2;
          return { summer, top, a, b, sh: { x: mid0, tx: mid0 }, dog: { a: 0 },
            sheep: Array.from({ length: 9 }, (_, k) => ({ x: a + 3 + ((k * 7) % Math.max(4, b - a - 8)), dy: 1 + ((k * 5) % 6), vx: 0, dir: k % 2 ? 1 : -1, graze: k * 0.7 })) };
        })();
        [...fl.sheep].sort((p, q) => p.dy - q.dy).forEach((q) => { // a woolly back, a black face, four legs as two
          const x = mx(Math.round(q.x)); const y = fl.top(q.x) + q.dy; const f = q.dir; const down = !reduce && Math.sin(t * 0.7 + q.graze * 3) > 0.3; // grazing
          put(x - 1, y - 1, pal32[I.FL_WHITE], false); put(x, y - 1, pal32[I.FL_WHITE], false); put(x + 1, y - 1, pal32[I.CREAM], false);
          put(x - 1, y, pal32[I.CREAM], false); put(x, y, pal32[I.CREAM], false); put(x + 1, y, pal32[I.CREAM], false);
          put(x + 2 * f, y - (down ? 0 : 1), pal32[I.OUTLINE], false); // the head
          put(x - 1, y + 1, pal32[I.OUTLINE], false); put(x + 1, y + 1, pal32[I.OUTLINE], false); // the legs
        });
        const sx = mx(Math.round(fl.sh.x)); const sy = fl.top(fl.sh.x) + 3; // the shepherd and his crook
        put(sx, sy, pal32[I.CLOAK_SH], false); put(sx, sy - 1, pal32[I.TIMBER], false); put(sx, sy - 2, pal32[I.TIMBER], false); put(sx, sy - 3, pal32[I.SKIN], false); put(sx, sy - 4, pal32[I.HAT], false);
        for (let k = 0; k < 5; k += 1) put(sx + 2, sy - k, pal32[I.TIMBER_SH], false); put(sx + 3, sy - 5, pal32[I.TIMBER_SH], false); put(sx + 3, sy - 4, pal32[I.TIMBER_SH], false);
        const cx0 = fl.sheep.reduce((acc, q) => acc + q.x, 0) / fl.sheep.length; // the dog keeps them together, running round them
        const dgx = cx0 + Math.cos(fl.dog.a) * ((fl.b - fl.a) / 2 + 3); const dgy = fl.top(dgx) + 4 + Math.round(Math.sin(fl.dog.a) * 3);
        put(mx(Math.round(dgx)), dgy, pal32[I.OUTLINE], false); put(mx(Math.round(dgx)) + 1, dgy, pal32[I.OUTLINE], false); put(mx(Math.round(dgx)) + (Math.sin(fl.dog.a) > 0 ? 2 : -1), dgy - 1, pal32[I.OUTLINE], false); put(mx(Math.round(dgx)), dgy + 1, pal32[I.FL_WHITE], false);
      }
    }
    if (scene.burn) { // the St John's fire running through the dry grass of the field
      const b = scene.burn;
      for (let k = 0; k < b.g.length; k += 1) {
        const v = b.g[k]; if (v < 2) continue;
        const X = b.x0 + (k % b.w) * 2; const Y = Math.round(scene.hill[X]) + 3 + Math.floor(k / b.w) * 2;
        const c = v === 2 ? pack(hex(FIRE[(reduce || Math.random() < 0.5) ? 7 : 5])) : pal32[I.DIRT_SH];
        put(mx(X), Y, c, false); put(mx(X) + 1, Y, c, false); if (v === 2) put(mx(X), Y - 1, pack(hex(FIRE[4])), false);
      }
    }
    if (scene.sir) scene.sir.nodes.forEach((n) => { // a cold going round: steam of herb tea at the sick houses' doors
      if (n.s !== 1) return; const x = mx(n.x); for (let k = 0; k < 3; k += 1) blend(x + Math.round(Math.sin(t * 2 + k) * 1), n.y - 3 - k - ((Math.floor(t * 3) + k) % 2), [226, 236, 220], 0.55 - k * 0.12, false);
    });
    if (!(zoom && zoom.done)) villageLife(today(), t).forEach((a) => { // the villagers' day, small from here
      const x = mx(Math.round(a.x)); const y = a.y - (a.hop ? 1 : 0);
      if (a.small) { put(x, y, pal32[a.c], false); put(x, y - 1, pal32[I.SKIN], false); return; }
      put(x, y, pal32[I.CLOAK_SH], false); put(x, y - 1, pal32[a.c], false); put(x, y - 2, pal32[I.SKIN], false);
      if (a.role === 'smith' && !reduce && Math.floor(t * 3) % 2) put(x + a.dir, y - 1, pack([255, 220, 150]), false);
      if (a.role === 'minstrel' && !reduce && Math.floor(t) % 3 === 0) put(x + 1, y - 4 - (Math.floor(t * 2) % 3), pal32[I.CREAM], false);
    });
    { // the water mill's wheel turning in the stream (faster in spate), its spray
      const wm = scene.wmill; const x0 = mx(wm.x); const y0 = wm.y; const a0 = scene.wheel; const R = 4;
      for (let a = 0; a < 6.28; a += 0.25) put(x0 + Math.round(Math.cos(a) * R), y0 + Math.round(Math.sin(a) * R), pal32[I.TIMBER]);
      for (let k = 0; k < 8; k += 1) { const a = a0 + (k * Math.PI) / 4; put(x0 + Math.round(Math.cos(a) * R), y0 + Math.round(Math.sin(a) * R), pal32[I.TIMBER_HI]); put(x0 + Math.round(Math.cos(a) * 2), y0 + Math.round(Math.sin(a) * 2), pal32[I.TIMBER_SH]); }
      put(x0, y0, pal32[I.ARM_SH]);
      if (!reduce) for (let k = 0; k < 3; k += 1) blend(x0 + R + 1 + k, y0 + R - 1 - ((Math.floor(t * 6) + k) % 2), [255, 255, 255], 0.5, false);
    }
    if (look.night < 0.4) { // the quarryman at the face, his hammer rising and falling
      const q = scene.quarry; const x = mx(q.x + q.w - 2); const y = q.y - 1; const up = !reduce && Math.floor(t * 2.5) % 2;
      put(x, y, pal32[I.CLOAK_SH], false); put(x, y - 1, pal32[I.RUST], false); put(x, y - 2, pal32[I.SKIN], false);
      put(x - 1, y - 2 - (up ? 1 : 0), pal32[I.TIMBER_SH], false); put(x - 2, y - 2 - (up ? 2 : 0), pal32[I.ARM_SH], false);
      if (!up && Math.floor(t * 2.5) % 4 === 0) put(x - 3, y - 1, pack([255, 240, 200]), false); // a spark off the stone
    }

    { // the river gauge by the bridge: red and white bars a pixel each, the water at this week's level
      const g = scene.gauge; const x = mx(g.x); const flood = clamp(((weather.rain7 ?? 0) - 35) / 30);
      const low = WET[weather.kind] || weather.rain7 == null ? 0 : clamp((6 - weather.rain7) / 6);
      const wy = scene.riverTop(g.x) - Math.round(flood * 2) + Math.round(low * 1.5);
      for (let y = g.top; y <= g.bot; y += 1) {
        put(x, y, pal32[(y - g.top) % 2 ? I.FL_WHITE : I.FLAG], false); put(x + 1, y, pal32[I.TIMBER_SH], false);
        if (y >= wy) { blend(x, y, unpack(pal32[I.WATER]), 0.6, false); blend(x + 1, y, unpack(pal32[I.WATER]), 0.6, false); }
      }
      put(x, wy, pal32[I.WATER_HI], false); put(x - 1, wy, pal32[I.WATER_HI], false); put(x + 2, wy, pal32[I.WATER_HI], false);
    }
    { // a sea of fog in the valley on still, damp, clear nights and mornings (a temperature inversion):
      // the river, the village and the foot of the hill under it, the castle on its rock above
      const h = clockFn().getHours(); const sea = new URLSearchParams(location.search).has('inversion') || (forced.fogsea || 0) > t;
      if (sea || (weather.cover < 0.5 && weather.wind < 10 && (weather.humid ?? 0) >= 92 && !WET[weather.kind] && weather.kind !== 'snow' && (look.night > 0.3 || h < 10))) {
        const c = look.night > 0.5 ? [112, 120, 144] : mix([236, 238, 242], look.sun, 0.15);
        const base = yl0 - 10;
        for (let x = 0; x < W; x += 1) {
          const top = base + Math.round(Math.sin(x * 0.05 + t * 0.1) * 1.5 + Math.sin(x * 0.013 - t * 0.05) * 2.5);
          for (let y = Math.max(0, top - 1); y < Math.min(H, yg + 3); y += 1) {
            const i = y * W + x; if (idxNow[i] <= FAR) continue; // (the ranges stand clear above it)
            const depth = y - top;
            if (depth < 3 && bayer(x, y) > 0.35 + depth * 0.22) continue; // its upper edge, frayed
            tint(i, c[0], c[1], c[2], Math.min(0.88, 0.5 + depth * 0.05));
          }
        }
      }
    }
    composite(L.GROUND);
    if (scene.hunt && real.bruegel) { // Bruegel's hunters coming home through the snow, their hounds about them
      const sps = real.bruegel.sprites; const hu = scene.hunt; const step = !reduce && Math.floor(t * 3) % 2;
      hu.party.forEach((m) => {
        const sp = sps[m.k]; const x = Math.round(hu.x + m.dx); const y = Math.round(hu.y + m.dy); const sx = x - M + groundOff(y);
        const bob = (m.k + step) % 2;
        for (let yy = 0; yy < sp.h; yy += 1) for (let xx = 0; xx < sp.w; xx += 1) { const c = sp.px[yy * sp.w + (sp.w - 1 - xx)]; if (c >= 0) put(sx + xx, y - sp.h + yy - bob, pal32[c], false); } // (mirrored: they walk west)
      });
    }
    { // what the weather leaves on the meadow: rings on the puddles while it rains, footprints in the snow
      const go1 = (x, y) => x - M + groundOff(y);
      if (WET[weather.kind] && !reduce && snowCover() < 0.2 && scene.puddles.length) for (let k = 0; k < 5; k += 1) {
        const q = scene.puddles[Math.floor(Math.random() * scene.puddles.length)];
        if (q.q < 0.6) { put(go1(q.x, q.y), q.y, pal32[I.WATER_HI], false); put(go1(q.x, q.y) + 1, q.y, pal32[I.WATER_HI], false); }
      }
      if (snowCover() > 0.05) scene.prints.forEach((f) => put(f.l === L.GROUND ? go1(f.x, f.y) : mx(f.x), f.y, pal32[I.SNOW_SH], false));
      if (antsOut()) { // the ants: each way darker as it is marked, the ants on them, a crumb for those coming back
        const a = scene.ants; const tot = a.tau[0] + a.tau[1];
        a.ways.forEach((w, j) => w.forEach(([x, y], k) => { if (k % 2 === 0 && bayer(x, y) < (a.tau[j] / tot) * 0.9) blend(go1(x, y), y, unpack(pal32[I.DIRT_SH]), 0.5, false); }));
        a.ants.forEach((n) => { if (n.s < 0) return; const [x, y] = antAt(a, n); put(go1(x, y), y, pal32[I.OUTLINE], false); if (n.dir < 0) put(go1(x, y) + 1, y, pal32[I.FL_WHITE], false); });
      }
    }

    if (scene.flies2) { // fireflies, flashing; together, once they have found each other
      scene.flies2.forEach((f) => {
        const fl = Math.cos(f.th); if (fl < 0.9) return;
        const a = (fl - 0.9) * 10; put(f.x, f.y, pack([210, 255, 120]), false);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => blend(f.x + dx, f.y + dy, [190, 255, 110], 0.5 * a, false));
      });
    }
    { // bees about the hives in the orchard, on warm days
      const o = scene.orchard; const warm = (weather.temp ?? 15) >= 10 && scene.season !== 'winter' && look.night < 0.3 && !WET[weather.kind];
      if (warm && !reduce) o.skeps.forEach((h, j) => {
        for (let k = 0; k < 4; k += 1) {
          const a = t * (1.5 + k * 0.4) + k * 1.7 + j; const x = gx(h.x, h.y) + Math.round(Math.cos(a) * (3 + k)); const y = h.y - 2 + Math.round(Math.sin(a * 1.3) * 2);
          put(x, y, pal32[(k + Math.floor(t * 8)) % 2 ? I.FL_YEL : I.OUTLINE], false);
        }
      });
    }

    { // the angler on the near bank, by day: his line in the water; now and then a fish jumps
      const an = scene.angler; const ax = gx(an.x, an.y + 6);
      if (look.night < 0.5) {
        blit(SPRITES.angler, ax, an.y);
        const tipX = ax + 13; const tipY = an.y - 6; // the rod, bending a little, then the line down
        for (let k = 0; k <= 8; k += 1) put(ax + 6 + k * 0.9, an.y + 4 - k * 1.25 + (k * k) * 0.02, pal32[I.TIMBER_SH], false);
        for (let y = tipY + 1; y < an.wy; y += 1) put(tipX, y, pack([200, 200, 200]), false);
        if (!reduce && Math.floor(t * 1.2) % 2) put(tipX, an.wy, pal32[I.WATER_HI], false); // the float bobs
      }
      const f = scene.fish;
      if (f) { const fx = mx(f.x); const fy = Math.round(f.y); put(fx, fy, pack([200, 210, 220]), false); put(fx + f.dir, fy - 1, pack([170, 180, 190]), false); if (f.age > 8) put(fx - f.dir, fy + 2, pal32[I.WATER_HI], false); }
    }

    // cloud shadows drift over the land when the sun is out between clouds
    if (weather.cover > 0.12 && weather.cover < 0.85 && Math.asin(Math.sin(sun[2])) / deg > 6) {
      scene.clouds.forEach((c) => {
        if (c.sx === undefined || c.h < 4) return;
        const cx0 = c.sx + c.w / 2 + (W / 2 - sun[0]) * 0.15; const cy0 = yl0 + 4 + (c.sy / yHor) * (H - yl0) * 1.6;
        const rx = c.w * 0.55; const ry = Math.max(3, c.h * 0.45);
        for (let y = Math.floor(cy0 - ry); y <= cy0 + ry; y += 1) {
          if (y < yl0 - 30 || y >= H) continue;
          for (let x = Math.floor(cx0 - rx); x <= cx0 + rx; x += 1) {
            if (x < 0 || x >= W || idxNow[y * W + x] <= FAR) continue;
            const q = ((x - cx0) / rx) ** 2 + ((y - cy0) / ry) ** 2;
            if (q < 1 && bayer(x, y) < 1.4 - q) tint(y * W + x, 20, 30, 40, 0.16);
          }
        }
      });
    }

    { // the knight's horse grazes, swishing its tail; deer at the forest's edge at dawn and dusk
      const gh = groundOff(fire.y) - M; const hs = scene.horse;
      blit(SPRITES.horse[!reduce && Math.floor(t / 0.35) % 9 === 0 ? 1 : 0], hs.x + gh, hs.y);
      const alt = Math.asin(Math.sin(sun[2])) / deg;
      if (alt > -8 && alt < 6) scene.deer.forEach((d) => {
        const sp = SPRITES.deer[reduce || Math.floor(t / 2.5 + d.ph) % 3 === 0 ? 0 : 1];
        blit(sp, gx(d.x, d.y), d.y - sp.h);
      });
    }
    { // the festival of the day, if any
      const fe = festival(today()); const kind = fe && fe[0]; const go0 = groundOff(fire.y) - M; const hm = scene.hamlet;
      const glow = (x, y, c, r0) => { put(x, y, pack(c), false); if (look.night > 0.3) halo(x, y, r0, c, 0.4 * look.night); };
      if (kind === 'samhain') { // pumpkins at the doors and by the fire, lit from within after dark
        const pumpkin = (x, y) => {
          [[0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2]].forEach(([dx, dy]) => put(x + dx, y + dy, pal32[I.RUST_HI], false));
          put(x + 1, y - 1, pal32[I.FERN_SH], false);
          const eye = look.night > 0.3 ? pack([255, 230, 120]) : pal32[I.OUTLINE]; put(x, y + 1, eye, false); put(x + 2, y + 1, eye, false);
          if (look.night > 0.3) halo(x + 1, y + 1, 3, [255, 160, 60], 0.35 * look.night);
        };
        hm.doors.forEach(([x, y]) => pumpkin(mx(x) + 2, y - 2));
        pumpkin(fire.x + go0 - 16, fire.y + 6); pumpkin(fire.x + go0 + 5, fire.y + 9);
      }
      if (kind === 'music') { // a minstrel west of the wizard; notes rise from the lute
        const ms = SPRITES.minstrel; const x0 = scene.wizard.x + go0 - ms.w - 3; const y0 = fire.y + 6 - ms.h;
        blit(ms, x0, y0 + (reduce ? 0 : Math.floor(t * 2) % 2));
        scene.minstrelAt = [x0 + 7, y0 + 6];
        scene.notes.forEach((n) => { const c = pack([250, 240, 200]); put(n.x, n.y, c, false); put(n.x + 1, n.y, c, false); put(n.x + 1, n.y - 1, c, false); put(n.x + 1, n.y - 2, c, false); });
      } else scene.minstrelAt = null;
      if (kind === 'stjohn' && look.night > 0.3) scene.bonfires.forEach(([x, y, l]) => { // fires on the hills
        const sx = x - M + shift(RATE[l]); const f = reduce ? 0 : Math.floor(t * 9 + x) % 3;
        put(sx, y, pack(hex(FIRE[6])), false); put(sx, y - 1, pack(hex(FIRE[5 - f])), false); put(sx + (f === 1 ? 1 : 0), y - 2, pack(hex(FIRE[4])), false);
        halo(sx, y - 1, 5, [255, 160, 60], 0.45 * look.night);
      });
      if (kind === 'advent' || kind === 'christmas') { // lights along the eaves, twinkling
        const C = [[255, 90, 80], [255, 220, 100], [110, 200, 255], [130, 240, 130]];
        hm.eaves.forEach(([a, b, y]) => { for (let x = a; x <= b; x += 2) { const k = (x + Math.floor(t * 1.5)) % 4; put(mx(x), y, pack(look.night > 0.3 ? C[k] : mix(C[k], [90, 80, 70], 0.5)), false); } });
        if (today().getMonth() === 11 || today().getMonth() === 0) { const sm = SPRITES.snowman; blit(sm, gx(M + Math.round(0.2 * scene.Ws), yg + 14), yg + 14 - sm.h); }
      }
      if (kind === 'christmas' && hm.spire) glow(mx(hm.spire[0]), hm.spire[1], [255, 236, 150], 4);
      if (kind === 'april') { // a paper fish pinned to the knight's back
        const kx = scene.knight.x + go0 + 5; const ky = scene.knight.y + 15; const fc = pack([240, 140, 60]);
        [[0, 1], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 1], [4, 0], [4, 2]].forEach(([dx, dy]) => put(kx + dx, ky + dy, fc, false));
      }
      if (kind === 'may') [[-14, 5], [-11, 7], [9, 8], [12, 6]].forEach(([dx, dy]) => { // lily of the valley
        const x = fire.x + go0 + dx; const y = fire.y + dy;
        put(x, y, pal32[I.FERN_SH], false); put(x, y - 1, pal32[I.FERN], false); put(x + 1, y - 2, pal32[I.FL_WHITE], false); put(x + 1, y - 1, pal32[I.FL_WHITE], false);
      });
    }
    if (wk && wk.y >= yg && wk.y < yg + 10) { const y = Math.round(wk.y); smallWalker(Math.round(scene.pathX[y]) - M + groundOff(y), y, walkerH(y), wk); } // (at the meadow's far edge, still small)
    if (wk && wk.y >= yg + 10) { // the passer-by, near: full size, walking
      const rid = wk.kind === 'rider'; const mu = muySprites(wk.kind); // (Muybridge's gallop and walk, once they have come)
      const sp = mu ? (wk.dir < 0 ? mu.left : mu.right)[Math.floor(rid ? t * 14 : Math.abs(wk.y) * 2.2) % mu.right.length]
        : (rid ? (wk.dir < 0 ? SPRITES.rider : SPRITES.riderR) : wk.dir < 0 ? SPRITES.peasant : SPRITES.walkerL)[Math.floor(t * (rid ? 7 : 4)) % 2]; const y = Math.min(H - 1, Math.round(wk.y));
      const x = Math.round(scene.pathX[y]) - M + groundOff(y) - (mu ? Math.floor(sp.w / 2) : rid ? 11 : 3);
      if (wk.kind === 'lantern' && look.night > 0.4) { // lit by his own lantern, as when he was further off
        for (let yy = 0; yy < sp.h; yy += 1) for (let xx = 0; xx < sp.w; xx += 1) { const c = sp.px[yy * sp.w + xx]; if (c >= 0) put(x + xx, y - sp.h + yy, c === I.OUTLINE ? pal32[c] : pack(mix(unpack(pal32[c]), mix(hex(DAYLIGHT[c]), [255, 196, 120], 0.35), 0.75)), false); }
      } else blit(sp, x, y - sp.h);
      if (wk.kind === 'lantern') { put(x + 6, y - sp.h + 4, pack([255, 214, 120]), false); halo(x + 6, y - sp.h + 4, 4, [255, 190, 90], 0.45 * look.night); }
      if (wk.kind === 'peddler') { // his cart behind him, laden
        const cx0 = x + (wk.dir < 0 ? 8 : -8); rect2(cx0, y - 6, 7, 4, pal32[I.TIMBER]); rect2(cx0, y - 7, 7, 1, pal32[I.TIMBER_HI]);
        put(cx0 + 1, y - 8, pal32[I.FL_RED], false); put(cx0 + 3, y - 8, pal32[I.FL_YEL], false); put(cx0 + 5, y - 8, pal32[I.CLOTH], false); put(cx0 + 2, y - 9, pal32[I.FL_RED], false);
        [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]].forEach(([dx, dy]) => put(cx0 + 2 + dx, y - 3 + dy, pal32[I.OUTLINE], false)); // a wheel
      }
      if (wk.kind === 'messenger') { for (let k = 0; k < 7; k += 1) put(x + 1, y - sp.h - k, pal32[I.TIMBER_SH], false); put(x + 2, y - sp.h - 6, pal32[I.FLAG], false); put(x + 3, y - sp.h - 6, pal32[I.FLAG], false); put(x + 2, y - sp.h - 5, pal32[I.FLAG], false); }
    }
    scene.zzz.forEach((z) => { // the knight dozes after dark
      const c = pack([220, 226, 255]); const x = Math.round(z.x); const y = Math.round(z.y);
      put(x, y, c, false); put(x + 1, y, c, false); put(x + 1, y + 1, c, false); put(x, y + 2, c, false); put(x + 1, y + 2, c, false);
    });
    if (scene.season === 'summer' && look.night < 0.3) { // swallows skimming the meadow and the water
      const sc = pack([34, 30, 52]);
      for (let k = 0; k < 4; k += 1) {
        const ph = t * (0.9 + k * 0.17) + k * 2.1;
        const x = Math.round(W * (0.35 + 0.3 * Math.sin(ph)) + Math.sin(ph * 3.1) * 12); const y = Math.round(yl0 + (yg - yl0) * 0.5 + Math.sin(ph * 2.3) * 9);
        const up = Math.floor(t * 12 + k) % 2;
        put(x, y, sc, false); put(x - 1, y - up, sc, false); put(x + 1, y - up, sc, false); put(x + 2, y + 1 - up, sc, false);
      }
    }

    // butterflies by day, fireflies at night
    if (look.night < 0.3) {
      scene.butterflies.forEach((b) => {
        const c = pal32[b.c]; const open = Math.floor(t * 6 + b.ph) % 2; const x = gx(b.x, b.y);
        put(x, b.y, pal32[I.OUTLINE]);
        if (open) { put(x - 1, b.y - 1, c); put(x + 1, b.y - 1, c); put(x - 1, b.y, c); put(x + 1, b.y, c); } else { put(x - 1, b.y, c); put(x + 1, b.y, c); }
      });
    }
    if (look.night > 0.5) {
      scene.flies.forEach((f) => {
        if (Math.sin(t * 2.3 + f.ph * 3) < -0.2) return;
        const x = gx(f.x, f.y);
        put(x, f.y, pack([232, 255, 138]));
        NEIGH.forEach(([dx, dy]) => blend(x + dx, f.y + dy, [200, 255, 120], 0.35, false));
      });
    }

    // the watchers: the knight's head sinks a pixel as he breathes; the wizard's orb glows
    const { knight, wizard } = scene;
    const go = groundOff(fire.y) - M;
    const breath = reduce ? 0 : Math.floor(t / 1.7) % 2;
    if (WET[weather.kind] || shelterUntil > t) { const c = scene.cats[0]; blit(c.sp, knight.x - 12 + go, c.y, H, (y) => (y < 3 ? (c.breathe || 0) : 0)); } // curled behind him, out of the rain
    blit(SPRITES.knight, knight.x + go, knight.y, H, (y) => (y < KNIGHT_HEAD ? breath : 0));
    blit(SPRITES.wizard, wizard.x + go, wizard.y);
    if (wizardReads(t)) { // the wizard reads, a little book held before him (the latest news: click him)
      const bx = wizard.x + go + 3; const by = wizard.y + 18;
      for (let k = 0; k < 7; k += 1) { put(bx + k, by, pal32[k === 3 ? I.LEATHER_SH : I.CREAM], false); put(bx + k, by + 1, pal32[k === 3 ? I.LEATHER_SH : k % 2 ? I.PLASTER : I.CREAM], false); put(bx + k, by + 2, pal32[I.LEATHER], false); }
      if (!reduce && Math.floor(t / 4) % 3 === 0) put(bx + 1 + (Math.floor(t * 3) % 2) * 4, by + 1, pal32[I.OUTLINE], false); // (a finger on the line)
    }
    const shield = scene.shieldSp || (scene.shieldSp = armsSprite(heraldry.own)); // the knight's arms, leant on the log
    if (shield) blit(shield, knight.x + go + 1, fire.y + 7 - shield.h);
    { // Blanc Blanc's home is at the knight's feet; now and then (by day and evening, a minute in
      // 45 s, from 4 s after the page opens) he hops up into the knight's lap, curls there, purrs,
      // and hops back down to his place
      const bb = scene.cats[1]; bb.hx ??= bb.x; bb.hy ??= bb.y;
      const lapX = knight.x + 14; const lapY = knight.y + 11; // on his thighs
      const p = !reduce && look.night < 0.7 && t > 4 ? (t - 4) % 45 : 99;
      const hop = (k, a, b) => { const e = k * k * (3 - 2 * k); return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e - Math.sin(k * Math.PI) * 6]; };
      const home = [bb.hx, bb.hy]; const lap = [lapX, lapY];
      const [x, y] = p < 1 ? hop(p, home, lap) : p < 12 ? lap : p < 13 ? hop(p - 12, lap, home) : home;
      bb.x = Math.round(x); bb.y = Math.round(y);
      if (p >= 1 && p < 12) { if (!scene.purred) { scene.purred = true; sfx('purr'); } } else scene.purred = false;
    }
    const rainy = Boolean(WET[weather.kind]) || shelterUntil > t;
    { // in the rain the big black cat leaves the fire for the shelter, behind the knight (and back after)
      const lf = scene.cats[0]; lf.hx ??= lf.x;
      lf.x = rainy ? knight.x - 12 : lf.hx;
    }
    scene.cats.forEach((c) => { // they blink now and then; the black one by the fire breathes
      const breathe = c.sp === SPRITES.cats.blackLoaf && !reduce ? Math.floor(t / 2.1 + c.ph) % 2 : 0;
      if (rainy && c === scene.cats[0]) { c.breathe = breathe; return; } // (drawn before the knight, see below)
      blit(c.sp, c.x + go, c.y, H, (y) => (y < 3 ? breathe : 0));
      c.breathe = breathe;
    });
    scene.shelter = null;
    if (rainy) { // the shelter: a waxed cloth on a pole and a guy-rope, over the knight and the cat
      const xr = knight.x + go + SPRITES.knight.w + 1; const xl = knight.x + go - 10; const yr = knight.y - 9; const yl = knight.y + 1;
      const top = (x) => Math.round(yr + ((xr - x) / (xr - xl)) * (yl - yr));
      for (let y = top(xr); y < fire.y + 5; y += 1) { put(xr, y, pal32[I.TIMBER], false); put(xr + 1, y, pal32[I.TIMBER_SH], false); } // the pole
      for (let x = xl; x <= xr + 2; x += 1) { // the cloth: tan canvas, lit on its upper face, a darker underside, a scalloped hem
        const y = top(x); const seam = (x - xl) % 7 === 0;
        put(x, y - 2, pal32[I.THATCH], false); put(x, y - 1, pal32[seam ? I.THATCH_SH : I.THATCH], false);
        put(x, y, pal32[seam ? I.THATCH_SH : I.THATCH], false); put(x, y + 1, pal32[I.THATCH_SH], false); put(x, y + 2, pal32[I.TIMBER_SH], false);
        if ((x - xl) % 4 < 2) put(x, y + 3, pal32[I.TIMBER_SH], false);
      }
      for (let k = 0; k <= 12; k += 1) put(xl - Math.round(k * 0.35), yl + 3 + Math.round(k * ((fire.y + 5 - yl - 3) / 12)), pal32[I.PLASTER], false); // the guy-rope to its peg
      put(xl - 4, fire.y + 5, pal32[I.TIMBER]); put(xl - 4, fire.y + 4, pal32[I.TIMBER_HI]);
      if (!reduce) { const dy = Math.floor(t * 6) % 7; put(xl, yl + 4 + dy, pal32[I.WATER_HI], false); put(xl + 2, yl + 4 + ((dy + 3) % 7), pal32[I.WATER_HI], false); } // drips off its low edge
      scene.shelter = { xl, xr, top };
    }
    { // the knight's blue butterfly, wandering round his helm
      const hx = knight.x + go + 13; const hy = knight.y + 4;
      const bx = hx + Math.round(10 * Math.sin(t * 0.8)); const by = hy - 3 + Math.round(5 * Math.sin(t * 1.7) * Math.cos(t * 0.45));
      const open = reduce || Math.floor(t * 7) % 2; const wcol = pal32[I.WING_HI]; const wsh = pal32[I.WING];
      put(bx, by, pal32[I.OUTLINE], false);
      if (open) { put(bx - 1, by - 1, wcol); put(bx + 1, by - 1, wcol); put(bx - 1, by, wsh); put(bx + 1, by, wsh); put(bx - 2, by - 1, wsh); put(bx + 2, by - 1, wsh); }
      else { put(bx - 1, by, wcol); put(bx + 1, by, wcol); }
      if (look.night > 0.4) halo(bx, by, 2.5, [140, 180, 255], 0.3);
    }
    const glow = t < castUntil ? 5.5 : 3.2 + (reduce ? 0 : 0.6 * Math.sin(t * 3));
    halo(wizard.x + go + ORB[0], wizard.y + ORB[1], glow, [180, 250, 255], 0.55);

    // smoke, flames, coals, embers, the wizard's sparks
    const fxs = fire.x + go;
    const catEyes = () => scene.cats.forEach((c) => {
      const shut = !reduce && Math.sin(t * 0.7 + c.ph * 3) > 0.96;
      // the big black cat's eyes follow the mouse: a pixel towards it, when there is fur to look through
      let gx0 = 0; let gy0 = 0;
      if (c.sp === SPRITES.cats.blackLoaf && pointer && !shut) {
        const [ex, ey] = c.sp.eyes[0]; const dx = pointer[0] - (c.x + go + ex); const dy = pointer[1] - (c.y + ey);
        gx0 = Math.abs(dx) > 6 ? Math.sign(dx) : 0; gy0 = dy < -12 ? -1 : 0;
        const fur = (x, y) => { const v = c.sp.px[y * c.sp.w + x]; return v >= 0 && v !== I.OUTLINE; };
        if (!c.sp.eyes.every(([x, y]) => fur(x + gx0, y + gy0))) { gx0 = 0; gy0 = 0; }
        if (gx0 || gy0) c.sp.eyes.forEach(([x, y]) => put(c.x + go + x, c.y + y + (y < 3 ? c.breathe : 0), pal32[I.BLACKFUR], false));
      }
      c.sp.eyes.forEach(([ex, ey]) => put(c.x + go + ex + gx0, c.y + ey + gy0 + (ey < 3 ? c.breathe : 0), pal32[shut ? I.BLACKFUR_SH : I.EYE], false));
    });
    { // the smoke: the fluid's density, dithered (its bottom row in the flames' tips)
      const f = scene.fluid; const x0 = fire.x + go - (f.w >> 1); const y0 = fire.y - 16 - f.h;
      for (let y = 1; y < f.h - 1; y += 1) for (let x = 1; x < f.w - 1; x += 1) {
        const dd = f.d[y * f.w + x]; if (dd < 0.04) continue;
        const a = Math.min(0.7, dd * 0.6); if (a > 0.08) blend(x0 + x, y0 + y, look.smoke, Math.round(a * 4) / 4 + 0.1, false); // (in steps, not dithered: a dither grid reads as a mesh)
      }
    }
    const fx0 = fxs - Math.floor(fw / 2); const fy0 = fire.y - fh;
    const fc = FIRE.map((h) => (h ? pack(hex(h)) : 0));
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const lv = Math.min(FIRE_MAX, Math.floor(cells[y * fw + x] + bayer(x, y) * 0.9));
        if (lv > 0) put(fx0 + x, fy0 + y, fc[lv], false);
      }
    }
    for (let x = -3; x <= 3; x += 1) put(fxs + x, fire.y, fc[(reduce || Math.random() < 0.5) ? 5 : 3], false);
    scene.embers.forEach((e) => {
      const f = e.age / e.life;
      put(e.x + go, e.y, fc[f < 0.3 ? 7 : f < 0.65 ? 5 : 3], false);
    });
    scene.sparks.forEach((s) => {
      const c = [[255, 255, 255], [160, 240, 255], [255, 220, 110]][s.c];
      put(s.x + go, s.y, pack(c), false);
      if (s.age < 6) NEIGH.forEach(([dx, dy]) => blend(s.x + go + dx, s.y + dy, c, 0.4, false));
    });

    // the nearest plane, then the tall grass bending in the wind
    landVeil();
    const nearOn = !zoom || (!zoom.on && (zoom.z || 1) < 2.2); // (the camera passes the near trees on its way to the village)
    if (nearOn) composite(L.FG);
    if (scene.season === 'autumn' && !WET[weather.kind]) { // leaves drift down (snow falls only when it snows)
      scene.falling.forEach((q) => {
        const x = Math.round(q.x - M + Math.sin(t * 0.8 + q.ph) * 3);
        if (q.y > scene.yHor * 0.6) put(x, Math.round(q.y), pal32[q.c ? I.LEAF : I.LEAF2], false);
      });
    }
    const fo = shift(RATE[L.FG]) - M;
    const fgSrc = scene.planes[L.FG]; const [fg0, fg1] = scene.rows[L.FG];
    const behindFG = (x, y) => y >= fg0 && y < fg1 && fgSrc[y * scene.WE + M - planeOff(L.FG, y) + x] !== CLEAR; // (a near pine stands before the meadow's grass)
    if (nearOn) scene.blades.forEach((b) => { // (rooted in the meadow: they slide with it at their row)
      const c = pal32[b.c]; const bo = groundOff(Math.min(scene.H - 1, b.y)) - M;
      const lean = reduce ? 0 : (Math.sin(t * 1.6 + b.x * 0.21) * 0.6 * clamp(weather.wind / 15, 0.3, 1.6) + Math.sin(t * 0.7 + b.x * 0.05) * 0.6 + windX() * 0.8) * b.h * 0.22;
      for (let r = 0; r < b.h; r += 1) { const X = b.x + bo + Math.round((lean + b.spread) * (r / b.h) ** 2); const Y = b.y - r; if (X >= 0 && X < scene.W && !behindFG(X, Y)) put(X, Y, c, false); }
    });
    if (look.night > 0.5 || (forced.owl || 0) > t) { // the owl on its branch, blinking now and then
      const ow = scene.owl; const ox = ow.x + fo;
      blit(SPRITES.owl, ox, ow.y);
      scene.hoots.forEach((h) => { // the hour, counted out: a ring of breath for each hoot
        const a = t - h.t0; if (a < 0 || a > 1.4) return;
        const ry = ow.y - 2 - Math.round(a * 5); const c = pack([226, 232, 255]);
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => blend(ox + 6 + dx + Math.round(a * 2), ry + dy, unpack(c), 0.8 * (1 - a / 1.4), false));
      });
      if (!reduce && Math.sin(t * 0.6) > 0.95) { put(ox + 2, ow.y + 3, pal32[I.LEATHER], false); put(ox + 4, ow.y + 3, pal32[I.LEATHER], false); }
    }
    precipitation(put, blend);

    // firelight: warm, stepped falloff, flickering radius; strongest at night
    const k0 = 0.3 + 0.95 * look.night;
    const R = 0.42 * H * (1 + (reduce ? 0 : 0.05 * Math.sin(t * 13) + 0.03 * Math.sin(t * 29))); const iR2 = 1 / (R * R);
    for (let y = Math.max(0, Math.floor(fire.y - R * 0.7)); y < Math.min(H, fire.y + R * 0.7); y += 1) {
      for (let x = Math.max(0, Math.floor(fxs - R)); x < Math.min(W, fxs + R); x += 1) {
        const i = y * W + x;
        if (idxNow[i] <= FAR) continue;
        const dx = x - fxs; const dy = (y - fire.y) * 1.5; const d2 = (dx * dx + dy * dy) * iR2;
        if (d2 >= 1) continue;
        const k = Math.floor(((1 - Math.sqrt(d2)) ** 1.6 * k0) * 4 + bayer(x, y)) / 4;
        if (k <= 0) continue;
        const v = buf[i]; const r = v & 255; const g = (v >> 8) & 255; const b = (v >> 16) & 255; // no arrays: this runs ~40k times a frame
        buf[i] = 0xff000000 | (Math.min(255, Math.round(b + b * 0.05 * k)) << 16)
          | (Math.min(255, Math.round(g + (g * 0.6 + 26) * k)) << 8) | Math.min(255, Math.round(r + (r * 1.5 + 70) * k));
      }
    }
    catEyes();
    if (scene.dream) { // the sleeping knight's dream: bubbles rising to a cloud, a picture of a subject in it
      const DREAM_INK = pack([238, 234, 255]); const DREAM_EDGE = pack([186, 182, 222]); // (a dream glows: the night does not dim it)
      const d = scene.dream; const age = t - d.t0; const hx = knight.x + go + 17; const hy = knight.y;
      const ring = (cx, cy, r) => { for (let a = 0; a < 6.28; a += 0.4) put(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), DREAM_INK, false); };
      if (age > 0.3) ring(hx + 2, hy - 3, 1); if (age > 0.8) ring(hx + 5, hy - 7, 1.5);
      if (age > 1.3) {
        const cx = hx + 10; const cy = hy - 16; d.box = [cx - 8, cy - 6, 17, 12];
        for (let y = -5; y <= 5; y += 1) for (let x = -8; x <= 8; x += 1) {
          const q = (x / 8.5) ** 2 + (y / 5.5) ** 2 + 0.12 * Math.sin(x * 1.3) * Math.sin(y * 1.7);
          if (q < 1) put(cx + x, cy + y, q > 0.78 ? DREAM_EDGE : DREAM_INK, false);
        }
        const [, rows, cols] = DREAMS[d.icon];
        rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') put(cx - 2 + x, cy - 2 + y, pack(hex(DAYLIGHT[I[cols[Number(ch) - 1]]])), false); }));
      }
    }
    if (sel >= 0 && selList[sel]) { // the keyboard's choice: a pulsing ring
      const c = selList[sel]; const r = 5 + (reduce ? 0 : Math.sin(t * 5)); 
      for (let a = 0; a < 6.28; a += 0.2) blend(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, [255, 236, 170], 0.8, false);
    }
    const aim = hoverId && view.state === 'scene' && scene.rooms[roomOf(hoverId)];
    if (aim) { // the menu's choice: a soft beam from the staff's orb to that part of the castle, widening as it goes
      const wz = scene.wizard; const gw = groundOff(fire.y) - M; const ox = wz.x + gw + ORB[0]; const oy = wz.y + ORB[1]; const tx = mx(aim.x) + aim.w / 2; const ty = aim.y + aim.h / 2;
      const len = Math.hypot(tx - ox, ty - oy); const pulse = reduce ? 1 : 0.85 + 0.15 * Math.sin(t * 4);
      const ux = (tx - ox) / len; const uy = (ty - oy) / len; const R = 10; // (the cone: 1 px at the orb, R at the castle)
      const x0 = Math.floor(Math.min(ox, tx) - R); const x1 = Math.ceil(Math.max(ox, tx) + R); const y0 = Math.floor(Math.min(oy, ty) - R); const y1 = Math.ceil(Math.max(oy, ty) + R);
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
        const a0 = (x - ox) * ux + (y - oy) * uy; if (a0 < 0 || a0 > len) continue; // (along the beam, from the orb)
        const f = a0 / len; const q = Math.abs((x - ox) * uy - (y - oy) * ux) / (1 + f * (R - 1)); if (q > 1) continue; // (across it, in its width there)
        blend(x, y, [255, 230, 160], 0.6 * pulse * (1 - q) ** 1.4 * (1 - 0.35 * f), false);
      }
    }
    landmarks(t, put, blend);
  }

  /* ---- things of the landscape that answer: the weathervane on the keep, the sundial and the garden of
     simples by the camp, the true stars and their figures, the fog the pointer parts, the coin in the well,
     the bell's carillon. Drawn over the rest (landmarks), clicked through hitAt and talk. */
  const COMPASS = ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east',
    'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'];
  const HERBS = [['sage', 'BLADE_SH', 'FL_VIOLET'], ['lavender', 'FERN_SH', 'FL_VIOLET'], ['rosemary', 'PINE', 'FL_BLUE'], ['chamomile', 'GRASS', 'FL_WHITE'],
    ['thyme', 'FERN', 'BLOSSOM'], ['mint', 'GRASS_HI', 'FL_WHITE'], ['rue', 'WILLOW', 'FL_YEL'], ['borage', 'GRASS_SH', 'FL_BLUE'],
    ['marigold', 'GRASS', 'RUST_HI'], ['fennel', 'WILLOW_HI', 'FL_YEL'], ['hyssop', 'FERN_SH', 'FL_BLUE'], ['feverfew', 'GRASS_HI', 'FL_WHITE']];
  const WELL_M = 16; // (the village well's depth to the water, metres)
  let fogClear = null; let constel = null; let coin = null; let carillonUntil = 0;
  /** Where the landmarks stand this frame (scene px): the vane on the keep's flagpole, the dial and the
   *  garden on the meadow left of the wizard. */
  function landmarkPlaces() {
    const go = groundOff(scene.fire.y) - scene.M; const mid = shift(RATE[L.MID]) - scene.M; const wz = scene.wizard;
    const keep = scene.flags.find((f) => f.c === I.FLAG2) || scene.flags[0];
    return { vane: keep && { x: keep.x + mid, y: keep.y - 4 }, dial: { x: wz.x + go - 13, y: scene.fire.y + 5 }, garden: { x: wz.x + go - 44, y: scene.fire.y + 9, w: 26 } };
  }
  function landmarks(t, put, blend) {
    const P = landmarkPlaces(); const ink = (n) => pal32[I[n]];
    if (P.vane) { // the weathervane: an arrow pointing into the wind, foreshortened as it turns towards us
      const dir = (weather.dir ?? 270) * deg; const sx = -Math.sin(dir); const L2 = Math.max(1, Math.round(3 * Math.abs(sx))); const head = sx >= 0 ? 1 : -1; // (east is on the left: we face south)
      const { x, y } = P.vane; put(x, y + 1, ink('ARM_SH'), false); put(x, y + 2, ink('ARM_SH'), false);
      for (let k = -L2; k <= L2; k += 1) put(x + k, y, ink('GOLD'), false);
      put(x + head * (L2 + 1), y, ink('GOLD_HI'), false); put(x + head * L2, y - 1, ink('GOLD'), false); put(x + head * L2, y + 1, ink('GOLD'), false); // its head
      put(x - head * L2, y - 1, ink('GOLD_SH'), false); put(x - head * (L2 + 1), y - 1, ink('GOLD_SH'), false); // its feather
    }
    { // the sundial: a stone pillar, the plate, the gnomon's shadow from the true sun
      const { x, y } = P.dial;
      for (let k = 0; k < 4; k += 1) { put(x - 1, y - k, ink('ROCK_SH'), false); put(x, y - k, ink('ROCK'), false); put(x + 1, y - k, ink('ROCK_HI'), false); }
      for (let k = -3; k <= 3; k += 1) put(x + k, y - 4, ink(Math.abs(k) === 3 ? 'ROCK_SH' : 'STONE_HI'), false);
      put(x, y - 5, ink('ARM_SH'), false);
      const sv = bodies && bodies.sun; const alt = sv ? sv[2] : -1;
      if (bodies && alt > 0.02 && look.night < 0.4) { const v = bodies.sky.sun; const n = Math.hypot(v[0], v[1]) || 1; const len = Math.min(3, 1.2 / Math.tan(alt)); put(x + Math.round((v[0] / n) * len), y - 4 + Math.round((v[1] / n) * len * 0.35), ink('ROCK_DK'), false); }
    }
    { // the garden of simples: a wattle edge, a plant for each visit (twelve at most), as the season has it
      const { x, y, w } = P.garden; const n = Math.min(HERBS.length, visitsOf().n || 1); const m = today().getMonth(); const season = SEASON(m);
      for (let k = 0; k < w; k += 1) { put(x + k, y, ink(k % 2 ? 'TIMBER' : 'TIMBER_SH'), false); put(x + k, y - 3, ink('DIRT'), false); put(x + k, y - 2, ink('DIRT_SH'), false); put(x + k, y - 1, ink('DIRT'), false); }
      for (let k = 0; k < n; k += 1) {
        const [, leaf, flower] = HERBS[k]; const px = x + 1 + Math.round(((k + 0.5) * (w - 2)) / HERBS.length); const tall = 2 + (k % 3);
        const lc = season === 'winter' ? 'DIRT_SH' : season === 'autumn' && k % 2 ? 'RUST_SH' : leaf;
        for (let h = 0; h < tall; h += 1) put(px + (h === tall - 1 && k % 2 ? 1 : 0), y - 3 - h, ink(lc), false);
        if (season === 'spring' || season === 'summer') put(px, y - 3 - tall, ink(flower), false);
      }
    }
    if (look.stars > 0.15 && bodies) { // the true stars of the constellations (the rest of the sky is random); one clicked shows its figure
      scene.realStars = []; const cs = window.starsAt ? window.starsAt(clockFn()) : [];
      cs.forEach((c) => c.stars.forEach((v) => { if (v[2] > 0.03) { const [sx, sy] = project(v); scene.realStars.push({ x: sx, y: sy, name: c.name }); blend(sx, sy, [255, 252, 236], look.stars, true); } }));
      if (constel && t - constel.t0 < 9) {
        const c = cs.find((q) => q.name === constel.name); const a = look.stars * Math.min(1, (9 - (t - constel.t0)) / 2) * 0.55;
        if (c) c.lines.forEach(([i, j]) => { const u = c.stars[i]; const v = c.stars[j]; if (u[2] < 0 || v[2] < 0) return; const [x1, y1] = project(u); const [x2, y2] = project(v); const len = Math.hypot(x2 - x1, y2 - y1);
          for (let d = 2; d < len - 2; d += 2) blend(x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len, [190, 210, 255], a, true); });
      } else constel = null;
    }
    if (coin) { // the coin tossed in the well (village close-up): its arc into the mouth, then the ring on the water
      const wl = scene.hamlet.places.well; const e = t - coin.t0; const lm = shift(RATE[L.MID]) - scene.M;
      if (wl && e < 0.35) put(wl.x + 1 + lm, Math.round(wl.yb - 8 + e * 20), ink('GOLD_HI'), false);
      if (wl && e > coin.fall && e < coin.fall + 0.6) blend(wl.x + 1 + lm, wl.yb - 1, [200, 230, 255], 0.8, false);
      if (e > coin.fall + 1.2) coin = null;
    }
  }
  /** The fog parted where the pointer goes (scene px), coming back slowly: a coarse field of how clear it is. */
  function clearFog(x, y) {
    if (weather.kind !== 'fog' && !forced.fogsea) return;
    const cw = Math.ceil(scene.W / 4); const ch = Math.ceil(scene.H / 4); if (!fogClear || fogClear.length !== cw * ch) fogClear = new Float32Array(cw * ch);
    const cx = Math.floor(x / 4); const cy = Math.floor(y / 4);
    for (let j = -3; j <= 3; j += 1) for (let i = -3; i <= 3; i += 1) { const X = cx + i; const Y = cy + j; if (X < 0 || Y < 0 || X >= cw || Y >= ch) continue; const k = Y * cw + X; fogClear[k] = Math.min(1, fogClear[k] + 0.35 * Math.max(0, 1 - Math.hypot(i, j) / 3.5)); }
  }
  /** What the sundial reads: the apparent solar time at Paris (the clock's time, Paris's longitude, the
   *  equation of time), against the clock. */
  function sundialLine() {
    const d = clockFn(); if (!bodies || bodies.sun[2] < 0.02) return 'The sundial is mute: no sun on it.';
    const doy = (d - new Date(d.getFullYear(), 0, 0)) / 864e5; const B = (2 * Math.PI * (doy - 81)) / 364;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
    const sol = (d.getUTCHours() * 60 + d.getUTCMinutes() + 2.3522 * 4 + eot + 1440) % 1440;
    const hm = (m) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
    return `The sundial reads ${hm(sol)}, the sun's own time; the clock says ${hm(d.getHours() * 60 + d.getMinutes())} (Paris keeps Central European time, and the equation of time is ${eot >= 0 ? '+' : ''}${eot.toFixed(1)} min today).`;
  }
  let roseTo = () => {}; // (the compass rose: ui shows it)
  const fogAt = (x, y) => (fogClear ? fogClear[Math.floor(y / 4) * Math.ceil(scene.W / 4) + Math.floor(x / 4)] || 0 : 0);

  /* ---- the rooms at run time: lighting, animation, the camera between outside and in ---- */

  /** A room, at the standard size (RW x RH). */
  function makeInterior(id) {
    layoutRoom(); board = null; if (chalk.on) chalkMode(false);
    const r = generateInterior(id, RW, RH);
    for (let k = 0; k < 30; k += 1) stepCells(r.cells, 9, 14); // a hearth already burning
    return r;
  }
  /** The room's canvas: the largest whole number of device pixels a room pixel that fits the plate, centred. */
  function layoutRoom() {
    const r = plate.getBoundingClientRect(); const dpr = devicePixelRatio || 1;
    const kd = Math.max(1, Math.floor(Math.min((r.width * dpr) / RW, (r.height * dpr) / RH))); const k = kd / dpr;
    const l = Math.round(((r.width - RW * k) / 2) * dpr) / dpr; const t = Math.round(((r.height - RH * k) / 2) * dpr) / dpr;
    roomBox = { l, t, k };
    Object.assign(roomCv.style, { left: `${l}px`, top: `${t}px`, width: `${RW * k}px`, height: `${RH * k}px` });
    fbuf = null; // (the embrasure follows: paintFrame)
  }
  /** Round the room, on the landscape's canvas: a wall of black brick and, about the opening, a gilt
   *  fillet lit from above and the left; a quatrefoil with a red stone at each corner and a lozenge at
   *  the middle of each side, where the margin has room for them. In the room's own light (ipal32). */
  function paintFrame() {
    const { W, H } = scene; fbuf = new Uint32Array(W * H);
    const x0 = Math.round(roomBox.l / px); const y0 = Math.round(roomBox.t / px);
    const x1 = Math.round((roomBox.l + RW * roomBox.k) / px); const y1 = Math.round((roomBox.t + RH * roomBox.k) / px);
    const C = (n, f = 1) => pack(unpack(ipal32[I[n]]).map((v) => v * f));
    const brick = [C('OUTLINE', 1.25), C('ROCK_DK', 0.42), C('OUTLINE', 1.05), C('ROCK_DK', 0.36)]; const mortar = C('ROCK_DK', 0.62);
    const gold = C('GOLD'); const goldHi = C('GOLD_HI'); const goldSh = C('GOLD_SH'); const ink = C('OUTLINE', 0.7); const gem = C('CAP');
    const bw = 7; const bh = 3;
    for (let y = 0; y < H; y += 1) { // the brick
      const course = Math.floor(y / bh); const off = (course % 2) * 3;
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x; const bx = Math.floor((x + off) / bw);
        fbuf[i] = y % bh === bh - 1 || (x + off) % bw === 0 ? mortar : brick[(bx * 7 + course * 3) % 4];
      }
    }
    const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H && !(x >= x0 && x < x1 && y >= y0 && y < y1)) fbuf[y * W + x] = c; };
    // the fillet: a dark line on the opening, two of gilt, a dark line outside
    for (let d = 1; d <= 4; d += 1) {
      for (let x = x0 - d; x < x1 + d; x += 1) { put(x, y0 - d, d === 1 || d === 4 ? ink : d === 2 ? goldHi : gold); put(x, y1 + d - 1, d === 1 || d === 4 ? ink : goldSh); }
      for (let y = y0 - d; y < y1 + d; y += 1) { put(x0 - d, y, d === 1 || d === 4 ? ink : d === 2 ? goldHi : gold); put(x1 + d - 1, y, d === 1 || d === 4 ? ink : goldSh); }
    }
    const quatrefoil = (cx, cy) => { // 11 x 11: four lobes, a gem
      for (let y = -5; y <= 5; y += 1) for (let x = -5; x <= 5; x += 1) {
        const lobe = [[-2, 0], [2, 0], [0, -2], [0, 2]].some(([lx, ly]) => (x - lx) ** 2 + (y - ly) ** 2 <= 6.5);
        const rim = !lobe && [[-2, 0], [2, 0], [0, -2], [0, 2]].some(([lx, ly]) => (x - lx) ** 2 + (y - ly) ** 2 <= 10.5);
        if (Math.abs(x) <= 1 && Math.abs(y) <= 1) put(cx + x, cy + y, x === -1 && y === -1 ? goldHi : gem);
        else if (lobe) put(cx + x, cy + y, x + y < -1 ? goldHi : x + y > 1 ? goldSh : gold);
        else if (rim) put(cx + x, cy + y, ink);
      }
    };
    const lozenge = (cx, cy) => { for (let y = -3; y <= 3; y += 1) for (let x = -3; x <= 3; x += 1) { const m = Math.abs(x) + Math.abs(y); if (m <= 3) put(cx + x, cy + y, m === 3 ? ink : m === 0 ? gem : y < 0 ? goldHi : gold); } };
    const mx = Math.min(x0, W - x1); const my = Math.min(y0, H - y1);
    if (mx >= 6 && my >= 6) [[x0 - 3, y0 - 3], [x1 + 2, y0 - 3], [x0 - 3, y1 + 2], [x1 + 2, y1 + 2]].forEach(([cx, cy]) => quatrefoil(cx, cy));
    if (my >= 5) { lozenge(Math.round((x0 + x1) / 2), y0 - 3); lozenge(Math.round((x0 + x1) / 2), y1 + 2); }
    if (mx >= 5) { lozenge(x0 - 3, Math.round((y0 + y1) / 2)); lozenge(x1 + 2, Math.round((y0 + y1) / 2)); }
    frameDeco({ W, H, x0, y0, x1, y1, put, C, ink, goldSh });
  }
  /** The frame's furnishing, by the room its margins leave (mL, mR: the sides, mT, mB: above and
   *  below, outside the fillet): quoins of pale stone, iron straps and studs on the fillet, a vine in
   *  the margins with a snail, graffiti, two torches on brackets; and where the frame's life goes
   *  (fg: frameLife). Seeded by the room, so a room keeps its own. */
  function frameDeco({ W, H, x0, y0, x1, y1, put, C, ink, goldSh }) {
    const rng = mulberry32((view.id || 'x').length * 977 + 13);
    const mL = x0 - 4; const mR = W - x1 - 4; const mT = y0 - 4; const mB = H - y1 - 4;
    const stamp = (sp, X, Y) => { for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const c = sp.px[y * sp.w + x]; if (c >= 0) put(X + x, Y + y, pack(unpack(ipal32[c]))); } };
    // quoins: pale ashlar round the opening, long and short blocks in turn (d 5..8 out from the room)
    const q1 = C('ROCK_HI', 0.62); const q2 = C('ROCK', 0.62); const qj = C('ROCK_DK', 0.7);
    const quoin = (horiz, at, from, to, out) => { let p = from; let k = 0; while (p < to) { const len = k % 2 ? 4 : 7; for (let a = p; a < Math.min(to, p + len); a += 1) for (let d = 0; d < (k % 2 ? 3 : 4); d += 1) { const c = a === p ? qj : d === 0 && out < 0 ? q1 : (a + d) % 5 ? q2 : q1; if (horiz) put(a, at + out * d, c); else put(at + out * d, a, c); } p += len; k += 1; } };
    if (mT >= 5) quoin(true, y0 - 5, x0 - 8, x1 + 8, -1); if (mB >= 5) quoin(true, y1 + 4, x0 - 8, x1 + 8, 1);
    if (mL >= 5) quoin(false, x0 - 5, y0 - 4, y1 + 4, -1); if (mR >= 5) quoin(false, x1 + 4, y0 - 4, y1 + 4, 1);
    // iron on the gilt: hinge straps near the corners, a stud every 12 px along the fillet
    const iron = C('ARM_SH', 0.9); const ironHi = C('ARM_HI', 0.8);
    [[x0 + 6, y0 - 3], [x1 - 16, y0 - 3], [x0 + 6, y1 + 2], [x1 - 16, y1 + 2]].forEach(([sx, sy]) => { for (let k = 0; k < 10; k += 1) { put(sx + k, sy, iron); put(sx + k, sy + 1, k % 4 === 1 ? ironHi : iron); } put(sx + 10, sy, iron); });
    for (let x = x0 + 22; x < x1 - 22; x += 12) { put(x, y0 - 2, ironHi); put(x, y1 + 1, ironHi); }
    for (let y = y0 + 10; y < y1 - 10; y += 12) { put(x0 - 2, y, ironHi); put(x1 + 1, y, ironHi); }
    // the vine: a stem winding down each side margin (or along the top and bottom), leaves, berries, a bud
    const leaf = C('FERN'); const leafSh = C('FERN_SH'); const berry = C('CAP'); const bud = C('FL_BLUE');
    const busy = []; // (boxes the vine goes round: the torches, the graffiti; [x0, y0, x1, y1])
    const vine = (horiz, from, to, mid, amp) => {
      for (let a = from; a < to; a += 1) {
        const o = Math.round(Math.sin(a * 0.32) * amp); const X = horiz ? a : mid + o; const Y = horiz ? mid + o : a;
        if (busy.some(([bx0, by0, bx1, by1]) => X >= bx0 - 3 && X <= bx1 + 3 && Y >= by0 - 3 && Y <= by1 + 3)) continue;
        put(X, Y, goldSh);
        if (a % 9 === 0) { const sd = Math.sin(a * 0.32 + 1.6) > 0 ? 1 : -1; if (horiz) { put(X, Y + sd, leaf); put(X + 1, Y + sd, leafSh); put(X, Y + 2 * sd, leaf); } else { put(X + sd, Y, leaf); put(X + sd, Y + 1, leafSh); put(X + 2 * sd, Y, leaf); } }
        if (a % 23 === 11) put(horiz ? X : X - 1, horiz ? Y - 1 : Y, berry);
        if (a % 37 === 18) put(horiz ? X : X + 1, horiz ? Y + 1 : Y, bud);
      }
    };
    const fg = { torches: [], bats: [], spider: null, rat: null, cat: null };
    const sn = SPRITES.frame.snail; // a snail on the vine
    const snailAt = (X, Y) => { stamp(sn, X, Y); busy.push([X, Y, X + sn.w, Y + sn.h]); };
    if (mL >= 14) snailAt(Math.round((x0 - 9) / 2) - 4, Math.round(y0 + (y1 - y0) * 0.72)); else if (mB >= 14) snailAt(Math.round(x0 + (x1 - x0) * 0.7), Math.round((y1 + 9 + H) / 2) - 6);
    // graffiti scratched in the brick: a tally, initials, a year (a 3 x 5 hand)
    const scratch = C('ROCK_SH', 0.75);
    const GLY = { M: ['1.1', '111', '111', '1.1', '1.1'], S: ['.11', '1..', '.1.', '..1', '11.'], '1': ['.1.', '11.', '.1.', '.1.', '111'], '8': ['111', '1.1', '111', '1.1', '111'] };
    const write = (txt, X, Y) => [...txt].forEach((ch, k) => (GLY[ch] || []).forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '1') put(X + k * 4 + rx, Y + ry, scratch); })));
    const tally = (X, Y, n) => { for (let k = 0; k < n; k += 1) { if (k % 5 === 4) for (let d = 0; d < 6; d += 1) put(X + (k - 4) * 2 + d, Y + 4 - Math.floor(d * 0.7), scratch); else for (let y = 0; y < 5; y += 1) put(X + k * 2, Y + y, scratch); } };
    const gMargin = mR >= 16 ? [x1 + 7, W - 3] : mL >= 16 ? [3, x0 - 7] : null;
    if (gMargin) { const gx = gMargin[0] + 1; const gy = Math.round(y1 - (y1 - y0) * 0.22); busy.push([gx, gy - 8, gx + 16, gy + 13]); write('MS', gx, gy); tally(gx, gy + 8, 7 + Math.floor(rng() * 6)); if (gMargin[1] - gMargin[0] >= 14) write('1888', gx, gy - 8); } // (Flammarion's year)
    else if (mB >= 9) { const gx = Math.round(x0 + (x1 - x0) * 0.15); busy.push([gx, y1 + 7, gx + 30, y1 + 12]); write('MS', gx, y1 + 7); tally(gx + 12, y1 + 7, 9); }
    // torches on iron brackets, either side at a third of the height (or above the top corners)
    const tSp = SPRITES.frame.torch;
    const torchAt = (X, Y) => { stamp(tSp, X - 2, Y); fg.torches.push({ x: X, y: Y - 1, ph: rng() * 6 }); busy.push([X - 3, Y - 7, X + 3, Y + 5]); };
    if (mL >= 11 && mR >= 11) { const ty = Math.round(y0 + (y1 - y0) * 0.3); torchAt(Math.round((x0 - 4) / 2), ty); torchAt(Math.round((x1 + 4 + W) / 2), ty); }
    else if (mT >= 12) { torchAt(x0 - 12 < 3 ? x0 + 12 : x0 - 12, y0 - 10); torchAt(x1 + 12 > W - 3 ? x1 - 12 : x1 + 12, y0 - 10); }
    const sideV = (m, xs) => m >= 12 && vine(false, y0 + 4, y1 - 4, xs, Math.min(3, Math.floor((m - 9) / 2)));
    sideV(mL, Math.round((x0 - 9) / 2)); sideV(mR, Math.round((x1 + 9 + W) / 2));
    if (mT >= 12) vine(true, x0 + 30, x1 - 30, Math.round((y0 - 9) / 2), Math.min(3, Math.floor((mT - 9) / 2)));
    if (mB >= 12) vine(true, x0 + 30, x1 - 30, Math.round((y1 + 9 + H) / 2), Math.min(3, Math.floor((mB - 9) / 2)));
    // the life's places: Blanc Blanc on the lintel (or on a corbel in a side margin), a bat or two
    // under the top, a spider in an upper corner, a rat's hole at the foot of a side
    const loaf = SPRITES.frame.bbLoaf; const sit = SPRITES.frame.bbSit;
    if (mT >= loaf.h + 2) fg.cat = { sp: loaf, x: Math.round(x0 + (x1 - x0) * 0.22), y: y0 - 4 - loaf.h + 1, lying: true }; // (left: the menu hangs on the right)
    else if (mR >= sit.w + 4 && y1 - y0 > 60) { const cx = Math.round((x1 + 4 + W) / 2) - Math.floor(sit.w / 2); const cy = Math.round(y0 + (y1 - y0) * 0.66); for (let k = -1; k <= sit.w; k += 1) { put(cx + k, cy + sit.h, C('ROCK_HI', 0.6)); put(cx + k, cy + sit.h + 1, C('ROCK_SH', 0.6)); } fg.cat = { sp: sit, x: cx, y: cy, lying: false }; }
    if (mL >= 8) fg.bats.push({ x: Math.round((x0 - 4) / 2) - 2, y: y0 + 1, ph: rng() * 6 }); if (mT >= 7) fg.bats.push({ x: Math.round(x0 + (x1 - x0) * 0.3), y: 1, ph: rng() * 6 });
    fg.bats.forEach((b) => { for (let y = 0; y < b.y; y += 1) if (y > b.y - 2) put(b.x + 2, y, ink); });
    if (mR >= 9) fg.spider = { x: Math.round((x1 + 4 + W) / 2) + 2, top: 0, low: Math.round(y0 + (y1 - y0) * 0.18) }; else if (mT >= 9) fg.spider = { x: x0 + 8, top: 0, low: y0 - 9 };
    if (mL >= 12) { const hx = Math.round((x0 - 4) / 2) - 1; const hy = y1 - 1; for (let y = -3; y <= 0; y += 1) for (let x = -3; x <= 3; x += 1) if (x * x + (y * 1.6) ** 2 <= 10) put(hx + x, hy + y, C('OUTLINE', 0.5)); fg.rat = { hx, hy, side: 1, lim: Math.max(3, Math.floor(mL / 2) - 6) }; }
    else if (mB >= 6) fg.rat = { hx: x0 + 4, hy: H - 1, side: 1, lim: Math.min(60, x1 - x0 - 8), floor: true };
    frameGeo = { ...fg, x0, y0, x1, y1, W, H };
  }

  /** The frame's life, each frame over the embrasure (obuf): the torches' flames and their light on
   *  the brick, dust turning in it; Blanc Blanc asleep (his flank rising); the bats (by day hanging, at
   *  night one out on the wing now and then); the spider down its thread and up; the rat out of its
   *  hole for a look round, back in at once if the pointer comes near. */
  function frameLife(t) {
    const g = frameGeo; if (!g) return;
    const { W, H, x0, y0, x1, y1 } = g;
    const inside = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H && !inside(x, y)) obuf[y * W + x] = c; };
    const blend = (x, y, rgb, a) => { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= W || y < 0 || y >= H || inside(x, y)) return; const i = y * W + x; obuf[i] = pack(mix(unpack(obuf[i]), rgb, a)); };
    const blit = (sp, X, Y, dy = 0) => { for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const c = sp.px[y * sp.w + x]; if (c >= 0) put(X + x, Y + y + (y < sp.h / 2 ? dy : 0), c === I.EYE ? pal32[c] : ipal32[c]); } };
    const F = SPRITES.frame; const night = look.night;
    g.torches.forEach((tc) => { // the light first (under the flame), then the flame: a few pixels flickering
      const fl = reduce ? 1 : 0.85 + 0.15 * Math.sin(t * 9 + tc.ph) * Math.sin(t * 5.3 + tc.ph * 2);
      const R = 16 + 6 * night;
      for (let y = -R; y <= R; y += 1) for (let x = -R; x <= R; x += 1) { const d = Math.hypot(x, y * 1.2); if (d < R) blend(tc.x + x, tc.y + y, [255, 170, 80], (1 - d / R) ** 2 * (0.32 + 0.25 * night) * fl); }
      const h = reduce ? 4 : 3 + Math.round(2 * fl + Math.sin(t * 13 + tc.ph));
      for (let k = 0; k < h; k += 1) { const w = k < h - 2 ? 1 : 0; const sway = reduce ? 0 : Math.round(Math.sin(t * 7 + k + tc.ph) * (k / h)); for (let dx = -w; dx <= w; dx += 1) put(tc.x + dx + sway, tc.y - k, pack(k < 1 ? [255, 250, 210] : k < h - 1 ? [255, 190, 70] : [220, 90, 40])); }
      if (!reduce) for (let k = 0; k < 4; k += 1) { const a = t * 0.4 + k * 1.7 + tc.ph; blend(tc.x + Math.sin(a * 1.3) * 7, tc.y + 4 + Math.cos(a) * 6, [255, 230, 190], 0.45 * (0.5 + 0.5 * Math.sin(a * 3))); } // dust in the light
    });
    if (g.cat) { const c = g.cat; blit(c.sp, c.x, c.y, c.lying && !reduce && Math.floor(t / 2.2) % 2 ? -1 : 0); }
    g.bats.forEach((b, k) => {
      const out = night > 0.55 && !reduce;
      if (!out) { blit(F.batHang, b.x, b.y); return; }
      const cyc = (t + b.ph * 10) % 40; if (cyc > 9) return; // (one flight in forty seconds)
      const fx = b.x + Math.round((cyc / 9) * 50 * (k % 2 ? -1 : 1)); const fy = b.y + 6 + Math.round(Math.sin(cyc * 3) * 4);
      blit(Math.floor(t * 8) % 2 ? F.batA : F.batB, fx, fy);
    });
    if (g.spider) { // down its thread and back, a minute a round trip, pausing at the bottom
      const sp = g.spider; const ph = reduce ? 0.5 : (t % 60) / 60; const f = ph < 0.3 ? ph / 0.3 : ph < 0.6 ? 1 : ph < 0.9 ? 1 - (ph - 0.6) / 0.3 : 0;
      const y = Math.round(sp.top + (sp.low - sp.top) * f);
      for (let yy = sp.top; yy < y; yy += 1) blend(sp.x + 2, yy, [220, 220, 230], 0.35);
      if (f > 0) blit(F.spider, sp.x, y);
    }
    if (g.rat && !reduce) { // out every half minute or so for a few seconds, along the foot of the wall
      const r = g.rat; const near = pointer && Math.hypot(pointer[0] - r.hx, pointer[1] - r.hy) < 26;
      if (near) r.fled = t + 8;
      const cyc = (t + 7) % 33; const away = r.fled && t < r.fled;
      if (!away && cyc < 6) {
        const f = cyc < 2.5 ? cyc / 2.5 : cyc < 3.5 ? 1 : 1 - (cyc - 3.5) / 2.5; const sp = cyc < 3 ? F.rat : F.ratL;
        const X = r.hx - 2 + Math.round(f * r.lim); const Y = (r.floor ? H - 1 : r.hy) - sp.h + 1;
        blit(sp, X, Y);
        for (let k = 1; k <= 4; k += 1) put(X - k + (sp === F.ratL ? sp.w + 4 : 0), Y + sp.h - 2 + (k > 2 ? 1 : 0), ipal32[I.LEATHER]); // its tail
      }
    }
  }

  /** Indoor colours under a dim ambient, darker towards the corners and the beams; the window's
   *  pixels take the outdoor palette, so it shows the true sky. */
  function lightInterior() {
    const { W, H, idx, out } = interior;
    /* the sun through the windows (we face south, as outside: the back wall's windows look into it):
       a ray through the window at height z above the floor comes down to it z / tan(alt) further
       in, drifting sideways as the sun's azimuth; the floor is foreshortened by half. 1 in the beam's
       shaft of air, 2 where it lands on the floor */
    const beam = new Uint8Array(W * H); interior.beam = null;
    const sv = skyFn().sun; const alt = Math.asin(clamp(sv[2], -1, 1)); const phi = Math.atan2(sv[0], -sv[1]);
    if (alt > 3 * deg && look.night < 0.3 && weather.cover < 0.75 && !WET[weather.kind] && weather.kind !== 'fog') {
      const ta = 1 / Math.tan(alt); const side = Math.tan(clamp(phi, -1.2, 1.2)) * 0.9; let any = false;
      interior.sills.forEach(({ x0, w, y, top }) => {
        for (let wy = top + 2; wy < y; wy += 1) {
          const z = interior.yf - wy; // the window's pixel, its height above the floor
          for (let wx = x0; wx < x0 + w; wx += 1) {
            if (!out[wy * W + wx]) continue; // (the leading, the mullion)
            for (let D = 0; D < 400; D += 1) {
              const h = z - D * ta * 0.5; const sx = Math.round(wx + D * side * 0.5); const sy = Math.round(interior.yf + D * 0.25 - h);
              if (sx < 0 || sx >= W || sy >= H) break;
              if (h <= 0) { if (sy >= 0) beam[sy * W + sx] = 2; break; }
              if (D > 1 && sy >= 0 && !beam[sy * W + sx]) beam[sy * W + sx] = 1;
            }
            any = true;
          }
        }
      });
      if (any) interior.beam = beam;
    }
    // the light spread out, not stamped: the shaft and its patch blurred (two box passes, about a
    // gaussian), and the patch's glow thrown back wide round the room by the floor and the walls
    const blur = (a, r) => { // separable box blur, edges clamped
      const t = new Float32Array(W * H); const o = new Float32Array(W * H);
      for (let y = 0; y < H; y += 1) { let acc = 0; for (let x = -r; x <= r; x += 1) acc += a[y * W + clamp(x, 0, W - 1)];
        for (let x = 0; x < W; x += 1) { t[y * W + x] = acc / (2 * r + 1); acc += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)]; } }
      for (let x = 0; x < W; x += 1) { let acc = 0; for (let y = -r; y <= r; y += 1) acc += t[clamp(y, 0, H - 1) * W + x];
        for (let y = 0; y < H; y += 1) { o[y * W + x] = acc / (2 * r + 1); acc += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } }
      return o;
    };
    let shaft = null; let patch = null; let bounce = null;
    if (interior.beam) {
      const s0 = new Float32Array(W * H); const p0 = new Float32Array(W * H);
      for (let i = 0; i < W * H; i += 1) { if (beam[i] === 1) s0[i] = 1; else if (beam[i] === 2) p0[i] = 1; }
      shaft = blur(blur(s0, 2), 2); patch = blur(blur(p0, 2), 2); bounce = blur(blur(p0, 9), 9);
    }
    const sunC = look.sun; const sunW = [sunC[0], sunC[1] * 0.88, sunC[2] * 0.66]; // (warmer indoors: white read as a glare on the plaster)
    const tone = ROOM_TONE[roomOf(interior.id)] || [1, 1, 1]; // (each room its own cast)
    for (let y = 0; y < H; y += 1) {
      const vy = 0.72 + 0.28 * clamp(y / (H * 0.3));
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x;
        if (out[i]) { ibase[i] = pal32[idx[i]]; continue; }
        let v = vy * (0.62 + 0.38 * clamp(1 - Math.abs(x - W * 0.45) / (W * 0.7)));
        v *= 1 - 0.4 * clamp((Math.hypot((x - W / 2) / (W / 2), (y - H * 0.55) / (H * 0.62)) - 0.6) / 0.6); // the corners and the edges in shadow
        interior.pools.forEach((p) => { // daylight (or moonlight) falling from a window onto the floor
          if (y < interior.yf) return;
          const dx = Math.abs(x - p.x) / (p.w * 0.5 + (y - interior.yf) * 0.6);
          if (dx < 1) v *= 1 + (1 - dx) * (0.35 - 0.25 * look.night) * (1 - (y - interior.yf) / (H - interior.yf + 1) * 0.5);
        });
        let c = unpack(ipal32[idx[i]]).map((q, j) => q * v * tone[j]);
        if (shaft) c = mix(c, sunW, Math.min(0.2, 0.05 * shaft[i] + 0.15 * patch[i] + 0.25 * bounce[i])); // the shaft, its patch on the floor, the room lit round them
        ibase[i] = pack(c);
      }
    }
  }

  function stepInterior() {
    if (loom && !reduce && interior.deco.some((d) => d.type === 'ising')) loomSweep();
    interior.tk = (interior.tk || 0) + 1; const tk = interior.tk;
    if (!reduce) interior.deco.forEach((d) => {
      if (d.type === 'galton' && galton) galtonStep();
      else if (d.type === 'life' && life && tk % 6 === 0) lifeStep();
      else if (d.type === 'slits' && slits && tk % 2 === 0) { slits.hits.push([Math.floor(Math.random() * d.w), Math.floor(slitsHit(d.h))]); if (slits.hits.length > 500) slits.hits = []; }
    });
    const heat = heatOf();
    interior.flames.forEach((f) => { if (f.hearth) stepCells(interior.cells, 9, 14, heat); });
    if (heat < 0.35 && !interior.toldEmbers && interior.flames.some((f) => f.hearth)) { interior.toldEmbers = true; say('The fire has burned down to embers. Click the hearth to put a log on.'); }
    interior.motes.forEach((m) => { m.x += Math.sin(now() * 0.4 + m.ph) * 0.15; m.y += Math.cos(now() * 0.3 + m.ph) * 0.1; });
  }

  function drawInterior(t) {
    const { W, H, out, idx, lights, flames, stars, motes, blinks } = interior;
    ibuf.set(ibase);
    const bubble = (x, y, what) => { // a little speech bubble: cream, a dark rim, its tail down to the speaker
      const w = what === '!' ? 5 : 8; const INK = pack([246, 240, 224]); const RIM = pack([60, 50, 60]);
      for (let yy = 0; yy < 5; yy += 1) for (let xx = 0; xx < w; xx += 1) { const edge = yy === 0 || yy === 4 || xx === 0 || xx === w - 1; const corner = (yy === 0 || yy === 4) && (xx === 0 || xx === w - 1); if (!corner) put(x + xx, y + yy, edge ? RIM : INK); }
      put(x + 2, y + 5, RIM); put(x + 3, y + 6, RIM);
      if (what === '!') { put(x + 2, y + 1, RIM); put(x + 2, y + 3, RIM); } else [2, 4, 6].forEach((xx) => put(x + xx - 1, y + 2, RIM));
    };
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) ibuf[y * W + x] = c; };
    const blend = (x, y, rgb, a) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < W && y >= 0 && y < H) ibuf[y * W + x] = pack(mix(unpack(ibuf[y * W + x]), rgb, a));
    };
    if (look.stars > 0) {
      stars.forEach((st) => {
        const i = st.y * W + st.x;
        if (out[i] && idx[i] < N_SKY) blend(st.x, st.y, [255, 255, 255], look.stars * (reduce ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2 + st.ph)));
      });
    }
    if (look.night < 0.5) motes.forEach((m) => blend(m.x, m.y, [255, 250, 220], 0.5 * (0.5 + 0.5 * Math.sin(t + m.ph))));
    if (interior.beam) { // dust turning in the sunbeam, seen only where the light catches it
      const bm = interior.beam;
      if (!interior.dust) { const cells = []; for (let i = 0; i < bm.length; i += 7) if (bm[i] === 1) cells.push(i); interior.dust = Array.from({ length: Math.min(24, cells.length) }, () => { const i = cells[Math.floor(Math.random() * cells.length)]; return { x: i % W, y: Math.floor(i / W), ph: Math.random() * 6 }; }); }
      interior.dust.forEach((m) => {
        if (!reduce) { m.x += Math.sin(t * 0.3 + m.ph) * 0.05; m.y += Math.cos(t * 0.23 + m.ph * 2) * 0.04 + 0.01; }
        const i = Math.round(m.y) * W + Math.round(m.x);
        if (bm[i] === 1) blend(m.x, m.y, [255, 246, 214], 0.22 + 0.18 * Math.sin(t * 1.3 + m.ph)); // (a few, faint: many bright ones drew the shaft as a dotted column)
      });
    } else interior.dust = null;
    blinks.forEach((b) => put(b.x, b.y, pal32[Math.sin(t * 0.8 + b.ph) > 0.95 ? I.OUTLINE : I.CREAM]));
    // a discreet hint: a glint passes from one thing to the next, as candlelight would catch it
    if (hl < 0 && !reduce && interior.slots.length) {
      const P = 1.8; const k = Math.floor(t / P) % interior.slots.length; const ph = (t % P) / 0.9;
      const g = interior.slots[k]; // (a thing with no room to be drawn has no slot)
      if (ph < 1 && g) {
        const gx = g.x + g.w - 2; const gy = g.y + 1; const a = Math.sin(ph * Math.PI);
        blend(gx, gy, [255, 255, 240], a);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => blend(gx + dx, gy + dy, [255, 236, 170], a * 0.8));
        [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([dx, dy]) => blend(gx + dx, gy + dy, [255, 236, 170], a * 0.5));
        if (a > 0.5) [[3, 0], [-3, 0], [0, 3], [0, -3]].forEach(([dx, dy]) => blend(gx + dx, gy + dy, [255, 236, 170], a * 0.25));
        for (let x = g.x - 1; x <= g.x + g.w; x += 1) { blend(x, g.y - 1, [255, 228, 150], a * 0.18); blend(x, g.y + g.h, [255, 228, 150], a * 0.18); } // (and the thing's edge, a moment)
      }
    }
    if (board && interior.id === 'teaching') chalk.px.forEach((i) => { const x = i % RW; const y = Math.floor(i / RW); if (x >= board.l && x < board.r && y >= board.t && y < board.b) ibuf[i] = pack([226, 228, 218]); });
    if (revealing) interior.slots.forEach((g, k) => { // Shift held: every thing that can be looked at, outlined at once, a ripple going round
      if (!g || k === hl) return; const a = 0.55 + (reduce ? 0 : 0.3 * Math.sin(t * 5 - k));
      for (let x = g.x - 1; x <= g.x + g.w; x += 1) { blend(x, g.y - 1, [255, 236, 170], a); blend(x, g.y + g.h, [255, 236, 170], a); }
      for (let y = g.y; y < g.y + g.h; y += 1) { blend(g.x - 1, y, [255, 236, 170], a); blend(g.x + g.w, y, [255, 236, 170], a); }
    });
    (marksOf(interior.id) || []).forEach((label) => { // a bookmark's ribbon hanging out of a book left open at a page
      const k = interior.things.findIndex((q) => q.label === label); const g = k >= 0 && interior.slots[k]; if (!g) return;
      const rx = g.x + g.w - 3; for (let y = 0; y < 4; y += 1) put(rx + (y > 2 ? 1 : 0), g.y + g.h - 1 + y, ipal32[I.CLOTH]);
    });
    const sl = hl >= 0 && interior.slots[hl];
    if (sl) { // the thing pointed at: a pulsing outline just outside it
      const a = 0.45 + (reduce ? 0 : 0.25 * Math.sin(t * 6));
      for (let d = 1; d <= 2; d += 1) { // two rings, the outer fainter
        const b = d === 1 ? a : a * 0.45;
        for (let x = sl.x - d; x <= sl.x + sl.w - 1 + d; x += 1) { blend(x, sl.y - d, [255, 228, 150], b); blend(x, sl.y + sl.h - 1 + d, [255, 228, 150], b); }
        for (let y = sl.y - d + 1; y < sl.y + sl.h - 1 + d; y += 1) { blend(sl.x - d, y, [255, 228, 150], b); blend(sl.x + sl.w - 1 + d, y, [255, 228, 150], b); }
      }
    }
    interior.deco.forEach((d) => {
      const P = (n) => pal32[I[n]];
      if (d.type === 'copyist') { // the hand and the quill go along the line, back to the inkhorn when the hourglass turns
        const k = reduce ? 0.4 : (t % 60) / 60; const dip = k > 0.93;
        const hx = dip ? d.x + 8 : d.x + 1 + Math.round(k * 6 / 0.93); const hy = (dip ? d.y - 1 : d.y + 1 - Math.floor((hx - d.x) / 4)) - (Math.floor(t * 5) % 2);
        put(hx - 1, hy + 1, P('SKIN')); put(hx, hy, P('SKIN_SH')); put(hx + 1, hy - 1, P('BEARD_HI')); put(hx + 2, hy - 2, P('BEARD')); // hand, quill, its feather
        for (let x = d.x - 3; x < hx - 1; x += 1) put(x, hy + 2, P('BLACKFUR')); // the sleeve
      }
      if (d.type === 'hourglass') { // sand runs for a minute, then the glass is turned
        const k = reduce ? 0.5 : (t % 60) / 60;
        put(d.x - 2, d.y, P('TIMBER_HI')); put(d.x + 2, d.y, P('TIMBER_HI')); put(d.x - 2, d.y + 8, P('TIMBER_HI')); put(d.x + 2, d.y + 8, P('TIMBER_HI'));
        for (let x = -2; x <= 2; x += 1) { put(d.x + x, d.y, P('TIMBER')); put(d.x + x, d.y + 8, P('TIMBER')); }
        for (let y = 1; y < 8; y += 1) {
          const half = Math.abs(y - 4) * 0.5 + 0.5;
          for (let x = -Math.floor(half); x <= Math.floor(half); x += 1) put(d.x + x, d.y + y, P('BEARD_SH'));
        }
        const top = Math.round(3 * (1 - k)); const bot = Math.round(3 * k);
        for (let y = 4 - top; y < 4; y += 1) put(d.x, d.y + y, P('GOLD'));
        for (let y = 0; y < bot; y += 1) { put(d.x, d.y + 7 - y, P('GOLD')); if (y < bot - 1) { put(d.x - 1, d.y + 7 - y, P('GOLD_SH')); put(d.x + 1, d.y + 7 - y, P('GOLD_SH')); } }
        if (k > 0 && k < 1 && Math.floor(t * 6) % 2) put(d.x, d.y + 5, P('GOLD_HI'));
      } else if (d.type === 'raven') { // at home in its pigeonhole: it turns round now and then, blinks; fed, down to the trough and back
        let x0 = d.x; let y0 = d.y; let sp = (Math.floor((t + d.ph) / 6) % 3 === 2 && !reduce) ? (SPRITES.ravenL ||= flip(SPRITES.raven)) : SPRITES.raven;
        const fd = feeding && interior.deco.find((q) => q.type === 'feeder');
        if (fd) {
          const e = t - feeding.t0 - (d.ph % 1) * 0.6; const k2 = interior.deco.indexOf(d) % 5; const tx = fd.x - 6 + k2 * 3; const ty = fd.y - sp.h + 1;
          const fly = (f) => [d.x + (tx - d.x) * f, d.y + (ty - d.y) * f - Math.sin(f * Math.PI) * 10];
          if (e > 0 && e < 1.2) { [x0, y0] = fly(e / 1.2); if (Math.floor(t * 10) % 2) y0 -= 1; }
          else if (e >= 1.2 && e < 6) { x0 = tx; y0 = ty + (Math.floor(t * 4 + k2) % 3 === 0 ? 1 : 0); sp = tx > fd.x ? (SPRITES.ravenL ||= flip(SPRITES.raven)) : SPRITES.raven; }
          else if (e >= 6 && e < 7.2) { [x0, y0] = fly(1 - (e - 6) / 1.2); }
          if (t - feeding.t0 > 8) feeding = null;
        }
        for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const c = sp.px[y * sp.w + x]; if (c >= 0) put(Math.round(x0) + x, Math.round(y0) + y, ipal32[c]); }
      } else if (d.type === 'drip') { // a drop swells on the vault for four seconds, falls in a third of one, splashes
        const ph = reduce ? 0 : (t % 5) / 5; const blue = [150, 175, 200];
        if (ph < 0.8) blend(d.x, d.y + Math.floor(ph * 2.5), blue, 0.4 + ph * 0.6);
        else if (ph < 0.93) blend(d.x, d.y + ((ph - 0.8) / 0.13) * (d.floor - d.y), blue, 0.9);
        else [[-1, 0], [1, 0], [-2, -1], [2, -1]].forEach(([dx, dy]) => blend(d.x + dx, d.floor + dy, blue, 0.6 * (1 - (ph - 0.93) / 0.07)));
      } else if (d.type === 'zzz') { // the sleeper's z's, rising and fading
        if (!reduce) for (let k = 0; k < 2; k += 1) { const ph = (t * 0.5 + k * 0.5) % 1; const zx = d.x + Math.round(ph * 3) + k; const zy = d.y - Math.round(ph * 8); [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]].forEach(([dx, dy]) => blend(zx + dx, zy + dy, [240, 240, 255], 0.8 * (1 - ph))); }
      } else if (d.type === 'bellows') { // pumped every few seconds: the upper board comes down, the fire answers
        const k = reduce ? 0 : Math.max(0, Math.sin(t * 1.4)) ** 3; const dy = Math.round(k * 2);
        for (let x = 0; x < 10; x += 1) { put(d.x + x, d.y - 4 + Math.floor(x / 4) + dy, P('TIMBER_HI')); if (dy) put(d.x + x, d.y - 4 + Math.floor(x / 4), P('LEATHER_SH')); }
        if (k > 0.6) fireFed = Math.max(fireFed, now() - 20); // (a breath of air keeps the hearth up)
      } else if (d.type === 'anvil') { // struck: sparks fly up and fall, for half a second
        { // the bar of iron, on the anvil or in the fire, glowing as hot as it is
          const T = barTemp(t); const gl = glowOf(T); const hf = interior.flames.find((q) => q.hearth);
          const [bx, by] = bar.where === 'fire' && hf ? [hf.x - 5, hf.y - 2] : [d.x + 3, d.y - 1];
          for (let k = 0; k < 10; k += 1) put(bx + k, by, gl ? pack(gl) : P('ARM_SH'));
          if (gl) for (let k = -1; k <= 10; k += 2) blend(bx + k, by - 1, gl, 0.35);
        }
        const e = t - (interior.struck || -9);
        if (e < 0.7) for (let k = 0; k < 9; k += 1) { const a = -Math.PI / 2 + (k - 4) * 0.28; const v = 14 + (k * 7) % 9; const x = d.x + 6 + Math.cos(a) * v * e; const y = d.y + Math.sin(a) * v * e + 22 * e * e; put(x, y, pack(k % 3 ? [255, 210, 90] : [255, 250, 220])); }
      } else if (d.type === 'eyepiece') { // at night a star caught in the eyepiece, twinkling
        if (look.night > 0.4) { const a = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * 5.3); blend(d.x + 1, d.y, [255, 250, 220], a); blend(d.x, d.y, [200, 220, 255], a * 0.5); blend(d.x + 2, d.y, [200, 220, 255], a * 0.5); }
      } else if (d.type === 'orrery') { // brass rings, the sun, three planets at their own speeds
        put(d.x, d.y + 7, P('TIMBER_SH')); put(d.x, d.y + 6, P('GOLD_SH')); put(d.x - 2, d.y + 8, P('TIMBER_SH')); put(d.x + 2, d.y + 8, P('TIMBER_SH'));
        put(d.x, d.y, pack([255, 210, 90]));
        [[2.2, 0.9, 'WING_HI'], [3.6, 0.5, 'CAP'], [5, 0.3, 'ROBE_HI']].forEach(([r, w, c], k) => {
          for (let a = 0; a < 6.28; a += 0.5) put(d.x + Math.round(Math.cos(a) * r), d.y + Math.round(Math.sin(a) * r * 0.45), P('GOLD_SH'));
          const a = (reduce ? k : t * w) + k * 2;
          put(d.x + Math.round(Math.cos(a) * r), d.y + Math.round(Math.sin(a) * r * 0.45), P(c));
        });
      } else if (d.type === 'cabinet') { // a keepsake per curiosity found, four to a shelf
        const KEEP = ['GOLD', 'FL_RED', 'ARM_HI', 'FL_BLUE', 'GRASS_HI', 'CREAM', 'RUST_HI', 'FL_VIOLET'];
        { const x = d.x + d.w - 8; const y = d.y + 2; // Blanc Blanc, a little white cat with black patches, always on the top shelf, sitting, facing us
          ['O...W.', 'OWWWW.', 'WOWOW.', '.WWW..', 'WWWWWW', 'WWOWW.'].forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') put(x + i, y + j, P(c === 'W' ? 'FL_WHITE' : 'OUTLINE')); })); }
        curiosOf().found.forEach((k, j) => { const row = Math.floor(j / 4) % 4; const col = row === 0 ? Math.min(j % 4, 1) : j % 4; const x = d.x + 2 + col * 4; const y = d.y + (row + 1) * 8 - 1; // (each on its shelf)
          put(x, y, P(KEEP[(k.length + j) % KEEP.length])); put(x, y - 1, P(KEEP[(k.charCodeAt(0) + j) % KEEP.length])); });
      } else if (d.type === 'slits') {
        slits ||= { hits: [] }; // each spot glows by its count, so the stripes build up; the last photon flashes
        const n = new Uint16Array(d.w * d.h); slits.hits.forEach(([x, y]) => { n[y * d.w + x] += 1; });
        const RAMP = ['ARM_SH', 'ARM', 'ARM', 'PLASTER', 'PLASTER', 'PLASTER_HI'];
        n.forEach((c, i) => { if (c) put(d.x + (i % d.w), d.y + Math.floor(i / d.w), P(RAMP[Math.min(RAMP.length - 1, c - 1)])); });
        const last = slits.hits[slits.hits.length - 1]; if (last) put(d.x + last[0], d.y + last[1], P('CREAM'));
      } else if (d.type === 'galton') {
        const g = galtonOf(7);
        g.bins.forEach((c, k) => { for (let j = 0; j < Math.min(c, d.bh); j += 1) put(d.x + 1 + 2 * k, d.y + 18 + d.bh - j, P('ARM_SH')); });
        if (g.ball) put(d.x + 8 - g.ball.r + 2 * g.ball.k, d.y + 2 + g.ball.r * 2, P('ARM_HI'));
      } else if (d.type === 'life') {
        const L = lifeOf(d.w, d.h);
        for (let y = 0; y < d.h; y += 1) for (let x = 0; x < d.w; x += 1) put(d.x + x, d.y + y, L.g[y * d.w + x] ? P(d.board ? 'BEARD_HI' : (x * 3 + y) % 5 ? 'PLASTER' : 'PLASTER_HI') : P(d.board ? ((x + y) % 2 ? 'TIMBER_SH' : 'OUTLINE') : 'SLATEB')); // (on the games table: pale pieces on a checkered board) // (chalk on slate, like the schoolroom's board)
      } else if (d.type === 'ising') { // red up, blue down, in dyed wool: the warp every third thread, the weft every other row
        const lm = loomOf(d.w, d.h); const wool = [70, 52, 40];
        const up = mix(unpack(P('FLAG')), wool, 0.3); const dn = mix(unpack(P('FLAG2')), wool, 0.3);
        for (let y = 0; y < d.h; y += 1) {
          for (let x = 0; x < d.w; x += 1) put(d.x + x, d.y + y, pack(mix(lm.s[y * d.w + x] > 0 ? up : dn, [0, 0, 0], (x % 3 === 0 ? 0.18 : 0) + (y % 2 ? 0.08 : 0))));
        }
      } else if (d.type === 'fringes') { // the slit's light on the floor: sinc^2, each colour its own width
        const sv = skyFn().sun; const alt = Math.asin(clamp(sv[2], -1, 1));
        if (alt > 3 * deg && look.night < 0.3 && weather.cover < 0.75 && !WET[weather.kind]) {
          const phi = Math.atan2(sv[0], -sv[1]); const fy = interior.yf + 4 + Math.round(Math.min(14, 0.25 * (interior.yf - d.y - d.h / 2) / Math.tan(alt)));
          const cx = d.x + Math.round(Math.tan(clamp(phi, -1.1, 1.1)) * 10); const sinc2 = (u) => (u === 0 ? 1 : (Math.sin(u) / u) ** 2);
          for (let x = -18; x <= 18; x += 1) {
            const rgb = [0.65, 0.53, 0.44].map((lam) => sinc2((x * 0.35) / lam)); // (red, green, blue: wavelengths in proportion)
            for (let y = 0; y < 2; y += 1) blend(cx + x, fy + y, rgb.map((q) => 160 + 95 * q), clamp(0.5 * Math.max(...rgb)));
          }
        }
      } else if (d.type === 'cinema') { // the film's frame on the sheet, flickering; the beam from the lantern
        const fm = real.melies; if (!fm || !fm.film) return;
        if (!cinemaT0) cinemaT0 = t; const k = Math.floor((t - cinemaT0) * fm.fps) % fm.n; const per = (fm.w * fm.h) / 4;
        const flick = reduce ? 1 : 0.86 + 0.14 * Math.random(); const G = [16, 92, 176, 244].map((v) => pack([v * flick, v * flick * 0.97, v * flick * 0.9]));
        for (let y = 0; y < fm.h; y += 1) for (let x = 0; x < fm.w; x += 1) {
          const i = y * fm.w + x; const byte = fm.film[k * per + (i >> 2)]; const v = (byte >> (6 - 2 * (i & 3))) & 3;
          put(d.x + 1 + x, d.y + 1 + y, G[v]);
        }
        for (let s0 = 0; s0 <= 1; s0 += 0.02) { // the beam: a faint cone through the dust
          const ex = d.x + d.w / 2 + (Math.random() - 0.5) * d.w * 0.9; const ey = d.y + d.h / 2 + (Math.random() - 0.5) * d.h * 0.9;
          blend(d.lx + (ex - d.lx) * s0, d.ly + (ey - d.ly) * s0, [255, 246, 220], 0.12);
        }
      } else if (d.type === 'ladder') { // two stiles leaning from the rail, rungs every third row
        const Q = (n) => ipal32[I[n]]; const lx = Math.round(d.a + (d.b - d.a) * ladderF); const len = d.foot - d.top; const lean = 6;
        for (let y = 0; y <= len; y += 1) {
          const dx = Math.round((y / len) * lean); put(lx + dx, d.top + y, Q('TIMBER_HI')); put(lx + 4 + dx, d.top + y, Q('TIMBER_SH'));
          if (y % 3 === 2) for (let k = 1; k < 4; k += 1) put(lx + dx + k, d.top + y, Q('TIMBER'));
        }
        put(lx, d.top, Q('GOLD')); put(lx + 4, d.top, Q('GOLD')); // the hooks on the rail
      } else if (d.type === 'astroclock') { // the hours round the rim (noon at the top), the gilt sun on its hand, the sign, the moon
        const dd = clockFn(); const hr = dd.getHours() + dd.getMinutes() / 60; const R = d.r;
        for (let k = 0; k < 24; k += 1) { const a = (k / 24) * 6.283; put(d.x + Math.round(Math.sin(a) * (R - 0.6)), d.y - Math.round(Math.cos(a) * (R - 0.6)), P(k % 6 === 0 ? 'GOLD_HI' : 'GOLD_SH')); }
        const days = dd.getTime() / 864e5 + 2440587.5 - 2451545.0; const sign = Math.floor((window.sunEcliptic ? window.sunEcliptic(days).lambda : 0) / 30) % 12;
        for (let k = 0; k < 12; k += 1) { const a = (k / 12) * 6.283; put(d.x + Math.round(Math.sin(a) * (R - 3)), d.y - Math.round(Math.cos(a) * (R - 3)), P(k === sign ? 'FL_RED' : k % 2 ? 'T_AZURE' : 'T_ARGENT')); }
        const ang = ((hr - 12) / 24) * 6.283; // the hand
        for (let r = 1; r < R - 1; r += 1) put(d.x + Math.round(Math.sin(ang) * r), d.y - Math.round(Math.cos(ang) * r), P('GOLD'));
        put(d.x + Math.round(Math.sin(ang) * (R - 1)), d.y - Math.round(Math.cos(ang) * (R - 1)), P('GOLD_HI'));
        const age = window.moon ? window.moon(dd) : { age: 15 }; const lit = 1 - Math.abs(age.age - 14.77) / 14.77; // the moon in the middle, lit as tonight
        [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => put(d.x + dx, d.y + dy, P((dx === 0 || lit > 0.5 || (dx > 0) === (age.age < 14.77)) && lit > 0.15 ? 'CREAM' : 'SLATEB')));
      } else if (d.type === 'portraits') { // the portrait by the line the master points at catches the light
        const md = interior.deco.find((q) => q.type === 'master'); const st = md && masterAt(md, t);
        if (st && st.pointing && Math.floor(t * 2) % 2) { const x = d.xs[st.stop]; const y = d.ys[st.stop]; put(x - 1, y - 1, P('GOLD_HI')); put(x + d.w, y + d.h, P('GOLD_HI')); }
      } else if (d.type === 'dweller' && d.fig) { // from stop to stop at a walk (7 px/s), five or so seconds at each
        const legs = d.stops.map((x, k) => [x, d.stops[(k + 1) % d.stops.length]]);
        const dur = legs.map(([a, b]) => 5 + ((a * 7) % 3) + Math.abs(b - a) / 7); const T = dur.reduce((u, v) => u + v, 0);
        let u = (reduce ? 0 : t + d.ph) % T; let k = 0; while (u > dur[k]) { u -= dur[k]; k += 1; }
        const [a, b] = legs[k]; let walk = u - (dur[k] - Math.abs(b - a) / 7); // (the pause first, then the walk)
        const seen = openIx >= 0 && interior.slots[openIx]; // a card open: he stops where he is and looks at the thing
        if (!seen) { const x = walk > 0 ? a + Math.sign(b - a) * Math.min(Math.abs(b - a), walk * 7) : a; d.x = Math.round(x); } else walk = 0;
        const act = d.act !== undefined && t - d.act < 1.2 ? (t - d.act) / 1.2 : -1; // clicked: his own gesture, a second long
        const hop = act >= 0 && ['contact', 'talks'].includes(d.kind) && act < 0.5 ? (Math.floor(act * 8) % 2) : 0;
        const y0 = d.y - (walk > 0 && Math.floor(t * 4) % 2 ? 1 : 0) - hop;
        const f = seen ? (seen.x + seen.w / 2 > d.x + d.w / 2 ? d.figR : d.figL) : d.fig;
        if (act >= 0) dwellerAct(d, act, y0, put, blend, P);
        for (let y = 0; y < f.h; y += 1) for (let xx = 0; xx < f.w; xx += 1) { const c = f.px[y * f.w + xx]; const X = d.x + xx; const Y = y0 + y; if (c >= 0 && X >= 0 && X < W && Y >= 0 && Y < H) put(X, Y, ipal32[c]); }
      } else if (d.type === 'master') { // four stops along the board: he points at a line, turns to the class, walks on
        const ms = masterAt(d, t); d.x = ms.x; d.facing = ms.facing;
        const sp = ms.facing > 0 ? SPRITES.master : SPRITES.masterL; const y0 = d.yb - sp.h - (ms.walking && Math.floor(t * 4) % 2 ? 1 : 0);
        for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) {
          const c = sp.px[y * sp.w + x]; const X = Math.round(ms.x) + x; const Y = y0 + y;
          if (c >= 0 && X >= 0 && X < W && Y >= 0 && Y < H && !interior.front[Y * W + X]) put(X, Y, ipal32[c]); // (behind the desks and the pupils)
        }
        if (ms.pointing) { // the line pointed at catches the light; his staff's knob glints
          const ly = d.top + 5 + (ms.stop % d.rows) * 7; const lx = Math.round(ms.x) + sp.w + 2;
          for (let k = 0; k < 6; k += 1) blend(lx + k * 3, ly, [255, 246, 214], 0.5 + 0.3 * Math.sin(t * 4 + k));
          put(Math.round(ms.x) + ORB[0], y0 + ORB[1], P('GOLD_HI'));
        }
        if (ms.caught) bubble(Math.round(ms.x) + 4, y0 - 7, '!');
      } else if (d.type === 'chatter') { // while his back is turned the pupils whisper, two at a time
        const m = interior.deco.find((q) => q.type === 'master'); const ms = m && masterAt(m, t);
        const ch = chatAt(d.heads, t); d.now = ch;
        const near = ch && ms && ch.some((h) => Math.abs(h.x - (ms.x + SPRITES.master.w / 2)) < 18); // (not under his nose)
        if (ch && ms && ms.facing > 0 && !near) { const [a, b] = ch; const who = Math.floor(t / 0.9) % 2 ? b : a; bubble(who.x - 3, who.y - 9, '...'); }
      } else if (d.type === 'engine') { // the glass: amber lines typed on the dark, a cursor; the orb over it breathing
        if (d.halo) { const R = 22; const br = reduce ? 1 : 0.85 + 0.15 * Math.sin(t * 1.7); for (let y = -R; y <= R; y += 1) for (let x = -R; x <= R; x += 1) { const q = Math.hypot(x, y * 1.2) / R; if (q < 1) blend(d.ox + x, d.oy + 12 + y, [120, 190, 255], (1 - q) ** 2 * 0.22 * br); } } // a bluish halo: it is not of this room's time
        const BG = pack([24, 20, 14]); const AMB = [232, 168, 56];
        for (let y = 0; y < d.h; y += 1) for (let x = 0; x < d.w; x += 1) {
          const corner = (x === 0 || x === d.w - 1) && (y === 0 || y === d.h - 1); if (corner) continue;
          put(d.x + x, d.y + y, BG);
        }
        const ln = Math.floor(reduce ? 3 : t * 1.5); // a line every two thirds of a second, scrolling
        for (let r = 0; r < 4; r += 1) {
          const len = 2 + ((ln - 3 + r) * 7919 % 6 + 6) % 6; const y = d.y + 2 + r * 2;
          for (let k = 0; k < len; k += 1) put(d.x + 2 + k, y, pack(AMB.map((c) => c * (r === 3 ? 1 : 0.55 + r * 0.12))));
          if (r === 3 && Math.floor(t * 2) % 2) put(d.x + 3 + len, y, pack(AMB));
        }
        const a = reduce ? 0.6 : 0.5 + 0.35 * Math.sin(t * 1.7);
        for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) { // the orb: a glass ball, a light in it, a halo round it
          const r = Math.hypot(x + 0.5, y + 0.5); const X = d.ox - 1 + x; const Y = d.oy + y;
          if (r < 1.3) put(X, Y, pack([170 + 80 * a, 210 + 40 * a, 255])); else if (r < 2.4) put(X, Y, pack([70 + 60 * a, 110 + 60 * a, 170 + 50 * a])); else if (r < 3.2) blend(X, Y, [160, 200, 255], 0.35 * a);
        }
        put(d.ox - 2, d.oy - 1, pack([255, 255, 255])); // (a glint on the glass)
      } else if (d.type === 'globe') { // the Earth turning under the hand, lit by the real sun (night side dark)
        const now0 = clockFn(); const doy = (now0 - new Date(now0.getFullYear(), 0, 0)) / 864e5;
        const dec = -23.44 * Math.cos((2 * Math.PI * (doy + 10)) / 365) * deg; const slon = (12 - (now0.getUTCHours() + now0.getUTCMinutes() / 60)) * 15 * deg; // the subsolar point
        const sun = [Math.cos(dec) * Math.sin(slon), Math.sin(dec), Math.cos(dec) * Math.cos(slon)];
        const dt = Math.min(0.1, t - (globe.t || t)); globe.t = t;
        if (!globe.drag) { globe.lon += globe.vel * dt; globe.vel *= 0.35 ** dt; } // (let go: it spins on, slowing)
        const R = d.r; const lon0 = globe.lon;
        for (let y = -5; y <= 5; y += 1) for (let x = -5; x <= 5; x += 1) {
          const u = (x + 0.5) / (R + 0.5); const v = (y + 0.5) / (R + 0.5); const q = u * u + v * v; if (q > 1) continue;
          const z = Math.sqrt(1 - q); const lat = Math.asin(-v); const lon = lon0 + Math.atan2(u, z);
          const ci = Math.floor(((((lon / deg) + 180) % 360) + 360) % 360 / 7.5); const ri = Math.min(23, Math.max(0, Math.floor((90 - lat / deg) / 7.5)));
          const land = (parseInt(WORLD_MAP[ri * 12 + (ci >> 2)], 16) >> (3 - (ci & 3))) & 1;
          const p3 = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
          const day = p3[0] * sun[0] + p3[1] * sun[1] + p3[2] * sun[2] > -0.05 * bayer(d.x + x, d.y + y);
          put(d.x + x, d.y + y, P(day ? (land ? (lat / deg < -66 ? 'SNOW' : 'FERN') : q < 0.3 && u + v < 0 ? 'WATER_HI' : 'WATER') : land ? 'FG_PINE' : 'T_NAVY'));
        }
      } else if (d.type === 'portcullis') { // the door behind opens on the day as it rises; its bars stripe the light on the floor
        const dt = Math.min(0.05, t - (gate.at || t)); gate.at = t; if (gate.lift !== gate.to) { gate.lift += Math.sign(gate.to - gate.lift) * Math.min(Math.abs(gate.to - gate.lift), dt / 3); if (!reduce && Math.random() < 0.15) sfx('tick'); }
        const H0 = interior.yf; const up = Math.round(gate.lift * (H0 - d.t));
        const day = 1 - look.night; const nightK = look.night > 0.5;
        if (gate.lift > 0.15) for (let y = d.t; y < H0; y += 1) for (let x = d.a; x < d.b; x += 1) { // (the door open: the sky, the far hills, the road going off)
          const r = (d.b - d.a) / 2; const ax = (x + 0.5 - d.a - r) / r; const ay = (y - d.t - r) / r; if (!(y >= d.t + r || ax * ax + ay * ay <= 1)) continue;
          const f = (y - d.t) / (H0 - d.t); const hill = 0.62 + 0.05 * Math.sin(x * 0.7) + 0.03 * Math.sin(x * 1.9); const road = Math.abs(x - (d.a + d.b) / 2) < (f - 0.75) * (d.b - d.a) * 1.4;
          const c = f > 0.75 ? (road ? (nightK ? [70, 60, 55] : [207, 167, 126]) : (nightK ? [30, 50, 40] : [90, 140, 70])) : f > hill ? (nightK ? [24, 40, 36] : [70, 120, 90]) : mix(nightK ? [20, 26, 50] : [120, 165, 215], nightK ? [40, 50, 80] : [215, 228, 236], f / hill);
          put(x, y, pack(c));
        }
        for (let y = Math.max(d.t, d.t - up); y < H0 - up; y += 1) for (let x = d.a; x < d.b; x += 1) if ((x - d.a) % 4 === 1 || (y - d.t + up) % 5 === 2) put(x, y, P(((x - d.a) % 4 === 1) ? 'ARM_SH' : 'OUTLINE')); // the grid, what of it is still down
        if (gate.lift > 0.15 && day > 0.2) for (let y = H0; y < interior.H; y += 1) { const k = (y - H0) / (interior.H - H0); const w0 = (d.b - d.a) * (1 + k * 1.2); const x0 = (d.a + d.b) / 2 - w0 / 2;
          for (let x = Math.floor(x0); x < x0 + w0; x += 1) { const barred = gate.lift < 0.97 && Math.floor((x - x0) / (w0 / ((d.b - d.a) / 4))) % 2 === 0 && k < 1 - gate.lift; blend(x, y, [255, 240, 200], (barred ? 0.05 : 0.28) * day * gate.lift * (1 - k * 0.6)); } }
      } else if (d.type === 'feeder') { // the grain: pecked at while the ravens are down
        if (pour && t - pour.t0 < 1.5) for (let k = 0; k < 4; k += 1) blend(pour.x, pour.y + 1 + ((t * 12 + k) % 5), [120, 20, 40], 0.8);
      } else if (d.type === 'puddle') { // under the drip, a puddle as wide as the rain is hard and long (it spreads while you stay)
        const wet = WET[weather.kind] || 0; if (wet < 0.7) return;
        const r = Math.min(9, 2 + wet * 3 + (t - roomT0) / 20);
        for (let y = -2; y <= 2; y += 1) for (let x = -Math.ceil(r); x <= Math.ceil(r); x += 1) { const q = (x / r) ** 2 + (y / (r * 0.3)) ** 2; if (q < 1) blend(d.x + x, d.y + y, q < 0.3 && (x + Math.floor(t * 2)) % 7 === 0 ? [200, 220, 235] : [90, 110, 130], 0.5 * (1 - q * 0.6)); }
      } else if (d.type === 'inked') { // the visitor's drawing on the copyist's page, a few dark strokes as small as the page
        const n = Math.min(14, Math.ceil(inkOf() / 12)); for (let k = 0; k < n; k += 1) put(d.x + ((k * 5) % 8), d.y + ((k * 3) % 3) - Math.floor(((k * 5) % 8) / 3), P('OUTLINE'));
      } else if (d.type === 'gear') { // a brass wheel: a solid disc, its rim, spokes and teeth that turn, the axle
        const a0 = reduce ? 0 : t * d.sp;
        for (let y = -d.r; y <= d.r; y += 1) for (let x = -d.r; x <= d.r; x += 1) {
          const r = Math.hypot(x, y); if (r > d.r + 0.3) continue;
          const spoke = r > 1.2 && r < d.r - 0.8 && [0, 1, 2].some((k) => Math.abs(Math.sin(Math.atan2(y, x) - a0 - (k * Math.PI) / 3)) * r < 0.6);
          put(d.x + x, d.y + y, P(r > d.r - 0.8 ? 'GOLD' : spoke ? 'GOLD' : r < 1.2 ? 'ARM_SH' : 'GOLD_SH'));
        }
        const nt = 2 * d.r + 2; for (let k = 0; k < nt; k += 1) { const a = a0 + (k * 2 * Math.PI) / nt; put(d.x + Math.round(Math.cos(a) * (d.r + 1)), d.y + Math.round(Math.sin(a) * (d.r + 1)), P('GOLD_HI')); }
      }
    });
    drawGuide(t, put, blend);
    if (opens.get(interior.id) && weather.kind === 'snow') interior.sills.forEach((sl) => { // snow coming in by the open window, lying on its sill
      const n = Math.min(sl.w + 4, Math.floor((t - roomT0) / 1.5)); for (let k = 0; k < n; k += 1) put(sl.x0 - 2 + ((k * 7) % (sl.w + 4)), sl.y - (k >= sl.w + 4 ? 1 : 0), pack([240, 244, 250]));
      if (!reduce) for (let k = 0; k < 4; k += 1) { const f = ((t * 0.6 + k * 0.27) % 1); blend(sl.x0 + ((k * 5 + Math.floor(t)) % sl.w), sl.top + f * (sl.y - sl.top + 10), [245, 248, 255], 0.8); }
    });
    if (pour && t - pour.t0 < 1.5) for (let k = 0; k < 4; k += 1) blend(pour.x, pour.y + 1 + Math.floor((t * 12 + k) % 6), [110, 16, 36], 0.85); // (wine from the spigot)
    if (flight && interior.sills.length) { // the raven leaving by the window: across its sky, smaller as it goes
      const e = (t - flight.t0) / 1.6; const sl = interior.sills[0];
      if (e >= 1) flight = null;
      else {
        const x = sl.x0 + sl.w * (0.15 + 0.75 * e); const y = sl.y - 3 - (sl.y - sl.top) * 0.75 * e; const up = Math.floor(t * 10) % 2; const big = e < 0.5;
        const ink = ipal32[I.OUTLINE]; const pts = big ? [[0, 0], [1, 0], [-1, up ? -1 : 1], [-2, up ? -1 : 1], [2, up ? -1 : 1], [3, up ? -1 : 1]] : [[0, 0], [-1, up ? -1 : 0], [1, up ? -1 : 0]];
        pts.forEach(([dx, dy]) => { const X = Math.round(x) + dx; const Y = Math.round(y) + dy; if (X >= 0 && X < W && Y >= 0 && Y < H && out[Y * W + X]) put(X, Y, ink); }); // (only in the opening)
      }
    }
    interior.camps.forEach((c) => { // the campfire through the window, and the two by it
      const hot = reduce || Math.random() < 0.6;
      if (look.night > 0.3) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => blend(c.x + dx, c.y + dy, [255, 150, 60], 0.45 * look.night));
      put(c.x, c.y, pack(hex(FIRE[hot ? 7 : 5]))); put(c.x, c.y - 1, pack(hex(FIRE[hot ? 5 : 4])));
      put(c.x + 2, c.y, pal32[I.ARM]); put(c.x + 2, c.y - 1, pal32[I.ARM_HI]); // the knight, seated
      put(c.x + 4, c.y, pal32[I.ROBE]); put(c.x + 4, c.y - 1, pal32[I.ROBE]); put(c.x + 4, c.y - 2, pal32[I.HAT]); // the wizard
    });
    const lit = ROOM_LIGHT[roomOf(interior.id)] || candleLit;
    const out1 = blown.get(interior.id); const gust = opens.get(interior.id) ? 3.5 : 1; // (blown candles; a draught from an open window)
    flames.forEach((f, k) => { f.off = Boolean(out1 && out1.has(k)); });
    lights.forEach((l) => { l.off = !l.hearth && flames.some((f) => f.off && Math.abs(f.x - l.x) <= 1 && Math.abs(f.y - l.y) <= 2); });
    const dark = flames.some((f) => !f.hearth) && flames.every((f) => f.hearth || f.off);
    if (dark && look.night > 0.3 && roomPointer) lights.push({ x: roomPointer[0], y: roomPointer[1], r: 0.22 * H, hand: true }); // (in the dark, the pointer carries a candle: its light, its flame below)
    if (dark) for (let i = 0; i < W * H; i += 1) if (!out[i]) { const c = unpack(ibuf[i]); ibuf[i] = pack(look.night > 0.3 ? [c[0] * 0.42, c[1] * 0.48, c[2] * 0.68] : c.map((v) => v * 0.82)); } // (no candle: the moon's blue, or the day's grey)
    lights.forEach((l, k) => { // warm, stepped, flickering; further by night (nothing else lights the room then)
      if (l.off) return;
      const R = l.r * (1 + 0.25 * look.night) * (l.hearth ? 0.35 + 0.65 * heatOf() : 1) * (1 + (reduce ? 0 : gust * (0.05 * Math.sin(t * 11 + k * 2) + 0.03 * Math.sin(t * 23 + k))));
      for (let y = Math.max(0, Math.floor(l.y - R)); y < Math.min(H, l.y + R); y += 1) {
        for (let x = Math.max(0, Math.floor(l.x - R)); x < Math.min(W, l.x + R); x += 1) {
          const i = y * W + x;
          if (out[i]) continue;
          const dd = Math.hypot(x - l.x, (y - l.y) * 1.25) / R;
          if (dd >= 1) continue;
            // five steps, the dither only a sliver at each step's edge; mixed towards a warm
          // target that never runs to white (a candle lights, it does not blind)
          const kk = Math.floor(((1 - dd) ** 1.7 * 0.7) * 5 + 0.25 + bayer(x, y) * 0.5) / 5;
          if (kk <= 0) continue;
          const c = unpack(ibuf[i]);
          ibuf[i] = pack(mix(c, lit(c), kk));
        }
      }
    });
    const fc = FIRE.map((h) => (h ? pack(hex(h)) : 0));
    if (dark && look.night > 0.3 && roomPointer) { const [px0, py0] = roomPointer; put(px0, py0 + 1, P0('STEM')); put(px0, py0, fc[7]); put(px0, py0 - 1, fc[Math.random() < 0.7 ? 6 : 5]); }
    const hand = lights.findIndex((l) => l.hand); if (hand >= 0) lights.splice(hand, 1); // (the pointer's candle: this frame only)
    flames.forEach((f) => {
      if (f.hearth) {
        for (let y = 0; y < 14; y += 1) {
          for (let x = 0; x < f.w; x += 1) {
            const cx = Math.min(8, Math.floor((x / f.w) * 9));
            const lv = Math.min(FIRE_MAX, Math.floor(interior.cells[y * 9 + cx] + bayer(x, y) * 0.9));
            if (lv > 0) put(f.x - f.w / 2 + x, f.y - 14 + y, fc[lv]);
          }
        }
        return;
      }
      if (f.hand) return;
      if (f.off) { // a wisp of smoke for two seconds, then nothing
        const e = f.smoke ? t - f.smoke : 9; if (e < 2) for (let j = 0; j < 4; j += 1) blend(f.x + Math.round(Math.sin(e * 5 + j) * (j * 0.5)), f.y - 1 - j - Math.round(e * 3), [170, 165, 160], 0.6 * (1 - e / 2) * (1 - j / 5));
        return;
      }
      const hot = reduce || Math.random() < 0.7 / gust;
      put(f.x + (gust > 1 && !reduce && Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0), f.y, fc[7]); put(f.x, f.y - 1, fc[hot ? 6 : 5]);
      if (!f.small && hot) put(f.x, f.y - 2, fc[4]);
    });
  }

  const ZOOMS = [1, 2, 3, 4, 6]; // integer steps: the pixels stay square all the way in
  const STEP = 0.09; const DISSOLVE = 0.32; // seconds per step; the dithered cross-fade
  const CLIMB = 0.55; // seconds through a floor slab (the tower)
  const SWAP = 0.18; // seconds of the dithered cross-fade from a room to another
  /** The slab's stone, mortar and edge, dimmed at night as the rooms are. */
  const slabColours = () => { const k = 1 - 0.55 * look.night; return [[118, 104, 92], [74, 64, 58], [40, 34, 32]].map((c) => pack(c.map((v) => v * k))); };

  function setReady(on) { root.classList.toggle('room-ready', on); publishSpots(on); }
  /* The windows open on a click (and shut on the next): the mullion and the transom gone, the sky and
     the land whole in the opening, the two casements folded back against the wall either side; the
     weather comes in (sound.js: outdoor sounds louder; the candles gutter). By room, for the visit. */
  const opens = new Map();
  function openWindow(it, { x0, w, y, top }) {
    const W = it.W; const h = y - 1 - top; const r = w / 2; const mx = x0 + Math.floor(r) - 1; const ty = top + Math.round(h * 0.45);
    for (let yy = top; yy < top + h; yy += 1) for (const xx of [mx, mx + 1]) { const src = yy * W + (xx === mx ? mx - 1 : mx + 2); it.idx[yy * W + xx] = it.idx0[src]; it.out[yy * W + xx] = 1; }
    for (let xx = x0; xx < x0 + w; xx += 1) { if (xx === mx || xx === mx + 1) continue; it.idx[ty * W + xx] = it.idx0[(ty - 1) * W + xx]; it.out[ty * W + xx] = 1; }
    it.idx[ty * W + mx] = it.idx[(ty - 1) * W + mx]; it.idx[ty * W + mx + 1] = it.idx[(ty - 1) * W + mx + 1];
    [x0 - 6, x0 + w + 3].forEach((lx) => { // a casement: a timber frame, leaded glass, three wide
      for (let yy = top + Math.round(r * 0.5); yy < top + h; yy += 1) for (let xx = lx; xx < lx + 3; xx += 1) {
        if (xx < 0 || xx >= W) continue; const edge = xx === lx || xx === lx + 2 || yy === top + Math.round(r * 0.5) || yy === top + h - 1;
        it.idx[yy * W + xx] = edge ? I.TIMBER_SH : (yy % 3 === 0 ? I.OUTLINE : I.SLATE); it.out[yy * W + xx] = 0;
      }
    });
  }
  /* The candles blow out on a click (and light again on the next): their flame and their light gone, a
     wisp of smoke; all out, the room is left to the window (by night, blue moonlight). By room, for the visit. */
  const blown = new Map(); // room id -> set of flame indices
  function candleClick(ix, iy) {
    const k = interior.flames.findIndex((f) => !f.hearth && Math.abs(ix - f.x) <= 2 && iy >= f.y - 3 && iy <= f.y + 4);
    if (k < 0) return false;
    const set0 = blown.get(interior.id) || new Set(); const f = interior.flames[k];
    if (set0.has(k)) { set0.delete(k); sfx('crackle'); } else { set0.add(k); f.smoke = now(); sfx('blow'); }
    blown.set(interior.id, set0); return true;
  }

  /* A thing pointed at is lifted (a book drawn up out of its row by two pixels, the rest by one); the
     thing whose card is open has left its place (what was under it shows). From interior.pix. */
  let lifted = -1; let openIx = -1;
  const LIFT = { book: 2, volume: 2, ledger: 0, 'desk-book': 0, register: 0 };
  function reshape() {
    const it = interior; if (!it || !it.pix) return;
    if (!it.idx0) { it.idx0 = it.idx.slice(); it.out0 = it.out.slice(); }
    it.idx.set(it.idx0); it.out.set(it.out0);
    if (opens.get(it.id)) it.sills.forEach((sl) => openWindow(it, sl));
    const W = it.W; const lift = (k) => LIFT[(it.things[k] || {}).kind] ?? 1;
    const off = (k, d) => {
      const px = it.pix[k]; if (!px) return;
      for (let j = 0; j < px.length; j += 3) if (it.idx0[px[j]] === px[j + 2]) it.idx[px[j]] = px[j + 1]; // (out of its place)
      if (d) for (let j = 0; j < px.length; j += 3) if (px[j] - d * W >= 0) it.idx[px[j] - d * W] = px[j + 2]; // (back in, d rows up)
    };
    if (openIx >= 0) off(openIx, 0);
    if (lifted >= 0 && lifted !== openIx && lift(lifted)) off(lifted, lift(lifted));
    lightInterior(); if (!running) render(now());
  }
  /** Tell the page where the room's things are (viewport px), for their hotspots; wide screens only. */
  function publishSpots(on) {
    const wide = plate && (getComputedStyle(plate.parentElement).position === 'fixed' || root.classList.contains('climb'));
    if (!on || !wide || !interior || !interior.slots.length) { spotsTo([], []); return; }
    const r = plate.getBoundingClientRect(); const k = roomBox.k;
    spotsTo(Array.from(interior.slots, (b) => b && ({ l: Math.round(r.left + roomBox.l + b.x * k), t: Math.round(r.top + roomBox.t + b.y * k), w: Math.round(b.w * k), h: Math.round(b.h * k) })), interior.things);
  }
  /** The ladder's hotspot follows it: its box in the room, then in viewport px. */
  function ladderSpot(d) {
    const lx = Math.round(d.a + (d.b - d.a) * ladderF); const k = interior.ladderK;
    if (k >= 0) interior.slots[k] = { x: lx - 1, y: d.top, w: 10, h: d.foot - d.top };
    if (!running) render(now());
    const r = plate.getBoundingClientRect(); return { l: Math.round(r.left + roomBox.l + (lx - 1) * roomBox.k) };
  }
  const travelling = (on) => root.classList.toggle('travelling', on);

  /** Where the camera heads: the room's part of the castle, on screen. */
  function anchorOf(id) {
    if (id === 'cellar') { const c = scene.cellar; return [c.x - scene.M + shift(RATE[L.MID]) + c.w / 2, c.y + c.h / 2]; } // (in through the door in the rock)
    const a = id && scene.rooms[roomOf(id)];
    return a ? [a.x - scene.M + shift(RATE[L.MID]) + a.w / 2, a.y + a.h / 2] : [scene.W / 2, scene.H / 2];
  }

  /** Paint the screen: the landscape, the room, or the way between (zoom, then dissolve). The room
   *  is on its own canvas (robuf, RW x RH); the landscape's canvas shows the embrasure round it. */
  function render(t) {
    const { W, H } = scene;
    const st = view.state;
    const roomShown = st !== 'scene';
    roomCv.hidden = !roomShown;
    if (roomShown && !fbuf) paintFrame();
    if (st === 'scene' && tower) renderTower(t);
    else if (st === 'scene') { draw(t); if (zoom) zoomed(t); else obuf.set(buf); }
    else if (st === 'room') { drawInterior(t); obuf.set(fbuf); frameLife(t); robuf.set(ibuf); }
    else if (st === 'swap') {
      drawInterior(t); obuf.set(fbuf); frameLife(t);
      const th = clamp((t - view.t0) / SWAP);
      for (let y = 0; y < RH; y += 1) for (let x = 0; x < RW; x += 1) { const i = y * RW + x; robuf[i] = bayer(x, y) < th ? ibuf[i] : iprev[i]; }
      if (th >= 1) { view.state = 'room'; travelling(false); }
    } else if (st === 'climb') {
      drawInterior(t); obuf.set(fbuf); frameLife(t);
      // a strip, top to bottom: the upper floor, the slab, the lower; the view slides down it (dir 1) or up
      const e = clamp((t - view.t0) / CLIMB); const s = e < 0.5 ? 2 * e * e : 1 - 2 * (1 - e) ** 2;
      const S = Math.max(6, Math.round(RH * 0.06)); const o = Math.round(s * (RH + S));
      const y0 = view.dir > 0 ? o : RH + S - o;
      const up = (i) => (view.dir > 0 ? iprev[i] : ibuf[i]); const low = (i) => (view.dir > 0 ? ibuf[i] : iprev[i]);
      const stone = slabColours();
      for (let y = 0; y < RH; y += 1) {
        const yy = y0 + y;
        for (let x = 0; x < RW; x += 1) {
          const i = y * RW + x;
          if (yy < RH) robuf[i] = up(yy * RW + x);
          else if (yy >= RH + S) robuf[i] = low((yy - RH - S) * RW + x);
          else { const r = yy - RH; robuf[i] = r === 0 || r === S - 1 ? stone[2] : r % 3 === 2 || (x + ((r / 3) | 0) * 5) % 10 === 0 ? stone[1] : stone[0]; }
        }
      }
      if (e >= 1) { view.state = 'room'; travelling(false); }
    } else {
      const e = t - view.t0; const n = ZOOMS.length;
      const into = st === 'in';
      const th = into ? clamp((e - n * STEP) / DISSOLVE) : 1 - clamp(e / DISSOLVE);
      const zi = into ? Math.min(n - 1, Math.floor(e / STEP)) : n - 1 - Math.min(n - 1, Math.floor(Math.max(0, e - DISSOLVE) / STEP));
      draw(t);
      if (th > 0) drawInterior(t);
      const z = ZOOMS[zi]; const [ax, ay] = anchorOf(view.anchor); const k = zi / (n - 1);
      const vw = W / z; const vh = H / z;
      const vx = Math.round(clamp(W / 2 + (ax - W / 2) * k - vw / 2, 0, W - vw));
      const vy = Math.round(clamp(H / 2 + (ay - H / 2) * k - vh / 2, 0, H - vh));
      for (let y = 0; y < H; y += 1) { // the landscape, zoomed; the embrasure dissolving in over it
        const row = (vy + Math.floor(y / z)) * W + vx;
        for (let x = 0; x < W; x += 1) { const i = y * W + x; obuf[i] = th > 0 && bayer(x, y) < th ? fbuf[i] : buf[row + Math.floor(x / z)]; }
      }
      for (let y = 0; y < RH; y += 1) for (let x = 0; x < RW; x += 1) { const i = y * RW + x; robuf[i] = th > 0 && bayer(x, y) < th ? ibuf[i] : 0; } // (0: transparent)
      if (into && e >= n * STEP + DISSOLVE) { view.state = 'room'; setReady(true); travelling(false); }
      if (!into && e >= DISSOLVE + n * STEP) { view.state = 'scene'; interior = null; travelling(false); roomCv.hidden = true; }
    }
    ctx.putImageData(img, 0, 0);
    if (roomShown) rctx.putImageData(rimg, 0, 0);
  }

  /** Go into room `id` (null: back out to the landscape); `dir` (the tower, ui/03-rooms.js climbFloor):
   *  the floor below (1) or above (-1), reached through the floor slab instead of a dissolve. */
  function goRoom(id, animate, dir = 0) {
    if (!scene) { pendingRoom = id; return; }
    lifted = -1; openIx = -1;
    if (zoom) { zoom = null; root.classList.remove('village'); backBtn.remove(); }
    if (tower) { tower = null; root.classList.remove('lookout'); towerBar.remove(); }
    const t = now(); const anim = animate && !reduce;
    const label = (r) => `Inside the castle: ${ROOM_NAMES[roomOf(r)]}, lit by candles; its window shows the sky over Paris at this hour.`;
    if (id) {
      fireFed = now(); // (someone keeps the fire while you are away)
      if (!view.id || roomOf(id) !== roomOf(view.id)) sfx('steps', { floor: ['talks', 'contact', 'research', 'cellar'].includes(roomOf(id)) ? 'stone' : 'wood', n: 4 }); // in: on its floor
      const follow = () => { roomT0 = t; guide = null; guided = false; };
      if (view.id && ['room', 'swap', 'in', 'climb'].includes(view.state)) {
        if (roomOf(id) === roomOf(view.id)) { view.id = id; return; }
        iprev.set(robuf);
        interior = makeInterior(id); lightInterior(); follow();
        view = { state: !anim ? 'room' : dir ? 'climb' : 'swap', id, anchor: id, t0: t, dir };
        setReady(true); travelling(anim);
      } else {
        interior = makeInterior(id); lightInterior(); follow();
        view = { state: anim ? 'in' : 'room', id, anchor: id, t0: t };
        if (!anim) setReady(true);
        travelling(anim);
      }
      plate.setAttribute('aria-label', label(id));
    } else {
      if (view.state === 'scene') return;
      setReady(false); hl = -1;
      view = { state: anim && interior ? 'out' : 'scene', id: null, anchor: view.anchor, t0: t };
      if (view.state === 'scene') interior = null;
      travelling(view.state === 'out');
      plate.setAttribute('aria-label', SCENE_LABEL);
    }
    if (!running) render(t);
  }

  /* ---- the realm: Paris in pixels for the map dialog (lon, lat -> 240 x 150 px) ---- */
  const REALM = { // where each school stands; Orsay is off the map, south-west
    sorbonne: [2.3561, 48.8466], paris1: [2.3462, 48.8463], pariscite: [2.3405, 48.8510],
    sciencespo: [2.3285, 48.8540], dauphine: [2.2737, 48.8706], ceremade: [2.2760, 48.8700],
    saclay: [2.226, 48.818], ijclab: [2.232, 48.816],
  };
  const SEINE = [[2.47, 48.815], [2.41, 48.83], [2.37, 48.845], [2.35, 48.853], [2.33, 48.86], [2.30, 48.862],
    [2.29, 48.857], [2.27, 48.849], [2.255, 48.838], [2.243, 48.832], [2.236, 48.845], [2.248, 48.868], [2.258, 48.889], [2.23, 48.905]];
  function drawRealm(cv) {
    const g = cv.getContext('2d'); const Wm = cv.width; const Hm = cv.height;
    const P = (lon, lat) => [Math.round(((lon - 2.22) / 0.25) * Wm), Math.round(((48.905 - lat) / 0.09) * Hm)];
    const rgb = (n) => { const c = DAYLIGHT[I[n]]; return c; };
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, Wm, Hm);
    for (let y = 0; y < Hm; y += 1) for (let x = 0; x < Wm; x += 1) if ((x * 7 + y * 13) % 29 === 0) { g.fillStyle = '#e2d2ac'; g.fillRect(x, y, 1, 1); } // its grain
    const blob = (lon, lat, rx, ry, col) => { const [cx0, cy0] = P(lon, lat); g.fillStyle = col; for (let y = -ry; y <= ry; y += 1) for (let x = -rx; x <= rx; x += 1) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1 && (x + y) % 3) g.fillRect(cx0 + x, cy0 + y, 1, 1); };
    blob(2.25, 48.862, 9, 11, rgb('PINE_HI')); blob(2.435, 48.835, 12, 8, rgb('PINE_HI')); // the woods of Boulogne and Vincennes
    for (let a = 0; a < 6.283; a += 0.02) { // the old walls' line (the boulevard ring), dotted
      const [x, y] = P(2.345 + Math.cos(a) * 0.105, 48.858 + Math.sin(a) * 0.038);
      if (Math.floor(a * 60) % 2) { g.fillStyle = rgb('WALL_SH'); g.fillRect(x, y, 1, 1); }
    }
    g.fillStyle = rgb('WATER'); // the Seine, three pixels wide
    for (let k = 1; k < SEINE.length; k += 1) {
      const [x0, y0] = P(...SEINE[k - 1]); const [x1, y1] = P(...SEINE[k]); const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let j = 0; j <= n; j += 1) { const x = Math.round(x0 + ((x1 - x0) * j) / n); const y = Math.round(y0 + ((y1 - y0) * j) / n); g.fillRect(x - 1, y - 1, 3, 3); }
    }
    const [ix, iy] = P(2.347, 48.8545); g.fillStyle = rgb('PATH'); g.fillRect(ix - 3, iy - 1, 7, 2); // the Île de la Cité
    g.fillStyle = rgb('ROOF'); g.fillRect(ix, iy - 3, 1, 2);
    Object.entries(REALM).forEach(([id, [lon, lat]], k) => { // a pennant in the school's field colour
      if (!(window.ARMS || {})[id]) return;
      let [x, y] = P(lon, lat); x = clamp(x, 3, Wm - 8); y = clamp(y + (k % 2) * 2, 8, Hm - 2);
      const field = DAYLIGHT[I[TINCT[window.ARMS[id][1][1]]]];
      g.fillStyle = '#16121c'; g.fillRect(x, y - 8, 1, 9);
      g.fillStyle = field; g.fillRect(x + 1, y - 8, 4, 3); g.fillRect(x + 1, y - 5, 2, 1);
      g.fillStyle = '#16121c'; g.fillRect(x - 1, y + 1, 3, 1);
    });
    g.fillStyle = '#16121c'; // Orsay, off the map: an arrow
    [[4, Hm - 4], [5, Hm - 5], [6, Hm - 6], [4, Hm - 5], [4, Hm - 6], [5, Hm - 4], [6, Hm - 4]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    g.strokeStyle = '#8a6f2e'; g.lineWidth = 2; g.strokeRect(1, 1, Wm - 2, Hm - 2);
  }

  /* ---- the camp answers a click: the cats, the knight, the wizard, the fire, the shield ---- */

  const CAT_SAYS = {
    blackLoaf: 'The big black cat purrs, one eye on the fire.',
    spotted: 'Blanc Blanc, who loved to hide everywhere: calm, affectionate, and easily frightened. He died in the night of 6 to 7 October 2026. He still keeps the knight\'s feet, and his heart, warm.',
  };
  const WIZARD_SAYS = [
    'The wizard taps his staff: "Choose a door, traveller."',
    'The wizard murmurs: "Press ? and the keys will tell you their secrets."',
    'The wizard squints at the sky: "The dragon passes about once a minute. Up, up, down, down..."',
    'The wizard points at the castle: "Each window is a room. Each room, a part of the story."',
  ];

  /** What sits under scene pixel (x, y), if anything one can talk to. */
  function hitAt(x, y) {
    if (!scene || view.state !== 'scene' || zoom || tower) return null;
    const go = groundOff(scene.fire.y) - scene.M; const { fire, knight, wizard } = scene;
    const inBox = (x0, y0, w, h) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
    const LM = landmarkPlaces();
    if (LM.vane && Math.abs(x - LM.vane.x) <= 4 && Math.abs(y - LM.vane.y) <= 3) return { kind: 'vane' };
    if (Math.abs(x - LM.dial.x) <= 3 && y >= LM.dial.y - 6 && y <= LM.dial.y + 1) return { kind: 'sundial' };
    if (x >= LM.garden.x && x < LM.garden.x + LM.garden.w && y >= LM.garden.y - 7 && y <= LM.garden.y + 1) return { kind: 'garden' };
    { const b = scene.bell; const bx = b.x - scene.M + shift(RATE[L.MID]); if (Math.abs(x - bx) <= 2 && y >= b.y && y <= b.y + 4) return { kind: 'bell' }; }
    if (look.stars > 0.15 && scene.realStars) { const st = scene.realStars.find((q) => Math.hypot(q.x - x, q.y - y) < 3); if (st) return { kind: 'star', name: st.name }; }
    const cat = scene.cats.find((c) => inBox(c.x + go, c.y, c.sp.w, c.sp.h));
    if (cat) return { kind: 'cat', name: Object.keys(SPRITES.cats).find((k) => SPRITES.cats[k] === cat.sp) };
    const sh = scene.shieldSp;
    if (sh && inBox(knight.x + go + 1, fire.y + 7 - sh.h, sh.w, sh.h)) return { kind: 'shield' };
    if (inBox(fire.x + go - 7, fire.y - 18, 14, 22)) return { kind: 'fire' };
    const c = scene.cellar; const cmx = c.x - scene.M + shift(RATE[L.MID]);
    if (inBox(cmx - 1, c.y - 1, c.w + 2, c.h + 1)) return { kind: 'cellar' };
    const dm = scene.dream; if (dm && dm.box && inBox(...dm.box)) return { kind: 'dream' };
    if (inBox(knight.x + go, knight.y, SPRITES.knight.w, SPRITES.knight.h)) return { kind: 'knight' };
    const wk = scene.walker; // the passer-by: the peddler bargains, the rider has a letter
    if (wk && (wk.kind === 'peddler' || wk.kind === 'rider')) {
      const yy = Math.min(scene.H - 1, Math.round(wk.y)); const xx = Math.round(scene.pathX[yy]) - scene.M;
      if (wk.y >= scene.yg ? inBox(xx + groundOff(yy) - 10, yy - 14, 22, 15) : inBox(xx + shift(RATE[L.MID]) - 3, yy - 4, 7, 6)) return { kind: wk.kind };
    }
    const lmx = shift(RATE[L.MID]) - scene.M;
    const lmx2 = shift(RATE[L.MID]) - scene.M;
    if (scene.starlings && scene.starlings.some((b) => Math.abs(b.x - x) < 3 && Math.abs(b.y - y) < 3)) return { kind: 'murmuration' };
    if (scene.flies2 && scene.flies2.some((f) => Math.abs(f.x - x) < 3 && Math.abs(f.y - y) < 3)) return { kind: 'fireflies' };
    const bn = scene.burn; if (bn && x >= bn.x0 + lmx2 && x < bn.x0 + lmx2 + 2 * bn.w && Math.abs(y - (scene.hill[bn.x0] + 8)) < 9) return { kind: 'burn' };
    if (((weather.rain7 ?? 0) > 10 || WET[weather.kind]) && scene.seeps.some((sp) => Math.abs(x - (sp.x + lmx2)) < 3 && y > sp.y - 4 && y < sp.y + 6)) return { kind: 'seep' };
    const jt = scene.joust; const dd = today();
    if (jt && dd.getDay() === 0 && dd.getDate() <= 7 && inBox(jt.x0 + lmx2 - 6, jt.y - 6, jt.len + 12, 10)) return { kind: 'joust' };
    const fk = scene.flock; if (fk && look.night < 0.5 && fk.sheep.some((q) => Math.abs(x - (q.x + lmx2)) < 3 && Math.abs(y - (fk.top(q.x) + q.dy)) < 3)) return { kind: 'flock' };
    const fr = scene.ferry; if (fr && Math.abs(x - (fr.J + fr.px + lmx2)) < 6 && y > fr.top - 7 && y < fr.bot + 2) return { kind: 'ferry' };
    if (Math.hypot(x - (scene.wmill.x + lmx2), y - scene.wmill.y) < 6) return { kind: 'wmill' };
    const qy = scene.quarry; if (inBox(qy.x + lmx2, qy.y - 7, qy.w + 9, 8)) return { kind: 'quarry' };
    const fl = scene.falls; if (inBox(fl.x - scene.M + shift(RATE[L.NEAR]) - 3, fl.y0, 7, fl.len)) return { kind: 'falls' };
    if (scene.orchard.skeps.some((h) => inBox(h.x + go - 3, h.y - 3, 7, 6))) return { kind: 'bees' };
    if (scene.orchard.trees.some((tr) => Math.hypot(x - (tr.x + go), y - tr.cy0) < tr.r + 2)) return { kind: 'orchard' };
    const wt = scene.watch; const wtx = wt.x - scene.M + shift(RATE[L.NEAR]);
    if (inBox(wtx - 3, wt.y - 1, 7, 15)) return { kind: 'watch' };
    const hm = scene.hamlet; const vy = scene.riverTop(hm.x1);
    if (inBox(hm.x0 + lmx - 2, vy - 16, hm.x1 + 28 - hm.x0, 16)) return { kind: 'village' };
    if (scene.lichen.patches.some((p) => Math.hypot(x - (p.x + lmx), y - p.y) <= p.r + 2)) return { kind: 'lichen' };
    if (scene.bbStar && Math.hypot(x - scene.bbStar[0], y - scene.bbStar[1]) < 4) return { kind: 'bbstar' };
    if (scene.meteors.some((m) => Math.hypot(x - m.x, y - m.y) < 6)) return { kind: 'meteor' };
    const pl = bodies && bodies.planets.find((p) => p.at[2] > 0 && bodies.sun[2] < -2 * deg && Math.hypot(x - p.at[0], y - p.at[1]) < 4);
    if (pl) return { kind: 'planet', name: pl.name, dist: pl.dist };
    const an = scene.angler; if (look.night < 0.5 && inBox(an.x - scene.M + groundOff(an.y + 6), an.y, SPRITES.angler.w + 6, SPRITES.angler.h)) return { kind: 'angler' };
    const hs = scene.horse; if (inBox(hs.x + go, hs.y, SPRITES.horse[0].w, SPRITES.horse[0].h)) return { kind: 'horse' };
    const sw = scene.scribeWin; if (sw && scribeLate() && inBox(sw.pts[0][0] + lmx2 - 1, sw.pts[0][1] - 2, 5, 6)) return { kind: 'scribe' };
    const ac = scene.ants; if (antsOut() && inBox(ac.x0 - 3 + groundOff(ac.y0) - scene.M, ac.y0 - 12, 38, 15)) return { kind: 'ants' };
    if (scene.shoal && scene.shoal.some((f) => Math.abs(x - (f.x + lmx2)) < 3 && Math.abs(y - f.y) < 3)) return { kind: 'shoal' };
    const hu = scene.hunt; if (hu && real.bruegel && hu.party.some((m) => { const sp = real.bruegel.sprites[m.k]; const yy = Math.round(hu.y + m.dy); const sx = Math.round(hu.x + m.dx) - scene.M + groundOff(yy); return inBox(sx, yy - sp.h - 1, sp.w, sp.h + 1); })) return { kind: 'hunters' };
    if (real.bruegel && (weather.frost ?? 9) <= -3 && y >= scene.yl0 && y <= scene.yg && x >= scene.hamlet.x0 + lmx2 && x <= scene.hamlet.x1 + 30 + lmx2 && look.night < 0.4) return { kind: 'skaters' };
    const sa = scene.sapling; if (inBox(sa.x - scene.M + groundOff(sa.y) - 3, sa.y - sa.h - 1, 8, sa.h + 3)) return { kind: 'sapling' };
    const gg = scene.gauge; if (inBox(gg.x + lmx2 - 2, gg.top - 1, 5, gg.bot - gg.top + 2)) return { kind: 'gauge' };
    const hr = scene.heron; if (inBox(hr.x - scene.M + shift(RATE[L.MID]), hr.y, SPRITES.heron.w, SPRITES.heron.h)) return { kind: 'heron' };
    const ow = scene.owl; const fo = shift(RATE[L.FG]) - scene.M;
    if (look.night > 0.5 && inBox(ow.x + fo - 1, ow.y - 1, SPRITES.owl.w + 2, SPRITES.owl.h + 2)) return { kind: 'owl' };
    const [mhx, mhy] = scene.mill.hub; const mmx = mhx - scene.M + shift(RATE[L.MID]); const ml = scene.mill.len;
    if (inBox(mmx - ml, mhy - ml, 2 * ml + 1, 2 * ml + 14)) return { kind: 'mill' };
    if (inBox(wizard.x + go, wizard.y, SPRITES.wizard.w, SPRITES.wizard.h)) return { kind: 'wizard' };
    const wi = idxNow[y * scene.W + x]; // the castle's stone itself (its colour after Monet)
    const lmid = shift(RATE[L.MID]) - scene.M; // a part of the castle that is a room (its tower, its hall): in through it
    const part = Object.entries(scene.rooms).find(([, a]) => inBox(a.x + lmid, a.y, a.w, a.h));
    if (part) return { kind: 'room', id: Object.keys(KIND).find((k) => KIND[k] === part[0]) || part[0] };
    if (y < scene.gate.crest && y > scene.castleTop && [I.WALL_HI, I.WALL, I.WALL_SH, I.WALL_DK].includes(wi) && Math.abs(x - (scene.M + Math.round(0.64 * scene.Ws) - scene.M + shift(RATE[L.MID]))) < 40) return { kind: 'facade' };
    return null;
  }
  /** The curiosities in sight now, for the keyboard ([ and ] go through them, Enter looks): the
   *  scene scanned on a 3 px grid through hitAt, one point per kind (its first hit, centred). */
  let sel = -1; let selList = [];
  const CURIO_NAMES = { vane: 'the weathervane', sundial: 'the sundial', garden: 'the garden of simples', bell: 'the bell', star: 'a constellation', cat: 'a cat', knight: 'the knight', wizard: 'the wizard', fire: 'the fire', shield: "the knight's shield", horse: 'the horse',
    cellar: 'the cellar door', heron: 'the heron', mill: 'the windmill', angler: 'the angler', owl: 'the owl', meteor: 'a shooting star', lichen: 'the lichen',
    village: 'the village', watch: 'the watchtower', planet: 'a planet', wmill: 'the water mill', quarry: 'the quarry', falls: 'the waterfall', bees: 'the hives',
    orchard: 'the orchard', ferry: 'the ferryman', flock: 'the flock', joust: 'the tournament', murmuration: 'the starlings', fireflies: 'the fireflies', burn: "Saint John's fire", seep: 'a spring', sapling: 'your oak', gauge: 'the river gauge', dream: "the knight's dream", peddler: 'the peddler', rider: 'the rider', scribe: 'the copyist', ants: 'the ants', shoal: 'the shoal', skip: 'a skimmed stone', facade: "the castle's stone", hunters: "Bruegel's hunters", skaters: 'the skaters' };
  function curioList() {
    const seen = new Map();
    for (let y = 0; y < scene.H; y += 3) for (let x = 0; x < scene.W; x += 3) {
      const h = hitAt(x, y); if (!h) continue;
      const key = h.kind + (h.name || '');
      if (!seen.has(key)) seen.set(key, { h, xs: [], ys: [] });
      const e = seen.get(key); e.xs.push(x); e.ys.push(y);
    }
    return [...seen.values()].map((e) => ({ h: e.h, x: e.xs.reduce((a, v) => a + v, 0) / e.xs.length, y: e.ys.reduce((a, v) => a + v, 0) / e.ys.length })).sort((a, b) => a.x - b.x);
  }
  const sfx = (name, o) => { if (window.Sound) window.Sound.cue(name, o); }; // (silent unless the sound is on)
  function talk(hit) {
    found(hit.kind); // the curiosity hunt (assets/js/ui)
    sense('touch'); if (['fire', 'bees', 'orchard'].includes(hit.kind)) sense('smell', 2); if (['village', 'market'].includes(hit.kind)) sense('taste', 2); if (hit.kind === 'watch') sense('sight', 2);
    sfx({ horse: 'neigh', cat: 'meow', owl: 'owl' }[hit.kind]);
    if (hit.kind === 'vane') { const d = weather.dir ?? 270; say(`The weathervane on the keep: the wind from the ${COMPASS[Math.round(d / 22.5) % 16]} (${Math.round(d)}°), ${Math.round(weather.wind ?? 0)} km/h over Paris.`); roseTo(d, weather.wind ?? 0); return; }
    if (hit.kind === 'sundial') { say(sundialLine()); return; }
    if (hit.kind === 'garden') { const n = Math.min(HERBS.length, visitsOf().n || 1); say(`Your garden of simples, a plant for each visit: ${HERBS.slice(0, n).map((h) => h[0]).join(', ')}.${n < HERBS.length ? ` Come back: ${HERBS[n][0]} is next.` : ' It is full.'}`); return; }
    if (hit.kind === 'bell') { scene.ringUntil = now() + 5; sfx('bell'); carillonUntil = now() + 15; say('The bell rings. For a few seconds the keys 1 to 8 play the carillon (with the sound on).'); return; }
    if (hit.kind === 'star') { constel = { name: hit.name, t0: now() }; say(`The stars of ${hit.name}, where they truly stand over Paris now.`); return; }
    if (hit.kind === 'cat') say(CAT_SAYS[hit.name] || 'A cat looks at you.');
    else if (hit.kind === 'knight' && look.night > 0.7) say('The knight is asleep by the fire. Best not to wake him.');
    else if (hit.kind === 'knight' && quoted && now() - quoted.t < 30) { const q = quoted.q; quoted = null; say(`"That is ${q.author}, ${q.work}." He has read more than he lets on.`); }
    else if (hit.kind === 'knight') {
      const q = Math.random() < 0.6 ? quoteNow() : null;
      if (q) { quoted = { q, t: now() }; say(`The knight looks into the fire: "${q.text}" (click him again: whose words?)`); } else { const r = rumour(); say(`The knight looks up from the fire: "${r[0].toUpperCase()}${r.slice(1)}"`); }
    }
    else if (hit.kind === 'wizard' && wizardReads(now()) && newsOf()) { say(`The wizard looks up from his book: "The latest from the rookery, traveller: ${newsOf().text}"`); castUntil = now() + 0.8; }
    else if (hit.kind === 'wizard') { say(WIZARD_SAYS[Math.floor(Math.random() * WIZARD_SAYS.length)]); castUntil = now() + 0.8; sparkle(16); }
    else if (hit.kind === 'fire') {
      say('The fire crackles and throws up sparks.'); scene.puff = now() + 1.5; // (a puff of smoke too)
      for (let k = 0; k < 24; k += 1) scene.embers.push({ x: scene.fire.x + (Math.random() - 0.5) * 8, y: scene.fire.y - 10, vy: -(0.8 + Math.random() * 1.4), ph: Math.random() * 6, age: 0, life: 20 + Math.random() * 30 });
    } else if (hit.kind === 'shield') say("On the knight's shield: azure, an armillary sphere or, over a bell curve argent.");
    else if (hit.kind === 'cellar') { say('A low door in the rock. Stone steps go down into the cellar.'); cellarTo(); }
    else if (hit.kind === 'horse') say("The knight's horse crops the grass and flicks its tail at you.");
    else if (hit.kind === 'heron') say('The heron stands on one leg and pretends you are not there.');
    else if (hit.kind === 'bbstar') say('Blanc Blanc\'s star, over the fire where he slept. It comes back every night.');
    else if (hit.kind === 'planet') {
      const NOTE = { Mercury: 'quick and low, never far from the Sun', Venus: 'the shepherd\'s star, brightest of all', Mars: 'red, the colour of rust', Jupiter: 'steady and bright, four moons too small to see from here', Saturn: 'pale gold; its rings want a telescope' };
      say(`${hit.name}, ${NOTE[hit.name]}: ${hit.dist.toFixed(2)} au from us tonight (${Math.round(hit.dist * 8.317)} light-minutes).`);
    } else if (hit.kind === 'meteor') say('You catch the shooting star and make a wish. It is yours to keep.');
    else if (hit.kind === 'angler') say(['The angler raises a finger to his lips. The fish are listening.', 'The angler shows you an empty basket and a patient smile.', '"They bite at dawn," says the angler, "and never when you watch."'][Math.floor(Math.random() * 3)]);
    else if (hit.kind === 'watch') towerTo(true);
    else if (hit.kind === 'murmuration') say('Starlings at dusk, a murmuration: no leader, no plan. Each bird matches the heading of its seven nearest neighbours, whatever their distance; the flock folds and pours like one body (a topological Vicsek model, after Ballerini et al., 2008).');
    else if (hit.kind === 'fireflies') say(`Fireflies, each with its own rhythm, each nudged by the flashes it sees: coupled oscillators (Kuramoto). Their order, r = ${(scene.fliesR || 0).toFixed(2)} (0: anyhow, 1: all at once).`);
    else if (hit.kind === 'burn') { const b = scene.burn; say(`Saint John's fire has caught the dry grass on the hill. Each tuft burns, then lights its neighbours: it crosses the hillside only if the dry grass is dense enough, past the percolation threshold (0.59 on a square grid). Tonight: ${(b.p * 100).toFixed(0)}% dry, ${b.spanned ? 'and the fire has crossed.' : 'and the fire has not crossed (yet).'}`); }
    else if (hit.kind === 'seep') say('After rain, springs seep at the foot of the castle rock. The water finds its way down through the cracks only where they join up from top to bottom: percolation (here 62% of the rock is fissured, just past the 59% a path needs).');
    else if (hit.kind === 'joust') say('The first Sunday of the month: a tournament on the hill. Two knights ride at each other along the tilt; a broken lance scores, an unhorsing wins.');
    else if (hit.kind === 'flock') say(scene.flock.summer ? 'The shepherd has taken the flock up the hill for the summer grass; his dog keeps the stragglers in.' : 'The flock grazes low on the hill this season, near the village and the barn. Nine sheep: the shepherd counts them every evening.');
    else if (hit.kind === 'ferry') {
      const f = scene.ferry; const e = f.errs; const BARS = '▁▂▃▄▅▆▇█';
      const mean = (a) => (a.length ? (a.reduce((p, v) => p + v, 0) / a.length).toFixed(1) : '-');
      const w = Math.round(weather.wind); const c = ferryCurrent(); const side = c > 0.1 ? `west, ${c.toFixed(1)} px a row` : c < -0.1 ? `east, ${(-c).toFixed(1)} px a row` : 'nowhere much'; // (we face south: +x is west)
      const { n } = visitsOf();
      const hello = n <= 1 ? 'The ferryman nods: "New in these parts?" ' : n < 6 ? `The ferryman nods: "Back again? That makes ${n} visits." ` : `The ferryman grins: "You again! ${n} visits; you could row it yourself by now." `;
      say(`${hello}He learns his crossing by trial and error (Q-learning): today's wind, ${w} km/h over Paris, sets the current, which pushes him ${side}. `
        + `${f.n} crossings so far. How far off the jetty he landed, the last ones: ${e.slice(-24).map((v) => BARS[Math.min(7, v)]).join('') || '(none yet)'} `
        + `(mean ${mean(e.slice(-10))} px; at first ${mean(e.slice(0, 10))}).`);
    } else if (hit.kind === 'wmill') {
      const r7 = weather.rain7; const frozen = (weather.frost ?? 9) <= -4;
      say(frozen ? 'The mill wheel is held fast in the ice; the miller waits for the thaw.'
        : `The water mill grinds the market's flour. ${r7 == null ? 'The stream runs as it always does.' : r7 > 35 ? `${Math.round(r7)} mm of rain this week: the wheel races.` : `${Math.round(r7)} mm of rain this week over Paris: the wheel turns at its ease.`}`);
    } else if (hit.kind === 'quarry') say(look.night < 0.4 ? 'The quarryman squares a block for the castle wall. Tap, tap: every stone up there came from here.' : 'The quarry is quiet; the blocks wait, squared, for morning.');
    else if (hit.kind === 'falls') say((weather.frost ?? 9) <= -4 ? 'The waterfall has frozen into a column of blue ice.' : 'A waterfall comes down the gully from the snows. Its roar reaches the meadow on quiet evenings.');
    else if (hit.kind === 'bees') say((weather.temp ?? 15) >= 10 && scene.season !== 'winter' ? 'The bees come and go. A forager back from a good patch dances on the comb: the angle of her run is the flowers\' bearing from the sun, its length their distance.' : 'The hives are quiet: too cold for the bees, who keep each other warm inside, around their queen.');
    else if (hit.kind === 'orchard') say({ spring: 'The apple trees are in blossom.', summer: 'Small green apples swell on the branches.', autumn: 'Apples, red and ready: some have already dropped into the grass.', winter: 'Bare apple trees, pruned for the spring.' }[scene.season]);
    else if (hit.kind === 'village') {
      zoomTo(true);
      const open = marketDay(today()) && look.night < 0.3;
      const S0 = scene.sir; const cold = S0 ? ` A cold is going round (day ${S0.day}): ${S0.nodes.filter((n) => n.s === 0).length} houses well, ${S0.nodes.filter((n) => n.s === 1).length} sick (the steam of herb tea at the door), ${S0.nodes.filter((n) => n.s === 2).length} over it; R0 about ${(((S0.beta || 0.3) * 2.5) / (S0.gamma || 0.25)).toFixed(1)}, higher in the cold.` : '';
      const g = scene.glass; const lights = look.night > 0.5 && g.s.length ? ` Tonight its lights are a spin glass: each pair of houses wants to be lit together, or one lit and the other dark, at random (Sherrington-Kirkpatrick); no setting pleases every pair. They are annealed as the night cools them: ${g.s.filter((v) => v > 0).length} of ${g.s.length} lit, T = ${g.T.toFixed(2)}, energy ${g.E.toFixed(2)} a house, lower as it settles.` : '';
      say((open ? 'Market day in the village. Click the crowd to see the game behind it; the arrow keys walk along the bank, Esc steps back.'
        : `The village is quiet${look.night < 0.3 ? '' : ' at night'}. Market days: Wednesday, Friday, Saturday and Sunday, by day. The arrow keys walk along the bank, Esc steps back.`) + cold + lights);
    } else if (hit.kind === 'market') {
      const mk = scene.market; scene.marketShow = now() + 8;
      say(`Market day: ${mk.wares[0]} and ${mk.wares[1]} today. Each villager weighs the pull of the stalls (it changes with the hour) against the crush around them, and the crowd settles where no one gains by moving: a mean-field Nash equilibrium, found by fictitious play over ${mk.rounds} rounds (gap ${mk.gap.toExponential(0)}). Each villager's policy is a Markov chain on the bank; the crowd is its stationary law, a different one each market day. The bars show its density.`);
    }
    else if (hit.kind === 'lichen') {
      const lc = scene.lichen; const n = lc.patches.reduce((a, p) => a + p.cells.length, 0); const D = lichenDim(lc);
      say(`Lichen on the castle rock, growing while you watch: spores wander at random and take hold where they touch it (diffusion-limited aggregation). ${n} cells so far${D ? `; fractal dimension about ${D.toFixed(2)} (1.71 for a large cluster)` : ''}.`);
    }
    else if (hit.kind === 'owl') say('The owl turns its head right round and hoots: "Who-oo?"');
    else if (hit.kind === 'hunters') say('Hunters coming home through the snow, their hounds trailing behind them (out of Bruegel\'s "Hunters in the Snow", 1565).');
    else if (hit.kind === 'skaters') say('Skaters on the frozen river (out of Bruegel\'s "Hunters in the Snow", 1565).');
    else if (hit.kind === 'room') { say(`In through ${ROOM_NAMES[hit.id]}.`); goTo(hit.id); }
    else if (hit.kind === 'facade') {
      const w = monetTint();
      say(w ? `The castle's stone at this hour, in this weather: the colour Claude Monet gave Rouen cathedral's in "${w.title}" (${w.year}), one of the thirty canvases he painted of the same portal from dawn to dusk.` : 'The castle\'s walls, grey in the dark.');
    } else if (hit.kind === 'dream') say(`The knight smiles in his sleep. He dreams of ${scene.dream.name}.`);
    else if (hit.kind === 'peddler') say(tradeWith());
    else if (hit.kind === 'rider') say(`The rider does not stop: "A letter for the rookery!" ${scene.walker && scene.walker.news ? `(${scene.walker.news})` : ''}`);
    else if (hit.kind === 'scribe') say('High in the keep, the scriptorium\'s window is still lit: a copyist bent over his page, his candle burning low. He will stop at one.');
    else if (hit.kind === 'ants') {
      const a = scene.ants; const sh = a.picks.length ? a.picks.filter((w) => w === 0).length / a.picks.length : 0.5;
      say(`Ants between their nest and a fallen apple, two ways round a pebble. None knows which is shorter, but the short way's ants come back sooner and mark it first: the colony settles on it (Goss et al., 1989; the idea behind ant colony optimisation). The last ${a.picks.length} choices: ${Math.round(sh * 100)}% the short way.`);
    } else if (hit.kind === 'shoal') say(`A shoal of small fish, ${scene.shoal.length} of them, turning as one: each keeps near its neighbours, heads where they head and keeps out of their way, and nobody leads (boids, Reynolds 1987).`);
    else if (hit.kind === 'sapling') {
      const { n, first } = visitsOf(); const since = first ? new Date(first).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'today';
      say(n <= 1 ? 'An acorn has just come up here, by the orchard: yours, planted on this first visit. It will put on a ring each time you come back.'
        : `Your oak, planted on your first visit (${since}): ${n} rings now, one for each visit. ${scene.sapling.h >= 8 ? 'The red ribbon on its stake is yours.' : 'Still a seedling; come back and it will grow.'}`);
    } else if (hit.kind === 'gauge') {
      const r7 = weather.rain7;
      say(r7 == null ? 'The river gauge by the bridge: red and white bars, a hand apart. No reading today.'
        : `The river gauge by the bridge. ${Math.round(r7)} mm of rain over Paris this past week: ${r7 > 35 ? 'the river is in spate, over its banks in the low places.' : r7 < 6 ? 'the river is low, its gravel bars showing.' : 'the river runs at its usual level.'}`);
    }
    else if (hit.kind === 'mill') {
      const w = Math.round(weather.wind);
      say(w < 2 ? 'The mill stands still: not a breath of wind over Paris.' : `The mill's sails turn in the wind: ${w} km/h over Paris.`);
    }
  }
  /** A click on the open river (nothing else there): a stone skimmed from the near bank. Its touches
   *  come closer and quicker as it slows (each bounce loses a share of its speed). */
  function skim(x, y) {
    if (!scene || view.state !== 'scene' || zoom || tower) return;
    const i = y * scene.W + x; if (y < scene.yl0 || y > scene.yg || (idxNow[i] !== I.WATER && idxNow[i] !== I.WATER_HI)) return;
    const X = x - (shift(RATE[L.MID]) - scene.M); const yb = scene.riverBot(X) - 1; const yt = scene.riverTop(X) + 1;
    const n = 2 + Math.floor(Math.random() ** 0.8 * 6); const g0 = ((yb - yt) * 0.9 * 0.25) / (1 - 0.75 ** n);
    const t0 = now(); let yy = yb + 3; let xx = X; let tt = t0; const hits = [];
    for (let k = 0; k < n; k += 1) { yy -= g0 * 0.75 ** k; xx += (Math.random() - 0.5) * 3; tt += 0.25 * 0.85 ** k; hits.push({ x: Math.round(xx), y: Math.round(yy), t: tt }); }
    scene.skip = { from: { x: X, y: yb + 4, t: t0 }, hits };
    found('skip'); sfx('skip', { n });
    say(`You skim a flat stone across the river: ${n} ${n > 1 ? 'bounces' : 'bounce'}, each shorter than the last.${n >= 6 ? ' A fine throw.' : ''} A stone skips best spun, flat, meeting the water at about 20 degrees (Clanet, Hersen and Bocquet, 2004); every touch sends out rings.`);
    if (!running) render(now());
  }
  /* ---- events on call (the `event` command): each sets the scene up for it and says what it did ---- */
  const outdoors = () => view.state === 'scene' && !zoom && !tower;
  const EVENTS = {
    bolt() { // a bolt grown at once, then the flash and its thunder
      const b = boltNew(30, Math.round((scene.yl0 - scene.yHor * 0.2) / 2), Math.round(Math.min(scene.W, scene.Ws) * (0.1 + Math.random() * 0.35)), Math.round(scene.yHor * 0.2));
      for (let k = 0; k < 60 && !b.done; k += 1) boltGrow(b, 40);
      if (!b.main) return 'The bolt could not find the ground; try again.';
      scene.bolt = { b, until: tick + 8 }; scene.flash = 3; const km = 0.4 + Math.random() * 3; sfx('thunder', { delay: thunderDelay(km), km });
      return `Lightning, about ${km.toFixed(1)} km off.`;
    },
    dragon() { scene.dragon = null; scene.nextDragon = 0; return 'The dragon is coming.'; },
    rider() { const n = newsOf(); scene.walker = { y: scene.H + 2, dir: -1, kind: 'rider', news: n ? n.text : 'a letter for the rookery' }; return 'A rider comes up the road with a letter.'; },
    peddler() { scene.walker = { y: scene.H + 2, dir: -1, kind: 'peddler' }; return 'A peddler pushes his barrow up the road (click him to trade).'; },
    messenger() { scene.walker = { y: scene.H + 2, dir: -1, kind: 'messenger' }; return 'A messenger on foot, his pennant up.'; },
    lantern() { scene.walker = { y: scene.top + 1, dir: 1, kind: 'lantern' }; return 'Someone with a lantern comes down from the castle.'; },
    dream(t) {
      const ds = dreamsOf().map((d) => [d, Object.keys(DREAMS).find((k) => DREAMS[k][0].test(d.words))]).filter(([, k]) => k);
      if (!ds.length) return 'The knight has nothing to dream of.';
      const [d, icon] = ds[Math.floor(Math.random() * ds.length)]; scene.dream = { t0: t, name: d.name, icon, forced: true }; return `The knight nods off and dreams of ${d.name}.`;
    },
    hoot(t) { const hr = clockFn().getHours() % 12 || 12; forced.owl = t + hr * 1.6 + 3; for (let k = 0; k < hr; k += 1) scene.hoots.push({ t0: t + 1 + k * 1.6 }); return `The owl hoots the hour: ${hr} times.`; },
    meteors() { for (let k = 0; k < 6; k += 1) { const dir = Math.random() < 0.5 ? -1 : 1; const v = 2 + Math.random() * 2; scene.meteors.push({ x: Math.random() * scene.W, y: Math.random() * scene.yHor * 0.5, dx: dir * v, dy: v * 0.6, age: 0, life: 8 + k * 2 }); } return 'A handful of shooting stars (best on a dark sky).'; },
    fireworks(t) { forced.fireworks = t + 15; return 'Fireworks over the castle, a quarter of a minute.'; },
    skip() { const s0 = scene; const x = Math.round(Math.min(s0.W, s0.Ws) * (0.5 + Math.random() * 0.15)); const X = x + s0.M - shift(RATE[L.MID]); skim(x, Math.round((s0.riverTop(X) + s0.riverBot(X)) / 2)); return null; },
    shelter(t) { shelterUntil = t + 30; return 'The knight puts up his shelter; the black cat moves under it.'; },
    read(t) { forced.read = t + 14; return 'The wizard opens his book (click him).'; },
    shoal(t) { forced.shoal = t + 60; return 'A shoal of fish in the river, west of the bridge.'; },
    ants(t) { forced.ants = t + 60; return 'The ants come out, by the pebble near the bottom of the meadow.'; },
    starlings(t) { forced.starlings = t + 60; return 'A murmuration of starlings over the castle.'; },
    fireflies(t) { forced.fireflies = t + 60; return 'Fireflies, falling into step (best at night).'; },
    fogsea(t) { forced.fogsea = t + 60; return 'A sea of fog fills the valley.'; },
    geese() { scene.geese = Array.from({ length: 9 }, (_, k) => ({ x: Math.min(scene.W, scene.Ws) + 10 + Math.ceil(k / 2) * 5, y: Math.round(scene.yHor * 0.3) + Math.ceil(k / 2) * (k % 2 ? 3 : -3) })); return 'Geese, going south-west.'; },
    birds() { scene.birds = Array.from({ length: 5 }, (_, k) => ({ x: Math.min(scene.W, scene.Ws) + 10 + k * 5, y: scene.yHor * 0.3 + Math.abs(k - 2) * 3 })); return 'Birds across the sky.'; },
    fish() { const x = scene.M + Math.round(Math.random() * scene.Ws); const y = Math.round((scene.riverTop(x) + scene.riverBot(x)) / 2); scene.fish = { x, y0: y, y, age: 0, dir: 1 }; return 'A fish jumps.'; },
    bell(t) { scene.ringUntil = t + 5; sfx('bell'); return 'The castle bell rings.'; },
    banner() { if (!scene.hoist) scene.hoist = { t0: now() }; return 'Your banner goes up the keep.'; },
    cinema(t) { forced.cinema = t + 90; cinemaT0 = 0; realGet('melies'); if (interior && view.id && roomOf(view.id) === 'talks') { interior = makeInterior(view.id); lightInterior(); publishSpots(view.state === 'room'); } return 'A magic lantern show in the great hall: Méliès, Le Voyage dans la Lune (go to talks).'; },
    chant(t) { // the office of the hour, or vespers
      forced.chant = { until: t + 240, office: officeNow(true) || 'vespers' };
      return `The chapel's ${forced.chant.office}, sung (turn the sound on to hear it; louder close to the village).`;
    },
    hunters(t) { if (!real.bruegel) return 'The hunters are not back yet (the painting is still loading).'; forced.hunt = t + 1; return 'Bruegel\'s hunters come home through the meadow, their hounds about them (best in snow: event snowfall).'; },
    embers(t) { fireFed = t - 200; return 'The workshop fire burns down to embers (in the workshop: click the hearth).'; },
  };
  const OUTDOOR = new Set(Object.keys(EVENTS).filter((k) => !['embers', 'banner', 'cinema'].includes(k)));

  const globe = { lon: 2.35 * deg, vel: 0, drag: null }; // the library's globe: Paris facing us until turned
  let flight = null; // (a raven leaving by the rookery's window)
  let roomPointer = null; const P0 = (n) => ipal32[I[n]]; // (the pointer in room px, for the candle it carries in the dark)

  /* The wizard as a guide: twenty seconds without a move in a room, he stands in a doorway, points his
     staff and a trail of sparks goes from its orb to a thing not yet looked at, which glints; once a visit of the room. */
  const session0 = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { /* (no storage: every load) */ } return null; };
  let inkOf = () => 0; let pinsOf = () => [];
  /* The workshop's bar of iron: on the anvil, into the fire (a click on the anvil), out again (a click on the
     hearth), hammered while hot. Its temperature runs to the fire's (up to 1450 K, 10 s) in it, back to the room's
     (Newton, 60 s) out of it; its glow the colour of a black body at that temperature (none below the
     Draper point, 798 K: dark iron). */
  const bar = { where: 'anvil', T: 293, at: 0 };
  function barTemp(t) { const dt = Math.min(600, t - (bar.at || t)); bar.at = t; const goal = bar.where === 'fire' ? 1450 * (0.6 + 0.4 * heatOf()) : 293; bar.T = goal + (bar.T - goal) * Math.exp(-dt / (bar.where === 'fire' ? 10 : 60)); return bar.T; }
  const glowOf = (T) => (T < 798 ? null : T < 950 ? [120 + (T - 798) * 0.6, 22, 12] : T < 1150 ? [220, 40 + (T - 950) * 0.5, 14] : T < 1350 ? [250, 140 + (T - 1150) * 0.45, 40] : [255, 235, 170]);
  const glowName = (T) => (T < 798 ? 'dark' : T < 950 ? 'a dull red' : T < 1100 ? 'cherry red' : T < 1250 ? 'orange' : T < 1400 ? 'yellow' : 'near white');
  const barLine = (T) => `The bar is ${glowName(T)}, about ${Math.round(T)} K (${Math.round(T - 273)} °C)`;
  /* The library's lectern turns from book to book (a drag on it, or its arrow keys): which one is open. */
  let lecternIx = 0;
  /* The cellar's casks: how full (kept on this device); knocked on, an emptier one rings lower and longer
     (the air inside a Helmholtz resonator: f goes as one over the square root of its volume). */
  const casks = (() => { try { return JSON.parse(localStorage.getItem('casks')) || [0.9, 0.55]; } catch { return [0.9, 0.55]; } })();
  let pour = null;
  function caskTap(k) {
    const lv = casks[k]; const f = Math.round(150 / Math.sqrt(Math.max(0.05, 1 - lv)));
    sfx('knock', { f, ring: 1 - lv });
    say(`${lv > 0.85 ? 'Full' : lv > 0.6 ? 'Two-thirds full' : lv > 0.4 ? 'Half full' : lv > 0.15 ? 'Low' : 'All but empty'}: it answers ${lv > 0.6 ? 'with a dull knock' : 'with a hollow boom'}, about ${f} Hz.`);
  }
  function caskDraw(k, x, y) {
    if (casks[k] < 0.05) { say('Nothing comes out: this one is dry.'); return; }
    casks[k] = Math.max(0, casks[k] - 0.1); pour = { x, y, t0: now() }; sfx('pour');
    try { localStorage.setItem('casks', JSON.stringify(casks)); } catch { /* (no storage: full again next time) */ }
    say(`You draw a jug. The cask is ${Math.round(casks[k] * 100)}% full now.`);
  }
  /* The gatehouse's portcullis: 0 down, 1 up; the winch turns it there (a few seconds), the door behind it
     opens on the day once it is up, the light coming in barred by what is still down. */
  const gate = { lift: 0, to: 0, at: 0 };
  function winchTo(v) { gate.to = clamp(v); sfx('tick'); say(v > 0.5 ? 'You turn the winch: the portcullis rises, chain by chain.' : 'You let it down.'); if (!running) render(now()); }
  /* The rookery's ravens come down to the feeder (a click on it), peck, and go back to their holes. */
  let feeding = null;
  function feedRavens() { feeding = { t0: now() }; sfx('flap'); setTimeout(() => sfx('caw'), 700); say('Grain in the trough: the ravens come down to it.'); }
  /* The schoolroom's chalk: taken (a click on it), it draws on the board where the pointer drags,
     a double-click wipes round it with the rag; put down with a click or Esc. Kept on this device. */
  let board = null; const chalk = { on: false, px: new Set((() => { try { return JSON.parse(localStorage.getItem('chalk')) || []; } catch { return []; } })()) };
  function chalkMode(on) {
    chalk.on = on; root.classList.toggle('chalking', on);
    say(on ? 'You take the chalk: draw on the board. A double-click wipes it with the rag; click the chalk again (or Esc) to put it down.' : 'You put the chalk down.');
    if (!on) try { localStorage.setItem('chalk', JSON.stringify([...chalk.px].slice(-6000))); } catch { /* (no storage: the board is wiped at the next visit) */ }
  }
  function chalkAt(ix, iy, erase) {
    if (!board || ix < board.l || ix >= board.r || iy < board.t || iy >= board.b) return;
    if (erase) { for (let y = -4; y <= 4; y += 1) for (let x = -6; x <= 6; x += 1) chalk.px.delete((iy + y) * RW + ix + x); } else chalk.px.add(iy * RW + ix);
    if (!running) render(now());
  } let marksOf = () => []; let revealing = false; // (bookmarks left in books: script; Shift held)
  let scrubTo = () => {}; let scrubbed = false; // (the hour dragged by the sun: assets/js/ui)
  let lastAct = 0; let freshOf = () => []; let guide = null; let guided = false; let roomT0 = 0;
  function drawGuide(t, put, blend) {
    const it = interior; if (reduce || view.state !== 'room' || !it.things.length) return;
    if (!guide) {
      if (guided || t - Math.max(lastAct, roomT0) < 20) return;
      guided = true;
      const fresh = (freshOf(it.id) || []).filter((k) => it.slots[k]); if (!fresh.length) return;
      const d = it.doors[0] || { x: 2, y: it.yf - 30, w: 18, h: 30 };
      guide = { t0: t, k: fresh[Math.floor(Math.random() * fresh.length)], x: Math.round(d.x + d.w / 2 - 6), yb: d.y + d.h };
    }
    const g = guide; const e = t - g.t0; if (e > 6) { guide = null; return; }
    if (lastAct > g.t0 + 0.5 && e < 5.4) g.t0 = t - 5.4; // (the visitor moved: he goes)
    const right = g.x > it.W / 2; const sp = right ? (SPRITES.wizardL ||= flip(SPRITES.wizard)) : SPRITES.wizard; // (by a door on the right: facing left)
    const W = it.W; const H = it.H; const x0 = g.x; const y0 = g.yb - sp.h;
    const shown = Math.min(1, e / 0.6, (6 - e) / 0.6);
    for (let y = 0; y < sp.h; y += 1) for (let x = 0; x < sp.w; x += 1) { const q = sp.px[y * sp.w + x]; const X = x0 + x; const Y = y0 + y; if (q >= 0 && X >= 0 && X < W && Y >= 0 && Y < H && bayer(X, Y) < shown) put(X, Y, ipal32[q]); }
    const sl = it.slots[g.k]; if (!sl) return;
    const ox = x0 + (right ? sp.w - 1 - ORB[0] : ORB[0]); const oy = y0 + ORB[1]; const tx = sl.x + sl.w / 2; const ty = sl.y + sl.h / 2;
    if (e > 0.8 && e < 3.6) for (let j = 0; j < 6; j += 1) { // the trail: sparks running from the orb to the thing
      const f = ((e - 0.8) * 0.8 + j * 0.06) % 1; const X = ox + (tx - ox) * f; const Y = oy + (ty - oy) * f - Math.sin(f * Math.PI) * 12;
      blend(X, Y, [255, 236, 150], 0.9 - j * 0.1);
    }
    if (e > 2.8 && e < 5.4) { const b = 0.5 + 0.5 * Math.sin(t * 9); for (let y = sl.y - 1; y <= sl.y + sl.h; y += 1) { blend(sl.x - 1, y, [255, 228, 150], b); blend(sl.x + sl.w, y, [255, 228, 150], b); } for (let x = sl.x; x < sl.x + sl.w; x += 1) { blend(x, sl.y - 1, [255, 228, 150], b); blend(x, sl.y + sl.h, [255, 228, 150], b); } }
  }

  /* Each dweller's gesture when clicked (act: 0 to 1 over its second): the smith strikes and sparks
     fly, the astronomer's eyeglass glints, dust rises off the librarian's book, the guard stamps,
     the herald lifts his staff, the falconer's raven beats its wings, the cellarer's candle flares,
     the cartographer's dividers catch the light. */
  const GESTURE_CUE = { projects: 'anvil', research: 'glint', publications: 'page', contact: 'steps', talks: 'bell', news: 'flap', cellar: 'blow', maproom: 'glint' };
  function dwellerAct(d, a, y0, put, blend, P) {
    const cx = d.x + 6; const hand = y0 + 13; const k = d.kind;
    if (k === 'projects') { for (let j = 0; j < 10; j += 1) { const r = a * 14 * (0.6 + (j % 3) * 0.2); const q = j * 0.62 + 0.3; if (a < 0.6) put(Math.round(cx + 7 + Math.cos(q) * r), Math.round(hand - Math.abs(Math.sin(q)) * r), P(j % 2 ? 'FL_YEL' : 'GOLD_HI')); } }
    else if (k === 'research' || k === 'maproom') { if (Math.floor(a * 6) % 2 === 0) { put(cx + 1, y0 + 4, P('GOLD_HI')); put(cx + 1, y0 + 3, P('CREAM')); } }
    else if (k === 'publications') { for (let j = 0; j < 5; j += 1) blend(cx - 3 + j * 2, Math.round(hand - 2 - a * 8 - (j % 2) * 2), [200, 190, 170], 0.6 * (1 - a)); }
    else if (k === 'talks') { const yt = y0 - 3 - Math.round(Math.sin(a * Math.PI) * 3); put(cx + 6, yt, P('GOLD_HI')); put(cx + 6, yt + 1, P('GOLD')); }
    else if (k === 'news') { const up = Math.floor(a * 10) % 2; put(d.x + d.w - 2, y0 + 7 - up, P('OUTLINE')); put(d.x + d.w - 1, y0 + 6 - up * 2, P('OUTLINE')); }
    else if (k === 'cellar') { for (let r = 1; r < 6; r += 1) blend(cx + 7, hand - r, [255, 210, 120], 0.5 * (1 - a) * (1 - r / 6)); put(cx + 7, hand - 1, P('FL_YEL')); }
  }

  /** A click in a room: on the workshop's hearth, a log on the fire. */
  function roomClick(ix, iy) { // (room pixels)
    if (candleClick(ix, iy)) return;
    const sl = interior.sills.find((q) => ix >= q.x0 - 1 && ix <= q.x0 + q.w && iy >= q.top && iy < q.y);
    if (sl) { const on = !opens.get(interior.id); opens.set(interior.id, on); reshape(); sfx(on ? 'glint' : 'drop'); say(on ? 'You open the window: the air of Paris comes in.' : 'You shut the window.'); return; }
    const f = interior.flames.find((q) => q.hearth && Math.abs(ix - q.x) <= q.w / 2 + 2 && iy > q.y - 18 && iy <= q.y + 2);
    if (f && bar.where === 'fire' && interior.deco.some((q) => q.type === 'anvil')) { const T = barTemp(now()); bar.where = 'anvil'; sfx('glint'); say(`${barLine(T)}: out of the fire with the tongs, onto the anvil.${T > 950 ? ' Strike while it is hot (click the anvil).' : ''}`); return; }
    if (f) { fireFed = now(); interior.toldEmbers = false; say(heatOf() > 0.9 ? 'You put a log on the fire; it catches and roars.' : 'The fire burns well.'); sfx('crackle'); return; }
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const an = interior.deco.find((q) => q.type === 'anvil' && ix >= q.x - 2 && ix < q.x + q.w + 2 && iy >= q.y - 2 && iy < q.y + q.h);
    if (an) {
      const T = barTemp(now());
      if (bar.where === 'anvil' && T > 950) { interior.struck = now(); bar.T -= 30; sfx('anvil'); say(`${barLine(bar.T)}. Clang: it gives a little under the hammer.`); return; }
      if (bar.where === 'anvil') { bar.where = 'fire'; sfx('crackle'); say(`${barLine(T)}: too cold to forge. Into the fire with it (click the hearth to take it out).`); return; }
      interior.struck = now(); sfx('anvil'); return;
    }
    const dw = interior.deco.find((q) => q.type === 'dweller' && ix >= q.x && ix < q.x + q.w && iy >= q.y && iy < q.y + q.h);
    if (dw) { dw.act = now(); sfx(GESTURE_CUE[dw.kind] || 'steps', { floor: 'stone', n: 2 }); return; }
    const m = interior.deco.find((q) => q.type === 'master');
    if (m && m.x !== undefined && ix >= m.x && ix < m.x + SPRITES.master.w && iy > m.yb - SPRITES.master.h && iy <= m.yb) {
      const st = masterAt(m, now()); const pt = real.portraits;
      if (pt && st.pointing && Math.random() < 0.6) { const c = pt.captions[st.stop]; say(`The master taps the board, then the portrait over it: "This line is ${c.name}'s, children: ${c.text.split(';')[0]}."`); } else say(`The master: ${pick(MASTER_TALK)}`);
      return;
    }
    const c = interior.deco.find((q) => q.type === 'chatter');
    const p0 = c && c.heads.find((h) => Math.abs(ix - h.x) <= 4 && iy >= h.y - 1 && iy <= h.y + h.h); if (p0) say(`A pupil whispers: ${pick(PUPIL_TALK)}`);
  }
  const scenePoint = (e) => {
    const r = plate.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / px), Math.floor((e.clientY - r.top) / px)];
  };

  function sparkle(n) {
    if (!scene) return;
    const { wizard } = scene;
    for (let k = 0; k < n; k += 1) {
      scene.sparks.push({ x: wizard.x + ORB[0], y: wizard.y + ORB[1], vx: (Math.random() - 0.5) * 1.2,
        vy: -(0.3 + Math.random() * 1.1), age: 0, life: 14 + Math.random() * 16, c: Math.floor(Math.random() * 3) });
    }
  }

  /** Particles, walkers, flights and flocks: one step per frame. */
  function step(t) {
    const { fire, fh, fw, W, Ws, M, yHor, yg, H, chimney } = scene;
    const span = Math.min(W, Ws);
    tick += 1;
    scene.drops ||= Array.from({ length: Math.round((W * H) / 160) }, () => ({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6 }));
    if (WET[weather.kind]) { // rain falls fast, leaning with the wind
      const slant = clamp(windX() * 0.75, -1, 1);
      scene.drops.forEach((d) => { d.y += 5; d.x += slant * 2.5; if (d.y > H) { d.y -= H + 4; d.x = Math.random() * W; } d.x = (d.x + W) % W; });
    } else if (weather.kind === 'snow') scene.drops.forEach((d) => { d.y += 0.6; if (d.y > H) { d.y = -2; d.x = Math.random() * W; } });
    scene.flash = Math.max(0, (scene.flash || 0) - 1);

    // the countryside: the mill turns with the wind (still in a calm), the hamlet's chimneys smoke,
    // the ducks paddle and turn, geese pass in autumn, shooting stars on clear nights
    if (!reduce) scene.millAngle += Math.min(weather.wind, 60) * 0.0025;
    // (the hearths are fed at the hours of meals: smoke at breakfast and supper, some at noon, a thread
    // by night; more of it in winter, less in summer)
    const hc = clockFn().getHours(); const meal = hc >= 6 && hc < 9 ? 1.8 : hc >= 17 && hc < 22 ? 1.8 : hc >= 11 && hc < 14 ? 1 : hc >= 23 || hc < 5 ? 0.2 : 0.45;
    if (scene.chimneys.length && Math.random() < 0.045 * meal * ({ winter: 1.6, summer: 0.6 }[scene.season] || 1)) {
      const c = scene.chimneys[Math.floor(Math.random() * scene.chimneys.length)];
      scene.fumes.push({ x: c.x, y: c.y, r: 1, age: 0, life: 40 + Math.random() * 30 });
    }
    scene.ducks.forEach((d) => {
      d.x += d.dir * 0.06;
      if (d.x < d.a || d.x > d.b || Math.random() < 0.002) d.dir = -d.dir;
    });
    const back = today().getMonth() === 2; // (in March they come back the other way, north-east)
    if (!scene.geese && (scene.season === 'autumn' || back) && look.night < 0.3 && Math.random() < 0.0012) {
      const y0 = Math.round(yHor * (0.2 + Math.random() * 0.25)); const dir = back ? 1 : -1; // (the V's point leads)
      scene.geese = Array.from({ length: 9 }, (_, k) => ({ x: (back ? -10 : span + 10) - dir * Math.ceil(k / 2) * 5, y: y0 + Math.ceil(k / 2) * (k % 2 ? 3 : -3), dir }));
    }
    if (scene.geese) {
      scene.geese.forEach((g) => { g.x += 0.8 * (g.dir || -1); g.y += 0.05; });
      if (scene.geese.every((g) => ((g.dir || -1) < 0 ? g.x < -6 : g.x > span + 6))) scene.geese = null;
    }
    if (look.night > 0.6 && weather.cover < 0.6 && !reduce && Math.random() < (meteorRate(clockFn()) * 8) / (3600 * 12)) {
      const dir = Math.random() < 0.5 ? -1 : 1; const v = 2 + Math.random() * 2;
      scene.meteors.push({ x: Math.random() * W, y: Math.random() * yHor * 0.5, dx: dir * v, dy: v * (0.4 + Math.random() * 0.5), age: 0, life: 6 + Math.random() * 6 });
    }
    scene.meteors = scene.meteors.filter((m) => { m.x += m.dx; m.y += m.dy; m.age += 1; return m.age < m.life; });
    // news less than a week old: a rider brings it up the road, once a visit
    if (!scene.walker && !reduce && t > 6 && !scene.riderDone) {
      scene.riderDone = true; const n = newsOf(); let told = false;
      try { told = sessionStorage.getItem('rider') === '1'; } catch { /* private mode */ }
      if (n && n.age < 7 && !told) { scene.walker = { y: H + 2, dir: -1, kind: 'rider', news: n.text }; try { sessionStorage.setItem('rider', '1'); } catch { /* */ } }
    }
    // a passer-by on the castle road now and then: peasant or messenger by day, a lantern by night
    if (!scene.walker && !reduce && Math.random() < 0.004) {
      const up = Math.random() < 0.5;
      scene.walker = { y: up ? H + 2 : scene.top + 1, dir: up ? -1 : 1, kind: look.night > 0.5 ? 'lantern' : Math.random() < 0.25 ? 'messenger' : Math.random() < 0.3 ? 'peddler' : 'peasant' };
    }
    if (scene.walker) {
      const w = scene.walker; w.y += w.dir * (w.y >= yg ? 0.22 : 0.07) * (w.kind === 'rider' ? 2.5 : 1); // slower far off: perspective
      if (!w.heard && w.y > H - 40 && w.y < H - 30) { w.heard = true; sfx('steps', { floor: 'gravel', n: 6, pan: ((scene.pathX[Math.round(w.y)] - M) / W) * 2 - 1 }); } // close by, on the gravel
      if (w.kind === 'rider' && w.y < scene.top) say(`A rider gallops up to the castle gate with a letter, fresh news: ${w.news}`);
      if (w.y < scene.top || w.y > H + 3) scene.walker = null;
    }
    if (!scene.fish && look.night < 0.6 && !reduce && Math.random() < 0.01) {
      const x = M + Math.round(Math.random() * Ws); const y = Math.round((scene.riverTop(x) + scene.riverBot(x)) / 2);
      scene.fish = { x, y0: y, y, age: 0, dir: Math.random() < 0.5 ? -1 : 1 };
    }
    if (scene.fish) { const f = scene.fish; f.age += 1; f.x += f.dir * 0.4; f.y = f.y0 - Math.sin((f.age / 12) * Math.PI) * 4; if (f.age > 12) scene.fish = null; }
    if (look.night > 0.7 && !reduce && Math.random() < 0.025) {
      const go0 = groundOff(fire.y) - M; scene.zzz.push({ x: scene.knight.x + go0 + 17, y: scene.knight.y + 2, age: 0 });
    }
    { // asleep, the knight dreams now and then of a piece of the research (a bubble, nine seconds)
      if (scene.dream && (t - scene.dream.t0 > 9 || (look.night <= 0.7 && !scene.dream.forced))) scene.dream = null;
      const q = new URLSearchParams(location.search).has('dream');
      if (!scene.dream && look.night > 0.7 && (q || (!reduce && Math.random() < 0.003))) {
        const ds = dreamsOf().map((d) => [d, Object.keys(DREAMS).find((k) => DREAMS[k][0].test(d.words))]).filter(([, k]) => k);
        if (ds.length) { const [d, icon] = ds[Math.floor(Math.random() * ds.length)]; scene.dream = { t0: t, name: d.name, icon }; }
      }
    }
    { // the owl hoots the hour at night, once for each (the twelve-hour count)
      const hr = clockFn().getHours();
      if (scene.hourSeen === undefined) { scene.hourSeen = hr; if (new URLSearchParams(location.search).has('hoot')) scene.hourSeen = -1; }
      if (hr !== scene.hourSeen) {
        scene.hourSeen = hr;
        if (look.night > 0.5) for (let k = 0; k < (hr % 12 || 12); k += 1) scene.hoots.push({ t0: t + 1 + k * 1.6 });
      }
      scene.hoots = scene.hoots.filter((h) => { if (!h.cued && t >= h.t0) { h.cued = true; sfx('owl'); } return t < h.t0 + 1.5; });
    }
    if (antsOut() && !reduce && tick % 2 === 0) antsStep(scene.ants);
    if (tick % 120 === 0) { if (root.classList.contains('sound-on')) sense('hearing'); if (tower || root.classList.contains('photo')) sense('sight'); } // (every ten seconds)
    { // the hunters come home over the snow now and then (by day), east to west across the meadow
      const sb = real.bruegel;
      if (sb && !scene.hunt && !reduce && ((snowCover() > 0.15 && look.night < 0.4 && Math.random() < 0.0015) || (forced.hunt || 0) > t)) {
        forced.hunt = 0; const hs = sb.sprites.map((q, k) => [q, k]).filter(([q]) => q.role !== 'skater');
        scene.hunt = { x: M + Math.min(W, Ws) + 4, y: yg + Math.round((H - yg) * 0.12),
          party: hs.map(([q, k], j) => ({ k, dx: q.role === 'hunter' ? j * 15 : 30 + (j - 2) * 13, dy: q.role === 'hunter' ? -j : 2 + (j % 2) * 4 })) }; // (the hunters ahead, the hounds trailing)
      }
      if (scene.hunt) {
        const hu = scene.hunt; hu.x -= 0.25;
        if (snowCover() > 0.05 && tick % 6 === 0) hu.party.forEach((m) => { const sp = sb.sprites[m.k]; scene.prints.push({ x: Math.round(hu.x + m.dx + sp.w / 2), y: Math.round(hu.y + m.dy), l: L.GROUND }); });
        if (scene.prints.length > 400) scene.prints.splice(0, scene.prints.length - 400);
        if (hu.x < M - 60) scene.hunt = null;
      }
    }
    { // the village's lights, annealed through the night: T falls from dusk (18 h) to the small hours
      const g = scene.glass; const N = g.s.length;
      if (N && look.night > 0.5 && tick % 6 === 0) {
        const d = clockFn(); const hs = (d.getHours() + d.getMinutes() / 60 + 6) % 24; g.T = 0.05 + 1.6 * Math.exp(-hs / 1.6);
        for (let i = 0; i < N; i += 1) {
          let f = 0; for (let j = 0; j < N; j += 1) f += g.J[i * N + j] * g.s[j];
          const dE = 2 * g.s[i] * f; if (dE <= 0 || Math.random() < Math.exp(-dE / g.T)) g.s[i] = -g.s[i];
        }
        let E = 0; for (let i = 0; i < N; i += 1) for (let j = i + 1; j < N; j += 1) E -= g.J[i * N + j] * g.s[i] * g.s[j];
        g.E = E / N; g.wins.forEach((w, i) => { w.lit = g.s[i] > 0; });
      }
    }
    { const h = clockFn().getHours(); if (!reduce && (h >= 21 || h < 2) && tick % 8 === 0) drunkStep(); }
    if (scene.skip) { // the stone's touches set the water ringing
      scene.wave ||= waveNew(scene);
      const wv = scene.wave; const sk = scene.skip;
      sk.hits.forEach((q) => {
        if (q.done || t < q.t) return; q.done = true; const yy = q.y - wv.y0;
        if (yy > 0 && yy < wv.h - 1) [[0, 0, -1.6], [1, 0, -0.8], [-1, 0, -0.8], [0, 1, -0.5], [0, -1, -0.5]].forEach(([dx, dy, a]) => { const i = (yy + dy) * wv.w + q.x + dx; if (wv.wet[i]) wv.u[i] += a; });
        wv.live = 1;
      });
      if (sk.hits.every((q) => q.done) && t > sk.hits[sk.hits.length - 1].t + 0.5) scene.skip = null;
    }
    if (scene.wave && scene.wave.live && !reduce) waveStep(scene.wave);
    { // a shoal in the river west of the bridge, seen when the sun is high and the water still
      const alt = bodies ? bodies.sun[2] / deg : 0;
      const on = ((forced.shoal || 0) > t || (alt > 25 && !WET[weather.kind] && weather.cover < 0.7 && (weather.frost ?? 9) > -3)) && !reduce;
      const x0 = M + Math.round(0.47 * Ws); const x1 = M + Math.round(0.64 * Ws); // (west of the bridge, clear of the menu)
      if (on && !scene.shoal) scene.shoal = Array.from({ length: 13 }, () => { const x = x0 + 10 + Math.random() * 20; return { x, y: (scene.riverTop(Math.round(x)) + scene.riverBot(Math.round(x))) / 2 + (Math.random() - 0.5) * 2, vx: 0.3, vy: 0 }; });
      if (!on) scene.shoal = null;
      if (scene.shoal) shoalStep(scene.shoal, x0, x1, scene.riverTop, scene.riverBot);
    }
    if (scene.market && !reduce) scene.market.folk.forEach((f) => { // a step, now and then, drawn from the policy
      const mk = scene.market;
      if (Math.abs(f.pos - f.to) > 0.01) { f.pos += Math.sign(f.to - f.pos) * Math.min(0.1, Math.abs(f.to - f.pos)); return; }
      if (Math.random() > 0.05) return;
      let r = Math.random(); let a = 0; while (a < 2 && (r -= mk.pol[f.to * 3 + a]) > 0) a += 1;
      f.to = clamp(f.to + a - 1, 0, mk.N - 1);
    });
    if (!reduce) scene.wheel += 0.05 * (1 + clamp(((weather.rain7 ?? 0) - 10) / 30, 0, 1.5)) * ((weather.frost ?? 9) <= -4 ? 0 : 1);
    scene.bridgeK += ((look.night > 0.55 ? 1 : 0) - scene.bridgeK) * (reduce ? 1 : 0.01);
    if (!reduce && tick % 2 === 0) lichenGrow(scene.lichen, 150); // (some three minutes to full size)
    scene.zzz = scene.zzz.filter((z) => { z.y -= 0.25; z.x += 0.15; z.age += 1; return z.age < 40; });
    const fest = festival(today());
    if (((fest && fest[0] === 'fireworks' && look.night > 0.4) || (forced.fireworks || 0) > t) && !reduce && Math.random() < 0.07) {
      scene.fireworks.push({ rocket: true, x: Math.round(W * (0.5 + Math.random() * 0.3)) + shift(RATE[L.MID]), y: scene.castleTop + 30, top: scene.castleTop - 10 - Math.random() * yHor * 0.4 });
    }
    const sparksOut = [];
    scene.fireworks = scene.fireworks.filter((f) => {
      if (f.rocket) {
        f.y -= 3.5;
        if (f.y > f.top) return true;
        const c = [[255, 90, 90], [255, 220, 110], [120, 210, 255], [200, 130, 255], [140, 255, 150]][Math.floor(Math.random() * 5)];
        if (window.Sound) window.Sound.cue('boom');
        for (let k = 0; k < 26; k += 1) { const a = (k / 26) * 2 * Math.PI; const v = 1 + Math.random() * 0.6; sparksOut.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 22 + Math.random() * 10, c }); }
        return false;
      }
      f.x += f.vx; f.y += f.vy; f.vy += 0.04; f.vx *= 0.97; f.age += 1; return f.age < f.life;
    });
    scene.fireworks.push(...sparksOut);
    if (scene.minstrelAt && !reduce && Math.random() < 0.06) scene.notes.push({ x: scene.minstrelAt[0], y: scene.minstrelAt[1], age: 0, ph: Math.random() * 6 });
    scene.notes = scene.notes.filter((n) => { n.y -= 0.3; n.x += Math.sin(n.age * 0.15 + n.ph) * 0.4; n.age += 1; return n.age < 70; });
    if (fest && !scene.toldFest) { scene.toldFest = true; try { if (sessionStorage.getItem('fest') !== fest[0]) { sessionStorage.setItem('fest', fest[0]); say(fest[1]); } } catch { /* private mode */ } }
    if (weather.kind === 'storm' && !reduce) { // a bolt grows out of sight, then strikes when it will
      if (scene.bolt && tick > scene.bolt.until) scene.bolt = null;
      if (!scene.boltGen) scene.boltGen = boltNew(30, Math.round((scene.yl0 - yHor * 0.2) / 2), Math.round(span * (Math.random() < 0.7 ? 0.08 + Math.random() * 0.4 : 0.82 + Math.random() * 0.12)), Math.round(yHor * 0.2)); // (clear of the castle)
      if (!scene.boltGen.done) boltGrow(scene.boltGen, 12);
      else if (!scene.bolt && (Math.random() < 0.01 || qBolt)) { // (?bolt: strike when ready, stay a while: previews)
        scene.bolt = { b: scene.boltGen, until: tick + (qBolt ? 60 : 3) }; scene.boltGen = null; scene.flash = 3;
        const km = 0.4 + Math.random() * 4; sfx('thunder', { delay: thunderDelay(km), km });
      } else if (Math.random() < 0.002) scene.flash = 2; // sheet lightning, inside the clouds
    } else { if (scene.bolt && tick > scene.bolt.until) scene.bolt = null; scene.boltGen = null; }
    if (scene.walker && snowCover() > 0.05) { // footprints in the snow behind the passer-by
      const w = scene.walker; const y = Math.round(w.y);
      if (y !== w.printY && y % 2 === 0 && y > 0 && y < H) {
        w.printY = y; const near = y >= yg; const side = (y / 2) % 2 ? 1 : -1;
        scene.prints.push({ x: Math.round(scene.pathX[y]) + (near ? side : 0), y, l: near ? L.GROUND : L.MID });
        if (scene.prints.length > 400) scene.prints.shift();
      }
    }

    if (Math.random() < 0.5) {
      scene.embers.push({ x: fire.x + (Math.random() - 0.5) * fw * 0.6, y: fire.y - fh * 0.5,
        vy: -(0.5 + Math.random() * 0.8), ph: Math.random() * 6, age: 0, life: 18 + Math.random() * 30 });
    }
    fluidStep(scene.fluid, (0.35 + 0.35 * look.night) * (scene.puff > t ? 3 : 1), windX()); // the campfire's smoke (see fluidStep)
    if (Math.random() < 0.12) scene.fumes.push({ x: chimney.x, y: chimney.y, r: 1, age: 0, life: 60 + Math.random() * 40 });
    const age = (list, move) => list.filter((p) => { p.age += 1; move(p); return p.age < p.life; });
    scene.embers = age(scene.embers, (e) => { e.y += e.vy; e.x += Math.sin(e.age * 0.3 + e.ph) * 0.5 + windX() * 0.2; });
    scene.smoke = age(scene.smoke, (p) => {
      p.y -= 0.35; p.x += windX() * 0.22 + Math.sin(p.age * 0.05) * 0.1; // drifts with the real wind
      if (p.age % 20 === 0 && p.r < 4) p.r += 1;
    });
    scene.fumes = age(scene.fumes, (p) => {
      p.y -= 0.18; p.x += windX() * 0.15 + Math.sin(p.age * 0.07) * 0.05;
      if (p.age % 25 === 0 && p.r < 3) p.r += 1;
    });
    if (t < castUntil && Math.random() < 0.8) sparkle(1);
    scene.sparks = age(scene.sparks, (s) => { s.x += s.vx; s.y += s.vy; s.vy += 0.015; });
    scene.flies.forEach((f) => { f.x += Math.sin(t * 0.7 + f.ph) * 0.3; f.y += Math.cos(t * 0.9 + f.ph * 2) * 0.2; });
    const pz = scene.peasant;
    if (pz) {
      pz.x += pz.dir * 0.12;
      if (pz.x > scene.field.x1 - 6 || pz.x < scene.field.x0 + 1) pz.dir = -pz.dir;
      const fy = Math.round((scene.field.top(Math.round(pz.x)) + scene.field.bot) / 2);
      if (scene.field.season !== 'winter' && Math.random() < 0.15) pz.seeds.push({ x: pz.x + (pz.dir > 0 ? 6 : 0), y: fy - 4, age: 0, life: 6 });
      pz.seeds = age(pz.seeds, (q) => { q.y += 0.4; q.x += pz.dir * 0.2; });
    }
    scene.falling.forEach((q) => {
      q.y += scene.season === 'winter' ? 0.35 : 0.25;
      if (q.y > H) { q.y = -2; q.x = Math.random() * scene.WE; }
    });
    scene.butterflies.forEach((b) => {
      b.x += Math.sin(t * 0.9 + b.ph) * 0.6 + Math.sin(t * 2.7 + b.ph * 3) * 0.3;
      b.y = clamp(b.y + Math.cos(t * 1.3 + b.ph * 2) * 0.4, yg + 4, H - 6);
      b.x = clamp(b.x, M + 5, M + span - 5);
    });
    scene.sentries.forEach((s) => { // walk to an end, wait, turn back
      if (s.pause > 0) { s.pause -= 1; return; }
      s.x += s.v;
      if (s.x < s.a || s.x > s.b) { s.v = -s.v; s.x = clamp(s.x, s.a, s.b); s.pause = 30 + Math.floor(Math.random() * 60); }
    });
    if (look.night > 0 && Math.random() < 0.01) { // a window goes out or comes on
      const w = scene.windows[Math.floor(Math.random() * scene.windows.length)];
      if (w && !w.glass && w !== scene.scribeWin) w.lit = !w.lit;
    }

    if (!scene.birds && look.night < 0.3 && Math.random() < 0.004) {
      const y0 = yHor * (0.15 + Math.random() * 0.4);
      scene.birds = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, k) => ({ x: span + 10 + k * 5, y: y0 + Math.abs(k - 2) * 3 }));
    }
    if (scene.birds) {
      scene.birds.forEach((b) => { b.x -= 0.7; b.y += Math.sin(t + b.x * 0.1) * 0.1; });
      if (scene.birds.every((b) => b.x < -5)) scene.birds = null;
    }

    { // the murmuration: autumn and winter dusks, a topological Vicsek flock (each bird turns to its
      // seven nearest neighbours' mean heading, Ballerini et al. 2008), pulled about a wandering centre
      const m = today().getMonth(); const alt = bodies ? bodies.sun[2] / deg : 0;
      const on = ((forced.starlings || 0) > t || ([9, 10, 11, 0, 1].includes(m) && alt < 3 && alt > -7 && !WET[weather.kind])) && !reduce && !lite;
      if (on && !scene.starlings) scene.starlings = Array.from({ length: 140 }, () => ({ x: W * (0.6 + Math.random() * 0.15), y: H * (0.18 + Math.random() * 0.1), a: Math.random() * 6.28 }));
      if (!on) scene.starlings = null;
      if (scene.starlings) {
        const B = scene.starlings; const cx0 = W * (0.68 + 0.12 * Math.sin(t * 0.13)); const cy0 = H * (0.22 + 0.06 * Math.sin(t * 0.21));
        const na = B.map((b) => {
          const nb = B.map((o) => [(o.x - b.x) ** 2 + (o.y - b.y) ** 2, o]).sort((p, q) => p[0] - q[0]).slice(1, 8);
          let sx = Math.cos(b.a); let sy = Math.sin(b.a); nb.forEach(([, o]) => { sx += Math.cos(o.a); sy += Math.sin(o.a); });
          const toC = Math.atan2(cy0 - b.y, cx0 - b.x); sx += 0.6 * Math.cos(toC); sy += 0.6 * Math.sin(toC);
          return Math.atan2(sy, sx) + (Math.random() - 0.5) * 0.5;
        });
        B.forEach((b, k) => { b.a = na[k]; b.x += Math.cos(b.a) * 1.2; b.y += Math.sin(b.a) * 0.8; });
      }
    }
    { // fireflies on summer nights, Kuramoto-coupled: d theta_i/dt = w_i + K r sin(psi - theta_i)
      const m = today().getMonth(); const on = ((forced.fireflies || 0) > t || ((m === 5 || m === 6) && look.night > 0.6 && (weather.temp ?? 15) >= 12 && !WET[weather.kind])) && !reduce;
      if (on && !scene.flies2) scene.flies2 = Array.from({ length: 36 }, () => ({ x: Math.round(W * (0.04 + Math.random() * 0.4)), y: Math.round(yg + 6 + Math.random() * (H - yg - 16)), th: Math.random() * 6.28, w: 2 * Math.PI * (0.8 + Math.random() * 0.15) }));
      if (!on) scene.flies2 = null;
      if (scene.flies2) {
        const F = scene.flies2; const cx = F.reduce((a, f) => a + Math.cos(f.th), 0) / F.length; const cy = F.reduce((a, f) => a + Math.sin(f.th), 0) / F.length;
        const r = Math.hypot(cx, cy); const psi = Math.atan2(cy, cx); scene.fliesR = r;
        F.forEach((f) => { f.th += (f.w + 1.6 * r * Math.sin(psi - f.th)) / 12; if (Math.random() < 0.01) { f.x += Math.round(Math.random() * 2 - 1); f.y += Math.round(Math.random() * 2 - 1); } });
      }
    }
    { // St John's eve (23 June), 8 pm on: the fire runs through the field, a forest-fire automaton
      const d = today(); const on = d.getMonth() === 5 && d.getDate() === 23 && d.getHours() >= 20;
      if (on && !scene.burn) { // (on the hill east of the path, where the dry grass shows)
        const x0 = M + Math.round(0.7 * Ws); const w = Math.floor((0.14 * Ws) / 2); const hh = 9; const p = 0.56 + Math.random() * 0.16;
        const g = Uint8Array.from({ length: w * hh }, () => (Math.random() < p ? 1 : 0)); for (let y = 0; y < hh; y += 1) if (g[y * w]) g[y * w] = 2;
        scene.burn = { x0, w, h: hh, g, p, tk: 0 };
      }
      if (!on) scene.burn = null;
      if (scene.burn && !reduce && (scene.burn.tk += 1) % 5 === 0) {
        const b = scene.burn; const n = b.g.slice();
        for (let k = 0; k < b.g.length; k += 1) if (b.g[k] === 2) { n[k] = 3; [k + 1, k - 1, k + b.w, k - b.w].forEach((j) => { if (j >= 0 && j < n.length && Math.abs((j % b.w) - (k % b.w)) <= 1 && b.g[j] === 1) n[j] = 2; }); }
        b.g = n; b.spanned ||= [...Array(b.h).keys()].some((y) => b.g[y * b.w + b.w - 1] >= 2);
      }
    }
    { // winter: a cold goes round the village's houses, SIR on a ring with the tavern as its hub
      const m = today().getMonth(); const on = [11, 0, 1].includes(m);
      if (on && !scene.sir) {
        const nodes = scene.hamlet.doors.map(([x, y]) => ({ x, y, s: 0 })); if (nodes.length) nodes[Math.floor(Math.random() * nodes.length)].s = 1;
        scene.sir = { nodes, day: 0, tk: 0 };
      }
      if (!on) scene.sir = null;
      if (scene.sir && !reduce && (scene.sir.tk += 1) % 180 === 0) { // a day every 15 s
        const S0 = scene.sir; const beta = 0.3 + 0.03 * Math.max(0, 10 - (weather.temp ?? 5)); const gamma = 0.25; const N = S0.nodes.length;
        const tav = scene.hamlet.places.tavern; const hub = tav ? S0.nodes.findIndex((n) => Math.abs(n.x - tav.x) < tav.w + 2) : -1;
        const next = S0.nodes.map((n) => n.s);
        S0.nodes.forEach((n, i) => {
          if (n.s !== 1) return;
          const nb = [(i + 1) % N, (i + N - 1) % N, ...(hub >= 0 ? (i === hub ? [...Array(N).keys()] : [hub]) : [])];
          nb.forEach((j) => { if (S0.nodes[j].s === 0 && Math.random() < beta) next[j] = 1; });
          if (Math.random() < gamma) next[i] = 2;
        });
        S0.nodes.forEach((n, i) => { n.s = next[i]; }); S0.day += 1; S0.beta = beta; S0.gamma = gamma;
        if (S0.nodes.every((n) => n.s !== 1)) { S0.nodes.forEach((n) => { n.s = 0; }); S0.nodes[Math.floor(Math.random() * N)].s = 1; S0.day = 0; } // and another comes along
      }
    }
    const fl = scene.flock; // the shepherd ambles; the sheep graze, drift, keep apart and near him; the dog runs round
    if (fl && !reduce) {
      if (Math.abs(fl.sh.x - fl.sh.tx) < 0.3) fl.sh.tx = fl.a + 4 + Math.random() * (fl.b - fl.a - 8); else fl.sh.x += Math.sign(fl.sh.tx - fl.sh.x) * 0.02;
      fl.dog.a += 0.03;
      fl.sheep.forEach((q, k) => {
        let ax = (fl.sh.x - q.x) * 0.0006 + (Math.random() - 0.5) * 0.02;
        fl.sheep.forEach((o, j) => { if (j !== k && Math.abs(o.x - q.x) < 5 && Math.abs(o.dy - q.dy) < 3) ax += Math.sign(q.x - o.x || (k - j)) * 0.025; }); // (room for each: closer, they read as one white blot)
        q.vx = clamp(q.vx * 0.92 + ax, -0.06, 0.06); q.x = clamp(q.x + q.vx, fl.a + 2, fl.b - 3);
        if (Math.abs(q.vx) > 0.02) q.dir = Math.sign(q.vx);
        if (Math.random() < 0.003) q.dy = clamp(q.dy + (Math.random() < 0.5 ? -1 : 1), 1, 7);
      });
    }
    const fe = scene.ferry; // a row every 8 frames; a pause at each jetty, then back
    if (fe && !reduce) {
      if (fe.wait > 0) fe.wait -= 1;
      else {
        fe.tick = (fe.tick || 0) + 1;
        if (fe.tick >= 8) {
          fe.tick = 0;
          const landed = ferryRow(fe, ferryCurrent());
          fe.px = fe.dx;
          if (landed !== null) { fe.errs.push(landed); if (fe.errs.length > 60) fe.errs.shift(); fe.n += 1; fe.r = 0; fe.dx = 0; fe.px = 0; fe.dir = -fe.dir; fe.wait = 30; }
        }
      }
    }

    // the dragon: every minute or so (every few seconds in wizard mode), across the sky
    const wiz = root.classList.contains('wizard');
    scene.nextDragon ??= t + 6;
    if (!scene.dragon && t > scene.nextDragon) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const high = Math.max(3, scene.castleTop - 30); // the frame's 23 rows and the wing-beat under the spires
      scene.dragon = { dir, x: dir > 0 ? -45 : span + 5, y: 0, y0: 3 + Math.random() * (high - 3), flames: [], breath: -1 };
    }
    const dg = scene.dragon;
    // in wizard mode it comes down onto the tall tower, sits a while, smoking, then flies on
    const tip = scene.tallTip;
    if (dg && wiz && tip && !dg.land) {
      const sp = SPRITES.dragon[1]; const tx = tip.x - M + shift(RATE[L.MID]) - Math.round(sp.w / 2);
      if (Math.abs(dg.x - tx) < 40) dg.land = { phase: 'down', t0: t, x0: dg.x, y0: dg.y, tx, ty: tip.y - sp.h + 4 };
    }
    if (dg && dg.land && dg.land.phase !== 'fly') {
      const L0 = dg.land; const k = clamp((t - L0.t0) / 1.6);
      if (L0.phase === 'down') {
        dg.x = L0.x0 + (L0.tx - L0.x0) * k; dg.y = L0.y0 + (L0.ty - L0.y0) * k * k;
        if (k >= 1) { L0.phase = 'sit'; L0.t0 = t; }
      } else if (L0.phase === 'sit') {
        if (!reduce && Math.random() < 0.15) scene.fumes.push({ x: dg.x - shift(RATE[L.MID]) + M + (dg.dir > 0 ? DRAGON_MOUTH[0] : SPRITES.dragon[0].w - DRAGON_MOUTH[0]), y: dg.y + DRAGON_MOUTH[1] - 2, r: 1, age: 0, life: 40 });
        if (t - L0.t0 > 10) { L0.phase = 'fly'; dg.y0 = dg.y - 20; }
      }
    } else if (dg) {
      dg.x += dg.dir * 1.4;
      dg.y = dg.y0 + Math.sin(dg.x * 0.05) * 4;
      if (dg.breath < 0 && Math.random() < (wiz ? 0.08 : 0.006)) dg.breath = 14;
      if (dg.breath > 0) {
        dg.breath -= 1;
        if (dg.breath === 0) dg.breath = -1;
        const mouth = dg.dir > 0 ? dg.x + DRAGON_MOUTH[0] : dg.x + SPRITES.dragon[0].w - 1 - DRAGON_MOUTH[0];
        for (let k = 0; k < 3; k += 1) {
          dg.flames.push({ x: mouth, y: dg.y + DRAGON_MOUTH[1], vx: dg.dir * (1.5 + Math.random()), vy: (Math.random() - 0.3) * 0.6,
            age: 0, life: 10 + Math.random() * 8 });
        }
      }
      dg.flames = age(dg.flames, (f) => { f.x += f.vx; f.y += f.vy; });
      if (dg.x < -50 || dg.x > span + 10) {
        scene.dragon = null;
        scene.nextDragon = t + (wiz ? 4 : 50 + Math.random() * 50);
      }
    }
  }

  /** The scene animates at ~12 fps; the parallax eases at the screen's rate (time-based, 0.2 s),
   *  and the frame is recomposed whenever a plane has moved by a pixel. */
  let lastMs = 0; let lastSig = '';
  function frame(ms) {
    raf = 0;
    if (!running) return;
    const dt = lastMs ? Math.min(0.1, (ms - lastMs) / 1000) : 0;
    lastMs = ms;
    par += (parTarget - par) * (1 - Math.exp(-dt / 0.2));
    let dirty = ['in', 'out', 'swap', 'climb'].includes(view.state) || !!zoom || !!tower;
    if (ms - last >= FPS_MS) {
      last = ms;
      if (view.state !== 'room') { stepFire(); step(now()); }
      if (interior) stepInterior();
      dirty = true;
      if (!lite && renderMs > 28) { lite = true; FPS_MS = 166; } // a slow machine: 6 frames a second, no flock
    }
    const sig = RATE.map((r) => shift(r)).join() + groundOff(scene.H - 1);
    if (sig !== lastSig) { lastSig = sig; dirty = dirty || view.state === 'scene'; }
    if (dirty) { const r0 = performance.now(); render(now()); renderMs = renderMs * 0.95 + (performance.now() - r0) * 0.05; if (view.state === 'scene') anchorMenu(); }
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const want = isOn() && visible && !document.hidden;
    if (want) {
      if (!view.id) plate.setAttribute('aria-label', SCENE_LABEL);
      resize();
      if (banner()) { pendingRoom = null; if (view.state !== 'scene' || zoom || tower) goRoom(null, false); } // (the terminal's banner: the landscape only, whatever room the castle was in)
      if (pendingRoom !== null) { const id = pendingRoom; pendingRoom = null; goRoom(id, false); }
      if (reduce) { render(now()); return; }
      if (!running) { running = true; lastMs = 0; raf = requestAnimationFrame(frame); }
    } else {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (!isOn()) plate.setAttribute('aria-label', label0);
    }
  }

  window.Hours = {
    start(o) {
      if (canvas) return;
      plate = o.plate; skyFn = o.sky; reduce = o.reduceMotion; clockFn = o.clock || clockFn;
      heraldry = o.heraldry || heraldry; say = o.say || say; rumour = o.rumour || rumour;
      freshOf = o.fresh || freshOf; scrubTo = o.scrub || scrubTo; pinsOf = o.pins || pinsOf; marksOf = o.marks || marksOf; roseTo = o.rose || roseTo; if (o.ink) { let n = 0; let at = 0; inkOf = () => { if (Date.now() - at > 2000) { at = Date.now(); n = o.ink(); } return n; }; } // (read every two seconds) ['pointermove', 'keydown', 'pointerdown', 'wheel'].forEach((ev) => addEventListener(ev, () => { lastAct = now(); }, { passive: true }));
      itemsOf = o.items || itemsOf; found = o.found || found; curiosOf = o.curios || curiosOf; nowOf = o.now || nowOf; visitsOf = o.visits || visitsOf;
      newsOf = o.news || newsOf; dreamsOf = o.dreams || dreamsOf; tradeWith = o.trade || tradeWith; stalenessOf = o.staleness || stalenessOf; billiardShow = o.billiard || billiardShow; spotsTo = o.spots || spotsTo; descendTo = o.descend || descendTo; cellarTo = o.cellar || cellarTo; mapsTo = o.maps || mapsTo; goTo = o.go || goTo; doorsOf = o.doors || doorsOf;
      pendingRoom = root.dataset.room || null;
      label0 = plate.getAttribute('aria-label');
      realIx(); // (the real things' index: credits now, the things when wanted)
      ['heures', 'monet', 'bruegel', 'muybridge', 'atget', 'chant', 'quotes', 'viandier'].forEach(realGet); // (those the landscape uses from the start)
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      plate.append(canvas);
      ctx = canvas.getContext('2d');
      roomCv = document.createElement('canvas'); roomCv.className = 'room'; roomCv.width = RW; roomCv.height = RH; roomCv.hidden = true;
      roomCv.setAttribute('aria-hidden', 'true'); plate.append(roomCv); rctx = roomCv.getContext('2d');
      rimg = rctx.createImageData(RW, RH); robuf = new Uint32Array(rimg.data.buffer);
      ibuf = new Uint32Array(RW * RH); iprev = new Uint32Array(RW * RH); ibase = new Uint32Array(RW * RH);
      { // the globe turns under a drag (and spins on when let go)
        const at = (e) => { const b = roomCv.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * RW, ((e.clientY - b.top) / b.height) * RH, b.width / RW]; };
        const gl = () => interior && view.state === 'room' && interior.deco.find((q) => q.type === 'globe');
        let chalkDown = false; const roomAt = (e) => { const b = roomCv.getBoundingClientRect(); return [Math.floor(((e.clientX - b.left) / b.width) * RW), Math.floor(((e.clientY - b.top) / b.height) * RH)]; };
        let lastChalk = null;
        const chalkLine = (p) => { const n = lastChalk ? Math.max(Math.abs(p[0] - lastChalk[0]), Math.abs(p[1] - lastChalk[1]), 1) : 1; for (let k = 1; k <= n; k += 1) chalkAt(lastChalk ? Math.round(lastChalk[0] + ((p[0] - lastChalk[0]) * k) / n) : p[0], lastChalk ? Math.round(lastChalk[1] + ((p[1] - lastChalk[1]) * k) / n) : p[1]); lastChalk = p; };
        roomCv.addEventListener('pointerdown', (e) => { if (!chalk.on) return; chalkDown = true; lastChalk = null; chalkLine(roomAt(e)); try { roomCv.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ } });
        roomCv.addEventListener('pointermove', (e) => { roomPointer = roomAt(e); if (chalk.on && chalkDown) chalkLine(roomPointer); });
        roomCv.addEventListener('pointerleave', () => { roomPointer = null; });
        roomCv.addEventListener('pointerup', () => { chalkDown = false; lastChalk = null; });
        roomCv.addEventListener('dblclick', (e) => { if (chalk.on) chalkAt(...roomAt(e), true); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chalk.on) { e.preventDefault(); e.stopImmediatePropagation(); chalkMode(false); } }, true);
        roomCv.addEventListener('pointerdown', (e) => {
          const g = gl(); if (!g) return; const [x, y, k] = at(e); if (Math.hypot(x - g.x, y - g.y) > g.r + 2) return;
          globe.drag = { x: e.clientX, lon: globe.lon, k, last: e.clientX, tl: performance.now() }; globe.vel = 0; try { roomCv.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ } roomCv.style.cursor = 'grabbing';
        });
        roomCv.addEventListener('pointermove', (e) => {
          const g = gl(); const d = globe.drag;
          if (d) { const per = 1 / (d.k * (g ? g.r : 4)); globe.lon = d.lon - (e.clientX - d.x) * per; const now1 = performance.now(); const dt = Math.max(1, now1 - d.tl) / 1000; globe.vel = -((e.clientX - d.last) * per) / dt; d.last = e.clientX; d.tl = now1; return; }
          const [x, y] = at(e); roomCv.style.cursor = g && Math.hypot(x - g.x, y - g.y) <= g.r + 2 ? 'grab' : '';
        });
        const drop = () => { if (!globe.drag) return; if (performance.now() - globe.drag.tl > 120) globe.vel = 0; globe.drag = null; roomCv.style.cursor = ''; };
        roomCv.addEventListener('pointerup', drop); roomCv.addEventListener('pointercancel', drop);
      }
      roomCv.addEventListener('click', (e) => { // (room pixels)
        if (view.state !== 'room' || !interior) return; const b = roomCv.getBoundingClientRect();
        roomClick(Math.floor(((e.clientX - b.left) / b.width) * RW), Math.floor(((e.clientY - b.top) / b.height) * RH));
      });
      const redraw = () => { if (isOn() && resize()) render(now()); }; // (at once, even when running: a resized canvas is blank until drawn, and the plate behind would flash through)
      new ResizeObserver(redraw).observe(plate);

      addEventListener('resize', redraw);
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(plate);
      document.addEventListener('visibilitychange', sync);
      new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      // parallax follows a mouse, not a finger; the menu box moves with the wizard
      if (!reduce) {
        addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse' || !isOn() || zoom) return;
          parTarget = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
        }, { passive: true });
        addEventListener('deviceorientation', (e) => { // the tower: the phone tilted left or right
          if (e.gamma === null || !root.classList.contains('climb') || zoom) return;
          parTarget = clamp(e.gamma / 25, -1, 1);
        }, { passive: true });
        const DOE = window.DeviceOrientationEvent; // iOS gives the tilt only once asked, from a gesture: the first tap on the picture
        if (DOE && typeof DOE.requestPermission === 'function') {
          const ask = (e) => {
            if (!root.classList.contains('climb') || !(e.target instanceof Element) || !e.target.closest('.plate, .spot')) return;
            document.removeEventListener('click', ask); DOE.requestPermission().catch(() => {});
          };
          document.addEventListener('click', ask);
        }
      }
      // the wizard answers the menu he holds: sparks while a choice is pointed at, a burst on one
      const pointed = (e) => isOn() && e.target instanceof Element && e.target.closest('.tabs a');
      const roomIn = (a) => (a ? (a.getAttribute('href').split('#')[1] || null) : null);
      document.addEventListener('pointerover', (e) => { const a = pointed(e); hoverId = roomIn(a) || hoverId; if (a) castUntil = now() + 1.2; });
      document.addEventListener('pointerout', (e) => { if (pointed(e)) hoverId = null; });
      document.addEventListener('focusin', (e) => { const a = pointed(e); hoverId = roomIn(a); if (a) castUntil = now() + 1.2; });
      document.addEventListener('click', (e) => { if (pointed(e)) { castUntil = now() + 0.6; sparkle(24); } });
      // close up, only the market answers (out: the button, or Esc)
      { // the sun or the moon dragged along the sky: another hour of the same day (assets/js/ui shifts the clock), back to now when let go
        let scrub = null;
        canvas.addEventListener('pointerdown', (e) => {
          if (!bodies || view.state !== 'scene' || zoom || tower || !isOn()) return;
          const [x, y] = scenePoint(e); const near = (b) => b && b[2] > -0.03 && Math.hypot(x - b[0], y - b[1]) < 9; // (above the horizon)
          if (!near(bodies.sun) && !near(bodies.moon)) return;
          scrub = { x: e.clientX, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ }
          canvas.style.cursor = 'grabbing'; e.preventDefault();
        });
        canvas.addEventListener('pointermove', (e) => {
          if (!scrub) return; const dx = (e.clientX - scrub.x) / (scene.W * px); // (the scene's width: twelve hours)
          scrub.moved ||= Math.abs(e.clientX - scrub.x) > 3; scrubTo(dx * 12 * 3600e3);
        });
        const let0 = () => { if (!scrub) return; scrubbed = scrub.moved; scrub = null; canvas.style.cursor = ''; scrubTo(null); };
        canvas.addEventListener('pointerup', let0); canvas.addEventListener('pointercancel', let0);
      }
      canvas.addEventListener('click', (e) => { if (scrubbed) { scrubbed = false; return; } if (view.state === 'room' && interior) { roomClick(...scenePoint(e)); return; } if (tower) { if (tower.on) towerClick(...scenePoint(e)); return; } if (zoom) { villageClick(...scenePoint(e)); return; } const pt = scenePoint(e); const h = isOn() && hitAt(...pt); if (h) talk(h); else if (isOn()) skim(...pt); });
      document.addEventListener('keydown', (e) => { // [ ] through the curiosities in sight, Enter to look
        if (!isOn() || view.state !== 'scene' || zoom || tower || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target instanceof Element && e.target.closest('input, textarea, dialog')) return;
        if (e.key === '[' || e.key === ']') {
          e.preventDefault(); selList = curioList(); if (!selList.length) return;
          sel = ((sel < 0 ? (e.key === ']' ? -1 : 0) : sel) + (e.key === ']' ? 1 : -1) + selList.length) % selList.length;
          const nm = CURIO_NAMES[selList[sel].h.kind] || selList[sel].h.kind;
          say(`${nm[0].toUpperCase()}${nm.slice(1)} (${sel + 1} of ${selList.length}): Enter to look, [ ] for the others, Esc to stop.`, null, { now: true });
          if (!running) render(now());
        } else if (e.key === 'Enter' && sel >= 0 && selList[sel] && (!(document.activeElement instanceof Element) || document.activeElement === document.body)) {
          e.preventDefault(); talk(selList[sel].h);
        } else if (e.key === 'Escape' && sel >= 0) { sel = -1; if (!running) render(now()); }
      });
      document.addEventListener('keydown', (e) => {
        if (tower && tower.on) {
          if (e.key === 'Escape') { e.preventDefault(); towerTo(false); }
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); turnTower(e.key === 'ArrowLeft' ? -1 : 1); }
          return;
        }
        if (!zoom || !zoom.on) return;
        if (e.key === 'Escape') { e.preventDefault(); zoomTo(false); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); zoom.pan = (zoom.pan || 0) + (e.key === 'ArrowLeft' ? -8 : 8); }
      }, true);
      // a wooden signpost by the pointer where a way leads somewhere: the path, the village, the watchtower, the cellar door
      const post = document.createElement('div'); post.className = 'signpost'; post.hidden = true; document.body.append(post);
      const WAYS = { village: 'to the village and its market', watch: 'up the watchtower', cellar: 'down to the cellar' };
      const wayAt = (x, y, hit) => {
        if (!scene || view.state !== 'scene' || zoom || tower) return null;
        if (hit && WAYS[hit.kind]) return WAYS[hit.kind];
        const p = scene.path; const yy = Math.round(y);
        return yy >= 0 && yy < scene.H && p.x[yy] > -50 && Math.abs(x - (p.x[yy] - scene.M + groundOff(yy))) <= p.w[yy] + 1 ? 'to the castle: its rooms are in the menu' : null;
      };
      canvas.addEventListener('pointerleave', () => { pointer = null; post.hidden = true; });
      canvas.addEventListener('pointermove', (e) => {
        pointer = scenePoint(e); if (isOn() && view.state === 'scene' && !zoom && !tower) clearFog(...pointer); const hit = isOn() && !zoom ? hitAt(...pointer) : null;
        canvas.style.cursor = isOn() && (zoom ? zoom.done : hit) ? 'var(--cur-hand)' : '';
        const way = isOn() ? wayAt(...pointer, hit) : null; post.hidden = !way;
        if (way) { post.textContent = way; post.style.left = `${e.clientX + 14}px`; post.style.top = `${e.clientY - 34}px`; }
      });
      sync();
    },
    /** New minute, or another hour asked for with `sky`: relight the same scene. */
    update() {
      if (!scene) return;
      relight();
      if (!running && isOn()) render(now());
    },
    /** Into the room of section `id`, or back out (null); assets/js/ui calls it as the hash changes. */
    room(id, { animate = true, dir = 0 } = {}) { if (banner()) { root.classList.toggle('room-ready', Boolean(id)); return; } goRoom(id, animate, dir); },
    /** A still of room `id` at this hour, as a data URL (the tower's frames not yet visited); null
     *  while the picture is on its way somewhere (asked again later). The live room is put back. */
    snapshot(id) {
      if (!scene || !ROOM_NAMES[id] || !['scene', 'room'].includes(view.state)) return null;
      const keep = interior; const base0 = ibase.slice(); const buf0 = ibuf.slice();
      try {
        interior = makeInterior(id); lightInterior(); drawInterior(now());
        const { W, H } = interior; const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const im = cv.getContext('2d').createImageData(W, H); new Uint32Array(im.data.buffer).set(ibuf.subarray(0, W * H));
        cv.getContext('2d').putImageData(im, 0, 0);
        return cv.toDataURL();
      } finally { interior = keep; ibase.set(base0); ibuf.set(buf0); }
    },
    /** Draw the realm (the map dialog's Paris) into a 240x150 canvas. */
    realm(cv) { if (cv) drawRealm(cv); },
    /** The hour has turned: the bell swings a few seconds. */
    ring() { if (scene) scene.ringUntil = now() + 5; },
    /** Every room seen: the visitor's banner goes up the keep (`instant`: already up). */
    hoist(instant) { if (scene && !scene.hoist) scene.hoist = { t0: instant ? -99 : now() }; else if (!scene) pendingHoist = true; },
    /** The weather over Paris changed (or a preview asked for one). */
    weather(w) {
      const iced = () => (weather.temp ?? 9) <= 0 || (weather.frost ?? 9) <= -3; const was = iced();
      weather = { ...weather, ...w };
      if (scene) relight();
      if (interior && view.id && iced() !== was) { interior = makeInterior(view.id); lightInterior(); if (view.state === 'room') publishSpots(true); } // frost on the glass, or gone
      if (scene && !running && isOn()) render(now());
    },
    /** Close up on the village (the `village` command); out of a room first. */
    village() { if (scene && view.state === 'scene' && !tower) talk({ kind: 'village' }); },
    /** Out of a close-up or down from the tower (the tour). */
    back() { if (tower && tower.on) towerTo(false); if (zoom && zoom.on) zoomTo(false); },
    /** Turn round atop the tower by a quarter (the tour). */
    turn(k) { turnTower(k); },
    /** Up the watchtower (the `tower` command). */
    tower() { if (scene && view.state === 'scene' && !zoom) talk({ kind: 'watch' }); },
    /** Light the thing at index i (hotspot hovered or focused); -1 for none. */
    /** The event command: call up event `name`; its line for the message bar (or null). */
    trigger(name) {
      if (!scene || !EVENTS[name]) return null;
      const msg = EVENTS[name](now()); if (!running && isOn()) render(now());
      return msg && OUTDOOR.has(name) && !outdoors() ? `${msg} (Outside: leave the room to see it.)` : msg;
    },
    /** Paint frame i of real asset `name` into canvas cv, in its daylight colours; its caption (HTML). */
    paint(cv, name, i) {
      const a = real[name]; if (!a) return '';
      const px0 = a.frameIdx ? a.frameIdx[((i % a.frameIdx.length) + a.frameIdx.length) % a.frameIdx.length] : a.idx;
      cv.width = a.w; cv.height = a.h; const g = cv.getContext('2d'); const im = g.createImageData(a.w, a.h);
      for (let k = 0; k < px0.length; k += 1) { const c = px0[k]; if (c < 0) continue; const [r, gg, b] = hex(DAYLIGHT[c]); im.data.set([r, gg, b, 255], k * 4); }
      g.putImageData(im, 0, 0);
      const cap = a.months ? a.months[i % 12] : a.captions ? a.captions[i % a.captions.length] : null;
      return cap ? `<b>${cap.name}.</b> ${cap.text}` : '';
    },
    /** Is it a market in the village now (its stalls up: the day, by daylight)? For sound.js's band. */
    market() { return Boolean(scene) && marketDay(today()) && look.night < 0.3; },
    /** The picture now, the room's canvas laid over the landscape's (the tower's stills), as a data URL. */
    picture() {
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const g = c.getContext('2d');
      g.imageSmoothingEnabled = false; g.drawImage(canvas, 0, 0);
      if (!roomCv.hidden) g.drawImage(roomCv, roomBox.l / px, roomBox.t / px, (RW * roomBox.k) / px, (RH * roomBox.k) / px);
      return c.toDataURL();
    },
    /** Is the lantern show on (for the projector's clatter)? */
    cinema() { return Boolean(interior && interior.deco.some((d) => d.type === 'cinema')); },
    /** Draw the astrolabe, set for now, on canvas cv; its caption (HTML). */
    astrolabe(cv) { return astrolabeDraw(cv, clockFn()); },
    /** The tavern's fare today: {lean, why, dishes: [{name, what, text}]}, or null before the book has come. */
    fare() { return fareNow(); },
    /** The chapel's office now (lauds, prime, vespers, compline) or null, for sound.js's chant. */
    office() { const o = officeNow(); return o ? { name: o, key: forced.chant && forced.chant.until > now() ? `f${forced.chant.until}` : `${today().toDateString()}-${o}` } : null; },
    /** Whose work the castle borrows (index.json's credits), for the register. */
    credits() { return Object.values(realIndex || {}).flatMap((e) => e.credits || []); },
    /** The events there are. */
    events() { return Object.keys(EVENTS); },
    /** Where the sounds' sources stand across the screen (-1 left .. 1 right), for sound.js. */
    pans() {
      if (!scene || view.state !== 'scene') return {};
      const { W, M } = scene; const go = groundOff(scene.fire.y) - M; const mid = shift(RATE[L.MID]) - M;
      const at = (x) => clamp((x / W) * 2 - 1, -0.9, 0.9); const hm = scene.hamlet;
      return { fire: at(scene.fire.x + go), horse: at(scene.horse.x + go + 20), owl: at(scene.owl.x + shift(RATE[L.FG]) - M), mill: at(scene.mill.hub[0] + mid),
        chapel: at((hm.spire ? hm.spire[0] : hm.x0) + mid), ducks: at(scene.ducks[0].x + mid), bell: at(scene.bell.x + mid), village: at((hm.x0 + hm.x1) / 2 + mid) };
    },
    /** The library ladder dragged to viewport x: its new hotspot (viewport px), or null. */
    ladderTo(clientX) {
      const d = interior && interior.deco.find((q) => q.type === 'ladder'); if (!d) return null;
      const r = plate.getBoundingClientRect(); const ix = (clientX - r.left - roomBox.l) / roomBox.k - 3;
      ladderF = clamp((ix - d.a) / (d.b - d.a)); return ladderSpot(d);
    },
    /** The ladder a step along (k = -1, 1), for the keyboard. */
    ladderBy(k) {
      const d = interior && interior.deco.find((q) => q.type === 'ladder'); if (!d) return null;
      ladderF = clamp(ladderF + k * 0.08); return ladderSpot(d);
    },
    highlight(i) { hl = i; if (interior && lifted !== i) { lifted = i; reshape(); } if (!running && interior && isOn()) render(now()); },
    /** Shift held (or let go): every thing of the room outlined. */
    reveal(on) { if (revealing !== on) { revealing = on; if (!running && interior) render(now()); } },
    /** A key 1 to 8 just after the bell was rung: a note of the carillon (true when taken). */
    carillon(k) { if (now() > carillonUntil || view.state !== 'scene') return false; carillonUntil = now() + 15; scene.ringUntil = now() + 1; sfx('carillon', { k }); return true; },
    /** The library's lectern turned a book on (dir 1) or back (-1). */
    lectern(dir) {
      const lt = interior && interior.things.find((q) => q.kind === 'lectern'); if (lt && lt.count < 2) { say('One book on the lectern so far: it turns when there are more.'); return; }
      lecternIx = (lecternIx + dir + 64) % 64; sfx('page'); this.refresh();
    },
    /** The gatehouse winch turned by a drag: dy room px (down raises). */
    winchBy(dy) { gate.to = clamp(gate.to + dy / 40); if (!running) render(now()); },
    /** The room drawn again (a card pinned up or taken down). */
    refresh() { if (interior && view.id && view.state === 'room') { interior = makeInterior(view.id); lightInterior(); lifted = -1; openIx = -1; publishSpots(true); if (!running) render(now()); } },
    /** Texture `name` (textures.js) painted into canvas cv in its daylight colours. */
    swatch(cv, name) {
      const g = cv.getContext('2d'); const im = g.createImageData(cv.width, cv.height);
      for (let y = 0; y < cv.height; y += 1) for (let x = 0; x < cv.width; x += 1) { const [r, gg, b] = hex(DAYLIGHT[texAt(name, x, y)]); im.data.set([r, gg, b, 255], (y * cv.width + x) * 4); }
      g.putImageData(im, 0, 0);
    },
    /** The castle's name for room `id` ('the workshop'). */
    roomName(id) { return ROOM_NAMES[id] || null; },
    /** Where the sun is, in viewport px (null below the horizon or in a room). */
    sunAt() { if (!bodies || view.state !== 'scene' || bodies.sun[2] < -0.03) return null; const r = plate.getBoundingClientRect(); return [r.left + bodies.sun[0] * px, r.top + bodies.sun[1] * px]; },
    /** Is the window of the room open (sound.js lets the outside in)? */
    windowOpen() { return Boolean(interior && view.state === 'room' && opens.get(interior.id)); },
    /** The card of thing i is open (-1: closed): the thing leaves its place. */
    opened(i) {
      if (!interior || openIx === i) return; openIx = i; reshape();
      if (i >= 0 && (interior.things[i] || {}).kind === 'letter' && interior.sills.length) { flight = { t0: now() }; sfx('caw'); } // (a raven out through the window with the answer)
    },
  };
}());
