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
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
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
    const res = await Purchases.getProducts({ productIdentifiers: ids });
    for (const p of res.products || []) { prices.set(p.identifier, p.priceString); products.set(p.identifier, p); }
  })().catch((e) => console.warn("[acornaut shell] store not ready:", e?.message || e));
  const storeId = (gameId) => productIds[gameId];
  return {
    priceOf: (gameId) => prices.get(storeId(gameId)) ?? null,
    async buy(gameId) {
      await ready;
      const product = products.get(storeId(gameId));
      if (!product) return { result: "unavailable" };
      try {
        const res = await Purchases.purchaseStoreProduct({ product });
        // the transaction id is what makes the grant idempotent (engine.grantDust)
        return { result: "ok", transactionId: res?.transaction?.transactionIdentifier || `${res?.productIdentifier || storeId(gameId)}:${Date.now()}` };
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
