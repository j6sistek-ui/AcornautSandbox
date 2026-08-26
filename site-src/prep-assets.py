#!/usr/bin/env python3
"""Derive the landing page's web-sized art from the game's own asset folder.

Everything the page shows is generated here so the choices are visible and the
whole set can be rebuilt from docs/art/ at any time. Run this before build.py.

    python3 site-src/prep-assets.py [--out DIR]

Screenshots and gameplay captures are NOT produced here - they come from
capture.py / capture-race.py, which drive the real game in a headless browser.
"""
import argparse, os, re, sys, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "docs", "art")

# The suit flown by the playable strip. Its 16-frame tap bank IS the animation
# a stranger sees first, so it has to be one whose bank is finished - Flight is
# the standard the others are measured against (see art-src/motion-banks/).
TOY_SUIT = "flight"

# Planet renders used as the toy's gates and its background drift.
TOY_PLANETS = (3, 7, 12, 18, 24, 29)

# Helmets shown beside the wardrobe. A sample, not the whole shelf.
HELMS = ("seraph", "cryostar", "eclipse", "comet", "nebula", "aurora", "cosmic", "leviathan")

KEY_ART = (
    # source,                dest,            width, quality
    ("menu-splash-wide.jpg", "bg-wide.jpg",   1500,  68),   # hero ground
    ("menu-hub.jpg",         "bg-tall.jpg",    760,  70),   # hero ground, portrait
    ("chart-bg.jpg",         "bg-chart.jpg",  1200,  64),   # star chart band
)


def suit_ids():
    """Every suit in the catalogue, in catalogue order, with its accent hue."""
    src = open(os.path.join(ROOT, "illustrated-src", "game", "catalog.ts"), encoding="utf-8").read()
    m = re.search(r"export const SUITS: Suit\[\] =\s*\[", src)
    i = m.end(); depth = 1; j = i
    while depth and j < len(src):
        if src[j] == "[": depth += 1
        elif src[j] == "]": depth -= 1
        j += 1
    out = []
    for blk in re.finditer(r"\{[^{}]*\}", src[i:j - 1]):
        b = blk.group(0)
        sid = re.search(r'id:\s*"([^"]+)"', b)
        if not sid: continue
        name = re.search(r'name:\s*"([^"]+)"', b)
        glow = re.search(r'glow:\s*"([^"]+)"', b)
        out.append({"id": sid.group(1),
                    "name": name.group(1) if name else sid.group(1),
                    "glow": glow.group(1) if glow else "#c9b6ff"})
    return out


def webp(src, dst, size, q=80):
    Image.open(src).convert("RGBA").resize(size, Image.LANCZOS).save(dst, "WEBP", quality=q, method=6)
    return os.path.getsize(dst)


def jpg(src, dst, width, q):
    im = Image.open(src).convert("RGB")
    h = round(im.height * width / im.width)
    im.resize((width, h), Image.LANCZOS).save(dst, "JPEG", quality=q, optimize=True, progressive=True)
    return os.path.getsize(dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "site-src", "assets"))
    args = ap.parse_args()
    out = args.out
    os.makedirs(out, exist_ok=True)
    total = 0

    suits = suit_ids()
    for s in suits:
        p = os.path.join(ART, "suits", s["id"] + ".png")
        if not os.path.exists(p):
            print("  ! no render for", s["id"]); continue
        total += webp(p, os.path.join(out, "s-%s.webp" % s["id"]), (176, 176), 82)
    print("suits      %2d" % len(suits))

    for i in range(1, 17):
        p = os.path.join(ART, "suits", "%s-tap-%d.png" % (TOY_SUIT, i))
        if not os.path.exists(p):
            sys.exit("MISSING TOY FRAME: " + p)
        total += webp(p, os.path.join(out, "flap-%d.webp" % i), (200, 200), 78)
    print("flap bank  16  (%s)" % TOY_SUIT)

    for i in TOY_PLANETS:
        total += webp(os.path.join(ART, "planets", "%d.png" % i),
                      os.path.join(out, "p-%d.webp" % i), (220, 220), 80)
    print("planets    %2d" % len(TOY_PLANETS))

    n = 0
    for h in HELMS:
        p = os.path.join(ART, "helms", h + ".png")
        if not os.path.exists(p): continue
        total += webp(p, os.path.join(out, "h-%s.webp" % h), (140, 140), 80); n += 1
    print("helms      %2d" % n)

    for src, dst, w, q in KEY_ART:
        total += jpg(os.path.join(ART, src), os.path.join(out, dst), w, q)
    print("key art    %2d" % len(KEY_ART))

    # the film poster: the portrait splash, cropped to the clips' 9:16
    im = Image.open(os.path.join(ART, "menu-splash.jpg")).convert("RGB")
    tgt = 720 / 1270
    w, h = im.size
    if w / h > tgt:
        nw = int(h * tgt); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / tgt); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im.resize((720, 1270), Image.LANCZOS).save(os.path.join(out, "poster.jpg"),
                                               "JPEG", quality=70, optimize=True, progressive=True)
    total += os.path.getsize(os.path.join(out, "poster.jpg"))

    json.dump(suits, open(os.path.join(out, "suits.json"), "w"), indent=1)
    print("-> %s  (%.0f KB)" % (out, total / 1024))


if __name__ == "__main__":
    main()
