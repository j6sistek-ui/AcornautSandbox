// Deterministic packing of the owner's 4×4 sheet. No generated/redrawn poses.
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const src=await loadImage(root+'art-src/pals/switchback/owner-sheet.jpeg');
if(src.width!==1536||src.height!==1536)throw Error('Expected the supplied 1536px 4×4 sheet');
const frames=[];let x0=384,y0=384,x1=0,y1=0;
for(let n=0;n<16;n++){
 const c=createCanvas(384,384),g=c.getContext('2d');
 g.drawImage(src,(n%4)*384,Math.floor(n/4)*384,384,384,0,0,384,384);
 const im=g.getImageData(0,0,384,384),d=im.data;
 // Remove only near-white backing connected to a cell edge. Enclosed
 // highlights in the lens/metal remain intact. JPEG fringe gets soft alpha.
 const seen=new Uint8Array(384*384),queue=[];
 const add=i=>{if(i<0||i>=seen.length||seen[i])return;const p=i*4;
  if(Math.min(d[p],d[p+1],d[p+2])<220)return;seen[i]=1;queue.push(i);};
 for(let i=0;i<384;i++){add(i);add(383*384+i);add(i*384);add(i*384+383);}
 for(let q=0;q<queue.length;q++){const i=queue[q];if(i%384)add(i-1);if(i%384<383)add(i+1);add(i-384);add(i+384);}
 for(let i=0;i<seen.length;i++){
  if(seen[i]){const p=i*4,m=Math.min(d[p],d[p+1],d[p+2]);const a=Math.max(0,Math.min(1,(250-m)/30));
   for(let k=0;k<3;k++)d[p+k]=a?Math.max(0,(d[p+k]-255*(1-a))/a):0;d[p+3]=Math.round(a*255);}
  if(d[i*4+3]>16){const x=i%384,y=Math.floor(i/384);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 }
 g.putImageData(im,0,0);frames.push(c);
}
const scale=208/Math.max(x1-x0+1,y1-y0+1),cx=(x0+x1)/2,cy=(y0+y1)/2;
mkdirSync(root+'docs/art/solo',{recursive:true});
for(let n=0;n<16;n++){
 const c=createCanvas(256,256),g=c.getContext('2d');
 g.drawImage(frames[n],128-cx*scale,128-cy*scale,384*scale,384*scale);
 const png=c.toBuffer('image/png');writeFileSync(root+`docs/art/solo/switchback-${n+1}.png`,png);
 if(n===0){writeFileSync(root+'docs/art/solo/switchback.png',png);writeFileSync(root+'art-src/pals/switchback.png',png);}
}
writeFileSync(root+'art-src/pals/switchback/registration.json',JSON.stringify({source:'owner-sheet.jpeg',cells:16,cellSize:384,canvas:256,union:[x0,y0,x1,y1],scale,center:[cx,cy]},null,2)+'\n');
console.log('Switchback: 16 owner poses, one union scale/offset, 256px RGBA and exact first-frame fallback');
