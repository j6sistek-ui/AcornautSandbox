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
// only the frames the game plays: a ramp outranks a tap bank, so Flight's
// and Eclipse's tap frames never draw and get no row; Robo's tap bank is
// what Robo flies, so its sixteen are there
const ids=t.suits.filter(s=>s.played!==false).map(s=>s.id);
assert.deepEqual(ids.filter(i=>i.startsWith('flight-')),['flight-asc-1','flight-asc-2','flight-asc-3','flight-desc-1','flight-desc-2','flight-desc-3','flight-desc-4','flight-desc-5'],'Flight shows its 3/5 ramp and nothing else');
assert.equal(ids.filter(i=>i.startsWith('eclipse-tap-')).length,0,'Eclipse flies its ramp, not its tap bank');
assert.equal(t.suits.filter(s=>s.id.startsWith('eclipse-tap-')&&s.played===false).length,16,'but its tap anchors stay in the table for the Studio and the game');
assert.equal(ids.filter(i=>i.startsWith('robo-tap-')).length,16,'Robo flies its tap bank');
assert(t.suits.filter(s=>s.id.startsWith('flight-asc-')).every(s=>!s.seeded),'real DOME rows are not seeded');
const seeded=t.suits.filter(s=>s.seeded);
assert(seeded.every(s=>{const st=t.suits.find(x=>!x.frame&&x.id===s.id.replace(/-tap-\d+$/,''));return st&&s.dome.join()===st.dome.join();}),'seeded tap rows start on their still');
assert(t.helmets.find(h=>h.id==='clear').seat[2]===95,'HELMET_SEATS parsed');
assert(t.suits.filter(s=>!s.frame).length>=30&&t.helmets.length>=30);
console.log(`rig tables: ${t.suits.length} rows (${ids.length} played), ${t.helmets.length} helmets, ${natural.length} fixed-box suits, ${seeded.length} seeded taps passed`);
