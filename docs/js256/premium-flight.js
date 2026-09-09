import { HIGH_ORBIT_DISPLAY_SPAN } from './high-orbit-config.js?v=256';
import { PREMIUM_FLIGHT_DURATION } from './high-orbit-motion.js?v=256';
import { paintHighOrbitEffect } from './high-orbit-effects.js?v=256';
import { PREMIUM_FLIGHT_FRAMES } from './premium-flight-frames.js?v=256';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Sixteen complete source poses, never an articulated skeleton. */
export function premiumFlightFrame(id, state) {
    const spec = PREMIUM_FLIGHT_FRAMES[id], playback = state?.frames;
    if (!playback?.active)
        return spec.fallbackFrame;
    return clamp(Math.floor(playback.age / PREMIUM_FLIGHT_DURATION * spec.frameCount), 0, spec.frameCount - 1);
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
