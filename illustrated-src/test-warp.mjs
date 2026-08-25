#!/usr/bin/env node
/** No black holes inside the black hole.
 *
 *  Catching a hole opens a stretch, and a hole met while already inside one
 *  cannot be entered - so it is scenery that looks exactly like the way out.
 *  The roll is supposed to be off for the whole stretch.
 *
 *  It was off for Free Flight only. enterWarp gives Free Flight a GATE
 *  counter (warpGateEnd) and gives every other mode a TIMER (warpLeft), and
 *  the guard tested the counter alone. On a Star Chart level built on Arcade
 *  - where the roll is 5% a gate rather than Free Flight's 1.8% - the whole
 *  stretch kept rolling.
 *
 *  MEASURING THIS IS THE HARD PART, and a first pass measured nothing: a
 *  campaign level is EIGHTEEN gates long, and once it finishes the engine
 *  clears w.lvl, which drops holeChance back to zero. Flying one level for
 *  ten minutes therefore samples eighteen gates and then five hundred gates
 *  of a mode that never spawns holes at all. So this flies the level over
 *  and over instead, and asserts the sample size it actually got.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");
const camp = await import("../docs/js/campaign.js");
const { WARP_GATES } = await import("../docs/js/catalog.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const fresh = () => (save.freshSave ? save.freshSave() : save.loadSave());

/** Fly one attempt, holding a warp open the way enterWarp would for that
 *  mode, and report the holes that appeared while it was running. */
function attempt(mode, level) {
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  sim.resetRun(w, s, mode, false, level);
  w.screen = "play";
  w.ready = false;
  // exactly what enterWarp does: Free Flight counts GATES, everything else
  // runs a TIMER. Lost is deliberately absent - it sets neither, because it
  // is permanently tilted and has no stretch to be inside of.
  if (mode === "fly") { w.warpLeft = 0; w.warpGateEnd = w.score + WARP_GATES; }
  else { w.warpLeft = 15; w.warpGateEnd = -1; }
  w.warpT = 0;
  w.warpExitSpawned = false;
  // A STAND-IN for a campaign level. holeChance keys off `w.lvl` being
  // truthy on an arcade or lost flight, and nothing else about the level
  // matters to the spawn guard - but a real level is eighteen gates and the
  // engine clears w.lvl the moment it ends or the pilot dies, which drops
  // the roll to zero and stops the sampling after a gate or two. A finish
  // line beyond reach holds the one condition under test steady so hundreds
  // of gates actually get rolled.
  if (level) {
    w.lvl = { def: { fx: {}, gates: 1e9, base: mode }, goldGates: [], spawnOrd: 0,
              strobeT: 0, portal: null,
              stats: { taps: 0, bounces: 0, shieldsSpent: 0, acorns: 0, score: 0, flow: 0 } };
  }
  const lvlRuntime = w.lvl;
  const seen = new WeakSet();
  for (const p of w.pickups || []) seen.add(p);   // the opening gates predate the warp
  let holes = 0, exits = 0, gates = 0, last = w.score;
  for (let i = 0; i < 60 * 240; i++) {
    // HOLD THE CONDITION UNDER TEST STEADY. A campaign level is eighteen
    // gates and the engine clears w.lvl the moment it ends or the pilot
    // dies - and holeChance keys off w.lvl, so a cleared level silently
    // drops the roll to zero and the run stops sampling. What is under test
    // is the SPAWN GUARD, not the level lifecycle, so the level is put back
    // and the pilot resurrected: the code path is identical, and this way
    // hundreds of gates are actually rolled instead of one or two.
    if (level && !w.lvl) w.lvl = lvlRuntime;
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
    // an autopilot: this is a SPAWN test and a dead pilot stops the world
    let tgt = w.H / 2, best = Infinity;
    for (const p of w.planets || []) {
      const d = p.x - w.W * 0.28;
      if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
    }
    w.squirrel.y = tgt; w.squirrel.vy = 0;
    w.shields = 9; w.hitCooldown = 1;
    // hold the stretch open for the whole attempt so every gate is a sample
    if (mode === "fly") w.warpGateEnd = Math.max(w.warpGateEnd, w.score + 2);
    else w.warpLeft = Math.max(w.warpLeft, 0.5);
    sim.updateWorld(w, s, 1 / 60);
    if (w.score !== last) { gates += w.score - last; last = w.score; }
    for (const p of w.pickups || []) {
      if (p.kind !== "hole" || seen.has(p)) continue;
      seen.add(p);
      if (p.exit) exits++; else holes++;
    }
  }
  return { holes, exits, gates };
}

function trials(mode, level, n) {
  const t = { holes: 0, exits: 0, gates: 0, attempts: n };
  for (let i = 0; i < n; i++) {
    const r = attempt(mode, level);
    t.holes += r.holes; t.exits += r.exits; t.gates += r.gates;
  }
  return t;
}

const arcadeLvl = (camp.LEVELS || []).find((l) => (l.flight || l.base) === "arcade");
const results = {};

// THE REPORTED CASE. 5% a gate: a couple of hundred attempts is hundreds of
// rolls, so zero is a real result rather than a small sample.
if (arcadeLvl) {
  const r = trials("arcade", arcadeLvl, 4);
  results.arcadeLevel = { level: arcadeLvl.id, ...r };
  ok(r.gates > 400,
    `only ${r.gates} gates flown across ${r.attempts} runs of ${arcadeLvl.id} - ` +
    `too few rolls for the result to mean anything`);
  ok(r.holes === 0,
    `${r.holes} black hole(s) spawned inside the stretch across ${r.gates} gates of ` +
    `${arcadeLvl.id} - a hole met while warped cannot be entered, so each is a fake exit`);
  ok(r.exits === 0,
    `${r.exits} EXIT hole(s) spawned in a TIMER warp - the way out belongs to the ` +
    `gate-counted stretch; a timer warp ends on its own clock`);
}

// Free Flight already worked. It must keep working, and it must still spawn
// holes when no warp is running, or the guard has simply turned them off.
{
  const r = trials("fly", undefined, 6);
  results.freeFlightWarping = r;
  ok(r.gates > 200, `only ${r.gates} gates flown in Free Flight`);
  ok(r.holes === 0, `${r.holes} black hole(s) spawned inside a Free Flight stretch`);
}
{
  const w = sim.makeWorld(430, 900), s = fresh();
  sim.resetRun(w, s, "fly", false);
  w.screen = "play"; w.ready = false;
  let holes = 0, gates = 0, last = 0;
  const seen = new WeakSet();
  for (let i = 0; i < 60 * 600; i++) {
    let tgt = w.H / 2, best = Infinity;
    for (const p of w.planets || []) {
      const d = p.x - w.W * 0.28;
      if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
    }
    w.squirrel.y = tgt; w.squirrel.vy = 0; w.shields = 9; w.hitCooldown = 1;
    w.warpGateEnd = -1; w.warpLeft = 0; w.warpT = 0;     // never warping
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
    sim.updateWorld(w, s, 1 / 60);
    if (w.score !== last) { gates += w.score - last; last = w.score; }
    for (const p of w.pickups || []) {
      if (p.kind === "hole" && !p.exit && !seen.has(p)) { seen.add(p); holes++; }
    }
  }
  results.freeFlightNormal = { holes, gates };
  ok(holes > 0,
    `no black holes spawned across ${gates} gates of ordinary Free Flight - ` +
    `the guard is too broad and has turned the hazard off entirely`);
}

// ---- the seal cannot develop gaps as rocks shrink ----------------------
const MIN_R = 19 * sim.DEBRIS_SIZE, STEP = 30;
ok(2 * MIN_R > STEP,
  `the smallest rock spans ${(2 * MIN_R).toFixed(1)}px against a ${STEP}px step - ` +
  `the column would show gaps a pilot can aim through`);

console.log(JSON.stringify({ suite: "warp holes + debris seal",
  DEBRIS_SIZE: sim.DEBRIS_SIZE, smallestRockSpan: +(2 * MIN_R).toFixed(1),
  results, failures: fail }, null, 1));
process.exit(fail.length ? 1 : 0);
