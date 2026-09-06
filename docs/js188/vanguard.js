export const VANGUARD_FRAMES = 16;
export const VANGUARD_CYCLE_SECONDS = { cinematic: 1.8, flow: 1.15 };
export const VANGUARD_CONTACT_SECONDS = .95;
// Neutral art points upward by 34 degrees. This fixed offset seats the
// entire drawing horizontally; heading below follows flight, not taps.
export const VANGUARD_ART_PITCH = 34 * Math.PI / 180;
export function createVanguardMotion(mode = 'cinematic') {
    return { mode, phase: 0, frame: 0, heading: 0, pitch: VANGUARD_ART_PITCH,
        time: 0, diving: false, freshThrust: true, thrustLeft: 0, thrustPower: 0,
        thrust: 0, contacts: [] };
}
export function vanguardGate(s) { s.freshThrust = true; }
export function vanguardTap(s) {
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
    // Surface dust outlives an immediate tap; the body follows the rebound vy.
}
export function stepVanguard(s, dt, vy) {
    s.time += dt;
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
    const bank = art?.vanguard?.length === VANGUARD_FRAMES ? art.vanguard : undefined;
    const frame = bank?.[state?.frame ?? 0] ?? art?.suits.vanguard;
    if (!frame)
        return;
    const scale = size / 400;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state?.pitch ?? VANGUARD_ART_PITCH);
    if (state && state.thrust > .01 && !state.diving)
        paintThrusters(ctx, scale, state.thrust);
    // One registered, fully opaque whole-character drawing. The face and legs
    // hold their scale; the drawn tail changes shape instead of being stretched.
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
