#!/usr/bin/env python3
"""Find the head in every frame of a motion bank, for any suit.

    python3 illustrated-src/track-head.py eclipse asc docs/art/suits

The motion banks (`-asc-N`, `-desc-N`) are head-normalized before they ship:
every frame is scaled so the head measures the same, which is what keeps the
character from shrinking mid-dive and the helmet from breathing. That needs
the head located in each frame, and the first pass did it by colour — a
warm-orange fur mask.

That does not generalize. Four suits already in the catalog have no orange
fur at all (frost, robo, alien, ghost: the detector finds ZERO pixels), and
they are not unusual — they are just suits whose heads are white, metal,
green and translucent. A colour rule was never going to survive the rollout.

So the head is found by matching the suit's OWN static head patch into each
frame. Heads are rigid across these poses — that is the premise the whole
recipe rests on — so the static is a valid template for every frame of that
suit, whatever it is made of.

One constraint does the real work. Plain matching is right for most frames
but picks the TAIL on the deep-dive poses, where the head is foreshortened
and the tail plume is the stronger match: on Eclipse it landed 100-128px
away on the last three descent frames. A head cannot teleport between
frames, so each search is restricted to a window around the previous
frame's result and walked in order from the static's own anchor. That alone
pulls those frames back to under 10px.

Validated against Eclipse's shipped anchors, which were checked by hand:
median 4.6px, worst 15.3px, against a dome radius of 58px. The worst cases
are the two frames whose shipped anchors were themselves interpolated, so
the disagreement there is partly the reference's.
"""
import re
import sys

import numpy as np
from PIL import Image
from scipy import signal

SEARCH_WINDOW = 46   # px a head may move between adjacent frames


def dome_table(root="."):
    src = open(f"{root}/illustrated-src/game/draw.ts").read()
    out = {}
    for m in re.finditer(r'"([^"]+)":\s*\[([-\d.,\s]+)\]', src):
        nums = [float(x) for x in m.group(2).split(",")]
        if len(nums) >= 3:
            out[m.group(1)] = nums
    return out


def luma(path):
    a = np.array(Image.open(path).convert("RGBA")).astype(np.float64)
    return (a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114) * (a[..., 3] / 255.0)


def track(frames, template, seed, window=SEARCH_WINDOW):
    """Head centre per frame, walked in order so each match constrains the next."""
    t = template - template.mean()
    found = []
    prev = seed
    for path in frames:
        g = luma(path)
        corr = signal.fftconvolve(g - g.mean(), t[::-1, ::-1], mode="same")
        masked = np.full(corr.shape, -np.inf)
        y0, y1 = max(0, int(prev[1] - window)), min(corr.shape[0], int(prev[1] + window))
        x0, x1 = max(0, int(prev[0] - window)), min(corr.shape[1], int(prev[0] + window))
        masked[y0:y1, x0:x1] = corr[y0:y1, x0:x1]
        y, x = np.unravel_index(np.argmax(masked), masked.shape)
        prev = (int(x), int(y))
        found.append(prev)
    return found


def head_template(static_path, anchor):
    g = luma(static_path)
    cx, cy, r = anchor[0], anchor[1], anchor[2]
    half = int(r * 0.85)
    return g[int(cy - half):int(cy + half), int(cx - half):int(cx + half)]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    suit, bank = sys.argv[1], sys.argv[2]
    art = sys.argv[3] if len(sys.argv) > 3 else "docs/art/suits"
    table = dome_table()
    anchor = table.get(f"suit:{suit}")
    if not anchor:
        print(f"no DOME entry for suit:{suit}")
        return 1
    template = head_template(f"{art}/{suit}.png", anchor)
    frames, i = [], 1
    while True:
        import os
        p = f"{art}/{suit}-{bank}-{i}.png"
        if not os.path.exists(p):
            break
        frames.append(p)
        i += 1
    if not frames:
        print(f"no {suit}-{bank}-N.png frames under {art}")
        return 1
    for path, (x, y) in zip(frames, track(frames, template, (anchor[0], anchor[1]))):
        print(f"{path.split('/')[-1]:28s} head ({x}, {y})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
