# Landscape and Desktop Readiness Audit

**Phase:** 1 — audit and asset plan only

**Audit date:** 2026-08-21

**Baseline:** `origin/main` at `5fbb4eb035a12349a49a8829da5aabcd48de9f67`

**Test pages:** `docs/index.html`, `docs/beta/index.html`, and `docs/lab/spill/index.html`

**Decision requested:** approve or amend the companion-background specification in [Recommended asset specification](#recommended-asset-specification).

No art, layout, simulation, generated JavaScript, version constant, or save-key change is part of this phase.

## Executive conclusion

Acornaut is not yet landscape- or desktop-ready, and replacing backgrounds alone will not make it ready. There are three independent constraints:

1. **Asset:** all 24 gameplay skies and the two menu paintings are portrait compositions. The canvas uses a centered `cover` crop, so a landscape stage retains only about **46% of a 900×1600 sky's height**. Recognizable nebula structures and menu focal art disappear.
2. **Layout:** both production and beta cap `.ac-stage` at 480 px. An 844×390 browser therefore shows a 480×390 game with 182 px side gutters; a 1440×900 browser shows a 480×900 phone strip with 480 px gutters. Several tall sheets have only 75–274 px of usable scrolling height in landscape. The Spill is narrower still: its `width: min(100vw, 46vh)` rule produces a 180×390 stage.
3. **Simulation/tuning:** normal gate openings, margins, sprite radii, tutorial coordinates, and several HUD assumptions are fixed pixels tuned for a tall field. At 390 px high, a fresh 168 px gate with two 72 px margins leaves only 78 px in which its center can vary. Resizing an active normal run updates `W/H` but does not remap existing entities. Hyper Run is deterministic in a fixed 360×640 authority space, but its renderer scales X and Y independently.

The asset work should proceed, but as a foundation for a separate responsive-layout and tuning pass.

**Recommendation:** keep every current portrait file unchanged and add art-directed **1920×1080 landscape companions**. Do not replace the portrait skies with square masters. Companions guarantee no portrait regression, preserve each known environment more faithfully, and add less risk to the live experience. The later code pass will choose portrait or wide art by rendered aspect ratio.

## Method and verified baseline

### Viewports

| Label | Browser viewport | Current stage observed | Purpose |
|---|---:|---:|---|
| P — portrait phone | 390×844 | 390×844 | Current intended experience |
| L — landscape phone | 844×390 | 480×390, centered | Short-height and wide-crop stress |
| D — desktop | 1440×900 | 480×900, centered | Desktop utilization and tall-strip stress |
| L — Spill | 844×390 | about 180×390, centered | Spill's separate `46vh` width rule |
| D — Spill | 1440×900 | about 414×900, centered | Spill desktop behavior |

Each requested surface was opened and interacted with locally from `docs/`. A Wormhole Run prototype, Hyper Run prototype, and parameterized Spill campaign mission were flown. The beta UI did not expose Chapter 2 at a zero-star save, so the Wormhole chapter renderer was validated through its identical Wormhole Run base and the campaign mission definition; see [Beta campaign access inconsistency](#beta-campaign-access-inconsistency).

Current main also contains `docs/lab/skytest/`, a beta QA utility for comparing painted and procedural skies at a viewport-filling size. It is not a shipped gameplay/menu surface and needs no shipping asset of its own. Phase 2 should reuse it as a live wide-background review harness rather than add another lab page.

### Ground truth confirmed

- `docs/art/skies/` contains 24 JPEGs, each 900×1600 RGB.
- The 24 skies total **4,736,863 bytes (4.517 MiB)**; individual files range from 114,140 to 308,855 bytes, averaging 197,369 bytes.
- `docs/art/sky.jpg` is 1008×1792 RGB and 468,520 bytes.
- `docs/art/menu-splash.jpg` is 720×1280 RGB and 148,404 bytes.
- `docs/art/menu-home.jpg` is 900×1957 RGB and 156,472 bytes.
- Current `ART_VER` is `73`; this audit does not change it.
- `.ac-stage` is `width: 100%; max-width: 480px; height: 100%` in both shipped pages.
- Engine resize sets `W = Math.min(parent width, 480)` and `H = parent height`.
- Gameplay skies and the fallback sky use centered cover-drawing; the splash and home paintings use CSS `background-size: cover`.
- Environment skies are loaded on demand, not all at boot.
- `docs/art/` and `sandbox_assets/art/` are byte-identical across 243 files.
- `illustrated-src/verify-art.py` passes all eight QA groups: mirror, decode, sprite contracts, pals, helmet scale, raster edges, and rig/tail checks.

### Crop math

For a current 900×1600 sky, centered cover-cropping produces:

| Render box | Source retained | Consequence |
|---|---:|---|
| 390×844 portrait | about 82% of source width; full height | Mild side crop; current composition remains readable |
| 480×390 current landscape stage | full width; about 46% of source height | More than half the vertical painting is discarded |
| 480×900 current desktop strip | about 91% of source width; full height | Art reads, but only inside a narrow phone column |

A future full-width 844×390 stage would make the same portrait source even less useful: only about 26% of its height would remain. A wide companion is therefore required before the 480 px cap can be safely removed.

## Cross-cut findings

### A — Asset problems (this job)

| ID | Finding | Impact | Phase 2 action |
|---|---|---|---|
| A1 | The 24 gameplay skies are portrait-only. | Free Flight, Deep, Lost, campaign flights, tutorial, and the normal segment of Hyper Run show a narrow center band in landscape. Environment landmarks can disappear even though the environment-to-sky mapping remains active. | Add one art-directed wide companion for every sky ID. |
| A2 | `menu-splash.jpg` is portrait key art. | The landscape title crop loses much of the squirrel/space composition and crowds the title stack into a shallow band. Social cards also reference this file, so the current file must remain stable. | Add `menu-splash-wide.jpg`; keep the current social/portrait file. |
| A3 | `menu-home.jpg` is portrait key art with a vertically staged focal path. | Landscape cover-crop removes most of the painting and puts controls over an arbitrary middle slice. | Add `menu-home-wide.jpg` with the same subjects re-composed around a protected center/control-safe region. |
| A4 | `sky.jpg` is a portrait fallback/non-play canvas image and is stretched, not cover-cropped, on non-play engine screens. | It can distort when visible during loading or transitions and is not suitable as a future wide fallback. | Add `sky-wide.jpg`; retain `sky.jpg`. Later code selects and cover-draws consistently. |
| A5 | Wide compositions must preserve environment identity, not merely palette. | Players use the mapped sky as gameplay/location information. A generic extension would weaken that cue. | Extend/recompose the same nebula masses, lighting direction, value hierarchy, and mood; do not invent replacement environments. |

### L — Layout problems (separate code pass)

| ID | Finding | Evidence | Recommendation for code pass |
|---|---|---|---|
| L1 | Global 480 px stage cap creates a phone strip. | L stage: 480×390 with 182 px side gutters. D stage: 480×900 with 480 px side gutters. | Introduce responsive stage width/aspect policies and a maximum playable width chosen from gameplay tests, not a universal phone cap. |
| L2 | Menu sheets assume tall height. | At L, Hangar's scroll viewport is about 75 px for about 748 px of content; Levels/Profile/Help have about 274 px for 833/591/989 px. | Add short-height breakpoints: horizontal/tabbed content, smaller headers, denser cards, and safe-area-aware fixed navigation. |
| L3 | Home controls and hero composition share one vertical stack. | At L, title and mode controls compress while the painting remains an absolute full-height layer. | Use a two-region landscape layout: art/focus pane plus control pane, with a single-column portrait fallback. |
| L4 | Result sheets fit only by compression and have no dedicated content scroller. | The tutorial reward result fit at 480×390, but it consumed nearly the whole height and longer reward/level-result variants have no reserved safe zone. | Give result content a bounded scroller and keep the primary action pinned within safe areas. |
| L5 | HUD text and tutorial cards are sized for portrait. | They remain legible at 480×390 but occupy a much larger share of the flight lane. | Add a short-height HUD scale and move tutorial copy away from collision-critical space. |
| L6 | Spill is explicitly portrait-shaped. | `.sp-root { width: min(100vw, 46vh) }` yields about 180×390 at L and 414×900 at D. | Replace the `46vh` width lock with responsive arena sizing; reorganize HUD/card content for a wide field. |
| L7 | Desktop has no use for adjacent space. | Menus and gameplay stay in a centered strip. | Decide whether desktop uses a wider single arena, an arena plus contextual side panels, or both; keep one authoritative play rectangle. |
| L8 | Beta campaign missions are not actually all reachable from a fresh beta save. | Chapter 2 still shows `12 TO OPEN`; its header has no action at zero stars even though beta unlock gates are enabled elsewhere. | Make beta chapter/level access consistently bypass progression, or provide a documented mission QA launcher. |

### S — Simulation and tuning problems (separate code pass)

| ID | Finding | Evidence | Recommendation for code pass |
|---|---|---|---|
| S1 | Normal gate geometry consumes most of a short field. | Base gap 168 px, top/bottom margins 72 px, planet radius 42 px; at H=390 the random center range is only 78 px before reachability clamps. | Define geometry from a canonical playfield or aspect-aware scale; separately validate reachable vertical travel and collision clearance at every supported aspect. |
| S2 | Horizontal spawn cadence is fixed pixels and only weakly related to width. | Gap spacing starts at 230 px; initial spawns are `W + 90 + n×spacing`; squirrel X is `18%` of W. | Tune look-ahead distance and spawn spacing in seconds/canonical units, with minimum readable lead time on wide screens. |
| S3 | Active normal runs are not remapped on resize. | `resizeWorld` remaps Wormhole entities, but normal modes only replace `W/H`; existing Y positions and X distances remain in old coordinates. | Pause on orientation change and remap all live entities, or restart from a safe checkpoint. Add portrait↔landscape transition tests. |
| S4 | Tutorial course uses fixed 176 px gap and fixed 70 px margins. | At H=390 its valid center range collapses to roughly 158–232 px; scripted dive/landing arcs are also derived from H with fixed bounds. | Author tutorial beats in canonical coordinates and add a short-height course variant or scale. |
| S5 | Lost rotation and mirror effects have less safe offscreen margin in a short stage. | The entire playfield rotates around its center while gates/sprites remain fixed-size. | Compute rotated safe bounds and spawn padding from the playfield diagonal; test collision/readability at maximum tilt. |
| S6 | Wormhole Run has aspect-aware resize logic, but its corridor minimums are still fixed. | Corridor half-width clamps include 72/88/150 px constants and `H×0.15/0.27`. | Keep the authored ratio model, then re-tune minimum corridor/pilot clearances for short fields. |
| S7 | Hyper Run is deterministic but visually anisotropic. | Authority is fixed at 360×640 and independent of viewport. Rendering uses `sx=W/360`, `sy=H/640`, and sizes sprites with `min(sx,sy)`, so positions stretch differently by axis. | Preserve fixed-step authority; render into a uniform-scale canonical camera with letterbox/extra horizontal reveal, then prove identical replay results across viewports. |
| S8 | Spill resizes simulation `W/H` directly with its root. | Its procedural arena and spawn/collision space change with a very narrow L root. | Choose a canonical simulation space or retune spawning/collision for aspect classes; do not let CSS width silently define difficulty. |

## Surface-by-surface audit

Legend: **A** asset, **L** layout, **S** simulation/tuning. “No new asset” means the surface should be fixed in code without generating a background for it.

| Surface | P — 390×844 | L — 844×390 | D — 1440×900 | Classification and recommendation |
|---|---|---|---|---|
| Title / cold open | Intended composition and full-height hero art read correctly. | 480×390 stage; central band of splash; focal art and title compete; large outer gutters. | 480×900 phone strip; art reads but desktop is mostly empty. | **A2, L1.** Add wide splash; later use responsive title/control placement. |
| Home / mode selector | Portrait painting and controls read as designed. | Home painting is severely cropped; controls compress vertically; slight title clipping risk. | Narrow strip with unused desktop sides. | **A3, L1, L3.** Add wide home art; later split art and controls on wide screens. |
| Hangar | Works with an intentional vertical scroller. | Only about 75 px of the roughly 748 px content is visible between header and nav. | About 585 px of content viewport; still a narrow phone strip. | **L1, L2.** No new background. Use responsive grid/side panel. |
| Levels / Star Chart / Log | Usable portrait scroll. | About 274 px of roughly 833 px content; chapter scanning is slow and overlay room is tight. | About 784 px of content but still only 480 px wide. | **L1, L2, L8.** No new background. Use multi-column chart and wide mission sheet. |
| Shop | Fits in portrait. | Fits the short stage better than other menus, but remains inside a 480 px strip. | Large empty desktop gutters. | **L1.** No new background. Use responsive card grid. |
| Profile | Fits in portrait. | About 274 px for roughly 591 px content. | Fits vertically but is constrained to a narrow column. | **L1, L2.** No new background. Use two-column stats/loadout. |
| Help | Long but usable portrait scroll. | About 274 px for roughly 989 px content; only the top briefing is visible initially. | About 784 px for roughly 989 px, still narrow. | **L1, L2.** No new background. Use columns or topic tabs. |
| Result sheets | Reward/crash sheet fits and is readable. | Tutorial reward result fit, but occupies the whole short stage; long variants are fragile. | Readable in a phone strip. | **L1, L4.** No new background; give content a safe scroller/pinned actions. |
| Tutorial | Intended vertical course and copy hierarchy. | Portrait sky loses more than half its height; fixed tutorial card and 176 px gap dominate the short lane. | Tall strip, nearly current composition. | **A1, L5, S4.** Wide sky plus canonical/short-height tutorial layout and course tuning. |
| Free Flight | Intended sky, gate rhythm, and vertical travel. | Sky is a center band; fixed gate geometry fills most of the height; existing objects are not remapped on rotation. | Sky reads inside a narrow strip; no desktop width benefit. | **A1, L1, S1–S3.** Wide sky, then retune/canonicalize. |
| Deep | Dark portrait plate reads in portrait. | Dark plate is vertically cropped to a center band; first-shift HUD is crowded into a shallow lane; gate issue remains. | Phone strip. | **A1, L1/L5, S1–S3.** Add all 14 dark wide companions. |
| Lost | Dark plate and rotation read in portrait. | Center-band sky plus rotation puts large objects near/through short edges; little offscreen safety. | Phone strip. | **A1, L1, S1–S3/S5.** Wide dark skies; calculate rotated safe bounds. |
| Arcade | Procedural retro backdrop scales without a missing painted background. | Playable rendering fills the 480×390 stage, but gate geometry and HUD still consume too much height. | Phone strip. | **L1/L5, S1–S3.** No new backdrop asset. |
| Wormhole Run | Procedural corridor reads and prototype is playable. | Corridor fills the 480×390 stage, but the short field reduces vertical reaction space; gutters remain. | Phone strip. | **L1, S6.** No new backdrop asset. Preserve its existing resize remap and retune short-height bounds. |
| Wormhole chapter mission | Same renderer/physics as Wormhole Run, with campaign timer/goals. | UI entry is blocked from a fresh beta save; underlying corridor has the same short-height concerns. | Same narrow-stage constraint. | **L8, S6.** No new background. Fix beta QA access and mission overlay layout. |
| Spill campaign mission | About 388×844; portrait briefing and procedural field read. | About 180×390: an extremely narrow survival lane with dense HUD and large outer gutters. | About 414×900 strip. | **L6, S8.** No new backdrop asset. The procedural star field should be adapted in code. |
| Hyper Run prototype | Fixed 360×640 authority is close to intended portrait shape. | Portrait sky is center-cropped; positions stretch by X/Y while sprite size follows the smaller scale; stage remains 480 px wide. | Tall phone strip. | **A1, L1/L5, S7.** Wide sky selection plus a uniform canonical camera; transparent race portals/gates remain valid. |

## Beta campaign access inconsistency

The beta page correctly unlocks premium gear and the endless mode buttons, but a fresh zero-star beta save still displays Chapter 2 as `12 TO OPEN` and does not attach an open action. The first campaign substitutions are Chapter 2 mission 4 (Wormhole) and Chapter 2 mission 8 (Spill), so neither is reachable through the requested beta LEVELS path without earning stars.

For this audit:

- the Wormhole renderer and physics were flown through the Help screen's `WORMHOLE RUN` entry;
- the campaign-specific Wormhole mission definition and overlay path were inspected in source;
- Spill mission `2-8` was launched through the same parameterized lab URL that the Star Chart produces;
- Hyper Run was launched through the beta `PROTOTYPE CHAPTER 1` card.

This is not an asset defect. The separate code pass should make beta campaign access consistent or add a documented QA launcher.

## Recommended asset specification

### Decision: landscape companions, not square replacements

Keep current portrait files byte-for-byte and add wide companions. A later code pass selects the companion when the actual render box is landscape.

Why this is safer than replacing each source with a square master:

- **Zero portrait regression:** the current 390×844 experience continues to use the reviewed portrait art.
- **Better art direction:** a 16:9 composition can preserve or intentionally relocate the recognizable landmark instead of requiring both orientations to crop the same square center.
- **Controlled download:** skies load on demand. A device fetches the selected orientation, not both, once the later loader change is made.
- **Reversible rollout:** wide selection can be enabled per family or environment without changing existing URLs.
- **Social metadata stability:** `menu-splash.jpg` can remain the existing card image until a separately reviewed social-card change.

A 1600×1600 square is not recommended. It contains 2.56 million pixels versus 1.44 million today, yet a 390×844 or 844×390 cover crop would retain only about 46% of one axis. It costs more while still asking one protected center to serve two very different compositions.

### Shipping files

All new files are mirrored byte-for-byte into both `docs/art/` and `sandbox_assets/art/`.

| Family | Current files retained | New Phase 2 files | Resolution | Encoding and per-file budget |
|---|---|---|---:|---|
| Gameplay skies | `skies/{id}.jpg` for the 24 IDs below | `skies/{id}-wide.jpg` | 1920×1080 | Progressive or optimized JPEG, sRGB, no metadata; target ≤256 KiB, hard cap 320 KiB |
| Generic fallback | `sky.jpg` | `sky-wide.jpg` | 1920×1080 | JPEG; target ≤256 KiB, hard cap 320 KiB |
| Title art | `menu-splash.jpg` | `menu-splash-wide.jpg` | 1920×1080 | JPEG; target ≤300 KiB, hard cap 384 KiB |
| Home art | `menu-home.jpg` | `menu-home-wide.jpg` | 1920×1080 | JPEG; target ≤300 KiB, hard cap 384 KiB |

Sky IDs/names are exact and stable:

`indigo`, `ice`, `inferno`, `mono`, `magenta`, `verdant`, `ghost`, `neon`, `vortex`, `gold`, `dark1` through `dark14`.

Examples: `indigo-wide.jpg`, `dark1-wide.jpg`, `dark14-wide.jpg`.

Do not encode orientation in version folders, do not rename current files, and do not change `ART_VER` during this job. Source-generation masters and contact sheets belong under `art-src/`, never the shipping trees.

### Load-size budget

| Set | Current | Phase 2 incremental target | Hard ceiling |
|---|---:|---:|---:|
| 24 gameplay skies | 4.517 MiB | ≤6.0 MiB total | 7.5 MiB total (24×320 KiB) |
| Fallback + two menu wides | n/a | ≤0.84 MiB total | 1.063 MiB total |
| **All new shipping art** | n/a | **≤6.84 MiB** | **≤8.563 MiB** |

Runtime acceptance is stricter than repository total: after the code pass, portrait must not download a wide companion, landscape must not download the portrait equivalent, and only the current/next environment skies may be prefetched. No all-skies preload.

If a sky cannot meet the target without banding or destroying painterly texture, it may use the hard cap with a written exception in the Phase 2 delivery notes. Do not lower resolution or switch one isolated file to a different format without approval.

### Composition contract

Each wide file must:

1. remain unmistakably the same environment as its portrait source: same palette, nebula/void family, lighting direction, density, mood, and landmark vocabulary;
2. place unique focal structures so they survive both an 844×390 crop and a 1440×900 crop from the 1920×1080 wide image;
3. keep the player lane readable under existing environment washes and legibility scrims;
4. avoid a high-detail vertical seam through the typical player anchor at 18% of playfield width;
5. avoid baking sprites, gates, planets, HUD, typography, vignette bars, or gameplay effects into the background;
6. avoid near-matching the environment's biased planets/debris where those objects most often spawn;
7. preserve enough quiet value structure behind the score, counters, pause control, and tutorial copy;
8. extend real visual structure to both side edges—no blurred mirroring or obvious generative fill.

Menu wide art additionally needs a protected control-safe area. The Phase 2 contact sheet should show the art both clean and under actual title/home UI at the three audit viewports.

## Unaffected assets

The following are orientation-neutral transparent cutouts and should not be regenerated for this job:

- squirrel animation frames;
- 20 suits and 23 helmets;
- 14 pals;
- 33 planets and 27 debris pieces;
- acorn, golden, shield, frozen, and shield-acorn pickups;
- Hyper Run portals, rings/gates, glyph layers, and race cutouts;
- suit rig/tail layers;
- icons, audio, manifests, and fonts.

The art gate confirms the runtime sprites decode and meet their 256×256 RGBA contracts (with the expected 512×512 Hyper Run layers). Their transparent canvases and draw-time positioning make them orientation-neutral. Any apparent size/collision problem in landscape is a renderer or simulation issue, not a reason to redraw the cutout.

Arcade, Wormhole Run, and Spill use procedural backdrops. They need code/layout/tuning work, not new background paintings. Hyper Run uses transparent race cutouts over the normal painted sky outside its procedural tunnel, so it benefits from the wide sky set but not new race sprites.

## Phase 2 review and acceptance gates

Phase 2 should not begin until this spec is approved. When approved, delivery must include:

1. all approved wide files in `docs/art/` and byte-identical mirrors in `sandbox_assets/art/`;
2. source/review material only in `art-src/`;
3. one contact sheet per background family showing, at actual game scale:
   - full wide image;
   - 390×844 portrait crop;
   - 844×390 landscape crop;
   - 1440×900 desktop crop;
   - the crop under the actual game/menu UI;
4. a before/after pair for every replaced file; under this recommendation no current shipping file is replaced, so provide portrait-source vs wide-companion identity pairs instead;
5. a size report with per-file bytes and total incremental bytes;
6. decode/dimension/color-mode checks for every new file;
7. the unchanged `illustrated-src/verify-art.py` passing with every new file decoded and mirrored—do not alter generated bundles;
8. mirror proof showing zero differences between `docs/art/` and `sandbox_assets/art/`;
9. visual confirmation that every environment retains its identity and that the existing portrait files are unchanged;
10. no changes to generated `js*` directories, `ART_VER`, `SAVE_KEY`, or `LEGACY_KEYS`.

## Separate code-pass backlog

The later responsive implementation should be planned as one coordinated pass:

1. remove/replace the 480 px stage cap and define supported playfield/aspect bounds;
2. select `-wide` backgrounds by the rendered playfield ratio, with orientation-specific on-demand loading;
3. make menu and result DOM responsive at short heights and desktop widths;
4. choose canonical simulation/camera behavior for normal, tutorial, Wormhole, Spill, and Hyper Run;
5. retune gates, spawn lead time, collision/readability margins, and HUD for landscape;
6. remap or safely restart active runs on orientation changes;
7. add viewport tests at 390×844, 844×390, and 1440×900 for every surface in this audit;
8. add deterministic assertions that Hyper Run results remain identical across those render sizes;
9. make beta campaign mission access consistently unlocked for QA;
10. build and publish bundles only in the maintainer-owned release step.

## Sign-off choices

Please approve or amend these four points before Phase 2:

- **Strategy:** retain portrait originals and add landscape companions.
- **Resolution:** 1920×1080 JPEG companions.
- **Scope:** 24 skies + `sky-wide.jpg` + `menu-splash-wide.jpg` + `menu-home-wide.jpg` (27 new mirrored assets).
- **Budget:** target ≤6.84 MiB total new shipping art; hard ceiling ≤8.563 MiB with per-file caps above.

**Hard stop:** no assets will be generated until this Phase 1 plan is signed off.

## Phase 1 sign-off and revised Phase 2 scope

**Approved:** 2026-08-21

The audit findings, crop math, and landscape-companion strategy are approved. A subsequent product decision removes the ten named normal-mode skies from Phase 2 because those environments are moving to procedural runtime rendering. Their portrait paintings remain untouched as live assets and reversion fallbacks; no wide companions will be generated for `indigo`, `ice`, `inferno`, `mono`, `magenta`, `verdant`, `ghost`, `neon`, `vortex`, or `gold`.

The approved Phase 2 shipping scope is therefore 17 new mirrored JPEGs:

- `skies/dark1-wide.jpg` through `skies/dark14-wide.jpg`, 1920×1080;
- `menu-splash-wide.jpg` and `menu-home-wide.jpg`, 1920×1080;
- `sky-wide.jpg`, 1920×1080.

Delivery is split by a mandatory style-review stop:

1. Batch 1: `dark1-wide.jpg` through `dark5-wide.jpg` plus `menu-splash-wide.jpg`, with clean/source comparisons and actual-game 844×390 and 1440×900 evidence.
2. Batch 2, only after approval: `dark6-wide.jpg` through `dark14-wide.jpg`, `menu-home-wide.jpg`, and `sky-wide.jpg`, under the same evidence contract.

The L1–L8 and S1–S8 findings remain assigned to a separate engineering pass. Phase 2 is art-only and must not change layout, simulation, generated bundles, `ART_VER`, `SAVE_KEY`, or `LEGACY_KEYS`.
