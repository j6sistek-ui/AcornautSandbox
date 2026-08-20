#!/usr/bin/env python3
"""Repair verified sprite-edge defects without repainting the artwork.

Usage:

    python3 illustrated-src/clean-raster-edges.py apply docs/art
    python3 illustrated-src/clean-raster-edges.py audit docs/art

The old cutout pass left two different faults behind. A handful of sprites
have an opaque navy backing plate connected to the transparent exterior;
five others have a binary, stair-stepped alpha edge. The repair is purposely
narrow:

* matte colours are listed per reviewed file and are removed only when they
  can be flood-reached from the canvas edge;
* removal is capped to a small perimeter depth, so a similarly coloured
  interior facet cannot disappear;
* only the alpha edge is supersampled; RGB comes from the nearest retained
  interior pixel, which prevents a dark or cream fringe during scaling;
* two companion sprites lose tiny, distant sheet scraps while nearby sparks
  and other deliberate detached details remain.

This script is not a general background remover. New art should arrive with
transparency and should not be added to MATTE_PROFILES without a light/dark
contact-sheet review.
"""
import os
import sys

import numpy as np

try:
    from PIL import Image
    from scipy import ndimage
except ImportError:  # pragma: no cover
    sys.exit("needs pillow and scipy: pip install pillow scipy")


# relative path: (reviewed matte RGB, Euclidean tolerance, maximum depth)
MATTE_PROFILES = {
    "planets/28.png": ((12, 35, 92), 34.0, 8),
    "planets/30.png": ((28, 34, 86), 34.0, 8),
    "planets/31.png": ((12, 45, 86), 34.0, 8),
    "debris/9.png": ((44, 28, 94), 38.0, 10),
    "debris/11.png": ((22, 43, 77), 36.0, 16),
    "debris/13.png": ((12, 29, 78), 36.0, 14),
    "debris/16.png": ((8, 22, 66), 34.0, 10),
    "debris/19.png": ((28, 52, 82), 40.0, 10),
}

# A repaired edge can still contain a small number of interior pixels close
# to the reviewed matte colour. They are not exterior backing, and following
# them inward on a second run would slowly erode the painting. These limits
# sit above the accepted post-repair counts and far below the original matte
# plates, making `apply` safely repeatable while letting `audit` catch a
# reverted or partially repaired file.
CLEANED_MATTE_MAX = {
    "planets/28.png": 500,
    "planets/30.png": 400,
    "planets/31.png": 800,
    "debris/9.png": 600,
    "debris/11.png": 100,
    "debris/13.png": 400,
    "debris/16.png": 200,
    "debris/19.png": 250,
}

# These files have binary (or effectively binary) alpha and shimmer when
# scaled. Their colour and silhouette remain unchanged; only a sub-pixel
# alpha ramp is rebuilt.
HARD_EDGE = {
    "planets/4.png",
    "planets/7.png",
    "planets/19.png",
    "planets/22.png",
    "planets/32.png",
    "debris/23.png",
}

# These are otherwise clean, but a tiny foreign component at the bottom of
# the original sheet expands measureSprite's box and shrinks the pal in game.
STRAY_COMPONENTS = {
    "solo/cometsprite.png",
    "solo/pocketmoon.png",
}


def load(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


def save(a, path):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA").save(path)


def exterior_matte(a, ref, tolerance, max_depth):
    """Return exterior-connected pixels close to one reviewed matte colour."""
    alpha = a[:, :, 3]
    ink = alpha > 8
    rgb = a[:, :, :3].astype(np.float32)
    refv = np.asarray(ref, dtype=np.float32)
    match = np.sqrt(((rgb - refv) ** 2).sum(2)) <= tolerance
    passable = ~ink | match
    seed = np.zeros_like(ink)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    reached = ndimage.binary_propagation(seed & passable, mask=passable)
    depth = ndimage.distance_transform_edt(ink)
    return reached & match & ink & (depth <= max_depth)


def supersampled_alpha(alpha):
    """Rebuild a one-pixel antialias ramp around the existing silhouette."""
    mask = alpha >= 128
    h, w = mask.shape
    hi = Image.fromarray((mask * 255).astype(np.uint8), "L").resize(
        (w * 4, h * 4), Image.Resampling.NEAREST
    )
    smooth = ndimage.gaussian_filter(np.asarray(hi).astype(np.float32) / 255.0, 0.65)
    down = Image.fromarray(np.clip(smooth * 255, 0, 255).astype(np.uint8), "L").resize(
        (w, h), Image.Resampling.LANCZOS
    )
    return np.asarray(down)


def edge_rgb_from_interior(a, alpha):
    """Give translucent pixels real object colour instead of matte colour."""
    core = alpha >= 192
    if not core.any():
        return
    _, indices = ndimage.distance_transform_edt(~core, return_indices=True)
    nearest = a[:, :, :3][indices[0], indices[1]]
    edge = (alpha > 0) & (alpha < 250)
    a[:, :, :3][edge] = nearest[edge]


def drop_distant_scraps(a):
    ink = a[:, :, 3] > 12
    labels, count = ndimage.label(ink)
    if count <= 1:
        return 0
    sizes = ndimage.sum(ink, labels, range(1, count + 1))
    main = int(np.argmax(sizes)) + 1
    near = ndimage.binary_dilation(labels == main, iterations=16)
    remove = np.zeros_like(ink)
    for i in range(1, count + 1):
        if i == main:
            continue
        blob = labels == i
        # Keep meaningful satellites and every small detail near the art.
        if sizes[i - 1] >= sizes[main - 1] * 0.02 or (blob & near).any():
            continue
        remove |= blob
    a[:, :, 3][remove] = 0
    a[:, :, :3][remove] = 0
    return int(remove.sum())


def repair(root, rel):
    path = os.path.join(root, rel)
    a = load(path)
    removed = 0
    if rel in MATTE_PROFILES:
        bad = exterior_matte(a, *MATTE_PROFILES[rel])
        # Already at the reviewed clean state: do not chase similarly
        # coloured interior facets inward on repeated runs.
        if int(bad.sum()) <= CLEANED_MATTE_MAX[rel]:
            return 0, 0
        removed = int(bad.sum())
        a[:, :, 3][bad] = 0
        a[:, :, :3][bad] = 0
    scraps = drop_distant_scraps(a) if rel in STRAY_COMPONENTS else 0
    if rel in MATTE_PROFILES or rel in HARD_EDGE:
        alpha = supersampled_alpha(a[:, :, 3])
        edge_rgb_from_interior(a, alpha)
        a[:, :, 3] = alpha
    save(a, path)
    return removed, scraps


def edge_stats(path):
    alpha = load(path)[:, :, 3]
    ink = int((alpha > 0).sum())
    soft = int(((alpha > 0) & (alpha < 255)).sum())
    return ink, soft


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("apply", "audit"):
        sys.exit(__doc__)
    mode, root = sys.argv[1], sys.argv[2]
    targets = sorted(set(MATTE_PROFILES) | HARD_EDGE | STRAY_COMPONENTS)
    missing = [rel for rel in targets if not os.path.exists(os.path.join(root, rel))]
    if missing:
        sys.exit("missing visual assets: " + ", ".join(missing))
    for rel in targets:
        if mode == "apply":
            removed, scraps = repair(root, rel)
        else:
            removed = scraps = 0
        ink, soft = edge_stats(os.path.join(root, rel))
        note = []
        if removed:
            note.append("%d matte" % removed)
        if scraps:
            note.append("%d stray" % scraps)
        print("  %-25s %6d ink  %5d soft%s" % (
            rel, ink, soft, ("  " + ", ".join(note)) if note else ""
        ))
        if mode == "audit" and rel in HARD_EDGE and soft < 40:
            sys.exit("hard alpha edge remains in " + rel)
        if mode == "audit" and rel in MATTE_PROFILES:
            a = load(os.path.join(root, rel))
            remaining = int(exterior_matte(a, *MATTE_PROFILES[rel]).sum())
            if remaining > CLEANED_MATTE_MAX[rel]:
                sys.exit("exterior matte remains in %s (%d candidate pixels)" %
                         (rel, remaining))


if __name__ == "__main__":
    main()
