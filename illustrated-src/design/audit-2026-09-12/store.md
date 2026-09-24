# Store readiness audit — App Store / Google Play (agent report, 12 Sep 2026, main 6f85ca0)

## A. Verdict table

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1a | Bundle id / application id / Team ID consistent | PASS | `shell/app.config.json:4` appId com.quarterdropgames.acornaut, `:8` teamId 7DH55F49XW, `:12` packageName same; pbxproj:322,345 / :311,335; android build.gradle:4,7; capacitor.config.json:4. |
| 1b | Versions consistent | PASS (by hand) | catalog.ts:19 GAME_VERSION "V1.0.0"; app.config.json:5-6 marketingVersion 1.0.0 buildNumber 1; pbxproj MARKETING_VERSION 1.0.0 / CURRENT_PROJECT_VERSION 1; build.gradle versionCode 1 versionName 1.0.0. package.json and shell/package.json 1.0.12 and DEV_STAMP 1.0.12.<ART_VER> are dev labels only; catalog.ts:86-89 drops them when platform.native. |
| 1c | Version parity enforced by tooling | FAIL | configure.mjs:17-18 reads only app.config.json; check.mjs never opens catalog.ts. |
| 1d | node shell/check.mjs | OWNER-ONLY | 11 MISSING: ios.appStoreConnectAppId, android.playGamesProjectId, revenuecat.iosApiKey, revenuecat.androidApiKey, products.dust-100/550/1200/2600, leaderboards.fly/hyper/spill. ios/android projects stamped; www not built. |
| 2a | Payload contents | PASS | build-web.mjs:26 SKIP beta, lab, index.html; :29 drops every js<N> except live stamp; :31 filters intro-wide/film-backdrop-wide. www = CNAME apple-touch-icon.png art fonts icon-*.png icon.svg index.html js js286 manifest.webmanifest privacy.html shell. Leftovers: www/js unstamped copy (2 MB), both art/intro.mp4 (1.65 MB) and art/intro.webm (2.0 MB), CNAME, manifest.webmanifest. |
| 2b | Payload size | PASS | "www built from docs (stamp 286): 141 MB"; du apparent 142 MB; art/ 140 MB; largest file art/music/cosmos.m4a 4.86 MB. ~58 MB under the 200 MB cellular threshold. |
| 3a | Product ids catalog/adapter/README | PASS | catalog.ts:976-980 dust-100/550/1200/2600 at $0.49/$2.49/$4.99/$9.99; app.config.json:20-23; adapter.js:55,71; shell/README.md. |
| 3b | Consumables: pending()/restore()/one grant per receipt | PASS | adapter.js:122-123, :131-140; engine.ts:1131-1137 grantDust via takeReceipt; :1177-1186 deliverPending at boot :1806 and on visibilitychange :1814; :1188-1190 restore; save.ts:312 RECEIPT_KEY separate slot. |
| 3c | Restore Purchases visible on iOS | PASS (conditional) | standalone.ts:4069-4073 when platform.storeReady; storeReady only with a RevenueCat key (adapter.js:56 null on PLACEHOLDER). With placeholders a native build has no store: rows show "…" disabled (standalone.ts:4051-4056) and footnote "Star Dust packs are sold in the app." (:4080-4082) inside the app. |
| 3d | No hard-coded USD on native | PASS | standalone.ts:4054 price ?? (platform.native ? "…" : dp.price); :4056 disabled until priced. |
| 3e | IS_BETA impossible on native | PASS | catalog.ts:37-40. |
| 3f | Access codes gated | PASS | engine.ts:338; standalone.ts:4076; adapter.js:167,195 devDoors false; platform.ts:115 default !native. |
| 3g | No URL/global escape hatches | PASS | no location.search/hash/URLSearchParams in game/*.ts; globals __ACORNAUT_ART__ (art root), __ACORNAUT_BETA__ (neutralised), __acornautPose (read-only, gated dock). bridge test: 53 files clean. |
| 4a | External links via a bridge member | FAIL (works by accident, one link broken) | No openExternal member (platform.ts:34-60). standalone.ts:4600-4602 Discord, :4612-4614 X, :4628 mailto, :4667-4669 privacy.html all target=_blank. Capacitor 8.5.1: iOS createWebViewWith -> UIApplication.open; Android navigates in place then external host -> ACTION_VIEW. privacy.html: iOS opens capacitor://localhost/privacy.html with no handler (tap does nothing); Android loads it in the WebView replacing the game, hardware back (adapter.js:175 clicks .ac-backbtn) finds nothing -> stranded. |
| 4b | No beta/alpha/test/crash wording on native | FAIL (one string) | standalone.ts:4618 "Patch notes, new art, and the occasional crash." reachable on native. Others gated (:1841 Test Lab, :3319 STAR_MAP_PREVIEW, :4538 BETA PILOT, BUILD "Alpha" only !native). |
| 4c | Prototype doors hidden when devDoors false | PASS except cycle inspector | drawCycleRoll :4272-4287 "OFF THE SHELF TODAY" appended to the shop unconditionally at :4090. |
| 4d | Privacy policy matches behaviour | FAIL (content) | docs/privacy.html says "no third-party services", "loads no ... from anyone else's servers", "Leaderboards — Not yet active ... Nothing is submitted anywhere", "gear button ... Start Over". App build: adapter.js:60-61 Purchases.configure (RevenueCat: receipts, anonymous app-user id, device identifiers); boards live once ids filled (sim.ts:3594,3741, engine.ts:1675); Start Over is on Profile (standalone.ts:4640-4652). No analytics: true. |
| 4e | Leaderboard ids declared vs submitted | PASS | platform.ts:20 fly/deep/lost/arcade/tunnel/spill/hyper; app.config.json:25-31; adapter.js:146 drops empty ids; sim.ts:3741 endless, sim.ts:3594 hyper finishTicks (low-is-better, check.mjs:23-25), engine.ts:1675 spill waves. BoardsPlugin.swift:41, BoardsPlugin.java:58. |
| 4f | Android back button | PASS with gap | adapter.js:175 clicks .ac-backbtn; at the hub root there is none so Back does nothing; plus 4a trap. |
| 4g | Orientation lock / full screen | PASS | Info.plist:54-61 portrait only; :62-63 UIRequiresFullScreen; TARGETED_DEVICE_FAMILY = 1; AndroidManifest.xml:18 portrait. |
| 4h | Status bar style (F97) | FAIL (open) | No UIStatusBarStyle; UIViewControllerBasedStatusBarAppearance true; AcornautViewController overrides nothing; CAPBridgeViewController statusBarStyle .default -> black clock over #070b16. |
| 4i | Launch screen / splash present | PASS (present) | LaunchScreen.storyboard image Splash; styles.xml:18-20 @drawable/splash; 11 Android + 3 iOS splash PNGs. |
| 4j | App icons real, all sizes | FAIL | iOS AppIcon-512@2x.png md5 0ac741c9e1701ee14dd05ea131f7cfd8 = Capacitor ios-spm-template stock icon; Splash.imageset md5 958532b95c3e7d4997327dc977b80600 = template. Android: all 26 PNGs under app/src/main/res byte-identical to android-template; ic_launcher_background #FFFFFF. Source exists: art-src/app-icon-master.jpg. |
| 4k | No network at boot | PASS | docs/fonts/fonts.css self-hosted; build-web.mjs:50 warns if fonts missing; only fetch is art.ts:795 local transforms.json; RevenueCat/Play Games failures caught (adapter.js:70,139,149). |
| 4l | Audio interruption handling | PASS with gap | audio.ts:211-232 suspend/resume on visibilitychange/pagehide/pageshow. iOS leaves the context "interrupted" after a call; audio.ts:221 and :22 only resume when state === "suspended". |
| 4m | Safe-area insets | PASS | index.html:5 viewport-fit=cover; :37 --sat; ~25 rules use env(safe-area-inset-*); engine.ts:1325 reads --sat into world.insetTop; draw.ts:5773 translate. |
| 5a | SDK levels | PASS | variables.gradle minSdk 24, compileSdk 36, targetSdk 36; AGP 8.13.0; Gradle 8.14.3; Java 21. |
| 5b | Billing library | PASS | @revenuecat/purchases-capacitor 13.5.0 -> purchases-hybrid-common 18.33.1 -> purchases 10.19.1 -> billingclient 8.3.0. play-services-games-v2 20.1.2. |
| 5c | Signing config | OWNER-ONLY | app/build.gradle:19-24 release has no signingConfig; README says Android Studio "Generate Signed Bundle". |
| 5d | ProGuard | PASS | minifyEnabled false; empty template rules. |
| 5e | allowBackup / cleartext | PASS | allowBackup true (save + receipts backed up; acceptable); no cleartext; allowMixedContent false; androidScheme https. |
| 5f | Adaptive icon | PASS structure / FAIL art | mipmap-anydpi-v26 xml present; art is stock (4j). |
| 6a | Deployment target / Capacitor | PASS | IPHONEOS_DEPLOYMENT_TARGET 15.0; Package.swift .iOS(.v15), capacitor-swift-pm exact 8.5.1 = shell/package.json. |
| 6b | Plugins registered (F15) | PASS | Package.swift:14-17 App, Haptics, Preferences, RevenuecatPurchasesCapacitor; AcornautViewController.swift:9 registers BoardsPlugin; SceneDelegate.swift:22; native/ios/* identical to ios/App/App/*. Haptics linked but never called. |
| 6c | Info.plist keys | FAIL (one missing) | No ITSAppUsesNonExemptEncryption; no NSUserTrackingUsageDescription (correct); :50-53 UIRequiredDeviceCapabilities armv7 is template cruft. |
| 6d | StoreKit config for sandbox | FAIL | no *.storekit under shell/ios. |
| 6e | Entitlements | PASS | App.entitlements game-center true (configure.mjs:36-44); CODE_SIGN_ENTITLEMENTS set. |
| 6f | Debug xcconfig scope | PASS | debug.xcconfig on Debug configs only (pbxproj:198,307). |
| 7a | Dependency pins | PASS | exact @capacitor/* and RevenueCat; esbuild ^0.25.9 dev only; package-lock present; npm ci ok. |
| 7b | CI / Docker coverage of the shell | FAIL | only workflow deploy-site.yml; nothing runs npm run gates, shell npm run web, or check.mjs; Dockerfile copies root package.json only. |
| 7c | npm run configure idempotent | PASS | ran twice; diff -rq of ios/, android/, capacitor.config.json vs tracked -> no differences. |
| 8a | LICENSE | PASS | proprietary, all rights reserved. |
| 8b | Font licences | PASS | docs/fonts/OFL-Figtree.txt, OFL-Fraunces.txt, README; copied into www. |
| 8c | Music / third-party asset provenance | OWNER-ONLY | docs/art/music/{menu.mp3, flight.mp3, voyage.mp3, cosmos.m4a}; no credits/provenance file anywhere; added via PR #156 (443d613) without a note. No CC assets found. |

## B. Blockers

| # | What | Fix | Effort |
|---|---|---|---|
| B1 | Stock Capacitor icon and splash on both platforms (4j). Placeholder icons are a rejection (Apple 2.3.8/2.1; Play icon policy) and the Capacitor logo is not yours. | Generate from art-src/app-icon-master.jpg and a dark #070b16 splash plate: `cd shell && npx @capacitor/assets generate --iconBackgroundColor '#070b16' --splashBackgroundColor '#070b16'`; set ic_launcher_background to #070b16; commit; add an md5-vs-template check to check.mjs. | 1-2 h |
| B2 | Privacy policy link dead on iOS, a trap on Android (4a). Apple requires the policy reachable in-app. | Absolute https://acornaut.app/privacy.html href (both shells hand it to the system browser), or render the policy as an in-game sheet from www/privacy.html; make the Android back handler fall back to App.minimizeApp()/exitApp() when no .ac-backbtn exists. Consider an openExternal(url) bridge member so test-platform-bridge.mjs can enforce it. | 1 h |
| B3 | Privacy policy contradicts the app build (4d). App Store 5.1.1(i) and Play Data Safety require policy and labels to match. README step 2 tells the owner to declare "no data collected" on Play, which will be false. | Rewrite Purchases and Leaderboards sections (RevenueCat processes receipts and an anonymous app-user id / device identifier; boards via Game Center / Play Games); fix the Start Over location. App Privacy labels: Purchases + Identifiers (Device ID), not linked, not for tracking; Play Data Safety: purchase history + device IDs shared with RevenueCat. Update shell/README.md step 2. | 1 h + forms |

## C. Should fix before submission

1. F97 status bar: configure.mjs Info.plist block add UIStatusBarStyle = UIStatusBarStyleLightContent (and/or preferredStatusBarStyle override in AcornautViewController.swift). 10 min.
2. ITSAppUsesNonExemptEncryption false in Info.plist via configure.mjs (6c). 5 min.
3. Cycle inspector on the native shop (4c): wrap standalone.ts:4090 in `if (platform.devDoors)`. 5 min.
4. "the occasional crash" copy standalone.ts:4618. 2 min.
5. Native shop with no store key (3c): refuse to build www when revenuecat.* are placeholders, or give `platform.native && !storeReady` its own honest line. 15 min.
6. Audio "interrupted" state (4l): audio.ts:22 and :221 resume whenever ctx.state !== "running"; re-arm on next pointerdown. 10 min.
7. Version parity check (1c): check.mjs reads GAME_VERSION from catalog.ts and fails if "V"+marketingVersion differs; warn shell/package.json 1.0.12 != 1.0.0. 15 min.
8. CI/Docker coverage (7b): workflow or Dockerfile stage running npm run gates, then `cd shell && npm ci && node build-web.mjs && node check.mjs`, asserting www < 200 MB. 30 min.
9. Payload trims (2a): skip docs/js (unstamped duplicate, 2 MB), ship one intro film (drop intro.webm, 2 MB), skip CNAME/manifest.webmanifest. ~4 MB, 15 min.
10. Android Play Games init with APP_ID "0" (strings.xml:7, BoardsPlugin.java:26 PlayGamesSdk.initialize unconditional in load()): guard on the id not being "0"; verify on device. 10 min + device.
11. StoreKit configuration file (6d): App/Products.storekit with the four consumables once ids exist, referenced in the scheme. 20 min.
12. Cruft: Haptics plugin linked but unused (Package.swift:15, capacitor.build.gradle:13); capacitor.config.json:8 ios.scheme is not a Capacitor key (server.iosScheme is); Info.plist:50-53 armv7. 10 min.
13. adapter.js:32-33 comment claims a PWA save is adopted from localStorage; a WKWebView at capacitor://localhost never sees Safari's origin storage. Fix comment or drop the loop.

## D. Owner-only checklist

- Fill the 11 placeholders in shell/app.config.json, then npm run configure.
- App Store Connect: app record, four consumables at $0.49/$2.49/$4.99/$9.99, Game Center leaderboards fly and spill high-to-low integer, hyper low-to-high elapsed-time (check.mjs:23-25), Paid Apps agreement + banking/tax, two sandbox testers.
- RevenueCat project, IAP key upload, public SDK keys for both apps, Play service-account JSON.
- Play Console: app, four products, Play Games Services project id + leaderboards, upload-key and debug SHA-1, signing, Data Safety (purchase history + device IDs via RevenueCat, not "no data collected"), content rating, target audience, privacy URL.
- App Privacy labels on ASC (Purchases, Identifiers).
- Music rights: confirm ownership/licence of menu.mp3, flight.mp3, voyage.mp3, cosmos.m4a; add a credits file if any is third-party.
- Screenshots (6.9"/6.5" iPhone; Play phone set), age rating, category, support URL.
- First native compile on a Mac and SHIPPING §5 step 3 device pass.

## E. Still open from the earlier audits

- APP_STORE_PREP_AUDIT §1 #7: shell exists; 11 of 14 values still placeholders (Apple appId/teamId/packageName filled by 020d072).
- APP_STORE_PREP_AUDIT §2: cycle inspector OPEN (C3); external links partially (privacy link broken, B2); "occasional crash" OPEN (C4); IS_BETA derived FIXED; OFL FIXED; lab Google Fonts FIXED by SKIP; audio lifecycle FIXED (residual C6); hyper board FIXED (sim.ts:3594).
- CODE_AUDIT_2026-09: F2, F3, F14, F15, F52 verified fixed. F97 OPEN (C1).
- New: B1 stock icons/splash, B2 privacy link behaviour, B3 policy vs RevenueCat/boards, 1c/7b no enforcement or CI for the shell, 6c/6d Info.plist and StoreKit file.
