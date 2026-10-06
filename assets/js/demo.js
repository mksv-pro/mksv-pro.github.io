'use strict';

/* ---- live demos: a 1-bit canvas driven by a simulation ------------------ */

/** Run `sim` in the <figure data-demo> `fig`. `sim` owns a Uint8Array `mask` (1 = ink) of the
 *  canvas size and provides frame() -> bool (false once finished), reset(), readout() -> string,
 *  and a `done` flag. Autoplays while visible unless the reader prefers reduced motion. */
window.Demo = function Demo(fig, sim) {
  const canvas = fig.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const runBtn = fig.querySelector('[data-act="run"]');
  const out = fig.querySelector('.demo-read');
  let wanted = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = false;
  let raf = 0;
  let ink;

  // the figure's own colours (--demo-bg, --demo-ink: the hours theme's blueprint sets them),
  // else the theme's panel and accent
  const rgbOf = (...props) => {
    const cs = getComputedStyle(fig);
    const h = props.map((p) => cs.getPropertyValue(p).trim()).find((v) => /^#[0-9a-f]{6}$/i.test(v));
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  function palette() { ink = [rgbOf('--demo-bg', '--panel'), rgbOf('--demo-ink', '--accent')]; }

  function paint() {
    const d = img.data;
    const m = sim.mask;
    for (let i = 0, j = 0; i < m.length; i += 1, j += 4) {
      const c = ink[m[i] ? 1 : 0];
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    out.textContent = sim.readout();
  }

  function label() { runBtn.textContent = wanted && !sim.done ? fig.dataset.pause : fig.dataset.run; }

  function loop() {
    raf = 0;
    if (!(wanted && visible)) return;
    const more = sim.frame();
    paint();
    if (!more) { wanted = false; label(); return; }
    raf = requestAnimationFrame(loop);
  }
  function sync() {
    label();
    if (wanted && visible && !raf) raf = requestAnimationFrame(loop);
  }

  runBtn.addEventListener('click', () => {
    if (sim.done) { sim.reset(); wanted = true; } else wanted = !wanted;
    sync();
  });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }).observe(canvas);
  new MutationObserver(() => { palette(); paint(); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-sky', 'data-room'] });

  palette();
  paint();
  sync();
  return {
    restart() { sim.reset(); paint(); wanted = true; sync(); },
    paint,
  };
};
