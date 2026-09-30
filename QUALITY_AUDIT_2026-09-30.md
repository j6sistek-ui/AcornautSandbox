# Quality audit, 30 September 2026 (pre-App Store)

Eight reviewers worked the repo in parallel at `2639d9ee` (main, stamp 295),
one per area: Debris Field, the Free Flight rule-sets, Hyper Run, the Star
Chart and guided start, the menus (Loadout / Shop / Profile / Help / hub),
the native shell and store readiness, save data and migration, and
rendering / performance / audio / input / boot. Each was read-only and had
to reproduce a claim by running something before calling it confirmed; a
claim confirmed by reading alone says so. Their scratch scripts and
screenshots are not in the repo.

Everything in section 1 is fixed on stamp 296. Section 2 is what the
audit found and deliberately did not change, because it is a gameplay,
content or product decision. Section 3 is the polish backlog. Section 4
is the App Store submission checklist, split into what code did and what
only the owner can do by hand.

Gate state on stamp 296: `tsc` clean; `verify-art.py` PASS (32 QA groups); `test-platform-bridge` 57 files clean; suite loop 65 pass / 1 red (`test-high-orbit`, the known Linux-only cinderforge pixel diff); `test-star-map-ui` production and beta, `test-shop-visuals` production, beta and native, `test-tunnel`, `test-vanguard-flight`, `test-vanguard-render` and `test-warp` all pass. New tests: `test-spill-countdown-coins.mjs`, `test-save-shapes.mjs`. Browser pass at 360 and 390 px with no console errors.

---

## 1. Fixed on stamp 296

### Owner-reported

- **Debris Field coins were visible but uncollectable between waves.**
  The countdown moved and drew the leftover coin stream but only the wave
  and drain phases collected; a coin under the ship in the 3-second
  intermission paid nothing and scrolled off. The ore step is one function
  (`stepNuts`, `spill.ts`) and the countdown calls it too. Coins still on
  screen when the dock call comes are paid into the wallet instead of
  swept away. `test-spill-countdown-coins.mjs` pins it.
- **The $1.99 pack was not in the store.** Cash packs were hidden on any
  page with no store answering. Both packs are listed everywhere with their
  stickers; a store sells them, the beta grants them, and the web page says
  "Star Dust packs are sold in the app" on a tap. A shell with no store
  configured lists no cash rows (a reviewer would otherwise see two dead
  "…" rows).
- **ARCADE is the third mode**: NORMAL, DEBRIS FIELD, ARCADE, HYPER RUN,
  DEEP SPACE, LOST IN SPACE.

### Free Flight (NORMAL / DEEP / LOST / ARCADE)

- NEW BEST was said again after a continue at the same score, and on any
  tie (`sim.ts` used `>=` against a best the first crash had already
  written). It compares `>` against the best captured before the crash.
- "FLIGHT CONTINUES!" and the other recovery banners printed through the
  crash sheet; `die()` clears them.
- A run with a continue counted as two or three FLIGHTS on the Profile and
  as two or three crashes toward the interstitial cadence
  (`World.continued`).
- REPLAY TUTORIAL inherited the equipped pal's effects (Magnetar taught the
  first flight upside down). The lesson lends Acorn in its pal stages and
  nobody otherwise.
- A crash inside a wormhole detour awarded the exit gate (+1).
- The Stopwatch "TAP SLOW · OFF" line showed in every mode while the toggle
  only works in NORMAL; the line now follows the sim's rule (see §2 for
  the rule itself).
- DEEP SPACE's blurb promised "Endless back-to-back black holes"; the mode
  has none (it is a 10-second space shift). Blurb and swirl text say so.
- Shield charge dots were drawn under the pause button.
- Locked DEEP SPACE / LOST IN SPACE rows were a dead tap; they open the
  Star Chart like the locked Hyper Run row.
- Hub ACTIVE chips listed mods with HYPER RUN selected, where mods are off.
- The graduation crash sheet made TRY AGAIN primary and COLLECT the ghost;
  the Debris Field sheet did the opposite. COLLECT leads on both.
- Wormhole Run appeared on Your bests while off the mode sheet; it appears
  once it has a score.
- Free Flight did not pause when the app was backgrounded (only Hyper Run
  and the Debris Field did); on return the loop replayed up to 0.25 s with
  no input. Every live run pauses on blur or hide; the tutorial keeps
  flying, as `pausePlay` intends.
- `world.race` survived into the Loadout from the results sheet and kept
  the DPR pinned; every menu clears run state, and an aborted Debris Field
  run banks its waves and records first.

### Debris Field

- The spill board was posted twice per death (the sim's `die()` with the
  score and the engine's cue dispatch with waves cleared). One post, waves
  cleared, and not for missions.
- The live-rule chip sat under the DIVE pad while the on-screen pads were
  on; it climbs above them like the hint card.
- A settled contract's line ("CONTRACT COMPLETE · +35") greeted every later
  Depot; it is cleared when the Depot closes.
- A run saved at the pre-flight Depot resumed as "DEPOT 0"; it says
  PRE-FLIGHT. The Depot kicker wrapped at 360px; it holds one line.
- `test-spill.mjs` counted a coin kind that no longer exists (vacuous); it
  checks the kinds that do.

### Hyper Run

- The results sheet printed an unlabeled raw-seconds gap (`+124.750`) and
  no best time, and "BEST 0" under the acorn line read as the best time.
  It says BEST m:ss.mmm and the gap in the same format, names the acorn
  best BEST ACORNS, and has one heading (kicker TIME TRIAL).
- `formatRaceTicks` mangled negative input; it clamps.

### Star Chart, rewards and guided start

- A Star Unlock was remembered by bare id. Five suit/helmet pairs share
  one id across two rungs (cinderforge 135/140, groveguard 160/170, cosmic
  185/190, sunforged 235/240, abyssal 260/265), so one 50-dust boost paid a
  phantom 250-acorn substitute on the half it never touched. Boosts are
  remembered by rung; an older bare id counts only where the id names one
  rung.
- A star total that was not a number paid every rung (435 dust, 6,860
  acorns) while every gate read locked. It pays nothing.
- The total is capped at the chart's maximum, and a beta save's stars on
  missions 101-260 no longer inflate the production total (`starsOf` read
  162 with 30 real stars).
- The reward sheet promised "this rung pays 250 acorns instead" for items
  from older saves that the ledger never paid; it promises only where a
  Star Unlock or purchase will pay. The results sheet says ALREADY YOURS ·
  PAID ... INSTEAD for a substituted rung rather than UNLOCKED.
- Flying Mission 1 straight from the chart left the guide at "hangar", so
  the hub nagged "FLY MISSION 1" after it was flown and the chart guide
  never opened. Flying a road mission graduates the guide wherever it was
  left; leaving the graduation crash sheet any way moves it on.
- Rewards were banked only on a screen change, so chaining NEXT → NEXT
  deferred the payout; a mission launch banks first.
- Copy: "Collect 1 acorn"; no SWAYING GATES tag on a Nightglider mission;
  the production road's end reads CHART COMPLETE · REPLAY FOR EVERY STAR
  (there is no "more sky" on production); GATECRASHER and STARLORD have
  their own rank emblems (both drew the CADET chevron).

### Loadout, Shop, Profile

- START OVER erased on a fast double-tap of the same armed button, and
  its copy left out what money had bought. It opens a confirmation sheet
  (NOT NOW / ERASE). **Start Over now keeps shop purchases, Star Dust and
  boosts** and erases everything else: the receipt vault deliberately
  survives a reset so the store never re-grants a consumed pack, which
  meant a reset took real money with no way back. The save is sealed until
  the reload so a late store answer cannot write the old save back.
- The privacy link was relative: the beta page got a 404 and the app
  cannot open a relative page in the system browser. It is absolute.
- The engine sold a helmet the Loadout hides (its gate was the premium
  list, the Loadout's is every own-head suit). Same rule now.
- Escape over an open pack sheet in the Shop did nothing the first time
  (the hub-only daily toast was counted first).
- A shop with every item owned showed a blank rail under NOTHING SELECTED;
  it says so.
- The small controls (favourite star 22px, case fold, view toggle, help
  dot, back arrow, plate button, privacy link) grow 44px hit areas.

### Save data

- A hand-edited save could throw at load (`unlockedSuits: 5`,
  `purchased: {}`, a `campaignProgress` with no `missions`) and leave a
  blank page with no Start Over to reach. Every list field is a list of
  strings, the counters are whole non-negative numbers (`acorns: "500"`
  used to concatenate to "5006860" on the first payout), the guide is a
  known step, and a ledger that is not a ledger is rebuilt.
  `test-save-shapes.mjs` loads 23 bad shapes.
- The pilot name is cut by character, not UTF-16 unit (a run of emoji
  ended on a lone surrogate).
- A blob that is not a save is stashed under `<key>:corrupt` before the
  fresh save replaces the slot.
- A value that fell back to memory storage (quota, private mode) is read
  back first; a failed write no longer reads back as the stale slot.

### Rendering, audio, boot

- Images are decoded before they are handed over (`img.decode()`); a
  zone's 6 MP panorama used to decode synchronously on its first paint
  mid-run (p95 67 ms in Free Flight, 83 ms at the Depot).
- The background art sweep pulled ~10 MB through a 10-second run and
  doubled its frame times; it waits while a run is on screen.
- The sky cache never shrank; it keeps the four most recent.
- The DPR safe cap steps to 2, where the race and the Debris Field already
  sit (2.5 was not enough of a step for a phone that fired the probe).
- An AudioContext left "interrupted" by a call or Siri (WebKit) stayed
  silent; it is resumed like a suspended one.

### Native shell and store readiness

- Google UMP consent is requested before the AdMob SDK starts and the form
  is shown once where a region requires it (EU/UK policy; there was no
  consent path).
- The Hyper Run board was posted in 1/60-second ticks; Game Center's and
  Play's elapsed-time formats read hundredths, so a 1:36 run would have
  shown as 57.60 s. The adapter posts ticks × 100 / 60.
- A purchase rejected with code 1 is "cancelled" (the iOS plugin never sets
  `userCancelled`); code 11 (Ask to Buy) is "pending", paid by
  `deliverPending` once approved, not "failed".
- Android's hardware back did nothing on the hub; it backgrounds the app.
- `UIStatusBarStyleLightContent` (a black clock sat over the dark hub in
  light mode) and `ITSAppUsesNonExemptEncryption=false` are in the plist
  and stamped by `configure.mjs`.
- `shell/check.mjs` exits 1 while a value is missing or `admob.testing`
  is true, so it can gate an archive.
- The Play Games SDK is not initialised while the project id is the
  stamped placeholder "0" (it logs a fatal developer error at launch).
- `docs/privacy.html` said "No advertising" and "no leaderboards" while
  the shell ships AdMob and Game Center / Play Games. Both have their own
  sections; effective date 30 Sep 2026.

---

## 2. Open: the owner's call

Each of these was confirmed by a reviewer and left as it is because it
changes how the game plays or what it sells. The proposed change is
written out so a yes is enough.

1. **Stopwatch's tap toggle works only in NORMAL** (`sim.ts:3170-3179`,
   `w.flight === "fly"`). The catalog says "Tap Toggles Scroll Speed" with
   no mode named, and a Lost-based mission carrying Stopwatch cannot
   toggle either. Proposal: drop the mode guard so the toggle works in
   every Free Flight rule-set and every mission that flies the pal. (Done
   for now: the HUD line is hidden where the toggle is inert.)
2. **A first-time pilot can skip the tutorial** by picking ARCADE (or any
   non-NORMAL mode) from the always-present MODES tile (`engine.ts:347`,
   `needTut` only for `fly`); the tutorial then springs on their first
   NORMAL flight. Proposal: run the tutorial for ARCADE too, or keep the
   other modes locked until `tutorialDone`.
3. **ARCADE's "2x power-ups" is 4x versus NORMAL** (`sim.ts:1559-1563`:
   arcade ×2, fly ×0.5; measured specials per gate fly 0.067, arcade
   0.255). The copy is right against Deep/Lost. Proposal: "Double
   power-ups" or leave.
4. **Twenty of the 100 production missions are three-star gimmes**: the
   `n===8` Spill rows (a pinned owner contract, `test-spill.mjs:596`) and
   the `n===10` chapter finales carry `[finish, finish, finish]`, so one
   finish banks 3 stars (60 of the 300 road stars) and the sheet prints
   "Reach the portal" three times plus a raw challenge string
   (`standalone.ts:3485`). `BETA_260.md:44` says finale stars should be
   earned on replays. Proposal: author real star-2/3 goals for the ten
   `x-10` finales (noBounce / noShield) and give the Spill rows distinct
   text or one row.
5. **Mission 1-2's stars are inverted** (star 2 = 5 acorns, star 3 = 1
   acorn) and every `x-2` mission's two acorn goals nest (star 2 is free
   once star 3 lands). Proposal: swap 1-2's goals and re-author the nested
   pairs so each star asks something the other does not.
6. **Dev doors are open on the production web page** (`platform.ts:203`,
   `devDoors: a?.devDoors ?? !native`): every visitor to acornaut.app sees
   HAVE AN ACCESS CODE?, and the codes hand out every premium item, all
   300 stars and a personal note. The shell closes it, so the store build
   is unaffected. Proposal: `devDoors: a?.devDoors ?? IS_BETA`.
7. **The shop's cycle inspector ships to players** on both pages
   (`drawCycleRoll`, the "OFF THE SHELF TODAY · 3 in the pack · 12 resting"
   bar). An earlier decision kept it; it reads as debug UI in a store
   build. Proposal: `if (IS_BETA)`.
8. **Placeholder Capacitor icon and splash** on both platforms
   (`shell/ios/App/App/Assets.xcassets`, `shell/android/app/src/main/res`,
   a white `LaunchScreen.storyboard`). Apple rejects placeholder icons and
   launch images. Needs the owner's art: `npx @capacitor/assets generate
   --iconBackgroundColor '#070b16' --splashBackgroundColor '#070b16'`
   from a 1024² icon and a 2732² splash, and the storyboard background set
   to `#070b16`.
9. **Hyper Run stays locked on the mode sheet at barrier 33** while the
   chart's blocking tag opens it (`standalone.ts:1764`). Consistent and
   deliberate; a player at the gate may look in MODES first.
10. **ABORT TO TITLE** forfeits the run's unbanked acorns (Free Flight)
    with no confirmation. The Debris Field's records are banked since
    stamp 296. Proposal: a one-line confirm on the pause sheet.

---

## 3. Polish backlog (confirmed, not done)

- Menu screens repaint the full-screen sky every frame at DPR 3
  (`engine.ts:1878-1882`; 54-120 rAF/s on the hub and Loadout). Pure
  battery cost; skip the draw when nothing changed.
- Boot pulls ~400-500 files / 21-27 MB before the title is interactive
  (`art.ts:649-862` eager set: helms, vortex, debris, pickups, hyper-run,
  spill-ship, 45 pal stills, 77 suit files); 10 s cold in headless. Mostly
  the web build (the app is local disk). Move helms / vortex / hyper-run /
  spill-ship / pickups to the lazy loaders that already exist.
- Landscape safe areas: `--sat`/`-bottom` only, never left/right; the
  canvas HUD reads only `insetTop` (`draw.ts:5775`). `manifest.webmanifest`
  says `"orientation": "portrait"` while the web game supports landscape.
- `intro-wide.mp4` is 14.5 MB with `preload="auto"` on landscape web
  launches; `intro.webm` (2.0 MB) is listed before `intro.mp4` (1.65 MB).
- Menu/flight/voyage loops are MP3 (`audio.ts:99-104`); encoder padding
  seams at the loop point. Gapless AAC/OGG or a crossfade.
- Tap targets still under 44px: hub squares 36px at 360, hub pills 34px
  tall.
- Tutorial coach panel covers the pilot at 360×780 (`draw.ts:6068`,
  panel at 0.36 H, pilot at 0.45 H).
- Help's Game Items list omits the Hyper Run flow-multiplier pickup
  (`sim.ts:2095`). Feature badge "33.3% OFF" / "16.7% OFF" could round.
- The daily reward uses the local date, the shop rail rotates at UTC
  midnight (`engine.ts:1144` vs `shopDayIndex`).
- Reward-ledger keys embed the star count (`legacy:mod:startShield:5`),
  so a regenerated ladder re-pays crossed rungs to existing players (the
  15 Sep 780→300 change did). Key item rungs by kind:id with a one-shot
  migration if the ladder changes again.
- A paid transaction for a retired pack id is dropped forever
  (`engine.ts:1285`); a `RETIRED_PACKS` map would pay it. No live exposure
  (dust-100 was never a cash pack).
- Committed native projects lack the AdMob plugin (`Package.swift`,
  `capacitor.settings.gradle`); `npx cap sync` regenerates them and
  `check.mjs` could grep for it. `SKAdNetworkItems` carries only Google's
  id; no app-level `PrivacyInfo.xcprivacy`; `UIRequiredDeviceCapabilities`
  still `armv7`.
- The Debris Field pause sheet has no Save & Exit mid-wave; the crash
  sheet has no leaderboard link after a NEW BEST; the daily toast has no
  `role=dialog`.
- Missing screens: no credits/about beyond the footer line, no Terms/EULA
  link, no in-app privacy screen (the policy opens in the browser), no
  online leaderboard screen (Your bests is local; the boards hook shows
  the platform sheet), no "road complete" beat after mission 10-10 on
  production, no Level Skip "+3 stars" moment.

---

## 4. App Store submission checklist

### Done in code (stamp 296)

- [x] Privacy policy describes AdMob and Game Center / Play Games; link
      reachable in-app on iOS and Android.
- [x] UMP consent before ads; non-personalised requests.
- [x] Purchase outcomes: cancelled / failed / pending mapped; receipt
      ledger idempotent; Restore Purchases where a store answers;
      `deliverPending` at boot, resume and restore.
- [x] Two consumables mapped: `dust-250` ($1.99), `dust-2500` ($3.99).
- [x] Boards: fly (high to low), spill (waves, high to low), hyper
      (hundredths, low to high).
- [x] Status bar light over the dark hub; export compliance answered;
      portrait lock; safe-area insets; `IS_BETA` never true on native;
      no "Alpha/dev" in the native footer; dev doors closed on native.
- [x] `shell/check.mjs` gates the archive (exit 1 while incomplete).
- [x] Offline boot: no remote fetch, no CDN.

### By hand (the owner)

- [ ] App Store Connect app record → `ios.appStoreConnectAppId`.
- [ ] Play Games project id (or leave boards off on Android).
- [ ] Three leaderboard ids: `acornaut.normal` (integer, high to low),
      `acornaut.hyper` (elapsed time to the hundredth, low to high),
      `acornaut.spill` (integer, high to low).
- [ ] AdMob app ids and four unit ids; `admob.testing: false`.
- [ ] RevenueCat keys, the two consumables at the $1.99 / $3.99 tiers,
      `iap: true`, Paid Apps agreement and banking.
- [ ] Real icon and splash (item 8 above), then `npx cap sync` and commit.
- [ ] Screenshots: 6.9", 6.7", 6.5" (5.5" if asked); Android phone and
      7"/10" tablet or opt out.
- [ ] App Privacy answers: AdMob → Identifiers (device id), Usage Data,
      Diagnostics, purpose advertising, not linked, not used for tracking;
      Game Center → nothing collected by you. Play Data safety: Advertising
      ID collected.
- [ ] Age rating questionnaire (contains ads); support URL; marketing URL;
      privacy URL `https://acornaut.app/privacy.html`; contact address.
- [ ] Signing in Xcode (team stamped); Game Center + In-App Purchase
      capabilities on the App ID.
- [ ] Device run per `SHIPPING.md §5`: fresh install, sandbox purchase,
      restore, board submit, kill and relaunch, airplane-mode boot.
- [ ] Helmet placement validated in the rig editor (owner's standing task).

---

## 5. Status of the 7 September audit

Blocker 7 (no shell) is closed: the shell exists and `check.mjs` names
the five values still to fill. The `IS_BETA` native guard, the receipt
ledger, the external links, the dev-door gating and the Hyper board post
are closed. PACKAGING_PLAN F97 (status bar) closed on stamp 296. The
privacy policy, which predated the ads decision, is rewritten on stamp
296. The Hyper board's units were wrong (ticks) and are fixed. Sections 5
and 6 of that audit are superseded by sections 2 and 3 above.
