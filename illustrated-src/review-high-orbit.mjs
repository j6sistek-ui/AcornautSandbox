#!/usr/bin/env node
// Render through the shipping painter. --write-stills updates ONLY the five
// fallback portraits; default produces review artifacts without changing art.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const R=await import('../docs/js/high-orbit.js'),M=await import('../docs/js/high-orbit-motion.js'),C=await import('../docs/js/high-orbit-config.js');
const art={suits:{},highOrbit:{}};
for(const id of C.HIGH_ORBIT_IDS)art.highOrbit[id]=await loadImage(root+'docs/art/suits/'+id+'/parts.png');
const out=root+'illustrated-src/design/high-orbit/';mkdirSync(out,{recursive:true});
const rows=createCanvas(1536,256*5),g=rows.getContext('2d');g.fillStyle='#10192b';g.fillRect(0,0,rows.width,rows.height);
for(const [row,id] of C.HIGH_ORBIT_IDS.entries()){
 const c=createCanvas(256,256),cg=c.getContext('2d');R.paintHighOrbit(cg,art,id,128,128,192,undefined,undefined,false);
 if(process.argv.includes('--write-stills'))writeFileSync(root+'docs/art/suits/'+id+'.png',c.toBuffer('image/png'));
 for(let frame=0;frame<6;frame++){
   const s=M.createHighOrbitMotion(id);
   for(let t=0;t<240;t++)M.stepHighOrbit(s,id,1/120,frame<2?-400:frame<4?0:610);
   for(let t=0;t<frame*23;t++)M.stepHighOrbit(s,id,1/120,frame<2?-400:frame<4?0:610);
   R.paintHighOrbit(g,art,id,frame*256+128,row*256+133,192,s,undefined,false);
   g.fillStyle='#dce9ef';g.font='13px sans-serif';g.fillText(id+' / '+(['climb','climb','glide','glide','dive','dive'][frame]),frame*256+9,row*256+20);
 }
}
writeFileSync(out+'pose-review.png',rows.toBuffer('image/png'));
const effects=createCanvas(1280,310),eg=effects.getContext('2d');eg.fillStyle='#090f20';eg.fillRect(0,0,1280,310);
for(const [i,id] of C.HIGH_ORBIT_IDS.entries()){
 const s=M.createHighOrbitMotion(id),c=createCanvas(256,256),g=c.getContext('2d');
 for(let t=0;t<160;t++){M.stepHighOrbit(s,id,1/60,-280);g.clearRect(0,0,256,256);R.paintHighOrbit(g,art,id,148,116,165,s,{x:148,y:116,travel:t*4});}
 eg.drawImage(c,i*256,30);eg.fillStyle='#dae9f6';eg.font='16px sans-serif';eg.fillText(C.HIGH_ORBIT_PROFILES[id].name,i*256+15,22);
 eg.font='13px sans-serif';eg.fillText(C.HIGH_ORBIT_PROFILES[id].wake,i*256+15,297);
}
writeFileSync(out+'wake-review.png',effects.toBuffer('image/png'));
if(process.argv.includes('--write-stills')){
 const paths=C.HIGH_ORBIT_IDS.flatMap(id=>['docs/art/suits/'+id+'.png','docs/art/suits/'+id+'/parts.png']);
 const hashes=Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(readFileSync(root+path)).digest('hex')]));
 writeFileSync(root+'art-src/high-orbit/shipping-hashes.json',JSON.stringify(hashes,null,2)+'\n');
}
console.log('Rendered all five with the shipping painter: '+out);
