import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const handlers = {}, deleted = [], writes = [], requests = [];
let claimed = false, skipped = false, offline = false;
const self = {location:{origin:'https://acornaut.io'}, addEventListener:(type,fn)=>handlers[type]=fn, skipWaiting:async()=>{skipped=true},clients:{claim:async()=>{claimed=true}}};
const cache = {put:async(...args)=>writes.push(args)};
const caches = {open:async()=>cache,keys:async()=>['acornaut-old','acornaut-test','unrelated-cache'],delete:async key=>deleted.push(key),match:async()=>new Response('offline shell')};
class WorkerRequest extends Request {constructor(url,options){super(new URL(url,'https://acornaut.io/'),options);}}
const fetch = async (req, options) => {requests.push({req,options});if(offline)throw Error('offline');if(String(req.url).includes('icon-512'))throw Error('missing optional icon');return new Response('fresh');};
vm.runInNewContext(fs.readFileSync(new URL('./parts/sw.js',import.meta.url),'utf8').replaceAll('__CACHE_VERSION__','test'),{self,caches,fetch,Request:WorkerRequest,URL,Promise});
let work;
handlers.install({waitUntil:p=>work=p});await work;assert.equal(skipped,true,'one missing icon must not block activation');
handlers.activate({waitUntil:p=>work=p});await work;assert.deepEqual(deleted,['acornaut-old']);assert.equal(claimed,true);
function event(path,mode='cors',range=false){let response;handlers.fetch({request:{method:'GET',url:'https://acornaut.io'+path,mode,headers:{has:()=>range}},respondWith:p=>response=p});return response;}
assert.equal(await (await event('/','navigate')).text(),'fresh');assert.equal(requests.at(-1).options.cache,'no-cache','navigation must revalidate HTTP cache');
offline=true;assert.equal(await (await event('/arcade/','navigate')).text(),'offline shell');
assert.equal(event('/clips/crew-showcase.mp4?v=123'),undefined);assert.equal(event('/assets/movie.webm'),undefined);assert.equal(event('/beta/index.html','navigate'),undefined);assert.equal(event('/assets/image.webp','cors',true),undefined);
console.log('Cache tests passed: activation, scoped cleanup, fresh navigation, offline fallback, video/range/beta bypass.');
for (const initiallyControlled of [false,true]) {
  const listeners={};let reloads=0,checks=0,clock=0,interval;
  const document={hidden:false,addEventListener:(type,fn)=>listeners[type]=fn};
  const serviceWorker={controller:initiallyControlled?{}:null,addEventListener:(type,fn)=>listeners[type]=fn,register:async(url,options)=>{assert.equal(options.updateViaCache,'none');return {update:async()=>{checks++}}}};
  vm.runInNewContext(fs.readFileSync(new URL('./parts/updates.js',import.meta.url),'utf8'),{navigator:{serviceWorker},document,location:{reload:()=>reloads++},Date:{now:()=>clock},addEventListener:(type,fn)=>listeners[type]=fn,setInterval:fn=>interval=fn});
  await Promise.resolve();listeners.controllerchange();assert.equal(reloads,initiallyControlled?1:0);
  listeners.controllerchange();listeners.controllerchange();assert.equal(reloads,1,'update should reload only once');
  clock=61000;interval();assert.equal(checks,1);interval();assert.equal(checks,1);
  clock=122000;document.hidden=true;interval();assert.equal(checks,1);document.hidden=false;listeners.visibilitychange();assert.equal(checks,2);
}
console.log('Landing update tests passed: first install, one-time refresh, throttled checks, background pause.');
