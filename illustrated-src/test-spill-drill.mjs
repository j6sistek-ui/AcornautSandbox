#!/usr/bin/env node
// First-run controls drill (owner, 9 Nov 2026): wave 1's countdown waits on
// steer, let go, fire and dodge in turn; skipping or finishing ends it.
import assert from 'node:assert/strict';
globalThis.window = { location: { href: 'http://local/' }, devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const S = await import('../docs/js/spill.js');
const dt = 1 / 60;
function wave1(wanted) {
  const s = S.createSpill(390, 760, 99, 0, true, false); s.drillWanted = wanted;
  S.spillTap(s); assert.equal(s.phase, 'countdown'); return s;
}
const run = (s, n) => { const cues = []; for (let i = 0; i < n; i++) cues.push(...S.stepSpill(s, dt)); return cues; };
{ const s = wave1(false); assert(!s.drill, 'no drill once done'); run(s, 200); assert.equal(s.phase, 'wave'); }
{ const s = wave1(true); assert.equal(s.drill.step, 0);
  const idle = run(s, 600); assert.equal(s.phase, 'countdown', 'the count holds'); assert(!idle.includes('count'), 'no count ticks while it holds');
  S.spillSteer(s, 1); run(s, 40); assert.equal(s.drill.step, 1, 'steer');
  S.spillSteer(s, 0); run(s, 30); assert.equal(s.drill.step, 2, 'let go');
  assert(!S.spillDrillFire(wave1(true)), 'fire only counts on its own step');
  assert(S.spillDrillFire(s)); assert.equal(s.drill.step, 3, 'fire');
  assert(S.spillLunge(s, -1)); run(s, 1); assert.equal(s.drill.step, 4, 'dodge');
  const end = run(s, 90); assert(!s.drill && end.includes('drill-done'), 'the drill ends and says so');
  run(s, 200); assert.equal(s.phase, 'wave', 'then the normal count runs to GO');
}
{ const s = wave1(true); assert(S.spillSkipDrill(s)); const c = run(s, 1); assert(c.includes('drill-done') && !s.drill, 'skip ends it');
  run(s, 200); assert.equal(s.phase, 'wave'); }
{ const s = wave1(true); run(s, 5); assert.equal(S.spillCheckpoint(s), null, 'no checkpoint mid-drill'); }
console.log('spill drill: holds the count, four steps in order, skip, done cue, normal GO after');
