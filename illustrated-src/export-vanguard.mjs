// Pack the drawn whole-character tail loop; no split parts or synthetic poses.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const out=root+'docs/art/suits/vanguard/';mkdirSync(out,{recursive:true});
const source=await loadImage(root+'art-src/vanguard/tail-loop.png');
const heads=JSON.parse(readFileSync(root+'art-src/vanguard/tail-heads.json','utf8'));
// Follow one down/up sweep, measured from tail mass left of x216. Interleave
// near-neighbour poses on opposite strokes to avoid small direction reversals.
const order=[0,1,10,2,15,9,7,8,6,5,3,4,14,11,13,12];
const manifest=[];
for(let n=0;n<16;n++){
 const cell=order[n],x=Math.round(cell%4*source.width/4),y=Math.round(Math.floor(cell/4)*source.height/4);
 const w=Math.round((cell%4+1)*source.width/4)-x,h=Math.round((Math.floor(cell/4)+1)*source.height/4)-y;
 const c=createCanvas(w,h),g=c.getContext('2d');g.drawImage(source,x,y,w,h,0,0,w,h);
 const im=g.getImageData(0,0,w,h),d=im.data;
 for(let i=0;i<d.length;i+=4){
  const m=Math.max(d[i],d[i+2]),excess=d[i+1]-m;
  if(excess>18){const a=Math.max(0,Math.min(1,1-(excess-18)/145));d[i+1]=Math.min(d[i+1],m+8);d[i+3]=Math.round(a*255);}
 }
 g.putImageData(im,0,0);
 const [hx,hy,r]=heads[cell],scale=60/r;
 const dst=createCanvas(512,512),ctx=dst.getContext('2d');
 ctx.drawImage(c,350-hx*scale,200-hy*scale,w*scale,h*scale);
 const pixels=ctx.getImageData(0,0,512,512).data;
 for(let i=0;i<512;i++)for(const p of [i,511*512+i,i*512,i*512+511])if(pixels[p*4+3]>16)throw Error('Clipped frame '+n);
 const file=`frame-${n+1}.png`;writeFileSync(out+file,dst.toBuffer('image/png'));
 manifest.push({file,source:'tail-loop.png',cell,head:[hx,hy,r],registeredHead:[350,200,60],scale});
}
// Superseded drawings remain as original masters in art-src, not live loads.
for(let i=17;i<=32;i++)rmSync(out+`frame-${i}.png`,{force:true});
writeFileSync(root+'docs/art/suits/vanguard.png',readFileSync(out+'frame-1.png'));
writeFileSync(root+'art-src/vanguard/registration.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Vanguard: 16 whole-character tail poses, 512px RGBA, fixed head registration');
