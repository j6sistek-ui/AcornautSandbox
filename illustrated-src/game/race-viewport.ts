import { RACE_HEIGHT, RACE_WIDTH } from "./race";

/** Uniform, centered projection of Hyper Run's canonical 360 x 640 field. */
export type RaceViewport = Readonly<{
  scale: number;
  left: number;
  top: number;
  contentWidth: number;
  contentHeight: number;
}>;

export function raceViewport(viewWidth: number, viewHeight: number): RaceViewport {
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

export function raceViewportX(viewport: RaceViewport, canonicalX: number) {
  return viewport.left + canonicalX * viewport.scale;
}

export function raceViewportY(viewport: RaceViewport, canonicalY: number) {
  return viewport.top + canonicalY * viewport.scale;
}
