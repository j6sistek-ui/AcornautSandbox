#!/usr/bin/env node
/** Helmet-only regression against the pre-fit main-branch renderer.
 * Build first. ACORNAUT_CANVAS=/path/to/@napi-rs/canvas node illustrated-src/test-helmet-animation.mjs
 * Optional ACORNAUT_HELMET_BASE overrides the immutable comparison revision.
 *
 * Private helpers are exported only from disposable module copies. The actual
 * helmet composite is recognized by its source image and omitted from pixels;
 * all body images, halos, transforms, frame choices and animation clocks remain
 * real. This proves motion preservation, not whether a helmet looks well fitted.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
const {createCanvas, loadImage, Image}=require(process.env.ACORNAUT_CANVAS || '@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline=process.env.ACORNAUT_HELMET_BASE || '1fdbd10ef2a4044c6034bf1c7850c6f51ca326a8';
const scratch=mkdtempSync(join(tmpdir(), 'acornaut-helmet-regression-'));
const sources=new WeakMap();
const counts={comparisons:0, pixelComparisons:0, motionFrames:0, tapFrames:0, acceptedTaps:0,
  gameplayFrames:0, previewFrames:0, bodyDraws:0, helmetDraws:0};
const dimensions=384;

function instrument(canvas, output) {
  const ctx=canvas.getContext('2d');
  return new Proxy(ctx, {
    get(target, key) {
      if(key==='drawImage') return (source, ...args)=>{
        const origin=sources.get(source);
        assert(origin, 'every composite must retain a known source image');
        if(!output) sources.set(canvas, {label:`canvas:${origin.label}`, helmet:origin.helmet});
        if(output) {
          const matrix=target.getTransform();
          const command={source:origin.label, args, matrix:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f],
            alpha:target.globalAlpha, composite:target.globalCompositeOperation,
            filter:target.filter, smoothing:target.imageSmoothingEnabled};
          if(origin.helmet) { output.helmet.push(command); return; }
          output.body.push(command);
        }
        return target.drawImage(source,...args);
      };
      const value=Reflect.get(target,key,target);
      return typeof value==='function' ? value.bind(target) : value;
    },
    set(target,key,value) { return Reflect.set(target,key,value,target); },
  });
}

globalThis.Image=Image;
globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false, location:{href:'http://local/',search:''},
  devicePixelRatio:1, addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');
  const canvas=createCanvas(1,1), ctx=instrument(canvas);
  canvas.getContext=()=>ctx;
  return canvas;
}, addEventListener(){}, documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};

function modules(name, old) {
  const directory=join(scratch,name); mkdirSync(directory,{recursive:true});
  writeFileSync(join(directory,'package.json'),'{"type":"module"}');
  if(old) {
    const archive=execFileSync('git',['archive',baseline,'docs/js'],{cwd:root,maxBuffer:32*1024*1024});
    execFileSync('tar',['-x','-C',directory],{input:archive});
  } else cpSync(join(root,'docs/js'),join(directory,'docs/js'),{recursive:true});
  const js=join(directory,'docs/js');
  for(const file of readdirSync(js).filter(name=>name.endsWith('.js'))) {
    const path=join(js,file);
    let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
    if(file==='draw.js') code+='\nexport {paintIllustrated, drawPilot, DOME};\n';
    if(file==='art.js') code+='\nexport {asSprite, RIGGED_SUITS, TAP_BANKS, TAIL_TAP_BANKS, BOUNCE_BANKS, ASC_BANKS, DESC_BANKS};\n';
    writeFileSync(path,code);
  }
  return async file=>import(pathToFileURL(join(js,file+'.js')).href);
}

try {
  const beforeImport=modules('before',true), afterImport=modules('after',false);
  const [Before,After,OldArt,NewArt,OldCat,NewCat,OldSim,NewSim,OldSave,NewSave,OldControl,NewControl]=await Promise.all([
    beforeImport('draw'),afterImport('draw'),beforeImport('art'),afterImport('art'),
    beforeImport('catalog'),afterImport('catalog'),beforeImport('sim'),afterImport('sim'),
    beforeImport('save'),afterImport('save'),beforeImport('control-constants'),afterImport('control-constants')]);
  assert(!NewCat.IS_BETA, 'the main-page roster is the primary test target');
  const suits=NewCat.SUITS.filter(suit=>!NewCat.wearsOwnHead(suit));
  assert.equal(suits.length,16,'all sixteen production suits with wearable helmets are covered');
  assert.deepEqual(suits,OldCat.SUITS.filter(suit=>!OldCat.wearsOwnHead(suit)),'helmet fitting does not change the suit roster');
  for(const name of ['RIGGED_SUITS','TAP_BANKS','TAIL_TAP_BANKS','BOUNCE_BANKS','ASC_BANKS','DESC_BANKS'])
    assert.deepEqual(NewArt[name],OldArt[name],`${name} animation availability is unchanged`);
  const blobs=new Map(execFileSync('git',['ls-tree','-r',baseline,'--','docs/art'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024})
    .trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return [path,meta.split(' ')[2]];}));
  const loaded=new Map();
  async function sprite(path) {
    if(loaded.has(path)) return loaded.get(path);
    const promise=(async()=>{
      const bytes=readFileSync(join(root,'docs/art',path)), full='docs/art/'+path;
      const hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      assert.equal(hash,blobs.get(full),`${path}: body and helmet artwork remains unchanged`);
      const img=await loadImage(bytes);
      // The browser's URL is also the real halo cache's identity key.
      Object.defineProperty(img,'src',{get:()=>path});
      sources.set(img,{label:path,helmet:path.startsWith('helms/')});
      OldArt.asSprite(img);
      const measurement=structuredClone({box:img.box,core:img.core,coreX:img.coreX,coreY:img.coreY});
      NewArt.asSprite(img);
      assert.deepEqual({box:img.box,core:img.core,coreX:img.coreX,coreY:img.coreY},measurement,'sprite measurement is unchanged');
      return img;
    })();
    loaded.set(path,promise);return promise;
  }
  const art=NewArt.emptyArt();
  await Promise.all(['Idle','Flap'].map(async kind=>{
    art['squirrel'+kind]=await Promise.all(Array.from({length:4},(_,i)=>sprite(`squirrel/${kind.toLowerCase()}-${i+1}.png`)));
  }));
  const helmet=NewCat.HELMETS.find(h=>h.id==='clear');
  art.helms.clear=await sprite('helms/clear.png');
  for(const suit of suits) {
    const id=suit.id;
    art.suits[id]=await sprite(`suits/${id}.png`);
    if(NewArt.RIGGED_SUITS.includes(id)) {
      art.suitTail[id]=await sprite(`suits/${id}-tail.png`);
      art.suitBody[id]=await sprite(`suits/${id}-body.png`);
    }
    for(const [property,table,suffix] of [['suitTap','TAP_BANKS','tap'],['suitTapTail','TAIL_TAP_BANKS','tail-tap'],
      ['suitBounce','BOUNCE_BANKS','bounce'],['suitAsc','ASC_BANKS','asc'],['suitDesc','DESC_BANKS','desc']]) {
      if(NewArt[table][id]) art[property][id]=await Promise.all(Array.from({length:NewArt[table][id]},(_,i)=>sprite(`suits/${id}-${suffix}-${i+1}.png`)));
    }
    assert(After.DOME['suit:'+id],`${id}: loading fallback has a helmet anchor`);
    for(const [property,bank] of [['suitAsc','asc'],['suitDesc','desc']])
      for(let i=0;i<(art[property][id]?.length || 0);i++) {
        const key=`${id}-${bank}-${i+1}`;
        assert(After.DOME[key]?.slice(0,3).every(Number.isFinite) && After.DOME[key][2]>0,`${key} has a finite fitted helmet anchor`);
      }
  }
  const canvases=[createCanvas(dimensions,dimensions),createCanvas(dimensions,dimensions)];
  const outputs=[{body:[],helmet:[]},{body:[],helmet:[]}];
  const contexts=canvases.map((canvas,i)=>instrument(canvas,outputs[i]));
  function compare(label,draw,{pixels=true,expectHelmet=true,frame}={}) {
    const poses=[];
    for(let i=0;i<2;i++) {
      canvases[i].getContext('2d').reset();outputs[i].body.length=0;outputs[i].helmet.length=0;
      delete window.__acornautPose;
      draw(i===0?Before:After,contexts[i],i);
      poses.push(window.__acornautPose ? structuredClone(window.__acornautPose) : null);
    }
    assert.deepEqual(outputs[1].body,outputs[0].body,`${label}: body sources, registration, transforms, alpha and halos are unchanged`);
    assert(outputs[1].body.length,`${label}: the body actually rendered`);
    assert.deepEqual(poses[1],poses[0],`${label}: selected motion frame and shaped pose are unchanged`);
    if(frame) {
      assert.equal(poses[1]?.bank,frame.bank,`${label}: requested bank is exercised`);
      assert.equal(poses[1]?.idx,frame.idx,`${label}: requested source frame is exercised`);
    }
    if(expectHelmet) assert.equal(outputs[1].helmet.length,1,`${label}: exactly one equipped helmet is composited`);
    if(pixels) {
      assert.deepEqual(canvases[1].getContext('2d').getImageData(0,0,dimensions,dimensions).data,
        canvases[0].getContext('2d').getImageData(0,0,dimensions,dimensions).data,`${label}: bare-body pixels are identical`);
      counts.pixelComparisons++;
    }
    counts.comparisons++; counts.bodyDraws+=outputs[1].body.length;counts.helmetDraws+=outputs[1].helmet.length;
  }
  const lean=NewControl.SUIT_LEAN_DEFAULT;
  assert.deepEqual(lean,OldControl.SUIT_LEAN_DEFAULT,'default lean unchanged');
  function illustrated(renderer,ctx,suit,bank,{pose=NaN,tap=-1,time=0,size=256,pitch=0,vy=0}={}) {
    ctx.translate(dimensions/2,dimensions/2);ctx.rotate(pitch);
    renderer.paintIllustrated(ctx,art.squirrelIdle[0],0,0,size,helmet,suit,time,bank,'idle-1',
      undefined,undefined,0,'light',.12,tap,-1,0,0,vy,suit.id==='eclipse'?2:0,300,lean,pose);
  }

  for(const suit of suits) {
    const id=suit.id;
    // Exercise every shipped ascent/descent pose including full deep-dive
    // extremes and frame-space boundaries at gameplay and loadout scale.
    for(const [property,bank,sign] of [['suitAsc','asc',-1],['suitDesc','desc',1]]) {
      const n=art[property][id]?.length || 0;
      for(let i=0;i<n;i++) for(const size of [52,256]) {
        const pose=i===0 && sign>0 ? 1e-6 : sign*i/Math.max(1,n-1);
        compare(`${id} ${bank}-${i+1} size ${size}`,(renderer,ctx)=>illustrated(renderer,ctx,suit,art,
          {pose,size,pitch:size===52?-.21:.32}),{frame:{bank,idx:i+1}});
        counts.motionFrames++;
      }
    }
    // Full tap banks are also tested during the real partial-load state:
    // asc/desc not loaded yet, with the intact tail/body rig already present.
    if(art.suitTap[id]?.length===16) {
      const tapOnly={...art,suitAsc:{},suitDesc:{}};
      for(let i=0;i<16;i++) {
        compare(`${id} tap-only frame ${i+1}`,(renderer,ctx)=>illustrated(renderer,ctx,suit,tapOnly,
          {tap:(i+.2)/16*NewCat.TAP_ANIM_DURATION,time:i/60,pitch:.25}));
        counts.tapFrames++;
      }
    }
    const loading={...art,suitTail:{},suitBody:{},suitAsc:{},suitDesc:{},suitTap:{}};
    compare(`${id} static loading fallback`,(renderer,ctx)=>illustrated(renderer,ctx,suit,loading));
    // The actual loadout painter owns its bob, lean, pop, tap timing and
    // bank sweep; compare those transformations over its complete cycles.
    for(let tick=0;tick<96;tick++) {
      const time=tick/15;
      compare(`${id} loadout t=${time}`,(renderer,ctx)=>renderer.paintFlightPreview(ctx,art,suit,helmet,
        dimensions/2,dimensions/2,256,time,lean,tick>=48,.2),{pixels:tick%4===0});
      counts.previewFrames++;
    }
  }

  const nativeRandom=Math.random;
  function makeRun(Sim,Save,id) {
    const save=Save.defaultSave();Object.assign(save,{equippedSuit:id,equippedHelmet:'clear',equippedTrail:'ion',tutorialDone:true,guide:'done'});
    Math.random=()=>.5;
    let world;
    try { world=Sim.makeWorld(390,5000);Sim.resetRun(world,save,'fly',false); }
    finally { Math.random=nativeRandom; }
    world.planets=[];world.pickups=[];world.lastSpawnX=100000;world.warpT=0;
    return {world,save};
  }
  const motionKeys=['time','squirrel','distance','screen','ready','tapAnimT','tapAnimFromRot',
    'tailA','tailV','bounceAnimT','bounceAnimDir','bounceAnimStrength','flapBoost','speed'];
  for(const suit of suits) for(const interval of [.1,.18,.3]) {
    const runs=[makeRun(OldSim,OldSave,suit.id),makeRun(NewSim,NewSave,suit.id)];
    const taps=new Set(Array.from({length:5},(_,i)=>Math.round(i*interval*60)));
    for(let tick=0;tick<120;tick++) {
      for(let i=0;i<2;i++) {
        const Sim=i===0?OldSim:NewSim,run=runs[i];
        if(taps.has(tick)) assert.equal(Sim.flap(run.world,run.save),'flap',`${suit.id}: real ${interval*1000}ms input accepted`);
        if(tick===95) Sim.dive(run.world,run.save);
        Math.random=()=>.5;
        try { Sim.updateWorld(run.world,run.save,1/60); } finally { Math.random=nativeRandom; }
      }
      for(const key of motionKeys) assert.deepEqual(runs[1].world[key],runs[0].world[key],`${suit.id} ${interval}s tick ${tick}: ${key} unchanged`);
      compare(`${suit.id} gameplay ${interval}s tick ${tick}`,(renderer,ctx,i)=>{
        const run=runs[i];
        renderer.drawPilot(ctx,run.world,run.save,art,dimensions/2,1,dimensions/2);
      },{pixels:tick%6===0});
      counts.gameplayFrames++;if(taps.has(tick)) counts.acceptedTaps++;
    }
  }
  console.log(JSON.stringify({passed:true,baseline,build:NewCat.ART_VER,productionWearableSuits:suits.map(s=>s.id),
    sourceImagesUnchanged:loaded.size,...counts,limitation:'Native Canvas regression proves unchanged body animation; helmet fit still requires visual review.'},null,2));
} finally {
  rmSync(scratch,{recursive:true,force:true});
}
