# Natural flight cycle — Flight suit (Ludo)

One continuous cycle instead of separate tap / bounce / ascent / descent
banks: level glide -> nose lifts into the climb -> eases through the arc ->
tips nose-down into the glide descent -> back to level. 16 frames, 2s,
256x256 RGBA, seamless loop.

## What is here

* `f01..f16.webp` — the take-3 cycle (the one to judge)
* `natural-flight-cycle.mp4` — same cycle as video
* `c2a/c2b.webp`, `d2a/d2b.webp` — the climb and descent keyframes the
  cycle was anchored on

## How it was made, and what went wrong first

`animateSprite` with a text prompt alone was unusable: the model rewrote
the character (the jacket vanished) and the scale drifted frame to frame.
Motion stability is rated 5/10 on that model and it shows.

`generatePose` -> `animateSpriteKeyframes` fixed it. Posing preserves the
character, so anchoring the animation on real poses holds identity that a
text prompt cannot.

The trap in between is worth recording: the first pose pass asked for a
"white-grey spacesuit with backpack", which is NOT what Flight wears. The
model drew exactly that, and the cycle changed outfit halfway through
because the static keyframe disagreed with the generated ones. Flight is
an orange squirrel in a BEIGE-TAN flight jacket, silver-grey neck ring,
small grey disc on the flank, small square chest buckle, bare orange arms
and legs, bare head, no helmet. Describe the character truthfully or the
generator will faithfully draw the wrong one.

## Open note

Pitch overshoots at both ends: the climb frames rear close to upright and
the last descent frames approach vertical. Eclipse had the same problem and
the fix there was to exclude the late vertical frames rather than reshoot,
so the same trim is likely here.

Ludo asset URLs expire after 7 days. Everything needed is archived in this
directory; do not rely on the storage.googleapis.com links.
