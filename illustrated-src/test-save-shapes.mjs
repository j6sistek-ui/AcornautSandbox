import assert from 'node:assert/strict';
// SAVE SHAPES (audit, 30 Sep 2026). Every shape a hand edit, an old build or
// a bad byte can leave in the slot loads without throwing and settles sanely;
// Start Over keeps what money bought; a blob that is not a save is stashed.
const store=new Map();
globalThis.window={location:{href:'http://local/'},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,String(v));},removeItem(k){store.delete(k);}};
const Save=await import('../docs/js/save.js');
const Camp=await import('../docs/js/campaign.js');
const KEY='acornaut_illust_v1';
const load=(obj)=>{store.clear();if(obj!==undefined)store.set(KEY,typeof obj==='string'?obj:JSON.stringify(obj));return Save.loadSave();};
// (a) shapes that used to throw
for(const bad of [{unlockedSuits:5},{unlockedSuits:{}},{unlockedSuits:'flight'},{unlocked:5},{unlockedTrails:5},{unlockedPals:5},{purchased:5},{purchased:{}},{purchased:'arcflash'},{keyUnlocks:'x'},{raceGates:'33'},
  {campaignProgress:{version:1}},{campaignProgress:{version:1,missions:null}},{campaignProgress:{version:1,missions:{},paidRewards:'x'}},{stars:[1,2]},{stars:'x'},{guide:'bogus'},{acorns:'500'},{acorns:-50},{acorns:NaN},{starDust:'9'},{highScore:null},{runs:'3'}]){
  let s;assert.doesNotThrow(()=>{s=load(bad);},`loads ${JSON.stringify(bad)}`);
  for(const k of ['unlocked','unlockedSuits','unlockedTrails','unlockedPals','purchased','keyUnlocks','boostedRewards','zonesSeen','favorites','raceGates'])assert(Array.isArray(s[k]),`${k} is a list after ${JSON.stringify(bad)}`);
  for(const k of ['acorns','starDust','highScore','runs'])assert(Number.isFinite(s[k])&&s[k]>=0,`${k} is a whole non-negative number after ${JSON.stringify(bad)}`);
  assert(['pending','reward','hangar','helmet','levels','done'].includes(s.guide),'guide is a known step');
  assert(Number.isFinite(Save.starsOf(s)),'star total is a number');
  assert.doesNotThrow(()=>Save.settleStarRewards(s),'settling never throws');
}
// (b) a NaN floor pays nothing, not everything
{
  const s=load({campaignProgress:{version:1,missions:{},barriers:[],paidRewards:[],zoneVisits:[]}});
  assert.equal(Save.settleStarRewards(s),0,'an empty ledger with no floor pays no rung');
  assert.equal(Save.starsOf(s),0);
}
// (c) the total never exceeds the chart
{
  const s=load({campaignProgress:{version:1,missions:{},barriers:[],paidRewards:[],legacyEntitlementFloor:780,zoneVisits:[]}});
  assert.equal(Save.starsOf(s),Camp.CHART_MAX_STARS,'a beta floor is capped at this chart\'s maximum');
}
// (d) beta-only stars do not count on the production road
if(Camp.CHART_LEVELS.length<Camp.ALL_LEVELS.length){
  const stars={};for(const def of Camp.ALL_LEVELS.slice(Camp.CHART_LEVELS.length))stars[def.id]=7;
  stars[Camp.CHART_LEVELS[0].id]=7;
  const s=load({stars});
  assert.equal(Save.starsOf(s),3,'only the road\'s own missions count (got '+Save.starsOf(s)+')');
}
// (e) a name is cut by character
{
  const s=load({pilotName:'a'+'🚀'.repeat(9)});
  assert.equal(Array.from(s.pilotName).length,10);assert(![...s.pilotName].some(ch=>/^[\uD800-\uDFFF]$/.test(ch)),'no lone surrogate anywhere');
  assert.equal(Save.cleanPilotName('  two\nwords  '),'two words');
}
// (f) Start Over keeps purchases, Star Dust and boosts; erases the rest
{
  assert.equal(load({noAds:'yes'}).noAds,false,'junk in noAds reads as not bought');
  const s=load({acorns:900,starDust:777,purchased:['arcflash','porcelain'],noAds:true,boosts:{levelskip:2,starunlock:1},pilotName:'Zed',highScore:40,tutorialDone:true,guide:'done'});
  assert.equal(s.noAds,true,'Remove Ads is kept on the save');
  assert.equal(s.starDust,777);
  Save.eraseSave();const f=Save.loadSave();
  assert.deepEqual(f.purchased.sort(),['arcflash','porcelain'],'shop purchases survive');assert.equal(f.noAds,true,'Remove Ads survives Start Over');
  assert.equal(f.starDust,777,'Star Dust survives');assert.equal(f.boosts.levelskip,2);assert.equal(f.boosts.starunlock,1);
  assert.equal(f.acorns,Save.defaultSave().acorns,'acorns reset');assert.equal(f.highScore,0);assert.equal(f.pilotName,'');assert.equal(f.tutorialDone,false);
  // sealed: nothing writes after Start Over
  Save.sealSave();f.acorns=12345;Save.writeSave(f);assert.equal(JSON.parse(store.get(KEY)).acorns,Save.defaultSave().acorns,'a sealed save is never written');
}
// (g) a blob that is not a save is stashed before the fresh save replaces it
{
  store.clear();store.set(KEY,'{"acorns":');const s=Save.loadSave();assert.equal(s.acorns,Save.defaultSave().acorns);
  assert.equal(store.get(KEY+':corrupt'),'{"acorns":','the broken blob is kept under its own key');
  store.clear();store.set(KEY,'[1,2]');Save.loadSave();assert.equal(store.get(KEY+':corrupt'),'[1,2]');
}
console.log('save shapes: 23 bad shapes load and settle, NaN floor pays nothing, total capped, beta-only stars ignored on the road, names cut by character, Start Over keeps purchases/dust/boosts and seals, corrupt blobs stashed');
