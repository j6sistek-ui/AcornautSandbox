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
    low = min(scales.values())
    high = max(scales.values())
    spread = high - low
    outliers = [
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
        "base helmet display scale harmonized "
        f"({low:.4f}-{high:.4f}, {spread / low * 100:.1f}% spread)"
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
    verify_lazy_banks(qa)
    verify_sprite_sheets(qa)
    verify_base_helmet_scale(qa)
    run_edge_audit(qa)
    run_rig_audit(qa, rigged)
    return qa.finish()


if __name__ == "__main__":
    raise SystemExit(main())
