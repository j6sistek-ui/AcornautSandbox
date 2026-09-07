# Clear rear collar arcs in worn helmets

The wearer could be seen through the visor, but the painted rear collar arc
was still drawn in front of the chin/muzzle. This was especially visible on
Sammie. Gemmie's opening was accepted and is unchanged.

The existing `punchedHelm` artwork compositor now clears the inside of the
rear collar using per-painting paths from `game/helmet-openings.ts`. The
outer/front collar, shell and side fittings retain their original artwork.
Source PNGs, helmet fitting coordinates, suit anchors and motion are unchanged.
This is an extension of the existing worn-visor transparency pipeline, not a
helmet redesign; empty helmet thumbnails still show their original paintings.

Affected helmets: Clear, Aurora, Cherry, Chrono, Comet, Ion, Lunar, Meteor,
Solar, Sammie, Princess, Chronarch, Phoenix, Seraph, Cryostar, Verdant, Eclipse,
Royal and Leviathan. Opaque costume visors bypass the transparency compositor.

`page-*.png` use the actual production loadout renderer, before/after at the
same time, with Sammie as the common face reference. Leviathan uses its own
exclusive suit. Gemmie is included as an unchanged control. `cutouts.png`
shows the collar masks on raw art for edge inspection; the game also applies
its existing glass translucency. These are native Canvas reviews, not a
physical-device test.

Build, then reproduce:

```
node illustrated-src/test-helmet-openings.mjs
node illustrated-src/review-helmet-openings.mjs
node illustrated-src/test-helmet-compatibility.mjs
```

The independent pixel probes in `test-helmet-openings.mjs` check all 31 source
assets: 19 rear arcs become transparent; unaffected helmets are byte-identical
in the compositor; the upper shell, side fittings and external collar outline
are preserved. `pixel-review.json` records the result for each asset.
