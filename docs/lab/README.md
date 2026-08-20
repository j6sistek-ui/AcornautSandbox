# docs/lab

Prototypes, served alongside the game but not part of it. The game imports
none of it; the only way in is two hidden
buttons at the bottom of Help, both marked delete-when-the-beta-freezes.

- `spill/` — THE SPILL, a debris-field survival mode.
- `rig/` — the rig editor, a fitting bench for heads and helmets. Reads the
  shipping `DOME` / `HELM_GLASS` values out of `draw.ts` at build time and
  hands edited ones back as text.

Design notes for both: `illustrated-src/lab/README.md`.

A third experiment, **Wormhole Run**, is NOT here: it lives in the engine
itself as a hidden FlightMode (its door is also at the bottom of Help).
Its verification suite is `illustrated-src/test-tunnel.mjs`.

Built by `node illustrated-src/build-lab.mjs`, deliberately separate from
the game's build so a prototype cannot break something close to shipping.
