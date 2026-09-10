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
const ctx=new Proxy({canvas:null,clearRect(){clears++;},measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)}),getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return new Proxy(ctx,{get:(o,k)=>k==='clearRect'?()=>{if(canvas.classList.contains('ac-canvas'))clears++;}:o[k]});};let width=390;win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width,height:760,right:width,bottom:760};};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const Save=await import(new URL('../docs/js/save.js',import.meta.url).href),S=await import(new URL('../docs/js/spill.js',import.meta.url).href);const save=Save.defaultSave();save.tutorialDone=true;save.guide='done';save.introOff=true;save.musicOff=true;save.sfxOff=true;save.spillBest=20;Save.writeSave(save);
const {bootStandalone}=await import(new URL('../docs/js/standalone.js',import.meta.url).href);const app=win.document.createElement('main');win.document.body.append(app);await bootStandalone(app);const engine=win.__sandbox;assert(engine);
function tick(n=1){for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}}
function button(text){const b=[...app.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert(b,`missing button ${text}: ${app.textContent.slice(0,2400)}`);return b;}
function control(id){const b=app.querySelector(`[data-spill-control="${id}"]`);assert(b,`missing Depot control ${id}`);return b;}
function ship(kind,id){const b=app.querySelector(`[data-ship-${kind}="${id}"]`);assert(b,`missing ship ${kind} ${id}`);return b;}
function fixture(wave=5){engine.save.spillStarter=null;engine.fly('spill');const s=engine.world.spill;s.phase='depot';s.wave=s.cleared=wave;s.depot={arm:0,bought:[]};s.ore=2000;s.oreMined=70;s.depotVisits=wave/5;s.expeditionDone=wave>=20;engine.world.ready=false;s.cues=['depot'];tick();return s;}
// Briefing replay is informational: it neither starts a run nor writes the
// save. The planet tutorial and currency cluster remain.
engine.open('help');
assert(app.textContent.includes('SWIPE DOWN'));assert(button('REPLAY TUTORIAL'));
assert.deepEqual([...app.querySelectorAll('.ac-helprow')].slice(0,3).map(r=>r.querySelector('p').textContent),['ACORN','STAR DUST','ACORN COINS']);
// TAP TO FLY in Settings & Help: the same three cards as the instructions sheet, and no hold left anywhere.
const TAP_CARDS=['TAP','SWIPE DOWN','LUNGE'],HOLD_WORDS=['HOLD','RELEASE','Throttle','throttle','hold to','Let go'];
function cardsOf(root){return [...root.querySelectorAll('.ac-spillhelp-controls > div')].map(c=>c.querySelector('b').textContent);}
const helpFlight=app.querySelector('.ac-spillflighthelp');assert(helpFlight);assert.deepEqual(cardsOf(helpFlight),TAP_CARDS);
assert(helpFlight.textContent.includes('Thrust pad'));assert(helpFlight.textContent.includes('Drag down'));assert(helpFlight.textContent.includes('Swipe right'));
assert(helpFlight.querySelector('small.ac-sub').textContent.includes('Thrust pad'));
assert(helpFlight.textContent.includes('Swipe up for a harder kick · W key'));assert(helpFlight.textContent.includes('Depot every 5 waves · spend Acorn Coins · first upgrade free.'));
for(const word of HOLD_WORDS) assert(!helpFlight.textContent.includes(word),`Help never says ${word} about the Debris Field`);
const beforeHelp=JSON.stringify(engine.save);
button('DEBRIS FIELD BRIEFING').click();assert(app.querySelector('.ac-spillhelpwrap'));
assert(app.textContent.includes('HOW TO FLY · DEBRIS FIELD'));assert.deepEqual(cardsOf(app.querySelector('.ac-spillhelpwrap')),TAP_CARDS);
for(const word of HOLD_WORDS) assert(!app.querySelector('.ac-spillhelpwrap').textContent.includes(word),`the briefing never says ${word}`);
assert.equal(app.querySelectorAll('.ac-spillhelpwrap [data-guide-utility]').length,4,'the briefing lists the four utilities in one compact row');
assert.equal(control('enter-depot').textContent,'BACK TO HELP');
app.querySelector('.ac-depotguidecard').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
assert(!app.querySelector('.ac-spillhelpwrap'));assert.equal(engine.world.screen,'help');
assert.equal(document.activeElement.dataset.spillBriefing,'');
assert.equal(JSON.stringify(engine.save),beforeHelp);
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
ship('tier','thrusters-3').click();ship('tier','pulse-2').click();ship('spec','efficient').click();assert(!app.querySelector('[data-ship-utility]'),'the preview-only utility shelf is gone; Starting utility is the one picker');assert.equal(app.querySelectorAll('[data-ship-starter]').length,5,'exactly one Starting utility picker: stock plus the four utilities, no duplicate shelf');assert.equal(ship('starter','magnet').getAttribute('aria-pressed'),'true');assert.equal(ship('starter','scanner').getAttribute('aria-pressed'),'false');assert(app.querySelector('.ac-shipreadout').textContent.includes('1/2 UTILITIES'),'the plan previews the chosen starter in its slot readout');
ship('tier','plating-1').click();assert(ship('spec','brace').disabled);assert.equal(JSON.stringify(engine.save),savedLaunch,'planning changes no save fields');
button('SHOW LAUNCH SHIP').click();assert.equal(ship('tier','plating-0').getAttribute('aria-pressed'),'true');
// ONE INSTRUCTIONS SHEET before an endless run: how to fly, the loop, the ship. Nothing to choose.
engine.fly('spill');const setup=app.querySelector('.ac-spillsetup');assert(setup);assert(setup.querySelector('h2').textContent==='How to fly');assert(!app.textContent.includes('Your next ship'));
assert.deepEqual(cardsOf(setup),TAP_CARDS,'the instructions sheet shows the three tap-to-fly cards');
const setupNotes=[...setup.querySelectorAll('.ac-spillhelp-controls small.ac-sub')].map(n=>n.textContent);assert.deepEqual(setupNotes,['Tap the field · Thrust pad · Space','Drag down · ↓ key','Swipe right · → key']);
for(const word of HOLD_WORDS) assert(!setup.textContent.includes(word),`the instructions sheet never says ${word}`);
for(const line of ['Survive the waves','Collect Acorn Coins','Depot every 5 waves · upgrade your ship · first upgrade free']) assert(setup.textContent.includes(line),`the loop says ${line}`);
assert(setup.querySelector('.ac-setup-loop .ac-workshop-coin'),'the coin sits where Acorn Coins are named');assert(setup.textContent.includes('aboard'));assert(setup.querySelector('.ac-launch-ship canvas'));
assert(!app.querySelector('[data-ship-starter]'),'the entrance has no utility choices');
assert(!app.querySelector('[data-ship-color]'),'appearance choices stay in Loadout');
assert(!app.querySelector('[data-spill-upgrade]'),'upgrades are chosen at the Depot after landing');
assert(!setup.querySelector('.ac-workshop-system, .ac-workshop-utility, [data-guide-utility]'),'no upgrade or utility choices on the instructions sheet');
assert(!app.querySelector('.ac-setup-body [data-spill-control="land"]'),'Start stays outside the scrolling body');assert(setup.querySelector('.ac-setup-body .ac-spillhelp-controls'),'the cards scroll with the body');
assert.equal(control('land').textContent,'START RUN');assert(button('MAIN MENU'));
assert.deepEqual(engine.world.spill.utilities,['magnet']);assert.equal(engine.save.spillEngineColor,'copper');
assert.equal(engine.save.spillDepotGuideSeen,false,'a fresh save has not seen the briefing');
const beforeBriefing=JSON.stringify(engine.world.spill);
control('setup-guide').click();assert(app.querySelector('.ac-spillhelpwrap'));assert.equal(control('enter-depot').textContent,'BACK TO LAUNCH');
assert.equal(app.querySelectorAll('.ac-spillhelpwrap [data-guide-utility]').length,4);
app.querySelector('.ac-depotguidecard').dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));
app.querySelector('.ac-depotguidecard').dispatchEvent(new win.KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));
assert.equal(JSON.stringify(engine.world.spill),beforeBriefing,'briefing keys never start or steer the ship');
control('enter-depot').click();assert(!app.querySelector('.ac-spillhelpwrap'));assert(app.querySelector('.ac-spillsetup'));
assert.equal(engine.save.spillDepotGuideSeen,false,'the replay records nothing: START RUN does');
assert.equal(document.activeElement.dataset.spillControl,'setup-guide');

control('land').click();assert.equal(engine.world.spill.phase,'docking');
assert.equal(engine.save.spillDepotGuideSeen,true,'START RUN records that the briefing was shown');assert.equal(Save.loadSave().spillDepotGuideSeen,true);
tick(200);
// The Depot opens straight onto the free upgrade: no guide sheet on arrival, ever.
assert.equal(engine.world.spill.depotVisits,0);assert(!app.querySelector('.ac-depotguidecard'),'the Depot never opens its guide on its own');assert(control('plating'));
const guidedState=JSON.stringify(engine.world.spill);assert(control('launch').disabled);assert.equal(control('launch').textContent,'CHOOSE FREE UPGRADE');
assert(app.textContent.includes('Choose one free upgrade'));assert(app.textContent.includes('One free upgrade before takeoff'));
assert.equal(app.querySelectorAll('.ac-workshop-system').length,4,'the opening Depot offers the four core upgrades');
assert(!app.querySelector('.ac-workshop-utilities'),'utilities do not appear in the opening Depot');
for(const id of ['magnet','scanner','brake','capacitor']) assert(!app.querySelector(`[data-spill-control="${id}"]`));
assert(!app.querySelector('[data-spill-control="repair"]'));assert(!app.querySelector('[data-spill-control="core"]'));assert(!app.querySelector('[data-spill-control^="contract-"]'),'no repair, extra life or contracts before takeoff');
control('guide').click();assert(app.querySelector('.ac-depotguidecard'));assert.equal(control('enter-depot').textContent,'BACK TO DEPOT');
assert(app.textContent.includes('Unlocks stay'));assert(app.textContent.includes('From the wave 5 Depot · fit 2'));
assert.equal(app.querySelectorAll('[data-guide-utility]').length,4,'the guide shows the four utilities in one compact row');assert(!app.querySelector('.ac-guide-kit'));
assert(!app.textContent.includes('Pull Acorn Coins'),'guide utilities carry a short name, no description');
const guideCardOrder=[...app.querySelector('.ac-depotguidecard').children].map(c=>c.className);assert(guideCardOrder.indexOf('ac-guide-systems')<guideCardOrder.indexOf('ac-guide-utilityrow'),'systems come before utilities');
control('enter-depot').click();assert(!app.querySelector('.ac-depotguidecard'));assert.equal(JSON.stringify(engine.world.spill),guidedState,'the guide changes no run state');assert(control('launch').disabled);
control('inspect-thrusters').click();control('thrusters').click();assert.equal(engine.world.spill.up.thrusters,1);assert.equal(engine.world.spill.ore,0);
assert.equal(control('launch').textContent,'LAUNCH WAVE 1');control('launch').click();assert.equal(engine.world.spill.phase,'countdown');tick(181);
assert.deepEqual(engine.world.spill.up,{plating:0,thrusters:1,pulse:0},'only the chosen starting upgrade is fitted');
// TAP TO FLY: the Thrust pad, a tap on the field and Space are the same kick. Taps never stack,
// key repeats are not taps, and nothing has to be released.
const thrust=app.querySelector('.ac-thrust'),controls=app.querySelector('.ac-spillcontrols');assert(thrust&&!controls.hidden);
assert(!app.querySelector('.ac-throttle'),'the Throttle hold is retired');assert.equal(thrust.getAttribute('aria-label'),'Thrust: tap to fly');
function touch(target,type,id,primary=true){target.dispatchEvent(new win.PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:primary,clientX:100,clientY:300,bubbles:true,cancelable:true}));}
const sp=engine.world.spill;sp.pilot.vy=0;
touch(thrust,'pointerdown',11,false);assert.equal(sp.pilot.vy,-S.SPILL.tapVy,'a press on the pad is the tap kick');assert(thrust.classList.contains('firing'),'the pad glows for the kick');
tick(3);assert.equal(app.querySelector('.ac-thrust'),thrust,'HUD update retains the pad');
touch(thrust,'pointerdown',12,false);assert.equal(sp.pilot.vy,-S.SPILL.tapVy,'a second press never stacks past the tap speed');
touch(win,'pointerup',11);touch(win,'pointerup',12);assert.equal(sp.pilot.vy,-S.SPILL.tapVy,'releases change nothing: there is no hold to let go of');
sp.pilot.vy=0;touch(engine.canvas,'pointerdown',10);assert.equal(sp.pilot.vy,-S.SPILL.tapVy,'a tap on the field is the same kick');touch(engine.canvas,'pointerup',10);
app.querySelector('.ac-dive').click();assert(sp.pilot.vy>0,'Dive is the burst down');
sp.pilot.vy=0;win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space'}));assert.equal(sp.pilot.vy,-S.SPILL.tapVy,'Space is a tap');
sp.pilot.vy=0;win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space',repeat:true}));assert.equal(sp.pilot.vy,0,'a held key repeat is not a stream of taps');
win.dispatchEvent(new win.KeyboardEvent('keyup',{code:'Space'}));
engine.pause();assert(controls.hidden);engine.resume();assert(!controls.hidden);
sp.pilot.vy=0;win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space',repeat:true}));assert.equal(sp.pilot.vy,0,'a stale held-key repeat cannot tap after pause');
sp.pilot.vy=0;thrust.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true}));assert.equal(sp.pilot.vy,-S.SPILL.tapVy,'Space on the focused pad taps once');
sp.pilot.vy=0;thrust.dispatchEvent(new win.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true,repeat:true}));assert.equal(sp.pilot.vy,0,'and a held key on the pad does not repeat');
thrust.dispatchEvent(new win.KeyboardEvent('keyup',{code:'Space',bubbles:true,cancelable:true}));
const charges=engine.world.spill.lungeCharges;app.querySelector('.ac-lunge').click();assert.equal(engine.world.spill.lungeCharges,charges-1);assert(app.querySelector('.ac-lunge').disabled);assert(app.querySelector('.ac-lunge').textContent.includes('RECHARGING'));
// Pause preferences persist. Hiding text changes no simulation state or hazard warnings.
engine.pause();app.querySelector('[role="switch"][aria-label="On-screen buttons"]').click();assert.equal(Save.loadSave().spillButtonsOff,true);
const pausedState=JSON.stringify(engine.world.spill);app.querySelector('[role="switch"][aria-label="Instructional prompts"]').click();assert.equal(Save.loadSave().spillPromptsOff,true);assert.equal(JSON.stringify(engine.world.spill),pausedState,'prompt setting does not alter wave pacing');
engine.resume();assert(controls.hidden);sp.pilot.vy=0;engine.spillThrust();assert.equal(sp.pilot.vy,0,'hidden controls cannot tap');
const Draw=await import(new URL('../docs/js/draw.js',import.meta.url).href);const labels=[];ctx.fillText=t=>labels.push(t);const flight=engine.world.spill;
flight.hint='TEST INSTRUCTION';flight.hintT=5;flight.banner='HAZARD WARNING';flight.bannerT=1;
Draw.drawHud(ctx,engine.world,engine.art,engine.save);assert(!labels.includes('TEST INSTRUCTION'));assert(labels.includes('HAZARD WARNING'));
engine.pause();app.querySelector('[role="switch"][aria-label="Instructional prompts"]').click();app.querySelector('[role="switch"][aria-label="On-screen buttons"]').click();engine.resume();assert(!controls.hidden);labels.length=0;Draw.drawHud(ctx,engine.world,engine.art,engine.save);assert(labels.includes('TEST INSTRUCTION'));
ctx.fillText=()=>{};flight.lunge=0;flight.lungeCharges=1;flight.cool=0;flight.pilot.y=flight.H*.45;flight.pilot.vy=0;
// A swipe still lands after a long rest on the field; a second finger's release cannot end the first finger's swipe.
const canvas=engine.canvas;function pointer(type,id,x,y){canvas.dispatchEvent(new win.PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:true,bubbles:true}));}
pointer('pointerdown',1,100,300);now+=800;pointer('pointerup',2,100,300);pointer('pointermove',1,155,300);assert(engine.world.spill.lunge>0,'a swipe after a long rest still lunges, and another finger cannot cancel it');pointer('pointerup',1,155,300);
pointer('pointerdown',3,100,300);win.dispatchEvent(new win.Event('blur'));assert.equal(engine.world.screen,'pause');engine.resume();assert.equal(engine.world.screen,'play');pointer('pointerdown',4,100,300);width=320;engine.resize();assert.equal(engine.world.screen,'pause');engine.resume();
const s=fixture();const initial=s.ore;assert.equal(app.querySelectorAll('.ac-workshop-system').length,4);assert.equal(app.querySelectorAll('.ac-workshop-slots > span').length,2);
control('inspect-pulse').click();assert.equal(s.ore,initial,'inspecting a system is not a purchase');control('inspect-plating').click();
control('plating').click();assert.equal(s.up.plating,1);assert.equal(s.ore,initial-60);assert.equal(engine.save.spillSuspended.state.up.plating,1);
control('plating').click();assert(button('Impact Bracing'));control('brace').click();assert.equal(s.specialties.plating,'brace');
control('inspect-shield').click();control('shield').click();assert.equal(s.canopyLevel,1);assert.equal(s.shield,1);
assert.equal(app.querySelectorAll('.ac-workshop-utility').length,4,'all four utilities appear at the wave 5 Depot');const card=app.querySelector('.ac-depotcard');card.scrollTop=820;control('magnet').focus();control('magnet').click();
assert.equal(app.querySelector('.ac-depotcard').scrollTop,820);assert.equal(document.activeElement.dataset.spillControl,'magnet');control('scanner').click();assert(app.querySelector('.ac-workshop-utilities').textContent.includes('2 / 2 fitted'),'the live utility shelf is capped at two slots');assert(control('brake').textContent.includes('Swap'),'a third utility at the cap offers a swap, never a third slot');assert(!control('brake').disabled);control('brake').click();assert(app.querySelector('.ac-workshop-swap'),'the cap opens the replace prompt instead of fitting a third');assert.deepEqual(s.utilities,['magnet','scanner']);
control('cancel-swap').click();assert.deepEqual(s.utilities,['magnet','scanner']);control('brake').click();control('replace-magnet').click();assert.deepEqual(s.utilities,['brake','scanner']);
const swapOre=s.ore;control('scanner').click();control('magnet').click();assert.equal(s.ore,swapOre,'owned utilities refit free');assert.deepEqual(s.utilities,['brake','magnet']);
const extras=app.querySelector('.ac-workshop-extras');extras.open=true;extras.dispatchEvent(new win.Event('toggle'));control('contract-clean').click();assert(app.querySelector('.ac-workshop-extras').open,'bonus goals stay open after choosing');assert(s.contract);
const records=structuredClone(engine.save.spillRecords),ore=s.ore;control('save').click();assert.equal(engine.world.screen,'title');assert(engine.save.spillSuspended);
engine.open('hangar');engine.setShopTab('ship');const savedCheckpoint=JSON.stringify(engine.save.spillSuspended);button('VIEW SAVED BUILD').click();assert.equal(ship('tier','plating-2').getAttribute('aria-pressed'),'true');ship('tier','plating-0').click();assert.equal(JSON.stringify(engine.save.spillSuspended),savedCheckpoint,'inspecting a saved build does not edit its checkpoint');
ship('color','cobalt').click();assert(engine.spillResume());tick(50);assert.equal(engine.world.spill.signal,'#79cfff','resuming uses the selected engine color');engine.setSpillEngineColor('copper');assert.equal(engine.world.spill.ore,ore);assert.deepEqual(engine.save.spillRecords,records);assert(app.querySelector('[role="dialog"]'));control('launch').click();assert.equal(engine.world.spill.wave,6);assert.equal(engine.save.spillSuspended,null);
engine.save.spillBest=19;
const end=fixture(20);assert.equal(engine.world.screen,'play');assert(end.firstPass);assert(app.textContent.includes('First pass complete'));assert(!app.textContent.includes('FINISH EXPEDITION'));assert.equal(engine.save.spillRecords.expeditions,1);assert.equal(engine.save.spillRecords.runs,0);
control('plating').click();const hull=end.maxHull,bank=end.ore;control('save').click();assert(engine.spillResume());tick(50);assert(engine.world.spill.firstPass);assert(app.textContent.includes('First pass complete'));
assert.equal(control('launch').textContent,'LAUNCH WAVE 21');control('launch').click();assert.equal(engine.world.screen,'play');assert.equal(engine.world.spill.wave,21);assert.equal(engine.world.spill.maxHull,hull);assert.equal(engine.world.spill.ore,bank);assert(!engine.world.spill.firstPass);
const later=fixture(20);assert(!later.firstPass);assert(!app.textContent.includes('First pass complete'));assert(!app.textContent.includes('FINISH EXPEDITION'));control('launch').click();assert.equal(later.wave,21);assert.equal(engine.world.screen,'play');assert.equal(engine.save.spillRecords.expeditions,2);assert.equal(engine.save.spillRecords.runs,0);
// A rematch returns to the instructions sheet and a stock ship; the Depot still opens without its guide.
engine.world.spill.phase='over';engine.world.spill.hull=0;engine.world.spill.cause='impact';engine.world.spill.cues=['dead'];tick();
button('CHOOSE SHIP & FLY AGAIN').click();assert(app.querySelector('.ac-spillsetup'));assert.equal(engine.world.spill.hull,3);assert.equal(engine.world.spill.ore,0);
assert.deepEqual(engine.world.spill.up,{plating:0,thrusters:0,pulse:0});assert.equal(engine.save.spillEngineColor,'copper');
assert(!app.querySelector('[data-ship-starter]'));control('land').click();tick(200);assert(!app.querySelector('.ac-depotguidecard'));assert(control('launch').disabled);
// A mission (target > 0) has no sheet: the canvas ready card, a tap, then the same welcome Depot with its free upgrade and no guide.
engine.fly('spill');engine.world.spill.target=3;engine.spillLunge();assert.equal(engine.world.spill.phase,'docking');assert(!app.querySelector('.ac-spillsetup'));tick(200);
assert.equal(engine.world.spill.phase,'depot');assert(!app.querySelector('.ac-depotguidecard'),'a mission lands on the free upgrade with no guide');assert(engine.world.spill.freeUpgrade);
assert.equal(app.querySelectorAll('.ac-workshop-system').length,4);assert(!app.querySelector('.ac-workshop-utilities'));assert.equal(control('launch').textContent,'CHOOSE FREE UPGRADE');assert(control('launch').disabled);assert(!app.querySelector('[data-spill-control="save"]'),'missions cannot save and exit');
control('guide').click();assert.equal(control('enter-depot').textContent,'BACK TO DEPOT');assert(app.textContent.includes('Survive 3 waves.'));control('enter-depot').click();assert(!app.querySelector('.ac-depotguidecard'));
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
engine.stop();await win.happyDOM.close();console.log('spill UI: one instructions sheet, guide by request only, all utility cards, atomic swap/refit, purchases, scroll/focus, earned engine colors/migration, rematch selection, save/resume, input/pause, paint budget and Vanguard landing passed');
