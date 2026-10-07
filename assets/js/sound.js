'use strict';

/* ---- sound for the hours theme, synthesised (no audio files), off by default --------------
   Outside: fire, wind and rain from the real weather, thunder, the river, the mill creaking in
   the wind, birds and ducks by day, an owl and (in summer) crickets by night, the bell at each
   planetary hour. Inside: each room its own sound, an echo in the stone ones, the weather
   muffled. A soft lute air, composed as it plays (Dorian by day, Aeolian and sparser by night).
   cue(name): the page's events (a page turned, a seal broken, a door, a horse...).
   state() (script.js) says what the page shows; setVolume(0..1), setMusic(bool). */

(function () {
  // recorded foley for the interface (_tools/sounds.py: Kenney's RPG Audio, CC0, treated to match)
  const SND = new URL('../snd/', document.currentScript.src);
  const RECORDED = ['door', 'card', 'seal', 'page', 'close']; const takes = {};
  let ac = null; let master; let dry; let wet; let noise; let timer = 0; let state = () => ({});
  let volume = 0.6; let music = true;
  const beds = {}; // continuous layers: fire, wind, rain, river, forge
  const t0 = () => ac.currentTime;

  function noiseBuffer() {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function reverb(seconds) { // a hall's echo: decaying noise as the impulse response
    const n = Math.round(ac.sampleRate * seconds); const b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c += 1) { const d = b.getChannelData(c); for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2.6; }
    const cv = ac.createConvolver(); cv.buffer = b; return cv;
  }
  /** A looping noise through a filter, its gain set later (0..1). */
  function bed(type, freq, q) {
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(dry); src.start();
    return { f, g };
  }
  const set = (p, v, tc = 0.8) => p.setTargetAtTime(v, t0(), tc);
  const out = (echo) => (echo && state().echo ? wet : dry);

  /** A short burst of filtered noise: a crackle, a rustle, thunder, a footstep. */
  function burst(freq, dur, vol, { type = 'bandpass', q = 1.2, at = 0, sweep = 0, echo = false } = {}) {
    const src = ac.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.5 + Math.random();
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; const g = ac.createGain(); const t = t0() + at;
    f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 5)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out(echo)); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  /** A tone gliding from f0 to f1: a chirp, a hoot, a caw, a neigh. */
  function tone(f0, f1, dur, vol, { at = 0, type = 'sine', vibrato = 0, filter = 0, echo = false } = {}) {
    const o = ac.createOscillator(); o.type = type; const g = ac.createGain(); const t = t0() + at;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vibrato) { const l = ac.createOscillator(); const lg = ac.createGain(); l.frequency.value = vibrato; lg.gain.value = f0 * 0.04; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filter) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filter; f.Q.value = 2; node = node.connect(f); }
    node.connect(out(echo)); o.start(t); o.stop(t + dur + 0.05);
  }
  function chime(freqs, vol, decay, echo = true, at = 0) { // metal or glass: inharmonic partials ringing out
    freqs.forEach((f, k) => {
      const o = ac.createOscillator(); const g = ac.createGain(); const t = t0() + at;
      o.frequency.value = f; g.gain.setValueAtTime(vol / (k + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay / (1 + k * 0.3));
      o.connect(g).connect(out(echo)); o.start(t); o.stop(t + decay + 0.1);
    });
  }
  function bell() { // a bronze bell: inharmonic partials, a long decay
    if (!ac) return;
    [[1, 0.22], [2, 0.12], [2.4, 0.09], [3, 0.06], [4.2, 0.04], [5.4, 0.02]].forEach(([r, v]) => {
      const o = ac.createOscillator(); const g = ac.createGain(); const t = t0();
      o.frequency.value = 220 * r; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 5 / r ** 0.3);
      o.connect(g).connect(dry); o.start(t); o.stop(t + 6);
    });
  }

  /* ---- the lute: a plucked tone (triangle + an octave, a closing filter), an air walking the mode */
  const MIDI = (m) => 440 * 2 ** ((m - 69) / 12);
  function pluck(m, at, vol, len) {
    const t = t0() + at; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + len);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    [['triangle', 1, 1], ['sine', 2, 0.25]].forEach(([type, mul, amp]) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = MIDI(m) * mul; const a = ac.createGain(); a.gain.value = amp;
      o.connect(a).connect(f); o.start(t); o.stop(t + len + 0.05);
    });
    f.connect(g); g.connect(wet); g.connect(dry); // a little of the hall's echo on the lute
  }
  const DORIAN = [0, 2, 3, 5, 7, 9, 10]; const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
  const air = { next: 0, deg: 7, left: 0, beat: 0 };
  function compose() { // schedule the air up to half a second ahead
    const s = state(); const night = s.night; const scale = night ? AEOLIAN : DORIAN; const base = night ? 50 : 62; // D3 or D4
    const beat = night ? 60 / 52 : 60 / 66;
    if (air.next < t0()) air.next = t0() + 0.1;
    while (air.next < t0() + 0.5) {
      const at = air.next - t0();
      if (air.left <= 0) { // a phrase: 5 to 9 notes, then a rest; it starts near the tonic or the fifth
        air.left = 5 + Math.floor(Math.random() * 5); air.deg = Math.random() < 0.5 ? 7 : 4;
        air.next += beat * (night ? 3 : 2); continue;
      }
      air.deg = Math.max(0, Math.min(11, air.deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      if (air.left === 1) air.deg = [0, 4, 7][Math.floor(Math.random() * 3)]; // close on the tonic, the fifth or the octave
      const m = base + 12 * Math.floor(air.deg / 7) + scale[air.deg % 7];
      const len = [0.5, 0.5, 1, 1, 1.5][Math.floor(Math.random() * 5)];
      if (!(night && Math.random() < 0.15)) pluck(m, at, night ? 0.05 : 0.065, beat * len * 2.2);
      if (air.beat % 4 === 0) pluck(base - 12 + (Math.random() < 0.7 ? 0 : 7), at, 0.045, beat * 4); // the drone on the downbeat
      air.beat += 1; air.left -= 1; air.next += beat * len;
    }
  }

  /** The chapel's bell: smaller and higher than the castle's, struck `at` seconds from now. */
  function chapelBell(at) {
    [[1, 0.12], [2.1, 0.06], [2.7, 0.05], [3.4, 0.03], [4.9, 0.015]].forEach(([r, v]) => {
      const o = ac.createOscillator(); const g = ac.createGain(); const t = t0() + at;
      o.frequency.value = 660 * r; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5 / r ** 0.4);
      o.connect(g).connect(out(true)); o.start(t); o.stop(t + 5);
    });
  }
  /** The angelus (7 am, noon, 7 pm): three strokes three times, a pause between, then nine. */
  function angelus() {
    let at = 0;
    for (let g = 0; g < 3; g += 1) { for (let k = 0; k < 3; k += 1) { chapelBell(at); at += 2.4; } at += 4; }
    for (let k = 0; k < 9; k += 1) { chapelBell(at); at += 1.6; }
  }
  /** Birds for the season and the hour: a dawn chorus in spring and summer (blackbird, robin,
   *  wren), the cuckoo in spring, the nightingale on May and June nights, a sparrow in winter. */
  function birds(s) {
    const m = s.month; const r = Math.random();
    const blackbird = () => { let f = 1600 + Math.random() * 800; for (let k = 0; k < 4 + Math.floor(Math.random() * 4); k += 1) { const f2 = f * (0.85 + Math.random() * 0.4); tone(f, f2, 0.14, 0.035, { at: k * 0.16 }); f = f2; } };
    const robin = () => { for (let k = 0; k < 6; k += 1) tone(3200 + Math.random() * 2400, 2600 + Math.random() * 3000, 0.07, 0.025, { at: k * 0.09 }); };
    const wren = () => { for (let k = 0; k < 14; k += 1) tone(4200 + (k % 2) * 900, 4400, 0.035, 0.02, { at: k * 0.045 }); };
    if (s.night) { if ((m === 4 || m === 5) && r < 0.05) for (let k = 0; k < 8; k += 1) tone(1800 + (k % 3) * 700, 1500 + (k % 2) * 1600, 0.1, 0.03, { at: k * 0.13 }); return; } // the nightingale
    const spring = m >= 2 && m <= 6; const chorus = s.dawn && spring ? 4 : 1;
    if (m === 11 || m <= 1) { if (r < 0.02) for (let k = 0; k < 3; k += 1) tone(3000, 2600, 0.06, 0.03, { at: k * 0.15 }); return; } // a sparrow
    if (r < 0.012 * chorus) blackbird(); else if (r < 0.022 * chorus) robin(); else if (spring && r < 0.028 * chorus) wren();
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
  }

  function tick() { // every 250 ms: the beds follow the page; events now and then
    const s = state(); const wx = s.wx || {}; const wet0 = { drizzle: 0.3, showers: 0.6, rain: 0.8, storm: 1 }[wx.kind] || 0;
    const inside = Boolean(s.room); const room = inside ? 0.6 : 1; const outW = inside ? 0.12 : 1;
    set(master.gain, s.on ? volume * 0.55 : 0, 0.4);
    set(beds.fire.g.gain, (s.room === 'projects' || s.room === 'workshop' ? 0.12 : 0.05) * room);
    set(beds.wind.g.gain, Math.min(0.12, (wx.wind || 0) / 250) * (s.room === 'research' ? 1.4 : outW)); set(beds.wind.f.frequency, 300 + Math.random() * 500, 2);
    set(beds.rain.g.gain, 0.16 * wet0 * outW);
    set(beds.river.g.gain, inside ? 0 : 0.035); set(beds.river.f.frequency, 700 + Math.random() * 500, 0.6); // the river's murmur
    if (!s.on) return;
    const ak = `${s.day}-${s.hour}`; // the angelus, once, in the minute it is due
    if ([7, 12, 19].includes(s.hour) && s.minute === 0 && ak !== lastAngelus && !inside) { lastAngelus = ak; angelus(); }
    if (s.place === 'tower') { set(beds.wind.g.gain, Math.min(0.2, 0.05 + (wx.wind || 0) / 160)); set(beds.river.g.gain, 0); if (Math.random() < 0.006) tone(2400, 1500, 0.9, 0.035, { vibrato: 12 }); } // up high: the wind, a buzzard
    if (s.place === 'village') {
      set(beds.crowd.g.gain, s.market ? 0.05 : 0); set(beds.river.g.gain, 0.05);
      if (s.market && Math.random() < 0.08) { const f = 180 + Math.random() * 160; tone(f, f * (0.8 + Math.random() * 0.4), 0.18 + Math.random() * 0.2, 0.02, { type: 'sawtooth', filter: 1100 }); } // voices
      if (s.forge && Math.random() < 0.05) [0, 0.4].forEach((at) => chime([1180, 2640, 3910], 0.035, 0.7, true, at)); // the smith's hammer
      if (s.tavern && Math.random() < 0.03) for (let k = 0; k < 3; k += 1) tone(320 + Math.random() * 120, 260, 0.12, 0.02, { type: 'square', filter: 900, at: k * 0.14 }); // laughter at the tavern
    } else set(beds.crowd.g.gain, 0);
    if (music) compose();
    if (Math.random() < 0.5) burst(1500 + Math.random() * 3000, 0.02 + Math.random() * 0.04, 0.12 * room); // the fire crackles
    if (wx.kind === 'storm' && Math.random() < 0.012) burst(90, 3, 0.5 * outW, { type: 'lowpass' }); // thunder far off
    if (inside) { roomSounds(s.room); return; }
    if ((wx.wind || 0) > 6 && Math.random() < Math.min(0.06, wx.wind / 600)) tone(160, 120, 0.7, 0.03, { type: 'sawtooth', filter: 300, vibrato: 7 }); // the mill creaks
    if (wx.kind !== 'storm' && wet0 < 0.7) birds(s);
    if (!s.night && Math.random() < 0.01) for (let k = 0; k < 2; k += 1) tone(420, 360, 0.12, 0.04, { type: 'square', filter: 700, at: k * 0.18 }); // ducks
    if (s.night && Math.random() < 0.006) cue('owl');
    if (s.night && s.summer && Math.random() < 0.3) for (let k = 0; k < 3; k += 1) tone(4400, 4300, 0.03, 0.012, { at: k * 0.05, type: 'square' }); // crickets
  }

  /** A recorded take, a little higher or lower each time so it never repeats exactly. */
  function play(name, vol = 0.65) {
    const src = ac.createBufferSource(); src.buffer = takes[name]; src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = ac.createGain(); g.gain.value = vol; src.connect(g).connect(out(name === 'door')); src.start();
  }

  /** The page's events: a recording when there is one (loaded), else a synthesised sound. */
  function cue(name) {
    if (!ac || !state().on) return;
    if (takes[name]) { play(name); return; }
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
      neigh: () => { // rising, then the long shaking fall
        tone(700, 1150, 0.35, 0.05, { type: 'sawtooth', filter: 1400, vibrato: 11 });
        tone(1150, 520, 0.7, 0.045, { type: 'sawtooth', filter: 1100, vibrato: 13, at: 0.35 });
      },
      meow: () => { tone(520, 760, 0.25, 0.05, { type: 'triangle', filter: 900 }); tone(760, 480, 0.35, 0.045, { type: 'triangle', filter: 900, at: 0.25 }); },
      owl: () => { tone(420, 380, 0.35, 0.06); tone(400, 360, 0.6, 0.06, { at: 0.55 }); },
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
        wet = ac.createGain(); wet.gain.value = 0.55; const rv = reverb(2.6); wet.connect(rv).connect(master); wet.connect(master);
        noise = noiseBuffer();
        beds.fire = bed('lowpass', 500, 0.5); beds.wind = bed('bandpass', 500, 0.8); beds.rain = bed('bandpass', 1800, 0.4);
        beds.river = bed('bandpass', 900, 1.6); beds.crowd = bed('bandpass', 420, 0.7); // (the market's murmur)
        RECORDED.forEach((n) => fetch(new URL(`${n}.mp3`, SND)).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b))
          .then((buf) => { takes[n] = buf; }).catch(() => {})); // (the synthesised sound stays if a file fails)
      }
      ac.resume();
      clearInterval(timer); timer = setInterval(tick, 250); tick();
    },
    stop() { if (!ac) return; set(master.gain, 0, 0.2); clearInterval(timer); setTimeout(() => ac.suspend(), 600); },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (ac) set(master.gain, volume * 0.55, 0.2); },
    setMusic(on) { music = on; },
    bell,
    cue,
  };
}());
