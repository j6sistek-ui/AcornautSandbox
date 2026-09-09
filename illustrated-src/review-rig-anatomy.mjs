// Visual receipt against the retained ART_VER252 renderer from main5aeb37c.
// Re-run immediately after export. These images do not mutate shipping art.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {createCanvas,loadImage}=createRequire(import.meta.url)(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=new URL('../',import.meta.url),out=new URL('illustrated-src/design/rig-repair/',root);
mkdirSync(out,{recursive:true});
const R=await import('../docs/js/high-orbit.js'),M=await import('../docs/js/high-orbit-motion.js');
const A=await import('../docs/js/arcflash.js'),AM=await import('../docs/js/arcflash-motion.js');
const oldR=await import('../docs/js252/high-orbit.js'),oldM=await import('../docs/js252/high-orbit-motion.js');
const oldA=await import('../docs/js252/arcflash.js'),oldAM=await import('../docs/js252/arcflash-motion.js');
const P=await import('../docs/js/high-orbit-parts.js'),AP=await import('../docs/js/arcflash-parts.js');
const F=await import('../docs/js/rig-limb-fit.js');
const {feet}=JSON.parse(readFileSync(new URL('art-src/rig-repair/foot-landmarks.json',root)));
const ids=Object.keys(feet),art={highOrbit:{},suits:{}};
for(const id of ids){const img=await loadImage(new URL(`docs/art/suits/${id}/parts.png`,root).pathname.replace(/^\/(\w:)/,'$1'));if(id==='arcflash')art.arcflash=img;else art.highOrbit[id]=img;}
const grid=createCanvas(1536,1536),ctx=grid.getContext('2d');ctx.fillStyle='#111c30';ctx.fillRect(0,0,1536,1536);
for(const [row,id] of ids.entries())for(let col=0;col<6;col++){
  const after=col%2===1,frame=Math.floor(col/2),arc=id==='arcflash';
  const motion=arc?(after?AM:oldAM):(after?M:oldM),render=arc?(after?A:oldA):(after?R:oldR);
  const s=arc?motion.createArcflashMotion():motion.createHighOrbitMotion(id);
  if(frame){
    for(let tick=0;tick<(frame===1?22:150);tick++){
      if(tick===0){if(arc)motion.arcflashTap(s,700);else if(motion.highOrbitTap)motion.highOrbitTap(s,700);}
      const vy=Math.min(610,-450+1300*tick/120);
      arc?motion.stepArcflash(s,1/120,vy):motion.stepHighOrbit(s,id,1/120,vy);
    }
  }
  const x=col*256+128,y=row*256+142;
  arc?render.paintArcflash(ctx,art,x,y,240,s,undefined,false):render.paintHighOrbit(ctx,art,id,x,y,184,s,undefined,false);
  ctx.fillStyle=after?'#91ecc7':'#b2bfce';ctx.font='14px sans-serif';ctx.fillText(`${id} · ${after?'AFTER':'BEFORE'}`,col*256+10,row*256+20);
  ctx.font='12px sans-serif';ctx.fillText(['Rest','Tap + 0.18s','Released / descent'][frame],col*256+10,row*256+39);
}
writeFileSync(new URL('before-after.png',out),grid.toBuffer('image/png'));
const boots=createCanvas(960,1320),bg=boots.getContext('2d');bg.fillStyle='#152139';bg.fillRect(0,0,960,1320);
for(const [row,id] of ids.entries())for(let column=0;column<4;column++){
  const {cell,heel,toe}=feet[id][column%2],after=column>=2,parts=id==='arcflash'?AP.ARCFLASH_PARTS:P.HIGH_ORBIT_PARTS[id];
  const atlas=id==='arcflash'?art.arcflash:art.highOrbit[id],fit=after?F.rigLimbFit(id,cell):{breadth:1,facing:1};
  const m=F.rigPartMatrix(parts[cell],[column*240+100,row*220+52],[column*240+100,row*220+157],fit.breadth,fit.facing);
  bg.save();bg.transform(...m);bg.drawImage(atlas,cell%4*256,Math.floor(cell/4)*256,256,256,0,0,256,256);bg.restore();
  const point=p=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  const h=point(heel),t=point(toe);bg.strokeStyle=after?'#7fffc3':'#ffc184';bg.lineWidth=2;bg.beginPath();bg.moveTo(...h);bg.lineTo(...t);bg.stroke();
  bg.fillStyle=bg.strokeStyle;bg.beginPath();bg.arc(...t,3,0,Math.PI*2);bg.fill();
  bg.font='13px sans-serif';bg.fillText(`${id} · ${column%2?'far':'near'} · ${after?'AFTER':'BEFORE'}`,column*240+8,row*220+23);
}
writeFileSync(new URL('foot-registration.png',out),boots.toBuffer('image/png'));
const baseline='5aeb37c6480e3434fe84830306d50911127e9804',hash=v=>createHash('sha256').update(v).digest('hex');
const baseFile=path=>execFileSync('git',['-c',`safe.directory=${fileURLToPath(root).replaceAll('\\','/').replace(/\/$/,'')}`,'show',`${baseline}:${path}`],{cwd:root,maxBuffer:10*1024*1024});
const atlases=Object.fromEntries(ids.map(id=>{
  const path=`docs/art/suits/${id}/parts.png`,sha256=hash(readFileSync(new URL(path,root)));
  assert.equal(sha256,hash(baseFile(path)),id+' keeps original costume pixels');return [path,sha256];
}));
const textFile=path=>readFileSync(new URL(path,root),'utf8').replaceAll('\r\n','\n');
const orbitFx='illustrated-src/game/high-orbit-effects.ts';
assert.equal(textFile(orbitFx),baseFile(orbitFx).toString().replaceAll('\r\n','\n'));
const arcFx=src=>src.slice(src.indexOf('type Sample='),src.indexOf('const still='));
const arcPath='illustrated-src/game/arcflash.ts';
assert.equal(arcFx(textFile(arcPath)),arcFx(baseFile(arcPath).toString().replaceAll('\r\n','\n')));
writeFileSync(new URL('preservation.json',out),JSON.stringify({baseline,atlases,highOrbitEffectSource:hash(textFile(orbitFx)),arcflashWakeAndJets:hash(arcFx(textFile(arcPath))),allUnchanged:true},null,2)+'\n');
console.log('Rendered before/after attitudes and twelve measured feet to '+out.pathname);
