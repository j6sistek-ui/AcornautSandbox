# art-src — the masters

Original renders and footage, at the size they arrived. Nothing here is
served: the game only ever reads the cut, resized copies under
`docs/art/`. Keep these so a sprite can be re-cut without asking for the
art again, and so every future encode starts from the master rather than
from something already compressed once.

They land in the repo root when uploaded through GitHub's web UI. Move them
here and give them a name that says what they are.

## Turning a master into game art

```bash
# a character render -> a 256px sprite, cut and seated in the family's framing
python3 illustrated-src/fit-suit.py art-src/suit-flight-master.png docs/art/suits/flight.png

# then measure its head circle and paste the line into draw.ts
python3 illustrated-src/measure-art.py suit docs/art/suits/flight.png

# and cut the tail off at the neck, pasting the printed TAIL_PIVOT back
python3 illustrated-src/neck-cut.py docs/art/suits flight
```

## Cutting a render off its plate

Ask for TWO renders of the same pose on two strongly different plates -- red
and blue works -- and use the two-plate solver. It is the only method here
that does not guess:

```bash
python3 illustrated-src/two-plate-matte.py art-src/pair.jpg /tmp/cut.png
python3 illustrated-src/fit-suit.py /tmp/cut.png docs/art/suits/alien.png
```

A single plate gives one equation, `P = C*a + B*(1-a)`, with four unknowns,
so every single-plate cut leaves some plate in the half-covered pixels: a
black rim off a dark sheet, a pale rind off a white one. The Alien shipped
with the black rim once and it was rejected on sight. Two plates cancel the
unknown colour and both alpha and the true paint fall out exactly.

Test any cut on WHITE, on the night sky, AND on a saturated colour. A cut
that holds on all three has no plate left in it; one that only looks right
on the sky is hiding its rim, not missing one.

`matte-render.py` is the fallback when only one plate exists: it solves the
same algebra with the foreground colour estimated from the nearest certain
pixel. Better than a threshold, still an estimate.

`cut-sheet.py` splits a multi-character sheet into one master per figure
first, keeping each figure's glow and dropping every neighbour's ink.

Use `fit-suit.py`, not `key-render.py` directly: it keys at the master's own
resolution and takes ONE downscale to the family's size, instead of keying
to 256 and resampling whatever framing the render happened to arrive with.

`rig-tail.py` still has `audit` (the check that a split is lossless and does
not ghost) and `transfer` (carry a known-good split onto a re-render of the
same pose). Its `cut` is superseded by `neck-cut.py`, which is the only one
that keeps the rump and the hind foot OUT of the tail.

A render that already has a transparent background needs no keying —
`key-render.py` notices and just resizes it. Ask for transparency; it beats
any cut. And a PALE character needs a BLACK plate: Ghost is painted within
12 of the cream out of 765, and nothing recovers that.
