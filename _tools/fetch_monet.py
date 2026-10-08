"""Claude Monet's Rouen Cathedral series (1892-1894), from Wikimedia Commons (public domain): the
colour of the same stone at different hours and in different weathers, for the castle's walls.

  uv run python site/_tools/fetch_monet.py     (from EnvS/)

For each canvas, the median colour of the portal (the middle of the canvas, where the stone is),
with the hour and the weather it shows. hours.js pulls the walls' daylight colours towards the
canvas nearest the real hour, in the real weather's kind (clear, grey, fog).
Writes assets/data/real/monet.json: {"canvases": [{title, year, hour, kind, rgb}]}.
"""
import io

import numpy as np
from PIL import Image

import real

# [Commons file, its title, year, the hour it shows (local), the weather]
CANVASES = [
    ("Monet - rouen-cathedral-the-portal-morning-fog.jpg", "The Portal, Morning Fog", 1893, 7, "fog"),
    ("Claude Monet - Rouen Cathedral, Facade (Morning effect).JPG", "The Façade, Morning Effect", 1892, 8, "clear"),
    ("Claude Monet - The Portal of Rouen Cathedral in Morning Light (1894) - Getty Center 2001.33.jpg", "The Portal in Morning Light", 1894, 9, "clear"),
    ("Claude Monet - Cathédrale de Rouen. Harmonie bleue.jpg", "Harmony in Blue", 1893, 10, "fog"),
    ("Claude Monet - Rouen Cathedral, West Façade, Sunlight - Google Art Project.jpg", "West Façade, Sunlight", 1894, 13, "clear"),
    ("Rouen Cathedral- The Portal (Sunlight) MET DT2185.jpg", "The Portal (Sunlight)", 1894, 14, "clear"),
    ("Claude Monet - Cathédrale de Rouen. Harmonie bleue et or.jpg", "Harmony in Blue and Gold", 1893, 15, "clear"),
    ("Claude Monet - The Cathedral in Rouen. The portal, Grey Weather - Google Art Project.jpg", "The Portal, Grey Weather", 1892, 12, "grey"),
    ("Claude Monet - Rouen Cathedral, Facade (Sunset).JPG", "The Façade at Sunset", 1892, 18, "clear"),
    ("Claude Monet - The Rouen Cathedral at Sunset - Pushkin museum.jpg", "The Cathedral at Sunset", 1894, 19, "clear"),
]


def main():
    out = []; credits = []
    for f, title, year, hour, kind in CANVASES:
        url, lic, page = real.commons_url(f"File:{f}", 500)
        assert real.free(lic), (f, lic)
        a = np.asarray(Image.open(io.BytesIO(real.fetch(url))).convert("RGB"), float)
        h, w = a.shape[:2]
        mid = a[int(h * 0.35):int(h * 0.8), int(w * 0.3):int(w * 0.7)].reshape(-1, 3)
        lum = mid @ [0.3, 0.59, 0.11]
        keep = mid[(lum > np.percentile(lum, 25)) & (lum < np.percentile(lum, 95))]  # (the stone, not the shadows of the doors)
        rgb = [int(v) for v in np.median(keep, 0)]
        out.append({"title": title, "year": year, "hour": hour, "kind": kind, "rgb": rgb})
        credits.append({"title": f"Rouen Cathedral: {title}", "author": "Claude Monet", "year": str(year), "source": page, "licence": lic or "public domain"})
        print(f"  {hour:2d}h {kind:5s} {rgb} {title}")
    real.write_asset("monet", {"canvases": out}, credits)


if __name__ == "__main__":
    main()
