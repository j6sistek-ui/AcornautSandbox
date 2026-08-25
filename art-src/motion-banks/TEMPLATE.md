# Motion bank template — adapting Flight's model to the rest of the roster

Flight flies better than every other suit, and the reason is not that it has
more art. It has **less**: eight frames against a tap bank's sixteen. What it
has is *attitude* — a pose set spanning 99 degrees of body pitch, which the
sim indexes by vertical velocity. The pose can never disagree with the
physics, because the physics is the index.

This is the brief for giving the same thing to everything else.
`MOTION_SPEC.md` is the contract; this file is how to produce the art.

## The target

`FLIGHT-REFERENCE.png` is the standard, eight frames side by side with the
measured pitch under each. `flight-ramp.json` is the same as data.

| frame | role | pitch |
|---|---|---|
| asc-1 | climb, shallow — the LEVEL pose | −14° |
| asc-2 | climb | −17° |
| asc-3 | climb, steepest | −23° |
| desc-1 | dive, shallow — the LEVEL pose | +14° |
| desc-2 | dive | +18° |
| desc-3 | dive | +36° |
| desc-4 | dive | +43° |
| desc-5 | dive, steepest | +76° |

Three climbing, five diving. The asymmetry is deliberate: the dive is where
the arc is slow and the eye has time to read it, so it gets the resolution.
The ramp is monotonic and opens out — a narrow band climbing, a wide one
falling.

`asc-1` and `desc-1` are what a pilot sees at the top of every arc, so they
are the two that must read as the same character at rest, not as two
different ideas.

## Two routes, and the roster splits unevenly

`roster.json` has the split, measured.

**SELECT (4 suits)** — `robo`, `volt`, `bigbooty`, `eclipse`. Their existing
16-frame tap banks already span 64–112°, with at least three climb poses and
five dive poses among them. A 3+5 selection produces a monotonic ramp with
**no new art at all**. Prototype before drawing: pitch is a proxy, and a
frame at −27° may be mid-wing-beat with the arms somewhere the neighbouring
frame's are not, so a ramp chosen on pitch alone can read as jitter. This
needs an eye, not just a number.

**RENDER (24 suits)** — everything else. Their tap banks span 16–20°: the
body is rigid and the tail does the work. That is a flap, not a ramp, and no
amount of re-indexing converts it. These need eight new frames each.

## What to render

Everything in `ART_SPEC.md` applies unchanged — **1408 × 1408**, character
centred, plain flat background (transparent if the generator will give it),
**bare-headed**, no dome, no halo, no ears, **no ground plane and no cast
shadow**. A pale character needs a black plate, not cream.

On top of that, for a motion bank:

1. **The same character in eight attitudes.** Not eight moments of an
   animation — eight *headings*. The suit, the fur, the tail's mass and the
   proportions are identical in all eight; only the angle of flight changes.
   Use the suit's existing still (`docs/art/suits/<id>.png`) as the identity
   reference.
2. **Span at least 60° of pitch**, and aim for Flight's 99°. Under 60 there
   is nothing for velocity to choose between and `verify_motion_banks` will
   refuse the bank. If the range has to be narrow, four wide-spread frames
   beat eight tight ones.
3. **The tail carries the read.** Across Flight's ramp the body rotates
   modestly while the tail travels through a huge arc — tucked forward under
   the belly at the steepest climb, a tall vertical plume behind at the
   steepest dive. It is the tail that tells a player which way they are
   going.
4. **The head must not change size.** Flight holds a 33px head radius across
   all eight — 0.0% spread. The head *centre* travels 15px across and 50px
   down; the radius never moves. One scale fits the helmet to the head, so a
   head that grows and shrinks makes the dome breathe against the face along
   the ramp. This is the single easiest thing to get wrong and the hardest
   to see.
5. **One canvas, one scale.** The engine registers every frame in both banks
   against `ascFrames[0]`, so a frame re-centred or re-cropped on its own
   will jump.

## Prompt skeleton

Per suit, per frame. Keep the identity clause byte-identical across all
eight of a suit's frames — it is what stops the character drifting.

```
<identity: the suit's existing still, described — species, suit colours,
 trim, materials, proportions>, full body, three-quarter view,
side-on to camera, flying through space,
<attitude clause>,
bare head, no helmet, no dome, no halo,
plain flat black background, no ground, no shadow,
centred, full figure in frame, consistent scale
```

Attitude clauses, in ramp order:

| frame | attitude clause |
|---|---|
| asc-1 | nose slightly up, body near level, tail streaming straight back |
| asc-2 | nose up, climbing, tail beginning to curl forward under the body |
| asc-3 | nose high, steep climb, tail tucked forward beneath the belly, body compact |
| desc-1 | nose slightly down, body near level, tail streaming straight back |
| desc-2 | nose down, shallow dive, tail lifting behind |
| desc-3 | nose down, diving, tail arcing up and back over the body |
| desc-4 | steep dive, forelimbs reaching forward, tail high behind |
| desc-5 | near-vertical dive, body pointing down-forward, tail a tall plume straight above |

## Wiring a finished bank

```
# 1. key and seat all eight in the family's framing in ONE resample
python3 illustrated-src/key-render.py ...
# 2. measure the dome anchor on EACH of the eight - do not estimate them
python3 illustrated-src/measure-art.py --poses <id>-asc-1..3 <id>-desc-1..5
# 3. paste the eight printed lines into DOME in draw.ts
# 4. add the id to ASC_BANKS / DESC_BANKS in art.ts, and do NOT add it to
#    TAP_BANKS - a motion bank makes a tap bank unreachable
# 5. python3 illustrated-src/verify-art.py     (verify_motion_banks)
# 6. fly it in the loadout preview, then bump ART_VER and re-export
```

`verify_motion_banks` will refuse a bank that is missing an anchor (which
paints **no helmet at all**, silently), whose head radius swings more than
4%, or whose pitch spans under 60°.

## Cost

At WebP sizes a rigged suit is roughly 8 frames × ~22 KB ≈ **175 KB** —
about an eighth of a 16-frame tap bank today. The expensive part is not
bytes and not code; it is producing eight frames of one character that
actually agree with each other.
