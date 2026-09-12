# Premium pilot whole-frame sources

**Historical bank, superseded 12 September 2026.** Percy, Envoy and Patriot
now follow the owner's Cyber-transfer request in
[`../cyber-standard-trio/README.md`](../cyber-standard-trio/README.md).
The sources and receipts below preserve the preceding sixteen-frame work.
Both premium export entry points now redirect to `export-cyber-trio.mjs`;
this historical bank must not overwrite the new paintings or registration.

This release uses sixteen complete character poses each for Porcelain
Paragon, Nacre Envoy and Foldspace Origamist. The supplied sheets replace the
rejected cut-part rigs. Reusable cut kits remain outside this release.

Porcelain always wears Sovereign Shell (helmet B); Nacre is helmetless by
design; Origamist always wears Facet Shell. Each suit costs 1,000 Stardust,
or all three cost 2,500 in Premium Pilot Trio. The bundle and unowned singles
are available every day, independently of the rotating featured pack.
Each purchase includes its signature wake. See the
[pricing and ownership contract](../premium-pilots/README.md).

## Retained sources

- `porcelain-original.jpg` and `origamist-original.jpg` retain their supplied
  sixteen-frame sheets. `nacre-original.jpg` is the latest owner-supplied
  replacement (attachment `0084A7E8`), superseding the earlier Envoy source.
- `porcelain-reference.jpg` is the supporting Porcelain identity reference.
- Each `{id}-clean.png` is the current chroma-green master selected for export.
  Creative cleanup removes cast ground shadows; Porcelain's detached boxes
  and boxes over the fur are removed while restoring the continuous tail.
- [cleanup-prompts.json](cleanup-prompts.json) records the initial cleanup
  briefs. Nacre's active replacement brief is
  [nacre-owner-replacement-prompt.txt](nacre-owner-replacement-prompt.txt).
  Its current `nacre-clean.png` is **1212×1297**. The brief requires two
  equally substantial pearl-lilac tails with distinct adjacent roots at the
  back of the rump: relaxed separate curls, a sweep into flight, a brief loose
  crossing/braid, then an unwind to separate curls. The braid must not remain
  throughout the cycle. Motion is authored in whole frames, not a procedural
  tail rig. Playback and browser findings are recorded in the release validation.
- `nacre-initial-original.jpg` retains the first supplied Envoy sheet.
  `nacre-permanent-braid-superseded.png` retains the previous exported master;
  it is not the current candidate. Earlier tail edits are recorded in
  [nacre-twin-tail-prompt.txt](nacre-twin-tail-prompt.txt),
  [nacre-interwoven-tails-prompt.txt](nacre-interwoven-tails-prompt.txt) and
  [nacre-equal-crossing-tails-prompt.txt](nacre-equal-crossing-tails-prompt.txt).
- `nacre-single-tail-clean.png` and `nacre-separated-tails-rejected.png`
  also retain earlier provenance only. The exporter reads only the current
  `{id}-clean.png` masters; none of the superseded Nacre masters is shipped.

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

The current receipt contains all **48 frames**:

| Pilot | Constant scale | Minimum output margin | Maximum green excess |
| --- | ---: | ---: | ---: |
| Porcelain | 0.6930693069 | 30px | 6 |
| Nacre, latest owner replacement | 0.6967213115 | 10px | 6 |
| Origamist | 0.7142857143 | 15px | 6 |

The Nacre receipt identifies original `ace482d2…`, cleaned master
`94fe0291…` and atlas `ee3dc128…`; full SHA-256 values are in the linked
receipt. These export measurements do not establish appearance acceptance
or completion of playback and browser checks.

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
