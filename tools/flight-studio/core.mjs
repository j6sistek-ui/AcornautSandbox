// Pure, fixed-step studio runtime. No DOM, save storage, random numbers or I/O.
// This module and the exported preset form the integration contract; game
// simulation remains the authority when applying a tuned profile later.
import {createHighOrbitMotion,stepHighOrbit,highOrbitTap} from './game/high-orbit-motion.mjs';
import {createArcflashMotion,stepArcflash,arcflashTap,arcflashDive} from './game/arcflash-motion.mjs';
import {createManeuverMotion,stepManeuver,maneuverTap} from './game/vanguard-maneuver.mjs';
export const VERSION=1,STEP=1/120;
export const PARTS={body:'Torso',head:'Head',heave:'Body float',nearArm:'Near upper arm',nearElbow:'Near forearm',farArm:'Far upper arm',farElbow:'Far forearm',nearThigh:'Near thigh',nearKnee:'Near shin',farThigh:'Far thigh',farKnee:'Far shin',tailRoot:'Tail root',tailMid:'Tail middle',tailTip:'Tail tip'};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const clone=v=>JSON.parse(JSON.stringify(v));
export const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function curve(points,t){
  const p=clamp(t,0,1)*(points.length-1),i=Math.min(points.length-2,Math.floor(p));
  return points[i]+(points[i+1]-points[i])*smooth(p-i);
}
export function defaultPattern(){return {duration:13.5,gravity:300,lift:300,maxFall:360,diveSpeed:300,
  events:[{at:0,type:'tap'},{at:1.5,type:'tap'},{at:3,type:'tap'},
    {at:6.4,type:'tap'},{at:6.9,type:'tap'},{at:7.05,type:'tap'},
    {at:10,type:'tap'},{at:10.5,type:'tap'},{at:10.65,type:'tap'}]};}
export function defaultProfile(model){
  const tapSource=model.banks.tap.length?'tap':model.banks.asc.length?'asc':model.banks.loop.length?'loop':'still';
  const n=tapSource==='still'?1:model.banks[tapSource].length;
  return {basePitch:model.family==='acornut'?12:0,tapPitch:[0,-8,-3,0,0],risePitch:0,fallPitch:0,pitchResponse:.10,
    tapSeconds:1,tapEase:1,retrigger:'restart',finishTap:true,tapPath:tapSource==='asc'?'out-back':'forward',returnAt:.625,loopContinuous:false,velocityFilter:.05,descentThreshold:40,
    descentFull:500,descentDelay:.08,descentSeconds:.55,descentEase:1,rigSpeed:1,
    tapSource,tapOrder:Array.from({length:n},(_,i)=>i),tapWeights:Array(n).fill(1),tapOffsets:Array(n).fill(0),
    descOrder:Array.from({length:model.banks.desc.length},(_,i)=>i),descOffsets:Array(model.banks.desc.length).fill(0),
    parts:Object.fromEntries(Object.keys(PARTS).map(k=>[k,{offset:0,motion:1,rise:0,fall:0,
      tap:[0,0,0,0,0],velocity:[0,0,0,0,0],lag:0,response:0}]))};
}
export function makeProject(manifest,model){return {schema:'acornaut-flight-studio',version:VERSION,
  name:`${model.name} flight tuning`,source:{commit:manifest.sourceCommit,artVer:manifest.artVer,painters:manifest.painterHashes},
  model:{id:model.id,family:model.family,assets:model.hashes},profile:defaultProfile(model),pattern:defaultPattern(),
  view:{helmet:'clear',effects:true,guides:false,scale:160,background:'nebula'}};}
const fail=m=>{throw new Error(m);};
function number(v,a,b,label){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)fail(`${label} must be between ${a} and ${b}.`);}
function points(v,label){if(!Array.isArray(v)||v.length!==5)fail(`${label} needs five curve points.`);v.forEach(x=>number(x,-180,180,label));}
export function validateProject(value,manifest){
  value=clone(value);
  if(!value||value.schema!=='acornaut-flight-studio'||value.version!==VERSION)fail('Unsupported Flight Studio preset version.');
  const model=manifest.models.find(m=>m.id===value.model?.id);if(!model)fail('This model is not in the local art library.');
  if(value.model.family!==model.family)fail('The preset uses a different rig family.');
  if(typeof value.name!=='string'||value.name.length>120)fail('Preset name is too long.');
  const p=value.profile,pat=value.pattern,v=value.view;
  if(!p||!pat||!v)fail('Preset is missing its profile, pattern or view.');
  p.tapPath??=p.tapSource==='asc'?'out-back':'forward';p.returnAt??=.625;p.loopContinuous??=false;
  for(const [k,a,b] of [['basePitch',-90,90],['risePitch',-90,90],['fallPitch',-90,90],['pitchResponse',0,2],
    ['tapSeconds',.1,5],['tapEase',.2,4],['velocityFilter',0,1],['descentThreshold',0,600],['descentFull',50,1600],
    ['descentDelay',0,2],['descentSeconds',.05,3],['descentEase',.2,4],['rigSpeed',.2,3]])number(p[k],a,b,k);
  if(p.descentFull<=p.descentThreshold)fail('Full descent velocity must exceed descent entry velocity.');
  if(!['restart','continue','queue'].includes(p.retrigger)||typeof p.finishTap!=='boolean')fail('Invalid tap playback options.');
  if(!['forward','out-back'].includes(p.tapPath)||typeof p.loopContinuous!=='boolean')fail('Invalid bank playback path.');number(p.returnAt,.1,.9,'Return point');
  points(p.tapPitch,'Whole-model tap pitch');
  if(!['tap','asc','loop','still'].includes(p.tapSource))fail('Unknown tap source.');
  const count=p.tapSource==='still'?1:model.banks[p.tapSource].length;
  function sequence(order,offsets,n,label){
    if(!Array.isArray(order)||order.length>64||order.length<(n?1:0)||!Array.isArray(offsets)||offsets.length!==order.length)fail(`Invalid ${label} sequence.`);
    order.forEach(x=>{if(!Number.isInteger(x)||x<0||x>=n)fail(`Missing ${label} frame ${x+1}.`);});
    offsets.forEach(x=>number(x,-90,90,label+' pitch'));
  }
  if(!count)fail('That tap bank is unavailable for this model.');
  sequence(p.tapOrder,p.tapOffsets,count,'tap');sequence(p.descOrder,p.descOffsets,model.banks.desc.length,'descent');
  if(!Array.isArray(p.tapWeights)||p.tapWeights.length!==p.tapOrder.length)fail('Frame holds do not match the tap sequence.');
  p.tapWeights.forEach(x=>number(x,.1,10,'Frame hold'));
  for(const k of Object.keys(PARTS)){
    const part=p.parts?.[k];if(!part)fail(`Missing ${PARTS[k]} settings.`);
    for(const [f,a,b] of [['offset',-90,90],['motion',0,2],['rise',-90,90],['fall',-90,90],['lag',0,1],['response',0,1]])number(part[f],a,b,PARTS[k]+' '+f);
    points(part.tap,PARTS[k]+' tap curve');
    part.velocity??=[0,0,0,0,0];points(part.velocity,PARTS[k]+' velocity curve');
  }
  number(pat.duration,2,60,'Loop duration');number(pat.gravity,100,1800,'Gravity');number(pat.lift,100,800,'Tap lift');
  number(pat.maxFall,100,1000,'Maximum fall');number(pat.diveSpeed,100,1000,'Dive speed');
  if(!Array.isArray(pat.events)||pat.events.length<1||pat.events.length>100)fail('Use 1–100 pattern events.');
  let prev=-1;for(const e of pat.events){number(e.at,0,pat.duration-.001,'Event time');if(e.at<=prev)fail('Events must have distinct, increasing times.');prev=e.at;if(!['tap','dive'].includes(e.type))fail('Unknown event type.');}
  if(typeof v.helmet!=='string'||(v.helmet!=='none'&&!manifest.helmets.some(h=>h.id===v.helmet)))fail('Unknown helmet.');
  number(v.scale,60,280,'Preview scale');for(const k of ['effects','guides'])if(typeof v[k]!=='boolean')fail('Invalid view settings.');
  if(!['nebula','dark','light'].includes(v.background))fail('Unknown background.');
  // Source identity is advisory on import so an intentional remaster can be
  // retuned, but the UI explicitly reports it before any later game integration.
  const warnings=[];
  if(JSON.stringify(value.model.assets)!==JSON.stringify(model.hashes))warnings.push('Artwork differs from the source used by this preset. Review helmet fit and motion.');
  if(JSON.stringify(value.source?.painters)!==JSON.stringify(manifest.painterHashes))warnings.push('Rig source changed since this preset was exported.');
  return {project:clone(value),model,warnings};
}
export function serializeProject(project,manifest){validateProject(project,manifest);return JSON.stringify(project,null,2)+'\n';}
function nativeState(model){return model.family==='high-orbit'?createHighOrbitMotion(model.id):model.family==='arcflash'?createArcflashMotion():model.family==='acornut'?createManeuverMotion(false):null;}
function poseOf(model,s){
  if(!s)return {};
  return {...s.pose,...(model.family==='arcflash'?{tailRoot:s.tailRoot,tailMid:s.tailMid,tailTip:s.tailTip}:
    model.family==='acornut'?{tailRoot:s.tailBase,tailMid:s.tailBend,tailTip:s.tailTip}:{})};
}
export function createAnimation(model){
  const native=nativeState(model),output=nativeState(model);
  return {model,native,output,neutral:poseOf(model,native),time:0,tapAge:10,queued:false,filteredVy:0,downAge:0,fall:0,pitch:0,frame:0,bank:'still',stage:'glide',tapCount:0,diving:false};
}
export function acceptTap(s,p){
  const active=s.tapAge<p.tapSeconds;
  if(p.retrigger==='restart'||!active)s.tapAge=0;
  else if(p.retrigger==='queue')s.queued=true;
  s.downAge=0;s.diving=false;s.tapCount++;
  if(s.model.family==='arcflash')arcflashTap(s.native,450);
  if(s.model.family==='high-orbit')highOrbitTap(s.native,450);
  if(s.model.family==='acornut')maneuverTap(s.native,450);
}
export function acceptDive(s){s.diving=true;if(s.model.family==='arcflash')arcflashDive(s.native);}
function follow(a,b,dt,tau){return tau<=0?b:a+(b-a)*(1-Math.exp(-dt/tau));}
export function stepAnimation(s,p,dt,vy){
  if(!Number.isFinite(dt)||!Number.isFinite(vy)||dt<=0)return s;
  s.time+=dt;s.tapAge+=dt;
  if(s.queued&&s.tapAge>=p.tapSeconds){s.tapAge=0;s.queued=false;}
  s.filteredVy=follow(s.filteredVy,vy,dt,p.velocityFilter);
  const lift=smooth(-s.filteredVy/450);
  s.downAge=s.filteredVy>p.descentThreshold?s.downAge+dt:0;
  const eligible=s.downAge>=p.descentDelay&&s.filteredVy>p.descentThreshold&&(!p.finishTap||s.tapAge>=p.tapSeconds);
  const goal=eligible?Math.pow(clamp((s.filteredVy-p.descentThreshold)/(p.descentFull-p.descentThreshold),0,1),p.descentEase):0;
  s.fall=follow(s.fall,goal,dt,p.descentSeconds/3);
  // Clocked playback never depends on upward velocity. A downward inertia
  // gate is the only route into the descent bank.
  s.stage=eligible?'descent':s.tapAge<p.tapSeconds?'tap':s.filteredVy<0?'rise':'glide';
  const tapT=Math.pow(clamp(s.tapAge/p.tapSeconds,0,1),p.tapEase);
  const targetPitch=p.basePitch+curve(p.tapPitch,tapT)+p.risePitch*lift+p.fallPitch*s.fall;
  s.pitch=follow(s.pitch,targetPitch,dt,p.pitchResponse);
  if(s.native){
    const effectiveVy=s.filteredVy<0?s.filteredVy:s.fall*p.descentFull;
    const h=dt*p.rigSpeed;
    if(s.model.family==='high-orbit')stepHighOrbit(s.native,s.model.id,h,effectiveVy);
    else if(s.model.family==='arcflash')stepArcflash(s.native,h,effectiveVy);
    else stepManeuver(s.native,h,effectiveVy,s.diving,false);
    const pose=poseOf(s.model,s.native),prior=poseOf(s.model,s.output),tuned={};
    for(const k of Object.keys(PARTS)){
      const q=p.parts[k],base=s.neutral[k]||0,phase=Math.pow(clamp((s.tapAge-q.lag)/p.tapSeconds,0,1),p.tapEase);
      const target=base+((pose[k]??base)-base)*q.motion+q.offset+q.rise*lift+q.fall*s.fall+curve(q.tap,phase)+curve(q.velocity??[0,0,0,0,0],.5+(s.filteredVy<0?-lift:s.fall)*.5);
      tuned[k]=follow(prior[k]??base,target,dt,q.response);
    }
    // Keep a persistent output identity: shipping wake histories key on it.
    const oldPose=s.output.pose;Object.assign(s.output,s.native);s.output.pose={...oldPose};
    for(const k of Object.keys(s.native.pose))s.output.pose[k]=tuned[k];
    if(s.model.family==='high-orbit')Object.assign(s.output.pose,{tailRoot:tuned.tailRoot,tailMid:tuned.tailMid,tailTip:tuned.tailTip});
    else if(s.model.family==='arcflash')Object.assign(s.output,{tailRoot:tuned.tailRoot,tailMid:tuned.tailMid,tailTip:tuned.tailTip});
    else Object.assign(s.output,{tailBase:tuned.tailRoot,tailBend:tuned.tailMid,tailTip:tuned.tailTip});
  }else{
    if(eligible&&p.descOrder.length){s.bank='desc';s.slot=Math.min(p.descOrder.length-1,Math.floor(s.fall*p.descOrder.length));s.frame=p.descOrder[s.slot];}
    else {
      s.bank=p.tapSource;let phase=tapT;
      if(p.tapSource==='loop')phase=p.loopContinuous?(s.time/p.tapSeconds)%1:(s.tapAge>=p.tapSeconds?0:tapT);
      if(p.tapPath==='out-back')phase=phase<=p.returnAt?phase/p.returnAt:1-(phase-p.returnAt)/(1-p.returnAt);
      const total=p.tapWeights.reduce((a,b)=>a+b,0);let at=phase*total,i=0;
      while(i<p.tapWeights.length-1&&at>=p.tapWeights[i])at-=p.tapWeights[i++];
      s.slot=i;s.frame=p.tapOrder[i];
    }
  }
  return s;
}
export function createSimulation(model,project){return {model,project,tick:0,time:0,y:450,vy:0,eventIndex:0,animation:createAnimation(model),cycles:0};}
export function stepSimulation(s){
  const {pattern,profile}=s.project,start=s.tick*STEP,end=(s.tick+1)*STEP;
  // Process events at their authored times, splitting a fixed tick if needed.
  let cursor=start;
  function advance(dt){if(dt<=0)return;s.vy=Math.min(pattern.maxFall,s.vy+pattern.gravity*dt);s.y=clamp(s.y+s.vy*dt,100,800);stepAnimation(s.animation,profile,dt,s.vy);}
  while(s.eventIndex<pattern.events.length&&pattern.events[s.eventIndex].at<end-1e-9){
    const e=pattern.events[s.eventIndex++];advance(e.at-cursor);cursor=Math.max(cursor,e.at);
    if(e.type==='tap'){acceptTap(s.animation,profile);s.vy=-pattern.lift;}else{acceptDive(s.animation);s.vy=pattern.diveSpeed;}
  }
  advance(end-cursor);s.tick++;s.time=s.tick*STEP;return s;
}
export function seekSimulation(s,time){
  const duration=s.project.pattern.duration,cycle=Math.floor(Math.max(0,time)/duration),target=Math.floor((Math.max(0,time)%duration)/STEP+1e-7);
  if(cycle!==s.cycles||target<s.tick){const project=s.project;Object.assign(s,createSimulation(s.model,project));s.cycles=cycle;}
  while(s.tick<target)stepSimulation(s);
  return s;
}
export function transportTime(t,now=Date.now()){return t.time+(t.playing?Math.max(0,now-t.anchor)/1000*t.speed:0);}
