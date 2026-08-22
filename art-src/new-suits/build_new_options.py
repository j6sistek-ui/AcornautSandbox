#!/usr/bin/env python3
"""Build the eight owner-supplied beta suit/helmet pairs.

The source sheets are kept untouched under ``masters``.  This build keys the
black plate at source resolution, makes one premultiplied downsample, and
mirrors the 256px runtime assets into both game trees.  Tail/body cuts and tap
banks are intentionally separate: neck-cut.py is non-idempotent and must run
only once against the measured socket/pivot table.
"""

from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
MASTERS = HERE / "masters"
DOC_SUITS = ROOT / "docs" / "art" / "suits"
DOC_HELMS = ROOT / "docs" / "art" / "helms"
SANDBOX_SUITS = ROOT / "sandbox_assets" / "art" / "suits"
SANDBOX_HELMS = ROOT / "sandbox_assets" / "art" / "helms"

IDS = (
    "cinderforge", "groveguard", "cosmic", "sunforged",
    "abyssal", "amethyst", "ivoryguard", "reactor",
)


def module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    out = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(out)
    return out


fit_suit = module("fit_suit", ROOT / "illustrated-src" / "fit-suit.py")


def strip_exterior_haze(path: Path, max_channel: int) -> None:
    """Remove only dark, edge-reachable spill from a reviewed keyed sprite."""
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    alpha = a[..., 3]
    passable = (alpha == 0) | (a[..., :3].max(axis=2) < max_channel)
    seed = np.zeros_like(passable)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    reached = ndimage.binary_propagation(seed & passable, mask=passable)
    remove = reached & (alpha > 0)
    a[remove] = 0
    Image.fromarray(a, "RGBA").save(path, optimize=True)


def master(suit_id: str, kind: str) -> Path:
    matches = list(MASTERS.glob(f"{suit_id}-{kind}.*"))
    if len(matches) != 1:
        raise RuntimeError(f"expected one master for {suit_id}-{kind}, found {matches}")
    return matches[0]


def build_one(suit_id: str) -> None:
    suit_out = DOC_SUITS / f"{suit_id}.png"
    helm_out = DOC_HELMS / f"{suit_id}.png"
    fit_suit.fit(str(master(suit_id, "suit")), str(suit_out))
    # Helmet sheets vary in framing. Crop each keyed object once at source
    # resolution, then give the complete shell/flora a consistent 230px box.
    fit_suit.fit(
        str(master(suit_id, "helm")), str(helm_out),
        target=230, centre=(128, 128),
    )
    # Reactor's source intentionally glows, but also carries a dark green
    # floor spill. This low threshold removes only the edge-reachable spill;
    # the bright rim, green aura, and enclosed visor remain untouched.
    if suit_id == "reactor":
        strip_exterior_haze(helm_out, 90)
    for src, dst_root in (
        (suit_out, SANDBOX_SUITS),
        (helm_out, SANDBOX_HELMS),
    ):
        dst_root.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst_root / src.name)


def main() -> None:
    for root in (DOC_SUITS, DOC_HELMS, SANDBOX_SUITS, SANDBOX_HELMS):
        root.mkdir(parents=True, exist_ok=True)
    for suit_id in IDS:
        build_one(suit_id)


if __name__ == "__main__":
    main()
