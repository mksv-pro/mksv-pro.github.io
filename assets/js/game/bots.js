/* Siege's bots: what they buy, where they go, how they see, react and shoot. Each thinks every frame
   from what the game tells it (g: the map, the actors, line of sight, the keg) and acts through the
   game (g.move, g.fire, g.plant, g.defuse, g.throw). They see within their field of view, not through
   walls or smoke; they hear shots and steps nearby; they take a human time to react (by difficulty)
   and miss more when moving, far, or blinded. The attackers take the keg to a site and plant it; the
   defenders hold the sites and, once it is planted, go to defuse it. Paths: breadth-first search on
   the grid, eight ways, no corner cutting. */
(function () {
  const DIFF = { // reaction (s), aim error (deg), turn speed (rad/s)
    easy: { react: 0.65, err: 6, turn: 4 }, normal: { react: 0.42, err: 3.5, turn: 6 }, hard: { react: 0.26, err: 1.8, turn: 9 },
  };
  /** The next cell towards `to` from `from` on the grid (cells [x, y]), or null: a breadth-first search, kept a second. */
  function path(g, from, to) {
    const W = g.w; const H = g.h; const key = (x, y) => y * W + x; const start = key(...from); const goal = key(...to);
    if (start === goal || g.wall(...to)) return null;
    const prev = new Int32Array(W * H).fill(-1); prev[start] = start; const q = [start];
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]; if (c === goal) break; const cx = c % W; const cy = Math.floor(c / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx; const ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || g.wall(nx, ny)) continue;
        if (dx && dy && (g.wall(cx + dx, cy) || g.wall(cx, cy + dy))) continue; // (no cutting a corner)
        const n = key(nx, ny); if (prev[n] >= 0) continue; prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] < 0) return null;
    const cells = []; for (let c = goal; c !== start; c = prev[c]) cells.push([c % W + 0.5, Math.floor(c / W) + 0.5]);
    return cells.reverse();
  }
  /** What a bot buys with its money, by side (the attackers' rifle, the defenders' own). */
  function buy(b, g) {
    const A = g.arms.W; const G = g.arms.GEAR; const spend = (p) => { if (b.money < p) return false; b.money -= p; return true; };
    const rifle = Math.random() < 0.3 ? 'ak47' : b.team === 'att' ? 'arquebus' : 'caliver'; // (the cellar's rifle, now and then)
    if (b.money >= 6200 && Math.random() < 0.15 && !b.weapons[1]) { if (spend(A.greatbow.price)) g.give(b, 'greatbow'); }
    else if (b.money >= A[rifle].price + 1000 && !b.weapons[1]) { if (spend(A[rifle].price)) g.give(b, rifle); }
    else if (b.money >= 2000 && !b.weapons[1]) { const w = Math.random() < 0.5 ? 'repeater' : 'blunderbuss'; if (spend(A[w].price)) g.give(b, w); }
    else if (b.money >= 900 && b.weapons[2] === 'wheellock' && Math.random() < 0.5) { if (spend(A.pepperbox.price)) g.give(b, 'pepperbox'); }
    if (b.armour < 50 && b.money >= G.helm.price) { spend(G.helm.price); b.armour = 100; b.helm = true; } else if (b.armour < 50 && b.money >= G.gambeson.price) { spend(G.gambeson.price); b.armour = 100; }
    if (b.money >= 500 && Math.random() < 0.6) { spend(G.incense.price); b.gear.smoke = 1; }
    if (b.money >= 400 && Math.random() < 0.5) { spend(G.vial.price); b.gear.flash = 1; }
    if (b.money >= 400 && Math.random() < 0.4) { spend(G.firepot.price); b.gear.he = 1; }
    if (b.team === 'def' && b.money >= 600 && Math.random() < 0.5) { spend(G.tools.price); b.tools = true; }
    b.slot = b.weapons[1] ? 1 : 2;
  }
  /** The attackers' ways to a site (g.lanes[site]: points to pass first), one chosen for each man each round. */
  function viaFirst(b, g, goal) {
    const ai = b.ai; const lanes = g.lanes && g.lanes[g.attSite]; if (!lanes || ai.viaDone) return goal;
    ai.via ||= lanes[(b.idx + g.round) % lanes.length]; if (Math.hypot(ai.via[0] - b.x, ai.via[1] - b.y) < 1.5) { ai.viaDone = true; return goal; } return ai.via;
  }
  const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /** One bot's thinking for dt seconds. */
  function think(b, g, dt) {
    if (!b.alive || g.frozen) return;
    const D = DIFF[g.difficulty] || DIFF.normal; const ai = b.ai; const now = g.now;
    if (now < b.blindUntil) { g.move(b, Math.cos(b.a + Math.PI) * 0.5, Math.sin(b.a + Math.PI) * 0.5, dt); return; } // (blinded: backs off, does not shoot)
    // what it sees: the nearest enemy in its field of view, in sight
    const foes = g.actors.filter((o) => o.alive && o.team !== b.team);
    let seen = null; let best = 1e9; // (the nearest in sight)
    foes.forEach((o) => { const d = Math.hypot(o.x - b.x, o.y - b.y); const off = Math.abs(wrap(angTo(b, o) - b.a)); if (d < 28 && (off < 1.1 || d < 2.2) && d < best && g.sees(b, o)) { best = d; seen = o; } });
    if (seen) { if (ai.target !== seen) { ai.target = seen; ai.reactAt = now + D.react * (0.8 + Math.random() * 0.5); } ai.lastSeen = { x: seen.x, y: seen.y, t: now }; } else ai.target = null;
    // heard: the last noise near enough (shots, steps, the keg's beep)
    const heard = g.noises.filter((n) => n.team !== b.team && now - n.t < 1.5 && Math.hypot(n.x - b.x, n.y - b.y) < n.r).pop();
    if (!seen && heard && (!ai.lastSeen || now - ai.lastSeen.t > 2)) ai.lastSeen = { x: heard.x, y: heard.y, t: now };
    // aim and shoot (within the weapon's reach, or when hit: farther off, it keeps to its way)
    const reach = ((w) => (w.scoped ? 40 : w.pellets ? 9 : w.slot === 2 ? 15 : 24))(g.arms.W[b.weapons[b.slot] || 'knife']);
    if (seen && best > reach && now - (b.hitAt || -9) > 2) seen = null;
    if (seen) {
      const want = angTo(b, seen); const da = wrap(want - b.a); b.a += Math.sign(da) * Math.min(Math.abs(da), D.turn * dt);
      const close = best < 4;
      if (Math.abs(da) < 0.15 && now >= ai.reactAt) g.fire(b, seen, D.err * (b.moving ? 2.2 : 1) * (1 + best / 20));
      if (close || best < 9) { ai.strafe = ai.strafe && now < ai.strafeUntil ? ai.strafe : (Math.random() < 0.5 ? -1 : 1); if (!ai.strafeUntil || now > ai.strafeUntil) ai.strafeUntil = now + 0.4 + Math.random() * 0.6; g.move(b, Math.cos(b.a + Math.PI / 2) * ai.strafe * 0.7, Math.sin(b.a + Math.PI / 2) * ai.strafe * 0.7, dt); }
      else b.moving = false; // (far off: stands to shoot straight)
      if (b.gear.he && best > 4 && best < 14 && Math.random() < dt * 0.15) g.throw(b, 'he', seen);
      if (b.gear.flash && best > 5 && best < 12 && Math.random() < dt * 0.1) g.throw(b, 'flash', seen);
      return;
    }
    // where to go
    let goal = null; const keg = g.keg;
    if (b.team === 'att') {
      if (keg.planted) goal = ai.guard || (ai.guard = [keg.x + (Math.random() - 0.5) * 4, keg.y + (Math.random() - 0.5) * 4]);
      if (goal && g.wall(Math.floor(goal[0]), Math.floor(goal[1]))) goal = ai.guard = [keg.x, keg.y]; // (not inside a wall)
      else if (keg.carrier === b) {
        const site = g.sites[ai.site ?? (ai.site = g.attSite)]; goal = viaFirst(b, g, site.c);
        if (g.onSite(b) !== null) { g.plant(b, dt); return; }
      } else if (keg.dropped) goal = [keg.x, keg.y];
      else { const site = g.sites[g.attSite]; goal = ai.wait && now < ai.wait ? null : viaFirst(b, g, site.c); if (!ai.smoked && b.gear.smoke && Math.hypot(site.c[0] - b.x, site.c[1] - b.y) < 9) { ai.smoked = true; g.throw(b, 'smoke', { x: site.c[0], y: site.c[1] }); } }
    } else {
      if (keg.planted) { goal = [keg.x, keg.y]; if (Math.hypot(keg.x - b.x, keg.y - b.y) < 0.9) { g.defuse(b, dt); return; } }
      else goal = ai.post || (ai.post = g.posts.def[(b.idx * 3) % g.posts.def.length]);
    }
    if (ai.lastSeen && now - ai.lastSeen.t < 6 && !keg.planted && Math.hypot(ai.lastSeen.x - b.x, ai.lastSeen.y - b.y) < 12) goal = [ai.lastSeen.x, ai.lastSeen.y]; // (where it saw or heard one, near)
    if (!goal) { b.moving = false; return; }
    if (!ai.path || now > ai.pathAt || ai.goalKey !== `${Math.floor(goal[0])},${Math.floor(goal[1])}`) {
      ai.path = path(g, [Math.floor(b.x), Math.floor(b.y)], [Math.floor(goal[0]), Math.floor(goal[1])]); ai.pathAt = now + 1 + Math.random(); ai.goalKey = `${Math.floor(goal[0])},${Math.floor(goal[1])}`;
    }
    const wp = ai.path && ai.path[0];
    if (!wp) { b.moving = false; if (ai.lastSeen && Math.hypot(ai.lastSeen.x - b.x, ai.lastSeen.y - b.y) < 1.2) ai.lastSeen = null; b.a += dt * 0.6; return; }
    if (Math.hypot(wp[0] - b.x, wp[1] - b.y) < 0.35) { ai.path.shift(); return; }
    const want = Math.atan2(wp[1] - b.y, wp[0] - b.x); b.a += wrap(want - b.a) * Math.min(1, dt * 6);
    g.move(b, Math.cos(want), Math.sin(want), dt);
  }
  window.SIEGE_BOTS = { think, buy, path, DIFF };
}());
