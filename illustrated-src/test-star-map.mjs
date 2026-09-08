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
assert.equal(C.LEVELS.length,260); assert.equal(C.ALL_LEVELS.length,260); // the road is live on both pages (STAR_MAP_LIVE)
assert.equal(new Set(C.ALL_LEVELS.map(l=>l.id)).size,260);
assert.equal(new Set(C.ALL_LEVELS.flatMap(l=>l.objectiveIds)).size,780);
assert.equal(C.LEGACY_LEVELS.length,100);
assert.deepEqual(C.RACE_GATES.map(g=>[g.after,g.ticks]),[[33,9000],[66,7200],[99,6120]]);
for(const def of C.ALL_LEVELS){
  assert(!('strobe' in def.fx));
  if (def.previousIds) {
    assert.equal(def.contractId,hash({base:def.base,gates:def.gates,fx:def.fx,goals:def.goals,spillFinish:def.spillFinish??null}));
    assert.deepEqual(def.objectiveIds,def.goals.map((_,i)=>`${def.variantId}:${def.contractId}:${i}`));
  }
  if (!def.previousIds) assert.equal(def.contractId,hash({base:def.base,target:def.gates,goals:def.goals}),'changed goals require a new contract');
  if (!def.previousIds) assert.deepEqual(def.objectiveIds,def.goals.map(goal=>`${def.variantId??def.id}:objective:${hash({base:def.base,target:def.gates,goal})}`));
  assert(Cat.ENVS[def.fx.env].planetBias.includes(V.mapPlanetIndex(def)));
  assert.equal(V.mapPlanetIndex({...def,ord:def.ord+55}),V.mapPlanetIndex(def));
}
// Owner-authored table pass (7 Sep 2026): the first 100 levels and every
// non-Free mode follow the core curve. PAL effects remain runtime behavior.
const pct=(n,share)=>Math.max(1,Math.round(n*share+1e-9));
for(const def of C.ALL_LEVELS.filter(d=>d.ord!==1&&!['spill','tunnel','race'].includes(d.base)&&(d.base!=='fly'||d.ord<=100))){
  const band=Math.floor((def.stage-1)/5),basePace=.91+.035*band,opening=1.18-.025*band;
  let pace=basePace,gap=opening;
  if(def.base==='fly'){
    if(def.n===3)pace=basePace+.15;else if(def.n===5)pace=.96;else if(def.n===10)pace=1+.03*band;
  }else if(def.base==='lost')gap=opening+.1;
  else if(def.base==='deep')gap=opening+.08;
  else if(def.base==='arcade')pace=.96+.025*band;
  assert.equal(def.fx.pace,Number(pace.toFixed(3)),`level ${def.ord} pace follows ${def.base}`);
  assert.equal(def.fx.gapScale,Number(gap.toFixed(3)),`level ${def.ord} opening follows ${def.base}`);
  assert.equal(def.fx.driftScale,Number((.8+.13*((def.stage-1)%5)).toFixed(3)),`level ${def.ord} sway follows its field`);
  assert.equal(def.fx.driftRate,undefined,`level ${def.ord} uses core sway speed`);
}
const expandedFreeTuning=stage=>{const early=Math.max(0,Math.min(9,stage-11)),late=Math.max(0,stage-20);return{pace:Number((1+.2*early/9+.01*late).toFixed(3)),gapScale:Number((1.1-.2*early/9-.01*late).toFixed(3)),driftScale:Number((1+.2*early/9+.02*late).toFixed(3))}};
const expandedAcornAccuracy=stage=>stage<=20?1+.2*Math.max(0,stage-11)/9:1+.2*Math.max(0,stage-21)/5;
for(const def of C.ALL_LEVELS.filter(d=>d.ord>100&&d.base==='fly')){
  const standard=def.stage*10,cap=def.ord<=200?100:200,g=def.n===10?pct(standard,.5):cap,tuning=expandedFreeTuning(def.stage),accuracy=expandedAcornAccuracy(def.stage),acorns=share=>pct(g,share*accuracy);
  if(def.n===1)assert.deepEqual(def.goals,[{kind:'finish'},{kind:'acorns',n:acorns(.5)},{kind:'gold',n:3}]);
  else if(def.n===2)assert.deepEqual(def.goals,[{kind:'finish'},{kind:'acorns',n:acorns(.5)},{kind:'acorns',n:acorns(.65)}]);
  else if(def.n===3)assert.deepEqual(def.goals,[{kind:'finish'},{kind:'acorns',n:acorns(.25)},{kind:'maxTaps',n:g*4}]);
  else if(def.n===4)assert.deepEqual(def.goals,[{kind:'finish'},{kind:'acorns',n:acorns(.3)},{kind:'bounces',n:pct(g,.15)}]);
  else if(def.n===5)assert.deepEqual(def.goals,[{kind:'finish'},{kind:'acorns',n:acorns(.5)},{kind:'noShield'}]);
  else if(def.n===10){assert.deepEqual(def.goals,[{kind:'finish'},{kind:'finish'},{kind:'finish'}]);assert.equal(def.fx.fog,1);}
  else assert.fail(`unexpected expanded Free Flight slot ${def.ord}/${def.n}`);
  assert.equal(def.gates,g,`level ${def.ord} gate cap`);
  assert.equal(def.fx.pace,tuning.pace,`level ${def.ord} expanded pace`);
  assert.equal(def.fx.gapScale,tuning.gapScale,`level ${def.ord} expanded opening`);
  assert.equal(def.fx.driftScale,tuning.driftScale,`level ${def.ord} expanded sway`);
  assert.equal(def.fx.driftRate,undefined,`level ${def.ord} uses core sway speed`);
  assert(!def.fx.upsideDown&&!def.fx.tapFreeze&&!def.fx.sticky,`level ${def.ord} retired encounter toggles stay retired`);
}
const ownerRewards=[
  [168,'helmet','sammie'],[198,'suit','sammie'],[210,'pal','magnetar'],[318,'trail','phoenixplume'],
  [438,'trail','opalfeather'],[588,'trail','opalfeather'],[597,'acorns',undefined,1000],
  [528,'pal','astrafox'],[648,'pal','satellite'],[708,'pal','switchback'],
  [738,'helmet','gemmie'],[768,'suit','gemmie'],[774,'dust',undefined,200],
];
for(const [stars,kind,id,amount] of ownerRewards){
  const reward=C.STAR_REWARDS.find(r=>r.stars===stars&&r.kind===kind&&r.id===id);
  assert(reward,`owner reward ${stars}/${kind}/${id??''} exists`);if(amount)assert.equal(reward.amount,amount);
}
assert.equal(C.STAR_UNLOCKS.trails.opalfeather,438,'the first duplicate reward rung unlocks the item');
if(page!=='production'){
  assert.equal(Cat.SAVE_KEY,'acornaut_illust_beta');
  assert.equal(C.CHART_LEVELS.length,260);
  assert.equal(C.CHART_LEVELS.filter(l=>C.levelUnlocked(l,{},0,[])).length,260);
} else {
  // production flies the whole road and EARNS it: mission 1 open, mission 2 shut until 1 is passed
  assert.equal(C.CHART_LEVELS.length,260);
  assert.notEqual(C.levelById(plan.missions[100].id),null);
  assert(C.levelUnlocked(C.CHART_LEVELS[0],{},0,[])); assert(!C.levelUnlocked(C.CHART_LEVELS[1],{},0,[]));
  assert.equal(C.CHART_LEVELS.filter(l=>C.levelUnlocked(l,{},0,[])).length,1);
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
if(page==='production'){
  const saveAt=total=>{const s=fresh();P.migrateCampaign(s,false);for(let i=0;i<total/3;i++)P.settleMissionCredit(s,C.LEVELS[i],7);return s;};
  assert(!S.helmetRevealed(saveAt(165),'sammie'));assert(S.helmetRevealed(saveAt(168),'sammie'));
  assert(!S.suitRevealed(saveAt(195),'sammie'));assert(S.suitRevealed(saveAt(198),'sammie'));
  assert(!S.palUnlocked(saveAt(207),'magnetar'));assert(S.palUnlocked(saveAt(210),'magnetar'));
  assert(!S.trailUnlocked(saveAt(435),'opalfeather'));assert(S.trailUnlocked(saveAt(438),'opalfeather'));
}
// Existing IDs, mission targets and goals are exact, including all Spill assignments.
for(const def of C.LEGACY_LEVELS){
  const expected=def.base==='tunnel'?plan.betaLegacyVariants.find(l=>l.id===def.id):plan.missions.find(l=>l.id===def.id);
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
for(const [acorns,taps,gold,finished] of [[100,100,0,true],[0,0,3,true],[100,0,3,false]]){
  Sim.resetRun(w,replay,'fly',false,C.levelById('1-1'));Object.assign(w.lvl.stats,{acorns,taps,gold});Sim.settleLevel(w,replay,finished);
  masks.push(P.verifiedMask(replay,C.levelById('1-1')));
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
const legacy=fresh();for(const def of C.LEGACY_LEVELS)legacy.stars[def.id]=7;
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
for(const def of C.LEGACY_LEVELS.filter(l=>l.base==='spill')){
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
console.log(`star map ${page}: 260-route locks, 100 legacy contracts, full beta access, 512 credit unions, pickups, visits, first mission, replay stars, three barriers, seed/order independence passed`);

