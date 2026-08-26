#!/usr/bin/env node
/** The recorder records the flight you actually flew.
 *
 *  It shipped gated on `w.tut`, which made it useless for the one job it
 *  was built for - reported as "you can't copy my taps because i am forced
 *  through the prompts that don't work". If the only flight it captures is
 *  the flight that is broken, there is nothing to hand over. Every run
 *  records now, and COPY FLIGHT sits in the pause menu.
 *
 *  Also pins the slow-motion first flight: the lesson runs at TUT_SLOW, and
 *  the DWELLS - how long before a tap counts, how long a message sits - must
 *  NOT stretch with it. At a tenth, an unscaled 1.25s arming delay became a
 *  12.5 second dead wait with taps silently refused.
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

/** Fly `mode`, tapping on a fixed cadence, and read the recording back. */
function record(mode, tutorial, taps = 6) {
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  sim.resetRun(w, s, mode, tutorial);
  w.screen = "play";
  w.ready = false;
  for (let i = 0; i < 60 * 12; i++) {
    if (i % 30 === 0 && i > 0) sim.flap(w, s);
    w.shields = 9; w.hitCooldown = 1;
    sim.updateWorld(w, s, 1 / 60);
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
  }
  return JSON.parse(sim.flightRecording(w));
}

// ---- a NORMAL run records ----------------------------------------------
for (const mode of ["fly", "lost", "deep"]) {
  const r = record(mode, false);
  ok(r.marks.length > 1,
    `${mode}: an ordinary run recorded ${r.marks.length} marks - the recorder is ` +
    `gated on the tutorial again, which is the bug that made it useless`);
  ok(r.marks.some((m) => m.kind === "tap"),
    `${mode}: no taps in the recording, though the run tapped`);
  ok(r.tutorial === false && r.mode === mode,
    `${mode}: the recording should say which flight it was, got mode ${r.mode} tutorial ${r.tutorial}`);
}

// ---- the tutorial still records, including REFUSED taps -----------------
{
  const r = record("fly", true);
  ok(r.tutorial === true, "the tutorial recording should say so");
  ok(r.marks.some((m) => m.kind === "start"), "a recording should open with a start mark");
  ok(r.marks.length > 1, `the tutorial recorded only ${r.marks.length} marks`);
}

// ---- the first flight is slow, and its DWELLS are not ------------------
ok(cat.TUT_SLOW > 0 && cat.TUT_SLOW <= 1,
  `TUT_SLOW is ${cat.TUT_SLOW}; it is a fraction of real time`);
{
  // how long, in REAL seconds, before the first prompt accepts a tap
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  sim.resetRun(w, s, "fly", true);
  w.screen = "play"; w.ready = false;
  // MEASURED BY TAPPING, not by recomputing the threshold. A first pass
  // asserted `tut.t >= TUT_ARM * TUT_SLOW`, which is the very expression
  // under test - so it passed happily with the scaling removed from the
  // game. What matters is when a tap is ACCEPTED, so this taps every frame
  // and waits for the first one the sim does not refuse.
  let wall = 0, armed = null;
  for (let i = 0; i < 60 * 300 && armed === null; i++) {
    sim.updateWorld(w, s, 1 / 60);
    wall += 1 / 60;
    if (w.tut?.hold && sim.flap(w, s) !== "none") armed = wall;
  }
  ok(armed !== null, "the first prompt never armed at all");
  // it must stay near TUT_ARM in REAL seconds, not TUT_ARM / TUT_SLOW
  ok(armed !== null && armed < cat.TUT_ARM * 3,
    `the first prompt took ${armed?.toFixed(1)}s of real time to accept a tap; ` +
    `TUT_ARM is ${cat.TUT_ARM}s and must not be stretched by the slow motion ` +
    `(unscaled it would be ${(cat.TUT_ARM / cat.TUT_SLOW).toFixed(1)}s of dead wait)`);
  console.log(JSON.stringify({ armedAfterRealSeconds: +(armed ?? -1).toFixed(2) }));
}

console.log(JSON.stringify({
  suite: "flight recorder and the slow first flight",
  tutSlow: cat.TUT_SLOW,
  failures: fail,
}, null, 1));
if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
