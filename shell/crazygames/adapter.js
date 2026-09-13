// THE CRAZYGAMES SHELL (13 Sep 2026, owner: "publish to crazy games").
// One file, no bundler: it loads before the game and hands the bridge an
// adapter built on the CrazyGames HTML5 SDK v3 (loaded by the page from
// https://sdk.crazygames.com/crazygames-sdk-v3.js - the one external
// script a portal build is allowed). The game never sees the SDK; it sees
// window.__acornautPlatform exactly as an App Store shell would hand it.
//
//   storage  -> SDK.data (1 MB, follows a logged-in player across devices;
//               guest data lives in localStorage until they sign in)
//   ads      -> SDK.ad.requestAd("rewarded" | "midgame")
//   gameplay -> SDK.game.gameplayStart / gameplayStop / happytime
//   listen   -> SDK.game.settings.muteAudio (the portal's own mute switch)
//   links    -> false (no doors out of a portal game)
//   devDoors -> false
//   defaultMode -> "spill": the portal build leads with Debris Field
//
// Rules this adapter keeps for the reviewer (docs.crazygames.com):
//   - only SDK ads; the game mutes itself on adStarted and unmutes on
//     adFinished/adError (the bridge's `started` callback carries it)
//   - an adError never pays a reward ("unavailable", the game rewards
//     nothing) and never blocks the game (the interstitial resolves)
//   - players with an ad blocker play normally: no ad is ever offered
//   - midgame ads only at a break (the game already only asks at the
//     crash sheet's exit); the SDK's own 3-minute cooldown is honoured by
//     treating adCooldown as "nothing to show"
//   - loadingStart/loadingStop around the bundle, gameplayStart/Stop from
//     the game's own run lifecycle (engine.ts)

const LIMIT_WARN = 1024 * 1024 * 0.9; // the data module keeps 1 MB per player

/** build the adapter against an SDK object (window.CrazyGames.SDK, or a
 *  test double); `env` is what SDK.init resolved to */
export function install(win, SDK, opts = {}) {
  const defaultMode = opts.defaultMode ?? "spill";
  let ready = false;
  let showing = false;
  let adblock = false;
  let hooks = null;

  // storage: the data module is synchronous once init() has run, so the
  // bridge's contract (reads never wait) holds. Until then, or on a page
  // outside CrazyGames (environment "disabled"), localStorage answers.
  const local = {
    get: (k) => { try { return win.localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { win.localStorage.setItem(k, v); } catch { /* restricted storage */ } },
    remove: (k) => { try { win.localStorage.removeItem(k); } catch { /* ditto */ } },
  };
  const data = () => (ready && SDK?.data) ? SDK.data : null;
  const storage = {
    get(key) { const d = data(); if (!d) return local.get(key); try { return d.getItem(key); } catch { return local.get(key); } },
    set(key, value) {
      const d = data();
      if (!d) { local.set(key, value); return; }
      try {
        if (typeof value === "string" && value.length > LIMIT_WARN) console.warn(`crazygames: ${key} is ${value.length} bytes, near the 1 MB data limit`);
        d.setItem(key, value);
      } catch { local.set(key, value); }
      // and the local copy stays current, so a guest who never signs in
      // and a browser with the data module down both keep their save
      local.set(key, value);
    },
    remove(key) { const d = data(); try { d?.removeItem(key); } catch { /* ignore */ } local.remove(key); },
  };

  /** a player who flew acornaut.app before has a save in localStorage;
   *  the portal copy starts from it once, the first time the data module
   *  answers empty (docs: "copy all the existing localStorage keys into
   *  the data module if the user played your game before") */
  function migrate() {
    const d = data(); if (!d) return 0;
    let n = 0;
    try {
      for (let i = 0; i < win.localStorage.length; i++) {
        const k = win.localStorage.key(i);
        if (!k || !k.startsWith("acornaut")) continue;
        if (d.getItem(k) != null) continue;
        const v = win.localStorage.getItem(k);
        if (v != null) { d.setItem(k, v); n++; }
      }
    } catch { /* restricted storage: nothing to carry over */ }
    return n;
  }

  /** one ad of either kind; resolves the bridge's answer, never throws */
  function ad(type, started) {
    return new Promise((resolve) => {
      const nothing = type === "rewarded" ? "unavailable" : undefined;
      if (!ready || showing || adblock || !SDK?.ad?.requestAd) { resolve(nothing); return; }
      showing = true;
      let begun = false;
      const done = (out) => { showing = false; resolve(out); };
      try {
        SDK.ad.requestAd(type, {
          adStarted: () => { begun = true; try { started?.(); } catch { /* the game's mute is best effort */ } },
          adFinished: () => done(type === "rewarded" ? "earned" : undefined),
          // closed early, unfilled, cooldown, adblock: nothing is paid
          adError: () => done(type === "rewarded" ? (begun ? "dismissed" : "unavailable") : undefined),
        });
      } catch { done(nothing); }
    });
  }

  const adapter = {
    kind: "web",
    storage,
    ads: {
      rewardedReady: () => ready && !showing && !adblock,
      rewarded: (placement, started) => ad("rewarded", started),
      interstitialReady: () => ready && !showing && !adblock,
      interstitial: (placement, started) => ad("midgame", started),
    },
    gameplay: {
      start: () => { try { if (ready) SDK.game.gameplayStart(); } catch { /* ignore */ } },
      stop: () => { try { if (ready) SDK.game.gameplayStop(); } catch { /* ignore */ } },
      happy: () => { try { if (ready) SDK.game.happytime(); } catch { /* ignore */ } },
    },
    listen(h) {
      hooks = h;
      try {
        const apply = (s) => { try { hooks?.mute(!!s?.muteAudio); } catch { /* ignore */ } };
        if (ready && SDK.game?.addSettingsChangeListener) SDK.game.addSettingsChangeListener(apply);
        if (ready) apply(SDK.game?.settings);
      } catch { /* a portal without settings has no mute switch */ }
    },
    links: false,
    devDoors: false,
    defaultMode,
    /** portal state the page (and the test) can read */
    __cg: { get ready() { return ready; }, get adblock() { return adblock; }, get showing() { return showing; }, migrate },
  };

  /** await the SDK; a page outside CrazyGames (environment "disabled",
   *  or no SDK script at all) simply runs as the plain web game */
  async function init() {
    if (!SDK?.init) return adapter;
    try { await SDK.init(); ready = true; } catch { ready = false; return adapter; }
    try { adblock = !!(await SDK.ad.hasAdblock()); } catch { adblock = false; }
    migrate();
    return adapter;
  }

  win.__acornautPlatform = adapter;
  return { adapter, init };
}

/** the page's entry: install, await the SDK, then load the game bundle
 *  named on this script tag (data-bundle), reporting loading to the SDK */
export async function boot() {
  const SDK = window.CrazyGames?.SDK;
  const { init } = install(window, SDK);
  await init();
  try { SDK?.game?.loadingStart?.(); } catch { /* ignore */ }
  const src = new URL(document.querySelector("script[data-bundle]")?.dataset.bundle || "./js/standalone.js", document.baseURI).href;
  const m = await import(src).catch(() => import(new URL("./js/standalone.js", document.baseURI).href));
  await m.bootStandalone(document.getElementById("app"));
  try { SDK?.game?.loadingStop?.(); } catch { /* ignore */ }
}

// COMMON FIXES the portal asks every HTML5 game for: the page must never
// scroll under the game, arrow keys and space must not move the iframe's
// page, and the context menu stays off the canvas.
export function portalFixes(win) {
  win.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  win.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (!typing && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  });
  win.document.addEventListener("contextmenu", (e) => { if (e.target?.tagName === "CANVAS") e.preventDefault(); });
}

// a module script has no document.currentScript, so the page marks the tag
if (typeof document !== "undefined" && document.querySelector?.("script[data-bundle][data-crazygames]")) {
  portalFixes(window);
  boot().catch((e) => console.error("crazygames boot failed", e));
}
