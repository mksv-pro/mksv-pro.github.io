/* Siege: a first-person game under the castle, five against five with bots, rounds and an economy, a
   keg of powder to plant or to defuse (after the tactical shooters, in the castle's century). The world
   is a grid of blocks drawn by ray casting (Lodev's DDA, a ray a column; the floor cast row by row),
   textured from textures.js in the castle's palette; actors, smoke, fire and thrown things are sprites
   against a depth buffer. 320 x 180 pixels, scaled up whole. Loaded on demand (ui: the `siege` command,
   the descent's stair); its arms in weapons.js, its bots in bots.js. */
(function () {
  const ARMS = window.SIEGE_ARMS; const BOTS = window.SIEGE_BOTS; const PAL = window.HOURS_PALETTE; const TEX = window.TEXTURES;
  const W = 320; const H = 180; const FOV = 1.15; // (radians across)
  const WALL_H = 2.2; // a wall's height, in the units of the grid (a man is 0.86, his eyes at 0.62)
  const MAP = [ // # stone, W wood, R brick, M mossy stone, C crate; floors: . yard, a and b the keg's sites, d the defenders' gate, t the attackers'
    '#############MMMMMMMM#############',
    '############MddddddddM############',
    '####.........dddddddd..........###',
    '###W.........dddddddd..........W##',
    '##CbbbbbbbW##MMM..MMM##WaaaaaaaaW#',
    '#WbbbbCbbbW#####..#####WaaaaaaaaW#',
    '#WbbbbCbbbW#####..#####WaaaCCaaaW#',
    '#WbbbbCbbbW#####..#####WaaaCaaaaW#',
    '#Wbbbbbbbb..####..####..aaaaaaaaW#',
    '#Wbbbbbbbb..####C.####..aaaaaaaaW#',
    '#WbbbbbbbbW#####..#####WaaaaaaaC##',
    '##WW..................##........##',
    '####..........C....C..##........##',
    '####..######..........########..##',
    '####..##########..############..##',
    '####.C##########..############..##',
    '####..##########..############C.##',
    '####..##########..############..##',
    '####..#######RRR..RRR#########..##',
    '####.........ttttttttR########..##',
    '####.........tttttttt...........##',
    '############Rtttttttt...........##',
    '############RttttttttR############',
    '#############RRRRRRRR#############',
  ];
  const MW = MAP[0].length; const MH = MAP.length;
  const WALLS = { '#': 'ashlar', W: 'planksUpright', R: 'brickRunning', M: 'mossyStone', C: 'staves' };
  const FLOORS = { '.': 'flagstones', a: 'mosaic', b: 'encaustic', d: 'cobbles', t: 'cobbles' };
  const T = 32; // texture size
  const pack = (c) => (255 << 24) | (Math.max(0, Math.min(255, c[2] | 0)) << 16) | (Math.max(0, Math.min(255, c[1] | 0)) << 8) | Math.max(0, Math.min(255, c[0] | 0));
  const unpack = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const tex = {}; const texOf = (name) => (tex[name] ||= (() => { const t = new Uint32Array(T * T); const f = TEX[name].fn; for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) t[y * T + x] = pack(PAL.colourOf(f(x, y))); return t; })());

  /* ---- the actors' sprites: a soldier in a tabard of his side's colour, two walking frames, and fallen ---- */
  const SOLDIER = [`
....aaaa....
...aaaaaa...
...akkkka...
...affffa...
....ffff....
..ccccccCC..
.fcccXcccCf.
.fcccXcccCf.
.fcccXccCCf.
.fcccccccCf.
..ccccccCC..
..hhhhhhhh..
...ll..ll...
...ll..ll...
...ll..ll...
...ll..ll...
..bbb..bbb..`, `
....aaaa....
...aaaaaa...
...akkkka...
...affffa...
....ffff....
..ccccccCC..
.fcccXcccCf.
.fcccXcccCf.
.fcccXccCCf.
.fcccccccCf.
..ccccccCC..
..hhhhhhhh..
...ll...ll..
..ll....ll..
..ll.....ll.
.ll......ll.
.bbb.....bbb`];
  const sprites = {};
  function soldier(team) {
    if (sprites[team]) return sprites[team];
    const cloth = team === 'def' ? [[60, 90, 200], [40, 64, 150]] : [[200, 50, 40], [140, 30, 30]];
    const C = { a: [168, 174, 186], k: [30, 30, 40], f: [216, 160, 120], c: cloth[0], C: cloth[1], X: [240, 210, 110], h: [110, 70, 40], l: [80, 60, 50], b: [40, 30, 26] };
    const frames = SOLDIER.map((txt) => { const rows = txt.trim().split('\n'); return { w: rows[0].length, h: rows.length, px: rows.join('').split('').map((ch) => (C[ch] ? pack(C[ch]) : 0)) }; });
    const d = frames[0]; const dead = { w: d.h, h: d.w, px: new Array(d.w * d.h).fill(0) }; // (lying: the standing figure on its side)
    for (let y = 0; y < d.h; y += 1) for (let x = 0; x < d.w; x += 1) dead.px[x * d.h + y] = d.px[y * d.w + x];
    return (sprites[team] = { frames, dead });
  }
  const KEG = { w: 7, h: 6, px: [0, 3, 3, 3, 3, 3, 0, 3, 2, 2, 2, 2, 2, 3, 3, 1, 1, 1, 1, 1, 3, 3, 2, 2, 2, 2, 2, 3, 3, 1, 1, 1, 1, 1, 3, 0, 3, 3, 3, 3, 3, 0].map((v) => [0, pack([120, 80, 44]), pack([150, 104, 60]), pack([60, 60, 70])][v]) };

  /* ---- the game ---------------------------------------------------------------------------------- */
  let g = null; let raf = 0; let root = null; let cv; let ctx; let img; let buf; let zbuf; let ui = {};
  const keys = new Set(); let mouseDown = [false, false, false];
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { /* (no storage: nothing kept) */ } return null; };
  const wallAt = (x, y) => { if (x < 0 || y < 0 || x >= MW || y >= MH) return '#'; const c = MAP[y][x]; return WALLS[c] ? c : null; };

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
      knife: ARMS.knife(knife), knifeRecipe: knife, pitch: 0, punch: 0, kick: 0, inspect: -1, swing: -1, flashUntil: 0, flashAt: 0, hurtAt: -9, scoped: false, msg: '', msgUntil: 0, opts, paused: false };
    g.wall = (x, y) => Boolean(wallAt(x, y)); g.give = give; Object.assign(g, api); // (the bots' handle on the game: what they read, what they do through it)
    // the sites, the gates, the posts the defenders hold
    const cells = (ch) => { const out = []; MAP.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x + 0.5, y + 0.5]); })); return out; };
    const free = (x, y) => { let best = null; let bd = 1e9; MAP.forEach((r, yy) => [...r].forEach((c, xx) => { if (WALLS[c]) return; const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); if (d < bd) { bd = d; best = [xx + 0.5, yy + 0.5]; } })); return best; }; // (the open cell nearest a point: a centre may fall on a crate)
    ['a', 'b'].forEach((ch) => { const cs = cells(ch); const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length; const cy = cs.reduce((s, c) => s + c[1], 0) / cs.length; g.sites.push({ name: ch.toUpperCase(), cells: cs, c: free(cx, cy) }); });
    g.spawns = { def: cells('d'), att: cells('t') };
    g.posts.def = [g.sites[0].c, g.sites[1].c, free(g.sites[0].c[0] - 2, g.sites[0].c[1] + 2), free(g.sites[1].c[0] + 2, g.sites[1].c[1] + 2), free(17, 12)];
    // the sides: the visitor and four bots against five
    g.player = newActor('def', 0, false, 'You'); g.actors.push(g.player);
    const NAMES = ['Aymeric', 'Bertrand', 'Clotilde', 'Driss', 'Enguerrand', 'Fulk', 'Gersende', 'Hugues', 'Isabeau', 'Jehan'];
    for (let k = 1; k < 5; k += 1) g.actors.push(newActor('def', k, true, NAMES[k - 1]));
    for (let k = 0; k < 5; k += 1) g.actors.push(newActor('att', k, true, NAMES[k + 4]));
    build(); bind(); newRound(true);
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
    g.round += 1;
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
    say(`${mine ? 'Round won' : 'Round lost'}: ${{ elim: 'every one of the other side down', time: 'time ran out', keg: 'the keg went up', defused: 'the keg defused' }[why]}.`, 4);
    sfx(mine ? 'win' : 'lose');
    if (g.score[winner] >= 8) { g.matchOver = winner; say(mine ? 'The match is yours, 8 rounds won. Esc: again or leave.' : 'The match is lost. Esc: again or leave.', 99); }
  }
  function say(t, s = 3) { g.msg = t; g.msgUntil = g.now + s; }

  /* ---- moving: speed, acceleration and friction as in the tactical shooters; walls block a circle of 0.22 ---- */
  const R = 0.22;
  function move(a, dx, dy, dt, speedK = 1) {
    const w = ARMS.W[cur(a)]; const max = 3.6 * (w.speed || 1) * speedK * (a.crouch ? 0.34 : 1) * (a.scoped ? 0.6 : 1);
    const n = Math.hypot(dx, dy); const tx = n ? (dx / n) * max : 0; const ty = n ? (dy / n) * max : 0;
    const k = Math.min(1, dt * (n ? 10 : 6)); a.vx += (tx - a.vx) * k; a.vy += (ty - a.vy) * k;
    const nx = a.x + a.vx * dt; const ny = a.y + a.vy * dt;
    const free = (x, y) => !wallAt(Math.floor(x - R), Math.floor(y - R)) && !wallAt(Math.floor(x + R), Math.floor(y - R)) && !wallAt(Math.floor(x - R), Math.floor(y + R)) && !wallAt(Math.floor(x + R), Math.floor(y + R));
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
    t.hp -= d; if (t === g.player) { g.hurtAt = g.now; g.hurtFrom = by ? Math.atan2(by.y - t.y, by.x - t.x) : null; }
    if (head) sfx(t.helm ? 'tink' : 'thud', t);
    if (t.hp <= 0) {
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
      const hz = eye + Math.tan(pitch) * along; const top = o.crouch ? 0.62 : 0.86; if (hz < 0 || hz > top) return;
      best = { o, head: hz > top - 0.16, d: along }; bd = along;
    });
    if (smokeHides(a.x, a.y, a.x + Math.cos(yaw) * bd, a.y + Math.sin(yaw) * bd) && best && best.d > 2) best = null; // (a shot into smoke: no telling where it goes)
    if (best) damage(best.o, w.dmg * (best.head ? w.head : 1) * (1 - (w.fall || 0)) ** (best.d / 10), w.pierce ?? 1, best.head, a, wid);
    else g.fx.push({ kind: 'puff', x: a.x + Math.cos(yaw) * (wd - 0.05), y: a.y + Math.sin(yaw) * (wd - 0.05), z: eye + Math.tan(pitch) * wd, t: g.now });
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
    if (w.melee) { a.lastShot = g.now; if (a === g.player) { g.swing = 0; sfx('swish'); } stab(a, target); return; }
    const am = a.ammo[wid]; if (!am || am.mag <= 0) { reload(a); return; }
    am.mag -= 1; if (g.now - a.lastShot > 0.45) a.shotN = 0; a.lastShot = g.now; noise(a, 18); sfx('shot', a, wid);
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
    a.reloadUntil = g.now + w.reload; a.reloadId = wid; sfx('reload', a);
    setTimeout(() => { if (!g || a.reloadId !== wid) return; const n = Math.min(w.mag - am.mag, am.res); am.mag += n; am.res -= n; }, w.reload * 1000);
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
      if (wallAt(Math.floor(nx), Math.floor(n.y))) n.vx *= -0.5; else n.x = nx;
      if (wallAt(Math.floor(n.x), Math.floor(ny))) n.vy *= -0.5; else n.y = ny;
      n.z += n.vz * dt; if (n.z < 0) { n.z = 0; n.vz *= -0.4; n.vx *= 0.7; n.vy *= 0.7; if (n.kind === 'fire') { goOff(n); return false; } }
      const age = g.now - n.t0; const slow = Math.hypot(n.vx, n.vy) < 0.4 && n.z < 0.05;
      if ((n.kind === 'he' && age > 1.6) || (n.kind === 'flash' && age > 1.4) || (n.kind === 'smoke' && (slow || age > 2.5))) { goOff(n); return false; }
      return true;
    });
    g.smokes = g.smokes.filter((s) => g.now < s.until); g.fires = g.fires.filter((f) => g.now < f.until && !g.smokes.some((s) => Math.hypot(s.x - f.x, s.y - f.y) < s.r));
    g.fires.forEach((f) => g.actors.forEach((a) => { if (a.alive && Math.hypot(a.x - f.x, a.y - f.y) < f.r && Math.random() < dt * 4) damage(a, 8, 1, false, f.by, 'fire'); }));
    g.fx = g.fx.filter((f) => g.now - f.t < 0.6);
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
    g.punch *= Math.exp(-dt * 6); g.kick = Math.max(0, g.kick - dt * 6);
    if (g.inspect >= 0) { g.inspect += dt / 2.4; if (g.inspect > 1) g.inspect = -1; }
    if (g.swing >= 0) { g.swing += dt * 4; if (g.swing > 1) g.swing = -1; }
    // the bots
    g.actors.forEach((b) => { if (b.isBot) { BOTS.think(b, g, dt); if (b.alive && g.keg.dropped && b.team === 'att' && Math.hypot(g.keg.x - b.x, g.keg.y - b.y) < 0.7) { g.keg.dropped = false; g.keg.carrier = b; } } });
    updateNades(dt);
  }
  // what the bots call
  const api = { move: (a, dx, dy, dt) => move(a, dx, dy, dt), fire: (a, t, e) => shoot(a, t, e), plant, defuse, throw: throwIt, sees, onSite };

  /* ---- drawing ---- */
  function render() {
    const p = g.player; const eye = (p.crouch ? 0.45 : 0.62) + p.z; const zoom = p.scoped ? 0.28 : 1; const fov = FOV * zoom;
    const pitchPx = Math.round((g.pitch + g.punch) * H * 1.1); const hor = Math.floor(H / 2 + pitchPx);
    const dirX = Math.cos(p.a); const dirY = Math.sin(p.a); const pl = Math.tan(fov / 2); const plX = -dirY * pl; const plY = dirX * pl;
    const day = [118, 162, 214]; const haze = [196, 206, 214];
    // the sky
    for (let y = 0; y < Math.min(H, hor); y += 1) { const k = clamp((hor - y) / (H * 0.9), 0, 1); const c = pack(day.map((v, i) => haze[i] + (v - haze[i]) * k)); buf.fill(c, y * W, y * W + W); }
    // the floor, row by row
    const rx0 = dirX - plX; const ry0 = dirY - plY; const rx1 = dirX + plX; const ry1 = dirY + plY; const posZ = eye * H;
    for (let y = Math.max(0, hor + 1); y < H; y += 1) {
      const rowD = posZ / ((y - hor) * 2 * pl); const fog = clamp(rowD / 22, 0, 1); // (the distance of the floor seen on this row: as the walls are scaled)
      let fx = p.x + rowD * rx0; let fy = p.y + rowD * ry0; const sx = (rowD * (rx1 - rx0)) / W; const sy = (rowD * (ry1 - ry0)) / W;
      for (let x = 0; x < W; x += 1) {
        const cx = Math.floor(fx); const cy = Math.floor(fy); const ch = cy >= 0 && cy < MH && cx >= 0 && cx < MW ? MAP[cy][cx] : '.';
        const t = texOf(FLOORS[ch] || 'flagstones'); const c = unpack(t[((Math.floor((fy - cy) * T) & (T - 1)) * T) + (Math.floor((fx - cx) * T) & (T - 1))]);
        buf[y * W + x] = pack(c.map((v, i) => v + (haze[i] - v) * fog * 0.8)); fx += sx; fy += sy;
      }
    }
    // the walls, a ray a column
    for (let x = 0; x < W; x += 1) {
      const cam = (2 * x) / W - 1; const rdx = dirX + plX * cam; const rdy = dirY + plY * cam;
      let mx = Math.floor(p.x); let my = Math.floor(p.y); const ddx = Math.abs(1 / rdx); const ddy = Math.abs(1 / rdy); const sx = rdx < 0 ? -1 : 1; const sy = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? p.x - mx : mx + 1 - p.x) * ddx; let sdy = (rdy < 0 ? p.y - my : my + 1 - p.y) * ddy; let side = 0; let hit = null;
      for (let k = 0; k < 80 && !hit; k += 1) { if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; } hit = wallAt(mx, my); }
      const perp = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy); zbuf[x] = perp;
      const lh = H / perp / (pl * 2); const top = Math.floor(hor - lh * (WALL_H - eye)); const bot = Math.floor(hor + lh * eye);
      let wx = side === 0 ? p.y + perp * rdy : p.x + perp * rdx; wx -= Math.floor(wx); let tx = Math.floor(wx * T); if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = T - 1 - tx;
      const t = texOf(WALLS[hit] || 'ashlar'); const fog = clamp(perp / 22, 0, 1); const shade = side ? 0.78 : 1;
      for (let y = Math.max(0, top); y < Math.min(H, bot); y += 1) { const ty = Math.floor(((y - top) / (bot - top)) * T * WALL_H) & (T - 1); /* (the texture once a unit of height) */ const c = unpack(t[ty * T + tx]); buf[y * W + x] = pack(c.map((v, i) => v * shade + (haze[i] - v * shade) * fog * 0.8)); }
    }
    // the sprites, far to near
    const spr = [];
    g.actors.forEach((a) => { if (a === p) return; const s = soldier(a.team); spr.push({ x: a.x, y: a.y, img: a.alive ? s.frames[a.moving ? Math.floor(g.now * 6 + a.idx) % 2 : 0] : s.dead, h: a.alive ? (a.crouch ? 0.62 : 0.86) : 0.25, z: 0, wk: a.alive ? 0.42 : 0.62 }); });
    if (g.keg.dropped || g.keg.planted) spr.push({ x: g.keg.x, y: g.keg.y, img: KEG, h: 0.2, z: 0, wk: 0.24, glow: g.keg.planted && Math.floor(g.now * 4) % 2 });
    g.nades.forEach((n) => spr.push({ x: n.x, y: n.y, z: n.z, h: 0.08, wk: 0.08, dot: n.kind === 'flash' ? [240, 240, 255] : n.kind === 'smoke' ? [150, 150, 150] : [120, 80, 40] }));
    g.smokes.forEach((s) => { const k = Math.min(1, (g.now - s.t0) / 1.5) * Math.min(1, (s.until - g.now) / 2); for (let j = 0; j < 14; j += 1) { const q = j * 2.39996; const r = Math.sqrt(j / 14) * s.r * k; spr.push({ x: s.x + Math.cos(q) * r, y: s.y + Math.sin(q) * r, z: 0, h: 1.3 * k, wk: 1.3 * k, cloud: [178, 180, 186], alpha: 0.9 }); } });
    g.fires.forEach((f) => { for (let j = 0; j < 8; j += 1) { const q = j * 2.39996 + g.now; const r = Math.sqrt(j / 8) * f.r; spr.push({ x: f.x + Math.cos(q) * r, y: f.y + Math.sin(q) * r, z: 0, h: 0.35 + Math.random() * 0.2, wk: 0.25, flame: true }); } });
    g.fx.forEach((f) => spr.push({ x: f.x, y: f.y, z: f.z, h: f.kind === 'blast' ? (f.big ? 3 : 1.4) : 0.06, wk: f.kind === 'blast' ? (f.big ? 4 : 1.6) : 0.06, flame: f.kind === 'blast', dot: f.kind === 'puff' ? [220, 210, 190] : null }));
    const invDet = 1 / (plX * dirY - dirX * plY);
    spr.forEach((s) => { const rx = s.x - p.x; const ry = s.y - p.y; s.ty = invDet * (-plY * rx + plX * ry); s.tx = invDet * (dirY * rx - dirX * ry); });
    spr.filter((s) => s.ty > 0.1).sort((a, b) => b.ty - a.ty).forEach((s) => {
      const scale = H / s.ty / (pl * 2); const sx = Math.floor((W / 2) * (1 + s.tx / s.ty));
      const hgt = s.h * scale; const wid = s.wk * scale; const bot = hor + (eye - s.z) * scale; const top = bot - hgt; const fog = clamp(s.ty / 22, 0, 1);
      for (let x = Math.max(0, Math.floor(sx - wid / 2)); x < Math.min(W, sx + wid / 2); x += 1) {
        if (s.ty >= zbuf[x]) continue; const u = (x - (sx - wid / 2)) / wid;
        for (let y = Math.max(0, Math.floor(top)); y < Math.min(H, bot); y += 1) {
          const v = (y - top) / hgt; let c = null;
          if (s.img) { const px = s.img.px[Math.floor(v * s.img.h) * s.img.w + Math.floor(u * s.img.w)]; if (px) c = unpack(px); if (c && s.glow) c = [255, 120, 60]; }
          else if (s.dot) { if (Math.hypot(u - 0.5, v - 0.5) < 0.5) c = s.dot; }
          else if (s.cloud) { const r = Math.hypot(u - 0.5, (v - 0.5) * 1.2); if (r < 0.5) { const o = unpack(buf[y * W + x]); const al = s.alpha * (1 - r * 1.6); buf[y * W + x] = pack(o.map((q, i) => q + (s.cloud[i] - q) * clamp(al, 0, 1))); } continue; }
          else if (s.flame) { const r = Math.hypot(u - 0.5, (v - 0.7)); if (r < 0.5 && Math.random() < 0.85 - r) c = r < 0.18 ? [255, 240, 160] : r < 0.32 ? [255, 160, 50] : [210, 60, 20]; }
          if (c) buf[y * W + x] = pack(c.map((q, i) => q + (haze[i] - q) * fog * 0.7));
        }
      }
    });
    // in the hand
    if (p.alive && !p.scoped) {
      const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = pack(c); };
      const bob = p.moving && p.z === 0 ? Math.sin(g.now * 9) * 2 : 0; const wid = cur(p);
      ARMS.drawHeld(wid, g.knife, put, W, H, { scale: 2, kick: g.kick, bob, inspect: g.inspect, swing: g.swing, reload: g.now < p.reloadUntil ? 1 - (p.reloadUntil - g.now) / ARMS.W[wid].reload : -1, flash: g.flashFrame });
      g.flashFrame = false;
    }
    // the scope: a ring of brass, dark outside
    if (p.scoped) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const r = Math.hypot(x - W / 2, y - H / 2); if (r > H * 0.46) buf[y * W + x] = pack([8, 8, 10]); else if (r > H * 0.45) buf[y * W + x] = pack([180, 140, 60]); else if ((Math.abs(x - W / 2) < 0.6 || Math.abs(y - H / 2) < 0.6)) buf[y * W + x] = pack([20, 20, 20]); }
    // blinded, hurt
    const fl = g.now < g.flashUntil ? clamp((g.flashUntil - g.now) / 1.2, 0, 1) : 0;
    if (fl > 0) for (let i = 0; i < W * H; i += 1) { const c = unpack(buf[i]); buf[i] = pack(c.map((v) => v + (255 - v) * fl)); }
    if (g.now - g.hurtAt < 0.35) { const k = 1 - (g.now - g.hurtAt) / 0.35; for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const e = Math.max(Math.abs(x / W - 0.5), Math.abs(y / H - 0.5)) * 2; if (e > 0.75) { const i = y * W + x; const c = unpack(buf[i]); buf[i] = pack([c[0] + (200 - c[0]) * k * 0.6, c[1] * (1 - k * 0.5), c[2] * (1 - k * 0.5)]); } } }
    if (!p.alive) for (let i = 0; i < W * H; i += 1) { const c = unpack(buf[i]); const m = (c[0] + c[1] + c[2]) / 3; buf[i] = pack([m * 0.8, m * 0.75, m * 0.7]); }
    ctx.putImageData(img, 0, 0);
    // the crosshair, its gap the spread
    if (p.alive && !p.scoped && cur(p) !== 'knife') { const gap = 2 + spreadOf(p, ARMS.W[cur(p)]) * 1.4; ctx.fillStyle = '#7cff7c'; [[gap, 0], [-gap - 4, 0]].forEach(([dx]) => ctx.fillRect(W / 2 + dx, H / 2, 4, 1)); [[gap], [-gap - 4]].forEach(([dy]) => ctx.fillRect(W / 2, H / 2 + dy, 1, 4)); }
    drawRadar();
  }
  function drawRadar() {
    const r = ui.radar; const c = r.getContext('2d'); const s = 3; r.width = MW * s; r.height = MH * s;
    for (let y = 0; y < MH; y += 1) for (let x = 0; x < MW; x += 1) { const ch = MAP[y][x]; c.fillStyle = WALLS[ch] ? '#1c1a20' : ch === 'a' || ch === 'b' ? '#6a4a2a' : '#4a4a52'; c.fillRect(x * s, y * s, s, s); }
    g.actors.forEach((a) => { if (!a.alive) return; const mine = a.team === g.player.team; if (!mine && !g.actors.some((m) => m.alive && m.team === g.player.team && sees(m, a))) return; c.fillStyle = a === g.player ? '#ffffff' : mine ? '#5a8aff' : '#ff4a3a'; c.fillRect(a.x * s - 1, a.y * s - 1, 3, 3); });
    if (g.keg.planted || g.keg.dropped) { c.fillStyle = Math.floor(g.now * 4) % 2 ? '#ffb040' : '#803010'; c.fillRect(g.keg.x * s - 1, g.keg.y * s - 1, 3, 3); }
    const p = g.player; c.strokeStyle = '#ffffff'; c.beginPath(); c.moveTo(p.x * s, p.y * s); c.lineTo(p.x * s + Math.cos(p.a) * 6, p.y * s + Math.sin(p.a) * 6); c.stroke();
    ['A', 'B'].forEach((n, k) => { c.fillStyle = '#ffe08a'; c.font = 'bold 9px sans-serif'; c.fillText(n, g.sites[k].c[0] * s - 3, g.sites[k].c[1] * s + 3); });
  }

  /* ---- the interface around the picture (the page's own, crisp): health, money, ammunition, timer, feed, menus ---- */
  function build() {
    root = document.createElement('div'); root.className = 'siege';
    root.innerHTML = `<canvas width="${W}" height="${H}"></canvas><canvas class="sg-radar"></canvas>
<div class="sg-top"><span class="sg-def"></span><span class="sg-time"></span><span class="sg-att"></span></div>
<div class="sg-feed"></div><div class="sg-msg"></div><div class="sg-keg"></div>
<div class="sg-hp"></div><div class="sg-money"></div><div class="sg-ammo"></div>
<div class="sg-menu" hidden></div><div class="sg-help">Click: take the mouse · WASD/ZQSD move · Shift walk · Ctrl crouch · Space jump · R reload · 1 2 3 4 weapons · G throw · E plant/defuse · B buy · F inspect · Tab scores · K knife · Esc pause</div>`;
    document.body.append(root);
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d'); img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W);
    ui = Object.fromEntries(['radar', 'top', 'def', 'time', 'att', 'feed', 'msg', 'keg', 'hp', 'money', 'ammo', 'menu', 'help'].map((k) => [k, root.querySelector(k === 'radar' ? '.sg-radar' : `.sg-${k}`)]));
  }
  function hud() {
    if (!g) return; const p = g.player; const mine = p.team; const other = mine === 'def' ? 'att' : 'def';
    const left = Math.max(0, g.phase === 'planted' ? g.keg.until - g.now : g.phaseUntil - g.now); const mm = Math.floor(left / 60); const ss = String(Math.floor(left % 60)).padStart(2, '0');
    ui.def.textContent = `${mine === 'def' ? 'Defenders' : 'Attackers'} ${g.score[mine]}`; ui.att.textContent = `${g.score[other]} ${other === 'def' ? 'Defenders' : 'Attackers'}`;
    ui.time.textContent = g.phase === 'planted' ? `keg ${ss}s` : g.phase === 'buy' ? `buy ${Math.ceil(left)}` : `${mm}:${ss}`; ui.time.classList.toggle('sg-red', g.phase === 'planted');
    ui.hp.innerHTML = `<b>${Math.ceil(p.hp)}</b> health · <b>${Math.ceil(p.armour)}</b> armour${p.helm ? ' + helm' : ''}`;
    ui.money.textContent = `${p.money} crowns`;
    const wid = cur(p); const w = ARMS.W[wid]; const am = p.ammo[wid];
    ui.ammo.innerHTML = `${wid === 'knife' ? g.knife.name : w.name}${am && w.mag ? ` <b>${am.mag}</b> / ${am.res}` : ''}${g.now < p.reloadUntil ? ' (reloading)' : ''}<br><span class="dim">gear: ${['he', 'smoke', 'flash', 'fire'].filter((k) => p.gear[k]).map((k) => `${k} ×${p.gear[k]}`).join(', ') || 'none'}${p.tools ? ', keg tools' : ''}${g.keg.carrier === p ? ', THE KEG' : ''}</span>`;
    ui.feed.innerHTML = g.feed.filter((f) => g.now - f.t < 7).map((f) => `<p><span class="sg-${f.byTeam}">${f.by || '☠'}</span> ${f.w}${f.head ? ' ⌖' : ''} <span class="sg-${f.team}">${f.who}</span></p>`).join('');
    ui.msg.textContent = g.now < g.msgUntil ? g.msg : ''; ui.msg.hidden = g.now >= g.msgUntil;
    const k = g.keg; ui.keg.textContent = k.plantP > 0 && !k.planted ? `planting ${Math.round(k.plantP * 100)}%` : k.defuseP > 0 && k.defuser === p ? `defusing ${Math.round(k.defuseP * 100)}%` : '';
  }
  /* ---- menus: buy (B, in the buying time), scores (Tab), pause (Esc), the knife's forge (K) ---- */
  function openMenu(html, cls) { ui.menu.innerHTML = html; ui.menu.className = `sg-menu ${cls}`; ui.menu.hidden = false; if (document.pointerLockElement) document.exitPointerLock(); }
  function closeMenu() { ui.menu.hidden = true; }
  const closeBuy = () => { if (ui.menu && ui.menu.classList.contains('sg-buy')) closeMenu(); };
  function buyMenu() {
    if (g.phase !== 'buy' && !(g.phase === 'live' && g.now < g.phaseUntil - ROUND_S + 15)) { say('The buying time is over.', 2); return; }
    const p = g.player; const row = (id, o, kind) => `<button data-buy="${kind}:${id}" ${p.money < o.price ? 'disabled' : ''}>${o.name} <span>${o.price}</span></button>`;
    const W2 = ARMS.W;
    openMenu(`<h3>Buy · ${p.money} crowns</h3><div class="sg-cols"><div><h4>Pistols</h4>${['wheellock', 'pepperbox'].map((k) => row(k, W2[k], 'w')).join('')}<h4>Light</h4>${['repeater', 'blunderbuss'].map((k) => row(k, W2[k], 'w')).join('')}</div>`
      + `<div><h4>Rifles</h4>${['arquebus', 'caliver', 'greatbow'].map((k) => row(k, W2[k], 'w')).join('')}</div><div><h4>Gear</h4>${Object.entries(ARMS.GEAR).map(([k, o]) => row(k, o, 'g')).join('')}</div></div><p class="dim">B or Esc to close; the round starts when the buying time ends.</p>`, 'sg-buy');
    ui.menu.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      const [kind, id] = b.dataset.buy.split(':'); const o = kind === 'w' ? ARMS.W[id] : ARMS.GEAR[id]; if (p.money < o.price) return;
      if (kind === 'w') give(p, id);
      else if (o.armour) { if (p.armour >= 100 && (p.helm || !o.helm)) return; p.armour = 100; if (o.helm) p.helm = true; }
      else if (o.tools) { if (p.tools || p.team !== 'def') return; p.tools = true; }
      else { if ((p.gear[o.kind] || 0) >= o.max) return; p.gear[o.kind] = (p.gear[o.kind] || 0) + 1; }
      p.money -= o.price; sfx('buy'); buyMenu();
    }));
  }
  function scores(on) {
    if (!on) { if (ui.menu.classList.contains('sg-scores')) closeMenu(); return; }
    const rows = (team) => g.actors.filter((a) => a.team === team).sort((a, b) => b.kills - a.kills).map((a) => `<tr class="${a.alive ? '' : 'dim'}"><td>${a.name}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.money}</td></tr>`).join('');
    openMenu(`<h3>Round ${g.round} · defenders ${g.score.def}, attackers ${g.score.att}</h3><table><tr><th>Defenders</th><th>kills</th><th>deaths</th><th>crowns</th></tr>${rows('def')}<tr><th>Attackers</th><th></th><th></th><th></th></tr>${rows('att')}</table>`, 'sg-scores');
  }
  function pauseMenu() {
    g.paused = true;
    openMenu(`<h3>Siege, paused</h3><button data-act="resume">Resume</button><button data-act="knife">The knife's forge</button><button data-act="diff">Bots: ${g.difficulty}</button><button data-act="again">A new match</button><button data-act="leave">Leave (back to the castle)</button>`, 'sg-pause');
    ui.menu.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'resume') { g.paused = false; closeMenu(); cv.requestPointerLock?.(); }
      if (act === 'knife') forge();
      if (act === 'diff') { g.difficulty = { easy: 'normal', normal: 'hard', hard: 'easy' }[g.difficulty]; store('siege-diff', g.difficulty); pauseMenu(); }
      if (act === 'again') { const o = g.opts; stop(); start(o); }
      if (act === 'leave') { const o = g.opts; stop(); if (o.onLeave) o.onLeave(); }
    }));
  }
  function forge() { // the knife: its shape, its finish, a new one at random; drawn as it is held
    g.paused = true; const k = g.knifeRecipe;
    openMenu(`<h3>The knife's forge</h3><canvas class="sg-knife" width="160" height="90"></canvas><p class="sg-kname"></p>
<div class="sg-cols"><div><h4>Shape</h4>${Object.entries(ARMS.SHAPES).map(([id, s]) => `<button data-shape="${id}" ${k.shape === id ? 'class="on"' : ''}>${s.name}</button>`).join('')}</div>
<div><h4>Finish</h4>${Object.entries(ARMS.FINISHES).map(([id, f]) => `<button data-finish="${id}" ${k.finish === id ? 'class="on"' : ''}>${f.name}</button>`).join('')}</div></div>
<button data-act="roll">Forge one at random</button> <button data-act="back">Back</button>`, 'sg-forge');
    const show = () => { const kn = ARMS.knife(g.knifeRecipe); g.knife = kn; store('siege-knife', g.knifeRecipe); const c = ui.menu.querySelector('.sg-knife'); const x = c.getContext('2d'); const im = x.createImageData(160, 90); const b = new Uint32Array(im.data.buffer); b.fill(pack([40, 34, 30]));
      ARMS.drawHeld('knife', kn, (px, py, col) => { if (px >= 0 && py >= 0 && px < 160 && py < 90) b[py * 160 + px] = pack(col); }, 160, 90, { inspect: 0.12, swing: -1, reload: -1 }); x.putImageData(im, 0, 0);
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
      if (e.code === 'Tab') scores(true);
      if (e.code === 'KeyB') { if (ui.menu.classList.contains('sg-buy') && !ui.menu.hidden) closeMenu(); else buyMenu(); }
      if (e.code === 'KeyR') reload(p);
      if (e.code === 'KeyF') { g.inspect = 0; if (cur(p) === 'knife') sfx('swish'); }
      if (e.code === 'KeyK') forge();
      if (/^Digit[1-4]$/.test(e.code)) { const s = Number(e.code.slice(5)); if (s === 4) { g.nadeIx = ((g.nadeIx ?? -1) + 1) % 4; const order = ['he', 'flash', 'smoke', 'fire']; for (let k = 0; k < 4; k += 1) { const n = order[(g.nadeIx + k) % 4]; if (p.gear[n]) { g.nade = n; say(`Ready: ${n}. G throws it.`, 1.5); break; } } } else if (p.weapons[s]) { p.slot = s; p.scoped = false; g.inspect = -1; sfx('draw'); } }
      if (e.code === 'KeyG') { const n = g.nade || ['he', 'flash', 'smoke', 'fire'].find((q) => p.gear[q]); if (n) throwIt(p, n); }
    };
    H_.up = (e) => { keys.delete(e.code); if (e.code === 'Tab') scores(false); };
    H_.mouse = (e) => { if (!g || document.pointerLockElement !== cv) return; g.player.a += e.movementX * 0.0022 * (g.player.scoped ? 0.3 : 1); g.pitch = clamp(g.pitch - e.movementY * 0.0018 * (g.player.scoped ? 0.3 : 1), -0.6, 0.6); };
    H_.down = (e) => {
      if (!g || !root.contains(e.target) || e.target.closest('.sg-menu')) return;
      if (document.pointerLockElement !== cv) { cv.requestPointerLock?.(); if (!audio) audioOn(); return; }
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
      click: () => nz(4000, 0.03, 0.15, 'highpass'), draw: () => nz(2500, 0.08, 0.12), buy: () => tn(880, 1320, 0.12, 0.08),
      swish: () => nz(1800, 0.18, 0.18), stab: () => { nz(600, 0.12, 0.3, 'lowpass'); tn(160, 80, 0.12, 0.2); },
      step: () => nz(300, 0.08, 0.12, 'lowpass'), tink: () => tn(3200, 2900, 0.25, 0.2), thud: () => tn(140, 60, 0.15, 0.3),
      throw: () => nz(1200, 0.15, 0.12), boom: () => { nz(150, 0.9, 0.9, 'lowpass'); tn(80, 30, 0.8, 0.6); }, bigboom: () => { nz(90, 2.2, 1, 'lowpass'); tn(60, 20, 2, 0.8); },
      hiss: () => nz(5000, 2.5, 0.12, 'highpass'), whoosh: () => nz(700, 1, 0.3), flash: () => { tn(4200, 3800, 1.5, 0.15); nz(2000, 0.1, 0.4); },
      beep: () => tn(1400, 1400, 0.09, 0.2, 'square'), planted: () => [0, 0.15, 0.3].forEach((d) => setTimeout(() => tn(1000, 1000, 0.1, 0.2, 'square'), d * 1000)),
      win: () => [523, 659, 784].forEach((f, k) => setTimeout(() => tn(f, f, 0.4, 0.15, 'triangle'), k * 160)), lose: () => [392, 330, 262].forEach((f, k) => setTimeout(() => tn(f, f, 0.45, 0.15, 'triangle'), k * 180)),
    }[kind] || (() => {}))();
  }

  window.Siege = { start, stop, state: () => g && { phase: g.phase, round: g.round, score: { ...g.score }, alive: g.actors.filter((a) => a.alive).length, player: { hp: g.player.hp, x: g.player.x, y: g.player.y, money: g.player.money } }, debug: () => g };
}());
