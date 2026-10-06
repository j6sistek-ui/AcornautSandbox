// Runs the complete native adapter and its boot path with no SDK, network,
// dependencies, browser or device. Run: node --experimental-vm-modules shell/test-adapter-consent.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";

const adapterSource = readFileSync(new URL("./adapter/adapter.js", import.meta.url), "utf8");
const RewardAdPluginEvents = {
  Rewarded: "rewarded.rewarded", Showed: "rewarded.showed", Dismissed: "rewarded.dismissed", FailedToShow: "rewarded.failed",
};
const InterstitialAdPluginEvents = {
  Showed: "interstitial.showed", Dismissed: "interstitial.dismissed", FailedToShow: "interstitial.failed",
};
const allowed = { status: "NOT_REQUIRED", isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: "NOT_REQUIRED" };
const required = { status: "REQUIRED", isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };

async function fixture(options = {}) {
  const calls = [], listeners = new Map(), timers = new Map(), warnings = [];
  let timerId = 0, consentIndex = 0, rewardedPrepareIndex = 0, interstitialPrepareIndex = 0, bootCount = 0;
  const record = async (method, args, run) => {
    calls.push({ method, args });
    if (options.fail === method) throw new Error(`mock ${method} failure`);
    return run ? run() : undefined;
  };
  const AdMob = {
    initialize: (args) => record("initialize", args),
    addListener: (event, callback) => record("addListener", event, () => {
      if (options.listenerFailure === event) throw new Error("mock listener failure");
      listeners.set(event, callback);
      return { remove: async () => listeners.delete(event) };
    }),
    requestConsentInfo: (args) => record("requestConsentInfo", args, () => {
      const responses = options.consent || [allowed];
      const response = responses[Math.min(consentIndex++, responses.length - 1)];
      if (response instanceof Error) throw response;
      return response;
    }),
    showConsentForm: () => record("showConsentForm", undefined, () => options.formInfo || { ...allowed, status: "OBTAINED", privacyOptionsRequirementStatus: "REQUIRED" }),
    showPrivacyOptionsForm: () => record("showPrivacyOptionsForm", undefined, () => options.privacyForm?.promise),
    prepareRewardVideoAd: (args) => record("prepareRewardVideoAd", args, () => {
      const pending = Array.isArray(options.prepareRewarded) ? options.prepareRewarded[rewardedPrepareIndex++] : options.prepareRewarded;
      return pending?.promise;
    }),
    prepareInterstitial: (args) => record("prepareInterstitial", args, () => {
      const pending = Array.isArray(options.prepareInterstitial) ? options.prepareInterstitial[interstitialPrepareIndex++] : options.prepareInterstitial;
      return pending?.promise;
    }),
    showRewardVideoAd: () => record("showRewardVideoAd"),
    showInterstitial: () => record("showInterstitial"),
  };
  const window = {};
  const appElement = {};
  const context = createContext({
    window, URL,
    document: {
      baseURI: "https://fixture.invalid/",
      querySelector: (selector) => selector === "script[data-bundle]" ? { dataset: { bundle: "./mock-game.js" } } : null,
      getElementById: (id) => id === "app" ? appElement : null,
    },
    localStorage: { length: 0, key: () => null, getItem: () => null },
    console: { warn: (...args) => warnings.push(args), error: (...args) => { throw new Error(`adapter boot error: ${args.map(String).join(" ")}`); } },
    setTimeout: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  const config = {
    revenuecat: { iosApiKey: "PLACEHOLDER_IOS", androidApiKey: "PLACEHOLDER_ANDROID" },
    products: {}, leaderboards: {},
    admob: { testing: true, rewardedIos: "mock-rewarded-ios", interstitialIos: "mock-interstitial-ios" },
  };
  const modules = new Map();
  const mockModule = (id, exports) => {
    const module = new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context, identifier: id });
    modules.set(id, module);
    return module;
  };
  mockModule("@capacitor/core", { Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" }, registerPlugin: () => ({}) });
  mockModule("@capacitor/preferences", { Preferences: { keys: async () => ({ keys: [] }), get: async () => ({ value: null }), set: async () => {}, remove: async () => {} } });
  mockModule("@revenuecat/purchases-capacitor", { Purchases: {}, LOG_LEVEL: { WARN: "WARN" }, PRODUCT_CATEGORY: { NON_SUBSCRIPTION: "NON_SUBSCRIPTION" } });
  mockModule("@capacitor/app", { App: { addListener: async () => {}, minimizeApp: async () => {} } });
  mockModule("@capacitor-community/admob", { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents });
  mockModule("./config.json", { default: config });
  const game = mockModule("https://fixture.invalid/mock-game.js", { bootStandalone: (element) => {
    assert.equal(element, appElement);
    assert.equal(window.__acornautPlatform?.kind, "ios", "native bridge must exist before game boot");
    bootCount++;
  } });
  const adapter = new SourceTextModule(adapterSource, {
    context, identifier: "fixture:actual-native-adapter",
    importModuleDynamically: async (specifier) => {
      assert.equal(specifier, game.identifier, "unexpected dynamic import");
      if (game.status === "unlinked") await game.link(() => { throw new Error("mock game has no imports"); });
      if (game.status === "linked") await game.evaluate();
      return game;
    },
  });
  await adapter.link((specifier) => {
    const module = modules.get(specifier);
    assert.ok(module, `unexpected adapter import: ${specifier}`);
    return module;
  });
  await adapter.evaluate();
  await settle();
  assert.equal(bootCount, 1, "consent or SDK failure must not prevent or duplicate game boot");
  const ads = window.__acornautPlatform.ads;
  assert.ok(ads, "actual boot must expose ads API");
  return {
    ads, calls, warnings,
    count: (method) => calls.filter((call) => call.method === method).length,
    emit: async (event, payload) => { assert.ok(listeners.has(event), `missing listener ${event}`); listeners.get(event)(payload); await settle(); },
    expire: async () => { for (const [id, { callback }] of [...timers]) { timers.delete(id); callback(); } await settle(); },
  };
}

function assertBlocked(f, message) {
  assert.equal(f.ads.rewardedReady(), false, message);
  assert.equal(f.ads.interstitialReady(), false, message);
  assert.equal(f.count("prepareRewardVideoAd"), 0, message);
  assert.equal(f.count("prepareInterstitial"), 0, message);
  assert.equal(f.count("showRewardVideoAd"), 0, message);
  assert.equal(f.count("showInterstitial"), 0, message);
}
async function assertUnavailable(f) {
  assert.equal(await f.ads.rewarded("test"), "unavailable");
  await f.ads.interstitial("test");
  await settle();
}
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS adapter consent: ${name}`);
}

await test("initialize and listeners precede required consent form and ad preparation", async () => {
  const f = await fixture({ consent: [required] });
  const methods = f.calls.map((call) => call.method);
  assert.equal(methods[0], "initialize");
  const requestAt = methods.indexOf("requestConsentInfo"), formAt = methods.indexOf("showConsentForm");
  assert.ok(requestAt > 0 && formAt > requestAt);
  assert.ok(f.calls.filter((call) => call.method === "addListener").length >= 7);
  assert.ok(methods.lastIndexOf("addListener") < requestAt, "listeners must be awaited before consent and loading");
  assert.ok(methods.indexOf("prepareRewardVideoAd") > formAt);
  assert.ok(methods.indexOf("prepareInterstitial") > formAt);
  assert.equal(f.ads.rewardedReady(), true);
  assert.equal(f.ads.interstitialReady(), true);
  assert.equal(f.ads.privacyOptionsRequired(), true);
  assert.equal(f.calls.find((call) => call.method === "initialize").args.initializeForTesting, true);
  for (const call of f.calls.filter((call) => call.method.startsWith("prepare"))) {
    assert.equal(call.args.isTesting, true);
    assert.equal(call.args.npa, true);
  }
});

await test("allowed consent without required form loads both ads", async () => {
  const f = await fixture();
  assert.equal(f.count("showConsentForm"), 0);
  assert.equal(f.ads.rewardedReady(), true);
  assert.equal(f.ads.interstitialReady(), true);
  assert.equal(f.ads.privacyOptionsRequired(), false);
  assert.equal(await f.ads.showPrivacyOptionsForm(), "unavailable");
  assert.equal(f.count("showPrivacyOptionsForm"), 0);
});

for (const [name, options] of [
  ["initialization failure", { fail: "initialize" }],
  ["required listener failure", { listenerFailure: RewardAdPluginEvents.Showed }],
  ["consent request failure", { fail: "requestConsentInfo" }],
  ["required form failure", { consent: [required], fail: "showConsentForm" }],
  ["false request permission", { consent: [{ ...allowed, canRequestAds: false }] }],
  ["truthy but invalid request permission", { consent: [{ ...allowed, canRequestAds: "true" }] }],
  ["missing request permission", { consent: [{ status: "NOT_REQUIRED", isConsentFormAvailable: false }] }],
  ["form result missing request permission", { consent: [required], formInfo: { status: "OBTAINED", isConsentFormAvailable: true } }],
  ["required but unavailable consent form", { consent: [{ ...required, isConsentFormAvailable: false }] }],
]) {
  await test(`${name} blocks all prepare and show calls while game boots`, async () => {
    const f = await fixture(options);
    await assertUnavailable(f);
    assertBlocked(f, name);
  });
}

await test("privacy form blocks showing while pending and refresh revocation clears readiness", async () => {
  const privacyForm = deferred();
  const f = await fixture({ consent: [{ ...allowed, privacyOptionsRequirementStatus: "REQUIRED" }, { ...allowed, canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" }], privacyForm });
  assert.equal(f.ads.privacyOptionsRequired(), true);
  const update = f.ads.showPrivacyOptionsForm();
  await settle();
  assert.equal(f.count("showPrivacyOptionsForm"), 1);
  assert.equal(f.ads.rewardedReady(), false);
  assert.equal(f.ads.interstitialReady(), false);
  await assertUnavailable(f);
  assert.equal(f.count("showRewardVideoAd"), 0);
  assert.equal(f.count("showInterstitial"), 0);
  privacyForm.resolve();
  assert.equal(await update, "updated");
  await settle();
  assert.equal(f.count("requestConsentInfo"), 2, "void privacy result must be followed by fresh consent info");
  assert.equal(f.count("prepareRewardVideoAd"), 1, "revocation must not reload");
  assert.equal(f.count("prepareInterstitial"), 1);
  assert.equal(f.ads.rewardedReady(), false);
  assert.equal(f.ads.interstitialReady(), false);
  await assertUnavailable(f);
  assert.equal(f.count("showRewardVideoAd"), 0);
  assert.equal(f.count("showInterstitial"), 0);
});

for (const [name, options] of [
  ["privacy form error", { fail: "showPrivacyOptionsForm", consent: [{ ...allowed, privacyOptionsRequirementStatus: "REQUIRED" }] }],
  ["privacy refresh error", { consent: [{ ...allowed, privacyOptionsRequirementStatus: "REQUIRED" }, new Error("mock refresh failure")] }],
]) {
  await test(`${name} invalidates old ads and blocks reload/show`, async () => {
    const f = await fixture(options);
    assert.equal(await f.ads.showPrivacyOptionsForm(), "unavailable");
    await assertUnavailable(f);
    assert.equal(f.ads.rewardedReady(), false);
    assert.equal(f.ads.interstitialReady(), false);
    assert.equal(f.count("prepareRewardVideoAd"), 1);
    assert.equal(f.count("prepareInterstitial"), 1);
    assert.equal(f.count("showRewardVideoAd"), 0);
    assert.equal(f.count("showInterstitial"), 0);
  });
}

await test("stale preloads cannot restore readiness after a privacy change", async () => {
  const prepareRewarded = deferred(), prepareInterstitial = deferred();
  const f = await fixture({ consent: [{ ...allowed, privacyOptionsRequirementStatus: "REQUIRED" }, { ...allowed, canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" }], prepareRewarded, prepareInterstitial });
  assert.equal(f.count("prepareRewardVideoAd"), 1);
  assert.equal(f.count("prepareInterstitial"), 1);
  assert.equal(await f.ads.showPrivacyOptionsForm(), "updated");
  prepareRewarded.resolve(); prepareInterstitial.resolve();
  await settle();
  assert.equal(f.ads.rewardedReady(), false);
  assert.equal(f.ads.interstitialReady(), false);
  await assertUnavailable(f);
  assert.equal(f.count("prepareRewardVideoAd"), 1);
  assert.equal(f.count("prepareInterstitial"), 1);
  assert.equal(f.count("showRewardVideoAd"), 0);
  assert.equal(f.count("showInterstitial"), 0);
});

await test("renewed permission accepts only the current privacy generation's preloads", async () => {
  const oldRewarded = deferred(), newRewarded = deferred(), oldInterstitial = deferred(), newInterstitial = deferred();
  const f = await fixture({
    consent: [{ ...allowed, privacyOptionsRequirementStatus: "REQUIRED" }, allowed],
    prepareRewarded: [oldRewarded, newRewarded], prepareInterstitial: [oldInterstitial, newInterstitial],
  });
  assert.equal(await f.ads.showPrivacyOptionsForm(), "updated");
  await settle();
  assert.equal(f.count("prepareRewardVideoAd"), 1, "new generation must wait for the older native prepare to finish");
  assert.equal(f.count("prepareInterstitial"), 1);
  assert.equal(f.ads.rewardedReady(), false);
  assert.equal(f.ads.interstitialReady(), false);
  assert.equal(f.ads.privacyOptionsRequired(), false);
  oldRewarded.resolve(); oldInterstitial.resolve();
  await settle();
  assert.equal(f.count("prepareRewardVideoAd"), 2);
  assert.equal(f.count("prepareInterstitial"), 2);
  assert.equal(f.ads.rewardedReady(), false, "old consent generation must not mark a rewarded ad ready");
  assert.equal(f.ads.interstitialReady(), false, "old consent generation must not mark an interstitial ready");
  newRewarded.resolve(); newInterstitial.resolve();
  await settle();
  assert.equal(f.ads.rewardedReady(), true);
  assert.equal(f.ads.interstitialReady(), true);
});

await test("reward is paid only on Rewarded and started fires once on Showed", async () => {
  const f = await fixture();
  let starts = 0;
  const reward = f.ads.rewarded("test", () => { starts++; });
  await settle();
  assert.equal(f.count("showRewardVideoAd"), 1);
  assert.equal(starts, 0, "show API resolution is not an on-screen event");
  await f.emit(RewardAdPluginEvents.Showed);
  await f.emit(RewardAdPluginEvents.Showed);
  assert.equal(starts, 1);
  await f.emit(RewardAdPluginEvents.Rewarded, { amount: 1, type: "Reward" });
  await f.emit(RewardAdPluginEvents.Dismissed);
  assert.equal(await reward, "earned");
  await f.emit(RewardAdPluginEvents.Showed);
  assert.equal(starts, 1, "dismissal must clear prior started callback");
  assert.equal(f.count("prepareRewardVideoAd"), 2);
});

await test("dismissal without reward does not grant a reward", async () => {
  const f = await fixture();
  const reward = f.ads.rewarded("test");
  await settle();
  await f.emit(RewardAdPluginEvents.Dismissed);
  assert.equal(await reward, "dismissed");
});

await test("interstitial started fires once and failure clears its callback", async () => {
  const f = await fixture();
  let starts = 0;
  const presentation = f.ads.interstitial("test", () => { starts++; });
  await settle();
  assert.equal(f.count("showInterstitial"), 1);
  assert.equal(starts, 0);
  await f.emit(InterstitialAdPluginEvents.Showed);
  await f.emit(InterstitialAdPluginEvents.Showed);
  assert.equal(starts, 1);
  await f.emit(InterstitialAdPluginEvents.FailedToShow);
  await presentation;
  await f.emit(InterstitialAdPluginEvents.Showed);
  assert.equal(starts, 1);
  assert.equal(f.count("prepareInterstitial"), 2);
});

await test("failed show never fires started and rewarded show resolves unavailable", async () => {
  const f = await fixture({ fail: "showRewardVideoAd" });
  let starts = 0;
  assert.equal(await f.ads.rewarded("test", () => { starts++; }), "unavailable");
  await f.emit(RewardAdPluginEvents.Showed);
  assert.equal(starts, 0);
});

await test("lost dismissal is bounded by fake timeout and never grants a reward", async () => {
  const f = await fixture();
  const reward = f.ads.rewarded("test");
  await settle();
  await f.expire();
  assert.equal(await reward, "dismissed");
});

console.log(`PASS adapter consent: ${passed} scenarios; actual native module, mocked plugins, no SDK or live ads`);
