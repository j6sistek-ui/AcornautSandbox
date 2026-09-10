#!/usr/bin/env node
// Exercise the real shop and entitlement paths at the owner's release prices.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const mode=process.argv[2],ids=['porcelain','nacre','origamist'];
if(!mode){
  for(const page of ['production','beta'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),page],{stdio:'inherit'});
  process.exit(0);
}
assert(['production','beta'].includes(mode));
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM||'happy-dom');
const win=new Window({url:`http://local/${mode==='beta'?'beta/':''}`});win.__ACORNAUT_BETA__=mode==='beta';
const backgrounds=new WeakMap(),bg=Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype,'backgroundImage');
Object.defineProperty(win.CSSStyleDeclaration.prototype,'backgroundImage',bg&&bg.set?{...bg,set(value){backgrounds.set(this,value);bg.set.call(this,value);}}:{configurable:true,get(){return backgrounds.get(this)??'';},set(value){backgrounds.set(this,value);}});
for(const key of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])
  Object.defineProperty(globalThis,key,{value:key==='window'?win:win[key],configurable:true,writable:true});
globalThis.performance={now:()=>0};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
win.requestAnimationFrame=requestAnimationFrame;win.cancelAnimationFrame=cancelAnimationFrame;
globalThis.Image=class {set src(value){queueMicrotask(()=>this.onerror?.());}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=()=>ctx;
win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:390,height:500,right:390,bottom:500};};
win.HTMLElement.prototype.scrollIntoView=function(){};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const C=await import('../docs/js/catalog.js'),S=await import('../docs/js/save.js'),H=await import('../docs/js/high-orbit-config.js');
const {selectShopCycle}=await import('../docs/js/shop-cycle.js');
const initial=S.defaultSave();Object.assign(initial,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true});S.writeSave(initial);
const {bootStandalone}=await import('../docs/js/standalone.js'),app=document.createElement('main');document.body.append(app);await bootStandalone(app);
const e=win.__sandbox;assert(e);const baseline=structuredClone(e.save),trio=C.BUNDLES.find(b=>b.id==='bundle-premium-trio');
assert(trio);assert.deepEqual(trio.items,ids.map(id=>({kind:'suit',id})));assert.equal(trio.dust,2500);
assert.equal(trio.alwaysAvailable,true,'trio has a permanent offer alongside its singles');
assert.equal(C.featurePrice(trio,()=>false),2500,'trio retains its owner-set price');
assert.equal(C.alaCarteTotal(ids,()=>false),3000,'three separately purchased suits cost 3,000');
for(const id of ids){
  assert(C.FIXED_SHOP_SUIT_IDS.includes(id),id+' retains its fixed individual price');
  assert(C.isIap(id),id+' remains purchasable without a singleton bundle');assert.equal(C.idDust(id),1000);
  assert(!C.BUNDLES.some(b=>b.items.length===1&&b.items[0].id===id),'individual pilots are not advertised as bundles');
}
const reset=()=>{Object.assign(e.save,structuredClone(baseline));e.open('hangar');e.open('shop');app.querySelector('.ac-cartclear')?.click();};
const ownsAll=save=>ids.every(id=>S.suitRevealed(save,id)&&S.trailUnlocked(save,H.HIGH_ORBIT_PROFILES[id].trail));
const trioCard=()=>app.querySelector('[data-bundle-id="bundle-premium-trio"]');
const singleTile=id=>[...app.querySelectorAll('.ac-shoptile')].find(node=>node.querySelector('.ac-tilename')?.textContent===C.SUITS.find(s=>s.id===id).name);
const clock=Date.now;
try{
  // The pack stays available; one premium single rotates alongside a cheaper suit.
  const days=[20000,20001,20017,20101],dailyFeatures=new Set();
  let day=days[0];Date.now=()=>day*86400000+3600000;
  for(day of days){
    reset();
    assert.equal(trioCard()?.querySelector('.ac-modname')?.textContent,'Premium Trio','compact trio offer appears every sampled day');
    assert(trioCard()?.querySelector('.ac-modprice')?.textContent.includes('2,500'),'permanent card advertises 2,500');
    assert.equal(trioCard().previousElementSibling?.textContent,'PREMIUM PILOT BUNDLE');
    const daily=[...app.querySelectorAll('.ac-featurecard')].filter(node=>node.dataset.bundleId!==trio.id);
    assert.equal(daily.length,1,'the regular daily feature remains beside the permanent trio');
    assert.equal(daily[0].previousElementSibling?.textContent,'FEATURED PACK');
    dailyFeatures.add(daily[0].dataset.bundleId);
    const cycle=selectShopCycle(day,id=>S.ownsPremium(e.save,id));
    for(const id of ids)assert.equal(!!singleTile(id),cycle.suits.includes(id),id+' follows its daily individual slot');
  }
  assert(dailyFeatures.size>1,'daily feature still rotates while the trio stays available');
  for(const id of ids){
    reset();e.save.starDust=1000;
    day=Array.from({length:366},(_,i)=>20000+i).find(d=>selectShopCycle(d,item=>S.ownsPremium(e.save,item)).suits.includes(id));
    assert(Number.isInteger(day),id+' reaches the daily premium slot');e.open('shop');
    const tile=singleTile(id);
    assert(tile,id+' remains individually available alongside its trio pack');
    assert(tile.querySelector('.ac-tileprice')?.textContent.includes('1,000'),id+' single tile shows 1,000');tile.click();
    const checkout=app.querySelector('.ac-combobuy');assert(checkout,id+' can still enter the single-item cart');checkout.click();
    assert.equal(e.save.starDust,0,id+' real single checkout charges 1,000');
    assert(S.suitRevealed(e.save,id)&&S.trailUnlocked(e.save,H.HIGH_ORBIT_PROFILES[id].trail),id+' purchase includes its wake');
    assert(ids.filter(other=>other!==id).every(other=>!S.suitRevealed(e.save,other)),id+' singleton does not grant other pilots');
  }
  reset();e.save.starDust=2500;
  trioCard().click();
  assert(app.querySelector('.ac-featuresheet')?.textContent.includes('available individually'),'pack detail preserves the separate option');
  assert.equal(app.querySelector('.ac-featuresheet .ac-kicker')?.textContent,'PREMIUM PILOT BUNDLE');
  day++;e.open('shop');
  assert(app.querySelector('.ac-featuresheet')?.textContent.includes(trio.name),'trio detail remains open across the daily rollover');
  app.querySelector('.ac-featurebuy').click();app.querySelector('.ac-featurebuy').click();
  assert.equal(e.save.starDust,0,'real permanent-pack checkout charges exactly 2,500');assert(ownsAll(e.save),'real trio purchase grants all pilots and wakes');
  assert.equal(trioCard(),null,'the fully owned trio is no longer offered for purchase');
  S.writeSave(e.save);assert(ownsAll(S.loadSave()),'all trio entitlements survive reload');

  // Ownership credit is consistent across direct and featured transactions.
  for(let mask=0;mask<8;mask++){
    const owned=ids.filter((id,i)=>mask&(1<<i)),expected=[2500,1500,500,0][owned.length];
    for(const path of ['buyBundle','buyFeature']){
      day=days[mask%days.length];reset();e.save.purchased.push(...owned);e.open('shop');const has=id=>owned.includes(id);
      assert.equal(C.bundlePrice(trio,has),expected);assert.equal(C.featurePrice(trio,has),expected);
      if(expected){
        assert(trioCard()?.querySelector('.ac-modprice')?.textContent.includes(expected.toLocaleString()),'permanent offer shows the correct ownership credit');
        const cycle=selectShopCycle(day,id=>S.ownsPremium(e.save,id));
        for(const id of ids.filter(id=>!has(id))){
          assert.equal(!!singleTile(id),cycle.suits.includes(id),id+' follows the daily slot under partial ownership');
          assert(Array.from({length:366},(_,i)=>20000+i).some(d=>selectShopCycle(d,item=>S.ownsPremium(e.save,item)).suits.includes(id)),id+' still reaches an individual slot under partial ownership');
        }
      }else assert.equal(trioCard(),null,'fully owned permanent pack leaves the shelf');
      if(expected){e.save.starDust=expected-1;const before=JSON.stringify(e.save);assert.equal(e[path](trio.id),'poor');assert.equal(JSON.stringify(e.save),before,'unfunded pack leaves the save unchanged');}
      e.save.starDust=expected;assert.equal(e[path](trio.id),expected?'ok':'owned');assert.equal(e.save.starDust,0);assert(ownsAll(e.save));
      assert.equal(e[path](trio.id),'owned');assert.equal(e.save.starDust,0,'repeat purchase cannot charge again');
    }
  }
  // The original individual product identifiers still grant their suit.
  for(const id of ids){reset();e.save.starDust=1000;assert.equal(e.buyShopItem(id),'ok');assert.equal(e.save.starDust,0);assert(S.suitRevealed(e.save,id));}
}finally{Date.now=clock;}
console.log(`PASS premium pricing ${mode}: daily 1,000 singles and permanent 2,500 trio, independent daily feature, date rollover, actual cart/pack checkouts, all ownership subsets, included wakes, reload and repeat-purchase protection.`);
process.exit(0);
