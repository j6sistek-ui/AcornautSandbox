// THE MOVES. Each is a pose over u (0..1), in degrees about the model's lateral
// axis (+ = nose up, limb forward, tail back), so the same move renders the same
// frames on every rigged model. Frame counts match the game's banks:
//   tap  16 frames  (<id>-tap-1..16)   a loop, u = i / 16
//   asc   8 frames  (<id>-asc-1..8)    a ramp from level to a gentle climb, u = i / 7
//   desc  8 frames  (<id>-desc-1..8)   a ramp from level to the dive, u = i / 7; the
//                                      tail swings back until it is straight out
// Frame 1 of every bank is the same level pose, so the game can cut between banks.
// The ramps are evenly spaced, one equal step per frame: the game already eases how it
// walks them (the tap clock, the pose curve, the dive's ease-in), so easing the frames
// as well bunched them at the ends and left one big jump in the middle.
//
// The tail keeps its sculpted shape: it swings as one piece at the root (tailOut: 0 is
// the sculpt's own angle, 1 lays the plume's axis straight out behind, measured per model
// by the rig), and only a few degrees of whip run down it. Bending a thick sculpted plume
// further than that smears its ridges and scroll.
const TAU = Math.PI * 2;

// the level pose every bank starts from
export const LEVEL = { pitch: 0, spine: 0, head: 0, ears: 0, front: 6, paw: 0, hind: -6, hindLow: 0, tailOut: 0.25 };
// how far the dive carries the tail (1 = straight out behind a level body): past 1, so the
// plume lines up with the body as it tips nose down
const DIVE_OUT = 1.25;
// THE TAP'S TAIL, keyed to Robo's painted bank (owner, 26 Oct 2026: "the tail movement on
// tap is NOT playing enough"): sweep down to straight out and HOLD there, swing back up past
// rest so it leans forward over the back, sweep down again, settle. [u, tailOut] pairs,
// eased between, so the same keys read the same at 12 frames or 16.
const TAP_KEYS = [[0, LEVEL.tailOut], [0.12, 0.85], [0.22, 1.3], [0.42, 1.3], [0.52, 0.5],
  [0.62, -0.35], [0.68, -0.35], [0.76, 0.9], [0.83, 1.15], [0.92, 0.6], [1, LEVEL.tailOut]];
const keyed = (keys, u) => {
  let i = 1; while (i < keys.length - 1 && u > keys[i][0]) i++;
  const [u0, a] = keys[i - 1], [u1, b] = keys[i], x = Math.min(1, Math.max(0, (u - u0) / (u1 - u0)));
  return a + (b - a) * x * x * (3 - 2 * x);
};

export const MOVES = {
  // Robo's tail (TAP_KEYS): down to straight out and held, up past rest, down again, home,
  // with a light whip running down it, while the body bobs once and the legs paddle.
  tap: {
    frames: 16, loop: true,
    pose(u) {
      const c = TAU * u;
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
        tailOut: keyed(TAP_KEYS, u),
        tail: (f, k) => 2 * f * (Math.sin(2 * c - 0.6 - k * 0.42) - Math.sin(-0.6 - k * 0.42)),
      };
    },
  },
  // a gentle climb: nose up, paws reach up and forward, hind legs trail, tail eases back
  asc: {
    frames: 8, loop: false,
    pose(u) {
      const e = u;
      return {
        pitch: 22 * e, lift: 0.04 * e,
        spine: 6 * e, head: -9 * e, ears: 14 * e,
        front: LEVEL.front + 34 * e, paw: 10 * e,
        hind: LEVEL.hind - 30 * e, hindLow: 10 * e,
        tailOut: LEVEL.tailOut + 0.35 * e,
      };
    },
  },
  // the dive: tip over, stretch into it, and the tail swings back until it lies straight out
  desc: {
    frames: 8, loop: false,
    pose(u) {
      const e = u, t = u;
      return {
        pitch: -48 * e, lift: -0.05 * e,
        spine: -6 * e, head: 18 * e, ears: 32 * e,
        front: LEVEL.front + 66 * e, paw: -10 * e,
        hind: LEVEL.hind - 40 * e, hindLow: 18 * e,
        tailOut: LEVEL.tailOut + (DIVE_OUT - LEVEL.tailOut) * t,
      };
    },
  },
};
