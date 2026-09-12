// Exercise the production painter with all three suits on identical inputs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=mkdtempSync(join(tmpdir(),'acornaut-eclipse-transfer-'));
const output=process.env.ACORNAUT_QA_OUTPUT;
if(output)mkdirSync(output,{recursive:true});
cpSync(join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const file of readdirSync(join(scratch,'js')).filter(x=>x.endsWith('.js'))){
 const path=join(scratch,'js',file);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
 if(file==='draw.js')code+='\nexport {paintIllustrated, drawPilot, DOME};\n';
 if(file==='art.js')code+='\nexport {asSprite, ASC_BANKS, DESC_BANKS};\n';
 writeFileSync(path,code);
}
const labels=new WeakMap();
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>{const c=createCanvas(1,1),g=c.getContext('2d'),draw=g.drawImage.bind(g);g.drawImage=(im,...args)=>{if(labels.has(im))labels.set(c,labels.get(im)+(labels.get(im).startsWith("suits/")?"#composite":""));return draw(im,...args);};return c;},documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=file=>import(pathToFileURL(join(scratch,'js',file+'.js')).href);
const [D,A,C,Sim,S,Control]=await Promise.all(['draw','art','catalog','sim','save','control-constants'].map(mod));
const suits=['eclipse','cryostar','verdant'],art=A.emptyArt();
async function sprite(file){const im=await loadImage(join(root,'docs/art',file));Object.defineProperty(im,'src',{get:()=>file});labels.set(im,file);return A.asSprite(im);}
for(const s of suits){
 assert.equal(A.ASC_BANKS[s],8);assert.equal(A.DESC_BANKS[s],8);
 art.suits[s]=await sprite(`suits/${s}.png`);art.suitBody[s]=await sprite(`suits/${s}-body.png`);art.suitTail[s]=await sprite(`suits/${s}-tail.png`);
 for(const k of ['Asc','Desc'])art['suit'+k][s]=await Promise.all(Array.from({length:8},(_,i)=>sprite(`suits/${s}-${k.toLowerCase()}-${i+1}.png`)));
 art.helms[s]=await sprite(`helms/${s}.png`);
}
// Eclipse's existing tap bank is loaded as in production, although flight wins.
art.suitTap.eclipse=await Promise.all(Array.from({length:16},(_,i)=>sprite(`suits/eclipse-tap-${i+1}.png`)));
art.helms.clear=await sprite('helms/clear.png');
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
const canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
let drawn=[];
const originalDraw=ctx.drawImage.bind(ctx);
ctx.drawImage=(im,...args)=>{if(labels.has(im)){const m=ctx.getTransform();drawn.push({file:labels.get(im),angle:Math.atan2(m.b,m.a),stretch:Math.hypot(m.a,m.b)/Math.hypot(m.c,m.d)});}return originalDraw(im,...args);};
const report={frames:0,helmetComposites:0,gameplayComparisons:0,previewComparisons:0,contacts:0,traces:{}};
for(const id of suits){
 const suit=C.SUITS.find(x=>x.id===id);
 for(const helmetId of ['clear',id]){
  const sheet=createCanvas(1024,1024),g=sheet.getContext('2d');
  g.fillStyle='#17283b';g.fillRect(0,0,1024,1024);
  for(let n=0;n<16;n++){
   const bank=n<8?'asc':'desc',index=n%8,key=`${id}-${bank}-${index+1}`;
   assert(D.DOME[key]?.slice(0,3).every(Number.isFinite),`${key}: measured helmet socket`);
   for(const size of [52,190]){
    ctx.clearRect(0,0,390,844);drawn=[];
    const pose=n===8?1e-6:(n<8?-1:1)*index/7;
    D.paintIllustrated(ctx,art.squirrelIdle[0],128,118,size,C.HELMETS.find(x=>x.id===helmetId),suit,0,art,'idle-1',undefined,undefined,0,'light',0,-1,-1,0,0,0,2,300,Control.suitLean(id),pose);
    assert.equal(window.__acornautPose.bank,bank);assert.equal(window.__acornautPose.idx,index+1);
    assert.equal(drawn.filter(x=>x.file===`suits/${key}.png`).length,1,`${key}: exact full-character frame`);
    assert.equal(drawn.filter(x=>x.file.startsWith('helms/')).length,1,`${key}: exactly one helmet`);
    report.frames++;report.helmetComposites++;
    if(size===190)g.drawImage(canvas,0,0,256,236,n%4*256,Math.floor(n/4)*256,256,236);
   }
   g.fillStyle='#fff';g.font='13px sans-serif';g.fillText(key,n%4*256+10,Math.floor(n/4)*256+250);
  }
  if(output)writeFileSync(join(output,`${id}-${helmetId}-frames.png`),sheet.toBuffer('image/png'));
 }
}
const physics=['time','squirrel','distance','ready','tapAnimT','tapAnimFromRot','tailA','tailV','bounceAnimT','bounceAnimDir','bounceAnimStrength','flapBoost','speed'];
for(const interval of [6,11,18]){
 const histories=[];
 for(const id of suits){
  const save=S.defaultSave();Object.assign(save,{equippedSuit:id,equippedTrail:'ion',tutorialDone:true,guide:'done'});
  const random=Math.random;Math.random=()=>.5;
  const w=Sim.makeWorld(390,5000);Sim.resetRun(w,save,'fly',false);Math.random=random;
  w.planets=[];w.pickups=[];w.lastSpawnX=100000;w.warpT=0;
  const history=[];
  for(let tick=0;tick<150;tick++){
   if(tick<interval*5&&tick%interval===0)assert.equal(Sim.flap(w,save),'flap');
   if(tick===95)Sim.dive(w,save);
   Math.random=()=>.5;Sim.updateWorld(w,save,1/60);Math.random=random;
   drawn=[];ctx.clearRect(0,0,390,844);D.drawPilot(ctx,w,save,art,195,1,422);
   const pose=window.__acornautPose,body=drawn.find(x=>x.file.startsWith(`suits/${id}-`)&&/-(asc|desc)-\d+\.png$/.test(x.file));
   assert(body,`${id}: live bank on tick ${tick}`);
   history.push({physics:Object.fromEntries(physics.map(k=>[k,structuredClone(w[k])])),pose:{bank:pose.bank,idx:pose.idx,v:pose.v},angle:body.angle,stretch:body.stretch});
  }
  histories.push(history);
 }
 // Physics parity always. Frame parity only between suits on the same
 // ascent rule: while Eclipse alone is on the classic (velocity-driven)
 // ascent trial - owner, 12 Sep 2026, "only change eclipse. to try it" -
 // its frames are expected to differ from cryostar's and verdant's, and
 // those two are still held to each other.
 const classic=id=>JSON.stringify(Control.TAP_SHAPE[id]??null);
 for(let s=1;s<3;s++)for(let tick=0;tick<150;tick++){
  const a=histories[0][tick],b=histories[s][tick];
  assert.deepEqual(b.physics,a.physics,`${suits[s]}: physics parity`);
  if(classic(suits[s])===classic(suits[0])){assert.deepEqual(b.pose,a.pose,`${suits[s]}: Eclipse live frame parity`);assert(Math.abs(a.angle-b.angle)<1e-10);assert(Math.abs(a.stretch-b.stretch)<1e-10);}
  report.gameplayComparisons++;
 }
 for(let tick=0;tick<150;tick++){
  const a=histories[1][tick],b=histories[2][tick];
  if(classic(suits[1])===classic(suits[2])){assert.deepEqual(b.pose,a.pose,`${suits[2]}: frame parity with ${suits[1]}`);assert(Math.abs(a.angle-b.angle)<1e-10);}
 }
 report.traces[interval]=histories[0].map(x=>x.pose);
}
const previews=[];
for(const id of suits){
 const trace=[];
 for(let tick=0;tick<240;tick++){
  D.paintFlightPreview(ctx,art,C.SUITS.find(x=>x.id===id),C.HELMETS.find(x=>x.id==='clear'),195,422,158,tick/30,Control.suitLean(id),false,C.suitPitchDefault(id)*Math.PI/180);
  trace.push({...window.__acornautPose,suit:undefined});
 }
 previews.push(trace);
}
// Preview parity only between suits on the same tap shape (TAP_SHAPE): while
// Eclipse alone is on the velocity trial its previews differ by design.
{const rule=id=>JSON.stringify(Control.TAP_SHAPE[id]??null);
 if(rule(suits[1])===rule(suits[0]))assert.deepEqual(previews[1],previews[0]);
 if(rule(suits[2])===rule(suits[0]))assert.deepEqual(previews[2],previews[0]);
 if(rule(suits[2])===rule(suits[1]))assert.deepEqual(previews[2],previews[1]);}
report.previewComparisons=480;
// Matched contact states exercise the outer Eclipse squash/rotation path.
for(const t of [0,.04,.12,.28,.5])for(const direction of [-1,1]){
 const matrices=[];
 for(const id of suits){
  const save=S.defaultSave();save.equippedSuit=id;const w=Sim.makeWorld(390,844);w.time=0;w.bounceAnimT=t;w.bounceAnimStrength=.8;w.bounceAnimDir=direction;w.hitCooldown=.5;
  drawn=[];D.drawPilot(ctx,w,save,art,195,1,422);const body=drawn.find(x=>/-asc-\d+\.png$/.test(x.file));assert(body);
  matrices.push([body.angle,body.stretch]);
 }
 for(let s=1;s<3;s++)for(let j=0;j<2;j++)assert(Math.abs(matrices[s][j]-matrices[0][j])<1e-10);
 report.contacts+=2;
}
if(output)writeFileSync(join(output,'runtime-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Eclipse transfer passed: ${report.frames} explicit pose/size/helmet samples, ${report.gameplayComparisons} live comparisons, ${report.previewComparisons} preview comparisons, ${report.contacts} contact comparisons.`);
rmSync(scratch,{recursive:true,force:true});
