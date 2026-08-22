#!/usr/bin/env python3
"""Contract checks for the beta Robo-motion suit rollout."""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label

from build_robo_motion_banks import DOC_SUITS, DOME, ELIGIBLE, SANDBOX_SUITS


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    errors: list[str] = []
    rows: list[str] = []
    for suit in ELIGIBLE:
        static_path = DOC_SUITS / f"{suit}.png"
        static = np.asarray(Image.open(static_path).convert("RGBA"))
        hx, hy, radius = DOME[suit]
        yy, xx = np.mgrid[0:256, 0:256]
        head_core = np.hypot(xx - hx, yy - hy) <= radius * 1.12
        head_core &= static[..., 3] > 128
        max_head_delta = 0
        min_main_ratio = 1.0
        for i in range(1, 17):
            a = DOC_SUITS / f"{suit}-tap-{i}.png"
            b = SANDBOX_SUITS / f"{suit}-tap-{i}.png"
            if not a.exists() or not b.exists():
                errors.append(f"{suit} frame {i}: missing mirror")
                continue
            if digest(a) != digest(b):
                errors.append(f"{suit} frame {i}: runtime mirrors differ")
            im = Image.open(a)
            if im.mode != "RGBA" or im.size != (256, 256):
                errors.append(f"{suit} frame {i}: expected 256x256 RGBA, got {im.size} {im.mode}")
                continue
            arr = np.asarray(im)
            if i in (1, 16) and not np.array_equal(arr, static):
                errors.append(f"{suit} frame {i}: static bookend differs")
            if 1 < i < 16 and np.any(head_core):
                delta = np.abs(arr[..., :3].astype(np.int16) - static[..., :3].astype(np.int16))
                max_head_delta = max(max_head_delta, int(delta[head_core].max()))
            solid = arr[..., 3] > 24
            labs, count = label(solid)
            if count:
                sizes = np.bincount(labs.ravel())[1:]
                min_main_ratio = min(min_main_ratio, float(sizes.max() / max(1, solid.sum())))
        if max_head_delta > 3:
            errors.append(f"{suit}: locked head/collar changed by {max_head_delta} levels")
        if min_main_ratio < .94:
            errors.append(f"{suit}: disconnected alpha, largest component ratio {min_main_ratio:.3f}")
        rows.append(f"{suit:11s} head_delta={max_head_delta:2d} component={min_main_ratio:.3f}")

    print("\n".join(rows))
    if errors:
        raise SystemExit("\n".join(["FAIL", *errors]))
    print(f"PASS: {len(ELIGIBLE)} suits × 16 frames, mirrored and registered")


if __name__ == "__main__":
    main()
