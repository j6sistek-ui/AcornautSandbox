import { STAR_UNLOCKS, totalStars } from "./campaign.js?v=95";
import { BETA_UNLOCK_GATES, HELMETS, LEGACY_KEYS, PALS, SAVE_KEY, SUITS, SUIT_REVEAL, isIap, TRAILS, levelForXp, titleForLevel, } from "./catalog.js?v=95";
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
        steadyGates: false,
        roughAir: false,
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
        voltAltJump: false,
        experimentalRaceRecords: {},
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
    // saves written before the flight mods existed
    for (const k of ["steadyGates", "roughAir", "thrillSeeker"]) {
        if (typeof s[k] !== "boolean")
            s[k] = false;
    }
    // Steady Gates and Rough Air are opposites; a save carrying both is
    // incoherent, and stilling the gates is the safer of the two to honour.
    if (s.steadyGates && s.roughAir)
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
    if (!s.experimentalRaceRecords || typeof s.experimentalRaceRecords !== "object" || Array.isArray(s.experimentalRaceRecords)) {
        s.experimentalRaceRecords = {};
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
    return s;
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
    if (isIap(id))
        return iapOwned(s, id);
    if (STAR_UNLOCKS.suits[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.suits[id])
        return true;
    return !SUIT_REVEAL[id] || BETA_UNLOCK_GATES;
}
// Premium items are owned only once bought for real money. The beta
// grants them outright so they can be flown and judged before release.
export function iapOwned(s, id) {
    return BETA_UNLOCK_GATES || (s.purchased || []).includes(id);
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
