#!/usr/bin/env node
// Regression tests for saved credit, route access and deterministic missions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const page=process.argv[2];
if(!page){
  for(const mode of ['production','beta','sample']) execFileSync(process.execPath,[fileURLToPath(import.meta.url),mode],{stdio:'inherit'});
  process.exit(0);
}
const storage=new Map();
globalThis.window={__ACORNAUT_BETA__:page!=='production',location:{href:'http://local/',search:page==='sample'?'?star-map=sample':''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>({getContext:()=>null,style:{}}),addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const C=await import('../docs/js/campaign.js'), S=await import('../docs/js/save.js'), P=await import('../docs/js/campaign-progress.js'), Sim=await import('../docs/js/sim.js'), Cat=await import('../docs/js/catalog.js'), V=await import('../docs/js/zone-visuals.js');
const plan=JSON.parse(readFileSync(new URL('./design/star-map-260.json',import.meta.url)));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex').slice(0,16);
assert.equal(C.LEVELS.length,100); assert.equal(C.ALL_LEVELS.length,260);
assert.equal(new Set(C.ALL_LEVELS.map(l=>l.id)).size,260);
assert.equal(new Set(C.ALL_LEVELS.flatMap(l=>l.objectiveIds)).size,780);
assert.equal(C.ALL_LEVELS.filter(l=>l.sample).length,30);
assert.deepEqual(C.RACE_GATES.map(g=>[g.after,g.ticks]),[[33,9000],[66,7200],[99,6120]]);
for(const def of C.ALL_LEVELS){
  assert(!('strobe' in def.fx));
  assert.equal(def.contractId,hash({base:def.base,target:def.gates,goals:def.goals}),'changed goals require a new contract');
  assert.deepEqual(def.objectiveIds,def.goals.map(goal=>`${def.variantId??def.id}:objective:${hash({base:def.base,target:def.gates,goal})}`));
  assert(Cat.ENVS[def.fx.env].planetBias.includes(V.mapPlanetIndex(def)));
  assert.equal(V.mapPlanetIndex({...def,ord:def.ord+55}),V.mapPlanetIndex(def));
}
if(page==='sample'){
  assert.equal(Cat.SAVE_KEY,'acornaut_star_map_sample_v1');assert.deepEqual(Cat.LEGACY_KEYS,[]);
  assert.equal(C.CHART_LEVELS.length,260);
  assert.equal(C.CHART_LEVELS.filter(l=>C.levelUnlocked(l,{},0,[])).length,30);
} else {
  assert.equal(C.CHART_LEVELS.length,100);
  assert.equal(C.levelById(plan.missions[100].id),null);
}
// Exercise production predicates against the whole future route, without beta bypass.
const future=C.ALL_LEVELS.map(l=>({...l,implemented:true}));let raw={},clears=[],stops=[];
for(const def of future){
  if(!C.levelUnlocked(def,raw,999,clears,future,false)){
    const g=C.gateBefore(def.ord,clears);assert(g,`unexpected lock at ${def.ord}`);stops.push(g.after);clears.push(g.after);
  }
  assert(C.levelUnlocked(def,raw,0,clears,future,false)); raw[def.id]=1;
}
assert.deepEqual(stops,[33,66,99]);assert(!C.levelUnlocked(future[60],{},780,[],future,false));
const fresh=()=>S.defaultSave(), world=()=>Sim.makeWorld(390,760);
// Existing IDs, mission targets and goals are exact, including all Spill assignments.
for(const def of C.LEVELS){
  const expected=page!=='production'&&def.base==='tunnel'?plan.betaLegacyVariants.find(l=>l.id===def.id):plan.missions.find(l=>l.id===def.id);
  assert.equal(def.base,expected.base);assert.equal(def.gates,expected.gates??expected.target.value);assert.deepEqual(def.goals,expected.goals);
}
const w=world(),s=fresh();
const random=Math.random;
try {
  for(const pal of ['none','bee']){
    s.equippedPal=pal;s.unlockedPals.push(pal); Math.random=()=>0;
    Sim.resetRun(w,s,'fly',false,C.levelById('1-1'));
    assert.equal(w.pickups.filter(p=>p.kind==='acorn').length,w.gatesSpawned,'guarantees beat optional rolls and Bee');
    assert(w.pickups.some(p=>p.kind==='gold'));assert(!w.pickups.some(p=>p.kind==='slow'||p.kind==='hole'));
    w.ready=false;w.squirrel.y=w.H+60;Sim.updateWorld(w,s,1/60);assert.equal(w.screen,'play');assert(w.lvl);
  }
} finally { Math.random=random; }
// A briefing is not a visit. The first actual frame in a pinned zone is.
const visit=fresh();Sim.resetRun(w,visit,'fly',false,C.levelById('2-1'));
assert.deepEqual(visit.zonesSeen,[]);Sim.updateWorld(w,visit,1/60);assert.deepEqual(visit.zonesSeen,[]);
w.ready=false;Sim.updateWorld(w,visit,1/60);assert(visit.zonesSeen.includes('NEBULA NURSERY'));
// Successful side goals union; a failed replay adds no stars.
const replay=fresh(),masks=[];
for(const [acorns,taps,finished] of [[4,100,true],[0,0,true],[100,0,false]]){
  Sim.resetRun(w,replay,'fly',false,C.levelById('1-2'));Object.assign(w.lvl.stats,{acorns,taps});Sim.settleLevel(w,replay,finished);
  masks.push(P.verifiedMask(replay,C.levelById('1-2')));
}
assert.deepEqual(masks,[3,7,7]);
// Ambiguous old bits preserve credit/passages but never certify current Spill goals.
const spillDef=C.LEVELS.find(l=>l.base==='spill');
let combinations=0;
for(let old=0;old<8;old++)for(let a=0;a<8;a++)for(let b=0;b<8;b++){
  const sv=fresh();sv.stars[spillDef.id]=old;P.migrateCampaign(sv);
  assert.equal(P.verifiedMask(sv,spillDef),0);
  assert.equal(P.missionCredit(sv,spillDef),C.countBits(old));
  P.settleMissionCredit(sv,spillDef,a);P.settleMissionCredit(sv,spillDef,b);
  assert.equal(P.verifiedMask(sv,spillDef),a|b);
  assert.equal(P.missionCredit(sv,spillDef),Math.max(C.countBits(old),C.countBits(a|b)));
  combinations++;
}
const legacy=fresh();for(const def of C.LEVELS)legacy.stars[def.id]=7;
legacy.raceGates=[33,66,99];legacy.purchased=['catsuit','eclipse'];legacy.unlockedSuits.push('catsuit');legacy.dustPaidTo=200;legacy.starDust=91;legacy.unknownFutureData={doNotLose:42};
storage.set(Cat.SAVE_KEY,JSON.stringify(legacy));const migrated=S.loadSave();
assert.equal(S.starsOf(migrated),300);assert.equal(P.earnedCampaignStars(migrated),300);
assert.deepEqual(migrated.raceGates,[33,66,99]);assert.deepEqual(migrated.purchased,legacy.purchased);
assert.deepEqual(migrated.unknownFutureData,legacy.unknownFutureData);
assert.equal(migrated.campaignProgress.paidRewards.length,C.STAR_REWARDS.filter(r=>r.kind==='dust'&&r.stars<=200).length);
S.writeSave(migrated);assert.deepEqual(S.loadSave(),migrated,'migration is idempotent');
assert.deepEqual(JSON.parse(storage.get(Cat.SAVE_KEY+':before-campaign-v1')),legacy);
const owned=fresh();owned.unlockedSuits.push('catsuit');assert(S.suitRevealed(owned,'catsuit'),'earned ownership survives a low star tally');
const dust=C.STAR_REWARDS.find(r=>r.kind==='dust');assert.equal(P.rewardId(dust),P.rewardId({...dust,name:'Renamed Dust reward'}));
const code=fresh();code.allStars=true;assert.equal(S.starsOf(code),300);assert.equal(P.earnedCampaignStars(code),0);assert.deepEqual(Object.values(P.routeMasks(code)),C.LEVELS.map(()=>0));
// Seeding beta from an already-versioned production save also preserves slots.
const cross=fresh(),crossDef=C.LEVELS.find(l=>l.id==='2-4');P.migrateCampaign(cross,false);
const otherId=Cat.IS_BETA?'2-4':'beta-tunnel-2-4';
cross.campaignProgress.missions[otherId]={objectives:{'other-page-goal':true},creditFloor:3,passed:true};
const crossLoaded=structuredClone(cross);
assert.equal(P.missionCredit(crossLoaded,crossDef),3);assert.equal(P.verifiedMask(crossLoaded,crossDef),0);
assert.equal(P.routeMasks(crossLoaded)['2-4'],1);
if(Cat.LEGACY_KEYS.length){
  const primary=storage.get(Cat.SAVE_KEY);storage.delete(Cat.SAVE_KEY);
  const foreign=fresh();foreign.stars['2-4']=7;storage.set(Cat.LEGACY_KEYS[0],JSON.stringify(foreign));
  const imported=S.loadSave();assert.equal(P.missionCredit(imported,crossDef),3);assert.equal(P.verifiedMask(imported,crossDef),0);
  storage.delete(Cat.LEGACY_KEYS[0]);storage.set(Cat.SAVE_KEY,primary);
}
const cached=fresh();P.migrateCampaign(cached,false);cached.stars['1-2']=7;cached.raceGates=[33];cached.dustPaidTo=200;
const cachedLoaded=structuredClone(cached);
assert.equal(P.missionCredit(cachedLoaded,C.LEVELS[1]),3);assert.equal(P.verifiedMask(cachedLoaded,C.LEVELS[1]),0);
assert.deepEqual(cachedLoaded.campaignProgress.barriers,['hyper-barrier-1']);
assert.equal(cachedLoaded.campaignProgress.paidRewards.length,C.STAR_REWARDS.filter(r=>r.kind==='dust'&&r.stars<=200).length);
// A mode replay cannot clear an unreached field, at any speed.
const race=fresh();Sim.resetRun(w,race,'fly',false,C.HYPER_RUN_MISSION);w.lvl.stats.finishTicks=6120;Sim.settleLevel(w,race,true);assert.deepEqual(race.raceGates,[]);
for(const gate of C.RACE_GATES){
  P.settleMissionCredit(race,C.levelAt(gate.after),1);
  for(const ticks of [0,-1,gate.ticks+1,gate.ticks]){
    Sim.resetRun(w,race,'fly',false,C.HYPER_RUN_MISSION);w.lvl.stats.finishTicks=ticks;Sim.settleLevel(w,race,true);
    assert.equal(race.raceGates.includes(gate.after),ticks===gate.ticks);
  }
  Sim.resetRun(w,race,'fly',false,C.HYPER_RUN_MISSION);w.lvl.stats.finishTicks=6120;Sim.settleLevel(w,race,true);
  assert.equal(race.raceGates.length,C.RACE_GATES.indexOf(gate)+1);
}
for(const def of C.LEVELS.filter(l=>l.base==='spill')){
  Sim.resetRun(w,fresh(),'spill',false,{...def,ord:999});
  assert.equal(w.spill.seed,plan.missions[def.ord-1].seed.value);assert.equal(w.spill.target,def.gates);assert.deepEqual(w.spill.utilities,[]);
}
// Art randomness and display order cannot perturb the new route geometry.
const sample=C.ALL_LEVELS.find(l=>l.ord===101);
const geometry=w=>({phases:[w.driftPhase,w.tiltPhase],planets:w.planets.map(({topKind,botKind,blockers,...p})=>({...p,blockers:blockers.map(({kind,debris,...b})=>b)})),pickups:w.pickups.map(({bob,...p})=>p)});
let baseline;
try {
  for(const roll of [.01,.91]){
    Math.random=()=>roll;const w=world();Sim.resetRun(w,fresh(),sample.base,false,{...sample,ord:roll===.01?101:555});
    if(!baseline) baseline=geometry(w);else assert.deepEqual(geometry(w),baseline);
  }
} finally { Math.random=random; }
console.log(`star map ${page}: 260-route locks, 100 legacy contracts, 30 sample access, 512 credit unions, pickups, visits, first mission, replay stars, three barriers, seed/order independence passed`);
