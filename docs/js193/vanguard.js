import { paintVanguardRig } from './vanguard-rig.js?v=193';
import { PHYS } from './catalog.js?v=193';
import { createManeuverMotion, maneuverTap, maneuverContact, stepManeuver, paintManeuver } from './vanguard-maneuver.js?v=193';
export const VANGUARD_FRAMES = 16;
export const articulatedVanguard = (mode) => mode === 'cruise' || mode === 'jetpack';
export const VANGUARD_CYCLE_SECONDS = { cinematic: 1.8, flow: 1.15, cruise: 1.8, jetpack: 1.8 };
export const VANGUARD_CONTACT_SECONDS = .95;
// Neutral art points upward by 34 degrees. This fixed offset seats the
// entire drawing horizontally; heading below follows flight, not taps.
export const VANGUARD_ART_PITCH = 34 * Math.PI / 180;
export function createVanguardMotion(mode = 'cruise') {
    return { mode, phase: 0, frame: 0, heading: 0, pitch: mode === 'jetpack' ? -28 * DEG : mode === 'cruise' ? 16 * DEG : VANGUARD_ART_PITCH,
        time: 0, diving: false, freshThrust: true, thrustLeft: 0, thrustPower: 0,
        thrust: 0, contacts: [], nearArm: 0, farArm: 0, nearLeg: 0, farLeg: 0, settle: 0,
        drive: 0, contactAge: 10, contactPower: 0, contactNormalY: -1, maneuver: createManeuverMotion(mode === 'jetpack'),
        rates: { heading: 0, pitch: 0, nearArm: 0, farArm: 0, nearLeg: 0, farLeg: 0, settle: 0, drive: 0 } };
}
export function vanguardGate(s) { s.freshThrust = true; }
// deltaVy is the accepted upward impulse (old vy minus new vy).
export function vanguardTap(s, deltaVy = 450) {
    maneuverTap(s.maneuver, Math.max(0, deltaVy));
    if (articulatedVanguard(s.mode)) {
        // Actual accepted acceleration controls intensity. Repeated taps sustain
        // pressure; they cannot snap a joint or rewind the continuous tail.
        s.thrustPower = clamp(Math.max(0, deltaVy) / 650, .24, 1);
        s.thrustLeft = .26;
        s.freshThrust = false;
        s.diving = false;
        return;
    }
    s.thrustPower = s.freshThrust ? .45 : 1;
    s.freshThrust = false;
    s.diving = false;
    s.thrustLeft = .58;
    // No body pose or tail-clock mutation. The accepted input changes vy in
    // sim.ts; the body responds to that movement on subsequent visual ticks.
}
export function vanguardDive(s) {
    s.diving = true;
    s.freshThrust = true;
    s.thrustLeft = 0;
}
export function vanguardContact(s, x, y, nx, ny, strength) {
    s.contacts.push({ x, y, nx, ny, age: 0, strength });
    if (s.contacts.length > 3)
        s.contacts.shift();
    s.freshThrust = true;
    s.diving = false;
    s.contactAge = 0;
    s.contactPower = clamp(strength, .35, 1);
    s.contactNormalY = clamp(ny, -1, 1);
    maneuverContact(s.maneuver, ny, strength);
    // Surface dust outlives an immediate tap; the body follows the rebound vy.
}
const DEG = Math.PI / 180;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
// Critically damped second-order response with bounded angular speed. Unlike
// a pose lerp, an accepted tap cannot reverse rotation in one video frame.
function joint(s, key, target, dt, omega = 15, maxRate = 1.2) {
    let v = s.rates[key];
    v += (omega * omega * (target - s[key]) - 2 * omega * v) * dt;
    v = clamp(v, -maxRate, maxRate);
    s[key] += v * dt;
    s.rates[key] = v;
}
function stepArticulated(s, dt, vy) {
    const upright = s.mode === 'jetpack';
    // Real short arcs change pose immediately, while the inertia continues
    // through their apex. Descent is read mostly in limbs, not a nose dive.
    const direction = clamp(vy / 360, -1, 1);
    const lift = Math.max(0, -direction), fall = Math.max(0, direction);
    for (let left = dt; left > 1e-8;) {
        const h = Math.min(left, 1 / 120);
        left -= h;
        s.time += h;
        s.contactAge += h;
        s.thrustLeft = Math.max(0, s.thrustLeft - h);
        const pressure = s.thrustPower * Math.min(1, s.thrustLeft / .18);
        s.thrust += (pressure - s.thrust) * (1 - Math.exp(-h / .065));
        joint(s, 'drive', pressure, h, 18, 3);
        const target = (direction < 0 ? direction * (upright ? 6 : 10) : direction * (s.diving ? (upright ? 25 : 18) : (upright ? 12 : 8))) * DEG;
        joint(s, 'heading', target, h, 17, 1.15);
        // Smooth the base attitude too: changing the beta toggle preserves pose.
        joint(s, 'pitch', (upright ? -28 : 16) * DEG + s.heading - s.drive * (upright ? 2 : 1.4) * DEG, h, 19, 1.2);
        // Loose limbs keep a slow, asymmetric float even when short taps hold
        // velocity near its ascent limit. This clock NEVER restarts on input.
        // The delayed second arm and legs follow through instead of pumping in
        // lockstep; the second harmonic softens the return into a longer settle.
        const cycle = s.time * 2 * Math.PI / 2.15;
        const nearFloat = Math.sin(cycle) + .12 * Math.sin(cycle * 2 - .65);
        const farFloat = Math.sin(cycle - 1.10) + .14 * Math.sin(cycle * 2 - 1.8);
        const kneeFloat = Math.sin(s.time * 2 * Math.PI / 2.65 - 1.3);
        const trailingKnee = Math.sin(s.time * 2 * Math.PI / 2.65 - 2.35);
        // Contact is its own damped compression/push-off, never a tap squat.
        const age = s.contactAge;
        const compress = s.contactPower * Math.exp(-Math.pow((age - .10) / .075, 2));
        const push = s.contactPower * Math.exp(-Math.pow((age - .29) / .13, 2));
        const after = s.contactPower * Math.exp(-Math.pow((age - .51) / .17, 2));
        const bounce = (upright ? 1 : .55);
        const feet = bounce * Math.max(0, -s.contactNormalY);
        const brace = bounce * (s.contactNormalY > 0 ? -1 : 1);
        joint(s, 'nearArm', (.06 + lift * .09 - fall * .10 + s.drive * .09 + nearFloat * .36 + compress * .16 * brace), h, 14, 1.3);
        joint(s, 'farArm', (.13 + lift * .06 - fall * .07 + s.drive * .085 + farFloat * .40 + compress * .19 * brace), h, 12, 1.3);
        joint(s, 'nearLeg', (-lift * .09 + fall * .10 - s.drive * .06 + kneeFloat * .23 + (compress * .27 - push * .18 + after * .04) * feet), h, 11, 1.2);
        joint(s, 'farLeg', (-lift * .06 + fall * .07 - s.drive * .04 + trailingKnee * .18 + (compress * .19 - push * .13) * feet), h, 10, 1.2);
        joint(s, 'settle', (-s.drive * 2.5 + Math.sin(cycle - .7) * 2.8 + (compress * 7 - push * 4) * feet), h, 13, 35);
    }
    s.phase = (s.phase + dt / VANGUARD_CYCLE_SECONDS[s.mode]) % 1;
    s.frame = Math.floor(s.phase * VANGUARD_FRAMES);
}
export function stepVanguard(s, dt, vy) {
    if (!(dt > 0) || !Number.isFinite(dt) || !Number.isFinite(vy))
        return;
    // The engine bounds ticks; guard isolated preview callers after suspension.
    dt = Math.min(dt, .25);
    // Keep the new rig warm even while an original comparison style is chosen.
    // A live style switch therefore has no stale landing or tail recoil.
    stepManeuver(s.maneuver, dt, vy, s.diving, s.mode === 'jetpack');
    if (articulatedVanguard(s.mode)) {
        stepArticulated(s, dt, vy);
        for (const p of s.contacts)
            p.age += dt;
        s.contacts = s.contacts.filter(p => p.age < VANGUARD_CONTACT_SECONDS);
        return;
    }
    s.time += dt;
    s.contactAge += dt;
    s.phase = (s.phase + dt / VANGUARD_CYCLE_SECONDS[s.mode]) % 1;
    s.frame = Math.floor(s.phase * VANGUARD_FRAMES);
    // Gravity may tip the body immediately, even midway through a tail beat.
    // Ordinary falls remain shallow (22 deg); accepted swipes may reach 60.
    const target = Math.max(-28 * Math.PI / 180, Math.min((s.diving ? 60 : 22) * Math.PI / 180, Math.atan2(vy, s.diving ? 330 : 520)));
    s.heading += (target - s.heading) * (1 - Math.exp(-dt / (s.mode === 'cinematic' ? .13 : .09)));
    s.pitch = VANGUARD_ART_PITCH + s.heading;
    s.thrustLeft = Math.max(0, s.thrustLeft - dt);
    const thrustTarget = s.thrustLeft > 0 ? s.thrustPower * Math.min(1, s.thrustLeft / .28) : 0;
    s.thrust += (thrustTarget - s.thrust) * (1 - Math.exp(-dt / .11));
    for (const p of s.contacts)
        p.age += dt;
    s.contacts = s.contacts.filter(p => p.age < VANGUARD_CONTACT_SECONDS);
}
export function paintVanguard(ctx, art, x, y, size, state) {
    if (state && articulatedVanguard(state.mode) && art?.vanguardParts) {
        paintManeuver(ctx, art.vanguardParts, x, y, size, state.maneuver);
        return;
    }
    const bank = art?.vanguard?.length === VANGUARD_FRAMES ? art.vanguard : undefined;
    const frame = bank?.[state?.frame ?? 0] ?? art?.suits.vanguard;
    if (!frame)
        return;
    const scale = size / 400;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state?.pitch ?? 16 * DEG);
    if (state && state.thrust > .01) {
        if (articulatedVanguard(state.mode))
            paintJetpackExhaust(ctx, scale, state);
        else if (!state.diving)
            paintThrusters(ctx, scale, state.thrust);
    }
    // One registered, fully opaque whole-character drawing. The face and legs
    // hold their scale; the drawn tail changes shape instead of being stretched.
    if (state && articulatedVanguard(state.mode))
        paintVanguardRig(ctx, frame, scale, state);
    else
        ctx.drawImage(frame, -280 * scale, -280 * scale, 512 * scale, 512 * scale);
    ctx.restore();
}
function paintJetpackExhaust(ctx, scale, s) {
    ctx.save();
    ctx.scale(scale, scale);
    const power = s.thrust, lift = s.drive;
    // Nozzles follow the painted pack, not screen coordinates. The plume has
    // a warm outer falloff, cyan inner flow and a compact white-hot core.
    // Smooth low-frequency breathing: no random sparks or strobe on taps.
    for (const [x, y, m] of [[-54, -37, .78], [-40, -26, 1]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-.08 - lift * .06);
        const len = (34 + 100 * power) * m * (1 + .04 * Math.sin(s.time * 7));
        const grad = ctx.createLinearGradient(0, 0, -len * .63, len * .77);
        grad.addColorStop(0, `rgba(222,252,255,${power * .95})`);
        grad.addColorStop(.25, `rgba(87,226,255,${power * .75})`);
        grad.addColorStop(.64, `rgba(245,191,104,${power * .3})`);
        grad.addColorStop(1, 'rgba(245,191,104,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-5, -3);
        ctx.bezierCurveTo(-len * .2, len * .28, -len * .37, len * .57, -len * .63, len * .77);
        ctx.bezierCurveTo(-len * .31, len * .67, -len * .08, len * .30, 5, 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(223,251,255,${power * .85})`;
        ctx.beginPath();
        ctx.moveTo(-3, -2);
        ctx.quadraticCurveTo(-3, 8, -len * .19, len * .27);
        ctx.quadraticCurveTo(2, 9, 3, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}
function paintThrusters(ctx, scale, power) {
    ctx.save();
    ctx.scale(scale, scale);
    // Two restrained cyan cores inside warm gold exhaust. Smooth envelopes,
    // no random flicker, strobe, extra particles or effect on the real thrust.
    for (const [x, y] of [[-52, -42], [-30, -28]]) {
        ctx.save();
        ctx.translate(x, y);
        const length = 65 + power * 175;
        const glow = ctx.createLinearGradient(0, 0, -length, length * .22);
        glow.addColorStop(0, `rgba(205,248,255,${power * .95})`);
        glow.addColorStop(.3, `rgba(100,219,255,${power * .8})`);
        glow.addColorStop(.75, `rgba(237,199,128,${power * .4})`);
        glow.addColorStop(1, 'rgba(237,199,128,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(3, -7);
        ctx.quadraticCurveTo(-length * .2, -2, -length, length * .22);
        ctx.quadraticCurveTo(-length * .28, length * .20, 3, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}
/** Dust stays at the contacted surface in world space and lives through
 * the next tap. Three bounded, deterministic plumes; no RNG consumption.
 */
export function paintVanguardContacts(ctx, s) {
    ctx.save();
    for (const p of s.contacts) {
        const u = p.age / VANGUARD_CONTACT_SECONDS;
        const appear = Math.min(1, p.age / .055);
        for (let i = 0; i < 11; i++) {
            const fan = (i - 5) / 5;
            const spread = (5 + 26 * u) * fan;
            const lift = (4 + 12 * (1 - Math.abs(fan))) * Math.sin(u * Math.PI * .8);
            const x = p.x - p.ny * spread + p.nx * lift;
            const y = p.y + p.nx * spread + p.ny * lift;
            const r = (2.1 + (i % 3) * .6 + u * 3) * p.strength;
            ctx.fillStyle = `rgba(218,210,192,${.25 * appear * (1 - u) * (1 - u)})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}
// Each hangar/portrait canvas owns its preview clock. Same event controller
// as flight, including several rapid taps and a bounce followed by a tap.
const previews = new WeakMap();
const PREVIEW_EVENTS = [[.05, 'tap'], [.23, 'tap'], [.41, 'tap'], [.59, 'tap'], [.77, 'tap'], [.95, 'tap'],
    [1.13, 'tap'], [1.31, 'tap'], [2.9, 'dive'], [3.75, 'bounce'], [3.8, 'tap'], [3.98, 'tap'], [4.16, 'tap'],
    [4.34, 'tap'], [5.5, 'gate'], [5.55, 'tap'], [5.73, 'tap'], [5.91, 'tap']];
export function vanguardPreview(key, time, mode) {
    const t = Math.max(0, time) % 8;
    let p = previews.get(key);
    if (!p || t < p.t) {
        p = { t: 0, vy: 0, state: createVanguardMotion(mode) };
        previews.set(key, p);
    }
    p.state.mode = mode;
    while (p.t < t - 1e-8) {
        const end = Math.min(t, p.t + 1 / 60);
        for (const [at, event] of PREVIEW_EVENTS)
            if (at > p.t && at <= end) {
                if (event === 'tap') {
                    vanguardTap(p.state, p.vy - PHYS.flap);
                    p.vy = PHYS.flap;
                }
                if (event === 'dive') {
                    vanguardDive(p.state);
                    p.vy = PHYS.dive;
                }
                if (event === 'bounce') {
                    vanguardContact(p.state, 0, 25, 0, -1, 1);
                    p.vy = -350;
                }
                if (event === 'gate')
                    vanguardGate(p.state);
            }
        p.vy = p.vy + PHYS.gravity * (end - p.t);
        stepVanguard(p.state, end - p.t, p.vy);
        p.t = end;
    }
    return p.state;
}
/** Cosmetic shield: quiet cyan lens with three gold field arcs. No flash,
 * hitbox, duration or charge changes. Called inside the world's transform.
 */
export function paintVanguardShield(ctx, x, y, time) {
    ctx.save();
    ctx.translate(x, y);
    const lens = ctx.createRadialGradient(-7, -8, 2, 0, 0, 29);
    lens.addColorStop(0, 'rgba(130,235,255,0)');
    lens.addColorStop(.8, 'rgba(130,235,255,.025)');
    lens.addColorStop(1, 'rgba(130,235,255,.22)');
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,137,.8)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
        const a = time * .3 + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(0, 0, 29, a, a + 1.45);
        ctx.stroke();
    }
    ctx.restore();
}
export function paintVanguardWake(ctx, x, y, t) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let lane = -1; lane <= 1; lane += 2) {
        ctx.strokeStyle = lane < 0 ? '#85edff' : '#edc780';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + 18, y + lane * 3);
        ctx.bezierCurveTo(x + 1, y + lane * 5, x - 12, y + lane * 2, x - 24, y + lane * 7);
        ctx.stroke();
        ctx.fillStyle = '#fff1d0';
        const dx = 18 - ((t * 24) % 42);
        ctx.fillRect(x + dx, y + lane * 4 - 1, 3, 2);
    }
    ctx.restore();
}
