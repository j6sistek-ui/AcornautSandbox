// Real accepted inputs and shipping painters for every registered painted bank.
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
cpSync(process.env.ACORNAUT_INPUT_JS || join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const file of readdirSync(join(scratch,'js')).filter(x=>x.endsWith('.js'))){
 const path=join(scratch,'js',file);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
 if(file==='draw.js')code+='\nexport {paintIllustrated, drawPilot, paintSpillHead, DOME, LOOP_FPS};\n';
 if(file==='art.js')code+='\nexport {asSprite, ASC_BANKS, DESC_BANKS, LOOP_BANKS, TAP_BANKS, RIGGED_SUITS};\n';
 writeFileSync(path,code);
}
const labels=new WeakMap();
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>{const c=createCanvas(1,1),g=c.getContext('2d'),draw=g.drawImage.bind(g);g.drawImage=(im,...args)=>{if(labels.has(im))labels.set(c,labels.get(im)+(labels.get(im).startsWith('suits/')?'#composite':''));return draw(im,...args);};return c;},documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=file=>import(pathToFileURL(join(scratch,'js',file+'.js')).href);
const [D,A,C,Sim,S,Control]=await Promise.all(['draw','art','catalog','sim','save','control-constants'].map(mod));


const baseline=process.env.ACORNAUT_INPUT_BASELINE==='1';
// The queue roster is every shipping bank MINUS the frozen roster (owner, 12
// Sep 2026: frozen suits rewind; test-frozen-roster pins that). Only queue
// suits are traced here - a rewinding suit visits fewer poses at 150 ms taps
// by design, which is the feel the owner froze.
const art=A.emptyArt(),banked=[...new Set([...Object.keys(A.ASC_BANKS),...Object.keys(A.TAP_BANKS),...Object.keys(A.LOOP_BANKS)])].sort();
const ids=banked.filter(id=>!D.FROZEN_SUITS.includes(id));
if(!baseline)assert.deepEqual([...Control.PAINTED_TAP_SUITS].sort(),ids,'playback roster must match shipping bank manifests minus the frozen roster');
async function sprite(file){const im=await loadImage(join(root,'docs/art',file));Object.defineProperty(im,'src',{get:()=>file});labels.set(im,file);return A.asSprite(im);}
for(const id of ids){
 art.suits[id]=await sprite('suits/'+id+'.png');
 for(const [kind,manifest] of [['Asc',A.ASC_BANKS],['Desc',A.DESC_BANKS],['Tap',A.TAP_BANKS],['Loop',A.LOOP_BANKS]])if(manifest[id])art['suit'+kind][id]=await Promise.all(Array.from({length:manifest[id]},(_,i)=>sprite('suits/'+id+'-'+kind.toLowerCase()+'-'+(i+1)+'.png')));
 if(A.RIGGED_SUITS.includes(id))for(const part of ['Body','Tail'])art['suit'+part][id]=await sprite('suits/'+id+'-'+part.toLowerCase()+'.png');
}
art.helms.clear=await sprite('helms/clear.png');
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
const ctx=createCanvas(390,844).getContext('2d'),results=[],failures=[];
let drawn=[];const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(im,...args)=>{if(labels.has(im))drawn.push(labels.get(im));return draw(im,...args);};
function world(id){const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done'});const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;return {save,w};}
function frame(id,w,save){drawn=[];ctx.clearRect(0,0,390,844);D.drawPilot(ctx,w,save,art,195,1,422);return drawn.find(f=>f.startsWith('suits/'+id+'-')&&/-(asc|desc|tap|loop)-\d+\.png$/.test(f))||'neutral';}
function check(value,message){if(!value){failures.push(message);if(!baseline)assert(value,message);}}
for(const id of ids){
 const kind=A.ASC_BANKS[id]?'asc':A.LOOP_BANKS[id]?'loop':'tap',count=(kind==='asc'?A.ASC_BANKS:kind==='loop'?A.LOOP_BANKS:A.TAP_BANKS)[id];
 for(const interval of [.15,.3,.6,1.2]){
  const {save,w}=world(id),seen=new Set(),trace=[];let releaseClock;
  for(let tick=0;tick<360;tick++){
   if(tick<240&&tick%Math.round(interval*60)===0)Sim.flap(w,save);
   Sim.updateWorld(w,save,1/60);const pose=frame(id,w,save);trace.push(pose);
   if(tick<240&&pose.includes('-'+kind+'-'))seen.add(Number(pose.match(/-(\d+)\.png$/)[1]));
   if(tick===359)releaseClock=w.tapAnimT;
  }
  check(seen.size===count,id+' at '+interval+'s only visits '+seen.size+'/'+count+' '+kind+' poses');
  check(releaseClock===-1,id+' must finish after release');
  if(kind==='asc')check(trace.slice(240).some(f=>f.includes('-desc-')),id+' must hand over to falling poses');
  const stable=new Set();w.ready=false;w.tapAnimT=-1;
  for(let tick=0;tick<180;tick++){w.time+=1/60;w.squirrel.vy=0;w.squirrel.rot=0;const pose=frame(id,w,save);if(tick>=60)stable.add(pose);}
  check(stable.size===1,id+' must not cycle with no input at steady travel');
  results.push({id,kind,interval,framesDuringInput:[...seen].sort((a,b)=>a-b),expected:count,idleFrames:stable.size,releaseClock});
 }
 if(!baseline){
  if(kind==='asc'){
   const {save,w}=world(id);Sim.flap(w,save);const initial=frame(id,w,save);let firstMove=null;
   for(let tick=1;tick<=12;tick++){Sim.updateWorld(w,save,1/60);if(frame(id,w,save)!==initial&&firstMove===null)firstMove=tick/60;}
   assert(firstMove!==null&&firstMove<=.1,id+' visible pose must engage within 100ms');
   results.find(r=>r.id===id).firstMoveMs=firstMove*1000;
  }
  const {save,w}=world(id);Sim.flap(w,save);for(let n=0;n<12;n++)Sim.updateWorld(w,save,1/60);
  Sim.flap(w,save);assert(w.tapAnimQueued);const age=w.tapAnimT,physics=JSON.stringify(w.squirrel);w.screen='pause';
  assert.equal(Sim.flap(w,save),'none');Sim.updateWorld(w,save,1/60);assert.equal(w.tapAnimT,age);assert.equal(JSON.stringify(w.squirrel),physics);
  w.screen='play';Sim.dive(w,save);assert.equal(w.tapAnimQueued,false);Sim.resetRun(w,save,'fly',false);assert.equal(w.tapAnimQueued,false);
 }
}
const report={baseline,ids,verified:failures.length===0,failures,results};
if(output)writeFileSync(join(output,baseline?'tap-bank-baseline.json':'tap-bank-input.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline,suits:ids.length,traces:results.length,failureCount:failures.length,representatives:results.filter(r=>['eclipse','iontrim','robo','raccoon'].includes(r.id)&&r.interval===.15)}));
rmSync(scratch,{recursive:true,force:true});
