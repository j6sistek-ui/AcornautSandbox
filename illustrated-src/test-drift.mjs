#!/usr/bin/env node
/** The debris drift, asserted as a FEEL rather than as a constant.
 *
 *  The owner calibrated this by eye: the spread was right and the speed was
 *  not - a field of rocks swinging every few seconds reads as arcade jitter,
 *  not as things hanging in space. Pinning DEBRIS_DRIFT_RATE alone would
 *  guard the wrong thing, because the same feel is destroyed just as easily
 *  by widening the base rate range it multiplies. So this measures what a
 *  pilot actually sees - how long one swing takes, and how fast a rock
 *  crosses the screen at its quickest - and holds THAT.
 *
 *  It also proves the change was a rate change: amplitude must stay where it
 *  was, because the spread is the part that was already correct.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };

const { DEBRIS_DRIFT_RATE } = await import("../docs/js/sim.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };

// The rate a rock is given is (0.45 + rand*0.9) * DEBRIS_DRIFT_RATE, and its
// amplitude is rand * its own radius. Both ends of the rate range matter:
// the slow end sets the calm, the fast end sets the worst case on screen.
const BASE_LO = 0.45, BASE_HI = 0.45 + 0.9;
const lo = BASE_LO * DEBRIS_DRIFT_RATE, hi = BASE_HI * DEBRIS_DRIFT_RATE;
const slowestSwing = (2 * Math.PI) / lo;
const fastestSwing = (2 * Math.PI) / hi;

// CALIBRATED BAND - the measured feel the owner signed off on.
ok(fastestSwing >= 15, `the busiest rock swings every ${fastestSwing.toFixed(1)}s; ` +
  `under 15s it reads as jitter rather than drift`);
ok(slowestSwing <= 90, `the calmest rock swings every ${slowestSwing.toFixed(1)}s; ` +
  `over 90s the drift stops reading as motion at all`);

// Peak sideways speed = amp * rate. The widest rock allowed is one screen
// radius; at ~26px that is the worst case a pilot ever sees.
const WIDEST_AMP = 26;
const peak = WIDEST_AMP * hi;
ok(peak <= 12, `the fastest rock crosses ${peak.toFixed(1)}px/s at its quickest; ` +
  `over 12px/s the field reads as moving rather than drifting`);

// The spread was already right: this must never become an amplitude change.
const src = await (await import("node:fs/promises")).readFile(
  new URL("./game/sim.ts", import.meta.url), "utf8");
ok(/amp: Math\.random\(\) \* rr,/.test(src),
  "amplitude is no longer a plain random fraction of the rock's own radius - " +
  "the drift WIDTH was already correct and must not be scaled with the rate");
ok(!/amp:[^\n]*DEBRIS_DRIFT_RATE/.test(src),
  "DEBRIS_DRIFT_RATE has leaked into the amplitude; it scales the CLOCK only");

console.log(JSON.stringify({
  suite: "debris drift calibration",
  DEBRIS_DRIFT_RATE,
  swingSeconds: { fastest: +fastestSwing.toFixed(2), slowest: +slowestSwing.toFixed(2) },
  peakPxPerSec: +peak.toFixed(2),
  failures: fail,
}, null, 1));
process.exit(fail.length ? 1 : 0);
