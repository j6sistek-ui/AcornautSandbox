// Cut the owner's approved 4x4 sequence of 2x2 groups. The top-right
// panda is deliberately excluded. Retain pose positions and scale from the
// source; only Quill's erroneous long tail receives the generated repair.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url)),source=root+'art-src/natural-flight/';
const output=process.env.NATURAL_FLIGHT_OUTPUT||root+'docs/art/suits/';
mkdirSync(output,{recursive:true});
const regfile=process.env.NATURAL_FLIGHT_OUTPUT?output+'natural-export.json':source+'registration.json';
const reg=JSON.parse(readFileSync(regfile));
const original=await loadImage(source+'companions-owner-sheet.jpg');
const repair=await loadImage(source+'hedgehog-owner-tail-repaired.png');
assert.equal(original.width,1280);assert.equal(original.height,1280);
// Rectangles are in the owner's original 160px cell coordinates, tightly
// limited to the false tail. Applying only generated alpha keeps every
// original costume colour, face, paw and approved body pose intact.
const tailRegions={7:[20,98,47,133],8:[7,90,42,132],9:[4,88,43,125],10:[4,87,42,123],11:[3,89,40,124]};
const receipt={source:'companions-owner-sheet.jpg',excluded:'panda',cell:160,context:8,output:256,characters:{}};
function cutWhite(g) {
 const w=g.canvas.width,im=g.getImageData(0,0,w,w),d=im.data,bg=new Uint8Array(w*w),queue=[];
 const white=p=>Math.min(d[p*4],d[p*4+1],d[p*4+2])>=242;
 const add=p=>{if(!bg[p]&&white(p)){bg[p]=1;queue.push(p);}};
 for(let n=0;n<w;n++){add(n);add((w-1)*w+n);add(n*w);add(n*w+w-1);}
 for(let q=0;q<queue.length;q++){const p=queue[q],x=p%w,y=Math.floor(p/w);if(x)add(p-1);if(x<w-1)add(p+1);if(y)add(p-w);if(y<w-1)add(p+w);}
 for(let y=0;y<w;y++)for(let x=0;x<w;x++){
  const p=y*w+x,i=p*4;if(bg[p]){d[i]=d[i+1]=d[i+2]=d[i+3]=0;continue;}
  let edge=false;
  for(let dy=-1;dy<=1&&!edge;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<w&&bg[yy*w+xx]){edge=true;break;}}
  if(edge){const whiteMix=Math.min(d[i],d[i+1],d[i+2])/255;const a=Math.max(.05,1-whiteMix);d[i+3]=Math.round(a*255);for(let k=0;k<3;k++)d[i+k]=Math.max(0,Math.min(255,(d[i+k]-255*whiteMix)/a));}
 }
 // Context can also catch a neighbour's fingertip. Keep only the connected
 // character, using the same cutout rule as the standard-sheet exporter.
 const seen=new Uint8Array(w*w),groups=[];
 for(let p=0;p<w*w;p++)if(!seen[p]&&d[p*4+3]>8){
  const q=[p];seen[p]=1;
  for(let i=0;i<q.length;i++){const a=q[i],x=a%w,y=Math.floor(a/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,b=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=w||seen[b]||d[b*4+3]<=8)continue;seen[b]=1;q.push(b);}}
  groups.push(q);
 }
 groups.sort((a,b)=>b.length-a.length);const keep=new Uint8Array(w*w);for(const p of groups[0])keep[p]=1;
 for(let p=0;p<w*w;p++)if(!keep[p])d[p*4]=d[p*4+1]=d[p*4+2]=d[p*4+3]=0;
 g.putImageData(im,0,0);return im;
}
for(const [id,dx,dy,head] of [['raccoon',0,0,[172,94,45]],['hedgehog',0,1,[174,101,41]],['ferret',1,1,[192,85,34]]]){
 reg.report[id]=[];receipt.characters[id]=[];
 const contact=createCanvas(1024,1024),contactG=contact.getContext('2d');
 for(let n=0;n<16;n++){
  const sx=n%4*320+dx*160,sy=Math.floor(n/4)*320+dy*160;
  // Eight source pixels of surrounding context recover quills/tails that
  // cross the nominal grid. One identical crop scale preserves the motion.
  const c=createCanvas(176,176),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,176,176);g.drawImage(original,8-sx,8-sy);
  const raw=cutWhite(g),before=new Uint8ClampedArray(raw.data);
  let changed=0,region=null;
  if(id==='hedgehog'&&tailRegions[n]){
   region=tailRegions[n];
   const rc=createCanvas(160,160),rg=rc.getContext('2d');
   rg.drawImage(repair,n%4*repair.width/4,Math.floor(n/4)*repair.height/4,repair.width/4,repair.height/4,0,0,160,160);
   const rd=rg.getImageData(0,0,160,160).data;
   const [x0,y0,x1,y1]=region;
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const rp=(y*160+x)*4,p=((y+8)*176+x+8)*4,spill=Math.min(rd[rp],rd[rp+2])-rd[rp+1];
    const magenta=spill>150?1:Math.max(0,Math.min(1,(spill-8)/247));
    raw.data[p+3]=Math.round(raw.data[p+3]*(1-magenta));
    if(raw.data[p+3]!==before[p+3])changed++;
    if(raw.data[p+3]===0)raw.data[p]=raw.data[p+1]=raw.data[p+2]=0;
   }
   g.putImageData(raw,0,0);
  }
  // Verify locality before interpolation. RGB of surviving source pixels
  // is retained, and no pixel outside the tail rectangle may change.
  for(let p=0;p<176*176;p++)if(raw.data[p*4+3]!==before[p*4+3]){
   const x=p%176-8,y=Math.floor(p/176)-8;assert(region&&x>=region[0]&&x<region[2]&&y>=region[1]&&y<region[3]);
  }
  const out=createCanvas(256,256),og=out.getContext('2d');og.drawImage(c,0,0,256,256);
  const pixels=og.getImageData(0,0,256,256).data;
  let minX=256,minY=256,maxX=-1,maxY=-1,ink=0,edge=0;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]>32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);ink++;if(x<2||x>253||y<2||y>253)edge++;}
  const key=id+'-loop-'+(n+1),buffer=out.toBuffer('image/png');writeFileSync(output+key+'.png',buffer);if(n===0)writeFileSync(output+id+'.png',buffer);
  contactG.drawImage(out,n%4*256,Math.floor(n/4)*256);
  reg.report[id].push({key,head,sourceRect:[sx-8,sy-8,176,176],scale:256/176,bounds:[minX,minY,maxX,maxY],edge,ink,approvedMotion:true});
  receipt.characters[id].push({key,sourceRect:[sx-8,sy-8,176,176],tailRegion:region,changedSourceAlphaPixels:changed,outsideRepairChanges:0});
 }
 if(process.env.NATURAL_FLIGHT_OUTPUT)writeFileSync(output+id+'-approved-contact.png',contact.toBuffer('image/png'));
}
writeFileSync(regfile,JSON.stringify(reg,null,2)+'\n');
writeFileSync(source+'companion-export-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log('Cut 48 owner-approved companion poses plus 3 portraits; panda excluded; original artwork retained outside Quill tail patches.');
