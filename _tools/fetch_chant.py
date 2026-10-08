"""Gregorian chant for the chapel's offices, from GregoBase's GABC transcriptions (CC0): the notes
only, sung by sound.js's own voice (formants, a small choir), heard from the chapel at the hours.

  uv run python site/_tools/fetch_chant.py     (from EnvS/)

GABC: a syllable's text, then its neumes in parentheses; pitch letters a..m are staff positions
(the clef, c or f on line 1..4, says which letter is C or F); 'x'/'y' after a letter set or clear its
flat; '.' (mora) and '_' (episema) lengthen a note; bars ',' ';' ':' '::' are breaths of growing
length. Hymns keep their first stanza.
Writes assets/data/real/chant.json: {"chants": [{id, office, title, mode, book, text,
part (Hymnus, Antiphona), notes:
[[beats, semitones above the clef's C or null for a rest, vowel or ""]]}]}; a syllable's first note
carries its vowel (the voice's formants), a melisma's others "".
"""
import re

import real

GB = "https://gregobase.selapa.net/"
CHANTS = [  # [GregoBase id, office, first stanza only]
    (13348, "lauds", True),       # Aeterne rerum Conditor (Ambrose), Sunday lauds
    (15509, "prime", True),       # Iam lucis orto sidere
    (9733, "vespers", True),      # Ave maris stella
    (4884, "compline", True),     # Te lucis ante terminum
    (2715, "compline", False),    # Salve Regina, after compline
]
SCALE = [0, 2, 4, 5, 7, 9, 11]
BAR = {",": 0.6, "`": 0.4, ";": 1.0, ":": 1.6, "::": 2.4}
VOWEL = {"a": "a", "á": "a", "æ": "e", "e": "e", "é": "e", "i": "i", "í": "i", "y": "i", "o": "o", "ó": "o", "u": "u", "ú": "u"}


def vowel_of(syl):
    """The syllable's sung vowel: its first vowel letter (ae, oe sung e; a u after q or g is a glide)."""
    s = re.sub(r"<[^>]*>|\{|\}|[0-9.*]", "", syl).lower().replace("ae", "e").replace("oe", "e").replace("qu", "q").replace("gu", "g")
    return next((VOWEL[c] for c in s if c in VOWEL), "")


def parse(gabc, stanza):
    head, body = gabc.split("%%", 1)
    meta = dict(ln.split(":", 1) for ln in head.strip().splitlines() if ":" in ln)
    meta = {k.strip(): v.strip().rstrip(";") for k, v in meta.items()}
    clef = ("c", 4); notes = []; words = []; n_sung = 0
    for syl, grp in re.findall(r"([^()]*)\(([^)]*)\)", body):
        grp = re.sub(r"\[[^\]]*\]|<[^>]*>", "", grp).strip()
        m = re.fullmatch(r"([cf])b?([1-4])", grp)
        if m:
            clef = (m.group(1), int(m.group(2))); continue
        new = syl[:1].isspace() or not words; syl = re.sub(r"<[^>]*>|\{|\}", "", syl).strip()
        if syl and not re.fullmatch(r"[0-9.*]+", syl):
            if new:
                words.append(syl)
            else:
                words[-1] += syl
        base = 1 + 2 * clef[1]  # (the letter on the clef's line: d, f, h, j for lines 1..4)
        v = vowel_of(syl); flats = set(); i = 0; first = True
        while i < len(grp):
            c = grp[i]
            if c == ":" and grp[i + 1:i + 2] == ":":
                c = "::"; i += 1
            if c in BAR:
                if notes and notes[-1][1] is not None:
                    notes[-1][0] *= 1.3  # (the phrase's last note held)
                    notes.append([BAR[c], None, ""])
                if c == "::" and stanza and n_sung >= 25:
                    return meta, notes, " ".join(words)
            elif c.lower() in "abcdefghijklm":
                nxt = grp[i + 1:i + 2]
                if nxt == "+":  # (a custos: the next line's first note, not sung)
                    i += 2; continue
                if nxt in ("x", "y"):
                    (flats.add if nxt == "x" else flats.discard)(c.lower()); i += 2; continue
                deg = "abcdefghijklm".index(c.lower()) - base + (3 if clef[0] == "f" else 0)
                semi = 12 * (deg // 7) + SCALE[deg % 7] - (1 if c.lower() in flats else 0)
                notes.append([1.0, semi, v if first else ""]); first = False; n_sung += 1
            elif c == "." and notes and notes[-1][1] is not None:
                notes[-1][0] = 1.9
            elif c == "_" and notes and notes[-1][1] is not None:
                notes[-1][0] = max(notes[-1][0], 1.4)
            i += 1
    return meta, notes, " ".join(words)


def main():
    chants = []; credits = []
    for cid, office, stanza in CHANTS:
        url = f"{GB}download.php?id={cid}&format=gabc&elem=1"
        meta, notes, text = parse(real.fetch(url, f"chant-{cid}.gabc", binary=False), stanza)
        while notes and notes[-1][1] is None:
            notes.pop()
        title = meta.get("name", "").strip()
        chants.append({"id": cid, "office": office, "title": title, "part": meta.get("office-part", ""), "mode": meta.get("mode", ""), "book": meta.get("book", ""),
                       "text": re.sub(r"^(\w)(\w+)", lambda m: m.group(1) + m.group(2).lower(), re.sub(r"\s+([,.;:])", r"\1", re.sub(r"\s*\*\s*", " ", text))), "notes": [[round(d, 2), s, v] for d, s, v in notes]})
        credits.append({"title": title, "author": f"Gregorian chant, as in {meta.get('book', 'a chant book')}", "year": "",
                        "source": f"{GB}chant.php?id={cid}", "licence": "CC0 (GregoBase transcription" + (f" by {meta['transcriber']}" if meta.get("transcriber") else "") + ")"})
        sung = [s for _, s, _ in notes if s is not None]
        print(f"  {cid:6d} {office:9s} {title:28s} {len(sung):3d} notes, range {min(sung)}..{max(sung)}, {sum(d for d, _, _ in notes):.0f} beats")
        print("        ", chants[-1]["text"][:90])
    real.write_asset("chant", {"chants": chants}, credits)


if __name__ == "__main__":
    main()
