#!/usr/bin/env node
/** The first flight, beat by beat.
 *
 *  The lesson is scripted then live, and the split is the design: while it
 *  is scripted a tap is a GESTURE RECOGNISED, never a force applied. The
 *  director waits as long as it takes, runs the beat itself on the game's
 *  own physics, and moves on. There is no arming window, so there is
 *  nothing to be early for - which is the whole class of failure this
 *  replaced.
 *
 *  What is asserted here is exactly what kept breaking by hand:
 *
 *    * beats advance IN ORDER, and only on the gesture being asked for
 *    * an eager SECOND tap does nothing - it cannot skip a beat
 *    * the WRONG gesture does not advance anything
 *    * the lock comes off once, at the handover, and never goes back on
 *    * the three gates must be flown CONSECUTIVELY: a contact rewinds the
 *      stretch rather than letting protection buy the gate
 *    * every motion is flown, not scripted - the arcs accelerate at gravity
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");
const cat = await import("../docs/js/catalog.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const fresh = () => (save.freshSave ? save.freshSave() : save.loadSave());

const SCREENS = [[430, 932], [390, 690], [414, 896]];

/** Fly the lesson by answering whatever each beat asks for. */
function flyLesson(W, H, opts = {}) {
  const w = sim.makeWorld(W, H);
  const s = fresh();
  sim.resetRun(w, s, "fly", true);
  w.screen = "play";
  const order = [];
  let last = "";
  let lockOffAt = -1;
  let frames = 0;
  const trace = [];
  for (let i = 0; i < 60 * 200; i++) {
    const t = w.tut;
    if (!t) break;
    if (t.stage !== last) { last = t.stage; order.push(t.stage); }
    if (!t.locked && lockOffAt < 0) lockOffAt = order.length - 1;
    if (t.stage === "bouncing") trace.push({ y: w.squirrel.y, vy: w.squirrel.vy });
    // answer the beat
    if (t.want === "tap" || t.want === "continue") sim.flap(w, s);
    else if (t.want === "swipe") sim.dive(w, s);
    else if (!t.locked) {
      // live flight: fly the gap, unless this run is deliberately failing
      if (!opts.crash) {
        let tgt = w.H / 2, best = Infinity;
        for (const p of w.planets) {
          const d = p.x - w.W * 0.18;
          if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
        }
        w.squirrel.y = tgt; w.squirrel.vy = 0;
      }
    }
    sim.updateWorld(w, s, 1 / 60);
    frames++;
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
    // record AFTER the step too: a gesture answered inside this iteration
    // changes the beat before updateWorld runs, and stopping on the old
    // reading would drop the beat that was just reached
    if (w.tut && w.tut.stage !== last) { last = w.tut.stage; order.push(last); }
    if (w.tut && !w.tut.locked && lockOffAt < 0) lockOffAt = order.length - 1;
    if (opts.stopAt && w.tut?.stage === opts.stopAt) break;
  }
  return { w, s, order, lockOffAt, frames, trace };
}

// ---- the beats run in order, on every screen ---------------------------
const WANT = ["intro", "learnTap", "doTap1", "levelOff", "learnTap2", "doTap2",
              "learnDive", "doDive", "diving", "boing", "bouncing", "handover", "gates3"];
for (const [W, H] of SCREENS) {
  const r = flyLesson(W, H, { stopAt: "gates3" });
  const got = r.order.slice(0, WANT.length);
  ok(JSON.stringify(got) === JSON.stringify(WANT),
    `@${W}x${H}: the beats ran ${got.join(" -> ")}, wanted ${WANT.join(" -> ")}`);
  ok(r.lockOffAt === WANT.indexOf("gates3"),
    `@${W}x${H}: control unlocked at beat ${r.lockOffAt}, it must unlock at the handover ` +
    `(beat ${WANT.indexOf("gates3")}) and nowhere else`);
  // THE BOUNCE IS FLOWN, NOT SCRIPTED. A carry pins the acceleration near
  // zero; a real arc accelerates at gravity the whole way.
  if (r.trace.length > 8) {
    const dys = r.trace.slice(1).map((t, i) => t.y - r.trace[i].y);
    const accel = dys.slice(1).map((d, i) => (d - dys[i]) * 3600);
    const mean = accel.reduce((a, b) => a + b, 0) / accel.length;
    ok(Math.abs(mean - cat.PHYS.gravity) / cat.PHYS.gravity < 0.2,
      `@${W}x${H}: the bounce accelerates at ${mean.toFixed(0)} px/s^2 against gravity ` +
      `${cat.PHYS.gravity} - it is being moved at a scripted rate, not flown`);
  } else {
    fail.push(`@${W}x${H}: the bounce lasted ${r.trace.length} frames - too short to be a flight`);
  }
}

// ---- a second tap cannot skip a beat -----------------------------------
{
  const w = sim.makeWorld(430, 932);
  const s = fresh();
  sim.resetRun(w, s, "fly", true);
  w.screen = "play";
  // run to the first beat that wants a tap
  for (let i = 0; i < 60 * 20 && w.tut?.want !== "tap"; i++) {
    if (w.tut?.want === "continue") sim.flap(w, s);
    sim.updateWorld(w, s, 1 / 60);
  }
  ok(w.tut?.want === "tap", "never reached a beat asking for a tap");
  const at = w.tut.stage;
  sim.flap(w, s);                       // the answer
  const after = w.tut.stage;
  ok(after !== at, `the tap that answers ${at} should advance it`);
  const before = w.tut.stage;
  for (let k = 0; k < 5; k++) sim.flap(w, s);   // an eager pilot
  ok(w.tut.stage === before,
    `five more taps moved the lesson from ${before} to ${w.tut.stage} - a repeat must do nothing`);
}

// ---- the wrong gesture advances nothing --------------------------------
{
  const w = sim.makeWorld(430, 932);
  const s = fresh();
  sim.resetRun(w, s, "fly", true);
  w.screen = "play";
  for (let i = 0; i < 60 * 40 && w.tut?.want !== "swipe"; i++) {
    if (w.tut?.want === "tap" || w.tut?.want === "continue") sim.flap(w, s);
    sim.updateWorld(w, s, 1 / 60);
  }
  ok(w.tut?.want === "swipe", "never reached the swipe lesson");
  const before = w.tut.stage;
  for (let k = 0; k < 6; k++) sim.flap(w, s);   // tapping at a swipe prompt
  ok(w.tut.stage === before,
    `tapping through the swipe lesson moved it to ${w.tut.stage}; only a swipe should`);
  ok(!!w.tut.nudge, "tapping at a swipe prompt should say something, not stay silent");
  sim.dive(w, s);
  ok(w.tut.stage === "diving", `the swipe should start the dive, got ${w.tut.stage}`);
}

// ---- three in a row, or back to the first of them -----------------------
{
  const r = flyLesson(430, 932, { stopAt: "gates3" });
  const { w, s } = r;
  ok(w.tut.stage === "gates3", "did not reach the three-gate stretch");
  ok(w.tut.streak === 0, `the stretch should open at 0 of 3, got ${w.tut.streak}`);
  // fly two clean, then crash the third
  let guard = 0;
  while (w.tut.streak < 2 && guard++ < 60 * 60) {
    let tgt = w.H / 2, best = Infinity;
    for (const p of w.planets) {
      const d = p.x - w.W * 0.18;
      if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
    }
    w.squirrel.y = tgt; w.squirrel.vy = 0;
    sim.updateWorld(w, s, 1 / 60);
  }
  ok(w.tut.streak === 2, `could not fly two clean gates, streak is ${w.tut.streak}`);
  const restartsBefore = w.tut.restarts;
  // now fly into a planet
  for (let i = 0; i < 60 * 20 && w.tut.restarts === restartsBefore; i++) {
    const p = w.planets.find((q) => q.x + q.r > w.W * 0.18);
    if (p) { w.squirrel.y = p.gapY - p.gap; w.squirrel.vy = 0; }
    sim.updateWorld(w, s, 1 / 60);
  }
  ok(w.tut.restarts > restartsBefore,
    "a contact inside the three should rewind the stretch, and did not");
  ok(w.tut.streak === 0,
    `after a contact the streak should be back to 0, it is ${w.tut.streak} - ` +
    `protection must not buy the gate`);
  ok(w.tut.stage === "gates3", `the rewind should stay in the three, went to ${w.tut.stage}`);
}

console.log(JSON.stringify({
  suite: "the first flight, beat by beat",
  beats: WANT.length,
  screens: SCREENS.length,
  failures: fail,
}, null, 1));
if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
