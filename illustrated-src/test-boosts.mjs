#!/usr/bin/env node
/** THE STAR CHART BOOSTS, asserted (owner, 8 Sep 2026).
 *
 *  A boost is BOUGHT into the account with Star Dust and SPENT on the
 *  chart. This proves the ledger both ways: a purchase charges the sticker
 *  and raises the count, a spend lowers the count and never touches dust,
 *  a Level Skip three-stars a reachable mission through the same credit a
 *  flown finish uses, a Star Unlock opens exactly one reward item of each
 *  kind, and every refusal is named. Runs against the built bundle.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };

const Save = await import("../docs/js/save.js");
const C = await import("../docs/js/catalog.js");
const Camp = await import("../docs/js/campaign.js");
const Prog = await import("../docs/js/campaign-progress.js");
const { defaultSave, buyBoost, boostReady, skipLevel, skipEligible, skippableLevels, unlockReward,
        unlockableRewards, rewardOwned, starsOf, suitRevealed, helmetRevealed, trailUnlocked, palUnlocked,
        deepUnlocked, startShieldUnlocked, modsUnlocked } = Save;
const { BOOSTS, BOOST_IDS } = C;
const { CHART_LEVELS, STAR_REWARDS, HYPER_RUN_MISSION } = Camp;

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };

// ---- the catalog ----------------------------------------------------------
ok(BOOST_IDS.length === 2 && BOOSTS.levelskip.dust === 100 && BOOSTS.starunlock.dust === 500,
  "two boosts: Level Skip 100, Star Unlock 500");

// ---- buying ---------------------------------------------------------------
{
  const s = defaultSave();
  ok(!boostReady(s, "levelskip") && !boostReady(s, "starunlock"), "a fresh save holds no boosts");
  ok(buyBoost(s, "levelskip") === "poor" && s.boosts.levelskip === 0, "no dust, no boost");
  s.starDust = 650;
  ok(buyBoost(s, "levelskip") === "ok" && s.starDust === 550 && s.boosts.levelskip === 1, "Level Skip charges 100 into the account");
  ok(buyBoost(s, "starunlock") === "ok" && s.starDust === 50 && s.boosts.starunlock === 1, "Star Unlock charges 500 into the account");
  ok(buyBoost(s, "starunlock") === "poor" && s.boosts.starunlock === 1, "a short purse buys nothing");
}

// ---- the level skip -------------------------------------------------------
{
  const s = defaultSave();
  const first = CHART_LEVELS[0], second = CHART_LEVELS[1];
  ok(skipEligible(s, first) === "ok", "mission 1 is reachable on a fresh save");
  ok(skipEligible(s, second) === "locked", "mission 2 is behind mission 1");
  ok(skipEligible(s, HYPER_RUN_MISSION) === "hyper", "Hyper Run refuses the skip");
  ok(skipLevel(s, first) === "none" && starsOf(s) === 0, "nothing held, nothing skipped");
  s.starDust = 100; buyBoost(s, "levelskip");
  const dustBefore = s.starDust;
  ok(skipLevel(s, first) === "ok", "a held skip lands on mission 1");
  ok(s.boosts.levelskip === 0 && s.starDust === dustBefore, "the spend takes the boost, not dust");
  ok(Prog.missionCredit(s, first) === 3 && starsOf(s) === 3, `three stars banked, total 3 (got ${starsOf(s)})`);
  ok(Prog.routeMasks(s)[first.id] === 1, "the road reads the mission as passed");
  ok(skipEligible(s, first) === "done", "a three-starred mission is done");
  ok(skipEligible(s, second) === "ok", "mission 2 opens behind the skipped one");
  s.boosts.levelskip = 1;
  ok(skipLevel(s, first) === "done" && s.boosts.levelskip === 1, "a refused skip keeps the boost");
  ok(skipLevel(s, HYPER_RUN_MISSION) === "hyper" && s.boosts.levelskip === 1, "Hyper Run keeps the boost too");
  const list = skippableLevels(s);
  ok(list.length >= 1 && list[0].id === second.id && !list.some((d) => d.standalone), "the skippable list is the reachable, unfinished road");
}

// ---- the star unlock ------------------------------------------------------
{
  const s = defaultSave();
  const byKind = (k) => STAR_REWARDS.find((r) => r.kind === k && r.id && !rewardOwned(s, r));
  const suit = byKind("suit"), helm = byKind("helmet"), trail = byKind("trail"), pal = byKind("pal");
  const deep = STAR_REWARDS.find((r) => r.kind === "mode" && r.id === "deep");
  const shield = STAR_REWARDS.find((r) => r.kind === "mod" && r.id === "startShield");
  const mods = STAR_REWARDS.find((r) => r.kind === "mod" && r.id === "flightmods");
  const dust = STAR_REWARDS.find((r) => r.kind === "dust");
  ok(suit && helm && trail && pal && deep && shield && mods && dust, "the ladder carries one of every kind");
  ok(unlockReward(s, suit) === "none", "nothing held, nothing unlocked");
  ok(unlockReward(s, dust) === "currency", "a currency line is not an item");
  s.boosts.starunlock = 7;
  ok(unlockReward(s, suit) === "ok" && suitRevealed(s, suit.id) && s.unlockedSuits.includes(suit.id), `suit ${suit.id} opens`);
  ok(unlockReward(s, helm) === "ok" && helmetRevealed(s, helm.id), `helmet ${helm.id} opens`);
  ok(unlockReward(s, trail) === "ok" && trailUnlocked(s, trail.id), `trail ${trail.id} opens`);
  ok(unlockReward(s, pal) === "ok" && palUnlocked(s, pal.id), `pal ${pal.id} opens`);
  ok(unlockReward(s, deep) === "ok" && deepUnlocked(s) && s.keyUnlocks.includes("deep"), "Deep Space opens by key");
  ok(unlockReward(s, shield) === "ok" && startShieldUnlocked(s), "the Start Shield opens by key");
  ok(unlockReward(s, mods) === "ok" && modsUnlocked(s), "the flight mods open by key");
  ok(s.boosts.starunlock === 0, "seven unlocks, seven boosts");
  ok(unlockReward(s, suit) === "owned", "an owned reward is refused before the purse is touched");
  for (const r of [suit, helm, trail, pal, deep, shield, mods]) ok(rewardOwned(s, r), `${r.name} reads as owned on the rail`);
  ok(!unlockableRewards(s).some((r) => [suit, helm, trail, pal, deep, shield, mods].includes(r)), "opened rewards leave the unlockable list");
  ok(unlockableRewards(s).every((r) => r.kind !== "dust" && r.kind !== "acorns"), "currency never appears in the unlockable list");
  ok(starsOf(s) === 0, "an unlock adds no stars");
}

// ---- one item, two routes ---------------------------------------------------
{
  const { ownsPremium, settleStarRewards } = Save;
  const Prog2 = Prog;
  const magnetar = STAR_REWARDS.find((r) => r.kind === "pal" && r.id === "magnetar");
  const bee = STAR_REWARDS.find((r) => r.kind === "pal" && r.id === "bee");
  ok(magnetar && bee, "Magnetar and Astrolobee sit on the road");
  const reach = (s, stars) => { s.allStars = false; s.campaignProgress = undefined; s.stars = {}; let left = stars; for (const def of CHART_LEVELS) { if (left <= 0) break; const n = Math.min(3, left); Prog2.settleMissionCredit(s, def, (1 << n) - 1); left -= n; } };
  // bought in the shop, then the road reaches its rung: Star Dust instead
  {
    const s = defaultSave(); s.starDust = 0; s.purchased = ["magnetar"];
    ok(ownsPremium(s, "magnetar") && !ownsPremium(s, "astrafox"), "a bought pal is owned; an unbought one is not");
    reach(s, magnetar.stars);
    const before = s.starDust, acorns = s.acorns;
    settleStarRewards(s);
    const sub = s.rewardSubs[Prog2.rewardId(magnetar)];
    ok(sub && sub.kind === "dust" && sub.amount === Camp.substituteFor(magnetar.stars, "dust").amount, `the Magnetar rung paid dust instead (${JSON.stringify(sub)})`);
    ok(s.starDust - before >= sub.amount, "the dust landed in the purse");
    // the first settle also paid every currency rung crossed on the way, so
    // idempotence is measured from AFTER it: a second pass moves nothing
    const settled = s.starDust, settledAcorns = s.acorns;
    settleStarRewards(s);
    ok(s.rewardSubs[Prog2.rewardId(magnetar)].amount === sub.amount && s.starDust === settled && s.acorns === settledAcorns,
      "a second settle pays nothing twice");
    void acorns;
  }
  // opened with a Star Unlock, then the road reaches its rung: acorns instead
  {
    const s = defaultSave(); s.boosts.starunlock = 1;
    ok(unlockReward(s, bee) === "ok" && palUnlocked(s, "bee"), "Astrolobee opens by Star Unlock");
    reach(s, bee.stars);
    const before = s.acorns;
    settleStarRewards(s);
    const sub = s.rewardSubs[Prog2.rewardId(bee)];
    ok(sub && sub.kind === "acorns" && sub.amount === Camp.substituteFor(bee.stars, "acorns").amount, `the Astrolobee rung paid acorns instead (${JSON.stringify(sub)})`);
    ok(s.acorns - before >= sub.amount, "the acorns landed in the wallet");
  }
  // a premium id opened with a Star Unlock is owned the way the shop reads it
  {
    const s = defaultSave(); s.boosts.starunlock = 1;
    ok(unlockReward(s, magnetar) === "ok" && ownsPremium(s, "magnetar") && palUnlocked(s, "magnetar"), "a Star-Unlocked premium pal is owned everywhere");
    reach(s, magnetar.stars); settleStarRewards(s);
    ok(s.rewardSubs[Prog2.rewardId(magnetar)]?.kind === "acorns", "and its rung pays acorns, not dust");
  }
  // earned on the road: owned, nothing paid, and gone from the shop
  {
    const s = defaultSave();
    reach(s, magnetar.stars); settleStarRewards(s);
    ok(ownsPremium(s, "magnetar") && !s.rewardSubs[Prog2.rewardId(magnetar)], "a road-earned pal is owned and its rung paid no substitute");
    const shelf = C.shopBundles(Date.now(), (i) => ownsPremium(s, i));
    ok(!shelf.some((b) => b.id === "bundle-magnetar"), "the Magnetar pack leaves the shelf once the road handed it over");
    ok(!C.IAP_ITEMS.some((i) => i === "magnetar" && !ownsPremium(s, i)), "and the id reads as owned for the single shelf");
  }
  // the substitute is flat, whatever the rung (owner: "like 50 star dust, not an equivalent share")
  ok(Camp.substituteFor(30, "dust").amount === 50 && Camp.substituteFor(780, "dust").amount === 50, "a bought item's rung pays 50 Star Dust anywhere on the road");
  ok(Camp.substituteFor(30, "acorns").amount === Camp.SUB_ACORNS && Camp.substituteFor(780, "acorns").amount === Camp.SUB_ACORNS, "a Star-Unlocked item's rung pays the flat acorn sum anywhere");
}

// ---- the defaults ---------------------------------------------------------
{
  const s = defaultSave();
  ok(s.boosts && s.boosts.levelskip === 0 && s.boosts.starunlock === 0 && Array.isArray(s.keyUnlocks) && !s.keyUnlocks.length,
    "a fresh save carries empty boosts and no keys");
}

// ---- a set suit opens with its trail, like the shop hands it over --------
{
  const s = defaultSave(); s.boosts.starunlock = 1;
  const gemmie = STAR_REWARDS.find((r) => r.kind === "suit" && r.id === "gemmie");
  ok(unlockReward(s, gemmie) === "ok" && Save.ownsPremium(s, "gemmie"), "the Gemmie suit opens by Star Unlock");
  ok(C.idGrants("gemmie").every((i) => Save.ownsPremium(s, i)), "and its set trail comes with it, as a shop purchase would");
}

// ---- a boost is never spent on a reward it cannot open -------------------
{
  const s = defaultSave(); s.boosts.starunlock = 1;
  ok(unlockReward(s, { stars: 1, kind: "title", id: "x", name: "x" }) === "currency" && s.boosts.starunlock === 1,
    "a title with an id is refused and the boost stays");
}

// ---- a damaged save loads clean ------------------------------------------
{
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  store.set(C.SAVE_KEY, JSON.stringify({ ...defaultSave(), boosts: [5, 6], rewardSubs: { a: { kind: "dust" }, b: "z", c: { kind: "acorns", amount: 250 } } }));
  const s = Save.loadSave();
  ok(s.boosts.levelskip === 0 && s.boosts.starunlock === 0 && !Array.isArray(s.boosts), "an array where the boosts should be is reset, not kept");
  ok(Object.keys(s.rewardSubs).join() === "c", "malformed substitute entries are dropped, whole ones kept");
}

if (fail.length) { console.error("boosts: FAIL\n  " + fail.join("\n  ")); process.exit(1); }
console.log("boosts: bought into the account, spent on the chart, every kind opens, every refusal named");
