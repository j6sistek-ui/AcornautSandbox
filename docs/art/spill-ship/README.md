# The Spill ship: one hull, three swappable parts

Fourteen sprites, all 256x256 RGBA, all sharing one frame. Layer them in
this order:

    hull-N  ->  thrust-N  ->  cone-N  ->  cockpit-N

`frame.json` records the source crop and the tile size inside the 256 box.
`manifest.json` names the hulls and the parts per axis; the Ship Bench
reads it, so a new part is a file plus one line there.

**Fit is done by hand, not by the cut.** `docs/lab/ship/` is a fitting
bench: pick a hull, an axis and a level, drag, scale and turn the part,
and export one transform per part (offset, scale, rotation in this 256px
frame), with optional per-hull overrides. That JSON is what the painter
will consume. The cuts below only have to be clean; they do not have to
be perfectly registered.

## The four axes

| axis           | Depot meter        | levels                                        |
|----------------|--------------------|-----------------------------------------------|
| `hull-0..3`    | Plating (material) | rusted sheet steel, bronze, polished silver, white composite |
| `cone-1..3`    | Power-ups          | silver, gold, armoured gold                    |
| `thrust-1..3`  | Thrusters          | ringed bell, three nozzles, white side pods    |
| `cockpit-1..3` | Shield             | visor, side windows, sealed canopy            |

Level 0 of cone, thrust and cockpit is "draw nothing": the bare hull already
carries a plain nozzle, a plain nose and an open cockpit. `hull-2-blue` is
the blue-steel hull the silver one replaced, kept as an alternate.

## Where the cuts came from

- **hulls**: the full renders, gamma-lifted onto a rising brightness ladder
  (median lit value 90, 117, 151, 181) so an upgrade reads as progress at
  the 58px the mode flies at. Background alpha is flood-filled inward from
  the frame edge, so the open cockpit clears and the pilot shows through.
- **cone-1..3, cockpit-1..3, thrust-3**: the owner's own cuts of the part
  renders, delivered with alpha on a 1500x1010 canvas that is a uniform
  0.876 scale of the render frame. Scaled back up and given the same gamma
  lift as the rust hull they were rendered on. They register within a
  pixel of the renders.
- **thrust-1, thrust-2**: cut from their renders at the collar seam,
  everything left of the egg's leftmost outline point.

## Known gaps

- A thruster smaller than a hull's stock nozzle shows that nozzle behind
  it. The silver hull's ornate bell is the visible case. The fix is a bare
  hull plus a level-0 nozzle overlay; deferred until the fit is settled.
- The tinted canopies read as a dark opening at 58px. If shield level must
  read in flight, the canopy wants a bright highlight, or code over the
  cockpit region.
- Nothing loads these yet. Loadout skins or mid-run upgrades is still
  open; the layer contract and the bench's JSON serve either.
