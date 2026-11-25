"""Smoke test of the live page in headless Firefox: each case loads the site in some state (a sky,
a room, a close-up, the descent, a phone), runs a few steps, and reports back what went wrong.

  python3 tools/build/smoke.py            all cases; screenshots in .smoke/ (gitignored)
  python3 tools/build/smoke.py tower      the cases whose name contains "tower"

A small server serves the site and injects, into each HTML page, a script that collects errors
and unhandled rejections, then, after the case's steps, checks the page (the castle's canvas is
drawn and not blank; the state asked for was reached) and posts the result back. Not a pixel
comparison: the sky is the real one and much of the landscape is random; the screenshots are
there to be looked at. Needs firefox on the PATH.
"""
import http.server
import json
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"  # (what is served)
SW_CACHE = re.search(r"const CACHE = '([^']+)'", (PUBLIC / "sw.js").read_text()).group(1)  # (the offline case opens it)
OUT = ROOT / ".smoke"
# name: (query and hash, window size, steps (JS, awaited), the check (a JS expression, true if fine));
# the query and hash are the castle's page's (castle/index.html), unless they start with a page's path
CANVAS = "(() => { const c = document.querySelector('.plate-img canvas'); if (!c || !c.width) return false;" \
         " const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const g = t.getContext('2d'); g.drawImage(c, 0, 0);" \
         " const d = g.getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0;" \
         " for (let i = 0; i < d.length; i += 4 * 97) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); } return mx - mn > 40; })()"
CASES = {
    "hours-noon": ("?theme=hours&sky=noon&weather=clear", (1600, 900), "", CANVAS),
    "hours-night-rain": ("?theme=hours&sky=night&weather=rain&rain7=60", (1600, 900), "", CANVAS),
    "hours-winter-frost": ("?theme=hours&sky=dawn&weather=snow&date=01-10&frost=-6", (1600, 900), "", CANVAS),
    "room-research": ("?theme=hours&sky=noon&weather=clear#research", (1600, 900), "await wait(2500);",
                      CANVAS + " && document.documentElement.classList.contains('room-ready') && location.hash === '#experience'"),
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
               " document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '>', bubbles: true })); await wait(1500);",
               "window.inCellar && !!document.querySelector('dialog.dungeon[open]')"),
    "cellar-leave-early": ("?theme=hours&sky=noon&weather=clear", (1600, 900),  # (left on the way down: the landscape, not the cellar without its room)
                           "await wait(1000); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); location.hash = '#cellar'; await wait(500);"
                           " document.querySelector('.leave').click(); await wait(2500);",
                           "!document.documentElement.dataset.room && !document.documentElement.classList.contains('room-ready') && " + CANVAS),
    "engine-reopen": ("?theme=hours&sky=noon&weather=clear", (1600, 900),  # (closed and opened again at once: one window, the zoom on the glass)
                      "if (window !== top) await new Promise(() => {}); enterEngine(); await wait(5000); closeEngine(); await wait(250);"
                      " openEngine(document.querySelector('.spot[data-kind=engine]')); await wait(2500);",
                      "document.querySelectorAll('.engine').length === 1 && !!document.querySelector('.engine-win iframe') && /scale/.test(document.querySelector('.plate-img').style.transform)"),
    "room-fade": ("?theme=hours&sky=noon&weather=clear#about", (1600, 900),  # (a room to another: a short dithered fade, in place)
                  "await wait(3000); location.hash = '#teaching'; await wait(800);",
                  "document.documentElement.dataset.room === 'teaching' && document.documentElement.classList.contains('room-ready') && !document.documentElement.classList.contains('travelling')"),
    "room-ahead": ("?theme=hours&sky=noon&weather=clear#about", (1600, 900),  # (the doors' rooms built in idle time, then used: no build on the click)
                   "await wait(2500); for (let k = 0; k < 40 && !Hours.perf().built.length; k += 1) await wait(200); window.ahead = Hours.perf().built.slice(); const to = window.ahead[0]; location.hash = '#' + to; await wait(900); window.used = !Hours.perf().built.includes(to);",
                   "window.ahead.length >= 1 && window.used && document.documentElement.classList.contains('room-ready')"),
    "still": ("?theme=hours&sky=noon&weather=clear", (1600, 900),  # (the landscape kept for the next visit's first paint; the head script run again shows it)
              "await wait(1500); keepStill(); await wait(800); const html = await (await fetch(location.pathname)).text();"
              " const head = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('head script:not([src])')].find((x) => /r.setAttribute\\('data-theme'/.test(x.textContent));"
              " document.documentElement.classList.remove('still'); (0, eval)(head.textContent); await wait(500);"
              " window.kept = document.documentElement.classList.contains('still') && /^url\\(blob:/.test(document.documentElement.style.getPropertyValue('--still')); await caches.delete('mksv-still');",
              "window.kept"),
    "card-link": ("?theme=hours&sky=noon&weather=clear#publications", (1600, 900),  # (a card's link: #room/thing opens it; Back closes it, the room stays; the room said in words)
                  "await wait(3000); const b = [...document.querySelectorAll('.spot')].find((x) => /Emulation/i.test(x.dataset.label)); const slug = b.dataset.slug;"
                  " window.said = /^The library\\. Here: /.test(document.querySelector('.plate-img').getAttribute('aria-label'));"
                  " location.hash = '#publications/' + slug; await wait(1200); window.linked = !document.querySelector('.card').hidden && document.querySelector('.card').matches(':popover-open');"
                  " document.querySelector('.card-close').click(); await wait(600); window.unlinked = location.hash === '#publications';"
                  " b.click(); await wait(600); window.pushed = location.hash === '#publications/' + slug; history.back(); await wait(900);"
                  " window.back = document.querySelector('.card').hidden && location.hash === '#publications' && document.documentElement.dataset.room === 'publications';",
                  "window.said && window.linked && window.unlinked && window.pushed && window.back"),
    "hints": ("?theme=hours&sky=noon&weather=clear#publications", (1600, 900),  # (f: a letter on every thing; typing one opens it)
              "await wait(3000); const k = (key) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));"
              " k('f'); await wait(100); const hs = [...document.querySelectorAll('.kbd-hint')]; window.n = hs.length; window.spots = document.querySelectorAll('.spots .spot').length;"
              " const i = [...document.querySelectorAll('.spots .spot')].findIndex((x) => /Emulation/i.test(x.dataset.label)); const code = hs[i].dataset.code; [...code].forEach(k); await wait(800);",
              "window.n >= window.spots && window.spots > 0 && !document.querySelector('.card').hidden && !document.querySelector('.kbd-hints')"),
    "vim-keys": ("?theme=dark", (1600, 900),  # (the terminal read with vim's keys: G to the bottom, gg back to the top, M a then ' a)
                 "await wait(1500); const k = (key) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));"
                 " k('G'); await wait(400); window.down = window.scrollY > 100; k('M'); k('a'); k('g'); k('g'); await wait(400); window.top0 = window.scrollY === 0;"
                 " k(\"'\"); k('a'); await wait(500); window.back = window.scrollY > 100; sessionStorage.removeItem('marks');",
                 "window.down && window.top0 && window.back"),
    "gamepad": ("?theme=hours&sky=noon&weather=clear#about", (1600, 900),  # (a pad: the right shoulder takes the next room in the menu's order)
                "await wait(2500); let rb = false; Object.defineProperty(navigator, 'getGamepads', { value: () => [{ connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, (_, k) => ({ pressed: k === 5 && rb })) }] });"
                " dispatchEvent(new Event('gamepadconnected')); await wait(200); rb = true; await wait(150); rb = false; await wait(1500);",
                "document.documentElement.dataset.room === 'experience'"),
    "swipe": ("?theme=hours&sky=noon&weather=clear#about", (1600, 900),  # (a finger swiped right across the room: through the door on the left)
              "await wait(2500); const p = document.querySelector('.plate'); const d = roomDoors('about').find((x) => x.dir === 'w' || x.dir === 'n'); window.to = d && d.go;"
              " const ev = (type, x) => p.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: 500, bubbles: true }));"
              " ev('pointerdown', 500); await wait(80); ev('pointermove', 600); ev('pointerup', 700); await wait(1500);",
              "!!window.to && document.documentElement.dataset.room === window.to"),
    "card-pin": ("?theme=hours&sky=noon&weather=clear#experience", (1600, 900),  # (pinned up, found on the wall, taken down)
                 "await wait(3000); localStorage.removeItem('pins'); document.querySelector('.spot[data-kind=scroll]').click(); await wait(600);"
                 " document.querySelector('.card-pin').click(); await wait(800); const b = [...document.querySelectorAll('.spot')].find((x) => /^Pinned/.test(x.dataset.label));"
                 " window.up = !!b; b.click(); await wait(600); document.querySelector('.card-pin').click(); await wait(800);"
                 " window.down = ![...document.querySelectorAll('.spot')].some((x) => /^Pinned/.test(x.dataset.label)); localStorage.removeItem('pins');",
                 "window.up && window.down"),
    "plan-chronicle": ("?theme=hours&sky=noon&weather=clear#work", (1600, 900),  # (the status line's plan; the message line's chronicle)
                       "await wait(2500); document.getElementById('st-explored').click(); await wait(300); window.plan = !!document.querySelector('dialog[open] .plan a.here');"
                       " document.querySelector('dialog[open]').close(); say('One.'); await wait(100); document.querySelector('.msg-text').click(); await wait(200);",
                       "window.plan && /One\\./.test(document.querySelector('.chronicle').textContent)"),
    "engine-walk": ("?theme=hours&sky=noon&weather=clear", (1600, 900),  # (cd in the terminal walks the castle behind; look lists the things)
                    "if (window !== top) await new Promise(() => {}); enterEngine(); await wait(5000); const f = document.querySelector('.engine-win iframe').contentWindow;"
                    " f.openCmd(); f.run('cd work'); await wait(800); f.run('look'); await wait(300); window.saw = /working model/.test(f.document.getElementById('cmd-out').textContent);",
                    "window.saw && document.documentElement.dataset.room === 'work' && document.querySelectorAll('.engine-gear').length === 3"),
    "siege": ("/siege/index.html", (1600, 900),  # (the game's own page: it loads, a round is bought and fought)
              "await wait(10000); window.st = Siege.state();",
              "!!document.querySelector('.siege canvas') && window.st && window.st.phase !== 'buy' && window.st.round >= 1"),
    "siege-gl": ("/siege/index.html?glshot", (1600, 900),  # (drawn by the graphics card: a frame read back is neither blank nor flat, and no GL error)
                 "await wait(4000); window.pr = Siege.probe();",
                 "!!window.pr && window.pr.max - window.pr.min > 40 && window.pr.screen.max - window.pr.screen.min > 40 && window.pr.error === 0"),
    "siege-buy": ("/siege/index.html", (1600, 900),  # (the buying menu on one page: 4 picks the rifles' column, 3 buys the AK-47)
                  "await wait(2500); const k = (code, shift) => dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: !!shift }));"
                  " k('KeyB'); await wait(200); Siege.debug().player.money = 9000; k('Digit4'); await wait(200); k('Digit3'); await wait(300);",
                  "document.querySelectorAll('.sg-card img').length >= 15 && Object.values(Siege.debug().player.weapons).includes('ak47')"),
    "siege-knife": ("/siege/index.html", (1600, 900),  # (the knife in the hand, inspected: its own keyframes)
                    "await wait(2500); const g = Siege.debug(); g.knifeRecipe = { shape: 'karambit', finish: 'jade', seed: 7, wear: 0.05 }; g.knife = SIEGE_ARMS.knife(g.knifeRecipe);"
                    " g.player.slot = 3; g.drawAt = -9; g.inspect = 0; await wait(700);",
                    "!!document.querySelector('.siege canvas')"),
    "siege-bots": ("/siege/index.html", (1600, 900),  # (two minutes run ahead without drawing: the bots fight, plant or defuse, rounds end)
                   "await wait(2500); const g = Siege.debug(); g.player.hp = 1e9; Siege.sim(200); window.st = Siege.state(); window.fallen = g.feed.length;",
                   "window.st && (window.st.round >= 2 || window.fallen >= 3)"),
    "siege-esc": ("/siege/index.html", (1600, 900),  # (Esc: play to pause, pause stays, settings back to pause; buying closed; fallen, E takes over a bot)
                  "await wait(2500); const g = Siege.debug(); const k = (code) => dispatchEvent(new KeyboardEvent('keydown', { code })); const m = () => document.querySelector('.sg-menu'); const r = [];"
                  " k('Escape'); r.push(m().classList.contains('sg-pause') && g.paused); k('Escape'); r.push(!m().hidden && g.paused);"
                  " m().querySelector('[data-act=settings]').click(); k('Escape'); r.push(m().classList.contains('sg-pause') && !m().classList.contains('sg-setmenu'));"
                  " m().hidden = true; g.paused = false; k('KeyB'); r.push(!m().hidden); k('Escape'); r.push(m().hidden && !g.paused);"
                  " g.player.alive = false; g.player.hp = 0; await wait(100); k('KeyE'); r.push(g.player.name !== 'You' && g.player.alive); window.r = r;",
                  "window.r && window.r.every(Boolean)"),
    "room-to-banner": ("?theme=hours&sky=noon&weather=clear#teaching", (1600, 900),  # (a room, then the window turns upright: the banner shows the landscape)
                       "await wait(2500); document.documentElement.classList.add('banner'); document.documentElement.setAttribute('data-theme', 'dark'); await wait(800);",
                       "/^Pixel-art landscape/.test(document.querySelector('.plate-img').getAttribute('aria-label')) && " + CANVAS),
    "terminal": ("?theme=dark", (1600, 900), "", "document.documentElement.getAttribute('data-theme') === 'dark'"),
    # the front page: four pages offered, the field drawn; a page's key points at it and draws its picture; choosing the
    # castle opens it; an old link to a section goes on to it
    "home": ("/index.html", (1920, 1080), "await wait(800); dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); await wait(1800);",
             "!!document.querySelector('#gate canvas') && document.querySelectorAll('.gate-ways a').length === 4"
             " && document.activeElement.dataset.key === 'a' && document.querySelector('.gate-ways a.on') === document.activeElement"),
    # (firefox --screenshot does not follow a navigation: the page opened is followed in a frame instead)
    "home-castle": ("/index.html", (1920, 1080),
                    "if (window !== top) await new Promise(() => {}); const f = document.createElement('iframe'); f.src = '/index.html'; f.style.cssText = 'width:900px;height:700px';"
                    " document.body.append(f); await wait(2500); f.contentDocument.querySelector('.gate-ways a[data-key=c]').click(); await wait(3500);"
                    " window.went = f.contentWindow.location.pathname; window.room = !!f.contentDocument.querySelector('#about');",
                    "window.went === '/castle/' && window.room"),
    "home-deeplink": ("/index.html", (1920, 1080),
                      "if (window !== top) await new Promise(() => {}); const f = document.createElement('iframe'); f.src = '/index.html#publications';"
                      " document.body.append(f); await wait(3000); window.went = f.contentWindow.location.pathname + f.contentWindow.location.hash;",
                      "window.went === '/castle/#publications'"),
    # the plain page: what is sought, the record, no empty section, the report linked once
    "about": ("/about/index.html", (1280, 900), "await wait(300);",
              "!!document.querySelector('#seeking') && ['experience', 'projects', 'education'].every((id) => document.getElementById(id))"
              " && !document.getElementById('talks') && !document.getElementById('publications') && document.querySelectorAll('a[href*=\"memoire\"]').length === 1"),
    "home-phone": ("/index.html", (390, 844), "await wait(1200);",
                   "!!document.querySelector('#gate canvas') && document.querySelector('.gate-box').getBoundingClientRect().right <= innerWidth + 1"),
    # the rooms that grow with the years, given 40 things each (?fill): what does not fit is in an archive
    **{f"fill-{r}": (f"?theme=hours&sky=noon&weather=clear&fill=40#{r}", (1920, 1080), "await wait(3500);",
                     "[...document.querySelectorAll('.spot')].some((b) => /more\\)/.test(b.getAttribute('aria-label') || b.textContent || b.title || ''))")
       for r in ("experience", "work", "publications", "talks", "teaching", "news")},
    "maproom": ("?theme=hours&sky=noon&weather=clear#maproom", (1920, 1080), "await wait(3500);",
                "document.documentElement.dataset.room === 'maproom' && document.querySelectorAll('.spot').length >= 6 && getComputedStyle(document.querySelector('main')).clipPath !== 'none'"),
    "terminal-tools": ("?theme=dark", (1600, 900), "await wait(1200); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ':', bubbles: true })); await wait(200);"
                       " const i = document.getElementById('cmd-in'); i.value = 'who'; i.dispatchEvent(new Event('input')); await wait(150); window.gh = document.querySelector('.cmd-ghost').textContent;"
                       " i.value = 'whoami'; i.form.requestSubmit(); await wait(250); window.who = !!document.querySelector('#cmd-out .glance');"
                       " i.value = 'paper'; i.form.requestSubmit(); await wait(250); window.pa = document.documentElement.hasAttribute('data-paper'); localStorage.removeItem('paper'); localStorage.removeItem('cmd-history');",
                       "window.gh === 'ami' && window.who && window.pa && !!document.querySelector('.plate canvas.twinkle')"),
    "offline": ("?theme=dark", (1600, 900), "await wait(800); const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; await wait(1500);"
                f" const c = await caches.open('{SW_CACHE}'); window.kept = (await c.keys()).map((r) => new URL(r.url).pathname); await reg.unregister(); await caches.delete('{SW_CACHE}');",
                "window.kept.includes('/cv/Mike_Silva_CV.pdf') && window.kept.includes('/index.html') && window.kept.includes('/castle/castle.css')"),
    "phone-banner": ("?theme=dark&sky=noon&weather=clear", (390, 844), "", "document.documentElement.classList.contains('banner') && " + CANVAS),
    "narrow-window": ("?sky=noon&weather=clear", (1100, 800), "",  # (a computer: the terminal, the landscape over the engraving)
                      "document.documentElement.getAttribute('data-theme') === 'dark' && document.documentElement.classList.contains('banner') && " + CANVAS),
    "phone-tower": ("?touch=1&sky=noon&weather=clear", (390, 844),  # (the live picture in the frame in sight; reading on leaves it there)
                    "document.querySelector('#experience').scrollIntoView({ behavior: 'instant' }); await wait(2500); window.scrollBy(0, 300); await wait(600);",
                    "document.documentElement.classList.contains('climb') && document.documentElement.dataset.room === 'experience'"
                    " && !!document.querySelector('#experience > .floor-slot > .plate') && " + CANVAS),
    "phone-side": ("?touch=1&sky=noon&weather=clear", (844, 390),
                   "document.querySelector('#experience').scrollIntoView({ behavior: 'instant' }); await wait(2500);",
                   "document.documentElement.classList.contains('side') && document.documentElement.dataset.room === 'experience' && " + CANVAS),
    "phone-cellar": ("?touch=1&sky=noon&weather=clear", (390, 844),
                     "document.querySelector('#cellar').scrollIntoView({ behavior: 'instant' }); await wait(2500);"
                     " document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '>', bubbles: true })); await wait(1500);",
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
HOLD_S = 14
HOLD = '<img src="/__hold" alt="" style="position:fixed;width:1px">'
GIF = bytes.fromhex("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b")

PREFS = 'user_pref("ui.prefersReducedMotion", 0);\n'  # (the profile's user.js; visual.py reduces motion)
results = {}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(PUBLIC), **k)

    def log_message(self, *a):
        pass

    def do_POST(self):
        name = self.path.rsplit("/", 1)[-1]
        results[name] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]
        if path == "/__hold": # until the case has reported (or HOLD_S)
            t0 = time.time()
            while self.server.case not in results and time.time() - t0 < HOLD_S:
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
            f = PUBLIC / (path.lstrip("/") or "index.html")
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
        url = f"http://127.0.0.1:{port}{q if q.startswith('/') else '/castle/index.html' + q}"
        with tempfile.TemporaryDirectory() as prof:
            Path(prof, "user.js").write_text(PREFS)
            subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof, f"--window-size={w},{h}",
                            "--screenshot", str(OUT / f"{name}.png"), url],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        t0 = time.time()
        while name not in results and time.time() - t0 < HOLD_S + 3:
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
