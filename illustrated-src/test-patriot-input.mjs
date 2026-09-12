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
const report={verified:true,pilot:'Patriot',id:'origamist',results};
if(process.env.ACORNAUT_QA_OUTPUT)writeFileSync(process.env.ACORNAUT_QA_OUTPUT+'/patriot-input.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
