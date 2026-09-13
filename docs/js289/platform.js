/**
 * THE PLATFORM BRIDGE. Everything the game needs from the world outside
 * its own bundle goes through this one object: where the save is kept,
 * whether real money can be taken and at what price, where a score is
 * sent, and which doors are a shell's to open. The web build answers all
 * of it with localStorage and "not available"; a native shell (Capacitor
 * on iOS today, a Steam shell later) hands in an adapter on
 * `window.__acornautPlatform` BEFORE the bundle loads and the bridge
 * adopts it. Nothing in the game imports a store SDK, a Game Center SDK
 * or a Steamworks binding - the shell owns those, the game owns this
 * contract. See SHIPPING.md, "The platform bridge".
 *
 * This file imports nothing from the game, so catalog.ts and save.ts can
 * read it without a cycle.
 */
const memory = new Map();
/** localStorage when the browser allows it, an in-memory map when it does
 *  not (private mode, restricted storage) so the game still runs */
const webStorage = {
    get(key) { try {
        return localStorage.getItem(key);
    }
    catch {
        return memory.get(key) ?? null;
    } },
    set(key, value) { try {
        localStorage.setItem(key, value);
    }
    catch {
        memory.set(key, value);
    } },
    remove(key) { try {
        localStorage.removeItem(key);
    }
    catch {
        memory.delete(key);
    } },
};
function adapterOf() {
    if (typeof window === "undefined")
        return null;
    const a = window.__acornautPlatform;
    return a && typeof a === "object" ? a : null;
}
/** THE BETA'S STAND-IN ADS. The beta page has no ad SDK, but the crash
 *  sheet's ad continue, the shop's ad dust and the interstitial cadence
 *  all have to be flown before a shell exists. On the beta page (and only
 *  there) a pretend ad "plays" for a moment and pays out, so every ad
 *  flow is exercisable; the web page offers no ads at all. */
function betaAds() {
    if (typeof window === "undefined")
        return undefined;
    if (window.__ACORNAUT_BETA__ !== true)
        return undefined;
    const play = (ms) => new Promise((r) => setTimeout(r, ms));
    return {
        rewardedReady: () => true,
        rewarded: () => play(1200).then(() => "earned"),
        interstitialReady: () => true,
        interstitial: () => play(800),
    };
}
function build(a) {
    const kind = a?.kind ?? "web";
    const native = kind !== "web";
    const storage = a?.storage ?? webStorage;
    const store = a?.store;
    const boards = a?.boards;
    const ads = a?.ads ?? (a ? undefined : betaAds());
    return {
        kind,
        native,
        storage,
        storeReady: !!store,
        priceOf: (id) => store?.priceOf(id) ?? null,
        buyDust: (id) => store
            ? store.buy(id).then((r) => typeof r === "string" ? { result: r } : r)
            : Promise.resolve({ result: "unavailable" }),
        restorePurchases: () => store ? store.restore() : Promise.resolve(),
        pendingPurchases: () => store?.pending ? store.pending().catch(() => []) : Promise.resolve([]),
        boardsReady: !!boards,
        submitScore: (board, score) => { try {
            boards?.submit(board, score);
        }
        catch { /* a board that is down never costs a run */ } },
        showBoards: (board) => boards?.show(board),
        adsReady: !!ads,
        rewardedAdReady: () => { try {
            return !!ads?.rewardedReady();
        }
        catch {
            return false;
        } },
        showRewardedAd: (placement) => ads
            ? ads.rewarded(placement).catch(() => "unavailable")
            : Promise.resolve("unavailable"),
        interstitialAdReady: () => { try {
            return !!ads?.interstitialReady();
        }
        catch {
            return false;
        } },
        // an ad that throws or hangs must never hold the game: a shell resolves
        // on close, and a failure resolves too
        showInterstitialAd: (placement) => ads ? ads.interstitial(placement).catch(() => undefined) : Promise.resolve(),
        devDoors: a?.devDoors ?? !native,
    };
}
export const platform = build(adapterOf());
