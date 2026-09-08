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
import config from "./config.json";

const Boards = registerPlugin("Boards");

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
   *  same list pending() walks so the two can never disagree */
  const newestOf = (info, sid) => (info?.nonSubscriptionTransactions || [])
    .filter((t) => t.productIdentifier === sid)
    .sort((a, b) => (b.purchaseDateMillis || 0) - (a.purchaseDateMillis || 0))[0]?.transactionIdentifier || null;
  async function recallTransactionId(res, sid) {
    const fromPurchase = newestOf(res?.customerInfo, sid);
    if (fromPurchase) return fromPurchase;
    try { const { customerInfo } = await Purchases.getCustomerInfo(); return newestOf(customerInfo, sid); }
    catch { return null; }
  }
  return {
    priceOf: (gameId) => prices.get(storeId(gameId)) ?? null,
    async buy(gameId) {
      await ready;
      const product = products.get(storeId(gameId));
      if (!product) return { result: "unavailable" };
      try {
        const res = await Purchases.purchaseStoreProduct({ product });
        // ONE ID SPACE, OR THE GRANT HAPPENS TWICE (audit, 8 Sep 2026).
        // The transaction id is what makes the grant idempotent
        // (engine.grantDust via takeReceipt) - but this used to return the
        // STORE's id while pending() reports RevenueCat's id for the very
        // same receipt, so the next resume paid the same purchase again.
        // Take the id from the same place pending() reads it, and if that
        // is somehow missing, re-ask once rather than inventing a synthetic
        // id that can never match. A purchase we cannot name is reported as
        // "failed": deliverPending() will pay it on the next boot, whereas
        // resolving "ok" with no id would grant it unconditionally.
        const id = await recallTransactionId(res, storeId(gameId));
        return id ? { result: "ok", transactionId: id } : { result: "failed" };
      } catch (e) {
        return { result: e?.userCancelled || /cancel/i.test(String(e?.message)) ? "cancelled" : "failed" };
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
      void signIn.then(() => signedIn && Boards.submitScore({ leaderboardId, score: Math.round(score) })).catch(() => {});
    },
    show(board) {
      const leaderboardId = board ? live(board) : null;
      void signIn.then(() => Boards.showLeaderboard(leaderboardId ? { leaderboardId } : {})).catch(() => {});
    },
  };
}

async function boot() {
  if (Capacitor.isNativePlatform()) {
    const platformName = Capacitor.getPlatform();           // "ios" | "android"
    const storage = await preloadStorage();
    const adapter = { kind: platformName, storage, devDoors: false };
    const store = storeOf(platformName);
    if (store) adapter.store = store;
    const boards = boardsOf();
    if (boards) adapter.boards = boards;
    window.__acornautPlatform = adapter;
    // Android's hardware back button: the game has its own back arrows;
    // the system button should never kill the app mid-run
    App.addListener("backButton", () => { document.querySelector(".ac-backbtn")?.click(); });
  }
  const m = await import(bundleSrc);
  m.bootStandalone(document.getElementById("app"));
}

boot().catch(async (e) => {
  console.error("[acornaut shell] boot failed", e);
  const m = await import(bundleSrc);
  m.bootStandalone(document.getElementById("app"));
});
