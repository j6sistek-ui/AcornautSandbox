# Cyber transfer validation

**Historical stamp287 validation.** These checks describe the earlier transfer.
The owner rejected its displayed art quality; that approval is superseded.
See QUALITY-VALIDATION.md for the stamp288 export and display-quality repair.

Validation recorded 12 September 2026. This file records mechanical checks;
the separate independent visual review decides costume and motion acceptance.

The comparison base is main `6f85ca0ba3dc2d277f5ed43515b3a968eb71ef05`,
including Cyber's approved live 1x accent and stamp286 frozen trace. The
replacement build uses stamp287. Cyber's paintings and trace are unchanged.

## Scope

Percy (`porcelain`), Envoy (`nacre`) and Patriot (`origamist`) each receive
nine ascent and nine descent paintings, a matching neutral still, and
complementary body/tail fallback layers. The standard bank loader, production
painter, simulation, previews, cockpit and Flight Studio use Cyber's route.
Original prices, ownership, head policies and signature wakes are retained.

The owner's follow-ups prioritize the tail's anticipation, sweep,
follow-through and settling over exact spec alignment. Envoy preserves the
existing two-tail interaction and uses modest natural arm/leg movement.

## Checks performed

- Source export, lab build and Flight Studio build passed.
- TypeScript typecheck, whitespace check and platform bridge passed.
- The complete harness passed: **66 passed, 0 failed, 0 skipped**. The
  existing compiler was supplied through `ACORNAUT_TSC`. The final two
  Patriot anticipation paintings were selected afterwards; the affected
  premium-pilot renderer/integration tests, Flight Studio and both art
  checks were rerun and passed against those final exports. Runtime code
  and numeric geometry did not change after the full harness.
- Each trio suit matched all 1,200 frozen Cyber ticks across five scenarios,
  plus all-head-policy, portrait, preview, cockpit and boot-emitter checks.
  Production and beta purchase/equip integration passed for all three.
- The standard art gate passed all 32 QA groups. Trio structural checks
  found zero faults. The two remaining fixed-strip descent warnings were
  independently inspected as anatomical/proxy differences; see the review.
- Altered Envoy hashes and simulated frozen body/tail masks are rejected
  by the reviewed-motion guard. Envoy's 18 final output hashes still match
  the independently authored fixture.
- Repeated final export kept all 54 frames, three stills, six split layers,
  the shipping manifest and generated registration byte-identical (65 files).
  Subsequent review-status and LF text-normalization updates refreshed metadata
  hashes; all 63 production PNGs and numeric registration stayed identical.
- Direct local browser controls, enlarged/52px sampling and an empty final
  warning/error query are recorded in [browser-review.md](cyber-review/browser-review.md).
  The independent source and actual-renderer verdict, exact hashes and
  sampling limits belong in [CYBER-REVIEW.md](CYBER-REVIEW.md).

No heavy test was skipped. A separate read-only runtime review found no
remaining live sixteen-frame interception in flight, previews, portraits,
cockpit, loading/fallback or wake state. Passing mechanical checks alone
does not certify artwork.

## Environment and generated outputs

Docker's Linux daemon was unavailable. Checks used existing workspace Node
dependencies and bundled Python under the documented repository fallback.
SciPy was installed only to ignored `.agent/check-deps`; no host system
package was installed.

The standard build also regenerates Arcflash's derived fallback portrait.
The unchanged main PNG differs from this Windows renderer in 20 color-channel
bytes out of 262,144 (maximum delta 3), so the existing strict fallback/live
pixel check fails on that baseline image. Re-exporting the portrait from the
unchanged Arcflash rig clears the check. This single derived PNG is included;
Arcflash source art and behavior are unchanged. Unrelated helmet re-export
rounding noise is excluded from the change.

The scope audit found 21 production PNGs per requested suit (63 total), plus
the single derived Arcflash PNG described above. Cyber's source paintings,
shipping art and frozen trace are unchanged. Standard stamp retention adds
js287 and removes js283 while retaining the other three recent bundles.

This validation prepares an unmerged pull request. Merge and deployment are
separate owner decisions and are not established by these local checks.
