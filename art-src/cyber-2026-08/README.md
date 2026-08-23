# Cyber — sheets and cut

Beta-only suit, `id: "cyber"`. Wears its own neon helmet, so `ownHead:
true` and no DOME entry, the same as Volt, Cat and the Alien.

## What ships

  static-master.png      frame 1 of the ascent sheet, fitted to suits/cyber.png
  glide/keep/desc-1..9   the ONE motion bank, shipped as BOTH asc and desc
  keep/asc-1..9          the ascent sheet's own ramp - NOT shipped, kept for
                         comparison in case the one-bank approach is dropped

## One bank, played both ways

The owner's call, and it is the better build. The bank is the glide ramp:
frames 7-15 of the descent sheet, climb angle 23 degrees easing to 11, and
it carries how far the body EXTENDS rather than which way it points. The
DIRECTION comes from the rig, which pitches the whole character onto the
tangent of its flight path in heading mode. So nine frames read as a climb
and a dive, instead of two sheets that never quite agree where they meet.

That agreement is the real prize. Two painted banks meet at a seam the
player crosses several times a second while holding a hover, and the two
sheets here start 11 degrees apart - asc at 22, desc at 33. One bank has no
seam to cross at all.

`RIG_PITCH_WITH_BANK` in draw.ts is what allows it: a painted bank normally
suppresses the rig pitch, because a bank that carries its own attitude
would otherwise be rotated twice.

Measured on the feet/body motion ratio, the number that predicted Flight's
buzzing feet: this bank is 0.75, against 0.98 for Eclipse's dive.

## Known, and deliberate

* The tail is PAINTED INTO the bank frames, so it does not swing on its own
  while the bank is playing - `RIG_TAIL_TRAIL` moves the rig tail, and the
  rig tail is not drawn under a full-character frame. Splitting all nine
  frames into body and tail layers would give live tail physics on top of
  the bank. It is not done here.
* The bank's own attitude runs nose-DOWN across the ramp, so on a climb it
  works slightly against the pitch and on a dive slightly with it. The
  built-in swing is 12 degrees against the rig's 14 up and 30 down, so the
  rig wins, but the climb reads a little softer than the dive.
* Art loads on BOTH pages. `RIGGED_SUITS` and `suitIds` gate on
  BETA_FEATURES, which is true everywhere since the promotion, while the
  catalog hides the suit with `beta: true` on IS_BETA. So live downloads
  art it will never draw. That is how all eight existing beta suits already
  behave; fixing it is a separate job across all nine.

## Culled

`culled/` holds the 27 unused ascent frames and `glide/culled/` the 27
unused glide frames, each under its original number. See the cull notes in
the commit history: the ascent sheet's dip measured 2.34 on feet/body
against a 2.0 limit, and the glide sheet's last third has a cast shadow
painted in, which has nothing to fall on in open space.
