export const VANGUARD_FRAMES = 32;
export const VANGUARD_TAP_SECONDS = 1.76;
export const VANGUARD_TAP_ORDER = [0, 1, 2, 12, 3, 4, 13, 14, 5, 6, 7, 8, 9, 15, 11, 0, 0];
export const VANGUARD_DIVE_ORDER = [0, 16, 17, 18, 20, 19, 21, 22, 23];
const HOLD_BEAT = 10;
const POSE_SETTLE_SECONDS = .085;
export const VANGUARD_CONTACT_SECONDS = .95;
export function createVanguardMotion(mode = 'cinematic') {
    return { mode, beat: -1, holding: false, descent: 0, diving: false, recovering: false,
        pendingLunge: false, lungeArmed: true, tapAge: 10, thrustLeft: 0, thrustPower: 0,
        thrust: 0, frame: 0, fromFrame: 0, mix: 1, pitch: 0, time: 0, contacts: [] };
}
export function vanguardGate(s) { s.lungeArmed = true; }
export function vanguardTap(s) {
    const first = s.lungeArmed;
    s.lungeArmed = false;
    s.tapAge = 0;
    s.diving = false;
    s.thrustLeft = .58;
    s.thrustPower = first ? .45 : 1;
    // A new input NEVER rewinds an active gesture or a pose transition.
    // A gate/contact arms a lunge, but an unfinished lunge has priority.
    if (s.descent > 0) {
        s.recovering = true;
        s.pendingLunge || (s.pendingLunge = first || s.mode === 'flow');
    }
    else if (s.beat < 0 && (first || s.mode === 'flow'))
        s.beat = 0;
}
export function vanguardDive(s) {
    s.diving = true;
    s.recovering = false;
    s.pendingLunge = false;
    s.beat = -1;
    s.holding = false;
    s.lungeArmed = true;
    s.thrustLeft = 0;
}
export function vanguardContact(s, x, y, nx, ny, strength) {
    s.contacts.push({ x, y, nx, ny, age: 0, strength });
    if (s.contacts.length > 3)
        s.contacts.shift();
    s.lungeArmed = true;
    s.diving = false;
    s.recovering = s.descent > 0;
    // Keep the airborne pose. The surface plume carries the contact, so a
    // tap one tick later cannot erase it or squash eight poses into .38s.
}
const toward = (v, target, step) => v + Math.max(-step, Math.min(step, target - v));
export function stepVanguard(s, dt, vy) {
    s.time += dt;
    s.tapAge = Math.min(10, s.tapAge + dt);
    s.thrustLeft = Math.max(0, s.thrustLeft - dt);
    const thrustTarget = s.thrustLeft > 0 ? s.thrustPower * Math.min(1, s.thrustLeft / .28) : 0;
    s.thrust += (thrustTarget - s.thrust) * (1 - Math.exp(-dt / .11));
    for (const p of s.contacts)
        p.age += dt;
    s.contacts = s.contacts.filter(p => p.age < VANGUARD_CONTACT_SECONDS);
    if (s.diving) {
        // Only an accepted swipe reaches the full dive, over about .9s.
        s.descent = toward(s.descent, 8, dt * 9);
    }
    else if (s.recovering) {
        s.descent = toward(s.descent, 0, dt * 11);
        if (s.descent === 0) {
            s.recovering = false;
            if (s.pendingLunge) {
                s.beat = 0;
                s.pendingLunge = false;
            }
        }
    }
    else if (s.beat >= 0) {
        if (s.holding && (s.mode === 'flow' || (s.tapAge > .42 && vy >= -30)))
            s.holding = false;
        if (!s.holding) {
            const before = s.beat;
            s.beat += dt * 16 / VANGUARD_TAP_SECONDS;
            if (s.mode === 'cinematic' && before < HOLD_BEAT && s.beat >= HOLD_BEAT && s.tapAge < .42 && vy < 30) {
                s.beat = HOLD_BEAT;
                s.holding = true;
            }
        }
        if (s.beat >= 16) {
            s.beat = s.mode === 'flow' && s.tapAge < .42 ? 0 : -1;
        }
    }
    else {
        // Settle near horizontal first. Gravity alone stops at the shallow
        // third descent drawing; it can never select the deep swipe poses.
        const falling = s.tapAge > .35 && vy > 35;
        if (falling && s.descent === 0)
            s.lungeArmed = true;
        const target = falling ? Math.min(3, (vy - 35) / 120) : 0;
        s.descent = toward(s.descent, target, dt * 4);
    }
    const pitchTarget = s.beat >= 0 ? -.065 * Math.sin(Math.min(1, s.beat / HOLD_BEAT) * Math.PI / 2) : 0;
    s.pitch += (pitchTarget - s.pitch) * (1 - Math.exp(-dt / .24));
    s.mix = Math.min(1, s.mix + dt / POSE_SETTLE_SECONDS);
    const wanted = s.descent > 0
        ? VANGUARD_DIVE_ORDER[Math.min(8, Math.floor(s.descent))]
        : s.beat >= 0 ? VANGUARD_TAP_ORDER[Math.min(16, Math.floor(s.beat))] : 0;
    // Finish the registered head travel before accepting a different pose.
    // Input cannot restart this clock and make the body flicker.
    if (wanted !== s.frame && s.mix >= 1) {
        s.fromFrame = s.frame;
        s.frame = wanted;
        s.mix = 0;
    }
}
// Measured helmet centres from the unchanged export registration. Moving
// the whole drawing along this short path keeps the head's travel smooth
// without ghosted faces, opacity pulses, stretched bodies or split pieces.
const HEADS = [
    ...Array.from({ length: 16 }, () => [350, 200]),
    ...[-20, -5, 15, 30, 32, 40, 48, 58].map(a => [280 + 106 * Math.cos(a * Math.PI / 180), 270 + 106 * Math.sin(a * Math.PI / 180)]),
    ...Array.from({ length: 8 }, () => [330, 190]),
];
export function paintVanguard(ctx, art, x, y, size, state) {
    const bank = art?.vanguard?.length === VANGUARD_FRAMES ? art.vanguard : undefined;
    const frame = bank?.[state?.frame ?? 0] ?? art?.suits.vanguard;
    if (!frame)
        return;
    const scale = size / 400;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bank ? state?.pitch ?? 0 : 0);
    if (state && bank) {
        const from = HEADS[state.fromFrame], to = HEADS[state.frame];
        const u = state.mix * state.mix * (3 - 2 * state.mix);
        ctx.translate((from[0] - to[0]) * (1 - u) * scale, (from[1] - to[1]) * (1 - u) * scale);
        // Climb nozzles stay behind the body. While recovering from a deep
        // dive, wait for the pack to turn back into its visible flight pose.
        if (state.thrust > .01 && state.frame < 16)
            paintThrusters(ctx, scale, state.thrust);
    }
    ctx.drawImage(frame, -280 * scale, -280 * scale, 512 * scale, 512 * scale);
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
                    vanguardTap(p.state);
                    p.vy = -310;
                }
                if (event === 'dive') {
                    vanguardDive(p.state);
                    p.vy = 650;
                }
                if (event === 'bounce') {
                    vanguardContact(p.state, 0, 25, 0, -1, 1);
                    p.vy = -350;
                }
                if (event === 'gate')
                    vanguardGate(p.state);
            }
        p.vy += 620 * (end - p.t);
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
