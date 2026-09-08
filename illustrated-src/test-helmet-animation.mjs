#!/usr/bin/env node
/** Helmet glass/fitting regression against the pre-repair main renderer.
 * Build first. ACORNAUT_CANVAS=/path/to/@napi-rs/canvas node illustrated-src/test-helmet-animation.mjs
 * Optional ACORNAUT_HELMET_BASE overrides the immutable comparison revision;
 * ACORNAUT_HELMET_SHIPPED overrides the revision that pins artwork the
 * comparison revision never held (the HIGH ORBIT ascent/descent sheets).
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
const baseline=process.env.ACORNAUT_HELMET_BASE || '5acb81cc030480d87dc59ad59758b3c35168ae8a';
const scratch=mkdtempSync(join(tmpdir(), 'acornaut-helmet-regression-'));
const sources=new WeakMap();
const counts={comparisons:0, soloFrames:0, pixelComparisons:0, motionFrames:0, tapFrames:0, acceptedTaps:0,
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
  // HIGH ORBIT (84b8497, owner 7 Sep 2026): five suits that were beta-gated at
  // the baseline revision went live as star rewards above 300. They are the
  // ONLY roster change since; every other suit must still match the baseline
  // object for object, and no suit may quietly lose its wearable head.
  const HIGH_ORBIT=['cinderforge','groveguard','cosmic','sunforged','abyssal'];
  const suits=NewCat.SUITS.filter(suit=>!NewCat.wearsOwnHead(suit));
  assert.equal(suits.length,21,'all twenty-one production suits with wearable helmets are covered');
  const promoted=suits.filter(suit=>HIGH_ORBIT.includes(suit.id));
  // e8bf123 replaced these five suits' flights outright and gave them brand new
  // dome anchors, so there is no pre-repair rendering of them to diff against:
  // the old-vs-new comparisons below run over `legacy`, and `promoted` flies its
  // own single-renderer pass so the five are still flown, not merely loaded.
  const legacy=suits.filter(suit=>!HIGH_ORBIT.includes(suit.id));
  assert.deepEqual(legacy,OldCat.SUITS.filter(suit=>!OldCat.wearsOwnHead(suit)),'helmet fitting does not change the pre-existing suit roster');
  assert.deepEqual(promoted.map(suit=>suit.id),HIGH_ORBIT,'HIGH ORBIT promotions are the only roster additions');
  const withoutHighOrbit=table=>Array.isArray(table) ? table.filter(id=>!HIGH_ORBIT.includes(id))
    : Object.fromEntries(Object.entries(table).filter(([id])=>!HIGH_ORBIT.includes(id)));
  for(const name of ['RIGGED_SUITS','TAP_BANKS','TAIL_TAP_BANKS','BOUNCE_BANKS','ASC_BANKS','DESC_BANKS'])
    assert.deepEqual(withoutHighOrbit(NewArt[name]),OldArt[name],`${name} animation availability is unchanged`);
  for(const id of HIGH_ORBIT) {
    assert.equal(NewArt.ASC_BANKS[id],8,`${id}: HIGH ORBIT ascent bank is the shipped 8/8 sheet`);
    assert.equal(NewArt.DESC_BANKS[id],8,`${id}: HIGH ORBIT descent bank is the shipped 8/8 sheet`);
    for(const name of ['RIGGED_SUITS','TAP_BANKS','TAIL_TAP_BANKS','BOUNCE_BANKS'])
      assert(!(Array.isArray(NewArt[name]) ? NewArt[name].includes(id) : id in NewArt[name]),
        `${id}: the obsolete ${name} rig stays retired`);
  }
  const tree=rev=>new Map(execFileSync('git',['ls-tree','-r',rev,'--','docs/art'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024})
    .trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return [path,meta.split(' ')[2]];}));
  const blobs=tree(baseline);
  // The HIGH ORBIT ascent/descent sheets did not exist at the baseline: they
  // were painted by e8bf123 "Replace five obsolete suit flights and restore
  // continuous helmet glass". Artwork the baseline never held is pinned to the
  // revision that shipped it, so every image on screen still has an exact hash.
  const shipped=tree(process.env.ACORNAUT_HELMET_SHIPPED || 'e8bf1230c765df5f34a6168be8b183c5be626e8d');
  const loaded=new Map();
  const glassRepairs=new Set();
  async function sprite(path) {
    if(loaded.has(path)) return loaded.get(path);
    const promise=(async()=>{
      const bytes=readFileSync(join(root,'docs/art',path)), full='docs/art/'+path;
      const hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      const repaired=path.match(/^helms\/(clear|aurora|cherry|chrono|comet|ion|lunar|meteor|solar)\.png$/);
      if(repaired&&hash!==blobs.get(full)) {
        glassRepairs.add(path);
        // Authorized glass repaint: preserve the original alpha geometry and
        // everything outside the lower pane. All body artwork stays exact.
        const reference=readFileSync(join(root,'art-src/helmet-glass-repair',repaired[1]+'-reference.png'));
        assert.equal(createHash('sha1').update(`blob ${reference.length}\0`).update(reference).digest('hex'),blobs.get(full),'glass reference must be the exact baseline art');
        const pixels=async b=>{const c=createCanvas(256,256),g=c.getContext('2d');g.drawImage(await loadImage(b),0,0);return g.getImageData(0,0,256,256).data;};
        const [a,b]=await Promise.all([pixels(bytes),pixels(reference)]);
        for(let p=0;p<a.length;p+=4){
          assert.equal(a[p+3],b[p+3],'painted glass cannot change helmet alpha geometry');
          const x=p/4%256,y=Math.floor(p/4/256);
          if(x<60||x>205||y<150||y>224)assert.deepEqual(a.slice(p,p+4),b.slice(p,p+4),'helmet exterior is protected');
        }
      } else {
        const pinned=blobs.get(full) ?? shipped.get(full);
        assert(pinned,`${path}: no pinned revision covers this artwork`);
        assert.equal(hash,pinned,`${path}: unrepaired artwork remains unchanged`);
      }
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
  // The five HIGH ORBIT suits have no pre-repair rendering to diff against, so
  // they fly the shipped renderer alone: the body must actually paint and the
  // equipped helmet must land exactly once on the frame that was asked for.
  function solo(label,draw,{expectHelmet=true,frame}={}) {
    canvases[1].getContext('2d').reset();outputs[1].body.length=0;outputs[1].helmet.length=0;
    delete window.__acornautPose;
    draw(After,contexts[1],1);
    const pose=window.__acornautPose ? structuredClone(window.__acornautPose) : null;
    assert(outputs[1].body.length,`${label}: the body actually rendered`);
    if(frame) {
      assert.equal(pose?.suit,frame.suit,`${label}: the equipped suit is the one painted`);
      assert.equal(pose?.bank,frame.bank,`${label}: requested bank is exercised`);
      assert.equal(pose?.idx,frame.idx,`${label}: requested source frame is exercised`);
    }
    if(expectHelmet) assert.equal(outputs[1].helmet.length,1,`${label}: exactly one equipped helmet is composited`);
    counts.soloFrames++; counts.bodyDraws+=outputs[1].body.length;counts.helmetDraws+=outputs[1].helmet.length;
  }
  const lean=NewControl.SUIT_LEAN_DEFAULT;
  assert.deepEqual(lean,OldControl.SUIT_LEAN_DEFAULT,'default lean unchanged');
  // a76c23e dialled Eclipse to 5 degrees forward and Volt to 25; no other
  // suit's flight lean moved, and every suit flown below is flown at its own
  // resolved lean so the two renderers never disagree about the attitude.
  assert.deepEqual(NewCat.SUIT_PITCH_DEFAULTS,{...OldCat.SUIT_PITCH_DEFAULTS,eclipse:5,volt:25},
    'suit lean defaults changed only by the dialled Eclipse/Volt rungs');
  function illustrated(renderer,ctx,suit,bank,{pose=NaN,tap=-1,time=0,size=256,pitch=0,vy=0}={}) {
    ctx.translate(dimensions/2,dimensions/2);ctx.rotate(pitch);
    renderer.paintIllustrated(ctx,art.squirrelIdle[0],0,0,size,helmet,suit,time,bank,'idle-1',
      undefined,undefined,0,'light',.12,tap,-1,0,0,vy,suit.id==='eclipse'?2:0,300,lean,pose);
  }

  for(const suit of legacy) {
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

  // HIGH ORBIT, on the shipped renderer alone: every one of the five must fly
  // its whole 8/8 ascent and descent, land the frame the pose asks for, keep a
  // body on screen at both scales and wear exactly one helmet - loading art for
  // them is not enough, a bare-headed or non-rendering promotion fails here.
  for(const suit of promoted) {
    const id=suit.id;
    for(const [property,bank,sign] of [['suitAsc','asc',-1],['suitDesc','desc',1]]) {
      const n=art[property][id]?.length || 0;
      assert.equal(n,8,`${id}: the shipped ${bank} sheet loads all eight frames`);
      for(let i=0;i<n;i++) for(const size of [52,256]) {
        const pose=i===0 && sign>0 ? 1e-6 : sign*i/Math.max(1,n-1);
        solo(`${id} ${bank}-${i+1} size ${size}`,(renderer,ctx)=>illustrated(renderer,ctx,suit,art,
          {pose,size,pitch:size===52?-.21:.32}),{frame:{suit:id,bank,idx:i+1}});
        counts.motionFrames++;
      }
    }
    const loading={...art,suitTail:{},suitBody:{},suitAsc:{},suitDesc:{},suitTap:{}};
    solo(`${id} static loading fallback`,(renderer,ctx)=>illustrated(renderer,ctx,suit,loading));
    for(let tick=0;tick<96;tick++) {
      const time=tick/15;
      solo(`${id} loadout t=${time}`,(renderer,ctx)=>renderer.paintFlightPreview(ctx,art,suit,helmet,
        dimensions/2,dimensions/2,256,time,lean,tick>=48,.2));
      counts.previewFrames++;
    }
  }

  const nativeRandom=Math.random;
  function makeRun(Sim,Save,id) {
    // Fly both renderers at the SAME real lean: drawPilot resolves the suit's
    // pitch from the save, and a76c23e moved two of the defaults, so the saved
    // number is pinned to what production resolves today rather than letting a
    // dialled default masquerade as a rendering change.
    const save=Save.defaultSave();Object.assign(save,{equippedSuit:id,equippedHelmet:'clear',equippedTrail:'ion',tutorialDone:true,guide:'done',
      suitPitch:{[id]:NewCat.suitPitchDefault(id)}});
    Math.random=()=>.5;
    let world;
    try { world=Sim.makeWorld(390,5000);Sim.resetRun(world,save,'fly',false); }
    finally { Math.random=nativeRandom; }
    world.planets=[];world.pickups=[];world.lastSpawnX=100000;world.warpT=0;
    return {world,save};
  }
  const motionKeys=['time','squirrel','distance','screen','ready','tapAnimT','tapAnimFromRot',
    'tailA','tailV','bounceAnimT','bounceAnimDir','bounceAnimStrength','flapBoost','speed'];
  for(const suit of legacy) for(const interval of [.1,.18,.3]) {
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
  // The five promoted suits also have to survive a real flight on the shipped
  // sim: taps accepted, a dive taken, and a pilot painted with one helmet on
  // every frame of the run - the gameplay path the legacy loop above covers.
  for(const suit of promoted) {
    const run=makeRun(NewSim,NewSave,suit.id);
    const taps=new Set([0,11,22,33,44]);
    for(let tick=0;tick<120;tick++) {
      if(taps.has(tick)) assert.equal(NewSim.flap(run.world,run.save),'flap',`${suit.id}: real 180ms input accepted`);
      if(tick===95) NewSim.dive(run.world,run.save);
      Math.random=()=>.5;
      try { NewSim.updateWorld(run.world,run.save,1/60); } finally { Math.random=nativeRandom; }
      solo(`${suit.id} gameplay tick ${tick}`,(renderer,ctx)=>
        renderer.drawPilot(ctx,run.world,run.save,art,dimensions/2,1,dimensions/2));
      counts.gameplayFrames++;if(taps.has(tick)) counts.acceptedTaps++;
    }
  }
  console.log(JSON.stringify({passed:true,baseline,build:NewCat.ART_VER,productionWearableSuits:suits.map(s=>s.id),
    highOrbitPromotions:promoted.map(s=>s.id),
    sourceImagesChecked:loaded.size,sourceImagesUnchanged:loaded.size-glassRepairs.size,
    repaintedGlass:[...glassRepairs],...counts,limitation:'Native Canvas regression proves unchanged body animation; helmet fit still requires visual review.'},null,2));
} finally {
  rmSync(scratch,{recursive:true,force:true});
}
