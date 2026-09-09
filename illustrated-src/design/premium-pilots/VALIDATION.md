# Premium pilot supplied-sheet release validation

The final character art passed the complete **54-test harness: 54 passed,
0 failed, 0 skipped**. After the scoped phone layout correction for the
Premium Pilot Trio card, builds and the affected checks passed again.
The full-suite result precedes that CSS/class-only correction; the final
focused results and file hashes are recorded in [verification.json](verification.json).

## Final candidate

The release uses sixteen complete supplied poses per suit. Porcelain's
floating boxes and the three sheets' baked ground shadows were removed.
Nacre uses the latest supplied reference, with two comparably sized tails
from distinct adjacent rump roots. Both sweep, briefly cross/braid during
the jump, and unwind into separate resting curls. This movement is authored
in the complete frames.

Porcelain always wears Sovereign Shell B; Nacre is helmetless by design;
Origamist always wears Facet Shell. Their respective Cobalt Filigree,
Pearl Tide and Foldspace Ribbon wakes remain included. Prices are
**1,000 Stardust individually / 2,500 for all three**. The trio and unowned
singles remain available every day beside the separate daily featured pack.

## Evidence

| Area | Observed result |
| --- | --- |
| Artwork | All 48 cleaned poses inspected on light/dark contacts; no remaining Porcelain boxes, ground shadows, extraction clipping or obvious green fringe |
| Registration | Every measured head is at (180,84), with one constant scale per character and two measured rear-paw emitters per frame |
| Rendering | All 48 source crops, 30 helmet choices, fallback portraits, cockpit/preview routes and atomic atlas loading/retry pass |
| Motion and wakes | Full cycles survive repeated taps; 2,160 finite wake samples and 6,000 unchanged legacy-controller states pass |
| Economy | Production and beta pass four dates, daily rollover, singles and permanent trio checkout |
| Ownership | All eight ownership subsets, suit/wake grants, partial credit, insufficient funds, duplicate purchase protection and save/reload pass |
| Build | Source/production/beta export, lab and Flight Studio pass |
| Gates | Full 54 suite; final TypeScript, 32 art groups, 51 bridge files, whitespace and seven affected suites pass |
| Browser | Passed: all sixteen frames at Normal/Quarter, 52px and enlarged light/dark views, current 390px Shop and corrected trio card |
| Preservation | All 1,600 existing shipping art files remain byte-identical to main 83628d2; exactly six new shipping art files |

The final seven affected suites are premium pilots, premium pricing, Shop,
bundle parity, Flight Studio, platform bridge and Switchback. TypeScript
checks all game source files and `lab/rig.ts` using the repository's
`--strict false` command. Flight Studio validates 34 models, 449 asset hashes,
seven cut rigs and three complete-frame banks.

The [runtime receipt](regression.json), [export receipt](../../../art-src/premium-flight/export-receipt.json)
and [preservation receipt](preservation.json) retain the measurable results.
Independent verification also confirmed thirteen protected progression,
simulation and background source files unchanged. Current main
`83628d296692cd31713c61630ab901d498ad31a5` is integrated through merge 21d436d.

The final Nacre master is 1212×1297, with original/master/atlas hash prefixes
`ace482d2 / 94fe0291 / ee3dc128`. Its constant scale is 0.6967213115.
Minimum output margins are 30px Porcelain, 10px Nacre and 15px Origamist;
maximum green excess is 6 in each bank. Complete hashes and all 48
measurements are retained in the linked receipts.

## Browser review

Chrome review completed on 2026-09-09 at 22:17 UTC against the built production page and premium lab. All sixteen frame labels advanced at Normal and Quarter speeds. Both Envoy tails moved through separate curls, a brief braid and recovery; the three custom wakes appeared during playback. Frame seeking cleared old wake history. No warning/error logs were observed.

The actual Shop was reviewed at 390×844 with each 1,000-Stardust single and the 2,500 trio. No purchases, equipment changes or flights occurred; the temporary cart was cleared. Details, screenshot dimensions and the browser timing limitation are recorded in [BROWSER-RECEIPT.md](BROWSER-RECEIPT.md).

[Trio offer](trio-shop-390.png) · [Envoy card](nacre-shop-390.png) · [Frame 8 dark](browser-frame8-dark.png) · [Frame 8 light](browser-frame8-light.png) · [52px dark](browser-game52-dark.png) · [52px light](browser-game52-light.png)

The owner subsequently requested shipping this character update first, followed by a separate graphical Shop enhancement. These receipts describe the character-release presentation; new marketing cards and the wider Shop redesign belong to that follow-up.

The phone review found that the original trio card squeezed its description
beside three thumbnails. The corrected card places those portraits on their
own row, followed by the description and price. The change is scoped to the
trio card; existing featured cards and transaction handlers are unchanged.

## Preserved source details

Origamist's supplied blur is intentionally preserved in frame 6 (row 2, column 2)
for the body and frame 11 (row 3, column 3) for the tail, using one-based labels.
The art gate retains 14 existing frame-spread advisories in legacy assets;
none concerns the new trio. The earlier Arcflash fallback failure was fixed
on main, and its current regression passes.

The rejected cut-rig contacts and browser evidence are superseded. Historical
masters remain as provenance only; production and Flight Studio load the
current complete-frame atlases. The five other proposal cards remain
byte-identical to the prior PR and add no production catalog entries.

## Execution and publication

Docker was unavailable. The repository-authorized existing-tool fallback
used Node 24.19.0, Python 3.11.9, Pillow 11.3.0, NumPy 2.1.2 and SciPy 1.17.1,
with no host installations. There is no separate lint script; TypeScript
and whitespace checks accompany the art and test gates.

The PR remains subject to the owner's review and explicit merge decision.
No merge or live deployment is claimed by these local checks.
