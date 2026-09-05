// Reproducible sprite extraction/registration. No generated in-between poses.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const out=root+'docs/art/suits/vanguard/';mkdirSync(out,{recursive:true});
// Measured integrated helmet centres/radii in each 627px source cell.
// Normalize camera scale by helmet size, never by the changing tail bounds.
const groups=[
 ['tap-a',[[468,248,91],[462,248,91],[470,245,89],[468,247,90]]],
 ['tap-b',[[468,248,91],[466,248,91],[470,248,91],[468,248,91]]],
 ['tap-c',[[468,248,91],[468,248,91],[468,248,91],[466,248,91]]],
 ['tap-d',[[468,248,91],[466,248,91],[466,248,91],[466,248,91]]],
 ['dive-a',[[474,256,91],[482,282,91],[494,322,85],[506,371,84]]],
 ['dive-b',[[522,348,87],[513,396,86],[510,417,83],[506,479,82]]],
 ['bounce-a',[[442,223,91],[452,254,91],[466,283,88],[457,237,90]]],
 ['bounce-b',[[442,221,91],[456,222,91],[466,247,91],[466,247,91]]],
];
function key(c){
 const g=c.getContext('2d'),im=g.getImageData(0,0,c.width,c.height),d=im.data;
 // Saturated green is exclusively the authored backing, never costume.
 // Preserve neutral ivory, gold, dark fur and cyan electronics. Unmix the
 // green edge before native canvas's premultiplied resample.
 for(let i=0;i<d.length;i+=4){
   const m=Math.max(d[i],d[i+2]),excess=d[i+1]-m;
   if(excess>18){
     const a=Math.max(0,Math.min(1,1-(excess-18)/145));
     d[i+1]=Math.min(d[i+1],m+8);d[i+3]=Math.round(a*255);
   }
 }
 g.putImageData(im,0,0);return c;
}
const master=await loadImage(root+'art-src/vanguard/master.png');
const masterCanvas=createCanvas(master.width,master.height);
masterCanvas.getContext('2d').drawImage(master,0,0);key(masterCanvas);
writeFileSync(root+'art-src/vanguard/master-alpha.png',masterCanvas.toBuffer('image/png'));
let index=0;const manifest=[];
for(const [name,heads] of groups){
 const src=await loadImage(root+'art-src/vanguard/'+name+'.png');
 if(src.width!==1254||src.height!==1254)throw Error('Unexpected sheet dimensions');
 for(let cell=0;cell<4;cell++){
   const c=createCanvas(627,627),g=c.getContext('2d');
   g.drawImage(src,cell%2*627,Math.floor(cell/2)*627,627,627,0,0,627,627);key(c);
   const [hx,hy,r]=heads[cell],scale=60/r;
   // Shared torso pivot. Head moves around it with attitude; the frame
   // does not get independently cropped/recentred by its silhouette.
   const dive=index>=16&&index<24,bounce=index>=24;
   const angles=[-20,-5,15,30,32,40,48,58];
   const angle=dive?angles[index-16]*Math.PI/180:-0.85;
   const tx=dive?280+106*Math.cos(angle):bounce?330:350;
   const ty=dive?270+106*Math.sin(angle):bounce?190:200;
   const dst=createCanvas(512,512),ctx=dst.getContext('2d');
   ctx.drawImage(c,tx-hx*scale,ty-hy*scale,627*scale,627*scale);
   const pixels=ctx.getImageData(0,0,512,512).data;
   for(let x=0;x<512;x++)for(const y of [0,511])if(pixels[(y*512+x)*4+3]>16)throw Error(name+' clipped vertically');
   for(let y=0;y<512;y++)for(const x of [0,511])if(pixels[(y*512+x)*4+3]>16)throw Error(name+' clipped horizontally');
   const file='frame-'+(++index)+'.png';writeFileSync(out+file,dst.toBuffer('image/png'));
   manifest.push({file,source:name+'.png',cell,head:[hx,hy,r],registeredHead:[tx,ty,60],scale});
 }
}
// The loading fallback is the exact first animation pose. The original
// 1254px master remains in art-src for future larger marketing renders.
writeFileSync(root+'docs/art/suits/vanguard.png',readFileSync(out+'frame-1.png'));
writeFileSync(root+'art-src/vanguard/registration.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Vanguard: 32 drawn poses, 512px RGBA, fixed 60px helmet radius');
