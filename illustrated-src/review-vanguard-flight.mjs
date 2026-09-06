#!/usr/bin/env node
/**
 * Review footage from the actual simulation, production painter and shipped art.
 * This is native-canvas footage, not an iPhone/browser capture. The primary clip
 * keeps the ordinary 390 × 760 camera and never resets the pilot's position.
 * Only the separately labeled contact fixture follows a taller test chamber.
 *
 * After building docs/js:
 * ACORNAUT_CANVAS=/path/to/@napi-rs/canvas ACORNAUT_QA_OUTPUT=/tmp/review \
 *   node --experimental-default-type=module --experimental-specifier-resolution=node \
 *   illustrated-src/review-vanguard-flight.mjs
 * Encode phone-frames and contact-frames at 30 fps; simulation runs at 60 Hz.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const {createCanvas, loadImage, Image, GlobalFonts} = require(
  process.env.ACORNAUT_CANVAS || '@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'Vanguard Sans');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.ACORNAUT_QA_OUTPUT || join(tmpdir(), 'acornaut-vanguard-review');
mkdirSync(output, {recursive:true});
const pending = [];
class LocalImage extends Image {
  set src(value) {
    this.sourceFile = value;
    const ready = this.onload, failed = this.onerror;
    pending.push(new Promise(done => {
      this.onload = () => {ready?.(); done();};
      this.onerror = e => {failed?.(e); done();};
      // File paths avoid native-canvas mistaking embedded C2PA for SVG.
      try {super.src = value.split('?')[0];} catch (e) {this.onerror(e);}
    }));
  }
  get src() {return super.src;}
}
globalThis.Image = LocalImage;
globalThis.HTMLImageElement = Image;
globalThis.window = {
  __ACORNAUT_BETA__:true, __ACORNAUT_ART__:join(root, 'docs/art'),
  location:{href:'http://local/beta/', search:'?star-map=sample'},
  devicePixelRatio:1, addEventListener(){},
  matchMedia:() => ({matches:false, addEventListener(){}}),
};
globalThis.document = {
  createElement:() => createCanvas(1,1), addEventListener(){}, documentElement:{style:{}},
};
globalThis.localStorage = {getItem:() => null, setItem(){}, removeItem(){}};

const [A,D,S,Sim,VG,Cat] = await Promise.all([
  import('../docs/js/art.js'), import('../docs/js/draw.js'), import('../docs/js/save.js'),
  import('../docs/js/sim.js'), import('../docs/js/vanguard.js'), import('../docs/js/catalog.js'),
]);
async function sprite(file) {
  const im = await loadImage(join(root, 'docs/art', file)); im.sourceFile = file;
  const c = createCanvas(im.width, im.height), g = c.getContext('2d');
  g.drawImage(im,0,0);
  const data = g.getImageData(0,0,im.width,im.height).data;
  let x=im.width,y=im.height,right=0,bottom=0;
  for (let j=0;j<im.height;j++) for (let i=0;i<im.width;i++) {
    if (data[(j*im.width+i)*4+3] <= 12) continue;
    x=Math.min(x,i); y=Math.min(y,j); right=Math.max(right,i); bottom=Math.max(bottom,j);
  }
  im.box={x,y,w:right-x+1,h:bottom-y+1}; im.core=Math.max(im.box.w,im.box.h);
  im.coreX=x+im.box.w/2; im.coreY=y+im.box.h/2;
  return im;
}
const art=A.emptyArt(); art.ready=true;
art.suits.vanguard=await sprite('suits/vanguard.png'); art.vanguard=[];
art.vanguardParts=await sprite('suits/vanguard/maneuver-parts.png');
for (let i=1;i<=VG.VANGUARD_FRAMES;i++) art.vanguard.push(await sprite(`suits/vanguard/frame-${i}.png`));
art.squirrelIdle=[await sprite('squirrel/idle-1.png')]; art.squirrelFlap=art.squirrelIdle;
art.helms.clear=await sprite('helms/clear.png');
for (let i=0;i<33;i++) art.planets.push(await sprite(`planets/${i}.png`));
for (let i=0;i<27;i++) art.debris.push(await sprite(`debris/${i}.png`));
const baseSave=S.defaultSave();
Object.assign(baseSave,{equippedSuit:'vanguard',equippedTrail:'ion',tutorialDone:true,guide:'done'});
const styles=[
  {mode:'cinematic',title:'ORIGINAL',subtitle:'Current cinematic flight',color:'#c9c4b8'},
  {mode:'cruise',title:'FLIGHT',subtitle:'Asymmetric reach · maneuver banks',color:'#96e8f3'},
  {mode:'jetpack',title:'UPRIGHT',subtitle:'Bent-knee hover · rise/fall · push-off',color:'#f2cc81'},
];
const authoritativeKeys=[
  'squirrel','run','score','distance','screen','ready','tapAnimT','tapAnimDir','bounceAnimT',
];
const traceKeys=[
  'mode','frame','phase','time','heading','pitch','nearArm','farArm','nearLeg','farLeg',
  'settle','drive','thrust','thrustLeft','thrustPower','contactAge','contactPower','diving',
];
function makeRuns(height) {
  return styles.map(style => {
    const save={...baseSave,vanguardMotionMode:style.mode},w=Sim.makeWorld(390,height);
    Sim.resetRun(w,save,'fly',false);
    w.planets=[]; w.pickups=[]; w.lastSpawnX=100000;
    return {style,save,w,canvas:createCanvas(390,760),tail:new Set(),headings:[],
      poseBanks:new Set(),tailBaseAngles:[],tailTipAngles:[],
      probe:createCanvas(256,256),paints:[],contactCount:0,minY:Infinity,maxY:-Infinity,minimumVy:Infinity,maximumVy:-Infinity};
  });
}
function equality(runs,tick,clip) {
  for (let i=1;i<runs.length;i++) for (const key of authoritativeKeys) {
    assert.deepEqual(runs[0].w[key],runs[i].w[key],`${clip} ${key}: ${runs[i].style.mode} at tick ${tick}`);
  }
}
function stateTrace(run) {
  return {...Object.fromEntries(traceKeys.map(k=>[k,run.w.vanguard[k]])),
    rates:{...run.w.vanguard.rates},maneuver:structuredClone(run.w.vanguard.maneuver),contacts:run.w.vanguard.contacts.map(p=>({...p}))};
}
function text(g,value,x,y,size=14,color='#aabacf',weight='400') {
  g.font=`${weight} ${size}px "Vanguard Sans"`;g.fillStyle=color;g.fillText(value,x,y);
}
function stats(values) {
  const sorted=[...values].sort((a,b)=>a-b),p=f=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*f))];
  return {samples:sorted.length,minMs:sorted[0],medianMs:p(.5),p95Ms:p(.95),maxMs:sorted.at(-1)};
}
const film=createCanvas(1260,1220),g=film.getContext('2d');
async function settleImages(runs) {
  // Paint before recording so lazy zone-background loading cannot turn the
  // first seconds into incomplete art. No simulation state is advanced.
  for (const r of runs) D.drawWorld(r.canvas.getContext('2d'),r.w,r.save,art);
  while (pending.length) await Promise.all(pending.splice(0));
}
function paintComparison(runs,tick,scene,cue,inputLabel) {
  g.fillStyle='#07111f';g.fillRect(0,0,1260,1220);
  text(g,'VANGUARD / FLIGHT STUDY',18,31,23,'#f4dbb2','700');
  text(g,scene==='phone'?'390 × 760 gameplay · fixed camera · actual simulation + painter':
    'CONTACT FIXTURE · 5000px chamber · FOLLOW CAMERA · actual collision + painter',18,55,13);
  text(g,`${(tick/60).toFixed(2)}s / ${scene==='phone'?'10.00':'3.00'}s`,1115,31,14,'#d4e6ef');
  for (let i=0;i<runs.length;i++) {
    const run=runs[i],x=i*420,{w}=run;
    text(g,run.style.title,x+15,84,23,run.style.color,'700');
    text(g,run.style.subtitle,x+15,105,12,'#b8c6d4');
    const wc=run.canvas.getContext('2d');wc.clearRect(0,0,390,760);wc.save();
    if (scene==='contact') wc.translate(0,380-w.squirrel.y);
    D.drawWorld(wc,w,run.save,art);wc.restore();
    g.drawImage(run.canvas,x+15,118);
    g.strokeStyle='#345067';g.lineWidth=1;g.strokeRect(x+15.5,118.5,389,759);
    // Event legend belongs to the review surface, not the game renderer.
    g.fillStyle='rgba(4,13,23,.93)';g.fillRect(x+23,821,374,49);
    text(g,cue,x+34,842,12,run.style.color,'700');
    text(g,inputLabel,x+34,860,11,'#c5d4e2');
    text(g,'SAME LIVE POSE / 3×',x+20,903,11,'#97abc2');
    g.save();g.beginPath();g.rect(x+4,910,230,304);g.clip();
    g.translate(x+145,1057);g.scale(3,3);
    if (scene==='contact') {
      // Convert actual world-space surface dust into the pilot close-up.
      VG.paintVanguardContacts(g,{...w.vanguard,contacts:w.vanguard.contacts.map(p=>({
        ...p,x:p.x-w.W*Cat.PHYS.squirrelX,y:p.y-w.squirrel.y,
      }))});
    }
    VG.paintVanguard(g,art,0,0,52,w.vanguard);
    g.restore();
    const state=w.vanguard;
    text(g,w.squirrel.vy< -20?'RISING':w.squirrel.vy>20?'FALLING':'APEX',x+235,938,15,run.style.color,'700');
    text(g,`Vertical speed ${Math.round(w.squirrel.vy)}`,x+235,963,11);
    const rig=VG.articulatedVanguard(state.mode);
    text(g,`Body pitch ${Math.round(rig?state.maneuver.pose.body:state.pitch*180/Math.PI)}°`,x+235,985,11);
    text(g,`Thrust ${Math.round((rig?state.maneuver.pressure:state.thrust)*100)}%`,x+235,1007,11);
    text(g,rig?`Pose: ${state.maneuver.contactAge<.55?'land / push':state.maneuver.bank}`:`Tail ${state.frame+1} / ${VG.VANGUARD_FRAMES}`,x+235,1029,11);
    text(g,`Score ${w.score}`,x+235,1051,11);
  }
}
function trackRun(r) {
  // Measure the FIRST draw after every simulation tick, including cache
  // refreshes. Timing the enlarged second draw would only measure cache hits.
  const probe=r.probe.getContext('2d');probe.clearRect(0,0,256,256);
  probe.save();probe.translate(128,128);probe.scale(3,3);
  const started=performance.now();VG.paintVanguard(probe,art,0,0,52,r.w.vanguard);
  r.paints.push(performance.now()-started);probe.restore();
  const state=r.w.vanguard;
  r.headings.push(VG.articulatedVanguard(state.mode)?state.maneuver.pose.body*Math.PI/180:state.pitch);
  r.poseBanks.add(state.maneuver.bank);
  if(state.maneuver.contactAge<.55)r.poseBanks.add('land');
  r.tailBaseAngles.push(state.maneuver.tailBase);r.tailTipAngles.push(state.maneuver.tailTip);
  r.tail.add(r.w.vanguard.frame);
  r.minY=Math.min(r.minY,r.w.squirrel.y);r.maxY=Math.max(r.maxY,r.w.squirrel.y);
  r.minimumVy=Math.min(r.minimumVy,r.w.squirrel.vy);r.maximumVy=Math.max(r.maximumVy,r.w.squirrel.vy);
}
function runSummary(r) {
  return {mode:r.style.mode,score:r.w.score,...(VG.articulatedVanguard(r.style.mode)?{
      poseBanks:[...r.poseBanks],tailBaseDegrees:[Math.min(...r.tailBaseAngles),Math.max(...r.tailBaseAngles)],
      tailTipDegrees:[Math.min(...r.tailTipAngles),Math.max(...r.tailTipAngles)],
    }:{tailFrames:[...r.tail].sort((a,b)=>a-b)}),
    minY:r.minY,maxY:r.maxY,minimumVy:r.minimumVy,maximumVy:r.maximumVy,
    minBodyPitchDegrees:Math.min(...r.headings)*180/Math.PI,
    maxBodyPitchDegrees:Math.max(...r.headings)*180/Math.PI,contacts:r.contactCount,
    paint:{firstSampleMs:r.paints[0],warmed:stats(r.paints.slice(10))}};
}

const phoneRuns=makeRuns(760);
for (const {w} of phoneRuns) for (let i=0;i<8;i++) {
  w.planets.push({x:350+i*320,gapY:380,gap:420,r:58,topKind:i%33,botKind:(i+4)%33,
    scored:false,drift:0,driftAmp:0,blockers:[]});
}
await settleImages(phoneRuns);
const phoneDir=join(output,'phone-frames');mkdirSync(phoneDir,{recursive:true});
// 180ms cannot fall on every 60 Hz tick: schedule each desired timestamp at
// its nearest actual simulation tick, and retain exact accepted times below.
const bursts=[{start:1,interval:.100,count:4},{start:3,interval:.180,count:4},{start:5,interval:.300,count:4}];
const scriptedTaps=new Map();
for (const burst of bursts) for (let i=0;i<burst.count;i++) {
  scriptedTaps.set(Math.round((burst.start+i*burst.interval)*60),`${Math.round(burst.interval*1000)}ms burst`);
}
const phoneTrace=[],phoneEvents=[];
let lastTap=-Infinity;
for (let tick=0;tick<600;tick++) {
  const w0=phoneRuns[0].w,t=tick/60;
  // Same ordinary-field recovery bot as test-vanguard-flight.mjs. Only the
  // burst cadence varies; no position, velocity, gravity or camera override.
  const botTap=w0.squirrel.y>420&&w0.squirrel.vy>0;
  const tap=tick===0||scriptedTaps.has(tick)||botTap,swipe=tick===450;
  if (tap) {lastTap=tick;phoneEvents.push({tick,time:t,event:'tap',source:scriptedTaps.get(tick)||(tick===0?'start':'height recovery')});}
  if (swipe) phoneEvents.push({tick,time:t,event:'down swipe'});
  for (const run of phoneRuns) {
    if (tap) Sim.flap(run.w,run.save);if (swipe) Sim.dive(run.w,run.save);
    const result=Sim.updateWorld(run.w,run.save,1/60);
    if (result==='bounce') {run.contactCount++;if(run===phoneRuns[0])phoneEvents.push({tick,time:t,event:'planet contact'});}
    assert.equal(run.w.screen,'play',`ordinary field alive at tick ${tick}`);
    assert(run.w.squirrel.y>60&&run.w.squirrel.y<650,`ordinary field pilot visible at tick ${tick}: ${run.w.squirrel.y}`);
    trackRun(run);
  }
  equality(phoneRuns,tick,'phone');
  phoneTrace.push({tick,time:t,tap,swipe,y:w0.squirrel.y,vy:w0.squirrel.vy,score:w0.score,distance:w0.distance,
    legacyClocks:{tapAnimT:w0.tapAnimT,tapAnimDir:w0.tapAnimDir,bounceAnimT:w0.bounceAnimT},
    ...Object.fromEntries(phoneRuns.map(r=>[r.style.mode,stateTrace(r)]))});
  if (tick%2) continue;
  const active=bursts.find(b=>t>=b.start-.15&&t<=b.start+(b.count-1)*b.interval+.45);
  const cue=active?`SHORT TAPS / ${Math.round(active.interval*1000)}ms APART`:
    tick>=450&&tick<485?'DOWN SWIPE / SHALLOW BODY DIVE':'RELEASE / NATURAL RISE AND FALL';
  paintComparison(phoneRuns,tick,'phone',cue,swipe?'Swipe accepted':tick-lastTap<8?'Tap accepted · jet pressure settles':'No tap · real gravity arc');
  const buf=film.toBuffer('image/png');writeFileSync(join(phoneDir,`${String(tick/2).padStart(4,'0')}.png`),buf);
  if (tick===404) writeFileSync(join(output,'Vanguard-Flight-Comparison.png'),buf);
}
for (const r of phoneRuns) {
  if(VG.articulatedVanguard(r.style.mode)){
    for(const bank of ['rise','apex','fall','dive','land'])assert(r.poseBanks.has(bank),`${r.style.mode}: real ${bank} bank`);
  }else assert.equal(r.tail.size,VG.VANGUARD_FRAMES,`${r.style.mode} uses every original tail pose`);
  assert(r.minimumVy<0&&r.maximumVy>0,'real upward and downward travel');
  assert(r.w.score>=5,`${r.style.mode} scores ordinary gates`);
}
writeFileSync(join(output,'phone-trace.json'),JSON.stringify({
  provenance:'Native-canvas rendering of production drawWorld and paintVanguard; not browser/device capture.',
  simulationHz:60,videoFps:30,seconds:10,world:{width:390,height:760,camera:'fixed'},
  physics:Cat.PHYS,bursts,events:phoneEvents,assertedEqualEveryTick:authoritativeKeys,
  runs:phoneRuns.map(runSummary),trace:phoneTrace,
},null,2));

// Optional, deliberately separate inspection of a real planet collision.
// Set up the existing collision fixture once at tick 45, without touching the
// pilot's position or velocity. A tap on the following tick must retain dust
// and compression while the accepted impulse drives the limbs and pack.
const contactRuns=makeRuns(5000);
for (const {w} of contactRuns) w.warpT=0;
await settleImages(contactRuns);
const contactDir=join(output,'contact-frames');mkdirSync(contactDir,{recursive:true});
const contactTaps=new Set([0,11,22,46,57,68]),contactTrace=[],contactEvents=[];
let firstContact=-1;
for (let tick=0;tick<180;tick++) {
  const t=tick/60;
  for (const run of contactRuns) {
    const {w,save}=run;
    if (contactTaps.has(tick)) Sim.flap(w,save);
    if (tick===30) Sim.dive(w,save);
    if (tick===45) {
      w.planets=[{x:w.W*Cat.PHYS.squirrelX+1,gapY:w.squirrel.y+50-110-62,gap:220,r:62,
        topKind:0,botKind:0,scored:false,drift:0,driftAmp:0,blockers:[]}];
    }
    const result=Sim.updateWorld(w,save,1/60);
    if (result==='bounce') {
      run.contactCount++;
      if (run===contactRuns[0]) {if(firstContact<0)firstContact=tick;contactEvents.push({tick,time:t,event:'actual planet contact'});}
    }
    assert.equal(w.screen,'play',`contact chamber alive at tick ${tick}`);
    trackRun(run);
  }
  if (contactTaps.has(tick)) contactEvents.push({tick,time:t,event:'tap'});
  if (tick===30) contactEvents.push({tick,time:t,event:'down swipe'});
  equality(contactRuns,tick,'contact');
  contactTrace.push({tick,time:t,y:contactRuns[0].w.squirrel.y,vy:contactRuns[0].w.squirrel.vy,
    ...Object.fromEntries(contactRuns.map(r=>[r.style.mode,stateTrace(r)]))});
  if (tick%2) continue;
  const cue=tick<30?'APPROACH / RAPID TAPS':tick<45?'DOWN SWIPE / PLANET APPROACH':
    tick<76?'PLANET CONTACT → TAP → PUSH-OFF':'RELEASE / PUSH-OFF SETTLES';
  paintComparison(contactRuns,tick,'contact',cue,contactTaps.has(tick)?'Tap accepted':
    tick===firstContact?'Real collision accepted':'Follow camera · test chamber only');
  const buf=film.toBuffer('image/png');writeFileSync(join(contactDir,`${String(tick/2).padStart(4,'0')}.png`),buf);
  if(tick===54)writeFileSync(join(output,'Vanguard-Planet-Push-Off.png'),buf);
}
assert.equal(firstContact,45,'fixture makes real contact immediately before tap');
assert(contactRuns.every(r=>r.contactCount>0),'all styles use the real collision');
assert(contactTrace[46].jetpack.contacts.length>0,'immediate tap retains surface contact');
writeFileSync(join(output,'contact-trace.json'),JSON.stringify({
  provenance:'Supplemental production renderer fixture; 5000px chamber, camera follows pilot. Not ordinary phone layout.',
  simulationHz:60,videoFps:30,seconds:3,world:{width:390,height:5000,camera:'follow'},
  events:contactEvents,assertedEqualEveryTick:authoritativeKeys,
  runs:contactRuns.map(runSummary),trace:contactTrace,
},null,2));
writeFileSync(join(output,'review-summary.json'),JSON.stringify({
  provenance:'Native production canvas, actual simulation and art; no browser or physical-device performance claim.',
  passed:{ordinaryField:true,noPhonePositionReset:true,threeModePhysicsEqualityEveryTick:true,
    realRisingAndFalling:true,continuousLegacyTail:true,newDirectionBanks:true,gateScoring:true,realPlanetContact:true,tapRetainsContact:true},
  phone:{frames:300,width:1260,height:1220,fps:30,runs:phoneRuns.map(runSummary)},
  contact:{frames:90,width:1260,height:1220,fps:30,runs:contactRuns.map(runSummary)},
  timingMethod:'performance.now around the FIRST paintVanguard call after every 60Hz simulation tick, at gameplay size52 and3× pixel density. Includes cache hits AND refreshes; excludes world, labels, dust and PNG encoding. First10 samples omitted from warmed statistics. Native CPU measurement, not iPhone timing.',
},null,2));
console.log(JSON.stringify({passed:true,output,phoneFrames:300,contactFrames:90,
  contactTick:firstContact,phoneRuns:phoneRuns.map(runSummary)},null,2));
