"""Paris on the watchtower's northern horizon, as it would stand seen from the terrace of Meudon: its
monuments (those standing by 1920: the landscape is an old one) where OpenStreetMap puts them, as tall as OSM says (© OpenStreetMap contributors, ODbL),
on the ground's true height (SRTM, 30 m; public domain, through the OpenTopoData API).

  uv run python site/_tools/fetch_paris.py     (from EnvS/)

For each monument: its bearing and distance from the viewpoint (on the sphere), the angle of its top
above the eye's level (its ground + its height - the eye's height, less the Earth's curvature,
d^2 (1 - k) / 2R with refraction k = 0.13). The city's roofs: along each bearing, every 500 m from 3
to 14 km, the highest angle of the ground + 20 m (Paris's six storeys).
Writes assets/data/real/paris.json: {"eye": [lat, lon, m], "monuments": [{name, az, d km, alt deg,
h m, kind}], "roofs": [[az, alt deg]...]} (az: degrees from north).
"""
import json
import math
import time
import urllib.parse

import real

EYE = (48.8058, 2.2326, 10.0)  # the terrace of the Meudon observatory; the eye 10 m over it (a tower)
OVERPASS = "https://overpass-api.de/api/interpreter?data="
TOPO = "https://api.opentopodata.org/v1/srtm30m?locations="
MONUMENTS = [  # [OSM element (a building part when the whole has no height), the name to say, its shape]; Paris before 1920 only
    ("way/5013364", "the Eiffel Tower (1889)", "eiffel"), ("way/23762981", "the Sacré-Cœur on Montmartre (1914)", "domes"),
    ("way/201611269", "the south tower of Notre-Dame (1250)", "tower"), ("way/201754180", "the north tower of Notre-Dame (1240)", "tower"),
    ("way/1299835416", "the spire of Notre-Dame (1859, rebuilt 2024)", "spire"), ("way/227662030", "the dome of the Invalides (1706)", "dome"),
    ("way/1200917614", "the dome of the Panthéon (1790)", "dome"), ("way/1460576494", "the north tower of Saint-Sulpice (1780)", "tower"),
    ("way/1460576491", "the south tower of Saint-Sulpice (1749)", "tower"), ("way/1458521344", "the dome of the Val-de-Grâce (1667)", "dome"),
    ("way/20326709", "the tour Saint-Jacques (1523)", "tower"), ("relation/3344870", "the spire of the Sainte-Chapelle (1248)", "spire"),
    ("way/54667456", "the Opéra (1875)", "dome"), ("way/226413508", "the Arc de Triomphe (1836)", "arch"),
]
R = 6371000.0


def topo(points):
    """Ground heights (m) at [(lat, lon)], 100 a request, a second apart (the API's limits)."""
    out = []
    for k in range(0, len(points), 100):
        q = "|".join(f"{a:.5f},{b:.5f}" for a, b in points[k:k + 100])
        out += [r["elevation"] for r in json.loads(real.fetch(TOPO + q, f"topo-{k}-{len(points)}.json", binary=False))["results"]]
        time.sleep(1.1)
    return out


def bearing(lat, lon):
    p1, p2, dl = math.radians(EYE[0]), math.radians(lat), math.radians(lon - EYE[1])
    az = math.degrees(math.atan2(math.sin(dl) * math.cos(p2), math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl))) % 360
    d = 2 * R * math.asin(math.sqrt(math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
    return az, d


def dest(az, d):
    p1, l1, a = math.radians(EYE[0]), math.radians(EYE[1]), math.radians(az)
    p2 = math.asin(math.sin(p1) * math.cos(d / R) + math.cos(p1) * math.sin(d / R) * math.cos(a))
    return math.degrees(p2), math.degrees(l1 + math.atan2(math.sin(a) * math.sin(d / R) * math.cos(p1), math.cos(d / R) - math.sin(p1) * math.sin(p2)))


def angle(top, d, eye):
    return math.degrees(math.atan2(top - eye - d * d * (1 - 0.13) / (2 * R), d))


def main():
    q = "[out:json][timeout:60];(" + "".join(f"{t.split('/')[0]}({t.split('/')[1]});" for t, _, _ in MONUMENTS) + ");out center tags;"
    els = {f"{e['type']}/{e['id']}": e for e in json.loads(real.fetch(OVERPASS + urllib.parse.quote(q), "overpass-paris.json", binary=False))["elements"]}
    found = [(els[t], name, kind) for t, name, kind in MONUMENTS if t in els]
    pts = [(e["center"]["lat"], e["center"]["lon"]) for e, _, _ in found]
    azs = [20 + k for k in range(0, 56)]  # (the city's span from here, every degree)
    ray = [(a, d) for a in azs for d in range(3000, 14001, 500)]
    ground = topo([EYE[:2]] + pts + [dest(a, d) for a, d in ray])
    eye = ground[0] + EYE[2]
    mons = []
    for (e, name, kind), g in zip(found, ground[1:1 + len(found)]):
        h = float(e["tags"]["height"].split()[0]); az, d = bearing(*(e["center"]["lat"], e["center"]["lon"]))
        mons.append({"name": name, "az": round(az, 2), "d": round(d / 1000, 2), "alt": round(angle(g + h, d, eye), 3), "h": h, "ground": round(g), "kind": kind})
        print(f"  {name:42s} az {az:6.2f}  {d / 1000:5.2f} km  ground {g:5.0f} m  +{h:5.0f} m  alt {mons[-1]['alt']:+.2f} deg")
    roofs = {}
    for (a, d), g in zip(ray, ground[1 + len(found):]):
        roofs[a] = max(roofs.get(a, -90), angle(g + 20, d, eye))
    print(f"  eye at {eye:.0f} m; roofs from {min(roofs.values()):+.2f} to {max(roofs.values()):+.2f} deg")
    real.write_asset("paris", {"eye": [EYE[0], EYE[1], round(eye)], "monuments": mons, "roofs": [[a, round(v, 3)] for a, v in sorted(roofs.items())]}, [
        {"title": "Paris's monuments and their heights", "author": "OpenStreetMap contributors", "year": "2026", "source": "https://www.openstreetmap.org/copyright", "licence": "ODbL (© OpenStreetMap contributors)"},
        {"title": "The ground's height (SRTM 30 m, through OpenTopoData)", "author": "NASA / USGS", "year": "2000", "source": "https://www.opentopodata.org/datasets/srtm/", "licence": "public domain"},
    ])


if __name__ == "__main__":
    main()
