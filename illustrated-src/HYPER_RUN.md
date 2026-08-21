# Hyper Run — Prototype Chapter 1 design plan

**Status:** Course 1 Revision 2 Phase A was approved and merged to `origin/main` on 2026-08-21 in PR #60 (merge `e710052`). Phase B ordinary-gate art is the active scope and will stop for visual sign-off. Phase C source implementation has not started and remains outside this Phase B change.

**Phase boundary:** This Revision 2 section is the authority wherever it conflicts with the shipped prototype plan below. The approved 60 Hz determinism core, fixed-step race clock, existing six-case replay suite, beta-only placement, and four painted wormhole-entry layers stay. The older sections remain as a Revision 1 record; their superseded counts, constants, controls, timing bands, tunnel layout, transition timing, and ordinary-gate brief must not be implemented for Revision 2.

**Phase A approval record (2026-08-21):** The Revision 2 design delta below was approved and merged by PR #60 at `e710052`. This records design authority only; it does not claim that Revision 2 gate art or Phase C runtime/test changes have shipped.

**Revision 1 approval record (2026-08-20):** Move the proof of concept from proposed campaign level `2-6` to a beta-only experimental Log card named **PROTOTYPE CHAPTER 1**; keep `race` data-driven so several mechanically different events can be placed in later campaign chapters; confirm hold-to-rise/release-to-fall for both regimes; require matched back/front layers for every ordinary gate state so the pilot renders between the far and near rims; repair the GitHub copy's damaged UTF-8 characters (`×`, `≤`, and `²`); and replace the unexplained return clamp with `canonicalMinTunnelHalf + PHYS.squirrelR / 2 = max(72, min(88, 640 × 0.15)) + 16 / 2 = 88 + 8 = 96`, giving the derived canonical range `96…(640 - 96) = 96…544`.

## Course 1 Revision 2 — Phase A design delta

### Phase A change and verification statement

This delta redesigns the moment-to-moment course without replacing the approved race authority. It adds deterministic boost/drop semantics, a denser authored 45,000-unit course, a faster speed model, three new benchmark bands and star thresholds, a six-second risk/reward tunnel, a fixed-tick transition storyboard, the exact gate-plane correction, and the Phase B gate-art acceptance contract.

Phase A verified the following against the shipped source before selecting the new values:

- Race authority still advances in canonical 360 × 640 coordinates at 60 fixed steps per second and owns integer finish ticks independently of render cadence.
- The six mandatory replay cases still exist as the acceptance structure to extend in Phase C. Phase A changes their planned inputs and bands, not the approved determinism contract.
- Beta Wormhole Run's shipped hold physics are released acceleration `+1,300 px/s²`, held acceleration `−2,100 px/s²`, and velocity clamp `−520…+620 px/s`; the existing dive sets vertical velocity to `+380 px/s`.
- The early gate-state change has a specific source cause: gate authority and gate drawing cross at `RACE_PILOT_X = 96`, but the generic pilot draw uses `360 × PHYS.squirrelX = 360 × 0.18 = 64.8`. The visible pilot is therefore 31.2 canonical pixels behind its judging plane, about 3.9 ticks at the new 480-unit cap.
- The approved entry assets remain four independently painted layers and the Hyper Run art bank remains beta-gated. No art, runtime source, generated JavaScript, save identifier, legacy identifier, or art version is changed in Phase A.
- The timing arithmetic, shortcut value, density ceiling, skill-move reachability, profile bands, and threshold margins below were re-derived from the proposed constants rather than copied from Revision 1.

### Control upgrade: hold, boost, and quick drop

Positive Y is downward. Plain normal-flight control remains hold-to-rise and release-to-fall. Two semantic moves sit on top of that state:

| Regime and input | Acceleration or impulse | Velocity clamp |
| --- | ---: | ---: |
| Normal, released | `+1,050 px/s²` | `−330…+390 px/s` |
| Normal, plain hold | `−700 px/s²` | `−330…+390 px/s` |
| Normal, boosted hold | `−2,100 px/s²` | `−520…+390 px/s` |
| Race tunnel, released | `+1,300 px/s²` | `−520…+620 px/s` |
| Race tunnel, plain hold | `−2,100 px/s²` | `−520…+620 px/s` |
| Race tunnel, boosted hold | `−3,500 px/s²` | `−780…+620 px/s` |
| Quick drop, either live regime | Set `vy = +380 px/s` once | Regime clamp applies during the same tick's integration |

The boost contribution is `−1,400 px/s²` while boost is active. It raises both acceleration and the upward velocity cap, so it remains observably stronger than a plain hold instead of becoming identical once both reach one shared cap. The race tunnel's non-boosted values must use the same named constants as beta Wormhole Run so the two modes cannot drift. Normal race flight retains its `+1,050` release value; only the loadout-neutral race tunnel shares Wormhole Run's baseline `+1,300` release value.

#### Double-tap-and-hold recognition

- `DOUBLE_TAP_MAX_GAP_TICKS = 15`, inclusive: the second down may occur at most 15 race ticks, or 250 ms at 60 Hz, after the first down.
- The interval is down-to-down and requires an intervening release. Keyboard autorepeat and duplicate pointer downs are ignored.
- Every valid down begins a plain hold immediately. There is no delay while the detector waits to learn whether a second tap will arrive.
- A qualifying second down sets `boost = true` on that same simulation tick. Boost remains active only while that second press remains held.
- A successful second down consumes and clears the tap candidate; it cannot also become the first tap of a third press. A contact that fires quick drop also clears the candidate and cannot seed a later boost.
- The corresponding lift sets both `held = false` and `boost = false` before that tick's physics. Pointer cancel, pause, focus loss, or visibility loss does the same and clears the tap candidate.
- A second down at a gap of 16 ticks or more is an ordinary hold and becomes the next first-tap candidate. A missed window therefore degrades into a working plain hold, never a dead press.
- The first primary pointer to press owns the gesture until it ends. Additional pointer ids are ignored, preventing a second finger from creating a false double tap or drop.

#### Quick-drop recognition

The race reuses normal flight's existing swipe language: at least 34 canonical pixels downward within `DROP_MAX_TICKS = 19`, inclusive, the 316.7 ms fixed-tick equivalent of the shipped 320 ms window. It emits once per contact. The semantic event atomically records `held = false`, `boost = false`, and `drop = true`, then assigns `vy = +380 px/s`; it is not additive and cannot be stacked by duplicate move events. The firing contact is disarmed until lift, so the same finger cannot immediately reassert ascent; a fresh down after lift is required. Ordinary boost otherwise lasts through the held second press and ends on its lift. Arrow Down emits the same release-plus-drop event. The gesture is enabled in both normal and tunnel portions of a race.

#### Race-ready control prompt copy

Before the race begins, the ready screen must state all three controls as these three stacked lines:

**HOLD TO RISE**<br>
**DOUBLE-TAP + HOLD TO BOOST**<br>
**SWIPE DOWN TO DIVE**

This is copy authority for later Phase C presentation only. Phase B does not edit UI/runtime source or bake this text into gate art.

#### Authoritative input record

The replay record extends the existing transition without storing wall-clock gesture timing:

```ts
type RaceInputTransition = {
  tick: number;
  held: boolean;
  boost: boolean;
  drop?: true;
};
```

The record is the post-recognizer state for that tick. `tick` means the pre-increment authority tick whose inputs are consumed immediately before physics; `decisionTick` uses that same convention. Legacy `{ tick, held }` records load with `boost = false` and no drop. If more than one update lands on one tick, the final held/boost state wins and `drop` is OR-preserved. Consumption order is state snapshot, then the one-shot drop assignment, then that regime's acceleration and integration. `loadRaceInputs` rejects, rather than silently normalizes, any record where `boost = true` while `held = false`. Entry and return continue recording held/boost transitions so the first live tick inherits the actual finger state; their presentation-locked motion does not defer a drop impulse into later gameplay.

#### Why the authored redline line requires both moves

The named redline exam is a coupled low-high-low sequence with centers `496 → 144 → 496` and exactly 384 course units between planes. At the 480 cap, each leg is exactly 48 ticks / 0.80 seconds. The 38-pixel clearance at both ends leaves a minimum edge-to-edge movement of `352 − 2 × 38 = 276` pixels.

- Plain hold can move upward at no more than `330 × 0.80 = 264 px`, regardless of its entry velocity, and therefore cannot pass the first two planes at cap.
- A preceding authored runway lets a correctly timed boosted hold enter the low plane at the `−520 px/s` boosted cap; its 0.80-second envelope is 416 pixels, so the high plane is reachable.
- The complete 48-tick fixed-step envelope constrains a valid high-plane exit from that first leg to at most about `vy = +48 px/s` downward. Without a drop, 48 released ticks can descend at most about 260.7 pixels, still short of 276. The release-plus-drop semantic clears held/boost and sets `vy = +380`; it therefore descends 312 pixels over 48 released ticks and reaches the low plane.

Those figures define the authored target, but Phase C must prove it with a fixed-step reachability search over every legal plain hold/release transition, not only by stripping events from one replay. The release blocker is: no advanced-free state path may clear the three named planes at cap, while a declared boost/drop input path must clear them. A separate benchmark comparison must show that slowing down or sacrificing the sequence cannot remain inside the optimized band. The passive replay still finishes with neither event.

### Retuned authoritative constants

| Rule | Revision 1 shipped | Revision 2 proposal |
| --- | ---: | ---: |
| Course length | 36,000 | 45,000 course units |
| Normal base speed | 185 | 300 units/second |
| Ring speed gain | +22 | +18 units/second |
| Normal speed cap | 275 | 480 units/second |
| Speed grace | 90 ticks | 90 ticks / 1.50 seconds |
| Decay after grace | 4 | 18 units/second toward 300 |
| Charge per passed ring | +20 | +5; 20 clean rings from empty |
| Debris penalty | speed 185, charge −20 | speed 300, charge −10; 45-tick contact grace |
| Entry | 72 ticks | 48 ticks / 0.80 seconds |
| Race tunnel | 3,600 units in 540 ticks | 4,500 units in 360 ticks / 750 units/second |
| Return | 36 ticks, speed 225 | 36 ticks / 0.60 seconds, speed 390 |
| Wormhole maximum | 3 | 3 |
| Ordinary rings | 22 | 84 |
| Normal debris | 14 | 30 |
| Normal acorns | 12 | 42 |
| Tunnel acorns | 20 per cycle | 18 authored acorns per cycle; 96 total maximum |
| Gate collision aperture | radius 54, center clearance 38 | unchanged |

The course grows spatially to support 84 authored gate beats, but it becomes materially shorter in time: a no-shortcut base-speed run falls from the shipped 194.6-second result to 150 seconds. Returning at 390 prevents a portal from feeling like a forced stall. Ring gain reaches cap in ten no-decay hits from base; the speed-stack portions keep post-hit gaps at or below 470 units until cap so the 90-tick grace really permits that ramp. Charge takes 20 clean rings, so dense gates remain the primary beat without opening a tunnel every few seconds. A debris hit costs the current stack and two rings of charge rather than erasing a whole cycle.

### Density map and authored skill sequence

All placements are fixed course data. No ring, debris, acorn, pinch, recovery object, or skill sequence may be generated at runtime.

| Act | Course range | Rings | Debris | Normal acorns | Authored rhythm and exam |
| --- | ---: | ---: | ---: | ---: | --- |
| Launch Circuit | `0…7,500` | 14 | 4 | 8 | Short hold corrections, then the first boost ladder |
| Snap Descent | `7,500…15,000` | 14 | 6 | 4 | Boost-to-drop gate reversal and a drop-through debris pinch; intended entry is ring 20 at x = 10,000 exactly |
| Crosscut | `15,000…22,500` | 14 | 5 | 9 | Alternating-height clusters with a recovery breather |
| Acorn Switchback | `22,500…30,000` | 14 | 5 | 5 | High-low-high acorn line off the completion-safe route; intended entry is ring 48 at x = 25,000 exactly |
| Needle Surge | `30,000…37,500` | 14 | 5 | 10 | Redline 480-unit boost/drop reversals and two narrow debris lanes |
| Redline Final | `37,500…45,000` | 14 | 5 | 6 | Combined boost/drop/boost exam; intended entry is ring 76 at x = 40,000 exactly; 500-unit finish sprint after return |
| **Total** | **45,000** | **84** | **30** | **42** | **Rings are the dominant recurring beat** |

Ring gaps alternate 360–480-unit clusters with 560–700-unit breathers; they are never a monotone interval. Speed-stack clusters use gaps of 470 units or less until cap. The sorted union of rings, debris, and normal acorns, with start and finish sentinels, must have no gap above 720 units. At base speed, `720 / 300 = 2.4 s`, below the 2.5-second ceiling. The Phase C layout validator evaluates the passive course and every authored intended or delayed-recovery entry route after its skipped objects are removed; from each return coordinate, the next live interactive element must also be within 720 units. Global density cannot be satisfied by objects hidden inside a tunnel skip. Both ring-rhythm and route-aware interactive-gap limits are release-blocking.

All 42 normal acorns lie outside the three optimized tunnel-skip intervals `(10,000, 14,500]`, `(25,000, 29,500]`, and `(40,000, 44,500]`; the Act 2, Act 4, and Act 6 acorns appear before their intended entry rings. Collecting every normal acorn and all three 18-acorn tunnel lines can therefore attain the stated maximum of 96 rather than leaving skipped pickups in the theoretical total.

The intended three-cycle optimized route is structural:

1. Pass rings 1–20; ring 20 opens the first entry at x = 10,000. The 4,500-unit tunnel skips exactly rings 21–28 and returns at x = 14,500.
2. Pass rings 29–48; ring 48 opens the second entry at x = 25,000. The tunnel skips exactly rings 49–56 and returns at x = 29,500.
3. Pass rings 57–76; ring 76 opens the third entry at x = 40,000. The tunnel skips exactly rings 77–84 and returns at x = 44,500 for the final 500 units.

Thus the optimized fixture passes exactly 60 gates and uses three tunnels, while a passive no-charge fixture sees all 84. The layout validator asserts those three exact skip sets. Recovery placements still permit a missed-gate run to finish, but moving an entry later costs normal-flight time and changes which authored objects are skipped. Each mandatory skill sequence has a stable id so the replay test can assert its exact gate ledger rather than infer skill from total ring count.

### Time derivation, benchmark bands, and stars

One entry/tunnel/return cycle costs `48 / 60 + 360 / 60 + 36 / 60 = 7.4 s` and advances 4,500 course units. Its shortcut value is therefore:

- base speed: `4,500 / 300 − 7.4 = 7.6 s` saved;
- representative average speed: `4,500 / 390 − 7.4 = 4.138 s` saved;
- cap speed: `4,500 / 480 − 7.4 = 1.975 s` saved.

Even at cap, entry is faster than flying the same distance normally. The tunnel is no longer nine seconds of downtime, and its navigation/acorn line supplies active content during the shortcut.

The benchmark equation is:

`finish seconds = normal course distance / measured mean normal speed + wormhole cycles × 7.4`.

| Profile | Derivation and measurable route | Acceptance band |
| --- | --- | ---: |
| Passive | 45,000 normal units at 300, zero cycles: `45,000 / 300 = 150.000 s = 9,000 ticks`; no boost or drop | `8,990…9,010` ticks / `149.833…150.167 s` |
| Average | Two tunnels leave `45,000 − 2 × 4,500 = 36,000` normal units. At representative mean speed 390: `36,000 / 390 + 2 × 7.4 = 107.108 s`; target 44–50 passed rings, two cycles, 0–2 debris contacts, mean normal speed 371–403 | `6,240…6,720` ticks / `104…112 s` |
| Optimized | Three tunnels leave `31,500` normal units. A representative no-decay ring-ramp budget produces about 69.75 seconds of normal flight; `69.75 + 3 × 7.4 = 91.95 s`; exactly 60 passed rings, three cycles, zero debris, named boost and drop events, mean normal speed about 452 | `5,400…5,700` ticks / `90…95 s` |

The optimized normal-flight estimate is a representative equal-spacing budget pending the authored Phase C replay. With 450-unit no-decay stack gaps, the first leg is `Σ(450 / s)` for `s = 300, 318, …, 462`, plus `5,500 / 480`, or about 23.49 seconds. Each post-return leg is `Σ(450 / s)` for `s = 390, 408, …, 462`, plus `8,250 / 480`, or about 22.49 seconds. The final 500 units at 390 take about 1.28 seconds. Their sum is about 69.75 seconds, or approximately 91.95 seconds after the three fixed 7.4-second cycles. The acceptance band, rather than this analytical center point, is release-authoritative.

Worst-case accepted separation is `8,990 / 60 − 5,700 / 60 = 54.833 s`, preserving more than the required 45-second passive-to-optimal spread. The full accepted range is approximately 90–150 seconds.

Revision 2 stars are:

1. Finish the course: one star.
2. Finish at or below `6,900 ticks / 1:55.000`: two stars. This is the 112-second slow edge of the average band plus three seconds of execution margin.
3. Finish at or below `5,760 ticks / 1:36.000`: three stars. This is the 95-second slow edge of the optimized band plus one second of execution margin.

The three-star limit remains below the average band, every accepted optimized run earns three stars, and the passive fixture remains outside two stars. Phase C may tune placements or the declared constants through review if the deterministic fixtures miss a band; it must not silently move thresholds after seeing results.

### Tunnel redesign: six seconds of shared-skill risk and reward

The race tunnel uses the beta Wormhole Run plain-control constants stated above, then adds the same boost and drop semantics as normal race flight. Its fixed 360-tick duration and 4,500-unit distance remain independent of collision and rendering. Gameplay geometry comes from the one authored beat table below. `hash(courseSeed, cycle) & 1` may vertically mirror its post-mouth Y coordinates around 320; no undeclared template, synthesized placement, or `Math.random()` call is allowed.

The canonical six-second spine is:

| Tick | Center Y | Half-width | Beat |
| ---: | ---: | ---: | --- |
| 0 | Entry-anchor Y | 144 | Safe mouth; preserve the triggering gate's authored Y within `144…496` |
| 45 | 248 | 126 | Rising weave |
| 90 | 204 | 96 | High pinch |
| 135 | 408 | 108 | Drop chute |
| 180 | 440 | 88 | Low pinch |
| 225 | 468 | 104 | Boost-line start |
| 255 | 168 | 88 | Boost reward crest |
| 285 | 452 | 96 | Drop-line catch |
| 315 | 360 | 120 | Unwind |
| 359 | 320 | 144 | Safe exit |

Centers and half-widths smoothstep between anchors. Mirroring uses `y' = 640 − y` from the first post-mouth anchor through tick 315; tick 0 remains the triggering entry Y and tick 359 remains 320. Every possible entry-triggering gate center is authored inside `144…496`, so the 144-pixel mouth stays wholly inside the canonical 640-pixel field without a hidden clamp or visual snap. The narrowing corridor itself supplies the authored pinches; Revision 2 adds no separate tunnel-debris collision type. Wall contact stays nonlethal: clamp the pilot, zero vertical velocity, grant the existing 15-tick wall/pickup suppression, and record one scrape for the replay signature. The real cost is losing the next reward window; tunnel duration and distance do not change.

Each cycle places exactly 18 authored acorns: five on the completion-readable center line; eight from Y 480 to 156 over ticks 225–255; and five from Y 156 to 464 over ticks 255–285. Mirror the acorn Y values with the corridor when the cycle mirror bit is set. Accounting for 28 pixels of pickup reach at each endpoint, the boost line needs at least `324 − 2 × 28 = 268` pixels of rise in 30 ticks. From rest, plain tunnel hold covers about 199.9 pixels while boosted hold covers about 309.0. Leaving the crest boosted, release alone for a half-second still moves about 100.5 pixels upward; the release-plus-drop event clears ascent and moves about 290.2 pixels downward, enough to sweep the `308 − 2 × 28 = 252`-pixel drop line. Phase C verifies those fixed-step envelopes and the full collection route.

The normal 42 plus three tunnel sets of 18 produce the attainable result-sheet maximum of 96. Acorns remain a secondary record and never alter finish time, speed, charge, or stars.

The tunnel earns its place in three ways: every cycle is a measurable shortcut, six seconds replaces the shipped nine-second lull, and the active 88–126-pixel half-width weave demands the same hold/boost/drop language as the rest of the event while widening to 144 only at the mouth and exit. The three-cycle maximum remains; Revision 2 does not need fewer tunnels. Tunnel drawing must derive lookahead and pickup X from the exported 750-unit authority speed rather than retain a hard-coded Revision 1 value.

### Deterministic entry and return storyboard

The four approved entry paintings are untouched. Presentation transforms are derived only from `phaseTick`; no image load, CSS transition, animation callback, frame count, or render completion can delay race authority.

#### Entry — 48 ticks

| Ticks | Deterministic beat |
| --- | --- |
| `0…11` | On `decisionTick`, freeze `entryAnchor = (RACE_PILOT_X, triggeringRingY)` rather than using the post-step overshoot position. The ordinary ring registers as the four-layer entry portal at that anchor. The mouth fades in; common scale grows `1.00→1.25`. Back, mouth, glyph, and front layers use restrained `0.96 / 1.00 / 1.04 / 1.08` parallax factors. |
| `12…23` | Common scale grows `1.25→1.75`; glyphs ignite and rotate; the aperture darkens; course streaks bend toward the mouth. |
| `24…35` | Scale grows `1.75→2.15`; pilot presentation X eases 30 pixels into the mouth while authoritative `race.y` smoothsteps to `entryAnchor.y`. It does not snap to screen center. |
| `36…47` | Scale grows `2.15→2.35`; the light-streak wash rises `0→1`; the tunnel scene initializes behind the opaque wash. |
| `48` | Authority enters tunnel exactly with `race.y = entryAnchor.y` inside the authored `144…496` mouth and resumes physics with the current held/boost state. |

#### Return — 36 ticks

| Ticks | Deterministic beat |
| --- | --- |
| `0…9` | At exact tunnel completion, the wash rises and the return portal opens behind it at `(RACE_PILOT_X, returnY)`. |
| `10…23` | Wash falls `1→0.35`; the portal scales `2.15→1.30`; glyphs unwind; the pilot eases out of the mouth. The normal course is already drawn behind the return portal under the wash. |
| `24…31` | Portal returns `1.30→1.00`; the near lip releases the pilot; wash reaches zero and normal course parallax is fully visible. |
| `32…35` | Glyphs extinguish and the rim collapses into the course. |
| `36` | Normal physics and collisions resume exactly at speed 390 with the derived return clamp `96…544`. |

Course position is fixed during entry/return while finish ticks continue. Phase C must not retain the shipped `tunnelView` through all 36 return ticks: normal-course drawing is present under the wash from tick 10 so tick 36 cannot pop between scenes. Missing or late art draws a fallback; it never stalls or lengthens the phase. The return margin remains a separate geometrically derived constant, `88 + 8 = 96`, rather than an alias whose meaning changes if the pilot's screen plane changes.

### Exact gate judging and visible crossing evidence

The judging rule remains authoritative and simple: on the first fixed step where `previousCoursePosition < ring.x ≤ coursePosition`, interpolate pilot Y to that crossing fraction, decide passed/missed once against the 38-pixel clearance, and stamp the pre-increment `decisionTick`. Both ordinary-gate layers begin their synchronized state crossfade at elapsed zero on that exact tick. Passed fades for 27 ticks / 450 ms; missed fades for 39 ticks / 650 ms. Neither crossfade changes silhouette, aperture, collision state, or decision timing.

Phase C keeps `RACE_PILOT_X = 96` and gives Hyper Run's pilot draw a race-only X override of `96 × viewportScale`; other flight modes retain `PHYS.squirrelX = 0.18`. Ring draw X remains `pilotPlaneX + (ring.x − coursePosition) × scale`. This removes the verified 31.2-pixel mismatch without moving authority or changing the course. Passed and missed drawing may interpolate from the stamped decision but may not look ahead in distance.

A review harness under `illustrated-src/` renders pass and miss strips at two ticks before crossing, one tick before, the first crossing step, one tick after, and two ticks after. Every frame shows the vertical pilot plane, pilot collision circle, gate center/aperture, tick, course position, ring X, and ledger/decision state. Assertions require `pending` in every pre-cross frame, one decision on the first crossing step, and a stable state afterward. Generated JavaScript and frame directories compile to a temporary location; the PNG strip is attached to the PR, not committed as a generated runtime artifact.

### Phase B ordinary-gate art acceptance contract

Phase B replaces only the six ordinary-gate PNGs. The approved four-layer entry showpiece and its hashes are untouched.

- Deliver idle, passed, and missed as matched `gate-*-back.png` and `gate-*-front.png`, each 256 × 256 RGBA with transparent background.
- Every back/front composite must show a complete 360-degree ring and an enclosed, unmistakable hole. No state may read as a half-circle, horseshoe, or open arch.
- The back layer carries the full far rim and structural silhouette behind the pilot. The front layer is only a thin near-rim arc drawn over the pilot. At the actual 148-pixel game draw size, the pilot must visibly thread between them.
- All six files share one canvas center, transform, collision-aperture registration, and scale. The three back/front composites share one core outer silhouette and aperture geometry; the front files remain thin arcs rather than duplicating the back silhouette. The projected aperture remains the same radius-54 collision hole in every state.
- The gate is face-on. Apparent major/minor axis ratio is at least 0.96 and authored tilt is at most about 3 degrees. Color, glow, and particles may change state; silhouette and aperture may not.
- The review composite shows each layer separately, the pair without a pilot, the pilot between layers, all three states at 148-pixel game size over representative dark skies, and the radius-54 collision overlay.
- Store the contact sheet at `art-src/hyper-run/hyper-run-r2-contact-sheet.png` or attach it to the PR. Never put it in `docs/` or `sandbox_assets/`.
- Mirror only the six approved runtime PNGs into `docs/art/hyper-run/` and `sandbox_assets/art/hyper-run/`; paired roots must be byte-identical by SHA-256.

#### Phase B change and verification statement

Phase B replaces only the six ordinary-gate runtime PNGs, adds their selected idle master and deterministic art build under `art-src/hyper-run/`, and stores the game-scale sign-off sheet at `art-src/hyper-run/hyper-run-r2-contact-sheet.png`. It also records the approved three-line ready-screen copy above for Phase C. No runtime source, generated JavaScript, protected identifier, entry-showpiece asset, or return asset is changed.

The production files verify as 256 × 256 RGBA with transparent gutters. All three states use byte-identical alpha silhouettes and apertures centered at `(127.5, 127.5)`. At alpha 16, the shared outer box is 244 × 238 for an axis ratio of 0.975; the enclosed aperture is a centered 188 × 188 circle, projecting to 108.7 pixels at the 148-pixel game draw size against the 108-pixel collision diameter. The near-rim front arc occupies 22.0% of the back-rim pixels. Every corresponding file in the two runtime roots is byte-identical by SHA-256, and the approved entry layers retain their `origin/main` bytes.

The Phase B source audit also found that the shipped `drawSprite` path independently alpha-fits each layer. That behavior would enlarge and recenter a genuinely small front arc relative to its back layer. The sign-off sheet therefore uses the approved full-canvas transform: both 256 × 256 layers draw into the same 148 × 148 destination square around one center. Phase C must preserve that shared transform in the gate renderer; Phase B does not change renderer code.

Phase B stops after those game-scale composites and hash/geometry checks for separate sign-off.

### Phase C implementation acceptance: the same six tests, extended

1. **Same seed and semantic inputs:** Two runs with the same held/boost/drop log produce identical finish tick, acorns, ring decisions and decision ticks, debris contacts, wall scrapes, and entry ticks. Detector boundary subcases prove a 15-tick gap boosts, a 16-tick gap is plain hold, lift clears boost on that tick, and one drop is consumed once.
2. **Presentation-size independence:** The same log at 360 × 640 and a tall-phone viewport produces the same authority. Canonical swipe mapping emits the same drop tick at both sizes.
3. **Render-cadence independence:** 60 fps, 30 fps, and the existing mixed/dropped cadence produce the same full signature with boost and drop events present.
4. **Re-banded profiles:** Passive, average, and optimized fixtures land in `8,990…9,010`, `6,240…6,720`, and `5,400…5,700` ticks respectively with the telemetry declared above. Passive has zero boost/drop events. Optimized contains both and passes the named skill gates. In the same case, the fixed-step reachability search proves the 384-unit low-high-low chain has no cap-speed plain-control path, and an advanced-free benchmark search cannot remain in the optimized band by slowing for it.
5. **Swept objects and exact gate plane:** Swept gate/debris checks run at 300 and 480. The ledger remains pending before the plane, stamps its decision only on the first crossing step, and advances synchronized 27/39-tick layer fades from that stamp. The pass/miss frame strips are the visible evidence companion. The procedural fallback composite is also a full face-on ring; it may not retain the shipped half-ellipse horseshoe.
6. **Tunnel parity and handoff:** One tunnel advances exactly 4,500 units in 360 ticks, then returns after 36 ticks with charge zero, speed 390, Y inside the separately derived `96…544` band, and no double settlement. One-tick parity checks prove race-tunnel plain release/hold matches beta Wormhole Run's `+1,300 / −2,100` and `−520…+620`, then exercise deterministic boost/drop reward lines and both seed/cycle mirror outcomes inside the tunnel.

The Hyper Run art loader stays beta-gated. Phase C changes source and source-level tests only; it does not edit or commit generated `docs/js*` or `sandbox_assets/js*`. `ART_VER`, `SAVE_KEY`, and `LEGACY_KEYS` remain unchanged. Phase C stops with all six tests passing and reports exact fixture evidence for review.

Every later phase repeats the repository gate before doing work: fetch current `origin/main`, re-cut that phase's branch from it, and fetch/rebase again immediately before the final push. Commits contain source and approved art only, all committed text is LF-only, and generated `js*` paths remain absent.

## Revision 1 shipped plan — historical record only

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
- The approved ring, entry, and return-portal production sprites, mirrored into `docs/art/hyper-run/` and `sandbox_assets/art/hyper-run/`; the review-only contact sheet lives once at `illustrated-src/hyper-run-contact-sheet.png`.

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

All deliverable art is PNG, RGBA, transparent, with no baked background. Gate and portal plates are 256 × 256. Entry showpiece layers may be 512 × 512. Phase 2 mirrors byte-identical production sprites into both art roots. The review-only contact sheet is kept out of both runtime roots at `illustrated-src/hyper-run-contact-sheet.png`.

### Ring gate set

| Asset | Size | Visual read |
| --- | ---: | --- |
| `gate-idle-back.png` | 256² | Idle far rim and structural body, drawn behind the pilot; dim violet/cyan energy and restrained dormant glyphs. |
| `gate-idle-front.png` | 256² | Idle near-rim arc only, drawn in front of the pilot to sell threading depth. |
| `gate-passed-back.png` | 256² | Passed far rim on the exact idle alignment; gold-green glyph ignition and brighter inner edge. |
| `gate-passed-front.png` | 256² | Passed near-rim arc on the exact idle alignment; outward gold-green energy sparks. |
| `gate-missed-back.png` | 256² | Missed far rim on the exact idle alignment; cooled slate/violet metal and interrupted glyph light. |
| `gate-missed-front.png` | 256² | Missed near-rim arc on the exact idle alignment; faint receding afterimage and no red failure explosion. |

Each ordinary gate state is a matched two-layer pair sharing one canvas center, transform, and collision aperture. Draw `gate-*-back` behind the pilot, draw the pilot, then draw only the small `gate-*-front` near-rim arc over the pilot. A slight elliptical tilt is allowed when it improves the side-view threading read, but the ellipse, aperture mask, center, tilt, and layer registration must be identical across idle, passed, and missed. The six PNGs must composite into three complete gates without seams or doubled highlights. State changes are a synchronized 450 ms passed crossfade or 650 ms missed crossfade across both layers; drawing scale and collision geometry do not change after the decision.

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

The single source/review contact sheet at `illustrated-src/hyper-run-contact-sheet.png` shows each ordinary gate back/front pair separately, composited without a pilot, and composited with a pilot silhouette between the layers at 1× and game-size reduction. It also shows the four entry layers separately and composited at four timestamps, and the return portal separately and composited. Review checks: transparent edges, shared centers, identical apertures and tilt across all gate states, clean near-rim occlusion, no seams when composited, 360 × 640 gameplay readability, no state silhouette pop, palette contrast over representative dark skies, and exact mirrored-file hashes between runtime art roots.

## Performance target

The entry sequence and hyperspeed stretch must sustain a 60 Hz presentation on a Pixel 6a / Galaxy A54-class mid-range phone in current mobile Chrome, at the device's normal CSS viewport and device-pixel-ratio canvas cap.

Acceptance numbers for a 30-second capture covering entry, tunnel, and return:

- Median frame time ≤16.7 ms.
- 95th percentile frame time ≤18.0 ms.
- 99th percentile frame time ≤25.0 ms.
- No more than two frames above 33 ms per complete entry/tunnel/return cycle after warm-up.
- No texture allocation or image decode during the live entry sequence; all thirteen Hyper Run layer assets are loaded before `TAKE FLIGHT` enables.
- At most four 512² painted layers, three 256² return layers, and three 256² gate-state pairs resident; particles are pooled and capped at 120 live items.
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
- **Phase 2 approval:** Approved 2026-08-20; production sprites remain mirrored and the contact sheet is source/review-only.
- **Phase 3:** Authorized 2026-08-20; implement the approved design, run source-level tests and performance checks, and stop with source changes for maintainer build/versioning.
