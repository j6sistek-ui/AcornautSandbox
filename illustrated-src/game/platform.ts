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

export type PlatformKind = "web" | "ios" | "android" | "steam";

/** the boards a run can post to - one per mode the shop of records shows */
export type BoardId = "fly" | "deep" | "lost" | "arcade" | "tunnel" | "spill" | "hyper";

export type BuyResult = "ok" | "cancelled" | "failed" | "unavailable";

/** WHAT A SHELL HANDS IN. Every member is optional: an adapter that says
 *  nothing about boards gets the web answer for boards. */
export type PlatformAdapter = {
  kind?: PlatformKind;
  /** synchronous key/value storage the shell keeps durable (the shell
   *  preloads it before the bundle runs, so reads never wait) */
  storage?: { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void };
  /** real-money store for the dust packs (catalog DUST_PACKS ids) */
  store?: {
    /** localized price string from the store, or null until it has answered */
    priceOf(id: string): string | null;
    /** completes the purchase; the GAME grants the dust on "ok" */
    buy(id: string): Promise<BuyResult>;
    /** Apple requires the button even when every product is consumable */
    restore(): Promise<void>;
  };
  boards?: {
    submit(board: BoardId, score: number): void;
    /** open the platform's own leaderboard UI (all-time, monthly, friends) */
    show(board?: BoardId): void;
  };
  /** the shell shows Rig Editor / Ship Bench / Wormhole doors? Default: web yes, shells no */
  devDoors?: boolean;
};

export type Platform = {
  kind: PlatformKind;
  native: boolean;
  storage: NonNullable<PlatformAdapter["storage"]>;
  /** true once a store adapter is present - the shop shows real prices,
   *  takes real money and offers Restore Purchases */
  storeReady: boolean;
  priceOf(id: string): string | null;
  buyDust(id: string): Promise<BuyResult>;
  restorePurchases(): Promise<void>;
  boardsReady: boolean;
  submitScore(board: BoardId, score: number): void;
  showBoards(board?: BoardId): void;
  devDoors: boolean;
};

const memory = new Map<string, string>();
/** localStorage when the browser allows it, an in-memory map when it does
 *  not (private mode, restricted storage) so the game still runs */
const webStorage: Platform["storage"] = {
  get(key) { try { return localStorage.getItem(key); } catch { return memory.get(key) ?? null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { memory.set(key, value); } },
  remove(key) { try { localStorage.removeItem(key); } catch { memory.delete(key); } },
};

function adapterOf(): PlatformAdapter | null {
  if (typeof window === "undefined") return null;
  const a = (window as unknown as { __acornautPlatform?: PlatformAdapter }).__acornautPlatform;
  return a && typeof a === "object" ? a : null;
}

function build(a: PlatformAdapter | null): Platform {
  const kind: PlatformKind = a?.kind ?? "web";
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
    submitScore: (board, score) => { try { boards?.submit(board, score); } catch { /* a board that is down never costs a run */ } },
    showBoards: (board) => boards?.show(board),
    devDoors: a?.devDoors ?? !native,
  };
}

export const platform: Platform = build(adapterOf());
