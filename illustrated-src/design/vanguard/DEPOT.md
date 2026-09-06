# Vanguard's Depot arrival

The previous Spill arrival moved the ship toward the dock and immediately
opened the shop. No character left the cockpit or entered the portal.

Vanguard now has a 3.8-second scene **after touchdown**, before the Depot
opens. The initial 2.4-second approach and later 4.8-second approaches retain
their travel timing. Other suits retain their ordinary arrivals.

| Time after touchdown | Action |
| --- | --- |
| 0–0.65 s | Exit the parked ship and walk behind the bear |
| 0.65–1.35 s | Pull spare white/purple trousers from the suit and unfold them |
| 1.35–2.60 s | Three emphatic laugh beats, holding the same trousers |
| 2.60–3.25 s | Fold and completely tuck the trousers into the suit |
| 3.25–3.80 s | Move into the portal and disappear through its opening |

The squirrel remains fully dressed. The bear faces the arriving ship and
occludes the squirrel as he passes behind it. A short camera move brings the
action closer on phones, then holds still during the gag. The parked cockpit
is empty, its thruster stops, and the portal finishes with a brief upward pull.
This revision adds no voiced laughter or new sound effect.

## Art and loading

The built-in imagegen tool created sixteen whole-character poses from the
existing Vanguard master. Exact prompts and both source renders are in
`art-src/vanguard/depot`. The first source has a baked checkerboard; the
second replaces that backing for extraction. Runtime never loads either.

`export-vanguard-depot.mjs` locates complete silhouettes before cutting them:
a few ears cross the source's nominal cell boundaries. A single fixed scale,
visor x anchors and common foot baseline register the whole drawings. No limb
rigging, bounding-box resizing, hue animation, stretching or crossfading.
The resulting 1280×1280 RGBA atlas is about 1.5 MB compressed / 6.25 MiB
decoded. It loads only when entering Spill with Vanguard equipped.

Readiness is latched once at touchdown. Incomplete or failed scene assets,
other suits and reduced motion use the normal arrival without an extra wait.
Pause freezes the scene. Optional presentation flags are excluded from saved
checkpoints. Repairs, visit credit and shop arming still occur once, when the
Depot actually opens. The first free upgrade cannot be purchased early.

## Verification

The production build, `test-vanguard-depot.mjs`, `test-spill-welcome.mjs`,
`test-spill.mjs`, `test-spill-progression.mjs` and `test-spill-ui.mjs` pass.
The UI test drives the real engine through Vanguard, Flight, reduced-motion
and missing-art arrivals, checking the overlay lock and pause/resume.

`review-vanguard-depot.mjs` renders the actual painter at 390×760, with
320px and desktop framing checks. A local sans font substitutes for remote
Figtree in native-canvas exports. The cloud browser could not reach the local
build (`ERR_BLOCKED_BY_CLIENT`), so browser playback and real-device frame
pacing remain unverified. The owner's iPhone playtest is the final feel check.

Use `ACORNAUT_CANVAS` for the native-canvas module path, `ACORNAUT_TSC` for
TypeScript and `ACORNAUT_HAPPY_DOM` for the DOM test dependency. The review
script writes frame PNGs to `ACORNAUT_QA_OUTPUT`; frames 72–185 at 30 fps are
the 3.8-second post-landing preview.
