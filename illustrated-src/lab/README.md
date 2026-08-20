# The Lab

Prototypes. Nothing here is imported by the game and nothing here is in the
main build; the only threads back are two hidden buttons at the bottom of
Help, each a link to a separate page rather than a dependency. A lab
experiment can be kept, reworked or deleted without touching a build that
is close to shipping — that isolation is the point, and it is why
`build-lab.mjs` is separate from `export-sandbox.mjs`.

```bash
node illustrated-src/build-lab.mjs   # -> docs/lab/spill/js and docs/lab/rig/js
node illustrated-src/lab/pack.mjs    # -> the Spill as one self-contained .html
```

---

# THE SPILL

An acorn mining rig let go one system over. What reached us is a front of
rock, cargo and shrapnel travelling one way: at you. No gates, no planets.
Stay alive.

## The shape of it

Debris enters from the right and crosses to the left, at angles, at four
different weights. Nothing you can hit ever collides with anything else you
can hit — that was the brief, and it is enforced at spawn time rather than
simulated (see below). Acorns spill through the field in arcs. Survive.

## Controls

The base game's two, plus the one this mode needs:

| | |
|---|---|
| **Tap** | thrust |
| **Swipe down** | dive |
| **Swipe right** | **lunge** forward — a short dash on a half-second cooldown, then a slow drift back |
| **PULSE** button | shatters everything close, once the meter is full |

Keyboard: space/↑ thrust, ↓ dive, → lunge, P pulse.

**Why the lunge earns its place.** Every other control trades height. In a
field that arrives at an angle, height is often not the axis with an answer
in it — the gap is behind the piece, or in front of it. The lunge is the
only move that spends horizontal room.

**Forward only, and it does not stay bought.** A backward lunge was a free
retreat: two of them parked the pilot in a corner with the whole field ahead
and nothing able to reach it. Forward costs you the safe end of the screen
to gain reach, it stops at the halfway line, and the pilot drifts back to
its lane over the next several seconds. Ground a lunge wins is yours for a
moment, not for the run.

**The floor is not a wall.** Riding the bottom was a hiding place, and a
survival mode cannot have one. Brushing it is free; more than a quarter of a
second on it is fatal. That number is chosen, not guessed: a bounce off the
bottom while recovering from a dive lasts one or two frames — under 50ms —
and camping is continuous, so 0.25s sits well clear of the first and well
under the second. The bottom of the screen glows red from 0.1s, so the rule
is visible before it is fatal rather than after.

## What makes a run go somewhere

- **Intensity** is a single number climbing on a curve. Density, speed and
  the spawn cap all read off it. Nothing is scripted, so no two runs repeat.
- **Grazing charges you.** Passing close to a piece — once per piece, and
  only once it is alongside — fills a meter and pays points. Playing tight
  is how you earn the escape, which is a better loop than handing out a
  panic button for free.
- **PULSE** spends the full meter to shatter everything within 240px. It is
  the comeback move and the greed move at once.
- **Acorns** spill in arcs and build a multiplier that decays in 2.6s, so a
  stream is a line you fly rather than a dot you touch.
- **Gold acorns** drift past alone every 16–30s and pay double.
- **Shield acorns** are the rare one — roughly one in five of those drifts —
  and eat a hit. Both travel slower than the field, so taking one is a
  decision about where you want to be, not a reflex.
- **Surges** every ~30s, announced, briefly denser and faster.
- **Milestones** every 30s.

Score is time survived, plus grazes, plus acorns times the multiplier — so
a careful run and a greedy one can reach the same number by different
routes.

## The two rules that took work

**Debris never collides with debris.** Not simulated — refused. A candidate
piece has its path sampled forward four and a half seconds against every
piece already in flight, and if any sample overlaps, the spawn is rejected
and re-rolled. Straight lines only meet if they are close and closing, so
sampling is exact enough, and it costs nothing next to running a physics
pass every frame. Verified in a live run: zero overlapping pairs.

**A hulk is telegraphed.** The big slow pieces wait offscreen behind a
flashing chevron before they enter. Dying to something you could not yet
see is the one death that is not the player's fault, and this mode has no
gates to read the field by.

## Getting to it

Help (the "?" in the corner) → **SURVIVAL TEST MODE**, under REPLAY
TUTORIAL. Nothing else links to it and it is not on the home menu. The
button is marked in `standalone.ts` with a delete-me note: **it comes out
when the beta freezes**, unless the mode has been promoted by then.

## Tuning notes, so the next pass does not repeat them

- The first build was unsurvivable — an autopilot that actively dodged
  managed **nine seconds**. Two causes. Intensity reached full in 75s while
  scaling density *and* speed, which multiply. And hulks, at one roll in
  ten, still outnumbered every other kind ON SCREEN, because they are slow
  and therefore linger: 196 hulk-frames against 511 tumbler. Two of them
  together sealed the column.
- Fixed by easing the ramp, making hulks rare, late, smaller and capped at
  one at a time, and putting a hard ceiling on concurrent pieces. The same
  autopilot went from nine seconds to thirty-eight.
- Debris used to bounce off the top and bottom of the screen. It does not
  any more: a piece you had already read could come back at you from a
  direction nothing telegraphed, and debris flung across deep space does
  not bounce off anything.
- **The lunge was far too strong at first.** 900px/s for 0.16s covered
  144px of a 210px band, and the slide-out carried it further — one dash
  crossed most of everywhere you are allowed to be, which made horizontal
  room free rather than a resource. Now 320px/s: about a third of the band,
  measured end to end including the slide.
- **Cutting it made the mode harder**, because the density had been balanced
  around a dash that could get you out of anything. The ramp was eased from
  110s to 135s to compensate. Do not read too much into the bot here: its
  median swings between 12s and 18s run to run, which is wider than the
  change being measured. It is a smoke test for "is this survivable at
  all", not a tuning instrument.
- **Four debris paintings were invisible.** Sprites 8, 12, 14 and 22 have a
  mean luminance of 31-58 against a backdrop of 12-28 — not dark objects,
  invisible ones. They are out of the pool, and every remaining sprite now
  gets a light rim baked behind it, the same separation trick the main game
  uses on dark skies. The first rim attempt used a fixed 13px blur, which
  survives as under three pixels once a 256px painting is drawn at 50px;
  the pad and blur scale with the sprite now.
- **Banners used to sit at 30% height**, right in the debris, and pulled the
  eye off the field at exactly the wrong moment. They sit under the meters
  now.
- The pilot is the original animated squirrel, not an equipped suit. Suits
  ship bare-headed now and the game paints a helmet over them from a table
  this file deliberately does not import — a suit here would fly a debris
  field with no helmet on.

## Where it could go

Written to be any of the three things it might become:

- **Its own mode** — it already is one; it needs the game's menu, save and
  XP hooks.
- **An acorn event** — the score already separates time from acorns, so an
  event could pay on either.
- **A stage in a level structure** — swap the endless intensity curve for a
  target ("survive 60s", "collect 20 acorns", "graze 15 times"); the
  counters for all three are already kept.

## Known gaps

- No sound.
- No pause.
- Best score is in `localStorage` under its own key, unconnected to the
  game's save. Nothing here can corrupt a real save.
- The backdrop is procedural — three parallax star layers and drifting
  nebula pools — so it borrows none of the painted skies. Deliberate: this
  should not look like the main game's environments.

---

# THE RIG EDITOR

A fitting bench. It draws heads and helmets exactly the way the game does
and lets you move them with your thumb, then hands the numbers back as
text you can paste into a chat.

```bash
node illustrated-src/build-lab.mjs     # -> docs/lab/rig/js + tables.json
```

Help (the "?" in the corner) → **RIG EDITOR**, under SURVIVAL TEST MODE.
Same delete-when-frozen rule as the Spill.

## What it edits, and what it refuses to edit

Two tables, and only two:

- **DOME** — where each suit's head is, and how big, in that suit's own
  256px canvas. 17 suits plus the 8 flight-animation frames.
- **HELM_GLASS** — where each helmet's glass circle is, and how big, in
  the helmet's own canvas. 20 helmets.

That is 45 triples covering 480 pairings, and keeping it that way is the
whole point. A per-pair table would be 480 entries that every new suit
grows by twenty, and no two of them would ever be checked against each
other again.

So the **EDIT TARGET** switch is the main control, not a detail:

| Target | What moves | What it means |
|---|---|---|
| **HELMET** | that helmet's glass circle | this helmet is wrong on every suit |
| **SUIT HEAD** | that suit's head circle | this suit is wrong under every helmet |
| **THIS PAIR** | a local override | evidence, not a fix — see below |

The views exist to tell those two apart. If one helmet looks wrong on one
suit, switch to **one helmet × all suits**: wrong everywhere means the
helmet's number; wrong on one means that suit's head. **One suit × all
helmets** answers the mirror question. That diagnosis is the work; the
dragging is just how you enter the answer.

## Per-pair overrides

They exist, they are stored, and they are deliberately awkward. An
override never leaves the editor as a value to paste — it comes out in the
report as a comment. Three or more on the same helmet turns on **FOLD**,
which takes their median, converts it into that helmet's own glass numbers
and deletes them. The conversion uses the median head radius of the suits
involved, so it is an estimate; the grid shows you what is left over.

That is the intended use: collect overrides until the pattern is obvious,
fold them, look again.

## Controls

- **Drag a tile** — moves the piece under the current target. The helmet
  follows your finger, so on a 128px tile one pixel of travel is several
  units of the underlying number. That is arithmetic, not a bug.
- **D-pad / arrow keys** — one *unit* per press, whatever the tile size.
  This is the precision control. Hold to repeat.
- **SIZE ± / pinch / scroll** — 2% a step.
- **ROT ±** — 2° a step, about the glass centre.
- **RINGS** — the head circle the contract is built on, and the dashed
  1.04 seat the helmet is actually scaled to.
- **FADE** — helmet at 45%, to see the face under it.
- Keys: `1` `2` `3` switch target, `[` `]` rotate, `+` `-` size,
  shift+arrow for 5.

## Rotation

`HELM_GLASS` grew an optional fourth number — degrees, about the glass
centre — for the asymmetric shells (crown, halo, horn) that sit level in
their own render but want a tilt on a head. No helmet uses it, so every
entry is still three numbers and the game draws exactly as before. The
editor writes it when you rotate something.

## Getting the work back out

**COPY** opens a sheet with the changes and nothing else — unchanged rows
are not printed, so a fitting session is a short paste rather than a dump
of 45 triples. **COPY VALUES** gives paste-ready TypeScript;
**COPY JSON** gives was/now pairs; **DOWNLOAD** writes a file.

Work is kept in `localStorage` under `acornaut.rig.v1` and survives a
reload, so a session on a phone can be picked up later. **RESET ALL** goes
back to the shipping values. Nothing here can write to the repo, and
nothing here can touch a game save.

## Why it starts from the source

`tables.json` is generated at build time by parsing `DOME` and
`HELM_GLASS` straight out of `draw.ts`, and the suit names and flags out
of `catalog.ts`. The parse throws rather than emitting a partial table —
a bench calibrated against numbers the game does not use would be worse
than no bench. It has already caught itself once: `HELM_GLASS` writes some
keys quoted and some bare, and the first version silently dropped Comet.

## What it does not do

- It does not touch per-suit tail pivots, trims or crops.
- It does not fix art. A helmet that is the wrong shape stays the wrong
  shape; this only decides where it sits and how big it is.
- Catsuit is excluded from the matrix — it wears its own head and the game
  never paints a dome on it.
