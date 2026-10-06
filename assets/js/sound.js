'use strict';

/* ---- ambient sound for the hours theme, synthesised (no audio files), off by default ----
   Fire crackle always; wind with the real wind; rain and thunder with the real weather; birds
   by day, an owl at night, crickets on summer nights; the bell at each planetary hour.
   Muffled indoors. state() (script.js) says what the page shows. */

(function () {
  let ac = null; let master; let noise; let timer = 0; let state = () => ({});
  const beds = {}; // continuous layers: fire, wind, rain

  function noiseBuffer() {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return b;
  }
  /** A looping noise through a filter, its gain set later (0..1). */
  function bed(type, freq, q) {
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master); src.start();
    return { f, g };
  }
  const set = (p, v, tc = 0.8) => p.setTargetAtTime(v, ac.currentTime, tc);

  /** A short burst of filtered noise: a crackle, a raindrop, thunder. */
  function burst(freq, dur, vol, type = 'bandpass') {
    const src = ac.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.5 + Math.random();
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 1.2;
    const g = ac.createGain(); const t = ac.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  /** A tone gliding from f0 to f1: a chirp, a hoot. */
  function tone(f0, f1, dur, vol, at = 0, type = 'sine') {
    const o = ac.createOscillator(); o.type = type; const g = ac.createGain(); const t = ac.currentTime + at;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function bell() { // a bronze bell: inharmonic partials, a long decay
    if (!ac) return;
    [[1, 0.22], [2, 0.12], [2.4, 0.09], [3, 0.06], [4.2, 0.04], [5.4, 0.02]].forEach(([r, v]) => {
      const o = ac.createOscillator(); const g = ac.createGain(); const t = ac.currentTime;
      o.frequency.value = 220 * r; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 5 / r ** 0.3);
      o.connect(g).connect(master); o.start(t); o.stop(t + 6);
    });
  }

  function tick() { // every 250 ms: the beds follow the page; events now and then
    const s = state(); const wx = s.wx || {}; const wet = { drizzle: 0.3, showers: 0.6, rain: 0.8, storm: 1 }[wx.kind] || 0;
    const room = s.inside ? 0.35 : 1; const out = s.inside ? 0.15 : 1; // indoors: the fire nearer, the weather muffled
    set(master.gain, s.on ? 0.5 : 0, 0.4);
    set(beds.fire.g.gain, 0.05 * room);
    set(beds.wind.g.gain, Math.min(0.12, (wx.wind || 0) / 250) * out); set(beds.wind.f.frequency, 300 + Math.random() * 500, 2);
    set(beds.rain.g.gain, 0.16 * wet * out);
    if (!s.on) return;
    if (Math.random() < 0.5) burst(1500 + Math.random() * 3000, 0.02 + Math.random() * 0.04, 0.12 * room); // the fire crackles
    if (wx.kind === 'storm' && Math.random() < 0.012) burst(90, 3, 0.5 * out, 'lowpass'); // thunder far off
    if (s.inside) return;
    if (!s.night && wx.kind !== 'storm' && wet < 0.7 && Math.random() < 0.03) { // a bird: two or three quick chirps
      const f = 2500 + Math.random() * 2000; for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k += 1) tone(f, f * 1.4, 0.07, 0.04, k * 0.12);
    }
    if (s.night && Math.random() < 0.006) { tone(420, 380, 0.35, 0.06); tone(400, 360, 0.6, 0.06, 0.55); } // the owl: hoo... hoooo
    if (s.night && s.summer && Math.random() < 0.3) for (let k = 0; k < 3; k += 1) tone(4400, 4300, 0.03, 0.012, k * 0.05, 'square'); // crickets
  }

  window.Sound = {
    start(getState) {
      state = getState || state;
      if (!ac) {
        ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
        noise = noiseBuffer();
        beds.fire = bed('lowpass', 500, 0.5); beds.wind = bed('bandpass', 500, 0.8); beds.rain = bed('bandpass', 1800, 0.4);
      }
      ac.resume();
      clearInterval(timer); timer = setInterval(tick, 250); tick();
    },
    stop() { if (!ac) return; set(master.gain, 0, 0.2); clearInterval(timer); setTimeout(() => ac.suspend(), 600); },
    bell,
  };
}());
