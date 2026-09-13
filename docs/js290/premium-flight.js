import { HIGH_ORBIT_DISPLAY_SPAN } from './high-orbit-config.js?v=290';
import { PREMIUM_FLIGHT_DURATION } from './high-orbit-motion.js?v=290';
import { paintHighOrbitEffect } from './high-orbit-effects.js?v=290';
import { PREMIUM_FLIGHT_FRAMES } from './premium-flight-frames.js?v=290';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** How fast the bank is read, not how long the tap lasts.
 *
 * A flat clock gives all sixteen frames the same slice, and the tap reads as
 * late (owner, 9 Sep 2026: "the tap feels delayed like the motion shows up a
 * second after the tap ... probably needs an accelerated rate compared to the
 * 8 banks"). Two things stack up to cause that. The bank is sixteen frames of
 * ascent where a motion bank is eight, so each frame already waits twice as
 * long; and these banks open quietly - Percy's first two steps carry 24% of
 * its largest step, Patriot's first carries 10% - so the slice that is held
 * longest is also the one with the least to show.
 *
 * The approved suits never had this problem because their pose clock is
 * already front-loaded, not flat: draw.ts poseTimes spends 0.035s on its
 * first step and 0.095s on its widest. Fitting u = t**P to that table gives
 * P between 0.71 and 0.76 across its range, so the trio is put on the same
 * curve rather than on a new one invented for it. Frame 1 lands at 0.022s
 * instead of 0.062s and the first large pose change at 0.150s instead of
 * 0.250s; frame 15 still lands on TAP_ANIM_DURATION, so the tap is not
 * shortened - only its early frames stop dawdling. */
export const PREMIUM_FLIGHT_CURVE = 0.73;
const FULL_TAP_ORDER = Array.from({ length: 16 }, (_, i) => i);
// Patriot opens with five near-identical crouches. Go from its neutral to
// the first visible lift, keeping every painting and explicit-frame access.
const PATRIOT_TAP_ORDER = [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
export function premiumFlightOrder(id) {
    return id === 'origamist' ? PATRIOT_TAP_ORDER : FULL_TAP_ORDER;
}
/** Sixteen complete source poses, never an articulated skeleton. */
export function premiumFlightFrame(id, state) {
    const spec = PREMIUM_FLIGHT_FRAMES[id], playback = state?.frames;
    if (!playback?.active)
        return spec.fallbackFrame;
    const at = clamp(playback.age / PREMIUM_FLIGHT_DURATION, 0, 1);
    const order = premiumFlightOrder(id);
    return order[clamp(Math.floor(Math.pow(at, PREMIUM_FLIGHT_CURVE) * order.length), 0, order.length - 1)];
}
/** Public explicit-frame API shared by the game, review page and Studio.
 * Only whole-frame translation, uniform scale and optional pitch are applied.
 * Frame emitters rotate with the painting; previously emitted wake stays put. */
export function paintPremiumFlightFrame(ctx, art, id, x, y, size, frame, state, travel, effects = true, pitch = 0) {
    const spec = PREMIUM_FLIGHT_FRAMES[id], sheet = art?.premiumFlight?.[id], fallback = art?.suits?.[id];
    if (!sheet && !fallback)
        return;
    const index = sheet ? clamp(Math.floor(Number.isFinite(frame) ? frame : spec.fallbackFrame), 0, spec.frameCount - 1) : spec.fallbackFrame;
    const registration = spec.frames[index], cell = spec.cellSize, half = cell / 2;
    const angle = Number.isFinite(pitch) ? pitch : 0, cs = Math.cos(angle), sn = Math.sin(angle);
    const emitters = registration.emitters.map(([ex, ey]) => [
        half + (ex - half) * cs - (ey - half) * sn, half + (ex - half) * sn + (ey - half) * cs,
    ]);
    ctx.save();
    ctx.translate(x, y);
    if (effects && state)
        paintHighOrbitEffect(ctx, id, state, size, emitters, travel ?? { x, y, travel: state.time * size * 2.5 });
    ctx.rotate(angle);
    ctx.scale(size / HIGH_ORBIT_DISPLAY_SPAN, size / HIGH_ORBIT_DISPLAY_SPAN);
    if (sheet)
        ctx.drawImage(sheet, index % 4 * cell, Math.floor(index / 4) * cell, cell, cell, -half, -half, cell, cell);
    else
        ctx.drawImage(fallback, -half, -half, cell, cell);
    ctx.restore();
}
export function paintPremiumFlight(ctx, art, id, x, y, size, state, travel, effects = true, pitch = 0) {
    paintPremiumFlightFrame(ctx, art, id, x, y, size, premiumFlightFrame(id, state), state, travel, effects, pitch);
}
/** The authored head from the fallback pose is seated directly in the cockpit.
 * Integrated shells and Envoy's bare face never accept a separate helmet. */
export function paintPremiumFlightCockpit(ctx, art, id, x, y, rx, ry) {
    const spec = PREMIUM_FLIGHT_FRAMES[id], sheet = art.premiumFlight?.[id], image = sheet ?? art.suits[id];
    if (!image)
        return;
    const index = spec.fallbackFrame, frame = spec.frames[index], cell = spec.cellSize, scale = rx * .96 / frame.radius;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, sheet ? index % 4 * cell : 0, sheet ? Math.floor(index / 4) * cell : 0, cell, cell, x - frame.head[0] * scale, y - frame.head[1] * scale, cell * scale, cell * scale);
    ctx.restore();
}
