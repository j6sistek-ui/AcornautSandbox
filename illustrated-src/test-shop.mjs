#!/usr/bin/env node
/** The shop's economics, asserted rather than eyeballed.
 *
 *  Packs overlap on purpose, so what a pack costs depends on what the pilot
 *  already owns - and that is exactly the kind of arithmetic that looks
 *  right in a card and is wrong in the ledger. This proves the price the
 *  shelf shows, full ownership credit, and that a day's shelf is a
 *  function of the DATE and nothing the pilot can touch.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };

const C = await import("../docs/js/catalog.js");
const { BUNDLES, ITEM_WEIGHT, bundleIds, bundleWeight, bundlePrice, shopBundles,
        SHOP_SLOTS, SHOP_DAY_MS, IAP_ITEMS,
        idDust, idGrants, alaCarteTotal, featurePrice, bundleQuote, bundleProductIds,
        FIXED_SHOP_SUIT_IDS, DUST_STICKER, SHOP_CYCLE } = C;

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const owner = (...ids) => { const s = new Set(ids.flat()); return (i) => s.has(i); };
const none = () => false;
const byId = (id) => BUNDLES.find((b) => b.id === id);
const DAY = SHOP_DAY_MS;

// ---- one kit quote for both purchase entry points ----------------------
for (const b of BUNDLES) {
  ok(bundleProductIds(b).length >= 3, `${b.name} needs at least three distinct products`);
  ok(bundlePrice(b, none) === featurePrice(b, none),
    `${b.name} direct checkout must charge the actual Shop offer`);
  ok(bundlePrice(b, none) === bundleQuote(b, none).offer,
    `${b.name} must charge its editable kit quote`);
  ok(bundlePrice(b, () => true) === 0, `${b.name} fully owned should cost nothing`);
  const w = b.items.reduce((n, i) => n + ITEM_WEIGHT[i.kind], 0);
  ok(bundleWeight(b) === w, `${b.name} weight mismatch`);
}

// ---- shared ownership IDs and free trails are counted once -------------
{
  const aurora = byId("bundle-aurora");
  const total = bundleWeight(aurora);
  const suitOnly = bundlePrice(aurora, owner(idGrants("cryostar")));
  const trailOnly = bundlePrice(aurora, owner("celestialtide"));
  const offer = bundlePrice(aurora, none);
  ok(offer === 720 && suitOnly === 360,
    `the 720 Aurora offer credits the full 360 Cryostar purchase, got ${suitOnly}`);
  ok(trailOnly === offer, "a free trail must not be credited again while its granting suit is unowned");
  ok(total === 16, `Aurora should weigh 16 (3 suits, 3 helms, 3 trails, 1 pal), got ${total}`);
}

// ---- the cross-pack discount, which is the whole point ------------------
{
  const circuit = byId("bundle-circuit");
  const afterCircuit = owner(bundleIds(circuit).flatMap(idGrants));
  ok(afterCircuit("robo") && afterCircuit("nightglider") && afterCircuit("cyber") && afterCircuit("clockwork"),
    "Circuit includes both retired duos, including Cyber's free Clockwork wake");
  const twoSuitsOwned = owner("robo", "cyber", "clockwork");
  ok(bundlePrice(circuit, twoSuitsOwned) === 0 && !bundleIds(circuit).every(twoSuitsOwned),
    "full retail credit may cover a remaining item without making it already owned");
  const companions = byId("bundle-cosmic-companions");
  ok(bundlePrice(companions, none) === 200 && bundlePrice(companions, owner("magnetar")) === 110 &&
    bundlePrice(companions, owner("magnetar", "babyalien")) === 20,
    "new companion collections credit each 90-Stardust item at its complete retail value");
}

// ---- the shelf is the date's, not the pilot's --------------------------
{
  const t = 1_800_000_000_000;
  const a = shopBundles(t, none).map((b) => b.id);
  const b2 = shopBundles(t + 60_000, none).map((b) => b.id);
  ok(a.length === Math.min(SHOP_SLOTS, BUNDLES.length), `shelf should hold ${SHOP_SLOTS}, got ${a.length}`);
  ok(JSON.stringify(a) === JSON.stringify(b2), "the shelf must not change within a day");
  // This legacy shelf hashes each date; it has no fourteen-day round-robin
  // promise. Sample several catalog-length windows to catch an unreachable
  // pack without treating an old roster's lucky fortnight as a product rule.
  const observationDays = Math.max(14, BUNDLES.length * 4);
  const seen = new Set(); let changes = 0; let prev = null;
  for (let d = 0; d < observationDays; d++) {
    const ids = shopBundles(t + d * DAY, none).map((x) => x.id);
    ids.forEach((i) => seen.add(i));
    if (prev && JSON.stringify(prev) !== JSON.stringify(ids)) changes++;
    prev = ids;
  }
  ok(seen.size === BUNDLES.length, `legacy shelf sample missed a pack across ${observationDays} days, saw ${seen.size}/${BUNDLES.length}`);
  ok(changes >= Math.floor(observationDays / 2), `the shelf should turn over most days, changed ${changes}/${observationDays - 1}`);
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

// ---- and now the prices the storefront ACTUALLY charges -----------------
// Both purchase helpers now use the same kit quote. The old hashed shelf
// above remains a compatibility helper; the UI regression separately
// exercises the actual standalone shopCycle and real checkout events.
{
  // the single-item rate, pinned at real numbers rather than restated as
  // its own formula: a suit on its own, a suit that carries its helmet on
  // the same id, and a trail
  ok(idDust("volt") === 270, `a suit alone should be 270 dust, got ${idDust("volt")}`);
  ok(idDust("cryostar") === 360, `a suit that brings its helmet should be 360, got ${idDust("cryostar")}`);
  ok(idDust("celestialtide") === 90, `a trail should be 90, got ${idDust("celestialtide")}`);
  // and a sticker price beats the rate wherever the owner set one
  ok(DUST_STICKER.arcflash === 1850 && idDust("arcflash") === 1850,
    `Arcflash is priced by hand at 1850, got ${idDust("arcflash")}`);

  // Fixed pilots use the current storefront's daily pinned singles row.
  // Their entitlement and full sticker must be available independently of
  // whether their bundle happens to appear in the legacy hashed sample.
  ok(JSON.stringify(FIXED_SHOP_SUIT_IDS) === JSON.stringify(["arcflash", "porcelain", "nacre", "origamist"]),
    "the fixed-price pilots remain explicit individual offers");
  for (const id of FIXED_SHOP_SUIT_IDS) {
    const sticker = id === "arcflash" ? 1850 : 1000;
    ok(C.SUITS.some((suit) => suit.id === id && !suit.beta) && IAP_ITEMS.includes(id), `${id} must be a production premium suit`);
    ok(DUST_STICKER[id] === sticker && idDust(id) === sticker, `${id} must carry its pinned single-item sticker`);
    ok(!byId(`bundle-${id}`), `${id} is a single item, never a pretend bundle`);
    ok(idGrants(id).includes(id), `${id} must grant its pilot entitlement`);
    ok(C.SUIT_SHELF.some((shelf) => shelf.shop && shelf.ids.includes(id)), `${id} must have a Hangar shop entry`);
  }

  // a set trail is never sold, it is handed over with the suit
  ok(idGrants("cryostar").includes("celestialtide"),
    "buying Cryostar must hand over Celestial Tide with it");
  ok(SHOP_CYCLE.trails === 0, "the singles shelf must deal no trails: they come with the set");

  for (const b of BUNDLES) {
    const ids = bundleIds(b);
    const due = featurePrice(b, none);
    ok(due <= b.dust, `${b.name} featured at ${due} must not ask more than its sticker ${b.dust}`);
    ok(due <= alaCarteTotal(ids, none),
      `${b.name} featured at ${due} must never cost more than buying it singly (${alaCarteTotal(ids, none)})`);
    ok(featurePrice(b, () => true) === 0, `${b.name} fully owned must be free`);
    ok(due === bundlePrice(b, none), `${b.name} must use the same price in both checkout paths`);
    ok(due > 0, `${b.name} still owes something, so it must never feature at nothing`);
  }

  // The configured offer is preserved; ownership is credited afterward at
  // full individual retail, without rounding or a negative cash refund.
  const aurora = byId("bundle-aurora");
  ok(featurePrice(aurora, owner("cryostar")) < featurePrice(aurora, none),
    "a part-owned pack must feature for less than the same pack untouched");
  const trio = byId("bundle-premium-trio");
  ok(featurePrice(trio, none) === 2500 && featurePrice(trio, owner("porcelain")) === 1500 &&
    featurePrice(trio, owner("porcelain", "nacre")) === 500,
    "trio ownership credits each complete 1000-Stardust pilot at full retail");
}

// ---- the first shelf a new pilot ever sees ------------------------------
// "Collect Reward" is not a decoration: it is the loudest badge on a card
// and it means FREE, REVEALED, UNCLAIMED. Two helmets shipped that way with
// no star gate to hold them, so the guided step that says "equip the Ion
// helmet" opened onto a shelf where two other cards begged to be pressed
// first. A cosmetic that is free on day one has to be one the pilot already
// owns - anything else is a price or a gate.
{
  const SAVE = await import("../docs/js/save.js");
  const s0 = SAVE.defaultSave();
  const freeAndWaiting = (list, ownedIds) =>
    list.filter((x) => !C.isIap(x.id) && !ownedIds.includes(x.id) && (x.cost || 0) <= 0);

  const helms = freeAndWaiting(C.HELMETS, s0.unlocked).filter((h) => SAVE.helmetRevealed(s0, h.id));
  ok(helms.length === 0,
    `no helmet may read "Collect Reward" on a brand-new save; ${helms.map((h) => h.id).join(", ")} does`);

  const suits = freeAndWaiting(C.SUITS, s0.unlockedSuits).filter((u) => SAVE.suitRevealed(s0, u.id));
  ok(suits.length === 0,
    `no suit may read "Collect Reward" on a brand-new save; ${suits.map((u) => u.id).join(", ")} does`);

  // and the two that caused it are shop stock behind a chart gate, not prizes
  const CAMP = await import("../docs/js/campaign.js");
  for (const id of ["phoenix", "princess"]) {
    const h = C.HELMETS.find((x) => x.id === id);
    ok(h && h.cost > 0, `${id} must carry an acorn price, has ${h && h.cost}`);
    const gate = CAMP.STAR_UNLOCKS.helmets[id];
    ok(gate > 0, `${id} must sit behind a star gate, has ${gate}`);
    ok(!SAVE.helmetRevealed(s0, id), `${id} must be locked on a new save`);
    const at = SAVE.defaultSave();
    at.allStars = true;
    ok(SAVE.helmetRevealed(at, id), `${id} must open once the chart is earned`);
  }
}

const t0 = 1_800_000_000_000;
console.log(JSON.stringify({
  suite: "shop rotation and cross-pack pricing",
  packs: BUNDLES.map((b) => ({ id: b.id, items: b.items.length, weight: bundleWeight(b),
    dust: b.dust, feature: featurePrice(b, none), singly: alaCarteTotal(bundleIds(b), none) })),
  shelfToday: shopBundles(t0, none).map((b) => b.id),
  shelfTomorrow: shopBundles(t0 + DAY, none).map((b) => b.id),
  failures: fail,
}, null, 1));
if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
