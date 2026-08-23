# Motion transfer

`eclipse-motion.mp4` is one full oscillation of Eclipse's shipped banks —
deep climb, through level, into the deep dive and back — rendered from the
game's own frames at 12fps. It exists so other characters can inherit the
flight that was actually approved, rather than a generic "flying" preset or
a text description of one.

    transferMotion(image = <suit static>, video = <this clip>)

One call per character, against 72 authored frames. `flight-transfer/` is
the first result.

## What it got right

Identity survives, which is the thing text-prompt animation destroyed
outright: the beige-tan jacket, silver collar, chest buckle and bare limbs
are correct on all sixteen frames. The arc is recognisably the source
motion.

## What to check before trusting it

Scale wander is the risk, because the game's registration assumes a
character that does not pulse. Measured as coefficient of variation across
a bank:

    transfer -> flight      bbox W  8.3%   bbox H 13.1%   ink 9.2%
    eclipse asc (shipped)           4.1%          1.9%        8.7%
    eclipse desc (shipped)          7.3%          4.5%        8.2%
    robo tap (approved)             7.3%          5.4%        4.6%

Height wander is roughly three times the shipped banks. That is what
head-normalisation exists for, so a transfer result should go through the
same pass before it ships — `track-head.py` finds the head on any suit
regardless of fur colour, which is exactly the case this creates.

The deep-dive frames (5-9) also read more tucked and more vertical than
Eclipse's, so the sampling that picks eight of these for a bank should skip
the extremes, the same lesson the first Eclipse pass taught.

## Practical note

The call takes longer than the MCP client's 60 second limit and appears to
time out. It has NOT failed: the job completes server-side and the result
is retrievable with `getSpriteResults` under the `request_id` you passed.
Always pass one.
