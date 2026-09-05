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
for(let i=1;i<=32;i++)art.vanguard.push(await sprite(`suits/vanguard/frame-${i}.png`));
art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=art.squirrelIdle;
art.helms.clear=await sprite('helms/clear.png');
for(let i=0;i<33;i++)art.planets.push(await sprite(`planets/${i}.png`));
for(let i=0;i<27;i++)art.debris.push(await sprite(`debris/${i}.png`));
const save=S.defaultSave();Object.assign(save,{equippedSuit:'vanguard',equippedTrail:'ion',tutorialDone:true,guide:'done'});
// Actual world painter must take the custom bank with no generic squash.
const world=Sim.makeWorld(390,760);Sim.resetRun(world,save,'fly',false);world.ready=false;world.shieldCharges=1;
world.tapAnimT=.27;world.bounceAnimT=-1;world.squirrel.vy=-200;world.warpT=0;
const c=createCanvas(390,760),ctx=c.getContext('2d'),drawn=[];const original=ctx.drawImage.bind(ctx);
ctx.drawImage=(im,...args)=>{if(im.sourceFile)drawn.push([im.sourceFile,args]);return original(im,...args);};
D.drawWorld(ctx,world,save,art);await Promise.all(pending);D.drawWorld(ctx,world,save,art);
assert(drawn.some(([file])=>file===`suits/vanguard/frame-${VG.vanguardFrame(.27,-1,-200)+1}.png`));
writeFileSync(join(output,'actual-flight.png'),c.toBuffer('image/png'));
world.bounceAnimT=.15;world.hitCooldown=.54;drawn.length=0;D.drawWorld(ctx,world,save,art);
assert(drawn.some(([file])=>file===`suits/vanguard/frame-${VG.vanguardFrame(.27,.15,-200)+1}.png`));
writeFileSync(join(output,'actual-bounce.png'),c.toBuffer('image/png'));
// Missing or partial banks use exactly the first pose, never shifted indices.
const trace=[];const fake={drawImage:(im,...args)=>trace.push([im,args])};
VG.paintVanguard(fake,{...art,vanguard:art.vanguard.slice(0,3)},0,0,52,.3,-1,600);
assert.equal(trace[0][0],art.suits.vanguard);
// Every bank frame is reachable, and drawing uses one fixed-size canvas.
const poses=new Set();for(let i=0;i<16;i++)poses.add(VG.vanguardFrame((i+.5)/16*.72,-1,-100));
for(let i=0;i<8;i++){poses.add(VG.vanguardFrame(-1,-1,81+i*540/8));poses.add(VG.vanguardFrame(-1,(i+.5)/8*.38,-200));}
assert.equal(poses.size,32);
for(const [file,args] of drawn.filter(([f])=>f.startsWith('suits/vanguard/'))){assert.equal(args[2],512*52/400);assert.equal(args[3],512*52/400);}
// Render a reusable marketing animation using the game's actual preview
// painter, not a second approximation of the character animation.
const bg=await loadImage(join(root,'docs/art/zone-scenes/deep-space.png'));
const film=createCanvas(1280,720),g=film.getContext('2d');
const framesDir=join(output,'frames');mkdirSync(framesDir,{recursive:true});
for(let f=0;f<192;f++){
 const t=f/30;g.clearRect(0,0,1280,720);g.drawImage(bg,0,0,1280,720);
 const shade=g.createLinearGradient(0,0,1280,0);shade.addColorStop(0,'rgba(5,10,24,.96)');shade.addColorStop(1,'rgba(5,10,24,.62)');g.fillStyle=shade;g.fillRect(0,0,1280,720);
 g.fillStyle='#e6c583';g.font='18px "Vanguard Sans"';g.fillText('ACORNAUT · FLAGSHIP SET',72,154);
 g.fillStyle='#fff3da';g.font='64px "Vanguard Sans"';g.fillText('VANGUARD',68,235);
 g.font='24px "Vanguard Sans"';g.fillStyle='#c9d9e7';g.fillText('Earned at 500 Star Chart stars',72,293);
 g.font='19px "Vanguard Sans"';g.fillText('Custom flight · integrated gold helmet',72,357);g.fillText('Exclusive wake · custom shield',72,390);
 g.fillStyle='#89e9ff';g.fillText('Unlocked in beta for testing',72,456);
 g.fillStyle='#96a4b9';g.font='14px "Vanguard Sans"';g.fillText('Animation preview · ship comes later',72,620);
 g.save();g.translate(758,388);g.scale(4,4);VG.paintVanguardWake(g,-28,0,t);g.restore();
 D.paintFlightPreview(g,art,{id:'vanguard'}, {id:'clear'},940,397,370,t);
 if(t%3.2>=2.4){g.save();g.translate(940,397);g.scale(5.5,5.5);VG.paintVanguardShield(g,0,0,t);g.restore();}
 writeFileSync(join(framesDir,String(f).padStart(4,'0')+'.png'),film.toBuffer('image/png'));
 if(f===9)writeFileSync(join(output,'vanguard-preview.png'),film.toBuffer('image/png'));
}
console.log('Vanguard render: actual world tap/contact, all 32 poses, fixed registration, partial-load fallback, marketing frames passed');
