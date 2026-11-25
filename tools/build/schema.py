"""src/site.toml against src/site.schema.json, then the references between entries.

  python3 tools/build/schema.py        (also run by check.py)

The JSON Schema subset the schema uses: type, enum, required, properties, additionalProperties,
items, minItems, maxItems, minLength, pattern, minimum, $ref (local). Each problem is reported with
the line of site.toml it is about: tomllib keeps no positions, so the line is found again in the
text (the k-th [[table]] header, then the key under it). Stdlib only.
"""
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"  # (what is served)
TOML = ROOT / "src" / "site.toml"
SCHEMA = ROOT / "src" / "site.schema.json"
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "number": (int, float)}


def validate(v, s, root, path, out):
    if "$ref" in s:
        s = root["$defs"][s["$ref"].rsplit("/", 1)[1]]
    if "oneOf" in s:  # the first branch whose type fits decides
        fit = [b for b in s["oneOf"] if isinstance(v, TYPES[b["type"]])]
        if not fit:
            out.append((path, f"should be one of {[b['type'] for b in s['oneOf']]}"))
            return
        s = fit[0]
    t = s.get("type")
    if t == "integer":
        ok = isinstance(v, int) and not isinstance(v, bool)
    elif t:
        ok = isinstance(v, TYPES[t]) and not (t == "number" and isinstance(v, bool))
    else:
        ok = True
    if not ok:
        out.append((path, f"should be {t}, is {type(v).__name__}"))
        return
    if "enum" in s and v not in s["enum"]:
        out.append((path, f"{v!r} is not one of {s['enum']}"))
    if isinstance(v, str):
        if len(v) < s.get("minLength", 0):
            out.append((path, "is empty"))
        if "pattern" in s and not re.search(s["pattern"], v):
            out.append((path, f"{v!r} does not match {s['pattern']}"))
    if isinstance(v, int) and "minimum" in s and v < s["minimum"]:
        out.append((path, f"{v} < {s['minimum']}"))
    if isinstance(v, list):
        if len(v) < s.get("minItems", 0) or len(v) > s.get("maxItems", 1 << 30):
            out.append((path, f"has {len(v)} items"))
        if "items" in s:
            for i, x in enumerate(v):
                validate(x, s["items"], root, path + [i], out)
    if isinstance(v, dict):
        props = s.get("properties", {})
        for k in s.get("required", []):
            if k not in v:
                out.append((path, f"lacks {k!r}"))
        for k, x in v.items():
            if k in props:
                validate(x, props[k], root, path + [k], out)
            elif s.get("additionalProperties") is False:
                out.append((path + [k], "is not a known field (a typo?)"))
            elif isinstance(s.get("additionalProperties"), dict):
                validate(x, s["additionalProperties"], root, path + [k], out)


def references(d):
    """What the schema cannot say: ids that must name something else in the file."""
    out = []
    rooms = d["world"]["rooms"]
    arms = {e["arms"] for e in d["experience"] if e.get("arms")}
    works = {w["id"] for w in d["work"]}
    shelves = {s[0] for s in d.get("library", {}).get("shelves", [])}
    if set(d["tabs"]) != set(rooms):
        out.append((["tabs"], f"tabs and world.rooms differ: {sorted(set(d['tabs']) ^ set(rooms))}"))
    for k in d["tabs"]:
        if k not in d["tab_hints"]:
            out.append((["tab_hints"], f"no hint for tab {k!r}"))
    for i, (a, b) in enumerate(d["world"]["links"]):
        for r in (a, b):
            if r not in rooms:
                out.append((["world", "links", i], f"no room {r!r}"))
        if abs(rooms.get(a, {}).get("c", 0) - rooms.get(b, {}).get("c", 0)) + abs(rooms.get(a, {}).get("r", 0) - rooms.get(b, {}).get("r", 0)) != 1:
            out.append((["world", "links", i], f"{a} and {b} are not next to each other on the grid"))
    for i, w in enumerate(d["work"]):
        if w.get("at") and w["at"] not in arms:
            out.append((["work", i, "at"], f"no experience with arms {w['at']!r}"))
        if not (PUBLIC / "assets" / "img" / w["img"]).exists():
            out.append((["work", i, "img"], f"assets/img/{w['img']} is missing"))
    if len(works) != len(d["work"]):
        out.append((["work"], "two works share an id"))
    for i, p in enumerate(d["publications"]):
        if p.get("work") and p["work"] not in works:
            out.append((["publications", i, "work"], f"no work {p['work']!r}"))
        if p.get("bib") and not (PUBLIC / "assets" / "bib" / p["bib"]).exists():
            out.append((["publications", i, "bib"], f"assets/bib/{p['bib']} is missing"))
    for i, v in enumerate(d.get("library", {}).get("volumes", [])):
        if v["shelf"] not in shelves:
            out.append((["library", "volumes", i, "shelf"], f"no shelf {v['shelf']!r}"))
    for key in ("news", "experience", "work"):
        dates = [e.get("from") or e.get("date") for e in d[key]]
        if any(a[:len(b)] < b[:len(a)] for a, b in zip(dates, dates[1:])):  # ("2026" is not older than "2026-01")
            out.append(([key], "not newest first"))
    return out


def line_of(text, path):
    """The line of site.toml that `path` (keys and indices) points at, best effort."""
    lines = text.splitlines()
    at = 0
    for k, nxt in zip(path, path[1:] + [None]):
        if isinstance(k, str) and isinstance(nxt, int) and not isinstance(nxt, bool):
            heads = [j for j, s in enumerate(lines) if s.strip() == f"[[{k}]]"]
            if len(heads) > nxt:
                at = heads[nxt]
                continue
        if isinstance(k, str):
            for j in range(at, len(lines)):
                if re.match(rf"\s*(\[{re.escape(k)}\]|\[[\w.]*\b{re.escape(k)}\]|{re.escape(k)}\s*=)", lines[j]):
                    at = j
                    break
    return at + 1


def problems():
    text = TOML.read_text()
    d = tomllib.loads(text)
    schema = json.loads(SCHEMA.read_text())
    out = []
    validate(d, schema, schema, [], out)
    if not out:
        out = references(d)
    return [f"site.toml:{line_of(text, p)}: {'.'.join(map(str, p)) or '(top)'} {m}" for p, m in out]


if __name__ == "__main__":
    ps = problems()
    print("\n".join(ps) or "site.toml: fine")
    sys.exit(1 if ps else 0)
