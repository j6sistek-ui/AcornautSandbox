import { highOrbitTrailSuit, isPremiumSuit } from "./high-orbit-config.js?v=289";
import { importSampleCredit, migrateCampaign, earnedCampaignStars, missionCredit, routeMasks, settleMissionCredit, rewardId } from "./campaign-progress.js?v=289";
import { CHART_LEVELS, CHART_MAX_STARS, levelUnlocked, STAR_REWARDS, substituteFor } from "./campaign.js?v=289";
import { STAR_UNLOCKS, RACE_GATES, } from "./campaign.js?v=289";
import { restoreSpill } from "./spill.js?v=289";
import { SPILL_UTILITY_IDS, spillEngineColor } from "./spill-content.js?v=289";
export const freshSpillRecords = () => ({ bestScore: 0, ore: 0, contracts: 0, waves: 0, expeditions: 0, runs: 0 });
import { BETA_UNLOCK_GATES, HELMETS, LEGACY_KEYS, PALS, SAVE_KEY, SUITS, isIap, TRAILS, BUNDLES, FIXED_SHOP_SUIT_IDS, bundleQuote, idDust, IS_BETA, GUIDE_SUIT, GUIDE_HELM, TUTORIAL_SUIT, SUIT_PITCH_MIN, SUIT_PITCH_MAX, suitPitchDefault, palsClash, BOOSTS, BOOST_IDS, idGrants, } from "./catalog.js?v=289";
import { platform } from "./platform.js?v=289";
import { TAP_SHAPE, TAP_SHAPE_MIN, TAP_SHAPE_MAX, TAIL_SPRING, TAIL_SPRING_MIN, TAIL_SPRING_MAX, TAIL_SPRING_ONE, TAP_ACCENT_STRENGTH, TAP_ACCENT_MIN, TAP_ACCENT_MAX } from "./control-constants.js?v=289";
// Pinned to the shipped pre-regrouping catalog (9 Sep 2026). These are
// historical grant amounts, not the price of the new bundle layout.
export const BETA_DUST_GRANT_FLOOR = 12360;
export const BETA_LEGACY_DUST_GRANT_TOTAL = 7510;
export function betaDustGrantTarget() {
    const kits = BUNDLES.reduce((total, bundle) => total + bundleQuote(bundle, () => false).offer, 0);
    const singles = FIXED_SHOP_SUIT_IDS.reduce((total, id) => total + idDust(id), 0);
    return Math.max(BETA_DUST_GRANT_FLOOR, kits + singles);
}
export function defaultSave() {
    return {
        highScore: 0,
        deepBest: 0,
        lostBest: 0,
        arcadeBest: 0,
        tunnelBest: 0,
        spillBest: 0,
        spillRecords: freshSpillRecords(), spillSuspended: null, spillStarter: null, spillSignal: false,
        purchased: [],
        receipts: [],
        boosts: { levelskip: 0, starunlock: 0 },
        keyUnlocks: [],
        boostedRewards: [],
        rewardSubs: {},
        acorns: 0,
        xp: 0,
        startShield: false,
        battery: false,
        pilotName: "",
        starDust: 0,
        betaDustGrant: false,
        shelfGrid: false,
        suitLean: {},
        dustPaidTo: 0,
        lastDaily: "",
        adDustDay: "",
        adDustCount: 0,
        crashesSinceAd: 0,
        lastAdAt: 0,
        streakPackClaimed: false,
        dailyStreak: 0,
        steadyGates: false,
        roughAir: false,
        noPalFx: false,
        tapRewind: false,
        tapAccent: false,
        thrillSeeker: false,
        tutorialDone: false,
        unlocked: ["clear"],
        equipped: "clear",
        unlockedSuits: ["flight"],
        equippedSuit: "flight",
        unlockedTrails: ["sparks"],
        equippedTrail: "sparks",
        unlockedPals: ["none"],
        equippedPal: "none",
        equippedPal2: "none",
        runs: 0,
        lifetimeAcorns: 0,
        zonesSeen: [],
        stars: {},
        guide: "pending",
        allStars: false,
        musicOff: false,
        raceRecords: {},
        raceGates: [],
    };
}
/** ONE RECEIPT, ONE GRANT. The store may hand the same transaction to the
 *  game more than once: the purchase promise, then the pending list on the
 *  next resume, then Restore Purchases. The ledger says whether this id
 *  has been paid. True means "new, now recorded, pay it"; false means the
 *  dust already went out. The caller writes the save. */
export function takeReceipt(save, transactionId) {
    if (!Array.isArray(save.receipts))
        save.receipts = [];
    // THE LEDGER OUTLIVES THE SAVE (audit, 8 Sep 2026). Receipts also live in
    // their own storage slot, which Start Over never clears. Without it, a
    // pilot who reset their save kept their store identity, so the very next
    // boot's deliverPending() saw the whole consumable history as unpaid and
    // granted every dust pack they had ever bought, again. The two copies are
    // merged on read and written together; the save's own copy stays for
    // older builds that only know about it.
    const paid = receiptVault();
    if (save.receipts.includes(transactionId) || paid.has(transactionId))
        return false;
    save.receipts.push(transactionId);
    paid.add(transactionId);
    writeReceiptVault(paid);
    return true;
}
/** the durable half of the receipt ledger: every transaction id this device
 *  has ever been paid for, kept beside the save rather than inside it */
const RECEIPT_KEY = SAVE_KEY + ":receipts";
function receiptVault() {
    try {
        const raw = platform.storage.get(RECEIPT_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(list) ? list.filter((r) => typeof r === "string") : []);
    }
    catch {
        return new Set();
    }
}
function writeReceiptVault(paid) {
    // newest last, and bounded: a store history is finite but a corrupted
    // slot should not be able to grow without end
    try {
        platform.storage.set(RECEIPT_KEY, JSON.stringify([...paid].slice(-2000)));
    }
    catch { /* a device with no writable storage pays the old risk, not a new one */ }
}
/** Bank only new progress. This ledger is part of a suspended expedition,
 *  so loading or docking repeatedly never duplicates mastery or rewards. */
export function bankSpill(save, s, end = false) {
    const records = save.spillRecords ?? (save.spillRecords = freshSpillRecords());
    save.spillBest = Math.max(save.spillBest || 0, s.cleared);
    records.bestScore = Math.max(records.bestScore, Math.floor(s.score));
    for (const [field, value] of [["ore", s.oreMined], ["contracts", s.contractsDone], ["waves", s.cleared]]) {
        records[field] += Math.max(0, value - s.banked[field]);
        s.banked[field] = value;
    }
    if (s.expeditionDone && !s.banked.expedition) {
        records.expeditions++;
        s.banked.expedition = true;
    }
    if (end && !s.banked.run) {
        records.runs++;
        s.banked.run = true;
    }
}
function readRaw(key) {
    try {
        const raw = platform.storage.get(key);
        if (!raw)
            return null;
        // A SAVE HAS TO BE AN OBJECT (App Store prep audit, section 2). JSON.parse
        // only throws on malformed text: `5`, `"abc"` and `[1,2]` all parse, all
        // come back truthy, and all used to be handed on as a save. Spreading a
        // string into the defaults pastes its characters on as numbered keys, and
        // worse, loadSave takes the FIRST key that reads truthy - so one corrupt
        // byte in the live slot would shadow a perfectly good legacy save behind
        // it. Anything that is not a plain object is not a save; say so, and the
        // next key in the list gets its turn.
        const value = JSON.parse(raw);
        if (typeof value !== "object" || value === null || Array.isArray(value))
            return null;
        return value;
    }
    catch {
        return null;
    }
}
export function loadSave() {
    const source = [SAVE_KEY, ...LEGACY_KEYS].map(key => ({ key, value: readRaw(key) })).find(x => x.value);
    const parsed = source?.value ?? null;
    const s = { ...defaultSave(), ...parsed };
    if (!s.unlocked?.includes("clear"))
        s.unlocked = ["clear", ...(s.unlocked || [])];
    if (!s.unlockedSuits?.includes("flight"))
        s.unlockedSuits = ["flight", ...(s.unlockedSuits || [])];
    if (!s.unlockedTrails?.includes("sparks"))
        s.unlockedTrails = ["sparks", ...(s.unlockedTrails || [])];
    if (!s.unlockedPals?.includes("none"))
        s.unlockedPals = ["none", ...(s.unlockedPals || [])];
    // Grandfather recorded ownership from the earlier beta companion. The
    // new premium gate must not confiscate a pal already in the hangar.
    if (s.unlockedPals.includes("switchback") && !(s.purchased || []).includes("switchback")) {
        s.purchased = [...(s.purchased || []), "switchback"];
    }
    if (!HELMETS.some((h) => h.id === s.equipped))
        s.equipped = "clear";
    // A save can arrive wearing things this build does not grant — the open
    // beta hands premium out, production does not, and the two share a
    // browser. Anything equipped but not owned HERE comes off; it is not
    // deleted from the save, so a real purchase puts it straight back on.
    if (isIap(s.equippedSuit) && !suitRevealed(s, s.equippedSuit))
        s.equippedSuit = "flight";
    if (isIap(s.equipped) && !helmetRevealed(s, s.equipped))
        s.equipped = "clear";
    // a matched-set helmet stranded on the wrong suit (saved before the rule
    // existed, or edited by hand) comes off rather than half-fitting
    {
        const h = HELMETS.find((x) => x.id === s.equipped);
        if (!isPremiumSuit(s.equippedSuit) && h?.suitOnly && h.suitOnly !== s.equippedSuit)
            s.equipped = "clear";
    }
    if (!SUITS.some((u) => u.id === s.equippedSuit))
        s.equippedSuit = "flight";
    if (!TRAILS.some((t) => t.id === s.equippedTrail))
        s.equippedTrail = "sparks";
    // A fixed suit wake never replaces the pilot's selectable trail. Old or
    // imported saves that stored this presentation effect use the starter.
    if (s.equippedTrail === "arcflashwake" || highOrbitTrailSuit(s.equippedTrail))
        s.equippedTrail = "sparks";
    if (!PALS.some((p) => p.id === s.equippedPal))
        s.equippedPal = "none";
    if (s.equippedPal !== "none" && !palUnlocked(s, s.equippedPal))
        s.equippedPal = "none";
    // the low slot: a real pal, open, not a twin of the high one, not one
    // that clashes with it, and only while the slot itself is earned
    if (typeof s.equippedPal2 !== "string" || !PALS.some((p) => p.id === s.equippedPal2))
        s.equippedPal2 = "none";
    if (s.equippedPal2 !== "none" && (!palUnlocked(s, s.equippedPal2) || !dualPalUnlocked(s)
        || s.equippedPal2 === s.equippedPal || palsClash(s.equippedPal, s.equippedPal2)))
        s.equippedPal2 = "none";
    // a lone companion always flies high
    if (s.equippedPal === "none" && s.equippedPal2 !== "none") {
        s.equippedPal = s.equippedPal2;
        s.equippedPal2 = "none";
    }
    // saves written before Star Dust existed. dustPaidTo starts at 0 rather
    // than at the pilot's current stars, so a long-standing save is PAID its
    // backlog on next load instead of silently losing it.
    if (typeof s.starDust !== "number" || !isFinite(s.starDust))
        s.starDust = 0;
    if (!Array.isArray(s.receipts))
        s.receipts = [];
    s.receipts = s.receipts.filter((r) => typeof r === "string").slice(-500);
    // saves written before the Star Chart boosts existed
    if (!s.boosts || typeof s.boosts !== "object" || Array.isArray(s.boosts))
        s.boosts = { levelskip: 0, starunlock: 0 };
    for (const id of BOOST_IDS) {
        const n = s.boosts[id];
        s.boosts[id] = typeof n === "number" && isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }
    if (!Array.isArray(s.keyUnlocks))
        s.keyUnlocks = [];
    s.keyUnlocks = s.keyUnlocks.filter((k) => typeof k === "string");
    if (!Array.isArray(s.boostedRewards))
        s.boostedRewards = [];
    s.boostedRewards = s.boostedRewards.filter((k) => typeof k === "string");
    if (!s.rewardSubs || typeof s.rewardSubs !== "object" || Array.isArray(s.rewardSubs))
        s.rewardSubs = {};
    // every entry is read by the reward sheet as {kind, amount}; a malformed
    // one would throw inside render and blank the chart, so it is dropped here
    for (const k of Object.keys(s.rewardSubs)) {
        const v = s.rewardSubs[k];
        if (!v || typeof v !== "object" || (v.kind !== "dust" && v.kind !== "acorns")
            || typeof v.amount !== "number" || !isFinite(v.amount))
            delete s.rewardSubs[k];
    }
    if (typeof s.dustPaidTo !== "number" || !isFinite(s.dustPaidTo))
        s.dustPaidTo = 0;
    if (typeof s.betaDustGrant !== "boolean")
        s.betaDustGrant = false;
    if (typeof s.shelfGrid !== "boolean")
        s.shelfGrid = false;
    // the lab: numbers and booleans only, anything else dropped
    if (!s.lab || typeof s.lab !== "object")
        s.lab = {};
    for (const k of Object.keys(s.lab)) {
        const v = s.lab[k];
        if (!(typeof v === "boolean" || (typeof v === "number" && isFinite(v))))
            delete s.lab[k];
    }
    // the pitch table: whole degrees in range, anything else dropped. The
    // one-suit acornutPitch it replaces migrates unless it was the old 25
    // default, which the retested 12 supersedes.
    if (!s.suitPitch || typeof s.suitPitch !== "object")
        s.suitPitch = {};
    {
        const legacy = s.acornutPitch;
        if (typeof legacy === "number" && isFinite(legacy) && Math.round(legacy) !== 25 && !("vanguard" in s.suitPitch))
            s.suitPitch.vanguard = legacy;
        delete s.acornutPitch;
        for (const id of Object.keys(s.suitPitch)) {
            const v = s.suitPitch[id];
            if (typeof v !== "number" || !isFinite(v))
                delete s.suitPitch[id];
            else
                s.suitPitch[id] = Math.max(SUIT_PITCH_MIN, Math.min(SUIT_PITCH_MAX, Math.round(v)));
        }
    }
    // the beta dials: anything malformed is dropped, numbers are clamped
    if (!s.tapShape || typeof s.tapShape !== "object")
        s.tapShape = {};
    for (const id of Object.keys(s.tapShape)) {
        const v = s.tapShape[id];
        if (v === "velocity" || v === "default")
            continue;
        const o = v;
        if (o && typeof o === "object" && typeof o.fwd === "number" && isFinite(o.fwd) && typeof o.back === "number" && isFinite(o.back)) {
            const c = (n) => Math.max(TAP_SHAPE_MIN, Math.min(TAP_SHAPE_MAX, Math.round(n * 20) / 20));
            s.tapShape[id] = { fwd: c(o.fwd), back: c(o.back) };
        }
        else
            delete s.tapShape[id];
    }
    if (!s.tapRepeat || typeof s.tapRepeat !== "object")
        s.tapRepeat = {};
    for (const id of Object.keys(s.tapRepeat))
        if (!["rewind", "finish", "restart"].includes(s.tapRepeat[id]))
            delete s.tapRepeat[id];
    if (!s.tailSpring || typeof s.tailSpring !== "object")
        s.tailSpring = {};
    for (const id of Object.keys(s.tailSpring)) {
        const o = s.tailSpring[id];
        const ok = (n) => typeof n === "number" && isFinite(n);
        if (o && typeof o === "object" && ok(o.stiff) && ok(o.damp) && ok(o.kick)) {
            const c = (n) => Math.max(TAIL_SPRING_MIN, Math.min(TAIL_SPRING_MAX, Math.round(n * 20) / 20));
            s.tailSpring[id] = { stiff: c(o.stiff), damp: c(o.damp), kick: c(o.kick) };
        }
        else
            delete s.tailSpring[id];
    }
    if (!Array.isArray(s.unlockedSuits))
        s.unlockedSuits = ["flight"];
    // ACORNUT IS EARNED (owner, 6 Sep 2026): 570 stars on the road, or the
    // tutorial's borrowed flight. A beta grant or an old free unlock in the
    // list does not count. Both the strip and the equipped check need the
    // star total, so both now run below, after migrateCampaign: see
    // "ACORNUT'S GATE READS THE LEDGER".
    // an old save has no lean table, and a corrupted one must not be able to
    // tip every suit sideways - anything that is not two finite numbers in
    // range is dropped rather than trusted
    if (!s.suitLean || typeof s.suitLean !== "object")
        s.suitLean = {};
    else {
        for (const id of Object.keys(s.suitLean)) {
            const v = s.suitLean[id];
            const okNum = (n) => typeof n === "number" && isFinite(n) && n >= 0 && n <= 2;
            if (!v || !okNum(v.up) || !okNum(v.down))
                delete s.suitLean[id];
        }
    }
    s.pilotName = typeof s.pilotName === "string" ? cleanPilotName(s.pilotName) : "";
    if (typeof s.lastDaily !== "string")
        s.lastDaily = "";
    if (typeof s.adDustDay !== "string")
        s.adDustDay = "";
    for (const k of ["adDustCount", "crashesSinceAd", "lastAdAt"])
        if (typeof s[k] !== "number" || !isFinite(s[k]))
            s[k] = 0;
    if (typeof s.streakPackClaimed !== "boolean")
        s.streakPackClaimed = false;
    if (typeof s.dailyStreak !== "number" || !isFinite(s.dailyStreak))
        s.dailyStreak = 0;
    // saves written before the flight mods existed
    for (const k of ["steadyGates", "roughAir", "thrillSeeker", "noPalFx", "tapRewind", "tapAccent"]) {
        if (typeof s[k] !== "boolean")
            s[k] = false;
    }
    if (typeof s.glowOff !== "boolean")
        delete s.glowOff;
    // the accent strength dial became per suit on 12 Sep 2026; a number from
    // the one-day global dial is dropped, a record is kept where sane
    if (s.tapAccentStrength !== undefined) {
        const t = s.tapAccentStrength;
        if (!t || typeof t !== "object")
            delete s.tapAccentStrength;
        else {
            const clean = {};
            for (const [id, v] of Object.entries(t)) {
                if (typeof v === "number" && isFinite(v) && v >= 0 && v <= 4)
                    clean[id] = v;
            }
            s.tapAccentStrength = clean;
        }
    }
    // the Test Lab's Flight Test settings: a bad value falls back, never bricks
    if (s.testLab !== undefined) {
        const t = s.testLab;
        if (!t || typeof t !== "object")
            delete s.testLab;
        else {
            const o = t;
            const clean = {};
            if (typeof o.pattern === "string" && ["manual", "hover", "2", "4", "6", "8", "pairs", "station"].includes(o.pattern))
                clean.pattern = o.pattern;
            if (typeof o.speed === "number" && isFinite(o.speed) && o.speed >= 0.25 && o.speed <= 1)
                clean.speed = o.speed;
            s.testLab = clean;
        }
    }
    // Steady Gates and Rough Air are opposites; a save carrying both is
    // incoherent, and stilling the gates is the safer of the two to honour.
    // Rough Air is retired; a save that still has it on simply stops using
    // it, and the flag is left in place so an older build reading the same
    // save is not confused by a missing key.
    s.roughAir = false;
    // saves written before the lifetime tallies existed
    if (typeof s.runs !== "number")
        s.runs = 0;
    if (typeof s.lifetimeAcorns !== "number")
        s.lifetimeAcorns = s.acorns;
    if (!Array.isArray(s.zonesSeen))
        s.zonesSeen = [];
    if (!s.stars || typeof s.stars !== "object" || Array.isArray(s.stars))
        s.stars = {};
    // saves written before the guided path existed have already seen the
    // game — never walk a veteran to the hangar
    if (typeof s.guide !== "string")
        s.guide = s.tutorialDone ? "done" : "pending";
    if (typeof s.allStars !== "boolean")
        s.allStars = false;
    // Retain unknown and retired fields, including experimentalRaceRecords.
    // They do not certify a current mission or grant a new barrier clear.
    // saves written before the Spill was a mode
    if (typeof s.spillBest !== "number" || !isFinite(s.spillBest))
        s.spillBest = 0;
    s.spillBest = Math.max(0, Math.floor(s.spillBest));
    const records = freshSpillRecords();
    for (const key of Object.keys(records)) {
        const n = s.spillRecords?.[key];
        if (typeof n === "number" && Number.isFinite(n) && n >= 0)
            records[key] = Math.floor(n);
    }
    s.spillRecords = records;
    if (!restoreSpill(s.spillSuspended, 390, 760))
        s.spillSuspended = null;
    if (!SPILL_UTILITY_IDS.includes(s.spillStarter))
        s.spillStarter = null;
    s.spillSignal = s.spillSignal === true;
    s.spillEngineColor = spillEngineColor(s).id;
    s.spillSignal = s.spillEngineColor !== "stock";
    s.spillDepotGuideSeen = s.spillDepotGuideSeen === true;
    // favourites are ids only; anything else in the array is a hand-edit
    // the case used to remember "compact"; it starts folded now and only
    // remembers "expanded". The pin-to-home list is gone with its feature.
    delete s.heroCompact;
    delete s.pinnedRewards;
    if (!Array.isArray(s.favorites))
        s.favorites = [];
    s.favorites = [...new Set(s.favorites.filter((x) => typeof x === "string"))];
    if (!Array.isArray(s.raceGates))
        s.raceGates = [];
    // only ever the three real gate ids, de-duplicated - a hand-edited save
    // cannot invent a fourth and unlock the chart with it
    s.raceGates = [...new Set(s.raceGates.filter((n) => RACE_GATES.some((g) => g.after === n)))];
    if (!s.raceRecords || typeof s.raceRecords !== "object" || Array.isArray(s.raceRecords)) {
        s.raceRecords = {};
    }
    if (parsed && typeof parsed.xp !== "number") {
        const owned = Math.max(0, (s.unlocked?.length || 1) - 1) +
            Math.max(0, (s.unlockedSuits?.length || 1) - 1) +
            Math.max(0, (s.unlockedTrails?.length || 1) - 1) +
            Math.max(0, (s.unlockedPals?.length || 1) - 1);
        s.xp = Math.round(4 * (s.highScore + s.deepBest + s.lostBest) + s.acorns + 200 * owned);
    }
    if (BETA_UNLOCK_GATES && s.acorns < 10000)
        s.acorns = 10000;
    // Regrouping singles and duos must not reduce an existing beta grant or
    // change the historical amount used for a save without its grant total.
    // Future kit/single prices may raise funding; the beta's existing floor
    // stays intact. Granted once: a tester who spends it stays spent.
    if (IS_BETA) {
        const total = betaDustGrantTarget();
        if (!s.betaDustGrant) {
            s.starDust += total;
            s.betaDustGrant = true;
            s.betaDustGrantTotal = total;
        }
        else {
            // A later funding increase tops up only the difference. A save that
            // never recorded its total received the historical non-fixed packs;
            // the current bundle grouping cannot reconstruct that old amount.
            const had = typeof s.betaDustGrantTotal === "number" && isFinite(s.betaDustGrantTotal)
                ? s.betaDustGrantTotal
                : BETA_LEGACY_DUST_GRANT_TOTAL;
            if (total > had)
                s.starDust += total - had;
            s.betaDustGrantTotal = Math.max(had, total);
        }
    }
    if (parsed && !parsed.campaignProgress) {
        // Save the exact source before any migrated write. A failed backup leaves
        // the original save untouched; normal load still works in restricted storage.
        try {
            const key = SAVE_KEY + ":before-campaign-v1";
            if (!platform.storage.get(key))
                platform.storage.set(key, JSON.stringify(parsed));
        }
        catch { /* writeSave will still surface a real persistence failure */ }
    }
    migrateCampaign(s, !!parsed, !!source && source.key !== SAVE_KEY);
    // ACORNUT'S GATE READS THE LEDGER (audit, 8 Sep 2026). This used to count
    // bits in the legacy `stars` map, which is only a compatibility bridge:
    // for an ambiguous mission it carries the finish bit alone, so a pilot at
    // 570 real stars could total ~190 there and have AcorNut torn off on
    // every launch. suitRevealed asks the same question the rest of the game
    // asks (purchased, the ledger's star total, the beta). It must run AFTER
    // migrateCampaign: that call caches on first use, and an earlier starsOf()
    // would build the ledger without the cross-page ambiguity flag.
    // COLLECTING ACORNUT STICKS (owner, 8 Sep 2026: "i still have to collect
    // acornut everytime i load in"). This strip used to be unconditional, so
    // the entry the collect tap writes was torn back out on the next load:
    // the shelf saw a revealed, unowned, free suit and printed COLLECT REWARD
    // again, forever. It only ever existed to refuse an entry nobody earned,
    // so it asks that question now - and it cannot ask suitRevealed, which
    // says yes BECAUSE of the entry being judged.
    if (!tutorialSuitEarned(s))
        s.unlockedSuits = s.unlockedSuits.filter((id) => id !== TUTORIAL_SUIT);
    if (s.equippedSuit === TUTORIAL_SUIT && !suitRevealed(s, TUTORIAL_SUIT))
        s.equippedSuit = "flight";
    if (IS_BETA && !s.betaSampleCreditImported) {
        try {
            const raw = platform.storage.get("acornaut_star_map_sample_v1");
            const archived = raw ? JSON.parse(raw) : null;
            if (archived && typeof archived === "object" && (archived.stars || archived.campaignProgress?.version === 1)) {
                if (parsed && !platform.storage.get(SAVE_KEY + ":before-beta-260"))
                    platform.storage.set(SAVE_KEY + ":before-beta-260", JSON.stringify(parsed));
                importSampleCredit(s, { ...defaultSave(), ...archived });
            }
            s.betaSampleCreditImported = true;
        }
        catch { /* Preserve both source slots if storage is unavailable. */ }
    }
    return s;
}
/** The one place a pilot name is made safe. Control characters and line
 *  breaks are stripped because the name is rendered into a single-line
 *  element, runs of whitespace are collapsed so a name cannot be padded to
 *  look longer than it is, and the result is capped. Kept here rather than
 *  at the input so a save hand-edited in devtools gets the same treatment
 *  as a name typed into the box. */
export const PILOT_NAME_MAX = 18;
export function cleanPilotName(raw) {
    return (raw || "")
        // eslint-disable-next-line no-control-regex
        // to a SPACE, not to nothing: a pasted name carrying a line break
        // should read as two words, not silently become one
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, PILOT_NAME_MAX);
}
/** THE TUTORIAL'S KIT. The guided path points at the Ion suit and helmet
 *  and the coach calls them "your new ION SUIT" - but nothing ever granted
 *  them, so a fresh pilot was sent to the hangar to admire a 140-acorn suit
 *  they had 0 acorns for. Finishing the tutorial hands them over, which is
 *  what the copy has always claimed. Idempotent: it only ever adds. */
export function grantTutorialKit(s) {
    if (!s.unlockedSuits.includes(GUIDE_SUIT))
        s.unlockedSuits.push(GUIDE_SUIT);
    if (!s.unlocked.includes(GUIDE_HELM))
        s.unlocked.push(GUIDE_HELM);
    // THE TUTORIAL SUIT GOES BACK (owner, 6 Sep 2026: "immediately after the
    // tutorial is done, he is locked"). The first flight is flown in AcorNut;
    // graduation locks him behind his 500 stars and seats the pilot in
    // Flight, so the shelf shows a worn suit while the coach walks them to
    // the Ion kit.
    // ...unless the 570 stars are already in, in which case he is the
    // pilot's outright and graduation has nothing to take back.
    if (!tutorialSuitEarned(s))
        s.unlockedSuits = s.unlockedSuits.filter(id => id !== TUTORIAL_SUIT);
    if (s.equippedSuit === TUTORIAL_SUIT && !suitRevealed(s, TUTORIAL_SUIT))
        s.equippedSuit = "flight";
}
export function writeSave(s) {
    // through the bridge: localStorage on the web, the shell's durable
    // store in an app - the ONE place the save is written
    platform.storage.set(SAVE_KEY, JSON.stringify(s));
}
// The one deliberate way to start over. Writes a FRESH save into this
// build's own slot — never a bare delete, because the beta slot would
// quietly re-seed itself from the production save on the next load.
export function eraseSave() {
    writeSave(defaultSave());
}
export function starsOf(s) {
    const p = migrateCampaign(s);
    return Math.max(earnedCampaignStars(s, CHART_LEVELS), p.legacyEntitlementFloor, s.allStars ? CHART_MAX_STARS : 0);
}
// Progression is EARNED BY STARS now — the Star Chart is the one ladder.
// The old XP thresholds are retired for good with the production split:
// a gate is stars, a stored unlock, or the beta. Nothing else opens one.
export function palUnlocked(s, id) {
    if (STAR_UNLOCKS.pals[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.pals[id])
        return true;
    if (isIap(id))
        return iapOwned(s, id);
    return BETA_UNLOCK_GATES || s.unlockedPals.includes(id);
}
// Helmets with a rung on the ladder reveal at their star count; the four
// starter tints have no rung and are open from the first flight. A helmet
// already bought stays owned whatever the ladder says.
export function helmetRevealed(s, id) {
    if (STAR_UNLOCKS.helmets[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.helmets[id])
        return true;
    if (isIap(id))
        return iapOwned(s, id);
    if (STAR_UNLOCKS.helmets[id] === undefined)
        return true;
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.helmets[id] || s.unlocked.includes(id);
}
// Trails unlock on the ROADMAP only: a rung on the ladder, or the beta.
// Sparks has no rung and is everyone's from the first flight; premium
// trails keep the purchase contract.
export function trailUnlocked(s, id) {
    // THE WAKE HAS ITS OWN RUNG at 520, fifty stars ahead of AcorNut, and
    // this line used to answer before the ladder below was ever read: an
    // audit found the crossed rung still printing "525 of 520 stars" with a
    // HOLD TO USE STAR UNLOCK button, so a pilot could burn a 500-dust boost
    // on a trail the chart had already given them. The rung counts here too;
    // it cannot leak the wake onto another suit, which canWearTrail still
    // refuses.
    if (id === "vanguardwake")
        return suitRevealed(s, "vanguard") || s.unlockedTrails.includes(id)
            || starsOf(s) >= (STAR_UNLOCKS.trails[id] ?? Infinity);
    if (id === "arcflashwake")
        return suitRevealed(s, "arcflash");
    const orbitSuit = highOrbitTrailSuit(id);
    if (orbitSuit)
        return suitRevealed(s, orbitSuit);
    if (STAR_UNLOCKS.trails[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.trails[id])
        return true;
    if (isIap(id))
        return iapOwned(s, id);
    if (STAR_UNLOCKS.trails[id] === undefined)
        return true;
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.trails[id] || s.unlockedTrails.includes(id);
}
/** IS ACORNUT EARNED, judged WITHOUT the unlockedSuits entry. suitRevealed
 *  answers "does the pilot have him", and one of the ways it says yes is
 *  that his id is sitting in unlockedSuits - so it can never be asked
 *  whether that entry deserves to be there. This asks the question the
 *  entry cannot answer about itself: bought, or 570 stars on the road, or
 *  the beta, which opens every gate. */
export function tutorialSuitEarned(s) {
    if ((s.purchased || []).includes(TUTORIAL_SUIT))
        return true;
    if (BETA_UNLOCK_GATES)
        return true;
    const gate = STAR_UNLOCKS.suits[TUTORIAL_SUIT];
    return gate !== undefined && starsOf(s) >= gate;
}
export function suitRevealed(s, id) {
    // anyone who BOUGHT a suit keeps it, even one that has since moved off
    // the premium list - the cat did exactly that when it became the
    // 300-star prize
    if ((s.purchased || []).includes(id) || s.unlockedSuits.includes(id))
        return true;
    if (STAR_UNLOCKS.suits[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.suits[id])
        return true;
    if (isIap(id))
        return iapOwned(s, id);
    // a suit with a star gate is LOCKED below it - the no-gate fallback is
    // only for suits with no gate at all, or the cat would have been free
    if (STAR_UNLOCKS.suits[id] !== undefined)
        return BETA_UNLOCK_GATES;
    // no gate at all: on the shelf for everyone
    return true;
}
// Premium items are owned only once bought - on BOTH pages. The beta used
// to hand them over outright, which meant the one thing the beta could
// never test was the shop itself: every pack read as already owned, so the
// buy path, the price check and the dust ledger were all dead code to a
// tester. The beta is granted enough Star Dust to buy every pack instead
// (see betaDustGrant below), so the mechanic gets exercised and the items
// still end up in the hangar.
export function iapOwned(s, id) {
    return (s.purchased || []).includes(id);
}
// Flight mods change how the game FEELS, so they are held back until a
// player has flown enough of the chart to have an opinion about it.
// A mod or a mode opened with a Star Unlock is opened: the reward's id
// sits in keyUnlocks and every gate below reads it beside the stars.
const keyed = (s, id) => (s.keyUnlocks || []).includes(id);
export function modsUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.flightMods || keyed(s, "flightmods");
}
export function deepUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.deep || keyed(s, "deep");
}
export function lostUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.lost || keyed(s, "lost");
}
export function startShieldUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.startShield || keyed(s, "startShield");
}
export function batteryUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.battery || keyed(s, "battery");
}
/** the second companion slot (owner, 7 Sep 2026): a Star Chart reward */
export function dualPalUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.dualPal || keyed(s, "dualpal");
}
// ------------------------------------------------------ star chart boosts
// The rules live here, on the save, so the harness can prove them without
// a DOM: the engine wraps each one with a write and a notify.
/** a boost held in the account, waiting to be spent on the Star Chart */
export function boostReady(s, id) {
    return (s.boosts?.[id] ?? 0) > 0;
}
/** BUYING PUTS IT IN THE ACCOUNT (owner, 8 Sep 2026: "if they pay but
 *  lose connection or close app, it may be lost on the prompt, so it must
 *  stay in their account"). The Shop charges Star Dust and the count goes
 *  up; the Star Chart is where it is spent, one hold-to-confirm at a time. */
export function buyBoost(s, id) {
    if (s.starDust < BOOSTS[id].dust)
        return "poor";
    s.starDust -= BOOSTS[id].dust;
    s.boosts[id] = (s.boosts[id] ?? 0) + 1;
    return "ok";
}
function spendBoost(s, id) {
    if (!boostReady(s, id))
        return "none";
    s.boosts[id] -= 1;
    return "ok";
}
/** why a Level Skip cannot land on this mission, or "ok" */
export function skipEligible(s, def) {
    if (def.standalone || def.base === "race")
        return "hyper";
    if (missionCredit(s, def) >= 3)
        return "done";
    if (!levelUnlocked(def, routeMasks(s), starsOf(s), s.raceGates || []))
        return "locked";
    return "ok";
}
/** every mission a Level Skip could land on right now, in road order */
export function skippableLevels(s) {
    return CHART_LEVELS.filter((def) => skipEligible(s, def) === "ok");
}
/** LEVEL SKIP: three stars on a reachable, unfinished mission. The credit
 *  goes through the same ledger a flown finish uses, so the road, the
 *  star total and every reward line read it the same way. */
export function skipLevel(s, def) {
    const why = skipEligible(s, def);
    if (why !== "ok")
        return why;
    const paid = spendBoost(s, "levelskip");
    if (paid !== "ok")
        return paid;
    settleMissionCredit(s, def, 7);
    return "ok";
}
/** is this Star Chart reward already the pilot's, by stars or otherwise? */
export function rewardOwned(s, r) {
    if (r.kind === "acorns" || r.kind === "dust")
        return starsOf(s) >= r.stars;
    if (!r.id)
        return starsOf(s) >= r.stars;
    switch (r.kind) {
        case "suit": return suitRevealed(s, r.id);
        case "helmet": return helmetRevealed(s, r.id);
        case "trail": return trailUnlocked(s, r.id);
        case "pal": return palUnlocked(s, r.id);
        case "mode": return r.id === "deep" ? deepUnlocked(s) : r.id === "lost" ? lostUnlocked(s) : starsOf(s) >= r.stars;
        case "mod": return r.id === "startShield" ? startShieldUnlocked(s)
            : r.id === "battery" ? batteryUnlocked(s)
                : r.id === "flightmods" ? modsUnlocked(s)
                    : r.id === "dualpal" ? dualPalUnlocked(s)
                        : starsOf(s) >= r.stars;
        default: return starsOf(s) >= r.stars;
    }
}
/** the rewards a Star Unlock can open: items, not currency, not owned */
export function unlockableRewards(s) {
    return STAR_REWARDS.filter((r) => r.kind !== "acorns" && r.kind !== "dust" && r.kind !== "stage"
        && r.kind !== "title" && !!r.id && !rewardOwned(s, r));
}
/** STAR UNLOCK: one reward item ahead of its stars. Wardrobe rewards land
 *  in the same unlocked* list a star crossing would fill; mods and modes
 *  are keyed by the reward's id. */
export function unlockReward(s, r) {
    // only the kinds an unlock can actually hand over; anything else (a
    // currency line, a stage, a title) would spend the boost and open nothing
    const openable = r.kind === "suit" || r.kind === "helmet" || r.kind === "trail"
        || r.kind === "pal" || r.kind === "mod" || r.kind === "mode";
    if (!openable || !r.id)
        return "currency";
    if (rewardOwned(s, r))
        return "owned";
    const paid = spendBoost(s, "starunlock");
    if (paid !== "ok")
        return paid;
    const add = (list) => { if (!list.includes(r.id))
        list.push(r.id); };
    // a premium id is owned through `purchased` - the one list every gate
    // and the shop read for it - so a Star Unlock lands it there, with the
    // set trail the shop would hand over beside it (idGrants)
    if (r.kind === "mod" || r.kind === "mode")
        add(s.keyUnlocks);
    else if (isIap(r.id)) {
        s.purchased = [...new Set([...(s.purchased || []), ...idGrants(r.id)])];
    }
    else if (r.kind === "suit")
        add(s.unlockedSuits);
    else if (r.kind === "helmet")
        add(s.unlocked);
    else if (r.kind === "trail")
        add(s.unlockedTrails);
    else if (r.kind === "pal")
        add(s.unlockedPals);
    add(s.boostedRewards);
    return "ok";
}
/** DOES THE PILOT HAVE THIS PREMIUM ID, by any route: bought, opened with
 *  a Star Unlock, or earned on the road. The shop reads this rather than
 *  the purchase list alone, so an item the road handed over leaves the
 *  shelf and comes off a pack's price (owner, 8 Sep 2026: "once they earn
 *  it on the road, it's removed from the shop"). */
export function ownsPremium(s, id) {
    if ((s.purchased || []).includes(id))
        return true;
    if (SUITS.some((u) => u.id === id))
        return suitRevealed(s, id);
    if (HELMETS.some((h) => h.id === id))
        return helmetRevealed(s, id);
    if (PALS.some((p) => p.id === id))
        return palUnlocked(s, id);
    if (TRAILS.some((t) => t.id === id))
        return trailUnlocked(s, id);
    return false;
}
/** PAY EVERY RUNG THE PILOT HAS CROSSED AND NOT BEEN PAID FOR. Currency
 *  rungs pay their amount. An item rung whose item another route already
 *  handed over pays currency in its place: Star Dust for a shop purchase,
 *  acorns for a Star Unlock. Every crossed rung is written to the ledger
 *  once, so nothing pays twice. The caller writes the save. Returns the
 *  total paid. */
export function settleStarRewards(s) {
    const have = starsOf(s);
    const ledger = migrateCampaign(s);
    let dust = 0, acorns = 0, high = s.dustPaidTo;
    for (const r of STAR_REWARDS) {
        if (r.stars > have)
            continue;
        const key = rewardId(r);
        if (ledger.paidRewards.includes(key))
            continue;
        if (r.kind === "dust" || r.kind === "acorns") {
            if (!r.amount)
                continue;
            if (r.kind === "dust") {
                dust += r.amount;
                high = Math.max(high, r.stars);
            }
            else
                acorns += r.amount;
            ledger.paidRewards.push(key);
            continue;
        }
        if (!r.id)
            continue;
        // already yours, by Star Unlock or by purchase: the rung pays the one
        // flat substitute either way
        if ((s.boostedRewards || []).includes(r.id) || (s.purchased || []).includes(r.id)) {
            const sub = substituteFor(r.stars);
            if (sub.kind === "dust")
                dust += sub.amount;
            else
                acorns += sub.amount;
            s.rewardSubs = { ...(s.rewardSubs || {}), [key]: sub };
        }
        ledger.paidRewards.push(key);
    }
    if (dust <= 0 && acorns <= 0)
        return 0;
    s.starDust += dust;
    s.acorns += acorns;
    s.dustPaidTo = high;
    return dust + acorns;
}
/** the companions the hangar has equipped, high slot first, without the
 *  empty "none" - the one list every screen that shows a pal reads */
export function equippedPals(s) {
    return [s.equippedPal, s.equippedPal2].filter((p) => p && p !== "none");
}
/** The beta A/B preference cannot opt production into an experiment. */
/** the forward lean a suit flies at: the dialled number, else the catalog default */
export function suitPitchFor(save, id) {
    const v = save?.suitPitch?.[id];
    return typeof v === "number" && isFinite(v) ? v : suitPitchDefault(id);
}
/** how a tap moves this suit's ascent bank: the beta dial if set, else the
 *  table; null is the stock ramp. A live build never reads the dial. */
export function tapShapeFor(save, id) {
    const dialled = IS_BETA ? save?.tapShape?.[id] : undefined;
    if (dialled === "default")
        return null;
    if (dialled !== undefined)
        return dialled;
    return TAP_SHAPE[id] ?? null;
}
/** this suit's tap accent strength: the beta dial if set, else the
 *  TAP_ACCENT_STRENGTH table, else 1. 0 means no accent on this suit. A
 *  live build flies the table. */
export function tapAccentStrengthFor(save, suitId) {
    const dialled = IS_BETA ? save?.tapAccentStrength?.[suitId] : undefined;
    const v = typeof dialled === "number" && isFinite(dialled) ? dialled : TAP_ACCENT_STRENGTH[suitId] ?? 1;
    return Math.max(TAP_ACCENT_MIN, Math.min(TAP_ACCENT_MAX, v));
}
/** this suit's tail spring multipliers: the beta dial if set, else the
 *  table, else 1/1/1. A live build never reads the dial. */
export function tailSpringFor(save, id) {
    const dialled = IS_BETA ? save?.tailSpring?.[id] : undefined;
    return dialled ?? TAIL_SPRING[id] ?? TAIL_SPRING_ONE;
}
