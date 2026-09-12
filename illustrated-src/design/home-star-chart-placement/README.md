# Home Star Chart placement

Star Chart now sits between Loadout and Modes as a peer navigation tile. The
separate bottom banner is removed. Portrait keeps Launch above the three tiles;
landscape places all four actions in one row. The tile retains the existing
Star Chart destination, next reward, completion state, progress and guide pulse.

The owner selected proposal 2 and requested a slightly more neon green. The
tile uses `#25c58c` / `#0a6248` with a `#7af2bd` highlight and the existing gold
trim. Its original 34px gold badge and 20px star remain unchanged.

The Home Acorn and Stardust pills occupy equal grid columns with the same 34px
height. Numbers shrink together when space is limited; the existing 16px Acorn
SVG and 14px Stardust SVG retain their original sizes and artwork. The Stardust
plus remains. Shop balances, purchase behavior and player storage are unchanged.

## Implementation and verification

- Based on main `0b213438a5c489c382d76250a6222c8318b48f3c`.
- Authored changes: `game/standalone.ts`, Home CSS in `docs/index.html`, and
  `ART_VER` 277 in `game/catalog.ts`. Production, beta, lab and Flight Studio
  outputs were regenerated with the existing exporters.
- Source export, lab build, Flight Studio build, TypeScript check and
  `git diff --check` completed successfully.
- Docker was unavailable. Used existing Node dependencies and bundled Python;
  installed no packages.
- No automated tests, art gate or platform bridge checks were run for this
  cosmetic follow-up, following the owner's instruction not to rerun tests.
- Browser access was unavailable; appearance, responsive fit and interaction
  are not visually verified. Keep the PR draft for owner review.
- Generated platform-specific artwork changes were backed up and restored from
  the starting commit. `docs/art` and `art-src` have no changes. Flight Studio's
  asset hashes were refreshed after that restoration.

The generated version directory and normal oldest-version pruning are export
outputs. No new icons, marketing images or character art are part of this change.
