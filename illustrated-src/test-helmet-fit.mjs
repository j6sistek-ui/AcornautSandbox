import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {helmetReview,createCanvas} from './qa/helmet-fit-render.mjs';
import {StudioRenderer} from '../tools/flight-studio/renderer.mjs';
const r=await helmetReview(),fit=await r.get('helmet-fit');
const manifest=JSON.parse(readFileSync(new URL('../tools/flight-studio/manifest.json',import.meta.url)));
const studio=new StudioRenderer(manifest,undefined,()=>createCanvas(1,1));
for(const h of manifest.helmets)studio.images.set(h.file,r.bank.helms[h.id]);
const a=createCanvas(256,256),b=createCanvas(256,256),ac=a.getContext('2d'),bc=b.getContext('2d');
function equalPixels(message){
 const x=ac.getImageData(0,0,256,256).data,y=bc.getImageData(0,0,256,256).data;let different=0;
 for(let i=0;i<x.length;i++)if(x[i]!==y[i])different++;
 assert.equal(different,0,message+' (different channels)');
}
let composites=0,pairs=0,poses=0;
assert.equal(r.cat.SUITS.length,34,'review inventory includes every current character');
assert.deepEqual(Object.keys(fit.HELMET_SEATS).sort(),r.cat.HELMETS.map(h=>h.id).sort(),'every helmet has a reviewed seat');
for(const h of r.cat.HELMETS){
 assert(fit.HELMET_SEATS[h.id].every(Number.isFinite),h.id+' finite cavity');
 assert(fit.HELMET_SEATS[h.id][2]>0,h.id+' positive cavity radius');
 assert.deepEqual(manifest.helmets.find(x=>x.id===h.id).seat,[...fit.HELMET_SEATS[h.id].slice(0,3),fit.HELMET_SEATS[h.id][3]||0],h.id+' fitting bench uses current cavity');
 for(const radius of [10,36,52])for(const angle of [-60,0,35,70]){
  ac.clearRect(0,0,256,256);bc.clearRect(0,0,256,256);
  r.draw.paintRegisteredDome(ac,h,128,128,radius,angle,r.bank);studio.helmet(bc,h.id,128,128,radius,angle);
  equalPixels(h.id+' game/Studio parity at '+radius+'px and '+angle+'deg');composites++;
 }
}
for(const suit of r.cat.SUITS){
 const own=r.cat.wearsOwnHead(suit),model=manifest.models.find(m=>m.id===suit.id);assert(model,suit.id+' present in Studio');
 if(own){
  // Every helmet selection must preserve an integrated character's portrait.
  ac.clearRect(0,0,256,256);r.draw.paintPortrait(ac,r.bank,r.cat.HELMETS[0],suit,100,128,100);
  for(const h of r.cat.HELMETS){bc.clearRect(0,0,256,256);r.draw.paintPortrait(bc,r.bank,h,suit,100,128,100);equalPixels(suit.id+' integrated head with '+h.id);}
  continue;
 }
 const helmets=r.cat.HELMETS.filter(h=>!h.suitOnly||h.suitOnly===suit.id);pairs+=helmets.length;
 assert.deepEqual(model.dome,r.draw.DOME['suit:'+suit.id],suit.id+' Studio portrait socket');
 for(const kind of ['asc','desc','tap']){
  const frames=r.bank['suit'+kind[0].toUpperCase()+kind.slice(1)][suit.id]||[];
  const anchors=frames.map((_,i)=>r.draw.DOME[`${suit.id}-${kind}-${i+1}`]||r.draw.DOME['suit:'+suit.id]);
  assert.equal(new Set(anchors.map(a=>a[2])).size,frames.length?1:0,suit.id+' '+kind+' has no helmet scale pulse');
  for(const [i,anchor]of anchors.entries()){
   const key=`${suit.id}-${kind}-${i+1}`;
   assert(anchor.every(Number.isFinite)&&anchor[2]>0,key+' valid socket');
   assert.deepEqual(manifest.anchors[key]||model.dome,anchor,key+' game/Studio socket parity');
   for(const h of helmets){ac.clearRect(0,0,256,256);ac.drawImage(frames[i],0,0);r.draw.paintRegisteredDome(ac,h,anchor[0],anchor[1],anchor[2],anchor[3]||0,r.bank);poses++;}
  }
 }
 for(const h of helmets){ac.clearRect(0,0,256,256);r.draw.paintPortrait(ac,r.bank,h,suit,100,128,100);assert(ac.getImageData(0,0,256,256).data.some((v,i)=>i%4===3&&v>0),suit.id+'/'+h.id+' actual portrait rendered');}
}
assert.equal(pairs,570,'no valid pairing was omitted');
// Imported Studio presets may contain an exclusive helmet from another suit.
// Load the same Clear fallback that paint() uses, even on a cold tool session.
const cold=new StudioRenderer(manifest),loaded=[];cold.load=async path=>loaded.push(path);
await cold.loadModel(manifest.models.find(m=>m.id==='copper'),'sunforged');
assert(loaded.includes('helms/clear.png'));assert(!loaded.includes('helms/sunforged.png'));
console.log(`PASS: ${pairs} pairings; ${composites} pixel-identical game/Studio helmet renders; ${poses} bank/helmet cases; all 13 integrated-head characters preserved.`);
r.dispose();
