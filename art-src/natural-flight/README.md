# Natural flight repair — 9 September 2026

The owner requested natural, standardized flight with stable costumes and
heads, then approved the new Gemmie tail whip as guidance. The owner also
permitted actual head-size normalization for consistent helmet fitting.

The first visual-clearance claim was incorrect: Void and Copper ascent 8
contained duplicated crown plumes. Both have been repaired. See
[the audit](AUDIT-2026-09-09.md) for the defects, original regression images,
repair boundaries and limitations of the checks. Passing measurements do
not establish complete anatomy or costume consistency.

## Exact scope

| Group | Shipping ids | Frames |
| --- | --- | --- |
| Standard | iontrim, copper, voidsuit, sammie, gemmie, leviathan, ember, frost, ghost | 8 ascent + 8 descent each |
| Approved companions | hedgehog (Quill), ferret (Noodle), raccoon (Bandit) | 16 loop frames each |

192 transparent 256×256 RGBA motion PNGs and 12 matching neutral portraits.
Panda excluded. Eclipse, Cryostar, Verdant and other frozen suits retain
their paintings and motion drivers.

## Sources and reproduction

OWNER-BRIEF.txt preserves the complete supplied brief. The nine per-suit
PROMPT files, STANDARD-PROMPT, MATTE-PROMPT and WHIP-PROMPT record generation.
The references directory holds original portraits and previous contacts;
gemmie-generated.png is the owner-approved tail reference. Nine master PNGs
are the final standard sources. LEVIATHAN-FINAL-REFINEMENT records its
continuous fin-ramp correction.

The anatomy-repair directory preserves the two defective exported frames,
generated crown edits, prompts and bounded repair rectangles. The exporter
uses generated alpha to remove the plumes. Copper additionally restores
its real rear ear from ascent 7, translated one pixel with the head path,
inside a small feathered crown patch; alpha-only removal left plume texture
inside the ear. These corrections affect only the two ascent-8 PNGs.

companions-owner-sheet.jpg is the supplied source, including the excluded
panda. Three owner-cells PNGs isolate the approved sequences. The Quill
repair master and QUILL-TAIL-REPAIR-PROMPT preserve its generated correction.
Superseded companion generations are not used.

Run from the repository root using workspace Node/canvas and Python/SciPy:

~~~sh
python illustrated-src/measure-natural-flight.py
node illustrated-src/export-natural-flight.mjs
node illustrated-src/export-owner-companions.mjs
python illustrated-src/verify-natural-flight.py
python illustrated-src/test-natural-flight-anatomy.py
node illustrated-src/export-sandbox.mjs
node illustrated-src/build-lab.mjs
node illustrated-src/test-natural-flight.mjs
~~~

head-seeds.json and head-tracks.json measure painted skulls independently
of DOME. Whole-cell scaling preserves aspect ratio, including Sammie's
rectangular source cells. Every standard skull registers to radius 36;
a common 192px runtime reference prevents tail length from resizing helmets.
Both banks and the static portrait share an exact neutral.

Leviathan's generated neutral head is reused in its exported frames along
the same smooth path, with a 12px collar blend. This removes face/fin shimmer
while retaining the generated tail and forearm sequence. The result is
baked into whole-character PNGs, not an additional runtime split rig.

Companion extraction uses a fixed 176px window around each 160px source
cell, recovering quills/tails crossing the nominal grid. White keying and
connected-component isolation remove matte and neighbouring ink. The same
uniform 256px mapping preserves the approved movement. Only Quill frames
8–12 use generated alpha within recorded tail regions; original surviving
RGB, faces, costume, limbs and body poses remain. The companion export
receipt records every crop and localized repair.

Set NATURAL_FLIGHT_OUTPUT to a separate directory with a trailing slash for
isolated re-export. Run the standard exporter first, then the companion
exporter. Shipping registration, DOME entries and frame-hashes.json pin this
reviewed export. Future intentional art changes require renewed visual
review and corresponding anchor/hash updates. The historical flight-refresh
exporter now refuses to overwrite shipping art.

## Runtime

The nine standard banks use a shared pose follower limited to 16 painted
steps per second through tap/dive reversals and the neutral crossing. All
eight descent frames are enabled. The body reference, helmet, loading
fallback, portrait and Spill cockpit agree. Eight obsolete standard split
rigs are retired; the rig audit receives the active roster explicitly.
Companion loop loading and its existing clock are retained. Physics,
controls, rewards and save schema are unchanged. Cache stamp 248 is rebuilt
after integrating main 100ca6e, preserving its flight-family declarations
and frozen Cryostar/Verdant behavior.

## Visual review

The repeat audit inspected all nine masters, the 192 exported poses in
whole-character/head contacts and the three companion loops. The original
review missed two anatomy defects, so its blanket clearance is withdrawn.

| Suit | Features checked across the bank |
| --- | --- |
| Ion | Navy plates, cyan shoulder ring/piping, collar and wrist bands |
| Copper | Copper/brass armor, gray collar, shoulder hardware and cuffs |
| Void | Closed violet garment, gold closure/trim and cuffs |
| Sammie | Red samurai panels, gold edging/fasteners and black joints |
| Gemmie | Opal plate facets, pastel materials, cuffs and tail plume |
| Leviathan | Teal scales, cyan shoulder ring, head fins and two-lobed tail fin |
| Ember | Charcoal suit, gold/orange trim, closed collar and cuffs |
| Frost | White fur, pale-blue plates, collar and wrist trim |
| Ghost | Pearl spectral body, stable face and wisps without costume additions |
| Companions | Approved source poses and costume pixels; localized Quill tail repair |

No additional duplicated crown plume was found among the other ten
characters. No disappearing closure, added button, relocated panel or
suit-color switch was observed in the repeat contact review. This is a
visual observation, not an independent proof of zero costume delta.
The new crown envelope rejects the actual two defective originals and
passes their repairs; it does not inspect tail intersections elsewhere.

Every standard bank has head x-span 0px, fitted radius 36px, worst adjacent
head step 1.4px and median path curvature 0.075px. Independent pupil residual
span is at most 4.4px; painted skull area also passes the gate. No frame
touches the 2px edge margin. Each portrait exactly matches its first pose.

Tail work counts changed premultiplied RGBA pixels (>24/255 in any channel):
far >=2 head radii divided by near <=1.2 radii. This explicit implementation
does not claim to reproduce the unpublished algorithm behind the brief's
example scores. All nine standards pass 2.9 (range 2.986–4.216). Companion
ratios are reported, while their motion follows the owner's later explicit
sheet approval rather than the standard squirrel choreography.

## Verification

- Source/lab builds, TypeScript and diff whitespace checks pass; no lint script.
- All 32 shipping art QA groups pass, including the new negative regression
  using the two actual defective images and a repair-locality comparison.
- Production painter: 8,640 frame/helmet/size cases covering all 30 helmets,
  48 companion poses, loop wrap/held clocks, 3,240 live simulation frames,
  2,160 preview frames and nine neutral loading/portrait comparisons.
- Full harness: 41 pass, 5 fail, 0 skipped out of 46. All five also reproduce
  on unchanged main 100ca6e: Arcflash loading-pixel comparison, Hyper Run
  keyboard-repeat resume, bridge comment scanner, and two Spill tests using
  Windows C: paths as ESM URLs. The integrated stamp-248 run also reports
  41 pass/5 fail. No unrelated fixes are included.
- Docker daemon unavailable; repo-authorized workspace Node/bundled Python
  fallback used. No host system packages installed.
- Browser at 390×844: production starts with a 390×844 canvas; rig bench loads
  all 16 Leviathan poses and its [206,106,36] neutral registration. No console
  errors. Offline review pause/helmet controls work. Screenshot API returned
  unavailable; review contacts are native painter renders, not screenshots.

The separate offline review package includes playback and frame controls,
individual PNGs, contact sheets, and pixel/runtime reports.
