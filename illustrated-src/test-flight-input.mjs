// Real Flight painter + accepted inputs: rapid taps cannot trap the first pose.
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

const art=A.emptyArt();
async function sprite(file){const im=await loadImage(join(root,'docs/art',file));Object.defineProperty(im,'src',{get:()=>file});labels.set(im,file);return A.asSprite(im);}
art.suits.flight=await sprite('suits/flight.png');
for(const [bank,n] of [['Asc',3],['Desc',5]])art['suit'+bank].flight=await Promise.all(Array.from({length:n},(_,i)=>sprite('suits/flight-'+bank.toLowerCase()+'-'+(i+1)+'.png')));
art.helms.clear=await sprite('helms/clear.png');
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
const ctx=createCanvas(390,844).getContext('2d'),results=[];
for(const interval of [.15,.3,.6,1.2]){
 const save=S.defaultSave();Object.assign(save,{equippedSuit:'flight',tutorialDone:true,guide:'done'});
 const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);w.planets=[];w.pickups=[];w.lastSpawnX=100000;
 const frames=[],tapTicks=[];
 for(let tick=0;tick<360;tick++){
   if(tick<240&&tick%Math.round(interval*60)===0){tapTicks.push(tick);Sim.flap(w,save);}
   Sim.updateWorld(w,save,1/60);D.drawPilot(ctx,w,save,art,195,1,422);
   const p=window.__acornautPose;frames.push({tick,bank:p.bank,idx:p.idx,tapAge:w.tapAnimT});
 }
 const first=frames.slice(0,Math.round(interval*60));
 const during=frames.filter(x=>x.tick<240&&x.bank==='asc');
 assert.deepEqual([...new Set(during.map(x=>x.idx))].sort(),[1,2,3],interval+'s taps must play every ascent pose before release');
 assert(frames.some(x=>x.tick>=240&&x.bank==='desc'),interval+'s release must drain the queue into descent');
 assert.equal(w.flightTapQueued,false,'queue drains after release');
 assert.equal(w.tapAnimT,-1,'release settles the visual clock');
 const saved=JSON.stringify(w.squirrel);w.screen='pause';
 const clock=w.tapAnimT;assert.equal(Sim.flap(w,save),'none');Sim.updateWorld(w,save,1/60);
 assert.equal(w.tapAnimT,clock,'pause freezes playback');assert.equal(JSON.stringify(w.squirrel),saved);
 w.screen='play';w.ready=false;Sim.flap(w,save);Sim.flap(w,save);assert(w.flightTapQueued);
 Sim.dive(w,save);assert.equal(w.flightTapQueued,false,'dive clears pending replay');
 Sim.resetRun(w,save,'fly',false);assert.equal(w.flightTapQueued,false,'reset clears pending replay');
 results.push({interval,tapTicks,firstTapPoses:[...new Set(first.map(x=>x.bank+x.idx))],allPoses:[...new Set(frames.map(x=>x.bank+x.idx))],framesDuringInput:[...new Set(during.map(x=>x.idx))]});
}
console.log(JSON.stringify({pilot:'flight',verified:true,results},null,2));
rmSync(scratch,{recursive:true,force:true});
