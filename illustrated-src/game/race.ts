// HYPER RUN — deterministic, fixed-step race authority.
//
// This module knows nothing about canvas size, render cadence, particles, or
// the campaign. Feed it held/released transitions stamped with simulation
// ticks and call stepRace exactly once per 1/60-second simulation step.

export const RACE_EVENT_ID = "prototype-chapter-1";
export const RACE_SEED = 0x48595231;
export const RACE_HZ = 60;
export const RACE_DT = 1 / RACE_HZ;
export const RACE_WIDTH = 360;
export const RACE_HEIGHT = 640;
export const RACE_LENGTH = 36_000;
export const RACE_PILOT_X = 96;
export const RACE_PILOT_RADIUS = 16;
export const RACE_GATE_APERTURE = 54;
export const RACE_GATE_CLEARANCE = RACE_GATE_APERTURE - RACE_PILOT_RADIUS;
export const RACE_BASE_SPEED = 185;
export const RACE_MAX_SPEED = 275;
export const RACE_RETURN_SPEED = 225;
export const RACE_TUNNEL_SPEED = 400;
export const RACE_TUNNEL_DISTANCE = 3_600;
export const RACE_ENTRY_TICKS = 72;
export const RACE_TUNNEL_TICKS = 540;
export const RACE_RETURN_TICKS = 36;
export const RACE_SPEED_GRACE_TICKS = 90;
export const RACE_RETURN_GRACE_TICKS = 21;
export const RACE_DEBRIS_GRACE_TICKS = 45;
export const RACE_MAX_WORMHOLES = 3;
export const RACE_RETURN_MARGIN = RACE_PILOT_X; // 360 - 2 × 96 = 168 px safe band.

export type RacePhase = "normal" | "entry" | "tunnel" | "return" | "finish";
export type RaceObjectState = "pending" | "passed" | "missed" | "skipped";

export type RaceRing = {
  id: string;
  x: number;
  y: number;
  tilt: number;
};

export type RaceDebris = {
  id: string;
  x: number;
  y: number;
  r: number;
  art: number;
};

export type RaceAcorn = {
  id: string;
  x: number;
  y: number;
};

// Fifth-ring charge points are deliberately followed by a 3,600-unit clear
// recovery span. A return therefore never deposits the pilot inside a ring.
export const RACE_RINGS: readonly RaceRing[] = [
  { id: "r01", x: 500, y: 244, tilt: -0.10 },
  { id: "r02", x: 1_100, y: 390, tilt: 0.08 },
  { id: "r03", x: 1_800, y: 214, tilt: -0.06 },
  { id: "r04", x: 2_600, y: 422, tilt: 0.11 },
  { id: "r05", x: 3_500, y: 302, tilt: -0.08 },
  { id: "r06", x: 5_200, y: 190, tilt: 0.06 },

  { id: "r07", x: 7_600, y: 404, tilt: 0.09 },
  { id: "r08", x: 8_500, y: 228, tilt: -0.11 },
  { id: "r09", x: 9_500, y: 420, tilt: 0.07 },
  { id: "r10", x: 10_600, y: 194, tilt: -0.06 },
  { id: "r11", x: 11_800, y: 334, tilt: 0.10 },
  { id: "r12", x: 13_600, y: 448, tilt: -0.07 },

  { id: "r13", x: 16_000, y: 214, tilt: 0.06 },
  { id: "r14", x: 16_900, y: 418, tilt: -0.09 },
  { id: "r15", x: 17_900, y: 254, tilt: 0.10 },
  { id: "r16", x: 19_000, y: 440, tilt: -0.08 },
  { id: "r17", x: 20_200, y: 310, tilt: 0.07 },
  { id: "r18", x: 22_000, y: 184, tilt: -0.10 },

  { id: "r19", x: 24_500, y: 398, tilt: 0.08 },
  { id: "r20", x: 25_200, y: 220, tilt: -0.07 },
  { id: "r21", x: 26_000, y: 430, tilt: 0.09 },
  { id: "r22", x: 27_400, y: 306, tilt: -0.06 },
] as const;

export const RACE_DEBRIS: readonly RaceDebris[] = [
  { id: "d01", x: 1_500, y: 490, r: 24, art: 0 },
  { id: "d02", x: 2_650, y: 320, r: 23, art: 1 },
  { id: "d03", x: 3_900, y: 500, r: 25, art: 2 },
  { id: "d04", x: 5_100, y: 170, r: 22, art: 0 },
  { id: "d05", x: 9_900, y: 294, r: 25, art: 1 },
  { id: "d06", x: 11_100, y: 505, r: 24, art: 2 },
  { id: "d07", x: 13_450, y: 535, r: 23, art: 0 },
  { id: "d08", x: 14_800, y: 510, r: 25, art: 1 },
  { id: "d09", x: 19_500, y: 550, r: 24, art: 2 },
  { id: "d10", x: 20_750, y: 520, r: 23, art: 0 },
  { id: "d11", x: 23_050, y: 105, r: 25, art: 1 },
  { id: "d12", x: 24_400, y: 120, r: 22, art: 2 },
  { id: "d13", x: 29_100, y: 545, r: 25, art: 0 },
  { id: "d14", x: 32_300, y: 100, r: 24, art: 1 },
] as const;

export const RACE_ACORNS: readonly RaceAcorn[] = [
  { id: "a01", x: 1_220, y: 250 }, { id: "a02", x: 2_880, y: 210 },
  { id: "a03", x: 4_780, y: 420 }, { id: "a04", x: 9_550, y: 250 },
  { id: "a05", x: 11_950, y: 225 }, { id: "a06", x: 14_450, y: 200 },
  { id: "a07", x: 19_150, y: 210 }, { id: "a08", x: 21_650, y: 415 },
  { id: "a09", x: 24_050, y: 440 }, { id: "a10", x: 28_750, y: 398 },
  { id: "a11", x: 31_850, y: 220 }, { id: "a12", x: 34_250, y: 430 },
] as const;

export type RaceInputTransition = { tick: number; held: boolean };

export type RaceState = {
  seed: number;
  tick: number;
  phase: RacePhase;
  phaseTick: number;
  phaseStartPosition: number;
  coursePosition: number;
  previousCoursePosition: number;
  y: number;
  previousY: number;
  vy: number;
  held: boolean;
  inputs: RaceInputTransition[];
  inputCursor: number;
  speed: number;
  speedGraceTicks: number;
  collisionGraceTicks: number;
  charge: number;
  wormholes: number;
  entryY: number;
  returnY: number;
  ringLedger: RaceObjectState[];
  debrisLedger: boolean[];
  debrisContacts: string[];
  acornLedger: boolean[];
  tunnelAcornLedger: boolean[][];
  acorns: number;
  entryTicks: number[];
  wallSuppressTicks: number;
  finishTicks: number | null;
  finishEmitted: boolean;
};

export type RaceStepResult = {
  sound: "ring" | "debris" | "acorn" | "entry" | "return" | "finish" | null;
  finished: boolean;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function hash(seed: number, n: number) {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function createRaceState(seed = RACE_SEED): RaceState {
  return {
    seed: seed >>> 0,
    tick: 0,
    phase: "normal",
    phaseTick: 0,
    phaseStartPosition: 0,
    coursePosition: 0,
    previousCoursePosition: 0,
    y: RACE_HEIGHT * 0.45,
    previousY: RACE_HEIGHT * 0.45,
    vy: 0,
    held: false,
    inputs: [],
    inputCursor: 0,
    speed: RACE_BASE_SPEED,
    speedGraceTicks: 0,
    collisionGraceTicks: 0,
    charge: 0,
    wormholes: 0,
    entryY: RACE_HEIGHT * 0.5,
    returnY: RACE_HEIGHT * 0.5,
    ringLedger: RACE_RINGS.map(() => "pending"),
    debrisLedger: RACE_DEBRIS.map(() => false),
    debrisContacts: [],
    acornLedger: RACE_ACORNS.map(() => false),
    tunnelAcornLedger: [],
    acorns: 0,
    entryTicks: [],
    wallSuppressTicks: 0,
    finishTicks: null,
    finishEmitted: false,
  };
}

export function queueRaceHeld(race: RaceState, held: boolean, tick = race.tick) {
  const prior = race.inputs[race.inputs.length - 1];
  if (prior && prior.tick === tick) {
    prior.held = held;
    return;
  }
  if (prior?.held === held || (!prior && race.held === held)) return;
  race.inputs.push({ tick, held });
}

export function loadRaceInputs(race: RaceState, inputs: readonly RaceInputTransition[]) {
  race.inputs = inputs.map((i) => ({ tick: Math.max(0, Math.floor(i.tick)), held: !!i.held }))
    .sort((a, b) => a.tick - b.tick);
  race.inputCursor = 0;
}

function consumeInputs(race: RaceState) {
  while (race.inputCursor < race.inputs.length && race.inputs[race.inputCursor].tick <= race.tick) {
    race.held = race.inputs[race.inputCursor].held;
    race.inputCursor += 1;
  }
}

function stepPilot(race: RaceState) {
  // Release: +1,050 px/s². Hold: gravity plus thrust = -700 px/s².
  race.vy = clamp(race.vy + (race.held ? -700 : 1_050) * RACE_DT, -330, 390);
  race.y += race.vy * RACE_DT;
  const floor = RACE_HEIGHT - RACE_PILOT_RADIUS;
  const ceiling = RACE_PILOT_RADIUS;
  if (race.y < ceiling) { race.y = ceiling; race.vy = Math.max(0, race.vy); }
  if (race.y > floor) { race.y = floor; race.vy = Math.min(0, race.vy); }
}

export function sweptPointHit(
  ax0: number, ay0: number, ax1: number, ay1: number,
  bx: number, by: number, radius: number,
) {
  const dx = ax1 - ax0;
  const dy = ay1 - ay0;
  const len2 = dx * dx + dy * dy;
  const u = len2 > 0 ? clamp(((bx - ax0) * dx + (by - ay0) * dy) / len2, 0, 1) : 0;
  const ex = ax0 + dx * u - bx;
  const ey = ay0 + dy * u - by;
  return ex * ex + ey * ey <= radius * radius;
}

export function sweptGateHit(
  previousPosition: number,
  nextPosition: number,
  previousY: number,
  nextY: number,
  ring: RaceRing,
) {
  if (ring.x < previousPosition || ring.x > nextPosition) return false;
  const span = Math.max(Number.EPSILON, nextPosition - previousPosition);
  const u = clamp((ring.x - previousPosition) / span, 0, 1);
  return Math.abs(previousY + (nextY - previousY) * u - ring.y) <= RACE_GATE_CLEARANCE;
}

export function sweptDebrisHit(
  previousPosition: number,
  nextPosition: number,
  previousY: number,
  nextY: number,
  debris: RaceDebris,
) {
  return sweptPointHit(
    previousPosition, previousY, nextPosition, nextY,
    debris.x, debris.y, debris.r + RACE_PILOT_RADIUS,
  );
}

function crossNormalObjects(race: RaceState): RaceStepResult["sound"] {
  let sound: RaceStepResult["sound"] = null;
  for (let i = 0; i < RACE_RINGS.length; i++) {
    if (race.ringLedger[i] !== "pending") continue;
    const ring = RACE_RINGS[i];
    if (ring.x > race.coursePosition) break;
    if (ring.x < race.previousCoursePosition) {
      race.ringLedger[i] = "missed";
      continue;
    }
    if (sweptGateHit(race.previousCoursePosition, race.coursePosition, race.previousY, race.y, ring)) {
      race.ringLedger[i] = "passed";
      race.charge = Math.min(100, race.charge + 20);
      race.speed = Math.min(RACE_MAX_SPEED, race.speed + 22);
      race.speedGraceTicks = RACE_SPEED_GRACE_TICKS;
      sound = "ring";
    } else {
      race.ringLedger[i] = "missed";
    }
  }

  for (let i = 0; i < RACE_DEBRIS.length; i++) {
    if (race.debrisLedger[i]) continue;
    const debris = RACE_DEBRIS[i];
    if (debris.x + debris.r < race.previousCoursePosition) { race.debrisLedger[i] = true; continue; }
    if (debris.x - debris.r > race.coursePosition) break;
    if (race.collisionGraceTicks <= 0 &&
        sweptDebrisHit(race.previousCoursePosition, race.coursePosition, race.previousY, race.y, debris)) {
      race.debrisLedger[i] = true;
      race.debrisContacts.push(debris.id);
      race.speed = RACE_BASE_SPEED;
      race.speedGraceTicks = 0;
      race.charge = Math.max(0, race.charge - 20);
      race.collisionGraceTicks = RACE_DEBRIS_GRACE_TICKS;
      sound = "debris";
    }
  }

  for (let i = 0; i < RACE_ACORNS.length; i++) {
    if (race.acornLedger[i]) continue;
    const acorn = RACE_ACORNS[i];
    if (acorn.x + 26 < race.previousCoursePosition) { race.acornLedger[i] = true; continue; }
    if (acorn.x - 26 > race.coursePosition) break;
    if (sweptPointHit(
      race.previousCoursePosition, race.previousY,
      race.coursePosition, race.y,
      acorn.x, acorn.y, RACE_PILOT_RADIUS + 10,
    )) {
      race.acornLedger[i] = true;
      race.acorns += 1;
      if (!sound) sound = "acorn";
    }
  }
  return sound;
}

function beginEntry(race: RaceState) {
  race.phase = "entry";
  race.phaseTick = 0;
  race.phaseStartPosition = race.coursePosition;
  race.entryY = race.y;
  race.charge = 100;
  race.entryTicks.push(race.tick + 1);
}

function skipTunnelSpan(race: RaceState, from: number, to: number) {
  for (let i = 0; i < RACE_RINGS.length; i++) {
    if (race.ringLedger[i] === "pending" && RACE_RINGS[i].x > from && RACE_RINGS[i].x <= to) {
      race.ringLedger[i] = "skipped";
    }
  }
  for (let i = 0; i < RACE_DEBRIS.length; i++) {
    if (!race.debrisLedger[i] && RACE_DEBRIS[i].x > from && RACE_DEBRIS[i].x <= to) race.debrisLedger[i] = true;
  }
  for (let i = 0; i < RACE_ACORNS.length; i++) {
    if (!race.acornLedger[i] && RACE_ACORNS[i].x > from && RACE_ACORNS[i].x <= to) race.acornLedger[i] = true;
  }
}

export function raceTunnelCenter(race: Pick<RaceState, "seed" | "wormholes">, tick: number) {
  const segment = Math.floor(tick / 45);
  const f = (tick % 45) / 45;
  const a = 245 + (hash(race.seed + race.wormholes * 97, segment) % 151);
  const b = 245 + (hash(race.seed + race.wormholes * 97, segment + 1) % 151);
  const smooth = f * f * (3 - 2 * f);
  return a + (b - a) * smooth;
}

export function raceTunnelAcorns(race: Pick<RaceState, "seed" | "wormholes">) {
  return Array.from({ length: 20 }, (_, i) => ({
    tick: 18 + i * 26,
    y: 250 + (hash(race.seed + race.wormholes * 193, i + 31) % 141),
  }));
}

function stepTunnel(race: RaceState): RaceStepResult["sound"] {
  stepPilot(race);
  const center = raceTunnelCenter(race, race.phaseTick);
  const half = 150;
  const top = center - half + RACE_PILOT_RADIUS;
  const bottom = center + half - RACE_PILOT_RADIUS;
  if (race.y < top || race.y > bottom) {
    race.y = clamp(race.y, top, bottom);
    race.vy = 0;
    race.wallSuppressTicks = 15;
  } else if (race.wallSuppressTicks > 0) {
    race.wallSuppressTicks -= 1;
  }

  const cycle = race.wormholes;
  const acorns = raceTunnelAcorns(race);
  const ledger = race.tunnelAcornLedger[cycle] ?? (race.tunnelAcornLedger[cycle] = acorns.map(() => false));
  let sound: RaceStepResult["sound"] = null;
  for (let i = 0; i < acorns.length; i++) {
    if (!ledger[i] && acorns[i].tick === race.phaseTick) {
      ledger[i] = true;
      if (race.wallSuppressTicks <= 0 && Math.abs(race.y - acorns[i].y) <= RACE_PILOT_RADIUS + 12) {
        race.acorns += 1;
        sound = "acorn";
      }
    }
  }
  race.coursePosition = race.phaseStartPosition + RACE_TUNNEL_DISTANCE * ((race.phaseTick + 1) / RACE_TUNNEL_TICKS);
  race.speed = RACE_TUNNEL_SPEED;
  return sound;
}

export function stepRace(race: RaceState): RaceStepResult {
  if (race.phase === "finish") {
    return { sound: null, finished: false };
  }

  consumeInputs(race); // Input transitions are authoritative before physics.
  race.previousCoursePosition = race.coursePosition;
  race.previousY = race.y;
  if (race.collisionGraceTicks > 0) race.collisionGraceTicks -= 1;
  let sound: RaceStepResult["sound"] = null;

  if (race.phase === "normal") {
    stepPilot(race);
    if (race.speedGraceTicks > 0) race.speedGraceTicks -= 1;
    else race.speed = Math.max(RACE_BASE_SPEED, race.speed - 4 * RACE_DT);
    race.coursePosition = Math.min(RACE_LENGTH, race.coursePosition + race.speed * RACE_DT);
    sound = crossNormalObjects(race);
    if (race.charge >= 100 && race.wormholes < RACE_MAX_WORMHOLES) {
      beginEntry(race);
      sound = "entry";
    }
  } else if (race.phase === "entry") {
    race.phaseTick += 1;
    const f = race.phaseTick / RACE_ENTRY_TICKS;
    const eased = f * f * (3 - 2 * f);
    race.y = race.entryY + (RACE_HEIGHT * 0.5 - race.entryY) * eased;
    race.vy = 0;
    if (race.phaseTick >= RACE_ENTRY_TICKS) {
      race.phase = "tunnel";
      race.phaseTick = 0;
      race.phaseStartPosition = race.coursePosition;
      race.tunnelAcornLedger[race.wormholes] = Array(20).fill(false);
    }
  } else if (race.phase === "tunnel") {
    sound = stepTunnel(race);
    race.phaseTick += 1;
    if (race.phaseTick >= RACE_TUNNEL_TICKS) {
      const exit = race.phaseStartPosition + RACE_TUNNEL_DISTANCE;
      race.coursePosition = exit;
      skipTunnelSpan(race, race.phaseStartPosition, exit);
      race.phase = "return";
      race.phaseTick = 0;
      race.returnY = clamp(race.y, RACE_RETURN_MARGIN, RACE_HEIGHT - RACE_RETURN_MARGIN);
    }
  } else if (race.phase === "return") {
    race.phaseTick += 1;
    const f = race.phaseTick / RACE_RETURN_TICKS;
    const eased = f * f * (3 - 2 * f);
    race.y += (race.returnY - race.y) * eased;
    race.vy = 0;
    if (race.phaseTick >= RACE_RETURN_TICKS) {
      race.y = race.returnY;
      race.phase = "normal";
      race.phaseTick = 0;
      race.wormholes += 1;
      race.charge = 0;
      race.speed = RACE_RETURN_SPEED;
      race.speedGraceTicks = 0;
      race.collisionGraceTicks = RACE_RETURN_GRACE_TICKS;
      sound = "return";
    }
  }

  race.tick += 1;
  if (race.phase === "normal" && race.coursePosition >= RACE_LENGTH) {
    race.phase = "finish";
    race.finishTicks = race.tick;
    if (!race.finishEmitted) {
      race.finishEmitted = true;
      return { sound: "finish", finished: true };
    }
  }
  return { sound, finished: false };
}

export function raceGrade(finishTicks: number | null) {
  if (finishTicks == null) return 0;
  if (finishTicks <= 8_700) return 3;
  if (finishTicks <= 10_200) return 2;
  return 1;
}

export function formatRaceTicks(ticks: number | null) {
  if (ticks == null) return "—:——.———";
  const ms = Math.floor((ticks * 1000) / RACE_HZ);
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

export function raceSignature(race: RaceState) {
  return {
    finishTicks: race.finishTicks,
    acorns: race.acorns,
    ringLedger: race.ringLedger.join(","),
    debrisContacts: [...race.debrisContacts],
    entryTicks: [...race.entryTicks],
  };
}
