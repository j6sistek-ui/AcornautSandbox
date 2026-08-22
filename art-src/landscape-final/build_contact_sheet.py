"""Build the final landscape asset evidence contact sheet."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "art-src" / "landscape-final"
CAPTURES = EVIDENCE / "captures"
OUT = EVIDENCE / "acornaut-landscape-final-contact-sheet.png"

BG = "#070b16"
PANEL = "#10182c"
BORDER = "#2a3454"
INK = "#f3efe4"
MUTED = "#9aa6c4"
GOLD = "#e8a44a"
BLUE = "#a99be8"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf")
    try:
        return ImageFont.truetype(str(path), size=size)
    except OSError:
        return ImageFont.load_default()


F_TITLE = font(48, True)
F_SECTION = font(34, True)
F_LABEL = font(23, True)
F_BODY = font(20)
F_SMALL = font(17)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.contain(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)


def normalized_capture(path: Path, target: tuple[int, int]) -> Image.Image:
    """Remove known browser backing-surface padding and restore CSS size."""
    with Image.open(path) as source:
        image = source.convert("RGB")
    # The in-app capture surface renders at 0.65 of requested CSS geometry
    # and pads the remaining PNG with the page background. In-page geometry
    # was separately measured at the exact requested CSS viewport.
    width = min(image.width, round(target[0] * 0.65))
    height = min(image.height, round(target[1] * 0.65))
    return image.crop((0, 0, width, height)).resize(target, Image.Resampling.LANCZOS)


def panel(
    sheet: Image.Image,
    xy: tuple[int, int],
    size: tuple[int, int],
    label: str,
    image: Image.Image,
    *,
    mode: str = "contain",
    accent: str = GOLD,
) -> None:
    x, y = xy
    width, height = size
    draw = ImageDraw.Draw(sheet)
    draw.rounded_rectangle((x, y, x + width, y + height), 18, fill=PANEL, outline=BORDER, width=2)
    draw.text((x + 18, y + 13), label, font=F_LABEL, fill=accent)
    image_box = (width - 24, height - 62)
    rendered = cover(image, image_box) if mode == "cover" else contain(image, image_box)
    px = x + (width - rendered.width) // 2
    py = y + 52 + (height - 58 - rendered.height) // 2
    sheet.paste(rendered, (px, py))


def note_panel(
    sheet: Image.Image,
    xy: tuple[int, int],
    size: tuple[int, int],
    lines: list[tuple[str, str]],
) -> None:
    x, y = xy
    width, height = size
    draw = ImageDraw.Draw(sheet)
    draw.rounded_rectangle((x, y, x + width, y + height), 18, fill="#0c1224", outline=BORDER, width=2)
    draw.text((x + 24, y + 20), "EVIDENCE NOTES", font=F_LABEL, fill=BLUE)
    cursor = y + 72
    for head, body in lines:
        draw.text((x + 24, cursor), head, font=F_LABEL, fill=INK)
        cursor += 34
        for line in body.split("\n"):
            draw.text((x + 24, cursor), line, font=F_SMALL, fill=MUTED)
            cursor += 27
        cursor += 18


def section(
    sheet: Image.Image,
    top: int,
    title: str,
    source_path: Path,
    wide_path: Path,
    capture_844_path: Path,
    capture_1440_path: Path,
    notes: list[tuple[str, str]],
) -> None:
    draw = ImageDraw.Draw(sheet)
    draw.text((50, top), title, font=F_SECTION, fill=INK)
    draw.line((50, top + 52, 3150, top + 52), fill=BORDER, width=2)

    with Image.open(source_path) as source_img, Image.open(wide_path) as wide_img:
        source = source_img.convert("RGB")
        wide = wide_img.convert("RGB")

    crop_844 = cover(wide, (844, 390))
    crop_1440 = cover(wide, (1440, 900))
    capture_844 = normalized_capture(capture_844_path, (844, 390))
    capture_1440 = normalized_capture(capture_1440_path, (1440, 900))

    row = top + 78
    panel(sheet, (50, row), (480, 520), "PORTRAIT SOURCE · UNCHANGED", source, accent=MUTED)
    panel(sheet, (550, row), (850, 520), "FULL WIDE · 1920 × 1080", wide)
    panel(sheet, (1420, row), (800, 420), "844 × 390 COVER CROP", crop_844, mode="cover", accent=BLUE)
    panel(sheet, (2240, row), (910, 520), "1440 × 900 COVER CROP", crop_1440, mode="cover", accent=BLUE)

    second = top + 625
    panel(sheet, (50, second), (1280, 610), "ACTUAL GAME · 844 × 390", capture_844, mode="cover")
    panel(sheet, (1350, second), (1120, 760), "ACTUAL GAME · 1440 × 900", capture_1440, mode="cover")
    note_panel(sheet, (2490, second), (660, 760), notes)


def main() -> None:
    sheet = Image.new("RGB", (3200, 3160), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((50, 34), "ACORNAUT · LANDSCAPE FINAL ASSET PASS", font=F_TITLE, fill=INK)
    draw.text(
        (52, 98),
        "Remaining scope only: menu-home-wide + sky-wide · portrait originals preserved · PR66 widescreen beta used for UI/game evidence",
        font=F_BODY,
        fill=MUTED,
    )

    section(
        sheet,
        150,
        "01 · MENU HOME WIDE",
        ROOT / "docs" / "art" / "menu-home.jpg",
        ROOT / "docs" / "art" / "menu-home-wide.jpg",
        CAPTURES / "menu-home-ui-844x390.png",
        CAPTURES / "menu-home-ui-1440x900.png",
        [
            ("Identity", "Rear-view launch pose, striped tail,\ngold hardware, ringed rust planet."),
            ("Control safety", "Dark top for title and counters.\nLower center holds stacked controls."),
            ("Live limitation", "PR66 deliberately keeps menu DOM in\na centered 500 px column; shown as-is."),
            ("Capture", "Exact CSS viewports measured in-page.\n0.65 backing surface normalized here."),
        ],
    )

    section(
        sheet,
        1640,
        "02 · FALLBACK SKY WIDE",
        ROOT / "docs" / "art" / "sky.jpg",
        ROOT / "docs" / "art" / "sky-wide.jpg",
        CAPTURES / "sky-game-844x390.png",
        CAPTURES / "sky-game-1440x900.png",
        [
            ("Identity", "Indigo void, magenta wisps, sparse\nplanets, gold/lilac lower nebula."),
            ("Flight lane", "Quiet middle keeps squirrel, debris,\npickups, HUD, and gates readable."),
            ("Actual game", "PR66 beta renderer, Deep flight, real\nsprites, HUD, wash, and scrim."),
            ("Capture", "Exact CSS viewports measured in-page.\n0.65 backing surface normalized here."),
        ],
    )

    draw.text(
        (50, 3108),
        "Review artifact only · Shipping tree contains JPEG companions, not this contact sheet.",
        font=F_SMALL,
        fill=MUTED,
    )
    sheet.save(OUT, format="PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} · {sheet.width}x{sheet.height}")


if __name__ == "__main__":
    main()
