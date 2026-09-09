#!/usr/bin/env node
/** COLLECTING ACORNUT STICKS.
 *
 *  Owner, 8 Sep 2026: "i still have to collect acornut everytime i load in."
 *
 *  AcorNut is the 570-star prize, and the shelf card for a revealed, unowned,
 *  free suit is a reward: it prints COLLECT REWARD and the tap that reads as
 *  "equip" everywhere else is the collection. That tap writes the suit's id
 *  into `unlockedSuits` - and loadSave tore that exact entry back out on
 *  every launch, unconditionally, so the card came back to be collected again
 *  the next time the game opened. Forever.
 *
 *  The strip is not wrong to exist. It refuses an entry nobody earned: a beta
 *  grant, an old free unlock, a hand-edited save. What it could never do was
 *  ask whether the entry was earned, because suitRevealed - the only question
 *  in the file - answers "yes" partly BECAUSE the entry is in the list. So
 *  the strip judged every entry guilty, the honest one included.
 *
 *  What is asserted here is the full round trip, on both pages:
 *
 *    * a fresh pilot has no AcorNut, and the road has not revealed him
 *    * at 570 stars he is REVEALED but not yet OWNED - one Collect Reward
 *    * the collect survives a save/load round trip, and a second, and a third
 *    * an entry with no stars behind it is still stripped
 *    * graduation still takes back the tutorial's borrowed suit...
 *    * ...but never from a pilot who has already earned him outright
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const page = process.argv[2];
if (!page) {
  for (const mode of ['production', 'beta']) execFileSync(process.execPath, [fileURLToPath(import.meta.url), mode], {stdio: 'inherit'});
  process.exit(0);
}

const storage = new Map();
globalThis.window = {__ACORNAUT_BETA__: page !== 'production', location: {href: 'http://local/', search: ''},
  devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({matches: false, addEventListener() {}})};
globalThis.document = {createElement: () => ({getContext: () => null, style: {}}), addEventListener() {}, documentElement: {style: {}}};
globalThis.localStorage = {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k)};

const S = await import('../docs/js/save.js');
const C = await import('../docs/js/campaign.js');
const Cat = await import('../docs/js/catalog.js');

const NUT = Cat.TUTORIAL_SUIT;
const GATE = C.STAR_UNLOCKS.suits[NUT];
const beta = page !== 'production';
const say = m => `${page}: ${m}`;

assert.equal(NUT, 'vanguard');
assert.equal(GATE, 570, 'AcorNut is the 570-star prize');

/** wipe the slot and load whatever `seed` describes, exactly as a launch would */
function launch(seed) {
  storage.clear();
  if (seed) S.writeSave({...S.defaultSave(), ...seed});
  return S.loadSave();
}

// 1. A FRESH PILOT. No AcorNut in the list, and the road has not revealed
//    him - on production. The beta opens every gate by design, so it only
//    has to agree that nothing was granted outright.
{
  const s = launch(null);
  assert(!s.unlockedSuits.includes(NUT), say('a fresh save does not carry AcorNut'));
  assert.equal(S.starsOf(s), 0, say('a fresh save has no stars'));
  if (!beta) assert(!S.suitRevealed(s, NUT), say('AcorNut is locked at 0 stars'));
  assert.equal(s.equippedSuit, 'flight', say('a fresh pilot wears Flight'));
}

// 2. THE 570th STAR. Revealed, so the card is on the shelf - but NOT owned,
//    so it is still a reward with a Collect Reward tag on it. This is the
//    one load that is supposed to ask.
{
  const s = launch({allStars: true});
  assert(S.starsOf(s) >= GATE, say('allStars clears the 570-star gate'));
  assert(S.suitRevealed(s, NUT), say('AcorNut is revealed once the stars are in'));
  assert(!s.unlockedSuits.includes(NUT), say('...but not collected until the pilot taps him'));
  assert(S.tutorialSuitEarned(s), say('the stars alone make him earned'));
}

// 3. THE COLLECT, AND THE ROUND TRIP. This is the regression: the tap writes
//    the id, the save is written, the game is closed and opened - three
//    times - and the id is still there every time.
{
  const s = launch({allStars: true});
  s.unlockedSuits.push(NUT);              // exactly what the shelf tap does
  S.writeSave(s);
  for (let launchNo = 1; launchNo <= 3; launchNo++) {
    const back = S.loadSave();
    assert(back.unlockedSuits.includes(NUT),
      say(`AcorNut is still collected on launch ${launchNo} - a collect is not asked for twice`));
    assert(S.suitRevealed(back, NUT), say(`AcorNut stays revealed on launch ${launchNo}`));
    S.writeSave(back);
  }
}

// 4. AN ENTRY WITH NOTHING BEHIND IT. A hand-edited save, an old free
//    unlock, a grant from a build that handed him over: no stars, no
//    purchase, so the strip still does its job. (The beta opens every gate,
//    so there is nothing there for it to refuse.)
if (!beta) {
  const s = launch({unlockedSuits: ['flight', NUT]});
  assert(!S.tutorialSuitEarned(s), say('no stars and no receipt is not earned'));
  assert(!s.unlockedSuits.includes(NUT), say('an unearned AcorNut entry is still stripped'));
  assert(s.unlockedSuits.includes('flight'), say('the strip takes AcorNut and nothing else'));
}

// 5. A RECEIPT IS ALSO EARNED. Whatever the stars say, a suit that was
//    bought stays bought - the contract every other gate in the file keeps.
{
  const s = launch({purchased: [NUT], unlockedSuits: ['flight', NUT]});
  assert(S.tutorialSuitEarned(s), say('a purchased AcorNut is earned'));
  assert(s.unlockedSuits.includes(NUT), say('a purchased AcorNut survives the load'));
}

// 6. GRADUATION STILL TAKES THE BORROWED SUIT BACK (owner, 6 Sep 2026:
//    "immediately after the tutorial is done, he is locked"), because the
//    pilot finishing the lesson has nowhere near 570 stars.
if (!beta) {
  const s = launch(null);
  s.unlockedSuits.push(NUT);
  s.equippedSuit = NUT;
  S.grantTutorialKit(s);
  assert(!s.unlockedSuits.includes(NUT), say('graduation locks the tutorial suit'));
  assert.equal(s.equippedSuit, 'flight', say('graduation seats the pilot in Flight'));
  assert(s.unlockedSuits.includes(Cat.GUIDE_SUIT), say('graduation hands over the Ion kit'));
  assert(s.unlocked.includes(Cat.GUIDE_HELM), say('graduation hands over the Ion helmet'));
}

// 7. ...BUT IT HAS NOTHING TO TAKE FROM A PILOT WHO ALREADY EARNED HIM.
//    Replaying the lesson at 570 stars must not confiscate the prize.
{
  const s = launch({allStars: true});
  s.unlockedSuits.push(NUT);
  S.grantTutorialKit(s);
  assert(s.unlockedSuits.includes(NUT), say('graduation cannot confiscate an earned AcorNut'));
}

console.log(`acornut-collect ${page}: ok`);
