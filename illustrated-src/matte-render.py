#!/usr/bin/env python3
"""Cut a render off a UNIFORM plate without leaving the plate in the edges.

    python3 illustrated-src/matte-render.py in.jpg out.png            # auto plate
    python3 illustrated-src/matte-render.py in.jpg out.png --plate 255,255,255

key-render.py decides which pixels are background. That is the right
question for flat paper art and the wrong one for fur and glow, because it
can only answer yes or no: every half-covered pixel keeps the plate mixed
into its colour at full strength. On the dark sheet that left a black rim
round the alien's tail — the owner's word for it was terrible, and on white
it is unmissable. Keying the same character off a white plate instead just
swaps the rim's colour: a pale rind, which is worse, because the game draws
on a night sky.

The rim is not a masking problem, it is an ALGEBRA problem. A partly
covered pixel really is P = C*a + B*(1-a). Thresholding throws away a and
keeps P, so the plate rides along. Here both are solved for:

  a = <B-P, B-F> / <B-F, B-F>      how much of this pixel is character
  C = (P - B*(1-a)) / a            the character's own colour, plate removed

F is the character's colour at that edge, taken from the nearest pixels
that are certainly character - not a global average, which would tint a
green tail with the colours of an orange foot.

The three regions come from a trimap: background is the plate REACHABLE
FROM THE BORDER (the rule key-render.py got right - a pale eye is not
background just because it is pale), foreground is what survives eroding
the rest, and only the band between them is solved. Solid interior is left
exactly as painted.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

BAND = 6          # px of unknown either side of the silhouette
CORE_TOL = 26     # distance from plate that is certainly not background


def trimap(a, plate, tol, band):
    dist = np.sqrt(((a - plate) ** 2).sum(2))
    near = dist < tol
    # background is plate you can WALK TO from the border
    seeds = np.zeros(near.shape, bool)
    seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True
    bg = ndimage.binary_propagation(seeds & near, mask=near)
    solid = ~bg
    solid = ndimage.binary_fill_holes(solid)
    fg = ndimage.binary_erosion(solid, np.ones((band * 2 + 1, band * 2 + 1)))
    unknown = solid & ~fg
    unknown |= ndimage.binary_dilation(solid, np.ones((band * 2 + 1,) * 2)) & bg
    return fg, unknown


def matte(path, plate=None, band=BAND, tol=CORE_TOL):
    im = Image.open(path)
    if im.mode == "RGBA" and np.array(im)[..., 3].min() < 250:
        return im                                   # already cut; leave it alone
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    if plate is None:
        edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
        plate = np.median(edge, axis=0)
    plate = np.asarray(plate, np.float32)

    fg, unknown = trimap(a, plate, tol, band)
    out = np.zeros(a.shape[:2] + (4,), np.float32)
    out[..., :3] = a
    out[..., 3] = np.where(fg, 255.0, 0.0)

    # F for each unknown pixel: the colour of the nearest certain character
    # pixel. Nearest, not average — an average would bleed a foot's colour
    # into a tail.
    idx = ndimage.distance_transform_edt(~fg, return_distances=False, return_indices=True)
    F = a[idx[0], idx[1]]

    d = plate - F
    denom = (d * d).sum(2)
    denom[denom < 1e-3] = 1e-3                      # character matches plate here
    alpha = ((plate - a) * d).sum(2) / denom
    alpha = np.clip(alpha, 0.0, 1.0)

    u = unknown
    out[..., 3][u] = alpha[u] * 255.0
    # unpremultiply: take the plate back out of the colour it was mixed into
    al = np.maximum(alpha[u], 1e-3)[:, None]
    C = (a[u] - plate[None, :] * (1.0 - al)) / al
    out[..., :3][u] = np.clip(C, 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, dst = sys.argv[1], sys.argv[2]
    plate = None
    if "--plate" in sys.argv:
        plate = [float(v) for v in sys.argv[sys.argv.index("--plate") + 1].split(",")]
    im = matte(src, plate)
    im.save(dst)
    al = np.array(im)[..., 3]
    soft = int(((al > 8) & (al < 248)).sum())
    print(f"{src} -> {dst}  {im.size}  soft edge pixels {soft}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
