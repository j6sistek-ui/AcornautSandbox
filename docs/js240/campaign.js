import { BETA_MISSION_ROWS } from "./beta-campaign-manifest.js?v=240";
import { MISSION_ROWS, BETA_VARIANTS } from "./campaign-manifest.js?v=240";
import { IS_BETA, PALS, STAR_MAP_LIVE } from "./catalog.js?v=240";
import { RACE_MAX_ACORNS, RACE_RINGS, RACE_THREE_STAR_TICKS, RACE_TWO_STAR_TICKS, } from "./race.js?v=240";
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
        tagline: "Steady shadows reveal a moving path.",
        env: 6, // MONOCHROME VOID
        base: "fly",
        unlock: 180,
        tune: (i) => ({
            gates: 8 + i, // 8 .. 17
            fx: {
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
            "Lights Out", "Afterimage", "Count the Beats", "Quiet Current", "Dead Reckoning",
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
                fx: { fog: 0.4, driftScale: 1.5, pace: 1.1, acornEvery: true },
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
/** Immutable authored definitions. Beta variants share a route position, but
 * have their own progress identity. Production never loads preview progress. */
// the road's contracts: the beta's authored 260 on both pages now that the
// road is live, the original production rows only if it is ever pulled back
const ROAD = IS_BETA || STAR_MAP_LIVE;
export const LEGACY_LEVELS = MISSION_ROWS.slice(0, 100).map(row => {
    const variant = ROAD ? BETA_VARIANTS.find(v => v.id === row.id) : undefined;
    return { ...row, ...variant, fx: { ...(variant?.fx ?? row.fx) },
        goals: (variant?.goals ?? row.goals).map(g => ({ ...g })) };
});
export const ALL_LEVELS = (ROAD ? BETA_MISSION_ROWS : MISSION_ROWS).map(row => ({ ...row, fx: { ...row.fx }, goals: row.goals.map(g => ({ ...g })) }));
export const LEVELS = ROAD ? ALL_LEVELS : LEGACY_LEVELS;
export const CHART_LEVELS = LEVELS;
export const CAMPAIGN_MAX_STARS = LEVELS.length * 3;
export const CHART_MAX_STARS = CHART_LEVELS.length * 3;
export const levelById = (id) => CHART_LEVELS.find(l => l.id === id) ?? null;
export const nextLevel = (id, order = CHART_LEVELS) => {
    const i = order.findIndex(l => l.id === id);
    return i >= 0 ? order[i + 1] ?? null : null;
};
export const levelAt = (ord, order = CHART_LEVELS) => order[ord - 1] ?? null;
export const missionProgressId = (def) => def.variantId ?? def.id;
/** Beta proof-of-concept. It deliberately does not live in LEVELS, so it
 * cannot change chapter counts, unlock order, star totals, or rewards. */
export const HYPER_RUN_MAX_ACORNS = RACE_MAX_ACORNS;
// Hyper Run's mission definition. The names here still say "prototype"
// and that is deliberate: `id` is the KEY inside save.raceRecords,
// so renaming it would orphan every best time already recorded. The mode
// shipped; the storage key it was born with has to outlive its old name.
export const HYPER_RUN_MISSION = {
    id: "hyper-run",
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
    standalone: true,
    raceEventId: "hyper-run",
};
export const hyperRunById = (id) => id === HYPER_RUN_MISSION.id ? HYPER_RUN_MISSION : null;
// ------------------------------------------------------------------ prose
export function goalText(g, def) {
    switch (g.kind) {
        case "bounces": return `Bounce off planets ${g.n} times`;
        case "depots": return `Visit ${g.n} Depot${g.n === 1 ? "" : "s"}`;
        case "repairs": return `Buy ${g.n} hull repair at a Depot`;
        case "finish": return def.spillFinish ? def.spillFinish.kind === "ore" ? `Collect ${def.spillFinish.n} Acorn Coins` : `Reach Depot ${def.spillFinish.n}` : def.base === "tunnel" ? `Survive ${def.gates} seconds in the wormhole`
            : def.base === "spill" ? `Clear ${def.gates} waves of the Debris Field`
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
        case "ore": return `Collect ${g.n} Acorn Coins`;
        case "noHit": return "Take no hull damage";
        case "time": {
            const seconds = Math.floor(g.ticks / 60);
            return `Finish in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} or faster`;
        }
    }
}
export function fxText(fx) {
    const out = [];
    // THE SHEET NAMES THE PAL THE HANGAR NAMES. This tag printed the raw id
    // and called Stopwatch cosmetic; the audit found both wrong. A mission
    // flies its designated pal with its effects LIVE, and Stopwatch is no
    // exception - its tap toggle reads runPals, so in a mission every tap
    // still toggles the slow and a pilot who trusted "cosmetic" lost the run
    // to it. The ids fared no better: nothing else in the game calls
    // Astrolobee "bee" or Acorn "buddy", so the catalog name is what shows.
    if (fx.pal) {
        const pal = PALS.find((p) => p.id === fx.pal);
        out.push(`PAL: ${(pal ? pal.name : fx.pal).toUpperCase()}`);
    }
    if (fx.upsideDown)
        out.push("UPSIDE DOWN");
    if (fx.bounceScale)
        out.push("SPRINGY PLANETS");
    if (fx.sticky)
        out.push("STICKY PLANETS · TAP TO RELEASE");
    if (fx.tapFreeze)
        out.push("TAP TO TOGGLE SLOW");
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
export const emptyStats = () => ({ acorns: 0, gold: 0, bounces: 0, shieldsSpent: 0, taps: 0, flow: 1, score: 0, ore: 0, hits: 0, depots: 0, repairs: 0, finishTicks: 0 });
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
export function goalHud(g, s, gatesDone, def) {
    switch (g.kind) {
        case "bounces": return { text: `BOUNCES ${Math.min(s.bounces, g.n)}/${g.n}`, state: s.bounces >= g.n ? "done" : "live" };
        case "depots": return { text: `DEPOTS ${Math.min(s.depots, g.n)}/${g.n}`, state: s.depots >= g.n ? "done" : "live" };
        case "repairs": return { text: `REPAIRS ${Math.min(s.repairs, g.n)}/${g.n}`, state: s.repairs >= g.n ? "done" : "live" };
        case "finish": {
            if (def.spillFinish) {
                const { kind, n } = def.spillFinish, value = kind === "ore" ? s.ore : s.depots;
                return { text: `${kind === "ore" ? "COINS" : "DEPOT"} ${Math.min(value, n)}/${n}`, state: value >= n ? "done" : "live" };
            }
            const n = Math.min(gatesDone, def.gates);
            if (def.base === "spill")
                return { text: `WAVE ${n}/${def.gates}`, state: n >= def.gates ? "done" : "live" };
            return { text: `PORTAL ${n}/${def.gates}`, state: n >= def.gates ? "done" : "live" };
        }
        case "acorns":
            return { text: `ACORNS ${Math.min(s.acorns, g.n)}/${g.n}`, state: s.acorns >= g.n ? "done" : "live" };
        case "gold":
            return { text: `GOLD ${Math.min(s.gold, g.n)}/${g.n}`, state: s.gold >= g.n ? "done" : "live" };
        case "noBounce":
            return { text: "NO TOUCHES", state: s.bounces > 0 ? "lost" : "done" };
        case "noShield":
            return { text: "NO SHIELDS", state: s.shieldsSpent > 0 ? "lost" : "done" };
        case "flawless":
            return { text: "FLAWLESS", state: s.bounces > 0 || s.shieldsSpent > 0 ? "lost" : "done" };
        case "maxTaps":
            return { text: `TAPS ${s.taps}/${g.n}`, state: s.taps > g.n ? "lost" : "done" };
        case "flow":
            return { text: `FLOW ×${s.flow}/${g.n}`, state: s.flow >= g.n ? "done" : "live" };
        case "score":
            return { text: `SCORE ${Math.min(s.score, g.n)}/${g.n}`, state: s.score >= g.n ? "done" : "live" };
        case "ore":
            return { text: `COINS ${Math.min(s.ore, g.n)}/${g.n}`, state: s.ore >= g.n ? "done" : "live" };
        case "noHit":
            return { text: "NO HITS", state: s.hits > 0 ? "lost" : "done" };
        case "time": {
            const sec = Math.ceil(g.ticks / 60);
            return { text: `UNDER ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`,
                state: s.finishTicks === 0 ? "live" : s.finishTicks <= g.ticks ? "done" : "lost" };
        }
    }
}
/** did this finished run meet the goal? (star 1 is the finish itself) */
export function goalMet(g, s) {
    switch (g.kind) {
        case "finish": return true;
        case "bounces": return s.bounces >= g.n;
        case "depots": return s.depots >= g.n;
        case "repairs": return s.repairs >= g.n;
        case "acorns": return s.acorns >= g.n;
        case "gold": return s.gold >= g.n;
        case "noBounce": return s.bounces === 0;
        case "noShield": return s.shieldsSpent === 0;
        case "flawless": return s.bounces === 0 && s.shieldsSpent === 0;
        case "maxTaps": return s.taps <= g.n;
        case "flow": return s.flow >= g.n;
        case "score": return s.score >= g.n;
        case "ore": return s.ore >= g.n;
        case "noHit": return s.hits === 0;
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
// DEBRIS FIELDS. Every 33 levels the road is blocked outright and the only
// way past is a Hyper Run inside a time. They award no stars on purpose: a
// gate is passed or not yet passed, never scored, so it can never sit
// half-finished the way a three-star level can. The times tighten as the
// chart does - the first is close to autopilot (the no-input replay
// profile finishes in exactly 9000 ticks), the last wants a real run.
export const RACE_GATES = [
    { after: 33, ticks: 9000, label: "2:30" },
    { after: 66, ticks: 7200, label: "2:00" },
    { after: 99, ticks: 6120, label: "1:42" },
];
/** the gate standing between the pilot and this level, or null if the road
 *  is clear. Checks every gate below the level, not just the nearest, so a
 *  skipped one can never be walked around. */
export function gateBefore(ord, cleared) {
    const done = cleared || [];
    for (const g of RACE_GATES) {
        if (ord > g.after && !done.includes(g.after))
            return g;
    }
    return null;
}
/** the gate a Hyper Run would be attempting right now: the first uncleared
 *  one. A run clears the gate in FRONT of the pilot and no more, so beating
 *  1:42 early does not silently bank all three. */
export function nextGate(cleared) {
    const done = cleared || [];
    return RACE_GATES.find((g) => !done.includes(g.after)) ?? null;
}
/** THE CLEAR RULE, kept pure so it can be tested without flying a race.
 *  A finish opens the gate in front of the pilot when it was an actual
 *  finish and the clock beat the limit. Returns the gate that opened, or
 *  null when nothing did. */
export function gateClearedBy(cleared, finished, finishTicks) {
    const g = nextGate(cleared);
    if (!g || !finished)
        return null;
    // a zero or negative clock is a quit or a broken read, never a pass
    if (!(finishTicks > 0))
        return null;
    return finishTicks <= g.ticks ? g : null;
}
export function levelUnlocked(def, stars, _total, gatesCleared, order = CHART_LEVELS, beta = IS_BETA) {
    const index = order.findIndex(l => l.id === def.id);
    if (index < 0 || def.implemented === false)
        return false;
    if (beta)
        return true;
    if (gateBefore(index + 1, gatesCleared))
        return false;
    return index === 0 || ((stars[order[index - 1].id] || 0) & 1) === 1;
}
/** Arrival is part of a barrier attempt, independently of access to the mode. */
export function reachedGate(stars, cleared) {
    const gate = nextGate(cleared);
    return gate && ((stars[levelAt(gate.after)?.id ?? ""] || 0) & 1) ? gate : null;
}
// The reward ladder. Chapter cards and the two star titles are gone from it
// (owner, 8 Sep 2026: "remove the progression reward, no need for it to
// count in some hidden way... remove titles, we went away from the XP
// system in favor of the star chart"). Chapters open by finishing the
// mission before them, not by stars, so a card for them said nothing.
export const STAR_REWARDS = [
    // GENERATED by illustrated-src/reward-ladder.mjs - edit the generator, not this list
    { stars: 5, kind: "mod", id: "startShield", name: "Start Shield", desc: "Arm any run with a shield from the hangar." },
    { stars: 5, kind: "trail", id: "ion", name: "Ion Stream", desc: "A trail of charged sky." },
    { stars: 10, kind: "mode", id: "deep", name: "Deep Space Flight", desc: "Endless mode: space shifts every 10s." },
    { stars: 10, kind: "pal", id: "bee", name: "Astrolobee", desc: "Powerup/Acorns Disabled" },
    { stars: 15, kind: "acorns", name: "100 Acorns", desc: "Spending acorns for the hangar.", amount: 100 },
    { stars: 20, kind: "suit", id: "alien", name: "Alien Suit", desc: "The visitor look, antennae included." },
    { stars: 25, kind: "mod", id: "battery", name: "Shield Battery", desc: "Carry three shield charges at once." },
    { stars: 30, kind: "acorns", name: "100 Acorns", desc: "Spending acorns for the hangar.", amount: 100 },
    { stars: 40, kind: "trail", id: "bubble", name: "Bubble Jets", desc: "A wake of glass beads." },
    { stars: 45, kind: "mode", id: "lost", name: "Lost in Space", desc: "Endless mode: the sky rotates, drifts and mirrors." },
    { stars: 50, kind: "pal", id: "buddy", name: "Acorn", desc: "Magnet Effect" },
    { stars: 60, kind: "acorns", name: "170 Acorns", desc: "Spending acorns for the hangar.", amount: 170 },
    { stars: 70, kind: "acorns", name: "170 Acorns", desc: "Spending acorns for the hangar.", amount: 170 },
    { stars: 80, kind: "suit", id: "ghost", name: "Ghost Suit", desc: "Spectral tail, cyan-burning eyes." },
    { stars: 90, kind: "dust", name: "19 Star Dust", desc: "Premium dust for the shop.", amount: 19 },
    { stars: 100, kind: "trail", id: "bloom", name: "Nebula Bloom", desc: "Petals of nebula light." },
    { stars: 110, kind: "pal", id: "voidjelly", name: "Jelly", desc: "Bounce Softer" },
    { stars: 120, kind: "acorns", name: "240 Acorns", desc: "Spending acorns for the hangar.", amount: 240 },
    { stars: 130, kind: "suit", id: "bigbooty", name: "Big Booty Suit", desc: "Maximum silhouette. Real jiggle." },
    { stars: 140, kind: "dust", name: "22 Star Dust", desc: "Premium dust for the shop.", amount: 22 },
    { stars: 150, kind: "dust", name: "22 Star Dust", desc: "Premium dust for the shop.", amount: 22 },
    { stars: 160, kind: "trail", id: "comet", name: "Comet Booster", desc: "Burn like the real thing." },
    { stars: 170, kind: "pal", id: "cometsprite", name: "Comet", desc: "2x Freeze Duration" },
    { stars: 180, kind: "mod", id: "flightmods", name: "Flight Mods", desc: "Steady Gates and Thrill Seeker unlock in the hangar." },
    { stars: 190, kind: "acorns", name: "310 Acorns", desc: "Spending acorns for the hangar.", amount: 310 },
    { stars: 200, kind: "dust", name: "26 Star Dust", desc: "Premium dust for the shop.", amount: 26 },
    { stars: 210, kind: "dust", name: "26 Star Dust", desc: "Premium dust for the shop.", amount: 26 },
    { stars: 220, kind: "trail", id: "prism", name: "Prism Shards", desc: "Light, broken beautifully." },
    { stars: 230, kind: "pal", id: "meteorcore", name: "Meteor Core", desc: "2x Power Ups" },
    { stars: 240, kind: "helmet", id: "sammie", name: "Samurai Helmet", desc: "Earned on the Star Chart." },
    { stars: 250, kind: "suit", id: "sammie", name: "Sammie Suit", desc: "Earned on the Star Chart." },
    { stars: 260, kind: "dust", name: "29 Star Dust", desc: "Premium dust for the shop.", amount: 29 },
    { stars: 270, kind: "acorns", name: "380 Acorns", desc: "Spending acorns for the hangar.", amount: 380 },
    { stars: 280, kind: "trail", id: "plasma", name: "Plasma Arc", desc: "A live violet current." },
    { stars: 290, kind: "pal", id: "pocketmoon", name: "Moon", desc: "Lower Gravity" },
    { stars: 300, kind: "acorns", name: "450 Acorns", desc: "Spending acorns for the hangar.", amount: 450 },
    { stars: 310, kind: "suit", id: "catsuit", name: "Cat Suit", desc: "Eats no acorns." },
    { stars: 320, kind: "dust", name: "33 Star Dust", desc: "Premium dust for the shop.", amount: 33 },
    { stars: 330, kind: "dust", name: "33 Star Dust", desc: "Premium dust for the shop.", amount: 33 },
    { stars: 340, kind: "pal", id: "ufo", name: "UFO", desc: "Start with Shield" },
    { stars: 350, kind: "helmet", id: "cinderforge", name: "Cinderforge Helmet", desc: "Ember glass. Arrives with the suit." },
    { stars: 360, kind: "suit", id: "cinderforge", name: "Cinderforge", desc: "Forge-black plate, ember trim." },
    { stars: 370, kind: "acorns", name: "520 Acorns", desc: "Spending acorns for the hangar.", amount: 520 },
    { stars: 380, kind: "dust", name: "36 Star Dust", desc: "Premium dust for the shop.", amount: 36 },
    { stars: 390, kind: "acorns", name: "520 Acorns", desc: "Spending acorns for the hangar.", amount: 520 },
    { stars: 400, kind: "trail", id: "galaxy", name: "Galaxy Dust", desc: "A spiral arm behind you." },
    { stars: 410, kind: "pal", id: "starpup", name: "Star Child", desc: "Double Golden Effect" },
    { stars: 420, kind: "helmet", id: "groveguard", name: "Groveguard Helm", desc: "Sealed. Worn only by Groveguard." },
    { stars: 430, kind: "pal", id: "tinbot", name: "TinTin", desc: "Disables Blackholes" },
    { stars: 440, kind: "suit", id: "groveguard", name: "Groveguard", desc: "Forest green and brass, its own sealed helm." },
    { stars: 450, kind: "dust", name: "40 Star Dust", desc: "Premium dust for the shop.", amount: 40 },
    { stars: 460, kind: "trail", id: "aurora", name: "Aurora Ribbon", desc: "The polar sky, towed." },
    { stars: 470, kind: "pal", id: "wisp", name: "Wisp", desc: "More gate movement" },
    { stars: 480, kind: "helmet", id: "cosmic", name: "Cosmic Helmet", desc: "Nebula glass. Arrives with the suit." },
    { stars: 490, kind: "suit", id: "cosmic", name: "Cosmic", desc: "Violet nebula weave." },
    { stars: 500, kind: "dust", name: "43 Star Dust", desc: "Premium dust for the shop.", amount: 43 },
    { stars: 510, kind: "acorns", name: "660 Acorns", desc: "Spending acorns for the hangar.", amount: 660 },
    { stars: 520, kind: "trail", id: "vanguardwake", name: "AcorNut Wake", desc: "Twin gold and cyan filaments. Worn only by AcorNut." },
    { stars: 530, kind: "pal", id: "nutsack", name: "Nut-Sack", desc: "2x Acorns but the sack is heavy" },
    { stars: 540, kind: "acorns", name: "730 Acorns", desc: "Spending acorns for the hangar.", amount: 730 },
    { stars: 550, kind: "trail", id: "frost", name: "Frostbite", desc: "A wake of hoarfrost." },
    { stars: 560, kind: "acorns", name: "730 Acorns", desc: "Spending acorns for the hangar.", amount: 730 },
    { stars: 570, kind: "suit", id: "vanguard", name: "AcorNut", desc: "The flagship squirrel. Integrated gold helmet, custom flight and exclusive wake." },
    { stars: 580, kind: "trail", id: "voidsmoke", name: "Void Smoke", desc: "What the dark exhales." },
    { stars: 590, kind: "pal", id: "magnetar", name: "Magnetar PAL", desc: "Upside Down World." },
    { stars: 600, kind: "helmet", id: "chronarch", name: "Chronarch Helmet", desc: "Time under glass. Was premium; now earned." },
    { stars: 610, kind: "acorns", name: "800 Acorns", desc: "Spending acorns for the hangar.", amount: 800 },
    { stars: 620, kind: "dust", name: "50 Star Dust", desc: "Premium dust for the shop.", amount: 50 },
    { stars: 630, kind: "dust", name: "50 Star Dust", desc: "Premium dust for the shop.", amount: 50 },
    { stars: 640, kind: "trail", id: "supernova", name: "Supernova", desc: "The loudest exit there is." },
    { stars: 650, kind: "pal", id: "astrafox", name: "AstraFox PAL", desc: "Wild Gate Sway." },
    { stars: 660, kind: "helmet", id: "sunforged", name: "Sunforged Helm", desc: "Sealed. Worn only by Sunforged." },
    { stars: 670, kind: "suit", id: "sunforged", name: "Sunforged", desc: "Bronze and solar gold, its own sealed helm." },
    { stars: 680, kind: "dust", name: "54 Star Dust", desc: "Premium dust for the shop.", amount: 54 },
    { stars: 690, kind: "acorns", name: "870 Acorns", desc: "Spending acorns for the hangar.", amount: 870 },
    { stars: 700, kind: "trail", id: "phoenixplume", name: "Phoenix Plumage Trail", desc: "Earned here or available early in the Regalia Pack." },
    { stars: 710, kind: "pal", id: "satellite", name: "Satellite PAL", desc: "Visibility Reduced." },
    { stars: 720, kind: "mod", id: "dualpal", name: "Second Companion", desc: "Fly two pals at once, one high and one low. Their effects stack." },
    { stars: 720, kind: "helmet", id: "abyssal", name: "Abyssal Helmet", desc: "Abyss glass. Arrives with the suit." },
    { stars: 730, kind: "suit", id: "abyssal", name: "Abyssal", desc: "Deep-sea blue, bioluminescent trim." },
    { stars: 740, kind: "dust", name: "57 Star Dust", desc: "Premium dust for the shop.", amount: 57 },
    { stars: 750, kind: "acorns", name: "940 Acorns", desc: "Spending acorns for the hangar.", amount: 940 },
    { stars: 760, kind: "trail", id: "opalfeather", name: "Opal Feather Trail", desc: "Earned here or available early in the Regalia Pack." },
    { stars: 770, kind: "pal", id: "switchback", name: "Stopwatch PAL", desc: "Tap Toggles Scroll Speed." },
    { stars: 780, kind: "helmet", id: "gemmie", name: "Opal Helmet", desc: "Earned on the Star Chart." },
    { stars: 780, kind: "suit", id: "gemmie", name: "Gemmie Suit", desc: "Earned on the Star Chart." },
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
/** The first rung wins when an item is deliberately celebrated twice. */
function rewardGates(kind) {
    const out = {};
    for (const reward of STAR_REWARDS)
        if (reward.kind === kind && reward.id) {
            out[reward.id] = Math.min(out[reward.id] ?? Infinity, reward.stars);
        }
    return out;
}
/** star thresholds the save-side gates read; kept beside the reward list */
/** WHAT A RUNG PAYS WHEN ITS ITEM IS ALREADY YOURS (owner, 8 Sep 2026:
 *  "change pay out to acorns, 250, flat regardless of star unlock or store
 *  purchase... acorns are less useful long term"). Flat, whatever the rung
 *  and whichever way the item arrived. A suit and its helmet on two rungs
 *  are two items and pay twice, by the same decision. One number, here,
 *  to retune. Saves written under the earlier rule may still carry a
 *  "dust" entry in rewardSubs; the sheet shows what was paid. */
export const SUB_ACORNS = 250;
export function substituteFor(_stars) {
    return { kind: "acorns", amount: SUB_ACORNS };
}
/** A SHELF GATE WITHOUT A RUNG (owner, 8 Sep 2026: "remove from star rung,
 *  some items are acorns.. at those star rung replace with acorns for now").
 *
 *  These nine helmets used to hold rungs that REVEALED them for acorns
 *  rather than handing them over, and those rungs now pay acorns instead.
 *  But every other gate in this table is DERIVED from the ladder by
 *  rewardGates, so taking the nine off the ladder would also have taken
 *  their shelf gates with them and put all nine in the shop from the first
 *  flight - a pacing change nobody asked for. They keep the star counts they
 *  always appeared at, so the shop opens at exactly the rate it did; what
 *  changed is only that the road now pays you for arriving instead of
 *  announcing an unlock you still have to buy. A new asset dropped onto one
 *  of these rungs later gets its gate from the ladder like everything else,
 *  and its entry here should go. */
const PRICED_HELMET_GATES = {
    void: 15, comet: 60, cherry: 70, phoenix: 120, royal: 180,
    aurora: 190, princess: 300, meteor: 540, chrono: 560,
};
export const STAR_UNLOCKS = {
    pals: rewardGates("pal"),
    suits: rewardGates("suit"),
    // the ladder wins where both name a helmet, so a real rung always outranks
    // a bare shelf gate
    helmets: { ...PRICED_HELMET_GATES, ...rewardGates("helmet") },
    trails: rewardGates("trail"),
    startShield: 5,
    battery: 25,
    // modes open with a CHAPTER, not a loose star count: Deep Space with
    // Chapter 2, Lost in Space with Chapter 4
    deep: 10,
    lost: 45,
    flightMods: 180,
    /** the second companion slot (owner, 7 Sep 2026) */
    dualPal: 720,
};
