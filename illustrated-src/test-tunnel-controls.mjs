#!/usr/bin/env node
/** The three Wormhole controls, and the lead-in that makes them learnable.
 *
 *  Dropping out of Lost in Space into the corridor is the case that kills
 *  runs: there is no READY card on that path, so the pilot is already moving
 *  under a verb they have not been told about, at a distance scaled to their
 *  gate - which means the walls were narrow and moving from the first frame.
 *
 *  This asserts the lead-in is actually open and actually empty, and that
 *  each control moves the pilot in its own way rather than all three
 *  quietly falling through to the same branch.
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
const fresh = (control) => {
  const s = save.freshSave ? save.freshSave() : save.loadSave();
  s.tunnelControl = control;
  return s;
};

/** Fly the corridor under one control. `drive` is handed the corridor's own
 *  bounds so a test can aim INSIDE it - steering at the screen edge just
 *  flies into a wall, and a dead pilot measures the death animation rather
 *  than the control. The run stops the moment it dies, for the same reason. */
function tunnelRun(control, drive, frames = 90) {
  const w = sim.makeWorld(430, 900);
  const s = fresh(control);
  sim.resetRun(w, s, "tunnel", false);
  w.screen = "play"; w.ready = false;
  const start = w.squirrel.y;
  let died = false;
  for (let i = 0; i < frames; i++) {
    if (w.screen !== "play") { died = true; break; }
    const b = sim.tunnelBoundsAt(w, w.W * 0.28);
    drive(w, s, b, i);
    sim.updateWorld(w, s, 1 / 60);
  }
  return { moved: w.squirrel.y - start, control: w.tunnelControl, y: w.squirrel.y, died };
}

// ---- each control has to do its own thing -------------------------------
const NUDGE = 24;                       // how far inside the wall to aim
const tap = tunnelRun(0, () => {}, 30);                       // gravity only
const holdDown = tunnelRun(1, (w, s) => sim.setTunnelHeld(w, s, false), 30);
const holdUp = tunnelRun(1, (w, s) => sim.setTunnelHeld(w, s, true), 30);
const slideUp = tunnelRun(2, (w, s, b) => sim.setTunnelDrag(w, s, b.top + NUDGE));
const slideDown = tunnelRun(2, (w, s, b) => sim.setTunnelDrag(w, s, b.bottom - NUDGE));

ok(tap.control === 0 && holdUp.control === 1 && slideUp.control === 2,
  `the run did not fly the control it was given: tap=${tap.control} ` +
  `hold=${holdUp.control} slide=${slideUp.control}`);
ok(tap.moved > 40, `TAP: untouched, the pilot should fall; moved ${tap.moved.toFixed(0)}px`);
ok(holdUp.moved < -40, `HOLD: held, the pilot should climb; moved ${holdUp.moved.toFixed(0)}px`);
ok(holdDown.moved > 40, `HOLD: released, the pilot should fall; moved ${holdDown.moved.toFixed(0)}px`);
ok(slideUp.moved < -40, `SLIDE: dragged up, the pilot should climb; moved ${slideUp.moved.toFixed(0)}px`);
ok(slideDown.moved > 40, `SLIDE: dragged down, the pilot should fall; moved ${slideDown.moved.toFixed(0)}px`);
// SLIDE is a FOLLOWER, not a thrust: it arrives at the finger and STOPS.
// Steering to the roof of a live corridor and staying alive is the proof.
ok(!slideUp.died && !slideDown.died,
  `SLIDE flew into a wall while steering inside the corridor ` +
  `(up died: ${slideUp.died}, down died: ${slideDown.died}) - it is overshooting`);
// RATE LIMITED, or a flick teleports the squirrel across the corridor
const step = (900 / ctl.WORMHOLE_DRAG_TRAVERSAL) / 60;
const flick = tunnelRun(2, (w, s, b) => sim.setTunnelDrag(w, s, b.bottom - NUDGE), 1);
ok(Math.abs(flick.moved) <= step + 0.5,
  `one frame of drag moved ${Math.abs(flick.moved).toFixed(1)}px against a ` +
  `${step.toFixed(1)}px cap - a flick would teleport the pilot`);
ok(cat.TUNNEL_CONTROLS.length === 3, "there should be three controls to choose between");

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
    console.log(JSON.stringify({ suite: "wormhole controls + lead-in", failures: fail }, null, 1));
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

console.log(JSON.stringify({ suite: "wormhole controls + lead-in",
  controls: cat.TUNNEL_CONTROLS.map((c) => c[0]),
  moved: { tap: +tap.moved.toFixed(0), holdUp: +holdUp.moved.toFixed(0),
           holdDown: +holdDown.moved.toFixed(0), slideUp: +slideUp.moved.toFixed(0),
           slideDown: +slideDown.moved.toFixed(0) },
  slideSurvived: !slideUp.died && !slideDown.died,
  dragCapPxPerFrame: +step.toFixed(1),
  leadNodes: w.tunnel?.leadNodes ?? null, failures: fail }, null, 1));
process.exit(fail.length ? 1 : 0);
