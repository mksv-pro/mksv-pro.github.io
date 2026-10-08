"""Le Roman de la Rose (Guillaume de Lorris and Jean de Meun, 13th c.), for the scriptorium's copyist,
who copies it a line a minute: Project Gutenberg's text of tome I of Méon's edition (1814), with
Pierre Marteau's verse translation facing it (1878); both public domain.

  uv run python site/_tools/fetch_rose.py     (from EnvS/)

The book's even pages ([p.2], [p.4]...) are the Old French, the odd ones the translation, page for
page; the verses are the indented lines, without their line numbers and footnote calls.
Writes assets/data/real/rose.json: {n, pages: [[first line, count]...], data} where data is the
deflated JSON {"old": [lines], "new": [[page's lines]...]}, the translation kept by page (its lines
do not match the original's one for one).
"""
import base64
import json
import re
import zlib

import real

URL = "https://www.gutenberg.org/cache/epub/16816/pg16816.txt"
SKIP = re.compile(r"^\s*(LE ROMAN DE LA ROSE|[IVXLC]+\.?|\*(\s+\*)*|\[Illustration.*)\s*$")


def verses(page):
    out = []
    for ln in page.splitlines():
        if not re.match(r"^ {4,}\S", ln) or SKIP.match(ln):
            continue
        ln = re.sub(r"\[\d+\]", "", re.sub(r"\s{3,}\d+\s*$", "", ln)).strip()
        if ln and len(ln) < 60 and re.search(r"[a-zà-ÿ]", ln):  # (longer: a quotation in a note, prose)
            out.append(ln)
    return out


def main():
    txt = real.fetch(URL, "rose-1.txt", binary=False)
    txt = txt[:txt.index("*** END OF THE PROJECT GUTENBERG")]
    parts = re.split(r"\[p\.(\d+)\]", txt)
    pages = {int(parts[k]): parts[k + 1] for k in range(1, len(parts) - 1, 2)}
    old, new, index = [], [], []
    for p in sorted(pages):
        if p % 2 or p + 1 not in pages:
            continue
        a, b = verses(pages[p]), verses(pages[p + 1])
        if len(a) < 4 or not b:
            continue
        index.append([len(old), len(a)]); old += a; new.append(b)
    data = base64.b64encode(zlib.compress(json.dumps({"old": old, "new": new}, ensure_ascii=False).encode(), 9)).decode()
    print(f"  {len(old)} lines on {len(index)} pages; {old[0]!r} ... {old[-1]!r}; {len(data) // 1024} KB stored")
    real.write_asset("rose", {"n": len(old), "pages": index, "data": data},
                     {"title": "Le Roman de la Rose, tome I (ed. Méon, 1814; translated by Pierre Marteau, 1878)",
                      "author": "Guillaume de Lorris and Jean de Meun", "year": "13th c.",
                      "source": "https://www.gutenberg.org/ebooks/16816", "licence": "public domain (Project Gutenberg)"})


if __name__ == "__main__":
    main()
