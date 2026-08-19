#!/usr/bin/env python3
"""Cut a suit render into a hinged tail layer and a body layer, or repair a
pair that was cut badly.

    python3 illustrated-src/rig-tail.py cut    docs/art/suits/leviathan.png
    python3 illustrated-src/rig-tail.py repair docs/art/suits            # all pairs
    python3 illustrated-src/rig-tail.py audit  docs/art/suits

A rigged suit draws as two full-canvas layers: the tail goes down first,
rotated about a pivot, then the body over it. Both layers are placed
against the WHOLE suit's trimmed box, which is what keeps them registered
however either one is cropped -- so the two PNGs must stay the same size as
the suit they came from. Never trim them.

CUT. The tail is the orange fur plume, and on every suit whose body is not
itself orange it is simply the largest orange blob on the left. Growing that
core a few pixels into neighbouring fur picks up the dark outline and the
antialiased skirt, which fail a saturation test on their own and otherwise
stay behind in the body layer as a fringe that does not move.

This does NOT work on a suit whose costume is orange too -- phoenix's flame
cape merges with the tail at every threshold -- and those stay unrigged.

PIVOT. The hinge is the tail pixel maximising x + y: the base, where the
plume meets the hip. That rule reproduces all twelve hand-set pivots in
draw.ts to within three pixels, so new suits do not need one by hand.

REPAIR. Every pair cut before this script kept a sliver of the tail's tip in
the BODY layer -- 6 to 350 pixels, on the outer edge of the plume. It sat
still while the tail swung, which is what a player sees as "a fragment of
the tip not following the tail". Any body blob that is disconnected from the
body and lies against the tail belongs to the tail.
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

ALPHA = 20          # what counts as drawn ink
NEAR = 6            # how close a loose blob must sit to the tail to be its own
MIN_BLOB = 4        # below this it is a stray pixel, not a fragment


def load(path):
    return np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)


def save(a, path):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(path)


def orange(a):
    """the squirrel's own fur, whatever the suit around it is made of"""
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    mx = a[:, :, :3].max(2)
    mn = a[:, :, :3].min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    return (al > 25) & (sat > 0.60) & (r >= mx - 1) & (b < g) & (g > b * 1.2)


def pivot_of(mask):
    ys, xs = np.where(mask)
    i = int(np.argmax(xs.astype(int) + ys.astype(int)))
    return int(xs[i]), int(ys[i])


def cut(path):
    a = load(path)
    h, w = a.shape[:2]
    fur = orange(a)
    lab, n = ndimage.label(fur)
    sizes = ndimage.sum(fur, lab, range(1, n + 1))
    best = None
    for i in range(1, n + 1):
        if sizes[i - 1] < 1500:
            continue
        ys, xs = np.where(lab == i)
        if xs.mean() < w * 0.45 and (best is None or sizes[i - 1] > best[1]):
            best = (i, sizes[i - 1])
    if best is None:
        return None
    core = lab == best[0]

    # The plume's dark contour is too deep in shadow to pass the fur test,
    # and left behind it traced a dotted outline of the tail that stayed put
    # while the tail swung. Grow into it -- but by GREEN OVER RED, not by
    # saturation: seraph's cream wing is unsaturated yet still red-dominant,
    # so a saturation floor let a wing feather travel with the tail. Fur runs
    # at 0.39-0.60 of green to red, cream at 0.98.
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    mx = a[:, :, :3].max(2)
    ratio = np.divide(g, np.maximum(r, 1))
    furry = (al > 0) & (r >= mx - 1) & (b <= g) & (ratio < 0.80)
    # The plume's rim is single hairs with clear gaps between them, and a
    # grow that may only cross ink stops at the first gap -- which left a
    # dotted arc of hairs behind in the body, tracing where the tail used to
    # be. Let it cross empty pixels too (marking one costs nothing, its alpha
    # is zero), but only within reach of the core so it cannot wander off
    # across the canvas into the head.
    reach = ndimage.binary_dilation(core, iterations=14)
    passable = (furry | (al == 0)) & reach
    tail = core.copy()
    for _ in range(14):
        tail = ndimage.binary_dilation(tail) & (passable | core)
    tail &= al > 0

    # The plume's rim also carries HIGHLIGHT hairs, near-white where they
    # catch the light, and no colour test can tell those from the cream of
    # seraph's wing. Shape can: a hair is one or two pixels across and an
    # opening erases it, where a wing feather survives. So take thin things
    # lying against the tail, and only those.
    ink = al > 3
    opened = ndimage.binary_opening(ink, structure=np.ones((3, 3)), iterations=2)
    tail |= ink & ~opened & ndimage.binary_dilation(tail, iterations=8)

    return finish(a, tail, path)


def finish(a, tail, path):
    al = a[:, :, 3]
    soft = np.clip(ndimage.gaussian_filter(tail.astype(np.float32), 0.5) * 1.4, 0, 1)
    t = a.copy()
    t[:, :, 3] = al * soft
    bdy = a.copy()
    bdy[:, :, 3] = al * (1.0 - soft)

    stem = path[:-4]
    save(t, stem + "-tail.png")
    save(bdy, stem + "-body.png")
    # a plume's outer edge is single hairs, and a hair that the colour test
    # missed lands in the body as a loose speck tracing the tail's outline.
    # The repair pass is exactly the sweep for that, so run it here too.
    # single hairs come off as one- and two-pixel specks, so this sweep
    # goes right down to the faintest ink; the repair mode keeps a higher
    # floor so it never disturbs a hand-made cut.
    repair(stem, min_blob=1, alpha=3)
    px, py = pivot_of(tail)
    print("  %s: tail %d px, pivot [%d, %d]"
          % (os.path.basename(stem), int(tail.sum()), px, py))
    return px, py


def repair(stem, min_blob=MIN_BLOB, alpha=ALPHA):
    """move any loose scrap of the tail out of the body layer"""
    tp, bp = stem + "-tail.png", stem + "-body.png"
    if not (os.path.exists(tp) and os.path.exists(bp)):
        return 0
    t = load(tp)
    b = load(bp)
    tm = t[:, :, 3] > ALPHA
    bm = b[:, :, 3] > alpha
    lab, n = ndimage.label(bm)
    sizes = ndimage.sum(bm, lab, range(1, n + 1))
    if not n:
        return 0
    main = int(np.argmax(sizes)) + 1
    near = ndimage.binary_dilation(tm, iterations=NEAR)
    moved = np.zeros_like(bm)
    for i in range(1, n + 1):
        if i == main or sizes[i - 1] < min_blob:
            continue
        blob = lab == i
        if (blob & near).any():
            moved |= blob
    if not moved.any():
        return 0
    # the scrap keeps its own pixels; it just changes layer
    t[:, :, 3] = np.maximum(t[:, :, 3], np.where(moved, b[:, :, 3], 0))
    t[:, :, :3] = np.where(moved[:, :, None], b[:, :, :3], t[:, :, :3])
    b[:, :, 3] = np.where(moved, 0, b[:, :, 3])
    save(t, tp)
    save(b, bp)
    return int(moved.sum())


def audit(folder):
    bad = 0
    for p in sorted(glob.glob(os.path.join(folder, "*-body.png"))):
        stem = p[:-9]
        t = np.asarray(Image.open(stem + "-tail.png").convert("RGBA"))[:, :, 3] > ALPHA
        b = np.asarray(Image.open(p).convert("RGBA"))[:, :, 3] > ALPHA
        lab, n = ndimage.label(b)
        sizes = ndimage.sum(b, lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        near = ndimage.binary_dilation(t, iterations=NEAR)
        loose = sum(int(sizes[i - 1]) for i in range(1, n + 1)
                    if i != main and sizes[i - 1] >= MIN_BLOB and ((lab == i) & near).any())
        name = os.path.basename(stem)
        if loose:
            bad += 1
            print("  %-12s %d px of tail still stranded in the body layer" % (name, loose))
        else:
            print("  %-12s clean, pivot [%d, %d]" % ((name,) + pivot_of(t)))
    return bad == 0


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    mode, target = sys.argv[1], sys.argv[2]
    if mode == "cut":
        sys.exit(0 if cut(target) else "no tail found in " + target)
    if mode == "repair":
        total = 0
        for p in sorted(glob.glob(os.path.join(target, "*-body.png"))):
            got = repair(p[:-9])
            if got:
                total += 1
                print("  %-12s moved %d px back to the tail"
                      % (os.path.basename(p[:-9]), got))
        print("repaired %d pairs" % total)
        return
    if mode == "audit":
        sys.exit(0 if audit(target) else 1)
    sys.exit(__doc__)


if __name__ == "__main__":
    main()
