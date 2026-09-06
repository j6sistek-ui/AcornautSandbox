// Extract whole, registered drawings from the generated atlas. No part rigging.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=await loadImage(root+'art-src/vanguard/depot/poses-keyed-source.png');
const anchors=JSON.parse(readFileSync(root+'art-src/vanguard/depot/anchors.json','utf8'));
const W=source.width,H=source.height,matte=createCanvas(W,H),g=matte.getContext('2d');
g.drawImage(source,0,0);const pixels=g.getImageData(0,0,W,H),d=pixels.data;
for(let i=0;i<d.length;i+=4){
  const m=Math.max(d[i],d[i+2]),excess=d[i+1]-m;
  if(excess>18){const a=Math.max(0,Math.min(1,1-(excess-18)/145));d[i+1]=Math.min(d[i+1],m+8);d[i+3]=Math.round(d[i+3]*a);}
}
g.putImageData(pixels,0,0);
// A few ears straddle nominal row boundaries. Find complete silhouettes
// before cropping, so the grid never clips them or imports another pose's ear.
const seen=new Uint8Array(W*H),queue=new Int32Array(W*H),poses=[];
for(let start=0;start<W*H;start++){
  if(seen[start]||d[start*4+3]<20)continue;
  let read=0,write=1;queue[0]=start;seen[start]=1;
  let left=W,top=H,right=0,bottom=0;
  const add=p=>{if(!seen[p]&&d[p*4+3]>=20){seen[p]=1;queue[write++]=p;}};
  while(read<write){const p=queue[read++],x=p%W,y=Math.floor(p/W);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    if(x)add(p-1);if(x+1<W)add(p+1);if(y)add(p-W);if(y+1<H)add(p+W);
  }
  if(write>8000)poses.push({left,top,right,bottom,area:write});
}
if(poses.length!==16)throw Error('Expected 16 complete silhouettes, got '+poses.length);
poses.sort((a,b)=>Math.floor((a.top+a.bottom)/2/(H/4))-Math.floor((b.top+b.bottom)/2/(H/4))||a.left-b.left);
const atlas=createCanvas(1280,1280),ctx=atlas.getContext('2d'),registration=[];
const scale=.94; // One fixed scale for every pose, independent of tail/prop bounds.
for(let frame=0;frame<16;frame++){
  const p=poses[frame],sx=p.left-2,sy=p.top-2,sw=p.right-p.left+5,sh=p.bottom-p.top+5;
  const dx=204-anchors[frame]*scale,dy=296-(p.bottom+1)*scale;
  const cell=createCanvas(320,320),cg=cell.getContext('2d');
  cg.drawImage(matte,sx,sy,sw,sh,dx+sx*scale,dy+sy*scale,sw*scale,sh*scale);
  const rgba=cg.getImageData(0,0,320,320).data;
  for(let i=0;i<320;i++)for(const q of [i,319*320+i,i*320,i*320+319])if(rgba[q*4+3]>16)throw Error('Clipped pose '+frame);
  ctx.drawImage(cell,frame%4*320,Math.floor(frame/4)*320);
  registration.push({frame,sourceBounds:p,sourceHeadX:anchors[frame],dx,dy,scale,footY:296});
}
mkdirSync(root+'docs/art/spill-scene',{recursive:true});
writeFileSync(root+'docs/art/spill-scene/vanguard-depot.png',atlas.toBuffer('image/png'));
writeFileSync(root+'art-src/vanguard/depot/registration.json',JSON.stringify(registration,null,2)+'\n');
console.log(JSON.stringify({atlas:[1280,1280],frames:16,decodedMiB:6.25,bounds:poses}));
