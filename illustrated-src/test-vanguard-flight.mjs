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
const output=process.env.ACORNAUT_QA_OUTPUT||join(tmpdir(),'acornaut-vanguard-flight');mkdirSync(output,{recursive:true});
const pending=[];
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
globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},documentElement:{style:{}}};
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
// A normal 390x760 field, no tracking camera and no position resets. The
// steering bot taps at a lower height, allowing actual short arcs to fall.
const Cat=await import('../docs/js/catalog.js');
const runs=['cinematic','flow'].map(mode=>{
 const sv={...save,vanguardMotionMode:mode};const w=Sim.makeWorld(390,760);
 Sim.resetRun(w,sv,'fly',false);w.planets=[];w.pickups=[];w.lastSpawnX=100000;
 for(let i=0;i<8;i++)w.planets.push({x:350+i*320,gapY:380,gap:420,r:58,topKind:i%33,botKind:(i+4)%33,scored:false,drift:0,driftAmp:0,blockers:[]});
 return {sv,w,c:createCanvas(390,760),headings:[],tail:new Set()};
});
const film=createCanvas(1280,920),g=film.getContext('2d'),frameDir=join(output,'phone-frames');mkdirSync(frameDir,{recursive:true});
const events=[],trace=[];
for(let tick=0;tick<600;tick++){
 const t=tick/60,w0=runs[0].w;
 const tap=tick===0||[60,67,74,81].includes(tick)||(w0.squirrel.y>420&&w0.squirrel.vy>0);
 const swipe=tick===360;
 if(tap||swipe)events.push({tick,event:swipe?'swipe':'tap'});
 for(const r of runs){
  if(tap)Sim.flap(r.w,r.sv);if(swipe)Sim.dive(r.w,r.sv);
  Sim.updateWorld(r.w,r.sv,1/60);
  assert.equal(r.w.screen,'play');assert(r.w.squirrel.y>60&&r.w.squirrel.y<650,'actual phone field stays in frame');
  r.headings.push(r.w.vanguard.heading);r.tail.add(r.w.vanguard.frame);
 }
 for(const key of ['squirrel','run','score','distance'])assert.deepEqual(runs[0].w[key],runs[1].w[key]);
 trace.push({tick,y:w0.squirrel.y,vy:w0.squirrel.vy,tap,swipe,cinematic:runs[0].w.vanguard.heading,continuous:runs[1].w.vanguard.heading});
 if(tick%2)continue;
 g.fillStyle='#071221';g.fillRect(0,0,1280,920);
 g.fillStyle='#f4d49f';g.font='24px sans-serif';g.fillText('VANGUARD · CONTINUOUS TAIL / DIRECTION-DRIVEN BODY',20,35);
 g.fillStyle='#a5b8cb';g.font='15px sans-serif';g.fillText('Actual simulation + painter · 390 × 760 field · normal gravity arcs · no camera follow or position resets',20,63);
 for(let i=0;i<2;i++){
  const r=runs[i],x=i*640;
  g.fillStyle='#fff0d1';g.font='20px sans-serif';g.fillText(i?'CONTINUOUS · 1.15s sweep':'CINEMATIC · 1.8s sweep',x+20,99);
  const wc=r.c.getContext('2d');D.drawWorld(wc,r.w,r.sv,art);g.drawImage(r.c,x+20,118);
  g.save();g.translate(x+535,415);g.scale(3,3);VG.paintVanguard(g,art,0,0,52,r.w.vanguard);g.restore();
  g.fillStyle='#9edfea';g.font='14px sans-serif';
  const direction=r.w.vanguard.heading<-.08?'CLIMB':r.w.vanguard.heading>.08?'DESCENT':'LEVEL';
  g.fillText(direction,x+433,555);g.fillText('Same live pose · 3×',x+433,582);
  g.fillStyle='#a5b8cb';g.fillText(`vy ${Math.round(r.w.squirrel.vy)} · ${Math.round(r.w.vanguard.heading*180/Math.PI)}°`,x+433,610);
  g.fillText(swipe?'SWIPE':tap?'TAP / THRUST':'GRAVITY',x+433,646);
 }
 writeFileSync(join(frameDir,String(tick/2).padStart(4,'0')+'.png'),film.toBuffer('image/png'));
 if(tick===310)writeFileSync(join(output,'phone-preview.png'),film.toBuffer('image/png'));
}
for(const r of runs){assert.equal(r.tail.size,16);assert(Math.max(...r.headings)>.2);assert(Math.min(...r.headings)<-.3);assert(r.w.score>=5);}
writeFileSync(join(output,'phone-trace.json'),JSON.stringify({events,trace},null,2));
console.log('Vanguard phone field: 10 seconds of ordinary climb/fall arcs, burst taps, swipe, all tail poses, score and A/B physics checks passed');
