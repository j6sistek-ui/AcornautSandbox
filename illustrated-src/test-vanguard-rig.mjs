#!/usr/bin/env node
// Pixel regression for the clipped-mesh seam found during the first review.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {paintVanguardRig}=await import('../docs/js/vanguard-rig.js');
const source=createCanvas(512,512),s=source.getContext('2d');s.fillStyle='#fff';s.fillRect(0,0,512,512);
for(const scale of [.13,.6,1]) {
 const c=createCanvas(600,600),ctx=c.getContext('2d');
 for(const pose of [
  {nearArm:.4,farArm:.5,nearLeg:-.2,farLeg:.18,settle:4,time:0},
  {nearArm:-.12,farArm:-.18,nearLeg:.24,farLeg:-.24,settle:-5,time:.1},
 ]) {
  ctx.clearRect(0,0,600,600);ctx.save();ctx.translate(280*scale,280*scale);
  paintVanguardRig(ctx,source,scale,pose);ctx.restore();
  const data=ctx.getImageData(0,0,600,600).data;
  let holes=0;
  // Solid source must remain solid through every interior mesh edge, at
  // gameplay and inspection sizes. Exclude only the outer antialias border.
  for(let y=2;y<512*scale-2;y++)for(let x=2;x<512*scale-2;x++)if(data[(y*600+x)*4+3]<250)holes++;
  assert.equal(holes,0,`mesh has no transparent seam pixels at scale ${scale}`);
 }
}
console.log('Vanguard rig: opaque mesh coverage at gameplay and enlarged sizes passed');
