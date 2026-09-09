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
        SHOP_SLOTS, SHOP_DAY_MS, IAP_ITEMS,
        idDust, idGrants, alaCarteTotal, featurePrice, DUST_STICKER, SHOP_CYCLE } = C;

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
// Everything above this line prices the old tabbed shop, and `drawShop` has
// opened with `return drawShopBeta()` since the storefront shipped - so no
// pilot has reached a single number it proves. The audit found the live
// path with no test at all: the storefront prices singles with `idDust`
// and packs with `featurePrice` struck off what the same ids cost one at a
// time, and until this block FEATURE_DISCOUNT or DUST_PER_WEIGHT could be
// changed to anything whatever and the suite still printed green. The
// day's deal still lives in standalone.ts as `shopCycle`, out of a
// harness's reach; these are the rules that can be imported.
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
  for (const b of BUNDLES.filter((pack) => pack.fixed)) {
    ok(b.items.length === 1 && b.items[0].kind === "suit", `${b.name} must sell one complete pilot`);
    const id = b.items[0]?.id;
    ok(C.SUITS.some((suit) => suit.id === id && !suit.beta) && IAP_ITEMS.includes(id), `${b.name} must be a production premium suit`);
    ok(DUST_STICKER[id] === b.dust && idDust(id) === b.dust, `${b.name} must carry its pinned single-item sticker`);
    ok(featurePrice(b, none) === b.dust, `${b.name} must never discount its fixed sticker`);
    ok(idGrants(id).includes(id), `${b.name} must grant its pilot entitlement`);
    ok(C.SUIT_SHELF.some((shelf) => shelf.shop && shelf.ids.includes(id)), `${b.name} must have a Hangar shop entry`);
  }

  // a set trail is never sold, it is handed over with the suit
  ok(idGrants("cryostar").includes("celestialtide"),
    "buying Cryostar must hand over Celestial Tide with it");
  ok(SHOP_CYCLE.trails === 0, "the singles shelf must deal no trails: they come with the set");

  const weightSum = (ids, owns) => ids.filter((i) => !owns(i)).reduce((n, i) => n + idDust(i), 0);
  for (const b of BUNDLES) {
    const ids = bundleIds(b);
    const due = featurePrice(b, none);
    ok(due <= b.dust, `${b.name} featured at ${due} must not ask more than its sticker ${b.dust}`);
    ok(due <= alaCarteTotal(ids, none),
      `${b.name} featured at ${due} must never cost more than buying it singly (${alaCarteTotal(ids, none)})`);
    ok(featurePrice(b, () => true) === 0, `${b.name} fully owned must be free`);
    if (b.fixed) continue;
    // HALF, written out as half rather than as FEATURE_DISCOUNT, so that
    // moving the constant is caught instead of being agreed with
    ok(due === Math.max(10, Math.round(weightSum(ids, none) / 2 / 10) * 10),
      `${b.name} should feature at half its contents, got ${due} of ${weightSum(ids, none)}`);
    ok(due > 0, `${b.name} still owes something, so it must never feature at nothing`);
  }

  // half of what REMAINS: a pack whose suit is already in the wardrobe has
  // to get cheaper, or the pilot pays for that suit twice
  const aurora = byId("bundle-aurora");
  ok(featurePrice(aurora, owner("cryostar")) < featurePrice(aurora, none),
    "a part-owned pack must feature for less than the same pack untouched");
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
