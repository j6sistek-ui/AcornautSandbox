// WHAT IS STILL MISSING before a store build. Prints every placeholder,
// where it comes from, and whether the native projects are stamped.
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(here, "app.config.json"), "utf8"));
const unset = (v) => !v || String(v).startsWith("PLACEHOLDER");
const rows = [
  ["appId", cfg.appId, "Apple Developer → Identifiers → App IDs (reverse-DNS, e.g. com.quarterdropgames.acornaut)"],
  ["ios.teamId", cfg.ios?.teamId, "Apple Developer → Membership details → Team ID"],
  ["ios.appStoreConnectAppId", cfg.ios?.appStoreConnectAppId, "App Store Connect → the app → App Information → Apple ID"],
  ["android.packageName", cfg.android?.packageName, "your choice, usually the same as appId; fixed forever once uploaded to Play"],
  ["android.playGamesProjectId", cfg.android?.playGamesProjectId, "Play Console → Play Games Services → Configuration → Project ID"],
  // THE REAL-MONEY STORE IS OFF (owner, 13 Sep 2026: "eliminate IAP, just
  // ad revenue for now ... leave the packs in, they just cost acorns"). With
  // "iap": false the RevenueCat keys and the product ids are not required;
  // flip it to true when the store comes back.
  ...(cfg.iap === false ? [] : [
  ["revenuecat.iosApiKey", cfg.revenuecat?.iosApiKey, "RevenueCat → Project → Apps → the iOS app → Public API key"],
  ["revenuecat.androidApiKey", cfg.revenuecat?.androidApiKey, "RevenueCat → Project → Apps → the Android app → Public API key"],
  ...Object.entries(cfg.products).map(([k, v]) => [`products.${k}`, v, "App Store Connect → In-App Purchases (consumable) → Product ID; same ID in Play Console → In-app products"]),
  // The hyper board is scored on TIME, so it is the one board that must be
  // sorted the other way: the game posts finish ticks (sim.ts), and a board
  // left on the default sort would crown the slowest pilot.
  ]),
  // ADS (13 Sep 2026, "just ad revenue for now"). Google's public test ids
  // ship in the config so a TestFlight build shows test ads with no account;
  // the real AdMob app and unit ids are required once "testing" is false.
  ...(cfg.admob?.testing === false ? ["iosAppId", "androidAppId", "rewardedIos", "rewardedAndroid", "interstitialIos", "interstitialAndroid"]
    .map((k) => [`admob.${k}`, cfg.admob?.[k] && !String(cfg.admob[k]).startsWith("ca-app-pub-3940256099942544") ? cfg.admob[k] : "",
      "AdMob → Apps → the app → App ID (~) / Ad units → the unit id (/); test ids do not count once testing is off"]) : []),
  ...Object.entries(cfg.leaderboards).filter(([, v]) => v !== "").map(([k, v]) => [`leaderboards.${k}`, v,
    "App Store Connect → Game Center → Leaderboards → Leaderboard ID; Play Console → Play Games Services → Leaderboards → ID"
    + (k === "hyper" ? "  ** sort LOW TO HIGH, format elapsed time: this board is posted finish ticks **" : "")]),
];
let missing = 0;
for (const [k, v, from] of rows) { const ok = !unset(v); if (!ok) missing++; console.log(`${ok ? "  set    " : "  MISSING"} ${k.padEnd(28)} ${ok ? "" : "← " + from}`); }
console.log(`\n${missing} value(s) still to fill in app.config.json, then \`npm run configure\`.`);
if (cfg.admob?.testing !== false) console.log("ads:            TEST ads (admob.testing is true) - set it to false and fill admob.* before the store build");
const pb = join(here, "ios", "App", "App.xcodeproj", "project.pbxproj");
// "STAMPED" MUST MEAN THE PLUGIN IS REACHABLE (audit, 8 Sep 2026). The pbxproj
// alone only proves BoardsPlugin compiles. The window SceneDelegate builds is
// the one the player talks to, and while that was rooted in the stock
// CAPBridgeViewController this line said "stamped" over a build whose every
// Game Center call rejected. Ask for both.
const sd = join(here, "ios", "App", "App", "SceneDelegate.swift");
const iosStamped = () => readFileSync(pb, "utf8").includes("BoardsPlugin.swift in Sources")
  && existsSync(sd) && readFileSync(sd, "utf8").includes("rootViewController = AcornautViewController()");
console.log("ios project:    " + (existsSync(pb) ? (iosStamped() ? "stamped" : "present, not configured") : "missing"));
const gr = join(here, "android", "app", "build.gradle");
console.log("android project:" + (existsSync(gr) ? (readFileSync(gr, "utf8").includes("play-services-games") ? " stamped" : " present, not configured") : " missing"));
console.log("www:            " + (existsSync(join(here, "www", "shell", "adapter.js")) ? "built" : "not built (npm run web)"));
