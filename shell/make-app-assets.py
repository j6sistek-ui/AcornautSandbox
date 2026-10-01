#!/usr/bin/env python3
"""THE STORE ICON AND SPLASH, cut from the master.

Capacitor ships a placeholder icon (a blue cross on a grid) and a white
launch screen, and Apple rejects both. The real art is the owner's
`art-src/app-icon-master.jpg`: a 1408px render of the squirrel in his
rocket, inside a gold ring, on a black plate. This script turns that one
master into every file the two shells read, so a new master is a re-run
rather than an afternoon in an image editor:

  iOS      AppIcon.appiconset/AppIcon-512@2x.png     1024x1024, no alpha
           Splash.imageset/splash-2732x2732{,-1,-2}.png
  Android  mipmap-*/ic_launcher{,_round,_foreground}.png (five densities)
           values/ic_launcher_background.xml           the adaptive backdrop
           drawable*/splash.png                        eleven orientations

The ring is rebuilt as a FRAME rather than copied. Apple and Android mask
the icon to their own corner shapes, and a ring that was already rounded
in the art gets clipped at the corners by a mask with a different radius.
So the master's ring is sampled as a colour profile and painted square to
the edge; whatever shape the OS cuts, the ring follows it.

Usage, from the repo root:  python3 shell/make-app-assets.py
Needs Pillow and numpy; no network. Re-run `npx cap sync` afterwards.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "art-src" / "app-icon-master.jpg"
IOS = ROOT / "shell/ios/App/App/Assets.xcassets"
RES = ROOT / "shell/android/app/src/main/res"
NAVY = (7, 11, 22)                 # #070b16, capacitor.config's backgroundColor
RING_FRAC = 0.030                  # ring thickness as a fraction of the side

master = np.array(Image.open(MASTER).convert("RGB")).astype(np.int32)
H, W, _ = master.shape
lum = master.sum(axis=2)

def first_last(v, thr=60):
    idx = np.where(v > thr)[0]
    return int(idx.min()), int(idx.max())

# the ring's outer box: first and last bright pixel on the centre row/column
x0, x1 = first_last(lum[H // 2])
y0, y1 = first_last(lum[:, W // 2])
# its inner edge: walk inward from the outer edge until the gold gives way to
# the navy for good (the ring has a dark hairline on its inside)
def ring_depth(strip):
    gold = [i for i, c in enumerate(strip) if c[0] > 150 and c[2] < 200]
    return max(gold) + 1 if gold else 0
depth = max(ring_depth(master[H // 2, x0:x0 + 80]), ring_depth(master[y0:y0 + 80, W // 2]))
# a few pixels past the last gold pixel is the hairline; past that, navy
inner = depth + 8
interior = master[y0 + inner:y1 - inner + 1, x0 + inner:x1 - inner + 1]

# the ring as a colour profile, averaged along the four straight runs
prof = np.zeros((inner, 3))
runs = [
    master[y0:y0 + inner, x0 + 320:x1 - 320],                       # top
    master[y1 - inner + 1:y1 + 1, x0 + 320:x1 - 320][::-1],         # bottom
    np.transpose(master[y0 + 320:y1 - 320, x0:x0 + inner], (1, 0, 2)),         # left
    np.transpose(master[y0 + 320:y1 - 320, x1 - inner + 1:x1 + 1], (1, 0, 2))[::-1],  # right
]
for r in runs:
    prof += r.reshape(inner, -1, 3).mean(axis=1)
prof /= len(runs)

def framed(side):
    """full-bleed square: the interior scaled in, the ring painted to the edge"""
    t = max(2, round(side * RING_FRAC))
    out = np.zeros((side, side, 3), dtype=np.float64)
    inner_img = Image.fromarray(interior.astype(np.uint8)).resize((side - 2 * t, side - 2 * t), Image.LANCZOS)
    out[t:side - t, t:side - t] = np.array(inner_img)
    # the profile, resampled to t pixels, laid by distance to the nearest edge
    xs = np.linspace(0, inner - 1, t)
    p = np.stack([np.interp(xs, np.arange(inner), prof[:, c]) for c in range(3)], axis=1)
    yy, xx = np.mgrid[0:side, 0:side]
    d = np.minimum(np.minimum(xx, yy), np.minimum(side - 1 - xx, side - 1 - yy))
    edge = d < t
    out[edge] = p[d[edge]]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

def rounded(img, radius_frac=0.2237):
    """the framed square with transparent corners, Apple's radius"""
    side = img.size[0]
    m = Image.new("L", (side * 4, side * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, side * 4 - 1, side * 4 - 1], radius=int(side * 4 * radius_frac), fill=255)
    m = m.resize((side, side), Image.LANCZOS)
    out = img.convert("RGBA")
    out.putalpha(m)
    return out

def circled(img):
    side = img.size[0]
    m = Image.new("L", (side * 4, side * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, side * 4 - 1, side * 4 - 1], fill=255)
    m = m.resize((side, side), Image.LANCZOS)
    out = img.convert("RGBA")
    out.putalpha(m)
    return out

def splash(w, h):
    """navy field, the rounded icon centred at two fifths of the short side"""
    bg = Image.new("RGBA", (w, h), NAVY + (255,))
    side = round(min(w, h) * 0.4)
    ic = rounded(framed(1024)).resize((side, side), Image.LANCZOS)
    bg.alpha_composite(ic, ((w - side) // 2, (h - side) // 2))
    return bg.convert("RGB")

written = []
def save(img, path, **kw):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, **kw)
    written.append(path.relative_to(ROOT))

# ---- iOS ----
icon1024 = framed(1024)
save(icon1024, IOS / "AppIcon.appiconset/AppIcon-512@2x.png")   # Contents.json names it; 1024x1024, RGB
sp = splash(2732, 2732)
for n in ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]:
    save(sp, IOS / "Splash.imageset" / n)

# ---- Android ----
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in DENS.items():
    legacy = round(48 * k)
    base = framed(legacy * 4)
    save(rounded(base).resize((legacy, legacy), Image.LANCZOS), RES / f"mipmap-{name}/ic_launcher.png")
    save(circled(base).resize((legacy, legacy), Image.LANCZOS), RES / f"mipmap-{name}/ic_launcher_round.png")
    # the adaptive foreground: 108dp canvas, the launcher shows the middle
    # 72dp. The interior (no ring: the launcher's own mask is the edge) is
    # scaled to 90dp so the tail and the rocket both clear the visible window.
    fg_side = round(108 * k)
    fg = Image.new("RGBA", (fg_side, fg_side), (0, 0, 0, 0))
    art = round(90 * k)
    fg.alpha_composite(Image.fromarray(interior.astype(np.uint8)).resize((art, art), Image.LANCZOS).convert("RGBA"), ((fg_side - art) // 2, (fg_side - art) // 2))
    save(fg, RES / f"mipmap-{name}/ic_launcher_foreground.png")
(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>' % NAVY)
written.append(Path("shell/android/app/src/main/res/values/ic_launcher_background.xml"))
SPLASH = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
for name, (w, h) in SPLASH.items():
    save(splash(w, h), RES / f"drawable-port-{name}/splash.png")
    save(splash(h, w), RES / f"drawable-land-{name}/splash.png")
save(splash(480, 320), RES / "drawable/splash.png")

print(f"master {W}x{H}: ring box ({x0},{y0})-({x1},{y1}), ring {inner}px; wrote {len(written)} files")
for p in written: print("  " + str(p))
