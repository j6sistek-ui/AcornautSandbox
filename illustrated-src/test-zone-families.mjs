#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>({getContext:()=>null,style:{}}),addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const Cat=await import('../docs/js/catalog.js'), C=await import('../docs/js/campaign.js'), V=await import('../docs/js/zone-visuals.js');
const Bag=await import('../docs/js/planet-family.js'), Contrast=await import('../docs/js/planet-contrast.js');
const Sim=await import('../docs/js/sim.js'), S=await import('../docs/js/save.js'), Spill=await import('../docs/js/spill.js');
const roster=JSON.parse(readFileSync(root+'art-src/zone-identity/roster.json'));
assert.equal(Cat.PLANET_COUNT,134);assert.equal(Cat.DEBRIS_COUNT,55);
assert.equal(Cat.PLANET_RGB.length,134);assert(Cat.PLANET_RGB.every(c=>c?.length===3&&c.every(Number.isFinite)));
const planets=new Set(),debris=new Set();
for(const zone of roster.zones){
 const env=Cat.ENVS[zone.env];assert.deepEqual(env.planetBias,zone.planets);assert.deepEqual(env.debrisBias,zone.debris);
 assert.equal(zone.planets.length,5);assert(zone.debris.length>=2&&zone.debris.length<=3);
 for(const [ids,seen,folder] of [[zone.planets,planets,'planets'],[zone.debris,debris,'debris']])for(const id of ids){
  assert(!seen.has(id),`${folder}/${id} reused across zones`);seen.add(id);
  assert(existsSync(root+`docs/art/${folder}/${id}.png`),`missing ${folder}/${id}`);
 }
 const levels=C.LEVELS.filter(l=>l.fx.env===zone.env);
 assert.equal(levels.length,10);assert.equal(new Set(levels.map(V.mapPlanetIndex)).size,5);
 for(const def of levels){assert(zone.planets.includes(V.mapPlanetIndex(def)));assert.equal(V.mapPlanetIndex(def),V.mapPlanetIndex({...def,ord:999}));}
 for(const roll of [0,.173,.5,.999999]){
  const bag={env:-1,remaining:[],last:-1},sequence=[];
  for(let i=0;i<50;i++)sequence.push(Bag.nextFamilyPlanet(bag,zone.env,()=>roll));
  for(let i=0;i<50;i+=5)assert.equal(new Set(sequence.slice(i,i+5)).size,5);
  for(let i=1;i<50;i++)assert.notEqual(sequence[i],sequence[i-1]);
  const next=(zone.env+1)%26;assert(Cat.ENVS[next].planetBias.includes(Bag.nextFamilyPlanet(bag,next,()=>roll)));
 }
}
assert.equal(planets.size,130);assert.equal(debris.size,55);
for(const id of [7,14,17,32])assert(!planets.has(id)&&existsSync(root+`docs/art/planets/${id}.png`));
// Matching grey enables a faint halo; strong luminance/hue contrast needs none.
const grey=Cat.PLANET_RGB[5];assert(Contrast.planetHalo(5,grey)?.opacity>.99);
assert.equal(Contrast.planetHalo(5,[1,1,1]),undefined);
assert.equal(Contrast.planetHalo(5,[1,0,0]),undefined);
assert.equal(Contrast.planetHalo(999,grey),undefined);
const signature=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const baseline=JSON.parse(readFileSync(root+'illustrated-src/design/zone-identity-implementation/geometry-baseline.json'));
Math.random=()=>.413;
let checked=0,spillChecks=0;
for(const expected of baseline.records){
 const {W,H,id}=expected,def=C.LEVELS.find(l=>l.id===id),save=S.defaultSave();save.tutorialDone=true;
 const w=Sim.makeWorld(W,H);Sim.resetRun(w,save,def.base,false,def);
 const geometry={phases:[w.driftPhase,w.tiltPhase],planets:w.planets.map(({topKind,botKind,blockers,...p})=>({...p,blockers:blockers.map(({kind,debris,...b})=>b)})),pickups:w.pickups};
 for(const p of w.planets){assert(Cat.ENVS[def.fx.env].planetBias.includes(p.topKind));assert.equal(p.topKind,p.botKind);for(const b of p.blockers)assert(Cat.ENVS[def.fx.env].debrisBias.includes(b.debris));}
 if(w.spill){
  const s=w.spill;s.welcome=false;s.openingEnabled=false;s.pilot.y=H*.45;s.iframes=10000;Spill.spillTap(s);
  for(let q=0;q<300&&s.phase!=='wave';q++){Spill.stepSpill(s,1/60);s.pilot.y=H*.45;s.pilot.vy=0;}
  for(let i=0;i<600;i++){Spill.stepSpill(s,1/60);s.pilot.y=H*.45;s.pilot.vy=0;s.iframes=10000;}
  geometry.spill={rng:s.rng,rocks:s.rocks.map(({sprite,...r})=>r),nuts:s.nuts,wave:s.wave,event:s.event};
  assert(s.rocks.length>0,`Spill fixture did not exercise spawning: ${id}`);
  for(const rock of s.rocks)assert(Cat.ENVS[def.fx.env].debrisBias.includes(rock.sprite));spillChecks++;
 }
 assert.equal(signature(geometry),expected.sha256,`main geometry changed: ${id} ${W}x${H}`);checked++;
}
const shipping=JSON.parse(readFileSync(root+'art-src/zone-identity/shipping-manifest.json'));
assert.equal(shipping.assets.length,129);
for(const a of shipping.assets)assert.equal(createHash('sha256').update(readFileSync(root+a.output)).digest('hex'),a.sha256);
console.log(`Zone families: 26 exclusive rosters, 130 planets, 55 debris, all five chart worlds, shuffle seams, conditional contrast, ${checked} unchanged main geometry fixtures (${spillChecks} active Spill), and 129 shipping hashes passed`);
