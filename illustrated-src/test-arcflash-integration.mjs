#!/usr/bin/env node
// Arcflash catalog, menu, input and optional-art integration against docs/js.
// Run export-sandbox.mjs first; set ACORNAUT_HAPPY_DOM when happy-dom is
// installed outside this repository. These checks do not claim visual QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const mode=process.argv[2];
if(!mode){for(const page of ['production','beta'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),page],{stdio:'inherit'});process.exit(0);}
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM || 'happy-dom');
const win=new Window({url:`http://local/${mode==='production'?'':'beta/'}`});
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

const S=await import('../docs/js/save.js'), Sim=await import('../docs/js/sim.js'), Cat=await import('../docs/js/catalog.js'), Art=await import('../docs/js/art.js');
assert.equal(Cat.SUITS.some(s=>s.id==='arcflash'),mode==='beta');
assert.equal(Cat.TRAILS.some(s=>s.id==='arcflashwake'),mode==='beta');
assert.equal(Cat.trailWornBy('ion','arcflash'),'arcflashwake');
assert.equal(Cat.trailWornBy('arcflashwake','flight'),'sparks');
assert.equal(Cat.trailWornBy('arcflashwake','vanguard'),'vanguardwake');
assert(Cat.canWearTrail('arcflashwake','arcflash'));
assert(!Cat.canWearTrail('vanguardwake','arcflash'));
assert(!Cat.canWearTrail('arcflashwake','vanguard'));
assert(!Cat.canWearTrail('arcflashwake','flight'));
const save=S.defaultSave();Object.assign(save,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true});S.writeSave(save);
const {bootStandalone}=await import('../docs/js/standalone.js');const app=document.createElement('main');document.body.append(app);await bootStandalone(app);const e=win.__sandbox;assert(e);
if(mode==='production'){
 assert.equal(e.buySuit('arcflash'),'missing');
 assert.equal(e.buyTrail('arcflashwake'),'missing');
 console.log('production: Arcflash absent; trail exclusion/fallback correct');process.exit(0);
}
assert(['buy','equip'].includes(e.buySuit('arcflash')));
assert.equal(S.suitPitchFor(e.save,'arcflash'),0,'Arcflash starts at its authored angle');
assert.equal(S.suitPitchFor(e.save,'vanguard'),12,'latest AcorNut default survives integration');
e.setSuitPitch('arcflash',15);assert.equal(S.suitPitchFor(e.save,'arcflash'),15);
assert.equal(S.suitPitchFor(e.save,'vanguard'),12,'Arcflash pitch adjustment is independent');
assert.equal(S.suitPitchFor(S.loadSave(),'arcflash'),15,'per-suit pitch persists');
e.setSuitPitch('arcflash',0);
e.save.equippedTrail='ion';e.save.unlockedTrails.push('ion');
assert.equal(e.buyTrail('arcflashwake'),'equip');assert.equal(e.save.equippedTrail,'ion');
assert.equal(e.buyTrail('vanguardwake'),'locked');assert.equal(e.buyTrail('ion'),'locked');
e.open('hangar');e.setShopTab('trails');
assert(app.textContent.includes('Arcflash carries its own blue electrical wake'));
e.setShopTab('helmets');assert(app.textContent.includes("Arcflash's blue eyes and bare head"));
assert(['buy','equip'].includes(e.buySuit('flight')));
assert.equal(Cat.trailWornBy(e.save.equippedTrail,e.save.equippedSuit),'ion');
e.save.equippedSuit='arcflash';
const w=Sim.makeWorld(390,844);Sim.resetRun(w,e.save,'fly',false);
const vg=JSON.stringify(w.vanguard);
Sim.updateWorld(w,e.save,1/60);assert(w.arcflash.time>0,'ready idle clock');
const random=Math.random;let rng=0;Math.random=()=>{rng++;return .25};
try { Sim.spawnTrail(w,e.save,.45); } finally { Math.random=random; }
assert.equal(rng,0);assert.equal(w.particles.length,0);
assert.equal(Sim.flap(w,e.save),'flap');assert(w.arcflash.pressure>0);assert.equal(w.arcflash.tapAge,0);
for(let i=0;i<8;i++)Sim.updateWorld(w,e.save,1/60);
assert.equal(w.arcflash.phase,'rise');assert.equal(JSON.stringify(w.vanguard),vg,'no inactive Vanguard updates');
for(const hold of ['pause','shield','warp','stuck']){
 const before=JSON.stringify(w.arcflash);
 if(hold==='pause')w.screen='pause';if(hold==='shield')w.shieldFreeze=.3;if(hold==='warp')w.warpT=.3;if(hold==='stuck')w.stuck=true;
 Sim.updateWorld(w,e.save,1/60);assert.equal(JSON.stringify(w.arcflash),before,hold+' holds Arcflash');
 w.screen='play';w.shieldFreeze=0;w.warpT=0;w.stuck=false;
}
Sim.dive(w,e.save);assert(w.arcflash.diving);
Sim.resetRun(w,e.save,'fly',false);assert.equal(w.arcflash.time,0);assert.equal(w.arcflash.pressure,0);
Sim.resetRun(w,e.save,'fly',true);assert.equal(Sim.pilotSuitId(w,e.save),'vanguard');
Sim.flap(w,e.save);Sim.updateWorld(w,e.save,1/60);assert.equal(w.arcflash.time,0,'tutorial pilot isolates Arcflash');

// Hyper Run returns before ordinary flight stepping. Its own fixed clock
// and consumed hold/drop inputs must animate the same suit without feeding
// anything back into deterministic race authority or viewport scaling.
const Race=await import('../docs/js/race.js');
const raceWorld=(width,height)=>{
 const world=Sim.makeWorld(width,height);Sim.resetRun(world,e.save,'fly',false);
 world.race=Race.createRaceState();return world;
};
const small=raceWorld(390,844),large=raceWorld(900,900),authority=Race.createRaceState();
for(const world of [small,large]){
 Sim.updateWorld(world,e.save,.1);
 assert.equal(world.race.tick,0);assert.equal(world.arcflash.time,0,'race READY freezes the suit');
}
const input={held:true,boost:false};
for(const world of [small,large])assert(Sim.setRaceInput(world,input));
Race.queueRaceInput(authority,input);
const racePose=JSON.stringify(small.arcflash.pose);
for(let i=0;i<12;i++){
 Sim.updateWorld(small,e.save,1/120);Sim.updateWorld(large,e.save,1/30);Race.stepRace(authority);
}
assert(Math.abs(small.arcflash.time-12*Race.RACE_DT)<1e-10,'race uses its authority tick, not caller dt');
assert.equal(JSON.stringify(small.arcflash),JSON.stringify(large.arcflash),'canonical velocity gives viewport-independent motion');
assert.notEqual(JSON.stringify(small.arcflash.pose),racePose);assert.equal(small.arcflash.phase,'rise');
assert(small.arcflash.boost>0,'accepted held ascent sustains jets');
assert(small.arcflash.tapAge>.15,'continuous hold does not restart tap accents');
assert.deepEqual(small.race,authority,'suit presentation does not alter race authority');
const pausedRace=JSON.stringify(small.race),pausedPose=JSON.stringify(small.arcflash);
small.screen='pause';Sim.updateWorld(small,e.save,1/60);
assert.equal(JSON.stringify(small.race),pausedRace);assert.equal(JSON.stringify(small.arcflash),pausedPose);
small.screen='play';
Sim.setRaceInput(small,{held:true,boost:true});Sim.updateWorld(small,e.save,1/60);
assert(small.arcflash.pressure>.15,'accepted boost adds pressure');
Sim.setRaceInput(small,{held:false,boost:false,drop:true});Sim.updateWorld(small,e.save,1/60);
assert(small.arcflash.diving);assert(!small.arcflash.boosting);assert(small.race.vy>0);
for(let i=0;i<6;i++)Sim.updateWorld(small,e.save,1/60);
assert.equal(small.arcflash.phase,'dive','accepted drop drives the descending suit');
const imageUrls=[];
globalThis.Image=class {naturalWidth=1024;naturalHeight=768;set src(v){imageUrls.push(v);queueMicrotask(()=>this.onload?.());}};
const isolatedArt=await import('../docs/js/art.js?arcflash-loader-check');const bank={};await isolatedArt.loadSuitBank(bank,'arcflash');assert.equal(bank.arcflash?.naturalWidth,1024);assert(imageUrls.some(v=>v.includes(`/suits/arcflash/parts.png?v=${Cat.ART_VER}`)));
console.log('beta: equip/menu/trail preservation, no particle RNG, accepted input, phase, pause/freeze/warp/stuck, reset/tutorial isolation, Hyper Run hold/drop and authority isolation, atlas loading passed');
process.exit(0);
