#!/usr/bin/env node
// Browser receipts use an isolated profile. No installed player's save is read.
// Set ACORNAUT_PLAYWRIGHT / ACORNAUT_BROWSER when using existing local tooling.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const spec=process.env.ACORNAUT_PLAYWRIGHT||'playwright';
const {chromium}=await import(spec.includes(':')&&!spec.startsWith('file:')?pathToFileURL(spec).href:spec);
const base=process.env.ACORNAUT_QA_URL||'http://127.0.0.1:8769/';
const out=process.env.ACORNAUT_QA_OUTPUT||root+'illustrated-src/design/zone-identity-implementation/';mkdirSync(out,{recursive:true});
const stamp=readFileSync(root+'illustrated-src/game/catalog.ts','utf8').match(/ART_VER = "(\d+)"/)[1];
const roster=JSON.parse(readFileSync(root+'art-src/zone-identity/roster.json')).zones;
const browser=await chromium.launch({headless:true,...(process.env.ACORNAUT_BROWSER?{executablePath:process.env.ACORNAUT_BROWSER}:{})});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[],failedArt=[],requests=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/\/art\/(planets|debris)\//.test(r.url()))requests.push(r.url());});
page.on('response',r=>{if(/\/art\/(planets|debris)\//.test(r.url())&&r.status()!==200)failedArt.push([r.status(),r.url()]);});
await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__sandbox,{timeout:60000});
await page.evaluate(async()=>{await window.__sandbox.artReady;window.__sandbox.stop();});
const bootPlanets=[...new Set(requests.filter(u=>u.includes('/planets/')).map(u=>Number(u.match(/planets\/(\d+)/)[1])))].sort((a,b)=>a-b);
assert.deepEqual(bootPlanets,roster.find(z=>z.env===0).planets.slice().sort((a,b)=>a-b));
await page.evaluate(async stamp=>{
 const C=await import(`/js${stamp}/campaign.js?v=${stamp}`),P=await import(`/js${stamp}/campaign-progress.js?v=${stamp}`);
 const e=window.__sandbox;Object.assign(e.save,{tutorialDone:true,guide:'done',introOff:true,musicOff:true,sfxOff:true,motionOff:true,raceGates:[33,66,99]});
 e.save.stars=Object.fromEntries(C.LEVELS.map(l=>[l.id,7]));delete e.save.campaignProgress;P.migrateCampaign(e.save,true);
},stamp);
const receipts=[];
async function flight(zone,width=390,height=844){
 await page.setViewportSize({width,height});
 const result=await page.evaluate(async({stamp,zone})=>{
  const C=await import(`/js${stamp}/campaign.js?v=${stamp}`),A=await import(`/js${stamp}/art.js?v=${stamp}`),V=await import(`/js${stamp}/zone-visuals.js?v=${stamp}`),D=await import(`/js${stamp}/draw.js?v=${stamp}`),Sim=await import(`/js${stamp}/sim.js?v=${stamp}`);
  const e=window.__sandbox,def=C.LEVELS.find(l=>l.fx.env===zone.env);e.stop();const launched=e.flyLevel(def.id);e.resize();
  await A.loadZoneArt(e.art,zone.env);V.zonePainting(zone.env);
  for(let i=0;i<100&&!V.zonePainting(zone.env);i++)await new Promise(r=>setTimeout(r,20));
  const w=e.world;w.ready=false;w.time=2;w.planets.forEach((p,i)=>{p.x=w.W*.65+i*290;});
  const p=w.planets[0],kind=zone.env===6?62:zone.planets[2];p.topKind=p.botKind=kind;w.squirrel.y=Sim.liveGapY(p,w);w.squirrel.vy=0;
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);D.drawWorld(ctx,w,e.save,e.art);D.drawHud(ctx,w,e.art,e.save);
  const times=[];for(let i=0;i<90;i++){const t=performance.now();D.drawWorld(ctx,w,e.save,e.art);times.push(performance.now()-t);}times.sort((a,b)=>a-b);
  D.drawHud(ctx,w,e.art,e.save);
  return {launched,env:w.envB,kind,gap:p.gap,radius:p.r,width:w.W,height:w.H,loaded:zone.planets.every(k=>!!e.art.planets[k]),drawMedianMs:times[45],drawP95Ms:times[85]};
 },{stamp,zone});
 assert(result.launched&&result.loaded&&result.env===zone.env);assert(zone.planets.includes(result.kind));
 const file=`${zone.id}-flight${width===390?'':`-${width}`}.png`;await page.screenshot({path:out+file});return {...result,file};
}
for(const zone of roster){
 await page.evaluate(()=>window.__sandbox.open('log'));
 await page.waitForSelector('.ac-mapnode');
 await page.evaluate(async({stamp,env})=>{const C=await import(`/js${stamp}/campaign.js?v=${stamp}`);const ids=C.LEVELS.filter(l=>l.fx.env===env).map(l=>l.id);document.querySelector(`[data-level="${ids[4]}"]`).scrollIntoView({block:'center'});},{stamp,env:zone.env});
 await page.waitForFunction(ids=>{const cs=[...document.querySelectorAll('.ac-mapdisc canvas')];return cs.every(c=>c.dataset.ready==='true')&&new Set(cs.map(c=>Number(c.dataset.planet)).filter(k=>ids.includes(k))).size===5;},zone.planets,{timeout:30000});
 const chart=await page.evaluate(async({stamp,env})=>{
  const C=await import(`/js${stamp}/campaign.js?v=${stamp}`),V=await import(`/js${stamp}/zone-visuals.js?v=${stamp}`);
  return [...document.querySelectorAll('.ac-mapdisc canvas')].map(c=>{const def=C.LEVELS.find(l=>l.id===c.closest('.ac-mapnode').dataset.level);const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {id:def.id,env:def.fx.env,kind:Number(c.dataset.planet),expected:V.mapPlanetIndex(def),pixels:rgba.filter((v,i)=>i%4===3&&v>0).length};});
 },{stamp,env:zone.env});
 assert(chart.every(c=>c.kind===c.expected&&c.pixels>100));
 const own=chart.filter(c=>c.env===zone.env);assert.equal(new Set(own.map(c=>c.kind)).size,5);
 if([6,15,20,25].includes(zone.env))await page.screenshot({path:out+`${zone.id}-chart.png`});
 receipts.push({zone:zone.id,chart:own,flight:await flight(zone)});
 console.log(`reviewed ${zone.id}`);
}
const monochrome=roster.find(z=>z.env===6),wide=[];
for(const [W,H] of [[844,390],[1440,900]])wide.push(await flight(monochrome,W,H));
assert.deepEqual(errors,[]);assert.deepEqual(failedArt,[]);
writeFileSync(out+'browser-verification.json',JSON.stringify({stamp,profile:'isolated browser; test-only completed route',screens:'Chart is actual UI; flight captures hold the game renderer at normal dimensions with the first gate positioned for inspection.',bootPlanets,receipts,wide,errors,failedArt},null,2)+'\n');
await browser.close();console.log('26 chart families, 26 controlled flight renders, 3 viewports, cold planet loading and browser error checks passed');
