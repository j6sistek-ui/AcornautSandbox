# Spill workshop artwork

Approved B workshop direction, implemented in the game through `spill-workshop.ts` and `spill-workshop.css`.

- `magnet.webp`: copper salvage magnet with cyan poles.
- `scanner.webp`: copper radar dish.
- `brake.webp`: folding emergency brake fins.
- `capacitor.webp`: twin violet Pulse battery cells.
- `workshop.webp`: UI-free salvage hangar with an empty turntable, copper scrap, indigo sky and ringed planet.

The four transparent utility illustrations were recovered from the approved interactive workshop artifact. They appear on the Depot shelf, in the guide, in starting ship selection, and at fixed mounts in the production ship painter. The existing ship, pilot and upgrade sprites remain the game's source of truth.

The background was generated with the built-in ImageGen tool from the approved reference. Prompt direction: a detailed illustrated copper salvage hangar, indigo cosmic sky with a ringed planet, warm lamps and an empty central turntable; no ship, characters, labels, text or interface. The generated 1536 × 1024 background is compressed as WebP for the game.

`export-sandbox.mjs` copies the source art into `docs/art/spill-ship/utilities/` and `docs/art/spill-scene/workshop.webp`. ART_VER 188 invalidates cached assets. These are appearance assets; collision bounds and utility behavior are unchanged.
