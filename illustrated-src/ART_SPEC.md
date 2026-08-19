# Acornaut art spec — heads and helmets

Every helmet has to sit on every suit. There are 18 suits and 21 helmets, so
that is 378 combinations and no one is going to eyeball them all. This is the
contract that makes them work without checking.

## The contract

A suit sprite carries a **head circle**. A helmet sprite carries a **glass
circle**. At draw time the helmet is scaled so its glass circle lands exactly
on the head circle:

```
scale = headRadius * 1.04 / glassRadius
```

Those two circles are the numbers in `draw.ts`: `DOME` for suits (keyed
`"suit:<id>"`) and `HELM_GLASS` for helmets. Get them right and any helmet
fits any suit. Get one wrong and that item is broken against all 20-odd of
the others — which is exactly how we ended up with a dome that read huge on
one suit and small on the next.

**Measure them. Do not estimate them.** Every fault we have had here came
from a plausible-looking proxy, and the plausible proxies all lie:

- The blob of warm fur around a face includes ears, muzzle and neck, and
  those move with the pose. `sqrt(area / pi)` over that blob swings by a
  third across heads that are the same size.
- Colour tests find no head at all on **alien** (green), **ghost** and
  **frost** (white) or **robo** (chrome), and on several suits a belly of
  warm fur outscores the face.
- A helmet's **visible visor** is nothing like its glass radius, because the
  shell hides most of the sphere's edge. Measuring Sammie's visor gave 78
  where the answer was 124.

## What to render for a new model

- **1408 × 1408**, character centred, plain flat cream background.
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

**Head diameter = 43% of the sprite's longest content dimension**, ±4.

Measured across the shipping suits: range 38.8% – 48.8%, median 43.0%.
The thirteen original suits sit at 38.8–45.8%; the four helmetless renders
(Seraph, Leviathan, Gemmie, Sammie) came in at 47–49%, which is why they
needed larger head circles than the rest rather than the same one.

A model outside the tolerance still works — the head circle is measured per
suit, so nothing breaks — but staying inside it keeps the character the same
size on screen from suit to suit, which is what a player actually notices.

## The helmet standard

The glass circle is what must land on the head. For a plain bubble helmet it
is the sphere itself; the twelve plain bubbles all carry `125` and all
measure `103–107` as an inscribed circle, hence the constant in the tool.

Helmets with **ears, a crown, a halo or a long chin** are the exception:
an inscribed circle finds the wrong feature on them. **catbubble** and
**leviathan** were both fitted by eye instead — draw the helmet against a
fixed head circle at a spread of candidate radii and take the one that sits
on it.

catbubble is the cautionary case. Its glass is a teardrop, so the inscribed
circle settles on the shell's widest point, up and back from the opening,
and the printed centre seated the helmet most of a head to the LEFT on
every suit. The radius it printed was fine; the centre was not. **Sweep the
centre as well as the radius**, and sweep it on three or four real suits —
one is not enough to see a small offset.

## Adding a model

```bash
# 1. key the render, then measure it
python3 illustrated-src/measure-art.py suit   docs/art/suits/newsuit.png
python3 illustrated-src/measure-art.py helmet docs/art/helms/newhelm.png

# 2. paste the printed line into DOME / HELM_GLASS in draw.ts
# 3. add the id to catalog.ts (SUITS or HELMETS) and to art.ts
# 4. re-check everything
python3 illustrated-src/measure-art.py audit
```

The tool prints a confidence for suits. **Below 0.80, fit it by eye** rather
than trusting the number — that is the signal that the face match did not
find the face.

## Suits that keep their own head

`ownHead: true` in `catalog.ts` tells the renderer not to paint a helmet at
all. It is for models whose face is the costume — the Cat is the only one
using it. It is a last resort, not a fix for a suit that happens to have been
rendered wearing a dome; get a bare-headed render instead.

## Reference

`flight` is the reference suit. Its anchor is hand-tuned and everything else
is measured against it:

```
"suit:flight": [195, 97, 51]
```

Change it and every other suit's measurement moves with it.
