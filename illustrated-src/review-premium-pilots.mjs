#!/usr/bin/env node
// Render production fallback portraits from the same atlas and painter as flight.
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const R=await import('../docs/js/high-orbit.js'),M=await import('../docs/js/high-orbit-motion.js'),C=await import('../docs/js/high-orbit-config.js');
const art={suits:{},highOrbit:{}},hashes={};
for(const id of C.PREMIUM_SUIT_IDS)art.highOrbit[id]=await loadImage(root+'docs/art/suits/'+id+'/parts.png');
const contact=createCanvas(256*4,256*3),g=contact.getContext('2d');g.fillStyle='#10192b';g.fillRect(0,0,contact.width,contact.height);
for(const [row,id] of C.PREMIUM_SUIT_IDS.entries()){
 const c=createCanvas(256,256),ctx=c.getContext('2d');
 R.paintHighOrbit(ctx,art,id,128,128,192,undefined,undefined,false);
 const portrait='docs/art/suits/'+id+'.png';writeFileSync(root+portrait,c.toBuffer('image/png'));
 for(const path of [portrait,'docs/art/suits/'+id+'/parts.png'])hashes[path]=createHash('sha256').update(readFileSync(root+path)).digest('hex');
 for(const [col,vy] of [-400,0,610,0].entries()){
  const s=M.createHighOrbitMotion(id);for(let t=0;t<240;t++)M.stepHighOrbit(s,id,1/120,vy);
  const size=col===3?52:192;
  R.paintHighOrbit(g,art,id,col*256+128,row*256+133,size,s,undefined,false);
  g.fillStyle='#e4edf6';g.font='14px sans-serif';g.fillText(id+' / '+['climb','glide','dive','flight size 52'][col],col*256+10,row*256+20);
 }
}
mkdirSync(root+'illustrated-src/design/premium-pilots',{recursive:true});
writeFileSync(root+'illustrated-src/design/premium-pilots/pose-review.png',contact.toBuffer('image/png'));
writeFileSync(root+'art-src/premium-pilots/shipping-hashes.json',JSON.stringify(hashes,null,2)+'\n');
console.log('Three exact-rig portraits and flight-size contact rendered.');
