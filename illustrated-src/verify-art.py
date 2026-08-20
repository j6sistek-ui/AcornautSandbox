#!/usr/bin/env python3
"""Read-only shipping-art QA for Acornaut Sandbox.

Run from anywhere in the repository:

    python3 illustrated-src/verify-art.py

This gate checks contracts that can be decided mechanically. Helmet seating
is deliberately not one of them: shaped glass openings and unusual heads
still need the 17-suit x 20-helmet visual matrix described in ART_SPEC.md.
"""

from __future__ import annotations

from collections import deque
import hashlib
from pathlib import Path
import re
import subprocess
import sys
from typing import Iterable

try:
    from PIL import Image
except ImportError:  # pragma: no cover - dependency failure is the message
    raise SystemExit("verify-art.py needs Pillow: pip install pillow")


ROOT = Path(__file__).resolve().parent.parent
DOCS_ART = ROOT / "docs" / "art"
SANDBOX_ART = ROOT / "sandbox_assets" / "art"
CATALOG = ROOT / "illustrated-src" / "game" / "catalog.ts"
ART_SOURCE = ROOT / "illustrated-src" / "game" / "art.ts"
RIG_AUDIT = ROOT / "illustrated-src" / "rig-tail.py"
EDGE_AUDIT = ROOT / "illustrated-src" / "clean-raster-edges.py"

RASTER_SUFFIXES = {".png", ".jpg", ".jpeg"}

# These are runtime-sized sprites. Other categories intentionally carry
# panoramas, thumbnails, UI plates, trail previews, or 128px overlay masks.
STRICT_256_DIRS = {
    "acorn",
    "debris",
    "golden",
    "helms",
    "pickups",
    "planets",
    "shield",
    "solo",
    "squirrel",
    "suits",
}

# These two portraits once carried detached scraps near the bottom of the
# canvas. Keep every alpha-bearing pixel near the main painting so the
# runtime content box cannot silently double in height again.
COMPACT_PALS = {"cometsprite", "pocketmoon"}
PAL_ALPHA = 15
PAL_MIN_STRAY_AREA = 4
PAL_MAX_DETACHED_GAP = 16
PAL_COMPACT_MARGIN = 12


class QA:
    def __init__(self) -> None:
        self.checks = 0
        self.errors: list[str] = []

    def ok(self, message: str) -> None:
        self.checks += 1
        print(f"  OK  {message}")

    def fail(self, message: str) -> None:
        self.errors.append(message)

    def finish(self) -> int:
        if self.errors:
            print(f"\nFAIL: {len(self.errors)} art QA problem(s)")
            for error in self.errors:
                lines = error.rstrip().splitlines() or [error]
                print(f"  - {lines[0]}")
                for line in lines[1:]:
                    print(f"    {line}")
            return 1
        print(f"\nPASS: shipping art passed {self.checks} QA groups")
        return 0


def regular_files(root: Path) -> dict[str, Path]:
    return {
        path.relative_to(root).as_posix(): path
        for path in root.rglob("*")
        if path.is_file()
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clipped(items: Iterable[str], limit: int = 12) -> str:
    values = list(items)
    shown = values[:limit]
    suffix = f"; ... and {len(values) - limit} more" if len(values) > limit else ""
    return "; ".join(shown) + suffix


def verify_mirrors(qa: QA) -> dict[str, Path]:
    if not DOCS_ART.is_dir() or not SANDBOX_ART.is_dir():
        qa.fail("docs/art and sandbox_assets/art must both exist")
        return {}

    docs = regular_files(DOCS_ART)
    sandbox = regular_files(SANDBOX_ART)
    only_docs = sorted(set(docs) - set(sandbox))
    only_sandbox = sorted(set(sandbox) - set(docs))
    if only_docs or only_sandbox:
        detail = []
        if only_docs:
            detail.append("docs only: " + clipped(only_docs))
        if only_sandbox:
            detail.append("sandbox only: " + clipped(only_sandbox))
        qa.fail("art mirror path drift\n" + "\n".join(detail))

    changed = [
        rel for rel in sorted(set(docs) & set(sandbox))
        if sha256(docs[rel]) != sha256(sandbox[rel])
    ]
    if changed:
        qa.fail("art mirror content drift: " + clipped(changed))
    if not only_docs and not only_sandbox and not changed:
        qa.ok(f"docs/art and sandbox_assets/art match ({len(docs)} files)")
    return docs


def decode_rasters(qa: QA, files: dict[str, Path]) -> dict[str, tuple[tuple[int, int], tuple[str, ...]]]:
    metadata: dict[str, tuple[tuple[int, int], tuple[str, ...]]] = {}
    broken: list[str] = []
    rasters = {
        rel: path for rel, path in files.items()
        if path.suffix.lower() in RASTER_SUFFIXES
    }
    for rel, path in sorted(rasters.items()):
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                image.load()
                metadata[rel] = (image.size, image.getbands())
        except Exception as exc:  # Pillow raises format-specific subclasses
            broken.append(f"{rel}: {exc}")
    if broken:
        qa.fail("raster decode failures\n" + "\n".join(broken))
    else:
        qa.ok(f"decoded all {len(rasters)} mirrored raster assets")
    return metadata


def is_strict_256(rel: str) -> bool:
    parts = Path(rel).parts
    if len(parts) < 2 or Path(rel).suffix.lower() != ".png":
        return False
    if parts[0] in STRICT_256_DIRS:
        return True
    # The helmet card/render itself is 256px. The legacy -over masks are
    # deliberately mixed 128/256px and are not a runtime sprite contract.
    return parts[0] == "helmets" and not Path(rel).stem.endswith("-over")


def verify_sprite_dimensions(
    qa: QA,
    metadata: dict[str, tuple[tuple[int, int], tuple[str, ...]]],
) -> None:
    wrong_size: list[str] = []
    missing_alpha: list[str] = []
    checked = 0
    for rel, (size, bands) in sorted(metadata.items()):
        if not is_strict_256(rel):
            continue
        checked += 1
        if size != (256, 256):
            wrong_size.append(f"{rel} is {size[0]}x{size[1]}")
        if "A" not in bands:
            missing_alpha.append(rel)
    if wrong_size:
        qa.fail("runtime sprites must be 256x256: " + clipped(wrong_size))
    if missing_alpha:
        qa.fail("runtime sprites must retain alpha: " + clipped(missing_alpha))
    if not wrong_size and not missing_alpha:
        qa.ok(f"validated 256x256 RGBA contract for {checked} runtime sprites")


def array_body(source: str, name: str) -> str:
    match = re.search(
        rf"\bconst\s+{re.escape(name)}(?:\s*:[^=]+)?\s*=\s*\[(.*?)\]\s*;",
        source,
        re.DOTALL,
    )
    if not match:
        raise ValueError(f"could not find {name} array")
    return match.group(1)


def object_ids(source: str, name: str) -> list[str]:
    return re.findall(r'\bid\s*:\s*"([^"]+)"', array_body(source, name))


def string_ids(source: str, name: str) -> list[str]:
    return re.findall(r'"([^"]+)"', array_body(source, name))


def integer_constant(source: str, name: str) -> int:
    match = re.search(rf"\bconst\s+{re.escape(name)}\s*=\s*(\d+)\s*;", source)
    if not match:
        raise ValueError(f"could not find {name}")
    return int(match.group(1))


def verify_catalog_assets(
    qa: QA, files: dict[str, Path]
) -> tuple[list[str], list[str], list[str], list[str]]:
    try:
        catalog = CATALOG.read_text(encoding="utf-8")
        art_source = ART_SOURCE.read_text(encoding="utf-8")
        suits = object_ids(catalog, "SUITS")
        helmets = object_ids(catalog, "HELMETS")
        pals = [item for item in object_ids(catalog, "PALS") if item != "none"]
        loaded_suits = string_ids(art_source, "suitIds")
        loaded_helmets = string_ids(art_source, "helmIds")
        loaded_pals = string_ids(art_source, "palIds")
        rigged = string_ids(art_source, "RIGGED_SUITS")
        planet_count = integer_constant(catalog, "PLANET_COUNT")
        debris_count = integer_constant(catalog, "DEBRIS_COUNT")
    except (OSError, ValueError) as exc:
        qa.fail(f"could not read catalog asset contract: {exc}")
        return [], [], [], []

    for label, ids in (("suit", suits), ("helmet", helmets), ("pal", pals)):
        duplicates = sorted({item for item in ids if ids.count(item) > 1})
        if duplicates:
            qa.fail(f"duplicate {label} catalog ids: " + clipped(duplicates))

    comparisons = (
        ("suits", suits, loaded_suits),
        ("helmets", helmets, loaded_helmets),
        ("pals", pals, loaded_pals),
    )
    lists_match = True
    for label, catalog_ids, loaded_ids in comparisons:
        if set(catalog_ids) != set(loaded_ids):
            lists_match = False
            qa.fail(
                f"catalog/load list drift for {label}\n"
                f"catalog: {', '.join(catalog_ids)}\n"
                f"art.ts: {', '.join(loaded_ids)}"
            )

    expected: list[str] = []
    expected.extend(f"suits/{item}.png" for item in suits)
    expected.extend(f"helms/{item}.png" for item in helmets)
    expected.extend(f"solo/{item}.png" for item in pals)
    for item in rigged:
        expected.extend((f"suits/{item}-body.png", f"suits/{item}-tail.png"))
    expected.extend(f"planets/{index}.png" for index in range(planet_count))
    expected.extend(f"debris/{index}.png" for index in range(debris_count))
    for index in range(1, 5):
        expected.extend((
            f"squirrel/idle-{index}.png",
            f"squirrel/flap-{index}.png",
            f"acorn/{index}.png",
            f"golden/{index}.png",
            f"shield/{index}.png",
        ))
    expected.extend((
        "acorn/arcade.png",
        "pickups/frozen.png",
        "pickups/shieldnut.png",
        "sky.jpg",
    ))
    missing = sorted(set(expected) - set(files))
    if missing:
        qa.fail("catalog/runtime assets missing: " + clipped(missing))
    if lists_match and not missing:
        qa.ok(
            f"catalog/load contract ({len(suits)} suits x {len(helmets)} helmets, "
            f"{len(pals)} pals)"
        )
    return suits, helmets, pals, rigged


def alpha_components(path: Path) -> tuple[tuple[int, int], list[tuple[int, tuple[int, int, int, int]]], bytes]:
    with Image.open(path) as image:
        alpha = image.convert("RGBA").getchannel("A")
        width, height = alpha.size
        data = alpha.tobytes()

    visited = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int]]] = []
    for start, value in enumerate(data):
        if value <= PAL_ALPHA or visited[start]:
            continue
        visited[start] = 1
        queue = deque([start])
        area = 0
        min_x = max_x = start % width
        min_y = max_y = start // width
        while queue:
            index = queue.popleft()
            x = index % width
            y = index // width
            area += 1
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            if x > 0:
                neighbor = index - 1
                if not visited[neighbor] and data[neighbor] > PAL_ALPHA:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = index + 1
                if not visited[neighbor] and data[neighbor] > PAL_ALPHA:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = index - width
                if not visited[neighbor] and data[neighbor] > PAL_ALPHA:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = index + width
                if not visited[neighbor] and data[neighbor] > PAL_ALPHA:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        components.append((area, (min_x, min_y, max_x, max_y)))
    components.sort(reverse=True)
    return (width, height), components, data


def rectangle_gap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> int:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    dx = max(ax0 - bx1 - 1, bx0 - ax1 - 1, 0)
    dy = max(ay0 - by1 - 1, by0 - ay1 - 1, 0)
    return max(dx, dy)


def verify_pal_bounds(qa: QA, pal_ids: list[str]) -> None:
    problems: list[str] = []
    compact_boxes: list[str] = []
    for pal in pal_ids:
        path = DOCS_ART / "solo" / f"{pal}.png"
        if not path.exists():
            continue  # catalog verification already reports the missing file
        (width, height), components, alpha = alpha_components(path)
        if not components or components[0][0] < 100:
            problems.append(f"solo/{pal}.png has no substantial painted component")
            continue
        _, main_box = components[0]
        for area, box in components[1:]:
            gap = rectangle_gap(main_box, box)
            if area >= PAL_MIN_STRAY_AREA and gap > PAL_MAX_DETACHED_GAP:
                problems.append(
                    f"solo/{pal}.png has detached {area}px component at {box}, "
                    f"{gap}px from main art {main_box}"
                )
        if pal in COMPACT_PALS:
            x0, y0, x1, y1 = main_box
            ex0 = max(0, x0 - PAL_COMPACT_MARGIN)
            ey0 = max(0, y0 - PAL_COMPACT_MARGIN)
            ex1 = min(width - 1, x1 + PAL_COMPACT_MARGIN)
            ey1 = min(height - 1, y1 + PAL_COMPACT_MARGIN)
            far = 0
            for index, value in enumerate(alpha):
                if value <= PAL_ALPHA:
                    continue
                x = index % width
                y = index // width
                if x < ex0 or x > ex1 or y < ey0 or y > ey1:
                    far += 1
            if far:
                problems.append(
                    f"solo/{pal}.png has {far} alpha pixels beyond the main-art margin"
                )
            compact_boxes.append(f"{pal} {main_box}")
    if problems:
        qa.fail("pal cutout bounds/strays\n" + "\n".join(problems))
    else:
        detail = ", ".join(compact_boxes)
        qa.ok(f"pal cutouts have no remote components ({detail})")


def run_edge_audit(qa: QA) -> None:
    result = subprocess.run(
        [sys.executable, str(EDGE_AUDIT), "audit", str(DOCS_ART)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
        qa.fail("raster-edge audit failed" + ("\n" + output if output else ""))
        return
    qa.ok("reviewed raster cutouts have clean, antialiased edges")


def run_rig_audit(qa: QA, rigged: list[str]) -> None:
    result = subprocess.run(
        [sys.executable, str(RIG_AUDIT), "audit", str(DOCS_ART / "suits")],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
        qa.fail("rig-tail audit failed" + ("\n" + output if output else ""))
        return
    qa.ok(f"rig-tail audit passed for {len(rigged)} active rigs")


def main() -> int:
    print("Acornaut illustrated art QA")
    qa = QA()
    files = verify_mirrors(qa)
    metadata = decode_rasters(qa, files) if files else {}
    if metadata:
        verify_sprite_dimensions(qa, metadata)
    _, _, pals, rigged = verify_catalog_assets(qa, files)
    if pals:
        verify_pal_bounds(qa, pals)
    run_edge_audit(qa)
    run_rig_audit(qa, rigged)
    return qa.finish()


if __name__ == "__main__":
    raise SystemExit(main())
