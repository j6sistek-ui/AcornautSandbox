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
// Exactly one transparent atlas per requested suit, no historical pose banks.
const inactiveImage=globalThis.Image;
const urls=[];let broken=true;
globalThis.Image=class {naturalWidth=1024;naturalHeight=768;set src(v){urls.push(v);queueMicrotask(()=>broken?this.onerror?.():this.onload?.());}};
const Art=await import('../docs/js/art.js?high-orbit-loader');
const bank=Art.emptyArt();await Art.loadSuitBank(bank,H.HIGH_ORBIT_IDS[0]);
assert(!bank.highOrbit?.[H.HIGH_ORBIT_IDS[0]],'failure keeps fallback instead of publishing partial art');
broken=false;
for(const id of H.HIGH_ORBIT_IDS){await Art.loadSuitBank(bank,id);assert.equal(bank.highOrbit[id].naturalWidth,1024);}
assert.equal(urls.length,6,'one failed request is retried; five atlases loaded');
assert(urls.every(url=>/suits\/(cinderforge|groveguard|cosmic|sunforged|abyssal)\/parts\.png/.test(url)),'retired banks never requested');
assert(urls.every(url=>url.endsWith('?v='+C.ART_VER)),'all atlas URLs are stamped');
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
console.log(mode+': five unlock gates, exclusive wakes, loadout copy, previous-trail restoration, loader failure/retry and exact five-atlas paths passed');
process.exit(0);
