#!/usr/bin/env python3
"""Turn a pal's animation frames into a shippable, registered bank.

    python3 illustrated-src/build-pal-anim.py bee /tmp/palsheets/uniq/anim10

A pal already ships as ONE still, and the game draws that still at a size
derived from its ink. The animation has to land on exactly that footprint
or the companion jumps the moment the bank starts playing.

So the bank is fitted to the STILL, not to itself: one scale and one
offset, computed from the union of every frame and applied to all of them.
Per-frame fitting is what makes a character pulse - the union cannot,
because it is the same number for every frame.
"""
import os
import sys
import glob

import numpy as np
from PIL import Image

CANVAS = 256


def ink_box(a):
    m = a[..., 3] > 16
    ys, xs = np.nonzero(m)
    return xs.min(), xs.max(), ys.min(), ys.max()


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    pal, src = sys.argv[1], sys.argv[2]
    still = f"docs/art/solo/{pal}.png"
    if not os.path.exists(still):
        print(f"no shipped still for {pal}")
        return 1
    sx0, sx1, sy0, sy1 = ink_box(np.array(Image.open(still).convert("RGBA")))
    sw, sh = sx1 - sx0 + 1, sy1 - sy0 + 1
    scx, scy = (sx0 + sx1) / 2, (sy0 + sy1) / 2

    paths = sorted(glob.glob(os.path.join(src, "frame_*.png")))
    if not paths:
        print(f"no frames in {src}")
        return 1
    frames = [Image.open(p).convert("RGBA") for p in paths]

    union = None
    for im in frames:
        m = np.array(im)[..., 3] > 16
        union = m if union is None else (union | m)
    uy, ux = np.nonzero(union)
    uw, uh = ux.max() - ux.min() + 1, uy.max() - uy.min() + 1
    ucx, ucy = (ux.min() + ux.max()) / 2, (uy.min() + uy.max()) / 2

    # match the STILL's footprint on its larger axis, so a bank that swings
    # wider than the still does not draw the pal bigger
    k = min(sw / uw, sh / uh)
    for n, im in enumerate(frames, 1):
        w2, h2 = max(1, round(im.width * k)), max(1, round(im.height * k))
        r = im.resize((w2, h2), Image.LANCZOS)
        out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        out.alpha_composite(r, (round(scx - ucx * k), round(scy - ucy * k)))
        for root in ("docs/art/solo",):
            out.save(f"{root}/{pal}-{n}.png")

    sizes = []
    for n in range(1, len(frames) + 1):
        a = np.array(Image.open(f"docs/art/solo/{pal}-{n}.png"))
        m = a[..., 3] > 16
        if not m.any():
            continue
        y, x = np.nonzero(m)
        sizes.append(max(x.max() - x.min() + 1, y.max() - y.min() + 1))
    print(f"{pal:13} {len(frames):2d} frames  scale {k:.3f}  "
          f"box {min(sizes)}-{max(sizes)}px vs still {max(sw, sh)}px")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
