import { RACE_MAX_ACORNS, RACE_RINGS, RACE_THREE_STAR_TICKS, RACE_TWO_STAR_TICKS, } from "./race.js?v=88";
// ------------------------------------------------------------------ stages
const lerp = (a, b, t) => a + (b - a) * t;
export const STAGES = [
    {
        num: 1,
        name: "FLIGHT SCHOOL",
        tagline: "Learn the sky before it learns you.",
        env: 0, // DEEP SPACE
        base: "fly",
        unlock: 0,
        tune: (i) => ({
            gates: 8 + i, // 8 .. 17
            fx: { pace: lerp(0.92, 1.0, i / 9), gapScale: lerp(1.12, 1.0, i / 9), acornEvery: true },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: Math.min(3 + i, Math.max(3, g - 4)) },
            i % 3 === 2 ? { kind: "noBounce" }
                : i % 3 === 1 ? { kind: "maxTaps", n: g * 3 }
                    : { kind: "gold", n: 1 },
        ],
        names: [
            "First Solo", "Trim the Line", "Clean Approach", "Fuel Run", "Golden Hourglass",
            "Steady Hands", "Long Glide", "Feather Throttle", "No Scratches", "Graduation",
        ],
    },
    {
        num: 2,
        name: "NURSERY BLOOM",
        tagline: "The nebula is beautiful and it moves.",
        env: 1, // NEBULA NURSERY
        base: "fly",
        unlock: 12,
        tune: (i) => ({
            gates: 12 + i, // 12 .. 21
            fx: { driftScale: lerp(1.2, 1.5, i / 9), acornEvery: true },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: 4 + Math.floor(i / 2) },
            i % 3 === 0 ? { kind: "noBounce" }
                : i % 3 === 1 ? { kind: "gold", n: 1 + (i > 5 ? 1 : 0) }
                    : { kind: "noShield" },
        ],
        names: [
            "Bloomfield", "Pollen Drift", "Cradle Rock", "Petal Gap", "Slow Waltz",
            "Rooted Deep", "Wide Sway", "Nursery Rhyme", "Full Bloom", "Seedfall",
        ],
    },
    {
        num: 3,
        name: "ICE MOON",
        tagline: "Everything narrow, everything bright.",
        env: 2, // ICE MOON
        base: "fly",
        unlock: 27,
        tune: (i) => ({
            gates: 14 + i, // 14 .. 23
            fx: { gapScale: lerp(1.0, 0.94, i / 9), driftScale: 1.15, acornEvery: true },
        }),
        goals: (i, g) => [
            i % 2 === 0 ? { kind: "acorns", n: 6 + Math.floor(i / 2) } : { kind: "gold", n: 2 },
            i % 3 === 2 ? { kind: "flawless" }
                : i % 3 === 0 ? { kind: "noBounce" }
                    : { kind: "maxTaps", n: Math.round(g * 2.6) },
        ],
        names: [
            "Thin Ice", "Frostbite", "Narrows", "Crevasse", "Glacier Line",
            "White Static", "Cold Snap", "Icicle Alley", "Pressure Ridge", "Moonfall",
        ],
    },
    {
        num: 4,
        name: "SOLAR FURNACE",
        tagline: "The sky burns and the clock runs hot.",
        env: 3, // SOLAR FURNACE
        base: "fly",
        unlock: 45,
        tune: (i) => ({
            gates: 15 + i, // 15 .. 24
            fx: { pace: lerp(1.08, 1.22, i / 9), acornEvery: true },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: 7 + Math.floor(i / 2) },
            i % 3 === 1 ? { kind: "noBounce" }
                : i % 3 === 2 ? { kind: "noShield" }
                    : { kind: "gold", n: 2 },
        ],
        names: [
            "Kindling", "Slow Roast", "Heat Shimmer", "Flare Stack", "Coronal Run",
            "Afterburner", "Melting Point", "Solar Wind", "White Heat", "Out of the Fire",
        ],
    },
    {
        num: 5,
        name: "MIDNIGHT RUN",
        tagline: "The dark closes in. Fly by the little you see.",
        env: 9, // SAPPHIRE ABYSS
        base: "fly",
        unlock: 66,
        tune: (i) => ({
            gates: 15 + i, // 15 .. 24
            fx: { fog: lerp(0.45, 0.75, i / 9), acornEvery: true },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: 6 + Math.floor(i / 2) },
            i % 3 === 0 ? { kind: "noShield" }
                : i % 3 === 1 ? { kind: "noBounce" }
                    : { kind: "maxTaps", n: Math.round(g * 2.4) },
        ],
        names: [
            "Dusk", "Lantern Out", "Narrowed Eyes", "Deep Water", "Night Current",
            "Closing Iris", "Blue Hour", "Half Blind", "Abyssal", "Midnight Proper",
        ],
    },
    {
        num: 6,
        name: "CRYSTAL BELT",
        tagline: "Deep space rules: the sky itself keeps shifting.",
        env: 4, // CRYSTAL BELT
        base: "deep",
        unlock: 90,
        tune: (i) => ({
            gates: 12 + i, // 12 .. 21
            fx: { acornEvery: true },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: 5 + Math.floor(i / 2) },
            i % 3 === 2 ? { kind: "flawless" }
                : i % 3 === 0 ? { kind: "noBounce" }
                    : { kind: "gold", n: 2 },
        ],
        names: [
            "Facet One", "Refraction", "Prism Break", "Lattice", "Inclusion",
            "Cleave Line", "Scatter", "Fracture Zone", "Core Sample", "The Jewel",
        ],
    },
    {
        num: 7,
        name: "CRIMSON STORM",
        tagline: "Turbulence. The gates will not sit still.",
        env: 8, // CRIMSON STORM
        base: "fly",
        unlock: 117,
        tune: (i) => ({
            gates: 16 + i, // 16 .. 25
            fx: {
                driftScale: lerp(1.5, 2.0, i / 9),
                driftRate: lerp(1.4, 1.9, i / 9),
                pace: 1.05,
                acornEvery: true,
            },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: 8 + Math.floor(i / 2) },
            i % 3 === 1 ? { kind: "flawless" }
                : i % 3 === 2 ? { kind: "noBounce" }
                    : { kind: "noShield" },
        ],
        names: [
            "Front Coming In", "Squall", "Red Ceiling", "Gale Gates", "Eye Wall",
            "Downdraft", "Shear", "Thunderhead", "Landfall", "Stormbreaker",
        ],
    },
    {
        num: 8,
        name: "LOST REACHES",
        tagline: "Lost-in-space rules: tilt, drift, mirror.",
        env: 10, // VIOLET REALM
        base: "lost",
        unlock: 147,
        tune: (i) => ({
            gates: 12 + i, // 12 .. 21
            fx: { acornEvery: true },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: 5 + Math.floor(i / 2) },
            i % 3 === 0 ? { kind: "noBounce" }
                : i % 3 === 1 ? { kind: "gold", n: 2 }
                    : { kind: "noShield" },
        ],
        names: [
            "Which Way Up", "Slantwise", "Mirror Left", "Vertigo", "Compass Spin",
            "Wrong Horizon", "Tumbled", "Sideways Rain", "The Long Way", "Found",
        ],
    },
    {
        num: 9,
        name: "THE BLACKOUT",
        tagline: "You see for half a second after each tap. Remember the rest.",
        env: 6, // MONOCHROME VOID
        base: "fly",
        unlock: 180,
        tune: (i) => ({
            gates: 8 + i, // 8 .. 17
            fx: {
                strobe: true,
                gapScale: lerp(1.12, 1.02, i / 9), // mercy, tapering
                pace: 0.95,
                driftScale: i >= 5 ? 1.2 : 1, // late levels sway in the dark
                acornEvery: true,
            },
        }),
        goals: (i, g) => [
            { kind: "acorns", n: 3 + Math.floor(i / 2) },
            i % 3 === 2 ? { kind: "flawless" }
                : i % 3 === 0 ? { kind: "noBounce" }
                    : { kind: "maxTaps", n: Math.round(g * 3.2) }, // taps ARE sight here
        ],
        names: [
            "Lights Out", "Afterimage", "Count the Beats", "Flashbulb", "Dead Reckoning",
            "Echo Location", "Blink", "Photograph", "Total Recall", "Eyes Shut",
        ],
    },
    {
        num: 10,
        name: "EVENT HORIZON",
        tagline: "Everything the sky has learned, at once.",
        env: 13, // HYPERVIVID
        base: "fly",
        unlock: 216,
        tune: (i) => {
            // the final ten rotate the whole game's machinery
            if (i < 3)
                return { gates: 18 + i * 2, base: "arcade", fx: { acornEvery: true } };
            if (i < 6)
                return { gates: 20 + i, base: "deep", fx: { fog: 0.5, acornEvery: true } };
            if (i < 9)
                return {
                    gates: 22 + i,
                    base: "lost",
                    fx: { driftScale: 1.5, acornEvery: true },
                };
            // level 100: the horizon
            return {
                gates: 30,
                base: "fly",
                fx: { strobe: true, fog: 0.4, driftScale: 1.5, pace: 1.1, acornEvery: true },
            };
        },
        goals: (i, g) => [
            { kind: "acorns", n: 8 + i },
            i % 3 === 0 ? { kind: "flawless" }
                : i % 3 === 1 ? { kind: "noShield" }
                    : { kind: "noBounce" },
        ],
        names: [
            "Old Timeline", "8-Bit Heart", "Museum Piece", "Shifting Ground", "Half Light",
            "Triple Shift", "Tilted Crown", "Mirrorfall", "Last Reach", "THE HORIZON",
        ],
    },
];
// ------------------------------------------------------------------ levels
export const LEVELS = STAGES.flatMap((st) => Array.from({ length: 10 }, (_, i) => {
    const t = st.tune(i);
    const gates = t.gates;
    const [g2, g3] = st.goals(i, gates);
    return {
        id: `${st.num}-${i + 1}`,
        stage: st.num,
        n: i + 1,
        ord: (st.num - 1) * 10 + i + 1,
        name: st.names[i],
        base: t.base ?? st.base,
        gates,
        fx: { env: st.env, ...t.fx },
        goals: [{ kind: "finish" }, g2, g3],
    };
}));
// ---------------------------------------------------- the BETA divergence
//
// Read here rather than imported from catalog.ts: build-roadmap.mjs
// compiles this file ALONE, and in node there is no window — so the
// roadmap always documents the LIVE chart, which is the point.
const IS_BETA = typeof window !== "undefined" &&
    window.__ACORNAUT_BETA__ === true;
//
// BETA ONLY — the first deliberate fork between the two pages. On the
// beta, every chapter from 2 on gives two of its levels to the test
// modes: level N-4 becomes a WORMHOLE RUN mission, level N-8 a SPILL
// mission. Level ids and star masks are unchanged, so one save reads
// identically on both pages, and reverting is deleting this block —
// the live chart underneath is the fallback, untouched.
//
// Tunnel targets are SECTIONS; spill targets are SECONDS. Both climb
// with the chapter. Tune freely — the level spreadsheet mirrors this.
if (IS_BETA) {
    for (const l of LEVELS) {
        if (l.stage < 2)
            continue;
        if (l.n === 4) {
            l.base = "tunnel";
            l.gates = 20 + l.stage * 5; // SECONDS survived: 30..70
            l.goals = [
                { kind: "finish" },
                { kind: "acorns", n: 4 + l.stage * 2 }, // 8..24 acorns
                { kind: "flow", n: l.stage >= 7 ? 4 : l.stage >= 4 ? 3 : 2 },
            ];
            l.fx = { env: l.fx.env }; // missions run their own physics
        }
        else if (l.n === 8) {
            l.base = "spill";
            l.gates = 20 + l.stage * 5; // 30..70 seconds
            l.goals = [
                { kind: "finish" },
                { kind: "score", n: 200 + l.stage * 100 },
                { kind: "score", n: 500 + l.stage * 250 },
            ];
            l.fx = { env: l.fx.env };
        }
    }
}
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? null;
/** Beta proof-of-concept. It deliberately does not live in LEVELS, so it
 * cannot change chapter counts, unlock order, star totals, or rewards. */
export const PROTOTYPE_RACE_MAX_ACORNS = RACE_MAX_ACORNS;
export const PROTOTYPE_RACE_MISSION = {
    id: "prototype-chapter-1",
    stage: 0,
    n: 1,
    ord: 0,
    name: "HYPER RUN",
    base: "race",
    gates: RACE_RINGS.length,
    fx: { env: 0 },
    goals: [
        { kind: "finish" },
        { kind: "time", ticks: RACE_TWO_STAR_TICKS },
        { kind: "time", ticks: RACE_THREE_STAR_TICKS },
    ],
    experimental: true,
    raceEventId: "prototype-chapter-1",
};
export const experimentalRaceById = (id) => id === PROTOTYPE_RACE_MISSION.id ? PROTOTYPE_RACE_MISSION : null;
// ------------------------------------------------------------------ prose
export function goalText(g, def) {
    switch (g.kind) {
        case "finish": return def.base === "tunnel" ? `Survive ${def.gates} seconds in the wormhole`
            : def.base === "spill" ? `Survive ${def.gates} seconds in the Spill`
                : def.base === "race" ? "Finish the course"
                    : `Reach the portal — ${def.gates} gates`;
        case "acorns": return `Collect ${g.n} acorns`;
        case "gold": return g.n === 1 ? "Catch a golden acorn" : `Catch ${g.n} golden acorns`;
        case "noBounce": return "Touch no planet";
        case "noShield": return "Spend no shield";
        case "flawless": return "Flawless — no bounces, no shields spent";
        case "maxTaps": return `At most ${g.n} taps`;
        case "flow": return `Reach Flow \u00d7${g.n}`;
        case "score": return `Score ${g.n} points`;
        case "time": {
            const seconds = Math.floor(g.ticks / 60);
            return `Finish in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} or faster`;
        }
    }
}
export function fxText(fx) {
    const out = [];
    if (fx.strobe)
        out.push("BLACKOUT — lit only after a tap");
    if (fx.fog)
        out.push(fx.fog >= 0.7 ? "HEAVY FOG" : "FOG");
    if (fx.pace && fx.pace > 1.02)
        out.push(fx.pace >= 1.15 ? "FAST FORWARD" : "BRISK");
    if (fx.pace && fx.pace < 0.98)
        out.push("GENTLE PACE");
    if (fx.gapScale && fx.gapScale < 0.98)
        out.push("NARROW GATES");
    if (fx.driftScale && fx.driftScale >= 1.4)
        out.push("HEAVY SWAY");
    else if (fx.driftScale && fx.driftScale > 1.05)
        out.push("SWAYING GATES");
    return out;
}
export const emptyStats = () => ({ acorns: 0, gold: 0, bounces: 0, shieldsSpent: 0, taps: 0, flow: 1, score: 0, finishTicks: 0 });
/** how many golden acorns this level's goals ask for (0 = none) */
export function goldNeeded(def) {
    let n = 0;
    for (const g of def.goals)
        if (g.kind === "gold")
            n = Math.max(n, g.n);
    return n;
}
/** the gate ordinals where the level GUARANTEES a golden acorn: the goal's
 *  count plus one spare, spread evenly, so "catch a golden acorn" can never
 *  be lost to the spawn dice — the exact promise fx.acornEvery already
 *  makes for plain acorns */
export function goldGatesFor(def) {
    const need = goldNeeded(def);
    if (!need)
        return [];
    const out = [];
    for (let i = 1; i <= need + 1; i++) {
        const ord = Math.max(1, Math.min(def.gates, Math.round((i * def.gates) / (need + 2))));
        if (!out.includes(ord))
            out.push(ord);
    }
    return out;
}
/** did this finished run meet the goal? (star 1 is the finish itself) */
export function goalMet(g, s) {
    switch (g.kind) {
        case "finish": return true;
        case "acorns": return s.acorns >= g.n;
        case "gold": return s.gold >= g.n;
        case "noBounce": return s.bounces === 0;
        case "noShield": return s.shieldsSpent === 0;
        case "flawless": return s.bounces === 0 && s.shieldsSpent === 0;
        case "maxTaps": return s.taps <= g.n;
        case "flow": return s.flow >= g.n;
        case "score": return s.score >= g.n;
        case "time": return s.finishTicks > 0 && s.finishTicks <= g.ticks;
    }
}
// --------------------------------------------------------------- progress
/** stars for one level live in a 3-bit mask so each goal keeps its own */
export function countBits(mask) {
    return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}
export function totalStars(stars) {
    let n = 0;
    for (const id in stars)
        n += countBits(stars[id] || 0);
    return n;
}
export function stageUnlocked(stageNum, total) {
    // The beta is a TEST BUILD: every chapter is open so experimental
    // missions can be flown without earning the road first.
    if (IS_BETA)
        return true;
    const st = STAGES.find((s) => s.num === stageNum);
    return !!st && total >= st.unlock;
}
/** a level opens when its stage is open and the level before it is finished */
export function levelUnlocked(def, stars, total) {
    if (IS_BETA)
        return true;
    if (!stageUnlocked(def.stage, total))
        return false;
    if (def.n === 1)
        return true;
    const prev = `${def.stage}-${def.n - 1}`;
    return ((stars[prev] || 0) & 1) === 1;
}
// The ladder XP used to be. Stage openings are listed so the chart can
// show the whole road on one screen; the stage thresholds here MUST match
// STAGES[n].unlock (build-roadmap.mjs checks).
export const STAR_REWARDS = [
    { stars: 3, kind: "pal", id: "bee", name: "Astrolobee", desc: "Powerup/Acorns Disabled" },
    { stars: 5, kind: "trail", id: "ion", name: "Ion Stream", desc: "A trail of charged sky." },
    { stars: 6, kind: "mod", id: "startShield", name: "Start Shield", desc: "Arm any run with a shield from the hangar." },
    { stars: 8, kind: "helmet", id: "void", name: "Void Helmet", desc: "Obsidian glass, gold rim. In the shop." },
    { stars: 10, kind: "pal", id: "buddy", name: "Acorn", desc: "Magnet Effect" },
    { stars: 12, kind: "stage", name: "Chapter 2 — NURSERY BLOOM", desc: "The nebula opens." },
    { stars: 12, kind: "mode", id: "deep", name: "Deep Space Flight", desc: "Endless mode: space shifts every 10s." },
    { stars: 14, kind: "helmet", id: "comet", name: "Comet Helmet", desc: "Molten amber glass. In the shop." },
    { stars: 16, kind: "pal", id: "voidjelly", name: "Jelly", desc: "Bounce Softer" },
    { stars: 18, kind: "trail", id: "bubble", name: "Bubble Jets", desc: "A wake of glass beads." },
    { stars: 21, kind: "pal", id: "cometsprite", name: "Comet", desc: "2x Freeze Duration" },
    { stars: 24, kind: "helmet", id: "cherry", name: "Cherry Helmet", desc: "Rose-tinted glass. In the shop." },
    { stars: 27, kind: "stage", name: "Chapter 3 — ICE MOON", desc: "The narrows open." },
    { stars: 27, kind: "mod", id: "battery", name: "Shield Battery", desc: "Carry three shield charges at once." },
    { stars: 30, kind: "trail", id: "bloom", name: "Nebula Bloom", desc: "Petals of nebula light." },
    { stars: 33, kind: "pal", id: "meteorcore", name: "Meteor Core", desc: "2x Power Ups" },
    { stars: 38, kind: "helmet", id: "royal", name: "Royal Helmet", desc: "Crowned. Obviously. In the shop." },
    { stars: 42, kind: "trail", id: "comet", name: "Comet Booster", desc: "Burn like the real thing." },
    { stars: 45, kind: "mode", id: "lost", name: "Lost in Space", desc: "Endless mode: the sky rotates, drifts and mirrors." },
    { stars: 45, kind: "stage", name: "Chapter 4 — SOLAR FURNACE", desc: "The heat opens." },
    { stars: 45, kind: "pal", id: "pocketmoon", name: "Moon", desc: "Lower Gravity" },
    { stars: 48, kind: "helmet", id: "aurora", name: "Aurora Helmet", desc: "Polar light under glass. In the shop." },
    { stars: 52, kind: "pal", id: "ufo", name: "UFO", desc: "Slow Effect in blackholes" },
    { stars: 56, kind: "trail", id: "prism", name: "Prism Shards", desc: "Light, broken beautifully." },
    { stars: 60, kind: "suit", id: "robo", name: "Robo Suit", desc: "Full chrome, scanning visor. Now in the shop." },
    { stars: 66, kind: "stage", name: "Chapter 5 — MIDNIGHT RUN", desc: "The dark opens." },
    { stars: 66, kind: "pal", id: "starpup", name: "Star Child", desc: "Double Golden Effect" },
    { stars: 70, kind: "helmet", id: "meteor", name: "Meteor Helmet", desc: "Burnished impact glass. In the shop." },
    { stars: 72, kind: "trail", id: "plasma", name: "Plasma Arc", desc: "A live violet current." },
    { stars: 75, kind: "pal", id: "tinbot", name: "TinTin", desc: "Disables Blackholes" },
    { stars: 84, kind: "pal", id: "wisp", name: "Wisp", desc: "More gate movement" },
    { stars: 88, kind: "trail", id: "galaxy", name: "Galaxy Dust", desc: "A spiral arm behind you." },
    { stars: 90, kind: "stage", name: "Chapter 6 — CRYSTAL BELT", desc: "Deep-space levels open." },
    { stars: 90, kind: "pal", id: "nutsack", name: "Nut-Sack", desc: "2x Acorns but the sack is heavy" },
    { stars: 95, kind: "helmet", id: "chrono", name: "Chrono Helmet", desc: "Brass clockwork glass. In the shop." },
    { stars: 100, kind: "suit", id: "alien", name: "Alien Suit", desc: "The visitor look, antennae included." },
    { stars: 105, kind: "trail", id: "aurora", name: "Aurora Ribbon", desc: "The polar sky, towed." },
    { stars: 117, kind: "stage", name: "Chapter 7 — CRIMSON STORM", desc: "The turbulence opens." },
    { stars: 125, kind: "trail", id: "frost", name: "Frostbite", desc: "A wake of hoarfrost." },
    { stars: 140, kind: "trail", id: "voidsmoke", name: "Void Smoke", desc: "What the dark exhales." },
    { stars: 130, kind: "suit", id: "ghost", name: "Ghost Suit", desc: "Spectral tail, cyan-burning eyes." },
    { stars: 147, kind: "stage", name: "Chapter 8 — LOST REACHES", desc: "Lost-in-space levels open." },
    { stars: 160, kind: "suit", id: "bigbooty", name: "Big Booty Suit", desc: "Maximum silhouette. Real jiggle." },
    { stars: 170, kind: "trail", id: "supernova", name: "Supernova", desc: "The loudest exit there is." },
    { stars: 180, kind: "stage", name: "Chapter 9 — THE BLACKOUT", desc: "Lights out." },
    { stars: 180, kind: "mod", id: "flightmods", name: "Flight Mods", desc: "Steady Gates, Rough Air and Thrill Seeker unlock in the hangar." },
    { stars: 200, kind: "suit", id: "volt", name: "Volt Suit", desc: "Storm-charged armor. The tail crackles." },
    { stars: 216, kind: "stage", name: "Chapter 10 — EVENT HORIZON", desc: "The last ten." },
    { stars: 250, kind: "title", name: "GATECRASHER", desc: "A title for the pilots who earn it." },
    { stars: 300, kind: "title", name: "STARLORD", desc: "Every star in the chart." },
];
/** the pilot's TITLE comes from stars now, not XP — same ladder the
 *  rewards climb. Thresholds sit on chapter openings and the two title
 *  rewards, so a title always names something the pilot actually did. */
export function starTitle(total) {
    if (total >= 300)
        return "STARLORD";
    if (total >= 250)
        return "GATECRASHER";
    if (total >= 216)
        return "ACORNAUT";
    if (total >= 147)
        return "EVENT HORIZON";
    if (total >= 90)
        return "ACE";
    if (total >= 45)
        return "VOIDFARER";
    if (total >= 12)
        return "PILOT";
    return "CADET";
}
/** star thresholds the save-side gates read; kept beside the reward list */
export const STAR_UNLOCKS = {
    pals: Object.fromEntries(STAR_REWARDS.filter((r) => r.kind === "pal" && r.id).map((r) => [r.id, r.stars])),
    suits: Object.fromEntries(STAR_REWARDS.filter((r) => r.kind === "suit" && r.id).map((r) => [r.id, r.stars])),
    helmets: Object.fromEntries(STAR_REWARDS.filter((r) => r.kind === "helmet" && r.id).map((r) => [r.id, r.stars])),
    trails: Object.fromEntries(STAR_REWARDS.filter((r) => r.kind === "trail" && r.id).map((r) => [r.id, r.stars])),
    startShield: 6,
    battery: 27,
    // modes open with a CHAPTER, not a loose star count: Deep Space with
    // Chapter 2, Lost in Space with Chapter 4
    deep: 12,
    lost: 45,
    flightMods: 180,
};
