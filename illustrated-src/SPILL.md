# THE SPILL — wave survival

An acorn mining rig let go one system over. What reached us is a front of
rock, cargo and shrapnel travelling one way: at you. No gates, no planets.
Survive the wave. The next one is harder.

The Spill is the seventh way to fly. It started as a lab prototype (a
self-contained page under `docs/lab/spill/`, retired with the promotion)
and kept the prototype's core: the forward-only **lunge**, the spawn-time
path rejection that keeps debris from ever colliding with debris, the
telegraphed hulk, and the floor that kills after a quarter second. The
first shipped pass (2026-09-01) put a ladder of authored waves, a
three-pip hull, per-run **Ore** and a **Depot** every fifth wave around
that core. The second pass (2026-09-02), from the owner's first play
session, changed what is flown and how:

- **the ship.** The pilot flies the Spill's own layered ship
  (`docs/art/spill-ship/`), sized to the squirrel's window, not the
  squirrel. Its plume is the hand's state, and its parts are the Depot's
  meters: Plating picks the hull, Thrusters the tail, Power-ups the nose
  cone, and the shield charges the canopy (one charge a visor, two a
  sealed dome). Before the kit arrived it flew Hyper Run's scout, which
  is still the fallback when the kit fails to load.
- **the hand.** Hold to rise, release to fall. A swipe up or down is an
  instant burst. Nothing tap-taps. (The first hand shipped at normal
  flight's snap and the owner could not hold a line with it; the third
  pass below made it a gentle net acceleration under the field's own,
  softer gravity, with the bursts kept as they were.)
- **no PULSE button.** The Depot's POWER-UPS meter unlocks the PULSE, and
  from then it fires *itself* at an impact when the meter is full. The
  second level fires a second pulse five seconds after the first.
- **Gold Ore charges the meter**, half each. Near misses are points only.
- **no gravity flip.** The last taught rule is DRIFT: the whole field
  tilts, slowly and continuously, and the debris arrives at that angle.
- **the ship is what you upgrade**: four fixed meters (Plating, Shield,
  Thrusters, Power-ups) at prices that climb with the level and never
  with the wave. No rolled shelves, no reroll.
- **shields come from the Depot only**, flat 35 Ore, every stop. None
  drift past in the field.
- **the intermission is predictable.** A cleared wave counts 3–2–1 with
  the ship on autopilot, and control returns on the GO and never before.
  Every fifth wave docks first (1.2s of autopilot) and the Depot's shelves
  stay inert for 0.8s after they appear, so a thumb still tapping from the
  wave buys nothing. What was bought this stop is listed on the sheet.
- spinners weave from wave 1.

Owner's calls that still stand: Ore is per-run, never persistent; waves
1–20 are authored and then endless, with every rule taught in the wave
where it first appears; the Depot clock is thirty seconds for the first
two visits and fifteen after, extendable for Ore; the beta Star Chart's
level-8 missions are "clear wave N".

## Where it lives

| | |
|---|---|
| `game/spill.ts` | the rules. No canvas, no DOM, no save. Fed a dt and semantic inputs; answers with state and cues |
| `game/sim.ts` | the seam: `World.spill`, `resetRun("spill")`, `updateSpill` mirrors the pilot into `w.squirrel`, turns bursts into particles, banks `spillBest` through `die()`, settles a mission through `settleLevel()`. `flap()` is the hand going ON, `spillRelease()` the hand coming OFF, `dive()` the burst down, `spillBurstUp()` the burst up |
| `game/draw.ts` | `drawSpillWorld` (its own deep space, the tilted field, the scout ship) and `drawSpillHud` (wave, clock, pips, the PULSE meter, the countdown, the rule chip) |
| `game/engine.ts` | `fly("spill")`; pointer down/up as hold/release; swipe up, swipe down and swipe right; `dispatchSpillCues` for sound; the four `spill*` engine methods the LUNGE button and the Depot call |
| `game/standalone.ts` | the MODES row, the records entry, the LUNGE button, the Depot sheet with its meters, the crash receipt |
| `game/campaign.ts` | the beta level-8 missions, the `ore` and `noHit` goals |
| `game/save.ts` | `spillBest` — the highest wave cleared. The only thing the mode ever writes |
| `test-spill.mjs` | the rules, asserted against the built module |

The shape is Hyper Run's: the authority is a module the sim steps, and the
world's squirrel is a mirror of its pilot so the trail, the particles and
the shake all ride the shared paths. The ship is painted by the Spill's
own `drawSpillShip` from the `art.spillShip` kit: the hull for the
Plating level, then the thruster, cone and canopy parts placed with the
transforms the owner exported from the Ship Bench
(`docs/art/spill-ship/transforms.json`, loaded as `art.spillShipFit`;
per-hull overrides win over the part's default). Parts marked *behind*
in that file paint under the hull. The hull's box is 58px long and
centred on the collision point; the cockpit opening is measured once
from the hull's top outline (the first dip that climbs back out) and the
equipped pilot is clipped into it, helmet peeking over the rim, under
whatever canopy the shield has bought. `hull-2-blue` and `cockpit-2` are
in the kit but not yet drawn by the game. The lunge moves the ship
horizontally, so `pilotX(w)` replaced the fixed lane wherever the trail
reads it.

## The loop

```
ready ─press─▶ COUNT 3·2·1 (autopilot) ─GO─▶ WAVE n (20..40s) ─▶ FIELD DRAINS ─┐
                    ▲                                                          │
                    │        n % 5 = 0 ─▶ DOCKING (1.2s) ─▶ DEPOT (30s, 30s, 15s; shelves arm after 0.8s)
                    │                                              │           │
                    └──────────────────────────────────────────────┴───────────┘
```

A wave is a timed spawning window. When the timer runs out spawning stops
and the wave ends the moment the last live piece has left the screen (or
six seconds later, whichever is first — a slow hulk cannot hold the count
hostage). No kill quota: a cautious pilot and a greedy one both clear it,
and Ore is what separates them.

The clear is announced at the drain, the hand comes off the thrust, and
the ship flies itself home for the count. The count is three seconds and
the GO is the frame the field returns. A press during the count takes the
stick from the autopilot early (the HUD says "YOU HAVE THE STICK"), and a
finger already down at the GO is a hand already on the thrust, so the
ship rises on the GO and never drops into a waiting thumb.
Every fifth wave docks first — the same autopilot, "DOCKING" for 1.2s —
then the Depot opens with one pip restored.

A hull hit inside a wave costs one pip, shoves the ship toward the wall,
pops it away from the ground and buys 1.2 seconds of invulnerability, so a
single piece can never take two pips. The piece that hit is shattered. At
zero pips the run is over — unless a **Respawn Core** was bought, in which
case the field freezes for two seconds and the ship re-enters whole and
golden, to the phase it left, once.

The record is **waves cleared**: a wave counts once its field has drained,
and a clear is never taken back.

## Controls

| | |
|---|---|
| **Hold** (finger down) / Space / ↑ | thrust: a net 720 px/s² against the field's gravity, capped at 330 px/s. A quarter second is a nudge; a full second is a climb |
| **Release** | the field's gravity (600 px/s², half of flight's) has the ship, capped at 390 px/s |
| **Swipe up** / W | burst up: an instant kick skyward |
| **Swipe down** / ↓ | burst down: the dive |
| **Swipe right** / → / D / the LUNGE button | lunge forward, then drift back |

The hold is a fixed net acceleration against gravity (`holdAccel`) and
gravity is the field's own (`SPILL.gravity`), so a line is held by
feathering the thumb: a quarter second of hold moves the ship about
twenty pixels. A burst starts past the caps and bleeds back to them
(`burstDecay`); the caps stop the hand from building speed, never a
swipe from carrying, so a hold under a burst up rides it rather than
adding to it. THRUSTERS sharpen the bursts and never touch the hold: the
owner asked for a hand that gets steadier with upgrades, not twitchier.
There is no PULSE button: see below. The press on the ready card is the launch; a
new press during the count takes the stick; a press during the dock, the
Depot or the respawn freeze is nothing, and never a queued input.

## The ladder

Speed and crowding climb on separate curves so the field gets faster
before it gets fuller. Every rule is taught alone the first time it
appears: the count names it, a two-line hint sits low under the flight
path for five seconds (the wave-1 control hint also leaves after three
inputs), and the spawn interval opens up by a third while the hint is on
screen. Every rule phases in over its wave's first three seconds
(the chip at the bottom left shows how far), so nothing snaps on the GO.

| Wave | Timer | Cap | Speed | New |
|---:|---:|---:|---:|---|
| 1–2 | 20–22s | 4–5 | 1.05–1.09× | shards, tumblers and spinners |
| 3 | 24s | 5 | 1.14× | **SURGE** — six seconds of doubled spawns at the eight-second mark |
| 4 | 26s | 6 | 1.18× | the first hulk |
| 5 | 28s | 6 | 1.23× | **Depot** |
| 6 | 30s | 7 | 1.27× | **LOW-G** — gravity 0.7× |
| 8 | 34s | 8 | 1.36× | **HEAVY** — gravity 1.35× |
| 10 | 38s | 9 | 1.45× | **Depot**; two hulks may share the screen from here |
| 11 | 40s | 9 | 1.50× | **CROSSWIND** — a steady push toward the wall |
| 13 | 40s | 10 | 1.59× | **BLACKOUT** — the field dims to rims and warnings |
| 15 | 40s | 11 | 1.68× | **Depot** |
| 16 | 40s | 12+2 | 1.72× | **SWARM** — spinners only, cap +2, wider arcs |
| 18 | 40s | 13 | 1.81× | **DRIFT** — the field tilts, wandering to a new lean every 4–7s at 0.22 rad/s; debris arrives at the tilt. This wave is the lesson and leans to 60% of the 0.38 rad limit; endless DRIFT waves lean fully |
| 20 | 40s | 14 | 1.90× | **Depot**, then endless |

Endless: 40 seconds a wave, the cap creeps to 16, speed grows 2% a wave,
one rule rolled per wave from the seed (two from wave 26, never two gravity
rules). The full table is `LADDER` in `spill.ts`; `spillWaveSpec(n, seed)`
is the one function that reads it.

Debris speed scales with the width of the canvas (`lane()`), so a desktop
panorama is more room to read, not more seconds to react.

## PULSE

The meter under the wave number. Gold Ore fills half of it; nothing else
fills it. Locked, a full meter is only a meter and the HUD says UNLOCK AT
THE DEPOT. With POWER-UPS I the ship fires the pulse *itself* at the next
impact: the piece and everything within 240px shatter and the hull is
never touched. With II a second pulse fires five seconds later on its
own (the HUD counts it). With III the reach is 320px and shattered debris
drops Ore. There is no button to miss.

## Ore and the Depot

Ore spills in arcs, one Ore an acorn. Every 10–18 seconds something drifts
past alone, slower than the field: Gold Ore (pays five, charges half a
meter) or a hull fragment (a third of drifts, and only while a pip is
missing). Ore also builds a combo that pays score, not Ore — the currency
stays flat so the Depot's prices mean the same thing on every run.

The Depot is the ship's four meters plus a flat shelf. Each meter row
shows its pips, the next level's effect and its price; a full meter says
FULL. Prices climb with the level, never with the wave.

| Meter | I | II | III |
|---|---|---|---|
| **Plating** 60 · 110 · 180 | four pips (the new pip arrives filled) | five | six |
| **Thrusters** 50 · 100 · 170 | sharper bursts (+15%) | two lunge charges | Afterburner: a lunge shatters the shards it touches |
| **Power-ups** 60 · 110 · 170 | PULSE unlocked: fires on impact when charged | double wave: a second pulse 5s later | wide pulse, and shattered debris drops Ore |
| **Shield** 35, flat | a charge that eats one hit; two carried | | |

Flat shelf: **Repair** (30, every pip back; shown only while a pip is
missing), **Respawn Core** (150, one per run), **+15s** (25, doubling each
use in a visit). The clock closes the shop on its own.

Ore never reaches the acorn wallet or the shop. A Spill crash goes through
`die()` like every crash - the lifetime run tally and the retired XP figure
tick, `spillBest` is banked, and the wallet is untouched because
`runAcorns` is always zero here. `reviveRun` refuses a Spill crash because
the Spill sells its own extra life.

## Missions

On the beta chart, level 8 of every chapter from 2 is a Spill mission:
clear wave `2 + chapter` (4 through 12), mine `25 + 8 × chapter` Ore, take
no hull damage. A mission flies a fixed ladder — the seed is the level's
ordinal — so mission 3-8 is the same test for every pilot. The finish is
the drain of the named wave; the mission ends on that win, not on the
crash that was coming eventually. `settleLevel` grades off the Spill's own
ledger, the same way it does for a Wormhole mission.

## What the test proves

`node illustrated-src/test-spill.mjs`, against the built `docs/js`:

- the ladder climbs monotonically, teaches its rules in order, ends on
  DRIFT, never flips gravity, rolls the same endless wave for the same
  seed, and never stacks two gravity rules;
- the hand: a quarter second of hold is a nudge and a second a capped
  climb, THRUSTERS III holds the same line, a release is a capped fall,
  bursts are instant, carry past the caps and only decay, THRUSTERS
  sharpen them, nothing answers outside flight;
- the count ticks 3·2·1, the GO lands on its end, the autopilot flies the
  ship home meanwhile, nothing spawns before the GO, control is back on it;
- debris never overlaps debris, over three seeded runs to wave 7, with
  spinners from wave 1 and hulks behind their warning;
- DRIFT opens level, tilts, never past its limit, never faster than its
  rate, and the debris flies the tilt;
- the hull takes three hits and never two from one piece; a shield eats a
  hit and none ever drifts past; the floor forgives a brush and kills a
  ride; the Respawn Core fires once and returns to the phase it left;
- Gold charges half a meter and a graze none; a locked full meter does
  nothing at an impact; unlocked, the impact fires the pulse instead of
  costing a pip; level II queues and fires the second pulse at five
  seconds;
- the fifth wave docks, the Depot opens after 1.2s with a pip restored and
  thirty seconds on the clock, the shelves refuse a tap while arming and
  arm audibly, each meter fills to three at its listed prices and no
  further, the shield is 35 every time, repair and the core behave, the
  extension doubles, a short purse is refused, the second and third stops
  cost the same as the first and run 30s then 15s, the clock closes the
  shop, a rule phases in over three seconds;
- a mission ends at its wave, and through the sim it settles the level with
  its stars;
- the seam: a tap launches, a tap in the count is nothing, a tap holds and
  a release lets go, dive and swipe-up are the bursts, the best wave is
  banked, the wallet is never touched, the acorn continue is refused;
- a dodging bot clears wave 1 on at least four of six seeds (all six, as
  of this writing). A smoke test for "is this survivable at all", not a
  tuning instrument.

## Tuning notes, so the next pass does not repeat them

- The first lab build was unsurvivable: an autopilot managed nine seconds.
  Intensity reached full in 75s while scaling density *and* speed, which
  multiply. Eased ramp, rare and late hulks capped at one (two from wave
  10), a hard ceiling on concurrent pieces.
- Debris does not bounce off the top and bottom of the screen: a piece you
  had already read could come back from a direction nothing telegraphed.
- The lunge was far too strong at 900px/s. Now 320.
- Four debris paintings (8, 12, 14, 22) are invisible against deep space.
  Out of the pool.
- The floor's quarter second: a bounce off the bottom while recovering
  from a dive is one or two frames; camping is continuous. The bottom
  glows from 0.1s so the rule is visible before it is fatal.
- v1's FLIP (gravity inverted on a wave) was the owner's first complaint:
  too immediate, too hard, and the chip beside the pause button was not
  enough of a warning. It is gone; DRIFT is its replacement, and every
  rule now ramps.
- v2's hand (2200 px/s² net up against flight's 1300 down, caps 460/520)
  was "very very hard to hold a line": every hold hit the cap in a fifth
  of a second and THRUSTERS made it worse. Now 720 up against the
  field's own 600 down, caps 330/390, and the upgrade never touches it.
  The swipes were "perfect" and were kept: 480 either way, past the caps.
- v1's PULSE button was unreachable while the thumb was flying the ship.
  Gone; the pulse fires itself.
- v1's rolled shelves auto-bought under a thumb still tapping from the
  wave and the "SOLD" label said nothing about what. The Depot now docks,
  arms, and lists the receipt.

## Known gaps

- The pal does not fly the field. Its effects are all gate-world effects
  and the Spill has none of them.
- The Spill's own deep space is procedural — three star layers and drifting
  nebula pools — so it borrows none of the painted skies. Deliberate.
- Sound is the game's existing cue set mapped onto the field. Nothing
  bespoke yet.
- Custom modifiers (the owner's "find a home later") have no shelf yet;
  the meters are fixed on purpose until the ship's feel is settled.
- A persistent Ore bank, a Star Dust tie-in and an endless-wave
  leaderboard are still later decisions.
- Start Shield in the loadout is a purchase, not a switch: armed stays
  armed until a run spends it (the switch let a pilot flip it off for
  nothing and pay again to flip it back).

## The owner's log (2026-09-02) — ideas, not direction

Logged after the ship kit merged (#171). Still tuning the feel and the
core mechanics; none of this is firm.

- **Depot: unlimited time, and a save.** Saving voids the leaderboard for
  that run.
- **A formal dock entrance.** Fly into the Depot instead of the phase-in.
  Reference: `docs/art/spill-ship/concepts/dock-pixel.jpg` and
  `dock-painted.jpg` (a stone gate with a swirling purple portal on a
  floating slab). Not to be tied in yet.
- **Magnetic collection.** A power-up that pulls Ore in. Either the top
  tier of an axis, or a pre-bought one-run mod paid in Star Dust; if it is
  a premium currency it is safety-gated on a minimum run of ten waves.
- **Mode experience.** Runs earn something persistent: more runs, or a
  higher base ship to start from.
- **Ranked mode.** One hit and you are dead, one upgrade per Depot, no
  other upgrades, starts at Depot 20 with no phase-in. Ranks earn custom
  season rewards. Very long-term.
- **Less repetitive over time, still a growing challenge.** Challenge
  rounds every ten waves, unique events.

Proposals to weigh against those (mine, same status):

- **A named event every fifth wave, on a rotation the seed picks.** A
  comet shower (fast, straight, telegraphed), a gold vein (Ore doubles,
  rocks triple), a dead zone (no DRIFT, the hand is all you have), a
  gravity flip (banked, since it killed on sight — only after the pilot
  has cleared ten waves, and with a full warning bar). Each one changes
  what the hand does for thirty seconds and then goes away.
- **A boss rock at every tenth Depot.** One huge tumbler that takes three
  PULSE hits and sheds Ore each time. Beating it is the challenge round;
  the Depot after it is the reward.
- **Contracts at the Depot.** Pick one of three small bets for the next
  five waves: "graze twelve rocks", "spend nothing", "take no hits". Pay
  out in Ore; the bet is what makes wave 23 feel different from wave 18.
- **A run modifier draft at the start.** Three cards, take one: more Ore
  but a smaller hull, faster field but a stronger PULSE. Ranked would
  skip this. Cheap to build on the existing modifier hooks.
- **The Star Dust magnet as a run-scoped consumable.** Fits the "safety
  gated" note: it only appears in the Depot from wave 10 on and never
  affects the leaderboard.
