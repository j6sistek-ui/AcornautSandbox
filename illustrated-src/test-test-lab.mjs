#!/usr/bin/env node
/** THE TEST LAB's FLIGHT TEST (owner, 12 Sep 2026: "add you self flying
 *  simulator in there. 2/4/6/8 auto flap speed ... always there always.
 *  beta only").
 *
 *  What this pins:
 *    1. BETA ONLY - beginFlightTest refuses on the production page, and a
 *       live save's Flight Test settings are inert there.
 *    2. THE SKY IS EMPTY AND THE RUN NEVER ENDS - no pairs, no pickups,
 *       free revive on, the floor bounces, and ten seconds of any pattern
 *       leaves the screen on "play".
 *    3. THE AUTOPILOT TAPS ON THE TICK - 2, 4, 6 and 8 taps a second land
 *       within one tap of the count over ten seconds, hover is 2V/g, and
 *       every tap goes through flap() so the tap log sees it.
 *    4. STATION KEEPS THE PILOT ON SCREEN for a long stare at one suit.
 *    5. IT NEVER LEAKS - resetRun clears it, and the save sanitiser keeps
 *       only sane settings.
 *
 *  Runs itself twice, once per page, because IS_BETA is read at import.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (!mode) {
  for (const page of ['beta', 'production']) execFileSync(process.execPath, [fileURLToPath(import.meta.url), page], { stdio: 'inherit' });
  process.exit(0);
}
assert(['beta', 'production'].includes(mode));
const beta = mode === 'beta';
const stored = new Map();
globalThis.window = { __ACORNAUT_BETA__: beta, location: { href: beta ? 'http://local/beta/' : 'http://local/' }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) };

const Sim = await import('../docs/js/sim.js');
const S = await import('../docs/js/save.js');
const Cat = await import('../docs/js/catalog.js');
assert.equal(Cat.IS_BETA, beta, 'the page flag reached the catalog');

function world(suit = 'iontrim') {
  const save = S.defaultSave();
  Object.assign(save, { equippedSuit: suit, tutorialDone: true, guide: 'done' });
  const w = Sim.makeWorld(390, 844);
  return { save, w };
}
const tick = (w, save, n) => { for (let i = 0; i < n; i++) Sim.updateWorld(w, save, 1 / 60); };

if (!beta) {
  // ---- 1. the production page has no Flight Test ---------------------------
  const { save, w } = world();
  assert.equal(Sim.beginFlightTest(w, save, '8'), false, 'production: beginFlightTest refuses');
  assert.equal(w.flightTest, null, 'production: nothing armed');
  assert.equal(w.timeScale, 1);
  tick(w, save, 60);
  assert.equal(w.run.taps, 0, 'production: nothing taps by itself');
  console.log(JSON.stringify({ suite: 'test lab', page: mode, result: 'PASS' }));
  process.exit(0);
}

// ---- 2. an empty sky, a run that cannot end -------------------------------
{
  const { save, w } = world();
  assert.equal(Sim.beginFlightTest(w, save, '4'), true);
  assert.equal(w.flightTest.pattern, '4');
  assert.equal(w.screen, 'play');
  assert.equal(w.planets.length, 0, 'the opening pairs are gone');
  assert.equal(w.pickups.length, 0, 'no pickups either');
  assert.equal(w.lab.freeRevive, true, 'free revive rides the test');
  assert.equal(Sim.beginFlightTest(w, save, 'nonsense'), true);
  assert.equal(w.flightTest.pattern, 'hover', 'an unknown pattern falls back to hover');
}
{
  // MANUAL never taps; the floor holds the pilot in the run for fifteen seconds
  const { save, w } = world();
  Sim.beginFlightTest(w, save, 'manual');
  w.ready = false;
  tick(w, save, 900);
  assert.equal(w.run.taps, 0, 'manual: no autopilot taps');
  assert.equal(w.screen, 'play', 'manual: the run did not end');
  assert(w.squirrel.y <= w.H, `manual: the floor held (y ${w.squirrel.y.toFixed(0)} of ${w.H})`);
  assert.equal(w.planets.length, 0, 'manual: the sky stayed empty');
}

// ---- 3. the autopilot taps on the tick ------------------------------------
for (const p of ['2', '4', '6', '8']) {
  const { save, w } = world();
  Sim.beginFlightTest(w, save, p);
  // the first tap releases the READY hold after a short lead-in; the
  // cadence is measured over the ten seconds that follow it
  let lead = 0;
  while (w.run.taps === 0 && lead++ < 120) Sim.updateWorld(w, save, 1 / 60);
  assert(w.run.taps === 1, `${p}/s: the first tap came within two seconds`);
  tick(w, save, 600);
  const want = Number(p) * 10 + 1;
  assert(Math.abs(w.run.taps - want) <= 1, `${p}/s: ${w.run.taps} taps in 10 s after the first, wanted ${want}`);
  assert.equal(w.flightTest.tapLog.length > 0, true, `${p}/s: the tap log saw them`);
  assert.equal(w.screen, 'play', `${p}/s: the run never ends`);
  assert.equal(w.planets.length, 0, `${p}/s: the sky stays empty`);
  assert(w.squirrel.y >= 0 && w.squirrel.y <= w.H, `${p}/s: the pilot stayed on screen`);
}
assert(Math.abs(Sim.flightTestInterval('hover') - 2 * Math.abs(Cat.PHYS.flap) / Cat.PHYS.gravity) < 1e-9, 'hover is 2V/g');
assert.equal(Sim.flightTestInterval('manual'), 0);
{
  // PAIRS: two taps close together, then a gap - never a steady stream
  const { save, w } = world();
  Sim.beginFlightTest(w, save, 'pairs');
  tick(w, save, 600);
  assert(w.run.taps >= 12 && w.run.taps <= 26, `pairs: ${w.run.taps} taps in 10 s`);
}
{
  // the thumb's taps count in the same log as the autopilot's
  const { save, w } = world();
  Sim.beginFlightTest(w, save, 'manual');
  w.ready = false;
  tick(w, save, 1);
  assert.equal(Sim.flap(w, save), 'flap');
  assert.equal(w.flightTest.tapLog.length, 1, 'a manual tap is logged');
}

// ---- 4. STATION keeps the pilot around the centre line ---------------------
{
  const { save, w } = world();
  Sim.beginFlightTest(w, save, 'station');
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 1800; i++) {
    Sim.updateWorld(w, save, 1 / 60);
    if (i > 240) { lo = Math.min(lo, w.squirrel.y); hi = Math.max(hi, w.squirrel.y); }
  }
  assert(lo > w.H * 0.15 && hi < w.H, `station: band ${lo.toFixed(0)}..${hi.toFixed(0)} of ${w.H}`);
  assert(w.run.taps > 10, `station: it tapped (${w.run.taps})`);
  assert.equal(w.screen, 'play');
}

// ---- 5. it never leaks ------------------------------------------------------
{
  const { save, w } = world();
  Sim.beginFlightTest(w, save, '8');
  w.timeScale = 0.25;
  Sim.resetRun(w, save, 'fly', false);
  assert.equal(w.flightTest, null, 'a plain run carries no Flight Test');
  assert.equal(w.timeScale, 1, 'nor its transport');
  assert.equal(w.lab.freeRevive, undefined, 'nor its free revive');
}
{
  const base = S.defaultSave();
  stored.set(Cat.SAVE_KEY, JSON.stringify({ ...base, testLab: { pattern: 'nonsense', speed: 9 } }));
  const s = S.loadSave();
  assert.deepEqual(s.testLab, {}, 'the sanitiser drops a bad pattern and an out-of-range speed');
  stored.set(Cat.SAVE_KEY, JSON.stringify({ ...base, testLab: { pattern: '6', speed: 0.5 } }));
  assert.deepEqual(S.loadSave().testLab, { pattern: '6', speed: 0.5 }, 'and keeps sane ones');
  stored.set(Cat.SAVE_KEY, JSON.stringify({ ...base, testLab: 'junk' }));
  assert.equal(S.loadSave().testLab, undefined, 'and drops junk outright');
  // the accent strength dial: 0.25..4 survives, anything else is stock
  stored.set(Cat.SAVE_KEY, JSON.stringify({ ...base, tapAccentStrength: 3 }));
  assert.equal(S.loadSave().tapAccentStrength, 3, 'a dialled strength survives');
  assert.equal(S.tapAccentStrengthFor(S.loadSave()), 3);
  for (const bad of [0, 9, 'x', NaN]) {
    stored.set(Cat.SAVE_KEY, JSON.stringify({ ...base, tapAccentStrength: bad }));
    assert.equal(S.loadSave().tapAccentStrength, undefined, `strength ${bad} is dropped`);
  }
  assert.equal(S.tapAccentStrengthFor(base), 1, 'no dial reads as 1x');
}
console.log(JSON.stringify({ suite: 'test lab', page: mode, patterns: Sim.FLIGHT_TEST_PATTERNS.length, result: 'PASS' }));
