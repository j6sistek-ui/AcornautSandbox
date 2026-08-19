# The Lab

Prototypes. Nothing here is imported by the game and nothing here is in the
main build; the only thread back is one hidden button at the bottom of
Help, which is a link to a separate page rather than a dependency. A lab
experiment can be kept, reworked or deleted without touching a build that
is close to shipping — that isolation is the point, and it is why
`build-lab.mjs` is separate from `export-sandbox.mjs`.

```bash
node illustrated-src/build-lab.mjs        # -> docs/lab/spill/js
node illustrated-src/lab/pack.mjs         # -> one self-contained .html
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
| **Swipe left / right** | **lunge** — a short horizontal dash on a half-second cooldown |
| **PULSE** button | shatters everything close, once the meter is full |

Keyboard: space/↑ thrust, ↓ dive, ←/→ lunge, P pulse.

**Why the lunge earns its place.** Every other control trades height. In a
field that arrives at an angle, height is often not the axis with an answer
in it — the gap is behind the piece, or in front of it. The lunge is the
only move that spends horizontal room, and horizontal room is finite: the
pilot roams the left 8%–62% of the screen and no further. Forward closes on
an acorn stream and on the edge where debris is newest and least readable;
back buys reading time and crowds you toward a wall you cannot pass. That
tension is the mode.

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
