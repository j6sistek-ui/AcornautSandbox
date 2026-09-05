#!/usr/bin/env node
// DOM integration test; happy-dom provides events and menus, not a browser layout engine.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM || 'happy-dom');
const win=new Window({url:'http://local/'});let now=0;const frames=new Map();let frameID=0;
for(const k of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])Object.defineProperty(globalThis,k,{value:k==='window'?win:win[k],configurable:true,writable:true});
globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++frameID,fn);return frameID;};globalThis.cancelAnimationFrame=id=>frames.delete(id);win.requestAnimationFrame=globalThis.requestAnimationFrame;win.cancelAnimationFrame=globalThis.cancelAnimationFrame;
globalThis.Image=class {set src(v){queueMicrotask(()=>this.onerror?.());}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
const ctx=new Proxy({canvas:null,measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=function(){return ctx;};let width=390;win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width,height:760,right:width,bottom:760};};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const Save=await import(`${root}/docs/js/save.js`),S=await import(`${root}/docs/js/spill.js`);const save=Save.defaultSave();save.tutorialDone=true;save.guide='done';save.introOff=true;save.musicOff=true;save.sfxOff=true;save.spillBest=20;Save.writeSave(save);
const {bootStandalone}=await import(`${root}/docs/js/standalone.js`);const app=win.document.createElement('main');win.document.body.append(app);await bootStandalone(app);const engine=win.__sandbox;assert(engine);
function tick(n=1){for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}}
function button(text){const b=[...app.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert(b,`missing button ${text}: ${app.textContent.slice(0,2400)}`);return b;}
function fixture(wave=5){engine.save.spillStarter=null;engine.fly('spill');const s=engine.world.spill;s.phase='depot';s.wave=s.cleared=wave;s.depot={arm:0,bought:[]};s.ore=2000;s.oreMined=70;s.depotVisits=wave/5;s.expeditionDone=wave>=20;engine.world.ready=false;s.cues=['depot'];tick();return s;}
engine.fly('spill');assert(app.querySelector('.ac-spillprep'));const select=app.querySelector('select[aria-label="Starting utility"]');select.value='magnet';select.dispatchEvent(new win.Event('change'));assert.deepEqual(engine.world.spill.utilities,['magnet']);button('LAUNCH EXPEDITION').click();assert.equal(engine.world.spill.phase,'countdown');tick(181);
// A swipe remains valid after a long hold; another pointer cannot release it.
const canvas=engine.canvas;function pointer(type,id,x,y){canvas.dispatchEvent(new win.PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:true,bubbles:true}));}
pointer('pointerdown',1,100,300);now+=800;pointer('pointermove',1,155,300);assert(engine.world.spill.lunge>0,'long-hold swipe lunges');pointer('pointerup',2,155,300);assert(engine.world.spill.held);pointer('pointerup',1,155,300);assert(!engine.world.spill.held);
pointer('pointerdown',3,100,300);win.dispatchEvent(new win.Event('blur'));assert.equal(engine.world.screen,'pause');assert(!engine.world.spill.held);engine.resume();assert.equal(engine.world.screen,'play');pointer('pointerdown',4,100,300);width=320;engine.resize();assert.equal(engine.world.screen,'pause');assert(!engine.world.spill.held);engine.resume();
const s=fixture();const initial=s.ore;button('Plating').click();assert.equal(s.up.plating,1);assert.equal(s.ore,initial-60);assert.equal(engine.save.spillSuspended.state.up.plating,1);
button('Plating').click();assert(button('Impact Bracing'));button('Impact Bracing').click();assert.equal(s.specialties.plating,'brace');
const card=app.querySelector('.ac-depotcard');card.scrollTop=820;button('Salvage Magnet').click();assert.equal(app.querySelector('.ac-depotcard').scrollTop,820);button('Field Scanner').click();assert(button('Emergency Brake').disabled);button('Salvage Magnet').click();assert(!button('Emergency Brake').disabled);button('Emergency Brake').click();button('Clean Passage').click();assert(s.contract);
const records=structuredClone(engine.save.spillRecords),ore=s.ore;button('SAVE & QUIT').click();assert.equal(engine.world.screen,'title');assert(engine.save.spillSuspended);assert(engine.spillResume());tick(50);assert.equal(engine.world.spill.ore,ore);assert.deepEqual(engine.save.spillRecords,records);assert(app.querySelector('[role="dialog"]'));button('BACK TO THE FIELD').click();assert.equal(engine.world.spill.wave,6);assert.equal(engine.save.spillSuspended,null);
const end=fixture(20);button('FINISH EXPEDITION').click();tick();assert.equal(engine.world.screen,'dead');assert(app.textContent.includes('EXPEDITION COMPLETE'));assert.equal(engine.save.spillRecords.expeditions,1);assert.equal(engine.save.spillRecords.runs,1);
engine.stop();await win.happyDOM.close();console.log('spill UI: preflight, long-hold swipe, pointer ownership, interruption pause, Depot purchases/refits/contracts, scroll retention, save/resume and wave-20 finish pass');
