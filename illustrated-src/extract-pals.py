#!/usr/bin/env python3
"""Cut the painted pal sheet and drop the hot-pink backdrop.

raw-sheet.jpg cells are ~75% RGB(213,11,117). That pink is the sheet
backdrop, not space art. Key it out, keep the character, center on a
transparent 256px square.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SHEET = Path("/workspace/assets/sprites/pals/raw-sheet.jpg")
OUTS = [
    Path("/workspace/public/art/cutouts"),
    Path("/workspace/public/art/mates"),
    Path("/workspace/public/art/pals"),
    Path("/workspace/public/art/thumbs/pals"),
]
SIZE = 256
PINK = np.array([213.0, 11.0, 117.0])

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


def knock_pink(rgb: np.ndarray) -> np.ndarray:
    """Return alpha 0-255. Hot-pink sheet backdrop goes to 0."""
    pix = rgb.astype(np.float32)
    dist = np.linalg.norm(pix - PINK, axis=2)
    # also treat near-magenta with very low green as backdrop
    g = pix[:, :, 1]
    r = pix[:, :, 0]
    b = pix[:, :, 2]
    magenta = (r > 170) & (g < 45) & (b > 70) & (b < 170)
    alpha = np.clip((dist - 28.0) * (255.0 / 36.0), 0, 255)
    alpha[magenta & (dist < 80)] = np.minimum(alpha[magenta & (dist < 80)], 0)
    # hard kill obvious backdrop
    alpha[dist < 42] = 0
    return alpha.astype(np.uint8)


def drop_specks(alpha: np.ndarray, min_area: int = 80) -> np.ndarray:
    """Clear tiny leftover islands (stars / jpeg crumbs)."""
    h, w = alpha.shape
    solid = alpha > 20
    seen = np.zeros_like(solid)
    out = alpha.copy()
    for y in range(h):
        for x in range(w):
            if not solid[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            blob: list[tuple[int, int]] = []
            while stack:
                cy, cx = stack.pop()
                blob.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if len(blob) < min_area:
                for by, bx in blob:
                    out[by, bx] = 0
    return out


def trim_center(rgba: np.ndarray, size: int) -> Image.Image:
    a = rgba[:, :, 3]
    ys, xs = np.where(a > 18)
    if len(xs) == 0:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = 8
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(rgba.shape[1], int(xs.max()) + 1 + pad)
    y1 = min(rgba.shape[0], int(ys.max()) + 1 + pad)
    crop = rgba[y0:y1, x0:x1]
    ch, cw = crop.shape[:2]
    side = max(cw, ch)
    square = np.zeros((side, side, 4), dtype=np.uint8)
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square[oy : oy + ch, ox : ox + cw] = crop
    img = Image.fromarray(square, "RGBA")
    inner = int(size * 0.9)
    fitted = img.resize((inner, inner), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    off = (size - inner) // 2
    out.paste(fitted, (off, off), fitted)
    return out


def main() -> None:
    sheet = Image.open(SHEET).convert("RGB")
    assert sheet.size == (1200, 1600), sheet.size
    arr = np.array(sheet)
    for dest in OUTS:
        dest.mkdir(parents=True, exist_ok=True)
    for (row, col), name in CELLS.items():
        cell = arr[row * 400 : (row + 1) * 400, col * 400 : (col + 1) * 400]
        alpha = drop_specks(knock_pink(cell))
        rgba = np.dstack([cell, alpha])
        img = trim_center(rgba, SIZE)
        for dest in OUTS:
            img.save(dest / f"{name}.png", "PNG")
        a = np.array(img)[:, :, 3]
        rgb = np.array(img)[:, :, :3].astype(np.float32)
        dist = np.linalg.norm(rgb - PINK, axis=2)
        leftover = int(((a > 16) & (dist < 42)).sum())
        print(f"{name:12} solid={int((a > 16).sum()):5d} leftover_pink={leftover}")


if __name__ == "__main__":
    main()
