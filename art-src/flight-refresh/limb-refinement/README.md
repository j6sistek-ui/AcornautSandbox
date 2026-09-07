# Small limb-motion refinement

Follow-up to merged PR #210, based on main `c546cb93cc20f9ce3e3acef636869d1066cb11ae`.
The owner accepted the refreshed appearance and tail motion but requested a
slight arm and leg stretch comparable to the other suits. Ember's neutral
and fully climbing frames provided the motion comparison: bent elbows/knees
ease into a longer reach.

The five `*-edit.png` sheets are built-in ImageGen edits of the corresponding
approved `../*-master.png` sheets. Exact prompts are beside them. Only local
arm and leg regions are composited into the final shipping frames; the whole
edited sheets do not replace the approved paintings. This retains the tail
poses, body registration, original palette references and helmet sockets.
The first discarded Copper edit was too subtle and is not used.

`illustrated-src/refine-flight-limbs.mjs` reconstructs the originals, extracts
the generated edits through the existing registration, calibrates their
colours against the same static portraits, and composites feathered limb
windows. It is repeatable without accumulating edits. The windows include
the shoulder/hip joins and space for bent hands near the chin. Pixels outside
the windows are copied exactly. This supersedes the original README's
whole-painting-only export description for the final refined frames.

Reproduce after installing Node, TypeScript and @napi-rs/canvas:

```
node illustrated-src/refine-flight-limbs.mjs
node illustrated-src/export-sandbox.mjs
node illustrated-src/review-flight-refresh.mjs
node illustrated-src/verify-flight-limb-refinement.mjs
python illustrated-src/verify-art.py
```

`invariant-review.json` independently compares the final frames with merged
art: identical neutral pairs, unchanged central face and tail-plume regions,
changed arm/leg regions across every bank, and image-edge clearance. These
regions are specified in the verification script; this does not claim every
pixel around the chin or tail root is unchanged. `composite-report.json`
records the exact protected/edited footprint per frame.

All 30 existing art QA groups pass without changing their thresholds or
baseline. Full bounding-box diagnostics still report pose-width differences;
skull scale and tail continuity are checked separately. Renderer contact
sheets and QA output live in `../review/`. Native Canvas rendering was checked;
physical-device testing was not performed.
