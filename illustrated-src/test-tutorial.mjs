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
  // TOUCHING A PLANET IS A PASS. Owner's rule, and it follows from the
  // lesson: two beats earlier the pilot was told planets are bouncy and
  // never hurt them. Bounce off the third gate and it should still count.
  const restartsBefore = w.tut.restarts;
  const streakBefore = w.tut.streak;
  for (let i = 0; i < 60 * 20 && w.tut.streak === streakBefore; i++) {
    const p = w.planets.find((q) => q.x + q.r > w.W * 0.18);
    if (p) { w.squirrel.y = p.gapY - p.gap * 0.5; w.squirrel.vy = 0; }
    sim.updateWorld(w, s, 1 / 60);
  }
  ok(w.tut.restarts === restartsBefore,
    `bouncing off a planet restarted the three - the lesson just taught that ` +
    `planets are bouncy and never hurt you`);
  ok(w.tut.streak > streakBefore,
    `a gate flown with a bounce should still count, streak stayed at ${w.tut.streak}`);
  // AND THE GATES COME BACK WHERE THEY CAN BE REACHED. buildTutorialGates
  // continues from w.lastSpawnX, which after a rewind still pointed at the
  // END of the stretch just thrown away - so the new three landed more than
  // a thousand pixels off the right of a 430px screen, and each further
  // rewind pushed them out again. Reported as "THREE IN A ROW 0/3" over
  // empty space with nothing ever arriving.
}

// ---- and a rewind lays them where they can be REACHED -------------------
// buildTutorialGates continues from w.lastSpawnX, which after a rewind still
// pointed at the END of the stretch just thrown away. Crashing on the FIRST
// gate is the worst case - nothing has scrolled yet, so the stale origin is
// at its furthest - and it put the new three more than a thousand pixels off
// the right of a 430px screen, each further rewind pushing them out again.
// Reported as "THREE IN A ROW 0/3" over empty space with nothing arriving.
{
  const r2 = flyLesson(430, 932, { stopAt: "gates3" });
  const { w, s } = r2;
  ok(w.tut.stage === "gates3", "did not reach the three-gate stretch");
  // DEBRIS is the only failure now, so that is what a rewind test has to
  // fly into: the blockers sealing the space above and below the mouth.
  const intoDebris = () => {
    const p = w.planets.find((q) => q.x + q.r > w.W * 0.18);
    if (!p || !p.blockers?.length) return;
    const b = p.blockers[Math.floor(p.blockers.length / 2)];
    w.squirrel.y = b.y;
    w.squirrel.vy = 0;
  };
  for (let i = 0; i < 60 * 20 && w.tut.restarts === 0; i++) {
    intoDebris();
    sim.updateWorld(w, s, 1 / 60);
  }
  ok(w.tut.restarts > 0, "hitting debris on the first gate should rewind the stretch");
  // AND THEY COME BACK AT THE SAME REACH EVERY TIME.
  //
  // Measured, because the first guess was wrong: the stale origin does not
  // send the gates marching away run after run, it SETTLES about 720px out
  // against 500 for the opening approach. That is ~3 seconds of empty sky
  // after being told "FROM THE TOP", which is what the reported clip shows
  // - it ended during the wait rather than the gates never arriving.
  //
  // The budget below is the opening approach plus a margin. The fixed
  // version sits at 500 and the stale one at 808, so this is tight enough
  // to mean something and loose enough not to chase frame timing.
  const gap = () => {
    const ahead = w.planets.filter((q) => q.x > w.W * 0.18).map((q) => q.x);
    return ahead.length ? Math.round(Math.min(...ahead) - w.W * 0.18) : Infinity;
  };
  const firstGap = gap();
  const gaps = [firstGap];
  for (let round = 0; round < 3; round++) {
    const was = w.tut.restarts;
    for (let i = 0; i < 60 * 30 && w.tut.restarts === was; i++) {
      intoDebris();
      sim.updateWorld(w, s, 1 / 60);
    }
    gaps.push(gap());
  }
  const BUDGET = Math.round(w.W * 1.6);
  ok(gaps.every((g) => g <= BUDGET),
    `after a rewind the next gate sits ${gaps.join(" / ")}px ahead on a ${w.W}px screen - ` +
    `the budget is ${BUDGET}px, and beyond it the pilot reads "FROM THE TOP" and then ` +
    `flies at nothing for seconds`);
  ok(gaps.every((g) => Math.abs(g - firstGap) < 220),
    `a rewind should put the gates back at the same reach as the opening approach ` +
    `(${firstGap}px), got ${gaps.join(" -> ")}`);
}

// ---- a beat that is WAITING holds the world ----------------------------
// The indicator says "tap now" and the director waits as long as it takes -
// so gravity must not be running underneath it. On the reported run the
// squirrel sank most of a screen between the prompt appearing and the tap.
{
  const w = sim.makeWorld(430, 932);
  const s = fresh();
  sim.resetRun(w, s, "fly", true);
  w.screen = "play";
  for (let i = 0; i < 60 * 20 && w.tut?.want !== "tap"; i++) {
    if (w.tut?.want === "continue") sim.flap(w, s);
    sim.updateWorld(w, s, 1 / 60);
  }
  ok(w.tut?.want === "tap", "never reached a beat asking for a tap");
  const y0 = w.squirrel.y;
  for (let i = 0; i < 60 * 3; i++) sim.updateWorld(w, s, 1 / 60);   // three seconds of waiting
  const drop = w.squirrel.y - y0;
  ok(Math.abs(drop) < 2,
    `the pilot fell ${Math.round(drop)}px in three seconds of waiting for a tap - ` +
    `a waiting beat must hold the world, not drop you while you read it`);
}

// ---- and the first MISSION cannot be failed either ---------------------
// Owner's call: level one is flown for real and earns its star, but a crash
// is a free reset - unlimited tries. A pilot who finishes the tutorial and
// immediately fails their first mission has been told the game is not for
// them, which is the one lesson it must never teach. The mercy stops there:
// level two is an ordinary level and this proves both halves.
{
  const camp = await import("../docs/js/campaign.js");
  const suicide = (lvl) => {
    const w = sim.makeWorld(430, 932);
    const s = fresh();
    sim.resetRun(w, s, lvl.base, false, lvl);
    w.screen = "play";
    w.ready = false;
    for (let i = 0; i < 60 * 120; i++) {
      // fly into the nearest planet body on every single frame
      const p = w.planets.find((q) => q.x + q.r > w.W * 0.18);
      if (p) { w.squirrel.y = Math.max(20, p.gapY - p.gap); w.squirrel.vy = 0; }
      sim.updateWorld(w, s, 1 / 60);
      if (w.screen !== "play") {
        return { ended: w.screen, finished: !!w.lastLevel?.finished, stars: w.lastLevel?.gained ?? 0 };
      }
    }
    return { ended: "never ended", finished: false, stars: 0 };
  };
  const one = suicide(camp.LEVELS[0]);
  const two = suicide(camp.LEVELS[1]);
  ok(camp.LEVELS.filter((l) => l.fx.noFail).map((l) => l.id).join(",") === "1-1",
    `exactly level 1-1 should be unfailable, got ` +
    `${camp.LEVELS.filter((l) => l.fx.noFail).map((l) => l.id).join(",") || "none"}`);
  ok(one.finished && one.stars >= 1,
    `level 1-1 was flown into a planet every frame and still must finish with its star, ` +
    `got finished=${one.finished} stars=${one.stars}`);
  ok(!two.finished,
    `level 1-2 must be an ordinary level - the mercy stops after the first mission - ` +
    `but the same suicidal run finished it`);
}

console.log(JSON.stringify({
  suite: "the first flight, beat by beat",
  beats: WANT.length,
  screens: SCREENS.length,
  failures: fail,
}, null, 1));
if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
