# FLIGHT LAB

A bench for finding the right flight animation by ear, not by argument.
Nothing here is in the game and nothing here can change it: it is a single
static page that loads its own copy of the frames.

Open `lab/flightlab/` and it flies itself.

## What it does

The squirrel flies a fixed pattern on a loop against a blank scroll — no
gates, no planets, nothing to read but the pilot. The pattern covers the
cases that look different from each other:

    QUICK ASCENT -> DESCENT -> LEVEL TAPS -> STAGGERED RISE -> SLOW DESCENT

There is no interaction with the flight. You watch it, and you change the
frames underneath it.

## The cues

Two ordered lists — CLIMB and DIVE. Whichever way the pilot is going picks
the list, and how hard it is going picks the index, exactly as the game
does it. So **index 1 is what you see in level flight and the last index is
the hardest case**, which is why the order matters more than the frames.

Drag from the palette into a cue, drag within a cue to reorder, drag out or
tap to remove. Pointer events throughout, so a finger works the same as a
mouse — HTML5 drag-and-drop was tried first and does not fire on touch at
all, which would have made the tool dead on a tablet.

The frame currently on screen is ringed in gold in the cue, so you can see
which one is responsible for what you are looking at.

Work is kept in `localStorage`, so a session survives a reload. COPY puts
the two cues on the clipboard as JSON; that is the thing to hand back when
an order feels right.

## The frames

105 of them, and none were generated for this:

* **source asc / desc** — 36 each, the full physics renders. Only 8 of each
  were ever picked for the game, so 56 of these have never been seen in
  motion.
* **tap bank** — the 16 shipped tap frames.
* **shipped asc / desc** — the 8 + 8 currently in the game, which is what
  the cues start seeded with, so the first thing you see is today's
  behaviour.

Everything is normalised onto the game's 256px canvas at build time, so
what the bench draws is what the game would draw.
