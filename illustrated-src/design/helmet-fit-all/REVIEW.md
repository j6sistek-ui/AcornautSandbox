# Complete helmet fitting review — 28 September 2026

Owner request: “evaluate every single helmet to squirrel combination and
perfect the fitment”. Base: `e416d0680bf531568ec065ac3c25984fadbc3102`.
Shipping art stamp: **295**. This is a fitting change, with the existing
paintings, flight controllers, equipment rules and boosts retained.

## What changed

The old compositor used the glass transparency circle as the helmet's size
and position. That circle includes padding and does not consistently
describe the space for a head. Some older suit sockets also included glass
padding. Those two errors could cancel on one pairing and expose ears or
make an oversized helmet on another.

`game/helmet-fit.ts` now owns a reviewed head cavity for all 30 helmets.
Game and Flight Studio call the same uniformly scaled compositor. Glass
masks remain unchanged. The fitting bench edits the cavity separately and
exports `HELMET_SEATS` values. Its old build-stamped drafts are set aside
using the existing stale-draft behavior.

Still and bank sockets were corrected on Flight, Robo, Big Booty, Seraph,
Eclipse, Cryostar and Verdant. Deep Eclipse/Cryostar/Verdant descent sockets
also move forward/up with the actual head. The nine natural-flight suits
and five High Orbit rigs retain their existing 36px skull registration.
Radii stay constant within each motion bank; the helmet follows the same
local head rotation. No per-pair exceptions or animated helmet resizing
were added. Studio also loads Clear when an imported preset names a helmet
exclusive to a different suit, matching its painter's existing fallback.

## Inventory and visual evidence

[Before / after](before-after.png) compares twelve representative pairings
with the same source painters and size. [Clear roster](clear-roster.png)
shows the head-size range. These are native Canvas renders, not browser
screenshots or regenerated character art.

The catalog contains **34 characters, 30 helmets and 570 valid pairings**:
21 wearable characters × 27 general helmets, plus the three exclusive
Leviathan/Groveguard/Sunforged pairs. [coverage.json](coverage.json) lists
every valid pair and all bank counts. Each matrix below was visually
inspected for head clearance, face visibility, collar placement and size.
Exclusive combinations are labeled instead of pretending they are wearable.

| Character | All valid helmets | Motion contact sheet |
|---|---|---|
| Flight | [matrix](flight.png) | [all frames](frames-flight.png) |
| Ion | [matrix](iontrim.png) | [all frames](frames-iontrim.png) |
| Copper | [matrix](copper.png) | [all frames](frames-copper.png) |
| Frost | [matrix](frost.png) | [all frames](frames-frost.png) |
| Void | [matrix](voidsuit.png) | [all frames](frames-voidsuit.png) |
| Ember | [matrix](ember.png) | [all frames](frames-ember.png) |
| Robo | [matrix](robo.png) | [all frames](frames-robo.png) |
| Ghost | [matrix](ghost.png) | [all frames](frames-ghost.png) |
| Big Booty | [matrix](bigbooty.png) | [all frames](frames-bigbooty.png) |
| Seraph | [matrix](seraph.png) | [all frames](frames-seraph.png) |
| Eclipse | [matrix](eclipse.png) | [all frames](frames-eclipse.png) |
| Cryostar | [matrix](cryostar.png) | [all frames](frames-cryostar.png) |
| Verdant | [matrix](verdant.png) | [all frames](frames-verdant.png) |
| Gemmie / Opal | [matrix](gemmie.png) | [all frames](frames-gemmie.png) |
| Sammie / Samurai | [matrix](sammie.png) | [all frames](frames-sammie.png) |
| Leviathan | [matrix](leviathan.png) | [all frames](frames-leviathan.png) |
| Cinderforge | [matrix](cinderforge.png) | [rig samples](frames-cinderforge.png) |
| Groveguard | [matrix](groveguard.png) | [rig samples](frames-groveguard.png) |
| Cosmic | [matrix](cosmic.png) | [rig samples](frames-cosmic.png) |
| Sunforged | [matrix](sunforged.png) | [rig samples](frames-sunforged.png) |
| Abyssal | [matrix](abyssal.png) | [rig samples](frames-abyssal.png) |

The 16 banked characters' motion sheets show **every still/ascent/descent/tap
frame with Clear**, including frames 9–16 of the longer tap banks. The five
High Orbit sheets sample Clear, Rose and the matching helmet in motion.
These were inspected after the final socket corrections. All 570 portrait
pairings were reviewed; the sheets do not claim a manual review of every
possible helmet at every continuous animation instant.

The 13 integrated appearances remain helmet-independent. Their portraits
are checked against every helmet selection. This preserves Arcflash,
AcorNut and the other models that intentionally have their own head art.
Sunforged and Groveguard's sealed matching helmets retain opaque visors.

## Repeat the review

```sh
node illustrated-src/build-lab.mjs
node illustrated-src/build-flight-studio.mjs
node illustrated-src/test-helmet-fit.mjs
node illustrated-src/review-helmet-fit.mjs illustrated-src/design/helmet-fit-all --motion
# Optional before/after: append --baseline /path/to/clean/base/checkout
```

Serve `docs/` locally and open `/lab/helmet-fit/`. The read-only page offers
all 34 characters, their valid helmet choices, moving/portrait views,
pause/scrub, light/dark backgrounds and close/game-size displays. It uses
the actual game painters and never reads or writes the player's save.
Flight Studio remains the separate offline tuning tool. The fitting bench
is `/lab/rig/`.

## Verification and limits

- Source export, lab build, Studio build and TypeScript no-emit pass.
- Art gate passes **32 groups**, with the existing local dependency
  fallback because Docker is unavailable; no host packages were installed.
- New fitting regression passes **570 pairings**, **360 pixel-identical
  game/Studio helmet comparisons**, **7,576 bank-frame/helmet renders**,
  constant bank radii and all 13 integrated-head portraits.
- Flight Studio and the 30-visor continuity regression pass. The historical
  helmet-animation regression passes after fetching its two pinned Git
  objects; its body-animation comparisons remain unchanged.
- Final full suite: **69 passed, 3 failed, 0 skipped, of 72**. All seven
  heavy checks were run. The three failures reproduce on unchanged base:
  Arcflash's exact fallback pixels (described below), Hyper Run's keyboard
  repeat resuming an orientation-paused race, and the platform scanner
  matching `localStorage` in comments at `engine.ts:316` and `save.ts:699`.
  These existing issues remain outside the fitting change; this is not a
  green-suite or CI-pass claim. `git diff --check` also passes; the project
  has no separate lint command.
- The review page's module syntax passes and its page, compositor module
  and sample helmet asset return HTTP 200 from the local server.
- Browser automation has no available Chrome or in-app browser connection.
  The desktop Chrome launch timed out waiting for app approval. Interactive
  browser playback and the required 390px screen review are **not verified**
  this run. Native contact sheets and mechanical checks are the available
  visual evidence; they do not substitute for owner aesthetic acceptance.

The export on this runtime made tiny rounding changes in ten helmet PNGs
and the Arcflash fallback (at most 3/255 per channel). Those unrelated
outputs and receipts were restored from the base, so **all shipping artwork
remains byte-identical to main**. The unchanged Arcflash fallback consequently
fails its exact-pixel comparison here: 20 of 262,144 channels, maximum delta
3. The exact same failure reproduces on the clean base. No threshold was
relaxed to hide it.

The scope is fit and registration, not repainting older character-body
artifacts. No claim of universally perfect aesthetics or zero pre-existing
art defects is made by the automated tests.
