# Asset and file waste audit, second pass

Repo `/home/user/AcornautSandbox`, main at `6f85ca0` (12 Sep 2026), read-only. Nothing tracked was touched; `git status` is clean. Scratch evidence is under `scratchpad/audit2/assets/` (`docs-art-files.tsv`, `docs-art-md5.txt`, `art-src-md5.txt`, `art-src-refs.txt`, `design-code-refs.txt`, `root-scripts-refs.txt`, `refmap-old.txt`).

Only items that are NEW, still OPEN, or REGRESSED since `APP_STORE_PREP_AUDIT.md` (section 3) and `CODE_AUDIT_2026-09.md` are listed. Sizes are MiB unless marked B/KiB. Every "unreferenced" claim was proved by grepping the whole tree (excluding `.git`, `node_modules`, `docs/js*`) for the file's basename and stem, then reading the loader that would have formed the URL.

Working-tree totals: `docs/` 162.5, `illustrated-src/` 198 (of which `design/` 183), `art-src/` 694, `site-src/` 12, `shell/` 0.9, `tools/` 0.3, `.git` 1,147 (1.10 GiB pack, all reachable).

---

## A. Headline numbers

| Category | Files | MiB | What |
|---|---:|---:|---|
| **Safe delete** (nothing forms the URL / no reader; gate and tests unaffected) | 143 | 4.0 | 80 cut-rig asc/desc PNGs, 16 `-tail/-body` PNGs, `menu-home*.jpg`, `ui/settings.png`, 6 orphan scripts, 13 tracked `.log` receipts, 21 site-src assets, 3 served docs under `docs/art` |
| **Move** (keep, but out of the served tree / source root / tracked tree) | 15 | 10.5 | `zone-spawn-planner.html` 9.35, `hyper-run-contact-sheet.png` 1.13 (both still open), 9 `review-*.mjs` back in the source root, 2 READMEs + `frame.json` served under `docs/art` |
| **Owner decides** (provenance the build never reads) | ~1,180 | ~372 | `art-src/` masters no script reads (167 referenced by nothing at all, 183.6 counting md-only), `illustrated-src/design/` review captures (182 total; 172 read by no test or build), `.agent/CONTINUITY.md` |
| **Not waste, but flagged** | – | – | `docs/js283-285` 5.4 (kept by `RETAIN = 4`, excluded from the app); `.git` 1.10 GiB reachable pack; app payload 141.0 with ~5.7 the app never needs; 29.2 of fully-opaque PNG that could be JPG/WebP |

App payload today (what `shell/build-web.mjs` copies): **141.0 MiB** of 162.5 in `docs/` (SKIP removes 21.5: `beta`, `lab`, three old stamps, `intro-wide.mp4`, `film-backdrop-wide.jpg`).

---

## B. Findings, ranked by MiB reclaimed

### B1. `art-src/` masters no script reads — 167 MiB (183.6 with md-only), owner decides
`art-src/` grew from 313.3 to 693.9 MiB since the earlier audit's base `956a92f` (395 files added, 250 of that `zone-identity/`, which `export-zone-art.mjs:11-19` reads on every build, so it stays). The following top-level entries are read by **no** `.mjs/.py/.ts/.js/.json/.yml/.html` file anywhere (method: `grep -rl -F <stem>` over the tree, excluding the folder itself; see `art-src-refs.txt`):

| Entry | KiB | Referenced by | Note |
|---|---:|---|---|
| `art-src/suit-updates/` | 71,084 | nothing (own README only) | 280 PNG, added in #156 (31 Aug), never touched since |
| `art-src/cyber-2026-08/` | 30,300 | nothing | 74 PNG + jpg, `culled/`, `keep/` |
| `art-src/ludo-powerups/` | 22,576 | nothing by name | 219 files; only 16 of them (`wormhole-c-frames/1..16.png`, 0.46 MiB) are byte-identical to served `docs/art/vortex/worm-*.png` (md5 cross-match). The other 203 files (gif, mp4, 8bit-*.webp) are dead provenance |
| `art-src/intro-master.mov` | 14,260 | `OPEN_ISSUES.md:74` only | the film master; the served film is `docs/art/intro.mp4`/`.webm` |
| `art-src/vortex-hole-v2/` | 13,704 | nothing | 45 PNG (`enter36/`, `enter9/`) |
| `art-src/landscape-final/` | 9,124 | nothing outside itself (its own two `.py` reference `docs/art/menu-home*`) | contact sheet + captures |
| `art-src/new-suits/` | 4,640 | nothing outside itself | 16 jpg masters + `build_new_options.py` |
| 12 x `art-src/suit-*-master.png` | 16,636 | `suit-flight-master.png`, `suit-ghost-master.png` in `art-src/README.md` examples; the other 10 by nothing | masters for suits whose served PNGs were re-cut long ago |
| `art-src/menu-home-master.png` | 2,512 | nothing | master of `docs/art/menu-home.jpg`, which is itself dead (B3) |
| `art-src/hub-menu/` | 1,940 | nothing | 4 jpg masters |
| `art-src/app-icon-master.jpg` | 468 | nothing | |
| `art-src/debris-updates/`, `ui-archive/`, `wide-darks/`, `pal-anims-2026-08/`, `spill-ship-concepts/`, `tap-rollout/` | 788 | md only or nothing | `ui-archive/pre-promotion/standalone.ts` is a 2-file copy of old source |

Total referenced by nothing at all: **171,352 KiB = 167.3 MiB**; add the md-only five (`intro-master.mov`, `spill-ship-concepts`, `tap-rollout`, two suit masters) for 183.6.

Everything else in `art-src/` is read by a script (`export-*.mjs`, `verify-art.py`, `test-helmet-animation.mjs`, `test-high-orbit.mjs`, `test-zone-families.mjs`, `test-natural-flight-anatomy.py` etc.; file list in `art-src-refs.txt`). `art-src/retired/` (1.8 MiB: `volt-alt-jump`, `alien-v1`, `vortex-hole-v1`) is referenced only by markdown; no script reads it.

**Recommendation:** `art-src/README.md` says masters are kept "so a sprite can be re-cut without asking for the art again", so this is not a delete. Options in order of preference: (1) migrate `art-src/**` and `illustrated-src/design/**/*.{png,mp4,gif}` to git-lfs (the 1.10 GiB pack in B9 is these files' history); (2) move the 167 MiB of never-read entries to a separate `acornaut-masters` repo or a release asset, leaving a one-line pointer in `art-src/README.md`; (3) leave in place — it costs nothing in the app because `build-web.mjs` never looks at `art-src`. **Risk of moving:** none to the build (`export-sandbox.mjs` reads only `zone-scenes`, `spill-workshop`, `pals/switchback.png`, `zone-identity`, `premium-flight`, `premium-marketing`, `home-icons`, `visor-glass`), but a future re-cut would need the file back.

### B2. `illustrated-src/design/` — 182 MiB / 455 files, 172 MiB read by nothing — owner decides
Regressed: 44.7 MiB / 61 files at `956a92f`, 182.0 MiB / 455 files now (+394 files in 18 subfolders since 7 Sep). By type: 136.5 PNG (293), 25.1 mp4 (11), 11.6 gif (2), 4.3 json (66), 3.8 html (4).

Read by a test or build (keep, and keep tracked):
- `star-map-260.json` (0.5) — `test-star-map.mjs:18`, `build-roadmap.mjs:16`
- `shop-refresh/baseline.json` (0.64) — `test-bundle-kits.mjs:73` (pins revision `d296e6b`)
- `zone-identity-implementation/geometry-baseline.json` — `test-zone-families.mjs:43`
- `zone-identity-proposal/proposal.json` (0.42) — `art-src/zone-identity/roster.json:2`, `review-zone-identity.mjs:7`
- `BETA_260.md` — `build-roadmap.mjs:35`; `helmet-fit/REVIEW.md` — cited in `draw.ts:3515`
- `free-flight-tuning.xlsx` (24 KiB) — only in a `road-rules.py:22` docstring

**Written by tests/exporters on every run (tracked build receipts, new finding):**
- `test-high-orbit.mjs:197-199` unconditionally writes `design/high-orbit/helmet-review.png` (0.64) and `regression.json`
- `test-premium-pilots.mjs:169-171` unconditionally writes `design/premium-pilots/production-review.png` (0.87) and `regression.json`
- `export-premium-flight.mjs:96-97` (run by every `export-sandbox.mjs`) writes `design/premium-pilots/<id>-frames.png` and `<id>-frame-registration.png` (6 files, 7.9 MiB)
- `export-zone-art.mjs:59` writes `art-src/zone-identity/shipping-manifest.json` (88 KiB)
- `test-flight-studio.mjs:112` writes `design/flight-studio/model-review.png` only with `--write-review`

So every `npm run build && npm test` can dirty six to ten tracked binaries. History shows they have churned (`production-review.png` 5 commits, `premium-pilots/regression.json` 4). Recommend: write these to a gitignored `illustrated-src/design/_out/` (or `scratch/`), and keep only the hand-approved capture tracked.

Read by nothing at all, not even markdown: `design/review/` (5.1 MiB, 4 PNG, no README), `design/STAR_MAP_SPECIFICATION.html` (3.6 MiB, linked only from `STAR_MAP_SAMPLE.md`).

Largest single provenance files, all md-only: `flight-input/tap-bank-before-after.gif` 7.86, `vanguard/Vanguard-Maneuver-Gameplay.mp4` 4.99, `helmet-fit/helmet-fit-preview.mp4` 4.19, `arcflash/repair-preview.mp4` 3.81, `flight-input/high-orbit-taps.gif` 3.72, `vanguard/Vanguard-Flight-Comparison.mp4` 2.60, six `zone-identity-proposal/concept-*.png` at 2.3 each (13.8 total), five `premium-pilots/proposals/*.png` at 2.3 each, `loadout-neon/` 18.2 of browser screenshots at two sizes with a `feedback-01/` duplicate set.

**Policy recommendation:** (1) `.gitignore` the test/export outputs above; (2) git-lfs for `illustrated-src/design/**/*.{png,jpg,gif,mp4,webp}` and `art-src/**`; (3) treat `design/<topic>/README.md|REVIEW.md|VALIDATION.md` plus the JSON baselines as the tracked provenance and move the mp4/gif reels (36.7 MiB, 13 files) to a release asset or the masters repo; (4) delete `design/review/` and the 13 `.log` files (B6). Do not delete `*-frame-registration.png`/`*-frames.png` without also changing `export-premium-flight.mjs`, or the next build recreates them.

### B3. Dead files in `docs/art` — 99 files, 3.29 MiB, safe delete (ships in the app today)
The old `refmap.py` flagged 125 files; 26 of those are false positives in the current tree (checked each: 8 shop banners are formed by `export-shop-art.mjs:22` from `BUNDLES`; `suits/<id>/parts.png` by `art.ts:506`; `suits/<id>/flight.png` by `art.ts:497`; premium stills via `...PREMIUM_SUIT_IDS` in `suitIds` `art.ts:715` -> `named(suitIds,"suits")` `:764`; `ui/boost-skip.png`/`boost-star.png` by `catalog.ts:991,993`; `intro-wide.mp4` by `standalone.ts:1299`; `chart-bg.jpg` is B7). The remaining 99 are dead:

| Set | Files | Bytes | Proof |
|---|---:|---:|---|
| `suits/{abyssal,cinderforge,cosmic,groveguard,sunforged}-{asc,desc}-1..8.png` | 80 | 2,051,486 | The five are High Orbit rigs: `art.ts:504-510` loads only `suits/<id>/parts.png` and returns; none of the five is in `ASC_BANKS`/`DESC_BANKS` (`art.ts:449-470`), so `many(...-asc-)` at `:548` is never called for them. `verify-art.py` derives expectations from those tables (`:318,:974`), Flight Studio's asset list from the same tables (`build-flight-studio.mjs:34,43`; the `abyssal-asc-*` strings in `tools/flight-studio/manifest.json:3159` are head-registration rows copied from `draw.ts:3533`, not asset paths). No test names them. |
| `suits/{copper,ember,frost,gemmie,iontrim,leviathan,sammie,voidsuit}-{tail,body}.png` | 16 | 756,145 | `RIGGED_SUITS` (`art.ts:385-400`) no longer lists them and the comment says "Their historical split parts are no longer requested"; `verify-art.py:423` expects `-body/-tail` only for ids in `RIGGED_SUITS`. |
| `menu-home.jpg`, `menu-home-wide.jpg` | 2 | 450,722 | No hit in `illustrated-src/game/*.ts`, `docs/index.html`, any css/mjs/py; only mentions are `LANDSCAPE_DESKTOP_READINESS_AUDIT.md`, `art-src/landscape-final/*.py`, `art-src/ui-archive/pre-promotion/standalone.ts` (archived source) and two design baselines. `standalone.ts` forms `menu-splash(-wide).jpg` (`:1256`) and `menu-hub(-wide).jpg` (`:1396`) only. |
| `ui/settings.png` | 1 | 43,498 | `hubIcon()` (`standalone.ts:1378`) is called with gift/trophy/help/launch-holo/star-chart-holo/star-chart-rocket/modes-orbit only; no other `ui/settings` reference. |

All 99 are copied into the app by `build-web.mjs`. **Risk:** low; `verify-art.py` and the 41-test harness never name them. Run `python3 illustrated-src/verify-art.py` and `node illustrated-src/build-flight-studio.mjs` after deleting as proof.

### B4. Stamped output folders `docs/js283`, `js284`, `js285` — 5.43 MiB, keep on web, already excluded from app
`docs/index.html` and `docs/beta/index.html` both load `js286/standalone.js` with `js/standalone.js` as fallback (`ART_VER = "286"`, `catalog.ts:21`). No file anywhere references `js283`–`js285` (whole-tree grep, zero hits; `docs/lab`, `site-src`, `shell` included). They exist because `export-sandbox.mjs:87-104` keeps `RETAIN = 4` for cached copies of the unversioned page (documented 2 Sep incident). `shell/build-web.mjs:29` drops every `js<N>` except the live stamp, so the app carries `js/` + `js286/` = 3.64 MiB (the two are byte-identical copies; the app needs only the stamped one, but the page's fallback import names `./js/`, so removing it means editing the boot script — 1.82 MiB, owner call). Sizes: js283 1,901,563 B, js284 1,904,040, js285 1,904,764, js286 1,908,258, js 1,908,258.

### B5. Two one-commit snapshots in the source root — 10.5 MiB, still open, move out
- `illustrated-src/zone-spawn-planner.html` 9,804,352 B — referenced only by `ZONE_PLANNER.md` and the earlier audit. Stamped with an old `ART_VER`.
- `illustrated-src/hyper-run-contact-sheet.png` 1,190,044 B — referenced only by `HYPER_RUN.md`.
Both unchanged since the earlier audit flagged them. Move to `illustrated-src/design/<topic>/` (if provenance) or delete; neither is read by any script.

### B6. Tracked build receipts and junk — 13 files, 13 KiB, safe delete; plus gitignore gaps
- 13 tracked `*.log` files under `illustrated-src/design/{flight-input,help-arcade-acorn,loadout-neon/feedback-01}/` (13,220 B total; one is 0 B). Terminal captures of test runs; nothing reads them.
- `.gitignore` has no `*.log`, no `illustrated-src/design/**/regression.json`, no rule for the test-written PNGs (B2). Add them.
- Root `package-lock.json` is **ignored** (`.gitignore:5`) while `shell/package-lock.json` is tracked; the Dockerfile `npm install`s from `package.json` ranges, so gate runs are not pinned. Inconsistent; pick one (track it, or ignore both).
- No tracked `node_modules`, `__pycache__`, `.DS_Store` or `.pyc` (checked `git ls-files`). On disk, untracked and ignored: `illustrated-src/__pycache__/`, `node_modules/`, `package-lock.json`. `docs/art/spill-ship/concepts/` is an empty untracked directory left by the earlier move.
- `.agent/CONTINUITY.md` (18 KiB, 24 commits, an agent's running log of PR state) is tracked at the repo root. Not a build input; owner decides whether that belongs in the repo.

### B7. `site-src/assets` files no page, script or manifest references — 21 files, 591 KiB, safe delete
Method: literal and template check over `parts/page.html`, `parts/*.js`, `parts/styles.css`, `parts/manifest.webmanifest`, `build.py` (which forms `preview-<id>.webp` from the ids in `app.js` `"id": "..."` and adds `poster:'…'`/`video:'…'` names). Unreferenced:
- `h-{aurora,comet,cosmic,cryostar,eclipse,leviathan,nebula,seraph}.webp` (8) — generated by `prep-assets.py:130-133` `HELMS`, never placed on the page
- `mk-hub-wide.jpg`, `mk-hub.jpg`, `mk-loadout.jpg`, `mk-modes.jpg`, `mk-shop.jpg` (5) — only `mk-chart.jpg` is used (`page.html:78`)
- `s-{amethyst,aurorasuit,ivoryguard,reactor,stardust}.webp` (5) — beta/hidden ids; `page.html:94` lists the other 31 `s-*.webp` literally
- `discord-qr.png`, `bg-tall.jpg` (`prep-assets.py:44` itself labels it "unused ground, portrait"), `poster.jpg` (only `hero-/worlds-/squad-/crew-showcase-poster.jpg` are referenced)
Everything under `site-src/clips/` (8.3 MiB) is referenced. `deploy-site.yml` builds `site-src` with `build.py` and does not run `prep-assets.py`, so these are committed outputs; deleting them is safe for the deploy. **Open from the earlier audit:** `prep-assets.py:42-45` still reads `docs/art/chart-bg.jpg` (141,898 B, dead in the game) and `sky-wide.jpg` — `sky-wide.jpg` is now live in the game (`standalone.ts:2245`, loadout backdrop), so only `chart-bg.jpg` remains a site-only file living in the game's served tree. Move it to `site-src/assets/src/` and point `prep-assets.py` there.

### B8. `illustrated-src` root scripts — 9 `review-*.mjs` regressed into the root; 6 true orphans
Full map in `root-scripts-refs.txt`. Called by the build (`export-sandbox.mjs`): `export-home-icons`, `export-visor-glass`, `export-premium-flight`, `export-zone-art`, `export-arcflash-portrait`, `export-shop-art`; by `package.json`: `build-lab`, `build-flight-studio`, `run-tests`, `verify-art.py`, `test-platform-bridge`; by tests: `reward-ladder.mjs` (`test-star-map.mjs`), `natural_flight_anatomy.py` (imported by `verify-natural-flight.py`, `test-natural-flight-anatomy.py`). Documented standalone tools (README/ART_SPEC/MOTION_SPEC/art-src READMEs): all remaining `export-*.mjs`, `build-gold-*`, `build-roadmap`, `fit-suit`, `key-render`, `matte-render`, `two-plate-matte`, `cut-sheet`, `cut-seraph-halo`, `neck-cut`, `rig-tail`, `measure-*`, `verify-*`, `refine-flight-limbs`, `flight-reference-colour`, `arcflash-leg-volume`, `clean-raster-edges`, `build-pal-anim`, `road-rules`.

**Regressed:** the earlier audit moved 19 `review-*.mjs` into `illustrated-src/archive/`; nine new ones landed in the root on 9–11 Sep: `review-high-orbit.mjs`, `review-loadout-browser.mjs` (22 KiB), `review-premium-pilots.mjs`, `review-rig-anatomy.mjs`, `review-zone-browser.mjs`, `review-zone-identity.mjs`, `review-zone-integrity.mjs`, `review-high-orbit-input.mjs`, `review-tap-banks.mjs`. Six are cited by an `art-src/*/README.md` or `design/*/README.md` (provenance; move to `archive/` and fix the link); three are cited by nothing.

**Orphans (no reference anywhere, 6 files, ~29 KiB):** `review-high-orbit-input.mjs`, `review-premium-pilots.mjs`, `review-tap-banks.mjs`, `build-eclipse-tail-tap.py`, `build-motion-bank.py` (13 KiB), `extract-pals.py`. Safe to delete or archive.

### B9. `.git` — 1.10 GiB packed, all reachable
`git count-objects`: 15,538 packed objects, 1.10 GiB; blobs 1,126 MiB packed across 407 commits. Loose: 14.9 MiB, 137 prune-packable (a `git gc` reclaims that). The earlier audit's "11.3 MB unreachable" is no longer the story: the pack is the history of `art-src` masters, `design/` captures and 286 stamped `docs/js<N>` copies. `AGENTS.md` requires `.git` in the Docker build context (pinned-revision `git archive` tests), so every `docker build` ships 1.1 GiB of context. Options: git-lfs migration (`git lfs migrate import --include="art-src/**,illustrated-src/design/**/*.png,*.mp4,*.gif"`) or a `--filter=blob:none` partial clone in the Dockerfile. Owner decides; needs a force-push.

### B10. App payload — 141.0 MiB, of which about 5.7 MiB the app never needs
`shell/build-web.mjs` copies `docs/*` minus `beta`, `lab`, `index.html` (rewritten), non-live `js<N>`, `intro-wide.*`, `film-backdrop-wide.*`. Breakdown of what is copied: art (other) 125.6, music 5.96 (`cosmos.m4a` 4.63, three mp3 1.32; all four named in `audio.ts:91-94`), `js` + `js286` 3.64, intro film both encodings 3.48, PWA icons 1.10, `menu-*-wide.jpg` 0.79, `chart-bg.jpg` + `menu-home*.jpg` 0.57, fonts 0.18, `CNAME`/`.nojekyll`/`privacy.html`/`manifest.webmanifest` 0.01, `docs/art` READMEs/json 0.01.

Never needed in a native build, in size order: the 99 dead art files (B3, 3.29); one of `intro.webm` (1.90) / `intro.mp4` (1.58) — `standalone.ts:1299-1301` lists webm first and mp4 second and "the browser takes the first source it can decode", so exactly one is dead weight per platform (which one depends on the WebView's VP9 support; verify on device); `menu-{splash,hub}-wide.jpg` + `menu-home-wide.jpg` 0.79 — `build-web.mjs:31` says "the app is portrait-only" yet filters only the wide film and its plate, while `standalone.ts:93` adds `ac-wide` unconditionally and `:1256/:1396` still request the wide plates in landscape, so either extend the filter or lock portrait in the shell; `chart-bg.jpg` 0.14 (site-only); `icon.svg` 0.38 + four PNG icons 0.72 (PWA; a native app uses its asset catalog — harmless but unused); `CNAME`, `.nojekyll`, `privacy.html` (web-only; the earlier audit's blocker 7 asked for `CNAME` to be excluded and it is not); `spill-ship/README.md`, `spill-scene/README.md`, `spill-ship/frame.json`, `spill-ship/manifest.json` + `hull-2-blue.png` (48 KiB; both lab-only: `lab/ship.ts:50` reads `manifest.json`, the game reads `transforms.json` only). `docs/lab` (1.81 MiB) and the old stamps are already excluded — that part of blocker 7 is done.

Not waste but worth a decision before packaging: 29.2 MiB of served PNG is fully opaque (no alpha pixel below 255): `zone-scenes/*.png` 15.30 (8 files, copied verbatim from `art-src/zone-scenes` by `export-sandbox.mjs:34`), `shop/*.png` 9.59 (10), `spill-scene/*.png` 4.35 of 5.78. Re-encoding as JPG q85 or lossy WebP typically cuts these by 70–85% (roughly 20 MiB off the app) with no code change beyond the extension in `zone-visuals.ts` / `export-shop-art.mjs` / `art.ts loadSpillScene`.

### B11. Byte-identical duplicates
Inside `docs/art`: 28 groups, 1.58 MiB redundant (down from 35 / 1.82 in the earlier audit). Largest: `suits/vanguard.png` = `suits/vanguard/frame-1.png` (161 KiB); twelve suits whose still, `asc-1` and `desc-1` are the same file (~40 KiB x 2 each); `volt-bounce-{6,14},{9,13},{11,12}`; `flight-tap-{1,16}`; `eclipse-tail-tap-{1,12}`; `solo/switchback.png` = `switchback-1.png`; the three critters' still = `loop-1`. All by design of the loader (`desc[0]`/still are separate URLs). A loader alias would save ~1.4 MiB; unchanged advice from the earlier audit.

`docs/art` vs `art-src`: 43 files / 16.71 MiB identical, of which `zone-scenes` 8 files 15.30 MiB (the export is a plain `cpSync`), `art-src/animation/eclipse-tail/*` 11 files, `ludo-powerups/wormhole-c-frames/*` 16 files, `spill-workshop` 5, `eclipse-motion-transfer/{cryostar,verdant}-reference.png` = the served stills, `pals/switchback.png`. Expected for a masters tree; the `zone-scenes` pair is the one place where the "master" is already the served file, so either the master or the copy step is redundant.

### B12. `docs/lab` — all seven pages have a door; two are hand-written in the output tree
`standalone.ts:1807-1814` `LAB_PAGES` lists `rig/`, `ship/`, `skytest/`, `visual-audit/`, `flightlab/`, `high-orbit/`, `premium-pilots/`; every folder under `docs/lab` matches, no dead page. `rig`, `skytest`, `ship` are built from `illustrated-src/lab/*.ts`; `high-orbit` and `premium-pilots` are copied from `illustrated-src/lab/*.html` by `build-lab.mjs`. `docs/lab/flightlab/index.html` (15 KiB + 1.78 MiB of `frames/*.webp` listed by its `frames/manifest.json`) and `docs/lab/visual-audit/index.html` have **no source under `illustrated-src/`** and were last touched in #156 (31 Aug); `docs/lab/README.md` lists three pages, not seven, and `build-lab.mjs` cannot regenerate them. Excluded from the app by `build-web.mjs`, so web-only; 1.81 MiB.

### B13. Root-level documents describing deleted code
- `PARITY.md` header still says `v1.2.0-illust`, art `v51` (catalog: `GAME_VERSION "V1.0.0"`, `ART_VER "286"`) — open since the earlier audit.
- `README.md` "What's in this repo" still has the `beta/`, root `index.html` "Original canvas copies" row; neither exists (`git ls-files` has no root `index.html` or `beta/`) — open.
- `ANIMATION_TAP_RISE_SPEC.md:37` and `ANIMATION_PLANET_BOUNCE_SPEC.md:23` describe `TAP_ANIM_ENABLED` / `BOUNCE_ANIM_ENABLED`; neither identifier exists in `illustrated-src/game/*.ts` any more (the dead-flag sweep removed them). Both specs also point to `test-bounce-impact.mjs`, `test-tunnel.mjs`, `verify-art.py`, `art-src/tap-rollout/*.py`, which do exist. Stale as handoffs; fine as history if labelled.
- `LANDSCAPE_DESKTOP_READINESS_AUDIT.md` (27 KiB, dated 21 Aug, baseline `5fbb4eb`) names `docs/lab/spill/index.html` as a test page — that folder is gone (The Spill graduated to `spill.ts`). It also drives the now-dead `menu-home*.jpg` via `art-src/landscape-final/`.
- `ROADMAP.md` (105 KiB) is generated by `build-roadmap.mjs`; last regenerated 8 Sep, same day as the last `campaign.ts` change — current.
- `Dockerfile`, `Launch Flight Studio.cmd`, `launch-flight-studio.sh` — current; all three paths they call exist.

---

## C. Still open from the earlier audits

1. `illustrated-src/zone-spawn-planner.html` 9.35 MiB and `hyper-run-contact-sheet.png` 1.13 MiB — unchanged (B5).
2. `docs/art/chart-bg.jpg` read only by `site-src/prep-assets.py` — unchanged (B7). `sky-wide.jpg` is **closed**: it is now the loadout backdrop (`standalone.ts:2245`, `docs/index.html:2058`).
3. `docs/art/spill-ship/README.md`, `spill-scene/README.md`, `spill-ship/frame.json` served under `docs/art` — unchanged, 5.6 KiB.
4. README row for `beta/` and root `index.html`; `PARITY.md` header — unchanged (B13).
5. Both `ANIMATION_*_SPEC.md` — now describe identifiers that were deleted, not merely constant (B13).
6. Blocker 7's exclusion list: `docs/lab`, old `js<N>`, `docs/beta` are excluded by `shell/build-web.mjs`; `docs/CNAME` (and `.nojekyll`, `privacy.html`) are not (B10). `docs/v1*` no longer exists.
7. `desc-1` = `asc-1` loader alias (~1.4 MiB) — not done; still not worth doing before the store build.
8. `art-src` "cannot be dropped from a build checkout" — still true and now 694 MiB (B1).

## D. What the earlier audits got wrong, or regressed since

1. **Regressed:** `art-src` 316 -> 694 MiB; `illustrated-src/design` "~35 MB footage" -> 182 MiB / 455 files. Both grew in the PRs that landed the earlier audit's own fixes (zone identity, premium pilots, loadout, shop refresh).
2. **Regressed:** the review-script move to `archive/` held for two days; nine new `review-*.mjs` are back in the source root (B8).
3. **Regressed, same class as the 102 deleted files:** 80 asc/desc PNGs for the five High Orbit rigs became dead when those suits moved to `parts.png` atlases (7 Sep), and 16 `-tail/-body` splits became dead when the natural-flight nine left `RIGGED_SUITS` (B3).
4. **New:** tests and an exporter write tracked binaries in `illustrated-src/design/` on every run (B2); 13 `.log` files are tracked (B6).
5. **Wrong then, wrong now in a different way:** ".git unreachable 11.3 MB" — the pack is 1.10 GiB and all of it is reachable (B9); `gc` recovers ~15 MiB, not the problem.
6. **Overtaken:** `sky-wide.jpg` was listed as site-only; the game now uses it (C2).
7. **Earlier "not waste" claim** "17.2 MB of art-src is byte-identical to served files" holds at 16.7 MiB, but 15.3 of it is the `zone-scenes` copy step that could go either way (B11).
8. The earlier section 3 bundle arithmetic (~105 MiB art in the app) is now 125.6 MiB of art plus 15.4 of music/film/icons/js = 141.0, under the 200 MB cellular line but 36 MiB heavier than projected, mostly `zone-scenes` (15.3), `shop` (9.6), `planets` (13.3; the catalog went from a handful of planets to 134).

---

## E. Shell commands for the safe deletes (not run; all `git rm`, review the diff before committing)

```bash
cd /home/user/AcornautSandbox

# B3: dead art the app currently ships (99 files, 3.29 MiB)
for s in abyssal cinderforge cosmic groveguard sunforged; do
  for k in asc desc; do for n in 1 2 3 4 5 6 7 8; do git rm -q "docs/art/suits/$s-$k-$n.png"; done; done
done
for s in copper ember frost gemmie iontrim leviathan sammie voidsuit; do
  git rm -q "docs/art/suits/$s-tail.png" "docs/art/suits/$s-body.png"
done
git rm -q docs/art/menu-home.jpg docs/art/menu-home-wide.jpg docs/art/ui/settings.png

# C3: docs living in the served tree (keep the text: move, don't lose)
mkdir -p art-src/spill-ship-concepts
git mv docs/art/spill-ship/README.md  art-src/spill-ship-concepts/SPILL-SHIP-README.md
git mv docs/art/spill-scene/README.md art-src/spill-ship-concepts/SPILL-SCENE-README.md
git rm -q docs/art/spill-ship/frame.json
rmdir docs/art/spill-ship/concepts 2>/dev/null   # empty, untracked

# B7: site-src outputs nothing references (21 files, 591 KiB)
cd site-src/assets
git rm -q h-aurora.webp h-comet.webp h-cosmic.webp h-cryostar.webp h-eclipse.webp h-leviathan.webp h-nebula.webp h-seraph.webp \
          mk-hub-wide.jpg mk-hub.jpg mk-loadout.jpg mk-modes.jpg mk-shop.jpg \
          s-amethyst.webp s-aurorasuit.webp s-ivoryguard.webp s-reactor.webp s-stardust.webp \
          discord-qr.png bg-tall.jpg poster.jpg
cd ../..
# then drop HELMS / bg-tall / mk-* generation from site-src/prep-assets.py so a re-run does not recreate them

# B8: orphan scripts (6 files) and the nine review scripts back to the archive
git rm -q illustrated-src/review-high-orbit-input.mjs illustrated-src/review-premium-pilots.mjs illustrated-src/review-tap-banks.mjs \
          illustrated-src/build-eclipse-tail-tap.py illustrated-src/build-motion-bank.py illustrated-src/extract-pals.py
for f in review-high-orbit review-loadout-browser review-rig-anatomy review-zone-browser review-zone-identity review-zone-integrity; do
  git mv "illustrated-src/$f.mjs" "illustrated-src/archive/$f.mjs"
done
# fix the six README links: grep -rl 'illustrated-src/review-' art-src illustrated-src/design | xargs sed -i 's#illustrated-src/review-#illustrated-src/archive/review-#g'

# B6: tracked log receipts (13 files) and the gitignore gaps
git ls-files -z | grep -z '\.log$' | xargs -0 git rm -q
printf '%s\n' '*.log' 'illustrated-src/design/high-orbit/regression.json' 'illustrated-src/design/high-orbit/helmet-review.png' \
  'illustrated-src/design/premium-pilots/regression.json' 'illustrated-src/design/premium-pilots/production-review.png' >> .gitignore
# (the export-premium-flight.mjs receipts need a code change to an ignored output dir before they can be untracked)

# B5: the two open snapshots
git rm -q illustrated-src/zone-spawn-planner.html illustrated-src/hyper-run-contact-sheet.png
# and drop their mentions in illustrated-src/ZONE_PLANNER.md and HYPER_RUN.md

# B2 unreferenced-by-anything design captures
git rm -q -r illustrated-src/design/review

# proof
python3 illustrated-src/verify-art.py && node illustrated-src/build-flight-studio.mjs && node illustrated-src/test-flight-studio.mjs \
  && node illustrated-src/test-platform-bridge.mjs && python3 site-src/build.py --mode files --out /tmp/site-check
```

Not in the script, by design: anything under `art-src/`, the mp4/gif/PNG provenance in `illustrated-src/design/`, `docs/js283-285`, `.agent/CONTINUITY.md`, `docs/CNAME`/`privacy.html`, the second intro encoding, and the wide menu plates — those are owner decisions (B1, B2, B4, B6, B10), and the packaging fix for the app payload belongs in `shell/build-web.mjs`'s filter, not in a delete.
