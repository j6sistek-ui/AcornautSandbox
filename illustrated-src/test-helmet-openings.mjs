// Validate the real regenerated artwork and its normalized registration.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url)),src=root+'art-src/visor-glass/';
const records=JSON.parse(readFileSync(src+'export-review.json','utf8'));
const probes={royal:[125,206],chronarch:[125,186],sammie:[120,159],princess:[176,150],phoenix:[130,185],seraph:[135,199],cryostar:[137,187],verdant:[129,188],eclipse:[130,188],leviathan:[145,143]};
assert.deepEqual(records.map(r=>r.id).sort(),Object.keys(probes).sort(),'exact ten-helmet repair scope');
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const r of records){
 assert.equal(hash(readFileSync(src+r.id+'-master.png')),r.masterSha256,r.id+': master provenance');
 assert.equal(hash(readFileSync(src+r.id+'-reference.png')),r.referenceSha256,r.id+': original reference provenance');
 const bytes=readFileSync(root+'docs/art/helms/'+r.id+'.png');assert.equal(hash(bytes),r.spriteSha256,r.id+': deterministic export receipt');
 const im=await loadImage(bytes);assert.equal(im.width,256);assert.equal(im.height,256);assert.deepEqual(r.glass,[128,136,80]);
 const c=createCanvas(256,256),g=c.getContext('2d');g.drawImage(im,0,0);const p=g.getImageData(0,0,256,256).data;
 const [sx,sy,sr]=r.sourceGlass,point=(x,y)=>[Math.round(128+(x-sx)*80/sr),Math.round(136+(y-sy)*80/sr)];
 const [x,y]=point(...probes[r.id]);
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)assert.equal(p[((y+dy)*256+x+dx)*4+3],255,r.id+': lower glass must be continuous solid paint before runtime translucency');
 for(let x=0;x<256;x++){assert.equal(p[x*4+3],0,r.id+': top decoration must fit the canvas');assert.equal(p[(255*256+x)*4+3],0,r.id+': collar must fit the canvas');}
 for(let y=0;y<256;y++){assert.equal(p[(y*256)*4+3],0,r.id+': left edge margin');assert.equal(p[(y*256+255)*4+3],0,r.id+': right edge margin');}
 if(r.id==='princess'){const [x,y]=point(155,195);assert.equal(p[(y*256+x)*4+3],255,'Rose chin is closed, not a dangling strap with an opening');}
 if(r.id==='seraph'){const [x,y]=point(115,29);assert.equal(p[(y*256+x)*4+3],0,'space inside Seraph halo stays transparent');}
}
console.log('PASS 10 whole regenerated helmets: source receipts, 256px canvas, shared head registration, intact glass, closed Rose chin and unclipped decorations.');
