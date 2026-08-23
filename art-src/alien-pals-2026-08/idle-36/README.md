# Alien 36-frame sheet — culled

Same treatment as the neon sheet, same reasons.

`keep/asc-1..6.png` are frames 0-5: airborne, head leading, feet/body
motion ratio 1.48 against Eclipse's 1.5.

Culled:

* **Frames 16-35 are GROUNDED** — they stand on a surface with a CAST
  SHADOW painted into the frame. That is a hard reject for this game
  whatever else is right about them: the game is flight only, and a
  shadow lying under a character in open space has nothing to fall on.
  They barely move either (foot motion 0.052), so they are a settled idle
  rather than any part of a climb.
* **Frames 6-15** measure 2.00 on the feet/body ratio, at the limit, with
  foot motion 0.559 — more than four times the kept group's 0.122. The
  body has stopped leading and the legs are carrying the animation alone.

Everything culled is in `culled/` under its original frame number.
