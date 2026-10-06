# mksv-pro.github.io

Le site, sources et pages générées dans le même dépôt ; GitHub Pages sert `main` (racine). Deux thèmes, choisis selon l'écran : en dessous de
75rem (1200 px) le terminal (TUI roguelike) ; au-dessus, « hours » (pixel art), sauf si le
visiteur a choisi le terminal. Les pages HTML à la racine et dans `projects/`
sont **générées** : on édite `_src/`, puis on reconstruit. Le contenu (entrées, liens, grille
des salles) vit dans `_src/site.toml` ; ajouter une publication, une news ou un exposé, c'est
une entrée là, rien d'autre.

| chemin | rôle |
|---|---|
| `_src/site.toml` | les données : URLs, entrées (research, projects, publications, talks, teaching, news), la grille des salles et ses portes |
| `_src/*.html`, `_src/projects/` | gabarits : `{{> partial}}`, `{{token}}`, `{{list:…}}`, `{{exits:salle}}` |
| `_src/partials/` | en-tête, haut de page (planche, onglets), bas de page (console, ligne d'état) |
| `styles.css`, `script.js` | écrits à la main, servis tels quels ; `script.js` = fenêtres, thèmes, pièces, dialogues, raccourcis, almanach |
| `assets/js/sky.js` | soleil, lune, heures planétaires, cercles de l'armillaire (fonctions pures, chargé avant `script.js`) |
| `assets/js/cmdline.js`, `armillary.js` | la ligne de commande `:` (Tab complète) ; la sphère armillaire (tourne seulement visible) |
| `assets/js/demo.js` | le canevas 1 bit des démos, ajouté par `build.py` aux pages qui ont des `scripts:` |
| `assets/js/dla.js`, `nbody.js` | démos des pages projet |
| `assets/js/dungeon.js` | la descente (`>`) : vue 3D du site, chargée à la demande |
| `assets/js/hours.js` | le thème « hours », chargé avec lui : paysage pixel art pleine page sous le ciel réel de Paris (sept plans, parallaxe à la souris ; château, rivière et pont, chevalier, sorcier qui tient le menu, chats, dragon). Chaque section est une pièce du château : le menu l'allume, le clic zoome dedans ; ce qu'elle contient y est dessiné en objets (liste faite par `roomItems` dans `script.js`), un clic ouvre une fiche ; Échap ressort. Une page projet est l'atelier, son texte sur le plan du chevalet. La campagne suit l'heure, la saison et la météo réelles : feuillus de saison, vigne derrière le hameau, moulin dont les ailes tournent au vent de Paris, tour de guet et son feu la nuit, saule et nénuphars ; cheval du chevalier, héron, canards, cerfs à l'aube et au crépuscule, chauves-souris, chouette la nuit, oies à l'automne, hirondelles l'été ; arc-en-ciel (pluie et soleil bas), brume de l'aube sur la rivière, étoiles filantes selon le calendrier des essaims. Aperçus : `?season=`, `?weather=`, `?meteors`. Petits événements : la cloche à chaque heure planétaire, le passeur sur la rivière, le dragon qui se pose sur la tour en mode Konami, ta bannière hissée sur le donjon une fois les 11 pièces vues, la porte de la cave (descente `>`), des portes entre les pièces, le royaume (Paris héraldique) dans la carte `m`. `?theme=hours&sky=dusk` ou `:sky night` pour prévisualiser une heure |
| `[world]` dans `site.toml` | la grille des salles : les « Obvious exits » (thème terminal), la carte `m` et la descente en dérivent (JSON injecté dans chaque page) |
| `assets/bib/*.bib` | une entrée BibTeX par publication (le lien `[bib]` la copie) |
| `assets/fonts/` | polices auto-hébergées (aucune requête tierce) ; Departure Mono, IBM Plex Mono (entière : Reserved Font Name) |
| `_tools/build.py` | génère les pages, `sitemap.xml`, `robots.txt`, `feed.xml` (Atom des news), les `?v=` anti-cache (`{{v:chemin}}`) ; CI : `.github/workflows/check.yml` (build inchangé, check, lint) |
| `_tools/check.py` | liens, ancres, ids, alt, placeholders, contraste ; `--external`, `--shots DIR` |
| `_config.yml` | dit à GitHub Pages (Jekyll) de ne pas publier README, `deno.json`, `pyproject.toml` ; `_src/` et `_tools/` sont déjà ignorés (préfixe `_`) |
| `_tools/icons.py` | icônes pixel du thème hours : `_tools/icons.txt` (dessins ASCII) → `assets/img/icons/*.svg` ; cadre pixel des boîtes (`frame.svg`) et curseur du menu (`cursor.svg`) |
| `_tools/arms.txt` | blasons du thème hours, d'après l'emblème et les couleurs de chaque établissement (pas une copie des logos) ; `_tools/icons.py` en tire `assets/img/arms/*.svg` et `assets/js/arms.js` ; le parcours (tapisseries murales) dans `[heraldry]` de `site.toml` |
| `_tools/trame.py` | vignettes de projet tramées façon *Vermis* pour le thème hours (`assets/img/trame-*.png`) ; `uv run` (NumPy, Pillow) |
| `_tools/make_assets.py` | images (gravure, enluminures, monogramme, `og`, figures du mémoire) ; Pillow + NumPy |
| `_tools/illuminations.py` | les vignettes pixel des projets (`assets/img/illum-*.png`) |

```bash
python3 _tools/build.py && python3 _tools/check.py          # après chaque modification
deno lint && uvx ruff check _tools                            # lint (config : deno.json, pyproject.toml)
python3 -m http.server 8765 --bind 127.0.0.1                # aperçu local
git add -A && git commit -m "…" && git push                   # publier (en ligne 1 à 2 min après)
```
