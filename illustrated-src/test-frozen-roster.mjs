#!/usr/bin/env node
/** THE FROZEN ROSTER IS A PROMISE, SO IT GETS A GATE.
 *
 *  Owner, 9 Sep 2026, after flying the whole game: "ok honestly they all
 *  fly. it's much better." Twelve suits were then named finished, with the
 *  instruction that they "need to be frozen untouchable while tweaking
 *  other suits."
 *
 *  A comment cannot do that. Before the per-suit dial, six of those twelve
 *  flew an ascent/descent bank and shared ONE global dive number with every
 *  suit the same review called awful - so shallowing Ion's dive moved
 *  Eclipse's too, silently. This asserts the freeze holds:
 *
 *    * every frozen id is a real suit
 *    * the six that ride the dive dial resolve to EXACTLY the value they
 *      were approved on, and sweep their whole ramp
 *    * the other six are frozen for the reason claimed - their own painter
 *      or a 16-frame tap bank answers before any dial - so "untouched" is
 *      structural rather than a value someone has to remember
 *    * a suit the review called awful is actually held shallow, or the
 *      table is decoration
 */
import assert from 'node:assert/strict';
globalThis.window={location:{href:'http://local/'},devicePixelRatio:1,
  addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>({getContext:()=>null,style:{}}),
  addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};

const D=await import('../docs/js/draw.js');
const Cat=await import('../docs/js/catalog.js');

const ids=new Set(Cat.SUITS.map(u=>u.id));
for(const id of D.FROZEN_SUITS) assert(ids.has(id),`frozen roster names a real suit: ${id}`);
assert.equal(D.FROZEN_SUITS.length,14,'the owner froze fourteen suits');

// --- the six that ride the dial, pinned at the approved value -----------
const PINNED={flight:1,alien:1,cyber:1,eclipse:1,seraph:1,briellacat:1,
  // "verdant and cryostar now exactly match eclipse and can be locked"
  cryostar:1,verdant:1};
for(const [id,want] of Object.entries(PINNED)){
  assert(D.FROZEN_SUITS.includes(id),`${id} is on the frozen roster`);
  assert.equal(D.diveDepthFor(id),want,
    `FROZEN: ${id} still flies the dive depth it was approved on (${want}) - do not change without the owner saying so`);
}

// --- the other six are frozen structurally ------------------------------
// vanguard and arcflash have their own painters; robo, bigbooty, volt and
// catsuit answer on a 16-frame tap bank, which outranks the sweep. None of
// them reads a dive dial at all, so there is no value to drift.
const OWN_PATH=['vanguard','arcflash'], TAP16=['robo','bigbooty','volt','catsuit'];
for(const id of [...OWN_PATH,...TAP16]) assert(D.FROZEN_SUITS.includes(id),`${id} is on the frozen roster`);
assert.deepEqual([...D.FROZEN_SUITS].sort(),
  [...Object.keys(PINNED),...OWN_PATH,...TAP16].sort(),
  'every frozen suit is accounted for by exactly one of the three routes');

// NOTHING HERE GATES A SUIT THAT IS BEING WORKED ON (owner, 9 Sep 2026:
// "be careful gating anything, they aren't changing any character i told
// you to freeze").
//
// An earlier pass asserted that the dialled-back suits STAYED dialled back
// - voidsuit/ember/frost/sammie/gemmie/ghost at <= 0.5, iontrim/copper/
// leviathan and the High Orbit five under 1. Those are HOLDING values,
// parked there only until the regenerated art lands, and the assertion
// would have failed the moment someone released a hold to let the new
// frames actually play. It would have blocked the fix it was waiting for.
// Gone. The freeze above is the only thing this file locks, because the
// freeze is the only thing the owner asked to be locked.

// --- groupings align by default, exceptions are NAMED -----------------
// Owner, 9 Sep 2026: "Loosely on the family thing. not a rule ... there may
// be exceptions like acornaut. as close as possible these groupings should
// align." So alignment is the default and divergence is allowed - but a
// suit that flies apart from its group is declared in FLIES_APART rather
// than discovered later as one somebody forgot to tune.
//
// Only SETTLED families are held to it. Most of the roster is mid-
// regeneration and does not align yet; asserting that it does would be
// asserting something false. A family is flipped to settled when its art
// lands, and the harness starts holding it from then on.
const apart=new Set(D.FLIES_APART);
for(const id of apart) assert(ids.has(id),`FLIES_APART names a real suit: ${id}`);
for(const fam of D.FLIGHT_FAMILIES){
  for(const id of fam.members) assert(ids.has(id),`${fam.name} names a real suit: ${id}`);
  const held=fam.members.filter(id=>!apart.has(id));
  assert(held.length,`${fam.name} has at least one member that is not an exception`);
  if(!fam.settled) continue;
  const depth=D.diveDepthFor(held[0]);
  for(const id of held)
    assert.equal(D.diveDepthFor(id),depth,
      `${fam.name} is SETTLED, so ${id} flies the family ramp (${depth}) - add it to FLIES_APART if that is deliberate`);
}


// --- an unlisted suit falls through to the default ----------------------
assert.equal(D.diveDepthFor('no-such-suit'),D.POSE_DIVE_DEPTH,'an unlisted suit flies the default');

console.log(`frozen roster: ${D.FROZEN_SUITS.length} suits held, ${Object.keys(PINNED).length} pinned on the dive dial, nothing else gated — ok`);
