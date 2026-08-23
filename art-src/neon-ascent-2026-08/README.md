# Neon ascent sheet, August 2026

A 36-frame CLIMB: the character flying upward, head leading the direction
while it accents. Delivered already transparent, so nothing needed keying.

The character has no name and no catalog entry yet. Nothing here is
served - `art-src` is not shipped - so this costs the game nothing until
someone wants it.

## What was kept

`keep/asc-1..9.png`, in that order, are the ascent ramp: climb angle 22
degrees rising to 34, one step per frame, which is the order the game
wants. `suitAsc` is indexed by climb INTENSITY, not by time - asc[0] is
level and asc[n-1] is the hardest climb - so a bank has to ramp, and the
delivered frame order does not.

Measured on the feet/body motion ratio, the number that predicted Flight's
buzzing feet: this ramp is 1.18, against 1.5 for Eclipse, the bank that is
known to read right.

## What was culled, and why

Frames 6-14 are the dip. The climb angle collapses from 33 degrees to 20,
which is the head giving up the lead and the body flattening out, and the
feet then carry the motion on their own: feet/body 2.34 against a limit of
2.0. That is the same defect the owner caught on Flight and described as
buzzing, and it is invisible frame by frame - it only shows when the bank
plays.

Frames 26-35 hold the top of the climb almost perfectly still - foot
motion 0.034, where the ramp runs at 0.19. Ten near-identical frames are
ten downloads that add nothing, so one of them (31) stands for the group.

The rest are near-duplicates of kept frames at the same climb angle.

Every culled frame is in `culled/` under its original number. Nothing was
deleted - the judgement here is about what suits a side-on flight game,
not about the art, and a different use may want exactly what this rejects.

## Note for the next sheet

A generator does not know this game's limits and is not being careless
when it breaks them: it was asked for a climb and it gave a climb that
also lands and settles. The parts to ask for are a MONOTONIC ramp and no
ground contact - no cast shadow, since a shadow in open space is wrong
however good the frame is.
