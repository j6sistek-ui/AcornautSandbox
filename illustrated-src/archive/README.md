# Archive

One-off review scripts, each written for a single art delivery to render
its evidence (contact sheets, frame traces, before/after plates) into
`design/**` or a temp folder. They are not part of the build or the gate:
`export-sandbox.mjs`, `build-lab.mjs`, `verify-art.py` and the
`test-*.mjs` harness never call them, and several already import build
outputs that no longer exist (`draw-before.js`, `draw-old.js`, an Amethyst
suit). They are kept because the delivery notes under `art-src/**/README.md`
and `design/**/REVIEW.md` cite them as the method behind an approval.

Run one only to reproduce an old review. Nothing here is maintained; when
a cited delivery is superseded, its script can go with it.
