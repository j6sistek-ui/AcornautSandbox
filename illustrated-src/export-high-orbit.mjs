#!/usr/bin/env node
// Mechanical extraction of eleven owner-requested painted cut parts.
// Fixed measured joints; no painting, pose synthesis, or per-frame resizing.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const names=['head','torso','nearUpperArm','nearForearm','farUpperArm','farForearm','nearThigh','nearShin','farThigh','farShin','tail'];
// All coordinates are measured on the 1086x1448 generation, before packing.
// a/b describe attachment axes, not bounding boxes. Head b is skull center.
const source={
 cinderforge:{head:[203,175,165],joints:[[[218,311],[217,207]],[[550,54],[555,309]],[[869,89],[943,277]],[[164,417],[233,563]],[[550,436],[474,630]],[[861,420],[902,555]],[[187,740],[213,935]],[[541,744],[551,960]],[[888,743],[908,945]],[[198,1090],[196,1330]],[[686,1353],[481,1118]]]},
 groveguard:{head:[230,180,160],joints:[[[223,316],[226,215]],[[589,85],[586,324]],[[932,146],[942,332]],[[174,469],[253,585]],[[572,468],[565,656]],[[856,469],[924,584]],[[225,749],[209,951]],[[563,756],[561,948]],[[859,750],[906,956]],[[218,1080],[206,1305]],[[683,1336],[471,1126]]]},
 cosmic:{head:[205,188,159],joints:[[[207,321],[218,211]],[[577,78],[575,317]],[[905,139],[900,293]],[[179,439],[222,580]],[[553,454],[547,639]],[[871,442],[919,571]],[[207,755],[176,937]],[[561,767],[553,944]],[[871,751],[899,943]],[[182,1104],[202,1304]],[[685,1325],[490,1108]]]},
 sunforged:{head:[213,184,160],joints:[[[206,312],[224,208]],[[585,78],[559,324]],[[907,115],[941,297]],[[163,441],[239,568]],[[565,447],[524,644]],[[870,456],[936,565]],[[143,760],[228,949]],[[551,791],[562,967]],[[950,758],[860,949]],[[192,1126],[204,1324]],[[678,1331],[493,1121]]]},
 abyssal:{head:[209,177,163],joints:[[[207,305],[216,197]],[[592,65],[557,315]],[[883,107],[948,280]],[[172,427],[236,575]],[[566,438],[516,611]],[[876,417],[927,571]],[[219,752],[178,947]],[[546,755],[567,942]],[[879,751],[915,948]],[[213,1090],[195,1305]],[[691,1343],[476,1119]]]},
};
const all={};
for(const [id,measure] of Object.entries(source)){
 const image=await loadImage(root+'art-src/high-orbit/'+id+'-parts-master.png');
 assert.equal(image.width,1086);assert.equal(image.height,1448);
 const W=image.width,H=image.height,canvas=createCanvas(W,H),g=canvas.getContext('2d');
 g.drawImage(image,0,0);const pixels=g.getImageData(0,0,W,H),d=pixels.data;
 // Magenta is outside the suit palette. Key only background-connected
 // pixels; embedded pink nebula highlights remain their original RGB.
 const key=new Uint8Array(W*H),queue=new Int32Array(W*H);let n=0,read=0;
 const candidate=i=>Math.min(d[i*4],d[i*4+2])-d[i*4+1]>180&&d[i*4]>210&&d[i*4+2]>210;
 const add=i=>{if(!key[i]&&candidate(i)){key[i]=1;queue[n++]=i;}};
 for(let x=0;x<W;x++){add(x);add((H-1)*W+x);}
 for(let y=0;y<H;y++){add(y*W);add(y*W+W-1);}
 while(read<n){const i=queue[read++],x=i%W,y=Math.floor(i/W);if(x)add(i-1);if(x<W-1)add(i+1);if(y)add(i-W);if(y<H-1)add(i+W);}
 // Only the immediate silhouette fringe is eligible for decontamination.
 // Never flood through Cosmic's pink painted nebula panels.
 const background=key.slice();
 for(let pass=0;pass<3;pass++){
   const previous=key.slice();
   for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
     const i=y*W+x,p=i*4;if(previous[i])continue;
     if(Math.min(d[p],d[p+2])-d[p+1]>30&&
       (previous[i-1]||previous[i+1]||previous[i-W]||previous[i+W]))key[i]=1;
   }
 }
 const original=new Uint8ClampedArray(d);
 for(let i=0;i<W*H;i++)if(key[i]){
   const p=i*4,excess=Math.min(d[p],d[p+2])-d[p+1];
   if(background[i]){d[p+3]=0;continue;}
   // Estimate edge coverage against a nearby uncontaminated foreground
   // sample. This removes the fringe without tinting embedded suit colors.
   const x=i%W,y=Math.floor(i/W);let nearest=-1,distance=Infinity;
   for(let oy=-5;oy<=5;oy++)for(let ox=-5;ox<=5;ox++){
     const xx=x+ox,yy=y+oy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
     const q=yy*W+xx,dist=ox*ox+oy*oy;
     if(!key[q]&&dist<distance){nearest=q*4;distance=dist;}
   }
   if(nearest<0){d[p+3]=0;continue;}
   const foreground=[original[nearest],original[nearest+1],original[nearest+2]],matte=[255,0,255];
   let numerator=0,denominator=0;
   for(let c=0;c<3;c++){const f=foreground[c]-matte[c];numerator+=(original[p+c]-matte[c])*f;denominator+=f*f;}
   const alpha=Math.max(0,Math.min(1,numerator/Math.max(1,denominator)));
   d[p+3]=Math.round(255*alpha);
   for(let c=0;c<3;c++)d[p+c]=foreground[c];
 }
 g.putImageData(pixels,0,0);
 const atlas=createCanvas(1024,768),ctx=atlas.getContext('2d'),parts=[];
 for(let cell=0;cell<11;cell++){
   // Parts may cross a mathematical cell boundary by a few pixels; connected
   // components associate them with their centers rather than slicing ink.
   const approxX=cell%3*362+181,approxY=Math.floor(cell/3)*362+181;
   let seed=-1,dist=Infinity;
   for(let y=Math.max(0,approxY-120);y<Math.min(H,approxY+120);y++)for(let x=Math.max(0,approxX-120);x<Math.min(W,approxX+120);x++){
     const distance=(x-approxX)**2+(y-approxY)**2;if(d[(y*W+x)*4+3]>200&&distance<dist){seed=y*W+x;dist=distance;}
   }
   assert(seed>=0,id+' '+names[cell]+' has painted ink');
   const owned=new Uint8Array(W*H);let count=1,rd=0;queue[0]=seed;owned[seed]=1;
   let left=W,top=H,right=0,bottom=0;
   const own=i=>{if(!owned[i]&&d[i*4+3]>=8){owned[i]=1;queue[count++]=i;}};
   while(rd<count){const i=queue[rd++],x=i%W,y=Math.floor(i/W);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(x)own(i-1);if(x<W-1)own(i+1);if(y)own(i-W);if(y<H-1)own(i+W);}
   assert(count>12000&&count<160000,id+' '+names[cell]+' isolated component '+count);
   const sw=right-left+7,sh=bottom-top+7,sx=left-3,sy=top-3;
   const isolated=createCanvas(sw,sh),ig=isolated.getContext('2d'),p=ig.createImageData(sw,sh);
   for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
     const i=(sy+y)*W+sx+x;if(owned[i])for(let c=0;c<4;c++)p.data[(y*sw+x)*4+c]=d[i*4+c];
   }
   if(cell===0||cell===10){
     // Fur has no violet or magenta material. Resolve residual magenta
     // antialias pixels against nearby brown/cream fur, never costume panels.
     const original=p.data.slice();
     for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
       const k=(y*sw+x)*4;if(!original[k+3]||original[k+2]<=original[k+1]+10)continue;
       let nearest=-1,distance=Infinity;
       for(let oy=-9;oy<=9;oy++)for(let ox=-9;ox<=9;ox++){
         const xx=x+ox,yy=y+oy;if(xx<0||xx>=sw||yy<0||yy>=sh)continue;
         const j=(yy*sw+xx)*4,dist=ox*ox+oy*oy;
         if(original[j+3]>245&&original[j+2]<=original[j+1]+2&&dist<distance){nearest=j;distance=dist;}
       }
       if(nearest<0){p.data[k+3]=0;continue;}
       let numerator=0,denominator=0;
       for(let c=0;c<3;c++){const matte=c===1?0:255,f=original[nearest+c]-matte;numerator+=(original[k+c]-matte)*f;denominator+=f*f;}
       p.data[k+3]=Math.min(original[k+3],Math.round(255*Math.max(0,Math.min(1,numerator/Math.max(1,denominator)))));
       for(let c=0;c<3;c++)p.data[k+c]=original[nearest+c];
     }
   }
   ig.putImageData(p,0,0);const scale=Math.min(238/sw,238/sh),dx=(256-sw*scale)/2,dy=(256-sh*scale)/2;
   ctx.drawImage(isolated,cell%4*256+dx,Math.floor(cell/4)*256+dy,sw*scale,sh*scale);
   const convert=([x,y])=>[+(dx+(x-sx)*scale).toFixed(4),+(dy+(y-sy)*scale).toFixed(4)];
   parts.push({name:names[cell],cell,a:convert(measure.joints[cell][0]),b:convert(measure.joints[cell][1]),
     sourceBounds:[left,top,right,bottom],sourceA:measure.joints[cell][0],sourceB:measure.joints[cell][1],scale});
   if(cell===0)parts[0].skull=[...convert(measure.head),+(measure.head[2]*scale).toFixed(4)];
 }
 mkdirSync(root+'docs/art/suits/'+id,{recursive:true});
 writeFileSync(root+'docs/art/suits/'+id+'/parts.png',atlas.toBuffer('image/png'));
 all[id]=parts;
 console.log(id+': eleven isolated parts, fixed skull radius '+parts[0].skull[2]);
}
writeFileSync(root+'art-src/high-orbit/registration.json',JSON.stringify(all,null,2)+'\n');
writeFileSync(root+'illustrated-src/game/high-orbit-parts.ts',
 '// Generated by export-high-orbit.mjs. One painting per part; measured attachments.\nexport const HIGH_ORBIT_PARTS = '+
 JSON.stringify(Object.fromEntries(Object.entries(all).map(([id,parts])=>[id,parts.map(({name,cell,a,b,skull})=>({name,cell,a,b,...(skull?{skull}:{})}))])))+' as const;\n');
