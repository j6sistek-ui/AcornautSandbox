# Independent Cyber transfer review

PASS for the exact reviewed Percy, Envoy and Patriot artwork and sampled production
motion, 12 September 2026. This record is authored by the independent auditor, who
did not generate production artwork or implement the production renderer. Final
source, output and runtime hashes are recorded in `cyber-review/reviewed-hashes.json`.
This is a visual review of the stated scope, not permission to merge or deploy.

## Authority and scope

The visual authority is the shipped Cyber nine-frame ascent and nine-frame descent
banks, their cutter masks, and `illustrated-src/GOLD_STANDARD.md`, on comparison
base `6f85ca0ba3dc2d277f5ed43515b3a968eb71ef05`. That includes the owner's approved
live 1x accent. The three replacements are Percy (`porcelain`), Envoy (`nacre`)
and Patriot (`origamist`).

The owner's later instructions prioritize Cyber's visible tail phase and rhythm
over exact pixel alignment: two initial droop transitions (ascent 1 to 3), four
gather/lift transitions (3 to 7), and two follow-through transitions (7 to 9),
with a controlled descent/settling sequence. Envoy also retains two separate
tails, their sweep, loose crossing and unwind from her original art. Her stance
allows modest natural arm/leg differences. These changes in priority do not
permit costume flicker, lost anatomy, new hardware or a frozen body.

## Independent inspection method

- Inspected each of the 54 individual source paintings in full-frame contact
  sheets and fixed head/body enlargements; revisited every rejected local repair.
- Compared alpha silhouettes and registered overlays with each corresponding
  Cyber pose. Registration uses a single common scale and a whole-image
  translation only. The weighted skull/torso overlap search proposes registration;
  it is neither an anatomical skull measurement nor a visual acceptance score.
- Inspected actual production `Sim` plus `drawPilot` output in native canvas at
  game size 52 and enlarged size 192. Scenarios cover single tap, 150 ms repeat
  taps, a five-tap burst, descent input and reset. The capture script records the
  selected frame and drawing transforms, and binds loaded PNGs/runtime code to
  SHA256 hashes. Fresh renderer module instances isolate each scenario's global
  velocity smoother; an additional synchronized-row check uses one shared module
  to match the lab's ordering.
- Tested the real `paintIllustrated` loading fallback with full banks deliberately
  absent and tail angles from -0.75 to +0.75 radians. Complete banks normally paint
  full frames even in ready/hover; the split body/tail rig is a loading fallback.
  The ordinary portrait is a static PNG.

The auditor's browser inventory exposed no browser surface. These are actual
production-renderer captures, not a claim of independent interactive browser
testing. The implementer's separate browser observations and mechanical tests
belong in `CYBER-VALIDATION.md`/the browser receipt. Matching a runtime trace alone
does not establish visual quality.

## Findings and repair history

Percy's locked identity is an opaque navy visor, ivory/cobalt botanical armor,
blue circular hardware, four paws and one silver plume. Rejected drafts included
an extra floral tail-base plate, an exposed muzzle/nose inside the visor,
a cyan chest mark and a yellow gap between the legs. These were locally repaired.
The reviewed bank retains the major botanical layout and hardware; small changes
in distant knee visibility follow plausible occlusion. Registered ascent 7 has
minor lower-leg variation, but the sampled production 8-to-7-to-6 transition at
both sizes reads as gradual extension/return rather than an abnormal kick.
Single, repeated and burst taps, descent and reset retain Cyber's frame timing.
The loading fallback remains attached without floating armor or a visible cut gap.

Envoy's locked identity is her pale pearl face, purple eyes, three side-fin lobes
and swept crown, aubergine suit, ivory forearm/boot armor and two pearl/lilac tails.
Rejected drafts fused the tails, added angular chest decorations, changed the hip
seam, omitted bracers or broadened the lower belly piping. Those were repaired.
The final ascent 3/4/5 candidates restore a second droop, a gathering sweep and a
single loose crossing with two open tips. Ascent 7's missing thin neckline contour
was separately restored. Slight pearl highlights and facial shading vary without
adding/removing features; native-size review did not show a significant color flash.

Patriot's locked identity is the opaque navy faceted visor, two compact ear peaks,
ivory/red/navy armor, blue circular joints with metallic chin-fastener rim, four
paws and one folded fan tail. Rejected drafts lost elbow hardware, flattened the
chin ring, exposed a reduced navy chest panel and changed the fan's facet layout.
Those costume repairs were inspected individually. A remaining thin chest line
reads as a fold boundary, not an added emblem. Late-ascent fan frames initially
held almost the same pose for several frames before a final jump; this was rejected
under the owner's rhythm priority. The later fan edits now progress through
gather/follow-through and retain a coherent folded face in actual production
captures. The descent edits likewise retain the lower lobe and settle without a
new flick/whip; their fixed left-ROI angle is not an anatomical fan-axis measure.
That x-less-than-101 strip omits the fan root near x120 and can include the trailing
boots: reported strip bounds extend to y181--187. It cannot alone decide whether
the connected folded fan performed an extra motion.

The final warning review found a separate real initial-phase shortfall: ascent
1-to-2 had only 0.43 of the largest whole-frame neighbor pixel change in Patriot's
own ascent bank, and 0.253 of that bank's largest tail-region neighbor change.
These are within-bank normalized ratios, not ratios to Cyber's absolute changed
pixel counts (`verify-cyber-trio-art.mjs`, lines 76--77).
A fixed native crop comparison confirmed that the first fan
droop was nearly held while the next step supplied most anticipation. This was not
an abnormal jerk, but it fell short of the owner's two visible droop transitions.
It was not dismissed as a proxy false positive. A narrow ascent 2/3 tail repair
now provides two visible downward sweeps with frame 3 deepest and frame 4 gathering.
Full-source inspection retained the connected fan facets, visor, ears, joints and
four paws. The final registered first-three comparison and refreshed production
captures confirmed the repair. The minimum whole-frame step ratio, normalized to
the largest step in Patriot's own ascent bank, is now 0.61;
the earlier warning is resolved by changed artwork, not by lowering its threshold.

## Envoy whole-mass orientation check

The generic 45-degree opaque-mass principal-axis span is not a direct measure of
body articulation or tail rhythm across different anatomies. An independent
covariance calculation on Cyber ascent 9 found an eigenvalue ratio of 1.1172.
Removing only 327 upper-head/antenna pixels changes its axis from -70.0686 degrees
to +44.7569 degrees, without moving its body or tail. Since the axis is undirected,
that is a 65.17-degree shortest orientation difference. The retained silhouette
is even nearer isotropic (ratio 1.0751). Envoy's ascent 9 ratio is also near unity,
1.1789, so the principal direction is sensitive to the distribution of tail mass.

The independent recommendation is a bounded Envoy-specific replacement: pin all
18 exported frame hashes to the independently reviewed motion record and retain
separate nonfrozen body and tail checks against Cyber. Any changed frame must
invalidate that record. The generic gate remains unchanged for other suits.
After final costume and actual-renderer review, the auditor marked
`art-src/cyber-standard-trio/nacre/motion-review.json` PASS for its exact 18 output
hashes. The record also carries source/reference hashes, runtime-at-capture hashes,
scope and limits. This numerical explanation alone did not approve the art.

## Limits and final evidence

Percy, Envoy and Patriot source/costume and sampled production-renderer visual
review are cleared for the exact hashes in the manifest. No significant unresolved
extra feature, costume visibility shift or abnormal motion was found in the
reviewed set. Captures examine sampled transitions at fixed
60 Hz, not every possible gameplay input or display refresh rate. Head and boot
anchors are measured approximations, not exact anatomical fits. Major features,
pose rhythm and motion continuity take precedence over tiny highlight differences.

Envoy's retained evidence is in `cyber-review/nacre-capture.json`, with
`nacre-single-192.png`, `nacre-single-52.png` and `nacre-loading-fallback.png`.
All 1,200 isolated capture ticks matched Cyber's selected frame, velocity and tail
spring state; all 600 synchronized two-row ticks also matched. The captured
descent 2-to-3 transition shows a small relative opening of the upper plume while
the paired tail envelope continues trailing; it does not show a new tail whip.
The fixed-ROI angle reversal was not treated as a direct motion verdict.
This initial Envoy receipt preserves its capture-time runtime hashes; its catalog
predates the final Patriot integration. The final all-four receipt and manifest
below bind the current runtime, including the current catalog.

`cyber-review/capture.mjs` is a reproducible native-canvas capture harness; it
requires the existing canvas dependency through `ACORNAUT_CANVAS`. It creates
ignored output only and never marks visual approval or updates the reviewed-motion
fixture. `cyber-review/pca-sensitivity.json` records the independent covariance
check.

The final all-four capture is recorded in `cyber-review/final-capture.json`.
Each replacement matched Cyber's selected frame, velocity and tail state on all
1,200 ticks across the five scenarios and two sizes (3,600 comparison ticks total).
All 600 synchronized four-row ticks matched when sharing one production renderer
module. This rules out the suspected cross-row velocity-smoother contamination
for the tested lab ordering. Reset has the same short inherited smoother recovery
as Cyber; the review does not claim that a reset instantly starts at ascent 5.

The hash manifest covers all 54 replacement source paintings, all 63 replacement
production paintings/layers, 21 Cyber reference paintings/layers, three auxiliary
images loaded by the harness, the art configuration/provenance files and all 55
compiled modules in `docs/js`. It also binds the compact capture receipt. Metadata
status strings were refreshed after the last capture, and text configuration and
receipts were normalized to LF line endings. Production PNG and runtime hashes
were rechecked unchanged before this final manifest was written.

Retained final comparison strips are `cyber-review/final-<suit>-single-52.png`
and `final-<suit>-single-192.png`, with one `final-<suit>-loading-fallback.png`
for each of porcelain, nacre and origamist. The full local QA capture includes
repeat, burst, dive and reset filmstrips. Signature wakes were disabled in these
motion strips; intrinsic tap accents remain. Wake routing, purchase/equip behavior,
all-head-policy compatibility and the full project test suite are mechanical and
integration checks recorded separately in `CYBER-VALIDATION.md`.
