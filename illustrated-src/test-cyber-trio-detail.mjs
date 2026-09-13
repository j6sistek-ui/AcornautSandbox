// Exercise the shipping loaders and painters after export-sandbox/build-flight-studio.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'outputs/cyber-standard-trio/detail-tests');mkdirSync(out,{recursive:true});
const scratch=mkdtempSync(join(out,'run-'));
cpSync(process.env.ACORNAUT_DETAIL_JS||join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const file of readdirSync(join(scratch,'js')).filter(name=>name.endsWith('.js'))){
  const path=join(scratch,'js',file);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
  if(file==='art.js')code+='\nexport {asSprite};\n';
  if(file==='draw.js')code+='\nexport {drawPilot};\n';
  writeFileSync(path,code);
}
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
let clock=0;Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
const mod=name=>import(pathToFileURL(join(scratch,'js',name+'.js')).href);
const [A,D,C,Sim,S,Detail]=await Promise.all(['art','draw','catalog','sim','save','sprite-detail'].map(mod));
const requests=[];
class DeferredImage{
  set src(value){this._src=value;requests.push(this);}
  get src(){return this._src;}
  ok(size=256){this.width=this.height=this.naturalWidth=this.naturalHeight=size;this.onload?.();}
  fail(){this.onerror?.(new Error('intentional missing optional file'));}
}
globalThis.Image=DeferredImage;
// Measurement fixture belongs only to the fake network images. All painter
// assertions below use real PNGs and a real canvas transform.
document.createElement=()=>{
  const canvas={width:1,height:1};
  canvas.getContext=()=>({drawImage(){},getImageData(){
    const data=new Uint8ClampedArray(canvas.width*canvas.height*4);
    for(let y=32;y<canvas.height-32;y++)for(let x=32;x<canvas.width-32;x++)data[(y*canvas.width+x)*4+3]=255;
    return {data};
  }});return canvas;
};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function requested(count){for(let i=0;i<20&&requests.length<count;i++)await tick();assert.equal(requests.length,count);}
const loadedBanks={};
for(const id of ['porcelain','nacre','origamist']){
  const art=A.emptyArt(),start=requests.length,promise=A.loadSuitBank(art,id);
  await requested(start+2);requests.slice(start).forEach(image=>image.ok());
  await requested(start+20);requests.slice(start+2).forEach(image=>image.ok());await promise;
  assert.equal(art.suitAsc[id].length,9);assert.equal(art.suitDesc[id].length,9);
  assert(requests.slice(start).every(image=>!image.src.includes('/hd/')),'normal bank readiness never requests optional detail');
  assert([...art.suitAsc[id],...art.suitDesc[id],art.suitBody[id],art.suitTail[id]].every(image=>typeof image.requestDetail==='function'));
  loadedBanks[id]=art;
}
const bank=loadedBanks.nacre,frames=[...bank.suitAsc.nacre,...bank.suitDesc.nacre];
const geometry=frames.map(({width,height,box,core,coreX,coreY})=>({width,height,box,core,coreX,coreY}));
const start=requests.length;
const first=frames[0].requestDetail();assert.equal(frames[17].requestDetail(),first,'one shared in-flight promise');
await requested(start+18);
requests.slice(start,start+17).forEach(image=>image.ok(512));await tick();
assert(frames.every(image=>!image.detailImage),'17 of 18 never publishes a mixed-resolution bank');
requests[start+17].fail();await first;
assert(frames.every(image=>!image.detailImage),'failed optional frame retains the complete SD bank');
await Promise.all(frames.map(image=>image.requestDetail()));assert.equal(requests.length,start+18,'failure does not retry every animation tick');
clock+=30_001;const invalid=frames[8].requestDetail();await requested(start+36);
requests.slice(start+18).forEach((image,i)=>image.ok(i===7?256:512));await invalid;
assert(frames.every(image=>!image.detailImage),'wrong-sized optional source rejects the complete tier');
clock+=30_001;const retry=frames[17].requestDetail();await requested(start+54);
requests.slice(start+36).forEach(image=>image.ok(512));await retry;
assert(frames.every(image=>image.detailImage?.width===512));
await frames[0].requestDetail();assert.equal(requests.length,start+54,'successful tier loads once');
assert.deepEqual(frames.map(({width,height,box,core,coreX,coreY})=>({width,height,box,core,coreX,coreY})),geometry,'HD never remeasures collision/core or mutates logical geometry');
assert.equal(bank.suitAsc.nacre[0],frames[0]);assert.equal(bank.suitDesc.nacre[8],frames[17]);
assert(requests.slice(start).every(image=>/\/suits\/hd\/nacre-(asc|desc)-[1-9]\.png\?v=\d+$/.test(image.src)),'detail uses versioned art-base paths');
const pairStart=requests.length,pair=bank.suitTail.nacre.requestDetail();await requested(pairStart+2);
requests[pairStart].ok(512);await tick();assert(!bank.suitTail.nacre.detailImage&&!bank.suitBody.nacre.detailImage);
requests[pairStart+1].ok(512);await pair;
assert(bank.suitTail.nacre.detailImage&&bank.suitBody.nacre.detailImage,'hover split layers publish together');
const still=new DeferredImage();still._src='/art/suits/nacre.png';still.width=still.height=256;
A.asSprite(still);const stillStart=requests.length,stillReady=still.requestDetail();await requested(stillStart+1);
assert.match(requests[stillStart].src,/\/suits\/hd\/nacre\.png\?v=\d+$/);requests[stillStart].ok(512);await stillReady;
assert.equal(still.detailImage.width,512,'normal named portrait has its own one-file lazy tier');

globalThis.Image=Image;document.createElement=()=>createCanvas(1,1);
const labels=new WeakMap(),details=[];
async function sprite(path){
  const image=await loadImage(join(root,'docs/art',path));Object.defineProperty(image,'src',{get:()=>'/art/'+path});
  A.asSprite(image);labels.set(image,path);
  const hd=await loadImage(join(root,'docs/art',path.replace('suits/','suits/hd/')));
  labels.set(hd,path);details.push([image,hd]);return image;
}
const art=A.emptyArt();
for(const id of ['porcelain','nacre','origamist']){
  art.suits[id]=await sprite(`suits/${id}.png`);
  art.suitAsc[id]=await Promise.all(Array.from({length:9},(_,i)=>sprite(`suits/${id}-asc-${i+1}.png`)));
  art.suitDesc[id]=await Promise.all(Array.from({length:9},(_,i)=>sprite(`suits/${id}-desc-${i+1}.png`)));
  art.suitBody[id]=await sprite(`suits/${id}-body.png`);art.suitTail[id]=await sprite(`suits/${id}-tail.png`);
}
art.ready=true;
function tier(enabled){for(const [image,hd] of details){image.detailImage=enabled?hd:undefined;image.requestDetail=undefined;}}
function capture(draw,dpr=2){
  const ctx=createCanvas(800,800).getContext('2d'),calls=[];ctx.scale(dpr,dpr);
  const raw=ctx.drawImage.bind(ctx);ctx.drawImage=(image,...args)=>{
    if(labels.has(image))calls.push({file:labels.get(image),source:image.width,args,transform:Array.from(['a','b','c','d','e','f'],key=>ctx.getTransform()[key])});
    return raw(image,...args);
  };draw(ctx);return calls;
}
function samePlacement(sd,hd,label){
  assert(sd.length&&sd.length===hd.length,label+' same layer count');
  for(let i=0;i<sd.length;i++){
    assert.equal(sd[i].file,hd[i].file,label+' same painting');assert.deepEqual(sd[i].transform,hd[i].transform,label+' same rotation/pivot');
    assert.equal(sd[i].source,256);assert.equal(hd[i].source,512,label+' uses real detail at DPR2');
    const args=[...hd[i].args];if(args.length===8)for(let j=0;j<4;j++)args[j]/=2;
    assert.deepEqual(sd[i].args,args,label+' unchanged logical destination and correctly doubled source crop');
  }
}
for(const id of ['porcelain','nacre','origamist']){
  const suit=C.SUITS.find(s=>s.id===id),helmet=C.HELMETS.find(h=>h.id==='clear');
  for(const [label,paint] of [
    ['portrait',ctx=>D.paintPortrait(ctx,art,helmet,suit,200,200,158)],
    ['flight',ctx=>D.paintFlightPreview(ctx,art,suit,helmet,200,200,158,.45)],
    ['hinged fallback',ctx=>D.paintFlightPreview(ctx,{...art,suitAsc:{},suitDesc:{}},suit,helmet,200,200,158,.45)],
    ['core crop',ctx=>{ctx.rotate(.3);A.drawSprite(ctx,art.suits[id],180,180,158,'core');}],
  ]){
    tier(false);const sd=capture(paint);tier(true);samePlacement(sd,capture(paint),id+' '+label);
  }
  const save=S.defaultSave();save.equippedSuit=id;const world=Sim.makeWorld(390,10000);Sim.resetRun(world,save,'fly',false);
  world.screen='play';world.ready=false;world.warpT=0;Sim.flap(world,save);Sim.updateWorld(world,save,1/60);
  const motion=()=>[world.squirrel.y,world.squirrel.vy,world.tailA,world.tailV,world.tapAnimT,world.tapDir,world.highOrbit.frames];
  const before=motion(),paint=ctx=>D.drawPilot(ctx,world,save,art,200,1,200);
  tier(false);const sd=capture(paint,5);tier(true);samePlacement(sd,capture(paint,5),id+' dense live pilot');
  assert.deepEqual(motion(),before,'source sampling does not advance or edit controller state');
  const low=capture(paint,1);assert(low.every(call=>call.source===256),'normal 52px gameplay keeps native SD source');
}
// Demand threshold includes canvas density, rotation and independent axis scale.
let demanded=0;const probe={width:256,height:256,requestDetail:()=>{demanded++;return Promise.resolve();}};
const ctx=createCanvas(1,1).getContext('2d');ctx.scale(2,2);ctx.rotate(.8);
assert.equal(Detail.spriteImageFor(ctx,probe,128,128),probe);assert.equal(demanded,0,'exact native density does not download');
Detail.spriteImageFor(ctx,probe,129,129);assert.equal(demanded,1,'rotated DPR2 enlargement requests detail');
ctx.resetTransform();ctx.scale(.5,3);Detail.spriteImageFor(ctx,probe,100,100);assert.equal(demanded,2,'tall physical axis requires detail');

const {StudioRenderer}=await import('../tools/flight-studio/renderer.mjs');
const {makeProject,createSimulation,seekSimulation}=await import('../tools/flight-studio/core.mjs');
const manifest=JSON.parse(readFileSync(join(root,'tools/flight-studio/manifest.json'),'utf8'));
const studioImages=[];
const studio=new StudioRenderer(manifest,()=>{const image=new DeferredImage();studioImages.push(image);return image;});
const model=manifest.models.find(m=>m.id==='nacre'),loading=studio.loadModel(model,'clear');
assert.equal(studioImages.length,19);assert(studioImages.every(image=>!image.src.includes('/hd/')));
studioImages.forEach(image=>image.ok());await loading;
const s0=studio.image(model.banks.asc[0]);const optional=s0.requestDetail();assert.equal(studioImages.length,37);
studioImages.slice(19,36).forEach(image=>image.ok(512));await tick();assert(!s0.detailImage);
studioImages[36].ok(511);await optional;
assert(!s0.detailImage,'Studio also retains the whole SD bank after invalid detail');
assert(!studio.images.has(model.banks.desc[8].replace('suits/','suits/hd/')),'invalid decoded detail must leave the Studio cache');
await s0.requestDetail();assert.equal(studioImages.length,37,'Studio honors the shared retry cooldown');
clock+=30_001;const studioRetry=s0.requestDetail();assert.equal(studioImages.length,38,'Studio reloads the rejected file rather than reusing it forever');
studioImages[37].ok(512);await studioRetry;
assert(Object.values(model.banks).flat().every(path=>studio.image(path).detailImage?.width===512));
const realStudio=new StudioRenderer(manifest);for(const [image,hd] of details){realStudio.images.set(labels.get(image),image);image.detailImage=hd;}
const project=makeProject(manifest,model),simulation=createSimulation(model,project);project.view.effects=false;project.view.guides=false;seekSimulation(simulation,.45);
const studioPaint=ctx=>realStudio.paint(ctx,model,project,simulation,200,200,158),state=JSON.stringify(simulation);
tier(false);const sd=capture(studioPaint);tier(true);samePlacement(sd,capture(studioPaint),'Studio');assert.equal(JSON.stringify(simulation),state);
writeFileSync(join(scratch,'receipt.json'),JSON.stringify({normalRequests:60,bankDetailPerAttempt:18,attempts:3,splitDetailRequests:2,stillDetailRequests:1,studioNormalRequests:19,studioDetailRequests:19,studioInvalidDetailReloaded:true,allPaintersPreserveDestination:true},null,2));
console.log('Cyber trio optional detail: lazy 1/2/18 groups, failure/dimension/retry, geometry, portrait/live/preview/Studio sampling PASS');
