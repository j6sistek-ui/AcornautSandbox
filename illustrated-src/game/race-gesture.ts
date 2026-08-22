// Pure, tick-based recognizer for Hyper Run's raw press/swipe gestures.
// The output is semantic race input; wall-clock time and viewport units never
// cross this boundary.

export const DOUBLE_TAP_MAX_GAP_TICKS = 15;
export const DROP_DISTANCE = 34;
export const DROP_MAX_TICKS = 19;

/** Convert a view Y into Hyper Run's canonical 640px field. The two-argument
 * form preserves the original full-height mapping for source-level replays;
 * production input supplies the centered race viewport's explicit top/height. */
export function canonicalRaceY(y: number, height: number): number;
export function canonicalRaceY(y: number, top: number, height: number): number;
export function canonicalRaceY(y: number, topOrHeight: number, contentHeight?: number) {
  const top = contentHeight === undefined ? 0 : topOrHeight;
  const height = contentHeight ?? topOrHeight;
  return (y - top) * (640 / Math.max(1, height));
}

export type RaceGestureOwner = number | "keyboard-rise";

export type RaceGestureInput = {
  held: boolean;
  boost: boolean;
  drop?: true;
};

export type RaceGestureState = {
  owner: RaceGestureOwner | null;
  downTick: number;
  downY: number | null;
  tapCandidateTick: number | null;
  held: boolean;
  boost: boolean;
  dropFired: boolean;
};

export type RaceGestureResult = {
  state: RaceGestureState;
  input: RaceGestureInput | null;
};

export function createRaceGestureState(): RaceGestureState {
  return {
    owner: null,
    downTick: 0,
    downY: null,
    tapCandidateTick: null,
    held: false,
    boost: false,
    dropFired: false,
  };
}

function atTick(tick: number) {
  return Math.max(0, Math.floor(tick));
}

/** Begin a contact. An already-owned gesture ignores every other pointer. */
export function pressRaceGesture(
  state: RaceGestureState,
  owner: RaceGestureOwner,
  tick: number,
  canonicalY: number | null,
): RaceGestureResult {
  if (state.owner !== null) return { state, input: null };

  const downTick = atTick(tick);
  const gap = state.tapCandidateTick === null
    ? Number.POSITIVE_INFINITY
    : downTick - state.tapCandidateTick;
  const boost = gap >= 0 && gap <= DOUBLE_TAP_MAX_GAP_TICKS;

  return {
    state: {
      owner,
      downTick,
      downY: canonicalY,
      tapCandidateTick: boost ? null : downTick,
      held: true,
      boost,
      dropFired: false,
    },
    input: { held: true, boost },
  };
}

/** Move an owned pointer in canonical 360 x 640 space. */
export function moveRaceGesture(
  state: RaceGestureState,
  owner: RaceGestureOwner,
  tick: number,
  canonicalY: number,
): RaceGestureResult {
  if (state.owner !== owner || state.dropFired || state.downY === null) {
    return { state, input: null };
  }

  const age = atTick(tick) - state.downTick;
  if (age < 0 || age > DROP_MAX_TICKS || canonicalY - state.downY < DROP_DISTANCE) {
    return { state, input: null };
  }

  return {
    state: {
      ...state,
      tapCandidateTick: null,
      held: false,
      boost: false,
      dropFired: true,
    },
    input: { held: false, boost: false, drop: true },
  };
}

/** Lift an owned contact. A fired drop is already released, so it adds no log entry. */
export function releaseRaceGesture(
  state: RaceGestureState,
  owner: RaceGestureOwner,
): RaceGestureResult {
  if (state.owner !== owner) return { state, input: null };
  const shouldRecord = state.held || state.boost;
  return {
    state: {
      ...state,
      owner: null,
      downTick: 0,
      downY: null,
      held: false,
      boost: false,
      dropFired: false,
    },
    input: shouldRecord ? { held: false, boost: false } : null,
  };
}

/**
 * Cancel the active owner and the remembered tap candidate. Passing an owner
 * makes pointer cancellation owner-safe; omitting it clears all input state
 * for pause, focus loss, navigation, or a new run.
 */
export function cancelRaceGesture(
  state: RaceGestureState,
  owner?: RaceGestureOwner,
): RaceGestureResult {
  if (owner !== undefined && state.owner !== owner) return { state, input: null };
  const shouldRecord = state.held || state.boost;
  return {
    state: createRaceGestureState(),
    input: shouldRecord ? { held: false, boost: false } : null,
  };
}

/** Arrow Down uses the same atomic release-plus-drop semantic as a swipe. */
export function dropRaceGesture(state: RaceGestureState): RaceGestureResult {
  if (state.dropFired) return { state, input: null };
  return {
    state: {
      ...state,
      tapCandidateTick: null,
      held: false,
      boost: false,
      dropFired: state.owner !== null,
    },
    input: { held: false, boost: false, drop: true },
  };
}
