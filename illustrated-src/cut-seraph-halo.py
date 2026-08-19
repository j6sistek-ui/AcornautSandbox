#!/usr/bin/env python3
"""Cut the baked halo off the Seraph suit render.

The Seraph HELMET carries a halo of its own, so a halo baked into the suit
gives the player two of them -- and unlike a dome, a halo sits outside any
helmet's footprint, so nothing in code can cover it. New renders ship
bare-headed for exactly this reason (see ART_SPEC.md); this is the repair
for the one render we already had.

Three separations were tried before this one and all three failed: the blue
channel (the ring's arcs sit near the fur's), a blob label (the ring touches
both ears at every alpha threshold), and hue (halo 25-43 deg against fur
23-29 deg -- overlapping). What does separate them is the ring's GREEN
against its RED: gold runs at ~0.76 of red where the brightest fur on the
model reaches only 0.61.

    python3 illustrated-src/cut-seraph-halo.py docs/art/suits/seraph.png
"""
import sys
import numpy as np

try:
    from PIL import Image
    from scipy import ndimage
except ImportError:                                    # pragma: no cover
    sys.exit("needs pillow and scipy: pip install pillow scipy")


def cut_halo(path):
    a = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)
    r, g, al = a[:, :, 0], a[:, :, 1], a[:, :, 3]
    ratio = np.divide(g, np.maximum(r, 1))

    gold = (al > 20) & (ratio > 0.63) & (r > 120)
    lab, n = ndimage.label(gold)
    core = None
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) >= 200 and ys.min() < 40 and ys.max() < 115 and xs.min() > 120:
            core = lab == i
            break
    if core is None:
        return None

    # the ring's soft outer skirt sits at alpha 17-35, under the labelling
    # threshold. Grow into it from the core rather than lowering the
    # threshold globally, which merges the ring with the cream collar.
    skirt = (al > 2) & (ratio > 0.63) & (r > 120)
    cut = core.copy()
    for _ in range(6):
        cut = ndimage.binary_dilation(cut) & (skirt | core)
    cut |= ndimage.binary_dilation(core, iterations=2) & (al > 0) & (ratio > 0.66)

    # the ring also has a dark contour, too brown to pass the gold test. It
    # survives as dotted arcs that no longer touch the figure once the gold
    # is gone -- sweep the ring's neighbourhood for anything disconnected.
    rest = (al > 2) & ~cut
    rl, rn = ndimage.label(rest)
    main = int(np.argmax(ndimage.sum(rest, rl, range(1, rn + 1)))) + 1
    cut |= ndimage.binary_dilation(core, iterations=7) & rest & (rl != main)

    soft = np.clip(ndimage.gaussian_filter(cut.astype(np.float32), 0.7) * 1.3, 0, 1)
    out = a.copy()
    out[:, :, 3] = al * (1.0 - soft)
    return Image.fromarray(out.astype(np.uint8)), int(cut.sum())


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for path in sys.argv[1:]:
        got = cut_halo(path)
        if not got:
            print("no halo found in", path)
            continue
        img, px = got
        img.save(path)
        print("cut %d px of halo from %s" % (px, path))


if __name__ == "__main__":
    main()
