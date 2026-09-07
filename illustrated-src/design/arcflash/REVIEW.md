# Arcflash flight review

Arcflash is the new blue-eyed, dark-carbon squirrel suit requested on
6 September 2026. The supplied still defines the orange fur, navy collar,
blue reactor and suit materials. The video defines the coordinated chest,
arms, legs and delayed tail movement. Its green palette and late roll are
excluded. Descent is an interpretation: the useful pre-roll video does not
contain a clean sustained falling example.

The branch includes main `85ce67d`, preserving AcorNut repairs #200 and
#201 and the per-suit beta pitch dial from #202. AcorNut's restored maneuver rig preserves motion across quick inputs;
its separate powered-ascent booster provided one additional useful lesson.
Arcflash holds its own blue jets through a tap-driven climb and fades them
at the actual apex. That exhaust state never drives the limb springs.
Vanguard's animation modules and artwork have no changes in this branch.

## What ships

- Free **Arcflash** suit in the beta hangar, with its own bare head and
  exclusive blue electrical wake. Changing suits restores the previous trail.
- Eleven painted rig pieces in one 1024×768 RGBA atlas. The twelfth source
  reference cell is unused. Source design, generation prompt and measured
  anchors are in `art-src/arcflash`.
- Fixed anatomy, velocity-driven body attitude, local head counter-rotation,
  independently damped shoulders/elbows/hips/knees and three-section tail lag.
  Fast taps add pressure without restarting any pose, rate or tail phase.
- Boot electricity retains 0.48 seconds of actual world positions; wrist
  jets follow the same endpoints as the artwork. Curved strands, small forks
  and sparks evolve deterministically. Contact recovery survives the next tap.
- One painter for gameplay and the hangar. The 256px fallback is generated
  from the same rig and matches its registration pixel for pixel.
- The beta pitch dial works in gameplay and the hangar. Arcflash defaults to
  0 degrees; AcorNut retains main's 12-degree default. Whole-character pitch
  rotates Arcflash's anatomy and newly emitted nozzle positions/directions
  together, while previously emitted wake remains in world coordinates.
- HyperRun uses its accepted hold/boost/drop input and fixed race clock;
  the suit never changes race authority. Ship cockpits show Arcflash's own
  bare blue-eyed face, and the trail card has its own blue electrical sample.

## Evidence and limits

`flight-preview.mp4`, recorded from build 198 at Arcflash's unchanged default
pitch of 0 degrees, is an eight-second, real-time native Canvas review of
the production painter driven by actual 60 Hz simulation inputs. It includes
100/180/300ms tap groups, hands-off descent, a down swipe and one real collision
with a staged planet. The enlarged and 52px views share the same state.
The following camera and tall empty chamber are review fixtures; no pilot
position resets or displayed pose overrides are used. The video is not a
browser or physical-device recording. Long trails are clipped to the review
panels; the character remains visible.

`flight-trace.json` records the input events, physics and every frame's motion.
The Arcflash and Flight fixtures match all checked gameplay fields on every
tick. Head/torso scale differs only by native Canvas matrix rounding
(less than 0.0000002); limb-length error is below 0.000000000001. The visual
controller and painter consume no `Math.random` and the painter does not
mutate the motion state.

Focused tests cover input continuity, actual 346ms apex timing, powered-ascent
shutoff, contact retention, 30/60/120Hz consistency, first-load fallback,
connected limbs, atlas alpha/matte, and positive tail triangle areas through
reversals. The largest detached raster fragment in 24 sampled poses is two
fur pixels. Build 199 additionally verifies saved per-suit pitch isolation,
the retained AcorNut default, and matching nozzle/jet transforms across the
pitch dial's range. Shipping art passes all 30 existing QA groups.

The strongest small-scale cues are chest attitude and delayed tail movement.
Forearm motion is subtler at 52px. Physical-phone frame pacing and final owner
approval of the proportions and motion remain to be checked in the beta.

## Reproduce

Use Node, TypeScript, `@napi-rs/canvas`, `happy-dom`, Python/Pillow and ffmpeg.
The optional dependency variables accept installed paths; no dependency
installation is needed when those packages are already available.

```sh
node illustrated-src/export-arcflash.mjs
node illustrated-src/export-sandbox.mjs
node illustrated-src/review-arcflash.mjs
node illustrated-src/test-arcflash-motion.mjs
node illustrated-src/test-arcflash-render.mjs
node illustrated-src/test-arcflash-integration.mjs
node illustrated-src/review-arcflash-flight.mjs
python3 illustrated-src/verify-art.py
```

For external dependencies set `ACORNAUT_TSC` to TypeScript's `lib/tsc.js`,
`ACORNAUT_CANVAS` to the canvas package, and `ACORNAUT_HAPPY_DOM` to
happy-dom's `lib/index.js`. Video encoding uses `ACORNAUT_FFMPEG` and
`ACORNAUT_FFPROBE` when provided. Generated game code is build 199; the
standard exporter owns stamp retention and generated HTML.
