# Shop verification

The final combined source revision is `8497029d56e98c188c62754d6850b7db20163f38`, built as cache stamp257 and reviewed on September 9, 2026. It includes the Loadout main revision `95aefc52cb37d9451ade3db906f9ef97cb37479e`. The Shop changes were compared with the immutable PR252 baseline at `d296e6bc404aaec14221a8b79186132fb4426dea`. [PRICING.md](PRICING.md) describes the accepted eight-bundle registry and full ownership credit. [preservation.json](preservation.json) records file hashes and economic comparisons; [baseline.json](baseline.json) remains the original historical snapshot.

## Automated checks

- `test-shop.mjs`: passed after the final built-in wake validation guard.
- `test-bundle-kits.mjs`: passed after the guard, with eight bundles, 440 complete ownership quote cases, 880 real engine purchase cases, 282 zero-due completions, all eight banner files and five beta grant compatibility scenarios. The test uses isolated in-memory saves and a lightweight canvas stub.
- The final complete harness passed at revision 8497029 / build257: **56 passed, 0 failed, 0 skipped**. See [full test output](verification/full-tests.txt).
- Integrated exporter/builds, TypeScript check, store bridge checks and all **32 art groups** passed. See [art check output](verification/art-check.txt).

The focused cases include invalid negative/nonfinite/over-retail discounts, editable 100% discounts, duplicate suit/helmet IDs, free set trails, rejection of explicitly listed built-in signature wakes, retired endpoints, repeat purchases, reload persistence and earned-item credit. The beta funding target remains at least 12,360; 7,510 is the historical amount already granted when an old save has no recorded total. Previously recorded higher grants are never deducted.

The art report retains 14 pre-existing frame-size advisories. None belongs to the premium trio, and the underlying images remain byte-identical. Checks used the repository's documented existing-tool fallback because Docker was unavailable; no host packages were installed.

## Browser method and inspected states

Chrome was controlled through a task-owned tab on local port 8774. Temporary HTML fixtures copied the canonical production and beta shells without changing their styles or generated runtime. The only injected behavior was a selected UTC date and an in-memory platform storage adapter, so no real player save was read, equipped, purchased or advanced. Fixture dates select actual rotating offers; they are not screenshots of a fabricated Shop.

The final build257 production core and beta were refreshed after main integration. Supplemental build255 images document unchanged Shop details and bundle types; they are labeled below. Both rounds used measured CSS viewports 390 × 844, 320 × 844 and 1186 × 723 (DPR approximately 1). Each retained image is a normal viewport capture, not a stitched page. Chrome returned JPEG bytes; these were decoded and encoded as PNG at the original dimensions without resizing, cropping or repainting. [browser-receipt.json](browser-receipt.json) records build/URL/size/hash per screenshot and the exact fixture source hashes.

| Inspected state | Build | Evidence |
|---|---|---|
| Violet/gold stage; actual game art on individual cards; fixed prices | 257 | [Mobile Shop](final-production-shop-390.png) |
| Trio 2,500 and 16.7%; four Stardust rows and unavailable-web-store text | 257 | [Offers](final-production-offers-390.png) |
| Three pilots and three derived bonus wakes, all actual game art | 257 | [Six included cards](final-production-trio-included-390.png) |
| Porcelain's Sovereign Shell always on | 255 supplemental | [Porcelain preview](final-production-porcelain-detail-390.png) |
| Nacre's bare head and two tails | 255 supplemental | [Nacre preview](final-production-nacre-detail-390.png) |
| Origamist's Facet Shell always on | 255 supplemental | [Origamist preview](final-production-origamist-detail-390.png) |
| Derived Cobalt Filigree review identifies its included suit | 255 supplemental | [Wake review](final-production-wake-detail-390.png) |
| Twelve mixed Regalia contents with scrollable review | 255 supplemental | [390](final-production-regalia-included-390.png), [320](final-production-regalia-320.png), [wide](final-production-regalia-wide.png) |
| Cosmic Companions at 200/25.9%, three actual companion cards | 255 supplemental | [Offer](final-production-cosmic-offer-390.png), [contents](final-production-cosmic-included-390.png) |
| Three actual visor cards; Amethyst on the compatible Flight suit | 255 supplemental | [Visors](final-production-visors-included-390.png), [helmet preview](final-production-amethyst-flight-390.png) |
| Beta stage and owned individual omitted from shelf | 257 | [Beta Shop](final-beta-shop-390.png) |
| Starlight has Space Puppy, AstraFox and Stopwatch actual art | 257 | [Starlight contents](final-beta-starlight-included-390.png) |
| One owned pilot credits 1,000; remaining trio price 1,500; beta store notice | 257 | [Offers](final-beta-offers-credit1500-390.png), [review](final-beta-trio-credit1500-390.png) |
| Two owned pilots credit 2,000; remaining trio price 500 | 257 | [Production review](final-production-trio-credit500-390.png) |
| Beta content sheet remains usable at narrow and wide sizes | 257 | [320](final-beta-trio-320.png), [wide](final-beta-trio-wide.png) |

The inspected text, art, price digits and card controls fit the measured viewports. Long mixed-content sheets scroll vertically. Individual shelves intentionally scroll horizontally inside the shelf; this is distinct from page overflow. Escape returned each premium detail to its original included card with focus restored, then returned the included sheet to its offer. In build257, Shift+Tab from the first included card wrapped to Back; Tab wrapped to the first card again. Opening and closing reviews left the synthetic cart empty and Stardust at zero. Beta's existing startup grant supplied 10,000 acorns only inside its in-memory fixture. Both routes' console checks returned no warnings or errors.

One screenshot command timed out and one optional selector measurement timed out; subsequent normal captures succeeded. The first capture immediately after scrolling to newly visible build257 banners was blank while their images loaded; the next capture showed the loaded art and replaced it. No blank or stitched capture is retained.

No native cash transaction, real-device store integration or foreground animation frame-rate claim is made by this visual review. Store purchase states, localized prices, full-credit transactions and zero-cost confirmation are exercised separately through isolated automated tests.

## Preservation, integration and cleanup

All **1,606 existing art files** remain byte-identical to the baseline; all 35 ownership IDs, fixed individual prices, the five retained unowned offers and four cash offers match. The 76 protected source files have no unexpected changes: the intended exceptions are the three-helmet loader, engine pricing comments and beta grant compatibility. None of these 76 protected files changed in the integrated Loadout main revision. Final source and shell hashes are recorded separately in the preservation report.

The build owner's independent integration review confirmed the complete Loadout function and `loadout.css` match main95aefc52, the CSS is embedded unchanged in production/beta, and all 51 modules in `docs/js` equal the corresponding `docs/js257` files. Both shells select stamp257.

The two temporary fixture HTML files were deleted after QA. Chrome's viewport override was reset (the tab returned to 1186 × 778) and the task-owned tab was closed. No cash purchase, item purchase, equip action, temporary cart selection, launch or progress action was performed. Historical screenshots from the superseded generated-single-card iteration remain only in the ignored local archive. Final screenshot files and this documentation are the only post-verification changes from the tested source revision.
