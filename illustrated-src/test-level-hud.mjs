#!/usr/bin/env node
/** The pinned objectives and the acorn continue, judged at the sim.
 *
 *  The pills are a pure function of live run stats, so their exact flip
 *  points are asserted here - the 28th tap against a cap of 27 is the
 *  owner's own example, and it is the literal test below. The continue is
 *  the ad slot's stand-in: it must charge 10 (50 past gate 100), refuse a
 *  short wallet, refuse every mode that is not free flight, sweep the
 *  killzone, and leave the score standing while zeroing the run's bank so
 *  nothing is ever banked twice.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");
const camp = await import("../docs/js/campaign.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const fresh = () => (save.freshSave ? save.freshSave() : save.loadSave());

// ---------------------------------------------------------- goalHud flips
{
  const def = camp.levelById("1-2");
  const s = camp.emptyStats();
  const at = (g) => camp.goalHud(g, s, 0, def);

  const cap = { kind: "maxTaps", n: 27 };
  s.taps = 27;
  ok(at(cap).state === "done", `27/27 taps should still be green, got ${at(cap).state}`);
  s.taps = 28;
  ok(at(cap).state === "lost", `the 28th tap must turn the pill red, got ${at(cap).state}`);
  ok(at(cap).text === "TAPS 28/27", `tap pill text: ${at(cap).text}`);

  const nb = { kind: "noBounce" };
  s.bounces = 0;
  ok(at(nb).state === "done", "an unbroken no-touch constraint reads green");
  s.bounces = 1;
  ok(at(nb).state === "lost", "one planet touch must turn no-touch red");

  const ac = { kind: "acorns", n: 5 };
  s.acorns = 4;
  ok(at(ac).state === "live", "4/5 acorns is still white");
  s.acorns = 5;
  ok(at(ac).state === "done", "5/5 acorns turns green");

  const fin = { kind: "finish" };
  ok(camp.goalHud(fin, s, 3, def).text.includes(`3/${def.gates}`), "finish pill counts gates");
  ok(camp.goalHud(fin, s, def.gates, def).state === "done", "finish pill greens at the portal");

  const fl = { kind: "flawless" };
  s.bounces = 0; s.shieldsSpent = 1;
  ok(at(fl).state === "lost", "a spent shield breaks flawless");
}

// ------------------------------------------------------- the acorn continue
function crash(w, s) {
  w.squirrel.y = w.H + 60;                     // into the floor
  sim.updateWorld(w, s, 1 / 60);
}
function freshRun(score = 0) {
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  s.tutorialDone = true; s.guide = null;
  sim.resetRun(w, s, "fly", false);
  w.screen = "play"; w.ready = false;
  w.score = score;
  return { w, s };
}
{
  const { w, s } = freshRun(12);
  s.acorns = 40;
  crash(w, s);
  ok(w.screen === "dead", `the crash should land on the dead screen, got ${w.screen}`);
  ok(sim.reviveCost(w) === 10, `cost at gate 12 is 10, got ${sim.reviveCost(w)}`);
  const before = s.acorns;
  ok(sim.reviveRun(w, s) === true, "an affordable free-flight continue must succeed");
  ok(s.acorns === before - 10, `wallet must drop by 10 (${before} -> ${s.acorns})`);
  ok(w.screen === "play", "a continue returns to play");
  ok(w.score === 12, `the score carries on, got ${w.score}`);
  ok(w.runAcorns === 0, "the run-bank restarts at zero so nothing banks twice");
  const sx = w.W * 0.30;
  ok(!w.planets.some((p) => p.x - p.r <= sx + 90 && p.x + p.r >= sx - 150),
    "the killzone must be swept clear of gates");
}
{
  const { w, s } = freshRun(101);
  s.acorns = 60;
  crash(w, s);
  ok(sim.reviveCost(w) === 50, `past gate 100 the cost is 50, got ${sim.reviveCost(w)}`);
  ok(sim.reviveRun(w, s) === true && s.acorns === 10, "the 50-acorn continue charges 50");
}
{
  const { w, s } = freshRun(5);
  s.acorns = 9;
  crash(w, s);
  ok(sim.reviveRun(w, s) === false, "a short wallet is refused");
  ok(s.acorns === 9 && w.screen === "dead", "a refusal charges nothing and stays dead");
}
{
  // a mission is not free flight: protection and restart are its lifelines
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  s.tutorialDone = true; s.guide = null; s.acorns = 500;
  const def = camp.levelById("1-2");
  sim.resetRun(w, s, "fly", false, def);
  w.screen = "dead";
  ok(sim.reviveRun(w, s) === false, "a mission crash must refuse the acorn continue");
  ok(s.acorns === 500, "and charge nothing");
}
{
  const { w, s } = freshRun(3);
  s.acorns = 500;
  w.flight = "tunnel";
  w.screen = "dead";
  ok(sim.reviveRun(w, s) === false, "the wormhole corridor refuses the continue");
}

if (fail.length) {
  console.error(`FAIL (${fail.length})`);
  for (const f of fail) console.error(" - " + f);
  process.exit(1);
}
console.log("level-hud + continue: all assertions pass");
