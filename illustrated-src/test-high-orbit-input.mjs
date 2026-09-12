// Accepted taps must move the limbs as well as the tail; steady travel must
// not invent a repeating tail stroke. Run against the exported controller.
import assert from 'node:assert/strict';
import {createHighOrbitMotion,highOrbitTap,stepHighOrbit} from '../docs/js/high-orbit-motion.js';
import {HIGH_ORBIT_IDS} from '../docs/js/high-orbit-config.js';
const report=[];
for(const id of HIGH_ORBIT_IDS){
  const state=createHighOrbitMotion(id);
  for(let i=0;i<1200;i++)stepHighOrbit(state,id,1/120,-250);
  const tails=[];
  for(let i=0;i<480;i++){stepHighOrbit(state,id,1/120,-250);tails.push(state.pose.tailRoot);}
  const steadyTailRange=Math.max(...tails)-Math.min(...tails);
  const control=structuredClone(state),before=structuredClone(state.pose);
  highOrbitTap(state,40);
  assert.deepEqual(state.pose,before,id+' accepted input preserves joint continuity');
  let handResponse=0,tailResponse=0;
  for(let i=0;i<100;i++){
    stepHighOrbit(state,id,1/120,-250);stepHighOrbit(control,id,1/120,-250);
    handResponse=Math.max(handResponse,Math.abs(state.pose.nearArm-control.pose.nearArm),Math.abs(state.pose.farArm-control.pose.farArm));
    tailResponse=Math.max(tailResponse,control.pose.tailRoot-state.pose.tailRoot);
    assert.equal(state.power,control.power,id+' cosmetic tap must preserve wake power');
  }
  report.push({id,steadyTailRange,handResponse,tailResponse});
}
console.log(JSON.stringify(report,null,2));
for(const r of report){
  assert(r.steadyTailRange<.1,r.id+' steady travel must not keep pumping the tail');
  assert(r.handResponse>3,r.id+' small accepted taps must visibly move a hand');
  assert(r.tailResponse>5,r.id+' small accepted taps must visibly rock the tail');
}
