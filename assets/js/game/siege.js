/* Siege: a first-person game under the castle, five against five with bots, rounds and an economy, a
   keg of powder to plant or to defuse (after the tactical shooters, in the castle's century). The world
   (map.js) is a grid of cells of many heights (floors, steps, crates, walls, towers; roofs over some),
   drawn a column at a time front to back (each cell's floor, the faces where the ground rises, the
   ceilings and the lintels of covered places), with a depth for every pixel; textured from textures.js in
   the castle's palette; actors, props, smoke, fire and thrown things against that depth. Loaded on demand
   (ui: the `siege` command, the descent's stair); its arms in weapons.js and models.js, its bots in bots.js. */
(function () {
  const ARMS = window.SIEGE_ARMS; const MODELS = window.SIEGE_MODELS; const BOTS = window.SIEGE_BOTS; const PAL = window.HOURS_PALETTE; const TEX = window.TEXTURES; const M = window.SIEGE_MAP;
  let W = 960; let H = 540; // (the picture, scaled up whole to the screen: settings.quality picks it)
  const QUALITY = [[640, 360], [960, 540], [1280, 720]];
  const MW = M.W; const MH = M.H;
  // a man: 0.86 tall (0.62 crouched), his eyes 0.62 (0.45), his radius 0.22; he steps up 0.26 and jumps 0.66
  const STAND = 0.86; const CROUCH = 0.62; const STEP = 0.26; const GRAV = 11; const JUMP_V = 3.8;
  const hAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? 9 : M.h[y * MW + x]); // (a cell's floor, or a wall's top)
  const roofAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? Infinity : M.roof[y * MW + x]);
  const matAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? 'W' : M.MAT[y][x]);
  const isWall = (x, y) => 'WHTS'.includes(matAt(x, y));
  const PROPDEF = { barrel: { r: 0.28, top: 0.5, h: 0.92, wk: 0.66 }, hay: { r: 0.42, top: 0.45, h: 0.6, wk: 0.95 }, well: { r: 0.55, top: 0.55, h: 1.3, wk: 1.1 }, cart: { r: 0.5, top: 0.5, h: 0.9, wk: 1.4 }, tree: { r: 0.22, top: 9, h: 3.2, wk: 2.4 } };
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

  /** A texture's smaller copies (each half the last, averaged): far floors and walls read these, not shimmering. */
  function mipsOf(t) {
    if (t.m) return t.m; const out = [t]; let src = t; let w = T; let h = t.length / T;
    for (let k = 0; k < 2; k += 1) { const w2 = w >> 1; const h2 = h >> 1; const d = new Uint32Array(w2 * h2);
      for (let y = 0; y < h2; y += 1) for (let x = 0; x < w2; x += 1) { let r = 0; let gg = 0; let b = 0; for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const v = src[(y * 2 + j) * w + x * 2 + i]; r += v & 255; gg += (v >> 8) & 255; b += (v >> 16) & 255; } d[y * w2 + x] = 0xff000000 | ((b >> 2) << 16) | ((gg >> 2) << 8) | (r >> 2); }
      out.push(d); src = d; w = w2; h = h2; }
    t.m = out; return out;
  }
  const props = []; // [{ x, y, img, h, wk }], found once
  function prepProps() { props.length = 0; M.PROPS.forEach(([k, x, y]) => { const d = PROPDEF[k]; props.push({ kind: k, x, y, r: d.r, top: hAt(Math.floor(x), Math.floor(y)) + d.top, z: hAt(Math.floor(x), Math.floor(y)), h: d.h, rot: (x * 7.3 + y * 3.1) % 6.2832 }); }); }

  /* ---- the visitor's settings: the keys for each action (keyboard codes, Mouse0-4, WheelUp/WheelDown: by
     place on the keyboard, so ZQSD on an AZERTY one), the mouse (radians a count: 0.0011 is a tactical shooter's
     2.86 at 800 dpi), the field of view, the crosshair, the hand, the sound, the picture ---- */
  const ACTIONS = [['attack', 'Fire'], ['attack2', 'Second fire (scope, heavy stab, lob)'], ['forward', 'Forward'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['jump', 'Jump'], ['crouch', 'Crouch'], ['walk', 'Walk (silent)'],
    ['reload', 'Reload'], ['use', 'Use (plant, defuse, pick up)'], ['drop', 'Drop the weapon'], ['inspect', 'Inspect'], ['buy', 'Buy'], ['scores', 'Scores'], ['slot1', 'Main weapon'], ['slot2', 'Pistol'], ['slot3', 'Knife'], ['slot4', 'Throwables'], ['slot5', 'The keg'],
    ['lastweapon', 'Last weapon'], ['nextweapon', 'Next weapon'], ['prevweapon', 'Previous weapon'], ['forge', "The knife's forge"]];
  const BINDS = { attack: ['Mouse0'], attack2: ['Mouse2'], forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['Space'], crouch: ['ControlLeft', 'KeyC'], walk: ['ShiftLeft'],
    reload: ['KeyR'], use: ['KeyE'], drop: ['KeyG'], inspect: ['KeyF'], buy: ['KeyB'], scores: ['Tab'], slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'], lastweapon: ['KeyQ'], nextweapon: ['WheelDown'], prevweapon: ['WheelUp'], forge: ['KeyK'] };
  const SETTINGS0 = { sens: 0.0011, zoomSens: 1, fov: 1.6, invert: false, quality: 1, detail: 'half', hand: 'right', bob: 1, volume: 0.8, fullscreen: true, showFps: false,
    xhair: { style: 'dynamic', color: '#8cff6e', size: 8, gap: 4, thick: 2, outline: true, dot: false } };
  const settings = (() => { let st = {}; try { st = JSON.parse(localStorage.getItem('siege-settings') || '{}') || {}; } catch { /* (no storage: the defaults) */ } return { ...SETTINGS0, ...st, xhair: { ...SETTINGS0.xhair, ...(st.xhair || {}) }, binds: { ...BINDS, ...(st.binds || {}) } }; })();
  const saveSettings = () => { try { localStorage.setItem('siege-settings', JSON.stringify(settings)); } catch { /* (no storage: for this time only) */ } };
  const held = (action) => (settings.binds[action] || []).some((c) => keys.has(c));
  const actionsOf = (code) => ACTIONS.map(([a]) => a).filter((a) => (settings.binds[a] || []).includes(code));
  const keyName = (c) => ({ Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Mouse3: 'Mouse back', Mouse4: 'Mouse forward', WheelUp: 'Wheel up', WheelDown: 'Wheel down', Space: 'Space', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', AltLeft: 'Alt', Tab: 'Tab', Escape: 'Esc' }[c]
    || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑').replace(/^Numpad/, 'Num '));

  /* ---- the game ---------------------------------------------------------------------------------- */
  let g = null; let raf = 0; let root = null; let cv; let ctx; let img; let buf; let zbuf; let ui = {};
  const keys = new Set(); let capture = null; // (keys and mouse buttons held; capture: the settings waiting for a key to bind)
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { /* (no storage: nothing kept) */ } return null; };

  function newActor(team, idx, isBot, name) {
    return { team, idx, isBot, name, x: 0, y: 0, z: 0, vz: 0, a: 0, vx: 0, vy: 0, hp: 100, armour: 0, helm: false, alive: true, money: 800, weapons: { 1: null, 2: team === 'def' ? 'wheellock' : 'wheellock', 3: 'knife' },
      slot: 2, ammo: {}, gear: {}, tools: false, kills: 0, deaths: 0, lastShot: 0, shotN: 0, blindUntil: 0, reloadUntil: 0, moving: false, ai: {}, crouch: false };
  }
  function give(a, id) { const w = ARMS.W[id]; a.weapons[w.slot] = id; a.ammo[id] = { mag: w.mag || 0, res: (w.mag || 0) * 3 }; a.slot = w.slot; }
  const cur = (a) => (a.slot === 4 ? 'nade' : a.slot === 5 ? 'keg' : a.weapons[a.slot] || a.weapons[2] || 'knife');

  function start(opts = {}) {
    if (g) return;
    const knife = store('siege-knife') || ARMS.randomKnife(); store('siege-knife', knife);
    g = { w: MW, h: MH, now: 0, actors: [], noises: [], nades: [], smokes: [], fires: [], fx: [], feed: [], arms: ARMS, difficulty: store('siege-diff') || 'normal',
      keg: {}, sites: [], posts: { def: [] }, round: 0, score: { def: 0, att: 0 }, phase: 'buy', phaseUntil: 0, frozen: true, lossStreak: { def: 0, att: 0 }, attSite: 0,
      knife: ARMS.knife(knife), knifeRecipe: knife, eyeH: 0.62, bobT: 0, drawAt: 0, sway: 0, hitMarkAt: -9, hitHead: false, heavySwing: false, pitch: 0, punch: 0, kick: 0, inspect: -1, swing: -1, flashUntil: 0, flashAt: 0, hurtAt: -9, scoped: false, msg: '', msgUntil: 0, opts, paused: false };
    g.give = give; Object.assign(g, api); // (the bots' handle on the game: what they read, what they do through it)
    g.hAt = hAt; g.roofAt = roofAt; g.isWall = isWall; g.zoneAt = M.zoneAt; g.map = M; g.decals = []; g.chat = [];
    g.wall = (x, y) => isWall(x, y) || props.some((q) => q.r > 0.25 && Math.floor(q.x) === x && Math.floor(q.y) === y); // (for the bots' paths: walls and the bigger props)
    g.step = (x0, y0, x1, y1) => !g.wall(x1, y1) && hAt(x1, y1) - hAt(x0, y0) <= STEP + 0.01 && roofAt(x1, y1) - hAt(x1, y1) >= STAND; // (a bot can walk from one cell to the next)
    // the sites (their open cells, a centre to stand on), the spawns, the ways and posts the bots know
    const free = (x, y) => { let best = null; let bd = 1e9; for (let yy = 0; yy < MH; yy += 1) for (let xx = 0; xx < MW; xx += 1) { if (g.wall(xx, yy) || matAt(xx, yy) === 'k') continue; const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); if (d < bd) { bd = d; best = [xx + 0.5, yy + 0.5]; } } return best; };
    ['A', 'B'].forEach((n) => { const [x0, y0, x1, y1] = M.SITES[n]; const cs = []; for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (!isWall(x, y) && matAt(x, y) !== 'k') cs.push([x + 0.5, y + 0.5]); g.sites.push({ name: n, cells: cs, c: free((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2) }); });
    g.spawns = M.SPAWNS;
    g.lanes = [M.LANES.A.map((l) => l[0]), M.LANES.B.map((l) => l[0])];
    g.posts.def = [...M.POSTS.A, ...M.POSTS.B, ...M.POSTS.mid].map(([at]) => free(...at));
    // the sides: the visitor and four bots against five
    g.player = newActor('def', 0, false, 'You'); g.actors.push(g.player);
    const NAMES = ['Aymeric', 'Bertrand', 'Clotilde', 'Driss', 'Enguerrand', 'Fulk', 'Gersende', 'Hugues', 'Isabeau', 'Jehan'];
    for (let k = 1; k < 5; k += 1) g.actors.push(newActor('def', k, true, NAMES[k - 1]));
    for (let k = 0; k < 5; k += 1) g.actors.push(newActor('att', k, true, NAMES[k + 4]));
    [W, H] = QUALITY[settings.quality ?? 1];
    build(); prepCells(); prepProps(); prepLight(); prepSky(); bind(); newRound(true);
    let last = performance.now();
    const loop = (t) => { raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t; if (!g.paused) { g.now += dt; update(dt); } const r0 = performance.now(); render(); autoQuality(performance.now() - r0); hud(); };
    raf = requestAnimationFrame(loop); document.documentElement.classList.add('siege-on'); // (the castle behind stops drawing)
    say('Siege. Defend the two sites, A and B, from the keg. Click to take the mouse; B to buy; Esc to pause.', 6);
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; if (document.pointerLockElement) document.exitPointerLock(); document.documentElement.classList.remove('siege-on');
    unbind(); if (root) root.remove(); root = null; g = null; if (audio) { audio.close(); audio = null; }
  }

  /* ---- rounds and money (after the tactical shooters' rules, in crowns) ---- */
  const START_MONEY = 800; const MAX_MONEY = 16000; const ROUND_S = 115; const KEG_S = 40; const BUY_S = 7;
  const KILL_REWARD = { knife: 1500, wheellock: 300, pepperbox: 300, blunderbuss: 900, repeater: 600, arquebus: 300, caliver: 300, greatbow: 100, he: 300, fire: 300 };
  function newRound(first) {
    if (g.self) { g.player.isBot = true; g.player.controlled = false; g.player = g.self; g.self = null; } // (back to yourself)
    g.actors.forEach((a) => { a.dmgBy = {}; a.roundKills = 0; }); g.death = null; g.roundStart = g.now;
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
      Object.assign(a, { x: s[0], y: s[1], z: hAt(Math.floor(s[0]), Math.floor(s[1])), ground: hAt(Math.floor(s[0]), Math.floor(s[1])), vz: 0, vx: 0, vy: 0, hp: 100, alive: true, blindUntil: 0, reloadUntil: 0, shotN: 0, ai: {}, a: a.team === 'def' ? Math.PI / 2 : -Math.PI / 2 });
      Object.keys(ARMS.W).forEach((id) => { if (ARMS.W[id].mag) a.ammo[id] = { mag: ARMS.W[id].mag, res: ARMS.W[id].mag * 3 }; });
      a.slot = a.weapons[1] ? 1 : 2;
      if (a.isBot) BOTS.buy(a, g);
    });
    g.attSite = Math.random() < 0.5 ? 0 : 1;
    const atts = g.actors.filter((a) => a.team === 'att'); const carrier = atts[Math.floor(Math.random() * atts.length)];
    g.keg = { carrier, planted: false, dropped: false, x: 0, y: 0, plantP: 0, defuseP: 0, until: 0, beepAt: 0 };
    g.nades = []; g.smokes = []; g.fires = []; g.fx = []; g.decals = []; g.drops = []; g.pinAt = -1;
    g.phase = 'buy'; g.phaseUntil = g.now + BUY_S; g.frozen = true; g.warned = false;
    if (carrier === g.player) say('You carry the keg.', 3);
  }
  function endRound(winner, why) {
    if (g.phase === 'over') return; BOTS.roundOver(g, winner);
    g.phase = 'over'; g.phaseUntil = g.now + 5; g.score[winner] += 1;
    const loser = winner === 'def' ? 'att' : 'def';
    g.lossStreak[winner] = 0; g.lossStreak[loser] = Math.min(4, g.lossStreak[loser] + 1);
    g.actors.forEach((a) => { a.money = Math.min(MAX_MONEY, a.money + (a.team === winner ? (why === 'keg' || why === 'defused' ? 3500 : 3250) : 1400 + 500 * (g.lossStreak[loser] - 1) + (loser === 'att' && g.keg.planted ? 800 : 0))); });
    const mine = winner === g.player.team; g.history ||= []; g.history.push({ winner, why });
    const team = g.actors.filter((a) => a.team === winner); const mvp = team.reduce((b, a) => ((a.roundKills || 0) + (a === g.keg.planter || a === g.keg.defuser ? 1.5 : 0) > (b.roundKills || 0) + (b === g.keg.planter || b === g.keg.defuser ? 1.5 : 0) ? a : b), team[0]); mvp.mvps = (mvp.mvps || 0) + 1;
    g.banner = { mvp: mvp.name, t: g.now, team: winner, mine, text: winner === 'def' ? 'The defenders win' : 'The attackers win', sub: { elim: 'every one of the other side down', time: 'time ran out', keg: 'the keg went up', defused: 'the keg defused' }[why] };
    sfx(mine ? 'win' : 'lose');
    if (g.score[winner] >= 8) { g.matchOver = winner; setTimeout(() => { if (g && g.matchOver) matchEnd(); }, 3500); }
  }
  function say(t, s = 3) { g.msg = t; g.msgUntil = g.now + s; }

  /* ---- bodies among the heights: a circle of radius R standing at z; it fits where no cell under it rises
     above its feet by more than a step (or a roof comes below its head) and no prop is in the way ---- */
  const R = 0.22;
  const under = (x, y, r) => [[Math.floor(x - r), Math.floor(y - r)], [Math.floor(x + r), Math.floor(y - r)], [Math.floor(x - r), Math.floor(y + r)], [Math.floor(x + r), Math.floor(y + r)]];
  /** The highest support (a floor, a crate's top, a barrel's) under the circle at (x, y) no higher than z + up. */
  function groundAt(x, y, z, up = STEP, r = R) {
    let best = -9; for (const [cx, cy] of under(x, y, r)) { const h = hAt(cx, cy); if (h <= z + up && h > best) best = h; }
    for (const q of props) if (q.top <= z + up && q.top > best && Math.hypot(q.x - x, q.y - y) < q.r + r) best = q.top;
    return best;
  }
  function fits(x, y, z, bh, up = STEP, r = R) {
    for (const [cx, cy] of under(x, y, r)) if (hAt(cx, cy) > z + up || roofAt(cx, cy) < z + bh) return false;
    for (const q of props) if (q.top > z + up && Math.hypot(q.x - x, q.y - y) < q.r + r) return false;
    return true;
  }
  const ceilingAt = (x, y, r = R) => Math.min(...under(x, y, r).map(([cx, cy]) => roofAt(cx, cy)));
  /* Moving, after the Source engine: friction on the ground, then acceleration towards the wished way (strong
     on the ground; in the air capped low but quick, so a jump can be steered), gravity, steps up and down,
     landing (a hard one hurts). Speeds in units a second (a man runs 3.4: the knife's pace). */
  const MAXV = 3.4; const ACCEL = 5.5; const AIR_ACCEL = 12; const AIR_CAP = 0.42; const FRICTION = 5.2; const STOPV = 1.2;
  function move(a, wx, wy, dt, speedK = 1) {
    const w = ARMS.W[cur(a)]; const onGround = a.z <= (a.ground ?? 0) + 1e-3 && a.vz <= 0;
    const max = MAXV * (w.speed || 1) * speedK * (a.crouch ? 0.34 : 1) * (a.scoped ? 0.6 : 1) * (g.now < (a.tagUntil || 0) ? 0.5 : 1) * (a.planting || a.defusing ? 0 : 1);
    if (onGround) { const sp = Math.hypot(a.vx, a.vy); if (sp > 0) { const k = Math.max(0, sp - Math.max(sp, STOPV) * FRICTION * dt) / sp; a.vx *= k; a.vy *= k; } }
    const n = Math.hypot(wx, wy);
    if (n > 0 && max > 0) { const dx = wx / n; const dy = wy / n; const wish = onGround ? max : Math.min(max, AIR_CAP); const add = wish - (a.vx * dx + a.vy * dy);
      if (add > 0) { const acc = Math.min((onGround ? ACCEL : AIR_ACCEL) * dt * max, add); a.vx += acc * dx; a.vy += acc * dy; } }
    const bh = a.crouch ? CROUCH : STAND; const up = onGround ? STEP : a.crouch ? 0.12 : 0.02; // (in the air, a tucked crouch clears a little more)
    const nx = a.x + a.vx * dt; if (fits(nx, a.y, a.z, bh, up)) a.x = nx; else a.vx = 0;
    const ny = a.y + a.vy * dt; if (fits(a.x, ny, a.z, bh, up)) a.y = ny; else a.vy = 0;
    a.ground = groundAt(a.x, a.y, a.z, up);
    if (onGround && a.z - a.ground <= STEP + 0.01 && a.vz <= 0) a.z = a.ground; // (up a step, or down one: kept to the ground)
    else { // in the air
      a.vz -= GRAV * dt; a.z += a.vz * dt; const ceil = ceilingAt(a.x, a.y); if (a.z + bh > ceil) { a.z = ceil - bh; a.vz = Math.min(0, a.vz); }
      a.ground = groundAt(a.x, a.y, Math.max(a.z, a.ground), up);
      if (a.z <= a.ground) { const impact = -a.vz; a.z = a.ground; a.vz = 0; a.landAt = g.now; a.landV = impact; if (impact > 6.4) damage(a, (impact - 6.4) * 30, 1, false, null, 'fall'); if (impact > 2) { noise(a, 9); if (a === g.player) sfx('land'); } }
    }
    a.moving = Math.hypot(a.vx, a.vy) > 0.6; a.stride = ((a.stride || 0) + Math.hypot(a.vx, a.vy) * dt * 2.7) % 6.2832;
    if (a.moving && onGround && !a.crouch && !(a === g.player && held('walk')) && !(a.isBot && speedK < 0.6)) { a.stepAt ||= 0; if (g.now > a.stepAt) { a.stepAt = g.now + 0.36; noise(a, 7); sfx('step', a); } }
  }
  function jump(a) { if (a.z <= (a.ground ?? 0) + 1e-3 && a.vz <= 0 && !g.frozen) { a.vz = JUMP_V; a.z += 0.001; noise(a, 6); } }
  function noise(a, r) { g.noises.push({ x: a.x, y: a.y, t: g.now, r, team: a.team }); if (g.noises.length > 60) g.noises.splice(0, 20); }

  /* ---- seeing and shooting: rays in three dimensions through the cells ---- */
  /** Where a ray from (x, y, z) along the unit vector (dx, dy, dz) first meets a cell's solid (rising above it at a side, its
      floor or top below it, a roof above it) within maxD: { d, cx, cy, n ('side', 'top', 'roof') }, or null. skip(cx, cy): a cell let through. */
  function trace(x, y, z, dx, dy, dz, maxD = 60, skip = null) {
    let cx = Math.floor(x); let cy = Math.floor(y); const ddx = dx ? Math.abs(1 / dx) : 1e30; const ddy = dy ? Math.abs(1 / dy) : 1e30; const sx = dx < 0 ? -1 : 1; const sy = dy < 0 ? -1 : 1;
    let tX = (dx < 0 ? x - cx : cx + 1 - x) * ddx; let tY = (dy < 0 ? y - cy : cy + 1 - y) * ddy; let t0 = 0;
    for (let k = 0; k < 200; k += 1) {
      const t1 = Math.min(tX, tY, maxD); const h = hAt(cx, cy); const rf = roofAt(cx, cy); const zA = z + dz * t0; const zB = z + dz * t1; const free = skip && skip(cx, cy);
      if (!free) {
        if (zA < h - 1e-6) return { d: t0, cx, cy, n: 'side' };
        if (zB < h) return { d: (h - z) / dz, cx, cy, n: 'top' };
        if (zA > rf + 1e-6) return { d: t0, cx, cy, n: 'side' };
        if (zB > rf) return { d: (rf - z) / dz, cx, cy, n: 'roof' };
      }
      if (t1 >= maxD) return null;
      t0 = t1; if (tX < tY) { tX += ddx; cx += sx; } else { tY += ddy; cy += sy; }
    }
    return null;
  }
  /** Whether nothing solid stands between two points. */
  function clear(x0, y0, z0, x1, y1, z1) { const dx = x1 - x0; const dy = y1 - y0; const dz = z1 - z0; const d = Math.hypot(dx, dy, dz) || 1e-6; return !trace(x0, y0, z0, dx / d, dy / d, dz / d, d - 0.02); }
  const eyeOf = (a) => a.z + (a.crouch ? 0.45 : 0.62);
  const smokeHides = (ax, ay, bx, by) => g.smokes.some((s) => { if (g.now > s.until) return false; const vx = bx - ax; const vy = by - ay; const L2 = vx * vx + vy * vy || 1; const t = clamp(((s.x - ax) * vx + (s.y - ay) * vy) / L2, 0, 1); return Math.hypot(ax + vx * t - s.x, ay + vy * t - s.y) < s.r * Math.min(1, (g.now - s.t0) / 1.5); });
  /** Whether a sees b: its head or its chest, through no wall and no smoke. */
  function sees(a, b) { if (smokeHides(a.x, a.y, b.x, b.y)) return false; const e = eyeOf(a); const top = b.z + (b.crouch ? CROUCH : STAND); return clear(a.x, a.y, e, b.x, b.y, top - 0.08) || clear(a.x, a.y, e, b.x, b.y, top - 0.38); }
  function damage(t, dmg, pierce, head, by, wid) {
    if (!t.alive) return;
    const armoured = t.armour > 0 && (!head || t.helm);
    let d = dmg; if (armoured) { const taken = d * pierce; t.armour = Math.max(0, t.armour - (d - taken) * 0.5); d = taken; }
    if (by && by !== t) { const real = Math.min(d, t.hp); t.dmgBy ||= {}; const e = (t.dmgBy[by.name] ||= { dmg: 0, hits: 0, by }); e.dmg += real; e.hits += 1; by.dmgTotal = (by.dmgTotal || 0) + (by.team !== t.team ? real : 0); if (head && by.team !== t.team) by.hsHits = (by.hsHits || 0) + 1; }
    t.hp -= d; t.hitAt = g.now; if (t === g.player) { g.hurtAt = g.now; g.hurtFrom = by ? Math.atan2(by.y - t.y, by.x - t.x) : null; }
    if (head) sfx(t.helm ? 'tink' : 'thud', t);
    if (t.hp <= 0) { t.diedAt = g.now; t.fallDir = by && Math.cos(t.a) * (by.x - t.x) + Math.sin(t.a) * (by.y - t.y) < 0 ? -1 : 1;
      t.alive = false; t.hp = 0; t.deaths += 1;
      if (by === g.player && by.team !== t.team) sfx('kill'); if (by && by.team !== t.team) { by.kills += 1; by.roundKills = (by.roundKills || 0) + 1; if (head) by.hsKills = (by.hsKills || 0) + 1; by.money = Math.min(MAX_MONEY, by.money + (KILL_REWARD[wid] || 300)); }
      Object.values(t.dmgBy || {}).forEach((e) => { if (e.by !== by && e.by.team !== t.team && e.dmg >= 41) e.by.assists = (e.by.assists || 0) + 1; }); // (41 or more of his health taken: an assist)
      if (t === g.player) g.death = { by: by ? by.name : '', byTeam: by ? by.team : '', wid, head, hpLeft: by && by.alive ? Math.ceil(by.hp) : 0, t: g.now, report: damageReport(t) };
      g.feed.unshift({ by: by ? by.name : '', byTeam: by ? by.team : '', w: wid, head, who: t.name, team: t.team, t: g.now }); g.feed.length = Math.min(6, g.feed.length);
      if (g.keg.carrier === t && !g.keg.planted) dropKeg(t, false);
      if (t.weapons[1]) dropWeapon(t, 1, false); else if (t.weapons[2] && t.weapons[2] !== 'wheellock') dropWeapon(t, 2, false); // (what he carried falls with him)
      if (t === g.player) { g.scoped = false; say('You fell. The round goes on without you.', 3); }
      checkElim();
    }
  }
  /** What you gave each enemy this round and what each gave you (hits, health). */
  function damageReport(me) { return g.actors.filter((o) => o.team !== me.team).map((o) => { const gave = (o.dmgBy || {})[me.name]; const took = (me.dmgBy || {})[o.name]; return { name: o.name, gave: gave ? [Math.round(gave.dmg), gave.hits] : null, took: took ? [Math.round(took.dmg), took.hits] : null }; }).filter((r) => r.gave || r.took); }
  function checkElim() {
    if (g.phase === 'over') return;
    const alive = (team) => g.actors.some((a) => a.alive && a.team === team);
    if (!alive('att') && !g.keg.planted) endRound('def', 'elim');
    else if (!alive('def')) endRound('att', 'elim');
  }
  /** A shot by actor a along (yaw, pitch); the actors it can hit: the first in the line, before any wall. */
  /** A shot by actor a along (yaw, pitch): the first enemy in the line (a standing cylinder, its head the top 0.15) before a wall;
      the wood of crates and houses lets a rifle's shot through, weakened (w.pen: how much it keeps). */
  function hitscan(a, yaw, pitch, w, wid) {
    const ex0 = a.x; const ey0 = a.y; const ez0 = eyeOf(a); const dx = Math.cos(yaw) * Math.cos(pitch); const dy = Math.sin(yaw) * Math.cos(pitch); const dz = Math.sin(pitch);
    let wall = trace(ex0, ey0, ez0, dx, dy, dz, 60); let keep = 1; let through = null;
    if (wall && w.pen && M.LEGEND[matAt(wall.cx, wall.cy)].wood) { const cell = [wall.cx, wall.cy]; const on = trace(ex0, ey0, ez0, dx, dy, dz, 60, (cx, cy) => cx === cell[0] && cy === cell[1]); through = wall; wall = on; keep = w.pen; }
    const wd = wall ? wall.d : 60; let best = null; let bd = wd;
    g.actors.forEach((o) => {
      if (o === a || !o.alive || o.team === a.team) return;
      const vx = o.x - ex0; const vy = o.y - ey0; const h2 = Math.hypot(dx, dy) || 1e-6; const along = (vx * dx + vy * dy) / (h2 * h2); // (t along the ray where it passes nearest the axis)
      if (along <= 0) return; const off = Math.abs(vx * dy - vy * dx) / h2; if (off > 0.24) return;
      const t = along - Math.sqrt(Math.max(0, 0.0576 - off * off)) / h2; if (t >= bd) return; const hz = ez0 + dz * t; const top = o.z + (o.crouch ? CROUCH : STAND); if (hz < o.z || hz > top) return;
      best = { o, head: hz > top - 0.15, d: t, z: hz, thin: through && t > through.d }; bd = t;
    });
    if (best && smokeHides(ex0, ey0, ex0 + dx * bd, ey0 + dy * bd) && best.d > 2) best = null; // (a shot into smoke: no telling where it goes)
    const end = best ? best.d : wd - 0.03; const ex = ex0 + dx * end; const ey = ey0 + dy * end; const ez = ez0 + dz * end;
    g.fx.push({ kind: 'trail', x0: ex0 + dx * 0.4, y0: ey0 + dy * 0.4, z0: ez0 - 0.08, x1: ex, y1: ey, z1: ez, t: g.now });
    const burst = (kind, n, sp, X = ex, Y = ey, Z = ez) => ({ kind, t: g.now, parts: Array.from({ length: n }, () => ({ x: X, y: Y, z: Z, vx: (Math.random() - 0.5) * sp - dx * sp * 0.4, vy: (Math.random() - 0.5) * sp - dy * sp * 0.4, vz: Math.random() * sp })) });
    if (through) { const t2 = through.d; g.fx.push(burst('splinter', 6, 2.5, ex0 + dx * t2, ey0 + dy * t2, ez0 + dz * t2)); decal(ex0 + dx * t2, ey0 + dy * t2, ez0 + dz * t2, 'hole'); }
    if (best) { g.fx.push(burst('blood', 10, 2.2)); if (a === g.player) { g.hitMarkAt = g.now; g.hitHead = best.head; sfx(best.head ? 'tink' : 'hit'); }
      const dmg = w.dmg * (best.head ? w.head : 1) * (1 - (w.fall || 0)) ** (best.d / 10) * (best.thin ? keep : 1);
      best.o.tagUntil = g.now + 0.35; if (Math.random() < 0.5) decal(best.o.x + dx * 0.6, best.o.y + dy * 0.6, best.o.z, 'blood');
      damage(best.o, dmg, w.pierce ?? 1, best.head, a, wid); }
    else if (wall) { g.fx.push(burst('spark', 7, 3)); decal(ex, ey, ez, 'hole'); } // (stone chips, a spark, a hole)
    return best;
  }
  /** A mark where a shot struck (a hole: just off the surface it hit) or blood fell (on the floor below); the oldest go. */
  function decal(x, y, z, kind) { const d = { x, y, z, kind }; if (kind === 'blood') d.z = hAt(Math.floor(x), Math.floor(y)) + 0.01; g.decals.push(d); if (g.decals.length > 220) g.decals.shift(); }
  /** The spread (degrees) of a's next shot: the weapon's own, more when moving faster than a third of full pace (stopped,
      or counter-strafed, the first shot goes true), much more in the air, a little just after landing; less crouched. */
  function spreadOf(a, w) {
    const sp = Math.hypot(a.vx, a.vy); const mv = clamp((sp / (MAXV * (w.speed || 1)) - 0.34) / 0.66, 0, 1); const air = a.z > (a.ground ?? a.z) + 0.03;
    let s = (w.spread || 0) + (w.mspread || 0) * mv + (air ? 8 : 0) + (g.now - (a.landAt || -9) < 0.3 ? 1.5 : 0);
    if (a.crouch && !air) s *= 0.7; if (w.scoped && a.scoped) s = w.scoped + (w.mspread || 0) * mv * 0.6 + (air ? 8 : 0);
    return s;
  }
  /** Fire the current weapon of actor a (the visitor: the aim; a bot: at target with an aim error, degrees). */
  function shoot(a, target) {
    const wid = cur(a); const w = ARMS.W[wid]; if (g.frozen || !a.alive || g.now < a.reloadUntil) return;
    if (g.now - a.lastShot < 1 / w.rate) return;
    if (w.melee) { a.lastShot = g.now; if (a === g.player) { g.swing = 0; g.heavySwing = held('attack2'); if (!g.heavySwing) g.swingSide = -(g.swingSide || 1); sfx('swish'); } stab(a, target); return; }
    const am = a.ammo[wid]; if (!am || am.mag <= 0) { reload(a); return; }
    am.mag -= 1; a.shotsAll = (a.shotsAll || 0) + 1; if (g.now - a.lastShot > 0.45) a.shotN = 0; a.lastShot = g.now; noise(a, 18); sfx('shot', a, wid);
    const rec = w.recoil[Math.min(a.shotN, w.recoil.length - 1)]; a.shotN += 1;
    const deg = Math.PI / 180; const pellets = w.pellets || 1;
    for (let p = 0; p < pellets; p += 1) {
      const s = spreadOf(a, w) * (Math.random() + Math.random() - 1);
      const s2 = spreadOf(a, w) * (Math.random() + Math.random() - 1);
      if (a === g.player) hitscan(a, a.a + (rec[0] + s) * deg, g.pitch + (rec[1] * 0.9 + s2 * 0.6) * deg, w, wid);
      else { // a bot: along its own aim, its spread as anyone's (it stops to shoot well), the recoil part controlled
        const ctrl = (BOTS.DIFF[g.difficulty] || BOTS.DIFF.normal).ctrl;
        hitscan(a, a.a + (rec[0] * (1 - ctrl) + s) * deg, (a.aimPitch || 0) + (rec[1] * 0.9 * (1 - ctrl) + s2 * 0.6) * deg, w, wid);
      }
    }
    if (a === g.player) { g.punch += rec[1] * 0.012 + 0.004; g.kick = 1; g.flashFrame = true; if (am.mag === 0) reload(a); }
    if (am.mag === 0 && a.isBot) reload(a);
  }
  function stab(a, target) {
    const t = target || g.actors.find((o) => o.alive && o.team !== a.team && Math.hypot(o.x - a.x, o.y - a.y) < 1.1 && Math.abs(wrap(Math.atan2(o.y - a.y, o.x - a.x) - a.a)) < 0.6);
    if (!t || Math.hypot(t.x - a.x, t.y - a.y) > 1.1) return;
    const back = Math.abs(wrap(t.a - Math.atan2(t.y - a.y, t.x - a.x))) < 0.8; const heavy = a === g.player && held('attack2');
    damage(t, back ? (heavy ? 180 : 90) : heavy ? 65 : 34, 0.85, false, a, 'knife'); sfx('stab', t);
  }
  function reload(a) {
    const wid = cur(a); const w = ARMS.W[wid]; const am = a.ammo[wid]; if (!w.mag || !am || am.res <= 0 || am.mag === w.mag || g.now < a.reloadUntil) return;
    a.reloadUntil = g.now + w.reload; a.reloadId = wid; sfx('reload', a); // (done in update, on the game's clock)
  }

  /* ---- weapons and the keg on the ground: dropped (thrown a little), fallen with the dead; picked up by walking over them
     when that slot is free (an attacker over the keg), or swapped with Use when looked at ---- */
  function dropWeapon(a, slot, toss) {
    const id = a.weapons[slot]; if (!id || id === 'knife') return; const c = Math.cos(a.a); const sn = Math.sin(a.a); const v = toss ? 3.2 : 0.6;
    g.drops.push({ id, ammo: { ...(a.ammo[id] || {}) }, x: a.x + c * 0.25, y: a.y + sn * 0.25, z: a.z + 0.55, vx: c * v + a.vx * 0.5, vy: sn * v + a.vy * 0.5, vz: toss ? 1.6 : 0, a: a.a + (Math.random() - 0.5), t: g.now, by: a });
    a.weapons[slot] = null; if (a.slot === slot) { a.slot = a.weapons[1] ? 1 : a.weapons[2] ? 2 : 3; if (a === g.player) { g.drawAt = g.now; g.slotAt = g.now; } } if (toss) sfx('throw', a);
  }
  function dropKeg(a, toss) {
    const k = g.keg; if (k.carrier !== a) return; const c = Math.cos(a.a); const sn = Math.sin(a.a);
    Object.assign(k, { carrier: null, dropped: true, x: a.x + c * (toss ? 0.8 : 0.1), y: a.y + sn * (toss ? 0.8 : 0.1), z: a.z, a: a.a, droppedAt: g.now });
    if (a.slot === 5) a.slot = a.weapons[1] ? 1 : a.weapons[2] ? 2 : 3; if (a === g.player && toss) say('You drop the keg.', 2);
  }
  function updateDrops(dt) {
    g.drops.forEach((d) => { // they fall, slide, and settle
      if (d.vz !== 0 || d.z > hAt(Math.floor(d.x), Math.floor(d.y)) + 0.01) { d.vz -= GRAV * dt; const nx = d.x + d.vx * dt; const ny = d.y + d.vy * dt; if (hAt(Math.floor(nx), Math.floor(d.y)) <= d.z) d.x = nx; else d.vx *= -0.3; if (hAt(Math.floor(d.x), Math.floor(ny)) <= d.z) d.y = ny; else d.vy *= -0.3;
        d.z += d.vz * dt; const fl = hAt(Math.floor(d.x), Math.floor(d.y)); if (d.z <= fl) { d.z = fl; d.vz = Math.abs(d.vz) > 1 ? -d.vz * 0.3 : 0; d.vx *= 0.5; d.vy *= 0.5; } }
    });
    const k = g.keg;
    g.actors.forEach((a) => {
      if (!a.alive) return;
      if (k.dropped && a.team === 'att' && Math.hypot(k.x - a.x, k.y - a.y) < 0.6 && Math.abs(k.z - a.z) < 0.6 && g.now - (k.droppedAt || -9) > (a === g.player ? 1 : 0.3)) { k.dropped = false; k.carrier = a; if (a === g.player) say('You pick up the keg.', 2); }
      for (let i = g.drops.length - 1; i >= 0; i -= 1) { const d = g.drops[i]; const w = ARMS.W[d.id]; if (a.weapons[w.slot] || g.now - d.t < (d.by === a ? 1.2 : 0.4) || Math.hypot(d.x - a.x, d.y - a.y) > 0.6 || Math.abs(d.z - a.z) > 0.6) continue;
        a.weapons[w.slot] = d.id; a.ammo[d.id] = { mag: d.ammo.mag ?? w.mag, res: d.ammo.res ?? w.mag * 3 }; g.drops.splice(i, 1); if (a === g.player) { sfx('draw'); g.slotAt = g.now; } }
    });
  }
  /** Use, looking at a weapon on the ground within reach: take it, dropping the one in its slot. */
  function pickUpFacing(a) {
    let best = null; let bd = 1.6; g.drops.forEach((d) => { const dd = Math.hypot(d.x - a.x, d.y - a.y); if (dd > bd) return; const off = Math.abs(wrap(Math.atan2(d.y - a.y, d.x - a.x) - a.a)); if (off < 0.5 + 0.3 / Math.max(0.3, dd)) { best = d; bd = dd; } });
    if (!best) return; const w = ARMS.W[best.id]; if (a.weapons[w.slot]) dropWeapon(a, w.slot, false); g.drops.splice(g.drops.indexOf(best), 1);
    a.weapons[w.slot] = best.id; a.ammo[best.id] = { mag: best.ammo.mag ?? w.mag, res: best.ammo.res ?? w.mag * 3 }; a.slot = w.slot; if (a === g.player) { g.drawAt = g.now; g.slotAt = g.now; sfx('draw'); }
  }
  /** Fallen, watching a bot of your side: take it over for the rest of the round (its weapons, its money). */
  function takeOver() {
    const v = camActor(); if (v === g.player || !v.isBot || !v.alive) return;
    g.self ||= g.player; v.isBot = false; v.controlled = true; g.player = v; g.pitch = 0; g.drawAt = g.now; say(`You take over ${v.name}.`, 2.5); sfx('draw');
  }

  /* ---- the keg ---- */
  const onSite = (a) => { const k = g.sites.findIndex((s) => s.cells.some(([x, y]) => Math.floor(x) === Math.floor(a.x) && Math.floor(y) === Math.floor(a.y))); return k < 0 ? null : k; };
  function plant(a, dt) {
    const k = g.keg; if (k.planted || k.carrier !== a || onSite(a) === null || g.phase !== 'live') return;
    k.plantP += dt / 3.2; a.vx = 0; a.vy = 0; a.planting = true; if (Math.random() < dt * 3) sfx('click', a);
    if (k.plantP >= 1) { Object.assign(k, { planted: true, carrier: null, planter: a, x: a.x + Math.cos(a.a) * 0.3, y: a.y + Math.sin(a.a) * 0.3, z: a.z, a: a.a, until: g.now + KEG_S, site: onSite(a), beepAt: g.now }); g.phase = 'planted'; a.money += 300; say(`The keg is planted on ${g.sites[k.site].name}.`, 4); sfx('planted'); }
  }
  function defuse(a, dt) {
    const k = g.keg; if (!k.planted || Math.hypot(k.x - a.x, k.y - a.y) > 1 || g.phase !== 'planted') return;
    k.defuser = a; k.defuseP += dt / (a.tools ? 5 : 10); a.vx = 0; a.vy = 0; a.defusing = true; if (Math.random() < dt * 5) sfx('defusing', a); if (Math.random() < dt * 4) sfx('click', a);
    if (k.defuseP >= 1) { k.planted = false; k.defused = true; sfx('defused', k); endRound('def', 'defused'); }
  }

  /* ---- thrown things: bounce off walls and floor, then go off ---- */
  /* ---- thrown things: they fly, bounce off walls, floors and roofs (losing speed), roll, then go off ---- */
  /** Throw: power 1 (a full throw), 0.5 (a lob, underhand), 0.75 (both buttons); a bot throws at a point (target: { x, y }). */
  function throwIt(a, kind, target, power = 1) {
    if (!a.gear[kind] || g.frozen) return false;
    a.gear[kind] -= 1; let yaw = a.a; let up = 0.3 + (a === g.player ? g.pitch : 0); let sp = 10 * power;
    if (a !== g.player && target) { yaw = Math.atan2(target.y - a.y, target.x - a.x); const d = Math.hypot(target.x - a.x, target.y - a.y); up = 0.62; sp = clamp(Math.sqrt((d * 18) / Math.sin(2 * up)) * 0.92, 4, 11); } // (a lob that lands near it)
    const z = eyeOf(a) - 0.05; g.nades.push({ kind, x: a.x + Math.cos(yaw) * 0.25, y: a.y + Math.sin(yaw) * 0.25, z, vx: Math.cos(yaw) * sp * Math.cos(up) + a.vx * 0.6, vy: Math.sin(yaw) * sp * Math.cos(up) + a.vy * 0.6, vz: sp * Math.sin(up), t0: g.now, by: a, spin: Math.random() * 6 });
    sfx('throw', a); if (a === g.player) { g.throwAt = g.now; g.throwKind = kind; } return true;
  }
  function updateNades(dt) {
    const steps = 3; const h = dt / steps;
    g.nades = g.nades.filter((n) => {
      for (let k = 0; k < steps; k += 1) {
        n.vz -= 18 * h; const nx = n.x + n.vx * h; const ny = n.y + n.vy * h; const nz = n.z + n.vz * h;
        const solid = (x, y, z) => z < hAt(Math.floor(x), Math.floor(y)) || z > roofAt(Math.floor(x), Math.floor(y));
        if (solid(nx, n.y, n.z)) { n.vx *= -0.45; n.vy *= 0.8; sfx('clink', n); } else n.x = nx;
        if (solid(n.x, ny, n.z)) { n.vy *= -0.45; n.vx *= 0.8; sfx('clink', n); } else n.y = ny;
        const fl = hAt(Math.floor(n.x), Math.floor(n.y)); const rf = roofAt(Math.floor(n.x), Math.floor(n.y));
        if (nz < fl) { n.z = fl; if (n.vz < -1.5) sfx('clink', n); n.vz = Math.abs(n.vz) > 1.5 ? -n.vz * 0.38 : 0; n.vx *= 0.72; n.vy *= 0.72; if (n.kind === 'fire') { goOff(n); return false; } }
        else if (nz > rf) { n.z = rf - 0.01; n.vz = -Math.abs(n.vz) * 0.3; } else n.z = nz;
        if (n.z <= fl + 1e-3) { n.vx *= 1 - 2.5 * h; n.vy *= 1 - 2.5 * h; } // (rolling, slowing)
      }
      const age = g.now - n.t0; const slow = Math.hypot(n.vx, n.vy) < 0.3 && n.z <= hAt(Math.floor(n.x), Math.floor(n.y)) + 0.01;
      if ((n.kind === 'he' && age > 1.6) || (n.kind === 'flash' && age > 1.5) || (n.kind === 'smoke' && ((slow && age > 0.8) || age > 3))) { goOff(n); return false; }
      return true;
    });
    g.smokes = g.smokes.filter((sm) => g.now < sm.until);
    g.fires = g.fires.filter((f) => { f.flames = f.flames.filter((q) => !g.smokes.some((sm) => Math.hypot(sm.x - q[0], sm.y - q[1]) < sm.r * Math.min(1, (g.now - sm.t0) / 1.5))); return g.now < f.until && f.flames.length; }); // (smoke puts fire out)
    g.fires.forEach((f) => g.actors.forEach((a) => { if (a.alive && a.z < f.z + 0.3 && f.flames.some((q) => Math.hypot(a.x - q[0], a.y - q[1]) < 0.42) && Math.random() < dt * 5) damage(a, 7, 1, false, f.by, 'fire'); }));
    g.fx = g.fx.filter((f) => g.now - f.t < (f.kind === 'debris' ? 1.6 : 0.9));
  }
  function goOff(n) {
    const at = { x: n.x, y: n.y }; const z0 = n.z + 0.1;
    if (n.kind === 'he') { sfx('boom', at); g.fx.push({ kind: 'blast', x: n.x, y: n.y, z: n.z, t: g.now }); g.fx.push({ kind: 'debris', t: g.now, parts: Array.from({ length: 24 }, () => ({ x: n.x, y: n.y, z: z0, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, vz: Math.random() * 5 })) });
      g.actors.forEach((a) => { const d = Math.hypot(a.x - n.x, a.y - n.y, (a.z + 0.4 - z0) * 1.5); if (a.alive && d < 3.6 && clear(n.x, n.y, z0, a.x, a.y, a.z + 0.5)) damage(a, 98 * (1 - d / 3.6) ** 1.3, 0.5, false, n.by, 'he'); }); noise(at, 25); shake(0.6, at); }
    if (n.kind === 'smoke') { g.smokes.push({ x: n.x, y: n.y, z: hAt(Math.floor(n.x), Math.floor(n.y)), r: 2.3, t0: g.now, until: g.now + 17 }); sfx('hiss', at); g.fires.forEach((f) => { f.flames = f.flames.filter((q) => Math.hypot(q[0] - n.x, q[1] - n.y) > 2.3); }); }
    if (n.kind === 'fire') { // the fire spreads over the floor it fell on, not up walls nor through them
      const fz = hAt(Math.floor(n.x), Math.floor(n.y)); const flames = [];
      for (let k = 0; k < 34; k += 1) { const q = k * 2.39996; const r = Math.sqrt(k / 34) * 1.9; const x = n.x + Math.cos(q) * r; const y = n.y + Math.sin(q) * r; if (Math.abs(hAt(Math.floor(x), Math.floor(y)) - fz) < 0.05 && clear(n.x, n.y, fz + 0.2, x, y, fz + 0.2)) flames.push([x, y, Math.random() * 6]); }
      if (!g.smokes.some((sm) => Math.hypot(sm.x - n.x, sm.y - n.y) < sm.r)) g.fires.push({ x: n.x, y: n.y, z: fz, flames, until: g.now + 7, by: n.by }); sfx('whoosh', at); }
    if (n.kind === 'flash') {
      sfx('flash', at);
      g.actors.forEach((a) => {
        if (!a.alive) return; const e = eyeOf(a); const d = Math.hypot(a.x - n.x, a.y - n.y); if (d > 18 || !clear(n.x, n.y, z0, a.x, a.y, e)) return;
        const facing = Math.cos(wrap(Math.atan2(n.y - a.y, n.x - a.x) - a.a)); const s2 = clamp((0.25 + 0.75 * Math.max(0, facing) ** 1.5) * (1 - d / 20) * 4.5, 0.2, 4.5);
        a.blindUntil = g.now + s2 * 0.9; if (a === g.player || a === camActor()) { if (a === g.player) { g.flashUntil = g.now + s2; g.flashAt = g.now; g.flashSnap = true; } }
      });
    }
  }
  function shake(k, at) { const p = g.player; const d = Math.hypot(at.x - p.x, at.y - p.y); g.shake = Math.max(g.shake || 0, k * clamp(1 - d / 10, 0, 1)); }

  /* ---- each frame ---- */
  function update(dt) {
    const p = g.player; g.actors.forEach((a) => { a.planting = false; a.defusing = false; });
    // the phases
    if (g.phase === 'buy' && g.now > g.phaseUntil) { g.phase = 'live'; g.phaseUntil = g.now + ROUND_S; g.frozen = false; closeBuy(); sfx('horn'); }
    if (g.phase === 'live' && !g.warned && g.phaseUntil - g.now < 10) { g.warned = true; sfx('warn'); }
    if (p.alive && p.hp <= 25 && g.now > (g.heartAt || 0)) { g.heartAt = g.now + 0.9; sfx('heart'); }
    else if (g.phase === 'live' && g.now > g.phaseUntil) endRound('def', 'time');
    else if (g.phase === 'planted') {
      const k = g.keg; const left = k.until - g.now; const every = clamp(left / 40, 0.12, 1);
      if (g.now > k.beepAt) { k.beepAt = g.now + every; sfx('beep', k); noise({ x: k.x, y: k.y, team: 'att' }, 30); }
      if (left <= 0) { sfx('bigboom', k); g.fx.push({ kind: 'blast', x: k.x, y: k.y, z: 0.4, t: g.now, big: true }); endRound('att', 'keg'); g.actors.forEach((a) => { const d = Math.hypot(a.x - k.x, a.y - k.y); if (a.alive && d < 12) damage(a, 500 * (1 - d / 12) ** 1.5, 1, false, null, 'keg'); }); }
      if (k.defuser && (!k.defuser.alive || Math.hypot(k.defuser.x - k.x, k.defuser.y - k.y) > 1)) { k.defuser = null; k.defuseP = 0; }
    } else if (g.phase === 'over' && g.now > g.phaseUntil && !g.matchOver) newRound(false);
    // the visitor
    if (p.alive) {
      const fwd = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0); const side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      p.crouch = held('crouch');
      const dx = Math.cos(p.a) * fwd + Math.cos(p.a + Math.PI / 2) * side; const dy = Math.sin(p.a) * fwd + Math.sin(p.a + Math.PI / 2) * side;
      p.wish = [dx, dy, held('walk') ? 0.52 : 1];
      const wid = cur(p); const w = ARMS.W[wid];
      if (w.keg || w.nade) { /* (the keg is planted by holding fire on a site; a throwable is thrown on letting go: see press and release) */ }
      else if (held('attack') && (w.auto || !p.heldShot)) { shoot(p); p.heldShot = true; }
      if (!held('attack')) p.heldShot = false;
      const planting = g.keg.carrier === p && (held('use') || (wid === 'keg' && held('attack'))) && onSite(p) !== null;
      if (planting) { if (p.slot !== 5) { g.lastSlot = p.slot; p.slot = 5; } plant(p, dt); } else if (g.keg.carrier === p) g.keg.plantP = 0;
      if (held('use') && g.keg.planted && Math.hypot(g.keg.x - p.x, g.keg.y - p.y) < 1) defuse(p, dt); else if (g.keg.defuser === p) { g.keg.defuseP = 0; g.keg.defuser = null; }
    }
    updateDrops(dt);
    g.punch *= Math.exp(-dt * 6); g.kick = Math.max(0, g.kick - dt * 7); g.sway *= Math.exp(-dt * 9); g.swayY = (g.swayY || 0) * Math.exp(-dt * 9); g.shake = (g.shake || 0) * Math.exp(-dt * 5);
    g.eyeH += ((p.crouch ? 0.45 : 0.62) - g.eyeH) * Math.min(1, dt * 12); g.bobT += dt * 9 * Math.min(1, Math.hypot(p.vx, p.vy) / 3.6) * (p.z > 0 ? 0 : 1);
    if (g.inspect >= 0) { g.inspect += dt / 2.4; if (g.inspect > 1) g.inspect = -1; }
    if (g.swing >= 0) { g.swing += dt * 4; if (g.swing > 1) g.swing = -1; }
    // reloads done
    g.actors.forEach((a) => { if (!a.reloadId || g.now < a.reloadUntil) return; const w = ARMS.W[a.reloadId]; const am = a.ammo[a.reloadId]; if (am && cur(a) === a.reloadId) { const n = Math.min(w.mag - am.mag, am.res); am.mag += n; am.res -= n; } a.reloadId = null; });
    // the bots
    g.actors.forEach((b) => { if (b.isBot) BOTS.think(b, g, dt); });
    // bodies: each moves as it wished (the visitor's keys, a bot's mind), falls, lands
    g.actors.forEach((a) => { if (!a.alive) return; const w = g.frozen || !a.wish ? [0, 0, 1] : a.wish; move(a, w[0], w[1], dt, w[2]); a.wish = null; });
    updateNades(dt);
  }
  // what the bots call
  const api = { move: (a, dx, dy, k = 1) => { a.wish = [dx, dy, k]; }, jump: (a) => jump(a), reload: (a) => reload(a), fire: (a, t) => shoot(a, t), plant, defuse, throw: throwIt, sees, onSite };

  /* ---- drawing ---- */
  /* Each cell's textures, found once: its top (floor), its sides (or a wall dressed for its place), the
     ceiling under its roof and the lintel where its roof begins; the tallest cell (to stop rays early). */
  const topTex = []; const sideTex = []; const ceilTex = []; let MAXH = 0;
  function prepCells() {
    for (let y = 0; y < MH; y += 1) for (let x = 0; x < MW; x += 1) { const c = y * MW + x; const L = M.LEGEND[M.MAT[y][x]];
      topTex[c] = texOf(L.top); sideTex[c] = texOf(M.DECOR[`${x},${y}`] || L.side); ceilTex[c] = texOf(L.ceil || 'oakPlanks'); [topTex[c], sideTex[c], ceilTex[c]].forEach(mipsOf); MAXH = Math.max(MAXH, M.h[c]); }
  }
  const FOG_D = 46; const SKY = [80, 136, 210]; const HAZE = [206, 214, 224];
  /* The light: a grid of four samples a cell, each [r, g, b] (1 = daylight in the yard's shade). Torches on
     the walls, found once with their shadows (a sample sees a torch, or not, through the grid); the light of
     the moment (shots, fires, blasts, the planted keg) added each frame without shadows. */
  const LR = 4; const LW = MW * LR; const LH = MH * LR; const lmStatic = new Float32Array(LW * LH * 3); const lm = new Float32Array(LW * LH * 3);
  const AMB = [0.62, 0.64, 0.7]; let torches = [];
  /* The light, a grid of four samples a cell (at each cell's own floor): the sky's light (dimmer under a roof), the
     sun's (where it reaches: a ray towards it, two of them for soft edges, so walls and towers cast their shadows
     across the yards), the torches' (with their shadows); the light of the moment added each frame. */
  const SUN = (() => { const az = 2.4; const el = 0.62; return [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)]; })();
  const SUNC = [0.62, 0.54, 0.4];
  function prepLight() {
    torches = [];
    for (let y = 1; y < MH - 1; y += 1) for (let x = 1; x < MW - 1; x += 1) { // a torch on a wall facing a floor: one in twelve outside, one in four under a roof
      const h = hAt(x, y); if (isWall(x, y) || (x * 7 + y * 13) % (roofAt(x, y) < 1e9 ? 4 : 12)) continue;
      const face = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dy]) => hAt(x + dx, y + dy) > h + 1.6 && matAt(x + dx, y + dy) !== 'k'); if (!face) continue;
      torches.push({ x: x + 0.5 + face[0] * 0.42, y: y + 0.5 + face[1] * 0.42, z: h + 1.15, ph: Math.random() * 6 });
    }
    for (let j = 0; j < LH; j += 1) for (let i = 0; i < LW; i += 1) {
      const sx = (i + 0.5) / LR; const sy = (j + 0.5) / LR; const cx = Math.floor(sx); const cy = Math.floor(sy); const o = (j * LW + i) * 3; const fz = hAt(cx, cy) + 0.05; const roofed = roofAt(cx, cy) < 1e9;
      let r = AMB[0] * (roofed ? 0.38 : 0.72); let gg = AMB[1] * (roofed ? 0.38 : 0.74); let b = AMB[2] * (roofed ? 0.42 : 0.82);
      if (!isWall(cx, cy)) { let sun = 0; for (const jit of [-0.04, 0.04]) if (!trace(sx, sy, fz, SUN[0] + jit, SUN[1] - jit, SUN[2], 40)) sun += 0.5; r += SUNC[0] * sun; gg += SUNC[1] * sun; b += SUNC[2] * sun; }
      torches.forEach((t) => { const d = Math.hypot(t.x - sx, t.y - sy); if (d > 6) return; if (d > 0.3 && !clear(t.x, t.y, t.z, sx, sy, fz + 0.1)) return; const k = (1 - d / 6) ** 2 * 1.2; r += k; gg += k * 0.72; b += k * 0.42; });
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
  function toScreen(x, y, z) { const c = cam; const rx = x - c.px; const ry = y - c.py; const ty = c.inv * (-c.plY * rx + c.plX * ry); if (ty < 0.05) return null; const tx = c.inv * (c.dirY * rx - c.dirX * ry); return [(W / 2) * (1 + tx / ty), c.hor + (c.eye - z) * c.F / ty, ty, c.F / ty]; }
  let rowInv = null; let worldT = null; let colBuf = null; let colZ = null;
  function render() {
    const me = g.player; const p = camActor(); const self = p === me; // (fallen: the eyes of a living one of your side)
    const eye = (self ? g.eyeH : p.crouch ? 0.45 : 0.62) + p.z; const fov = settings.fov * (self && p.scoped ? 0.25 : 1);
    const pl = Math.tan(fov / 2); const F = (W / 2) / pl; // (one focal length both ways: square pixels)
    const sh = g.shake > 0.01 ? (Math.random() - 0.5) * g.shake * 0.03 : 0;
    const hor = Math.floor(H / 2 + Math.tan(clamp((self ? g.pitch + g.punch : 0) + sh, -1.2, 1.2)) * F);
    const yaw = p.a + (self ? (g.shake > 0.01 ? (Math.random() - 0.5) * g.shake * 0.02 : 0) : 0);
    const dirX = Math.cos(yaw); const dirY = Math.sin(yaw); const plX = -dirY * pl; const plY = dirX * pl;
    cam = { px: p.x, py: p.y, dirX, dirY, plX, plY, pl, hor, eye, F, inv: 1 / (plX * dirY - dirX * plY) };
    lightFrame();
    if (!skyTex || skyTex.length !== SKW * H) paintSky();
    const colS = new Int32Array(W); for (let x = 0; x < W; x += 1) { const ang = yaw + Math.atan(((2 * x) / W - 1) * pl); colS[x] = Math.floor(((ang / (2 * Math.PI)) % 1 + 1) % 1 * SKW); }
    if (!rowInv || rowInv.length !== H) rowInv = new Float32Array(H); for (let y = 0; y < H; y += 1) { const d = y + 0.5 - hor; rowInv[y] = Math.abs(d) < 0.01 ? 100 : 1 / d; }
    const zb = zbuf; const px0 = p.x; const py0 = p.y; const NEARD = 0.05; const hazeV = pack(HAZE); const mipK = T / F; // (texels a pixel, per unit of distance)
    // a column at a time: the cells along the ray, near to far, each drawn into the rows still free ([ytop, ybot)); into
    // buffers laid out by columns (each column's pixels side by side in memory), turned the right way after
    const step = settings.detail === 'full' ? 1 : 2; const CW = Math.ceil(W / step); // (half detail: each column two pixels wide, half the work)
    if (!colBuf || colBuf.length !== CW * H) { colBuf = new Uint32Array(CW * H); colZ = new Float32Array(CW * H); }
    const cb = colBuf; const cz = colZ; const LMN = lm.length;
    let x = 0; let d0 = 0; let side = 0; let rdx = 0; let rdy = 0; let ytop = 0; let ybot = H; let sx = 1; let sy = 1;
    const face = (zTop, zBot, t0, foot) => { // a vertical face at d0 from zBot up to zTop, textured by t0 (a dressed wall: by its foot); returns its top row
      let r0 = Math.ceil(hor + (eye - zTop) * F / d0 - 0.5); let r1 = Math.ceil(hor + (eye - zBot) * F / d0 - 0.5); if (r0 < ytop) r0 = ytop; if (r1 > ybot) r1 = ybot; if (r0 >= r1) return r0;
      const tp = d0 * mipK; const L = tp > 4 ? 2 : tp > 2 ? 1 : 0; const S = T >> L; const t = t0.m[L]; const S1 = S - 1;
      let wxh = side === 0 ? py0 + d0 * rdy : px0 + d0 * rdx; wxh -= Math.floor(wxh); let tx = (wxh * S) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = S1 - tx;
      let li = (((((py0 + rdy * (d0 - 0.03)) * LR) | 0) * LW) + (((px0 + rdx * (d0 - 0.03)) * LR) | 0)) * 3; if (li < 0 || li >= LMN) li = 0;
      const shade = (side ? 0.84 : 1) * (0.8 + 0.4 * Math.max(0, (side === 0 ? -sx * SUN[0] : -sy * SUN[1])));
      const fa = d0 >= FOG_D ? 218 : (d0 * 218 / FOG_D) | 0; const fb = 256 - fa; const hr = HAZE[0] * fa; const hg = HAZE[1] * fa; const hb = HAZE[2] * fa; const lr = lm[li] * shade * fb; const lg = lm[li + 1] * shade * fb; const lb = lm[li + 2] * shade * fb;
      const tall = t0.length > T * T; const dz = d0 / F; let z = eye - (r0 + 0.5 - hor) * dz; const aoTop = zBot + 0.22; const RM = 256 >> L;
      for (let r = r0, o = x * H + r0; r < r1; r += 1, o += 1, z -= dz) {
        let row; if (tall) { row = ((140 - (z - foot) * T) | 0) >> L; if (row < 0) row = 0; else if (row >= RM) row = RM - 1; } else row = (((zTop - z) * S) | 0) & S1;
        const v = t[row * S + tx]; const ao = z < aoTop ? 0.66 + (z - zBot) * 1.5 : 1;
        let R2 = ((v & 255) * lr * ao + hr) >> 8; let G2 = (((v >> 8) & 255) * lg * ao + hg) >> 8; let B2 = (((v >> 16) & 255) * lb * ao + hb) >> 8; if (R2 > 255) R2 = 255; if (G2 > 255) G2 = 255; if (B2 > 255) B2 = 255;
        cb[o] = 0xff000000 | (B2 << 16) | (G2 << 8) | R2; cz[o] = d0;
      }
      return r0;
    };
    const flat = (e, r0, r1, tm, k) => { // a floor's (or ceiling's) rows r0..r1 at height distance e, its texture's mips tm, its light times k
      for (let r = r0, o = x * H + r0; r < r1; r += 1, o += 1) {
        const dist = e * rowInv[r]; const wx = px0 + rdx * dist; const wy = py0 + rdy * dist; const tp = dist * mipK; const L = tp > 4 ? 2 : tp > 2 ? 1 : 0; const S = T >> L; const t = tm[L];
        const ix = wx | 0; const iy = wy | 0; const v = t[((((wy - iy) * S) | 0) & (S - 1)) * S + ((((wx - ix) * S) | 0) & (S - 1))];
        let li = (((wy * LR) | 0) * LW + ((wx * LR) | 0)) * 3; if (li < 0 || li >= LMN) li = 0;
        const fa = dist >= FOG_D ? 218 : (dist * 218 / FOG_D) | 0; const fb = (256 - fa) * k;
        let R2 = ((v & 255) * lm[li] * fb + HAZE[0] * fa) >> 8; let G2 = (((v >> 8) & 255) * lm[li + 1] * fb + HAZE[1] * fa) >> 8; let B2 = (((v >> 16) & 255) * lm[li + 2] * fb + HAZE[2] * fa) >> 8; if (R2 > 255) R2 = 255; if (G2 > 255) G2 = 255; if (B2 > 255) B2 = 255;
        cb[o] = 0xff000000 | (B2 << 16) | (G2 << 8) | R2; cz[o] = dist;
      }
    };
    for (x = 0; x < CW; x += 1) {
      const camx = (2 * (x * step + step * 0.5)) / W - 1; rdx = dirX + plX * camx; rdy = dirY + plY * camx;
      let mx = Math.floor(px0); let my = Math.floor(py0); const ddx = Math.abs(1 / rdx); const ddy = Math.abs(1 / rdy); sx = rdx < 0 ? -1 : 1; sy = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? px0 - mx : mx + 1 - px0) * ddx; let sdy = (rdy < 0 ? py0 - my : my + 1 - py0) * ddy; side = 0;
      ytop = 0; ybot = H; d0 = 0; let ci = clamp(my, 0, MH - 1) * MW + clamp(mx, 0, MW - 1); let ch = M.h[ci];
      for (let k = 0; k < 160; k += 1) {
        const d1 = sdx < sdy ? sdx : sdy; const dn = d0 < NEARD ? NEARD : d0;
        if (eye > ch) { // this cell's floor (or a crate's top), from its far edge to its near
          const e = (eye - ch) * F; let r0 = Math.ceil(hor + e / d1 - 0.5); let r1 = Math.ceil(hor + e / dn - 0.5); if (r0 < ytop) r0 = ytop; if (r1 > ybot) r1 = ybot;
          if (r0 < r1) flat(e, r0, r1, topTex[ci].m, 1);
          if (r0 < ybot) ybot = r0 > ytop ? r0 : ytop;
        }
        const rf = M.roof[ci];
        if (rf < 1e9 && eye < rf && ytop < ybot) { // its ceiling, under a roof
          const e = (rf - eye) * F; let r0 = Math.ceil(hor - e / dn - 0.5); let r1 = Math.ceil(hor - e / d1 - 0.5); if (r0 < ytop) r0 = ytop; if (r1 > ybot) r1 = ybot;
          if (r0 < r1) flat(-e, r0, r1, ceilTex[ci].m, 0.7);
          if (r1 > ytop) ytop = r1 < ybot ? r1 : ybot;
        }
        if (ytop >= ybot) break;
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        d0 = d1; if (mx < 0 || my < 0 || mx >= MW || my >= MH) break;
        const ni = my * MW + mx; const nh = M.h[ni]; const nrf = M.roof[ni];
        if (nh > ch) { const r0 = face(nh, ch, sideTex[ni], ch); if (r0 < ybot) ybot = r0 > ytop ? r0 : ytop; } // (where the ground rises: a step, a crate, a wall)
        if (nrf < rf && nrf < 1e9 && eye < nrf) { face(nrf + 40, nrf, sideTex[ni], nh); const r1 = Math.ceil(hor + (eye - nrf) * F / d0 - 0.5); if (r1 > ytop) ytop = r1 < ybot ? r1 : ybot; } // (where a roof begins: the house over it, out of sight)
        ci = ni; ch = nh;
        if (ytop >= ybot || ybot <= hor - (MAXH - eye) * F / d0) break; // (nothing farther could show)
      }
      const sc = colS[Math.min(W - 1, x * step)]; for (let r = ytop, o = x * H + ytop; r < ybot; r += 1, o += 1) { cb[o] = r < hor ? skyTex[(hor - r < H ? hor - r : H - 1) * SKW + sc] : hazeV; cz[o] = 1e9; } // (the sky, or haze past the map)
    }
    // turned the right way, by tiles (so both sides stay in the cache)
    for (let x0 = 0; x0 < CW; x0 += 16) for (let y0 = 0; y0 < H; y0 += 16) { const x1 = Math.min(CW, x0 + 16); const y1 = Math.min(H, y0 + 16);
      for (let xx = x0; xx < x1; xx += 1) { let o = xx * H + y0; const X = xx * step; let q = y0 * W + X; const two = step === 2 && X + 1 < W;
        for (let yy = y0; yy < y1; yy += 1, o += 1, q += W) { const v = cb[o]; const d = cz[o]; buf[q] = v; zb[q] = d; if (two) { buf[q + 1] = v; zb[q + 1] = d; } } } }
    // the sprites, far to near, each pixel against the depth
    const spr = []; const now = g.now;
    // the men, the props, the keg, things thrown: models, against the depth (those out of sight skipped)
    const vis = (x, y, z0, z1) => { const rx2 = x - p.x; const ry2 = y - p.y; const fz = rx2 * dirX + ry2 * dirY; if (fz < -0.6) return false; if (Math.abs(rx2 * -dirY + ry2 * dirX) > fz * pl + 1.2) return false;
      return [z1, (z0 + z1) / 2, z0 + 0.05].some((zz) => clear(p.x, p.y, eye, x, y, zz)) || Math.hypot(rx2, ry2) < 1.5; };
    const lit = (x, y) => { const o = lightAt(x, y); return [lm[o], lm[o + 1], lm[o + 2]]; };
    const items = [];
    g.actors.forEach((a) => { if (a === p || !vis(a.x, a.y, a.z, a.z + STAND)) return; a.wid = a.alive ? cur(a) : null; a.hasKeg = g.keg.carrier === a; items.push({ man: a, light: lit(a.x, a.y), flash: now - (a.hitAt || -9) < 0.08 ? 0.8 : 0 }); });
    props.forEach((q) => { if (vis(q.x, q.y, q.z, q.z + q.h)) items.push({ model: q.kind, x: q.x, y: q.y, z: q.z, a: q.rot || 0, light: lit(q.x, q.y) }); });
    if ((g.keg.dropped || g.keg.planted) && vis(g.keg.x, g.keg.y, g.keg.z || 0, (g.keg.z || 0) + 0.3)) items.push({ keg: true, x: g.keg.x, y: g.keg.y, z: g.keg.z || 0, a: g.keg.a || 0, burn: g.keg.planted ? clamp(1 - (g.keg.until - now) / KEG_S, 0, 1) : 0, light: lit(g.keg.x, g.keg.y) });
    (g.drops || []).forEach((d) => { if (vis(d.x, d.y, d.z, d.z + 0.2)) items.push({ model: d.id, x: d.x, y: d.y, z: d.z, a: d.a, lying: true, light: lit(d.x, d.y) }); });
    g.nades.forEach((n) => items.push({ nade: { he: 'firepot', smoke: 'incense', flash: 'vial', fire: 'flask' }[n.kind], x: n.x, y: n.y, z: n.z, spin: (now - n.t0) * 14, light: lit(n.x, n.y) }));
    const sunView = [SUN[0] * -dirY + SUN[1] * dirX, SUN[2], SUN[0] * dirX + SUN[1] * dirY];
    MODELS.world(worldT, cam, items, sunView, now, g.knife);
    torches.forEach((t) => spr.push({ x: t.x, y: t.y, z: t.z - 0.15, h: 0.32, wk: 0.16, torch: t })); // (the torches: a bracket, a flame)
    g.smokes.forEach((sm) => { const k = Math.min(1, (now - sm.t0) / 1.5) * Math.min(1, (sm.until - now) / 2); for (let j = 0; j < 22; j += 1) { const q = j * 2.39996 + now * 0.05; const r = Math.sqrt(j / 22) * sm.r * k; spr.push({ x: sm.x + Math.cos(q) * r, y: sm.y + Math.sin(q) * r, z: sm.z - 0.1 + (j % 3) * 0.25, h: 1.5 * k, wk: 1.6 * k, cloud: [182, 184, 190], alpha: 0.9 }); } });
    g.fires.forEach((f) => f.flames.forEach((q) => spr.push({ x: q[0], y: q[1], z: f.z, h: 0.32 + Math.sin(now * 9 + q[2]) * 0.1, wk: 0.3, flame: true })));
    g.fx.forEach((f) => { if (f.kind === 'blast') spr.push({ x: f.x, y: f.y, z: f.z - 0.2, h: f.big ? 3 : 1.5, wk: f.big ? 4 : 1.7, flame: true }); });
    spr.forEach((s2) => { const rx = s2.x - p.x; const ry = s2.y - p.y; s2.ty = cam.inv * (-plY * rx + plX * ry); s2.tx = cam.inv * (dirY * rx - dirX * ry); });
    spr.filter((s2) => s2.ty > 0.1).sort((a, b) => b.ty - a.ty).forEach((s2) => {
      const scale = F / s2.ty; const sx = (W / 2) * (1 + s2.tx / s2.ty);
      const hgt = s2.h * scale; const wid = s2.wk * scale; const bot = hor + (eye - s2.z) * scale; const top = bot - hgt; const fog = clamp(s2.ty / FOG_D, 0, 1) * 0.8;
      for (let x = Math.max(0, Math.floor(sx - wid / 2)); x < Math.min(W, sx + wid / 2); x += 1) {
        const u = (x - (sx - wid / 2)) / wid;
        for (let y = Math.max(0, Math.floor(top)); y < Math.min(H, bot); y += 1) {
          const v = (y - top) / hgt; const o = y * W + x; if (s2.ty >= zb[o]) continue;
          if (s2.img) { let c = s2.img.px[Math.floor(v * s2.img.h) * s2.img.w + Math.floor(u * s2.img.w)]; if (!c) continue; if (s2.glow) c = pack([255, 120, 60]); if (s2.hit) c = pack(unpack(c).map((q) => q + (255 - q) * 0.7)); buf[o] = s2.lit ? litFog(c, s2.lo, fog) : fogged(c, fog); zb[o] = s2.ty; }
          else if (s2.dot) { if (Math.hypot(u - 0.5, v - 0.5) < 0.5) buf[o] = pack(s2.dot); }
          else if (s2.cloud) { const r = Math.hypot(u - 0.5, (v - 0.5) * 1.2); if (r < 0.5) { const al = clamp(s2.alpha * (1 - r * 1.7), 0, 1); const c = unpack(buf[o]); buf[o] = pack(c.map((q, i) => q + (s2.cloud[i] - q) * al)); } }
          else if (s2.torch) { if (v > 0.55) { if (Math.abs(u - 0.5) < 0.12) buf[o] = pack([60, 44, 30]); } else { const fl = Math.sin(now * 14 + s2.torch.ph + v * 6) * 0.08; const r = Math.hypot((u - 0.5 - fl) * 1.6, (v - 0.32) * 1.1); if (r < 0.32) buf[o] = pack(r < 0.12 ? [255, 250, 200] : r < 0.22 ? [255, 190, 70] : [230, 90, 20]); } }
          else if (s2.flame) { const r = Math.hypot(u - 0.5, (v - 0.72)); if (r < 0.5 && Math.random() < 0.9 - r) buf[o] = pack(r < 0.16 ? [255, 244, 180] : r < 0.3 ? [255, 168, 56] : [214, 64, 22]); }
        }
      }
    });
    // the marks of the fight: bullet holes on walls and crates, blood on floors (each a few pixels where its surface shows)
    g.decals.forEach((d) => { const sp = toScreen(d.x, d.y, d.z); if (!sp) return; const X = sp[0] | 0; const Y = sp[1] | 0; const rr = Math.max(1, Math.round(sp[3] * (d.kind === 'blood' ? 0.09 : 0.022)));
      for (let j = -rr; j <= rr; j += 1) for (let i2 = -rr; i2 <= rr; i2 += 1) { if (i2 * i2 + j * j * (d.kind === 'blood' ? 3 : 1) > rr * rr) continue; const xx = X + i2; const yy = Y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const o = yy * W + xx; if (Math.abs(zb[o] - sp[2]) > 0.12 + sp[2] * 0.02) continue;
        const c = unpack(buf[o]); buf[o] = d.kind === 'blood' ? pack([c[0] * 0.55 + 50, c[1] * 0.25, c[2] * 0.25]) : pack(c.map((q) => q * (i2 * i2 + j * j < rr * rr * 0.4 ? 0.22 : 0.6))); } });
    // particles in the world: sparks off stone, splinters off wood, blood off a hit, debris, the trails of shots (each against the depth)
    const dot = (X, Y, d, c, r = 1) => { X |= 0; Y |= 0; for (let j = -r + 1; j < r; j += 1) for (let i2 = -r + 1; i2 < r; i2 += 1) { const xx = X + i2; const yy = Y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H && d < zb[yy * W + xx]) buf[yy * W + xx] = pack(c); } };
    g.fx.forEach((f) => {
      const age = now - f.t;
      if (f.parts) f.parts.forEach((q) => { const pz = q.z + q.vz * age - 4.9 * age * age; const qx = q.x + q.vx * age; const qy = q.y + q.vy * age; if (pz < hAt(Math.floor(qx), Math.floor(qy))) return; const sp = toScreen(qx, qy, pz);
        if (sp) dot(sp[0], sp[1], sp[2], f.kind === 'blood' ? [150, 10, 14] : f.kind === 'splinter' ? [170, 120, 70] : f.kind === 'debris' ? [90, 84, 78] : age < 0.08 ? [255, 250, 200] : [200, 180, 140], Math.max(1, Math.round(sp[3] / (f.kind === 'debris' ? 60 : 90)))); });
      if (f.kind === 'trail' && age < 0.07) { const n = 24; for (let k = 0; k <= n; k += 1) { const u = k / n; const sp = toScreen(f.x0 + (f.x1 - f.x0) * u, f.y0 + (f.y1 - f.y0) * u, f.z0 + (f.z1 - f.z0) * u); if (sp && u > 0.1) dot(sp[0], sp[1], sp[2], [255, 236, 160]); } }
    });
    // in the hand
    if (self && p.alive && !p.scoped) {
      const wid = cur(p); const sp = Math.hypot(p.vx, p.vy) / 3.6; const ph = g.bobT; const lo = lightAt(p.x, p.y);
      const raise = clamp((now - g.drawAt) / 0.32, 0, 1); const rl = now < p.reloadUntil ? 1 - (p.reloadUntil - now) / ARMS.W[wid].reload : -1;
      const k = g.keg; const bk = settings.bob;
      MODELS.view({ buf, W, H }, wid, g.knife, {
        kick: g.kick, bobX: (Math.sin(ph) * 7 * sp + g.sway * 0.6) * bk, bobY: (Math.abs(Math.cos(ph)) * 5 * sp) * bk + (p.z > p.ground + 0.02 ? -6 : 0), sway: -g.sway, swayY: g.swayY || 0, raise,
        inspect: g.inspect, swing: g.swing, heavy: g.heavySwing, side: g.swingSide || 1, drawT: wid === 'knife' ? clamp((now - g.drawAt) / 0.9, 0, 1) : -1, reload: rl, flash: g.flashFrame,
        shots: p.shotsAll || 0, cycle: now - p.lastShot, now, amb: [lm[lo], lm[lo + 1], lm[lo + 2]], team: p.team, hand: settings.hand,
        nade: g.nade, pinT: g.pinAt >= 0 && p.slot === 4 ? now - g.pinAt : -1, throwT: g.throwAt !== undefined && now - g.throwAt < 0.7 ? now - g.throwAt : -1,
        plantT: p.planting ? k.plantP : -1, defuseT: p.defusing ? k.defuseP : -1, tools: p.tools, burn: k.planted ? clamp(1 - (k.until - now) / KEG_S, 0, 1) : 0, land: now - (p.landAt || -9), landV: p.landV || 0,
      });
      g.flashFrame = false;
    }
    // the scope: a ring of brass, dark outside, its crosshair
    if (self && p.scoped) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const r = Math.hypot(x - W / 2, y - H / 2); const o = y * W + x; if (r > H * 0.47) buf[o] = pack([6, 6, 8]); else if (r > H * 0.455) buf[o] = pack([176, 136, 56]); else if (Math.abs(x - W / 2) < 1 || Math.abs(y - H / 2) < 1) buf[o] = pack([16, 16, 16]); }
    // blinded, hurt, dead
    // blinded: white, then the picture of that moment burnt in and fading over the world
    if (g.flashSnap) { g.flashSnap = false; g.flashImg = buf.slice(); }
    const fl = self && now < g.flashUntil ? clamp((g.flashUntil - now) / 1.2, 0, 1) : 0;
    if (fl > 0) { const ai2 = g.flashImg && g.flashImg.length === buf.length ? g.flashImg : null; const ka = Math.min(1, fl * 1.4) * 0.55;
      for (let o = 0; o < W * H; o += 1) { const v = buf[o]; let r = v & 255; let gg = (v >> 8) & 255; let b = (v >> 16) & 255; if (ai2) { const q = ai2[o]; r += ((q & 255) - r) * ka; gg += (((q >> 8) & 255) - gg) * ka; b += (((q >> 16) & 255) - b) * ka; }
        r += (255 - r) * fl; gg += (255 - gg) * fl; b += (255 - b) * fl; buf[o] = 0xff000000 | ((b | 0) << 16) | ((gg | 0) << 8) | (r | 0); } }
    if (self && now - g.hurtAt < 0.4) { const k = 1 - (now - g.hurtAt) / 0.4; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 1) { const e = Math.max(Math.abs(x / W - 0.5), Math.abs(y / H - 0.5)) * 2; if (e > 0.7) { for (let yy = y; yy < Math.min(H, y + 2); yy += 1) { const o = yy * W + x; const c = unpack(buf[o]); const m = k * (e - 0.7) / 0.3; buf[o] = pack([c[0] + (210 - c[0]) * m * 0.7, c[1] * (1 - m * 0.6), c[2] * (1 - m * 0.6)]); } } } }
    if (!me.alive && self) for (let o = 0; o < W * H; o += 1) { const c = unpack(buf[o]); const m = (c[0] + c[1] + c[2]) / 3; buf[o] = pack([m * 0.8, m * 0.75, m * 0.7]); }
    ctx.putImageData(img, 0, 0);
    // the crosshair (its gap the spread), and the mark of a hit
    if (self && p.alive && !p.scoped && !['knife', 'keg'].includes(cur(p))) crosshair(ctx, W / 2, H / 2, cur(p) === 'nade' ? 0 : spreadOf(p, ARMS.W[cur(p)]));
    if (now - g.hitMarkAt < 0.18) { ctx.strokeStyle = g.hitHead ? '#ff4a3a' : '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a2, b2]) => { ctx.moveTo(W / 2 + a2 * 6, H / 2 + b2 * 6); ctx.lineTo(W / 2 + a2 * 13, H / 2 + b2 * 13); }); ctx.stroke(); }
    if (self && g.hurtFrom !== null && g.hurtFrom !== undefined && now - g.hurtAt < 1) { const a2 = wrap(g.hurtFrom - p.a) - Math.PI / 2; ctx.fillStyle = `rgba(230,40,30,${1 - (now - g.hurtAt)})`; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(a2 + Math.PI / 2); ctx.beginPath(); ctx.moveTo(-14, -70); ctx.lineTo(14, -70); ctx.lineTo(0, -88); ctx.fill(); ctx.restore(); } // (where the hit came from)
    // names: your side's men over their heads; an enemy's under the crosshair when it is on him
    ctx.font = `${Math.max(10, Math.round(H / 48))}px ui-monospace, monospace`; ctx.textAlign = 'center';
    g.actors.forEach((a) => { if (a === p || !a.alive || a.team !== me.team) return; const d = Math.hypot(a.x - p.x, a.y - p.y); if (d > 30) return; const sp = toScreen(a.x, a.y, a.z + STAND + 0.12); if (!sp || sp[0] < 0 || sp[0] > W) return;
      const o = Math.round(sp[1]) * W + Math.round(sp[0]); const hidden = !(sp[1] >= 0 && sp[1] < H && zb[o] >= sp[2] - 0.3); ctx.fillStyle = hidden ? 'rgba(120,170,255,.45)' : '#9cc0ff'; ctx.fillText(a.name, sp[0], sp[1]); });
    if (self && p.alive) { const t2 = g.actors.find((o) => o.alive && o.team !== p.team && Math.abs(wrap(Math.atan2(o.y - p.y, o.x - p.x) - p.a)) < 0.3 / Math.max(1, Math.hypot(o.x - p.x, o.y - p.y)) + 0.02 && sees(p, o));
      if (t2) { ctx.fillStyle = '#ff8a7a'; ctx.fillText(`${t2.name}`, W / 2, H / 2 + H / 14); } }
    drawRadar();
  }
  /* The radar: the map painted once (walls with a lit edge, floors by kind, the sites), turned each frame
     with the one you watch facing up, a circle of about thirteen cells; the side's men, enemies some of
     them see, the keg; the sites' letters held at the rim when off it. */
  const RS = 8; let radarMap = null;
  function prepRadar() {
    const c = document.createElement('canvas'); c.width = MW * RS; c.height = MH * RS; const x = c.getContext('2d'); const site = (X, y) => g.sites.some((st) => st.cells.some(([a, b]) => Math.floor(a) === X && Math.floor(b) === y));
    for (let y = 0; y < MH; y += 1) for (let X = 0; X < MW; X += 1) { const m = matAt(X, y); const h = hAt(X, y); const k = Math.round(h * 36);
      x.fillStyle = isWall(X, y) ? (m === 'T' ? '#0c0a09' : '#17130f') : m === 'k' ? '#5e4428' : site(X, y) ? `rgb(${140 + k},${108 + k},${60 + k})` : `rgb(${88 + k},${84 + k},${78 + k})`; x.fillRect(X * RS, y * RS, RS, RS);
      if (roofAt(X, y) < 1e9) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(X * RS, y * RS, RS, RS); } }
    x.fillStyle = '#d8ccb0'; for (let y = 0; y < MH; y += 1) for (let X = 0; X < MW; X += 1) { const h = hAt(X, y); [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => { const n = hAt(X + dx, y + dy); if (h - n < 0.3 || isWall(X + dx, y + dy)) return; x.fillRect(X * RS + (dx === 1 ? RS - 1 : 0), y * RS + (dy === 1 ? RS - 1 : 0), dx ? 1 : RS, dy ? 1 : RS); }); } // (edges: walls and ledges, on the high side)
    props.forEach((q) => { x.fillStyle = '#4a3420'; x.beginPath(); x.arc(q.x * RS, q.y * RS, q.r * RS, 0, 6.2832); x.fill(); });
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
<div class="sg-feed"></div><div class="sg-msg"></div><div class="sg-banner" hidden></div><div class="sg-prog" hidden><span></span><i></i></div><div class="sg-spec" hidden></div><div class="sg-chat"></div><div class="sg-fps"></div>
<div class="sg-vit"><div class="sg-hp"><i class="sg-i-hp"></i><b></b><span class="sg-bar"><i></i></span></div><div class="sg-ar"><i class="sg-i-ar"></i><b></b><span class="sg-bar"><i></i></span></div><div class="sg-kegc" hidden>✹ the keg</div></div>
<div class="sg-slots"></div><div class="sg-ammo"><div class="sg-wname"></div><div class="sg-rounds"><b class="sg-mag"></b><span class="sg-res"></span></div><div class="sg-ticks"></div></div>
<div class="sg-menu" hidden></div><i class="sg-vcur" hidden></i><div class="sg-board" hidden></div><div class="sg-death" hidden></div><div class="sg-zone"></div><div class="sg-help">Click: play (fullscreen, the mouse taken) · Esc: pause, settings, keys · B buy · Tab scores</div></div>`;
    document.body.append(root);
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d'); img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W * H); worldT = { buf, W, H, ZB: zbuf };
    const q = (sel) => root.querySelector(sel);
    ui = { radar: q('.sg-radar'), time: q('.sg-time'), round: q('.sg-round'), sides: [...root.querySelectorAll('.sg-side')], cash: q('.sg-cash'), delta: q('.sg-delta'), feed: q('.sg-feed'), msg: q('.sg-msg'), banner: q('.sg-banner'), prog: q('.sg-prog'), spec: q('.sg-spec'),
      hp: q('.sg-hp'), ar: q('.sg-ar'), kegc: q('.sg-kegc'), slots: q('.sg-slots'), ammo: q('.sg-ammo'), wname: q('.sg-wname'), mag: q('.sg-mag'), res: q('.sg-res'), ticks: q('.sg-ticks'), menu: q('.sg-menu'), help: q('.sg-help'), chat: q('.sg-chat'), fps: q('.sg-fps'), board: q('.sg-board'), vcur: q('.sg-vcur'), death: q('.sg-death'), zone: q('.sg-zone') };
    hudKey = {};
  }
  const MODEL_OF = { he: 'firepot', smoke: 'incense', flash: 'vial', fire: 'flask', fall: 'helm' };
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
    setIf('slots', `${JSON.stringify(p.weapons)}|${p.slot}|${nades.map((k) => k + p.gear[k]).join()}|${g.knife.name}|${g.nade}|${g.keg.carrier === p}`, () => {
      ui.slots.innerHTML = [1, 2, 3].filter((n) => p.weapons[n]).map((n) => slotRow(n, p.weapons[n], n === 3 ? g.knife.shape.name : ARMS.W[p.weapons[n]].name)).join('')
        + (nades.length ? `<p class="${p.slot === 4 ? 'on' : ''}"><kbd>4</kbd>${nades.map((k) => `<img class="sm${p.slot === 4 && g.nade === k ? ' cur' : ''}" src="${iconURL(k)}" alt="" title="${k}">${p.gear[k] > 1 ? `×${p.gear[k]}` : ''}`).join('')}</p>` : '')
        + (g.keg.carrier === p ? `<p class="${p.slot === 5 ? 'on' : ''}"><kbd>5</kbd><img src="${iconURL('keg')}" alt=""><span>The keg</span></p>` : '');
      g.slotAt = now; });
    ui.slots.classList.toggle('show', now - (g.slotAt || -9) < 2.5 || g.phase === 'buy'); ui.slots.hidden = !p.alive; root.querySelector('.sg-vit').hidden = !p.alive;
    const feed = g.feed.filter((f) => now - f.t < 7);
    setIf('feed', feed.map((f) => f.t).join(), () => { ui.feed.innerHTML = feed.map((f) => `<p class="${f.by === p.name || f.who === p.name ? 'me' : ''}"><span class="sg-${f.byTeam}">${f.by || ''}</span><img src="${iconURL(f.w)}" alt="${f.w}">${f.head ? '<i class="sg-hs" title="to the head"></i>' : ''}<span class="sg-${f.team}">${f.who}</span></p>`).join(''); });
    setIf('msg', now < g.msgUntil ? g.msg : '', (v) => { ui.msg.textContent = v; ui.msg.hidden = !v; });
    const bn = g.banner && now - g.banner.t < 4.5 ? g.banner : null;
    setIf('banner', bn ? bn.t : '', () => { ui.banner.hidden = !bn; if (bn) { ui.banner.className = `sg-banner sg-${bn.team}${bn.mine ? ' won' : ''}`; ui.banner.innerHTML = `<b>${bn.text}</b><span>${bn.sub}${bn.mvp ? ` · the round's best: ${bn.mvp} ★` : ''}</span>`; } });
    const k = g.keg; const pr = k.plantP > 0 && !k.planted && k.carrier === p ? ['Planting the keg', k.plantP] : k.defuseP > 0 && k.defuser === p ? [p.tools ? 'Defusing (with tools)' : 'Defusing', k.defuseP] : null;
    setIf('prog', pr ? `${pr[0]}|${Math.round(pr[1] * 100)}` : '', () => { ui.prog.hidden = !pr; if (pr) { ui.prog.querySelector('span').textContent = pr[0]; ui.prog.querySelector('i').style.width = `${Math.round(pr[1] * 100)}%`; } });
    const v = camActor(); setIf('spec', v !== p ? v.name : '', (n) => { ui.spec.hidden = !n; ui.spec.innerHTML = n ? `Watching <b>${n}</b> · ${keyName(settings.binds.attack[0] || 'Mouse0')}: another${v.isBot ? ` · ${keyName(settings.binds.use[0] || 'KeyE')}: take over` : ''}` : ''; });
    if (!ui.board.hidden && now - (g.boardAt || 0) > 0.5) { g.boardAt = now; scores(true); }
    setIf('zone', g.zoneAt(v.x, v.y), (z) => { ui.zone.textContent = z; });
    const dn = g.death && !p.alive && now - g.death.t < 6 ? g.death : null;
    setIf('death', dn ? dn.t : '', () => { ui.death.hidden = !dn; if (!dn) return;
      ui.death.innerHTML = `<p>${dn.by ? `Felled by <b class="sg-${dn.byTeam}">${dn.by}</b> <img src="${iconURL(dn.wid)}" alt="">${dn.head ? ' to the head' : ''}${dn.hpLeft ? ` · he has ${dn.hpLeft} health left` : ''}` : 'You fell.'}</p>`
        + (dn.report.length ? `<table><tr><th></th><th>given</th><th>taken</th></tr>${dn.report.map((r) => `<tr><td>${r.name}</td><td>${r.gave ? `${r.gave[0]} in ${r.gave[1]}` : '—'}</td><td>${r.took ? `${r.took[0]} in ${r.took[1]}` : '—'}</td></tr>`).join('')}</table>` : ''); });
    const chat = g.chat.filter((c) => c.team === mine && now - c.t < 8); setIf('chat', chat.map((c) => c.t).join(), () => { ui.chat.innerHTML = chat.map((c) => `<p><b>${c.who}</b> ${c.text}</p>`).join(''); });
    g.fpsN = (g.fpsN || 0) + 1; if (performance.now() - (g.fpsT || 0) > 500) { ui.fps.textContent = settings.showFps ? `${Math.round(g.fpsN * 1000 / (performance.now() - (g.fpsT || performance.now() - 500)))} fps` : ''; g.fpsN = 0; g.fpsT = performance.now(); }
  }
  /* ---- menus: buy (B, in the buying time), scores (Tab), pause (Esc), the knife's forge (K) ---- */
  /* The buying menu keeps the mouse (a drawn cursor moves on it, a click acts under it): the round goes on. The
     others let the mouse go. Esc: from play, the pause; from the buying menu, closed; from settings or the forge,
     back to the pause; on the pause, nothing (the browser will not take the mouse back on Esc: Resume does). */
  function openMenu(html, cls, keep) { ui.menu.innerHTML = html; ui.menu.className = `sg-menu ${cls}`; ui.menu.hidden = false; if (!keep && document.pointerLockElement) document.exitPointerLock(); vcursor(); }
  function closeMenu() { ui.menu.hidden = true; vcursor(); }
  const menuIs = (cls) => !ui.menu.hidden && ui.menu.classList.contains(cls);
  function vcursor() { const on = menuIs('sg-buy') && document.pointerLockElement === cv; ui.vcur.hidden = !on; if (on && !g.vcur) { const r = ui.menu.parentElement.getBoundingClientRect(); g.vcur = [r.width / 2, r.height / 2]; } if (on) vmove(0, 0); }
  function vmove(dx, dy) {
    const r = ui.menu.parentElement.getBoundingClientRect(); const c = g.vcur; c[0] = clamp(c[0] + dx, 0, r.width - 1); c[1] = clamp(c[1] + dy, 0, r.height - 1); ui.vcur.style.translate = `${c[0]}px ${c[1]}px`;
    const el = vunder(); ui.menu.querySelectorAll('.vh').forEach((b) => { if (b !== el) b.classList.remove('vh'); }); if (el) el.classList.add('vh');
  }
  const vunder = () => { const r = ui.menu.parentElement.getBoundingClientRect(); ui.vcur.hidden = true; const el = document.elementFromPoint(r.left + g.vcur[0], r.top + g.vcur[1]); ui.vcur.hidden = false; return el && ui.menu.contains(el) ? el.closest('button:not([disabled])') : null; };
  function escape() {
    if (ui.menu.hidden) pauseMenu();
    else if (menuIs('sg-buy')) closeMenu();
    else if (menuIs('sg-setmenu') || menuIs('sg-forge')) pauseMenu();
  }
  /** Resume: the menu stays until the mouse is taken (the browser may refuse it just after an Esc). */
  function resume() { grab(); }
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
    const p = g.player; const o = kind === 'w' ? ARMS.W[id] : ARMS.GEAR[id]; if (p.money < o.price || owns(p, kind, id) || cantBuy(p)) return false;
    if (kind === 'w') give(p, id);
    else if (o.armour) { p.armour = 100; if (o.helm) p.helm = true; }
    else if (o.tools) { if (p.team !== 'def') return false; p.tools = true; }
    else p.gear[o.kind] = (p.gear[o.kind] || 0) + 1;
    p.money -= o.price; sfx('buy'); (g.bought ||= []).push([kind, id]); return true;
  }
  /** Buying: only in the buying time (the freeze and twenty seconds after) and near your side's spawn. */
  function cantBuy(p) {
    if (!p.alive) return 'The fallen buy nothing.';
    if (!(g.phase === 'buy' || (g.phase === 'live' && g.now < g.phaseUntil - ROUND_S + 20))) return 'The buying time is over.';
    if (!g.spawns[p.team].some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 3.2)) return 'Buy at your side\'s spawn.';
    return '';
  }
  function buyMenu(tab = g.buyTab || 0) {
    const why = cantBuy(g.player); if (why) { say(why, 2); return; }
    const p = g.player; const tabs = TABS(); g.buyTab = tab = clamp(tab, 0, tabs.length - 1);
    const bar = (v) => `<i style="--v:${Math.round(clamp(v, 0, 1) * 100)}%"></i>`;
    const cards = tabs[tab][1].map(([kind, id], k) => { const o = kind === 'w' ? ARMS.W[id] : ARMS.GEAR[id]; const have = owns(p, kind, id); const poor = p.money < o.price; const no = kind === 'g' && o.tools && p.team !== 'def';
      const st = kind === 'w' ? Object.entries(ARMS.STATS(o)).map(([n, v]) => `<li><span>${n}</span>${bar(v)}</li>`).join('') : `<li class="dim">${o.kind ? `up to ${o.max}` : o.helm ? 'stops headshots' : o.armour ? 'halves the damage' : 'defenders only'}</li>`;
      return `<button class="sg-card${have ? ' own' : ''}" data-buy="${kind}:${id}" ${poor || have || no ? 'disabled' : ''}><kbd>${k + 1}</kbd><span class="sg-ic" data-ic="${id}"></span><b>${o.name}</b><em>${have ? 'owned' : `${o.price}`}</em><ul>${st}</ul></button>`; }).join('');
    openMenu(`<h3>Buy <span class="sg-purse">${p.money} crowns</span></h3><nav class="sg-tabs">${tabs.map(([n], k) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}"><kbd>${k + 1}</kbd> ${n}</button>`).join('')}</nav>
<div class="sg-cards">${cards}</div><p class="dim"><button class="sg-rebuy" data-act="rebuy" ${g.lastBought && g.lastBought.length ? '' : 'disabled'}>R · buy again last round's</button> Shift+number: a tab; number: buy · B or Esc to close.</p>`, 'sg-buy', true);
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
  /* The scores (held Tab, over the game, the mouse kept): each side's men, money (your side's), kills, assists, deaths,
     damage a round, the share to the head, the rounds' best (stars); the rounds so far, each by how it was won. */
  function scores(on) {
    ui.board.hidden = !on; if (!on) return; const p = g.player; const played = Math.max(1, g.round - (g.phase === 'over' ? 0 : 1));
    const rows = (team) => g.actors.filter((a) => a.team === team).sort((a, b) => b.kills - a.kills || (b.dmgTotal || 0) - (a.dmgTotal || 0)).map((a) => `<tr class="${a.alive ? '' : 'dead'}${a === p ? ' me' : ''}"><td>${a.alive ? '' : '✝'} ${a.name}${a.isBot || a.name === 'You' ? '' : ' (you)'}</td><td>${team === p.team ? a.money : ''}</td><td>${a.kills}</td><td>${a.assists || 0}</td><td>${a.deaths}</td><td>${Math.round((a.dmgTotal || 0) / played)}</td><td>${a.kills ? Math.round(((a.hsKills || 0) / a.kills) * 100) : 0}%</td><td>${'★'.repeat(Math.min(5, a.mvps || 0))}${(a.mvps || 0) > 5 ? a.mvps : ''}</td></tr>`).join('');
    const icon2 = { elim: '✕', time: '◷', keg: '✹', defused: '✂' }; const hist = (g.history || []).map((h) => `<i class="sg-${h.winner}" title="${h.why}">${icon2[h.why]}</i>`).join('');
    const head = '<tr><th></th><th>crowns</th><th>K</th><th>A</th><th>D</th><th>ADR</th><th>HS</th><th>MVP</th></tr>';
    ui.board.innerHTML = `<h3><span class="sg-def">Defenders ${g.score.def}</span> · round ${g.round} · <span class="sg-att">${g.score.att} Attackers</span></h3><div class="sg-hist">${hist}</div>
<table class="sg-def">${head}${rows('def')}</table><table class="sg-att">${head}${rows('att')}</table>`;
  }
  /** The match won or lost: the final score, the best man (most stars, then kills), the table; again or leave. */
  function matchEnd() {
    const mine = g.matchOver === g.player.team; const best = g.actors.slice().sort((a, b) => (b.mvps || 0) - (a.mvps || 0) || b.kills - a.kills)[0]; g.paused = true;
    scores(true); const table = ui.board.innerHTML; ui.board.hidden = true;
    openMenu(`<h3>${mine ? 'The match is yours' : 'The match is lost'} · ${g.score[g.player.team]} to ${g.score[g.player.team === 'def' ? 'att' : 'def']}</h3><p>The match's best: <b>${best.name}</b>, ${best.kills} felled, ${best.mvps || 0} ★.</p><div class="sg-endtable">${table}</div>
<button data-act="again">A new match</button><button data-act="leave">Leave (back to the castle)</button>`, 'sg-pause sg-end');
    ui.menu.querySelector('[data-act="again"]').addEventListener('click', () => { const o = g.opts; stop(); start(o); });
    ui.menu.querySelector('[data-act="leave"]').addEventListener('click', () => { const o = g.opts; stop(); if (o.onLeave) o.onLeave(); });
  }
  function pauseMenu() {
    g.paused = true;
    openMenu(`<h3>Siege, paused</h3><button data-act="resume">Resume</button><button data-act="settings">Settings</button><button data-act="knife">The knife's forge</button><button data-act="diff">Bots: ${g.difficulty}</button>
<button data-act="again">A new match</button><button data-act="leave">Leave (back to the castle)</button>`, 'sg-pause');
    ui.menu.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'resume') resume();
      if (act === 'settings') settingsMenu('controls');
      if (act === 'knife') forge();
      if (act === 'diff') { g.difficulty = { easy: 'normal', normal: 'hard', hard: 'easy' }[g.difficulty]; store('siege-diff', g.difficulty); pauseMenu(); }
      if (act === 'again') { const o = g.opts; stop(); start(o); }
      if (act === 'leave') { const o = g.opts; stop(); if (o.onLeave) o.onLeave(); }
    }));
  }
  /* The settings: the keys (click one, then press the key or button to bind; a second binding beside it; Esc
     leaves it as it was), the mouse and the view, the crosshair (seen as it will be), the picture and the sound. */
  function settingsMenu(tab) {
    const X = settings.xhair; const cs = (settings.sens / (0.022 * Math.PI / 180)).toFixed(2);
    const tabs = [['controls', 'Keys'], ['mouse', 'Mouse and view'], ['xhair', 'Crosshair'], ['video', 'Picture and sound']];
    const range = (k, label, min, max, step, v, fmt) => `<label class="sg-row"><span>${label}</span><input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${v}"><b>${fmt}</b></label>`;
    const check = (k, label, v) => `<label class="sg-row"><span>${label}</span><input type="checkbox" data-set="${k}" ${v ? 'checked' : ''}></label>`;
    const pick = (k, label, v, opts) => `<label class="sg-row"><span>${label}</span><select data-set="${k}">${opts.map(([o, n]) => `<option value="${o}" ${String(v) === String(o) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    let body = '';
    if (tab === 'controls') body = `<p class="dim">Click a key, then press the key or the mouse button to use (Esc: as it was). Keys go by their place: ZQSD on an AZERTY keyboard is the same as WASD.
${navigator.userAgent.includes('Firefox') ? ' In Firefox, Ctrl+W outside fullscreen closes the tab (the game asks first): crouch is on C as well.' : ''}</p><div class="sg-binds">${ACTIONS.map(([a, n]) => `<div class="sg-row"><span>${n}</span>${[0, 1].map((k) => `<button data-bind="${a}" data-k="${k}">${settings.binds[a][k] ? keyName(settings.binds[a][k]) : '—'}</button>`).join('')}</div>`).join('')}</div><button data-act="reset-binds">Back to the default keys</button>`;
    if (tab === 'mouse') body = range('sens', 'Mouse sensitivity', 0.0002, 0.005, 0.00005, settings.sens, `${(settings.sens * 1000).toFixed(2)} (a tactical shooter's ${cs})`) + range('zoomSens', 'Sensitivity in the glass', 0.3, 2, 0.05, settings.zoomSens, `× ${settings.zoomSens.toFixed(2)}`)
      + check('invert', 'Look inverted', settings.invert) + range('fov', 'Field of view', 1.2, 2.0, 0.02, settings.fov, `${Math.round(settings.fov * 180 / Math.PI)}°`) + pick('hand', 'Weapon in the', settings.hand, [['right', 'right hand'], ['left', 'left hand']]) + range('bob', 'Weapon bob', 0, 1.5, 0.1, settings.bob, `× ${settings.bob.toFixed(1)}`);
    if (tab === 'xhair') body = `<canvas class="sg-xprev" width="160" height="90"></canvas>` + pick('xhair.style', 'Style', X.style, [['dynamic', 'Opens as you move and shoot'], ['static', 'Fixed'], ['dot', 'A dot only']])
      + pick('xhair.color', 'Colour', X.color, [['#8cff6e', 'Green'], ['#ffe14a', 'Yellow'], ['#5af0ff', 'Cyan'], ['#ffffff', 'White'], ['#ff5a5a', 'Red'], ['#ff6aff', 'Pink']]) + range('xhair.size', 'Length', 2, 20, 1, X.size, X.size) + range('xhair.gap', 'Gap', 0, 14, 1, X.gap, X.gap) + range('xhair.thick', 'Thickness', 1, 5, 1, X.thick, X.thick) + check('xhair.outline', 'Dark outline', X.outline) + check('xhair.dot', 'Centre dot', X.dot);
    if (tab === 'video') body = pick('quality', 'Picture', settings.quality, QUALITY.map(([w, h], k) => [k, `${w} × ${h}`])) + pick('detail', 'Walls and floors', settings.detail, [['half', 'Columns two pixels wide (quicker)'], ['full', 'Every column (slower)']]) + check('fullscreen', 'Fullscreen when playing (the keyboard locked where the browser allows)', settings.fullscreen) + check('showFps', 'Frames a second', settings.showFps) + range('volume', 'Sound', 0, 1, 0.05, settings.volume, `${Math.round(settings.volume * 100)}%`);
    openMenu(`<h3>Settings</h3><nav class="sg-tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</nav><div class="sg-settings">${body}</div><button data-act="back">Back</button>`, 'sg-pause sg-setmenu');
    const m = ui.menu;
    m.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => settingsMenu(b.dataset.tab)));
    m.querySelector('[data-act="back"]').addEventListener('click', () => pauseMenu());
    m.querySelector('[data-act="reset-binds"]')?.addEventListener('click', () => { settings.binds = { ...BINDS }; saveSettings(); settingsMenu('controls'); });
    m.querySelectorAll('[data-bind]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); b.textContent = 'press a key…'; b.classList.add('on');
      setTimeout(() => { capture = (code) => { capture = null; if (code) { const a = b.dataset.bind; const k = Number(b.dataset.k); const list = settings.binds[a].slice(); list[k] = code; settings.binds[a] = list.filter(Boolean); saveSettings(); } settingsMenu('controls'); }; }, 0); }));
    m.querySelectorAll('[data-set]').forEach((el) => el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
      const path = el.dataset.set.split('.'); const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.tagName === 'SELECT' && /^\d+$/.test(el.value) ? Number(el.value) : el.value;
      if (path.length === 2) settings[path[0]][path[1]] = v; else settings[path[0]] = v; saveSettings();
      if (path[0] === 'quality') applyQuality(); if (path[0] === 'volume' && master) master.gain.value = v;
      if (el.type === 'range') { const b = el.nextElementSibling; if (b) b.textContent = path[0] === 'sens' ? `${(v * 1000).toFixed(2)} (a tactical shooter's ${(v / (0.022 * Math.PI / 180)).toFixed(2)})` : path[0] === 'fov' ? `${Math.round(v * 180 / Math.PI)}°` : path[0] === 'volume' ? `${Math.round(v * 100)}%` : /zoomSens|bob/.test(path[0]) ? `× ${v.toFixed(2)}` : v; }
      drawXPreview();
    }));
    drawXPreview();
  }
  function drawXPreview() { const c = ui.menu.querySelector('.sg-xprev'); if (!c) return; const x = c.getContext('2d'); x.fillStyle = '#5a6a7a'; x.fillRect(0, 0, 160, 90); x.fillStyle = '#8a7a60'; x.fillRect(0, 50, 160, 40); crosshair(x, 80, 45, 0); }
  /** The crosshair at (cx, cy), opened by spread (degrees) when dynamic. */
  function crosshair(c, cx, cy, spread) {
    const X = settings.xhair; const L = X.size; const t = X.thick; const gap = X.gap + (X.style === 'dynamic' ? spread * 3 : 0);
    const bars = X.style === 'dot' ? [] : [[gap, -t / 2, L, t], [-gap - L, -t / 2, L, t], [-t / 2, gap, t, L], [-t / 2, -gap - L, t, L]]; if (X.dot || X.style === 'dot') bars.push([-t / 2, -t / 2, t, t]);
    if (X.outline) { c.fillStyle = 'rgba(0,0,0,.75)'; bars.forEach(([x, y, w, h]) => c.fillRect(Math.round(cx + x) - 1, Math.round(cy + y) - 1, w + 2, h + 2)); }
    c.fillStyle = X.color; bars.forEach(([x, y, w, h]) => c.fillRect(Math.round(cx + x), Math.round(cy + y), w, h));
  }
  /** Too slow a machine (the picture over 20 ms, two seconds running): a smaller picture, then half detail. */
  function autoQuality(ms) {
    g.rms = (g.rms ?? 10) * 0.97 + ms * 0.03; if (g.paused || g.rms < 20 || g.now - (g.qAt ?? 0) < 2) return; g.qAt = g.now; g.rms = 10;
    if (settings.quality > 0) { settings.quality -= 1; applyQuality(); } else if (settings.detail === 'full') settings.detail = 'half'; else return;
    saveSettings(); say(`A smaller picture for this machine: ${W} × ${H}${settings.detail === 'half' ? ', half detail' : ''} (Settings to change it).`, 4);
  }
  function applyQuality() { [W, H] = QUALITY[settings.quality] || QUALITY[1]; cv.width = W; cv.height = H; img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W * H); worldT = { buf, W, H, ZB: zbuf }; skyTex = null; }
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

  /* ---- input: every key and button goes through the bindings; while playing, the browser keeps none of its
     own (no find bar on ' or /, no menu bar on Alt, no back on the mouse's side buttons, no zoom on Ctrl and the
     wheel, no leaving the page by mistake: it asks first). Fullscreen with the keyboard locked where the browser
     allows (Esc and Ctrl+W then reach the game); the mouse raw where it allows. ---- */
  const H_ = {};
  async function grab() {
    wake();
    try { if (settings.fullscreen && !document.fullscreenElement) await root.requestFullscreen({ navigationUI: 'hide' }); } catch { /* (refused: windowed) */ }
    try { if (document.fullscreenElement && navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock(); } catch { /* (no keyboard lock here) */ }
    try { await Promise.resolve(cv.requestPointerLock({ unadjustedMovement: true })); } catch { try { await Promise.resolve(cv.requestPointerLock()); } catch { /* (no lock: the menu stays) */ } }
  }
  const playing = () => g && document.pointerLockElement === cv && !g.paused;
  /** A key or button pressed: the actions bound to it that act once (holding ones are read each frame). */
  function press(code, e) {
    const p = g.player; if (e && buyKey(e)) return;
    actionsOf(code).forEach((act) => {
      if (act === 'scores') scores(true);
      else if (act === 'buy') { if (ui.menu.classList.contains('sg-buy') && !ui.menu.hidden) closeMenu(); else buyMenu(); }
      else if (act === 'forge') forge();
      else if (!p.alive) { if (act === 'use') takeOver(); else if (act === 'attack' || act === 'jump') g.specIdx = (g.specIdx || 0) + 1; }
      else if (act === 'reload') reload(p);
      else if (act === 'inspect') { g.inspect = 0; if (cur(p) === 'knife') sfx('swish'); }
      else if (act === 'jump') jump(p);
      else if (act.startsWith('slot')) selectSlot(Number(act.slice(4)));
      else if (act === 'lastweapon') selectSlot(g.lastSlot || 3);
      else if (act === 'nextweapon' || act === 'prevweapon') { const order = [1, 2, 3, 4, 5].filter((n) => hasSlot(p, n)); const k = order.indexOf(p.slot); selectSlot(order[(k + (act === 'nextweapon' ? 1 : order.length - 1)) % order.length]); }
      else if (act === 'drop') { if (p.slot === 5) dropKeg(p, true); else if (p.slot === 1 || p.slot === 2) dropWeapon(p, p.slot, true); }
      else if (act === 'use') pickUpFacing(p);
      else if ((act === 'attack' || act === 'attack2') && p.slot === 4) { g.pinAt = g.now; } // (the pin out, the fuse lit: thrown on letting go)
      else if (act === 'attack2') { const w = ARMS.W[cur(p)]; if (w.scoped) { p.scoped = !p.scoped; sfx('click'); } else if (w.melee) shoot(p); }
    });
  }
  function release(code) {
    const p = g.player;
    actionsOf(code).forEach((act) => {
      if (act === 'scores') scores(false);
      if ((act === 'attack' || act === 'attack2') && p.alive && p.slot === 4 && g.pinAt >= 0 && g.nade) {
        const power = held('attack') && held('attack2') ? 0.75 : act === 'attack2' && !held('attack') ? 0.5 : 1; g.pinAt = -1;
        if (throwIt(p, g.nade, null, power) && !p.gear[g.nade]) setTimeout(() => { if (g && p.slot === 4) selectSlot(hasSlot(p, 4) ? 4 : g.lastSlot || 3, true); }, 450);
      }
    });
  }
  const hasSlot = (p, n) => (n <= 3 ? Boolean(p.weapons[n]) : n === 4 ? ['he', 'flash', 'smoke', 'fire'].some((k) => p.gear[k]) : g.keg.carrier === p);
  /** To a slot: its weapon drawn (slot 4 again: the next throwable). */
  function selectSlot(n, quiet) {
    const p = g.player; if (!hasSlot(p, n)) return;
    if (n === 4) { const order = ['he', 'flash', 'smoke', 'fire'].filter((k) => p.gear[k]); const k = order.indexOf(g.nade); g.nade = p.slot === 4 && !quiet ? order[(k + 1) % order.length] : order.includes(g.nade) ? g.nade : order[0]; }
    if (p.slot === n && n !== 4) return;
    if (p.slot !== n) g.lastSlot = p.slot; p.slot = n; p.scoped = false; g.inspect = -1; g.drawAt = g.now; g.slotAt = g.now; p.reloadUntil = 0; p.reloadId = null; g.pinAt = -1; if (!quiet) sfx('draw');
  }
  function bind() {
    H_.key = (e) => {
      if (!g) return;
      if (capture) { e.preventDefault(); e.stopImmediatePropagation(); if (e.code !== 'Escape') capture(e.code); else capture(null); return; }
      wake(); if (e.code === 'Escape') { e.preventDefault(); if (!e.repeat) escape(); return; }
      if (document.pointerLockElement === cv || !ui.menu.hidden) { if (e.code !== 'F11' && e.code !== 'F12') e.preventDefault(); }
      e.stopImmediatePropagation(); if (e.repeat) return;
      keys.add(e.code); press(e.code, e);
    };
    H_.up = (e) => { if (!g) return; if (e.code.startsWith('Alt') || document.pointerLockElement === cv) e.preventDefault(); keys.delete(e.code); release(e.code); };
    H_.mouse = (e) => { if (g && menuIs('sg-buy') && document.pointerLockElement === cv) { vmove(e.movementX, e.movementY); return; } if (!playing()) return; const p = g.player.alive ? g.player : null; if (!p) return; const k = settings.sens * (p.scoped ? 0.3 * settings.zoomSens : 1); p.a += e.movementX * k; g.pitch = clamp(g.pitch - e.movementY * k * (settings.invert ? -1 : 1), -1.2, 1.2); g.sway = clamp(g.sway + e.movementX * 0.06, -14, 14); g.swayY = clamp((g.swayY || 0) + e.movementY * 0.06, -10, 10); };
    H_.down = (e) => {
      if (!g || !root.contains(e.target)) return; if (e.button > 0) e.preventDefault(); wake();
      if (capture) { capture(`Mouse${e.button}`); return; }
      if (menuIs('sg-buy') && document.pointerLockElement === cv) { if (e.button === 0) { const b = vunder(); if (b) b.click(); } return; }
      if (e.target.closest('.sg-menu')) return;
      if (document.pointerLockElement !== cv) { grab(); return; }
      keys.add(`Mouse${e.button}`); press(`Mouse${e.button}`);
    };
    H_.mup = (e) => { if (!g) return; if (e.button > 0) e.preventDefault(); keys.delete(`Mouse${e.button}`); release(`Mouse${e.button}`); };
    H_.wheel = (e) => { if (!g || !root.contains(e.target) || e.target.closest('.sg-menu')) return; e.preventDefault(); const code = e.deltaY > 0 ? 'WheelDown' : 'WheelUp'; if (capture) { capture(code); return; } if (playing()) press(code); };
    H_.ctx = (e) => { if (root && root.contains(e.target)) e.preventDefault(); };
    H_.aux = (e) => { if (g) e.preventDefault(); };
    H_.drag = (e) => { if (g) e.preventDefault(); };
    H_.blur = () => { keys.clear(); if (g && !g.paused && ui.menu.hidden) pauseMenu(); }; // (the window left: nothing stays held)
    H_.unload = (e) => { if (g) { e.preventDefault(); e.returnValue = ''; } }; // (Ctrl+W, a slip: the browser asks first)
    H_.pop = () => { if (g) { history.pushState({ siege: 1 }, ''); if (!g.paused) pauseMenu(); } }; // (the back button: stays, pauses)
    H_.lock = () => { // (the mouse let go with no menu or the buying one: pause; taken again on the pause: play)
      if (!g) return; const locked = document.pointerLockElement === cv;
      if (!locked && (ui.menu.hidden || menuIs('sg-buy')) && !g.matchOver) pauseMenu();
      else if (locked && g.paused && !g.matchOver) { g.paused = false; closeMenu(); }
      vcursor();
    };
    history.pushState({ siege: 1 }, '');
    addEventListener('keydown', H_.key, true); addEventListener('keyup', H_.up, true); addEventListener('mousemove', H_.mouse); addEventListener('mousedown', H_.down, true); addEventListener('mouseup', H_.mup, true);
    addEventListener('wheel', H_.wheel, { passive: false, capture: true }); addEventListener('contextmenu', H_.ctx); addEventListener('auxclick', H_.aux, true); addEventListener('dragstart', H_.drag, true); addEventListener('blur', H_.blur);
    addEventListener('beforeunload', H_.unload); addEventListener('popstate', H_.pop); document.addEventListener('pointerlockchange', H_.lock);
  }
  function unbind() {
    removeEventListener('keydown', H_.key, true); removeEventListener('keyup', H_.up, true); removeEventListener('mousemove', H_.mouse); removeEventListener('mousedown', H_.down, true); removeEventListener('mouseup', H_.mup, true);
    removeEventListener('wheel', H_.wheel, { capture: true }); removeEventListener('contextmenu', H_.ctx); removeEventListener('auxclick', H_.aux, true); removeEventListener('dragstart', H_.drag, true); removeEventListener('blur', H_.blur);
    removeEventListener('beforeunload', H_.unload); removeEventListener('popstate', H_.pop); document.removeEventListener('pointerlockchange', H_.lock); keys.clear();
    try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); if (document.fullscreenElement) document.exitFullscreen(); } catch { /* (nothing to give back) */ }
  }

  /* ---- sound: made here (WebAudio), placed by where it comes from, fainter far off ---- */
  /* ---- sound, made on the spot: each sound placed (left or right of the listener, fainter far off, muffled
     behind walls), footsteps by what is underfoot (stone, wood, earth), the weapons by their kind ---- */
  let audio = null; let noiseBuf = null; let master = null;
  function wake() { if (!audio) audioOn(); else if (audio.state === 'suspended') audio.resume(); }
  function audioOn() { try { audio = new AudioContext(); master = audio.createGain(); master.gain.value = settings.volume; master.connect(audio.destination); noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1; } catch { audio = null; } }
  function sfx(kind, from, wid) {
    if (!audio || !g) return; const p = camActor(); let pan = 0; let vol = 1; let muffle = 20000;
    if (from && from !== p && from.x !== undefined) { const d = Math.hypot(from.x - p.x, from.y - p.y); vol = 1 / (1 + d * 0.3); pan = clamp(Math.sin(wrap(Math.atan2(from.y - p.y, from.x - p.x) - p.a)), -1, 1) * 0.85;
      if (d > 1 && !clear(p.x, p.y, eyeOf(p), from.x, from.y, (from.z || 0) + 0.5)) { muffle = 900; vol *= 0.6; } } // (behind a wall: dull and fainter)
    if (vol < 0.02) return;
    const t = audio.currentTime; const out = audio.createStereoPanner(); out.pan.value = pan; const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = muffle; out.connect(lp).connect(master);
    const nz = (f, dur, v, type = 'bandpass', at = 0, q = 1) => { const s2 = audio.createBufferSource(); s2.buffer = noiseBuf; s2.playbackRate.value = 0.8 + Math.random() * 0.4; const fl = audio.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gn = audio.createGain(); gn.gain.setValueAtTime(v * vol, t + at); gn.gain.exponentialRampToValueAtTime(0.0001, t + at + dur); s2.connect(fl).connect(gn).connect(out); s2.start(t + at); s2.stop(t + at + dur); };
    const tn = (f0, f1, dur, v, type = 'sine', at = 0) => { const o = audio.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + at + dur); const gn = audio.createGain(); gn.gain.setValueAtTime(v * vol, t + at); gn.gain.exponentialRampToValueAtTime(0.0001, t + at + dur); o.connect(gn).connect(out); o.start(t + at); o.stop(t + at + dur); };
    const under = () => { const m = from ? matAt(Math.floor(from.x), Math.floor(from.y)) : 'c'; return 'pk'.includes(m) ? 'wood' : 'ea'.includes(m) ? 'earth' : 'stone'; };
    ({
      shot: () => { if (wid === 'ak47') { nz(2400, 0.12, 0.6, 'bandpass', 0, 0.7); tn(260, 60, 0.12, 0.35, 'square'); nz(500, 0.5, 0.18, 'lowpass', 0.03); }
        else if (wid === 'repeater' || wid === 'greatbow') { tn(140, 70, 0.12, 0.4, 'triangle'); nz(3000, 0.06, 0.3, 'highpass'); } // (a bow's thrum)
        else { const big = ['arquebus', 'caliver', 'blunderbuss'].includes(wid); nz(big ? 700 : 1400, big ? 0.3 : 0.2, 0.6); tn(big ? 110 : 180, 35, 0.3, 0.45); nz(240, big ? 1.4 : 0.8, 0.22, 'lowpass', 0.05); } }, // (black powder: a boom, then its rolling tail)
      reload: () => { nz(3000, 0.05, 0.2, 'highpass'); nz(1500, 0.08, 0.15, 'bandpass', 0.5); nz(4000, 0.04, 0.2, 'highpass', 0.9); },
      hit: () => tn(1900, 1700, 0.05, 0.1, 'square'), kill: () => { tn(900, 900, 0.06, 0.12, 'square'); tn(1350, 1350, 0.08, 0.12, 'square', 0.07); },
      click: () => nz(4000, 0.03, 0.15, 'highpass'), draw: () => { nz(2500, 0.06, 0.12); nz(5000, 0.03, 0.08, 'highpass', 0.12); }, buy: () => tn(880, 1320, 0.12, 0.08),
      swish: () => nz(1800, 0.18, 0.2, 'bandpass', 0, 2), stab: () => { nz(600, 0.12, 0.3, 'lowpass'); tn(160, 80, 0.12, 0.2); },
      step: () => { const u = under(); if (u === 'wood') { tn(140, 90, 0.07, 0.22, 'triangle'); nz(900, 0.05, 0.08); } else if (u === 'earth') nz(250, 0.09, 0.16, 'lowpass'); else { nz(500, 0.06, 0.14, 'bandpass', 0, 2); nz(2600, 0.02, 0.05, 'highpass'); } },
      tink: () => tn(3200, 2900, 0.25, 0.2), thud: () => tn(140, 60, 0.15, 0.3), clink: () => tn(2600 + Math.random() * 600, 2000, 0.08, 0.08, 'triangle'),
      throw: () => nz(1200, 0.15, 0.12), boom: () => { nz(150, 0.9, 0.9, 'lowpass'); tn(80, 30, 0.8, 0.6); nz(2000, 0.3, 0.2, 'highpass', 0.05); }, bigboom: () => { nz(90, 2.6, 1, 'lowpass'); tn(60, 20, 2.2, 0.8); },
      hiss: () => nz(5000, 2.5, 0.12, 'highpass'), whoosh: () => { nz(700, 1, 0.3); nz(300, 2.5, 0.12, 'lowpass', 0.3); }, flash: () => { tn(4200, 3800, 1.5, 0.15); nz(2000, 0.1, 0.4); },
      beep: () => tn(1400, 1400, 0.09, 0.2, 'square'), fuse: () => nz(6000, 0.25, 0.06, 'highpass'), planted: () => [0, 0.15, 0.3].forEach((d) => tn(1000, 1000, 0.1, 0.2, 'square', d)),
      defusing: () => { nz(3500, 0.05, 0.12, 'highpass'); }, defused: () => { tn(600, 300, 0.3, 0.15); nz(5000, 0.4, 0.1, 'highpass'); },
      horn: () => { tn(220, 220, 0.6, 0.12, 'sawtooth'); tn(330, 330, 0.8, 0.1, 'sawtooth', 0.15); }, warn: () => [0, 0.2].forEach((d) => tn(700, 700, 0.12, 0.12, 'triangle', d)),
      heart: () => { tn(60, 40, 0.12, 0.35); tn(55, 40, 0.1, 0.25, 'sine', 0.18); }, land: () => nz(200, 0.12, 0.25, 'lowpass'),
      win: () => [523, 659, 784].forEach((f, k) => tn(f, f, 0.4, 0.15, 'triangle', k * 0.16)), lose: () => [392, 330, 262].forEach((f, k) => tn(f, f, 0.45, 0.15, 'triangle', k * 0.18)),
    }[kind] || (() => {}))();
  }

  window.Siege = { start, stop, state: () => g && { phase: g.phase, round: g.round, score: { ...g.score }, alive: g.actors.filter((a) => a.alive).length, player: { hp: g.player.hp, x: g.player.x, y: g.player.y, money: g.player.money } }, debug: () => g, sim: (sec) => { for (let k = 0; k < sec * 60 && g; k += 1) { g.now += 1 / 60; update(1 / 60); } } }; // (sim: the game run ahead without drawing, for the tests)
}());
