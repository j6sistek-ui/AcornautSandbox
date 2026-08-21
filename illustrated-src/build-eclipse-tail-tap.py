#!/usr/bin/env python3
"""Build the Eclipse tap tail bank from the approved isolated tail painting.

The body bank is hand/AI posed, but the tail is deliberately deterministic:
the original pixels are bent progressively from the hinge to the tip.  This
keeps fur, lighting and outline identity exact while avoiding the rigid-paddle
look of rotating the whole tail around one point.
"""

from pathlib import Path
import math

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/art/suits/eclipse-tail.png"
MASTER_OUT = ROOT / "art-src/animation/eclipse-tail"
MIRRORS = [ROOT / "docs/art/suits", ROOT / "sandbox_assets/art/suits"]

# Same hinge used by draw.ts.  The tail runs up and left from this point.
PIVOT = (105.0, 143.0)
TIP = (22.0, 31.0)
AXIS = (TIP[0] - PIVOT[0], TIP[1] - PIVOT[1])
LENGTH = math.hypot(*AXIS)
UNIT = (AXIS[0] / LENGTH, AXIS[1] / LENGTH)

# Twelve drawings over the 0.40 s burst.  The tail first trails the launch,
# reaches its widest sweep after the arms extend, then whips past home once
# and settles.  Values are radians at the tip; the hinge receives no bend.
ANGLES = (0.00, 0.09, 0.20, 0.34, 0.47, 0.54, 0.46, 0.27, 0.04, -0.15, -0.09, 0.00)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def inverse_point(x: float, y: float, tip_angle: float) -> tuple[float, float]:
    """Approximate inverse of a progressive bend for Pillow's mesh sampler."""
    dx, dy = x - PIVOT[0], y - PIVOT[1]
    along = clamp((dx * UNIT[0] + dy * UNIT[1]) / LENGTH, 0.0, 1.0)
    smooth = along * along * (3.0 - 2.0 * along)
    # The base stays planted; most curvature accumulates through the plume.
    theta = -tip_angle * (smooth ** 1.18)
    c, s = math.cos(theta), math.sin(theta)
    return (PIVOT[0] + dx * c - dy * s, PIVOT[1] + dx * s + dy * c)


def bend(source: Image.Image, angle: float) -> Image.Image:
    step = 8
    mesh = []
    width, height = source.size
    for top in range(0, height, step):
        bottom = min(height, top + step)
        for left in range(0, width, step):
            right = min(width, left + step)
            # Pillow QUAD order: upper-left, lower-left, lower-right, upper-right.
            quad = (
                *inverse_point(left, top, angle),
                *inverse_point(left, bottom, angle),
                *inverse_point(right, bottom, angle),
                *inverse_point(right, top, angle),
            )
            mesh.append(((left, top, right, bottom), quad))
    return source.transform(
        source.size,
        Image.Transform.MESH,
        mesh,
        resample=Image.Resampling.BICUBIC,
    )


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    MASTER_OUT.mkdir(parents=True, exist_ok=True)
    for mirror in MIRRORS:
        mirror.mkdir(parents=True, exist_ok=True)
    for index, angle in enumerate(ANGLES, 1):
        frame = bend(source, angle)
        name = f"eclipse-tail-tap-{index}.png"
        frame.save(MASTER_OUT / name)
        for mirror in MIRRORS:
            frame.save(mirror / name)
    print(f"built {len(ANGLES)} Eclipse tail frames from {SOURCE.name}")


if __name__ == "__main__":
    main()
