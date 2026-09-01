# THE SPILL — wave survival

An acorn mining rig let go one system over. What reached us is a front of
rock, cargo and shrapnel travelling one way: at you. No gates, no planets.
Survive the wave. The next one is harder.

The Spill is the seventh way to fly. It started as a lab prototype (a
self-contained page under `docs/lab/spill/`, retired with this promotion)
and it kept the prototype's core: the forward-only **lunge**, the graze
meter that pays for **PULSE**, the spawn-time path rejection that keeps
debris from ever colliding with debris, the telegraphed hulk, and the floor
that kills after a quarter second. Everything around that core was
replaced: an endless intensity curve became a ladder of authored waves,
instant death became a three-pip hull, acorns became **Ore** (a currency
that lives and dies inside the run), and a **Depot** opens every fifth wave
to spend it.

Owner's calls that shaped it (2026-09-01): Ore is per-run, never persistent;
waves 1–20 are authored and then endless, with every rule taught in the
wave where it first appears; the pilot flies the equipped suit and helmet;
the Depot shows three shelves, one always the hull track, on a clock of
thirty seconds for the first two visits and fifteen after, extendable for
Ore; and the beta Star Chart's level-8 missions became "clear wave N".

## Where it lives

| | |
|---|---|
| `game/spill.ts` | the rules. No canvas, no DOM, no save. Fed a dt and semantic inputs; answers with state and cues |
| `game/sim.ts` | the seam: `World.spill`, `resetRun("spill")`, `updateSpill` mirrors the pilot into `w.squirrel`, turns bursts into particles, banks `spillBest` through `die()`, settles a mission through `settleLevel()` |
| `game/draw.ts` | `drawSpillWorld` (its own deep space, the field, the pilot via the shared painter) and `drawSpillHud` |
| `game/engine.ts` | `fly("spill")`, the swipe-right lunge and the extra keys, `dispatchSpillCues` for sound, the six `spill*` engine methods the buttons and the Depot call |
| `game/standalone.ts` | the MODES row, the records entry, the LUNGE / PULSE buttons, the Depot sheet, the crash receipt |
| `game/campaign.ts` | the beta level-8 missions, the `ore` and `noHit` goals |
| `game/save.ts` | `spillBest` — the highest wave cleared. The only thing the mode ever writes |
| `test-spill.mjs` | the rules, asserted against the built module |

The shape is Hyper Run's: the authority is a module the sim steps, and the
world's squirrel is a mirror of its pilot so `drawPilot` paints the
equipped suit, helmet, dome anchor and painted flight bank without knowing
the mode exists. The one difference is horizontal: the lunge moves the
pilot, so `pilotX(w)` replaced the fixed lane wherever the trail and the
painter read it.

## The loop

```
ready card ─tap─▶ WAVE CARD (1.3s) ─▶ WAVE n (18+2n s, cap 40) ─▶ FIELD DRAINS ─▶ TALLY (2.4s)
                                                                                    │
                                     n % 5 = 0 ─▶ DEPOT (30s, 30s, then 15s) ◀──────┤
                                                        │                           │
                                                        └──────▶ next wave card ◀───┘
```

A wave is a timed spawning window. When the timer runs out spawning stops
and the wave ends the moment the last live piece has left the screen (or
six seconds later, whichever is first — a slow hulk cannot hold the tally
hostage). No kill quota: a cautious pilot and a greedy one both clear it,
and Ore is what separates them.

A hull hit inside a wave costs one pip, shoves the pilot toward the wall,
pops him away from the ground and buys 1.2 seconds of invulnerability, so a
single piece can never take two pips. The piece that hit is shattered. At
zero pips the run is over — unless a **Respawn Core** was bought, in which
case the field freezes for two seconds and the pilot re-enters whole and
golden, once.

The record is **waves cleared**: a wave counts once its field has drained,
and a clear is never taken back — a crash in the tally after it keeps it.

## The ladder

Speed and crowding climb on separate curves so the field gets faster
before it gets fuller. Every rule is taught alone the first time it
appears: the wave card names it, a two-line hint sits under the meters for
six and a half seconds, and the spawn interval opens up by a third while
the hint is on screen. After that it is just part of the escalation.

| Wave | Timer | Cap | Speed | New |
|---:|---:|---:|---:|---|
| 1–2 | 20–22s | 4–5 | 1.05–1.09× | shards and tumblers only |
| 3 | 24s | 5 | 1.14× | **SURGE** — six seconds of doubled spawns at the eight-second mark |
| 4 | 26s | 6 | 1.18× | spinners; the first hulk |
| 5 | 28s | 6 | 1.23× | **Depot** |
| 6 | 30s | 7 | 1.27× | **LOW-G** — gravity 0.7×, thrust 0.85× |
| 8 | 34s | 8 | 1.36× | **HEAVY** — gravity 1.35× |
| 10 | 38s | 9 | 1.45× | **Depot**; two hulks may share the screen from here |
| 11 | 40s | 9 | 1.50× | **CROSSWIND** — a steady push toward the wall |
| 13 | 40s | 10 | 1.59× | **BLACKOUT** — the field dims to rims and warnings |
| 15 | 40s | 11 | 1.68× | **Depot**; the rare tier joins the shelves |
| 16 | 40s | 12+2 | 1.72× | **SWARM** — spinners only, cap +2, wider arcs |
| 18 | 40s | 13 | 1.81× | **FLIP** — gravity inverts; the ceiling kills instead of the floor |
| 20 | 40s | 14 | 1.90× | **Depot**, then endless |

Endless: 40 seconds a wave, the cap creeps to 16, speed grows 2% a wave,
one rule rolled per wave from the seed (two from wave 26, never two gravity
rules). The seed makes the roll repeatable for a run and different between
runs. The full table is `LADDER` in `spill.ts`; `spillWaveSpec(n, seed)`
is the one function that reads it.

Debris speed scales with the width of the canvas (`lane()`), so a desktop
panorama is more room to read, not more seconds to react.

## Ore and the Depot

Ore spills in arcs, one Ore an acorn. Every 16–30 seconds something
drifts past alone, slower than the field: Gold Ore (pays five and hands
over three seconds of Gold), a shield ore (about one drift in five), or a
hull fragment (a third of drifts, and only while a pip is missing). Ore
also builds a combo that pays score, not Ore — the currency stays flat so
the Depot's prices mean the same thing on every run.

Every fifth wave the Depot opens: three shelves rolled from what the run
has not bought yet, weighted toward tier 1 early and tier 3 from wave 15.
The first shelf is always the hull track: a **Hull Patch** while a pip is
missing, **Plating** otherwise (Plating needs no patch first, for exactly
that reason). A shelf's next rung only appears once the rung to its left is
owned. **Reroll** costs 20 Ore and doubles each use in a visit; **+15s**
costs 25 and doubles too. The clock closes the shop on its own. Entering
the Depot restores one pip (all of them with Plating).

| Track | Tier 1 · 40–60 | Tier 2 · 90–120 | Tier 3 · 180–240 |
|---|---|---|---|
| **Shield** | Shield — eats one hit, two carried | Reactive Shield — a break shatters nearby debris | Gilded Shield — a break hands over 3s of Gold |
| **Hull** | Hull Patch — +1 pip now | Plating — four pips, full at every Depot | Regenerative Hull — +1 pip per 20s unhit |
| **Thrust** | Responsive Fuel — thrust +12%, dive snaps faster | Twin Lunge — two charges | Afterburner — a lunge shatters the shards it touches |
| **Pulse** | Fast Charge — a graze fills 16% not 11% | Wide Pulse — 240 → 320px | Chain Pulse — every 4 shattered refund a quarter meter |
| **Ore** | Magnet — Ore within 70px drifts in | Rich Vein — combo to ×12, decays slower | Salvage — shattered debris drops Ore |

Kit, outside the tree: **Respawn Core** (150, one per run), **Overshield**
(70, a shield layer for the next wave), **Stabiliser** (60, cancels the next
wave's gravity rule — the card says so), **Primed Pulse** (50, start the
next wave with a full meter).

Ore never reaches the acorn wallet or the shop. A Spill crash goes through
`die()` like every crash - the lifetime run tally and the retired XP figure
tick, `spillBest` is banked, and the wallet is untouched because
`runAcorns` is always zero here. `reviveRun` refuses a Spill crash because
the Spill sells its own extra life.

## Controls

| | |
|---|---|
| **Tap** / Space / ↑ | thrust |
| **Swipe down** / ↓ | dive |
| **Swipe right** / → / D / the LUNGE button | lunge forward, then drift back |
| **PULSE button** / P / Shift | shatter everything within reach, once the meter is full |

Tap and dive ride the engine's shared pointer path, so a flap sounds and
animates exactly as it does everywhere else. The swipe right is read before
the dive so a diagonal goes to whichever axis it mostly travelled.

## Missions

On the beta chart, level 8 of every chapter from 2 is a Spill mission:
clear wave `2 + chapter` (4 through 12), mine `25 + 8 × chapter` Ore, take
no hull damage. A mission flies a fixed ladder — the seed is the level's
ordinal — so mission 3-8 is the same test for every pilot. The finish is
the tally of the named wave; the mission ends on that win, not on the
crash that was coming eventually. `settleLevel` grades off the Spill's own
ledger, the same way it does for a Wormhole mission.

## What the test proves

`node illustrated-src/test-spill.mjs`, against the built `docs/js`:

- the ladder climbs monotonically, teaches its rules in order, rolls the
  same endless wave for the same seed, and never stacks two gravity rules;
- debris never overlaps debris, over three seeded runs to wave 3;
- the hull takes three hits and never two from one piece; a shield eats a
  hit; a Gilded break pays Gold; Gold shatters what it touches; the floor
  forgives a brush and kills a ride; the Respawn Core fires once;
- clearing counts at the drain, the fifth wave opens a thirty-second Depot
  with three shelves and the hull track in front, reroll and extension
  double, a short purse is refused, the clock closes the shop, and the tree
  is honoured (no rung without its left neighbour, no rare tier before
  wave 15, nothing owned shelved twice);
- a mission ends at its wave, and through the sim it settles the level with
  its stars;
- the seam: a spill run mirrors its pilot, routes tap and dive, banks the
  best wave, never touches the wallet, and refuses the acorn continue;
- a dodging bot clears wave 1 on at least four of six seeds (all six, as
  of this writing). That is a smoke test for "is this survivable at all",
  not a tuning instrument — its median swings run to run.

## Tuning notes, carried over from the lab so the next pass does not repeat them

- The first build was unsurvivable: an autopilot managed nine seconds.
  Intensity reached full in 75s while scaling density *and* speed, which
  multiply, and hulks lingered so long that one roll in ten still
  outnumbered every other kind on screen. Eased ramp, rare and late hulks
  capped at one (two from wave 10), a hard ceiling on concurrent pieces.
- Debris used to bounce off the top and bottom of the screen. It does not:
  a piece you had already read could come back from a direction nothing
  telegraphed.
- The lunge was far too strong at 900px/s. Now 320: about a third of the
  band end to end, slide included. Cutting it made the mode harder, so the
  ramp was eased to compensate.
- Four debris paintings (8, 12, 14, 22) are invisible against deep space.
  Out of the pool.
- Banners used to sit at 30% height, in the debris. They sit under the
  meters now, and the teaching hint sits above them.
- The floor's quarter second: a bounce off the bottom while recovering
  from a dive is one or two frames; camping is continuous. The bottom
  glows from 0.1s so the rule is visible before it is fatal.

## Known gaps

- The pal does not fly the field. Its effects are all gate-world effects
  and the Spill has none of them; drawing it without them would be a
  promise the mode cannot keep.
- The Spill's own deep space is procedural — three star layers and drifting
  nebula pools — so it borrows none of the painted skies. Deliberate: it
  should not read as one of the environments.
- Sound is the game's existing cue set mapped onto the field (a hit is the
  hull thud, a shatter the same, a wave card the section chime, the Depot
  the region swell). Nothing bespoke yet.
- A persistent Ore bank, a Star Dust tie-in and an endless-wave leaderboard
  are v2 decisions, deliberately not v1 ones.
