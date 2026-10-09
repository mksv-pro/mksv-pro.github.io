/* The castle's textures: each a pattern on a plane, given as the palette colour (its name in hours.js's
   SURFACES) at integer (x, y). A wall uses them as they are; a floor in perspective with (x, y) its own
   coordinates on the floor (hours.js: floorTex). Deterministic: the same (x, y) always gives the same
   colour. Grouped by what they are made of; `use` says where they fit (wall, floor, cloth, ceiling).
   `textures` on the command line shows them all. */
(function () {
  const fract = (v) => v - Math.floor(v);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453); // (0..1, a value per cell)
  const smooth = (x, y) => { // value noise, 0..1
    const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi); const b = hash(xi + 1, yi); const c = hash(xi, yi + 1); const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const grain = (x, y, s = 0.25) => smooth(x * s, y * s) * 0.65 + smooth(x * s * 2.3 + 40, y * s * 2.3) * 0.35;
  const pick = (t, [hi, mid, sh], lo = 0.3, up = 0.65) => (t < lo ? hi : t > up ? sh : mid);
  const mod = (a, n) => ((a % n) + n) % n;
  /** Bricks or blocks of w x h in courses, every other course shifted by `off` (fraction of w). */
  const courses = (x, y, w, h, off = 0.5) => { const row = Math.floor(y / h); const xs = x + row * Math.round(w * off); return { row, col: Math.floor(xs / w), u: mod(xs, w), v: mod(y, h) }; };
  /** The nearest of a jittered grid's points (cell size s): its id and the gap to the next (Voronoi). */
  const cells = (x, y, s, jit = 0.8) => {
    const cx = Math.floor(x / s); const cy = Math.floor(y / s); let d1 = 1e9; let d2 = 1e9; let id = 0;
    for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) {
      const gx = cx + i; const gy = cy + j; const px = (gx + 0.5 + (hash(gx, gy) - 0.5) * jit) * s; const py = (gy + 0.5 + (hash(gy, gx + 7) - 0.5) * jit) * s;
      const d = Math.hypot(x - px, y - py); if (d < d1) { d2 = d1; d1 = d; id = gx * 7919 + gy; } else if (d < d2) d2 = d;
    }
    return { id, edge: d2 - d1, d: d1 };
  };
  const ROCK = ['ROCK_HI', 'ROCK', 'ROCK_SH']; const STONE = ['STONE_HI', 'STONE', 'STONE_SH']; const TIMBER = ['TIMBER_HI', 'TIMBER', 'TIMBER_SH'];
  const BRICK = ['BRICK_HI', 'BRICK', 'BRICK_SH']; const LIME = ['LIME_HI', 'LIME', 'LIME_SH']; const PLASTER = ['PLASTER_HI', 'PLASTER', 'PLASTER_SH'];

  const T = {
    /* ---- stone and fired clay ---- */
    flagstones: { use: 'floor', fn: (x, y) => { const h = 7; const row = Math.floor(y / h); const w = 9 + Math.floor(hash(row, 3) * 6); const c = courses(x, y, w, h, hash(row, 9)); return c.v === 0 || c.u === 0 ? 'ROCK_DK' : pick(grain(x + c.col * 17, y), ROCK); } },
    ashlar: { use: 'wall', fn: (x, y) => { const c = courses(x, y, 10, 4); return c.v === 3 || c.u === 0 ? 'ROCK_DK' : pick(grain(x + c.col * 13, y), ROCK); } },
    rubble: { use: 'wall', fn: (x, y) => { const c = cells(x, y, 6); return c.edge < 0.9 ? 'ROCK_DK' : pick(hash(c.id, 1) * 0.6 + grain(x, y) * 0.4, ROCK); } },
    cobbles: { use: 'floor', fn: (x, y) => { const c = cells(x, y, 4, 0.6); return c.edge < 0.8 ? 'DIRT_SH' : c.d < 1 ? 'STONE_HI' : pick(hash(c.id, 2), STONE); } },
    pebbles: { use: 'floor', fn: (x, y) => { const c = cells(x, y, 2.6, 0.9); return c.edge < 0.5 ? 'MUD' : ['STONE_HI', 'ROCK_HI', 'STONE', 'ROCK'][Math.floor(hash(c.id, 3) * 4)]; } },
    granite: { use: 'wall', fn: (x, y) => { const h = hash(x, y); return h > 0.93 ? 'OUTLINE' : h > 0.8 ? 'STONE_SH' : h < 0.15 ? 'STONE_HI' : 'STONE'; } },
    mossyStone: { use: 'wall', fn: (x, y) => { const c = courses(x, y, 9, 4); const j = c.v === 3 || c.u === 0; return j ? (smooth(x * 0.2, y * 0.2) > 0.55 ? 'MOSS' : 'ROCK_DK') : smooth(x * 0.15 + 9, y * 0.15) > 0.72 ? 'MOSS_HI' : pick(grain(x + c.col * 11, y), ROCK); } },
    checkerMarble: { use: 'floor', fn: (x, y) => { const s = 8; const dark = (Math.floor(x / s) + Math.floor(y / s)) % 2; const vein = Math.abs(Math.sin(x * 0.35 + smooth(x * 0.1, y * 0.1) * 6 + y * 0.2)) < 0.06; return dark ? (vein ? 'STONE' : 'STONE_SH') : vein ? 'LIME_SH' : 'LIME_HI'; } },
    marble: { use: 'wall', fn: (x, y) => { const v = Math.sin(x * 0.12 + y * 0.05 + smooth(x * 0.08, y * 0.08) * 7); return Math.abs(v) < 0.05 ? 'STONE_SH' : Math.abs(v) < 0.15 ? 'LIME_SH' : 'LIME_HI'; } },
    terracotta: { use: 'floor', fn: (x, y) => { const s = 6; return mod(x, s) === 0 || mod(y, s) === 0 ? 'PLASTER_SH' : pick(hash(Math.floor(x / s), Math.floor(y / s)) * 0.5 + grain(x, y) * 0.5, ['RUST_HI', 'RUST', 'RUST_SH'], 0.25, 0.7); } },
    hexTiles: { use: 'floor', fn: (x, y) => { const s = 7; const row = Math.floor(y / (s * 0.87)); const xs = x + (row % 2) * s / 2; const c = cells(xs, y, s, 0); return c.edge < 0.9 ? 'ROCK_DK' : (row + Math.floor(xs / s)) % 3 === 0 ? 'RUST' : 'PLASTER_HI'; } },
    encaustic: { use: 'floor', fn: (x, y) => { const s = 10; const u = mod(x, s) - 4.5; const v = mod(y, s) - 4.5; if (mod(x, s) === 0 || mod(y, s) === 0) return 'RUST_SH'; const r = Math.hypot(u, v); const lobe = Math.abs(r - 2.6 - Math.cos(Math.atan2(v, u) * 4)) < 0.7; return lobe || r < 1 ? 'CREAM' : 'RUST'; } },
    slateTiles: { use: 'ceiling', fn: (x, y) => { const c = courses(x, y, 6, 3); return c.v === 2 ? 'SLATE_SH' : c.u === 0 ? 'SLATE_SH' : pick(grain(x, y) * 0.5 + hash(c.col, c.row) * 0.5, ['SLATE_HI', 'SLATE', 'SLATE_SH']); } },
    mosaic: { use: 'floor', fn: (x, y) => { const gx = Math.floor(x / 2); const gy = Math.floor(y / 2); if (mod(x, 2) === 1 && mod(y, 2) === 1) return 'PLASTER_SH'; const r = Math.hypot(mod(gx, 12) - 6, mod(gy, 12) - 6); return r < 2 ? 'T_GULES' : r < 4 ? 'T_OR' : r < 5 ? 'T_AZURE' : hash(gx, gy) > 0.8 ? 'STONE_HI' : 'LIME_HI'; } },
    brickRunning: { use: 'wall', fn: (x, y) => { const c = courses(x, y, 6, 3); return c.v === 2 || c.u === 0 ? 'ROCK_DK' : pick(hash(c.col, c.row) * 0.7 + grain(x, y) * 0.3, BRICK); } },
    brickHerringbone: { use: 'floor', fn: (x, y) => { const s = 8; const a = mod(x + y, s * 2) < s; const u = a ? mod(x - y, s) : mod(x + y, s); return u === 0 || mod(a ? x + y : x - y, 4) === 0 ? 'ROCK_DK' : pick(hash(Math.floor((x + y) / 4), Math.floor((x - y) / 4)), BRICK); } },
    brickFlemish: { use: 'wall', fn: (x, y) => { const row = Math.floor(y / 3); const xs = x + (row % 2) * 3; const unit = mod(xs, 9); if (mod(y, 3) === 2 || unit === 0 || unit === 6) return 'ROCK_DK'; return unit > 6 ? 'BRICK_SH' : pick(grain(x, y), BRICK); } }, // (a stretcher, then a header's dark end)
    brickBasket: { use: 'floor', fn: (x, y) => { const s = 6; const flip = (Math.floor(x / s) + Math.floor(y / s)) % 2; const u = flip ? mod(y, s) : mod(x, s); return u % 3 === 0 ? 'ROCK_DK' : pick(hash(Math.floor(x / s), Math.floor(y / s) + u), BRICK); } },
    beatenEarth: { use: 'floor', fn: (x, y) => { const h = hash(x, y); return h > 0.96 ? 'STONE' : h > 0.9 ? 'THATCH_SH' : pick(grain(x, y, 0.18), ['DIRT', 'DIRT', 'DIRT_SH'], 0.3, 0.6); } },
    /* ---- wood ---- */
    oakPlanks: { use: 'floor', fn: (x, y) => { const w = 5; const col = Math.floor(x / w); const len = 22 + Math.floor(hash(col, 1) * 16); const yy = y + hash(col, 2) * len; return mod(x, w) === 0 || mod(yy, len) < 1 ? 'TIMBER_SH' : pick(grain(x * 0.4, y * 2), TIMBER, 0.22, 0.7); } },
    herringbone: { use: 'floor', fn: (x, y) => { const s = 10; const a = mod(x + y, s * 2) < s; const u = mod(a ? x - y : x + y, 3); return u === 0 || mod(a ? x + y : x - y, s) === 0 ? 'TIMBER_SH' : a ? 'TIMBER' : 'TIMBER_HI'; } },
    basketParquet: { use: 'floor', fn: (x, y) => { const s = 8; const flip = (Math.floor(x / s) + Math.floor(y / s)) % 2; const u = flip ? mod(y, s) : mod(x, s); return mod(x, s) === 0 || mod(y, s) === 0 ? 'OUTLINE' : u % 3 === 0 ? 'TIMBER_SH' : flip ? 'TIMBER' : 'WOOD'; } },
    linenfold: { use: 'wall', fn: (x, y) => { const pw = 10; const ph = 18; const u = mod(x, pw); const v = mod(y, ph); if (u < 1 || v < 1) return 'TIMBER_HI'; if (u === pw - 1 || v === ph - 1) return 'TIMBER_SH'; const fold = Math.sin((u / pw) * Math.PI * 3); return v < 3 || v > ph - 4 ? (u % 3 === 1 ? 'TIMBER_SH' : 'TIMBER') : fold > 0.4 ? 'TIMBER_HI' : fold < -0.4 ? 'TIMBER_SH' : 'TIMBER'; } }, // (the carved folds of cloth on oak panels)
    logs: { use: 'wall', fn: (x, y) => { const h = 6; const v = mod(y, h); const end = mod(x + Math.floor(y / h) * 13, 40) < 3; if (end) return v === 0 || v === h - 1 ? 'TIMBER_SH' : Math.hypot(mod(x, 40) - 1, v - 2.5) < 1 ? 'TIMBER_HI' : 'WOOD'; return v === 0 ? 'OUTLINE' : v === 1 ? 'TIMBER_HI' : v === h - 1 ? 'TIMBER_SH' : pick(grain(x * 0.3, y * 2), TIMBER); } },
    shingles: { use: 'ceiling', fn: (x, y) => { const c = courses(x, y, 4, 3); return c.v === 2 ? 'OUTLINE' : c.u === 0 ? 'TIMBER_SH' : hash(c.col, c.row) > 0.7 ? 'TIMBER_HI' : 'TIMBER'; } },
    staves: { use: 'wall', fn: (x, y) => { const v = mod(y, 24); if (v < 2) return v ? 'ARM_SH' : 'OUTLINE'; return mod(x, 4) === 0 ? 'TIMBER_SH' : pick(grain(x, y * 0.3), TIMBER); } }, // (a cask's staves and an iron hoop)
    wattle: { use: 'wall', fn: (x, y) => { const s = 4; const over = (Math.floor(x / s) + Math.floor(y / s)) % 2; const u = over ? mod(y, s) : mod(x, s); return u === 0 ? 'TIMBER_SH' : over ? 'WOOD' : 'TIMBER'; } },
    halfTimber: { use: 'wall', fn: (x, y) => { const bw = 24; const bh = 20; const u = mod(x, bw); const v = mod(y, bh); if (u < 3 || v < 2) return u === 0 || v === 0 ? 'TIMBER_SH' : 'TIMBER'; const brace = Math.abs(u - 3 - (v - 2) * ((bw - 3) / (bh - 2))) < 1.5; return brace ? 'TIMBER' : pick(grain(x, y), PLASTER); } },
    planksUpright: { use: 'wall', fn: (x, y) => { const w = 6; const col = Math.floor(x / w); return mod(x, w) === 0 ? 'OUTLINE' : mod(x, w) === 1 ? 'TIMBER_HI' : hash(col, Math.floor(y / 30)) > 0.85 && mod(y, 30) === 12 ? 'TIMBER_SH' : pick(grain(x * 2, y * 0.3), TIMBER); } },
    rushes: { use: 'floor', fn: (x, y) => { const s = Math.floor(hash(Math.floor(x / 3), Math.floor(y / 2)) * 4); return (mod(x + y * (s - 1.5), 3) < 1) ? (s > 1 ? 'THATCH' : 'THATCH_SH') : pick(grain(x, y), TIMBER); } }, // (rushes strewn over the boards)
    /* ---- plaster and paint ---- */
    limewash: { use: 'wall', fn: (x, y) => pick(grain(x, y, 0.12), LIME, 0.2, 0.75) },
    crackedPlaster: { use: 'wall', fn: (x, y) => { const c = cells(x, y, 14, 0.9); if (c.edge < 0.5 && hash(c.id, 5) > 0.5) return 'PLASTER_SH'; return smooth(x * 0.05, y * 0.05) > 0.75 ? 'STONE' : pick(grain(x, y, 0.15), PLASTER, 0.2, 0.75); } }, // (and the stone where it has fallen)
    falseJoints: { use: 'wall', fn: (x, y) => { const c = courses(x, y, 16, 7); return c.v === 0 || c.u === 0 ? 'CLOTH' : pick(grain(x, y, 0.1), PLASTER, 0.2, 0.8); } }, // (the medieval habit: blocks painted in red lines on the plaster)
    fleurDeLis: { use: 'wall', fn: (x, y) => { const s = 10; const off = (Math.floor(y / s) % 2) * 5; const u = mod(x + off, s) - 4.5; const v = mod(y, s) - 4; const lis = (Math.abs(u) < 1 && v > -3 && v < 3) || (Math.abs(Math.abs(u) - 2) < 1 && v > -1 && v < 2 && Math.abs(u) > 1) || (Math.abs(u) < 3 && v === 1); return lis ? 'T_OR' : 'T_AZURE'; } },
    starsVault: { use: 'ceiling', fn: (x, y) => { const s = 9; const gx = Math.floor(x / s); const gy = Math.floor(y / s); const cx = gx * s + 2 + Math.floor(hash(gx, gy) * 5); const cy = gy * s + 2 + Math.floor(hash(gy, gx) * 5); const dx = Math.abs(x - cx); const dy = Math.abs(y - cy); return dx + dy === 0 ? 'GOLD' : dx + dy === 1 ? 'T_OR' : 'T_NAVY'; } },
    damask: { use: 'cloth', fn: (x, y) => { const s = 12; const u = mod(x, s) - 6; const v = mod(y + (Math.floor(x / s) % 2) * 6, s) - 6; const r = Math.abs(u) * 1.2 + Math.abs(v) * 0.8; return Math.abs(r - 4) < 0.7 || (r < 1.5) ? 'BANNER' : 'BANNER_SH'; } },
    paly: { use: 'cloth', fn: (x) => (mod(x, 8) < 4 ? 'T_GULES' : 'T_OR') },
    chevrony: { use: 'cloth', fn: (x, y) => (mod(y + Math.abs(mod(x, 12) - 6), 8) < 4 ? 'T_AZURE' : 'T_ARGENT') },
    lozengy: { use: 'cloth', fn: (x, y) => ((Math.floor((x + y) / 6) + Math.floor((x - y + 600) / 6)) % 2 ? 'T_VERT' : 'T_OR') },
    checky: { use: 'cloth', fn: (x, y) => ((Math.floor(x / 5) + Math.floor(y / 5)) % 2 ? 'T_OR' : 'T_AZURE') },
    ermine: { use: 'cloth', fn: (x, y) => { const s = 8; const off = (Math.floor(y / s) % 2) * 4; const u = mod(x + off, s) - 4; const v = mod(y, s) - 2; return (u === 0 && v >= 0 && v < 4) || (Math.abs(u) === 1 && v === 3) || (u === 0 && v === -1) ? 'T_SABLE' : 'T_ARGENT'; } },
    /* ---- cloth ---- */
    kilim: { use: 'cloth', fn: (x, y) => { const band = Math.floor(y / 6) % 4; const d = Math.abs(mod(x, 12) - 6) + Math.abs(mod(y, 6) - 3); if (band === 1 && d < 3) return 'T_OR'; if (band === 3 && d < 2) return 'CREAM'; return ['T_GULES', 'T_NAVY', 'T_GULES', 'RUST_SH'][band]; } },
    medallion: { use: 'cloth', fn: (x, y) => { const s = 20; const u = mod(x, s) - 10; const v = mod(y, s) - 10; const r = Math.abs(u) + Math.abs(v) * 1.4; return r < 3 ? 'T_OR' : r < 6 ? 'T_NAVY' : r < 7 ? 'CREAM' : mod(x + y, 4) === 0 ? 'BANNER_SH' : 'BANNER'; } },
    millefleurs: { use: 'cloth', fn: (x, y) => { const h = hash(Math.floor(x / 3), Math.floor(y / 3)); if (mod(x, 3) === 1 && mod(y, 3) === 1 && h > 0.6) return ['FL_RED', 'FL_YEL', 'FL_WHITE', 'FL_BLUE'][Math.floor(h * 10) % 4]; return hash(x, y) > 0.85 ? 'FERN' : 'FG_PINE'; } }, // (the thousand flowers of the unicorn tapestries)
    velvet: { use: 'cloth', fn: (x, y) => { const sheen = Math.sin(x * 0.18 + smooth(x * 0.06, y * 0.06) * 4); return sheen > 0.75 ? 'CLOTH' : sheen < -0.5 ? 'BANNER_SH' : 'BANNER'; } },
    burlap: { use: 'cloth', fn: (x, y) => ((mod(x, 2) === 0) !== (mod(y, 2) === 0) ? (hash(x, y) > 0.8 ? 'THATCH_SH' : 'THATCH') : 'WHEAT_SH') },
    woolHerringbone: { use: 'cloth', fn: (x, y) => (mod(y + (mod(x, 8) < 4 ? mod(x, 4) : 3 - mod(x, 4)), 3) === 0 ? 'CLOAK' : 'HAT') },
    leather: { use: 'cloth', fn: (x, y) => { const c = cells(x, y, 5, 1); return c.edge < 0.4 ? 'TIMBER_SH' : c.d < 1.2 ? 'TIMBER' : 'LEATHER'; } },
    /* ---- metal and glass ---- */
    ironStuds: { use: 'wall', fn: (x, y) => { const s = 8; const u = mod(x, s); const v = mod(y, s); if (u === 0 || v === 0) return 'OUTLINE'; if (u === 4 && v === 4) return 'ARM'; if (Math.abs(u - 4) + Math.abs(v - 4) === 1) return 'ARM_SH'; return hash(x, y) > 0.9 ? 'RUST_SH' : 'BLACKFUR'; } },
    leadedGlass: { use: 'wall', fn: (x, y) => { const s = 7; const a = mod(x + y, s); const b = mod(x - y, s); if (a === 0 || b === 0) return 'OUTLINE'; return hash(Math.floor((x + y) / s), Math.floor((x - y) / s)) > 0.75 ? 'WATER_HI' : 'WATER'; } }, // (diamond quarries in lead)
    verdigris: { use: 'wall', fn: (x, y) => { const t = grain(x, y, 0.2); return t > 0.7 ? 'RUST_SH' : t > 0.55 ? 'DOME_SH' : t < 0.25 ? 'DOME_HI' : 'DOME'; } }, // (copper gone green)
    gildedPunched: { use: 'wall', fn: (x, y) => { const s = 4; const off = (Math.floor(y / s) % 2) * 2; return mod(x + off, s) === 0 && mod(y, s) === 0 ? 'GOLD_SH' : hash(x, y) > 0.92 ? 'CREAM' : 'GOLD'; } }, // (gold leaf, tooled with a punch, as on a panel painting's ground)
  };
  window.TEXTURES = T;
}());
