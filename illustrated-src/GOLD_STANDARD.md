# The gold standard: Cyber, 12 Sep 2026

Owner: *"Cyber is absolutely the best, by far of any of them. Something we
did unlocked its frames and timing and animation beautifully. It is the
goal. Now I will say the game benefits from each character having slight
uniqueness to how it flies, but if the goal isn't unique, this is the
target. The 'gold standard' for the game. The frames, the motion in the
frames, the arc or the tail, the range it has, document it all. Especially
if things break later. This is a moment of what works really really well."*

**Best practice, not a rule.** Nothing here forbids a suit from flying its
own way. When a new character has no reason to be different, it is built to
this. When Cyber itself stops matching this page, that is a regression:
`test-gold-standard.mjs` re-flies the traces below against the fixture
`fixtures/gold-standard-cyber.json` and fails on the first tick that drifts.

Everything below was measured on the shipped build at stamp 282 (main
`cf0cc676`), not written from memory.

## 1. The art

| | |
| --- | --- |
| Cell | 256 × 256 px, pilot faces right, nothing touches the edge |
| Climb bank | `cyber-asc-1..9.png` — nine frames, level → deepest climb |
| Dive bank | `cyber-desc-1..9.png` — nine frames, level → full dive |
| Still | `cyber.png` (hover, hangar, cards) + `cyber-body.png` / `cyber-tail.png` rig layers |
| Head | its own (`ownHead`), no helmet overlay; dome centre 128,128 radius 40 |
| Tail pivot | 101,125 — the neck cut (`TAIL_PIVOT`, draw.ts), found by neck-cut.py, never by eye |
| Coverage | 11.6 – 13.8 % of the cell on every frame |

The frames carry the tail. In flight the frame is the whole pilot: one
layer drawn per tick, no rig tail, no body layer (the test pins this). The
rig tail and the tail spring (`TAIL_SPRING_SUITS`) exist for the still.

Cutter sheets, masks, hole plates and a registration guide cut from these
frames live in `art-src/gold-standard/cyber/` (see its README). Rebuild
them with `node illustrated-src/build-gold-cutter.mjs`.

## 2. The motion in the frames

Silhouette box per frame `[w × h]`, then the pixel change between
neighbouring frames as a share of the largest step in that bank:

```
climb  asc-1 142×122  asc-2 141×125  asc-3 139×127  asc-4 131×131  asc-5 123×134
       asc-6 119×136  asc-7 118×136  asc-8 117×138  asc-9 117×138
       step  91 84 98 100 91 70 92 96      distance from asc-1: 68 78 85 91 94 95 98 100

dive   desc-1 143×124  desc-2 144×126  desc-3 142×127  desc-4 142×127  desc-5 141×129
       desc-6 137×131  desc-7 136×132  desc-8 131×133  desc-9 129×134
       step  100 71 69 87 93 64 87 67      distance from desc-1: 71 78 83 90 93 96 98 100
```

What that says, in words:

- **Every step moves.** No frame in either bank is a near-duplicate of its
  neighbour (the smallest climb step is still 70 % of the largest; the
  smallest dive step 64 %). Compare Patriot, whose first five frames were
  near-identical crouches and had to be skipped.
- **The climb gathers and lifts.** Across the nine climb frames the box
  narrows 142 → 117 and grows 122 → 138: the body compresses toward the
  head and the plume rises. It reads as effort.
- **The dive relaxes.** The dive box drifts 143 × 124 → 129 × 134: the
  body stretches out and the tail trails. It reads as momentum, not as a
  second gesture.
- **Level is shared.** `asc-1` and `desc-1` differ by ~9 k px, so the hand-
  over at level costs no visible cut.
- **One ramp, two directions.** Cyber's bank carries how far the body
  EXTENDS, not which way it points: the rig supplies the pitch over the top
  (`RIG_PITCH_WITH_BANK` in draw.ts, Cyber is its only member). That is what
  lets nine frames read as a climb and a dive without two sheets that
  disagree at the seam.

### The tail is the reason

Owner, on the climb bank: *"do you see how much tail motion is in frame
asc 3/4/5/6/7, that's why it's so good. fluid, diverse motion that is in a
natural flow."*

Measured on the plume alone (every pixel left of the neck cut at x = 101,
angle from the pivot to the plume's centre of mass, positive = raised):

```
climb   asc-1   asc-2   asc-3   asc-4   asc-5   asc-6   asc-7   asc-8   asc-9
angle   −4.4°  −16.6°  −21.3°  −19.9°  −16.1°  −11.8°   −7.2°   +7.3°  +27.4°
travel          −12.2    −4.7    +1.4    +3.8    +4.3    +4.6   +14.5   +20.1
plume step %       69      75     100      91      79      57      67      62
highest px y  104     105     102      92      83      80      80      79      72

dive    desc-1  desc-2  desc-3  desc-4  desc-5  desc-6  desc-7  desc-8  desc-9
angle   −22.0°  −28.5°  −31.0°  −32.5°  −34.6°  −35.1°  −35.2°  −36.2°  −36.4°
travel           −6.5    −2.5    −1.5    −2.1    −0.5    −0.1    −1.0    −0.2
```

Read it as a whip, because that is what it is:

- **Anticipation (asc-1 → asc-3).** The plume does not rise first. It
  drops and curls under, −4° to −21°, while the body has barely moved. That
  wind-up is what makes the lift that follows read as force.
- **The sweep (asc-3 → asc-7).** From its lowest point the plume travels
  up through level in four even beats (+1.4, +3.8, +4.3, +4.6 degrees) while
  its highest pixel climbs 102 → 80. These are the frames with the largest
  plume change in the bank (the step from asc-3 to asc-4 is the biggest of
  all), and no two of them are alike. This is the "fluid, diverse motion":
  every frame is a different place along one continuous path.
- **Follow-through (asc-7 → asc-9).** The plume overshoots past level to
  +27°, the two biggest angular steps in the bank (+14.5, +20.1), arriving
  raised exactly when the body reaches its deepest climb. Whip, then crack.
- **The dive is the opposite kind of motion.** The plume settles once,
  −22° → −36°, in ever-smaller steps, and trails. Nothing whips. It is drag,
  and that contrast is why the dive reads as momentum and the climb as
  effort.

`cyber-tail-sweep.png` in the cutter folder draws all nine plume outlines
over each other, tinted by frame, so this path is visible at a glance.
`build-gold-tail-sweep.mjs` regenerates it and writes the numbers into
`measurements.json`.

## 3. The rules it flies under

| Rule | Value | Where |
| --- | --- | --- |
| Tap shape | `velocity` — vertical speed picks the climb frame | `TAP_SHAPE`, control-constants.ts |
| Repeat tap | `rewind` (the default; not in `TAP_REPEAT`) | `repeatTapMode`, sim.ts |
| Frozen | no | `FROZEN_SUITS`, draw.ts |
| Dive depth | 1 — the dive flies its whole ramp | `SUIT_DIVE_DEPTH`, draw.ts |
| Lean | up 0.8, down 0.3 (the standard dial) | `SUIT_LEAN`, control-constants.ts |
| Rig pitch | on, over the bank: up 14° × 0.8, down 30° × 0.3, heading smoothed τ = 0.12 s, heading span 55° | `RIG_PITCH_*`, draw.ts |
| Tail spring | stiffness 55, damping 6.2, tap kick 8, dive kick 11, max 0.75 rad, multipliers 1/1/1 — still only | `TAIL` (catalog.ts), `tailSpringFor` |
| Flap | −450 px/s; gravity 1300 px/s²; quick drop 380 px/s | `PHYS`, `FLIGHT_GRAVITY`, `QUICK_DROP_VY` |
| Frame from speed | climb full at −260 px/s (`POSE_CLIMB_SPAN`), dive full at +620 px/s, curve 1.7, smoothing 24/s | draw.ts |
| Tap clock | 1.0 s (`TAP_ANIM_DURATION`) — velocity ignores the ramp and the dial | catalog.ts, draw.ts |
| Step | fixed 1/60 s for ordinary flight (since 12 Sep) | engine.ts |

## 4. The arc: one tap, measured at 60 Hz

```
t (ms)   vy (px/s)  frame    body angle
   0      −428      asc-5    −6.4°     the tap tick: speed smoothing lands mid-bank
  17      −407      asc-9   −11.2°     deepest climb on the SECOND tick
  33      −385      asc-9   −14.8°
  83      −320      asc-9   −16.4°     peak nose-up
 150      −233      asc-9              deep frame held ≈150 ms (9 ticks)
 167      −212      asc-8              then one frame per tick or two, easing home
 200      −168      asc-6    −8.8°
 300       −38      asc-2    −2.0°
 317       −17      asc-1              level again at a third of a second
 367       +48      desc-1             the arc turns over: dive ramp begins
 450      +157      desc-2
 533      +265      desc-3
 600      +352      desc-4
 650      +417      desc-5
 700      +482      desc-6
 750      +547      desc-7
 783      +590      desc-8
 817      +633      desc-9   +13.1°    full dive pose by 0.82 s, held while falling
```

Range: the whole climb bank and the whole dive bank in one untouched tap.
Body angle swings −16.4° to +13.1° (lean rotation plus rig pitch). Vertical
speed −428 → 0 in 0.33 s, +620 by 0.81 s.

## 5. The range under real tapping

| Cadence | What the picture does |
| --- | --- |
| One tap | above: 5 → 9, hold 150 ms, ease home by 317 ms, dive by 817 ms |
| Every 300 ms | every beat runs asc-5 → asc-9, holds, eases to asc-2 as the next tap lands: the full climb range on every tap, never a dead frame |
| Every 150 ms | pinned on asc-9 from the second tick: spam reads as maximum effort, not as flicker |
| Five taps 100 ms apart | asc-9 for 550 ms, then the same ease home and dive |
| Dive input at 1 s | the pose pulls back desc-9 → desc-6 in 50 ms and returns to desc-9 by 200 ms (the dive arrives like momentum); the tail spring whips to −0.73 rad on the still |

## 6. What a new character needs (the spec / needs list)

When a suit is meant to fly the standard, this is the brief. Deviate on
purpose, not by accident.

1. **Cell and registration**: 256 × 256, facing right, head dome at 128,128
   r40 (or its own head, declared `ownHead`), tail root measured by the
   neck cut and written into `TAIL_PIVOT`. Use the cutter sheets.
2. **Nine climb frames, nine dive frames**, each a full pilot with the tail
   painted in. Level → extreme in both. `asc-1` and `desc-1` nearly equal.
3. **Every frame moves**: no neighbour under ~60 % of the bank's largest
   step. If the first frames are near-duplicates, cut them (Patriot) or
   repaint them.
3a. **The tail travels a whip through the climb**: wind down (frames
   1–3), sweep up through level in even beats (3–7), overshoot raised at
   the top (7–9). Every one of frames 3–7 is a different place on that
   path. Check it with `build-gold-tail-sweep.mjs` against Cyber's angles
   above; a plume that only rises, or that sits still for three frames,
   is the thing to send back. The dive plume settles and trails, it never
   whips.
4. **Climb gathers, dive relaxes**: the box narrows and grows through the
   climb, stretches through the dive.
5. **A still, a body layer and a tail layer** for the hover and the cards,
   with the tail rigged on the spring.
6. **Wire it**: `ASC_BANKS`/`DESC_BANKS` = 9/9 (art.ts); `TAP_SHAPE` =
   `velocity`; `SUIT_DIVE_DEPTH` = 1; `SUIT_LEAN` = 0.8/0.3; add it to
   `RIG_PITCH_WITH_BANK` only if the bank carries extension rather than
   attitude, as Cyber's does; `TAIL_SPRING_SUITS` if it has a rig tail.
7. **A brand-new character loads to beta first** (standing rule).
8. **Prove it**: run it through `test-gold-standard.mjs`'s harness (copy
   the `fly()` block with the new id) and compare the timeline in §4. The
   deep frame should land by the second tick, hold ~150 ms, be level by
   ~0.33 s, and reach the full dive by ~0.82 s. Then fly it and say how it
   feels — the numbers are the floor, the feel is the ruling.

## 7. If it breaks later

`node illustrated-src/test-gold-standard.mjs` prints the first ticks that
differ from the 12 Sep trace: scenario, time, the frame/angle/speed that
was, and what it is now. Find which of the rules in §3 moved. Do not
re-freeze the fixture to make it pass; re-freeze (`ACORNAUT_GOLD_WRITE=1`)
only when the owner has flown the new Cyber and called it the standard
again.
