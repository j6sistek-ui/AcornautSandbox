# The Spill ship: one hull, three swappable parts

Thirteen sprites, all 256x256 RGBA, all sharing one frame. Layer them in
this order and they register to the pixel:

    hull-N  ->  thrust-N  ->  cone-N  ->  cockpit-N

`frame.json` records the source crop and the tile size inside the 256 box.
Every sprite was cut from the same shared frame, so no per-part offsets are
needed: draw them all at the same rect.

## The four axes

| axis        | meter in the Depot | levels                                   |
|-------------|--------------------|------------------------------------------|
| `hull-0..3` | Plating (material) | rusted sheet steel, bronze, blue-steel, white composite |
| `cone-1..3` | Power-ups          | silver, gold, armoured gold              |
| `thrust-1..3` | Thrusters        | ringed nozzle, three nozzles, side pods  |
| `cockpit-1..3` | Shield          | visor, side windows, sealed canopy       |

Level 0 of cone, thrust and cockpit is "draw nothing": the bare hull already
carries a plain nozzle, a plain nose and an open cockpit.

## How the cuts were made

The background is alpha'd by flood-filling the dark region inward from the
frame edge. That is deliberate rather than a plain threshold: an OPEN
cockpit is reachable from the background through its own mouth, so it
clears and the pilot shows through it, while a SEALED canopy is not
reachable, so it stays opaque and hides the pilot. That is exactly the
behaviour the shield ladder wants, and it falls out of the fill for free.

Each hull is gamma-lifted onto a rising brightness ladder (median lit value
90, 117, 137, 181) so an upgrade reads as progress at flight size, where
the ship is only 58px against deep space. The source renders all sat at
61-76 and were indistinguishable that small.

Part overlays are masked two different ways, because the parts differ in
kind:

- **cone and thrust** extend past the hull silhouette, so they are cut on
  their own outline inside a band at the nose or the tail.
- **cockpit** is a hole in the hull, so it is cut by the hole itself: the
  mask is the region where the bare hull is see-through, dilated slightly
  to catch the gold rim. Cutting it by pixel-difference does not work -
  each source render re-rolls the hull texture (mid-hull correlation
  against the base runs 0.44 to 0.95), so a difference mask drags a patch
  of mismatched hull along with the canopy.

## Known gaps

- The tinted canopies read as a dark opening at 58px, much like the bare
  cockpit. If the shield level needs to read in flight, the canopy wants a
  bright highlight, or it should be drawn in code over the cockpit region.
- The renders are photoreal studio shots; the rest of the game is painted
  illustration. They carry best at Depot-card size.
- Nothing loads these yet. Whether they are loadout skins or mid-run
  upgrades is still open, and the layer contract above serves either.
