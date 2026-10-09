'use strict';

// The site as a dungeon, seen in first person: one chamber per room of WORLD (ui/1-core.js),
// corridors along its LINKS, a plaque in each chamber that opens the room. Grid-step movement
// as in Dungeon Master; DDA raycasting, one ray per column (Lodev's formulation); 1-bit output
// through a 4x4 Bayer threshold, in the theme's colours. Loaded on the first descent.
(() => {
  const W = 320;
  const H = 200;
  const PITCH = 5; // chamber (c, r) floor spans x = 1 + 5c .. 3 + 5c, same in y; corridors between
  const FOV = 0.66; // camera plane half-width: ~66 degrees
  const STEP_MS = 170;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const FACING = ['north', 'east', 'south', 'west'];
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  let opts; let dlg; let canvas; let ctx; let img; let msg; let hint;
  let map; let size; let plaques; let textures;
  let pos; let angle; let gx; let gy; let face; let anim = null; let room = null;

  /* ---- level ----------------------------------------------------------- */

  function build(world, links) {
    const cols = 1 + Math.max(...Object.values(world).map((w) => w.c));
    const rows = 1 + Math.max(...Object.values(world).map((w) => w.r));
    size = [PITCH * cols + 1, PITCH * rows + 1];
    map = new Uint8Array(size[0] * size[1]).fill(1); // 1 stone, 0 floor, 2 plaque
    const carve = (x, y) => { map[y * size[0] + x] = 0; };
    const centre = (id) => [2 + PITCH * world[id].c, 2 + PITCH * world[id].r];
    Object.keys(world).forEach((id) => {
      const [cx, cy] = centre(id);
      for (let y = cy - 1; y <= cy + 1; y += 1) for (let x = cx - 1; x <= cx + 1; x += 1) carve(x, y);
    });
    links.forEach(([a, b]) => {
      const [ax, ay] = centre(a); const [bx, by] = centre(b);
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x += 1) carve(x, ay);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y += 1) carve(ax, y);
    });
    // Plaque: the middle of a wall with no corridor, else beside the north opening.
    plaques = new Map();
    Object.keys(world).forEach((id) => {
      const [cx, cy] = centre(id);
      const spots = [[cx, cy - 2], [cx, cy + 2], [cx - 2, cy], [cx + 2, cy], [cx - 1, cy - 2], [cx + 1, cy - 2]];
      const [px, py] = spots.find(([x, y]) => map[y * size[0] + x] === 1);
      map[py * size[0] + px] = 2;
      plaques.set(py * size[0] + px, id);
    });
    // the cellar's racks along the corridors (3): a wall cell beside a corridor floor, one in five
    let k = 0;
    for (let y = 1; y < size[1] - 1; y += 1) for (let x = 1; x < size[0] - 1; x += 1) {
      if (map[y * size[0] + x] !== 1 || roomAt(x, y)) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => map[(y + dy) * size[0] + x + dx] === 0 && !roomAt(x + dx, y + dy));
      if (nb.length && (k += 1) % 5 === 0) map[y * size[0] + x] = 3;
    }
  }

  const cellAt = (x, y) => (x < 0 || y < 0 || x >= size[0] || y >= size[1] ? 1 : map[y * size[0] + x]);

  /** Room whose chamber holds the cell, or null in a corridor. */
  function roomAt(x, y) {
    const c = Math.floor((x - 1) / PITCH); const r = Math.floor((y - 1) / PITCH);
    if ((x - 1) % PITCH > 2 || (y - 1) % PITCH > 2) return null;
    return Object.keys(opts.world).find((id) => opts.world[id].c === c && opts.world[id].r === r) || null;
  }

  /* ---- textures: 64x64, brightness in [0, 1]; `accent` marks text pixels -- */

  function rng(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stone() {
    const v = new Float32Array(64 * 64);
    const rand = rng(7);
    const shade = Array.from({ length: 32 }, () => 0.62 + 0.25 * rand());
    for (let y = 0; y < 64; y += 1) {
      const row = y >> 4;
      for (let x = 0; x < 64; x += 1) {
        const xs = x + (row % 2) * 16;
        const mortar = y % 16 === 0 || xs % 32 === 0;
        v[y * 64 + x] = mortar ? 0.12 : shade[(row * 4 + (xs >> 5)) % 32] - 0.08 * rand();
      }
    }
    return { v, accent: new Uint8Array(64 * 64) };
  }

  /** A wine rack: a timber frame, bottle ends in rows, the glass catching the light. */
  function rack() {
    const v = new Float32Array(64 * 64); const rand = rng(11);
    for (let y = 0; y < 64; y += 1) for (let x = 0; x < 64; x += 1) {
      const frame = x % 16 < 2 || y % 16 < 2;
      const cx = (x % 16) - 9; const cy = (y % 16) - 9; const r = Math.hypot(cx, cy);
      v[y * 64 + x] = frame ? 0.42 : r < 5 ? (r < 2 && cx < 0 && cy < 0 ? 0.12 : 0.62 + 0.05 * rand()) : 0.95; // (high = ink: dark cavities, the glass a shade lighter, a glint)
    }
    return { v, accent: new Uint8Array(64 * 64) };
  }

  /** A framed plaque: an image (luminance) or the room's name, engraved. */
  function plaque(id) {
    const off = document.createElement('canvas');
    off.width = 64; off.height = 64;
    const g = off.getContext('2d');
    const tex = { v: new Float32Array(64 * 64).fill(0.9), accent: new Uint8Array(64 * 64) };
    const frame = () => {
      for (let i = 0; i < 64; i += 1) {
        for (const [x, y] of [[i, 0], [i, 1], [i, 62], [i, 63], [0, i], [1, i], [62, i], [63, i]]) tex.v[y * 64 + x] = 0.1;
        for (const [x, y] of [[i, 4], [i, 59], [4, i], [59, i]]) if (i > 3 && i < 60) tex.v[y * 64 + x] = 0.25;
      }
    };
    const name = opts.world[id].name;
    g.font = '9px "Departure Mono", monospace';
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    const words = name.split(' ');
    const lines = [];
    words.forEach((w) => {
      const lastLine = lines[lines.length - 1];
      if (lastLine && g.measureText(`${lastLine} ${w}`).width < 50) lines[lines.length - 1] = `${lastLine} ${w}`;
      else lines.push(w);
    });
    const textMask = () => {
      g.clearRect(0, 0, 64, 64);
      lines.forEach((l, i) => g.fillText(l, 32, 34 + (i - (lines.length - 1) / 2) * 10));
      const a = g.getImageData(0, 0, 64, 64).data;
      for (let i = 0; i < 64 * 64; i += 1) if (a[i * 4 + 3] > 110) tex.accent[i] = 1;
    };
    frame();
    const src = opts.world[id].img;
    if (!src) { textMask(); return tex; }
    // An image plaque: the illumination or the engraving, its name in a band at the foot.
    const im = new Image();
    im.onload = () => {
      g.imageSmoothingEnabled = false;
      const s = Math.min(52 / im.width, 44 / im.height);
      const w = Math.round(im.width * s); const h = Math.round(im.height * s);
      g.drawImage(im, 32 - w / 2, 6, w, h);
      const a = g.getImageData(0, 0, 64, 64).data;
      for (let y = 6; y < 6 + h; y += 1) {
        for (let x = 32 - w / 2; x < 32 + w / 2; x += 1) {
          const i = y * 64 + Math.round(x);
          tex.v[i] = (0.2126 * a[i * 4] + 0.7152 * a[i * 4 + 1] + 0.0722 * a[i * 4 + 2]) / 255;
        }
      }
      lines.splice(0, lines.length, opts.world[id].label.toUpperCase());
      g.clearRect(0, 0, 64, 64);
      g.fillText(lines[0], 32, 58);
      const t = g.getImageData(0, 0, 64, 64).data;
      for (let i = 0; i < 64 * 64; i += 1) if (t[i * 4 + 3] > 110) tex.accent[i] = 1;
      render();
    };
    im.src = new URL(`assets/img/${src}`, opts.site).href;
    return tex;
  }

  /* ---- rendering --------------------------------------------------------- */

  function render() {
    const pal = opts.palette();
    const d = img.data;
    const [px, py] = pos;
    const dirX = Math.cos(angle); const dirY = Math.sin(angle);
    const plX = -dirY * FOV; const plY = dirX * FOV;
    const half = H / 2;
    const put = (x, y, v) => {
      const j = (y * W + x) * 4; const c = pal[v];
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
    };
    // floor, row by row: a dithered falloff with flagstone joints; the vault stays dark
    for (let y = 0; y < H; y += 1) {
      const floor = y > half;
      const rowDist = half / Math.abs(y - half + 0.5);
      for (let x = 0; x < W; x += 1) {
        const cam = (2 * x) / W - 1;
        const fx = px + rowDist * (dirX + plX * cam); const fy = py + rowDist * (dirY + plY * cam);
        let b;
        if (floor) {
          const jx = fx - Math.floor(fx); const jy = fy - Math.floor(fy);
          const joint = jx < 0.04 || jy < 0.04;
          b = (joint ? 0.12 : 0.42) / (1 + 0.45 * rowDist);
        } else {
          b = 0; // a plain vault
        }
        put(x, y, b > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0);
      }
    }
    // walls, one ray per column
    for (let x = 0; x < W; x += 1) {
      const cam = (2 * x) / W - 1;
      const rx = dirX + plX * cam; const ry = dirY + plY * cam;
      let mx = Math.floor(px); let my = Math.floor(py);
      const ddx = Math.abs(1 / rx); const ddy = Math.abs(1 / ry);
      const sx = rx < 0 ? -1 : 1; const sy = ry < 0 ? -1 : 1;
      let sdx = (rx < 0 ? px - mx : mx + 1 - px) * ddx;
      let sdy = (ry < 0 ? py - my : my + 1 - py) * ddy;
      let side = 0;
      for (let k = 0; k < 64; k += 1) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        if (cellAt(mx, my)) break;
      }
      const dist = side === 0 ? sdx - ddx : sdy - ddy;
      const cell = cellAt(mx, my);
      const tex = cell === 2 ? textures.get(plaques.get(my * size[0] + mx)) : cell === 3 ? textures.get('rack') : textures.get('stone');
      let wx = side === 0 ? py + dist * ry : px + dist * rx;
      wx -= Math.floor(wx);
      let tx = Math.floor(wx * 64);
      if ((side === 0 && rx < 0) || (side === 1 && ry > 0)) tx = 63 - tx; // plaques read left to right
      const lineH = H / dist;
      const top = Math.max(0, Math.floor(half - lineH / 2));
      const bottom = Math.min(H, Math.ceil(half + lineH / 2));
      const light = (side ? 0.78 : 1) * Math.min(1.25, 1.6 / (1 + 0.32 * dist));
      for (let y = top; y < bottom; y += 1) {
        const ty = Math.min(63, Math.floor(((y - half + lineH / 2) / lineH) * 64));
        const i = ty * 64 + tx;
        if (tex.accent[i] && light > 0.35) { put(x, y, 2); continue; }
        put(x, y, tex.v[i] * light > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---- movement ----------------------------------------------------------- */

  const angleOf = (f) => Math.atan2(DY[f], DX[f]);

  function settle() {
    const r = roomAt(gx, gy);
    const ahead = cellAt(gx + DX[face], gy + DY[face]) === 2
      ? plaques.get((gy + DY[face]) * size[0] + gx + DX[face]) : null;
    if (r !== room) {
      room = r;
      if (r) {
        opts.enter(r);
        const item = opts.items(r);
        msg.textContent = `${opts.world[r].name}.${item ? ` You see here ${item}.` : ''}`;
      } else {
        msg.textContent = 'A dark corridor.';
      }
    }
    const racked = cellAt(gx + DX[face], gy + DY[face]) === 3;
    hint.textContent = `Facing ${FACING[face]}.${ahead ? ` A plaque: ${opts.world[ahead].name}. Enter to go in.` : racked ? ' A rack of dusty bottles. Enter to read the labels.' : ''}`;
  }

  function animate(toPos, toAngle) {
    const fromPos = pos.slice(); const fromAngle = angle;
    let dA = toAngle - fromAngle;
    dA = Math.atan2(Math.sin(dA), Math.cos(dA)); // shortest turn
    if (opts.reduceMotion) { pos = toPos; angle = fromAngle + dA; render(); settle(); return; }
    const t0 = performance.now();
    anim = (t) => {
      const k = Math.min(1, (t - t0) / STEP_MS);
      const e = k * k * (3 - 2 * k);
      pos = [fromPos[0] + (toPos[0] - fromPos[0]) * e, fromPos[1] + (toPos[1] - fromPos[1]) * e];
      angle = fromAngle + dA * e;
      render();
      if (k < 1) requestAnimationFrame(anim);
      else { anim = null; settle(); }
    };
    requestAnimationFrame(anim);
  }

  function step(dir) { // dir: 0 forward, 1 right, 2 back, 3 left, relative to the facing
    if (anim) return;
    const f = (face + dir) % 4;
    if (cellAt(gx + DX[f], gy + DY[f]) !== 0) { hint.textContent = 'You bump into a wall.'; return; }
    gx += DX[f]; gy += DY[f];
    animate([gx + 0.5, gy + 0.5], angle);
  }

  function turn(by) {
    if (anim) return;
    face = (face + by + 4) % 4;
    animate(pos, angleOf(face));
  }

  function act() {
    const x = gx + DX[face]; const y = gy + DY[face];
    if (cellAt(x, y) === 3) { // a rack: the vintages are the years of study (ui/7-dialogs.js)
      const v = opts.vintages(); const n = v.length ? v[(x * 7 + y * 13) % v.length] : null;
      msg.textContent = n ? `A bottle labelled ${n}` : 'The labels have faded.';
      return;
    }
    if (cellAt(x, y) !== 2) { hint.textContent = 'There is nothing to read here.'; return; }
    const id = plaques.get(y * size[0] + x);
    close();
    opts.read(id);
  }

  function close() {
    if (dlg.open) dlg.close();
  }

  const KEYS = {
    ArrowUp: () => step(0), w: () => step(0),
    ArrowDown: () => step(2), s: () => step(2),
    ArrowLeft: () => turn(-1), a: () => turn(-1),
    ArrowRight: () => turn(1), d: () => turn(1),
    q: () => step(3), e: () => step(1),
    Enter: act, ' ': act,
    '<': close,
    m: () => opts.map(room),
    i: () => opts.inventory(),
    ',': () => { msg.textContent = room ? opts.pickUp(room) : 'There is nothing here to pick up.'; },
  };

  function makeDialog() {
    dlg = document.createElement('dialog');
    dlg.className = 'dungeon';
    dlg.tabIndex = -1; // focused on open, so Enter reads instead of pressing the first button
    dlg.setAttribute('aria-label', 'The descent: the site in first person');
    dlg.innerHTML = `
<canvas width="${W}" height="${H}" aria-hidden="true"></canvas>
<p class="dg-msg" aria-live="polite"></p>
<p class="dg-hint" aria-live="polite"></p>
<div class="dg-pad" role="group" aria-label="Movement">
  <button type="button" data-k="ArrowLeft" aria-label="Turn left">&#x21b6;</button>
  <button type="button" data-k="ArrowUp" aria-label="Step forward">&#x2191;</button>
  <button type="button" data-k="ArrowRight" aria-label="Turn right">&#x21b7;</button>
  <button type="button" data-k="ArrowDown" aria-label="Step back">&#x2193;</button>
  <button type="button" data-k="Enter">[read]</button>
  <button type="button" data-k="m">[map]</button>
  <button type="button" data-k="<">[climb]</button>
</div>
<p class="dg-keys">arrows or WASD &middot; Q E strafe &middot; Enter reads a plaque or a label &middot; m map &middot; Esc or &lt; climbs back</p>`;
    document.body.append(dlg);
    canvas = dlg.querySelector('canvas');
    ctx = canvas.getContext('2d');
    img = ctx.createImageData(W, H);
    msg = dlg.querySelector('.dg-msg');
    hint = dlg.querySelector('.dg-hint');
    dlg.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return; // the button's own click
      const f = KEYS[e.key.length === 1 && e.key !== '<' ? e.key.toLowerCase() : e.key];
      if (!f) return;
      e.preventDefault();
      f();
    });
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) KEYS[b.dataset.k]();
    });
    new MutationObserver(() => { if (dlg.open) render(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-sky'] });
  }

  window.Dungeon = {
    open(o) {
      opts = o;
      if (!dlg) {
        build(o.world, o.links);
        textures = new Map([['stone', stone()], ['rack', rack()]]);
        Object.keys(o.world).forEach((id) => textures.set(id, plaque(id)));
        makeDialog();
      }
      const w = o.world[o.start] || o.world.about;
      gx = 2 + PITCH * w.c; gy = 2 + PITCH * w.r;
      // face the plaque of the starting chamber
      const id = Object.keys(o.world).find((k) => o.world[k] === w);
      const key = [...plaques.entries()].find(([, v]) => v === id)[0];
      const kx = key % size[0]; const ky = Math.floor(key / size[0]);
      face = Math.abs(kx - gx) > Math.abs(ky - gy) ? (kx > gx ? 1 : 3) : (ky > gy ? 2 : 0);
      if (kx !== gx && ky !== gy) face = 0; // a plaque beside the north opening
      pos = [gx + 0.5, gy + 0.5];
      angle = angleOf(face);
      room = null;
      dlg.showModal();
      dlg.focus();
      render();
      settle();
      msg.textContent = `You descend the stairs. ${msg.textContent}`;
    },
  };
})();
