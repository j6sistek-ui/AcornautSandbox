# Continuous bubble helmet glass

The rear-collar cutout introduced in PR #215 erased a broad wedge of visor
glass, creating an opening across the muzzle. Narrowing the cutout still left
a bright slit. These repairs remove the obstructing ring in the artwork,
then let the existing visor translucency apply evenly across the whole pane.

Affected: Clear, Aurora, Cherry, Chrono, Comet, Ion, Lunar, Meteor and Solar.
Each original PNG was used as the sole reference for a separate built-in
ImageGen edit. Full prompts, original references and generated masters are
retained here. `illustrated-src/export-helmet-glass-repair.mjs` composites
only a feathered lower-window patch from each generated master. Every original
alpha value and every pixel outside the patch are preserved exactly, including
the external collar, shell, fittings and highlights. Generated outer shells
are not used. The corresponding nine native cutouts are removed from
`helmet-openings.ts`; the other ten cutouts retain their existing behavior.

Reproduce with the project Canvas dependency:

```sh
node illustrated-src/export-helmet-glass-repair.mjs
node illustrated-src/export-sandbox.mjs
node illustrated-src/test-helmet-openings.mjs
node illustrated-src/review-beta-flight-refresh.mjs
python illustrated-src/verify-art.py
```

The export asserts unchanged source alpha and protected pixels. The helmet
test now checks the restored glass at the former rear arc and above the lower
rim, instead of rewarding alpha-zero holes at those points. All 31 helmets
pass that check and all 30 official art QA groups pass. The five-suit runtime
review verifies all 16 poses at gameplay and preview sizes with Clear and
matching helmets. These changes do not alter suit frames or helmet fitting.
The production-body regression against main `5acb81c` passes 7,808 comparisons,
including 1,856 pixel comparisons; the nine repaints are permitted only with
the exact original reference, unchanged alpha and protected exterior pixels.
