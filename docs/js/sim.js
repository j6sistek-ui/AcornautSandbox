import { MIN_SEP, sep, PLANET_RGB, SKY_RGB, DEBRIS_COUNT, PLANET_COUNT, ENVS, ENV_GATES, RETRO_GATE, TAIL, skyIdFor, PHYS, TRAILS, TUT_ARM, levelForXp, runXp } from "./catalog.js?v=50";
import { writeSave } from "./save.js?v=50";
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
        stars: [],
        speed: PHYS.baseSpeed,
        distance: 0,
        lastSpawnX: 0,
        lastGapY: H * 0.45,
        powerLeft: 0,
        invulnLeft: 0,
        flapBoost: 0,
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
function shuffleEnv(w) {
    const mid = ENVS.map((_, i) => i).slice(1, -1);
    for (let i = mid.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mid[i], mid[j]] = [mid[j], mid[i]];
    }
    w.envOrder = [0, ...mid, ENVS.length - 1];
}
export function envIndexFor(w, score) {
    return w.envOrder[Math.min(Math.floor(score / ENV_GATES), ENVS.length - 1)];
}
function palId(save, w) {
    if (w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo"))
        return "buddy";
    return save.equippedPal;
}
function gravOf(save, w) {
    const id = palId(save, w);
    return PHYS.gravity * (id === "pocketmoon" ? 0.85 : id === "nutsack" ? 1.2 : 1);
}
function flapOf(save, w) {
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
    const step = 30;
    const put = (y, n) => blockers.push({
        y,
        r: 19 + Math.random() * 7,
        kind: pickKind(w),
        xOff: ((n % 2) * 2 - 1) * (2 + Math.random() * 5),
        debris: pickDebris(env),
    });
    let y = gapY - gap / 2 - r * 2 - 26;
    for (let n = 0; y > 20 && n < 12; n++, y -= step)
        put(y, n);
    y = gapY + gap / 2 + r * 2 + 26;
    for (let n = 0; y < w.H - 20 && n < 12; n++, y += step)
        put(y, n);
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
    let gap = d.gap;
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
    const pilot = palId(save, w);
    const driftAmp = pilot === "wisp" ? 26
        : w.flight === "lost" ? 12
            : w.tut ? 0
                : gap * 0.15;
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
        if (w.tut || Math.random() < 0.58) {
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
export function resetRun(w, save, flight, tutorial) {
    w.flight = flight;
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
    w.speed = PHYS.baseSpeed;
    w.distance = 0;
    w.lastSpawnX = w.W * 0.55;
    w.lastGapY = w.H * 0.45;
    w.powerLeft = 0;
    w.invulnLeft = 0;
    w.flapBoost = 0;
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
    for (let i = 0; i < 3; i++)
        spawnPair(w, save, w.W + 90 + i * nextGapSpacing(w));
    w.tut = tutorial
        ? { stage: "intro", hold: false, t: 0, gates: 0, gateBase: 0, nudge: "",
            retries: 0, springs: 0, bounced: false }
        : null;
    if (tutorial)
        buildTutorialCourse(w, save);
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
    if (w.tut?.hold && (w.tut.stage === "tap" || w.tut.stage === "tap2")) {
        w.tut.hold = false;
        w.tut.t = 0;
        w.tut.stage = w.tut.stage === "tap" ? "tapdone" : "glide";
    }
    else if (w.tut?.hold && w.tut.stage === "yourturn") {
        w.tut.hold = false;
        w.tut.stage = "gates";
        w.tut.t = 0;
        w.tut.gates = 0;
    }
    if (w.ready)
        w.ready = false;
    if (w.tut && (w.tut.stage === "glide" || w.tut.stage === "bounce"))
        return "none";
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
    const jelly = palId(save, w) === "voidjelly" ? 0.55 : 1;
    const mag = Math.min(560, 170 + Math.abs(w.squirrel.vy) * 0.5) * jelly;
    w.squirrel.vy = dy * mag + (dy >= 0 ? 90 : -160);
    w.bounceUp = w.squirrel.vy < 0;
    w.squirrel.y += dy * 14;
    w.squirrel.rot = dy >= 0 ? 0.85 : -0.55;
    w.hitCooldown = 0.55;
    w.shake = 0.18;
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
function die(w, save) {
    if (w.tut && w.tut.stage !== "free") {
        absorb(w);
        w.shieldCharges = Math.max(w.shieldCharges, 1);
        return "shield";
    }
    w.screen = "dead";
    w.deadTimer = 0;
    w.tut = null;
    w.shake = 0.35;
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
                    : w.score >= save.highScore,
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
    if (w.screen === "pause")
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
            else if (w.tut.t > 1.6) {
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
    const simDt = dt * slow;
    if (w.powerLeft > 0)
        w.powerLeft = Math.max(0, w.powerLeft - dt);
    if (w.invulnLeft > 0)
        w.invulnLeft = Math.max(0, w.invulnLeft - dt);
    if (w.absorbGrace > 0)
        w.absorbGrace = Math.max(0, w.absorbGrace - simDt);
    if (w.flapBoost > 0)
        w.flapBoost = Math.max(0, w.flapBoost - dt);
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
        const driftRate = palId(save, w) === "wisp" ? 1.7 : w.flight === "fly" ? 0.5 : 1.05;
        p.drift += simDt * driftRate;
    }
    for (const a of w.pickups) {
        a.x -= move;
        a.bob += dt * 4;
    }
    w.lastSpawnX -= move;
    while (w.lastSpawnX < w.W + 90)
        spawnPair(w, save, w.lastSpawnX + nextGapSpacing(w));
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
        recoveryMsg: w.recoveryMsg,
        tutStage: w.tut?.stage ?? null,
        tutHold: !!w.tut?.hold,
        tutNudge: w.tut?.nudge ?? "",
        dead: w.lastRun,
        squirrel: { y: w.squirrel.y, rot: w.squirrel.rot, vy: w.squirrel.vy },
    };
}
