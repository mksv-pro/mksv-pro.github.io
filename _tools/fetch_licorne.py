"""La Dame à la licorne (the Lady and the Unicorn; Paris, c. 1500; musée de Cluny): the six
tapestries, from Wikimedia Commons (photographs of the works, public domain), for the great hall.

  uv run python site/_tools/fetch_licorne.py     (from EnvS/)

Each tapestry fitted into 64 x 56 (the card) and 24 x 21 (on the hall's wall), keeping its
proportions (transparent margins), reduced to the scene's palette with error diffusion.
Writes assets/data/real/licorne.json: "frames", "small" frames, "captions" (six: the five senses,
then "À mon seul désir"), in the order hours.js's SENSES uses.
"""
import io

import numpy as np
from PIL import Image, ImageEnhance

import real

SENSES = [  # [Commons file part, name, what it shows]
    ("Le toucher", "Touch", "The lady holds the unicorn's horn in one hand and a standard in the other."),
    ("Le Goût", "Taste", "The lady takes a sweet from a dish her maid holds out; a parakeet eats at her hand."),
    ("L'Odorat", "Smell", "The lady weaves a crown of carnations; a monkey sniffs a flower it has stolen from the basket."),
    ("L'Ouïe", "Hearing", "The lady plays a portative organ on a table covered with a Turkish carpet; her maid works the bellows."),
    ("Le Vue", "Sight", "The unicorn rests its forelegs in the lady's lap and looks at itself in the mirror she holds up."),
    ("Mon seul désir", "À mon seul désir", "Before a tent inscribed 'to my only desire', the lady lays her necklace in a casket: the sixth sense, the heart, or the giving up of the other five."),
]
SKIPPED = {"EYE", "ORB", "WIN_LIT", "WIN_DARK"}


def fit(im, w, h):
    """im scaled to fit w x h, centred; the margin transparent (alpha False)."""
    k = min(w / im.width, h / im.height)
    sw, sh = max(1, round(im.width * k)), max(1, round(im.height * k))
    small = np.asarray(im.resize((sw, sh), Image.LANCZOS))
    rgb = np.zeros((h, w, 3), np.uint8); a = np.zeros((h, w), bool)
    x0, y0 = (w - sw) // 2, (h - sh) // 2
    rgb[y0:y0 + sh, x0:x0 + sw] = small; a[y0:y0 + sh, x0:x0 + sw] = True
    return rgb, a


def main():
    pal = real.palette(); names = [n for n in pal if n not in SKIPPED]
    frames, small, caps, credits = [], [], [], []
    for k, (f, name, text) in enumerate(SENSES):
        url, lic, page = real.commons_url(f"File:(Toulouse) {f} (La Dame à la licorne) - Musée de Cluny Paris.jpg", 700)
        assert real.free(lic), (f, lic)
        im = ImageEnhance.Color(Image.open(io.BytesIO(real.fetch(url))).convert("RGB")).enhance(1.2)
        rgb, a = fit(im, 64, 56); idx = real.quantize(rgb, names, "fs", alpha=a, strength=0.8)
        frames.append(real.b64(idx))
        if k in (0, 5):
            real.preview(idx, names, f"licorne-{k}.png", 5)
        rgb, a = fit(im, 24, 21); small.append(real.b64(real.quantize(rgb, names, "none", alpha=a)))
        caps.append({"name": name, "text": text})
        credits.append({"page": page, "lic": lic})
    real.write_asset("licorne", {"w": 64, "h": 56, "names": names, "frames": frames, "small": {"w": 24, "h": 21, "frames": small}, "captions": caps},
                     {"title": "La Dame à la licorne (the six tapestries)", "author": "unknown weavers after a Paris designer",
                      "year": "c. 1500", "source": credits[0]["page"], "licence": "public domain (Wikimedia Commons)"})


if __name__ == "__main__":
    main()
