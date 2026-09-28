# Logic audit, 12 Sep 2026 (main `6f85ca0`)

Read-only. Every line number is as of `6f85ca0`. Paths are under `illustrated-src/game/` unless stated. `node_modules` is partial; only `test-shop-cycle.mjs` was run (PASS).

## Summary

| | Blocker | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| Part 1 · CODE_AUDIT open findings still open | 0 | 0 | 3 | 50 | **53** (5 partially addressed) |
| Part 1 · no longer apply | | | | | 2 (F57, F76) |
| Part 1 · fixed outright | | | | | 0 |
| Part 2 · new findings | 0 | 1 | 8 | 25 | **34** |

Severities in Part 1 are the original verifiers'; Part 2 are mine (player impact).

---

## Part 1 — the 55 open CODE_AUDIT findings today

### STILL OPEN (53)

**standalone.ts**
- F45 medium · `docs/index.html:207` base `.ac-lvlcard` still has no `overflow-y`; only `.ac-racecard` (:208) scrolls.
- F50 medium · no `streakPackDay`; `dailyState()` engine.ts:1071-1090 still re-derives `pack` from the flipped flag.
- F39 low · `docs/index.html:148` blanket `body.ac-nomotion * { animation:none }` still swallows `acHoldFill` (:843).
- F77 low · standalone.ts:403 pause button is still `"II"`, no aria-label; `.ac-iconbtn` 40px (index.html:953).
- F78 low · standalone.ts:1415/1423 counters still labelled "Shop" / "Buy Star Dust".
- F80 low · standalone.ts:1564, 1697 still `Saved at Depot ${wave}` with no `welcome` check.
- F41 low · softened (443d613) to "Clear the debris field after level 33" (:1762) and "DEBRIS FIELD AFTER LEVEL" (:3462) — still the Spill's name.
- F42 low · standalone.ts:2413/2478/2567 star still appended inside the card `<button>`; `.ac-favbtn` 22px (index.html:1356).
- F82 low · standalone.ts:2416 `helmListed` excludes `suitOnly`, yet :2413 puts a star on the own-helmet card.
- F83 low · `.ac-nohelm` top:6/right:6 (index.html:705) under `.ac-favbtn` top:4/right:5.
- F84 low · standalone.ts:2690-2691 `behavior:"smooth"` unconditional.
- F85 low · standalone.ts:2928 pips are bare `★` with class only.
- F86 low · standalone.ts:3678 `Math.floor(Date.now()/86400000)` (UTC) vs engine.ts:1046 local `today()`.
- F87 low · PARTIAL: stage now picks a compatible suit (e0a6a9b, :3956-3959); shop-cycle.ts:45 `helmPool` still deals `suitOnly` ids.
- F88 low · `cartOf` standalone.ts:3700 prunes only `!owns`; nothing prunes `picked` to today's shelf.
- F89 low · standalone.ts:4058 trailing `render()` after `tx(...buyDust)` still wipes the "unavailable" line.
- F91 low · `editingName` (:3655) only reset at :4514/4520; never on leaving Profile.
- F92 low · `.ac-idname` index.html:293 has no overflow rule.

**sim.ts**
- F31 low · resizeWorld tunnel branch :690-736 never remaps `w.wormHold.planets/pickups`.
- F68 low · resetRun :1746-1915 never zeroes `w.time`.
- F32 low · `w.palFx` computed at :1765 before `w.tut` is set at :1907; `palIds` :884 only substitutes "buddy" in three stages.
- F33/F34 low · initTunnel :2256-2304 clears `w.planets` only; `enterWormhole` :2389 aliases `pickups: w.pickups`.
- F69/F71 low · `exitWormhole` :2444 has no `flown` flag; `die()` :3677 calls it → `hold.score + 1` and `zoneJump += 1` on a crash.
- F70 low · updateTunnel :2627/2635 `return die(...)` with no shield check; shields carried in (:2418) never fire.
- F35 low · `w.prismHue` not in resetRun (only :625 makeWorld, :3379 bounce).
- F11/F36 low · PARTIAL: XP half gone with the ladder (86ccb5c); `save.runs += 1` :3731 on every `die()`, `reviveRun` :3848 sets no flag → a continue still counts a second flight.
- F72 low · pausePlay :3877 `|| w.tut` refuses the whole tutorial.
- F73 low · Deep timer :4177-4180 ticks before `frozen` return :4200.

**draw.ts**
- F21 low · paintSpillHead :1862-1882 no `wearsOwnHead` guard, `DOME["suit:flight"]` fallback :1876.
- F59 low · :2520 `drawSpillHint(... H - (padsOn?156:96))`, no `insetTop`.
- F60 low · drawFinishPortal :3223-3226 mirrors only; no rotate for a flipped world.
- G7 low · rewritten by 88bb204 (:5579) — now excludes `ECLIPSE_FLIGHT_SUITS` and 16-frame banks; the special-case remains.
- F61 low · preview :5632 passes heading `2` for every suit; flight :5286 passes `ECLIPSE_FLIGHT_SUITS.has(id) ? 2 : 0`.
- F62 low · drawSwirl :6018 called inside drawHud after `ctx.translate(0, insetTop)` :5773.

**engine.ts**
- F63 low · spillResume :672 restores `signal`, never `restored.hints = !save.helpOff`.
- F64 low · dailyState :1082 `pack = bonusDay && !save.streakPackClaimed`, ignores owned Critter Pack.
- F25 low · keydown :1500-1503 only exempts INPUT/TEXTAREA; :1520 title → `engine.fly("fly")` and `preventDefault` still cancel a focused button.

**others**
- F55 low · build-roadmap.mjs:20 still "Production activation remains held for review".
- F17 low · build-roadmap.mjs:35 still hard-codes "nine … 4/5/6/…/20-wave … Ore/no-hit".
- F56 low · beta-campaign-manifest.ts:5 row 1-2 third goal still `{"kind":"acorns","n":1}`.
- F5 low · standalone.ts:3396 still renders `durationTarget`.
- F58 low · catalog.ts:678 Circuit Pack still "All three come with custom helmets".
- F67 low · save.ts:891 `ownsPremium` answers the suit gate first; standalone.ts:2389 helm card reads it (see Part 2 b-2).
- F30 low · save.ts:882 `add(s.boostedRewards)` bare id; :919 `.includes(r.id)`.
- G24 low · verify-art.py:339 `beta_only_art = set(loaded_suits) - loaded_suits_live` (suits only).
- G23 low · verify-art.py:967-983 table list still lacks `suitIds/helmIds/palIds`.
- F74 low · spill-workshop.ts:315, 325 `feedback("… fitted")` before `engine.spillUtility` returns.
- F94 low · PARTIAL: road-rules.py:48 fly now returns `stage*10, None` — goals kept, gates still rewritten for halved/capped rows.
- G19 low · test-beta-campaign.mjs:52, 68, 97 `if(tapDef)/if(stickyDef)/if(oreDef)` skips remain.
- F97 low · shell/configure.mjs:82 no `UIStatusBarStyle`.

### NO LONGER APPLIES (2)
- F57 · NEWS removed in a78dc82 (standalone.ts:4639 "NEWS IS GONE").
- F76 · hold-to-rise retired in 79b8639; `held/pressed` no longer exist in spill.ts.

---

## Part 2 — new findings

### a. Run end / scoring / currency

**Copies of "run end" (5):**
1. `die()` sim.ts:3662-3745 — endless fly/deep/lost/arcade/tunnel/spill: acorns, runs, lifetimeAcorns, per-mode best, board, startShield; engine writes on the `"die"` event (engine.ts:1601).
2. `settleLevel` mission branch sim.ts:3628-3660 — credit, acorns, runs, lifetimeAcorns, inline `writeSave`.
3. `settleLevel` race branch sim.ts:3577-3627 — raceRecords, gate, board; **no acorns, runs or lifetimeAcorns**.
4. `dispatchSpillCues` engine.ts:1611-1625 — `bankSpill` + board + `writeSave`, on top of (1) for the same frame.
5. `finishTutorial`/`skipTutorial` engine.ts:463-495 — banks nothing.

| # | Sev | Finding |
|---|---|---|
| a-1 | medium | **Hyper Run banks nothing.** sim.ts:3627 returns before the acorn block. Input: finish a race with 40 acorns → `save.acorns`, `lifetimeAcorns`, `runs` unchanged; the mode row shows a best-acorns record the wallet never saw. Fix: fall through to the shared bank block (or `finishRun()`, proposal 1). |
| a-2 | low | Spill death posts the board twice: sim.ts:3741 (`!w.lvl && !w.tut && score>0` → `"spill"`) and engine.ts:1621 same tick. Fix: drop the engine post. |
| a-3 | low | Two run counters for one death: `save.runs` (sim.ts:3731) and `spillRecords.runs` (save.ts:337); `spillBest` written at sim.ts:3737 and save.ts:331. Fix: bankSpill owns spill, die() skips spill. |
| a-4 | low | Tutorial acorns vanish: `w.runAcorns` climbs in the buddy stage (sim.ts:4370), HUD shows it, `finishTutorial` engine.ts:481 never banks it. Fix: bank in finish/skip or hide the counter. |
| a-5 | low | Zone visits are recorded every tick (sim.ts:4247) but only persisted by the next unrelated `writeSave`; a run left via pause → HOME (engine.open → settleDust only writes when owed) loses them until something else saves. Fix: write on `open()` when `zonesSeen` grew. |

### b. Unlock / ownership gates

| # | Sev | Finding |
|---|---|---|
| b-1 | **high** | **A Star Unlock on a shared-id helmet hands over the suit and then pays twice.** save.ts:876-880: IAP ids land in `purchased` via `idGrants`; `suitRevealed` (:750) and `helmetRevealed` (:705) both read `purchased`. Input: 500-dust Star Unlock on "Samurai Helmet" (240★) → Sammie Suit (250★) owned too; `settleStarRewards` :919-925 then pays 250 acorns at 240 AND 250. Same for Opal/Gemmie at 780. Fix: for wardrobe kinds always land in the kind list (`unlocked`/`unlockedSuits`) and key `boostedRewards` by `${kind}:${id}` (F30). |
| b-2 | medium | Same item, three answers (F67 widened). Sammie helmet at 240-249★: Star Chart `rewardOwned` → `helmetRevealed` → "yours" (save.ts:801); Loadout helm card standalone.ts:2389 `ownsPremium` → `suitRevealed` → "PREMIUM", tap refused at :2410; Shop `bundleQuote` credit (standalone.ts:3683 → save.ts:891) → 0 for a helmet the road gave. Fix: `ownsPremium(s, id, kind)` or helm cards ask `helmetRevealed`. |
| b-3 | low | Hyper Run gate answered in two places: modes sheet standalone.ts:1747 `raceGates.includes(33)`; engine.flyLevel engine.ts:398 also admits `reachedGate` → the chart launches what the sheet locks. Fix: `hyperRunOpen(save)` in save.ts. |
| b-4 | low | `bundleQuote` under-credits a suit owned without its set trail. catalog.ts:903-905 prices the trail at 90 when its suit is owned, :924 retail counts it 0. Input: `purchased=["cryostar"]` (pre-idGrants save) → Aurora credit 270 not 360, due 450 not 360. Fix: in `alaCarteTotal` treat a trail as free when its suit is owned *or* owed. |
| b-5 | low | `rewardDue` standalone.ts:3243 is constant 0 (every reward item costs 0) so the ", revealed for N acorns" label at :3064 can never print. Fix: delete. |
| b-6 | low | Shop-cycle can deal the Leviathan *helmet* card (shop-cycle.ts:45 no `suitOnly` filter; rank 0 still deals when pools are thin) priced `idDust("leviathan")` = 360 (suit weight included, catalog.ts:867-872). Fix: exclude `suitOnly` from `helmPool`. |

### c. Save layer

**Fields written outside save.ts** (grep `save\.\w+\s*=`): sim.ts:3578 raceRecords, :3604 raceGates, :3641-3644/3729-3742 acorns·runs·lifetimeAcorns·startShield·bests, :3702 guide, :3853 acorns, :4094 tutorialDone; campaign-progress.ts:98 campaignProgress, :148 stars, :179-181 raceGates + unlocked lists; spill-workshop.ts:122 spillDepotGuideSeen; engine.ts (58 `writeSave` sites). standalone.ts writes none.

| # | Sev | Finding |
|---|---|---|
| c-1 | medium | **`campaignProgress` is never sanitized.** loadSave passes it to `migrateCampaign` (save.ts:625) which dereferences `p.missions[..]`, `p.barriers.includes`, `p.paidRewards.includes`, `p.zoneVisits` (campaign-progress.ts:42, 51, 55, 161). Input: `{campaignProgress:{version:1}}` → TypeError inside `loadSave` → `createEngine` rejects, black boot; `readRaw`'s object check does not reach it. Fix: shape-check the four members, else `delete s.campaignProgress` (migration rebuilds from `stars`). |
| c-2 | medium | **The beta pitch dial flies on production.** `suitPitchFor` save.ts:959 has no `IS_BETA` guard (unlike :968/:978/:988); draw.ts:5278/5281 and engine.ts:1789 apply it. Reachable: a production page with no v1 save seeds from `LEGACY_KEYS` "acornaut_beta" (catalog.ts:94-96). Fix: `IS_BETA ? save?.suitPitch?.[id] : undefined`. |
| c-3 | low | Screen writes the save: spill-workshop.ts:122 `save.spillDepotGuideSeen = true; writeSave(save)`. Fix: `engine.markSpillBriefingSeen()`. |
| c-4 | low | Untyped fields: `purchased`/`unlocked`/`unlockedTrails`/`unlockedPals` are spread at save.ts:363-366 and `.includes`-tested (a string → substring ownership, then `[...str]` spreads characters on the next buy at engine.ts:1215); `raceRecords` entries unchecked (:559) → `formatRaceTicks(NaN)`; `dailyStreak` sign (:453); the `*Off` switches (:161-172) accept any truthy. Fix: one `strList()`/`nonNegInt()` pass. |
| c-5 | low | Start Over on the beta un-erases itself: `eraseSave` save.ts:658 resets `betaSampleCreditImported`, so the next load (:628-639) re-imports `acornaut_star_map_sample_v1` stars/unlocks/purchased and re-grants dust (contradicts :583 "a tester who spends it stays spent"). Fix: erase keeps the two flags or clears the sample slot. |
| c-6 | low | `xp` is write-only: derived at save.ts:566-573, read nowhere since 86ccb5c. Fix: delete. |
| c-7 | low | `resetTestLab` engine.ts:706 deletes `suitPitch` but never re-applies `setVanguardPitchTrim` → live AcorNut keeps the dialled trim until reload. |
| c-8 | low | save.ts:531 `s.spillSignal = s.spillSignal === true` is overwritten at :533. |

### d. Per-suit dials / fixed 60 Hz step / tap accent

| # | Sev | Finding |
|---|---|---|
| d-1 | medium | **Ordinary flight is not paused on blur/hidden.** engine.ts:1585-1600 pause only race/spill; on return the loop (:1713) clamps `frameDt` to 0.25 s and replays 15 unattended ticks (gravity 1300 px/s²) → a pilot that was mid-gap can be dead before the first frame paints. Fix: `engine.pause()` for every live run on blur (APP_STORE §5 "Pause"). |
| d-2 | low | Constant branches on production: `PAINTED_TAP_SUITS` is empty (control-constants.ts:13) so `repeatTapMode`'s `tapRewind` branch (sim.ts:26), `repeatTapQueues` and `w.tapAnimQueued` (:3213, :4160) can never fire; `TAIL_SPRING = {}` (:78) makes `tailSpringFor` constant; Test Lab's REPEAT TAP toggle (`setTapRewind`) is inert on both pages. |
| d-3 | low | Beta dials reach missions and Hyper Run: pause sheet standalone.ts:453 gates on `IS_BETA && !tutSuit` only; `tapShapeFor`/`tailSpringFor` read the dial in any mode → a star-certified beta mission flies the dial. Fix: refuse when `w.lvl || w.race`. |
| d-4 | low | Four dead dt caps under the fixed step: `Math.min(dt,.25)` vanguard.ts:147, vanguard-maneuver.ts:110, arcflash-motion.ts:120; `.1` high-orbit-motion.ts:76. Only engine.ts:1713 matters. |
| d-5 | low | `resetTestLab` cannot restore stock pitch on the live rig (c-7). |

### e. Shop

| # | Sev | Finding |
|---|---|---|
| e-1 | medium | **"Featured" is not a price.** `engine.buyBundle` (engine.ts:1204) and `buyFeature` (:1244) both charge `bundleQuote.due`; `bundlePrice`/`featurePrice` (catalog.ts:731, 938) are the same wrapper; the UI calls only `buyFeature` (standalone.ts:4239) and accepts any bundle id on any day. `cy.feature` only decides which singles are `held`. Fix: delete `buyBundle`/`bundlePrice`; rename. |
| e-2 | low | Cart checkout standalone.ts:3865-3874 buys cheapest-first and stops at the first refusal; with a `picked` id that today's feature now holds (F88) the pilot pays single price for an item the kit would have credited. No double spend. |
| e-3 | low | F86 + F88 + F89 as listed in Part 1 (UTC day, cart survives, web dust row). |
| e-4 | low | Refusal coverage is complete for every engine result (`DENY_TEXT` standalone.ts:2172-2200 covers poor/locked/suitOnly/fixedHead/missing/unknown/owned/armed/unavailable/clash + boosts). No spend-twice path found: every buy is check → subtract → grant → write in one synchronous block; `takeReceipt` gates every store id; the beta grant has no receipt by design. |

### f. Dead / constant / duplicated

Verified zero callers (member access and tests counted):
- `HYPER_RUN_ENABLED = true` (catalog.ts:68) → constant branches engine.ts:395, art.ts:789.
- catalog.ts `BUILD_TIME`:73 (stamped by export-sandbox.mjs:87, read by nobody; `DEV_STAMP` took its job), `MIN_SEP`:541; high-orbit.ts `HIGH_ORBIT_ANATOMY`:14 (only the generated `tools/flight-studio` copy).
- catalog.ts `shopBundles/SHOP_SLOTS/SHOP_DAY_MS/keyOf` :802-833 — superseded by shop-cycle.ts; only test-shop.mjs:71-73 calls them.
- engine `buyBundle` + catalog `bundlePrice` — tests only (e-1).
- campaign.ts `LEGACY_LEVELS`:355 and the whole `campaign-manifest.ts` (265 lines) — test-star-map.mjs:24 only.
- draw.ts `FROZEN_SUITS`:4437 — imported unused (tsc TS6133), test-frozen-roster only.
- engine.ts `toggleMod("battery")` :1012-1019 — no UI caller; would sell a 500-acorn no-op (battery is a star rung, sim.ts:4444).
- `save.xp` (c-6), `save.tapAccent` (retired, still defaulted/sanitized save.ts:212/464), `engine.setTapAccent` duplicates `setGlowOff` (engine.ts:643-654).
- Unused imports (tsc): `IS_BETA` art.ts:2 / draw.ts:17, `skyIdFor` sim.ts:40, nine in standalone.ts:5-27, local `previewShip` :2235.
- `s.spillSignal` dead line (c-8); `rewardDue` constant 0 (b-5).

Duplicated helpers: `clamp` ×5 (arcflash-motion.ts:40, arcflash.ts:9, high-orbit-motion.ts:33, premium-flight.ts:9, race.ts:300); mulberry32 ×3 (mission-rng.ts:6, spill.ts:486, sky-gen.ts:55); xorshift hash race.ts:342 = draw.ts:471; day length `86400000` engine.ts:1056, standalone.ts:3678, catalog.ts:803; `1/60` in 12 places beside `RACE_DT` (race.ts:12); pilot start `H * 0.45` ×17 (sim 13, spill 3, draw 1); dt caps (d-4).

### g. Tests

Product rules with **no test** (grep across `test-*.mjs`): acorn continue run-count (`reviveRun` only appears as a refusal check), `claimDaily`/streak/Critter-Pack week (`streakPack` only as a shop exclusion), `settleStarRewards` shared-id/boostedRewards substitute, wormhole-detour *crash* credit (test-wormhole-trip.mjs:137-163 measures flown trips only), shop day source (no test names `shopDayIndex`/`Date.now`), `eraseSave`/Start Over, `loadSave` with a malformed `campaignProgress`, `resetTestLab`, blur/pause, `submitScore` routing, `lifetimeAcorns`/`runs` tallies, `recordZoneVisit`, `engine.ts` daily/receipt paths beyond test-receipts.

Pins rather than rules (assert a table against a literal copy): test-tap-shape.mjs:37-42 (TAP_SHAPE keys = list in the test; `TAIL_SPRING` deepEqual `{}`), :144 (TAP_ACCENT_STRENGTH), test-frozen-roster.mjs:100 (`FROZEN_SUITS.length === 6`, no production reader), test-bundle-kits.mjs:39-40 / test-premium-pilots.mjs:264 (`BETA_DUST_GRANT_FLOOR === 12360`), test-shop.mjs:71-73 (exercises dead `shopBundles`). None asserts a constant against itself.

---

## Cohesion proposals (≤5)

1. **`finishRun(w, save, outcome)` in sim.ts** — one bank block (acorns, runs, lifetimeAcorns, bests via a `BESTS: Record<FlightMode, keyof SaveData>` table, board, startShield, `writeSave`) called by die(), both settleLevel branches, the spill cue path and finishTutorial; engine drops its `"die"` write and `dispatchSpillCues` bank. Files: sim.ts, engine.ts, save.ts. ~150 lines net, 1 day. Closes a-1…a-4, F36's tail.
2. **Ownership by kind** — `owns(s, kind, id)` in save.ts replacing `ownsPremium`/`suitRevealed`/`helmetRevealed`/`palUnlocked`/`trailUnlocked` at the Loadout, Shop credit and Star Chart; `boostedRewards` keyed `kind:id`; Star Unlock lands in the kind list. Files: save.ts, standalone.ts, engine.ts, catalog.ts (credit callback). ~120 lines, 1 day. Closes b-1, b-2, F30, F67.
3. **One shop checkout and one day** — delete `buyBundle`, `bundlePrice`, `shopBundles`, `SHOP_SLOTS`, `SHOP_DAY_MS`, `keyOf`; `shopDayIndex` reads the engine's local `dayNumber(today())`; `picked` pruned to the cycle on render. Files: catalog.ts, engine.ts, standalone.ts, shop-cycle.ts, test-shop.mjs. ~−120 lines, half day. Closes e-1, F86, F88.
4. **One dial reader** — `dialFor(save, table, id)` in save.ts carrying the `IS_BETA` guard for tapShape, tailSpring, tapAccentStrength, tapRepeat *and* suitPitch, refusing when `w.lvl || w.race`; delete the four dead dt caps. Files: save.ts, sim.ts, draw.ts, engine.ts, vanguard*.ts, arcflash-motion.ts. ~40 lines, 2 hours. Closes c-2, d-3, d-4, c-7.
5. **Declarative sanitizer + util.ts** — a `{field: kind}` table (`strList`, `bool`, `nonNegInt`, `record`) in loadSave with a `campaignProgress` shape check; drop `xp`, `tapAccent`, the dead `spillSignal` line; one `util.ts` for `clamp`, `mulberry32`, the xorshift hash, `DAY_MS`. Files: save.ts, campaign-progress.ts, +util.ts, 8 importers. ~100 lines, half day. Closes c-1, c-4, c-6, c-8 and the duplicate-helper list.
