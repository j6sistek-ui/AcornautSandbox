# Alien sheets, August 2026

Two generated sheets, three characters each, split into one keyable master
per figure by `illustrated-src/cut-sheet.py`. The sheets are the originals
as they arrived; the `-master.png` files are the cuts.

SHIPPING: `green-a-redblue-master.jpg`, the red/blue pair, cut with
`two-plate-matte.py`. The first attempt cut `green-a-master.png` off the
dark sheet and left a black rim round the tail; the white plate only
traded it for a pale one. The pair solves alpha exactly and the result
holds on white, on the night sky and on red alike.

`green-a` (the dark-sheet cut) was the first pick for the suit. It was picked over its two
siblings for the silhouette closest to the retired Alien — tail up and
curling back — and for having the clearest gap between tail and rump,
which is what `neck-cut.py` needs to split the rig without taking the
hind foot with it.

Everything else here is STORED, NOT LOADED. Nothing under `art-src` is
served, and none of these five have a catalog entry, so they cost the
game nothing:

  green-b, green-c   the two unused poses of the same alien
  magenta            pink, cyan-spotted, blue-lit tail
  chrome             silver and gold plating, violet trim
  cosmos             deep indigo with a galaxy tail and orange spots

To ship one, follow the pipeline in `art-src/README.md`: `fit-suit.py`,
then `measure-art.py`, then `neck-cut.py`, and add a SUITS row. The three
coloured ones read as their own characters rather than Alien variants, so
each wants its own name and its own catalog entry, not a reskin.

Note on helmets: the Alien is `ownHead: true` and wears none — its head is
the cosmetic, antennae and all. Any of these five would inherit the same
problem if fitted for a dome, because this generation draws the head about
14% larger against the body than the rest of the family, which is outside
the window `verify-art.py` holds every helmet-wearing suit to.
