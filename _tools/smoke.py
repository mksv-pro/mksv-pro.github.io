"""Smoke test of the live page in headless Firefox: each case loads the site in some state (a sky,
a room, a close-up, the descent, a phone), runs a few steps, and reports back what went wrong.

  python3 _tools/smoke.py            all cases; screenshots in _smoke/ (gitignored)
  python3 _tools/smoke.py tower      the cases whose name contains "tower"

A small server serves the site and injects, into each HTML page, a script that collects errors
and unhandled rejections, then, after the case's steps, checks the page (the castle's canvas is
drawn and not blank; the state asked for was reached) and posts the result back. Not a pixel
comparison: the sky is the real one and much of the landscape is random; the screenshots are
there to be looked at. Needs firefox on the PATH.
"""
import http.server
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_smoke"
# name: (query and hash, window size, steps (JS, awaited), the check (a JS expression, true if fine))
CANVAS = "(() => { const c = document.querySelector('.plate-img canvas'); if (!c || !c.width) return false;" \
         " const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0;" \
         " for (let i = 0; i < d.length; i += 4 * 97) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); } return mx - mn > 40; })()"
CASES = {
    "hours-noon": ("?theme=hours&sky=noon&weather=clear", (1600, 900), "", CANVAS),
    "hours-night-rain": ("?theme=hours&sky=night&weather=rain&rain7=60", (1600, 900), "", CANVAS),
    "hours-winter-frost": ("?theme=hours&sky=dawn&weather=snow&date=01-10&frost=-6", (1600, 900), "", CANVAS),
    "room-research": ("?theme=hours&sky=noon&weather=clear#research", (1600, 900), "await wait(2500);",
                      CANVAS + " && document.documentElement.classList.contains('room-ready')"),
    "room-teaching": ("?theme=hours&sky=noon&weather=clear#teaching", (1600, 900), "await wait(2500);", CANVAS),
    "card-publication": ("?theme=hours&sky=noon&weather=clear#publications", (1600, 900),
                         "await wait(2500); const b = [...document.querySelectorAll('.spot')].find((x) => /Emulation/i.test(x.dataset.label)); b && b.click(); await wait(1200);",
                         "!document.querySelector('.card').hidden && !!document.querySelector('.card .pub-fig canvas')"),
    "village": ("?theme=hours&sky=noon&weather=clear&date=10-10", (1600, 900), "run('village'); await wait(1500);",
                "document.documentElement.classList.contains('village')"),
    "tower": ("?theme=hours&sky=dusk&weather=clear", (1600, 900),
              "run('tower'); await wait(900); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await wait(800);",
              "document.documentElement.classList.contains('lookout') && " + CANVAS),
    "descent": ("?theme=hours&sky=noon&weather=clear", (1600, 900), "descend(); await wait(1200);",
                "!!document.querySelector('dialog.dungeon[open]')"),
    # (the framed copy gets the probe too: it never reports, the top page does)
    "engine": ("?theme=hours&sky=noon&weather=clear", (1600, 900),
               "if (window !== top) await new Promise(() => {}); enterEngine(); await wait(5000);"
               " const f = document.querySelector('.engine-win iframe'); const d = f && f.contentDocument;"
               " window.framedOk = !!d && d.documentElement.getAttribute('data-theme') === 'dark' && d.documentElement.classList.contains('framed');"
               " d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(2500);",
               "window.framedOk && !document.querySelector('.engine') && !document.documentElement.classList.contains('engine-on')"),
    "music-help": ("?theme=hours&sky=noon&weather=clear", (1600, 900),  # (the help, then the book of tunes on the command line)
                   "await wait(1000); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); showHelp(); await wait(300);"
                   " const ok = !!document.querySelector('dialog.is-help .help'); dialog.close(); openCmd(); run('music list'); await wait(1500); window.helpOk = ok;",
                   "window.helpOk && document.querySelectorAll('.cmd-out .tunes b').length >= 10"),
    "cellar": ("?theme=hours&sky=noon&weather=clear", (1600, 900),  # (the door in the rock, the cellar, its steps down)
               "await wait(1000); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); location.hash = '#cellar'; await wait(2800);"
               " window.inCellar = document.documentElement.dataset.room === 'cellar' && document.documentElement.classList.contains('room-ready');"
               " const b = [...document.querySelectorAll('.spot')].find((x) => /steps/i.test(x.dataset.label)); b && b.click(); await wait(1500);",
               "window.inCellar && !!document.querySelector('dialog.dungeon[open]')"),
    "room-to-banner": ("?theme=hours&sky=noon&weather=clear#teaching", (1600, 900),  # (a room, then the window turns upright: the banner shows the landscape)
                       "await wait(2500); document.documentElement.classList.add('banner'); document.documentElement.setAttribute('data-theme', 'dark'); await wait(800);",
                       "/^Pixel-art landscape/.test(document.querySelector('.plate-img').getAttribute('aria-label')) && " + CANVAS),
    "terminal": ("?theme=dark", (1600, 900), "", "document.documentElement.getAttribute('data-theme') === 'dark'"),
    # a bare visit: the front gate asks how; the castle's choice lifts it; a section's link skips it
    "gate": ("", (1920, 1080), "await wait(1500);", "document.documentElement.classList.contains('gated') && !!document.querySelector('#gate canvas')"),
    "gate-castle": ("", (1920, 1080), "await wait(800); document.querySelector('[data-gate=castle]').click(); await wait(1500);", "!document.documentElement.classList.contains('gated') && !document.getElementById('gate')"),
    "gate-deeplink": ("#research", (1920, 1080), "await wait(800);", "!document.documentElement.classList.contains('gated')"),
    "phone-banner": ("?theme=dark&sky=noon&weather=clear", (390, 844), "", "document.documentElement.classList.contains('banner') && " + CANVAS),
    "narrow-window": ("?sky=noon&weather=clear", (1100, 800), "",  # (a computer: the terminal, the landscape over the engraving)
                      "document.documentElement.getAttribute('data-theme') === 'dark' && document.documentElement.classList.contains('banner') && " + CANVAS),
    "phone-tower": ("?touch=1&sky=noon&weather=clear", (390, 844),  # (the live picture in the frame in sight; reading on leaves it there)
                    "document.querySelector('#research').scrollIntoView({ behavior: 'instant' }); await wait(2500); window.scrollBy(0, 300); await wait(600);",
                    "document.documentElement.classList.contains('climb') && document.documentElement.dataset.room === 'research'"
                    " && !!document.querySelector('#research > .floor-slot > .plate') && " + CANVAS),
    "phone-side": ("?touch=1&sky=noon&weather=clear", (844, 390),
                   "document.querySelector('#research').scrollIntoView({ behavior: 'instant' }); await wait(2500);",
                   "document.documentElement.classList.contains('side') && document.documentElement.dataset.room === 'research' && " + CANVAS),
    "phone-cellar": ("?touch=1&sky=noon&weather=clear", (390, 844),
                     "document.querySelector('#cellar').scrollIntoView({ behavior: 'instant' }); await wait(2500);"
                     " const b = [...document.querySelectorAll('.spot')].find((x) => /steps/i.test(x.dataset.label)); b && b.click(); await wait(1500);",
                     "document.documentElement.dataset.room === 'cellar' && !!document.querySelector('dialog.dungeon[open]')"),
    "phone-engine": ("?touch=1&sky=noon&weather=clear", (390, 844),
                     "if (window !== top) await new Promise(() => {}); await wait(1500); document.getElementById('theme-toggle').click(); await wait(6000);",
                     "!!document.querySelector('.engine-win iframe') && document.documentElement.dataset.room === 'about'"),
}
PROBE = """<script>(() => {
  const errs = []; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  addEventListener('error', (e) => errs.push(`${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => errs.push(`rejection: ${e.reason}`));
  addEventListener('DOMContentLoaded', () => setTimeout(async () => {
    let ok = false;
    try { await (async () => { %STEPS% })(); ok = Boolean(%CHECK%); } catch (e) { errs.push(`case: ${e}`); }
    fetch('/__smoke/%NAME%', { method: 'POST', body: JSON.stringify({ errs, ok }) });
  }, 2000));
})();</script>"""
# firefox --screenshot shoots at the load event and quits: a slow image holds the event back while the case runs
HOLD = '<img src="/__hold" alt="" style="position:fixed;width:1px">'
GIF = bytes.fromhex("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b")

results = {}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass

    def do_POST(self):
        name = self.path.rsplit("/", 1)[-1]
        results[name] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]
        if path == "/__hold": # until the case has reported (or 12 s)
            t0 = time.time()
            while self.server.case not in results and time.time() - t0 < 12:
                time.sleep(0.1)
            time.sleep(0.4) # (the screenshot then shows the state reached)
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.end_headers()
            self.wfile.write(GIF)
            return None
        if path.endswith(".html") or path.endswith("/"):
            case = self.server.case
            q, _, steps, check = CASES[case]
            f = ROOT / (path.lstrip("/") or "index.html")
            if f.is_dir():
                f = f / "index.html"
            html = f.read_text()
            probe = PROBE.replace("%STEPS%", steps).replace("%CHECK%", check).replace("%NAME%", case)
            body = html.replace("<head>", "<head>" + probe, 1).replace("</body>", HOLD + "</body>", 1).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return None
        return super().do_GET()


def main(only=""):
    if not shutil.which("firefox"):
        sys.exit("firefox not found")
    OUT.mkdir(exist_ok=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    failed = []
    for name, (q, (w, h), _, _) in CASES.items():
        if only not in name:
            continue
        srv.case = name
        url = f"http://127.0.0.1:{port}/index.html{q}"
        with tempfile.TemporaryDirectory() as prof:
            Path(prof, "user.js").write_text('user_pref("ui.prefersReducedMotion", 0);\n')
            subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof, f"--window-size={w},{h}",
                            "--screenshot", str(OUT / f"{name}.png"), url],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        t0 = time.time()
        while name not in results and time.time() - t0 < 15:
            time.sleep(0.2)
        r = results.get(name, {"errs": ["no report (the page never finished)"], "ok": False})
        good = r["ok"] and not r["errs"]
        print(f"  {'ok  ' if good else 'FAIL'} {name}" + ("" if good else f": {'; '.join(r['errs']) or 'check failed'}"))
        if not good:
            failed.append(name)
    srv.shutdown()
    if failed:
        sys.exit(f"{len(failed)} case(s) failed: {', '.join(failed)}")
    print("all smoke cases passed")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
