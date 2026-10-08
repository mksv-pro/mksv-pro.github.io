"""Les Très Riches Heures du duc de Berry (Limbourg brothers, c. 1411-1416; Chantilly, musée Condé,
Ms. 65): the twelve calendar miniatures, from Wikimedia Commons (public domain), for the
scriptorium's book of hours and the month's colours in the landscape.

  uv run python site/_tools/fetch_heures.py     (from EnvS/)

Writes assets/data/real/heures.json: "frames" (72 x 100, the card's picture), "small" frames (12 x 16,
the page on the lectern), "tint" per month ([sky, green, earth] RGB, from the miniature: the hues
hours.js pulls the landscape's sky, grass and fields towards, a little), "months" (captions).
"""
import io

import numpy as np
from PIL import Image, ImageEnhance

import real

FILES = ["Les Très Riches Heures du duc de Berry Janvier.jpg", "Les Très Riches Heures du duc de Berry février.jpg",
         *[f"Les Très Riches Heures du duc de Berry {m}.jpg" for m in ("mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre")],
         "Les Très Riches Heures du duc de Berry décembre.jpg"]
# what each month shows (the labour, the castle behind it)
MONTHS = [
    ("January", "The duke at table, his household and guests exchanging New Year's gifts; a tapestry of battle behind them."),
    ("February", "Winter at a farm: peasants warm themselves by the fire, a woman blows on her hands, snow on the hives and the hills."),
    ("March", "Ploughing, pruning the vines and sowing under the castle of Lusignan; the fairy Melusine flies over its tower."),
    ("April", "A betrothal: young nobles exchange rings in a garden, the castle of Dourdan beyond."),
    ("May", "The May-day ride: courtiers in green ride out with trumpets, the Paris of the Palais de la Cité behind them."),
    ("June", "Haymaking on the left bank of the Seine, facing the Palais de la Cité and the Sainte-Chapelle in Paris."),
    ("July", "Reaping the wheat and shearing the sheep below the castle of Poitiers."),
    ("August", "Falconry: a hunting party rides out while peasants bathe in the river, the castle of Étampes above."),
    ("September", "The grape harvest under the castle of Saumur, its towers and gilded weathervanes."),
    ("October", "Sowing the winter wheat, a scarecrow and nets against the birds, the Louvre of Charles V across the Seine."),
    ("November", "A swineherd knocks down acorns for his pigs at the edge of the forest."),
    ("December", "The boar hunt in the forest of Vincennes, the hounds on the boar, the castle's keep above the trees."),
]
SKIPPED = {"T_OR", "T_ARGENT", "T_GULES", "T_AZURE", "T_VERT", "T_SABLE", "T_PRUNE", "T_BORDEAUX", "T_NAVY", "T_BRIGHT", "EYE", "ORB", "WIN_LIT", "WIN_DARK"}


def colours_of(rgb):
    """[sky, green, earth]: the mean colour of the miniature's blues, greens and earth browns (HSV bands)."""
    hsv = np.asarray(Image.fromarray(rgb).convert("HSV"), float)
    h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    lower = np.zeros(h.shape, bool); lower[int(h.shape[0] * 0.3):] = True  # (under the calendar's arch)
    bands = [((h > 190) & (h < 250) & (s > 0.25) & (v > 0.35)), ((h > 65) & (h < 160) & (s > 0.2) & (v > 0.2) & lower),
             ((h > 15) & (h < 45) & (s > 0.25) & (s < 0.75) & (v > 0.25) & (v < 0.8) & lower)]
    out = []
    for m in bands:
        out.append([int(c) for c in rgb[m].mean(0)] if m.sum() > 50 else None)
    return out


def main():
    pal = real.palette()
    names = [n for n in pal if n not in SKIPPED]
    frames, small, tints, credits = [], [], [], []
    for k, f in enumerate(FILES):
        url, lic, page = real.commons_url(f"File:{f}", 600)
        assert real.free(lic), (f, lic)
        im = Image.open(io.BytesIO(real.fetch(url))).convert("RGB")
        im = ImageEnhance.Color(im).enhance(1.15)  # (the scene's palette is bright: keep the lapis and the greens alive)
        big = np.asarray(im.resize((72, 100), Image.LANCZOS))
        tiny = np.asarray(im.resize((12, 16), Image.LANCZOS))
        frames.append(real.b64(real.quantize(big, names, "fs", strength=0.8)))
        small.append(real.b64(real.quantize(tiny, names, "none")))
        tints.append(colours_of(np.asarray(im.resize((200, 280), Image.LANCZOS))))
        if k in (0, 9):
            real.preview(real.quantize(big, names, "fs", strength=0.8), names, f"heures-{k + 1:02d}.png", 4)
        credits.append({"page": page, "lic": lic})
    real.write_asset("heures", {"w": 72, "h": 100, "names": names, "frames": frames,
                                "small": {"w": 12, "h": 16, "frames": small}, "tint": tints,
                                "months": [{"name": n, "text": t} for n, t in MONTHS]},
                     {"title": "Les Très Riches Heures du duc de Berry, the calendar", "author": "the Limbourg brothers",
                      "year": "c. 1411-1416", "source": credits[0]["page"], "licence": "public domain (Wikimedia Commons)"})


if __name__ == "__main__":
    main()
