"""What the knight quotes by the fire: lines on the weather, the seasons and the hours from old books,
cut out of Project Gutenberg's texts (public domain): the King James Bible (1611), Shakespeare,
Chaucer, Villon, Hesiod (Evelyn-White's translation, 1914) and Virgil's Georgics (James Rhoades's,
1881), whose first book is a farmer's manual of weather signs.

  uv run python site/_tools/fetch_quotes.py     (from EnvS/)

Each quotation is the text from its first words to its last (QUOTES: the anchors), whitespace
joined, verse numbers, glosses and footnote calls taken out; a missing anchor stops the script.
`keys` say when it fits: the weather (clear, cloudy, rain, storm, snow, fog, wind, frost), the
season, the time of day (dawn, day, dusk, night), a month (jan..dec).
Writes assets/data/real/quotes.json: {"quotes": [{text, author, work, ref, keys}]}.
"""
import re

import real

G = "https://www.gutenberg.org/cache/epub/{0}/pg{0}.txt"
BOOKS = {10: ("King James Bible", "1611"), 100: ("Shakespeare", ""), 2383: ("Geoffrey Chaucer", "c. 1400"),
         12246: ("François Villon", "1461"), 348: ("Hesiod, tr. H. G. Evelyn-White", "1914"), 232: ("Virgil, tr. James Rhoades", "1881")}
QUOTES = [  # [book, first words, last words, author, work and place, keys]
    (10, "He giveth snow like wool", "hoarfrost like ashes.", "the King James Bible", "Psalm 147:16", "snow frost winter"),
    (10, "Hast thou entered into the treasures of the snow", "treasures of the hail", "the King James Bible", "Job 38:22", "snow storm winter"),
    (10, "The wind goeth toward the south", "according to his circuits.", "the King James Bible", "Ecclesiastes 1:6", "wind"),
    (10, "To every thing there is a season", "under the heaven:", "the King James Bible", "Ecclesiastes 3:1", "any"),
    (10, "He that observeth the wind shall not sow", "shall not reap.", "the King James Bible", "Ecclesiastes 11:4", "wind cloudy"),
    (10, "For, lo, the winter is past", "is heard in our land;", "the King James Bible", "Song of Solomon 2:11-12", "spring clear apr may"),
    (10, "When it is evening, ye say, It will be fair weather", "for the sky is red.", "the King James Bible", "Matthew 16:2", "dusk clear"),
    (10, "And in the morning, It will be foul weather", "red and lowering.", "the King James Bible", "Matthew 16:3", "dawn cloudy rain"),
    (10, "While the earth remaineth", "shall not cease.", "the King James Bible", "Genesis 8:22", "any"),
    (10, "The heavens declare the glory of God", "sheweth his handywork.", "the King James Bible", "Psalm 19:1", "night clear"),
    (100, "Blow, winds, and crack your cheeks", "drown'd the cocks!", "Shakespeare", "King Lear, III.2 (1606)", "storm wind rain"),
    (100, "When that I was and a little tiny boy", "raineth every day.", "Shakespeare", "Twelfth Night, V.1 (c. 1601), Feste's song", "rain"),
    (100, "When icicles hang by the wall", "frozen home in pail,", "Shakespeare", "Love's Labour's Lost, V.2 (c. 1595)", "frost snow winter"),
    (100, "But look, the morn in russet mantle clad", "eastward hill.", "Shakespeare", "Hamlet, I.1 (c. 1600)", "dawn"),
    (100, "Night's candles are burnt out", "misty mountain tops.", "Shakespeare", "Romeo and Juliet, III.5 (c. 1595)", "dawn fog"),
    (100, "So foul and fair a day I have not seen.", "So foul and fair a day I have not seen.", "Shakespeare", "Macbeth, I.3 (1606)", "cloudy rain wind"),
    (100, "Fair is foul, and foul is fair", "filthy air.", "Shakespeare", "Macbeth, I.1 (1606), the witches", "fog"),
    (100, "Shall I compare thee to a summer's day?", "darling buds of May,", "Shakespeare", "Sonnet 18 (1609)", "summer clear may jun"),
    (100, "That time of year thou mayst in me behold", "late the sweet birds sang.", "Shakespeare", "Sonnet 73 (1609)", "autumn"),
    (100, "We are such stuff", "rounded with a sleep.", "Shakespeare", "The Tempest, IV.1 (1611)", "night"),
    (2383, "WHEN that Aprilis, with his showers swoot", "pierced to the root,", "Geoffrey Chaucer", "The Canterbury Tales, General Prologue (c. 1400; modernised spelling)", "spring rain apr"),
    (12246, "Mais où sont les neiges d'antan!", "Mais où sont les neiges d'antan!", "François Villon", "Ballade des dames du temps jadis (1461): \"But where are the snows of yesteryear?\" (Rossetti's English, 1870)", "snow winter"),
    (348, "Avoid the month Lenaeon", "when Boreas blows over the earth.", "Hesiod", "Works and Days (c. 700 BC; tr. Evelyn-White, 1914)", "winter frost wind jan"),
    (232, "So too, after rain", "to float along the sky.", "Virgil", "Georgics, book I (29 BC; tr. Rhoades, 1881)", "clear"),
    (232, "When first the moon recalls her rallying fires", "A mighty rain is brewing;", "Virgil", "Georgics, book I (tr. Rhoades)", "night rain cloudy"),
    (232, "Then the crow", "mateless and alone.", "Virgil", "Georgics, book I (tr. Rhoades)", "cloudy rain"),
    (232, "Oft, too, the ant from out her inmost cells", "her eggs conveys;", "Virgil", "Georgics, book I (tr. Rhoades)", "cloudy summer"),
    (232, "Upon the sun's own face strange colours stray;", "of east winds fiery-red;", "Virgil", "Georgics, book I (tr. Rhoades)", "dusk"),
    (232, "But when from regions of the furious North", "furls his dripping sails.", "Virgil", "Georgics, book I (tr. Rhoades)", "storm"),
    (232, "then to set Snares for the crane", "streams are drifting ice.", "Virgil", "Georgics, book I (tr. Rhoades)", "winter snow frost"),
]


def clean(t):
    t = t.replace("’", "'").replace("‘", "'").replace("_", "")
    t = re.sub(r"\*\S+", "", t)  # (Chaucer's glosses, *sweet)
    t = re.sub(r"\b\d+:\d+\s", "", t)  # (Bible verse numbers)
    t = re.sub(r"(?<=[a-z]) \d{3,4}(?=[,. ])", "", t)  # (Evelyn-White's note calls)
    t = re.sub(r"\(ll\. [\d-]+\)", "", t)
    return re.sub(r"\s+", " ", t).strip()


def main():
    texts = {b: clean(real.fetch(G.format(b), f"gutenberg-{b}.txt", binary=False)) for b in BOOKS}
    quotes = []
    for b, a, z, author, work, keys in QUOTES:
        t = texts[b]; i = t.find(clean(a)); assert i >= 0, (b, a)
        j = t.find(clean(z), i); assert j >= 0 and j - i < 600, (b, z)
        text = t[i:j + len(clean(z))]; text = text[0].upper() + text[1:]
        quotes.append({"text": text, "author": author, "work": work, "keys": keys.split()})
        print(f"  {author[:16]:16s} {text[:100]}")
    real.write_asset("quotes", {"quotes": quotes}, [
        {"title": BOOKS[b][0] + " (the knight's quotations)", "author": BOOKS[b][0], "year": BOOKS[b][1],
         "source": f"https://www.gutenberg.org/ebooks/{b}", "licence": "public domain (Project Gutenberg)"} for b in BOOKS])


if __name__ == "__main__":
    main()
