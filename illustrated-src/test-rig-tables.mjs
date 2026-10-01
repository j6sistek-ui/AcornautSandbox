#!/usr/bin/env node
// The rig editor's tables mirror the game. Three things that went wrong
// before are pinned here: the nine fixed-box suits (the bench measured
// them and seated helmets where the Loadout does not), seeded tap rows
// (printed as sixteen identical changes), and the parse itself.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTables} from './lab/rig-tables.mjs';
const root=new URL('../',import.meta.url).pathname;
const t=buildTables(root);
const draw=readFileSync(root+'illustrated-src/game/draw.ts','utf8');
const natural=[...draw.match(/NATURAL_FLIGHT_SUITS\s*=\s*new Set\(\[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
assert(natural.length>=9,'the standard series is listed in draw.ts');
for(const s of t.suits){
  const base=s.id.replace(/-(asc|desc|tap|bounce)-\d+$/,'');
  if(natural.includes(base))assert.deepEqual(s.box,[32,32,192,192],`${s.id} carries the game's fixed box`);
  else assert.equal(s.box,null,`${s.id} is measured like the game measures it`);
}
const still=t.suits.find(s=>s.key==='suit:flight');assert(still&&!still.frame);
const tap=t.suits.filter(s=>s.id.startsWith('flight-tap-'));
assert.equal(tap.length,16,'Flight taps are seeded for review');
assert(tap.every(s=>s.seeded&&s.dome.join()===still.dome.join()),'seeded tap rows start on the still');
assert(t.suits.filter(s=>s.id.startsWith('flight-asc-')).every(s=>!s.seeded),'real DOME rows are not seeded');
assert(t.helmets.find(h=>h.id==='clear').seat[2]===95,'HELMET_SEATS parsed');
assert(t.suits.filter(s=>!s.frame).length>=30&&t.helmets.length>=30);
console.log(`rig tables: ${t.suits.length} rows, ${t.helmets.length} helmets, ${natural.length} fixed-box suits, seeded taps flagged passed`);
