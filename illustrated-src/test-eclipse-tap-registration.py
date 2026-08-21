#!/usr/bin/env python3
"""Contract for Eclipse's fixed-size tap head registration.

The tap paintings intentionally retain their authored poses. This verifies
that the runtime correction restores each painting's orange head component to
the approved static body's area and centroid without modifying the rasters.
"""

from __future__ import annotations

import math
import re
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SUITS = ROOT / "docs" / "art" / "suits"
DRAW = ROOT / "illustrated-src" / "game" / "draw.ts"


def head_component(path: Path) -> tuple[int, float, float]:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    remaining: set[tuple[int, int]] = set()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a > 100 and r > 125 and g > 35 and r > g * 1.28 and g > b * 1.12:
                remaining.add((x, y))

    components: list[list[tuple[int, int]]] = []
    while remaining:
        seed = remaining.pop()
        queue = deque([seed])
        points = [seed]
        while queue:
            x, y = queue.popleft()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    queue.append(neighbor)
                    points.append(neighbor)
        if len(points) > 20:
            components.append(points)

    points = max(components, key=len)
    count = len(points)
    return count, sum(x for x, _ in points) / count, sum(y for _, y in points) / count


source = DRAW.read_text()
target_match = re.search(r"ECLIPSE_TAP_HEAD_TARGET[^=]*= \[([\d.]+), ([\d.]+)\]", source)
rows = re.findall(
    r"\{ head: \[([\d.]+), ([\d.]+)\], scale: ([\d.]+) \}",
    source[source.index("const ECLIPSE_TAP_REGISTRATION"):],
)[:8]
assert target_match and len(rows) == 8, "missing Eclipse tap registration table"

static_area, static_x, static_y = head_component(SUITS / "eclipse-body.png")
target_x, target_y = map(float, target_match.groups())
assert math.hypot(target_x - static_x, target_y - static_y) < 0.02, "target drifted from static head"

for index, row in enumerate(rows, start=1):
    measured_area, measured_x, measured_y = head_component(SUITS / f"eclipse-tap-{index}.png")
    head_x, head_y, scale = map(float, row)
    assert math.hypot(head_x - measured_x, head_y - measured_y) < 0.02, f"pose {index} centroid metadata drift"
    corrected_area = measured_area * scale * scale
    area_error = abs(corrected_area / static_area - 1)
    assert area_error < 0.012, f"pose {index} corrected head area differs by {area_error:.1%}"

print({
    "poses": len(rows),
    "static_head_area": static_area,
    "head_centroid_registration": "passed",
    "head_area_registration": "passed",
})
