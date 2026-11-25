# mksv-pro.github.io

Personal site. `public/` is what is served; its pages are generated from `src/`.

```
public/   the site: index.html (home), about/ (the plain page), castle/, siege/, cv/ (the PDF), shinbun/, home/, assets/
src/      page templates and site.toml (all the content)
tools/    build/ (build, check, tests), assets/ (asset generators), data/
tests/    visual references
```

```bash
python3 tools/build/build.py && python3 tools/build/check.py   # rebuild after any edit
python3 tools/build/cv.py                                        # the CV PDF
python3 tools/build/smoke.py && python3 tools/build/visual.py   # browser tests (Firefox)
python3 -m http.server -d public 8765                            # preview
tools/serve.sh                                                   # rebuild + preview + open the browser
```
