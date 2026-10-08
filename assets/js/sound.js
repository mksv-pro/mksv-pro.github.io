'use strict';

/* ---- sound for the hours theme, synthesised (no audio files), off by default --------------
   Outside: fire, wind and rain from the real weather, thunder, the river, the mill creaking in
   the wind, birds and ducks by day, an owl and (in summer) crickets by night, the bell at each
   planetary hour. Inside: each room its own sound, an echo in the stone ones, the weather
   muffled. A soft lute air, composed as it plays (Dorian by day, Aeolian and sparser by night).
   cue(name, o): the page's events (a page turned, a seal broken, a door, a horse, thunder after
   a bolt, footsteps...). state() (script.js) says what the page shows, and where things stand on
   the screen (pan, -1 left .. 1 right): sounds come from their side. setVolume(0..1), setMusic(bool). */

(function () {
  // recorded foley for the interface (_tools/sounds.py: Kenney's RPG Audio, CC0, treated to match)
  const SND = new URL('../snd/', document.currentScript.src);
  const REAL = new URL('../data/real/', document.currentScript.src); // (real tunes: _tools/fetch_tunes.py)
  const RECORDED = ['door', 'card', 'seal', 'page', 'close']; const takes = {};
  let ac = null; let master; let dry; let wet; let noise; let timer = 0; let state = () => ({});
  let crackleAt = 0; // when the fire's next crackle is due (AudioContext time)
  let volume = 0.6; let music = true;
  const beds = {}; // continuous layers: fire, wind, rain, river, forge
  const t0 = () => ac.currentTime;

  function noiseBuffer() {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function reverb(seconds, damp = 0.3) { // a room's echo: decaying noise as the impulse response, duller as `damp` grows (soft walls, books)
    const n = Math.round(ac.sampleRate * seconds); const b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const d = b.getChannelData(c); let y = 0; const k = 1 - damp * 0.95;
      for (let i = 0; i < n; i += 1) { y += k * ((Math.random() * 2 - 1) - y); d[i] = y * (1 - i / n) ** 2.6; } // (a one-pole lowpass: the highs die first)
    }
    const cv = ac.createConvolver(); cv.buffer = b; return cv;
  }
  /* Each room its own echo, from its size and what lines it: [seconds, damping 0..1, level]. The dome
     and the stone hall ring long, the library is dry (books drink sound), the wooden rooms are short. */
  const RV = { out: [2.6, 0.45, 0.35], talks: [3.8, 0.35, 0.7], research: [4.5, 0.25, 0.75], contact: [2.4, 0.4, 0.6],
    projects: [1.3, 0.55, 0.45], workshop: [1.3, 0.55, 0.45], about: [0.9, 0.7, 0.3], publications: [0.45, 0.85, 0.15],
    teaching: [1.1, 0.6, 0.35], news: [0.8, 0.65, 0.3] };
  const verbs = {}; let verbNow = null;
  function useVerb(key) {
    if (verbNow === key) return;
    const old = verbNow && verbs[verbNow]; verbNow = key;
    if (old) { set(old.g.gain, 0, 0.15); setTimeout(() => { if (verbs[verbNow] !== old && old.on) { wet.disconnect(old.cv); old.on = false; } }, 1200); } // (an idle convolver costs CPU: unplugged)
    if (!verbs[key]) { const [sec, damp] = RV[key]; const cv = reverb(sec, damp); const g = ac.createGain(); g.gain.value = 0; cv.connect(g).connect(master); verbs[key] = { cv, g, on: false }; }
    const v = verbs[key]; if (!v.on) { wet.connect(v.cv); v.on = true; } set(v.g.gain, RV[key][2], 0.3);
  }
  /** A looping noise through a filter, its gain set later (0..1), its side (pan) too. */
  function bed(type, freq, q) {
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0; const p = ac.createStereoPanner();
    src.connect(f).connect(g).connect(p).connect(dry); src.start();
    return { f, g, p };
  }
  const set = (p, v, tc = 0.8) => p.setTargetAtTime(v, t0(), tc);
  const out = (echo) => (echo ? wet : dry);
  /** Where a sound goes: the echo or not, from one side or the other (pan -1..1). */
  function dest(echo, pan) {
    if (!pan) return out(echo);
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(out(echo)); return p;
  }

  /** A short burst of filtered noise: a crackle, a rustle, thunder, a footstep. */
  function burst(freq, dur, vol, { type = 'bandpass', q = 1.2, at = 0, sweep = 0, echo = false, pan = 0 } = {}) {
    const src = ac.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.5 + Math.random();
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; const g = ac.createGain(); const t = t0() + Math.max(0, at);
    f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 5)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest(echo, pan)); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  /** A tone gliding from f0 to f1: a chirp, a hoot, a caw, a neigh. */
  function tone(f0, f1, dur, vol, { at = 0, type = 'sine', vibrato = 0, filter = 0, echo = false, pan = 0 } = {}) {
    const o = ac.createOscillator(); o.type = type; const g = ac.createGain(); const t = t0() + Math.max(0, at);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vibrato) { const l = ac.createOscillator(); const lg = ac.createGain(); l.frequency.value = vibrato; lg.gain.value = f0 * 0.04; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filter) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filter; f.Q.value = 2; node = node.connect(f); }
    node.connect(dest(echo, pan)); o.start(t); o.stop(t + dur + 0.05);
  }
  function chime(freqs, vol, decay, echo = true, at = 0, pan = 0) { // metal or glass: inharmonic partials ringing out
    freqs.forEach((f, k) => {
      const o = ac.createOscillator(); const g = ac.createGain(); const t = t0() + Math.max(0, at);
      o.frequency.value = f; g.gain.setValueAtTime(vol / (k + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay / (1 + k * 0.3));
      o.connect(g).connect(dest(echo, pan)); o.start(t); o.stop(t + decay + 0.1);
    });
  }
  /* Two bells of Notre-Dame, their partials measured from recordings (_tools/fetch_bells.py): Emmanuel
     (1686) the castle's, Marcel (2013) the chapel's. Each partial [Hz, amplitude, tau s] rings out
     from the stroke, the high ones dying first; the clapper's clang on top. */
  let bells = null; let bellsAsked = false;
  function askBells() { if (!bellsAsked) { bellsAsked = true; realJson('bells').then((o) => { bells = o ? o.bells : null; }).catch(() => {}); } }
  function strike(b, at, vol, echo, pan) {
    const t = t0() + Math.max(0, at); const to = dest(echo, pan);
    b.partials.forEach(([f, amp, tau]) => {
      const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * amp + 0.0001, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, tau);
      o.connect(g).connect(to); o.start(t); o.stop(t + Math.min(30, tau * 5));
    });
    burst(b.partials.at(-1)[0] * 1.5, 0.05, vol * 0.4, { at, echo, pan }); // (the clapper)
  }
  function bell() { // the castle's: Emmanuel, or a bronze bell of round numbers until it has loaded
    if (!ac) return;
    askBells();
    if (bells && bells.emmanuel) { strike(bells.emmanuel, 0, 0.16, false, state().pan ? state().pan.bell || 0 : 0); return; }
    [[1, 0.22], [2, 0.12], [2.4, 0.09], [3, 0.06], [4.2, 0.04], [5.4, 0.02]].forEach(([r, v]) => {
      const o = ac.createOscillator(); const g = ac.createGain(); const t = t0();
      o.frequency.value = 220 * r; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 5 / r ** 0.3);
      o.connect(g).connect(dry); o.start(t); o.stop(t + 6);
    });
  }

  /* ---- the lute, mode by mode: a string plucked at a fifth of its length sounds its harmonics n with
     amplitudes ~ sin(n pi p) / n^2 (the triangle the finger pulls, in Fourier modes); a gut string is a
     little stiff, so the partials run sharp (f_n = n f1 sqrt(1 + B n^2)), and the high ones die first. */
  const MIDI = (m) => 440 * 2 ** ((m - 69) / 12);
  function pluck(m, at, vol, len) {
    const t = t0() + Math.max(0, at); const f1 = MIDI(m); const P = 0.2; const B = 0.00035;
    const g = ac.createGain(); g.gain.value = vol;
    for (let n = 1; n <= 10; n += 1) {
      const fn = n * f1 * Math.sqrt(1 + B * n * n); if (fn > 9000) break;
      const amp = Math.abs(Math.sin(n * Math.PI * P)) / (n * n); if (amp < 0.004) continue;
      const o = ac.createOscillator(); o.frequency.value = fn; const a = ac.createGain(); const life = len / (1 + 0.35 * (n - 1));
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(amp * 1.6, t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + life);
      o.connect(a).connect(g); o.start(t); o.stop(t + life + 0.05);
    }
    g.connect(wet); g.connect(dry); // a little of the room's echo on the lute
  }
  /* The air walks the mode of the planetary hour, as the old correspondences would have it: each
     planet its mode and its pace (sky.js's Chaldean order: Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon). */
  const MODES = [
    [[0, 1, 3, 5, 6, 8, 10], 46, [0, 2, 7]], // Saturn: Locrian, slow (it closes on the tonic or the third: its fifth is diminished)
    [[0, 2, 4, 5, 7, 9, 10], 62, [0, 4, 7]], // Jupiter: Mixolydian
    [[0, 1, 3, 5, 7, 8, 10], 76, [0, 4, 7]], // Mars: Phrygian, quick
    [[0, 2, 4, 5, 7, 9, 11], 70, [0, 4, 7]], // the Sun: Ionian
    [[0, 2, 3, 5, 7, 9, 10], 60, [0, 4, 7]], // Venus: Dorian
    [[0, 2, 4, 6, 7, 9, 11], 84, [0, 4, 7]], // Mercury: Lydian, quickest
    [[0, 2, 3, 5, 7, 8, 10], 52, [0, 4, 7]], // the Moon: Aeolian
  ];
  /* ---- real tunes (Mutopia's MIDI, reduced to a tune and a bass): after a while of the composed air,
     one fitting the hour is played through, then the air comes back. Satie, at night, on a harp. */
  let tunes = null; let tunesAsked = null; let playing = null; let airUntil = 0;
  /** One of the real assets (assets/data/real/<name>.json, its version from index.json), or null. */
  const realJson = (name) => fetch(new URL('index.json', REAL), { cache: 'no-cache' }).then((r) => r.json())
    .then((ix) => (ix[name] ? fetch(new URL(`${name}.json?v=${ix[name].v}`, REAL)).then((r) => r.json()) : null));
  function askTunes() { // (once; the promise of the list)
    return (tunesAsked ||= realJson('tunes').then((o) => { tunes = o ? o.tunes : null; return tunes; }).catch(() => null));
  }
  function harp(m, at, vol, len) { // plucked in the middle: the odd harmonics, a long ring
    const t = t0() + Math.max(0, at); const f1 = MIDI(m); const g = ac.createGain(); g.gain.value = vol;
    for (let n = 1; n <= 7; n += 2) {
      const o = ac.createOscillator(); o.frequency.value = n * f1 * Math.sqrt(1 + 0.0001 * n * n); const a = ac.createGain(); const life = len * 1.6 / (1 + 0.2 * (n - 1));
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(1 / (n * n) * 1.4, t + 0.005); a.gain.exponentialRampToValueAtTime(0.0001, t + life);
      o.connect(a).connect(g); o.start(t); o.stop(t + life + 0.05);
    }
    g.connect(wet); g.connect(dry);
  }
  const whenOf = (s) => (s.month === 11 && Math.random() < 0.4 ? 'december' : s.night ? 'night' : (s.hour ?? 12) >= 17 ? 'evening' : 'day');
  function pickTune(s, but = null) {
    const pool = tunes.filter((q) => q.when === whenOf(s) && q !== but); return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  /** Schedule the playing tune's notes up to half a second ahead; false when it has ended. */
  function playTune() {
    const q = playing; const bd = 60 / q.tune.bpm; const harpy = q.tune.when === 'night';
    while (q.i < q.tune.notes.length) {
      const [b, d, m0, v] = q.tune.notes[q.i]; const at = q.t0 + b * bd;
      if (at > t0() + 0.5) return true;
      let m = m0; while (m > 84) m -= 12; while (m < 38) m += 12; // (the instrument's compass)
      const jitter = (Math.random() - 0.5) * 0.015; // (a player, not a machine)
      if (at > t0() - 0.05) (harpy ? harp : pluck)(m, at - t0() + jitter, v ? 0.04 : 0.06, Math.max(0.3, d * bd * 1.8));
      q.i += 1;
    }
    return t0() < q.t0 + (q.tune.notes.at(-1)[0] + 6) * 60 / q.tune.bpm;
  }
  const air = { next: 0, deg: 7, left: 0, beat: 0 };
  function compose() { // schedule the air up to half a second ahead
    askTunes();
    if (chanting && chantBus.gain.value > 0.05) return; // (the lute is quiet while the chapel sings within earshot)
    if (playing) { if (playTune()) return; playing = null; airUntil = t0() + 60 + Math.random() * 40; }
    if (!airUntil) airUntil = t0() + 45;
    const qt = new URLSearchParams(location.search).get('tune'); // (?tune=<id>: that one at once, a preview)
    if (qt && tunes && !compose.forced) { compose.forced = true; const tune = tunes.find((q) => q.id === qt); if (tune) { playing = { tune, t0: t0() + 0.3, i: 0 }; return; } }
    if (tunes && t0() > airUntil) { const tune = pickTune(state()); if (tune) { playing = { tune, t0: t0() + 1, i: 0 }; return; } airUntil = t0() + 60; }
    const s = state(); const night = s.night; const [scale, bpm, ends] = MODES[s.planet ?? (night ? 6 : 4)]; const base = night ? 50 : 62; // D3 or D4
    const beat = 60 / (bpm * (night ? 0.85 : 1));
    if (air.next < t0()) air.next = t0() + 0.1;
    while (air.next < t0() + 0.5) {
      const at = air.next - t0();
      if (air.left <= 0) { // a phrase: 5 to 9 notes, then a rest; it starts near the tonic or the fifth
        air.left = 5 + Math.floor(Math.random() * 5); air.deg = Math.random() < 0.5 ? 7 : 4;
        air.next += beat * (night ? 3 : 2); continue;
      }
      air.deg = Math.max(0, Math.min(11, air.deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      if (air.left === 1) air.deg = ends[Math.floor(Math.random() * 3)]; // close on the tonic, the fifth or the octave
      const m = base + 12 * Math.floor(air.deg / 7) + scale[air.deg % 7];
      const len = [0.5, 0.5, 1, 1, 1.5][Math.floor(Math.random() * 5)];
      if (!(night && Math.random() < 0.15)) pluck(m, at, night ? 0.05 : 0.065, beat * len * 2.2);
      if (air.beat % 4 === 0) pluck(base - 12 + (Math.random() < 0.7 ? 0 : 7), at, 0.045, beat * 4); // the drone on the downbeat
      air.beat += 1; air.left -= 1; air.next += beat * len;
    }
  }

  /* ---- the chapel's chant (GregoBase's GABC, _tools/fetch_chant.py) at the offices: four men's voices
     on the notes, each a sawtooth a few cents off the others, through the formants of the syllable's
     vowel (F1..F3, Hz; Peterson & Barney's averages for men, rounded), far off in the nave. */
  const FORMANTS = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [300, 2200, 2900], o: [500, 900, 2400], u: [330, 750, 2400] };
  let chants = null; let chantsAsked = false; let chanting = null; let lastOffice = ''; let chantBus; let chantPan;
  function sing(c, at, beat) {
    const sung = c.notes.filter((q) => q[1] !== null).map((q) => q[1]).sort((a, b) => a - b);
    const base = 50 - sung[Math.floor(sung.length / 2)]; // (the median on D3: a men's choir's reciting pitch)
    const env = ac.createGain(); env.gain.value = 0; const sum = ac.createGain(); sum.gain.value = 0.06;
    const fs = [1, 0.45, 0.2].map((g, k) => { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [6, 9, 12][k]; const a = ac.createGain(); a.gain.value = g * 3; sum.connect(f).connect(a).connect(env); return f; });
    env.connect(chantBus);
    const oscs = [-9, -3, 4, 10].map((cents) => {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.detune.value = cents;
      const lfo = ac.createOscillator(); lfo.frequency.value = 4.6 + Math.random(); const d = ac.createGain(); d.gain.value = 5;
      lfo.connect(d).connect(o.detune); o.connect(sum); return [o, lfo];
    });
    let t = t0() + at;
    c.notes.forEach(([d, semi, v]) => {
      const len = d * beat;
      if (semi === null) { env.gain.setTargetAtTime(0, t, 0.08); t += len; return; }
      const f = MIDI(base + semi); oscs.forEach(([o]) => o.frequency.setTargetAtTime(f, t, 0.025));
      if (v) { FORMANTS[v].forEach((F, k) => fs[k].frequency.setTargetAtTime(F, t, 0.03)); env.gain.setTargetAtTime(0.35, t, 0.012); } // (a syllable: the consonant's dip)
      env.gain.setTargetAtTime(1, t + (v ? 0.05 : 0), 0.05);
      t += len;
    });
    env.gain.setTargetAtTime(0, t, 0.25);
    oscs.forEach(([o, lfo]) => { o.start(t0() + at); lfo.start(t0() + at); o.stop(t + 2); lfo.stop(t + 2); });
    return t - t0();
  }
  /** The office's chants one after the other (compline: the hymn, then the Salve Regina). */
  function chant(office) {
    const cs = chants.filter((c) => c.office === office); if (!cs.length) return;
    let at = 1.5; cs.forEach((c) => { at = sing(c, at, c.part === 'Antiphona' ? 0.5 : 0.42) + 4; });
    chanting = { office, title: cs[0].title, until: t0() + at };
  }
  function chantTick(s) {
    if (!chantsAsked) { chantsAsked = true; realJson('chant').then((o) => { chants = o ? o.chants : null; }).catch(() => {}); }
    const pan = s.pan || {};
    set(chantBus.gain, s.room ? 0 : s.place === 'village' ? 0.55 : s.place === 'tower' ? 0.06 : 0.2, 1.2); set(chantPan.pan, s.place ? 0 : pan.chapel || 0, 0.5);
    if (chanting && t0() > chanting.until) chanting = null;
    const qc = new URLSearchParams(location.search).get('chant'); // (?chant=<office>: that one at once, a preview)
    const o = qc && !chantTick.forced ? { name: qc, key: 'preview' } : s.office;
    if (!chants || chanting || !o || o.key === lastOffice) return;
    if (qc) chantTick.forced = true;
    lastOffice = o.key; chant(o.name);
  }

  /** The chapel's bell: smaller and higher than the castle's, struck `at` seconds from now. */
  function chapelBell(at, pan = 0) {
    askBells();
    if (bells && bells.marcel) { strike(bells.marcel, at, 0.12, true, pan); return; }
    [[1, 0.12], [2.1, 0.06], [2.7, 0.05], [3.4, 0.03], [4.9, 0.015]].forEach(([r, v]) => {
      const o = ac.createOscillator(); const g = ac.createGain(); const t = t0() + Math.max(0, at);
      o.frequency.value = 660 * r; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5 / r ** 0.4);
      o.connect(g).connect(dest(true, pan)); o.start(t); o.stop(t + 5);
    });
  }
  /** The angelus (7 am, noon, 7 pm): three strokes three times, a pause between, then nine. */
  function angelus(pan) {
    let at = 0;
    for (let g = 0; g < 3; g += 1) { for (let k = 0; k < 3; k += 1) { chapelBell(at, pan); at += 2.4; } at += 4; }
    for (let k = 0; k < 9; k += 1) { chapelBell(at, pan); at += 1.6; }
  }
  /** Birds for the season and the hour. The dawn chorus as it really goes: each species starts at its
   *  own light (the sun's altitude, s.sunAlt): the robin first, deep in the twilight, then the
   *  blackbird, the song thrush, the wren, the great tit, the chaffinch about sunrise, the sparrow
   *  last; each sings hardest when it starts, less as the morning goes. The cuckoo in spring, the
   *  nightingale on May and June nights; in winter the robin alone, and a sparrow. Each from its side. */
  const SONGS = {
    robin: () => { const p = (Math.random() - 0.5) * 1.4; for (let k = 0; k < 6; k += 1) tone(3200 + Math.random() * 2400, 2600 + Math.random() * 3000, 0.07, 0.025, { at: k * 0.09, pan: p }); },
    blackbird: () => { const p = (Math.random() - 0.5) * 1.4; let f = 1600 + Math.random() * 800; for (let k = 0; k < 4 + Math.floor(Math.random() * 4); k += 1) { const f2 = f * (0.85 + Math.random() * 0.4); tone(f, f2, 0.14, 0.035, { at: k * 0.16, pan: p }); f = f2; } },
    thrush: () => { // a phrase, said twice or three times over
      const p = (Math.random() - 0.5) * 1.4; const ph = Array.from({ length: 3 }, () => [2000 + Math.random() * 1600, 1800 + Math.random() * 2000]); const reps = 2 + Math.floor(Math.random() * 2);
      for (let r2 = 0; r2 < reps; r2 += 1) ph.forEach(([a, b], k) => tone(a, b, 0.08, 0.03, { at: r2 * 0.4 + k * 0.1, pan: p }));
    },
    wren: () => { const p = (Math.random() - 0.5) * 1.4; for (let k = 0; k < 14; k += 1) tone(4200 + (k % 2) * 900, 4400, 0.035, 0.02, { at: k * 0.045, pan: p }); },
    tit: () => { const p = (Math.random() - 0.5) * 1.4; for (let k = 0; k < 3; k += 1) { tone(4400, 4300, 0.09, 0.025, { at: k * 0.32, pan: p }); tone(3200, 3100, 0.12, 0.025, { at: k * 0.32 + 0.12, pan: p }); } }, // tea-cher, tea-cher
    chaffinch: () => { const p = (Math.random() - 0.5) * 1.4; for (let k = 0; k < 10; k += 1) tone(5200 - k * 220, 5000 - k * 220, 0.04, 0.022, { at: k * (0.075 - k * 0.003), pan: p }); tone(3600, 5200, 0.18, 0.025, { at: 0.62, pan: p }); }, // a falling trill, the flourish
    sparrow: () => { const p = (Math.random() - 0.5) * 1.4; for (let k = 0; k < 3; k += 1) tone(3000, 2600, 0.06, 0.03, { at: k * 0.15, pan: p }); },
  };
  const DAWN = [['robin', -10], ['blackbird', -8], ['thrush', -7], ['wren', -5], ['tit', -3], ['chaffinch', 0], ['sparrow', 3]]; // starting altitude, degrees
  function birds(s) {
    const m = s.month; const r = Math.random(); const alt = s.sunAlt ?? 20;
    if (s.night && alt < -10) { if ((m === 4 || m === 5) && r < 0.05) for (let k = 0; k < 8; k += 1) tone(1800 + (k % 3) * 700, 1500 + (k % 2) * 1600, 0.1, 0.03, { at: k * 0.13 }); return; } // the nightingale
    if (m === 11 || m <= 1) { if (alt > -8 && r < 0.012) SONGS.robin(); else if (alt > 2 && r < 0.02) SONGS.sparrow(); return; } // winter
    const spring = m >= 2 && m <= 6; const morning = s.hour < 12;
    DAWN.forEach(([sp, a0]) => {
      if (alt < a0) return;
      const keen = morning && spring ? 1 + 5 * Math.exp(-(alt - a0) / 8) : 1; // hardest at its start
      if (Math.random() < 0.004 * keen) SONGS[sp]();
    });
    if (m >= 3 && m <= 5 && Math.random() < 0.004) { tone(690, 680, 0.3, 0.05); tone(580, 570, 0.4, 0.05, { at: 0.42 }); } // the cuckoo
  }
  let lastAngelus = '';

  /* ---- the rooms: what each sounds like (s.room: the section shown, or a project page) */
  function roomSounds(room) {
    const r = Math.random();
    if (room === 'about' && r < 0.12) for (let k = 0; k < 3 + Math.floor(Math.random() * 4); k += 1) burst(5200, 0.06, 0.035, { type: 'highpass', at: k * 0.11 }); // a quill scratching
    if (room === 'publications' && r < 0.04) burst(2200, 0.4, 0.05, { sweep: 2.2 }); // a page turned, somewhere
    if (room === 'news' && r < 0.05) for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k += 1) tone(620, 470, 0.22, 0.05, { type: 'sawtooth', filter: 900, at: k * 0.35 }); // a raven
    if ((room === 'projects' || room === 'workshop') && r < 0.06) { // hammer on the anvil, twice
      [0, 0.45].forEach((at) => { chime([1180, 2640, 3910], 0.06, 0.9, true, at); burst(180, 0.08, 0.15, { type: 'lowpass', at }); });
    }
    if (room === 'teaching' && r < 0.06) for (let k = 0; k < 4; k += 1) burst(3600, 0.05, 0.04, { at: k * 0.2 }); // chalk on the board
    if (room === 'talks' && r < 0.025) chime([2210, 3150, 4320], 0.035, 1.6); // goblets touching
    if (room === 'research' && r < 0.9) burst(4000, 0.015, 0.02, { type: 'highpass' }); // the orrery's clock, ticking
    if (room === 'contact' && r < 0.03) for (let k = 0; k < 4; k += 1) burst(260, 0.09, 0.08, { type: 'lowpass', at: k * 0.5, echo: true }); // footsteps under the arch
    // and the rest of each room's life
    const r2 = Math.random();
    if (room === 'contact' && r2 < 0.05) tone(1500 + Math.random() * 300, 700, 0.06, 0.03, { echo: true }); // a drip in the stone passage
    if (room === 'teaching' && r2 < 0.03) for (let k = 0; k < 5; k += 1) burst(2600 + Math.random() * 1500, 0.05, 0.015, { at: k * 0.07, pan: (Math.random() - 0.5) }); // pupils whispering
    if (room === 'teaching' && r2 > 0.995) { burst(700, 0.12, 0.08, { echo: true }); burst(500, 0.1, 0.06, { at: 0.18, echo: true }); } // a cough at the back
    if (room === 'news' && r2 < 0.03) for (let k = 0; k < 6; k += 1) burst(900 + Math.random() * 500, 0.04, 0.06, { at: k * 0.06, pan: -0.4 }); // wings, a raven settling
    if ((room === 'projects' || room === 'workshop') && r2 < 0.02) { burst(300, 0.8, 0.08, { type: 'lowpass', sweep: 1.6 }); burst(1800, 0.3, 0.03, { at: 0.5, type: 'highpass' }); } // the bellows, the fire answering
    if (room === 'publications' && r2 < 0.01) burst(4200, 0.05, 0.02, { type: 'highpass' }); // a book slid back on its shelf
    if (room === 'talks' && state().cinema) for (let k = 0; k < 4; k += 1) burst(2600 + Math.random() * 800, 0.012, 0.03, { type: 'highpass', at: k * 0.0625 }); // the lantern's crank and shutter, 16 a second
    if (room === 'talks' && r2 < 0.02) for (let k = 0; k < 3; k += 1) tone(150 + Math.random() * 60, 130, 0.25, 0.012, { type: 'sawtooth', filter: 500, at: k * 0.3, echo: true }); // voices, far down the hall
    if (room === 'about' && r2 < 0.04) burst(600, 0.25, 0.02, { type: 'lowpass' }); // a candle gutters
  }
  /* ---- thunder, computed sample by sample. A bolt's channel is kilometres of zigzag: each segment
     sends its own clap, and they arrive one after another, the nearest first, so a peal is a train
     of claps on a deep rumble (brown noise: its energy low, ~20-200 Hz). Near, the first clap is a
     ripping crack, all frequencies at once; far, the air has taken the highs and the claps blur
     into a long roll. Stereo: the two channels' claps a few ms apart. */
  function thunder(km, at, pan, outW) {
    const sr = ac.sampleRate; const dur = Math.min(9, 4.5 + km * 1.1); const n = Math.round(sr * dur);
    const buf = ac.createBuffer(2, n, sr);
    const claps = Array.from({ length: 14 + Math.floor(Math.random() * 12) }, (_, k) => {
      const tk = k === 0 ? 0 : dur * 0.75 * Math.random() ** 1.6; // (most early, a few late: the far end of the channel)
      return { t: tk, a: (k === 0 ? 1 : 0.25 + 0.6 * Math.random()) * (1 - tk / dur) ** 1.5, tau: 0.12 + Math.random() * (0.25 + km * 0.12) };
    });
    for (let c = 0; c < 2; c += 1) {
      const d = buf.getChannelData(c); let br = 0; const lag = c * (0.004 + Math.random() * 0.006);
      const STEP = 64; const env = new Float32Array(Math.ceil(n / STEP) + 2); // (the envelope at a coarse rate, then interpolated: a strike must not stall a frame)
      for (let k = 0; k < env.length; k += 1) {
        const t = (k * STEP) / sr; let e = 0.22 * Math.exp(-t / (dur * 0.3)); // the bed of the rumble
        for (const q of claps) { const u = t - q.t - lag; if (u > 0) e += q.a * Math.min(1, u / 0.012) * Math.exp(-u / q.tau); }
        env[k] = e;
      }
      for (let i = 0; i < n; i += 1) {
        br = (br + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise
        const k = i / STEP; const k0 = Math.floor(k); d[i] = br * 3.2 * (env[k0] + (env[k0 + 1] - env[k0]) * (k - k0));
      }
      if (km < 1.5) { // the crack: a few hundred milliseconds of tearing, white noise in rapid snaps
        for (let k = 0; k < 40; k += 1) { const i0 = Math.round(sr * (k * 0.008 + Math.random() * 0.004 + lag)); const amp = (1 - k / 40) * (0.6 + 0.4 * Math.random()); for (let j = 0; j < sr * 0.004 && i0 + j < n; j += 1) d[i0 + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / (sr * 0.0015)); }
      }
    }
    const src = ac.createBufferSource(); src.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(180, 2400 / (1 + km * 1.6)); lp.Q.value = 0.5; // the far ones, duller
    const lo = ac.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 120; lo.gain.value = 8; // the weight of it
    const g = ac.createGain(); g.gain.value = 1.6 * Math.max(0.35, 1 - km / 8) * outW;
    src.connect(lp).connect(lo).connect(g).connect(dest(true, pan)); src.start(t0() + Math.max(0, at));
  }

  /** Footsteps: n paces on `floor` (wood, stone, gravel, stair). */
  function steps(floor, n = 5, pan = 0, at0 = 0) {
    for (let k = 0; k < n; k += 1) {
      const at = at0 + k * (floor === 'stair' ? 0.36 : 0.45) + (Math.random() - 0.5) * 0.04;
      if (floor === 'wood') { burst(420, 0.07, 0.22, { q: 3, at, echo: true, pan }); tone(140, 95, 0.08, 0.05, { at, pan }); }
      else if (floor === 'gravel') { burst(2600, 0.13, 0.08, { at, pan }); burst(900, 0.1, 0.05, { at: at + 0.02, pan }); }
      else { burst(220, 0.06, 0.28, { type: 'lowpass', at, echo: true, pan }); burst(3200, 0.02, 0.05 + (floor === 'stair' ? k * 0.01 : 0), { type: 'highpass', at, pan }); } // stone, and the stair's
    }
  }

  function tick() { // every 250 ms: the beds follow the page; events now and then
    const s = state(); const wx = s.wx || {}; const wet0 = { drizzle: 0.3, showers: 0.6, rain: 0.8, storm: 1 }[wx.kind] || 0;
    const inside = Boolean(s.room); const room = inside ? 0.6 : 1; const outW = inside ? 0.12 : 1; const pan = (inside || s.place ? {} : s.pan) || {};
    set(master.gain, s.on ? volume * 0.55 : 0, 0.4);
    useVerb(inside ? (RV[s.room] ? s.room : 'out') : 'out');
    set(beds.fire.g.gain, (s.room === 'projects' || s.room === 'workshop' ? 0.12 : 0.05) * room); set(beds.fire.p.pan, pan.fire || 0, 0.3);
    set(beds.wind.g.gain, Math.min(0.12, (wx.wind || 0) / 250) * (s.room === 'research' ? 1.4 : outW)); set(beds.wind.f.frequency, 300 + Math.random() * 500, 2);
    // the rain as hard as it really falls (mm an hour; loudness ~ its square root), brighter when heavy
    const rainK = wet0 && wx.precip != null ? Math.max(0.2, Math.min(1.4, Math.sqrt(wx.precip / 3))) : wet0;
    set(beds.rain.g.gain, 0.16 * rainK * outW); set(beds.rain.f.frequency, 1300 + 900 * rainK, 1);
    set(beds.river.g.gain, inside ? 0 : 0.035); set(beds.river.f.frequency, 700 + Math.random() * 500, 0.6); // the river's murmur
    if (!s.on) return;
    const ak = `${s.day}-${s.hour}`; // the angelus, once, in the minute it is due
    if ([7, 12, 19].includes(s.hour) && s.minute === 0 && ak !== lastAngelus && !inside) { lastAngelus = ak; angelus(pan.chapel); }
    if (s.place === 'tower') { set(beds.wind.g.gain, Math.min(0.2, 0.05 + (wx.wind || 0) / 160)); set(beds.river.g.gain, 0); if (Math.random() < 0.006) tone(2400, 1500, 0.9, 0.035, { vibrato: 12 }); } // up high: the wind, a buzzard
    if (s.place === 'village') {
      set(beds.crowd.g.gain, s.market ? 0.05 : 0); set(beds.river.g.gain, 0.05);
      if (s.market && Math.random() < 0.08) { const f = 180 + Math.random() * 160; tone(f, f * (0.8 + Math.random() * 0.4), 0.18 + Math.random() * 0.2, 0.02, { type: 'sawtooth', filter: 1100 }); } // voices
      if (s.forge && Math.random() < 0.05) [0, 0.4].forEach((at) => chime([1180, 2640, 3910], 0.035, 0.7, true, at)); // the smith's hammer
      if (s.tavern && Math.random() < 0.03) for (let k = 0; k < 3; k += 1) tone(320 + Math.random() * 120, 260, 0.12, 0.02, { type: 'square', filter: 900, at: k * 0.14 }); // laughter at the tavern
    } else set(beds.crowd.g.gain, 0);
    chantTick(s);
    if (music) compose();
    // the fire's crackle, a Poisson process: gaps drawn from an exponential law (rate a second), a big pop now and then
    const rate = s.room === 'projects' || s.room === 'workshop' ? 9 : inside ? 2 : 5;
    if (crackleAt < t0()) crackleAt = t0();
    while (crackleAt < t0() + 0.3) {
      const big = Math.random() < 0.07;
      burst(big ? 900 : 1500 + Math.random() * 3000, big ? 0.06 : 0.02 + Math.random() * 0.04, (big ? 0.2 : 0.12) * room, { at: crackleAt - t0(), pan: pan.fire || 0 });
      crackleAt += -Math.log(1 - Math.random()) / rate;
    }
    if (inside && wx.kind === 'storm' && Math.random() < 0.012) burst(90, 3, 0.35, { type: 'lowpass' }); // thunder, muffled by the walls (outside, each bolt brings its own: cue)
    if (inside) { roomSounds(s.room); return; }
    if ((wx.wind || 0) > 6 && Math.random() < Math.min(0.06, wx.wind / 600)) tone(160, 120, 0.7, 0.03, { type: 'sawtooth', filter: 300, vibrato: 7, pan: pan.mill }); // the mill creaks
    if (wx.kind !== 'storm' && wet0 < 0.7) birds(s);
    if (!s.night && Math.random() < 0.01) for (let k = 0; k < 2; k += 1) tone(420, 360, 0.12, 0.04, { type: 'square', filter: 700, at: k * 0.18, pan: pan.ducks }); // ducks
    if (s.night && Math.random() < 0.006) cue('owl');
    if (s.night && s.summer && Math.random() < 0.3) { const p = (Math.random() - 0.5) * 1.6; for (let k = 0; k < 3; k += 1) tone(4400, 4300, 0.03, 0.012, { at: k * 0.05, type: 'square', pan: p }); } // crickets, here and there
  }

  /** A recorded take, a little higher or lower each time so it never repeats exactly. */
  function play(name, vol = 0.65) {
    const src = ac.createBufferSource(); src.buffer = takes[name]; src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = ac.createGain(); g.gain.value = vol; src.connect(g).connect(out(name === 'door')); src.start();
  }

  /** The page's events: a recording when there is one (loaded), else a synthesised sound. */
  const PAN_OF = { neigh: 'horse', owl: 'owl', meow: 'fire', purr: 'fire', bell: 'bell' }; // whose side a cue comes from
  function cue(name, o = {}) {
    const s = state();
    if (!ac || !s.on) return;
    if (takes[name]) { play(name); return; }
    const pan = o.pan ?? (!s.room && s.pan ? s.pan[PAN_OF[name]] || 0 : 0); const outW = s.room ? 0.15 : 1;
    ({
      page: () => { // a leaf lifted, flapping over, laid down: three rustles and a soft slap
        burst(1800, 0.18, 0.32, { sweep: 2.4 }); burst(3200, 0.12, 0.22, { type: 'highpass', at: 0.12 });
        burst(2400, 0.22, 0.28, { sweep: 0.5, at: 0.2 }); burst(500, 0.06, 0.25, { type: 'lowpass', at: 0.4 });
      },
      card: () => { // a sheet of vellum unrolled: a dry crackle along it
        for (let k = 0; k < 5; k += 1) burst(1600 + k * 500, 0.09, 0.22, { at: k * 0.05 });
        burst(900, 0.25, 0.18, { sweep: 2, at: 0.05 });
      },
      seal: () => { // the wax snaps, its pieces fall, then the letter opens
        burst(3000, 0.04, 0.45, { type: 'highpass' }); burst(250, 0.1, 0.4, { type: 'lowpass', at: 0.02 });
        burst(5000, 0.02, 0.18, { type: 'highpass', at: 0.09 }); burst(4200, 0.02, 0.14, { type: 'highpass', at: 0.16 });
        for (let k = 0; k < 4; k += 1) burst(1600 + k * 400, 0.08, 0.18, { at: 0.3 + k * 0.05 });
      },
      door: () => { // a long creak of hinges, then the heavy door shuts
        tone(230, 150, 1.1, 0.16, { type: 'sawtooth', filter: 520, vibrato: 9 });
        tone(460, 300, 1.1, 0.06, { type: 'sawtooth', filter: 900, vibrato: 7 });
        burst(110, 0.45, 0.6, { type: 'lowpass', at: 1.05, echo: true }); burst(700, 0.08, 0.2, { at: 1.05 });
      },
      purr: () => { // a cat's purr: low noise, pulsing twenty-five times a second, for a few seconds
        const g = ac.createGain(); g.gain.value = 0; const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; const t = t0();
        const lfo = ac.createOscillator(); lfo.frequency.value = 25; const depth = ac.createGain(); depth.gain.value = 0.05;
        lfo.connect(depth).connect(g.gain); g.gain.setValueAtTime(0.05, t);
        src.connect(f).connect(g).connect(out(false)); src.start(t); lfo.start(t); src.stop(t + 3.4); lfo.stop(t + 3.4);
      },
      neigh: () => { // rising, then the long shaking fall
        tone(700, 1150, 0.35, 0.05, { type: 'sawtooth', filter: 1400, vibrato: 11, pan });
        tone(1150, 520, 0.7, 0.045, { type: 'sawtooth', filter: 1100, vibrato: 13, at: 0.35, pan });
      },
      meow: () => { tone(520, 760, 0.25, 0.05, { type: 'triangle', filter: 900, pan }); tone(760, 480, 0.35, 0.045, { type: 'triangle', filter: 900, at: 0.25, pan }); },
      owl: () => { tone(420, 380, 0.35, 0.06, { pan }); tone(400, 360, 0.6, 0.06, { at: 0.55, pan }); },
      thunder: () => thunder(o.km ?? 2, o.delay ?? 0, pan, outW),
      steps: () => steps(o.floor || 'stone', o.n, pan),
      crackle: () => { for (let k = 0; k < 12; k += 1) burst(1200 + Math.random() * 3500, 0.03, 0.18, { at: k * 0.05 + Math.random() * 0.04 }); burst(250, 0.5, 0.15, { type: 'lowpass', sweep: 1.8 }); }, // a log caught
      skip: () => { // the stone's touches, quicker and closer, then the plunk
        let at = 0.25; const n = o.n || 4; // (the touches' times as hours.js's skim draws them)
        for (let k = 0; k < n; k += 1) { tone(900 - k * 40, 500, 0.05, 0.05 * (1 - k * 0.08), { at, pan }); burst(3000, 0.04, 0.05, { at, pan }); at += 0.25 * 0.85 ** (k + 1); }
        tone(260, 120, 0.18, 0.06, { at, pan }); burst(700, 0.25, 0.05, { at, pan });
      },
      boom: () => { burst(70, 1.6, 0.4, { type: 'lowpass' }); for (let k = 0; k < 8; k += 1) burst(3000 + Math.random() * 3000, 0.03, 0.05, { type: 'highpass', at: 0.3 + Math.random() * 0.8 }); },
      bell,
    }[name] || (() => {}))();
  }

  window.Sound = {
    start(getState) {
      state = getState || state;
      if (!ac) {
        ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
        dry = ac.createGain(); dry.connect(master);
        wet = ac.createGain(); wet.gain.value = 0.55; wet.connect(master); // (and through the room's echo: useVerb)
        noise = noiseBuffer();
        chantBus = ac.createGain(); chantBus.gain.value = 0; chantPan = ac.createStereoPanner(); const cd = ac.createGain(); cd.gain.value = 0.35;
        chantBus.connect(chantPan); chantPan.connect(wet); chantPan.connect(cd).connect(dry); // (mostly the echo: heard through the nave's door)
        beds.fire = bed('lowpass', 500, 0.5); beds.wind = bed('bandpass', 500, 0.8); beds.rain = bed('bandpass', 1800, 0.4);
        beds.river = bed('bandpass', 900, 1.6); beds.crowd = bed('bandpass', 420, 0.7); // (the market's murmur)
        RECORDED.forEach((n) => fetch(new URL(`${n}.mp3`, SND)).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b))
          .then((buf) => { takes[n] = buf; }).catch(() => {})); // (the synthesised sound stays if a file fails)
      }
      ac.resume(); askBells();
      clearInterval(timer); timer = setInterval(tick, 250); tick();
    },
    stop() { if (!ac) return; set(master.gain, 0, 0.2); clearInterval(timer); setTimeout(() => ac.suspend(), 600); },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (ac) set(master.gain, volume * 0.55, 0.2); },
    setMusic(on) { music = on; },
    /** Play tune `id` now (the music command), then the hour's music again; false if there is none such. */
    play(id) {
      return askTunes().then((list) => {
        const tune = (list || []).find((q) => q.id === id); if (!tune || !ac) return false;
        playing = { tune, t0: t0() + 0.3, i: 0 }; return true;
      });
    },
    /** Another tune for the hour than the one playing, at once; its title, or null. */
    next() {
      return askTunes().then((list) => {
        if (!list || !ac) return null;
        const was = playing && playing.tune;
        const tune = pickTune(state(), was) || list.filter((q) => q !== was)[Math.floor(Math.random() * (list.length - (was ? 1 : 0)))];
        playing = { tune, t0: t0() + 0.3, i: 0 }; return tune;
      });
    },
    /** Back to the lute's own air, for two minutes before a tune may come again. */
    air() { if (ac) { playing = null; airUntil = t0() + 120; } },
    /** The real tune being played, if any: {title, composer, year}. */
    now() {
      if (chanting) return { title: chanting.title, composer: `Gregorian chant, the chapel's ${chanting.office}`, year: '' };
      return playing ? { title: playing.tune.title, composer: playing.tune.composer, year: playing.tune.year } : null;
    },
    bell,
    cue,
  };
}());
