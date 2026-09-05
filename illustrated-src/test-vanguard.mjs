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
const ctx=new Proxy({measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
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
// Real simulation: fixed wake and existing controls, then real contact.
e.buySuit('vanguard');const w=Sim.makeWorld(390,760);Sim.resetRun(w,e.save,'fly',false);w.ready=false;
assert.equal(Sim.flap(w,e.save),'flap');assert(w.squirrel.vy<0);
assert(w.particles.some(p=>p.kind==='vanguardwake'));assert.equal(e.save.equippedTrail,'ion');
Sim.dive(w,e.save);assert(w.squirrel.vy>0);assert(VG.vanguardFrame(w.tapAnimT,-1,w.squirrel.vy)>=16);
w.planets=[{x:w.W*Cat.PHYS.squirrelX+1,gapY:w.squirrel.y+50-110-62,gap:220,r:62,topKind:0,botKind:0,scored:false,drift:0,driftAmp:0,blockers:[]}];
w.pickups=[];w.lastSpawnX=100000;w.squirrel.vy=360;
let event;for(let i=0;i<5&&event!=='bounce';i++)event=Sim.updateWorld(w,e.save,1/120);
assert.equal(event,'bounce');assert(VG.vanguardFrame(w.tapAnimT,w.bounceAnimT,w.squirrel.vy)>=24);
// Rapid taps rewind the existing visual clock without changing controls.
w.bounceAnimT=-1;w.tapAnimT=.3;w.tapAnimDir=1;Sim.flap(w,e.save);
assert.equal(w.tapAnimDir,-1);assert(w.squirrel.vy<0);
const seen=new Set();for(let i=0;i<16;i++)seen.add(VG.vanguardFrame((i+.5)/16*.72,-1,-100));assert.equal(seen.size,16);
assert.equal(new Set(VG.VANGUARD_DIVE_ORDER).size,8);
S.writeSave(e.save);assert(S.loadSave().unlockedSuits.includes('vanguard'));
console.log(`Vanguard ${mode}: fresh beta access / production 499→500 gate, entitlements, trail UI/actions, real tap/dive/contact, replay stars passed`);
e.destroy?.();await win.happyDOM.abort();process.exit(0);
