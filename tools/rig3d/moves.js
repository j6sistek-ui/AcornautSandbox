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
// The tail keeps its sculpted shape: it swings as one piece at the root (tailAim, below),
// opening its curl only as it swings out, and only a few degrees of whip run down it.
const TAU = Math.PI * 2;

// WHERE THE TAIL POINTS: tailAim [w, to] aims the tail's axis at `to`, in plain degrees (180
// straight out behind, 90 straight up, past 180 below); w < 1 would blend from the sculpt.
const OUT = 180, UP = 100;
// THE SAME FRAMES FOR EVERY MODEL (owner: "i'd expect every frame to be identical for all"):
// every aim is absolute (w = 1), so frame 1 puts every tail at REST however it was sculpted,
// and every frame after visits the same angles. Only the curl's own shape still differs.
const REST = 130;
// the level pose every bank starts from: the tail up and back, at REST
export const LEVEL = { pitch: 0, spine: 0, head: 0, ears: 0, front: 6, paw: 0, hind: -6, hindLow: 0, tailAim: [1, REST] };
// how far past straight out the dive lays the tail, so it lines up with the body as it tips
const DIVE_TO = OUT + 18;
// THE TAP'S TAIL, keyed to Robo's painted bank (owner, 26 Oct 2026: "the tail movement on
// tap is NOT playing enough" ... "the animation doesn't feel like it plays on tap"): it SNAPS
// out on the first frames after the tap, holds past straight out, swings up over the back,
// sweeps down again and settles. THE CURL OPENS AS IT SWINGS OUT ("the tail stays curled the
// whole time that's the issue"): straightened by `unf` out there, curled at rest and up top -
// never unrolled at rest, which smeared the scroll. Keys are [u, w, to, unf], eased between,
// so they read the same at 12 frames or 16.
const TAP_KEYS = [[0, 1, REST, 0], [0.08, 1, OUT + 7, 0.69], [0.16, 1, OUT + 20, 0.85], [0.36, 1, OUT + 20, 0.85],
  [0.46, 1, 157, 0.26], [0.56, 1, UP, 0], [0.62, 1, UP, 0], [0.72, 1, 178, 0.6], [0.8, 1, OUT + 10, 0.75],
  [0.9, 1, 160, 0.29], [1, 1, REST, 0]];
const keyed = (keys, u) => {
  let i = 1; while (i < keys.length - 1 && u > keys[i][0]) i++;
  const A = keys[i - 1], B = keys[i], x = Math.min(1, Math.max(0, (u - A[0]) / (B[0] - A[0]))), e = x * x * (3 - 2 * x);
  return A.slice(1).map((a, k) => a + (B[k + 1] - a) * e);
};
const UNFURL_OUT = 0.85;
// the rig options these moves need: unrolling the curl cuts where the sculpt fused it
export const RIG_OPTS = { unroll: true };

export const MOVES = {
  // Robo's tail (TAP_KEYS): snaps out and holds, straightening as it goes; up past rest,
  // curled again; down again; home. A light whip runs down it, the body bobs once and the
  // legs paddle.
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
        ...(([w, to, unf]) => ({ tailAim: [w, to], unfurl: unf }))(keyed(TAP_KEYS, u)),
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
        tailAim: [1, REST + 25 * e],
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
        tailAim: [1, REST + (DIVE_TO - REST) * t], unfurl: UNFURL_OUT * t,
      };
    },
  },
};
