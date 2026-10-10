/* Siege, the game under the castle: its arms. Each weapon's numbers (price, damage, rate, magazine,
   spread, how it moves you, its recoil: the spray's path, shot by shot, in degrees of yaw and pitch, the
   same each time, so it can be learnt), the throwables, the gear; the knives, in six shapes, with
   finishes made from a seed (a pattern, its colours, its wear), drawn in the hand at the screen's foot.
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
    greatbow: { name: 'Great crossbow', slot: 1, price: 4750, dmg: 115, pierce: 0.97, rate: 0.7, mag: 5, reload: 3.6, spread: 8, mspread: 12, scoped: 0.06, speed: 0.8, auto: false, head: 1.2, fall: 0, recoil: spray(5, 2, 0, 7) },
  };
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
  const SHAPES = {
    dagger: { name: 'Rondel dagger', blade: (u) => 1 - u * 0.9, len: 1, curve: 0 }, // u: 0 at the guard, 1 at the tip; the blade's half-width there
    karambit: { name: 'Karambit', blade: (u) => 0.9 - u * 0.6, len: 0.8, curve: 0.9, ring: true },
    butterfly: { name: 'Balisong', blade: (u) => (u < 0.85 ? 0.7 : (1 - u) * 4.6), len: 1, curve: 0, flip: true },
    bayonet: { name: 'Bayonet', blade: (u) => 0.85 - u * 0.75, len: 1.15, curve: 0, fuller: true },
    falchion: { name: 'Falchion', blade: (u) => 0.8 + u * 0.4 - (u > 0.8 ? (u - 0.8) * 5 : 0), len: 1.05, curve: 0.25 },
    misericorde: { name: 'Misericorde', blade: (u) => 0.45 - u * 0.4, len: 1.2, curve: 0 },
  };
  const FINISHES = {
    plain: { name: 'Forge-bright', at: () => [196, 202, 212] },
    damascus: { name: 'Damascus', at: (u, v, r) => { const w = Math.sin(u * 40 + Math.sin(v * 9 + r * 6) * 3); return w > 0.3 ? [214, 216, 222] : w < -0.4 ? [92, 96, 106] : [150, 154, 164]; } },
    ombre: { name: 'Ombre', at: (u) => { const a = [250, 120, 200]; const b = [120, 90, 240]; const c = [255, 220, 120]; const k = u < 0.5 ? u * 2 : (u - 0.5) * 2; return (u < 0.5 ? a : b).map((x, i) => x + ((u < 0.5 ? b : c)[i] - x) * k); } },
    tempered: { name: 'Tempered (case-hardened)', at: (u, v, r) => { const n = Math.sin(u * 13 + r * 9) * Math.cos(v * 11 - r * 5) + Math.sin((u + v) * 7 + r); return n > 0.7 ? [230, 190, 80] : n > -0.2 ? [70, 110, 190] : [150, 120, 160]; } },
    night: { name: 'Night', at: (_u, v) => (Math.abs(v - 0.5) > 0.42 ? [120, 124, 136] : [38, 40, 50]) },
    bloodvine: { name: 'Bloodvine', at: (u, v, r) => { const l = Math.abs(Math.sin(u * 22 + r * 4) * 0.5 - (v - 0.5)) < 0.06 || Math.abs(Math.sin(v * 17 + u * 8 + r) - 0.2) < 0.08; return l ? [30, 10, 12] : [170, 30, 36]; } },
    gilded: { name: 'Gilded', at: (u, v, r) => (Math.sin(u * 30 + v * 20 + r * 3) > 0.6 ? [255, 236, 160] : [218, 168, 56]) },
    marbled: { name: 'Marbled', at: (u, v, r) => { const m = Math.sin(u * 8 + Math.sin(v * 13 + u * 5 + r * 7) * 2.2); return m > 0.5 ? [80, 200, 210] : m < -0.5 ? [40, 60, 160] : [200, 240, 245]; } },
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
  const randomKnife = () => ({ shape: Object.keys(SHAPES)[Math.floor(Math.random() * 6)], finish: Object.keys(FINISHES)[Math.floor(Math.random() * Object.keys(FINISHES).length)], seed: Math.floor(Math.random() * 1000), wear: Math.random() ** 1.7 });

  /* ---- in the hand: each weapon seen from behind, as in the old shooters, pointing up to the middle
     of the screen: its parts tapered pieces (near and wide at the foot, far and narrow up the screen),
     shaded round like a barrel or a stock, a hand or two on it; the knife's blade coloured by its
     finish. put(x, y, [r, g, b]) on the game's pixels; a: { kick, bob, inspect, swing, reload (0..1 or
     -1), flash, scale }. Coordinates: from the anchor at the screen's foot, right of centre, in pixels
     of a 320 x 180 picture. */
  const MAT = { wood: [[176, 118, 62], [126, 82, 44], [78, 48, 26]], iron: [[214, 220, 230], [128, 134, 148], [52, 56, 68]],
    brass: [[252, 222, 130], [212, 164, 54], [140, 96, 26]], dark: [[96, 70, 46], [66, 46, 30], [36, 24, 16]], string: [[236, 228, 200], [200, 190, 160], [150, 140, 110]] };
  const GUNS = { // [from, to, width at from, width at to, material]; hands [x, y, r]; muzzle [x, y]
    wheellock: { parts: [[[12, 4], [5, -24], 11, 8, 'wood'], [[5, -24], [-12, -56], 6, 3, 'iron'], [[3, -20], [8, -28], 5, 4, 'brass']], hands: [[10, -6, 9]], muzzle: [-12, -57] },
    pepperbox: { parts: [[[12, 4], [5, -24], 11, 8, 'wood'], [[5, -24], [-10, -52], 9, 7, 'iron'], [[3, -20], [8, -28], 5, 4, 'brass']], hands: [[10, -6, 9]], muzzle: [-10, -53] },
    blunderbuss: { parts: [[[20, 8], [2, -34], 18, 11, 'wood'], [[2, -34], [-26, -78], 7, 5, 'iron'], [[-26, -78], [-34, -92], 5, 12, 'iron'], [[6, -30], [10, -40], 6, 5, 'brass']], hands: [[14, -6, 9], [-12, -56, 7]], muzzle: [-34, -94] },
    arquebus: { parts: [[[20, 8], [2, -34], 18, 11, 'wood'], [[2, -34], [-38, -104], 6, 3, 'iron'], [[-4, -44], [-16, -66], 9, 6, 'wood'], [[6, -32], [12, -42], 6, 5, 'brass'], [[-10, -54], [-12, -58], 8, 7, 'brass']], hands: [[14, -6, 9], [-14, -62, 7]], muzzle: [-38, -106] },
    caliver: { parts: [[[18, 8], [2, -32], 15, 10, 'dark'], [[2, -32], [-34, -96], 5, 3, 'iron'], [[-4, -42], [-14, -60], 8, 6, 'dark'], [[6, -30], [11, -38], 5, 4, 'brass']], hands: [[13, -6, 9], [-12, -56, 7]], muzzle: [-34, -98] },
    repeater: { parts: [[[16, 8], [-12, -60], 13, 7, 'wood'], [[-6, -46], [-10, -66], 11, 9, 'dark']], prod: [[-12, -62], 58, 6], hands: [[12, -4, 9]], muzzle: [-12, -66] },
    greatbow: { parts: [[[18, 8], [-14, -70], 14, 7, 'wood'], [[-2, -40], [-12, -64], 4, 4, 'brass']], prod: [[-14, -72], 84, 8], hands: [[13, -4, 9], [-6, -48, 7]], muzzle: [-14, -76] },
  };
  function drawHeld(id, kn, put0, Wd, Hd, a) {
    const S = id === 'knife' ? (a.scale || 1) : 1; const fat = id === 'knife' ? 1 : (a.scale || 1) * 1.1; // (a long arm keeps its length, from the screen's foot to its middle, and grows thick)
    const ax = Math.round(Wd * 0.6 + (a.bob || 0) * S); const ay = Math.round(Hd + 4 * S + (a.kick || 0) * 7 * S + (a.reload >= 0 ? Math.sin(a.reload * Math.PI) * 40 * S : 0));
    const put = (x, y, c) => { const X = Math.round(ax + x * S); const Y = Math.round(ay + y * S); for (let j = 0; j < Math.ceil(S); j += 1) for (let i = 0; i < Math.ceil(S); i += 1) put0(X + i, Y + j, c); };
    /** A tapered piece from p to q, width w0 to w1, coloured by col(u along, v across) or a material, shaded round. */
    const piece = (p, q, w0, w1, col) => {
      const L = Math.max(1, Math.hypot(q[0] - p[0], q[1] - p[1])); const nx = -(q[1] - p[1]) / L; const ny = (q[0] - p[0]) / L;
      for (let s2 = 0; s2 <= L * 1.5; s2 += 1) { const u = s2 / (L * 1.5); const cx = p[0] + (q[0] - p[0]) * u; const cy = p[1] + (q[1] - p[1]) * u; const w = w0 + (w1 - w0) * u;
        for (let k = -w / 2; k <= w / 2; k += 0.5) { const v = (k + w / 2) / Math.max(1, w); const c = typeof col === 'function' ? col(u, v) : (() => { const m = MAT[col]; const r = Math.sin(v * Math.PI); return v < 0.28 ? m[0] : r > 0.55 ? m[1] : m[2]; })();
          put(cx + nx * k, cy + ny * k, k < -w / 2 + 0.6 || k > w / 2 - 0.6 ? c.map((q2) => q2 * 0.55) : c); } }
    };
    const hand = (x, y, r) => { for (let j = -r; j <= r; j += 1) for (let i = -r; i <= r; i += 1) { const d = Math.hypot(i, j * 1.2); if (d > r) continue; put(x + i, y + j, d > r - 1.2 ? [120, 70, 46] : i < -r * 0.3 && j < 0 ? [244, 204, 166] : [216, 156, 116]); }
      for (let j = 0; j < r * 1.4; j += 1) for (let i = -r; i <= r; i += 1) put(x + i + j * 0.4, y + r + j, j % 4 === 0 ? [120, 30, 30] : [170, 46, 40]); }; // (and the sleeve, red, going off the screen)
    if (id === 'knife') {
      const sh = kn.shape; const ins = a.inspect >= 0 ? a.inspect : -1; const sw = a.swing >= 0 ? Math.sin(a.swing * Math.PI) : 0;
      const turn = ins >= 0 ? Math.sin(ins * Math.PI * 2) : 0; const L = 62 * sh.len; const hx = 22 - sw * 26 + turn * 6; const hy = -16 - sw * 30;
      const tip = [hx - 34 - turn * 20, hy - L + Math.abs(turn) * 14];
      const flipK = sh.flip && ins >= 0 ? Math.cos(ins * Math.PI * 4) : 1;
      piece([hx + 10, hy + 20], [hx, hy], 7, 6, 'dark'); // the grip
      piece([hx - 8 * flipK, hy - 1], [hx + 8 * flipK, hy + 1], 3, 3, 'brass'); // the guard
      const steps = 40; let prev = [hx, hy - 2];
      for (let k = 1; k <= steps; k += 1) { const u = k / steps; const bend = sh.curve * Math.sin(u * Math.PI) * 10; const cur = [hx + (tip[0] - hx) * u + bend, hy - 2 + (tip[1] - hy + 2) * u];
        const w0 = Math.max(1, sh.blade((k - 1) / steps) * 9 * Math.abs(flipK)); const w1 = Math.max(1, sh.blade(u) * 9 * Math.abs(flipK));
        piece(prev, cur, w0, w1, (uu, v) => { const c = kn.colour((k - 1 + uu) / steps, v); const edge = v > 0.82 ? 1.3 : v < 0.18 ? 0.7 : 1; return c.map((q2) => Math.min(255, q2 * edge)); }); prev = cur; }
      if (sh.ring) for (let q = 0; q < 6.28; q += 0.25) put(hx + 14 + Math.cos(q) * 4, hy + 22 + Math.sin(q) * 4, MAT.iron[1]);
      hand(hx + 6, hy + 8, 9);
      return;
    }
    const gun = GUNS[id]; if (!gun) return;
    if (gun.prod) { const [[px, py], span, bend] = gun.prod; // the bow across, its string drawn back to the nut
      for (let k = -span * fat / 2; k <= span * fat / 2; k += 1) { const y = py + (Math.abs(k) / (span * fat / 2)) ** 2 * bend; put(px + k, y, MAT.iron[0]); put(px + k, y + 1, MAT.iron[1]); put(px + k, y + 2, MAT.iron[2]); }
      for (let k = -span * fat / 2; k <= span * fat / 2; k += 1) { const t = Math.abs(k) / (span * fat / 2); put(px + k, py + bend + (1 - t) * 14, MAT.string[1]); } }
    gun.parts.forEach(([p, q, w0, w1, m]) => piece(p, q, w0 * fat, w1 * fat, m));
    if (ARMS_SCOPE[id]) piece([-4, -46], [-12, -66], 5, 4, 'brass');
    gun.hands.forEach(([x, y, r]) => hand(x, y, Math.round(r * Math.min(fat, 1.3))));
    if (a.flash) { const [fx, fy] = gun.muzzle; for (let k = 0; k < 70; k += 1) { const q = Math.random() * 6.28; const r2 = Math.random() * 9; put(fx + Math.cos(q) * r2, fy + Math.sin(q) * r2 * 0.8 - 3, [255, 236 - r2 * 12, 140 - r2 * 12]); } }
  }
  const ARMS_SCOPE = { greatbow: true };

  window.SIEGE_ARMS = { W, GEAR, SHAPES, FINISHES, knife, randomKnife, drawHeld };
}());
