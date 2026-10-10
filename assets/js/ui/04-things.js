// deno-lint-ignore-file no-unused-vars
// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

/* ---- the hours theme's rooms: what a section holds, as things in the room ----------------
   Each piece of a section (a lab, a project, a book, a letter, a degree...) becomes an object
   the room draws (hours.js, from this list); here, a real button lies over it, and opens a card
   beside it with the piece itself. The section stays in the page for readers without the
   picture; the card only shows it where the object is. */

/** The castle's rooms show their content as things only on wide screens (the plate fills the page). */
const wideRooms = () => WIDE.matches;

// ?fill=N (a check): each room that grows with the years given N of its things, copies of its own (or
// made up where it has none yet), to see it hold them: the room shows what fits and archives the rest
const FILL = Math.min(200, Number(new URLSearchParams(location.search).get('fill')) || 0);
const GROWS = { experience: 'scroll', work: 'model', publications: 'book', talks: 'banner', teaching: 'course', news: 'letter' };
function roomItems(id) {
  const items = roomItemsOf(id); const kind = GROWS[id];
  if (!FILL || !kind) return items;
  const mine = items.filter((t) => (t.kind || 'book') === kind); const rest = items.filter((t) => (t.kind || 'book') !== kind);
  const seed = mine.length ? mine : [{ kind, label: `A ${kind}`, html: `<h3>A ${kind}</h3><p>Made up by ?fill.</p>` }];
  return [...Array.from({ length: FILL }, (_, k) => ({ ...seed[k % seed.length], label: `${seed[k % seed.length].label} (${k + 1})` })), ...rest];
}
function roomItemsOf(id) {
  const sec = isIndex && document.getElementById(id);
  if (!sec) return [];
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const of = (sel, kind, f) => [...sec.querySelectorAll(sel)].map((el) => ({ kind, ...f(el) }));
  switch (id) {
    case 'about': {
      const sheet = sec.querySelector('.sheet').cloneNode(true);
      [...sheet.children].forEach((d) => { if (d.querySelector('[data-arms]')) d.remove(); });
      return [{ kind: 'desk-book', label: T.notebook, html: `<h3>${T.notebook}</h3>${sec.querySelector('.lede').outerHTML}${sheet.outerHTML}` },
        ...of('.sheet span[data-arms]', 'charter', (el) => ({ arms: el.dataset.arms, label: text(el), html: `<h3>${esc(text(el))}</h3><p>${T.charter}</p>` })),
        ...(() => { // the book of courses, open on its lectern by the desk
          const led = document.getElementById('coursework');
          if (!led) return [];
          const body = [...led.querySelectorAll('.ledger-year')].map((y) => y.outerHTML).join('');
          return [{ kind: 'ledger', label: T.ledger, html: `<h3>${T.ledger}</h3><p class="dim">${esc(text(led.querySelector('summary .meta')))}</p>${body}` }];
        })()];
    }
    case 'experience': return of('.entry', 'scroll', (el) => ({ arms: el.dataset.arms, label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'work': return of('article.project', 'model', (el) => ({ model: el.id, label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'publications': { // the works face out on the ledge; then the shelves, and the volumes on them
      const lib = DATA.library || {};
      const vols = (lib.volumes || []).map((b) => ({ ...b, url: /^https?:\/\//.test(b.url || '') ? b.url : '' })); // web links only
      const volume = (b) => `<b>${b.url ? `<a href="${esc(b.url)}" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</b>`
        + `, ${esc(b.author)}${b.year ? ` (${esc(b.year)})` : ''}${b.note ? `<br><span class="dim">${esc(b.note)}</span>` : ''}`;
      return [
        ...of('.pub', 'book', (el) => { // its title becomes the book's heading
          const c = el.cloneNode(true); const t = c.querySelector('.pub-title');
          if (t) t.outerHTML = `<h3>${t.innerHTML}</h3>`;
          const fig = /nuclear-emulators/.test(el.innerHTML) ? '<figure class="pub-fig"><canvas width="260" height="80"></canvas><figcaption>Two nuclei collide: Coulomb repulsion, the nuclear pull once they touch, friction. Head on they fuse and spin as one; grazing, they swerve or graze and part (computed as you watch).</figcaption></figure>' : '';
          return { label: text(el.querySelector('.pub-title')), html: c.innerHTML + fig };
        }),
        ...(lib.shelves || []).map(([sid, name], k) => {
          const here = vols.filter((b) => b.shelf === sid);
          return { kind: 'shelf', shelf: sid, label: T.shelf(name), html: `<h3>${esc(T.shelf(name))}</h3>`
            + (here.length ? `<ul>${here.map((b) => `<li>${volume(b)}</li>`).join('')}</ul>` : `<p>${T.shelfEmpty[k % T.shelfEmpty.length]}</p>`) };
        }),
        ...vols.map((b) => ({ kind: 'volume', shelf: b.shelf, label: b.title, html: `<h3>${esc(b.title)}</h3>`
          + `<p>${esc(b.author)}${b.year ? `, ${esc(b.year)}` : ''}</p>${b.note ? `<p class="dim">${esc(b.note)}</p>` : ''}`
          + (b.url ? `<p><a href="${esc(b.url)}" rel="noopener">${T.source}</a></p>` : '') })),
      ];
    }
    case 'news': return of('.news li', 'letter', (el) => { // the date heads the letter, the rest is its text
      const t = el.querySelector('time'); const rest = el.cloneNode(true); rest.querySelector('time').remove();
      return { label: text(t), html: `<h3>${t.outerHTML}</h3><p>${rest.innerHTML.trim()}</p>` };
    });
    case 'talks': return of('.entry', 'banner', (el) => ({ label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'teaching': return of('.entry', 'course', (el) => ({ label: text(el.querySelector('h3')), html: el.innerHTML }));
    case 'maproom': // a pennant for each place of the path: what is told of it, and what was done there
      return (DATA.heraldry.tapestry || []).filter(([aid]) => REALM_NAMES[aid]).map(([aid, name, desc]) => {
        const done = [...document.querySelectorAll(`#experience .entry[data-arms="${aid}"]`)].map((el) => `<li><a href="#at-${aid}">${esc(text(el.querySelector('h3')))}</a>: ${esc(text(el.querySelector('.role-line')))}</li>`);
        return { kind: 'place', arms: aid, label: name, html: `<h3>${esc(name)}</h3><p>${esc(desc)}</p>${done.length ? `<ul>${done.join('')}</ul>` : ''}<p class="dim">${esc(REALM_NAMES[aid])}</p>` };
      });
    case 'cellar': // a rack for each year of study, and the steps on down (the descent)
      return [...vintages().map((v) => ({ kind: 'vintage', label: `${T.vintage} ${v.year}`, html: `<p class="dim">${esc(v.note)}</p>${v.html}` })),
        { kind: 'stair', label: T.stairDown, act: descend }];
    case 'contact': {
      const things = [...sec.querySelectorAll('.kv div')].map((d) => {
        const k = text(d.querySelector('dt'));
        return { kind: { email: 'letterbox', code: 'lodestone', based: 'map' }[k] || 'note', label: k, html: `<h3>${esc(k)}</h3><p>${d.querySelector('dd').innerHTML}</p>` };
      });
      const col = sec.querySelector('.colophon');
      const mail = sec.querySelector('a[href^="mailto:"]');
      const sign = mail ? `<p><a href="${mail.getAttribute('href')}?subject=${encodeURIComponent("The castle's guestbook")}&amp;body=${encodeURIComponent('Name:\nFrom:\n\nA word for the register:\n')}">[sign the guestbook]</a> <span class="dim">(it opens a letter; I copy the kind ones in by hand)</span></p>` : '';
      const book = `<form class="sign-form"><label>${T.signName} <input name="who" maxlength="40" autocomplete="nickname" required></label> <button type="submit">[${T.signIt}]</button></form><div class="signed">${signedHtml()}</div>`;
      if (col) things.push({ kind: 'register', label: T.register, html: `<h3>${T.register}</h3>${col.outerHTML}${book}${sign}${creditsHtml()}` });
      return things;
    }
    default: return [];
  }
}

/** Whose works the castle borrows (paintings, films, scores, texts...), as hours.js's index lists them. */
function creditsHtml() {
  const c = window.Hours && window.Hours.credits ? window.Hours.credits() : [];
  const seen = new Set(); const rows = c.filter((x) => { const k = `${x.title}|${x.author}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!rows.length) return '';
  const link = (x) => (/^https?:\/\//.test(x.source || '') ? `<a href="${esc(x.source)}" rel="noopener">${esc(x.title)}</a>` : esc(x.title));
  return `<h4>${T.borrowed}</h4><ul class="credits">${rows.map((x) => `<li>${link(x)}${x.author ? `, ${esc(x.author)}` : ''}${x.year ? ` (${esc(x.year)})` : ''}${x.licence ? ` <span class="dim">${esc(x.licence)}</span>` : ''}</li>`).join('')}</ul>`;
}
/** The register's local page: names signed in this browser (never sent anywhere). */
const signatures = () => { try { return JSON.parse(store('signatures') || '[]'); } catch { return []; } };
function signedHtml() {
  const s = signatures();
  return s.length ? `<p class="dim">${T.signedHere}</p><ul>${s.map(([n, t]) => `<li>${esc(n)}, ${new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</li>`).join('')}</ul>` : `<p class="dim">${T.signNone}</p>`;
}
document.addEventListener('submit', (e) => {
  const f = e.target.closest('.sign-form');
  if (!f) return;
  e.preventDefault();
  const who = f.who.value.trim().slice(0, 40);
  if (!who) return;
  const s = signatures(); s.push([who, Date.now()]); store('signatures', JSON.stringify(s.slice(-30)));
  f.reset(); f.nextElementSibling.innerHTML = signedHtml(); say(T.signDone(who));
});

const spots = document.createElement('div');
spots.className = 'spots';
document.body.append(spots);
const card = document.createElement('div');
card.className = 'card';
card.hidden = true;
card.setAttribute('role', 'dialog');
card.innerHTML = `<button type="button" class="card-close" aria-label="${T.close}">&times;</button><button type="button" class="card-pin"></button><div class="card-body"></div>`;
document.body.append(card);
let spotItems = []; let cardFrom = null;

/* Cards pinned up: a card's seal pins it to the wall of its room as a small sheet (hours.js draws it;
   its card again on a click), or takes it down. Kept on this device, by room: [{ label, html }]. */
const pins = () => { try { return JSON.parse(store('pins') || '{}'); } catch { return {}; } };
const pinned = (id, label) => (pins()[id] || []).some((p) => p.label === label);
function pinToggle(id, it) {
  const all = pins(); const here0 = all[id] || []; const label = it.kind === 'pinned' ? it.label.replace(/^Pinned: /, '') : it.label;
  const on = !here0.some((p) => p.label === label);
  all[id] = on ? [...here0, { label, html: it.html }].slice(-6) : here0.filter((p) => p.label !== label); // (six at most a room)
  store('pins', JSON.stringify(all)); cue(on ? 'seal' : 'page');
  if (window.Hours && window.Hours.refresh) window.Hours.refresh();
  if (FRAMED) parent.postMessage({ engine: 'pins' }, location.origin); // (the castle behind the glass draws it too)
  return on;
}

/** What is going on, gathered from the page: the studies under way, the last news, the projects. */
/** Today's fare at the tavern (hours.js: from Taillevent's Viandier), as HTML; '' before it has come. */
function fareHtml(full) {
  const f = window.Hours && window.Hours.fare ? window.Hours.fare() : null;
  if (!f || !f.dishes.length) return '';
  const day = `${f.lean ? 'a lean day' : 'a fat day'} (${f.why}): ${f.lean ? 'fish, no meat' : 'meat'}`;
  if (!full) return `<p><b>Today's fare</b>, ${day}: ${f.dishes.map((d) => esc(d.name)).join('; ')}.</p>`;
  return `<h4>Today's fare</h4><p class="dim">From the <i>Viandier</i> of Taillevent, cook to Charles V; ${day}. The book's own words under each dish.</p><ul class="fare">`
    + f.dishes.map((d) => `<li><b>${esc(d.name)}</b>: ${esc(d.what.join(', '))}.<details><summary>Taillevent</summary><i lang="frm">${esc(d.text)}</i></details></li>`).join('') + '</ul>';
}
function nowHtml() {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const studying = [...document.querySelectorAll('#about .sheet dd')][0];
  const news = document.querySelector('#news .news li');
  const projects = [...document.querySelectorAll('#work article.project h3')].map(txt);
  return `<h3>On the tavern's slate</h3><p class="dim">What is going on, chalked up by the landlord.</p>`
    + (studying ? `<p><b>Studying:</b> ${txt(studying)}</p>` : '') + (news ? `<p><b>Latest news:</b> ${txt(news)}</p>` : '')
    + (projects.length ? `<p><b>At the workbench:</b> ${projects.join('; ')}.</p>` : '') + fareHtml(false);
}

/* The report's figure, alive: a collision between two nuclei (an illustration of the physics the
   emulators deal with, not one of the report's results). */
function collisionFig(canvas) {
  /* Two nuclei, 12 and 16 nucleons, thrown at each other in their centre-of-mass frame at a random
     impact parameter: the Coulomb push, a Woods-Saxon pull and friction once their surfaces touch.
     Head on, they are caught in the pocket and spin as one (fusion); grazing, they touch, turn a
     little and fly apart (deep-inelastic); far off, they only swerve (Rutherford). Units: px, px/s. */
  const pack = (n, turn) => { // nucleons on a close-packed (hexagonal) grid, the n nearest the middle; protons filled, neutrons hollow
    const pts = [];
    for (let q = -4; q <= 4; q += 1) for (let k = -4; k <= 4; k += 1) pts.push({ x: 4.2 * (q + k / 2), y: 4.2 * k * 0.866 });
    pts.sort((p1, p2) => Math.hypot(p1.x, p1.y) - Math.hypot(p2.x, p2.y));
    const nuc = pts.slice(0, n).map((p, k) => ({ x: p.x * Math.cos(turn) - p.y * Math.sin(turn), y: p.x * Math.sin(turn) + p.y * Math.cos(turn), p: (k * 7) % 3 !== 1 && k % 2 === 0 }));
    return { R: Math.max(...nuc.map((p) => Math.hypot(p.x, p.y))) + 2, n, nuc };
  };
  const A = pack(12, 0.3); const B = pack(16, 1.1); const Rc = A.R + B.R; const m1 = A.n; const m2 = B.n; const mu = (m1 * m2) / (m1 + m2);
  const K = 9000; const V0 = 2600; const a = 2.2; const g0 = 9; // (Coulomb, nuclear depth, diffuseness, friction)
  const ws = (r) => 1 / (1 + Math.exp((r - Rc) / a));
  let r; let v; let th; let t0; // relative position and velocity, the pair's spin angle, the run's start
  const reset = () => { const b = Math.random() * Rc * 1.4; r = [-150, b]; v = [95 + Math.random() * 25, 0]; th = 0; t0 = 0; };
  reset();
  const step = (dt) => {
    const d = Math.hypot(r[0], r[1]); const u = [r[0] / d, r[1] / d];
    const fr = K / (d * d) - (V0 / a) * ws(d) * (1 - ws(d)); // (minus the potential's slope: Coulomb out, the nuclear pull in)
    const g = g0 * ws(d) * mu; const vr = v[0] * u[0] + v[1] * u[1]; const vt = [v[0] - vr * u[0], v[1] - vr * u[1]]; // (friction while they overlap: hard along the line between them, light across it, so a caught pair keeps turning)
    const f = [u[0] * (fr - g * vr) - 0.08 * g * vt[0], u[1] * (fr - g * vr) - 0.08 * g * vt[1]];
    v = [v[0] + (f[0] / mu) * dt, v[1] + (f[1] / mu) * dt]; r = [r[0] + v[0] * dt, r[1] + v[1] * dt];
    th = Math.atan2(r[1], r[0]);
  };
  let last = 0;
  const draw = (now) => {
    if (!canvas.isConnected) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; t0 += dt;
    for (let k = 0; k < 8; k += 1) step(dt / 8);
    if (Math.hypot(r[0], r[1]) > 170 || t0 > 7) reset();
    const g = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height; const ink = getComputedStyle(canvas).color;
    g.clearRect(0, 0, w, h); g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1;
    const cx = w / 2; const cy = h / 2;
    const body = (nu, x, y, ang) => nu.nuc.forEach((p) => {
      const px = x + p.x * Math.cos(ang) - p.y * Math.sin(ang); const py = y + p.x * Math.sin(ang) + p.y * Math.cos(ang);
      g.beginPath(); g.arc(px, py, 1.8, 0, 6.283); if (p.p) g.fill(); else g.stroke();
    });
    const M = m1 + m2; const spin = ws(Math.hypot(r[0], r[1])) > 0.5 ? th : 0; // (stuck together: they turn with the line between them)
    body(A, cx - (r[0] * m2) / M, cy - (r[1] * m2) / M, spin); body(B, cx + (r[0] * m1) / M, cy + (r[1] * m1) / M, spin);
    if (!reduceMotion) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

/** hours.js hands over where the objects are (viewport px) and what they are. */
function setSpots(rects, items) {
  spotItems = items;
  closeCard(false);
  // the tower: the buttons ride in the picture's frame as it scrolls (viewport px made the picture's own)
  const inTower = climbing(); const pr = plateEl.getBoundingClientRect(); const dx = inTower ? pr.left : 0; const dy = inTower ? pr.top : 0;
  const home0 = inTower ? plateEl : document.body; if (spots.parentElement !== home0) home0.append(spots);
  spots.replaceChildren(...rects.flatMap((r, i) => { // (no rect: the thing found no room in the picture)
    if (!r) return [];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    Object.assign(b.style, { left: `${r.l - dx}px`, top: `${r.t - dy}px`, width: `${r.w}px`, height: `${r.h}px` });
    b.setAttribute('aria-label', items[i].label);
    b.dataset.label = items[i].label;
    const lit = (on) => window.Hours && window.Hours.highlight(on ? i : -1);
    b.addEventListener('pointerenter', () => lit(true));
    b.addEventListener('pointerleave', () => lit(document.activeElement === b));
    b.addEventListener('focus', () => lit(true));
    b.addEventListener('blur', () => lit(false));
    if (items[i].kind === 'ladder') { // the library's ladder slides along its rail: drag it, or the arrow keys
      let x0 = null; let moved = false;
      const to = (r2) => { if (r2) b.style.left = `${r2.l - dx}px`; };
      b.addEventListener('pointerdown', (e) => { x0 = e.clientX; moved = false; try { b.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ } });
      b.addEventListener('pointermove', (e) => { if (x0 === null || (!moved && Math.abs(e.clientX - x0) < 4)) return; moved = true; to(window.Hours.ladderTo(e.clientX)); });
      b.addEventListener('pointerup', () => { x0 = null; });
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); e.stopPropagation(); to(window.Hours.ladderBy(e.key === 'ArrowLeft' ? -1 : 1));
      });
      b.addEventListener('click', (e) => { if (moved) { e.stopImmediatePropagation(); moved = false; } }); // (a drag is not a click)
    }
    if (items[i].kind === 'lectern' || items[i].kind === 'winch') { // the lectern turns, the winch winds: a drag (or the arrow keys); a click still opens or turns all the way
      let x0 = null; let y0 = 0; let moved = false; const lect = items[i].kind === 'lectern';
      b.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; moved = false; try { b.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ } });
      b.addEventListener('pointermove', (e) => {
        if (x0 === null) return; const dx = e.clientX - x0; const dy = e.clientY - y0;
        if (lect && Math.abs(dx) > 30) { moved = true; x0 = e.clientX; window.Hours.lectern(dx < 0 ? 1 : -1); }
        else if (!lect && Math.abs(dy) > 3) { moved = true; y0 = e.clientY; window.Hours.winchBy(dy / 4); }
      });
      b.addEventListener('pointerup', () => { x0 = null; });
      b.addEventListener('keydown', (e) => {
        if (lect && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); e.stopPropagation(); window.Hours.lectern(e.key === 'ArrowRight' ? 1 : -1); }
        if (!lect && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); window.Hours.winchBy(e.key === 'ArrowUp' ? 6 : -6); }
      });
      b.addEventListener('click', (e) => { if (moved) { e.stopImmediatePropagation(); moved = false; } }, true); // (a drag is not a click)
    }
    b.dataset.kind = items[i].kind; b.dataset.i = String(i);
    const html = (Object.getOwnPropertyDescriptor(items[i], 'html') || {}).value; // (not a live card's getter: it runs on opening)
    if (/real-fig|astrolabe/.test(html || '')) b.dataset.detail = ''; // (a picture inside: the magnifier)
    b.addEventListener('click', () => (items[i].kind === 'engine' ? openEngine() : openCard(i, b)));
    return [b];
  }));
}
