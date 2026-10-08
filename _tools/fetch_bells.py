"""Two bells of Notre-Dame de Paris, from recordings on Wikimedia Commons (CC0): Emmanuel, the great
bourdon (cast 1686, F#2, about 13 t), for the castle's hour bell, and Marcel (cast 2013), for the
chapel's. What the castle keeps is each bell's partials, measured: sound.js strikes them itself.

  uv run python site/_tools/fetch_bells.py     (from EnvS/; needs ffmpeg)

Each recording decoded to mono 22.05 kHz; its first strike found (the energy's first jump); the
spectrum of the 1.5 s after it (Hann window, zero-padded) gives the partials (the strongest peaks
between 50 Hz and 4 kHz, each at least a quarter-tone from a stronger one); each partial's decay is
the slope of its band's level (dB/s) between two strokes of the swinging bell (a least-squares
line; the median over the strokes): tau = 8.69 / slope, the time it takes to fall by e (capped at 20 s).
Writes assets/data/real/bells.json: {"bells": {id: {name, year, partials: [[Hz, amp 0..1, tau s]]}}}.
"""
import subprocess

import numpy as np
from scipy.signal import find_peaks, stft

import real

SR = 22050
BELLS = [  # [id, Commons file, name, year]
    ("emmanuel", "ND G1 Emmanuel.ogg", "Emmanuel, the great bourdon of Notre-Dame", "1686"),
    ("marcel", "Cloche Marcel Notre Dame de Paris.ogg", "Marcel, a bell of Notre-Dame's north tower", "2013"),
]
N_PARTIALS = 12


def decode(data):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "-", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         input=data, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(float)


def partials(y):
    hop = 256; e = np.convolve(y ** 2, np.ones(hop) / hop, "same")[::hop]
    on = int(np.argmax(e > 0.2 * e.max())) * hop  # (the first strike: where the energy first comes near its peak)
    seg = y[on:on + int(1.5 * SR)] * np.hanning(int(1.5 * SR))
    spec = np.abs(np.fft.rfft(seg, 1 << 17)); f = np.fft.rfftfreq(1 << 17, 1 / SR)
    band = (f > 50) & (f < 4000)
    pk, _ = find_peaks(np.where(band, spec, 0), distance=8)
    pk = pk[np.argsort(spec[pk])[::-1]]
    keep = []
    for p in pk:
        if all(abs(np.log2(f[p] / f[q])) > 1 / 24 for q in keep):
            keep.append(p)
        if len(keep) == N_PARTIALS:
            break
    fr, tt, Z = stft(y, SR, nperseg=2048, noverlap=1792)
    hi = 20 * np.log10(np.abs(Z[(fr > 1000) & (fr < 4000)]).sum(0) + 1e-9)  # (a strike: the clapper's clang, high up)
    rise = hi - np.array([hi[max(0, k - 40):k + 1].min() for k in range(len(hi))])
    strikes, _ = find_peaks(np.where(rise > 8, hi, -999), distance=int(1.2 / (tt[1] - tt[0])))
    out = []
    for p in sorted(keep, key=lambda q: f[q]):
        lv = 20 * np.log10(np.abs(Z[np.abs(fr - f[p]) < 8]).sum(0) + 1e-9)
        slopes = []
        for a, b in zip(strikes, strikes[1:]):  # (between two strikes, the bell rings freely)
            m = (tt > tt[a] + 0.15) & (tt < tt[b] - 0.1)
            if m.sum() > 8:
                slopes.append(np.polyfit(tt[m], lv[m], 1)[0])
        slope = float(np.median(slopes)) if slopes else -3.0
        out.append([round(float(f[p]), 1), round(float(spec[p] / spec[keep[0]]), 3), round(float(np.clip(8.686 / max(1e-3, -slope), 0.3, 20)), 2)])
    print(f"    {len(strikes)} strikes, every {np.median(np.diff(tt[strikes])):.1f} s")
    return out


def main():
    bells = {}; credits = []
    for bid, fname, name, year in BELLS:
        url, lic, page = real.commons_url(f"File:{fname}")
        assert real.free(lic), (fname, lic)
        ps = partials(decode(real.fetch(url, f"bell-{bid}.ogg")))
        bells[bid] = {"name": name, "year": year, "partials": ps}
        credits.append({"title": f"Bell {name.split(',')[0]} (recording; its partials measured)", "author": "Notre-Dame de Paris", "year": year, "source": page, "licence": lic})
        print(f"  {bid}:"); [print(f"    {hz:7.1f} Hz  {a:5.3f}  tau {tau:5.2f} s  ({hz / ps[0][0]:.3f} x the lowest)") for hz, a, tau in ps]
    real.write_asset("bells", {"bells": bells}, credits)


if __name__ == "__main__":
    main()
