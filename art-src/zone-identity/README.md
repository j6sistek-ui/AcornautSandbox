# Zone identity production masters

This is the approved 26-zone art family, implemented at art stamp 252. It adds
101 planets (IDs 33–133) and 28 debris sprites (IDs 27–54). The 29 retained
planets and all 27 retained debris files keep their original bytes and IDs.
P07, P14, P17 and P32 remain available as unassigned library alternatives.

`roster.json` records the five exclusive planet IDs and two or three exclusive
debris IDs for every zone. The shipping catalog owns runtime selection;
`test-zone-families.mjs` requires it to match this roster exactly.

## Rebuild and provenance

The PNG masters were generated individually with the built-in image tool,
using the approved family briefs and existing art as references. Real alpha
is retained. `prompts.json` records all 129 initial prompts. Later material
corrections are in `refinement-prompts.json`, `gold-refinement-prompts.json`
and `final-refinement-prompts.json`, in that order. The checked-in masters
are the final selected versions, not the original concept-board crops.

Run `node illustrated-src/export-zone-art.mjs`, or the normal
`node illustrated-src/export-sandbox.mjs` pipeline. Workspace canvas is
required. Export fits each complete master into a 256×256 transparent sprite;
it does not paint or recolor backgrounds. It validates transparent area,
solid footprint and edge padding before writing numeric runtime files.
Normal export refuses to run if any of the 129 masters is missing.
`--partial` is for local work-in-progress review only, never shipping.

The exporter also writes `shipping-manifest.json` (master/output hashes,
dimensions/bounds, byte sizes and sampled colors) and the generated
`illustrated-src/game/zone-planet-colors.ts` contrast metadata. Do not edit
these outputs independently. The application build regenerates `docs/js*`.

## Review

[Production gallery and verification](../../illustrated-src/design/zone-identity-implementation/README.md)
includes every family and actual browser captures. Rebuild the family gallery
with `node illustrated-src/review-zone-identity.mjs`. The initial approved
proposal remains under `illustrated-src/design/zone-identity-proposal` as a
historical record. No background artwork, mission contract or reward changed.
