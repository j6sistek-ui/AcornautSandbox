// Patriot should visibly lift shortly after an accepted tap, not after its crouch lead-in.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
globalThis.window={__ACORNAUT_BETA__:false};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const [M,P,Sim,S]=await Promise.all(['high-orbit-motion','premium-flight','sim','save'].map(n=>import('../docs/js/'+n+'.js')));
const results=[];
for(const fps of [30,60,120]){
 const save=S.defaultSave();Object.assign(save,{equippedSuit:'origamist',tutorialDone:true,guide:'done'});
 const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;
 assert.equal(Sim.flap(w,save),'flap');let lift=null,thrust=null;const seen=new Set([P.premiumFlightFrame('origamist',w.highOrbit)]);
 for(let tick=1;tick<=fps*2;tick++){
  Sim.updateWorld(w,save,1/fps);const frame=P.premiumFlightFrame('origamist',w.highOrbit);seen.add(frame);
  if(frame===5&&lift===null)lift=tick/fps;if(frame===6&&thrust===null)thrust=tick/fps;
 }
 assert(lift!==null&&lift<=.05,'first visible lift within 50ms at '+fps+'fps');
 assert(thrust!==null&&thrust<=.1,'full upward gesture within 100ms at '+fps+'fps');
 assert.deepEqual([...seen].sort((a,b)=>a-b),[0,5,6,7,8,9,10,11,12,13,14,15]);
 assert.equal(w.highOrbit.frames.active,false,'one input must settle without an automatic replay');
 results.push({fps,firstLiftMs:lift*1000,fullLiftMs:thrust*1000,frames:[...seen]});
}
// THE SECOND TAP (owner, 12 Sep 2026): "it's finishing its cycle before it
// starts animation. it's not a restart on tap. that's the issue." Live, a tap
// during the playback is frame one again on the tap itself, for all three.
// The other two answers the beta REPEAT TAP dial can give (finish = queue one
// replay, rewind = play backwards and bounce) are checked on the motion module
// directly, since the dial itself is beta-gated at import time.
const repeats={};
for(const [id,first] of [['origamist',0],['porcelain',0],['nacre',0]]){
 const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done'});
 assert.equal(Sim.repeatTapMode(id,save),'restart',id+' restarts live');
 const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;
 assert.equal(Sim.flap(w,save),'flap');
 for(let tick=0;tick<18;tick++)Sim.updateWorld(w,save,1/60);   // 300 ms into the cycle
 const before=P.premiumFlightFrame(id,w.highOrbit);
 assert(before>first&&w.highOrbit.frames.active,id+': mid-cycle at 300 ms (frame '+before+')');
 assert.equal(Sim.flap(w,save),'flap');
 const atTap=P.premiumFlightFrame(id,w.highOrbit);
 assert.equal(atTap,first,id+': the second tap is frame one again on the tap itself (got '+atTap+')');
 assert.equal(w.highOrbit.frames.queued,false,id+': nothing queued behind a restart');
 let settled=null;for(let tick=0;tick<120;tick++){Sim.updateWorld(w,save,1/60);if(!w.highOrbit.frames.active){settled=(tick+1)/60;break;}}
 assert(settled!==null&&settled<=1.02,id+': the restarted cycle settles in one duration ('+settled+' s)');
 const mode=(repeat)=>{
  const st=M.createHighOrbitMotion(id);M.highOrbitTap(st,450);for(let t=0;t<36;t++)M.stepHighOrbit(st,id,1/120,-200);
  const mid=P.premiumFlightFrame(id,st),ageMid=st.frames.age;M.highOrbitTap(st,450,repeat);
  const at=P.premiumFlightFrame(id,st);M.stepHighOrbit(st,id,1/120,-200);const next=P.premiumFlightFrame(id,st);
  let done=null;for(let t=0;t<400;t++){M.stepHighOrbit(st,id,1/120,-200);if(!st.frames.active){done=(t+1)/120;break;}}
  return {mid,ageMid:+ageMid.toFixed(3),at,next,done,shape:Object.keys(st.frames).sort().join(',')};
 };
 const finish=mode('finish');assert.equal(finish.at,finish.mid,id+': FINISH keeps playing from frame '+finish.mid);
 assert(finish.done>1.2&&finish.done<1.8,id+': FINISH queues exactly one replay ('+finish.done+' s)');
 const rewind=mode('rewind');assert.equal(rewind.at,rewind.mid,id+': REWIND turns from frame '+rewind.mid);
 assert(rewind.next<=rewind.mid,id+': REWIND plays backwards (got '+rewind.next+' after '+rewind.mid+')');
 assert(rewind.done>1&&rewind.done<1.6,id+': REWIND bounces off frame one and finishes ('+rewind.done+' s)');
 assert.equal(rewind.shape,'active,age,queued',id+': the rewind flag is gone once the bounce is over');
 const restart=mode('restart');assert.equal(restart.at,first,id+': RESTART on the module is frame one');
 assert.equal(restart.shape,'active,age,queued',id+': restart never adds a key to the frozen state shape');
 repeats[id]={before,atTap,settled,finish,rewind,restart};
}
const report={verified:true,pilot:'Patriot',id:'origamist',results,repeats};
if(process.env.ACORNAUT_QA_OUTPUT)writeFileSync(process.env.ACORNAUT_QA_OUTPUT+'/patriot-input.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
