import { STAR_UNLOCKS, totalStars, RACE_GATES, } from "./campaign.js?v=160";
import { BETA_UNLOCK_GATES, HELMETS, LEGACY_KEYS, PALS, SAVE_KEY, SUITS, SUIT_REVEAL, isIap, TRAILS, levelForXp, titleForLevel, BUNDLES, IS_BETA, GUIDE_SUIT, GUIDE_HELM, } from "./catalog.js?v=160";
export function defaultSave() {
    return {
        highScore: 0,
        deepBest: 0,
        lostBest: 0,
        arcadeBest: 0,
        tunnelBest: 0,
        purchased: [],
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
        dailyStreak: 0,
        steadyGates: false,
        roughAir: false,
        noPalFx: false,
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
        runs: 0,
        lifetimeAcorns: 0,
        zonesSeen: [],
        stars: {},
        guide: "pending",
        allStars: false,
        musicOff: false,
        eclipseMotionMode: 2,
        raceRecords: {},
        raceGates: [],
    };
}
function readRaw(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
export function loadSave() {
    const parsed = readRaw(SAVE_KEY) ?? LEGACY_KEYS.map(readRaw).find(Boolean) ?? null;
    const s = { ...defaultSave(), ...parsed };
    if (!s.unlocked?.includes("clear"))
        s.unlocked = ["clear", ...(s.unlocked || [])];
    if (!s.unlockedSuits?.includes("flight"))
        s.unlockedSuits = ["flight", ...(s.unlockedSuits || [])];
    if (!s.unlockedTrails?.includes("sparks"))
        s.unlockedTrails = ["sparks", ...(s.unlockedTrails || [])];
    if (!s.unlockedPals?.includes("none"))
        s.unlockedPals = ["none", ...(s.unlockedPals || [])];
    if (!HELMETS.some((h) => h.id === s.equipped))
        s.equipped = "clear";
    // A save can arrive wearing things this build does not grant — the open
    // beta hands premium out, production does not, and the two share a
    // browser. Anything equipped but not owned HERE comes off; it is not
    // deleted from the save, so a real purchase puts it straight back on.
    if (isIap(s.equippedSuit) && !iapOwned(s, s.equippedSuit))
        s.equippedSuit = "flight";
    if (isIap(s.equipped) && !iapOwned(s, s.equipped))
        s.equipped = "clear";
    // a matched-set helmet stranded on the wrong suit (saved before the rule
    // existed, or edited by hand) comes off rather than half-fitting
    {
        const h = HELMETS.find((x) => x.id === s.equipped);
        if (h?.suitOnly && h.suitOnly !== s.equippedSuit)
            s.equipped = "clear";
    }
    if (!SUITS.some((u) => u.id === s.equippedSuit))
        s.equippedSuit = "flight";
    if (!TRAILS.some((t) => t.id === s.equippedTrail))
        s.equippedTrail = "sparks";
    if (!PALS.some((p) => p.id === s.equippedPal))
        s.equippedPal = "none";
    if (s.equippedPal !== "none" && !palUnlocked(s, s.equippedPal))
        s.equippedPal = "none";
    // saves written before Star Dust existed. dustPaidTo starts at 0 rather
    // than at the pilot's current stars, so a long-standing save is PAID its
    // backlog on next load instead of silently losing it.
    if (typeof s.starDust !== "number" || !isFinite(s.starDust))
        s.starDust = 0;
    if (typeof s.dustPaidTo !== "number" || !isFinite(s.dustPaidTo))
        s.dustPaidTo = 0;
    if (typeof s.betaDustGrant !== "boolean")
        s.betaDustGrant = false;
    if (typeof s.shelfGrid !== "boolean")
        s.shelfGrid = false;
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
    if (typeof s.dailyStreak !== "number" || !isFinite(s.dailyStreak))
        s.dailyStreak = 0;
    // saves written before the flight mods existed
    for (const k of ["steadyGates", "roughAir", "thrillSeeker", "noPalFx"]) {
        if (typeof s[k] !== "boolean")
            s[k] = false;
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
    // Hyper Run's records used to live under experimentalRaceRecords, keyed
    // by "prototype-chapter-1". Both names were prototype-era and the owner
    // confirmed the only records were their own testing, so the old key is
    // dropped rather than migrated - left in place it would sit in every
    // save forever, describing a mission id that no longer exists.
    delete s.experimentalRaceRecords;
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
    // BETA STARTING DUST: exactly the price of every pack, summed from
    // BUNDLES rather than written as a number, so re-pricing a pack can never
    // leave a tester unable to afford the set. Granted ONCE - a tester who
    // spends it is meant to stay spent, or the ledger is untestable too.
    if (IS_BETA && !s.betaDustGrant) {
        s.starDust += BUNDLES.reduce((n, b) => n + b.dust, 0); // every pack, at sticker price
        s.betaDustGrant = true;
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
}
export function writeSave(s) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}
// The one deliberate way to start over. Writes a FRESH save into this
// build's own slot — never a bare delete, because the beta slot would
// quietly re-seed itself from the production save on the next load.
export function eraseSave() {
    writeSave(defaultSave());
}
export function pilotLevelOf(s) {
    return levelForXp(s.xp || 0);
}
export function pilotTitleOf(s) {
    return titleForLevel(pilotLevelOf(s));
}
export function starsOf(s) {
    // Briella's code: every star gate in the game asks this one function,
    // so believing here is believing everywhere. Real level progress and
    // its pips stay exactly as earned.
    if (s.allStars)
        return 300;
    return totalStars(s.stars || {});
}
// Progression is EARNED BY STARS now — the Star Chart is the one ladder.
// The old XP thresholds are retired for good with the production split:
// a gate is stars, a stored unlock, or the beta. Nothing else opens one.
export function palUnlocked(s, id) {
    if (isIap(id))
        return iapOwned(s, id);
    if (STAR_UNLOCKS.pals[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.pals[id])
        return true;
    return BETA_UNLOCK_GATES || s.unlockedPals.includes(id);
}
// Helmets with a rung on the ladder reveal at their star count; the four
// starter tints have no rung and are open from the first flight. A helmet
// already bought stays owned whatever the ladder says.
export function helmetRevealed(s, id) {
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
    if (isIap(id))
        return iapOwned(s, id);
    if (STAR_UNLOCKS.trails[id] === undefined)
        return true;
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.trails[id] || s.unlockedTrails.includes(id);
}
export function suitRevealed(s, id) {
    // anyone who BOUGHT a suit keeps it, even one that has since moved off
    // the premium list - the cat did exactly that when it became the
    // 300-star prize
    if ((s.purchased || []).includes(id))
        return true;
    if (isIap(id))
        return iapOwned(s, id);
    if (STAR_UNLOCKS.suits[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.suits[id])
        return true;
    // a suit with a star gate is LOCKED below it - the no-gate fallback is
    // only for suits with no gate at all, or the cat would have been free
    if (STAR_UNLOCKS.suits[id] !== undefined)
        return BETA_UNLOCK_GATES;
    return !SUIT_REVEAL[id] || BETA_UNLOCK_GATES;
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
export function modsUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.flightMods;
}
export function deepUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.deep;
}
export function lostUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.lost;
}
export function startShieldUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.startShield;
}
export function batteryUnlocked(s) {
    return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.battery;
}
