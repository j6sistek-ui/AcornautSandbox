#!/usr/bin/env node
/** The shop's economics, asserted rather than eyeballed.
 *
 *  Packs overlap on purpose, so what a pack costs depends on what the pilot
 *  already owns - and that is exactly the kind of arithmetic that looks
 *  right in a card and is wrong in the ledger. This proves the price the
 *  shelf shows, the weighting behind it, and that a day's shelf is a
 *  function of the DATE and nothing the pilot can touch.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };

const C = await import("../docs/js/catalog.js");
const { BUNDLES, ITEM_WEIGHT, bundleIds, bundleWeight, bundlePrice, shopBundles,
        SHOP_SLOTS, SHOP_DAY_MS, IAP_ITEMS } = C;

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const owner = (...ids) => { const s = new Set(ids.flat()); return (i) => s.has(i); };
const none = () => false;
const byId = (id) => BUNDLES.find((b) => b.id === id);
const DAY = SHOP_DAY_MS;

// ---- weights and the sticker -------------------------------------------
for (const b of BUNDLES) {
  ok(b.items.length > 0, `${b.name} is empty`);
  ok(bundlePrice(b, none) === b.dust,
    `${b.name} with nothing owned should cost its sticker ${b.dust}, got ${bundlePrice(b, none)}`);
  ok(bundlePrice(b, () => true) === 0, `${b.name} fully owned should cost nothing`);
  const w = b.items.reduce((n, i) => n + ITEM_WEIGHT[i.kind], 0);
  ok(bundleWeight(b) === w, `${b.name} weight mismatch`);
}

// ---- a suit is worth three of anything else ----------------------------
{
  const aurora = byId("bundle-aurora");
  const total = bundleWeight(aurora);
  const suitOnly = bundlePrice(aurora, owner("cryostar"));      // suit AND helm share the id
  const trailOnly = bundlePrice(aurora, owner("celestialtide"));
  const offSuit = aurora.dust - suitOnly, offTrail = aurora.dust - trailOnly;
  // cryostar clears a suit (3) and its helmet (1); celestialtide clears a trail (1)
  ok(Math.abs(offSuit / offTrail - 4) < 0.35,
    `a suit+helmet should take about 4x a trail off, got ${offSuit} vs ${offTrail}`);
  ok(suitOnly < aurora.dust && suitOnly > 0, "a part-owned pack must still cost something");
  ok(total === 16, `Aurora should weigh 16 (3 suits, 3 helms, 3 trails, 1 pal), got ${total}`);
}

// ---- the cross-pack discount, which is the whole point ------------------
{
  const circuit = byId("bundle-circuit");
  const robo = byId("bundle-robo");
  const cyber = byId("bundle-cyber");
  const afterCircuit = owner(bundleIds(circuit));
  ok(bundlePrice(robo, afterCircuit) === 0,
    `Robo & Glider is entirely inside Circuit, so owning Circuit must make it free/gone`);
  const cyberDue = bundlePrice(cyber, afterCircuit);
  ok(cyberDue > 0 && cyberDue < cyber.dust,
    `Cyber & Clockwork should be discounted, not free: got ${cyberDue} of ${cyber.dust}`);
  // cyber suit (3) owned, clockwork trail (1) not -> a quarter of the weight left
  ok(Math.abs(cyberDue - Math.round(cyber.dust / 4 / 10) * 10) < 1,
    `Cyber & Clockwork should cost about a quarter, got ${cyberDue}`);
}

// ---- the shelf is the date's, not the pilot's --------------------------
{
  const t = 1_800_000_000_000;
  const a = shopBundles(t, none).map((b) => b.id);
  const b2 = shopBundles(t + 60_000, none).map((b) => b.id);
  ok(a.length === Math.min(SHOP_SLOTS, BUNDLES.length), `shelf should hold ${SHOP_SLOTS}, got ${a.length}`);
  ok(JSON.stringify(a) === JSON.stringify(b2), "the shelf must not change within a day");
  // over a fortnight every pack should get a turn, and days must differ
  const seen = new Set(); let changes = 0; let prev = null;
  for (let d = 0; d < 14; d++) {
    const ids = shopBundles(t + d * DAY, none).map((x) => x.id);
    ids.forEach((i) => seen.add(i));
    if (prev && JSON.stringify(prev) !== JSON.stringify(ids)) changes++;
    prev = ids;
  }
  ok(seen.size === BUNDLES.length, `every pack should appear within a fortnight, saw ${seen.size}/${BUNDLES.length}`);
  ok(changes >= 7, `the shelf should turn over most days, changed ${changes}/13`);
}

// ---- a bought pack leaves, and does not disturb the ones beside it ------
{
  const t = 1_800_000_000_000;
  const before = shopBundles(t, none).map((b) => b.id);
  const bought = before[0];
  const after = shopBundles(t, owner(bundleIds(byId(bought)))).map((b) => b.id);
  ok(!after.includes(bought), "a pack the pilot owns must leave the shelf");
  const kept = before.slice(1);
  ok(JSON.stringify(after.slice(0, kept.length)) === JSON.stringify(kept),
    `buying one pack must not reshuffle the others: ${before} -> ${after}`);
  const all = owner(BUNDLES.flatMap(bundleIds));
  ok(shopBundles(t, all).length === 0, "owning everything should leave an empty shelf");
}

// ---- and every id a pack sells is a real, sellable thing ----------------
for (const b of BUNDLES) {
  for (const id of bundleIds(b)) {
    ok(IAP_ITEMS.includes(id), `${b.name} sells ${id}, which is not in IAP_ITEMS`);
  }
}

const t0 = 1_800_000_000_000;
console.log(JSON.stringify({
  suite: "shop rotation and cross-pack pricing",
  packs: BUNDLES.map((b) => ({ id: b.id, items: b.items.length, weight: bundleWeight(b), dust: b.dust })),
  shelfToday: shopBundles(t0, none).map((b) => b.id),
  shelfTomorrow: shopBundles(t0 + DAY, none).map((b) => b.id),
  failures: fail,
}, null, 1));
if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
