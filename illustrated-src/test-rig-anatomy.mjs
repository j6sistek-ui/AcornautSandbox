// Toe orientation and fixed proportions, plus tap recoil independent of jets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rigPartMatrix,rigLimbFit} from '../docs/js/rig-limb-fit.js';
import {HIGH_ORBIT_PARTS} from '../docs/js/high-orbit-parts.js';
import {ARCFLASH_PARTS} from '../docs/js/arcflash-parts.js';
import {createHighOrbitMotion,highOrbitTap,stepHighOrbit} from '../docs/js/high-orbit-motion.js';
import {createArcflashMotion,stepArcflash} from '../docs/js/arcflash-motion.js';
const {feet}=JSON.parse(readFileSync(new URL('../art-src/rig-repair/foot-landmarks.json',import.meta.url)));
const transform=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const report=[];
for(const [id,points] of Object.entries(feet)){
  const parts=id==='arcflash'?ARCFLASH_PARTS:HIGH_ORBIT_PARTS[id];
  for(const {cell,heel,toe} of points){
    const spec=parts[cell],fit=rigLimbFit(id,cell);
    // In an upright bone frame, positive x points toward the squirrel's nose.
    // The old far boots on these four fail this signed toe/heel check.
    for(const angle of [-35,0,45,100]){
      const r=angle*Math.PI/180,a=[120,80],b=[120-Math.sin(r)*29,80+Math.cos(r)*29];
      const m=rigPartMatrix(spec,a,b,fit.breadth,fit.facing),h=transform(m,heel),t=transform(m,toe);
      const forward=(t[0]-h[0])*Math.cos(r)+(t[1]-h[1])*Math.sin(r);
      assert(forward>8,`${id} cell${cell} toes forward at ${angle} degrees`);
      assert(distance(transform(m,spec.a),a)<1e-10&&distance(transform(m,spec.b),b)<1e-10,
        `${id} knee and boot emitter must stay on the bone ends`);
    }
    const m=rigPartMatrix(spec,[0,0],[0,29],fit.breadth,fit.facing);
    report.push({id,cell,forwardToe:transform(m,toe)[0]-transform(m,heel)[0],breadth:fit.breadth});
  }
  for(const cell of [6,7,8,9]){
    const spec=parts[cell],fit=rigLimbFit(id,cell),m=rigPartMatrix(spec,[0,0],[0,29],fit.breadth,fit.facing);
    const dx=spec.b[0]-spec.a[0],dy=spec.b[1]-spec.a[1],length=Math.hypot(dx,dy);
    // A fixed ten-source-pixel cross section expands only across the bone.
    const a=[spec.a[0]+dx*.5+dy/length*5,spec.a[1]+dy*.5-dx/length*5];
    const b=[spec.a[0]+dx*.5-dy/length*5,spec.a[1]+dy*.5+dx/length*5];
    const width=distance(transform(m,a),transform(m,b))/(10*29/length);
    assert(width>=(id==='arcflash'?1.21:1.4)&&width<1.5,id+' full, fixed hind-leg breadth');
  }
  const s=id==='arcflash'?createArcflashMotion():createHighOrbitMotion(id);
  for(const vy of [-450,0,610]){
    for(let i=0;i<120;i++)id==='arcflash'?stepArcflash(s,1/120,vy):stepHighOrbit(s,id,1/120,vy);
    assert(s.pose.nearKnee<-10&&s.pose.farKnee<-8,id+' bent hind legs rather than parallel straight sticks');
  }
}
for(const id of Object.keys(HIGH_ORBIT_PARTS)){
  const s=createHighOrbitMotion(id);
  for(let i=0;i<120;i++)stepHighOrbit(s,id,1/120,-250);
  const control=structuredClone(s),pose=structuredClone(s.pose),rates=structuredClone(s.rates),time=s.time;
  highOrbitTap(s,40); // Below the old 70px/s impulse detector.
  assert.deepEqual(s.pose,pose);assert.deepEqual(s.rates,rates);assert.equal(s.time,time);
  let peak=0;
  for(let i=0;i<80;i++){
    stepHighOrbit(s,id,1/120,-250);stepHighOrbit(control,id,1/120,-250);
    peak=Math.max(peak,control.pose.tailRoot-s.pose.tailRoot);
    assert.equal(s.power,control.power,id+' tap accent cannot retune approved boost power');
    assert.equal(s.pulse,control.pulse,id+' tap accent cannot retune approved boost pulse');
  }
  assert(peak>5,id+' short accepted tap visibly rocks the tail');
  const saved=structuredClone(s);
  for(const n of [0,-1,NaN,Infinity])highOrbitTap(s,n);
  assert.deepEqual(s,saved,id+' rejected tap does not change anything');
}
console.log(JSON.stringify({passed:true,feet:report,shortTapRecoil:true,boostPowerUnchanged:true}));
