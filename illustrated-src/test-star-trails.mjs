#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createCanvas} = require(process.env.ACORNAUT_CANVAS || '@napi-rs/canvas');
const T = await import('../docs/js/star-trails.js');
const C = await import('../docs/js/catalog.js');
const {STAR_REWARDS} = await import('../docs/js/campaign.js');
const S = await import('../docs/js/save.js');
const Sim = await import('../docs/js/sim.js');
const D = await import('../docs/js/draw.js');

const rewards = STAR_REWARDS.filter(r => r.kind === 'trail' && !C.builtInTrailSuit(r.id)).map(r => r.id);
assert.deepEqual([...C.STAR_CHART_TRAILS].sort(), [...new Set(rewards)].sort(), 'every equipable Star Chart reward is upgraded');
assert.deepEqual(Object.keys(T.STAR_TRAIL_PROFILES).sort(), [...C.STAR_CHART_TRAILS].sort());
const frame = (time, extra = {}) => ({time, x: 420, y: 90 + time * 18, travel: time * 150,
  scale: 1, power: .6, active: true, ...extra});
const c = createCanvas(500, 220), ctx = c.getContext('2d');
let points;
for (const fps of [30, 60, 144]) {
  const h = T.createTrailHistory('ion');
  for (let i = 0; i <= fps * 5; i++) points = T.sampleStarTrail(h, 'ion', frame(i / fps));
  assert(h.samples.length <= T.STAR_TRAIL_MAX_SAMPLES, 'bounded history');
  const tail = points.at(-1);
  assert(tail.age > 1.4 && tail.age < 1.451, 'same long retention at every frame rate');
  assert(points[0].x - tail.x > 365, 'scroll plus exhaust retains a long stream');
  assert(Math.abs(tail.y - (180 - tail.age * 18)) < .01, 'tail stays on historical flight path');
  const before = JSON.stringify(h.samples);
  for (let i = 0; i < 10; i++) T.sampleStarTrail(h, 'ion', frame(5));
  assert.equal(JSON.stringify(h.samples), before, 'repaint does not emit');
  for (const change of [{scale:2},{x:900},{travel:3000},{time:1}]) {
    const copy = structuredClone(h);
    T.sampleStarTrail(copy, 'ion', frame(5.01, change));
    assert(copy.samples.length <= 1, 'resize, teleport and reset have no bridging line');
  }
  T.sampleStarTrail(h, 'frost', frame(5.01)); assert.equal(h.samples.length, 1, 'switching trail clears old shape');
  for (let i = 1; i <= 100; i++) T.sampleStarTrail(h, 'frost', frame(5.01 + i / 60, {active:false}));
  assert.equal(h.samples.length, 0, 'crash stops emission and the wake expires');
}

// Real raster output: all materials are distinct, visible on the first card
// paint and long in flight. The painter restores its caller's canvas state.
const signatures = new Set();
for (const id of C.STAR_CHART_TRAILS) {
  ctx.clearRect(0,0,500,220);
  const h = T.createTrailHistory(id);
  for (let i = 0; i <= 120; i++) points = T.sampleStarTrail(h,id,frame(i / 60));
  ctx.globalAlpha = .73; ctx.lineWidth = 7; ctx.globalCompositeOperation = 'source-over';
  const alphaBefore = ctx.globalAlpha;
  T.paintStarTrail(ctx,id,points,2);
  assert.equal(ctx.globalAlpha, alphaBefore); assert.equal(ctx.lineWidth, 7);
  assert.equal(ctx.globalCompositeOperation, 'source-over');
  const data = ctx.getImageData(0,0,500,220).data;
  let first = 500, last = 0, pixels = 0;
  for (let y=0;y<220;y++) for (let x=0;x<500;x++) if(data[(y*500+x)*4+3]>5){first=Math.min(first,x);last=Math.max(last,x);pixels++;}
  assert(last-first>220 && pixels>300, id+' has a long, rendered stream');
  ctx.globalAlpha=1; ctx.clearRect(0,0,500,220);
  D.paintTrailPreview(ctx,C.TRAILS.find(t=>t.id===id),32,28,0);
  const card=ctx.getImageData(0,0,64,56).data;
  assert(card.some((v,i)=>i%4===3 && v>20), id+' is visible at t=0');
  signatures.add(Buffer.from(card).toString('base64'));
}
assert.equal(signatures.size,13,'thirteen distinct material previews');

// Presentation must never consume gameplay randomness or fill its particle pool.
const save=S.defaultSave(), w=Sim.makeWorld(390,844);
save.equippedSuit='flight';
const random=Math.random;
Math.random=()=>{throw Error('trail consumed gameplay randomness');};
try {
  for(const id of C.STAR_CHART_TRAILS){save.equippedTrail=id;Sim.spawnTrail(w,save);D.paintTrailPreview(ctx,C.TRAILS.find(t=>t.id===id),32,28,.8);}
} finally {Math.random=random;}
assert.equal(w.particles.length,0,'no duplicate legacy bursts');
assert.equal(C.trailWornBy('ion','arcflash'),'arcflashwake','built-in ownership preserved');
assert.equal(C.trailWornBy('ion','flight'),'ion');

// Pause freezes both the stream and its fine animation; resume preserves length.
const owner={};
for(let i=0;i<=120;i++) T.paintLiveStarTrail(ctx,owner,'ion',frame(i/60));
ctx.clearRect(0,0,500,220); T.paintLiveStarTrail(ctx,owner,'ion',frame(2));
const atPause=ctx.getImageData(0,0,500,220).data;
ctx.clearRect(0,0,500,220); T.paintLiveStarTrail(ctx,owner,'ion',frame(25),true);
assert.deepEqual(ctx.getImageData(0,0,500,220).data,atPause,'pause does not drift');
ctx.clearRect(0,0,500,220); T.paintLiveStarTrail(ctx,owner,'ion',frame(25,{travel:300,y:126}));
const resumed=ctx.getImageData(0,0,500,220).data;
assert(resumed.some((v,i)=>i%4===3 && i/4%500<200 && v>5),'resume keeps the old stream');
assert.deepEqual(resumed,atPause,'resume also preserves the fine animation phase');
console.log('13 Star Chart materials: retained path at 30/60/144 Hz, bounded history, resets, crash decay, card rasters, canvas isolation, zero gameplay RNG, pause/resume passed');
