# site-next

Nouvelle version de mksv-pro.github.io. Les pages HTML à la racine et dans `projects/`
sont **générées** : on édite `_src/`, puis on reconstruit.

| chemin | rôle |
|---|---|
| `_src/*.html`, `_src/projects/` | gabarits : `{{> partial}}`, `{{token}}` |
| `_src/partials/` | en-tête, haut de page (planche, onglets), bas de page (console, ligne d'état) |
| `styles.css`, `script.js` | écrits à la main, servis tels quels |
| `assets/js/dla.js`, `nbody.js` | démos des pages projet |
| `assets/js/dungeon.js` | la descente (`>`) : vue 3D du site, chargée à la demande |
| `WORLD` / `LINKS` en tête de `script.js` | la grille des salles (carte `m`, descente) ; garder en phase avec les « Obvious exits » des gabarits |
| `assets/bib/*.bib` | une entrée BibTeX par publication (le lien `[bib]` la copie) |
| `_tools/build.py` | génère les pages, `sitemap.xml`, `robots.txt`, les `?v=` anti-cache (CV, CSS, JS) |
| `_tools/check.py` | liens, ancres, ids, alt, placeholders, contraste ; `--external`, `--shots DIR` |
| `_tools/deploy.py` | build + check + rsync vers `../site/` (dry run ; `--apply`, `--commit`) ; ne pousse jamais |
| `_tools/make_assets.py` | images (gravure, enluminures, monogramme, `og`, figures du mémoire) ; Pillow + NumPy |

```bash
python3 _tools/build.py && python3 _tools/check.py          # après chaque modification
python3 -m http.server 8765 --bind 127.0.0.1                # aperçu local
python3 _tools/deploy.py --commit && git -C ../site push -f  # publier
```
