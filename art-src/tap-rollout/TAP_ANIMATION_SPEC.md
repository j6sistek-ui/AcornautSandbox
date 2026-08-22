# Acornauts tap animation — recreation specification

## Approved behavior

The tap is a one-second visual response layered over the unchanged flight
physics. It reads as a compact impulse rather than a sprite twitch:

- knees scrunch promptly;
- the tail straightens and pulls inward with the approved Robo timing;
- hands move only subtly and return more slowly than the legs;
- a new tap reverses the active visual clock toward the impulse instead of
  snapping to idle or restarting at frame 1;
- the animation may continue between taps and returns to the exact static pose.

Swipe-down and forward-dash animations are separate future work. They must not
reuse or modify this tap bank until their own motion specifications are approved.

## Asset contract

- 16 PNG frames per suit, named `<suit>-tap-1.png` through
  `<suit>-tap-16.png`.
- Every frame is 256×256 RGBA with true transparency.
- Identical files must exist under both `docs/art/suits/` and
  `sandbox_assets/art/suits/`.
- Frames 1 and 16 must be pixel-identical to the shipped `<suit>.png` static.
- The head, face, collar, and helmet socket must not scale, translate, or be
  redrawn at any point.
- Preserve each suit's original pixels, proportions, paint, tail shape, and
  silhouette. Do not generate one generic squirrel and recolor it.

## Roster policy

Robo is the approved timing reference. Eclipse, Big Booty, Cat, and Robo keep
their existing custom 16-frame banks. The deterministic translator is used for:

`flight`, `iontrim`, `copper`, `frost`, `voidsuit`, `aurorasuit`, `ember`,
`stardust`, `alien`, `ghost`, `gemmie`, `sammie`, `seraph`, `leviathan`,
`verdant`, and `cryostar`.

Those translated banks load only when `IS_BETA` is true. Production continues
to load only the four approved custom banks until the owner approves promotion.

## Construction method

Run `build_robo_motion_banks.py`. It uses each shipped `-body.png` and
`-tail.png`; it does not redraw the character.

1. Use the per-suit tail pivot already established by the runtime rig.
2. Apply Robo's measured 16-frame tail-angle sequence with nonlinear falloff,
   keeping the root planted while the outer plume receives most of the bend.
3. Reduce tail travel for broad premium silhouettes, especially Seraph,
   Leviathan, Verdant, and Cryostar.
4. Apply feathered local body deformations: knee compression, very small hand
   displacement, and sub-game-pixel torso follow-through.
5. Restore the exact static pixels inside the per-suit runtime helmet socket.
   This hard lock prevents the smaller-head/oversized-suit defect.
6. Use the untouched static image for the first and last frames.

The authoritative timing arrays, pivots, socket coordinates, and deformation
weights live beside this document in `build_robo_motion_banks.py`.

## Rapid-tap runtime semantics

- `TAP_ANIM_DURATION` remains 1.0 seconds.
- A tap during an active beat preserves the current frame clock and reverses
  `tapAnimDir` toward the impulse portion.
- The procedural tail spring receives another impulse on every accepted tap.
- The visual clock must eventually reach the `-1` idle sentinel without a
  forced snap.
- Flight physics, collision geometry, save data, and mode flow are unchanged.

## Adding a differently shaped suit

1. Add the static, body, and tail layers using the normal 256px rig contract.
2. Measure and add that suit's tail root to `PIVOTS`.
3. Copy its runtime helmet socket from `draw.ts` into `DOME`.
4. Add the suit to `ELIGIBLE` and to the beta-only loader in `game/art.ts`.
5. Start with the standard tail strength. Reduce it only if a broad plume,
   wing, or long armor panel crosses the torso.
6. Generate its bank, then perform both pixel checks and a shipping-path render.
7. Check every compatible helmet at impulse, maximum scrunch, recovery, and
   exact idle. Reject any head-size change, dome drift, collar gap, clipping, or
   disconnected alpha.

## Rebuild and validation

From the repository root:

```sh
python3 art-src/tap-rollout/build_robo_motion_banks.py
python3 art-src/tap-rollout/verify_robo_motion_banks.py
ACORNAUT_TSC=/path/to/typescript/lib/tsc.js node illustrated-src/export-sandbox.mjs
node illustrated-src/test-tap-recovery.mjs
node illustrated-src/test-bounce-impact.mjs
ACORNAUT_TSC=/path/to/typescript/lib/tsc.js node illustrated-src/test-tunnel.mjs
python3 illustrated-src/verify-art.py
ACORNAUT_CANVAS_MODULE=/path/to/@napi-rs/canvas/index.js \
  node illustrated-src/review-tap-models.mjs /tmp/acornaut-tap-review
git diff --check
```

Release criteria:

- both runtime trees match byte-for-byte;
- all tap frames decode as 256×256 RGBA;
- frames 1 and 16 exactly match the shipped static;
- locked head pixels have zero RGB delta;
- the largest alpha component is at least 94% of visible pixels;
- tap recovery, bounce impact, deterministic tunnel, and full art-contract tests
  pass;
- the 390×844 shipping-path review shows stable scale and fit for all suits;
- Big Booty and Cat are visually unchanged.
