import { HIGH_ORBIT_PROFILES } from './high-orbit-config.mjs';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const keys = ['body', 'head', 'heave', 'nearArm', 'nearElbow', 'farArm', 'farElbow',
    'nearThigh', 'nearKnee', 'farThigh', 'farKnee', 'tailRoot', 'tailMid', 'tailTip'];
const rest = { body: 49, head: 0, heave: 0, nearArm: 60, nearElbow: 50, farArm: 70, farElbow: 48,
    nearThigh: 18, nearKnee: -32, farThigh: 12, farKnee: -26, tailRoot: 0, tailMid: 0, tailTip: 0 };
export function createHighOrbitMotion(id = 'cinderforge') {
    return { id, time: 0, phase: 0, velocity: 0, previousVy: 0, initialized: false, pulse: 0, recoil: 0, power: .12,
        pose: { ...rest }, rates: Object.fromEntries(keys.map(k => [k, 0])) };
}
/** An accepted tap accents even a short refresh below the velocity detector's
 * threshold. No pose/rate reset and no change to the approved wake power. */
export function highOrbitTap(s, acceptedImpulse = 450) {
    if (!Number.isFinite(acceptedImpulse) || acceptedImpulse <= 0)
        return;
    s.recoil = Math.max(s.recoil, .5 + .5 * (1 - Math.exp(-acceptedImpulse / 360)));
}
function follow(s, key, target, dt, frequency, damping) {
    const omega = frequency * 2 * Math.PI, acceleration = (target - s.pose[key]) * omega * omega - 2 * damping * omega * s.rates[key];
    s.rates[key] += acceleration * dt;
    s.pose[key] += s.rates[key] * dt;
}
export function stepHighOrbit(s, id, dt, vy, ready = false) {
    if (!Number.isFinite(dt) || !Number.isFinite(vy) || dt <= 0)
        return;
    if (s.id !== id)
        Object.assign(s, createHighOrbitMotion(id));
    dt = Math.min(dt, .1);
    const impulse = s.initialized && !ready ? Math.max(0, s.previousVy - vy) : 0;
    // Velocity changes are observed only after the authority has consumed input.
    // Small gravity fluctuations cannot create a tap accent.
    if (impulse > 70) {
        s.pulse = Math.min(1, s.pulse + .3 + impulse / 700);
        highOrbitTap(s, impulse);
    }
    const start = s.initialized && impulse <= 70 ? s.previousVy : vy;
    s.previousVy = vy;
    s.initialized = true;
    const profile = HIGH_ORBIT_PROFILES[id];
    for (let left = dt; left > 1e-8;) {
        const h = Math.min(left, 1 / 120);
        left -= h;
        const current = ready ? 0 : start + (vy - start) * (dt - left) / dt;
        s.velocity += (current - s.velocity) * (1 - Math.exp(-h / .045));
        s.time += h;
        s.phase += h * 2 * Math.PI / profile.period;
        s.pulse *= Math.exp(-h / .24);
        s.recoil *= Math.exp(-h / .24);
        const lift = ready ? 0 : smooth(-s.velocity / 370), fall = ready ? 0 : smooth(s.velocity / 610);
        const power = ready ? .12 : .14 + .65 * lift + .18 * s.pulse;
        s.power += (power - s.power) * (1 - Math.exp(-h / .07));
        const wave = Math.sin(s.phase), lag = Math.sin(s.phase - 1.1);
        const energy = ready ? .32 : 1;
        const target = {
            body: 49 - 17 * lift + 11 * fall + energy * wave * 1.6,
            head: -10 * lift + 8 * fall + energy * (Math.sin(s.phase - .4) * 1.8 - s.recoil * 3),
            heave: energy * (Math.sin(s.phase - .7) * 1.2 - .8 * lift),
            nearArm: 60 - 17 * lift + 10 * fall + energy * (wave * 7 - s.pulse * 9),
            nearElbow: 50 - 14 * lift + 9 * fall + energy * (lag * 9 + s.pulse * 12),
            farArm: 70 - 20 * lift + 7 * fall + energy * Math.sin(s.phase + .55) * 5,
            farElbow: 48 - 9 * lift + 10 * fall + energy * Math.sin(s.phase - .5) * 7,
            nearThigh: 18 + 9 * lift - 5 * fall + energy * Math.sin(s.phase - 1.1) * 4,
            nearKnee: -32 - 12 * lift + 8 * fall + energy * Math.sin(s.phase - 1.8) * 5,
            farThigh: 12 + 8 * lift - 4 * fall + energy * Math.sin(s.phase + .6) * 3,
            farKnee: -26 - 10 * lift + 6 * fall + energy * Math.sin(s.phase - .4) * 4,
            // Tap recoil reinforces the aft sweep; the old positive accent
            // cancelled lift. The mid/tip springs then rock back with their own lag.
            tailRoot: profile.whip * (energy * wave * 10 - 20 * lift + 10 * fall - s.recoil * 24),
            tailMid: 0, tailTip: 0,
        };
        for (const key of keys.slice(0, 11))
            follow(s, key, target[key], h, (key === 'head' ? 4.2 : key === 'body' ? 3.5 : 3.1) / profile.inertia, .86);
        follow(s, 'tailRoot', target.tailRoot, h, 3.4 / profile.inertia, .72);
        // Cascaded sections retain momentum after the torso reverses.
        follow(s, 'tailMid', s.pose.tailRoot + energy * Math.sin(s.phase - .85) * 8 * profile.whip, h, 2.2 / profile.inertia, .76);
        follow(s, 'tailTip', s.pose.tailMid + energy * Math.sin(s.phase - 1.45) * 8 * profile.whip, h, 1.85 / profile.inertia, .8);
    }
}
const previews = new WeakMap();
/** The same controller and a short physical gravity arc drive each shelf card. */
export function highOrbitPreview(owner, id, time) {
    let map = previews.get(owner);
    if (!map) {
        map = new Map();
        previews.set(owner, map);
    }
    let p = map.get(id);
    if (!p || time < p.time) {
        p = { state: createHighOrbitMotion(id), time: time - .016 };
        map.set(id, p);
    }
    const elapsed = clamp(time - p.time, 0, .1);
    for (let left = elapsed; left > 1e-8;) {
        const dt = Math.min(left, 1 / 60);
        left -= dt;
        p.time += dt;
        const local = ((p.time % 4.8) + 4.8) % 4.8;
        const tapAge = local < 1.44 ? local % .36 : local - 1.08;
        const vy = local > 3.85 ? 610 : Math.min(590, -400 + 1100 * tapAge);
        stepHighOrbit(p.state, id, dt, vy);
    }
    p.time = time;
    return p.state;
}
