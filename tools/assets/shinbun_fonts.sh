#!/bin/sh
# The newspaper page's fonts, cut down to the characters it uses (a Japanese font whole is 2-15 MB).
#   sh site/tools/assets/shinbun_fonts.sh DIR      (from EnvS/; DIR holds the source TTFs, from google/fonts:
#   ofl/shipporiminchob1/ShipporiMinchoB1-ExtraBold.ttf, ofl/delagothicone/DelaGothicOne-Regular.ttf)
# Run after python3 site/tools/build/build.py whenever the page's Japanese changes; then build again (?v=).
set -eu
src=$1; site=$(dirname "$0")/../../public; out=$site/assets/fonts
cjk=$(python3 -c "import sys; t = open(sys.argv[1]).read(); print(''.join(sorted({c for c in t if ord(c) > 0x2E7F})))" "$site/shinbun/index.html")
uvx --from 'fonttools[woff]' pyftsubset "$src/ShipporiMinchoB1-ExtraBold.ttf" --text="$cjk〇一二三四五六七八九十年月日曜第號令和" --unicodes='U+20,U+25B2-25BC,U+25CB' --flavor=woff2 --output-file="$out/ShipporiMinchoB1-sub.woff2"
uvx --from 'fonttools[woff]' pyftsubset "$src/DelaGothicOne-Regular.ttf" --text="$cjk" --unicodes='U+20-7E,U+A0-FF,U+2013,U+2014,U+2019,U+2192' --flavor=woff2 --output-file="$out/DelaGothicOne-sub.woff2"
ls -la "$out"/ShipporiMinchoB1-sub.woff2 "$out"/DelaGothicOne-sub.woff2
