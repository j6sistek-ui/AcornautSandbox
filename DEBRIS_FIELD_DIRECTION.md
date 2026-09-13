# Debris Field: the realignment

Owner, 13 Sep 2026: "I want the debris field mode to become the focal point
of the game ... too much overcrowding in the flappy bird space, and the AI
generated stigma hits harder in an overpopulated field. Debris field more
unique and marketable." The 3D game (SpaceSurvival, Unreal, Steam) is a
separate product with "full feature advanced gameplay"; this document only
evaluates its scope (`GAME_SCOPE.md`, 13 Sep 2026) for **ideas** that would
enhance the 2D Debris Field, each with a proposed implementation in the
current mode. Nothing here is applied. Gameplay changes go to the owner
first, exactly, one at a time.

## Debris Field today (for the comparison)

Mode id `spill`, label DEBRIS FIELD, live on production. Files:
`illustrated-src/game/spill.ts` (rules), `spill-content.ts` (utilities,
specialties, contracts, events, mastery), `spill-workshop.ts` (Depot UI),
`spill-presentation.ts`, `SPILL.md` (design).

- **Loop.** Instructions card → START RUN docks at an opening Depot with
  one free upgrade → 3 s countdown → wave → 6 s drain → 12 Ore → next wave.
  Every 5th clear docks at an **untimed Depot**. Endless; 20 authored
  waves (`LADDER`: duration 20 to 40 s, cap 4 to 14, speed 1.05 to 1.90,
  modifiers surge / lowg / heavy / cross / blackout / swarm / drift, hulks
  0 to 2), then the seed rolls modifiers, speed capped at 2.05.
- **Hazards.** Four debris kinds (shard, tumbler, hulk, spinner). No
  debris-on-debris collisions; spawns are path-checked; a minimum read
  time keeps speed honest.
- **Damage.** 3 hull pips; shield charges (35 Ore each, carry 2); 1.2 s
  protection after a hull hit; Respawn Core (150 Ore, once) revives.
- **Ship.** Four tracks, three tiers each (plating, thrusters, pulse,
  shield), tier-II free specialization (6), two utility slots (magnet,
  scanner, brake, capacitor), repair 30, Ore is run-local.
- **Contracts.** One optional per 5-wave block: salvage N Ore, clean
  passage, break 8 shards. Reward 35 to 50 Ore and 500 score.
- **Events.** Cargo rupture (wave 5), Rig breakup (10, 20, 40 ...), then
  cargo / gold vein / convoy lanes every 5th wave. Announced, mandatory,
  with an open corridor.
- **Records.** Best wave (the banked number), best score, Ore mined,
  contracts, runs. Mastery colours at waves 5 / 10 / 20 / 30; one earned
  starter utility. Save & quit at any Depot.

## Carry-over ideas from the 3D scope

Cost: S = a constant or a content row, M = a system inside `spill.ts`,
L = new art or UI. "Both" = the idea also feeds the 3D game's design.

| # | Idea (3D scope §) | Debris Field has | Proposed implementation here | Cost | Both |
|---|---|---|---|---|---|
| A | **Survival Director** with a hidden pressure budget, so two waves at the same level feel different (§5) | fixed `LADDER` rows; past 20 only the modifier is rolled | `spillWaveSpec(n, seed)` receives a budget `B(n)` and spends it across cap, speed, hulks, spinner share and event weight with the seed; the existing read-time floor and path check are the fairness caps. Waves 1 to 5 stay authored so the lesson holds | M | yes |
| B | **Fifth-wave climax** before every station (§4, §33) | every 5th wave docks; events on 5 / 10 / 20 | name the 5th wave of every block a climax: an authored hazard (Rig breakup, Convoy, a new Storm sweep) at the wave's crest, the dock as the reward. The Depot forecast already prints the next five waves; it prints the climax name | S | yes |
| C | **Elite threats, not bosses** (§11) | hulks (2 per wave from 10) | one **Rogue hulk** per sector from wave 8: telegraphed 1.1 s like a hulk, then a lateral sweep; breaking it (tier-III pulse) drops Gold. Counts toward `spec.hulks` | M | yes |
| D | **Shield first, hull regenerates only out of danger** (§9) | shield charges; hull only at the Depot or Salvage Armor | tier-III plating: one pip regenerates after 12 s hit-free during drain or countdown, never mid-wave. Keeps the Depot the real repair | S | yes |
| E | **Critical subsystem damage**: a hard hit temporarily drops an upgraded system a tier (§9) | none | a hulk hit at tier ≥ II drops thrusters or pulse one tier for 10 s with a HUD flicker; Impact Bracing halves it. "Brutal sometimes" without a new hazard | S | yes |
| F | **Brake with heat** (§6) | swipe-down dive; Emergency Brake utility (automatic) | hold-to-brake on the dive: fall slows to 60 % while held, a heat bar fills in 1.5 s and locks the brake for 3 s. Gameplay change, owner's call | M | yes |
| G | **Dodge with no invulnerability frames** (§6) | lunge (no i-frames; tier-II lunges break shards) | already aligned. Keep it; say so in `SPILL.md` | – | – |
| H | **Risk pays**: the reliable baseline is survival, the real income is risky (§12, §15) | Ore arcs; Gold veins on the dangerous side (verify in `spawnStream`) | a **risk lane** rule: Ore streams that cross a hulk's path pay x2; graze streaks (5 in a row) pay 3 Ore. Small numbers, big feel | S | yes |
| I | **Optional events that require acceptance** (§16) | events are announced and mandatory | a **Salvage Cache** signal: a marker on the far side of the band; flying through it opens an 8 s dense pocket worth 3x Ore, ignoring it costs nothing. Uses the existing corridor code with the corridor inverted | M | yes |
| J | **Mobile depot / merchant between stations** (§19) | nothing between Depots | a **Supply drone** crosses once per block (wave 2 or 3 of the block): touch it to buy one shield charge or a repair at the Depot price, auto-deducted; it never blocks the lane | S | yes |
| K | **Modifier contracts** with declared penalties (§20) | objective contracts only | two new rows in `spillContractOffers`: "No shields for five waves, +80 Ore" and "Blackout block, +60 Ore". Same acceptance UI | S | yes |
| L | **A second ship as a playstyle, not an upgrade** (§42) | one hull, engine colours as mastery | **Scout hull** unlocked at best wave 20: +15 % burst, 2 hull pips, one extra utility slot. One colour variant of the modular kit, chosen in the Ships Loadout | L | yes |
| M | **Highest wave as the prestige number, score secondary** (§22) | banks waves; title shows the score | print BEST WAVE on the LAUNCH tile and the mode row; post waves to the portal leaderboard | S | yes |
| N | **Pilot reactions, rarely** (§8) | pilot head in the cockpit | short text pips from the cockpit on a close call, a new best, a Depot arrival, a Rogue hulk: 1 per 20 s at most | S | yes |
| O | **Teach through the first run**, prompts that disappear once learned (§32) | one instructions card before wave 1 | wave-1 prompt "tap to rise", wave-2 "swipe down to dive", wave-3 "swipe right to lunge"; the card moves behind `?`. Also what the portal's 1-click rule wants | M | yes |
| P | **Temporary buffs may drop mid-wave; utilities never do** (§14) | hull patches drop; utilities only at the Depot | two buff pickups: **Overdrive** (10 s x1.3 burst) and **Magnet field** (10 s magnet). Rare, from shattered hulks | S | yes |
| Q | **Hazard families that scale on several axes** (§25) | 4 kinds, 7 modifiers | an **Ion storm** family: blackout + cross + electrical shard variant that drains a shield charge on graze. Unlocks at wave 15 in the Director's toolkit (A) | M | yes |
| R | **One canonical mode; challenge variants later** (§30) | one endless mode; missions with fixed seeds | aligned. When variants come (Hardcore, No Shields) they are contracts (K) or a Loadout toggle, never a second ladder | – | – |
| S | **Celebration beats** (`happytime`) | none | done 13 Sep 2026: `platform.celebrate()` on a finished mission and a new best; add the wave-20 clear and the first Depot | S | – |

### Not carrying over

- **Shooting and weapons.** Debris Field's pulse is a burst, not a gun.
  Continuous fire would make it the crowded genre it is trying to leave.
- **3D stations with walking, contract boards, NPCs.** The Depot is a
  workbench sheet by design; the bear and the arrival camera already give
  it a place.
- **Camera rules, boost meter, pitch/yaw.** 2D tap flight is the identity.
- **Account XP.** Mastery colours and utility unlocks are the account
  layer; a second ladder would dilute the wave number.

### The first realignment PR (recommended order)

Six items, each one gameplay change, each communicated exactly before it
lands, with `test-spill.mjs` and `test-spill-progression.mjs` extended:

1. **O** in-flight lessons and the card behind `?` (also settles the
   portal's first-click rule).
2. **B** named climaxes on every 5th wave.
3. **K** modifier contracts.
4. **I** optional Salvage Cache signal.
5. **E** subsystem damage.
6. **A** the Director budget past wave 20 (then waves 6 to 20).

Then **L** Scout hull once art time exists.

## Priority 3: Debris Field as the default on open

Staged in three steps so nothing changes under the App Store review or
the live page until the owner says so.

**Stage 1, done 13 Sep 2026 (portal only).** The bridge gained
`defaultMode`; the CrazyGames adapter hands in `"spill"`, so the portal
build opens with DEBRIS FIELD selected and LAUNCH reads "Survive the
dangers of space". The web page and the app hand in nothing and open on
NORMAL exactly as before.

**Stage 2, after the portal ships (needs the owner's go).** The exact
change, all in `illustrated-src/game/standalone.ts`:

- `ALL_MODES`: move the `spill` row above `fly`. NORMAL becomes the
  second row, unchanged otherwise.
- `selectedMode` default stays index 0, which is now Debris Field.
- The LAUNCH tile ribbon therefore reads "DEBRIS FIELD SELECTED" on a
  fresh save; nothing else on the hub moves.
- The mode sheet header "FREE FLIGHT / Modes" becomes "MODES / Every
  way to fly".
- Persist the selection: a new `save.lastMode` (string, sanitized to a
  known id) written by the sheet's row tap and read at boot, so a pilot
  who prefers NORMAL is not re-defaulted every open.
- Tests: `test-spill-ui.mjs` (hub ribbon), `test-title.mjs` if it pins
  the first row; `verify-art.py` unaffected.

**Stage 3, with the first realignment PR.** The first-ever open runs
Debris Field wave 1 to 3 as the tutorial (idea O); the NORMAL tutorial
stays for NORMAL's first launch. The guided hub steps (Loadout → Ion suit
→ Ion helmet → Mission 1) stay as they are.

Not proposed: removing NORMAL, Hyper Run or the Star Chart. They keep the
existing players and the app's 260 missions; Debris Field leads, it does
not replace.
