#!/usr/bin/env python3
"""Split a multi-character sheet into one keyable master per figure.

    python3 illustrated-src/cut-sheet.py art-src/alien-pals-2026-08/sheet-green.jpg green-a green-b green-c

A generated sheet puts three characters on one plate, close enough that
their glows overlap. Cropping to a bounding box therefore carries a slice
of the neighbour into the master, and fit-suit.py keys whatever it is
handed - so that slice becomes a green shard welded to the sprite, exactly
the class of defect the owner has caught before as specks of foreign
colour on an asset.

Two things have to be true at once and they pull against each other: the
figure's own GLOW must survive (it is painted light, not a halo artefact,
and clipping it flattens the character), while a neighbour 20 px away must
not. So the keep mask is this figure's component grown enough to carry its
glow, MINUS every other component's own ink. Growing alone does not work:
at these spacings a neighbour's tail tip sits inside the grown region and
rides along.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

GROW = 37   # px of glow carried with a figure
PAD = 46    # px of plate left around it


def coverage(im):
    """Per-pixel 'this is character, not plate', whatever the sheet arrived on.

    Three cases turn up and they are not interchangeable. A sheet that
    already carries ALPHA is the good case and its own alpha is the answer -
    keying it again would only throw information away. Otherwise the plate
    is measured from the border rather than assumed, because a sheet may be
    dark or light and a rule written for one eats the other: 'bright and
    saturated' finds nothing on white, and 'far from white' finds
    everything on black.
    """
    if im.mode == "RGBA":
        a = np.asarray(im).astype(np.float32)
        if a[..., 3].min() < 250:
            return a[..., 3] / 255.0, a[..., :3], None
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    plate = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    d = np.sqrt(((a - plate) ** 2).sum(2))
    return np.clip(d / 60.0, 0.0, 1.0), a, plate


def figures(cov, cut=False):
    # The closing bridges the speckle a keyed plate leaves along an edge. A
    # sheet that arrived with alpha has none, and closing it there does real
    # harm: 9 px was enough to weld two characters whose tails pass within
    # a few pixels of each other into one figure.
    m = cov > 0.5
    if not cut:
        m = ndimage.binary_closing(m, np.ones((9, 9)))
    lab, n = ndimage.label(ndimage.binary_fill_holes(m))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return lab, sizes


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, names = sys.argv[1], sys.argv[2:]
    im = Image.open(src)
    cov, a, plate = coverage(im)
    cut = plate is None
    lab, sizes = figures(cov, cut)
    keep = list(np.argsort(sizes)[::-1][:len(names)] + 1)
    keep.sort(key=lambda k: np.nonzero(lab == k)[1].min())
    out = os.path.dirname(src)
    for k, name in zip(keep, names):
        own = lab == k
        foreign = (lab > 0) & ~own
        grow = 9 if cut else GROW
        mask = ndimage.binary_dilation(own, np.ones((grow, grow))) & ~foreign
        ys, xs = np.nonzero(own)
        x0, x1 = max(0, xs.min() - PAD), min(a.shape[1], xs.max() + PAD + 1)
        y0, y1 = max(0, ys.min() - PAD), min(a.shape[0], ys.max() + PAD + 1)
        keep = mask[y0:y1, x0:x1]
        dst = os.path.join(out, f"{name}-master.png")
        if cut:
            # an already-cut sheet keeps its own alpha; only the neighbours go
            rgba = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
            rgba[..., :3] = a[y0:y1, x0:x1]
            rgba[..., 3] = cov[y0:y1, x0:x1] * 255.0 * keep
            Image.fromarray(rgba.astype(np.uint8), "RGBA").save(dst)
        else:
            crop = a[y0:y1, x0:x1].copy()
            crop[~keep] = plate
            Image.fromarray(crop.astype(np.uint8)).save(dst)
        # a clean master holds exactly one figure
        c2, _, _ = coverage(Image.open(dst))
        _, s2 = figures(c2, cut)
        stray = [int(v) for v in sorted(s2)[::-1][1:] if v > 40]
        print(f"{name:9s} {x1-x0}x{y1-y0}  figure {int(sizes[k-1])}px"
              + (f"  STRAY LEFT: {stray}" if stray else "  clean")
              + ("  (kept its own alpha)" if cut else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
