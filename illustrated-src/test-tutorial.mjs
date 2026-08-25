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
  let overlap = null, dropToGap = null;
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
    if (st === "swipe" && swipeY === null) {
      swipeY = w.squirrel.y;
      const sx = W * cat.PHYS.squirrelX;
      const R = cat.PHYS.squirrelR;
      for (const p of w.planets) {
        for (const cy of [p.gapY - p.gap / 2 - p.r, p.gapY + p.gap / 2 + p.r]) {
          const d = Math.hypot(p.x - sx, cy - swipeY) - (p.r + R);
          if (d < 0 && overlap === null) {
            overlap = `a planet ${Math.round(-d)}px into the pilot`;
          }
        }
      }
      const ahead = w.planets.filter((p) => p.x > sx - 20).sort((a, b) => a.x - b.x)[0];
      dropToGap = ahead ? Math.round(ahead.gapY - swipeY) : null;
    }
    if (w.shieldCharges > prevShield) rescues += 1;
    prevShield = w.shieldCharges;
    if (s.tutorialDone) { done = true; break; }
  }
  return { name, swipeY, H, rescues, done, stages, overlap, dropToGap };
}

const LEARNERS = [
  ["never taps unprompted", () => false],
  ["taps constantly", (w, i) => i % 8 === 0],
  ["taps rarely", (w, i) => i % 50 === 0],
  ["panics near the floor", (w) => w.squirrel.y > w.H * 0.80],
  ["hugs the ceiling", (w) => w.squirrel.y > w.H * 0.25],
  // enters the bounce stage climbing hard - the case that opened the lesson
  // at the ceiling and made the whole thing worse than before it was fixed
  ["taps hard through the bounce", (w) => w.tut?.stage === "glide" || w.tut?.stage === "bounce"],
];

for (const [name, habit] of LEARNERS) {
  // a tall phone and a short one - the short one is where room runs out first
  for (const [W, H] of [[430, 932], [390, 690]]) {
    const r = firstFlight(name, habit, W, H);
    ok(r.swipeY !== null,
      `${name} @${W}x${H}: never reached the swipe lesson (${r.stages.join(" > ")})`);
    if (r.swipeY !== null) {
      // THE LESSON HAS TO BE FLYABLE, and that is three things, none of
      // which is "the pilot is at some fraction of the screen".
      //
      // 1. NOT INSIDE ANYTHING. The first fix parked the pilot at a fixed
      //    screen fraction with y set directly - no collision - so on a real
      //    phone they ended up standing ON the bounce planet, and "swipe
      //    down and make the gap" dived straight through it. Measured: 3px
      //    of overlap on two of six learners.
      ok(r.overlap === null,
        `${name} @${W}x${H}: the swipe lesson opens with the pilot inside `
        + `geometry - ${r.overlap}. A dive from there phases through it.`);
      // 2. THE GAP IS ACTUALLY BELOW. The instruction says dive to it.
      ok(r.dropToGap !== null && r.dropToGap > 40,
        `${name} @${W}x${H}: the gap the pilot is told to dive into is `
        + `${r.dropToGap}px below them - it is not below them at all`);
      // 3. NO RESCUE. Being rescued mid-lesson is the loop that was reported.
      ok(r.rescues === 0,
        `${name} @${W}x${H}: the tutorial rescued the pilot ${r.rescues}x during `
        + `the lesson - it is being taught somewhere it cannot be survived`);
    }
    ok(r.done,
      `${name} @${W}x${H}: the tutorial never finished (${r.stages.join(" > ")})`);
  }
}

// EVERY BEGINNER SEES THE SAME LESSON. The carry works from both directions
// or it does not work at all: a pilot thrown to the ceiling by the bounce
// and one dropped to the floor by neglect must arrive at the same place.
for (const [W, H] of [[430, 932], [390, 690]]) {
  const heights = LEARNERS
    .map(([name, habit]) => firstFlight(name, habit, W, H).swipeY)
    .filter((y) => y !== null);
  const spread = Math.max(...heights) - Math.min(...heights);
  ok(spread <= 24,
    `@${W}x${H}: the lesson opens across a ${Math.round(spread)}px spread `
    + `(${heights.map((y) => Math.round(y)).join(", ")}) - the carry is not `
    + `reaching the same height from both directions`);
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

// THE LAUNCH IS A FLIGHT, NOT A SLIDE.
//
// Reported as "the random auto shoot up to the swipe down point like
// teleports you somewhere and it's awkward". It did: the pilot's POSITION
// was being scripted at a fixed rate, which overrides gravity, ignores what
// it passes through, and reads exactly like being dragged.
//
// Nothing is scripted now except the launch velocity, chosen so its
// ballistic arc peaks at the lesson height. So the test is not "did it
// arrive" - it is "did it FLY there": vy has to sweep, and the measured
// acceleration has to be the game's own gravity.
{
  const w = sim.makeWorld(430, 932);
  const s = save.loadSave();
  s.tutorialDone = false;
  sim.resetRun(w, s, "fly", true);
  w.ready = false;
  const trace = [];
  let stage = "";
  for (let i = 0; i < 60 * 90; i++) {
    const t = w.tut;
    if (t?.hold && t.t > cat.TUT_ARM + 0.25 && t.stage !== "swipe") sim.flap(w, s);
    sim.updateWorld(w, s, 1 / 60);
    if (!w.tut) break;
    if (w.tut.stage !== stage) { stage = w.tut.stage; if (stage === "bounce") trace.length = 0; }
    if (stage === "bounce") trace.push({ y: w.squirrel.y, vy: w.squirrel.vy });
    if (stage === "swipe") break;
  }
  ok(trace.length > 8, `the launch lasted ${trace.length} frames - too short to be a flight`);
  if (trace.length > 8) {
    const vys = trace.map((t) => t.vy);
    const sweep = Math.max(...vys) - Math.min(...vys);
    ok(sweep > 300,
      `vy only moved ${sweep.toFixed(0)} across the launch - a carry pins it near 0, `
      + `a flight sweeps it`);
    const dys = trace.slice(1).map((t, i) => t.y - trace[i].y);
    const accel = dys.slice(1).map((d, i) => (d - dys[i]) * 3600);
    const mean = accel.reduce((a, b) => a + b, 0) / accel.length;
    ok(Math.abs(mean - cat.PHYS.gravity) / cat.PHYS.gravity < 0.15,
      `the launch accelerates at ${mean.toFixed(0)} px/s^2 against gravity `
      + `${cat.PHYS.gravity} - it is being moved at a scripted rate, not flown`);
  }
}

if (fail.length) {
  console.error("TUTORIAL FAILURES:");
  for (const f of fail) console.error("  - " + f);
  process.exit(1);
}
console.log(`tutorial ok: ${LEARNERS.length} learners x 2 screens all reach the swipe `
  + `lesson with room to dive, no rescues, and finish`);
