#!/usr/bin/env python3
"""Recover EXACT alpha from one render photographed on two known plates.

    python3 illustrated-src/two-plate-matte.py pair.jpg out.png

Every single-plate cut has to guess. A pixel the fur only half covers is
one equation, P = C*a + B*(1-a), with four unknowns in it, so a keyer
picks a threshold and a matte picks a neighbour's colour, and both leave
some of the plate behind: a black rim off a dark sheet, a pale rind off a
white one.

Two plates remove the guess. The same character over two different
backgrounds gives two equations, and the unknown colour C cancels:

    P1 - P2 = (B1 - B2) * (1 - a)

so alpha falls straight out, and the character's true colour follows by
putting either plate back:

    a = 1 - <P1-P2, B1-B2> / <B1-B2, B1-B2>
    C = (P1 - B1*(1-a)) / a

No threshold, no trimap, no neighbour guessing. Wispy fur and soft glow
come out with the alpha they actually have, and C is the paint itself,
with nothing of either plate in it. Solving across all three channels at
once, rather than the strongest one, keeps it stable where the character
happens to match a plate in one channel.

The one thing this needs is that both panels really are the same render.
They are ALIGNED here first, by silhouette, and the alignment is reported
so a mismatched pair is refused instead of quietly producing mush.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SEAM = 6          # px trimmed off every panel edge; JPEG rings at the join
SEARCH = 60       # px of offset searched when registering the two panels
MIN_IOU = 0.97


def panels(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    half = w // 2
    return (a[SEAM:h - SEAM, SEAM:half - SEAM],
            a[SEAM:h - SEAM, half + SEAM:w - SEAM])


def plate_of(p):
    return np.median(np.concatenate([p[0], p[-1], p[:, 0], p[:, -1]]), axis=0)


def silhouette(p, plate, tol=60):
    return ndimage.binary_fill_holes(np.sqrt(((p - plate) ** 2).sum(2)) > tol)


def register(m1, m2):
    """Integer shift putting m2 on m1, by best silhouette overlap."""
    c1 = np.array(ndimage.center_of_mass(m1))
    c2 = np.array(ndimage.center_of_mass(m2))
    d0 = np.round(c1 - c2).astype(int)
    best, bestd = -1.0, (0, 0)
    for dy in range(d0[0] - 6, d0[0] + 7):
        for dx in range(d0[1] - 6, d0[1] + 7):
            s = np.roll(np.roll(m2, dy, 0), dx, 1)
            inter = (m1 & s).sum()
            union = (m1 | s).sum()
            iou = inter / max(union, 1)
            if iou > best:
                best, bestd = iou, (dy, dx)
    return bestd, best


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, dst = sys.argv[1], sys.argv[2]
    P1, P2 = panels(src)
    B1, B2 = plate_of(P1), plate_of(P2)
    print(f"plates: {B1.round(1)} and {B2.round(1)}")
    sep = np.sqrt(((B1 - B2) ** 2).sum())
    if sep < 60:
        print(f"plates are only {sep:.0f} apart; too close to separate")
        return 1

    (dy, dx), iou = register(silhouette(P1, B1), silhouette(P2, B2))
    print(f"registered second panel by dy={dy} dx={dx}, silhouette IoU {iou:.4f}")
    if iou < MIN_IOU:
        print(f"panels do not match ({iou:.3f} < {MIN_IOU}); not the same render")
        return 1
    P2 = np.roll(np.roll(P2, dy, 0), dx, 1)

    D = B1 - B2
    alpha = 1.0 - ((P1 - P2) * D).sum(2) / float((D * D).sum())
    alpha = np.clip(alpha, 0.0, 1.0)
    a3 = np.maximum(alpha, 1e-4)[..., None]
    inv = 1.0 - a3
    # both plates give C; averaging halves the JPEG noise carried into it
    C = 0.5 * ((P1 - B1 * inv) / a3 + (P2 - B2 * inv) / a3)

    out = np.zeros(P1.shape[:2] + (4,), np.float32)
    out[..., :3] = np.clip(C, 0, 255)
    out[..., 3] = alpha * 255.0
    # a pixel with no coverage has no colour; leave it black so any later
    # resize cannot drag a phantom hue into the edges
    out[..., :3][alpha < 0.004] = 0
    im = Image.fromarray(out.astype(np.uint8), "RGBA")
    im.save(dst)
    soft = int(((out[..., 3] > 8) & (out[..., 3] < 248)).sum())
    print(f"-> {dst}  {im.size}  soft edge pixels {soft}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
