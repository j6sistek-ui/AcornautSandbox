# Premium pilot release sources

The current release uses the owner's supplied **sixteen complete flight
frames per suit**. The [whole-frame source README](../premium-flight/README.md)
records the active masters, cleanup provenance and deterministic export.
These replace the rejected cut-part assemblies. Reusable
cut kits and further posture proposals remain off repo for later work.

The latest prices supersede the former 2,500-per-suit proposal:

| Runtime id | Character | Required head treatment | Included wake | Individual price |
| --- | --- | --- | --- | --- |
| `porcelain` | Porcelain Paragon | Sovereign Shell, concept helmet B; always worn | Cobalt Filigree | 1,000 Stardust |
| `nacre` | Nacre Envoy | Helmetless by design | Pearl Tide | 1,000 Stardust |
| `origamist` | Foldspace Origamist | Facet Shell; always worn | Foldspace Ribbon | 1,000 Stardust |

**Premium Pilot Trio** (`bundle-premium-trio`) contains all three for
**2,500 Stardust**. The original singleton ids `bundle-porcelain`,
`bundle-nacre` and `bundle-origamist` remain valid. Buying a suit includes
its exclusive wake; the wake is not a separate paid item. Real-money
prices continue to come from the store bridge.

## Whole-frame production boundary

The retained sheet inputs are:

- `art-src/premium-flight/{id}-original.jpg`: supplied original sheets;
- `art-src/premium-flight/{id}-clean.png`: cleaned chroma-green masters;
- `art-src/premium-flight/porcelain-reference.jpg`: the Porcelain cleanup reference.

`illustrated-src/export-premium-flight.mjs` packs each sixteen-frame sheet
into `docs/art/suits/{id}/flight.png`, a 1024×1024 atlas with sixteen
256px cells in source order. `docs/art/suits/{id}.png` is exactly frame zero.
The source `art-src/premium-flight/registration.json` records measured heads,
wake emitters and a constant per-character scale. The exporter generates
`game/premium-flight-frames.ts`; rebuild those outputs from source.

Preserve each supplied pose as a complete character. Background cleanup must
remove cast shadows and Porcelain's surrounding boxes without changing the
approved figure, helmet, face, tail or costume. Packing may translate and
uniformly scale a complete frame; it must not rebuild the body from cut
limbs or reapply the rejected human-like proportions.

The selected Envoy master contains two comparably sized pearl tails with
crossing/overlapping curves and offset authored shapes across the sixteen
whole-body poses. Verify their playback as well as the static silhouettes.
This is frame-authored movement, not a procedural independent-tail rig.

The current runtime uses `game/premium-flight.ts` and generated
`game/premium-flight-frames.ts` to select complete poses and register the
head and wake emitters. The standard High Orbit five retain their separate
cut-rig route. The trio's fixed-head policies still apply in flight,
previews, fallback portraits and cockpit crops, and the player's previous
helmet selection remains stored for another suit.

The `*-parts-master.png` and old attachment/registration files are historical
inputs. The old `export-premium-pilots.mjs` now redirects to the whole-frame
exporter. The shipping premium `parts.png` atlases and `premium-parts.ts`
were retired; the active route cannot use them. Old cut-rig contacts were
removed from the current review folder and remain in Git history. They do not
establish the supplied sheet
release's art quality or runtime behavior. Preserve original concept
boards in `references/` as design provenance. The final sheet export and
review receipts must identify the retained supplied sources and generated
outputs before release.

## Prices and ownership

Singleton prices are pinned at 1,000 Stardust. The rotating trio pack uses its
2,500-Stardust sticker even while featured; it does not receive the ordinary
featured-pack 50% discount. Its three unowned suits remain available on the
single shelf while the pack is featured.

Existing ownership receives the repository's normal proportional credit:
2,500 for three unowned suits, 1,670 for two, 830 for one, and zero when all
are owned. Repeated purchases do not charge again. No new save fields or
ownership migration are required.

## Rebuild and verification

Use the container workflow in [AGENTS.md](../../AGENTS.md), or its documented
existing-tool fallback when Docker is unavailable. Do not install host
system packages. Rebuild the source export, lab and Flight Studio from the
completed sheet sources before running the full checks in
[SHIPPING.md](../../SHIPPING.md).

`test-premium-pricing.mjs` exercises the real production and beta Shop,
including individual checkout while the trio pack is featured, the trio
checkout, all ownership subsets, included wakes and save/reload. The
full-frame render and playback checks must cover every supplied frame,
transparent edges, cleanup, source order, proportions and fixed-head
behavior. Previous cut-rig test results are not evidence for this release.

Current visual and complete-gate status is recorded in the
[validation record](../../illustrated-src/design/premium-pilots/VALIDATION.md).
Do not claim acceptance until the new outputs have been inspected.

The generated premium flight lab loads the whole-frame banks and supports
all sixteen direct frame choices, Previous/Next, Play/Pause, manual and
repeated taps, normal/quarter speed, exact 52px display scale and larger
views, light/dark backdrops and wakes. Its frame counter follows the same
shared playback selector used by the game.

Nocturne Atelier, Calibre Meridian, Wayfarer Atlas, Velvet Navigator and
Rivet & Ribbon remain [proposal cards](../../illustrated-src/design/premium-pilots/proposals/README.md)
only. No new production art is authored for those five.
