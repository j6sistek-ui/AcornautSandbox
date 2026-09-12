#!/usr/bin/env node
// THE TEST LAB's door, sheet and Flight Test dock, driven through the real
// menu and engine in happy-dom. Layout is not measured here; wiring is.
//   beta        the flask is on the Home rail, the sheet lists the Flight
//               Test, the worn suit's dials and every lab page; the Modes
//               sheet carries no lab door any more; FLIGHT TEST launches a
//               run with the dock, and the dock's controls reach the sim
//   production  no flask, no doors, nothing to start
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const mode=process.argv[2];
if(!mode){for(const page of ['production','beta'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),page],{stdio:'inherit'});process.exit(0);}
assert(['production','beta'].includes(mode));
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM||'happy-dom');
const win=new Window({url:`http://local/${mode==='production'?'':'beta/'}`});
win.__ACORNAUT_BETA__=mode==='beta';
const backgrounds=new WeakMap();
const bg=Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype,'backgroundImage');
Object.defineProperty(win.CSSStyleDeclaration.prototype,'backgroundImage',{configurable:true,
  get(){return backgrounds.get(this)??bg?.get?.call(this)??'';},set(value){backgrounds.set(this,value);bg?.set?.call(this,value);}});
let now=0,id=0;const frames=new Map();
for(const k of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])Object.defineProperty(globalThis,k,{value:k==='window'?win:win[k],configurable:true,writable:true});
globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);win.requestAnimationFrame=requestAnimationFrame;win.cancelAnimationFrame=cancelAnimationFrame;
globalThis.Image=class {set src(v){queueMicrotask(()=>this.onerror?.());}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
// the run paints its procedural sky through image data, so the buffers
// must be real-sized; everything else is a no-op
const pixels=(w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(4,(w|0)*(h|0)*4)),width:w|0||1,height:h|0||1});
const ctx=new Proxy({measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
  createImageData:(w,h)=>pixels(w,h),getImageData:(x,y,w,h)=>pixels(w,h),getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=()=>ctx;
win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:390,height:500,right:390,bottom:500};};
win.HTMLElement.prototype.scrollIntoView=function(){};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const S=await import('../docs/js/save.js'),Cat=await import('../docs/js/catalog.js');
const save=S.defaultSave();Object.assign(save,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true,equippedSuit:'iontrim'});S.writeSave(save);
const {bootStandalone}=await import('../docs/js/standalone.js');const app=document.createElement('main');document.body.append(app);await bootStandalone(app);const e=win.__sandbox;assert(e);
const tick=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}};
const button=text=>[...app.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(text));
const byLabel=label=>app.querySelector(`button[aria-label="${label}"]`);

e.open('title');tick(2);
assert(app.querySelector('.ac-hub'),'the Home hub rendered');
const flask=byLabel('Test Lab');

if(mode==='production'){
  assert.equal(flask,null,'production: no Test Lab door on the Home rail');
  assert(button('MODES'),'production: Modes tile');button('MODES').click();tick();
  assert(!button('RIG EDITOR')&&!button('BACKGROUND TEST MODE'),'production: no lab doors on Modes');
  assert.equal(e.world.flightTest,null);
  console.log(JSON.stringify({suite:'test lab ui',page:mode,result:'PASS'}));
  process.exit(0);
}

// ---- beta: the door and the sheet ------------------------------------------
assert(flask,'beta: the flask sits on the Home rail');
assert(flask.classList.contains('ac-hub-sq'),'beta: it is the same painted square as its neighbours');
assert.equal(Cat.IS_BETA,true);
flask.click();tick();
const sheet=app.querySelector('.ac-testlab');
assert(sheet,'beta: the Test Lab sheet opened');
assert(sheet.textContent.includes(`dev ${Cat.DEV_STAMP}`),'beta: the sheet prints the dev stamp');
assert(button('FLIGHT TEST'),'beta: the Flight Test door');
for(const door of ['RIG EDITOR','SHIP BENCH','BACKGROUND TEST MODE','VISUAL AUDIT','FLIGHT LAB PAGE','HIGH ORBIT','PREMIUM PILOTS'])
  assert(button(door),`beta: lab door ${door}`);
// just the doors: no dial on the sheet (owner, 12 Sep 2026: "clean it up")
assert(!sheet.querySelector('.ac-suit-pitch')&&!sheet.querySelector('.ac-lab')&&!sheet.textContent.includes('TAP ACCENT'),'beta: the sheet carries no dials');
// reset takes two taps
button('RESET ALL DIALS TO STOCK').click();tick();
assert(button('TAP AGAIN TO RESET EVERY DIAL'),'beta: the first tap only arms the reset');
e.setTapAccent(true);e.setTapAccentStrength(4);tick();assert.equal(e.save.tapAccent,true);
button('TAP AGAIN TO RESET EVERY DIAL').click();tick();
assert.equal(e.save.tapAccent,false,'beta: the second tap resets the accent switch');
assert.equal(e.save.tapAccentStrength,undefined,'beta: and the strength');
assert.equal(e.save.testLab,undefined,'beta: and the Flight Test settings');
// the Modes sheet is modes only now
app.querySelector('.ac-testlab .ac-backbtn').click();tick();
assert(!app.querySelector('.ac-testlab'),'beta: back closes the sheet');
button('MODES').click();tick();
assert(!button('RIG EDITOR')&&!button('BACKGROUND TEST MODE'),'beta: the lab doors left the Modes sheet');
assert(!app.textContent.includes('PROTOTYPES'),'beta: no PROTOTYPES divider anywhere');
app.querySelector('.ac-modecard .ac-backbtn').click();tick();

// ---- beta: the Flight Test and its dock ------------------------------------
byLabel('Test Lab').click();tick();
button('FLIGHT TEST').click();tick(2);
assert(e.world.flightTest,'beta: FLIGHT TEST armed the sim');
assert.equal(e.world.screen,'play');
assert.equal(e.world.planets.length,0,'beta: the sky is empty');
const dock=app.querySelector('.ac-ftdock');
assert(dock,'beta: the dock rides the run');
for(const label of ['MANUAL','HOVER','2/s','4/s','6/s','8/s','PAIRS','STATION'])assert(button(label),`beta: pattern ${label}`);
button('6/s').click();tick();
assert.equal(e.world.flightTest.pattern,'6','beta: the dock sets the pattern');
assert.equal(e.save.testLab.pattern,'6','beta: and saves it');
button('½×').click();tick();
assert.equal(e.world.timeScale,0.5,'beta: half speed');
assert.equal(e.save.testLab.speed,0.5);
button('HOLD').click();tick();
assert.equal(e.world.timeScale,0,'beta: a hold stops the world');
assert.equal(e.save.testLab.speed,0.5,'beta: a hold is not saved as the speed');
const t0=e.world.time;
button('STEP').click();tick();
assert(e.world.time>t0,'beta: STEP advanced one tick');
button('RESUME').click();tick();
assert.equal(e.world.timeScale,0.5,'beta: resume returns to the saved speed');
// the autopilot flies through the real loop
const taps0=e.world.run.taps;
tick(240);
assert(e.world.run.taps>taps0,`beta: the autopilot tapped through the loop (${e.world.run.taps-taps0})`);
assert.equal(e.world.screen,'play','beta: and the run is still going');
const reads=[...app.querySelectorAll('.ac-ftreads b')].map(b=>b.textContent);
assert(reads.length===5&&reads.every(r=>r!=='—'||true),'beta: five readouts');
assert(reads[4]!=='—'&&Number(reads[4])>0,`beta: the taps/s readout is live (${reads[4]})`);
// the dials fold out inside the run - the only place they live now
button('ION DIALS').click();tick();
const dials=app.querySelector('.ac-ftdock .ac-testlab-dials');
assert(dials,'beta: the worn suit\'s dials fold out in the dock');
assert(dials.textContent.includes('TAP ACCENT')&&dials.textContent.includes('REPEAT TAP')&&dials.textContent.includes('TAP SHAPE')&&dials.textContent.includes('PITCH'),'beta: every dial is in the dock');
e.setTapAccent(true);tick();
assert(app.querySelector('.ac-ftdock input[aria-label="Strength"]'),'beta: the accent strength slider is in the dock with the accent on');
// the transport row has its own 1x; the strength buttons are inside the dials
const dialBtn=t=>[...app.querySelectorAll('.ac-ftdock .ac-testlab-dials button')].find(b=>b.textContent.trim()===t);
dialBtn('3×').click();tick();
assert.equal(e.save.tapAccentStrength,3,'beta: 3x sets the strength');
dialBtn('1×').click();tick();
assert.equal(e.save.tapAccentStrength,undefined,'beta: 1x is stock and stores nothing');
// back to the lab: the sheet is waiting on Home
button('TEST LAB').click();tick(2);
assert.equal(e.world.screen,'title');
assert(app.querySelector('.ac-testlab'),'beta: TEST LAB returns to the sheet');
// a plain flight carries nothing over
app.querySelector('.ac-testlab .ac-backbtn').click();tick();
e.fly('fly');tick();
assert.equal(e.world.flightTest,null,'beta: a plain free flight is not a Flight Test');
assert.equal(e.world.timeScale,1);
console.log(JSON.stringify({suite:'test lab ui',page:mode,result:'PASS'}));
