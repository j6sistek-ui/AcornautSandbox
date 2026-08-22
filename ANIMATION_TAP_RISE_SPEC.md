# Acornaut Tap/Rise Animation — Handoff Specification

Status: the approved tap response is implemented. This document is the
repository-root handoff for continuing the feature in a fresh checkout or a
new chat. The authoritative frame-generation details, roster, pivots, socket
coordinates, and verification commands live in
`art-src/tap-rollout/TAP_ANIMATION_SPEC.md` and
`art-src/tap-rollout/build_robo_motion_banks.py`.

## Scope

This specification covers only the short tap-to-rise visual response in the
illustrated Acornaut game. It does not cover swipe-down/dive, forward dash,
flight physics, collision geometry, scoring, or the Arcade Edition. Add those
actions as independent motion profiles after this tap bank is stable.

## Approved player-facing behavior

- The physics impulse is immediate on the tap frame.
- The one-second picture motion reads as a compact wingbeat: knees tuck, the
  pelvis/body lifts, the torso leans into the impulse, the tail straightens and
  pulls in, and the hands move only subtly. The hands and torso recover more
  slowly than the legs.
- A repeat tap during an active beat reverses the visual clock toward the
  impulse rather than snapping to idle or restarting at frame 1. When the
  clock reaches the start it plays forward again through recovery.
- The animation is allowed to continue between taps and eventually returns to
  the exact static pose.
- The procedural tail spring receives a new impulse on every accepted tap.
- Pitch follows the existing eased visual path; physics and collision remain
  unchanged.

Runtime constants in `illustrated-src/game/catalog.ts`:

```ts
TAP_ANIM_DURATION = 1.0
TAP_ANIM_ENABLED = true
```

The repeat-tap state machine is in `illustrated-src/game/sim.ts`:

1. Idle tap: set `tapAnimT = 0` and `tapAnimDir = 1`.
2. Active tap: preserve `tapAnimT` and set `tapAnimDir = -1`.
3. Rewind reaches zero: clamp to zero and set `tapAnimDir = 1`.
4. Forward playback reaches one second: return `tapAnimT` to the `-1` idle
   sentinel.

## Sprite contract

Each articulated suit has 16 transparent PNG frames:

```text
<suit>-tap-1.png ... <suit>-tap-16.png
```

Every frame must satisfy all of the following:

- 256 x 256 RGBA with true transparency;
- identical copies in `docs/art/suits/` and
  `sandbox_assets/art/suits/`;
- frames 1 and 16 are pixel-identical to the shipped `<suit>.png` static;
- fixed character root and planted tail hinge;
- exact static head, face, collar, and helmet-socket pixels in every frame;
- no body-frame crossfades;
- no redraw, recolor, generic body substitution, or proportion change;
- arm motion is subordinate to the leg scrunch and tail pull.

The head/socket hard lock is non-negotiable. It prevents the pilot from
shrinking inside the suit and keeps every compatible helmet seated throughout
the beat.

## Model policy

Robo is the approved timing and motion reference.

- Robo, Eclipse, Big Booty, Cat, and Volt retain their custom banks.
- Big Booty and Cat are excluded from deterministic translation and must remain
  pixel-identical unless the owner explicitly requests new custom work.
- Other supported suits use the deterministic translator, which preserves each
  suit's own body and tail pixels, pivot, socket, silhouette, and proportions.
- Translated banks are beta-only until the owner approves production
  promotion. The five custom banks continue to load outside Beta.

The current translated roster and per-model rig values are maintained in
`art-src/tap-rollout/TAP_ANIMATION_SPEC.md` and
`build_robo_motion_banks.py`; do not duplicate those tables here.

## Differently shaped suits

Do not force a new suit into a generic template.

1. Create its 256px static, `-body`, and `-tail` layers with the normal rig
   contract.
2. Measure its own tail root and add it to `PIVOTS` in the translator and
   `TAIL_PIVOT` in `illustrated-src/game/draw.ts`.
3. Measure its own helmet socket and add it to `DOME`/`HELM_GLASS`.
4. Add the suit to the beta catalog, beta art loader, and translator roster.
5. Generate its 16 frames from its own body/tail art.
6. Reduce tail travel only where a broad plume, wing, foliage, or long armor
   panel would cross the torso.
7. Inspect matched and compatible helmets at impulse, maximum scrunch,
   recovery, and exact idle.

Reject a translation for any head-size change, dome drift, collar gap, alpha
disconnect, tail/body seam, silhouette loss, or helmet clipping.

## Relevant implementation files

Source of truth:

- `illustrated-src/game/catalog.ts`
- `illustrated-src/game/sim.ts`
- `illustrated-src/game/art.ts`
- `illustrated-src/game/draw.ts`
- `art-src/tap-rollout/TAP_ANIMATION_SPEC.md`
- `art-src/tap-rollout/build_robo_motion_banks.py`

Validation and review:

- `art-src/tap-rollout/verify_robo_motion_banks.py`
- `illustrated-src/review-tap-models.mjs`
- `illustrated-src/test-tap-recovery.mjs`
- `illustrated-src/test-bounce-impact.mjs`
- `illustrated-src/test-tunnel.mjs`
- `illustrated-src/verify-art.py`

Generated JavaScript is produced by
`illustrated-src/export-sandbox.mjs`. Edit TypeScript first; never hand-edit the
generated runtime bundles.

## Rebuild procedure

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

## Approval gates

The feature is ready only when:

1. both runtime art trees are byte-identical;
2. all tap frames decode as 256 x 256 RGBA;
3. frames 1 and 16 exactly equal the corresponding static sprite;
4. the locked head/socket region has zero RGB delta;
5. the largest alpha component remains at least 94% of visible pixels;
6. at maximum scrunch, at least 30% of the original body-mask pixels show a
   visible color/alpha delta, so the body cannot remain a static cutout;
7. tap recovery, bounce, deterministic tunnel, viewport, and art-contract
   tests pass;
8. the 390 x 844 shipping-path review shows stable scale, helmet fit, tail
   attachment, and recovery for every translated suit;
9. Big Booty and Cat remain visually unchanged.
