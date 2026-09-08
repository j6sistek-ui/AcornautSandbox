#!/usr/bin/env node
/** THE STAR CHART NEVER ADOPTS THE LOADOUT (owner, 8 Sep 2026: "when pal
 *  effects are toggled off, that doesn't count in star chart, a pal means
 *  it must be used. and no pal in the star chart means no pal... it must
 *  run with active effects of designated pal").
 *
 *  Proves, on the production bundle: a mission with no pal flies nobody
 *  whatever is equipped; a mission's pal flies and its effect is live with
 *  the Pal Effects switch off; the loadout's pal never leaks into a mission
 *  and a mission's pal never leaks into the free flight after it (the fx
 *  used to be folded before the mission was set, so they read the previous
 *  run's); a mission's Stopwatch toggles with the switch off.
 */
import assert from "node:assert/strict";
const storage = new Map();
globalThis.window = { location: { search: "" }, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null }), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
const C = await import("../docs/js/campaign.js"), S = await import("../docs/js/save.js"), Sim = await import("../docs/js/sim.js");

const fresh = () => { const s = S.defaultSave(); s.unlockedPals.push("magnetar"); s.equippedPal = "magnetar"; return s; };
const run = (save, def, flight = def?.base ?? "fly") => { const w = Sim.makeWorld(390, 760); Sim.resetRun(w, save, flight, false, def); return w; };
const noPal = C.LEVELS.find((l) => !l.fx.pal && l.base === "fly");
const beeDef = C.LEVELS.find((l) => l.fx.pal === "bee");
const magDef = C.LEVELS.find((l) => l.fx.pal === "magnetar");
const swDef = C.LEVELS.find((l) => l.fx.pal === "switchback");
assert(noPal && beeDef && magDef, "the road carries a pal-less mission, a Bee mission and a Magnetar mission");

// no pal on the mission: nobody flies, no effect, whatever is equipped
{
  const s = fresh();
  const w = run(s, noPal);
  assert.deepEqual(Sim.runPals(s, w), [], "a pal-less mission flies no pal");
  assert.equal(w.palFx, null, "and carries no pal fx");
  assert.equal(Sim.worldFlipped(w), false, "the loadout's Magnetar does not flip a pal-less mission");
}
// the mission's pal flies alone; the loadout's pal and its effect stay home
{
  const s = fresh();
  const w = run(s, beeDef);
  assert.deepEqual(Sim.runPals(s, w), ["bee"], "the Bee mission flies Bee, not the equipped Magnetar");
  assert.equal(Sim.worldFlipped(w), false, "Magnetar's flip stays in the loadout");
}
// the mission's pal effect is LIVE with the Pal Effects switch off
{
  const s = fresh(); s.equippedPal = "none"; s.noPalFx = true;
  const w = run(s, magDef);
  assert.deepEqual(Sim.runPals(s, w), ["magnetar"], "the Magnetar mission flies Magnetar with no pal equipped");
  assert.equal(Sim.worldFlipped(w), true, "and its flip is live with Pal Effects off");
}
// nothing leaks between runs: a mission after free flight, free flight after a mission
{
  const s = fresh();
  const w = run(s, undefined, "fly");
  assert.equal(Sim.worldFlipped(w), true, "free flight with Magnetar equipped flips");
  Sim.resetRun(w, s, "fly", false, beeDef);
  assert.equal(Sim.worldFlipped(w), false, "the Bee mission that follows does not inherit the flip");
  assert.deepEqual(Sim.runPals(s, w), ["bee"]);
  Sim.resetRun(w, s, "fly", false, magDef);
  assert.equal(Sim.worldFlipped(w), true, "the Magnetar mission flips on its own pal");
  Sim.resetRun(w, s, "fly", false, noPal);
  assert.equal(Sim.worldFlipped(w), false, "a pal-less mission after it does not keep the flip");
  Sim.resetRun(w, s, "fly", false);
  assert.deepEqual(Sim.runPals(s, w), ["magnetar"], "free flight after a mission flies the loadout again");
  assert.equal(Sim.worldFlipped(w), true, "and the loadout's effect is back");
  s.noPalFx = true;
  Sim.resetRun(w, s, "fly", false);
  assert.deepEqual(Sim.runPals(s, w), ["magnetar"], "Pal Effects off keeps the pal flying in free flight");
  assert.equal(Sim.worldFlipped(w), false, "without its effect");
}
// a mission's Stopwatch ignores the switch
if (swDef && swDef.base === "fly") {
  const s = fresh(); s.noPalFx = true;
  const w = run(s, swDef);
  const before = w.tapFrozen;
  Sim.flap(w, s);
  assert.notEqual(w.tapFrozen, before, "the mission's Stopwatch toggles the slow with Pal Effects off");
}
console.log("mission pals: a mission flies its own pal or nobody, its effect is live with the switch off, nothing leaks between runs");
