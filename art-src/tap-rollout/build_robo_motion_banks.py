#!/usr/bin/env python3
"""Build 16-frame tap banks from each suit's exact shipped pixels.

The approved Robo bank supplies the timing.  Other suits are never redrawn:
their existing body and tail layers are deformed on the 256px rig, which keeps
paint, proportions, head size, collar, and helmet socket stable.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates


ROOT = Path(__file__).resolve().parents[2]
DOC_SUITS = ROOT / "docs" / "art" / "suits"
SANDBOX_SUITS = ROOT / "sandbox_assets" / "art" / "suits"

# Big Booty and Cat keep their owner-supplied custom banks. Robo is the motion
# reference and Eclipse keeps its hand-painted bank.
ELIGIBLE = (
    "flight", "iontrim", "copper", "frost", "voidsuit", "aurorasuit",
    "ember", "stardust", "alien", "ghost", "gemmie", "sammie",
    "seraph", "leviathan", "verdant", "cryostar",
)

PIVOTS = {
    "alien": (106, 145), "aurorasuit": (99, 139), "copper": (99, 131),
    "ember": (107, 136), "flight": (102, 130), "frost": (107, 140),
    "gemmie": (101, 149), "ghost": (103, 128), "iontrim": (100, 130),
    "leviathan": (101, 131), "sammie": (99, 148), "seraph": (105, 138),
    "stardust": (104, 140), "voidsuit": (105, 142), "verdant": (103, 149),
    "cryostar": (103, 151),
}

# Runtime helmet sockets from draw.ts.  The exact static pixels inside each
# socket are restored after articulation, making head size and fitment a hard
# invariant rather than a visual approximation.
DOME = {
    "flight": (185, 82, 44), "iontrim": (178, 88, 48),
    "copper": (183, 85, 45), "frost": (186, 98, 43),
    "voidsuit": (181, 102, 42), "aurorasuit": (181, 101, 44),
    "ember": (182, 100, 44), "stardust": (179, 95, 44),
    "alien": (188, 102, 43), "ghost": (182, 93, 44),
    "gemmie": (204, 92, 58), "sammie": (206, 90, 59),
    "seraph": (207, 97, 57), "leviathan": (207, 81, 57),
    "verdant": (204, 93, 58), "cryostar": (207, 93, 58),
}

# Tail centroid angles measured from the approved 16-frame Robo bank and
# unwrapped relative to frame 1.  The deformation is attenuated slightly for
# painted fur so broad/winged silhouettes do not fold through the torso.
TAIL_DEGREES = (0, -4, -31, -60, -77, -74, -57, -24, 13, 16, -6, -64, -72, -75, -52, -6)

# Knees scrunch promptly, while the hands take the full second to settle.
# This is the part that removes the old snap-back between rapid taps.
LEG_PHASE = (0.0, .18, .48, .82, 1.0, .90, .70, .48, .28, .18, .28, .50, .62, .48, .24, 0.0)
HAND_PHASE = (0.0, .26, .55, .78, 1.0, .96, .88, .78, .68, .59, .50, .42, .33, .23, .12, 0.0)
TORSO_PHASE = (0.0, .12, .28, .46, .58, .54, .44, .32, .22, .16, .20, .28, .30, .22, .10, 0.0)


def rgba(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32)


def alpha_box(a: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(a[..., 3] > 8)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def sample(img: np.ndarray, sx: np.ndarray, sy: np.ndarray) -> np.ndarray:
    out = np.empty_like(img)
    for c in range(4):
        out[..., c] = map_coordinates(img[..., c], [sy, sx], order=1, mode="constant", cval=0.0)
    return np.clip(out, 0, 255)


def bend_tail(img: np.ndarray, pivot: tuple[int, int], degrees: float, strength: float) -> np.ndarray:
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    px, py = pivot
    dx, dy = xx - px, yy - py
    r = np.hypot(dx, dy)
    # The neck stays planted. The outer plume receives the full Robo angle.
    reach = max(45.0, float(np.percentile(r[img[..., 3] > 8], 98)))
    falloff = np.clip((r - 5.0) / (reach - 5.0), 0.0, 1.0) ** 1.18
    theta = math.radians(degrees * strength) * falloff
    ct, st = np.cos(-theta), np.sin(-theta)
    sx = px + dx * ct - dy * st
    sy = py + dx * st + dy * ct
    return sample(img, sx, sy)


def gaussian(xx: np.ndarray, yy: np.ndarray, cx: float, cy: float, sx: float, sy: float) -> np.ndarray:
    return np.exp(-0.5 * (((xx - cx) / sx) ** 2 + ((yy - cy) / sy) ** 2))


def articulate_body(img: np.ndarray, leg: float, hand: float, torso: float) -> np.ndarray:
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x0, y0, x1, y1 = alpha_box(img)
    bw, bh = x1 - x0, y1 - y0

    # Local inverse displacement fields. Broad, feathered weights avoid seams
    # and adapt to the slightly different suit shapes already in the roster.
    rear_leg = gaussian(xx, yy, x0 + .47 * bw, y0 + .79 * bh, .17 * bw, .15 * bh)
    fore_leg = gaussian(xx, yy, x0 + .64 * bw, y0 + .77 * bh, .15 * bw, .14 * bh)
    hands = gaussian(xx, yy, x0 + .82 * bw, y0 + .59 * bh, .16 * bw, .14 * bh)
    chest = gaussian(xx, yy, x0 + .61 * bw, y0 + .57 * bh, .23 * bw, .22 * bh)

    # Keep the complete face, skull, neck ring, and helmet socket immobile.
    hx, hy = x0 + .78 * bw, y0 + .29 * bh
    hrx, hry = .23 * bw, .25 * bh
    head_distance = np.sqrt(((xx - hx) / hrx) ** 2 + ((yy - hy) / hry) ** 2)
    head_lock = np.clip((1.08 - head_distance) / .18, 0.0, 1.0)
    movable = 1.0 - head_lock

    dx = movable * (rear_leg * 2.2 * leg + fore_leg * 1.4 * leg + hands * 2.0 * hand)
    dy = movable * (rear_leg * -4.8 * leg + fore_leg * -3.7 * leg + hands * -.7 * hand)

    # A restrained impulse through the abdomen, pivoting beneath the locked
    # collar. This is deliberately below one gameplay pixel at normal scale.
    dx += movable * chest * 1.15 * torso
    dy += movable * chest * -1.35 * torso
    warped = sample(img, xx - dx, yy - dy)
    # The inner head/collar ellipse is copied bit-for-bit; only its feathered
    # edge blends into the moving torso. This is the size/fitment invariant.
    return warped * (1.0 - head_lock[..., None]) + img * head_lock[..., None]


def over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    sa = src[..., 3:4] / 255.0
    da = dst[..., 3:4] / 255.0
    oa = sa + da * (1.0 - sa)
    rgb = np.where(oa > 1e-6, (src[..., :3] * sa + dst[..., :3] * da * (1.0 - sa)) / np.maximum(oa, 1e-6), 0)
    return np.concatenate([rgb, oa * 255.0], axis=2)


def restore_head(frame: np.ndarray, static: np.ndarray, dome: tuple[int, int, int]) -> np.ndarray:
    yy, xx = np.mgrid[0:frame.shape[0], 0:frame.shape[1]].astype(np.float32)
    hx, hy, radius = dome
    distance = np.hypot(xx - hx, yy - hy)
    # Exact through 1.15r; feather only the outer collar/body transition.
    keep = np.clip((1.32 * radius - distance) / (.17 * radius), 0.0, 1.0)[..., None]
    return frame * (1.0 - keep) + static * keep


def build_one(suit: str, preview_dir: Path | None = None) -> None:
    static = rgba(DOC_SUITS / f"{suit}.png")
    body = rgba(DOC_SUITS / f"{suit}-body.png")
    tail = rgba(DOC_SUITS / f"{suit}-tail.png")
    pivot = PIVOTS[suit]
    # Winged and extra-wide tails need a little less angular travel.
    tail_strength = .70 if suit == "seraph" else .78 if suit in {"leviathan", "verdant", "cryostar"} else .84

    frames: list[Image.Image] = []
    for i in range(16):
        if i in (0, 15):
            frame = static.copy()
        else:
            t = bend_tail(tail, pivot, TAIL_DEGREES[i], tail_strength)
            b = articulate_body(body, LEG_PHASE[i], HAND_PHASE[i], TORSO_PHASE[i])
            frame = restore_head(over(t, b), static, DOME[suit])
        out = Image.fromarray(np.rint(frame).astype(np.uint8), "RGBA")
        frames.append(out)
        for root in (DOC_SUITS, SANDBOX_SUITS):
            root.mkdir(parents=True, exist_ok=True)
            out.save(root / f"{suit}-tap-{i + 1}.png", optimize=True)

    if preview_dir is not None:
        preview_dir.mkdir(parents=True, exist_ok=True)
        sheet = Image.new("RGBA", (1024, 1024))
        for i, frame in enumerate(frames):
            sheet.alpha_composite(frame, ((i % 4) * 256, (i // 4) * 256))
        sheet.save(preview_dir / f"{suit}-tap-contact.png", optimize=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("suits", nargs="*", choices=ELIGIBLE)
    ap.add_argument("--preview-dir", type=Path)
    args = ap.parse_args()
    for suit in (args.suits or ELIGIBLE):
        build_one(suit, args.preview_dir)


if __name__ == "__main__":
    main()
