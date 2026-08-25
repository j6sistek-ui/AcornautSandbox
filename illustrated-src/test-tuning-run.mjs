#!/usr/bin/env node
/** THE TUNING RUN: a Wormhole corridor that exists to be measured, not won.
 *
 *  Three promises, and each one is worth a test because each one is a place
 *  the mode could silently degrade back into an ordinary run:
 *
 *    1. NOTHING ENDS IT. Walls and debris are counted, never fatal - and
 *       critically, an ORDINARY run must still die, or the flag has leaked
 *       out of the test mode and made the whole game immortal.
 *    2. THE AUTOPILOT ACTUALLY FLIES, under all three controls, using the
 *       pilot's own control law rather than a private shortcut.
 *    3. THE DIALS ARE LIVE. Turning one mid-run changes the flight in the
 *       run that is already in progress, which is the entire point of
 *       taking the panel out of the pause menu.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  __ACORNAUT_BETA__: true,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };

const fresh = (control) => {
  const s = save.freshSave ? save.freshSave() : save.loadSave();
  s.tunnelControl = control;
  return s;
};

/** Start a corridor. `tuning` opts into the test mode the way flyTuning
 *  does - AFTER resetRun, which is exactly where the engine sets it, so a
 *  regression that moved the flag inside resetRun would be caught here. */
function start(control, tuning, seed = 4242) {
  const w = sim.makeWorld(430, 900);
  const s = fresh(control);
  sim.resetRun(w, s, "tunnel", false, undefined, seed);
  if (tuning) { w.tuneTest = true; w.tuneAuto = true; }
  // READY holds the world still until a first input. Every comparison here
  // wants a moving corridor, so clear it the way a pilot's first tap does -
  // except in the autopilot's case, which is tested for separately below.
  w.ready = false;
  return { w, s };
}

function run({ w, s }, frames, each) {
  const dt = 1 / 60;
  let died = 0;
  for (let i = 0; i < frames; i++) {
    if (each) each(w, s, i);
    sim.updateWorld(w, s, dt);
    if (w.screen !== "play") { died = i; break; }
  }
  return died;
}

// ---------------------------------------------------------------- 1. no end
// Fly straight into the wall on purpose: no input at all under HOLD means
// the pilot falls out of the corridor within a second.
for (const control of [0, 1, 2]) {
  const tune = start(control, true);
  tune.w.tuneAuto = false;              // nobody is flying: straight into the wall
  const died = run(tune, 60 * 45);
  ok(died === 0 && tune.w.screen === "play",
    `control ${control}: a tuning run ended after ${died} frames — it must not end`);
  ok(tune.w.tuneHits > 0,
    `control ${control}: 45 unflown seconds registered ${tune.w.tuneHits} contacts — the wall is not being read`);
}

// THE CONTROL CASE: the same neglect must still kill an ORDINARY run, or
// tuneTest has leaked and nothing in the game can die any more.
for (const control of [0, 1, 2]) {
  const real = start(control, false);
  const died = run(real, 60 * 45);
  ok(died > 0 && real.w.screen !== "play",
    `control ${control}: an ORDINARY unflown run survived 45s — the no-death flag has leaked out of the tuning run`);
}

// resetRun must always hand back a mortal run, whatever came before it.
{
  const { w, s } = start(1, true);
  run({ w, s }, 120);
  sim.resetRun(w, s, "tunnel", false);
  ok(w.tuneTest === false, "resetRun left tuneTest set — an ordinary run would be immortal");
  ok(w.tuneHits === 0 && w.tuneClean === 0, "resetRun kept the previous run's readings");
}

// An autopilot run must not sit behind the READY overlay: there is no pilot
// to make the first input, and a frozen screen is the one thing this mode
// cannot be. A MANUAL tuning run keeps the overlay, like every other run.
{
  const w = sim.makeWorld(430, 900);
  const s = fresh(1);
  sim.resetRun(w, s, "tunnel", false);
  w.tuneTest = true; w.tuneAuto = true;
  for (let i = 0; i < 120; i++) sim.updateWorld(w, s, 1 / 60);
  ok(w.distance > 100, `autopilot sat frozen behind READY (distance ${w.distance.toFixed(0)})`);

  const m = sim.makeWorld(430, 900);
  const ms = fresh(1);
  sim.resetRun(m, ms, "tunnel", false);
  m.tuneTest = true; m.tuneAuto = false;
  for (let i = 0; i < 120; i++) sim.updateWorld(m, ms, 1 / 60);
  ok(m.distance === 0, `a MANUAL tuning run flew itself past READY (distance ${m.distance.toFixed(0)})`);
}

// ------------------------------------------------------- 2. it actually flies
// The autopilot's job is to hold the corridor. It is allowed to touch the
// walls on a hard setting - that is a reading, not a failure - but it must
// be dramatically better than not flying at all.
for (const control of [0, 1, 2]) {
  const auto = start(control, true);
  auto.w.tuneAuto = true;
  run(auto, 60 * 45);
  const passive = start(control, true);
  passive.w.tuneAuto = false;
  run(passive, 60 * 45);
  ok(auto.w.tuneHits * 4 < passive.w.tuneHits,
    `control ${control}: autopilot took ${auto.w.tuneHits} contacts vs ${passive.w.tuneHits} unflown — it is not flying`);
  ok(auto.w.tuneCleanBest > 8,
    `control ${control}: autopilot's best clean stretch was ${auto.w.tuneCleanBest.toFixed(1)}s — it cannot hold the corridor`);
}

// It must fly through the PILOT'S control, not around it. Under SLIDE the
// drag target is the only steering there is; under HOLD it is the held
// flag. If the autopilot bypassed them, these would never move.
{
  const slide = start(2, true);
  let sawDrag = false;
  run(slide, 300, (w) => { if (w.tunnelDragY !== null) sawDrag = true; });
  ok(sawDrag, "slide: autopilot never set a drag target — it is steering around the control");

  const hold = start(1, true);
  let held = 0, released = 0;
  run(hold, 600, (w) => { if (w.tunnelHeld) held++; else released++; });
  ok(held > 20 && released > 20,
    `hold: autopilot held ${held} / released ${released} frames — it is not working the control`);

  const tap = start(0, true);
  const taps0 = tap.w.run.taps;
  run(tap, 600);
  ok(tap.w.run.taps - taps0 > 10,
    `tap: autopilot made ${tap.w.run.taps - taps0} taps in 10s — it is not tapping`);
}

// --------------------------------------------------------- 3. the dials are live
// Turn LIFT down hard mid-run and the autopilot must lose ground it was
// holding. This is the promise that the pause menu could not keep.
{
  // Measure the physics directly and in ONE run: six frames of hold from a
  // standstill is pure acceleration, with no velocity cap and no wall in
  // the way, so the climb it produces IS the lift dial.
  const { w, s } = start(1, true);
  w.tuneAuto = false;
  const climb = () => {
    w.squirrel.y = w.H * 0.5;
    w.squirrel.vy = 0;
    const from = w.squirrel.y;
    for (let i = 0; i < 6; i++) { sim.setTunnelHeld(w, s, true); sim.updateWorld(w, s, 1 / 60); }
    return from - w.squirrel.y;
  };
  const at100 = climb();
  s.tune.lift = 0.4; w.tune.lift = 0.4;          // exactly what setTune does
  const at40 = climb();
  ok(at100 > 4 && at40 < at100 * 0.6,
    `lift turned mid-run from 1.00 to 0.40 climbed ${at100.toFixed(1)}px then ${at40.toFixed(1)}px `
    + `— the dial is not reaching the run in progress`);
}

// SPEED is the dial with the most reach: it decides how fast the corridor
// arrives, so it must move distance travelled in the same run.
{
  const base = start(1, true);
  run(base, 600);
  const fast = start(1, true);
  run(fast, 600, (w, s, i) => { if (i === 1) { s.tune.speed = 1.5; w.tune.speed = 1.5; } });
  ok(fast.w.distance > base.w.distance * 1.3,
    `speed 1.50 flew ${fast.w.distance.toFixed(0)} vs ${base.w.distance.toFixed(0)} at 1.00 — the dial is inert`);
}

if (fail.length) {
  console.error("TUNING RUN FAILURES:");
  for (const f of fail) console.error("  - " + f);
  process.exit(1);
}
console.log("tuning run ok: cannot end, autopilot flies all three controls, dials are live mid-run");
