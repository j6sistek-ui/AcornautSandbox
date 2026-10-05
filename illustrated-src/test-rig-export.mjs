#!/usr/bin/env node
// The rig editor's COPY prints EVERY changed row, and a draft survives a
// build bump. Pure half only: no DOM, no art.
import assert from 'node:assert/strict';
import {buildTables} from './lab/rig-tables.mjs';
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
globalThis.window={};
const {_rigInternals}=await import('../docs/lab/rig/js/rig.js');
const R=_rigInternals();
const fresh=()=>{const t=buildTables(new URL('../',import.meta.url).pathname);R.S.tables=t;R.S.base=JSON.parse(JSON.stringify(t));R.S.legacy={};R.S.draftVer='';};
fresh();R.S.row='suit:flight';R.S.suit='flight';R.S.helm='clear';R.S.target='head';R.S.reach='suit';
assert.equal(R.reportTS(),'// nothing changed yet');
// a whole-suit nudge: every real Flight row changes, the seeded taps do not print
R.moveHead(3,-2);R.sizeHead(0.8);
const c=R.changes();
const flightRows=R.rowsOfSuit('flight').filter(s=>!s.seeded);
assert.equal(c.suits.length,flightRows.length,'every real Flight row is a change');
assert(c.suits.every(s=>s.key.startsWith('suit:flight')||s.key.startsWith('flight-')));
const ts=R.reportTS();
for(const s of flightRows)assert(ts.includes(`"${s.key}":`),`${s.key} printed`);
assert(!ts.includes('flight-tap-'),'seeded tap rows that still match the still are not printed');
assert.equal(ts.split('\n').length,1+flightRows.length,'one header, one line per row');
// then one frame on its own, and the still moved away from the taps
R.S.reach='frame';R.S.row='flight-asc-2';R.moveHead(0,5);
assert(R.reportTS().includes('"flight-asc-2"'));
R.S.row='suit:flight';R.moveHead(1,0);
assert.equal(R.changes().suits.length,flightRows.length,'still the same rows: Flight has no tap rows because the game never plays its tap bank');
// a suit whose tap bank IS what it flies lists those frames, and they move with the suit
R.S.row='suit:robo';R.S.suit='robo';R.S.reach='suit';R.moveHead(0,1);
assert.equal(R.changes().suits.filter(s=>s.key.startsWith('robo-tap-')).length,16,'Robo tap frames move with the still');
// the cavity prints under its own header
R.S.target='cavity';R.moveCavity(2,0);
assert(/HELMET_SEATS\n  clear: \[132,128,95\]/.test(R.reportTS()),'cavity row printed');
// a draft from another build is WORN, not thrown away
const draft={artVer:'1',suits:{'suit:flight':[150,90,30]},helmets:{},over:{'flight|lunar':[1,2,0,0]}};
store.clear();store.set('acornaut.rig.v1',JSON.stringify(draft));
fresh();R.restoreLocal();
assert.deepEqual(R.S.tables.suits.find(s=>s.key==='suit:flight').dome,[150,90,30],'old-editor draft picked up');
assert.equal(R.S.draftVer,'1','and its build remembered');
assert(store.has('acornaut.rig.v2')&&!store.has('acornaut.rig.v1'),'migrated to the new key once');
const rep=R.reportTS();
assert(rep.startsWith('// dialled on art v1;'),'report says which build the draft came from');
assert(rep.includes('"suit:flight": [150, 90, 30]')&&rep.includes('flight|lunar'),'draft row and legacy override both reported');
console.log('rig export: every changed row printed, seeded taps only once they differ, drafts survive a build bump and the old editor passed');
