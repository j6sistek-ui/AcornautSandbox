// Independent pixel comparison with the merged, owner-reviewed artwork.
import {createRequire} from 'node:module';import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const reg=JSON.parse(readFileSync(root+'/art-src/flight-refresh/registration.json'));
const report=[];
async function data(input){const image=await loadImage(input);assert.equal(image.width,256);assert.equal(image.height,256);const c=createCanvas(256,256),g=c.getContext('2d');g.drawImage(image,0,0);return g.getImageData(0,0,256,256).data;}
for(const [s,frames] of Object.entries(reg)){
 assert.deepEqual(readFileSync(`${root}/docs/art/suits/${s}-asc-1.png`),readFileSync(`${root}/docs/art/suits/${s}-desc-1.png`));
 for(const f of frames){const p=`docs/art/suits/${f.name}.png`,old=execFileSync('git',['show','c546cb93cc20f9ce3e3acef636869d1066cb11ae:'+p],{cwd:root,maxBuffer:2000000});const a=await data(old),b=await data(`${root}/${p}`);let changed=0,edge=256,core=0,tail=0,arm=0,leg=0;
 const [hx,hy,r]=f.head,[px,py]=f.pelvis,angle=f.pitch*Math.PI/180,u=[Math.cos(angle),Math.sin(angle)],v=[-u[1],u[0]];
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,different=a.slice(i,i+4).some((n,j)=>n!==b[i+j]);const pu=(x-px)*u[0]+(y-py)*u[1],pv=(x-px)*v[0]+(y-py)*v[1];
 if(b[i+3]>127)edge=Math.min(edge,x,y,255-x,255-y);
 if(Math.hypot(x-hx,y-hy)<r*.55){assert(!different,`${f.name}: changed face core`);core++;}
 if(pu<0&&pv<-.5*r){assert(!different,`${f.name}: changed tail plume`);tail++;}
 if(different){changed++;if(pu>0)arm++;else leg++;}
 }assert(edge>=12,`${f.name}: clipped`);report.push({frame:f.name,changedPixels:changed,armSideChanges:arm,legSideChanges:leg,unchangedFaceCorePixels:core,unchangedTailPlumePixels:tail,opaqueMargin:edge});
 }
}
for(const suit of Object.keys(reg)){const rows=report.filter(r=>r.frame.startsWith(suit+'-'));assert(rows.some(r=>r.armSideChanges>0)&&rows.some(r=>r.legSideChanges>0),suit+': missing limb edits');}
writeFileSync(`${root}/art-src/flight-refresh/limb-refinement/invariant-review.json`,JSON.stringify(report,null,2)+'\n');console.log(`PASS ${report.length} frames: both limb regions changed; neutral pairs exact; face cores and tail plumes unchanged; minimum opaque margin ${Math.min(...report.map(r=>r.opaqueMargin))}px.`);
