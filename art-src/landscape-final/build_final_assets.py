"""Build the two approved landscape companion JPEGs from review masters.

The portrait shipping originals are inputs for visual comparison only and are
never opened for writing.  Outputs are copied byte-for-byte into both runtime
art mirrors.
"""

from __future__ import annotations

import hashlib
import io
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
MASTER_DIR = ROOT / "art-src" / "landscape-final" / "masters"
DOCS_ART = ROOT / "docs" / "art"
SANDBOX_ART = ROOT / "sandbox_assets" / "art"

SPECS = (
    ("menu-home-wide-master.png", "menu-home-wide.jpg", 300 * 1024),
    ("sky-wide-master.png", "sky-wide.jpg", 256 * 1024),
)


def crop_16_9(image: Image.Image) -> Image.Image:
    """Return a centered 16:9 crop without stretching."""
    width, height = image.size
    target_ratio = 16 / 9
    if width / height > target_ratio:
        crop_width = round(height * target_ratio)
        left = (width - crop_width) // 2
        return image.crop((left, 0, left + crop_width, height))
    crop_height = round(width / target_ratio)
    top = (height - crop_height) // 2
    return image.crop((0, top, width, top + crop_height))


def encode_under_budget(image: Image.Image, budget: int) -> tuple[bytes, int]:
    """Choose the highest JPEG quality from 70..95 that fits the budget."""
    best: tuple[bytes, int] | None = None
    for quality in range(70, 96):
        stream = io.BytesIO()
        image.save(
            stream,
            format="JPEG",
            quality=quality,
            subsampling=2,
            optimize=True,
            progressive=True,
        )
        payload = stream.getvalue()
        if len(payload) <= budget:
            best = (payload, quality)
    if best is None:
        raise RuntimeError(f"Could not meet {budget}-byte budget at quality 70")
    return best


def main() -> None:
    for master_name, output_name, budget in SPECS:
        with Image.open(MASTER_DIR / master_name) as source:
            final = crop_16_9(source.convert("RGB")).resize(
                (1920, 1080), Image.Resampling.LANCZOS
            )
        payload, quality = encode_under_budget(final, budget)
        docs_path = DOCS_ART / output_name
        sandbox_path = SANDBOX_ART / output_name
        docs_path.write_bytes(payload)
        sandbox_path.write_bytes(payload)
        digest = hashlib.sha256(payload).hexdigest()
        print(
            f"{output_name}: 1920x1080, {len(payload)} bytes, "
            f"quality={quality}, sha256={digest}"
        )


if __name__ == "__main__":
    main()
