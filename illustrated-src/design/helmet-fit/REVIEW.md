# Helmet alignment — 7 September 2026

The production suits' helmets often sat above the muzzle, clipped the ears, or rotated away from the collar during flight. This change refits 276 helmet sockets across all 16 production suits that accept interchangeable helmets. Each socket belongs to a specific unchanged painting; its position, radius and angle follow that painting's head and collar.

The branch is based on main `1fdbd10ef2a4044c6034bf1c7850c6f51ca326a8`, including the latest hangar/shop changes, beta Arcflash access and Briella's Cat. The cache stamp is 207; the displayed game version remains V1.0.10.

## What changed

- Flight's glass moves down over the muzzle and gains room around the head, addressing the supplied screenshot.
- The remaining wearable suits receive individual static and animated fits: Ion, Copper, Frost, Void, Ember, Robo, Ghost, Big Booty, Gemmie, Sammie, Seraph, Leviathan, Verdant, Cryostar and Eclipse.
- Local helmet angles follow the head/collar rather than assuming the head rotates with the whole body. Leviathan's climb/dive direction and Eclipse's deep-dive placement receive particular attention.
- Helmet radius stays constant within each suit's motion bank except four existing larger-head paintings: Sammie ascent 1 and Gemmie ascents 1–3. Those exceptions are tied to the exact source artwork hashes.
- A tap-bank loading fallback now measures the helmet against the same reference image as the body.
- The rig editor now includes Flight's bare-headed motion frames and displays Clear on animation frames. Only the original eight baked-dome squirrel paintings skip that overlay.

No suit or helmet images, limb cuts, frame sequences, rig algorithms, timing, flight controls, trails or physics are changed. AcorNut/Vanguard, Arcflash and all other suits with their own heads retain their existing rendering paths. `HELM_GLASS` and its helmet-specific geometry are unchanged.

## Review artifacts

- [Animated comparison](helmet-fit-preview.mp4): the actual shipping loadout renderer, before and after, with identical animation times and inputs. Four suits per page cover all 16; Clear is used except for Leviathan's matching helmet.
- [Close-up comparison](helmet-fit-comparison.png): selected problem suits at an enlarged loadout scale.
- The per-page PNGs accompany the video for still inspection.

The footage was rendered from helmet build 206 against main `81fb7e7`. Build 207 incorporates the concurrent shop-only main update; its helmet geometry and animation are identical to that footage. The final regression report compares build 207 directly with main `1fdbd10`.

The visual fitting pass also checked Lunar and relevant costume helmets. The footage uses native Canvas, not a recording from a physical phone. The original drawings have some head-size and pose discontinuities; this work adjusts their helmet sockets without editing those animations.

## Validation

`test-helmet-animation.mjs` compares the actual production renderer with the immutable main revision above. It hides only the equipped helmet composite for the body comparison and checks the real animation and simulation outputs:

- 7,800 paired renders, including 1,848 pixel-exact body comparisons.
- All 424 ascent/descent pose and display-size cases, plus 64 tap-only loading states.
- 1,536 loadout frames and 5,760 gameplay frames, including 240 accepted taps at 100, 180 and 300 ms intervals and dive inputs.
- Identical animation bank definitions and 341 unchanged source images.

The exporter, lab build, helmet compatibility check and all 30 art-QA groups pass. Art continuity measurements now use frozen regions from the approved `14103b3` artwork review, so moving a helmet cannot change an unrelated tail or painted-head measurement. Reviewed static helmet scales retain the existing 5% typo guard.

To reproduce, first build with `node illustrated-src/export-sandbox.mjs`, then run:

```sh
node illustrated-src/test-helmet-animation.mjs
node illustrated-src/test-helmet-compatibility.mjs
python3 illustrated-src/verify-art.py
node illustrated-src/review-helmet-fit.mjs
```

`ACORNAUT_TSC` may point to TypeScript's `tsc.js`; the two Canvas scripts accept `ACORNAUT_CANVAS` pointing to `@napi-rs/canvas`. The review script also requires ffmpeg and ffprobe.
