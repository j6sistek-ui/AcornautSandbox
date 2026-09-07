// Check the real compiled artwork-mask helper against all shipped helmets.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const code=readFileSync(root+'docs/js/helmet-openings.js','utf8');
const {clearHelmetRearCollar}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// Independent probes placed on the visibly obstructing rear arcs.
const probes={sammie:[120,159],princess:[176,150],chronarch:[125,186],phoenix:[130,185],
 seraph:[135,199],cryostar:[137,187],verdant:[129,188],eclipse:[130,188],
 royal:[125,206],leviathan:[145,143]};
const results=[];
const bubbleIds=new Set(['clear','aurora','cherry','chrono','comet','ion','lunar','meteor','solar']);
for(const file of readdirSync(root+'docs/art/helms').filter(n=>n.endsWith('.png'))){
 const id=file.slice(0,-4),im=await loadImage(root+'docs/art/helms/'+file);
 const c=createCanvas(im.width,im.height),g=c.getContext('2d');g.drawImage(im,0,0);
 const before=g.getImageData(0,0,c.width,c.height);clearHelmetRearCollar(g,id);
 const after=g.getImageData(0,0,c.width,c.height);let changed=0;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const i=(y*c.width+x)*4;
  const differs=before.data.slice(i,i+4).some((v,j)=>v!==after.data[i+j]);
  if(differs){changed++;assert(after.data[i+3]<=before.data[i+3],id+': must only remove opacity');}
  if(y<100||x<45)assert(!differs,id+': changed upper shell or side fitting');
 }
 // The lowest opaque outline along the front collar must survive the cutout.
 for(let x=85;x<170;x+=5){
  let y=c.height-1;while(y>=0&&before.data[(y*c.width+x)*4+3]<240)y--;
  if(y<0)continue;const i=(y*c.width+x)*4;
  assert.deepEqual(after.data.slice(i,i+4),before.data.slice(i,i+4),id+': changed external collar outline');
 }
 // Painted bubble repairs must retain a continuous pane, including the old
 // rear-arc location; an alpha-zero probe would reward the original gap bug.
 if(bubbleIds.has(id))for(const [x,y] of [[125,184],[100,197],[120,207],[140,215],[160,223]]){
  const i=(y*c.width+x)*4;
  assert(before.data[i+3]>0,id+': lower-pane probe must hit original artwork');
  assert.deepEqual(after.data.slice(i,i+4),before.data.slice(i,i+4),id+': erased lower glass pane');
 }
 if(probes[id]){
  const [x,y]=probes[id],i=(y*c.width+x)*4;
  assert(before.data[i+3]>0,id+': probe must hit original art');
  assert.equal(after.data[i+3],0,id+': rear ring probe must be see-through');
  assert(changed>100&&changed<7000,id+': cutout extent');
 }else assert.equal(changed,0,id+': unaffected helmet changed');
 results.push({helmet:id,clearedRearArc:!!probes[id],changedPixels:changed});
}
const out=root+'art-src/flight-refresh/helmet-openings/';mkdirSync(out,{recursive:true});
writeFileSync(out+'pixel-review.json',JSON.stringify(results,null,2)+'\n');
console.log(`PASS ${results.length} helmet assets: ${Object.keys(probes).length} rear arcs clear; other helmets (including Gemmie), upper shells, side fittings and external collar outlines unchanged.`);
