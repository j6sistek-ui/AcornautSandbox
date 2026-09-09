# Premium pilot whole-frame sources

This release uses sixteen complete character poses each for Porcelain
Paragon, Nacre Envoy and Foldspace Origamist. The supplied sheets replace the
rejected cut-part rigs. Reusable cut kits remain outside this release.

Porcelain always wears Sovereign Shell (helmet B); Nacre is helmetless by
design; Origamist always wears Facet Shell. Each suit costs 1,000 Stardust,
or all three cost 2,500 in Premium Pilot Trio. Each purchase includes its
signature wake. See the [pricing and ownership contract](../premium-pilots/README.md).

## Retained sources

- `porcelain-original.jpg`, `nacre-original.jpg` and
  `origamist-original.jpg` retain the supplied sixteen-frame sheets.
- `porcelain-reference.jpg` is the supporting Porcelain identity reference.
- Each `{id}-clean.png` is the final chroma-green master selected for export.
  Creative cleanup removes cast ground shadows; Porcelain's detached boxes
  and boxes over the fur are removed while restoring the continuous tail.
- [cleanup-prompts.json](cleanup-prompts.json) records the initial cleanup
  briefs. The original character self-shading and source pose order are
  retained; the green matte is removed during mechanical export.
- Nacre's subsequent tail edits are recorded in
  [nacre-twin-tail-prompt.txt](nacre-twin-tail-prompt.txt),
  [nacre-interwoven-tails-prompt.txt](nacre-interwoven-tails-prompt.txt) and
  [nacre-equal-crossing-tails-prompt.txt](nacre-equal-crossing-tails-prompt.txt).
  The final `nacre-clean.png` contains two comparably sized pearl tails with
  crossing/overlapping curves and offset shapes through the sixteen poses.
  This motion is authored into whole frames, not a procedural tail rig.
- `nacre-single-tail-clean.png` and `nacre-separated-tails-rejected.png`
  retain earlier provenance only. Neither is read by the shipping exporter.

## Extraction and registration

[registration.json](registration.json) records source-space cranial centers,
radii and two rear-paw wake emitters per frame. Nacre's release registration
includes the corrected rear-paw emitter positions. The cranial measurements
exclude ears, fins and tails; they are not bounding circles around the entire
head.

`illustrated-src/export-premium-flight.mjs` removes the green matte and its
connected edge spill, then isolates each complete connected character from
its measured head seed. The 4×4 grid determines frame order, not hard crop
boundaries: a tail extending into the next cell's empty margin is retained.
The exporter rejects any component containing another character's head.

Each character uses one constant uniform scale across all sixteen poses.
Translation places the measured head center at **(180, 84)** in every 256px
cell. The initial scale targets a 35px cranial radius and is reduced once,
if needed, to fit the entire cycle. It is never adjusted independently per
frame. The configured fit uses 10px padding; the final alpha check enforces
at least 8px after resampling. No body reconstruction or limb transformation
is applied.

## Generated outputs

- `docs/art/suits/{id}/flight.png`: 1024×1024 RGBA atlas, sixteen 256px cells
  in the original left-to-right, top-to-bottom order.
- `docs/art/suits/{id}.png`: exact frame-zero fallback portrait.
- `illustrated-src/game/premium-flight-frames.ts`: frame count, head,
  radius and wake-emitter registration used by the shared whole-frame painter.
- [export-receipt.json](export-receipt.json): original/master/atlas hashes,
  constant scales, per-frame source/output bounds and RGBA hashes.
- `illustrated-src/design/premium-pilots/{id}-frames.png` and
  `{id}-frame-registration.png`: alternating light/dark contacts and measured
  source overlays for review.

The current receipt contains all **48 frames**. The constant scales are
0.6930693069 for Porcelain, 0.7115384615 for Nacre and 0.7142857143 for
Origamist. Their observed minimum output margins are 30px, 10px and 15px
respectively; maximum measured green excess is 6 for all three. These are
export measurements, not a substitute for appearance and playback review.

## Rebuild and review

Follow [AGENTS.md](../../AGENTS.md) and [SHIPPING.md](../../SHIPPING.md).
The sandbox export runs the whole-frame exporter before compiling the game:

```sh
node illustrated-src/export-sandbox.mjs
node illustrated-src/build-lab.mjs
node illustrated-src/build-flight-studio.mjs
node illustrated-src/test-premium-pilots.mjs
node illustrated-src/test-premium-pricing.mjs
```

The old `export-premium-pilots.mjs` entry point redirects to this exporter;
it no longer produces cut rigs. The premium shipping `parts.png` atlases
and `game/premium-parts.ts` are retired. Original cut masters are historical
provenance and are not read by the whole-frame route.

Use the premium lab to inspect every frame, full playback and repeated taps
at normal/quarter speed, game size and close range, with light/dark surfaces
and wakes. Current release checks and visual observations belong in the
[validation record](../../illustrated-src/design/premium-pilots/VALIDATION.md).
