/**
 * THE NATIVE ADAPTER. Runs inside the app (Capacitor WebView) before the
 * game bundle, builds `window.__acornautPlatform` from the shell's plugins,
 * and only then imports the bundle. The game reads that object through
 * illustrated-src/game/platform.ts and never touches a plugin itself.
 *
 * Outside a native shell (a plain browser opening www/) it installs
 * nothing and just loads the bundle, so the same www/ folder is the web
 * page as well - one build, two homes.
 *
 * Bundled by build-web.mjs (esbuild) into www/shell/adapter.js.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Purchases, LOG_LEVEL, PRODUCT_CATEGORY } from "@revenuecat/purchases-capacitor";
import { App } from "@capacitor/app";
import { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents } from "@capacitor-community/admob";
import config from "./config.json";

const Boards = registerPlugin("Boards");

// set the moment the bundle is handed the page, so the failure path below
// can tell "never started" from "started and then threw"
let booted = false;

// resolved against the PAGE, not this module: the bundle sits beside
// index.html, this file sits under shell/
const bundleSrc = new URL(document.querySelector("script[data-bundle]")?.dataset.bundle || "./js/standalone.js", document.baseURI).href;

async function preloadStorage() {
  // Preferences is async; the game's save layer is synchronous. Load
  // every key once, serve reads from memory, write through in the
  // background. A first native boot also adopts anything localStorage
  // holds (a save carried over from a PWA install) so nobody starts over.
  const mem = new Map();
  const { keys } = await Preferences.keys();
  for (const key of keys) {
    const { value } = await Preferences.get({ key });
    if (value != null) mem.set(key, value);
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !mem.has(k)) { const v = localStorage.getItem(k); if (v != null) { mem.set(k, v); void Preferences.set({ key: k, value: v }); } }
    }
  } catch { /* no localStorage, nothing to adopt */ }
  return {
    get: (key) => mem.get(key) ?? null,
    set: (key, value) => { mem.set(key, value); void Preferences.set({ key, value }); },
    remove: (key) => { mem.delete(key); void Preferences.remove({ key }); },
  };
}

function storeOf(platformName) {
  // THE REAL-MONEY STORE IS A CONFIG SWITCH (9 Oct 2026). With "iap": false
  // in app.config.json the adapter neither configures RevenueCat nor hands
  // the game a store, whatever keys are filled in: the RevenueCat key went
  // in before the App Store products existed, and a key alone must not
  // start selling or phone home at launch.
  if (config.iap !== true) return null;
  const apiKey = platformName === "ios" ? config.revenuecat.iosApiKey : config.revenuecat.androidApiKey;
  const productIds = config.products;                       // game id -> store product id
  if (!apiKey || apiKey.startsWith("PLACEHOLDER")) return null;   // no store until the key is in
  const prices = new Map();                                  // store product id -> price string
  const products = new Map();                                // store product id -> StoreProduct
  const ready = (async () => {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey });
    const ids = Object.values(productIds).filter((id) => id && !id.startsWith("PLACEHOLDER"));
    if (!ids.length) return;
    // NON_SUBSCRIPTION, EXPLICITLY (audit, 8 Sep 2026). Android defaults the
    // fetch to SUBSCRIPTION, so every dust pack came back empty, every row
    // stayed priceless and disabled, and nothing could be sold on Google
    // Play at all. iOS ignores the field, so naming it costs nothing there.
    const res = await Purchases.getProducts({ productIdentifiers: ids, type: PRODUCT_CATEGORY.NON_SUBSCRIPTION });
    for (const p of res.products || []) { prices.set(p.identifier, p.priceString); products.set(p.identifier, p); }
  })().catch((e) => console.warn("[acornaut shell] store not ready:", e?.message || e));
  const storeId = (gameId) => productIds[gameId];
  /** the RevenueCat transaction id for the purchase just made, read from the
   *  same list pending() walks so the two can never disagree.
   *
   *  PurchasesStoreTransaction dates its rows with `purchaseDate`, an ISO
   *  8601 STRING - there is no millis field - so parse it, and treat an
   *  unparseable date as the oldest rather than sorting on NaN. */
  const rowsFor = (info, sid) => (info?.nonSubscriptionTransactions || []).filter((t) => t.productIdentifier === sid);
  const at = (t) => { const ms = Date.parse(t?.purchaseDate); return Number.isFinite(ms) ? ms : 0; };
  const newest = (rows) => rows.slice().sort((a, b) => at(b) - at(a))[0]?.transactionIdentifier || null;
  /** the id of a row this product did not already have. `seen` is the set
   *  taken BEFORE the purchase, so a repeat buy of the same pack cannot
   *  hand back the earlier receipt - which the game's ledger has already
   *  paid, and would therefore deliver nothing for. */
  const fresh = (info, sid, seen) => {
    const rows = rowsFor(info, sid);
    const unseen = rows.filter((t) => t.transactionIdentifier && !seen.has(t.transactionIdentifier));
    return newest(unseen.length ? unseen : (seen.size ? [] : rows));
  };
  async function knownIds(sid) {
    try { const { customerInfo } = await Purchases.getCustomerInfo(); return new Set(rowsFor(customerInfo, sid).map((t) => t.transactionIdentifier)); }
    catch { return new Set(); }
  }
  async function recallTransactionId(res, sid, seen) {
    const fromPurchase = fresh(res?.customerInfo, sid, seen);
    if (fromPurchase) return fromPurchase;
    try { const { customerInfo } = await Purchases.getCustomerInfo(); return fresh(customerInfo, sid, seen); }
    catch { return null; }
  }
  return {
    priceOf: (gameId) => prices.get(storeId(gameId)) ?? null,
    async buy(gameId) {
      await ready;
      const sid = storeId(gameId);
      const product = products.get(sid);
      if (!product) return { result: "unavailable" };
      const seen = await knownIds(sid);
      try {
        const res = await Purchases.purchaseStoreProduct({ product });
        // ONE ID SPACE, OR THE GRANT HAPPENS TWICE (audit, 8 Sep 2026).
        // The transaction id is what makes the grant idempotent
        // (engine.grantDust via takeReceipt) - but this used to return the
        // STORE's id while pending() reports RevenueCat's id for the very
        // same receipt, so the next resume paid the same purchase again.
        // Take the id from the same place pending() reads it, and if that
        // is somehow missing or still stale, re-ask once rather than
        // inventing a synthetic id that can never match. A purchase we
        // cannot name is reported as "failed": deliverPending() pays it on
        // the next boot or resume, whereas resolving "ok" with no id would
        // grant it unconditionally, and resolving "ok" with the PREVIOUS
        // receipt for the same pack would grant nothing at all.
        const id = await recallTransactionId(res, sid, seen);
        return id ? { result: "ok", transactionId: id } : { result: "failed" };
      } catch (e) {
        // the iOS plugin rejects with only a message and a code: PURCHASE_CANCELLED
        // is code 1; PAYMENT_PENDING (Ask to Buy) is code 11 and is paid by
        // deliverPending() once approved, so it is not a failure
        const code = String(e?.code ?? "");
        if (code === "11" || /pending/i.test(String(e?.message))) return { result: "pending" };
        return { result: e?.userCancelled || code === "1" || /cancel/i.test(String(e?.message)) ? "cancelled" : "failed" };
      }
    },
    async restore() { await ready; try { await Purchases.restorePurchases(); } catch (e) { console.warn("[acornaut shell] restore:", e?.message || e); } },
    // EVERY CONSUMABLE ON RECORD, as game ids. The game's receipt ledger
    // decides which are still unpaid, so this may list years of history.
    async pending() {
      await ready;
      const gameIdOf = new Map(Object.entries(productIds).map(([g, s]) => [s, g]));
      try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        return (customerInfo?.nonSubscriptionTransactions || [])
          .map((t) => ({ id: gameIdOf.get(t.productIdentifier), transactionId: t.transactionIdentifier }))
          .filter((p) => p.id && p.transactionId);
      } catch (e) { console.warn("[acornaut shell] pending:", e?.message || e); return []; }
    },
  };
}

function boardsOf() {
  const ids = config.leaderboards;                           // board id -> platform leaderboard id
  const live = (board) => { const id = ids[board]; return id && !id.startsWith("PLACEHOLDER") ? id : null; };
  if (!Object.keys(ids).some(live)) return null;             // no boards until an id is in
  let signedIn = false;
  const signIn = Boards.signIn().then((r) => { signedIn = !!r?.signedIn; }).catch(() => { signedIn = false; });
  return {
    submit(board, score) {
      const leaderboardId = live(board);
      if (!leaderboardId) return;
      // THE HYPER RUN BOARD TAKES HUNDREDTHS OF A SECOND (audit, 30 Sep 2026).
      // The game posts finish ticks at 60 Hz; Game Center's and Play's
      // elapsed-time formats read hundredths, so 5,760 ticks (1:36.000) is
      // posted as 9600, not shown as 57.60 s. The board is sorted low to high.
      const value = board === "hyper" ? Math.round(score * 100 / 60) : Math.round(score);
      void signIn.then(() => signedIn && Boards.submitScore({ leaderboardId, score: value })).catch(() => {});
    },
    show(board) {
      const leaderboardId = board ? live(board) : null;
      void signIn.then(() => Boards.showLeaderboard(leaderboardId ? { leaderboardId } : {})).catch(() => {});
    },
  };
}

/** ADS (13 Sep 2026, owner: "just ad revenue for now ... tying in ads").
 *  AdMob behind the bridge's `ads` member: one rewarded and one
 *  interstitial ad kept loaded, shown on request, reloaded after each.
 *  Non-personalised (npa) requests on top of whatever consent allows.
 *  With `admob.testing` the SDK runs in test mode and serves Google's demo
 *  units, so a TestFlight build shows test ads with no account.
 *
 *  CONSENT, IN THE PLUGIN'S ORDER (6 Oct 2026, static review of
 *  @capacitor-community/admob 8.1.0): `initialize` first, because the
 *  plugin's consent executor is wired up by it and the forms need the
 *  root view controller; then `requestConsentInfo`; then the consent form
 *  where it is REQUIRED and available. Every prepare and show is gated on
 *  the final `canRequestAds === true`. Anything that fails on that path
 *  disables ads for the session and the game boots regardless - a pilot
 *  never loses the screen to an ad problem. npa is not a substitute for
 *  consent, it is a request flag on top of it.
 *
 *  GENERATIONS. A privacy-options change (the game's Profile row, where
 *  UMP says the pilot must be able to reach it) invalidates every loaded
 *  ad at once and bumps a generation counter; a native prepare that was in
 *  flight for an older generation can finish but never marks an ad ready,
 *  and a newer generation's prepare waits in line behind it so two native
 *  requests never race for the same slot.
 *
 *  The game's `started` callback (it mutes itself while an ad is on
 *  screen) fires on the native Showed event, once, and is dropped on
 *  close or failure. The reward pays on the Rewarded event only, never on
 *  dismissal. Every promise here resolves. */
function adsOf(platformName) {
  const c = config.admob;
  if (!c) return null;
  const ios = platformName === "ios";
  const rewardedId = ios ? c.rewardedIos : c.rewardedAndroid;
  const interstitialId = ios ? c.interstitialIos : c.interstitialAndroid;
  if (!rewardedId && !interstitialId) return null;
  const testing = c.testing !== false;
  const opts = (adId) => ({ adId, isTesting: testing, npa: true });
  const warn = (what, e) => console.warn(`[acornaut shell] ${what}:`, e?.message || e);

  // consent state: `allowed` is the final canRequestAds of the current
  // generation; nothing is prepared or shown without it
  let generation = 0;
  let allowed = false;
  let privacyRequired = false;
  let rewardedLoaded = false, interstitialLoaded = false;
  const invalidate = () => { generation++; allowed = false; rewardedLoaded = false; interstitialLoaded = false; };
  const applyInfo = (info) => {
    invalidate();
    allowed = info?.canRequestAds === true;
    privacyRequired = info?.privacyOptionsRequirementStatus === "REQUIRED";
  };
  const disable = (what, e) => { invalidate(); if (e !== undefined) warn(what, e); };

  // per-show callbacks and the close latches the listeners flip
  let rewardedStarted = null, interstitialStarted = null;
  let rewardedEarned = false, rewardedClosed = null, interstitialClosed = null;

  // native prepares, one queue per slot: a newer generation's request waits
  // for an older one to finish, and an older one's result is dropped
  const queue = { rewarded: Promise.resolve(), interstitial: Promise.resolve() };
  const prepare = (which) => {
    const gen = generation;
    const id = which === "rewarded" ? rewardedId : interstitialId;
    if (!id || !allowed) return Promise.resolve();
    const run = async () => {
      if (gen !== generation || !allowed) return;        // superseded while queued
      try {
        if (which === "rewarded") await AdMob.prepareRewardVideoAd(opts(id));
        else await AdMob.prepareInterstitial(opts(id));
        if (gen !== generation) return;                   // an older generation's ad: never ready
        if (which === "rewarded") rewardedLoaded = true; else interstitialLoaded = true;
      } catch (e) { if (gen === generation) warn(`${which} ad`, e); }
    };
    queue[which] = queue[which].then(run, run);
    return queue[which];
  };
  const reload = () => Promise.all([prepare("rewarded"), prepare("interstitial")]);

  const setup = (async () => {
    try {
      await AdMob.initialize({ initializeForTesting: testing });
      // one listener set for the life of the app, awaited so a listener the
      // plugin refuses disables ads rather than leaving a show with no close
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewardedEarned = true; });
      await AdMob.addListener(RewardAdPluginEvents.Showed, () => { const fn = rewardedStarted; rewardedStarted = null; fn?.(); });
      await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => { rewardedStarted = null; rewardedClosed?.(); });
      await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => { rewardedStarted = null; rewardedClosed?.(); });
      await AdMob.addListener(InterstitialAdPluginEvents.Showed, () => { const fn = interstitialStarted; interstitialStarted = null; fn?.(); });
      await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => { interstitialStarted = null; interstitialClosed?.(); });
      await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => { interstitialStarted = null; interstitialClosed?.(); });
      let info = await AdMob.requestConsentInfo({});
      if (info?.status === "REQUIRED") {
        if (!info.isConsentFormAvailable) { disable("ad consent", "a consent form is required but none is available"); return; }
        info = await AdMob.showConsentForm();
      }
      applyInfo(info);
      // not awaited: setup is "consent settled", and a show must not wait
      // behind a native prepare that is still in flight
      if (allowed) void reload();
    } catch (e) { disable("ads", e); }
  })();

  // a show that never reports back (a lost activity, a webview reload)
  // still lets the game go on after a while
  const closes = (set, ms) => new Promise((resolve) => { const t = setTimeout(resolve, ms); set(() => { clearTimeout(t); resolve(); }); });
  return {
    rewardedReady: () => allowed && rewardedLoaded,
    async rewarded(_placement, started) {
      await setup;
      if (!allowed) return "unavailable";
      if (!rewardedLoaded) { await prepare("rewarded"); if (!rewardedLoaded) return "unavailable"; }
      rewardedLoaded = false; rewardedEarned = false; rewardedStarted = started || null;
      const closed = closes((fn) => { rewardedClosed = fn; }, 120000);
      try { await AdMob.showRewardVideoAd(); }
      catch (e) { rewardedStarted = null; rewardedClosed = null; warn("rewarded show", e); void prepare("rewarded"); return "unavailable"; }
      await closed; rewardedClosed = null; rewardedStarted = null;
      void prepare("rewarded");
      return rewardedEarned ? "earned" : "dismissed";
    },
    interstitialReady: () => allowed && interstitialLoaded,
    async interstitial(_placement, started) {
      await setup;
      if (!allowed || !interstitialLoaded) return;
      interstitialLoaded = false; interstitialStarted = started || null;
      const closed = closes((fn) => { interstitialClosed = fn; }, 90000);
      try { await AdMob.showInterstitial(); }
      catch (e) { interstitialStarted = null; interstitialClosed = null; warn("interstitial show", e); void prepare("interstitial"); return; }
      await closed; interstitialClosed = null; interstitialStarted = null;
      void prepare("interstitial");
    },
    /** UMP says the pilot must be able to change their privacy choice */
    privacyOptionsRequired: () => privacyRequired,
    /** show the privacy options form, then refresh consent: every loaded ad
     *  is dropped first, and reloaded only if the fresh answer allows it */
    async showPrivacyOptionsForm() {
      await setup;
      if (!privacyRequired) return "unavailable";
      invalidate();
      try {
        await AdMob.showPrivacyOptionsForm();
        applyInfo(await AdMob.requestConsentInfo({}));
        if (allowed) void reload();
        return "updated";
      } catch (e) { disable("privacy options", e); return "unavailable"; }
    },
  };
}

async function boot() {
  if (Capacitor.isNativePlatform()) {
    const platformName = Capacitor.getPlatform();           // "ios" | "android"
    // the bundle reads this once, at module init (catalog.ts IAP_LIVE), so it
    // has to be on window before the import below; the same flag gates
    // storeOf, so the game never sees a live store without an adapter
    window.__ACORNAUT_IAP__ = config.iap === true;
    const storage = await preloadStorage();
    const adapter = { kind: platformName, storage, devDoors: false };
    const store = storeOf(platformName);
    if (store) adapter.store = store;
    const boards = boardsOf();
    if (boards) adapter.boards = boards;
    const ads = adsOf(platformName);
    if (ads) adapter.ads = ads;
    window.__acornautPlatform = adapter;
    // Android's hardware back button: the game has its own back arrows;
    // the system button should never kill the app mid-run
    App.addListener("backButton", () => {
      const back = document.querySelector(".ac-backbtn");
      // on the hub there is no back arrow: the system button backgrounds the
      // app, as Android expects, instead of doing nothing (audit, 30 Sep 2026)
      if (back) back.click(); else void App.minimizeApp().catch(() => {});
    });
  }
  const m = await import(bundleSrc);
  booted = true;
  m.bootStandalone(document.getElementById("app"));
}

boot().catch(async (e) => {
  console.error("[acornaut shell] boot failed", e);
  // A FAILED BOOT IS STILL THE NATIVE BUILD (audit, 8 Sep 2026). This path
  // used to load the bundle with nothing on window.__acornautPlatform, so
  // platform.ts read the kind as "web" and handed a store build
  // `devDoors: !native` - true. One rejection from Preferences at launch
  // (line 31-33) was enough to put the access-code row in the Shop and the
  // catalog's USD stickers on the dust rows of a shipped app, with nothing
  // on screen to say so. Install the smallest honest adapter first: the
  // real platform kind with the dev doors shut. Storage falls back to
  // localStorage, which the next good boot adopts into Preferences, so
  // this costs the player nothing but the store and the boards.
  if (Capacitor.isNativePlatform() && !window.__acornautPlatform) {
    window.__acornautPlatform = { kind: Capacitor.getPlatform(), devDoors: false };
  }
  // and if the game was already on the page when it threw, leave it there -
  // a second bootStandalone would stack a second game on top of the first
  if (booted) return;
  const m = await import(bundleSrc);
  booted = true;
  m.bootStandalone(document.getElementById("app"));
});
