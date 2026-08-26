import { SKY_RGB, BOUNCE_ANIM_DURATION, ENVS, PHYS, SUITS, TAIL, TUT_ARM, TAP_ANIM_DURATION, TAP_ANIM_ENABLED, helmetWornBy, skyIdFor, washScale, wearsOwnHead } from "./catalog.js?v=145";
import { drawTrailPreviewOn, drawPalOn, drawAstronautOn } from "./cosmetics.js?v=145";
import { proceduralSky, hueShifted } from "./sky-gen.js?v=145";
import { drawSprite, skyImage, spriteHalo, SPRITE_HALO_PAD } from "./art.js?v=145";
import { retroBackdrop, retroPlanet, retroObstacle, retroAcorn, retroBlocker } from "./retro.js?v=145";
import { blockerX, gateOffset, liveGapY, tiltNow, tunnelBoundsAt, WORM_TRIP_SECONDS } from "./sim.js?v=145";
import { WORM_EXIT_LEAD, suitLean, SUIT_LEAN_DEFAULT } from "./control-constants.js?v=145";
import { raceViewport, raceViewportX, raceViewportY } from "./race-viewport.js?v=145";
import { RACE_ACORNS, RACE_BASE_SPEED, RACE_DEBRIS, RACE_ENTRY_TICKS, RACE_GATE_CLEARANCE, RACE_GATE_MISS_FADE_TICKS, RACE_GATE_PASS_FADE_TICKS, RACE_HZ, RACE_LENGTH, RACE_MAX_INTERACTIVE_GAP, RACE_MAX_SPEED, RACE_PILOT_X, RACE_READY_COPY, RACE_RETURN_TICKS, RACE_RINGS, RACE_TUNNEL_PERFECT_APERTURE, RACE_TUNNEL_RING_APERTURE, RACE_TUNNEL_SPEED, RACE_TUNNEL_TICKS, formatRaceTicks, raceDecisionAge, raceRouteTarget, raceTunnelGeometry, raceTunnelQuality, raceTunnelRings, } from "./race.js?v=145";
function frameOf(list, t, speed = 6) {
    if (!list.length)
        return null;
    return list[Math.floor(t * speed) % list.length];
}
function applyWarp(ctx, w) {
    const lost = w.flight === "lost";
    const wp = w.warpT > 0 ? 1 - w.warpT : w.warpLeft > 0 || w.warpGateEnd >= 0 || lost ? 1 : 0;
    if (wp <= 0)
        return;
    ctx.translate(w.W / 2, w.H / 2);
    const spin = w.warpT > 0 ? Math.sin(wp * Math.PI) * 2.6 : 0;
    // tiltNow is the settled lean, shared with the gate edge limit so the two
    // can never disagree; the fold's spin is this painter's own flourish
    ctx.rotate(tiltNow(w) + spin);
    const mFrom = w.prevMirror ? -1 : 1;
    const mTo = w.warpMirror ? -1 : 1;
    ctx.scale(mFrom + (mTo - mFrom) * wp, 1);
    ctx.translate(-w.W / 2, -w.H / 2);
}
function coverDraw(ctx, img, W, H, pan = 0.5) {
    // a procedural sky is already composed for this exact canvas.
    // `pan` slides the visible window across whatever the cover-crop cannot
    // show: 0 = left/top edge, 1 = right/bottom edge, 0.5 = the old centre.
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    const scale = Math.max(W / Math.max(1, sw), H / Math.max(1, sh));
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(img, (W - dw) * pan, (H - dh) * 0.5, dw, dh);
}
/** How bright the sky is right now, across an environment crossfade. */
export function skyLuma(w) {
    const lum = (id) => {
        const c = SKY_RGB[id] ?? [0.1, 0.1, 0.2];
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const a = lum(skyIdFor(w.flight, w.envA));
    const b = lum(skyIdFor(w.flight, w.envB));
    return a + (b - a) * w.envBlend;
}
// Rotate an [r,g,b,a] wash around the colour wheel, alpha untouched. The
// saturation lift matches the one the plate gets, so the wash and the sky
// under it land on the same new colour instead of two nearby ones.
function rotateRgb(c, deg) {
    const [r, g, bl] = c;
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    const d = mx - mn;
    let h = 0;
    if (d) {
        h = mx === r ? ((g - bl) / d) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
    }
    const l = (mx + mn) / 2 / 255;
    const sNow = d === 0 ? 0 : d / 255 / (1 - Math.abs(2 * l - 1) || 1);
    const sat = Math.min(1, sNow * 1.75);
    h = (((h + deg) % 360) + 360) % 360;
    const cc = (1 - Math.abs(2 * l - 1)) * sat;
    const x = cc * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - cc / 2;
    const seg = Math.floor(h / 60) % 6;
    const t = [[cc, x, 0], [x, cc, 0], [0, cc, x], [0, x, cc], [x, 0, cc], [cc, 0, x]];
    const [rr, gg, bb] = t[seg];
    return [(rr + m) * 255, (gg + m) * 255, (bb + m) * 255, c[3]];
}
function drawBackdrop(ctx, w, art) {
    const { W, H } = w;
    // Each environment flies under its own sky; shifts crossfade. In the
    // BETA the ten normal-mode environments render PROCEDURALLY from their
    // recipes (sky-gen.ts) — the painted file is never even fetched — while
    // Deep and Lost's dark plates have no recipe and stay painted.
    // Deep and Lost fly under ONE wide painting in the beta, whatever the
    // orientation: landscape sees the full 16:9, portrait sees a window that
    // DRIFTS across it over the run, and a rotation only resizes the window
    // instead of swapping the art. The portrait dark plates stay shipped as
    // the live game's source and the beta's fallback while a wide file loads.
    const wideDark = w.flight === "deep" || w.flight === "lost";
    const idA = skyIdFor(w.flight, w.envA);
    const idB = skyIdFor(w.flight, w.envB);
    const procA = proceduralSky(idA, W, H);
    const procB = proceduralSky(idB, W, H);
    // PRISMWING repaints the PROCEDURAL plate and nothing else. A painted
    // sky is a photograph of a place and rotating its hue makes it look
    // broken, so those are left alone - which is also why the effect is
    // described as procedural-only rather than universal.
    const hue = w.prismHue || 0;
    const skyA = (hue && procA ? hueShifted(procA, idA, hue) : procA)
        ?? (wideDark ? skyImage(idA + "-wide") : null) ?? skyImage(idA);
    const skyB = (hue && procB ? hueShifted(procB, idB, hue) : procB)
        ?? (wideDark ? skyImage(idB + "-wide") : null) ?? skyImage(idB);
    // a slow triangle wave: out and back, never a snap
    const drift = (w.time * 0.012) % 2;
    const pan = wideDark ? 1 - Math.abs(1 - drift) : 0.5;
    const painted = skyB ?? skyA;
    if (painted) {
        coverDraw(ctx, skyA ?? painted, W, H, pan);
        if (skyB && skyA && skyB !== skyA && w.envBlend > 0) {
            ctx.globalAlpha = w.envBlend;
            coverDraw(ctx, skyB, W, H, pan);
            ctx.globalAlpha = 1;
        }
        // Readability scrim, scaled to how bright this sky is: a white
        // nebula gets a real veil so gates and debris stay readable against
        // it, a black void barely any. This is what stops the white-on-white
        // blindness without dulling the art everywhere.
        const lum = skyLuma(w);
        // A plate that is already void-dark needs almost no scrim — flooring
        // it at 0.16 only greys out the nebula it was chosen for.
        const floor = Math.min(0.16, lum * 0.8);
        const veil = Math.max(floor, Math.min(0.52, 0.16 + (lum - 0.2) * 0.62));
        ctx.fillStyle = `rgba(7,11,22,${veil.toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
    }
    else if (art.sky) {
        coverDraw(ctx, art.sky, W, H);
        ctx.fillStyle = "rgba(7,11,22,0.28)";
        ctx.fillRect(0, 0, W, H);
    }
    else {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#070b18");
        g.addColorStop(1, "#10182c");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
    const env = ENVS[w.envB];
    const envA = ENVS[w.envA];
    const blend = w.envBlend;
    const ws = washScale(w.flight);
    // PRISMWING again. The procedural plate carries the hue, but in flight
    // that plate sits under this colour wash and the readability scrim, and
    // those are what the eye actually reads - rotating the plate alone
    // measured as a 3-point shift in mean colour, which is why the owner
    // reported it as not working at all. The wash is backdrop, exactly like
    // the plate, so it turns with it. Planets and debris still do not.
    const spin = (c) => (w.prismHue ? rotateRgb(c, w.prismHue) : c);
    const wash = spin(env.wash.map((v, i) => (envA.wash[i] + (v - envA.wash[i]) * blend) * (i === 3 ? ws : 1)));
    ctx.fillStyle = `rgba(${wash[0]},${wash[1]},${wash[2]},${wash[3]})`;
    ctx.beginPath();
    ctx.ellipse(W * 0.68, H * 0.28, W * 0.55, H * 0.28, 0.25, 0, Math.PI * 2);
    ctx.fill();
    const wash2 = spin(env.wash2.map((v, i) => (envA.wash2[i] + (v - envA.wash2[i]) * blend) * (i === 3 ? ws : 1)));
    ctx.fillStyle = `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${wash2[3]})`;
    ctx.beginPath();
    ctx.ellipse(W * 0.22, H * 0.78, W * 0.45, H * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // the environment owns the WHOLE sky, not two soft pools — a graded
    // full-screen tint makes each 20-gate shift unmistakable
    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.42, wash[3] * 1.9)})`);
    grade.addColorStop(0.55, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.2, wash[3] * 0.9)})`);
    grade.addColorStop(1, `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${Math.min(0.4, wash2[3] * 2.2)})`);
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);
    for (const s of w.stars) {
        ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(s.tw));
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}
/** A gate may use its paintings only as registered back/front pairs. Resolved
 * gates also need the idle pair because both states share the crossfade. */
export function hyperRunGateUsesPaintedPairs(hyperRun, state) {
    const pairComplete = (pairState) => !!hyperRun[`gate-${pairState}-back`] && !!hyperRun[`gate-${pairState}-front`];
    return pairComplete("idle") && (state === "idle" || pairComplete(state));
}
export const HYPER_RUN_GATE_FALLBACK_GEOMETRY = {
    shape: "full-ring",
    backStart: 0,
    backEnd: Math.PI * 2,
    frontStart: Math.PI * 0.2,
    frontEnd: Math.PI * 0.8,
};
const raceClamp01 = (n) => Math.max(0, Math.min(1, n));
const raceSmooth = (n) => {
    const t = raceClamp01(n);
    return t * t * (3 - 2 * t);
};
const raceSegment = (tick, start, end) => raceSmooth((tick - start) / Math.max(1, end - start));
const raceLerp = (a, b, t) => a + (b - a) * t;
/** Pure presentation schedule for the portal-free inline wormhole. Keeping the
 * enclosure and crossfade contract here lets runtime evidence exercise the
 * exact values consumed by the shipping renderer. */
export function hyperRunInlineWormholePresentation(phase, tick) {
    if (phase === "entry")
        return {
            enclosure: tick <= 11
                ? raceLerp(0, 0.08, raceSegment(tick, 0, 11))
                : tick <= 35
                    ? raceLerp(0.08, 0.88, raceSegment(tick, 12, 35))
                    : raceLerp(0.88, 1, raceSegment(tick, 36, RACE_ENTRY_TICKS - 1)),
            energyAlpha: raceSegment(tick, 0, 11),
            courseAlpha: 1 - raceSegment(tick, 20, RACE_ENTRY_TICKS - 1),
        };
    if (phase === "return")
        return {
            enclosure: tick <= 5 ? 1 : 1 - raceSegment(tick, 6, RACE_RETURN_TICKS - 1),
            energyAlpha: tick <= 11 ? 1 : 1 - raceSegment(tick, 12, RACE_RETURN_TICKS - 1),
            courseAlpha: raceSegment(tick, 6, 23),
        };
    return { enclosure: 1, energyAlpha: 1, courseAlpha: 0 };
}
/** Hyper Run ring paintings are registered to their complete square canvas.
 * Generic drawSprite deliberately alpha-fits other art; using it here would
 * independently enlarge and recenter the gate's small foreground arc. */
function drawRaceSprite(ctx, art, id, x, y, size, tilt = 0, alpha = 1) {
    const sprite = art.hyperRun[id];
    if (!sprite)
        return false;
    if (alpha <= 0)
        return true;
    const sw = sprite.naturalWidth || sprite.width;
    const sh = sprite.naturalHeight || sprite.height;
    ctx.save();
    ctx.globalAlpha *= raceClamp01(alpha);
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.drawImage(sprite, 0, 0, sw, sh, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
}
function drawRaceGateFallback(ctx, state, layer, x, y, size, tilt, alpha) {
    if (alpha <= 0)
        return;
    const palette = state === "passed"
        ? { rim: "#7fffd4", edge: "#fff0a5" }
        : state === "missed"
            ? { rim: "#a47a50", edge: "#79c9d7" }
            : { rim: "#65dcff", edge: "#b5a0ff" };
    const r = size * 0.422;
    ctx.save();
    ctx.globalAlpha *= raceClamp01(alpha);
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.lineCap = "round";
    if (layer === "back") {
        // A complete rear ring provides the structural silhouette. The pilot is
        // painted over it; only the small lower lip is restored in the front pass.
        ctx.strokeStyle = palette.rim;
        ctx.lineWidth = Math.max(2, size * 0.11);
        ctx.shadowColor = palette.rim;
        ctx.shadowBlur = size * 0.06;
        ctx.beginPath();
        ctx.arc(0, 0, r, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backStart, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backEnd);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = Math.max(1, size * 0.018);
        ctx.beginPath();
        ctx.arc(0, 0, r - size * 0.052, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backStart, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backEnd);
        ctx.stroke();
    }
    else {
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = Math.max(2, size * 0.115);
        ctx.shadowColor = palette.rim;
        ctx.shadowBlur = size * 0.075;
        ctx.beginPath();
        ctx.arc(0, 0, r, HYPER_RUN_GATE_FALLBACK_GEOMETRY.frontStart, HYPER_RUN_GATE_FALLBACK_GEOMETRY.frontEnd);
        ctx.stroke();
    }
    ctx.restore();
}
function drawRaceGateLayer(ctx, art, state, layer, x, y, size, tilt, alpha = 1, usePaintings = true) {
    if (usePaintings && drawRaceSprite(ctx, art, `gate-${state}-${layer}`, x, y, size, tilt, alpha))
        return;
    drawRaceGateFallback(ctx, state, layer, x, y, size, tilt, alpha);
}
function raceGateVisual(race, i) {
    const ledger = race.ringLedger[i];
    if (ledger === "skipped")
        return null;
    if (ledger !== "passed" && ledger !== "missed") {
        return { state: "idle", blend: 1 };
    }
    const decisionTick = race.ringDecisionTicks[i];
    if (decisionTick == null)
        return { state: ledger, blend: 1 };
    // race.tick names the next pre-increment step after rendering. A decision
    // stamped during the just-completed step therefore has visual age zero.
    const age = raceDecisionAge(race.tick, decisionTick);
    const duration = ledger === "passed" ? RACE_GATE_PASS_FADE_TICKS : RACE_GATE_MISS_FADE_TICKS;
    return { state: ledger, blend: raceClamp01(age / duration) };
}
function drawRaceGateVisualLayer(ctx, art, gate, layer, size) {
    const usePaintings = hyperRunGateUsesPaintedPairs(art.hyperRun, gate.state);
    if (gate.state === "idle") {
        drawRaceGateLayer(ctx, art, "idle", layer, gate.x, gate.y, size, gate.tilt, 1, usePaintings);
        return;
    }
    if (gate.blend < 1) {
        drawRaceGateLayer(ctx, art, "idle", layer, gate.x, gate.y, size, gate.tilt, 1 - gate.blend, usePaintings);
    }
    if (gate.blend > 0) {
        drawRaceGateLayer(ctx, art, gate.state, layer, gate.x, gate.y, size, gate.tilt, gate.blend, usePaintings);
    }
}
const raceFlowScratch = Array.from({ length: 48 }, () => ({
    layer: "far", x: 0, sourceY: 0, y: 0, length: 0, width: 0, alpha: 0, bend: 0,
}));
const raceMod = (n, d) => ((n % d) + d) % d;
const raceFlowHash = (seed, index, salt) => {
    let x = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    return (x >>> 0) / 0x100000000;
};
/** Pure deterministic presentation data. It is exported so cadence and replay
 * tests can prove that rendering never consumes randomness or wall-clock time. */
function writeHyperRunFlow(args, samples) {
    const reduced = !!args.reducedMotion;
    const replaceWithTangents = !reduced && args.targetY != null && args.targetDistance <= RACE_MAX_INTERACTIVE_GAP ? 6 : 0;
    const counts = reduced
        ? { far: 12, mid: 8, near: 3 }
        : { far: 24, mid: 16 - replaceWithTangents, near: 8 };
    const speedMix = raceClamp01((args.speed - RACE_BASE_SPEED) / Math.max(1, RACE_MAX_SPEED - RACE_BASE_SPEED));
    const span = Math.max(1, args.virtualWidth + 160);
    let cursor = 0;
    ["far", "mid", "near"].forEach((layer, layerIndex) => {
        const parallax = layer === "far" ? 0.18 : layer === "mid" ? 0.48 : 0.82;
        const bend = layer === "mid" && !reduced && args.targetY != null && args.targetDistance <= RACE_MAX_INTERACTIVE_GAP
            ? raceLerp(0.15, 0.25, raceClamp01(1 - args.targetDistance / RACE_MAX_INTERACTIVE_GAP))
            : 0;
        for (let i = 0; i < counts[layer]; i++) {
            const xSeed = raceFlowHash(args.seed, i, 10 + layerIndex);
            const ySeed = raceFlowHash(args.seed, i, 20 + layerIndex);
            const lengthSeed = raceFlowHash(args.seed, i, 30 + layerIndex);
            const baseY = 36 + ySeed * 568 + Math.sin((args.tick + i * 17) * 0.035) * (reduced ? 0 : 2.2);
            const targetY = args.targetY ?? baseY;
            const baseLength = layer === "far" ? 8 : layer === "mid" ? 18 : 12;
            const sample = samples[cursor] ?? (samples[cursor] = {
                layer, x: 0, sourceY: 0, y: 0, length: 0, width: 0, alpha: 0, bend: 0,
            });
            sample.layer = layer;
            sample.x = -80 + raceMod(xSeed * span - args.coursePosition * parallax, span);
            sample.sourceY = baseY;
            sample.y = raceLerp(baseY, targetY, bend);
            sample.length = baseLength + speedMix * (layer === "mid" ? 34 : 20) + lengthSeed * 9;
            sample.width = layer === "far" ? 0.8 : layer === "mid" ? 1.25 : 1.5;
            sample.alpha = layer === "far" ? 0.34 : layer === "mid" ? 0.42 : 0.32;
            sample.bend = bend;
            cursor++;
        }
    });
    samples.length = cursor;
    return samples;
}
export function hyperRunFlowSnapshot(args) {
    return writeHyperRunFlow(args, []).map((sample) => ({ ...sample }));
}
function raceReducedMotion() {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function racePointSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 <= 1e-9)
        return Math.hypot(px - x1, py - y1);
    const t = raceClamp01(((px - x1) * dx + (py - y1) * dy) / l2);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
function drawRaceFlow(ctx, viewport, samples, layer, zones) {
    const { scale, left, top } = viewport;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    for (const sample of samples) {
        if (sample.layer !== layer)
            continue;
        const x1 = left + sample.x * scale;
        const x2 = x1 + sample.length * scale;
        const y1 = top + sample.y * scale;
        const y2 = top + sample.sourceY * scale;
        const guarded = zones.some((zone) => racePointSegmentDistance(zone.x, zone.y, x1, y1, x2, y2) < zone.r + 18 * scale);
        if (layer === "near" && guarded)
            continue;
        ctx.globalAlpha = guarded ? sample.alpha * 0.18 : sample.alpha;
        ctx.strokeStyle = layer === "far" ? "#b8d7ff" : layer === "mid" ? "#50d2ff" : "#d2f2ff";
        ctx.lineWidth = Math.max(0.65, sample.width * scale);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        if (sample.bend > 0) {
            ctx.quadraticCurveTo(raceLerp(x2, x1, 0.55), raceLerp(y2, y1, 0.55), x1, y1);
        }
        else {
            ctx.lineTo(x1, y1);
        }
        ctx.stroke();
    }
    ctx.restore();
}
function drawRacePendingMembrane(ctx, viewport, x, y, layer) {
    const r = RACE_GATE_CLEARANCE * viewport.scale;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    if (layer === "back") {
        const lens = ctx.createRadialGradient(x - r * 0.18, y - r * 0.22, r * 0.08, x, y, r);
        lens.addColorStop(0, "rgba(210,250,255,.18)");
        lens.addColorStop(0.68, "rgba(49,181,255,.09)");
        lens.addColorStop(1, "rgba(19,126,255,0)");
        ctx.fillStyle = lens;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = layer === "back" ? "rgba(112,221,255,.52)" : "rgba(190,247,255,.8)";
    ctx.lineWidth = Math.max(1, (layer === "back" ? 1.25 : 1.8) * viewport.scale);
    ctx.shadowColor = "rgba(48,194,255,.72)";
    ctx.shadowBlur = layer === "front" ? 5 * viewport.scale : 0;
    ctx.beginPath();
    ctx.arc(x, y, r, layer === "back" ? Math.PI : 0, layer === "back" ? Math.PI * 2 : Math.PI);
    ctx.stroke();
    ctx.restore();
}
function drawRaceDecisionCue(ctx, viewport, state, age, canonicalY, layer) {
    const { scale, pilotX } = viewport;
    const y = raceViewportY(viewport, canonicalY);
    if (state === "passed") {
        if (age > 26)
            return;
        const drift = age < 10 ? 0 : raceLerp(0, 24, raceClamp01((age - 10) / 8));
        const x = pilotX - drift * scale;
        const expansion = age <= 2 ? 0.58 : age <= 9 ? raceLerp(0.7, 1.1, (age - 3) / 6) : 1.12;
        const fade = age < 19 ? 1 : 1 - (age - 19) / 7;
        const r = 60 * scale * expansion;
        ctx.save();
        ctx.globalAlpha *= raceClamp01(fade);
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = age <= 2 ? "rgba(235,255,255,.98)" : "rgba(52,202,255,.78)";
        ctx.lineWidth = (age <= 2 ? 4 : 2.2) * scale;
        ctx.shadowColor = "#2cc9ff";
        ctx.shadowBlur = 9 * scale;
        ctx.beginPath();
        ctx.arc(x, y, r, layer === "back" ? Math.PI : 0, layer === "back" ? Math.PI * 2 : Math.PI);
        ctx.stroke();
        if (layer === "front" && age >= 10 && age <= 18) {
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2 * scale;
            for (const dy of [-11, 11]) {
                ctx.beginPath();
                ctx.moveTo(x - r - 8 * scale, y + dy * scale);
                ctx.lineTo(x - r - 18 * scale, y + dy * scale);
                ctx.lineTo(x - r - 13 * scale, y + (dy - 5) * scale);
                ctx.stroke();
            }
        }
        ctx.restore();
        return;
    }
    if (age > 26)
        return;
    const fade = age < 19 ? 1 : 1 - raceClamp01((age - 19) / 7);
    const r = RACE_GATE_CLEARANCE * scale * raceLerp(1, 0.72, raceClamp01(age / 18));
    const contract = raceSegment(age, 3, 12);
    const notchX = raceLerp(8, 4, contract) * scale;
    const notchY = raceLerp(24, 15, contract) * scale;
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.strokeStyle = layer === "back" ? "rgba(93,139,161,.6)" : "rgba(210,166,116,.86)";
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(pilotX, y, r, layer === "back" ? Math.PI : 0.08, layer === "back" ? Math.PI * 1.72 : Math.PI * 0.82);
    ctx.stroke();
    if (layer === "front") {
        ctx.beginPath();
        ctx.moveTo(pilotX - notchX, y - notchY);
        ctx.lineTo(pilotX + 3 * scale, y - 7 * scale);
        ctx.lineTo(pilotX - 4 * scale, y + 6 * scale);
        ctx.lineTo(pilotX + notchX, y + notchY);
        ctx.stroke();
    }
    ctx.restore();
}
function drawRaceDirector(ctx, viewport, pilotY, targetY, distance) {
    if (distance <= 160)
        return;
    const alpha = raceSmooth((distance - 160) / 80);
    const x = viewport.right - 18;
    const y = Math.max(viewport.top + 36, Math.min(viewport.bottom - 36, raceViewportY(viewport, targetY)));
    const delta = targetY - pilotY;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(2,8,18,.92)";
    ctx.fillStyle = "#a9f5ff";
    ctx.beginPath();
    if (Math.abs(delta) <= 24) {
        ctx.moveTo(0, -7);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-7, 0);
        ctx.closePath();
    }
    else if (delta < 0) {
        ctx.moveTo(0, -9);
        ctx.lineTo(8, 6);
        ctx.lineTo(-8, 6);
        ctx.closePath();
    }
    else {
        ctx.moveTo(0, 9);
        ctx.lineTo(8, -6);
        ctx.lineTo(-8, -6);
        ctx.closePath();
    }
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = "rgba(38,194,255,.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (Math.abs(delta) > 24) {
        const direction = delta < 0 ? 1 : -1;
        const stem = Math.min(18, 6 + Math.abs(delta) / 32);
        ctx.beginPath();
        ctx.moveTo(0, direction * 8);
        ctx.lineTo(0, direction * (8 + stem));
        ctx.stroke();
    }
    ctx.restore();
}
const raceTunnelTopScratch = [];
const raceTunnelBottomScratch = [];
export function hyperRunTunnelSampleCount(virtualWidth) {
    // Thirty segments put both canonical pilot X (96/360 = 8/30) and the
    // panoramic 20% pilot plane (6/30) on an authored boundary vertex.
    return Math.max(30, Math.ceil(Math.max(0, virtualWidth) / 48 / 30) * 30);
}
/** The shipping projection used by both ring layers. Presentation sees the
 * post-step phase tick, so the +1 keeps the pending ring one step ahead and
 * places its resolved result on the pilot plane after authority judges it.
 * Keeping this pure lets the runtime review prove the crossing at every
 * approved viewport. */
export function hyperRunTunnelRingScreenX(viewport, ringTick, viewTick) {
    return viewport.pilotX
        + (ringTick + 1 - viewTick) * (RACE_TUNNEL_SPEED / RACE_HZ) * viewport.scale;
}
function drawHyperRunTunnelRingPath(ctx, radius, layer) {
    ctx.beginPath();
    if (layer === "back")
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
    else
        ctx.arc(0, 0, radius, Math.PI * 0.2, Math.PI * 0.8);
}
function drawHyperRunTunnelRing(ctx, viewport, x, canonicalY, outcome, age, layer) {
    if (age > 27)
        return;
    const { scale } = viewport;
    const y = raceViewportY(viewport, canonicalY);
    const reduced = raceReducedMotion();
    const fade = outcome === "pending" || age <= 17
        ? 1
        : 1 - raceSegment(age, 18, 27);
    const outerRadius = RACE_TUNNEL_RING_APERTURE * scale;
    const innerRadius = RACE_TUNNEL_PERFECT_APERTURE * scale;
    const outerWidth = Math.max(1.8, 3.2 * scale);
    const innerWidth = Math.max(1.35, 2.15 * scale);
    const perfect = outcome === "perfect";
    const passed = outcome === "passed";
    const missed = outcome === "missed";
    ctx.save();
    ctx.globalAlpha *= raceClamp01(fade * (missed ? 0.68 : 1));
    ctx.translate(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (missed)
        ctx.setLineDash([Math.max(3, 7 * scale), Math.max(3, 7 * scale)]);
    // A neutral dark keyline is deliberately painted first. It keeps the white
    // geometry readable over pale stars without turning outcome into colour.
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(2,5,13,.82)";
    ctx.lineWidth = outerWidth + Math.max(2.4, 4.2 * scale);
    drawHyperRunTunnelRingPath(ctx, outerRadius, layer);
    ctx.stroke();
    ctx.lineWidth = innerWidth + Math.max(2, 3.4 * scale);
    drawHyperRunTunnelRingPath(ctx, innerRadius, layer);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = missed ? "rgba(255,255,255,.7)" : "#fff";
    ctx.lineWidth = outerWidth;
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = reduced ? 0 : (perfect ? 13 : outcome === "pending" ? 5 : 8) * scale;
    drawHyperRunTunnelRingPath(ctx, outerRadius, layer);
    ctx.stroke();
    ctx.strokeStyle = passed
        ? "rgba(255,255,255,.62)"
        : missed ? "rgba(255,255,255,.58)" : "#fff";
    ctx.lineWidth = innerWidth;
    drawHyperRunTunnelRingPath(ctx, innerRadius, layer);
    ctx.stroke();
    ctx.setLineDash([]);
    if (layer === "front" && perfect && age <= 16) {
        const reach = outerRadius + (7 + raceSmooth(age / 16) * 7) * scale;
        ctx.strokeStyle = `rgba(255,255,255,${(0.92 * (1 - age / 17)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, 2 * scale);
        ctx.shadowBlur = reduced ? 0 : 9 * scale;
        for (let arm = 0; arm < 4; arm++) {
            const a = arm * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (outerRadius + 3 * scale), Math.sin(a) * (outerRadius + 3 * scale));
            ctx.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
            ctx.stroke();
        }
    }
    else if (layer === "front" && missed && age <= 16) {
        const r = innerRadius * 0.62;
        ctx.strokeStyle = `rgba(255,255,255,${(0.72 * (1 - age / 17)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, 2 * scale);
        for (const direction of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(-r, direction * -r);
            ctx.lineTo(r, direction * r);
            ctx.stroke();
        }
    }
    ctx.restore();
    if (layer === "front" && outcome !== "pending" && age <= 24) {
        const label = perfect ? "PERFECT · EXIT BOOST" : passed ? "CLEAR" : "MISS";
        const labelFade = age <= 14 ? 1 : 1 - raceSegment(age, 15, 24);
        const labelY = Math.max(viewport.top + 18, Math.min(viewport.bottom - 8, y - outerRadius - 11 * scale));
        ctx.save();
        ctx.globalAlpha *= labelFade;
        ctx.textAlign = "center";
        ctx.font = `900 ${Math.max(9, 11 * scale)}px Figtree, system-ui`;
        ctx.lineWidth = Math.max(2, 3 * scale);
        ctx.strokeStyle = "rgba(2,5,13,.9)";
        ctx.strokeText(label, x, labelY);
        ctx.fillStyle = missed ? "rgba(255,255,255,.72)" : "#fff";
        ctx.fillText(label, x, labelY);
        ctx.restore();
    }
}
function drawHyperRunTunnelRingLayer(ctx, w, viewTick, layer) {
    const race = w.race;
    const viewport = raceViewport(w.W, w.H);
    const rings = raceTunnelRings(race);
    const ledger = race.tunnelRingLedger[race.wormholes] ?? [];
    const decisions = race.tunnelRingDecisionTicks[race.wormholes] ?? [];
    const pad = (RACE_TUNNEL_RING_APERTURE + 22) * viewport.scale;
    for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        const outcome = (ledger[i] ?? "pending");
        const decisionTick = decisions[i];
        const age = outcome === "pending" || decisionTick == null
            ? 0
            : raceDecisionAge(race.tick, decisionTick);
        if (outcome !== "pending" && age > 27)
            continue;
        // Pending gates travel by phase tick. A resolved gate is held on the pilot
        // plane for its age-zero frame, then drifts left as feedback. This preserves
        // the exact crossing read despite the fixed-step authority increment.
        const x = outcome === "pending"
            ? hyperRunTunnelRingScreenX(viewport, ring.tick, viewTick)
            : viewport.pilotX - age * (RACE_TUNNEL_SPEED / RACE_HZ) * viewport.scale;
        if (x < viewport.left - pad || x > viewport.right + pad)
            continue;
        drawHyperRunTunnelRing(ctx, viewport, x, ring.y, outcome, age, layer);
    }
}
function drawHyperRunTunnelDirector(ctx, w, viewTick) {
    const race = w.race;
    const viewport = raceViewport(w.W, w.H);
    const rings = raceTunnelRings(race);
    const ledger = race.tunnelRingLedger[race.wormholes] ?? [];
    const nextIndex = rings.findIndex((ring, i) => (ledger[i] ?? "pending") === "pending" && ring.tick >= viewTick);
    if (nextIndex < 0)
        return;
    const ring = rings[nextIndex];
    const ringX = hyperRunTunnelRingScreenX(viewport, ring.tick, viewTick);
    if (ringX <= viewport.right - RACE_TUNNEL_RING_APERTURE * viewport.scale)
        return;
    const x = viewport.right - Math.max(12, 16 * viewport.scale);
    const y = Math.max(viewport.top + 28, Math.min(viewport.bottom - 28, raceViewportY(viewport, ring.y)));
    const r = Math.max(5, 7 * viewport.scale);
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, 6 * viewport.scale);
    ctx.strokeStyle = "rgba(2,5,13,.9)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r - 6 * viewport.scale, -r);
    ctx.lineTo(-r, 0);
    ctx.lineTo(-r - 6 * viewport.scale, r);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.4, 2.1 * viewport.scale);
    ctx.strokeStyle = "rgba(255,255,255,.96)";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = raceReducedMotion() ? 0 : 5 * viewport.scale;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r - 6 * viewport.scale, -r);
    ctx.lineTo(-r, 0);
    ctx.lineTo(-r - 6 * viewport.scale, r);
    ctx.stroke();
    ctx.restore();
}
function drawHyperRunTunnelDragCue(ctx, w) {
    const race = w.race;
    const localTick = race.phase === "entry" ? Math.max(0, race.phaseTick - 12) : race.phaseTick + 36;
    if (race.phase !== "entry" && race.phase !== "tunnel")
        return;
    const tutorialFade = race.wormholes === 0
        ? localTick <= 72 ? 1 : 1 - raceSegment(localTick, 73, 96)
        : 0;
    // Keep a restrained target pipper alive whenever a drag is owned. The
    // slower follower then reads as deliberate steering rather than lag.
    const activeTarget = race.phase === "tunnel" && race.tunnelDragY != null;
    const fade = Math.max(tutorialFade, activeTarget ? 0.72 : 0);
    if (fade <= 0)
        return;
    const viewport = raceViewport(w.W, w.H);
    const pilotY = raceViewportY(viewport, race.y);
    const targetY = race.tunnelDragY == null ? pilotY : raceViewportY(viewport, race.tunnelDragY);
    const x = Math.min(viewport.right - 54 * viewport.scale, viewport.pilotX + 66 * viewport.scale);
    const railTop = Math.max(viewport.top + 26, Math.min(pilotY, targetY) - 42 * viewport.scale);
    const railBottom = Math.min(viewport.bottom - 26, Math.max(pilotY, targetY) + 42 * viewport.scale);
    const dotY = Math.max(railTop, Math.min(railBottom, targetY));
    ctx.save();
    ctx.globalAlpha *= raceClamp01(fade * 0.88);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(2,5,13,.88)";
    ctx.lineWidth = Math.max(4, 6 * viewport.scale);
    ctx.beginPath();
    ctx.moveTo(x, railTop);
    ctx.lineTo(x, railBottom);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.3, 2 * viewport.scale);
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    ctx.moveTo(x, railTop);
    ctx.lineTo(x, railBottom);
    ctx.stroke();
    for (const [y, direction] of [[railTop, 1], [railBottom, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x - 5 * viewport.scale, y + direction * 7 * viewport.scale);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 5 * viewport.scale, y + direction * 7 * viewport.scale);
        ctx.stroke();
    }
    if (race.tunnelDragY != null) {
        ctx.globalAlpha *= 0.7;
        ctx.setLineDash([3 * viewport.scale, 5 * viewport.scale]);
        ctx.beginPath();
        ctx.moveTo(viewport.pilotX + 22 * viewport.scale, pilotY);
        ctx.lineTo(x, dotY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, dotY, Math.max(2.5, 3.5 * viewport.scale), 0, Math.PI * 2);
    ctx.fill();
    if (activeTarget) {
        const pipper = Math.max(6, 8 * viewport.scale);
        ctx.strokeStyle = "rgba(169,245,255,.92)";
        ctx.lineWidth = Math.max(1, 1.4 * viewport.scale);
        ctx.beginPath();
        ctx.arc(x, dotY, pipper, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - pipper - 4 * viewport.scale, dotY);
        ctx.lineTo(x - pipper / 2, dotY);
        ctx.moveTo(x + pipper / 2, dotY);
        ctx.lineTo(x + pipper + 4 * viewport.scale, dotY);
        ctx.moveTo(x, dotY - pipper - 4 * viewport.scale);
        ctx.lineTo(x, dotY - pipper / 2);
        ctx.moveTo(x, dotY + pipper / 2);
        ctx.lineTo(x, dotY + pipper + 4 * viewport.scale);
        ctx.stroke();
    }
    if (tutorialFade > 0) {
        ctx.textAlign = "left";
        ctx.font = `900 ${Math.max(8, 9 * viewport.scale)}px Figtree, system-ui`;
        const labelX = Math.min(viewport.right - 102, x + 10 * viewport.scale);
        const labelY = Math.max(viewport.top + 20, Math.min(viewport.bottom - 22, dotY));
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(2,5,13,.9)";
        for (const [text, y] of [["DRAG TO ALIGN", labelY], ["CENTER = FASTER EXIT", labelY + 13]]) {
            ctx.strokeText(text, labelX, y);
            ctx.fillText(text, labelX, y);
        }
    }
    ctx.restore();
}
function drawRaceTunnel(ctx, w, viewTick = w.race.phaseTick, enclosure = 1) {
    const race = w.race;
    const viewport = raceViewport(w.W, w.H);
    const { scale, left, right, top, bottom, contentWidth, contentHeight, pilotX } = viewport;
    const reduced = raceReducedMotion();
    const visualTick = race.tick;
    const samples = hyperRunTunnelSampleCount(viewport.virtualWidth);
    raceTunnelTopScratch.length = samples + 1;
    raceTunnelBottomScratch.length = samples + 1;
    const enclosureMix = raceSmooth(enclosure);
    const structureFactor = raceSmooth(raceClamp01((enclosure - 0.2) / 0.8));
    for (let i = 0; i <= samples; i++) {
        const x = left + contentWidth * (i / samples);
        const distance = (x - pilotX) / Math.max(0.001, scale);
        const lookTicks = distance / Math.max(0.001, RACE_TUNNEL_SPEED / RACE_HZ);
        const sampleTick = Math.max(0, Math.min(RACE_TUNNEL_TICKS - 1, viewTick + lookTicks));
        const tunnel = raceTunnelGeometry(race, sampleTick);
        const center = tunnel.center;
        const liveTop = raceViewportY(viewport, center - tunnel.half);
        const liveBottom = raceViewportY(viewport, center + tunnel.half);
        // Entry and return never reveal a second scene. The same energy banks begin
        // at the screen edges, close onto the authority corridor, then reopen.
        raceTunnelTopScratch[i] = raceLerp(top, liveTop, enclosureMix);
        raceTunnelBottomScratch[i] = raceLerp(bottom, liveBottom, enclosureMix);
    }
    const corridorPath = () => {
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const x = left + contentWidth * (i / samples);
            if (i)
                ctx.lineTo(x, raceTunnelTopScratch[i]);
            else
                ctx.moveTo(x, raceTunnelTopScratch[i]);
        }
        for (let i = samples; i >= 0; i--) {
            ctx.lineTo(left + contentWidth * (i / samples), raceTunnelBottomScratch[i]);
        }
        ctx.closePath();
    };
    const traceBoundary = (line, offset = 0, strand = 0) => {
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const x = left + contentWidth * (i / samples);
            const wave = reduced ? 0 : Math.sin(i * 0.68 + visualTick * 0.11 + strand * 1.7) * (1.2 + strand * 0.7) * scale;
            const y = line[i] + offset + wave;
            if (i)
                ctx.lineTo(x, y);
            else
                ctx.moveTo(x, y);
        }
    };
    const traceBankBeam = (line, edge, depth, strand) => {
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const x = left + contentWidth * (i / samples);
            const wave = reduced ? 0 : Math.sin(i * 0.52 + visualTick * 0.09 + strand * 1.9)
                * (1.2 + strand * 0.45) * scale;
            const y = raceLerp(edge, line[i], depth) + wave;
            if (i)
                ctx.lineTo(x, y);
            else
                ctx.moveTo(x, y);
        }
    };
    // The same course sky remains visible throughout the shortcut. Plasma adds
    // colour and depth, but never replaces the scene with an opaque dark plate.
    const wash = ctx.createLinearGradient(left, top, right, bottom);
    wash.addColorStop(0, "rgba(48,18,104,.12)");
    wash.addColorStop(0.42, "rgba(104,36,174,.18)");
    wash.addColorStop(0.72, "rgba(30,112,190,.15)");
    wash.addColorStop(1, "rgba(12,214,236,.10)");
    ctx.fillStyle = wash;
    ctx.fillRect(left, top, contentWidth, contentHeight);
    // Outside the playable route is a translucent energy bank, not darkness.
    // The live collision boundary below remains substantially brighter than it.
    ctx.fillStyle = "rgba(25,7,55,.18)";
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    for (let i = samples; i >= 0; i--)
        ctx.lineTo(left + contentWidth * (i / samples), raceTunnelTopScratch[i]);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(5,27,61,.17)";
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, bottom);
    for (let i = samples; i >= 0; i--)
        ctx.lineTo(left + contentWidth * (i / samples), raceTunnelBottomScratch[i]);
    ctx.closePath();
    ctx.fill();
    // Parallel beams make the enclosure itself readable: they originate on the
    // existing screen boundaries and sweep inward with the closing energy banks.
    // No radial mouth or portal is involved.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    const bankBeamCount = reduced ? 2 : 5;
    for (const [line, edge] of [
        [raceTunnelTopScratch, top], [raceTunnelBottomScratch, bottom],
    ]) {
        for (let strand = 0; strand < bankBeamCount; strand++) {
            const depth = (strand + 1) / (bankBeamCount + 1);
            ctx.strokeStyle = strand % 2
                ? "rgba(91,225,255,.18)"
                : "rgba(190,92,255,.22)";
            ctx.lineWidth = Math.max(0.7, (0.9 + strand * 0.32) * scale);
            traceBankBeam(line, edge, depth, strand);
            ctx.stroke();
        }
    }
    ctx.restore();
    ctx.save();
    corridorPath();
    ctx.clip();
    const corridor = ctx.createLinearGradient(left, top, right, bottom);
    corridor.addColorStop(0, "rgba(76,39,176,.12)");
    corridor.addColorStop(0.52, "rgba(37,104,196,.14)");
    corridor.addColorStop(1, "rgba(64,232,255,.10)");
    ctx.fillStyle = corridor;
    ctx.fillRect(left, top, contentWidth, contentHeight);
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    // Long, layered future-to-past streaks make the 562.5-unit shortcut read
    // materially faster than normal flight without introducing a vanishing point.
    const streakCount = reduced ? 14 : 38;
    for (let i = 0; i < streakCount; i++) {
        const span = contentWidth + 260 * scale;
        const travel = reduced ? 0 : visualTick * (11 + i % 5) * scale;
        const x = left - 130 * scale + raceMod(raceFlowHash(race.seed, i, 62) * span - travel, span);
        const index = Math.max(0, Math.min(samples, Math.round((x - left) / Math.max(1, contentWidth) * samples)));
        const lane = 0.08 + raceFlowHash(race.seed, i, 61) * 0.84;
        const y = raceLerp(raceTunnelTopScratch[index], raceTunnelBottomScratch[index], lane);
        const length = (reduced ? 14 + (i % 4) * 3 : 48 + (i % 7) * 14) * scale;
        ctx.strokeStyle = i % 5 === 0
            ? "rgba(229,184,255,.55)"
            : i % 3 === 0
                ? "rgba(128,91,255,.46)"
                : "rgba(91,226,255,.43)";
        ctx.lineWidth = Math.max(0.7, (0.8 + (i % 3) * 0.55) * scale);
        ctx.beginPath();
        ctx.moveTo(x + length, y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    // Transverse bands are sampled directly from the authority corridor. Their
    // lateral cadence provides Wormhole Run depth while keeping the camera side-on.
    // They resolve only after the edge beams have begun closing; early formation
    // remains loose filaments and speed streaks instead of a tunnel popping in.
    ctx.globalAlpha *= structureFactor;
    const bandCount = reduced ? 5 : 11;
    ctx.setLineDash([3 * scale, 8 * scale]);
    for (let i = 0; i < bandCount; i++) {
        const u = reduced ? (i + 0.5) / bandCount : raceMod((i + 0.5) / bandCount - visualTick * 0.018, 1);
        const index = Math.min(samples, Math.max(0, Math.round(u * samples)));
        const x = left + contentWidth * (index / samples);
        const ty = raceTunnelTopScratch[index];
        const by = raceTunnelBottomScratch[index];
        const bow = reduced ? 0 : Math.sin((visualTick + i * 13) * 0.08) * 9 * scale;
        ctx.strokeStyle = i % 2 ? "rgba(156,96,255,.20)" : "rgba(83,222,255,.24)";
        ctx.lineWidth = Math.max(0.7, 1.1 * scale);
        ctx.beginPath();
        ctx.moveTo(x, ty + 3 * scale);
        ctx.quadraticCurveTo(x - 10 * scale + bow, (ty + by) * 0.5, x, by - 3 * scale);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    // A restrained center guide turns the corridor into a readable route rather
    // than a texture. It is decorative only and never feeds collision authority.
    const guideCount = reduced ? 5 : 9;
    for (let i = 0; i < guideCount; i++) {
        const u = reduced ? (i + 0.5) / guideCount : raceMod((i + 0.5) / guideCount - visualTick * 0.011, 1);
        const index = Math.min(samples, Math.max(0, Math.round(u * samples)));
        const x = left + contentWidth * (index / samples);
        const y = (raceTunnelTopScratch[index] + raceTunnelBottomScratch[index]) * 0.5;
        const r = (reduced ? 3.5 : 4.5) * scale;
        ctx.strokeStyle = "rgba(214,250,255,.34)";
        ctx.lineWidth = Math.max(0.7, 1.1 * scale);
        ctx.beginPath();
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x, y);
        ctx.lineTo(x - r, y + r);
        ctx.stroke();
    }
    ctx.restore();
    // Procedural purple/blue wall filaments give the shortcut a living energy
    // boundary. The cyan core is the exact collision edge and stays brightest.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const [line, direction] of [
        [raceTunnelTopScratch, -1], [raceTunnelBottomScratch, 1],
    ]) {
        const strandCount = reduced ? 1 : 3;
        for (let strand = strandCount - 1; strand >= 0; strand--) {
            const offset = direction * (8 + strand * 8) * scale;
            ctx.strokeStyle = strand % 2
                ? "rgba(90,108,255,.26)"
                : "rgba(197,82,255,.34)";
            ctx.lineWidth = Math.max(0.8, (1.2 + strand * 0.8) * scale);
            traceBoundary(line, offset, strand);
            ctx.stroke();
        }
        ctx.strokeStyle = "rgba(172,69,255,.34)";
        ctx.lineWidth = Math.max(4, 18 * scale);
        traceBoundary(line);
        ctx.stroke();
        ctx.strokeStyle = "rgba(204,91,255,.72)";
        ctx.lineWidth = Math.max(2, 6.5 * scale);
        traceBoundary(line);
        ctx.stroke();
        if (structureFactor > 0) {
            ctx.save();
            ctx.globalAlpha *= structureFactor;
            ctx.shadowColor = "#56e8ff";
            ctx.shadowBlur = 12 * scale;
            ctx.strokeStyle = "rgba(112,238,255,.96)";
            ctx.lineWidth = Math.max(1.5, 2.6 * scale);
            traceBoundary(line);
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
    if (race.wallSuppressTicks > 0) {
        const index = Math.min(samples, Math.max(0, Math.round((pilotX - left) / Math.max(1, contentWidth) * samples)));
        const pilotY = raceViewportY(viewport, race.y);
        const line = Math.abs(pilotY - raceTunnelTopScratch[index]) < Math.abs(pilotY - raceTunnelBottomScratch[index])
            ? raceTunnelTopScratch : raceTunnelBottomScratch;
        const start = Math.max(0, index - 2);
        const end = Math.min(samples, index + 2);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = raceClamp01(race.wallSuppressTicks / 15);
        ctx.strokeStyle = "rgba(255,211,112,.92)";
        ctx.lineWidth = Math.max(2, 5 * scale);
        ctx.shadowColor = "#ff8bd8";
        ctx.shadowBlur = 10 * scale;
        ctx.beginPath();
        for (let i = start; i <= end; i++) {
            const x = left + contentWidth * (i / samples);
            if (i === start)
                ctx.moveTo(x, line[i]);
            else
                ctx.lineTo(x, line[i]);
        }
        ctx.stroke();
        ctx.restore();
    }
}
function buildRaceCourseFrame(w, viewport) {
    const race = w.race;
    const route = raceRouteTarget(race);
    const targetIndex = route.nextRingIndex;
    const target = targetIndex == null ? null : RACE_RINGS[targetIndex];
    const targetDistance = target ? target.x - race.coursePosition : Number.POSITIVE_INFINITY;
    const targetY = race.phase === "entry" ? race.entryAnchorY : target?.y ?? null;
    const gates = [];
    const zones = [{
            x: viewport.pilotX,
            y: raceViewportY(viewport, race.y),
            r: 38 * viewport.scale,
        }];
    const ringSize = 148 * viewport.scale;
    RACE_RINGS.forEach((ring, i) => {
        if (race.phase === "entry" && i === race.entryRingIndex)
            return;
        const visual = raceGateVisual(race, i);
        if (!visual)
            return;
        const x = raceViewportX(viewport, RACE_PILOT_X + ring.x - race.coursePosition);
        if (x < viewport.left - ringSize || x > viewport.right + ringSize)
            return;
        const gate = { i, x, y: raceViewportY(viewport, ring.y), tilt: ring.tilt, ...visual };
        gates.push(gate);
        zones.push({ x, y: gate.y, r: ringSize * 0.5 });
    });
    RACE_DEBRIS.forEach((item, i) => {
        if (race.debrisLedger[i])
            return;
        const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
        if (x < viewport.left - 60 * viewport.scale || x > viewport.right + 60 * viewport.scale)
            return;
        zones.push({ x, y: raceViewportY(viewport, item.y), r: (item.r + 10) * viewport.scale });
    });
    RACE_ACORNS.forEach((item, i) => {
        if (race.acornLedger[i])
            return;
        const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
        if (x < viewport.left - 30 * viewport.scale || x > viewport.right + 30 * viewport.scale)
            return;
        zones.push({ x, y: raceViewportY(viewport, item.y), r: 24 * viewport.scale });
    });
    return {
        gates,
        zones,
        flow: writeHyperRunFlow({
            seed: race.seed,
            tick: race.tick,
            coursePosition: race.coursePosition,
            speed: race.speed,
            targetY,
            targetDistance: race.phase === "entry" ? 0 : targetDistance,
            virtualWidth: viewport.virtualWidth,
            reducedMotion: raceReducedMotion(),
        }, raceFlowScratch),
        targetIndex,
        targetDistance,
        targetY,
    };
}
function drawRaceCourseUnderlay(ctx, w, art, viewport, frame) {
    const race = w.race;
    const { scale } = viewport;
    const ringSize = 148 * scale;
    drawRaceFlow(ctx, viewport, frame.flow, "far", frame.zones);
    if (frame.targetIndex != null && frame.targetY != null && frame.targetDistance <= RACE_MAX_INTERACTIVE_GAP) {
        const gate = frame.gates.find((candidate) => candidate.i === frame.targetIndex);
        if (gate) {
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            ctx.strokeStyle = "rgba(92,217,255,.34)";
            ctx.lineWidth = Math.max(0.8, scale);
            for (let i = 0; i < 6; i++) {
                const dy = (i - 2.5) * 10 * scale;
                ctx.beginPath();
                ctx.moveTo(gate.x + ringSize * 0.85, gate.y + dy * 1.5);
                ctx.quadraticCurveTo(gate.x + ringSize * 0.62, gate.y + dy, gate.x + ringSize * 0.44, gate.y + dy * 0.45);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
    frame.gates.forEach((gate) => {
        drawRaceGateVisualLayer(ctx, art, gate, "back", ringSize);
        if (race.ringLedger[gate.i] === "pending")
            drawRacePendingMembrane(ctx, viewport, gate.x, gate.y, "back");
    });
    RACE_RINGS.forEach((ring, i) => {
        const decisionTick = race.ringDecisionTicks[i];
        const state = race.ringLedger[i];
        if (decisionTick == null || (state !== "passed" && state !== "missed"))
            return;
        drawRaceDecisionCue(ctx, viewport, state, raceDecisionAge(race.tick, decisionTick), ring.y, "back");
    });
    RACE_DEBRIS.forEach((item, i) => {
        if (race.debrisLedger[i])
            return;
        const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
        if (x < viewport.left - 60 * scale || x > viewport.right + 60 * scale)
            return;
        drawSprite(ctx, art.debris[item.art % Math.max(1, art.debris.length)], x, raceViewportY(viewport, item.y), item.r * 2 * scale, "core", "dark");
    });
    RACE_ACORNS.forEach((item, i) => {
        if (race.acornLedger[i])
            return;
        const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
        if (x < viewport.left - 30 * scale || x > viewport.right + 30 * scale)
            return;
        drawSprite(ctx, frameOf(art.acorn, w.time, 10), x, raceViewportY(viewport, item.y), 26 * scale);
    });
    drawRaceFlow(ctx, viewport, frame.flow, "mid", frame.zones);
    const finishX = raceViewportX(viewport, RACE_PILOT_X + RACE_LENGTH - race.coursePosition);
    if (finishX > viewport.left - ringSize && finishX < viewport.right + ringSize) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,224,128,.85)";
        ctx.lineWidth = 4 * scale;
        ctx.setLineDash([8 * scale, 8 * scale]);
        ctx.beginPath();
        ctx.moveTo(finishX, raceViewportY(viewport, 80));
        ctx.lineTo(finishX, raceViewportY(viewport, 560));
        ctx.stroke();
        ctx.restore();
    }
}
function drawRaceCourseOverlay(ctx, w, art, viewport, frame, excludeDecisionIndex = null) {
    const race = w.race;
    const ringSize = 148 * viewport.scale;
    frame.gates.forEach((gate) => {
        drawRaceGateVisualLayer(ctx, art, gate, "front", ringSize);
        if (race.ringLedger[gate.i] === "pending")
            drawRacePendingMembrane(ctx, viewport, gate.x, gate.y, "front");
    });
    RACE_RINGS.forEach((ring, i) => {
        if (i === excludeDecisionIndex)
            return;
        const decisionTick = race.ringDecisionTicks[i];
        const state = race.ringLedger[i];
        if (decisionTick == null || (state !== "passed" && state !== "missed"))
            return;
        drawRaceDecisionCue(ctx, viewport, state, raceDecisionAge(race.tick, decisionTick), ring.y, "front");
    });
    drawRaceFlow(ctx, viewport, frame.flow, "near", frame.zones);
}
function drawRaceCueOverlay(ctx, w, viewport) {
    const race = w.race;
    for (let i = 0; i < w.raceCues.length; i++) {
        const cue = w.raceCues[i];
        const age = raceDecisionAge(race.tick, cue.tick);
        if (age > 45)
            continue;
        const x = viewport.pilotX;
        const y = raceViewportY(viewport, cue.y);
        const fade = 1 - raceClamp01(age / 30);
        if (cue.kind === "ring-pass" && age <= 2) {
            const coreY = raceViewportY(viewport, race.y);
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            ctx.fillStyle = `rgba(235,255,255,${(1 - age / 3).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, coreY, (5 + age * 2) * viewport.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        else if (cue.kind === "debris-hit") {
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.strokeStyle = "rgba(255,153,95,.9)";
            ctx.lineWidth = 2 * viewport.scale;
            ctx.beginPath();
            ctx.arc(x, y, (22 + age * 0.7) * viewport.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        else if (cue.kind === "acorn") {
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.strokeStyle = "rgba(255,225,112,.92)";
            ctx.lineWidth = 2 * viewport.scale;
            for (let arm = 0; arm < 4; arm++) {
                const a = arm * Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(a) * 10 * viewport.scale, y + Math.sin(a) * 10 * viewport.scale);
                ctx.lineTo(x + Math.cos(a) * 18 * viewport.scale, y + Math.sin(a) * 18 * viewport.scale);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (cue.chargeDelta !== 0 && age <= 30) {
            let slot = 0;
            for (let j = 0; j < i; j++) {
                if (w.raceCues[j].tick === cue.tick && w.raceCues[j].chargeDelta !== 0)
                    slot++;
            }
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.fillStyle = cue.chargeDelta > 0 ? "#b7fff1" : "#ffc0a0";
            ctx.font = `900 ${Math.max(11, 13 * viewport.scale)}px Figtree, system-ui`;
            ctx.textAlign = "left";
            ctx.fillText(`${cue.chargeDelta > 0 ? "+" : ""}${cue.chargeDelta}`, x + 34 * viewport.scale, y - (18 - slot * 16 + age * 0.35) * viewport.scale);
            ctx.restore();
        }
    }
}
function drawHyperRunShipExhaust(ctx, w, scale, engineX) {
    const race = w.race;
    const hyperspeed = race.phase === "tunnel" ? 1
        : race.phase === "entry" || race.phase === "return"
            ? hyperRunInlineWormholePresentation(race.phase, race.phaseTick).energyAlpha
            : 0;
    // The physics applies its deterministic press edge on the first fixed tick.
    // Mirror that intent in the engine plume on the same rendered frame so a
    // hold or boost never feels like it disappeared into an input queue.
    const controlThrust = race.phase === "normal"
        ? race.boost ? 1 : race.held ? 0.45 : 0
        : 0;
    const thrust = Math.max(hyperspeed, controlThrust);
    const pulse = 0.5 + 0.5 * Math.sin(w.time * raceLerp(17, 26, thrust));
    const length = raceLerp(15, 25, thrust) + pulse * raceLerp(4, 7, thrust);
    const half = raceLerp(4.2, 5.4, thrust) * scale;
    const tail = engineX - length * scale;
    const gradient = ctx.createLinearGradient(engineX, 0, tail, 0);
    gradient.addColorStop(0, "rgba(255,255,255,.96)");
    gradient.addColorStop(0.18, "rgba(97,221,255,.92)");
    gradient.addColorStop(0.58, "rgba(146,82,255,.66)");
    gradient.addColorStop(1, "rgba(83,38,180,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(111,92,255,.82)";
    ctx.shadowBlur = raceLerp(6, 10, thrust) * scale;
    ctx.beginPath();
    ctx.moveTo(engineX, -half);
    ctx.quadraticCurveTo(engineX - length * scale * 0.48, -half * 0.64, tail, 0);
    ctx.quadraticCurveTo(engineX - length * scale * 0.48, half * 0.64, engineX, half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
export function hyperRunShipLayout(authorityX, scale, ship) {
    const shipSize = 88 * scale;
    const box = ship.box ?? { x: 0, y: 0, w: ship.width, h: ship.height };
    const fitScale = shipSize / Math.max(1, Math.max(box.w, box.h));
    const noseOffset = box.w * fitScale / 2;
    const centerX = authorityX - noseOffset;
    return {
        shipSize,
        centerX,
        cockpitX: centerX + 7.2 * scale,
        cockpitY: -10.5 * scale,
        engineX: centerX - box.w * fitScale / 2 + 1.5 * scale,
        noseX: centerX + noseOffset,
    };
}
/** Hyper Run's vehicle is a beta-only visual frame around the real equipped
 * pilot. The ship nose, not its painted center, is registered to the race
 * authority plane so a gate resolves when contact appears to happen. */
function drawHyperRunPilot(ctx, w, save, art, authorityX, scale) {
    const ship = art.hyperRun["scout-ship"];
    if (!ship) {
        drawPilot(ctx, w, save, art, authorityX, scale);
        return;
    }
    const layout = hyperRunShipLayout(0, scale, ship);
    const bank = Math.max(-0.22, Math.min(0.25, w.squirrel.rot * 0.34));
    const halo = raceReducedMotion() ? undefined
        : w.race.phase === "tunnel" ? "light" : skyLuma(w) > 0.42 ? "dark" : "light";
    ctx.save();
    ctx.translate(authorityX, w.squirrel.y);
    // Banking around the authority point keeps the nose/crossing registration
    // stable while the body and exhaust sell the player's vertical intent.
    ctx.rotate(bank);
    drawHyperRunShipExhaust(ctx, w, scale, layout.engineX);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(layout.cockpitX, layout.cockpitY, 13.2 * scale, 12.4 * scale, 0, 0, Math.PI * 2);
    ctx.clip();
    const cockpitGlow = ctx.createRadialGradient(layout.cockpitX + 2 * scale, layout.cockpitY - 3 * scale, 1, layout.cockpitX, layout.cockpitY, 15 * scale);
    cockpitGlow.addColorStop(0, "rgba(71,112,166,.62)");
    cockpitGlow.addColorStop(1, "rgba(3,8,22,.96)");
    ctx.fillStyle = cockpitGlow;
    ctx.fillRect(layout.cockpitX - 16 * scale, layout.cockpitY - 15 * scale, 32 * scale, 30 * scale);
    drawPilot(ctx, w, save, art, layout.cockpitX - 2.5 * scale, 0.52 * scale, layout.cockpitY + 1.5 * scale, 0);
    ctx.restore();
    drawSprite(ctx, ship, layout.centerX, 0, layout.shipSize, "box", halo);
    ctx.restore();
}
function drawHyperRunWorld(ctx, w, save, art) {
    const race = w.race;
    const viewport = raceViewport(w.W, w.H);
    const { scale, pilotX } = viewport;
    if (race.phase === "normal" || race.phase === "finish") {
        const frame = buildRaceCourseFrame(w, viewport);
        drawRaceCourseUnderlay(ctx, w, art, viewport, frame);
        drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
        drawRaceCourseOverlay(ctx, w, art, viewport, frame);
        drawRaceCueOverlay(ctx, w, viewport);
        if (race.phase === "normal" && frame.targetIndex != null && frame.targetY != null) {
            drawRaceDirector(ctx, viewport, race.y, frame.targetY, frame.targetDistance);
        }
        return;
    }
    if (race.phase === "entry") {
        const t = race.phaseTick;
        const frame = buildRaceCourseFrame(w, viewport);
        // Nothing teleports or opens a second scene. The course remains in place
        // while energy appears at the screen edges, then closes around the live
        // tunnel geometry. At the last entry tick this is pixel-continuous with
        // tunnel tick zero.
        const { enclosure, energyAlpha, courseAlpha } = hyperRunInlineWormholePresentation("entry", t);
        ctx.save();
        ctx.globalAlpha *= courseAlpha;
        drawRaceCourseUnderlay(ctx, w, art, viewport, frame);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha *= energyAlpha;
        // The first alignment gates materialize with the energy instead of popping
        // in on the first tunnel frame. They remain presentation-only during entry.
        drawRaceTunnel(ctx, w, 0, enclosure);
        drawHyperRunTunnelRingLayer(ctx, w, 0, "back");
        ctx.restore();
        drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
        ctx.save();
        ctx.globalAlpha *= energyAlpha;
        drawHyperRunTunnelRingLayer(ctx, w, 0, "front");
        drawHyperRunTunnelDirector(ctx, w, 0);
        drawHyperRunTunnelDragCue(ctx, w);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha *= courseAlpha;
        drawRaceCourseOverlay(ctx, w, art, viewport, frame);
        ctx.restore();
        drawRaceCueOverlay(ctx, w, viewport);
        return;
    }
    if (race.phase === "tunnel") {
        drawRaceTunnel(ctx, w, race.phaseTick);
        drawHyperRunTunnelRingLayer(ctx, w, race.phaseTick, "back");
        drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
        drawHyperRunTunnelRingLayer(ctx, w, race.phaseTick, "front");
        drawHyperRunTunnelDirector(ctx, w, race.phaseTick);
        drawHyperRunTunnelDragCue(ctx, w);
        drawRaceCueOverlay(ctx, w, viewport);
        return;
    }
    const t = race.phaseTick;
    const frame = buildRaceCourseFrame(w, viewport);
    // Return is the exact inverse visual: the energy banks open toward the same
    // screen edges and dissolve, uncovering normal flight beneath them.
    const { enclosure, energyAlpha, courseAlpha } = hyperRunInlineWormholePresentation("return", t);
    ctx.save();
    ctx.globalAlpha *= courseAlpha;
    drawRaceCourseUnderlay(ctx, w, art, viewport, frame);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= energyAlpha;
    drawRaceTunnel(ctx, w, RACE_TUNNEL_TICKS - 1, enclosure);
    ctx.restore();
    drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
    ctx.save();
    ctx.globalAlpha *= courseAlpha;
    drawRaceCourseOverlay(ctx, w, art, viewport, frame);
    ctx.restore();
    drawRaceCueOverlay(ctx, w, viewport);
}
/** What the corridor wants, in the pilot's own words. Kept in one place so
 *  the READY card and the lead-in can never disagree about the control -
 *  there is only one now, and it is the same verb Lost in Space uses. */
function tunnelControlLabel(_w) {
    return "TAP TO RISE";
}
export function drawWorld(ctx, w, save, art) {
    const { W, H } = w;
    ctx.save();
    if (w.shake > 0) {
        const mag = w.shake * 10;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    if (w.flight === "tunnel" && w.tunnel) {
        drawTunnelWorld(ctx, w, save, art);
        ctx.restore();
        return;
    }
    // Sky stays upright. Warp only tilts the playfield (live does the same).
    if (w.retro)
        retroBackdrop(ctx, W, H, w.envA, w.envB, w.envBlend, w.stars);
    else
        drawBackdrop(ctx, w, art);
    ctx.save();
    applyWarp(ctx, w);
    if (w.race) {
        const viewport = raceViewport(w.W, w.H);
        ctx.save();
        ctx.beginPath();
        ctx.rect(viewport.left, viewport.top, viewport.contentWidth, viewport.contentHeight);
        ctx.clip();
        drawHyperRunWorld(ctx, w, save, art);
        ctx.restore();
        ctx.restore();
        ctx.restore();
        return;
    }
    if (w.retro) {
        drawRetroWorld(ctx, w, save, art);
        ctx.restore();
        ctx.restore();
        return;
    }
    // Everything you can hit gets a separation halo keyed to the sky: a
    // dark drop shadow on bright skies, a faint light rim on dark ones.
    // Gates and debris then read as solid objects against any backdrop.
    const halo = skyLuma(w) > 0.42 ? "dark" : "light";
    for (const p of w.planets) {
        const gy = liveGapY(p, w);
        drawPlanet(ctx, art, p.x, gy - p.gap / 2 - p.r, p.r, p.topKind, halo);
        drawPlanet(ctx, art, p.x, gy + p.gap / 2 + p.r, p.r, p.botKind, halo);
        for (const b of p.blockers) {
            const by = b.y + gateOffset(p, w);
            const bx = blockerX(p, b, w);
            const img = art.debris[b.debris];
            if (img)
                drawSprite(ctx, img, bx, by, b.r * 2, "core", halo);
            else
                drawPlanet(ctx, art, bx, by, b.r, b.kind, halo);
        }
    }
    for (const a of w.pickups) {
        if (a.got)
            continue;
        const y = a.y + Math.sin(a.bob) * 4;
        if (a.kind === "acorn")
            drawSprite(ctx, frameOf(art.acorn, w.time, 10), a.x, y, 28);
        else if (a.kind === "gold")
            drawSprite(ctx, frameOf(art.golden, w.time, 10), a.x, y, 32);
        else if (a.kind === "slow") {
            // the frozen acorn is its own painting now — no ring needed to say
            // what it does, the frost says it
            drawSprite(ctx, frameOf(art.frozenAnim, w.time, 10) ?? art.frozen ?? frameOf(art.acorn, w.time, 10), a.x, y, 32);
            ctx.strokeStyle = `rgba(150,225,255,${0.28 + 0.16 * Math.sin(w.time * 6)})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(a.x, y, 20 + Math.sin(w.time * 6) * 1.6, 0, Math.PI * 2);
            ctx.stroke();
        }
        else if (a.kind === "shield") {
            drawSprite(ctx, frameOf(art.shieldAnim, w.time, 10) ?? art.shieldnut, a.x, y, 34);
        }
        else if (a.kind === "hole" || a.kind === "worm") {
            // Both vortices have painted spin cycles now (beta). Full-canvas draw
            // at a fixed footprint: the glow makes each frame's alpha box breathe,
            // so drawSprite's box fit would visibly jitter the size. 16 frames at
            // ~9fps matches the clips' native pacing; the cycles loop seamlessly.
            const spin = frameOf(a.kind === "worm" ? art.wormAnim : art.holeAnim, w.time, 9);
            if (spin) {
                const s = (a.r ?? 28) * 4;
                ctx.drawImage(spin, a.x - s / 2, y - s / 2, s, s);
            }
            else {
                drawVortex(ctx, a.x, y, a.kind === "worm", w.time, a.r ?? 28);
            }
        }
        else if (a.kind === "portal") {
            drawFinishPortal(ctx, a.x, y, w.time, a.r ?? 64, warpMirroredNow(w));
        }
        else if (a.kind === "retro") {
            drawShiftAcorn(ctx, art, a.x, y, w.time);
        }
    }
    for (const p of w.particles)
        drawParticle(ctx, p);
    if (w.lvl) {
        const fx = w.lvl.def.fx;
        const px = W * PHYS.squirrelX;
        const py = w.squirrel.y;
        if (fx.fog) {
            // a sight circle: the world exists as far as you can see it
            const sight = Math.max(90, w.H * (0.62 - 0.4 * fx.fog));
            const g = ctx.createRadialGradient(px, py, sight * 0.55, px, py, sight * 1.5);
            g.addColorStop(0, "rgba(4,6,14,0)");
            g.addColorStop(1, `rgba(4,6,14,${(0.55 + 0.43 * fx.fog).toFixed(3)})`);
            ctx.fillStyle = g;
            ctx.fillRect(-w.W, -w.H, w.W * 3, w.H * 3);
        }
        if (fx.strobe && !w.ready) {
            // THE BLACKOUT: a tap is a flashbulb. Light for a beat, a fast
            // fade, then darkness the memory has to fly through. The world
            // stays faintly embered (0.94, not 1.0) so the screen never reads
            // as broken — just unlit.
            const t = w.lvl.strobeT;
            // FULL black, not 0.94: the owner flew this and could still read the
            // planets through it, which turns "fly by memory" into "fly by
            // squinting". A blackout that leaks is not a blackout.
            const a = t < 0.12 ? 0 : Math.min(1, (t - 0.12) / 0.38);
            if (a > 0) {
                ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
                ctx.fillRect(-w.W, -w.H, w.W * 3, w.H * 3);
            }
        }
    }
    // NIGHTGLIDER. The story-mode strobe stops at 0.94 so a level never reads
    // as broken; the owner's note was that planets stayed visible through it,
    // and for this pal that is the whole point of the item - so this one goes
    // to FULL black. Drawn after the world and before the pal, so the
    // companion and the pilot stay lit and the pilot is never flying blind
    // about where they themselves are.
    if (save.equippedPal === "nightglider" && !save.noPalFx && !w.ready && !w.lvl && w.screen === "play") {
        const t = w.lampT;
        const a = t < 0.12 ? 0 : Math.min(1, ((t - 0.12) / 0.28));
        if (a > 0) {
            ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
            ctx.fillRect(-w.W, -w.H, w.W * 3, w.H * 3);
        }
    }
    const pal = w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo" || w.tut.stage === "ready")
        ? "buddy"
        : save.equippedPal;
    if (pal && pal !== "none") {
        const bob = Math.sin(w.time * 2.6) * 2;
        paintPal(ctx, art, pal, w.palPos.x, w.palPos.y + bob, 26, w.time);
    }
    drawPilot(ctx, w, save, art);
    // The shield and golden rings belong to the PILOT, so they must be
    // drawn inside the warp transform with him. Outside it they were laid
    // down in untransformed screen space, and in Lost in Space — where the
    // world rotates continuously — they drifted off on their own.
    if (w.invulnLeft > 0) {
        ctx.strokeStyle = `rgba(255,208,96,${0.35 + 0.25 * Math.sin(w.time * 10)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 30, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (w.shieldCharges > 0) {
        ctx.strokeStyle = "rgba(122,216,255,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 26, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
}
const TUNNEL_PALETTES = [
    { bg: [[116, 56, 214], [37, 18, 105], [11, 18, 52], [3, 4, 13]], core: [151, 102, 255], streakA: [119, 237, 255], streakB: [211, 123, 255], ringA: [151, 222, 255], ringB: [187, 113, 255], wall: [[9, 7, 19], [23, 16, 45], [56, 32, 95], [81, 48, 138]], top: [203, 107, 255], bottom: [89, 202, 255] },
    { bg: [[20, 174, 198], [11, 86, 118], [5, 32, 61], [2, 9, 18]], core: [77, 235, 255], streakA: [133, 255, 238], streakB: [83, 173, 255], ringA: [135, 255, 239], ringB: [83, 172, 255], wall: [[3, 13, 22], [5, 35, 53], [8, 78, 95], [17, 116, 132]], top: [103, 255, 222], bottom: [83, 174, 255] },
    { bg: [[213, 83, 58], [104, 28, 72], [39, 12, 48], [9, 4, 15]], core: [255, 143, 92], streakA: [255, 215, 130], streakB: [255, 97, 181], ringA: [255, 208, 132], ringB: [255, 105, 183], wall: [[19, 7, 13], [48, 13, 29], [101, 29, 50], [142, 49, 65]], top: [255, 174, 101], bottom: [255, 92, 177] },
    { bg: [[27, 170, 120], [8, 91, 78], [4, 40, 42], [2, 10, 16]], core: [92, 255, 195], streakA: [153, 255, 184], streakB: [73, 220, 216], ringA: [142, 255, 183], ringB: [73, 222, 216], wall: [[4, 16, 17], [6, 42, 38], [10, 79, 64], [17, 118, 87]], top: [143, 255, 179], bottom: [70, 224, 216] },
    { bg: [[117, 31, 160], [28, 10, 59], [8, 7, 24], [1, 2, 7]], core: [225, 170, 255], streakA: [255, 226, 145], streakB: [198, 108, 255], ringA: [255, 226, 148], ringB: [199, 112, 255], wall: [[6, 4, 12], [17, 9, 31], [42, 17, 64], [73, 28, 94]], top: [255, 218, 133], bottom: [197, 106, 255] },
];
const mixChannel = (a, b, f) => Math.round(a + (b - a) * f);
function mixRgb(a, b, f) {
    return [mixChannel(a[0], b[0], f), mixChannel(a[1], b[1], f), mixChannel(a[2], b[2], f)];
}
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function tunnelPalette(w) {
    const t = w.tunnel;
    const from = TUNNEL_PALETTES[t.previousRegion % TUNNEL_PALETTES.length];
    const to = TUNNEL_PALETTES[t.activeRegion % TUNNEL_PALETTES.length];
    const f = t.regionBlend;
    return {
        bg: from.bg.map((c, i) => mixRgb(c, to.bg[i], f)),
        core: mixRgb(from.core, to.core, f),
        streakA: mixRgb(from.streakA, to.streakA, f),
        streakB: mixRgb(from.streakB, to.streakB, f),
        ringA: mixRgb(from.ringA, to.ringA, f),
        ringB: mixRgb(from.ringB, to.ringB, f),
        wall: from.wall.map((c, i) => mixRgb(c, to.wall[i], f)),
        top: mixRgb(from.top, to.top, f),
        bottom: mixRgb(from.bottom, to.bottom, f),
    };
}
function drawTunnelWorld(ctx, w, save, art) {
    const { W, H } = w;
    const tunnel = w.tunnel;
    const palette = tunnelPalette(w);
    const flowGlow = tunnel.multiplier === 3 ? 1.34 : tunnel.multiplier === 2 ? 1.16 : 1;
    const mouth = tunnelBoundsAt(w, W * 0.94);
    const vanishingY = (mouth.top + mouth.bottom) * 0.5;
    const bg = ctx.createRadialGradient(W * 1.04, vanishingY, 8, W * 0.96, vanishingY, Math.max(W, H) * 0.9);
    bg.addColorStop(0, rgb(palette.bg[0]));
    bg.addColorStop(0.18, rgb(palette.bg[1]));
    bg.addColorStop(0.56, rgb(palette.bg[2]));
    bg.addColorStop(1, rgb(palette.bg[3]));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const tunnelPath = () => {
        ctx.beginPath();
        tunnel.nodes.forEach((n, i) => i ? ctx.lineTo(n.x, n.top) : ctx.moveTo(n.x, n.top));
        for (let i = tunnel.nodes.length - 1; i >= 0; i--)
            ctx.lineTo(tunnel.nodes[i].x, tunnel.nodes[i].bottom);
        ctx.closePath();
    };
    // All depth cues are clipped to the playable corridor, so the painted
    // wormhole and the collision geometry always agree.
    ctx.save();
    tunnelPath();
    ctx.clip();
    const core = ctx.createRadialGradient(W * 1.03, vanishingY, 0, W * 1.03, vanishingY, W * 1.15);
    core.addColorStop(0, rgba(palette.core, Math.min(0.94, 0.72 * flowGlow)));
    core.addColorStop(0.2, rgba(palette.bottom, 0.22 * flowGlow));
    core.addColorStop(0.55, rgba(palette.bg[2], 0.12));
    core.addColorStop(1, "rgba(0,0,0,.48)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 22; i++) {
        const phase = ((i * 73 - w.distance * (0.55 + (i % 5) * 0.05)) % (W + 180) + W + 180) % (W + 180) - 90;
        const b = tunnelBoundsAt(w, phase);
        const y = b.top + (b.bottom - b.top) * ((i * 0.417) % 1);
        const len = 22 + (i % 6) * 9 + w.speed * 0.055;
        ctx.strokeStyle = i % 3 === 0 ? rgba(palette.streakA, 0.34 * flowGlow) : rgba(palette.streakB, 0.25 * flowGlow);
        ctx.lineWidth = 0.8 + (i % 3) * 0.65;
        ctx.beginPath();
        ctx.moveTo(phase - len, y + (y - vanishingY) * 0.035);
        ctx.lineTo(phase + 5, y);
        ctx.stroke();
    }
    for (let x = W + 40 - ((w.distance * 0.82) % 76); x > -55; x -= 76) {
        const b = tunnelBoundsAt(w, x);
        const cy = (b.top + b.bottom) * 0.5;
        const half = (b.bottom - b.top) * 0.5;
        const depth = Math.max(0, Math.min(1, (x + 55) / (W + 95)));
        ctx.strokeStyle = rgba(depth > 0.55 ? palette.ringA : palette.ringB, (0.07 + depth * 0.16) * flowGlow);
        ctx.lineWidth = 0.8 + depth * 1.7;
        ctx.beginPath();
        ctx.ellipse(x, cy, 8 + depth * 17, Math.max(12, half * 0.94), 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    const wall = (top) => {
        // Both walls run dark at the outer screen edge to bright at the live
        // collision boundary. Mirroring the gradient keeps the lower wall
        // from collapsing into one flat final-stop color.
        const g = top
            ? ctx.createLinearGradient(0, 0, W, H * 0.28)
            : ctx.createLinearGradient(0, H, W, H * 0.72);
        g.addColorStop(0, rgb(palette.wall[0]));
        g.addColorStop(0.45, rgb(palette.wall[1]));
        g.addColorStop(0.78, rgb(palette.wall[2]));
        g.addColorStop(1, rgb(palette.wall[3]));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(tunnel.nodes[0].x, top ? 0 : H);
        for (const n of tunnel.nodes)
            ctx.lineTo(n.x, top ? n.top : n.bottom);
        ctx.lineTo(tunnel.nodes[tunnel.nodes.length - 1].x, top ? 0 : H);
        ctx.closePath();
        ctx.fill();
    };
    wall(true);
    wall(false);
    // Layered contours give the walls thickness without adding fake hitboxes.
    for (const offset of [12, 28, 48]) {
        for (const top of [true, false]) {
            ctx.strokeStyle = rgba(top ? palette.top : palette.bottom, (0.17 - offset * 0.0018) * flowGlow);
            ctx.lineWidth = offset === 12 ? 2 : 1;
            ctx.beginPath();
            tunnel.nodes.forEach((n, i) => {
                const y = (top ? n.top - offset : n.bottom + offset) + Math.sin(n.index * 0.52 + tunnel.visualT * 1.8) * 2;
                if (i === 0)
                    ctx.moveTo(n.x, y);
                else
                    ctx.lineTo(n.x, y);
            });
            ctx.stroke();
        }
    }
    for (const top of [true, false]) {
        ctx.strokeStyle = rgba(top ? palette.top : palette.bottom, 0.96);
        ctx.shadowColor = rgb(top ? palette.top : palette.bottom);
        ctx.shadowBlur = 14 * flowGlow;
        ctx.lineWidth = 4;
        ctx.beginPath();
        tunnel.nodes.forEach((n, i) => {
            const y = top ? n.top : n.bottom;
            if (i === 0)
                ctx.moveTo(n.x, y);
            else
                ctx.lineTo(n.x, y);
        });
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // Debris is born beyond the right edge. This edge beacon appears about
    // a second before impact range, buying reaction time without drawing a
    // fake safe path through the real collision geometry.
    for (const h of tunnel.hazards) {
        if (h.x < W - 28 || h.x > W + 190)
            continue;
        const eta = Math.max(0, Math.min(1, (h.x - (W - 28)) / 218));
        const pulse = 0.58 + Math.sin(w.time * 9) * 0.22;
        ctx.save();
        ctx.globalAlpha = (1 - eta * 0.45) * pulse;
        const guide = () => {
            ctx.beginPath();
            ctx.moveTo(W - 25, h.y);
            ctx.lineTo(W, h.y);
            ctx.stroke();
        };
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "rgba(18,3,15,.96)";
        ctx.lineWidth = 5;
        guide();
        ctx.strokeStyle = "#fff0d2";
        ctx.lineWidth = 1.8;
        guide();
        ctx.setLineDash([]);
        const chevron = () => {
            ctx.beginPath();
            ctx.moveTo(W - 22, h.y);
            ctx.lineTo(W - 8, h.y - 9);
            ctx.lineTo(W - 8, h.y + 9);
            ctx.closePath();
        };
        chevron();
        ctx.fillStyle = "rgba(255,90,76,.72)";
        ctx.fill();
        chevron();
        ctx.strokeStyle = "rgba(18,3,15,.96)";
        ctx.lineWidth = 5;
        ctx.stroke();
        chevron();
        ctx.strokeStyle = "#fff0d2";
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
    }
    for (const h of tunnel.hazards) {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(tunnel.visualT * h.spin);
        const rock = art.debris[h.art % Math.max(1, art.debris.length)];
        if (rock)
            drawSprite(ctx, rock, 0, 0, h.r * 2.35, "core", "light");
        else {
            ctx.fillStyle = "#6e5a79";
            ctx.beginPath();
            ctx.arc(0, 0, h.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = "rgba(18,3,15,.88)";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,244,218,${0.68 + 0.18 * Math.sin(w.time * 5)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r + 5, 0, Math.PI * 2);
        ctx.stroke();
    }
    for (const a of w.pickups) {
        if (a.got)
            continue;
        const y = a.y + Math.sin(a.bob) * 4;
        if (a.kind === "multiplier") {
            ctx.strokeStyle = "rgba(255,238,128,.85)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(a.x, y, 21 + Math.sin(w.time * 5) * 2, 0, Math.PI * 2);
            ctx.stroke();
            drawSprite(ctx, frameOf(art.golden, w.time, 10) ?? frameOf(art.acorn, w.time, 10), a.x, y, 33);
            ctx.fillStyle = "#fff";
            ctx.font = "900 10px Figtree, system-ui";
            ctx.textAlign = "center";
            ctx.fillText("FLOW", a.x, y + 4);
        }
        else if (a.kind === "slow") {
            drawSprite(ctx, frameOf(art.frozenAnim, w.time, 10) ?? art.frozen ?? frameOf(art.acorn, w.time, 10), a.x, y, 33);
            ctx.strokeStyle = `rgba(150,225,255,${0.35 + 0.2 * Math.sin(w.time * 6)})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(a.x, y, 21 + Math.sin(w.time * 6) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }
        else if (a.exit) {
            // THE WAY HOME, and it has to read as a door from across the screen.
            // The corridor's own else-branch drew every unknown kind as an acorn,
            // which would have made the exit look like one more pickup to graze
            // past - the opposite of the one thing the pilot must aim at.
            const spin = frameOf(art.wormAnim, w.time, 9);
            const r = a.r ?? 46;
            if (spin) {
                const sz = r * 4;
                ctx.drawImage(spin, a.x - sz / 2, y - sz / 2, sz, sz);
            }
            else {
                drawVortex(ctx, a.x, y, true, w.time, r);
            }
            ctx.strokeStyle = `rgba(201,140,255,${0.45 + 0.3 * Math.sin(w.time * 5)})`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(a.x, y, r + 6 + Math.sin(w.time * 5) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        else
            drawSprite(ctx, frameOf(art.acorn, w.time, 10), a.x, y, 28);
    }
    for (const p of w.particles)
        drawParticle(ctx, p);
    if (w.powerLeft > 0) {
        const frost = ctx.createRadialGradient(W * PHYS.squirrelX, w.squirrel.y, 25, W * PHYS.squirrelX, w.squirrel.y, Math.max(W, H) * 0.72);
        frost.addColorStop(0, "rgba(130,225,255,0)");
        frost.addColorStop(1, "rgba(82,188,255,.13)");
        ctx.fillStyle = frost;
        ctx.fillRect(0, 0, W, H);
    }
    const pal = save.equippedPal;
    if (pal && pal !== "none") {
        const bob = Math.sin(w.time * 2.6) * 2;
        paintPal(ctx, art, pal, w.palPos.x, w.palPos.y + bob, 26, w.time);
    }
    drawPilot(ctx, w, save, art);
}
// The other timeline. Same planets in the same places, same rocks with
// the same seeds — only the hand painting them changes. Everything a
// player can touch comes from the identical world objects, so a shift
// never changes what is solid, only what it looks like.
function drawRetroWorld(ctx, w, save, art) {
    const { W } = w;
    for (const p of w.planets) {
        const gy = liveGapY(p, w);
        retroPlanet(ctx, p.x, gy - p.gap / 2 - p.r, p.r, p.topKind);
        retroPlanet(ctx, p.x, gy + p.gap / 2 + p.r, p.r, p.botKind);
        for (const b of p.blockers) {
            const by = b.y + gateOffset(p, w);
            retroObstacle(ctx, p.x + b.xOff, by, { r: b.r, ...retroBlocker(w.envB, b.debris, b.y) });
        }
    }
    for (const a of w.pickups) {
        if (a.got)
            continue;
        const y = a.y + Math.sin(a.bob) * 4;
        if (a.kind === "retro") {
            drawShiftAcorn(ctx, art, a.x, y, w.time);
            continue;
        }
        const power = a.kind === "gold" ? "golden"
            : a.kind === "shield" ? "shield"
                : a.kind === "hole" ? "blackhole"
                    : a.kind === "worm" ? "wormhole"
                        : a.kind === "slow";
        retroAcorn(ctx, a.x, y, power);
    }
    for (const p of w.particles)
        drawParticle(ctx, p);
    if (w.lvl) {
        const fx = w.lvl.def.fx;
        const px = W * PHYS.squirrelX;
        const py = w.squirrel.y;
        if (fx.fog) {
            // a sight circle: the world exists as far as you can see it
            const sight = Math.max(90, w.H * (0.62 - 0.4 * fx.fog));
            const g = ctx.createRadialGradient(px, py, sight * 0.55, px, py, sight * 1.5);
            g.addColorStop(0, "rgba(4,6,14,0)");
            g.addColorStop(1, `rgba(4,6,14,${(0.55 + 0.43 * fx.fog).toFixed(3)})`);
            ctx.fillStyle = g;
            ctx.fillRect(-w.W, -w.H, w.W * 3, w.H * 3);
        }
        if (fx.strobe && !w.ready) {
            // THE BLACKOUT: a tap is a flashbulb. Light for a beat, a fast
            // fade, then darkness the memory has to fly through. The world
            // stays faintly embered (0.94, not 1.0) so the screen never reads
            // as broken — just unlit.
            const t = w.lvl.strobeT;
            // FULL black, not 0.94: the owner flew this and could still read the
            // planets through it, which turns "fly by memory" into "fly by
            // squinting". A blackout that leaks is not a blackout.
            const a = t < 0.12 ? 0 : Math.min(1, (t - 0.12) / 0.38);
            if (a > 0) {
                ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
                ctx.fillRect(-w.W, -w.H, w.W * 3, w.H * 3);
            }
        }
    }
    const pal = w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo" || w.tut.stage === "ready")
        ? "buddy"
        : save.equippedPal;
    if (pal && pal !== "none") {
        const bob = Math.sin(w.time * 2.6) * 2;
        // live draws its pals at unit SCALE, not at a pixel size
        drawPalOn(ctx, pal, w.palPos.x, w.palPos.y + bob, 1, w.time);
    }
    const helm = helmetWornBy(save.equipped, save.equippedSuit);
    const suit = SUITS.find((u) => u.id === save.equippedSuit) ?? SUITS[0];
    drawAstronautOn(ctx, W * PHYS.squirrelX, w.squirrel.y, w.squirrel.rot, 1, helm, suit, {
        flame: w.flapBoost > 0 ? w.flapBoost / 0.22 : 0,
        seed: 0,
        shield: w.shieldCharges > 0,
    });
}
// The door itself. Painted in the arcade's own pixels either way, so it
// reads the same from both sides — this is the one object that belongs
// to neither timeline.
function drawShiftAcorn(ctx, art, x, y, t) {
    const spr = art.arcadeAcorn;
    const glow = 20 + Math.sin(t * 5) * 4;
    const g = ctx.createRadialGradient(x, y, 2, x, y, glow + 12);
    g.addColorStop(0, "rgba(255,214,96,0.55)");
    g.addColorStop(0.5, "rgba(255,170,40,0.22)");
    g.addColorStop(1, "rgba(255,170,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, glow + 12, 0, Math.PI * 2);
    ctx.fill();
    // the four cardinal sparks from the source art, kept as real pixels
    ctx.fillStyle = "#ffd83f";
    const d = 20 + Math.sin(t * 5) * 2;
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + t * 0.8;
        ctx.fillRect(Math.round(x + Math.cos(a) * d) - 2, Math.round(y + Math.sin(a) * d) - 2, 4, 4);
    }
    if (spr) {
        ctx.imageSmoothingEnabled = false;
        drawSprite(ctx, spr, x, y, 30);
        ctx.imageSmoothingEnabled = true;
    }
}
// The finish line. It borrows the wormhole's language — a swirl you fly
// into — but in gold and green, the game's reward colours, so it reads as
// an arrival on first sight.
// Whether applyWarp() has the playfield horizontally mirrored RIGHT NOW —
// the same wp math it uses, reduced to the sign of its x-scale. World-space
// text must counter-flip by this, or a black hole near the finish leaves
// the FINISH banner reading backwards.
function warpMirroredNow(w) {
    const lost = w.flight === "lost";
    const wp = w.warpT > 0 ? 1 - w.warpT : w.warpLeft > 0 || w.warpGateEnd >= 0 || lost ? 1 : 0;
    if (wp <= 0)
        return false;
    const mFrom = w.prevMirror ? -1 : 1;
    const mTo = w.warpMirror ? -1 : 1;
    return mFrom + (mTo - mFrom) * wp < 0;
}
function drawFinishPortal(ctx, x, y, t, reach = 64, mirrored = false) {
    const k = reach / 28;
    const pulse = (12 + Math.sin(t * 4) * 3) * k;
    const grd = ctx.createRadialGradient(x, y, 2 * k, x, y, pulse + 14 * k);
    grd.addColorStop(0, "#fff8dc");
    grd.addColorStop(0.4, "#ffd060");
    grd.addColorStop(0.75, "rgba(93,255,158,0.5)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, pulse + 14 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 1.6);
    ctx.strokeStyle = "rgba(255,224,128,0.75)";
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, (7 + i * 5.5) * k * 0.55, i * 1.3, i * 1.3 + 2.4);
        ctx.stroke();
    }
    ctx.restore();
    ctx.textAlign = "center";
    ctx.font = "800 13px Figtree, system-ui";
    ctx.fillStyle = `rgba(255,236,180,${0.75 + 0.25 * Math.sin(t * 5)})`;
    ctx.save();
    ctx.translate(x, y - reach - 8);
    if (mirrored)
        ctx.scale(-1, 1);
    ctx.fillText("FINISH", 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
}
function drawVortex(ctx, x, y, worm, t, reach = 28) {
    // the swirl fills its reach: a hazard you can see the full width of
    const k = reach / 28;
    const pulse = (12 + Math.sin(t * 6) * 3) * k;
    const grd = ctx.createRadialGradient(x, y, 2 * k, x, y, pulse + 14 * k);
    grd.addColorStop(0, worm ? "#d8f6ff" : "#1a1028");
    grd.addColorStop(0.45, worm ? "#4ad8ff" : "#6a2a9a");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, pulse + 14 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (worm ? 3 : -2.2));
    ctx.strokeStyle = worm ? "rgba(180,240,255,0.55)" : "rgba(180,90,255,0.45)";
    ctx.lineWidth = 1.4 * Math.max(1, k * 0.7);
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, (6 + i * 5) * k, i, i + 2.2);
        ctx.stroke();
    }
    ctx.restore();
}
function drawParticle(ctx, p) {
    const t = Math.max(0, p.life / p.max);
    ctx.globalAlpha = t;
    const kind = p.kind || "spark";
    if (kind === "ion") {
        ctx.strokeStyle = t > 0.5 ? "#c8f4ff" : "#3ac0f0";
        ctx.lineWidth = Math.max(0.8, p.r * t);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 9, p.y);
        ctx.stroke();
    }
    else if (kind === "bubble") {
        ctx.strokeStyle = "rgba(170,220,255,0.9)";
        ctx.lineWidth = 1;
        const br = t > 0.25 ? p.r : p.r * (1 + (0.25 - t) * 6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, br, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(200,235,255,0.25)";
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "bloom") {
        ctx.fillStyle = t > 0.5 ? "#f0b8ff" : "#a45cd8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (2 - t), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = t * 0.5;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "comet") {
        const len = 10 + p.r * 3;
        const grad = ctx.createLinearGradient(p.x, p.y, p.x + len, p.y);
        grad.addColorStop(0, "#fff8d0");
        grad.addColorStop(0.4, "#ff9d47");
        grad.addColorStop(1, "rgba(255,64,32,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, p.r * t);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + len, p.y);
        ctx.stroke();
    }
    else if (kind === "cometcore") {
        ctx.fillStyle = "#fff8d0";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "prism") {
        ctx.fillStyle = `hsl(${p.hue || 0} 90% 65%)`;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(((p.hue || 0) * Math.PI) / 180);
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        ctx.restore();
    }
    else if (kind === "plasma") {
        ctx.strokeStyle = "#b45cff";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const seed = p.seed || 1;
        ctx.lineTo(p.x + 8, p.y + Math.sin(seed) * 6);
        ctx.lineTo(p.x + 16, p.y - Math.cos(seed) * 4);
        ctx.stroke();
    }
    else if (kind === "plasmacore") {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "galaxy") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = t * 0.5;
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x - 0.6, p.y - 2.4, 1.2, 4.8);
        ctx.fillRect(p.x - 2.4, p.y - 0.6, 4.8, 1.2);
    }
    else if (kind === "aurora") {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.55;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 2.2, p.r * 0.7, 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "frost") {
        ctx.strokeStyle = "#9fe4ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.r);
        ctx.lineTo(p.x, p.y + p.r);
        ctx.moveTo(p.x - p.r, p.y);
        ctx.lineTo(p.x + p.r, p.y);
        ctx.stroke();
    }
    else if (kind === "voidsmoke") {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.6 - t), 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "supernova") {
        ctx.fillStyle = t > 0.5 ? "#fff8d0" : t > 0.25 ? "#ff9d47" : "#ff4020";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.4 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "opalfeather") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(((p.hue || 0) * Math.PI) / 180);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.r * 2.1, 0);
        ctx.quadraticCurveTo(-p.r * 0.2, -p.r * 1.15, p.r * 1.7, 0);
        ctx.quadraticCurveTo(-p.r * 0.2, p.r * 0.75, -p.r * 2.1, 0);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.78)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-p.r * 1.6, 0);
        ctx.lineTo(p.r * 1.4, 0);
        ctx.stroke();
        ctx.restore();
    }
    else if (kind === "clockwork") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(((p.hue || 0) * Math.PI) / 180);
        ctx.strokeStyle = p.color;
        ctx.fillStyle = "rgba(255,224,145,.16)";
        ctx.lineWidth = Math.max(0.8, p.r * 0.28);
        ctx.shadowColor = "#f4b94f";
        ctx.shadowBlur = 3;
        for (let i = 0; i < 8; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(p.r * 0.78, -p.r * 0.28, p.r * 0.62, p.r * 0.56);
        }
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    else if (kind === "celestialtide") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = p.color;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(0.8, p.r * 0.36);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        const wave = Math.sin((p.seed || 0) + p.x * 0.04) * p.r;
        ctx.beginPath();
        ctx.moveTo(-p.r * 2.2, wave * 0.25);
        ctx.quadraticCurveTo(-p.r * 0.4, -p.r * 1.35, p.r * 1.7, wave * 0.4);
        ctx.stroke();
        ctx.globalAlpha = t * 0.55;
        ctx.beginPath();
        ctx.moveTo(-p.r * 1.7, p.r * 0.8);
        ctx.quadraticCurveTo(0, -p.r * 0.25, p.r * 1.4, p.r * 0.7);
        ctx.stroke();
        ctx.restore();
    }
    else if (kind === "phoenixplume") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(-0.3 + ((p.hue || 0) * Math.PI) / 360);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.r * 2.4, p.r * 0.2);
        ctx.quadraticCurveTo(-p.r * 0.4, -p.r * 1.7, p.r * 1.5, -p.r * 0.35);
        ctx.quadraticCurveTo(p.r * 0.2, p.r * 0.1, p.r * 1.15, p.r * 1.15);
        ctx.quadraticCurveTo(-p.r * 0.6, p.r * 0.7, -p.r * 2.4, p.r * 0.2);
        ctx.fill();
        ctx.strokeStyle = "#fff3bd";
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(-p.r * 1.8, p.r * 0.18);
        ctx.lineTo(p.r, 0);
        ctx.stroke();
        ctx.restore();
    }
    else if (kind === "verdantflourish") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(((p.hue || 0) * Math.PI) / 180);
        ctx.shadowColor = "#55e89d";
        ctx.shadowBlur = 5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.r * 1.6, 0);
        ctx.quadraticCurveTo(0, -p.r * 1.45, p.r * 1.65, 0);
        ctx.quadraticCurveTo(0, p.r * 1.15, -p.r * 1.6, 0);
        ctx.fill();
        ctx.strokeStyle = "rgba(235,255,216,.85)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-p.r * 1.25, 0);
        ctx.lineTo(p.r * 1.25, 0);
        ctx.stroke();
        ctx.fillStyle = "#efffc8";
        ctx.beginPath();
        ctx.arc(-p.r * 1.8, -p.r, 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    else if (kind === "eclipseglyph") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(((p.hue || 0) * Math.PI) / 180);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.8, p.r * 0.3);
        ctx.shadowColor = "#c77dff";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0.55, Math.PI * 1.72);
        ctx.stroke();
        ctx.globalAlpha = t * 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 1.55, 3.5, 5.75);
        ctx.stroke();
        ctx.fillStyle = "#ffe2bd";
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(p.r * 1.35, -0.75, 1.5, 1.5);
        ctx.restore();
    }
    else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}
function drawPlanet(ctx, art, x, y, r, kind, halo) {
    const img = art.planets[kind % art.planets.length];
    if (img) {
        drawSprite(ctx, img, x, y, r * 2, "core", halo);
        return;
    }
    ctx.fillStyle = "#3a6aa8";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}
function hexRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// Where the glass dome sits in each 256px body render (x, y, radius),
// measured from the paintings themselves. Flight frames key by frame
// name, suit renders by suit id. The equipped helmet paints its
// identity — tinted glass, rim, glow — exactly onto the painted dome.
// Where the painted helmet sits on each body (x, y, r in sprite space).
// Seraph, Leviathan, Gemmie and Sammie ship bare-headed — their art
// carries no helmet of its own.
//
// Position and scale solve two different problems here. The x/y values are
// the hand-fitted centres from the rig editor. The radius is normalised by
// each suit's runtime-trimmed box, because the renderer scales that box to a
// common display size. Keeping raw radii equal would therefore make a helmet
// grow and shrink as the player switches suits.
//
// Gemmie and Sammie are the approved visual reference. The twelve base suits
// target r / max(trimmed box) ~= 0.239, within one source pixel of that target.
// Their helmet footprint now varies by less than 2% on screen; small raw-radius
// differences remain only to compensate for each painting's crop.
const DOME = {
    "idle-1": [192, 106, 56],
    "idle-2": [192, 103, 51],
    "idle-3": [192, 102, 53],
    "idle-4": [194, 99, 51],
    "flap-1": [169, 86, 48],
    "flap-2": [164, 93, 50],
    "flap-3": [164, 79, 48],
    "flap-4": [163, 80, 45],
    // The twelve originals were re-rendered bare-headed, so every one of
    // these was measured again against flight's face. Ghost is the exception
    // and still wears a painted dome -- see bakedDome in catalog.ts.
    // ---------------------------------------------------------------- TAP
    // PER-POSE DOME ANCHORS. Three suits have tap banks that MOVE THE HEAD -
    // robo, bigbooty and eclipse - and the single "suit:<id>" anchor is right
    // for exactly one of the sixteen poses. The other fifteen leave the glass
    // behind: at loadout size the head walks clean out of the helmet.
    //
    // The other fifteen rigged suits do NOT need this. Their banks animate the
    // TAIL and hold the head still, which is why the one anchor has always
    // been fine for them - checked by rendering every one of them with a
    // helmet through all sixteen frames.
    //
    // Measured, not guessed: a head patch cut from each suit's own static
    // render is matched through its bank in the bank's reference box, then the
    // track is median-filtered because a head cannot teleport between frames.
    // Robo and Eclipse tracked cleanly (smoothing moved <= 4px); Big Booty's
    // matcher loses a small head against a large body, so its numbers moved up
    // to 14px and were checked by eye rather than trusted outright.
    "robo-tap-1": [190, 103, 40],
    "robo-tap-2": [190, 103, 40],
    "robo-tap-3": [190, 101, 40],
    "robo-tap-4": [191, 96, 40],
    "robo-tap-5": [191, 88, 40],
    "robo-tap-6": [192, 82, 40],
    "robo-tap-7": [192, 80, 40],
    "robo-tap-8": [191, 84, 40],
    "robo-tap-9": [190, 93, 40],
    "robo-tap-10": [189, 103, 40],
    "robo-tap-11": [189, 110, 40],
    "robo-tap-12": [190, 111, 40],
    "robo-tap-13": [191, 110, 40],
    "robo-tap-14": [192, 107, 40],
    "robo-tap-15": [191, 104, 40],
    "robo-tap-16": [191, 100, 40],
    "bigbooty-tap-1": [209, 83, 41],
    "bigbooty-tap-2": [209, 84, 41],
    "bigbooty-tap-3": [209, 81, 41],
    "bigbooty-tap-4": [209, 74, 41],
    "bigbooty-tap-5": [210, 67, 41],
    "bigbooty-tap-6": [211, 66, 41],
    "bigbooty-tap-7": [209, 72, 41],
    "bigbooty-tap-8": [205, 82, 41],
    "bigbooty-tap-9": [206, 82, 41],
    "bigbooty-tap-10": [212, 73, 41],
    "bigbooty-tap-11": [216, 69, 41],
    "bigbooty-tap-12": [212, 74, 41],
    "bigbooty-tap-13": [206, 82, 41],
    "bigbooty-tap-14": [203, 85, 41],
    "bigbooty-tap-15": [205, 80, 41],
    "bigbooty-tap-16": [209, 75, 41],
    "eclipse-tap-1": [196, 89, 53],
    "eclipse-tap-2": [196, 87, 53],
    "eclipse-tap-3": [194, 81, 53],
    "eclipse-tap-4": [190, 73, 53],
    "eclipse-tap-5": [186, 66, 53],
    "eclipse-tap-6": [183, 60, 53],
    "eclipse-tap-7": [182, 59, 53],
    "eclipse-tap-8": [183, 61, 53],
    "eclipse-tap-9": [186, 67, 53],
    "eclipse-tap-10": [191, 76, 53],
    "eclipse-tap-11": [195, 82, 53],
    "eclipse-tap-12": [197, 85, 53],
    "eclipse-tap-13": [198, 87, 53],
    "eclipse-tap-14": [198, 88, 53],
    "eclipse-tap-15": [198, 88, 53],
    "eclipse-tap-16": [198, 88, 53],
    "suit:flight": [185, 82, 44],
    "suit:iontrim": [178, 88, 48],
    "suit:copper": [183, 85, 45],
    "suit:frost": [186, 98, 43],
    "suit:voidsuit": [181, 102, 42],
    "suit:aurorasuit": [181, 101, 44],
    "suit:ember": [182, 100, 44],
    "suit:stardust": [179, 95, 44],
    // owner-tuned: the dome was drawn a size too big, so the glass swallowed
    // the head instead of sitting on it
    "suit:robo": [181, 99, 38],
    // re-rendered bare-headed on a black plate (the pale-on-cream key was
    // unrecoverable); measured against the new art, and near-identical to
    // flight, which is the same pose in the same framing
    "suit:ghost": [182, 93, 44],
    // owner-tuned: sat low, left and oversized - the glass cut into the body
    // and the head walked out of it on the late tap poses
    "suit:bigbooty": [185, 101, 35],
    "suit:catsuit": [212, 86, 50],
    "suit:gemmie": [204, 92, 58],
    "suit:phoenix": [207, 92, 41],
    "suit:sammie": [206, 90, 59],
    "suit:seraph": [207, 97, 57],
    "suit:leviathan": [207, 81, 57],
    "suit:verdant": [204, 93, 58],
    "suit:cryostar": [207, 93, 58],
    "suit:eclipse": [204, 86, 58],
    // Eclipse's physics-pose banks are HEAD-NORMALIZED: every frame is
    // scaled so the (rigid) head is identical, which pins the character's
    // on-screen size and makes the dome one constant radius. Anchors are
    // auto-measured per frame (merged-blob dive frames interpolated).
    "eclipse-asc-1": [186, 80, 52],
    "eclipse-asc-2": [185, 78, 52],
    "eclipse-asc-3": [185, 77, 52],
    "eclipse-asc-4": [187, 76, 52],
    "eclipse-asc-5": [188, 77, 52],
    "eclipse-asc-6": [191, 73, 52],
    "eclipse-asc-7": [193, 78, 52],
    "eclipse-asc-8": [195, 86, 52],
    "eclipse-desc-1": [201, 84, 52],
    "eclipse-desc-2": [197, 100, 52],
    "eclipse-desc-3": [184, 122, 52],
    "eclipse-desc-4": [182, 131, 52],
    "eclipse-desc-5": [180, 141, 52],
    "eclipse-desc-6": [178, 150, 52],
    "eclipse-desc-7": [178, 157, 52],
    "eclipse-desc-8": [178, 157, 52],
    // The automatic face estimator lands 13px right, 7px low, and 7px large
    // on this shared head family (it makes the same error on approved Aurora).
    // These sockets apply Aurora's hand-reviewed correction to each new suit's
    // measured head, preserving the small pose-specific vertical differences.
    // Flight's banks come from a motion TRANSFER of Eclipse's own arc, so
    // its head sits differently in every frame and each one carries its own
    // anchor, exactly as Eclipse's do.
    "flight-asc-1": [174.1, 88.5, 32.6],
    "flight-asc-2": [174.6, 90.6, 32.6],
    "flight-asc-3": [174.1, 89.1, 32.6],
    "flight-desc-1": [179.0, 93.0, 32.6],
    "flight-desc-2": [178.4, 95.6, 32.6],
    "flight-desc-3": [173.9, 110.8, 32.6],
    "flight-desc-4": [171.8, 113.7, 32.6],
    "flight-desc-5": [164.2, 138.4, 32.6],
    "suit:cinderforge": [183, 93, 44],
    "suit:groveguard": [183, 93, 44],
    "suit:cosmic": [183, 93, 44],
    "suit:sunforged": [183, 89, 42],
    "suit:abyssal": [183, 93, 44],
    "suit:amethyst": [183, 93, 44],
    "suit:ivoryguard": [183, 93, 44],
    "suit:reactor": [183, 91, 44],
};
// Where the GLASS circle sits inside each helmet-only render (x, y, r).
// All twelve helmets have a solo render; the tinted-ring path below
// stays as the fallback for any helmet added later.
//
// An optional FOURTH number is a rotation in degrees about the glass
// centre, for the asymmetric shells — a crown, a halo, a horn — that sit
// level in their own render but want a tilt once they are on a head. No
// helmet uses it yet, so every entry below is three numbers and draws
// exactly as it did before the field existed. The rig editor writes it.
const HELM_GLASS = {
    comet: [129, 129, 125],
    "clear": [129, 128, 125],
    "ion": [129, 128, 125],
    "solar": [128, 128, 125],
    "nebula": [129, 129, 125],
    "lunar": [129, 126, 125, -4],
    "void": [125, 128, 125],
    "cherry": [126, 128, 125],
    // Royal wears a crown, so its sphere is scaled down inside the frame
    // and never measured 125 like the bare bubbles. Measured off the art.
    "royal": [124, 156, 98],
    "aurora": [128, 127, 127.5],
    "meteor": [128, 127, 127.5],
    "chrono": [132, 126, 127.5],
    // measured off the corrected art. These renders are three-quarter
    // views, so the visor sits right of frame centre — that offset is real
    // and paintDome relies on it to seat the helmet on the head.
    "gemmie": [128, 128, 131.9],
    "phoenix": [130, 116, 129.2, -2],
    "seraph": [125, 151, 110],
    "chronarch": [127.1, 120.5, 125.6],
    "paladin": [133, 137, 119.6],
    // Princess is a shell with a face opening, not a bubble, so the head does
    // not sit at the shell's centre — it sits behind the opening, back from it
    // by about a fifth of its own radius, because the squirrel's face is
    // forward of its head centre. Centred on the shell it put the whole face
    // behind cream lacquer.
    "princess": [127.3, 96.8, 126],
    // Sammie is the plain lacquer dome now, not the horned samurai. Measuring
    // its visor field gave 78, which drew the helmet half again too big — the
    // shell hides most of the sphere's edge, so the visible visor is nothing
    // like the glass radius. Like princess it is a shell with an opening, so
    // its centre sits behind that opening rather than in the middle of the
    // frame; centred, the muzzle hung over the rim on every suit.
    "sammie": [138, 103, 108.2],
    // Leviathan's glass was fitted BY HAND in the rig editor, on its own
    // suit, with a 12-degree tilt -- and the helmet is exclusive to that
    // suit (suitOnly in catalog.ts), so this number never has to sit right
    // on anyone else.
    "leviathan": [129.8, 110.6, 103.6, 12],
    "verdant": [141, 116, 126.6],
    "cryostar": [126, 121, 134.6],
    "eclipse": [127, 129, 138.4],
    "cinderforge": [128, 125, 115.9],
    "groveguard": [130, 124, 106],
    "cosmic": [134, 119, 124.2],
    "sunforged": [123, 128, 129],
    "abyssal": [125, 131, 128.8],
    "amethyst": [127, 128, 126.3],
    "ivoryguard": [127, 126, 130.6],
    "reactor": [140, 110, 96.2],
};
// The real helmet art, its glass centre punched translucent once so the
// pilot's face shows through when it is composited onto the head.
const punchedCache = new Map();
const LIGHT_OPAQUE_VISORS = new Set([
    "gemmie", "phoenix", "sammie", "seraph",
    "chronarch", "paladin", "princess",
]);
function punchedHelm(spr, id, opaqueVisor = false) {
    const hit = punchedCache.get(id);
    if (hit)
        return hit;
    const g = HELM_GLASS[id];
    const c = document.createElement("canvas");
    c.width = spr.width;
    c.height = spr.height;
    const cc = c.getContext("2d");
    if (!cc || !g)
        return null;
    cc.drawImage(spr, 0, 0);
    if (opaqueVisor) {
        punchedCache.set(id, c);
        return c;
    }
    const strong = LIGHT_OPAQUE_VISORS.has(id);
    const grad = cc.createRadialGradient(g[0], g[1], g[2] * 0.1, g[0], g[1], g[2] * (strong ? 0.88 : 0.82));
    grad.addColorStop(0, `rgba(0,0,0,${strong ? 0.88 : 0.55})`);
    grad.addColorStop(0.7, `rgba(0,0,0,${strong ? 0.62 : 0.3})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    cc.globalCompositeOperation = "destination-out";
    cc.fillStyle = grad;
    cc.fillRect(0, 0, c.width, c.height);
    cc.globalCompositeOperation = "source-over";
    punchedCache.set(id, c);
    return c;
}
// Where each rigged suit's tail hinges, in its own 256px canvas.
const TAIL_PIVOT = {
    // The middle of the NECK -- the narrowest crossing of the silhouette
    // where the plume meets the rump -- found by neck-cut.py rather than set
    // by hand. The old values sat on the outer edge of the tail mask, which
    // is why a swing tore a piece off the animal instead of sweeping along
    // it. Re-cut the art and these must be re-read from the same run.
    alien: [96, 156],
    cyber: [101, 125],
    aurorasuit: [99, 139],
    bigbooty: [92, 129],
    catsuit: [74, 149],
    copper: [99, 131],
    ember: [107, 136],
    flight: [102, 130],
    frost: [107, 140],
    gemmie: [101, 149],
    ghost: [103, 128],
    iontrim: [100, 130],
    leviathan: [101, 131],
    robo: [101, 140],
    sammie: [99, 148],
    seraph: [105, 138],
    stardust: [104, 140],
    voidsuit: [105, 142],
    verdant: [103, 149],
    cryostar: [103, 151],
    volt: [107, 136],
    eclipse: [105, 143],
    cinderforge: [104, 132],
    groveguard: [102, 130],
    cosmic: [104, 131],
    sunforged: [101, 128],
    abyssal: [104, 132],
    amethyst: [103, 132],
    ivoryguard: [103, 132],
    reactor: [102, 130],
};
// Draw one layer of a rigged suit. Both layers are full-canvas, so they
// are placed against the WHOLE suit's trimmed box — that is what keeps
// tail and body registered to each other however either one is cropped.
function drawRigLayer(ctx, layer, ref, x, y, size, rot = 0, pivot, halo) {
    const scale = size / Math.max(1, Math.max(ref.w, ref.h));
    // top-left of the full canvas, in screen space
    const ox = x - (ref.w * scale) / 2 - ref.x * scale;
    const oy = y - (ref.h * scale) / 2 - ref.y * scale;
    ctx.save();
    if (rot && pivot) {
        const px = ox + pivot[0] * scale;
        const py = oy + pivot[1] * scale;
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.translate(-px, -py);
    }
    if (halo) {
        const h = spriteHalo(layer, halo);
        if (h) {
            const pad = SPRITE_HALO_PAD * scale;
            ctx.drawImage(h, ox - pad, oy - pad, h.width * scale, h.height * scale);
        }
    }
    ctx.drawImage(layer, ox, oy, layer.width * scale, layer.height * scale);
    ctx.restore();
}
function rigPlacement(ref, x, y, size, pivot) {
    const scale = size / Math.max(1, Math.max(ref.w, ref.h));
    const ox = x - (ref.w * scale) / 2 - ref.x * scale;
    const oy = y - (ref.h * scale) / 2 - ref.y * scale;
    return { scale, px: ox + pivot[0] * scale, py: oy + pivot[1] * scale };
}
// The generated Eclipse tap paintings kept their 256px roots but drew the
// pilot about 15-20% smaller inside them. The fixed helmet therefore stayed
// full-size while the exposed head/body shrank, then popped back when the
// static bookend returned. These measurements register each pose to the
// approved eclipse-body.png head without repainting any pixels or touching
// physics. Static bookends intentionally bypass this table.
const ECLIPSE_TAP_HEAD_TARGET = [200.28, 83.82];
const ECLIPSE_TAP_REGISTRATION = [
    { head: [186.03, 76.74], scale: 1.192 },
    { head: [184.89, 74.67], scale: 1.176 },
    { head: [185.24, 77.51], scale: 1.174 },
    { head: [186.15, 76.12], scale: 1.203 },
    { head: [185.34, 77.74], scale: 1.168 },
    { head: [184.87, 74.78], scale: 1.183 },
    { head: [184.29, 74.73], scale: 1.184 },
    { head: [184.69, 76.24], scale: 1.176 },
];
function drawRegisteredTapLayer(ctx, layer, ref, x, y, size, registration, halo) {
    const screenScale = size / Math.max(1, Math.max(ref.w, ref.h));
    const ox = x - (ref.w * screenScale) / 2 - ref.x * screenScale;
    const oy = y - (ref.h * screenScale) / 2 - ref.y * screenScale;
    const sourceX = ox + registration.head[0] * screenScale;
    const sourceY = oy + registration.head[1] * screenScale;
    const targetX = ox + ECLIPSE_TAP_HEAD_TARGET[0] * screenScale;
    const targetY = oy + ECLIPSE_TAP_HEAD_TARGET[1] * screenScale;
    ctx.save();
    ctx.translate(targetX, targetY);
    ctx.scale(registration.scale, registration.scale);
    ctx.translate(-sourceX, -sourceY);
    drawRigLayer(ctx, layer, ref, x, y, size, 0, undefined, halo);
    ctx.restore();
}
// The shared tail translation for suits without a painted tap bank. Six
// overlapping radial sections rotate by progressively larger amounts from the
// planted hinge to the tip. At game scale this reads as a continuous flexible
// plume, while every pixel still comes from the model's approved tail asset.
function drawBentRigLayer(ctx, layer, ref, x, y, size, baseRot, bend, pivot) {
    const { scale, px, py } = rigPlacement(ref, x, y, size, pivot);
    const box = layer.box ?? { x: 0, y: 0, w: layer.width, h: layer.height };
    const corners = [
        [box.x, box.y], [box.x + box.w, box.y],
        [box.x, box.y + box.h], [box.x + box.w, box.y + box.h],
    ];
    const maxR = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - pivot[0], cy - pivot[1]))) * scale;
    const segments = 6;
    const overlap = Math.max(0.75, scale * 3.5);
    // Tip first, base last: the overlap hides section edges beneath the denser
    // inner fur instead of building a bright double-alpha seam on top.
    for (let i = segments - 1; i >= 0; i--) {
        const inner = Math.max(0, (maxR * i) / segments - overlap);
        const outer = (maxR * (i + 1)) / segments + overlap;
        const along = (i + 0.5) / segments;
        const smooth = along * along * (3 - 2 * along);
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, outer, 0, Math.PI * 2);
        if (inner > 0)
            ctx.arc(px, py, inner, 0, Math.PI * 2, true);
        ctx.clip("evenodd");
        drawRigLayer(ctx, layer, ref, x, y, size, baseRot + bend * Math.pow(smooth, 1.18), pivot);
        ctx.restore();
    }
}
// Fast compression/straightening, then a much longer return. A second tap
// does not reset these curves; the ordinary spring tail still receives its
// new impulse and rides over this authored silhouette motion.
const TAP_TAIL_CURVE = [0, 0.18, 0.4, 0.58, 0.64, 0.59, 0.48, 0.35, 0.23, 0.13, 0.06, 0];
const TAP_BODY_CURVE = [0, 0.42, 0.82, 1, 0.9, 0.74, 0.58, 0.43, 0.29, 0.17, 0.08, 0];
// Tail is driven away from the rebound at contact, overshoots once, then
// rejoins the live spring. The sign is supplied by the collision normal.
const BOUNCE_TAIL_CURVE = [0, 0.58, 0.76, 0.48, 0.16, -0.11, 0];
function sampleMotionCurve(curve, t, duration) {
    const at = Math.max(0, Math.min(curve.length - 1, (t / duration) * (curve.length - 1)));
    const lo = Math.floor(at);
    const hi = Math.min(curve.length - 1, lo + 1);
    const f = at - lo;
    const eased = f * f * (3 - 2 * f);
    return curve[lo] * (1 - eased) + curve[hi] * eased;
}
function sampleTapCurve(curve, tapAnimT) {
    return sampleMotionCurve(curve, tapAnimT, TAP_ANIM_DURATION);
}
function bounceShape(t, strength) {
    const p = Math.max(0, Math.min(1, t / BOUNCE_ANIM_DURATION));
    const squash = p < 0.18 ? 1 - p / 0.18 : 0;
    const stretchP = Math.max(0, Math.min(1, (p - 0.1) / 0.42));
    const stretch = p >= 0.1 && p <= 0.52 ? Math.sin(stretchP * Math.PI) : 0;
    const settleP = Math.max(0, Math.min(1, (p - 0.46) / 0.54));
    const settle = p >= 0.46 ? Math.sin(settleP * Math.PI * 2) * (1 - settleP) : 0;
    return {
        x: 1 + strength * (squash * 0.1 - stretch * 0.045 + settle * 0.012),
        y: 1 + strength * (-squash * 0.13 + stretch * 0.085 - settle * 0.018),
    };
}
// Which art still has a helmet painted into it. The eight flight animation
// frames do (they were never re-rendered), and so does any suit flagged
// bakedDome in the catalog. Everything else ships bare-headed and needs a
// helmet drawn on it — including Clear.
function bakedDome(key) {
    if (!key.startsWith("suit:"))
        return true;
    const id = key.slice(5);
    return SUITS.some((u) => u.id === id && u.bakedDome === true);
}
function paintDome(ctx, body, key, helmet, x, y, size, art) {
    // The Clear helmet used to draw nothing at all, because every suit render
    // had a clear dome painted into it. Most are bare-headed now, so Clear has
    // to paint its own — otherwise picking it leaves the pilot in a vacuum
    // bare-faced. Only the art that still carries a dome skips it: the eight
    // flight animation frames, and the suits flagged bakedDome.
    if (helmet.id === "clear" && bakedDome(key))
        return;
    const a = DOME[key];
    if (!a)
        return;
    const box = body.box ?? { x: 0, y: 0, w: body.width, h: body.height };
    const scale = size / Math.max(1, Math.max(box.w, box.h));
    const hx = x - (box.w * scale) / 2 + (a[0] - box.x) * scale;
    const hy = y - (box.h * scale) / 2 + (a[1] - box.y) * scale;
    const r = a[2] * scale;
    // the REAL helmet render sits on the head — scaled so its glass circle
    // matches the painted dome exactly
    const helmSpr = art?.helms?.[helmet.id];
    const g = HELM_GLASS[helmet.id];
    if (helmSpr && g) {
        const punched = punchedHelm(helmSpr, helmet.id, helmet.opaqueVisor === true);
        if (punched) {
            const s2 = (r * 1.04) / g[2];
            const rot = g[3] || 0;
            if (rot) {
                ctx.save();
                ctx.translate(hx, hy);
                ctx.rotate((rot * Math.PI) / 180);
                ctx.translate(-hx, -hy);
            }
            ctx.drawImage(punched, hx - g[0] * s2, hy - g[1] * s2, punched.width * s2, punched.height * s2);
            if (rot)
                ctx.restore();
            return;
        }
    }
    const v = hexRgb(helmet.visor);
    ctx.save();
    const grad = ctx.createRadialGradient(hx - r * 0.25, hy - r * 0.3, r * 0.2, hx, hy, r);
    grad.addColorStop(0, `rgba(${v.r},${v.g},${v.b},0.08)`);
    grad.addColorStop(0.7, `rgba(${v.r},${v.g},${v.b},0.26)`);
    grad.addColorStop(1, `rgba(${v.r},${v.g},${v.b},0.4)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    if (helmet.glow) {
        ctx.shadowColor = helmet.glow;
        ctx.shadowBlur = r * 0.55;
    }
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.strokeStyle = helmet.rim;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.97, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
// presentation-only smoothing for the physics-pose banks: one shared clock
// keyed on world time, so pause holds the pose and resume never jumps
//
// This is the FIRST-PASS driver, restored deliberately. Two later attempts
// to damp the hover-cadence rocking - a long velocity average (v95) and a
// direction debounce (v98) - each bought calm by spending the animation,
// and the owner would rather re-approach the timing from here than keep
// tuning a body that barely moves. Do not re-add damping without a look at
// WHEN the pose starts rather than how fast it turns.
let motionVySmooth = 0;
let motionVyClock = -1;
function smoothMotionVy(t, vy) {
    const dt = motionVyClock < 0 || t < motionVyClock ? 0.016 : Math.min(0.05, t - motionVyClock);
    motionVyClock = t;
    motionVySmooth += (vy - motionVySmooth) * Math.min(1, dt * 9);
    return motionVySmooth;
}
// The RATE-DRIVEN mapping (the hangar A/B switches this on).
//
// The shipped mapping poses the body by INSTANTANEOUS vertical speed, and
// that is what feels jerky: a tap resets vy to -450 and gravity rebuilds it
// at 1300/s2, so the pose is yanked across its whole range twice a second
// whether or not the pilot is actually going anywhere.
//
// What the pilot experiences is not instantaneous speed, it is RATE: am I
// holding level, climbing, or falling, and how hard. So two signals, doing
// two different jobs:
//
//   COMMITMENT (~0.55s average) - how far the body is willing to lean. Tapping
//   just enough to hold station averages to nearly nothing, so the body stays
//   horizontal. Several taps in a row average clearly negative and the body
//   commits to a real climb. A long fall commits to the dive.
//
//   LIFE (~0.09s average) - the instantaneous beat, which only ever pulls the
//   pose a fraction of the way from its commitment. This is what keeps the
//   animation alive between taps, at whatever pace the pilot is tapping,
//   without letting a single tap throw the whole body.
//
// Hover therefore reads as small movement around horizontal; a climb reads as
// a committed climb that still breathes on each beat; and nothing snaps.
//
// A third piece, found by filming all the candidates offline: a pose that is
// merely CORRECT still dies. Pinned in a long fall, every velocity mapping
// tested held one frame for seconds - a still image at the most dramatic
// moment. So the pose carries a small motion BUDGET: a gentle cycle whose
// amplitude opens only as the mapping itself goes still, and closes again the
// moment real motion returns. A pinned dive keeps breathing; a busy hover
// gets no extra churn piled onto it.
//
// The target is a band, measured by counting frame changes per second against
// the real constants: under ~3/s reads as a still image, 6-12/s reads as
// deliberate animation (hand-drawn work sits here), over ~20/s reads as
// vibration. This lands 9-15/s in flight and 2-3/s pinned; the shipped
// mapping manages 20/s hovering and 0/s falling.
// HEADING: the body simply points where it is going - the tangent of the
// flight arc, atan2(vy, forward speed). It is the most physically honest of
// the three and it self-normalises, since the same climb rate reads shallower
// when the run is faster. Its cost is resolution: the true tangent sweeps
// roughly 130 degrees on every hop, so eight frames of bank have to cover
// that whole sweep and the frames turn over quickly.
const MOTION_HEADING_MAX = (55 * Math.PI) / 180;
// Suits with no painted motion banks get the same flight from their RIG.
// Measured off Eclipse's banks, its motion is mostly two rotations: the body
// pitches about 19 degrees through the climb and about 40 through the dive,
// and the tail trails the body by roughly 25 degrees climbing and swings well
// past it in a deep dive. Both are inside what the tail hinge already does
// for every one of the 29 rigged suits, so the fleet can fly the same shape
// without a single new drawing.
//
// What this CANNOT reproduce is the limb articulation painted into Eclipse's
// frames - the arms and hands that turned out to be why heading reads alive.
// A rigged suit gets the silhouette of the motion, not the performance, and
// that gap is the argument for transferring real frames onto the suits that
// matter most rather than settling here.
/** The lean actually in force for a suit: the editor's working value if the
 *  pilot is dialling one in, otherwise the shipped table, otherwise neutral.
 *  Every rotation site goes through here so the hangar preview and the real
 *  flight can never disagree about what a number means. */
function leanFor(save, id) {
    const edited = save?.suitLean?.[id];
    return edited ?? suitLean(id);
}
const RIG_PITCH_UP = (14 * Math.PI) / 180; // eased back from Eclipse's 19
const RIG_PITCH_DOWN = (30 * Math.PI) / 180; // eased back from Eclipse's 40
const RIG_TAIL_TRAIL = 0.55; // how much of the pitch the tail lags by
// Suits whose own animation is already approved and must not be touched.
// Suits the heading pitch must NOT touch. The rotation is calibrated for a
// character painted belly-down at about +14 degrees, which is where the
// whole family sits: Flight 14, Ion 12, Frost 16, Ghost 17, Eclipse 24.
// A suit painted outside that band gets rotated from the wrong starting
// attitude, and the further off it is the worse the result. The Alien is
// painted HEAD-UP at -22 - 36 degrees the other side of the family - so a
// climb tipped it back until it sat upright in the sky rather than
// climbing, which is what the owner saw as leading with its head.
const RIG_PITCH_SKIP = new Set(["robo", "bigbooty", "catsuit", "alien"]);
// A painted motion bank normally CARRIES the attitude, so rotating it as
// well would pitch the character twice. Cyber's bank is not built that way:
// it is one glide ramp played in both directions, carrying how far the body
// EXTENDS rather than which way it points, and the rig supplies the
// direction over the top. That is what lets nine frames read as a climb and
// a dive instead of needing two sheets that never quite agree at the seam.
const RIG_PITCH_WITH_BANK = new Set(["cyber"]);
let headingA = 0;
let headingClock = -1;
function trackHeadingMotion(t, vy, vx) {
    const fresh = headingClock < 0 || t < headingClock;
    if (fresh)
        headingA = 0;
    const dt = fresh ? 0.016 : Math.min(0.05, t - headingClock);
    headingClock = t;
    const target = Math.atan2(vy, Math.max(60, vx));
    headingA += (target - headingA) * (1 - Math.exp(-dt / 0.12));
    return Math.max(-1, Math.min(1, headingA / MOTION_HEADING_MAX));
}
const MOTION_LIFE = 0.35; // how far the beat may pull the pose off its commitment
const MOTION_CYCLE_HZ = 1.15;
const MOTION_CYCLE_FRAMES = 0.9; // amplitude in FRAMES, at full stillness
let rateFast = 0;
let rateSlow = 0;
let ratePrev = 0;
let rateStill = 0;
let ratePhase = 0;
let rateClock = -1;
function trackRateMotion(t, vy) {
    const fresh = rateClock < 0 || t < rateClock;
    if (fresh) {
        rateFast = 0;
        rateSlow = 0;
    }
    const dt = fresh ? 0.016 : Math.min(0.05, t - rateClock);
    rateClock = t;
    rateFast += (vy - rateFast) * (1 - Math.exp(-dt / 0.09));
    rateSlow += (vy - rateSlow) * (1 - Math.exp(-dt / 0.55));
    // climbing is the slow direction in this game (about 230px/s sustained) and
    // gravity makes falling fast (about 520px/s), so the two are scaled apart
    // rather than sharing one number
    const lean = (v) => {
        const k = Math.min(1, Math.abs(v) / (v < 0 ? 300 : 520));
        return (v < 0 ? -1 : 1) * Math.pow(k, 1.15);
    };
    const commit = lean(rateSlow);
    const pose = commit + (lean(rateFast) - commit) * MOTION_LIFE;
    // how much the pose is moving on its own, and therefore how much of the
    // cycle's budget is needed to keep the body alive
    const moving = Math.min(1, Math.abs(pose - ratePrev) / dt / 1.6);
    ratePrev = pose;
    rateStill += ((1 - moving) - rateStill) * (1 - Math.exp(-dt / 0.25));
    ratePhase += dt * 2 * Math.PI * MOTION_CYCLE_HZ;
    return { pose, cycle: Math.sin(ratePhase) * MOTION_CYCLE_FRAMES * rateStill };
}
function paintIllustrated(ctx, spr, x, y, size, helmet, suit, _t = 0, art, frameKey = "idle-1", sprNext, keyNext, blend = 0, halo = "dark", tailRot = 0, tapAnimT = -1, bounceAnimT = -1, bounceAnimDir = 0, bounceAnimStrength = 0, motionVy = 0, motionMode = 0, motionVx = 0, 
// the lean in force for this suit. Passed rather than looked up because
// paintIllustrated has no save: the caller already resolved it, and two
// resolutions could disagree.
lean = SUIT_LEAN_DEFAULT) {
    // the equipped suit IS the body: its painted render replaces the
    // default flight frames, carried by the pilot's motion
    // Flight's animation frames already wear the Clear dome. Any other helmet
    // needs the bare rigged Flight painting so it does not stack two helmets.
    // Where the articulated tap ships (the beta), Flight + Clear ALSO takes
    // the rigged painting: the old crossfade walks through eight paintings
    // whose outfits disagree (shoes on some frames, bare feet on others),
    // and the rig path moves one consistent body like every other suit.
    const suited = suit.id !== "flight" || helmet.id !== "clear" || TAP_ANIM_ENABLED
        ? (art?.suits?.[suit.id] ?? null)
        : null;
    const body = suited ?? spr;
    if (!body)
        return;
    // A rigged suit draws as two pieces with the tail hinged, so a tap
    // actually moves something. The tail goes down first — it sits behind
    // the pilot — then the body over it.
    const rigT = suited ? art?.suitTail?.[suit.id] : null;
    const rigB = suited ? art?.suitBody?.[suit.id] : null;
    if (rigT && rigB && suited) {
        // Rig-driven heading flight: the whole character pitches to point along
        // its flight path, and the tail trails that pitch instead of following it
        // rigidly. Only for suits with no painted bank of their own, and never
        // while a painted full-character frame is on screen - those already carry
        // an attitude and would be rotated twice.
        const rigPitchOn = motionMode === 2 && !RIG_PITCH_SKIP.has(suit.id)
            && (RIG_PITCH_WITH_BANK.has(suit.id) || !(art?.suitAsc?.[suit.id]?.length));
        let rigPitch = 0;
        if (rigPitchOn) {
            const hp = trackHeadingMotion(_t, motionVy, motionVx);
            // the same dial, so one number governs a suit's lean however it is
            // drawn - a rigged suit carries both sources and feels it twice
            const rigLean = lean;
            rigPitch = hp < 0 ? hp * RIG_PITCH_UP * rigLean.up : hp * RIG_PITCH_DOWN * rigLean.down;
        }
        const pitched = rigPitch !== 0;
        if (pitched) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rigPitch);
            ctx.translate(-x, -y);
        }
        const ref = suited.box ?? { x: 0, y: 0, w: suited.width, h: suited.height };
        const pivot = TAIL_PIVOT[suit.id];
        // ECLIPSE's physics-pose experiment: with ascend/descend banks present,
        // posture is DRIVEN BY VERTICAL VELOCITY, not a tap clock — rising
        // deepens the climb pose, the arc settles to level, and falling rolls
        // into the dive ramp. Earth physics, worn on the body.
        const ascFrames = art?.suitAsc?.[suit.id] ?? [];
        const descFrames = art?.suitDesc?.[suit.id] ?? [];
        const fullMotion = ascFrames.length > 0 && descFrames.length > 0;
        const tapFrames = art?.suitTap?.[suit.id] ?? [];
        const tapTailFrames = art?.suitTapTail?.[suit.id] ?? [];
        // A SIXTEEN-frame bank is a full-character shoot — body, tail, and all —
        // so during the burst the frame IS the pilot: no rig tail, no body
        // layer, no pulse. Smaller banks keep the layered treatment below.
        const fullTap = tapAnimT >= 0 && tapFrames.length === 16;
        // A full-character BOUNCE bank plays the painted planet-contact recoil
        // (impact, discharge, slight overturn, correction) instead of the rig.
        // Contact takes visual priority over any tap in flight.
        const bounceFrames = art?.suitBounce?.[suit.id] ?? [];
        const fullBounce = bounceAnimT >= 0 && bounceFrames.length === 16;
        let tailPose = rigT;
        let tailPoseRot = tailRot - rigPitch * RIG_TAIL_TRAIL;
        if (fullBounce || fullMotion) {
            /* these frames carry the whole character, tail included */
        }
        else if (bounceAnimT >= 0 && suit.id === "eclipse" && pivot) {
            const bend = bounceAnimDir * bounceAnimStrength
                * sampleMotionCurve(BOUNCE_TAIL_CURVE, bounceAnimT, BOUNCE_ANIM_DURATION);
            drawBentRigLayer(ctx, rigT, ref, x, y, size, tailRot * 0.42, bend, pivot);
        }
        else if (!fullTap && !fullBounce && !fullMotion && tapAnimT >= 0 && tapTailFrames.length === 12) {
            // One tail drawing per 30 fps presentation frame. The sequence bends
            // progressively from the planted hinge to the tip: launch drag, delayed
            // whip, one rebound, settle. A small share of the live spring remains so
            // a tap entered mid-swing does not snap to a canned orientation.
            // Reach the straightened launch silhouette quickly, then spend most of
            // the clock pulling the tail back in. This is intentionally asymmetric:
            // the old even spacing made the last tail pose jerk into rest.
            const tailTimes = [0, 0.03, 0.065, 0.105, 0.15, 0.2, 0.26, 0.335, 0.415, 0.5, 0.575, 0.625, TAP_ANIM_DURATION];
            let tailIndex = 11;
            for (let i = 0; i < 12; i++) {
                if (tapAnimT < tailTimes[i + 1]) {
                    tailIndex = i;
                    break;
                }
            }
            tailPose = tapTailFrames[tailIndex];
            // Preserve enough of the live spring to show every accepted tap even
            // while the painted recovery is still in progress.
            tailPoseRot *= 0.48;
            drawRigLayer(ctx, tailPose, ref, x, y, size, tailPoseRot, pivot, halo);
        }
        else if (!fullTap && !fullBounce && !fullMotion && tapAnimT >= 0 && pivot) {
            drawBentRigLayer(ctx, rigT, ref, x, y, size, tailRot * 0.48, sampleTapCurve(TAP_TAIL_CURVE, tapAnimT), pivot);
        }
        else if (!fullTap && !fullBounce && !fullMotion) {
            drawRigLayer(ctx, tailPose, ref, x, y, size, tailPoseRot, pivot, halo);
        }
        let poseA = rigB;
        let tapPoseRegistration = null;
        if (bounceAnimT >= 0 && suit.id === "eclipse") {
            // Contact takes visual priority over the tap bank. The approved static
            // body is transformed below; no armor, hand, face, or helmet pixels are
            // redrawn for the impact.
            poseA = rigB;
        }
        else if (tapAnimT >= 0 && tapFrames.length === 8) {
            // A traditional stepped bank stays crisp at the 52 px gameplay size.
            // Crossfading painterly faces produces double eyes and soft armor seams;
            // eight close poses already supply the in-betweens. Static body bookends
            // make both the tap entry and return to glide exact, with no identity pop.
            const poses = [rigB, ...tapFrames, rigB];
            // Knees tuck promptly; hands and torso return over the long half of the
            // motion. Repeat taps leave this clock alone, preventing the recovery
            // frames from snapping backward to an earlier arm pose.
            const poseTimes = [0, 0.035, 0.08, 0.135, 0.2, 0.275, 0.365, 0.46, 0.55, 0.625, TAP_ANIM_DURATION];
            let pose = poses.length - 1;
            for (let i = 0; i < poses.length; i++) {
                if (tapAnimT < poseTimes[i + 1]) {
                    pose = i;
                    break;
                }
            }
            poseA = poses[pose];
            if (suit.id === "eclipse" && pose > 0 && pose < poses.length - 1) {
                tapPoseRegistration = ECLIPSE_TAP_REGISTRATION[pose - 1] ?? null;
            }
        }
        if (fullBounce) {
            const idx = Math.min(15, Math.floor((bounceAnimT / BOUNCE_ANIM_DURATION) * 16));
            const refB = bounceFrames[0].box ?? ref;
            drawRigLayer(ctx, bounceFrames[idx], refB, x, y, size, 0, undefined, halo);
            if (!wearsOwnHead(suit))
                paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
        }
        else if (fullMotion) {
            // A light exponential smooth keeps rapid taps from strobing the
            // pose; the ramps themselves already grade the attitude.
            // two mappings, switched from the hangar so both can be flown back to back
            let v;
            let cycle = 0;
            if (motionMode === 1) {
                const r = trackRateMotion(_t, motionVy);
                v = r.pose;
                cycle = r.cycle;
            }
            else if (motionMode === 2) {
                v = trackHeadingMotion(_t, motionVy, motionVx);
            }
            else {
                const sv = smoothMotionVy(_t, motionVy);
                v = sv < 0 ? -Math.min(1, -sv / 470) : Math.min(1, sv / 620);
            }
            const bank = v < 0 ? ascFrames : descFrames;
            const idxM = Math.max(0, Math.min(bank.length - 1, Math.round(Math.abs(v) * (bank.length - 1) + cycle)));
            const frame = bank[idxM];
            const refM = ascFrames[0].box ?? ref;
            drawRigLayer(ctx, frame, refM, x, y, size, 0, undefined, halo);
            // the helmet rides the HEAD, which these frames move with the
            // attitude - each frame carries its own dome anchor. The anchor is
            // in canvas space, so it must be mapped through the SAME reference
            // box the frame itself is drawn with (asc[0]), not the frame's own.
            if (!wearsOwnHead(suit)) {
                paintDome(ctx, ascFrames[0], `${suit.id}-${v < 0 ? "asc" : "desc"}-${idxM + 1}`, helmet, x, y, size, art);
            }
        }
        else if (fullTap) {
            // frame registration comes from the bank's own first frame, so every
            // frame lands at the same scale and the character never pulses in size
            const idx = Math.min(15, Math.floor((tapAnimT / TAP_ANIM_DURATION) * 16));
            const ref16 = tapFrames[0].box ?? ref;
            drawRigLayer(ctx, tapFrames[idx], ref16, x, y, size, 0, undefined, halo);
            if (!wearsOwnHead(suit)) {
                // A per-pose anchor where the bank moves the head; the single static
                // anchor everywhere else, which is correct for banks that hold it
                // still. Measured against the BANK's own box, so it is read with the
                // bank's first frame as the reference body - same as asc/desc above.
                const pose = `${suit.id}-tap-${idx + 1}`;
                if (DOME[pose])
                    paintDome(ctx, tapFrames[0], pose, helmet, x, y, size, art);
                else
                    paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
            }
        }
        else if (tapAnimT >= 0 && tapFrames.length !== 8 && pivot) {
            // Universal body impulse: scale from the tail hinge, not the canvas
            // centre. The model stretches forward a few pixels and rebounds without
            // repainting armor, anatomy, face, or the helmet attachment.
            const pulse = sampleTapCurve(TAP_BODY_CURVE, tapAnimT);
            const { px, py } = rigPlacement(ref, x, y, size, pivot);
            ctx.save();
            ctx.translate(px, py);
            ctx.scale(1 + pulse * 0.052, 1 - pulse * 0.028);
            ctx.translate(-px, -py);
            drawRigLayer(ctx, poseA, ref, x, y, size, 0, undefined, halo);
            if (!wearsOwnHead(suit))
                paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
            ctx.restore();
        }
        else {
            if (tapPoseRegistration) {
                drawRegisteredTapLayer(ctx, poseA, ref, x, y, size, tapPoseRegistration, halo);
            }
            else {
                drawRigLayer(ctx, poseA, ref, x, y, size, 0, undefined, halo);
            }
            if (!wearsOwnHead(suit))
                paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
        }
        if (pitched)
            ctx.restore();
        return;
    }
    // frames crossfade instead of hard-switching — the four paintings blend
    // through each other so the cycle reads as motion, not a slideshow
    const f = suited ? 0 : blend;
    if (!suited && sprNext && f > 0.02) {
        const prevA = ctx.globalAlpha;
        ctx.globalAlpha = prevA * (1 - f);
        drawSprite(ctx, body, x, y, size);
        ctx.globalAlpha = prevA * f;
        drawSprite(ctx, sprNext, x, y, size);
        ctx.globalAlpha = prevA;
    }
    else {
        // the pilot's separation follows the sky like everything else — a
        // hardcoded dark halo left dark suits (the Void skin especially)
        // with no edge at all against a dark backdrop
        drawSprite(ctx, body, x, y, size, "box", halo);
    }
    if (suited) {
        if (!wearsOwnHead(suit))
            paintDome(ctx, body, "suit:" + suit.id, helmet, x, y, size, art);
        return;
    }
    // the dome anchor glides between the two frames' measured positions
    const a1 = DOME[frameKey];
    const a2 = keyNext ? DOME[keyNext] : null;
    if (a1 && a2 && f > 0.02) {
        const mix = [
            a1[0] + (a2[0] - a1[0]) * f,
            a1[1] + (a2[1] - a1[1]) * f,
            a1[2] + (a2[2] - a1[2]) * f,
        ];
        DOME.__mix = mix;
        paintDome(ctx, body, "__mix", helmet, x, y, size, art);
        delete DOME.__mix;
    }
    else {
        paintDome(ctx, body, frameKey, helmet, x, y, size, art);
    }
}
function drawPilot(ctx, w, save, art, xOverride, localScale = 1, yOverride, bankScale = 0.8) {
    const x = xOverride ?? w.W * PHYS.squirrelX;
    const y = yOverride ?? w.squirrel.y;
    const suit = SUITS.find((s) => s.id === save.equippedSuit) ?? SUITS[0];
    const helm = helmetWornBy(save.equipped, save.equippedSuit);
    // The repainted flap frames are one coherent character, so the tap
    // cycles them again — plus a soft nose-up kick and scale pop for punch.
    const flapping = w.flapBoost > 0;
    const frames = flapping ? art.squirrelFlap : art.squirrelIdle;
    const speed = flapping ? 10 : 5;
    const ft = w.time * speed;
    const idx = frames.length ? Math.floor(ft) % frames.length : 0;
    const nxt = frames.length ? (idx + 1) % frames.length : 0;
    // smoothstep eases the crossfade so each pose still gets its moment
    const fr = ft - Math.floor(ft);
    const blend = fr * fr * (3 - 2 * fr);
    const spr = frames[idx] ?? null;
    const frameKey = (flapping ? "flap-" : "idle-") + (idx + 1);
    const keyNext = (flapping ? "flap-" : "idle-") + (nxt + 1);
    const articulatedTap = !!art.suitBody?.[suit.id] && w.tapAnimT >= 0;
    const eclipseImpact = suit.id === "eclipse" && w.bounceAnimT >= 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(localScale, localScale);
    if (eclipseImpact) {
        // Scale around the planet-facing edge instead of the sprite centre. The
        // contact point stays planted while Eclipse flattens, lengthens into the
        // rebound, and rings down to the exact original silhouette.
        const shape = bounceShape(w.bounceAnimT, w.bounceAnimStrength);
        const contactY = -w.bounceAnimDir * 18;
        ctx.translate(0, contactY);
        ctx.scale(shape.x, shape.y);
        ctx.translate(0, -contactY);
    }
    // the sim's real pitch — dives nose down, bounces kick the body over;
    // the old ±6° bank made every impact read as nothing happening
    // THE LEAN DIAL, applied to the rotation every suit gets - painted bank
    // or not. Split by direction because climbing and diving are separately
    // tunable: negative rot is nose-up. At 1 this is exactly the expression
    // it replaced. See SUIT_LEAN in control-constants.ts.
    const lean = leanFor(save, suit.id);
    let bank = w.squirrel.rot * bankScale * (w.squirrel.rot < 0 ? lean.up : lean.down);
    if (articulatedTap && !eclipseImpact) {
        // Every current model now uses the same eased visual pitch clock. Eclipse
        // supplies painted body poses; the other rigs use the identity-safe body
        // pulse and sectional tail bend in paintIllustrated below.
        const raw = Math.max(0, Math.min(1, w.tapAnimT / 0.14));
        const eased = 1 - Math.pow(1 - raw, 3);
        const fromLean = w.tapAnimFromRot < 0 ? lean.up : lean.down;
        bank = w.tapAnimFromRot * 0.8 * fromLean * (1 - eased) + bank * eased;
    }
    const kick = Math.min(1, Math.max(0, w.flapBoost) / 0.22);
    ctx.rotate(bank - (articulatedTap ? 0 : kick * 0.12));
    const pop = 1 + (articulatedTap ? 0 : kick * 0.05);
    ctx.scale(pop, pop);
    // fresh planet bounce: a squash-and-stretch pulse sells the impact
    const sq = Math.max(0, (w.hitCooldown - 0.33) / 0.22);
    if (!eclipseImpact && sq > 0)
        ctx.scale(1 + sq * 0.16, 1 - sq * 0.2);
    paintIllustrated(ctx, spr, 0, 2, 52, helm, suit, w.time, art, frameKey, frames[nxt] ?? null, keyNext, blend, w.flight === "tunnel" ? "light" : skyLuma(w) > 0.42 ? "dark" : "light", w.tailA, w.tapAnimT, w.bounceAnimT, w.bounceAnimDir, w.bounceAnimStrength, w.squirrel.vy, save.eclipseMotionMode ?? 2, w.speed, lean);
    ctx.restore();
}
const PAL_ANIM_FPS = 12;
function paintPal(ctx, art, id, x, y, size, time = 0) {
    // A pal with an idle bank plays it; one without keeps its still, which is
    // what every pal did before the banks existed. The banks are their own
    // true lengths, so the clock is frames-per-second and not a fraction of
    // some shared cycle - a 4-frame loop and a 36-frame loop both read at the
    // pace they were drawn for.
    const bank = art?.palAnim?.[id];
    const anim = bank && bank.length > 1
        ? bank[Math.floor(time * PAL_ANIM_FPS) % bank.length]
        : null;
    const spr = anim ?? art?.pals?.[id];
    if (spr) {
        // box fit, not core: companions are sidekicks, smaller than the pilot
        // The premium silhouettes carry more transparent negative space than
        // the round original pals. Small visual-only lifts keep their faces at
        // the same apparent card/live scale without changing their hitboxes or
        // any gameplay value (pals have neither).
        const fit = size * (id === "nightglider" ? 1.32
            : id === "clockling" ? 1.12
                : id === "prismwing" ? 1.08
                    : 1);
        drawSprite(ctx, spr, x, y, fit);
        return;
    }
    if (id !== "none") {
        // no painted portrait for this companion — the vector renderer from
        // the live game draws it (comet sprite, nebula wisp)
        drawPalOn(ctx, id, x, y, size / 32, performance.now() / 1000);
        return;
    }
    if (id === "none") {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2, y + size * 0.2);
        ctx.lineTo(x + size * 0.2, y - size * 0.2);
        ctx.stroke();
    }
}
export function paintPortrait(ctx, art, helmet, suit, cx, cy, size, _t = 0) {
    // Always paint the PILOT wearing the helmet. Helmet-only art belongs
    // on the helmet cards, which have their own path — short-circuiting
    // here left the Flight suit showing a floating helmet and no squirrel.
    const body = art?.suits?.[suit.id] ?? art?.squirrelIdle?.[0];
    if (!body)
        return;
    drawSprite(ctx, body, cx, cy + 2, size);
    const key = art?.suits?.[suit.id] ? "suit:" + suit.id : "idle-1";
    if (!wearsOwnHead(suit))
        paintDome(ctx, body, key, helmet, cx, cy + 2, size, art);
}
/** A LOOPING JUMP, painted with the game's own renderer.
 *
 *  The shop needs to show what a suit actually DOES, and a static portrait
 *  cannot: Robo's articulated tap, Eclipse's impact squash and every rig's
 *  pitch all live in the flight path, not the idle pose. drawPilot() owns
 *  that path but reads a dozen fields off a live World, so rather than fake
 *  a World this drives paintIllustrated directly - the same painter, given
 *  a synthetic tap clock instead of a simulated one.
 *
 *  One cycle: tap, rise, stall, fall. Same shape as a real flap, so what
 *  the shop shows is what the pilot will fly.
 */
/** THE PLUME, ON THE SIM'S OWN SPRING. The preview used to hand
 *  paintIllustrated a flat tail angle of 0, which is why the tail sat
 *  curled and still while every other part of the suit moved - and why the
 *  pal, which has no such shortcut, looked alive next to it.
 *
 *  The sim integrates this spring frame by frame off its world state. A
 *  preview has no world, and is drawn from two different canvases, so it
 *  cannot keep state of its own without them fighting over it. But the
 *  forcing here is known: one impulse per beat, forever. So the same
 *  recurrence - not an approximation of it, the same lines - is replayed
 *  from two beats back on each call, which is far past the point where an
 *  older beat is worth a pixel. Checked against the sim across a settled
 *  beat: within 0.1 rad at the steepest point and 4% at the peak, which is
 *  one frame's worth of curve. */
function previewTailAngle(p, beat) {
    const dt = 1 / 60;
    let a = 0;
    let v = 0;
    const settle = (steps) => {
        for (let i = 0; i < steps; i++) {
            v += (-TAIL.stiffness * a - TAIL.damping * v) * dt;
            a += v * dt;
            if (a > TAIL.maxA) {
                a = TAIL.maxA;
                v *= -0.35;
            }
            if (a < -TAIL.maxA) {
                a = -TAIL.maxA;
                v *= -0.35;
            }
        }
    };
    for (let k = 0; k < 2; k++) {
        v += TAIL.flap;
        settle(Math.round(beat / dt));
    }
    v += TAIL.flap;
    settle(Math.round(p / dt) + 1); // +1: the sim draws after its step
    return a;
}
/** The preview's lean, smoothed and LOOP-CONSISTENT.
 *
 *  A damped follower has memory, so its value at a given phase depends on
 *  everything before it - and a preview is entered at an arbitrary time.
 *  Replaying two whole beats first lands on the loop's steady state rather
 *  than on whatever the first painted frame happened to start from, so the
 *  same phase always draws the same lean no matter when the menu opened.
 *  Same trick previewTailAngle uses for the plume.
 */
function previewRot(p, beat, kick, pull) {
    const dt = 1 / 120;
    const tau = 0.085; // ~85ms to ease through a tap
    const k = 1 - Math.exp(-dt / tau);
    let r = 0;
    const end = beat * 2 + p;
    for (let tt = 0; tt < end; tt += dt) {
        const ph = ((tt % beat) + beat) % beat;
        const vy = -kick + pull * ph;
        r += (Math.max(-0.34, Math.min(0.6, vy / 900)) - r) * k;
    }
    return r;
}
export function paintFlightPreview(ctx, art, suit, helmet, cx, cy, size, t, lean = SUIT_LEAN_DEFAULT, 
// THE LEAN EDITOR'S INSTRUMENT. The ordinary preview flies a gentle tap
// arc that never reaches the attitudes a real dive does, so dialling a
// lean against it would be tuning the wrong end of the range. In sweep
// mode the pilot rolls slowly between FULL CLIMB and FULL DIVE - the
// clamps the sim actually uses - so the number being changed is judged at
// the extremes where it matters.
sweep = false) {
    if (!art)
        return;
    // FLIGHT, NOT A POSE. The pass before this showed one tap every five
    // seconds and then held still for the other four - which read as a frozen
    // suit sitting next to a pal that never stops, and looked nothing like
    // the game, where the pilot taps again long before the last flap has
    // finished. So the preview flies: a tap every beat, the arc between them,
    // and the plume swinging on the sim's own spring. Still slowed, because
    // seeing the motion was the point of a preview - but never stopped.
    const BEAT = 1.6; // one tap per beat
    const RATE = 0.5; // the tap animation itself, halved
    const p = ((t % BEAT) + BEAT) % BEAT; // time since this beat's tap
    // THE TAP PLAYS THE WHOLE BANK. It used to play a FIFTH of it: the window
    // ran 0.6s and fed the clock straight through as tapAnimT = p * RATE, so
    // tapAnimT never passed 0.30 against a TAP_ANIM_DURATION of 1.0 - which
    // indexes frames 0..4 of sixteen and then hard-cuts back to the rig pose
    // mid-gesture. That cut is the jolt: measured at 10px of travel and 15% of
    // silhouette in a single frame on Robo. Mapping the window onto the whole
    // duration plays all sixteen and lands on the frame the bank was drawn to
    // land on, which is the rig pose it returns to.
    const tapWindow = TAP_ANIM_DURATION;
    const flapWindow = 0.24 / RATE;
    // THE HEAD DOES NOT SIT STILL IN THE HELMET, and holding the body pose to
    // hide that was the wrong trade - it cost every rigged suit its animation,
    // which is the whole reason the preview exists. The suits animate.
    //
    // The float itself is real and pre-existing: a rigged suit's tap poses
    // move the head, but the dome is anchored to ONE per-suit position because
    // no per-POSE anchors were ever measured for those banks. Suits that wear
    // their own head - Cat, Volt, Cyber - never had the problem, which is
    // exactly why Cyber looked right.
    //
    // Fixing it properly means a measured dome anchor per pose per rigged
    // suit. Template-matching the head through the banks tracks Robo cleanly
    // and drifts on Big Booty and Eclipse, so it is an art measurement rather
    // than something to infer - see the note in the PR.
    const tapAnimT = p < tapWindow ? (p / tapWindow) * TAP_ANIM_DURATION : -1;
    const flapping = p < flapWindow;
    const frames = flapping ? art.squirrelFlap : art.squirrelIdle;
    const speed = flapping ? 10 : 5;
    const ft = t * speed * RATE;
    const idx = frames?.length ? Math.floor(ft) % frames.length : 0;
    const nxt = frames?.length ? (idx + 1) % frames.length : 0;
    const fr = ft - Math.floor(ft);
    const blend = fr * fr * (3 - 2 * fr);
    // The arc a tap actually makes: up hard on the beat, the pull easing it
    // back down, the next tap catching it. The pull is chosen so the pilot
    // comes back to exactly the height it left from as the beat comes round,
    // which is what makes this loop with no seam and no fade.
    const KICK = 210; // the sim's own tap velocity
    const PULL = (2 * KICK) / BEAT;
    const vy = -KICK + PULL * p;
    const rise = -KICK * p + (PULL * p * p) / 2; // zero at both ends of a beat
    // ROTATION IS SMOOTHED, because the arc's VELOCITY is a sawtooth: vy runs
    // -210 up to +210 across a beat and then snaps back to -210 at the next
    // tap. Position loops seamlessly - rise is zero at both ends - but a
    // rotation taken straight off vy jumps 27 degrees on every beat boundary.
    // In flight that is hidden by speed and by the pose changing on the same
    // frame; at half speed and 158px it reads as the pilot flinching.
    const rot = sweep
        // the sim's own clamps: -0.55 at full climb, +0.95 at full dive
        ? -0.55 + (0.95 + 0.55) * (0.5 - 0.5 * Math.cos((t / 2.6) * Math.PI * 2))
        : previewRot(p, BEAT, KICK, PULL);
    ctx.save();
    ctx.translate(cx, cy + rise * (size / 52) * 0.055);
    ctx.scale(size / 52, size / 52);
    // the old line divided by 0.24 while the window was 0.24/RATE, so the
    // second half of every flap fed a NEGATIVE kick - tilting the wrong way
    // and shrinking the suit instead of popping it
    const kick = flapping ? 1 - p / flapWindow : 0;
    const articulated = !!art.suitBody?.[suit.id] && tapAnimT >= 0;
    // the same expression the real flight uses, so what the editor shows is
    // what the run does
    ctx.rotate(rot * 0.8 * (rot < 0 ? lean.up : lean.down) - (articulated ? 0 : kick * 0.12));
    const pop = 1 + (articulated ? 0 : kick * 0.05);
    ctx.scale(pop, pop);
    paintIllustrated(ctx, frames?.[idx] ?? null, 0, 2, 52, helmet, suit, t, art, (flapping ? "flap-" : "idle-") + (idx + 1), frames?.[nxt] ?? null, (flapping ? "flap-" : "idle-") + (nxt + 1), blend, "light", previewTailAngle(p, BEAT), tapAnimT, -1, 0, 0, vy, 2, 300, lean);
    ctx.restore();
}
export function paintPalPreview(ctx, art, id, cx, cy, size) {
    paintPal(ctx, art, id, cx, cy, size, performance.now() / 1000);
}
export function paintTrailPreview(ctx, trail, cx, cy, t = 0) {
    drawTrailPreviewOn(ctx, trail.id, cx, cy, t);
}
/** The vortex that eats the screen while a black hole or wormhole
 *  takes hold — spiral arms winding in, a dark core, a colour bloom.
 *  Purely procedural: no art needed. */
function drawSwirl(ctx, w, art) {
    // The black hole now has a painted collapse: the ring winds in, whips
    // its streaks around and pinches out. When those frames are loaded a
    // hole warp plays them over the bloom instead of the procedural core.
    const painted = w.warpKind === "hole" && !(w.flight === "lost") ? art?.holeEnter : null;
    if (painted && painted.length) {
        const prog = Math.min(0.999, Math.max(0, 1 - w.warpT));
        const frame = painted[Math.min(painted.length - 1, Math.floor(prog * painted.length))];
        const { W: pw, H: ph } = w;
        const diag = Math.hypot(pw, ph);
        const e = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
        // Grow into the viewer rather than opening already full-bleed: at the
        // start the portal is a shape on screen, by the end it has swallowed
        // it. Centred where the procedural swirl sits, so the two read as one
        // effect while the bank is still streaming in.
        const s = diag * (0.62 + 1.05 * e);
        ctx.save();
        const bloom = ctx.createRadialGradient(pw / 2, ph * 0.46, 0, pw / 2, ph * 0.46, diag * 0.62);
        bloom.addColorStop(0, `rgba(192,132,252,${(0.45 * e).toFixed(3)})`);
        bloom.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, pw, ph);
        ctx.drawImage(frame, pw / 2 - s / 2, ph * 0.46 - s / 2, s, s);
        ctx.restore();
        return;
    }
    const { W, H } = w;
    const t = 1 - w.warpT; // 0 -> 1 over the transition
    const worm = w.warpKind === "worm" || w.flight === "lost";
    const cx = W / 2;
    const cy = H * 0.46;
    const reach = Math.hypot(W, H) * 0.62;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const hue = worm ? [110, 240, 216] : [192, 132, 252];
    ctx.save();
    // colour bloom washing over the sky
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
    bloom.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.55 * ease).toFixed(3)})`);
    bloom.addColorStop(0.55, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.16 * ease).toFixed(3)})`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);
    // spiral arms
    ctx.translate(cx, cy);
    ctx.rotate(t * Math.PI * 2.4 * (worm ? -1 : 1));
    ctx.lineCap = "round";
    for (let a = 0; a < 5; a++) {
        ctx.beginPath();
        const off = (a / 5) * Math.PI * 2;
        for (let k = 0; k <= 42; k++) {
            const f = k / 42;
            const rad = reach * (0.06 + f * 0.95) * (1 - ease * 0.45);
            const ang = off + f * 4.4;
            const px = Math.cos(ang) * rad;
            const py = Math.sin(ang) * rad * 0.92;
            if (k === 0)
                ctx.moveTo(px, py);
            else
                ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.5 * ease).toFixed(3)})`;
        ctx.lineWidth = 2 + 5 * ease;
        ctx.stroke();
    }
    // the core opens up and swallows the middle
    const coreR = reach * 0.30 * ease;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, coreR));
    core.addColorStop(0, `rgba(4,2,10,${(0.96 * ease).toFixed(3)})`);
    core.addColorStop(0.72, `rgba(8,4,20,${(0.7 * ease).toFixed(3)})`);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, coreR), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${(0.5 * ease).toFixed(3)})`;
    ctx.lineWidth = 1.5 + 2 * ease;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, coreR * 1.04), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
export function hyperRunChargeCopy(race) {
    const route = raceRouteTarget(race);
    if (race.phase === "entry")
        return "WORMHOLE";
    if (route.entryReady)
        return "WORMHOLE READY";
    if (route.nextCleanGateEnters)
        return "NEXT CLEAN GATE: WORMHOLE";
    if (route.finalRoute)
        return "FINAL SPRINT";
    return `CHARGE ${race.charge}/100`;
}
export function hyperRunReadyLines(viewWidth) {
    if (viewWidth >= 520)
        return RACE_READY_COPY;
    return [
        "THREAD GATES · CHARGE SHORTCUTS",
        "FINISH FAST",
        "FLIGHT · HOLD / RELEASE",
        "DOUBLE-TAP + HOLD · BOOST",
        "SWIPE DOWN · DIVE",
        "WORMHOLE · DRAG TO ALIGN",
        "CENTER = FASTER EXIT",
        "PRESS + HOLD TO LAUNCH",
    ];
}
export function drawHud(ctx, w, art) {
    const { W } = w;
    if (w.race) {
        const race = w.race;
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "800 30px Figtree, system-ui";
        ctx.fillText(formatRaceTicks(race.finishTicks ?? race.tick), W / 2, 40);
        ctx.fillStyle = "rgba(255,224,128,.92)";
        ctx.font = "800 10px Figtree, system-ui";
        const phase = race.phase === "normal" ? "HYPER RUN" : race.phase.toUpperCase();
        ctx.fillText(`${phase} · ${Math.min(RACE_LENGTH, Math.floor(race.coursePosition))} / ${RACE_LENGTH}`, W / 2, 57);
        const route = raceRouteTarget(race);
        const tunnelQuality = race.phase === "tunnel" || race.phase === "return"
            ? raceTunnelQuality(race)
            : null;
        const judgedRings = tunnelQuality
            ? tunnelQuality.passed + tunnelQuality.perfect + tunnelQuality.missed
            : 0;
        const totalTunnelRings = tunnelQuality ? judgedRings + tunnelQuality.pending : 0;
        const chargeCopy = tunnelQuality
            ? race.phase === "return"
                ? `EXIT ${Math.round(tunnelQuality.exitSpeed)} · ${tunnelQuality.perfect} PERFECT`
                : `ALIGN ${judgedRings}/${totalTunnelRings} · PERFECT ${tunnelQuality.perfect} · EXIT ${Math.round(tunnelQuality.exitSpeed)}`
            : hyperRunChargeCopy(race);
        const cellW = 4;
        const gap = 2;
        const groupGap = 3;
        const totalW = cellW * 20 + gap * 19 + groupGap * 4;
        const x0 = W / 2 - totalW / 2;
        for (let i = 0; i < 20; i++) {
            const groupsBefore = Math.floor(i / 4);
            const x = x0 + i * (cellW + gap) + groupsBefore * groupGap;
            const activeCells = tunnelQuality
                ? Math.floor(judgedRings / Math.max(1, totalTunnelRings) * 20)
                : Math.floor(race.charge / 5);
            ctx.fillStyle = i < activeCells
                ? tunnelQuality ? "#fff" : "#6ef0d8"
                : "rgba(255,255,255,.15)";
            ctx.fillRect(x, 66, cellW, 6);
        }
        ctx.fillStyle = race.phase === "tunnel" || race.phase === "return"
            ? "#a9f5ff"
            : race.phase === "entry" || route.entryReady || route.nextCleanGateEnters
                ? "#ffe77d"
                : route.finalRoute
                    ? "rgba(214,225,241,.78)"
                    : "rgba(255,255,255,.68)";
        ctx.font = "700 9px Figtree, system-ui";
        ctx.fillText(chargeCopy, W / 2, 84);
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffd080";
        ctx.font = "700 14px Figtree, system-ui";
        ctx.fillText(`${race.acorns}`, 24, 28);
        if (w.ready) {
            const readyLines = hyperRunReadyLines(W);
            const compact = W < 520;
            const lineHeight = compact ? 20 : 21;
            const panelWidth = Math.min(W - 24, compact ? 430 : 560);
            const panelHeight = readyLines.length * lineHeight + 28;
            const panelTop = Math.min(w.H - panelHeight - 12, Math.max(96, w.H * 0.66));
            ctx.fillStyle = "rgba(4,8,20,.78)";
            ctx.strokeStyle = "rgba(169,245,255,.34)";
            ctx.lineWidth = 1;
            round(ctx, W / 2 - panelWidth / 2, panelTop, panelWidth, panelHeight, 12);
            ctx.fill();
            ctx.stroke();
            ctx.textAlign = "center";
            readyLines.forEach((line, i) => {
                const isLaunch = i === readyLines.length - 1;
                ctx.fillStyle = isLaunch ? "#ffe086" : i === 0 ? "#fff" : "rgba(215,230,247,.9)";
                ctx.font = isLaunch
                    ? "900 15px Figtree, system-ui"
                    : i === 0 ? "900 14px Figtree, system-ui" : "800 14px Figtree, system-ui";
                ctx.fillText(line, W / 2, panelTop + 21 + i * lineHeight);
            });
        }
        return;
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 36px Figtree, system-ui";
    if (w.lvl) {
        // a level counts DOWN to the finish, not up into the void — and a
        // Wormhole mission counts SECTIONS, its own unit of survival
        const total = w.lvl.def.gates;
        if (w.lvl.def.base === "tunnel" && w.tunnel) {
            // a wormhole mission is a SURVIVAL clock: seconds left to the finish
            ctx.fillText(`${Math.ceil(Math.max(0, total - w.tunnel.time))}s`, W / 2, 46);
        }
        else {
            ctx.fillText(`${Math.min(w.score, total)}/${total}`, W / 2, 46);
        }
        ctx.font = "700 11px Figtree, system-ui";
        ctx.fillStyle = "rgba(255,224,128,0.9)";
        ctx.fillText(w.lvl.portal ? "FLY TO THE PORTAL" : `LEVEL ${w.lvl.def.id} · ${w.lvl.def.name}`, W / 2, 64);
    }
    else {
        ctx.fillText(String(w.score), W / 2, 46);
    }
    if (w.flight === "tunnel" && w.tunnel) {
        const t = w.tunnel;
        if (t.detour) {
            // A DETOUR HAS A DIFFERENT JOB TO REPORT. Flow is the standalone
            // mode's scoring and pays nothing here, so a meter that filled and
            // glowed while the gate count sat frozen was reporting a number that
            // did not exist - "meaningless", in one word. What a trip is worth is
            // acorns, and what the pilot needs is how long is left and where the
            // door is, so that is what the strip says instead.
            const left = Math.max(0, w.wormLeft);
            const closing = left <= WORM_EXIT_LEAD;
            const tone = closing ? "#c98cff" : "#78dfff";
            ctx.fillStyle = tone;
            ctx.font = "800 10px Figtree, system-ui";
            ctx.fillText(closing ? "FLY INTO THE EXIT" : `WORMHOLE  ${Math.ceil(left)}s`, W / 2, 64);
            const barW = 80;
            const barX = W / 2 - barW / 2;
            ctx.fillStyle = "rgba(255,255,255,.15)";
            ctx.fillRect(barX, 69, barW, 3);
            ctx.fillStyle = tone;
            ctx.fillRect(barX, 69, barW * Math.min(1, left / WORM_TRIP_SECONDS), 3);
        }
        else {
            const flowColor = t.multiplier >= 3 ? "#f3b4ff" : t.multiplier === 2 ? "#ffe680" : "#78dfff";
            ctx.fillStyle = flowColor;
            ctx.font = "800 10px Figtree, system-ui";
            ctx.fillText(`FLOW  ×${t.multiplier}`, W / 2, 64);
            const barW = 80;
            const barX = W / 2 - barW / 2;
            ctx.fillStyle = "rgba(255,255,255,.15)";
            ctx.fillRect(barX, 69, barW, 3);
            ctx.fillStyle = flowColor;
            ctx.fillRect(barX, 69, barW * (t.flow / 100), 3);
        }
        if (t.bannerLeft > 0) {
            ctx.globalAlpha = Math.min(1, t.bannerLeft);
            ctx.fillStyle = t.bannerKind === "region" || t.bannerKind === "milestone"
                ? "#f2b653"
                : t.bannerKind === "reward" ? "#ffe680" : "rgba(225,232,255,.9)";
            ctx.font = "800 11px Figtree, system-ui";
            ctx.fillText(t.banner, W / 2, 88);
            ctx.globalAlpha = 1;
        }
    }
    if (w.envMsgT > 0) {
        ctx.globalAlpha = Math.min(1, w.envMsgT);
        ctx.fillStyle = "rgba(232,164,74,0.95)";
        ctx.font = "700 12px Figtree, system-ui";
        ctx.fillText(ENVS[w.envB].name, W / 2, 66);
        ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
    ctx.font = "700 14px Figtree, system-ui";
    ctx.fillStyle = "#ffd080";
    ctx.fillText(`${w.runAcorns}`, 36, 28);
    if (w.shieldCharges > 0) {
        for (let i = 0; i < w.shieldCharges; i++) {
            ctx.fillStyle = "rgba(122,216,255,0.9)";
            ctx.beginPath();
            ctx.arc(W - 22 - i * 16, 26, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    // status lines stack instead of colliding — mode line first, then any
    // live power-ups beneath it
    let hudY = w.flight === "tunnel" ? 108 : 88;
    const hudLine = (text, color) => {
        ctx.textAlign = "center";
        ctx.fillStyle = color;
        ctx.font = "700 13px Figtree, system-ui";
        ctx.fillText(text, W / 2, hudY);
        hudY += 18;
    };
    if (w.warpGateEnd >= 0) {
        // Free Flight measures the stretch in gates, so the readout counts the
        // same thing the pilot is flying through, and names the way out.
        const left = Math.max(0, w.warpGateEnd - w.score);
        hudLine(left > 0 ? "BLACK HOLE  " + left + " gates" : "BLACK HOLE  exit ahead", "#c084fc");
    }
    else if (w.warpLeft > 0) {
        hudLine((w.flight === "deep" ? "SHIFT  " : "BLACK HOLE  ") + Math.ceil(w.warpLeft) + "s", "#c084fc");
    }
    else if (w.flight === "deep" && w.warpT <= 0)
        hudLine("FIRST SHIFT IN " + Math.ceil(Math.max(0, 10 - w.deepTimer)) + "s", "rgba(192,132,252,0.8)");
    if (w.powerLeft > 0)
        hudLine(`${w.flight === "tunnel" ? "FREEZE" : "SLOW"}  ${Math.ceil(w.powerLeft)}s`, "#6ef0ff");
    if (w.invulnLeft > 0)
        hudLine(`GOLD  ${Math.ceil(w.invulnLeft)}s`, "#ffd060");
    if (w.flight === "tunnel" && w.tunnel && w.tunnel.multiplierLeft > 0)
        hudLine(`FLOW BOOST  ${Math.ceil(w.tunnel.multiplierLeft)}s`, "#ffe680");
    if (w.recoveryMsg) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "800 15px Figtree, system-ui";
        ctx.fillText(w.recoveryMsg, W / 2, w.H * 0.22);
    }
    if (w.warpT > 0) {
        drawSwirl(ctx, w, art);
        ctx.textAlign = "center";
        ctx.fillStyle = w.warpKind === "worm" || w.flight === "lost" ? "#6ef0d8" : "#c084fc";
        ctx.font = "800 22px Figtree, system-ui";
        ctx.fillText(w.warpKind === "timeline"
            ? "TIMELINE SHIFT!"
            : w.warpKind === "worm" || w.flight === "lost"
                ? "WORMHOLE!"
                : "BLACK HOLE!", W / 2, w.H * 0.3);
    }
    if (w.ready && !w.tut) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "700 18px Figtree, system-ui";
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(w.time * 4);
        ctx.fillText(w.flight === "tunnel" ? tunnelControlLabel(w) : "TAP TO FLY", W / 2, w.H * 0.38);
        ctx.globalAlpha = 1;
    }
    // THE LEAD-IN HINT. A wormhole entry never shows READY - the pilot is
    // thrown straight in from Lost in Space - so the only place the corridor
    // can say which verb it wants is here, over the open run of it. It fades
    // out as the walls arrive rather than vanishing at a hard edge.
    if (!w.ready && !w.tut && w.flight === "tunnel" && w.tunnel && w.tunnel.leadNodes > 0) {
        const nose = w.tunnel.nodes.find((n) => n.x > w.W * PHYS.squirrelX);
        const left = nose ? w.tunnel.leadNodes - nose.index : 0;
        if (left > 0) {
            ctx.textAlign = "center";
            ctx.fillStyle = "#6ef0d8";
            ctx.font = "800 19px Figtree, system-ui";
            ctx.globalAlpha = Math.min(1, left / 4) * (0.72 + 0.28 * Math.sin(w.time * 5));
            ctx.fillText(tunnelControlLabel(w), W / 2, w.H * 0.30);
            ctx.globalAlpha = 1;
        }
    }
    if (w.tut?.hold) {
        const st = w.tut.stage;
        const title = st === "tap" ? "TAP"
            : st === "tap2" ? "TAP AGAIN"
                : st === "swipe" ? "SWIPE DOWN"
                    : st === "yourturn" ? "YOUR TURN!"
                        : "A COMPANION APPEARS!";
        const body = st === "tap" ? "anywhere — a boost upward"
            : st === "tap2" ? "one more boost — then just watch"
                : st === "swipe" ? "dive back down and make the gap"
                    : st === "yourturn" ? "fly the gaps · grab the acorns"
                        : "The Acorn pal reels in nearby acorns.";
        drawPrompt(ctx, w, title, body, st === "swipe" ? w.H * 0.58 : w.H * 0.36);
        if (w.tut.nudge) {
            ctx.fillStyle = "#ffd080";
            ctx.font = "700 13px Figtree, system-ui";
            ctx.textAlign = "center";
            ctx.fillText(w.tut.nudge, W / 2, w.H * 0.68);
        }
    }
    else if (w.tut?.stage === "glide" || w.tut?.stage === "bounce") {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffb84d";
        ctx.font = "800 14px Figtree, system-ui";
        ctx.fillText(w.tut.stage === "bounce" ? "BOING! PLANETS BOUNCE YOU"
            : "PLANET AHEAD — LAND ON IT", W / 2, 86);
    }
    else if (w.tut?.stage === "dive") {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffb84d";
        ctx.font = "800 14px Figtree, system-ui";
        ctx.fillText("MAKE THE GAP", W / 2, 86);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "700 12px Figtree, system-ui";
        ctx.fillText("a tap levels you off", W / 2, 104);
    }
    else if (w.tut?.stage === "gates" || w.tut?.stage === "palDemo") {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(243,239,228,0.8)";
        ctx.font = "700 13px Figtree, system-ui";
        ctx.fillText(w.tut.stage === "gates" ? "FLY THE GAPS  ·  GRAB THE ACORNS" : "WATCH THE MAGNET", W / 2, 86);
    }
    else if (w.tut?.stage === "ready") {
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "800 20px Figtree, system-ui";
        ctx.fillText("YOU'RE READY, PILOT", W / 2, w.H * 0.3);
    }
}
function drawPrompt(ctx, w, title, body, cy) {
    const bw = Math.min(320, w.W - 40);
    const bh = 108;
    ctx.fillStyle = "rgba(12,18,36,0.82)";
    ctx.strokeStyle = "rgba(232,164,74,0.45)";
    ctx.lineWidth = 1.5;
    round(ctx, w.W / 2 - bw / 2, cy - bh / 2, bw, bh, 16);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 16px Figtree, system-ui";
    ctx.fillText(title, w.W / 2, cy - 8);
    ctx.fillStyle = "rgba(243,239,228,0.72)";
    ctx.font = "600 12px Figtree, system-ui";
    ctx.fillText(body, w.W / 2, cy + 16);
    if (w.tut?.hold) {
        const armA = Math.max(0, Math.min(1, (w.tut.t - TUT_ARM) / 0.3));
        if (armA > 0) {
            ctx.globalAlpha = armA * (0.7 + 0.3 * Math.sin(w.time * 4));
            ctx.fillStyle = w.tut.stage === "swipe" ? "#ffb84d" : "#6ef0ff";
            ctx.font = "700 12px Figtree, system-ui";
            ctx.fillText(w.tut.stage === "swipe" ? "try it now"
                : w.tut.stage === "yourturn" ? "tap to begin" : "tap to continue", w.W / 2, cy + 36);
            ctx.globalAlpha = 1;
        }
    }
}
function round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
