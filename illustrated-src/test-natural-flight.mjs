// Production-painter coverage for the nine normalized flights and three loops.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=mkdtempSync(join(tmpdir(),'acornaut-natural-flight-'));
const output=process.env.ACORNAUT_QA_OUTPUT;
if(output)mkdirSync(output,{recursive:true});
cpSync(join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const file of readdirSync(join(scratch,'js')).filter(x=>x.endsWith('.js'))){
 const path=join(scratch,'js',file);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
 if(file==='draw.js')code+='\nexport {paintIllustrated, drawPilot, paintSpillHead, DOME, LOOP_FPS};\n';
 if(file==='art.js')code+='\nexport {asSprite, ASC_BANKS, DESC_BANKS, LOOP_BANKS};\n';
 writeFileSync(path,code);
}
const labels=new WeakMap();
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>{const c=createCanvas(1,1),g=c.getContext('2d'),draw=g.drawImage.bind(g);g.drawImage=(im,...args)=>{if(labels.has(im))labels.set(c,labels.get(im)+(labels.get(im).startsWith('suits/')?'#composite':''));return draw(im,...args);};return c;},documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=file=>import(pathToFileURL(join(scratch,'js',file+'.js')).href);
const [D,A,C,Sim,S,Control]=await Promise.all(['draw','art','catalog','sim','save','control-constants'].map(mod));
const standard=['iontrim','copper','voidsuit','sammie','gemmie','leviathan','ember','frost','ghost'];
const loops=['hedgehog','ferret','raccoon'],art=A.emptyArt();
assert.deepEqual([...D.NATURAL_FLIGHT_SUITS],standard);
async function sprite(file){const im=await loadImage(join(root,'docs/art',file));Object.defineProperty(im,'src',{get:()=>file});labels.set(im,file);return A.asSprite(im);}
for(const id of [...standard,...loops]){
 art.suits[id]=await sprite(`suits/${id}.png`);
 if(standard.includes(id)){
  assert.equal(A.ASC_BANKS[id],8);assert.equal(A.DESC_BANKS[id],8);
  for(const k of ['Asc','Desc'])art['suit'+k][id]=await Promise.all(Array.from({length:8},(_,i)=>sprite(`suits/${id}-${k.toLowerCase()}-${i+1}.png`)));
 }else{assert.equal(A.LOOP_BANKS[id],16);art.suitLoop[id]=await Promise.all(Array.from({length:16},(_,i)=>sprite(`suits/${id}-loop-${i+1}.png`)));}
}
for(const helmet of C.HELMETS)if(existsSync(join(root,`docs/art/helms/${helmet.id}.png`)))art.helms[helmet.id]=await sprite(`helms/${helmet.id}.png`);
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
const canvas=createCanvas(256,256),ctx=canvas.getContext('2d');let drawn=[];
const originalDraw=ctx.drawImage.bind(ctx);
ctx.drawImage=(im,...args)=>{if(labels.has(im))drawn.push({file:labels.get(im),args,matrix:ctx.getTransform()});return originalDraw(im,...args);};
const clear=C.HELMETS.find(x=>x.id==='clear');
const report={poseHelmetSamples:0,loops:0,liveFrames:0,previewFrames:0,loading:0,portraits:0,helmets:Object.keys(art.helms),traces:{}};
function paint(id,n,helmet=clear,size=190,t=0,bank=art){
 drawn=[];ctx.clearRect(0,0,256,256);
 const pose=n===8?1e-6:(n<8?-1:1)*(n%8)/7;
 D.paintIllustrated(ctx,art.squirrelIdle[0],128,126,size,helmet,C.SUITS.find(x=>x.id===id),t,bank,'idle-1',undefined,undefined,0,'light',0,-1,-1,0,0,0,0,300,Control.suitLean(id),pose);
}
const reviewHelmet={iontrim:'ion',copper:'solar',voidsuit:'void',sammie:'sammie',gemmie:'gemmie',leviathan:'leviathan',ember:'phoenix',frost:'lunar',ghost:'nebula'};
for(const id of standard){
 const matching=reviewHelmet[id];assert(art.helms[matching],`${id}: selected review helmet exists`);
 const sheets={clear:createCanvas(1024,1024),matching:createCanvas(1024,1024)};
 for(const sheet of Object.values(sheets)){const g=sheet.getContext('2d');g.fillStyle='#17283b';g.fillRect(0,0,1024,1024);}
 for(let n=0;n<16;n++){
  const key=`${id}-${n<8?'asc':'desc'}-${n%8+1}`,anchor=D.DOME[key];
  assert.equal(anchor[2],36,`${key}: common fitted head size`);
  for(const helmet of C.HELMETS.filter(h=>art.helms[h.id]))for(const size of [52,190]){
   paint(id,n,helmet,size);assert.equal(window.__acornautPose.idx,n%8+1);
   const body=drawn.filter(x=>x.file===`suits/${key}.png`),helm=drawn.filter(x=>x.file.startsWith('helms/'));
   assert.equal(body.length,1);assert.equal(helm.length,1,`${key}/${helmet.id}: one helmet`);
   assert(Math.abs(body[0].args.at(-2)-256*size/192)<1e-8,`${key}: shared body reference`);
   report.poseHelmetSamples++;
   if(size===190&&(helmet.id==='clear'||helmet.id===matching)){
    const sheet=sheets[helmet.id==='clear'?'clear':'matching'],g=sheet.getContext('2d');g.drawImage(canvas,n%4*256,Math.floor(n/4)*256);
    g.fillStyle='#fff';g.font='13px sans-serif';g.fillText(key,n%4*256+8,Math.floor(n/4)*256+249);
   }
  }
 }
 const loading={...art,suitAsc:{},suitDesc:{},suitBody:{},suitTail:{},suitTap:{}};
 paint(id,0,clear,190,0,loading);const fallback=canvas.toBuffer('image/png');
 const fallbackBody=drawn.find(d=>d.file===`suits/${id}.png`).args;
 const fallbackHelmet=drawn.find(d=>d.file.startsWith('helms/')).args;
 paint(id,0);assert(canvas.toBuffer('image/png').equals(fallback),`${id}: exact neutral loading fit`);report.loading++;
 drawn=[];ctx.clearRect(0,0,256,256);D.paintPortrait(ctx,art,clear,C.SUITS.find(x=>x.id===id),128,124,190);
 assert.deepEqual(drawn.find(d=>d.file===`suits/${id}.png`).args,fallbackBody,`${id}: portrait body registration`);
 assert.deepEqual(drawn.find(d=>d.file.startsWith('helms/')).args,fallbackHelmet,`${id}: portrait helmet registration`);report.portraits++;
 if(output)for(const [name,sheet] of Object.entries(sheets))writeFileSync(join(output,`${id}-${name}.png`),sheet.toBuffer('image/png'));
}
for(const id of loops){
 assert(C.wearsOwnHead(C.SUITS.find(s=>s.id===id)));
 const sheet=createCanvas(1024,1024),g=sheet.getContext('2d');g.fillStyle='#17283b';g.fillRect(0,0,1024,1024);
 for(let n=0;n<16;n++){
  paint(id,0,clear,180,(n+.1)/D.LOOP_FPS);
  assert(drawn.some(x=>x.file===`suits/${id}-loop-${n+1}.png`));assert(!drawn.some(x=>x.file.startsWith('helms/')));
  g.drawImage(canvas,n%4*256,Math.floor(n/4)*256);g.fillStyle='#fff';g.font='13px sans-serif';g.fillText(`${id} loop ${n+1}`,n%4*256+8,Math.floor(n/4)*256+249);report.loops++;
 }
 paint(id,0,clear,180,16/D.LOOP_FPS);
 assert(drawn.some(x=>x.file===`suits/${id}-loop-1.png`),`${id}: loop wraps without losing its first pose`);
 const paused=canvas.toBuffer('image/png');paint(id,0,clear,180,16/D.LOOP_FPS);
 assert(canvas.toBuffer('image/png').equals(paused),`${id}: held clock preserves the loop pose`);
 if(output)writeFileSync(join(output,`${id}-loop.png`),sheet.toBuffer('image/png'));
}
for(const id of standard){
 const save=S.defaultSave();Object.assign(save,{equippedSuit:id,equippedTrail:'ion',tutorialDone:true,guide:'done'});
 const random=Math.random;Math.random=()=>.5;const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);Math.random=random;
 w.planets=[];w.pickups=[];w.lastSpawnX=100000;w.warpT=0;
 let last=0,seen=new Set(),trace=[];
 for(let tick=0;tick<360;tick++){
  if(tick<180&&tick%36===0)Sim.flap(w,save);if(tick===210)Sim.dive(w,save);
  Math.random=()=>.5;Sim.updateWorld(w,save,1/60);Math.random=random;
  drawn=[];ctx.clearRect(0,0,256,256);D.drawPilot(ctx,w,save,art,128,1,126);
  const p=window.__acornautPose,index=(p.bank==='asc'?-1:1)*(p.idx-1);
  assert(Math.abs(index-last)<=1,`${id}: no skipped tail pose at tick ${tick}`);last=index;seen.add(index);trace.push([p.bank,p.idx]);report.liveFrames++;
  if(tick===90){const paused=canvas.toBuffer('image/png');ctx.clearRect(0,0,256,256);D.drawPilot(ctx,w,save,art,128,1,126);assert(canvas.toBuffer('image/png').equals(paused),`${id}: pause holds pose`);}
 }
 assert(seen.has(7),`${id}: live dive reaches the final pose`);assert(seen.size>=10,`${id}: tap cadence exercises the natural arc`);report.traces[id]=trace;
 const preview=new Set();
 for(let tick=0;tick<240;tick++){
  D.paintFlightPreview(ctx,art,C.SUITS.find(x=>x.id===id),clear,128,126,158,tick/30,Control.suitLean(id),false,0);
  const p=window.__acornautPose;preview.add(p.bank+'-'+p.idx);report.previewFrames++;
 }
 assert.equal(preview.size,16,`${id}: preview reaches every pose`);
}
if(output)writeFileSync(join(output,'runtime-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Natural flight passed: ${report.poseHelmetSamples} pose/helmet/size samples, ${report.loops} loop poses, ${report.liveFrames} live frames, ${report.previewFrames} preview frames, ${report.loading} loading and ${report.portraits} portrait checks.`);
rmSync(scratch,{recursive:true,force:true});
