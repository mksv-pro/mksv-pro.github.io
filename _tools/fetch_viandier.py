"""Le Viandier de Taillevent (Guillaume Tirel, cook to Charles V; the printed text of about 1490,
Pichon and Vicaire's edition, 1892), from Project Gutenberg (public domain), for the tavern's bill
of fare: its dishes for lean days (fish) and fat days (meat), its sauces for both.

  uv run python site/_tools/fetch_viandier.py     (from EnvS/)

A recipe is a paragraph opening with a pilcrow; its name is the words after "Pour (faire)" up to the
first verb or stop; its ingredients are read off with a glossary of the book's Middle French (the
English beside each); a dish with meat in it is fat, one with fish and no meat lean, the rest (the
sauces) either.
Writes assets/data/real/viandier.json: {"dishes": [{name, lean (true, false or null), what: [English], text}]}.
"""
import re

import real

URL = "https://www.gutenberg.org/cache/epub/26567/pg26567.txt"
MEAT = {"beuf": "beef", "boeuf": "beef", "porc": "pork", "veau": "veal", "mouton": "mutton", "connin": "rabbit", "lieure": "hare",
        "perdris": "partridge", "poulaille": "fowl", "poussin": "chicks", "chappon": "capon", "chapon": "capon", "oye": "goose",
        "malart": "mallard", "venoison": "venison", "sanglier": "boar", "cheureul": "roe deer", "cerf": "hart", "pigeon": "pigeons",
        "cygne": "swan", "paon": "peacock", "lart": "bacon", "oyseaulx": "fowl", "pourcelet": "piglet", "cochon": "pig"}
FISH = {"anguill": "eels", "brochet": "pike", "carpe": "carp", "lamproy": "lamprey", "saulmon": "salmon", "harenc": "herring",
        "perche": "perch", "tanche": "tench", "bresme": "bream", "aloze": "shad", "maquerel": "mackerel", "raye": "skate",
        "seiche": "cuttlefish", "escreuiss": "crayfish", "barbeau": "barbel", "poisson": "fish", "moru": "cod", "rouget": "red mullet",
        "turbot": "turbot", "esturgon": "sturgeon", "estourgon": "sturgeon", "estougon": "sturgeon", "sole": "sole", "plays": "plaice", "congre": "conger",
        "merlu": "hake", "gournault": "gurnard", "truyte": "trout", "truite": "trout", "lus": "pike", "breme": "bream", "orbillon": "fish", "pimpernaulx": "eels",
        "hanons": "cockles", "moules": "mussels", "oystres": "oysters", "marsouyn": "porpoise", "baleine": "whale", "dorees": "dories", "mulet": "mullet"}
OTHER = {"oeuf": "eggs", "amandes": "almonds", "ris ": "rice", "puree": "pea broth", "feues": "beans", "oignon": "onions",
         "percil": "parsley", "sauge": "sage", "gingembre": "ginger", "canelle": "cinnamon", "saffr": "saffron", "clou": "cloves",
         "graine": "grains of paradise", "poivre": "pepper", "sucre": "sugar", "vert ius": "verjuice", "vin aigre": "vinegar",
         "vin": "wine", "pain": "bread", "beurre": "butter", "huille": "oil", "luylle": "oil", "moustarde": "mustard",
         "eaue rose": "rose water", "eaue rouse": "rose water", "lait": "milk", "fromage": "cheese", "figues": "figs", "raisins": "raisins"}
VERB = r"\s(?:prene[sz]|mette[sz]|despece[sz]|broye[sz]|cuit[sz]?|metez|il fault|il conuient|soit|soient|faictes|ayez|fault|on|qui|et|&|/)\s|[.:/]"


def main():
    txt = real.fetch(URL, "viandier.txt", binary=False)
    body = txt[txt.index("*** START"):txt.index("NOTES SUR LA VERSION ELECTRONIQUE")]
    paras = [re.sub(r"\(Page \d+\)\s*", "", re.sub(r"\s+", " ", p)).strip() for p in re.split(r"\n\s*\n", body)]
    dishes = []
    for p in paras:
        if not p.startswith("¶"):
            continue
        p = p[1:].strip()
        m = re.match(r"(?:Pour|Pr)\s+(?:faire\s+)?(?:vng\s+|vne\s+|une\s+)?(.+?)(?=" + VERB + ")", p, re.I)
        name = (m.group(1) if m else re.split(VERB, p)[0]).strip(" ,")
        name = re.sub(r"(\s+(le|la|les|ny|ou|de|a|en))+$", "", name)
        if not (3 <= len(name) <= 40) or re.match(r"(Et|Cy|Ci|Item|Prene[sz]|Mette[sz]|Soit|Ont|Bancquet|Demye|Iron)\b", name, re.I):  # (not a dish: a step, a whole menu)
            continue
        low = " " + p.lower() + " "
        has = lambda k: re.search(r"\b" + k + (r"s?\b" if len(k) <= 3 else ""), low)  # (short words whole: oye is not in voye)
        meat = [e for k, e in MEAT.items() if has(k)]; fish = [e for k, e in FISH.items() if has(k)]
        lean = False if meat or "de chair" in low else True if fish else None  # (sturgeon "of flesh": veal dressed as fish, for fat days)
        what = list(dict.fromkeys(meat + fish + [e for k, e in OTHER.items() if has(k.strip())]))
        dishes.append({"name": name[0].upper() + name[1:], "lean": lean, "what": what[:8], "text": p if len(p) < 420 else p[:p.rfind(" ", 0, 400)] + "..."})
    for d in [d for d in dishes if d["lean"]][:40]:
        print(f"  {str(d['lean']):5s} {d['name']:34s} {', '.join(d['what'])}")
    print(f"  {len(dishes)} dishes: {sum(d['lean'] is True for d in dishes)} lean, {sum(d['lean'] is False for d in dishes)} fat")
    real.write_asset("viandier", {"dishes": dishes},
                     {"title": "Le Viandier (printed c. 1490; ed. Pichon and Vicaire, 1892)", "author": "Taillevent (Guillaume Tirel)",
                      "year": "14th c.", "source": "https://www.gutenberg.org/ebooks/26567", "licence": "public domain (Project Gutenberg)"})


if __name__ == "__main__":
    main()
