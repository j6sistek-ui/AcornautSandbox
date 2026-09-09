#!/usr/bin/env node
// Mechanical matte extraction and measured whole-frame registration.
// All creative cleanup is retained in the source masters; no repainting here.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(readFileSync(root+'art-src/premium-flight/registration.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const put=(path,bytes)=>writeFileSync(root+path,bytes);
const metadata={},receipt={};
mkdirSync(root+'illustrated-src/design/premium-pilots',{recursive:true});
for(const [id,measurement] of Object.entries(config.suits)){
 const masterPath='art-src/premium-flight/'+id+'-clean.png',master=readFileSync(root+masterPath),img=await loadImage(root+masterPath);
 const W=img.width,H=img.height;assert.deepEqual([W,H],measurement.sourceSize,id+' measured master size');
 const canvas=createCanvas(W,H),g=canvas.getContext('2d');g.drawImage(img,0,0);
 const pixels=g.getImageData(0,0,W,H),d=pixels.data,raw=d.slice(),key=new Uint8Array(W*H),queue=new Int32Array(W*H);
 let end=0,read=0;
 // No green is part of these approved palettes. Include enclosed matte holes.
 for(let i=0;i<W*H;i++){const p=i*4;if(d[p+1]>210&&d[p+1]-Math.max(d[p],d[p+2])>150){key[i]=1;queue[end++]=i;}}
 const bg=key.slice();
 const fringe=i=>{const p=i*4;if(!key[i]&&d[p+1]-Math.max(d[p],d[p+2])>6){key[i]=1;queue[end++]=i;}};
 while(read<end){const i=queue[read++],x=i%W,y=Math.floor(i/W);if(x)fringe(i-1);if(x<W-1)fringe(i+1);if(y)fringe(i-W);if(y<H-1)fringe(i+W);}
 for(let i=0;i<W*H;i++)if(key[i]){
  const p=i*4;if(bg[i]){d[p]=d[p+1]=d[p+2]=d[p+3]=0;continue;}
  const x=i%W,y=Math.floor(i/W);let nearest=-1,best=Infinity;
  for(let oy=-12;oy<=12;oy++)for(let ox=-12;ox<=12;ox++){
   const xx=x+ox,yy=y+oy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
   const q=yy*W+xx,dist=ox*ox+oy*oy;
   if(!key[q]&&dist<best){best=dist;nearest=q*4;}
  }
  if(nearest<0){d[p]=d[p+1]=d[p+2]=d[p+3]=0;continue;}
  let num=0,den=0;
  for(let c=0;c<3;c++){const matte=c===1?255:0,v=raw[nearest+c]-matte;num+=(raw[p+c]-matte)*v;den+=v*v;}
  d[p+3]=Math.round(255*Math.max(0,Math.min(1,num/Math.max(1,den))));
  for(let c=0;c<3;c++)d[p+c]=d[p+3]?raw[nearest+c]:0;
 }
 g.putImageData(pixels,0,0);
 const radii=measurement.frames.map(f=>f[2]).sort((a,b)=>a-b),median=(radii[7]+radii[8])/2;
 let scale=config.targetHeadRadius/median;
 // The supplied grid describes frame order, not hard crop boundaries.
 // A long tail may enter the neighboring cell's empty margin. Isolate each
 // complete connected character by its measured head, preserving that tail.
 const owned=new Uint8Array(W*H);
 const records=measurement.frames.map((m,i)=>{
  const seed=Math.round(m[1])*W+Math.round(m[0]),label=i+1;
  assert(d[seed*4+3]>128&&!owned[seed],id+' frame '+i+' unique painted head seed');
  let count=1,rd=0;queue[0]=seed;owned[seed]=label;
  let l=W,t=H,r=0,b=0;
  const own=q=>{if(!owned[q]&&d[q*4+3]>=1){owned[q]=label;queue[count++]=q;}};
  while(rd<count){const q=queue[rd++],x=q%W,y=Math.floor(q/W);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);if(x)own(q-1);if(x<W-1)own(q+1);if(y)own(q-W);if(y<H-1)own(q+W);}
  assert(count>5000,id+' frame '+i+' complete ink');
  assert(l>0&&t>0&&r<W-1&&b<H-1,id+' frame '+i+' clipped by source sheet');
  // No component may contain the next character's measured head.
  for(let other=i+1;other<measurement.frames.length;other++){const h=measurement.frames[other];assert(!owned[Math.round(h[1])*W+Math.round(h[0])],id+' overlapping source characters');}
  const sx=l,sy=t,sw=r-l+1,sh=b-t+1,cut=createCanvas(sw,sh),cg=cut.getContext('2d'),cp=cg.createImageData(sw,sh);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const q=(sy+y)*W+sx+x;if(owned[q]===label)for(let c=0;c<4;c++)cp.data[(y*sw+x)*4+c]=d[q*4+c];}
  cg.putImageData(cp,0,0);
  const [hx,hy]=m,[ax,ay]=config.anchor,P=config.padding;
  for(const limit of [(ax-P)/(hx-l),(256-P-ax)/(r-hx),(ay-P)/(hy-t),(256-P-ay)/(b-hy)])if(limit>0)scale=Math.min(scale,limit);
  return {m,sx,sy,sw,sh,cut,bounds:[l,t,r,b],count};
 });
 // A single constant scale for the complete cycle. Never normalize poses alone.
 const atlas=createCanvas(1024,1024),ag=atlas.getContext('2d');
 const proof=createCanvas(1024,1088),pg=proof.getContext('2d');
 const marked=createCanvas(W,H),mg=marked.getContext('2d');mg.drawImage(img,0,0);
 const frames=[],frameReceipts=[];
 records.forEach(({m,sx,sy,sw,sh,cut,bounds,count},i)=>{
  const convert=([x,y])=>[+(config.anchor[0]+(x-m[0])*scale).toFixed(4),+(config.anchor[1]+(y-m[1])*scale).toFixed(4)];
  const frame=createCanvas(256,256),fg=frame.getContext('2d'),[dx,dy]=convert([sx,sy]);
  fg.imageSmoothingEnabled=true;fg.imageSmoothingQuality='high';fg.drawImage(cut,dx,dy,sw*scale,sh*scale);
  // Cubic resampling can mix two non-green edge colors into a green rim.
  // These three palettes contain no green; remove only positive green spill.
  const outPixels=fg.getImageData(0,0,256,256),rgba=outPixels.data;let despilled=0;
  for(let p=0;p<rgba.length;p+=4)if(rgba[p+3]&&rgba[p+1]>Math.max(rgba[p],rgba[p+2])+6){rgba[p+1]=Math.max(rgba[p],rgba[p+2])+6;despilled++;}
  fg.putImageData(outPixels,0,0);
  const bytes=frame.toBuffer('image/png');
  let minX=256,minY=256,maxX=0,maxY=0,maxGreenExcess=0;
  for(let p=0;p<rgba.length;p+=4)if(rgba[p+3]>=8){const x=p/4%256,y=Math.floor(p/4/256);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(rgba[p+3]>=64)maxGreenExcess=Math.max(maxGreenExcess,rgba[p+1]-Math.max(rgba[p],rgba[p+2]));}
  assert(minX>=8&&minY>=8&&maxX<=247&&maxY<=247,id+' frame '+i+' shipping safety padding');
  assert(maxGreenExcess<=25,id+' frame '+i+' green contamination '+maxGreenExcess);
  ag.drawImage(frame,i%4*256,Math.floor(i/4)*256);
  if(i===0)put('docs/art/suits/'+id+'.png',bytes);
  const px=i%4*256,py=Math.floor(i/4)*272;
  pg.fillStyle=i%2?'#eee9df':'#101c30';pg.fillRect(px,py,256,272);pg.drawImage(frame,px,py);
  pg.fillStyle=i%2?'#25344a':'#dbe9ff';pg.font='13px sans-serif';pg.fillText(id+' '+String(i+1).padStart(2,'0'),px+10,py+265);
  frames.push({head:convert(m),radius:+(m[2]*scale).toFixed(4),emitters:[convert(m.slice(3,5)),convert(m.slice(5,7))]});
  frameReceipts.push({frame:i,sourceBounds:bounds,sourceInk:count,outputBounds:[minX,minY,maxX,maxY],despilled,maxGreenExcess,rgbaSha256:hash(fg.getImageData(0,0,256,256).data)});
  mg.strokeStyle='#ff20dc';mg.lineWidth=2;mg.beginPath();mg.arc(m[0],m[1],m[2],0,Math.PI*2);mg.stroke();
  for(const [x,y] of [[m[0],m[1]],m.slice(3,5),m.slice(5,7)]){mg.fillStyle='#ff2040';mg.beginPath();mg.arc(x,y,4,0,Math.PI*2);mg.fill();}
 });
 const atlasBytes=atlas.toBuffer('image/png');mkdirSync(root+'docs/art/suits/'+id,{recursive:true});put('docs/art/suits/'+id+'/flight.png',atlasBytes);
 put('illustrated-src/design/premium-pilots/'+id+'-frames.png',proof.toBuffer('image/png'));
 put('illustrated-src/design/premium-pilots/'+id+'-frame-registration.png',marked.toBuffer('image/png'));
 metadata[id]={frameCount:16,cellSize:256,fallbackFrame:0,frames};
 receipt[id]={masterSha256:hash(master),originalSha256:hash(readFileSync(root+'art-src/premium-flight/'+id+'-original.jpg')),scale,anchor:config.anchor,atlasSha256:hash(atlasBytes),frames:frameReceipts};
 console.log(id+':16 complete frames; one scale '+scale.toFixed(6)+'; fallback exactly frame0');
}
put('illustrated-src/game/premium-flight-frames.ts','// Generated by export-premium-flight.mjs from measured complete-frame masters.\nexport const PREMIUM_FLIGHT_FRAMES = '+JSON.stringify(metadata)+' as const;\n');
put('art-src/premium-flight/export-receipt.json',JSON.stringify(receipt,null,2)+'\n');
