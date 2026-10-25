// THE MOVES. Each is a pose over u (0..1), in degrees about the model's lateral
// axis (+ = nose up, limb forward, tail back), so the same move renders the same
// frames on every rigged model. Frame counts match the game's banks:
//   tap  16 frames  (<id>-tap-1..16)   a loop, u = i / 16
//   asc   8 frames  (<id>-asc-1..8)    a ramp from level to a gentle climb, u = i / 7
//   desc  8 frames  (<id>-desc-1..8)   a ramp from level to the dive, u = i / 7; the
//                                      tail travels back until it is straight out
// Frame 1 of every bank is the same level pose, so the game can cut between banks.
const TAU = Math.PI * 2;
const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const easeIO = x => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// the level pose every bank starts from
export const LEVEL = { pitch: 0, spine: 0, head: 0, ears: 0, front: 6, paw: 0, hind: -6, hindLow: 0, tailRoot: 18, unfurl: 0.8 };
// tail root angle that lays the tail straight out behind the body
export const TAIL_STRAIGHT = 86;

export const MOVES = {
  // Robo's tail: from the upright plume it sweeps down to straight out behind, back up,
  // and again - twice per loop - each joint a beat behind the one before (a whip), while
  // the body bobs once and the legs paddle with the bob.
  tap: {
    frames: 16, loop: true,
    pose(u) {
      const c = TAU * u, s2 = (1 - Math.cos(2 * c)) / 2; // 0 -> 1 -> 0 -> 1 -> 0
      // each wave is measured from its own value at u = 0, so frame 1 is exactly LEVEL
      const w = (amp, ph, mul = 1) => amp * (Math.sin(mul * c + ph) - Math.sin(ph));
      return {
        pitch: w(6, 0.6),
        lift: 0.035 * Math.sin(c),
        spine: w(5, 0),
        head: w(-4, 0.6),
        ears: w(12, -1.3, 2),
        front: LEVEL.front + w(20, 0.4),
        paw: w(-12, 1.0),
        hind: LEVEL.hind + w(-22, 0),
        hindLow: w(14, 0.8),
        tailRoot: LEVEL.tailRoot + (TAIL_STRAIGHT - 6 - LEVEL.tailRoot) * s2,
        unfurl: 0.8 + 0.18 * s2,
        tail: (f, k) => 9 * f * (Math.sin(2 * c - 0.6 - k * 0.42) - Math.sin(-0.6 - k * 0.42)),
      };
    },
  },
  // a gentle climb: nose up, paws reach up and forward, hind legs trail, tail eases back and low
  asc: {
    frames: 8, loop: false,
    pose(u) {
      const e = ease(u);
      return {
        pitch: 22 * e, lift: 0.04 * e,
        spine: 6 * e, head: -9 * e, ears: 14 * e,
        front: LEVEL.front + 34 * e, paw: 10 * e,
        hind: LEVEL.hind - 30 * e, hindLow: 10 * e,
        tailRoot: LEVEL.tailRoot + 26 * e, unfurl: 0.8 + 0.08 * e,
        tail: f => -10 * f * e,
      };
    },
  },
  // the dive: tip over, stretch into it, and the tail travels back until it lies straight out
  desc: {
    frames: 8, loop: false,
    pose(u) {
      const e = ease(u), t = easeIO(u);
      return {
        pitch: -48 * e, lift: -0.05 * e,
        spine: -6 * e, head: 18 * e, ears: 32 * e,
        front: LEVEL.front + 66 * e, paw: -10 * e,
        hind: LEVEL.hind - 40 * e, hindLow: 18 * e,
        tailRoot: LEVEL.tailRoot + (TAIL_STRAIGHT - LEVEL.tailRoot) * t, unfurl: 0.8 + 0.2 * t,
        // the outer third straightens its last hook so the tail ends in one line
        tail: (f, k) => (k > 6 ? 30 * t * (k - 6) / 5 : 0),
      };
    },
  },
};
