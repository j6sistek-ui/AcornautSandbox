#!/usr/bin/env node
// Real menu/engine events in happy-dom. This does not claim browser layout QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const mode=process.argv[2];
if(!mode){for(const page of ['production','beta','sample'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),page],{stdio:'inherit'});process.exit(0);}
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
chart();assert.equal(app.querySelectorAll('.ac-mapnode').length,mode==='production'?100:260);
assert.equal(app.querySelectorAll('.ac-palmark.planned').length,mode==='production'?0:25);
assert.equal(app.querySelectorAll('.ac-palmark.planned.earned').length,0);
if(mode!=='production'){
  const before=JSON.stringify(e.save);button('Reward preview').click();tick();
  assert.equal(app.querySelectorAll('[data-reward-concept]').length,25);
  assert(app.textContent.includes('not earnable yet'));assert(app.textContent.includes('PLACEHOLDER ART'));
  button('Back to chart').click();tick();assert.equal(JSON.stringify(e.save),before);
  assert.equal(app.querySelectorAll('[data-reward-concept]').length,0);
}
assert.equal(app.querySelectorAll('.ac-zone-scene').length,mode==='production'?10:26);
assert.equal(app.querySelectorAll('.ac-debristag').length,3);
assert(app.querySelectorAll('.ac-mapdisc canvas').length<=48);
for(const c of app.querySelectorAll('.ac-mapdisc canvas')){
  const def=C.CHART_LEVELS.find(l=>l.id===c.closest('.ac-mapnode').dataset.level);
  assert.equal(Number(c.dataset.planet),V.mapPlanetIndex(def));
}
if(mode==='production'){
  assert(Cat.PALS.some(p=>p.id==='switchback'));assert(Cat.isIap('switchback'));
  assert(!e.flyLevel(C.HYPER_RUN_MISSION.id),'production rejects Hyper Run before arrival/access');
  assert(!e.flyLevel('2-1'),'star totals cannot skip the road');
  // Actual engine launches and sim settlement, one star at a time, through all 100.
  const stopped=[];
  for(const def of C.LEVELS){
    if(!e.flyLevel(def.id)){
      const barrier=C.gateBefore(def.ord,e.save.raceGates);assert(barrier);stopped.push(barrier.after);
      assert(e.flyLevel(C.HYPER_RUN_MISSION.id));e.world.lvl.stats.finishTicks=barrier.ticks;Sim.settleLevel(e.world,e.save,true);
      assert(e.flyLevel(def.id));
    }
    Object.assign(e.world.lvl.stats,{acorns:0,gold:0,bounces:1,shieldsSpent:1,taps:999});
    if(e.world.spill){e.world.spill.oreMined=0;e.world.spill.hits=1;}
    Sim.settleLevel(e.world,e.save,true);
  }
  assert.deepEqual(stopped,[33,66,99]);assert.equal(P.earnedCampaignStars(e.save),100);
  chart();assert.equal(app.querySelectorAll('.ac-mapnode.done').length,100);
  assert.equal(app.querySelectorAll('.ac-debristag.done').length,3);
  const dust=e.save.starDust,receipts=JSON.stringify(e.save.campaignProgress.paidRewards);e.settleDust();assert.equal(e.save.starDust,dust);assert.equal(JSON.stringify(e.save.campaignProgress.paidRewards),receipts);
} else {
  assert(!app.querySelector('a[href$="?star-map=sample"]'));
  assert(Cat.PALS.some(p=>p.id==='switchback'));
  button('Rust Belt').click();tick();
  assert(app.querySelector('[data-order="101"] .ac-mapdisc canvas'));
  assert(backgrounds.get(app.querySelector('[data-zone="rust-belt"]').style)?.includes('rust-belt.png'));
  app.querySelector('[data-order="101"]').click();assert(app.textContent.includes('Mooring Line'));
  assert(e.flyLevel(C.ALL_LEVELS[100].id));assert.equal(e.world.lvl.def.id,C.ALL_LEVELS[100].id);
  assert(e.flyLevel(C.ALL_LEVELS[110].id));
  for (const def of [...C.LEVELS].reverse()) {
    assert(e.flyLevel(def.id), `beta must launch ${def.ord} without progression`);
    assert.equal(e.world.lvl.def.variantId,def.variantId);
    if (def.base === 'spill') assert.equal(e.world.spill.target,def.spillFinish ? Number.MAX_SAFE_INTEGER : def.gates);
  }

  e.open('hangar');e.setShopTab('ship');assert(button('Rust Runner hull'));button('Rust Runner hull').click();button('Rust Wake exhaust').click();
  assert.equal(S.loadSave().spillAppearance.finish,'rust-runner');assert.equal(S.loadSave().spillAppearance.trail,'rust-wake');
  assert(app.textContent.includes('Rivet · placeholder concept'));
  e.fly('spill');const before=JSON.stringify(e.world.spill);assert(e.setSpillAppearance('finish','stock'));assert.equal(JSON.stringify(e.world.spill),before,'cosmetic selection cannot mutate simulation');
  assert.equal(localStorage.getItem('acornaut_star_map_sample_v1'),JSON.stringify({sentinel:'archived sample'}));
  chart();
  const input=app.querySelector('.ac-chart-find input');input.value='Blackout Zone';app.querySelector('.ac-chart-find').dispatchEvent(new win.Event('submit',{cancelable:true}));tick();
  assert(app.querySelector('[data-order="241"] .ac-mapdisc canvas'));
  assert(app.querySelectorAll('.ac-mapdisc canvas').length<=48);
}
e.stop();await win.happyDOM.close();console.log(`star map UI ${mode}: menu navigation, zone families, bounded canvases, engine access and progression passed`);
