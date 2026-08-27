#!/usr/bin/env node
/** A wormhole is a DETOUR, not a shortcut up the gate ladder.
 *
 *  Entering one from a gate run hands the corridor `w.score` and lets it
 *  keep scoring into it: the Wormhole Run's own scoring line is
 *  `scoreFloat += move / 100 * multiplier`, and in a standalone run that
 *  IS the mode's score. As a detour, w.score is the GATE COUNT, so fifteen
 *  seconds of corridor pays out gates by the hundred. Reported from a
 *  phone: "within two runs i was almost at level 200."
 *
 *  This measures the credit a single trip pays, and asserts the rules the
 *  mode is supposed to follow: no gate credit inside, acorns still count,
 *  and the pilot comes back one gate further on than they left.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const fresh = () => (save.freshSave ? save.freshSave() : save.loadSave());

/** Fly `mode` to roughly `atGate`, dive into a wormhole, ride the whole
 *  trip, and report what the round trip did to the ledger. */
function trip(mode, atGate) {
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  sim.resetRun(w, s, mode, false);
  w.screen = "play";
  w.ready = false;

  // an autopilot that flies the gap, so the run survives long enough to
  // reach the wormhole and long enough to come back out of it
  const fly = () => {
    if (w.flight === "tunnel") {
      // A PILOT SWEEPS THE SEAM, they do not fly the centre line. The
      // corridor's acorns sit up to a third of the half-width off centre,
      // so a centre-pinned autopilot collects nothing and would report an
      // empty corridor even from a full one. This chases the nearest acorn
      // that is actually inside the walls, and falls back to the middle.
      const sx = w.W * 0.18;
      const b = sim.tunnelBoundsAt(w, sx);
      let tgt = (b.top + b.bottom) / 2, best = Infinity;
      for (const a of w.pickups) {
        if (a.got || a.exit) continue;
        const d = a.x - sx;
        if (d < -20 || d > 220 || d >= best) continue;
        if (a.y <= b.top + 14 || a.y >= b.bottom - 14) continue;
        best = d; tgt = a.y;
      }
      w.squirrel.y = tgt;
      w.squirrel.vy = 0;
    } else {
      let tgt = w.H / 2, best = Infinity;
      for (const p of w.planets || []) {
        const d = p.x - w.W * 0.18;
        if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
      }
      w.squirrel.y = tgt; w.squirrel.vy = 0;
    }
    w.shieldCharges = 9; w.hitCooldown = 1;
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
  };

  // 1. climb toward the entry gate. A wormhole met on the way IS the thing
  //    under test, so the climb stops for one rather than flying past it.
  let gateIn = 0, acornIn = 0, natural = false;
  for (let i = 0; i < 60 * 600; i++) {
    gateIn = w.score; acornIn = w.runAcorns;
    fly(); sim.updateWorld(w, s, 1 / 60);
    if (w.flight === "tunnel") { natural = true; break; }
    if (w.score >= atGate) { gateIn = w.score; acornIn = w.runAcorns; break; }
  }

  // 2. if none turned up, open the door by hand. A worm pickup on the pilot
  //    is exactly what catching one in the wild does - the catch path is
  //    the code under test either way.
  let dove = natural;
  if (!dove) {
    w.pickups.push({ x: w.W * 0.18, y: w.squirrel.y, got: false, bob: 0, kind: "worm", r: 60 });
    for (let i = 0; i < 60 * 6 && !dove; i++) {
      fly(); sim.updateWorld(w, s, 1 / 60);
      if (w.flight === "tunnel") dove = true;
    }
  }
  if (!dove) return { mode, dove: false };

  // 3. ride it out, and note the worst the gate counter ever read
  let peak = w.score, ticks = 0, offered = 0;
  const seen = new Set();
  while (w.flight === "tunnel" && ticks < 60 * 90) {
    fly(); sim.updateWorld(w, s, 1 / 60);
    for (const a of w.pickups) { if (!seen.has(a)) { seen.add(a); if (!a.exit) offered++; } }
    peak = Math.max(peak, w.score);
    ticks++;
  }
  return {
    mode, dove: true,
    gateIn, gateOut: w.score, peakInside: peak,
    credit: w.score - gateIn,
    acornGain: w.runAcorns - acornIn,
    offered,
    seconds: +(ticks / 60).toFixed(1),
    stillTunnel: w.flight === "tunnel",
  };
}

/** A trip long enough to say anything about.
 *
 *  The autopilot sometimes dies inside the corridor, and die() comes home
 *  before it ends the run - so the ride loop sees the flight leave "tunnel"
 *  and stops with a three-second sample. The corridor was healthy in those
 *  runs (acorns still arriving at the usual rate); there was just not enough
 *  of it to judge. Asserting on the stub failed about one run in ten and
 *  taught nothing, which is the worst thing a gate can do.
 *
 *  So a short trip is RESAMPLED rather than judged, and running out of
 *  attempts is itself the failure - if the corridor really did start ending
 *  early, every attempt would be short and this would say so.
 */
const trips = (mode, atGate) => {
  let last = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    last = trip(mode, atGate);
    if (!last.dove || (last.seconds ?? 0) >= 8) return last;
  }
  return { ...last, everyAttemptShort: true };
};

const runs = [trips("lost", 40), trips("fly", 40), trips("deep", 40)];
for (const r of runs) {
  ok(r.dove, `${r.mode}: catching a wormhole should start a trip`);
  if (!r.dove) continue;
  ok(!r.stillTunnel, `${r.mode}: the trip should end on its own`);
  ok(!r.everyAttemptShort,
    `${r.mode}: four trips in a row ended inside 8s (last was ${r.seconds}s) - ` +
    `the corridor is cutting itself short, not just an unlucky sample`);
  ok(r.credit === 1,
    `${r.mode}: a trip should return the pilot exactly one gate on, paid ${r.credit} ` +
    `(in at ${r.gateIn}, out at ${r.gateOut})`);
  ok(r.peakInside <= r.gateIn + 1,
    `${r.mode}: the gate counter must not climb inside the corridor, peaked at ` +
    `${r.peakInside} from ${r.gateIn}`);
  // MEASURED AS A RATE, not a total. The total is length-sensitive: a trip
  // that ends early through an exit caught on the first pass offers fewer
  // simply because it is shorter, and that made this line fail about one
  // run in twenty on a corridor that was perfectly healthy. The rate does
  // not care how long the trip was.
  //
  // It still separates cleanly. The bug this was written for offered 3
  // across 13.8s - 0.22 a second. A healthy corridor runs about 2.2. The
  // floor sits an order of magnitude below healthy and an order above the
  // bug, so it cannot be tripped by a short sample or slept through.
  const rate = r.offered / Math.max(0.1, r.seconds);
  ok(rate >= 1,
    `${r.mode}: a corridor that pays only acorns offered ${r.offered} across ` +
    `${r.seconds}s - ${rate.toFixed(2)} a second, against about 2.2 when it is working`);
  ok(r.acornGain / Math.max(0.1, r.seconds) >= 0.5,
    `${r.mode}: the trip should pay a real acorn bonus, paid ${r.acornGain} across ` +
    `${r.seconds}s`);
}

// ---- and it arrives on the CLOCK, not on the dice ----------------------
// Lost in Space used to roll 5% a gate for a wormhole, so a run could meet
// three inside twenty gates or none inside eighty - and since a trip was
// worth forty-odd gates of credit, the dice were deciding the run. The
// schedule is one every WORM_EVERY_GATES, and this flies far enough to see
// several of them land where they should.
const cadence = (() => {
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  sim.resetRun(w, s, "lost", false);
  w.screen = "play"; w.ready = false;
  const entries = [];
  let wasTunnel = false;
  for (let i = 0; i < 60 * 900 && entries.length < 4; i++) {
    if (w.flight === "tunnel") {
      const b = sim.tunnelBoundsAt(w, w.W * 0.18);
      w.squirrel.y = (b.top + b.bottom) / 2; w.squirrel.vy = 0;
      if (!wasTunnel) { entries.push(w.score); wasTunnel = true; }
    } else {
      wasTunnel = false;
      let tgt = w.H / 2, best = Infinity;
      for (const p of w.planets || []) {
        const d = p.x - w.W * 0.18;
        if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
      }
      w.squirrel.y = tgt; w.squirrel.vy = 0;
    }
    w.shieldCharges = 9; w.hitCooldown = 1;
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
    sim.updateWorld(w, s, 1 / 60);
  }
  return entries;
})();

const EVERY = 20;
ok(cadence.length >= 3, `a long Lost run should meet several wormholes, met ${cadence.length}`);
for (let i = 0; i < cadence.length; i++) {
  const want = EVERY * (i + 1) + i;   // in at 20, back at 21, next at 40, back at 41...
  ok(Math.abs(cadence[i] - want) <= 2,
    `wormhole ${i + 1} should open around gate ${want}, opened at ${cadence[i]}`);
}

// ---- both mouths are slow ----------------------------------------------
// "it also instantly teleports you back full swing, with no time to know the
// position". Both ends open at a crawl and ease back to pace, so the pilot
// gets a beat to read the corridor going in and the gate run coming out.
const calm = (() => {
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  sim.resetRun(w, s, "lost", false);
  w.screen = "play"; w.ready = false;
  const fly = () => {
    if (w.flight === "tunnel") {
      const b = sim.tunnelBoundsAt(w, w.W * 0.18);
      w.squirrel.y = (b.top + b.bottom) / 2; w.squirrel.vy = 0;
    } else {
      let tgt = w.H / 2, best = Infinity;
      for (const p of w.planets || []) {
        const d = p.x - w.W * 0.18;
        if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
      }
      w.squirrel.y = tgt; w.squirrel.vy = 0;
    }
    w.shieldCharges = 9; w.hitCooldown = 1;
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
  };
  let paceBefore = 0;
  for (let i = 0; i < 60 * 600; i++) { fly(); paceBefore = w.speed; sim.updateWorld(w, s, 1 / 60); if (w.flight === "tunnel") break; }
  const atEntry = w.speed;
  // ride it out and catch the first frame back in the gate run
  while (w.flight === "tunnel") { fly(); sim.updateWorld(w, s, 1 / 60); }
  fly(); sim.updateWorld(w, s, 1 / 60);
  const atExit = w.speed;
  let recovered = -1;
  for (let i = 0; i < 60 * 6; i++) {
    fly(); sim.updateWorld(w, s, 1 / 60);
    if (w.speed >= paceBefore * 0.97) { recovered = +(i / 60).toFixed(2); break; }
  }
  return { paceBefore: Math.round(paceBefore), atEntry: Math.round(atEntry),
           atExit: Math.round(atExit), recoveredAfter: recovered };
})();

ok(calm.atExit < calm.paceBefore * 0.7,
  `the gate run should be handed back slowly: ${calm.atExit} against a pace of ${calm.paceBefore}`);
ok(calm.recoveredAfter > 0 && calm.recoveredAfter <= 2.6,
  `and back to pace within the calibration window, took ${calm.recoveredAfter}s`);

console.log(JSON.stringify({ suite: "wormhole round trip", runs, cadence, calm, failures: fail }, null, 1));
if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
