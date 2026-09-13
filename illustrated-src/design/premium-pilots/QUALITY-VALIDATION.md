# Trio display-quality repair

The owner reported: "The art quality degraded significantly for these characters."
The affected view is the local comparison/game preview; the supplied phone
Loadout screenshot shows Envoy and Patriot. This repair follows merged PR293.
It supersedes that transfer's visual-quality acceptance, not the owner's
requirements for Cyber's motion or the three characters' identities.

## Diagnosis

The comparison base is main `e0ae1211`, after PR293 was merged externally as
`7e5637c26bd5f2c995e2bfeb5c222998466c25f8`. The intervening packaging/gold-check
changes did not modify the trio's artwork or runtime. The three deployed stills,
GitHub blobs and local files were byte-identical. The loss occurred before upload.

The previous exporter reduced each 1254px painting to 256px with the canvas
library's `imageSmoothingQuality="high"`. Reproducing that path yielded the exact
shipped Envoy ASC1 pixels. The matte operation changed none of the 80,394 sampled
interior body pixels, while the reduction turned smooth painted details into
rough speckles. A synthetic one-pixel checker acquired a standard deviation of
37.94 rather than remaining approximately flat gray. Merely using canvas's
medium filter softened the art, and repeated high-quality halving still aliased
four-pixel patterns.

Pillow's premultiplied-alpha Lanczos reduction removes those aliases while
retaining fine color boundaries. The new regression test invokes the actual
exporter on synthetic detail, translucent color and translated/scaled canvases;
the previous exporter fails it.

The independent reviewer also rejected Envoy ASC3/4/5/6/7/9 for source
material/lighting drift and Percy ASC5/9 for a dull, mottled porcelain finish.
Their localized repairs restore the established materials while retaining each
pose and feature arrangement. Exact source hashes, prompts and silhouette
diagnostics are retained in each suit's `material-review-20260913.json`.
Tail contours, paws, head treatment, motifs, hardware and piping were checked
visually; overlap measurements alone were not treated as feature approval.
Patriot required no source repaint.

A controlled same-source 256-versus-512 comparison used the actual portrait
painter at 158 CSS pixels and DPR2, with identical pose and on-screen placement.
512px samples visibly recovered eye outlines, botanical marks, rings, suit seams
and paper-fan facets that the enlarged 256px sprites softened. This justified
display-detail companions while retaining the existing 256px logical geometry.

## Implementation and preserved contracts

The stamp289 export regenerates 63 canonical 256px sprites and adds 63 direct-source
512px companions. Eight source paintings receive the material corrections above.
Pose offsets, anatomical geometry, pivots, bank counts, controller state,
ownership, prices, head policies and wake registration retain their existing
values. Envoy's fallback ownership polygon is corrected separately: two thin
root strands previously stayed on the stationary body when both plumes rotated.
Assigning those strands to the tail preserves the exact still reconstruction.
Cyber's artwork and frozen reference are unchanged.

`sprite-detail.ts` chooses source pixels from the physical canvas density while
preserving the existing logical destination. It lazily loads a still, a pair of
fallback layers, or a complete eighteen-frame bank. Optional failure or wrong
dimensions preserve the normal sprite and wait 30 seconds before retrying. Studio
uses the same helper; rejected decoded files leave its cache so retry can recover.
The complete optional PNG tier is about 5.4 MiB; no HD request is added to normal
bank readiness. Only enlarged display demand loads that tier.

## Validation

- Source export, lab build and Flight Studio build passed at stamp289. Normal
  bundle retention adds `js289` and retires `js285`; generated modules come from
  source. Unrelated helmet and High Orbit diagnostic regeneration was restored.
- At the pre-integration checkpoint, the complete harness passed **68 tests,
  zero failures, zero skips**. After the
  final four material paintings were installed, premium-pilot/full-gold, Studio
  and detail-rendering checks passed again; all three also passed after Envoy's
  fallback correction. The Studio invalid-detail cache retry fix passed its
  dedicated failure/recovery assertion.
- The new resampling test covers four fixtures and 72 paintings across 256/512,
  including alpha, tone averaging, fine detail and registered margins.
- The detail test exercises actual loader groups and real PNG painters: portrait,
  cropped sprite, flight preview, live pilot, hinged fallback and Studio. Logical
  destinations, rotation/pivots, measured geometry and controller state are equal
  between resolutions. Small gameplay retains the normal source.
- TypeScript, platform bridge (56 files) and whitespace checks passed. The Shop
  visual fixture now uses the same local calendar date as daily rewards; its
  former UTC date failed near midnight. This is a test-only correction, with
  production, beta and native Shop checks passing.
- Repeating the final export left **126 PNGs, the shipping manifest and generated
  registration byte-identical**. Both resolutions use disjoint body/tail masks
  whose union reconstructs their still exactly.
- The trio structural check has zero faults. Its two fixed-strip descent proxy
  warnings for Envoy and Patriot were separately adjudicated in the anatomical
  playback review: the paired-plume opening and rigid-fan foreshortening do not
  introduce an extra whole-tail gesture. The warnings remain visible in the
  structural report.
- The Envoy review guard now requires eighteen exact output hashes at each
  resolution. Negative probes reject altered 256px images, altered 512px images,
  incomplete HD approvals and frozen body/tail motion.

Independent review cleared all 54 complete-bank paintings at 158 CSS pixels/DPR2,
the continuous Loadout cycles and five 120-tick simulation scenarios per suit.
All 1,800 pilot ticks matched Cyber's frame, velocity and tail spring state.
The corrected Envoy fallback was cleared at 52 and 158 CSS pixels through the
legal -0.75 to +0.75-radian range. A tiny Patriot root seam remains at the enlarged
positive fallback limit; it does not read as a detached fan at gameplay size and
is explicitly documented in [QUALITY-REVIEW.md](QUALITY-REVIEW.md). Complete banks
use intact paintings. This sampled review does not cover every input/display rate.

The standard art gate passed all **32 QA groups** against the final independent
approval fixture. Its informational frame-spread report retains 19 flags across
the repository, including Envoy ASC3/4, Patriot ASC6 and Percy ASC2/3. Those five
paintings were included in the independent 54-frame visual inspection. The
unrelated painted masters were not edited. The negative SD/HD/frozen-motion probes passed
again against the final art.

## Main integration

The initial complete repair and review were checkpointed as `78ff7e1` on the
`e0ae1211` base. Before publishing, main advanced to `9660e5c2` through PR294 and
claimed build288. The quality branch incorporates that commit and regenerates
build289. It preserves main's new economy, including the trio's 100-per-pilot
and 250-bundle prices, the acorn exchange and disabled-by-default IAP. Catalog
changes relative to current main are limited to the asset stamp.

Only generated bundles conflicted. They were regenerated from combined sources;
main's published `js288` remains intact. Main's small wake-context guard remains
in place. Independent integration capture reproduced all 35 review PNGs
byte-for-byte, all 150 loaded images remained identical and all 1,800 pilot ticks
still matched Cyber. TypeScript, bridge and all 32 art groups passed again.
The integrated full harness completed with 66 passes, two failures and no skips.
Both failures were the Arcflash derived-image/Studio mismatch described below;
both passed focused reruns after the correction. All 68 checks therefore have
passing results on the final combined content. The other 66 checks were not
repeated after this bounded asset/manifest correction. Final capture and source
bindings are recorded in `quality-review/reviewed-hashes.json`.

One incidental derived asset is required by the existing exact-pixel gate:
Arcflash's fallback is regenerated from its unchanged rig. Compared with main,
20 pixels each change one channel by at most 3/255 (19 RGB values and one alpha
value from 142 to 143). Dimensions, bounds and silhouettes at four alpha
thresholds are identical; all 25 Arcflash source/rig/test files match main.
Keeping main's differently rounded image failed the strict fallback test and
the Studio manifest check. The regenerated fallback and matching Studio manifest
pass both focused reruns. No Arcflash painting or rig was redesigned.

Docker is unavailable on this host. Checks use the repository's documented
fallback with existing Node dependencies and Python/Pillow/NumPy/SciPy; no host
system packages were installed. There is no separate lint command: the required
source checks are TypeScript and Git whitespace checks.
