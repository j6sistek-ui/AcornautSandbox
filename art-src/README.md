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
