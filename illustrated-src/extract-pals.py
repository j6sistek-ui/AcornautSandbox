#!/usr/bin/env python3
"""Cut the original imagine pal sheet into full cells and name them by identity.

The sheet is 1200x1600 = 3 cols x 4 rows of 400px painted companions.
Earlier pipeline used largest-component crop and produced partial fragments.
This keeps the WHOLE cell, knocks out only the painted space backdrop, then
pads the full character into a 256px square.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SHEET = Path("/workspace/assets/sprites/pals/raw-sheet.png")
OUT = Path("/workspace/public/art/pals")
THUMBS = Path("/workspace/public/art/thumbs/pals")
SIZE = 256

# row-major, 3 columns. Visual identity of each painted cell.
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


def knock_space(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3].astype(np.float32)
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    # Painted space: dark, low-sat. Stars are bright specks.
    is_space = (lum < 58) & (sat < 95)
    vis = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or vis[y, x] or not is_space[y, x]:
            continue
        vis[y, x] = True
        q.append((y - 1, x))
        q.append((y + 1, x))
        q.append((y, x - 1))
        q.append((y, x + 1))

    # Isolated star specks: bright, small, touching removed space.
    alpha = arr[:, :, 3].astype(np.float32)
    alpha[vis] = 0
    gone = vis
    for _ in range(2):
        # peel tiny bright islands whose neighbors are mostly gone
        neigh = np.zeros_like(gone)
        neigh[1:] |= gone[:-1]
        neigh[:-1] |= gone[1:]
        neigh[:, 1:] |= gone[:, :-1]
        neigh[:, :-1] |= gone[:, 1:]
        speck = (~gone) & neigh & (lum > 80) & (sat < 40)
        # only kill if the blob is small — handled coarsely by requiring low sat
        gone |= speck
        alpha[speck] = 0

    # Soft edge: fade pixels that sit next to knocked-out space.
    border = np.zeros_like(gone)
    border[1:] |= gone[:-1]
    border[:-1] |= gone[1:]
    border[:, 1:] |= gone[:, :-1]
    border[:, :-1] |= gone[:, 1:]
    fade = border & (~gone)
    alpha[fade] *= 0.35

    arr[:, :, 3] = alpha
    return arr


def trim_and_pad(img: Image.Image, size: int) -> Image.Image:
    arr = np.array(img)
    a = arr[:, :, 3]
    ys, xs = np.where(a > 18)
    if len(xs) == 0:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = 6
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(arr.shape[1], int(xs.max()) + 1 + pad)
    y1 = min(arr.shape[0], int(ys.max()) + 1 + pad)
    crop = img.crop((x0, y0, x1, y1))
    side = max(crop.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2), crop)
    # character fills most of the frame
    inner = int(size * 0.9)
    fitted = square.resize((inner, inner), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    off = (size - inner) // 2
    out.paste(fitted, (off, off), fitted)
    return out


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    assert sheet.size == (1200, 1600), sheet.size
    OUT.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)
    for (row, col), name in CELLS.items():
        cell = sheet.crop((col * 400, row * 400, col * 400 + 400, row * 400 + 400))
        arr = knock_space(np.array(cell).astype(np.float32))
        arr = np.clip(arr, 0, 255).astype(np.uint8)
        img = trim_and_pad(Image.fromarray(arr, "RGBA"), SIZE)
        dest = OUT / f"{name}.png"
        img.save(dest, "PNG")
        img.save(THUMBS / f"{name}.png", "PNG")
        solid = int((np.array(img)[:, :, 3] > 16).sum())
        print(f"{name:12} {img.size} solid={solid}")


if __name__ == "__main__":
    main()
