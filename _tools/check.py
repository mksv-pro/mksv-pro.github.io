"""Pre-deploy checks on the built site.  python3 _tools/check.py [--external] [--shots DIR]

- every generated page is newer than its template (rebuild forgotten?)
- local links and #fragments resolve; ids are unique; every <img> has alt; <html lang> is set
- no placeholder left (XXXX, 0000-0000, example.com, lorem, TODO)
- text tokens of every theme (hours: day and night) reach 4.5:1 against --bg, --panel and --bar (WCAG AA)
- --external: every http(s) link answers < 400 (GitHub, arXiv... may rate-limit: rerun)
- --shots DIR: headless Firefox screenshots, both themes, 360 px and 1280 px wide
Exit status 1 on any failure. Stdlib only.
"""
import argparse
import re
import subprocess
import sys
import tempfile
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from colour import contrast  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"_src", "_tools", "third_party"}
PLACEHOLDERS = re.compile(r"XXXX|0000-0000|example\.com|lorem ipsum|TODO|FIXME", re.I)
TEXT_TOKENS = ("--ink", "--hi", "--accent", "--dim", "--red", "--green")
GROUNDS = ("--bg", "--panel", "--bar")

errors = []


def fail(msg):
    errors.append(msg)
    print("  FAIL", msg)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.imgs_no_alt, self.lang = [], [], 0, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "img" and not a.get("alt"):
            self.imgs_no_alt += 1
        for key in ("href", "src"):
            if a.get(key) and not (tag == "link" and a.get("rel") in ("canonical", "alternate", "preconnect")):
                self.links.append(a[key])


def pages():
    return sorted(p for p in ROOT.rglob("*.html") if not SKIP & set(p.relative_to(ROOT).parts))


def check_fresh():
    built = {p.relative_to(ROOT).as_posix(): p for p in pages()}
    newest_src = max(p.stat().st_mtime for p in (ROOT / "_src").rglob("*") if p.is_file())
    stale = [r for r, p in built.items() if p.stat().st_mtime < newest_src]
    if stale:
        fail(f"pages older than _src/, run _tools/build.py: {', '.join(stale)}")


def check_pages(external):
    parsed = {}
    for p in pages():
        pg = Page()
        pg.feed(p.read_text())
        parsed[p] = pg
    ext = set()
    for p, pg in parsed.items():
        rel = p.relative_to(ROOT)
        text = p.read_text()
        if not pg.lang:
            fail(f"{rel}: <html> has no lang")
        dup = {i for i in pg.ids if pg.ids.count(i) > 1}
        if dup:
            fail(f"{rel}: duplicate ids {sorted(dup)}")
        if pg.imgs_no_alt:
            fail(f"{rel}: {pg.imgs_no_alt} <img> without alt")
        visible = re.sub(r"<!--.*?-->", "", text, flags=re.S)
        for m in PLACEHOLDERS.finditer(visible):
            fail(f"{rel}: placeholder '{m.group(0)}'")
        for link in pg.links:
            u = urlsplit(link)
            if u.scheme in ("http", "https"):
                ext.add(link)
                continue
            if u.scheme in ("mailto", "data", "javascript") or link.startswith("//"):
                continue
            if rel.name == "404.html":  # root-absolute paths, served at any depth
                target = ROOT / u.path.lstrip("/") if u.path else p
            else:
                target = (p.parent / unquote(u.path)).resolve() if u.path else p
            if target.is_dir():
                target = target / "index.html"
            if not target.exists():
                fail(f"{rel}: broken link {link}")
                continue
            if u.fragment and target.suffix == ".html":
                tp = parsed.get(target) or Page()
                if target not in parsed:
                    tp.feed(target.read_text())
                if u.fragment not in tp.ids:
                    fail(f"{rel}: no #{u.fragment} in {target.relative_to(ROOT)}")
    print(f"  {len(parsed)} pages, {len(ext)} external links")
    if external:
        for link in sorted(ext):
            req = urllib.request.Request(link, method="GET", headers={"User-Agent": "site-check"})
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    code = r.status
            except urllib.error.HTTPError as e:
                code = e.code
            except Exception as e:  # noqa: BLE001 - report any network failure as a broken link
                code = type(e).__name__
            ok = isinstance(code, int) and code < 400
            print(f"  {'ok  ' if ok else 'FAIL'} {code} {link}")
            if not ok:
                errors.append(f"external {code} {link}")


def check_contrast():
    css = (ROOT / "styles.css").read_text()
    blocks = {"dark": re.search(r":root \{(.*?)\}", css, re.S).group(1),
              "hours": re.search(r'\[data-theme="hours"\] \{(.*?)\}', css, re.S).group(1),
              "hours night": re.search(r'\[data-theme="hours"\]\[data-sky="night"\] \{(.*?)\}',
                                       css, re.S).group(1)}
    dark = dict(re.findall(r"(--[a-z]+):\s*(#[0-9a-f]{6})", blocks["dark"]))
    for theme, block in blocks.items():
        tok = dict(dark)
        tok.update(re.findall(r"(--[a-z]+):\s*(#[0-9a-f]{6})", block))
        worst = min((contrast(tok[t], tok[g]), t, g) for t in TEXT_TOKENS for g in GROUNDS)
        print(f"  {theme}: lowest contrast {worst[0]:.2f}:1 ({worst[1]} on {worst[2]})")
        if worst[0] < 4.5:
            fail(f"{theme}: {worst[1]} on {worst[2]} is {worst[0]:.2f}:1 < 4.5:1")


def shots(out, port=8766):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        import time
        time.sleep(0.8)
        targets = ["", "projects/nuclear-emulators.html", "projects/urban-morphogenesis.html",
                   "projects/n-body.html", "404.html"]
        for theme, pref in (("dark", 'user_pref("ui.systemUsesDarkTheme", 1);\n'),
                            ("hours", 'user_pref("layout.css.prefers-color-scheme.content-override", 1);\n')):
            for width in (360, 1280):
                for t in targets:
                    with tempfile.TemporaryDirectory() as prof:  # fresh profile: no stale CSS
                        Path(prof, "user.js").write_text(pref)
                        name = f"{theme}-{width}-{(t or 'index').replace('/', '_')}.png"
                        subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof,
                                        f"--window-size={width},1600", "--screenshot",
                                        str(out / name), f"http://127.0.0.1:{port}/{t}"],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
                        print(f"  shot {name}")
    finally:
        server.terminate()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--external", action="store_true")
    ap.add_argument("--shots", metavar="DIR")
    a = ap.parse_args()
    print("freshness"); check_fresh()
    print("pages"); check_pages(a.external)
    print("contrast"); check_contrast()
    if a.shots:
        print("screenshots"); shots(a.shots)
    print(f"{len(errors)} problem(s)" if errors else "all checks passed")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
