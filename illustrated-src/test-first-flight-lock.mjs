#!/usr/bin/env node
// NORMAL is the first and only mode until the first flight is done (owner,
// 1 Oct 2026). DOM integration test; happy-dom provides events and menus,
// not a browser layout engine.
import assert from 'node:assert/strict';
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM || 'happy-dom');
const win=new Window({url:'http://local/'});let now=0;const frames=new Map();let frameID=0;
for(const k of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])Object.defineProperty(globalThis,k,{value:k==='window'?win:win[k],configurable:true,writable:true});
globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++frameID,fn);return frameID;};globalThis.cancelAnimationFrame=id=>frames.delete(id);win.requestAnimationFrame=globalThis.requestAnimationFrame;win.cancelAnimationFrame=globalThis.cancelAnimationFrame;
globalThis.Image=class {set src(v){queueMicrotask(()=>this.onerror?.());}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
const ctx=new Proxy({canvas:null,clearRect(){},measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)}),getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=function(){return ctx;};win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:390,height:760,right:390,bottom:760};};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const Save=await import(new URL('../docs/js/save.js',import.meta.url).href);
const save=Save.defaultSave();save.introOff=true;save.musicOff=true;save.sfxOff=true;
// a save with every star-priced mode affordable, so the only lock left is the first flight
save.starDust=100000;Save.writeSave(save);
const {bootStandalone}=await import(new URL('../docs/js/standalone.js',import.meta.url).href);const app=win.document.createElement('main');win.document.body.append(app);await bootStandalone(app);const e=win.__sandbox;assert(e);
function tick(n=1){for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}}
function button(text){const b=[...app.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert(b,`missing button ${text}: ${app.textContent.slice(0,1200)}`);return b;}
assert.equal(e.save.tutorialDone,false,'fresh save: first flight not done');
app.querySelector('.ac-dailycard button')?.click();tick();
e.open('title');tick();
button('MODES').click();tick();
const rows=[...app.querySelectorAll('.ac-moderow')];assert(rows.length>=6,'mode sheet lists the modes');
const rowOf=(id)=>rows.find(r=>r.classList.contains(`m-${id}`));
assert(!rowOf('fly').classList.contains('ac-cardoff'),'NORMAL is open before the first flight');
for(const id of ['spill','arcade','race','deep','lost']){const r=rowOf(id);assert(r,`row ${id}`);assert(r.classList.contains('ac-cardoff'),`${id} locked before the first flight`);assert(r.textContent.includes('1ST FLIGHT'),`${id} chip says why`);assert(r.textContent.includes('Finish your first flight in NORMAL to unlock.'),`${id} blurb says how`);}
// a locked row answers by selecting NORMAL and closing the sheet, not by opening the chart
rowOf('arcade').click();tick();
assert(!app.querySelector('.ac-modecard'),'locked row closes the sheet');assert.equal(e.world.screen,'title','and stays on the main menu');
// the engine refuses every other mode behind the sheet, and still starts NORMAL as the lesson
for(const id of ['arcade','spill','race','deep','lost','tunnel']){e.fly(id);assert.equal(e.world.screen,'title',`engine refuses ${id} before the first flight`);}
e.fly('fly');assert.equal(e.world.screen,'play','NORMAL launches');assert(e.world.tut,'and it is the lesson');
// after the first flight, the rows open as before
e.skipTutorial();tick();assert.equal(e.save.tutorialDone,true);
e.open('title');tick();button('MODES').click();tick();
const after=[...app.querySelectorAll('.ac-moderow')];const afterOf=(id)=>after.find(r=>r.classList.contains(`m-${id}`));
for(const id of ['spill','arcade']){assert(!afterOf(id).classList.contains('ac-cardoff'),`${id} open after the first flight`);assert(!afterOf(id).textContent.includes('1ST FLIGHT'));}
assert(afterOf('deep').textContent.includes('★'),'DEEP SPACE goes back to its star price');
e.fly('arcade');assert.equal(e.world.screen,'play','ARCADE launches after the first flight');assert.equal(e.world.flight,'arcade');
e.open('title');
console.log('first-flight lock: every mode but NORMAL locked on the sheet and in the engine until the tutorial is done, then open passed');
