#!/usr/bin/env node
/**
 * An articulation proof, NOT ordinary gameplay footage. Both production rigs
 * see the same actual 60Hz flight simulation inputs; display copies hold body
 * tilt, tail pose and exhaust fixed so those cannot disguise static limbs.
 * Controller state is never frozen, rewound or modified for presentation.
 *
 * Reproduce the first-review baseline without checking its sources in here:
 *   mkdir -p /tmp/vanguard-first-review-js
 *   git archive 5c44e92 docs/js | tar -x --strip-components=2 -C /tmp/vanguard-first-review-js
 * Build the current game, then run this script with the same Node options used
 * for review-vanguard-flight.mjs. Optional environment variables:
 *   ACORNAUT_VANGUARD_BASELINE=/tmp/vanguard-first-review-js
 *   ACORNAUT_CANVAS=/path/to/@napi-rs/canvas
 *   ACORNAUT_QA_OUTPUT=/tmp/vanguard-organic-QA
 * Encode frames/%04d.png at 30fps: six seconds of motion at normal speed.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const baseline=resolve(process.env.ACORNAUT_VANGUARD_BASELINE||'/tmp/vanguard-first-review-js');
const output=resolve(process.env.ACORNAUT_QA_OUTPUT||'/tmp/vanguard-organic-QA');
for(const name of ['vanguard.js','vanguard-rig.js','sim.js','save.js']) {
  assert(existsSync(join(baseline,name)),`Missing first-review baseline ${name}; extract commit 5c44e92 as documented at the top of this script.`);
}
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image,GlobalFonts}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Vanguard Sans');
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={
  __ACORNAUT_BETA__:true,__ACORNAUT_ART__:join(root,'docs/art'),
  location:{href:'http://local/beta/',search:'?star-map=sample'},
  devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
};
globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};

const [oldVG,oldSim,oldSave,newVG,newSim,newSave,Cat]=await Promise.all([
  import(pathToFileURL(join(baseline,'vanguard.js')).href),
  import(pathToFileURL(join(baseline,'sim.js')).href),
  import(pathToFileURL(join(baseline,'save.js')).href),
  import('../docs/js/vanguard.js'),import('../docs/js/sim.js'),
  import('../docs/js/save.js'),import('../docs/js/catalog.js'),
]);
assert.equal(oldVG.VANGUARD_FRAMES,newVG.VANGUARD_FRAMES,'same original tail bank');
// Only a single unchanged artwork pose is shown. Supplying the complete bank
// retains the normal production route, while frame=0 selects that same image.
const frame=await loadImage(join(root,'docs/art/suits/vanguard/frame-1.png'));
const art={suits:{vanguard:frame},vanguard:Array(newVG.VANGUARD_FRAMES).fill(frame)};
const PITCH=16*Math.PI/180;
const runs=[
  {id:'firstReview',title:'FIRST REVIEW',subtitle:'Previous restrained limb motion',color:'#c6c4bd',VG:oldVG,Sim:oldSim,Save:oldSave},
  {id:'organic',title:'ORGANIC',subtitle:'Independent float and follow-through',color:'#9be7ec',VG:newVG,Sim:newSim,Save:newSave},
].map(run=>{
  const save=run.Save.defaultSave();
  Object.assign(save,{equippedSuit:'vanguard',equippedTrail:'ion',vanguardMotionMode:'cruise',tutorialDone:true,guide:'done'});
  const w=run.Sim.makeWorld(390,5000);run.Sim.resetRun(w,save,'fly',false);
  w.planets=[];w.pickups=[];w.lastSpawnX=100000;w.warpT=0;
  // This one object survives all 360 steps and both render sizes, preserving
  // the production rig's per-state texture cache instead of rebuilding it.
  const display=run.VG.createVanguardMotion('cruise');
  return {...run,save,w,display,states:[],velocityInputs:[],acceptedInputs:[]};
});
mkdirSync(output,{recursive:true});const frameDir=join(output,'frames');mkdirSync(frameDir,{recursive:true});
const film=createCanvas(960,600),ctx=film.getContext('2d');
const bursts=[{start:0,interval:.100,count:4},{start:2,interval:.180,count:4},{start:4,interval:.300,count:4}];
const taps=new Map();
for(const burst of bursts)for(let i=0;i<burst.count;i++)taps.set(Math.round((burst.start+i*burst.interval)*60),burst.interval);
const keys=['squirrel','run','score','distance','screen','ready','tapAnimT','tapAnimDir','bounceAnimT'];
const jointKeys=['nearArm','farArm','nearLeg','farLeg','settle','drive','heading','pitch','frame','phase','time'];
const trace=[],events=[];
let lastTap=-1000;
function text(value,x,y,size=14,color='#aabacf',weight='400') {
  ctx.font=`${weight} ${size}px "Vanguard Sans"`;ctx.fillStyle=color;ctx.fillText(value,x,y);
}
function snapshot(state) {return Object.fromEntries(jointKeys.map(key=>[key,state[key]]));}
function span(states,key) {const values=states.map(s=>s[key]);return Math.max(...values)-Math.min(...values);}
for(let tick=0;tick<360;tick++) {
  const t=tick/60,tap=taps.has(tick);
  if(tap) {lastTap=tick;events.push({tick,time:t,event:'tap',cadenceMilliseconds:Math.round(taps.get(tick)*1000)});}
  for(const run of runs) {
    const before=run.w.squirrel.vy;
    if(tap) {
      run.Sim.flap(run.w,run.save);
      assert.equal(run.w.squirrel.vy,Cat.PHYS.flap,`${run.id} accepts the scheduled tap at ${tick}`);
      run.acceptedInputs.push({tick,beforeVy:before,afterVy:run.w.squirrel.vy,impulse:before-run.w.squirrel.vy});
    }
    // stepVanguard runs before this simulation tick applies gravity, so this
    // captures the exact vy supplied to each controller by its real sim.ts.
    run.velocityInputs.push(run.w.squirrel.vy);
    run.Sim.updateWorld(run.w,run.save,1/60);
    assert.equal(run.w.screen,'play',`${run.id} stays in the ordinary flight simulation`);
    run.states.push(snapshot(run.w.vanguard));
    Object.assign(run.display,run.w.vanguard,{pitch:PITCH,heading:0,frame:0,phase:0,thrust:0});
    assert.equal(run.display.pitch,PITCH);assert.equal(run.display.frame,0);assert.equal(run.display.thrust,0);
    for(const key of ['nearArm','farArm','nearLeg','farLeg','settle','drive','time']) {
      assert.equal(run.display[key],run.w.vanguard[key],`${key} must remain the actual live joint value`);
    }
  }
  for(const key of keys)assert.deepEqual(runs[0].w[key],runs[1].w[key],`same ${key} at tick ${tick}`);
  assert.equal(runs[0].velocityInputs[tick],runs[1].velocityInputs[tick],'identical actual controller velocity input');
  trace.push({tick,time:t,tap,vyInput:runs[0].velocityInputs[tick],vy:runs[0].w.squirrel.vy,
    y:runs[0].w.squirrel.y,firstReview:runs[0].states.at(-1),organic:runs[1].states.at(-1)});
  if(tick%2)continue;
  ctx.fillStyle='#07111e';ctx.fillRect(0,0,960,600);
  text('VANGUARD / ORGANIC MOTION',22,30,22,'#f0d6ab','700');
  text('Tilt and tail held fixed to show arm/leg motion',22,56,15,'#c4d3e3');
  text('Articulation proof · native game painter · real time',22,78,11,'#91a8be');
  text(`${t.toFixed(2)} / 6.00s`,820,30,14,'#bbd5e4');
  ctx.strokeStyle='#233b50';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(480,91);ctx.lineTo(480,574);ctx.stroke();
  for(let i=0;i<runs.length;i++) {
    const run=runs[i],x=i*480;
    text(run.title,x+24,114,22,run.color,'700');text(run.subtitle,x+24,137,12,'#aebfd0');
    // Full character; no clipping, no crop and no camera translation. The
    // large pose and game-size copy receive the same stable display object.
    run.VG.paintVanguard(ctx,art,x+270,340,320,run.display);
    run.VG.paintVanguard(ctx,art,x+69,524,52,run.display);
    text('GAME SIZE / 52px',x+112,516,12,run.color,'700');
    text('Same live arms and legs',x+112,536,11,'#aebfd0');
    const active=bursts.find(b=>t>=b.start&&t<b.start+(b.count-1)*b.interval+.28);
    const cue=active?`${Math.round(active.interval*1000)}ms taps`:'Release / gravity';
    ctx.fillStyle=tick-lastTap<6?run.color:'#334658';ctx.beginPath();ctx.arc(x+31,567,4,0,Math.PI*2);ctx.fill();
    text(`${cue} · ${runs[0].w.squirrel.vy<0?'rising':'falling'}`,x+44,572,12,'#c9d6e3');
  }
  text('Reference-only: body pitch 16°, tail pose 1 and exhaust hidden. Gameplay keeps its full motion.',22,595,10,'#91a8be');
  const buf=film.toBuffer('image/png');writeFileSync(join(frameDir,`${String(tick/2).padStart(4,'0')}.png`),buf);
  if(tick===100)writeFileSync(join(output,'preview.png'),buf);
}
assert.deepEqual(runs[0].acceptedInputs,runs[1].acceptedInputs,'same accepted tap impulses');
assert.equal(runs[0].acceptedInputs.length,12,'all three four-tap groups accepted');
assert(runs[0].velocityInputs.some(v=>v<0)&&runs[0].velocityInputs.some(v=>v>0),'real rise and fall');
// The frozen display pitch cannot substitute for joint motion. Trace both
// implementations so amplitude and continuity can be audited numerically.
const summaries=runs.map(run=>({id:run.id,
  jointSpans:Object.fromEntries(['nearArm','farArm','nearLeg','farLeg','settle'].map(key=>[key,span(run.states,key)])),
  acceptedInputs:run.acceptedInputs,
}));
assert(summaries[1].jointSpans.nearArm>.45,'organic near arm has independently visible travel');
assert(summaries[1].jointSpans.farArm>.50,'organic far arm has independently visible travel');
assert(summaries[1].jointSpans.nearLeg>.25,'organic knee changes independently of pitch');
writeFileSync(join(output,'trace.json'),JSON.stringify({
  provenance:'Native production painter articulation proof. Not browser or physical-device capture, not ordinary gameplay framing.',
  baselineCommit:'5c44e92',baselineDirectory:baseline,
  playback:{width:960,height:600,simulationHz:60,videoFps:30,seconds:6,speed:1},
  displayOverrides:{pitchDegrees:16,frame:0,phase:0,heading:0,thrust:0},
  simulationFixture:{width:390,height:5000,emptyGates:true,noPositionResets:true},
  physics:Cat.PHYS,bursts,events,assertedEqualEveryTick:keys,
  identicalVelocityInput:true,identicalAcceptedTapImpulses:true,stableDisplayObjects:true,
  runs:summaries,trace,
},null,2));
console.log(JSON.stringify({passed:true,output,frames:180,runs:summaries},null,2));
