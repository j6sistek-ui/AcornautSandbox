# Applying an approved Flight Studio preset

The JSON is a motion configuration and reproducible review session. Import it
in Flight Studio to verify it before promoting it in a separate game change.
This tool PR preserves the tap-controller repair merged in PR #250. It adds
an independent tuning workspace; it does not replace that shipping driver.

`core.mjs` is the executable configuration contract. Its animation functions
are independent of the studio flight simulator:

```js
import {createAnimation, acceptTap, acceptDive, stepAnimation}
  from './core.mjs';

const animation = createAnimation(modelFromManifest);
// Only when the game accepts input:
acceptTap(animation, preset.profile);
// An accepted quick drop:
acceptDive(animation);
// Fixed presentation steps, after the game's physics has supplied vy:
stepAnimation(animation, preset.profile, 1 / 120, authoritativeVy);
```

For rigs, `animation.output` has the existing High Orbit, Arcflash or AcorNut
maneuver state shape and feeds the same painter as the game. `animation.pitch`
is a whole-model pitch in degrees. For frame banks, `animation.bank`, `frame`
and `slot` select the original local image and the corresponding per-frame
pitch offset. `StudioRenderer.paint` demonstrates the complete mapping without
gameplay side effects. Never re-index the tap sequence by upward velocity.

For the `premium-flight` family, `animation.frame` selects one complete 256px
cell in the suit's sixteen-frame sheet. `animation.output` retains the High
Orbit controller only for the custom wake and accepted-input lifecycle;
its skeleton does not deform the painting. Use `paintPremiumFlightFrame`
with the selected frame, whole-model pitch and that persistent output state.
The painter uses the frame's measured emitters and preserves its fixed head.
Premium presets have no body-part settings.

When integrating, move/adapt the pure configuration runtime into the game's
source pipeline and register the selected preset by suit. Do not load the
whole editor or make the app depend on the loopback server. Confirm asset and
painter hashes against the selected source revision; the manifest captures
the actual baselines rather than claiming compatibility with future remasters.
Retain accepted-input authority, pause/warp/tutorial freezes and renderer
registration. The preset's `pattern` and physics values are review fixtures;
they must not replace game forces, collisions, progression or rewards.

The native controllers contain multiple independent tap accents. The
retrigger option governs the studio tap curve and frame clip; native rig
impulse hooks still observe every accepted tap, preserving their original
continuous rhythm. A queued bank cycle is a visual clip and never adds a
physics impulse. Full descent is normalized to the preset's positive
`descentFull`; ascent response uses the game's 450px/s reference.

No auto-apply or background repository write occurs on export. A game change
still needs build/regression checks, visual review and its own PR approval.
