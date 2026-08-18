#!/usr/bin/env python3
"""Cut the ORIGINAL imagine pal portraits (raw-sheet.jpg) into named files.

raw-sheet.jpg is the 3x4 painted companion sheet (one character per 400px cell).
raw-sheet.png is a later generate2dsprite pass — overlapping frames, do not use.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

SHEET = Path("/workspace/assets/sprites/pals/raw-sheet.jpg")
OUTS = [
    Path("/workspace/public/art/mates"),
    Path("/workspace/public/art/pals"),
    Path("/workspace/public/art/thumbs/pals"),
]
SIZE = 256

# row-major, 3 columns — visual identity of each painted cell on the jpg.
CELLS = {
    (0, 0): "rocket",
    (0, 1): "tinbot",
    (0, 2): "ufo",
    (1, 0): "meteorcore",
    (1, 1): "starpup",
    (1, 2): "nutsack",
    (2, 0): "pocketmoon",
    (2, 1): "bee",
    (2, 2): "cometsprite",
    (3, 0): "voidjelly",
    (3, 1): "buddy",
    (3, 2): "wisp",
}


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    assert sheet.size == (1200, 1600), sheet.size
    for dest_dir in OUTS:
        dest_dir.mkdir(parents=True, exist_ok=True)
    contact = Image.new("RGBA", (SIZE * 3 + 16, SIZE * 4 + 16), (8, 12, 24, 255))
    for (row, col), name in CELLS.items():
        cell = sheet.crop((col * 400, row * 400, col * 400 + 400, row * 400 + 400))
        img = cell.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        for dest_dir in OUTS:
            img.save(dest_dir / f"{name}.png", "PNG")
        contact.paste(img, (col * SIZE + 8, row * SIZE + 8))
        print(f"{name:12} {img.size}")
    qa = Path("/workspace/screenshots/pal-source-contact.png")
    contact.save(qa, "PNG")
    print("qa", qa)


if __name__ == "__main__":
    main()
