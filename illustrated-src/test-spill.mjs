#!/usr/bin/env node
/** THE SPILL, judged at the authority.
 *
 *  spill.ts owns the rules and knows nothing about a canvas, so every rule
 *  worth arguing about is asserted here against the built module: the wave
 *  ladder climbs and teaches in order, debris never overlaps debris, the
 *  hull takes three hits and never two from one piece, the floor kills
 *  after a quarter second and not before, the Depot rolls three shelves
 *  with a patch in front and honours the tree, a mission ends on the wave
 *  it names, and the sim seam banks the best wave without ever touching the
 *  acorn wallet. Last, a dodging bot flies wave 1 - a smoke test for "is
 *  this survivable at all", not a tuning instrument.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  // the beta chart is where the Spill missions live
  __ACORNAUT_BETA__: true };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const S = await import("../docs/js/spill.js");
const sim = await import("../docs/js/sim.js");
const save = await import("../docs/js/save.js");
const camp = await import("../docs/js/campaign.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const DT = 1 / 60;
const W = 390, H = 760;

/** step until the predicate holds or the clock runs out */
function until(s, pred, seconds, each) {
  let t = 0;
  while (t < seconds) {
    if (each) each(s);
    // the last frame's cues, kept on the state for the assertion after
    s.lastCues = S.stepSpill(s, DT);
    t += DT;
    if (pred(s)) return true;
  }
  return false;
}
const immune = (s) => { s.iframes = 9; s.floorT = 0; };
/** hold the pilot mid-air with no rocks about, so a wait is only a wait */
const hover = (s) => { s.rocks = []; s.pilot.y = s.H * 0.45; s.pilot.vy = 0; };
const launch = (seed, target = 0) => {
  const s = S.createSpill(W, H, seed, target);
  S.spillFlap(s);                                   // the ready card
  ok(s.phase === "card", `the first tap opens the wave card, got ${s.phase}`);
  ok(S.stepSpill(s, DT).includes("wave"), "the launch's wave cue reaches the first frame");
  until(s, (x) => x.phase === "wave", 5);
  return s;
};
const rockAt = (s, x, y, r = 20) => {
  s.rocks.push({ x, y, vx: -10, vy: 0, r, kind: "tumbler", sprite: 0, spin: 0, rot: 0,
    arc: 0, arcPhase: 0, warn: 0, grazed: true, dead: false });
};

// ------------------------------------------------------------ the ladder
{
  let prev = null;
  const firstSeen = {};
  for (let n = 1; n <= 40; n++) {
    const w = S.spillWaveSpec(n, 7);
    ok(w.dur > 0 && w.cap > 0 && w.interval > 0, `wave ${n} has a duration, a cap and an interval`);
    if (prev) {
      ok(w.cap >= prev.cap, `the cap never drops (wave ${n})`);
      ok(w.speed > prev.speed, `speed climbs every wave (wave ${n})`);
      ok(w.interval <= prev.interval, `spawns never slow down (wave ${n})`);
    }
    for (const m of w.mods) if (!(m in firstSeen)) firstSeen[m] = n;
    const gravity = w.mods.filter((m) => m === "lowg" || m === "heavy" || m === "flip");
    ok(gravity.length <= 1, `wave ${n} carries at most one gravity rule, got ${gravity.join("+")}`);
    if (n <= S.SPILL_AUTHORED_WAVES) ok(w.mods.length <= 1, `an authored wave teaches one rule (wave ${n})`);
    prev = w;
  }
  const order = ["surge", "lowg", "heavy", "cross", "blackout", "swarm", "flip"];
  const seen = order.map((m) => firstSeen[m]);
  ok(seen.every((n, i) => i === 0 || n > seen[i - 1]), `rules are taught in order: ${JSON.stringify(firstSeen)}`);
  ok(firstSeen.surge === 3 && firstSeen.lowg === 6 && firstSeen.flip === 18, `the taught waves match the ladder: ${JSON.stringify(firstSeen)}`);
  const a = S.spillWaveSpec(27, 99), b = S.spillWaveSpec(27, 99);
  ok(JSON.stringify(a) === JSON.stringify(b), "an endless wave is the same for the same seed");
  ok(S.spillWaveSpec(26, 99).mods.length === 2, "two rules roll from wave 26");
}

// ------------------------------------------- debris never meets debris
{
  // to wave 7: spinners weave from wave 4 and hulks wait out a warning
  // from wave 4, and both used to be predicted wrong
  let overlaps = 0, samples = 0, rocksSeen = 0, spinners = 0, hulks = 0;
  for (const seed of [3, 11, 42]) {
    const s = launch(seed);
    until(s, (x) => x.wave >= 7, 400, (x) => {
      for (const r of x.rocks) { if (r.kind === "spinner") spinners++; if (r.kind === "hulk") hulks++; }
      immune(x);
      const live = x.rocks.filter((r) => !r.dead && r.warn <= 0 && r.x < x.W + 60 && r.x > -60);
      rocksSeen = Math.max(rocksSeen, live.length);
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        samples++;
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) overlaps++;
      }
    });
  }
  ok(rocksSeen >= 3, `the field actually fills (peak ${rocksSeen} live pieces)`);
  ok(spinners > 0 && hulks > 0, `spinners and hulks were both in the field (${spinners}, ${hulks} rock-frames)`);
  ok(overlaps === 0, `debris never overlaps debris: ${overlaps} of ${samples} pair samples overlapped`);
}
{
  // the spawn check predicts exactly the motion the step flies
  const s = launch(44);
  s.rocks = [];
  const r = { x: s.W + 40, y: s.H / 2, vx: -200, vy: 10, r: 20, kind: "spinner", sprite: 0, spin: 0, rot: 0,
    arc: 40, arcPhase: 1.1, warn: 0.5, grazed: false, dead: false };
  s.rocks.push(r);
  const predicted = S.spillRockAt(s, r, 2);
  for (let i = 0; i < 120; i++) { s.pilot.y = s.H * 0.2; s.pilot.vy = 0; S.stepSpill(s, DT); }
  ok(Math.abs(r.x - predicted.x) < 2 && Math.abs(r.y - predicted.y) < 3,
    `a spinner behind a warning lands where the check said (${r.x.toFixed(1)},${r.y.toFixed(1)} vs ${predicted.x.toFixed(1)},${predicted.y.toFixed(1)})`);
}

// ----------------------------------------------------------------- hull
{
  const s = launch(5);
  s.rocks = [];
  ok(s.hull === 3 && s.maxHull === 3, "the hull opens at three pips");
  rockAt(s, s.pilot.x, s.pilot.y);
  const hitCues = S.stepSpill(s, DT);
  ok(s.hull === 2 && s.hits === 1, `a hit costs one pip (hull ${s.hull}, hits ${s.hits})`);
  ok(s.iframes > 1, "a hit arms the invulnerability window");
  ok(s.rocks.every((r) => r.dead) || s.rocks.length === 0, "the piece that hit is shattered, so it cannot hit twice");
  ok(hitCues.includes("hit"), "the frame reports the hit");
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.hull === 2, "a second piece inside the window costs nothing");
  s.rocks = [];
  until(s, (x) => x.iframes <= 0, 3, hover);
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.hull === 1, `after the window the next hit lands (hull ${s.hull})`);
  s.iframes = 0; s.rocks = [];
  rockAt(s, s.pilot.x, s.pilot.y);
  const deadCues = S.stepSpill(s, DT);
  ok(s.phase === "over" && s.cause === "STRUCK", `the third hit ends the run (${s.phase} ${s.cause})`);
  ok(deadCues.includes("dead"), "and says so");
}
{
  // a shield eats the piece; a Gilded Shield pays Gold for it
  const s = launch(6);
  s.rocks = [];
  s.shield = 1;
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.shield === 0 && s.hull === 3, `a shield absorbs the hit (shield ${s.shield}, hull ${s.hull})`);
  s.owned.gilded = 1; s.owned.reactive = 1; s.owned.shield = 1;
  s.shield = 1; s.rocks = [];
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.gold > 2.5, `a Gilded break hands over Gold (${s.gold.toFixed(2)}s)`);
  s.rocks = [];
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.hull === 3, "under Gold a piece shatters instead of hitting");
}
{
  // the floor: brushing is free, riding kills, and the timer forgives
  const s = launch(8);
  s.rocks = [];
  const ride = (seconds) => until(s, (x) => x.phase === "over", seconds,
    (x) => { x.rocks = []; x.pilot.y = x.H; x.pilot.vy = 0; });
  ok(!ride(0.15), "a tenth of a second on the floor is a bounce, not a death");
  until(s, () => false, 0.5, (x) => { x.rocks = []; x.pilot.y = x.H * 0.4; x.pilot.vy = 0; });
  ok(s.floorT === 0, "clearing the floor forgives the timer");
  ok(ride(0.6), "riding the floor is fatal");
  ok(s.cause === "GROUNDED", `and it says why (${s.cause})`);
}
{
  // the Respawn Core: one extra life, hull restored, three seconds of Gold
  const s = launch(9);
  s.rocks = [];
  s.owned.respawn = 1; s.respawnArmed = true;
  s.hull = 1;
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.phase === "respawn" && !s.respawnArmed, `the core catches the last hit (${s.phase})`);
  until(s, (x) => x.phase !== "respawn", 4);
  ok(s.phase === "wave" || s.phase === "drain", `and hands the pilot back (${s.phase})`);
  ok(s.hull === s.maxHull && s.gold > 2, `whole and golden (hull ${s.hull}, gold ${s.gold.toFixed(1)})`);
  s.rocks = []; s.gold = 0; s.iframes = 0; s.hull = 1;
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.phase === "over", "the core fires once");
}

// ---------------------------------------------------- waves and the Depot
{
  const s = launch(13);
  ok(S.spillCleared(s) === 0, "nothing is cleared while wave 1 is flown");
  const cleared1 = until(s, (x) => x.phase === "tally", 60, immune);
  ok(cleared1 && S.spillCleared(s) === 1, `draining the field clears the wave (${s.phase}, cleared ${S.spillCleared(s)})`);
  ok(s.lastCues.includes("clear"), "the clear is announced");
  until(s, (x) => x.phase === "card", 5, immune);
  ok(s.wave === 2, `the next wave follows (wave ${s.wave})`);
  const depot = until(s, (x) => x.phase === "depot", 400, immune);
  ok(depot && s.wave === 5, `the fifth wave opens the Depot (${s.phase} at wave ${s.wave})`);
  ok(S.spillCleared(s) === 5, "five waves stand cleared at the first Depot");
  const d = s.depot;
  ok(d && d.offers.length === 3 && d.offers.every(Boolean), `three shelves are stocked: ${JSON.stringify(d?.offers)}`);
  ok(Math.abs(d.timer - 30) < 0.1, `the first visit is thirty seconds (${d.timer.toFixed(1)})`);
  ok(JSON.stringify(S.SPILL.depotTime) === "[30,30,15]", "two long visits, then half");
  ok(s.rocks.length === 0, "the field is empty in the Depot");
  const front = S.spillItem(d.offers[0]);
  ok(front.track === "hull", `the first shelf is the hull track (${front.id})`);
  // a battered pilot is always offered the patch in front
  s.hull = 1; s.ore = 1000;
  S.spillReroll(s);
  ok(s.depot.offers[0] === "patch", `with a pip missing the front shelf is the patch (${s.depot.offers[0]})`);
  ok(s.ore === 980, `the first reroll costs 20 (ore ${s.ore})`);
  ok(S.spillRerollPrice(s) === 40, `and the next costs 40 (${S.spillRerollPrice(s)})`);
  ok(S.spillBuy(s, 0) === "ok" && s.hull === 2 && s.ore === 940, `buying the patch restores a pip and charges 40 (hull ${s.hull}, ore ${s.ore})`);
  ok(s.depot.offers[0] === null, "a bought shelf is empty");
  S.spillReroll(s);
  ok(s.depot.offers[0] === null && s.depot.offers[1] && s.depot.offers[2], "a reroll restocks only what is unsold");
  ok(s.ore === 900, `the second reroll charged 40 (ore ${s.ore})`);
  const t0 = s.depot.timer;
  ok(S.spillExtend(s) === "ok" && s.depot.timer - t0 > 14.9 && s.ore === 875, `an extension buys 15s for 25 (ore ${s.ore})`);
  ok(S.spillExtendPrice(s) === 50, "and doubles");
  s.ore = 0;
  ok(S.spillBuy(s, 1) === "poor" && s.cues.includes("deny"), "a short purse is refused, audibly");
  ok(S.stepSpill(s, DT).includes("deny"), "and the refusal reaches the next frame's cues");
  ok(S.spillLeaveDepot(s) && s.phase === "card" && s.wave === 6 && s.depot === null, `leaving opens wave 6 (${s.phase} ${s.wave})`);
  ok(s.liveMods.includes("lowg"), `wave 6 flies LOW-G (${s.liveMods})`);
  ok(s.hintT > 0 && s.hint.startsWith("LOW-G"), "and teaches it, once");
  ok(s.taught.includes("lowg"), "the lesson is remembered");
}
{
  // a clear is never taken back: a crash in the tally keeps the wave
  const s = launch(31);
  until(s, (x) => x.phase === "tally", 60, immune);
  ok(S.spillCleared(s) === 1, "wave 1 stands cleared at the tally");
  until(s, (x) => x.phase === "over", 3, (x) => { x.rocks = []; x.pilot.y = x.H; x.pilot.vy = 0; });
  ok(s.phase === "over" && s.cause === "GROUNDED", `riding the floor in the tally is still fatal (${s.phase})`);
  ok(S.spillCleared(s) === 1, `and the clear survives it (cleared ${S.spillCleared(s)})`);
}
{
  // a Respawn Core fired in the tally returns to the tally, so the wave
  // is neither drained nor tallied twice
  const s = launch(32);
  until(s, (x) => x.phase === "tally", 60, immune);
  s.owned.respawn = 1; s.respawnArmed = true;
  until(s, (x) => x.phase === "respawn", 3, (x) => { x.rocks = []; x.pilot.y = x.H; x.pilot.vy = 0; });
  ok(s.phase === "respawn", "the core catches a grounding in the tally");
  let clears = 0, guard = 0;
  while (s.phase !== "card" && guard++ < 60 * 10) { hover(s); const c = S.stepSpill(s, DT); if (c.includes("clear")) clears++; }
  ok(s.phase === "card" && s.wave === 2, `the run goes on to wave 2 (${s.phase} ${s.wave})`);
  ok(clears === 0, `wave 1 is not cleared a second time (${clears} extra clears)`);
  ok(S.spillCleared(s) === 1, "and the record says one");
}
{
  // a lunge on the ready card is a launch
  const s = S.createSpill(W, H, 33, 0);
  ok(S.spillLunge(s) === true && s.phase === "card", `the lunge launches (${s.phase})`);
}
{
  // the Depot clock closes the shop on its own
  const s = launch(14);
  until(s, (x) => x.phase === "depot", 400, immune);
  s.depot.timer = 0.5;
  until(s, (x) => x.phase !== "depot", 2);
  ok(s.phase === "card" && s.wave === 6, `the clock running out sends the pilot back (${s.phase} ${s.wave})`);
}
{
  // the tree: a shelf never offers a rung whose left neighbour is unowned,
  // and never the rare tier before the third Depot
  const s = launch(15);
  until(s, (x) => x.phase === "depot", 400, immune);
  // the reroll price doubles every time, so each roll here is a fresh visit
  const reroll = (x) => { x.ore = 1e6; x.depot.rerolls = 0; ok(S.spillReroll(x) === "ok", "a funded reroll rolls"); };
  const offered = new Set();
  for (let i = 0; i < 150; i++) { reroll(s); for (const id of s.depot.offers) if (id) offered.add(id); }
  ok(offered.size >= 6, `the shelves vary (${offered.size} distinct offers)`);
  for (const id of offered) {
    const item = S.spillItem(id);
    ok(!item.requires || s.owned[item.requires], `${id} needs ${item.requires} first`);
    ok(item.tier !== 3, `${id} is rare and wave ${s.wave} is too early for it`);
  }
  // own the whole first tier and the second opens
  for (const id of ["shield", "patch", "fuel", "fastcharge", "magnet"]) s.owned[id] = 1;
  s.hull = s.maxHull; s.shield = 2;
  const second = new Set();
  for (let i = 0; i < 150; i++) { reroll(s); for (const id of s.depot.offers) if (id) second.add(id); }
  for (const id of second) {
    const item = S.spillItem(id);
    ok(item.consumable || item.once || !s.owned[id], `${id} is owned and must not be shelved again`);
  }
  ok(["reactive", "plating", "twinlunge", "widepulse", "richvein"].some((id) => second.has(id)),
    `tier two appears once tier one is owned: ${[...second].join(",")}`);
  ok(!second.has("shield"), "a full shield stack is never offered a third");
}
{
  // Stabiliser cancels the next gravity rule; Overshield and Primed land at the card
  const s = launch(16);
  until(s, (x) => x.phase === "depot", 400, immune);
  s.ore = 1000;
  s.owned.stabiliser = 0; s.stabiliseNext = true; s.overshieldNext = 1; s.primedNext = true;
  S.spillLeaveDepot(s);
  ok(!s.liveMods.includes("lowg"), `the Stabiliser cancels LOW-G on wave 6 (${s.liveMods})`);
  ok(s.cardNote.startsWith("STABILISED"), `and the wave card says so (${s.cardNote})`);
  ok(s.shield >= 1, "the Overshield is up for the wave");
  ok(s.charge === 1, "the Primed Pulse fills the meter");
}

// ------------------------------------------------------------- a mission
{
  const s = launch(21, 2);
  ok(s.target === 2, "the mission names its rung");
  until(s, (x) => x.phase === "over", 200, immune);
  ok(s.cause === "MISSION COMPLETE" && s.wave === 2, `clearing wave 2 finishes it (${s.cause} at ${s.wave})`);
  ok(S.spillCleared(s) === 2, "and both waves count");
  ok(s.lastCues.includes("mission"), "the finish is reported");
  ok(s.hull === 3, "nothing in the finishing frame touched the hull");
}

// ------------------------------------------------------------- the seam
{
  const fresh = () => (save.freshSave ? save.freshSave() : save.loadSave());
  const w = sim.makeWorld(430, 900);
  const sv = fresh();
  sv.tutorialDone = true; sv.guide = "done";
  const wallet = sv.acorns;
  sim.resetRun(w, sv, "spill", false);
  ok(w.spill !== null && w.tut === null && w.flight === "spill", "a spill run carries its own state and no tutorial");
  ok(w.shieldCharges === 0, "the hangar's start shield stays in the hangar");
  ok(sim.flap(w, sv) === "flap" && w.spill.phase === "card", "the first tap launches the field");
  // four seconds of flight, tapping to stay off the floor, nothing to hit
  for (let i = 0; i < 60 * 4; i++) {
    w.spill.rocks = [];
    if (i % 24 === 0 && w.spill.phase === "wave") sim.flap(w, sv);
    sim.updateWorld(w, sv, DT);
  }
  ok(w.spill.phase === "wave", `the sim steps the Spill (${w.spill.phase})`);
  ok(Math.abs(w.squirrel.y - w.spill.pilot.y) < 1e-6, "the world's squirrel mirrors the Spill's pilot");
  ok(sim.pilotX(w) === w.spill.pilot.x, "and the pilot's X follows the lunge lane");
  ok(sim.dive(w, sv) === "dive", "a dive routes to the Spill");
  // die: three pips gone, on the fourth wave
  w.spill.hull = 1; w.spill.iframes = 0; w.spill.rocks = []; w.spill.floorT = 0;
  w.spill.pilot.y = w.H * 0.45; w.spill.pilot.vy = 0;
  rockAt(w.spill, w.spill.pilot.x, w.spill.pilot.y);
  w.spill.wave = 4; w.spill.cleared = 3;
  const ev = sim.updateWorld(w, sv, DT);
  ok(ev === "die" && w.screen === "dead", `the last hit crashes the run (${ev}, ${w.screen})`);
  ok(w.score === 3 && sv.spillBest === 3, `the best is waves cleared (score ${w.score}, best ${sv.spillBest})`);
  ok(sv.acorns === wallet, "Ore never reaches the acorn wallet");
  ok(w.lastRun && w.lastRun.best === true, "a first run is a best");
  sv.acorns = 500;
  ok(sim.reviveRun(w, sv) === false && sv.acorns === 500, "the acorn continue is refused: the Spill sells its own");
}
{
  // the beta chart: level 8 of every chapter from 2 is a wave mission
  const spills = camp.LEVELS.filter((l) => l.base === "spill");
  ok(spills.length === 9 && spills.every((l) => l.n === 8 && l.stage >= 2), `nine level-8 missions (${spills.length})`);
  ok(spills.every((l) => l.gates === 2 + l.stage), "each names the wave to clear");
  const def = camp.levelById("2-8");
  ok(camp.goalText(def.goals[0], def) === "Clear 4 waves of the Spill", `the finish reads as waves: ${camp.goalText(def.goals[0], def)}`);
  ok(def.goals[1].kind === "ore" && def.goals[2].kind === "noHit", "the stars are Ore and a clean hull");
  const st = camp.emptyStats();
  ok(camp.goalHud(def.goals[2], st, 0, def).state === "done", "no hits yet reads green");
  st.hits = 1;
  ok(camp.goalHud(def.goals[2], st, 0, def).state === "lost", "one hit turns it red");
  ok(camp.goalHud(def.goals[0], st, 3, def).text === "WAVE 3/4", "the finish pill counts waves");
  // flown through the sim: reaching the rung settles the level with its stars
  const w = sim.makeWorld(430, 900);
  const sv = save.loadSave();
  sv.tutorialDone = true; sv.guide = "done";
  sim.resetRun(w, sv, "spill", false, def);
  ok(w.spill && w.spill.target === 4 && w.spill.seed === 5000 + def.ord, "a mission flies a fixed ladder to its rung");
  sim.flap(w, sv);
  let guard = 0;
  while (w.screen === "play" && guard++ < 60 * 400) {
    immune(w.spill);
    sim.updateWorld(w, sv, DT);
  }
  ok(w.screen === "lvldone", `the mission settles (${w.screen})`);
  ok(w.lastLevel && w.lastLevel.finished && (sv.stars["2-8"] & 1) === 1, "the finish star lands");
  ok(w.lastLevel.met[2] === true, "a run with no hits earns the clean-hull star");
  ok(w.lastLevel.stats.ore === w.spill.oreMined && w.lastLevel.stats.hits === w.spill.hits
    && w.lastLevel.stats.score === Math.floor(w.spill.score),
    `the receipt carries the Spill's own ledger (ore ${w.lastLevel.stats.ore}/${w.spill.oreMined}, hits ${w.lastLevel.stats.hits}/${w.spill.hits})`);
}

// ------------------------------------------------------------- the bot
//
// A dodger, not a player: it looks 220px ahead, picks the widest gap in
// the lane it is flying, and taps or dives toward it. If this cannot clear
// wave 1 the ladder is broken, whatever the tuning says.
function bot(s) {
  const p = s.pilot;
  if (s.phase !== "wave" && s.phase !== "drain" && s.phase !== "tally") return;
  const ahead = s.rocks.filter((r) => !r.dead && r.warn <= 0 && r.x > p.x - 20 && r.x < p.x + 300);
  let target = s.H * 0.45;
  if (ahead.length) {
    // sample candidate heights inside the band the floor rule allows, and
    // score each by clearance from every piece's predicted position when
    // it reaches the pilot, less the cost of getting there
    let best = -1e9;
    for (let y = 80; y <= s.H - 130; y += 20) {
      let clear = 1e9;
      for (const r of ahead) {
        const eta = Math.max(0, (r.x - p.x) / Math.max(40, -r.vx));
        const ry = r.y + r.vy * eta;
        clear = Math.min(clear, Math.abs(ry - y) - r.r);
      }
      const score = Math.min(clear, 140) - Math.abs(y - p.y) * 0.12;
      if (score > best) { best = score; target = y; }
    }
  }
  // never idle near the floor: below three quarters the answer is always up
  if (p.y > s.H - 140) target = Math.min(target, s.H * 0.55);
  if (p.y > target + 14 && p.vy > -60) S.spillFlap(s);
  else if (p.y < target - 90 && p.vy < 150) S.spillDive(s);
  if (s.charge >= 1 && ahead.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < 110)) S.spillPulse(s);
}
{
  const seeds = [1, 2, 3, 4, 5, 6];
  let cleared1 = 0, cleared2 = 0;
  const lived = [];
  for (const seed of seeds) {
    const s = launch(seed);
    until(s, (x) => x.phase === "over" || x.wave >= 3, 120, bot);
    lived.push(s.t.toFixed(1));
    if (S.spillCleared(s) >= 1) cleared1++;
    if (S.spillCleared(s) >= 2) cleared2++;
  }
  ok(cleared1 >= 4, `a dodging bot clears wave 1 on most seeds (${cleared1}/${seeds.length}; lived ${lived.join(", ")}s)`);
  console.log(`bot: wave 1 cleared ${cleared1}/${seeds.length}, wave 2 cleared ${cleared2}/${seeds.length}, lived ${lived.join(", ")}s`);
}

if (fail.length) {
  console.error(`FAIL (${fail.length})`);
  for (const f of fail) console.error(" - " + f);
  process.exit(1);
}
console.log("spill: all assertions pass");
