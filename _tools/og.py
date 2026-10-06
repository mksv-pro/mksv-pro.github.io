"""The link preview (assets/img/og.png, 1200 x 630): the castle at dusk under a clear sky, the
name over it, photographed by headless Firefox from the site itself (?og hides the rest).

  uv run python _tools/og.py        (needs firefox; Pillow to reduce the palette)

A small server delays the page's load event with a slow image, so the screenshot waits until the
scene and its fonts are drawn.
"""
import http.server
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img" / "og.png"
URL = "index.html?theme=hours&sky=dusk&weather=clear&og"
GIF = bytes.fromhex("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/__sleep"):  # held back: the page's load waits for it
            time.sleep(6)
            self.send_response(200); self.send_header("Content-Type", "image/gif"); self.end_headers()
            self.wfile.write(GIF)
            return
        if self.path.startswith("/index.html"):
            page = (ROOT / "index.html").read_bytes().replace(b"</body>", b'<img src="/__sleep" alt="" hidden></body>', 1)
            self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers()
            self.wfile.write(page)
            return
        super().do_GET()


def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory() as prof:  # a fresh profile: no stale cache, no stored theme
        shot = Path(prof) / "og.png"
        subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof, "--window-size=1200,630",
                        "--screenshot", str(shot), f"http://127.0.0.1:{srv.server_address[1]}/{URL}"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120, check=True)
        img = Image.open(shot).convert("RGB")
        img.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(OUT, optimize=True)
    srv.shutdown()
    print(f"  {OUT.relative_to(ROOT)} {Image.open(OUT).size}, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if not shutil.which("firefox"):
        raise SystemExit("needs firefox")
    main()
