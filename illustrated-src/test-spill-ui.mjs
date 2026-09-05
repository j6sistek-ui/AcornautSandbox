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
let clears=0;
const ctx=new Proxy({canvas:null,clearRect(){clears++;},measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=function(){return ctx;};let width=390;win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width,height:760,right:width,bottom:760};};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const Save=await import(`${root}/docs/js/save.js`),S=await import(`${root}/docs/js/spill.js`);const save=Save.defaultSave();save.tutorialDone=true;save.guide='done';save.introOff=true;save.musicOff=true;save.sfxOff=true;save.spillBest=20;Save.writeSave(save);
const {bootStandalone}=await import(`${root}/docs/js/standalone.js`);const app=win.document.createElement('main');win.document.body.append(app);await bootStandalone(app);const engine=win.__sandbox;assert(engine);
function tick(n=1){for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}}
function button(text){const b=[...app.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert(b,`missing button ${text}: ${app.textContent.slice(0,2400)}`);return b;}
function control(id){const b=app.querySelector(`[data-spill-control="${id}"]`);assert(b,`missing Depot control ${id}`);return b;}
function ship(kind,id){const b=app.querySelector(`[data-ship-${kind}="${id}"]`);assert(b,`missing ship ${kind} ${id}`);return b;}
function fixture(wave=5){engine.save.spillStarter=null;engine.fly('spill');const s=engine.world.spill;s.phase='depot';s.wave=s.cleared=wave;s.depot={arm:0,bought:[]};s.ore=2000;s.oreMined=70;s.depotVisits=wave/5;s.expeditionDone=wave>=20;engine.world.ready=false;s.cues=['depot'];tick();return s;}
// The Loadout equips earned starters, while the build planner cannot spend or alter a run.
engine.save.spillBest=4;engine.open('hangar');engine.setShopTab('ship');
assert.equal(app.querySelectorAll('[data-ship-tier]').length,15);assert(!app.textContent.includes('UNDER CONSTRUCTION'));assert(!app.textContent.includes('not active yet'));
assert(ship('starter','magnet').disabled);engine.spillStarter('magnet');assert.equal(engine.save.spillStarter,null);
engine.save.spillBest=20;engine.setShopTab('ship');ship('starter','magnet').click();assert.equal(Save.loadSave().spillStarter,'magnet');
app.querySelector('.ac-shipsignal').click();assert.equal(Save.loadSave().spillSignal,true);
const savedLaunch=JSON.stringify(engine.save);assert(ship('spec','brace').disabled);ship('tier','plating-2').click();ship('spec','brace').click();
ship('tier','thrusters-3').click();ship('tier','pulse-2').click();ship('spec','efficient').click();ship('utility','scanner').click();assert(ship('utility','brake').disabled);
ship('tier','plating-1').click();assert(ship('spec','brace').disabled);assert.equal(JSON.stringify(engine.save),savedLaunch,'planning changes no save fields');
button('SHOW LAUNCH SHIP').click();assert.equal(ship('tier','plating-0').getAttribute('aria-pressed'),'true');
engine.fly('spill');assert(app.querySelector('.ac-spillprep'));const select=app.querySelector('select[aria-label="Starting utility"]');select.value='magnet';select.dispatchEvent(new win.Event('change'));assert.deepEqual(engine.world.spill.utilities,['magnet']);button('LAUNCH EXPEDITION').click();assert.equal(engine.world.spill.phase,'docking');tick(200);
assert.equal(engine.world.spill.depotVisits,0);assert(button('CHOOSE AN UPGRADE TO LAUNCH').disabled);
control('inspect-thrusters').click();control('thrusters').click();assert.equal(engine.world.spill.up.thrusters,1);assert.equal(engine.world.spill.ore,0);
button('LAUNCH WAVE 1').click();assert.equal(engine.world.spill.phase,'countdown');tick(181);
assert.deepEqual(engine.world.spill.up,{plating:0,thrusters:1,pulse:0},'only the chosen starting upgrade is fitted');
// Button holds survive HUD rebuilds, multi-touch actions and mixed gesture/keyboard release.
const thrust=app.querySelector('.ac-throttle'),controls=app.querySelector('.ac-spillcontrols');assert(thrust&&!controls.hidden);
function touch(target,type,id,primary=true){target.dispatchEvent(new win.PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:primary,clientX:100,clientY:300,bubbles:true,cancelable:true}));}
touch(engine.canvas,'pointerdown',10);touch(thrust,'pointerdown',11,false);touch(engine.canvas,'pointerup',10);
assert(engine.world.spill.held,'a released gesture cannot cancel the button hold');tick(3);assert.equal(app.querySelector('.ac-throttle'),thrust,'HUD update retains the captured button');
app.querySelector('.ac-dive').click();assert(engine.world.spill.pilot.vy>0);assert(engine.world.spill.held,'Dive does not release a held throttle');
touch(win,'pointerup',12,false);assert(engine.world.spill.held,'another finger cannot release throttle');touch(win,'pointerup',11);assert(!engine.world.spill.held);
touch(thrust,'pointerdown',13);win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space'}));touch(win,'pointerup',13);assert(engine.world.spill.held);win.dispatchEvent(new win.KeyboardEvent('keyup',{code:'Space'}));assert(!engine.world.spill.held);
touch(thrust,'pointerdown',14);engine.pause();assert(!engine.world.spill.held&&controls.hidden);engine.resume();assert(!engine.world.spill.held);
win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space',repeat:true}));assert(!engine.world.spill.held,'a stale held-key repeat cannot restart throttle after pause');
touch(thrust,'pointerdown',15);touch(win,'pointerup',14);assert(engine.world.spill.held,'stale release after pause cannot cancel a fresh hold');touch(win,'pointercancel',15);assert(!engine.world.spill.held);
thrust.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true}));assert(engine.world.spill.held);thrust.dispatchEvent(new win.KeyboardEvent('keyup',{code:'Space',bubbles:true,cancelable:true}));assert(!engine.world.spill.held);
const charges=engine.world.spill.lungeCharges;app.querySelector('.ac-lunge').click();assert.equal(engine.world.spill.lungeCharges,charges-1);assert(app.querySelector('.ac-lunge').disabled);assert(app.querySelector('.ac-lunge').textContent.includes('RECHARGING'));
// Pause preferences persist. Hiding text changes no simulation state or hazard warnings.
engine.pause();app.querySelector('[role="switch"][aria-label="On-screen buttons"]').click();assert.equal(Save.loadSave().spillButtonsOff,true);
const pausedState=JSON.stringify(engine.world.spill);app.querySelector('[role="switch"][aria-label="Instructional prompts"]').click();assert.equal(Save.loadSave().spillPromptsOff,true);assert.equal(JSON.stringify(engine.world.spill),pausedState,'prompt setting does not alter wave pacing');
engine.resume();assert(controls.hidden);engine.spillThrottle(true);assert(!engine.world.spill.held,'hidden controls cannot acquire thrust');
const Draw=await import(`${root}/docs/js/draw.js`);const labels=[];ctx.fillText=t=>labels.push(t);const flight=engine.world.spill;
flight.hint='TEST INSTRUCTION';flight.hintT=5;flight.banner='HAZARD WARNING';flight.bannerT=1;
Draw.drawHud(ctx,engine.world,engine.art,engine.save);assert(!labels.includes('TEST INSTRUCTION'));assert(labels.includes('HAZARD WARNING'));
engine.pause();app.querySelector('[role="switch"][aria-label="Instructional prompts"]').click();app.querySelector('[role="switch"][aria-label="On-screen buttons"]').click();engine.resume();assert(!controls.hidden);labels.length=0;Draw.drawHud(ctx,engine.world,engine.art,engine.save);assert(labels.includes('TEST INSTRUCTION'));
ctx.fillText=()=>{};flight.lunge=0;flight.lungeCharges=1;flight.cool=0;flight.pilot.y=flight.H*.45;flight.pilot.vy=0;
// A swipe remains valid after a long hold; another pointer cannot release it.
const canvas=engine.canvas;function pointer(type,id,x,y){canvas.dispatchEvent(new win.PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:true,bubbles:true}));}
pointer('pointerdown',1,100,300);now+=800;pointer('pointermove',1,155,300);assert(engine.world.spill.lunge>0,'long-hold swipe lunges');pointer('pointerup',2,155,300);assert(engine.world.spill.held);pointer('pointerup',1,155,300);assert(!engine.world.spill.held);
pointer('pointerdown',3,100,300);win.dispatchEvent(new win.Event('blur'));assert.equal(engine.world.screen,'pause');assert(!engine.world.spill.held);engine.resume();assert.equal(engine.world.screen,'play');pointer('pointerdown',4,100,300);width=320;engine.resize();assert.equal(engine.world.screen,'pause');assert(!engine.world.spill.held);engine.resume();
const s=fixture();const initial=s.ore;assert.equal(app.querySelectorAll('.ac-hardpoint').length,4);assert.equal(app.querySelectorAll('.ac-depotslots button').length,2);
control('inspect-pulse').click();assert.equal(s.ore,initial,'inspecting a system is not a purchase');control('inspect-plating').click();
control('plating').click();assert.equal(s.up.plating,1);assert.equal(s.ore,initial-60);assert.equal(engine.save.spillSuspended.state.up.plating,1);
control('plating').click();assert(button('Impact Bracing'));control('brace').click();assert.equal(s.specialties.plating,'brace');
control('inspect-shield').click();control('shield').click();assert.equal(s.canopyLevel,1);assert.equal(s.shield,1);
control('tab-utilities').click();const card=app.querySelector('.ac-depotcard');card.scrollTop=820;control('magnet').focus();control('magnet').click();
assert.equal(app.querySelector('.ac-depotcard').scrollTop,820);assert.equal(document.activeElement.dataset.spillControl,'magnet');control('scanner').click();assert(control('brake').disabled);control('magnet').click();assert(!control('brake').disabled);control('brake').click();
control('tab-contracts').click();button('Clean Passage').click();assert(s.contract);
const records=structuredClone(engine.save.spillRecords),ore=s.ore;button('SAVE & QUIT').click();assert.equal(engine.world.screen,'title');assert(engine.save.spillSuspended);
engine.open('hangar');engine.setShopTab('ship');const savedCheckpoint=JSON.stringify(engine.save.spillSuspended);button('VIEW SAVED BUILD').click();assert.equal(ship('tier','plating-2').getAttribute('aria-pressed'),'true');ship('tier','plating-0').click();assert.equal(JSON.stringify(engine.save.spillSuspended),savedCheckpoint,'inspecting a saved build does not edit its checkpoint');
assert(engine.spillResume());tick(50);assert.equal(engine.world.spill.ore,ore);assert.deepEqual(engine.save.spillRecords,records);assert(app.querySelector('[role="dialog"]'));button('BACK TO THE FIELD').click();assert.equal(engine.world.spill.wave,6);assert.equal(engine.save.spillSuspended,null);
engine.save.spillBest=19;
const end=fixture(20);assert.equal(engine.world.screen,'play');assert(end.firstPass);assert(app.textContent.includes('First pass complete'));assert(!app.textContent.includes('FINISH EXPEDITION'));assert.equal(engine.save.spillRecords.expeditions,1);assert.equal(engine.save.spillRecords.runs,0);
control('plating').click();const hull=end.maxHull,bank=end.ore;button('SAVE & QUIT').click();assert(engine.spillResume());tick(50);assert(engine.world.spill.firstPass);assert(app.textContent.includes('First pass complete'));
button('CONTINUE TO WAVE 21').click();assert.equal(engine.world.screen,'play');assert.equal(engine.world.spill.wave,21);assert.equal(engine.world.spill.maxHull,hull);assert.equal(engine.world.spill.ore,bank);assert(!engine.world.spill.firstPass);
const later=fixture(20);assert(!later.firstPass);assert(!app.textContent.includes('First pass complete'));assert(!app.textContent.includes('FINISH EXPEDITION'));button('BACK TO THE FIELD').click();assert.equal(later.wave,21);assert.equal(engine.world.screen,'play');assert.equal(engine.save.spillRecords.expeditions,2);assert.equal(engine.save.spillRecords.runs,0);
// High-refresh displays keep 60 simulation steps and approximately 60 paints.
Object.defineProperty(win,"devicePixelRatio",{value:3,configurable:true});
for(const hz of [120,90,144]) {
 engine.fly('spill');assert.equal(app.querySelector('.ac-canvas').width,width*2,'Spill caps DPR at 2');engine.world.ready=false;engine.world.spill.phase='wave';engine.world.spill.nextRock=1000;
 engine.world.spill.nextNut=1000;engine.world.spill.nextSpecial=1000;
 const startT=engine.world.spill.t,startClears=clears;
 for(let i=0;i<hz;i++){now+=1000/hz;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}
 assert(Math.abs(engine.world.spill.t-startT-1)<1e-6,`${hz} Hz preserves one second of simulation`);
 assert(clears-startClears>=59&&clears-startClears<=61,`${hz} Hz paints ${clears-startClears} frames, expected 60`);
}
// Pinning changes only the home list, never equipment, credit, or purchases.
engine.open('hangar');engine.setShopTab('suits');
const pin=app.querySelector('[data-reward-pin^="suit:"]');assert(pin);const key=pin.dataset.rewardPin;
const equipped=engine.save.equippedSuit,wallet=engine.save.acorns;
pin.click();assert(engine.save.pinnedRewards.includes(key));assert.equal(engine.save.equippedSuit,equipped);assert.equal(engine.save.acorns,wallet);
assert(Save.loadSave().pinnedRewards.includes(key));
engine.open('title');assert(app.querySelector('.ac-pinnedreward'));assert(app.querySelector('.ac-pinnedopen progress'));
app.querySelector('.ac-pinnedopen').click();assert.equal(engine.world.screen,'hangar');
engine.open('title');app.querySelector('[data-reward-pin]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
assert(!engine.save.pinnedRewards.includes(key));assert(!app.querySelector('.ac-pinnedreward'));
engine.stop();await win.happyDOM.close();console.log('spill UI: button/gesture/keyboard ownership, pause preferences, prompt filtering, unchanged hazard warnings/pacing, Loadout planning, Depot purchases/refits/contracts, save/resume and endless continuation pass');
