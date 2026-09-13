#!/usr/bin/env node
/** THE CRAZYGAMES SHELL (13 Sep 2026, owner: "publish to crazy games").
 *  Two halves. First the adapter against a fake SDK: it waits for init,
 *  copies an old localStorage save into the data module once, maps a
 *  rewarded ad to earned / dismissed / unavailable, a midgame ad to a
 *  resolved promise, offers nothing to an ad blocker, mutes on the
 *  portal's switch and forwards gameplay events. Then the engine's
 *  gameplay events through the real screens (happy-dom): start on launch,
 *  resume and revive; stop on pause, crash and leaving a run; the title
 *  opens on the mode the shell names; the Community rows stay home. */
import { readFileSync } from "node:fs";
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };

// ---- the adapter against a fake SDK ---------------------------------------
{
  const { install, portalFixes } = await import("../shell/crazygames/adapter.js");
  const log = [];
  let adScript = "finished"; // finished | error | dismissed
  const dataStore = new Map();
  const local = new Map([["acornaut_illust_v1", '{"old":1}'], ["other", "x"]]);
  const fakeLocal = {
    get length() { return local.size; }, key: (i) => [...local.keys()][i] ?? null,
    getItem: (k) => local.get(k) ?? null, setItem: (k, v) => local.set(k, v), removeItem: (k) => local.delete(k),
  };
  let settingsListener = null;
  const SDK = {
    environment: "crazygames",
    async init() { log.push("init"); },
    ad: {
      async hasAdblock() { return false; },
      requestAd(type, cb) {
        log.push("ad:" + type);
        queueMicrotask(() => {
          if (adScript === "error") { cb.adError({ code: "unfilled" }); return; }
          cb.adStarted();
          if (adScript === "dismissed") cb.adError({ code: "other" }); else cb.adFinished();
        });
      },
    },
    game: {
      settings: { muteAudio: false },
      gameplayStart: () => log.push("start"), gameplayStop: () => log.push("stop"), happytime: () => log.push("happy"),
      loadingStart: () => log.push("loading"), loadingStop: () => log.push("loaded"),
      addSettingsChangeListener: (fn) => { settingsListener = fn; },
    },
    data: { getItem: (k) => dataStore.get(k) ?? null, setItem: (k, v) => dataStore.set(k, v), removeItem: (k) => dataStore.delete(k) },
  };
  const win = { localStorage: fakeLocal, addEventListener() {}, document: { addEventListener() {} } };
  const { adapter, init } = install(win, SDK);
  ok(win.__acornautPlatform === adapter, "install hands the bridge its adapter");
  ok(adapter.kind === "web" && adapter.links === false && adapter.devDoors === false && adapter.defaultMode === "spill",
    "a portal build: web kind, no doors out, no dev doors, Debris Field first");
  ok(!adapter.ads.rewardedReady() && adapter.storage.get("acornaut_illust_v1") === '{"old":1}',
    "before init: no ads, and reads come from localStorage");
  await init();
  ok(log[0] === "init" && adapter.__cg.ready, "init awaits the SDK");
  ok(dataStore.get("acornaut_illust_v1") === '{"old":1}' && !dataStore.has("other"), "an old acornaut save is copied into the data module once, other keys are not");
  dataStore.set("acornaut_illust_v1", '{"new":2}');
  ok(adapter.storage.get("acornaut_illust_v1") === '{"new":2}', "after init the data module answers reads");
  adapter.storage.set("k", "v");
  ok(dataStore.get("k") === "v" && local.get("k") === "v", "writes land in the data module and the local copy");
  adapter.storage.remove("k");
  ok(!dataStore.has("k") && !local.has("k"), "remove clears both");
  // ads
  let muted = 0;
  ok(adapter.ads.rewardedReady() && adapter.ads.interstitialReady(), "after init both ad kinds are ready");
  ok((await adapter.ads.rewarded("continue", () => muted++)) === "earned" && muted === 1, "a watched rewarded ad is earned, the game muted on adStarted");
  adScript = "dismissed";
  ok((await adapter.ads.rewarded("dust", () => muted++)) === "dismissed" && muted === 2, "an ad closed after it started is dismissed");
  adScript = "error";
  ok((await adapter.ads.rewarded("dust", () => muted++)) === "unavailable" && muted === 2, "an adError before the ad started pays nothing and never muted");
  adScript = "finished";
  ok((await adapter.ads.interstitial("crash", () => muted++)) === undefined && muted === 3 && log.includes("ad:midgame"), "a midgame ad resolves; it asked the SDK for midgame");
  ok(!adapter.__cg.showing, "nothing is showing afterwards");
  // one at a time
  const p1 = adapter.ads.rewarded("continue"); const p2 = adapter.ads.rewarded("continue");
  ok((await p2) === "unavailable" && (await p1) === "earned", "a second request while one plays is unavailable");
  // gameplay + mute
  const hooks = { mute: (m) => log.push("mute:" + m) };
  adapter.listen(hooks);
  ok(log.at(-1) === "mute:false", "listen applies the portal's current setting");
  settingsListener({ muteAudio: true });
  ok(log.at(-1) === "mute:true", "and the portal's switch reaches the game");
  adapter.gameplay.start(); adapter.gameplay.stop(); adapter.gameplay.happy();
  ok(log.slice(-3).join() === "start,stop,happy", "gameplay events reach the SDK");
  // adblock: nothing offered
  const SDK2 = { ...SDK, ad: { ...SDK.ad, async hasAdblock() { return true; } } };
  const w2 = { localStorage: fakeLocal, addEventListener() {}, document: { addEventListener() {} } };
  const { adapter: a2, init: init2 } = install(w2, SDK2);
  await init2();
  ok(a2.__cg.adblock && !a2.ads.rewardedReady() && !a2.ads.interstitialReady(), "an ad blocker means no ad is ever offered");
  ok((await a2.ads.rewarded("continue")) === "unavailable", "and a request answers unavailable without touching the SDK");
  // no SDK at all: a plain web page
  const w3 = { localStorage: fakeLocal, addEventListener() {}, document: { addEventListener() {} } };
  const { adapter: a3, init: init3 } = install(w3, undefined);
  await init3();
  ok(!a3.__cg.ready && !a3.ads.rewardedReady() && a3.storage.get("acornaut_illust_v1") === '{"old":1}', "without the SDK script the game runs from localStorage with no ads");
  // fixes: the page never scrolls under the game
  const events = {};
  const w4 = { addEventListener: (n, fn) => { events[n] = fn; }, document: { addEventListener: (n, fn) => { events[n] = fn; } } };
  portalFixes(w4);
  let prevented = 0; const ev = (code, target = {}) => ({ code, target, preventDefault: () => prevented++ });
  events.keydown(ev("Space")); events.keydown(ev("ArrowDown")); events.keydown(ev("KeyW")); events.keydown(ev("Space", { tagName: "INPUT" }));
  events.wheel({ preventDefault: () => prevented++ });
  ok(prevented === 3, "space and arrows are swallowed outside inputs, letters and typing are not, wheel is");
  // source rules: the adapter reaches for no other SDK and the build script skips what a portal must not carry
  const src = readFileSync(new URL("../shell/crazygames/adapter.js", import.meta.url), "utf8");
  ok(!/admob|capacitor|revenuecat/i.test(src), "the portal adapter imports no store or AdMob SDK");
  const build = readFileSync(new URL("../shell/build-crazygames.mjs", import.meta.url), "utf8");
  ok(/sdk\.crazygames\.com\/crazygames-sdk-v3\.js/.test(build) && /"beta", "lab"/.test(build) && /"CNAME"/.test(build), "the build adds the SDK tag and leaves beta, lab and the Pages hostname behind");
}

// ---- the engine's gameplay events through the real screens ---------------
const events = [];
let mute = null;
globalThis.window = {
  location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  __acornautPlatform: {
    kind: "web", devDoors: false, links: false, defaultMode: "spill",
    storage: (() => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; })(),
    gameplay: { start: () => events.push("start"), stop: () => events.push("stop"), happy: () => events.push("happy") },
    listen: (h) => { mute = h.mute; },
  },
};
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), documentElement: { style: {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const P = await import("../docs/js/platform.js");
ok(P.platform.defaultMode === "spill" && P.platform.links === false && !P.platform.adsReady, "the bridge reads the shell's default mode and link rule; no ads adapter, no ads");
P.platform.gameplayStart(); P.platform.celebrate();
ok(events.join() === "start,happy", "gameplay events pass through the bridge");
events.length = 0;

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
const engine=win.__sandbox;ok(engine,"the game boots on the portal shell");
const tick=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}};
if (engine) {
  ok(typeof mute === "function", "the engine handed the shell its mute hook at boot");
  Object.assign(engine.save, { tutorialDone: true, guide: "done" });
  engine.open("title"); tick(2);
  const text = () => app.textContent;
  ok(/DEBRIS FIELD SELECTED/.test(text()), "the title opens with Debris Field selected when the shell says so");
  ok(!/Discord|@AcornautGame/.test(text()), "no Community links on the hub");
  engine.open("profile"); tick(2);
  ok(!/Discord|@AcornautGame|acornaut@outlook/.test(text()), "and none on the Pilot screen either");
  engine.open("title"); tick(1); events.length = 0;
  engine.fly("fly"); tick(2);
  ok(events.join() === "start", "launching a run starts gameplay");
  engine.pause(); tick(1);
  ok(events.join() === "start,stop", "pausing stops it");
  engine.resume(); tick(1);
  ok(events.join() === "start,stop,start", "resuming starts it again");
  const w = engine.world; w.ready = false; w.invulnLeft = 0; w.planets = []; w.pickups = []; w.squirrel.y = w.H + 400; tick(4);
  ok(w.screen === "dead" && events.at(-1) === "stop", "a crash stops gameplay");
  events.length = 0; engine.save.acorns = 50;
  ok(engine.continueRun() && events.join() === "start", "an acorn continue starts it again");
  events.length = 0; engine.open("title"); tick(1);
  ok(events.join() === "stop", "leaving a run for the title stops it");
  events.length = 0; engine.open("title"); tick(1);
  ok(events.length === 0, "a screen change outside a run reports nothing");
  // the mute hook silences and restores without touching the pilot's settings
  engine.setMusicOff(false); engine.setSfxOff(false);
  mute(true); ok(!engine.save.musicOff && !engine.save.sfxOff, "the shell's mute writes nothing into the save");
  mute(false);
}

if (fail.length) { console.log("FAIL\n  " + fail.join("\n  ")); process.exit(1); }
console.log("crazygames: SDK adapter (init, migration, rewarded earned/dismissed/unavailable, midgame, adblock, mute, gameplay), portal fixes, bridge flags, engine gameplay start/stop through the real screens, Debris Field default, no links - passed");
