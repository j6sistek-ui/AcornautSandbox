// THE GOLD STANDARD (owner, 12 Sep 2026): "Cyber is absolutely the best, by
// far of any of them ... It is the goal ... the frames, the motion in the
// frames, the arc or the tail, the range it has, document it all. especially
// if things break later. this is a moment of what works really really well."
//
// This test re-flies Cyber through four scripted tap scenarios on the shipped
// js and compares every tick (frame, body angle, vy, y, tail spring) with the
// fixture frozen at that moment (stamp 282). It is NOT a rule for other suits
// - GOLD_STANDARD.md says so - it is the alarm that rings if Cyber itself
// stops flying the way it did when the owner called it the target.
//
// Re-freeze deliberately, never to make it pass:
//   ACORNAUT_GOLD_WRITE=1 node illustrated-src/test-gold-standard.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdtempSync,readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fixturePath=join(root,'illustrated-src/fixtures/gold-standard-cyber.json');
const scratch=mkdtempSync(join(tmpdir(),'acornaut-gold-'));
cpSync(join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const file of readdirSync(join(scratch,'js')).filter(x=>x.endsWith('.js'))){
  const p=join(scratch,'js',file);let code=readFileSync(p,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
  if(file==='draw.js')code+='\nexport {drawPilot};\n';
  if(file==='art.js')code+='\nexport {asSprite, ASC_BANKS, DESC_BANKS};\n';
  writeFileSync(p,code);
}
const labels=new WeakMap();
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=f=>import(pathToFileURL(join(scratch,'js',f+'.js')).href);
const [D,A,Sim,S,C,Control]=await Promise.all(['draw','art','sim','save','catalog','control-constants'].map(mod));
const ID='cyber';

// --- the rule table Cyber flies under (the words in GOLD_STANDARD.md) -----
assert.equal(A.ASC_BANKS[ID],9,'nine climb frames');assert.equal(A.DESC_BANKS[ID],9,'nine dive frames');
assert.equal(Control.TAP_SHAPE[ID],'velocity','the climb frame is picked by vertical speed');
assert.equal(Sim.repeatTapMode(ID,S.defaultSave()),'rewind','a repeat tap rewinds');
assert(!D.FROZEN_SUITS.includes(ID),'Cyber is a standard, not a frozen suit');
assert.equal(D.SUIT_DIVE_DEPTH[ID],1,'the dive flies its whole ramp');
assert(Control.TAIL_SPRING_SUITS.includes(ID),'Cyber carries a rig tail for the still');
assert.deepEqual(Control.SUIT_LEAN[ID],{up:.8,down:.3},'standard lean');
const suit=C.SUITS.find(s=>s.id===ID);assert(suit&&suit.ownHead,'Cyber wears its own head');

// --- the art on disk ------------------------------------------------------
const art=A.emptyArt();
async function sprite(file){const im=await loadImage(join(root,'docs/art',file));Object.defineProperty(im,'src',{get:()=>file});labels.set(im,file);return A.asSprite(im);}
art.suits[ID]=await sprite(`suits/${ID}.png`);
art.suitAsc[ID]=await Promise.all(Array.from({length:9},(_,i)=>sprite(`suits/${ID}-asc-${i+1}.png`)));
art.suitDesc[ID]=await Promise.all(Array.from({length:9},(_,i)=>sprite(`suits/${ID}-desc-${i+1}.png`)));
art.suitBody[ID]=await sprite(`suits/${ID}-body.png`);art.suitTail[ID]=await sprite(`suits/${ID}-tail.png`);
art.helms.clear=await sprite('helms/clear.png');
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
for(const f of [...Array.from({length:9},(_,i)=>`asc-${i+1}`),...Array.from({length:9},(_,i)=>`desc-${i+1}`),'body','tail'])
  assert(existsSync(join(root,`docs/art/suits/${ID}-${f}.png`)),`${ID}-${f}.png on disk`);

// --- re-fly the scenarios ---------------------------------------------------
const ctx=createCanvas(390,844).getContext('2d');
let drawn=[];const raw=ctx.drawImage.bind(ctx);
ctx.drawImage=(im,...args)=>{const f=labels.get(im);if(f&&f.startsWith('suits/')){const m=ctx.getTransform();drawn.push({f,angle:Math.atan2(m.b,m.a)});}return raw(im,...args);};
const SCENARIOS={
  single:t=>t===0?'tap':null,                              // one tap, then the whole fall
  cadence300:t=>t<240&&t%18===0?'tap':null,                // taps every 300 ms
  cadence150:t=>t<240&&t%9===0?'tap':null,                 // taps every 150 ms
  dive:t=>t===0?'tap':t===60?'dive':null,                  // tap, dive one second later
  burst:t=>t<30&&t%6===0?'tap':null,                       // five taps 100 ms apart
};
function fly(script){
  const save=S.defaultSave();Object.assign(save,{equippedSuit:ID,tutorialDone:true,guide:'done'});
  const random=Math.random;Math.random=()=>.5;
  const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);
  w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;w.screen='play';w.ready=false;w.warpT=0;
  const rows=[];
  for(let tick=0;tick<240;tick++){
    const act=script(tick);if(act==='tap')Sim.flap(w,save);if(act==='dive')Sim.dive(w,save);
    Sim.updateWorld(w,save,1/60);if(w.squirrel.y>19000)w.squirrel.y=19000;
    drawn=[];ctx.clearRect(0,0,390,844);D.drawPilot(ctx,w,save,art,195,1,422);
    const body=drawn.find(d=>/-(asc|desc)-\d+\.png$/.test(d.f))??drawn.find(d=>d.f.endsWith('-body.png'))??drawn.find(d=>d.f===`suits/${ID}.png`);
    rows.push([tick,body?body.f.replace(/^suits\/cyber-/,'').replace('.png',''):'-',body?+body.angle.toFixed(4):null,+w.squirrel.vy.toFixed(1),+(w.squirrel.y-w.squirrel.y*0+0).toFixed(1),+w.tailA.toFixed(4),drawn.length]);
  }
  Math.random=random;
  return rows;
}
const flown=Object.fromEntries(Object.entries(SCENARIOS).map(([k,s])=>[k,fly(s)]));
if(process.env.ACORNAUT_GOLD_WRITE){
  writeFileSync(fixturePath,JSON.stringify({suit:ID,frozen:'12 Sep 2026, stamp 282',columns:['tick','frame','bodyAngleRad','vy','y','tailA','layersDrawn'],scenarios:flown})+'\n');
  console.log('gold standard fixture written:',fixturePath);
}
const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
const diffs=[];
for(const [name,rows] of Object.entries(fixture.scenarios)){
  const now=flown[name];assert(now,`scenario ${name} still exists`);
  for(let i=0;i<rows.length;i++){
    const [tick,frame,angle,vy,y,tailA,layers]=rows[i],[,f2,a2,vy2,y2,t2,l2]=now[i];
    const bad=frame!==f2||Math.abs((angle??0)-(a2??0))>1e-3||Math.abs(vy-vy2)>.05||Math.abs(y-y2)>.05||Math.abs(tailA-t2)>1e-3||layers!==l2;
    if(bad)diffs.push({scenario:name,tick,t:+(tick/60).toFixed(3),was:{frame,angle,vy,y,tailA,layers},now:{frame:f2,angle:a2,vy:vy2,y:y2,tailA:t2,layers:l2}});
  }
}
if(diffs.length){
  console.error(`GOLD STANDARD DRIFT: Cyber no longer flies the 12 Sep 2026 trace on ${diffs.length} ticks. First differences:`);
  for(const d of diffs.slice(0,12))console.error(' ',JSON.stringify(d));
  console.error('Read illustrated-src/GOLD_STANDARD.md before touching the fixture.');
  process.exit(1);
}
// the properties the owner named, in words, so a future reader knows what the numbers mean
const single=flown.single;
const at=t=>single[Math.round(t*60)];
assert.equal(at(1/60)[1],'asc-9','one tap reaches the deepest climb frame on the second tick');
assert(single.filter(r=>r[1]==='asc-9').length>=8,'the deep climb frame is held about 150 ms');
assert(single.findIndex(r=>r[0]>0&&r[1]==='asc-1')<=20,'level again within a third of a second');
assert(single.findIndex(r=>r[1].startsWith('desc'))<=23,'the dive ramp begins as the arc turns over');
assert(single.findIndex(r=>r[1]==='desc-9')<=50,'the full dive pose lands by 0.83 s');
const seen=new Set(single.map(r=>r[1]));for(let i=1;i<=9;i++){assert(seen.has(`asc-${i}`),`asc-${i} shown`);assert(seen.has(`desc-${i}`),`desc-${i} shown`);}
assert(flown.cadence150.slice(2,240).every(r=>r[1]==='asc-9'),'150 ms taps pin the deep climb frame');
assert(single.every(r=>r[6]===1),'in flight the frame is the whole pilot: one layer, the tail is painted in');
console.log(JSON.stringify({suite:'gold standard (Cyber)',ticks:Object.values(flown).reduce((n,r)=>n+r.length,0),scenarios:Object.keys(flown),result:'PASS'}));
