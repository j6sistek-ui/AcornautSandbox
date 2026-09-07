#!/usr/bin/env node
// Mechanical matte extraction and packing of the generated source artwork.
// Anatomy is painted in parts-master.png; no pose or frame is synthesized here.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {widenShin} from './arcflash-leg-volume.mjs';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const image=await loadImage(root+'art-src/arcflash/parts-master.png');
const W=image.width,H=image.height;
assert.equal(W,1086);assert.equal(H,1448,'anchors refer to this reviewed master');
const matte=createCanvas(W,H),g=matte.getContext('2d');g.drawImage(image,0,0);
const pixels=g.getImageData(0,0,W,H),d=pixels.data;
for(let i=0;i<d.length;i+=4){
  const neutral=Math.max(d[i],d[i+2]),excess=d[i+1]-neutral;
  if(excess>25){d[i+3]=Math.round(255*Math.max(0,Math.min(1,(225-excess)/200)));d[i+1]=Math.min(d[i+1],neutral+5);}
}
g.putImageData(pixels,0,0);
const seen=new Uint8Array(W*H),labels=new Uint8Array(W*H),queue=new Int32Array(W*H),parts=[];
for(let start=0;start<W*H;start++){
  if(seen[start]||d[start*4+3]<25)continue;
  let read=0,count=1,left=W,top=H,right=0,bottom=0;queue[0]=start;seen[start]=1;
  const add=p=>{if(!seen[p]&&d[p*4+3]>=25){seen[p]=1;queue[count++]=p;}};
  while(read<count){const p=queue[read++],x=p%W,y=Math.floor(p/W);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    if(x)add(p-1);if(x+1<W)add(p+1);if(y)add(p-W);if(y+1<H)add(p+W);
  }
  if(count>5000){const label=parts.length+1;for(let i=0;i<count;i++)labels[queue[i]]=label;parts.push({left,top,right,bottom,label,area:count});}
}
assert.equal(parts.length,12,'eleven complete rig pieces and one reference');
parts.sort((a,b)=>Math.floor((a.top+a.bottom)/2/(H/4))-Math.floor((b.top+b.bottom)/2/(H/4))||a.left-b.left);
const names=['head','torso','nearUpperArm','nearForearm','farUpperArm','farForearm','nearThigh','nearShin','farThigh','farShin','tail','reference'];
// Two independently measured attachment points per piece. Bone length maps
// along this axis; static leg breadth is baked below in bone space.
const joints=[[[223,328],[221,156]],[[535,82],[541,320]],
  [[923,58],[824,246]],[[178,410],[182,609]],[[487,435],[606,633]],[[866,410],[949,609]],
  [[189,776],[120,970]],[[512,769],[540,935]],[[914,770],[972,960]],[[196,1075],[175,1270]],
  [[649,1359],[478,1130]],[[899,1230],[904,1110]]];
const atlas=createCanvas(1024,768),ctx=atlas.getContext('2d'),manifest=[];
for(let n=0;n<12;n++){
  const p=parts[n],sx=p.left-3,sy=p.top-3,sw=p.right-p.left+7,sh=p.bottom-p.top+7;
  const scale=Math.min(236/sw,236/sh),dx=(256-sw*scale)/2,dy=(256-sh*scale)/2;
  const isolated=createCanvas(sw,sh),ig=isolated.getContext('2d'),ip=ig.createImageData(sw,sh);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    const gx=sx+x,gy=sy+y,si=gy*W+gx;let own=labels[si]===p.label;
    if(!own&&d[si*4+3]>0&&!labels[si])for(let oy=-2;oy<=2&&!own;oy++)for(let ox=-2;ox<=2&&!own;ox++)own=labels[(gy+oy)*W+gx+ox]===p.label;
    if(own)for(let c=0;c<4;c++)ip.data[(y*sw+x)*4+c]=d[si*4+c];
  }
  ig.putImageData(ip,0,0);
  ctx.drawImage(isolated,n%4*256+dx,Math.floor(n/4)*256+dy,sw*scale,sh*scale);
  manifest.push({name:names[n],cell:n,sourceBounds:p,scale,a:joints[n][0].map((v,k)=>+(v-(k?sy:sx)).toFixed(3)),b:joints[n][1].map((v,k)=>+(v-(k?sy:sx)).toFixed(3))});
  for(const key of ['a','b'])manifest[n][key]=manifest[n][key].map((v,k)=>+((k?dy:dx)+v*scale).toFixed(3));
}
// The original front-only torso pinched inward behind the shoulder. This
// repaired painting includes the full rounded back, with the same neck/hip
// registration. Keep all other source cells and their attachments untouched.
const torso=await loadImage(root+'art-src/arcflash/torso-repaired.png');
assert.equal(torso.width,1254);assert.equal(torso.height,1254);
const tc=createCanvas(torso.width,torso.height),tg=tc.getContext('2d');tg.drawImage(torso,0,0);
const td=tg.getImageData(0,0,torso.width,torso.height).data;
let left=torso.width,top=torso.height,right=0,bottom=0;
for(let y=0;y<torso.height;y++)for(let x=0;x<torso.width;x++)if(td[(y*torso.width+x)*4+3]>=25){
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
}
// Fit into the ORIGINAL atlas anchors, not a newly normalized cell. This
// also keeps cached copies of the approved renderer compatible with the art.
const {a,b}=manifest[1],sourceA=[676,324],sourceB=[691,941];
const sourceAngle=Math.atan2(sourceB[1]-sourceA[1],sourceB[0]-sourceA[0]);
const targetAngle=Math.atan2(b[1]-a[1],b[0]-a[0]);
const scale=Math.hypot(b[0]-a[0],b[1]-a[1])/Math.hypot(sourceB[0]-sourceA[0],sourceB[1]-sourceA[1]);
ctx.clearRect(256,0,256,256);ctx.save();ctx.translate(256+a[0],a[1]);
ctx.rotate(targetAngle-sourceAngle);ctx.scale(scale,scale);ctx.drawImage(torso,-sourceA[0],-sourceA[1]);ctx.restore();
manifest[1]={name:'torso',cell:1,source:'torso-repaired.png',sourceBounds:{left,top,right,bottom},scale,
  sourceA,sourceB,a,b};
// Static thigh breadth is calibrated perpendicular to each measured bone.
// Neither endpoint moves, and no runtime pose can change this thickness.
for(const n of [6,8]){
  const spec=manifest[n],cell=createCanvas(256,256),cg=cell.getContext('2d');
  const angle=Math.atan2(spec.b[1]-spec.a[1],spec.b[0]-spec.a[0]);
  cg.translate(...spec.a);cg.rotate(angle);cg.scale(1,1.28);cg.rotate(-angle);
  cg.drawImage(atlas,n%4*256,Math.floor(n/4)*256,256,256,-spec.a[0],-spec.a[1],256,256);
  ctx.clearRect(n%4*256,Math.floor(n/4)*256,256,256);ctx.drawImage(cell,n%4*256,Math.floor(n/4)*256);
  spec.breadth=1.28;
}
for(const n of [7,9]){
  const spec=manifest[n],cell=createCanvas(256,256);
  cell.getContext('2d').drawImage(atlas,n%4*256,Math.floor(n/4)*256,256,256,0,0,256,256);
  const widened=widenShin(cell,spec,1.35,{createCanvas});
  ctx.clearRect(n%4*256,Math.floor(n/4)*256,256,256);ctx.drawImage(widened,n%4*256,Math.floor(n/4)*256);
  spec.breadth={calf:1.35,taper:[.85,1.15],paw:1};
}
mkdirSync(root+'docs/art/suits/arcflash',{recursive:true});
writeFileSync(root+'docs/art/suits/arcflash/parts.png',atlas.toBuffer('image/png'));
writeFileSync(root+'art-src/arcflash/registration.json',JSON.stringify(manifest,null,2)+'\n');
writeFileSync(root+'illustrated-src/game/arcflash-parts.ts','// Generated by export-arcflash.mjs. Measured source anchors, fixed anatomy.\nexport const ARCFLASH_PARTS = '+JSON.stringify(manifest.map(({name,cell,a,b})=>({name,cell,a,b})))+' as const;\n');
console.log(`Packed ${parts.length} Arcflash cells into 1024x768 RGBA.`);
