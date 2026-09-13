# The Acornaut shell

This folder wraps the finished web game (`../docs`, the production page)
in a native app for the **App Store** and **Google Play**. The game does
not know it is in an app: it talks to `window.__acornautPlatform`, which
`adapter/adapter.js` builds from the shell's plugins before the bundle
loads. See `../SHIPPING.md` for the contract.

Nothing here changes how acornaut.app or the beta page work. The beta stays
the loose sandbox; the shell packages **production only**.

## What is done, and what is waiting on accounts

Done, and runs anywhere:

- Capacitor project for iOS (Swift Package Manager, no CocoaPods) and Android.
- `app.config.json`: every store-issued value in one file, all placeholders.
- `npm run configure`: stamps that file into both native projects
  (bundle id, team, versions, portrait-only, iPhone-only, Game Center
  entitlement, Play Games app id, the leaderboard plugins).
- `npm run web`: copies production into `www/` without the beta, the lab,
  the archived pages or old js stamps, and routes the boot through the adapter.
- Local leaderboard plugins: Game Center (Swift) and Play Games Services (Java).
- RevenueCat for the dust packs on both stores, one API.

Waiting on you, in this order:

1. Apple Developer Program membership (the business Apple ID).
2. An app record in App Store Connect.
3. Product IDs for the four dust packs, and leaderboard IDs.
4. A RevenueCat project (free tier) pointed at those.
5. A Mac with Xcode to build, run on a phone, and upload to TestFlight.

`npm run check` prints exactly what is still missing.

## The store is off for v1

Owner, 13 Sep 2026: *"eliminate IAP, just ad revenue for now ... leave the
packs in, they just cost acorns ... 1000 acorn = 500 star dust."* The Star
Dust packs are bought with acorns in the game; nothing is sold for money.
`app.config.json` carries `"iap": false`, so `npm run check` does not ask for
the RevenueCat keys or the product ids, and App Store Connect needs no
in-app purchases for this build. To bring the store back: set `"iap": true`,
fill those values, and have the shell set `window.__ACORNAUT_IAP__ = true`
before the bundle loads (see `IAP_LIVE` in `game/catalog.ts`). There is no
ad SDK yet; that is its own project.

## The values, and where each one comes from

Everything goes in `app.config.json`. Replace the `PLACEHOLDER_…` text,
save, run `npm run configure`. Nothing else is edited by hand.

| Key | What it is | Where you get it |
|---|---|---|
| `appId` | The bundle identifier, reverse-DNS, e.g. `com.quarterdropgames.acornaut`. Permanent once an app is published. | You choose it, then register it: developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → + → App IDs. Tick **Game Center** and **In-App Purchase** in its capabilities. |
| `ios.teamId` | Ten-character team code. | developer.apple.com → Membership details. |
| `ios.appStoreConnectAppId` | The numeric Apple ID of the app record. | appstoreconnect.apple.com → My Apps → the app → App Information → General → Apple ID. |
| `android.packageName` | Android's name for the bundle id. Usually identical to `appId`. Permanent once uploaded to Play. | You choose it. |
| `android.playGamesProjectId` | The Play Games Services project number. | play.google.com/console → the app → Grow → Play Games Services → Setup and management → Configuration. |
| `revenuecat.iosApiKey` / `androidApiKey` | Public SDK keys, one per platform app. Safe to ship. | app.revenuecat.com → Project → Apps → each app → Public API key. |
| `products.dust-100` … `dust-2600` | Store product IDs for the four consumables, e.g. `acornaut.dust.100`. Use the same string on both stores. | App Store Connect → the app → In-App Purchases → + → Consumable. Play Console → Monetize → In-app products. |
| `leaderboards.fly` / `hyper` / `spill` | Leaderboard IDs, e.g. `acornaut.normal`. Same string on both stores. Leave the others empty unless you want them. | App Store Connect → the app → Game Center → Leaderboards. Play Console → Play Games Services → Leaderboards. |

## Apple, slowly

You do this once. Budget an afternoon for the accounts and a separate
afternoon on the Mac.

**A. The account (no Mac needed).**
1. Sign in at developer.apple.com with the business Apple ID and enrol in the
   Apple Developer Program (US $99/year). Individual or Organization: see the
   note in SHIPPING.md section 5; Organization needs the LLC and a D-U-N-S number.
2. When approved, open Membership details and copy the **Team ID** into
   `ios.teamId`.
3. Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App.
   Description "Acornaut", Bundle ID explicit, your `appId`. Capabilities: tick
   Game Center and In-App Purchase. Register.

**B. The app record (no Mac needed).**
1. appstoreconnect.apple.com → My Apps → + → New App. Platform iOS, name
   Acornaut, primary language, the bundle ID you registered, SKU `acornaut`.
2. App Information → copy the **Apple ID** number into `ios.appStoreConnectAppId`.
3. In-App Purchases → + → Consumable, four times. Reference name and product
   ID from the table (`acornaut.dust.100`, etc). Set a price tier and a
   display name each. The tiers are **$0.49 / $2.49 / $4.99 / $9.99** for
   dust-100 / 550 / 1200 / 2600 - halved on 12 Sep 2026 (owner: "anyone
   willing to pay should do it without it feeling expensive"); the strings in
   `DUST_PACKS` are only the web sticker, the store tier is the real price. They can sit in "Ready to Submit" until the app's first review.
4. Game Center → Leaderboards → + → Classic. ID `acornaut.normal`, score
   format integer, sort high to low. Repeat for `acornaut.hyper` and
   `acornaut.spill`. For a monthly board add a **Recurring** leaderboard with
   a one-month period beside each; Apple shows both in the same sheet.
5. Agreements, Tax, and Banking: accept the Paid Apps agreement and fill in
   banking and tax. Purchases do not work in TestFlight until this is done.
6. Users and Access → Sandbox → Testers → + . Make two testers with fresh
   email addresses. These are the accounts you buy with during testing.

**C. RevenueCat (no Mac needed).**
1. app.revenuecat.com → new project "Acornaut" → add an App Store app. It
   asks for the bundle ID and an App Store Connect **In-App Purchase Key**
   (App Store Connect → Users and Access → Integrations → In-App Purchase →
   generate; download the .p8 once and upload it to RevenueCat).
2. Copy the app's **Public API key** into `revenuecat.iosApiKey`.
3. Products → import the four product IDs. Entitlements and offerings are not
   needed; the adapter buys products directly.

**D. Build and TestFlight (the Mac).**
1. Install Xcode from the App Store and open it once so it installs its tools.
2. Clone this repo, then in a terminal: `cd shell && npm install && npm run ios`.
   That builds `www`, syncs it into the iOS project and opens Xcode.
3. In Xcode select the **App** target → Signing & Capabilities. Tick
   "Automatically manage signing" and pick your team. Xcode creates the
   provisioning profile itself. The Game Center and In-App Purchase
   capabilities should already be listed; add them with + if not.
4. Plug in your iPhone, choose it as the run destination, press Run. The first
   time, the phone asks you to trust the developer certificate under
   Settings → General → VPN & Device Management.
5. To reach TestFlight: Product → Archive. When the Organizer opens, Distribute
   App → App Store Connect → Upload. Fifteen minutes later the build appears
   under TestFlight in App Store Connect; add yourself as an internal tester
   and install the TestFlight app on the phone.
6. Each new upload needs a higher `buildNumber` in `app.config.json`, then
   `npm run configure`, then archive again.

## Google Play, slowly

1. play.google.com/console → create a developer account (one-time US $25).
   Identity verification can take a few days.
2. Create app → Acornaut, game, free with in-app purchases. Complete the
   dashboard's setup tasks (content rating questionnaire, target audience,
   data safety: "no data collected" is true today, privacy policy URL).
3. Monetize → Products → In-app products → create the four consumables with
   the same product IDs. Monetize → Monetization setup is where the Play
   Billing key lives; RevenueCat asks for the service-account JSON from
   Google Cloud instead (their docs walk it through).
4. Grow → Play Games Services → Setup and management → Configuration →
   create a new Play Games Services project, link it to the app. Copy the
   project number into `android.playGamesProjectId`. Add the three
   leaderboards with the same IDs. Add the SHA-1 of your upload key and of
   your debug key under Credentials (Android Studio → Gradle → signingReport).
5. RevenueCat → add a Play Store app, paste the public key into
   `revenuecat.androidApiKey`.
6. Build: `npm run android` opens Android Studio. Build → Generate Signed
   Bundle → AAB, with an upload key you create once and keep safe. Upload to
   Internal testing first.

## Every day after that

- Change the game under `../illustrated-src`, export as usual, merge.
- `cd shell && npm run sync` refreshes `www` and both native projects.
- Bump `buildNumber` (and `marketingVersion` when the game version changes),
  `npm run configure`, archive, upload.

## What cannot be checked here

The adapter, the Swift and Java plugins and the project stamping were
written against the current plugin APIs and Capacitor 8 docs, and the
`www` build boots in a browser. The first compile of the native projects
happens on your Mac. If Xcode or Android Studio complains, the error names
one of these files; send it over and it is a small fix.
