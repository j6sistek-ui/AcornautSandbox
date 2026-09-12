#!/usr/bin/env node
// THE TAP SHAPE AND TAIL SPRING DIALS (owner, 12 Sep 2026). A freeze-vs-today
// trace of Eclipse found one difference: which ascent frame is drawn -
// velocity used to pick it, PR #277's tap-clock ramp picks it now. The
// owner asked for Eclipse on velocity ("only change eclipse. to try it"),
// then a per-suit dial ("forward .1-1 and back .1-1"), then tail
// springiness. This runs the real painter and the real sim on each answer.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=mkdtempSync(join(tmpdir(),'acornaut-tap-shape-'));
cpSync(join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const file of readdirSync(join(scratch,'js')).filter(x=>x.endsWith('.js'))){
 const p=join(scratch,'js',file);let code=readFileSync(p,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
 if(file==='draw.js')code+='\nexport {drawPilot};\n';
 if(file==='art.js')code+='\nexport {asSprite, ASC_BANKS, DESC_BANKS, TAP_BANKS, TAIL_TAP_BANKS, RIGGED_SUITS};\n';
 writeFileSync(p,code);
}
const labels=new WeakMap();
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
// the beta page: that is where the dials are read
globalThis.window={__ACORNAUT_BETA__:true,location:{href:'http://local/beta/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=f=>import(pathToFileURL(join(scratch,'js',f+'.js')).href);
const [D,A,Sim,S,C,Control]=await Promise.all(['draw','art','sim','save','catalog','control-constants'].map(mod));

// --- the tables: exactly what the owner asked for, nothing more ----------
const VELOCITY=['eclipse','cryostar','verdant','cyber','seraph','alien','flight','briellacat','iontrim','copper','voidsuit','ember','frost','ghost','gemmie','sammie','leviathan'];
assert.deepEqual(Object.keys(Control.TAP_SHAPE).sort(),[...VELOCITY].sort(),'TAP_SHAPE: every ascent-bank suit, and only those (owner, 12 Sep 2026: "everything I don\'t name otherwise, gets velocity rewind")');
assert(Object.values(Control.TAP_SHAPE).every(v=>v==='velocity'),'and all of them are on velocity');
assert.deepEqual([...VELOCITY].sort(),[...new Set([...Object.keys(A.ASC_BANKS)])].sort(),'the velocity roster is exactly the suits with an ascent bank');
assert.deepEqual(Control.TAP_REPEAT,{raccoon:'restart',ferret:'restart',hedgehog:'restart',porcelain:'restart',nacre:'restart',origamist:'restart'},'the critters restart ("Critters, bandit, noodle and quill get velocity restart" - and A: restart only); the premium trio restarts too (Patriot "is finishing its cycle before it starts animation. it\'s not a restart on tap")');
assert.equal(Control.PAINTED_TAP_SUITS.size,0,'no suit finishes/queues live any more');
assert.deepEqual(Control.TAIL_SPRING,{},'TAIL_SPRING is empty until the owner reports numbers');
assert.deepEqual([...Control.TAIL_SPRING_SUITS].sort(),[...A.RIGGED_SUITS].sort(),'the tail-spring roster is exactly the suits that draw their own tail layer');

// --- the painter, with the real Eclipse art ------------------------------
const id='eclipse',art=A.emptyArt();
async function sprite(file){const im=await loadImage(join(root,'docs/art',file));labels.set(im,file);return A.asSprite(im);}
art.suits[id]=await sprite(`suits/${id}.png`);
const bank=async(key,prefix,n)=>{art[key][id]=await Promise.all(Array.from({length:n},(_,i)=>sprite(`suits/${id}-${prefix}-${i+1}.png`)));};
await bank('suitAsc','asc',A.ASC_BANKS[id]);await bank('suitDesc','desc',A.DESC_BANKS[id]);await bank('suitTap','tap',A.TAP_BANKS[id]);await bank('suitTapTail','tail-tap',A.TAIL_TAP_BANKS[id]);
art.suitBody[id]=await sprite(`suits/${id}-body.png`);art.suitTail[id]=await sprite(`suits/${id}-tail.png`);
art.helms.clear=await sprite('helms/clear.png');
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
const ctx=createCanvas(390,844).getContext('2d');let drawn=[];const raw=ctx.drawImage.bind(ctx);
ctx.drawImage=(im,...args)=>{const f=labels.get(im);if(f)drawn.push(f);return raw(im,...args);};
function world(setup){
 const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done'});setup?.(save);
 const w=Sim.makeWorld(390,844);Sim.resetRun(w,save,'fly',false);
 w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;w.screen='play';w.ready=false;
 return {w,save};
}
function trace(cadence,ticks,setup){
 const {w,save}=world(setup),every=Math.round(cadence*60),poses=[];
 for(let tick=0;tick<ticks;tick++){
  if(tick%every===0)Sim.flap(w,save);
  Sim.updateWorld(w,save,1/60);
  drawn=[];ctx.clearRect(0,0,390,844);D.drawPilot(ctx,w,save,art,195,1,422);
  const body=drawn.find(f=>/-(asc|desc)-\d+\.png$/.test(f));assert(body,`${id}: a live ascent/descent frame on tick ${tick}`);
  poses.push(body.replace(/^suits\/eclipse-/,'').replace('.png',''));
 }
 return poses;
}
// velocity (the table): the deep climb is reached under fast taps and the
// frame keeps moving with the climb-and-fall
{
 const fast=trace(.15,60),deep=fast.indexOf('asc-8');
 assert(deep>=0&&deep<=20,`velocity: under 150 ms taps Eclipse reaches its deepest climb by tick 20 (first asc-8 at ${deep})`);
 const walk=trace(.3,240),distinct=new Set(walk).size,changes=walk.filter((p,i)=>i&&p!==walk[i-1]).length;
 assert(distinct>=12&&changes>=90,`velocity: the ascent follows the physics - ${distinct} distinct frames, ${changes} changes in 4 s`);
}
// the dial: linear out over fwd, home over back. Measured at 600 ms taps so
// no second tap lands inside the gesture: 0.25 s up puts the deep frame at
// tick ~15 and 0.10 s back has the pilot home ~6 ticks later, then sitting.
{
 const dial=trace(.6,72,save=>{save.tapShape={eclipse:{fwd:.25,back:.1}}});
 const deep=dial.indexOf('asc-8');
 assert(deep>=12&&deep<=17,`dial 0.25/0.10: first deep frame at tick ${deep} (expected 12-17)`);
 const home=dial.slice(deep).findIndex(p=>p==='asc-1');
 assert(home>0&&home<=8,`dial 0.25/0.10: home (asc-1) within 8 ticks of the deep frame, got ${home}`);
 assert(dial.slice(deep+home,36).every(p=>p==='asc-1'),'dial 0.25/0.10: sits home until the next tap');
 // Eclipse's stock repeat rule is REWIND, so a second tap at tick 36 runs
 // the clock backwards from 0.6 s and re-crosses the deep frame ~21 ticks
 // later; on RESTART it climbs afresh and lands there 15 ticks after the tap.
 const second=dial.indexOf('asc-8',36);
 assert(second>=54&&second<=59,`dial 0.25/0.10 on rewind: the second tap re-crosses the deep frame (asc-8 at ${second})`);
 const again=trace(.6,72,save=>{save.tapShape={eclipse:{fwd:.25,back:.1}};save.tapRepeat={eclipse:'restart'}});
 const onSchedule=again.indexOf('asc-8',36);
 assert(onSchedule>=48&&onSchedule<=53,`dial 0.25/0.10 on restart: the second tap climbs again on schedule (asc-8 at ${onSchedule})`);
}
// the repeat-tap dial: on RESTART every tap is a fresh gesture from frame
// one, so at 300 ms taps the frame right after the second tap is back at
// the start; on REWIND (Eclipse's stock rule) it plays the shape backwards
{
 const restart=trace(.3,40,save=>{save.tapShape={eclipse:{fwd:.25,back:.1}};save.tapRepeat={eclipse:'restart'}});
 assert(['asc-1','asc-2'].includes(restart[18]),`restart: the tick after the second tap is frame one again, got ${restart[18]}`);
 const rewind=trace(.3,40,save=>{save.tapShape={eclipse:{fwd:.25,back:.1}}});
 assert(rewind[18]!=='asc-1',`rewind (stock for a frozen suit): the second tap continues from where the picture is, got ${rewind[18]}`);
 assert.equal(Sim.repeatTapMode('eclipse',{tapRepeat:{}}),'rewind');
 assert.equal(Sim.repeatTapMode('ember',{tapRepeat:{}}),'rewind','ember rewinds live now');
 assert.equal(Sim.repeatTapMode('raccoon',{tapRepeat:{}}),'restart');
 assert.equal(Sim.repeatTapMode('robo',{tapRepeat:{}}),'rewind');
 assert.equal(Sim.repeatTapMode('ember',{tapRepeat:{ember:'restart'}}),'restart');
}
// "default" on the dial is the stock ramp: under 150 ms taps it never
// reaches the deep frame (this is the behaviour the owner is comparing against)
{
 const stock=trace(.15,60,save=>{save.tapShape={eclipse:'default'}});
 assert(!stock.includes('asc-8'),'default ramp: 150 ms taps never reach asc-8');
 assert(new Set(stock).size>=3,'default ramp: still animates through its opening frames');
}
// a live build ignores the dial: tapShapeFor with the dial set still answers the table
// (checked through the resolver's own beta gate: IS_BETA is true here, so the
// dial wins - and the table wins when nothing is dialled)
assert.equal(S.tapShapeFor({tapShape:{}},'eclipse'),'velocity');
assert.deepEqual(S.tapShapeFor({tapShape:{eclipse:{fwd:.5,back:.5}}},'eclipse'),{fwd:.5,back:.5});
assert.equal(S.tapShapeFor({tapShape:{eclipse:'default'}},'eclipse'),null);
assert.equal(S.tapShapeFor(null,'robo'),null,'a suit off the table (a frozen one) is the stock ramp');
assert.equal(S.tapShapeFor(null,'flight'),'velocity','flight is on the velocity table per the 12 Sep ruling');

// --- the body reaction spring behind the tap accent (sim side) -----------
{
 const {w,save}=world();Sim.flap(w,save);const trace=[];
 for(let i=0;i<24;i++){Sim.updateWorld(w,save,1/60);trace.push(w.tapReact);}
 const peakAt=trace.indexOf(Math.max(...trace));
 assert(Math.max(...trace)>0.3&&Math.max(...trace)<=1,`reaction peaks between 0.3 and 1 (got ${Math.max(...trace).toFixed(3)})`);
 assert(peakAt>=2&&peakAt<=7,`reaction peaks 50-120 ms after the tap (tick ${peakAt})`);
 assert(trace[23]<0.15,`reaction has settled by 400 ms (${trace[23].toFixed(3)})`);
 // LIVE since 12 Sep 2026 (owner: "enable it in game ... by default 1x is
 // good"): the accent draws on both pages unless the player's Character
 // Glow switch is off, at a per-suit strength from the table.
 assert.equal(S.defaultSave().glowOff,undefined,'Character Glow ships ON');
 assert.equal(S.tapAccentStrengthFor(S.defaultSave(),'iontrim'),1,'an unlisted suit flies 1x');
 for(const [id,k] of Object.entries({ghost:4,alien:2,leviathan:2,volt:4,briellacat:0,verdant:4,eclipse:4,cryostar:4}))
  assert.equal(Control.TAP_ACCENT_STRENGTH[id],k,`${id} accent ${k}x, as the owner ruled`);
}

// --- the tail spring, in the sim -----------------------------------------
{
 const kick=(setup)=>{const {w,save}=world(setup);const before=w.tailV;Sim.flap(w,save);return w.tailV-before;};
 const one=kick(),two=kick(save=>{save.tailSpring={eclipse:{stiff:1,damp:1,kick:2}}});
 assert(Math.abs(two-2*one)<1e-9,`tail kick multiplier: ${two} should be twice ${one}`);
 const force=(setup)=>{const {w,save}=world(setup);w.tailA=.3;w.tailV=0;Sim.updateWorld(w,save,1/60);return w.tailV;};
 const f1=force(),f2=force(save=>{save.tailSpring={eclipse:{stiff:2,damp:1,kick:1}}});
 assert(f1<0&&Math.abs(f2-2*f1)<1e-6,`tail stiffness multiplier: one step gives ${f2} vs ${f1} at 1x`);
 assert.deepEqual(S.tailSpringFor(null,'eclipse'),{stiff:1,damp:1,kick:1},'no dial, no table: 1/1/1');
}
console.log(JSON.stringify({suite:'tap shape + tail spring dials',tapShape:Control.TAP_SHAPE,tailSpringSuits:Control.TAIL_SPRING_SUITS.length,result:'PASS'}));
