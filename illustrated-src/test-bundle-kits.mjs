#!/usr/bin/env node
// Retained kit offers keep the shipping no-ownership prices; ownership credits
// full individual retail. Exercise all recorded ownership subsets and
// the real engine against isolated in-memory storage, never a player save.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM||'happy-dom');
const win=new Window({url:'http://bundle-kit-test.local/'});
const betaGrantMode=process.argv.includes('--beta-grant');
win.__ACORNAUT_BETA__=betaGrantMode;
const memory=new Map();
win.__acornautPlatform={kind:'web',devDoors:false,storage:{get:key=>memory.get(key)??null,set:(key,value)=>memory.set(key,value),remove:key=>memory.delete(key)}};
for(const key of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])
  Object.defineProperty(globalThis,key,{value:key==='window'?win:win[key],configurable:true,writable:true});
globalThis.performance={now:()=>0};
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
win.requestAnimationFrame=requestAnimationFrame;win.cancelAnimationFrame=cancelAnimationFrame;
globalThis.Image=class {set src(value){queueMicrotask(()=>this.onerror?.());}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
// Pricing never needs raster output or a running animation loop.
const ctx=new Proxy({measureText:text=>({width:text.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=()=>ctx;
win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:390,height:844,right:390,bottom:844};};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};
win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};

// Use the exact cache-stamped catalog imported by the generated save and
// engine modules. Node treats a bare import and ?v= import as separate
// instances, which would make deliberate test-local kit edits ineffective.
const saveUrl=new URL('../docs/js/save.js',import.meta.url);
const catalogImport=readFileSync(saveUrl,'utf8').match(/from "(\.\/catalog\.js[^\"]*)";/);
assert(catalogImport,'the generated save has a catalog dependency');
const C=await import(new URL(catalogImport[1],saveUrl).href);
const S=await import('../docs/js/save.js');
if(betaGrantMode){
  assert.equal(S.BETA_DUST_GRANT_FLOOR,12360);
  assert.equal(S.BETA_LEGACY_DUST_GRANT_TOTAL,7510);
  assert.equal(S.betaDustGrantTarget(),12360,'regrouping preserves the current beta funding target');
  const scenarios=[
    {name:'fresh',grant:false,total:undefined,expected:12397,recorded:12360},
    {name:'current recorded',grant:true,total:12360,expected:37,recorded:12360},
    {name:'larger recorded',grant:true,total:15000,expected:37,recorded:15000},
    {name:'old recorded',grant:true,total:7510,expected:4887,recorded:12360},
    {name:'old unrecorded',grant:true,total:undefined,expected:4887,recorded:12360},
  ];
  for(const scenario of scenarios){
    const raw=S.defaultSave();Object.assign(raw,{starDust:37,betaDustGrant:scenario.grant,betaDustGrantTotal:scenario.total,purchased:[...C.FIXED_SHOP_SUIT_IDS]});
    S.writeSave(raw);const loaded=S.loadSave();
    assert.equal(loaded.starDust,scenario.expected,scenario.name+' gets exactly its historical grant difference');
    assert.equal(loaded.betaDustGrantTotal,scenario.recorded);
    assert(C.FIXED_SHOP_SUIT_IDS.every(id=>S.ownsPremium(loaded,id)),'regrouping keeps existing single-item entitlements');
    S.writeSave(loaded);assert.equal(S.loadSave().starDust,scenario.expected,scenario.name+' is idempotent on reload');
  }
  const oldSticker=C.DUST_STICKER.arcflash;
  try{
    C.DUST_STICKER.arcflash=oldSticker+20000;   // well past the 12,360 floor now that prices are a tenth (13 Sep 2026)
    const target=S.betaDustGrantTarget();assert(target>12360,'future funding accounts for fixed singles outside bundles');
    const raw=S.defaultSave();Object.assign(raw,{starDust:37,betaDustGrant:true,betaDustGrantTotal:12360});
    S.writeSave(raw);const loaded=S.loadSave();assert.equal(loaded.starDust,37+target-12360);S.writeSave(loaded);
    C.DUST_STICKER.arcflash=oldSticker;
    assert.equal(S.loadSave().starDust,loaded.starDust,'a later lower target never deducts an already recorded grant');
  }finally{C.DUST_STICKER.arcflash=oldSticker;}
  await win.happyDOM.close();
  console.log(JSON.stringify({suite:'bundle regrouping beta grant compatibility',scenarios:scenarios.length,result:'PASS'}));
  process.exit(0);
}
execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--beta-grant'],{stdio:'inherit'});
const untouched=S.defaultSave();Object.assign(untouched,{starDust:37,betaDustGrant:false});S.writeSave(untouched);
assert.equal(S.loadSave().starDust,37,'the beta funding floor never applies in production');
const snapshot=JSON.parse(readFileSync(new URL('./design/shop-refresh/baseline.json',import.meta.url),'utf8'));
const none=()=>false;
assert.equal(snapshot.provenance.revision,'d296e6bc404aaec14221a8b79186132fb4426dea');
const retained=['bundle-premium-trio','bundle-aurora','bundle-regalia','bundle-circuit','bundle-critters'];
const collections={
  'bundle-cosmic-companions':{kind:'pal',name:'Cosmic Companions',ids:['magnetar','babyalien','satellite']},
  'bundle-starlight-companions':{kind:'pal',name:'Starlight Companions',ids:['spacepuppy','astrafox','switchback']},
  'bundle-visor-collection':{kind:'helm',name:'Visor Collection',ids:['amethyst','ivoryguard','reactor']},
};
const retired=snapshot.bundles.filter(b=>!retained.includes(b.id)).map(b=>b.id);
assert.equal(retired.length,15,'thirteen singleton offers and two duos are retired');
assert.deepEqual(C.BUNDLES.map(b=>b.id),[...retained,...Object.keys(collections)],'only the five retained kits and three actual collections remain');
assert.deepEqual(C.FIXED_SHOP_SUIT_IDS,['arcflash','porcelain','nacre','origamist']);
// The DUST in each pack is unchanged from the baseline; the DOLLAR sticker is
// half of it (owner, 12 Sep 2026: "cut the stardust cost in half globally in
// the store ... i meant the actual dollar values in half"). The web string is
// pinned here; the store tier is set by hand in App Store Connect / Play.
assert.deepEqual(C.DUST_PACKS.map(({price,acorns,...pack})=>pack),snapshot.stardustOffers.map(({totalGrant,price,...pack})=>pack),'cash offers keep their dust and bonus grants');
// the packs are bought with acorns while the store is off (owner, 13 Sep 2026: "1000 acorn = 500 star dust")
assert.equal(C.ACORNS_PER_DUST,2);for(const pack of C.DUST_PACKS)assert.equal(pack.acorns,pack.dust*C.ACORNS_PER_DUST,pack.id+' costs two acorns per base dust, bonus free');
assert.deepEqual(C.DUST_PACKS.map(pack=>pack.price),['$0.49','$2.49','$4.99','$9.99'],'pack stickers are half the baseline dollars');
assert.deepEqual(snapshot.stardustOffers.map(pack=>pack.price),['$0.99','$4.99','$9.99','$19.99'],'the baseline still records the pre-sale dollars');
// The owner replaced the old pinned shelf with a smaller daily roster.
// Its selection rules are tested independently by test-shop-cycle.mjs;
// this pricing regression still forbids separately sold bonus wakes.
assert.equal(C.SHOP_CYCLE.trails,0,'daily stock never sells free set or signature wakes');
assert.deepEqual([...C.IAP_ITEMS].sort(),snapshot.individualItems.map(item=>item.id).sort(),'all ownership atoms remain available after the bundle regrouping');
for(const item of snapshot.individualItems){
  // the baseline was re-priced on 13 Sep 2026 (owner: "lower the pack prices
  // a lot"): see provenance.repriced in baseline.json
  assert.equal(C.idDust(item.id),item.dust,item.id+' single price matches the re-priced baseline');
  assert.deepEqual(C.idGrants(item.id),item.grants,item.id+' keeps its set grants');
}

let quoteCases=0;
const expected=new Map();
for(const b of C.BUNDLES){
  const collection=collections[b.id];
  const prior=snapshot.bundles.find(x=>x.id===b.id)??{fullAlaCarteTotal:30,fullFeaturePrice:20};
  if(collection){
    assert.equal(b.name,collection.name);assert.equal(b.dust,20);
    assert.deepEqual(b.items,collection.ids.map(id=>({kind:collection.kind,id})),b.id+' groups exactly three former individual offers');
  }else for(const key of ['name','blurb','dust','items','fixed','featuredAtSticker','alwaysAvailable','keepSingles'])
    assert.deepEqual(b[key],prior[key],b.id+' preserves '+key);
  assert(C.bundleProductIds(b).length>=3,b.id+' has at least three distinct primary products');
  assert.deepEqual(b.kit,{banner:`shop/${b.id}.png`,discountDust:prior.fullAlaCarteTotal-prior.fullFeaturePrice},b.id+' has its intended retail discount');
  const quote=C.bundleQuote(b,none);
  assert.equal(quote.retail,prior.fullAlaCarteTotal);
  assert.equal(quote.offer,prior.fullFeaturePrice);
  assert.equal(quote.savings,b.kit.discountDust);
  assert.equal(quote.discountPercent,Math.round(1000*b.kit.discountDust/quote.retail)/10);
  if(!process.argv.includes('--pricing-only')){
    const png=readFileSync(new URL(`../docs/art/${b.kit.banner}`,import.meta.url));
    assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),b.id+' kit banner is a real PNG');
    assert(png.readUInt32BE(16)>0&&png.readUInt32BE(20)>0,b.id+' kit banner has nonzero dimensions');
  }
  const fixture=snapshot.ownershipPricing.find(x=>x.id===b.id)??{
    ownershipBitOrder:collection.ids,
    rows:Array.from({length:8},(_,mask)=>[mask,null,null,10*collection.ids.filter((_,bit)=>!(mask&(1<<bit))).length]),
  };
  const prices=new Map();
  for(const [mask,,,remainingRetail] of fixture.rows){
    const owned=new Set(fixture.ownershipBitOrder.filter((_,bit)=>mask&(1<<bit)));
    const owns=id=>owned.has(id);
    const credit=prior.fullAlaCarteTotal-remainingRetail;
    const due=Math.max(0,prior.fullFeaturePrice-credit);
    const actual=C.bundleQuote(b,owns);
    assert.deepEqual(actual,{retail:prior.fullAlaCarteTotal,offer:prior.fullFeaturePrice,credit,due,savings:b.kit.discountDust,discountPercent:quote.discountPercent},`${b.id} ownership mask ${mask}`);
    assert.equal(C.featurePrice(b,owns),due);
    assert.equal(C.bundlePrice(b,owns),due,'legacy checkout matches the current Shop');
    assert.equal(C.alaCarteTotal([...fixture.ownershipBitOrder,...fixture.ownershipBitOrder],owns),remainingRetail,'duplicate IDs do not duplicate retail or credit');
    const duplicate={...b,items:[...b.items,...b.items]};
    assert.deepEqual(C.bundleQuote(duplicate,owns),actual,'a repeated suit/helmet slot is not a second ownership charge');
    prices.set(mask,due);quoteCases++;
  }
  expected.set(b.id,{fixture,prices});
  // A publisher can edit one kit without changing any single-item price.
  const adjusted={...b,kit:{...b.kit,discountDust:Math.min(quote.retail,b.kit.discountDust+1)}};
  assert.equal(C.bundleQuote(adjusted,none).due,Math.max(0,quote.offer-1),'discount edits retain exact one-dust precision');
  const free={...b,kit:{...b.kit,discountDust:quote.retail}};
  assert.equal(C.bundleQuote(free,none).due,0,'a 100% discount is valid');
  assert.equal(C.bundleQuote(free,none).discountPercent,100);
  for(const discountDust of [-1,NaN,Infinity,-Infinity,quote.retail+1,0.5])
    assert.throws(()=>C.bundleQuote({...b,kit:{...b.kit,discountDust}},none),/Invalid bundle kit/,b.id+' invalid discount fails explicitly');
  assert.throws(()=>C.bundleQuote({...b,kit:undefined},none),/Invalid bundle kit/);
  assert.throws(()=>C.bundleQuote({...b,kit:{...b.kit,banner:'../outside.png'}},none),/Invalid bundle kit/);
}
assert.equal(quoteCases,440,'416 retained ownership cases plus three complete 8-case collections');
assert.equal(new Set(C.BUNDLES.map(b=>b.kit.banner)).size,C.BUNDLES.length,'every kit has its own banner path');
const trio=C.BUNDLES.find(b=>b.id==='bundle-premium-trio');
assert.equal(C.bundleQuote(trio,none).discountPercent,16.7,'the trio percentage is displayed to one decimal');
for(const items of [
  [{kind:'suit',id:'cryostar'}],
  [{kind:'suit',id:'cryostar'},{kind:'helm',id:'cryostar'},{kind:'trail',id:'celestialtide'}],
  [{kind:'suit',id:'cryostar'},{kind:'suit',id:'verdant'},{kind:'trail',id:'celestialtide'},{kind:'trail',id:'verdantflourish'}],
  [{kind:'suit',id:'porcelain'},{kind:'suit',id:'nacre'},{kind:'trail',id:'porcelainwake'}],
]){
  const invalid={...trio,kit:{...trio.kit,discountDust:0},items};
  assert(C.bundleProductIds(invalid).length<3);
  assert.throws(()=>C.bundleQuote(invalid,none),/Invalid bundle kit/,'shared heads and bonus trails cannot make a singleton or duo into a bundle');
}
assert.throws(()=>C.bundleQuote({...trio,items:[...trio.items,{kind:'trail',id:'porcelainwake'}]},none),
  /built-in wakes must not be listed as products/,'a valid bundle cannot charge separately for an inseparable signature wake');
for(const [ids,due] of [[[],250],[['porcelain'],150],[['porcelain','nacre'],50],[['porcelain','nacre','origamist'],0]])
  assert.equal(C.bundleQuote(trio,id=>ids.includes(id)).due,due,'each trio pilot credits its complete 100 retail value');

const initial=S.defaultSave();
Object.assign(initial,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true});
S.writeSave(initial);
const {createEngine}=await import('../docs/js/engine.js');
const canvas=document.createElement('canvas');document.body.append(canvas);
const engine=await createEngine(canvas);
const pristine=structuredClone(engine.save);
const reset=(owned,funds)=>{
  for(const key of Object.keys(engine.save))delete engine.save[key];
  Object.assign(engine.save,structuredClone(pristine),{purchased:[...owned],starDust:funds});
};
const equipped=()=>[engine.save.equippedSuit,engine.save.equippedHelmet,engine.save.equippedTrail,engine.save.equippedPal];
let purchases=0,zeroCompletions=0;
for(const b of C.BUNDLES){
  const {fixture,prices}=expected.get(b.id);
  for(const [mask] of fixture.rows){
    const owned=fixture.ownershipBitOrder.filter((_,bit)=>mask&(1<<bit));
    for(const method of ['buyBundle','buyFeature']){
      reset(owned,10000);
      const effectiveMask=fixture.ownershipBitOrder.reduce((value,id,bit)=>value|(S.ownsPremium(engine.save,id)?1<<bit:0),0);
      const due=prices.get(effectiveMask);
      assert.equal(C.bundleQuote(b,id=>S.ownsPremium(engine.save,id)).due,due);
      const allOwned=C.bundleIds(b).every(id=>S.ownsPremium(engine.save,id));
      if(!allOwned&&due>0){
        engine.save.starDust=due-1;const before=JSON.stringify(engine.save);
        assert.equal(engine[method](b.id),'poor');
        assert.equal(JSON.stringify(engine.save),before,'insufficient balance cannot mutate any save field');
      }
      engine.save.starDust=due;
      const before=JSON.stringify(engine.save),beforeEquipment=equipped();
      assert.equal(engine[method](b.id),allOwned?'owned':'ok');
      assert.equal(engine.save.starDust,allOwned?due:0,'zero-price completion never pays currency back');
      assert.deepEqual(equipped(),beforeEquipment,'buying a kit never equips its contents');
      if(allOwned)assert.equal(JSON.stringify(engine.save),before);
      else{
        const granted=[...new Set([...owned,...C.bundleIds(b).flatMap(C.idGrants)])];
        assert.deepEqual(engine.save.purchased,granted,'every listed ID and free set trail is granted once');
        const persisted=S.loadSave();
        for(const id of granted)assert(S.ownsPremium(persisted,id),id+' entitlement survives persistence');
        assert.equal(engine[method](b.id),'owned','repeat checkout is idempotent');
        assert.equal(engine.save.starDust,0);
        if(due===0)zeroCompletions++;
      }
      purchases++;
    }
  }
}
assert(zeroCompletions>0,'exercise incomplete kits fully covered by retail credit');
// A deliberately edited 100% kit goes through both real engine entry
// points. Restore the test-local catalog before any later assertion.
const oldDiscount=trio.kit.discountDust;
try{
  trio.kit.discountDust=C.bundleQuote(trio,none).retail;
  for(const method of ['buyBundle','buyFeature']){
    reset([],0);assert.equal(engine[method](trio.id),'ok');
    assert.equal(engine.save.starDust,0);assert(C.bundleIds(trio).every(id=>S.ownsPremium(engine.save,id)));
    assert.equal(engine[method](trio.id),'owned');
  }
}finally{trio.kit.discountDust=oldDiscount;}
for(const method of ['buyBundle','buyFeature']){
  for(const id of ['__missing__',...retired]){
    reset([],10000);const before=JSON.stringify(engine.save);
    assert.equal(engine[method](id),'missing',id+' is not a live bundle');assert.equal(JSON.stringify(engine.save),before);
  }
}
// Removing a bundle ID does not remove any product ownership or change its
// single price. These four suits are explicitly sold outside the kits.
for(const id of C.FIXED_SHOP_SUIT_IDS){
  reset([],C.idDust(id));assert.equal(engine.buyShopItem(id),'ok');
  assert.equal(engine.save.starDust,0);assert(S.ownsPremium(S.loadSave(),id));
  assert.equal(engine.buyShopItem(id),'owned');
}
engine.stop();await engine.artReady;await win.happyDOM.close();
console.log(JSON.stringify({suite:'bundle kit quotes and full ownership credit',bundles:C.BUNDLES.length,quoteCases,enginePurchaseCases:purchases,zeroCompletions,banners:process.argv.includes('--pricing-only')?'deferred':'verified',result:'PASS'}));
