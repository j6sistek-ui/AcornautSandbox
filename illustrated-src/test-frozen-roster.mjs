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

// --- and the review's complaints are actually in the table --------------
// "Awful and needs correction before shipping" / "over dive". If these
// resolve to the full ramp, the per-suit table is doing nothing.
for(const id of ['voidsuit','ember','frost','sammie','gemmie','ghost'])
  assert(D.diveDepthFor(id)<=0.5,`${id} is held to the shallow end pending regenerated art`);
for(const id of ['iontrim','copper','leviathan','cinderforge','groveguard','cosmic','sunforged','abyssal'])
  assert(D.diveDepthFor(id)<1,`${id} was called too steep on the dive and is dialled back`);

// --- a family flies ONE ramp -------------------------------------------
// Owner, 9 Sep 2026: "unique flight pattern by family". The family is the
// unit that was approved, so a later tweak must not be able to split it -
// which is exactly what would happen if someone dialled one member back
// and left the others. Every member flies the reference's depth, and every
// member is frozen if the reference is.
for(const [ref,members] of Object.entries(D.FLIGHT_FAMILIES)){
  assert(members.includes(ref),`${ref} family includes its own reference`);
  const depth=D.diveDepthFor(ref);
  for(const id of members){
    assert(ids.has(id),`${ref} family names a real suit: ${id}`);
    assert.equal(D.diveDepthFor(id),depth,
      `FAMILY: ${id} flies the same ramp as ${ref} (${depth}) - the family was approved together and cannot be split`);
    assert.equal(D.FROZEN_SUITS.includes(id),D.FROZEN_SUITS.includes(ref),
      `FAMILY: ${id} and ${ref} are frozen together`);
  }
}

// --- an unlisted suit falls through to the default ----------------------
assert.equal(D.diveDepthFor('no-such-suit'),D.POSE_DIVE_DEPTH,'an unlisted suit flies the default');

console.log(`frozen roster: ${D.FROZEN_SUITS.length} suits held, ${Object.keys(PINNED).length} pinned on the dive dial, tunable suits dialled back — ok`);
