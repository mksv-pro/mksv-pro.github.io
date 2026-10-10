/* Siege's bots, after the tactical shooters' own: each side has a plan for the round and each man a task
   in it; each sees (its field of view, no walls, no smoke), hears, shares what it saw with its side, and
   fights as a player would: it reacts after a human delay, brings its sights onto the head, stops to
   shoot when far (moving spoils the aim), bursts or taps by the range, controls part of the recoil, and
   reloads when it is quiet.
   Attackers: a site (and a style: an execution with smokes and a flash, a split by two ways, a rush, a
   fake) chosen by money and by what failed; they gather at the way's last corner, throw, go in together,
   plant, then hold the site. Defenders: two at each site and one mid at their posts (looking where the
   enemy comes from), stacking a site that was hit twice; they rotate on news of several at a site,
   retake together once planted, and defuse when it is quiet or there is no time left to wait.
   Paths: a flow field from each goal over the cells (a step up of 0.26 at most, any drop), followed with
   a look ahead. The game gives each bot g.move (a wished way), g.fire, g.plant, g.defuse, g.throw, g.sees. */
(function () {
  const DIFF = { // reaction (s), aim error at first sight (deg), turn speed (rad/s), recoil controlled (0..1)
    easy: { react: 0.6, err: 7, turn: 5, ctrl: 0.35 }, normal: { react: 0.38, err: 4, turn: 8, ctrl: 0.6 }, hard: { react: 0.24, err: 2.2, turn: 12, ctrl: 0.82 },
  };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  /* ---- flow fields: for a goal cell, each cell's steps to it (Int16, -1 unreachable), kept two seconds ---- */
  const flows = new Map();
  function flow(g, gx, gy) {
    const key = `${gx},${gy}`; const f = flows.get(key); if (f && g.now - f.t < 2 && f.t <= g.now) return f.d;
    const W = g.w; const H = g.h; const d = new Int16Array(W * H).fill(-1); const q = [gy * W + gx]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]; const cx = c % W; const cy = (c / W) | 0;
      for (const [dx, dy] of N8) {
        const nx = cx + dx; const ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (d[n] >= 0) continue;
        if (!g.step(nx, ny, cx, cy)) continue; if (dx && dy && (!g.step(nx, ny, cx, ny) || !g.step(nx, ny, nx, cy))) continue; // (from n one can walk to c; no corner cut)
        d[n] = d[c] + 1; q.push(n);
      }
    }
    flows.set(key, { t: g.now, d }); if (flows.size > 80) flows.delete(flows.keys().next().value);
    return d;
  }
  /** Where to walk from b towards goal [x, y]: a point up to three cells on (straight to it if walkable), or null when there. */
  function steer(g, b, goal) {
    const gx = Math.floor(goal[0]); const gy = Math.floor(goal[1]); const cx = Math.floor(b.x); const cy = Math.floor(b.y);
    if (cx === gx && cy === gy) return Math.hypot(goal[0] - b.x, goal[1] - b.y) > 0.25 ? goal : null;
    const d = flow(g, gx, gy); const W = g.w;
    if (d[cy * W + cx] < 0) { for (const [dx, dy] of N8) { const n = (cy + dy) * W + cx + dx; if (d[n] >= 0) return [cx + dx + 0.5, cy + dy + 0.5]; } return goal; } // (off the graph, on a crate say)
    let tx = cx; let ty = cy;
    for (let k = 0; k < 3; k += 1) { let best = null; let bd = d[ty * W + tx];
      for (const [dx, dy] of N8) { const nx = tx + dx; const ny = ty + dy; const n = ny * W + nx; if (d[n] < 0 || d[n] >= bd || !g.step(tx, ty, nx, ny)) continue; if (dx && dy && (!g.step(tx, ty, nx, ty) || !g.step(tx, ty, tx, ny))) continue; bd = d[n]; best = [nx, ny]; }
      if (!best) break; if (k > 0 && !lineWalk(g, cx, cy, best[0], best[1])) break; tx = best[0]; ty = best[1]; if (tx === gx && ty === gy) break; }
    return tx === gx && ty === gy ? goal : [tx + 0.5, ty + 0.5];
  }
  function lineWalk(g, x0, y0, x1, y1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2; let px = x0; let py = y0; for (let k = 1; k <= n; k += 1) { const x = Math.round(x0 + ((x1 - x0) * k) / n); const y = Math.round(y0 + ((y1 - y0) * k) / n); if ((x !== px || y !== py) && !g.step(px, py, x, y)) return false; px = x; py = y; } return true; }

  /* ---- the sides' plans, made at each round's start ---- */
  function plans(g) {
    const M = g.map; const T = g.teams || (g.teams = { att: { history: [] }, def: { history: [] } });
    const atts = g.actors.filter((a) => a.team === 'att'); const defs = g.actors.filter((a) => a.team === 'def');
    const money = atts.reduce((s, a) => s + a.money, 0) / atts.length; const last = T.att.history.slice(-2);
    let site = Math.random() < 0.5 ? 'A' : 'B'; if (last.length === 2 && last[0].site === last[1].site && !last[1].won) site = last[1].site === 'A' ? 'B' : 'A'; // (two failures at one: the other)
    const style = g.round === 1 || money < 1600 ? (Math.random() < 0.6 ? 'rush' : 'split') : ['exec', 'exec', 'split', 'fake'][Math.floor(Math.random() * 4)];
    const lanes = M.LANES[site]; const other = site === 'A' ? 'B' : 'A';
    atts.forEach((a, k) => { const ai = a.ai; ai.task = 'go'; ai.site = site;
      ai.way = (style === 'split' ? lanes[k % lanes.length] : style === 'fake' && k < 2 ? M.LANES[other][0] : lanes[0]).map((p) => p.slice()); ai.wp = 0;
      ai.fake = style === 'fake' && k < 2; ai.wait = style !== 'rush'; });
    T.att.plan = { site, style, t0: g.now, executed: false, round: g.round };
    // the defenders: two, two and one, stacked towards a site hit twice
    const hist = T.def.history.slice(-2); const hot = hist.length === 2 && hist[0].site === hist[1].site ? hist[1].site : null;
    const slots = [...M.POSTS.A.slice(0, hot === 'A' ? 3 : 2).map((p) => ['A', p]), ...M.POSTS.B.slice(0, hot === 'B' ? 3 : 2).map((p) => ['B', p]), ['mid', M.POSTS.mid[0]]];
    defs.forEach((a, k) => { const [where, [at, look]] = slots[k % slots.length]; Object.assign(a.ai, { task: 'post', post: nearOpen(g, at[0], at[1]), look, where, rotator: where === 'mid' || k % 2 === 1 }); });
    T.def.plan = { hot, t0: g.now };
  }
  /** At the round's end: what the attackers tried, and whether it worked (the next plans learn from it). */
  function roundOver(g, winner) { const T = g.teams; if (!T || !T.att.plan) return; const rec = { site: T.att.plan.site, won: winner === 'att' }; T.att.history.push(rec); T.def.history.push(rec); }

  /* ---- what a bot buys: by its side's money (an eco, a force, a full buy), then armour and its share of the smokes and flashes ---- */
  function buy(b, g) {
    const A = g.arms.W; const G = g.arms.GEAR; const spend = (p) => { if (b.money < p) return false; b.money -= p; return true; };
    const mates = g.actors.filter((a) => a.team === b.team); const avg = mates.reduce((s, a) => s + a.money, 0) / mates.length; const pistolRound = g.round === 1 || g.round === 9;
    const full = avg >= 3800 || b.money >= 4700; const force = !full && avg >= 2200;
    if (!b.weapons[1] && !pistolRound) {
      const rifle = Math.random() < 0.35 ? 'ak47' : b.team === 'att' ? 'arquebus' : 'caliver';
      if (full && b.money >= 6000 && b.idx === 2 && Math.random() < 0.5 && spend(A.greatbow.price)) g.give(b, 'greatbow'); // (one marksman, sometimes)
      else if (full && spend(A[rifle].price)) g.give(b, rifle);
      else if ((force || full) && b.money >= 1400) { const w = Math.random() < 0.5 ? 'repeater' : 'blunderbuss'; if (spend(A[w].price)) g.give(b, w); }
    }
    if (b.weapons[2] === 'wheellock' && (pistolRound ? b.money >= 500 && Math.random() < 0.4 : b.money >= 700 && !b.weapons[1])) { if (spend(A.pepperbox.price)) g.give(b, 'pepperbox'); }
    if (b.armour < 50) { if ((full || force) && b.money >= G.helm.price + 300) { spend(G.helm.price); b.armour = 100; b.helm = true; } else if (b.money >= G.gambeson.price + (pistolRound ? 0 : 200)) { spend(G.gambeson.price); b.armour = 100; } }
    const nade = (k, id, p) => { if (!b.gear[k] && Math.random() < p && spend(G[id].price)) b.gear[k] = 1; };
    if (full || force) { nade('smoke', 'incense', b.idx < 3 ? 0.9 : 0.4); nade('flash', 'vial', 0.7); nade(b.team === 'att' ? 'he' : 'fire', b.team === 'att' ? 'firepot' : 'flask', 0.5); nade(b.team === 'att' ? 'fire' : 'he', b.team === 'att' ? 'flask' : 'firepot', 0.3); }
    if (b.team === 'def' && (full || force) && b.money >= 400 && Math.random() < 0.6) { spend(G.tools.price); b.tools = true; }
    b.slot = b.weapons[1] ? 1 : 2;
  }

  /* ---- each bot, each frame ---- */
  const say = (g, b, text) => { const k = `${b.team}:${text}`; g.chatSeen ||= {}; if (g.now - (g.chatSeen[k] || -99) < 8) return; g.chatSeen[k] = g.now; g.chat.push({ who: b.name, team: b.team, text, t: g.now }); if (g.chat.length > 8) g.chat.shift(); };
  function think(b, g, dt) {
    if (!b.alive) return; const D = DIFF[g.difficulty] || DIFF.normal; const ai = b.ai; const now = g.now; const M = g.map;
    if (!g.teams || !g.teams.att.plan || g.teams.att.plan.round !== g.round) plans(g);
    if (g.frozen) { lookAt(b, ai.look ? Math.atan2(ai.look[1] - b.y, ai.look[0] - b.x) : b.a, 0, D, dt); return; }
    const team = g.teams[b.team]; team.intel ||= []; const w = g.arms.W[b.weapons[b.slot] || 'knife'];
    if (now < b.blindUntil) { g.move(b, -Math.cos(b.a), -Math.sin(b.a)); b.crouch = false; return; } // (blinded: backs away, shoots nothing)
    const burn = g.fires.find((f) => f.flames.some((q) => Math.hypot(q[0] - b.x, q[1] - b.y) < 0.7)); if (burn) { g.move(b, b.x - burn.x, b.y - burn.y); return; } // (out of the fire)
    // what it sees: the nearest enemy in its field of view; told to its side
    let seen = null; let best = 1e9;
    g.actors.forEach((o) => { if (!o.alive || o.team === b.team) return; const d = Math.hypot(o.x - b.x, o.y - b.y); if (d > 40 || d >= best) return; const off = Math.abs(wrap(Math.atan2(o.y - b.y, o.x - b.x) - b.a));
      if ((off < 1.05 || d < 2) && g.sees(b, o)) { best = d; seen = o; } });
    if (seen) {
      if (ai.target !== seen) { // (he came where it was looking: an angle held, the sights already there; quicker and truer)
        const pre = Math.abs(wrap(Math.atan2(seen.y - b.y, seen.x - b.x) - b.a)) < 0.22; ai.target = seen;
        ai.reactAt = now + D.react * (0.8 + Math.random() * 0.5) * (ai.alert && now - ai.alert < 3 ? 0.75 : 1) * (pre ? 0.6 : 1); const e = (D.err * Math.PI / 180) * (1 + best / 12) * (pre ? 0.45 : 1); ai.aimOff = [(Math.random() - 0.5) * 2 * e, (Math.random() - 0.5) * e]; }
      ai.lastSeen = { x: seen.x, y: seen.y, t: now }; team.intel.push({ x: seen.x, y: seen.y, t: now }); if (team.intel.length > 30) team.intel.shift();
      if (!ai.called || now - ai.called > 6) { ai.called = now; const z = g.zoneAt(seen.x, seen.y); const n = g.actors.filter((o) => o.alive && o.team !== b.team && g.zoneAt(o.x, o.y) === z).length; if (z) say(g, b, `${n > 1 ? `${n} enemies` : 'Enemy'} at ${z}`); }
    } else ai.target = null;
    const heard = g.noises.filter((n) => n.team !== b.team && now - n.t < 1.2 && Math.hypot(n.x - b.x, n.y - b.y) < n.r).pop();
    if (!seen && heard) { ai.alert = now; ai.heard = { x: heard.x, y: heard.y, t: now }; }
    if (seen) { fight(b, g, seen, best, D, dt, w); return; }
    const am = b.ammo[b.weapons[b.slot]]; if (b.reloadUntil < now && w.mag && am && am.mag < w.mag * 0.35 && am.res > 0 && (!ai.lastSeen || now - ai.lastSeen.t > 2)) g.reload(b); // (reload when it is quiet)
    if (b.slot === 2 && b.weapons[1]) b.slot = 1; // (back to the rifle after a fight)
    // its task
    const keg = g.keg; let goal = null; let look = null; let walk = false;
    if (b.team === 'att') {
      const plan = g.teams.att.plan; const site = g.sites.find((s) => s.name === ai.site) || g.sites[0];
      if (keg.planted) { ai.guard ||= nearOpen(g, keg.x + (Math.random() - 0.5) * 6, keg.y + (Math.random() - 0.5) * 6); goal = ai.guard; look = keg.defuser ? [keg.x, keg.y] : towards(g, site.name, 8, b); walk = true; }
      else if (keg.dropped) goal = [keg.x, keg.y];
      else if (ai.wp < (ai.way || []).length && !(ai.fake && plan.executed)) { goal = ai.way[ai.wp]; if (dist(goal, [b.x, b.y]) < 1.3) { ai.wp += 1; if (ai.wp === ai.way.length) ai.staged = now; } }
      else {
        // staged at the way's last corner: wait a little for the others, throw, then go in
        const staged = g.actors.filter((a) => a.alive && a.team === 'att' && a.ai.staged).length; const alive = g.actors.filter((a) => a.alive && a.team === 'att').length;
        if (!plan.executed && ai.wait && !ai.fake && staged < Math.min(3, alive) && now - (ai.staged || now) < 7 && now - plan.t0 < 55) { look = site.c; b.crouch = true; }
        else {
          if (!plan.executed) { plan.executed = true; plan.execAt = now; say(g, b, `Going ${site.name}`); }
          const U = M.UTILITY[site.name]; ai.thrown ||= {}; b.crouch = false;
          if (b.gear.smoke && !ai.thrown.smoke && now - plan.execAt < 4) { ai.thrown.smoke = true; g.throw(b, 'smoke', pickPt(U.smoke, b.idx)); return; }
          if (b.gear.flash && !ai.thrown.flash && now - plan.execAt > 1 && now - plan.execAt < 5) { ai.thrown.flash = true; g.throw(b, 'flash', pickPt(U.flash, 0)); return; }
          if (b.gear.fire && !ai.thrown.fire && now - plan.execAt < 6 && Math.random() < 0.02) { ai.thrown.fire = true; g.throw(b, 'fire', pickPt(U.fire, 0)); return; }
          if (keg.carrier === b) { ai.plantAt ||= nearOpen(g, site.c[0] + (Math.random() - 0.5) * 3, site.c[1] + (Math.random() - 0.5) * 3); goal = ai.plantAt;
            if (g.onSite(b) !== null && (dist(goal, [b.x, b.y]) < 0.8 || !ai.lastSeen || now - ai.lastSeen.t > 3)) { g.plant(b, dt); return; } }
          else { ai.spot ||= nearOpen(g, site.c[0] + (Math.random() - 0.5) * 7, site.c[1] + (Math.random() - 0.5) * 7); goal = ai.spot; }
        }
      }
    } else if (keg.planted) {
      const site = g.sites[keg.site]; if (!ai.retakeSaid) { ai.retakeSaid = true; say(g, b, `Retake ${site.name}`); }
      const near = g.actors.filter((a) => a.alive && a.team === 'def' && Math.hypot(a.x - keg.x, a.y - keg.y) < 10).length; const alive = g.actors.filter((a) => a.alive && a.team === 'def').length;
      const quiet = !ai.lastSeen || now - ai.lastSeen.t > 2.5; const left = keg.until - now; const need = b.tools ? 5 : 10;
      if (Math.hypot(keg.x - b.x, keg.y - b.y) < 0.9 && (quiet || left < need + 1)) { g.defuse(b, dt); return; }
      if (near < Math.min(2, alive) && left > need + 8 && Math.hypot(keg.x - b.x, keg.y - b.y) > 10) goal = towards(g, site.name, 10, b); // (gather, then go together)
      else goal = [keg.x, keg.y];
      if (b.gear.smoke && !ai.retakeSmoke && Math.hypot(keg.x - b.x, keg.y - b.y) < 10) { ai.retakeSmoke = true; g.throw(b, 'smoke', { x: keg.x, y: keg.y }); return; }
    } else {
      // rotate on news of several at the other site
      const intel = team.intel.filter((i) => now - i.t < 5); const at = (s) => intel.filter((i) => g.zoneAt(i.x, i.y).startsWith(s)).length;
      const fallen = (s) => g.actors.some((a) => !a.alive && a.team === b.team && now - (a.diedAt || -99) < 6 && g.zoneAt(a.x, a.y).startsWith(s)); // (a man of ours just fell there)
      ['A', 'B'].forEach((s) => { if (ai.rotator && ai.where !== s && (at(s) >= 2 || fallen(s)) && ai.task !== 'rotate') { ai.task = 'rotate'; ai.to = s; say(g, b, `Rotating ${s}`); } });
      if (ai.task === 'rotate') { const P = M.POSTS[ai.to][b.idx % M.POSTS[ai.to].length]; goal = P[0]; look = P[1]; }
      else { goal = ai.post; look = ai.look; if (ai.post && dist(ai.post, [b.x, b.y]) < 0.6) { walk = true; b.crouch = ai.crouchHold ??= Math.random() < 0.35; } }
      if (ai.heard && now - ai.heard.t < 3 && Math.hypot(ai.heard.x - b.x, ai.heard.y - b.y) < 10) look = [ai.heard.x, ai.heard.y];
      if (ai.lastSeen && now - ai.lastSeen.t < 4) look = [ai.lastSeen.x, ai.lastSeen.y];
    }
    const way = goal ? steer(g, b, goal) : null;
    if (way) { const dx = way[0] - b.x; const dy = way[1] - b.y; g.move(b, dx, dy, walk ? 0.52 : 1); if (!look) look = [b.x + dx * 4, b.y + dy * 4];
      if (Math.hypot(b.vx, b.vy) < 0.3) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1.2) { g.jump(b); ai.stuck = 0; } } else ai.stuck = 0; }
    lookAt(b, look ? Math.atan2(look[1] - b.y, look[0] - b.x) : b.a, 0, D, dt);
  }
  /** A fight: bring the sights onto the head (the error settling), stop when far, then burst or tap; strafe when close. */
  function fight(b, g, o, d, D, dt, w) {
    const ai = b.ai; const now = g.now; const head = o.z + (o.crouch ? 0.52 : 0.76); const eye = b.z + (b.crouch ? 0.45 : 0.62);
    const settle = Math.min(1, Math.max(0, (now - ai.reactAt + D.react) / (D.react * 2.2))); const off = ai.aimOff || [0, 0];
    const yaw = Math.atan2(o.y - b.y, o.x - b.x) + off[0] * (1 - settle); const pitch = Math.atan2(head - eye - (d > 14 ? 0.14 : 0), d) + off[1] * (1 - settle); // (far: the chest)
    lookAt(b, yaw, pitch, D, dt);
    const am = b.ammo[b.weapons[b.slot]]; if (w.mag && am && am.mag === 0) { if (b.slot === 1 && b.weapons[2] && d < 9) b.slot = 2; else g.reload(b); }
    if (w.melee) { g.move(b, o.x - b.x, o.y - b.y); if (d < 1.1) g.fire(b, o); return; }
    const close = d < 5; const far = d > 9 && !w.pellets;
    if (close) { if (!ai.strafeUntil || now > ai.strafeUntil) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeUntil = now + 0.35 + Math.random() * 0.5; } g.move(b, -Math.sin(b.a) * ai.strafe, Math.cos(b.a) * ai.strafe); }
    else if (!far && Math.random() < 0.6 * dt) g.move(b, -Math.sin(b.a), Math.cos(b.a)); // (mid range: a step aside now and then; far: stands still and taps)
    const aimed = Math.abs(wrap(yaw - b.a)) < 0.05 + 0.4 / Math.max(2, d) && Math.abs(pitch - (b.aimPitch || 0)) < 0.08;
    if (now < ai.reactAt || !aimed || (ai.pauseUntil && now < ai.pauseUntil)) return;
    const shots = far ? (w.auto ? 3 : 1) : w.auto ? 6 + Math.floor(Math.random() * 6) : 1; const before = b.shotsAll || 0;
    g.fire(b, o); if ((b.shotsAll || 0) > before) { ai.burst = (ai.burst || 0) + 1; if (ai.burst >= shots) { ai.burst = 0; ai.pauseUntil = now + (far ? 0.3 + Math.random() * 0.35 : w.auto ? 0.12 : 0.2 + Math.random() * 0.2); } }
    if (g.keg.planted && b.team === 'att' && g.keg.defuser && b.gear.fire && Math.random() < dt * 0.6) g.throw(b, 'fire', { x: g.keg.x, y: g.keg.y });
    if (b.gear.he && d > 5 && d < 14 && Math.random() < dt * 0.12) g.throw(b, 'he', o);
  }
  /** Turn towards (yaw, pitch) at the difficulty's speed. */
  function lookAt(b, yaw, pitch, D, dt) {
    const da = wrap(yaw - b.a); b.a += Math.sign(da) * Math.min(Math.abs(da), D.turn * dt * (0.6 + Math.min(1, Math.abs(da)))); b.aimPitch = (b.aimPitch || 0) + (pitch - (b.aimPitch || 0)) * Math.min(1, dt * 10);
  }
  const pickPt = (list, k) => { const p = list[k % list.length]; return { x: p[0], y: p[1] }; };
  /** An open cell near (x, y) (no wall, crate or big prop): somewhere to stand. */
  function nearOpen(g, x, y) { let best = null; let bd = 1e9; for (let yy = Math.floor(y) - 4; yy <= Math.floor(y) + 4; yy += 1) for (let xx = Math.floor(x) - 4; xx <= Math.floor(x) + 4; xx += 1) { if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h || g.wall(xx, yy) || g.map.MAT[yy][xx] === 'k') continue; const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); if (d < bd) { bd = d; best = [xx + 0.5, yy + 0.5]; } } return best || [x, y]; }
  /** A point on a way into a site, k cells out from its centre (where to gather, where to watch). */
  function towards(g, name, k = 6, b = null) { const site = g.sites.find((s) => s.name === name); const lanes = g.map.LANES[name]; const lane = lanes[b ? b.idx % lanes.length : 0]; const p = lane[lane.length - 1]; const c = site.c; const d = Math.hypot(p[0] - c[0], p[1] - c[1]) || 1; return nearOpen(g, c[0] + ((p[0] - c[0]) / d) * Math.min(k, d), c[1] + ((p[1] - c[1]) / d) * Math.min(k, d)); }

  window.SIEGE_BOTS = { think, buy, roundOver, steer, DIFF };
}());
