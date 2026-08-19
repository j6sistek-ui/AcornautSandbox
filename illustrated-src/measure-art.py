#!/usr/bin/env python3
"""Measure a new suit or helmet render and print the table line it needs.

    python3 illustrated-src/measure-art.py suit   docs/art/suits/newsuit.png
    python3 illustrated-src/measure-art.py helmet docs/art/helms/newhelm.png
    python3 illustrated-src/measure-art.py audit          # check everything

Why this exists: the helmet is drawn scaled so its GLASS circle lands on the
suit's HEAD circle. Both circles are numbers in draw.ts — DOME for suits,
HELM_GLASS for helmets — and every visual fault we have had with helmets
(one dome huge on one suit and small on the next, faces half covered, rims
poking out) traces back to one of those numbers being guessed rather than
measured. Guessing is easy to do by accident, because the obvious proxies
all lie:

  · the blob of warm fur around a face includes ears, muzzle and neck, and
    those move with the pose, so sqrt(area/pi) swings by a third on heads
    that are the same size;
  · colour tests cannot find a head at all on alien, ghost, frost or robo;
  · a helmet's VISIBLE visor is nothing like its glass radius, because the
    shell hides most of the sphere's edge.

So each kind is measured by the one feature that holds still.

SUITS — match the reference face. The face is the same drawing in every
render, whatever the suit is made of, and it reads straight through a clear
dome. Matching flight's face against a new render gives both where the head
is and, from the scale that matches, how big it is.

HELMETS — the largest disc that fits inside the silhouette. For a bubble
helmet that IS the sphere, and a crown, a pair of ears or a halo cannot
inflate it. Calibrated against the twelve plain bubbles, whose entries all
read 125 and whose inscribed circles measure 103-107.

Anything this tool reports with low confidence should be fitted by eye
instead: draw the helmet against a fixed head circle at a few candidate
radii and pick the one that sits on it. That is how catbubble and leviathan
were set, because an inscribed circle finds the wrong feature on both.
"""
import sys
import os
import glob
import numpy as np

try:
    from PIL import Image
    from scipy import ndimage
except ImportError:                                    # pragma: no cover
    sys.exit("needs pillow and scipy: pip install pillow scipy")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# flight is the reference suit: its anchor was hand-tuned and everything
# else is measured against it
REFERENCE_SUIT = os.path.join(ROOT, "docs/art/suits/flight.png")
REFERENCE_ANCHOR = (195.0, 97.0, 51.0)

# the twelve plain bubbles are all 125 in the table and all measure ~105.6
# as an inscribed circle
GLASS_K = 125.0 / 105.6

# head diameter as a share of the sprite's longest content dimension
SPEC_PCT = 43.0
SPEC_TOLERANCE = 4.0


def gray(path):
    a = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)
    return a[:, :, :3].mean(axis=2) * (a[:, :, 3] / 255.0)


def ncc(img, t, disc, ox, oy):
    h, w = t.shape
    if oy < 0 or ox < 0 or oy + h > img.shape[0] or ox + w > img.shape[1]:
        return -1.0
    win = img[oy:oy + h, ox:ox + w]
    a = win[disc] - win[disc].mean()
    b = t[disc] - t[disc].mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d > 1e-6 else -1.0


def measure_suit(path, coarse=2):
    """returns (cx, cy, r, confidence) — the head circle in sprite pixels"""
    ref = gray(REFERENCE_SUIT)
    rx, ry, rr = REFERENCE_ANCHOR
    size = 96
    half = size // 2
    t0 = ref[int(ry) - half:int(ry) + half, int(rx) - half:int(rx) + half].copy()
    g = gray(path)
    best = None
    for s in np.arange(0.60, 1.61, 0.04):
        n = int(round(size * s))
        if n < 24 or n >= min(g.shape):
            continue
        h2 = n // 2
        t = np.asarray(Image.fromarray(t0).resize((n, n), Image.BILINEAR), dtype=np.float32)
        yy, xx = np.mgrid[0:n, 0:n]
        disc = ((xx - h2) ** 2 + (yy - h2) ** 2) <= (h2 - 2) ** 2
        for oy in range(0, g.shape[0] - n, coarse):
            for ox in range(int(g.shape[1] * 0.30), g.shape[1] - n, coarse):
                v = ncc(g, t, disc, ox, oy)
                if best is None or v > best[0]:
                    best = (v, ox + h2, oy + h2, s)
    v, cx, cy, s = best
    return cx, cy, rr * s, v


def measure_helmet(path):
    """returns (cx, cy, r) — the glass circle in sprite pixels"""
    a = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3] > 25
    a = ndimage.binary_fill_holes(a)
    dt = ndimage.distance_transform_edt(a)
    iy, ix = np.unravel_index(np.argmax(dt), dt.shape)
    # the table's centres sit slightly left of and below the measurement
    return float(ix) - 5.0, float(iy) + 5.0, float(dt[iy, ix]) * GLASS_K


def content_span(path):
    a = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3] > 12
    ys, xs = np.where(a)
    return max(xs.max() - xs.min(), ys.max() - ys.min()) + 1


def report_suit(path):
    cx, cy, r, v = measure_suit(path)
    span = content_span(path)
    pct = 200.0 * r / span
    name = os.path.basename(path)[:-4]
    print('  "suit:%s": [%d, %d, %d],' % (name, round(cx), round(cy), round(r)))
    print("      confidence %.2f%s" % (v, "" if v >= 0.80 else "   <-- LOW, fit this one by eye"))
    off = abs(pct - SPEC_PCT)
    print("      head is %.1f%% of the sprite (spec %.0f%% +/- %.0f)%s"
          % (pct, SPEC_PCT, SPEC_TOLERANCE,
             "" if off <= SPEC_TOLERANCE else "   <-- OUT OF SPEC"))
    return v >= 0.80 and off <= SPEC_TOLERANCE


def report_helmet(path):
    cx, cy, r = measure_helmet(path)
    name = os.path.basename(path)[:-4]
    print('  "%s": [%d, %d, %d],' % (name, round(cx), round(cy), round(r)))
    print("      an inscribed circle finds the sphere on a bubble helmet. If this")
    print("      one has ears, a crown or a long chin, check it against a fixed")
    print("      head circle before trusting the number.")
    return True


def audit():
    ok = True
    print("SUITS\n")
    for p in sorted(glob.glob(os.path.join(ROOT, "docs/art/suits/*.png"))):
        n = os.path.basename(p)
        if n.endswith("-body.png") or n.endswith("-tail.png"):
            continue
        print(" ", n)
        ok &= report_suit(p)
        print()
    print("\nHELMETS\n")
    for p in sorted(glob.glob(os.path.join(ROOT, "docs/art/helms/*.png"))):
        print(" ", os.path.basename(p))
        report_helmet(p)
        print()
    return ok


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "audit":
        sys.exit(0 if audit() else 1)
    if len(sys.argv) != 3 or sys.argv[1] not in ("suit", "helmet"):
        sys.exit(__doc__)
    path = sys.argv[2]
    if not os.path.exists(path):
        sys.exit("no such file: " + path)
    ok = report_suit(path) if sys.argv[1] == "suit" else report_helmet(path)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
