# Acornaut Planet-Contact Animation Specification

Status: Eclipse Beta trial. Do not translate to the remaining suits until the
owner approves the motion at game scale.

## 1. Intent

A planet collision must read as physical contact rather than a rigid image
changing velocity. The response is short and subordinate to gameplay:

1. the planet-facing edge stays planted;
2. the body flattens slightly at contact;
3. the body lengthens into the rebound;
4. the tail is thrown opposite the rebound, overshoots once, and rejoins its
   existing spring;
5. the exact approved silhouette and helmet registration return at the end.

Physics, collision geometry, bounce velocity, scoring, invulnerability,
particles, and camera shake are unchanged.

## 2. Runtime contract

The trial is enabled only when `BOUNCE_ANIM_ENABLED` is true. That constant is
tied to `IS_BETA` in `illustrated-src/game/catalog.ts`.

`World` owns three rendering-only fields:

- `bounceAnimT`: elapsed impact time; `-1` means idle;
- `bounceAnimDir`: screen-space rebound normal (`-1` up, `1` down);
- `bounceAnimStrength`: impact amplitude clamped to `0.68..1.0` from incoming
  vertical speed.

`bounceOff()` captures these values without changing its existing bounce
calculation. It also adds a direction-aware impulse to the existing tail
spring. The visual clock lasts `0.38` seconds and advances on the same paced
world clock as the tap animation.

## 3. Eclipse presentation

Eclipse is the only suit using the new contact presentation during this trial.
No new raster art is generated.

- Body and helmet are transformed together around the planet-facing edge.
- Contact squash: at full strength, approximately `+10%` width and `-13%`
  height, decaying through the first 18% of the clock.
- Rebound stretch: approximately `-4.5%` width and `+8.5%` height through the
  middle of the clock.
- Settle: one restrained damped correction ending at exact scale `1,1`.
- Tail curve: `0, 0.58, 0.76, 0.48, 0.16, -0.11, 0`, multiplied by the impact
  strength and signed through the left-facing tail rig so the visible plume
  moves opposite the rebound direction.
- Contact visually overrides Eclipse's tap body bank and tap-tail bank, but it
  does not cancel or rewrite the underlying tap clock.

The existing generic hit-cooldown squash remains unchanged for every other
suit while Eclipse is evaluated.

## 4. Translation rule

After Eclipse approval, reuse this timing/state contract for the other suits.
Translate through each suit's existing body/tail rig and pivot. Do not redraw
armor, anatomy, face, hands, helmet, or suit details. Validate both upward and
downward planet contacts, every helmet attachment, mirrored runtime assets,
and exact return to the original silhouette before expanding beyond Beta.

## 5. Validation

- `illustrated-src/test-bounce-impact.mjs`
- `illustrated-src/verify-art.py`
- `illustrated-src/test-tunnel.mjs`
- `git diff --check`
