import { MIN_SEP, sep, PLANET_RGB, SKY_RGB, BOUNCE_ANIM_DURATION, BOUNCE_ANIM_ENABLED, DEBRIS_COUNT, PLANET_COUNT, ENVS, ENV_GATES, IS_BETA, RETRO_GATE, TAIL, TAP_ANIM_DURATION, TAP_ANIM_ENABLED, skyIdFor, PHYS, TRAILS, TUT_ARM, levelForXp, runXp } from "./catalog.js?v=81";
import { modsUnlocked, writeSave } from "./save.js?v=81";
import { GUIDE_SUIT, GUIDE_HELM } from "./catalog.js?v=81";
import { countBits, emptyStats, goalMet, goldGatesFor } from "./campaign.js?v=81";
import { createRaceState, queueRaceInput, stepRace } from "./race.js?v=81";
import { raceViewport, raceViewportY } from "./race-viewport.js?v=81";
import { WORMHOLE_HOLD_ACCEL, WORMHOLE_MAX_VY, WORMHOLE_MIN_VY, WORMHOLE_RELEASE_ACCEL, } from "./control-constants.js?v=81";
export const TUNNEL_PATTERNS = [
    "launch", "ribbon", "acornArc", "sweep", "breather",
    "squeeze", "ripples", "debrisWeave", "surge",
];
export const TUNNEL_PATTERN_NAMES = {
    launch: "ENTRY VECTOR",
    ribbon: "RIBBON SLITHER",
    acornArc: "ACORN CURRENT",
    sweep: "GRAVITY SWEEP",
    breather: "STABLE FLOW",
    squeeze: "PULSE SQUEEZE",
    ripples: "RIPPLE RUN",
    debrisWeave: "DEBRIS WEAVE",
    surge: "WORMHOLE SURGE",
};
export const TUNNEL_REGION_NAMES = [
    "VIOLET FOLD",
    "ION CURRENT",
    "EMBER RIFT",
    "EMERALD SLIP",
    "EVENT HORIZON",
];
export function makeWorld(W, H) {
    return {
        W,
        H,
        screen: "splash",
        flight: "fly",
        ready: false,
        score: 0,
        runAcorns: 0,
        squirrel: { y: H * 0.45, vy: 0, rot: 0 },
        planets: [],
        pickups: [],
        particles: [],
        tunnel: null,
        race: null,
        stars: [],
        speed: PHYS.baseSpeed,
        distance: 0,
        lastSpawnX: 0,
        lastGapY: H * 0.45,
        powerLeft: 0,
        invulnLeft: 0,
        flapBoost: 0,
        tapAnimT: -1,
        tapAnimDir: 1,
        tapAnimFromRot: 0,
        bounceAnimT: -1,
        bounceAnimDir: 0,
        bounceAnimStrength: 0,
        tunnelHeld: false,
        hitCooldown: 0,
        trailT: 0,
        bounceUp: false,
        shieldCharges: 0,
        absorbGrace: 0,
        shieldFreeze: 0,
        shieldSlow: 0,
        startShieldArmed: false,
        deadTimer: 0,
        time: 0,
        envOrder: ENVS.map((_, i) => i),
        envA: 0,
        envB: 0,
        envBlend: 1,
        envMsgT: 0,
        driftPhase: 0,
        driftFactor: 1,
        tiltPhase: 0,
        warpT: 0,
        warpLeft: 0,
        warpTilt: 0,
        warpMirror: true,
        prevTilt: 0,
        prevMirror: false,
        deepTimer: 0,
        warpKind: null,
        retro: false,
        retroShifts: 0,
        retroPending: false,
        tailA: 0,
        tailV: 0,
        recoveryMsg: "",
        palPos: { x: 0, y: 0, dart: 0 },
        shake: 0,
        pausedFrom: null,
        tut: null,
        lastRun: null,
        lvl: null,
        lastLevel: null,
    };
}
export function initStars(w) {
    w.stars = Array.from({ length: 80 }, () => ({
        x: Math.random() * w.W,
        y: Math.random() * w.H,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.7 + 0.2,
        tw: Math.random() * Math.PI * 2,
    }));
}
/**
 * Resize a live world without making a tunnel run jump lanes or silently
 * move its next obstacle closer to the pilot. The normal modes keep their
 * historic resize behaviour; Wormhole additionally remaps its authored
 * track around the fixed player anchor.
 */
export function resizeWorld(w, W, H) {
    const oldW = w.W;
    const oldH = w.H;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0)
        return;
    if (w.flight === "tunnel" && w.tunnel && oldW > 0 && oldH > 0 && (oldW !== W || oldH !== H)) {
        const scaleY = H / oldH;
        const shiftX = W * PHYS.squirrelX - oldW * PHYS.squirrelX;
        const minHalf = Math.max(72, Math.min(88, H * 0.15));
        const maxHalf = Math.max(minHalf + 38, Math.min(150, H * 0.27));
        w.tunnel.patternStartCenter = Math.max(minHalf + 18, Math.min(H - minHalf - 18, w.tunnel.patternStartCenterRatio * H));
        w.tunnel.patternStartHalf = Math.max(minHalf, Math.min(maxHalf, w.tunnel.patternStartHalfRatio * H));
        for (const n of w.tunnel.nodes) {
            let center = n.centerRatio * H;
            const half = Math.max(minHalf, Math.min(maxHalf, n.halfRatio * H));
            center = Math.max(half + 18, Math.min(H - half - 18, center));
            n.x += shiftX;
            n.top = center - half;
            n.bottom = center + half;
        }
        for (const hazard of w.tunnel.hazards) {
            hazard.x += shiftX;
            hazard.y *= scaleY;
        }
        for (const pickup of w.pickups) {
            pickup.x += shiftX;
            pickup.y *= scaleY;
        }
        for (const particle of w.particles) {
            particle.x += shiftX;
            particle.y *= scaleY;
        }
        const resizedBounds = tunnelBoundsAt(w, W * PHYS.squirrelX);
        w.squirrel.y = Math.max(resizedBounds.top + PHYS.squirrelR + 2, Math.min(resizedBounds.bottom - PHYS.squirrelR - 2, w.squirrel.y * scaleY));
        w.palPos.x += shiftX;
        w.palPos.y *= scaleY;
        w.lastGapY *= scaleY;
    }
    // every planet mode — anything that is not the tunnel, which remapped
    // itself above, and not a race, which owns its own viewport
    const remapPlanets = w.flight !== "tunnel" && !w.tut && !w.race &&
        oldW > 0 && oldH > 0 && (oldW !== W || oldH !== H);
    w.W = W;
    w.H = H;
    // Rotating mid-run used to leave every planet mode in its OLD
    // coordinates: a run spawned portrait kept gates laid out for an
    // 844px-tall field, so a landscape window showed scattered planets,
    // no debris, and gaps it could not reach (audit finding S3). The
    // whole live world now remaps into the new field — gate centres
    // scale and re-clamp, debris seals rebuild for the new bands, and
    // the pilot keeps their relative altitude. The scripted tutorial is
    // exempt: its beats are authored for the field they started in.
    if (remapPlanets) {
        const scaleY = H / oldH;
        const shiftX = W * PHYS.squirrelX - oldW * PHYS.squirrelX;
        const margin = 72;
        const env = ENVS[w.envB];
        for (const p of w.planets) {
            p.x += shiftX;
            p.gapY = Math.max(margin + p.gap / 2, Math.min(H - margin - p.gap / 2, p.gapY * scaleY));
            p.blockers = sealBlockers(w, env, p.gapY, p.gap);
        }
        for (const a of w.pickups) {
            a.x += shiftX;
            a.y = Math.max(16, Math.min(H - 16, a.y * scaleY));
        }
        for (const pt of w.particles) {
            pt.x += shiftX;
            pt.y *= scaleY;
        }
        w.squirrel.y = Math.max(20, Math.min(H - 20, w.squirrel.y * scaleY));
        w.palPos.x += shiftX;
        w.palPos.y *= scaleY;
        w.lastGapY = Math.max(margin + 84, Math.min(H - margin - 84, w.lastGapY * scaleY));
        // keep the spawner's look-ahead anchored to the new right edge
        w.lastSpawnX += W - oldW;
    }
    if (w.race) {
        const viewport = raceViewport(W, H);
        w.squirrel.y = raceViewportY(viewport, w.race.y);
        w.squirrel.vy = w.race.vy * viewport.scale;
    }
}
function shuffleEnv(w) {
    const mid = ENVS.map((_, i) => i).slice(1, -1);
    for (let i = mid.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mid[i], mid[j]] = [mid[j], mid[i]];
    }
    w.envOrder = [0, ...mid, ENVS.length - 1];
}
export function envIndexFor(w, score) {
    // a level is ten-to-thirty gates under ONE sky — the stage's identity —
    // so the zone ladder does not apply inside one
    if (w.lvl && w.lvl.def.fx.env !== undefined)
        return w.lvl.def.fx.env;
    return w.envOrder[Math.min(Math.floor(score / ENV_GATES), ENVS.length - 1)];
}
function palId(save, w) {
    if (w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo"))
        return "buddy";
    return save.equippedPal;
}
// A mod never touches a TUTORIAL run. The tutorial is teaching the game as
// designed, and a pilot who armed Thrill Seeker and then replayed it would
// be taught a different game. It is also gated on level, so a new pilot
// cannot have one on in the first place — this is the belt to that braces.
//
// Mods never touch a CAMPAIGN LEVEL either: a star has to certify the same
// flight for every pilot, and Steady Gates would quietly buy the no-bounce
// star while Thrill Seeker would double a level tuned at 1x. The level's
// own fx are the only dials.
function modsLive(save, w) {
    return !w.tut && !w.lvl && modsUnlocked(save);
}
/** How hard the gates sway in Normal: 0 with Steady Gates, 2 with Rough Air. */
function driftModOf(save, w) {
    if (!modsLive(save, w))
        return 1;
    if (save.steadyGates)
        return 0;
    if (save.roughAir)
        return 2;
    return 1;
}
/** Thrill Seeker runs the whole world at double speed. See updateWorld.
 *  A level's fx.pace rides the same lever, so SOLAR FURNACE is Thrill
 *  Seeker at 1.2 rather than a second clock to reason about. */
function paceOf(save, w) {
    if (w.lvl)
        return w.lvl.def.fx.pace ?? 1;
    // Wormhole scores compare one shared control model. Cosmetics still
    // travel with the pilot, but global mods do not silently change its
    // reaction window or invalidate a generated safe path.
    if (w.flight === "tunnel")
        return 1;
    return modsLive(save, w) && save.thrillSeeker ? 2 : 1;
}
function gravOf(save, w) {
    if (w.flight === "tunnel")
        return PHYS.gravity;
    const id = palId(save, w);
    return PHYS.gravity * (id === "pocketmoon" ? 0.85 : id === "nutsack" ? 1.2 : 1);
}
function flapOf(save, w) {
    if (w.flight === "tunnel")
        return PHYS.flap;
    const id = palId(save, w);
    return PHYS.flap * (id === "nutsack" ? 0.71 : 1);
}
function gapSpacing(w) {
    return 230 + Math.min(50, w.distance * 0.004);
}
// Gates are not metronome-even: normal flight scatters them across
// 100%–115% of the base rhythm, and Lost in Space keeps the full
// 85%–115% spread because its rotation gives tight pairs room to read.
function nextGapSpacing(w) {
    return w.flight === "lost"
        ? gapSpacing(w) * (0.85 + Math.random() * 0.3)
        : gapSpacing(w) * (1 + Math.random() * 0.15);
}
function overdriveT(score) {
    if (score < PHYS.overdriveGate)
        return 0;
    return Math.min(1, (score - PHYS.overdriveGate) / PHYS.overdriveSpan);
}
function difficulty(w) {
    const t = Math.min(1, w.distance / 12000);
    const od = overdriveT(w.score);
    const max = PHYS.maxSpeed * (1 + 0.1 * od);
    const gmin = PHYS.gapMin * (1 - 0.2 * od);
    return {
        speed: PHYS.baseSpeed + (max - PHYS.baseSpeed) * t,
        gap: PHYS.gapBase - (PHYS.gapBase - gmin) * t,
    };
}
function pickKind(w) {
    const idx = envIndexFor(w, w.score);
    const env = ENVS[idx];
    if (Math.random() < 0.55)
        return env.planetBias[Math.floor(Math.random() * env.planetBias.length)] % PLANET_COUNT;
    // free pick, but never one that would vanish into this sky: reject
    // planets whose luminance sits too close to the backdrop's
    const sky = SKY_RGB[skyIdFor(w.flight, idx)];
    for (let i = 0; i < 10; i++) {
        const k = Math.floor(Math.random() * PLANET_COUNT);
        if (sep(sky, PLANET_RGB[k]) >= MIN_SEP)
            return k;
    }
    return env.planetBias[Math.floor(Math.random() * env.planetBias.length)] % PLANET_COUNT;
}
// Debris follows the zone's palette, and never blends into its sky.
// Debris comes ONLY from the zone's own three-rock family. Rolling the
// whole pool put six materials on one screen and the eye had nowhere to
// rest — a zone should read as one place. All 27 rocks still fly; they
// are spread ACROSS the 26 zones instead of stacked inside each one.
function pickDebris(env) {
    return env.debrisBias[Math.floor(Math.random() * env.debrisBias.length)] % DEBRIS_COUNT;
}
// Fully seal the corridor above the top gate and below the bottom one,
// packed tight enough that the flight lane cannot be slipped around.
function sealBlockers(w, env, gapY, gap) {
    const r = PHYS.planetR;
    const blockers = [];
    // A short landscape field leaves only a thin band between each planet
    // and the screen edge — the portrait spacing (26px of air, 30px step,
    // 20px edge reserve) fit ZERO rocks there and every gate spawned bare.
    // Tight packing keeps the seal visible whatever the field height.
    const short = w.H < 560;
    const pad = short ? 6 : 26;
    const step = short ? 24 : 30;
    const edge = short ? 6 : 20;
    const put = (y, n) => blockers.push({
        y,
        r: 19 + Math.random() * 7,
        kind: pickKind(w),
        xOff: ((n % 2) * 2 - 1) * (2 + Math.random() * 5),
        debris: pickDebris(env),
    });
    let y = gapY - gap / 2 - r * 2 - pad;
    for (let n = 0; y > edge && n < 12; n++, y -= step)
        put(y, n);
    y = gapY + gap / 2 + r * 2 + pad;
    for (let n = 0; y < w.H - edge && n < 12; n++, y += step)
        put(y, n);
    // A short field's bands hold one or two rocks vertically, which still
    // reads as empty sky. Widen the seal instead: a row of smaller rocks
    // flanks each planet along the screen edge, so landscape flights meet
    // the same debris field portrait always had — visible AND solid.
    if (short) {
        const row = (yy, count) => {
            for (let n = 0; n < count; n++) {
                const side = (n % 2) * 2 - 1;
                blockers.push({
                    y: yy + (Math.random() - 0.5) * 10,
                    r: 14 + Math.random() * 7,
                    kind: pickKind(w),
                    xOff: side * (30 + Math.floor(n / 2) * 26 + Math.random() * 9),
                    debris: pickDebris(env),
                });
            }
        };
        const topBand = gapY - gap / 2 - r * 2;
        const botBand = w.H - (gapY + gap / 2 + r * 2);
        if (topBand > 24)
            row(Math.max(16, topBand - 22), 4);
        if (botBand > 24)
            row(Math.min(w.H - 16, w.H - botBand + 22), 4);
    }
    return blockers;
}
// ——— THE SCRIPTED COURSE ———
// One fixed run, laid out IN FULL before the first tap. The world freezes
// under every prompt and glide taps are ignored, so the guided beats fly
// one deterministic trajectory — computable up front. Nothing is moved or
// conjured mid-flight: the pilot sees the whole road ahead, exactly like
// a real run.
function buildTutorialCourse(w, save) {
    w.planets = [];
    w.pickups = [];
    const env = ENVS[w.envB];
    const sx = w.W * PHYS.squirrelX;
    const g = gravOf(save, w);
    const fv = flapOf(save, w);
    const arc = (v, t) => v * t + 0.5 * g * t * t;
    const gap = 176; // a touch friendlier while learning
    const clampY = (y) => Math.max(70 + gap / 2, Math.min(w.H - 70 - gap / 2, y));
    const y0 = w.H * 0.45; // the squirrel's start line
    const y1 = y0 + arc(fv, 0.8); // at the TAP prompt
    const y2 = y1 + arc(fv, 0.55); // at the TAP AGAIN prompt
    const tLand = 0.9;
    const yLand = y2 + arc(fv, tLand); // the fall meets the planet here
    const dLand = PHYS.baseSpeed * (0.8 + 0.55 + tLand);
    const tApex = (640 - 60) / g; // the −640 spring up to the freeze
    const yApex = yLand - (640 * tApex - 0.5 * g * tApex * tApex);
    const dApex = dLand + PHYS.baseSpeed * tApex;
    // the recovery gate: as deep below the apex as the screen allows
    const dyDive = Math.max(120, Math.min(352, w.H - 70 - gap / 2 - yApex - 20));
    const tDive = (-PHYS.dive + Math.sqrt(PHYS.dive * PHYS.dive + 2 * g * dyDive)) / g;
    const mk = (dist, gapY, sealed) => {
        const yy = clampY(gapY);
        const pair = {
            x: sx + dist,
            gapY: yy,
            gap,
            r: PHYS.planetR,
            topKind: pickKind(w),
            botKind: pickKind(w),
            scored: false,
            drift: 0,
            driftAmp: 0,
            blockers: sealed ? sealBlockers(w, env, yy, gap) : [],
        };
        w.planets.push(pair);
        return pair;
    };
    // 1 — the bounce planet: its top surface exactly on the touchdown point
    mk(dLand, yLand + 6 - gap / 2, false);
    // 2 — the dive gate, sitting low, already visible from the apex freeze
    const d2 = dApex + PHYS.baseSpeed * tDive;
    const p2 = mk(d2, yApex + dyDive, false);
    // 3–7 — practice gates easing back to the flight line, fully sealed so
    // they read as REAL gates (every mistake is protected while learning)
    const path = [y0 + 80, y0 - 40, y0 + 60, y0 - 20, y0 + 40];
    let d = d2;
    const rest = [];
    for (const yy of path) {
        d += 260;
        rest.push(mk(d, yy, true));
    }
    const acorn = (x, y) => w.pickups.push({ x, y, got: false, bob: Math.random() * Math.PI * 2, kind: "acorn" });
    acorn(p2.x + 8, p2.gapY);
    rest.forEach((p, i) => acorn(p.x + 8, p.gapY + (i >= 3 ? (i % 2 ? -1 : 1) * 85 : 0)));
    // hand the reins back to the normal spawner beyond the course
    w.lastSpawnX = sx + d;
    w.lastGapY = rest[rest.length - 1].gapY;
}
// While the tutorial teaches, a debris hit is a free reset — the whole
// shield theatre without spending anything. Unlimited, but only here.
function tutReset(w, bx, by) {
    const sx = w.W * PHYS.squirrelX;
    let cy = w.H * 0.45;
    let best = null;
    for (const p of w.planets)
        if (p.x + p.r >= sx - 20 && (!best || p.x < best.x))
            best = p;
    if (best)
        cy = liveGapY(best);
    spark(w, bx, by, ["#7ad8ff", "#5dff9e", "#fff"], 16, "shield");
    for (const p of w.planets) {
        p.blockers = p.blockers.filter((b) => {
            const ax = p.x + b.xOff;
            return Math.hypot(ax - bx, b.y - by) > 110 && Math.hypot(ax - sx, b.y - cy) > 150;
        });
    }
    w.squirrel.y = cy;
    w.squirrel.vy = 0;
    w.squirrel.rot = 0;
    w.hitCooldown = 0;
    w.bounceUp = false;
    w.shieldFreeze = 0.45;
    w.shieldSlow = 2.6;
    w.absorbGrace = 1.8;
    w.recoveryMsg = "PROTECTED — TRY AGAIN!";
    spark(w, sx, cy, ["#7ad8ff", "#fff"], 14, "shield");
}
function tutSafe(w) {
    return !!w.tut && w.tut.stage !== "free";
}
function spawnPair(w, save, x) {
    const env = ENVS[w.envB];
    const d = difficulty(w);
    let gap = d.gap * (w.lvl?.def.fx.gapScale ?? 1);
    const margin = 72;
    let gapY = margin + gap / 2 + Math.random() * (w.H - 2 * margin - gap);
    const dx = Math.max(80, x - w.lastSpawnX);
    // Reachability, on the live game's tuned model. The two budgets are NOT
    // symmetric and must not be swapped: climbing is the slow direction
    // (230px/s of sustainable lift) while gravity makes diving fast
    // (520px/s). Smaller y is higher, so climb bounds how far UP the next
    // gate may sit and dive bounds how far DOWN. Having these inverted made
    // the sandbox demand climbs the pilot could not make while flattening
    // every descent. Lost in Space reserves headroom for its sway + drift.
    const speed = Math.max(d.speed, 1);
    const lost = w.flight === "lost";
    const dxWorst = lost ? Math.max(100, dx - 48) : dx;
    const dtGate = dxWorst / (speed * (lost ? 1.4 : 1));
    const vMargin = lost ? 30 : 0;
    const climb = Math.max(40, 230 * dtGate - vMargin);
    const diveAmt = Math.max(60, 520 * dtGate - vMargin);
    gapY = Math.max(w.lastGapY - climb, Math.min(w.lastGapY + diveAmt, gapY));
    gapY = Math.max(margin + gap / 2, Math.min(w.H - margin - gap / 2, gapY));
    const r = PHYS.planetR;
    const topY = gapY - gap / 2 - r;
    const botY = gapY + gap / 2 + r;
    const blockers = sealBlockers(w, env, gapY, gap);
    // Vertical drift: the gate itself breathes up and down. Free Flight
    // now carries a gentle 15%-of-gap sway so a run is never a static
    // ladder; the wisp pal and Lost in Space push it further. Horizontal
    // drift — the scroll speed wobbling — is NOT here: that stays a Lost
    // in Space signature (see driftFactor, gated to "lost" alone).
    // Two mods buy a say in this, and only in Normal: Steady Gates stills the
    // sway entirely, Rough Air doubles it. They do not touch Lost in Space,
    // whose drift is the mode's whole identity, and neither touches a black
    // hole's tilt — that is orientation, not drift, and it stays either way.
    const pilot = palId(save, w);
    const normalDrift = w.flight === "fly" ? driftModOf(save, w) : 1;
    // a level's fx sway rides on top of the mode's own; CRIMSON STORM is
    // Rough Air with the volume knob exposed
    const lvlDrift = w.lvl?.def.fx.driftScale ?? 1;
    const driftAmp = (pilot === "wisp" ? 26
        : w.flight === "lost" ? 12
            : w.tut ? 0
                : gap * 0.15 * normalDrift) * lvlDrift;
    w.planets.push({
        x,
        gapY,
        gap,
        r,
        topKind: pickKind(w),
        botKind: pickKind(w),
        scored: false,
        drift: Math.random() * Math.PI * 2,
        driftAmp,
        blockers,
    });
    const pal = palId(save, w);
    const noPick = pal === "bee" || (w.tut && w.tut.stage !== "palDemo" && w.tut.stage !== "free" && w.tut.stage !== "ready");
    // A collection star must never be lost to the spawn dice: a level with
    // fx.acornEvery guarantees one acorn per gate, so "collect N" is always
    // achievable inside the level's own gate count with room to miss a few.
    const acornOdds = w.lvl?.def.fx.acornEvery ? 1 : 0.58;
    // A LEVEL's promised pickups outrank the pal's veto. Bee spawns no
    // pickups and that is its trade in endless — but a level whose star says
    // "collect N" or "catch a golden acorn" must spawn them for every pilot,
    // whatever is flying alongside. Golds land on planned gates (goldGatesFor)
    // so the promise is arithmetic, not odds.
    if (w.lvl) {
        w.lvl.spawnOrd += 1;
        if (w.lvl.def.fx.acornEvery && noPick) {
            const off = (Math.random() - 0.5) * gap * 0.35;
            w.pickups.push({ x: x + 8, y: gapY + off, got: false, bob: Math.random() * 6, kind: "acorn" });
        }
        if (w.lvl.goldGates.includes(w.lvl.spawnOrd)) {
            w.pickups.push({ x: x + 52, y: gapY + (Math.random() - 0.5) * gap * 0.2, got: false, bob: Math.random() * 6, kind: "gold" });
        }
    }
    // Arcade is the generous mode: power-ups spawn twice as often by
    // default. Free Flight is the opposite — at the old rate a run was
    // carrying a freeze or a shield almost continuously, which is not a
    // power-up any more, it is the baseline. Halved there, and there only.
    // The pal bonus still multiplies on top of whichever mode you are in.
    // NOTE: this scales the three power-ups (freeze, golden, shield). The
    // black hole is a hazard and the 8-bit acorn is the door to the other
    // game, so neither rides this multiplier.
    const specialMul = (pal === "meteorcore" ? 2 : 1) *
        (w.flight === "arcade" ? 2 : 1) *
        (w.flight === "fly" ? 0.5 : 1);
    const noShield = pal === "nutsack" || pal === "tinbot";
    const noHoles = pal === "tinbot";
    if (!noPick) {
        if (w.tut || Math.random() < acornOdds) {
            const off = w.tut?.stage === "palDemo" ? (Math.random() < 0.5 ? -1 : 1) * gap * 0.32 : (Math.random() - 0.5) * gap * 0.35;
            w.pickups.push({ x: x + 8, y: gapY + off, got: false, bob: Math.random() * 6, kind: "acorn" });
        }
        if (!w.tut && Math.random() < 0.05 * specialMul) {
            w.pickups.push({ x: x + 36, y: gapY + (Math.random() - 0.5) * gap * 0.22, got: false, bob: Math.random() * 6, kind: "slow" });
        }
        if (!w.tut && Math.random() < 0.035 * specialMul) {
            w.pickups.push({ x: x + 52, y: gapY + (Math.random() - 0.5) * gap * 0.2, got: false, bob: Math.random() * 6, kind: "gold" });
        }
        if (!w.tut && !noShield && Math.random() < 0.03 * specialMul) {
            w.pickups.push({ x: x + 20, y: gapY + (Math.random() - 0.5) * gap * 0.18, got: false, bob: Math.random() * 6, kind: "shield" });
        }
        // Deep Space runs its own shift on a timer, so a black hole there does
        // nothing but clutter the lane — live excludes them and so do we.
        if (!w.tut && !noHoles && w.flight === "fly" && Math.random() < 0.018) {
            w.pickups.push({ x: x + 64, y: gapY, got: false, bob: Math.random() * 6, kind: "hole", r: gap * 0.5 + 10 });
        }
        // The door to the other game. It rides in Free Flight only — the
        // one place you can leave the illustrated game and slip into the
        // arcade for a stretch. It spawns on the flight line like an acorn
        // rather than in the gate mouth like a black hole, because it is a
        // way across, not a hazard. It stays shut until gate 100: crossing
        // timelines is a late-run reward, not something you meet on your
        // second gate before you have seen this game properly.
        if (!w.tut && w.flight === "fly" && w.score >= RETRO_GATE && Math.random() < 0.05) {
            w.pickups.push({ x: x + 44, y: gapY + (Math.random() - 0.5) * gap * 0.2, got: false, bob: Math.random() * 6, kind: "retro" });
        }
        // Wormholes flip your heading in Lost in Space and — now — in Arcade,
        // where they are the reversal hazard the retro game runs on.
        if (!w.tut && !noHoles && (w.flight === "lost" || w.flight === "arcade") && Math.random() < 0.05) {
            w.pickups.push({ x: x + 64, y: gapY, got: false, bob: Math.random() * 6, kind: "worm", r: gap * 0.5 + 10 });
        }
    }
    w.lastSpawnX = x;
    w.lastGapY = gapY;
}
export function resetRun(w, save, flight, tutorial, level, tunnelSeed) {
    w.flight = flight;
    // A campaign level is an ordinary run wearing a finish line. It is set
    // up FIRST because everything below (env order, spawn fx) reads it.
    // guarded on typeof: the tunnel test suite used to pass its SEED in this
    // slot, and a bare truthy check made a number impersonate a level
    w.lvl = level && typeof level === "object"
        ? { def: level, stats: emptyStats(), portal: false, strobeT: 9,
            goldGates: goldGatesFor(level), spawnOrd: 0 }
        : null;
    // every run starts in this game; the arcade acorn is the only way out
    // Arcade IS the retro game — it starts there and never leaves. Every
    // other mode starts illustrated; in Free Flight the 8-bit acorn is the
    // only way across, and it always returns you home before the run ends.
    w.retro = flight === "arcade";
    w.retroShifts = 0;
    w.retroPending = false;
    w.tailA = 0;
    w.tailV = 0;
    w.score = 0;
    w.runAcorns = 0;
    w.squirrel = { y: w.H * 0.45, vy: 0, rot: 0 };
    w.planets = [];
    w.pickups = [];
    w.particles = [];
    w.tunnel = null;
    w.race = w.lvl?.def.base === "race" ? createRaceState() : null;
    w.speed = PHYS.baseSpeed;
    w.distance = 0;
    w.lastSpawnX = w.W * 0.55;
    w.lastGapY = w.H * 0.45;
    w.powerLeft = 0;
    w.invulnLeft = 0;
    w.flapBoost = 0;
    w.tapAnimT = -1;
    w.tapAnimDir = 1;
    w.tapAnimFromRot = 0;
    w.bounceAnimT = -1;
    w.bounceAnimDir = 0;
    w.bounceAnimStrength = 0;
    w.tunnelHeld = false;
    w.hitCooldown = 0;
    w.bounceUp = false;
    w.deadTimer = 0;
    w.ready = true;
    w.screen = "play";
    w.pausedFrom = null;
    w.shake = 0;
    const canShield = save.equippedPal !== "nutsack" && save.equippedPal !== "tinbot";
    w.startShieldArmed = !!(save.startShield && canShield);
    w.shieldCharges = w.startShieldArmed ? 1 : 0;
    w.absorbGrace = 0;
    w.shieldFreeze = 0;
    w.shieldSlow = 0;
    w.warpT = 0;
    w.warpLeft = 0;
    w.warpTilt = 0;
    w.warpMirror = true;
    w.prevTilt = 0;
    w.prevMirror = false;
    w.deepTimer = 0;
    w.warpKind = null;
    w.driftPhase = Math.random() * 100;
    w.driftFactor = 1;
    w.tiltPhase = Math.random() * 100;
    w.recoveryMsg = "";
    w.envA = 0;
    w.envB = 0;
    w.envBlend = 1;
    w.envMsgT = 0; // the opening environment never announces itself —
    // its name (DEEP SPACE) reads as a mode label; shifts still toast
    w.palPos = { x: w.W * PHYS.squirrelX - 42, y: w.H * 0.45 - 20, dart: 0 };
    if (flight === "lost") {
        w.warpMirror = false;
        w.warpTilt = lostTiltAt(w.tiltPhase);
    }
    shuffleEnv(w);
    if (w.lvl && w.lvl.def.fx.env !== undefined) {
        // the level opens already under its stage's sky — no crossfade in
        w.envA = w.lvl.def.fx.env;
        w.envB = w.lvl.def.fx.env;
    }
    if (w.race) {
        const viewport = raceViewport(w.W, w.H);
        w.squirrel.y = raceViewportY(viewport, w.race.y);
        w.squirrel.vy = 0;
        w.speed = w.race.speed;
        w.startShieldArmed = false;
        w.shieldCharges = 0;
    }
    else if (flight === "tunnel")
        initTunnel(w, tunnelSeed);
    else
        for (let i = 0; i < 3; i++)
            spawnPair(w, save, w.W + 90 + i * nextGapSpacing(w));
    w.tut = w.race || flight === "tunnel" ? null : tutorial
        ? { stage: "intro", hold: false, t: 0, gates: 0, gateBase: 0, nudge: "",
            retries: 0, springs: 0, bounced: false }
        : null;
    if (w.tut)
        buildTutorialCourse(w, save);
}
/** The beta's wormhole flight is hold-to-rise. Returns false anywhere it
 *  does not apply (live page, other modes) so the caller falls back to the
 *  classic flap. Grabbing the screen also launches a run still on READY. */
export function setTunnelHeld(w, held) {
    if (!IS_BETA || w.flight !== "tunnel" || !w.tunnel)
        return false;
    if (held) {
        if (w.screen !== "play")
            return false;
        if (w.ready)
            w.ready = false;
        if (w.lvl)
            w.lvl.stats.taps += 1;
    }
    w.tunnelHeld = held;
    return true;
}
/** Semantic race input is tick-stamped and consumed before the next race step. */
export function setRaceInput(w, input) {
    if (!w.race || w.screen !== "play")
        return false;
    queueRaceInput(w.race, input);
    if (input.held || input.drop)
        w.ready = false;
    return true;
}
/** Compatibility shim for callers that only know the original hold control. */
export function setRaceHeld(w, held) {
    return setRaceInput(w, { held, boost: false });
}
const TUNNEL_STEP = 56;
const TUNNEL_PATTERN_LENGTH = {
    launch: 44,
    ribbon: 54,
    acornArc: 48,
    sweep: 48,
    breather: 40,
    squeeze: 46,
    ripples: 50,
    debrisWeave: 54,
    surge: 48,
};
const TUNNEL_SEQUENCE = [
    "ribbon",
    "acornArc",
    "sweep",
    "breather",
    "squeeze",
    "ripples",
    "breather",
    "debrisWeave",
    "surge",
    "breather",
];
function tunnelNoise(seed, index, salt = 0) {
    const x = Math.sin(seed * 0.001 + index * 91.733 + salt * 37.119) * 43758.5453;
    return x - Math.floor(x);
}
function beginTunnelSection(w) {
    const t = w.tunnel;
    t.buildSection += 1;
    t.buildPattern = t.buildSection === 0
        ? "launch"
        : TUNNEL_SEQUENCE[(t.buildSection - 1) % TUNNEL_SEQUENCE.length];
    const cycle = Math.floor(Math.max(0, t.buildSection - 1) / TUNNEL_SEQUENCE.length);
    t.patternLength = Math.max(36, TUNNEL_PATTERN_LENGTH[t.buildPattern] - Math.min(8, cycle * 2));
    t.patternPos = 0;
    t.buildRegion = Math.floor(t.buildSection / 2) % TUNNEL_REGION_NAMES.length;
    const prev = t.nodes[t.nodes.length - 1];
    t.patternStartCenter = prev ? (prev.top + prev.bottom) * 0.5 : w.H * 0.5;
    t.patternStartHalf = prev ? (prev.bottom - prev.top) * 0.5 : Math.min(150, w.H * 0.27);
    t.patternStartCenterRatio = prev ? prev.centerRatio : 0.5;
    t.patternStartHalfRatio = prev ? prev.halfRatio : t.patternStartHalf / w.H;
    t.patternDirection = tunnelNoise(t.seed, t.buildSection, 21) < 0.5 ? -1 : 1;
}
function tunnelPatternShape(w, pattern, u, baseHalf, room, startCenter, direction) {
    const smooth = u * u * (3 - 2 * u);
    const amp = w.H * (0.065 + room * 0.075);
    let center = startCenter;
    let half = baseHalf;
    switch (pattern) {
        case "launch":
            center = w.H * 0.5 + Math.sin(u * Math.PI * 1.5) * w.H * 0.035;
            half += 24 * (1 - smooth);
            break;
        case "ribbon":
            center = w.H * 0.5 + Math.sin(u * Math.PI * 2.2 + direction * 0.6) * amp;
            half += 10;
            break;
        case "acornArc":
            center = w.H * 0.5 + Math.sin(u * Math.PI * 1.8 - direction * 0.8) * amp * 0.72;
            half += 13;
            break;
        case "sweep": {
            const target = w.H * 0.5 + direction * w.H * (0.15 + room * 0.045);
            center = startCenter + (target - startCenter) * smooth;
            half += 8;
            break;
        }
        case "breather":
            center = startCenter + (w.H * 0.5 - startCenter) * smooth + Math.sin(u * Math.PI * 2) * w.H * 0.018;
            half += 25;
            break;
        case "squeeze":
            center = w.H * 0.5 + Math.sin(u * Math.PI * 1.35 + direction) * amp * 0.48;
            half -= Math.sin(u * Math.PI) * (12 + room * 8);
            break;
        case "ripples":
            center = startCenter + Math.sin(u * Math.PI * 4.2) * amp * 0.48;
            half -= (0.5 + 0.5 * Math.sin(u * Math.PI * 6.2)) * (7 + room * 6);
            break;
        case "debrisWeave":
            center = w.H * 0.5 + Math.sin(u * Math.PI * 1.6 - direction) * amp * 0.42;
            half += 16;
            break;
        case "surge":
            center = w.H * 0.5 + Math.sin(u * Math.PI * 2.7 + direction) * amp * 1.08;
            half += 22;
            break;
    }
    return { center, half };
}
function addTunnelPickup(w, node, kind, lane, salt) {
    const t = w.tunnel;
    w.pickups.push({
        x: node.x,
        y: lane,
        got: false,
        bob: tunnelNoise(t.seed, node.index, salt) * 6,
        kind,
        tunnelSection: node.section,
        tunnelPattern: node.pattern,
    });
}
function addTunnelHazard(w, node, lane, salt) {
    const t = w.tunnel;
    const absoluteX = node.index * TUNNEL_STEP;
    if (absoluteX < t.nextHazardAt)
        return false;
    t.hazards.push({
        x: node.x,
        y: lane,
        r: 19 + tunnelNoise(t.seed, node.index, salt) * 5,
        side: lane < (node.top + node.bottom) * 0.5 ? -1 : 1,
        kind: "debris",
        art: Math.floor(tunnelNoise(t.seed, node.index, salt + 1) * DEBRIS_COUNT),
        spin: (tunnelNoise(t.seed, node.index, salt + 2) < 0.5 ? -1 : 1) *
            (0.35 + tunnelNoise(t.seed, node.index, salt + 3) * 0.75),
        nearMissed: false,
        warned: false,
        section: node.section,
        pattern: node.pattern,
    });
    t.nextHazardAt = absoluteX + 820 + tunnelNoise(t.seed, node.index, salt + 4) * 300;
    return true;
}
function populateTunnelNode(w, node, patternPos, patternLength) {
    const t = w.tunnel;
    if (node.x <= w.W * 0.55)
        return;
    const center = (node.top + node.bottom) * 0.5;
    const half = (node.bottom - node.top) * 0.5;
    const u = patternPos / Math.max(1, patternLength - 1);
    let occupied = false;
    if (node.pattern === "debrisWeave") {
        const marks = [Math.round(patternLength * 0.31), Math.round(patternLength * 0.69)];
        const hazardIndex = marks.indexOf(patternPos);
        if (hazardIndex >= 0) {
            const side = (hazardIndex + node.section) % 2 ? -1 : 1;
            occupied = addTunnelHazard(w, node, center + side * half * 0.34, 31 + hazardIndex * 7);
        }
        // A Freeze Acorn appears before the weave, giving the player a clear
        // strategic choice without changing the one-tap control or removing
        // the lethal consequence of a collision.
        if (patternPos === marks[0] - 5) {
            addTunnelPickup(w, node, "slow", center, 48);
            occupied = true;
        }
    }
    else if ((node.pattern === "ribbon" && patternPos === Math.round(patternLength * 0.72)) ||
        (node.pattern === "sweep" && patternPos === Math.round(patternLength * 0.68)) ||
        (node.pattern === "surge" && patternPos === Math.round(patternLength * 0.57))) {
        const side = (node.section + (node.pattern === "sweep" ? 1 : 0)) % 2 ? -1 : 1;
        occupied = addTunnelHazard(w, node, center + side * half * 0.32, 60);
    }
    if (occupied)
        return;
    if (node.pattern === "acornArc" && patternPos >= 5 && patternPos <= patternLength - 5 && patternPos % 4 === 0) {
        const lane = center + Math.sin(u * Math.PI * 2.15) * half * 0.55;
        const special = Math.abs(patternPos - Math.round(patternLength * 0.5)) <= 2;
        addTunnelPickup(w, node, special ? "multiplier" : "acorn", lane, 71);
        return;
    }
    const absoluteX = node.index * TUNNEL_STEP;
    if (absoluteX < t.nextPickupAt)
        return;
    const lane = center + (tunnelNoise(t.seed, node.index, 7) - 0.5) * half * 0.62;
    const roll = tunnelNoise(t.seed, node.index, 6);
    addTunnelPickup(w, node, roll < 0.08 ? "multiplier" : "acorn", lane, 8);
    t.nextPickupAt = absoluteX + 330 + tunnelNoise(t.seed, node.index, 52) * 210;
}
function appendTunnelNode(w) {
    const t = w.tunnel;
    const prev = t.nodes[t.nodes.length - 1];
    const index = prev ? prev.index + 1 : 0;
    if (t.patternLength <= 0 || t.patternPos >= t.patternLength)
        beginTunnelSection(w);
    const patternPos = t.patternPos;
    const patternLength = t.patternLength;
    const pattern = t.buildPattern;
    const progress = Math.min(1, index * TUNNEL_STEP / 30000);
    const minHalf = Math.max(72, Math.min(88, w.H * 0.15));
    const maxHalf = Math.max(minHalf + 38, Math.min(150, w.H * 0.27));
    const wave = Math.sin(index * 0.31 + t.seed) * 0.62 + Math.sin(index * 0.117 + 1.8) * 0.38;
    const baseHalf = maxHalf - (maxHalf - minHalf) * progress + wave * 5;
    const previousHalf = prev ? (prev.bottom - prev.top) * 0.5 : t.patternStartHalf;
    const room = Math.max(0, Math.min(1, (baseHalf - minHalf) / Math.max(1, maxHalf - minHalf)));
    const shape = tunnelPatternShape(w, pattern, patternPos / Math.max(1, patternLength - 1), baseHalf, room, t.patternStartCenter, t.patternDirection);
    const targetHalf = Math.max(minHalf, Math.min(maxHalf, shape.half));
    const half = Math.max(minHalf, Math.min(maxHalf, previousHalf + Math.max(-8, Math.min(8, targetHalf - previousHalf))));
    const previousCenter = prev ? (prev.top + prev.bottom) * 0.5 : w.H * 0.5;
    // Tight corridors turn more slowly. This is the core feasibility rule:
    // visual intensity can rise, but required vertical travel never rises at
    // the same time as the available space falls.
    const widthRoom = Math.max(0, Math.min(1, (half - minHalf) / Math.max(1, maxHalf - minHalf)));
    const maxTurn = 3.8 + widthRoom * 5.8;
    let center = previousCenter + Math.max(-maxTurn, Math.min(maxTurn, shape.center - previousCenter));
    const safeHalf = half;
    center = Math.max(safeHalf + 18, Math.min(w.H - safeHalf - 18, center));
    const node = {
        x: prev ? prev.x + TUNNEL_STEP : -TUNNEL_STEP,
        top: center - safeHalf,
        bottom: center + safeHalf,
        centerRatio: center / w.H,
        halfRatio: safeHalf / w.H,
        index,
        section: t.buildSection,
        pattern,
        region: t.buildRegion,
        sectionStart: patternPos === 0,
        sectionEnd: patternPos === patternLength - 1,
        announced: false,
        cleared: false,
    };
    t.nodes.push(node);
    populateTunnelNode(w, node, patternPos, patternLength);
    t.patternPos += 1;
}
function initTunnel(w, forcedSeed) {
    w.tunnel = {
        nodes: [], hazards: [], scoreFloat: 0,
        multiplier: 1, bestMultiplier: 1, multiplierLeft: 0,
        flow: 0, flowBest: 0, flowGrace: 0, chain: 0, bestChain: 0,
        sectionsCleared: 0, time: 0, nearMisses: 0,
        nextHazardAt: 1800, nextPickupAt: 720,
        seed: Math.max(1, Math.floor(forcedSeed ?? (Math.random() * 1000000 + 1))),
        buildSection: -1, buildPattern: "launch", buildRegion: 0,
        patternPos: 0, patternLength: 0,
        patternStartCenter: w.H * 0.5, patternStartHalf: Math.min(150, w.H * 0.27),
        patternStartCenterRatio: 0.5,
        patternStartHalfRatio: Math.min(150, w.H * 0.27) / w.H,
        patternDirection: 1,
        activePattern: "launch", activeRegion: 0, previousRegion: 0, regionBlend: 1, visualT: 0,
        banner: `${TUNNEL_REGION_NAMES[0]} · ${TUNNEL_PATTERN_NAMES.launch}`,
        bannerKind: "region", bannerLeft: 2.8, nextMilestone: 50,
    };
    while (w.tunnel.nodes.length < Math.ceil((w.W + 360) / TUNNEL_STEP) + 2)
        appendTunnelNode(w);
    w.squirrel.y = w.H * 0.5;
    w.lastGapY = w.H * 0.5;
    w.speed = 220;
    w.planets = [];
    w.startShieldArmed = false;
    w.shieldCharges = 0;
}
function addTunnelFlow(t, amount) {
    t.flow = Math.max(0, Math.min(100, t.flow + amount));
    t.flowBest = Math.max(t.flowBest, t.flow);
    t.flowGrace = 2.2;
}
function refreshTunnelMultiplier(t) {
    const flowTier = t.flow >= 72 ? 3 : t.flow >= 30 ? 2 : 1;
    t.multiplier = Math.max(flowTier, t.multiplierLeft > 0 ? 2 : 1);
    t.bestMultiplier = Math.max(t.bestMultiplier, t.multiplier);
}
function sweptCircleHit(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1, radius) {
    const rx0 = ax0 - bx0;
    const ry0 = ay0 - by0;
    const rvx = (ax1 - ax0) - (bx1 - bx0);
    const rvy = (ay1 - ay0) - (by1 - by0);
    const speedSq = rvx * rvx + rvy * rvy;
    const u = speedSq > 0 ? Math.max(0, Math.min(1, -(rx0 * rvx + ry0 * rvy) / speedSq)) : 0;
    const dx = rx0 + rvx * u;
    const dy = ry0 + rvy * u;
    return dx * dx + dy * dy < radius * radius;
}
export function tunnelBoundsAt(w, x) {
    const nodes = w.tunnel?.nodes;
    if (!nodes?.length)
        return { top: 0, bottom: w.H };
    let a = nodes[0];
    let b = nodes[nodes.length - 1];
    for (let i = 1; i < nodes.length; i++) {
        if (nodes[i].x >= x) {
            a = nodes[i - 1];
            b = nodes[i];
            break;
        }
    }
    const f = Math.max(0, Math.min(1, (x - a.x) / Math.max(1, b.x - a.x)));
    return { top: a.top + (b.top - a.top) * f, bottom: a.bottom + (b.bottom - a.bottom) * f };
}
function updateTunnel(w, save, simDt, realDt) {
    const t = w.tunnel;
    const progress = Math.min(1, w.distance / 30000);
    const baseSpeed = 220 + progress * 160;
    // Surge is a real speed event, not just a louder-looking Ribbon. Its
    // corridor is deliberately wide and it never adds extra debris beyond
    // its one authored obstacle.
    w.speed = baseSpeed * (t.activePattern === "surge" ? 1.08 : 1);
    // Tunnel flight deliberately reuses the main game's gravity and flap
    // impulse. A tap resets upward velocity; gravity owns the descent.
    const oldSy = w.squirrel.y;
    // The BETA flies the wormhole like Hyper Run's stretches: hold to rise,
    // release to fall. Live keeps the classic tap until this is approved.
    w.squirrel.vy = IS_BETA
        ? Math.max(WORMHOLE_MIN_VY, Math.min(WORMHOLE_MAX_VY, w.squirrel.vy + (w.tunnelHeld ? WORMHOLE_HOLD_ACCEL : WORMHOLE_RELEASE_ACCEL) * simDt))
        : Math.min(WORMHOLE_MAX_VY, w.squirrel.vy + gravOf(save, w) * simDt);
    w.squirrel.y += w.squirrel.vy * simDt;
    w.squirrel.rot = Math.max(-0.48, Math.min(0.72, w.squirrel.vy / 720));
    const move = w.speed * simDt;
    w.distance += move;
    t.visualT += simDt;
    t.time += simDt;
    refreshTunnelMultiplier(t);
    t.scoreFloat += move / 100 * t.multiplier;
    w.score = Math.floor(t.scoreFloat);
    if (t.multiplierLeft > 0) {
        t.multiplierLeft = Math.max(0, t.multiplierLeft - realDt);
    }
    if (t.flowGrace > 0)
        t.flowGrace = Math.max(0, t.flowGrace - realDt);
    else
        t.flow = Math.max(0, t.flow - realDt * 3.5);
    if (t.bannerLeft > 0)
        t.bannerLeft = Math.max(0, t.bannerLeft - realDt);
    if (t.regionBlend < 1)
        t.regionBlend = Math.min(1, t.regionBlend + realDt * 0.8);
    for (const n of t.nodes)
        n.x -= move;
    for (const h of t.hazards)
        h.x -= move;
    for (const a of w.pickups) {
        a.x -= move;
        a.bob += simDt * 4;
    }
    while (t.nodes[t.nodes.length - 1].x < w.W + 280)
        appendTunnelNode(w);
    let sound = null;
    for (const n of t.nodes) {
        if (n.sectionStart && !n.announced && n.x <= w.W * 0.82) {
            n.announced = true;
            t.activePattern = n.pattern;
            t.banner = TUNNEL_PATTERN_NAMES[n.pattern];
            t.bannerKind = "pattern";
            t.bannerLeft = 2.2;
            if (t.activeRegion !== n.region) {
                t.previousRegion = t.activeRegion;
                t.activeRegion = n.region;
                t.regionBlend = 0;
                t.banner = `${TUNNEL_REGION_NAMES[n.region]} · ${TUNNEL_PATTERN_NAMES[n.pattern]}`;
                t.bannerKind = "region";
                t.bannerLeft = 2.8;
                sound = "region";
            }
            else if (!sound)
                sound = "section";
        }
        if (n.sectionEnd && !n.cleared && n.x <= w.W * PHYS.squirrelX) {
            n.cleared = true;
            t.sectionsCleared += 1;
            addTunnelFlow(t, 4);
        }
    }
    t.nodes = t.nodes.filter((n, i) => n.x > -TUNNEL_STEP * 2 || i >= t.nodes.length - 2);
    // A Wormhole MISSION has a finish line: SURVIVE the level's seconds
    // and the run completes on the spot — stars bank, the sheet comes up.
    if (w.lvl && t.time >= w.lvl.def.gates) {
        settleLevel(w, save, true);
        return null;
    }
    const sx = w.W * PHYS.squirrelX;
    const sy = w.squirrel.y;
    // Pals travel with the pilot visually, but their abilities remain off in
    // this score-normalized mode.
    const palTargetX = sx - 42;
    const palTargetY = sy - 22 + Math.sin(w.time * 2.6) * 7;
    const palFollow = Math.min(1, realDt * 5);
    w.palPos.x += (palTargetX - w.palPos.x) * palFollow;
    w.palPos.y += (palTargetY - w.palPos.y) * palFollow;
    const bounds = tunnelBoundsAt(w, sx);
    if (sy - PHYS.squirrelR <= bounds.top || sy + PHYS.squirrelR >= bounds.bottom)
        return die(w, save);
    for (const h of t.hazards) {
        if (!h.warned && h.x <= w.W + 150) {
            h.warned = true;
            if (!sound)
                sound = "warning";
        }
        const hitRadius = PHYS.squirrelR + h.r * 0.65;
        if (sweptCircleHit(sx, oldSy, sx, sy, h.x + move, h.y, h.x, h.y, hitRadius))
            return die(w, save);
        if (!h.nearMissed && h.x <= sx && h.x + move > sx) {
            h.nearMissed = true;
            const cross = move > 0 ? Math.max(0, Math.min(1, (h.x + move - sx) / move)) : 1;
            const passY = oldSy + (sy - oldSy) * cross;
            const clearance = Math.abs(passY - h.y) - hitRadius;
            if (clearance >= 0 && clearance <= 19) {
                t.nearMisses += 1;
                addTunnelFlow(t, 15);
                t.banner = "NEAR MISS  +FLOW";
                t.bannerKind = "reward";
                t.bannerLeft = 1.15;
                if (!sound)
                    sound = "near";
            }
        }
    }
    t.hazards = t.hazards.filter((h) => h.x > -80);
    for (const a of w.pickups) {
        if (a.got)
            continue;
        const ay = a.y + Math.sin(a.bob) * 4;
        if (!circleHit(sx, sy, PHYS.squirrelR, a.x, ay, 18))
            continue;
        a.got = true;
        if (a.kind === "multiplier") {
            t.multiplierLeft = 8;
            addTunnelFlow(t, 28);
            spark(w, a.x, ay, ["#fff4a8", "#ffd060", "#b45cff"], 18, "gold");
            sound = "gold";
        }
        else if (a.kind === "slow") {
            w.powerLeft = PHYS.powerDuration;
            addTunnelFlow(t, 10);
            spark(w, a.x, ay, ["#6ef0ff", "#fff", "#8ad8ff"], 16, "cyan");
            sound = "freeze";
        }
        else {
            w.runAcorns += 1;
            t.chain += 1;
            t.bestChain = Math.max(t.bestChain, t.chain);
            addTunnelFlow(t, 4 + Math.min(3, t.chain * 0.25));
            spark(w, a.x, ay, ["#ffd060", "#fff"], 10, "gold");
            sound = "acorn";
        }
    }
    for (const a of w.pickups) {
        if (!a.got && !a.missed && a.x < sx - 22 && a.kind === "acorn") {
            a.missed = true;
            t.chain = 0;
            t.flow = Math.max(0, t.flow - 12);
        }
    }
    w.pickups = w.pickups.filter((a) => a.x > -50 && !a.got && !a.missed);
    const rawDepth = Math.floor(w.distance / 100);
    if (rawDepth >= t.nextMilestone) {
        const reached = t.nextMilestone;
        t.nextMilestone += reached < 200 ? 50 : 100;
        t.banner = reached === 50 ? "CURRENT LOCKED" : reached === 100 ? "DEEP RUN" : reached === 200 ? "LONG HAUL" : `RANGE ${reached}`;
        t.bannerKind = "milestone";
        t.bannerLeft = 2.4;
        if (!sound)
            sound = "milestone";
    }
    refreshTunnelMultiplier(t);
    return sound;
}
function spark(w, x, y, colors, n = 12, kind = "spark") {
    for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 50 + Math.random() * 140;
        w.particles.push({
            x,
            y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            life: 0.3 + Math.random() * 0.28,
            max: 0.58,
            r: 2 + Math.random() * 3,
            color: colors[i % colors.length],
            kind,
        });
    }
}
export function spawnTrail(w, save, scale = 1) {
    // the painted pilot's tail sweeps far to the left — emit behind it or
    // the whole plume is swallowed by the sprite
    const sx = w.W * PHYS.squirrelX - 34;
    const sy = w.squirrel.y + 8;
    if (scale < 1 && Math.random() > scale)
        return;
    const trail = save.equippedTrail;
    const colors = (TRAILS.find((t) => t.id === trail) ?? TRAILS[0]).colors;
    if (trail === "ion") {
        for (let i = 0; i < 8; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 6,
                vx: -150 - Math.random() * 160,
                vy: (Math.random() - 0.5) * 30,
                life: 0.22 + Math.random() * 0.15,
                max: 0.37,
                r: 1.4 + Math.random() * 1.6,
                color: colors[0],
                kind: "ion",
            });
        }
    }
    else if (trail === "bubble") {
        for (let i = 0; i < 7; i++) {
            w.particles.push({
                x: sx,
                y: sy,
                vx: -50 - Math.random() * 70,
                vy: -20 - Math.random() * 50,
                life: 0.5 + Math.random() * 0.35,
                max: 0.85,
                r: 2 + Math.random() * 3.5,
                color: colors[0],
                kind: "bubble",
            });
        }
    }
    else if (trail === "bloom") {
        for (let i = 0; i < 6; i++) {
            w.particles.push({
                x: sx,
                y: sy,
                vx: -55 - Math.random() * 70,
                vy: (Math.random() - 0.5) * 70,
                life: 0.4 + Math.random() * 0.3,
                max: 0.7,
                r: 1.5 + Math.random() * 2,
                color: colors[i % colors.length],
                kind: "bloom",
            });
        }
    }
    else if (trail === "comet") {
        for (let i = 0; i < 12; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 7,
                vx: -160 - Math.random() * 240,
                vy: (Math.random() - 0.5) * 50,
                life: 0.5 + Math.random() * 0.4,
                max: 0.9,
                r: 2.4 + Math.random() * 3.2,
                color: colors[1],
                kind: "comet",
            });
        }
        for (let i = 0; i < 4; i++) {
            w.particles.push({
                x: sx + (Math.random() - 0.5) * 6,
                y: sy + (Math.random() - 0.5) * 6,
                vx: -60 - Math.random() * 80,
                vy: (Math.random() - 0.5) * 30,
                life: 0.2 + Math.random() * 0.12,
                max: 0.32,
                r: 3 + Math.random() * 2,
                color: "#fff8d0",
                kind: "cometcore",
            });
        }
    }
    else if (trail === "prism") {
        for (let i = 0; i < 9; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 8,
                vx: -90 - Math.random() * 150,
                vy: (Math.random() - 0.5) * 80,
                life: 0.35 + Math.random() * 0.25,
                max: 0.6,
                r: 2 + Math.random() * 2.4,
                color: colors[i % colors.length],
                hue: Math.random() * 360,
                spin: (Math.random() - 0.5) * 12,
                kind: "prism",
            });
        }
    }
    else if (trail === "plasma") {
        for (let i = 0; i < 5; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 8,
                vx: -140 - Math.random() * 180,
                vy: (Math.random() - 0.5) * 40,
                life: 0.16 + Math.random() * 0.12,
                max: 0.28,
                r: 1.6 + Math.random() * 1.4,
                color: colors[1],
                seed: Math.random() * 10,
                kind: "plasma",
            });
        }
        w.particles.push({
            x: sx,
            y: sy,
            vx: -60,
            vy: 0,
            life: 0.14,
            max: 0.14,
            r: 3.4,
            color: "#fff",
            kind: "plasmacore",
        });
    }
    else if (trail === "galaxy") {
        for (let i = 0; i < 12; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 10,
                vx: -40 - Math.random() * 90,
                vy: (Math.random() - 0.5) * 40,
                life: 0.5 + Math.random() * 0.4,
                max: 0.9,
                r: 1.2 + Math.random() * 1.6,
                color: colors[i % colors.length],
                kind: "galaxy",
            });
        }
    }
    else if (trail === "aurora") {
        for (let i = 0; i < 8; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 10,
                vx: -70 - Math.random() * 80,
                vy: (Math.random() - 0.5) * 50,
                life: 0.45 + Math.random() * 0.3,
                max: 0.75,
                r: 2 + Math.random() * 2.4,
                color: colors[i % colors.length],
                kind: "aurora",
            });
        }
    }
    else if (trail === "frost") {
        for (let i = 0; i < 8; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 8,
                vx: -80 - Math.random() * 90,
                vy: (Math.random() - 0.5) * 40,
                life: 0.4 + Math.random() * 0.3,
                max: 0.7,
                r: 1.6 + Math.random() * 2,
                color: colors[i % colors.length],
                kind: "frost",
            });
        }
    }
    else if (trail === "voidsmoke") {
        for (let i = 0; i < 7; i++) {
            w.particles.push({
                x: sx,
                y: sy,
                vx: -40 - Math.random() * 50,
                vy: (Math.random() - 0.5) * 30,
                life: 0.6 + Math.random() * 0.4,
                max: 1,
                r: 4 + Math.random() * 5,
                color: colors[i % colors.length],
                kind: "voidsmoke",
            });
        }
    }
    else if (trail === "supernova") {
        for (let i = 0; i < 14; i++) {
            w.particles.push({
                x: sx,
                y: sy + (Math.random() - 0.5) * 8,
                vx: -120 - Math.random() * 180,
                vy: (Math.random() - 0.5) * 70,
                life: 0.35 + Math.random() * 0.3,
                max: 0.65,
                r: 2 + Math.random() * 3,
                color: colors[i % colors.length],
                kind: "supernova",
            });
        }
    }
    else if (trail === "opalfeather") {
        for (let i = 0; i < 7; i++) {
            w.particles.push({
                x: sx, y: sy + (Math.random() - 0.5) * 9,
                vx: -72 - Math.random() * 105, vy: (Math.random() - 0.5) * 42,
                life: 0.52 + Math.random() * 0.32, max: 0.84,
                r: 2.2 + Math.random() * 2.1, color: colors[i % colors.length],
                hue: Math.random() * 360, spin: (Math.random() - 0.5) * 4,
                kind: "opalfeather",
            });
        }
    }
    else if (trail === "clockwork") {
        for (let i = 0; i < 5; i++) {
            w.particles.push({
                x: sx, y: sy + (Math.random() - 0.5) * 10,
                vx: -58 - Math.random() * 86, vy: (Math.random() - 0.5) * 35,
                life: 0.62 + Math.random() * 0.34, max: 0.96,
                r: 2.4 + Math.random() * 2.2, color: colors[i % colors.length],
                hue: Math.random() * 360, spin: Math.random() < 0.5 ? -2.2 : 2.2,
                kind: "clockwork",
            });
        }
    }
    else if (trail === "celestialtide") {
        for (let i = 0; i < 7; i++) {
            w.particles.push({
                x: sx, y: sy + (Math.random() - 0.5) * 8,
                vx: -82 - Math.random() * 105, vy: (Math.random() - 0.5) * 48,
                life: 0.5 + Math.random() * 0.3, max: 0.8,
                r: 2 + Math.random() * 2.4, color: colors[i % colors.length],
                seed: Math.random() * Math.PI * 2, kind: "celestialtide",
            });
        }
    }
    else if (trail === "phoenixplume") {
        for (let i = 0; i < 8; i++) {
            w.particles.push({
                x: sx, y: sy + (Math.random() - 0.5) * 9,
                vx: -88 - Math.random() * 125, vy: -12 - Math.random() * 44,
                life: 0.48 + Math.random() * 0.32, max: 0.8,
                r: 2.3 + Math.random() * 2.4, color: colors[i % colors.length],
                hue: Math.random() * 360, spin: (Math.random() - 0.5) * 5,
                kind: "phoenixplume",
            });
        }
    }
    else if (trail === "verdantflourish") {
        for (let i = 0; i < 7; i++) {
            w.particles.push({
                x: sx, y: sy + (Math.random() - 0.5) * 10,
                vx: -62 - Math.random() * 92, vy: (Math.random() - 0.5) * 50,
                life: 0.58 + Math.random() * 0.34, max: 0.92,
                r: 2 + Math.random() * 2.2, color: colors[i % colors.length],
                hue: Math.random() * 360, spin: (Math.random() - 0.5) * 3,
                kind: "verdantflourish",
            });
        }
    }
    else if (trail === "eclipseglyph") {
        for (let i = 0; i < 6; i++) {
            w.particles.push({
                x: sx, y: sy + (Math.random() - 0.5) * 9,
                vx: -56 - Math.random() * 85, vy: (Math.random() - 0.5) * 34,
                life: 0.62 + Math.random() * 0.38, max: 1,
                r: 2.5 + Math.random() * 2.5, color: colors[i % colors.length],
                hue: Math.random() * 360, spin: Math.random() < 0.5 ? -1.4 : 1.4,
                kind: "eclipseglyph",
            });
        }
    }
    else {
        for (let i = 0; i < 9; i++) {
            w.particles.push({
                x: sx,
                y: sy,
                vx: -80 - Math.random() * 120,
                vy: (Math.random() - 0.5) * 90,
                life: 0.22 + Math.random() * 0.18,
                max: 0.42,
                r: 2 + Math.random() * 3,
                color: colors[i % colors.length],
                kind: "flame",
            });
        }
    }
}
export function flap(w, save) {
    if (w.screen === "pause")
        return "none";
    if (w.screen !== "play")
        return "none";
    if (w.tut?.hold && w.tut.t < TUT_ARM)
        return "none";
    if (w.tut?.hold && w.tut.stage === "swipe") {
        w.tut.nudge = "drag downward — not a tap";
        return "none";
    }
    // The tap that answers a TAP prompt must itself flap — it is the very
    // thing being taught. The second one froze mid-fall, switched straight
    // into "glide" and was then swallowed by the glide guard below, so the
    // pilot resumed plummeting with no lift and met the floor instead of
    // the planned touchdown arc.
    let tapAccepted = false;
    if (w.tut?.hold && (w.tut.stage === "tap" || w.tut.stage === "tap2")) {
        w.tut.hold = false;
        w.tut.t = 0;
        w.tut.stage = w.tut.stage === "tap" ? "tapdone" : "glide";
        tapAccepted = true;
    }
    else if (w.tut?.hold && w.tut.stage === "yourturn") {
        w.tut.hold = false;
        w.tut.stage = "gates";
        w.tut.t = 0;
        w.tut.gates = 0;
    }
    if (w.ready)
        w.ready = false;
    if (!tapAccepted && w.tut && (w.tut.stage === "glide" || w.tut.stage === "bounce"))
        return "none";
    if (w.lvl) {
        w.lvl.stats.taps += 1;
        w.lvl.strobeT = 0; // THE BLACKOUT: a tap is a flashbulb
    }
    // A repeated tap while the burst is still playing keeps the current body
    // pose and recovery clock. Physics, particles, pitch, and the live tail
    // spring still respond immediately, so the new input adds motion without
    // forcing the painted body through its idle/anticipation bookend again.
    if (TAP_ANIM_ENABLED) {
        if (w.tapAnimT < 0) {
            w.tapAnimT = 0;
            w.tapAnimDir = 1;
            w.tapAnimFromRot = w.squirrel.rot;
        }
        else {
            // A repeat tap REWINDS the picture: the animation plays backward from
            // wherever it is, bounces off the start, and runs through to the end
            // again — a natural second wingbeat, never a hyper-speed restart.
            w.tapAnimDir = -1;
        }
    }
    w.squirrel.vy = flapOf(save, w);
    w.flapBoost = 0.22;
    // the tail drags DOWN as the pilot shoots up, then whips back
    w.tailV += TAIL.flap;
    spawnTrail(w, save);
    return "flap";
}
export function dive(w) {
    if (w.screen !== "play" || w.ready)
        return "none";
    // a dive throws the tail the other way, harder — it over-rotates past
    // home on the way back and rings down, which reads as weight falling
    w.tailV -= TAIL.dive;
    if (w.tut?.hold && w.tut.t < TUT_ARM)
        return "none";
    if (w.tut?.hold && w.tut.stage === "swipe") {
        w.tut.hold = false;
        w.tut.stage = "dive";
        w.tut.t = 0;
        w.tut.nudge = ""; // the swipe hint has done its job
        w.tut.gateBase = w.tut.gates;
        w.bounceUp = false;
        w.squirrel.vy = PHYS.dive;
        w.squirrel.rot = 0.5;
        return "dive";
    }
    if (w.tut && (w.tut.stage === "glide" || w.tut.stage === "bounce" || w.tut.stage === "intro" || w.tut.stage === "tap" || w.tut.stage === "tap2"))
        return "none";
    if (w.bounceUp && w.hitCooldown > 0) {
        w.bounceUp = false;
        w.squirrel.vy = PHYS.bounceCancel;
        w.squirrel.rot = 0.35;
        spark(w, w.W * PHYS.squirrelX, w.squirrel.y - 14, ["#e8dcc8", "#fff"], 6, "poof");
        return "dive";
    }
    w.squirrel.vy = PHYS.dive;
    w.squirrel.rot = 0.5;
    w.bounceUp = false;
    spark(w, w.W * PHYS.squirrelX, w.squirrel.y - 16, ["#c8d0e0", "#fff"], 10, "poof");
    return "dive";
}
function liveGapY(p) {
    return p.gapY + Math.sin(p.drift) * p.driftAmp;
}
function circleHit(x1, y1, r1, x2, y2, r2) {
    return Math.hypot(x1 - x2, y1 - y2) < r1 + r2;
}
function bounceOff(w, save, px, py) {
    const sx = w.W * PHYS.squirrelX;
    const sy = w.squirrel.y;
    let dx = sx - px;
    let dy = sy - py;
    const dist = Math.hypot(dx, dy) || 1;
    dx /= dist;
    dy /= dist;
    const incomingVy = w.squirrel.vy;
    const jelly = palId(save, w) === "voidjelly" ? 0.55 : 1;
    const mag = Math.min(560, 170 + Math.abs(w.squirrel.vy) * 0.5) * jelly;
    w.squirrel.vy = dy * mag + (dy >= 0 ? 90 : -160);
    if (BOUNCE_ANIM_ENABLED) {
        w.bounceAnimT = 0;
        w.bounceAnimDir = dy >= 0 ? 1 : -1;
        w.bounceAnimStrength = Math.max(0.68, Math.min(1, Math.abs(incomingVy) / 430));
        // Contact throws the plume opposite the rebound. This is additive to the
        // existing spring, so the authored impact settles naturally afterward.
        w.tailV += w.bounceAnimDir * (5.5 + 2.5 * w.bounceAnimStrength);
    }
    w.bounceUp = w.squirrel.vy < 0;
    w.squirrel.y += dy * 14;
    w.squirrel.rot = dy >= 0 ? 0.85 : -0.55;
    w.hitCooldown = 0.55;
    w.shake = 0.18;
    if (w.lvl)
        w.lvl.stats.bounces += 1;
    spark(w, sx, sy, ["#e8dcc8", "#ffd080", "#fff"], 18);
}
function pushOut(w, px, py, pr, sr) {
    const sx = w.W * PHYS.squirrelX;
    const rr = pr + sr;
    const dx = sx - px;
    if (Math.abs(dx) >= rr)
        return;
    const dyNeed = Math.sqrt(rr * rr - dx * dx);
    const above = w.squirrel.y <= py;
    w.squirrel.y = above ? py - dyNeed : py + dyNeed;
    if (above ? w.squirrel.vy > 0 : w.squirrel.vy < 0)
        w.squirrel.vy = 0;
}
function safeY(w) {
    const sx = w.W * PHYS.squirrelX;
    let best = null;
    for (const p of w.planets) {
        if (p.x + p.r < sx - 20)
            continue;
        if (!best || p.x < best.x)
            best = p;
    }
    return best ? liveGapY(best) : w.H * 0.45;
}
function clearDebrisNear(w, x, y, r1, x2, y2, r2) {
    for (const p of w.planets) {
        p.blockers = p.blockers.filter((b) => {
            const ax = p.x + (b.xOff || 0);
            return Math.hypot(ax - x, b.y - y) > r1 && Math.hypot(ax - x2, b.y - y2) > r2;
        });
    }
}
function absorb(w, bx, by) {
    const sx = w.W * PHYS.squirrelX;
    const cy = safeY(w);
    w.shieldCharges -= 1;
    if (w.lvl)
        w.lvl.stats.shieldsSpent += 1;
    if (bx !== undefined && by !== undefined) {
        spark(w, bx, by, ["#7ad8ff", "#5dff9e", "#fff"], 16, "shield");
        clearDebrisNear(w, bx, by, 110, sx, cy, 150);
    }
    w.squirrel.y = cy;
    w.squirrel.vy = 0;
    w.squirrel.rot = 0;
    w.hitCooldown = 0;
    w.bounceUp = false;
    w.shieldFreeze = 0.7;
    w.shieldSlow = 3;
    w.absorbGrace = 2.2;
    w.recoveryMsg = "SHIELD ABSORBED!";
    w.shake = 0.22;
    spark(w, sx, cy, ["#7ad8ff", "#fff", "#4ad8ff"], 16, "shield");
}
function lostTiltAt(p) {
    return ((40 * Math.PI) / 180) * (0.6 * Math.sin(p * 0.35) + 0.4 * Math.sin(p * 0.13 + 1.3));
}
function pickWarpVariant(w) {
    const variant = Math.floor(Math.random() * 5);
    w.warpMirror = variant < 3;
    const TILT = (25 * Math.PI) / 180;
    w.warpTilt = variant === 0 ? 0 : variant === 1 || variant === 3 ? TILT : -TILT;
}
// The playfield is only visibly warped when it is mirrored or tilted.
// Upright and unmirrored is the identity transform — it looks exactly
// like no warp at all, which is why a warp that lands there feels like
// nothing happened and then announces that it is over.
function warpVisible(tilt, mirror) {
    return mirror || Math.abs(tilt) > 1e-3;
}
function startSwirl(w, kind) {
    w.prevMirror = w.warpMirror;
    w.prevTilt = w.warpTilt;
    // A timeline shift is a fold, not a reorientation: the world spins
    // through the crossing and comes back exactly as it was. Only the hand
    // painting it is different on the far side.
    if (kind === "timeline") { /* prev === current, so the fold returns home */ }
    else if (kind === "worm")
        w.warpMirror = !w.warpMirror;
    else
        pickWarpVariant(w);
    // Outside Lost in Space — where the tilt is driven continuously — a
    // flip can land on upright-and-unmirrored, which draws identically to
    // no warp. Catching one then had no effect for fifteen seconds. Give
    // it a tilt so a wormhole always reorients something.
    if (kind !== "timeline" && w.flight !== "lost" && !warpVisible(w.warpTilt, w.warpMirror)) {
        w.warpTilt = ((25 * Math.PI) / 180) * (Math.random() < 0.5 ? 1 : -1);
    }
    w.warpKind = kind;
    w.warpT = 1;
}
function enterWarp(w, save) {
    const sx = w.W * PHYS.squirrelX;
    const cy = safeY(w);
    clearDebrisNear(w, sx, cy, 150, sx, cy, 150);
    w.squirrel.y = cy;
    w.squirrel.vy = 0;
    w.squirrel.rot = 0;
    w.hitCooldown = 0;
    w.warpLeft = w.flight === "lost" ? 0 : w.flight === "deep" ? 10 : 15;
    w.shieldFreeze = w.flight === "deep" ? 0.2 : 0.4;
    w.absorbGrace = w.flight === "deep" ? 0.9 : 1.6;
    if (palId(save, w) === "ufo" && w.flight !== "deep")
        w.powerLeft = Math.max(w.powerLeft, 2.4);
    w.shake = 0.18;
    spark(w, sx, cy, ["#b45cff", "#fff", "#4ad8ff"], 18, "warp");
}
function exitWarp(w) {
    if (w.flight === "deep") {
        startSwirl(w, "shift");
        return;
    }
    // Only claim to have restored something if the flight was actually
    // reoriented. A warp that drew upright and unmirrored changed nothing,
    // and announcing its end just reads as a phantom message.
    const wasWarped = warpVisible(w.warpTilt, w.warpMirror);
    w.prevTilt = w.warpTilt;
    w.prevMirror = w.warpMirror;
    w.warpTilt = 0;
    w.warpMirror = true;
    w.warpKind = null;
    w.shieldFreeze = 0.7;
    w.shieldSlow = 3;
    if (wasWarped)
        w.recoveryMsg = "ORIENTATION RESTORED";
    spark(w, w.W * PHYS.squirrelX, w.squirrel.y, ["#b45cff", "#fff"], 14, "warp");
}
// The level is over — the portal was flown or the pilot was lost. Stars
// are a BITMASK per level and only ever gain bits: goal 2 earned today and
// goal 3 earned on Tuesday add up to the same three stars, which is what
// lets a hard level be chipped at instead of demanding one perfect run.
export function settleLevel(w, save, finished) {
    // A Wormhole mission grades off the tunnel's own ledger; sync it here so
    // the numbers on the result sheet are the numbers the run actually flew.
    if (w.lvl && w.lvl.def.base === "tunnel" && w.tunnel) {
        w.lvl.stats.acorns = w.runAcorns;
        w.lvl.stats.score = w.score;
        w.lvl.stats.flow = w.tunnel.bestMultiplier;
    }
    const lvl = w.lvl;
    const def = lvl.def;
    const met = finished
        ? [goalMet(def.goals[0], lvl.stats), goalMet(def.goals[1], lvl.stats), goalMet(def.goals[2], lvl.stats)]
        : [false, false, false];
    const mask = (met[0] ? 1 : 0) | (met[1] ? 2 : 0) | (met[2] ? 4 : 0);
    if (def.experimental && def.base === "race") {
        const records = save.experimentalRaceRecords ?? (save.experimentalRaceRecords = {});
        const prior = records[def.raceEventId ?? def.id];
        const finishTicks = Math.max(0, Math.floor(lvl.stats.finishTicks));
        const priorTicks = prior?.bestFinishTicks ?? 0;
        const priorAcorns = prior?.bestAcorns ?? 0;
        const newBestTime = finished && finishTicks > 0 && (!priorTicks || finishTicks < priorTicks);
        const newBestAcorns = lvl.stats.acorns > priorAcorns;
        const bestFinishTicks = newBestTime ? finishTicks : priorTicks;
        const bestAcorns = Math.max(priorAcorns, lvl.stats.acorns);
        records[def.raceEventId ?? def.id] = { bestFinishTicks, bestAcorns };
        const total = Object.values(save.stars || {}).reduce((n, m) => n + countBits(m), 0);
        writeSave(save);
        w.lastLevel = {
            def,
            finished,
            met,
            newMask: mask,
            gained: 0,
            totalBefore: total,
            totalAfter: total,
            stats: { ...lvl.stats },
            raceRecord: {
                finishTicks,
                acorns: lvl.stats.acorns,
                bestFinishTicks,
                bestAcorns,
                newBestTime,
                newBestAcorns,
            },
        };
        w.lvl = null;
        w.tut = null;
        w.screen = "lvldone";
        w.deadTimer = 0;
        return;
    }
    const before = save.stars?.[def.id] || 0;
    const totalBefore = Object.values(save.stars || {}).reduce((n, m) => n + countBits(m), 0);
    if (!save.stars)
        save.stars = {};
    save.stars[def.id] = before | mask;
    const totalAfter = Object.values(save.stars).reduce((n, m) => n + countBits(m), 0);
    // the run still banks like any other: acorns are real, XP keeps the
    // pilot's title alive, lifetime tallies grow
    save.acorns += w.runAcorns;
    save.runs = (save.runs ?? 0) + 1;
    save.lifetimeAcorns = (save.lifetimeAcorns ?? 0) + w.runAcorns;
    save.xp = (save.xp || 0) + runXp(w.score, w.runAcorns, def.base === "deep", def.base === "lost");
    if (w.startShieldArmed)
        save.startShield = false;
    writeSave(save);
    w.lastLevel = {
        def,
        finished,
        met,
        newMask: before | mask,
        gained: countBits((before | mask) & ~before),
        totalBefore,
        totalAfter,
        stats: { ...lvl.stats },
    };
    w.lvl = null;
    w.tut = null;
    w.screen = "lvldone";
    w.deadTimer = 0;
}
function die(w, save) {
    if (w.tut && w.tut.stage !== "free") {
        absorb(w);
        w.shieldCharges = Math.max(w.shieldCharges, 1);
        return "shield";
    }
    if (w.lvl) {
        w.shake = 0.35;
        spark(w, w.W * PHYS.squirrelX, w.squirrel.y, ["#e8dcc8", "#ff6a28"], 20);
        settleLevel(w, save, false);
        return "die";
    }
    w.screen = "dead";
    w.deadTimer = 0;
    w.tut = null;
    w.shake = 0.35;
    // Graduation: the first crash after the tutorial hands over the first
    // suit and helmet, free. The crash sheet announces it, the coach walks
    // the pilot through wearing it, and Mission 1 takes it from there.
    if (save.tutorialDone && save.guide === "pending") {
        if (!save.unlockedSuits.includes(GUIDE_SUIT))
            save.unlockedSuits.push(GUIDE_SUIT);
        if (!save.unlocked.includes(GUIDE_HELM))
            save.unlocked.push(GUIDE_HELM);
        save.guide = "reward";
        writeSave(save);
    }
    const fromXp = save.xp || 0;
    const fromLv = levelForXp(fromXp);
    const xp = runXp(w.score, w.runAcorns, w.flight === "deep", w.flight === "lost");
    w.lastRun = {
        score: w.score,
        acorns: w.runAcorns,
        xp,
        fromXp,
        fromLv,
        toLv: levelForXp(fromXp + xp),
        best: w.flight === "deep"
            ? w.score >= save.deepBest
            : w.flight === "lost"
                ? w.score >= save.lostBest
                : w.flight === "arcade"
                    ? w.score >= save.arcadeBest
                    : w.flight === "tunnel"
                        ? w.score > save.tunnelBest
                        : w.score >= save.highScore,
        flowBest: w.tunnel?.flowBest ?? 0,
        bestChain: w.tunnel?.bestChain ?? 0,
        sections: w.tunnel?.sectionsCleared ?? 0,
        nearMisses: w.tunnel?.nearMisses ?? 0,
        bestMultiplier: w.tunnel?.bestMultiplier ?? 1,
    };
    save.xp = fromXp + xp;
    save.acorns += w.runAcorns;
    // lifetime tallies for the Profile screen: these only ever grow
    save.runs = (save.runs ?? 0) + 1;
    save.lifetimeAcorns = (save.lifetimeAcorns ?? 0) + w.runAcorns;
    if (w.flight === "deep")
        save.deepBest = Math.max(save.deepBest, w.score);
    else if (w.flight === "lost")
        save.lostBest = Math.max(save.lostBest, w.score);
    else if (w.flight === "arcade")
        save.arcadeBest = Math.max(save.arcadeBest, w.score);
    else if (w.flight === "tunnel")
        save.tunnelBest = Math.max(save.tunnelBest, w.score);
    else
        save.highScore = Math.max(save.highScore, w.score);
    if (w.startShieldArmed)
        save.startShield = false;
    spark(w, w.W * PHYS.squirrelX, w.squirrel.y, ["#e8dcc8", "#ff6a28"], 20);
    return "die";
}
export function bankDeathLevels(_w, _save) {
    /* levels are now stamped in die() */
}
export function pausePlay(w) {
    if (w.screen !== "play" || w.tut)
        return;
    w.pausedFrom = "play";
    w.screen = "pause";
}
export function resumePlay(w) {
    if (w.screen !== "pause")
        return;
    w.screen = "play";
    w.pausedFrom = null;
}
export function updateWorld(w, save, dt) {
    w.time += dt;
    if (w.shake > 0)
        w.shake = Math.max(0, w.shake - dt * 2.4);
    for (const s of w.stars)
        s.tw += dt * 2;
    if (w.screen === "pause" || w.screen === "lvldone")
        return null;
    if (w.screen === "dead") {
        w.deadTimer += dt;
        w.squirrel.vy += PHYS.gravity * dt * 0.55;
        w.squirrel.y += w.squirrel.vy * dt;
        w.squirrel.rot = Math.min(1.2, w.squirrel.rot + dt * 2);
    }
    for (const p of w.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "flame")
            p.vy -= 40 * dt; // exhaust rises as it fades
        if (p.spin)
            p.hue = (p.hue || 0) + p.spin * dt * 40;
    }
    w.particles = w.particles.filter((p) => p.life > 0);
    if (w.screen !== "play")
        return null;
    if (w.race) {
        // The ready overlay is outside race time: neither its authority tick nor
        // its physics may advance until a positive hold or drop launches the run.
        if (w.ready)
            return null;
        const result = stepRace(w.race);
        const viewport = raceViewport(w.W, w.H);
        w.squirrel.y = raceViewportY(viewport, w.race.y);
        w.squirrel.vy = w.race.vy * viewport.scale;
        w.squirrel.rot = Math.max(-0.48, Math.min(0.72, w.race.vy / 720));
        w.speed = w.race.speed;
        w.distance = w.race.coursePosition;
        w.runAcorns = w.race.acorns;
        w.score = w.race.ringLedger.filter((s) => s === "passed").length;
        if (w.lvl) {
            w.lvl.stats.acorns = w.race.acorns;
            w.lvl.stats.finishTicks = w.race.finishTicks ?? 0;
        }
        if (result.finished && w.lvl) {
            settleLevel(w, save, true);
            return "finish";
        }
        return result.sound;
    }
    if (w.tut) {
        w.tut.t += dt;
        if (w.tut.stage === "intro" && w.tut.t > 0.55) {
            w.tut.stage = "tap";
            w.tut.hold = true;
            w.tut.t = 0;
        }
        if (w.tut.stage === "tapdone" && w.tut.t > 0.55) {
            w.tut.stage = "tap2";
            w.tut.hold = true;
            w.tut.t = 0;
        }
        if (w.tut.stage === "glide") {
            // the touchdown was computed for 0.9s out; a missed beat (odd frame
            // pacing, a resize) must not strand the lesson — spring anyway. The
            // world itself is never rearranged.
            if (w.bounceUp && !w.tut.bounced) {
                w.tut.bounced = true;
                w.tut.stage = "bounce";
                w.tut.t = 0;
                w.squirrel.vy = -640;
            }
            else if (w.tut.t > 1.6 || w.squirrel.y > w.H * 0.82) {
                w.tut.bounced = true;
                w.tut.stage = "bounce";
                w.tut.t = 0;
                w.bounceUp = false;
                w.squirrel.vy = -640;
            }
        }
        if (w.tut.stage === "bounce") {
            // freeze at the top of the launch — and if the apex is still low
            // (a floor-level rescue), boing again, so the swipe prompt always
            // arrives with real room to dive below
            if (w.squirrel.vy > -60 || w.tut.t > 1.1) {
                if (w.squirrel.y > w.H * 0.55 && w.tut.springs < 5) {
                    w.tut.springs += 1;
                    w.squirrel.vy = -640;
                    w.tut.t = 0;
                }
                else {
                    w.tut.stage = "swipe";
                    w.tut.hold = true;
                    w.tut.t = 0;
                }
            }
        }
        if (w.tut.stage === "dive" && (w.tut.gates - w.tut.gateBase >= 1 || w.tut.t > 3)) {
            w.tut.stage = "yourturn";
            w.tut.hold = true;
            w.tut.t = 0;
            w.tut.gates = 0;
        }
        if (w.tut.stage === "gates" && !save.tutorialDone) {
            // controls are learned the moment gate practice begins — persist
            // NOW, so quitting mid-tutorial never re-runs it on the next load
            save.tutorialDone = true;
            writeSave(save);
        }
        if (w.tut.stage === "gates" && w.tut.gates >= 3) {
            w.tut.stage = "pal";
            w.tut.hold = true;
            w.tut.t = 0;
        }
        if (w.tut.stage === "pal" && !w.tut.hold && w.tut.t > 0.2) {
            w.tut.stage = "palDemo";
            w.tut.t = 0;
        }
        if (w.tut.stage === "palDemo" && w.tut.t > 4.2) {
            w.tut.stage = "ready";
            w.tut.t = 0;
        }
        if (w.tut.stage === "ready" && w.tut.t > 1.6) {
            w.tut.stage = "free";
            save.tutorialDone = true;
        }
    }
    // TAP TO FLY means exactly that: until the first tap the run is held
    // still. The banner was being shown while gravity and the scroll were
    // already running, so a player who read it before tapping was already
    // falling. w.time still advances above, so the pilot idles and the
    // world breathes — it just does not move or pull.
    // the tail keeps swinging through freezes and warps — it is the
    // pilot's own motion, not the world's
    w.tailV += (-TAIL.stiffness * w.tailA - TAIL.damping * w.tailV) * dt;
    w.tailA += w.tailV * dt;
    if (w.tailA > TAIL.maxA) {
        w.tailA = TAIL.maxA;
        w.tailV *= -0.35;
    }
    if (w.tailA < -TAIL.maxA) {
        w.tailA = -TAIL.maxA;
        w.tailV *= -0.35;
    }
    if (TAP_ANIM_ENABLED && w.tapAnimT >= 0) {
        const tapDt = dt * paceOf(save, w);
        w.tapAnimT += tapDt * w.tapAnimDir;
        if (w.tapAnimDir < 0 && w.tapAnimT <= 0) {
            // rewound to the start: bounce and play the whole beat to the end
            w.tapAnimT = 0;
            w.tapAnimDir = 1;
        }
        else if (w.tapAnimT >= TAP_ANIM_DURATION) {
            w.tapAnimT = -1;
            w.tapAnimDir = 1;
        }
    }
    if (BOUNCE_ANIM_ENABLED && w.bounceAnimT >= 0) {
        w.bounceAnimT += dt * paceOf(save, w);
        if (w.bounceAnimT >= BOUNCE_ANIM_DURATION) {
            w.bounceAnimT = -1;
            w.bounceAnimDir = 0;
            w.bounceAnimStrength = 0;
        }
    }
    const frozen = w.ready || (w.tut?.hold ?? false) || w.shieldFreeze > 0;
    if (w.shieldFreeze > 0)
        w.shieldFreeze = Math.max(0, w.shieldFreeze - dt);
    if (w.flight === "deep" && w.warpT <= 0 && w.warpLeft <= 0) {
        w.deepTimer += dt;
        if (w.deepTimer >= 10)
            startSwirl(w, "shift");
    }
    if (w.warpT > 0) {
        w.warpT = Math.max(0, w.warpT - dt * (w.flight === "deep" ? 2 : 1));
        // the games swap at the fold's midpoint, while the screen is edge-on,
        // so you never see one dissolve into the other
        if (w.retroPending && w.warpT <= 0.5) {
            w.retroPending = false;
            w.retro = !w.retro;
            w.recoveryMsg = w.retro ? "TIMELINE: ARCADE" : "TIMELINE: ILLUSTRATED";
        }
        if (w.warpT === 0) {
            if (w.warpKind === "timeline")
                w.warpKind = null;
            else
                enterWarp(w, save);
        }
    }
    else if (w.warpLeft > 0) {
        w.warpLeft = Math.max(0, w.warpLeft - dt);
        if (w.warpLeft === 0)
            exitWarp(w);
    }
    if (frozen || w.warpT > 0)
        return null;
    let slow = w.powerLeft > 0 ? PHYS.slowFactor : 1;
    if (w.shieldSlow > 0) {
        w.shieldSlow = Math.max(0, w.shieldSlow - dt);
        slow *= 0.55;
        if (w.shieldSlow <= 0)
            w.recoveryMsg = "";
    }
    if (w.flight === "lost") {
        w.driftPhase += dt * 0.7;
        w.driftFactor = 1 + 0.4 * (0.62 * Math.sin(w.driftPhase * 0.42) + 0.38 * Math.sin(w.driftPhase * 0.11 + 2.1));
        w.tiltPhase += dt * 0.45;
        w.warpTilt = lostTiltAt(w.tiltPhase);
    }
    // Thrill Seeker doubles the WORLD's clock, not the wall clock. Everything
    // the player reacts to — scroll, gravity, the arc of a tap, the gates'
    // sway — runs off simDt and so runs twice as fast. Power-up timers below
    // tick on plain dt, so a freeze still lasts its full 3.5 seconds; you
    // just cover twice the ground in it. And because `slow` multiplies in
    // here, freezing still halves the pace you are actually flying at rather
    // than dropping you back to normal speed.
    const simDt = dt * slow * paceOf(save, w);
    if (w.powerLeft > 0)
        w.powerLeft = Math.max(0, w.powerLeft - dt);
    if (w.invulnLeft > 0)
        w.invulnLeft = Math.max(0, w.invulnLeft - dt);
    if (w.absorbGrace > 0)
        w.absorbGrace = Math.max(0, w.absorbGrace - simDt);
    // the tap animation belongs to the world's clock, not the wall's, so it
    // keeps up with the pilot under Thrill Seeker
    if (w.flapBoost > 0)
        w.flapBoost = Math.max(0, w.flapBoost - dt * paceOf(save, w));
    // a live exhaust plume: the trail keeps streaming between taps instead
    // of puffing once and dying, so every trail reads as an engine
    w.trailT = (w.trailT ?? 0) + dt;
    if (!w.ready && w.trailT > 0.085) {
        w.trailT = 0;
        spawnTrail(w, save, 0.45);
    }
    if (w.hitCooldown > 0)
        w.hitCooldown = Math.max(0, w.hitCooldown - simDt);
    if (w.envMsgT > 0)
        w.envMsgT = Math.max(0, w.envMsgT - dt);
    if (w.lvl)
        w.lvl.strobeT += dt;
    if (w.flight === "tunnel" && w.tunnel)
        return updateTunnel(w, save, simDt, dt);
    const d = difficulty(w);
    w.speed = d.speed;
    w.squirrel.vy += gravOf(save, w) * simDt;
    w.squirrel.y += w.squirrel.vy * simDt;
    w.squirrel.rot = Math.max(-0.55, Math.min(0.95, w.squirrel.vy / 700));
    const move = w.speed * w.driftFactor * simDt;
    w.distance += Math.abs(move);
    for (const p of w.planets) {
        p.x -= move;
        // how FAST the gate sways. Free Flight breathes at about half the
        // rate — the travel was right, the frequency read as fidgety.
        // Rough Air doubles how FAST a gate sways as well as how far, so the
        // two together read as turbulence rather than a slow deep breath.
        const driftRate = (palId(save, w) === "wisp" ? 1.7 : w.flight === "fly" ? 0.5 : 1.05)
            * (w.flight === "fly" && save.roughAir && modsLive(save, w) ? 2 : 1)
            * (w.lvl?.def.fx.driftRate ?? 1);
        p.drift += simDt * driftRate;
    }
    for (const a of w.pickups) {
        a.x -= move;
        a.bob += dt * 4;
    }
    w.lastSpawnX -= move;
    const lineReached = !!w.lvl && w.score >= w.lvl.def.gates;
    if (!lineReached) {
        while (w.lastSpawnX < w.W + 90)
            spawnPair(w, save, w.lastSpawnX + nextGapSpacing(w));
    }
    else if (w.lvl && !w.lvl.portal) {
        // the last gate is passed: the field goes quiet and the FINISH portal
        // stands alone in clear sky — an arrival, not another obstacle
        w.lvl.portal = true;
        w.pickups.push({
            x: Math.max(w.lastSpawnX + nextGapSpacing(w), w.W + 140),
            y: w.H * 0.45,
            got: false,
            bob: 0,
            kind: "portal",
            r: 64,
        });
    }
    w.planets = w.planets.filter((p) => p.x > -90);
    w.pickups = w.pickups.filter((a) => a.x > -50 && !a.got);
    const targetEnv = envIndexFor(w, w.score);
    if (targetEnv !== w.envB) {
        w.envA = w.envB;
        w.envB = targetEnv;
        w.envBlend = 0;
        w.envMsgT = 2.2;
        // the Profile screen counts zones the pilot has actually reached
        const zone = ENVS[targetEnv]?.name;
        if (zone && !save.zonesSeen.includes(zone))
            save.zonesSeen.push(zone);
    }
    if (w.envBlend < 1)
        w.envBlend = Math.min(1, w.envBlend + dt * 0.55);
    const sx = w.W * PHYS.squirrelX;
    const sy = w.squirrel.y;
    for (const p of w.planets) {
        if (!p.scored && p.x + p.r < sx - 12) {
            p.scored = true;
            w.score += 1;
            if (w.tut && (w.tut.stage === "gates" || w.tut.stage === "dive" || w.tut.stage === "palDemo"))
                w.tut.gates += 1;
        }
    }
    const pal = palId(save, w);
    const tx = sx - 42;
    const ty = sy - 22 + Math.sin(w.time * 2.6) * 7;
    const k = Math.min(1, dt * (w.palPos.dart > 0 ? 14 : 5));
    w.palPos.x += (tx - w.palPos.x) * k;
    w.palPos.y += (ty - w.palPos.y) * k;
    if (w.palPos.dart > 0)
        w.palPos.dart = Math.max(0, w.palPos.dart - dt);
    if (pal === "buddy" || (w.tut && (w.tut.stage === "palDemo" || w.tut.stage === "ready"))) {
        // Pull at a fixed speed, not in proportion to the distance. A
        // proportional pull looks right and never lands: the world drags the
        // acorn LEFT at w.speed while the magnet drags it right at dx * 4.2, so
        // it settles where those cancel — about speed / 4.2, which is 39px at
        // the opening pace and grows from there. The pickup radius is 28. Every
        // acorn the buddy touched parked just out of reach and rode along for
        // the rest of the run, and because it never scrolled off it was never
        // culled either.
        const pull = Math.max(360, w.speed * 2.2);
        for (const a of w.pickups) {
            if (a.got || a.kind !== "acorn")
                continue;
            const dy = sy - a.y;
            const dx = sx - a.x;
            const d = Math.hypot(dx, dy);
            if (d < PHYS.magnetR) {
                const step = Math.min(d, pull * dt);
                a.x += (dx / (d || 1)) * step;
                a.y += (dy / (d || 1)) * step;
                a.pulled = true;
            }
        }
    }
    // Ceiling bounces you back down — only debris is lethal up there.
    if (sy < PHYS.squirrelR && w.squirrel.vy < 0) {
        w.squirrel.y = PHYS.squirrelR;
        w.squirrel.vy = Math.abs(w.squirrel.vy) * 0.45 + 90;
        w.squirrel.rot = 0.5;
        spark(w, sx, 4, ["#e8dcc8", "#fff"], 8, "poof");
    }
    if (sy > w.H + 36) {
        if (tutSafe(w)) {
            const st = w.tut.stage;
            if (st === "dive" || st === "gates" || st === "palDemo") {
                // practice time: scoop them straight back onto the flight line
                // rather than let them flounder along the floor
                tutReset(w, sx, w.H + 10);
            }
            else {
                w.squirrel.y = Math.max(24, Math.min(w.H - 24, w.squirrel.y));
                w.squirrel.vy *= -0.4;
            }
        }
        else if (w.shieldCharges > 0) {
            absorb(w);
            return "shield";
        }
        else
            return die(w, save);
    }
    const sr = PHYS.squirrelR;
    if (w.absorbGrace <= 0 && w.invulnLeft <= 0) {
        for (const p of w.planets) {
            for (const b of p.blockers) {
                const bx = p.x + b.xOff;
                const by = b.y + Math.sin(p.drift) * p.driftAmp;
                if (circleHit(sx, sy, sr, bx, by, b.r * 0.92)) {
                    if (w.shieldCharges > 0) {
                        absorb(w, bx, by);
                        return "shield";
                    }
                    if (tutSafe(w)) {
                        if (w.hitCooldown <= 0 && w.shieldFreeze <= 0)
                            tutReset(w, bx, by);
                        continue;
                    }
                    return die(w, save);
                }
            }
        }
    }
    // Golden invuln phases debris only. Planet bounces stay live (live PR #42).
    for (const p of w.planets) {
        const gy = liveGapY(p);
        const topY = gy - p.gap / 2 - p.r;
        const botY = gy + p.gap / 2 + p.r;
        for (const py of [topY, botY]) {
            if (!circleHit(sx, sy, sr, p.x, py, p.r * 0.92))
                continue;
            if (w.hitCooldown <= 0) {
                if (w.shieldCharges > 0 && w.tut?.stage === "free") {
                    /* planets bounce even with a shield — shields save debris / fall */
                }
                bounceOff(w, save, p.x, py);
                return "bounce";
            }
            pushOut(w, p.x, py, p.r * 0.92, sr);
        }
    }
    let snd = null;
    for (const a of w.pickups) {
        if (a.got)
            continue;
        const ay = a.y + Math.sin(a.bob) * 4;
        if (Math.hypot(sx - a.x, sy - ay) > (a.r ?? 28))
            continue;
        a.got = true;
        if (a.kind === "acorn") {
            w.runAcorns += pal === "nutsack" ? 2 : 1;
            if (w.lvl)
                w.lvl.stats.acorns += pal === "nutsack" ? 2 : 1;
            if (a.pulled) {
                w.palPos.x = a.x;
                w.palPos.y = a.y;
                w.palPos.dart = 0.35;
            }
            spark(w, a.x, ay, ["#ffd060", "#fff"], 10, "gold");
            snd = "acorn";
        }
        else if (a.kind === "slow") {
            w.powerLeft = PHYS.powerDuration * (pal === "cometsprite" ? 2 : 1);
            spark(w, a.x, ay, ["#6ef0ff", "#fff"], 12, "cyan");
            snd = "gold";
        }
        else if (a.kind === "gold") {
            if (w.lvl)
                w.lvl.stats.gold += 1;
            w.invulnLeft = PHYS.goldDuration * (pal === "starpup" ? 2 : 1);
            spark(w, a.x, ay, ["#ffe080", "#ffd060"], 14, "gold");
            snd = "gold";
        }
        else if (a.kind === "shield") {
            if (pal !== "nutsack" && pal !== "tinbot") {
                const cap = save.battery ? 3 : 1;
                w.shieldCharges = Math.min(cap, w.shieldCharges + 1);
            }
            spark(w, a.x, ay, ["#7ad8ff", "#5dff9e"], 12, "shield");
            snd = "shield";
        }
        else if ((a.kind === "hole" || a.kind === "worm") && w.warpT <= 0 && w.warpLeft <= 0) {
            startSwirl(w, a.kind === "worm" ? "worm" : "hole");
            snd = "shield";
        }
        else if (a.kind === "portal" && w.lvl) {
            spark(w, a.x, ay, ["#ffd060", "#5dff9e", "#fff"], 26, "warp");
            settleLevel(w, save, true);
            return "shift";
        }
        else if (a.kind === "retro" && w.warpT <= 0) {
            // Through the fold and out the other side, in the other game. The
            // crossing borrows the wormhole's swirl so it reads as a crossing,
            // but it leaves no warp behind it: nothing about the flight changes,
            // only who is drawing it.
            w.retroShifts++;
            w.retroPending = true;
            startSwirl(w, "timeline");
            spark(w, a.x, ay, ["#ffd060", "#fff", "#b45cff"], 20, "warp");
            snd = "shift";
        }
    }
    return snd;
}
export function snapshot(w) {
    return {
        screen: w.screen,
        score: w.score,
        runAcorns: w.runAcorns,
        envName: ENVS[w.envB]?.name ?? "DEEP SPACE",
        flight: w.flight,
        powerLeft: w.powerLeft,
        invulnLeft: w.invulnLeft,
        shieldCharges: w.shieldCharges,
        scoreMultiplier: w.tunnel?.multiplier ?? 1,
        multiplierLeft: w.tunnel?.multiplierLeft ?? 0,
        recoveryMsg: w.recoveryMsg,
        tutStage: w.tut?.stage ?? null,
        tutHold: !!w.tut?.hold,
        tutNudge: w.tut?.nudge ?? "",
        dead: w.lastRun,
        squirrel: { y: w.squirrel.y, rot: w.squirrel.rot, vy: w.squirrel.vy },
    };
}
