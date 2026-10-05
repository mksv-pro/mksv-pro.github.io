# site-next

Nouvelle version de mksv-pro.github.io. Les pages HTML à la racine et dans `projects/`
sont **générées** : on édite `_src/`, puis on reconstruit. Le contenu (entrées, liens, grille
des salles) vit dans `_src/site.toml` ; ajouter une publication, une news ou un exposé, c'est
une entrée là, rien d'autre.

| chemin | rôle |
|---|---|
| `_src/site.toml` | les données : URLs, entrées (research, projects, publications, talks, teaching, news), la grille des salles et ses portes |
| `_src/*.html`, `_src/projects/` | gabarits : `{{> partial}}`, `{{token}}`, `{{list:…}}`, `{{exits:salle}}` |
| `_src/partials/` | en-tête, haut de page (planche, onglets), bas de page (console, ligne d'état) |
| `styles.css`, `script.js` | écrits à la main, servis tels quels |
| `assets/js/dla.js`, `nbody.js` | démos des pages projet |
| `assets/js/dungeon.js` | la descente (`>`) : vue 3D du site, chargée à la demande |
| `[world]` dans `site.toml` | la grille des salles : les « Obvious exits », la carte `m` et la descente en dérivent (JSON injecté dans chaque page) |
| `assets/bib/*.bib` | une entrée BibTeX par publication (le lien `[bib]` la copie) |
| `assets/fonts/` | polices auto-hébergées (aucune requête tierce) ; Plex et Unifraktur entières (Reserved Font Name), EB Garamond sous-ensemble |
| `_tools/build.py` | génère les pages, `sitemap.xml`, `robots.txt`, `feed.xml` (Atom des news), les `?v=` anti-cache (CV, CSS, JS) |
| `_tools/check.py` | liens, ancres, ids, alt, placeholders, contraste ; `--external`, `--shots DIR` |
| `_tools/deploy.py` | build + check + rsync vers `../site/` (dry run ; `--apply`, `--commit`) ; ne pousse jamais |
| `_tools/make_assets.py` | images (gravure, enluminures, monogramme, `og`, figures du mémoire) ; Pillow + NumPy |

```bash
python3 _tools/build.py && python3 _tools/check.py          # après chaque modification
python3 -m http.server 8765 --bind 127.0.0.1                # aperçu local
python3 _tools/deploy.py --commit && git -C ../site push -f  # publier
```
