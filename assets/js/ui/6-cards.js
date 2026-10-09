// (one global scope across assets/js/ui/*.js, loaded in order: check.py lints them joined)
'use strict';

/* ---- the cards as manuscript: a rubricated title between fleurons over a vine scroll, a
   pen-flourished initial (blue, a red tendril down the margin), a tailpiece to close; the books
   (the book of courses, the notebook, the works) open as a two-page spread, turned leaf by leaf */

const BOOKISH = new Set(['ledger', 'desk-book', 'book', 'volume']);
const ROMAN = (n) => { // folio numbers
  let out = '';
  for (const [v, r] of [[50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) while (n >= v) { out += r; n -= v; }
  return out;
};

/* each text its own ornaments, drawn from its name (the same text always looks the same) */
const ORN = { band: ['vine', 'interlace', 'lozenges', 'leaves', 'ribbon'], fleuron: ['quatrefoil', 'lily', 'rosette', 'trefoil'],
  tail: ['triangle', 'drop', 'ribbon'], droll: ['snail', 'bird', 'rabbit', 'fish', 'dragonet', 'cat'] };
const INKS = [['#2a4caa', 'r'], ['#a82c1c', 'b'], ['#8a621a', 'G']]; // the initial's ink, its flourish's
const ornUrl = (name) => `url('${new URL(`assets/img/orn/${name}.svg`, SITE).href}')`; // single quotes: it goes into style="" too
function hashOf(text) { let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; }
const pick = (list, h, salt) => list[hashOf(`${h}:${salt}`) % list.length]; // each kind drawn on its own
function drollery(h, side) { // a creature in the margin for about one text in two
  if ((h >>> 20) % 2) return '';
  return `<span class="droll at-${side}${(h >>> 23) % 2 ? ' flip' : ''}" aria-hidden="true" style="--droll:${ornUrl(`droll-${pick(ORN.droll, h, 9)}`)}"></span>`;
}

function illuminate(body, key) {
  const h = hashOf(key);
  card.style.setProperty('--orn-band', ornUrl(`band-${pick(ORN.band, h, 0)}`));
  card.style.setProperty('--orn-fleuron', ornUrl(`fleuron-${pick(ORN.fleuron, h, 3)}`));
  card.style.setProperty('--orn-tail', ornUrl(`tail-${pick(ORN.tail, h, 6)}`));
  const [ink, flourish] = pick(INKS, h, 12);
  card.style.setProperty('--ini', ink); card.style.setProperty('--orn-tendril', ornUrl(`tendril-${flourish}`));
  card.droll = drollery(h, (h >>> 16) % 2 ? 'left' : 'right');
  const title = body.querySelector('h3');
  if (title) {
    title.classList.add('card-title');
    (title.closest('.entry-head') || title).insertAdjacentHTML('afterend', '<div class="orn-band" aria-hidden="true"></div>');
  }
  const opening = [...body.querySelectorAll('p')].find((p) => (!p.className || p.classList.contains('lede')) && p.textContent.trim().length > 60);
  if (opening) opening.classList.add('opening');
}

/** The text cut into pages that fit: blocks are measured one by one in a page of the spread;
 *  a list may break between items, a heading (or a year's ornament) keeps with what follows.
 *  Returns the pages' HTML. */
function paginate(src, probe) {
  const seq = []; // blocks: { el, list (its ul, for an item), keep }
  const walk = (el) => [...el.children].forEach((n) => {
    if (n.matches('.ledger-year')) { // between two years, a fleuron on a rule (each its own); it keeps with the year
      if (n.previousElementSibling && n.previousElementSibling.matches('.ledger-year')) {
        const orn = document.createElement('div'); orn.className = 'year-orn'; orn.setAttribute('aria-hidden', 'true');
        orn.style.setProperty('--year-fleuron', ornUrl(`fleuron-${ORN.fleuron[seq.length % ORN.fleuron.length]}`));
        seq.push({ el: orn, keep: true });
      }
      walk(n);
    } else if (n.matches('ul, ol, .sheet, .kv')) [...n.children].forEach((li) => seq.push({ el: li, list: n })); // (a sheet breaks between its rows)
    else seq.push({ el: n, keep: n.matches('h3, .ledger-prog, .entry-head, .orn-band, .card-title') });
  });
  walk(src);
  const H = probe.clientHeight; const pages = []; let page; let ul = null; let listOf = null;
  const fresh = () => { page = document.createElement('div'); probe.replaceChildren(page); pages.push(page); ul = null; listOf = null; };
  const fits = (spare = 0) => page.offsetHeight <= H - spare - 2; // the content's height (scrollHeight never drops below H)
  const place = (a) => {
    if (a.list) {
      if (!ul || listOf !== a.list) { ul = a.list.cloneNode(false); listOf = a.list; page.append(ul); }
      return ul.appendChild(a.el.cloneNode(true));
    }
    ul = null; listOf = null;
    return page.appendChild(a.el.cloneNode(true));
  };
  const unplace = (node) => { const parent = node.parentElement; node.remove(); if (parent !== page && !parent.children.length) parent.remove(); };
  fresh();
  seq.forEach((a) => {
    let node = place(a);
    // a heading needs room for a few lines after it, or it goes over to the next page
    if (!fits(a.keep ? 70 : 0) && page.childElementCount + (ul ? ul.childElementCount : 0) > 1) { unplace(node); fresh(); node = place(a); }
  });
  probe.replaceChildren();
  return pages.map((pg) => pg.outerHTML); // with the wrapper they were measured in
}

function bind(body) { // the book's spread: two pages side by side, filled from paginate()
  const src = document.createElement('div');
  src.innerHTML = body.innerHTML;
  card.bookSrc = body.innerHTML;
  card.classList.remove('one-leaf'); // measured at the full page height
  body.innerHTML = `<div class="spread"><div class="page"></div><div class="page"></div></div>
<nav class="pager" aria-label="${T.pages}"><button type="button" data-turn="-1" aria-label="${T.prevPage}">‹</button><span class="folio"></span><button type="button" data-turn="1" aria-label="${T.nextPage}">›</button></nav>`;
  const probe = body.querySelector('.page');
  const whole = document.createElement('div'); whole.innerHTML = src.innerHTML; probe.append(whole);
  const short = whole.offsetHeight <= probe.clientHeight * 1.5; // a short text: one leaf, read through, rather than a spread half empty
  probe.replaceChildren();
  card.bookPages = short ? [whole.outerHTML] : paginate(src, probe);
  card.bookAt = 0;
  card.classList.toggle('one-leaf', card.bookPages.length === 1);
}
function turn(dir) {
  const pgs = card.bookPages;
  if (!pgs || !card.classList.contains('as-book')) return;
  const n = Math.ceil(pgs.length / 2);
  const was = card.bookAt;
  card.bookAt = Math.max(0, Math.min(n - 1, card.bookAt + dir));
  if (dir && card.bookAt !== was) cue('page');
  if (dir && card.bookAt !== was && !reduceMotion) { // a leaf turning over the gutter, in a few steps
    const leaf = document.createElement('div');
    leaf.className = `leaf-turn ${dir > 0 ? 'to-left' : 'to-right'}`;
    card.querySelector('.spread').append(leaf);
    leaf.addEventListener('animationend', () => leaf.remove(), { once: true });
  }
  const [left, right] = card.querySelectorAll('.page');
  left.innerHTML = pgs[card.bookAt * 2]; right.innerHTML = pgs[card.bookAt * 2 + 1] || '';
  [left, right].forEach((pg, k) => { // a drollery at the foot of some pages, outer margin
    const n = card.bookAt * 2 + k;
    if (pg.innerHTML && pg.firstElementChild.offsetHeight < pg.clientHeight - 30) pg.insertAdjacentHTML('beforeend', drollery(hashOf(`${card.getAttribute('aria-label')}${n}`), k ? 'right' : 'left'));
  });
  card.querySelector('.folio').textContent = `${ROMAN(card.bookAt * 2 + 1)} · ${ROMAN(card.bookAt * 2 + 2)}  (${card.bookAt + 1}/${n})`;
  card.querySelector('[data-turn="-1"]').disabled = card.bookAt === 0;
  card.querySelector('[data-turn="1"]').disabled = card.bookAt === n - 1;
}
card.addEventListener('click', (e) => { const b = e.target.closest('[data-turn]'); if (b) turn(Number(b.dataset.turn)); });
card.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || (e.target instanceof Element && e.target.closest('input, textarea'))) return;
  e.preventDefault(); const dir = e.key === 'ArrowLeft' ? -1 : 1;
  const at = card.bookAt; if (card.querySelector('.spread')) turn(dir);
  if (!card.querySelector('.spread') || card.bookAt === at) nextOfKind(dir); // (past a book's last leaf: the next book)
});
/** The next thing of the open card's kind in the room (dir 1) or the one before (-1), left to right: its card. */
function nextOfKind(dir) {
  const bs = [...spots.querySelectorAll('.spot')].filter((b) => b.dataset.kind === card.dataset.kind)
    .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const i = bs.indexOf(cardFrom); if (i < 0 || bs.length < 2) return;
  const b = bs[(i + dir + bs.length) % bs.length];
  if (window.Hours) window.Hours.highlight(Number(b.dataset.i));
  openCard(Number(b.dataset.i), b);
}

function openCard(i, from) {
  const it = spotItems[i];
  if (!it) return; // a button of the room just left
  if (it.go) { goTo(it.go); return; } // a door: through it
  if (it.act) { it.act(); return; } // the cellar's steps: down
  card.getAnimations().forEach((a) => a.cancel()); card.closing = false; // (one closing: stopped, this one opens)
  const body = card.querySelector('.card-body');
  body.innerHTML = it.html;
  illuminate(body, it.label);
  const book = BOOKISH.has(it.kind) && root.getAttribute('data-theme') === 'hours';
  card.classList.toggle('as-book', book); card.classList.remove('one-leaf');
  card.dataset.kind = it.kind;
  card.setAttribute('aria-label', it.label);
  { const pb = card.querySelector('.card-pin'); const id = root.dataset.room; const can = id && WORLD[id] && it.html && !['door', 'archive'].includes(it.kind);
    pb.hidden = !can; if (can) { const on = it.kind === 'pinned' || pinned(id, it.label); pb.textContent = on ? T.unpin : T.pin; pb.onclick = () => { pinToggle(id, it); closeCard(false); }; } }
  card.hidden = false;
  if (!book && card.droll) body.insertAdjacentHTML('beforeend', card.droll);
  // what each kind of thing is made of: a letter is sealed, a charter has its seal hanging on a
  // cord, a scroll keeps its rolled ends (decorations outside .card-body are cleared each time)
  card.querySelectorAll(':scope > .deco').forEach((d) => d.remove());
  const deco = { letter: ['wax'], charter: ['hang-seal'], hanging: ['hang-seal'], scroll: ['roll at-top', 'roll at-bottom'] }[it.kind] || [];
  deco.forEach((c) => card.insertAdjacentHTML('beforeend', `<span class="deco ${c}" aria-hidden="true"></span>`));
  if (it.kind === 'letter' && !brokenSeals().includes(it.label) && root.getAttribute('data-theme') === 'hours') sealUp(it.label); // (a letter not yet read: its seal to break)
  cue(it.kind === 'letter' ? 'seal' : it.kind === 'letterbox' ? 'drop' : 'card'); // (the letterbox: a letter falling inside the door)
  const runFigs = () => card.querySelectorAll('.pub-fig canvas').forEach((cv) => { if (!cv.running) { cv.running = true; collisionFig(cv); } }); // (a property: the pages are clones)
  runFigs(); setTimeout(runFigs, 400); setTimeout(runFigs, 1500); // (and again once a book has been paginated)
  card.querySelectorAll('.real-fig').forEach(paintFig); // the real things' pictures (paintings, films...)
  card.querySelectorAll('canvas.astrolabe').forEach((cv) => { // the astrolabe, kept set while its card is open
    const tick = () => { if (card.hidden || !card.contains(cv) || !window.Hours || !window.Hours.astrolabe) return; cv.nextElementSibling.innerHTML = window.Hours.astrolabe(cv); setTimeout(tick, 1000); };
    tick();
  });
  if (book) { // pages are measured, so the card is shown first; again once its fonts have loaded
    bind(body); turn(0); turn(bookmarks()[root.dataset.room]?.[it.label] || 0); // (open where it was left: its bookmark)
    const src = card.bookSrc;
    document.fonts.ready.then(() => {
      if (card.hidden || card.bookSrc !== src) return;
      const at = card.bookAt; body.innerHTML = src; bind(body); card.bookAt = 0; turn(at);
    });
  }
  const r = from.getBoundingClientRect();
  const cw = card.offsetWidth; const ch = card.offsetHeight;
  const top0 = document.querySelector('.msgline').getBoundingClientRect().bottom + 12;
  const bot0 = document.querySelector('.status').getBoundingClientRect().top - 12;
  let left = r.right + 18; let side = 'left';
  if (left + cw > innerWidth - 12) { left = r.left - 18 - cw; side = 'right'; }
  left = Math.max(12, Math.min(innerWidth - cw - 12, left));
  const top = Math.max(top0, Math.min(bot0 - ch, r.top + r.height / 2 - ch / 2));
  Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  card.dataset.side = side;
  card.style.setProperty('--tail-y', `${Math.max(14, Math.min(ch - 14, r.top + r.height / 2 - top))}px`);
  cardFrom = from;
  store('lastCard', it.label);
  try { const seen = lookedAt(); const id = root.dataset.room; seen[id] = [...new Set([...(seen[id] || []), it.label])]; localStorage.setItem('looked-at', JSON.stringify(seen)); } catch { /* (no storage: he points at anything) */ }
  if (window.Hours && window.Hours.opened) window.Hours.opened(i); // (the room answers: the thing out of its place, eyes on it)
  unfold(from, true);
  card.querySelector('.card-close').focus();
}
/* A letter not yet read comes folded under its seal: drag the seal away (or press it: Enter, Space)
   and it breaks, its pieces fall, the letter opens; it stays open on later visits. */
function brokenSeals() { try { return JSON.parse(localStorage.getItem('broken-seals')) || []; } catch { return []; } }
function sealUp(label) {
  const cover = document.createElement('div'); cover.className = 'sealed';
  cover.innerHTML = `<p class="sealed-to">${esc(label)}</p><button type="button" class="seal-btn" aria-label="${T.breakSeal}"></button><p class="dim sealed-hint">${T.breakHint}</p>`;
  card.append(cover);
  const btn = cover.querySelector('.seal-btn'); let x0 = null; let y0 = 0;
  const brk = () => {
    if (cover.classList.contains('broken')) return; cover.classList.add('broken'); cue('seal');
    try { localStorage.setItem('broken-seals', JSON.stringify([...new Set([...brokenSeals(), label])])); } catch { /* (no storage: sealed again next time) */ }
    for (let k = 0; k < 6; k += 1) { // the wax in pieces, falling
      const p = document.createElement('span'); p.className = 'wax-bit'; const a = (k / 6) * 6.28;
      p.style.setProperty('--dx', `${Math.round(Math.cos(a) * 40)}px`); p.style.setProperty('--dy', `${Math.round(60 + Math.sin(a) * 20)}px`); btn.append(p);
    }
    setTimeout(() => { cover.remove(); card.querySelector('.card-close').focus(); }, reduceMotion ? 0 : 650);
  };
  btn.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; try { btn.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer knows) */ } });
  btn.addEventListener('pointermove', (e) => { if (x0 === null) return; const d = Math.hypot(e.clientX - x0, e.clientY - y0); btn.style.transform = `translate(${e.clientX - x0}px, ${e.clientY - y0}px)`; if (d > 34) { x0 = null; brk(); } });
  btn.addEventListener('pointerup', () => { if (x0 !== null) { x0 = null; btn.style.transform = ''; } });
  btn.addEventListener('click', (e) => { if (e.detail === 0) brk(); }); // (the keyboard: Enter or Space)
  setTimeout(() => btn.focus(), 50);
}
/** The books left open at a page, room by room: { room: { label: spread } }, from localStorage. */
function bookmarks() { try { return JSON.parse(localStorage.getItem('bookmarks')) || {}; } catch { return {}; } }
/** What the visitor has looked at, room by room (labels), from localStorage. */
function lookedAt() { try { return JSON.parse(localStorage.getItem('looked-at')) || {}; } catch { return {}; } }
/** The card comes out of its thing and goes back into it: from the thing's box to the card's, each
 *  kind its way (a scroll unrolls, a book opens, a letter unfolds in three folds, the rest grows). */
function unfold(from, out, then) {
  if (reduceMotion || !from || !from.isConnected) { if (then) then(); return; }
  const r = from.getBoundingClientRect(); const c = card.getBoundingClientRect();
  if (!c.width || !r.width) { if (then) then(); return; }
  const at = (sx, sy, x = r.left, y = r.top) => `translate(${x - c.left}px, ${y - c.top}px) scale(${sx}, ${sy})`;
  const small = at(r.width / c.width, r.height / c.height);
  const k = card.dataset.kind; const mid = { offset: 0.55 };
  if (k === 'scroll' || k === 'charter' || k === 'hanging') Object.assign(mid, { transform: at(1, 0.06, c.left, c.top) }); // (rolled: its full width, then down)
  else if (BOOKISH.has(k)) Object.assign(mid, { transform: at(0.08, 1, c.left + c.width / 2, c.top) }); // (shut: its spine, then the covers apart)
  const frames = [{ transform: small, opacity: 0.3 }, ...(mid.transform ? [mid] : []), { transform: 'none', opacity: 1 }];
  const fold = k === 'letter';
  const a = card.animate(out ? frames : frames.reverse(), { duration: out ? 340 : 240, easing: fold ? 'steps(3, end)' : out ? 'cubic-bezier(.2, .8, .3, 1)' : 'ease-in', fill: out ? 'none' : 'forwards' });
  card.style.transformOrigin = '0 0';
  a.onfinish = () => { card.style.transformOrigin = ''; if (then) then(); a.cancel(); };
}
/** A real asset's figure in a card: its canvas painted by hours.js, its caption; [◄] [►] turn it. */
function paintFig(fig) {
  if (!window.Hours || !window.Hours.paint) return;
  fig.querySelector('figcaption').innerHTML = window.Hours.paint(fig.querySelector('canvas'), fig.dataset.real, Number(fig.dataset.i));
}
card.addEventListener('click', (e) => {
  const b = e.target.closest('[data-real-step]'); if (!b) return;
  const fig = b.closest('.real-fig'); const n = Number(fig.dataset.n);
  fig.dataset.i = String((Number(fig.dataset.i) + Number(b.dataset.realStep) + n) % n); paintFig(fig); cue('page');
});
function closeCard(refocus = true) {
  if (card.hidden || card.closing) return;
  cue('close');
  const from = cardFrom; card.closing = true;
  if (card.classList.contains('as-book')) { // a book closed on a page past the first keeps a ribbon there
    const all = bookmarks(); const id = root.dataset.room; const label = card.getAttribute('aria-label'); all[id] ||= {};
    if (card.bookAt > 0) all[id][label] = card.bookAt; else delete all[id][label];
    try { localStorage.setItem('bookmarks', JSON.stringify(all)); } catch { /* (no storage: no ribbon) */ }
  }
  const done = () => { card.closing = false; card.hidden = true; if (window.Hours && window.Hours.opened) window.Hours.opened(-1); };
  if (refocus && from && from.isConnected) unfold(from, false, done); else done();
  if (refocus && from) from.focus();
}
card.querySelector('.card-close').addEventListener('click', () => closeCard());
card.addEventListener('keydown', (e) => { // Tab stays in the card while it is open; Esc (below) closes it
  if (e.key !== 'Tab') return;
  const f = [...card.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.closest('[hidden]'));
  if (!f.length) return;
  const first = f[0]; const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
document.addEventListener('pointerdown', (e) => {
  if (!card.hidden && !card.contains(e.target) && !e.target.closest('.spot')) closeCard(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !root.dataset.room || root.getAttribute('data-theme') !== 'hours') return;
  if (document.querySelector('dialog[open]') || cmdOpen()) return;
  e.preventDefault();
  if (!card.hidden) { closeCard(); return; } // Esc: first the card, then the room
  leaveRoom();
});

// in a room, the arrow keys go from thing to thing as they lie: to the nearest one that way (Enter looks)
document.addEventListener('keydown', (e) => {
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!dirs[e.key] || !root.classList.contains('room-ready') || root.getAttribute('data-theme') !== 'hours' || !card.hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]') || cmdOpen()) return;
  const act = document.activeElement; if (act && act.closest && act.closest('input, textarea, .tabs')) return;
  const bs = [...spots.querySelectorAll('.spot')]; if (!bs.length) return;
  e.stopImmediatePropagation(); // (not the menu's 'arrows bring the cursor back': in a room they walk among the things)
  const mid = (b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  e.preventDefault();
  if (!bs.includes(act)) { // from nowhere: the thing nearest the middle
    const c = [innerWidth / 2, innerHeight / 2];
    bs.reduce((a, b) => (Math.hypot(...mid(b).map((v, k) => v - c[k])) < Math.hypot(...mid(a).map((v, k) => v - c[k])) ? b : a)).focus();
    return;
  }
  const [dx, dy] = dirs[e.key]; const [x0, y0] = mid(act);
  let best = null; let score = Infinity;
  bs.forEach((b) => {
    if (b === act) return;
    const [x, y] = mid(b); const along = (x - x0) * dx + (y - y0) * dy; const across = Math.abs((x - x0) * dy) + Math.abs((y - y0) * dx);
    if (along <= 4) return; const sc = along + 2 * across;
    if (sc < score) { score = sc; best = b; }
  });
  if (best) best.focus();
});

/** Go to room `id`, by hash on the index, by page load elsewhere. */
function goTo(id) {
  const url = new URL(roomHref(id));
  if (isIndex) location.hash = url.hash;
  else location.href = url.href;
}
