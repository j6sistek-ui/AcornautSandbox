# Code audit, September 2026

A multi-agent audit of the whole tree at `a47c2a4` (main, 8 Sep 2026):
24 finder lenses over `sim`, `engine`, `save`, the screens, the painter,
the catalog, the modes, the native shell and the tooling, then a second
sweep over the five lenses that had not finished. Every finding was put
to two independent verifiers — one tracing the code, one asking whether a
player can actually reach it — and only findings both passes upheld are
recorded here.

| | Raw | After dedupe | Confirmed |
|---|---:|---:|---:|
| Main sweep | 127 | 97 | **80** |
| Gap sweep | 37 | 37 | **14** |

Confirmed by severity: 2 blockers, 7 high, 27 medium, 58 low.
**38 are fixed** (PR #236, commits `2f10882`, `ef0ef67`, `8e18051` and the
one that carries this file); **56 remain open** and are listed in §3 so
none is rediscovered as a new bug.

Findings the verifiers refuted are not listed. The most common reason
they were refuted is worth writing down: several finders assumed the repo
carried an exclusion list of tests. It did not — that list lived in the
shell loops people ran by hand, which is precisely the defect in §1.

Every claim carries a `file:line` as it read at `a47c2a4`; line numbers
drift with the fixes.

---

## 1. The gate was not a gate

`SHIPPING.md` gate 3 says "every `illustrated-src/test-*.mjs`". There was
no runner and no manifest, so every contributor wrote a shell loop, and
every loop grew its own skip list — sixteen of the 41 tests need
`happy-dom` or `@napi-rs/canvas` and **nothing declared them**.

- **23 of 41** tests were actually running.
- **11 of the 18** that never ran were red.
- Seven of those reds asserted product rules; all seven traced through git
  to the commit that moved the rule, so all seven were *test-stale*, not
  live regressions. One (`test-drift`) was red on a source regex a
  behaviour-preserving refactor had broken.
- One red was a real product bug of my own making: `engine.ts` called a
  bare `getComputedStyle` in `resize()`. That name is not on `globalThis`
  outside a browser, so **every** test that boots the engine threw on the
  first frame — the six covering the two largest files in the game.

Fixed: `illustrated-src/run-tests.mjs` runs all 41 with no skip list and
reports a test it cannot run as SKIPPED, failing the run unless
`--allow-skips` is passed. `package.json` declares the two packages and
the four gates as scripts. `SHIPPING.md` names them. **41 of 41 green.**

The lesson worth keeping: a gate whose cost you can skip when you are busy
is not a gate, and a test that has not run in months is not evidence.

---

## 2. Fixed in this PR

### Store blockers

| # | Where | What |
|---|---|---|
| F2 | `shell/adapter/adapter.js:60` | Android fetched the dust packs as SUBSCRIPTION, so none ever loaded and nothing could be sold on Google Play at all. |
| F3 | `shell/adapter/adapter.js:87` | `buy()` recorded the store's transaction id while `pending()` reported RevenueCat's id for the same receipt, so every purchase was granted twice. One id space now, and a purchase that cannot be named resolves `"failed"` rather than granting unconditionally. |
| F14 | `save.ts` | The receipt ledger lived only inside the save, so Start Over kept the store identity and the next boot re-granted every pack ever bought. The ledger now has its own slot a reset never clears. |
| F15 | `shell/ios/App/App/SceneDelegate.swift:11` | iOS never registered `BoardsPlugin` — `SceneDelegate` built a bare `CAPBridgeViewController`, bypassing the storyboard `configure.mjs` patches — so no score ever reached Game Center. `configure.mjs` stamps it and `check.mjs` requires it. |
| F52 | `shell/adapter/adapter.js:131` | The adapter's boot failure fell back to booting the bundle as the web page inside the store app, exposing dev doors and bypassing native storage. |

### Progression and rules

| # | Where | What |
|---|---|---|
| F1 | `beta-campaign-manifest.ts:232` | Mission 229 "Prism Edge" asked 115 acorns on a 100-gate arcade run that can only spawn about 100, so its third star — and the 780th star with it — was unreachable. Its gate count was the stray value: every other arcade row is `stage * 10` with acorns at half, and `6430750` had moved this one from 230 to 100 while leaving the 115 that was computed from 230. Restored to 230, contract and objective ids recomputed. The hand-authored `gold 5` goal is kept, so `road-rules.py` was **not** re-run — see F94. |
| F9 | `save.ts:372` | AcorNut's launch check counted legacy save bitmasks, not stars, so the pilot who earned him at 570 had him torn off on every launch. |
| F10 | `sim.ts:866` | Nightglider's effect sat behind the 180-star Flight Mods rung, so a companion bought with real money did nothing until then. |
| F28 | `save.ts:579` | Star Unlock could be spent on the AcorNut Wake, which is unwearable without AcorNut and automatic with him. |
| F24 | `engine.ts:1032` | A pack handed over its listed ids only, so the Circuit Pack gave Cyber without the Clockwork wake every other path includes. |
| F27 | `engine.ts:1618` | The daily was banked only at boot, so an app resumed across days never paid and the streak broke on its own. |
| F20 | `catalog.ts:858` | The featured card's struck-through price counted set trails the shelf gives away, overstating the discount. |
| F90 | `standalone.ts:3999` | `featureOpen` was never reset off the shop, so the pack sheet reopened itself and could sell a no-longer-featured pack at the featured discount. |

### Painter and art

| # | Where | What |
|---|---|---|
| G1 | `draw.ts:3076` | The finish portal had no arcade case, so on 19 live missions the door was painted as an ordinary acorn over a 64px hitbox. |
| F6 | `draw.ts:3059` | The arcade timeline painted debris at its home position while collision read the drifting one, up to a rock's width apart. |
| F22 | `draw.ts:3102` | Nine catalog companions painted nothing in the arcade timeline: cosmetics' vector kit is an if/else over the original eleven, and an unknown id fell out having drawn nothing. They fall back to their painted still, and `cosmetics.ts` now exports `canDrawPal` beside the chain it describes so the two files cannot drift. |
| G5 | `art.ts:493` | A suit bank that loaded short was published anyway and cached forever, and the painter's exact-count checks then switched that suit's animation off for the session with no retry. |
| G2 | `cosmetics.ts:48` | `withAlpha`'s colour cache was keyed on per-frame floats and never evicted. |

### Screens

| # | Where | What |
|---|---|---|
| F13 | `standalone.ts:326` | No sheet ever took focus. Opening a level from the chart left focus on `<body>`, so a keyboard pilot tabbed through ~130 map nodes to reach FLY. `render()` is now `paint()` + `settle()`. |
| F46 | `standalone.ts:3441` | Escape closed nothing — the engine's global Escape left the screen while the sheet's open-state persisted and reopened it. It now closes the topmost sheet only. |
| F40 | `standalone.ts:652` | The kept scroll position was screen-blind, so the Shop opened clamped to the real-money rows after the chart. |
| F48 | `standalone.ts:3813` | A part-bought cart lost its refusal to the trailing render, so dust dropped in silence. |
| F49 | `standalone.ts:3902` | A refused boost purchase re-rendered and wiped its own message. |
| F44 | `standalone.ts:3125` | A priced star rung announced "Yours." while the Loadout still charged for it. Copy only; the economy is untouched. |
| F43 | `standalone.ts:2421` | aria state where only a colour carried it: the Pal Effects switch, equipped cards, cart tiles, loadout tabs. |
| F19 | `campaign.ts:435` | A mission's Stopwatch was labelled COSMETIC while its tap-toggle was live, and other pals were shown by internal id. |
| F16 | `docs/index.html:795` | The daily streak's round pips were declared unscoped and repainted every glyph star on the Star Chart as a violet disc. |
| F4 | `audio.ts:185` | The gesture retry replayed the element but never resumed the context, so the menu score stayed silent until the first run. |
| F7 / F12 | `engine.ts:601`, `spill.ts:855` | The Debris Field launch button latched the thrust, so wave 1 opened with the ship climbing by itself and the first press did nothing. |

### Tooling

| # | Where | What |
|---|---|---|
| F51 | `test-shop.mjs:16` | The test asserted the legacy shelf the storefront never reaches, leaving `featurePrice`, `idDust`, `alaCarteTotal` and the cycle with no test at all. |
| G31 | `SHIPPING.md:78` | Gate 3 never named `happy-dom`, so the documented gate set never booted the game. |
| G14, G15, G17, G18, G32, G33 | the harness | Six tests permanently red on retired rules: the 100-mission road, AcorNut's 500-star gate, the old atan2 attitudes, the Switchback name, a 16-suit count, the zero-lean exception set. Each traced to the commit that moved the rule and corrected to the shipped truth — none deleted, loosened or skipped, and each correction mutation-tested to prove it still bites. |

### Deliberately not fixed

Three mediums, with the reason:

- **F50** — the daily receipt still reports the streak bonus on the day the
  Critter Pack replaced it. The repair is a recorded pack day in the save,
  not a screen change; a screen fix would have been the wrong layer.
- **F45** — a sheet taller than the viewport clips its primary button. The
  fix is one CSS rule in `docs/index.html`, and it wants a real device pass
  at the short viewports it affects.
- Whether `shopCycle` / `dealFrom` belong in `catalog.ts` beside
  `shopBundles`. A layering question for the owner, not a defect.

### Two things that are not defects, reported rather than changed

- The ladder pays AcorNut's wake at 520 and the suit at 570, so for fifty
  stars the trail is owned but unwearable — a consequence of the owner's
  "trail, buddy, helmet, acorns, dust, suit" block order.
- The shop's shelf re-deals on a UTC day boundary while the daily rolls at
  local midnight (F86, below).

---

## 3. Open, by file

Fifty-six confirmed findings not fixed here. Severity is the verifiers'.
The Fix column is the finder's suggestion, kept short — it is a starting
point, not a decision.

### `illustrated-src/game/standalone.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F45 | 3307 | medium | Level, reward and daily sheets have a max-height but no scroll, so on a short viewport FLY/BACK/NICE fall off-screen and the card covers the backdrop | docs/index.html: give the base card the treatment the race card already has — `.ac-lvlsheet > .ac-lvlcard { overflow-y: auto; overscroll-behavior: contain; }` and `.ac-lvlcard > * { flex: none; }` (the pattern at 1636), so short viewports … |
| F50 | 4766 | medium | Shop daily receipt shows "+30" and "5 plus the 25 streak bonus" on the day the Critter Pack replaced the bonus and only 5 dust was paid | engine.ts `dailyState()` must report what was actually paid on a claimed day, not re-derive it from the now-flipped flag. Record the pack day at claim (`save.streakPackDay = today()` beside `save.streakPackClaimed = true`; add the optional … |
| F39 | 59 | low | Menu-animation-off removes the hold-to-confirm fill, so HOLD TO CONTINUE / STAR UNLOCK / LEVEL SKIP give no feedback while held | docs/index.html: exempt the state fill from the blanket rule — `body.ac-nomotion .ac-holdbtn.ac-holding::after { animation: acHoldFill var(--ac-hold, 550ms) linear forwards !important; }` (a linear fill is progress, not decoration); or, in … |
| F77 | 357 | low | In-flight pause button has no accessible name (text 'II') and is 40px, under the 44pt minimum | `pause.setAttribute("aria-label", "Pause")` in standalone.ts and `.ac-iconbtn { width:44px; height:44px }` in docs/index.html. |
| F78 | 1349 | low | Hub acorn and Star Dust counters are aria-labelled 'Shop'/'Buy Star Dust', hiding the balances from screen readers | Label with the value: `acorns.setAttribute("aria-label", `${s.acorns.toLocaleString()} acorns — open the Shop`)` and `dust.setAttribute("aria-label", `${s.starDust.toLocaleString()} Star Dust — buy more`)`. |
| F79 | 1359 | low | Hub "Buy Star Dust" door sets a shopPage the storefront never reads; it lands at the top of the shop, not the dust rows | In the shop render branch, honour the requested page once: `if (shopPage === "dust") { overlay.querySelector(".ac-dustrow")?.scrollIntoView({ block: "start" }); shopPage = "packs"; }` (or give the STAR DUST head an id and scroll to it) … |
| F80 | 1466 | low | A run suspended at the pre-flight depot is labelled 'Saved at Depot 0' / 'RESUME DEBRIS FIELD · DEPOT 0' | Label the welcome checkpoint by its state rather than its wave: e.g. `suspended.state.welcome ? "Saved at pre-flight" : `Saved at Depot ${suspended.state.wave}`` in both places (or expose a small `spillCheckpointLabel(cp)` helper next to … |
| F41 | 1672 | low | "Debris Field" names both the Spill mode and the Hyper Run barrier, so the Hyper Run lock text sends players to the wrong mode | Give the barrier its own name in one place — e.g. add `name: "Hyper Run barrier"` to RACE_GATES in campaign.ts — and use it in the four strings (1672: `Pass the Hyper Run barrier after level 33 — a 2:30 finish — to unlock.`; 3039; 3388 … |
| F42 | 1890 | low | Favourite star is a 22px target nested inside the equip/buy button; a near-miss equips or opens the spend sheet, and the card's accessible name absorbs 'Add to favourites' | Render the star as a sibling of the card (wrap card+star in a `position:relative` span, or place the star in the shelf row after the card) so it is its own top-level `<button>`; give it a 44px hit area with padding/negative margin … |
| F82 | 2251 | low | Favourite star on a suit-only helmet (Leviathan) lights up but the FAVOURITES shelf never lists it | Include suit-only helmets in the favourites source when their suit is worn: build the favourites id list from `HELMETS.filter((h) => helmListed(h) \|\| (h.suitOnly === s.equippedSuit && helmetRevealed(s, h.id)))`, or do not append `favStar` … |
| F83 | 2303 | low | The 'no helmet' corner glyph on own-head suit cards is painted under the favourite star and is mostly hidden | Move `.ac-nohelm` to the top-left corner (`left:6px; right:auto`) in docs/index.html, or append the glyph inside the card's text area instead of the corner the star owns. |
| F84 | 2569 | low | Loadout coach scrolls with behavior:'smooth' regardless of Menu-animation-off, while the chart's goTo honours it | Use `behavior: engine.save.motionOff \|\| matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"` at both calls (a tiny `scrollMode()` helper shared with goTo). |
| F85 | 3376 | low | Goal pips on the level and level-done sheets convey earned/unearned by colour class on the same '★' glyph only | Give each pip `aria-label` ('earned'/'not yet') or `aria-hidden` plus a visually-hidden suffix on the goal text; a small helper used by all three sites. |
| F86 | 3594 | low | The shop day rolls at UTC midnight while the daily rolls at local midnight, so the shelf 'restocks tomorrow' mid-afternoon in the Americas and can re-deal under a purchase in progress | Expose the daily's local day number from the engine (dayNumber(today())) and have shopCycle read it instead of Date.now()/86400000; have buyFeature verify the id is the day's feature. |
| F87 | 3625 | low | The helmet shelf deals the suit-locked Leviathan helmet and the stage paints it on whatever suit is showing, a combination the game refuses | Exclude `h.suitOnly` helmets from helmPool (their id still reaches the suit shelf through suitPool) and run `helmetWornBy(tryOn.helm, tryOn.suit)` on the stage. |
| F88 | 3660 | low | Cart survives the daily restock: an item now held by the featured pack is still sold singly and cannot be un-ticked | Prune the cart to today's sellable shelf when the shop renders: after shopCycle() in drawShopBeta, `const sellable = new Set([...cy.suits, ...cy.helms, ...cy.pals]); for (const id of [...picked]) if (!sellable.has(id)) picked.delete(id);` … |
| F89 | 3966 | low | Star Dust pack rows on the web page are tappable and their refusal is wiped by the unconditional render(), so the tap does nothing visible | Drop the trailing `render()` (the engine notifies on every state-changing outcome), or disable the rows outright when `!platform.storeReady && !IS_BETA` with the aria-label "Sold in the app", so the row is never a live control that answers … |
| F91 | 4789 | low | editingName survives leaving the Profile; the next Profile visit opens in edit mode with the keyboard raised | In render(), next to the boostConfirm reset: `if (snap.screen !== "profile") editingName = false;`. |
| F92 | 4816 | low | An 18-character pilot name with no spaces overflows the Profile ID card | docs/index.html: `.ac-idname { min-width:0; overflow-wrap:anywhere; }` (or `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) — the layer that owns the name's width. |

### `illustrated-src/game/sim.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F31 | 690 | low | Rotating during a wormhole detour leaves the held gate run in the old field; exit drops the pilot below the floor and kills the run | Remap the hold in resizeWorld's tunnel branch: when `w.wormHold` is set, apply the same transform the planet-mode block applies to the live run (shift `x` by shiftX for hold.planets/hold.pickups, scale and clamp `gapY` and rebuild … |
| F68 | 998 | low | Seeded missions are not reproducible: debris positions run on the session clock w.time, which resetRun never resets | Add `w.time = 0;` to resetRun (w.time is only read for phases/animation frames and the blocker drift, so a per-run origin is safe), or give blockers their own run clock (`w.runT`) that resetRun zeroes and blockerX reads. |
| F32 | 1657 | low | A replayed tutorial inherits the equipped companions' effects: blind, upside down, wandering scroll, bounce house | Treat the tutorial like a mission with no pal. In resetRun: w.palFx = tutorial ? null : palIds(save, w).reduce(...); w.palFlip = !!w.palFx?.upsideDown; w.bounceHouse = !tutorial && hasPal(save, w, "spacepuppy"); and in palIds make the … |
| F33 | 2186 | low | Wormhole detour leaves the gate run's pickups live in the corridor: hazards/shields pay as acorns and the return run is stripped | Break the alias before the corridor is built: in initTunnel add `w.pickups = [];` beside `w.planets = [];` at 2186 (resetRun already clears pickups first, so the standalone Wormhole Run is unchanged), or in enterWormhole set `w.pickups = … |
| F34 | 2276 | low | Wormhole detour aliases the gate run's pickup array: gate pickups ride into the corridor and are lost on return | In initTunnel add `w.pickups = [];` beside `w.planets = [];` (sim.ts:2186). enterWormhole already captured the original array reference in wormHold before calling initTunnel, so the hold keeps the untouched gate-run pickups and the … |
| F69 | 2351 | low | Crashing inside a wormhole corridor still pays the exit gate and the zone jump | Only a flown exit pays: `function exitWormhole(w: World, flown = true)` with `w.score = hold.score + (flown ? 1 : 0);` and `if (flown) w.zoneJump += 1;`, and call `exitWormhole(w, false)` from die(). The door catch (2577) and the grace … |
| F70 | 2542 | low | Shields carried into a wormhole detour are drawn on the HUD but never fire in the corridor | Pick one contract and make the HUD tell it. Simplest: leave the corridor shieldless as the standalone mode is - drop line 2303 and restore in exitWormhole with `w.shieldCharges = hold.shieldCharges;` (the hold already carries it), so the … |
| F35 | 3274 | low | prismHue survives resetRun, so one Prismwing bounce recolours the sky of every later run this session | Add `w.prismHue = 0;` to resetRun (next to `w.recoveryMsg = ""` / env resets). Optionally also gate the draw on the pal: only apply the hue when runPals includes prismwing. |
| F71 | 3557 | low | Dying inside a wormhole detour still credits the gate and the zone jump | Give exitWormhole a `completed: boolean` parameter (true from the exit-door catch and the grace timeout, false from die()); when false restore `w.score = hold.score` and skip `w.zoneJump += 1` and the 'OUT THE FAR SIDE' banner. |
| F11 | 3587 | low | The acorn continue re-banks the whole score's XP and counts a second run on every crash | Bank XP as a delta of what this run already paid. Add `xpBanked: number` (reset to 0 in resetRun) and `continued: boolean` to World; in die(): const xp = Math.max(0, runXp(w.score, w.runAcorns + w.acornsBanked, ...) - w.xpBanked); // or … |
| F36 | 3616 | low | Acorn continue re-banks the whole score's XP and counts a second FLIGHT on every crash after a revive | Track what the run has already banked on the World: add `revived: boolean` and `scoreBanked: number` (both reset in resetRun); reviveRun sets `w.revived = true; w.scoreBanked = w.score;`. In die() pay `xp = Math.max(0, runXp(w.score … |
| F72 | 3775 | low | Pause is refused for the whole tutorial while the play bar offers a pause button | Refuse only a held beat, which is the state the lock protects: `if (w.screen !== "play" \|\| w.tut?.hold) return;` in pausePlay. The scripted beats already freeze the world through hold; the live stretches pause like any other run and … |
| F73 | 4037 | low | Deep Space shifts and moves the pilot on the untouched TAP TO FLY card | Hold the Deep clock and the fold with the rest of the world: guard both blocks on the run having started, e.g. wrap 4037-4057 in `if (!w.ready) { ... }` (or move them below the `frozen` return, keeping the `w.warpT > 0` condition in that … |

### `illustrated-src/game/draw.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F21 | 1881 | low | The Spill and Hyper Run cockpit paints a helmet over the Cat's own head | Guard the dome the way every other painter does: `if (!wearsOwnHead(suit)) paintDome(...)` in paintSpillHead, and give the own-head suits their own head anchor (or skip the crop offset) instead of falling back to `suit:flight`. |
| F59 | 2514 | low | Spill lesson panel ignores the safe-area inset and overlaps the rule chip on notched phones | Step the hint back up like the chip: `drawSpillHint(ctx, w, s.hint, alpha, H - (w.insetTop \|\| 0) - 96)`. |
| F60 | 2728 | low | FINISH label reads upside down when the world is flipped | Pass `worldFlipped(w)` into drawFinishPortal and apply `if (flipped) ctx.rotate(Math.PI)` alongside the mirror counter-scale around the label anchor (worldFlipped is already imported). |
| G7 | 5184 | low | The loadout preview's frame sweep is disabled for exactly Flight and Eclipse, on a premise MOTION_SPEC.md records as impossible | Drop the third clause: `const swept = !sweep && ascN > 0 && descN > 0;`. A suit with a motion bank cannot draw its tap bank anywhere, so there is no beat left to keep — and the two suits it selects are the two the spec already lists as … |
| F61 | 5237 | low | Hangar flight preview pitches Volt and Cyber with the heading rig that real flight never applies | Use the same rule as drawPilot in the preview: pass `suit.id === "eclipse" ? 2 : 0` (ideally hoist that expression into one helper both callers use). |
| F62 | 5617 | low | Warp vortex is drawn inside the HUD's inset translate, shifting it down and leaving the top strip unpainted | Draw the swirl in screen space: `ctx.save(); ctx.translate(0, -(w.insetTop \|\| 0)); drawSwirl(ctx, w, art); ctx.restore();` (or call it from drawHud before the translate). |

### `illustrated-src/game/engine.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F63 | 644 | low | Resuming a suspended expedition restores the old help-prompt setting instead of the current one | In spillResume, after restoring: `restored.hints = !save.helpOff;` (the engine already re-derives `signal` from the save at the same spot). |
| F64 | 917 | low | Seventh-day pack replaces the 25-dust bonus even when the pilot already owns the Critter Pack | At engine.ts:917 treat an owned pack as already claimed: `const pack = bonusDay && !save.streakPackClaimed && !STREAK_PACK.every((id) => (save.purchased \|\| []).includes(id));` and in claimDaily set `streakPackClaimed = true` when the ids … |
| F25 | 1351 | low | Global Space handler launches NORMAL from the title regardless of the selected mode and cancels Space activation of every overlay button | engine.ts keydown: before line 1351 return early when the focused element is a BUTTON/[role=button] (or when document.activeElement is anything but body/canvas), and delete the `world.screen === "title" -> engine.fly("fly")` branch; in … |

### `illustrated-src/build-roadmap.mjs`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F55 | 21 | low | ROADMAP.md says production activation of the 260 road and the 320–780 rewards is still held, while STAR_MAP_LIVE ships both | Print the state from the constants: import STAR_MAP_LIVE from catalog.js and write `Production ${STAR_MAP_LIVE ? "flies" : "holds back"} the 260-mission road`; remove or condition the "cannot be claimed / activation pending" sentence on … |
| F17 | 38 | low | ROADMAP.md claims nine Debris Field missions with 4–20 wave targets and Ore/no-hit stars; the live road has 26 with 2–50 waves and finish-only stars | Derive the sentence from LEVELS in build-roadmap.mjs (count `base === "spill"` rows, list their `gates`, and drop the Ore/no-hit claim unless a row carries such a goal), or delete the hard-coded paragraph. |

### `illustrated-src/game/beta-campaign-manifest.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F56 | 5 | low | Mission 1-2's third star (collect 1 acorn) is weaker than its second (collect 5), so star 3 is free and can be earned without star 2 | Set the third goal to {"kind":"acorns","n":7} (pct(10,.65)) in row 2 and recompute contractId/objectiveIds with the previousIds formula (sha256 of {base,gates,fx,goals,spillFinish:null}, first 16 hex, objectiveIds … |
| F5 | 204 | low | "First-pass target" seconds on 117 mission sheets are 3-5x too short for the current gate counts | Regenerate `durationTarget` from the current `gates`/pace in the same pass that rewrote them (road-rules.py or the a76ea08 generator), or, minimally, stop rendering the line in drawLevelSheet (standalone.ts:3320) until the manifest carries … |

### `illustrated-src/game/catalog.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F57 | 130 | low | Profile News says the Star Chart has "a hundred levels"; the chart has 260 | Reword the sticker to the shipped road ("260 missions, three stars each") — NEWS lives in catalog, which cannot import campaign, so keep it a literal and cover it with a test that compares the number in NEWS[0] to LEVELS.length. |
| F58 | 646 | low | Circuit Pack advertises 'All three come with custom helmets' but Robo has no custom helmet and the pack carries no helm item | Either add the intended Robo helmet (a `robo` HELMETS entry with suitOnly/ownHead as designed and a helm item in the pack) or correct the blurb to what the pack delivers ('Cyber and Volt wear their own heads'). |

### `illustrated-src/game/save.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F67 | 750 | low | ownsPremium answers the suit gate for a shared suit+helmet id, so the Samurai helmet earned at 240 stars is hidden from the Loadout until 250 | Let the Loadout ask the kind-specific gate: use `helmetRevealed(s, h.id)` (and `suitRevealed` for suits) as the premium "owned" answer in standalone.ts helmCard/helmListed, keeping ownsPremium for the shop's id-level pricing; or make … |
| F30 | 781 | low | Star Unlock ledger is keyed by bare id, so a shared id (comet, aurora, matched suit/helmet sets) pays a 250-acorn substitute on a rung that was never boosted | Key the boost ledger by kind as well as id: in unlockReward push `${r.kind}:${r.id}` (or rewardId(r)) to s.boostedRewards, and in settleStarRewards test `s.boostedRewards.includes(`${r.kind}:${r.id}`)` (keep the purchased-id test as is … |

### `illustrated-src/verify-art.py`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| G24 | 285 | low | The bundle "art must ship on production" guard derives beta_only_art from suitIds only, so a pack selling a helmet/pal/trail with beta-gated art passes | In verify_catalog_assets, parse the IS_BETA tail out of `helmIds` and `palIds` as well as `suitIds`, key the resulting sets by bundle-slot kind (`suit`/`helm`/`pal`), and test each slot against its own kind's set. While there, delete the … |
| G23 | 1082 | low | verify_beta_art_gates never reads suitIds/helmIds, the lists that actually gate the base sprite — its `gated` set is empty today, so the check is vacuous | Add the id lists to the scan in verify_beta_art_gates: extend the table tuple with `"suitIds"`, `"helmIds"` (and `"palIds"`), and relax the slice bound so it finds the indented `const suitIds` declarations (the current `seg.find("\nconst … |

### `illustrated-src/game/spill-workshop.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F74 | 231 | low | Utility fit/swap receipt announces success before the engine result; a refused purchase still says 'fitted' | Mirror priceButton: `if (engine.spillUtility(...) !== "ok") { view.receipt = "Utility unavailable"; view.flashAt = -10000; rerender(); }` in both onclick handlers. |

### `illustrated-src/game/spill.ts`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F76 | 1391 | low | Respawn Core hands the ship back with the thrust off while the thumb is still down; the ship free-falls until the player lifts and re-presses | At spill.ts:1391, mirror beginWave: add `s.held = s.pressed;` when returning to 'wave'/'drain' (and `s.manual = false` is not needed since the phase is flying). |

### `illustrated-src/road-rules.py`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F94 | 48 | low | road-rules.py's Free Flight rule no longer matches the live road: re-running it rewrites 112 fly rows and their contract ids | Make the fly branch mirror the live rule (`g = stage*10; if n == 10: g = pct(g, .5) elif ord > 100: g = min(g, 100 if ord <= 200 else 200)`) or return None for `fly` (the docstring already says fly goals are hand-tuned), so the script is … |

### `illustrated-src/test-beta-campaign.mjs`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| G19 | 113 | low | Three whole seams never execute because no level carries their fx, yet the pass line claims they were verified | In test-beta-campaign.mjs, replace the `if (xDef)` skips with synthetic defs — the file already builds one at line 73 (`contact({...springDef,fx:{...springDef.fx,bounceScale:1}})`), so `contact({...someFlyDef, fx:{...someFlyDef.fx … |

### `shell/configure.mjs`

| # | Line | Sev | What | Suggested fix |
|---|---:|---|---|---|
| F97 | 82 | low | Info.plist never sets a status bar style, so iOS light mode paints black clock/battery over the dark hub | In configure.mjs's Info.plist block add, next to the UIRequiresFullScreen insertion: `if (!plist.includes("UIStatusBarStyle")) plist = plist.replace("\t<key>UIViewControllerBasedStatusBarAppearance</key>" … |

---

## 4. The owner's answer: a rung never charges

Nine star rungs REVEALED a helmet rather than granting it — reaching the rung
opened the item on the shelf, and the Loadout then charged acorns for it. F44
fixed the words; the owner settled the rule (8 Sep 2026): *"remove from star
rung, some items are acorns.. at those star rung replace with acorns for now.
might add new asset later to replace."*

Those nine helmets came off the ladder. The rungs pay acorns at their block's
rate — the same `100 + 70 x block` the generator already uses for every other
acorn rung — and each helmet keeps the shelf gate it always had, so the shop
opens at exactly the pace it did:

| Stars | Was | The rung now | Helmet, still on the shelf here | Acorns the road has paid by then |
|---:|---|---|---:|---:|
| 15 | Void Helmet | 100 acorns | 90 | 100 |
| 60 | Comet Helmet | 170 acorns | 120 | 370 |
| 70 | Cherry Helmet | 170 acorns | 150 | 540 |
| 120 | Phoenix Helmet | 240 acorns | 175 | 780 |
| 180 | Royal Helmet | *Flight Mods gate* | 200 | 780 |
| 190 | Aurora Helmet | 310 acorns | 300 | 1,090 |
| 300 | Rose Helmet | 450 acorns | 350 | 1,920 |
| 540 | Meteor Helmet | 730 acorns | 400 | 4,350 |
| 560 | Chrono Helmet | 730 acorns | 500 | 5,080 |

180 is the exception: the Flight Mods gate already owns that rung, so the
Royal Helmet is covered by the road behind it rather than by a rung of its
own. Every helmet is paid for by the time it reaches the shelf, so the acorn
sink survives and nothing on the road announces an unlock over a price tag.

### Three things this turned up

- **The ladder is generated, and it was idempotent.** A fresh
  `reward-ladder.mjs` run reproduced the committed list 87 rows out of 87, so
  a hand edit would have left the generator disagreeing with the file it
  owns — the same trap recorded as F94 for `road-rules.py`. The generator was
  taught the rule instead, and a re-run now reproduces the ladder byte for
  byte. **All 55 item rungs are untouched.**
- **Dropping the nine from the pool would move everything else.** The eight
  surviving helmets re-spread: the Ghost Suit walks to 60, the Cat Suit to
  300, AcorNut to 550, and the Chronarch Helmet lands at 15 stars. So the
  nine stay in the pool holding the slots they always held, and only what
  gets *written* at those slots changes.
- **`STAR_UNLOCKS.helmets` is derived from the ladder.** Taking the nine off
  it also took their shelf gates, which would have put all nine helmets in
  the shop from the first flight — a pacing change nobody asked for. They are
  now declared in `PRICED_HELMET_GATES` and merged, with the ladder winning
  where both name a helmet, so a new asset dropped onto one of these rungs
  later takes its gate from the ladder as usual.

`test-star-map.mjs` holds both halves of the rule for whatever lands on these
rungs later: no helmet or suit rung may name an item the Loadout still charges
for, and no priced helmet may reach the shelf before the road has paid its
price. Both were mutation-tested against the product. `rewardDue` in
`standalone.ts` stays as the screens' own check — it answers 0 for every
reward on the road today.
