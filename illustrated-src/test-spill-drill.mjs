#!/usr/bin/env node
// Training flight (owner, 9-10 Nov 2026): before a pilot's first wave 1 the
// field runs live but scripted - flight, a dash, three pieces of debris, one
// patrol ship to evade and then shoot down. No damage, nothing kept, then GO.
import assert from 'node:assert/strict';
globalThis.window = { location: { href: 'http://local/' }, devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const S = await import('../docs/js/spill.js');
const C = await import('../docs/js/spill-combat.js');
const dt = 1 / 60;
function start(wanted, W = 390, H = 760) {
  const s = S.createSpill(W, H, 99, 0, true, false); s.drillWanted = wanted;
  S.spillTap(s); return s;
}
const run = (s, n, each) => { const cues = []; for (let i = 0; i < n; i++) { each?.(s); cues.push(...S.stepSpill(s, dt)); } return cues; };
const step = s => S.spillDrillStep(s);
const ids = S.SPILL_DRILL.map(x => x.id);
assert.deepEqual(ids, ['steer', 'hold', 'dash', 'debris', 'evade', 'fire', 'ready'], 'flight, debris, enemy stages in order');

{ const s = start(false); assert(!s.drill && s.phase === 'countdown', 'no training once done'); run(s, 200); assert.equal(s.phase, 'wave'); }

for (const [W, H] of [[390, 760], [320, 568], [1280, 720]]) {
  const s = start(true, W, H);
  assert.equal(step(s), 'steer'); assert.equal(s.phase, 'wave', 'training is a live field');
  // it waits: ten idle seconds change nothing, spawn nothing, score nothing
  run(s, 600); assert.equal(step(s), 'steer'); assert.equal(s.rocks.length, 0); assert.equal(s.combat.enemies.length, 0); assert.equal(s.score, 0); assert.equal(s.waveT, 0);
  // FLIGHT
  S.spillSteer(s, 1); run(s, 40); assert.equal(step(s), 'hold');
  S.spillSteer(s, 0); run(s, 30); assert.equal(step(s), 'dash');
  // DEBRIS: a dash, then three pieces aimed at the ship
  C.spillSetFiring(s, true); run(s, 5); assert.equal(s.combat.shots.length, 0, 'no weapon before its lesson');
  assert(S.spillLunge(s, 1)); run(s, 2); assert.equal(step(s), 'debris');
  // stand still for the first one: it hits, costs nothing, and does not count
  const hull = s.hull; let hitSeen = false;
  for (let i = 0; i < 400 && !hitSeen; i++) hitSeen = S.stepSpill(s, dt).includes('hit');
  assert(hitSeen, 'a piece left alone hits the ship'); assert.equal(s.hull, hull, 'and costs no health'); assert.equal(s.hits, 0);
  run(s, 2); assert.equal(s.drill.count, 0, 'a hit does not count as a dodge');
  // now move out of the lane of each piece
  let guard = 0;
  while (step(s) === 'debris' && guard++ < 3000) {
    const rock = s.rocks.find(r => !r.dead);
    S.spillSteer(s, rock && Math.abs(rock.y - s.pilot.y) < 90 ? (rock.y > s.H / 2 ? -1 : 1) : 0);
    S.stepSpill(s, dt);
  }
  assert.equal(step(s), 'evade', `three clean dodges pass the debris stage at ${W}x${H}`);
  S.spillSteer(s, 0);
  // ENEMY: one real patrol ship arrives, warns and fires; weapons stay locked
  run(s, 120); const enemy = s.combat.enemies.find(e => !e.dead); assert(enemy && enemy.kind === 'pursuer', 'a patrol ship arrives');
  // stand still: its shot hits, harmlessly, and the step does not pass
  let struck = false; for (let i = 0; i < 900 && !struck; i++) struck = S.stepSpill(s, dt).includes('hit');
  assert(struck, 'its shot hits a ship that stays on the line'); assert.equal(s.hull, hull); assert.equal(step(s), 'evade');
  // move off the warned line once it commits
  guard = 0;
  while (step(s) === 'evade' && guard++ < 4000) {
    const e = s.combat.enemies.find(x => !x.dead), shot = s.combat.shots.find(x => !x.dead && x.team === 'enemy');
    const threatY = shot ? shot.y : e && e.telegraph > 0 ? e.aimY : null;
    S.spillSteer(s, threatY != null && Math.abs(threatY - s.pilot.y) < 70 ? (s.pilot.y > s.H / 2 ? -1 : 1) : 0);
    S.stepSpill(s, dt);
  }
  assert.equal(step(s), 'fire', `a clean evade passes at ${W}x${H}`);
  S.spillSteer(s, 0);
  // FIRE: shoot it down, staying level with it
  guard = 0; let downed = false;
  while (step(s) === 'fire' && guard++ < 4000) {
    const e = s.combat.enemies.find(x => !x.dead);
    if (e) S.spillSteer(s, Math.abs(e.y - s.pilot.y) < 12 ? 0 : e.y > s.pilot.y ? 1 : -1);
    C.spillSetFiring(s, true);
    if (S.stepSpill(s, dt).includes('enemy-down')) downed = true;
  }
  assert(downed && step(s) === 'ready', `shooting the patrol down passes at ${W}x${H}`);
  const end = run(s, 90);
  assert(!s.drill && end.includes('drill-done'), 'training ends and says so');
  assert.equal(s.phase, 'countdown', 'then the ordinary count');
  assert.deepEqual([s.score, s.ore, s.oreMined, s.grazes, s.hits, s.combat.kills, s.rocks.length, s.nuts.length, s.combat.enemies.length], [0, 0, 0, 0, 0, 0, 0, 0, 0], 'nothing from training is kept');
  assert.equal(s.hull, hull);
  run(s, 200); assert.equal(s.phase, 'wave'); assert(!s.drill); run(s, 60); assert(s.waveT > 0, 'wave 1 runs for real');
}
{ const s = start(true); S.spillSteer(s, 1); run(s, 40); assert(S.spillSkipDrill(s)); const c = S.stepSpill(s, dt);
  assert(c.includes('drill-done') && !s.drill && s.phase === 'countdown', 'skip ends training at any step'); run(s, 200); assert.equal(s.phase, 'wave'); }
{ const s = start(true); run(s, 5); assert.equal(S.spillCheckpoint(s), null, 'no checkpoint mid-training'); }
console.log('spill drill: live flight, dash, three debris, evade and shoot a patrol ship at 3 sizes; harmless, nothing kept, skip, normal GO after');
