#!/usr/bin/env python3
"""Cut a suit render into a hinged tail layer and a body layer, or repair a
pair that was cut badly.

    python3 illustrated-src/rig-tail.py cut      docs/art/suits/leviathan.png
    python3 illustrated-src/rig-tail.py transfer old/flight.png new/flight.png
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

RESEAT, and why REPAIR was not enough. Repair only moves blobs DISCONNECTED
from the body, and the real defect is not disconnected: the cut left the
tail's whole fur outline -- its dark rim and antialiased skirt -- attached
to the body at the hip and tracing the plume all the way round. Eleven of
seventeen suits carried 1100-1500 px of it, 18% to 31% of the swinging part
of the tail. At the 43 degrees this tail actually swings (TAIL.maxA = 0.75
rad) that reads as a second, ghostly tail hanging in the air. Repair could
not see it, and neither could audit, because both asked "is it a separate
blob?" when the question is "is it inside the tail?".

Reseat asks the second question. The body keeps nothing inside the tail's
silhouette -- grown a few pixels, to take the antialiased fringe with it --
except a round pad at the hinge, which stops the hip opening a gap as the
plume rotates. Everything the body gives up is already in the tail layer by
construction, so nothing is lost; that is checked against the whole-suit
render rather than assumed.
"""
import re
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



HINGE_PAD = 17      # px of body kept around the pivot, so the hip cannot gap
FRINGE = 3          # px the tail mask grows by, to take its soft edge along
FAR = 45.0          # px from the pivot: beyond this a swing really moves


def hinge_of(tail_mask, stem):
    """the hand-set pivot from draw.ts if there is one, else the measured one"""
    name = os.path.basename(stem)
    try:
        src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "game", "draw.ts"), encoding="utf8").read()
        blk = src[src.index("const TAIL_PIVOT"):]
        blk = blk[:blk.index("\n};")]
        for line in blk.split("\n"):
            m = re.match(r"\s*(\w+):\s*\[(\d+),\s*(\d+)\]", line)
            if m and m.group(1) == name:
                return int(m.group(2)), int(m.group(3))
    except (OSError, ValueError):
        pass
    return pivot_of(tail_mask)


def stranded(tail_a, body_a, piv):
    """how much of the SWINGING part of the tail the body is still holding"""
    tm = tail_a > ALPHA
    h, w = tm.shape
    ys, xs = np.mgrid[0:h, 0:w]
    far = np.hypot(xs - piv[0], ys - piv[1]) > FAR
    tail_far = int((tm & far).sum())
    held = int((tm & far & (body_a > ALPHA)).sum())
    return held, tail_far


def reseat(stem, pad=HINGE_PAD, fringe=FRINGE):
    """take the tail's own outline out of the body layer"""
    tp, bp = stem + "-tail.png", stem + "-body.png"
    if not (os.path.exists(tp) and os.path.exists(bp)):
        return None
    t = load(tp)
    b = load(bp)
    tm = t[:, :, 3] > ALPHA
    piv = hinge_of(tm, stem)

    before, tail_far = stranded(t[:, :, 3], b[:, :, 3], piv)

    h, w = tm.shape
    ys, xs = np.mgrid[0:h, 0:w]
    keep = np.hypot(xs - piv[0], ys - piv[1]) <= pad
    drop = ndimage.binary_dilation(tm, iterations=fringe) & ~keep

    # a sanity rail: if the tail mask is so generous that reseating would
    # eat the body itself, something is wrong with the cut and this must
    # not run. Better a known fringe than a suit with no haunch.
    body_before = int((b[:, :, 3] > ALPHA).sum())
    losing = int(((b[:, :, 3] > ALPHA) & drop).sum())
    if losing > body_before * 0.45:
        return {"suit": os.path.basename(stem), "skipped": True,
                "would_lose_pct": round(100.0 * losing / max(1, body_before), 1)}

    # MOVE the fringe, do not delete it. The cut split every pixel's alpha
    # between the two layers (tail = a*soft, body = a*(1-soft)), so the
    # outline is exactly where soft ran to nothing -- the tail's own edge,
    # holding most of its alpha in the BODY. Zeroing it left a hairline of
    # missing paint round the plume, 130-200 px a suit, because the tail had
    # almost none of it to show in its place. Handing it to the tail keeps
    # the resting silhouette identical to the whole-suit render and lets the
    # edge swing with the plume it belongs to.
    take = drop & (b[:, :, 3] > 0)
    fill = take & (b[:, :, 3] > t[:, :, 3])
    t[:, :, :3] = np.where(fill[:, :, None], b[:, :, :3], t[:, :, :3])
    t[:, :, 3] = np.where(take, np.maximum(t[:, :, 3], b[:, :, 3]), t[:, :, 3])
    b[:, :, 3] = np.where(drop, 0, b[:, :, 3])
    save(t, tp)
    save(b, bp)
    after, _ = stranded(t[:, :, 3], b[:, :, 3], piv)
    return {"suit": os.path.basename(stem), "pivot": list(piv),
            "tail_far": tail_far, "before": before, "after": after,
            "before_pct": round(100.0 * before / max(1, tail_far), 2),
            "after_pct": round(100.0 * after / max(1, tail_far), 2),
            "body_px_removed": losing}


def transfer(old_suit, old_tail, new_suit):
    """carry a known-good tail/body split onto a re-render of the same pose

    The twelve originals were re-rendered bare-headed. Their tails could not
    be cut by colour -- these suits are orange ON orange fur, and Frost, Robo
    and Alien have no orange in them at all -- but the pose is unchanged, so
    the old split still describes where the tail is. Align the old silhouette
    to the new one and carry the mask across.

    The two layers deliberately OVERLAP at the hip, the way the hand cuts
    did: the tail takes a generous mask, the body keeps everything outside a
    conservative one. A seam cut to a single line opens a gap the moment the
    tail swings.
    """
    A = np.asarray(Image.open(old_suit).convert("RGBA"))[:, :, 3] > 20
    T = np.asarray(Image.open(old_tail).convert("RGBA"))[:, :, 3] > 20
    Bimg = Image.open(new_suit).convert("RGBA")
    B = np.asarray(Bimg)[:, :, 3] > 20

    ya, xa = np.where(A)
    yb, xb = np.where(B)
    span_a = max(xa.max() - xa.min(), ya.max() - ya.min())
    span_b = max(xb.max() - xb.min(), yb.max() - yb.min())
    guess = span_b / max(1, span_a)
    ca = ((xa.min() + xa.max()) / 2, (ya.min() + ya.max()) / 2)
    cb = ((xb.min() + xb.max()) / 2, (yb.min() + yb.max()) / 2)

    best = None
    for s in np.arange(guess * 0.92, guess * 1.09, 0.01):
        warped = warp(A, s, 0, 0, ca, cb, B.shape)
        for dy in range(-10, 11, 2):
            for dx in range(-10, 11, 2):
                m = np.roll(np.roll(warped, dy, 0), dx, 1)
                iou = (m & B).sum() / max(1, (m | B).sum())
                if best is None or iou > best[0]:
                    best = (iou, s, dx, dy)
    iou, s, dx, dy = best
    Tw = np.roll(np.roll(warp(T, s, 0, 0, ca, cb, B.shape), dy, 0), dx, 1)

    # The tail's claim is deliberately WIDE and the body's is narrow. Which
    # layer a pixel lands in only matters where the two disagree, and near
    # the plume's outer edge there is no body to disagree with -- so a
    # generous tail mask costs nothing and catches the fur wisps that a
    # tight one strands in the body as a hairy outline of where the tail
    # used to be. At the hip, where it would matter, the body draws on top.
    core = ndimage.binary_erosion(Tw, iterations=3)
    gen = ndimage.binary_dilation(Tw, iterations=13)
    a = np.asarray(Bimg).astype(np.float32)
    tail = a.copy()
    tail[:, :, 3] = np.where(gen, a[:, :, 3], 0)
    body = a.copy()
    body[:, :, 3] = np.where(core, 0, a[:, :, 3])

    stem = new_suit[:-4]
    save(tail, stem + "-tail.png")
    save(body, stem + "-body.png")
    repair(stem, min_blob=1, alpha=3)
    px, py = pivot_of(np.asarray(Image.open(stem + "-tail.png").convert("RGBA"))[:, :, 3] > 20)
    print("  %s: aligned at IoU %.3f (scale %.2f), pivot [%d, %d]"
          % (os.path.basename(stem), iou, s, px, py))
    return px, py


def warp(mask, s, _dx, _dy, ca, cb, shape):
    """scale about the old centroid and land it on the new one"""
    h, w = shape
    im = Image.fromarray((mask * 255).astype(np.uint8))
    n = im.resize((max(1, int(round(w * s))), max(1, int(round(h * s)))), Image.NEAREST)
    out = Image.new("L", (w, h), 0)
    out.paste(n, (int(round(cb[0] - ca[0] * s)), int(round(cb[1] - ca[1] * s))))
    return np.asarray(out) > 127


def audit(folder, limit=1.0):
    """Is any of the SWINGING tail still held in the body layer?

    This used to count only blobs disconnected from the body, and so it
    passed eleven suits that were carrying the tail's entire fur outline --
    connected to the hip, and therefore invisible to that test. The measure
    now is the one the player sees: of the tail beyond FAR px of the hinge,
    the part that will not move, what share is the body still drawing?

    It also checks the split is lossless, because the cheap way to score
    zero here would be to delete paint.
    """
    bad = 0
    print("  %-12s %8s %8s %7s %7s" % ("suit", "tailfar", "held", "pct", "lost"))
    for p in sorted(glob.glob(os.path.join(folder, "*-body.png"))):
        stem = p[:-9]
        ta = np.asarray(Image.open(stem + "-tail.png").convert("RGBA"))[:, :, 3]
        ba = np.asarray(Image.open(p).convert("RGBA"))[:, :, 3]
        piv = hinge_of(ta > ALPHA, stem)
        held, tail_far = stranded(ta, ba, piv)
        pct = 100.0 * held / max(1, tail_far)

        lost = -1
        whole = stem + ".png"
        if os.path.exists(whole):
            fa = np.asarray(Image.open(whole).convert("RGBA"))[:, :, 3]
            lost = int(((fa > ALPHA) & (np.maximum(ta, ba) <= ALPHA)).sum())

        flag = ""
        if pct > limit:
            flag = "  <-- ghost tail"
            bad += 1
        if lost > 200:
            flag += "  <-- paint lost"
            bad += 1
        print("  %-12s %8d %8d %6.2f%% %7d%s"
              % (os.path.basename(stem), tail_far, held, pct, lost, flag))
    print("  %d problem(s)" % bad)
    return bad == 0


def main():
    if len(sys.argv) == 4 and sys.argv[1] == "transfer":
        old = sys.argv[2]
        transfer(old, old[:-4] + "-tail.png", sys.argv[3])
        return
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
    if mode == "reseat":
        rows = []
        for p in sorted(glob.glob(os.path.join(target, "*-body.png"))):
            r = reseat(p[:-9])
            if r:
                rows.append(r)
        for r in rows:
            if r.get("skipped"):
                print("  %-12s SKIPPED — would cut %s%% of the body away"
                      % (r["suit"], r["would_lose_pct"]))
            else:
                print("  %-12s %5.2f%% -> %5.2f%%   (%d px off the body)"
                      % (r["suit"], r["before_pct"], r["after_pct"],
                         r["body_px_removed"]))
        print("reseated %d pairs" % len([r for r in rows if not r.get("skipped")]))
        return
    if mode == "audit":
        sys.exit(0 if audit(target) else 1)
    sys.exit(__doc__)


if __name__ == "__main__":
    main()
