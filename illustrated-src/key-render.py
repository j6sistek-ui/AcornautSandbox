#!/usr/bin/env python3
"""Cut a character render off its flat backing paper and size it for the game.

    python3 illustrated-src/key-render.py IMG_7046.png docs/art/suits/flight.png

If a render already ships with transparency this passes it straight through
-- ask for that first, it beats any cut. The rest is for renders that
arrive on a flat sheet.

THE RULE THAT MATTERS: background is not a colour, it is a REGION. A pixel
is background only if it is close to the paper AND reachable from the edge
of the frame without crossing the drawing. Flood inward from the border.

Everything else follows from that, or from a fault it did not cover:

FLOOD, DO NOT DELETE A COLOUR. Deleting every paper-coloured pixel takes
the cream off a belly, a visor, the white of an eye -- and off a pale
muzzle, which is what punched a hole through Frost's snout. Cream trapped
inside the squirrel cannot be reached from the border, so it stays, and no
hole-filling guesswork is needed to put it back.

PAPER MEASURED FROM THE BORDER, not assumed. These sheets run 241,236,230
to 253,245,232, so a fixed key leaves a rind on some and bites into others.
The tolerance follows the border's own noise at the 99th percentile --
deliberately not the 99.9th: a few stray pixels at 21 against a 99th of 3
once set the threshold, and that cost Frost its muzzle.

A CHARACTER MUST NOT BE THE COLOUR OF ITS PAPER. Ghost is painted within
12 of the cream, out of 765. Nothing recovers that -- the information is
not in the file. Pale characters need a black plate. This is the one input
problem no code fixes.

THE EDGE RAMP STOPS AT THE RIM. Fading opacity across everything the mask
covers drove pale interiors translucent; a cream visor went to nothing and
read as mottled. Solid inside, and the rim alone ramps -- on how far each
pixel sits from the paper, which is what gives fur its falloff.

DETACHED PARTS ARE KEPT ON MERIT. A largest-blob-wins rule threw away
Seraph's halo and an alien's antenna tips.

NO GROUND. A cast shadow keys as a grey smear under the feet, and it is cut
by SHAPE rather than depth: a band deep enough to catch it also eats the
pale feet off a chrome character, and no part of a squirrel is four times
wider than it is tall.

PREMULTIPLY BEFORE RESIZING. Downscaling straight RGBA mixes the paper's
cream into every edge pixel -- that is the pale rind around a badly cut
sprite on a dark sky.
"""
import sys
import os
import numpy as np

try:
    from PIL import Image
    from scipy import ndimage
except ImportError:                                    # pragma: no cover
    sys.exit("needs pillow and scipy: pip install pillow scipy")

OUT = 256
BORDER = 24         # how deep to sample the paper
RIM = 3             # pixels of soft edge at full resolution scale


def key(path, out_px=OUT):
    im = Image.open(path).convert("RGBA")
    if np.asarray(im)[:, :, 3].min() < 250:
        # already cut: nothing to key, only to size
        a = np.asarray(im).astype(np.float32)
        return to_sprite(a[:, :, :3], a[:, :, 3] / 255.0, None, out_px)

    a = np.asarray(im.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape

    # the paper, measured off this render's own border
    edge = np.concatenate([
        a[:BORDER].reshape(-1, 3), a[-BORDER:].reshape(-1, 3),
        a[:, :BORDER].reshape(-1, 3), a[:, -BORDER:].reshape(-1, 3),
    ])
    bg = np.median(edge, axis=0)
    noise = float(np.percentile(np.abs(edge - bg).sum(1), 99.0))
    tol = max(26.0, noise * 3.0 + 18.0)

    d = np.abs(a - bg).sum(2)

    # Background is whatever the border can reach through paper-coloured
    # pixels. Cream inside the figure is walled off by the drawing.
    paper = d < tol
    seed = np.zeros_like(paper)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    outside = ndimage.binary_propagation(seed & paper, mask=paper)
    mask = ndimage.binary_closing(~outside, np.ones((5, 5)))

    # keep detached parts on merit: big enough, or close to the body
    lab, n = ndimage.label(mask)
    if n > 1:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        near = ndimage.binary_dilation(lab == main, iterations=max(8, h // 90))
        keep = lab == main
        for i in range(1, n + 1):
            if i == main:
                continue
            blob = lab == i
            if sizes[i - 1] >= sizes[main - 1] * 0.02 or (blob & near).any():
                keep |= blob
        mask = keep

    mask = drop_ground(a, mask, bg, tol)

    rim = max(1, round(RIM * h / 1408))
    inner = ndimage.binary_erosion(mask, iterations=rim)
    alpha = np.where(inner, 1.0, np.clip(d / tol, 0, 1) * mask)

    return to_sprite(a, alpha, bg, out_px)


def drop_ground(a, mask, bg, lo):
    """a cast shadow or a strip of floor is washed out and sits at the feet

    Judged by SHAPE, not by how low it sits. A depth band alone is both too
    greedy and not greedy enough: pushed deep it eats the pale feet off a
    chrome or a white character, and kept shallow it misses a shadow drawn
    a little clear of the ground -- which is exactly how one survived under
    bigbooty, sixteen pixels below the band's edge. A cast shadow is a wide
    flat smear; no part of a squirrel is four times wider than it is tall.
    """
    ys = np.where(mask.any(1))[0]
    if not len(ys):
        return mask
    top, bot = ys.min(), ys.max()
    band = np.zeros_like(mask)
    band[int(bot - 0.22 * (bot - top)):, :] = True
    mx = a.max(2)
    mn = a.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    # grey and pale: not the character, which is saturated nearly everywhere
    pale = band & mask & (sat < 0.24) & (mx > bg.min() * 0.55)
    if not pale.any():
        return mask
    gl, gn = ndimage.label(pale)
    cut = np.zeros_like(mask)
    for i in range(1, gn + 1):
        blob = gl == i
        by, bx = np.where(blob)
        if len(by) < 60:
            continue
        w = bx.max() - bx.min() + 1
        h = by.max() - by.min() + 1
        if w >= h * 3.5:
            cut |= blob
    return mask & ~cut


def to_sprite(a, alpha, bg, out_px):
    """premultiplied downscale, so no paper bleeds into the edge"""
    h = a.shape[0]
    pm = a * alpha[:, :, None]
    small_pm = np.asarray(
        Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8)).resize((out_px, out_px), Image.LANCZOS)
    ).astype(np.float32)
    small_a = np.asarray(
        Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8)).resize((out_px, out_px), Image.LANCZOS)
    ).astype(np.float32) / 255.0
    rgb = np.where(small_a[:, :, None] > 0.004, small_pm / np.maximum(small_a[:, :, None], 1e-4), 0.0)
    out = np.zeros((out_px, out_px, 4), np.float32)
    out[:, :, :3] = np.clip(rgb, 0, 255)
    out[:, :, 3] = np.clip(small_a * 255, 0, 255)
    return Image.fromarray(out.astype(np.uint8))


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    if not os.path.exists(src):
        sys.exit("no such file: " + src)
    img = key(src)
    img.save(dst)
    a = np.asarray(img)[:, :, 3]
    print("  %s -> %s  (%d px of figure, %d soft)"
          % (os.path.basename(src), dst, int((a > 20).sum()), int(((a > 0) & (a < 255)).sum())))


if __name__ == "__main__":
    main()
