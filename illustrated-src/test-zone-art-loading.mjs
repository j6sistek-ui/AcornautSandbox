#!/usr/bin/env node
// One failed sprite must not renumber a zone or borrow another zone's art.
import assert from 'node:assert/strict';
globalThis.window={location:{href:'http://local/'},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>({getContext:()=>null,style:{}}),addEventListener(){},documentElement:{style:{}}};
const requests=[];
globalThis.Image=class {
 width=256;height=256;naturalWidth=256;naturalHeight=256;
 set src(value){this.url=value;requests.push(value);queueMicrotask(()=>value.includes('/planets/33.png')?this.onerror?.(new Error('fixture missing sprite')):this.onload?.());}
 get src(){return this.url;}
};
const A=await import('../docs/js/art.js'),Cat=await import('../docs/js/catalog.js');
const bank=A.emptyArt();
const first=A.loadZoneArt(bank,0);assert.equal(A.loadZoneArt(bank,0),first);await first;
assert.equal(requests.length,7,'only five planets and two debris requested');
assert.equal(bank.planets[33],undefined);
assert(bank.planets[34].src.includes('/planets/34.png'));
assert(bank.planets[0].src.includes('/planets/0.png'));
assert.equal(bank.planets[3],undefined,'no foreign zone fallback');
await A.loadZoneArt(bank,0);assert.equal(requests.length,7,'no duplicate zone fetch');
await Promise.all(Cat.ENVS.map((_,env)=>A.loadZoneArt(bank,env)));
assert.equal(requests.length,185);assert.equal(new Set(requests).size,185);
assert.equal(bank.planets.filter(Boolean).length,129);
assert.equal(bank.debris.filter(Boolean).length,55);
for(const id of [7,14,17,32])assert.equal(bank.planets[id],undefined,'retired alternatives stay outside zone requests');
console.log('Zone art loading: visible-family requests only, shared pending work, stable IDs after a 404, no foreign fallback or duplicate requests passed');
