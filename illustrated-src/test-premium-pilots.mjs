#!/usr/bin/env node
// The three premium pilots use the shipping renderer and real shop/save paths.
// Run export-sandbox.mjs first. Render receipts supplement human art review;
// these geometric checks cannot judge likeness, materials or facial expression.
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
  const D=await import('../docs/js/draw.js'),Cat=await import('../docs/js/catalog.js'),E=await import('../docs/js/high-orbit-effects.js');
  assert.deepEqual(C.PREMIUM_SUIT_IDS,ids);
  assert.deepEqual(C.HIGH_ORBIT_IDS,['cinderforge','groveguard','cosmic','sunforged','abyssal'],'the existing five remain their own named group');
  assert.deepEqual(C.HIGH_ORBIT_RIG_IDS,[...C.HIGH_ORBIT_IDS,...ids]);
  assert.equal(C.HIGH_ORBIT_HEAD_RADIUS,36);assert.equal(C.HIGH_ORBIT_DISPLAY_SPAN,192);
  const art={suits:{},highOrbit:{},helms:{},squirrelIdle:[],squirrelFlap:[]};
  for(const id of ids){
    art.highOrbit[id]=await loadImage(root+'docs/art/suits/'+id+'/parts.png');
    art.suits[id]=await loadImage(root+'docs/art/suits/'+id+'.png');
  }
  // Real interchangeable helmet assets make an accidental overlay observable.
  for(const h of Cat.HELMETS){try{art.helms[h.id]=await loadImage(root+'docs/art/helms/'+h.id+'.png');}catch{}}
  const rgba=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function components(pixels,W,H){
    const seen=new Uint8Array(W*H),queue=new Int32Array(W*H),sizes=[];
    for(let start=0;start<W*H;start++){
      if(seen[start]||pixels[start*4+3]<100)continue;
      let count=1,read=0;queue[0]=start;seen[start]=1;
      const add=i=>{if(!seen[i]&&pixels[i*4+3]>=100){seen[i]=1;queue[count++]=i;}};
      while(read<count){const i=queue[read++],x=i%W,y=Math.floor(i/W);if(x)add(i-1);if(x<W-1)add(i+1);if(y)add(i-W);if(y<H-1)add(i+W);}
      sizes.push(count);
    }
    return sizes.sort((a,b)=>b-a);
  }
  const contact=createCanvas(960,1200),cc=contact.getContext('2d'),results=[];
  cc.fillStyle='#111929';cc.fillRect(0,0,contact.width,contact.height);
  for(const [column,id] of ids.entries()){
    assert(C.isHighOrbit(id)&&C.isPremiumSuit(id),id+' uses the articulated rig');
    const atlas=art.highOrbit[id],parts=R.ORBIT_PARTS[id],suit=Cat.SUITS.find(s=>s.id===id);
    assert.equal(atlas.width,1024);assert.equal(atlas.height,768);assert.equal(parts.length,11);
    assert.equal(art.suits[id].width,256);assert.equal(art.suits[id].height,256);
    const source=createCanvas(1024,768);source.getContext('2d').drawImage(atlas,0,0);const pixels=rgba(source);
    const skull=parts[0].skull,partInk=[];
    for(let cell=0;cell<12;cell++){
      let ink=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++){
        const a=pixels[((Math.floor(cell/4)*256+y)*1024+cell%4*256+x)*4+3];
        if(a>=128){
          ink++;
          if(cell===0)assert(distance([x,y],skull)<skull[2]*1.02,id+' complete head fits canonical 36px radius');
        }
        if(x===0||x===255||y===0||y===255)assert(a<16,id+' transparent padding at every cell border');
      }
      if(cell<11)assert(ink>100,id+' painted part '+cell+' is present');else assert.equal(ink,0,id+' unused twelfth cell is empty');
      partInk.push(ink);
    }
    // Do not classify blue, lilac or nacre pixels as matte contamination.
    // That would silently impose the old warm squirrel-fur palette on Envoy.
    let maxGreenExcess=-255;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>32)
      maxGreenExcess=Math.max(maxGreenExcess,pixels[i+1]-Math.max(pixels[i],pixels[i+2]));
    assert(maxGreenExcess<=25,id+' no strong green key fringe survives extraction or atlas resampling');
    const rig=createCanvas(256,256),g=rig.getContext('2d');
    R.paintHighOrbit(g,art,id,128,128,192,undefined,undefined,false);
    const portrait=createCanvas(256,256);portrait.getContext('2d').drawImage(art.suits[id],0,0);
    assert.deepEqual(rgba(rig),rgba(portrait),id+' fallback portrait is the exact canonical rig render');
    const noAtlas={...art,highOrbit:{}},fallback=createCanvas(256,256);
    R.paintHighOrbit(fallback.getContext('2d'),noAtlas,id,128,128,192,undefined,undefined,false);
    assert.deepEqual(rgba(fallback),rgba(portrait),id+' failed atlas still paints the complete fixed head');

    const state=M.createHighOrbitMotion(id),tail=createCanvas(256,256),tg=tail.getContext('2d');
    let previous={...state.pose},vy=0,maxStep=0,minJoint=1,maxDetached=0,minHeadGap=Infinity;
    let minBody=Infinity,maxBody=-Infinity,minTail=Infinity,maxTail=-Infinity,minArea=Infinity,maxArea=-Infinity,maxRigidError=0;
    for(let tick=0;tick<960;tick++){
      if(tick<480&&tick%22===0)vy=-450;else if(tick===700)vy=610;else vy=Math.min(610,vy+1100/120);
      M.stepHighOrbit(state,id,1/120,vy);
      for(const [key,value] of Object.entries(state.pose)){assert(Number.isFinite(value),id+' finite '+key);maxStep=Math.max(maxStep,Math.abs(value-previous[key]));}
      assert(Math.abs(state.pose.head)<4,id+' stabilized head');
      minBody=Math.min(minBody,state.pose.body);maxBody=Math.max(maxBody,state.pose.body);
      minTail=Math.min(minTail,state.pose.tailRoot);maxTail=Math.max(maxTail,state.pose.tailRoot);
      const j=R.highOrbitLandmarks(id,state.pose),mesh=R.highOrbitTailMesh(id,state.pose),scale=79/distance(parts[10].a,parts[10].b);
      for(const [a,b,len] of [['neck','hip',62],['nearShoulder','nearElbow',25],['nearElbow','nearWrist',23],['farShoulder','farElbow',24],['farElbow','farWrist',22],['nearHip','nearKnee',28],['nearKnee','nearBoot',29],['farHip','farKnee',27],['farKnee','farBoot',28]])
        assert(Math.abs(distance(j[a],j[b])-len)<1e-9,id+' standard '+a+' to '+b+' bone');
      for(const [a,b,c] of R.HIGH_ORBIT_TAIL_TRIANGLES){
        const ratio=area(mesh.points[a],mesh.points[b],mesh.points[c])/(area(mesh.source[a],mesh.source[b],mesh.source[c])*scale*scale);
        minArea=Math.min(minArea,ratio);maxArea=Math.max(maxArea,ratio);
        assert(Math.abs(ratio-1)<1e-9,id+' tail has no inverted or stretched triangles');
      }
      if(id==='origamist')for(let a=0;a<mesh.points.length;a++)for(let b=a+1;b<mesh.points.length;b++){
        const error=Math.abs(distance(mesh.points[a],mesh.points[b])-distance(mesh.source[a],mesh.source[b])*scale);
        maxRigidError=Math.max(maxRigidError,error);assert(error<1e-9,'Origamist folds remain rigid under articulated motion');
      }
      if(tick%12===0){
        g.clearRect(0,0,256,256);R.paintHighOrbit(g,art,id,128,128,192,state,undefined,false);
        const p=rgba(rig),sizes=components(p,256,256);maxDetached=Math.max(maxDetached,sizes[1]||0);
        assert(sizes[0]>5000,id+' substantial connected anatomy is painted');
        assert((sizes[1]||0)<32,id+' no detached limb or tail fragment');
        for(const key of ['neck','nearShoulder','farShoulder','nearElbow','farElbow','nearHip','farHip','nearKnee','farKnee']){
          const [x,y]=j[key];let ink=0;
          for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++)if(p[((Math.round(y)+oy)*256+Math.round(x)+ox)*4+3]>=100)ink++;
          minJoint=Math.min(minJoint,ink/25);assert(ink>=18,id+' covered '+key+' joint: '+ink+'/25');
        }
        for(let i=0;i<256;i++)for(const [x,y] of [[0,i],[255,i],[i,0],[i,255]])assert(p[(y*256+x)*4+3]<25,id+' no clipped canonical body');
        tg.clearRect(0,0,256,256);R.paintHighOrbitTail(tg,atlas,id,state.pose);const tp=rgba(tail);
        for(let y=0;y<256;y+=2)for(let x=0;x<256;x+=2)if(tp[(y*256+x)*4+3]>128){
          const gap=distance([x,y],j.head)-36;minHeadGap=Math.min(minHeadGap,gap);assert(gap>3,id+' actual tail ink stays clear of the head');
        }
      }
      previous={...state.pose};
    }
    assert(maxStep<2.5,id+' no joint snap');assert(maxBody-minBody>20,id+' meaningful climb/dive response');
    assert(maxTail-minTail>15,id+' tail root remains animated');
    const unchanged=structuredClone(state);for(const [dt,v] of [[0,0],[-1,0],[NaN,0],[.01,NaN]])M.stepHighOrbit(state,id,dt,v);
    assert.deepEqual(state,unchanged,id+' paused or invalid input does not advance');
    const rates=[30,60,120].map(fps=>{
      const s=M.createHighOrbitMotion(id);for(let tick=0;tick<fps*6;tick++)M.stepHighOrbit(s,id,1/fps,tick<fps*2?-420:tick<fps*4?0:610);return s;
    });
    for(const s of rates.slice(1))for(const key of Object.keys(s.pose))assert(Math.abs(s.pose[key]-rates[0].pose[key])<.7,id+' frame-rate-independent '+key);

    // The low-level and shipping live painters must reject helmet overlays,
    // including when only the fallback portrait has arrived over the network.
    for(const bank of [art,noAtlas]){
      const base=createCanvas(256,256);R.paintHighOrbit(base.getContext('2d'),bank,id,128,128,192,state,undefined,false);
      for(const helmet of Cat.HELMETS){
        let calls=0;const direct=createCanvas(256,256);
        R.paintHighOrbit(direct.getContext('2d'),bank,id,128,128,192,state,undefined,false,0,()=>calls++);
        assert.equal(calls,0,id+' never invokes a helmet-overlay callback');
        const live=createCanvas(256,256);D.paintOrbitPilot(live.getContext('2d'),bank,id,128,128,192,helmet,state,undefined,false);
        assert.deepEqual(rgba(live),rgba(base),id+' live fixed head unchanged by '+helmet.id);
      }
      let firstPreview;
      for(const helmet of Cat.HELMETS){
        const preview=createCanvas(256,256);D.paintFlightPreview(preview.getContext('2d'),bank,suit,helmet,128,128,192,2.4);
        if(!firstPreview)firstPreview=rgba(preview);else assert.deepEqual(rgba(preview),firstPreview,id+' preview fixed head unchanged by '+helmet.id);
      }
    }
    const cockpit=createCanvas(80,80),cg=cockpit.getContext('2d');R.paintHighOrbitCockpit(cg,art,id,40,40,32,32);
    const expected=createCanvas(80,80),eg=expected.getContext('2d'),scale=32*.96/skull[2];
    eg.beginPath();eg.ellipse(40,40,32,32,0,0,Math.PI*2);eg.clip();eg.drawImage(atlas,0,0,256,256,40-skull[0]*scale,40-skull[1]*scale,256*scale,256*scale);
    assert.deepEqual(rgba(cockpit),rgba(expected),id+' cockpit uses exactly the authored integrated or bare head');
    assert(components(rgba(cockpit),80,80)[0]>1000,id+' cockpit head visible');
    const wake=createCanvas(80,40);E.paintHighOrbitWake(wake.getContext('2d'),id,40,20,0);
    assert(rgba(wake).some((value,i)=>i%4===3&&value>100),id+' signature wake visible at first paint');
    // Native canvas may accept negative radii that Chrome rejects. Repaint
    // between emission samples to catch stale wake points at their expiry.
    const effect=createCanvas(256,256),native=effect.getContext('2d');
    const strict=new Proxy(native,{get(target,key){
      const value=Reflect.get(target,key,target);
      if(['ellipse','arc','createRadialGradient'].includes(key))return(...args)=>{
        assert(args.filter(v=>typeof v==='number').every(Number.isFinite),id+' finite '+key+' geometry');
        const radii=key==='ellipse'?[args[2],args[3]]:key==='arc'?[args[2]]:[args[2],args[5]];
        assert(radii.every(v=>v>=0),id+' browser-valid '+key+' radii');
        return value.apply(target,args);
      };
      return typeof value==='function'?value.bind(target):value;
    },set(target,key,value){return Reflect.set(target,key,value,target);}});
    const effectState=M.createHighOrbitMotion(id);
    for(let tick=0;tick<720;tick++){
      M.stepHighOrbit(effectState,id,1/240,tick%180<60?-420:610);
      const j=R.highOrbitLandmarks(id,effectState.pose);native.clearRect(0,0,256,256);
      E.paintHighOrbitEffect(strict,id,effectState,192,[j.nearBoot,j.farBoot],{x:128,y:128,travel:effectState.time*360});
    }

    for(const [row,v] of [-420,0,610].entries()){
      const pose=M.createHighOrbitMotion(id);for(let i=0;i<240;i++)M.stepHighOrbit(pose,id,1/120,v);
      const cx=column*320+160,cy=row*300+145;
      R.paintHighOrbit(cc,art,id,cx,cy,192,pose,undefined,false);
      cc.fillStyle='#e4e9f5';cc.font='16px sans-serif';cc.fillText(suit.name,column*320+16,row*300+28);
      cc.fillStyle='#a6b4d0';cc.font='13px sans-serif';cc.fillText(['Climb','Glide','Dive'][row]+' / canonical 192px',column*320+16,row*300+50);
      R.paintHighOrbit(cc,art,id,column*320+48,row*300+266,52,pose,undefined,false);
      cc.fillText('52px flight size',column*320+85,row*300+272);
    }
    const cx=column*320+160;cc.drawImage(art.suits[id],cx-128,912,192,192);
    R.paintHighOrbitCockpit(cc,art,id,cx+85,1002,35,35);
    cc.fillStyle='#e4e9f5';cc.font='13px sans-serif';cc.fillText(Cat.fixedHeadLine(suit),column*320+16,1152);
    cc.fillStyle='#a6b4d0';cc.fillText('Fallback portrait / cockpit crop',column*320+16,1176);
    results.push({id,partInk:partInk.slice(0,11),ticks:960,paintedSamples:80,maxGreenExcess,browserWakeSamples:720,maxJointStep:maxStep,minJointCoverage:minJoint,maxDetachedPixels:maxDetached,minHeadTailGap:minHeadGap,bodyRange:maxBody-minBody,tailRootRange:maxTail-minTail,tailAreaRatio:[minArea,maxArea],...(id==='origamist'?{maxRigidTailDistanceError:maxRigidError}:{}),helmetsChecked:Cat.HELMETS.length,headPolicy:suit.headPolicy});
  }
  const out=root+'illustrated-src/design/premium-pilots/';mkdirSync(out,{recursive:true});
  writeFileSync(out+'production-review.png',contact.toBuffer('image/png'));
  writeFileSync(out+'regression.json',JSON.stringify({passed:true,scope:'Shipping atlas, rig, live/preview/fallback/cockpit fixed-head behavior; visual quality requires human review',results},null,2)+'\n');
  console.log(JSON.stringify({suite:'premium pilot render',passed:true,results},null,2));
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
  const Sim=await import('../docs/js/sim.js'),Race=await import('../docs/js/race.js');
  const save=S.defaultSave();Object.assign(save,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true});S.writeSave(save);
  const {bootStandalone}=await import('../docs/js/standalone.js');const app=document.createElement('main');document.body.append(app);await bootStandalone(app);const e=win.__sandbox;assert(e);
  e.save.unlocked.push('ion');e.save.equipped='ion';e.save.unlockedTrails.push('ion');e.save.equippedTrail='ion';
  const clock=Date.now;
  try{
    for(const day of [0,17]){
      Date.now=()=>1_800_000_000_000+day*86400000;e.open('shop');
      const listed=[...app.querySelectorAll('.ac-shoptile .ac-tilename')].map(node=>node.textContent);
      for(const id of ids)assert(listed.includes(C.SUITS.find(s=>s.id===id).name),id+' available on actual storefront day '+day);
    }
  }finally{Date.now=clock;}
  const results=[];
  for(const id of ids){
    const suit=C.SUITS.find(s=>s.id===id),bundle=C.BUNDLES.find(b=>b.id==='bundle-'+id),trail=Config.HIGH_ORBIT_PROFILES[id].trail;
    assert(suit&&bundle,id+' present on '+mode);assert(C.wearsOwnHead(suit),id+' never uses interchangeable helmets');
    assert.equal(suit.headPolicy,id==='nacre'?'helmetless':'integrated');
    assert.equal(suit.fixedHelmet,id==='porcelain'?'Sovereign Shell':id==='origamist'?'Facet Shell':undefined);
    assert(bundle.fixed,id+' fixed premium pack');assert.deepEqual(bundle.items,[{kind:'suit',id}]);assert.deepEqual(C.bundleIds(bundle),[id]);
    assert.equal(bundle.dust,2500,id+' owner-confirmed Stardust price');
    assert.equal(C.idDust(id),bundle.dust,id+' singleton and bundle agree');assert(bundle.dust>C.idDust('arcflash'),id+' premium tier above Arcflash');
    assert(C.IAP_ITEMS.includes(id));assert(!C.IAP_ITEMS.includes(trail),'wake is included, never sold separately');
    assert(!C.HELMETS.some(h=>h.id===id),id+' has no detachable helmet SKU');
    assert(!S.suitRevealed(e.save,id)&&!S.trailUnlocked(e.save,trail),id+' not freely owned on '+mode);
    assert.equal(e.buySuit(id),'locked');assert.equal(e.buyTrail(trail),'locked');
    e.save.starDust=bundle.dust-1;const beforePoor=JSON.stringify(e.save);assert.equal(e.buyBundle(bundle.id),'poor');assert.equal(JSON.stringify(e.save),beforePoor,'unfunded purchase has no side effects');
    // Exercise the real storefront card and cart button, then restore this
    // synthetic fixture to independently exercise the bundle transaction.
    const beforeShop=structuredClone(e.save);e.save.starDust=bundle.dust;e.open('shop');
    const tile=[...app.querySelectorAll('.ac-shoptile')].find(node=>node.querySelector('.ac-tilename')?.textContent===suit.name);assert(tile,id+' real shop tile');tile.click();
    assert(app.textContent.includes(C.fixedHeadTag(suit)),id+' shop preview states fixed head rule');
    assert.equal(e.save.equipped,'ion','trying a suit never overwrites selected helmet');
    const checkout=app.querySelector('.ac-combobuy');assert(checkout,id+' can be placed in cart');checkout.click();
    assert.equal(e.save.starDust,0,id+' actual storefront charges its advertised sticker');assert(S.suitRevealed(e.save,id)&&S.trailUnlocked(e.save,trail));
    Object.assign(e.save,beforeShop);
    e.save.starDust=bundle.dust;assert.equal(e.buyBundle(bundle.id),'ok');assert.equal(e.save.starDust,0);
    assert(S.suitRevealed(e.save,id)&&S.trailUnlocked(e.save,trail));assert.equal(e.buyBundle(bundle.id),'owned');assert.equal(e.save.starDust,0);
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
    assert.equal(Sim.flap(w,e.save),'flap');for(let i=0;i<18;i++)Sim.updateWorld(w,e.save,1/60);assert(w.highOrbit.time>.25,id+' accepted flight input advances the rig');
    for(const hold of ['pause','shield','warp','stuck']){
      const before=JSON.stringify(w.highOrbit);if(hold==='pause')w.screen='pause';if(hold==='shield')w.shieldFreeze=.3;if(hold==='warp')w.warpT=.3;if(hold==='stuck')w.stuck=true;
      Sim.updateWorld(w,e.save,1/60);assert.equal(JSON.stringify(w.highOrbit),before,id+' '+hold+' holds pose');w.screen='play';w.shieldFreeze=0;w.warpT=0;w.stuck=false;
    }
    const small=Sim.makeWorld(390,844),large=Sim.makeWorld(900,900),authority=Race.createRaceState(),input={held:true,boost:false};
    for(const world of [small,large]){Sim.resetRun(world,e.save,'fly',false);world.race=Race.createRaceState();Sim.setRaceInput(world,input);}Race.queueRaceInput(authority,input);
    for(let i=0;i<20;i++){Sim.updateWorld(small,e.save,1/120);Sim.updateWorld(large,e.save,1/30);Race.stepRace(authority);}
    assert.deepEqual(small.race,authority,id+' cosmetic rig leaves race authority unchanged');assert.deepEqual(small.highOrbit,large.highOrbit,id+' race motion independent of viewport');
    results.push({id,price:bundle.dust,headPolicy:suit.headPolicy,wake:trail});
  }
  // A previously selected matched helmet also survives a fixed-head detour.
  const matched=C.HELMETS.find(h=>h.suitOnly);assert(matched);
  e.save.purchased.push(matched.id,matched.suitOnly);e.save.equippedSuit=matched.suitOnly;e.save.equipped=matched.id;
  for(const id of ids){assert.equal(e.buySuit(id),'equip');assert.equal(e.save.equipped,matched.id);S.writeSave(e.save);assert.equal(S.loadSave().equipped,matched.id,'reload preserves a temporarily hidden matched helmet');}
  assert.equal(e.buySuit(matched.suitOnly),'equip');assert.equal(e.save.equipped,matched.id,'original outfit restores original matched helmet');
  e.save.equipped='ion';assert.equal(e.buySuit('flight'),'equip');assert.equal(e.save.equipped,'ion');assert.equal(e.save.equippedTrail,'ion');
  // Old saves need no premium fields. Existing progress/ownership must survive.
  const premiumDust=C.BUNDLES.filter(b=>ids.includes(b.items[0]?.id)&&b.items.length===1).reduce((n,b)=>n+b.dust,0);
  const old=S.defaultSave();Object.assign(old,{tutorialDone:true,guide:'done',equipped:'ion',unlocked:['clear','ion'],equippedSuit:'flight',acorns:14731,starDust:419,betaDustGrant:true,betaDustGrantTotal:C.BUNDLES.reduce((n,b)=>n+b.dust,0)-premiumDust,purchased:['arcflash'],receipts:['premium-regression-legacy']});
  S.writeSave(old);const loaded=S.loadSave();for(const field of ['equipped','equippedSuit','acorns'])assert.equal(loaded[field],old[field],'old save preserves '+field);
  assert.equal(loaded.starDust,old.starDust+(mode==='beta'?premiumDust:0),'existing beta testers receive only the new content top-up; production currency is unchanged');
  assert(loaded.purchased.includes('arcflash'));assert(loaded.receipts.includes('premium-regression-legacy'));
  for(const id of ids)assert(!S.suitRevealed(loaded,id),'old save gains no unbought '+id);
  const urls=[];globalThis.Image=class {naturalWidth=1024;naturalHeight=768;set src(value){urls.push(value);queueMicrotask(()=>this.onload?.());}};
  const Art=await import('../docs/js/art.js?premium-loader');
  for(const id of ids){const bank={};await Art.loadSuitBank(bank,id);assert(bank.highOrbit?.[id]);assert(urls.some(url=>url.includes(`/suits/${id}/parts.png?v=${C.ART_VER}`)),id+' versioned production atlas loaded');}
  console.log(JSON.stringify({suite:'premium pilot '+mode,passed:true,results},null,2));
  process.exit(0);
}
