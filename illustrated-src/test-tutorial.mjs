#!/usr/bin/env node
/** THE FIRST FLIGHT HAS TO WORK FOR EVERY KIND OF BEGINNER.
 *
 *  Reported from a phone: "half the time the player drops lower and you're on
 *  the bottom edge being told to swipe down to make the gap, then you reset
 *  as protected." Traced, and the mechanism is exact.
 *
 *  The bounce stage used to re-fire the launch - vy = -640, up to five times -
 *  and judge the result on `vy > -60`. A planet contact ZEROES vy on touch,
 *  which satisfies that test instantly, so all five springs burned in four
 *  frames having moved the pilot nothing. The swipe lesson then opened at 67%
 *  of the screen, telling a beginner to dive into a third of a screen; the
 *  dive met the floor, and the tutorial rescued them in a loop. Whether it
 *  happened depended on a planet being underneath - hence "half the time".
 *
 *  So the thing this asserts is not "the springs work". It is the property
 *  the lesson actually needs: WHATEVER the pilot has been doing, when the
 *  swipe prompt appears there is a screen underneath to dive into, and the
 *  tutorial runs to the end without a rescue.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  __ACORNAUT_BETA__: true,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");
const cat = await import("../docs/js/catalog.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };

/** A learner answers the prompt when it arms, and otherwise flies with a
 *  habit of their own. The habit is what varies, and the point is that none
 *  of them may produce a lesson with no room. */
function firstFlight(name, habit, W = 430, H = 932) {
  const w = sim.makeWorld(W, H);
  const s = save.loadSave();
  s.tutorialDone = false;
  sim.resetRun(w, s, "fly", true);
  w.ready = false;
  let swipeY = null, rescues = 0, prevShield = w.shieldCharges, done = false;
  const stages = [];
  for (let i = 0; i < 60 * 240; i++) {
    const t = w.tut;
    if (t?.hold && t.t > cat.TUT_ARM + 0.25) {
      // answer whichever prompt is on screen
      if (t.stage === "swipe") sim.dive(w);
      else sim.flap(w, s);
    } else if (habit(w, i)) sim.flap(w, s);
    sim.updateWorld(w, s, 1 / 60);
    const st = w.tut?.stage;
    if (st && stages[stages.length - 1] !== st) stages.push(st);
    if (st === "swipe" && swipeY === null) swipeY = w.squirrel.y;
    if (w.shieldCharges > prevShield) rescues += 1;
    prevShield = w.shieldCharges;
    if (s.tutorialDone) { done = true; break; }
  }
  return { name, swipeY, H, rescues, done, stages };
}

const LEARNERS = [
  ["never taps unprompted", () => false],
  ["taps constantly", (w, i) => i % 8 === 0],
  ["taps rarely", (w, i) => i % 50 === 0],
  ["panics near the floor", (w) => w.squirrel.y > w.H * 0.80],
  ["hugs the ceiling", (w) => w.squirrel.y > w.H * 0.25],
];

for (const [name, habit] of LEARNERS) {
  // a tall phone and a short one - the short one is where room runs out first
  for (const [W, H] of [[430, 932], [390, 690]]) {
    const r = firstFlight(name, habit, W, H);
    const at = r.swipeY === null ? null : r.swipeY / H;
    ok(at !== null,
      `${name} @${W}x${H}: never reached the swipe lesson (${r.stages.join(" > ")})`);
    if (at !== null) {
      // half the screen is the floor of what the lesson can be taught in;
      // the authored height is 0.34, so this has real margin either side
      ok(at <= 0.5,
        `${name} @${W}x${H}: swipe lesson opened at ${(at * 100).toFixed(0)}% of the `
        + `screen - a beginner is told to dive with ${((1 - at) * 100).toFixed(0)}% below them`);
    }
    ok(r.rescues === 0,
      `${name} @${W}x${H}: the tutorial rescued the pilot ${r.rescues}x - the lesson `
      + `is being taught somewhere it cannot be survived`);
    ok(r.done,
      `${name} @${W}x${H}: the tutorial never finished (${r.stages.join(" > ")})`);
  }
}

// The lift is a carry, not a teleport: it must not overshoot the authored
// height, or the pilot pops to the top of the screen mid-lesson.
{
  const w = sim.makeWorld(430, 932);
  const s = save.loadSave();
  s.tutorialDone = false;
  sim.resetRun(w, s, "fly", true);
  w.ready = false;
  let highest = 1;
  for (let i = 0; i < 60 * 60; i++) {
    const t = w.tut;
    if (t?.hold && t.t > cat.TUT_ARM + 0.25 && t.stage !== "swipe") sim.flap(w, s);
    sim.updateWorld(w, s, 1 / 60);
    if (w.tut?.stage === "bounce") highest = Math.min(highest, w.squirrel.y / w.H);
    if (w.tut?.stage === "swipe") break;
  }
  ok(highest >= cat.TUT_SWIPE_TOP - 0.02,
    `the lift overshot to ${(highest * 100).toFixed(0)}% - it is a carry to `
    + `${(cat.TUT_SWIPE_TOP * 100).toFixed(0)}%, not a launch`);
}

if (fail.length) {
  console.error("TUTORIAL FAILURES:");
  for (const f of fail) console.error("  - " + f);
  process.exit(1);
}
console.log(`tutorial ok: ${LEARNERS.length} learners x 2 screens all reach the swipe `
  + `lesson with room to dive, no rescues, and finish`);
