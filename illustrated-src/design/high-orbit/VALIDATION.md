# High Orbit validation

Validated 9 September 2026 on implementation commit
`34ec38b46488d8701842070709c6fa4f14c1193e`, integrating main
`4b15f97fbdfc0e53f60f2536dfe9f64c3a3fe4dd`. ART_VER is 250;
the current production-intent/dev-stamp split from main is preserved.
Subsequent receipt-only commits do not change runtime code or artwork.

## Shipping scope

Exactly ten shipping PNG changes relative to that main: one 1024×768 atlas
and one 256×256 fallback each for Cinderforge, Groveguard, Cosmic, Sunforged
and Abyssal. Each atlas contains eleven isolated painted parts in 256px
cells. `art-src/high-orbit/shipping-hashes.json` pins all ten SHA-256 hashes.
No other character art changes relative to main, including the twelve
repairs just merged in PR #246 and the frozen reference suits.

## Passed

- Source export, lab build, TypeScript check and `git diff --check`.
- Shipping art gate: 32 groups, including the existing natural-flight
  anatomy and Eclipse-transfer regressions.
- High Orbit rig regression: 960 controller ticks per suit, repeated
  180ms taps, sustained climb, release, deep descent and invalid input.
- Every compatible helmet rendered. Complete head silhouette, including
  ears, fits its calibrated circle. Every rig uses exactly 36px at the
  192px body reference; no per-pose scale normalization.
- Every sampled neck, shoulder, elbow and knee neighborhood was fully
  covered. Largest detached antialias component: six pixels.
- Actual tail ink stayed at least 9.87px outside the registered skull circle
  at canonical size. Every tail triangle retained signed area, within
  floating-point precision, throughout all 4,800 steps.
- Maximum joint change: 1.30 degrees per 120Hz step. Body range approximately
  31 degrees; tail-tip angle ranges 59.7–69.1 degrees across profiles.
- 30/60/120fps settled poses agree within 0.7 degrees per joint. Pause,
  shield freeze, warp and stuck states hold animation.
- High Orbit motion does not consume simulation RNG. Hyper Run authority
  matches a parallel unmodified race simulation; pose is viewport-independent.
- Production and beta menu tests: existing unlock gates preserved, each
  effect exclusive to its suit, previous shop trail restored, no separate
  effect purchase, correct copy, exact atlas URLs, loader failure/retry.
- Existing helmet regression: body/helmet rendering remains covered for
  the rest of the roster. Existing natural-flight tests pass after integration.

## Browser review

Chrome review at 390×844: all five atlases loaded; natural flight, bare-head
and matching-helmet views inspected. The production loadout at the same
width shows all five new portraits at their existing earned-star gates.
The live review uses the shipping painter and continuous controller, and
`browser-review.png` was exported from those actual browser canvases.
The numerical, pose, helmet and wake contacts are adjacent to this report.

The production save used a new local test origin. Selecting a locked suit
card was blocked by automatic approval review over possible progression
changes; no unlock or purchase was performed. Read-only shelf inspection
and the isolated production/beta equip tests cover those paths instead.
The owner still decides whether the remastered style and motion meet the
desired aesthetic; these checks are not a substitute for that approval.

## Full suite and baseline

48 tests ran, zero skipped: **43 passed, five failed**. All five failures
reproduce on unchanged main `4b15f97` with the same existing tooling:

| Existing failure | Result on main and this branch |
| --- | --- |
| `test-arcflash-render.mjs` | Arcflash fallback/rig pixel equality |
| `test-hyper-run.mjs` | Keyboard repeat after orientation pause |
| `test-platform-bridge.mjs` | Scanner flags existing comment text as storage use |
| `test-spill-render.mjs` | Windows absolute path treated as a C: module URL |
| `test-spill-ui.mjs` | Same Windows module-URL problem |

These existing failures are outside the five-suit art/motion request.
Docker was attempted but its daemon pipe was unavailable. The repository's
documented fallback used existing workspace Node dependencies and bundled
Python/Pillow/NumPy/SciPy; no host system packages were installed.
