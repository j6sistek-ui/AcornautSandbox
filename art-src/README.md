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
# a character render -> a 256px sprite with a clean edge
python3 illustrated-src/key-render.py art-src/suit-flight-master.png docs/art/suits/flight.png

# then measure its head circle and paste the line into draw.ts
python3 illustrated-src/measure-art.py suit docs/art/suits/flight.png

# and cut the tail into its own hinged layer
python3 illustrated-src/rig-tail.py cut docs/art/suits/flight.png
```

A render that already has a transparent background needs no keying —
`key-render.py` notices and just resizes it. Ask for transparency; it is
better than any cut, and it is the only thing that fixes a character
painted the same colour as its backing paper.
