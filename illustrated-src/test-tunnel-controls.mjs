#!/usr/bin/env node
/** The three Wormhole controls, and the lead-in that makes them learnable.
 *
 *  Dropping out of Lost in Space into the corridor is the case that kills
 *  runs: there is no READY card on that path, so the pilot is already moving
 *  under a verb they have not been told about, at a distance scaled to their
 *  gate - which means the walls were narrow and moving from the first frame.
 *
 *  This asserts the lead-in is actually open and actually empty, and that
 *  the corridor answers to a TAP and to nothing else - the other two
 *  controls were flown against it and retired, and neither may creep back.
 */
// IS_BETA is read off `window` at module load, so the flag has to be on the
// window shim and has to be there BEFORE the first import.
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  __ACORNAUT_BETA__: true,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");
const cat = await import("../docs/js/catalog.js");
const ctl = await import("../docs/js/control-constants.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const fresh = () => (save.freshSave ? save.freshSave() : save.loadSave());

/** Fly the corridor and see what the pilot does. */
function tunnelRun(drive, frames = 90) {
  const w = sim.makeWorld(430, 900);
  const s = fresh();
  sim.resetRun(w, s, "tunnel", false);
  w.screen = "play"; w.ready = false;
  const start = w.squirrel.y;
  for (let i = 0; i < frames; i++) {
    if (w.screen !== "play") break;
    drive(w, s, i);
    sim.updateWorld(w, s, 1 / 60);
  }
  return { moved: w.squirrel.y - start };
}

// ---- ONE CONTROL: TAP TO FLY -------------------------------------------
//
// Three were built and flown back to back - tap, hold to rise, and Hyper
// Run's slide - and tap won because it MATCHES LOST IN SPACE. A wormhole is
// something you fall into out of another mode, mid-flight, with no
// briefing; arriving in a corridor that answers to a different verb than
// the run you were just flying is what kills those runs. The other two are
// gone, and this checks the corridor answers to a tap and to nothing else.
const idle = tunnelRun(() => {}, 30);
ok(idle.moved > 40, `untouched, the pilot should fall; moved ${idle.moved.toFixed(0)}px`);

const tapped = tunnelRun((w, s, i) => { if (i % 6 === 0) sim.flap(w, s); }, 30);
ok(tapped.moved < -20, `tapping should climb; moved ${tapped.moved.toFixed(0)}px`);

// the retired controls must not have left a back door open
ok(typeof sim.setTunnelHeld !== "function", "setTunnelHeld is still exported");
ok(typeof sim.setTunnelDrag !== "function", "setTunnelDrag is still exported");
ok(typeof sim.tunnelControlOf !== "function", "tunnelControlOf is still exported");
ok(cat.TUNNEL_CONTROLS === undefined, "TUNNEL_CONTROLS still exists");

// ---- the lead-in --------------------------------------------------------
function wormholeEntry(gate) {
  const w = sim.makeWorld(430, 900);
  const s = fresh(1);
  sim.resetRun(w, s, "lost", false);
  w.screen = "play"; w.ready = false;
  w.score = gate;
  // the transport itself, as catching a wormhole runs it
  // Don't fish for a random spawn: put a wormhole exactly where the pilot
  // is. What is under test is the ENTRY, not the odds of meeting one.
  for (let i = 0; i < 60 * 30 && w.flight !== "tunnel"; i++) {
    let tgt = w.H / 2, best = Infinity;
    for (const p of w.planets || []) {
      const d = p.x - w.W * 0.28;
      if (d > -60 && d < best) { best = d; tgt = sim.liveGapY(p, w); }
    }
    w.squirrel.y = tgt; w.squirrel.vy = 0; w.shields = 9; w.hitCooldown = 1;
    if (w.screen !== "play") { w.screen = "play"; w.deadTimer = 0; }
    if (i === 30) {
      w.pickups.push({ x: w.W * 0.28, y: w.squirrel.y, got: false, bob: 0,
                       kind: "worm", r: 60 });
    }
    for (const p of w.pickups) if (p.kind === "worm" && !p.got) { p.x = w.W * 0.28; p.y = w.squirrel.y; }
    sim.updateWorld(w, s, 1 / 60);
  }
  return w;
}

const w = wormholeEntry(120);
if (w.flight !== "tunnel") {
  fail.push("never entered a wormhole, so the lead-in was not tested");
} else {
  const t = w.tunnel;
  ok(t.leadNodes === cat.TUNNEL_LEAD_NODES,
    `a wormhole entry should open ${cat.TUNNEL_LEAD_NODES} lead nodes, got ${t.leadNodes}`);
  const lead = t.nodes.filter((n) => n.index < t.leadNodes);
  ok(lead.length > 0, "no lead nodes were built - the wormhole opens straight into the corridor");
  if (!lead.length) {
    // report the miss rather than throwing on it: a crashing test still
    // fails, but it stops every later assertion from ever being reached
    console.log(JSON.stringify({ suite: "wormhole control + lead-in", failures: fail }, null, 1));
    process.exit(1);
  }
  // OPEN: every lead node at full width
  const halves = lead.map((n) => (n.bottom - n.top) * 0.5);
  const widest = Math.max(...t.nodes.map((n) => (n.bottom - n.top) * 0.5));
  ok(Math.min(...halves) >= widest - 1,
    `the lead-in is not open: narrowest lead half is ${Math.min(...halves).toFixed(0)}px ` +
    `against the corridor's widest ${widest.toFixed(0)}px`);
  // STRAIGHT: every lead node centred
  const centres = lead.map((n) => (n.top + n.bottom) * 0.5);
  const drift = Math.max(...centres) - Math.min(...centres);
  ok(drift < 2, `the lead-in wanders ${drift.toFixed(1)}px; it should be dead straight`);
  // EMPTY: nothing to hit or collect in it
  const leadEndX = lead[lead.length - 1].x;
  const inLead = (t.hazards || []).filter((h) => h.x <= leadEndX).length;
  ok(inLead === 0, `${inLead} hazard(s) sit inside the lead-in`);
  ok(t.nextHazardAt > w.distance,
    `the first hazard is already armed at entry (${t.nextHazardAt} vs distance ${Math.round(w.distance)})`);
}

console.log(JSON.stringify({
  suite: "wormhole control + lead-in",
  control: "tap to fly - the only one, matching Lost in Space",
  moved: { untouched: +idle.moved.toFixed(0), tapping: +tapped.moved.toFixed(0) },
  retired: ["hold to rise", "slide and hold"],
  leadNodes: cat.TUNNEL_LEAD_NODES,
  failures: fail,
}, null, 1));
process.exit(fail.length ? 1 : 0);
