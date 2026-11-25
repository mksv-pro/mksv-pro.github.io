"""WCAG 2 relative luminance and contrast ratio of '#rrggbb' colours (stdlib only)."""


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def luminance(h):
    c = [v / 255.0 for v in rgb(h)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)
