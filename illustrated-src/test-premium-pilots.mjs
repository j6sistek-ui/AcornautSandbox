#!/usr/bin/env node
// Owner-delivered full-body frames through the shipping renderer and real
// shop/save paths. Run export-sandbox.mjs first. These mechanical receipts
// supplement visual review of the source poses, shadows and artifact cleanup.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const mode=process.argv[2],root=fileURLToPath(new URL('../',import.meta.url));
const ids=['porcelain','nacre','origamist'];
if(!mode){
  for(const page of ['render','production','beta'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),page],{stdio:'inherit'});
  process.exit(0);
}
assert(['render','production','beta'].includes(mode),'mode must be render, production or beta');

if(mode==='render')await renderChecks();else await integrationChecks();

async function renderChecks(){
  const require=createRequire(import.meta.url),{createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
  globalThis.Image=Image;globalThis.HTMLImageElement=Image;
  globalThis.window={location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
  globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},documentElement:{style:{}}};
  globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  const R=await import('../docs/js/high-orbit.js'),M=await import('../docs/js/high-orbit-motion.js'),C=await import('../docs/js/high-orbit-config.js');
  const P=await import('../docs/js/premium-flight.js'),{PREMIUM_FLIGHT_FRAMES:metadata}=await import('../docs/js/premium-flight-frames.js');
  const D=await import('../docs/js/draw.js'),Cat=await import('../docs/js/catalog.js'),E=await import('../docs/js/high-orbit-effects.js');
  const {createHash}=await import('node:crypto');
  assert.deepEqual(C.PREMIUM_SUIT_IDS,ids);
  assert.deepEqual(C.HIGH_ORBIT_RIG_IDS,['cinderforge','groveguard','cosmic','sunforged','abyssal'],'only the original five are cut rigs');
  assert.deepEqual(C.ORBIT_PILOT_IDS,[...C.HIGH_ORBIT_RIG_IDS,...ids]);
  // Premium playback must survive the owner-requested High Orbit retarget.
  // These complete-state fixtures come from main e94b2b4. The old five-rig
  // motion freeze is superseded by test-high-orbit-input's behavioral checks.
  const originalMotion={porcelain:'db777d0ed8ba4c7dee9e78488e4f7d0febb93abb316d111969f574fc5f639172',nacre:'f5c2bf93a814e5ced303a10a65b8610ae2735fee0ae0d95771891bdccef1d8fb',origamist:'2331c52a2f82981385746582d4fb899e28ac12ca75a2d817b064b2000ff813eb'};
  for(const [id,expected] of Object.entries(originalMotion)){
    const state=M.createHighOrbitMotion(id),hash=createHash('sha256');
    for(let tick=0;tick<1200;tick++){
      if(tick%31===0)M.highOrbitTap(state,40);
      M.stepHighOrbit(state,id,1/120,tick<200?-450:tick<450?0:tick<700?610:-350);hash.update(JSON.stringify(state));
    }
    assert.equal(hash.digest('hex'),expected,id+' preserves every original motion state');
  }
  const art={suits:{},highOrbit:{},premiumFlight:{},helms:{},squirrelIdle:[],squirrelFlap:[]};
  for(const id of ids){art.premiumFlight[id]=await loadImage(root+'docs/art/suits/'+id+'/flight.png');art.suits[id]=await loadImage(root+'docs/art/suits/'+id+'.png');}
  for(const h of Cat.HELMETS){try{art.helms[h.id]=await loadImage(root+'docs/art/helms/'+h.id+'.png');}catch{}}
  const rgba=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  const same=(a,b,label)=>assert(Buffer.from(rgba(a)).equals(Buffer.from(rgba(b))),label);
  const surface=()=>createCanvas(256,256);
  const contact=createCanvas(1280,1152),cc=contact.getContext('2d'),results=[];
  cc.fillStyle='#111929';cc.fillRect(0,0,contact.width,contact.height);
  for(const [row,id] of ids.entries()){
    const sheet=art.premiumFlight[id],spec=metadata[id],suit=Cat.SUITS.find(s=>s.id===id),fallbackBank={...art,premiumFlight:{}};
    assert(C.isPremiumSuit(id)&&C.isHighOrbit(id)&&!C.isHighOrbitRig(id),id+' is a full-body frame pilot');
    assert.equal(sheet.width,1024);assert.equal(sheet.height,1024);assert.equal(spec.frameCount,16);assert.equal(spec.cellSize,256);assert.equal(spec.frames.length,16);assert.equal(spec.fallbackFrame,0);
    assert.equal(art.suits[id].width,256);assert.equal(art.suits[id].height,256);
    const expectedFrames=[],hashes=[],bounds=[];
    for(let frame=0;frame<16;frame++){
      const registration=spec.frames[frame];
      assert(registration.head.length===2&&registration.head.every(Number.isFinite)&&Number.isFinite(registration.radius)&&registration.radius>0,id+' frame '+frame+' measured head');
      assert.equal(registration.emitters.length,2);
      for(const point of [registration.head,...registration.emitters])assert(point.length===2&&point.every(n=>Number.isFinite(n)&&n>=0&&n<=256),id+' finite in-frame head/emitter registration');
      const expected=surface();expected.getContext('2d').drawImage(sheet,frame%4*256,Math.floor(frame/4)*256,256,256,0,0,256,256);expectedFrames.push(expected);
      const pixels=rgba(expected);let ink=0,left=256,top=256,right=-1,bottom=-1;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]>=100){ink++;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      assert(ink>1000,id+' frame '+frame+' has a complete visible character');
      assert(left>0&&top>0&&right<255&&bottom<255,id+' frame '+frame+' has transparent canvas padding');
      bounds.push({frame,ink,left,top,right,bottom});hashes.push(createHash('sha256').update(pixels).digest('hex'));
      // Sample the middle of the slice this frame actually occupies. The
      // clock is front-loaded (premium-flight.ts PREMIUM_FLIGHT_CURVE), so
      // the midpoint of an even sixteenth no longer lands inside frame N -
      // the old (frame+.5)/16 age was asserting a FLAT clock, not
      // addressability. Inverting the curve keeps the real property under
      // any curve value, and the frame-rate sweep below is what now holds
      // the line on frames actually being SEEN.
      const age=Math.pow((frame+.5)/16,1/P.PREMIUM_FLIGHT_CURVE)*M.PREMIUM_FLIGHT_DURATION;
      const state=M.createHighOrbitMotion(id);state.frames={age,active:true,queued:false};
      assert.equal(P.premiumFlightFrame(id,state),frame,id+' every authored frame is addressable');
      const explicit=surface();P.paintPremiumFlightFrame(explicit.getContext('2d'),art,id,128,128,192,frame,state,undefined,false);same(explicit,expected,id+' exact complete frame '+frame+' from public painter');
      let overlays=0;const routed=surface();R.paintHighOrbit(routed.getContext('2d'),art,id,128,128,192,state,undefined,false,0,()=>overlays++,true);
      assert.equal(overlays,0,id+' frame '+frame+' ignores external head overlays');same(routed,expected,id+' legacy entry point dispatches full frame '+frame);
      for(const helmet of Cat.HELMETS){const live=surface();D.paintOrbitPilot(live.getContext('2d'),art,id,128,128,192,helmet,state,undefined,false);same(live,expected,id+' frame '+frame+' authored head retained with '+helmet.id);}
      for(const [size,pitch] of [[52,-.35],[52,.35],[192,-.35],[192,.35]]){
        // Inspect the actual drawing transform. Rendering through an extra
        // intermediate canvas adds one-byte color rounding under rotation;
        // the direct 192px comparison above remains an exact pixel check.
        const shown=surface(),native=shown.getContext('2d'),draws=[];
        const observed=new Proxy(native,{get(target,key){const value=Reflect.get(target,key,target);if(key==='drawImage')return(image,...args)=>{const m=target.getTransform();draws.push({image,args,m:[m.a,m.b,m.c,m.d,m.e,m.f]});return value.call(target,image,...args);};return typeof value==='function'?value.bind(target):value;},set(target,key,value){return Reflect.set(target,key,value,target);}});
        P.paintPremiumFlightFrame(observed,art,id,128,128,size,frame,state,undefined,false,pitch);
        assert.equal(draws.length,1,id+' exactly one whole-frame draw');assert.equal(draws[0].image,sheet);
        assert.deepEqual(draws[0].args,[frame%4*256,Math.floor(frame/4)*256,256,256,-128,-128,256,256],id+' fixed source and destination rectangles');
        const u=size/192,expectedMatrix=[Math.cos(pitch)*u,Math.sin(pitch)*u,-Math.sin(pitch)*u,Math.cos(pitch)*u,128,128];
        for(let i=0;i<6;i++)assert(Math.abs(draws[0].m[i]-expectedMatrix[i])<1e-6,id+' frame '+frame+' keeps the same uniform transform at '+size+'px');
      }
      const x=frame%8*160,y=row*384+Math.floor(frame/8)*192;cc.drawImage(expected,x,y+24,160,160);cc.fillStyle='#dce5f5';cc.font='12px sans-serif';cc.fillText(suit.name+' '+(frame+1),x+5,y+18);
    }
    const portrait=surface();portrait.getContext('2d').drawImage(art.suits[id],0,0);same(portrait,expectedFrames[0],id+' fallback is exactly frame one');
    for(const helmet of Cat.HELMETS){
      const fallback=surface();D.paintOrbitPilot(fallback.getContext('2d'),fallbackBank,id,128,128,192,helmet,M.createHighOrbitMotion(id),undefined,false);same(fallback,expectedFrames[0],id+' atomic fallback keeps fixed head with '+helmet.id);
      for(const bank of [art,fallbackBank]){const card=surface();D.paintPortrait(card.getContext('2d'),bank,helmet,suit,128,126,192);same(card,expectedFrames[0],id+' portrait entry point with '+helmet.id);}
    }
    for(const bank of [art,fallbackBank]){
      let first;
      for(const helmet of Cat.HELMETS){const preview=surface();D.paintFlightPreview(preview.getContext('2d'),bank,suit,helmet,128,128,192,0);if(!first)first=preview;else same(preview,first,id+' preview fixed head with '+helmet.id);}
      const cockpit=createCanvas(80,80),expected=createCanvas(80,80),eg=expected.getContext('2d'),head=spec.frames[0],scale=32*.96/head.radius;
      R.paintHighOrbitCockpit(cockpit.getContext('2d'),bank,id,40,40,32,32);eg.beginPath();eg.ellipse(40,40,32,32,0,0,Math.PI*2);eg.clip();eg.drawImage(expectedFrames[0],40-head.head[0]*scale,40-head.head[1]*scale,256*scale,256*scale);same(cockpit,expected,id+' cockpit uses the authored first-frame head');
    }
    // One tap reaches all sixteen poses; repeated taps queue without starving
    // the final poses or mutating any unused cut-rig joint data.
    for(const rapid of [false,true]){
      const state=M.createHighOrbitMotion(id),initialPose=structuredClone(state.pose),seen=new Set(),sequence=[];M.highOrbitTap(state,40);seen.add(P.premiumFlightFrame(id,state));
      for(let tick=0;tick<240;tick++){
        if(rapid&&tick%15===0)M.highOrbitTap(state,40);
        M.stepHighOrbit(state,id,1/120,-200);const frame=P.premiumFlightFrame(id,state);seen.add(frame);if(sequence.at(-1)!==frame)sequence.push(frame);
        assert.deepEqual(state.pose,initialPose,id+' whole frames do not animate cut-rig joints');
      }
      assert.deepEqual([...seen].sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i),id+' all sixteen poses reachable'+(rapid?' under rapid taps':''));
      assert.deepEqual(sequence.slice(0,16),Array.from({length:16},(_,i)=>i),id+' authored frame order preserved');
      if(!rapid)assert(!state.frames.active,id+' one tap completes without an unrequested replay');
      const before=structuredClone(state);for(const [dt,vy] of [[0,0],[-1,0],[NaN,0],[.01,NaN]])M.stepHighOrbit(state,id,dt,vy);for(const impulse of [0,-1,NaN,Infinity])M.highOrbitTap(state,impulse);assert.deepEqual(state,before,id+' invalid input or paused clock does not advance');
    }
    // Reachable at 120fps is not reachable everywhere. Front-loading the
    // clock buys the earlier first move by giving the opening frames fewer
    // ticks, and pushed far enough it drops an authored frame entirely.
    // Measured on this bank: every frame survives down to 24fps, and frame
    // 3 is the first to go at 20. The floor is held at 30 - well under
    // anything the game ships at, well over where the curve starts to bite.
    // A failure here means PREMIUM_FLIGHT_CURVE went too low, not that the
    // art is wrong.
    for(const fps of [30,60,120]){
      const s=M.createHighOrbitMotion(id),seen=new Set();M.highOrbitTap(s,40);
      seen.add(P.premiumFlightFrame(id,s));
      for(let tick=0;tick<fps;tick++){M.stepHighOrbit(s,id,1/fps,-200);seen.add(P.premiumFlightFrame(id,s));}
      assert.deepEqual([...Array(16).keys()].filter(f=>!seen.has(f)),[],
        id+' shows every authored frame at '+fps+'fps');
    }
    const rates=[30,60,120].map(fps=>{const s=M.createHighOrbitMotion(id);M.highOrbitTap(s);for(let tick=0;tick<fps*2;tick++){if(tick===fps/2)M.highOrbitTap(s);M.stepHighOrbit(s,id,1/fps,-200);}return s;});
    for(const s of rates.slice(1)){assert.equal(P.premiumFlightFrame(id,s),P.premiumFlightFrame(id,rates[0]),id+' frame rate independent playback');assert.equal(s.frames.active,rates[0].frames.active);assert(Math.abs(s.frames.age-rates[0].frames.age)<1e-8);}
    // Exercise actual frame-emitter attachment, retained wake history and the
    // strict geometry Chrome requires between emission samples.
    const effect=surface(),native=effect.getContext('2d'),centers=[];
    const strict=new Proxy(native,{get(target,key){const value=Reflect.get(target,key,target);
      if(['ellipse','arc','createRadialGradient','createLinearGradient','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','translate','rotate','scale','transform','fillRect'].includes(key))return(...args)=>{
        assert(args.filter(v=>typeof v==='number').every(Number.isFinite),id+' finite '+key+' geometry');
        const radii=key==='ellipse'?[args[2],args[3]]:key==='arc'?[args[2]]:key==='createRadialGradient'?[args[2],args[5]]:[];assert(radii.every(v=>v>=0),id+' browser-valid '+key+' radius');
        if(key==='createRadialGradient'&&args[5]===192*.018)centers.push(args.slice(0,2));return value.apply(target,args);
      };return typeof value==='function'?value.bind(target):value;
    },set(target,key,value){if(typeof value==='number')assert(Number.isFinite(value),id+' finite effect '+key);return Reflect.set(target,key,value,target);}});
    const state=M.createHighOrbitMotion(id);M.highOrbitTap(state);
    for(let tick=0;tick<720;tick++){
      if(tick%90===0)M.highOrbitTap(state);M.stepHighOrbit(state,id,1/240,tick%180<60?-420:610);
      const pitch=tick%2?.2:-.2,index=P.premiumFlightFrame(id,state);centers.length=0;native.clearRect(0,0,256,256);
      P.paintPremiumFlight(strict,art,id,128,128,192,state,{x:128,y:128,travel:state.time*360},true,pitch);
      // The two fixed-radius hot cores identify the emitters independently
      // of intervening decorative glows in the retained wake history.
      const actual=centers,expected=spec.frames[index].emitters.map(([x,y])=>[(x-128)*Math.cos(pitch)-(y-128)*Math.sin(pitch),(x-128)*Math.sin(pitch)+(y-128)*Math.cos(pitch)]);
      assert.equal(actual.length,2,id+' both authored boot emitters painted');
      for(let i=0;i<2;i++)assert(Math.hypot(actual[i][0]-expected[i][0],actual[i][1]-expected[i][1])<1e-8,id+' wake is attached to the displayed frame');
    }
    const wake=createCanvas(80,40);E.paintHighOrbitWake(wake.getContext('2d'),id,40,20,0);assert(rgba(wake).some((value,i)=>i%4===3&&value>100),id+' custom wake visible at first paint');
    results.push({id,frames:16,frameHashes:hashes,bounds,rapidTapAllFrames:true,helmetsChecked:Cat.HELMETS.length,wakeSamples:720,headPolicy:suit.headPolicy});
  }
  const out=root+'illustrated-src/design/premium-pilots/';mkdirSync(out,{recursive:true});
  writeFileSync(out+'production-review.png',contact.toBuffer('image/png'));
  writeFileSync(out+'regression.json',JSON.stringify({passed:true,scope:'Owner full-body frames, registered playback, fixed authored heads, actual frame emitters, and legacy motion preservation; visual cleanup requires image review',originalMotionBaseline:'db92f7c79ff0576f7f5ab242e59b31db396caaee',results},null,2)+'\n');
  console.log(JSON.stringify({suite:'premium full-body frames',passed:true,frames:48,legacyControllerTicks:6000,results:results.map(({bounds,frameHashes,...r})=>r)},null,2));
}

async function integrationChecks(){
  const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM||'happy-dom');
  const win=new Window({url:`http://local/${mode==='production'?'':'beta/'}`});win.__ACORNAUT_BETA__=mode==='beta';
  const backgrounds=new WeakMap(),bg=Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype,'backgroundImage');
  Object.defineProperty(win.CSSStyleDeclaration.prototype,'backgroundImage',bg&&bg.set?{...bg,set(value){backgrounds.set(this,value);bg.set.call(this,value);}}:{configurable:true,get(){return backgrounds.get(this)??'';},set(value){backgrounds.set(this,value);}});
  for(const key of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])Object.defineProperty(globalThis,key,{value:key==='window'?win:win[key],configurable:true,writable:true});
  let frame=0;const frames=new Map();globalThis.performance={now:()=>0};globalThis.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};globalThis.cancelAnimationFrame=id=>frames.delete(id);win.requestAnimationFrame=requestAnimationFrame;win.cancelAnimationFrame=cancelAnimationFrame;
  globalThis.Image=class {set src(value){queueMicrotask(()=>this.onerror?.());}};
  globalThis.fetch=async()=>({ok:false,json:async()=>({})});
  const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
  win.HTMLCanvasElement.prototype.getContext=()=>ctx;
  win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:390,height:500,right:390,bottom:500};};
  win.HTMLElement.prototype.scrollIntoView=function(){};
  win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
  const S=await import('../docs/js/save.js'),C=await import('../docs/js/catalog.js'),Config=await import('../docs/js/high-orbit-config.js');
  const {selectShopCycle}=await import('../docs/js/shop-cycle.js');
  const Sim=await import('../docs/js/sim.js'),Race=await import('../docs/js/race.js');
  const save=S.defaultSave();Object.assign(save,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true});S.writeSave(save);
  const {bootStandalone}=await import('../docs/js/standalone.js');const app=document.createElement('main');document.body.append(app);await bootStandalone(app);const e=win.__sandbox;assert(e);
  e.save.unlocked.push('ion');e.save.equipped='ion';e.save.unlockedTrails.push('ion');e.save.equippedTrail='ion';
  const clock=Date.now;
  try{
    for(const day of [20000,20017]){
      Date.now=()=>day*C.SHOP_DAY_MS+3600000;e.open('shop');
      const listed=[...app.querySelectorAll('.ac-shoptile .ac-tilename')].map(node=>node.textContent);
      const cycle=selectShopCycle(day,id=>S.ownsPremium(e.save,id));
      for(const id of ids)assert.equal(listed.includes(C.SUITS.find(s=>s.id===id).name),cycle.suits.includes(id),id+' follows actual storefront day '+day);
    }
  }finally{Date.now=clock;}
  const results=[];
  for(const id of ids){
    const suit=C.SUITS.find(s=>s.id===id),price=C.idDust(id),trail=Config.HIGH_ORBIT_PROFILES[id].trail;
    assert(suit&&C.FIXED_SHOP_SUIT_IDS.includes(id),id+' present on '+mode);assert(C.wearsOwnHead(suit),id+' never uses interchangeable helmets');
    assert.equal(suit.headPolicy,id==='nacre'?'helmetless':'integrated');
    assert.equal(suit.fixedHelmet,id==='porcelain'?'Sovereign Shell':id==='origamist'?'Facet Shell':undefined);
    // Exact owner prices and the combined trio pack are covered by the
    // pricing suite; this exercises the real individual-pilot transaction.
    assert(price>0&&Number.isInteger(price),id+' valid individual sticker');
    assert(C.IAP_ITEMS.includes(id));assert(!C.IAP_ITEMS.includes(trail),'wake is included, never sold separately');
    assert(!C.HELMETS.some(h=>h.id===id),id+' has no detachable helmet SKU');
    assert(!S.suitRevealed(e.save,id)&&!S.trailUnlocked(e.save,trail),id+' not freely owned on '+mode);
    assert.equal(e.buySuit(id),'locked');assert.equal(e.buyTrail(trail),'locked');
    e.save.starDust=price-1;const beforePoor=JSON.stringify(e.save);assert.equal(e.buyShopItem(id),'poor');assert.equal(JSON.stringify(e.save),beforePoor,'unfunded purchase has no side effects');
    // Exercise the real storefront card and cart button, then restore this
    // synthetic fixture to independently exercise the individual transaction.
    const beforeShop=structuredClone(e.save);e.save.starDust=price;
    const availableDay=Array.from({length:366},(_,i)=>20000+i).find(day=>selectShopCycle(day,item=>S.ownsPremium(e.save,item)).suits.includes(id));
    assert(Number.isInteger(availableDay),id+' reaches an eligible daily slot');
    Date.now=()=>availableDay*C.SHOP_DAY_MS+3600000;e.open('shop');
    const tile=[...app.querySelectorAll('.ac-shoptile')].find(node=>node.querySelector('.ac-tilename')?.textContent===suit.name);assert(tile,id+' real shop tile');tile.click();
    assert(app.textContent.includes(C.fixedHeadTag(suit)),id+' shop preview states fixed head rule');
    assert.equal(e.save.equipped,'ion','trying a suit never overwrites selected helmet');
    const checkout=app.querySelector('.ac-combobuy');assert(checkout,id+' can be placed in cart');checkout.click();
    assert.equal(e.save.starDust,0,id+' actual storefront charges its advertised sticker');assert(S.suitRevealed(e.save,id)&&S.trailUnlocked(e.save,trail));
    Date.now=clock;
    Object.assign(e.save,beforeShop);
    e.save.starDust=price;assert.equal(e.buyShopItem(id),'ok');assert.equal(e.save.starDust,0);
    assert(S.suitRevealed(e.save,id)&&S.trailUnlocked(e.save,trail));assert.equal(e.buyShopItem(id),'owned');assert.equal(e.save.starDust,0);
    assert.equal(e.buySuit(id),'equip');assert.equal(e.save.equippedSuit,id);assert.equal(e.save.equipped,'ion','equipping fixed-head suit preserves previous selected helmet');
    for(const helmet of C.HELMETS){const before=JSON.stringify(e.save);assert.equal(e.buyHelmet(helmet.id),'fixedHead',id+' rejects '+helmet.id);assert.equal(JSON.stringify(e.save),before,'helmet attempt does not spend, unlock or change selection');}
    assert.equal(C.trailWornBy('ion',id),trail);assert.equal(e.buyTrail(trail),'equip');assert.equal(e.save.equippedTrail,'ion');
    for(const other of C.SUITS)assert.equal(C.canWearTrail(trail,other.id),other.id===id,id+' wake exclusive');
    S.writeSave(e.save);const restored=S.loadSave();assert.equal(restored.equippedSuit,id);assert.equal(restored.equipped,'ion');assert.equal(restored.equippedTrail,'ion');assert(S.suitRevealed(restored,id));
    e.open('hangar');e.setShopTab('helmets');assert(app.textContent.includes(C.fixedHeadLine(suit))||app.textContent.includes(C.fixedHeadDescription(suit)),id+' hangar explains its authored head rule');
    if(id==='nacre')assert(!C.fixedHeadDescription(suit).toLowerCase().includes('custom helmet'),'Envoy label does not claim a helmet');

    const w=Sim.makeWorld(390,5000);Sim.resetRun(w,e.save,'fly',false);Sim.updateWorld(w,e.save,1/60);assert(w.highOrbit.time>0,id+' ready pose advances');
    assert.equal(w.highOrbit.id,id);let randomCalls=0;const random=Math.random;Math.random=()=>{randomCalls++;return .5;};
    try{Sim.spawnTrail(w,e.save,.5);}finally{Math.random=random;}
    assert.equal(randomCalls,0);assert.equal(w.particles.length,0,id+' cosmetic wake does not consume physics RNG');
    assert.equal(Sim.flap(w,e.save),'flap');for(let i=0;i<18;i++)Sim.updateWorld(w,e.save,1/60);assert(w.highOrbit.time>.25&&w.highOrbit.frames.active,id+' accepted flight input advances full-frame playback');
    for(const hold of ['pause','shield','warp','stuck']){
      const before=JSON.stringify(w.highOrbit);if(hold==='pause')w.screen='pause';if(hold==='shield')w.shieldFreeze=.3;if(hold==='warp')w.warpT=.3;if(hold==='stuck')w.stuck=true;
      Sim.updateWorld(w,e.save,1/60);assert.equal(JSON.stringify(w.highOrbit),before,id+' '+hold+' holds pose');w.screen='play';w.shieldFreeze=0;w.warpT=0;w.stuck=false;
    }
    const small=Sim.makeWorld(390,844),large=Sim.makeWorld(900,900),authority=Race.createRaceState(),input={held:true,boost:false};
    for(const world of [small,large]){Sim.resetRun(world,e.save,'fly',false);world.race=Race.createRaceState();Sim.setRaceInput(world,input);}Race.queueRaceInput(authority,input);
    for(let i=0;i<20;i++){Sim.updateWorld(small,e.save,1/120);Sim.updateWorld(large,e.save,1/30);Race.stepRace(authority);}
    assert.deepEqual(small.race,authority,id+' cosmetic playback leaves race authority unchanged');assert.deepEqual(small.highOrbit,large.highOrbit,id+' race playback independent of viewport');
    assert(small.highOrbit.frames.active&&small.highOrbit.frames.age>0,id+' accepted race hold advances full-frame playback');
    results.push({id,price,headPolicy:suit.headPolicy,wake:trail});
  }
  // A previously selected matched helmet also survives a fixed-head detour.
  const matched=C.HELMETS.find(h=>h.suitOnly);assert(matched);
  e.save.purchased.push(matched.id,matched.suitOnly);e.save.equippedSuit=matched.suitOnly;e.save.equipped=matched.id;
  for(const id of ids){assert.equal(e.buySuit(id),'equip');assert.equal(e.save.equipped,matched.id);S.writeSave(e.save);assert.equal(S.loadSave().equipped,matched.id,'reload preserves a temporarily hidden matched helmet');}
  assert.equal(e.buySuit(matched.suitOnly),'equip');assert.equal(e.save.equipped,matched.id,'original outfit restores original matched helmet');
  e.save.equipped='ion';assert.equal(e.buySuit('flight'),'equip');assert.equal(e.save.equipped,'ion');assert.equal(e.save.equippedTrail,'ion');
  // Old saves need no premium fields. Existing progress/ownership must survive.
  assert.equal(S.BETA_DUST_GRANT_FLOOR,12360);assert.equal(S.BETA_LEGACY_DUST_GRANT_TOTAL,7510);
  const currentGrant=S.betaDustGrantTarget();assert.equal(currentGrant,12360,'regrouping preserves the existing beta grant');
  const old=S.defaultSave();Object.assign(old,{tutorialDone:true,guide:'done',equipped:'ion',unlocked:['clear','ion'],equippedSuit:'flight',acorns:14731,starDust:419,betaDustGrant:true,betaDustGrantTotal:S.BETA_LEGACY_DUST_GRANT_TOTAL,purchased:['arcflash'],receipts:['premium-regression-legacy']});
  S.writeSave(old);const loaded=S.loadSave();for(const field of ['equipped','equippedSuit','acorns'])assert.equal(loaded[field],old[field],'old save preserves '+field);
  assert.equal(loaded.starDust,old.starDust+(mode==='beta'?currentGrant-S.BETA_LEGACY_DUST_GRANT_TOTAL:0),'legacy beta receives only its preservation top-up; production currency is unchanged');
  assert(loaded.purchased.includes('arcflash'));assert(loaded.receipts.includes('premium-regression-legacy'));
  for(const id of ids)assert(!S.suitRevealed(loaded,id),'old save gains no unbought '+id);
  const pending=[],urls=[];globalThis.Image=class {naturalWidth=1024;naturalHeight=1024;set src(value){urls.push(value);pending.push(this);}};
  const Art=await import('../docs/js/art.js?premium-loader');
  for(const id of ids){
    const bank={};let loading=Art.loadSuitBank(bank,id),image=pending.at(-1);
    assert(!bank.premiumFlight?.[id],id+' no partial sheet before decode');image.onerror();await loading;
    assert(!bank.premiumFlight?.[id],id+' network error keeps fallback');
    loading=Art.loadSuitBank(bank,id);image=pending.at(-1);image.naturalHeight=768;image.onload();await loading;
    assert(!bank.premiumFlight?.[id],id+' cut-part dimensions cannot masquerade as full frames');
    loading=Art.loadSuitBank(bank,id);image=pending.at(-1);assert.equal(Art.loadSuitBank(bank,id),loading,id+' concurrent loads share one decode');
    assert(!bank.premiumFlight?.[id],id+' retry still publishes atomically');image.onload();await loading;
    assert.equal(bank.premiumFlight[id],image,id+' one decoded sheet publishes all sixteen poses');assert(!bank.highOrbit?.[id],id+' never loads a cut rig');
    assert(urls.some(url=>url.includes(`/suits/${id}/flight.png?v=${C.ART_VER}`)),id+' versioned production flight sheet loaded');
  }
  console.log(JSON.stringify({suite:'premium pilot '+mode,passed:true,results},null,2));
  process.exit(0);
}
