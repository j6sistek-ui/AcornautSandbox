#!/usr/bin/env node
// Mechanical extraction of the three approved cut masters. No new painting:
// only background-connected green and its immediate antialias fringe are keyed.
// All in-material lilac/blue/gray pixels remain unchanged.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const names=['head','torso','nearUpperArm','nearForearm','farUpperArm','farForearm','nearThigh','nearShin','farThigh','farShin','tail'];
const measures=JSON.parse(readFileSync(root+'art-src/premium-pilots/attachments.json','utf8'));
const registration={},shipping={};
for(const [id,measure] of Object.entries(measures)){
 const path=root+'art-src/premium-pilots/'+id+'-parts-master.png',img=await loadImage(path),W=img.width,H=img.height;
 assert.equal(W,1086);assert.equal(H,1448);
 const canvas=createCanvas(W,H),g=canvas.getContext('2d');g.drawImage(img,0,0);
 const pixels=g.getImageData(0,0,W,H),d=pixels.data,raw=d.slice();
 const key=new Uint8Array(W*H),queue=new Int32Array(W*H);let end=0,read=0;
 const candidate=i=>d[i*4+1]>210&&d[i*4+1]-Math.max(d[i*4],d[i*4+2])>150;
 const add=i=>{if(!key[i]&&candidate(i)){key[i]=1;queue[end++]=i;}};
 for(let x=0;x<W;x++){add(x);add((H-1)*W+x);}
 for(let y=0;y<H;y++){add(y*W);add(y*W+W-1);}
 while(read<end){const i=queue[read++],x=i%W,y=Math.floor(i/W);if(x)add(i-1);if(x<W-1)add(i+1);if(y)add(i-W);if(y<H-1)add(i+W);}
 const bg=key.slice();
 // Long silver fur wisps can carry 32 connected steps of chroma fringe.
 // Grow to convergence rather than leaving opaque green at an arbitrary
 // pass limit. Only background-connected excess is eligible; violet skin
 // and neutral/silver material interiors remain outside this mask.
 read=0;
 const fringe=i=>{const p=i*4;if(!key[i]&&d[p+1]-Math.max(d[p],d[p+2])>6){key[i]=1;queue[end++]=i;}};
 while(read<end){const i=queue[read++],x=i%W,y=Math.floor(i/W);if(x)fringe(i-1);if(x<W-1)fringe(i+1);if(y)fringe(i-W);if(y<H-1)fringe(i+W);}
 for(let i=0;i<W*H;i++)if(key[i]){
  const p=i*4;if(bg[i]){d[p+3]=0;continue;}
  const x=i%W,y=Math.floor(i/W);let nearest=-1,best=Infinity;
  for(let oy=-12;oy<=12;oy++)for(let ox=-12;ox<=12;ox++){
   const xx=x+ox,yy=y+oy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
   const q=yy*W+xx,dist=ox*ox+oy*oy;
   if(!key[q]&&dist<best){best=dist;nearest=q*4;}
  }
  if(nearest<0){d[p+3]=0;continue;}
  let num=0,den=0;
  for(let c=0;c<3;c++){const matte=c===1?255:0,v=raw[nearest+c]-matte;num+=(raw[p+c]-matte)*v;den+=v*v;}
  d[p+3]=Math.round(255*Math.max(0,Math.min(1,num/Math.max(1,den))));
  for(let c=0;c<3;c++)d[p+c]=raw[nearest+c];
 }
 const atlas=createCanvas(1024,768),ag=atlas.getContext('2d'),parts=[];
 const markers=createCanvas(W,H),mg=markers.getContext('2d');mg.drawImage(img,0,0);
 for(let cell=0;cell<11;cell++){
  const center=[cell%3*362+181,Math.floor(cell/3)*362+181];
  let seed=-1,best=Infinity;
  for(let y=Math.max(0,center[1]-130);y<Math.min(H,center[1]+130);y++)for(let x=Math.max(0,center[0]-130);x<Math.min(W,center[0]+130);x++){
   const dist=(x-center[0])**2+(y-center[1])**2;
   if(d[(y*W+x)*4+3]>220&&dist<best){best=dist;seed=y*W+x;}
  }
  assert(seed>=0,id+' '+names[cell]+' has ink');
  const owned=new Uint8Array(W*H);let count=1,rd=0;queue[0]=seed;owned[seed]=1;
  let l=W,t=H,r=0,b=0;
  const own=i=>{if(!owned[i]&&d[i*4+3]>=8){owned[i]=1;queue[count++]=i;}};
  while(rd<count){const i=queue[rd++],x=i%W,y=Math.floor(i/W);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);if(x)own(i-1);if(x<W-1)own(i+1);if(y)own(i-W);if(y<H-1)own(i+W);}
  assert(count>9000&&count<175000,id+' isolated '+names[cell]+' component '+count);
  const sx=l-3,sy=t-3,sw=r-l+7,sh=b-t+7,cut=createCanvas(sw,sh),cg=cut.getContext('2d'),cp=cg.createImageData(sw,sh);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const xx=sx+x,yy=sy+y,i=yy*W+xx;if(xx>=0&&xx<W&&yy>=0&&yy<H&&owned[i])for(let c=0;c<4;c++)cp.data[(y*sw+x)*4+c]=d[i*4+c];}
  cg.putImageData(cp,0,0);
  const scale=Math.min(238/sw,238/sh),dx=(256-sw*scale)/2,dy=(256-sh*scale)/2;
  ag.drawImage(cut,cell%4*256+dx,Math.floor(cell/4)*256+dy,sw*scale,sh*scale);
  const convert=([x,y])=>[+(dx+(x-sx)*scale).toFixed(4),+(dy+(y-sy)*scale).toFixed(4)];
  const [a,bp]=measure.joints[cell];
  const spec={name:names[cell],cell,a:convert(a),b:convert(bp),sourceBounds:[l,t,r,b],sourceA:a,sourceB:bp,scale};
  if(cell===0){
   let radius=0;const [hx,hy]=measure.headCenter;
   for(let i=0;i<count;i++){const q=queue[i];if(d[q*4+3]>=128)radius=Math.max(radius,Math.hypot(q%W-hx,Math.floor(q/W)-hy));}
   radius+=2;spec.skull=[...convert(measure.headCenter),+(radius*scale).toFixed(4)];spec.sourceHead=[hx,hy,radius];
   mg.strokeStyle='#ff20dc';mg.lineWidth=3;mg.beginPath();mg.arc(hx,hy,radius,0,Math.PI*2);mg.stroke();
  }
  parts.push(spec);
  mg.strokeStyle='#ffff00';mg.lineWidth=3;mg.beginPath();mg.moveTo(...a);mg.lineTo(...bp);mg.stroke();
  for(const q of [a,bp]){mg.fillStyle='#ff2020';mg.beginPath();mg.arc(...q,5,0,Math.PI*2);mg.fill();}
 }
 const out='docs/art/suits/'+id+'/parts.png';mkdirSync(root+'docs/art/suits/'+id,{recursive:true});
 const bytes=atlas.toBuffer('image/png');writeFileSync(root+out,bytes);shipping[out]=createHash('sha256').update(bytes).digest('hex');
 registration[id]={masterSha256:createHash('sha256').update(readFileSync(path)).digest('hex'),parts};
 mkdirSync(root+'illustrated-src/design/premium-pilots',{recursive:true});
 writeFileSync(root+'illustrated-src/design/premium-pilots/'+id+'-registration.png',markers.toBuffer('image/png'));
 console.log(id+': eleven parts, source skull radius '+parts[0].sourceHead[2].toFixed(3));
}
writeFileSync(root+'art-src/premium-pilots/registration.json',JSON.stringify(registration,null,2)+'\n');
writeFileSync(root+'art-src/premium-pilots/atlas-hashes.json',JSON.stringify(shipping,null,2)+'\n');
const small=Object.fromEntries(Object.entries(registration).map(([id,v])=>[id,v.parts.map(({name,cell,a,b,skull})=>({name,cell,a,b,...(skull?{skull}:{})}))]));
writeFileSync(root+'illustrated-src/game/premium-parts.ts','// Generated by export-premium-pilots.mjs from measured source attachments.\nexport const PREMIUM_PARTS = '+JSON.stringify(small)+' as const;\n');
