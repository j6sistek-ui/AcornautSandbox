// Loadout-neutral flight values shared by ordinary flight, Wormhole Run,
// and any race regime that promises the same control feel.
export const FLIGHT_GRAVITY = 1300;
export const QUICK_DROP_VY = 380;
/** THE SUITS WHOSE REPEAT TAP QUEUES. A repeat tap on one of these finishes
 *  the gesture that is playing and then replays it once; on every other suit
 *  a repeat tap REWINDS the picture from wherever it is (sim.ts, flap).
 *
 *  This used to be all 24 painted banks. Owner, 12 Sep 2026, after the
 *  queue landed on suits he had frozen: "a new tap isn't driving anymore ...
 *  take the 8 frozen out. revert it on those. the rest, give me a toggle in
 *  pause menu in beta only, so i can decide which ones get the treatment."
 *  So the frozen roster (FROZEN_SUITS in draw.ts - twelve of the painted
 *  banks, not eight) is gone from here for good, and test-frozen-roster
 *  keeps the two lists disjoint. The twelve below queue by default and can
 *  be flipped to rewind from the beta pause sheet (save.tapRewind); the
 *  owner reports which ones keep the queue, and they leave this list too.
 *
 *  Kept in this data-only module so simulation does not load art. The real
 *  painter test checks this roster against the shipping bank manifests
 *  minus the frozen roster. */
export const PAINTED_TAP_SUITS = new Set([
    "iontrim", "copper", "voidsuit", "ember", "gemmie", "sammie", "frost",
    "ghost", "leviathan", "raccoon", "ferret", "hedgehog",
]);
/** Spend less of the tap in its neutral lead-in, preserving the full gesture. */
export const PAINTED_TAP_EASE = .73;
/** CLASSIC ASCENT: velocity picks the ascent frame, the way every ascent
 *  bank flew before 12 Sep 2026. A suit here skips the tap-clock ramp
 *  above (PAINTED_TAP_EASE, the 62.5% out-and-back), the "rising velocity
 *  cannot restart a climb" clamp and the added pose smoothing, and reads
 *  its ascent frame straight from how fast it is rising.
 *
 *  A trial, on one suit, at the owner's word (12 Sep 2026, after a trace
 *  showed the ramp was the last difference between Eclipse today and
 *  Eclipse the day he froze it): "only change eclipse. to try it."
 *  Nothing else is on this list until he says so - not cryostar and
 *  verdant either, so the matched trio is knowingly apart for the trial. */
export const CLASSIC_ASCENT_SUITS = new Set(["eclipse"]);
/** THE WORMHOLE'S SETTLED FEEL.
 *
 *  These were FOUND BY FLYING, not chosen. The corridor's numbers were
 *  exposed as multiplier dials in a Tuning Run - an endless corridor that
 *  could not kill you, flown by autopilot with the dials live on screen -
 *  and turned until it read right on TAP TO FLY, the control the mode
 *  ships. What came back was lift 0.70, fall 0.75, flight speed 1.15,
 *  corridor 1.15, volatility 1.80 and debris 0.60 against what used to
 *  ship. They are folded in here and the dials are gone: this IS the
 *  flight now, and there is no multiplier left to be at 1.00.
 *
 *  Written as named constants rather than pre-multiplied arithmetic so the
 *  next person can see what each one governs.
 */
export const WORMHOLE_FLAP = -315; // was PHYS.flap -450, x0.70
export const WORMHOLE_GRAVITY = 975; // was PHYS.gravity 1300, x0.75
export const WORMHOLE_MAX_VY = 620; // the dive cap, unchanged at x1.00
/** how fast the corridor arrives: base, plus a ramp over the run */
export const WORMHOLE_SPEED_BASE = 253; // was 220, x1.15
export const WORMHOLE_SPEED_RAMP = 184; // was 160, x1.15
/** how wide the tunnel runs */
export const WORMHOLE_WIDTH = 1.15;
/** how sharply the corridor wanders */
export const WORMHOLE_TURN = 1.8;
/** how thinly hazards arrive - a SPACING multiplier, so larger is fewer.
 *  The dial ran the other way (0.60 of the debris), hence the reciprocal. */
export const WORMHOLE_DEBRIS_SPACING = 1 / 0.6;
/** THE ROUND TRIP.
 *
 *  A wormhole is a DETOUR out of a gate run, and the numbers below are
 *  what make it read as one rather than as a slot machine bolted to the
 *  side of Lost in Space.
 *
 *  It arrives on a SCHEDULE, not a dice roll: one every twenty gates, so
 *  a pilot learns to expect it and can fly toward it. It pays acorns and
 *  nothing else - the gate counter is frozen for the whole trip, because
 *  a corridor that pays gates by the distance flown handed out forty-odd
 *  levels a trip and took a run to level 200 in an afternoon.
 *
 *  And both mouths are SLOW. Being dropped into a corridor at full pace
 *  with no idea where the walls are, and then flung back into a gate run
 *  the same way, is the part that felt broken: the pilot never had time
 *  to find themselves. Two seconds at either end, easing back to pace,
 *  is the calibration window.
 */
export const WORM_EVERY_GATES = 20;
/** how long either mouth stays slow, and how slow it starts */
export const WORM_CALM_SECONDS = 2;
export const WORM_CALM_SPEED = 0.42;
/** the exit opens this long before the clock runs out, so the trip ends by
 *  being FLOWN out of - the same contract the black hole's exit hole has */
export const WORM_EXIT_LEAD = 2.6;
/** and if the pilot misses it, this much longer before the corridor gives
 *  up and posts them home anyway. A missed door must never trap a run. */
export const WORM_EXIT_GRACE = 6;
export const SUIT_LEAN_DEFAULT = { up: 0.8, down: 0.3 };
export const SUIT_LEAN = {
    vanguard: { up: 0, down: 0 }, // drawn attitudes; no extra body tipping
    arcflash: { up: 0, down: 0 }, // its own joint controller owns body attitude
    // the standard, and the reference every other suit is read against
    flight: { up: 0.8, down: 0.3 },
    // --- rigged suits: these carry the velocity bank AND the heading pitch,
    //     so they are the ones most likely to read as over-tipped
    iontrim: { up: 0.8, down: 0.3 },
    copper: { up: 0.8, down: 0.3 },
    frost: { up: 0.8, down: 0.3 },
    voidsuit: { up: 0.8, down: 0.3 },
    ember: { up: 0.8, down: 0.3 },
    ghost: { up: 0.8, down: 0.3 },
    gemmie: { up: 0.8, down: 0.3 },
    sammie: { up: 0.8, down: 0.3 },
    seraph: { up: 0.8, down: 0.3 },
    leviathan: { up: 0.8, down: 0.3 },
    verdant: { up: 0.8, down: 0.3 },
    cryostar: { up: 0.8, down: 0.3 },
    cinderforge: { up: 0.8, down: 0.3 },
    groveguard: { up: 0.8, down: 0.3 },
    cosmic: { up: 0.8, down: 0.3 },
    sunforged: { up: 0.8, down: 0.3 },
    abyssal: { up: 0.8, down: 0.3 },
    porcelain: { up: 0.8, down: 0.3 },
    nacre: { up: 0.8, down: 0.3 },
    origamist: { up: 0.8, down: 0.3 },
    // --- custom ANIMATION suits. Their frames are the owner's and are not to
    //     be touched; their LEAN is a dial like everyone else's.
    eclipse: { up: 0.8, down: 0.3 },
    volt: { up: 0.8, down: 0.3 },
    bigbooty: { up: 0.8, down: 0.3 },
    robo: { up: 0.8, down: 0.3 },
    catsuit: { up: 0.8, down: 0.3 },
    // Briella's Cat flies its still until its sprite sheet lands
    briellacat: { up: 0.8, down: 0.3 },
    // the critters fly their painted tap banks with the standard lean
    raccoon: { up: 0.8, down: 0.3 },
    ferret: { up: 0.8, down: 0.3 },
    hedgehog: { up: 0.8, down: 0.3 },
    // --- declared shape exceptions
    cyber: { up: 0.8, down: 0.3 },
    // both aliens fly with NO lean: the owner zeroed climb and dive -
    // "the animation does the work", the painted attitudes are the pitch
    alien: { up: 0, down: 0 },
};
/** The dial for a suit, or the default for one that has none yet. */
export function suitLean(id) {
    return SUIT_LEAN[id] ?? SUIT_LEAN_DEFAULT;
}
