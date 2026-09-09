# Premium pilot production review

The production selection is **Porcelain Paragon with Sovereign Shell (B),
always worn; Nacre Envoy, helmetless by design; and Foldspace Origamist with
Facet Shell, always worn**. The owner confirmed 2,500 Stardust for each fixed
cosmetic kit. Each includes its matching wake: Cobalt Filigree, Pearl Tide
and Foldspace Ribbon respectively.

The [five remaining proposal cards](proposals/index.html) reuse existing
artwork only. They are not additional production kits or catalog entries.

[Validation and browser evidence](VALIDATION.md) records the passing checks
and the inherited Arcflash failure that keeps this PR in draft.

## Review surfaces

- [Pose contact](pose-review.png): climb, glide and dive at the 192px canonical
  reference, plus each character at the 52px flight reference.
- [Production contact](production-review.png): the same flight attitudes,
  small-scale views, fallback portraits, cockpit heads and fixed-head labels.
- [Browser flight review](trio-browser.png): the three loaded shipping rigs
  and their wakes in the interactive lab.
- [Porcelain registration](porcelain-registration.png),
  [Nacre registration](nacre-registration.png) and
  [Origamist registration](origamist-registration.png): source joint axes and
  the complete measured head circles over the retained chroma masters.
- [Render regression receipt](regression.json): scoped geometric and renderer
  results emitted by `test-premium-pilots.mjs render`; this is not a receipt
  for the full application suite or human visual approval.
- Interactive lab: `docs/lab/premium-pilots/index.html`, generated from
  `illustrated-src/lab/premium-pilots.html`. It uses the shipping atlases,
  painter and motion controller, with size, speed, pose, wake and backdrop
  controls.

## Static visual review, 9 September 2026

The three source masters and both rendered contacts were inspected against
the original concept boards. Porcelain retains its ivory/cobalt ceramic,
closed blue visor and silver fur tail. Nacre retains the bare lilac face,
indigo eyes, compact fins, aubergine/nacre armor and luminous-looking fin-tail.
Origamist retains the closed angular shell and cream/vermilion/indigo folds.
No obvious missing part, clipped silhouette, visible green rim or unintended
helmet overlay was identified in these contacts.

The shared anatomy makes the assembled characters more compact than their
standing concept illustrations. Origamist's face area reads slightly smaller
because its ear peaks count within the same fixed 36px head radius. At 52px,
fine inlay and weave detail largely collapses; the blue visor/silver tail,
lilac face/fin and angular folded fan provide the more legible distinctions.
Review their material detail in the hangar as well as their silhouette in
flight. Still images cannot establish smooth motion or readability across
every zone; the interactive and production-page review remains separate.

## Reproduction and acceptance boundary

The [source README](../../../art-src/premium-pilots/README.md) records all raw
masters, prompts, measured attachments, shared bone dimensions and deterministic
extraction/portrait commands. Rebuild the lab after the source export and
open its premium-pilot page through a local server. Run:

```sh
node illustrated-src/test-premium-pilots.mjs
```

The focused script exercises 960 controller ticks per suit, fixed bones and
head scale, joint coverage, tail clearance/area, Origamist's rigid tail,
frame-rate behavior, atlas fallback, helmet suppression, cockpit extraction,
and production/beta shop, purchase, equip, save/reload and hold-state paths.
Its all-mode successful exit is required in addition to the render receipt.

Complete [SHIPPING.md](../../../SHIPPING.md) at the final PR commit, including
the full harness and a 390px production-page check. This document records
the scope and static art review; it does not assert that all shipping gates
have passed. Owner review of the finished appearance remains distinct from
the mechanical assertions.
