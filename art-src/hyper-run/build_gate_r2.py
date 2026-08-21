"""Build and review the Hyper Run Revision 2 ordinary gate family.

The selected ImageGen master supplies the painted material. This script makes
the production contract deterministic: one circular aperture, one silhouette,
three palette states, and one small near-rim arc shared by all states.
"""

from __future__ import annotations

import colorsys
import hashlib
import math
import random
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
MASTER = HERE / "gate-r2-idle-master.png"
DOCS_ART = ROOT / "docs" / "art" / "hyper-run"
SANDBOX_ART = ROOT / "sandbox_assets" / "art" / "hyper-run"
CONTACT_SHEET = HERE / "hyper-run-r2-contact-sheet.png"

SOURCE_SIZE = 256
CENTER = (127.5, 127.5)
APERTURE_RADIUS = 94.0
GAME_SIZE = 148
GAME_APERTURE_RADIUS = 54
GAME_PILOT_SIZE = 52
PILOT_RADIUS = 16
FRONT_ARC_START = 48.0
FRONT_ARC_END = 132.0
FRONT_ARC_FEATHER = 5.0

STATES = ("idle", "passed", "missed")
STATE_LABELS = {
    "idle": ("IDLE", "violet alloy / cyan dormant glyphs", (94, 219, 255)),
    "passed": ("PASSED", "white-cyan edge / mint-gold confirmation", (121, 255, 211)),
    "missed": ("MISSED", "gunmetal-violet / interrupted amber", (255, 177, 79)),
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_bbox(image: Image.Image, threshold: int = 16) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    binary = alpha.point(lambda value: 255 if value >= threshold else 0)
    box = binary.getbbox()
    if box is None:
        raise ValueError("asset has no visible alpha")
    return box


def prepare_idle_master() -> Image.Image:
    source = Image.open(MASTER).convert("RGBA")
    box = alpha_bbox(source)
    source_center = ((box[0] + box[2] - 1) / 2, (box[1] + box[3] - 1) / 2)
    canvas_center = ((source.width - 1) / 2, (source.height - 1) / 2)
    # Fractional translation keeps the painted ring centered before reduction.
    centered = source.transform(
        source.size,
        Image.Transform.AFFINE,
        (1, 0, source_center[0] - canvas_center[0], 0, 1, source_center[1] - canvas_center[1]),
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )
    reduced = centered.resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.LANCZOS)

    pixels = reduced.load()
    for y in range(SOURCE_SIZE):
        for x in range(SOURCE_SIZE):
            r, g, b, a = pixels[x, y]
            distance = math.hypot(x - CENTER[0], y - CENTER[1])
            if distance < APERTURE_RADIUS:
                a = 0
            elif distance < APERTURE_RADIUS + 1:
                a = round(a * (distance - APERTURE_RADIUS))
            if a == 0:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (r, g, b, a)
    return reduced


def blend_channel(source: int, target: int, amount: float) -> int:
    return max(0, min(255, round(source + (target - source) * amount)))


def recolor(base: Image.Image, state: str) -> Image.Image:
    out = Image.new("RGBA", base.size)
    src = base.load()
    dst = out.load()
    for y in range(SOURCE_SIZE):
        for x in range(SOURCE_SIZE):
            r, g, b, a = src[x, y]
            if not a:
                continue
            if state == "idle":
                if b > r * 1.16 and g > r * 0.92 and b > 70:
                    nr, ng, nb = round(r * 0.74), round(g * 0.80), round(b * 0.84)
                else:
                    nr, ng, nb = r, g, b
            elif state == "passed":
                # Preserve painted structure while lifting energy and separating
                # cyan glyphs, violet plates, and brass confirmation marks.
                if b > r * 1.16 and g > r * 0.92 and b > 70:
                    target = (104, 255, 246)
                    amount = 0.38
                elif r > b * 1.16 and g > b * 1.20:
                    target = (255, 218, 82)
                    amount = 0.26
                else:
                    target = (90, 120, 235)
                    amount = 0.12
                nr = blend_channel(r, target[0], amount)
                ng = blend_channel(g, target[1], amount)
                nb = blend_channel(b, target[2], amount)
                nr = min(255, round(nr * 1.06 + 3))
                ng = min(255, round(ng * 1.10 + 4))
                nb = min(255, round(nb * 1.10 + 4))
            else:
                lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
                is_cyan = b > r * 1.16 and g > r * 0.92 and b > 65
                is_brass = r > b * 1.16 and g > b * 1.18
                if is_cyan:
                    energy = max(0.25, min(1.0, b / 255))
                    nr = round(232 * energy)
                    ng = round(125 * energy)
                    nb = round(30 * energy)
                elif is_brass:
                    nr = round(lum * 0.72)
                    ng = round(lum * 0.56)
                    nb = round(lum * 0.35)
                else:
                    nr = round(lum * 0.47)
                    ng = round(lum * 0.46)
                    nb = round(lum * 0.55)

            distance = math.hypot(x - CENTER[0], y - CENTER[1])
            inner_weight = max(0.0, 1.0 - abs(distance - 96.0) / 4.0)
            if inner_weight:
                if state == "passed":
                    target, strength = (142, 255, 255), 0.38 * inner_weight
                elif state == "missed":
                    target, strength = (55, 108, 150), 0.22 * inner_weight
                else:
                    target, strength = (69, 205, 255), 0.08 * inner_weight
                nr = blend_channel(nr, target[0], strength)
                ng = blend_channel(ng, target[1], strength)
                nb = blend_channel(nb, target[2], strength)
            dst[x, y] = (nr, ng, nb, a)
    return out


def front_arc(back: Image.Image) -> Image.Image:
    out = Image.new("RGBA", back.size)
    src = back.load()
    dst = out.load()
    for y in range(SOURCE_SIZE):
        for x in range(SOURCE_SIZE):
            r, g, b, a = src[x, y]
            if not a:
                continue
            angle = math.degrees(math.atan2(y - CENTER[1], x - CENTER[0])) % 360
            if angle < FRONT_ARC_START or angle > FRONT_ARC_END:
                continue
            weight = 1.0
            if angle < FRONT_ARC_START + FRONT_ARC_FEATHER:
                weight = (angle - FRONT_ARC_START) / FRONT_ARC_FEATHER
            elif angle > FRONT_ARC_END - FRONT_ARC_FEATHER:
                weight = (FRONT_ARC_END - angle) / FRONT_ARC_FEATHER
            dst[x, y] = (r, g, b, round(a * max(0.0, min(1.0, weight))))
    return out


def save_runtime_assets() -> dict[str, dict[str, Image.Image]]:
    DOCS_ART.mkdir(parents=True, exist_ok=True)
    SANDBOX_ART.mkdir(parents=True, exist_ok=True)
    base = prepare_idle_master()
    assets: dict[str, dict[str, Image.Image]] = {}
    for state in STATES:
        back = recolor(base, state)
        front = front_arc(back)
        assets[state] = {"back": back, "front": front}
        for layer, image in assets[state].items():
            name = f"gate-{state}-{layer}.png"
            docs_path = DOCS_ART / name
            sandbox_path = SANDBOX_ART / name
            image.save(docs_path, format="PNG", optimize=True)
            sandbox_path.write_bytes(docs_path.read_bytes())
    return assets


def checker(size: tuple[int, int], cell: int = 12) -> Image.Image:
    image = Image.new("RGB", size, (35, 45, 64))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            color = (53, 65, 87) if (x // cell + y // cell) % 2 else (38, 49, 69)
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=color)
    return image.convert("RGBA")


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    src = image.convert("RGB")
    scale = max(size[0] / src.width, size[1] / src.height)
    resized = src.resize((math.ceil(src.width * scale), math.ceil(src.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1])).convert("RGBA")


def paste_full_canvas(destination: Image.Image, sprite: Image.Image, center: tuple[int, int], size: int) -> None:
    scaled = sprite.resize((size, size), Image.Resampling.LANCZOS)
    destination.alpha_composite(scaled, (round(center[0] - size / 2), round(center[1] - size / 2)))


def trim_sprite(sprite: Image.Image, size: int) -> Image.Image:
    rgba = sprite.convert("RGBA")
    box = alpha_bbox(rgba)
    padded = (
        max(0, box[0] - 2),
        max(0, box[1] - 2),
        min(rgba.width, box[2] + 2),
        min(rgba.height, box[3] + 2),
    )
    cropped = rgba.crop(padded)
    scale = size / max(cropped.width, cropped.height)
    return cropped.resize((round(cropped.width * scale), round(cropped.height * scale)), Image.Resampling.LANCZOS)


def paste_center(destination: Image.Image, sprite: Image.Image, center: tuple[int, int]) -> None:
    destination.alpha_composite(sprite, (round(center[0] - sprite.width / 2), round(center[1] - sprite.height / 2)))


def make_scene(
    assets: dict[str, dict[str, Image.Image]],
    state: str,
    sky_path: Path,
    size: tuple[int, int],
    pilot_offset_y: int = 0,
    collision_overlay: bool = False,
) -> Image.Image:
    scene = cover(Image.open(sky_path), size)
    scrim = Image.new("RGBA", size, (5, 9, 22, 76))
    scene.alpha_composite(scrim)
    center = (size[0] // 2, size[1] // 2)
    paste_full_canvas(scene, assets[state]["back"], center, GAME_SIZE)
    pilot = trim_sprite(Image.open(ROOT / "docs" / "art" / "suits" / "flight.png"), GAME_PILOT_SIZE)
    paste_center(scene, pilot, (center[0], center[1] + pilot_offset_y))
    paste_full_canvas(scene, assets[state]["front"], center, GAME_SIZE)
    if collision_overlay:
        draw = ImageDraw.Draw(scene)
        draw.ellipse(
            (center[0] - GAME_APERTURE_RADIUS, center[1] - GAME_APERTURE_RADIUS,
             center[0] + GAME_APERTURE_RADIUS, center[1] + GAME_APERTURE_RADIUS),
            outline=(86, 224, 255, 235), width=2,
        )
        py = center[1] + pilot_offset_y
        draw.ellipse(
            (center[0] - PILOT_RADIUS, py - PILOT_RADIUS,
             center[0] + PILOT_RADIUS, py + PILOT_RADIUS),
            outline=(255, 196, 77, 235), width=2,
        )
        draw.line((center[0], 16, center[0], size[1] - 16), fill=(255, 255, 255, 90), width=1)
    return scene


def rounded_panel(sheet: Image.Image, box: tuple[int, int, int, int], fill: tuple[int, int, int], outline=(40, 118, 165)) -> None:
    ImageDraw.Draw(sheet).rounded_rectangle(box, radius=22, fill=fill, outline=outline, width=2)


def build_contact_sheet(assets: dict[str, dict[str, Image.Image]]) -> None:
    width, height = 2400, 1700
    sheet = Image.new("RGBA", (width, height), (3, 9, 23, 255))
    draw = ImageDraw.Draw(sheet)
    randomizer = random.Random(7319)
    for _ in range(210):
        x = randomizer.randrange(width)
        y = randomizer.randrange(height)
        radius = randomizer.choice((1, 1, 1, 2))
        color = randomizer.choice(((101, 199, 255, 150), (255, 208, 104, 145), (224, 235, 255, 120)))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)

    draw.text((70, 48), "HYPER RUN", font=font(66, True), fill=(239, 246, 255))
    draw.text((72, 124), "COURSE 1 REVISION 2  /  PHASE B GATE ART REVIEW", font=font(24, True), fill=(72, 210, 255))
    draw.text((72, 162), "Face-on portal family  ·  one collision aperture  ·  BACK → PILOT → FRONT", font=font(20), fill=(166, 188, 218))
    draw.rounded_rectangle((1930, 58, 2328, 132), radius=24, fill=(19, 61, 93), outline=(75, 212, 255), width=2)
    draw.text((2024, 80), "SIGN-OFF SHEET", font=font(23, True), fill=(232, 246, 255))

    sky_paths = {
        "idle": ROOT / "docs" / "art" / "skies" / "indigo.jpg",
        "passed": ROOT / "docs" / "art" / "skies" / "neon.jpg",
        "missed": ROOT / "docs" / "art" / "skies" / "dark10.jpg",
    }
    card_y, card_w, card_h, gap = 220, 720, 650, 40
    for index, state in enumerate(STATES):
        x = 70 + index * (card_w + gap)
        rounded_panel(sheet, (x, card_y, x + card_w, card_y + card_h), (9, 26, 54))
        title, subtitle, accent = STATE_LABELS[state]
        draw.text((x + 28, card_y + 24), title, font=font(30, True), fill=accent)
        draw.text((x + 28, card_y + 64), subtitle, font=font(17), fill=(169, 190, 219))

        scene = make_scene(assets, state, sky_paths[state], (660, 260), collision_overlay=True)
        sheet.alpha_composite(scene, (x + 30, card_y + 102))
        draw.text((x + 42, card_y + 326), "148 px native gate  ·  cyan r54 aperture  ·  gold r16 pilot", font=font(15, True), fill=(226, 237, 251))

        labels = ("BACK", "FRONT", "PAIR", "THREADED")
        for tile_index, label in enumerate(labels):
            tx = x + 25 + tile_index * 170
            ty = card_y + 400
            tile = checker((155, 170))
            if label == "BACK":
                paste_full_canvas(tile, assets[state]["back"], (77, 77), 132)
            elif label == "FRONT":
                paste_full_canvas(tile, assets[state]["front"], (77, 77), 132)
            elif label == "PAIR":
                paste_full_canvas(tile, assets[state]["back"], (77, 77), 132)
                paste_full_canvas(tile, assets[state]["front"], (77, 77), 132)
            else:
                tile = make_scene(assets, state, sky_paths[state], (155, 170), pilot_offset_y=38)
            sheet.alpha_composite(tile, (tx, ty))
            draw.rounded_rectangle((tx, ty, tx + 155, ty + 170), radius=12, outline=(53, 133, 180), width=2)
            draw.text((tx + 12, ty + 140), label, font=font(15, True), fill=(230, 241, 255))

        back_box = alpha_bbox(assets[state]["back"])
        draw.text(
            (x + 28, card_y + 592),
            f"256² RGBA  ·  outer {back_box[2] - back_box[0]}×{back_box[3] - back_box[1]}  ·  center 127.5/127.5",
            font=font(15), fill=(155, 180, 210),
        )

    section_y = 920
    draw.text((70, section_y), "THREADING AND CLEARANCE PROOF", font=font(32, True), fill=(239, 246, 255))
    draw.text((70, section_y + 44), "Idle gate at native 148 px; the front arc remains small and only occludes the pilot near the lower clearance edge.", font=font(18), fill=(166, 188, 218))
    offsets = ((-38, "UPPER LIMIT  −38"), (0, "CENTER LINE"), (38, "LOWER LIMIT  +38"))
    for index, (offset, label) in enumerate(offsets):
        x = 70 + index * 405
        scene = make_scene(assets, "idle", sky_paths["idle"], (370, 300), pilot_offset_y=offset, collision_overlay=True)
        sheet.alpha_composite(scene, (x, section_y + 88))
        draw.rounded_rectangle((x, section_y + 88, x + 370, section_y + 388), radius=16, outline=(53, 133, 180), width=2)
        draw.text((x + 18, section_y + 348), label, font=font(16, True), fill=(235, 243, 255))

    qa_x, qa_y, qa_w, qa_h = 1325, section_y, 1005, 620
    rounded_panel(sheet, (qa_x, qa_y, qa_x + qa_w, qa_y + qa_h), (8, 24, 48))
    draw.text((qa_x + 32, qa_y + 28), "GEOMETRY + DELIVERY QA", font=font(30, True), fill=(239, 246, 255))
    source_diameter = APERTURE_RADIUS * 2
    projected_diameter = source_diameter * GAME_SIZE / SOURCE_SIZE
    front_pixels = sum(1 for value in assets["idle"]["front"].getchannel("A").tobytes() if value >= 16)
    back_pixels = sum(1 for value in assets["idle"]["back"].getchannel("A").tobytes() if value >= 16)
    qa_lines = [
        "COMMON REGISTRATION",
        "Canvas center: (127.5, 127.5) for all six PNGs",
        f"Circular aperture: {source_diameter:.0f} source px → {projected_diameter:.1f} game px (target 108)",
        "Core silhouette and alpha aperture: byte-identical masks across states",
        f"Near-rim front occupancy: {front_pixels / back_pixels * 100:.1f}% of back rim (limit 30%)",
        "",
        "RUNTIME REVIEW TRANSFORM",
        "Back and front shown from the same full 256² canvas into one 148² destination",
        "Current alpha-box fitting is intentionally not reproduced; Phase C must preserve this transform",
        "Maximum authored presentation tilt: ±3°; collision aperture remains circular",
        "",
        "MIRROR + PROVENANCE",
    ]
    y = qa_y + 84
    for line in qa_lines:
        if not line:
            y += 12
            continue
        is_heading = line in {"COMMON REGISTRATION", "RUNTIME REVIEW TRANSFORM", "MIRROR + PROVENANCE"}
        draw.text((qa_x + 34, y), line, font=font(17, is_heading), fill=(75, 213, 255) if is_heading else (192, 209, 230))
        y += 30 if is_heading else 27

    for state in STATES:
        for layer in ("back", "front"):
            name = f"gate-{state}-{layer}.png"
            digest = sha256(DOCS_ART / name)
            match = digest == sha256(SANDBOX_ART / name)
            draw.text((qa_x + 34, y), f"{name:<23} {digest[:16]}…  {'BYTE-MATCH' if match else 'MISMATCH'}", font=font(15), fill=(172, 232, 196) if match else (255, 120, 120))
            y += 23

    entry = DOCS_ART / "entry-rim-back.png"
    entry_match = sha256(entry) == sha256(SANDBOX_ART / entry.name)
    draw.text((qa_x + 34, qa_y + qa_h - 48), f"Approved entry showpiece untouched in this build  ·  mirror {'matches' if entry_match else 'MISMATCH'}  ·  {sha256(entry)[:16]}…", font=font(15, True), fill=(255, 210, 105))
    draw.text((70, 1646), "Review target: full-ring read, identical aperture, game-scale state contrast, and side-view threading. Contact sheet belongs only in art-src/.", font=font(17), fill=(156, 181, 211))
    sheet.convert("RGB").save(CONTACT_SHEET, quality=94, subsampling=0)


def center_component(image: Image.Image) -> tuple[tuple[int, int, int, int], int, bool]:
    alpha = image.getchannel("A")
    start = (round(CENTER[0]), round(CENTER[1]))
    queue = deque([start])
    seen = {start}
    xs: list[int] = []
    ys: list[int] = []
    touches_edge = False
    while queue:
        x, y = queue.popleft()
        if alpha.getpixel((x, y)) >= 16:
            continue
        xs.append(x)
        ys.append(y)
        if x in (0, SOURCE_SIZE - 1) or y in (0, SOURCE_SIZE - 1):
            touches_edge = True
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < SOURCE_SIZE and 0 <= ny < SOURCE_SIZE and (nx, ny) not in seen:
                seen.add((nx, ny))
                if alpha.getpixel((nx, ny)) < 16:
                    queue.append((nx, ny))
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1), len(xs), touches_edge


def validate(assets: dict[str, dict[str, Image.Image]]) -> None:
    reference_back = assets["idle"]["back"].getchannel("A").tobytes()
    reference_front = assets["idle"]["front"].getchannel("A").tobytes()
    for state in STATES:
        for layer in ("back", "front"):
            image = assets[state][layer]
            assert image.mode == "RGBA" and image.size == (256, 256)
            assert image.getchannel("A").getextrema() == (0, 255)
            path = DOCS_ART / f"gate-{state}-{layer}.png"
            mirror = SANDBOX_ART / path.name
            assert path.read_bytes() == mirror.read_bytes()
        assert assets[state]["back"].getchannel("A").tobytes() == reference_back
        assert assets[state]["front"].getchannel("A").tobytes() == reference_front

    back_box = alpha_bbox(assets["idle"]["back"])
    width = back_box[2] - back_box[0]
    height = back_box[3] - back_box[1]
    assert min(width, height) / max(width, height) >= 0.96
    aperture_box, _, touches_edge = center_component(assets["idle"]["back"])
    assert not touches_edge
    aperture_width = aperture_box[2] - aperture_box[0]
    aperture_height = aperture_box[3] - aperture_box[1]
    assert 184 <= aperture_width <= 190 and 184 <= aperture_height <= 190
    front_pixels = sum(1 for value in assets["idle"]["front"].getchannel("A").tobytes() if value >= 16)
    back_pixels = sum(1 for value in assets["idle"]["back"].getchannel("A").tobytes() if value >= 16)
    assert front_pixels / back_pixels <= 0.30


def main() -> None:
    assets = save_runtime_assets()
    validate(assets)
    build_contact_sheet(assets)
    print(f"wrote {CONTACT_SHEET.relative_to(ROOT)}")
    for state in STATES:
        for layer in ("back", "front"):
            path = DOCS_ART / f"gate-{state}-{layer}.png"
            print(f"{path.name}: {sha256(path)}")


if __name__ == "__main__":
    main()
