"""Build the Hyper Run scout ship from its generated source master.

The ImageGen master intentionally contains no pilot. This deterministic pass
removes the neutral preview field, preserves the open cockpit, registers the
ship on a 256px RGBA canvas, mirrors the runtime asset byte-for-byte, and
creates a review sheet outside the deploy roots.
"""

from __future__ import annotations

import hashlib
import random
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
MASTER = HERE / "scout-ship-master.png"
DOCS_ASSET = ROOT / "docs" / "art" / "hyper-run" / "scout-ship.png"
SANDBOX_ASSET = ROOT / "sandbox_assets" / "art" / "hyper-run" / "scout-ship.png"
CONTACT_SHEET = HERE / "scout-ship-contact-sheet.png"

CANVAS_SIZE = 256
CONTENT_WIDTH = 232
CONTENT_HEIGHT = 150


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


def neutral_preview_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    return min(r, g, b) >= 224 and max(r, g, b) - min(r, g, b) <= 24


def remove_connected_preview(source: Image.Image) -> Image.Image:
    """Remove only the bright neutral field connected to the canvas edge.

    The connectivity rule protects enclosed silver highlights while letting
    the flood enter the open U-shaped cockpit from above. Downsampling the
    high-resolution binary edge restores a clean antialiased runtime contour.
    """

    image = source.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def offer(x: int, y: int) -> None:
        index = y * width + x
        if outside[index] or not neutral_preview_pixel(pixels[x, y]):
            return
        outside[index] = 1
        queue.append((x, y))

    for x in range(width):
        offer(x, 0)
        offer(x, height - 1)
    for y in range(height):
        offer(0, y)
        offer(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            offer(x - 1, y)
        if x + 1 < width:
            offer(x + 1, y)
        if y > 0:
            offer(x, y - 1)
        if y + 1 < height:
            offer(x, y + 1)

    cleaned = image.copy()
    output = cleaned.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if outside[row + x]:
                output[x, y] = (0, 0, 0, 0)
    return cleaned


def build_runtime() -> Image.Image:
    source = remove_connected_preview(Image.open(MASTER))
    alpha = source.getchannel("A")
    box = alpha.getbbox()
    if box is None:
        raise ValueError("scout ship master has no visible pixels")
    crop = source.crop(box)
    scale = min(CONTENT_WIDTH / crop.width, CONTENT_HEIGHT / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    reduced = crop.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    at = ((CANVAS_SIZE - size[0]) // 2, (CANVAS_SIZE - size[1]) // 2)
    canvas.alpha_composite(reduced, at)

    runtime_alpha = canvas.getchannel("A")
    runtime_box = runtime_alpha.getbbox()
    if runtime_box is None:
        raise ValueError("runtime scout ship is empty")
    if runtime_box[2] - runtime_box[0] < 220 or runtime_box[3] - runtime_box[1] < 90:
        raise ValueError(f"runtime scout ship registration is too small: {runtime_box}")
    if runtime_alpha.getpixel((148, 96)) > 16:
        raise ValueError("cockpit opening is not transparent at the pilot anchor")
    if runtime_alpha.getpixel((148, 142)) < 160:
        raise ValueError("lower cockpit hull is missing beneath the pilot anchor")

    DOCS_ASSET.parent.mkdir(parents=True, exist_ok=True)
    SANDBOX_ASSET.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(DOCS_ASSET, format="PNG", optimize=True)
    SANDBOX_ASSET.write_bytes(DOCS_ASSET.read_bytes())
    if sha256(DOCS_ASSET) != sha256(SANDBOX_ASSET):
        raise ValueError("scout ship runtime mirrors are not byte-identical")
    return canvas


def star_field(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size, (5, 11, 28, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(0x53484950)
    for _ in range(210):
        x = rng.randrange(size[0])
        y = rng.randrange(size[1])
        value = rng.randrange(110, 235)
        radius = 1 if rng.random() < 0.94 else 2
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(value, value, 255, 150))
    return image


def make_contact_sheet(ship: Image.Image) -> None:
    sheet = star_field((1080, 780))
    draw = ImageDraw.Draw(sheet)
    draw.text((48, 34), "HYPER RUN · SCOUT SHIP", font=font(34, True), fill=(241, 245, 255, 255))
    draw.text((48, 82), "Empty shell registration · live pilot composite is verified in the runtime harness", font=font(18), fill=(169, 190, 225, 255))

    cards = [(48, 140, 96, "96 px · landscape"), (398, 140, 80, "80 px · canonical"), (748, 140, 64, "64 px · compact")]
    for left, top, size, label in cards:
        draw.rounded_rectangle((left, top, left + 284, top + 360), radius=24,
                               fill=(9, 18, 42, 225), outline=(83, 111, 174, 255), width=2)
        ring_center = (left + 226, top + 154)
        ring_radius = round(58 * size / 80)
        draw.ellipse((ring_center[0] - ring_radius, ring_center[1] - ring_radius,
                      ring_center[0] + ring_radius, ring_center[1] + ring_radius),
                     outline=(239, 245, 255, 210), width=3)
        ship_box = ship.getchannel("A").getbbox()
        if ship_box is None:
            raise ValueError("contact-sheet ship is empty")
        crop = ship.crop(ship_box)
        sprite_scale = size / max(crop.size)
        sprite_size = (round(crop.width * sprite_scale), round(crop.height * sprite_scale))
        sprite = crop.resize(sprite_size, Image.Resampling.LANCZOS)
        # Runtime registers the rightmost painted nose pixel to the authority
        # plane. The body trails left, so visible nose contact and judging agree.
        sheet.alpha_composite(sprite,
                              (ring_center[0] - sprite.width, ring_center[1] - sprite.height // 2))
        draw.line((ring_center[0], top + 32, ring_center[0], top + 260),
                  fill=(111, 236, 255, 220), width=2)
        collision_radius = round(16 * size / 80)
        draw.ellipse((ring_center[0] - collision_radius, ring_center[1] - collision_radius,
                      ring_center[0] + collision_radius, ring_center[1] + collision_radius),
                     outline=(111, 236, 255, 220), width=2)
        draw.text((left + 24, top + 286), label, font=font(18, True), fill=(241, 245, 255, 255))
        draw.text((left + 24, top + 320), "white: gate · cyan: authority plane", font=font(15), fill=(166, 194, 234, 255))

    ship_box = ship.getchannel("A").getbbox()
    if ship_box is None:
        raise ValueError("contact-sheet ship is empty")
    crop = ship.crop(ship_box)
    plate_colors = [
        ((246, 248, 252, 255), (18, 25, 42, 255), "LIGHT PLATE"),
        ((2, 5, 14, 255), (239, 245, 255, 255), "DARK PLATE"),
        ((101, 24, 190, 255), (255, 255, 255, 255), "SATURATED PLATE"),
    ]
    for index, (background, foreground, label) in enumerate(plate_colors):
        left = 48 + index * 350
        top = 544
        draw.rounded_rectangle((left, top, left + 284, top + 168), radius=20,
                               fill=background, outline=(83, 111, 174, 255), width=2)
        sprite_scale = 170 / crop.width
        sprite_size = (170, round(crop.height * sprite_scale))
        sprite = crop.resize(sprite_size, Image.Resampling.LANCZOS)
        sheet.alpha_composite(sprite, (left + 57, top + 38))
        draw.text((left + 18, top + 16), label, font=font(14, True), fill=foreground)
        draw.text((left + 18, top + 142), "transparent edge check", font=font(13), fill=foreground)
    sheet.convert("RGB").save(CONTACT_SHEET, format="PNG", optimize=True)


if __name__ == "__main__":
    runtime = build_runtime()
    make_contact_sheet(runtime)
    print(f"built {DOCS_ASSET.relative_to(ROOT)}")
    print(f"mirror_sha256={sha256(DOCS_ASSET)}")
    print(f"review={CONTACT_SHEET.relative_to(ROOT)}")
