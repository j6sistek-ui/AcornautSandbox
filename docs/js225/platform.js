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
function build(a) {
    const kind = a?.kind ?? "web";
    const native = kind !== "web";
    const storage = a?.storage ?? webStorage;
    const store = a?.store;
    const boards = a?.boards;
    return {
        kind,
        native,
        storage,
        storeReady: !!store,
        priceOf: (id) => store?.priceOf(id) ?? null,
        buyDust: (id) => store ? store.buy(id) : Promise.resolve("unavailable"),
        restorePurchases: () => store ? store.restore() : Promise.resolve(),
        boardsReady: !!boards,
        submitScore: (board, score) => { try {
            boards?.submit(board, score);
        }
        catch { /* a board that is down never costs a run */ } },
        showBoards: (board) => boards?.show(board),
        devDoors: a?.devDoors ?? !native,
    };
}
export const platform = build(adapterOf());
