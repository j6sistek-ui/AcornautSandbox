# Packaging plan, 12 Sep 2026

The three audits (`APP_STORE_PREP_AUDIT.md` 7 Sep, `CODE_AUDIT_2026-09.md`
8 Sep, `LANDSCAPE_DESKTOP_READINESS_AUDIT.md` 21 Aug) evaluated against main
at `349c8475` + PR #290 (stamp 283), with every open item re-checked in the
source rather than taken from the audit's status line. This is the ordered
list to a TestFlight build and a store submission.

## Where the audits stand

| Audit | Verdict today |
| --- | --- |
| App Store prep | 6 of 7 ship blockers landed and verified in source: safe-area insets (24 uses in `docs/index.html`, HUD offset through `insetTop`), the purchase receipt ledger (`takeReceipt`, `PendingPurchase`), price rows gated on `platform.storeReady`, cancelled / failed copy, privacy page packaged, `IS_BETA` unreachable on native. **Blocker 7 is the only one left and it is not code**: the 11 store-issued values `shell/check.mjs` lists. |
| Code audit | 55 open findings, 53 low, **2 medium** (F45 sheet scroll, F50 daily receipt text). Nothing blocks review; F45 is the one a reviewer on a small phone can hit. |
| Landscape / desktop | **Parked for v1.** The manifest says portrait, `npm run configure` stamps portrait-only and iPhone-only, and the wide companions were never made. Nothing here is on the path. |

Test health: 54 of 55 non-heavy tests green; the one red is the 22-byte
Cinderforge fallback mismatch, reproduced on unchanged main and Linux-only
(passes on Windows). `test-flight-input` is not run by instruction.

The package (`npm run web`) is 145 MB: 140 MB art of which `suits` 35,
pal idle banks (`solo`) 28, `zone-scenes` 16, `planets` 14, `shop` 10,
`skies` 8. All of it is reached by production. Under the 200 MB cellular line.

## P0 — the critical path (owner, no code)

These are the only things standing between today and a build on a phone.
In order, because each one hands the next its value.

1. **Validate helmet placement** (task #62, your own gate before any App
   Store step). `docs/lab/visual-audit/` is the contact sheet;
   `test-helmet-animation` is green.
2. **Register the App ID** at developer.apple.com → Identifiers:
   `com.quarterdropgames.acornaut`, capabilities Game Center + In-App
   Purchase. Team ID `7DH55F49XW` is already in the config.
3. **Create the app record** in App Store Connect → copy the Apple ID
   number into `ios.appStoreConnectAppId`.
4. **Four consumables** in App Store Connect → In-App Purchases, tiers
   $0.49 / $2.49 / $4.99 / $9.99, ids e.g. `acornaut.dust.100` … `2600` →
   `products.*`.
5. **Three leaderboards** in Game Center: `acornaut.normal` (high to low),
   `acornaut.hyper` (**low to high, elapsed time** — it is posted finish
   ticks), `acornaut.spill` (high to low) → `leaderboards.*`.
6. **RevenueCat**: add the iOS app to the project you created, paste the
   `.p8` / Key ID / Issuer ID it asks for, copy the public SDK key →
   `revenuecat.iosApiKey`.
7. `npm run configure`, then **a Mac with Xcode**: build, run on a phone,
   upload to TestFlight.

Android (`playGamesProjectId`, `androidApiKey`, the same product and board
ids in Play Console) can trail iOS by weeks; the config accepts it later.

## P1 — code before the store build (one PR, about half a day)

Small, review-facing, and all verified still open in source today.

| # | What | Why before the store | Source |
| --- | --- | --- | --- |
| F45 | Level, reward and daily sheets have a max-height but no scroll; on a short viewport FLY / BACK / NICE fall off-screen | An App Review on an iPhone SE hits this on the first mission sheet | code audit, medium |
| F97 | Info.plist never sets a status bar style; iOS light mode paints a black clock over the dark hub | Visible in the first screenshot | code audit, `shell/configure.mjs` |
| F77 + §6.4 | Pause button is "II" with no accessible name and 40 px; seven controls under 44 pt | Cheap, and reviewers do check | code audit + prep audit |
| F50 | Daily receipt says "+30" / "25 streak bonus" on the day the Critter Pack replaced it and 5 dust was paid | Money copy that is wrong | code audit, medium |
| Intro encode | Ship one intro encode in the app, not both (`intro.mp4` 1.65 MB + `intro.webm` 2.0 MB), re-encoded at device resolution, HEVC if it halves it | 2 MB and a quality win; `OPEN_ISSUES.md` "Video encoding" | open issues |

Then the SHIPPING §5 device run on the TestFlight build: fresh install,
tutorial, a sandbox purchase, Restore Purchases, a board submit, kill and
relaunch with the save intact, airplane-mode boot.

## P2 — store listing (owner, parallel with P1)

- Screenshots for 6.7" and 6.1" (and 5.5" if Apple still asks), refreshed
  from the current hub, Star Chart, a flight, the shop.
- Description, keywords, support URL, privacy URL
  (`https://acornaut.app/privacy.html` is packaged and live).
- App Privacy answers: no accounts; RevenueCat sees purchase history and a
  device identifier, so declare Purchases + Identifiers "used for app
  functionality, not linked to you"; no tracking.
- Age rating questionnaire (no ads, no user content, cartoon violence none).
- Cloud saves stay out of v1 by decision ("simple version first"). Say so
  nowhere in the listing; the iCloud key-value adapter is a shell-only
  addition later if the numbers justify it (task #60).

## P3 — after v1 is in review

- The docs that lie (README row 32, PARITY.md header, ROADMAP F55/F17).
- The 53 low findings in the code audit §3, by file, as time allows.
- The prep audit's §5 unification (run end, gates, RNG) and §6 UI tokens.
- Landscape and desktop (the 21 Aug audit, whole).
- The Percy / Envoy / Patriot remaster (task #67) lands to beta first and
  rides whatever update is next; it does not hold v1.

## What is deliberately not on this list

- The Cinderforge fallback red: pre-existing, platform-specific, on an
  unchanged main.
- `test-flight-input`: not run, by instruction.
- The 4.5 MB of unreferenced art the prep audit found: already deleted
  (`verify-art.py` is the proof, 32 groups green).
