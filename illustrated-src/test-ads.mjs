#!/usr/bin/env node
/** ADS THROUGH THE BRIDGE (13 Sep 2026, owner: "just ad revenue for now ...
 *  tying in ads"). A fake ads adapter with scripted outcomes proves: the
 *  crash sheet's ad continue revives without touching the wallet and only
 *  on "earned"; the Shop's ad dust pays AD_RULES.rewardedDust up to the
 *  daily cap; the interstitial plays only at the crash sheet's exit, after
 *  the grace runs, every Nth crash, never inside the gap; and a page with
 *  no ads adapter offers none of it. Runs against docs/js like the rest. */
import { readFileSync } from "node:fs";
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
let rewardedOutcome = "earned", rewardedReady = true, interstitialReady = true;
const shown = [];
globalThis.window = {
  location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  __acornautPlatform: {
    kind: "ios", devDoors: false,
    storage: (() => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; })(),
    ads: {
      rewardedReady: () => rewardedReady,
      async rewarded(placement) { shown.push("rewarded:" + placement); return rewardedOutcome; },
      interstitialReady: () => interstitialReady,
      async interstitial(placement) { shown.push("interstitial:" + placement); },
    },
  },
};
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), documentElement: { style: {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const [P, C, S, Sim] = await Promise.all(["platform", "catalog", "save", "sim"].map((n) => import("../docs/js/" + n + ".js")));
ok(P.platform.adsReady && P.platform.rewardedAdReady(), "an ads adapter makes the bridge ad-ready");

// ---- the free revive in the sim ------------------------------------------
{
  const save = S.defaultSave(); Object.assign(save, { equippedSuit: "flight", tutorialDone: true, guide: "done", acorns: 3 });
  const w = Sim.makeWorld(390, 844); Sim.resetRun(w, save, "fly", false); w.screen = "dead";
  ok(Sim.canRevive(w), "a crashed free flight can be revived");
  ok(!Sim.reviveRun(w, save), "3 acorns cannot pay the 10-acorn continue");
  ok(Sim.reviveRun(w, save, true) && w.screen === "play" && save.acorns === 3, "an earned ad revives for free, the wallet untouched");
  const lvl = Sim.makeWorld(390, 844); Sim.resetRun(lvl, save, "fly", false); lvl.screen = "dead"; lvl.lvl = { id: "1-1" };
  ok(!Sim.canRevive(lvl), "a mission crash is not revivable, by ad or by acorns");
}

// ---- the engine's ad flows through the real screens (happy-dom) ----------
const {Window}=await import(process.env.ACORNAUT_HAPPY_DOM || 'happy-dom');
const win=new Window({url:'http://local/'});let now=0;const frames=new Map();let frameID=0;
win.__acornautPlatform=globalThis.window.__acornautPlatform;
for(const k of ['window','document','localStorage','navigator','HTMLElement','HTMLCanvasElement','Event','PointerEvent','KeyboardEvent','ResizeObserver','Audio'])Object.defineProperty(globalThis,k,{value:win[k],configurable:true,writable:true});
globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++frameID,fn);return frameID;};globalThis.cancelAnimationFrame=id=>frames.delete(id);win.requestAnimationFrame=globalThis.requestAnimationFrame;win.cancelAnimationFrame=globalThis.cancelAnimationFrame;
globalThis.Image=class {set src(v){queueMicrotask(()=>this.onerror?.());}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
const ctx=new Proxy({canvas:null,measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray((w||1)*(h||1)*4),width:w||1,height:h||1}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0})},{get:(o,k)=>k in o?o[k]:()=>{}});
win.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return new Proxy(ctx,{get:(o,k)=>k==='canvas'?canvas:o[k]});};
win.HTMLCanvasElement.prototype.setPointerCapture=function(){};win.HTMLCanvasElement.prototype.releasePointerCapture=function(){};
const {bootStandalone}=await import("../docs/js/standalone.js");
const app=win.document.createElement('main');win.document.body.append(app);await bootStandalone(app);
const engine=win.__sandbox;ok(engine,"the game boots on the fake shell");
const tick=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}};
const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
if (engine) {
  Object.assign(engine.save, { tutorialDone: true, guide: "done" });
  const crash = () => { engine.open("title"); engine.fly("fly"); const w = engine.world; w.ready = false; w.invulnLeft = 0; w.planets = []; w.pickups = []; w.squirrel.y = w.H + 400; tick(4); return w.screen; };
  // ad continue
  ok(crash() === "dead", "a fall off the world crashes the run");
  engine.save.acorns = 0; tick(1);
  ok(engine.adOffer() === "ad", "the crash sheet may offer an ad continue");
  const buttons = () => [...app.querySelectorAll("button")].map((b) => b.textContent.trim());
  ok(buttons().some((t) => /WATCH AN AD/.test(t)), "and the crash sheet shows the ad button");
  rewardedOutcome = "dismissed";
  ok((await engine.continueWithAd()) === "dismissed" && engine.world.screen === "dead", "a dismissed ad does not revive");
  rewardedOutcome = "earned";
  ok((await engine.continueWithAd()) === "earned" && engine.world.screen === "play" && engine.save.acorns === 0, "an earned ad revives without acorns");
  rewardedReady = false; crash(); tick(1);
  ok(engine.adOffer() === null && !buttons().some((t) => /WATCH AN AD/.test(t)), "no loaded ad, no offer, no button");
  rewardedReady = true;
  // ad dust, capped per day
  engine.open("shop"); tick(1);
  const row = app.querySelector("[data-ad-dust]"); ok(row && !row.disabled, "the Shop shows the ad-dust row");
  const before = engine.save.starDust;
  for (let i = 0; i < C.AD_RULES.rewardedDustPerDay; i++) ok((await engine.watchAdForDust()) === "earned", `ad dust ${i + 1} pays`);
  ok(engine.save.starDust === before + C.AD_RULES.rewardedDust * C.AD_RULES.rewardedDustPerDay, "each ad pays AD_RULES.rewardedDust");
  ok((await engine.watchAdForDust()) === "spent" && engine.adDustState().left === 0, "the daily cap holds");
  tick(1); ok(app.querySelector("[data-ad-dust]")?.disabled, "the spent row is disabled");
  // interstitial cadence
  shown.length = 0;
  engine.save.runs = 0; engine.save.crashesSinceAd = 99; engine.save.lastAdAt = 0;
  let ran = 0; engine.afterCrash(() => ran++);
  ok(ran === 1 && !shown.some((s) => s.startsWith("interstitial")), "no full-screen ad inside the grace runs");
  engine.save.runs = C.AD_RULES.interstitialGraceRuns; engine.save.crashesSinceAd = C.AD_RULES.interstitialEveryCrashes - 1;
  engine.afterCrash(() => ran++);
  ok(ran === 2 && !shown.some((s) => s.startsWith("interstitial")), "not before the Nth crash");
  engine.save.crashesSinceAd = C.AD_RULES.interstitialEveryCrashes;
  await new Promise((r) => { engine.afterCrash(() => { ran++; r(); }); });
  ok(ran === 3 && shown.filter((s) => s === "interstitial:crash").length === 1 && engine.save.crashesSinceAd === 0 && engine.save.lastAdAt > 0, "the Nth crash's exit plays one full-screen ad and resets the count");
  engine.save.crashesSinceAd = C.AD_RULES.interstitialEveryCrashes;
  engine.afterCrash(() => ran++);
  ok(ran === 4 && shown.filter((s) => s === "interstitial:crash").length === 1, "never twice inside the gap");
  // a crash counts toward the cadence; a mission crash does not
  engine.save.crashesSinceAd = 0; crash(); ok(engine.save.crashesSinceAd === 1, "a free-flight crash counts toward the cadence");
  ok(typeof engine.save.adDustDay === "string", "the ad ledger lives on the save");
}

// ---- the pages: web offers nothing, beta pretends -------------------------
const src = readFileSync(new URL("../docs/js/platform.js", import.meta.url), "utf8");
ok(/__ACORNAUT_BETA__/.test(src) && /betaAds/.test(src), "the beta page carries the stand-in ads");
ok(/adsReady: !!ads/.test(src), "a page with no adapter and no beta flag has no ads");

if (fail.length) { console.error("ads: FAIL\n  " + fail.join("\n  ")); process.exit(1); }
console.log(`ads: rewarded continue (earned/dismissed/unloaded), ${C.AD_RULES.rewardedDustPerDay}x${C.AD_RULES.rewardedDust} ad dust with a daily cap, interstitial grace/cadence/gap, free revive in the sim, web/beta split - passed`);
