#!/usr/bin/env node
// Real menu/engine events in happy-dom. This does not claim browser layout QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const mode=process.argv[2];
if(!mode){for(const page of ['production','beta'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),page],{stdio:'inherit'});process.exit(0);}
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM||'happy-dom');
const win=new Window({url:`http://local/${mode==='production'?'':'beta/'}${mode==='sample'?'?star-map=sample':''}`});
win.__ACORNAUT_BETA__=mode!=='production';
// happy-dom rejects valid multi-layer gradient/url background values. Record
// assignments for wiring checks; this harness does not validate browser CSS.
const backgrounds=new WeakMap();
const bg=Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype,'backgroundImage');
Object.defineProperty(win.CSSStyleDeclaration.prototype,'backgroundImage',{...bg,set(value){backgrounds.set(this,value);bg.set.call(this,value);}});
let now=0,id=0;const frames=new Map();
for(const k of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])Object.defineProperty(globalThis,k,{value:k==='window'?win:win[k],configurable:true,writable:true});
globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);win.requestAnimationFrame=requestAnimationFrame;win.cancelAnimationFrame=cancelAnimationFrame;
globalThis.Image=class {set src(v){queueMicrotask(()=>this.onerror?.());}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=()=>ctx;
win.HTMLElement.prototype.getBoundingClientRect=function(){
  const sc=this.closest('.ac-sheet-scroll');
  const isMap=this.classList.contains('ac-mapnode')||this.classList.contains('ac-zone-scene');
  const top=isMap?150+parseFloat(this.style.top||'0')-(sc?.scrollTop||0):this.classList.contains('ac-sheet-scroll')?150:0;
  const height=isMap?parseFloat(this.style.height||'70'):500;
  return {x:0,y:top,left:0,top,width:390,height,right:390,bottom:top+height};
};
win.HTMLElement.prototype.scrollIntoView=function(){const sc=this.closest('.ac-sheet-scroll');if(sc){sc.scrollTop=Math.max(0,parseFloat(this.style.top||'0')-250);sc.dispatchEvent(new win.Event('scroll'));}};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const S=await import('../docs/js/save.js'),P=await import('../docs/js/campaign-progress.js'),C=await import('../docs/js/campaign.js'),Sim=await import('../docs/js/sim.js'),Cat=await import('../docs/js/catalog.js'),V=await import('../docs/js/zone-visuals.js');
const save=S.defaultSave();Object.assign(save,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true});S.writeSave(save);
localStorage.setItem('acornaut_star_map_sample_v1',JSON.stringify({sentinel:'archived sample'}));
const {bootStandalone}=await import('../docs/js/standalone.js');const app=document.createElement('main');document.body.append(app);await bootStandalone(app);const e=win.__sandbox;assert(e);
const tick=()=>{now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));};
const button=text=>[...app.querySelectorAll('button')].find(b=>b.textContent.includes(text));
function chart(){e.open('log');tick();tick();return app.querySelector('.ac-chartmap');}
const VG=await import('../docs/js/vanguard.js');
assert.equal(Cat.SUITS[0].id,'flight');assert.equal(Cat.TRAILS[0].id,'sparks');
assert.equal(C.STAR_UNLOCKS.suits.vanguard,500);assert.equal(C.STAR_UNLOCKS.trails.vanguardwake,500);
assert.equal(Cat.GUIDE_SUIT,'iontrim');assert(!Cat.IAP_ITEMS.includes('vanguard'));
assert.equal(S.starsOf(e.save),0);
if(mode==='production'){
  assert.equal(e.buySuit('vanguard'),'locked');
  // Eligibility boundary, independent of the currently shorter live route.
  // The actual live route remains 100 missions; this models retained credit
  // after the future production expansion has become earnable.
  const ledger=P.migrateCampaign(e.save);
  ledger.legacyEntitlementFloor=499;assert.equal(e.buySuit('vanguard'),'locked');
  ledger.legacyEntitlementFloor=500;assert(['buy','equip'].includes(e.buySuit('vanguard')));
  ledger.legacyEntitlementFloor=0;assert(S.suitRevealed(e.save,'vanguard'),'earned suit survives later save reconciliation');
}else{
  assert(S.suitRevealed(e.save,'vanguard'),'fresh beta opens flagship at zero stars');
  assert(['buy','equip'].includes(e.buySuit('vanguard')));
  const earned=S.defaultSave();
  for(let i=0;i<166;i++)P.settleMissionCredit(earned,C.ALL_LEVELS[i],7);
  P.settleMissionCredit(earned,C.ALL_LEVELS[166],1);assert.equal(S.starsOf(earned),499);
  P.settleMissionCredit(earned,C.ALL_LEVELS[166],3);assert.equal(S.starsOf(earned),500);
  P.settleMissionCredit(earned,C.ALL_LEVELS[166],1);assert.equal(S.starsOf(earned),500);
}
assert.equal(e.save.equippedSuit,'vanguard');
e.save.equippedTrail='ion';e.save.unlockedTrails.push('ion');
assert.equal(Cat.trailWornBy(e.save.equippedTrail,e.save.equippedSuit),'vanguardwake');
assert.equal(e.buyTrail('ion'),'locked');assert.equal(e.save.equippedTrail,'ion');
assert.equal(e.buyTrail('vanguardwake'),'equip');assert.equal(e.save.equippedTrail,'ion');
e.open('hangar');e.setShopTab('trails');tick();
assert(button('Ion Stream').disabled);assert(!button('Vanguard Wake').disabled);
assert(app.textContent.includes('Your previous trail returns'));
assert(['buy','equip'].includes(e.buySuit('flight')));tick();
assert.equal(Cat.trailWornBy(e.save.equippedTrail,e.save.equippedSuit),'ion');
assert.equal(e.buyTrail('vanguardwake'),'locked');assert(button('Vanguard Wake').disabled);
// The beta selector is available in both hangar and pause; production
// ignores even an imported experimental preference.
e.buySuit('vanguard');e.setShopTab('suits');tick();
if(mode==='beta') {
  assert(app.querySelector('.ac-vanguard-motion'));
  // New choices persist through reload; originals stay available for comparison.
  button('Upright').click();assert.equal(e.save.vanguardMotionMode,'jetpack');
  assert.equal(S.loadSave().vanguardMotionMode,'jetpack');
  assert.equal(button('Upright').getAttribute('aria-pressed'),'true');
  app.querySelector('.ac-vanguard-motion button').click();
  assert.equal(e.save.vanguardMotionMode,'cruise');
  assert.equal(S.loadSave().vanguardMotionMode,'cruise');
  button('Continuous').click();assert.equal(e.save.vanguardMotionMode,'flow');
  assert.equal(S.loadSave().vanguardMotionMode,'flow');
  assert.equal(button('Continuous').getAttribute('aria-pressed'),'true');
  e.fly('fly');Sim.flap(e.world,e.save);
  for(let i=0;i<12;i++)Sim.updateWorld(e.world,e.save,1/60);
  assert(e.world.vanguard.phase>0);e.pause();tick();
  assert(app.querySelector('.ac-vanguard-motion'));
  const atPause=JSON.stringify(e.world.squirrel), beat=e.world.vanguard.phase;
  button('Cinematic').click();
  assert.equal(e.world.vanguard.phase,beat);assert.equal(JSON.stringify(e.world.squirrel),atPause);
  e.resume();assert.equal(e.world.screen,'play');
} else {
  assert(!app.querySelector('.ac-vanguard-motion'));
  e.setVanguardMotionMode('flow');assert.equal(e.save.vanguardMotionMode,'cruise');
  assert.equal(S.vanguardModeOf({...e.save,vanguardMotionMode:'flow'}),'cruise');
}
// Real simulation controls and contacts, independent of the old clocks.
const w=Sim.makeWorld(390,760);Sim.resetRun(w,e.save,'fly',false);w.ready=false;
assert.equal(Sim.flap(w,e.save),'flap');assert(w.squirrel.vy<0);
assert(w.particles.some(p=>p.kind==='vanguardwake'));assert.equal(e.save.equippedTrail,'ion');
Sim.dive(w,e.save);assert(w.squirrel.vy>0);assert(w.vanguard.diving);
w.planets=[{x:w.W*Cat.PHYS.squirrelX+1,gapY:w.squirrel.y+50-110-62,gap:220,r:62,topKind:0,botKind:0,scored:false,drift:0,driftAmp:0,blockers:[]}];
w.pickups=[];w.lastSpawnX=100000;w.squirrel.vy=360;
let event;for(let i=0;i<5&&event!=='bounce';i++)event=Sim.updateWorld(w,e.save,1/120);
assert.equal(event,'bounce');assert.equal(w.vanguard.contacts.length,1);
const dust=w.vanguard.contacts[0];Sim.flap(w,e.save);
assert.equal(w.vanguard.contacts[0],dust,'next-frame tap cannot erase landing dust');
assert(!w.vanguard.diving);assert(w.squirrel.vy<0);
w.planets=[];w.squirrel.y=380;w.squirrel.vy=0;
for(let i=0;i<26;i++)Sim.updateWorld(w,e.save,1/60);
assert.equal(w.bounceAnimT,-1);assert.equal(w.vanguard.contacts.length,1,'plume survives legacy contact window');
// Passing an actual gate arms the softer first thruster pulse without changing the displayed pose.
w.vanguard.freshThrust=false;
w.planets=[{x:-20,gapY:380,gap:220,r:62,topKind:0,botKind:0,scored:false,drift:0,driftAmp:0,blockers:[]}];
Sim.updateWorld(w,e.save,1/60);assert(w.vanguard.freshThrust);assert.equal(w.score,1);
// Pause freezes animation; reset clears contacts; the ready screen idles its tail.
Sim.pausePlay(w);const paused=JSON.stringify(w.vanguard);Sim.updateWorld(w,e.save,.2);
assert.equal(JSON.stringify(w.vanguard),paused);assert.equal(Sim.flap(w,e.save),'none');
Sim.resumePlay(w);Sim.resetRun(w,e.save,'fly',false);
assert.deepEqual(w.vanguard,VG.createVanguardMotion(S.vanguardModeOf(e.save)));
const readyY=w.squirrel.y;Sim.updateWorld(w,e.save,.1);assert(Math.abs(w.vanguard.time-.1)<1e-9);assert.equal(w.squirrel.y,readyY);assert(w.vanguard.phase>0);
// Even a doubled world pace must not double the flagship's visual clock.
for(const pace of [1,2]) {
  const paced=Sim.makeWorld(390,5000),sv={...e.save};
  Sim.resetRun(paced,sv,'fly',false,{...C.CHART_LEVELS[0],fx:{...C.CHART_LEVELS[0].fx,pace}});
  paced.planets=[];paced.pickups=[];paced.lastSpawnX=100000;
  Sim.flap(paced,sv);for(let i=0;i<30;i++)Sim.updateWorld(paced,sv,1/60);
  assert(Math.abs(paced.vanguard.time-.5)<1e-8);
}
// Exercise 100/180/300ms tapping through updateWorld, with enough vertical
// space to let the actual forces fly and no artificial position reset.
for(const interval of [.1,.18,.3]) for(const style of ['cinematic','flow']) {
  const sv={...e.save,vanguardMotionMode:style};
  const live=Sim.makeWorld(390,5000);Sim.resetRun(live,sv,'fly',false);
  live.planets=[];live.pickups=[];live.lastSpawnX=100000;
  let nextTap=0, beforeBeat=0;const poses=new Set();
  for(let i=0;i<240;i++) {
    if(i/60+1e-8>=nextTap) {
      const before=[live.vanguard.phase,live.vanguard.frame,live.vanguard.heading];
      Sim.flap(live,sv);
      if(i>0) assert.deepEqual([live.vanguard.phase,live.vanguard.frame,live.vanguard.heading],before,'repeat tap must not restart tail or set body heading');
      nextTap+=interval;
    }
    Sim.updateWorld(live,sv,1/60);poses.add(live.vanguard.frame);
    if(i>0)assert.notEqual(live.vanguard.phase,beforeBeat,'tail clock never holds');
    beforeBeat=live.vanguard.phase;
  }
  assert.equal(live.screen,'play');assert(poses.size>=10,'rapid input must keep tail moving');
  assert(poses.size===16,'every drawn tail phase must remain reachable under rapid taps');
  assert(live.vanguard.thrust>.2);
}
// Direction changes interrupt no tail cycle and wait for no animation beat.
// A normal tap arc crosses the apex well inside the old 1.76s gesture.
for(const style of ['cinematic','flow']) {
 const state=VG.createVanguardMotion(style);VG.vanguardTap(state);
 for(let i=0;i<18;i++)VG.stepVanguard(state,1/60,-220);
 assert(state.heading<-.2);
 for(let i=0;i<18;i++)VG.stepVanguard(state,1/60,220);
 assert(state.heading>.2,'fall must read within .3s of reversing vertical travel');
 const firstPhase=state.phase, seen=new Set();
 for(let i=0;i<150;i++){VG.stepVanguard(state,1/60,0);seen.add(state.frame);}
 assert.equal(seen.size,16,'no-input glide keeps the entire tail loop alive');
 assert.notEqual(state.phase,firstPhase);assert(Math.abs(state.heading)<.001);
 VG.vanguardDive(state);
 for(let i=0;i<36;i++)VG.stepVanguard(state,1/60,650);
 assert(state.heading>.95,'explicit swipe reaches a visibly deeper attitude');
 const pose=[state.phase,state.frame,state.heading];VG.vanguardTap(state);
 assert.deepEqual([state.phase,state.frame,state.heading],pose,'tap reacts without a body snap');
 for(let i=0;i<24;i++)VG.stepVanguard(state,1/60,-310);
 assert(state.heading<-.3,'climb recovers promptly through velocity, not a queued clip');
}
// Old suit clocks are preserved, including their repeat-tap rewind.
const legacy=Sim.makeWorld(390,760), flight={...e.save,equippedSuit:'flight'};
Sim.resetRun(legacy,flight,'fly',false);Sim.flap(legacy,flight);legacy.tapAnimT=.3;
Sim.flap(legacy,flight);assert.equal(legacy.tapAnimDir,-1);
assert.deepEqual(legacy.vanguard,VG.createVanguardMotion(S.vanguardModeOf(flight)));
S.writeSave(e.save);assert(S.loadSave().unlockedSuits.includes('vanguard'));
console.log(`Vanguard ${mode}: fresh beta access / production 499→500 gate, entitlements, trail UI/actions, beta A/B and persistence, real rapid taps/gate/contact, paused clocks, old suits and replay stars passed`);
e.destroy?.();await win.happyDOM.abort();process.exit(0);
