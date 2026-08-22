import { RACE_HEIGHT, RACE_WIDTH } from "./race.js?v=78";
export function raceViewport(viewWidth, viewHeight) {
    const width = Number.isFinite(viewWidth) ? Math.max(0, viewWidth) : 0;
    const height = Number.isFinite(viewHeight) ? Math.max(0, viewHeight) : 0;
    const scale = Math.min(width / RACE_WIDTH, height / RACE_HEIGHT);
    const contentWidth = RACE_WIDTH * scale;
    const contentHeight = RACE_HEIGHT * scale;
    return {
        scale,
        left: (width - contentWidth) / 2,
        top: (height - contentHeight) / 2,
        contentWidth,
        contentHeight,
    };
}
export function raceViewportX(viewport, canonicalX) {
    return viewport.left + canonicalX * viewport.scale;
}
export function raceViewportY(viewport, canonicalY) {
    return viewport.top + canonicalY * viewport.scale;
}
