"""Shared pipeline for the castle's things taken from the real world (paintings, films, scores, texts,
furniture, maps...): download once into a cache, reduce to the scene's palette, write a small JSON
asset that hours.js loads and lights like its own pixels.

  _cache/real/           downloads (gitignored; the originals are never committed)
  assets/data/real/      one JSON per asset + index.json (name -> content hash, credits)

An image asset is {"w", "h", "names": [palette names], "px": base64 bytes} (or "frames": [px, ...]):
each byte indexes `names`, 255 is transparent; hours.js maps the names to its own palette indices,
so the asset follows the hour, the weather and the candles like everything else. The palette is
read from hours.js itself (SURFACES and MATS): one source of truth.

Each fetch_*.py script calls write_asset(..., credit=...) with what it used; the register in the
gatehouse lists the credits from index.json.
"""
import base64
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "_cache" / "real"
OUT = ROOT / "assets" / "data" / "real"
UA = "mksv-pro.github.io asset builder (personal site; contact via the site)"


# ---- downloads ---------------------------------------------------------------------------

def fetch(url, name=None, binary=True):
    """The file at `url`, from the cache when already there (bytes, or text if not binary)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (name or re.sub(r"[^A-Za-z0-9._-]+", "_", urllib.parse.unquote(url))[-150:])
    if not f.exists():
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    f.write_bytes(r.read())
                break
            except Exception as e:  # (a busy server: wait and try again)
                if attempt == 3:
                    raise
                print(f"  retry {url}: {e}")
                time.sleep(8 * (attempt + 1))
        time.sleep(1.2)  # (be gentle with the servers: Commons answers 429 to bursts)
    return f.read_bytes() if binary else f.read_text(encoding="utf-8", errors="replace")


def free(lic):
    """Can the site host a work under licence `lic` (Commons' short name)? Public domain, CC0, CC BY
    (credited); not NC or ND, not "fair use"."""
    t = lic.lower()
    return ("public domain" in t or t.startswith("pd") or "cc0" in t or t.startswith("cc by") and "nc" not in t and "nd" not in t)


def commons_search(query, n=10):
    """File titles on Wikimedia Commons matching `query` (the File: namespace)."""
    q = {"action": "query", "format": "json", "list": "search", "srnamespace": 6, "srlimit": n, "srsearch": query}
    data = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q), binary=False))
    return [r["title"] for r in data["query"]["search"]]


def commons_url(title, width=None):
    """Direct URL of a Wikimedia Commons file (`File:...`), scaled to `width` px if given."""
    q = {"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata", "titles": title}
    if width:
        q["iiurlwidth"] = width
    data = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q), binary=False))
    page = next(iter(data["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise LookupError(f"no such file on Commons: {title}")
    info = page["imageinfo"][0]
    lic = info.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "")
    return info.get("thumburl") or info["url"], lic, info.get("descriptionurl", "")


# ---- the palette (from hours.js) -----------------------------------------------------------

def palette():
    """{name: (r, g, b)} for every named colour of the scene, in daylight."""
    js = (ROOT / "assets" / "js" / "hours.js").read_text()
    pal = {}
    surf = js[js.index("const SURFACES = ["):js.index("const MATS = {")]
    for name, h in re.findall(r"\['([A-Z0-9_]+)', '(#[0-9a-f]{6})'", surf):
        pal[name] = h
    mats = js[js.index("const MATS = {"):js.index("const ALIAS")]
    for name, hi, mid, sh in re.findall(r"\['([A-Z]+)', '(#[0-9a-f]{6})', '(#[0-9a-f]{6})', '(#[0-9a-f]{6})'\]", mats):
        pal[f"{name}_HI"], pal[name], pal[f"{name}_SH"] = hi, mid, sh
    pal["WIN_LIT"] = "#ffb048"
    return {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in pal.items()}


def to_lab(rgb):
    """sRGB (..., 3) in 0..255 -> CIE Lab (D65): colour distances that look like distances."""
    c = np.asarray(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])
    xyz /= [0.95047, 1.0, 1.08883]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16


def quantize(rgb, names, dither="fs", alpha=None, strength=1.0):
    """Indices into `names` for an RGB image (h, w, 3): nearest colour in Lab, with Floyd-Steinberg
    error diffusion ("fs"), ordered 4x4 Bayer dither ("bayer", as the scene's own), or none.
    `alpha` (h, w) bool: False pixels become 255 (transparent)."""
    pal = palette()
    cols = np.array([pal[n] for n in names], float)
    lab_p = to_lab(cols)
    h, w = rgb.shape[:2]
    img = np.asarray(rgb, float).copy()
    out = np.zeros((h, w), np.uint8)
    if dither == "fs":
        for y in range(h):
            for x in range(w):
                c = np.clip(img[y, x], 0, 255)
                k = int(np.argmin(((lab_p - to_lab(c)) ** 2).sum(-1)))
                out[y, x] = k
                err = (c - cols[k]) * strength
                if x + 1 < w:
                    img[y, x + 1] += err * 7 / 16
                if y + 1 < h:
                    if x > 0:
                        img[y + 1, x - 1] += err * 3 / 16
                    img[y + 1, x] += err * 5 / 16
                    if x + 1 < w:
                        img[y + 1, x + 1] += err * 1 / 16
    else:
        lab = to_lab(np.clip(img, 0, 255))
        d = ((lab[:, :, None, :] - lab_p[None, None]) ** 2).sum(-1)
        if dither == "bayer":  # the two nearest, chosen by the threshold matrix in proportion
            o = np.argsort(d, -1)[..., :2]
            d1 = np.take_along_axis(d, o[..., :1], -1)[..., 0] ** 0.5
            d2 = np.take_along_axis(d, o[..., 1:], -1)[..., 0] ** 0.5
            t = d1 / (d1 + d2 + 1e-9)  # 0: exactly the nearest, 0.5: halfway between
            th = BAYER4[np.arange(h)[:, None] % 4, np.arange(w)[None, :] % 4] * 0.5 * strength
            out = np.where(t > th, o[..., 1], o[..., 0]).astype(np.uint8)
        else:
            out = np.argmin(d, -1).astype(np.uint8)
    if alpha is not None:
        out[~alpha] = 255
    return out


def preview(idx, names, path, scale=6):
    """A PNG of an index image in daylight colours, to look at (in _cache/preview/)."""
    from PIL import Image

    pal = palette()
    cols = np.array([pal[n] for n in names] + [(255, 0, 255)], np.uint8)
    im = cols[np.where(idx == 255, len(names), idx)]
    p = CACHE.parent / "preview" / path
    p.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(im).resize((idx.shape[1] * scale, idx.shape[0] * scale), Image.NEAREST).save(p)
    return p


# ---- assets ------------------------------------------------------------------------------

def b64(idx):
    return base64.b64encode(np.ascontiguousarray(idx, np.uint8).tobytes()).decode()


def write_asset(name, obj, credit):
    """Write assets/data/real/<name>.json and record it (hash, credits) in index.json.
    credit: a dict, or a list of dicts {title, author, year, source, licence}."""
    OUT.mkdir(parents=True, exist_ok=True)
    body = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    (OUT / f"{name}.json").write_text(body, encoding="utf-8")
    ix_path = OUT / "index.json"
    ix = json.loads(ix_path.read_text()) if ix_path.exists() else {}
    ix[name] = {"v": hashlib.md5(body.encode()).hexdigest()[:8], "credits": credit if isinstance(credit, list) else [credit]}
    ix_path.write_text(json.dumps(dict(sorted(ix.items())), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  assets/data/real/{name}.json ({len(body) // 1024 + 1} KB)")
