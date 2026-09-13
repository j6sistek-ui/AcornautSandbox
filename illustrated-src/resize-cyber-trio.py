"""Reduce a keyed sprite without aliasing its fine painted details.

Input and output are PNG bytes on stdin/stdout. Pillow's RGBA resize filters
premultiplied colors and alpha together, avoiding colored transparent edges.
No sharpening, palette adjustment, cropping or pose changes are applied.
"""
import io
import sys
from PIL import Image

size = int(sys.argv[1])
if not 1 <= size <= 3072:
    raise ValueError("sprite sampling size must be between 1 and 3072")
with Image.open(io.BytesIO(sys.stdin.buffer.read())) as source:
    source.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS).save(
        sys.stdout.buffer, format="PNG"
    )
