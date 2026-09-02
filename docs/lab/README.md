# docs/lab

Prototypes, served alongside the game but not part of it. The game imports
none of it; the only way in is the PROTOTYPES doors at the bottom of the
Modes sheet, marked delete-when-the-beta-freezes.

- `rig/` — the rig editor, a fitting bench for heads and helmets. Reads the
  shipping `DOME` / `HELM_GLASS` values out of `draw.ts` at build time and
  hands edited ones back as text.
- `skytest/` — the procedural sky bench (beta only).
- `visual-audit/` — every suit/helmet pairing on split light/dark plates.

Design notes: `illustrated-src/lab/README.md`.

Two experiments have LEFT this folder for the game itself: **Wormhole Run**
(a hidden FlightMode, verified by `illustrated-src/test-tunnel.mjs`) and
**The Spill** (`illustrated-src/game/spill.ts`, verified by
`illustrated-src/test-spill.mjs`, designed in `illustrated-src/SPILL.md`).

Built by `node illustrated-src/build-lab.mjs`, deliberately separate from
the game's build so a prototype cannot break something close to shipping.

**The Ship Bench** (`docs/lab/ship/`, source `illustrated-src/lab/ship.ts`).
A fitting bench for the Spill ship's swappable parts under
`docs/art/spill-ship/`: pick a hull, pick an axis and level, then drag,
scale and turn the part until it sits. Exports one transform per part
(offset, scale, rotation in the sprites' 256px frame), with optional
per-hull overrides, as JSON for the painter.
