#!/usr/bin/env node
// Exercise the shipped separated-part painter and actual short flight arcs.
// Geometric landmarks are measured with body tilt removed, so a larger lean
// cannot masquerade as arm/leg animation. Native raster checks cover the atlas
// route, constant head scale, opaque joints and fallback to the original art.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as M from '../docs/js/vanguard-maneuver.js';
import * as V from '../docs/js/vanguard.js';

const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.ACORNAUT_QA_OUTPUT||join(tmpdir(),'acornaut-vanguard-maneuver');
mkdirSync(output,{recursive:true});
const fields=Object.keys(M.createManeuverMotion().pose);
const limbs=['nearHand','farHand','nearFoot','farFoot'];
const span=points=>{
  let max=0;for(const a of points)for(const b of points)max=Math.max(max,Math.hypot(a[0]-b[0],a[1]-b[1]));
  return max*52/400;
};
const displayed=s=>({pose:{...s.pose},rates:{...s.rates},bankAge:s.bankAge,
  tailBase:s.tailBase,tailTip:s.tailTip,tailBaseRate:s.tailBaseRate,tailTipRate:s.tailTipRate});
const travel=(s,seconds,vy,upright=true)=>{for(let i=0;i<Math.round(seconds*120);i++)M.stepManeuver(s,1/120,vy,false,upright);};
let minimumTailArea=Infinity,maximumStepPx=0;
function inspect(s,previous){
  for(const [key,value] of Object.entries(s))if(typeof value==='number')assert(Number.isFinite(value),key);
  for(const key of fields)assert(Number.isFinite(s.pose[key])&&Number.isFinite(s.rates[key]),key);
  const l=M.maneuverLandmarks(s.pose);
  // End-to-end anatomical lengths stay fixed even at the largest gestures.
  for(const [a,b,length] of [[[-36,-63],l.nearElbow,57],[l.nearElbow,l.nearHand,61],
    [[47,-59],l.farElbow,52],[l.farElbow,l.farHand,55],
    [[-14,32],l.nearKnee,68],[l.nearKnee,l.nearFoot,66],
    [[32,31],l.farKnee,64],[l.farKnee,l.farFoot,63]]){
    assert(Math.abs(Math.hypot(b[0]-a[0],b[1]-a[1])-length)<1e-8,'constant bone length');
  }
  if(previous)for(const key of limbs){
    const p=previous[key],q=l[key],step=Math.hypot(p[0]-q[0],p[1]-q[1])*52/400;
    maximumStepPx=Math.max(maximumStepPx,step);
    assert(step<3.1,`${key}: no >3.1px one-frame snap at 60Hz`);
  }
  // Every triangle must retain useful area through a real velocity reversal.
  // A positive but nearly zero area still produces a pinched, torn-looking tail.
  const vs=M.maneuverTailVertices(s);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const a=y*5+x;
    for(const ids of [[a,a+1,a+6],[a,a+6,a+5]]){
      const [p,q,r]=ids.map(i=>vs[i]);
      const area=((q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]))/(4096*1.03**2);
      minimumTailArea=Math.min(minimumTailArea,area);
      assert(area>.25,'tail keeps at least a quarter of each triangle area without folding');
    }
  }
  return l;
}

const measurements=[],samples=[];
for(const upright of [false,true])for(const interval of [.1,.18,.3]){
  const s=M.createManeuverMotion(),tracks=Object.fromEntries(limbs.map(k=>[k,[]]));
  let vy=450,nextTap=0,previous,protectedTaps=0;
  for(let tick=0;tick<180;tick++){
    const time=tick/60;
    if(time+1e-8>=nextTap&&time<1.8){
      const before=displayed(s),age=s.gestureAge;
      M.maneuverTap(s,Math.max(0,vy+450));
      assert.deepEqual(displayed(s),before,'tap preserves displayed pose, momentum and locomotion phase');
      if(age<.34){assert.equal(s.gestureAge,age,'rapid refresh lets the current gesture finish');protectedTaps++;}
      vy=-450;nextTap+=interval;
    }
    M.stepManeuver(s,1/60,vy,false,upright);vy+=1300/60;
    previous=inspect(s,previous);
    if(tick>=12&&tick<108)for(const k of limbs)tracks[k].push(previous[k]);
    if(tick%6===0)samples.push(structuredClone(s));
  }
  assert(protectedTaps>2,'multiple accepted taps preserve the current gesture');
  const motion=Object.fromEntries(limbs.map(k=>[k,span(tracks[k])]));
  // Readability goals established for this new anatomy: several screen pixels
  // beyond the rejected 2.45px hand movement, even during sustained rapid taps.
  assert(motion.nearHand>=7.5,'near hand travels at least 7.5 gameplay pixels');
  assert(motion.farHand>=6,'far hand travels at least 6 gameplay pixels');
  assert(motion.nearFoot>=6&&motion.farFoot>=6,'both feet visibly tuck/trail by at least 6 pixels');
  measurements.push({mode:upright?'jetpack':'cruise',tapIntervalMs:interval*1000,travelPx:motion});
}

// Up, apex and down must resolve within one real 346ms tap-to-apex arc.
const arc=M.createManeuverMotion();M.maneuverTap(arc,900);let rise;
for(let i=0;i<90;i++){
  M.stepManeuver(arc,1/120,-450+1300*i/120,false,true);
  if(i===29)rise=structuredClone(arc);
}
assert.equal(rise.bank,'rise');assert.equal(arc.bank,'fall');
assert(rise.pose.farArm>80&&arc.pose.nearArm>90,'rising reach opens into falling brace');
assert(arc.pose.nearThigh-rise.pose.nearThigh>45,'fall brings the knees forward within the short arc');
const up=M.createManeuverMotion(),down=M.createManeuverMotion();
travel(up,1.4,-450);travel(down,1.4,450);
assert(up.tailBase< -95&&down.tailBase>10,'tail streams down during ascent and up during descent');
assert(up.tailBase<up.tailTip,'the heavy tip follows the accelerating root');
// Noise around the entry thresholds must not rewind a bank repeatedly.
for(const [vy,bank,noise] of [[-100,'rise',[-96,-94]],[120,'fall',[114,116]]]){
  const s=M.createManeuverMotion();travel(s,.1,vy);
  for(let i=0;i<20;i++){const age=s.bankAge;M.stepManeuver(s,1/60,noise[i%2],false,true);
    assert.equal(s.bank,bank);assert(s.bankAge>age,'hysteresis preserves bank phase');}
}

// Landing is a separate, finishable compression/extension with an immediate tap.
const hit=M.createManeuverMotion(),clear=M.createManeuverMotion();
travel(hit,.5,450);travel(clear,.5,450);M.maneuverContact(hit,-1,1);
M.maneuverTap(hit,900);M.maneuverTap(clear,900);assert.equal(hit.contactAge,0);
let compression=0,extension=0,peakKnee=0;
for(let i=0;i<120;i++){
  M.stepManeuver(hit,1/120,-450+1300*i/120,false,true);
  M.stepManeuver(clear,1/120,-450+1300*i/120,false,true);
  compression=Math.max(compression,hit.pose.heave-clear.pose.heave);
  extension=Math.min(extension,hit.pose.heave-clear.pose.heave);
  peakKnee=Math.max(peakKnee,Math.abs(hit.pose.nearKnee-clear.pose.nearKnee));
  inspect(hit);if(i%6===0)samples.push(structuredClone(hit));
}
assert(compression>8&&extension< -2&&peakKnee>35,'contact compresses, extends and articulates the knee');
assert(Math.abs(hit.pose.nearKnee-clear.pose.nearKnee)<2,'landing recovers to flight');
const roof=M.createManeuverMotion(),free=M.createManeuverMotion();M.maneuverContact(roof,1,1);
travel(roof,.2,-200);travel(free,.2,-200);
assert.equal(roof.pose.nearThigh,free.pose.nearThigh,'ceiling contact never fakes a foot landing');
assert(roof.pose.nearArm>free.pose.nearArm+25,'ceiling contact braces the arms');
const flight=M.createManeuverMotion(),upright=M.createManeuverMotion();
travel(flight,1,0,false);travel(upright,1,0,true);
assert(Math.abs(flight.pose.farArm-upright.pose.farArm)>20,'styles differ in limbs with body rotation removed');
assert(Math.abs(flight.pose.nearThigh-upright.pose.nearThigh)>10,'styles differ in hip posture');
for(const dt of [0,-1,NaN,Infinity]){const before=structuredClone(flight);M.stepManeuver(flight,dt,0,false,true);assert.deepEqual(flight,before);}
M.stepManeuver(flight,10,900,true,false);inspect(flight);

function replay(hz){
  const s=M.createManeuverMotion(),out=[];
  for(let i=0;i<hz*3;i++){
    const t=i/hz,tap=t<1.2&&i%(hz/10)===0;
    if(tap)M.maneuverTap(s,600);
    const age=t<1.2?(i%(hz/10))/hz:t-1.1;
    // Match sim.ts: presentation receives the velocity AFTER this tick.
    M.stepManeuver(s,1/hz,-450+1300*(age+1/hz),false,true);
    if((i+1)%(hz/10)===0)out.push(structuredClone(s));
  }
  return out;
}
const reference=replay(120);let maxRateDifference=0;
for(const hz of [30,60])for(const [i,s] of replay(hz).entries()){
  const a=M.maneuverLandmarks(s.pose),b=M.maneuverLandmarks(reference[i].pose);
  for(const k of limbs){const distance=Math.hypot(a[k][0]-b[k][0],a[k][1]-b[k][1])*52/400;
    maxRateDifference=Math.max(maxRateDifference,distance);assert(distance<1.6,'common frame rates track limbs within 1.6 gameplay pixels');}
  assert(Math.abs(s.pressure-reference[i].pressure)<.06,'thrust envelope survives frame-rate changes');
}

// The real painter must use separated complete parts, without changing head
// or torso area as poses change. Check raster opacity over all anatomical seams.
const atlas=await loadImage(join(root,'docs/art/suits/vanguard/maneuver-parts.png'));
const original=await loadImage(join(root,'docs/art/suits/vanguard.png'));
const art={vanguardParts:atlas,suits:{vanguard:original}};
const canvas=createCanvas(700,700),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
const records=[];ctx.drawImage=(im,...args)=>{const m=ctx.getTransform();records.push({im,args,area:Math.abs(m.a*m.d-m.b*m.c)});return draw(im,...args);};
const areas={head:[],torso:[]};let seamSamples=0;
for(const s of samples){
  ctx.clearRect(0,0,700,700);records.length=0;
  const display={...s,pose:{...s.pose,body:0,heave:0},pressure:0};
  const state=V.createVanguardMotion();state.maneuver=display;
  V.paintVanguard(ctx,art,350,290,400,state);
  assert.equal(records.length,42,'ten complete body pieces plus32 tail triangles');
  assert(records.every(r=>r.im===atlas),'new style draws its actual atlas');
  areas.head.push(records.find(r=>r.args[0]===0&&r.args[1]===0).area);
  areas.torso.push(records.find(r=>r.args[0]===256&&r.args[1]===0).area);
  const l=M.maneuverLandmarks(display.pose);
  for(const p of [l.nearElbow,l.farElbow,l.nearKnee,l.farKnee,[-14,32],[32,31],[-36,-63],[47,-59]]){
    const alpha=ctx.getImageData(Math.round(350+p[0]),Math.round(350+p[1]),1,1).data[3];
    assert(alpha>240,'anatomical joints remain covered and opaque');seamSamples++;
  }
}
// Canvas stores transforms as floats; tolerate <0.001% area rounding only.
for(const [part,a] of Object.entries(areas))assert((Math.max(...a)-Math.min(...a))/a[0]<1e-5,`${part} scale never pulses`);
// the original comparison styles are gone (owner, 6 Sep 2026): Flight is the motion
records.length=0;V.paintVanguard(ctx,{suits:art.suits},350,350,52,V.createVanguardMotion());
assert(records.some(r=>r.im!==atlas),'missing atlas renders the prior rig');

// Network/decode failures and wrong atlas dimensions retain complete original
// frames, allow a later retry, and never publish a malformed new puppet.
globalThis.window={__ACORNAUT_ART__:'/art'};
globalThis.document={createElement:()=>({getContext:()=>null})};
for(const scenario of ['missing','malformed','success']){
  let retry=false,requests=0;
  globalThis.Image=class{
    set src(url){
      requests++;const parts=url.includes('maneuver-parts');
      this.width=this.naturalWidth=parts&&(retry||scenario==='success')?1024:512;
      this.height=this.naturalHeight=parts&&(retry||scenario==='success')?768:512;
      queueMicrotask(()=>parts&&scenario==='missing'&&!retry?this.onerror?.():this.onload?.());
    }
  };
  const A=await import(`../docs/js/art.js?maneuver-${scenario}`),bank=A.emptyArt();
  assert.equal(requests,0,'new atlas remains lazy');
  await A.loadSuitBank(bank,'vanguard');
  assert.equal(bank.vanguard.length,16,'complete original bank survives atlas failure');
  assert.equal(!!bank.vanguardParts,scenario==='success');
  const count=requests;retry=true;await A.loadSuitBank(bank,'vanguard');
  assert.equal(bank.vanguardParts.width,1024);assert.equal(bank.vanguardParts.height,768);
  assert(scenario==='success'?requests===count:requests>count,'success caches; failures retry');
}
const result={passed:true,gameplaySize:52,travelMeasurements:measurements,minimumTailArea,maximumStepPx,
  maxFrameRateDifferencePx:maxRateDifference,opaqueJointSamples:seamSamples,
  note:'Landmark movement with root/body tilt removed; real painter and alpha checks. Device pacing and artistic quality require visual review.'};
writeFileSync(join(output,'maneuver-checks.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
