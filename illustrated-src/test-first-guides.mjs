#!/usr/bin/env node
// FIRST-TIME PROMPTS (owner, 26 Sep 2026): the Debris Field free-pick nudge, the
// pals guide and the Star Chart guide. DOM integration test on happy-dom, so it
// checks classes, timing and state, not painted animation.
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
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const Save=await import(new URL('../docs/js/save.js',import.meta.url).href);
const Camp=await import(new URL('../docs/js/campaign.js',import.meta.url).href);
const W=await import(new URL('../docs/js/spill-workshop.js',import.meta.url).href);
const save=Save.defaultSave();Object.assign(save,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,spillBest:20});Save.writeSave(save);
const {bootStandalone}=await import(new URL('../docs/js/standalone.js',import.meta.url).href);const app=win.document.createElement('main');win.document.body.append(app);await bootStandalone(app);const engine=win.__sandbox;assert(engine);
function tick(n=1){for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}}
const q=s=>app.querySelector(s);

// ---- THE FREE-PICK NUDGE on the pre-flight Depot
engine.fly('spill');tick(2);q('[data-spill-control="land"]').click();
for(let i=0;i<900&&!q('.ac-workshop-system');i++)tick();
assert(q('.ac-workshop-system'),'the pre-flight Depot opens');
// the Depot arrives locked for a moment (SPILL.depotArm) so a stray tap buys
// nothing; the nudge stays off through the lock and its clock still runs
assert(engine.world.spill.depot.arm>0,'the arrival lock is on');assert(!q('.ac-workshop-hinting'),'no nudge while the Depot is locked');
for(let i=0;i<600&&engine.world.spill.depot.arm>0;i++)tick();tick(2);
let card=q('.ac-workshop-card');
assert(card.classList.contains('ac-workshop-hinting'),'the free pick carries the nudge');
const delay=()=>parseInt(q('.ac-workshop-card').style.getPropertyValue('--hint-delay'),10);
assert(delay()>0&&delay()<=W.DEPOT_HINT_MS,`the nudge waits after the Depot opens (${delay()}ms)`);
assert(q('.ac-workshop-stage').classList.contains('ac-workshop-hint-arrows'),'arrows point at the four options');
assert.equal(app.querySelectorAll('.ac-workshop-hint-ring').length,1,'one ring, on the button that fits the free upgrade');
assert.equal(q('.ac-workshop-hint-ring').dataset.spillControl,'plating','the ring sits on the selected option\'s Free button');
tick(240);// four seconds on: a redraw resumes the pulse rather than restarting it
q('[data-spill-control="inspect-thrusters"]').click();
assert(delay()<=0,`a redraw after the wait keeps the nudge showing (${delay()}ms)`);
assert(!q('.ac-workshop-stage').classList.contains('ac-workshop-hint-arrows'),'the arrows stop once an option is tapped');
assert.equal(q('.ac-workshop-hint-ring')?.dataset.spillControl,'thrusters','the ring follows to the chosen option');
q('[data-spill-control="thrusters"]').click();tick(90);
assert(!q('.ac-workshop-hinting')&&!q('.ac-workshop-hint-ring'),'no nudge once the free upgrade is fitted');
engine.open('title');tick(2);

// ---- THE PALS GUIDE
Object.assign(engine.save,{palGuideSeen:false,chartGuideSeen:false,helpOff:false,guide:'done'});
engine.open('hangar');engine.setShopTab('pals');tick(2);
let sheet=q('[data-guide-sheet="pals"]');assert(sheet,'the pals guide opens on the first visit to the PALS tab');
assert(sheet.textContent.includes(`★ ${Camp.STAR_UNLOCKS.dualPal}`),'it names the real second-seat star count');
assert(sheet.textContent.includes('Pal Effects Off')&&sheet.textContent.includes('Star Chart missions bring their own pal'));
q('[data-guide-close="pals"]').click();tick(2);
assert(!q('[data-guide-sheet="pals"]'),'GOT IT closes it');assert.equal(engine.save.palGuideSeen,true,'and it is remembered');
engine.open('title');engine.open('hangar');engine.setShopTab('pals');tick(2);
assert(!q('[data-guide-sheet="pals"]'),'it does not open by itself twice');
q('[data-guide="pals"]').click();tick(2);assert(q('[data-guide-sheet="pals"]'),'"How pals work" reopens it');
q('[data-guide-close="pals"]').click();tick(2);

// ---- THE STAR CHART GUIDE
engine.save.guide='levels';engine.open('title');engine.open('log');tick(2);
assert(!q('[data-guide-sheet="chart"]'),'it waits while the guided start points at Mission 1');
engine.save.guide='done';engine.open('title');engine.open('log');tick(2);
sheet=q('[data-guide-sheet="chart"]');assert(sheet,'the chart guide opens on the first visit after the guided start');
assert(sheet.textContent.includes('Missions pick your pal for you'),'it says missions pick the pal');
assert(sheet.textContent.includes(`${Camp.SUB_ACORNS} acorns instead`),'it names the real owned-rung payout');
q('[data-guide-close="chart"]').click();tick(2);
assert(!q('[data-guide-sheet="chart"]'));assert.equal(engine.save.chartGuideSeen,true);
engine.open('title');engine.open('log');tick(2);assert(!q('[data-guide-sheet="chart"]'),'shown once');
q('[data-guide="chart"]').click();tick(2);assert(q('[data-guide-sheet="chart"]'),'the "?" reopens it');
q('[data-guide-close="chart"]').click();tick(2);

// ---- HELP PROMPTS OFF keeps both shut; the "?" still works
Object.assign(engine.save,{palGuideSeen:false,chartGuideSeen:false,helpOff:true});
engine.open('title');engine.open('log');tick(2);assert(!q('[data-guide-sheet="chart"]'));
engine.open('hangar');engine.setShopTab('pals');tick(2);assert(!q('[data-guide-sheet="pals"]'));
q('[data-guide="pals"]').click();tick(2);assert(q('[data-guide-sheet="pals"]'));

// ---- THE COPY IS TRUE: some production missions fly a pal, some fly none
const withPal=Camp.CHART_LEVELS.filter(l=>l.fx?.pal).length;
assert(withPal>0&&withPal<Camp.CHART_LEVELS.length,'the road has missions with a pal and missions without');
// every pal is free, as the pals guide says
assert(Save.palUnlocked(engine.save,'nutsack')&&Save.palUnlocked(engine.save,'ufo')&&Save.palUnlocked(engine.save,'buddy'));

engine.stop();await win.happyDOM.close();
console.log(`first-time prompts: Depot nudge waits ${W.DEPOT_HINT_MS}ms, survives redraws, arrows leave on a tap, ring follows the choice; pals and Star Chart guides show once, respect guided start and help-off, reopen from "?"; ${withPal} of ${Camp.CHART_LEVELS.length} missions fly their own pal`);
