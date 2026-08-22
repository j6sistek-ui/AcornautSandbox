# Acornaut landscape final asset pass

Final revised Phase 2 scope: `menu-home-wide.jpg` and `sky-wide.jpg` only.
The dark-sky work is owner-supplied and closed; this pass does not modify it.
The accepted `menu-splash-wide.jpg` is also outside this pass.

## Shipping files

| File | Dimensions | Bytes | JPEG quality | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| `docs/art/menu-home-wide.jpg` | 1920×1080 | 294,250 | 91 | `3dbd6c09c1d974926d8e398e5b6560fbdd1146eac2935289285c75b59e724e93` |
| `docs/art/sky-wide.jpg` | 1920×1080 | 256,602 | 87 | `947f2bb57ae984b3f26bd6bfd3f1edef9963783edc183ea6508372869f157955` |

Each file has a byte-identical copy under `sandbox_assets/art/`. The menu
asset is below its 300 KiB target. The fallback sky is below its 256 KiB cap.

## Portrait preservation

The two portrait originals are untouched and retain the same Git blob IDs as
the final refreshed base (`origin/main` at `af4b34435f4a8043bb2d52320cca288afb461336`):

| Original | Dimensions | Git blob | SHA-256 |
| --- | ---: | --- | --- |
| `docs/art/menu-home.jpg` | 900×1957 | `aa28519dc20eab905a7dbb290e51cf0456697124` | `c98cb3c08ab4952a0003722080ccdb17297f391e0df4e13d594c06acca76f754` |
| `docs/art/sky.jpg` | 1008×1792 | `09450d80613fed21fa4cbf24a0c3870d6dabdb31` | `3ab6535453cee29e1706abb118c3a35f8f812e146430b83009ef8c1f7c6be91e` |

## Generation provenance

Both masters were produced with the built-in OpenAI image generation tool in
source-referenced edit/recomposition mode. No third-party stock art or remote
fill was used.

- `masters/menu-home-wide-master.png`
  - generation result: `exec-7a6b7af0-36a3-4ed4-8f72-3ef8c02e92e1.png`
  - source reference: `docs/art/menu-home.jpg`
  - prompt: "Create a new 16:9 widescreen companion background for the Acornaut game, intended for a final 1920x1080 JPEG. Recompose the provided portrait menu-home painting into a genuine wide illustration while preserving its exact visual identity and story: a small squirrel astronaut viewed from behind at launch, arms spread, huge striped squirrel tail, white-and-gold space suit and backpack, facing a large burnt-orange ringed planet above a dusty lunar launch surface with pale rocket smoke. Match the source's painterly cinematic storybook realism, warm rust/gold highlights, deep navy-black space, soft atmospheric brushwork, and hopeful launch mood. Do not simply stretch, mirror, clone, tile, blur-fill, or outpaint empty bands. Invent coherent new painted space, stars, dusty horizon, rock silhouettes, and atmospheric smoke all the way to both side edges, with asymmetric natural structure. Composition for actual game UI: keep the central top 35% relatively dark and uncluttered for a white ACORNAUT wordmark and counters; keep the central lower 38% low-contrast and free of important subject details for a stacked loadout card, TAKE FLIGHT button, mode chips, and tab bar. Place the astronaut slightly left of center, entirely readable and not huge, with the helmet/backpack around the upper-middle; let the striped tail sweep toward the left side. Center the ringed planet behind and slightly to the right of the astronaut so it still frames the launch, but keep critical planet edges outside the center-top wordmark zone. The artwork must remain strong at both an 844x390 landscape-phone crop and a 1440x900 desktop cover crop. Background art only: no text, no logos, no buttons, no HUD, no frames, no borders, no watermark."
- `masters/sky-wide-master.png`
  - generation result: `exec-c61e1ae9-fb85-435e-8606-37308f578ca2.png`
  - source reference: `docs/art/sky.jpg`
  - prompt: "Create a new 16:9 widescreen companion background for the Acornaut game, intended for a final 1920x1080 JPEG. Recompose the provided portrait sky painting into a true wide environment while preserving its identity: very deep indigo and midnight-blue starfield, sparse crisp tiny stars and a few tiny distant planets, subtle magenta-violet wisps, and a broad luminous painterly nebula of warm gold, pale lilac, dusty blue, and soft white sweeping across the lower portion. Match the source's restrained painterly nebula style, quiet mood, palette, soft atmospheric depth, and landmark vocabulary. The middle player flight lane must remain dark, calm, readable, and low-contrast behind a squirrel, gates, debris, pickups, and HUD; keep the brightest nebula primarily across the lower quarter and toward the outer thirds, not directly behind the central flight lane. Extend coherent hand-painted cloud structure and star distribution to both left and right edges with natural asymmetry. Do not stretch, mirror, tile, clone, blur-fill, or use empty padded bands. The composition must survive both an 844x390 landscape-phone view and a 1440x900 desktop cover crop while retaining the same environment identity. Background art only: no astronaut, no gates, no foreground rocks, no UI, no text, no logos, no border, no frame, no watermark."

`build_final_assets.py` center-crops each 1536×1024 generated master to 16:9,
resizes it to 1920×1080 with Lanczos resampling, and selects the highest JPEG
quality from 70–95 that meets the approved byte budget. It then writes the
same payload to both shipping mirrors.

## Review evidence

`acornaut-landscape-final-contact-sheet.png` contains, for each asset:

- the unchanged portrait source;
- the full 1920×1080 companion;
- exact cover crops at 844×390 and 1440×900;
- the asset at both viewports under the actual game UI or game renderer.

Runtime evidence used the now-merged PR #66 widescreen beta at head commit
`4108b8cc9f7bf73df094eb763dc0ddd43a35af37`. The menu panels preserve PR #66's
intentional 500 px centered DOM column as-is. The sky panels use Deep flight
with the real squirrel, planets, debris, HUD, environment wash, and readability
scrim. No game or layout code is part of this pass.

The in-app browser capture surface rendered at 0.65 of the requested CSS
geometry and padded the PNG; the page itself reported the exact requested
844×390 and 1440×900 viewport rectangles. `build_contact_sheet.py` removes only
that known backing-surface padding and scales the rendered region back to its
measured CSS viewport for like-for-like review.

## QA

`illustrated-src/verify-art.py` passes all eight groups:

- `docs/art` and `sandbox_assets/art` match (260 files);
- all 257 mirrored raster assets decode;
- 200 runtime sprites satisfy the RGBA contract;
- the catalog/load, pal connected-component, helmet scale, raster-edge, and
  20-rig tail audits pass.

The contact sheet, raw local captures, masters, and the two deterministic build
scripts live only under `art-src/`; none are loaded by the shipping game.
