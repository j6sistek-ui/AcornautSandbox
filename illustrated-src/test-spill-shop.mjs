#!/usr/bin/env node
// The Depot shelf (owner, 3 Nov 2026): utilities and artifacts in one list,
// two new offers per visit that rotate, one slot until wave 10, undo within a visit.
import assert from 'node:assert/strict';
globalThis.window = { location: { href: 'http://local/' }, devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const S = await import('../docs/js/spill.js');
const Shop = await import('../docs/js/spill-shop.js');

function depot(wave, seed = 4242) {
  const s = S.createSpill(390, 760, seed);
  s.phase = 'depot'; s.wave = s.cleared = wave; s.depot = { arm: 0, bought: [] }; s.welcome = false; s.ore = 1000;
  return s;
}
const key = Shop.itemKey;

// two offers, never the Brake, never the Battery without Impact pulse
for (let seed = 1; seed < 40; seed++) {
  const s = depot(5, seed), offers = Shop.spillShelfOffers(s);
  assert.equal(offers.length, 2);
  assert(!offers.some(o => o.id === 'brake'), 'the Brake left the shelf');
  assert(!offers.some(o => o.id === 'capacitor'), 'no Battery before Impact pulse');
}
{ const s = depot(5); s.up.pulse = 1; const all = new Set();
  for (let w = 5; w <= 40; w += 5) { s.wave = w; for (const o of Shop.spillShelfOffers(s)) all.add(key(o)); }
  assert(all.has('utility:capacitor'), 'the Battery joins once Impact pulse is owned');
  assert(['artifact:reclaimer', 'artifact:slipstream', 'artifact:siege', 'utility:magnet', 'utility:scanner'].every(k => all.has(k)), 'the window cycles through the whole pool');
  s.wave = 5; const a = Shop.spillShelfOffers(s).map(key).join(); s.wave = 10; const b = Shop.spillShelfOffers(s).map(key).join();
  assert.notEqual(a, b, 'the next Depot shows a different pair');
}

// one slot before wave 10, two after
{ const s = depot(5), [first, second] = Shop.spillShelfOffers(s);
  assert.equal(Shop.spillSlotCap(s), 1);
  const ore = s.ore;
  assert.equal(Shop.spillShelfAction(s, first), 'ok'); assert.equal(s.ore, ore - Shop.spillItemPrice(first));
  assert.deepEqual(Shop.spillShelfOffers(s).map(key), [first, second].map(key), 'offers stay put after a purchase');
  if (!(first.kind === 'artifact' && second.kind === 'artifact')) assert.equal(Shop.spillShelfAction(s, second), 'full', 'the single slot is full');
  // swap, then undo: coins back and the original refitted
  const mid = s.ore;
  assert.equal(Shop.spillShelfAction(s, second, first), 'ok');
  assert(Shop.spillItemFitted(s, second) && !Shop.spillItemFitted(s, first));
  assert(Shop.spillShelfUndo(s, second)); assert.equal(s.ore, mid, 'undo refunds');
  assert(Shop.spillItemFitted(s, first), 'undo puts the replaced item back');
  assert(Shop.spillShelfUndo(s, first)); assert.equal(s.ore, ore, 'undoing everything returns every coin');
  assert.equal(Shop.spillFittedCount(s), 0);
}
{ const s = depot(10); assert.equal(Shop.spillSlotCap(s), 2, 'a second slot from wave 10');
  const [first, second] = Shop.spillShelfOffers(s);
  assert.equal(Shop.spillShelfAction(s, first), 'ok'); assert.equal(Shop.spillShelfAction(s, second), 'ok');
  assert.equal(Shop.spillFittedCount(s), first.kind === 'artifact' && second.kind === 'artifact' ? 1 : 2);
}
// closed outside an open Depot, and only offered items can be bought
{ const s = depot(5); s.depot.arm = 1; assert.equal(Shop.spillShelfAction(s, Shop.spillShelfOffers(s)[0]), 'closed');
  const t = depot(5), offered = Shop.spillShelfOffers(t).map(key);
  const other = [{ kind: 'utility', id: 'magnet' }, { kind: 'utility', id: 'scanner' }, { kind: 'artifact', id: 'siege' }, { kind: 'artifact', id: 'reclaimer' }].find(i => !offered.includes(key(i)));
  assert.equal(Shop.spillShelfAction(t, other), 'closed', 'an item not on offer cannot be bought');
  const poor = depot(5); poor.ore = 0; assert.equal(Shop.spillShelfAction(poor, Shop.spillShelfOffers(poor)[0]), 'poor');
}
// a bought artifact survives save and resume
{ const s = depot(5), art = { kind: 'artifact', id: 'siege' };
  s.combat.build.owned = []; let offers = Shop.spillShelfOffers(s);
  for (let seed = 1; !offers.some(o => o.id === 'siege') && seed < 200; seed++) { s.seed = seed; offers = Shop.spillShelfOffers(s); }
  assert.equal(Shop.spillShelfAction(s, art), 'ok');
  const restored = S.restoreSpill(S.spillCheckpoint(s), 390, 760);
  assert(restored && restored.combat.build.artifact === 'siege', 'the checkpoint keeps the bought artifact');
}
console.log('spill shop: two rotating offers, Brake retired, Battery after Pulse, 1 slot then 2 at wave 10, swap/undo refunds, checkpoint restore passed');
