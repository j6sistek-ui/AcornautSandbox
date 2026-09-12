#!/usr/bin/env node
// Generated replacement banks through the shipping renderer and real
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
  // The retired sixteen-frame atlas is not a live renderer receipt. Run the
  // actual standard pilot painter against Cyber's frozen trace for every
  // replacement, including all helmets, previews, cockpit and wake emitters.
  for(const id of ids)execFileSync(process.execPath,[root+'illustrated-src/test-gold-standard.mjs'],{
    stdio:'inherit',env:{...process.env,ACORNAUT_GOLD_SUIT:id},
  });
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
    assert.equal(Sim.flap(w,e.save),'flap');for(let i=0;i<18;i++)Sim.updateWorld(w,e.save,1/60);assert(w.highOrbit.time>.25&&w.highOrbit.frames===undefined&&w.tapAnimT>=0,id+' accepted input advances the standard tap and cosmetic wake');
    for(const hold of ['pause','shield','warp','stuck']){
      const before=JSON.stringify(w.highOrbit);if(hold==='pause')w.screen='pause';if(hold==='shield')w.shieldFreeze=.3;if(hold==='warp')w.warpT=.3;if(hold==='stuck')w.stuck=true;
      Sim.updateWorld(w,e.save,1/60);assert.equal(JSON.stringify(w.highOrbit),before,id+' '+hold+' holds pose');w.screen='play';w.shieldFreeze=0;w.warpT=0;w.stuck=false;
    }
    const small=Sim.makeWorld(390,844),large=Sim.makeWorld(900,900),authority=Race.createRaceState(),input={held:true,boost:false};
    for(const world of [small,large]){Sim.resetRun(world,e.save,'fly',false);world.race=Race.createRaceState();Sim.setRaceInput(world,input);}Race.queueRaceInput(authority,input);
    for(let i=0;i<20;i++){Sim.updateWorld(small,e.save,1/120);Sim.updateWorld(large,e.save,1/30);Race.stepRace(authority);}
    assert.deepEqual(small.race,authority,id+' cosmetic playback leaves race authority unchanged');assert.deepEqual(small.highOrbit,large.highOrbit,id+' race playback independent of viewport');
    assert(small.highOrbit.time>0&&small.highOrbit.frames===undefined,id+' race wake never activates retired playback');
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
  const pending=[],urls=[];globalThis.Image=class {naturalWidth=256;naturalHeight=256;width=256;height=256;set src(value){this.url=value;urls.push(value);pending.push(this);}};
  const Art=await import('../docs/js/art.js?premium-loader');
  async function finishLoad(loading,fail){
    let done=false;loading.finally(()=>done=true);
    while(!done){await Promise.resolve();for(const image of pending.splice(0)){
      if(fail==='network'&&image.url.includes('-desc-5.'))image.onerror();
      else{if(fail==='dimensions'&&image.url.includes('-asc-4.'))image.naturalWidth=image.width=1024;image.onload();}
    }}
    await loading;
  }
  for(const id of ids){
    const bank=Art.emptyArt();
    for(const failure of ['network','dimensions']){
      const loading=Art.loadSuitBank(bank,id);assert.equal(Art.loadSuitBank(bank,id),loading,id+' shares concurrent bank loads');
      assert(!bank.suitAsc[id]&&!bank.suitDesc[id],id+' no partially decoded ramp');await finishLoad(loading,failure);
      assert(!bank.suitAsc[id]&&!bank.suitDesc[id],id+' failed frame does not shift indices');
    }
    const loading=Art.loadSuitBank(bank,id);await finishLoad(loading);
    assert.equal(bank.suitAsc[id].length,9);assert.equal(bank.suitDesc[id].length,9);
    assert(bank.suitBody[id]&&bank.suitTail[id],id+' standard still rig loaded');
    assert(!bank.premiumFlight?.[id]&&!bank.highOrbit?.[id],id+' no legacy atlas or cut rig');
    assert(!urls.some(url=>url.includes(`/suits/${id}/flight.png`)),id+' retired sixteen-frame atlas never requested');
    for(const kind of ['asc','desc'])for(let frame=1;frame<=9;frame++)assert(urls.some(url=>url.includes(`/suits/${id}-${kind}-${frame}.png?v=${C.ART_VER}`)),id+' versioned '+kind+frame);
  }
  console.log(JSON.stringify({suite:'premium pilot '+mode,passed:true,results},null,2));
  process.exit(0);
}
