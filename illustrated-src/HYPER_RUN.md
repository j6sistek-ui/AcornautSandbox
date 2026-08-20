# Hyper Run — Prototype Chapter 1 design plan

**Status:** Phase 1 approved with the 2026-08-20 revision below. Phase 2 art is authorized. Phase 3 implementation remains blocked until separate art sign-off.

**2026-08-20 approval revision:** Move the proof of concept from proposed campaign level `2-6` to a beta-only experimental Log card named **PROTOTYPE CHAPTER 1**; keep `race` data-driven so several mechanically different events can be placed in later campaign chapters; confirm hold-to-rise/release-to-fall for both regimes; repair the GitHub copy's damaged UTF-8 characters (`×`, `≤`, and `²`); and replace the unexplained return clamp with `canonicalMinTunnelHalf + PHYS.squirrelR / 2 = max(72, min(88, 640 × 0.15)) + 16 / 2 = 88 + 8 = 96`, giving the derived canonical range `96…(640 - 96) = 96…544`.

## Product promise

Hyper Run is a beta-only, fixed-course time-trial mission. The pilot threads ring gates to build speed and charge, punches through short hyperspeed corridors, returns to the same course farther ahead, and races to a finish line. Finish time alone determines the three-star grade. Acorns are a separate secondary record for pilots who can preserve a fast line while collecting them.

The proof of concept is an experimental Log mission named **PROTOTYPE CHAPTER 1**, not a numbered chapter level. It introduces one reusable mission base, `race`, backed by event data. That base is designed so later, mechanically different race events can be placed throughout the campaign without creating a separate campaign or a new main-menu mode. It is not an endless mode and does not replace the existing `tunnel` missions.

## Prototype Chapter 1 scope

### Ships in Prototype Chapter 1

- One beta-only experimental card in the Log named **PROTOTYPE CHAPTER 1**. It launches directly from the Log and does not occupy, replace, unlock, or contribute stars to any numbered campaign chapter.
- One `race` mission base added to the existing `FlightBase` union and launched through the existing mission-run route. The Log card supplies an experimental mission definition instead of a numbered `LEVELS` entry.
- One fixed 36,000-unit course with normal-space and hyperspeed stretches, 22 authored ring placements, 14 authored debris placements, and a maximum of three wormhole cycles.
- A race-state payload inside the existing `World`, while `World.flight` continues to select the existing `fly` or `tunnel` simulation and renderer during each stretch.
- Time goals evaluated by the existing goal and level-result path. Prototype stars are a run grade only; campaign star masks, totals, unlocks, and rewards are not changed.
- A prototype race result-sheet variant in the existing level-complete overlay.
- A deterministic replay test extending the pattern in `illustrated-src/test-tunnel.mjs`.
- The approved ring, entry, and return-portal art set, mirrored into `docs/art/hyper-run/` and `sandbox_assets/art/hyper-run/` in Phase 2.

### Explicitly out until later courses

- A main-menu Hyper Run mode, course browser, cup, season, daily seed, ghost pilot, online leaderboard, or share code.
- More events, procedural courses, randomized layouts, branching routes, shortcuts, laps, reverse courses, difficulty selection, or cross-course progression. Later campaign race events are an intended extension, not part of the prototype.
- New power-ups, pals, loadout effects, shields, modifiers, currencies, or acorn-to-time conversion.
- Split-time UI, ring-combo scoring, trick scoring, medals beyond the existing three stars, or a full telemetry screen.
- A new physics engine or a duplicate campaign/save/result pipeline.
- Changes to live mission data, `LEVELS`, chapter composition, campaign star totals, or unlock thresholds. The experimental Log card exists only while `IS_BETA` is true.

### Existing systems reused versus new

| Concern | Reused | New for Hyper Run |
| --- | --- | --- |
| Mission placement and launch | Existing Log screen, `IS_BETA`, and mission launch plumbing | One beta-only **PROTOTYPE CHAPTER 1** Log card; `race` base; a prototype event record |
| Run lifecycle and results | `resetRun`, goal evaluation, `settleLevel`, and level-complete overlay | An experimental flag suppresses campaign star banking/unlocks while preserving the shared lifecycle; race time/acorn records remain prototype-local |
| Normal-space host | `sim.ts` world clock, pilot, gravity, collision helpers, illustrated renderer | Authored race objects, ring state, race speed/charge rules, nonlethal race penalties |
| Hyperspeed host | Existing `tunnel` corridor geometry, seeded noise, bounds, pickups, renderer | Finite race stretch, race controls, nonlethal race collision behavior, return handoff |
| UI | Existing HUD and level-complete sheet | Race timer/meter HUD and time-first result rows |
| Replay testing | Fixed `1 / 60` input replay pattern in `test-tunnel.mjs` | Canonical race step, press/release events, finish-tick and acorn assertions |
| Art loading/drawing | Existing art bank and Canvas 2D draw path | Painted gate/portal layers and their engine-driven animation |

`ART_VER`, `SAVE_KEY`, and `LEGACY_KEYS` remain unchanged. Generated files under `docs/js*` and `sandbox_assets/js*` are maintainer-owned and are not part of this work.

## Course and mission data

The prototype is one named event record rather than scattered conditionals. The intended reusable shape is:

```ts
type RaceCourseDef = {
  id: "prototype-chapter-1";
  displayName: "PROTOTYPE CHAPTER 1";
  seed: number;
  length: number;
  maxWormholes: number;
  tunnelDistance: number;
  ringPlacements: readonly RaceRingDef[];
  debrisPlacements: readonly RaceDebrisDef[];
  acornPlacements: readonly RaceAcornDef[];
  starTicks: readonly [number, number]; // 2-star, 3-star limits
};
```

Prototype Chapter 1 uses seed `0x48595231` (`HYR1`), a canonical 360 × 640 physics space, length 36,000 course units, and at most three wormhole entries. The experimental mission has these goals, in existing star-bit order:

1. `{ kind: "finish" }` — finish the fixed course; any finish earns one star.
2. `{ kind: "time", ticks: 10_200 }` — finish in 2:50.000 or faster for two stars.
3. `{ kind: "time", ticks: 8_700 }` — finish in 2:25.000 or faster for three stars.

The time goals are monotonic, so a three-star run necessarily satisfies the two-star goal in the same run. In the prototype, these stars are displayed as the run grade but are not added to campaign star masks or totals. Acorns never participate in a star goal.

The reusable `race` base must take an event id rather than checking for Prototype Chapter 1 by name. A future campaign level can reference any `RaceCourseDef`, use the same mechanics/result contract, and opt into normal campaign star banking. Future race events may provide different layouts, seeds, ring/debris counts, time thresholds, palettes, or regime ratios without adding another flight base.

## Mechanical specification

### Locked prototype constants

| Rule | Prototype Chapter 1 value |
| --- | ---: |
| Canonical simulation | 360 × 640 at 60 fixed steps/second |
| Course length | 36,000 course units |
| Normal-space base speed | 185 units/second |
| Ring speed gain | +22 units/second immediately |
| Normal-space speed cap | 275 units/second |
| Speed decay | 4 units/second toward 185 after 1.50 seconds without a ring hit |
| Charge meter | 0–100; +20 per ring; five clean rings from empty |
| Passive charge drain | None |
| Debris penalty | Speed to 185, charge −20, 0.75 seconds collision grace |
| Wormhole entry | 1.20 seconds, included in finish time |
| Hyperspeed stretch | 3,600 course units in 9.00 seconds (400 units/second) |
| Return sequence | 0.60 seconds, included in finish time |
| Return speed | 225 units/second |
| Expected good-run cycles | 3; prototype maximum is 3 |
| Star targets | Finish = 1; ≤2:50.000 = 2; ≤2:25.000 = 3 |

All time values above advance on race simulation ticks. Opening countdown and pause time do not count. Entry and return sequences do count because they occur after the start line and are identical for every run.

### Race state machine

1. **Ready:** Existing mission card and launch path. A three-beat visual countdown may be shown, but the timer and physics remain stopped.
2. **Normal race:** `World.flight === "fly"`; authored ring, debris, and acorn data scroll through the existing illustrated flight host.
3. **Entry:** Charge reaches 100 on a ring hit. Player input and collisions lock for 1.20 seconds while the gate becomes the wormhole mouth. Race time continues.
4. **Hyperspeed:** `World.flight === "tunnel"`; the finite seeded corridor advances exactly 3,600 course units over 9.00 seconds.
5. **Return:** An unavoidable arrival portal fills the corridor, plays for 0.60 seconds, and hands the pilot back to normal space. Race time continues.
6. **Finish:** Crossing course position 36,000 calls the existing `settleLevel(..., true)` path once and opens the existing level-complete overlay with race fields.

There is no nested `resetRun` at a handoff. `World.race` owns the course cursor, timer, charge, cycle count, object-state ledger, and recordable inputs across all regimes; `World.flight` only chooses the active existing host.

### Normal-space race flight

Normal stretches use the normal illustrated engine for world movement, pilot rendering, gravity, particles, sound routing, and collision helpers. They do not use endless `spawnPair` randomness. Course data instantiates only the authored race rings, debris, and acorns far enough ahead of the camera.

Prototype Chapter 1 has three charging legs followed by a final dash:

| Leg | Good-line normal distance | Rings authored | Debris authored | Expected outcome |
| --- | ---: | ---: | ---: | --- |
| Launch slalom | 5,200 | 6 | 2 | Hit the first five; the sixth is a recovery ring after one miss |
| Crosswind slalom | 5,200 | 6 | 3 | Second charge and entry |
| Needle slalom | 5,200 | 6 | 4 | Third charge and entry |
| Final dash | 9,600 | 4 | 5 | Four-ring precision finish; not enough charge for a fourth entry |

On the intended line, each of the first three 5,200-unit legs is followed by a 3,600-unit hyperspeed stretch. The good line therefore covers 25,200 units in normal space and 10,800 units in hyperspeed. A delayed recovery-ring entry moves the exit forward by the same 3,600 units; course data guarantees at least 900 units of clear read time before the next required ring.

### Ring gates

Each gate is a non-solid timing plane with a circular aperture. At canonical size it draws at 160 pixels outer diameter with a 54-pixel inner radius. A hit is registered when the swept pilot segment crosses the gate plane during a simulation step and the pilot circle fits through the aperture: center separation from the ring center must be at most `54 - 16 = 38` pixels. Swept detection prevents a high-speed ring from being skipped between ticks.

The ring rim never collides with the pilot. That is required by the miss rule: crossing outside the aperture is a miss, not debris damage.

- **Hit:** Mark the gate `passed`; add 22 speed immediately, capped at 275; add 20 charge; restart the 1.50-second speed-decay grace; play a gold/green pulse and a short positive chime.
- **Miss:** Mark the gate `missed`; add no speed and no charge. There is no speed subtraction, meter subtraction, time addition, bounce, or damage. The player-visible cost is the absent acceleration, the absent meter segment, and a dim missed-state afterimage.
- **One decision only:** A gate becomes passed or missed on its first plane crossing and cannot be farmed by moving backward or resizing.

### Speed and charge meter

The HUD has one horizontal **HYPER** meter with five visible 20-point cells. The numeric race speed is not shown; the exhaust length, star streaks, and the meter's outer glow communicate current speed.

- Only a ring hit fills charge. Acorns, near misses, time alive, and holding the control do not.
- Charge does not drain with time. This keeps a single missed ring at exactly the stated opportunity cost rather than adding a hidden decay penalty.
- Speed and charge are related but separate: speed decays after its grace period; stored charge remains.
- Debris subtracts exactly one cell (20 points). It cannot take the meter below zero.
- At 100, the meter locks full, the triggering ring becomes the entry mouth, and the 1.20-second entry begins immediately.
- Entry consumes all 100 charge. Return begins at zero charge and 225 speed.
- After the third return, the meter remains active for visible ring feedback and speed gain, but the prototype's four remaining rings cannot fill it from empty.

### Wormhole entry handoff

The entry is a fixed, gameplay-timed showpiece:

| Time | Mechanical and visible event |
| --- | --- |
| 0.00–0.30 s | Triggering ring locks `passed`; glyphs ignite outward; meter locks at 100. |
| 0.30–0.78 s | Ring expands to 1.25×, rear aperture darkens into a painted mouth, space streaks bend inward. |
| 0.78–1.20 s | Pilot is pulled to the aperture center; normal objects stop participating; tunnel layers overtake the screen. |
| 1.20 s | Set `World.flight` to `tunnel`, consume charge, initialize the finite corridor with the prototype seed plus cycle index, and unlock race controls. |

The transition stores the pilot's normalized vertical position. It does not roll new randomness, award course distance, or change acorns. Collision and input are disabled only during the 1.20-second cinematic; the fixed cost is included in finish time for every cycle.

### Hyperspeed stretch

The existing tunnel host supplies seeded corridor nodes, wall bounds, region-layer rendering, and pickup collision. Prototype Chapter 1 configures it as a finite race stretch rather than a standalone Wormhole mission:

- Scroll and course progress are a fixed 400 units/second for 540 simulation ticks.
- Every stretch advances the course cursor exactly 3,600 units.
- Each stretch has exactly 20 collectible acorns on a seeded, replayable line. There are 12 authored acorns in normal space, making 72 the prototype maximum on a three-cycle run.
- Acorns change only `runAcorns`; they do not affect speed, charge, time, or stars.
- Standalone Wormhole Flow, multiplier, milestone banners, Freeze Acorns, and lethal debris are disabled for `race`. Those systems remain unchanged in ordinary `tunnel` missions.
- Tunnel-wall contact is nonlethal in `race`: clamp the pilot circle inside the wall, set vertical velocity to zero, and suppress collection for 0.25 seconds. It does not alter the fixed tunnel travel time. The visible scrape and lost acorn line are the penalty.

This preserves a meaningful acorn line inside the tunnel without allowing a tunnel collision to end a time-trial run or introduce variable distance.

### Return portal and handoff

The stretch ends when its 540th tick exposes an unavoidable return portal spanning the safe corridor. Crossing it starts the 0.60-second arrival sequence; it is not a pickup the pilot can miss.

At the end of the sequence:

- Set `World.flight` back to `fly` without resetting `World.race` or `runAcorns`.
- Re-enter at the course coordinate exactly 3,600 units after entry.
- Put the pilot at the same canonical vertical position reached in the tunnel, clamped to `y = returnMargin…(640 - returnMargin)`, with vertical velocity zero. The margin is derived from existing canonical geometry, not a free constant: `canonicalMinTunnelHalf = max(72, min(88, 640 × 0.15)) = 88`; `PHYS.squirrelR / 2 = 16 / 2 = 8`; therefore `returnMargin = 88 + 8 = 96`, and the lower bound is `640 - 96 = 544`.
- Set normal-space speed to 225 and charge to zero.
- Grant 0.35 seconds of collision grace.
- Place the next required ring at least 900 course units ahead, giving at least 3.3 seconds of read time even at the 275 speed cap.

A good Prototype Chapter 1 run is expected to make three complete entry/tunnel/return cycles. A passive line makes zero; an average line is expected to make two.

### Debris

Debris exists in normal-space stretches only in Prototype Chapter 1 and reuses the illustrated debris art/circle collision helper. A swept-circle test is required at race speed.

On contact:

1. Set normal speed immediately to 185.
2. Subtract 20 charge, clamped at zero.
3. Grant 0.75 seconds during which further debris cannot retrigger the penalty.
4. Play a brief screen shake, sparks, a low speed-down cue, and one-cell meter shatter if charge was removed.

There is no death, run failure, time surcharge, rewind, forced lane, acorn loss, shield interaction, or loadout interaction. The time loss comes only from rebuilding speed and, potentially, needing one more ring to open the next wormhole.

### Controls

**Decision: hold to rise, release to fall across both Hyper Run regimes.** This is mode-local to `race`; all existing `fly` and `tunnel` controls remain unchanged.

At canonical scale:

- Released acceleration: `+1,050 px/s²` downward.
- Held thrust: `−1,750 px/s²`, for `−700 px/s²` net upward acceleration.
- Vertical velocity clamp: `−330…+390 px/s`.
- Pointer/key down and up are quantized to the next race simulation tick and stored as replayable state transitions.
- Pointer cancel, focus loss, pause, or visibility loss forces release so a backgrounded phone cannot retain thrust.

Hold control is chosen over the tunnel's current tap impulse because the player crosses two visual regimes at high horizontal speed. One continuous control contract removes the handoff tax, supports small correction pulses without burst tapping, and makes press/release timing directly replayable. It does not reduce the course to holding a button: ring centers alternate above and below the neutral arc, long holds overshoot the 76-pixel valid gate band, and the optimized route requires early releases and short re-engagements. A first-entry overlay shows **HOLD TO RISE · RELEASE TO FALL** for 1.2 seconds as part of the already-timed entry sequence; it appears only on the pilot's first Prototype Chapter 1 run and does not pause the race.

## Time model, star thresholds, and benchmarks

Finish time is the integer number of active race ticks from the first live physics tick after countdown to the tick on which the finish plane is crossed, divided by 60 for display. Pause time and pre-run countdown are excluded. Entry, tunnel, and return ticks are included. The result shows milliseconds, but the stored authority is `finishTicks`.

### Target profiles

| Profile | Measurable input/result | Target finish | Stars |
| --- | --- | ---: | ---: |
| Passive line | Uses enough vertical control to stay on course, intentionally hits 0 rings, enters 0 wormholes, stays near 185 speed | about 3:15 (195 s) | 1 |
| Average line | Hits about 12–15 visible rings, enters 2 wormholes, takes 0–2 debris resets | about 2:45 (165 s) | 2 |
| Optimized line | Hits all 19 rings visible on the good route, enters 3 wormholes at the fifth ring of each charging leg, hits no debris | about 2:19–2:22 (139–142 s) | 3 |

The passive-to-optimized spread is 53–56 seconds, clearing the requested approximately 45-second separation. The 2:50 threshold gives the average target roughly five seconds of execution margin. The 2:25 threshold gives the optimized target roughly three to six seconds of margin while still requiring all three early entries.

These are acceptance targets, not numbers to silently retune by feel. Phase 3 instrumentation must replay the three named input scripts and report their ring hits, cycle count, debris hits, mean normal speed, and finish ticks. If the profile is outside its band, change course data or the constants in this document through review before changing star thresholds.

### Skill ceiling

Mastery is a repeatable 19-ring line with three fifth-ring entries, no debris contacts, and press/release transitions that also intersect the tunnel acorn arcs. The challenge comes from preserving the speed stack: each ring is only a 76-pixel center band, gate height changes force reversals, speed shortens the correction window, and an early hold that catches one ring can make the next lower ring harder.

The course rewards precision rather than button duration because:

- A constant hold rises into the boundary and misses the next low ring.
- A constant release falls away from the next high ring.
- Missing a gate loses both its +22 speed and one-fifth of the next wormhole, compounding into a measurable finish-time loss without an arbitrary time penalty.
- The sixth ring in each charging leg permits recovery, but entering there costs normal-flight time and moves the return point later.
- The fastest tunnel line and the richest acorn line are the same authored curve where practical; the last few acorns require tighter release timing but never change star time.

## Scoring, records, and result sheet

Stars are determined only from finish time:

- 1 star: finish Prototype Chapter 1.
- 2 stars: finish at or below 10,200 ticks / 2:50.000.
- 3 stars: finish at or below 8,700 ticks / 2:25.000.

Acorns are the secondary record. They never break a star threshold, subtract time, fill charge, or alter speed. Save data gains a backward-compatible optional prototype record under the existing save object, without changing `SAVE_KEY` or legacy keys:

```ts
experimentalRaceRecords?: Record<string, {
  bestFinishTicks: number;
  bestAcorns: number;
}>;
```

Fastest time and highest acorn count update independently. A run can set either, both, or neither record. Equal finish ticks are the same time record; acorns do not act as a hidden time tiebreaker.

The Prototype Chapter 1 result sheet contains exactly:

1. `EXPERIMENTAL MISSION` kicker.
2. `PROTOTYPE CHAPTER 1` event name.
3. `FINISH` heading.
4. Finish time in `M:SS.mmm` derived from ticks.
5. `NEW BEST` when the run lowers `bestFinishTicks`; otherwise the delta behind best, such as `+4.217`.
6. Three star pips and the labels `FINISH`, `≤ 2:50.000`, `≤ 2:25.000`.
7. `ACORNS  n / 72` and `BEST  n / 72`; `NEW ACORN BEST` when applicable.
8. `PROTOTYPE GRADE — CAMPAIGN STARS UNCHANGED` disclosure.
9. Navigation actions: `RUN AGAIN` and `BACK TO LOG`.

Prototype Chapter 1 does not show score, Flow, ring count, cycle count, debris hits, per-leg splits, campaign unlock notices, or a leaderboard on the result sheet.

## Determinism: hard requirement

Prototype Chapter 1 is the same race for every pilot on every run. Two replays with the same ordered press/release ticks must produce bit-identical `finishTicks` and `runAcorns`.

Required implementation rules:

- Simulate `race` at an accumulator-driven fixed `1 / 60` step. Rendering may interpolate and may drop frames; race physics may not use the render delta.
- Run race physics in canonical 360 × 640 coordinates and scale only at draw/input boundaries. Phone aspect ratio, canvas resize, and device pixel ratio cannot change collisions or timing.
- Use the prototype seed plus the wormhole cycle index for all gameplay layout. Do not call `Math.random()` for ring, debris, acorn, corridor, or collision state.
- Keep decorative randomness outside authoritative state. Particle count, draw jitter, and audio timing cannot feed back into physics or replay results.
- Store input as `{ tick, held }` transitions. A replay consumes transitions before that tick's physics update.
- Store time as integer ticks and derive display text afterward; do not accumulate floating-point wall-clock milliseconds for records.
- Pause, focus loss, and resize may stop or rescale presentation but cannot advance the race or modify course state.

Phase 3 extends the existing tunnel replay test with these mandatory cases:

1. Same seed + same inputs twice => identical finish tick, acorn count, ring-state ledger, debris contacts, and cycle entry ticks.
2. The same replay rendered at 360 × 640 and at a tall-phone presentation size => identical authoritative result.
3. Variable render cadence (60, 30, and a mixed cadence with dropped frames) driving the same fixed steps => identical result.
4. A scripted passive, average, and optimized replay lands in the benchmark bands above.
5. Swept gate/debris collisions give the same answer at the 185 and 275 normal speed bounds.
6. A return handoff advances exactly 3,600 course units, resets charge, sets speed to 225, and never double-settles the level.

Any mismatch in finish ticks or acorns is a release blocker for Prototype Chapter 1.

## Art plan for Phase 2

The supplied image is non-authoritative concept art, not a design direction, target, or required source of visual cues. Phase 2 may use it as loose context or ignore it completely. No geometry, character treatment, glyph language, palette, lighting, material, composition, or ornament density is to be inferred from that image as a requirement. The written brief and the approved statements in this document are the authority: the gate family must be original, readable at phone scale, dimensional, and style-matched to the painted material, edge lighting, and color richness in `docs/art/planets/` and `docs/art/solo/`.

All deliverable art is PNG, RGBA, transparent, with no baked background. Gate and portal plates are 256 × 256. Entry showpiece layers may be 512 × 512. Phase 2 mirrors byte-identical files into both art roots and includes a contact sheet for review; no art is wired into code before sign-off.

### Ring gate set

| Asset | Size | Visual read |
| --- | ---: | --- |
| `gate-idle.png` | 256² | Dim violet/cyan inner energy; readable carved structure and restrained dormant glyphs; open center remains transparent. |
| `gate-passed.png` | 256² | Same exact silhouette/alignment; gold-green glyph ignition, brighter inner edge, outward energy sparks. |
| `gate-missed.png` | 256² | Same exact silhouette/alignment; cooled slate/violet metal, interrupted glyph light, faint receding afterimage. No red failure explosion. |

The collision aperture is authored consistently across all three states. State changes are a 450 ms passed crossfade or 650 ms missed crossfade; drawing scale and collision geometry do not change after the decision.

### Wormhole-entry showpiece

Use painted layers animated by the engine, not a long baked frame sequence:

| Layer | Size | Role |
| --- | ---: | --- |
| `entry-rim-back.png` | 512² | Rear structure and depth shadow; scales forward with the mouth. |
| `entry-mouth.png` | 512² | Luminous/dark aperture with painted depth; opacity and radial scale animate. |
| `entry-glyphs.png` | 512² | Separate glyph band for controlled rotation, bloom, and color ramp. |
| `entry-rim-front.png` | 512² | Foreground rim/occlusion so the pilot can visibly pass behind the front lip. |

Canvas layers provide a smooth 1.20-second sequence at arbitrary refresh rates, preserve parallax and pilot occlusion, let reduced-quality devices lower particles without changing the core art, and avoid loading dozens of 512² frames. The only engine-generated elements are transforms, opacity, bloom, streaks, and particles; the portal's material, glyphs, and depth are painted.

### Return portal

| Asset | Size | Visual read |
| --- | ---: | --- |
| `return-back.png` | 256² | Rear bowl and outward energy rays. |
| `return-glyphs.png` | 256² | Gold/green arrival glyphs rotating opposite the entry band. |
| `return-front.png` | 256² | Bright foreground lip that opens toward normal space. |

The return portal is the same architectural family but reads as arrival: warmer gold/green reward palette, outward flow, a bright visible destination, and glyphs unwinding rather than collapsing inward. It replaces the current procedural one-color swirl for Hyper Run only; existing portal rendering remains untouched elsewhere.

### Phase 2 contact sheet and checks

The contact sheet shows idle/passed/missed at 1× and game-size reduction, the four entry layers separately and composited at four timestamps, and the return portal separately and composited. Review checks: transparent edges, shared centers, aperture consistency, 360 × 640 gameplay readability, no state silhouette pop, palette contrast over representative dark skies, and exact mirrored-file hashes between art roots.

## Performance target

The entry sequence and hyperspeed stretch must sustain a 60 Hz presentation on a Pixel 6a / Galaxy A54-class mid-range phone in current mobile Chrome, at the device's normal CSS viewport and device-pixel-ratio canvas cap.

Acceptance numbers for a 30-second capture covering entry, tunnel, and return:

- Median frame time ≤16.7 ms.
- 95th percentile frame time ≤18.0 ms.
- 99th percentile frame time ≤25.0 ms.
- No more than two frames above 33 ms per complete entry/tunnel/return cycle after warm-up.
- No texture allocation or image decode during the live entry sequence; all seven Hyper Run layer assets are loaded before `TAKE FLIGHT` enables.
- At most four 512² painted layers, three 256² return layers, and one gate-state trio resident; particles are pooled and capped at 120 live items.
- Canvas backing resolution is capped at 2× CSS pixels for this mode. Reducing particle count or bloom resolution is allowed; reducing physics rate, collision fidelity, or authoritative timing is not.

The performance capture and device/browser details are Phase 3 evidence. Desktop FPS alone does not satisfy this target.

## Phase 3 source-change boundaries

After both approvals, implementation should be limited to source and tests in these areas:

- `illustrated-src/game/campaign.ts`: reusable `race` base and time goal; no numbered-level substitution.
- `illustrated-src/game/sim.ts` or a focused race module called by it: race state, fixed mechanics, handoffs, collision rules.
- `illustrated-src/game/engine.ts`: fixed-step race accumulator and held-input transitions.
- `illustrated-src/game/draw.ts` and `art.ts`: race HUD and approved layered art.
- `illustrated-src/game/standalone.ts`: beta-only **PROTOTYPE CHAPTER 1** Log card plus prototype result copy using the existing mission sheet.
- Existing save type/source only for optional `experimentalRaceRecords`; no save-key or legacy-key changes and no effect on campaign star totals.
- The existing replay-test area for determinism and benchmark scripts.

Do not run or edit build outputs. Do not change `ART_VER`, `SAVE_KEY`, or `LEGACY_KEYS`. Do not commit generated `docs/js*` or `sandbox_assets/js*`. The maintainer builds and versions on merge.

## Decisions and deviations from the starting concept

1. **Experimental Log mission, not a chapter slot or mode:** The proof of concept is **PROTOTYPE CHAPTER 1** in the beta Log. It does not alter `LEVELS` or campaign progression. The reusable `race` base is deliberately data-driven so several different race events can be added to later campaign chapters after the prototype proves the mechanics.
2. **Hold control instead of tap impulse:** One hold/release contract spans both regimes. This is easier to read at race speed and produces precise replayable transitions; the change is gated to `race`.
3. **Charge does not passively drain:** A miss already costs speed and charge opportunity. Hidden meter decay would make the stated “nothing but lost speed” miss rule untrue in practice.
4. **Acorns do not charge the wormhole:** They remain a clean secondary record, so star time and entry timing are not distorted by collection scoring.
5. **Finite, fixed-time tunnel:** Each tunnel always covers 3,600 units in 9.00 seconds. This makes distance savings legible and keeps replay timing independent of render performance.
6. **No lethal race collisions:** Normal debris resets speed/charge; tunnel walls cost the acorn line. A time trial should resolve to a finish time, and the prototype's passive benchmark must remain measurable.
7. **Three-cycle maximum:** Three charging legs followed by a four-ring final dash makes the expected good-run cycle count structural rather than a soft suggestion.
8. **Layered entry art, not baked frames:** Painted depth is preserved while engine transforms keep memory and decode cost within the 60 fps target.
9. **Concept art is non-authoritative:** The supplied image may be used as loose context or not used at all. It creates no implementation or art-direction requirement; the written, approved plan is the authority.

## Approval gates

- **Phase 1 approval:** Agree on scope, constants, controls, time bands, experimental Log placement, later-campaign extension path, art inventory, and deviations in this document.
- **Phase 2 approval:** Review the mirrored PNG set and contact sheet. No code is started.
- **Phase 3:** Implement the approved design, run source-level tests and performance checks, and stop with source changes for maintainer build/versioning.
