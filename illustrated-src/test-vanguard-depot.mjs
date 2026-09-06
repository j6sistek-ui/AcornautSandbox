import assert from 'node:assert/strict';
globalThis.window={location:{href:'http://local/'},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const S=await import('../docs/js/spill.js');
const G=await import('../docs/js/spill-depot-gag.js');
const Save=await import('../docs/js/save.js'),Sim=await import('../docs/js/sim.js');
const ticks=(s,n)=>{const cues=[];for(let i=0;i<n;i++)cues.push(...S.stepSpill(s,1/60));return cues;};
for(const suit of ['vanguard','flight','eclipse','robo','cat'])for(const motionOff of [false,true])for(const ready of [false,true])
  assert.equal(G.vanguardDepotEligible(suit,motionOff,ready),suit==='vanguard'&&!motionOff&&ready);
for(const welcome of [false,true])for(const ready of [false,true]){
  const s=S.createSpill(390,760,7);s.phase='docking';s.welcome=welcome;s.wave=s.cleared=welcome?0:5;
  s.depotGagReady=ready;s.hull=2;s.ore=75;s.freeUpgrade=welcome;
  const travel=S.spillDockTravelDuration(s),baseTicks=Math.round(travel*60);
  const cues=ticks(s,baseTicks-1);assert.equal(s.phase,'docking');assert.equal(s.depotGag,undefined);
  assert.equal(S.spillBuy(s,'shield'),'closed');assert(!S.spillLeaveDepot(s));
  cues.push(...ticks(s,2));
  if(ready){
    assert.equal(s.phase,'docking');assert.equal(s.depotGag,true);
    assert.equal(s.hull,2);assert.equal(s.depotVisits,0);assert.equal(s.ore,75);
    assert.equal(S.spillBuy(s,'shield'),'closed');assert.equal(S.spillCheckpoint(s),null);
    s.depotGagReady=false; // A render or load change cannot restart/shorten the latched beat.
    cues.push(...ticks(s,Math.round(G.VANGUARD_DEPOT_SECONDS*60)-3));assert.equal(s.phase,'docking');
    cues.push(...ticks(s,3));
  }
  assert.equal(s.phase,'depot');assert.equal(s.hull,3);assert.equal(s.depotVisits,welcome?0:1);
  assert.equal(s.ore,75);assert.equal(s.freeUpgrade,welcome);assert.equal(cues.filter(x=>x==='depot').length,1);
  assert.equal(S.spillBuy(s,'shield'),'arming');assert(!S.spillLeaveDepot(s));
  const cp=S.spillCheckpoint(s);assert(cp);assert(!('depotGag' in cp.state));assert(!('depotGagReady' in cp.state));
}
// Late art never inserts an animation into a visit whose touchdown already passed.
const late=S.createSpill(390,760,11);late.phase='docking';late.welcome=true;late.depotGagReady=false;
ticks(late,146);assert.equal(late.phase,'depot');late.depotGagReady=true;ticks(late,60);assert.equal(late.phase,'depot');
// Pause freezes the production simulation clock while the cameo is active.
const save=Save.defaultSave();save.equippedSuit='vanguard';save.tutorialDone=true;
const world=Sim.makeWorld(390,760);Sim.resetRun(world,save,'spill',false);world.ready=false;
world.spill.phase='docking';world.spill.welcome=true;world.spill.depotGag=true;world.spill.phaseT=3.5;
world.screen='pause';for(let i=0;i<60;i++)Sim.updateWorld(world,save,1/60);assert.equal(world.spill.phaseT,3.5);
world.screen='play';Sim.updateWorld(world,save,1/60);assert(world.spill.phaseT>3.5);
// The semantic order and the fully stowed pose precede any portal movement.
assert.equal(G.vanguardDepotPose(.3).beat,'walk');assert.equal(G.vanguardDepotPose(.9).beat,'unpack');
assert.equal(G.vanguardDepotPose(1.7).beat,'laugh');assert.equal(G.vanguardDepotPose(3.2).frame,15);
assert.equal(G.vanguardDepotPose(3.2).enter,0);assert.equal(G.vanguardDepotPose(3.8).opacity,0);
for(let t=0;t<=3.8;t+=1/120){const p=G.vanguardDepotPose(t);assert(p.frame>=0&&p.frame<16);assert(p.opacity>=0&&p.opacity<=1);}
// The extra atlas loads for Vanguard only, deduplicates, and can retry a failure.
const requests=[];let failAtlas=false;
globalThis.Image=class{
  naturalWidth=1280;naturalHeight=1280;
  set src(url){requests.push(url);queueMicrotask(()=>url.includes('vanguard-depot')&&!failAtlas?this.onload():this.onerror());}
};
const Art=await import('../docs/js/art.js');const bank=Art.emptyArt();
await Art.loadSpillScene(bank,'flight');assert(!requests.some(x=>x.includes('vanguard-depot')));
await Promise.all([Art.loadSpillScene(bank,'vanguard'),Art.loadSpillScene(bank,'vanguard')]);
assert(bank.spillScene.vanguardDepot);assert.equal(requests.filter(x=>x.includes('vanguard-depot')).length,1);
const retry=Art.emptyArt();failAtlas=true;await Art.loadSpillScene(retry,'vanguard');assert(!retry.spillScene.vanguardDepot);
failAtlas=false;await Art.loadSpillScene(retry,'vanguard');assert(retry.spillScene.vanguardDepot);
console.log('Vanguard Depot: eligibility, both arrival lengths, one-time repair/credit, input lock, arming, late/failed art, pause, beat order, checkpoint exclusion and lazy loading passed');
