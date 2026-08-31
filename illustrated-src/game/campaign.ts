import {
  RACE_MAX_ACORNS,
  RACE_RINGS,
  RACE_THREE_STAR_TICKS,
  RACE_TWO_STAR_TICKS,
} from "./race";

// THE STAR CHART — a finish line for a game that never had one.
//
// Endless mode is untouched; this is a second way to fly the same
// simulation. A LEVEL is a run with a finish line: survive the level's
// gate count and a PORTAL spawns — fly into it and the run is complete.
// Each level offers THREE STARS:
//
//   star 1  reach the portal            (always — the finish line itself)
//   star 2  a collection goal           (acorns, golden acorns)
//   star 3  a discipline goal           (no bounces, no shield, few taps)
//
// Stars are independent and KEPT ACROSS RUNS — a level can be starred one
// goal at a time, which is what makes a 2-star level an invitation instead
// of a wall. Total stars are the progression currency: they open stages
// and earn the rewards that XP used to hand out for mileage. XP still
// exists and still names the pilot's title; it just is not the gate any
// more. Earning by DOING SOMETHING beats earning by being present.
//
// A STAGE is ten levels under one sky with one idea. The ideas come from
// the game that already exists — its environments, its three flight modes,
// its drift and warp machinery — plus a small set of level-only modifiers
// (fx) the simulation honours ONLY when a level is running:
//
//   pace       the world clock, 0.9 gentle to 1.25 furnace
//   gapScale   gate mouth, 1.1 forgiving to 0.92 tight
//   driftScale how far gates sway;  driftRate how fast
//   fog        the sky closes in — a sight circle around the pilot
//   strobe     THE BLACKOUT: the world is only lit for the half-second
//              after a tap. Fly the gap you remember, not the one you see.
//   acornEvery guarantees an acorn per gate so collection goals are
//              always fair, never hostage to the spawn dice
//
// Tuning lives in ONE table per stage (STAGES) and one goal script
// (goalsFor), so difficulty can be re-curved without touching a level by
// hand. The generated result is deliberately data, not code: the whole
// 100 is printed into ROADMAP.md by build-roadmap.mjs for review.

// "tunnel" and "spill" are MISSION bases the BETA grafts onto the chart —
// the live page never generates them (see the IS_BETA block under LEVELS).
export type FlightBase = "fly" | "deep" | "lost" | "arcade" | "tunnel" | "spill" | "race";

export type LevelFx = {
  env?: number;        // pin the run to one environment (index into ENVS)
  pace?: number;       // multiplies the world clock (like Thrill Seeker)
  gapScale?: number;   // multiplies the gate mouth
  driftScale?: number; // multiplies how far gates sway
  driftRate?: number;  // multiplies how fast gates sway
  fog?: number;        // 0 none .. 1 blind: sight circle around the pilot
  strobe?: boolean;    // world lit only briefly after each tap
  acornEvery?: boolean;// guarantee an acorn on every gate
  /** THE FIRST MISSION CANNOT BE FAILED. Owner's call: level one is flown
   *  for real and earns its star, but a crash is a free reset rather than a
   *  loss - unlimited tries. A new pilot who has just finished the tutorial
   *  and immediately fails their first mission has been told the game is
   *  not for them, which is the one lesson it must never teach. */
  noFail?: boolean;
};

export type Goal =
  | { kind: "finish" }
  | { kind: "acorns"; n: number }
  | { kind: "gold"; n: number }
  | { kind: "noBounce" }
  | { kind: "noShield" }
  | { kind: "flawless" }            // no bounces AND no shields spent
  | { kind: "maxTaps"; n: number }
  // mission-base goals (beta): Wormhole Flow multiplier, Spill score
  | { kind: "flow"; n: number }
  | { kind: "score"; n: number }
  | { kind: "time"; ticks: number };

export type LevelDef = {
  id: string;          // "3-7"
  stage: number;       // 1-based
  n: number;           // 1-based within the stage
  ord: number;         // 1..100
  name: string;
  base: FlightBase;
  gates: number;       // the finish line
  fx: LevelFx;
  goals: [Goal, Goal, Goal];
  /** Experimental cards are Log-only and never enter LEVELS/progression. */
  standalone?: boolean;
  raceEventId?: string;
};

export type StageDef = {
  num: number;
  name: string;
  tagline: string;
  env: number;
  base: FlightBase;
  unlock: number;      // total stars needed to open it
  /** per-level knobs; i is 0..9 */
  tune: (i: number) => { gates: number; fx: LevelFx; base?: FlightBase };
  /** star-2 and star-3 scripts; i is 0..9 */
  goals: (i: number, gates: number) => [Goal, Goal];
  names: string[];
};

// ------------------------------------------------------------------ stages

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const STAGES: StageDef[] = [
  {
    num: 1,
    name: "FLIGHT SCHOOL",
    tagline: "Learn the sky before it learns you.",
    env: 0, // DEEP SPACE
    base: "fly",
    unlock: 0,
    tune: (i) => ({
      gates: 8 + i,                                       // 8 .. 17
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
      gates: 12 + i,                                      // 12 .. 21
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
      gates: 14 + i,                                      // 14 .. 23
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
      gates: 15 + i,                                      // 15 .. 24
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
      gates: 15 + i,                                      // 15 .. 24
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
      gates: 12 + i,                                      // 12 .. 21
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
      gates: 16 + i,                                      // 16 .. 25
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
      gates: 12 + i,                                      // 12 .. 21
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
      gates: 8 + i,                                       // 8 .. 17
      fx: {
        strobe: true,
        gapScale: lerp(1.12, 1.02, i / 9),   // mercy, tapering
        pace: 0.95,
        driftScale: i >= 5 ? 1.2 : 1,        // late levels sway in the dark
        acornEvery: true,
      },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 3 + Math.floor(i / 2) },
      i % 3 === 2 ? { kind: "flawless" }
        : i % 3 === 0 ? { kind: "noBounce" }
        : { kind: "maxTaps", n: Math.round(g * 3.2) },   // taps ARE sight here
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
      if (i < 3) return { gates: 18 + i * 2, base: "arcade" as FlightBase, fx: { acornEvery: true } };
      if (i < 6) return { gates: 20 + i, base: "deep" as FlightBase, fx: { fog: 0.5, acornEvery: true } };
      if (i < 9) return {
        gates: 22 + i,
        base: "lost" as FlightBase,
        fx: { driftScale: 1.5, acornEvery: true },
      };
      // level 100: the horizon
      return {
        gates: 30,
        base: "fly" as FlightBase,
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

export const LEVELS: LevelDef[] = STAGES.flatMap((st) =>
  Array.from({ length: 10 }, (_, i) => {
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
      // the very first mission on the chart carries it; nothing else does
      fx: { env: st.env, ...t.fx, ...((st.num - 1) * 10 + i + 1 === 1 ? { noFail: true } : {}) },
      goals: [{ kind: "finish" }, g2, g3] as [Goal, Goal, Goal],
    };
  }),
);

// ---------------------------------------------------- the BETA divergence
//
// Read here rather than imported from catalog.ts: build-roadmap.mjs
// compiles this file ALONE, and in node there is no window — so the
// roadmap always documents the LIVE chart, which is the point.
const IS_BETA =
  typeof window !== "undefined" &&
  (window as { __ACORNAUT_BETA__?: unknown }).__ACORNAUT_BETA__ === true;
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
    if (l.stage < 2) continue;
    if (l.n === 4) {
      l.base = "tunnel";
      l.gates = 20 + l.stage * 5;                 // SECONDS survived: 30..70
      l.goals = [
        { kind: "finish" },
        { kind: "acorns", n: 4 + l.stage * 2 },   // 8..24 acorns
        { kind: "flow", n: l.stage >= 7 ? 4 : l.stage >= 4 ? 3 : 2 },
      ];
      l.fx = { env: l.fx.env };                   // missions run their own physics
    } else if (l.n === 8) {
      l.base = "spill";
      l.gates = 20 + l.stage * 5;                 // 30..70 seconds
      l.goals = [
        { kind: "finish" },
        { kind: "score", n: 200 + l.stage * 100 },
        { kind: "score", n: 500 + l.stage * 250 },
      ];
      l.fx = { env: l.fx.env };
    }
  }
}

export const levelById = (id: string) => LEVELS.find((l) => l.id === id) ?? null;

/** Beta proof-of-concept. It deliberately does not live in LEVELS, so it
 * cannot change chapter counts, unlock order, star totals, or rewards. */
export const HYPER_RUN_MAX_ACORNS = RACE_MAX_ACORNS;

// Hyper Run's mission definition. The names here still say "prototype"
// and that is deliberate: `id` is the KEY inside save.raceRecords,
// so renaming it would orphan every best time already recorded. The mode
// shipped; the storage key it was born with has to outlive its old name.
export const HYPER_RUN_MISSION: LevelDef = {
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

export const hyperRunById = (id: string) =>
  id === HYPER_RUN_MISSION.id ? HYPER_RUN_MISSION : null;

// ------------------------------------------------------------------ prose

export function goalText(g: Goal, def: LevelDef): string {
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

export function fxText(fx: LevelFx): string[] {
  const out: string[] = [];
  if (fx.strobe) out.push("BLACKOUT — lit only after a tap");
  if (fx.fog) out.push(fx.fog >= 0.7 ? "HEAVY FOG" : "FOG");
  if (fx.pace && fx.pace > 1.02) out.push(fx.pace >= 1.15 ? "FAST FORWARD" : "BRISK");
  if (fx.pace && fx.pace < 0.98) out.push("GENTLE PACE");
  if (fx.gapScale && fx.gapScale < 0.98) out.push("NARROW GATES");
  if (fx.driftScale && fx.driftScale >= 1.4) out.push("HEAVY SWAY");
  else if (fx.driftScale && fx.driftScale > 1.05) out.push("SWAYING GATES");
  return out;
}

// ------------------------------------------------------- stats and scoring

/** everything a run has to count for the three goals to be judged */
export type RunStats = {
  acorns: number;
  gold: number;
  bounces: number;
  shieldsSpent: number;
  taps: number;
  /** Wormhole missions: best Flow multiplier reached */
  flow: number;
  /** Spill missions: the run's score */
  score: number;
  /** Hyper Run: authoritative 60 Hz finish time, zero until settled. */
  finishTicks: number;
};

export const emptyStats = (): RunStats => ({ acorns: 0, gold: 0, bounces: 0, shieldsSpent: 0, taps: 0, flow: 1, score: 0, finishTicks: 0 });

/** how many golden acorns this level's goals ask for (0 = none) */
export function goldNeeded(def: LevelDef) {
  let n = 0;
  for (const g of def.goals) if (g.kind === "gold") n = Math.max(n, g.n);
  return n;
}

/** the gate ordinals where the level GUARANTEES a golden acorn: the goal's
 *  count plus one spare, spread evenly, so "catch a golden acorn" can never
 *  be lost to the spawn dice — the exact promise fx.acornEvery already
 *  makes for plain acorns */
export function goldGatesFor(def: LevelDef): number[] {
  const need = goldNeeded(def);
  if (!need) return [];
  const out: number[] = [];
  for (let i = 1; i <= need + 1; i++) {
    const ord = Math.max(1, Math.min(def.gates, Math.round((i * def.gates) / (need + 2))));
    if (!out.includes(ord)) out.push(ord);
  }
  return out;
}

// ------------------------------------------------- the pinned objectives
//
// While a mission is FLOWN its three goals ride the top of the screen, so
// the pilot always knows what is still winnable. Each pill is judged LIVE:
//
//   green - complete (a target reached) or still holding (a constraint
//           unbroken: no bounce yet, taps still under the cap)
//   red   - failed, permanently: the touch on "touch no planet", the
//           28th tap against a cap of 27
//   white - an accumulating target not yet reached
//
// A constraint shows GREEN while it holds rather than white: "currently
// passing" is the honest reading of an unbroken constraint, and the flip
// to red is the event worth noticing.

export type GoalHudState = "live" | "done" | "lost";
export type GoalHudPill = { text: string; state: GoalHudState };

export function goalHud(g: Goal, s: RunStats, gatesDone: number, def: LevelDef): GoalHudPill {
  switch (g.kind) {
    case "finish": {
      const n = Math.min(gatesDone, def.gates);
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
    case "time": {
      const sec = Math.ceil(g.ticks / 60);
      return { text: `UNDER ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`,
        state: s.finishTicks === 0 ? "live" : s.finishTicks <= g.ticks ? "done" : "lost" };
    }
  }
}

/** did this finished run meet the goal? (star 1 is the finish itself) */
export function goalMet(g: Goal, s: RunStats): boolean {
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
export function countBits(mask: number) {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

export function totalStars(stars: Record<string, number>) {
  let n = 0;
  for (const id in stars) n += countBits(stars[id] || 0);
  return n;
}

export function stageUnlocked(stageNum: number, total: number) {
  // The beta is a TEST BUILD: every chapter is open so experimental
  // missions can be flown without earning the road first.
  if (IS_BETA) return true;
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
export const RACE_GATES: { after: number; ticks: number; label: string }[] = [
  { after: 33, ticks: 9_000, label: "2:30" },
  { after: 66, ticks: 7_200, label: "2:00" },
  { after: 99, ticks: 6_120, label: "1:42" },
];

/** the gate standing between the pilot and this level, or null if the road
 *  is clear. Checks every gate below the level, not just the nearest, so a
 *  skipped one can never be walked around. */
export function gateBefore(ord: number, cleared: number[] | undefined) {
  const done = cleared || [];
  for (const g of RACE_GATES) {
    if (ord > g.after && !done.includes(g.after)) return g;
  }
  return null;
}

/** the gate a Hyper Run would be attempting right now: the first uncleared
 *  one. A run clears the gate in FRONT of the pilot and no more, so beating
 *  1:42 early does not silently bank all three. */
export function nextGate(cleared: number[] | undefined) {
  const done = cleared || [];
  return RACE_GATES.find((g) => !done.includes(g.after)) ?? null;
}

/** THE CLEAR RULE, kept pure so it can be tested without flying a race.
 *  A finish opens the gate in front of the pilot when it was an actual
 *  finish and the clock beat the limit. Returns the gate that opened, or
 *  null when nothing did. */
export function gateClearedBy(
  cleared: number[] | undefined,
  finished: boolean,
  finishTicks: number,
) {
  const g = nextGate(cleared);
  if (!g || !finished) return null;
  // a zero or negative clock is a quit or a broken read, never a pass
  if (!(finishTicks > 0)) return null;
  return finishTicks <= g.ticks ? g : null;
}

export function levelUnlocked(
  def: LevelDef,
  stars: Record<string, number>,
  /** kept in the signature, and deliberately unused: the star TOTAL was
   *  what opened a chapter, and chapters are gone. Removing it would mean
   *  editing five call sites whose next argument is also an array-ish
   *  thing, which is a good way to pass gatesCleared as total by mistake. */
  _total: number,
  gatesCleared?: number[],
) {
  if (IS_BETA) return true;
  if (gateBefore(def.ord, gatesCleared)) return false;
  if (def.ord <= 1) return true;
  // ONE WAY, IN ORDER. The chart used to be ten chapters, and a chapter
  // opened on a star TOTAL - so the first level of each one was reachable
  // the moment you could afford it, whether or not you had flown the
  // ninety-nine before it. That made 61 and 81 playable out of nowhere and
  // put two paths through a chart that only has one. Levels are 1-100 now
  // and the only key to a level is the level before it.
  //
  // n is the position WITHIN the old stage, so at a boundary the previous
  // level is the last of the stage below rather than "n - 1".
  const prev = def.n > 1 ? `${def.stage}-${def.n - 1}` : `${def.stage - 1}-10`;
  return ((stars[prev] || 0) & 1) === 1;
}

// --------------------------------------------------------------- rewards

export type StarReward = {
  stars: number;
  kind: "pal" | "mod" | "mode" | "suit" | "helmet" | "trail" | "title" | "stage" | "dust";
  id?: string;
  name: string;
  desc: string;
  /** "dust" rewards only: how much Star Dust crossing this line pays out */
  amount?: number;
};

// The ladder XP used to be. Stage openings are listed so the chart can
// show the whole road on one screen; the stage thresholds here MUST match
// STAGES[n].unlock (build-roadmap.mjs checks).
export const STAR_REWARDS: StarReward[] = [
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
  { stars: 31, kind: "helmet", id: "phoenix", name: "Phoenix Helmet", desc: "Firebird glass, ember rim. In the shop." },
  { stars: 33, kind: "pal", id: "meteorcore", name: "Meteor Core", desc: "2x Power Ups" },
  { stars: 38, kind: "helmet", id: "royal", name: "Royal Helmet", desc: "Crowned. Obviously. In the shop." },
  { stars: 42, kind: "trail", id: "comet", name: "Comet Booster", desc: "Burn like the real thing." },
  { stars: 45, kind: "mode", id: "lost", name: "Lost in Space", desc: "Endless mode: the sky rotates, drifts and mirrors." },
  { stars: 45, kind: "stage", name: "Chapter 4 — SOLAR FURNACE", desc: "The heat opens." },
  { stars: 45, kind: "pal", id: "pocketmoon", name: "Moon", desc: "Lower Gravity" },
  { stars: 48, kind: "helmet", id: "aurora", name: "Aurora Helmet", desc: "Polar light under glass. In the shop." },
  { stars: 52, kind: "pal", id: "ufo", name: "UFO", desc: "Slow Effect in blackholes" },
  { stars: 56, kind: "trail", id: "prism", name: "Prism Shards", desc: "Light, broken beautifully." },
  { stars: 58, kind: "helmet", id: "princess", name: "Rose Helmet", desc: "Petal glass, violet rim. In the shop." },
  { stars: 60, kind: "helmet", id: "paladin", name: "Paladin Helmet", desc: "Crusader glass, gold-barred. Was premium; now earned." },
  { stars: 66, kind: "stage", name: "Chapter 5 — MIDNIGHT RUN", desc: "The dark opens." },
  { stars: 66, kind: "pal", id: "starpup", name: "Star Child", desc: "Double Golden Effect" },
  { stars: 70, kind: "helmet", id: "meteor", name: "Meteor Helmet", desc: "Burnished impact glass. In the shop." },
  { stars: 72, kind: "trail", id: "plasma", name: "Plasma Arc", desc: "A live violet current." },
  { stars: 75, kind: "pal", id: "tinbot", name: "TinTin", desc: "Disables Blackholes" },
  { stars: 80, kind: "dust", amount: 30, name: "30 Star Dust", desc: "A pocketful of dust." },
  { stars: 84, kind: "pal", id: "wisp", name: "Wisp", desc: "More gate movement" },
  { stars: 88, kind: "trail", id: "galaxy", name: "Galaxy Dust", desc: "A spiral arm behind you." },
  { stars: 90, kind: "stage", name: "Chapter 6 — CRYSTAL BELT", desc: "Deep-space levels open." },
  { stars: 90, kind: "pal", id: "nutsack", name: "Nut-Sack", desc: "2x Acorns but the sack is heavy" },
  { stars: 95, kind: "helmet", id: "chrono", name: "Chrono Helmet", desc: "Brass clockwork glass. In the shop." },
  { stars: 100, kind: "suit", id: "alien", name: "Alien Suit", desc: "The visitor look, antennae included." },
  { stars: 105, kind: "trail", id: "aurora", name: "Aurora Ribbon", desc: "The polar sky, towed." },
  { stars: 112, kind: "dust", amount: 40, name: "40 Star Dust", desc: "The long haul pays." },
  { stars: 117, kind: "stage", name: "Chapter 7 — CRIMSON STORM", desc: "The turbulence opens." },
  { stars: 125, kind: "trail", id: "frost", name: "Frostbite", desc: "A wake of hoarfrost." },
  { stars: 130, kind: "suit", id: "ghost", name: "Ghost Suit", desc: "Spectral tail, cyan-burning eyes." },
  { stars: 133, kind: "dust", amount: 50, name: "50 Star Dust", desc: "Dust from the crossing." },
  { stars: 140, kind: "trail", id: "voidsmoke", name: "Void Smoke", desc: "What the dark exhales." },
  { stars: 147, kind: "stage", name: "Chapter 8 — LOST REACHES", desc: "Lost-in-space levels open." },
  { stars: 152, kind: "dust", amount: 60, name: "60 Star Dust", desc: "Deep-space wages." },
  { stars: 160, kind: "suit", id: "bigbooty", name: "Big Booty Suit", desc: "Maximum silhouette. Real jiggle." },
  { stars: 170, kind: "trail", id: "supernova", name: "Supernova", desc: "The loudest exit there is." },
  { stars: 180, kind: "stage", name: "Chapter 9 — THE BLACKOUT", desc: "Lights out." },
  { stars: 180, kind: "mod", id: "flightmods", name: "Flight Mods", desc: "Steady Gates and Thrill Seeker unlock in the hangar." },
  { stars: 190, kind: "dust", amount: 75, name: "75 Star Dust", desc: "Blackout bonus." },
  { stars: 200, kind: "helmet", id: "chronarch", name: "Chronarch Helmet", desc: "Time under glass. Was premium; now earned." },
  { stars: 216, kind: "stage", name: "Chapter 10 — EVENT HORIZON", desc: "The last ten." },
  { stars: 225, kind: "dust", amount: 90, name: "90 Star Dust", desc: "The far side pays better." },
  { stars: 245, kind: "dust", amount: 100, name: "100 Star Dust", desc: "Still going." },
  { stars: 250, kind: "title", name: "GATECRASHER", desc: "A title for the pilots who earn it." },
  { stars: 270, kind: "dust", amount: 120, name: "120 Star Dust", desc: "Almost the whole chart." },
  { stars: 285, kind: "dust", amount: 150, name: "150 Star Dust", desc: "The last stretch." },
  { stars: 300, kind: "title", name: "STARLORD", desc: "Every star in the chart." },
  { stars: 300, kind: "suit", id: "catsuit", name: "Cat Suit", desc: "Eats no acorns. Earned by every star there is." },
];

/** the pilot's TITLE comes from stars now, not XP — same ladder the
 *  rewards climb. Thresholds sit on chapter openings and the two title
 *  rewards, so a title always names something the pilot actually did. */
export function starTitle(total: number) {
  if (total >= 300) return "STARLORD";
  if (total >= 250) return "GATECRASHER";
  if (total >= 216) return "ACORNAUT";
  if (total >= 147) return "EVENT HORIZON";
  if (total >= 90) return "ACE";
  if (total >= 45) return "VOIDFARER";
  if (total >= 12) return "PILOT";
  return "CADET";
}

/** star thresholds the save-side gates read; kept beside the reward list */
export const STAR_UNLOCKS = {
  pals: Object.fromEntries(
    STAR_REWARDS.filter((r) => r.kind === "pal" && r.id).map((r) => [r.id as string, r.stars]),
  ) as Record<string, number>,
  suits: Object.fromEntries(
    STAR_REWARDS.filter((r) => r.kind === "suit" && r.id).map((r) => [r.id as string, r.stars]),
  ) as Record<string, number>,
  helmets: Object.fromEntries(
    STAR_REWARDS.filter((r) => r.kind === "helmet" && r.id).map((r) => [r.id as string, r.stars]),
  ) as Record<string, number>,
  trails: Object.fromEntries(
    STAR_REWARDS.filter((r) => r.kind === "trail" && r.id).map((r) => [r.id as string, r.stars]),
  ) as Record<string, number>,
  startShield: 6,
  battery: 27,
  // modes open with a CHAPTER, not a loose star count: Deep Space with
  // Chapter 2, Lost in Space with Chapter 4
  deep: 12,
  lost: 45,
  flightMods: 180,
};
