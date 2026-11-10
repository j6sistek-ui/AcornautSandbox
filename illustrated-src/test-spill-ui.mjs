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
const STICK_CARDS=['HOLD + DRAG','2ND FINGER','FLICK ◀ ▶'],OLD_WORDS=['SWIPE DOWN','Throttle','throttle','Tap to fly','tap to fly','LUNGE'];
function cardsOf(root){return [...root.querySelectorAll('.ac-spillhelp-controls > div')].map(c=>c.querySelector('b').textContent);}
const helpFlight=app.querySelector('[data-help-mode="spill"]');assert(helpFlight);assert.deepEqual(cardsOf(helpFlight),STICK_CARDS);
assert(helpFlight.textContent.includes('W / S · ↑ / ↓'));assert(helpFlight.textContent.includes('F · Space'));assert(helpFlight.textContent.includes('A / D · ← / →'));
assert([...helpFlight.querySelectorAll('small.ac-sub')].some(n=>n.textContent.includes('Space')));
assert(helpFlight.textContent.includes('Hold anywhere to steer'));assert(helpFlight.querySelector('.ac-spilldepth'),'Help sums up weapons, patrols, artifacts and routes');assert(helpFlight.querySelector('.ac-hazard-guide'),'and carries the hazard field guide');assert(!helpFlight.textContent.includes('Depot every 5 waves · spend Acorn Coins · first upgrade free.'),'long loop explanation stays in the briefing, not the compact Help controls');
for(const word of OLD_WORDS) assert(!helpFlight.textContent.includes(word),`Help never says ${word} about the Debris Field`);
const beforeHelp=JSON.stringify(engine.save);
const helpBriefing=helpFlight.querySelector('[data-spill-briefing]');assert(helpBriefing);helpBriefing.click();assert(app.querySelector('.ac-spillhelpwrap'));
assert(app.textContent.includes('HOW TO FLY · DEBRIS FIELD'));assert.deepEqual(cardsOf(app.querySelector('.ac-spillhelpwrap')),STICK_CARDS);
for(const word of OLD_WORDS) assert(!app.querySelector('.ac-spillhelpwrap').textContent.includes(word),`the briefing never says ${word}`);
assert.equal(app.querySelectorAll('.ac-spillhelpwrap [data-guide-utility]').length,3,'the briefing lists the shelf utilities in one compact row');
assert.equal(control('enter-depot').textContent,'BACK TO HELP');
app.querySelector('.ac-depotguidecard').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
assert(!app.querySelector('.ac-spillhelpwrap'));assert.equal(engine.world.screen,'help');
assert.equal(document.activeElement.dataset.spillBriefing,'');
assert.equal(JSON.stringify(engine.save),beforeHelp);
// THE SHIP TAB IS THE ENGINE COLOUR PICKER (owner, 12 Sep 2026: "Remove
// everything from the ship loadout page except the engine color"). Starters
// still equip through the engine, gated on the earned wave, with no picker.
engine.save.spillBest=4;engine.open('hangar');engine.setShopTab('ship');
assert.equal(app.querySelectorAll('[data-ship-tier]').length,0,'no tier shelves on the ship tab');
assert.equal(app.querySelectorAll('[data-ship-spec]').length,0,'no specialty options on the ship tab');
assert.equal(app.querySelectorAll('[data-ship-starter]').length,0,'no starting-utility picker on the ship tab');
assert(!app.textContent.includes('SHOW LAUNCH SHIP')&&!app.textContent.includes('DEPOT BUILD PREVIEW')&&!app.textContent.includes('DEPOT SERVICES'),'the build planner is gone');
assert(!app.textContent.includes('UNDER CONSTRUCTION'));assert(!app.textContent.includes('not active yet'));
engine.spillStarter('magnet');assert.equal(engine.save.spillStarter,null,'an unearned starter cannot be equipped');
engine.save.spillBest=20;engine.setShopTab('ship');engine.spillStarter('magnet');assert.equal(Save.loadSave().spillStarter,'magnet');
ship('color','copper').click();assert.equal(Save.loadSave().spillEngineColor,'copper');assert.equal(Save.loadSave().spillSignal,true);
assert.equal(app.querySelectorAll('[data-ship-color]').length,5);assert(ship('color','void').disabled);assert(!engine.setSpillEngineColor('void'));
engine.save.spillBest=30;engine.setShopTab('ship');assert.equal(ship('color','copper').getAttribute('aria-pressed'),'true','a new earned color does not replace the chosen color');
ship('color','void').click();assert.equal(Save.loadSave().spillEngineColor,'void');ship('color','copper').click();
assert(app.querySelector('.ac-caseplate')?.textContent.includes('Engine color'),'the case plate names the engine color');
// ONE INSTRUCTIONS SHEET before an endless run: how to fly, the loop, the ship. Nothing to choose.
engine.fly('spill');const setup=app.querySelector('.ac-spillsetup');assert(setup);assert(setup.querySelector('h2').textContent==='How to fly');assert(!app.textContent.includes('Your next ship'));
assert.deepEqual(cardsOf(setup),STICK_CARDS,'the instructions sheet shows the three steering cards');
const setupNotes=[...setup.querySelectorAll('.ac-spillhelp-controls small.ac-sub')].map(n=>n.textContent);assert.deepEqual(setupNotes,['W / S · ↑ / ↓','F · Space','A / D · ← / →']);
for(const word of OLD_WORDS) assert(!setup.textContent.includes(word),`the instructions sheet never says ${word}`);
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
assert.equal(app.querySelectorAll('.ac-spillhelpwrap [data-guide-utility]').length,3);
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
assert(app.querySelector('.ac-setup-coach').textContent.includes('FIRST FLIGHT SETUP · 1 / 3'),'a first run is a guided three-step setup');assert(app.textContent.includes('Pick one free upgrade for your ship'));
assert(!app.querySelector('.ac-career-fold')&&!app.querySelector('.ac-hazard-forecast'),'guided setup shows the three steps and nothing else');
assert.equal(app.querySelectorAll('.ac-workshop-system').length,4,'the opening Depot offers the four core upgrades');
assert(!app.querySelector('.ac-workshop-utilities'),'utilities do not appear in the opening Depot');
for(const id of ['magnet','scanner','brake','capacitor']) assert(!app.querySelector(`[data-spill-control="${id}"]`));
assert(!app.querySelector('[data-spill-control="repair"]'));assert(!app.querySelector('[data-spill-control="core"]'));assert(!app.querySelector('[data-spill-control^="contract-"]'),'no repair, extra life or contracts before takeoff');
control('guide').click();assert(app.querySelector('.ac-depotguidecard'));assert.equal(control('enter-depot').textContent,'BACK TO DEPOT');
assert(app.textContent.includes('Unlocks stay'));assert(app.textContent.includes('2 new each Depot · 2nd slot after wave 10'));
assert.equal(app.querySelectorAll('[data-guide-utility]').length,3,'the guide shows the shelf utilities in one compact row');assert(!app.querySelector('.ac-guide-kit'));
assert(!app.textContent.includes('Pull Acorn Coins'),'guide utilities carry a short name, no description');
const guideCardOrder=[...app.querySelector('.ac-depotguidecard').children].map(c=>c.className);assert(guideCardOrder.indexOf('ac-guide-systems')<guideCardOrder.indexOf('ac-guide-utilityrow'),'systems come before utilities');
control('enter-depot').click();assert(!app.querySelector('.ac-depotguidecard'));assert.equal(JSON.stringify(engine.world.spill),guidedState,'the guide changes no run state');assert(control('launch').disabled);
control('inspect-thrusters').click();control('thrusters').click();assert.equal(engine.world.spill.up.thrusters,1);assert.equal(engine.world.spill.ore,0);
// step 2: the weapon is a tap either way; step 3: launch the training flight
assert(control('launch').disabled);assert.equal(control('launch').textContent,'PICK YOUR WEAPON');assert(app.querySelector('.ac-setup-coach').textContent.includes('2 / 3'));
assert.equal(control('weapon-laser').textContent,'Keep');control('weapon-laser').click();assert(app.querySelector('.ac-setup-coach').textContent.includes('3 / 3'));
assert.equal(control('launch').textContent,'START TRAINING FLIGHT');assert(!control('launch').disabled);control('launch').click();
// TRAINING FLIGHT: a live but harmless field - flight, a dash, three pieces of debris, one patrol to evade and shoot down.
{const d=engine.world.spill,cv=engine.canvas,skip=app.querySelector('.ac-drill-skip'),stepId=()=>S.spillDrillStep(d);
 assert.equal(d.phase,'wave');assert.equal(stepId(),'steer','a first run starts in training');
 tick(240);assert.equal(stepId(),'steer','training waits for the pilot');assert(!skip.hidden,'training can be skipped');
 const tp=(type,id,x,y,primary=true)=>cv.dispatchEvent(new win.PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:primary,clientX:x,clientY:y,bubbles:true,cancelable:true}));
 const key=(type,code)=>win.dispatchEvent(new win.KeyboardEvent(type,{code}));
 let heldKey=0;const steer=dir=>{if(dir===heldKey)return;if(heldKey)key('keyup',heldKey<0?'KeyW':'KeyS');if(dir)key('keydown',dir<0?'KeyW':'KeyS');heldKey=dir;};
 tp('pointerdown',31,100,300);tp('pointermove',31,100,350);tick(40);assert.equal(stepId(),'hold','steering passes');
 tp('pointerup',31,100,350);win.dispatchEvent(new win.PointerEvent('pointerup',{pointerId:31,bubbles:true}));tick(30);assert.equal(stepId(),'dash','letting go passes');
 key('keydown','KeyF');tick(6);assert.equal(d.combat.shots.length,0,'no weapon before its lesson');key('keyup','KeyF');
 key('keydown','KeyD');key('keyup','KeyD');tick(2);assert.equal(stepId(),'debris','a dash passes');
 const hull=d.hull;let guard=0;
 while(stepId()==='debris'&&guard++<4000){const rock=d.rocks.find(r=>!r.dead);steer(rock&&Math.abs(rock.y-d.pilot.y)<90?(rock.y>d.H/2?-1:1):0);tick(1);}
 assert.equal(stepId(),'evade','three dodged pieces pass the debris stage');steer(0);
 guard=0;while(stepId()==='evade'&&guard++<5000){const e=d.combat.enemies.find(x=>!x.dead),shot=d.combat.shots.find(x=>!x.dead&&x.team==='enemy');
  const y=shot?shot.y:e&&e.telegraph>0?e.aimY:null;steer(y!=null&&Math.abs(y-d.pilot.y)<70?(d.pilot.y>d.H/2?-1:1):0);tick(1);}
 assert.equal(stepId(),'fire','evading a warned shot passes');steer(0);key('keydown','KeyF');
 guard=0;while(stepId()==='fire'&&guard++<5000){const e=d.combat.enemies.find(x=>!x.dead);if(e)steer(Math.abs(e.y-d.pilot.y)<12?0:e.y>d.pilot.y?1:-1);tick(1);}
 key('keyup','KeyF');steer(0);assert.equal(stepId(),'ready','shooting the patrol down passes');assert.equal(d.hull,hull,'training costs no health');
 tick(90);assert(!d.drill,'training ends');assert.equal(d.phase,'countdown');assert.equal(Save.loadSave().spillDrillDone,true,'and is remembered');tick(1);assert(skip.hidden);
 assert.deepEqual([d.score,d.ore,d.combat.kills],[0,0,0],'nothing from training is kept');}
tick(181);
assert.deepEqual(engine.world.spill.up,{plating:0,thrusters:1,pulse:0},'only the chosen starting upgrade is fitted');
// DEBRIS FIELD STEERING (3 Nov 2026): hold + drag steers, release holds altitude, a second
// finger fires, a flick or A/D dodges, W/S steer and F/Space fire. The pads are retired.
assert(!app.querySelector('.ac-spillcontrols')&&!app.querySelector('.ac-thrust'),'the on-screen pads are retired');
const stick=app.querySelector('.ac-floating-stick');assert(stick&&stick.hidden,'the stick waits for a finger');
const sp=engine.world.spill,canvas=engine.canvas;
function touch(target,type,id,x=100,y=300,primary=true){target.dispatchEvent(new win.PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:primary,clientX:x,clientY:y,bubbles:true,cancelable:true}));}
touch(canvas,'pointerdown',10,100,300);tick(2);assert(engine.spillControls().active&&!stick.hidden,'a held finger shows the stick');
touch(canvas,'pointermove',10,100,350);tick(2);assert(sp.steerY>0,'dragging down steers down');
tick(3);assert(!stick.hidden,'HUD updates keep the stick');
touch(canvas,'pointerdown',11,260,300,false);assert(sp.combat.firing,'a second finger fires');
touch(win,'pointerup',11);assert(!sp.combat.firing,'lifting it stops firing');assert(engine.spillControls().active,'and the steering finger keeps the stick');
touch(win,'pointerup',10);tick(2);assert.equal(sp.steerY,0,'release holds altitude');assert(stick.hidden);
win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'KeyW'}));assert(sp.steerY<0,'W steers up');
win.dispatchEvent(new win.KeyboardEvent('keyup',{code:'KeyW'}));assert.equal(sp.steerY,0,'and letting go holds');
win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'KeyF'}));assert(sp.combat.firing,'F fires');
win.dispatchEvent(new win.KeyboardEvent('keyup',{code:'KeyF'}));assert(!sp.combat.firing);
const charges=sp.lungeCharges;win.dispatchEvent(new win.KeyboardEvent('keydown',{code:'KeyA'}));assert.equal(sp.lungeCharges,charges-1,'A dodges');assert.equal(sp.lungeDir,-1,'backwards');
win.dispatchEvent(new win.KeyboardEvent('keyup',{code:'KeyA'}));
touch(canvas,'pointerdown',12);engine.pause();assert(!engine.spillControls().active&&!sp.combat.firing,'a pause drops every held input');
// Pause preferences persist. Hiding text changes no simulation state or hazard warnings.
assert(!app.querySelector('[role="switch"][aria-label="On-screen buttons"]'),'no pad switch any more');
assert(app.querySelector('.ac-spillloadout').textContent.startsWith('Rapid Laser I'),'the pause names the loadout');
const pausedState=JSON.stringify(engine.world.spill);app.querySelector('[role="switch"][aria-label="Instructional prompts"]').click();assert.equal(Save.loadSave().spillPromptsOff,true);assert.equal(JSON.stringify(engine.world.spill),pausedState,'prompt setting does not alter wave pacing');
engine.resume();
const Draw=await import(new URL('../docs/js/draw.js',import.meta.url).href);const labels=[];ctx.fillText=t=>labels.push(t);const flight=engine.world.spill;
flight.hint='TEST INSTRUCTION';flight.hintT=5;flight.banner='HAZARD WARNING';flight.bannerT=1;
Draw.drawHud(ctx,engine.world,engine.art,engine.save);assert(!labels.includes('TEST INSTRUCTION'));assert(labels.includes('HAZARD WARNING'));
engine.pause();app.querySelector('[role="switch"][aria-label="Instructional prompts"]').click();engine.resume();labels.length=0;Draw.drawHud(ctx,engine.world,engine.art,engine.save);assert(labels.includes('TEST INSTRUCTION'));
ctx.fillText=()=>{};flight.lunge=0;flight.lungeCharges=1;flight.cool=0;flight.pilot.y=flight.H*.45;flight.pilot.vy=0;
// Another finger's release cannot end the steering finger; blur and resize still pause.
function pointer(type,id,x,y){canvas.dispatchEvent(new win.PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:true,bubbles:true}));}
pointer('pointerdown',1,100,300);now+=800;pointer('pointerup',2,100,300);assert(engine.spillControls().active,'a stray release leaves the stick alone');pointer('pointerup',1,100,300);
pointer('pointerdown',3,100,300);win.dispatchEvent(new win.Event('blur'));assert.equal(engine.world.screen,'pause');engine.resume();assert.equal(engine.world.screen,'play');pointer('pointerdown',4,100,300);width=320;engine.resize();assert.equal(engine.world.screen,'pause');engine.resume();
const s=fixture();const initial=s.ore;assert.equal(app.querySelectorAll('.ac-workshop-system').length,4);assert.equal(app.querySelectorAll('.ac-workshop-utility').length,2,'two new shelf items per Depot');assert.equal(app.querySelectorAll('.ac-workshop-weapon').length,2,'one card per weapon');
control('inspect-pulse').click();assert.equal(s.ore,initial,'inspecting a system is not a purchase');control('inspect-plating').click();
control('plating').click();assert.equal(s.up.plating,1);assert.equal(s.ore,initial-60);assert.equal(engine.save.spillSuspended.state.up.plating,1);
control('plating').click();assert(button('Impact Bracing'));control('brace').click();assert.equal(s.specialties.plating,'brace');
control('inspect-shield').click();control('shield').click();assert.equal(s.canopyLevel,1);assert.equal(s.shield,1);
// THE SHELF: utilities and artifacts in one list, two new items per Depot, one slot before wave 10.
const shelfCards=()=>[...app.querySelectorAll('.ac-workshop-utility')];const shelfButton=key=>app.querySelector(`[data-shelf="${key}"] button`);
assert.equal(shelfCards().length,2,'two offers at the wave 5 Depot');assert(!app.querySelector('[data-spill-control="brake"]'),'the Brake left the shelf');
const [first,second]=shelfCards().map(c=>c.dataset.shelf);const card=app.querySelector('.ac-depotcard');card.scrollTop=820;
const fittedNote=()=>app.querySelector('.ac-shelf-fitted').textContent;assert(fittedNote().includes('nothing yet'));
const before=s.ore;shelfButton(first).click();const firstPrice=before-s.ore;assert(firstPrice>0,'a new item is bought');assert.equal(app.querySelector('.ac-depotcard').scrollTop,820);
assert(shelfButton(first).textContent.includes('Undo'),'a purchase this visit can be undone');assert(!fittedNote().includes('nothing yet'),'the fitted note names it');
assert(app.querySelector('.ac-workshop-utilities').textContent.includes('2nd after wave 10'),'one slot before wave 10');
assert(shelfButton(second).textContent.includes('Swap'),'a second item at the cap offers a swap');shelfButton(second).click();
if(first.startsWith('artifact:')&&second.startsWith('artifact:'))assert(!app.querySelector('.ac-workshop-swap'),'a second artifact trades places directly');
else{assert(app.querySelector('.ac-workshop-swap'),'the cap opens the replace prompt');control('cancel-swap').click();assert(!app.querySelector('.ac-workshop-swap'));shelfButton(second).click();app.querySelector('.ac-workshop-swap .ac-workshop-secondary').click();}
assert(shelfButton(second).textContent.includes('Undo'));const swapped=s.ore;shelfButton(second).click();assert.equal(s.ore,before-firstPrice,'undo refunds the swap');
assert(shelfButton(first).textContent.includes('Undo'),'and puts the replaced item back');assert.equal(shelfCards().length,2,'only the two offers are listed');
assert(!app.querySelector('.ac-workshop-extras'),'no extra-life / bonus-goal page');assert.equal(control('risk-standard').getAttribute('aria-pressed'),'true','Harder defaults to No');control('risk-volatile').click();assert.equal(s.expedition.selected,'volatile');assert.equal(control('risk-volatile').getAttribute('aria-pressed'),'true');
const records=structuredClone(engine.save.spillRecords),ore=s.ore;control('save').click();assert.equal(engine.world.screen,'title');assert(engine.save.spillSuspended);
engine.open('hangar');engine.setShopTab('ship');const savedCheckpoint=JSON.stringify(engine.save.spillSuspended);assert(![...app.querySelectorAll('button')].some(b=>b.textContent==='VIEW SAVED BUILD'),'the saved-build inspector left the ship tab with the planner');assert.equal(JSON.stringify(engine.save.spillSuspended),savedCheckpoint,'opening the ship tab does not edit the checkpoint');
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
  assert(app.querySelector('.ac-floating-stick').hidden);
  const time=s.phaseT;engine.pause();tick(60);assert.equal(s.phaseT,time);engine.resume();
  tick(220);assert.equal(s.phase,'docking');assert(!app.querySelector('[data-spill-control="inspect-plating"]'));
  tick(10);
 }
 assert.equal(s.phase,'depot');assert.equal(s.depotVisits,0);assert(s.freeUpgrade);
 assert(app.querySelector('[data-spill-control="inspect-plating"]'));
}
engine.stop();await win.happyDOM.close();console.log('spill UI: one instructions sheet, guide by request only, all utility cards, atomic swap/refit, purchases, scroll/focus, earned engine colors/migration, rematch selection, save/resume, input/pause, paint budget and Vanguard landing passed');
