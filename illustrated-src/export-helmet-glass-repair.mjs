// Composite generated replacement glass only inside the obstructing rear arc.
// The original helmet alpha, external collar, fittings and silhouette are retained.
import {createRequire} from 'node:module';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const req=createRequire(import.meta.url),{createCanvas,loadImage}=req(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url)),src=root+'art-src/helmet-glass-repair/';
const ids=['clear','aurora','cherry','chrono','comet','ion','lunar','meteor','solar'];
const mask=createCanvas(256,256),m=mask.getContext('2d');
m.fillStyle='white';m.beginPath();m.moveTo(62,151);m.bezierCurveTo(135,159,222,196,184,221);m.bezierCurveTo(130,221,82,190,62,175);m.closePath();m.fill();
const md=m.getImageData(0,0,256,256).data;
// Feather INSIDE the protected region, well above the old arc. This blends
// the generated glass into the original pane without a visible patch edge.
const distance=new Float32Array(256*256);
for(let p=0;p<distance.length;p++)distance[p]=md[p*4+3]?999:0;
for(let y=1;y<255;y++)for(let x=1;x<255;x++){const p=y*256+x;distance[p]=Math.min(distance[p],distance[p-1]+1,distance[p-256]+1);}
for(let y=254;y>0;y--)for(let x=254;x>0;x--){const p=y*256+x;distance[p]=Math.min(distance[p],distance[p+1]+1,distance[p+256]+1);}
const report=[];
for(const id of ids) {
 if(!existsSync(src+id+'-master.png'))continue;
 const before=await loadImage(src+id+'-reference.png'),master=await loadImage(src+id+'-master.png');
 const c=createCanvas(256,256),g=c.getContext('2d');g.drawImage(before,0,0);
 const base=g.getImageData(0,0,256,256),original=base.data.slice();
 const replacement=createCanvas(256,256),r=replacement.getContext('2d');r.drawImage(master,0,0,256,256);const paint=r.getImageData(0,0,256,256).data;
 let changed=0;
 for(let p=0;p<original.length;p+=4) {
   const a=md[p+3]/255*Math.min(1,distance[p/4]/5);if(!a)continue;
   assert.ok(paint[p+1]-Math.max(paint[p],paint[p+2])<80,'Matte reached the glass patch');
   for(let k=0;k<3;k++)base.data[p+k]=Math.round(original[p+k]*(1-a)+paint[p+k]*a);
   changed++;
 }
 g.putImageData(base,0,0);writeFileSync(root+'docs/art/helms/'+id+'.png',c.toBuffer('image/png'));
 for(let p=0;p<original.length;p+=4){assert.equal(base.data[p+3],original[p+3]);if(!md[p+3])assert.deepEqual(base.data.slice(p,p+4),original.slice(p,p+4));}
 report.push({id,changedPixels:changed,alphaUnchanged:true,unmaskedPixelsUnchanged:true});
}
writeFileSync(src+'patch-review.json',JSON.stringify(report,null,2)+'\n');console.log(`Composited ${report.length} generated glass repairs; all source alpha and unmasked pixels preserved.`);
