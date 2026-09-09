# Rig repair validation

Validated 9 September 2026 against unchanged main
`5aeb37c6480e3434fe84830306d50911127e9804`. Shipping art stamp: 253.

## Scope and evidence

- Exactly six shipping PNGs changed: rig-rendered fallback portraits for
  Arcflash and all five High Orbit suits. All six part atlases and every
  other suit's art remain unchanged.
- Four reversed far boots corrected; both feet audited on all six rigs.
  Measured toe direction stays forward through four test orientations.
  Static breadth preserves both source attachment points exactly.
- 4,800 High Orbit controller ticks: head range 22.98–23.04 degrees,
  tail-tip range 84.71–97.83 degrees, maximum joint step 1.43 degrees at 120Hz.
  Every sampled joint neighborhood is covered. Minimum tail ink/skull gap
  12.74px, no folded tail triangles, no clipping at canonical size.
- Every compatible helmet is painted by the real preview. Opaque visors
  suppress the bare-head layer; transparent helmets keep the head visible.
  Skull sizes and the source paintings are unchanged.
- A 40px/s accepted tap, below the old 70px/s detector, rocks the tail by
  over 5 degrees without resetting pose/rates/time or changing boost power.
- Arcflash's existing render, motion and integration checks pass, including
  exact fallback pixels, joints, contact recovery and tail curvature.
- Flight Studio passes all 31 models, 443 art hashes, 7 rigs, deterministic
  playback, export/import, and offline-host tests with the updated painters.

## Shipping checks

Source export, lab build, Studio build, TypeScript, art gate 32 groups, and
`git diff --check` pass. No lint script exists. Docker's Linux daemon is
unavailable on this machine; used existing workspace Node/Python dependencies
under the documented fallback. No package installation.

Complete suite: **50 passed / 2 failed / 0 skipped, 52 tests**. Clean baseline:
**49 passed / 2 failed / 0 skipped, 51 tests**. Same pre-existing failures:

- `test-hyper-run.mjs`: keyboard repeat can resume an orientation-paused race
  before physical key release.
- `test-platform-bridge.mjs`: flags the word `localStorage` inside comments
  in engine.ts and save.ts. Neither flagged comment changed here.

After the final opaque-helmet composition and first-tap initialization changes,
High Orbit (including production/beta integration), helmet animation, anatomy,
Studio, builds and TypeScript checks were rerun. The two unrelated failures remain outside this art repair;
this is not a claim that the complete suite is green.

The art gate also prints existing frame-spread advisories for 14 older bank
frames and Pillow deprecation notices. None is in these six cut rigs.

## Visual review

Reviewed all 12 shin cutouts, paired before/after whole rigs at rest, tap and
descent, and the High Orbit head/helmet/boost contacts. In Chrome, all five
corrected rigs loaded with matching helmets in the shipping review page.
At 390px, the production Loadout displayed Sunforged's sealed gold helmet
and Groveguard's sealed green helmet on their suit cards. These checks used
an isolated local origin; no purchases, unlocks or user game-save edits.

The updated Studio editor and separate viewer displayed Arcflash and
Sunforged; Sunforged's selected sealed helmet was shared with the viewer.
The viewport override was reset. These are visual inspection receipts,
not owner approval of the posture. See the paired contact images in this folder.

`preservation.json` records baseline-matched hashes for every source atlas,
the complete High Orbit effect module, and Arcflash's wake/jet implementation.

The reported missing helmet in live play was not reproduced when Sunforged's
helmet was selected. Existing equipment rules retain a deliberately selected
different helmet. The definite repaired regression was the bare suit card;
helmet swapping remains available pending any request to lock the full set.
