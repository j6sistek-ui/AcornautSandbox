#!/usr/bin/env node
// Real Shop events and renderer output with local decoded artwork. This
// supplements browser layout review; happy-dom does not measure CSS layout.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const mode=process.argv[2],root=fileURLToPath(new URL('../',import.meta.url));
if(!mode){
  for(const page of ['production','beta','native'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),page],{stdio:'inherit'});
  process.exit(0);
}
assert(['production','beta','native'].includes(mode));
const trace=phase=>{if(process.env.ACORNAUT_SHOP_TRACE)console.log(`Shop visuals ${mode}: ${phase} (${Math.round(process.memoryUsage().rss/1_048_576)} MiB RSS)`);};
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM||'happy-dom');
const require=createRequire(import.meta.url),{createCanvas,Image:DecodedImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const win=new Window({url:`http://local/${mode==='beta'?'beta/':''}`});
win.__ACORNAUT_BETA__=mode==='beta';win.__ACORNAUT_ART__='/art';
const backgrounds=new WeakMap(),bg=Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype,'backgroundImage');
Object.defineProperty(win.CSSStyleDeclaration.prototype,'backgroundImage',bg&&bg.set
  ?{...bg,set(value){backgrounds.set(this,value);bg.set.call(this,value);}}
  :{configurable:true,get(){return backgrounds.get(this)??'';},set(value){backgrounds.set(this,value);}});
for(const key of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])
  Object.defineProperty(globalThis,key,{value:key==='window'?win:win[key],configurable:true,writable:true});
let now=0,nextFrame=0;const frames=new Map();
globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);win.requestAnimationFrame=requestAnimationFrame;win.cancelAnimationFrame=cancelAnimationFrame;
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
const decoded=new Map(),decodeReady=new Map();
function localImage(url){
  const pathname=new URL(url,'http://local/').pathname;
  assert(pathname.startsWith('/art/'),'image stays inside the shipping art directory');
  if(!decoded.has(pathname)){
    const bytes=readFileSync(root+'docs'+pathname),image=new DecodedImage();
    const ready=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
    image.src=bytes;decoded.set(pathname,image);decodeReady.set(pathname,ready);
  }
  return decoded.get(pathname);
}
globalThis.Image=class {
  set src(value){
    this.url=value;
    try{
      this.image=localImage(value);const path=new URL(value,'http://local/').pathname;
      decodeReady.get(path).then(()=>{this.width=this.naturalWidth=this.image.width;this.height=this.naturalHeight=this.image.height;this.complete=true;this.onload?.();},()=>this.onerror?.());
    }
    catch{queueMicrotask(()=>this.onerror?.());}
  }
  get src(){return this.url;}
};
const surfaces=new WeakMap();
let rasterMode=true;
const cheapContexts=new WeakMap();
function cheapContext(canvas){
  if(!cheapContexts.has(canvas))cheapContexts.set(canvas,new Proxy({canvas,globalAlpha:1,
    measureText:text=>({width:String(text).length*7}),createImageData:(w,h)=>({data:new Uint8ClampedArray(4),width:w,height:h}),
    getImageData:()=>({data:new Uint8ClampedArray(4)}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
  },{get:(target,key)=>key in target?target[key]:()=>{}}));
  return cheapContexts.get(canvas);
}
function surfaceOf(canvas){
  assert(Math.max(1,canvas.width)*Math.max(1,canvas.height)<=4_194_304,'native test canvases are bounded to product artwork and Shop previews');
  let entry=surfaces.get(canvas);
  if(!entry){
    const surface=createCanvas(Math.max(1,canvas.width),Math.max(1,canvas.height)),raw=surface.getContext('2d');
    const ctx=new Proxy(raw,{
      get(target,key){
        if(key==='canvas')return canvas;
        if(key==='drawImage')return (source,...args)=>{
          const child=source instanceof win.HTMLCanvasElement?surfaceOf(source):null;
          if(source.url)entry.sources.add(new URL(source.url,'http://local/').pathname);
          if(child)for(const path of child.sources)entry.sources.add(path);
          return target.drawImage(source.image??child?.surface??source,...args);
        };
        const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
      },
      set(target,key,value){return Reflect.set(target,key,value,target);},
    });
    entry={surface,ctx,sources:new Set()};surfaces.set(canvas,entry);
  }
  if(entry.surface.width!==Math.max(1,canvas.width))entry.surface.width=Math.max(1,canvas.width);
  if(entry.surface.height!==Math.max(1,canvas.height))entry.surface.height=Math.max(1,canvas.height);
  return entry;
}
win.HTMLCanvasElement.prototype.getContext=function(){return rasterMode?surfaceOf(this).ctx:cheapContext(this);};
win.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:390,height:500,right:390,bottom:500};};
win.HTMLElement.prototype.scrollIntoView=function(){};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};

const prices=new Map(),storeCalls=[];let resolvePurchase,restoreCalls=0;
if(mode==='native')win.__ACORNAUT_IAP__=true;   // the store scenarios are the store-back-on configuration (13 Sep 2026)
if(mode==='native')win.__acornautPlatform={kind:'ios',devDoors:false,store:{
  priceOf:id=>prices.get(id)??null,
  buy:id=>{storeCalls.push(id);return new Promise(resolve=>{resolvePurchase=resolve;});},
  async restore(){restoreCalls++;},async pending(){return [];},
}};
const C=await import('../docs/js/catalog.js'),S=await import('../docs/js/save.js');
const {selectShopCycle}=await import('../docs/js/shop-cycle.js');
const {STAR_UNLOCKS}=await import('../docs/js/campaign.js');
const initial=S.defaultSave();Object.assign(initial,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:false});S.writeSave(initial);
const {bootStandalone}=await import('../docs/js/standalone.js'),app=document.createElement('main');document.body.append(app);await bootStandalone(app);
const e=win.__sandbox;assert(e);await e.artReady;trace('shipping art loaded');const baseline=structuredClone(e.save);
const settle=async()=>{for(let i=0;i<3;i++){await Promise.all([...decodeReady.values()]);for(let j=0;j<12;j++)await Promise.resolve();}};
const tick=async(dt=170)=>{await settle();now+=dt;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(now);await settle();};
const button=(text,scope=app)=>[...scope.querySelectorAll('button')].find(node=>node.textContent===text);
const sheet=()=>app.querySelector('.ac-featuresheet');
const included=()=>sheet().querySelectorAll('.ac-shopincluded > button');
const close=()=>button('BACK',sheet()??app)?.click();
const reset=()=>{close();Object.assign(e.save,structuredClone(baseline));e.open('hangar');e.open('shop');app.querySelector('.ac-cartclear')?.click();};
const card=id=>app.querySelector(`[data-bundle-id="${id}"]`);
const itemKey=it=>`${it.kind}:${it.id}`;
function reviewItems(bundle){
  const items=[...bundle.items];
  for(const suit of bundle.items.filter(item=>item.kind==='suit')){
    const grants=C.idGrants(suit.id);
    for(const trail of C.TRAILS.filter(t=>grants.includes(t.id)||C.builtInTrailSuit(t.id)===suit.id)){
      if(!items.some(item=>item.kind==='trail'&&item.id===trail.id))items.push({kind:'trail',id:trail.id});
    }
  }
  return items;
}
function summaryOf(bundle){
  const labels={suit:'suit',helm:'helmet',trail:'wake',pal:'companion'};
  const parts=Object.entries(labels).flatMap(([kind,label])=>{const count=bundle.items.filter(i=>i.kind===kind).length;return count?[`${count} ${label}${count===1?'':'s'}`]:[];});
  const bonus=reviewItems(bundle).length-bundle.items.length;
  return parts.join(' · ')+(bonus?` + ${bonus} bonus wake${bonus===1?'':'s'}`:'');
}
function assertQuote(scope,bundle,owns){
  const quote=C.bundleQuote(bundle,owns),badge=scope.querySelector('.ac-offersavings'),credit=scope.querySelector('.ac-offercredit');
  assert.equal(quote.discountPercent,quote.retail>0?Math.round(quote.savings/quote.retail*1000)/10:0,bundle.id+' discount percentage retains one decimal of accuracy');
  if(scope.matches('.ac-featurecard')){
    assert.equal(scope.querySelector('.ac-modprice')?.textContent.trim(),quote.due.toLocaleString(),bundle.id+' card price uses the current quote');
    if(quote.savings>0)assert.equal(badge?.textContent,`${quote.discountPercent}% OFF`,bundle.id+' advertises the configured discount accurately');else assert(!badge);
    assert(!credit,bundle.id+' compact offer keeps ownership detail in its popup');
    if(quote.credit>0)assert(scope.getAttribute('aria-label')?.includes(quote.credit.toLocaleString()),bundle.id+' accessible offer names the owned-item credit');
    return quote;
  }
  if(quote.credit>0)assert(credit?.textContent.includes(quote.credit.toLocaleString()),bundle.id+' shows full owned-item credit');else assert(!credit,bundle.id+' has no ownership credit for an unowned pack');
  return quote;
}
const itemKeys=nodes=>[...nodes].map(node=>`${node.dataset.shopItemKind}:${node.dataset.shopItemId}`).sort();
const selected=()=>[...app.querySelectorAll('.ac-shopvisual > .ac-sheet-scroll .ac-shoptile[aria-pressed="true"]')].map(node=>node.textContent).sort();
const cartState=()=>({text:app.querySelector('.ac-combobar')?.textContent,selected:selected()});
const shopScroll=()=>app.querySelector('.ac-shopcompact > .ac-sheet-scroll');
const rail=()=>app.querySelector('[data-shop-rail="items"]');
const railItem=(kind,id)=>app.querySelector(`[data-shop-rail] button[data-shop-item-kind="${kind}"][data-shop-item-id="${id}"]`);
const railOffsets=()=>({outer:shopScroll().scrollTop,items:rail().scrollLeft});
const pickedRailIds=()=>[...app.querySelectorAll('[data-shop-rail] [aria-pressed="true"]')].map(n=>n.dataset.shopItemId).sort();
function assertCompactStructure(){
  const scroll=shopScroll(),viewer=app.querySelector('.ac-shopviewer');
  assert(scroll&&viewer,'compact Shop has its own viewer inside the page scroller');
  assert.equal(viewer.parentElement,scroll);
  assert(viewer.contains(rail()),'the mixed item rail belongs to the viewer');
  assert(viewer.contains(app.querySelector('.ac-caseplate')),'current preview details stay inside the viewer');
  assert.equal(app.querySelectorAll('[data-shop-rail]').length,1,'all daily items share one scrolling row');
  assert.equal(app.querySelectorAll('.ac-shopaccessoryrail,[data-shop-rail="accessories"],[data-shop-rail="suits"]').length,0,'no vertical or separate category rail remains');
  assert.equal(viewer.querySelectorAll('[role="tab"],[data-shop-filter]').length,0,'the daily row has no category filter');
  const suits=[...rail().querySelectorAll('button[data-shop-item-kind="suit"]')],accessories=[...rail().querySelectorAll('button[data-shop-item-kind]')].filter(n=>n.dataset.shopItemKind!=='suit');
  assert(suits.every(n=>n.dataset.shopItemKind==='suit'),'the suit rail only contains suit choices');
  assert(accessories.every(n=>['helm','pal'].includes(n.dataset.shopItemKind)),'helmets and optional pals share the gear rail');
  const cycle=selectShopCycle(day,id=>S.ownsPremium(e.save,id));
  assert.deepEqual(suits.map(n=>n.dataset.shopItemId),cycle.suits,'the live suit rail follows the date/ownership roster');
  assert.deepEqual(accessories.filter(n=>n.dataset.shopItemKind==='helm').map(n=>n.dataset.shopItemId),cycle.helms,'the live helmet rail follows the date/ownership roster');
  assert.deepEqual(accessories.filter(n=>n.dataset.shopItemKind==='pal').map(n=>n.dataset.shopItemId),cycle.pals,'the optional live PAL follows the date/ownership roster');
  assert.equal([...app.querySelectorAll('.ac-shopvisual > .ac-sheet-scroll .ac-shoptile')].length,suits.length+accessories.length,'no individual product is stranded outside the mixed row');
  assert(suits.length+accessories.length<=5,'the daily row contains no more than five choices');
  for(const tile of [...suits,...accessories])assert.equal(tile.dataset.focus,`shop:${tile.dataset.shopItemKind}:${tile.dataset.shopItemId}`,'each rail item has a stable keyboard identity');
  const children=[...scroll.children],features=[...scroll.querySelectorAll('.ac-featurecard')],boosts=[...scroll.querySelectorAll('.ac-boostcard')],dust=[...scroll.querySelectorAll('.ac-dustrow')];
  const at=n=>children.indexOf(n);
  assert.equal(children[at(viewer)+1],scroll.querySelector('.ac-combobar'),'the cart immediately follows the viewer');
  assert(features.length&&boosts.length&&dust.length,'bundles, boosts and Stardust remain accessible after the cart');
  assert(at(scroll.querySelector('.ac-combobar'))<at(features[0])&&at(features.at(-1))<at(boosts[0])&&at(boosts.at(-1))<at(dust[0]),'reading order is viewer, cart, bundles, boosts, Stardust');
  assert.deepEqual(boosts.map(row=>[row.querySelector('.ac-modname')?.textContent,row.querySelector('.ac-sub')?.textContent]),[
    ['Level Skip','3 stars instantly on any mission.'],
    ['Star Unlock','Instant unlock any Star Chart reward'],
  ],'boost cards use the owner-requested concise descriptions');
  const afterBoosts=boosts.at(-1).nextElementSibling;
  assert(afterBoosts?.matches('.ac-shelfhead')&&afterBoosts.textContent==='STAR DUST','Stardust follows the boost cards without another explanatory paragraph');
  assert.match(scroll.querySelector('.ac-daily .ac-sub')?.textContent??'',/^Day \d+ of 7\. Come back tomorrow\.?$/,'daily copy is limited to the counter and tomorrow cue');
}
function pixels(canvas){return surfaceOf(canvas).surface.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;}
function ink(canvas){const rgba=pixels(canvas);let count=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>24)count++;return count;}
function hash(canvas){return createHash('sha256').update(pixels(canvas)).digest('hex');}
function assertShopImage(img,filename){
  assert(img,filename+' has an image element');const url=new URL(img.src);
  assert.equal(url.pathname,'/art/shop/'+filename);assert.equal(url.searchParams.get('v'),String(C.ART_VER));
  assert(img.alt?.trim()||img.closest('button')?.getAttribute('aria-label')||img.closest('button')?.textContent.trim(),filename+' is named by its image or containing product button');
  const decoded=localImage(img.src);assert(decoded.width>=256&&decoded.height>=256,filename+' shipping asset decodes at useful resolution');
}
function assertItemArtwork(canvas,{kind,id}){
  assert(canvas,`${kind}:${id} has actual in-game canvas artwork`);assert(ink(canvas)>25,`${kind}:${id} artwork is visible`);
  if(kind!=='trail'){
    const prefix=kind==='suit'?`/art/suits/${id}`:kind==='helm'?`/art/helms/${id}`:`/art/solo/${id}`;
    assert([...surfaceOf(canvas).sources].some(path=>path.startsWith(prefix)&&['.','-','/'].includes(path[prefix.length])),`${kind}:${id} renderer draws the selected product artwork`);
  }
}
async function assertAnimation(canvas,label){
  assert(canvas,label+' opens its preview inside the bundle modal');
  await tick();const first=hash(canvas);assert(ink(canvas)>100,label+' paints a visible preview from the real renderer');
  await tick(230);const second=hash(canvas);await tick(230);
  assert(first!==second||first!==hash(canvas),label+' preview advances rather than freezing');
  const [kind,id]=label.split(':');assertItemArtwork(canvas,{kind,id});
}

const clock=Date.now;let day=20000;Date.now=()=>day*C.SHOP_DAY_MS+3600000;
function dateWith(predicate,save=baseline){
  for(let d=20000;d<20366;d++)if(predicate(selectShopCycle(d,id=>S.ownsPremium(save,id))))return d;
  assert.fail('requested test roster is unreachable across a year');
}
try{
  reset();await tick();assert(app.querySelector('.ac-shopvisual'),'visual treatment has a Shop-specific root');
  assertCompactStructure();
  const nebula=app.querySelector('.ac-shopvisual').style.getPropertyValue('--shop-nebula');
  assert.equal(nebula,`url("/art/shop/shop-nebula.png?v=${C.ART_VER}")`,'Shop background uses the versioned local artwork');
  assert(localImage('/art/shop/shop-nebula.png').width>=512,'Shop background asset decodes at useful resolution');
  for(const id of ['porcelain','nacre','origamist']){
    day=dateWith(cycle=>cycle.suits.includes(id));reset();await tick();assertCompactStructure();
    const tile=[...app.querySelectorAll('.ac-shoptile')].find(node=>node.querySelector('.ac-tilename')?.textContent===C.SUITS.find(s=>s.id===id).name);
    assertItemArtwork(tile?.querySelector('canvas'),{kind:'suit',id});assert(!tile.querySelector('img'),'individual pilot cards use only actual in-game artwork');
    assert(tile.querySelector('.ac-tileprice')?.textContent.includes('100'));
  }
  const trio=C.BUNDLES.find(b=>b.id==='bundle-premium-trio');assert.equal(trio.name,'Premium Pilot Trio','catalog identity is preserved');
  assert.equal(C.BUNDLES.length,8,'the catalog retains eight multi-item bundles');
  assert(C.BUNDLES.every(bundle=>bundle.items.length>=3),'every bundle contains at least three actual product items');
  assert.equal(C.bundleQuote(trio,()=>false).discountPercent,16.7,'the 50 discount on 300 retail is displayed as 16.7 percent');
  assert.equal(card(trio.id)?.querySelector('.ac-modname')?.textContent,'Premium Trio');
  const bannerHashes=new Set();
  for(const bundle of C.BUNDLES){
    assert.equal(bundle.kit?.banner,`shop/${bundle.id}.png`,bundle.id+' has its own configured banner');
    const banner=localImage('/art/'+bundle.kit.banner);await decodeReady.get('/art/'+bundle.kit.banner);
    assert(banner.width>=512&&banner.height>=256,bundle.id+' banner decodes at useful resolution');
    bannerHashes.add(createHash('sha256').update(readFileSync(root+'docs/art/'+bundle.kit.banner)).digest('hex'));
  }
  assert.equal(bannerHashes.size,C.BUNDLES.length,'each bundle has distinct kit-specific banner artwork');
  assertShopImage(card(trio.id)?.querySelector('img'),trio.kit.banner.slice(5));
  for(const row of app.querySelectorAll('.ac-dustrow'))assertShopImage(row.querySelector('img'),'stardust-emblem.png');

  if(mode!=='native'){
    // DOM structure and state restoration complement real-browser geometry.
    // These checks deliberately do not treat happy-dom rectangles as CSS proof.
    trace('compact mixed row');
    day=dateWith(cycle=>cycle.suits.includes('porcelain')&&cycle.helms.length>0&&cycle.pals.length>0);reset();await tick();
    const fixedName=C.SUITS.find(s=>s.id==='porcelain').name;
    const untouched=JSON.stringify(e.save),kept={outer:231,items:129};
    shopScroll().scrollTop=kept.outer;rail().scrollLeft=kept.items;
    async function choose(kind,id){
      const tile=railItem(kind,id);assert(tile,`${kind}:${id} is reachable in its viewer rail`);tile.focus();tile.click();await tick();
      assert.equal(document.activeElement,railItem(kind,id),`${kind}:${id} keeps keyboard focus after repaint`);
      assert.deepEqual(railOffsets(),kept,`${kind}:${id} preserves the page and horizontal row offset`);
      assert.equal(JSON.stringify(e.save),untouched,`${kind}:${id} only changes preview/cart, never equipment, currency or grants`);
      assertCompactStructure();
    }
    await choose('suit','porcelain');
    assert.deepEqual(pickedRailIds(),['porcelain']);
    assert(app.querySelector('.ac-caseplate').textContent.includes(fixedName));
    const porcelainPreview=app.querySelector('.ac-casecanvas');assertItemArtwork(porcelainPreview,{kind:'suit',id:'porcelain'});
    assert(![...surfaceOf(porcelainPreview).sources].some(p=>p.startsWith('/art/helms/')),'fixed-head preview retains its integrated head');
    // A second click removes only its cart selection; its preview remains.
    await choose('suit','porcelain');assert.deepEqual(pickedRailIds(),[]);
    assert(app.querySelector('.ac-caseplate').textContent.includes(fixedName));
    const helmets=[...rail().querySelectorAll('button[data-shop-item-kind="helm"]')].map(n=>n.dataset.shopItemId);
    for(const id of helmets){
      // Return the stage to the fixed-head pilot without keeping it in cart.
      if(!app.querySelector('.ac-caseplate').textContent.includes(fixedName)){await choose('suit','porcelain');await choose('suit','porcelain');}
      await choose('helm',id);
      assert.deepEqual(pickedRailIds(),[id],'previewing a compatible suit adds only the chosen helmet to the cart');
      const preview=app.querySelector('.ac-casecanvas');assertItemArtwork(preview,{kind:'helm',id});
      assert(!app.querySelector('.ac-caseplate').textContent.includes(fixedName),'a separate helmet gets a compatible preview body');
      assert(app.querySelector('.ac-caseplate').textContent.includes(C.HELMETS.find(h=>h.id===id).name),'details identify the helmet actually being previewed');
      await choose('helm',id);assert.deepEqual(pickedRailIds(),[]);
    }
    const pal=rail().querySelector('button[data-shop-item-kind="pal"]').dataset.shopItemId;
    await choose('pal',pal);assert.deepEqual(pickedRailIds(),[pal]);
    assert(app.querySelector('.ac-casesub').textContent.includes(C.PALS.find(p=>p.id===pal).name));
    assertItemArtwork(app.querySelector('.ac-casecanvas'),{kind:'pal',id:pal});
    const partner=[...rail().querySelectorAll('button[data-shop-item-kind="suit"]')].find(n=>n.dataset.shopItemId!=='porcelain').dataset.shopItemId;
    await choose('suit',partner);assert.deepEqual(pickedRailIds(),[pal,partner].sort(),'suit and pal selections remain independent cart entries');
    assert(app.querySelector('.ac-caseplate').textContent.includes(C.SUITS.find(s=>s.id===partner).name));
    assert(app.querySelector('.ac-combobar').textContent.includes('2 ITEMS SELECTED'));
    const railCart=cartState();card(trio.id).click();await tick();close();
    assert.deepEqual(railOffsets(),kept,'bundle review and return preserve the item row position');
    assert.deepEqual(cartState(),railCart,'bundle review does not consume the rail cart');
    app.querySelector('.ac-cartclear').click();await tick();assert.deepEqual(pickedRailIds(),[]);
    assert.deepEqual(railOffsets(),kept,'Clear preserves the current view into the item row');
    assert(app.querySelector('.ac-combobar').textContent.includes('NOTHING SELECTED'));
    assert.equal(JSON.stringify(e.save),untouched);
    // Zero is a saved position too. A taller three-item cart must not make
    // Clear move the page away from its top while restoring the inner row.
    kept.outer=0;shopScroll().scrollTop=0;
    const extraSuit=[...rail().querySelectorAll('button[data-shop-item-kind="suit"]')]
      .sort((a,b)=>b.textContent.length-a.textContent.length)[0].dataset.shopItemId;
    const extraHelm=helmets.find(id=>id!==extraSuit&&id!==pal);assert(extraHelm);
    await choose('suit',extraSuit);await choose('pal',pal);await choose('helm',extraHelm);
    assert.equal(pickedRailIds().length,3,'three distinct items exercise the expanded cart');
    app.querySelector('.ac-cartclear').click();await tick();
    assert.deepEqual(pickedRailIds(),[]);assert.deepEqual(railOffsets(),kept,'Clear retains explicit outer zero and the inner row position');
    assert.equal(document.activeElement?.dataset.focus,'shop:cart','Clear returns keyboard focus to the persistent cart');
    assert.equal(JSON.stringify(e.save),untouched);
    // A date without a companion must clear an unowned preview from the
    // previous date, even when its suit remains today's valid selection.
    const palDate=dateWith(cycle=>cycle.pals.length>0);day=palDate;reset();await tick();
    const priorCycle=selectShopCycle(day,id=>S.ownsPremium(e.save,id)),priorPal=priorCycle.pals[0],priorSuit=priorCycle.suits[0];
    railItem('suit',priorSuit).click();railItem('pal',priorPal).click();await tick();
    assert(app.querySelector('.ac-casesub')?.textContent.includes(C.PALS.find(p=>p.id===priorPal).name));
    // Owning the shown suit keeps its preview eligible across dates. This
    // is an isolated save fixture, not a Shop purchase or equipment change.
    e.save.purchased.push(...C.idGrants(priorSuit),...C.PALS.filter(p=>C.isIap(p.id)&&p.id!==priorPal).map(p=>p.id));
    const beforeRollover=JSON.stringify(e.save);
    day=dateWith(cycle=>cycle.pals.length===0&&!cycle.held.has(priorPal),e.save);e.open('shop');await tick();
    assert.equal(rail().querySelectorAll('button[data-shop-item-kind="pal"]').length,0,'a zero-PAL day has no companion card');
    assert.equal(app.querySelector('.ac-casesub'),null,'the previous unowned PAL is not silently retained in the stage');
    assert(app.querySelector('.ac-caseplate').textContent.includes(C.SUITS.find(s=>s.id===priorSuit).name),'the still-eligible suit remains selected through rollover');
    assert.equal(JSON.stringify(e.save),beforeRollover,'roster rollover does not change player state');
    for(const streakPackClaimed of [false,true]){
      const localToday=new Date();
      e.save.lastDaily=[localToday.getFullYear(),String(localToday.getMonth()+1).padStart(2,'0'),String(localToday.getDate()).padStart(2,'0')].join('-');e.save.dailyStreak=7;e.save.streakPackClaimed=streakPackClaimed;e.open('shop');
      assert.match(app.querySelector('.ac-daily .ac-sub').textContent,/^Day 7 of 7\. Come back tomorrow\.?$/,'both seventh-day reward variants keep compact copy');
      assert.equal(app.querySelectorAll('.ac-daily .ac-pip').length,7,'the streak indicator remains complete');
      assert(app.querySelector('.ac-dailygot').textContent.includes(`+${e.dailyState().amount}`),'compact daily receipt still shows the real granted amount');
    }
    reset();await tick();
    // Every actual rotating pack is reached through its day on the real
    // shelf. This includes standalone companions/visors and mixed packs.
    const rotation=C.BUNDLES.filter(b=>!b.fixed&&!b.alwaysAvailable&&!C.SHOP_CYCLE.excludedBundleIds.includes(b.id)),seenKinds=new Set();let reviews=0;
    assert.deepEqual(reviewItems(trio).filter(item=>item.kind==='trail').map(item=>item.id).sort(),['nacrewake','origamistwake','porcelainwake'],'all three signature wakes are shown with the trio');
    const circuit=C.BUNDLES.find(b=>b.id==='bundle-circuit');
    assert.deepEqual(reviewItems(circuit).filter(item=>!circuit.items.includes(item)),[{kind:'trail',id:'clockwork'}],'Circuit adds the free Cyber wake once');
    for(const bundle of [...rotation,trio]){
      trace(bundle.id);
      day=bundle.alwaysAvailable?20000:dateWith(cycle=>cycle.feature?.id===bundle.id);reset();await tick();
      assertCompactStructure();
      const offer=card(bundle.id);assert(offer,bundle.id+' reaches the shelf');
      assert(!offer.querySelector('.ac-sub'),bundle.id+' card keeps long copy in its detail view');
      assertShopImage(offer.querySelector('img'),bundle.kit.banner.slice(5));
      assertQuote(offer,bundle,id=>S.ownsPremium(e.save,id));
      for(const tile of app.querySelectorAll('.ac-shoptile'))assertItemArtwork(tile.querySelector('canvas'),{kind:tile.dataset.shopItemKind,id:tile.dataset.shopItemId});
      // Keep a selected single in the cart while reviewing pack contents.
      const single=rail().querySelector('button[data-shop-item-kind="suit"]');assert(single,'a live single is available alongside bundle review');
      single.click();const before=JSON.stringify(e.save),cartBefore=cartState();card(bundle.id).click();await tick();
      assert.equal(JSON.stringify(e.save),before,bundle.id+' opening does not change currency, ownership or equipment');
      const contents=reviewItems(bundle);
      assert.equal(sheet().querySelector('.ac-bundlesummary')?.textContent,summaryOf(bundle),bundle.id+' summary gives accurate item and bonus wake counts');
      assertQuote(sheet(),bundle,id=>S.ownsPremium(e.save,id));
      assert.deepEqual(itemKeys(included()),contents.map(itemKey).sort(),bundle.id+' review lists the complete included set and free wakes');
      for(const item of contents){
        seenKinds.add(item.kind);
        const tile=sheet().querySelector(`[data-shop-item-id="${item.id}"][data-shop-item-kind="${item.kind}"]`);assert(tile);
        assertItemArtwork(tile.querySelector('canvas'),item);assert(!tile.querySelector('img'),itemKey(item)+' included card uses actual in-game artwork');
        if(!bundle.items.some(i=>itemKey(i)===itemKey(item))){assert.equal(tile.dataset.bonusWake,'true');assert.equal(tile.querySelector('.ac-tileprice')?.textContent,'BONUS WAKE');}
        tile.click();
        const preview=sheet()?.querySelector(`[data-feature-preview-id="${item.id}"][data-feature-preview-kind="${item.kind}"]`);
        await assertAnimation(preview,itemKey(item));reviews++;
        if(item.kind==='trail'&&C.builtInTrailSuit(item.id))assertItemArtwork(preview,{kind:'suit',id:C.builtInTrailSuit(item.id)});
        if(item.kind==='suit'){
          const suit=C.SUITS.find(s=>s.id===item.id),sources=surfaceOf(preview).sources;
          if(bundle.items.some(i=>i.kind==='helm'&&i.id===item.id)&&!C.wearsOwnHead(suit))assert(sources.has(`/art/helms/${item.id}.png`),item.id+' review wears its matching included helmet');
          if(['porcelain','nacre','origamist'].includes(item.id))assert(![...sources].some(path=>path.startsWith('/art/helms/')),item.id+' review retains its authored head without an external helmet');
        }
        if(item.kind==='pal')assert(sheet().textContent.includes(C.PALS.find(p=>p.id===item.id).desc),item.id+' review describes its actual gameplay effect');
        assert(sheet().querySelector('.ac-featurebuy'),itemKey(item)+' keeps bundle checkout alongside preview');
        assert.equal(JSON.stringify(e.save),before,itemKey(item)+' preview does not charge, equip or grant');
        assert.deepEqual(cartState(),cartBefore,itemKey(item)+' preview preserves the separate single-item cart');
        const back=sheet().querySelector('.ac-feature-reviewback');assert.equal(back?.textContent,bundle===trio?'BACK TO PILOTS':'BACK TO ITEMS');back.click();
        assert(!sheet().querySelector('[data-feature-preview-id]'),itemKey(item)+' returns to included cards in the same modal');
        assert.deepEqual(itemKeys(included()),contents.map(itemKey).sort());
        assert.equal(JSON.stringify(e.save),before);assert.deepEqual(cartState(),cartBefore);
      }
      close();assert(!sheet(),bundle.id+' closes the modal');
    }
    assert.deepEqual([...seenKinds].sort(),['helm','pal','suit','trail']);

    // Keyboard review stays in the dialog and returns to the exact item,
    // then to its offer, without arming or spending the purchase.
    trace('keyboard');reset();const keyboardSave=JSON.stringify(e.save);card(trio.id).click();
    assert.equal(sheet().getAttribute('role'),'dialog');assert.equal(sheet().getAttribute('aria-modal'),'true');
    const key=(name,shiftKey=false)=>document.activeElement.dispatchEvent(new win.KeyboardEvent('keydown',{key:name,code:name,bubbles:true,cancelable:true,shiftKey}));
    let first=sheet().querySelector('button'),last=[...sheet().querySelectorAll('button')].at(-1);
    assert.equal(document.activeElement,first,'opening focuses the first included product');
    last.focus();key('Tab');assert.equal(document.activeElement,first,'Tab wraps to the first modal action');
    key('Tab',true);assert.equal(document.activeElement,last,'Shift+Tab wraps to the last modal action');
    first.focus();first.click();assert.equal(document.activeElement,sheet().querySelector('.ac-feature-reviewback'),'review focuses its return action');
    key('Escape');assert.equal(document.activeElement,sheet().querySelector('[data-shop-item-id="porcelain"]'),'Escape restores the included product focus');
    key('Escape');assert(!sheet());assert.equal(document.activeElement,card(trio.id),'Escape closes to the original offer');
    assert.equal(JSON.stringify(e.save),keyboardSave);

    for(const count of [1,2]){
      reset();e.save.purchased.push(...['porcelain','nacre'].slice(0,count));e.open('shop');
      const quote=assertQuote(card(trio.id),trio,id=>S.ownsPremium(e.save,id));
      assert.equal(quote.credit,count*100,'trio credits the full individual purchase price');assert.equal(quote.due,count===1?150:50);
      card(trio.id).click();assertQuote(sheet(),trio,id=>S.ownsPremium(e.save,id));
      assert.equal([...included()].filter(tile=>tile.dataset.shopItemKind==='suit'&&tile.querySelector('.ac-tileprice.owned')).length,count,'review marks owned pilots accurately');close();
    }

    // Partially owned mixed packs keep their credited checkout while a
    // remaining product is being reviewed. The first press only confirms.
    trace('partial checkout');const partial=C.BUNDLES.find(b=>b.id==='bundle-aurora');
    reset();e.save.purchased.push(...C.idGrants('cryostar'));day=dateWith(cycle=>cycle.feature?.id===partial.id,e.save);e.open('shop');
    const due=C.featurePrice(partial,id=>S.ownsPremium(e.save,id));assert(due<C.featurePrice(partial,()=>false));
    const partialQuote=assertQuote(card(partial.id),partial,id=>S.ownsPremium(e.save,id));assert.equal(partialQuote.credit,40);assert.equal(due,40);
    e.save.starDust=due;card(partial.id).click();
    for(const item of [{kind:'suit',id:'cryostar'},{kind:'helm',id:'cryostar'},{kind:'trail',id:'celestialtide'}])
      assert.equal(sheet().querySelector(`button[data-shop-item-id="${item.id}"][data-shop-item-kind="${item.kind}"] .ac-tileprice`)?.textContent,'OWNED',itemKey(item)+' is covered by one real Cryostar purchase');
    sheet().querySelector('[data-shop-item-kind="pal"]').click();
    const before=JSON.stringify(e.save);sheet().querySelector('.ac-featurebuy').focus();sheet().querySelector('.ac-featurebuy').click();assert.equal(JSON.stringify(e.save),before,'first press does not charge');
    assert.equal(document.activeElement,sheet().querySelector('.ac-featurebuy'),'confirmation keeps keyboard focus on checkout');
    assert(sheet().querySelector('.ac-featurebuy').textContent.includes('CONFIRM'));sheet().querySelector('.ac-featurebuy').click();
    assert.equal(e.save.starDust,0);assert(C.bundleIds(partial).every(id=>S.ownsPremium(e.save,id)),'review checkout grants the complete mixed pack');
    assert(!sheet(),'successful purchase closes the review');

    // Full individual credit can cover the offer before every item is
    // owned. Its remaining contents are claimable, with no currency refund.
    trace('zero-price completion');reset();
    e.save.purchased.push(...C.idGrants('cryostar'),...C.idGrants('verdant'));e.save.starDust=123;day=dateWith(cycle=>cycle.feature?.id===partial.id,e.save);e.open('shop');
    const zero=assertQuote(card(partial.id),partial,id=>S.ownsPremium(e.save,id));assert.equal(zero.due,0);
    assert(!C.bundleIds(partial).every(id=>S.ownsPremium(e.save,id)));
    card(partial.id).click();const freeBefore=JSON.stringify(e.save),free=sheet().querySelector('.ac-featurebuy');
    assert(!free.disabled);assert(free.textContent.includes('COMPLETE BUNDLE'));assert(!free.textContent.includes('ALREADY YOURS'));
    free.click();assert.equal(JSON.stringify(e.save),freeBefore,'first completion press only confirms');
    assert(sheet().querySelector('.ac-featurebuy').textContent.includes('CONFIRM'));sheet().querySelector('.ac-featurebuy').click();
    assert.equal(e.save.starDust,123,'zero-price completion neither charges nor refunds');
    assert(C.bundleIds(partial).every(id=>S.ownsPremium(e.save,id)));assert(!sheet());assert.equal(card(partial.id),null,'completed bundle leaves the offer shelf');

    // A daily sheet expires at rollover; the always-available trio survives.
    trace('rollover');day=0;reset();const old=[...app.querySelectorAll('.ac-featurecard')].find(node=>node.dataset.bundleId!==trio.id);old.click();
    const dailyItem=sheet().querySelector('[data-shop-item-id]');dailyItem.click();day++;e.open('shop');assert(!sheet(),'daily review closes when its deal rotates out');
    card(trio.id).click();sheet().querySelector('[data-shop-item-id="nacre"]').click();day++;e.open('shop');
    assert(sheet()?.querySelector('[data-feature-preview-id="nacre"]'),'permanent trio review survives date rollover');close();

    // A reduced-motion user gets one visible pose with no continuing loop.
    e.save.motionOff=true;card(trio.id).click();sheet().querySelector('[data-shop-item-id="porcelain"]').click();
    const still=sheet().querySelector('[data-feature-preview-id="porcelain"]');await tick();assert(ink(still)>100);
    const stillHash=hash(still);await tick(250);await tick(250);assert.equal(hash(still),stillHash,'reduced-motion preview stays on its visible pose');close();e.save.motionOff=false;

    // Product marketing images belong to Shop; other menus keep their
    // runtime art and do not inherit the new scoped visual root.
    // These are DOM isolation checks, not screenshots of unrelated screens.
    // The Star Chart owns very tall canvases; allocating native copies here
    // wastes gigabytes without adding evidence about the Shop boundary.
    rasterMode=false;trace('non-Shop DOM isolation');
    Object.assign(e.save,structuredClone(baseline));const menuBefore=JSON.stringify(e.save);
    const unlockCounts={};
    for(const [tab,kind,gates,revealed] of [
      ['suits','suit',STAR_UNLOCKS.suits,S.suitRevealed],
      ['helmets','helm',STAR_UNLOCKS.helmets,S.helmetRevealed],
      ['trails','trail',STAR_UNLOCKS.trails,S.trailUnlocked],
      ['pals','pal',STAR_UNLOCKS.pals,S.palUnlocked],
    ]){
      e.open('hangar');e.setShopTab(tab);let count=0;
      for(const tile of app.querySelectorAll(`.ac-loadout .ac-card[data-focus^="${kind}:"]`)){
        const id=tile.dataset.focus.slice(kind.length+1),threshold=gates[id],pill=tile.querySelector('.ac-unlocktag');
        if(!C.isIap(id)&&threshold!==undefined&&!revealed(e.save,id)){
          assert(pill,`${kind}:${id} has a graphic Unlock pill`);assert.equal(pill.textContent,`${threshold.toLocaleString()} to Unlock`);
          const art=pill.querySelector('img');assert(art,`${kind}:${id} uses the existing star artwork`);
          assert.equal(new URL(art.src).pathname,'/art/'+C.BOOSTS.starunlock.art);
          assert(!pill.textContent.includes('★'),`${kind}:${id} does not substitute a font star`);count++;
        }else assert(!pill,`${kind}:${id} does not show an obsolete unlock requirement`);
      }
      unlockCounts[tab]=count;
    }
    if(mode==='production')assert(Object.values(unlockCounts).every(n=>n>0),'locked examples cover suits, helmets, trails and PALs');
    assert.equal(STAR_UNLOCKS.suits.vanguard,570,'AcorNut still requires its real campaign threshold');
    assert.equal(STAR_UNLOCKS.suits.ghost,80,'Ghost still requires its real campaign threshold');
    e.open('hangar');
    const loadoutHelp=[...app.querySelectorAll('.ac-loadout button')].find(b=>b.querySelector('img')?.src.includes('/ui/help.png'));
    assert(loadoutHelp?.classList.contains('ac-hub-sq'),'Loadout Help uses the same painted square button as the menu');
    loadoutHelp.click();assert.equal(e.world.screen,'help','Loadout Help retains its real navigation');
    const help=app.querySelector('.ac-helpdeck');assert(help);
    assert.deepEqual([...help.querySelectorAll('[data-help-mode]')].map(section=>[section.dataset.helpMode,section.querySelector('h3')?.textContent]),[
      ['normal','Normal Mode'],['spill','Debris Field Mode'],['hyper','Hyper Run Mode'],
    ],'each control scheme has its own named Help section');
    assert.deepEqual([...help.querySelectorAll('[data-help-mode="hyper"] .ac-helpcontrol b')].map(n=>n.textContent),['HOLD TO RISE','DIVE'],'Hyper Run explains its real held input and dive');
    assert(help.querySelector('[data-help-mode="hyper"]').textContent.includes('Double-tap + hold: boost'));
    assert(help.querySelector('[data-help-mode="hyper"]').textContent.includes('Tunnel: drag to steer'));
    assert.equal(help.querySelector('.ac-helpitemsheading')?.textContent,'Game Items');
    const helpRows=[...help.querySelectorAll('.ac-helprow')];
    assert.deepEqual(helpRows.map(row=>row.querySelector('p')?.textContent),['ACORN','STAR DUST','ACORN COINS','FREEZE ACORN','SHIELD ACORN','GOLDEN ACORN','8-BIT ARCADE ACORN','BLACK HOLE','WORMHOLE'],'all game item entries remain, including the 8-bit arcade acorn PR #279 added to the guide');
    assert(helpRows.every(row=>row.querySelector('canvas')),'all Game Items retain their drawn artwork');
    assert.equal((help.textContent.match(/resets each run/g)??[]).length,1,'Acorn Coins reset information is shown once');
    assert.equal(help.querySelectorAll('[data-help-mode] p.ac-sub').length,0,'mode controls do not regain the removed explanatory paragraphs');
    const briefing=help.querySelector('[data-help-mode="spill"] [data-spill-briefing]');assert(briefing);briefing.click();
    assert(app.querySelector('.ac-spillhelpwrap'),'Debris briefing still opens from Help');
    app.querySelector('.ac-spillhelpwrap [data-spill-control="enter-depot"]').click();
    assert(!app.querySelector('.ac-spillhelpwrap'));assert.equal(e.world.screen,'help','briefing Back returns to Help');
    e.open('title');
    const homeHelp=app.querySelector('button[aria-label="Help and controls"]');
    assert(homeHelp?.classList.contains('ac-hub-sq'));assert.equal(new URL(homeHelp.querySelector('img').src).pathname,'/art/ui/help.png');
    const modes=app.querySelector('button.t-modes');assert(modes);modes.click();
    const modeSheet=app.querySelector('.ac-modecard'),modeBack=modeSheet?.querySelector('.ac-backbtn');
    assert(modeBack,'Modes has its standard top Back action');assert(!modeSheet.querySelector('.ac-modeback'),'the old footer Back action is removed');
    assert(modeBack.compareDocumentPosition(modeSheet.querySelector('.ac-moderow'))&win.Node.DOCUMENT_POSITION_FOLLOWING,'Modes Back precedes its mode choices');
    modeBack.click();assert(!app.querySelector('.ac-modecard'));assert.equal(e.world.screen,'title','Modes Back closes locally onto the existing main menu');
    assert.equal(JSON.stringify(e.save),menuBefore,'Loadout pills and menu navigation do not change equipment, currency or progress');
    for(const screen of ['hangar','title','log','help']){
      e.open(screen);await tick();assert(!app.querySelector('.ac-shopvisual'),screen+' is outside the Shop treatment');
      assert(![...app.querySelectorAll('img')].some(img=>img.src.includes('/art/shop/')),screen+' uses no Shop marketing image');
    }
    reset();const dustBefore=e.save.starDust,pack=C.DUST_PACKS[0];
    // THE STORE IS OFF (owner, 13 Sep 2026: "leave the packs in, they just cost
    // acorns ... 1000 acorn = 500 star dust"): the pack is priced in acorns on
    // web and beta alike, and buys with them
    const row=app.querySelector(`[data-dust-pack-id="${pack.id}"]`);assert(row);
    assert.equal(row.querySelector('.ac-acornprice')?.textContent.replace(/\D/g,''),String(pack.acorns),'the pack shows its acorn price');assert(!row.querySelector('.ac-cashprice'),'no cash sticker while the store is off');
    e.save.acorns=pack.acorns-1;row.click();assert.equal(e.save.starDust,dustBefore,'short of acorns buys nothing');
    e.save.acorns=pack.acorns;e.open('shop');await tick();app.querySelector(`[data-dust-pack-id="${pack.id}"]`).click();
    assert.equal(e.save.starDust,dustBefore+pack.dust+pack.bonus,'acorns buy the pack on web and beta alike');assert.equal(e.save.acorns,0,'and the acorns are spent');
    console.log(`PASS Shop visuals ${mode}: one five-item mixed row with independent preview/cart, zero/nonzero scroll and focus preservation, zero-PAL rollover; ${C.BUNDLES.length} distinct kit banners, actual product art, ${rotation.length+1} offers, ${reviews} animated item/wake reviews, accurate summaries/discount/ownership credit, paid and zero-price two-step checkout, keyboard/date rollover and Shop-only scope.`);
  }else{
    // Exercise the actual native bridge, not hardcoded cash labels or a
    // replaced buy handler. Every scenario uses a deferred fake store.
    assert.equal(app.querySelectorAll('.ac-dustrow').length,C.DUST_PACKS.length);
    for(const pack of C.DUST_PACKS){const row=app.querySelector(`[data-dust-pack-id="${pack.id}"]`);assert(row.disabled);assert.equal(row.querySelector('.ac-cashprice').textContent,'…');row.click();}
    assert.equal(storeCalls.length,0,'unknown locale prices cannot start a purchase');
    C.DUST_PACKS.forEach((pack,i)=>prices.set(pack.id,`€${i+1},29`));e.open('shop');
    for(const pack of C.DUST_PACKS){const row=app.querySelector(`[data-dust-pack-id="${pack.id}"]`);assert(!row.disabled);assert.equal(row.querySelector('.ac-cashprice').textContent,prices.get(pack.id));}
    const pack=C.DUST_PACKS[1],row=()=>app.querySelector(`[data-dust-pack-id="${pack.id}"]`);
    const starting=e.save.starDust;
    async function begin(){const calls=storeCalls.length;row().click();await settle();assert.equal(storeCalls.length,calls+1);assert.equal(storeCalls.at(-1),pack.id);assert.equal(e.dustPending(),pack.id);assert.equal(e.save.starDust,starting);assert([...app.querySelectorAll('.ac-dustrow')].every(n=>n.disabled));assert(row().textContent.includes('Waiting for the store'));for(const n of app.querySelectorAll('.ac-dustrow'))n.click();assert.equal(storeCalls.length,calls+1,'pending blocks a second purchase');}
    await begin();resolvePurchase({result:'cancelled'});await settle();assert(app.querySelector('.ac-deny')?.textContent.includes('cancelled'),'cancelled purchase has visible feedback');e.open('shop');assert.equal(e.save.starDust,starting);assert(!row().disabled);
    await begin();resolvePurchase({result:'failed'});await settle();assert(app.querySelector('.ac-deny')?.textContent.includes('did not complete'),'failed purchase has visible feedback');e.open('shop');assert.equal(e.save.starDust,starting);assert(!row().disabled);
    await begin();resolvePurchase({result:'ok',transactionId:'shop-visuals-receipt'});await settle();e.open('shop');
    assert.equal(e.save.starDust,starting+pack.dust+pack.bonus);assert.equal(e.dustPending(),null);assert(!row().disabled);
    row().click();resolvePurchase({result:'ok',transactionId:'shop-visuals-receipt'});await settle();e.open('shop');
    assert.equal(e.save.starDust,starting+pack.dust+pack.bonus,'redelivered receipt cannot grant twice');
    button('RESTORE PURCHASES').click();await settle();assert.equal(restoreCalls,1);
    console.log('PASS Shop visuals native: decoded emblem, localized and missing prices, pending exclusion, cancelled/failed recovery, exact receipt grant, duplicate protection and restore.');
  }
}finally{Date.now=clock;}
process.exit(0);
