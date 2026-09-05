# The Spill — survival expeditions

The Spill is the app's build-focused survival mode: hold a line through a
broken acorn mining rig, collect Ore, and build a ship at a Depot every five
waves. Its identity is readable flight under pressure, with decisions between
waves that change how the next sector plays.

## The loop

Launch → three-second countdown → survive a wave → drain the field → collect
12 completion Ore. Every fifth clear docks for 1.2 seconds, restores one hull
pip, then opens the Depot. Its shelves arm after 0.8 seconds to reject a
lingering flight tap. **Every Depot is untimed.** It stays open until the pilot
leaves, saves and quits, or finishes an eligible expedition.

Waves 1–20 retain the authored modifier ladder. Wave 20 completes the rig;
the pilot can finish successfully at the Depot or continue into endless waves.
After wave 20 the seed chooses modifier combinations; speed caps at 2.05×.
Wave completion depends on surviving the spawning window and drain, with no
kill quota or required weapon. The drain lasts at most six seconds.

A mission ends automatically at its target wave. Chapter 2–10 level-8 missions
now use the Spill in production as well as beta; IDs and earned star masks
remain stable. Missions use the standard starting ship and a fixed seed.

## Controls and damage

- Hold to rise, release to fall. Swipe up/down for a burst; right for a lunge.
- A swipe still works after a long hold. Only the owning pointer releases it;
  cancellation, lost capture, blur, visibility loss and resize clear the hand.
- Space / Up hold thrust; Down dives; W bursts upward; Right / D lunges.
- Simulation advances in 60 Hz steps independently of display refresh rate.
- DRIFT changes debris velocity, while pilot, warnings and floor stay in the
  same screen coordinates used by collision detection.

A short floor brush is free. Sustained contact beyond 0.25 seconds uses the
same protection sequence as debris: active invulnerability/Gold → armed echo
or charged Pulse → shield → one hull pip → Respawn Core at zero hull.
Boundary recovery moves the pilot clear and kicks it upward. It never bypasses
extra hull or shields. A shield or Pulse impact grants 0.65 seconds of recovery;
a hull hit grants 1.2 seconds. A Core returns a full hull after a two-second
freeze, with three seconds of Gold protection.

## Depot builds

The original four tracks and their flat, tier-based prices remain:

| Track | Tier I | Tier II | Tier III |
|---|---|---|---|
| Plating | 60 Ore: four hull | 110: five hull | 180: six hull |
| Thrusters | 50: stronger bursts | 100: two lunges | 170: shard-clearing Afterburner |
| Power-ups | 60: automatic impact Pulse | 110: banked echo after five seconds | 170: wide Pulse; shattered debris drops Ore |
| Shield | 35 per charge | Two carried | Canopy hardware stays fitted after spending charges |

Repair costs 30 Ore and fills missing hull. The 150 Ore Respawn Core is sold
once per run. Gold charges half a Pulse, even before the Pulse is unlocked.
The tier-II echo waits for a threat instead of firing into empty space.

Tier II unlocks a free specialization choice at any Depot:

| Track | Choice A | Choice B |
|---|---|---|
| Plating | Impact Bracing: half knockback, +0.4s recovery | Salvage Armor: every 30 mined Ore repairs a pip, at most twice per wave |
| Thrusters | Precision Jets: lunges brake vertical motion; tier-I burst strength | Wide Sweep: broader shard clearing, available at tier II |
| Power-ups | Efficient Coil: Gold charges 65% | Salvage Coil: shattered debris drops Ore at tier II, double at III |

Two utility slots create additional build choices. Purchased modules belong
to the current run; unfit and refit owned modules for free at a Depot.

| Utility | Price | Effect | Free starting utility unlock |
|---|---:|---|---:|
| Salvage Magnet | 40 | Pull nearby Ore/Gold, not hull patches | Clear wave 5 |
| Field Scanner | 35 | Earlier event warning; bright Blackout outlines | Clear wave 10 |
| Emergency Brake | 35 | Automatic floor recovery every 12s; lunge braking | Clear wave 10 |
| Reserve Capacitor | 45 | Store two Pulse charges | Clear wave 20 |

The Depot forecasts the next five waves and their modifiers/events. It offers
one optional contract for that block: mine Ore, keep a clean hull, or shatter
eight shards. Contract completion awards Ore and 500 score; a missed contract
never ends a run. Purchases and completion stipends do not count as mined Ore.

## Wave direction and readability

Four five-wave sectors progress through outer wreckage, cargo, reactor debris
and the rig core. Each wave eases in, builds pressure, crests, and releases.
Milestone waves add cargo ruptures, Gold veins, alternating convoy lanes or rig
sweeps. Events warn before release, provide an open corridor and place salvage
along it; stock ships can survive them. Ambient debris that conflicts with a
newly announced route dissipates without giving shatter rewards.

Spawn admission checks debris paths against each other and reserves a slowly
moving escape corridor at the home lane. The director enforces actor budgets
for event and ambient debris together. Screen-width scaling and a minimum
read time prevent endless speed from turning into unseen hits. Spinners,
shards and hulks have distinct motion cues. Blackout retains basic hazard
outlines; the Scanner improves them rather than making visibility mandatory.

## Art and presentation

`docs/art/spill-ship/` remains the fitted modular kit. Its canopy interiors
are opened by cached canvas masks, and explicit cockpit anchors render just
the equipped pilot's head and helmet at a readable scale. Upgraded thrusters
hide the baked-in stock nozzle. Gameplay, Depot and Loadout use one painter.
The ship remains 58 logical pixels long; its collision radius is unchanged.

`docs/art/spill-scene/depot.png` and `panorama.png` add the illustrated dock
and four sector views. They load when the mode opens; a failed image request
leaves the procedural scene and fallback ship usable. Earned signal colors
appear in the plume and utility lights. The HUD shows Ore, salvage score,
combo, hull, shields, Pulse/echo and an active contract.

## Records and suspension

Spendable Ore and purchased upgrades belong to a run. Persistent records keep
best cleared wave, best salvage score, total mined Ore, cleared waves,
contracts, completed expeditions and runs. Mastery titles/signals arrive at
waves 5, 10, 20 and 30. One earned utility may be selected before a normal run;
mission starting conditions remain fixed.

Ordinary runs autosave a versioned checkpoint at the Depot and after each
purchase/refit/contract. Save & Quit returns to the title. Resume restores the
ship, Ore, contract and RNG, and keeps the checkpoint until departure. The
checkpoint's bank ledger makes repeated dock/resume operations idempotent.
A malformed checkpoint is discarded. Mid-wave suspension is not supported;
leaving a Depot clears its checkpoint, so a later crash cannot rewind a wave.
Ore never enters the app's acorn wallet.

## Ownership and verification

| File | Responsibility |
|---|---|
| `game/spill.ts` | Pure rules, spawning, damage, checkpoints |
| `game/spill-content.ts` | Utilities, specializations, contracts, sectors and mastery |
| `game/sim.ts` | World mirror, standard mission loadout and completion seam |
| `game/engine.ts` | Inputs, fixed stepping, interruption pause, banking and resume |
| `game/save.ts` | Record migration, sanitization and idempotent bank ledger |
| `game/draw.ts`, `game/art.ts` | Shared ship painter, HUD and lazy scene art |
| `game/standalone.ts` | Preflight, Depot, results and resume UI |
| `game/campaign.ts` | Production Spill missions |

Build with TypeScript 5.9.2 using `node illustrated-src/export-sandbox.mjs`.
`ACORNAUT_TSC` can point at its `lib/tsc.js`. The export builds both production
and beta, preserving the last four cache stamps.

- `node illustrated-src/test-spill.mjs`: ladder, controls, damage, waves,
  untimed Depots, missions and six-seed opening-wave bot smoke test.
- `node illustrated-src/test-spill-progression.mjs`: build behavior, contracts,
  48 event sweeps across 320/390/1280 widths, checkpoint validation and banking.
- `node illustrated-src/test-spill-ui.mjs`: menu/input integration in happy-dom,
  including missing-art fallback. Set `ACORNAUT_HAPPY_DOM` to its module entry
  if it is not installed in local module resolution.
- `node illustrated-src/test-spill-render.mjs`: actual canvas painter across
  all 192 equipment combinations and three viewport widths. Requires
  `@napi-rs/canvas`; `ACORNAUT_CANVAS` may point at its package directory and
  `ACORNAUT_QA_OUTPUT` selects the contact-sheet output folder.

DOM tests do not certify browser layout or real-device touch feel. Validate
those on the review build before release; bot survivability is a smoke test,
not a claim that the entire economy is perfectly balanced.
