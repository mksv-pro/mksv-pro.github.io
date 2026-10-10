/* Siege, the game under the castle: its arms. Each weapon's numbers (price, damage, rate, magazine,
   spread, how it moves you, its recoil: the spray's path, shot by shot, in degrees of yaw and pitch, the
   same each time, so it can be learnt), the throwables, the gear; the knives, in twelve shapes, each with
   its own drawing out and inspection (keyframes), with finishes made from a seed (a pattern, its colours,
   its wear); each drawn in the hand at the screen's foot, and in profile for the buying menu.
   Loaded by siege.js; nothing here draws the world. */
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
      ...k, shape: sh, finishName: fi.name, wearName: WEAR.find(([w]) => k.wear <= w)[1],
      name: `${sh.name} | ${fi.name}`,
      colour: (u, v) => (scratch(u, v) ? [178, 182, 190] : fi.at(u, v, r)),
    };
  }
  /** A knife never seen: a shape and finish at random, a seed, a wear. */
  const randomKnife = () => ({ shape: Object.keys(SHAPES)[Math.floor(Math.random() * Object.keys(SHAPES).length)], finish: Object.keys(FINISHES)[Math.floor(Math.random() * Object.keys(FINISHES).length)], seed: Math.floor(Math.random() * 1000), wear: Math.random() ** 1.7 });

  /* ---- the weapons' materials, textured: wood with its grain along the piece, steel and brass with a
     band of light along them (a polished cylinder), blued steel darker; each shaded round. m: the name,
     u along (0..1), v across (0..1), L the piece's length (for the grain's scale). */
  const MAT = { wood: [[176, 118, 62], [126, 82, 44], [78, 48, 26]], walnut: [[176, 92, 50], [124, 60, 32], [70, 32, 18]], dark: [[96, 70, 46], [66, 46, 30], [36, 24, 16]],
    iron: [[222, 228, 238], [134, 140, 154], [56, 60, 72]], blued: [[132, 140, 164], [62, 68, 88], [24, 26, 38]], brass: [[255, 228, 140], [214, 166, 56], [140, 96, 26]], string: [[236, 228, 200], [200, 190, 160], [150, 140, 110]] };
  function matColour(m, u, v, L) {
    const M = MAT[m]; const round = Math.sin(v * Math.PI); let c = v < 0.22 ? M[0] : round > 0.55 ? M[1] : M[2];
    if (m === 'wood' || m === 'walnut' || m === 'dark') { const gr = Math.sin(u * L * 0.9 + Math.sin(v * 9 + u * 3) * 1.6); c = c.map((q) => q * (gr > 0.6 ? 1.12 : gr < -0.7 ? 0.84 : 1)); }
    else if (m === 'iron' || m === 'blued' || m === 'brass') { const hi = Math.max(0, 1 - Math.abs(v - 0.28) / 0.07); c = c.map((q) => q + (255 - q) * hi * (m === 'blued' ? 0.35 : 0.6)); if ((Math.floor(u * L * 2) + Math.floor(v * 6)) % 7 === 0) c = c.map((q) => q * 0.94); }
    return c;
  }
  /* ---- in the hand: each weapon seen from behind, as in the old shooters, pointing up to the middle of the
     screen: tapered pieces (near and wide at the foot, far and narrow up the screen), textured and shaded, a
     hand or two on it. Coordinates from the anchor at the screen's foot, right of centre, in pixels of a
     320-wide picture: [from, to, width at from, width at to, material]; hands [x, y, r]; the muzzle. */
  const GUNS = {
    wheellock: { parts: [[[12, 4], [5, -24], 11, 8, 'wood'], [[5, -24], [-12, -56], 6, 3, 'iron'], [[3, -20], [8, -28], 5, 4, 'brass']], hands: [[10, -6, 9]], muzzle: [-12, -57] },
    pepperbox: { parts: [[[12, 4], [5, -24], 11, 8, 'wood'], [[5, -24], [-10, -52], 9, 7, 'iron'], [[3, -20], [8, -28], 5, 4, 'brass']], hands: [[10, -6, 9]], muzzle: [-10, -53] },
    blunderbuss: { parts: [[[20, 8], [2, -34], 18, 11, 'wood'], [[2, -34], [-26, -78], 7, 5, 'iron'], [[-26, -78], [-34, -92], 5, 12, 'iron'], [[6, -30], [10, -40], 6, 5, 'brass']], hands: [[14, -6, 9], [-12, -56, 7]], muzzle: [-34, -94] },
    arquebus: { parts: [[[20, 8], [2, -34], 18, 11, 'wood'], [[2, -34], [-38, -104], 6, 3, 'iron'], [[-4, -44], [-16, -66], 9, 6, 'wood'], [[6, -32], [12, -42], 6, 5, 'brass'], [[-10, -54], [-12, -58], 8, 7, 'brass']], hands: [[14, -6, 9], [-14, -62, 7]], muzzle: [-38, -106] },
    caliver: { parts: [[[18, 8], [2, -32], 15, 10, 'dark'], [[2, -32], [-34, -96], 5, 3, 'iron'], [[-4, -42], [-14, -60], 8, 6, 'dark'], [[6, -30], [11, -38], 5, 4, 'brass']], hands: [[13, -6, 9], [-12, -56, 7]], muzzle: [-34, -98] },
    ak47: { parts: [[[22, 10], [7, -24], 15, 10, 'walnut'], [[9, -18], [5, -6], 6, 6, 'walnut'], [[7, -24], [-6, -46], 11, 9, 'blued'], [[-1, -36], [6, -24], 7, 7, 'blued'], [[6, -24], [9, -12], 7, 8, 'blued'], [[9, -12], [8, 0], 8, 9, 'blued'],
      [[-6, -46], [-18, -66], 9, 7, 'walnut'], [[-8, -52], [-22, -74], 3, 3, 'blued'], [[-18, -66], [-30, -88], 4, 3, 'iron'], [[-29, -86], [-30, -92], 2, 2, 'blued']], hands: [[12, -12, 9], [-12, -58, 7]], muzzle: [-30, -90] },
    repeater: { parts: [[[16, 8], [-12, -60], 13, 7, 'wood'], [[-6, -46], [-10, -66], 11, 9, 'dark']], prod: [[-12, -62], 58, 6], hands: [[12, -4, 9]], muzzle: [-12, -66] },
    greatbow: { parts: [[[18, 8], [-14, -70], 14, 7, 'wood'], [[-2, -40], [-12, -64], 4, 4, 'brass'], [[-4, -46], [-12, -66], 5, 4, 'brass']], prod: [[-14, -72], 84, 8], hands: [[13, -4, 9], [-6, -48, 7]], muzzle: [-14, -76] },
  };
  /** The tools both drawings use: a tapered textured piece, a hand and its sleeve, on put(x, y, c). */
  function kit(put) {
    const piece = (pp, q, w0, w1, col) => {
      const L = Math.max(1, Math.hypot(q[0] - pp[0], q[1] - pp[1])); const nx = -(q[1] - pp[1]) / L; const ny = (q[0] - pp[0]) / L;
      for (let s2 = 0; s2 <= L; s2 += 0.6) { const u = s2 / L; const cx = pp[0] + (q[0] - pp[0]) * u; const cy = pp[1] + (q[1] - pp[1]) * u; const w = w0 + (w1 - w0) * u;
        for (let k = -w / 2; k <= w / 2; k += 0.6) { const v = (k + w / 2) / Math.max(1, w); const c = typeof col === 'function' ? col(u, v) : matColour(col, u, v, L);
          put(cx + nx * k, cy + ny * k, k < -w / 2 + 0.7 || k > w / 2 - 0.7 ? c.map((q2) => q2 * 0.45) : c); } }
    };
    const hand = (x, y, r, mirror = 1, arm = r * 2.4) => { // a gloved hand: leather, its knuckles, the cuff and the red sleeve going off the screen
      for (let j = -r; j <= r; j += 1) for (let i = -r; i <= r; i += 1) { const d = Math.hypot(i, j * 1.15); if (d > r) continue; const kn = j < -r * 0.3 && Math.abs(((i + r) % 4) - 2) < 0.8; put(x + i * mirror, y + j, d > r - 1.3 ? [52, 34, 22] : kn ? [150, 104, 70] : i * mirror < -r * 0.25 && j < 0 ? [138, 96, 64] : [112, 76, 48]); }
      for (let j = 0; j < 3; j += 1) for (let i = -r - 1; i <= r + 1; i += 1) put(x + i * mirror, y + r + j, [70, 46, 30]);
      for (let j = 3; j < arm; j += 1) for (let i = -r - 2; i <= r + 2; i += 1) put(x + (i + j * 0.45) * mirror, y + r + j, Math.abs(i) > r + 1 ? [80, 20, 20] : (j + Math.floor(i / 3)) % 6 === 0 ? [124, 30, 28] : [172, 46, 40]);
    };
    return { piece, hand };
  }
  function drawHeld(id, kn, put0, Wd, Hd, a) {
    // the whole moves as one: walking (bobX, bobY), turning (rot), the shot's kick (back and up), the reload (down
    // and over, then back), an inspection (a gun turned to show its side; a knife: its own keyframes), drawing out
    const base = Wd / 320; const isKnife = id === 'knife'; const S = base * (isKnife ? 1.35 : 1); const fat = isKnife ? 1 : 1.8;
    const rl = a.reload >= 0 ? a.reload : -1; const down = rl >= 0 ? Math.sin(Math.min(1, rl / 0.35) * Math.PI / 2) * (rl > 0.75 ? 1 - (rl - 0.75) / 0.25 : 1) : 0;
    const ins = !isKnife && a.inspect >= 0 ? Math.sin(a.inspect * Math.PI) : 0;
    const rot = (a.rot || 0) - (a.kick || 0) * 0.16 + down * 0.7 + ins * 0.55;
    const ox = (a.bobX || 0) * base + (a.kick || 0) * 4 * base + ins * 30 * base; const oy = (a.bobY || 0) * base + (a.kick || 0) * 10 * base + down * 70 * base - ins * 8 * base;
    const ax = Wd * 0.62; const ay = Hd + (isKnife ? -14 : 6) * base;
    const make = (rr, xo, yo, alpha, mirror = 1, ancX = ax) => (x, y, c) => {
      const X = ancX + xo + (x * mirror * Math.cos(rr) - y * Math.sin(rr)) * S; const Y = ay + yo + (x * mirror * Math.sin(rr) + y * Math.cos(rr)) * S;
      const n = Math.ceil(S) + 1; for (let j2 = 0; j2 < n; j2 += 1) for (let i2 = 0; i2 < n; i2 += 1) put0(Math.round(X + i2 - n / 2), Math.round(Y + j2 - n / 2), c, alpha);
    };
    if (isKnife) {
      const sh = kn.shape;
      // its pose: drawing out, or inspected (its keyframes), or swung (light: an arc from one side, the next from the other; heavy: a thrust)
      let ps = { ...DEF };
      if (a.drawT >= 0 && a.drawT < 1) ps = pose(sh.draw || RISE, a.drawT); else if (a.inspect >= 0) ps = pose(sh.inspect || SHOW, a.inspect);
      const side = a.side || 1;
      const blade = (pr, P2, mirror = 1) => { // the knife in its hand at pose P2, on pr
        const pv = sh.pivot === 'ring' ? [31, 8] : [23, -4]; const sp = (P2.spin || 0) * Math.PI * 2; // (it turns about its pivot: the ring, or the grip)
        const put = (x, y, c) => { const dx = x - pv[0]; const dy = y - pv[1]; pr(pv[0] + dx * Math.cos(sp) - dy * Math.sin(sp), pv[1] + dx * Math.sin(sp) + dy * Math.cos(sp), c); };
        const { piece } = kit(put); const { hand } = kit(pr); const hx = 18; const hy = -14; const L = 50 * sh.len; const roll = Math.max(0.12, Math.abs(Math.cos((P2.roll || 0) * Math.PI / 2)));
        const fold = sh.fold ? (1 - (P2.open ?? 1)) * Math.PI * 0.95 : 0; // (shut: the blade swung down into the handle)
        const dir = [-26, -L]; const fd = [dir[0] * Math.cos(fold) - dir[1] * Math.sin(fold), dir[0] * Math.sin(fold) + dir[1] * Math.cos(fold)];
        piece([hx + 9, hy + 20], [hx, hy], 7, 6, sh.push ? 'dark' : 'walnut'); // the grip (the push dagger's: a T in the fist)
        if (!sh.push) piece([hx - 8, hy - 1], [hx + 8, hy + 1], 3, 3, 'brass');
        const steps = 32; let prev = [hx, hy - 2];
        for (let k = 1; k <= steps; k += 1) { const u = k / steps; const bend = sh.curve * Math.sin(u * Math.PI) * 9; const wave = sh.wave ? Math.sin(u * Math.PI * 7) * 2.2 : 0;
          const cur2 = [hx + fd[0] * u + bend + wave, hy - 2 + fd[1] * u];
          const wd = (uu) => Math.max(1, sh.blade(uu) * 8 * roll);
          piece(prev, cur2, wd((k - 1) / steps), wd(u), (uu, v) => { const c = kn.colour((k - 1 + uu) / steps, v); const edge = v > 0.8 ? 1.32 : v < 0.2 ? 0.7 : 1; const lit = 0.78 + 0.45 * Math.abs(Math.sin((P2.roll || 0) * 1.6 + v * 1.4)); const clipK = sh.clip && (k - 1 + uu) / steps > 0.72 && v < 0.35 ? 1.25 : 1; return c.map((q2) => Math.min(255, q2 * edge * lit * clipK)); });
          if (sh.fuller && u > 0.1 && u < 0.7) put(cur2[0], cur2[1], kn.colour(u, 0.5).map((q2) => q2 * 0.55));
          prev = cur2; }
        if (sh.ring) for (let q = 0; q < 6.28; q += 0.18) put(hx + 13 + Math.cos(q) * 4, hy + 22 + Math.sin(q) * 4, matColour('iron', 0.5, (Math.sin(q) + 1) / 2, 10));
        hand(hx + 5, hy + 8, 9, mirror);
      };
      const draw1 = (mirror, ancX, phase) => {
        if (a.swing >= 0) { const sw = Math.min(1, Math.max(0, a.swing - phase));
          const arc = (t2) => (a.heavy ? { r: -0.15, x: -30 * Math.sin(t2 * Math.PI) * base * mirror, y: -46 * Math.sin(t2 * Math.PI) * base } : { r: side * (0.9 - t2 * 2.2), x: side * (40 - t2 * 110) * base * mirror, y: (-30 - Math.sin(t2 * Math.PI) * 20) * base });
          [0.2, 0.12, 0.06, 0].forEach((lag, k) => { const t2 = Math.max(0, sw - lag); const p2 = arc(t2); blade(make(rot + p2.r + ps.rot, ox + p2.x + ps.x * base, oy + p2.y + ps.y * base, k === 3 ? 1 : 0.18 + k * 0.14, mirror, ancX), ps, mirror); });
        } else blade(make(rot + ps.rot, ox + ps.x * base, oy + ps.y * base, 1, mirror, ancX), ps, mirror);
      };
      draw1(1, ax, 0); if (sh.twin) draw1(-1, Wd * 0.38, 0.15); // (the push daggers: both hands, the left a beat behind)
      return;
    }
    const gun = GUNS[id]; if (!gun) return;
    const { piece, hand } = kit(make(rot, ox, oy, 1)); const put = make(rot, ox, oy, 1);
    if (gun.prod) { const [[px, py], span, bend] = gun.prod; const half = span * 0.6; // the bow across, its string drawn back to the nut
      for (let k = -half; k <= half; k += 0.6) { const y = py + (Math.abs(k) / half) ** 2 * bend; for (let w = 0; w < 3; w += 1) put(px + k, y + w * 1.2, matColour('iron', 0.5, w / 3, 10)); }
      for (let k = -half; k <= half; k += 0.6) { const t2 = Math.abs(k) / half; put(px + k, py + bend + (1 - t2) * 14, MAT.string[1]); } }
    gun.parts.forEach(([p2, q, w0, w1, m]) => piece(p2, q, w0 * fat, w1 * fat, m));
    gun.hands.forEach(([x, y, r], k) => hand(x, y, Math.round(r * 1.15), k ? -1 : 1, 30 - y)); // (the sleeve down to the screen's foot) // (the front hand: the left arm's, from the lower left)
    if (a.flash) { const [fx, fy] = gun.muzzle; for (let k = 0; k < 110; k += 1) { const q = Math.random() * 6.28; const r2 = Math.random() * 12 * (0.6 + Math.random() * 0.6); put(fx + Math.cos(q) * r2, fy + Math.sin(q) * r2 * 0.75 - 4, [255, 240 - r2 * 9, 160 - r2 * 12]); } }
  }

  /* ---- in profile: each weapon side on for the buying menu (and the forge), its muzzle to the right, on
     put(x, y, c) over a box w x h. Pieces as in the hand: [from, to, width at from, width at to, material]. */
  const ICONS = {
    wheellock: [[[14, 32], [24, 18], 9, 8, 'wood'], [[22, 18], [72, 16], 6, 5, 'iron'], [[24, 18], [28, 18], 7, 7, 'brass']],
    pepperbox: [[[14, 32], [24, 18], 9, 8, 'wood'], [[22, 18], [62, 17], 10, 9, 'iron'], [[24, 18], [28, 18], 7, 7, 'brass']],
    blunderbuss: [[[2, 26], [34, 20], 13, 9, 'wood'], [[34, 19], [80, 17], 6, 6, 'iron'], [[80, 17], [94, 16], 6, 13, 'iron'], [[34, 22], [64, 21], 6, 5, 'wood']],
    arquebus: [[[2, 26], [36, 20], 13, 9, 'wood'], [[36, 19], [98, 17], 4, 4, 'iron'], [[36, 22], [76, 20], 6, 5, 'wood'], [[38, 18], [44, 18], 6, 6, 'brass']],
    caliver: [[[4, 25], [36, 20], 11, 8, 'dark'], [[36, 19], [96, 17], 4, 3, 'iron'], [[36, 21], [74, 20], 5, 4, 'dark'], [[38, 18], [43, 18], 5, 5, 'brass']],
    ak47: [[[2, 24], [28, 20], 11, 9, 'walnut'], [[28, 19], [50, 19], 9, 9, 'blued'], [[34, 23], [30, 34], 5, 5, 'walnut'], [[44, 23], [47, 31], 7, 7, 'blued'], [[47, 31], [44, 40], 7, 7, 'blued'],
      [[50, 19], [68, 19], 7, 6, 'walnut'], [[50, 15], [72, 15], 3, 3, 'blued'], [[68, 19], [94, 19], 3, 3, 'iron'], [[91, 14], [91, 18], 2, 2, 'blued']],
    repeater: [[[6, 24], [70, 20], 9, 7, 'wood'], [[36, 12], [52, 12], 8, 8, 'dark'], [[70, 4], [70, 36], 3, 3, 'iron']],
    greatbow: [[[4, 24], [74, 20], 10, 7, 'wood'], [[30, 13], [52, 13], 4, 4, 'brass'], [[74, 2], [74, 38], 4, 4, 'iron']],
  };
  function drawIcon(id, put0, w, h, kn) {
    const k = Math.min(w / 100, h / 40); const put = (x, y, c) => { const n = Math.ceil(k); for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) put0(Math.round(x * k + i), Math.round(y * k + j), c); };
    const { piece } = kit(put);
    if (id === 'knife' && kn) { const sh = kn.shape; piece([4, 22], [30, 20], 7, 7, sh.push ? 'dark' : 'walnut'); if (!sh.push) piece([30, 15], [30, 26], 3, 3, 'brass'); const steps = 30; let prev = [30, 20];
      for (let i = 1; i <= steps; i += 1) { const u = i / steps; const cur2 = [30 + 64 * sh.len * u, 20 - sh.curve * Math.sin(u * Math.PI) * 9 + (sh.wave ? Math.sin(u * Math.PI * 7) * 1.6 : 0)]; piece(prev, cur2, Math.max(1, sh.blade((i - 1) / steps) * 8), Math.max(1, sh.blade(u) * 8), (uu, v) => kn.colour((i - 1 + uu) / steps, v)); prev = cur2; }
      return; }
    (ICONS[id] || GEAR_ICONS[id] || []).forEach(([pp, q, w0, w1, m]) => piece(pp, q, w0, w1, m));
  }
  // the gear, side on in the same box: pots and vials (wide short pieces), the gambeson, the helm, the tools
  const GEAR_ICONS = {
    firepot: [[[50, 36], [50, 12], 22, 26, 'dark'], [[50, 12], [50, 6], 10, 8, 'iron'], [[50, 6], [58, 0], 2, 2, 'string']],
    incense: [[[50, 36], [50, 14], 26, 22, 'brass'], [[50, 14], [50, 8], 14, 10, 'brass'], [[44, 6], [56, 6], 3, 3, 'iron']],
    vial: [[[50, 38], [50, 16], 14, 14, 'blued'], [[50, 16], [50, 6], 6, 6, 'iron'], [[50, 6], [50, 2], 7, 7, 'wood']],
    flask: [[[50, 38], [50, 18], 24, 18, 'brass'], [[50, 18], [50, 6], 6, 6, 'iron'], [[50, 6], [56, 0], 3, 2, 'string']],
    gambeson: [[[50, 38], [50, 6], 30, 22, 'string'], [[30, 10], [36, 24], 8, 6, 'string'], [[70, 10], [64, 24], 8, 6, 'string']],
    helm: [[[50, 38], [50, 8], 30, 22, 'string'], [[50, 6], [50, -2], 26, 14, 'iron'], [[34, 4], [66, 4], 3, 3, 'iron']],
    tools: [[[24, 30], [60, 12], 4, 4, 'iron'], [[24, 30], [16, 34], 6, 6, 'wood'], [[40, 34], [80, 10], 3, 3, 'iron'], [[76, 12], [84, 6], 6, 6, 'iron']],
  };

  window.SIEGE_ARMS = { W, GEAR, SHAPES, FINISHES, SHELVES, STATS, knife, randomKnife, drawHeld, drawIcon };
}());
