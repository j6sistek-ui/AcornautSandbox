# Landscape background pass — Batch 1 review

This directory is the review and provenance package for the Phase 2 style-sign-off batch. It contains the six lossless generation masters and the two requested contact sheets. Shipping JPEGs live in both `docs/art/` and `sandbox_assets/art/` as byte-identical mirrors.

No existing portrait art was replaced, renamed, or modified. The ten normal-mode procedural candidates are out of scope and have no wide companions here.

## Shipping exports

| Asset | Dimensions | JPEG quality | Size | SHA-256 |
|---|---:|---:|---:|---|
| `dark1-wide.jpg` | 1920×1080 | 76 | 248.2 KiB | `4d72140991446b220800009fee680a115aa3a3f97396525caf807f40f40c7d18` |
| `dark2-wide.jpg` | 1920×1080 | 84 | 248.5 KiB | `9b9ab1e787c6872de08761ea22fbf2471d5fb846832154504123d1afc05ac352` |
| `dark3-wide.jpg` | 1920×1080 | 92 | 228.1 KiB | `421e4d5a3626224f23287f8cf3b1e5c61c7d87ff778c3323699499c2fdc4b391` |
| `dark4-wide.jpg` | 1920×1080 | 87 | 245.8 KiB | `de41aba4bcc0c4a477e69abe1962bb1a3efaf96dce9003cf2696a5f48fcba7a2` |
| `dark5-wide.jpg` | 1920×1080 | 67 | 253.4 KiB | `089e22324b70d5baf1edf6a9cde75d7880451f6a8ed018069d8ab06280d28a00` |
| `menu-splash-wide.jpg` | 1920×1080 | 90 | 294.5 KiB | `e3bc437652a77afea0221fe80cf0bd788fab87f94431a4e937b168b8987aa54a` |

All six files meet the preferred target. No hard-cap exception is required.

## Review evidence

- `contact-sheet-darks-batch1.jpg` places every untouched portrait source beside its clean 1920×1080 companion and captures it at 844×390 and 1440×900 in the repository's full-viewport Background Test. That lab uses the actual squirrel, planets, debris, acorns, star layer, and cover-fit path; collision is intentionally disabled for judging art.
- `contact-sheet-menu-splash-batch1.jpg` shows the untouched portrait, clean wide companion, and the companion beneath the production splash gradient, title, acorn icon, prompt, and build line at both target viewports. The temporary review surface copied the exact UI declarations and markup from `docs/index.html` and `illustrated-src/game/standalone.ts`; no shipping HTML, TypeScript, or compiled bundle was changed. The capture was made on art v73; the final rebase to art v74 changed the build token and normal-sky renderer but left the title-stack declarations unchanged.
- Browser captures were made at the requested CSS viewports and normalized from the in-app browser's 0.65 backing scale before contact-sheet composition.

## Generation mode and prompt set

The compositions were created with OpenAI's built-in image generation mode, one source-referenced edit per asset. Each call used this common direction:

> Create a production 16:9 landscape companion for the supplied Acornaut portrait source. Treat it as an edit and re-composition, not a redesign. Preserve the environment's palette, painterly nebula/void family, lighting direction, mood, and landmark vocabulary. Paint coherent original structure all the way to both side edges; do not mirror, stretch, tile, clone, blur-fill, or add collage seams. Keep focal structures legible through 844×390 and 1440×900 cover crops, preserve a calm readable player lane, and add no foreground game objects, UI, text, logo, border, or watermark. Intended delivery: 1920×1080 JPEG.

Per-asset identity clauses:

- `dark1`: near-black midnight indigo, sparse white stars, restrained diagonal and curling brush-nebula gestures, quiet center.
- `dark2`: desaturated navy, a pale dusty Milky Way ribbon and cloud knots, with the portrait's vertical landmark translated into a composed diagonal span.
- `dark3`: near-black charcoal, extremely sparse stars, and a low diagonal haze in muted blue and brown-gray.
- `dark4`: blue-black slate, broad crossing blue-gray cloud bands, and several tiny spindle-galaxy marks.
- `dark5`: neutral cool charcoal, dense fine stars, and a branching luminous cloud web enclosing deep black void pockets.
- `menu-splash`: preserve the recognizable squirrel astronaut, friendly expression, gray-white suit, gold helmet hardware, chest acorn insignia, warm rim light, ringed planet, cratered lunar foreground, and storybook-space finish. Recompose the astronaut on the right third looking inward, planet upper-left, and lunar rim lower-left. Protect the lower-center region for the production title stack and keep the bottom eight percent quiet for the build line.

The generated PNG outputs were copied into `masters/` before deterministic center-crop, 1920×1080 Lanczos sizing, conservative tonal matching to the portrait family, and progressive 4:2:0 JPEG export.
