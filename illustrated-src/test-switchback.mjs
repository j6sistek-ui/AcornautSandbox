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
assert(Cat.PALS.some(p=>p.id==='switchback'));assert(Cat.isIap('switchback'));
assert.equal(Cat.PAL_ANIM.switchback,16);assert.equal(Cat.idDust('switchback'),90);
assert(!S.palUnlocked(e.save,'switchback'));assert.equal(e.equipPal('switchback'),'locked');
// Existing featured rotation includes the new companion pack. No new store
// or grant path: this is the same ownership/Star Dust transaction as peers.
// Read the pack's name from the catalog rather than pinning the display
// string: the companion was renamed Switchback -> Stopwatch, and the
// assertion that matters is that its pack reaches the shelf, not its wording.
const swPack=Cat.BUNDLES.find(b=>b.id==='bundle-switchback');
assert(swPack,'bundle-switchback has left the catalog');
// NO DAY-0 SHELF ANY MORE. The storefront is the shop on both pages now
// (drawShop returns drawShopBeta), and the storefront FEATURES ONE PACK A
// DAY, stepping through packs that are neither fixed-price, always available,
// nor already owned; it does not deal three by hash the retired tabbed
// PACKS page did. So the day a pack is on the shelf is its place in that
// rotation, and a pinned date rots the moment a pack joins the pool ahead of
// it. Walk the rotation on the same screen the pilot sees and take the day it
// deals this pack. One pack a day means every pack has to come round inside
// BUNDLES.length days - a pack that never appears is a starved rotation.
const originalNow=Date.now;
let swDay=-1;
for(let d=0;d<Cat.BUNDLES.length;d++){
  Date.now=()=>d*Cat.SHOP_DAY_MS;e.open('shop');tick();
  if(app.textContent.includes(swPack.name)){swDay=d;break;}
}
Date.now=originalNow;
assert(swDay>=0,`the ${swPack.name} pack never reaches the shop across ${Cat.BUNDLES.length} days of rotation`);
// and it got there by the ROTATION RULE rather than by luck: the featured day
// is the pack's place among the packs the rotation cycles - a fixed-price
// pack keeps its own shelf slot and sits out of that cycle.
assert.equal(swDay,Cat.BUNDLES.filter(b=>!b.fixed&&!b.alwaysAvailable).findIndex(b=>b.id===swPack.id));
e.save.starDust=89;assert.equal(e.buyShopItem('switchback'),'poor');
e.save.starDust=90;assert.equal(e.buyShopItem('switchback'),'ok');
assert.equal(e.save.starDust,0);assert(S.palUnlocked(e.save,'switchback'));
assert.equal(e.buyShopItem('switchback'),'owned');assert.equal(e.equipPal('switchback'),'equip');
S.writeSave(e.save);assert.equal(S.loadSave().equippedPal,'switchback');
// Recorded beta ownership survives the new premium classification.
const old={...S.defaultSave(),unlockedPals:['none','switchback'],equippedPal:'switchback'};
S.writeSave(old);const restored=S.loadSave();assert(restored.purchased.includes('switchback'));
assert.equal(restored.equippedPal,'switchback');assert(S.palUnlocked(restored,'switchback'));
// STOPWATCH IS NOT COSMETIC ANY MORE. The owner asked for it on 7 Sep 2026
// and sim.flap took it: with the companion equipped, every tap toggles the
// slow - the frozen acorn's slow, never a full stop - and it is live on the
// live page too, not just beta (IS_BETA || STAR_MAP_LIVE). The parity that
// survives is the PAL EFFECTS switch: turned off, with no mission naming the
// pal, the companion is drawn and flies nothing, which is exactly what
// "cosmetic" means now. Both cases are flown below, so the guard covers the
// effect AND its off switch instead of just asserting the effect away.
const pair=noPalFx=>['none','switchback'].map(pal=>{const sv={...e.save,equippedPal:pal,noPalFx};
 const w=Sim.makeWorld(390,5000);Sim.resetRun(w,sv,'fly',false);w.planets=[];w.pickups=[];w.lastSpawnX=100000;
 return {w,sv};});
const fly=(pairs,each)=>{for(let i=0;i<150;i++){
 for(const {w,sv} of pairs){if(i%12===0)Sim.flap(w,sv);if(i===100)Sim.dive(w,sv);Sim.updateWorld(w,sv,1/60);assert(!w.scrollReversing);}
 each(i);}};
// Pal Effects OFF: ordinary flight with Stopwatch has exactly the same
// authority as solo, to the frame.
const worlds=pair(true);
fly(worlds,()=>{
 for(const key of ['squirrel','distance','score','speed','powerLeft','run'])assert.deepEqual(worlds[0].w[key],worlds[1].w[key]);
 assert.equal(worlds[1].w.tapFrozen,false);
});
// Pal Effects ON: the tap toggles, and only for the pilot flying Stopwatch.
const live=pair(false);let taps=0;
fly(live,i=>{
 if(i%12===0)taps++;
 assert.equal(live[0].w.tapFrozen,false,'solo flight froze on a tap');
 assert.equal(live[1].w.tapFrozen,taps%2===1,`Stopwatch tap ${taps} did not toggle the slow`);
});
// A SLOW, NEVER A STOP: the world still moves under the frozen clock, at
// PHYS.slowFactor of the pace - read the rate off the sim rather than pinning
// the tuned number, and pin the SHAPE (slower, still moving) here.
assert(live[1].w.distance>0,'the slow stopped the run dead');
assert(live[1].w.distance<live[0].w.distance,'Stopwatch flew no slower than solo');
const step=([solo,slowed])=>{const d0=solo.w.distance,d1=slowed.w.distance;
 Sim.updateWorld(solo.w,solo.sv,1/60);Sim.updateWorld(slowed.w,slowed.sv,1/60);
 return [solo.w.distance-d0,slowed.w.distance-d1];};
assert.equal(live[1].w.tapFrozen,true); // an odd number of taps landed above
const [freeMove,slowMove]=step(live);
// one frame apiece: the slowed pilot covers PHYS.slowFactor of the free
// pilot's ground. Read the rate off the sim's own constant so a retune moves
// the expectation with it; the band is loose only because 150 frames of
// slowed flight have pulled the two speed ramps a little apart, and it is
// still nowhere near 1 (slow removed) or 0 (slow turned into a stop).
assert(freeMove>0&&Math.abs(slowMove/freeMove-Cat.PHYS.slowFactor)<0.02,
 `the tap slow ran at ${(slowMove/freeMove).toFixed(3)} of full pace, not PHYS.slowFactor ${Cat.PHYS.slowFactor}`);
console.log(`Switchback ${mode}: premium store entry, price/payment/equip, saved ownership, legacy retention, the tap-toggled slow and its off switch passed`);
e.destroy?.();await win.happyDOM.abort();process.exit(0);
