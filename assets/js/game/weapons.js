/* Siege, the game under the castle: its arms. Each weapon's numbers (price, damage, rate, magazine,
   spread, how it moves you, its recoil: the spray's path, shot by shot, in degrees of yaw and pitch, the
   same each time, so it can be learnt), the throwables, the gear; the knives, in twelve shapes, each with
   its own drawing out and inspection (keyframes), with finishes made from a seed (a pattern, its colours,
   its wear). Their models and drawing: models.js. */
(function () {
  /** A spray: n shots climbing, then swaying left and right (a few degrees), like the real ones. */
  const spray = (n, climb, sway, seed) => Array.from({ length: n }, (_, k) => {
    const up = Math.min(k, 9) * climb + Math.max(0, k - 9) * climb * 0.15;
    const side = k < 6 ? (k % 2 ? 0.05 : -0.04) * k : Math.sin((k - 6) * 0.45 + seed) * sway;
    return [side, up];
  });
  // price (crowns), damage (body), armour pierce (0..1), rate (shots/s), mag, reload (s), spread (deg, standing still),
  // move spread (deg at full speed), speed (fraction of the knife's), auto, headshot multiplier, falloff (per 10 m), recoil
  const W = {
    knife: { name: 'Knife', slot: 3, price: 0, dmg: 34, rate: 2.5, melee: true, speed: 1, heavy: 65, back: 180 },
    wheellock: { name: 'Wheellock pistol', slot: 2, price: 200, dmg: 30, pierce: 0.5, rate: 5, mag: 12, reload: 2.2, spread: 0.6, mspread: 3, speed: 0.96, auto: false, head: 4, fall: 0.06, recoil: spray(12, 0.9, 0.4, 1) },
    pepperbox: { name: 'Pepperbox', slot: 2, price: 500, dmg: 38, pierce: 0.6, rate: 4, mag: 6, reload: 2.6, spread: 0.9, mspread: 3.5, speed: 0.95, auto: false, head: 4, fall: 0.08, recoil: spray(6, 1.4, 0.5, 2) },
    repeater: { name: 'Repeating crossbow', slot: 1, price: 1250, dmg: 24, pierce: 0.55, rate: 11, mag: 25, reload: 2.8, spread: 1.2, mspread: 2.2, speed: 0.93, auto: true, head: 3.5, fall: 0.15, recoil: spray(25, 0.45, 0.8, 3) },
    blunderbuss: { name: 'Blunderbuss', slot: 1, price: 1100, dmg: 22, pellets: 8, pierce: 0.4, rate: 1.1, mag: 6, reload: 3.2, spread: 6, mspread: 7, speed: 0.88, auto: false, head: 2, fall: 0.5, recoil: spray(6, 3, 0.3, 4) },
    arquebus: { name: 'Arquebus', slot: 1, price: 2700, dmg: 36, pierce: 0.78, rate: 10, mag: 30, reload: 2.5, spread: 0.35, mspread: 6, speed: 0.86, auto: true, head: 4, fall: 0.02, recoil: spray(30, 1.0, 1.4, 5) },
    caliver: { name: 'Caliver', slot: 1, price: 3100, dmg: 32, pierce: 0.7, rate: 11, mag: 30, reload: 3.1, spread: 0.3, mspread: 5, speed: 0.9, auto: true, head: 4, fall: 0.02, recoil: spray(30, 0.75, 1.0, 6) },
    ak47: { name: 'AK-47', slot: 1, price: 2700, dmg: 36, pierce: 0.775, rate: 10, mag: 30, reload: 2.5, spread: 0.28, mspread: 6.5, speed: 0.86, auto: true, head: 4, fall: 0.02, // (out of its century: found in the cellar)
      recoil: [[0, 0], [0.05, 0.9], [0.1, 2], [0.15, 3.2], [0.1, 4.4], [0.2, 5.5], [0.3, 6.5], [0.2, 7.3], [0.1, 8], [-0.4, 8.5], [-1.2, 8.8], [-2, 9], [-2.6, 9.2], [-2.9, 9.3], [-2.4, 9.5],
        [-1.4, 9.6], [-0.2, 9.7], [1, 9.8], [2, 9.9], [2.8, 10], [3.1, 10.1], [2.6, 10.2], [1.6, 10.2], [0.4, 10.3], [-0.8, 10.3], [-1.8, 10.4], [-2.6, 10.4], [-2.2, 10.5], [-1.2, 10.5], [0, 10.6]] }, // (up, then left, right, left: the inverted 7)
    greatbow: { name: 'Great crossbow', slot: 1, price: 4750, dmg: 115, pierce: 0.97, rate: 0.7, mag: 5, reload: 3.6, spread: 8, mspread: 12, scoped: 0.06, speed: 0.8, auto: false, head: 1.2, fall: 0, recoil: spray(5, 2, 0, 7) },
  };
  // the buying menu's shelves, and how each weapon measures up (0..1) for its bars
  const SHELVES = [['Pistols', ['wheellock', 'pepperbox']], ['Heavy', ['blunderbuss']], ['Light', ['repeater']], ['Rifles', ['arquebus', 'caliver', 'ak47']], ['Marksman', ['greatbow']]];
  const STATS = (w) => ({ Damage: Math.min(1, (w.dmg * (w.pellets || 1)) / 120), Rate: Math.min(1, w.rate / 12), Accuracy: Math.max(0.05, 1 - w.spread / 8), Mobility: (w.speed - 0.75) / 0.25, 'Armour pierce': w.pierce || 0, Magazine: Math.min(1, (w.mag || 0) / 30) });
  // the throwables and the gear (a slot of their own: 4)
  const GEAR = {
    firepot: { name: 'Firepot', price: 300, kind: 'he', max: 1 },
    incense: { name: 'Incense pot (smoke)', price: 300, kind: 'smoke', max: 1 },
    vial: { name: 'Blinding vial', price: 200, kind: 'flash', max: 2 },
    flask: { name: 'Fire flask', price: 400, kind: 'fire', max: 1 },
    gambeson: { name: 'Gambeson (armour)', price: 650, armour: 100 },
    helm: { name: 'Gambeson and helm', price: 1000, armour: 100, helm: true },
    tools: { name: 'Keg tools (defuse in half the time)', price: 400, tools: true },
  };

  /* ---- the knives: shapes and finishes --------------------------------------------------------- */
  /* The knives' shapes: the blade's half-width along it (u: 0 at the guard, 1 at the tip), its length, its
     curve; how it moves: its drawing out and its inspection as keyframes ([t 0..1, { rot, x, y, spin (turns of
     the whole knife about its pivot), roll (the blade turned to show its flat: -1..1), open (a folding blade,
     0 shut to 1 open), twin (the dual daggers' other hand) }]), eased between. */
  const K = (...keys) => keys;
  const SHOW = K([0, {}], [0.25, { rot: -0.35, x: -10, y: -8, roll: 0.9 }], [0.6, { rot: -0.35, x: -10, y: -8, roll: -0.9 }], [1, {}]);
  const RISE = K([0, { y: 70, rot: 0.5 }], [1, {}]);
  const SHAPES = {
    dagger: { name: 'Rondel dagger', blade: (u) => 1 - u * 0.9, len: 1, curve: 0, inspect: SHOW, draw: RISE },
    karambit: { name: 'Karambit', blade: (u) => 0.9 - u * 0.6, len: 0.55, curve: 1.5, ring: true, pivot: 'ring',
      inspect: K([0, {}], [0.12, { y: -6 }], [0.55, { spin: 2, y: -6 }], [0.72, { spin: 2, rot: -0.3, roll: 0.9 }], [1, { spin: 2 }]), draw: K([0, { y: 70, spin: -1 }], [1, {}]) },
    butterfly: { name: 'Balisong', blade: (u) => (u < 0.85 ? 0.7 : (1 - u) * 4.6), len: 1, curve: 0, fold: true,
      inspect: K([0, { open: 1 }], [0.1, { open: 0 }], [0.22, { open: 1, spin: 0.5 }], [0.34, { open: 0, spin: 1 }], [0.46, { open: 1, spin: 1.5 }], [0.58, { open: 0, spin: 2 }], [0.72, { open: 1, spin: 2, roll: 0.8 }], [1, { open: 1, spin: 2 }]),
      draw: K([0, { open: 0, y: 70 }], [0.45, { open: 0 }], [0.6, { open: 1, spin: 0.5 }], [0.8, { open: 0, spin: 1 }], [1, { open: 1, spin: 1 }]) },
    bayonet: { name: 'Bayonet', blade: (u) => 0.85 - u * 0.75, len: 1.15, curve: 0, fuller: true, inspect: SHOW, draw: RISE },
    falchion: { name: 'Falchion', blade: (u) => 0.8 + u * 0.4 - (u > 0.8 ? (u - 0.8) * 5 : 0), len: 1.05, curve: 0.25, inspect: SHOW, draw: RISE },
    misericorde: { name: 'Misericorde', blade: (u) => 0.45 - u * 0.4, len: 1.2, curve: 0, inspect: K([0, {}], [0.4, { rot: -0.6, x: -14, roll: 1 }], [0.7, { rot: 0.2, y: -14, roll: -1 }], [1, {}]), draw: RISE },
    bowie: { name: 'Bowie knife', blade: (u) => (u < 0.7 ? 1.1 : 1.1 - (u - 0.7) * 3.6) - (u > 0.75 ? (u - 0.75) * 0.8 : 0), len: 1.05, curve: 0.1, clip: true,
      inspect: K([0, {}], [0.3, { rot: -0.5, x: -16, y: -10, roll: 1 }], [0.5, { rot: -0.5, x: -16, y: -10, roll: -1 }], [0.65, { spin: 0.5, y: -20 }], [0.8, { spin: 1 }], [1, { spin: 1 }]), draw: RISE },
    kukri: { name: 'Kukri', blade: (u) => 0.7 + Math.sin(u * Math.PI) * 0.7 - (u > 0.9 ? (u - 0.9) * 8 : 0), len: 1, curve: -0.6,
      inspect: K([0, {}], [0.1, { y: 4 }], [0.3, { y: -70, spin: 1.5 }], [0.5, { y: 0, spin: 3 }], [0.7, { spin: 3, roll: 0.9, rot: -0.3 }], [1, { spin: 3 }]), draw: K([0, { y: 70, spin: 1 }], [1, {}]) }, // (tossed up and caught)
    kris: { name: 'Kris', blade: (u) => 0.75 - u * 0.65, len: 1.05, curve: 0, wave: true, inspect: K([0, {}], [0.35, { rot: -0.6, y: -12, roll: 1 }], [0.65, { rot: 0.3, y: -6, roll: -1 }], [1, {}]), draw: RISE },
    push: { name: 'Push daggers', blade: (u) => 0.95 - u * 0.85, len: 0.55, curve: 0, twin: true, push: true,
      inspect: K([0, {}], [0.5, { spin: 1, x: -6 }], [1, { spin: 2 }]), draw: K([0, { y: 70 }], [1, {}]) },
    navaja: { name: 'Navaja', blade: (u) => 0.75 - u * 0.5 - (u > 0.85 ? (u - 0.85) * 2.6 : 0), len: 1.05, curve: 0.18, fold: true,
      inspect: K([0, { open: 1 }], [0.2, { open: 0, rot: -0.2 }], [0.45, { open: 1, rot: -0.2 }], [0.7, { roll: 0.9 }], [1, { open: 1 }]), draw: K([0, { open: 0, y: 60 }], [0.6, { open: 0 }], [1, { open: 1 }]) },
    stiletto: { name: 'Stiletto', blade: (u) => 0.4 - u * 0.33, len: 1.15, curve: 0, fold: true,
      inspect: K([0, { open: 1 }], [0.15, { open: 1, rot: -0.3 }], [0.2, { open: 0, rot: -0.3 }], [0.45, { open: 0, rot: -0.3 }], [0.5, { open: 1, rot: -0.3 }], [0.75, { roll: 1 }], [1, { open: 1 }]), draw: K([0, { open: 0, y: 60 }], [0.55, { open: 0 }], [0.62, { open: 1 }], [1, { open: 1 }]) }, // (the switch: it snaps open)
  };
  /** A keyframed pose at t (0..1): each value eased between its keys; open defaults to 1, the rest to 0. */
  const DEF = { rot: 0, x: 0, y: 0, spin: 0, roll: 0, open: 1 };
  function pose(keys, t) {
    let k = 0; while (k < keys.length - 2 && t > keys[k + 1][0]) k += 1;
    const [t0, a] = keys[k]; const [t1, b] = keys[Math.min(k + 1, keys.length - 1)]; const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1; const e = f * f * (3 - 2 * f);
    const out = {}; Object.keys(DEF).forEach((n) => { const va = a[n] ?? DEF[n]; const vb = b[n] ?? DEF[n]; out[n] = va + (vb - va) * e; }); return out;
  }
  const FINISHES = {
    plain: { name: 'Forge-bright', at: () => [196, 202, 212] },
    damascus: { name: 'Damascus', at: (u, v, r) => { const w = Math.sin(u * 40 + Math.sin(v * 9 + r * 6) * 3); return w > 0.3 ? [214, 216, 222] : w < -0.4 ? [92, 96, 106] : [150, 154, 164]; } },
    ombre: { name: 'Ombre', at: (u) => { const a = [250, 120, 200]; const b = [120, 90, 240]; const c = [255, 220, 120]; const k = u < 0.5 ? u * 2 : (u - 0.5) * 2; return (u < 0.5 ? a : b).map((x, i) => x + ((u < 0.5 ? b : c)[i] - x) * k); } },
    tempered: { name: 'Tempered (case-hardened)', at: (u, v, r) => { const n = Math.sin(u * 13 + r * 9) * Math.cos(v * 11 - r * 5) + Math.sin((u + v) * 7 + r); return n > 0.7 ? [230, 190, 80] : n > -0.2 ? [70, 110, 190] : [150, 120, 160]; } },
    night: { name: 'Night', at: (_u, v) => (Math.abs(v - 0.5) > 0.42 ? [120, 124, 136] : [38, 40, 50]) },
    bloodvine: { name: 'Bloodvine', at: (u, v, r) => { const l = Math.abs(Math.sin(u * 22 + r * 4) * 0.5 - (v - 0.5)) < 0.06 || Math.abs(Math.sin(v * 17 + u * 8 + r) - 0.2) < 0.08; return l ? [30, 10, 12] : [170, 30, 36]; } },
    gilded: { name: 'Gilded', at: (u, v, r) => (Math.sin(u * 30 + v * 20 + r * 3) > 0.6 ? [255, 236, 160] : [218, 168, 56]) },
    marbled: { name: 'Marbled', at: (u, v, r) => { const m = Math.sin(u * 8 + Math.sin(v * 13 + u * 5 + r * 7) * 2.2); return m > 0.5 ? [80, 200, 210] : m < -0.5 ? [40, 60, 160] : [200, 240, 245]; } },
    jade: { name: 'Jade', at: (u, v, r) => { const m = Math.sin(u * 11 + Math.sin(v * 7 + r * 5) * 2.5); return m > 0.6 ? [190, 250, 200] : m < -0.3 ? [20, 110, 70] : [60, 170, 110]; } },
    obsidian: { name: 'Obsidian', at: (u, v, r) => { const m = Math.abs(Math.sin(u * 37 + v * 13 + r * 4)); return m > 0.93 ? [200, 160, 255] : [24, 20, 34]; } },
    frost: { name: 'Frost', at: (u, v, r) => { const f = Math.abs(Math.sin(u * 50 + r) * Math.sin(v * 31 - r * 2)); return f > 0.75 ? [250, 252, 255] : [168, 200, 228]; } },
  };
  const WEAR = [[0.07, 'Fresh from the forge'], [0.15, 'Lightly used'], [0.38, 'Field-worn'], [0.45, 'Well-worn'], [1, 'Battle-scarred']];
  /** A knife from its recipe: { shape, finish, seed (0..999), wear (0..1) }; its name, and its colour at (u along, v across). */
  function knife(k) {
    const sh = SHAPES[k.shape] || SHAPES.dagger; const fi = FINISHES[k.finish] || FINISHES.plain; const r = (k.seed % 1000) / 1000;
    const scratch = (u, v) => { const n = Math.sin(u * 91 + v * 37 + k.seed) * Math.sin(u * 23 - v * 71 + k.seed * 0.3); return n > 1 - k.wear * 1.6; };
    return {
      ...k, shapeId: SHAPES[k.shape] ? k.shape : 'dagger', shape: sh, finishName: fi.name, wearName: WEAR.find(([w]) => k.wear <= w)[1],
      name: `${sh.name} | ${fi.name}`,
      colour: (u, v) => (scratch(u, v) ? [178, 182, 190] : fi.at(u, v, r)),
    };
  }
  /** A knife never seen: a shape and finish at random, a seed, a wear. */
  const randomKnife = () => ({ shape: Object.keys(SHAPES)[Math.floor(Math.random() * Object.keys(SHAPES).length)], finish: Object.keys(FINISHES)[Math.floor(Math.random() * Object.keys(FINISHES).length)], seed: Math.floor(Math.random() * 1000), wear: Math.random() ** 1.7 });

  window.SIEGE_ARMS = { W, GEAR, SHAPES, FINISHES, SHELVES, STATS, knife, randomKnife, pose };
}());
