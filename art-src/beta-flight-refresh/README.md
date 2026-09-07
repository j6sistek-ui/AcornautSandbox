# Five beta flight replacements

Cinderforge, Groveguard, Cosmic, Sunforged and Abyssal replace their obsolete
tap/rig flight with eight ascent and eight descent frames each. Their beta
availability is retained. The owner requested this scoped batch on 7 Sep 2026.

The five named portrait PNGs are exact copies of the loadout artwork. Each was
the sole character reference for a separate built-in ImageGen request; the
complete prompts and 1254px generated masters are stored beside them. No old
flight frame supplies artwork. Elbows and knees bend through the new poses,
and the painted tail changes shape. No runtime limb stretching is introduced.

`landmarks-seed.json` records manually inspected eye/skull and pelvis points.
`measure-beta-flight-eyes.py` tracks the reference eye across each master,
including its scale and angle. `landmarks.json` stores those measurements.
`export-beta-flight-refresh.mjs` removes the green/magenta matte, extracts the
connected whole painting (including plume tips across nominal cell edges),
then applies one uniform scale, rotation and translation to each character.
There is no recoloring or independent bounding-box fit per frame. The skull
follows a fixed 65px arc about (122,138); its fitted radius stays constant.
Helmet angles include the painted head's own angle as well as registration.
`registration.json` records the corresponding DOME values in `draw.ts`.
Descent frame 1 is a byte-identical copy of ascent frame 1 for a clean crossing.

## Reproduce and review

Use the project's Canvas dependency and Python with Pillow, NumPy and SciPy.
`ACORNAUT_CANVAS` and `ACORNAUT_TSC` may point to local installed dependencies.

```sh
python illustrated-src/measure-beta-flight-eyes.py
node illustrated-src/export-beta-flight-refresh.mjs
node illustrated-src/export-sandbox.mjs
python illustrated-src/verify-beta-flight-refresh.py
python illustrated-src/verify-art.py
node illustrated-src/review-beta-flight-refresh.mjs
```

The eye measurement/export reproduces the checked-in PNGs. If measurements
are deliberately changed, update the matching DOME entries from registration
before building; the pixel verifier checks every fitted anchor against it.
Set `BETA_FLIGHT_FILM` to a scratch directory to render 64 preview frames.

Validation on the merged PR #215 base:

- TypeScript export and all 30 official art QA groups pass.
- 80 RGBA frames pass dimensions, connected-silhouette, fitted-anchor and fur
  continuity checks; the smallest solid-pixel margin is 18px.
- All five neutral crossings are exact; every suit has 15 unique paintings.
- 320 full-bank renders cover every pose at 54px and 190px with Clear and
  matching helmets, with the old tap/body/tail layers deliberately absent.
- 120 loadout captures use the actual game renderer. Review PNGs, pose logs,
  pixel measurements and the official QA output are in `review/`.

The official width-spread diagnostics still flag some curved/extended tail
silhouettes. Those bounds are reported, not normalized or used to rescale
individual poses. Helmet fit and skull radius are checked separately. Lighting
within the painted fur varies naturally; measured fur hue spread stays below
0.005 turns (1.8 degrees) and suit materials were visually reviewed.

The source portraits, prior five suit flight fixes, movement timing, physics
and gameplay rules are preserved. A follow-up correction to the merged helmet
work replaces the broad Clear/bubble collar cutouts with continuous painted
glass; see `art-src/helmet-glass-repair`. ART_VER 215 refreshes cached art.
