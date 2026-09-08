#!/usr/bin/env node
/** ONE RECEIPT, ONE GRANT, asserted.
 *
 *  A store can hand the game the same transaction three ways: the purchase
 *  promise, the pending list on the next resume, and Restore Purchases.
 *  This proves the ledger pays each id once, that the bridge normalises
 *  what an adapter returns (a bare "ok" from an older shell, a rejected
 *  pending() call), and that engine.buyDust cannot leave an unhandled
 *  rejection behind. Runs against the built bundle in docs/js, like the
 *  rest of the harness.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };

// ---- a fake shell, installed before the bridge is imported --------------
const bought = [];
let pendingCalls = 0;
globalThis.window = {
  location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  __acornautPlatform: {
    kind: "ios",
    storage: (() => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; })(),
    store: {
      priceOf: (id) => (id === "dust-100" ? "€1,19" : null),
      async buy(id) {
        bought.push(id);
        if (id === "dust-100") return "ok";                                   // an older adapter: bare result
        if (id === "dust-550") return { result: "ok", transactionId: "tx-550-a" };
        if (id === "dust-1200") return { result: "cancelled" };
        throw new Error("store exploded");                                     // dust-2600
      },
      async restore() {},
      async pending() {
        pendingCalls++;
        if (pendingCalls === 1) throw new Error("not signed in");
        return [
          { id: "dust-550", transactionId: "tx-550-a" },                       // already paid by buy()
          { id: "dust-550", transactionId: "tx-550-b" },                       // approved later: owed
          { id: "not-a-pack", transactionId: "tx-junk" },
        ];
      },
    },
    devDoors: false,
  },
};
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };

const P = await import("../docs/js/platform.js");
const S = await import("../docs/js/save.js");
const { DUST_PACKS } = await import("../docs/js/catalog.js");

// ---- the bridge normalises the adapter ---------------------------------
ok(P.platform.kind === "ios" && P.platform.native && P.platform.storeReady, "fake shell not adopted");
ok(P.platform.priceOf("dust-100") === "€1,19" && P.platform.priceOf("dust-550") === null, "priceOf passthrough");
const bare = await P.platform.buyDust("dust-100");
ok(bare.result === "ok" && bare.transactionId === undefined, `bare "ok" should become { result: "ok" }, got ${JSON.stringify(bare)}`);
const full = await P.platform.buyDust("dust-550");
ok(full.result === "ok" && full.transactionId === "tx-550-a", "an outcome with a transaction id passes through");
const first = await P.platform.pendingPurchases();
ok(Array.isArray(first) && first.length === 0, "a pending() that throws must read as an empty list");
const second = await P.platform.pendingPurchases();
ok(second.length === 3, "a pending() that answers passes the list through");
let threw = false;
try { await P.platform.buyDust("dust-2600"); } catch { threw = true; }
ok(threw, "the bridge itself does not swallow a throwing buy (the engine must)");

// ---- the ledger --------------------------------------------------------
const save = S.defaultSave();
ok(Array.isArray(save.receipts) && save.receipts.length === 0, "a fresh save has an empty receipt ledger");
ok(S.takeReceipt(save, "tx-550-a") === true, "a new receipt is taken");
ok(S.takeReceipt(save, "tx-550-a") === false, "the same receipt is refused the second time");
ok(S.takeReceipt(save, "tx-550-b") === true, "a different receipt is taken");
ok(save.receipts.length === 2, `ledger should hold 2, holds ${save.receipts.length}`);
const wrecked = { ...S.defaultSave(), receipts: "nope" };
ok(S.takeReceipt(wrecked, "tx-1") === true && Array.isArray(wrecked.receipts), "a corrupt ledger is rebuilt, not thrown on");

// ---- the pack table the engine grants from -----------------------------
ok(DUST_PACKS.some((p) => p.id === "dust-550" && p.dust + p.bonus === 550), "dust-550 pays 550");

// ---- the engine's wiring, read from source: no promise left unhandled ---
const engineSrc = readFileSync(new URL("./game/engine.ts", import.meta.url), "utf8");
const buyBlock = engineSrc.slice(engineSrc.indexOf("function buyDust("), engineSrc.indexOf("function dustPending("));
ok(/platform\.buyDust\(id\)[\s\S]*\.catch\(/.test(buyBlock), "engine.buyDust must .catch the store promise");
ok(/state: "failed"/.test(buyBlock), "a throwing store must read as a failed purchase");
ok(/takeReceipt\(save, transactionId\)/.test(engineSrc), "grantDust must go through takeReceipt");
ok(!/save\.receipts\.push/.test(engineSrc), "only save.ts writes the receipt ledger");
const standaloneSrc = readFileSync(new URL("./game/standalone.ts", import.meta.url), "utf8");
ok(/engine\.dustPending\(\)/.test(standaloneSrc) && /engine\.takeDustOutcome\(\)/.test(standaloneSrc),
  "the shop must show the in-flight purchase and its outcome");
ok(/cancelled: "/.test(standaloneSrc) && /failed: "/.test(standaloneSrc), "cancelled and failed need a line in the shop");

if (fail.length) { console.error("receipts: FAIL\n  - " + fail.join("\n  - ")); process.exit(1); }
console.log(`receipts: ${bought.length} fake purchases, ledger and bridge behave (${fileURLToPath(import.meta.url).split("/").pop()})`);
