// HYPER RUN — deterministic, fixed-step race authority.
//
// This module knows nothing about canvas size, render cadence, DOM events, or
// the campaign. Feed it semantic input snapshots stamped with simulation ticks
// and call stepRace exactly once per 1/60-second live race step.
import { QUICK_DROP_VY } from "./control-constants.js?v=184";
export const RACE_EVENT_ID = "hyper-run";
export const RACE_SEED = 0x48595231;
export const RACE_HZ = 60;
export const RACE_DT = 1 / RACE_HZ;
export const RACE_WIDTH = 360;
export const RACE_HEIGHT = 640;
export const RACE_COURSE_SCALE = 0.75;
export const RACE_LENGTH = 33750;
export const RACE_PILOT_X = 96;
export const RACE_PILOT_RADIUS = 16;
export const RACE_GATE_APERTURE = 54;
export const RACE_GATE_CLEARANCE = RACE_GATE_APERTURE - RACE_PILOT_RADIUS;
export const RACE_GATE_PASS_FADE_TICKS = 27;
export const RACE_GATE_MISS_FADE_TICKS = 39;
export const RACE_BASE_SPEED = 225;
export const RACE_MAX_SPEED = 360;
export const RACE_RING_SPEED_GAIN = 13.5;
export const RACE_RETURN_SPEED = 292.5;
export const RACE_TUNNEL_SPEED = 562.5;
export const RACE_TUNNEL_DISTANCE = 3375;
export const RACE_ENTRY_TICKS = 48;
export const RACE_TUNNEL_TICKS = 360;
export const RACE_RETURN_TICKS = 36;
export const RACE_TUNNEL_DRAG_TRAVERSAL_TICKS = 48;
/** Maximum canonical Y travel per fixed step: one full 640px field in 48 ticks. */
export const RACE_TUNNEL_DRAG_STEP = RACE_HEIGHT / RACE_TUNNEL_DRAG_TRAVERSAL_TICKS;
export function raceTunnelFollowerY(currentY, targetY) {
    return targetY === null
        ? currentY
        : currentY + clamp(targetY - currentY, -RACE_TUNNEL_DRAG_STEP, RACE_TUNNEL_DRAG_STEP);
}
export const RACE_TUNNEL_RING_TICKS = [36, 72, 108, 144, 180, 216, 252, 288, 324];
export const RACE_TUNNEL_RING_APERTURE = 58;
export const RACE_TUNNEL_PERFECT_APERTURE = 30;
export const RACE_TUNNEL_RING_CLEARANCE = RACE_TUNNEL_RING_APERTURE - RACE_PILOT_RADIUS;
export const RACE_TUNNEL_PERFECT_CLEARANCE = RACE_TUNNEL_PERFECT_APERTURE - RACE_PILOT_RADIUS;
/** One pass is one unit and one perfect is two; 18 units span return speed to max speed. */
export const RACE_TUNNEL_QUALITY_SPEED_GAIN = (RACE_MAX_SPEED - RACE_RETURN_SPEED) / (RACE_TUNNEL_RING_TICKS.length * 2);
export const RACE_SPEED_GRACE_TICKS = 90;
export const RACE_SPEED_DECAY_PER_SECOND = 13.5;
export const RACE_RETURN_GRACE_TICKS = 21;
export const RACE_DEBRIS_GRACE_TICKS = 45;
export const RACE_MAX_WORMHOLES = 3;
export const RACE_RING_CHARGE = 5;
export const RACE_DEBRIS_CHARGE_PENALTY = 10;
export const RACE_MAX_INTERACTIVE_GAP = 540;
export const RACE_TWO_STAR_TICKS = 6900;
export const RACE_THREE_STAR_TICKS = 5760;
/** Hyper Run's authored course pickups; the alignment-only tunnel has no acorns. */
export const RACE_MAX_ACORNS = 42;
export const RACE_READY_COPY = [
    "THREAD GATES · CHARGE SHORTCUTS · FINISH FAST",
    "FLIGHT: HOLD / RELEASE",
    "DOUBLE-TAP + HOLD: BOOST · SWIPE DOWN: DIVE",
    "WORMHOLE: DRAG TO ALIGN · CENTER = FASTER EXIT",
    "PRESS + HOLD TO LAUNCH",
];
// Smallest tunnel half-width (88) plus half the 16-pixel pilot radius (8).
// This remains a geometric derivation, not an alias for the pilot screen X.
export const RACE_RETURN_MARGIN = 88 + RACE_PILOT_RADIUS / 2;
const NORMAL_RELEASE_ACCEL = 1050;
const NORMAL_HOLD_ACCEL = -700;
const NORMAL_BOOST_ACCEL = -2100;
const NORMAL_MIN_VY = -330;
const NORMAL_BOOST_MIN_VY = -520;
const NORMAL_MAX_VY = 390;
export const RACE_NORMAL_PRESS_VY = -210;
export const RACE_NORMAL_BOOST_PRESS_VY = -420;
export const RACE_NORMAL_RELEASE_BRAKE_VY = -120;
export const RACE_LATEST_ENTRY_X = RACE_LENGTH - RACE_TUNNEL_DISTANCE;
const RING_POINTS = [
    [600, 320], [1020, 280], [1440, 360], [1880, 240], [2320, 400], [2780, 200], [3240, 440],
    [3680, 220], [4120, 420], [4580, 260], [5220, 380], [5840, 240], [6460, 430], [7080, 300],
    [7520, 440], [7960, 200], [8400, 380], [9040, 144], [9400, 496], [10000, 320], [10440, 220],
    [11040, 430], [11460, 180], [12080, 460], [12520, 250], [13140, 440], [13600, 200], [14300, 360],
    [15000, 320], [15440, 270], [15880, 390], [16340, 200], [16780, 450], [17420, 240], [17860, 420],
    [18520, 180], [18960, 460], [19640, 260], [20100, 400], [20740, 220], [21180, 440], [21860, 300],
    [22540, 420], [22980, 200], [23600, 380], [24040, 160], [24400, 440], [25000, 300], [25440, 220],
    [26040, 430], [26460, 180], [27080, 460], [27520, 250], [28140, 440], [28600, 200], [29300, 360],
    [30000, 320], [30440, 240], [30880, 420], [31340, 180], [31780, 460], [32420, 220], [32860, 440],
    [33520, 200], [33960, 480], [34640, 260], [35100, 420], [35740, 180], [36180, 460], [36840, 300],
    [37540, 420], [38160, 260], [38840, 496], [39232, 496], [39616, 144], [40000, 496], [40440, 220],
    [41040, 430], [41460, 180], [42080, 460], [42520, 250], [43140, 440], [43600, 200], [44300, 360],
];
const RING_SKILLS = {
    17: "launch-boost-ladder",
    18: "snap-drop-in",
    19: "snap-drop-out",
    73: "redline-low-in",
    74: "redline-high",
    75: "redline-low-out",
};
export const RACE_RINGS = RING_POINTS.map(([x, y], i) => ({
    id: `r${String(i + 1).padStart(2, "0")}`,
    x: x * RACE_COURSE_SCALE,
    y,
    tilt: 0,
    ...(RING_SKILLS[i] ? { skill: RING_SKILLS[i] } : {}),
}));
const DEBRIS_POINTS = [
    [2500, 520, 24], [4700, 120, 22], [6120, 500, 25], [7320, 130, 23],
    [8240, 120, 24], [8720, 250, 25], [8840, 520, 24], [9520, 160, 22], [11800, 500, 25], [14120, 130, 23],
    [16200, 510, 24], [17600, 130, 22], [18800, 500, 25], [20400, 140, 23], [22000, 520, 24],
    [22800, 500, 24], [23900, 110, 22], [25700, 520, 25], [27400, 120, 23], [29200, 500, 24],
    [30500, 520, 24], [32200, 120, 22], [34000, 510, 25], [35400, 130, 23], [37000, 500, 24],
    [37850, 520, 24], [38600, 110, 22], [40700, 120, 25], [42900, 510, 23], [44700, 100, 24],
];
export const RACE_DEBRIS = DEBRIS_POINTS.map(([x, y, r], i) => ({
    id: `d${String(i + 1).padStart(2, "0")}`,
    x: x * RACE_COURSE_SCALE,
    y,
    r,
    art: i % 3,
    ...(i === 5 || i === 6 ? { skill: "snap-drop-pinch" } : {}),
    ...(i === 26 ? { skill: "exam-brake-proof" } : {}),
}));
const ACORN_POINTS = [
    [800, 320], [1660, 300], [2540, 380], [3420, 220], [4300, 400], [5380, 300], [6200, 420], [7240, 320],
    [7700, 400], [8500, 220], [9200, 460], [9800, 320],
    [15200, 320], [16100, 250], [17000, 410], [17800, 220], [18600, 440], [19400, 260], [20300, 420], [21200, 240], [22100, 360],
    [22848, 160], [23232, 480], [23616, 160], [24200, 360], [24800, 280],
    [30200, 320], [30900, 250], [31600, 410], [32300, 190], [33000, 450], [33700, 220], [34400, 430], [35100, 240], [36000, 400], [37000, 300],
    [37680, 360], [38280, 450], [38720, 496], [39120, 496], [39504, 144], [39888, 496],
];
export const RACE_ACORNS = ACORN_POINTS.map(([x, y], i) => ({
    id: `a${String(i + 1).padStart(2, "0")}`,
    x: x * RACE_COURSE_SCALE,
    y,
    ...(i >= 21 && i <= 23 ? { skill: "high-low-high" } : {}),
    ...(i >= 38 ? { skill: "redline-reward" } : {}),
}));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smoothstep = (n) => {
    const f = clamp(n, 0, 1);
    return f * f * (3 - 2 * f);
};
/** Visual age for events stamped during the pre-increment authority step. */
export function raceDecisionAge(nextTick, decisionTick) {
    return Math.max(0, nextTick - 1 - decisionTick);
}
/**
 * One authority-owned source for the director target and whether another
 * charged entry can still be earned. Eligibility assumes the needed pending
 * gates are passed; actual pass/miss decisions remain fixed-step authority.
 */
export function raceRouteTarget(race) {
    const pending = [];
    for (let i = 0; i < RACE_RINGS.length; i++) {
        if (race.ringLedger[i] === "pending")
            pending.push(i);
    }
    const ringsNeeded = Math.max(1, Math.ceil((100 - race.charge) / RACE_RING_CHARGE));
    const nextRingIndex = pending[0] ?? null;
    const entryRingIndex = pending[ringsNeeded - 1] ?? null;
    const remainingEligible = pending.filter((index) => RACE_RINGS[index].x <= RACE_LATEST_ENTRY_X).length;
    const entryEligible = race.wormholes < RACE_MAX_WORMHOLES
        && entryRingIndex != null
        && RACE_RINGS[entryRingIndex].x <= RACE_LATEST_ENTRY_X;
    return {
        nextRingIndex,
        ringsNeeded,
        remainingEligible,
        entryRingIndex,
        entryEligible,
        entryReady: race.charge >= 100 && entryEligible,
        nextCleanGateEnters: ringsNeeded === 1 && entryEligible,
        finalRoute: !entryEligible,
    };
}
function hash(seed, n) {
    let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
}
export function createRaceState(seed = RACE_SEED) {
    const startY = RACE_HEIGHT * 0.45;
    return {
        seed: seed >>> 0,
        tick: 0,
        phase: "normal",
        phaseTick: 0,
        phaseStartPosition: 0,
        coursePosition: 0,
        previousCoursePosition: 0,
        y: startY,
        previousY: startY,
        vy: 0,
        held: false,
        boost: false,
        tunnelDragY: null,
        inputs: [],
        inputCursor: 0,
        speed: RACE_BASE_SPEED,
        speedGraceTicks: 0,
        collisionGraceTicks: 0,
        charge: 0,
        wormholes: 0,
        entryRingIndex: null,
        entryStartY: startY,
        entryAnchorY: startY,
        returnY: RACE_HEIGHT * 0.5,
        ringLedger: RACE_RINGS.map(() => "pending"),
        ringDecisionTicks: RACE_RINGS.map(() => null),
        debrisLedger: RACE_DEBRIS.map(() => false),
        debrisContacts: [],
        acornLedger: RACE_ACORNS.map(() => false),
        tunnelRingLedger: [],
        tunnelRingDecisionTicks: [],
        acorns: 0,
        entryTicks: [],
        boostTicks: [],
        dropTicks: [],
        wallScrapeTicks: [],
        wallSuppressTicks: 0,
        finishTicks: null,
        finishEmitted: false,
    };
}
function normalizeDragY(dragY) {
    if (dragY === undefined || dragY === null)
        return dragY;
    if (!Number.isFinite(dragY))
        throw new RangeError("Hyper Run dragY must be finite, null, or undefined");
    return Math.round(clamp(dragY, 0, RACE_HEIGHT));
}
function validInput(input) {
    if (input.boost && !input.held)
        throw new RangeError("Hyper Run boost requires held=true");
    normalizeDragY(input.dragY);
}
/** Same-tick state and drag target are last-writer-wins; drop is OR-preserved. */
export function queueRaceInput(race, input, tick = race.tick) {
    validInput(input);
    const at = Math.max(0, Math.floor(tick));
    const hasDragY = input.dragY !== undefined;
    const dragY = normalizeDragY(input.dragY);
    const prior = race.inputs[race.inputs.length - 1];
    if (prior && prior.tick === at) {
        prior.held = input.held;
        prior.boost = input.boost;
        if (input.drop)
            prior.drop = true;
        if (hasDragY)
            prior.dragY = dragY;
        return;
    }
    const hasPendingInput = race.inputCursor < race.inputs.length;
    const lastHeld = hasPendingInput ? prior?.held ?? race.held : race.held;
    const lastBoost = hasPendingInput ? prior?.boost ?? race.boost : race.boost;
    // Once the log is fully consumed, authority state is the effective state.
    // Entry/tunnel/return boundaries reset flight and drag controls. Consumed
    // values must not suppress a fresh press or the next cycle's first drag.
    let lastDragY = race.tunnelDragY;
    if (hasPendingInput) {
        // held/boost-only transitions intentionally omit dragY. Walk the unconsumed
        // suffix so dedupe compares against the effective queued drag target, not
        // an unrelated live target or only the final snapshot's optional field.
        for (let i = race.inputs.length - 1; i >= race.inputCursor; i -= 1) {
            if (race.inputs[i].dragY !== undefined) {
                lastDragY = race.inputs[i].dragY;
                break;
            }
        }
    }
    if (!input.drop && lastHeld === input.held && lastBoost === input.boost
        && (!hasDragY || lastDragY === dragY))
        return;
    race.inputs.push({
        tick: at,
        held: input.held,
        boost: input.boost,
        ...(input.drop ? { drop: true } : {}),
        ...(hasDragY ? { dragY: dragY } : {}),
    });
}
export function queueRaceHeld(race, held, tick = race.tick) {
    queueRaceInput(race, { held, boost: held ? race.boost : false }, tick);
}
export function loadRaceInputs(race, inputs) {
    const ordered = inputs.map((input, order) => {
        const hasDragY = input.dragY !== undefined;
        const normalized = {
            tick: Math.max(0, Math.floor(input.tick)), held: !!input.held, boost: !!input.boost,
            ...(input.drop ? { drop: true } : {}),
            ...(hasDragY ? { dragY: normalizeDragY(input.dragY) } : {}),
            order,
        };
        validInput(normalized);
        return normalized;
    }).sort((a, b) => a.tick - b.tick || a.order - b.order);
    const merged = [];
    for (const input of ordered) {
        const prior = merged[merged.length - 1];
        if (prior?.tick === input.tick) {
            prior.held = input.held;
            prior.boost = input.boost;
            if (input.drop)
                prior.drop = true;
            if (input.dragY !== undefined)
                prior.dragY = input.dragY;
        }
        else {
            merged.push({
                tick: input.tick,
                held: input.held,
                boost: input.boost,
                ...(input.drop ? { drop: true } : {}),
                ...(input.dragY !== undefined ? { dragY: input.dragY } : {}),
            });
        }
    }
    race.inputs = merged;
    race.inputCursor = 0;
    race.held = false;
    race.boost = false;
    race.tunnelDragY = null;
}
function consumeInputs(race) {
    while (race.inputCursor < race.inputs.length && race.inputs[race.inputCursor].tick <= race.tick) {
        const input = race.inputs[race.inputCursor];
        if (input.dragY !== undefined)
            race.tunnelDragY = input.dragY;
        // Hold, boost, and drop belong to normal flight. The tunnel consumes only
        // its explicit drag target, so stale gesture state cannot alter its path.
        if (race.phase === "normal") {
            const wasHeld = race.held;
            const wasBoosting = race.boost;
            race.held = input.held;
            race.boost = !!input.boost;
            if (race.boost && !wasBoosting) {
                race.vy = Math.min(race.vy, RACE_NORMAL_BOOST_PRESS_VY);
                race.boostTicks.push(race.tick);
            }
            else if (race.held && !wasHeld) {
                race.vy = Math.min(race.vy, RACE_NORMAL_PRESS_VY);
            }
            if (wasHeld && !race.held)
                race.vy = Math.max(race.vy, RACE_NORMAL_RELEASE_BRAKE_VY);
            // Drop is deliberately last-writer on a shared tick. A swipe that also
            // releases or closes a boost must still produce the full familiar dive.
            if (input.drop) {
                race.vy = QUICK_DROP_VY;
                race.dropTicks.push(race.tick);
            }
        }
        race.inputCursor += 1;
    }
}
function stepPilot(race) {
    const acceleration = race.boost ? NORMAL_BOOST_ACCEL : race.held ? NORMAL_HOLD_ACCEL : NORMAL_RELEASE_ACCEL;
    const minVy = race.boost ? NORMAL_BOOST_MIN_VY : NORMAL_MIN_VY;
    const maxVy = NORMAL_MAX_VY;
    race.vy = clamp(race.vy + acceleration * RACE_DT, minVy, maxVy);
    race.y += race.vy * RACE_DT;
    const ceiling = RACE_PILOT_RADIUS;
    const floor = RACE_HEIGHT - RACE_PILOT_RADIUS;
    if (race.y < ceiling) {
        race.y = ceiling;
        race.vy = Math.max(0, race.vy);
    }
    if (race.y > floor) {
        race.y = floor;
        race.vy = Math.min(0, race.vy);
    }
}
export function sweptPointHit(ax0, ay0, ax1, ay1, bx, by, radius) {
    const dx = ax1 - ax0;
    const dy = ay1 - ay0;
    const len2 = dx * dx + dy * dy;
    const u = len2 > 0 ? clamp(((bx - ax0) * dx + (by - ay0) * dy) / len2, 0, 1) : 0;
    const ex = ax0 + dx * u - bx;
    const ey = ay0 + dy * u - by;
    return ex * ex + ey * ey <= radius * radius;
}
export function sweptGateHit(previousPosition, nextPosition, previousY, nextY, ring) {
    if (!(previousPosition < ring.x && ring.x <= nextPosition))
        return false;
    const span = Math.max(Number.EPSILON, nextPosition - previousPosition);
    const u = clamp((ring.x - previousPosition) / span, 0, 1);
    return Math.abs(previousY + (nextY - previousY) * u - ring.y) <= RACE_GATE_CLEARANCE;
}
export function sweptDebrisHit(previousPosition, nextPosition, previousY, nextY, debris) {
    return sweptPointHit(previousPosition, previousY, nextPosition, nextY, debris.x, debris.y, debris.r + RACE_PILOT_RADIUS);
}
function crossNormalObjects(race) {
    let sound = null;
    const cues = [];
    let entryRingIndex = null;
    for (let i = 0; i < RACE_RINGS.length; i++) {
        if (race.ringLedger[i] !== "pending")
            continue;
        const ring = RACE_RINGS[i];
        if (ring.x > race.coursePosition)
            break;
        if (!(race.previousCoursePosition < ring.x && ring.x <= race.coursePosition))
            continue;
        const passed = sweptGateHit(race.previousCoursePosition, race.coursePosition, race.previousY, race.y, ring);
        race.ringLedger[i] = passed ? "passed" : "missed";
        race.ringDecisionTicks[i] = race.tick;
        cues.push({
            kind: passed ? "ring-pass" : "ring-miss",
            tick: race.tick,
            id: ring.id,
            index: i,
            y: ring.y,
            chargeDelta: passed ? RACE_RING_CHARGE : 0,
        });
        if (passed) {
            race.charge = Math.min(100, race.charge + RACE_RING_CHARGE);
            race.speed = Math.min(RACE_MAX_SPEED, race.speed + RACE_RING_SPEED_GAIN);
            race.speedGraceTicks = RACE_SPEED_GRACE_TICKS;
            sound = "ring";
            if (race.charge >= 100 && race.wormholes < RACE_MAX_WORMHOLES && ring.x <= RACE_LATEST_ENTRY_X) {
                entryRingIndex = i;
                break;
            }
        }
    }
    const settleThrough = entryRingIndex == null ? race.coursePosition : RACE_RINGS[entryRingIndex].x;
    for (let i = 0; i < RACE_DEBRIS.length; i++) {
        if (race.debrisLedger[i])
            continue;
        const debris = RACE_DEBRIS[i];
        if (debris.x + debris.r < race.previousCoursePosition) {
            race.debrisLedger[i] = true;
            continue;
        }
        if (debris.x - debris.r > settleThrough)
            break;
        if (race.collisionGraceTicks <= 0 && sweptDebrisHit(race.previousCoursePosition, settleThrough, race.previousY, race.y, debris)) {
            race.debrisLedger[i] = true;
            race.debrisContacts.push(debris.id);
            race.speed = RACE_BASE_SPEED;
            race.speedGraceTicks = 0;
            race.charge = Math.max(0, race.charge - RACE_DEBRIS_CHARGE_PENALTY);
            race.collisionGraceTicks = RACE_DEBRIS_GRACE_TICKS;
            cues.push({
                kind: "debris-hit",
                tick: race.tick,
                id: debris.id,
                index: i,
                y: debris.y,
                chargeDelta: -RACE_DEBRIS_CHARGE_PENALTY,
            });
            sound = "debris";
        }
    }
    for (let i = 0; i < RACE_ACORNS.length; i++) {
        if (race.acornLedger[i])
            continue;
        const acorn = RACE_ACORNS[i];
        if (acorn.x + 26 < race.previousCoursePosition) {
            race.acornLedger[i] = true;
            continue;
        }
        if (acorn.x - 26 > settleThrough)
            break;
        if (sweptPointHit(race.previousCoursePosition, race.previousY, settleThrough, race.y, acorn.x, acorn.y, RACE_PILOT_RADIUS + 10)) {
            race.acornLedger[i] = true;
            race.acorns += 1;
            cues.push({ kind: "acorn", tick: race.tick, id: acorn.id, index: i, y: acorn.y, chargeDelta: 0 });
            if (!sound)
                sound = "acorn";
        }
    }
    return { sound, cues, entryRingIndex };
}
function beginEntry(race, ringIndex) {
    const ring = RACE_RINGS[ringIndex];
    race.phase = "entry";
    race.phaseTick = 0;
    race.coursePosition = ring.x;
    race.phaseStartPosition = ring.x;
    race.entryRingIndex = ringIndex;
    race.entryStartY = race.y;
    race.entryAnchorY = ring.y;
    race.charge = 100;
    race.held = false;
    race.boost = false;
    race.tunnelDragY = null;
    race.entryTicks.push(race.tick);
}
function skipTunnelSpan(race, from, to) {
    for (let i = 0; i < RACE_RINGS.length; i++) {
        if (race.ringLedger[i] === "pending" && RACE_RINGS[i].x > from && RACE_RINGS[i].x <= to) {
            race.ringLedger[i] = "skipped";
        }
    }
    for (let i = 0; i < RACE_DEBRIS.length; i++) {
        if (!race.debrisLedger[i] && RACE_DEBRIS[i].x > from && RACE_DEBRIS[i].x <= to)
            race.debrisLedger[i] = true;
    }
    for (let i = 0; i < RACE_ACORNS.length; i++) {
        if (!race.acornLedger[i] && RACE_ACORNS[i].x > from && RACE_ACORNS[i].x <= to)
            race.acornLedger[i] = true;
    }
}
const TUNNEL_SPINE = [
    { tick: 0, center: 320, half: 144 },
    { tick: 45, center: 248, half: 126 },
    { tick: 90, center: 204, half: 96 },
    { tick: 135, center: 408, half: 108 },
    { tick: 180, center: 440, half: 88 },
    { tick: 225, center: 468, half: 104 },
    { tick: 255, center: 168, half: 88 },
    { tick: 285, center: 452, half: 96 },
    { tick: 315, center: 360, half: 120 },
    { tick: 359, center: 320, half: 144 },
];
export function raceTunnelMirrored(race) {
    return (hash(race.seed ^ 0x4d495252, race.wormholes) & 1) === 1;
}
export function raceTunnelGeometry(race, tick) {
    const at = clamp(tick, 0, RACE_TUNNEL_TICKS - 1);
    let b = TUNNEL_SPINE[TUNNEL_SPINE.length - 1];
    let a = TUNNEL_SPINE[TUNNEL_SPINE.length - 2];
    for (let i = 1; i < TUNNEL_SPINE.length; i++) {
        if (at <= TUNNEL_SPINE[i].tick) {
            a = TUNNEL_SPINE[i - 1];
            b = TUNNEL_SPINE[i];
            break;
        }
    }
    const mirrored = raceTunnelMirrored(race);
    const centerAt = (point) => {
        if (point.tick === 0)
            return race.entryAnchorY;
        if (point.tick === 359)
            return 320;
        return mirrored ? RACE_HEIGHT - point.center : point.center;
    };
    const f = smoothstep((at - a.tick) / Math.max(1, b.tick - a.tick));
    return { center: centerAt(a) + (centerAt(b) - centerAt(a)) * f, half: a.half + (b.half - a.half) * f };
}
export function raceTunnelCenter(race, tick) {
    return raceTunnelGeometry(race, tick).center;
}
export function raceTunnelRings(race) {
    return RACE_TUNNEL_RING_TICKS.map((tick, index) => ({
        id: `w${race.wormholes + 1}-g${String(index + 1).padStart(2, "0")}`,
        tick,
        y: raceTunnelGeometry(race, tick).center,
    }));
}
export function raceTunnelQuality(race, cycle = race.wormholes) {
    const ledger = race.tunnelRingLedger[cycle] ?? [];
    let passed = 0;
    let perfect = 0;
    let missed = 0;
    let pending = 0;
    for (let i = 0; i < RACE_TUNNEL_RING_TICKS.length; i++) {
        const outcome = ledger[i] ?? "pending";
        if (outcome === "passed")
            passed += 1;
        else if (outcome === "perfect")
            perfect += 1;
        else if (outcome === "missed")
            missed += 1;
        else
            pending += 1;
    }
    const units = passed + perfect * 2;
    return {
        passed,
        perfect,
        missed,
        pending,
        units,
        exitSpeed: clamp(RACE_RETURN_SPEED + units * RACE_TUNNEL_QUALITY_SPEED_GAIN, RACE_RETURN_SPEED, RACE_MAX_SPEED),
    };
}
function stepTunnel(race) {
    const priorY = race.y;
    if (race.tunnelDragY !== null) {
        race.y = raceTunnelFollowerY(race.y, race.tunnelDragY);
    }
    race.vy = (race.y - priorY) / RACE_DT;
    const geometry = raceTunnelGeometry(race, race.phaseTick);
    const top = geometry.center - geometry.half + RACE_PILOT_RADIUS;
    const bottom = geometry.center + geometry.half - RACE_PILOT_RADIUS;
    if (race.y < top || race.y > bottom) {
        const newContact = race.wallSuppressTicks <= 0;
        race.y = clamp(race.y, top, bottom);
        race.vy = 0;
        if (newContact)
            race.wallScrapeTicks.push(race.tick);
        race.wallSuppressTicks = 15;
    }
    else if (race.wallSuppressTicks > 0)
        race.wallSuppressTicks -= 1;
    const cycle = race.wormholes;
    const rings = raceTunnelRings(race);
    const ledger = race.tunnelRingLedger[cycle]
        ?? (race.tunnelRingLedger[cycle] = rings.map(() => "pending"));
    const decisionTicks = race.tunnelRingDecisionTicks[cycle]
        ?? (race.tunnelRingDecisionTicks[cycle] = rings.map(() => null));
    let sound = null;
    const cues = [];
    for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        if (ledger[i] === "pending" && ring.tick === race.phaseTick) {
            const error = Math.abs(race.y - ring.y);
            const outcome = error <= RACE_TUNNEL_PERFECT_CLEARANCE
                ? "perfect"
                : error <= RACE_TUNNEL_RING_CLEARANCE
                    ? "passed"
                    : "missed";
            ledger[i] = outcome;
            decisionTicks[i] = race.tick;
            cues.push({
                kind: outcome === "perfect"
                    ? "tunnel-ring-perfect"
                    : outcome === "passed"
                        ? "tunnel-ring-pass"
                        : "tunnel-ring-miss",
                tick: race.tick,
                id: ring.id,
                index: i,
                y: ring.y,
                chargeDelta: 0,
            });
            if (outcome !== "missed")
                sound = "ring";
        }
    }
    race.coursePosition = race.phaseStartPosition
        + RACE_TUNNEL_DISTANCE * ((race.phaseTick + 1) / RACE_TUNNEL_TICKS);
    race.speed = RACE_TUNNEL_SPEED;
    return { sound, cues };
}
export function stepRace(race) {
    if (race.phase === "finish")
        return { sound: null, cues: [], finished: false };
    consumeInputs(race);
    race.previousCoursePosition = race.coursePosition;
    race.previousY = race.y;
    if (race.collisionGraceTicks > 0)
        race.collisionGraceTicks -= 1;
    let sound = null;
    const cues = [];
    if (race.phase === "normal") {
        stepPilot(race);
        if (race.speedGraceTicks > 0)
            race.speedGraceTicks -= 1;
        else
            race.speed = Math.max(RACE_BASE_SPEED, race.speed - RACE_SPEED_DECAY_PER_SECOND * RACE_DT);
        race.coursePosition = Math.min(RACE_LENGTH, race.coursePosition + race.speed * RACE_DT);
        const crossing = crossNormalObjects(race);
        sound = crossing.sound;
        cues.push(...crossing.cues);
        // A charged ring is an entry candidate until every charge delta from this
        // authority step has resolved. Same-step debris makes the gate non-clean:
        // keep both cues, retain the net meter value, and remain in normal flight.
        if (crossing.entryRingIndex != null && race.charge >= 100) {
            beginEntry(race, crossing.entryRingIndex);
            const ring = RACE_RINGS[crossing.entryRingIndex];
            cues.push({
                kind: "entry",
                tick: race.tick,
                id: ring.id,
                index: crossing.entryRingIndex,
                y: ring.y,
                chargeDelta: 0,
            });
            sound = "entry";
        }
    }
    else if (race.phase === "entry") {
        const f = smoothstep((race.phaseTick - 24) / 11);
        race.y = race.phaseTick < 24 ? race.entryStartY : race.entryStartY + (race.entryAnchorY - race.entryStartY) * f;
        if (race.phaseTick >= 35)
            race.y = race.entryAnchorY;
        race.vy = 0;
        race.phaseTick += 1;
        if (race.phaseTick >= RACE_ENTRY_TICKS) {
            race.phase = "tunnel";
            race.phaseTick = 0;
            race.phaseStartPosition = race.coursePosition;
            race.y = race.entryAnchorY;
            race.charge = 0;
            race.held = false;
            race.boost = false;
            race.tunnelDragY = null;
            race.tunnelRingLedger[race.wormholes] = RACE_TUNNEL_RING_TICKS.map(() => "pending");
            race.tunnelRingDecisionTicks[race.wormholes] = RACE_TUNNEL_RING_TICKS.map(() => null);
        }
    }
    else if (race.phase === "tunnel") {
        const tunnel = stepTunnel(race);
        sound = tunnel.sound;
        cues.push(...tunnel.cues);
        race.phaseTick += 1;
        if (race.phaseTick >= RACE_TUNNEL_TICKS) {
            const exit = race.phaseStartPosition + RACE_TUNNEL_DISTANCE;
            race.coursePosition = exit;
            skipTunnelSpan(race, race.phaseStartPosition, exit);
            race.phase = "return";
            race.phaseTick = 0;
            race.returnY = clamp(race.y, RACE_RETURN_MARGIN, RACE_HEIGHT - RACE_RETURN_MARGIN);
            race.y = race.returnY;
            race.vy = 0;
            race.held = false;
            race.boost = false;
            race.tunnelDragY = null;
        }
    }
    else if (race.phase === "return") {
        race.y = race.returnY;
        race.vy = 0;
        race.phaseTick += 1;
        if (race.phaseTick >= RACE_RETURN_TICKS) {
            race.phase = "normal";
            race.phaseTick = 0;
            const quality = raceTunnelQuality(race, race.wormholes);
            race.wormholes += 1;
            race.charge = 0;
            race.speed = quality.exitSpeed;
            race.speedGraceTicks = 0;
            race.held = false;
            race.boost = false;
            race.tunnelDragY = null;
            // Normal-flight authority decrements before collision checks. Arm one
            // extra count so all documented 21 post-return steps remain protected.
            race.collisionGraceTicks = RACE_RETURN_GRACE_TICKS + 1;
            cues.push({
                kind: "return",
                tick: race.tick,
                id: `w${race.wormholes}`,
                index: race.wormholes - 1,
                y: race.returnY,
                chargeDelta: 0,
            });
            sound = "return";
        }
    }
    race.tick += 1;
    if (race.phase === "normal" && race.coursePosition >= RACE_LENGTH) {
        race.phase = "finish";
        race.finishTicks = race.tick;
        if (!race.finishEmitted) {
            race.finishEmitted = true;
            cues.push({ kind: "finish", tick: race.tick - 1, id: RACE_EVENT_ID, index: -1, y: race.y, chargeDelta: 0 });
            return { sound: "finish", cues, finished: true };
        }
    }
    return { sound, cues, finished: false };
}
export function raceGrade(finishTicks) {
    if (finishTicks == null)
        return 0;
    if (finishTicks <= RACE_THREE_STAR_TICKS)
        return 3;
    if (finishTicks <= RACE_TWO_STAR_TICKS)
        return 2;
    return 1;
}
export function formatRaceTicks(ticks) {
    if (ticks == null)
        return "—:——.———";
    const ms = Math.floor((ticks * 1000) / RACE_HZ);
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}
export function raceSignature(race) {
    return {
        finishTicks: race.finishTicks,
        acorns: race.acorns,
        ringLedger: race.ringLedger.join(","),
        ringDecisionTicks: race.ringDecisionTicks.map((tick) => tick ?? -1),
        tunnelRingLedger: race.tunnelRingLedger.map((ledger) => ledger.join(",")),
        tunnelRingDecisionTicks: race.tunnelRingDecisionTicks
            .map((ledger) => ledger.map((tick) => tick ?? -1)),
        tunnelQuality: race.tunnelRingLedger.map((_, cycle) => raceTunnelQuality(race, cycle)),
        debrisContacts: [...race.debrisContacts],
        entryTicks: [...race.entryTicks],
        boostTicks: [...race.boostTicks],
        dropTicks: [...race.dropTicks],
        wallScrapeTicks: [...race.wallScrapeTicks],
    };
}
