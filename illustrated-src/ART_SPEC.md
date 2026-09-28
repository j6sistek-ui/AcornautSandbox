# Acornaut art spec — heads and helmets

## Animated helmet fitting (28 September 2026)

The current roster has 34 characters: 21 accept wearable helmets and 13
retain their integrated appearance. There are 30 helmets and 570 valid
pairings (27 general helmets on 21 suits, plus Leviathan, Groveguard and
Sunforged on their matching suit only).
Their static portraits and bare-headed motion banks use per-painting `DOME`
positions, radii and optional local rotations. Fit the ears, muzzle and
collar in each pose; a uniform head-to-body ratio is not a substitute for
that review. Flight's current suit banks are bare-headed too. Only the
eight original `art/squirrel` idle/flap paintings retain baked Clear domes.

See [the complete fitting review](design/helmet-fit-all/REVIEW.md), its
catalog inventory and contact sheets for every valid pairing. The game and
Flight Studio share `game/helmet-fit.ts`; the fitting bench reads the same
head cavities. `/lab/helmet-fit/` is the read-only moving comparison page.
The [7 September review](design/helmet-fit/REVIEW.md) remains historical evidence.

## Arcflash parts atlas (owner request, 6 September 2026)

Arcflash is an explicitly requested new `ownHead` suit: orange squirrel fur,
unhelmeted blue eyes, dark carbon armor, navy collar and blue chest reactor.
The provided still and video authorize separated parts with procedural motion.
Its head cannot accept a separate helmet. This exception is scoped to Arcflash.

`art-src/arcflash/parts-master.png` is the generated source atlas and
`reference.jpg` is the supplied design reference. `PROMPT.md` records the
built-in ImageGen prompt. `export-arcflash.mjs` mechanically removes the green
production matte, retains fur antialiasing, packs twelve 256px cells into
`docs/art/suits/arcflash/parts.png` (1024×768 RGBA), and exports measured joint
anchors. Eleven cells animate; the assembled reference cell never renders.
All bone transforms use uniform, constant scale. The tail deforms as one
volume with a positive triangle-area guard. No checkerboard, green backing,
or baked trail ships on the character.

`archive/review-arcflash.mjs` renders `body.png` from that same rig at identical padded
registration, so the loading fallback preserves its scale and location. The
renderer supplies blue wrist jets and the persistent boot wake separately.
The review scripts include game-size renders and the 100/180/300ms tap cases;
see `design/arcflash/REVIEW.md` for reproduction and known limits.

Every general helmet must fit every helmet-wearing suit. Suit-exclusive
helmets retain their catalog restrictions. Current Flight suit banks are
bare-headed; the original `squirrel/idle-*` and `flap-*` fallback images
alone retain their baked Clear dome.

The **rig editor** (`docs/lab/rig/`, reachable from Help) is the bench for
setting these two tables by hand. It draws every pairing the way the game
does and hands the numbers back as text.

## The contract

A suit sprite carries a **head circle**. A helmet sprite carries a **head
cavity** independent of the glass mask, shell, crown or decorative halo.
At draw time the helmet is uniformly scaled to the head circle:

```
scale = headRadius / helmetSeatRadius
```

`draw.ts` stores suit and per-frame head circles in `DOME`.
`helmet-fit.ts` stores each helmet's `[x,y,r,angle?]` in `HELMET_SEATS`.
`HELM_GLASS` in `draw.ts` controls transparency only. Never change a glass
mask to resize a helmet: that also changes the painted visor. The cavity
centre maps to the head centre; local frame and helmet rotations are added.
Head radii stay constant within each motion bank. Uniform scaling preserves
the helmet's proportions and decorations.

Measure the actual skull, ears and muzzle, then review the composites.
Automatic circles are diagnostics, not a substitute for visual fitting:

- The blob of warm fur around a face includes ears, muzzle and neck, and
  those move with the pose. `sqrt(area / pi)` over that blob swings by a
  third across heads that are the same size.
- Colour tests find no head at all on **alien** (green), **ghost** and
  **frost** (white) or **robo** (chrome), and on several suits a belly of
  warm fur outscores the face.
- A helmet's visible visor, outer shell and wearable cavity are different.
  A crown or flower must not enlarge the wearer's head. Seat shaped helmets
  against multiple heads, including small Robo and large Eclipse poses.

## How it flies

Fitting is this file. **Motion is `MOTION_SPEC.md`**, and a new model has to
meet both: Flight's velocity-indexed pose bank is the standard, eight drawn
frames, head radius held constant across all of them.

## What to render for a new model

- **1408 × 1408**, character centred, plain flat background.
- **Transparent background if you can get it.** It beats any cut, and
  `key-render.py` notices and skips keying entirely.
- **A PALE character needs a BLACK plate, not cream.** Ghost is painted
  within 12 of the cream out of 765 — no code recovers that, because the
  information is not in the file. This is the one input problem no tool
  fixes, and it cost a whole re-render to learn.
- **No cast shadow and no ground plane.** They survive keying as a grey
  smear under the feet or a white ellipse under a helmet, and separating a
  shadow that touches the figure is genuinely hard.
- **Suits ship bare-headed.** No dome, no halo, no horns, no ears. Anything
  the art wears on its head shows through every other helmet the player puts
  on, and nothing in code can cover a halo — it sits outside any helmet's
  footprint. Seraph shipped with one baked in and wore two whenever the
  player picked the Seraph helmet; `cut-seraph-halo.py` is the repair, and
  it is far more work than re-rendering the suit would have been.
- **No ground plane, and no contact shadow either.** Phoenix kept the cream
  backing paper as a slab between its legs and a grey smear under each foot,
  because a shape enclosed by the figure is indistinguishable from a hole
  the figure is meant to have.
- Helmets ship alone, facing the same three-quarter direction as the others.

## The head standard

The older painting families used **head diameter = 43% of the sprite's
longest content dimension**, ±4. The natural-flight nine and five High Orbit
rigs now use a fixed 36px skull radius at their 192px reference size.
Preserve their existing registration when adjusting helmets.

The historical survey measured 38.8% – 48.8%, median 43.0%.
The thirteen original suits sit at 38.8–45.8%; the four helmetless renders
(Seraph, Leviathan, Gemmie, Sammie) came in at 47–49%, which is why they
needed larger head circles than the rest rather than the same one.

A model outside the tolerance still works — the head circle is measured per
suit, so nothing breaks — but staying inside it keeps the character the same
size on screen from suit to suit, which is what a player actually notices.

## The helmet standard

The head cavity must land on the head. A plain dome needs room for the ears
and muzzle without an empty oversized bubble; its original padded glass
mask is not the sizing reference. Current seats are in `HELMET_SEATS`.

Helmets with **ears, a crown, a halo or a long chin** are the exception:
an inscribed circle finds the wrong feature on them. **princess**, **sammie**,
**royal**, **seraph** and **leviathan** are all fitted by eye instead — draw
the helmet against a fixed head circle at a spread of candidate radii and
take the one that sits on it, or use the rig editor.

The cat helmet was the cautionary case, and it is why it no longer exists.
Its glass was a teardrop, so the inscribed circle settled on the shell's
widest point, up and back from the opening, and the printed centre seated
the helmet most of a head to the LEFT on every suit. The radius was fine;
the centre was not. **Sweep the centre as well as the radius**, and sweep it
on three or four real suits — one is not enough to see a small offset.

A shell with a face OPENING is not a bubble and its centre is not the
frame's centre: the head sits BEHIND the opening, back from it by about a
fifth of its own radius, because the muzzle is forward of the head's centre.
Princess and Sammie both hung the face behind lacquer until that was fixed.

## Adding a model

```bash
# 1. key the master and seat it in the family's framing in one resample
python3 illustrated-src/fit-suit.py art-src/suit-new-master.png docs/art/suits/newsuit.png

# 2. measure its head circle (or fit it in the rig editor)
python3 illustrated-src/measure-art.py suit   docs/art/suits/newsuit.png
python3 illustrated-src/measure-art.py helmet docs/art/helms/newhelm.png

# 3. review DOME in draw.ts and HELMET_SEATS in helmet-fit.ts
#    retain HELM_GLASS as the transparency mask, not the fit circle
# 4. add the id to catalog.ts (SUITS or HELMETS) and to art.ts

# 5. cut the tail off at the neck, and paste the printed TAIL_PIVOT back
python3 illustrated-src/neck-cut.py docs/art/suits newsuit

# 6. re-check everything, inspect the contact sheets, then bump ART_VER
python3 illustrated-src/verify-art.py
```

`fit-suit.py` exists because `key-render.py` keeps whatever framing the
render arrived with. The game does not care — `measureSprite` trims and
scales the trimmed box — but SHARPNESS does: a figure filling 150 px of a
256 canvas carries a sixth fewer real pixels than its siblings at 180, and
at the same on-screen size that reads soft. Key at source resolution, crop
to the figure there, and take one downscale straight to the family's size.

`neck-cut.py` is **not idempotent** — it seeds from the existing split and
the existing `TAIL_PIVOT`, so re-cutting after the pivots are written back
measures from the new hinge. Always cut from the original art, and pass
`--hints` at the `draw.ts` those pivots came from.

The tool prints a confidence for suits. **Below 0.80, fit it by eye** rather
than trusting the number — that is the signal that the face match did not
find the face.

`measure-art.py` is a diagnostic, not a release gate. Its percentage is a
useful clue for one file, but shaped helmets and unusual heads still require
the rendered contact sheet.

## Release QA

Run the mechanical gate from the repository root:

```bash
python3 illustrated-src/verify-art.py
```

It walks `docs/art`, the one shipping tree,
decodes every shipping raster, enforces runtime dimensions and alpha,
checks catalog/load coverage, audits the reviewed planet/debris cutouts,
and runs the full tail-rig audit.

Then inspect `docs/lab/helmet-fit/` on its light/dark plates, in portrait,
flight and dive views at both close and game size. It derives valid pairings
from the catalog. `node illustrated-src/review-helmet-fit.mjs
illustrated-src/design/helmet-fit-all --motion` generates native contact
sheets, including every bank frame and High Orbit preview samples.
`node illustrated-src/test-helmet-fit.mjs` checks catalog coverage, constant
bank radii, integrated-head preservation and game/Studio pixel parity.
The rig editor at `docs/lab/rig/` remains the authoritative place to adjust
head and helmet circles.

New or changed runtime art must be published to both public art trees. Do
not treat a passing mirror check as provenance: keep the high-resolution,
transparent or contrasting-plate master in `art-src/` as well. Most current
planet, debris, helmet and companion files have no source master, so repairs
to those derived 256px cutouts must stay conservative.

## Suits that keep their own head

`ownHead: true` in `catalog.ts` tells the renderer not to paint a helmet at
all. The 13 current integrated appearances are listed in the review inventory.
It is a last resort, not a fix for a suit that happens to have been
rendered wearing a dome; get a bare-headed render instead.

## Reference

`flight` remains a useful reference suit. Its current still anchor is:

```
"suit:flight": [182, 88, 40.32, 0]
```

This is Flight's current still socket. Other suits and motion frames retain
their independently reviewed sockets; changing Flight does not recalibrate them.


### Vanguard flagship exception (owner request, 5 September 2026)

Vanguard intentionally incorporates the loading-art gold helmet, so it is a
whole-character `ownHead` set. The owner authorized a higher art budget:
512px shipping poses (32 unique drawings), source sheets and the 1254px
master retained in `art-src/vanguard`. Other suits remain on their existing
256px contract. `export-vanguard.mjs` keys the deliberately green backing
and registers by measured head size, never individual silhouette bounds.
No ship or tutorial substitution is included.
