# The Spill ship: one hull, three swappable parts

Sixteen sprites, all 256x256 RGBA, all sharing one frame. Layer them in
this order and they register to the pixel:

    hull-N  ->  thrust-N  ->  cone-N  ->  cockpit-N

`frame.json` records the source crop (in the render's pixel coordinates,
extended left and right for the level-3 parts) and the tile size inside the
256 box. Every sprite was cut from that one frame, so no per-part offsets
are needed: draw them all at the same rect.

## The four axes

| axis           | Depot meter        | levels                                        |
|----------------|--------------------|-----------------------------------------------|
| `hull-0..3`    | Plating (material) | rusted sheet steel, bronze, polished silver, white composite |
| `cone-1..3`    | Power-ups          | silver, gold, geared drill with a lit blue tip |
| `thrust-1..3`  | Thrusters          | ringed bell, three nozzles, red finned engine  |
| `cockpit-1..3` | Shield             | visor, side windows, sealed canopy            |

Level 0 of cone, thrust and cockpit is "draw nothing": the bare hull already
carries a plain nozzle, a plain nose and an open cockpit.

Alternates, cut and registered but not in the ladder: `cone-3-gold` (the
armoured gold cone), `thrust-1-alt` (the engraved bell from the silver
hull), `hull-2-blue` (the blue-steel hull the silver one replaced).

## How the cuts were made

**Background.** Alpha is flood-filled inward from the frame edge. That is
deliberate rather than a threshold: an OPEN cockpit is reachable from the
background through its own mouth, so it clears and the pilot shows through,
while a SEALED canopy is not reachable, so it stays opaque and hides the
pilot. That is the shield ladder's behaviour, and it falls out of the fill.

**Brightness.** Each hull is gamma-lifted onto a rising ladder (median lit
value 90, 117, 151, 181) so an upgrade reads as progress at flight size,
where the ship is 58px against deep space. The source renders all sat at
61 to 81 and were indistinguishable that small.

**Parts are cut at their seam, never by a band or a pixel difference.**
Every render re-rolls the hull texture (mid-hull correlation against the
base runs 0.44 to 0.95), so any difference mask drags a patch of mismatched
hull along with the part. Instead:

- *thrusters* keep everything left of the collar seam, found as the
  leftmost point of the egg's outline on rows the nozzle does not occupy.
  The level-3 engine is a standalone render, scaled so its bell matches
  the base nozzle's 306px and set with its collar on that seam. It is
  drawn whole over the tail: with the body hidden inside the hull its fins
  fall inside the silhouette too, and level 3 reads as a bare nozzle.
- *cones* are the bright metallic blob past the nose band. The geared
  level-3 cone is a standalone render mounted at the nose seam and scaled
  to the hull's height there.
- *cockpits* are the gold rim plus glass plus the base hull's open hole,
  taking only the connected blob that contains the hole, and nothing below
  the rim.

## Known gaps

- The tinted canopies read as a dark opening at 58px, much like the bare
  cockpit. If the shield level must read in flight, the canopy wants a
  bright highlight, or it should be drawn in code over the cockpit region.
- The geared cone's mechanical detail is lost at 58px; what survives is a
  dark cone with a lit blue tip, which is still a distinct top tier.
- The renders are photoreal studio shots; the rest of the game is painted
  illustration. They carry best at Depot-card size.
- Nothing loads these yet. Whether they are loadout skins or mid-run
  upgrades is still open, and the layer contract above serves either.
