# New beta suit options

Eight owner-supplied suit and matched-helmet pairs live here as untouched
high-resolution masters. `build_new_options.py` keys and fits their base
runtime PNGs. The four helmets with a complete painted subject inside the
visor remain opaque in the renderer; the four empty bubbles are punched so
the squirrel remains visible.

Build order:

1. `python3 art-src/new-suits/build_new_options.py`
2. Run `illustrated-src/neck-cut.py` once for these eight IDs and paste its
   measured pivots into `game/draw.ts`.
3. Run `art-src/tap-rollout/build_robo_motion_banks.py` for these eight IDs.
4. Run the art, motion-bank, TypeScript, and phone-scale visual checks.

Do not run `neck-cut.py` twice on the same generated pair; it deliberately
uses the current split as a seed and is not idempotent.

Groveguard is the reviewed exception: its backpack foliage confuses an
unseeded geometric cut. Transfer Cinderforge's same-pose mask first, then run
one reviewed neck cut from that seed. Its accepted hinge is `[102, 130]`.
