// Pure, tick-based recognizer for Hyper Run's raw press, swipe, and drag gestures.
// The output is semantic race input; wall-clock time and viewport units never
// cross this boundary.
export const DOUBLE_TAP_MAX_GAP_TICKS = 15;
export const DROP_DISTANCE = 34;
export const DROP_MAX_TICKS = 19;
export function canonicalRaceY(y, topOrHeight, contentHeight) {
    const top = contentHeight === undefined ? 0 : topOrHeight;
    const height = contentHeight ?? topOrHeight;
    return (y - top) * (640 / Math.max(1, height));
}
export function createRaceGestureState() {
    return {
        owner: null,
        mode: null,
        downTick: 0,
        downY: null,
        dragStartY: null,
        tapCandidateTick: null,
        held: false,
        boost: false,
        dropFired: false,
    };
}
function atTick(tick) {
    return Math.max(0, Math.floor(tick));
}
/** Begin a contact. An already-owned gesture ignores every other pointer. */
export function pressRaceGesture(state, owner, tick, canonicalY) {
    if (state.owner !== null)
        return { state, input: null };
    const downTick = atTick(tick);
    const gap = state.tapCandidateTick === null
        ? Number.POSITIVE_INFINITY
        : downTick - state.tapCandidateTick;
    const boost = gap >= 0 && gap <= DOUBLE_TAP_MAX_GAP_TICKS;
    return {
        state: {
            owner,
            mode: "flight",
            downTick,
            downY: canonicalY,
            dragStartY: null,
            tapCandidateTick: boost ? null : downTick,
            held: true,
            boost,
            dropFired: false,
        },
        input: { held: true, boost },
    };
}
/** Move an owned pointer in canonical 360 x 640 space. */
export function moveRaceGesture(state, owner, tick, canonicalY) {
    if (state.owner !== owner || state.mode !== "flight" || state.dropFired || state.downY === null) {
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
/**
 * Start a tunnel pointer drag without snapping the pilot to the contact. The
 * first semantic target is the current authority Y; subsequent moves preserve
 * the pointer-to-pilot offset captured here.
 */
export function pressRaceDragGesture(state, owner, tick, canonicalY, pilotY) {
    if (state.owner !== null)
        return { state, input: null };
    return {
        state: {
            owner,
            mode: "pointer-drag",
            downTick: atTick(tick),
            downY: canonicalY,
            dragStartY: pilotY,
            tapCandidateTick: null,
            held: false,
            boost: false,
            dropFired: false,
        },
        input: { held: false, boost: false, dragY: pilotY },
    };
}
/**
 * Update a relative tunnel drag. A pointer held through the entry presentation
 * converts on its first tunnel move, anchoring at the current pilot position so
 * the control regime changes without a jump or a forced lift/re-press.
 */
export function moveRaceDragGesture(state, owner, tick, canonicalY, pilotY) {
    if (state.owner !== owner || state.mode === "keyboard-drag")
        return { state, input: null };
    if (state.mode !== "pointer-drag" || state.downY === null || state.dragStartY === null) {
        return {
            state: {
                ...state,
                mode: "pointer-drag",
                downTick: atTick(tick),
                downY: canonicalY,
                dragStartY: pilotY,
                tapCandidateTick: null,
                held: false,
                boost: false,
                dropFired: false,
            },
            input: { held: false, boost: false, dragY: pilotY },
        };
    }
    return {
        state,
        input: {
            held: false,
            boost: false,
            dragY: state.dragStartY + canonicalY - state.downY,
        },
    };
}
/** Keyboard accessibility uses the same tunnel target follower as pointer drag. */
export function pressRaceKeyboardDragGesture(state, owner, tick, targetY) {
    if (state.owner !== null)
        return { state, input: null };
    return {
        state: {
            owner,
            mode: "keyboard-drag",
            downTick: atTick(tick),
            downY: null,
            dragStartY: null,
            tapCandidateTick: null,
            held: false,
            boost: false,
            dropFired: false,
        },
        input: { held: false, boost: false, dragY: targetY },
    };
}
/** Lift an owned contact. A fired drop is already released, so it adds no log entry. */
export function releaseRaceGesture(state, owner) {
    if (state.owner !== owner)
        return { state, input: null };
    const drag = state.mode === "pointer-drag" || state.mode === "keyboard-drag";
    const input = drag
        ? { held: false, boost: false, dragY: null }
        : state.held || state.boost ? { held: false, boost: false } : null;
    return {
        // A flight lift retains its first-tap candidate for the existing double-
        // tap window. Drag lift has no tap semantics and clears everything.
        state: drag ? createRaceGestureState() : {
            ...state,
            owner: null,
            mode: null,
            downTick: 0,
            downY: null,
            dragStartY: null,
            held: false,
            boost: false,
            dropFired: false,
        },
        input,
    };
}
/**
 * Cancel the active owner and the remembered tap candidate. Passing an owner
 * makes pointer cancellation owner-safe; omitting it clears all input state
 * for pause, focus loss, navigation, or a new run.
 */
export function cancelRaceGesture(state, owner) {
    if (owner !== undefined && state.owner !== owner)
        return { state, input: null };
    const input = state.mode === "pointer-drag" || state.mode === "keyboard-drag"
        ? { held: false, boost: false, dragY: null }
        : state.held || state.boost ? { held: false, boost: false } : null;
    return {
        state: createRaceGestureState(),
        input,
    };
}
/**
 * A viewport change while a contact is still owned is a control boundary:
 * clear the recognizer (including its double-tap candidate) and expose one
 * neutral semantic state for the authority log. Idle resizes must not call
 * this helper; they preserve the candidate and produce no input mutation.
 */
export function neutralizeOwnedRaceGesture(state) {
    if (state.owner === null)
        return { state, input: null };
    return {
        state: createRaceGestureState(),
        input: state.mode === "pointer-drag" || state.mode === "keyboard-drag"
            ? { held: false, boost: false, dragY: null }
            : { held: false, boost: false },
    };
}
/** Arrow Down uses the same atomic release-plus-drop semantic as a swipe. */
export function dropRaceGesture(state) {
    if (state.mode === "pointer-drag" || state.mode === "keyboard-drag")
        return { state, input: null };
    if (state.dropFired)
        return { state, input: null };
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
