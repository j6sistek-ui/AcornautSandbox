// Export whole regenerated helmets. Only the exterior green backing is removed;
// no collar, face-window region, or source-reference alpha is cut into the art.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url)),src=root+'art-src/visor-glass/';
const ids=['royal','chronarch','sammie','princess','phoenix','seraph','cryostar','verdant','eclipse','leviathan'];
const sha=b=>createHash('sha256').update(b).digest('hex'),report=[];
const layout=readFileSync(root+'illustrated-src/game/helmet-openings.ts','utf8');
const sourceGlass=JSON.parse(layout.match(/SOURCE_GLASS = (\{[\s\S]*?\}) as const/)[1]);
const normalized=JSON.parse(layout.match(/NORMALIZED_GLASS = (\[[^\]]+\])/)[1]);
// Keep master provenance; omit its C2PA SVG thumbnail only during PNG decode.
function pngPixels(bytes){
 const parts=[bytes.subarray(0,8)];
 for(let p=8;p<bytes.length;){const length=bytes.readUInt32BE(p)+12,type=bytes.toString('ascii',p+4,p+8);if(type!=='caBX')parts.push(bytes.subarray(p,p+length));p+=length;}
 return Buffer.concat(parts);
}
for(const id of ids){
 const bytes=readFileSync(src+id+'-master.png'),im=await loadImage(pngPixels(bytes)),w=im.width,h=im.height;
 assert.equal(w,h,id+': square registered master');
 const c=createCanvas(w,h),g=c.getContext('2d');g.drawImage(im,0,0);
 const frame=g.getImageData(0,0,w,h),a=frame.data,n=w*h;
 const paper=new Uint8Array(n),outside=new Uint8Array(n),queue=new Int32Array(n);
 for(let p=0;p<n;p++){const i=p*4;paper[p]=Math.hypot(a[i],255-a[i+1],a[i+2])<55?1:0;}
 let head=0,tail=0;
 const seed=p=>{if(paper[p]&&!outside[p]){outside[p]=1;queue[tail++]=p;}};
 for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}
 for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
 // The empty space inside the detached halo is also exterior background.
 // It is deliberately seeded, not inferred from glass/metal colors.
 if(id==='seraph'){const p=Math.floor(h*.115)*w+Math.floor(w*.45);assert(paper[p],'halo opening seed');seed(p);}
 while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);if(x)seed(p-1);if(x<w-1)seed(p+1);if(y)seed(p-w);if(y<h-1)seed(p+w);}
 const edgeDistance=new Int32Array(n);
 for(let p=0;p<n;p++)edgeDistance[p]=outside[p]?0:100000;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(x)edgeDistance[p]=Math.min(edgeDistance[p],edgeDistance[p-1]+1);if(y)edgeDistance[p]=Math.min(edgeDistance[p],edgeDistance[p-w]+1);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const p=y*w+x;if(x<w-1)edgeDistance[p]=Math.min(edgeDistance[p],edgeDistance[p+1]+1);if(y<h-1)edgeDistance[p]=Math.min(edgeDistance[p],edgeDistance[p+w]+1);}
 // Recover the antialiased outer edge using its nearest solid foreground,
 // following matte-render.py's P = F*a + backing*(1-a) approach. The glass
 // interior is solid paint and is never classified as background.
 const distance=new Int32Array(n),nearest=new Int32Array(n);
 for(let p=0;p<n;p++){
  const i=p*4,solid=!outside[p]&&Math.hypot(a[i],255-a[i+1],a[i+2])>180;
  distance[p]=solid?0:100000;nearest[p]=solid?p:-1;
 }
 const relax=(p,q)=>{if(distance[q]+1<distance[p]){distance[p]=distance[q]+1;nearest[p]=nearest[q];}};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(x)relax(p,p-1);if(y)relax(p,p-w);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const p=y*w+x;if(x<w-1)relax(p,p+1);if(y<h-1)relax(p,p+w);}
 const original=a.slice();
 for(let p=0;p<n;p++){
  const i=p*4;if(outside[p]){a[i]=a[i+1]=a[i+2]=a[i+3]=0;continue;}
  a[i+3]=255;
  if(edgeDistance[p]>4||distance[p]===0||nearest[p]<0)continue;
  const j=nearest[p]*4,F=[original[j],original[j+1],original[j+2]],B=[0,255,0];
  let dot=0,norm=0;for(let k=0;k<3;k++){const d=B[k]-F[k];dot+=(B[k]-original[i+k])*d;norm+=d*d;}
  const alpha=Math.min(1,Math.max(0,dot/Math.max(1,norm)));
  a[i+3]=Math.round(alpha*255);
  for(let k=0;k<3;k++)a[i+k]=alpha?(original[i+k]-B[k]*(1-alpha))/alpha:0;
 }
 g.putImageData(frame,0,0);
 const sprite=createCanvas(256,256),s=sprite.getContext('2d');
 const fit=sourceGlass[id],scale=normalized[2]/fit[2];
 s.drawImage(c,normalized[0]-fit[0]*scale,normalized[1]-fit[1]*scale,256*scale,256*scale);
 const output=sprite.toBuffer('image/png');writeFileSync(root+'docs/art/helms/'+id+'.png',output);
 report.push({id,masterSha256:sha(bytes),referenceSha256:sha(readFileSync(src+id+'-reference.png')),spriteSha256:sha(output),width:256,height:256,glass:normalized,sourceGlass:fit,exteriorOnly:true});
}
writeFileSync(src+'export-review.json',JSON.stringify(report,null,2)+'\n');
console.log(`Exported ${report.length} whole regenerated helmets with continuous painted glass.`);
