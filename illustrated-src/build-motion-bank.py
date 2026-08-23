#!/usr/bin/env python3
"""Turn a transferred motion spritesheet into shippable asc/desc banks.

    python3 illustrated-src/build-motion-bank.py flight art-src/motion-ref/flight-transfer

A transferMotion result is one oscillation - climb, level, dive, back - in
whatever order the model produced, at whatever scale it felt like. The game
needs two ordered banks whose frames all draw the character at ONE size, and
whose first entry is level flight.

Three things happen here, and each of them exists because it was got wrong by
hand at least once:

* CLASSIFY by measured body pitch, not by frame number. The transfer does not
  promise which frames are the climb, and reading them off the sheet by eye is
  how a dive bank ends up with a climb frame in it.

* HEAD-NORMALISE. The transfer's bounding box wanders about three times as
  much as a shipped bank, which in game reads as the character shrinking
  mid-dive - the exact defect the owner caught on Eclipse. Every frame is
  scaled so the HEAD measures the same, because the head is the one rigid
  thing across these poses; normalising on the bounding box instead just
  moves the pulsing into the helmet.

* REGISTER to the suit's shipping static. Frame one has to land on the same
  footprint the rest of the game already draws, or equipping the suit shifts
  the pilot.

The head is found with track-head.py's matcher rather than by colour: four
suits in the catalog have no warm fur at all, and a transfer target could be
any of them.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage, signal

HEAD_TARGET = 88.0     # px, the size every head is scaled to
CANVAS = 256


def load(path):
    return np.array(Image.open(path).convert("RGBA")).astype(np.float64)


def luma(a):
    return (a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114) * (a[..., 3] / 255.0)


def pitch(a):
    """Body pitch in degrees: negative is nose-up."""
    m = a[..., 3] > 128
    ys, xs = np.nonzero(m)
    x = xs - xs.mean()
    y = ys - ys.mean()
    w, v = np.linalg.eigh(np.cov(np.vstack([x, y])))
    major = v[:, np.argmax(w)]
    ang = np.degrees(np.arctan2(major[1], major[0]))
    if ang > 90:
        ang -= 180
    if ang < -90:
        ang += 180
    return ang


def head_at(frame_luma, template, seed, window=52):
    """Best match for the static's head patch, near where it was last seen."""
    t = template - template.mean()
    corr = signal.fftconvolve(frame_luma - frame_luma.mean(), t[::-1, ::-1], mode="same")
    masked = np.full(corr.shape, -np.inf)
    y0, y1 = max(0, int(seed[1] - window)), min(corr.shape[0], int(seed[1] + window))
    x0, x1 = max(0, int(seed[0] - window)), min(corr.shape[1], int(seed[0] + window))
    masked[y0:y1, x0:x1] = corr[y0:y1, x0:x1]
    y, x = np.unravel_index(np.argmax(masked), masked.shape)
    return int(x), int(y)


def head_size(a, centre, radius):
    """Ink inside the head disc, as an equivalent radius — the scale signal."""
    m = a[..., 3] > 128
    yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]
    disc = ((xx - centre[0]) ** 2 + (yy - centre[1]) ** 2) < radius ** 2
    n = int((m & disc).sum())
    return np.sqrt(max(n, 1) / np.pi)


def footprint_size(path):
    a = load(path)
    m = a[..., 3] > 16
    ys, xs = np.nonzero(m)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


def footprint_size_img(im):
    a = np.array(im)
    m = a[..., 3] > 16
    ys, xs = np.nonzero(m)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


def rescale_about_centre(im, k):
    w2, h2 = max(1, int(round(im.width * k))), max(1, int(round(im.height * k)))
    r = im.resize((w2, h2), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.alpha_composite(r, (int(round((CANVAS - w2) / 2)), int(round((CANVAS - h2) / 2))))
    return out


def footprint(path):
    a = load(path)
    m = a[..., 3] > 16
    ys, xs = np.nonzero(m)
    return xs.min(), xs.max(), ys.min(), ys.max()


def normalise(frames, static_path, dome):
    """Scale every frame to a constant head size and centre it consistently."""
    st = luma(load(static_path))
    r = int(dome[2] * 0.85)
    template = st[int(dome[1] - r):int(dome[1] + r), int(dome[0] - r):int(dome[0] + r)]
    seed = (dome[0], dome[1])
    heads, sizes = [], []
    for a in frames:
        c = head_at(luma(a), template, seed)
        seed = c
        heads.append(c)
        sizes.append(head_size(a, c, dome[2]))
    # ONE scale for the whole bank, off the median: per-frame scaling would
    # chase the detector's own noise and reintroduce the pulsing it prevents
    scale = HEAD_TARGET / (2 * float(np.median(sizes)))
    out, anchors = [], []
    for a, c in zip(frames, heads):
        im = Image.fromarray(a.astype(np.uint8), "RGBA")
        w2, h2 = max(1, int(round(im.width * scale))), max(1, int(round(im.height * scale)))
        im = im.resize((w2, h2), Image.LANCZOS)
        arr = np.array(im)
        m = arr[..., 3] > 16
        ys, xs = np.nonzero(m)
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        ox, oy = int(round(CANVAS / 2 - cx)), int(round(CANVAS / 2 - cy))
        canvas.alpha_composite(im, (max(-w2, ox), max(-h2, oy)))
        out.append(canvas)
        anchors.append((round(c[0] * scale + ox, 1), round(c[1] * scale + oy, 1)))
    return out, anchors, HEAD_TARGET / 2 * 1.18


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    suit, src = sys.argv[1], sys.argv[2]
    import re
    draw = open("illustrated-src/game/draw.ts").read()
    m = re.search(r'"suit:' + re.escape(suit) + r'":\s*\[([-\d.,\s]+)\]', draw)
    if not m:
        print(f"no DOME entry for suit:{suit}")
        return 1
    dome = [float(x) for x in m.group(1).split(",")]

    paths = sorted(p for p in os.listdir(src) if p.startswith("f") and p.endswith(".webp"))
    frames = [load(os.path.join(src, p)) for p in paths]
    angles = [pitch(a) for a in frames]

    # Climb is the nose-up half, dive the nose-down half, each ordered
    # level-first. The dive is CAPPED: a transfer will happily overshoot to
    # 88 degrees, which is straight down, and a vertical squirrel has been
    # rejected on sight every time it has shipped. Eclipse's own bank tops
    # out at 80 and that is the ceiling worth matching.
    DIVE_CAP = 80.0
    climb = sorted([i for i, a in enumerate(angles) if a < 12], key=lambda i: angles[i], reverse=True)
    dive = sorted([i for i, a in enumerate(angles) if 12 <= a <= DIVE_CAP], key=lambda i: angles[i])
    dropped = [i + 1 for i, a in enumerate(angles) if a > DIVE_CAP]
    if dropped:
        print(f"dropped {len(dropped)} frame(s) past {DIVE_CAP:.0f} deg (too vertical): {dropped}")
    print(f"pitch range {min(angles):.0f}..{max(angles):.0f}  |  climb {len(climb)} frames, dive {len(dive)}")
    if len(climb) < 2 or len(dive) < 2:
        print("not enough of one direction to build a bank")
        return 1

    def pick(ix, n=8):
        if len(ix) <= n:
            return ix
        return [ix[round(i * (len(ix) - 1) / (n - 1))] for i in range(n)]

    built = {}
    for name, ix in (("asc", pick(climb)), ("desc", pick(dive))):
        built[name] = normalise([frames[i] for i in ix], f"docs/art/suits/{suit}.png", dome) + (ix,)

    # The game draws a motion frame by fitting its BOX to the pilot size, so a
    # bank whose boxes are bigger than the suit's static draws a smaller
    # character. Eclipse's working bank sits at 0.80 of its static's box, so
    # everything is rescaled once - uniformly, both banks together, or the
    # constant head that was just established would stop being constant.
    TARGET_RATIO = 0.80
    sm = max(footprint_size(f"docs/art/suits/{suit}.png"))
    a1 = built["asc"][0][0]
    am = max(footprint_size_img(a1))
    k = (TARGET_RATIO * sm) / max(am, 1)
    print(f"box fit: static {sm}px, bank {am}px -> rescaling bank by {k:.3f} to match Eclipse's 0.80")

    out = {}
    for name in ("asc", "desc"):
        imgs, anchors, radius, ix = built[name]
        for n, (im, anc) in enumerate(zip(imgs, anchors), 1):
            im2 = rescale_about_centre(im, k)
            ax = (anc[0] - CANVAS / 2) * k + CANVAS / 2
            ay = (anc[1] - CANVAS / 2) * k + CANVAS / 2
            for root in ("docs/art/suits", "sandbox_assets/art/suits"):
                im2.save(f"{root}/{suit}-{name}-{n}.png")
            out[f"{suit}-{name}-{n}"] = [round(ax, 1), round(ay, 1), round(radius * k, 1)]
        print(f"  {name}: {len(imgs)} frames from source {[i + 1 for i in ix]}")
    print("\nDOME entries to paste into draw.ts:")
    for k, v in out.items():
        print(f'  "{k}": [{v[0]}, {v[1]}, {v[2]}],')
    json.dump(out, open(f"/tmp/{suit}-dome.json", "w"), indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
