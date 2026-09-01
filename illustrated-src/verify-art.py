#!/usr/bin/env python3
"""Read-only shipping-art QA for Acornaut Sandbox.

Run from anywhere in the repository:

    python3 illustrated-src/verify-art.py

This gate checks contracts that can be decided mechanically, including the
base suits' normalized on-screen helmet scale. Helmet seating is deliberately
not one of them: shaped glass openings and unusual heads still need the
20-suit x 23-helmet visual matrix described in ART_SPEC.md.
"""

from __future__ import annotations

from collections import deque
import hashlib
import math
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
CATALOG = ROOT / "illustrated-src" / "game" / "catalog.ts"
ART_SOURCE = ROOT / "illustrated-src" / "game" / "art.ts"
DRAW_SOURCE = ROOT / "illustrated-src" / "game" / "draw.ts"
RIG_AUDIT = ROOT / "illustrated-src" / "rig-tail.py"
EDGE_AUDIT = ROOT / "illustrated-src" / "clean-raster-edges.py"

RASTER_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

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
BASE_SUIT_IDS = (
    "flight",
    "iontrim",
    "copper",
    "frost",
    "voidsuit",
    "aurorasuit",
    "ember",
    "stardust",
    "robo",
    "ghost",
    "bigbooty",
)
BASE_HELMET_SCALE_MIN = 0.235
BASE_HELMET_SCALE_MAX = 0.243
BASE_HELMET_SCALE_SPREAD_MAX = 0.005
# Two base suits are not painted to the family's proportions, and holding
# them to the family's scale put a helmet on them a size too big - the glass
# swallowed the head and cut into the body. Robo is a compact head on bulky
# armour; Big Booty is the joke in the name. This audit divides by the whole
# CHARACTER's bounding box, which is the right yardstick only while every
# suit shares a head-to-body ratio, so these two carry the owner's measured
# scale instead. Held to +/-5%, so a typo here is still caught - they are
# calibrated, not exempt.
OFF_FAMILY_HELMET_SCALES = {"robo": 0.2011, "bigbooty": 0.1872}
OFF_FAMILY_HELMET_TOLERANCE = 0.05
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


def verify_art_inventory(qa: QA) -> dict[str, Path]:
    """docs/art is the whole shipping art tree, and it is the only one.

    This used to compare docs/art against a byte-identical sandbox_assets/art
    and fail on drift between them. The mirror is gone - nothing ever loaded
    from it - so the check that remains is the one that was always underneath:
    the tree exists, and here is what is in it for every group below to walk.
    """
    if not DOCS_ART.is_dir():
        qa.fail("docs/art is missing - that is the whole shipping art tree")
        return {}
    files = regular_files(DOCS_ART)
    if not files:
        qa.fail("docs/art is empty")
        return {}
    qa.ok(f"docs/art holds {len(files)} shipping files")
    return files


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
        qa.ok(f"decoded all {len(rasters)} raster assets")
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

    # A PACK MAY ONLY SELL WHAT PRODUCTION SHIPS. Beta-only entries are
    # spliced out of SUITS and HELMETS on the live page, so a bundle listing
    # one advertises an item that cannot exist there - Cyber did exactly
    # that, and the Circuit Pack promised three suits while able to deliver
    # two. Catching it here makes the next one a failed build rather than a
    # refund.
    trails = object_ids(catalog, "TRAILS")
    # art.ts splits its id lists into an always-loaded head and an
    # IS_BETA-only tail, and only the head reaches production.
    suit_block = re.search(r"const suitIds = \[(.*?)\n  \];", art_source, re.S)
    beta_only_art: set[str] = set()
    if suit_block:
        tail = re.search(r"\.\.\.\(IS_BETA \? \[(.*?)\]", suit_block.group(1), re.S)
        beta_only_art = set(re.findall(r'"([^"]+)"', tail.group(1))) if tail else set()
    # art.ts splits its id lists into an always-loaded head and an
    # IS_BETA-only tail; only the head reaches production.
    suit_block = re.search(r"const suitIds = \[(.*?)\n  \];", art_source, re.S)
    beta_only_art: set[str] = set()
    loaded_suits_live: set[str] = set()
    if suit_block:
        body = suit_block.group(1)
        beta_tail = re.search(r"\.\.\.\(IS_BETA \? \[(.*?)\]", body, re.S)
        beta_only_art = set(re.findall(r'"([^"]+)"', beta_tail.group(1))) if beta_tail else set()
        loaded_suits_live = set(re.findall(r'"([^"]+)"', body)) - beta_only_art
    beta_only = {
        item for item in re.findall(r'\{\s*id:\s*"([^"]+)"[^{}]*?\bbeta:\s*true', catalog)
    }
    sellable = set(suits) | set(helmets) | set(pals) | set(trails)
    bundle_block = re.search(r"BUNDLES[^=]*=\s*\[(.*?)\n\];", catalog, re.S)
    if bundle_block:
        for name, items in re.findall(
            r'name:\s*"([^"]+)"[\s\S]*?items:\s*\[(.*?)\]', bundle_block.group(1), re.S
        ):
            # Each slot names its own kind now, so the parse is exact -
            # a bare '"..."' sweep would pick the kind up as if it were an
            # id and report every pack as selling something called "suit".
            slots = re.findall(r'kind:\s*"([^"]+)"\s*,\s*id:\s*"([^"]+)"', items)
            ids = [i for _, i in slots]
            by_kind = {"suit": set(suits), "helm": set(helmets),
                       "trail": set(trails), "pal": set(pals)}
            # AND THE KIND HAS TO BE TRUE. Writing the kind down is only
            # worth anything if it is checked: a trail filed as a suit would
            # price at three times its weight, paint from the wrong list and
            # never say so.
            miskind = sorted({
                f"{i} is sold as a {k}" for k, i in slots
                if k in by_kind and i not in by_kind[k]
            })
            if miskind:
                qa.fail(f"{name} mislabels what it sells: " + clipped(miskind))
            missing = sorted({i for i in ids if i not in sellable})
            gated = sorted({i for i in ids if i in beta_only})
            if missing:
                qa.fail(f"{name} sells items that are in no catalog list: " + clipped(missing))
            if gated:
                qa.fail(
                    f"{name} sells beta-only items, which production strips: "
                    + clipped(gated)
                )
            # AND the ART has to ship. The catalog was only half the answer:
            # art.ts keeps its own beta-gated id list, so an item can sit
            # perfectly in SUITS and still paint an empty card on the live
            # page because its picture never loaded. Cyber did exactly that
            # after being promoted in one file and not the other - and the
            # first version of this guard passed it.
            art_gated = sorted({i for i in ids if i in beta_only_art})
            if art_gated:
                qa.fail(
                    f"{name} sells items whose ART is beta-only, so the live "
                    "card paints nothing: " + clipped(art_gated)
                )
            # AND the art has to ship too. The catalog is only half the
            # answer: art.ts keeps its own beta-gated id lists, so an item
            # can be perfectly present in SUITS and still render as an empty
            # card on the live page because its painting never loaded. Cyber
            # did exactly that after being promoted in one file and not the
            # other.
            art_gated = sorted({
                i for i in ids
                if i in beta_only_art and i not in loaded_suits_live
            })
            if art_gated:
                qa.fail(
                    f"{name} sells items whose ART is beta-only, so the live "
                    f"card paints nothing: " + clipped(art_gated)
                )

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


def verify_base_helmet_scale(qa: QA) -> None:
    """Keep one helmet visually stable while switching among base suits.

    drawSprite normalizes each suit by its alpha-trimmed bounding box, so the
    meaningful helmet scale is DOME radius / max(trimmed width, trimmed height),
    not the raw source radius. Positions remain a visual-review concern.
    """
    try:
        source = DRAW_SOURCE.read_text(encoding="utf-8")
    except OSError as exc:
        qa.fail(f"could not read helmet scale table: {exc}")
        return
    table = re.search(
        r"\bconst\s+DOME(?:\s*:[^=]+)?\s*=\s*\{(.*?)\}\s*;",
        source,
        re.DOTALL,
    )
    if not table:
        qa.fail("could not find DOME table for helmet scale audit")
        return
    entries = {
        suit: float(radius)
        for suit, radius in re.findall(
            r'"suit:([^"]+)"\s*:\s*\[\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*([-\d.]+)\s*\]',
            table.group(1),
        )
    }
    scales: dict[str, float] = {}
    problems: list[str] = []
    for suit in BASE_SUIT_IDS:
        radius = entries.get(suit)
        path = DOCS_ART / "suits" / f"{suit}.png"
        if radius is None:
            problems.append(f"missing DOME radius for {suit}")
            continue
        if not path.exists():
            problems.append(f"missing suits/{suit}.png")
            continue
        with Image.open(path) as image:
            alpha = image.convert("RGBA").getchannel("A")
            mask = alpha.point(lambda value: 255 if value >= 16 else 0)
            box = mask.getbbox()
            if not box:
                problems.append(f"suits/{suit}.png has no alpha bounds")
                continue
            width = min(image.width, box[2] - box[0] + 4)
            height = min(image.height, box[3] - box[1] + 4)
        scales[suit] = radius / max(width, height)
    if problems:
        qa.fail("base helmet scale contract\n" + "\n".join(problems))
        return
    off = []
    for suit, want in OFF_FAMILY_HELMET_SCALES.items():
        got = scales.pop(suit, None)
        if got is None:
            continue
        if abs(got - want) / want > OFF_FAMILY_HELMET_TOLERANCE:
            off.append(f"{suit} {got:.4f} (calibrated {want:.4f})")
    low = min(scales.values())
    high = max(scales.values())
    spread = high - low
    outliers = off + [
        f"{suit} {scale:.4f}"
        for suit, scale in scales.items()
        if scale < BASE_HELMET_SCALE_MIN or scale > BASE_HELMET_SCALE_MAX
    ]
    if outliers or spread > BASE_HELMET_SCALE_SPREAD_MAX:
        detail = ", ".join(f"{suit} {scale:.4f}" for suit, scale in scales.items())
        qa.fail(
            "base helmet display scale drift\n"
            f"range {low:.4f}-{high:.4f}, spread {spread:.4f}; {detail}"
        )
        return
    qa.ok(
        f"base helmet display scale harmonized across {len(scales)} family suits "
        f"({low:.4f}-{high:.4f}, {spread / low * 100:.1f}% spread), "
        f"{len(OFF_FAMILY_HELMET_SCALES)} calibrated off-family"
    )


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



def verify_sprite_sheets(qa: QA) -> None:
    """The badge sheet and the CSS that plays it must agree.

    Nothing about a sprite sheet fails loudly: get the grid wrong and the
    badge simply plays a slice of the wrong cells, which reads as a glitchy
    disc rather than as an error. So the geometry is not written down twice.
    The CSS is the one that has to be right - it is what the browser obeys -
    and this reads the grid back OUT of it and holds the image to it.
    """
    index = ROOT / "docs" / "index.html"
    sheet = DOCS_ART / "ui" / "dust-badge-anim.webp"
    if not index.exists() or not sheet.exists():
        qa.fail("the animated dust badge is missing its sheet or its page")
        return
    css = index.read_text(encoding="utf8")
    cols = re.search(r"\.ac-dustbadgecells\s*\{[^}]*?width:\s*(\d+)%", css, re.S)
    rows = re.search(r"\.ac-dustbadgerow\s*\{[^}]*?height:\s*(\d+)%", css, re.S)
    col_step = re.search(r"\.ac-dustbadgecells\s*\{[^}]*?steps\((\d+)\)", css, re.S)
    row_step = re.search(r"\.ac-dustbadgerow\s*\{[^}]*?steps\((\d+)\)", css, re.S)
    col_time = re.search(r"\.ac-dustbadgecells\s*\{[^}]*?animation:[^;]*?([\d.]+)s", css, re.S)
    row_time = re.search(r"\.ac-dustbadgerow\s*\{[^}]*?animation:[^;]*?([\d.]+)s", css, re.S)
    if not all((cols, rows, col_step, row_step, col_time, row_time)):
        qa.fail("could not read the dust badge grid out of docs/index.html")
        return
    across, down = int(cols.group(1)) // 100, int(rows.group(1)) // 100
    problems: list[str] = []
    if int(col_step.group(1)) != across:
        problems.append(f"the sheet is {across} cells across but steps in {col_step.group(1)}")
    if int(row_step.group(1)) != down:
        problems.append(f"the sheet is {down} cells down but steps in {row_step.group(1)}")
    # the column leg must run exactly one row's worth, or the two legs drift
    # apart and the badge starts sampling cells from two different frames
    if abs(float(row_time.group(1)) - float(col_time.group(1)) * down) > 1e-6:
        problems.append(
            f"the row leg is {row_time.group(1)}s but {down} column legs are "
            f"{float(col_time.group(1)) * down:g}s, so the two drift apart")
    with Image.open(sheet) as image:
        width, height = image.size
        bands = image.getbands()
    if width % across or height % down:
        problems.append(f"{width}x{height} does not divide into {across}x{down} cells")
    elif width // across != height // down:
        problems.append(
            f"cells are {width // across}x{height // down}, which is not square")
    if "A" not in bands:
        problems.append("the sheet lost its alpha, so the disc will paint on a box")
    if problems:
        qa.fail("animated dust badge: " + "; ".join(problems))
    else:
        qa.ok(f"dust badge sheet is {across}x{down} cells of "
              f"{width // across}px, in step with the CSS")



def verify_lazy_banks(qa: QA) -> None:
    """The heavy rosters must stay OFF the boot load.

    This is the check that would have caught the pals: suits were made lazy
    and the pal banks quietly became the biggest thing the game downloads
    before it can show a menu - 18MB of idle animation for the one
    companion a pilot is wearing. Nothing failed, nothing was slower to
    write, and no test noticed. So the shape is asserted rather than
    remembered: each roster has a lazy loader, and the background sweep
    walks both.
    """
    source = ART_SOURCE.read_text(encoding="utf8")
    problems: list[str] = []
    if "namedSeries(PAL_ANIM" in source:
        problems.append(
            "the boot load pulls EVERY pal idle bank again — 18MB of art "
            "for the one pal the pilot wears; hand it the worn pal instead")
    for loader, roster in (("loadSuitBank", "suits"), ("loadPalBank", "pals")):
        if f"export function {loader}" not in source:
            problems.append(f"{loader} is gone, so {roster} have no lazy path")
    sweep = re.search(r"export function prefetchArtBanks\b.*?\n}", source, re.S)
    if not sweep:
        problems.append("the background sweep is gone, so nothing streams after boot")
    else:
        for loader, roster in (("loadSuitBank", "suits"), ("loadPalBank", "pals")):
            if loader not in sweep.group(0):
                problems.append(f"the background sweep no longer streams {roster}")
    if problems:
        qa.fail("boot payload: " + "; ".join(problems))
    else:
        qa.ok("heavy rosters stay off the boot load, and the sweep walks both")


# Classes the UI attaches deliberately WITHOUT styling them: semantic hooks
# that ride alongside a styled companion class. Every entry is a decision,
# not an accident - that is the point of listing them here.
UNSTYLED_HOOKS = {
    "ac-raceobjective",   # modifier on ac-racebriefblock; no look of its own
}


def verify_ui_classes(qa: QA) -> None:
    """Every class the UI creates must be styled in BOTH twins.

    This is the check that would have caught a styled element shipped with
    its CSS in only one of the two hand-edited pages. The failure is
    completely silent: the element renders, the text is there, and the
    class simply does nothing - so on one page a pulsing gold reward chip
    is a line of plain 10px body text and nothing anywhere complains.
    Reading the source cannot catch it either, because the source that is
    wrong is the page you are not looking at.
    """
    ui = (ROOT / "illustrated-src/game/standalone.ts").read_text(encoding="utf8")
    wanted: set[str] = set()
    for m in re.finditer(r'\bel\(\s*"[a-z0-9]+"\s*,\s*"([^"]*)"', ui):
        wanted |= set(m.group(1).split())
    for m in re.finditer(r'classList\.(?:add|toggle|remove)\(\s*"([^"]*)"', ui):
        wanted |= set(m.group(1).split())
    wanted = {c for c in wanted if c.startswith("ac-")} - UNSTYLED_HOOKS

    problems: list[str] = []
    for page in ("docs/index.html", "docs/beta/index.html"):
        text = (ROOT / page).read_text(encoding="utf8")
        gone = sorted(
            c for c in wanted
            if not re.search(r"\." + re.escape(c) + r"(?![\w-])", text))
        if gone:
            problems.append(f"{page} styles none of: {', '.join(gone)}")
    if problems:
        qa.fail("UI classes: " + "; ".join(problems))
    else:
        qa.ok(f"all {len(wanted)} UI classes are styled in the page and its beta")


def verify_card_states(qa: QA) -> None:
    """A free, revealed, unowned suit or helmet must ASK to be collected.

    "EARNED" named the past and asked for nothing, on a card whose only
    job is to be tapped - the tap is the collection. The wording is the
    feature here, so it is asserted: no bare EARNED state survives, and
    the collect chip is still wired to both shelves.
    """
    ui = (ROOT / "illustrated-src/game/standalone.ts").read_text(encoding="utf8")
    # Strip comments first: this file EXPLAINS why "EARNED" was retired, and
    # a guard that trips over its own rationale teaches people to delete the
    # rationale.
    code = re.sub(r"/\*.*?\*/", "", ui, flags=re.S)
    code = re.sub(r"^\s*//.*$", "", code, flags=re.M)
    problems: list[str] = []
    # "EARNED BY FLYING" is a LOCKED pal's hint, not a state - leave it be.
    for m in re.finditer(r'"EARNED(?! BY FLYING)[^"]*"', code):
        problems.append(f'the bare state {m.group(0)} is back on a card')
    if 'function collectTag' not in ui:
        problems.append("collectTag is gone, so no card can ask to be collected")
    if ui.count("b.append(collectTag());") < 2:
        problems.append("only one shelf offers the collect chip; suits and "
                        "helmets both have free unclaimed cards")
    # A FIXED HELMET IS ONE FACT, so it gets one phrasing. Three views state
    # it - the loadout stage tag, the shop case tag, and the note where the
    # helmet shelf would be - and each had drifted to its own words. They now
    # read OWN_HEAD_TAG / OWN_HEAD_LINE, and a literal here means one drifted
    # back. "Its own head" also described the ART instead of the RULE, which
    # is the part a pilot actually needs.
    for bad in re.finditer(r'"[^"]*(?:own head|wears no helmet|helmet cannot be changed)[^"]*"',
                           code, re.I):
        problems.append(f"a fixed-head suit says {bad.group(0)} instead of the "
                        f"shared OWN_HEAD_TAG / OWN_HEAD_LINE")
    if problems:
        qa.fail("card states: " + "; ".join(problems))
    else:
        qa.ok("free unclaimed suits ask to be collected; fixed helmets speak once")


def verify_beta_art_gates(qa: QA) -> None:
    """A suit sold on production must have its ART on production.

    This is the check that would have caught Cyber. It shipped beta-only,
    so its rig and its nine-frame glide banks sat inside `IS_BETA ? ... :`
    in art.ts - correct at the time. Then the shop overhaul put Cyber in
    two bundles, which are the production purchase path, and nothing
    connected the two facts. A pilot could buy the suit on acornaut.app and
    fly a flat sticker, while the beta page flew the animation: no error,
    no missing file, no failing test, and the art directory full of frames
    the production build would never ask for.

    So the rule is asserted instead of remembered: every suit reachable
    without the beta flag - sold in a bundle, or hung off a star gate -
    must have its art wired without the beta flag too.
    """
    art = (ROOT / "illustrated-src/game/art.ts").read_text(encoding="utf8")
    cat = (ROOT / "illustrated-src/game/catalog.ts").read_text(encoding="utf8")

    # what art.ts hides behind IS_BETA, per bank table
    gated: dict[str, set[str]] = {}
    # The 16-frame rollout is finished, so TAP_BANKS joins the motion floor:
    # a live suit left out of it silently falls back to the universal rig,
    # whose tap squashes the body instead of playing painted poses. The only
    # suits that may sit in a beta arm are the ones whose SUIT is beta-gated
    # in catalog.ts - the pair has to move together or the art goes missing
    # exactly the way Cyber's did.
    for table in ("RIGGED_SUITS", "ASC_BANKS", "DESC_BANKS", "TAP_BANKS",
                  "BOUNCE_BANKS", "TAIL_TAP_BANKS"):
        i = art.find(f"const {table}")
        if i < 0:
            continue
        # bound the slice to THIS declaration: everything up to the next
        # top-level const, so one table's beta block is never read as
        # another's
        seg = art[i:i + 2000]
        nxt = seg.find("\nconst ", 1)
        if nxt > 0:
            seg = seg[:nxt]
        for m in re.finditer(r"IS_BETA \? [\[{](.*?)[\]}] :", seg, re.S):
            ids = set(re.findall(r'"([a-z]+)"', m.group(1)))
            ids |= set(re.findall(r"^\s*([a-z]+):", m.group(1), re.M))
            gated.setdefault(table, set()).update(ids)

    # What a production pilot can reach = every suit that SURVIVES the
    # `if (!IS_BETA) SUITS.splice(...)` strip, i.e. every suit not carrying
    # `beta: true`. That is the honest denominator: a beta-gated suit does
    # not exist on the live page, so gating its art with it is correct.
    suits = re.search(r"export const SUITS[^\n]*\n(.*?)^\];", cat, re.S | re.M)
    reachable = set()
    if suits:
        for line in suits.group(1).splitlines():
            m = re.search(r'\{ id: "([a-z]+)"', line)
            if m and "beta: true" not in line:
                reachable.add(m.group(1))

    problems: list[str] = []
    for table, ids in gated.items():
        for sid in sorted(ids & reachable):
            problems.append(f"{sid} is reachable on production but its "
                            f"{table} entry is behind IS_BETA")
    if problems:
        qa.fail("beta art gates: " + "; ".join(problems))
    else:
        qa.ok("every production-reachable suit has its art off the beta flag")


def verify_pose_domes(qa: QA) -> None:
    """A per-pose dome table must be COMPLETE and one size.

    Three suits have tap banks that move the head, so their helmet needs an
    anchor per pose rather than the single "suit:<id>" one. A table like that
    fails quietly in two ways: a missing frame silently falls back to the
    static anchor for that pose alone - one frame in sixteen where the glass
    jumps off the head - and a radius that drifts between poses resizes the
    helmet mid-gesture. Neither shows up in a diff, and both are invisible
    until someone watches the loop at full size.

    So the shape is asserted: sixteen consecutive frames, one radius.
    """
    source = DRAW_SOURCE.read_text(encoding="utf8")
    table = re.search(r"\bconst\s+DOME(?:\s*:[^=]+)?\s*=\s*\{(.*?)\}\s*;",
                      source, re.DOTALL)
    if not table:
        qa.fail("could not find the DOME table")
        return
    poses: dict[str, dict[int, tuple[float, float, float]]] = {}
    for suit, n, x, y, r in re.findall(
            r'"([a-z]+)-tap-(\d+)"\s*:\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]',
            table.group(1)):
        poses.setdefault(suit, {})[int(n)] = (float(x), float(y), float(r))
    problems: list[str] = []
    for suit, frames in sorted(poses.items()):
        missing = [n for n in range(1, 17) if n not in frames]
        if missing:
            problems.append(f"{suit} has {len(frames)}/16 pose anchors, missing "
                            f"{','.join(map(str, missing))} - those poses fall back "
                            f"to the static anchor and the glass jumps")
        radii = {r for _, _, r in frames.values()}
        if len(radii) > 1:
            problems.append(f"{suit}'s helmet changes size mid-gesture: radii "
                            f"{sorted(radii)}")
    if problems:
        qa.fail("pose domes: " + "; ".join(problems))
    else:
        qa.ok(f"per-pose dome tables complete for {len(poses)} suits "
              f"({16 * len(poses)} anchors, one radius each)")


# WHICH DEV INSTRUMENTS SHIP WHERE. A panel that exists to tune the game
# rather than to play it is a DECISION, and decisions belong in a table.
#
# The first version of this check inferred the decision from a nearby
# comment - it looked for "beta page only" or "preproduction" and demanded an
# IS_BETA beside it. That was defeated the first time it mattered: another
# branch moved the cycle inspector onto the live page and rewrote the comment
# in the same edit, so the check saw nothing to complain about and passed.
#
# A guard that a rewrite can silence is not a guard. So the placement is
# declared here, and the check holds the code to the declaration in BOTH
# directions - gating something listed as "both", or ungating something
# listed as "beta", each fails until this table is updated on purpose.
DEV_INSTRUMENTS = {
    # builder            where     why
    "drawCycleRoll":     "both",   # the shop's cycle inspector. Deliberately
                                   # live: the cycle is tuned by watching a
                                   # real shelf, and the real shelf is the
                                   # live one. Rolled up to one line unopened.
    "leanTuner":         "beta",   # the per-suit lean dials. An instrument for
                                   # FINDING a number - the roster is
                                   # calibrated in SUIT_LEAN now - and a live
                                   # pilot meeting a panel of multipliers
                                   # under their suit reads it as damage.
}


def verify_dev_instruments(qa: QA) -> None:
    """Every dev instrument sits where DEV_INSTRUMENTS says it does."""
    ui = (ROOT / "illustrated-src/game/standalone.ts").read_text(encoding="utf8")
    problems: list[str] = []
    for name, where in sorted(DEV_INSTRUMENTS.items()):
        calls = [ln for ln in ui.splitlines()
                 if f"{name}(" in ln and "function " not in ln]
        if not calls:
            problems.append(f"{name} is declared {where} but is never called - "
                            f"either it was deleted, or this table is stale")
            continue
        for ln in calls:
            gated = "IS_BETA" in ln
            if where == "beta" and not gated:
                problems.append(f"{name} is declared beta-only but ships on BOTH "
                                f"pages: {ln.strip()[:60]}")
            if where == "both" and gated:
                problems.append(f"{name} is declared to ship on both pages but is "
                                f"gated on beta: {ln.strip()[:60]}")
    if problems:
        qa.fail("dev instruments: " + "; ".join(problems))
    else:
        qa.ok(f"all {len(DEV_INSTRUMENTS)} dev instruments sit where the table says")


# CALIBRATED, not chosen. The first cut at this was 60 - "0.6 of Flight's
# 99" - a round fraction that promptly failed CYBER at 59, a suit that
# ships, works, and the owner picked out as good. The number was wrong, not
# the suit.
#
# The measurements leave an enormous empty middle:
#
#   flat banks, which cannot carry the model    16 - 20 degrees
#   ...nothing at all in between...
#   banks that work    cyber 59, robo/bigbooty 64, volt 76, flight 99, eclipse 112
#
# 45 sits in that gap with better than double the margin either way. It is
# not a quality bar - it is the line between "these frames differ" and
# "these frames are the same pose". See MOTION_SPEC.md.
MOTION_MIN_PITCH_SPAN = 45.0

# THE CUSTOM FLIGHT TIER IS A GRANT, NOT A MEASUREMENT.
#
# Owner rule, 26 Aug 2026: "everything gets the default flight treatment
# unless I say there's a custom animation or give custom flight sprite
# sheets. the default is flight, but i've given you special ones."
#
# So membership here is a LIST OF NAMES THE OWNER SAID, and the checker's
# job is to make sure the code's registries agree with it. It exists
# because the failure mode is not a crash - it is a suit quietly acquiring
# a bespoke flight path because a generator was to hand and its pitch
# measured well, which is exactly the 24-suit render project that got
# cancelled. Widening this set takes an owner ruling, and the ruling should
# be written into MOTION_SPEC.md in the same change.
#
# `flight` is here as the DEFAULT itself - it is the treatment every other
# suit falls back to, so of course it carries the banks that define it.
# Governs the MOTION-BANK tier (ASC_BANKS / DESC_BANKS) - not the painted
# tap banks, which are an approved rollout every suit shares.
CUSTOM_FLIGHT_SUITS = {
    "flight",     # the default, and the reference the rest are measured against
    "eclipse",    # owner-supplied, and the only granted suit on this tier today
    "cyber",      # declared shape exception, 25 Aug 2026
    "seraph",     # owner-granted 31 Aug 2026: first delivery of the Grok
                  # flight-bank sweep - an 8/8 ascent/descent ramp replacing
                  # the generated tap bank that lost the pilot's lower body.
                  # The sweep will grant the remaining generated-bank suits
                  # the same way, one delivery at a time, each added HERE on
                  # arrival - the grant stays per-suit and deliberate.
    "iontrim",    # owner-delivered 1 Sep 2026: sweep delivery #2, same 8/8
                  # ramp. Its tap bank AND its TAP_FRAME_SKIP stopgap are
                  # retired together - the skip existed only to hide the
                  # frames this delivery redrew.
    "copper",     # owner-delivered 1 Sep 2026: sweep delivery #3, same 8/8
                  # ramp, tap bank retired with it.
    "voidsuit",   # owner-delivered 1 Sep 2026: sweep delivery #4, same 8/8
                  # ramp, tap bank retired with it.
    "alien",      # the A/B WINNER (owner's call, 1 Sep 2026): the
                  # standard-spec spiral-tail bank, 8/8, flying production.
                  # Bank-only - the spiral master has no neck to cut, so
                  # the suit carries no rig layers and zero lean ("the
                  # animation does the work").
    "alien2",     # the RETIRED custom-posed character, kept on the beta
                  # shelf as "Alien 1". Runs 7/7 by the owner's frame cuts
                  # (the black desc swirl and the bled-over spiral asc).
    "stardust",   # owner-delivered 1 Sep 2026: sweep deliveries #6-#8, one
    "aurorasuit", # batch - same 8/8 ramps, tap banks retired with them,
    "ember",      # pose rotations seeded from measured tilt.
    # volt, bigbooty, robo and catsuit are granted custom flight animation
    # too, but theirs are PAINTED TAP BANKS, not motion banks. They are good
    # as they are; do not convert them onto this tier to "finish" the set.
}


def sprite_pitch(path: Path) -> float | None:
    """The body's attitude, as the principal axis of its opaque mass.

    A crude proxy for "which way is the character pointing", and crude is
    fine: what is being asked is whether the frames DIFFER, not what the
    exact angle is.
    """
    try:
        from PIL import Image
        import numpy as np
    except Exception:
        return None
    try:
        im = Image.open(path).convert("RGBA")
    except Exception:
        return None
    alpha = np.array(im)[..., 3] > 24
    ys, xs = np.nonzero(alpha)
    if len(xs) < 50:
        return None
    pts = np.stack([xs - xs.mean(), ys - ys.mean()])
    _, vec = np.linalg.eigh(np.cov(pts))
    ax = vec[:, -1]
    deg = math.degrees(math.atan2(ax[1], ax[0]))
    return deg - 180 if deg > 90 else deg + 180 if deg < -90 else deg


# Suits that ship a tap bank a motion bank has already made unreachable.
# Both are pre-existing and both are waiting on a decision, so they are
# recorded here rather than failing the build - but a NEW suit that does it
# still fails, which is the point.
MOTION_TAP_OVERLAP = {
    "flight": "616 KB that loads and never draws. Harmless, purely wasted; "
              "drop it when the folder is next rewritten.",
    "eclipse": "1.5 MB, and tied to the open question of whether Eclipse keeps "
               "its asc/desc experiment at all. Resolving that resolves this.",
}


def verify_pause_has_an_exit(qa: QA) -> None:
    """The pause sheet can always be left.

    .ac-sheet is a fixed-height flex column, overflow:hidden, centred. That
    is fine until something makes it taller than the phone - and the
    calibration panel does exactly that, taking it to ~1070px on a 932px
    screen. Centred overflow clips SYMMETRICALLY, so it spilled off both
    ends and took RESUME and ABORT with it: every dial readable, no way out.
    Reported from a real phone, where the browser chrome makes it worse.

    Two properties keep it escapable and both are one edit from gone, so
    both are asserted:

      * the sheet SCROLLS rather than clipping
      * the actions are STICKY, so they cannot be scrolled away either

    Either one alone is not enough. Scrolling without sticky means the way
    out exists but is off-screen until you discover you can scroll; sticky
    without scrolling means the content above it is unreachable.
    """
    css = (ROOT / "docs/index.html").read_text(encoding="utf8")
    ui = (ROOT / "illustrated-src/game/standalone.ts").read_text(encoding="utf8")

    def rule(sel: str) -> str:
        m = re.search(r"\n\s*" + re.escape(sel) + r"\s*\{([^}]*)\}", css)
        return " ".join(m.group(1).split()) if m else ""

    problems: list[str] = []
    sheet = rule(".ac-pausesheet")
    if "overflow-y: auto" not in sheet:
        problems.append(".ac-pausesheet does not scroll - a tall pause menu will "
                        "clip off both ends and strand the pilot")
    if "flex: none" not in rule(".ac-pausesheet > *"):
        problems.append(".ac-pausesheet children can shrink - the sheet will "
                        "squash instead of scrolling")
    act = rule(".ac-pauseact")
    if "position: sticky" not in act:
        problems.append(".ac-pauseact is not sticky - RESUME scrolls away with "
                        "everything else")
    # and the markup still has to USE them
    if "ac-sheet ac-center ac-pausesheet" not in ui:
        problems.append("the pause sheet no longer carries ac-pausesheet")
    if 'el("div", "ac-pauseact")' not in ui:
        problems.append("RESUME and ABORT are no longer inside ac-pauseact")

    if problems:
        qa.fail("pause exit: " + "; ".join(problems))
    else:
        qa.ok("the pause menu can always be left, however tall it gets")


def verify_one_tree(qa: QA) -> None:
    """There is ONE shipping tree, and it is docs/.

    sandbox_assets/ was a byte-identical copy of docs/ - 85 MB of duplicate
    art plus the whole built game - that nothing ever loaded. No page, no
    manifest, no deploy step, no workflow. It was simply the output directory
    from before docs/ existed as the Pages root, and it was kept in step for
    years by a mirror write in every art script and two QA checks whose only
    job was to confirm the copy still matched the original.

    Several one-off drop scripts under art-src/ still write to both paths.
    They are archival - the record of how a past art drop was built - and
    rewriting five of them to remove a mirror they would only recreate if
    somebody deliberately re-ran an old drop is churn that can go stale.
    This check cannot go stale: whatever the route back - an old script, a
    stray copy, a bad merge - the tree reappearing fails the build here.
    """
    ghost = ROOT / "sandbox_assets"
    if not ghost.exists():
        qa.ok("one shipping tree: docs/")
        return
    n = len(regular_files(ghost)) if ghost.is_dir() else 1
    qa.fail(f"sandbox_assets/ is back ({n} files). Nothing loads from it - it is a "
            f"duplicate of docs/. Something re-created it: most likely an art-src "
            f"drop script that still mirrors, or a copy step in a build. Delete it "
            f"and stop whatever wrote it.")


def verify_suit_lean(qa: QA) -> None:
    """Every shipping suit has its own lean dial, and the dials are sane.

    Owner ruling, 26 Aug 2026: "the custom aren't custom pitch, they're
    custom animations." Lean is a separate axis from the art, so every suit
    on the roster carries its own number - including the five with custom
    animation, whose FRAMES are untouchable but whose TIP is not.

    The failure this exists to stop is silent: a suit added to SUITS but not
    to SUIT_LEAN falls through to the default and flies with a lean nobody
    chose for it, which is indistinguishable from a lean somebody did choose
    until you look at the table. Nothing crashes, nothing looks obviously
    wrong, and the suit quietly inherits someone else's feel.

    It also bounds the values. A multiplier is not a free-for-all: past
    about 2 the body starts rotating through attitudes no frame was drawn
    for, and negative would tip the suit the wrong way down its own dive.
    """
    consts = (ROOT / "illustrated-src/game/control-constants.ts").read_text(encoding="utf8")
    catalog = (ROOT / "illustrated-src/game/catalog.ts").read_text(encoding="utf8")

    block = re.search(r"export const SUIT_LEAN:[^{]*\{(.*?)\n\};", consts, re.S)
    if not block:
        qa.fail("suit lean: SUIT_LEAN is missing from control-constants.ts")
        return
    dials = {m.group(1): (float(m.group(2)), float(m.group(3)))
             for m in re.finditer(
                 r"(\w+):\s*\{\s*up:\s*([\d.]+),\s*down:\s*([\d.]+)\s*\}",
                 block.group(1))}

    suits = re.findall(r'\{\s*id:\s*"(\w+)"', 
                       re.search(r"export const SUITS[^=]*=\s*\[(.*?)\n\];", catalog, re.S).group(1))
    suits = list(dict.fromkeys(suits))

    problems: list[str] = []
    for suit in suits:
        if suit not in dials:
            problems.append(f"{suit} ships but has no SUIT_LEAN dial - it would fly "
                            f"with a lean nobody chose for it")
    for suit in sorted(set(dials) - set(suits)):
        problems.append(f"{suit} has a SUIT_LEAN dial but is not a shipping suit")
    for suit, (up, down) in sorted(dials.items()):
        for name, v in (("up", up), ("down", down)):
            if not 0 <= v <= 2:
                problems.append(f"{suit}.{name} is {v}; a lean multiplier lives in 0..2 "
                                f"(0 pins it flat, 1 is what ships, 2 is double)")

    if problems:
        qa.fail("suit lean: " + "; ".join(problems))
    else:
        qa.ok(f"all {len(suits)} suits carry their own lean dial")


def verify_motion_banks(qa: QA) -> None:
    """A velocity-indexed pose bank is complete and its head holds still.

    This is the tier MOTION_SPEC.md makes the standard, and it has two
    failure modes that both pass a casual look:

      * A MISSING DOME ANCHOR. paintDome returns silently on a key it does
        not have, so the fault is not a drifting helmet - it is NO helmet,
        on that one pose, at that one attitude. On a contact sheet of eight
        frames it reads as "the climb frames look bare", if it reads at all.
      * A HEAD THAT CHANGES SIZE across the bank. One scale fits the helmet
        to the head, so a bank whose head grows and shrinks makes the dome
        breathe against the face along the ramp. Flight holds 33px on all
        eight - 0.0% spread - which is what makes any of the 20-odd helmets
        sit correctly at every attitude.

    Also catches the waste: a suit with a motion bank can never reach a tap
    bank, because fullMotion is tested first and has no time gate.
    """
    draw = (ROOT / "illustrated-src/game/draw.ts").read_text(encoding="utf8")
    art = (ROOT / "illustrated-src/game/art.ts").read_text(encoding="utf8")
    dome = {k: [float(x) for x in v.split(",")]
            for k, v in re.findall(r'"([a-z]+-(?:asc|desc)-\d+)":\s*\[([^\]]+)\]', draw)}

    def banks(name: str) -> dict[str, int]:
        m = re.search(name + r"[^{]*\{([^}]*)\}", art, re.S)
        if not m:
            return {}
        return {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", m.group(1))}

    asc, desc, tap = banks("ASC_BANKS"), banks("DESC_BANKS"), banks("TAP_BANKS")

    # THE TIER IS A GRANT. Everything defaults to Flight's treatment, and a
    # suit only leaves that default because the owner said so and handed
    # over sheets - so the registries have to match the granted list, in
    # both directions. An id that appears here without a grant is exactly
    # the quiet promotion the rule exists to stop; a granted id missing its
    # registration means the owner's art is not being drawn at all.
    problems: list[str] = []
    # SCOPE: the MOTION-BANK tier only - ASC_BANKS / DESC_BANKS.
    #
    # Not TAP_BANKS. The sixteen-frame painted tap banks are a rollout the
    # owner approved on its own merits ("the verdict is that the painted
    # bank beats the rig"), and all 28 of them ship. They are part of what a
    # suit gets by default, not a bespoke flight path someone granted it.
    #
    # The motion-bank tier is the one that can widen quietly - it is what
    # the cancelled 24-suit render project was going to fill, and adding an
    # id to it silently makes every tap frame that suit ships unreachable
    # (fullMotion beats fullTap and has no time gate). So that is the tier
    # held to the granted list.
    motion = set(asc) | set(desc)
    for suit in sorted(motion - CUSTOM_FLIGHT_SUITS):
        problems.append(
            f"{suit} has a velocity-indexed motion bank but is not in "
            f"CUSTOM_FLIGHT_SUITS - everything defaults to Flight unless the "
            f"owner grants a custom animation (MOTION_SPEC.md, THE RULE)")
    # A suit that wears its own head never calls paintDome at all, so it has
    # no anchors to be missing. Cyber is the case: nine ascent and nine
    # descent frames, no DOME keys, and correct.
    catalog = (ROOT / "illustrated-src/game/catalog.ts").read_text(encoding="utf8")
    own_head = {m.group(1) for m in re.finditer(
        r'\{\s*id:\s*"(\w+)"[^}]*?(?:ownHead|cat):\s*true', catalog)}
    checked = 0
    for suit in sorted(set(asc) & set(desc)):
        checked += 1
        fixed_helmet = suit in own_head
        radii: list[float] = []
        pitches: list[float] = []
        for kind, n in (("asc", asc[suit]), ("desc", desc[suit])):
            for i in range(1, n + 1):
                key = f"{suit}-{kind}-{i}"
                png = ROOT / f"docs/art/suits/{key}.png"
                if not png.exists():
                    problems.append(f"{key}.png is missing but the bank declares it")
                    continue
                p = sprite_pitch(png)
                if p is not None:
                    pitches.append(p)
                if key not in dome:
                    if not fixed_helmet:
                        problems.append(f"{key} has no DOME anchor - that pose draws "
                                        f"NO helmet at all, silently")
                    continue
                radii.append(dome[key][2])
                # A frame's optional 4th value is its helmet POSE ROTATION.
                # The steepest dive in any bank is ~65 degrees, so a value
                # beyond 75 is a typo (a coordinate in the rot slot), and a
                # typo here spins the helmet off the pilot's head in-game.
                if len(dome[key]) > 3 and abs(dome[key][3]) > 75:
                    problems.append(f"{key} has pose rotation {dome[key][3]:.0f} - "
                                    f"beyond any attitude in the art, likely a "
                                    f"misplaced coordinate")
        # THE BANK HAS TO CONTAIN ATTITUDE. The sim picks a frame by vertical
        # velocity, so frames that all point the same way give velocity
        # nothing to pick between - a 16-degree bank is a wing-beat wearing
        # a ramp's clothes. Flight, the standard, spans 99 degrees. Measured
        # across the shipping tap banks, 24 of 28 suits sit at 16-20 and
        # cannot carry this model at all; see MOTION_SPEC.md.
        if len(pitches) > 1:
            span = max(pitches) - min(pitches)
            if span < MOTION_MIN_PITCH_SPAN:
                problems.append(f"{suit}: its pose bank spans only {span:.0f} degrees "
                                f"of pitch ({MOTION_MIN_PITCH_SPAN:.0f} is the floor) - "
                                f"velocity indexing has nothing to pick between")
        if len(radii) > 1:
            spread = (max(radii) - min(radii)) / (sum(radii) / len(radii))
            if spread > 0.04:
                problems.append(f"{suit}: head radius swings {min(radii):.0f}-"
                                f"{max(radii):.0f} across its bank ({spread * 100:.1f}%) "
                                f"- the helmet will breathe along the ramp")
        if suit in tap and suit not in MOTION_TAP_OVERLAP:
            problems.append(f"{suit} ships BOTH a motion bank and a {tap[suit]}-frame "
                            f"tap bank; fullMotion wins with no time gate, so the tap "
                            f"frames load and never draw")

    if problems:
        qa.fail("motion banks: " + "; ".join(problems))
    else:
        qa.ok(f"velocity-indexed pose banks complete for {checked} suits "
              f"(anchor per frame, head radius held), {len(MOTION_TAP_OVERLAP)} "
              f"with a declared dead tap bank")


def verify_one_wormhole_control(qa: QA) -> None:
    """The Wormhole answers to a tap, and to nothing else.

    Three controls were built and flown back to back - tap, hold to rise,
    and Hyper Run's slide. Tap won on the ground that it MATCHES LOST IN
    SPACE: a wormhole is something you fall into out of another mode,
    mid-flight, with no briefing, and arriving in a corridor that answers to
    a different verb than the run you were just flying is what kills those
    runs. The other two read fine on their own and are gone.

    The dials that settled the corridor's numbers went with them - they are
    folded into control-constants.ts now - so this also checks that no
    multiplier has crept back in. A dial is a thing somebody has to be told
    the right value of; a constant is the value.
    """
    sim = (ROOT / "illustrated-src/game/sim.ts").read_text(encoding="utf8")
    ui = (ROOT / "illustrated-src/game/standalone.ts").read_text(encoding="utf8")
    cat = (ROOT / "illustrated-src/game/catalog.ts").read_text(encoding="utf8")
    ctl = (ROOT / "illustrated-src/game/control-constants.ts").read_text(encoding="utf8")
    problems: list[str] = []

    for name, text, where in [
        ("tunnelControlOf", sim, "sim.ts"),
        ("setTunnelHeld", sim, "sim.ts"),
        ("setTunnelDrag", sim, "sim.ts"),
        ("TUNNEL_CONTROLS", cat, "catalog.ts"),
        ("TUNE_DIALS", cat, "catalog.ts"),
        ("TUNE_PANEL", cat, "catalog.ts"),
    ]:
        if name in text:
            problems.append(f"{name} is back in {where} - the wormhole has one "
                            f"control and no dials")
    if "ac-tunerig" in ui:
        problems.append("the tuning rig is back in the UI")
    if "w.tune." in sim:
        problems.append("a corridor value is being multiplied by a dial again "
                        "(w.tune.*) - the settled numbers live in "
                        "control-constants.ts")

    # the settled values themselves, so a silent revert to the old feel fails
    for name, want in [("WORMHOLE_FLAP", "-315"), ("WORMHOLE_GRAVITY", "975"),
                       ("WORMHOLE_SPEED_BASE", "253"), ("WORMHOLE_WIDTH", "1.15"),
                       ("WORMHOLE_TURN", "1.8")]:
        if not re.search(rf"export const {name} = {re.escape(want)}\b", ctl):
            problems.append(f"{name} is no longer {want} - the corridor was "
                            f"settled by flying it, so a change here is a "
                            f"re-tune and wants saying out loud")

    if problems:
        qa.fail("wormhole control: " + "; ".join(problems))
    else:
        qa.ok("the wormhole answers to one control, with its numbers settled")


def verify_scroll_not_squash(qa: QA) -> None:
    """A scrollable, height-capped flex column must not shrink its children.

    This is the check that would have caught the pack sheet. It is a flex
    column pinned at 92vh with overflow-y:auto - meant to SCROLL when a pack
    is tall. But flex items shrink by default, so it COMPRESSED instead:
    every shelf row went 128px to 110px while the 118px cards inside kept
    their min-height and, being overflow:visible, spilled over the heading
    below them. On a phone it reads as the rows hugging each other.

    Nothing errors, nothing warns, and it only appears when the content is
    tall enough to trigger it - which is exactly the case nobody opens while
    building the thing. So the pairing is asserted: cap the height and scroll,
    and you owe the children a flex:none.
    """
    problems: list[str] = []
    for page in ("docs/index.html", "docs/beta/index.html"):
        css = (ROOT / page).read_text(encoding="utf8")
        rules: dict[str, str] = {}
        # Grouped selectors are ordinary CSS - `a > *, b > * { ... }` - so each
        # comma-separated part gets its own entry. The first cut looked up one
        # exact string and reported three false failures against a rule that
        # already covered them.
        for m in re.finditer(r"\n\s*([.#][\w.\-\s>:()*,]+?)\s*\{([^}]*)\}", css):
            body = " ".join(m.group(2).split())
            for part in m.group(1).split(","):
                sel = " ".join(part.split())
                if not sel:
                    continue
                rules[sel] = rules.get(sel, "") + " " + body
        for sel, body in rules.items():
            scrolls = re.search(r"overflow-y:\s*(auto|scroll)", body)
            capped = re.search(r"max-height:|(?<!min-)\bheight:", body)
            if not (scrolls and capped):
                continue
            # DELIBERATELY NOT also requiring display:flex here. The first cut
            # did, and it missed the very bug it was written for: the pack
            # sheet caps and scrolls under .ac-featuresheet but takes its flex
            # column from .ac-lvlcard, a different rule on the same element.
            # Composed classes are normal, so the pairing is asked of every
            # capped scroller - on a container that never becomes a flex
            # column, `> * { flex: none }` is inert, which makes over-asking
            # free and under-asking a live bug.
            kids = rules.get(f"{sel} > *", "")
            if not re.search(r"flex:\s*none|flex-shrink:\s*0", kids):
                problems.append(
                    f"{page}: {sel} scrolls and caps its height but its children "
                    f"can shrink - it will squash instead of scrolling; give it "
                    f"`{sel} > * {{ flex: none; }}`")
    if problems:
        qa.fail("scroll vs squash: " + "; ".join(problems))
    else:
        qa.ok("every scrollable flex column scrolls rather than squashing")


def verify_guide_arrow(qa: QA) -> None:
    """The guided step's coach must live in the shelf it points into.

    Shipped broken twice, both times silently. The coach is
    `position: sticky` so it rides the bottom of the shelf and stays
    pressable - but it was appended to `box.querySelector(".ac-sheet-scroll")`,
    a lookup that runs BEFORE `box.append(scroll)` at the end of drawLoadout.
    It found nothing, fell back to `box`, and parked the coach above the shelf
    (measured on a 430x900 page: coach 510-575, shelf starting at 579). Sticky
    never engaged, and the down-arrow that asks "is my target under the coach?"
    could not be right about anything.

    So two things are asserted, and both are the bug:

      * the coach is appended to the `scroll` column the function is holding,
        never re-found by selector
      * the fold is measured from the COACH's own rect. `frame.bottom` is the
        column's LAYOUT bottom, which runs off the end of the screen, so the
        first cut read a card at y=752 of a 900px phone as "already in view"
        and never showed the arrow.
    """
    src = (ROOT / "illustrated-src/game/standalone.ts").read_text(encoding="utf8")
    # anchor on the coach itself: the guide condition appears four times in
    # this file and the first one is a different screen entirely.
    start = src.find('c.classList.add("ac-coachfind")')
    if start < 0:
        qa.fail("guide arrow: the guided loadout step is gone from drawLoadout")
        return
    block = src[start:start + 4200]
    # the comments in that block explain the two bugs by name, so the code
    # checks below read the block with `//` lines stripped out.
    code = "\n".join(l for l in block.splitlines()
                     if not l.lstrip().startswith("//"))
    problems: list[str] = []
    if not re.search(r"const host = scroll", code):
        problems.append(
            "the coach is not appended to the `scroll` column drawLoadout is "
            "holding - a `.ac-sheet-scroll` lookup here runs before "
            "`box.append(scroll)` and lands the coach above the shelf")
    if "getBoundingClientRect" not in code or "foldY" not in code:
        problems.append(
            "the fold is not measured from the coach's own rect - a card under "
            "the sticky coach reads as visible and the arrow never comes")
    if re.search(r"frame\.bottom", code):
        problems.append(
            "the fold is measured from the column's layout bottom, which runs "
            "off the end of the screen")
    if "ac-coachdown" not in code:
        problems.append("nothing ever adds .ac-coachdown, so the arrow cannot appear")
    for page in ("docs/index.html", "docs/beta/index.html"):
        css = (ROOT / page).read_text(encoding="utf8")
        if ".ac-coachdown::after" not in css:
            problems.append(f"{page}: .ac-coachdown draws no arrow")
    if problems:
        qa.fail("guide arrow: " + "; ".join(problems))
    else:
        qa.ok("the guided step's coach sits in the shelf and measures its own fold")


def verify_baked_domes(qa: QA) -> None:
    """Only the original squirrel frames carry a painted helmet.

    The Clear helmet is the one cosmetic that draws NOTHING when the art it
    sits on already has a dome painted in - stacking two would be worse than
    none. `bakedDome` decides that, and its rule used to be "any key that is
    not `suit:<id>` is baked", written when the eight original squirrel
    frames were the only frame keys there were.

    Seventy-two more arrived since: the per-suit tap, ascent and descent
    banks. Every one of them is bare-headed art that inherited "baked" by
    accident, so Clear drew nothing the moment a bank played and the pilot
    lost their helmet - in flight AND standing in the Loadout, whose preview
    flies the ascent bank. Reported as "flight+clear helmet = no helmet
    equipped". No other helmet reads this flag, which is why it survived.

    The classification is checkable against the files, so it is checked:
    every baked key must be a frame under art/squirrel (the paintings that
    really do wear a dome), and every other frame key must be a per-suit bank
    frame under art/suits. The blanket rule is named and rejected outright -
    it is the shape of the bug, not just its effect.
    """
    source = DRAW_SOURCE.read_text(encoding="utf8")
    fn = re.search(r"function bakedDome\(key: string\) \{(.*?)\n\}", source, re.DOTALL)
    if not fn:
        qa.fail("baked domes: bakedDome is gone from draw.ts")
        return
    problems: list[str] = []
    if re.search(r'if \(!key\.startsWith\("suit:"\)\)\s*return true', fn.group(1)):
        problems.append(
            "bakedDome treats every non-`suit:` key as baked - that is the "
            "per-suit bank frames too, and Clear draws nothing on them")
    baked = re.search(r"const BAKED_FRAMES = new Set\(\[(.*?)\]\)", source, re.DOTALL)
    if not baked:
        problems.append("BAKED_FRAMES is gone - nothing names the domed art")
        keys: list[str] = []
    else:
        keys = re.findall(r'"([^"]+)"', baked.group(1))
        if "BAKED_FRAMES" not in fn.group(1):
            problems.append("bakedDome does not consult BAKED_FRAMES")
    for k in keys:
        if k == "__mix":          # the crossfade between two of those frames
            continue
        if not (ROOT / f"docs/art/squirrel/{k}.png").exists():
            problems.append(
                f"{k} is listed as carrying a painted dome but there is no "
                f"art/squirrel/{k}.png - only the original frames do")
    table = re.search(r"\bconst\s+DOME(?:\s*:[^=]+)?\s*=\s*\{(.*?)\}\s*;",
                      source, re.DOTALL)
    if table:
        for k in re.findall(r'^\s*"([^"]+)"\s*:', table.group(1), re.M):
            if k.startswith("suit:") or k in keys:
                continue
            if not (ROOT / f"docs/art/suits/{k}.png").exists():
                problems.append(
                    f"the dome anchor {k} names neither a baked squirrel frame "
                    f"nor a bank frame at art/suits/{k}.png - it cannot be "
                    f"classified, so Clear's behaviour on it is a guess")
    if problems:
        qa.fail("baked domes: " + "; ".join(problems))
    else:
        qa.ok(f"{len([k for k in keys if k != '__mix'])} frames carry a painted "
              f"dome; every other anchor is bare-headed bank art")


def _torso_mass(path) -> float:
    """Mean silhouette thickness across the middle of the body.

    The generated banks lose the pilot's HIP, HAUNCH and HIND LEG at their
    extremes - the torso becomes a bar from neck to tail. Total alpha area
    does not catch it (the tail grows as the body shrinks, so area holds to
    within 10%), and neither does the bounding box. Thickness through the
    body band does.
    """
    import numpy as np
    with Image.open(path) as im:
        a = np.array(im.convert("RGBA"))[:, :, 3] > 16
    ys, xs = np.where(a)
    if not len(xs):
        return 0.0
    x0, x1 = int(xs.min()), int(xs.max())
    w = x1 - x0 + 1
    col = a.sum(0).astype(float)
    return float(col[int(x0 + 0.28 * w):int(x0 + 0.73 * w) + 1].mean())


def verify_motion_release(qa: QA) -> None:
    """A release clock may only be granted to a suit that flies a motion bank.

    MOTION_RELEASE slows a suit's return-to-level so a carried pose (Seraph's
    spread wings) lingers instead of shuttering. It keys on suit id and is
    consulted only on the fullMotion path - so an entry for a suit without
    ascent/descent banks is a silent no-op, and a typo'd id is a fix that
    never arrives. Both are held here: every key must be a suit registered
    in ASC_BANKS, and the tracker must still take the release parameter.
    """
    draw = DRAW_SOURCE.read_text(encoding="utf8")
    art = ART_SOURCE.read_text(encoding="utf8")
    m = re.search(r"const MOTION_RELEASE: Record<string, number> = \{([^}]*)\}", draw)
    if not m:
        qa.ok("no per-suit motion release table")
        return
    keys = re.findall(r"(\w+)\s*:", m.group(1))
    asc = re.search(r"const ASC_BANKS[^=]*=([^;]*);", art, re.DOTALL)
    granted = set(re.findall(r"(\w+)\s*:\s*\d+", asc.group(1))) if asc else set()
    problems = [f"{k} has a release clock but no ascent bank - the entry is a "
                f"silent no-op" for k in keys if k not in granted]
    if "release = 0.12" not in draw or "MOTION_RELEASE[suit.id]" not in draw:
        problems.append("the tracker no longer consults MOTION_RELEASE")
    if problems:
        qa.fail("motion release: " + "; ".join(problems))
    else:
        qa.ok(f"{len(keys)} suit(s) carry a pose-release clock, all with motion banks")


def verify_tap_frame_skip(qa: QA) -> None:
    """A bank may only skip frames WORSE than every frame it keeps.

    Twenty-two of the tap banks came off one shared generated motion that
    loses the pilot's lower body at its extremes - measured, every one of
    them bottoms out on the same frame, 5, while the five hand-animated
    banks bottom out at 9, 10, 14 and 15. Redrawing them is the real fix;
    TAP_FRAME_SKIP is the interim, and it is dangerous in one specific way:
    it is a hand-written list of numbers that silently deletes art.

    So the list is held to the art it describes. Every skipped frame must
    measure thinner through the torso than every frame kept - which makes
    the table impossible to justify after the fact and impossible to drift.
    Skip a good frame, or keep a bad one, and this fails. A bank must also
    keep enough poses to still read as a gesture.
    """
    src = DRAW_SOURCE.read_text(encoding="utf8")
    m = re.search(r"const TAP_FRAME_SKIP: Record<string, number\[\]> = \{(.*?)\n\};",
                  src, re.DOTALL)
    if not m:
        qa.fail("tap frame skip: TAP_FRAME_SKIP is gone from draw.ts")
        return
    body = "\n".join(l for l in m.group(1).splitlines()
                     if not l.lstrip().startswith("//"))
    table = {sid: [int(n) for n in re.findall(r"\d+", nums)]
             for sid, nums in re.findall(r"(\w+)\s*:\s*\[([^\]]*)\]", body)}
    if not re.search(r"function tapFrameOrder\b", src) or "tapFrameOrder(" not in src.split("function tapFrameOrder")[-1]:
        qa.fail("tap frame skip: tapFrameOrder is gone, so the table does nothing")
        return
    problems: list[str] = []
    checked = 0
    for sid, skip in sorted(table.items()):
        frames = sorted((ROOT / "docs/art/suits").glob(f"{sid}-tap-*.png"),
                        key=lambda f: int(re.search(r"-(\d+)\.png$", f.name).group(1)))
        if not frames:
            problems.append(f"{sid} has no tap bank, so skipping frames of it is a typo")
            continue
        n = len(frames)
        bad = [i for i in skip if i < 1 or i > n]
        if bad:
            problems.append(f"{sid} skips frame(s) {bad} of a {n}-frame bank")
            continue
        kept = [i for i in range(1, n + 1) if i not in skip]
        if len(kept) < 8:
            problems.append(f"{sid} would play only {len(kept)} poses - too few to read "
                            f"as a tap; the bank needs redrawing, not more skipping")
            continue
        mass = {i: _torso_mass(frames[i - 1]) for i in range(1, n + 1)}
        worst_kept = min(mass[i] for i in kept)
        best_skipped = max(mass[i] for i in skip)
        if best_skipped >= worst_kept:
            wk = min(kept, key=lambda i: mass[i])
            bs = max(skip, key=lambda i: mass[i])
            problems.append(
                f"{sid} skips frame {bs} (torso {mass[bs]:.0f}px) while keeping frame "
                f"{wk} (torso {mass[wk]:.0f}px) - a skip list may only remove frames "
                f"thinner than everything it keeps")
            continue
        checked += 1
    if problems:
        qa.fail("tap frame skip: " + "; ".join(problems))
    elif checked:
        qa.ok(f"{checked} tap bank(s) skip only frames measurably thinner than every "
              f"frame they keep")
    else:
        qa.ok("no tap bank skips frames")


def verify_run_lifelines(qa: QA) -> None:
    """The three run lifelines stay wired the way the owner specced them.

    Three owner calls from one message, each a small wire that a refactor
    could cut without a type error: the mission objectives pinned to the
    top of a level run, RESTART LEVEL on the pause sheet for missions only,
    and the crash sheet's acorn continue - the ad slot's stand-in. Each is
    held by the wire that makes it real, not by its copy.
    """
    draw = DRAW_SOURCE.read_text(encoding="utf8")
    st = (ROOT / "illustrated-src/game/standalone.ts").read_text(encoding="utf8")
    en = (ROOT / "illustrated-src/game/engine.ts").read_text(encoding="utf8")
    problems: list[str] = []
    # the pills: drawn from goalHud, inside the level HUD
    if "goalHud(" not in draw:
        problems.append("draw.ts no longer renders the pinned objectives (goalHud)")
    # restart: the button exists AND is gated on a live mission
    i = st.find('"RESTART LEVEL"')
    if i < 0:
        problems.append("the pause sheet lost RESTART LEVEL")
    elif "engine.world.lvl" not in st[max(0, i - 600):i]:
        problems.append("RESTART LEVEL is no longer gated on a mission being flown - "
                        "free flight would grow a restart that means TRY AGAIN")
    if "engine.restartLevel()" not in st:
        problems.append("RESTART LEVEL is not wired to engine.restartLevel")
    # the continue: sheet -> engine -> sim, and the two prices
    if "engine.continueRun()" not in st:
        problems.append("the crash sheet lost its acorn continue")
    if "reviveRun(world, save)" not in en:
        problems.append("engine.continueRun no longer consults sim.reviveRun")
    sim = (ROOT / "illustrated-src/game/sim.ts").read_text(encoding="utf8")
    if not re.search(r"w\.score > 100 \? 50 : 10", sim):
        problems.append("the continue prices drifted from the owner's spec "
                        "(10, or 50 past gate 100)")
    if problems:
        qa.fail("run lifelines: " + "; ".join(problems))
    else:
        qa.ok("objectives pinned, mission restart gated, acorn continue wired at both prices")


def main() -> int:
    print("Acornaut illustrated art QA")
    qa = QA()
    files = verify_art_inventory(qa)
    metadata = decode_rasters(qa, files) if files else {}
    if metadata:
        verify_sprite_dimensions(qa, metadata)
    _, _, pals, rigged = verify_catalog_assets(qa, files)
    if pals:
        verify_pal_bounds(qa, pals)
    verify_lazy_banks(qa)
    verify_ui_classes(qa)
    verify_scroll_not_squash(qa)
    verify_guide_arrow(qa)
    verify_beta_art_gates(qa)
    verify_card_states(qa)
    verify_dev_instruments(qa)
    verify_pause_has_an_exit(qa)
    verify_one_tree(qa)
    verify_motion_banks(qa)
    verify_suit_lean(qa)
    verify_one_wormhole_control(qa)
    verify_sprite_sheets(qa)
    verify_base_helmet_scale(qa)
    verify_pose_domes(qa)
    verify_tap_frame_skip(qa)
    verify_motion_release(qa)
    verify_run_lifelines(qa)
    verify_baked_domes(qa)
    run_edge_audit(qa)
    run_rig_audit(qa, rigged)
    return qa.finish()


if __name__ == "__main__":
    raise SystemExit(main())
