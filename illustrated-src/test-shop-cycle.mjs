#!/usr/bin/env node
// The daily roster is a pure selection rule. Check real catalog availability
// and ownership boundaries independently of the DOM fixtures that consume it.
import assert from 'node:assert/strict';
globalThis.window={location:{href:'http://local/'},matchMedia:()=>({matches:false})};
const C=await import('../docs/js/catalog.js');
const {selectShopCycle}=await import('../docs/js/shop-cycle.js');
const none=()=>false,excluded=['raccoon','ferret','hedgehog'];
assert.deepEqual(C.SHOP_CYCLE,{
  // FIVE since 12 Sep 2026 (owner: "one more daily card showing ... another helmet or other option")
  maxItems:5,suits:2,premiumSuits:1,minHelms:1,helms:3,pals:1,trails:0,
  excludedIds:excluded,excludedBundleIds:['bundle-critters'],
},'the owner-approved daily roster is explicit and editable');
const catalogBefore=JSON.stringify({suits:C.SUITS,helms:C.HELMETS,pals:C.PALS,bundles:C.BUNDLES,settings:C.SHOP_CYCLE});
const idsOf=cycle=>[...cycle.suits,...cycle.helms,...cycle.pals];
const serial=cycle=>({day:cycle.day,feature:cycle.feature?.id??null,always:cycle.always.map(b=>b.id),held:[...cycle.held],excluded:[...cycle.excluded],suits:cycle.suits,helms:cycle.helms,pals:cycle.pals});
const allIds=[...C.IAP_ITEMS],premiumIds=C.SUITS.filter(s=>C.isIap(s.id)&&C.DUST_STICKER[s.id]!==undefined).map(s=>s.id);
const cheapIds=C.SUITS.filter(s=>C.isIap(s.id)&&!excluded.includes(s.id)&&C.DUST_STICKER[s.id]===undefined).map(s=>s.id);
const own=ids=>{const keys=new Set(ids);return id=>keys.has(id);};
let cases=0,matchedHelmetCases=0,matchedPalCases=0,randomPalDays=0,emptyPalDays=0;
const seen={suits:new Set(),helms:new Set(),pals:new Set(),features:new Set()};
function check(day,owns){
  const cy=selectShopCycle(day,owns),label=`day ${day}`;cases++;
  assert.deepEqual(serial(cy),serial(selectShopCycle(day,owns)),label+' repeats exactly');
  assert.equal(cy.day,Math.floor(day));assert.equal(cy.owns,owns,'ownership callback is retained, never rewritten');
  assert.deepEqual([...cy.excluded],excluded);
  const expectedOffers=C.BUNDLES.filter(b=>!C.SHOP_CYCLE.excludedBundleIds.includes(b.id)&&!b.items.some(i=>excluded.includes(i.id))&&!C.bundleIds(b).every(owns));
  const rotating=expectedOffers.filter(b=>!b.fixed&&!b.alwaysAvailable);
  assert.equal(!!cy.feature,rotating.length>0,label+' features a pack whenever one is available');
  if(cy.feature){assert(rotating.some(b=>b.id===cy.feature.id));seen.features.add(cy.feature.id);}
  assert.deepEqual(cy.always,expectedOffers.filter(b=>b.alwaysAvailable));
  assert.deepEqual([...cy.held],cy.feature&&!cy.feature.keepSingles?C.bundleIds(cy.feature):[],label+' preserves the featured pack hold');
  const available=list=>list.filter(item=>C.isIap(item.id)&&!excluded.includes(item.id)&&!cy.held.has(item.id)&&!owns(item.id));
  const suits=available(C.SUITS),premiums=suits.filter(s=>C.DUST_STICKER[s.id]!==undefined),cheap=suits.filter(s=>C.DUST_STICKER[s.id]===undefined);
  const premiumCount=premiums.length?1:0;
  assert.equal(cy.suits.length,premiumCount+Math.min(2-premiumCount,cheap.length),label+' fills one premium and one cheap, or up to two cheap when premiums are exhausted');
  assert.equal(cy.suits.filter(id=>C.DUST_STICKER[id]!==undefined).length,premiumCount,label+' never pins or doubles premium stock');
  const helmets=available(C.HELMETS).filter(h=>!cy.suits.includes(h.id));
  assert(cy.helms.length<=3&&cy.helms.length<=helmets.length,label+' limits helmets to available stock');
  assert(cy.helms.length>=Math.min(1,helmets.length),label+' keeps at least one helmet when eligible');
  const palms=available(C.PALS).filter(p=>!cy.suits.includes(p.id)&&!cy.helms.includes(p.id));
  assert(cy.pals.length<=Math.min(1,palms.length),label+' offers zero or one eligible PAL');
  const availableByKind={suits:new Set(suits.map(i=>i.id)),helms:new Set(helmets.map(i=>i.id)),pals:new Set(palms.map(i=>i.id))};
  for(const kind of ['suits','helms','pals'])for(const id of cy[kind]){assert(availableByKind[kind].has(id),`${label} ${kind}:${id} is unowned, unheld and eligible`);seen[kind].add(id);}
  const displayed=idsOf(cy);assert.equal(new Set(displayed).size,displayed.length,label+' never duplicates a shared ownership ID across cards');
  assert(displayed.length<=5,label+' never exceeds the five-item row');
  assert(cy.helms.length+cy.pals.length<=5-cy.suits.length,label+' gear respects the remaining space in the row');
  // Compatible helmets take priority. Within that group, a shared kit is
  // preferred; if there is no compatible body, shared-kit styling wins.
  const rank=helm=>{
    const compatible=cy.suits.some(id=>{const suit=C.SUITS.find(s=>s.id===id);return !C.wearsOwnHead(suit)&&(!helm.suitOnly||helm.suitOnly===id);});
    const sameKit=C.BUNDLES.some(b=>b.items.some(i=>i.kind==='suit'&&cy.suits.includes(i.id))&&b.items.some(i=>i.kind==='helm'&&i.id===helm.id));
    return Number(compatible)*2+Number(sameKit);
  };
  for(const id of cy.helms){
    const selectedRank=rank(C.HELMETS.find(h=>h.id===id));
    assert(helmets.filter(h=>!cy.helms.includes(h.id)).every(h=>rank(h)<=selectedRank),label+' cannot skip a better matching helmet');
    if(selectedRank>0)matchedHelmetCases++;
  }
  // A possible PAL cannot claim a match to the second helmet it would
  // replace. Only the priority helmets that fit beside it are relevant.
  const helmsBesidePal=cy.helms.slice(0,Math.max(0,5-cy.suits.length-1));
  const palsFor=kind=>palms.filter(p=>C.BUNDLES.some(b=>b.items.some(i=>i.kind===kind&&(kind==='suit'?cy.suits:helmsBesidePal).includes(i.id))&&b.items.some(i=>i.kind==='pal'&&i.id===p.id)));
  const suitPals=palsFor('suit'),matchingPals=suitPals.length?suitPals:palsFor('helm');
  if(matchingPals.length){assert.equal(cy.pals.length,1,label+' includes an available matching companion');assert(matchingPals.some(p=>p.id===cy.pals[0]),label+' prefers a suit companion before an accessory companion');matchedPalCases++;}
  else if(palms.length){if(cy.pals.length)randomPalDays++;else emptyPalDays++;}
  return cy;
}

// Dates span negative indices, today's era, two year boundaries and leap
// days. The helper receives dates explicitly and must not read random/time.
const clock=Date.now,random=Math.random;
Date.now=()=>{throw Error('daily selection must use its supplied day');};
Math.random=()=>{throw Error('daily selection must not use gameplay RNG');};
try{
  for(let d=-7;d<0;d++)check(d,none);
  for(let d=20000;d<20366;d++){
    const cycle=check(d,none);assert.equal(idsOf(cycle).length,5,'available stock fills the five daily choices');
    assert(cycle.pals.length===1?cycle.helms.length===2:cycle.helms.length===3,'three gear slots show two helmets and the PAL, or three helmets');
  }
  for(const id of [...premiumIds,...cheapIds])assert(seen.suits.has(id),id+' reaches an unowned daily suit slot');
  for(const h of C.HELMETS.filter(h=>C.isIap(h.id)))assert(seen.helms.has(h.id)||seen.suits.has(h.id),h.id+' reaches an individual purchase slot, including shared suit/helmet ownership');
  assert.equal(seen.features.size,C.BUNDLES.filter(b=>!b.fixed&&!b.alwaysAvailable&&!C.SHOP_CYCLE.excludedBundleIds.includes(b.id)).length,'all eligible daily bundles recur');
  const varied=new Set(Array.from({length:28},(_,d)=>JSON.stringify(serial(selectShopCycle(20000+d,none)))));
  assert(varied.size>14,'the dated roster changes instead of pinning the same pilots');
  // Full-grant ownership, individual purchases, all premium exhausted,
  // cheap stock exhausted, scarce helmets/PALs, and fully owned catalog.
  const owners=[own(premiumIds),own(cheapIds),own(allIds),
    ...allIds.map(id=>own(C.idGrants(id))),
    ...C.BUNDLES.map(b=>own(C.bundleIds(b).flatMap(C.idGrants))),
    own(allIds.filter(id=>!['porcelain','volt','amethyst','magnetar'].includes(id))),
    own(allIds.filter(id=>!['nacre','origamist'].includes(id))),
  ];
  for(const owns of owners)for(let d=20000;d<20028;d++)check(d,owns);
  // Every unowned cheap suit currently has a kit companion, so fully
  // unowned stock correctly prefers a PAL every day. Own the coordinated
  // companions to exercise genuine random/zero-PAL fallback instead.
  const coordinated=C.BUNDLES.filter(b=>b.items.some(i=>i.kind==='suit'||i.kind==='helm')).flatMap(b=>b.items.filter(i=>i.kind==='pal').map(i=>i.id));
  for(let d=20000;d<20366;d++)check(d,own(coordinated));
  assert(matchedHelmetCases>0&&matchedPalCases>0&&randomPalDays>0&&emptyPalDays>0,'dates and ownership fixtures exercise matching and optional random fallback');
  for(const p of C.PALS.filter(p=>C.isIap(p.id)))assert(seen.pals.has(p.id),p.id+' reaches a PAL slot under eligible ownership/date conditions');
  for(let d=0;d<14;d++){
    const empty=check(d,own(allIds));assert.deepEqual(idsOf(empty),[]);assert.equal(empty.feature,null);assert.deepEqual(empty.always,[]);
    const fallback=check(d,own(premiumIds));assert(fallback.suits.every(id=>C.DUST_STICKER[id]===undefined));
  }
  // Earlier results and catalog arrays cannot be mutated by later dates.
  const previous=selectShopCycle(20000,none),before=structuredClone(serial(previous));selectShopCycle(20001,own(premiumIds));assert.deepEqual(serial(previous),before);
  assert.equal(JSON.stringify({suits:C.SUITS,helms:C.HELMETS,pals:C.PALS,bundles:C.BUNDLES,settings:C.SHOP_CYCLE}),catalogBefore,'selection leaves all product/config data untouched');
}finally{Date.now=clock;Math.random=random;}
console.log(JSON.stringify({suite:'daily Shop roster',result:'PASS',cases,matchedHelmetCases,matchedPalCases,randomPalDays,emptyPalDays,seen:Object.fromEntries(Object.entries(seen).map(([kind,ids])=>[kind,[...ids].sort()]))},null,2));
