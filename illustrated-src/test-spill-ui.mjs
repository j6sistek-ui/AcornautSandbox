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
win.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return new Proxy(ctx,{get:(o,k)=>k==='clearRect'?()=>{if(canvas.classList.contains('ac-canvas'))clears++;}:o[k]});};let width=390;win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width,height:760,right:width,bottom:760};};
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
ship('color','copper').click();assert.equal(Save.loadSave().spillEngineColor,'copper');assert.equal(Save.loadSave().spillSignal,true);
assert.equal(app.querySelectorAll('[data-ship-color]').length,5);assert(ship('color','void').disabled);assert(!engine.setSpillEngineColor('void'));
engine.save.spillBest=30;engine.setShopTab('ship');assert.equal(ship('color','copper').getAttribute('aria-pressed'),'true','a new earned color does not replace the chosen color');
ship('color','void').click();assert.equal(Save.loadSave().spillEngineColor,'void');ship('color','copper').click();
const savedLaunch=JSON.stringify(engine.save);assert(ship('spec','brace').disabled);ship('tier','plating-2').click();ship('spec','brace').click();
ship('tier','thrusters-3').click();ship('tier','pulse-2').click();ship('spec','efficient').click();ship('utility','scanner').click();assert(ship('utility','brake').disabled);
ship('tier','plating-1').click();assert(ship('spec','brace').disabled);assert.equal(JSON.stringify(engine.save),savedLaunch,'planning changes no save fields');
button('SHOW LAUNCH SHIP').click();assert.equal(ship('tier','plating-0').getAttribute('aria-pressed'),'true');
engine.fly('spill');assert(app.querySelector('.ac-spillsetup'));assert(app.textContent.includes('Your next ship'));
const setup=app.querySelector('.ac-spillsetup');setup.scrollTop=250;ship('starter','scanner').focus();ship('starter','scanner').click();assert.equal(app.querySelector('.ac-spillsetup').scrollTop,250);assert.equal(document.activeElement.dataset.shipStarter,'scanner');assert.deepEqual(engine.world.spill.utilities,['scanner']);ship('starter','magnet').click();
assert.deepEqual(engine.world.spill.utilities,['magnet']);assert.equal(ship('color','copper').getAttribute('aria-pressed'),'true');
control('land').click();assert.equal(engine.world.spill.phase,'docking');tick(200);
assert.equal(engine.world.spill.depotVisits,0);assert(app.querySelector('.ac-depotguidecard'));assert(!app.querySelector('[data-spill-control="plating"]'));
const guidedState=JSON.stringify(engine.world.spill);control('enter-depot').click();assert.equal(Save.loadSave().spillDepotGuideSeen,true);
assert.equal(JSON.stringify(engine.world.spill),guidedState,'the guide changes no run state');assert(control('launch').disabled);
control('guide').click();assert(app.textContent.includes('Unlocks stay'));control('enter-depot').click();assert.equal(JSON.stringify(engine.world.spill),guidedState);
control('inspect-thrusters').click();control('thrusters').click();assert.equal(engine.world.spill.up.thrusters,1);assert.equal(engine.world.spill.ore,0);
assert.equal(control('launch').textContent,'Launch wave 1 →');control('launch').click();assert.equal(engine.world.spill.phase,'countdown');tick(181);
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
const s=fixture();const initial=s.ore;assert.equal(app.querySelectorAll('.ac-workshop-system').length,4);assert.equal(app.querySelectorAll('.ac-workshop-slots > span').length,2);
control('inspect-pulse').click();assert.equal(s.ore,initial,'inspecting a system is not a purchase');control('inspect-plating').click();
control('plating').click();assert.equal(s.up.plating,1);assert.equal(s.ore,initial-60);assert.equal(engine.save.spillSuspended.state.up.plating,1);
control('plating').click();assert(button('Impact Bracing'));control('brace').click();assert.equal(s.specialties.plating,'brace');
control('inspect-shield').click();control('shield').click();assert.equal(s.canopyLevel,1);assert.equal(s.shield,1);
assert.equal(app.querySelectorAll('.ac-workshop-utility').length,4,'all utilities are visible without a tab');const card=app.querySelector('.ac-depotcard');card.scrollTop=820;control('magnet').focus();control('magnet').click();
assert.equal(app.querySelector('.ac-depotcard').scrollTop,820);assert.equal(document.activeElement.dataset.spillControl,'magnet');control('scanner').click();assert(!control('brake').disabled);control('brake').click();assert.deepEqual(s.utilities,['magnet','scanner']);
control('cancel-swap').click();assert.deepEqual(s.utilities,['magnet','scanner']);control('brake').click();control('replace-magnet').click();assert.deepEqual(s.utilities,['brake','scanner']);
const swapOre=s.ore;control('scanner').click();control('magnet').click();assert.equal(s.ore,swapOre,'owned utilities refit free');assert.deepEqual(s.utilities,['brake','magnet']);
const extras=app.querySelector('.ac-workshop-extras');extras.open=true;extras.dispatchEvent(new win.Event('toggle'));control('contract-clean').click();assert(app.querySelector('.ac-workshop-extras').open,'bonus goals stay open after choosing');assert(s.contract);
const records=structuredClone(engine.save.spillRecords),ore=s.ore;control('save').click();assert.equal(engine.world.screen,'title');assert(engine.save.spillSuspended);
engine.open('hangar');engine.setShopTab('ship');const savedCheckpoint=JSON.stringify(engine.save.spillSuspended);button('VIEW SAVED BUILD').click();assert.equal(ship('tier','plating-2').getAttribute('aria-pressed'),'true');ship('tier','plating-0').click();assert.equal(JSON.stringify(engine.save.spillSuspended),savedCheckpoint,'inspecting a saved build does not edit its checkpoint');
ship('color','cobalt').click();assert(engine.spillResume());tick(50);assert.equal(engine.world.spill.signal,'#79cfff','resuming uses the selected engine color');engine.setSpillEngineColor('copper');assert.equal(engine.world.spill.ore,ore);assert.deepEqual(engine.save.spillRecords,records);assert(app.querySelector('[role="dialog"]'));control('launch').click();assert.equal(engine.world.spill.wave,6);assert.equal(engine.save.spillSuspended,null);
engine.save.spillBest=19;
const end=fixture(20);assert.equal(engine.world.screen,'play');assert(end.firstPass);assert(app.textContent.includes('First pass complete'));assert(!app.textContent.includes('FINISH EXPEDITION'));assert.equal(engine.save.spillRecords.expeditions,1);assert.equal(engine.save.spillRecords.runs,0);
control('plating').click();const hull=end.maxHull,bank=end.ore;control('save').click();assert(engine.spillResume());tick(50);assert(engine.world.spill.firstPass);assert(app.textContent.includes('First pass complete'));
assert.equal(control('launch').textContent,'Launch wave 21 →');control('launch').click();assert.equal(engine.world.screen,'play');assert.equal(engine.world.spill.wave,21);assert.equal(engine.world.spill.maxHull,hull);assert.equal(engine.world.spill.ore,bank);assert(!engine.world.spill.firstPass);
const later=fixture(20);assert(!later.firstPass);assert(!app.textContent.includes('First pass complete'));assert(!app.textContent.includes('FINISH EXPEDITION'));control('launch').click();assert.equal(later.wave,21);assert.equal(engine.world.screen,'play');assert.equal(engine.save.spillRecords.expeditions,2);assert.equal(engine.save.spillRecords.runs,0);
// A rematch always returns to an explicit, editable starting ship; guide is shown once.
engine.world.spill.phase='over';engine.world.spill.hull=0;engine.world.spill.cause='impact';engine.world.spill.cues=['dead'];tick();
button('CHOOSE SHIP & FLY AGAIN').click();assert(app.querySelector('.ac-spillsetup'));assert.equal(engine.world.spill.hull,3);assert.equal(engine.world.spill.ore,0);
assert.deepEqual(engine.world.spill.up,{plating:0,thrusters:0,pulse:0});assert.equal(ship('color','copper').getAttribute('aria-pressed'),'true');
ship('starter','magnet').click();control('land').click();tick(200);assert(!app.querySelector('.ac-depotguidecard'));assert(control('launch').disabled);
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
// The actual engine admits the extra beat only after complete art readiness
// and only for Vanguard. Its Depot overlay must remain closed throughout it.
const scene={depot:{width:1536,height:1024,naturalWidth:1536,naturalHeight:1024},
 bear:Array.from({length:36},()=>({image:{width:256,height:240},footX:128,footY:230})),
 vanguardDepot:{width:1280,height:1280,naturalWidth:1280,naturalHeight:1280}};
engine.art.spillShip['hull-0']={width:256,height:256,box:{x:20,y:90,w:210,h:70},core:210,coreX:125,coreY:125};
for(const [suit,motionOff,ready,plays] of [['vanguard',false,true,true],['flight',false,true,false],['vanguard',true,true,false],['vanguard',false,false,false]]){
 engine.save.equippedSuit=suit;engine.save.motionOff=motionOff;
 engine.art.spillScene={...scene,vanguardDepot:ready?scene.vanguardDepot:undefined};
 engine.fly('spill');control('land').click();const s=engine.world.spill;
 tick(145);
 if(plays){
  assert.equal(s.phase,'docking');assert.equal(s.depotGag,true);
  assert(!app.querySelector('[data-spill-control="inspect-plating"]'));
  assert(app.querySelector('.ac-spillcontrols').hidden);
  const time=s.phaseT;engine.pause();tick(60);assert.equal(s.phaseT,time);engine.resume();
  tick(220);assert.equal(s.phase,'docking');assert(!app.querySelector('[data-spill-control="inspect-plating"]'));
  tick(10);
 }
 assert.equal(s.phase,'depot');assert.equal(s.depotVisits,0);assert(s.freeUpgrade);
 assert(app.querySelector('[data-spill-control="inspect-plating"]'));
}
engine.stop();await win.happyDOM.close();console.log('spill UI: guide once/replay, all utility cards, atomic swap/refit, purchases, scroll/focus, earned engine colors/migration, rematch selection, save/resume, input/pause, paint budget and Vanguard landing passed');
