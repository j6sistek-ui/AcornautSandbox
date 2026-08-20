#!/usr/bin/env python3
"""Key a suit render and seat it in the family's framing.

    python3 illustrated-src/fit-suit.py IMG_7058.png docs/art/suits/ghost.png

key-render.py cuts the figure off its backing but keeps whatever framing the
render arrived with. That is fine for the GAME -- measureSprite trims to the
figure and scales the trimmed box, so a small figure in a big frame still
draws at the right size -- but it is not fine for SHARPNESS: a figure filling
150 px of a 256 canvas is carrying a sixth fewer real pixels than its
siblings at 180, and at the same on-screen size that reads soft.

So key at the SOURCE resolution, crop to the figure there, and take the one
downscale straight to the family's size. One resample instead of two, from
the largest pixels available.

The family measures 176-183 px on the long side of the trimmed box, centred
near (124, 116) in the 256 canvas. Matching that also keeps the hangar
cards, where suits sit side by side, from stepping up and down in size.
"""
import sys
import os
import numpy as np
from PIL import Image

# key-render.py is not an importable module name, so load it by path
import importlib.util
_spec = importlib.util.spec_from_file_location(
    "keyrender", os.path.join(os.path.dirname(os.path.abspath(__file__)), "key-render.py"))
keyrender = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(keyrender)

CANVAS = 256
TARGET = 180        # long side of the trimmed box, the family's median
CENTRE = (124, 116)  # where that box sits in the canvas


def fit(src, dst, target=TARGET, canvas=CANVAS, centre=CENTRE):
    # key at the render's own resolution: key() always resamples to a square
    # of out_px, so hand it the source size and the resample is a no-op
    src_px = Image.open(src).size[0]
    big = keyrender.key(src, out_px=src_px)
    a = np.asarray(big).astype(np.float32)
    al = a[:, :, 3]
    ys, xs = np.where(al >= 16)
    if not len(xs):
        sys.exit("nothing survived the key in " + src)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = x1 - x0 + 1, y1 - y0 + 1

    scale = target / max(bw, bh)
    nw, nh = max(1, round(bw * scale)), max(1, round(bh * scale))

    # premultiply before the resample, or transparent black bleeds into the
    # fur edge and the rim goes grey
    crop = a[y0:y1 + 1, x0:x1 + 1]
    pm = crop[:, :, :3] * (crop[:, :, 3:4] / 255.0)
    pm_s = np.asarray(Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8))
                      .resize((nw, nh), Image.LANCZOS)).astype(np.float32)
    a_s = np.asarray(Image.fromarray(crop[:, :, 3].astype(np.uint8))
                     .resize((nw, nh), Image.LANCZOS)).astype(np.float32) / 255.0
    rgb = np.where(a_s[:, :, None] > 0.004, pm_s / np.maximum(a_s[:, :, None], 1e-4), 0.0)

    out = np.zeros((canvas, canvas, 4), np.float32)
    ox = int(round(centre[0] - nw / 2))
    oy = int(round(centre[1] - nh / 2))
    ox = max(0, min(canvas - nw, ox))
    oy = max(0, min(canvas - nh, oy))
    out[oy:oy + nh, ox:ox + nw, :3] = np.clip(rgb, 0, 255)
    out[oy:oy + nh, ox:ox + nw, 3] = np.clip(a_s * 255, 0, 255)

    Image.fromarray(out.astype(np.uint8)).save(dst)
    print("  %s -> %s  box %dx%d at (%d,%d), from %dx%d of source"
          % (os.path.basename(src), dst, nw, nh, ox, oy, bw, bh))
    return (ox, oy, nw, nh)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    fit(sys.argv[1], sys.argv[2])
