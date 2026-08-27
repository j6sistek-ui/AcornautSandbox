import { RACE_HEIGHT, RACE_PILOT_X, RACE_WIDTH } from "./race.js?v=150";
export const RACE_MAX_VIRTUAL_WIDTH = 1440;
export function raceViewport(viewWidth, viewHeight) {
    const width = Number.isFinite(viewWidth) ? Math.max(0, viewWidth) : 0;
    const height = Number.isFinite(viewHeight) ? Math.max(0, viewHeight) : 0;
    const scale = Math.min(width / RACE_WIDTH, height / RACE_HEIGHT);
    const virtualWidth = scale > 0
        ? Math.min(width / scale, RACE_MAX_VIRTUAL_WIDTH)
        : RACE_WIDTH;
    const contentWidth = virtualWidth * scale;
    const contentHeight = RACE_HEIGHT * scale;
    const left = (width - contentWidth) / 2;
    const top = (height - contentHeight) / 2;
    const pilotLocalX = Math.max(RACE_PILOT_X, Math.min(288, virtualWidth * 0.2));
    const pilotX = left + pilotLocalX * scale;
    return {
        scale,
        left,
        right: left + contentWidth,
        top,
        bottom: top + contentHeight,
        contentWidth,
        contentHeight,
        virtualWidth,
        pilotLocalX,
        pilotX,
        originLeft: pilotX - RACE_PILOT_X * scale,
    };
}
export function raceViewportX(viewport, canonicalX) {
    return viewport.originLeft + canonicalX * viewport.scale;
}
export function raceViewportY(viewport, canonicalY) {
    return viewport.top + canonicalY * viewport.scale;
}
