# Cyber trio asset processing and review

These tools only pack, scale, key, split, and measure source pixels. Character
designs and poses come from the retained image-generation masters. They must
not be repaired by warping individual frames or drawing new details in code.

`node illustrated-src/build-cyber-trio-references.mjs` rebuilds the 1536px,
3-by-3 references from the actual shipped Cyber cells. Each source cell is
scaled exactly twice; no artwork is recentered. The white cutters and black
hole plates are alpha selections. Cyber's nominal dome at 128,128 radius40
is a rig convention; it is not the actual position of Cyber's own skull.

Each suit directory contains:

- `frames/asc-1..9.png` and `frames/desc-1..9.png`: individually generated
  complete square canvases. Set `sourceLayout:"individual"` explicitly.
  The optional older `asc-master.png`/`desc-master.png` format stores nine
  poses in row-major order on a square of at least768px.
- `export.json`: `background` is `alpha` or `green-matte`; `scale` and
  `offset:[x,y]` define one uniform transform for the entire suit. The same
  scale applies to all18 cells. Optional `poseOffsets.asc/desc` are nine
  measured x/y translations per bank; `registrationEvidence` must identify
  their measurement record. Each offset moves the whole painting and must
  be judged against the corresponding Cyber pose, not a fixed neutral head.
  No bounding-box fitting or deformation is performed.
- `geometry.json`: measured256px coordinates. `head` is `[x,y,radius]`;
  `tailPivot:[x,y]` is the still split's actual attachment, using Cyber's
  spring behavior without copying a coordinate unrelated to the new cut;
  `asc` and `desc` each contain nine `{emitters:[[x,y],[x,y]]}` rows and may
  include a measured per-frame `head`. `still` contains its emitter pair.
  `tailMaskPolygons` are reviewed polygons selecting the still's tail.
- `still-tail-mask.png`: a256px binary selection generated from those
  polygons by `node illustrated-src/build-cyber-trio-masks.mjs <suit-id>`.
  Every selected original pixel goes to the tail; every other pixel goes
  to the body. Their disjoint union must be exactly the still.

`node illustrated-src/export-cyber-trio.mjs` exports all54 frames, three
stills, and six rig layers. Each still is the exact level climb frame.
It also generates the source hashes in `shipping-manifest.json` and the
runtime boot/head registration in `game/cyber-trio-registration.ts`.
Full builds reuse an existing PNG only when its source hash, transform,
exporter fingerprint and output hash still match that manifest. This avoids
host-specific canvas rounding changing an already reviewed painting. Any
changed input or output forces regeneration; partial previews always render.
It fails on missing sources, clipped sprites, implausible alpha coverage,
missing reviewed masks, or incomplete geometry. During art iteration,
`--suit porcelain --bank asc --frames-only` exports a partial preview and
deliberately does not write the final shipping manifest or registration.

`node illustrated-src/verify-cyber-trio-art.mjs` writes contact sheets,
Cyber silhouette overlays, and `measurements.json` beneath
`outputs/cyber-standard-trio/qa/`. The `--partial --suit <id>` option permits
an incomplete generation batch to be measured without claiming completion.
The alpha/margin/rig-union checks are structural gates. Review warnings
cover insufficient body-silhouette motion, a premature climb overshoot,
a plateau in climb cells7–9, and a dive tail that rises instead of settling.
These warnings require review; a successful process exit is not visual
approval. Body and skull regions are fixed, explicitly documented proxies,
and the x<101 tail proxy reproduces Cyber's published measurement. Envoy's
two tails and Patriot's rigid paper fan require anatomical review beyond
that proxy. No script can prove the absence of changing emblems, shifting
armor panels, extra limbs, or impossible joint motion.

The live comparison belongs in `/lab/premium-pilots/`: it calls the actual
game painter and simulation at fixed1/60-second steps, with Cyber alongside
the three replacement suits. Static loops alone do not validate wiring.

To reproduce the registration proposal for a suit, export an unregistered
preview and measure it without changing production artwork:

```sh
node illustrated-src/export-cyber-trio.mjs --suit porcelain --frames-only --preview-output registration-input --unregistered
python illustrated-src/measure-cyber-trio-registration.py --suit porcelain --preview registration-input --output registration-review
```

The measurement needs Pillow and NumPy. It writes proposed translations,
input hashes and before/after outline boards. Its weighted overlap excludes
most tail/ear pixels and is not an anatomical acceptance score. Review each
proposal before copying offsets into `export.json`; record that judgment in
the suit's registration evidence. Source masters remain unchanged.

Envoy's final independent motion review is pinned separately in
`nacre/motion-review.json`; the exporter never updates it. The standard art
gate requires all eighteen output hashes to match that review and checks
body and tail silhouette movement separately against Cyber. This replaces
only Envoy's whole-silhouette 45-degree PCA floor: paired tails and Cyber's
antennae make that axis unstable near equal eigenvalues, independently of
the visible tail arc. All other suits retain the existing pitch check.
Changed Envoy paintings require a new visual review before repinning.
`python illustrated-src/test-cyber-trio-motion-review.py` exercises altered
hash rejection and simulated frozen body/tail masks using temporary records.
It does not change production images or grant visual acceptance.

An isolated cache audit on 2026-09-12 verified the exporter fingerprint
`907b8e3d02ab4151d8348d25c989a5d1f10f4d914c0900a511c877c734c9915a`:
unchanged full exports reused 54 frame PNGs; source/output/pose-offset changes
invalidated the affected frame; scale/global-offset/matte/layout changes
invalidated the affected suit; exporter changes invalidated all frames.
Selected partial exports, global frames-only exports and named previews
always rendered. A changed invalid `masterSize` failed both cached full and
forced partial runs. The audit used synthetic fixtures entirely under ignored
`outputs/cyber-standard-trio/`; its detailed local-only receipt is
`outputs/cyber-standard-trio/export-cache-audit.json` and is not a committed
fixture or a visual-acceptance record. No production artwork was modified.

Use the repository's container workflow by default. If Docker is unavailable,
the documented repository fallback permits an existing canvas dependency via
`ACORNAUT_CANVAS`; no host package installation is required.
