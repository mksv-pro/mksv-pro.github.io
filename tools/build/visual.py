"""Visual regression: the castle drawn in fixed states, compared pixel by pixel with the references.

  python3 tools/build/visual.py            compare every case; the differences in .smoke/visual/
  python3 tools/build/visual.py about      the cases whose name contains "about"
  python3 tools/build/visual.py --update   take the pictures as the new references (tests/visual/)
  python3 tools/build/visual.py --query=&gl=0   with more in the query (here: the 2D canvas, no graphics card)

Each case loads the page in headless Firefox with everything that varies held still: Math.random
seeded, the instant fixed (?at=), the weather set, no request to another site, motion reduced (one
frame drawn), the graphics card's effects off (fx=0: exact on any GPU). The picture compared is the
castle's own, at its pixel size (Hours.picture(): the landscape, and the room over it), so a
reference is a small PNG. The comparison runs in the page: a pixel differs when its YIQ distance
passes 0.1 of the maximum (pixelmatch's measure); a case fails when more than 0.5% of its pixels
differ (the fires step a little differently run to run: ~100 px), and its picture of the difference
is saved, the changed pixels red over a faded copy. Stdlib only (smoke.py serves and drives the
browser).
"""
import base64
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import smoke  # noqa: E402

ROOT = smoke.ROOT
REF = ROOT / "tests" / "visual"
OUT = ROOT / ".smoke" / "visual"
AT = "2026-06-21T10:00:00Z"
STILL = f"&at={AT}&weather=clear&visual"  # (&visual: then &fx=0, see main)
ROOMS = ("about", "experience", "work", "publications", "talks", "teaching", "news", "contact", "cellar", "maproom")
# name: (query and hash, window size)
CASES = {
    "landscape-1920": (f"?theme=hours{STILL}", (1920, 1080)),
    "landscape-1280": (f"?theme=hours{STILL}", (1280, 800)),
    "landscape-night": ("?theme=hours&at=2026-06-21T22:30:00Z&weather=clear&visual", (1920, 1080)),
    "landscape-snow": ("?theme=hours&at=2026-01-10T11:00:00Z&weather=snow&snowDepth=0.2&visual", (1920, 1080)),
    **{f"room-{r}": (f"?theme=hours{STILL}#{r}", (1920, 1080)) for r in ROOMS},
}
# before any script: a seeded Math.random (mulberry32), no fetch to other sites
SEED = """<script>(() => { let a = 20261013; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f0 = fetch; window.fetch = (u, o) => (/^(data|blob):/.test(String(u)) || new URL(u, location.href).origin === location.origin ? f0(u, o) : Promise.reject(new Error('offline: visual test')));
})();</script>"""
COMPARE = """await wait(3500); const url = Hours.picture(); const cur = await createImageBitmap(await (await fetch(url)).blob());
const cv = new OffscreenCanvas(cur.width, cur.height); const g = cv.getContext('2d'); g.drawImage(cur, 0, 0); const A = g.getImageData(0, 0, cur.width, cur.height).data;
let ref = null; try { const r = await fetch('/__ref/%NAME%.png', { cache: 'no-store' }); if (r.ok) ref = await createImageBitmap(await r.blob()); } catch (e) { ref = null; }
const out = { w: cur.width, h: cur.height, png: url, diff: -1 };
if (ref && ref.width === cur.width && ref.height === cur.height) {
  const c2 = new OffscreenCanvas(ref.width, ref.height); const g2 = c2.getContext('2d'); g2.drawImage(ref, 0, 0); const B = g2.getImageData(0, 0, ref.width, ref.height).data;
  const D = new ImageData(cur.width, cur.height); let n = 0; const MAX = 35215 * 0.01; // (0.1 of the YIQ range, squared)
  for (let i = 0; i < A.length; i += 4) {
    const dr = A[i] - B[i]; const dg = A[i + 1] - B[i + 1]; const db = A[i + 2] - B[i + 2];
    const y = dr * 0.29889531 + dg * 0.58662247 + db * 0.11448223; const ii = dr * 0.59597799 - dg * 0.2741761 - db * 0.32180189; const q = dr * 0.21147017 - dg * 0.52261711 + db * 0.31114694;
    const d = 0.5053 * y * y + 0.299 * ii * ii + 0.1957 * q * q; const l = 255 - 0.75 * (255 - (A[i] + A[i + 1] + A[i + 2]) / 3);
    if (d > MAX) { n += 1; D.data.set([255, 0, 0, 255], i); } else D.data.set([l, l, l, 255], i);
  }
  out.diff = n; const c3 = new OffscreenCanvas(cur.width, cur.height); c3.getContext('2d').putImageData(D, 0, 0);
  const rd = new FileReader(); out.diffPng = await new Promise(async (res) => { rd.onload = () => res(rd.result); rd.readAsDataURL(await c3.convertToBlob()); });
} else out.why = ref ? `the reference is ${ref.width}x${ref.height}` : 'no reference';
window.visualOut = out; await fetch('/__visual/%NAME%', { method: 'POST', body: JSON.stringify(out) });"""
pictures = {}


class Handler(smoke.Handler):
    def do_POST(self):
        if self.path.startswith("/__visual/"):
            pictures[self.path.rsplit("/", 1)[-1]] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            self.send_response(204)
            self.end_headers()
            return
        super().do_POST()

    def do_GET(self):  # the references, from tests/visual/ (not served with the site)
        if self.path.startswith("/__ref/"):
            f = REF / Path(self.path.split("?")[0]).name
            body = f.read_bytes() if f.is_file() else b""
            self.send_response(200 if body else 404)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def save_png(data_url, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(base64.b64decode(data_url.split(",", 1)[1]))


def main(only="", update=False, extra=""):
    # the drawing itself, without the graphics card's effects (fx=0): those are a shader's, whose last bits
    # vary with the GPU and its driver (CI renders in software); with them off the output is exact
    smoke.CASES = {n: (q.replace("&visual", f"&visual&fx=0{extra}"), size, COMPARE.replace("%NAME%", n), "!!window.visualOut") for n, (q, size) in CASES.items() if only in n}
    smoke.PROBE = SEED + smoke.PROBE
    smoke.Handler = Handler
    smoke.PREFS = 'user_pref("ui.prefersReducedMotion", 1);\n'
    try:
        smoke.main("")
    except SystemExit as e:  # (smoke reports its own failures: JS errors, a case that never finished)
        if e.code:
            print(e.code)
    failed = []
    for name in smoke.CASES:
        p = pictures.get(name)
        if not p:
            failed.append(name)
            print(f"  FAIL {name}: no picture")
            continue
        if update:
            save_png(p["png"], REF / f"{name}.png")
            print(f"  ref  {name}: {p['w']}x{p['h']}")
            continue
        save_png(p["png"], OUT / f"{name}.png")
        if p.get("diffPng") and p["diff"] > 0:
            save_png(p["diffPng"], OUT / f"{name}-diff.png")
        share = p["diff"] / (p["w"] * p["h"]) if p["diff"] >= 0 else 1
        if p["diff"] < 0 or share > 0.005:
            failed.append(name)
            print(f"  FAIL {name}: " + (p.get("why") or f"{p['diff']} pixels differ ({100 * share:.2f}%)"))
        else:
            print(f"  ok   {name}" + (f" ({p['diff']} px)" if p["diff"] else ""))
    if failed:
        sys.exit(f"{len(failed)} visual case(s) differ: {', '.join(failed)} (pictures in .smoke/visual/; --update if intended)")
    print("all pictures as the references" if not update else f"{len(smoke.CASES)} references written to tests/visual/")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    extra = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--query=")), "")  # (e.g. --query=&gl=0: the same pictures through the 2D canvas)
    main(args[0] if args else "", "--update" in sys.argv, extra)
