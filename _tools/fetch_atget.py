"""Eugène Atget's shop signs of old Paris (1899-1908; BnF prints on Wikimedia Commons, public domain):
their names and credits for the village's signs in the close-up view. hours.js paints each as a small
board with an emblem (SHOP_SIGNS, same order); the 14 x 12 frames read as noise at a house's scale.

  uv run python site/_tools/fetch_atget.py     (from EnvS/)

Each photograph cropped to its sign (the box below, in fractions of the print), scaled to 14 x 12
canvas pixels (the close-up's own resolution, its proportions kept), read as five greys of iron
(no dither: at this size it is noise). Writes assets/data/real/atget.json: "frames" (14 x 12) and "captions".
"""
import io

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

import real

SIGNS = [  # [Commons file, crop (x0, y0, x1, y1) as fractions, the sign's name, where, year]
    ("Atget - Enseigne Au Griffon Rue de Buci 10, btv1b105196801.jpeg", (0.37, 0.21, 0.56, 0.34), "Au Griffon", "10 rue de Buci", "1900s"),
    ("Atget - Enseigne (Aux deux Pigeons 8 Rue Clément, btv1b10507021q.jpeg", (0.42, 0.2, 0.63, 0.32), "Aux deux Pigeons", "8 rue Clément", "1908"),
    ("Atget - Au Bon Puits Rue Michel Le Comte, 36, btv1b10506731f.jpeg", (0.1, 0.04, 0.9, 0.96), "Au Bon Puits", "36 rue Michel-le-Comte", "1901"),
    ("Atget - Enseigne - Rue des Canettes 18 Octobre 1899, btv1b105070064.jpeg", (0.4, 0.25, 0.53, 0.37), "Aux Canettes", "18 rue des Canettes", "1899"),
    ("Atget - Enseigne, quai de Bourbon, 38, btv1b10518171t.jpeg", (0.3, 0.06, 0.62, 0.4), "À l'Ancre", "38 quai de Bourbon", "1900s"),
    ("Atget - Enseigne rue Notre-Dame-de-Bonne-Nouvelle, btv1b10516986t.jpeg", (0.38, 0.06, 0.57, 0.24), "A lion's head", "rue Notre-Dame-de-Bonne-Nouvelle", "1900s"),
    ("Atget - Au Lion d'Or, 16 rue Volta (enseigne), 2008.788.jpeg", (0.08, 0.06, 0.92, 0.5), "Au Lion d'Or", "16 rue Volta", "1900s"),
    ("Atget - Enseigne rue des Nonnains d'Hyères, btv1b105177029.jpeg", (0.28, 0.64, 0.62, 0.96), "A carved figure", "rue des Nonnains-d'Hyères", "1899"),
]
NAMES = ["OUTLINE", "ARM_SH", "ARM", "ARM_HI", "GOLD_SH", "GOLD", "GOLD_HI", "TIMBER_SH", "TIMBER", "TIMBER_HI", "STONE_SH", "STONE", "STONE_HI", "CREAM"]
W, H = 14, 12
RAMP = ["OUTLINE", "ARM_SH", "ARM", "ARM_HI", "CREAM"]  # (dark iron to the light of the sky behind it)


def main():
    frames, caps, credits = [], [], []
    for k, (f, (x0, y0, x1, y1), name, where, year) in enumerate(SIGNS):
        url, lic, page = real.commons_url(f"File:{f}", 960)
        assert real.free(lic), (f, lic)
        im = Image.open(io.BytesIO(real.fetch(url))).convert("RGB")
        im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
        g = ImageOps.autocontrast(im.convert("L"), cutoff=3)  # (the albumen's sepia read as iron: one ramp of greys)
        g.thumbnail((W, H), Image.LANCZOS)
        g = np.asarray(ImageEnhance.Contrast(Image.fromarray(np.asarray(g))).enhance(1.4), float) / 255
        ramp = [real.palette()[n] for n in RAMP]
        rgb = np.array(ramp, float)[np.clip((g ** 1.1 * len(RAMP)).astype(int), 0, len(RAMP) - 1)]
        pad = np.zeros((H, W), bool); y0p, x0p = (H - g.shape[0]) // 2, (W - g.shape[1]) // 2; pad[y0p:y0p + g.shape[0], x0p:x0p + g.shape[1]] = True
        full = np.zeros((H, W, 3)); full[pad] = rgb.reshape(-1, 3)
        idx = real.quantize(full, NAMES, "none", alpha=pad)
        light = np.zeros((H, W), bool); light[pad] = (g > 0.72).ravel()
        idx[light] = 255  # (the light behind the ironwork: the wall shows through)
        real.preview(idx, NAMES, f"atget-{k}.png", 10)
        frames.append(real.b64(idx)); caps.append({"name": name, "text": f"{where}, photographed by Eugène Atget ({year})."})
        credits.append({"title": f"Enseigne, {name}, {where}", "author": "Eugène Atget", "year": year, "source": page, "licence": lic})
    real.write_asset("atget", {"w": W, "h": H, "names": NAMES, "frames": frames, "captions": caps}, credits)


if __name__ == "__main__":
    main()
