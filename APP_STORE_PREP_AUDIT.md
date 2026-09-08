# App Store prep audit

Repo audit at `956a92f` (main, 7 Sep 2026), read-only; §3 also notes the one commit that landed on main while it ran. Four passes: waste
(assets and files), code and gameplay logic, UI and layout, store readiness.
Every claim carries a `file:line`; a claim that was not confirmed by
running something says so. Per-character variation (a suit with its own
motion, a pal with its own bank) is deliberate and is not counted here;
the same *concern* solved three different ways is.

Gate state on this commit: `tsc` clean, `test-platform-bridge` clean
(39 files), `verify-art.py` PASS (30 groups, needs pillow+numpy+scipy),
`test-tunnel` **fails**, `test-drift` and `test-suit-lean` fail on their
own calibration guards.

**Status since.** Ship blockers 1, 3, 4, 5 landed in #226 (stamp 227).
Blocker 2's ledger and blocker 6's insets landed in #225 (stamp 228).
Blocker 2's failure path (a store that throws, cancelled and failed
outcomes shown in the shop, a test for the ledger) is stamp 229. The
section 3 deletes (dead pages, the 100 unreferenced art files, the orphan
React file; review scripts moved to `illustrated-src/archive/`) followed.
Open: blocker 7 (the shell needs store accounts; see `shell/README.md`),
section 2 onward, section 4. Left for a human look: `zone-spawn-planner.html`,
`hyper-run-contact-sheet.png`, `chart-bg.jpg` and `sky-wide.jpg` (read by
`site-src/prep-assets.py`). DEBRIS WEAVE stays at one hazard by decision.

---

## 1. Ship blockers

Do these before wrapping a store build. None is more than a day.

| # | Where | What | Fix |
|---|---|---|---|
| 1 | `game/engine.ts:291-308`, row appended at `game/standalone.ts:3687`, UI `:4348-4372` | Two plaintext access codes ship in the bundle (`docs/js/engine.js:139,150`). One pushes every `IAP_ITEMS` id into `save.purchased`; the other sets `allStars`, which opens every star-gated suit, helmet, pal, trail, mode and mod. The "HAVE AN ACCESS CODE?" row renders on the production storefront, ungated. Apple 3.1.1 forbids unlocking content by code. | Gate `codeRow()` and `redeemAccessCode` on `platform.devDoors`; on native return `"denied"` before comparing. |
| 2 | `game/platform.ts:32-39`, `game/engine.ts:905-917` | `store.buy(id)` resolves a bare `"ok"`. No transaction id reaches the game, so a purchase completed after the app was suspended (Ask to Buy, network blip) is never granted, and a shell that re-delivers an unfinished transaction grants twice. `restore()` returns `void` and cannot hand anything back. | Add `store.onTransaction(productId, txId)` (or make `buy` resolve `{result, txId}`), keep `save.grantedTx: string[]`, grant once per id. Add `.catch` to `buyDust` (`engine.ts:908` has none: a rejected promise is unhandled and the shop shows nothing). |
| 3 | `game/catalog.ts:887-891`, `game/standalone.ts:3677` | USD sticker prices (`$0.99` … `$19.99`) are hard-coded and shown whenever `platform.priceOf` returns null, including before StoreKit answers. | On native, hide the row or show a placeholder until a store price arrives; never fall through to the string. |
| 4 | `illustrated-src/test-tunnel.mjs:23` | Gate test fails: `round-trip pattern start half-width: got 150, expected 172.5`. SHIPPING.md requires the harness green. | Decide whether `TUNNEL_PATTERNS` (`sim.ts:153`) or the test is right; fix one. |
| 5 | `docs/index.html:419-427` and `:452-473` | Two selector-less CSS fragments (leftovers of the deleted Wormhole calibration panel). Under CSS syntax rules the first becomes the prelude of the next rule, which is `.ac-pausesheet { overflow-y:auto; justify-content:safe center; padding-bottom:… }` at `:435`, so that rule is discarded. The pause sheet is back to `overflow:hidden` and clips RESUME off both ends on short screens, the exact bug the comment above it describes. Verified with a spec-conformant parser. | Delete both fragments. |
| 6 | `docs/index.html` (top inset used once, `:61`); `draw.ts:5464,5559,2444,5381` | `viewport-fit=cover` is set but only the crash sheet pads for `safe-area-inset-top`. The hub rail, every menu header, the pause button, the pause and level-done sheets, and the canvas HUD (score y=46, acorns y=28, Spill HEALTH y=15, race timer y=40) sit under the status bar / Dynamic Island in a full-screen WKWebView. | `padding-top: max(12px, env(safe-area-inset-top))` on `.ac-hub .ac-menuhead .ac-playbar .ac-sheet`; expose the inset to the engine via a `:root` custom property and offset HUD `y` in `drawHud` / `drawSpillHud`. |
| 7 | repo root | No `capacitor.config.*`, `ios/`, or StoreKit product list exists yet, so the SHIPPING.md §5 release checklist cannot be executed. Product ids to register: `dust-100`, `dust-550`, `dust-1200`, `dust-2600`. | Add the shell; exclude `docs/lab`, `docs/js220-222`, `docs/v1*`, `docs/beta`, `docs/CNAME` from `webDir`. |

## 2. Should fix before submission

**Store review surface**

- Dev "cycle inspector" (`drawCycleRoll`, `standalone.ts:3824-3870`, doc-comment says "Preproduction only") renders "OFF THE SHELF TODAY" on the production shop at `:3696-3701`. Gate on `platform.devDoors`.
- External links reach around the bridge: `standalone.ts:4553` (Discord), `:4565` (X), `:4581` (mailto), all `target="_blank"`. In a WKWebView these either do nothing or navigate the game away with no back. Add `platform.openExternal(url)`; `test-platform-bridge.mjs` has no rule for `https://` so add one. The copy "and the occasional crash" (`:4571`) should go.
- `IS_BETA` is a bare `window.__ACORNAUT_BETA__` read (`catalog.ts:18-20`). Nothing prevents a native build from being beta (beta save slot, 10 000-acorn floor, free dust packs at `engine.ts:912`). Derive it in `platform.ts` as `kind === "web" && flag`.
- Stale copy: `NEWS[0]` says "a hundred levels" (`catalog.ts:129`) while production loads 260 (`STAR_MAP_LIVE = true`, `catalog.ts:33`); `<meta description>` says "Illustrated Acornaut rewrite" (`docs/index.html:7`).
- `docs/fonts/` has no OFL licence files beside the Figtree and Fraunces woff2. OFL requires the licence to travel with the font.
- `docs/lab/{rig,ship,skytest}/index.html:11` each load Google Fonts over the network. The doors are hidden when `devDoors` is false, but the pages exist in the served tree. Exclude from the app bundle.

**Audio and lifecycle**

- `audio.ts` has no `visibilitychange` / `pagehide` handler and never suspends the `AudioContext`; `engine.ts:1321-1340` auto-pauses only Race and Spill on blur, so a normal flight keeps running with a 0.25 s dt cap. After a phone-call interruption the context sits in `"interrupted"` until the next SFX. Suspend on hidden, resume and `playWanted()` on visible, and pause every live run on blur.

**Boards**

- `platform.ts:20` declares a `"hyper"` board that is never submitted. Hyper Run, Spill and mission results never reach `platform.submitScore`; only endless runs post (`sim.ts:3611`). Submit `bestFinishTicks` on a new best or drop the id.

**Save**

- `save.ts:226-238`: a raw value that parses to a non-object (`"abc"`, `5`, an array) is truthy and gets spread into defaults. Guard with `typeof parsed === "object" && !Array.isArray(parsed)`. `unlocked*` / `purchased` are not checked to be arrays (`:239-246`); a string passes `.includes` then `push` throws at `:453`. No top-level save `version`; only `campaignProgress.version`. Cosmetic today, but a future migration has nothing to key on.

**Docs that lie**

- README row 31 lists `beta/` and a root `index.html` that no longer exist. PARITY.md header says "v1.2.0-illust, art v51, 17 suits, 20 helmets, 12 pals" against `V1.0.12`, `ART_VER 223`, 31 suits, 30 helmets, 20 pals. OPEN_ISSUES.md (called "the live list") describes `suits/phoenix.png` and two demoted suits that are no longer in the tree. Both `ANIMATION_*_SPEC.md` describe finished rollouts with flags that are now constants.

## 3. Waste: assets and files

Numbers are MiB on disk.

| Area | Size | Finding |
|---|---:|---|
| `docs/art` unreferenced | 4.47 (102 files) | See list below. Every other file (1 457) is reached by a reconstructed loader pattern; nothing expected is missing. |
| `docs/v11` … `v14` | 0.02 | Dead pages importing `js11` … `js14`, folders that no longer exist, plus a Google Fonts link. 404 on load. |
| `docs/js220` … `js222` | 4.9 | Kept on purpose by `export-sandbox.mjs:87-104` (`RETAIN = 4`) for stale cached pages. Keep on the web, exclude from the app. |
| `illustrated-src/zone-spawn-planner.html` | 9.35 | One-commit snapshot tool stamped with an old `ART_VER`. Only `ZONE_PLANNER.md` mentions it. |
| `illustrated-src/hyper-run-contact-sheet.png` | 1.13 | One commit; only `HYPER_RUN.md` mentions it. |
| `illustrated-src/review-*.mjs` (19 files) | 0.23 | One-off evidence writers from past PRs. `review-hyper-run-r3-runtime.mjs:129-133` loads an Amethyst *suit* that never existed; `review-helmet-glass-repair.mjs` and `review-helmet-openings.mjs` import `docs/js/draw-before.js`, `draw-old.js`, `helmet-openings-old.js`, none present. |
| `illustrated-src/ui/Acornaut.tsx` | 0.03 | React component importing `@/lib/auth/gates` and `lucide-react`. No `package.json`, no React, nothing imports it, not in the export's source list. |
| `illustrated-src/design/**` footage | ~35 | 9 mp4 (~20 MB) and ~15 MB of PNG/JSON review traces. `star-map-260.json`, `BETA_260.md`, `free-flight-tuning.xlsx` and the `REVIEW.md`s are referenced and stay. |
| `intro-landscape.mp4` at the repo root (PR #223, after this audit's base) | 6.4 | Raw upload, referenced by nothing. Masters live under `art-src/` (`intro-master.mov` is there); the served film is `docs/art/intro.mp4`. Move it beside `intro-master.mov`, or wire it into the landscape splash and stamp it. |
| `.git` unreachable objects | 11.3 | `git reflog expire --expire=now --all && git gc --prune=now`. No history change. |

Not waste, but worth knowing: `art-src` (316 MB) is read by the build and the gate (`export-sandbox.mjs:20-31` copies zone scenes, spill-workshop and switchback from it on every build; `verify-art.py:666,2021` reads two `registration.json`s; 23 scripts total). A build checkout cannot drop it. 17.2 MB of it is byte-identical to served files. `site-src` is live: `deploy-site.yml` publishes it to the `acornaut` repo for acornaut.io.

**Unreferenced art, by group** (all high confidence; no dynamic pattern reaches them)

| Group | Files | MiB |
|---|---:|---:|
| `suits/{abyssal,cinderforge,cosmic,groveguard,sunforged}-tap-1..16.png` (retired banks, `art.ts:379`) | 80 | 3.31 |
| same five suits `-tail.png`, `-body.png` (not in `RIGGED_SUITS`, `art.ts:357`) | 10 | 0.44 |
| `chart-bg.jpg`, `sky-wide.jpg` (read only by `site-src/prep-assets.py`) | 2 | 0.38 |
| `spill-ship/concepts/dock-{painted,pixel}.jpg` | 2 | 0.14 |
| `ui/{chest,flask,map}.png` (`hubIcon()` is only ever called with gift/trophy/settings/rocket) | 3 | 0.09 |
| `helms/paladin.png` (id exists only in an archived catalog) | 1 | 0.06 |
| `pickups/ore.png` (`art.ts:710` loads `acorn-coin.svg` for ore) | 1 | 0.04 |
| `spill-ship/README.md`, `frame.json`, `spill-scene/README.md` (docs in the served tree) | 3 | 0.01 |

Byte-identical duplicates inside `docs/art`: 35 groups, 1.82 MiB, almost all by design (`desc-1` is a copy of `asc-1` for the neutral pose; `verify_vanguard` asserts one by hash). A loader alias (`desc[0] = asc[0]`) would save ~1.4 MiB; not worth doing before the store build.

App bundle arithmetic: referenced production art ≈ 107.5 MiB, minus one intro encoding (`intro.webm` 1.9 or `intro.mp4` 1.6; a native shell needs one) and, if portrait-locked, the three `menu-*-wide.jpg` (0.8). About 105 MiB of art plus 1.6 of JS, 0.2 fonts, 1.3 icons and shell. Under the 200 MB cellular line. The packaging step must **filter**, not delete: `verify_catalog_assets` requires the beta-only art (`briellacat`, `amethyst`, `ivoryguard`, `reactor`, 0.75 MiB) to exist in the repo.

## 4. Waste: code

Measured with a dead-export script and `tsc --noUnusedLocals --noUnusedParameters`. No `console.*`, no TODO/FIXME, no commented-out blocks over 10 lines, no listener or rAF leaks found.

- **17 exports with zero references anywhere**: `catalog.ts` `STORY_MODE_ENABLED:55`, `BUILD_TIME:60`, `MAX_LEVEL:566`; `campaign.ts` `CAMPAIGN_MAX_STARS:365`, `totalStars:583`; `cosmetics.ts` `drawPalPreviewOn:2068`, `drawHelmetOn:2090`, `helmetCenter:2101`; `race.ts` `queueRaceHeld:450`, `raceTunnelCenter:708`; `sim.ts` `setRaceHeld:1799`, `bankDeathLevels:3752`; `spill.ts` `spillSignature:1663`; `spill-depot-gag.ts` `VANGUARD_DEPOT_FRAMES:5`; `vanguard.ts` `VANGUARD_ART_PITCH:18`, `vanguardPitchTrim:88`; `save.ts` `pilotTitleOf:481`; `engine.stop()` `engine.ts:266`.
- **57 unused imports and locals** per tsc, the largest being `standalone.ts` `modIcon:1681-1754` (74 lines) and `batteryIcon:1643-1675` (33 lines).
- **Retired XP ladder still runs on every crash**: `sim.ts:3515,3567-3576,3598` compute `save.xp`; nothing reads it outside `save.ts` / `sim.ts`. `TRACK` (`catalog.ts:956-983`), `XP_STEPS`, `TITLES`, `xpCumulative`, `titleForLevel`, `pilotLevelOf`, `lastRun.fromLv/toLv` are all dead (~75 lines).
- **Feature flags that are constants**: `BETA_FEATURES = true` leaves 8 dead `!BETA_FEATURES` arms in `standalone.ts` including the whole classic chart `:2994-3058` and classic title `:1080-1167` (~150-200 lines); `HYPER_RUN_ENABLED`, `STAR_MAP_LIVE`, `TAP_ANIM_ENABLED`, `BOUNCE_ANIM_ENABLED`, `WORMHOLE_RUN_ON_SHEET = false` (`standalone.ts:184`).
- **Dead shop pages**: `drawShop` returns `drawShopBeta()` at `standalone.ts:3885`, so `:3886-4013`, `drawPackSheet:4107-4211`, `drawReveal:4019-4101`, `drawTryOn:4247-4344` and crash branch `:562-589` are unreachable but keep 65 CSS rules alive.
- **`SUIT_REVEAL` is unreachable logic**: every id in it (`catalog.ts:940-946`) returns earlier in `save.ts:519-530`.
- **Dead CSS in `docs/index.html`**: 91 classes with zero references (the whole previous Depot UI at `:1078-1120` and `:1719-1852`, lean editor `:705-729`, old Flight Log / dock / tabs) plus 57 classes referenced only from dead code. 197 rules, ~260 lines, ~25 KB, 18% of the style block. 70 selectors declared twice; the harmful ones are `.ac-pips/.ac-pip` (`:247-250` vs `:787-793`, both apply to every star glyph so stars draw over a bordered disc), `.ac-lab` (`:39` vs `:243`), `.ac-deny/.ac-shake` (`:806-814` superseded by `:819-828`). `star-map.css:18,24-28,44-45` are orphaned after the find box was removed.

Realistic removal: **≈700 lines of TS without cutting a mode, ≈1 500 if Wormhole Run is cut** (it is hidden from the mode sheet, has zero levels on the production road, but is still launchable from Help `:4804` and the crash sheet `:490`; `updateTunnel`, `drawTunnelWorld` and the tunnel HUD are ~800 lines).

## 5. Logic gaps and incohesion

Same concern, different implementations. The "best one" column names the version to keep.

| Concern | Today | Best one | Unify by |
|---|---|---|---|
| Run end | Three paths. Endless (`sim.ts:3534-3615`) banks, updates per-mode bests, posts the board, and relies on `engine` writing the save on the `"die"` event (`engine.ts:1352`); Spill also writes in `dispatchSpillCues` (`:1384-1387`), so it writes twice. Mission (`:3507-3532`) writes inline. Hyper Run (`:3454-3505`) neither increments `runs` nor banks acorns. Tie rule for `lastRun.best` differs per mode (`>=`, `>`, `> 0 && >=` at `:3577-3588`). `spillBest` is written in two places (`sim.ts:3607`, `save.ts:217`). | `settleLevel` | One `finishRun(w, save, outcome)` that banks, updates bests through a `BESTS: Record<FlightMode, keyof SaveData>` table, submits, writes. Drop the engine-side writes. |
| Unlock gates | Hyper Run: mode sheet requires `raceGates.includes(33)` (`standalone.ts:1527`); engine also admits `reachedGate` (`engine.ts:319-320`), so the chart can launch what the sheet shows locked. `modeOpen`/`modePrice` copy-pasted at `standalone.ts:1138-1141` and `:1482-1485`. Spill utility gates live in `engine.ts:571-583` instead of `save.ts` with every other `*Unlocked`. | `save.ts` gates | `hyperRunOpen(save)`, `spillUtilityUnlocked(save,id)` in `save.ts`; screens ask, never decide (SHIPPING.md's own rule). |
| RNG | `mission-rng.ts` mulberry32; `spill.ts:466-474` is a byte-identical copy; `race.ts:342` its own hash; `(w.missionRng ?? Math.random)()` repeated ~40× in `sim.ts`; seeded missions still call `Math.random` in `pickKind`, `pickDebris`, `shuffleEnv`, pickup bob, prism hue (`sim.ts:939-957,742,1220,3256`). | `mission-rng.ts` | `spill.ts` imports it; `sim.ts` gets `w.rand()` set once in `resetRun`; cosmetic picks go through it so "same seed, same world" is literally true. |
| Pause | `sim.pausePlay/resumePlay` (`:3756`) + `engine.pause/resume` (`:635`) + blur handlers that pause only Race and Spill. | `engine.pause` | Auto-pause every live run on blur. |
| Input | Race has a pure gesture module (`race-gesture.ts`). Fly tap/swipe and Spill hold are inline in `engine.ts:1113-1215`; Spill also has DOM buttons (`standalone.ts:240-275`); keyboard at `engine.ts:1224-1320`. | `race-gesture.ts` | Same pure "gesture state → semantic input" shape for fly and Spill. |
| HUD | `drawHud` (`draw.ts:5370`) delegates Spill to `drawSpillHud` but keeps ~80 lines of race HUD and the tunnel HUD inline. | `drawSpillHud` | Extract `drawRaceHud` / `drawTunnelHud`. |
| Pals | `hasPal` (`sim.ts:812-834`) is the single switch (good). Effects and drawing reach fly, deep, lost, arcade, tunnel. Spill and Hyper Run neither draw nor apply pals while the hub still shows the equipped pal. | as is | State it once (`palsFlyIn(mode)`) and show it on the mode row. |
| Bit counting | `campaign.ts:579` `countBits`; re-implemented inline at `save.ts:307`; `sim.ts:11` imports it unused. | `countBits` | Import it. |
| Paid ledger | `save.dustPaidTo` and `campaignProgress.paidRewards` both consulted (`engine.ts:843-856`). | `paidRewards` | `dustPaidTo` becomes write-only for old builds. |

Catalog, campaign and save agree: every `STAR_REWARDS` id exists, every bundle item exists, no id is both IAP and star-gated, max reward 720 ≤ 780 stars, every suit / helmet / pal / trail is reachable (three helmets are `suitOnly` by design). Leftovers: `robo` / `volt` are in both `IAP_ITEMS` and `SUIT_REVEAL`; `STAGES[].unlock` and the stage rows of `STAR_REWARDS` are dead data on the 260 road; `starTitle` tops out at 300 on a 780-star chart; `levelUnlocked` ignores its `_total` argument (`campaign.ts:645-655`).

Test health: 39 `test-*.mjs`, 26 run here in ~20 s. 18 pass, 3 fail (§1 item 4 plus two calibration guards), 5 need `happy-dom` / `@napi-rs/canvas` which no `package.json` declares. All tests import `docs/js/*.js`, so they test the last build, not the source. No direct test for `engine.ts`, `save.ts`'s sanitizer, `audio.ts`, `art.ts`, `cosmetics.ts`, `retro.ts`.

## 6. UI and layout

**Consistency**

- Four modal idioms: bottom sheet over scrim (`.ac-lvlsheet`, `docs/index.html:263`), centred card (`.ac-depotcard`, `spill-workshop.css:2`), floating card with no scrim (`.ac-spillprep`, `:1115`), full-bleed panel (`.ac-sheet`, `:59`). `role="dialog"`, Escape and focus return exist only on the depot and the reward preview (`standalone.ts:2918-2944`).
- Primary buttons come in five materials, three radii and four type sizes (`.ac-primary:374`, `.ac-workshop-launch` spill-workshop.css:80, `.ac-combobuy:1526`, `.ac-modeback:1283`, `.ac-idnameok:603`). "Buy" specifically is styled four ways and puts the price glyph in three positions.
- "Selected" is a violet ring (`.ac-card.on:998`), green (`.ac-spilloption.selected:1112`), gold outline (`.ac-workshop-system.selected` spill-workshop.css:45) or blue (`.ac-shipcard.on:1449`), under three class names (`.on`, `.selected`, `.fitted`).
- Card radii in use: 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 999. Ten greys for secondary text, three golds plus five more in the spill files. Kicker tracking ranges .08em to .34em across seven definitions.
- Label casing is split by file: `standalone.ts` is UPPERCASE ("BACK", "FLY AGAIN"); `spill-workshop.ts` and the chart nav are sentence case ("Launch wave 6 →", "Save & exit").
- No screen has an X; the way out is one of nine different labels (`BACK`, `NICE`, `CLOSE`, `Back to chart`, `Main menu`, `Cancel`, `Save & exit`, a purple pill, an icon).
- Fonts requested but not shipped: Figtree 900 (33 declarations), Figtree 500 (37), Fraunces 600, `"IBM Plex Mono"`, and `system-ui` in 8 chart rules. `font-display: swap` with no preload gives a visible swap on the boot title.

**Mobile risks** beyond §1: touch targets under 44 pt at `.ac-helpdot` 34 (`:227`, the comment beside it says 44), `.ac-viewbtn` 30×26, `.ac-favbtn` 22, `.ac-casefold` 26, `.ac-idnameedit` 30, `.ac-backbtn` 40, pause 40; the pause button is the text "II" with no label (`standalone.ts:345`). OS reduced-motion is not mapped to the existing `body.ac-nomotion` switch (`engine.ts:479`), so `.ac-pulse`, the splash tap pulse and the coach arrow always animate. Manifest says `orientation: portrait` while the boot adds `ac-wide` landscape layouts; the LANDSCAPE audit's L2 (short-height menus), L4 (pause, level-done scroll) and L5 (fixed-pixel HUD) are still open.

**Proposals, ranked**

| # | Proposal | Effort | Before store? |
|---|---|---|---|
| 1 | Delete the two CSS fragments; give `drawLevelDone` the `ac-result` class (`standalone.ts:3249`) so it scrolls and pads like the crash sheet. | S | Yes |
| 2 | Top safe-area padding on hub, menu heads, play bar, sheets; HUD `y` offset from a `:root` inset variable. | M | Yes |
| 3 | Storefront: hide dust rows until a store price arrives; disable the row and show "Waiting for the App Store" while `pending`; message `cancelled` / `failed` (`DENY_TEXT` `:1894` has neither); gate the cycle inspector and code row on `devDoors`; one caption saying what Star Dust buys. | M | Yes |
| 4 | 44 pt minimum on the seven small controls; `aria-label="Pause"`. | S | Yes |
| 5 | Map `prefers-reduced-motion` to `body.ac-nomotion` at boot. | S | Yes |
| 6 | Pick one: lock portrait in Info.plist for v1 (matches the manifest), or do the short-height pass for chart, profile, help, modes and an `H`-driven HUD scale. | S or M | If landscape ships |
| 7 | One `sheet(kind)` helper returning `.ac-lvlsheet > .ac-lvlcard[role=dialog]` with focus move, Escape and backdrop close; migrate spill setup and the depot onto it. | M | Nice |
| 8 | Tokens at `:root` (`--line`, `--gold`, `--select`, `--r-card`, `--r-sheet`) and three button classes (`.ac-primary`, `.ac-buy`, `.ac-ghost`); alias the spill-workshop and combo buttons to them; standardise `.on` + `aria-pressed`; one casing rule. | M-L | Nice |
| 9 | Ship the missing font weights or change the declarations to weights that exist; preload the four woff2 and use `font-display: block` (they are local). | S | Nice, but visible at first launch |
| 10 | Run-end loop: every end sheet becomes [NEXT / TRY AGAIN] [STAR CHART] [HOME]; rename "BACK TO LOG" (`:3244`); render modes as a chip row under LAUNCH so switching is one tap. | S-M | Nice |

## 7. Suggested order

1. §1 items 1, 3, 5, 4 (one PR, about half a day): gate the code row, guard the price fallback, delete the CSS fragments, fix the tunnel test.
2. §1 items 2 and 6 (one PR each): transaction ledger in the bridge; top safe area including HUD.
3. §3 deletes (one PR, an hour): `docs/v1*`, the 102 art files, `ui/Acornaut.tsx`, the 19 review scripts (or an `archive/` move), then `verify-art.py` as proof.
4. §4 dead code and CSS (one PR, half a day): the 17 exports, 57 unused locals, XP ladder, constant flags, dead shop pages, 197 CSS rules. `tsc` with `--noUnusedLocals` as the check.
5. §5 run-end and gate unification (one PR each, a day each).
6. §6 proposals 7 to 10 as time allows.
