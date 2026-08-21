# Acornaut Tap/Rise Animation — Reproduction Specification

Status: implemented for Beta and ready for per-model in-game review. This file
is the source-of-truth handoff for recreating or repairing the feature in a new
chat or checkout.

## 1. Scope

This specification covers only the short **tap-to-rise** visual response used
by the illustrated Acornaut game. The feature is gated by
`TAP_ANIM_ENABLED = IS_BETA`; Production retains the prior tap presentation
until the complete model roster is approved.

It does not cover:

- swipe-down/dive animation;
- dash-forward animation;
- changes to flight physics, collision geometry, controls, scoring, or timing;
- the Arcade Edition.

Develop those actions as separate motion profiles. Do not extend this tap clock
until the tap implementation is stable and independently validated.

## 2. Player-facing result

On a tap, lift remains immediate, but the character picture no longer snaps to
a new pitch or twitches through two visible frames. The visual response lasts
0.66 seconds and contains:

1. restrained anticipation;
2. upward thrust;
3. body extension;
4. delayed tail drag;
5. tail whip through home;
6. one small rebound;
7. exact return to the static flight pose.

A second tap during recovery must not restart, rewind, or stop the body bank.
The painted body continues from its current pose while physics, pitch,
particles, and the live tail spring respond immediately to the new input. This
keeps the animation alive between taps without snapping the hands backward.

## 3. Non-negotiable invariants

- Physics responds on the tap frame; animation never delays control.
- Collision geometry is unchanged.
- The character root remains on the existing 256 x 256 rig canvas.
- The model's tail hinge remains planted.
- Helmet/dome anchors remain compatible with every existing helmet.
- Tail, armor, fur, face, and lighting identity come from approved repository
  art. Do not independently redesign models to create motion.
- Animation begins and ends on the exact static body/tail pose.
- No body-frame crossfades. Painterly faces and armor seams become blurry or
  double when crossfaded at game scale.
- Arm and hand motion must remain subordinate to the legs and tail. Do not use
  a full forward reach during the short tap burst.
- Docs and `sandbox_assets` mirrors must remain byte-matched.

## 4. Architecture

### 4.1 Visual clock

`TAP_ANIM_DURATION` is `0.66` seconds in
`illustrated-src/game/catalog.ts`.

`TAP_ANIM_ENABLED` is tied to `IS_BETA`. The Production page does not start the
tap clock or fetch the optional Eclipse animation banks.

`World` owns:

- `tapAnimT`: elapsed visual time; `-1` means inactive;
- `tapAnimHold`: bounded slow-recovery reserve added by repeat taps;
- `tapAnimFromRot`: displayed pitch at tap entry for visual easing.

`flap()` starts the clock without changing the physics path. During an active
burst, a repeat tap leaves the body clock unchanged, adds 0.16 seconds to a
bounded 0.30-second recovery reserve, applies the full physics impulse, and
adds to the existing tail spring velocity. Once `tapAnimT` reaches 0.20, the
clock advances at 35% speed while that reserve drains. This extends the return
without changing or rewinding the current pose.

`updateWorld()` advances the visual clock using the same pace multiplier as the
run and returns it to `-1` at 0.66 seconds plus any repeat-tap recovery reserve.

### 4.2 Pitch easing

Every rigged model eases from `tapAnimFromRot` into the live physics pitch over
the first 0.14 seconds using cubic ease-out:

```ts
raw = clamp(tapAnimT / 0.14, 0, 1)
eased = 1 - (1 - raw)^3
```

The legacy `kick` rotation and scale-pop are disabled while this rigged tap
clock is active. They must not be layered on top of the new motion.

### 4.3 Eclipse premium body bank

Eclipse is the approved high-detail reference implementation:

- 8 body-only PNG poses;
- 256 x 256 RGBA;
- transparent background;
- fixed root, head/collar registration, and helmet anchor;
- per-pose source-space registration that restores the approved static head
  area and centroid; the eight paintings were delivered smaller inside their
  fixed 256px roots, so this correction is required to prevent the pilot from
  shrinking inside the suit before the static bookend returns;
- restrained arms: thrust frames 3–5 reuse frame 1's compact arm pixels while
  retaining their own torso, hip, leg, and boot motion;
- original procedural tail remains a separate layer.

Asset names:

```text
eclipse-tap-1.png ... eclipse-tap-8.png
```

Body pose boundaries in seconds. The first half produces the knee tuck; the
second half deliberately gives the arms and torso more time to settle:

```text
0.000, 0.035, 0.080, 0.135, 0.200,
0.275, 0.365, 0.460, 0.550, 0.625, 0.660
```

Static body art is inserted at both ends. The eight painted poses occupy the
interior boundaries and are stepped, not blended. An in-progress repeat tap
does not change the current boundary.

### 4.4 Eclipse tail bank

Eclipse also has 12 tail-only PNG poses mechanically derived from the approved
`eclipse-tail.png`. Pixels are progressively bent from the hinge to the tip;
fur and lighting are never regenerated.

Asset names:

```text
eclipse-tail-tap-1.png ... eclipse-tail-tap-12.png
```

Tip-angle motion curve in radians:

```text
0.00, 0.09, 0.20, 0.34, 0.47, 0.54,
0.46, 0.27, 0.04, -0.15, -0.09, 0.00
```

The tail bank uses fast launch spacing and slow recovery spacing:

```text
0.000, 0.030, 0.065, 0.105, 0.150, 0.200, 0.260,
0.335, 0.415, 0.500, 0.575, 0.625, 0.660
```

48% of the live spring rotation is retained over the painted bank so every tap
can renew tail motion while the authored recovery continues.

The deterministic builder is:

```text
illustrated-src/build-eclipse-tail-tap.py
```

### 4.5 Translation to every other model

All 20 current suits are rigged with separate `*-body.png` and `*-tail.png`
assets and a `TAIL_PIVOT` entry.

For models without a painted tap bank:

- keep the exact existing body pixels;
- apply a restrained scale pulse from the tail hinge, not the canvas center;
- bend the tail at runtime through six overlapping radial sections;
- increase rotation progressively from hinge to tip;
- retain 22% of the live spring rotation so a tap entered mid-swing remains
  continuous;
- use the same 12-point tail curve as Eclipse with smooth interpolation.

Universal body pulse curve:

```text
0.00, 0.18, 0.48, 1.00, 0.78, 0.43, 0.16, -0.08, 0.00
```

At pulse value `p`, scale from the tail hinge:

```text
x = 1 + p * 0.052
y = 1 - p * 0.028
```

This is intentionally less dramatic than Eclipse. It preserves model identity
and avoids approximately 400 additional raster assets and their mobile startup
cost.

## 5. Relevant files

Source:

- `illustrated-src/game/catalog.ts`
- `illustrated-src/game/sim.ts`
- `illustrated-src/game/art.ts`
- `illustrated-src/game/draw.ts`
- `illustrated-src/build-eclipse-tail-tap.py`

Validation/review:

- `illustrated-src/review-eclipse-tap.mjs`
- `illustrated-src/review-tap-models.mjs`
- `illustrated-src/test-tap-recovery.mjs`
- `illustrated-src/test-eclipse-tap-registration.py`
- `illustrated-src/verify-art.py`
- `illustrated-src/test-tunnel.mjs`

Mirrored runtime assets:

- `docs/art/suits/`
- `sandbox_assets/art/suits/`

Generated JavaScript is produced by `illustrated-src/export-sandbox.mjs`. Edit
TypeScript sources first; do not hand-edit generated JS.

## 6. Recreation procedure

1. Start from current repository `main` and create a feature branch.
2. Confirm all active suits have full, body, tail, and `TAIL_PIVOT` entries.
3. Restore the 0.40-second visual clock and rapid-repeat behavior.
4. Restore universal pitch easing.
5. Restore `ArtBank.suitTap` and `ArtBank.suitTapTail` optional banks.
6. Restore Eclipse's eight body and twelve tail assets.
7. Restore the universal hinge-scaled body pulse and six-section tail bend.
8. Run the tail builder to reproduce Eclipse tail frames.
9. Export the TypeScript runtime to both asset trees.
10. Run every validation gate below.
11. Inspect the Eclipse comparison and all-model grid video at actual game
    scale before approving.

## 7. Required validation gates

The change is not complete unless all gates pass:

1. TypeScript export/compile.
2. Art mirror equality.
3. Decode every mirrored raster.
4. 256 x 256 RGBA runtime-sprite contract.
5. Suit x helmet load contract.
6. Rig-tail audit for every active model.
7. Deterministic tunnel replay: three forced seeds x 100 seconds.
8. Viewport replay: 320 x 568 and 390 x 844.
9. Rapid repeated taps in the rendered review harness.
10. Visual inspection for:
   - hinge gaps;
   - radial-section seams;
   - tail/body overlap errors;
   - double eyes or blurred armor;
   - helmet drift;
   - snap on entry, repeat tap, or return to static.
   - Eclipse head-area drift or head-centroid drift inside the fixed helmet.

## 8. Rejected translation method

Do not ask an image model to independently redraw all suits from the Eclipse
sheet. A Flight-model trial produced usable movement but silently changed suit
construction and added sleeves. That fails identity preservation and should not
be scaled across the roster.

New painted banks are allowed only for a specifically approved premium model,
using that model's own body as the identity source and passing the full art and
helmet-anchor contract afterward.

## 9. Transfer prompt

Use this exact routing statement in a new chat:

> Read `ANIMATION_TAP_RISE_SPEC.md` completely and inspect the current
> implementation before editing. Recreate or repair only the tap/rise
> animation. Preserve immediate physics, collision geometry, 256px roots,
> helmet anchors, model identity, and docs/sandbox mirror parity. Do not begin
> swipe-down or dash-forward work. Run every validation gate in Section 7 and
> provide the rendered Eclipse comparison plus the all-model validation grid.
