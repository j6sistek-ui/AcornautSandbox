# Spill welcome / coins / reward pins — owner review

The owner authorized merging PR #185 on 5 September 2026. Integration build 182 includes the Vanguard flagship and cinematic timing changes from #186/#187; their production/beta regression checks also pass. Further playtest notes remain welcome.

- The opening launch lands at the Depot in 2.4 seconds. Pick one free first-tier system: plating, shield, thrusters or Pulse. Launch is disabled until a choice is fitted. Utilities, contracts and extra purchases remain for later Depots. Endless runs can still bring their earned starter utility.
- The opening visit counts as zero cleared waves and zero mission Depot visits. It supports save/quit before or after the free choice without renewing it. Existing later-Depot saves retain their build and economy. Both mission and endless starts use this opening; later Depots remain untimed and keep their established entrance.
- Acorn Coins replace the crystal pickup and player-facing Ore wording. These coins are run-only and distinct from permanent acorns. The internal `ore` fields, mission contract IDs and economy values stay compatible. Charged coins use a cyan ring/lightning mark and still charge Pulse.
- Depot hardpoints have four distinct colored surfaces. The yellow selection instruction is larger; the small competing instruction is removed. The status rail uses a health bar and current shields; the coin counter has its own icon. Flight HUD also shows health and a numeric shield counter.
- Implemented Star Chart rewards and non-premium selector items can be pinned to home. Pins persist in the save, show unlock progress, and link back to the appropriate selector or chart. They do not equip, purchase, claim or grant anything. Proposed reward concepts remain previews.

## Performance evidence and limits

The prior Spill renderer could draw at DPR 3 on every display refresh despite a 60 Hz simulation. Spill now caps rendering at DPR 2 and approximately 60 paints per second, retaining the fixed simulation step and input handling. Render deadlines carry across 90/120/144 Hz callbacks. The Depot ship preview paints at 30 fps, and its constructed preview state is cached with a bound of 16 builds. Other flight modes retain their resolution policy.

This reduces scheduled rendering work; it does not prove the cause of the owner's iPhone 16 Pro slowdown. Mobile Safari frame pacing, GPU cost, heat, touch feel and CSS layout still need a real-device review.

## Verification

TypeScript export, opening-choice/checkpoint tests, Spill rule/progression tests, DOM control/pin tests, 90/120/144 Hz simulation/paint checks, DPR cap, beta 260 completion seams, production/beta/sample Star Chart checks, HUD tests and native canvas render checks. Production keeps its 100 missions and all three Hyper Run barriers; beta remains the unlocked 260-mission playtest. Ordinary Spill stays endless with its wave-20 first pass.

Suggested playtest: start an expedition; inspect all four choices; choose one; save/return; launch wave 1; compare busy-wave responsiveness; visit the next Depot; pin a locked suit and inspect/unpin it from home. Confirm that coins never enter the permanent acorn wallet.
