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
// TOLERATE EITHER happy-dom SHAPE (audit, 8 Sep 2026). Older versions gave
// backgroundImage an accessor on the prototype; newer ones do not, and
// `bg.set` was then undefined - which threw on the first assignment and
// took this whole test down before it asserted anything about the game.
const bg=Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype,'backgroundImage');
Object.defineProperty(win.CSSStyleDeclaration.prototype,'backgroundImage',bg&&bg.set
  ?{...bg,set(value){backgrounds.set(this,value);bg.set.call(this,value);}}
  :{configurable:true,get(){return backgrounds.get(this)??'';},set(value){backgrounds.set(this,value);}});
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
// The generated ladder (ten-star spacing) put AcorNut at 570 and his wake
// at 520. Pin both, and pin the RELATIONSHIP that outlives any retune: the
// wake must never land after the suit it belongs to, or it is unwearable
// on the rung that grants it.
assert.equal(C.STAR_UNLOCKS.suits.vanguard,570);assert.equal(C.STAR_UNLOCKS.trails.vanguardwake,520);
assert(C.STAR_UNLOCKS.trails.vanguardwake<=C.STAR_UNLOCKS.suits.vanguard,'the wake cannot arrive after its suit');
assert.equal(Cat.GUIDE_SUIT,'iontrim');assert(!Cat.IAP_ITEMS.includes('vanguard'));
assert.equal(S.starsOf(e.save),0);
if(mode==='production'){
  assert.equal(e.buySuit('vanguard'),'locked');
  // Eligibility boundary, read off the rung itself rather than pinned: the
  // rung moved 500 -> 570 when the ladder was regenerated on ten-star
  // spacing, and production now flies the same 260-mission / 780-star road
  // the beta playtested, so this total is earnable on the live route.
  const ledger=P.migrateCampaign(e.save),gate=C.STAR_UNLOCKS.suits.vanguard;
  ledger.legacyEntitlementFloor=gate-1;assert.equal(e.buySuit('vanguard'),'locked');
  ledger.legacyEntitlementFloor=gate;assert(['buy','equip'].includes(e.buySuit('vanguard')));
  ledger.legacyEntitlementFloor=0;assert(S.suitRevealed(e.save,'vanguard'),'earned suit survives later save reconciliation');
}else{
  assert(S.suitRevealed(e.save,'vanguard'),'fresh beta opens flagship at zero stars');
  assert(['buy','equip'].includes(e.buySuit('vanguard')));
  // Climb the road to AcorNut's rung with real settlements. Derived from
  // the rung (570 now, not 500) and the road's length (260 missions on both
  // pages since the Star Map went live), so a future retune moves the climb
  // instead of rotting the arithmetic.
  const earned=S.defaultSave(),gate=C.STAR_UNLOCKS.suits.vanguard;
  // Each mission is settled once and only once, walking forward down the
  // road: whole missions pay three stars, the mission on the boundary pays
  // exactly what is still owed.
  let next=0;
  const climb=target=>{
    while(S.starsOf(earned)<target&&next<C.ALL_LEVELS.length)
      P.settleMissionCredit(earned,C.ALL_LEVELS[next++],(1<<Math.min(3,target-S.starsOf(earned)))-1);
    return S.starsOf(earned);
  };
  assert.equal(climb(gate-1),gate-1,'one star short of the rung');
  assert.equal(climb(gate),gate);
  assert(next<C.ALL_LEVELS.length,'the rung has to be reachable on the road that shipped');
  // Replaying an already three-starred mission for a single goal never takes
  // the other two back.
  P.settleMissionCredit(earned,C.ALL_LEVELS[0],1);assert.equal(S.starsOf(earned),gate);
}
assert.equal(e.save.equippedSuit,'vanguard');
e.save.equippedTrail='ion';e.save.unlockedTrails.push('ion');
assert.equal(Cat.trailWornBy(e.save.equippedTrail,e.save.equippedSuit),'vanguardwake');
assert.equal(e.buyTrail('ion'),'locked');assert.equal(e.save.equippedTrail,'ion');
assert.equal(e.buyTrail('vanguardwake'),'equip');assert.equal(e.save.equippedTrail,'ion');
e.open('hangar');e.setShopTab('trails');tick();
// A BUILT-IN WAKE, NOT A CHOICE (owner, 7 Sep 2026): AcorNut's wake is part
// of the character. It is no longer an enabled card you equip - while
// AcorNut is worn it is one fixed, untappable "BUILT-IN TRAIL" card, and no
// other suit sees it in the list at all.
assert(button('Ion Stream').disabled);
const wake=button('AcorNut Wake');
assert(wake.disabled,'the built-in wake cannot be taken off');
assert(wake.classList.contains('ac-builtintrail')&&wake.textContent.includes('BUILT-IN TRAIL'));
assert(app.textContent.includes('Your previous trail returns'));
assert(['buy','equip'].includes(e.buySuit('flight')));tick();
assert.equal(Cat.trailWornBy(e.save.equippedTrail,e.save.equippedSuit),'ion');
assert.equal(e.buyTrail('vanguardwake'),'locked');
assert(!button('AcorNut Wake'),'another suit is never offered AcorNut\'s wake');
// THE MOTION PICKER IS GONE (owner, 6 Sep 2026): Flight is the motion on
// both pages, and nothing on the hangar or the pause sheet selects one.
e.buySuit('vanguard');e.setShopTab('suits');tick();
assert(!app.querySelector('.ac-vanguard-motion'),'no motion picker in the hangar');
e.fly('fly');Sim.flap(e.world,e.save);
for(let i=0;i<12;i++)Sim.updateWorld(e.world,e.save,1/60);
assert(e.world.vanguard.phase>0);e.pause();tick();
assert(!app.querySelector('.ac-vanguard-motion'),'no motion picker on the pause sheet');
e.resume();assert.equal(e.world.screen,'play');
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
assert.deepEqual(w.vanguard,VG.createVanguardMotion());
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
for(const interval of [.1,.18,.3]) {
  const sv={...e.save};
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
// THE ATTITUDE IS SHALLOW NOW. These thresholds were written against the
// Cinematic and Continuous trials, which tipped the whole body by an
// atan2 clamped to 28 deg up / 60 deg down - hence the old .2 / .95 / .3
// radians. Those trials were deleted (owner, 6 Sep 2026: "the Flight
// version is the version now, remove the others"), and the shipped
// articulated cruise reads "descent mostly in limbs, not a nose dive":
// heading eases toward 10 deg on a climb, 8 deg on an ordinary fall and
// 18 deg on a deliberate swipe, each scaled by vy/360. Same events, same
// timings, thresholds moved onto the shipped scale - and the swipe is
// pinned to a RATIO against an ordinary fall at the same speed, so a
// later attitude retune moves both together instead of rotting this.
{
 const state=VG.createVanguardMotion();VG.vanguardTap(state);
 for(let i=0;i<18;i++)VG.stepVanguard(state,1/60,-220);
 assert(state.heading<-.09,'climb reads nose-up inside .3s');   // ~-.102 rad = 5.9 deg of the 6.1 deg target
 for(let i=0;i<18;i++)VG.stepVanguard(state,1/60,220);
 assert(state.heading>.068,'fall must read within .3s of reversing vertical travel');
 const firstPhase=state.phase, seen=new Set();
 for(let i=0;i<150;i++){VG.stepVanguard(state,1/60,0);seen.add(state.frame);}
 assert.equal(seen.size,16,'no-input glide keeps the entire tail loop alive');
 assert.notEqual(state.phase,firstPhase);assert(Math.abs(state.heading)<.001);
 for(let i=0;i<36;i++)VG.stepVanguard(state,1/60,650);
 const plainFall=state.heading;                                  // ~.139 rad: gravity alone at swipe speed
 VG.vanguardDive(state);
 for(let i=0;i<36;i++)VG.stepVanguard(state,1/60,650);
 assert(state.heading>.29,'explicit swipe reaches a visibly deeper attitude');   // 18 deg target, ~.314 rad
 assert(state.heading>plainFall*1.9,'the swipe must sit clearly deeper than the same speed unbidden');
 const pose=[state.phase,state.frame,state.heading];VG.vanguardTap(state);
 assert.deepEqual([state.phase,state.frame,state.heading],pose,'tap reacts without a body snap');
 for(let i=0;i<24;i++)VG.stepVanguard(state,1/60,-310);
 assert(state.heading<-.1,'climb recovers promptly through velocity, not a queued clip');
}
// A painted bank's repeat tap (rewind, live, since the 12 Sep 2026 ruling)
// never touches AcorNut's controller.
const legacy=Sim.makeWorld(390,760), ember={...e.save,equippedSuit:'ember'};
Sim.resetRun(legacy,ember,'fly',false);Sim.flap(legacy,ember);legacy.tapAnimT=.3;
Sim.flap(legacy,ember);assert.equal(legacy.tapAnimDir,-1);assert.equal(legacy.tapAnimQueued,false);
assert.deepEqual(legacy.vanguard,VG.createVanguardMotion());
// EARNED, THEN LISTED (owner, 6 Sep 2026: "immediately after the tutorial
// is done, he is locked"; 8 Sep 2026: "i still have to collect acornut
// everytime i load in"). loadSave strips AcorNut out of unlockedSuits on
// launch so that an old free grant cannot stand in for the stars - but the
// strip asks first now, because the entry the shelf's Collect Reward tap
// writes is the pilot's own, and tearing it out every launch is what made
// the game ask for the same collection forever. What has to hold is the
// original guarantee, not the blunt instrument that carried it: a grant
// with NOTHING BEHIND IT does not survive a launch. Production is where
// that has teeth - the beta opens every gate outright, so a list entry
// there stands in for nothing.
S.writeSave(e.save);
{
  const back=S.loadSave();
  if(mode==='production'){
    assert(!S.tutorialSuitEarned(back),'no stars and no receipt at this point in the run');
    assert(!back.unlockedSuits.includes('vanguard'),'an UNEARNED list grant never carries AcorNut past a launch');
  } else {
    assert(S.tutorialSuitEarned(back),'the beta opens the flagship gate outright');
    assert(S.suitRevealed(back,'vanguard'),'the beta keeps AcorNut revealed across a launch');
  }
}
// ...and once he IS earned, the collection sticks: the tap writes the id,
// the launch leaves it alone, and the shelf never asks a second time.
{
  const earned={...e.save,allStars:true,unlockedSuits:[...new Set([...e.save.unlockedSuits,'vanguard'])]};
  S.writeSave(earned);
  const back=S.loadSave();
  assert(back.unlockedSuits.includes('vanguard'),'a collected AcorNut survives the launch that follows it');
}
P.migrateCampaign(e.save).legacyEntitlementFloor=C.STAR_UNLOCKS.suits.vanguard;S.writeSave(e.save);
const reloaded=S.loadSave();
assert.equal(S.starsOf(reloaded),C.STAR_UNLOCKS.suits.vanguard,'the star ledger is what survives the write');
assert(S.suitRevealed(reloaded,'vanguard'),'an earned AcorNut survives the save round trip');
console.log(`Vanguard ${mode}: fresh beta access / production ${C.STAR_UNLOCKS.suits.vanguard-1}→${C.STAR_UNLOCKS.suits.vanguard} gate, entitlements, built-in wake UI/actions, beta A/B and ledger persistence, real rapid taps/gate/contact, paused clocks, old suits and replay stars passed`);
e.destroy?.();await win.happyDOM.abort();process.exit(0);
