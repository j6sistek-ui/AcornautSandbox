# First-run loading study — Acornaut (main @ 6f85ca0, 12 Sep 2026)

Read-only. No tracked file was modified. Raw data, scripts and run JSONs are in
the audit session scratch (not tracked)
(`measure.mjs`, `analyze.py`, `art_inventory.py`, `tiers.py`, `sprite_bench.mjs`, `run-*.json`, `tiers.txt`).

## Method

- Served `docs/` with `python3 -m http.server 8766` (8765 was busy with another agent's server).
- Playwright Chromium (headless, `/opt/pw-browsers`), fresh context (no storage), viewport 390x844, DPR 3, touch.
- **Throttled** = CDP `Network.emulateNetworkConditions` 4 Mbps down / 1 Mbps up / 150 ms RTT + `Emulation.setCPUThrottlingRate 4`. **Control** = no throttling.
- Recorded every request (start/end/bytes), every `new Image()` load with its natural size (patched constructor in an init script — this is how `art.ts` loads everything), `PerformanceObserver('longtask')`, a continuous rAF sampler, `Performance.getMetrics` heap, a CPU profile (`Profiler.start/stop`) over the 20 s flight window, and a walk of `window.__sandbox.art` for decoded bytes (w*h*4).
- Flow: goto → wait `.ac-splash` (title, "TAP TO START") → tap → hub `.t-launch` → dismiss the daily "NICE" toast → skip the film after 3 s → tap launch → drive the tutorial by answering `world.tut.want` (tap/swipe/continue) for 20 s → idle to 60 s.
- Runs: `control`, `throttled` (twice; identical to ±0.1 s), `warm` (throttled, launch delayed to t=126 s), `beta` (`docs/beta/index.html`, throttled).
- **Confound to keep in mind:** headless Chromium here has no GPU, so canvas raster is SwiftShader. The *renderer floor* in this harness is ~230 ms/frame at 4x CPU and ~30 ms at 1x (see the warm run). That floor does not transfer to a phone with a GPU canvas. The *loader* work (image decode, `measureSprite`, the sort, GC) is plain main-thread JS/CPU and does transfer. Every "cause" below is attributed to the loader only where the profile or the decode timeline says so.

---

## (A) What a new player experiences

### A.1 Throttled (4G, 4x CPU) — `run-throttled.json`

| t (s) | What is on screen | Requests started / done | MB so far | Decoded MB so far | Longest task so far | Frames > 33 ms / > 100 ms (cumulative) |
|---:|---|---:|---:|---:|---:|---:|
| 0.6 | dark page; `standalone.js` (281 KB) requested | 3 / 1 | 0.0 | 0 | — | 0 / 0 |
| 1.3–5.0 | dark page; **52 more modules arrive in a 12-level import waterfall** (1.91 MB total, 150 ms RTT per level) | 55 / 54 | 2.09 | 0 | — | 0 / 0 |
| 5.0 | 309 ms long task = module evaluation; `createEngine` runs; acorn "Prepping the launch pad" loader appears; `loadArt` fires **329 requests at once** | 329 / 55 | 2.1 | 0 | 309 ms | 0 / 0 |
| 10 | acorn loader still cycling (it is a barber pole, not progress) | 329 / 107 | 4.04 | 12.6 | 309 ms | 42 / 3 |
| **17.8** | **Title "TAP TO START" appears — because the 12 s cap in `standalone.ts:159-162` fires, not because the art is home.** 175 of 342 boot requests are done (51%). | 342 / 175 | 9.0 | 37.9 | 309 ms | 128 / 9 |
| 19.4–19.7 | tap → hub. `intro.webm` (2.0 MB), `menu-hub.jpg` (0.29 MB), 9 `ui/*.png` (0.78 MB), `menu.mp3` (0.35 MB) all requested while boot art is still downloading | 356 / 176 | 9.1 | 38 | 309 ms | 130 / 9 |
| 23.2 | daily-reward "NICE" toast dismissed; film skipped at 23.4 | 356 / 230 | 12.0 | 45 | 309 ms | 190 / 15 |
| **25.7** | **LAUNCH tapped: 934 ms long task** (resetRun + `buildTutorialCourse` + procedural sky render + `zone-scenes/deep-space.png` 1.78 MB requested + `flight.mp3`) | 358 / 250 | 13.4 | 48 | 934 ms | 200 / 17 |
| 27.5–33 | first flight (tutorial). Frames 267–300 ms each; every hitch window contains 3–9 boot images (`helms/*`, `pickups/*`, `acorn/arcade`) being measured on the main thread | 350 / 278 (t=30) | 14.1 | 53.9 | 934 ms | 230 / 24 |
| 33–47 | still the first flight; the idle sweep has begun (`solo/switchback-*`, `bee-*`, `buddy-*` …) while the run is live | 369 / 348 (t=40) | 17.6 | 85.4 | 934 ms | 265 / 59 |
| 47.5 | flight sample ends: **73 frames in 20 s, mean 268 ms, 73/73 > 100 ms, max 500 ms**; frames 10–20 s into the run: median 250 ms, p90 333 ms | 393 / 370 | 20 | 100 | 934 ms | 300 / 110 |
| 60 | sweep continues (pal banks); long tasks total **31.1 s of the 60** (52% of wall time on the main thread) | 443 / 424 | 27.7 | 126.5 | 934 ms | 359 / 152 |

JS heap: 10 MB at splash, 14 MB at hub, 6–17 MB in play (`Performance.getMetrics`). The decoded bitmaps live outside the JS heap; the number that matters is the decoded-MB column.

Beta (`docs/beta/index.html`, throttled): identical at boot — splash 17.81 s, hub 19.66 s, same 329 boot requests, same 4.04 MB / 12.6 MB decoded at 10 s, 891 ms launch task. No difference worth a separate table.

### A.2 Unthrottled control — `run-control.json`

| t (s) | What is on screen | Requests started / done | MB so far | Decoded MB so far | Longest task | Frames > 33 ms / > 100 ms |
|---:|---|---:|---:|---:|---:|---:|
| 2 | acorn loader; all 329 boot requests already served locally | 329 / 329 | 15.7 | 65.7 | 70 ms | 17 / 6 |
| 3.2 | title visible (art actually finished this time) | 340 / 336 | 16.2 | 68 | 116 ms | 20 / 7 |
| 4.5 | hub; sweep starts immediately (`prefetchArtBanks`, engine.ts:1832) | 470 / 465 | 27 | 129 | 116 ms | 38 / 12 |
| 9.6 | LAUNCH: 193 ms long task | 660 / 659 | 40 | 188 | 193 ms | 66 / 25 |
| 10–29.5 | first flight while the sweep loads pal banks. **472 frames / 20 s, mean 42 ms, 429 > 33 ms, 25 > 100 ms, max 150 ms.** Every 100–150 ms hitch coincides with one pal bank landing (13–36 images decoded in the same window: `ufo`, `voidjelly`, `wisp`, `magnetar`, `babyalien`, `satellite`, `astrafox`, `spacepuppy`). Frames 10–20 s into the run: median 33 ms, p90 50 ms | 959 / 959 (t=20) | 60.1 | 293.8 | 193 ms | 282 / 37 |
| 37 | **sweep settles: 1,352 requests, 78.4 MB, 396.8 MB decoded** (registry walk: 1,278 images, 390.5 MB) | 1352 / 1352 | 78.4 | 396.8 | 193 ms | 761 / 52 |
| 60 | idle in tutorial | 1352 / 1352 | 78.4 | 396.8 | 193 ms | 1284 / 53 |

For scale: SHIPPING.md §4 says the sweep settles at **220 requests / 13.5 MB**. It now settles at **1,352 requests / 78.4 MB / 397 MB decoded** — 6x the requests, 29x the decoded pixels. The document was measured at stamp 222; the catalog has grown to 20 pal banks (526 frames) and 33 lazy suit banks (460 files) since.

### A.3 Warm run (throttled, launch at t=126 s) — `run-warm.json`

Even at 126 s the sweep had **not finished on 4G** (929 requests, 59 MB, 282 MB decoded at t=150; the full sweep is ~1,300 requests / ~71 MB). The flight window still ran at 235 ms mean, but the CPU profile changed completely:

| Self time, 20 s flight window | Cold (throttled) | Warm (throttled) |
|---|---:|---:|
| `measureSprite` (art.js:57) | 12.6 % (2,724 ms) | 0.9 % |
| sort comparator `(a,b)=>a-b` (art.js:122) | 6.4 % (1,384 ms) | 0.4 % |
| `getImageData` | 5.9 % (1,281 ms) | 0.3 % |
| `drawImage` (includes decode-on-first-draw and the measure canvas) | 25.5 % | 28.1 % |
| `(program)` native (decode, raster, GC) | 41.5 % | 63.9 % |
| `updateWorld` (the whole sim, 1,200 steps) | 0.1 % (21 ms) | 0.2 % |
| `drawWorld` + `drawHud` + `drawPilot` | < 0.3 % | < 0.3 % |
| sky-gen procedural sky (one-time at zone entry) | 2.8 % | 2.7 % |

So **~25–30 % of the cold first-run main thread is sprite measurement** (JS that ships as-is to any device), the sim and the draw code are negligible, and the remainder is raster — which in this GPU-less harness is inflated and on a phone is the GPU's problem, not the CPU's.

### A.4 Per-sprite main-thread cost of `measureSprite` (`sprite_bench.mjs`, real files)

| File | Size | Solid px | 1x CPU total | 4x CPU total | of which sort+hypot @4x |
|---|---|---:|---:|---:|---:|
| `suits/flight-tap-1.png` | 256² | 13,964 | 16.5 ms | 82 ms | 34 ms |
| `solo/buddy-1.png` | 256² | 21,327 | 13.2 ms | 16 ms | 12 ms |
| `helms/clear.png` | 256² | 38,484 | 10.2 ms | 39 ms | 28 ms |
| `planets/1.png` | 256² | 18,285 | 7.9 ms | 29 ms | 17 ms |
| `suits/vanguard/frame-1.png` | 512² | 67,476 | 32 ms | 138 ms | 91 ms |
| `suits/arcflash/parts.png` | 1024x768 | 289,595 | 136 ms | **583 ms** | 496 ms |
| `suits/porcelain/flight.png` | 1024² | 243,433 | 121 ms | **483 ms** | 368 ms |

(The 1024 atlases are not `asSprite`d by `loadSuitBank`, but `suits/vanguard/maneuver-parts.png` 1024x768 *is* — art.ts:539 — and it is in the fresh-save boot tier.) Boot runs this ~315 times; the sweep ~986 more times, each on arrival, each synchronously on the main thread, each allocating a `w*h` canvas, a `w*h*4` `ImageData`, a `solid` array of up to 2·N numbers and a `dists` array that is then `.sort()`ed with a JS comparator.

---

## (B) Causes, ranked

1. **The fresh-save boot tier is 315 requests / 17.7 MB / 112 MB decoded, and the title is gated on all of it (or a 12 s timeout).**
   `art.ts:637-716 loadArt` fires everything in one `Promise.all`: 8 squirrel, 17 acorn, 16 golden, 4 shield, 6 planets, **27 legacy debris**, `sky.jpg`, **20 pal stills, 34 suit stills, 30 helmet stills** (all for the hangar shelf), 35 pickup files, **41 vortex frames**, **14 hyper-run files** (Hyper Run is star-gated for a fresh save, standalone.ts:1749), 18 spill-ship files, then `flight`'s 26-file bank and — because `TUTORIAL_SUIT = "vanguard"` (catalog.ts:116) and engine.ts:1825 passes it to `loadArt` — **vanguard's 16x 512² frames + a 1024x768 atlas = 3.15 MB / 19.9 MB decoded**. `standalone.ts:156-162` awaits `engine.artReady` with a 12 s cap. At 4 Mbps 17.7 MB is ≥ 35 s of transfer, so on 4G the cap always fires: title at 17.8 s with 51 % of the boot art still in flight, which then decodes *during the first run* (A.1, t=27–33). Full breakdown in `tiers.txt`; what a fresh save actually needs is in (C).

2. **The idle sweep runs concurrently with the first flight and is 986 files / 53 MB / 288 MB decoded, in 36-wide bursts.**
   `engine.ts:1832` calls `prefetchArtBanks` the moment the boot bank resolves; `art.ts:621-635` walks all 20 pal banks then 32 suit banks with a 300 ms breather *between banks* but `many()` (art.ts:225) fetches every frame of a bank in one `Promise.all`, so a 36-frame pal bank lands as 36 back-to-back `asSprite` calls. Nothing checks `world.screen`. Control run: 13 hitches of 117–150 ms in the first 20 s of flight, each window containing 13–36 decodes of one pal bank. Throttled: the sweep is still running at 150 s.

3. **Every sprite is measured on the main thread with a per-pixel JS loop, a `Math.hypot` per solid pixel and a comparator sort** (`art.ts:151-214 measureSprite`, called by `asSprite` for all ~1,300 sprites). Cost table in A.4; profile share 25–30 % of the cold flight window (A.3). This is the one cost that is identical on the web and in the packaged app. The result (`box`, `core`, `coreX/Y`) is a pure function of the PNG and could be exported once.

4. **Decode work is unbounded in width and never deferred.** `loadImg` (art.ts:116) uses `new Image()` + `onload`; there is no `createImageBitmap`, no `img.decode()`, no worker, no concurrency cap. 329 requests are opened at t=5 s (the throttled run shows 222 still queued at t=10).

5. **The JS module graph is a 12-level dynamic-import waterfall: 53 files, 1.91 MB, 0.57 s → 5.02 s at 150 ms RTT** (`docs/index.html:2325` → `standalone.js` → 20 → 2 → 1 → 4 → 5 → 2 → 4 → 1 → 8 → 4 → 1). No `<link rel="modulepreload">`, no bundling. Production also pulls `beta-campaign-manifest.js` (221 KB) because `campaign.ts:1` imports it unconditionally. Module evaluation is one 275–309 ms task at 4x. On the packaged app this collapses to ~0.3 s (local files), so it is web-only.

6. **The first-run resolution probe measures the loading storm and bakes the answer in for the session.** `engine.ts:1294-1307 noteFrameCost` takes the median of the first 90 play frames; if > 20 ms it drops the render cap from DPR 3 to 2.5 "ONCE and stay there". On every run measured here the first 90 frames were all > 33 ms because of (1)–(3), so the probe always trips on a fresh install and never re-tests — a permanent 30 % pixel cut decided by a transient.

7. **Launch itself is a 0.9 s task on a throttled phone** (engine.ts `fly` → `resetRun` → `buildTutorialCourse`, `sky-gen` procedural sky render ≈ 2.8 % of the window, `zonePainting` 1.78 MB `zone-scenes/deep-space.png` request, `flight.mp3`). Control: 193 ms. Not the headline, but it is the first thing the player feels after tapping LAUNCH.

8. **File formats and sizes.** 30 PNGs with no alpha at all total 31.4 MB: 8 `zone-scenes/*.png` 2172x724 (16 MB, ~4k colours — photographic), `spill-scene/depot.png` + `panorama.png` (4.6 MB), 9 shop banners 1024x512 (9.7 MB). As JPEG/WebP these are 5–10x smaller (transfer only; decoded size is unchanged). 1,203 mostly-transparent 256² frames (alpha_zero ≥ 60 %) total 61 MB file / 370 MB decoded — lossy WebP would roughly halve the transfer. Pickups are drawn at 26–34 CSS px (78–102 device px; draw.ts:2711-2723) from 256² sources — 2.5–3.3x linear oversize, 6–11x pixels. The pilot is drawn at 52 CSS px (156 device px; draw.ts:5282) from 256² — fine. `sky.jpg` 1008x1792 (7.2 MB decoded) and the 24 `skies/*.jpg` 900x1600 (5.8 MB each) are sized for the screen — fine.

9. **Not causes (checked):** the sim is cheap (`updateWorld` 21 ms per 1,200 steps at 4x); per-frame allocations are five `filter`s (sim.ts:3929-4306); `createRadialGradient` per frame only under fog/vortex/pilot-glow (draw.ts:2754, 3237, 5236); `shadowBlur` is confined to race/spill/tunnel and the `opalfeather` particle (draw.ts:3373-3461); `measureText` only in Spill HUD and `drawHudBody:5895`; no `new Image` in draw/sim; `Object.keys` never in the loop; halos are baked once (art.ts:295-330, 48-entry LRU). **No spiral of death:** `engine.ts:1713` caps `frameDt` at 0.25 s → at most 15 fixed steps per frame; at 0.018 ms per step that is 0.3 ms, so a 300 ms hitch costs one 0.3 ms catch-up and the loop cannot stall itself. What the cap *does* do at sustained > 250 ms frames is run the sim slower than wall time (~7 % dilation in the throttled run), which reads as "laggy", but the hitches come from (1)–(3), not from the step.

10. **Music is not a boot cost:** `<audio preload="none">` elements streamed (audio.ts:120-122); `menu.mp3` 347 KB at splash, `flight.mp3` 405 KB at launch; `cosmos.m4a` 4.86 MB only when a retro stretch begins. The intro film costs 2.0 MB (`intro.webm`) or 1.6 MB (`intro.mp4`) once per open; `intro-wide.mp4` 14.5 MB is only chosen when `innerWidth > innerHeight` (standalone.ts:1298-1299), so phones never fetch it.

---

## (C) Fixes, ranked by impact / effort

### Quick wins (about a day in total)

| # | Fix | Where | Effort | Expected effect |
|---|---|---|---:|---|
| C1 | **Pause the sweep while `world.screen === "play"`** (and for ~2 s after launch), resume on menu; cap `many()` to 4 in-flight decodes per bank instead of `Promise.all` of 36 | `art.ts:621-635`, `art.ts:225-240`, hook in `engine.ts loop` | 3 h | Removes all 13 flight hitches in the control run (117–150 ms each, one per pal bank) and the 24–152 frames > 100 ms in the throttled runs that fall after t=33 s. Sweep total unchanged, just moved off the run. |
| C2 | **Trim the fresh-save boot tier to what the tutorial + hub draw.** Move to hangar-open: 32 suit stills, 29 helmet stills, 20 pal stills. Move to sweep/mode-open: 41 vortex, 33 pickup animation frames, 25 non-zone-0 legacy debris, 14 hyper-run (star-gated), 18 spill-ship (load on picking Debris Field, like `loadSpillScene`), and `flight`'s 26-file bank until the tutorial is done (the tutorial wears vanguard). | `art.ts:637-716 loadArt`, `engine.ts:1825` | 4 h | **315 → 77 requests, 17.7 → 6.3 MB, 112 → 47 MB decoded before the title.** At 4 Mbps that is ~13 s of transfer instead of ≥ 35 s — the 12 s cap stops firing on 4G once C4 lands as well; the first flight no longer has boot art decoding under it (the t=27–33 hitches in A.1). |
| C3 | **Export sprite metrics offline; delete runtime `measureSprite`.** Have `verify-art.py`/the exporters write `docs/art/sprite-metrics.json` `{path: {box, core, coreX, coreY}}`; `asSprite` reads it and falls back to measuring only for an unlisted file. | `art.ts:151-222`, `illustrated-src/verify-art.py` | 5 h | Removes 25–30 % of cold first-run main-thread time (A.3) and ~30 s of long tasks per 60 s throttled (A.1 last row); per sprite 15–80 ms (256²) and 480–580 ms (1024 atlases) at 4x → 0. Also removes ~1,300 transient canvases + `ImageData` allocations (GC share 1.2 %). |
| C4 | **Fix the module waterfall:** either bundle `standalone.js` (esbuild, one file, keep `js<VER>/` layout) or emit `<link rel="modulepreload">` for all 53 modules in `index.html`; drop `beta-campaign-manifest` from the production graph (`campaign.ts:1`). | `docs/index.html:2312-2328`, export script, `campaign.ts:1` | 2 h | 12 RTT levels → 1: code ready at ~1.5 s instead of 5.0 s at 150 ms RTT (-3.5 s to the loader screen on 4G, -221 KB). Web-only; the packaged app is unaffected. |
| C5 | **Make the loader honest and short:** show `loaded/total` (count `Image` loads against the boot list) instead of the 130 ms barber pole; with C2 the 12 s cap can drop to ~6 s. | `standalone.ts:113-162` | 1 h | No byte change; the player sees a bar that ends. |
| C6 | **Move the resolution probe** so it starts only when no image has loaded for 2 s (or after the sweep is paused per C1), and let it re-arm once. | `engine.ts:1294-1307` | 1 h | Stops a transient deciding DPR 2.5 for the session on every fresh install. |
| C7 | Defer the `ui/*.png` (9 files, 0.78 MB) and `menu-hub.jpg` with `loading="lazy"`/after first paint; keep the film `<video>` created only on tap (it is today). | `standalone.ts:1378, 1396, 1309` | 1 h | ~1 MB off the hub paint on 4G. |

Expected combined effect of C1–C6 on the throttled first minute: title at ~8–9 s instead of 17.8 s (code 1.5 s + 6.3 MB ≈ 13 s of transfer overlapped with decode, cap at 6 s as a backstop), first flight with 0 boot decodes and 0 sweep decodes under it, long-task total in the first 60 s from 31 s to an estimated ~4 s (module eval + launch + the zone's 7 files + one sky), and the decode share of the flight profile from ~28 % to ~2 %.

### Structural (about a week)

| # | Fix | Effort | Expected effect |
|---|---|---:|---|
| S1 | **Pack banks into sheets** the way the premium suits already are (`suits/<id>/flight.png` 4x4 of 256²): a 36-frame pal bank → one 1536x1536 PNG/WebP; suit asc/desc/tap banks likewise. Add the frame index to the exporters (`art-src/*`), and slice in `frameOf`/`drawSprite` with a source rect. | 3 d | Requests: sweep 986 → ~55, boot 77 → ~20. One decode per bank instead of 16–36; the sort/measure work goes with C3. Decoded bytes unchanged. |
| S2 | **Convert no-alpha PNGs to JPEG/WebP** (8 zone scenes, 2 spill scenes, 9 shop banners: 31.4 MB → ~4 MB) and the 1,203 transparent 256² frames to lossy WebP with alpha (61 MB → ~20–25 MB, verify masters). `spill-ship/utilities` already ships WebP, so the loader path exists. | 2 d | Web transfer only: whole-art 157 → ~70 MB; the first zone scene 1.78 → ~0.25 MB. Decoded memory unchanged (it is w*h*4 regardless of format). |
| S3 | **Ship pickups (acorn, golden, frozen, shield: 65 frames) at 128²** — they are drawn at ≤ 102 device px. | 1 d | -13 MB decoded, -75 % of those decodes' time. |
| S4 | **Evict.** `suitBankLoads`/`palBankLoads` (art.ts:486, 590) hold every bank for the page lifetime; only `haloCache` (48) and `zone-visuals` (6) evict. Add an LRU that releases banks of un-equipped pals/suits when leaving the hangar (drop the `Sprite[]`, delete the Map entry so a re-equip refetches from HTTP/bundle cache). | 2 d | Resident decoded images ≤ 150 MB instead of 400 MB (see D). |
| S5 | **Decode off the main thread**: `createImageBitmap(blob)` from a worker `fetch`, or at least `img.decode()` before `asSprite`, with a 4-wide queue. | 2 d | Turns the remaining decode cost into background work; on the packaged app this is the difference between "loading" and "hitching". |

---

## (D) Proposed load budget for the packaged app

Measured now (control run, sweep settled): **397 MB decoded resident**, 1,278 images, nothing evicted. Whole `docs/art` if everything is ever touched: **867 MB decoded** (1,608 images; `tiers.txt` "WHOLE docs/art"). Plus the 1170x2532 canvas backing stores (11.8 MB each, 2–3 of them), ≤ 48 halo canvases (~17 MB), JS heap 10–80 MB. Resident ≈ 450–500 MB after the sweep. Against WKWebView's ~1–1.5 GB jetsam ceiling this fits on a 4 GB phone, but WebKit's decoded-image cache purges under pressure and re-decodes on the next `drawImage` — on the main thread — so on 2–3 GB devices the sweep converts memory pressure back into hitches. Nothing in the game ever releases a bank. The packaged app removes the network (module waterfall → ~0.3 s, boot fetch instant, the 12 s cap never fires) but keeps every decode and every `measureSprite`; the control run is the closest proxy: ~315 decodes before the title (3.2 s at 1x; expect ~6–10 s on a mid-range phone), then 986 sweep decodes concurrent with the first flight (13 hitches > 100 ms in 20 s at 1x).

| Tier | Budget | Today (fresh save) |
|---|---:|---:|
| Boot (before title): decoded | ≤ 50 MB, ≤ 80 files | 112 MB, 315 files |
| Sweep: decoded, total | ≤ 150 MB, never while `screen === "play"`, ≤ 4 decodes in flight, one bank ≤ 10 MB decoded | 288 MB, 986 files, runs during play, 36-wide bursts |
| Per-run on-demand (zone planets+debris 1.8 MB + sky 5.8 MB + zone scene 6.3 MB) | ≤ 15 MB decoded per zone, ≤ 8 files, requested ≥ 1 zone ahead (already done, engine.ts:1766-1769) | 14 MB — fine |
| Resident decoded images at any time | ≤ 300 MB (with S4 eviction) | 397 MB and growing with every catalog addition |
| Main thread during the first 20 s of a run | ≤ 3 long tasks > 100 ms, 0 image loads not belonging to the current/next zone | 25 hitches > 100 ms (control), 73/73 (throttled) |

**The test that enforces it** — `illustrated-src/test-load-budget.mjs`, picked up by `run-tests.mjs` (it `readdirSync`s `test-*.mjs`, run-tests.mjs:75) and by `npm run gates`:

1. Static half (no browser, seconds): export the tier lists from `art.ts` (`BOOT_FILES(save)`, `SWEEP_FILES`, `zoneFiles(env)`) or reproduce them as `tiers.py` does; for each file read the PNG IHDR / JPEG SOF for width and height (no PIL needed in node: 8 bytes at offset 16 for PNG), sum `bytes` and `w*h*4`, and assert the table above. Fail with the offending list, the same way `verify-art.py` fails on a card with no art.
2. Behavioural half (Playwright, ~40 s, `--skip-heavy` exempt): boot `docs/index.html` with a fresh context and CPU 4x, patch `Image` as `measure.mjs` does, tap through to LAUNCH, and assert (a) no `Image` load event between launch and launch+20 s whose URL is outside `zoneFiles(envA|envB|next)`, (b) `longtask` entries > 100 ms in that window ≤ 3, (c) `__sandbox.art` registry decoded bytes ≤ 300 MB after the sweep settles.

---

## (E) Decisions for the owner

1. **Boot tier contents.** C2 changes *when* the hangar shelf stills, vortex frames, pickup animations and Debris Field ship parts load, not whether. The hangar would show its 82 stills arriving over the first second after it opens on 4G; on the app it is instant. Accept that, or keep stills at boot and accept a ~4 MB / 23 MB-decoded boot floor.
2. **Runtime measurement vs exported metrics (C3).** Exporting `sprite-metrics.json` moves a runtime behaviour into the art pipeline (`verify-art.py` / `export-*.mjs`). Any hand-dropped PNG that skips the pipeline would draw with a full-image box until measured. Is that acceptable, or should the runtime keep the measure path as a fallback (recommended)?
3. **Formats.** Converting the 30 no-alpha PNGs to JPEG/WebP (S2) is pure win on the web (-27 MB); converting 1,200 transparent frames to lossy WebP touches the painted masters' fidelity and needs an eyeball pass. Decoded memory does not change either way — only sheets (S1), downscaling (S3) and eviction (S4) change it.
4. **Sheets (S1)** are a pipeline change in `art-src` exporters; the premium-suit exporter already does this shape. It is the only fix that brings the request count under ~100.
5. **The intro film.** `intro.webm`/`intro.mp4` (2.0 / 1.6 MB) plays once per open right after the tap, on top of the still-downloading boot art on 4G. Keep it, but it could be skipped automatically when the boot art is still < 100 %. `intro-wide.mp4` (14.5 MB) never reaches phones; it could be dropped from the app bundle to save 14.5 MB of install size.
6. **Memory ceiling for the app.** Pick a target (proposed 300 MB resident decoded) — this decides whether S4 eviction is required before store submission or can follow.
7. **SHIPPING.md §4** should be re-measured after any of the above: its "220 requests / 13.5 MB" is off by 6x and is what the tiers were designed against.

---

## Appendix — key numbers referenced above

- Boot tier, fresh save (from `tiers.txt`): squirrel 8 / 0.49 MB / 2.1 MB dec; acorn 17 / 0.38 / 4.5; golden 16 / 0.39 / 4.2; shield 4 / 0.27 / 1.0; planets 6 / 0.56 / 1.6; legacy debris 27 / 2.05 / 7.1; sky.jpg 1 / 0.47 / 7.2; pal stills 20 / 1.28 / 5.2; suit stills 34 / 1.75 / 9.7; helm stills 30 / 2.01 / 7.9; pickups 35 / 0.72 / 8.9; vortex 41 / 1.96 / 10.7; hyper-run 14 / 0.89 / 6.8; spill-ship 18 / 0.32 / 4.7; flight bank 26 / 0.92 / 6.8; vanguard bank 17 / 3.15 / 19.9; splash jpg 1 / 0.15 / 3.7. **Total 315 / 17.74 MB / 112.0 MB decoded.**
- Sweep: 20 pal banks 526 files / 26.3 MB / 137.9 MB decoded (largest: clockling, nutsack, tinbot, voidjelly, magnetar, babyalien, satellite, astrafox, spacepuppy at 36 frames / 9.4 MB decoded each); 32 suit banks 460 files / 27.0 MB / 149.7 MB decoded (largest: eclipse 46 files / 12.1 MB dec, volt 34 / 8.9, flight 26 / 6.8, cyber 20 / 5.2). **Total 986 / 53.4 MB / 287.6 MB decoded.**
- Zones: 26 zones x 7–8 files, 0.56–0.82 MB, 1.8–2.1 MB decoded each; all 185 files 17.9 MB / 48.5 MB decoded. Skies: 38 files 8.1 MB / 239 MB decoded (never all resident: `skyCache` is unbounded but only visited skies load).
- Largest single images by decoded bytes: `spill-scene/depot-bear.jpg` 1536x1384 (8.5 MB), the three 1920x1080 `-wide.jpg` menus (8.3 MB each, desktop only), `menu-hub.jpg` / `sky.jpg` 1008x1792 (7.2 MB), 15 `skies/dark*-wide.jpg` 1792x1008 (7.2 MB each, desktop only), `spill-scene/vanguard-depot.png` 1280² (6.6 MB), `spill-scene/depot.png` 1536x1024 (6.3 MB), eight `zone-scenes/*.png` 2172x724 (6.3 MB each).
- Dimension histogram: 1,497 of 1,608 images are 256²; 24 are 900x1600 (skies); 21 are 512² (vanguard frames + 5 others).
- `docs/js286`: 53 modules, 1.92 MB; largest `draw.js` 284 KB, `standalone.js` 281 KB, `beta-campaign-manifest.js` 221 KB, `sim.js` 184 KB, `campaign-manifest.js` 168 KB.
