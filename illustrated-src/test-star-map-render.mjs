#!/usr/bin/env node
// Production canvas functions with real art. No simulated browser screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.ACORNAUT_QA_OUTPUT||join(tmpdir(),'acornaut-star-map-render');mkdirSync(output,{recursive:true});
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
const reviewOrders=process.env.ACORNAUT_ZONE_REVIEW?.split(',').map(Number)??[1,101,241];
const reviewEnvs=reviewOrders.map(ord=>C.ALL_LEVELS[ord-1].fx.env);
async function sprite(path){
  const image=await loadImage(join(root,`docs/art/${path}.png`)),c=createCanvas(image.width,image.height),g=c.getContext('2d');g.drawImage(image,0,0);
  const data=g.getImageData(0,0,image.width,image.height).data;let x=image.width,y=image.height,r=0,b=0;
  for(let j=0;j<image.height;j++)for(let i=0;i<image.width;i++)if(data[(j*image.width+i)*4+3]>12){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}
  image.box={x,y,w:r-x+1,h:b-y+1};image.core=Math.max(image.box.w,image.box.h);image.coreX=x+image.box.w/2;image.coreY=y+image.box.h/2;return image;
}
const art=A.emptyArt();art.ready=true;
for(let i=0;i<33;i++)art.planets.push(await sprite(`planets/${i}`));
for(let i=0;i<27;i++)art.debris.push(await sprite(`debris/${i}`));
art.squirrelIdle=[await sprite('squirrel/idle-1')];art.squirrelFlap=art.squirrelIdle;
art.suits.flight=await sprite('suits/flight');art.helms.clear=await sprite('helms/clear');art.acorn=[await sprite('acorn/1')];art.golden=[await sprite('golden/1')];
for(const id of A.SPILL_SHIP_IDS)art.spillShip[id]=await sprite(`spill-ship/${id}`);
art.spillShipFit=JSON.parse(readFileSync(join(root,'docs/art/spill-ship/transforms.json')));
for(const env of reviewEnvs)V.zonePainting(env);
await Promise.all(pending);
for(const env of reviewEnvs)assert(V.zonePainting(env),'painted zone must load');
const save=S.defaultSave();save.tutorialDone=true;save.guide='done';
const sheet=createCanvas(reviewOrders.length*390,810),g=sheet.getContext('2d');
for(const [i,ord] of reviewOrders.entries()){
  const def=C.ALL_LEVELS[ord-1],w=Sim.makeWorld(390,760),c=createCanvas(390,760),ctx=c.getContext('2d');
  Sim.resetRun(w,save,def.base,false,def);w.ready=false;
  for(let f=0;f<45;f++){if(w.squirrel.y>w.H*.45&&w.squirrel.vy>0)Sim.flap(w,save);Sim.updateWorld(w,save,1/60);}
  const drawn=[];const original=ctx.drawImage.bind(ctx);
  ctx.drawImage=(image,...args)=>{if(image.sourceFile)drawn.push(image.sourceFile);return original(image,...args);};
  D.drawWorld(ctx,w,save,art);await Promise.all(pending);
  D.drawWorld(ctx,w,save,art);D.drawHud(ctx,w,art);
  assert(drawn.some(path=>path.includes(`zone-scenes/${def.zoneId}.png`)), `Missing remaster in actual painter: ${JSON.stringify(drawn)}`);
  g.drawImage(c,i*390,40);g.fillStyle='#090e1b';g.fillRect(i*390,0,390,40);g.fillStyle='#e9d2a4';g.font='17px sans-serif';g.fillText(`${def.zoneId} · level ${ord}`,i*390+16,27);
  writeFileSync(join(output,`${def.zoneId}-flight.png`),c.toBuffer('image/png'));
}
writeFileSync(join(output,'star-map-flight-sample.png'),sheet.toBuffer('image/png'));
// Cover-crop and readability review at narrow-phone and landscape widths.
for(const [W,H] of [[320,760],[1280,720]])for(const ord of reviewOrders){
  const def=C.ALL_LEVELS[ord-1],w=Sim.makeWorld(W,H),c=createCanvas(W,H),ctx=c.getContext('2d');
  Sim.resetRun(w,save,def.base,false,def);w.ready=false;
  for(let f=0;f<45;f++){if(w.squirrel.y>w.H*.45&&w.squirrel.vy>0)Sim.flap(w,save);Sim.updateWorld(w,save,1/60);}
  let painted=false;const original=ctx.drawImage.bind(ctx);
  ctx.drawImage=(image,...args)=>{painted ||= !!image.sourceFile?.includes(`zone-scenes/${def.zoneId}.png`);return original(image,...args);};
  D.drawWorld(ctx,w,save,art);D.drawHud(ctx,w,art);assert(painted);
  writeFileSync(join(output,`${def.zoneId}-flight-${W}.png`),c.toBuffer('image/png'));
}
const looks=createCanvas(1000,560),lg=looks.getContext('2d');lg.fillStyle='#0b1323';lg.fillRect(0,0,1000,560);
let configurations=0;
for(const finish of ['stock','rust-runner']){
  save.spillAppearance={finish,trail:finish==='stock'?'stock':'rust-wake'};
  for(let p=0;p<4;p++)for(let t=0;t<4;t++)for(let u=0;u<4;u++)for(let shield=0;shield<3;shield++){
    const c=createCanvas(256,160);D.paintShipPreview(c.getContext('2d'),art,save,120,70,2.8,0,{plating:p,thrusters:t,pulse:u,shield});configurations++;
  }
  for(let tier=0;tier<4;tier++){
    const x=finish==='stock'?250:750,y=85+tier*130;
    D.paintShipPreview(lg,art,save,x,y,4,0,{plating:tier,thrusters:tier,pulse:tier,shield:Math.min(tier,2)});
    lg.fillStyle='#e9d2a4';lg.font='15px sans-serif';lg.fillText(`${finish} · tier ${tier}`,x-100,y+59);
  }
}
writeFileSync(join(output,'spill-rust-sample.png'),looks.toBuffer('image/png'));
assert.equal(configurations,384);
console.log(JSON.stringify({paintedZones:reviewOrders.length,flightFrames:reviewOrders.length*3,shipConfigurations:configurations,output}));
