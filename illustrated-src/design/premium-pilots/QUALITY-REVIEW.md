# Independent Cyber trio quality review

PASS for the exact reviewed sources, SD/HD outputs and production rendering, 13 September 2026, with the bounded fallback and display limits below.

The owner rejected the deployed Loadout quality. This supersedes the quality
acceptance in the 12 September `CYBER-REVIEW.md`; that earlier source/motion
review did not adequately compare larger, high-density previews with the original
art. Its historical captures and hashes remain unchanged as a record of what
was inspected, not approval of this repair.

## Findings

The investigation found two distinct problems. The native-canvas exporter used
its `high` sampling mode for the large 1254-to-256 reduction, producing visibly
stippled edges and fragmented fine details. Premultiplied-alpha Lanczos reduction
removes that defect. The filter comparison uses identical source paintings and
registration; it does not repaint them.

Envoy ascent 3, 4, 5, 6, 7 and 9 separately had source-level quality drift: harsh pink
and white lighting, hot magenta armor, coral hardware and overly bright pearl
bands. Ascent 3 also had uneven, softened facial and armor edges. The independent
auditor inspected all six localized correction candidates at full source size
against their previous frame, ascent 1 and the original `nacre-clean.png` sheet.
The corrected material is substantially closer to the neutral reference. The
two-tail curves and free tips, four paws, eyes, fin count, hardware, hip/waist seams
and ascent 7 thin neckline remain present. Source appearance was cleared for
these exact candidates. The final production-HD frame grids and continuous Loadout samples confirm that the isolated mottled/hot material flashes were removed.

Percy ascent 5 and 9 had a separate dull gray/brown porcelain finish that became conspicuous in the actual larger rendering. Two bounded source retouches preserve the floral branches/dots, sash/stars, collar buckle, rings, four paws and plume contours while restoring clean ivory and visor/ring highlights. The final 18-frame Percy review confirms continuity. Patriot required no source repaint in this quality follow-up; its faceted palette remains coherent across all 18 frames.

## Display-density evidence

A new native-canvas harness calls production `paintPortrait` and Loadout's
`paintFlightPreview` at 52, 158 and 192 CSS pixels, with a device pixel ratio of 2.
The comparison includes the merged replacement images, the corrected filter,
and original art plus its historical runtime from
`6f85ca0ba3dc2d277f5ed43515b3a968eb71ef05`. This is actual-painter evidence,
not an independent interactive-browser claim.

Lanczos at 256 pixels is a substantial improvement over the merged export, but
fine eyes, rings, piping and botanical marks remain softer at the larger display
sizes. A bounded 512-pixel probe uses the same source, keying, pose translation,
crop and screen transform. It substitutes only the higher-resolution raster in
the painter's draw operation. At 158 CSS pixels and DPR2, it materially restores
Percy's botanical/ring detail, Envoy's eye/collar/seam definition and Patriot's
visor/fan edges. Envoy descent 1, 3 and 7 show the same improvement without new
source edits. The probe is diagnostic evidence for higher-resolution companions;
it is not the final production-HD implementation.

The recommended production approach retains the 256-pixel logical geometry and
uses a 512-pixel companion when display density warrants it. Source crop
coordinates scale with raster density; destination, anchors, motion controller
and phase order retain their existing meaning. Small gameplay rendering can
continue using the filtered 256-pixel image.

## Final production rendering

The new [capture harness](quality-review/capture.mjs) uses the actual production
`Sprite.detailImage` contract. It loads the delivered SD/HD PNGs into ArtBank,
then calls the compiled `paintPortrait`, `paintFlightPreview`, `Sim`, `drawPilot`
and `paintIllustrated`. It does not intercept or replace raster sampling.
The diagnostic substitution described above is confined to the earlier probe.

All 54 named frame portraits were inspected at 158 CSS pixels/DPR2, alongside
native 512-pixel contacts and the eight corrected full-size source paintings.
The actual portrait and Loadout display captures at 52, 158 and 192 CSS pixels
were inspected. Draw-call records confirm SD at 52 and HD at 158/192. Eyes,
visor/ring highlights, botanical markings, seams and tail edges are materially
clearer than the rejected merged export. The new source framing and identities
still differ intentionally from the old 16-frame art; this review does not claim
pixel equivalence with those original designs.

Each pilot also ran five 120-tick, 60Hz Sim scenarios: single tap, 150ms repeat,
100ms burst, dive, and reset/re-tap. All 1,800 pilot ticks matched Cyber's selected
frame, vertical velocity and tail spring angle. Twelve sampled rendered states
per scenario and twelve states of each continuous Loadout cycle were visually
inspected. Named-frame portraits isolate every painting; they are not a claim
that the input controller selects that frame at a particular instant.

The intended tail progression remains: two early droop transitions, four gather
transitions and two follow-through transitions. Envoy keeps two roots/free tips,
a loose crossing and unwind within that progression. Her descent upper-plume
opening changes the fixed-region angle proxy without adding a new whole-tail
whip. Patriot's rigid fan changes orientation and foreshortening; the earlier
fixed-proxy descent warning does not describe an added gesture. No new frozen
body, detached limb, extra anatomy or significant costume feature flash was
found in the complete banks. Small painted highlights and natural limb/pose
variation remain.

## Loading fallback and limits

The fallback was tested separately with the real painter, absent complete banks,
at 52 and 158 CSS pixels/DPR2 and tail angles -0.75, -0.35, 0, +0.35 and +0.75.
The legal spring limit is 0.75 radians; the repeat/burst traces reach the positive
limit and the dive trace reaches the negative limit. These are reachable states.
Complete banks render one intact painting and do not rotate the cut tail.
Waiting for HD alone also retains the complete SD bank. The duration of an SD
bank loading failure is network-dependent; no fixed short duration is assumed.

Patriot retains a tiny root/cut sliver at the enlarged positive-limit fallback.
It does not read as a detached fan at gameplay size. Cyber's reference split
also exposes a small clipped edge at extreme negative rotation. This is accepted
as a limited cut-rig seam, not a claim of a perfect joint. Envoy's larger fallback revealed a stationary pink lower-tail contour that resembled an extra fragment. A bounded mask-ownership correction moves that contour with the tails; the upper lip is continuous dorsal armor and remains on the body. The independently viewed moved-pixel strip contains no leg trim or paw. The final actual fallback is clear at both sizes over the legal range. The [mask proof](quality-review/fallback-mask-proof.json) records unchanged 54 masters, 108 complete-bank PNGs, six stills and numeric anchors, plus exact complementary reconstruction of all three suits at both resolutions. Only Envoy's split mask definition/mask and four body/tail outputs change in this correction.

This independent review uses native-canvas renders of the production modules,
not an interactive browser session. ArtBank images were populated directly;
network/lazy-loader behavior is covered separately by integration tests. The
reviewed 60Hz scenarios and sampled filmstrips do not cover every possible input
or display rate. Loading the HD group atomically avoids mixed-resolution banks,
but a pending group can retain the softer 256-pixel fallback until it is ready.

The six complete-frame grids, three display-size boards, three Loadout cycles and eight fallback boards are retained in [quality-review](quality-review/). [final-capture.json](quality-review/final-capture.json) binds 150 loaded assets, 54 source paintings, 56 compiled runtime modules, the export manifest, capture harness and all 35 rendered outputs. Capture PNG names in that receipt resolve under `outputs/cyber-standard-trio/quality-production-final/`; 20 selected boards are also retained beside the receipt without changing their bytes. The other sampled scenario filmstrips are reproducible from the retained harness.

[reviewed-hashes.json](quality-review/reviewed-hashes.json) binds the retained evidence and current source/export metadata. All source, runtime and loaded-image hashes were checked before and after rendering. The post-mask recapture left the twelve previously reviewed complete-bank/display boards byte-identical. Envoy's motion fixture now pins both 18 SD and 18 HD frames to this independent approval, with the existing separate body/tail movement checks. It is not a general exemption for unreviewed art. The old 12 September evidence remains historical and unchanged.
