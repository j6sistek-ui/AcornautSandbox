# Home navigation icon artwork

The owner supplied three illustrated references and requested this mapping:

| Button | Master | Subject |
| --- | --- | --- |
| Star Chart | `star-chart-holo.png` | Holographic star-system disc |
| Modes | `modes-orbit.png` | Silver rocket orbiting a blue planet |
| Launch | `launch-holo.png` | Silver rocket rising from a holographic disc |

The references contained painted checkerboards, not transparency. The built-in
image generation tool edited only background and framing, preserving the
supplied subjects, materials, perspective and lights. The first extraction pass
retained a checkerboard and was rejected. The selected second pass uses a solid
black backdrop for the game's existing `hubIcon` screen blend. These are RGB
masters, not transparent PNGs; screen blending is an intentional display rule.

Exact final prompts are in `prompts.json`. Original supplied reference files are
under `references/`. `export-receipt.json` records source/output SHA256 hashes,
dimensions and corner colors. `illustrated-src/export-home-icons.mjs` creates
the three 256px game assets during the standard export; it only resizes them.

Home uses the existing 58px icon limits (62px for Launch), backgrounds and button
frames. Loadout continues to show the player's actual suit; Acorn and Stardust
artwork, size, counters and actions are untouched. These icons do not replace
gameplay sprites, mode-picker content or any Shop item preview.
