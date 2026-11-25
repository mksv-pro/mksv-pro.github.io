'use strict';

/* ---- armillary sphere: the sky over Paris, now (over the plate) --------
   Turns only while it can be seen (on screen, tab shown, not hidden by the hours theme). */

const armillary = $('armillary');
if (armillary) {
  const canvas = armillary.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const N = canvas.width;
  const img = ctx.createImageData(N, N);
  const buf = new Uint8Array(N * N); // 0 ground, 1 ink, 2 accent
  const R = N / 2 - 4;
  const PITCH = 0.42; // camera above the horizon plane, radians
  let yaw = 2.2;
  let spinning = !reduceMotion;
  let sky = skyAt(new Date());
  let last = 0;
  let shown = false; // on screen and the tab visible
  let raf = 0;
  let pal = null; // [ground, ink, accent], read again when the theme or the sky changes

  const project = ([x, y, z]) => {
    const c = Math.cos(yaw); const s = Math.sin(yaw);
    const xr = x * c - y * s; const yr = x * s + y * c;
    return [N / 2 + xr * R, N / 2 - (yr * Math.sin(PITCH) + z * Math.cos(PITCH)) * R,
      yr * Math.cos(PITCH) - z * Math.sin(PITCH)]; // last: depth, > 0 behind the centre
  };
  const plot = (x, y, v) => {
    if (x >= 0 && x < N && y >= 0 && y < N) buf[y * N + x] = Math.max(buf[y * N + x], v);
  };
  function line(a, b, bold) {
    let [x0, y0] = [Math.round(a[0]), Math.round(a[1])];
    const [x1, y1] = [Math.round(b[0]), Math.round(b[1])];
    const back = a[2] + b[2] > 0;
    const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!back || (x0 + y0) % 3 === 0) { // the far half dotted, so the sphere reads as solid
        plot(x0, y0, 1);
        if (bold && !back) plot(x0, y0 + 1, 1);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function disc(v, r, fill) {
    const [cx, cy] = project(v).map(Math.round);
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        const q = x * x + y * y;
        if (q <= r * r + r && (fill || q >= (r - 1) * (r - 1) + r - 1)) plot(cx + x, cy + y, 2);
      }
    }
  }
  function draw() {
    buf.fill(0);
    sky.rings.forEach(({ pts, bold }) => {
      const p = pts.map(project);
      for (let i = 1; i < p.length; i += 1) line(p[i - 1], p[i], bold);
    });
    disc(sky.sun, 3, true);
    disc(sky.moon, 2, false);
    pal ||= [tokenRGB('--bg'), tokenRGB('--ink'), tokenRGB('--accent')];
    for (let i = 0, j = 0; i < buf.length; i += 1, j += 4) {
      const c = pal[buf[i]];
      img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  function frame(t) {
    raf = 0;
    if (!(spinning && shown)) return;
    if (t - last > 66) { // ~15 frames a second is plenty for one turn a minute
      yaw += (Math.min(t - last, 1000) / 60000) * 2 * Math.PI;
      last = t;
      draw();
    }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (spinning && shown && !raf) raf = requestAnimationFrame((t) => { last = t; frame(t); });
  }
  armillary.addEventListener('click', () => {
    spinning = !spinning;
    armillary.setAttribute('aria-pressed', String(!spinning));
    sync();
  });
  let onScreen = false;
  const update = () => { shown = onScreen && !document.hidden; sync(); };
  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; update(); }).observe(canvas);
  document.addEventListener('visibilitychange', update);
  setInterval(() => { sky = skyAt(new Date()); if (!(spinning && shown)) draw(); }, 60000);
  new MutationObserver(() => { pal = null; draw(); }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-sky'] });
  draw();
}
