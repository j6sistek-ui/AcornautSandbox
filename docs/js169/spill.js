// THE SPILL — wave survival authority.
//
// An acorn mining rig let go one system over. What reached us is a front of
// rock, cargo and shrapnel travelling one way: at you. No gates, no planets.
// Survive the wave; the next one is harder.
//
// This module is the RULES of the mode and nothing else — no canvas, no DOM,
// no art, no save. It is fed a dt and a handful of semantic inputs (hold,
// release, a burst, a lunge, a Depot purchase) and it answers with state and
// a list of cues for the frame. The sim mirrors its ship into the world so
// the shared draw path can paint it; draw.ts paints the field; standalone.ts
// builds the Depot sheet. That split is the same one Hyper Run made
// (race.ts), and for the same reason: everything in here can be driven from
// a node test with no browser at all.
//
// SECOND PASS (owner's flight notes, 2026-09-02). The first promotion kept
// the lab's squirrel and tap; this one flies the scout ship with the Hyper
// Run hand - hold to rise, release to fall, a swipe up or down for a burst -
// tuned to normal flight's response rather than the race's. FLIP is gone:
// gravity that inverts in a frame was the one rule that read as unfair. Its
// rung is DRIFT, a continuous tilt of the whole field, and every rule now
// phases in over three seconds with its name pinned beside the controls.
// A wave hands control back on a counted-down GO rather than whenever the
// card finished; the Depot docks for a second and holds its shelves inert
// for a moment, so a thumb still tapping cannot buy by accident. And the
// shelves are not rolled any more: the ship has four meters - PLATING,
// SHIELD, THRUSTERS, POWER-UPS - and a purchase fills one. PULSE is no
// longer a button the thumb has to find: unlocking it makes it fire on its
// own at the next impact, and Gold Ore is what charges it.
import { DEBRIS_COUNT, PHYS } from "./catalog.js?v=169";
// ---------------------------------------------------------------- tuning
export const SPILL = {
    /** the ship may roam this share of the width. The right edge stops at
     *  half: further forward and you can park in front of the field where
     *  pieces have not spread apart yet, which was safer, not more dangerous */
    bandLeft: 0.08,
    bandRight: 0.5,
    /** where the ship sits when left alone, and how fast a lunge decays back
     *  to it. Slow enough to read as a drift rather than a spring */
    homeX: 0.22,
    driftHome: 0.55,
    /** the dash: about a third of the band end to end, slide included */
    lungeSpeed: 320,
    lungeTime: 0.15,
    lungeCooldown: 0.55,
    /** the hand. The field has its own gravity, gentler than flight's 1300,
     *  and holding beats it by a fixed net acceleration: a quarter second of
     *  hold is a nudge of a few pixels, a full second a climb. The first
     *  hand (2200 net, 1300 down) reached its cap in a fifth of a second and
     *  the owner could not hold a line with it. Both directions are capped.
     *  A burst is an instant velocity past the caps, the way a tap and a
     *  dive are in every other mode; the caps only stop the hand from
     *  building past them, never a burst from carrying */
    gravity: 600,
    holdAccel: 720,
    riseCap: 330,
    fallCap: 390,
    burstUp: 480,
    burstDown: 480,
    /** how fast a burst's speed past the cap bleeds back to the cap */
    burstDecay: 600,
    /** how long the floor may be ridden before it kills. A bounce is one or
     *  two frames; camping is continuous. The hull glows from 0.1s */
    floorGrace: 0.25,
    floorWarn: 0.1,
    shipR: PHYS.squirrelR,
    grazeR: 46,
    pulseR: 240,
    pulseWideR: 320,
    /** a second pulse, five seconds after the first, once POWER-UPS II is in */
    doublePulseDelay: 5,
    /** the hull: three hits, then the run is over. A hit buys 1.2s of
     *  invulnerability so one piece can never take two pips */
    hull: 3,
    iframes: 1.2,
    knockTime: 0.14,
    knockSpeed: -220,
    /** seconds of Gold the Respawn Core hands over on re-entry */
    goldSeconds: 3,
    /** the Depot clock: two long visits to learn the shelf, then half.
     *  Docking takes a second first, and the shelves stay inert for a
     *  moment after they appear - both against a thumb that is still tapping */
    depotTime: [30, 30, 15],
    dockTime: 1.2,
    depotArm: 0.8,
    extendBase: 25,
    extendSeconds: 15,
    /** the counted-down intermission: autopilot, then GO. Control comes back
     *  on the GO and never before, so it can be predicted */
    countdown: 3,
    /** a wave's field must drain before the count; a slow hulk can hold that
     *  open, so it is capped rather than waited on forever */
    drainCap: 6,
    respawnFreeze: 2,
    /** every rule phases in over this long, so nothing snaps on the first frame */
    modRamp: 3,
    /** the free hint every first-time rule gets, in seconds. The control
     *  hint also leaves after this many inputs: a hand that has adjusted
     *  three times has read it */
    hintTime: 5,
    hintInputs: 3,
    /** how far the field may tilt under DRIFT, radians, and how fast it
     *  wanders. The authored DRIFT wave is the lesson and leans only this
     *  share of the way; the endless waves lean fully. The rule the flip
     *  taught: a first meeting must be survivable before it is understood */
    driftMax: 0.38,
    driftRate: 0.22,
    driftTeach: 0.6,
};
/** every rule, in the order the ladder teaches them */
export const SPILL_MODS = ["surge", "lowg", "heavy", "cross", "blackout", "swarm", "drift"];
/** the gravity rules cannot stack: a wave carries at most one of them */
const GRAVITY_MODS = ["lowg", "heavy"];
export const SPILL_MOD_INFO = {
    none: { name: "", short: "", teach: "" },
    surge: {
        name: "SURGE", short: "surge",
        teach: "SURGE: the field doubles for six seconds. Hold a lane, don't chase.",
    },
    lowg: {
        name: "LOW-G", short: "low gravity",
        teach: "LOW-G: gravity is lighter. Ease off the hold. Burst down to drop.",
    },
    heavy: {
        name: "HEAVY", short: "heavy gravity",
        teach: "HEAVY: gravity is stronger. Hold longer. Burst up to recover.",
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
        teach: "SWARM: more spinners, wider arcs. Watch the weave, not the piece.",
    },
    drift: {
        name: "DRIFT", short: "drift",
        teach: "DRIFT: the whole field tilts and wanders. The debris comes at the angle you see.",
    },
};
export const SPILL_CONTROL_HINT = "HOLD to rise · RELEASE to fall · SWIPE UP or DOWN to burst · SWIPE RIGHT to lunge";
/** Twenty authored waves. Every rule is taught alone the first time it
 *  appears; after wave 20 the game rolls them. Speed and crowding climb on
 *  separate curves so the field gets faster before it gets fuller.
 *  Spinners fly from wave 1: the weave is what makes the field read as a
 *  field rather than a hail of lines. */
const LADDER = [
    //  dur cap speed  mod        hulks
    [20, 4, 1.05, "none", 0],
    [22, 5, 1.09, "none", 0],
    [24, 5, 1.14, "surge", 0],
    [26, 6, 1.18, "none", 1],
    [28, 6, 1.23, "none", 1],
    [30, 7, 1.27, "lowg", 1],
    [32, 7, 1.32, "none", 1],
    [34, 8, 1.36, "heavy", 1],
    [36, 8, 1.41, "surge", 1],
    [38, 9, 1.45, "none", 2],
    [40, 9, 1.50, "cross", 2],
    [40, 10, 1.54, "lowg", 2],
    [40, 10, 1.59, "blackout", 2],
    [40, 11, 1.63, "heavy", 2],
    [40, 11, 1.68, "surge", 2],
    [40, 12, 1.72, "swarm", 2],
    [40, 12, 1.77, "cross", 2],
    [40, 13, 1.81, "drift", 2],
    [40, 13, 1.86, "blackout", 2],
    [40, 14, 1.90, "swarm", 2],
];
export const SPILL_AUTHORED_WAVES = LADDER.length;
export const SPILL_DEPOT_EVERY = 5;
function hash(seed, n) {
    let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
}
function intervalFor(n) {
    const ramp = Math.min(1, (n - 1) / (SPILL_AUTHORED_WAVES - 1));
    const beyond = Math.max(0, n - SPILL_AUTHORED_WAVES);
    return Math.max(0.22, 0.78 - 0.42 * ramp - 0.01 * beyond);
}
/** what wave n asks of the pilot. Authored through 20; rolled from the seed
 *  after that, so one run's wave 27 is repeatable and another run's is not */
export function spillWaveSpec(n, seed = 0) {
    if (n >= 1 && n <= SPILL_AUTHORED_WAVES) {
        const [dur, cap, speed, mod, hulks] = LADDER[n - 1];
        return { n, dur, cap, speed, mods: mod === "none" ? [] : [mod], hulks, interval: intervalFor(n) };
    }
    const beyond = Math.max(1, n - SPILL_AUTHORED_WAVES);
    const roll = hash(seed, n);
    const first = SPILL_MODS[roll % SPILL_MODS.length];
    const mods = [first];
    if (n >= SPILL_AUTHORED_WAVES + 6) {
        // a second rule from wave 26, never a second gravity rule
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
        interval: intervalFor(n),
    };
}
export const SPILL_LEVELS = 3;
export const SPILL_SHOP = {
    plating: {
        name: "Plating",
        prices: [60, 110, 180],
        levels: ["Four hull pips", "Five hull pips", "Six hull pips"],
    },
    thrusters: {
        name: "Thrusters",
        prices: [50, 100, 170],
        levels: ["Sharper bursts", "Two lunge charges", "Afterburner: a lunge shatters shards"],
    },
    pulse: {
        name: "Power-ups",
        prices: [60, 110, 170],
        levels: ["PULSE unlocked: fires on impact when charged", "Double wave: a second pulse 5s later", "Wide pulse, and shattered debris drops Ore"],
    },
    shield: {
        name: "Shield",
        prices: [35],
        levels: ["A shield charge. Two carried. Eats one hit."],
    },
    repair: {
        name: "Repair",
        prices: [30],
        levels: ["Every pip back."],
    },
    core: {
        name: "Respawn Core",
        prices: [150],
        levels: ["One extra life: re-enter whole and golden."],
    },
};
/** how hard a burst kicks at each THRUSTERS level. The hold is never
 *  scaled: the owner asked for a hand that gets steadier, not twitchier */
const THRUST_MUL = [1, 1.15, 1.3, 1.45];
function rand(s) {
    // mulberry32: the same stream for the same seed, which is what lets a
    // test replay a wave and what makes an endless run's rolls repeatable
    s.rng = (s.rng + 0x6d2b79f5) >>> 0;
    let x = s.rng;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
export function createSpill(W, H, seed, target = 0) {
    return {
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
        held: false,
        pressed: false,
        manual: false,
        hintInputs: 0,
        burstT: 0,
        lunge: 0,
        lungeCharges: 1,
        cool: 0,
        knock: 0,
        floorT: 0,
        hull: SPILL.hull,
        maxHull: SPILL.hull,
        iframes: 0,
        hitFlash: 0,
        shield: 0,
        shieldFlash: 0,
        gold: 0,
        rocks: [],
        nuts: [],
        bursts: [],
        charge: 0,
        chargeReady: false,
        pulseFlash: 0,
        pulseQueue: 0,
        combo: 0,
        comboT: 0,
        ore: 0,
        oreMined: 0,
        score: 0,
        grazes: 0,
        hits: 0,
        shattered: 0,
        nextRock: 0.6,
        nextNut: 2.5,
        nextSpecial: 9,
        surgeT: 0,
        surgeFired: false,
        up: { plating: 0, thrusters: 0, pulse: 0 },
        coreArmed: false,
        coreBought: false,
        liveMods: [],
        modRamp: 0,
        tilt: 0,
        tiltTarget: 0,
        tiltT: 0,
        depot: null,
        depotVisits: 0,
        respawnReturn: "wave",
        respawnPhaseT: 0,
        banner: "",
        bannerT: 0,
        hint: "",
        hintT: 0,
        taught: [],
        shake: 0,
        deadFor: 0,
        cause: "",
        cues: [],
    };
}
/** the field keeps its shape through a rotation: everything scales with
 *  the canvas rather than being left in the old coordinates */
export function resizeSpill(s, W, H) {
    if (!(W > 0 && H > 0) || (W === s.W && H === s.H))
        return;
    const sx = W / s.W;
    const sy = H / s.H;
    for (const r of s.rocks) {
        r.x *= sx;
        r.y *= sy;
    }
    for (const n of s.nuts) {
        n.x *= sx;
        n.y *= sy;
    }
    s.pilot.x *= sx;
    s.pilot.y = Math.max(22, Math.min(H - 22, s.pilot.y * sy));
    s.W = W;
    s.H = H;
}
// ---------------------------------------------------------------- rules
export const spillMod = (s, m) => s.liveMods.includes(m);
/** debris crosses the screen in the same time whatever the width, so a
 *  desktop panorama is more room to read, not more seconds to react */
function lane(s) {
    return Math.max(1, Math.min(2.6, s.W / 390));
}
/** a rule's strength: 0 on the wave's first frame, 1 three seconds in */
function ramp(s) {
    return Math.min(1, s.modRamp / SPILL.modRamp);
}
function gravityOf(s) {
    const g = spillMod(s, "lowg") ? 0.7 : spillMod(s, "heavy") ? 1.35 : 1;
    return SPILL.gravity * (1 + (g - 1) * ramp(s));
}
function thrustMul(s) {
    return THRUST_MUL[Math.min(THRUST_MUL.length - 1, s.up.thrusters)];
}
function maxLunges(s) {
    return s.up.thrusters >= 2 ? 2 : 1;
}
function pulseRadius(s) {
    return s.up.pulse >= 3 ? SPILL.pulseWideR : SPILL.pulseR;
}
function say(s, text, t) {
    s.banner = text;
    s.bannerT = t;
}
function cue(s, c) {
    s.cues.push(c);
}
function burst(s, x, y, n, tone, power = 1) {
    s.bursts.push({ x, y, n, power, tone });
}
function surging(s) {
    return s.surgeT > 0;
}
// ------------------------------------------------------------- spawning
/** four of the twenty-seven debris paintings are near-black against deep
 *  space — not dark objects, invisible ones. They stay out of the pool */
const UNREADABLE = new Set([8, 12, 14, 22]);
function readableSprite(s) {
    for (let i = 0; i < 24; i++) {
        const n = Math.floor(rand(s) * DEBRIS_COUNT);
        if (!UNREADABLE.has(n))
            return n;
    }
    return 0;
}
/** the rate a spinner weaves at, radians per second */
const ARC_RATE = 1.6;
/**
 * Where a piece will be t seconds from now. This is the same motion the
 * step integrates - a hulk waits out its warning before it moves, and a
 * spinner's weave is the integral of the cosine the step applies - so the
 * spawn check predicts exactly what the field will do.
 */
export function spillRockAt(s, r, t) {
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
 */
export function spillPathClear(s, cand) {
    for (const r of s.rocks) {
        if (r.dead)
            continue;
        for (let k = 0; k <= 18; k++) {
            const t = (k / 18) * 4.5;
            const a = spillRockAt(s, cand, t);
            const b = spillRockAt(s, r, t);
            if (a.x < -200 && b.x < -200)
                break;
            const gap = (cand.r + r.r) * 1.35;
            if ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < gap * gap)
                return false;
        }
    }
    return true;
}
function spawnRock(s) {
    const spec = s.spec;
    const hulks = s.rocks.filter((r) => r.kind === "hulk" && !r.dead).length;
    const mayHulk = hulks < spec.hulks && s.waveT > 4;
    const swarm = spillMod(s, "swarm");
    const roll = rand(s);
    const kind = swarm ? (roll < 0.8 ? "spinner" : "tumbler")
        : mayHulk && roll > 0.94 ? "hulk"
            : roll < 0.4 ? "shard"
                : roll < 0.7 ? "tumbler"
                    : "spinner";
    const speed = (kind === "hulk" ? 145 : kind === "shard" ? 290 : 205) * spec.speed * (surging(s) ? 1.12 : 1) * lane(s);
    const r = kind === "hulk" ? 36 + rand(s) * 14 : kind === "shard" ? 11 + rand(s) * 6 : 18 + rand(s) * 10;
    // an angle, but bounded: a piece must still cross the screen rather than
    // clip a corner, or it reads as unfair rather than as chaotic. Under
    // DRIFT the field's tilt is the angle the debris arrives at
    const ang = (rand(s) - 0.5) * (kind === "shard" ? 0.5 : 0.34) + (spillMod(s, "drift") ? s.tilt : 0);
    const y = 40 + rand(s) * (s.H - 80);
    const cand = {
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
    if (!spillPathClear(s, cand))
        return false;
    s.rocks.push(cand);
    if (kind === "hulk")
        cue(s, "warn");
    return true;
}
/** Ore spills in arcs, so collecting a stream is a line you fly, not a dot */
function spawnStream(s) {
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
 * The things that drift past alone rather than in a stream. Gold Ore is
 * what charges the PULSE - half a meter each - and pays five. A hull
 * fragment only shows up when there is a pip to restore. Shields are not
 * found in the field any more: the Depot sells them, cheaply, every stop.
 */
function spawnSpecial(s) {
    const kind = s.hull < s.maxHull && rand(s) < 0.34 ? "hull" : "gold";
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
function flying(s) {
    return s.phase === "wave" || s.phase === "drain";
}
/** the hand has the ship: in flight, or through a count it took over */
function handOn(s) {
    return flying(s) || (s.phase === "countdown" && s.manual);
}
/** the control hint leaves once the hand has plainly read it */
function noteInput(s) {
    if (s.hint !== SPILL_CONTROL_HINT || s.hintT <= 1)
        return;
    s.hintInputs += 1;
    if (s.hintInputs >= SPILL.hintInputs)
        s.hintT = 1;
}
/** the hand goes on or off the thrust. A press on the ready card launches;
 *  a press during the count takes the stick from the autopilot early, so
 *  the ship is never dropped on the GO into a hand that was waiting.
 *  Returns whether the press did anything, so the sim can sound it */
export function spillHold(s, held) {
    if (held && s.phase === "ready") {
        s.pressed = true;
        beginCountdown(s, 1);
        return true;
    }
    const wasPressed = s.pressed;
    s.pressed = held;
    if (held && !wasPressed && s.phase === "countdown" && !s.manual) {
        s.manual = true;
        s.pilot.vy = 0;
    }
    const was = s.held;
    s.held = held && handOn(s);
    if (s.held && !was) {
        noteInput(s);
        burst(s, s.pilot.x - 16, s.pilot.y + 4, 3, "thrust", 0.4);
        cue(s, "press");
        return true;
    }
    return false;
}
/** a swipe: up is a kick skyward, down is the dive. Instant, like a tap */
export function spillBurst(s, dir) {
    if (!handOn(s))
        return false;
    noteInput(s);
    const mul = thrustMul(s);
    if (dir < 0)
        s.pilot.vy = Math.min(s.pilot.vy, -SPILL.burstUp * mul);
    else
        s.pilot.vy = Math.max(s.pilot.vy, SPILL.burstDown * mul);
    s.burstT = 0.22;
    burst(s, s.pilot.x - 14, s.pilot.y - dir * 10, 8, "thrust", 0.6);
    cue(s, "burst");
    return true;
}
/**
 * The mode's own control. A short forward dash on a cooldown: the only move
 * that spends horizontal room, which is what makes an angled field playable.
 * Forward only — a backward lunge was a free retreat into a corner.
 */
export function spillLunge(s) {
    if (s.phase === "ready")
        return spillHold(s, true);
    if (!handOn(s) || s.lungeCharges <= 0)
        return false;
    noteInput(s);
    s.lunge = SPILL.lungeTime;
    s.lungeCharges -= 1;
    if (s.cool <= 0)
        s.cool = SPILL.lungeCooldown;
    burst(s, s.pilot.x - 14, s.pilot.y, 8, "lunge", 0.5);
    cue(s, "lunge");
    return true;
}
function shatter(s, r, power = 1.2) {
    if (r.dead)
        return;
    r.dead = true;
    s.shattered += 1;
    s.score += 4;
    burst(s, r.x, r.y, 16, "shatter", power);
    if (s.up.pulse >= 3) {
        s.nuts.push({ x: r.x, y: r.y, vx: -60 * lane(s), vy: 0, got: false, bob: rand(s) * 6, kind: "ore" });
    }
}
/** everything close enough is shattered. Fired by the ship on impact once
 *  POWER-UPS I is in; by the queue five seconds later with II */
function firePulse(s) {
    s.pulseFlash = 0.45;
    s.shake = 0.5;
    const reach = pulseRadius(s);
    let hit = 0;
    for (const r of s.rocks) {
        if (r.dead || r.warn > 0)
            continue;
        const dx = r.x - s.pilot.x;
        const dy = r.y - s.pilot.y;
        if (dx * dx + dy * dy < reach * reach) {
            shatter(s, r);
            hit++;
        }
    }
    say(s, hit ? `PULSE ×${hit}` : "PULSE", 1.1);
    cue(s, "pulse");
    return hit;
}
/** spend a full meter now. The ship does this on its own at an impact;
 *  this is the hand-fired form, kept for tests and a keyboard */
export function spillPulse(s) {
    if (!flying(s) || s.up.pulse < 1 || s.charge < 1)
        return false;
    s.charge = 0;
    firePulse(s);
    if (s.up.pulse >= 2)
        s.pulseQueue = SPILL.doublePulseDelay;
    return true;
}
// ---------------------------------------------------------------- waves
function beginWave(s) {
    s.phase = "wave";
    s.phaseT = 0;
    // a finger already down is a hand already on the thrust: the GO hands
    // over a ship that is rising, never one that drops into a waiting thumb
    s.manual = false;
    s.held = s.pressed;
    s.waveT = 0;
    s.modRamp = 0;
    s.surgeT = 0;
    s.surgeFired = false;
    s.nextRock = 0.9;
    s.nextNut = 2.5;
    s.nextSpecial = 8 + rand(s) * 6;
    cue(s, "go");
}
/** the intermission: the ship flies itself home while the next wave is
 *  named and counted down. Control comes back on the GO */
function beginCountdown(s, n) {
    s.wave = n;
    s.spec = spillWaveSpec(n, s.seed);
    s.liveMods = s.spec.mods.slice();
    s.modRamp = 0;
    s.phase = "countdown";
    s.phaseT = 0;
    s.held = false;
    s.manual = false;
    s.lunge = 0;
    s.knock = 0;
    s.pilot.vx = 0;
    s.rocks = [];
    s.tiltTarget = 0;
    if (!spillMod(s, "drift"))
        s.tilt = 0;
    // the first time a rule appears it is taught, in the wave, for free.
    // After that it is just part of the escalation
    const fresh = s.liveMods.find((m) => !s.taught.includes(m));
    if (fresh) {
        s.taught.push(fresh);
        s.hint = SPILL_MOD_INFO[fresh].teach;
        s.hintT = SPILL.countdown + SPILL.hintTime;
    }
    else if (n === 1) {
        s.hint = SPILL_CONTROL_HINT;
        s.hintT = SPILL.countdown + SPILL.hintTime;
    }
    cue(s, "wave");
}
/** every fifth wave docks at the Depot; the rest count straight on */
function afterClear(s) {
    if (s.wave % SPILL_DEPOT_EVERY === 0)
        beginDocking(s);
    else
        beginCountdown(s, s.wave + 1);
}
function endWave(s) {
    // the wave is cleared the moment the field has drained. A mission ends
    // on a win here, not on the crash that was coming eventually
    s.cleared = s.wave;
    s.score += 50 * s.wave;
    s.held = false;
    cue(s, "clear");
    if (s.wave % SPILL_DEPOT_EVERY === 0)
        cue(s, "milestone");
    if (s.target && s.wave >= s.target) {
        s.phase = "over";
        s.phaseT = 0;
        s.deadFor = 0;
        s.cause = "MISSION COMPLETE";
        cue(s, "mission");
        return;
    }
    afterClear(s);
}
// ---------------------------------------------------------------- depot
function depotTime(s) {
    const t = SPILL.depotTime;
    return t[Math.min(t.length - 1, s.depotVisits)];
}
function beginDocking(s) {
    s.phase = "docking";
    s.phaseT = 0;
    s.held = false;
    s.lunge = 0;
    s.knock = 0;
    s.pilot.vx = 0;
    s.rocks = [];
    s.nuts = [];
    say(s, "DOCKING", SPILL.dockTime);
    cue(s, "dock");
}
function openDepot(s) {
    s.phase = "depot";
    s.phaseT = 0;
    s.pilot.vy = 0;
    // docking restores one pip; the rest is the Depot's business
    s.hull = Math.min(s.maxHull, s.hull + 1);
    s.depot = { timer: depotTime(s), arm: SPILL.depotArm, extends: 0, bought: [] };
    s.depotVisits += 1;
    cue(s, "depot");
}
function closeDepot(s) {
    s.depot = null;
    cue(s, "depot-close");
    beginCountdown(s, s.wave + 1);
}
export function spillExtendPrice(s) {
    return s.depot ? SPILL.extendBase * Math.pow(2, s.depot.extends) : 0;
}
/** the next level's price for a meter, or null when it is full */
export function spillPrice(s, what) {
    const shop = SPILL_SHOP[what];
    if (what === "plating" || what === "thrusters" || what === "pulse") {
        return s.up[what] >= SPILL_LEVELS ? null : shop.prices[s.up[what]];
    }
    if (what === "shield")
        return s.shield >= 2 ? null : shop.prices[0];
    if (what === "repair")
        return s.hull >= s.maxHull ? null : shop.prices[0];
    return s.coreBought ? null : shop.prices[0];
}
/** fill one meter, or buy one of the flat items */
export function spillBuy(s, what) {
    const d = s.depot;
    if (!d || s.phase !== "depot")
        return "closed";
    // the shelves are inert for a moment after they appear, against a thumb
    // that is still tapping from the wave
    if (d.arm > 0)
        return "arming";
    const price = spillPrice(s, what);
    if (price === null)
        return "maxed";
    if (s.ore < price) {
        cue(s, "deny");
        return "poor";
    }
    s.ore -= price;
    switch (what) {
        case "plating":
            s.up.plating += 1;
            s.maxHull = SPILL.hull + s.up.plating;
            s.hull += 1; // the new pip arrives filled
            break;
        case "thrusters":
            s.up.thrusters += 1;
            s.lungeCharges = maxLunges(s);
            break;
        case "pulse":
            s.up.pulse += 1;
            break;
        case "shield":
            s.shield = Math.min(2, s.shield + 1);
            s.shieldFlash = 0.6;
            break;
        case "repair":
            s.hull = s.maxHull;
            break;
        case "core":
            s.coreBought = true;
            s.coreArmed = true;
            break;
    }
    d.bought.push(what);
    cue(s, "buy");
    return "ok";
}
export function spillExtend(s) {
    const d = s.depot;
    if (!d || s.phase !== "depot")
        return "closed";
    if (d.arm > 0)
        return "arming";
    const price = spillExtendPrice(s);
    if (s.ore < price) {
        cue(s, "deny");
        return "poor";
    }
    s.ore -= price;
    d.extends += 1;
    d.timer += SPILL.extendSeconds;
    cue(s, "buy");
    return "ok";
}
export function spillLeaveDepot(s) {
    if (!s.depot || s.phase !== "depot")
        return false;
    if (s.depot.arm > 0)
        return false;
    closeDepot(s);
    return true;
}
// ----------------------------------------------------------------- hits
function takeHit(s, r) {
    // an unlocked, charged PULSE fires itself at the impact: the piece and
    // everything near it shatter and the hull is never touched
    if (s.up.pulse >= 1 && s.charge >= 1) {
        s.charge = 0;
        firePulse(s);
        shatter(s, r, 1.2);
        if (s.up.pulse >= 2)
            s.pulseQueue = SPILL.doublePulseDelay;
        return;
    }
    if (s.shield > 0) {
        // a shield eats the piece rather than the ship
        s.shield -= 1;
        s.shieldFlash = 0.5;
        s.shake = 0.6;
        shatter(s, r, 1.2);
        say(s, "SHIELD HELD", 1.1);
        cue(s, "shield");
        return;
    }
    s.hull -= 1;
    s.hits += 1;
    s.iframes = SPILL.iframes;
    s.hitFlash = 0.5;
    s.shake = 0.7;
    s.knock = SPILL.knockTime;
    s.pilot.vy = -180;
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
function lose(s, cause) {
    if (s.coreArmed) {
        // the extra life: the field freezes, and the ship comes back whole and
        // golden, to the phase it left
        s.coreArmed = false;
        s.respawnReturn = s.phase;
        s.respawnPhaseT = s.phaseT;
        s.phase = "respawn";
        s.phaseT = 0;
        s.held = false;
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
    s.held = false;
    s.cause = cause;
    s.shake = 1;
    burst(s, s.pilot.x, s.pilot.y, 34, "hit", 1.5);
    cue(s, "dead");
}
// ----------------------------------------------------------------- step
/** THE HAND. Held, the thrust beats gravity by a fixed net acceleration;
 *  released, gravity has the ship. Both are capped, but a burst that
 *  started past a cap keeps its momentum and only decays: the cap stops
 *  the hand from building speed, never a swipe from carrying. THRUSTERS
 *  never touch the hold - a steadier hand is not a faster one */
function handVertical(s, dt) {
    const g = gravityOf(s);
    const prev = s.pilot.vy;
    if (s.held)
        s.pilot.vy -= (g + SPILL.holdAccel) * dt;
    s.pilot.vy += g * dt;
    if (s.pilot.vy < -SPILL.riseCap)
        s.pilot.vy = Math.max(s.pilot.vy, Math.min(-SPILL.riseCap, prev + SPILL.burstDecay * dt));
    if (s.pilot.vy > SPILL.fallCap)
        s.pilot.vy = Math.min(s.pilot.vy, Math.max(SPILL.fallCap, prev - SPILL.burstDecay * dt));
    s.pilot.y += s.pilot.vy * dt;
    s.pilot.rot = Math.max(-0.5, Math.min(0.9, s.pilot.vy / 700)) + s.pilot.vx / 2600;
}
/** the ship flies itself: home lane, mid height, level. Used through the
 *  countdown and the dock so the hand can rest and know when it is needed */
function autopilot(s, dt) {
    const home = s.W * SPILL.homeX;
    s.pilot.vy = 0;
    s.pilot.vx = 0;
    s.pilot.x += (home - s.pilot.x) * Math.min(1, dt * 3);
    s.pilot.y += (s.H * 0.45 - s.pilot.y) * Math.min(1, dt * 3);
    s.pilot.rot *= Math.max(0, 1 - dt * 5);
}
/**
 * One frame. Returns every cue raised since the last frame - by this step
 * and by any input that landed between steps - oldest first, and clears
 * them. The sim turns them into sound and the engine into a re-render.
 */
export function stepSpill(s, dt) {
    stepSpillBody(s, dt);
    const out = s.cues;
    s.cues = [];
    // the HUD lights ARMED on a cue, so the meter filling has to be one
    if (s.charge >= 1 && !s.chargeReady) {
        s.chargeReady = true;
        out.push("charged");
    }
    else if (s.charge < 1 && s.chargeReady)
        s.chargeReady = false;
    return out;
}
function stepSpillBody(s, dt) {
    if (s.bannerT > 0)
        s.bannerT = Math.max(0, s.bannerT - dt);
    if (s.hintT > 0)
        s.hintT = Math.max(0, s.hintT - dt);
    if (s.pulseFlash > 0)
        s.pulseFlash = Math.max(0, s.pulseFlash - dt * 2);
    if (s.hitFlash > 0)
        s.hitFlash = Math.max(0, s.hitFlash - dt * 2);
    if (s.shieldFlash > 0)
        s.shieldFlash = Math.max(0, s.shieldFlash - dt * 2);
    if (s.shake > 0)
        s.shake = Math.max(0, s.shake - dt * 2.2);
    if (s.burstT > 0)
        s.burstT = Math.max(0, s.burstT - dt);
    if (s.phase === "ready")
        return;
    if (s.phase === "over") {
        s.deadFor += dt;
        for (const r of s.rocks) {
            r.x += r.vx * dt * 0.25;
            r.y += r.vy * dt * 0.25;
        }
        return;
    }
    if (s.phase === "countdown") {
        s.phaseT += dt;
        if (s.manual) {
            // the hand took the stick: it flies the empty field until the GO
            handVertical(s, dt);
            // the edges hold. The floor is not yet fatal, and cannot be parked
            // on either: the GO must not open with the ship in the killzone
            s.pilot.y = Math.max(22, Math.min(s.H - 80, s.pilot.y));
            const home = s.W * SPILL.homeX;
            s.pilot.x += (home - s.pilot.x) * Math.min(1, dt * 3);
        }
        else
            autopilot(s, dt);
        // the ore still drifts: a stream that was mid-screen is still there
        for (const n of s.nuts) {
            n.x += n.vx * dt;
            n.bob += dt * 4;
        }
        s.nuts = s.nuts.filter((n) => !n.got && n.x > -40);
        const before = Math.ceil(SPILL.countdown - (s.phaseT - dt));
        const now = Math.ceil(SPILL.countdown - s.phaseT);
        if (now !== before && now > 0)
            cue(s, "count");
        if (s.phaseT >= SPILL.countdown)
            beginWave(s);
        return;
    }
    if (s.phase === "docking") {
        s.phaseT += dt;
        autopilot(s, dt);
        if (s.phaseT >= SPILL.dockTime)
            openDepot(s);
        return;
    }
    if (s.phase === "depot") {
        const d = s.depot;
        s.phaseT += dt;
        autopilot(s, dt);
        if (d.arm > 0) {
            d.arm = Math.max(0, d.arm - dt);
            if (d.arm === 0)
                cue(s, "armed");
        }
        const was = Math.ceil(d.timer);
        d.timer = Math.max(0, d.timer - dt);
        if (Math.ceil(d.timer) !== was)
            cue(s, "tick");
        if (d.timer <= 0)
            closeDepot(s);
        return;
    }
    if (s.phase === "respawn") {
        s.phaseT += dt;
        if (s.phaseT >= SPILL.respawnFreeze) {
            // sweep the killzone: nothing may be waiting on the ship's lane
            for (const r of s.rocks) {
                const dx = r.x - s.pilot.x;
                const dy = r.y - s.pilot.y;
                if (dx * dx + dy * dy < 220 * 220)
                    shatter(s, r, 0.8);
            }
            s.hull = s.maxHull;
            s.gold = SPILL.goldSeconds;
            s.pilot.vy = 0;
            s.pilot.y = s.H * 0.45;
            s.phase = s.respawnReturn === "drain" ? "drain" : "wave";
            s.phaseT = 0;
            say(s, "BACK IN THE FIELD", 1.4);
        }
        return;
    }
    // ---- flying: the wave and its drain; only the spawner differs
    s.t += dt;
    s.phaseT += dt;
    s.modRamp = Math.min(SPILL.modRamp, s.modRamp + dt);
    const climb = Math.min(1, (s.wave - 1) / (SPILL_AUTHORED_WAVES - 1));
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
    }
    else if (s.phase === "drain") {
        const live = s.rocks.some((r) => !r.dead && r.x > -r.r);
        if (!live || s.phaseT >= SPILL.drainCap) {
            endWave(s);
            return;
        }
    }
    if (s.surgeT > 0)
        s.surgeT = Math.max(0, s.surgeT - dt);
    // DRIFT: the field's tilt wanders toward a target it re-rolls every few
    // seconds, eased so the change is a lean rather than a lurch, and scaled
    // by the ramp so the wave opens level
    if (spillMod(s, "drift")) {
        s.tiltT -= dt;
        if (s.tiltT <= 0) {
            s.tiltT = 4 + rand(s) * 3;
            s.tiltTarget = (rand(s) * 2 - 1) * SPILL.driftMax;
        }
        const lim = SPILL.driftMax * (s.wave <= SPILL_AUTHORED_WAVES ? SPILL.driftTeach : 1);
        const want = Math.max(-lim, Math.min(lim, s.tiltTarget)) * ramp(s);
        const step = SPILL.driftRate * dt;
        s.tilt += Math.max(-step, Math.min(step, want - s.tilt));
    }
    else if (s.tilt !== 0) {
        const step = SPILL.driftRate * dt;
        s.tilt += Math.max(-step, Math.min(step, -s.tilt));
    }
    // ---- the ship
    if (s.iframes > 0)
        s.iframes = Math.max(0, s.iframes - dt);
    if (s.gold > 0)
        s.gold = Math.max(0, s.gold - dt);
    if (s.pulseQueue > 0) {
        s.pulseQueue = Math.max(0, s.pulseQueue - dt);
        if (s.pulseQueue === 0)
            firePulse(s);
    }
    if (s.cool > 0) {
        s.cool = Math.max(0, s.cool - dt);
        if (s.cool === 0) {
            s.lungeCharges = maxLunges(s);
            cue(s, "recharge");
        }
    }
    else if (s.lungeCharges < maxLunges(s))
        s.lungeCharges = maxLunges(s);
    if (s.knock > 0) {
        s.knock = Math.max(0, s.knock - dt);
        s.pilot.vx = SPILL.knockSpeed;
    }
    else if (s.lunge > 0) {
        s.lunge = Math.max(0, s.lunge - dt);
        s.pilot.vx = SPILL.lungeSpeed;
        if (s.up.thrusters >= 3) {
            for (const r of s.rocks) {
                if (r.dead || r.warn > 0 || r.kind !== "shard")
                    continue;
                const dx = r.x - s.pilot.x;
                const dy = r.y - s.pilot.y;
                const reach = r.r + SPILL.shipR + 6;
                if (dx * dx + dy * dy < reach * reach)
                    shatter(s, r, 0.9);
            }
        }
    }
    else {
        // slides to a stop rather than stopping dead, so a dash has weight,
        // then drifts back to the home lane slowly
        s.pilot.vx *= 1 - Math.min(1, dt * 8.5);
        const home = s.W * SPILL.homeX;
        if (Math.abs(s.pilot.x - home) > 1)
            s.pilot.x += (home - s.pilot.x) * Math.min(1, dt * SPILL.driftHome);
    }
    // the crosswind is a steady push toward the wall; the lunge is the counter
    if (spillMod(s, "cross") && s.knock <= 0 && s.lunge <= 0)
        s.pilot.x -= 40 * lane(s) * ramp(s) * dt;
    handVertical(s, dt);
    s.pilot.x += s.pilot.vx * dt;
    const lo = s.W * SPILL.bandLeft;
    const hi = s.W * SPILL.bandRight;
    if (s.pilot.x < lo) {
        s.pilot.x = lo;
        s.pilot.vx = Math.max(0, s.pilot.vx);
    }
    if (s.pilot.x > hi) {
        s.pilot.x = hi;
        s.pilot.vx = 0;
    }
    s.pilot.rot = Math.max(-0.5, Math.min(0.9, s.pilot.vy / 700)) + s.pilot.vx / 2600;
    // The floor is not a wall: brushing it is free, riding it kills
    const top = 22;
    const bottom = s.H - 22;
    const grounded = s.pilot.y > bottom;
    if (s.pilot.y < top) {
        s.pilot.y = top;
        s.pilot.vy = Math.max(0, s.pilot.vy);
    }
    if (s.pilot.y > bottom) {
        s.pilot.y = bottom;
        s.pilot.vy = Math.min(0, s.pilot.vy);
    }
    if (grounded) {
        s.floorT += dt;
        if (s.floorT > SPILL.floorGrace) {
            s.floorT = 0;
            lose(s, "GROUNDED");
            return;
        }
    }
    else if (s.floorT > 0) {
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
            for (let k = 0; k < 6; k++)
                if (spawnRock(s))
                    break;
        }
        s.nextNut -= dt;
        if (s.nextNut <= 0) {
            s.nextNut = 4.5 + rand(s) * 4;
            spawnStream(s);
        }
        s.nextSpecial -= dt;
        if (s.nextSpecial <= 0) {
            s.nextSpecial = 10 + rand(s) * 8;
            spawnSpecial(s);
        }
    }
    // ---- debris
    const golden = s.gold > 0;
    for (const r of s.rocks) {
        if (r.dead)
            continue;
        // a hulk waits offscreen while it warns. The frame the warning runs
        // out in still flies its remainder, so the piece lands exactly where
        // the spawn check said it would
        let move = dt;
        if (r.warn > 0) {
            const left = r.warn;
            r.warn = Math.max(0, r.warn - dt);
            if (r.warn > 0)
                continue;
            move = dt - left;
        }
        r.x += r.vx * move;
        r.y += r.vy * move + (r.arc ? Math.cos(r.arcPhase + s.t * ARC_RATE) * r.arc * move : 0);
        r.rot += r.spin * move;
        const dx = r.x - s.pilot.x;
        const dy = r.y - s.pilot.y;
        const d2 = dx * dx + dy * dy;
        const kill = r.r + SPILL.shipR;
        if (d2 < kill * kill) {
            if (golden) {
                shatter(s, r, 1.1);
                continue;
            }
            if (s.iframes > 0)
                continue;
            takeHit(s, r);
            if (!flying(s))
                return;
            continue;
        }
        // near miss: once per piece, once it is alongside or past. Points,
        // not charge - the meter is the Gold Ore's to fill
        const graze = r.r + SPILL.grazeR;
        if (!r.grazed && r.x < s.pilot.x + r.r && d2 < graze * graze) {
            r.grazed = true;
            s.grazes += 1;
            s.score += 6;
            burst(s, s.pilot.x + 10, s.pilot.y, 3, "graze", 0.4);
            cue(s, "graze");
        }
    }
    s.rocks = s.rocks.filter((r) => !r.dead && r.x > -r.r - 60 && r.y > -r.r - 80 && r.y < s.H + r.r + 80);
    // ---- ore and the drifts
    if (s.comboT > 0) {
        s.comboT = Math.max(0, s.comboT - dt);
        if (s.comboT === 0)
            s.combo = 0;
    }
    for (const n of s.nuts) {
        if (n.got)
            continue;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        n.bob += dt * 4;
        const dx = n.x - s.pilot.x;
        const dy = n.y + Math.sin(n.bob) * 3 - s.pilot.y;
        if (dx * dx + dy * dy < 30 * 30) {
            n.got = true;
            if (n.kind === "hull") {
                s.hull = Math.min(s.maxHull, s.hull + 1);
                say(s, "HULL PATCHED", 1.3);
                burst(s, n.x, n.y, 14, "hull", 0.9);
                cue(s, "hull");
            }
            else {
                const worth = n.kind === "gold" ? 5 : 1;
                s.ore += worth;
                s.oreMined += worth;
                s.combo = Math.min(9, s.combo + 1);
                s.comboT = 2.6;
                s.score += 25 * s.combo * (n.kind === "gold" ? 2 : 1);
                if (n.kind === "gold") {
                    s.charge = Math.min(1, s.charge + 0.5);
                    say(s, s.up.pulse >= 1 ? (s.charge >= 1 ? "PULSE ARMED" : "GOLD ORE · CHARGING") : "GOLD ORE", 1);
                    cue(s, "gold");
                }
                else
                    cue(s, "ore");
                burst(s, n.x, n.y, n.kind === "gold" ? 14 : 7, n.kind === "gold" ? "gold" : "ore", 0.8);
            }
        }
    }
    s.nuts = s.nuts.filter((n) => !n.got && n.x > -40 && n.y > -40 && n.y < s.H + 40);
    // surviving is worth points on its own, so a cautious run still scores
    s.score += dt * 10 * (1 + climb);
}
// -------------------------------------------------------------- readouts
/** waves CLEARED: the number the record keeps */
export function spillCleared(s) {
    return s.cleared;
}
/** seconds left in the wave's spawning window, for the HUD clock */
export function spillWaveLeft(s) {
    if (s.phase !== "wave")
        return 0;
    return Math.max(0, s.spec.dur - s.waveT);
}
/** the countdown's whole seconds, 3..1, or 0 when it is not running */
export function spillCount(s) {
    if (s.phase !== "countdown")
        return 0;
    return Math.max(0, Math.ceil(SPILL.countdown - s.phaseT));
}
/** the rule strength the HUD shows, 0..1 */
export function spillRamp(s) {
    return ramp(s);
}
export function spillSignature(s) {
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
        up: { ...s.up },
    };
}
