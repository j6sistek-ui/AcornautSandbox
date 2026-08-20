#!/usr/bin/env python3
"""Cut a suit's tail off at the NECK, so only the plume swings.

    python3 illustrated-src/neck-cut.py docs/art/suits            # all rigged
    python3 illustrated-src/neck-cut.py docs/art/suits bigbooty   # just one

WHY THIS EXISTS. Every tail rig in this project -- mine and the
parts-separated pack's alike -- put the squirrel's RUMP and HIND FOOT in the
tail layer. At rest nothing shows it, because the body draws over the tail.
The moment the tail swings, the backside swings with it and the pilot comes
apart. A tap reaches 43 degrees (TAIL.maxA = 0.75 rad), so this was not an
edge case; it was every tap.

The cut therefore has to answer one question -- where does the plume stop
and the animal start -- and the answer is geometric, not chromatic. The
plume meets the rump at a NECK: the narrowest crossing of the silhouette
anywhere near the hip. Find that crossing, cut along it, and the piece that
swings is the piece that should.

    1. take the silhouette, and a seed deep inside the plume and another
       deep inside the torso (deepest = furthest from any edge, which is
       what the distance transform gives)
    2. sweep every straight line that separates the two seeds and keep the
       one crossing the least ink -- that is the neck
    3. the tail is the side of that line holding the plume seed
    4. the HINGE is the middle of the neck, which is why the rotation runs
       along the body instead of tearing a piece off it

The body keeps everything else, plus a round pad at the hinge so the seam
cannot open as the plume rotates. The tail gets a small lip over the body
for the same reason, hidden under the body at rest.
"""
import sys
import os
import glob
import re
import numpy as np

try:
    from PIL import Image
    from scipy import ndimage
except ImportError:                                    # pragma: no cover
    sys.exit("needs pillow and scipy: pip install pillow scipy")

ALPHA = 20
HINGE_PAD = 16      # body paint kept round the hinge, so the seam cannot gap
LIP = 5             # how far the tail laps over the body at the seam
FRINGE = 3          # grow the tail mask this far when clearing the body


def load(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float32)


def save(a, p):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(p)


def deepest(mask, region):
    """the point furthest from any edge inside region -- a seed that cannot
    accidentally sit on a whisker"""
    d = ndimage.distance_transform_edt(mask)
    d = np.where(region, d, 0)
    if not d.any():
        return None
    i = int(np.argmax(d))
    return (i % mask.shape[1], i // mask.shape[1])


def neck(mask, plume, torso, near, max_dist=70):
    """the shortest straight cut through the silhouette that separates the
    two seeds and passes near the old hinge"""
    ys, xs = np.where(mask)
    pts = np.stack([xs, ys], 1).astype(np.float32)
    best = None
    for deg in range(0, 180, 2):
        th = np.deg2rad(deg)
        n = np.array([np.cos(th), np.sin(th)], dtype=np.float32)
        proj = pts @ n
        pp = float(np.dot(n, plume))
        pt = float(np.dot(n, torso))
        if abs(pp - pt) < 8:
            continue                       # this angle cannot separate them
        lo, hi = sorted((pp, pt))
        # One histogram per angle instead of a mask per offset: the chord
        # length at offset c is just how many silhouette pixels project into
        # c's bin. Same answer, and it turns a half-hour sweep into seconds.
        lo_i, hi_i = int(np.floor(lo)) + 4, int(np.ceil(hi)) - 4
        if hi_i - lo_i < 2:
            continue
        edges = np.arange(lo_i, hi_i + 1, 1.0)
        counts, _ = np.histogram(proj, bins=edges)
        sx, _ = np.histogram(proj, bins=edges, weights=pts[:, 0])
        sy, _ = np.histogram(proj, bins=edges, weights=pts[:, 1])
        ok = counts > 0
        if not ok.any():
            continue
        cx = np.where(ok, sx / np.maximum(counts, 1), 0)
        cy = np.where(ok, sy / np.maximum(counts, 1), 0)
        near_ok = np.hypot(cx - near[0], cy - near[1]) <= max_dist
        cand = ok & near_ok
        if not cand.any():
            continue
        idx = int(np.argmin(np.where(cand, counts, 1 << 30)))
        width = int(counts[idx])
        if best is None or width < best[0]:
            c = float(edges[idx]) + 0.5
            best = (width, n.copy(), c,
                    np.array([cx[idx], cy[idx]], dtype=np.float32), None)
    return best


def cut_one(path, piv_hint, dome=None):
    a = load(path)
    al = a[:, :, 3]
    mask = al > ALPHA
    if not mask.any():
        return None
    h, w = mask.shape
    ys, xs = np.mgrid[0:h, 0:w]

    # Seeds come from the EXISTING split, which is wrong about where the tail
    # ENDS but never wrong about where it IS. Guessing the regions from the
    # old hinge instead put Ghost's seed in its torso -- its silhouette is
    # soft and diffuse, so a geometric guess had nothing to hold on to -- and
    # the cut then took the whole animal as the tail.
    stem = path[:-4]
    tp = stem + "-tail.png"
    old_t = None
    if os.path.exists(tp):
        old_t = np.asarray(Image.open(tp).convert("RGBA"))[:, :, 3] > ALPHA

    # The TORSO seed comes first, because the plume is then defined relative
    # to it. A band ahead of the old hinge lands in the chest on every pose
    # here, and cannot reach the head, which is the seed that made the sweep
    # cut the animal's neck instead of the tail's.
    span = max(1, int(np.hypot(*(np.ptp(np.where(mask), axis=1)))))
    # The head is the one lump that must never be the torso seed, and its
    # position is not a guess -- DOME has been measured for every suit. Fence
    # it off. Ion's seed landed on its skull and the sweep duly cut the
    # squirrel's throat, calling everything behind it the tail.
    head_free = np.ones_like(mask)
    if dome is not None:
        head_free = np.hypot(xs - dome[0], ys - dome[1]) > dome[2] * 1.35
    band = mask & head_free & (xs > piv_hint[0] + 20) & (xs < piv_hint[0] + 95)
    torso = deepest(mask, band)
    if torso is None:
        torso = deepest(mask, mask & head_free & (xs > piv_hint[0] + 34))
    if torso is None:
        return None

    # The PLUME seed is the fattest point well away from the torso. Anchoring
    # it to the old hinge instead put Big Booty's seed in its rump -- which on
    # that suit is the fattest thing the old tail mask covered -- so the sweep
    # found the WAIST and called half the squirrel a tail.
    away = np.hypot(xs - torso[0], ys - torso[1]) > 0.28 * span
    region = mask & away
    if old_t is not None and (region & old_t).any():
        region = region & old_t
    plume = deepest(mask, region)
    if plume is None:
        return None

    # A squirrel has TWO narrow crossings: the tail's neck and its actual
    # neck. Pick a torso seed that lands in the head and the sweep happily
    # answers "the head is the body, everything behind it is the tail" --
    # which is how Big Booty, Frost and Ion came back claiming half the
    # animal. Offer several torso seeds, keep every cut that survives the
    # share guard, and take the narrowest of those.
    cands = [torso]
    for lo, hi in ((20, 70), (25, 95), (34, 999)):
        t2 = deepest(mask, mask & head_free & (xs > piv_hint[0] + lo) & (xs < piv_hint[0] + hi))
        if t2 is not None and t2 not in cands:
            cands.append(t2)

    best = None
    for t_seed in cands:
        got = neck(mask, plume, t_seed, piv_hint)
        if got is None:
            continue
        w_, n_, c_, mid_, _ = got
        side_ = (xs * n_[0] + ys * n_[1]) - c_
        sg = 1.0 if (np.dot(n_, plume) - c_) > 0 else -1.0
        ts = mask & ((side_ * sg) > 0)
        lb, kk = ndimage.label(ts)
        if not kk:
            continue
        tl = lb == lb[plume[1], plume[0]]
        share_ = tl.sum() / max(1, mask.sum())
        if share_ > 0.45:
            continue
        # Only the split-derived seed is trusted for this test. The extra
        # band seeds are guesses and one of them can legitimately land in the
        # plume -- testing against all of them rejected every candidate cut
        # for Big Booty, Frost and Ion, whose bands overlap the tail.
        if tl[torso[1], torso[0]]:
            continue                       # it swallowed something that is body
        if best is None or w_ < best[0]:
            best = (w_, n_, c_, mid_, tl, share_)
    if best is None:
        return {"suit": os.path.basename(path[:-4]), "rejected": True, "share": -1.0}
    width, n, c, mid, tail, share = best

    # a small lip over the body, hidden under it at rest, so the seam cannot
    # crack open when the plume turns
    tail_l = ndimage.binary_dilation(tail, iterations=LIP) & mask

    body = mask & ~tail
    # ... and a pad of real body paint at the hinge, same reason
    pad = (np.hypot(xs - mid[0], ys - mid[1]) <= HINGE_PAD) & mask
    body = body | pad
    # nothing of the plume beyond the pad may stay in the body, or it hangs
    # in the air as a ghost when the tail leaves
    body = body & ~(ndimage.binary_dilation(tail, iterations=FRINGE) & ~pad)

    t = a.copy()
    t[:, :, 3] = np.where(tail_l, al, 0)
    b = a.copy()
    b[:, :, 3] = np.where(body, al, 0)

    stem = path[:-4]
    save(t, stem + "-tail.png")
    save(b, stem + "-body.png")
    return {
        "suit": os.path.basename(stem),
        "neck_px": int(width),
        "pivot": [int(round(mid[0])), int(round(mid[1]))],
        "tail_px": int(tail.sum()),
        "body_px": int(body.sum()),
        "share_pct": round(float(share) * 100, 1),
    }


def pivots(root):
    src = open(os.path.join(root, "illustrated-src/game/draw.ts"), encoding="utf8").read()
    blk = src[src.index("const TAIL_PIVOT"):]
    blk = blk[:blk.index("\n};")]
    return {m[0]: (int(m[1]), int(m[2]))
            for m in re.findall(r"(\w+):\s*\[(\d+),\s*(\d+)\]", blk)}


def domes(root):
    """where each suit's head is -- already measured, and the only reliable
    way to keep a seed off the skull"""
    src = open(os.path.join(root, "illustrated-src/game/draw.ts"), encoding="utf8").read()
    blk = src[src.index("const DOME"):]
    blk = blk[:blk.index("\n};")]
    return {m[0]: (int(m[1]), int(m[2]), int(m[3]))
            for m in re.findall(r'"suit:(\w+)":\s*\[(\d+),\s*(\d+),\s*(\d+)\]', blk)}


def main():
    folder = sys.argv[1]
    only = sys.argv[2:] or None
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    piv = pivots(root)
    dom = domes(root)
    rows = []
    for p in sorted(glob.glob(os.path.join(folder, "*.png"))):
        name = os.path.basename(p)[:-4]
        if name.endswith("-tail") or name.endswith("-body"):
            continue
        if name not in piv:
            continue
        if only and name not in only:
            continue
        r = cut_one(p, piv[name], dom.get(name))
        if r:
            rows.append(r)
    print("  %-12s %6s %14s %8s %7s" % ("suit", "neck", "hinge", "tail px", "share"))
    bad = [r for r in rows if r.get("rejected")]
    for r in rows:
        if r.get("rejected"):
            print("  %-12s  REJECTED - the cut claimed %.1f%% of the suit"
                  % (r["suit"], r["share"]))
        else:
            print("  %-12s %6d %14s %8d %6.1f%%"
                  % (r["suit"], r["neck_px"], str(r["pivot"]), r["tail_px"],
                     r["share_pct"]))
    print("\nTAIL_PIVOT for draw.ts:")
    for r in rows:
        if not r.get("rejected"):
            print("  %s: [%d, %d]," % (r["suit"], r["pivot"][0], r["pivot"][1]))
    if bad:
        print("\n%d suit(s) refused - they keep the split they had" % len(bad))


if __name__ == "__main__":
    main()
