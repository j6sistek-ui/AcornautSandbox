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
assert(Cat.PALS.some(p=>p.id==='switchback'));assert(Cat.isIap('switchback'));
assert.equal(Cat.PAL_ANIM.switchback,16);assert.equal(Cat.idDust('switchback'),90);
assert(!S.palUnlocked(e.save,'switchback'));assert.equal(e.equipPal('switchback'),'locked');
// Existing featured rotation includes the new companion pack. No new store
// or grant path: this is the same ownership/Star Dust transaction as peers.
const originalNow=Date.now;Date.now=()=>0;e.open('shop');tick();
assert(app.textContent.includes('Switchback Companion'));
Date.now=originalNow;
e.save.starDust=89;assert.equal(e.buyShopItem('switchback'),'poor');
e.save.starDust=90;assert.equal(e.buyShopItem('switchback'),'ok');
assert.equal(e.save.starDust,0);assert(S.palUnlocked(e.save,'switchback'));
assert.equal(e.buyShopItem('switchback'),'owned');assert.equal(e.equipPal('switchback'),'equip');
S.writeSave(e.save);assert.equal(S.loadSave().equippedPal,'switchback');
// Recorded beta ownership survives the new premium classification.
const old={...S.defaultSave(),unlockedPals:['none','switchback'],equippedPal:'switchback'};
S.writeSave(old);const restored=S.loadSave();assert(restored.purchased.includes('switchback'));
assert.equal(restored.equippedPal,'switchback');assert(S.palUnlocked(restored,'switchback'));
// Ordinary flight with Switchback has exactly the same authority as solo.
const worlds=['none','switchback'].map(pal=>{const sv={...e.save,equippedPal:pal};
 const w=Sim.makeWorld(390,5000);Sim.resetRun(w,sv,'fly',false);w.planets=[];w.pickups=[];w.lastSpawnX=100000;
 return {w,sv};});
for(let i=0;i<150;i++) {
 for(const {w,sv} of worlds){if(i%12===0)Sim.flap(w,sv);if(i===100)Sim.dive(w,sv);Sim.updateWorld(w,sv,1/60);assert(!w.scrollReversing);}
 for(const key of ['squirrel','distance','score','speed','powerLeft','run'])assert.deepEqual(worlds[0].w[key],worlds[1].w[key]);
}
console.log(`Switchback ${mode}: premium store entry, price/payment/equip, saved ownership, legacy retention and cosmetic-only flight passed`);
e.destroy?.();await win.happyDOM.abort();process.exit(0);
