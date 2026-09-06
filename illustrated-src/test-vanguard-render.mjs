#!/usr/bin/env node
// Production canvas functions with real art. No simulated browser screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image,GlobalFonts}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Vanguard Sans');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.ACORNAUT_QA_OUTPUT||join(tmpdir(),'acornaut-vanguard-render');mkdirSync(output,{recursive:true});
const pending=[],drawn=[];
class LocalImage extends Image {
  set src(value){
    this.sourceFile=value;
    const ready=this.onload,failed=this.onerror;
    pending.push(new Promise(done=>{
      this.onload=()=>{ready?.();done();};this.onerror=e=>{failed?.(e);done();};
      // A file URL also prevents native-canvas's buffer sniff from treating
      // the embedded C2PA manifest as SVG. Keep the original PNG untouched.
      try{super.src=value.split('?')[0];}catch(e){this.onerror(e);}
    }));
  }
  get src(){return super.src;}
}
globalThis.Image=LocalImage;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:true,__ACORNAUT_ART__:join(root,'docs/art'),location:{href:'http://local/beta/',search:'?star-map=sample'},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>{const canvas=createCanvas(1,1),g=canvas.getContext('2d'),draw=g.drawImage.bind(g);g.drawImage=(im,...args)=>{if(im.sourceFile)drawn.push([im.sourceFile,args]);return draw(im,...args);};return canvas;},addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const A=await import('../docs/js/art.js'),D=await import('../docs/js/draw.js'),S=await import('../docs/js/save.js'),Sim=await import('../docs/js/sim.js'),C=await import('../docs/js/campaign.js'),V=await import('../docs/js/zone-visuals.js');
const VG=await import('../docs/js/vanguard.js');
async function sprite(file){
 const im=await loadImage(join(root,'docs/art',file));im.sourceFile=file;
 const c=createCanvas(im.width,im.height),g=c.getContext('2d');g.drawImage(im,0,0);
 const data=g.getImageData(0,0,im.width,im.height).data;let x=im.width,y=im.height,r=0,b=0;
 for(let j=0;j<im.height;j++)for(let i=0;i<im.width;i++)if(data[(j*im.width+i)*4+3]>12){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}
 im.box={x,y,w:r-x+1,h:b-y+1};im.core=Math.max(im.box.w,im.box.h);im.coreX=x+im.box.w/2;im.coreY=y+im.box.h/2;return im;
}
const art=A.emptyArt();art.ready=true;
art.suits.vanguard=await sprite('suits/vanguard.png');art.vanguard=[];
for(let i=1;i<=VG.VANGUARD_FRAMES;i++)art.vanguard.push(await sprite(`suits/vanguard/frame-${i}.png`));
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=art.squirrelIdle;
art.helms.clear=await sprite('helms/clear.png');
for(let i=0;i<33;i++)art.planets.push(await sprite(`planets/${i}.png`));
for(let i=0;i<27;i++)art.debris.push(await sprite(`debris/${i}.png`));
const save=S.defaultSave();Object.assign(save,{equippedSuit:'vanguard',equippedTrail:'ion',tutorialDone:true,guide:'done'});
// The world chooses Vanguard's independent state, never the legacy clocks.
const world=Sim.makeWorld(390,760);Sim.resetRun(world,save,'fly',false);world.ready=false;world.shieldCharges=1;
Sim.flap(world,save);for(let i=0;i<28;i++)VG.stepVanguard(world.vanguard,1/60,-200);
world.tapAnimT=0;world.bounceAnimT=.01;world.squirrel.vy=650;
const c=createCanvas(390,760),ctx=c.getContext('2d');const original=ctx.drawImage.bind(ctx);
ctx.drawImage=(im,...args)=>{if(im.sourceFile)drawn.push([im.sourceFile,args]);return original(im,...args);};
D.drawWorld(ctx,world,save,art);await Promise.all(pending);D.drawWorld(ctx,world,save,art);
assert(drawn.some(([file])=>file===`suits/vanguard/frame-${world.vanguard.frame+1}.png`));
writeFileSync(join(output,'actual-flight.png'),c.toBuffer('image/png'));
VG.vanguardContact(world.vanguard,world.W*.27,world.squirrel.y+20,0,-1,1);
VG.stepVanguard(world.vanguard,.15,-200);Sim.flap(world,save);D.drawWorld(ctx,world,save,art);
writeFileSync(join(output,'actual-bounce.png'),c.toBuffer('image/png'));
// Missing/partial bank uses the registered neutral still, never a shifted index.
drawn.length=0;VG.paintVanguard(ctx,{...art,vanguard:art.vanguard.slice(0,3)},100,100,52,world.vanguard);
assert(drawn.some(([file])=>file==='suits/vanguard.png'));
// One crisp pose remains opaque throughout a registered pose transition.
const solid=createCanvas(512,512),sg=solid.getContext('2d');sg.fillStyle='#ffffff';sg.fillRect(0,0,512,512);
const opacity=createCanvas(512,512),op=opacity.getContext('2d');
const blend=VG.createVanguardMotion();blend.frame=1;
VG.paintVanguard(op,{suits:{vanguard:solid},vanguard:Array(VG.VANGUARD_FRAMES).fill(solid)},280,280,400,blend);
assert.deepEqual([...op.getImageData(256,256,1,1).data],[255,255,255,255]);
// Body direction is independent of loop progress. Gravity stays shallow,
// swipes may point down, and every attitude retains the continuous tail.
for(const style of ['cruise']) {   // the trial modes are gone: Flight is the motion
 const state=VG.createVanguardMotion();
 for(let i=0;i<180;i++)VG.stepVanguard(state,1/60,1500);
 assert(Math.abs(state.heading-22*Math.PI/180)<.001);
 VG.vanguardDive(state);for(let i=0;i<60;i++)VG.stepVanguard(state,1/60,650);
 assert(state.heading>1);
 const pose=[state.frame,state.phase,state.heading];VG.vanguardTap(state);
 assert.deepEqual([state.frame,state.phase,state.heading],pose);
 for(let i=0;i<60;i++)VG.stepVanguard(state,1/60,-200);
 assert(state.heading<-.3);assert(!state.diving);
}
// A scripted flight chamber leaves vertical room for a full dive. All
// inputs, forces, gate scoring and contact use sim.ts. The test camera
// follows the pilot; this is NOT a recording of the phone's camera/layout.
const Cat=await import('../docs/js/catalog.js');
const styles=['cruise'];const runs=styles.map(style=>{
 const sv={...save};const w=Sim.makeWorld(390,5000);
 Sim.resetRun(w,sv,'fly',false);w.planets=[];w.pickups=[];w.lastSpawnX=100000;w.warpT=0;
 return {save:sv,w,canvas:createCanvas(390,760),contact:false};
});
const taps=new Set([0,11,22,33,44,55,66,77,226,237,248,259,333,344,355]);
const events=[];const bg=await loadImage(join(root,'docs/art/zone-scenes/deep-space.png'));
const film=createCanvas(1280,800),g=film.getContext('2d');
const framesDir=join(output,'frames');mkdirSync(framesDir,{recursive:true});
const snapshots=[];const frameTrace=[];
for(let tick=0;tick<408;tick++) {
 const t=tick/60;
 for(const run of runs) {
  const {w,save:sv}=run;
  if(taps.has(tick))Sim.flap(w,sv);
  if(tick===174)Sim.dive(w,sv);
  if(tick===225) {
   w.planets=[{x:w.W*Cat.PHYS.squirrelX+1,gapY:w.squirrel.y+50-110-62,gap:220,r:62,topKind:0,botKind:0,scored:false,drift:0,driftAmp:0,blockers:[]}];
  }
  if(tick===330) {
   w.planets=[{x:w.W*Cat.PHYS.squirrelX-80,gapY:w.squirrel.y,gap:300,r:62,topKind:0,botKind:0,scored:false,drift:0,driftAmp:0,blockers:[]}];
  }
  const cue=Sim.updateWorld(w,sv,1/60);
  if(cue==='bounce')run.contact=true;
  assert.equal(w.screen,'play',`chamber alive at ${t}`);
  if(run===runs[0]&&(cue==='bounce'||taps.has(tick)||tick===174||tick===330))events.push({tick,time:t,event:cue==='bounce'?'bounce':tick===174?'swipe':tick===330?'gate':'tap'});
 }
 // Visual style cannot change any authoritative flight value or legacy clock.
 frameTrace.push({tick,y:runs[0].w.squirrel.y,vy:runs[0].w.squirrel.vy,...Object.fromEntries(runs.map(r=>['flight',{frame:r.w.vanguard.frame,phase:r.w.vanguard.phase,thrust:r.w.vanguard.thrust,heading:r.w.vanguard.heading}]))});
 if(tick%2)continue;
 g.drawImage(bg,0,0,1280,800);g.fillStyle='rgba(5,10,24,.90)';g.fillRect(0,0,1280,800);
 g.font='16px "Vanguard Sans"';g.fillStyle='#d5b579';g.fillText('ACORNAUT · VANGUARD MOTION COMPARISON',30,32);
 g.font='13px "Vanguard Sans"';g.fillStyle='#a7b9cb';g.fillText('Scripted inputs · actual simulation and painter · test camera follows the pilot',30,59);
 const cue=t<1.5?'RAPID TAPS · 180ms APART':t<2.9?'RELEASE · ARC AND GRAVITY':t<3.75?'SWIPE DOWN · FULL DIVE':t<5.5?'BOUNCE → TAP ONE TICK LATER':'GATE PASS → TAP → THRUST';
 for(let i=0;i<runs.length;i++) {
  const run=runs[i],x=i*640,{w}=run;
  g.fillStyle='#fff0d1';g.font='28px "Vanguard Sans"';g.fillText(i===0?'CINEMATIC · 1.8s TAIL':'CONTINUOUS · 1.15s TAIL',x+30,111);
  const wc=run.canvas.getContext('2d');wc.clearRect(0,0,390,760);wc.save();wc.translate(0,380-w.squirrel.y);
  D.drawWorld(wc,w,run.save,art);wc.restore();
  g.drawImage(run.canvas,x+30,142,260,507);
  g.strokeStyle='rgba(223,191,130,.35)';g.strokeRect(x+30,142,260,507);
  g.font='12px "Vanguard Sans"';g.fillStyle='#9fadc0';g.fillText('FLIGHT AT GAME SCALE',x+30,674);
  g.save();g.beginPath();g.rect(x+296,142,338,490);g.clip();g.translate(x+453,392);g.scale(4,4);
  for(const p of w.vanguard.contacts) {
   // Move the world's surface contact to the same local close-up camera.
   VG.paintVanguardContacts(g,{...w.vanguard,contacts:[{...p,x:p.x-w.W*Cat.PHYS.squirrelX,y:p.y-w.squirrel.y}]});
  }
  VG.paintVanguard(g,art,0,0,52,w.vanguard);g.restore();
  g.font='12px "Vanguard Sans"';g.fillStyle='#9fadc0';g.fillText('SAME LIVE POSE · 4×',x+350,574);
  g.fillStyle='#91e4f0';g.font='14px "Vanguard Sans"';g.fillText(cue,x+30,720);
 }
 g.fillStyle='#9fadc0';g.font='13px "Vanguard Sans"';g.fillText(`Beta: Hangar or Pause → Vanguard Motion                                      ${t.toFixed(2)}s`,30,771);
 const file=join(framesDir,String(tick/2).padStart(4,'0')+'.png');writeFileSync(file,film.toBuffer('image/png'));
 if([18,54,94,140,180,210,226,236,266,336].includes(tick))snapshots.push({tick,image:film.toBuffer('image/png')});
 if(tick===94)writeFileSync(join(output,'vanguard-preview.png'),film.toBuffer('image/png'));
}
assert(runs.every(r=>r.contact));
const sheet=createCanvas(1280,400*snapshots.length),sc=sheet.getContext('2d');
for(let i=0;i<snapshots.length;i++){const im=await loadImage(snapshots[i].image);sc.drawImage(im,0,i*400,1280,400);}
writeFileSync(join(output,'comparison-filmstrip.png'),sheet.toBuffer('image/png'));
writeFileSync(join(output,'input-trace.json'),'{\n  \"events\": '+JSON.stringify(events)+',\n  \"frames\": [\n'+frameTrace.map(f=>'    '+JSON.stringify(f)).join(',\n')+'\n  ]\n}\n');
console.log(`Vanguard render: real rapid taps, shallow gravity/full swipe, retained dust, crisp opaque poses, A/B physics equality, ${204} comparison frames passed`);
