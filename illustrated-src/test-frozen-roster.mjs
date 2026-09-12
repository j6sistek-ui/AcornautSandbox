#!/usr/bin/env node
/** EVERY SUIT IS ITS OWN. Three rules, and deliberately no fourth.
 *
 *  Owner, 10 Sep 2026: "right now, every suit is its own. needs to be
 *  coded. so changing a value in one place doesn't force everyone to
 *  change." The failure being prevented is named in the same message:
 *  "the changing of these values based on an issue i report and applying
 *  is globally without verify it actually solved anything and silently
 *  breaking things, keeping them separated helps."
 *
 *  So this file is about ISOLATION, not conformity. It used to also assert
 *  that families flew one shared ramp and that every frozen suit fell into
 *  one of three mechanisms. Both are gone: the first pushed suits toward
 *  each other, which is the opposite of the ask, and the second would have
 *  failed a frozen suit that simply worked some new way.
 *
 *  What it checks now:
 *
 *    1. NEW CHARACTERS GO TO BETA FIRST - the one rule set for new work.
 *       Checked first, because a new suit trips several of these at once
 *       and this is the one worth hearing.
 *    2. ISOLATION - every shipped suit carries its own dive value, so no
 *       edit can fan out to a suit nobody was looking at.
 *    3. THE FREEZE - the fourteen named suits are real, and the eight that
 *       ride the dial still resolve to the value they were approved on.
 *    4. THE TRIO - eclipse, cryostar and verdant are a PREFERENCE. If one
 *       moves, this asks the owner rather than deciding; splitting them is
 *       allowed, it just has to be deliberate. It speaks after the freeze,
 *       which is the right moment: once a change to one IS approved, this
 *       is what asks about the other two.
 *
 *  Flight METHOD is not checked at all, on purpose: "standardization's
 *  hard when the perfect method hasn't been discovered yet ... nothing
 *  screams use only this one.. so don't gate it."
 */
import assert from 'node:assert/strict';
globalThis.window={location:{href:'http://local/'},devicePixelRatio:1,
  addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>({getContext:()=>null,style:{}}),
  addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};

const D=await import('../docs/js/draw.js');
const Cat=await import('../docs/js/catalog.js');
const Control=await import('../docs/js/control-constants.js');
const Sim=await import('../docs/js/sim.js');
const S=await import('../docs/js/save.js');

const ids=new Set(Cat.SUITS.map(u=>u.id));

// --- 1. A NEW CHARACTER SHIPS TO BETA FIRST -----------------------------
// Owner, 10 Sep 2026, asked for exactly one rule on new work: "a brand new
// character always loads to beta the first time, never direct to main. need
// to get confirmation it works well before loading live. that's it."
//
// The mechanism already existed - catalog.ts splices any suit carrying
// `beta` out of the live build - so the rule is just that a new id arrives
// with that flag and loses it once the owner has flown it. LIVE_SUITS is
// that confirmation, written down: a suit is here because it has been seen
// working on the live page, not because it compiled.
//
// Adding a suit therefore fails this once, with a choice: mark it `beta`
// (the rule), or add it here (the owner has confirmed it). Nothing else in
// this file cares what the new suit does or how it flies.
const LIVE_SUITS=new Set(['vanguard','flight','iontrim','copper','frost','voidsuit','ember','ghost',
  'robo','alien','bigbooty','volt','cyber','cryostar','verdant','eclipse',
  'gemmie','sammie','seraph','leviathan','arcflash',
  'catsuit','briellacat','raccoon','ferret','hedgehog',
  'cinderforge','groveguard','cosmic','sunforged','abyssal',
  'porcelain','nacre','origamist']);
const straightToLive=Cat.SUITS.filter(u=>!u.beta&&!LIVE_SUITS.has(u.id)).map(u=>u.id);
assert.deepEqual(straightToLive,[],
  `new to the live catalogue and never confirmed on the live page: ${straightToLive.join(', ')}. `+
  `A brand new character goes to BETA first - set \`beta: true\` on it in catalog.ts. `+
  `Once the owner has flown it and confirmed it works, drop the flag and add the id to `+
  `LIVE_SUITS here.`);
// A suit cannot be both: an id retired back to beta simply leaves LIVE_SUITS.
const both=Cat.SUITS.filter(u=>u.beta&&LIVE_SUITS.has(u.id)).map(u=>u.id);
assert.deepEqual(both,[],`beta-only but still listed as confirmed live: ${both.join(', ')}`);

// --- 2. ISOLATION: nobody rides a shared number -------------------------
// This is the whole point of the file. A suit with no line of its own falls
// through to POSE_DIVE_DEPTH, and then one edit moves it along with every
// other suit in the same position - silently, and usually while someone is
// fixing something else entirely.
const orphans=Cat.SUITS.map(u=>u.id).filter(id=>typeof D.SUIT_DIVE_DEPTH[id]!=='number');
assert.deepEqual(orphans,[],
  `these suits have no dive value of their own and would move whenever the shared `+
  `default moves - give each one its own line in SUIT_DIVE_DEPTH: ${orphans.join(', ')}`);

// --- 3. THE FREEZE ------------------------------------------------------
// Owner, 9 Sep 2026: these "need to be frozen untouchable while tweaking
// other suits", clarified 10 Sep as "i wanted acornut frozen, and others so
// your changes didn't adjust them". It protects them from an integrator's
// hand, not from the owner's - a deliberate retune updates the line below
// and says so.
for(const id of D.FROZEN_SUITS) assert(ids.has(id),`frozen roster names a real suit: ${id}`);
assert.equal(D.FROZEN_SUITS.length,14,'the owner froze fourteen suits');

const PINNED={flight:1,alien:1,cyber:1,eclipse:1,seraph:1,briellacat:1,
  // "verdant and cryostar now exactly match eclipse and can be locked"
  cryostar:1,verdant:1};
for(const [id,want] of Object.entries(PINNED)){
  assert(D.FROZEN_SUITS.includes(id),`${id} is on the frozen roster`);
  assert.equal(D.diveDepthFor(id),want,
    `FROZEN: ${id} still flies the dive depth it was approved on (${want}) - do not change without the owner saying so`);
}

// --- 4. THE TRIO IS A PREFERENCE, AND THIS IS THE PROMPT ----------------
// Owner, 10 Sep 2026: "eclipse, verdant, cryo should remain as similar as
// possible, and any change to one should prompt the integrator to ask me if
// i should apply to all 3."
//
// So this is not a weld - each of the three has its own line like everyone
// else, and they are allowed to diverge. It is the ASK, made unmissable, so
// a change to one cannot land quietly on the assumption that the other two
// were considered.
for(const id of D.MATCHED_TRIO) assert(ids.has(id),`MATCHED_TRIO names a real suit: ${id}`);
const trio=D.MATCHED_TRIO.map(id=>[id,D.diveDepthFor(id)]);
const spread=new Set(trio.map(([,v])=>v));
assert.equal(spread.size,1,
  `eclipse, cryostar and verdant have drifted apart: ${trio.map(([id,v])=>`${id}=${v}`).join(', ')}. `+
  `The owner asked to be ASKED before these three diverge - "any change to one should prompt the `+
  `integrator to ask me if i should apply to all 3". If the split is deliberate and approved, `+
  `update MATCHED_TRIO in draw.ts to drop whichever one is going its own way.`);

// --- 5. A FROZEN SUIT'S REPEAT TAP REWINDS, AND NOTHING QUEUES IT --------
// Owner, 12 Sep 2026, after PR #277 made a repeat tap on all 24 painted
// banks finish the gesture instead of rewinding it - frozen suits included,
// and nothing here noticed because this file only pinned dive depth: "a new
// tap isn't driving anymore ... take the 8 frozen out. revert it on those."
// (The roster is fourteen, twelve of them painted; all twelve are out.)
// So the freeze now covers the tap clock: no frozen suit is on the queue
// roster, and a second tap mid-gesture reverses the picture on every one.
const queuedFrozen=D.FROZEN_SUITS.filter(id=>Control.PAINTED_TAP_SUITS.has(id));
assert.deepEqual(queuedFrozen,[],
  `frozen suits on the repeat-tap queue roster: ${queuedFrozen.join(', ')}. A frozen suit `+
  `REWINDS on a repeat tap, as it did when it was approved - take it out of PAINTED_TAP_SUITS `+
  `in control-constants.ts. The owner decides which suits get the queue, from the beta pause sheet.`);
function secondTap(id){
  const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done'});
  const w=Sim.makeWorld(390,844);Sim.resetRun(w,save,'fly',false);
  w.planets=[];w.debris=[];w.pickups=[];w.invulnLeft=999;w.screen='play';w.ready=false;
  assert.equal(Sim.flap(w,save),'flap',`${id}: first tap`);
  for(let i=0;i<10;i++)Sim.updateWorld(w,save,1/60);
  assert.equal(Sim.flap(w,save),'flap',`${id}: second tap`);
  return {dir:w.tapAnimDir,queued:w.tapAnimQueued};
}
for(const id of D.FROZEN_SUITS){
  if(id==='vanguard'||id==='arcflash')continue;   // their own controllers, no bank clock
  const r=secondTap(id);
  assert.equal(r.dir,-1,`FROZEN: ${id} rewinds on a repeat tap (got dir ${r.dir})`);
  assert.equal(r.queued,false,`FROZEN: ${id} never queues a replay`);
}
// and the rule is really per-suit: a queue-roster suit still queues on the live page
{
  const id=[...Control.PAINTED_TAP_SUITS][0],r=secondTap(id);
  assert.equal(r.queued,true,`${id} is on the queue roster and queues (live page, no toggle)`);
  assert.equal(r.dir,1,`${id} keeps playing forward while queued`);
}

// --- an unlisted id falls through to the default ------------------------
// Only reachable for something that is not a suit at all; every shipped
// suit is covered by check 1 above.
assert.equal(D.diveDepthFor('no-such-suit'),D.POSE_DIVE_DEPTH,'an unlisted id flies the default');

console.log(`Suit independence: ${Cat.SUITS.length} suits each carry their own dive value, `
  +`${D.FROZEN_SUITS.length} frozen (${Object.keys(PINNED).length} pinned), `
  +`trio matched at ${trio[0][1]}, ${LIVE_SUITS.size} confirmed live, no new suit bypassing beta, `
  +`${Control.PAINTED_TAP_SUITS.size} on the repeat-tap queue roster and no frozen suit among them`);
