# Cryostar and Verdant: Eclipse motion transfer

The owner requested Eclipse's motion frames and flight mechanics for Cryostar
and Verdant, with stable costume features, designs and colours at each body
location. These are the only regenerated suits. Art references were captured at
`3509e1a12a8436b28d64105edebdb0fed01387a9`; the finished change is integrated and
validated against main `1069bea100b5f2586eac5c4109068b37455b72ee` (PR #241).

## What changed

Each suit has 8 ascent and 8 descent paintings in Eclipse's exact cell order.
The production painter uses the same heading smoother (120 ms), pose curve,
frame selection, full dive range, contact response and preview arc for the three suits. Their
default pitch is 5 degrees; the existing per-suit adjustment remains available.
Game physics, rewards, catalog availability and every Eclipse image are unchanged.
Existing bank registration already loaded 8/8 for both suits and needed no change.
The new main's temporary 0.7 dive limits for these two now become Eclipse's 1.0.
Its 12 frozen suits remain protected. The source export rebuilds cache stamp 245
and prunes stamp 241 through the repository's existing four-stamp retention rule.

The pictures preserve each costume's original identity: Cryostar's silver-white
plates and blue crystal inserts; Verdant's green/ivory leaf plates and gold trim.
The chest, collar, cuffs, hip/knee fasteners, boots and tail were reviewed across
all 16 poses. No disappearing/added fastener or location-dependent material swap
was observed. Perspective, shading and crystal highlights still vary with pose;
this is a visual review result, not a claim that different drawings are pixel-identical.

## Sources and export

- `eclipse-before.png`: unchanged 16-frame motion guide, in 4-by-4 order.
- `cryostar-reference.png`, `verdant-reference.png`: exact original static portraits.
- `*-PROMPT.md`: built-in image generation requests for the two costumes.
- `*-MATTE-PROMPT.md`: correction of the initial baked checkerboard to magenta.
- `*-master.png`: final 1254px source sheets with a contrasting production matte.
- `registration.json`: pupil landmarks compared with corresponding Eclipse eyes,
  per-frame helmet centres, constant 56px radius and Eclipse pose rotations.
- `features.json`: manually located shoulder and hip plates, in exported pixels.
- `frame-hashes.json`: reviewed runtime PNG git-blob hashes, used by the historical
  helmet regression to allow only the 32 explicitly replaced images.

The exporter keys the magenta plate, splits equal cells and resamples once to
256px RGBA. Every cell receives the same scale and registration. It never rotates,
recentres or stretches individual poses and never substitutes body parts.
It removes small magenta resampling fringes, then calibrates each shoulder/hip
material's hue to the corresponding plate of the original portrait. Saturation,
brightness, alpha and painted details are retained. The correction feathers to
zero outside the plate, preventing a moving colour boundary.

```sh
node illustrated-src/export-eclipse-motion-transfer.mjs
python3 illustrated-src/verify-eclipse-motion-transfer.py --report
ACORNAUT_TSC=$PWD/node_modules/typescript/lib/tsc.js npm run build
ACORNAUT_QA_OUTPUT=$PWD/art-src/eclipse-motion-transfer/review \
  node illustrated-src/test-eclipse-motion-transfer.mjs
python3 illustrated-src/verify-art.py
node illustrated-src/test-helmet-animation.mjs
```

The old `flight-refresh` masters/regions remain historical. Their generic
median-tail-volume check does not apply to the new Eclipse sequence: Eclipse's
tail deliberately unfurls and changes its silhouette through the ramp. The new
gate compares each silhouette with its corresponding Eclipse pose, verifies the
actual filled skull region, and checks the two local armor inserts in every frame.
No thresholds or sampling regions changed for another suit.

## Verification

- Source export and lab build pass. TypeScript passes with Windows-expanded
  source paths. There is no lint script; `git diff --check` passes.
- A clean re-export produces the same hashes for all 32 shipping PNGs. The frozen
  roster regression passes; no other shipping art changed.
- Shipping art: **31 QA groups pass**, including clean raster edges and rig tails.
- 32 transparent 256px frames, no clipped edges or surviving magenta pixels.
- Minimum silhouette overlap with corresponding Eclipse art: **93.11% Cryostar**,
  **94.87% Verdant**. Different armor outlines account for part of the difference.
- All 64 shoulder/hip samples retain their own coloured insert. Maximum median
  hue spread: **0.00141** of the hue circle (about half a degree).
- **192** explicit pose/size/helmet samples, **900** identical-input gameplay
  comparisons, **480** loadout preview comparisons and **20** contact comparisons
  pass. Physics, selected bank/frame and body rotation/stretch match Eclipse.
- Historical helmet regression passes: **6,830** comparisons, **592** motion
  samples, **5,880** gameplay samples and **2,016** preview samples. Replaced art
  is explicitly separated from unchanged-art assertions and pinned by hash.
- Browser: production page and the shipping rig bench loaded at 390px; all 16
  Cryostar frames and measured anchors were present. The browser tool could not
  capture screenshots. The PNG reviews here are native Canvas renders of the
  actual production painter, not browser screenshots.

`review/*-frames.png` shows every pose with matching/Clear helmets.
`review/armor-details.png` places the original portrait beside all shoulder/hip
patches. `runtime-report.json` and `art-report.json` contain the numeric results.

All **45 JavaScript tests** completed with Windows file-URL/ownership environment
settings: **40 passed, 5 failed, 0 skipped**. The five unrelated failures reproduce on unchanged main
`1069bea100b5f2586eac5c4109068b37455b72ee`:

| Existing failure | Result on unchanged base |
|---|---|
| `test-arcflash-render.mjs` | Fallback differs from the live rig pixel comparison |
| `test-hyper-run.mjs` | Keyboard repeat can resume an orientation-paused race |
| `test-platform-bridge.mjs` | Two comments containing `localStorage` trigger its scan |
| `test-spill-render.mjs` | Windows `C:` path is imported without a file URL |
| `test-spill-ui.mjs` | Same Windows file-URL issue |

They are outside this two-suit repair and remain unchanged. Docker was unavailable
despite an attempted start; validation used workspace-local Node dependencies and
bundled Python with a locally unpacked SciPy wheel. No system packages were
installed. The minimal root Dockerfile/AGENTS workflow follows the owner's
container-first requirement but could not itself be executed here.
The existing art gate emits Pillow `getdata` deprecation warnings; its checks pass.
