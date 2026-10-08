"""The observatory's astrolabe: the stars of its rete from the Yale Bright Star Catalogue (5th ed.,
Hoffleit and Warren 1991; CDS VizieR V/50, freely distributed), the ones old astrolabes point to.
hours.js draws the plate for the latitude of Paris and turns the rete to the sidereal time.

  uv run python site/_tools/fetch_astrolabe.py     (from EnvS/)

The catalogue's fixed columns (its ReadMe): HR 1-4, J2000 right ascension 76-83 (h m s), declination
84-90 (sign, d m s), V magnitude 103-107.
Writes assets/data/real/astrolabe.json: {"stars": [[name, English, RA deg, Dec deg, V]]} (J2000).
"""
import gzip

import real

URL = "https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz"
STARS = [  # [HR, the name on the rete, what it is]
    (1457, "Aldebaran", "the bull's eye"), (1713, "Rigel", "Orion's foot"), (2061, "Betelgeuse", "Orion's shoulder"),
    (1708, "Capella", "the she-goat"), (2491, "Sirius", "the dog star"), (2943, "Procyon", "the little dog"),
    (2990, "Pollux", "the second twin"), (3982, "Regulus", "the lion's heart"), (5056, "Spica", "the virgin's ear of wheat"),
    (5340, "Arcturus", "the bear's guard"), (5793, "Alphecca", "the crown's jewel"), (6134, "Antares", "the scorpion's heart"),
    (7001, "Vega", "the falling eagle"), (7557, "Altair", "the flying eagle"), (7924, "Deneb", "the swan's tail"),
    (8728, "Fomalhaut", "the southern fish's mouth"), (8781, "Markab", "Pegasus's saddle"), (15, "Alpheratz", "the horse's navel"),
    (936, "Algol", "the demon's head"), (188, "Deneb Kaitos", "the whale's tail"), (4301, "Dubhe", "the bear's back"), (5191, "Alkaid", "the bear's tail"),
]


def main():
    rows = {int(ln[0:4]): ln for ln in gzip.decompress(real.fetch(URL, "bsc5.gz")).decode("latin-1").splitlines() if ln[0:4].strip()}
    out = []
    for hr, name, what in STARS:
        ln = rows[hr]
        ra = (int(ln[75:77]) + int(ln[77:79]) / 60 + float(ln[79:83]) / 3600) * 15
        dec = (1 if ln[83] == "+" else -1) * (int(ln[84:86]) + int(ln[86:88]) / 60 + int(ln[88:90]) / 3600)
        out.append([name, what, round(ra, 4), round(dec, 4), float(ln[102:107])])
        print(f"  HR {hr:4d} {name:12s} RA {ra:8.3f}  Dec {dec:+8.3f}  V {ln[102:107]}")
    real.write_asset("astrolabe", {"stars": out}, {"title": "The Bright Star Catalogue, 5th revised ed. (the rete's stars)", "author": "D. Hoffleit and W. H. Warren Jr. (Yale)",
                                                    "year": "1991", "source": "https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50", "licence": "freely distributed (CDS VizieR V/50)"})


if __name__ == "__main__":
    main()
