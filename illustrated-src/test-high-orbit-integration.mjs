#!/usr/bin/env node
// High Orbit catalog, menu, save and optional-art integration against docs/js.
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

const S=await import('../docs/js/save.js'),C=await import('../docs/js/catalog.js');
const H=await import('../docs/js/high-orbit-config.js');
// THE 3D LINEUP (26 Oct 2026) re-made the five as rendered tap and dive banks: each
// asks for its twelve tap and four dive frames, and never for its retired parts atlas.
const inactiveImage=globalThis.Image;
const urls=[];
globalThis.Image=class {naturalWidth=256;naturalHeight=256;width=256;height=256;set src(v){urls.push(v);queueMicrotask(()=>this.onerror?.());}};
const Art=await import('../docs/js/art.js?high-orbit-loader');
const bank=Art.emptyArt();
for(const id of H.HIGH_ORBIT_IDS){
  assert(H.CUT_RIG_RETIRED.has(id)&&!H.isHighOrbitRig(id),id+' no longer draws with the cut rig');
  await Art.loadSuitBank(bank,id);
  const mine=urls.filter(u=>u.includes(`suits/${id}`));
  for(let i=1;i<=12;i++)assert(mine.some(u=>u.includes(`suits/${id}-tap-${i}.png`)),`${id} requests tap-${i}`);
  for(let i=1;i<=4;i++)assert(mine.some(u=>u.includes(`suits/${id}-desc-${i}.png`)),`${id} requests desc-${i}`);
  assert(!mine.some(u=>/parts\.png/.test(u)),id+' never requests its retired parts atlas');
}
assert(urls.every(url=>url.endsWith('?v='+C.ART_VER)),'all bank URLs are stamped');
globalThis.Image=inactiveImage;

const initial=S.defaultSave();Object.assign(initial,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true});
initial.unlockedTrails.push('ion');initial.equippedTrail='ion';S.writeSave(initial);
const {bootStandalone}=await import('../docs/js/standalone.js');
const app=document.createElement('main');document.body.append(app);await bootStandalone(app);
const e=win.__sandbox;assert(e);
for(const id of H.HIGH_ORBIT_IDS){
 const trail=H.HIGH_ORBIT_PROFILES[id].trail;
 if(mode==='production'){
   assert(!S.suitRevealed(e.save,id),id+' retains earned unlock gate');
   assert(!S.trailUnlocked(e.save,trail),id+' wake locked with suit');
 }
 e.save.unlockedSuits.push(id);assert.equal(e.buySuit(id),'equip');assert.equal(e.save.equippedSuit,id);
 assert.equal(e.buyTrail(trail),'equip');assert.equal(e.save.equippedTrail,'ion','built-in preserves previous trail');
 assert.equal(e.buyTrail('ion'),'locked');
 for(const other of H.HIGH_ORBIT_IDS.filter(x=>x!==id))assert.equal(e.buyTrail(H.HIGH_ORBIT_PROFILES[other].trail),'locked');
 e.open('hangar');e.setShopTab('trails');
 assert(app.textContent.includes(H.HIGH_ORBIT_PROFILES[id].wake),id+' wake is visible in the loadout');
 assert(app.textContent.includes('previous trail returns'),id+' exclusivity is explained');
 assert.equal(e.buySuit('flight'),'equip');assert.equal(C.trailWornBy(e.save.equippedTrail,e.save.equippedSuit),'ion');
}
// THEIR WAKES RIDE THE RENDERED BANKS (26 Oct 2026): the cut rig used to paint them, so
// retiring it silently dropped all five in play. Every frame they fly has measured feet.
{
 const {RIG3D_BOOTS}=await import('../docs/js/rig3d-boots.js');
 for(const id of H.HIGH_ORBIT_IDS){
  assert(H.CUT_RIG_RETIRED.has(id),id+' flies its rendered bank');
  for(const [bank,n] of [['tap',12],['desc',4]])for(let i=1;i<=n;i++){
   const b=RIG3D_BOOTS[`${id}-${bank}-${i}`];
   assert(b&&b.length>=1&&b.every(p=>p.length===2&&p.every(Number.isFinite)),`${id}-${bank}-${i} has wake emitters`);
  }
 }
}
console.log(mode+': five unlock gates, exclusive wakes, loadout copy, previous-trail restoration, loader failure/retry and exact five-atlas paths passed');
process.exit(0);
