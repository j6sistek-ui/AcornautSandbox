#!/usr/bin/env node
// Real simulation seams for the full beta campaign. Difficulty still needs human playtesting.
import assert from 'node:assert/strict';
const storage=new Map();
globalThis.window={__ACORNAUT_BETA__:true,location:{search:''},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>({getContext:()=>null}),addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const C=await import('../docs/js/campaign.js'),S=await import('../docs/js/save.js'),Sim=await import('../docs/js/sim.js'),P=await import('../docs/js/campaign-progress.js'),Sp=await import('../docs/js/spill.js'),Cat=await import('../docs/js/catalog.js');
const save=S.defaultSave();save.noPalFx=false;save.equippedPal='none';
function run(def){const w=Sim.makeWorld(390,760);Sim.resetRun(w,save,def.base,false,def);return w;}
for(let zone=0;zone<26;zone++){
 const rows=C.LEVELS.slice(zone*10,zone*10+10);
 assert.equal(rows.filter(l=>l.base==='fly').length,6);
 for(const base of ['lost','deep','arcade','spill'])assert.equal(rows.filter(l=>l.base===base).length,1);
 assert(rows.every(l=>l.fx.env===rows[0].fx.env));
}
assert.equal(C.LEVELS.filter(l=>l.base==='spill'&&l.gates>=20).length,1);
assert(C.LEVELS.filter(l=>l.base==='spill'&&l.gates>=20).every(l=>l.ord>200));
assert.equal(C.LEVELS[7].gates,1);assert.equal(C.LEVELS[17].gates,2);
assert.equal(C.LEVELS[0].gates,8);assert(C.LEVELS[0].fx.noFail);
// Beta changes have unique contracts and opaque credit transferred from every previous ID.
for(const def of C.LEVELS.filter(l=>l.previousIds)){
 const old=S.defaultSave();P.migrateCampaign(old,false);
 const prior=def.previousIds.at(-1);
 old.campaignProgress.missions[prior]={objectives:{'old-proof':true},creditFloor:3,passed:true};
 const loaded=structuredClone(old);
 assert.equal(P.missionCredit(loaded,def),3);assert.equal(P.verifiedMask(loaded,def),0);
 assert(loaded.campaignProgress.missions[prior].objectives['old-proof']);
 assert.equal(P.routeMasks(loaded)[def.id],1);
}
// Forced pals stay in the run, including when the tester disabled loadout pal effects.
const palDef=C.LEVELS.find(l=>l.fx.pal==='pocketmoon');save.noPalFx=true;
const palWorld=run(palDef);const equipped=save.equippedPal;
Sim.flap(palWorld,save);assert.equal(Sim.runPal(save,palWorld),'pocketmoon');assert.equal(save.equippedPal,equipped);save.noPalFx=false;
// Signed world movement, no double scoring when a passed gate is revisited,
// no difficulty increase from flying back over the same distance.
const reverseDef=C.LEVELS.find(l=>l.fx.pal==='switchback');const rev=run(reverseDef);
Sim.flap(rev,save);assert.equal(rev.scrollDirection,1);
let x=rev.planets[0].x;Sim.updateWorld(rev,save,1/60);assert(rev.planets[0].x<x);
rev.planets[0].scored=true;const count=rev.score,travel=rev.distance;
Sim.flap(rev,save);assert.equal(rev.scrollDirection,-1);x=rev.planets[0].x;
Sim.updateWorld(rev,save,1/60);assert(rev.planets[0].x>x);assert.equal(rev.distance,travel);assert.equal(rev.score,count);
rev.screen='pause';Sim.flap(rev,save);assert.equal(rev.scrollDirection,-1);rev.screen='play';
Sim.flap(rev,save);assert.equal(rev.scrollDirection,1);
Sim.resetRun(rev,save,'fly',false,reverseDef);assert.equal(rev.scrollDirection,-1);
// Slow toggles are independent of pickup duration and restore on reset.
const frozen=run(C.LEVELS.find(l=>l.fx.tapFreeze));Sim.flap(frozen,save);assert(frozen.tapFrozen);
const slowX=frozen.planets[0].x;Sim.updateWorld(frozen,save,1/60);const slowMove=slowX-frozen.planets[0].x;
Sim.flap(frozen,save);assert(!frozen.tapFrozen);const fastX=frozen.planets[0].x;Sim.updateWorld(frozen,save,1/60);
assert(fastX-frozen.planets[0].x>slowMove*1.5);
// Actual collision, not an injected stuck flag, pauses until the accepted tap.
function contact(def){
 const w=run(def),sx=w.W*Cat.PHYS.squirrelX,r=62,gap=220,y=w.H*.5,center=y+50;
 w.ready=false;w.squirrel.y=y;w.squirrel.vy=360;w.lastSpawnX=100000;w.pickups=[];
 w.planets=[{x:sx+1,gapY:center-gap/2-r,gap,r,topKind:0,botKind:0,scored:false,drift:0,driftAmp:0,blockers:[]}];
 let event;for(let i=0;i<4&&event!=='bounce';i++)event=Sim.updateWorld(w,save,1/120);
 assert.equal(event,'bounce');return w;
}
const sticky=contact(C.LEVELS.find(l=>l.fx.sticky));assert(sticky.stuck);assert.equal(sticky.lvl.stats.bounces,1);
const still=[sticky.planets[0].x,sticky.squirrel.y];for(let i=0;i<120;i++)Sim.updateWorld(sticky,save,1/60);
assert.deepEqual([sticky.planets[0].x,sticky.squirrel.y],still);Sim.flap(sticky,save);assert(!sticky.stuck);Sim.updateWorld(sticky,save,1/60);assert(sticky.planets[0].x<still[0]);
const springDef=C.LEVELS.find(l=>l.fx.bounceScale);const spring=contact(springDef),normal=contact({...springDef,fx:{...springDef.fx,bounceScale:1}});
assert(Math.abs(spring.squirrel.vy)>Math.abs(normal.squirrel.vy));
// Simulate every mission's real completion seam. Flight reaches its portal,
// wave missions drain their field, and objective missions observe run counters.
for(const def of C.LEVELS){
 const w=run(def);w.ready=false;
 if(w.spill){
  const s=w.spill;
  if(def.spillFinish){
   s.phase='depot';s.depot={arm:0,bought:[]};s.hull=s.maxHull;
   if(def.spillFinish.kind==='ore')s.oreMined=def.spillFinish.n;else s.depotVisits=def.spillFinish.n;
  }else{s.phase='drain';s.wave=def.gates;s.rocks=[];s.nuts=[];s.phaseT=100;}
  for(let i=0;i<120&&w.screen==='play';i++)Sim.updateWorld(w,save,1/60);
 }else{
  w.warpT=0;w.warpLeft=0;w.deepTimer=0;w.planets=[];w.lastSpawnX=100000;w.score=def.gates;
  w.pickups=[{x:w.W*Cat.PHYS.squirrelX,y:w.squirrel.y,got:false,bob:0,kind:'portal',r:64}];
  Sim.updateWorld(w,save,1/60);
 }
 assert.equal(w.screen,'lvldone',`completion failed at ${def.ord} ${def.base}`);
 assert(P.verifiedMask(save,def)&1);
}
// Objective missions cannot become resumable endless saves or pass on lethal hits.
const oreDef=C.LEVELS.find(l=>l.spillFinish?.kind==='ore');const dead=run(oreDef);dead.ready=false;
dead.spill.oreMined=oreDef.spillFinish.n;dead.spill.phase='over';dead.spill.hull=0;dead.spill.deadFor=0;
assert.equal(Sp.spillCheckpoint(dead.spill),null);Sim.updateWorld(dead,save,1/60);assert.notEqual(dead.screen,'lvldone');
// Repairs count only successful purchases; a full-hull attempt is not a repair.
const ship=Sp.createSpill(390,760,123,0,false);ship.phase='depot';ship.depot={arm:0,bought:[]};ship.ore=1000;
assert.notEqual(Sp.spillBuy(ship,'repair'),'ok');assert.equal(ship.repairs,0);
ship.hull=1;assert.equal(Sp.spillBuy(ship,'repair'),'ok');assert.equal(ship.repairs,1);
assert.equal(C.goalMet({kind:'repairs',n:1},{...C.emptyStats(),repairs:ship.repairs}),true);
const imported=S.defaultSave();imported.betaDustGrant=true;imported.starDust=87;
const archive=S.defaultSave();archive.stars['1-2']=7;archive.unlockedSuits.push('catsuit');
archive.raceGates=[33];archive.starDust=999999;
storage.set('acornaut_illust_beta',JSON.stringify(imported));storage.set('acornaut_star_map_sample_v1',JSON.stringify(archive));
const importedSave=S.loadSave();assert.equal(P.missionCredit(importedSave,C.levelAt(2)),3);assert.equal(P.verifiedMask(importedSave,C.levelAt(2)),0);
assert(importedSave.unlockedSuits.includes('catsuit'));assert.deepEqual(importedSave.raceGates,[33]);assert.equal(importedSave.starDust,87);
S.writeSave(importedSave);assert.deepEqual(S.loadSave(),importedSave);assert.deepEqual(JSON.parse(storage.get('acornaut_star_map_sample_v1')),archive);
console.log('beta campaign: 260 completion seams, 26 mode mixes, 259 migrations, reversal/no double score, sticky contact/release, spring bounce, tap slow, Spill objectives and repair receipts passed');
