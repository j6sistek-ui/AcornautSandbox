// THE SPILL — wave survival authority.
//
// An acorn mining rig let go one system over. What reached us is a front of
// rock, cargo and shrapnel travelling one way: at you. No gates, no planets.
// Survive the wave; the next one is harder.
//
// This module is the RULES of the mode and nothing else — no canvas, no DOM,
// no art, no save. It is fed a dt and a handful of semantic inputs (tap,
// dive, lunge, pulse, a Depot purchase) and it answers with state and a list
// of cues for the frame. The sim mirrors its pilot into the world so the
// shared draw path paints the equipped suit and helmet; draw.ts paints the
// field; standalone.ts builds the Depot sheet. That split is the same one
// Hyper Run made (race.ts), and for the same reason: everything in here can
// be driven from a node test with no browser at all.
//
// It grew out of the lab prototype (illustrated-src/lab/spill.ts, retired
// with this file). What survived the promotion: the forward-only lunge, the
// graze meter that pays for PULSE, the spawn-time path rejection that keeps
// debris from ever colliding with debris, the telegraphed hulk and the floor
// that kills after a quarter second. What replaced the rest: an endless
// intensity curve became a ladder of authored waves; instant death became a
// three-pip hull; acorns became Ore, a currency that lives and dies inside
// the run; and a Depot opens every fifth wave to spend it.

import { DEBRIS_COUNT, PHYS } from "./catalog";

// ---------------------------------------------------------------- tuning

export const SPILL = {
  /** the pilot may roam this share of the width. The right edge stops at
   *  half: further forward and you can park in front of the field where
   *  pieces have not spread apart yet, which was safer, not more dangerous */
  bandLeft: 0.08,
  bandRight: 0.5,
  /** where the pilot sits when left alone, and how fast a lunge decays back
   *  to it. Slow enough to read as a drift rather than a spring: ground a
   *  lunge won is yours for a few seconds, not for the run */
  homeX: 0.22,
  driftHome: 0.55,
  /** the dash. 320px/s for 0.15s is about a third of the band end to end,
   *  slide included — see the lab notes for why 900 was far too much */
  lungeSpeed: 320,
  lungeTime: 0.15,
  lungeCooldown: 0.55,
  /** how long the floor may be ridden before it kills. A bounce while
   *  recovering from a dive is one or two frames; camping is continuous.
   *  0.25s sits well clear of the first and well under the second, and the
   *  hull glows from 0.1s so the rule is visible before it is fatal */
  floorGrace: 0.25,
  floorWarn: 0.1,
  pilotR: PHYS.squirrelR,
  grazeR: 46,
  chargePerGraze: 0.11,
  pulseR: 240,
  /** the hull: three hits, then the run is over. A hit buys 1.2s of
   *  invulnerability so one piece can never take two pips */
  hull: 3,
  iframes: 1.2,
  /** the knockback a hit gives: a short shove toward the wall and a pop
   *  upward, so the impact reads on the body as well as on the pips */
  knockTime: 0.14,
  knockSpeed: -220,
  /** seconds of Gold a gold ore and a Gilded Shield break each hand over */
  goldSeconds: 3,
  /** the Depot clock: two long visits to learn the shelf, then half */
  depotTime: [30, 30, 15] as readonly number[],
  rerollBase: 20,
  extendBase: 25,
  extendSeconds: 15,
  /** the intermission between waves */
  cardTime: 1.3,
  firstCardTime: 2.2,
  tallyTime: 2.4,
  /** a wave's field must drain before the tally; a slow hulk can hold that
   *  open, so it is capped rather than waited on forever */
  drainCap: 6,
  respawnFreeze: 2,
  /** the free hint every first-time modifier gets, in seconds */
  hintTime: 6.5,
};

export type SpillMod = "none" | "surge" | "lowg" | "heavy" | "cross" | "blackout" | "swarm" | "flip";

/** every modifier, in the order the ladder teaches them */
export const SPILL_MODS: readonly SpillMod[] = ["surge", "lowg", "heavy", "cross", "blackout", "swarm", "flip"];

/** the gravity modifiers cannot stack: a wave carries at most one of them */
const GRAVITY_MODS: readonly SpillMod[] = ["lowg", "heavy", "flip"];

export const SPILL_MOD_INFO: Record<SpillMod, { name: string; teach: string; short: string }> = {
  none: { name: "", short: "", teach: "" },
  surge: {
    name: "SURGE", short: "surge",
    teach: "SURGE: the field doubles for six seconds. Hold a lane, don't chase.",
  },
  lowg: {
    name: "LOW-G", short: "low gravity",
    teach: "LOW-G: gravity is lighter. Tap less. Dive to drop.",
  },
  heavy: {
    name: "HEAVY", short: "heavy gravity",
    teach: "HEAVY: gravity is stronger. Tap twice as often.",
  },
  cross: {
    name: "CROSSWIND", short: "crosswind",
    teach: "CROSSWIND: you are pushed toward the wall. Lunge to hold your lane.",
  },
  blackout: {
    name: "BLACKOUT", short: "blackout",
    teach: "BLACKOUT: the field goes dark. Read the rims and the hulk warnings.",
  },
  swarm: {
    name: "SWARM", short: "swarm",
    teach: "SWARM: spinners only, and more of them. They weave, so watch the arcs.",
  },
  flip: {
    name: "FLIP", short: "inverted gravity",
    teach: "FLIP: gravity is inverted. Tap pushes you DOWN, dive lifts you. The ceiling kills now.",
  },
};

export const SPILL_CONTROL_HINT = "TAP thrust · SWIPE DOWN dive · SWIPE RIGHT lunge";
export const SPILL_PULSE_HINT = "PULSE READY: shatter everything close";

// ------------------------------------------------------------ the ladder

export type SpillWaveSpec = {
  n: number;
  /** seconds of spawning before the field drains */
  dur: number;
  /** the hard ceiling on concurrent debris */
  cap: number;
  /** debris speed, × wave 1 */
  speed: number;
  mods: SpillMod[];
  /** how many hulks may share the screen */
  hulks: number;
  spinners: boolean;
  /** seconds between spawns at this wave, before the roll */
  interval: number;
};

/** Twenty authored waves. Every modifier is taught alone the first time it
 *  appears; after wave 20 the game rolls them. Speed and crowding climb on
 *  separate curves so the field gets faster before it gets fuller. */
const LADDER: readonly (readonly [number, number, number, SpillMod, number, boolean])[] = [
  //  dur cap speed  mod        hulks spinners
  [20, 4, 1.05, "none", 0, false],
  [22, 5, 1.09, "none", 0, false],
  [24, 5, 1.14, "surge", 0, false],
  [26, 6, 1.18, "none", 1, true],
  [28, 6, 1.23, "none", 1, true],
  [30, 7, 1.27, "lowg", 1, true],
  [32, 7, 1.32, "none", 1, true],
  [34, 8, 1.36, "heavy", 1, true],
  [36, 8, 1.41, "surge", 1, true],
  [38, 9, 1.45, "none", 2, true],
  [40, 9, 1.50, "cross", 2, true],
  [40, 10, 1.54, "lowg", 2, true],
  [40, 10, 1.59, "blackout", 2, true],
  [40, 11, 1.63, "heavy", 2, true],
  [40, 11, 1.68, "surge", 2, true],
  [40, 12, 1.72, "swarm", 2, true],
  [40, 12, 1.77, "cross", 2, true],
  [40, 13, 1.81, "flip", 2, true],
  [40, 13, 1.86, "blackout", 2, true],
  [40, 14, 1.90, "swarm", 2, true],
];

export const SPILL_AUTHORED_WAVES = LADDER.length;
export const SPILL_DEPOT_EVERY = 5;

function hash(seed: number, n: number) {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function intervalFor(n: number) {
  const ramp = Math.min(1, (n - 1) / (SPILL_AUTHORED_WAVES - 1));
  const beyond = Math.max(0, n - SPILL_AUTHORED_WAVES);
  return Math.max(0.22, 0.78 - 0.42 * ramp - 0.01 * beyond);
}

/** what wave n asks of the pilot. Authored through 20; rolled from the seed
 *  after that, so one run's wave 27 is repeatable and another run's is not */
export function spillWaveSpec(n: number, seed = 0): SpillWaveSpec {
  if (n >= 1 && n <= SPILL_AUTHORED_WAVES) {
    const [dur, cap, speed, mod, hulks, spinners] = LADDER[n - 1];
    return { n, dur, cap, speed, mods: mod === "none" ? [] : [mod], hulks, spinners, interval: intervalFor(n) };
  }
  const beyond = Math.max(1, n - SPILL_AUTHORED_WAVES);
  const roll = hash(seed, n);
  const first = SPILL_MODS[roll % SPILL_MODS.length];
  const mods: SpillMod[] = [first];
  if (n >= SPILL_AUTHORED_WAVES + 6) {
    // a second modifier from wave 26, never a second gravity rule
    const pool = SPILL_MODS.filter((m) => m !== first && !(GRAVITY_MODS.includes(first) && GRAVITY_MODS.includes(m)));
    mods.push(pool[(roll >>> 8) % pool.length]);
  }
  return {
    n,
    dur: 40,
    cap: Math.min(16, 14 + Math.floor((beyond - 1) / 3)),
    speed: 1.9 * Math.pow(1.02, beyond),
    mods,
    hulks: 2,
    spinners: true,
    interval: intervalFor(n),
  };
}

// ------------------------------------------------------------ the depot

export type SpillTrack = "shield" | "hull" | "thrust" | "pulse" | "ore" | "kit";
export type SpillItemId =
  | "shield" | "reactive" | "gilded"
  | "patch" | "plating" | "regen"
  | "fuel" | "twinlunge" | "afterburner"
  | "fastcharge" | "widepulse" | "chainpulse"
  | "magnet" | "richvein" | "salvage"
  | "respawn" | "overshield" | "stabiliser" | "primed";

export type SpillItem = {
  id: SpillItemId;
  name: string;
  track: SpillTrack;
  tier: 1 | 2 | 3;
  price: number;
  desc: string;
  /** the box to its left on the tree: offered only once that is owned */
  requires?: SpillItemId;
  /** bought again and again (a consumable) rather than owned once */
  consumable?: boolean;
  /** one per run, consumable or not */
  once?: boolean;
};

export const SPILL_ITEMS: readonly SpillItem[] = [
  { id: "shield", name: "Shield", track: "shield", tier: 1, price: 50, desc: "A shield that eats one hit. Two can be carried.", consumable: true },
  { id: "reactive", name: "Reactive Shield", track: "shield", tier: 2, price: 100, desc: "A breaking shield shatters the debris around it.", requires: "shield" },
  { id: "gilded", name: "Gilded Shield", track: "shield", tier: 3, price: 200, desc: "A breaking shield hands over three seconds of Gold.", requires: "reactive" },
  { id: "patch", name: "Hull Patch", track: "hull", tier: 1, price: 40, desc: "Restore one hull pip now.", consumable: true },
  // Plating needs no patch first: a pilot who has never lost a pip has
  // nothing to patch, and the hull track still owes them a front shelf
  { id: "plating", name: "Plating", track: "hull", tier: 2, price: 110, desc: "Four pips, and a full hull at every Depot." },
  { id: "regen", name: "Regenerative Hull", track: "hull", tier: 3, price: 220, desc: "One pip back for every twenty seconds unhit.", requires: "plating" },
  { id: "fuel", name: "Responsive Fuel", track: "thrust", tier: 1, price: 55, desc: "Thrust kicks 12% harder and a dive snaps faster." },
  { id: "twinlunge", name: "Twin Lunge", track: "thrust", tier: 2, price: 100, desc: "Two lunge charges on the same cooldown.", requires: "fuel" },
  { id: "afterburner", name: "Afterburner", track: "thrust", tier: 3, price: 200, desc: "A lunge shatters the shards it touches.", requires: "twinlunge" },
  { id: "fastcharge", name: "Fast Charge", track: "pulse", tier: 1, price: 45, desc: "A graze fills 16% of the meter instead of 11%." },
  { id: "widepulse", name: "Wide Pulse", track: "pulse", tier: 2, price: 95, desc: "PULSE reaches 320px instead of 240.", requires: "fastcharge" },
  { id: "chainpulse", name: "Chain Pulse", track: "pulse", tier: 3, price: 180, desc: "Every four pieces shattered refund a quarter of the meter.", requires: "widepulse" },
  { id: "magnet", name: "Magnet", track: "ore", tier: 1, price: 60, desc: "Ore within 70px drifts to you." },
  { id: "richvein", name: "Rich Vein", track: "ore", tier: 2, price: 90, desc: "The combo runs to ×12 and decays slower.", requires: "magnet" },
  { id: "salvage", name: "Salvage", track: "ore", tier: 3, price: 190, desc: "Shattered debris drops Ore.", requires: "richvein" },
  { id: "respawn", name: "Respawn Core", track: "kit", tier: 2, price: 150, desc: "An extra life: at zero hull the field freezes and you re-enter whole, under Gold.", once: true },
  { id: "overshield", name: "Overshield", track: "kit", tier: 1, price: 70, desc: "A shield layer for the next wave, on top of any you carry.", consumable: true },
  { id: "stabiliser", name: "Stabiliser", track: "kit", tier: 1, price: 60, desc: "Cancels the next wave's gravity rule.", consumable: true },
  { id: "primed", name: "Primed Pulse", track: "kit", tier: 1, price: 50, desc: "Start the next wave with a full meter.", consumable: true },
];

export const spillItem = (id: SpillItemId) => SPILL_ITEMS.find((i) => i.id === id)!;

// ------------------------------------------------------------- the state

export type SpillPhase = "ready" | "card" | "wave" | "drain" | "tally" | "depot" | "respawn" | "over";

export type SpillKind = "shard" | "tumbler" | "hulk" | "spinner";

export type SpillRock = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: SpillKind;
  sprite: number;
  spin: number;
  rot: number;
  /** sinusoidal drift, for spinners */
  arc: number;
  arcPhase: number;
  /** a hulk waits offscreen behind a warning for this long */
  warn: number;
  grazed: boolean;
  dead: boolean;
};

export type SpillNutKind = "ore" | "gold" | "shield" | "hull";
export type SpillNut = { x: number; y: number; vx: number; vy: number; got: boolean; bob: number; kind: SpillNutKind };

export type SpillBurst = { x: number; y: number; n: number; power: number; tone: "hit" | "shatter" | "ore" | "gold" | "shield" | "hull" | "lunge" | "graze" };

export type SpillCue =
  | "flap" | "dive" | "lunge" | "hit" | "shatter" | "ore" | "gold" | "shield" | "hull" | "graze"
  | "pulse" | "wave" | "clear" | "depot" | "depot-close" | "buy" | "deny" | "respawn" | "dead"
  | "mission" | "milestone" | "surge" | "warn" | "recharge" | "tick" | "charged";

export type SpillDepot = {
  /** three shelves; null once bought this visit */
  offers: (SpillItemId | null)[];
  timer: number;
  rerolls: number;
  extends: number;
  /** what this visit sold, for the sheet's receipt */
  bought: SpillItemId[];
};

export type SpillState = {
  seed: number;
  rng: number;
  W: number;
  H: number;
  phase: SpillPhase;
  phaseT: number;
  /** the wave being flown, or about to be */
  wave: number;
  /** waves CLEARED - the record. Set once, at the drain, and never taken
   *  back: a crash in the tally does not un-clear the wave it follows */
  cleared: number;
  spec: SpillWaveSpec;
  /** seconds into the current wave's spawning window */
  waveT: number;
  /** whole-run clock, for score and the backdrop */
  t: number;
  /** a mission: the wave that must be cleared. 0 for the endless mode */
  target: number;
  pilot: { x: number; y: number; vx: number; vy: number; rot: number };
  lunge: number;
  lungeCharges: number;
  cool: number;
  knock: number;
  flapT: number;
  floorT: number;
  hull: number;
  maxHull: number;
  iframes: number;
  hitFlash: number;
  shield: number;
  shieldFlash: number;
  gold: number;
  regenT: number;
  rocks: SpillRock[];
  nuts: SpillNut[];
  /** particle requests for the frame, drained by the sim */
  bursts: SpillBurst[];
  charge: number;
  pulseFlash: number;
  combo: number;
  comboT: number;
  ore: number;
  /** Ore mined over the whole run, spent or not */
  oreMined: number;
  score: number;
  grazes: number;
  hits: number;
  shattered: number;
  chain: number;
  nextRock: number;
  nextNut: number;
  nextSpecial: number;
  surgeT: number;
  surgeFired: boolean;
  owned: Partial<Record<SpillItemId, number>>;
  respawnArmed: boolean;
  /** where a Respawn Core puts the pilot back: the phase and its clock at
   *  the moment of the last hit, so a death in the tally returns to the
   *  tally rather than draining the same wave twice */
  respawnReturn: SpillPhase;
  respawnPhaseT: number;
  /** a line under the wave card's name - the Stabiliser's receipt */
  cardNote: string;
  overshieldNext: number;
  stabiliseNext: boolean;
  primedNext: boolean;
  /** this wave's rules, with a Stabiliser applied */
  liveMods: SpillMod[];
  depot: SpillDepot | null;
  depotVisits: number;
  banner: string;
  bannerT: number;
  hint: string;
  hintT: number;
  taught: string[];
  pulseHinted: boolean;
  /** the meter has been full since the last time it emptied */
  chargeReady: boolean;
  shake: number;
  deadFor: number;
  cause: "" | "STRUCK" | "GROUNDED" | "MISSION COMPLETE";
  cues: SpillCue[];
};

function rand(s: SpillState) {
  // mulberry32: the same stream for the same seed, which is what lets a
  // test replay a wave and what makes an endless run's rolls repeatable
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let x = s.rng;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function createSpill(W: number, H: number, seed: number, target = 0): SpillState {
  const s: SpillState = {
    seed: seed >>> 0,
    rng: seed >>> 0,
    W,
    H,
    phase: "ready",
    phaseT: 0,
    wave: 1,
    cleared: 0,
    spec: spillWaveSpec(1, seed >>> 0),
    waveT: 0,
    t: 0,
    target: Math.max(0, Math.floor(target)),
    pilot: { x: W * SPILL.homeX, y: H * 0.45, vx: 0, vy: 0, rot: 0 },
    lunge: 0,
    lungeCharges: 1,
    cool: 0,
    knock: 0,
    flapT: 0,
    floorT: 0,
    hull: SPILL.hull,
    maxHull: SPILL.hull,
    iframes: 0,
    hitFlash: 0,
    shield: 0,
    shieldFlash: 0,
    gold: 0,
    regenT: 0,
    rocks: [],
    nuts: [],
    bursts: [],
    charge: 0,
    pulseFlash: 0,
    combo: 0,
    comboT: 0,
    ore: 0,
    oreMined: 0,
    score: 0,
    grazes: 0,
    hits: 0,
    shattered: 0,
    chain: 0,
    nextRock: 0.6,
    nextNut: 2.5,
    nextSpecial: 12,
    surgeT: 0,
    surgeFired: false,
    owned: {},
    respawnArmed: false,
    respawnReturn: "wave",
    respawnPhaseT: 0,
    cardNote: "",
    overshieldNext: 0,
    stabiliseNext: false,
    primedNext: false,
    liveMods: [],
    depot: null,
    depotVisits: 0,
    banner: "",
    bannerT: 0,
    hint: "",
    hintT: 0,
    taught: [],
    pulseHinted: false,
    chargeReady: false,
    shake: 0,
    deadFor: 0,
    cause: "",
    cues: [],
  };
  return s;
}

/** the field keeps its shape through a rotation: everything scales with
 *  the canvas rather than being left in the old coordinates */
export function resizeSpill(s: SpillState, W: number, H: number) {
  if (!(W > 0 && H > 0) || (W === s.W && H === s.H)) return;
  const sx = W / s.W;
  const sy = H / s.H;
  for (const r of s.rocks) { r.x *= sx; r.y *= sy; }
  for (const n of s.nuts) { n.x *= sx; n.y *= sy; }
  s.pilot.x *= sx;
  s.pilot.y = Math.max(22, Math.min(H - 22, s.pilot.y * sy));
  s.W = W;
  s.H = H;
}

// ---------------------------------------------------------------- rules

export const spillHas = (s: SpillState, id: SpillItemId) => (s.owned[id] ?? 0) > 0;
export const spillMod = (s: SpillState, m: SpillMod) => s.liveMods.includes(m);

/** debris crosses the screen in the same time whatever the width, so a
 *  desktop panorama is more room to read, not more seconds to react */
function lane(s: SpillState) {
  return Math.max(1, Math.min(2.6, s.W / 390));
}

function gravitySign(s: SpillState) {
  return spillMod(s, "flip") ? -1 : 1;
}

function gravityOf(s: SpillState) {
  const g = spillMod(s, "lowg") ? 0.7 : spillMod(s, "heavy") ? 1.35 : 1;
  return PHYS.gravity * g * gravitySign(s);
}

function flapOf(s: SpillState) {
  const fuel = spillHas(s, "fuel") ? 1.12 : 1;
  const g = spillMod(s, "lowg") ? 0.85 : spillMod(s, "heavy") ? 1.08 : 1;
  return PHYS.flap * fuel * g * gravitySign(s);
}

function diveOf(s: SpillState) {
  return PHYS.dive * (spillHas(s, "fuel") ? 1.15 : 1) * gravitySign(s);
}

function maxLunges(s: SpillState) {
  return spillHas(s, "twinlunge") ? 2 : 1;
}

function pulseRadius(s: SpillState) {
  return spillHas(s, "widepulse") ? 320 : SPILL.pulseR;
}

function chargePerGraze(s: SpillState) {
  return spillHas(s, "fastcharge") ? 0.16 : SPILL.chargePerGraze;
}

function comboCap(s: SpillState) {
  return spillHas(s, "richvein") ? 12 : 9;
}

function comboHold(s: SpillState) {
  return spillHas(s, "richvein") ? 3.6 : 2.6;
}

function say(s: SpillState, text: string, t: number) {
  s.banner = text;
  s.bannerT = t;
}

function cue(s: SpillState, c: SpillCue) {
  s.cues.push(c);
}

function burst(s: SpillState, x: number, y: number, n: number, tone: SpillBurst["tone"], power = 1) {
  s.bursts.push({ x, y, n, power, tone });
}

function surging(s: SpillState) {
  return s.surgeT > 0;
}

// ------------------------------------------------------------- spawning

/** four of the twenty-seven debris paintings are near-black against deep
 *  space — not dark objects, invisible ones. They stay out of the pool */
const UNREADABLE = new Set([8, 12, 14, 22]);

function readableSprite(s: SpillState) {
  for (let i = 0; i < 24; i++) {
    const n = Math.floor(rand(s) * DEBRIS_COUNT);
    if (!UNREADABLE.has(n)) return n;
  }
  return 0;
}

/** the rate a spinner weaves at, radians per second */
const ARC_RATE = 1.6;

/**
 * Where a piece will be t seconds from now. This is the same motion the
 * step integrates - a hulk waits out its warning before it moves, and a
 * spinner's weave is the integral of the cosine the step applies - so the
 * spawn check predicts exactly what the field will do. The lab's version
 * predicted a sine the motion never flew and ignored the wait, and spinners
 * met each other from wave 4 on.
 */
export function spillRockAt(s: SpillState, r: SpillRock, t: number) {
  const move = Math.max(0, t - r.warn);
  const x = r.x + r.vx * move;
  let y = r.y + r.vy * move;
  if (r.arc) {
    const t0 = s.t + r.warn;
    y += (Math.sin(r.arcPhase + ARC_RATE * (t0 + move)) - Math.sin(r.arcPhase + ARC_RATE * t0)) * r.arc / ARC_RATE;
  }
  return { x, y };
}

/**
 * The one rule the brief set: debris never collides with debris. Not
 * simulated — refused. A candidate's path is sampled four and a half seconds
 * forward against every piece in flight, and any overlap rejects the spawn.
 * Two pieces on straight lines only meet if they are close now and closing,
 * so sampling is exact enough, and it costs nothing next to a physics pass.
 */
export function spillPathClear(s: SpillState, cand: SpillRock) {
  for (const r of s.rocks) {
    if (r.dead) continue;
    for (let k = 0; k <= 18; k++) {
      const t = (k / 18) * 4.5;
      const a = spillRockAt(s, cand, t);
      const b = spillRockAt(s, r, t);
      if (a.x < -200 && b.x < -200) break;
      const gap = (cand.r + r.r) * 1.35;
      if ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < gap * gap) return false;
    }
  }
  return true;
}

function spawnRock(s: SpillState) {
  const spec = s.spec;
  const hulks = s.rocks.filter((r) => r.kind === "hulk" && !r.dead).length;
  const mayHulk = hulks < spec.hulks && s.waveT > 4;
  const swarm = spillMod(s, "swarm");
  const roll = rand(s);
  const kind: SpillKind = swarm ? "spinner"
    : mayHulk && roll > 0.94 ? "hulk"
      : roll < 0.44 ? "shard"
        : roll < 0.78 || !spec.spinners ? "tumbler"
          : "spinner";

  const speed =
    (kind === "hulk" ? 145 : kind === "shard" ? 290 : 205) * spec.speed * (surging(s) ? 1.12 : 1) * lane(s);
  const r = kind === "hulk" ? 36 + rand(s) * 14 : kind === "shard" ? 11 + rand(s) * 6 : 18 + rand(s) * 10;

  // an angle, but bounded: a piece must still cross the screen rather than
  // clip a corner, or it reads as unfair rather than as chaotic
  const ang = (rand(s) - 0.5) * (kind === "shard" ? 0.5 : 0.34);
  const y = 40 + rand(s) * (s.H - 80);

  const cand: SpillRock = {
    x: s.W + r + 20,
    y,
    vx: -Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    r,
    kind,
    sprite: readableSprite(s),
    spin: (rand(s) - 0.5) * (kind === "tumbler" ? 2.4 : kind === "hulk" ? 0.5 : 1.2),
    rot: rand(s) * Math.PI * 2,
    arc: kind === "spinner" ? (swarm ? 34 : 26) + rand(s) * 26 : 0,
    arcPhase: rand(s) * Math.PI * 2,
    warn: kind === "hulk" ? 1.1 : 0,
    grazed: false,
    dead: false,
  };
  if (!spillPathClear(s, cand)) return false;
  s.rocks.push(cand);
  if (kind === "hulk") cue(s, "warn");
  return true;
}

/** Ore spills in arcs, so collecting a stream is a line you fly, not a dot */
function spawnStream(s: SpillState) {
  const n = 4 + Math.floor(rand(s) * 5);
  const y0 = 70 + rand(s) * (s.H - 140);
  const curve = (rand(s) - 0.5) * 150;
  const speed = (190 + Math.min(1, (s.wave - 1) / 19) * 90) * lane(s);
  for (let i = 0; i < n; i++) {
    const f = i / Math.max(1, n - 1);
    s.nuts.push({
      x: s.W + 30 + i * 40,
      y: y0 + Math.sin(f * Math.PI) * curve,
      vx: -speed,
      vy: 0,
      got: false,
      bob: rand(s) * Math.PI * 2,
      kind: "ore",
    });
  }
}

/**
 * The things that drift past alone rather than in a stream. Gold Ore pays
 * five and hands over Gold; a shield eats a hit; a hull fragment only shows
 * up when there is a pip to restore. All travel slower than the field, so
 * taking one is a decision about where you want to be, not a reflex.
 */
function spawnSpecial(s: SpillState) {
  const roll = rand(s);
  const kind: SpillNutKind = s.hull < s.maxHull && roll < 0.34 ? "hull" : roll < 0.55 ? "shield" : "gold";
  s.nuts.push({
    x: s.W + 40,
    y: 80 + rand(s) * (s.H - 160),
    vx: -(150 + Math.min(1, (s.wave - 1) / 19) * 60) * lane(s),
    vy: 0,
    got: false,
    bob: rand(s) * Math.PI * 2,
    kind,
  });
}

// ---------------------------------------------------------------- input

function playing(s: SpillState) {
  return s.phase === "wave" || s.phase === "drain" || s.phase === "tally";
}

/** a tap. Launches the run from the ready card; thrusts once it is flying.
 *  Returns whether the tap did anything, so the sim can animate the suit */
export function spillFlap(s: SpillState) {
  if (s.phase === "ready") {
    beginWave(s, 1);
    cue(s, "wave");
    return true;
  }
  if (!playing(s)) return false;
  s.pilot.vy = flapOf(s);
  s.flapT = 0.26;
  cue(s, "flap");
  return true;
}

export function spillDive(s: SpillState) {
  if (!playing(s)) return false;
  const d = diveOf(s);
  s.pilot.vy = d > 0 ? Math.max(s.pilot.vy, d) : Math.min(s.pilot.vy, d);
  cue(s, "dive");
  return true;
}

/**
 * The mode's own control. A short forward dash on a cooldown: the only move
 * that spends horizontal room, which is what makes an angled field playable.
 * Forward only — a backward lunge was a free retreat into a corner with the
 * whole field ahead and nothing able to reach it.
 */
export function spillLunge(s: SpillState) {
  if (s.phase === "ready") return spillFlap(s);
  if (!playing(s) || s.lungeCharges <= 0) return false;
  s.lunge = SPILL.lungeTime;
  s.lungeCharges -= 1;
  if (s.cool <= 0) s.cool = SPILL.lungeCooldown;
  burst(s, s.pilot.x - 14, s.pilot.y, 8, "lunge", 0.5);
  cue(s, "lunge");
  return true;
}

function shatter(s: SpillState, r: SpillRock, power = 1.2) {
  if (r.dead) return;
  r.dead = true;
  s.shattered += 1;
  s.score += 4;
  burst(s, r.x, r.y, 16, "shatter", power);
  if (spillHas(s, "chainpulse")) {
    s.chain += 1;
    if (s.chain >= 4) {
      s.chain = 0;
      s.charge = Math.min(1, s.charge + 0.25);
    }
  }
  if (spillHas(s, "salvage")) {
    s.nuts.push({ x: r.x, y: r.y, vx: -60 * lane(s), vy: 0, got: false, bob: rand(s) * 6, kind: "ore" });
  }
}

/** Spend a full charge meter: everything close enough is shattered */
export function spillPulse(s: SpillState) {
  if (!playing(s) || s.charge < 1) return false;
  s.charge = 0;
  s.pulseFlash = 0.45;
  s.shake = 0.5;
  const reach = pulseRadius(s);
  let hit = 0;
  for (const r of s.rocks) {
    if (r.dead || r.warn > 0) continue;
    const dx = r.x - s.pilot.x;
    const dy = r.y - s.pilot.y;
    if (dx * dx + dy * dy < reach * reach) {
      shatter(s, r);
      hit++;
    }
  }
  say(s, hit ? `PULSE ×${hit}` : "PULSE", 1.1);
  cue(s, "pulse");
  return true;
}

// ---------------------------------------------------------------- waves

function beginWave(s: SpillState, n: number) {
  s.wave = n;
  s.spec = spillWaveSpec(n, s.seed);
  // a Stabiliser cancels the gravity rule and only the gravity rule. The
  // card says so, because that is the one screen the pilot reads before
  // the wave, and a banner under it would be gone before the wave began
  s.liveMods = s.stabiliseNext ? s.spec.mods.filter((m) => !GRAVITY_MODS.includes(m)) : s.spec.mods.slice();
  s.cardNote = s.stabiliseNext && s.liveMods.length !== s.spec.mods.length
    ? `STABILISED · ${s.spec.mods.filter((m) => GRAVITY_MODS.includes(m)).map((m) => SPILL_MOD_INFO[m].name).join(" ")} cancelled`
    : "";
  s.stabiliseNext = false;
  s.waveT = 0;
  s.phase = "card";
  s.phaseT = 0;
  s.surgeT = 0;
  s.surgeFired = false;
  s.nextRock = 0.9;
  s.nextNut = 2.5;
  s.nextSpecial = 12 + rand(s) * 8;
  // a fresh wave sends the pilot home so a card never opens on a dash
  s.lunge = 0;
  s.knock = 0;
  s.pilot.vx = 0;
  if (s.overshieldNext > 0) {
    s.shield = Math.min(2 + s.overshieldNext, s.shield + s.overshieldNext);
    s.overshieldNext = 0;
    s.shieldFlash = 0.6;
  }
  if (s.primedNext) {
    s.charge = 1;
    s.primedNext = false;
  }
  // the first time a rule appears it is taught, in the wave, for free.
  // After that it is just part of the escalation
  const fresh = s.liveMods.find((m) => !s.taught.includes(m));
  if (fresh) {
    s.taught.push(fresh);
    s.hint = SPILL_MOD_INFO[fresh].teach;
    s.hintT = SPILL.hintTime;
  } else if (n === 1) {
    s.hint = SPILL_CONTROL_HINT;
    s.hintT = SPILL.hintTime;
  }
}

function waveTitle(s: SpillState) {
  const names = s.liveMods.map((m) => SPILL_MOD_INFO[m].name).filter(Boolean);
  return names.length ? `WAVE ${s.wave} · ${names.join(" + ")}` : `WAVE ${s.wave}`;
}

/** every fifth wave opens the Depot; the rest roll straight on */
function afterTally(s: SpillState) {
  if (s.wave % SPILL_DEPOT_EVERY === 0) openDepot(s);
  else {
    beginWave(s, s.wave + 1);
    cue(s, "wave");
  }
}

function endWave(s: SpillState) {
  // the wave is cleared the moment the field has drained. A mission ends
  // on a win here, not on the crash that was coming eventually
  s.phase = "tally";
  s.phaseT = 0;
  s.cleared = s.wave;
  s.score += 50 * s.wave;
  say(s, `WAVE ${s.wave} CLEAR`, SPILL.tallyTime);
  cue(s, "clear");
  if (s.wave % SPILL_DEPOT_EVERY === 0) cue(s, "milestone");
  if (s.target && s.wave >= s.target) {
    s.phase = "over";
    s.phaseT = 0;
    s.deadFor = 0;
    s.cause = "MISSION COMPLETE";
    cue(s, "mission");
  }
}

// ---------------------------------------------------------------- depot

function depotTime(s: SpillState) {
  const t = SPILL.depotTime;
  return t[Math.min(t.length - 1, s.depotVisits)];
}

function eligible(s: SpillState, item: SpillItem) {
  const have = s.owned[item.id] ?? 0;
  if (item.once && have > 0) return false;
  if (!item.consumable && have > 0) return false;
  if (item.requires && !spillHas(s, item.requires)) return false;
  // the shield is a stack of two; a shelf offering a third is a dead card
  if (item.id === "shield" && s.shield >= 2) return false;
  if (item.id === "patch" && s.hull >= s.maxHull) return false;
  // the rare tier waits for the third Depot
  if (item.tier === 3 && s.wave < 15) return false;
  return true;
}

function weightOf(s: SpillState, item: SpillItem) {
  if (item.consumable || item.once) return item.id === "respawn" ? (s.wave >= 10 ? 1.4 : 0.6) : 1.5;
  return item.tier === 1 ? 3 : item.tier === 2 ? (s.wave >= 10 ? 2 : 1) : 1.5;
}

/** three shelves. A shelf sold this visit stays empty through a reroll */
function rollOffers(s: SpillState, sold: boolean[] = [false, false, false]) {
  const offers: (SpillItemId | null)[] = [null, null, null];
  const taken = new Set<SpillItemId>();
  // the first shelf is a hull patch whenever there is a pip to restore, so
  // a battered pilot always has the sensible buy in front of them. With a
  // full hull it is the next rung of the hull track, if there is one
  const hullFirst = s.hull < s.maxHull
    ? spillItem("patch")
    : SPILL_ITEMS.find((i) => i.track === "hull" && eligible(s, i)) ?? null;
  if (!sold[0] && hullFirst && eligible(s, hullFirst)) {
    offers[0] = hullFirst.id;
    taken.add(hullFirst.id);
  }
  for (let slot = 0; slot < 3; slot++) {
    if (sold[slot] || offers[slot]) continue;
    const pool = SPILL_ITEMS.filter((i) => !taken.has(i.id) && eligible(s, i));
    if (!pool.length) break;
    let total = 0;
    for (const i of pool) total += weightOf(s, i);
    let pick = rand(s) * total;
    let chosen = pool[pool.length - 1];
    for (const i of pool) {
      pick -= weightOf(s, i);
      if (pick <= 0) { chosen = i; break; }
    }
    offers[slot] = chosen.id;
    taken.add(chosen.id);
  }
  return offers;
}

function openDepot(s: SpillState) {
  s.phase = "depot";
  s.phaseT = 0;
  // the Depot is the one pause in pressure: the field is gone, the pilot
  // is parked, and a pip comes back with it. Plating brings the lot
  s.rocks = [];
  s.nuts = [];
  s.lunge = 0;
  s.knock = 0;
  s.pilot.vx = 0;
  s.pilot.vy = 0;
  s.hull = spillHas(s, "plating") ? s.maxHull : Math.min(s.maxHull, s.hull + 1);
  s.regenT = 0;
  s.depot = { offers: rollOffers(s), timer: depotTime(s), rerolls: 0, extends: 0, bought: [] };
  s.depotVisits += 1;
  cue(s, "depot");
}

function closeDepot(s: SpillState) {
  s.depot = null;
  beginWave(s, s.wave + 1);
  cue(s, "depot-close");
  cue(s, "wave");
}

export function spillRerollPrice(s: SpillState) {
  return s.depot ? SPILL.rerollBase * Math.pow(2, s.depot.rerolls) : 0;
}

export function spillExtendPrice(s: SpillState) {
  return s.depot ? SPILL.extendBase * Math.pow(2, s.depot.extends) : 0;
}

function applyPurchase(s: SpillState, item: SpillItem) {
  s.owned[item.id] = (s.owned[item.id] ?? 0) + 1;
  switch (item.id) {
    case "shield": s.shield = Math.min(2, s.shield + 1); s.shieldFlash = 0.6; break;
    case "patch": s.hull = Math.min(s.maxHull, s.hull + 1); break;
    case "plating": s.maxHull = 4; s.hull = s.maxHull; break;
    case "twinlunge": s.lungeCharges = 2; break;
    case "respawn": s.respawnArmed = true; break;
    case "overshield": s.overshieldNext += 1; break;
    case "stabiliser": s.stabiliseNext = true; break;
    case "primed": s.primedNext = true; break;
    default: break;
  }
}

/** buy the item on one of the three shelves */
export function spillBuy(s: SpillState, slot: number): "ok" | "poor" | "empty" | "closed" {
  const d = s.depot;
  if (!d || s.phase !== "depot") return "closed";
  const id = d.offers[slot];
  if (!id) return "empty";
  const item = spillItem(id);
  if (s.ore < item.price) { cue(s, "deny"); return "poor"; }
  s.ore -= item.price;
  applyPurchase(s, item);
  d.offers[slot] = null;
  d.bought.push(id);
  cue(s, "buy");
  return "ok";
}

export function spillReroll(s: SpillState): "ok" | "poor" | "closed" {
  const d = s.depot;
  if (!d || s.phase !== "depot") return "closed";
  const price = spillRerollPrice(s);
  if (s.ore < price) { cue(s, "deny"); return "poor"; }
  s.ore -= price;
  d.rerolls += 1;
  d.offers = rollOffers(s, d.offers.map((o) => o === null));
  cue(s, "buy");
  return "ok";
}

export function spillExtend(s: SpillState): "ok" | "poor" | "closed" {
  const d = s.depot;
  if (!d || s.phase !== "depot") return "closed";
  const price = spillExtendPrice(s);
  if (s.ore < price) { cue(s, "deny"); return "poor"; }
  s.ore -= price;
  d.extends += 1;
  d.timer += SPILL.extendSeconds;
  cue(s, "buy");
  return "ok";
}

export function spillLeaveDepot(s: SpillState) {
  if (!s.depot || s.phase !== "depot") return false;
  closeDepot(s);
  return true;
}

// ----------------------------------------------------------------- hits

function takeHit(s: SpillState, r: SpillRock) {
  if (s.shield > 0) {
    // a shield eats the piece rather than the pilot
    s.shield -= 1;
    s.shieldFlash = 0.5;
    s.shake = 0.6;
    shatter(s, r, 1.2);
    say(s, "SHIELD HELD", 1.1);
    cue(s, "shield");
    if (spillHas(s, "reactive")) {
      for (const o of s.rocks) {
        if (o.dead || o.warn > 0) continue;
        const dx = o.x - s.pilot.x;
        const dy = o.y - s.pilot.y;
        if (dx * dx + dy * dy < 120 * 120) shatter(s, o, 1);
      }
    }
    if (spillHas(s, "gilded")) {
      s.gold = Math.max(s.gold, SPILL.goldSeconds);
      say(s, "GILDED", 1.1);
    }
    return;
  }
  s.hull -= 1;
  s.hits += 1;
  s.iframes = SPILL.iframes;
  s.hitFlash = 0.5;
  s.shake = 0.7;
  s.regenT = 0;
  s.knock = SPILL.knockTime;
  s.pilot.vy = -180 * gravitySign(s);
  s.combo = 0;
  s.comboT = 0;
  shatter(s, r, 1.4);
  burst(s, s.pilot.x, s.pilot.y, 14, "hit", 1.1);
  cue(s, "hit");
  if (s.hull > 0) {
    say(s, s.hull === 1 ? "HULL CRITICAL" : "HULL HIT", 1.2);
    return;
  }
  lose(s, "STRUCK");
}

function lose(s: SpillState, cause: "STRUCK" | "GROUNDED") {
  if (s.respawnArmed) {
    // the extra life: the field freezes, and the pilot comes back whole
    // and golden, to the phase he left. The wave keeps its timer; the run
    // keeps everything
    s.respawnArmed = false;
    s.respawnReturn = s.phase;
    s.respawnPhaseT = s.phaseT;
    s.phase = "respawn";
    s.phaseT = 0;
    s.iframes = 0;
    s.floorT = 0;
    burst(s, s.pilot.x, s.pilot.y, 30, "hit", 1.5);
    say(s, "RESPAWN CORE", SPILL.respawnFreeze);
    cue(s, "respawn");
    return;
  }
  s.phase = "over";
  s.phaseT = 0;
  s.deadFor = 0;
  s.cause = cause;
  s.shake = 1;
  burst(s, s.pilot.x, s.pilot.y, 34, "hit", 1.5);
  cue(s, "dead");
}

// ----------------------------------------------------------------- step

/**
 * One frame. Returns every cue raised since the last frame - by this step
 * and by any input that landed between steps (a launch, a purchase, a
 * pulse) - oldest first, and clears them. The sim turns them into sound
 * and the engine into a re-render.
 */
export function stepSpill(s: SpillState, dt: number): SpillCue[] {
  stepSpillBody(s, dt);
  const out = s.cues;
  s.cues = [];
  // the PULSE button lights on a cue, so the meter filling has to be one
  // wherever it fills - a graze, an ore, a Chain Pulse refund
  if (s.charge >= 1 && !s.chargeReady) { s.chargeReady = true; out.push("charged"); }
  else if (s.charge < 1 && s.chargeReady) s.chargeReady = false;
  return out;
}

function stepSpillBody(s: SpillState, dt: number) {
  if (s.bannerT > 0) s.bannerT = Math.max(0, s.bannerT - dt);
  if (s.hintT > 0) s.hintT = Math.max(0, s.hintT - dt);
  if (s.pulseFlash > 0) s.pulseFlash = Math.max(0, s.pulseFlash - dt * 2);
  if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt * 2);
  if (s.shieldFlash > 0) s.shieldFlash = Math.max(0, s.shieldFlash - dt * 2);
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2.2);
  if (s.flapT > 0) s.flapT = Math.max(0, s.flapT - dt);

  if (s.phase === "ready") return;

  if (s.phase === "over") {
    s.deadFor += dt;
    for (const r of s.rocks) {
      r.x += r.vx * dt * 0.25;
      r.y += r.vy * dt * 0.25;
    }
    return;
  }

  if (s.phase === "depot") {
    const d = s.depot!;
    s.phaseT += dt;
    const was = Math.ceil(d.timer);
    d.timer = Math.max(0, d.timer - dt);
    // the sheet is DOM and only repaints on a cue, so the clock ticks one
    if (Math.ceil(d.timer) !== was) cue(s, "tick");
    if (d.timer <= 0) closeDepot(s);
    return;
  }

  if (s.phase === "respawn") {
    s.phaseT += dt;
    if (s.phaseT >= SPILL.respawnFreeze) {
      // sweep the killzone: nothing may be waiting on the pilot's lane
      for (const r of s.rocks) {
        const dx = r.x - s.pilot.x;
        const dy = r.y - s.pilot.y;
        if (dx * dx + dy * dy < 220 * 220) shatter(s, r, 0.8);
      }
      s.hull = s.maxHull;
      s.gold = SPILL.goldSeconds;
      s.pilot.vy = 0;
      s.pilot.y = s.H * 0.45;
      const back = s.respawnReturn;
      s.phase = back === "tally" || back === "drain" ? back : "wave";
      s.phaseT = back === "tally" ? s.respawnPhaseT : 0;
      say(s, "BACK IN THE FIELD", 1.4);
    }
    return;
  }

  if (s.phase === "card") {
    // the wave card: the pilot hovers, the field is empty, the name lands
    s.phaseT += dt;
    s.pilot.vy = 0;
    s.pilot.y += (s.H * 0.45 - s.pilot.y) * Math.min(1, dt * 3);
    const hold = s.wave === 1 ? SPILL.firstCardTime : SPILL.cardTime;
    if (s.phaseT >= hold) {
      s.phase = "wave";
      s.phaseT = 0;
      say(s, waveTitle(s), 1.6);
    }
    return;
  }

  // ---- flying: wave, drain and tally all fly; only the spawner differs
  s.t += dt;
  s.phaseT += dt;
  const ramp = Math.min(1, (s.wave - 1) / (SPILL_AUTHORED_WAVES - 1));

  if (s.phase === "wave") {
    s.waveT += dt;
    // the surge is a wave's mid-act: six seconds of doubled spawns, called
    // before it lands so a pilot can find a lane first
    if (spillMod(s, "surge") && !s.surgeFired && s.waveT >= 8) {
      s.surgeFired = true;
      s.surgeT = 6;
      say(s, "SURGE", 1.8);
      cue(s, "surge");
    }
    if (s.waveT >= s.spec.dur) {
      s.phase = "drain";
      s.phaseT = 0;
    }
  } else if (s.phase === "drain") {
    const live = s.rocks.some((r) => !r.dead && r.x > -r.r);
    if (!live || s.phaseT >= SPILL.drainCap) endWave(s);
  } else if (s.phase === "tally") {
    if (s.phaseT >= SPILL.tallyTime) {
      afterTally(s);
      return;
    }
  }
  // a mission that just finished has no field left to fly: nothing below
  // may hit a pilot whose level has already been settled. (endWave set the
  // phase; the narrowing above does not know that.)
  if ((s.phase as SpillPhase) === "over") return;
  if (s.surgeT > 0) s.surgeT = Math.max(0, s.surgeT - dt);

  // ---- pilot
  if (s.iframes > 0) s.iframes = Math.max(0, s.iframes - dt);
  if (s.gold > 0) s.gold = Math.max(0, s.gold - dt);
  if (s.cool > 0) {
    s.cool = Math.max(0, s.cool - dt);
    if (s.cool === 0) {
      s.lungeCharges = maxLunges(s);
      cue(s, "recharge");
    }
  } else if (s.lungeCharges < maxLunges(s)) s.lungeCharges = maxLunges(s);
  if (spillHas(s, "regen") && s.hull < s.maxHull) {
    s.regenT += dt;
    if (s.regenT >= 20) {
      s.regenT = 0;
      s.hull += 1;
      say(s, "HULL REGENERATED", 1.2);
      cue(s, "hull");
    }
  }
  if (s.knock > 0) {
    s.knock = Math.max(0, s.knock - dt);
    s.pilot.vx = SPILL.knockSpeed;
  } else if (s.lunge > 0) {
    s.lunge = Math.max(0, s.lunge - dt);
    s.pilot.vx = SPILL.lungeSpeed;
    if (spillHas(s, "afterburner")) {
      for (const r of s.rocks) {
        if (r.dead || r.warn > 0 || r.kind !== "shard") continue;
        const dx = r.x - s.pilot.x;
        const dy = r.y - s.pilot.y;
        const reach = r.r + SPILL.pilotR + 6;
        if (dx * dx + dy * dy < reach * reach) shatter(s, r, 0.9);
      }
    }
  } else {
    // slides to a stop rather than stopping dead, so a dash has weight,
    // then drifts back to the home lane slowly
    s.pilot.vx *= 1 - Math.min(1, dt * 8.5);
    const home = s.W * SPILL.homeX;
    if (Math.abs(s.pilot.x - home) > 1) s.pilot.x += (home - s.pilot.x) * Math.min(1, dt * SPILL.driftHome);
  }
  // the crosswind is a steady push toward the wall; the lunge is the counter
  if (spillMod(s, "cross") && s.knock <= 0 && s.lunge <= 0) s.pilot.x -= 40 * lane(s) * dt;
  s.pilot.vy += gravityOf(s) * dt;
  s.pilot.y += s.pilot.vy * dt;
  s.pilot.x += s.pilot.vx * dt;

  const lo = s.W * SPILL.bandLeft;
  const hi = s.W * SPILL.bandRight;
  if (s.pilot.x < lo) { s.pilot.x = lo; s.pilot.vx = Math.max(0, s.pilot.vx); }
  if (s.pilot.x > hi) { s.pilot.x = hi; s.pilot.vx = 0; }
  s.pilot.rot = Math.max(-0.5, Math.min(0.9, (s.pilot.vy * gravitySign(s)) / 700)) + s.pilot.vx / 2600;

  // The floor is not a wall: brushing it is free, riding it kills. Under
  // FLIP the ceiling takes the floor's job, so the hiding place moves with
  // gravity instead of being handed back
  const top = 22;
  const bottom = s.H - 22;
  const flipped = gravitySign(s) < 0;
  const grounded = flipped ? s.pilot.y < top : s.pilot.y > bottom;
  if (s.pilot.y < top) { s.pilot.y = top; s.pilot.vy = Math.max(0, s.pilot.vy); }
  if (s.pilot.y > bottom) { s.pilot.y = bottom; s.pilot.vy = Math.min(0, s.pilot.vy); }
  if (grounded) {
    s.floorT += dt;
    if (s.floorT > SPILL.floorGrace) {
      s.floorT = 0;
      lose(s, "GROUNDED");
      return;
    }
  } else if (s.floorT > 0) {
    s.floorT = Math.max(0, s.floorT - dt * 2.5);
  }

  // ---- the spawn director
  if (s.phase === "wave") {
    s.nextRock -= dt;
    const cap = s.spec.cap + (spillMod(s, "swarm") ? 2 : 0) + (surging(s) ? 2 : 0);
    if (s.nextRock <= 0 && s.rocks.filter((r) => !r.dead).length < cap) {
      const base = s.spec.interval;
      // a wave that is teaching something opens easier than its number
      const teaching = s.hintT > 0 && s.wave > 1 ? 1.35 : 1;
      s.nextRock = Math.max(0.1, (surging(s) ? base * 0.45 : base) * teaching * (0.65 + rand(s) * 0.7));
      // a few attempts, because a refused spawn is a path conflict and the
      // next roll usually clears
      for (let k = 0; k < 6; k++) if (spawnRock(s)) break;
    }
    s.nextNut -= dt;
    if (s.nextNut <= 0) {
      s.nextNut = 4.5 + rand(s) * 4;
      spawnStream(s);
    }
    s.nextSpecial -= dt;
    if (s.nextSpecial <= 0) {
      s.nextSpecial = 16 + rand(s) * 14;
      spawnSpecial(s);
    }
  }

  // ---- debris
  const golden = s.gold > 0;
  for (const r of s.rocks) {
    if (r.dead) continue;
    // a hulk waits offscreen while it warns. The frame the warning runs
    // out in still flies its remainder, so the piece lands exactly where
    // the spawn check said it would
    let move = dt;
    if (r.warn > 0) {
      const left = r.warn;
      r.warn = Math.max(0, r.warn - dt);
      if (r.warn > 0) continue;
      move = dt - left;
    }
    r.x += r.vx * move;
    r.y += r.vy * move + (r.arc ? Math.cos(r.arcPhase + s.t * ARC_RATE) * r.arc * move : 0);
    r.rot += r.spin * move;
    const dx = r.x - s.pilot.x;
    const dy = r.y - s.pilot.y;
    const d2 = dx * dx + dy * dy;
    const kill = r.r + SPILL.pilotR;
    if (d2 < kill * kill) {
      if (golden) { shatter(s, r, 1.1); continue; }
      if (s.iframes > 0) continue;
      takeHit(s, r);
      if (s.phase !== "wave" && s.phase !== "drain" && s.phase !== "tally") return;
      continue;
    }
    // near miss: only once per piece, and only once it is alongside or past
    const graze = r.r + SPILL.grazeR;
    if (!r.grazed && r.x < s.pilot.x + r.r && d2 < graze * graze) {
      r.grazed = true;
      s.grazes += 1;
      const was = s.charge;
      s.charge = Math.min(1, s.charge + chargePerGraze(s));
      s.score += 6;
      burst(s, s.pilot.x + 10, s.pilot.y, 3, "graze", 0.4);
      cue(s, "graze");
      if (s.charge >= 1 && was < 1 && !s.pulseHinted) {
        s.pulseHinted = true;
        s.hint = SPILL_PULSE_HINT;
        s.hintT = 4;
      }
    }
  }
  s.rocks = s.rocks.filter((r) => !r.dead && r.x > -r.r - 60 && r.y > -r.r - 80 && r.y < s.H + r.r + 80);

  // ---- ore and the drifts
  if (s.comboT > 0) {
    s.comboT = Math.max(0, s.comboT - dt);
    if (s.comboT === 0) s.combo = 0;
  }
  const magnet = spillHas(s, "magnet");
  for (const n of s.nuts) {
    if (n.got) continue;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.bob += dt * 4;
    let dx = n.x - s.pilot.x;
    let dy = n.y + Math.sin(n.bob) * 3 - s.pilot.y;
    if (magnet && n.kind === "ore" && dx * dx + dy * dy < 70 * 70) {
      const len = Math.max(1, Math.hypot(dx, dy));
      n.x -= (dx / len) * 260 * dt;
      n.y -= (dy / len) * 260 * dt;
      dx = n.x - s.pilot.x;
      dy = n.y + Math.sin(n.bob) * 3 - s.pilot.y;
    }
    if (dx * dx + dy * dy < 30 * 30) {
      n.got = true;
      if (n.kind === "shield") {
        s.shield = Math.min(2, s.shield + 1);
        s.shieldFlash = 0.5;
        say(s, "SHIELD", 1.3);
        burst(s, n.x, n.y, 14, "shield", 0.9);
        cue(s, "shield");
      } else if (n.kind === "hull") {
        s.hull = Math.min(s.maxHull, s.hull + 1);
        say(s, "HULL PATCHED", 1.3);
        burst(s, n.x, n.y, 14, "hull", 0.9);
        cue(s, "hull");
      } else {
        const worth = n.kind === "gold" ? 5 : 1;
        s.ore += worth;
        s.oreMined += worth;
        s.combo = Math.min(comboCap(s), s.combo + 1);
        s.comboT = comboHold(s);
        s.score += 25 * s.combo * (n.kind === "gold" ? 2 : 1);
        s.charge = Math.min(1, s.charge + 0.03);
        if (n.kind === "gold") {
          s.gold = Math.max(s.gold, SPILL.goldSeconds);
          say(s, "GOLD ORE", 1);
          cue(s, "gold");
        } else cue(s, "ore");
        burst(s, n.x, n.y, n.kind === "gold" ? 14 : 7, n.kind === "gold" ? "gold" : "ore", 0.8);
      }
    }
  }
  s.nuts = s.nuts.filter((n) => !n.got && n.x > -40 && n.y > -40 && n.y < s.H + 40);

  // surviving is worth points on its own, so a cautious run still scores
  s.score += dt * 10 * (1 + ramp);
  return;
}

// -------------------------------------------------------------- readouts

/** waves CLEARED: the number the record keeps. The wave being flown does
 *  not count until its field has drained, and a clear is never taken back */
export function spillCleared(s: SpillState) {
  return s.cleared;
}

/** seconds left in the wave's spawning window, for the HUD clock */
export function spillWaveLeft(s: SpillState) {
  if (s.phase !== "wave") return 0;
  return Math.max(0, s.spec.dur - s.waveT);
}

/** the offers as items, for a sheet that does not want to look them up */
export function spillOffers(s: SpillState) {
  return (s.depot?.offers ?? []).map((id) => (id ? spillItem(id) : null));
}

export function spillSignature(s: SpillState) {
  return {
    wave: s.wave,
    cleared: s.cleared,
    phase: s.phase,
    hull: s.hull,
    ore: s.ore,
    oreMined: s.oreMined,
    score: Math.floor(s.score),
    hits: s.hits,
    grazes: s.grazes,
    shattered: s.shattered,
    owned: { ...s.owned },
  };
}
