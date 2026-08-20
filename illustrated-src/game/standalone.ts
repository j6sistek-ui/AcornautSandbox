import { xpCumulative, ART_VER, BUILD, ENVS, GAME_VERSION, HELMETS, IS_BETA, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, NEWS, PALS, PHYS, SUITS, TRACK, TRAILS, helmetWornBy, isIap, wearsOwnHead } from "./catalog";
import { paintPortrait, paintTrailPreview, paintPalPreview } from "./draw";
import { artUrl, drawSprite as drawSpriteOn } from "./art";
import { createEngine } from "./engine";
import { deepUnlocked, lostUnlocked, palUnlocked, suitRevealed, iapOwned, modsUnlocked, starsOf } from "./save";
import { LEVELS, STAGES, STAR_REWARDS, STAR_UNLOCKS, countBits, fxText, goalText, levelUnlocked, stageUnlocked, starTitle, type LevelDef } from "./campaign";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

export async function bootStandalone(root: HTMLElement) {
  root.innerHTML = "";
  root.className = "ac-root";
  const stage = el("div", "ac-stage");
  const canvas = document.createElement("canvas");
  canvas.className = "ac-canvas";
  const overlay = el("div", "ac-overlay");
  // The launch film lives on the STAGE, not in the overlay: render() clears
  // the overlay wholesale on every notify, and a film mounted inside it
  // would restart from frame one each time the engine so much as ticked.
  const filmHost = el("div", "ac-filmhost");
  stage.append(canvas, overlay, filmHost);
  root.append(stage);

  // Screen 1 of the cold open. The acorn IS the progress bar: a drained
  // shell with the full-colour acorn revealed from the base up as the art
  // decodes. The waterline is masked by the acorn's own alpha so it stops
  // at the shell instead of running off as a rectangle.
  const bootArt = (window.__ACORNAUT_ART__ || "/art").replace(/\/$/, "");
  const boot = el("div", "ac-boot");
  const bootNut = el("div", "ac-bootnut");
  const shell = document.createElement("img");
  shell.src = `${bootArt}/acorn/1.png`;
  shell.alt = "";
  shell.className = "ac-bootshell";
  const fillBox = el("div", "ac-bootfill");
  fillBox.style.setProperty("--nut", `url("${bootArt}/acorn/1.png")`);
  const fillImg = document.createElement("img");
  fillImg.src = `${bootArt}/acorn/1.png`;
  fillImg.alt = "";
  fillBox.append(fillImg, el("div", "ac-bootline"));
  bootNut.append(shell, fillBox);
  boot.append(bootNut, el("h1", "ac-boottitle", "ACORNAUT"), el("p", "ac-bootsub", "Prepping the launch pad"));
  boot.append(el("p", "ac-fine ac-bootfine", `${BUILD} · ${GAME_VERSION}`));
  overlay.append(boot);
  // The acorn fills, empties and fills again for as long as the load takes,
  // the way a barber's pole keeps turning — a bar that creeps to 88% and
  // stops there reads as a stall, not as progress.
  let bootPct = 6;
  const bootTick = window.setInterval(() => {
    bootPct += 7;
    if (bootPct > 100) {
      // drop back without animating, so the refill reads as a new sweep
      // rather than the level draining away
      fillBox.style.transition = "none";
      bootPct = 6;
      fillBox.style.height = "0%";
      requestAnimationFrame(() => {
        fillBox.style.transition = "";
        fillBox.style.height = `${bootPct}%`;
      });
      return;
    }
    fillBox.style.height = `${bootPct}%`;
  }, 130);

  const engine = await createEngine(canvas);
  // Hold the loading screen until the art is actually decoded — otherwise
  // the first menu paints with empty sprite banks. Capped so a stalled
  // or failed load still lets the player in.
  await Promise.race([
    engine.artReady ?? Promise.resolve(),
    new Promise((done) => window.setTimeout(done, 12000)),
  ]);
  window.clearInterval(bootTick);
  fillBox.style.height = "100%";
  // sandbox is a test bed: expose the engine so runs can be driven and
  // certified from a harness (env sweeps, cosmetic matrices, replays)
  (window as unknown as { __sandbox?: unknown }).__sandbox = engine;
  engine.start();

  // The title picks ONE mode at a time: TAKE FLIGHT launches it, the
  // MODE bar cycles through the five. Selection lives here so it survives
  // a re-render of the title.
  // WORMHOLE RUN is deliberately NOT here: it is an experiment, and the
  // rule for experiments is the same one the Spill follows — hidden at the
  // bottom of Help, one deliberate tap away, gone when the beta freezes
  // unless it earns a real slot.
  const MODES: { id: "fly" | "deep" | "lost" | "arcade"; label: string; short: string; blurb: string }[] = [
    { id: "fly", label: "NORMAL", short: "NORMAL", blurb: "Standard gates and power-ups." },
    { id: "deep", label: "DEEP SPACE", short: "DEEP", blurb: "Endless back-to-back black holes." },
    { id: "lost", label: "LOST IN SPACE", short: "LOST", blurb: "Space is in control here." },
    { id: "arcade", label: "ARCADE", short: "ARCADE", blurb: "2x power-ups, arcade graphics." },
  ];
  let selectedMode = 0;

  // BUG: every re-render rebuilt the overlay from scratch, so buying or
  // equipping something near the bottom of the hangar threw you back to
  // the top. Remember where the list was and put it back after the swap.
  let keptScroll = 0;
  const render = () => {
    const snap = engine.snap();
    const prevScroll = overlay.querySelector(".ac-sheet-scroll");
    if (prevScroll) keptScroll = prevScroll.scrollTop;
    overlay.innerHTML = "";
    if (snap.screen === "play") {
      const bar = el("div", "ac-playbar");
      const pause = el("button", "ac-iconbtn", "II");
      pause.onclick = () => engine.pause();
      bar.append(pause);
      overlay.append(bar);
      return;
    }
    if (snap.screen === "pause") {
      const sheet = el("div", "ac-sheet ac-center");
      sheet.append(el("h2", "", "PAUSED"), el("p", "ac-sub", `Score ${engine.world.score}`));
      const resume = el("button", "ac-primary", "RESUME");
      resume.onclick = () => engine.resume();
      const abort = el("button", "ac-ghost", "ABORT TO TITLE");
      abort.onclick = () => engine.open("title");
      sheet.append(resume, abort);
      overlay.append(sheet);
      return;
    }
    if (snap.screen === "dead" && snap.dead) {
      const sheet = el("div", "ac-sheet ac-center ac-result");
      sheet.append(el("h2", "", snap.flight === "tunnel" ? "LOST TO THE VOID" : "CRASHED"), el("p", "", `Score ${snap.dead.score}`));
      if (snap.dead.best && snap.dead.score > 0) sheet.append(el("p", "ac-gold", "NEW BEST"));
      if (snap.flight === "tunnel") {
        const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
        sheet.append(
          el("p", "ac-sub", `${count(snap.dead.acorns, "acorn")} · ${count(snap.dead.sections, "section")}`),
          el("p", "ac-sub", `Best Flow ×${snap.dead.bestMultiplier} · Best chain ${snap.dead.bestChain} · ${count(snap.dead.nearMisses, "near miss")}`),
        );
      }
      // XP is retired from the player's view — the Star Chart is the
      // ladder now, and stars are earned in levels, not by crashing here
      if (snap.flight === "tunnel") {
        const replay = el("button", "ac-primary", "FLY AGAIN");
        replay.onclick = () => engine.fly("tunnel");
        const go = el("button", "ac-ghost", "CONTINUE");
        go.onclick = () => engine.dismissDead();
        sheet.append(replay, go);
      } else {
        const go = el("button", "ac-primary", "CONTINUE");
        go.onclick = () => engine.dismissDead();
        sheet.append(go);
      }
      overlay.append(sheet);
      return;
    }
    if (snap.screen === "lvldone" && engine.world.lastLevel) {
      overlay.append(drawLevelDone(engine.world.lastLevel));
      return;
    }
    if (snap.screen === "splash") {
      keptScroll = 0;
      overlay.append(drawSplash());
      return;
    }
    if (snap.screen === "title") {
      keptScroll = 0;
      overlay.append(drawHome());
      return;
    }
    if (snap.screen === "hangar") {
      overlay.append(drawHangar());
      const sc = overlay.querySelector(".ac-sheet-scroll");
      if (sc && keptScroll) sc.scrollTop = keptScroll;
      return;
    }
    if (snap.screen === "log") {
      overlay.append(drawLog());
      return;
    }
    if (snap.screen === "profile") {
      overlay.append(drawProfile());
      return;
    }
    if (snap.screen === "shop") {
      overlay.append(drawShop());
      const sc = overlay.querySelector(".ac-sheet-scroll");
      if (sc && keptScroll) sc.scrollTop = keptScroll;
      return;
    }
    if (snap.screen === "help") {
      overlay.append(drawHelp());
    }
  };

  const SVG = "http://www.w3.org/2000/svg";
  function icon(d: string[], size = 20, fill = false) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", `${size}`);
    svg.setAttribute("height", `${size}`);
    svg.setAttribute("aria-hidden", "true");
    if (fill) {
      svg.setAttribute("fill", "currentColor");
    } else {
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.8");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
    }
    for (const path of d) {
      const el2 = document.createElementNS(SVG, "path");
      el2.setAttribute("d", path);
      svg.append(el2);
    }
    return svg;
  }

  // A space helmet, not a building — the hangar is where the suit lives.
  const I_HELMET = [
    "M12 4a8 8 0 0 1 8 8v3.4a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 15.4V12a8 8 0 0 1 8-8z",
    "M8.2 12.4a3.8 3.8 0 0 1 7.6 0v1.2a1 1 0 0 1-1 1H9.2a1 1 0 0 1-1-1z",
    "M3.4 12.6h.6M20 12.6h.6",
  ];
  const I_ROAD = ["M6 20V9a3 3 0 0 1 6 0v6a3 3 0 0 0 6 0V4"];
  const I_STAR = ["M12 3.6l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z"];
  const I_PILOT = ["M12 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z", "M5.5 19.5a6.5 6.5 0 0 1 13 0"];
  const I_HELP = [
    "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z",
    "M9.7 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 1.9-2.3 3.3",
    "M12 16.8h.01",
  ];
  // A shopping bag: the fifth tab is the store now, not Help.
  const I_SHOP = [
    "M6 8h12l-1 12H7L6 8z",
    "M9.2 8V6.4a2.8 2.8 0 0 1 5.6 0V8",
  ];
  // The acorn silhouette the home dome wears.
  const I_ACORN = [
    "M13.5 2.2a.75.75 0 0 1 .5 1.3c-.75.55-1.1 1.1-1.2 1.7 3.9.25 6.8 2.05 6.8 3.6 0 .8-.7 1.45-1.6 1.45H6c-.9 0-1.6-.65-1.6-1.45 0-1.6 2.95-3.4 6.85-3.6.1-1.05.75-1.95 1.9-2.7a.75.75 0 0 1 .35-.3z",
    "M6.2 11.5h11.6c0 4.8-2.05 9.3-5.15 11.4a1 1 0 0 1-1.3 0C8.25 20.8 6.2 16.3 6.2 11.5z",
  ];
  const I_LAUNCH = ["M5 13.5 12 4l7 9.5", "M12 4v16", "M8.5 20h7"];
  const I_CHEV = ["m9 5 7 7-7 7"];
  const I_NUT = ["M6.5 9.5h11l-1.2 7A4 4 0 0 1 12.4 20h-.8a4 4 0 0 1-3.9-3.5z", "M6 6.6h12"];

  // Every menu wears the same head: a kicker, the screen's name, and
  // whichever counter that screen is actually about.
  function header(kicker: string, title: string, aside?: HTMLElement) {
    const h = el("header", "ac-menuhead");
    const t = el("div", "ac-menuheadtext");
    t.append(el("p", "ac-kicker", kicker), el("h2", "ac-menutitle", title));
    h.append(t);
    if (aside) h.append(aside);
    return h;
  }


  // Help stopped being a tab and became the "?" every other game puts in a
  // corner: it is a reference you reach for once, not a place you live, and
  // the fifth tab slot is worth more as the Shop.
  function helpDot() {
    const b = el("button", "ac-helpdot");
    b.setAttribute("aria-label", "How to fly");
    b.append(icon(I_HELP, 19));
    b.onclick = () => engine.open("help");
    return b;
  }

  function acornPill(n: number) {
    const pill = el("div", "ac-pill ac-pill-gold");
    pill.append(icon(I_NUT, 13), el("span", "", n.toLocaleString()));
    return pill;
  }

  // Five tabs on one bar. HOME is the raised dome in the middle: the
  // biggest target, and glass on every screen because it IS home —
  // the white is its identity, not the current screen's colour.

  /** every menu header carries the same right-hand pair: acorns, then help */
  function headAside(acorns: number) {
    const wrap = el("div", "ac-headaside");
    wrap.append(acornPill(acorns), helpDot());
    return wrap;
  }

  // `active` may be "none": Help is reached from the "?" on any screen, so
  // it belongs to no tab and must not light one up.
  function tabbar(active: "hangar" | "log" | "title" | "profile" | "shop" | "none") {
    const bar = el("nav", "ac-tabbar");
    const side = (
      screen: "hangar" | "log" | "profile" | "shop",
      paths: string[],
      label: string,
    ) => {
      const b = el("button", active === screen ? "ac-tab5 on" : "ac-tab5");
      b.append(icon(paths, 20), el("span", "", label));
      b.onclick = () => engine.open(screen);
      return b;
    };
    const dome = el("button", "ac-dome");
    dome.append(icon(I_ACORN, 26, true), el("span", "", "HOME"));
    dome.onclick = () => engine.open("title");
    bar.append(
      side("hangar", I_HELMET, "HANGAR"),
      side("log", I_STAR, "LEVELS"),
      dome,
      side("profile", I_PILOT, "PROFILE"),
      side("shop", I_SHOP, "SHOP"),
    );
    return bar;
  }

  // Seven painted rank frames, one per five levels, topping out at 30+.
  function rankTierOf(level: number) {
    return Math.max(0, Math.min(6, Math.floor((level - 1) / 5)));
  }

  function artRootUrl() {
    return (window.__ACORNAUT_ART__ || "/art").replace(/\/$/, "");
  }

  // Screen 2 of the cold open. It exists for a practical reason as well
  // as a dramatic one: browsers refuse to start audio until the player
  // has touched the page, so this tap is what lets the music play.
  function drawSplash() {
    const box = el("div", "ac-splash");
    box.style.backgroundImage = `url("${artRootUrl()}/menu-splash.jpg")`;
    box.append(el("div", "ac-splash-ink"));
    const stack = el("div", "ac-splash-stack");
    stack.append(el("h1", "ac-splash-title", "ACORNAUT"));
    const tap = el("p", "ac-splash-tap");
    tap.append(icon(I_ACORN, 15, true), el("span", "", "TAP TO START"));
    stack.append(tap);
    box.append(stack);
    box.append(el("p", "ac-fine ac-splash-fine", `${BUILD} · ${GAME_VERSION}`));
    box.onclick = () => {
      engine.open("title");
      playFilm();
    };
    return box;
  }

  // The launch film, once per app open, straight off the tap. It is mounted
  // OVER the finished home screen and dissolves away, so the film's last
  // frame hands off to the home plate — the same moment, painted larger —
  // with nothing blank in between.
  let filmShown = false;
  function playFilm() {
    if (filmShown) return;
    filmShown = true;
    const box = el("div", "ac-film");
    const v = document.createElement("video");
    // Two encodes, because no single one plays everywhere: Safari and iOS
    // need H.264 in MP4, and it is the format that matters most for a phone
    // game — but a Chromium built without proprietary codecs (which is what
    // the headless browser this is tested in uses) refuses it outright. The
    // browser takes the first source it can decode.
    for (const [file, type] of [
      ["intro.webm", 'video/webm; codecs="vp9"'],
      ["intro.mp4", 'video/mp4; codecs="avc1.4D401E"'],
    ] as const) {
      const src = document.createElement("source");
      src.src = `${artRootUrl()}/${file}?v=${ART_VER}`;
      src.type = type;
      v.append(src);
    }
    v.preload = "auto";
    // muted + playsinline is the only combination every mobile browser will
    // start without a fight, and the menu music is what carries this anyway
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    box.append(v, el("button", "ac-filmskip", "SKIP"));
    filmHost.append(box);

    let over = false;
    const end = () => {
      if (over) return;
      over = true;
      window.clearTimeout(guard);
      box.classList.add("out");
      window.setTimeout(() => box.remove(), 460);
    };
    // Nothing may strand the player in front of a film. Three ways out on
    // top of the film simply finishing: it never starts (no codec, autoplay
    // refused, network down), it starts and stalls, or the player skips.
    // A <source> list is what makes the first one need its own watch: when
    // every source fails the error lands on the <source> elements, not on
    // the video, so waiting for v.onerror alone would hold a black screen.
    const guard = window.setTimeout(end, 11000);
    const start = window.setTimeout(() => { if (v.paused || !v.currentTime) end(); }, 3500);
    const clear = () => { window.clearTimeout(guard); window.clearTimeout(start); };
    v.onended = () => { clear(); end(); };
    v.onerror = () => { clear(); over = true; box.remove(); };
    box.onclick = () => { clear(); end(); };
    requestAnimationFrame(() => box.classList.add("ready"));
    const started = v.play();
    if (started && typeof started.catch === "function")
      started.catch(() => { clear(); end(); });
  }

  function drawHome() {
    const s = engine.save;
    const box = el("div", "ac-home");

    // The key art carries the top three quarters and fades out under the
    // controls, so nothing sits on a hard edge.
    const art = el("div", "ac-home-art");
    art.style.backgroundImage = `url("${artRootUrl()}/menu-home.jpg")`;
    box.append(art, el("div", "ac-home-scrim"));

    // Help takes the left corner and the two counters group on the right,
    // beside the level badge they belong with. Flat pills, not painted
    // plates — the launch screen is the art's, and these only have to be
    // readable over it.
    const pills = el("div", "ac-home-pills");
    const lvPill = el("div", "ac-pill");
    lvPill.append(el("span", "ac-pill-key", "\u2605"), el("span", "ac-pill-num", `${starsOf(s)}`));
    const right = el("div", "ac-home-pillgroup");
    right.append(acornPill(s.acorns), lvPill);
    pills.append(helpDot(), right);
    box.append(pills);

    const title = el("div", "ac-home-titlewrap");
    title.append(el("h1", "ac-home-title", "ACORNAUT"));
    title.append(el("p", "ac-home-kicker", "Fly the gaps \u00b7 Grab the acorns"));
    box.append(title, el("div", "ac-home-gap"));

    const controls = el("div", "ac-controls");

    // The loadout strip is the second door into the Hangar, so the tab
    // icon is never the only way in.
    const helm = helmetWornBy(s.equipped, s.equippedSuit);
    const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
    const trail = TRAILS.find((t) => t.id === s.equippedTrail) ?? TRAILS[0];
    const strip = el("button", "ac-loadstrip");
    const port = el("div", "ac-loadport");
    port.append(portraitOf(helm, suit, 38));
    const stxt = el("div", "ac-loadtxt");
    stxt.append(el("p", "ac-kicker", "Loadout"));
    const head = suit.cat || suit.ownHead ? "Own helmet" : helm.name;
    stxt.append(el("p", "ac-loadname", `${suit.name} \u00b7 ${head} \u00b7 ${trail.name}`));
    strip.append(port, stxt, icon(I_CHEV, 16));
    strip.onclick = () => engine.open("hangar");
    controls.append(strip);

    // Launch sits ABOVE the mode chips on purpose: it keeps the button
    // that starts a run well clear of the tab bar, so reaching for a tab
    // can never fire a flight.
    const launch = el("button", "ac-launch");
    launch.append(icon(I_LAUNCH, 22), el("span", "", "TAKE FLIGHT"));
    launch.onclick = () => engine.fly(MODES[selectedMode].id);
    controls.append(launch);

    // All modes visible at once. A mode the save has not earned stays on
    // the bar — dimmed and inert, so the bar never has a blank slot — and
    // the Star Chart's reward ladder is where its unlock is named.
    const modeOpen = (id: string) =>
      id === "deep" ? deepUnlocked(s) : id === "lost" ? lostUnlocked(s) : true;
    const modes = el("div", "ac-modes");
    MODES.forEach((m, i) => {
      const open = modeOpen(m.id);
      const b = el("button", i === selectedMode ? "ac-mode on" : "ac-mode", m.short);
      if (!open) b.classList.add("ac-cardoff");
      b.onclick = () => {
        if (!open) return;
        selectedMode = i;
        render();
      };
      modes.append(b);
    });
    controls.append(modes);

    box.append(controls, tabbar("title"));
    return box;
  }

  function miniCanvas(w: number, h: number) {
    const c = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, ctx };
  }

  function shopImg(src: string, alt: string, px = 64) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.draggable = false;
    img.width = px;
    img.height = px;
    return img;
  }

  // The battery has no render of its own, so it is drawn: a cell stacked
  // with three charges, which is exactly what buying it gives you.
  function batteryIcon(px = 56) {
    const { c, ctx } = miniCanvas(px, px);
    if (!ctx) return c;
    const w = px * 0.44;
    const h = px * 0.66;
    const x = (px - w) / 2;
    const y = (px - h) / 2 + px * 0.03;
    const r = px * 0.07;
    ctx.fillStyle = "#8fa2c4";
    ctx.fillRect(x + w * 0.3, y - px * 0.07, w * 0.4, px * 0.07);
    const body = ctx.createLinearGradient(x, y, x + w, y + h);
    body.addColorStop(0, "#2b3350");
    body.addColorStop(1, "#161d33");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = "#7f8db0";
    ctx.lineWidth = Math.max(1, px * 0.026);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ch = h / 3.9;
      const cy = y + h - (i + 1) * (ch + h * 0.045) + h * 0.03;
      const g = ctx.createLinearGradient(0, cy, 0, cy + ch);
      g.addColorStop(0, "#8de2ff");
      g.addColorStop(1, "#3aa8e0");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + w * 0.17, cy, w * 0.66, ch, r * 0.5);
      ctx.fill();
    }
    return c;
  }

  // Each flight mod draws what it DOES to a gate: a pair of gate discs with
  // the flight line between them held flat, thrown into waves, or streaked
  // out to twice the speed. Cheaper than three more paintings, and it reads
  // at 56px, which a painting of "double speed" would struggle to.
  function modIcon(id: string, px = 56) {
    const { c, ctx } = miniCanvas(px, px);
    if (!ctx) return c;
    const mid = px / 2;
    const gap = px * 0.30;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const disc = (cy: number) => {
      const g = ctx.createLinearGradient(0, cy - px * 0.13, 0, cy + px * 0.13);
      g.addColorStop(0, "#5c6a92");
      g.addColorStop(1, "#2b3350");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mid, cy, px * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8fa2c4";
      ctx.lineWidth = Math.max(1, px * 0.024);
      ctx.stroke();
    };

    if (id === "thrillSeeker") {
      // three streaks and a chevron: speed, not gates
      ctx.strokeStyle = "#ffb45c";
      ctx.lineWidth = Math.max(1.5, px * 0.055);
      for (let i = 0; i < 3; i++) {
        const y = mid + (i - 1) * px * 0.20;
        const len = px * (i === 1 ? 0.46 : 0.32);
        ctx.beginPath();
        ctx.moveTo(px * 0.12, y);
        ctx.lineTo(px * 0.12 + len, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "#ffd88a";
      ctx.lineWidth = Math.max(1.5, px * 0.07);
      for (const dx of [0, px * 0.16]) {
        ctx.beginPath();
        ctx.moveTo(px * 0.60 + dx, mid - px * 0.20);
        ctx.lineTo(px * 0.76 + dx, mid);
        ctx.lineTo(px * 0.60 + dx, mid + px * 0.20);
        ctx.stroke();
      }
      return c;
    }

    disc(mid - gap);
    disc(mid + gap);
    ctx.strokeStyle = id === "roughAir" ? "#ff9a5c" : "#7fe0b0";
    ctx.lineWidth = Math.max(1.5, px * 0.06);
    ctx.beginPath();
    if (id === "roughAir") {
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = px * 0.12 + t * px * 0.76;
        const y = mid + Math.sin(t * Math.PI * 3) * px * 0.13;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    } else {
      ctx.moveTo(px * 0.12, mid);
      ctx.lineTo(px * 0.88, mid);
    }
    ctx.stroke();
    return c;
  }

  function helmCardOf(helmet: (typeof HELMETS)[number], px = 56) {
    // the dedicated helmet render IS the card — no shrunken squirrel
    const spr = engine.art?.helms?.[helmet.id];
    if (!spr) return portraitOf(helmet, SUITS[0], px);
    const { c, ctx } = miniCanvas(px, px);
    if (ctx) drawSpriteOn(ctx, spr, px / 2, px / 2, px * 0.92);
    return c;
  }

  function suitCardOf(suit: (typeof SUITS)[number], px = 56) {
    // Fit the painted subject's measured bounds instead of shrinking its
    // whole source canvas (whose transparent margins vary from suit to suit).
    const { c, ctx } = miniCanvas(px, px);
    if (ctx) drawSpriteOn(ctx, engine.art?.suits?.[suit.id] ?? null, px / 2, px / 2, px * 0.88);
    return c;
  }

  function portraitOf(helmet: (typeof HELMETS)[number], suit: (typeof SUITS)[number], px = 56) {
    const { c, ctx } = miniCanvas(px, px);
    if (ctx && engine.art) paintPortrait(ctx, engine.art, helmet, suit, px * 0.45, px / 2, px * 0.78);
    return c;
  }

  function drawHangar() {
    const s = engine.save;
    const helm = helmetWornBy(s.equipped, s.equippedSuit);
    const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
    const trail = TRAILS.find((t) => t.id === s.equippedTrail) ?? TRAILS[0];
    const pal = PALS.find((p) => p.id === s.equippedPal);
    const box = el("div", "ac-menu");
    box.append(header("Customize your squirrel", "Hangar", headAside(s.acorns)));

    // The equipped rig stays pinned above the categories, so the preview
    // is never a mystery while you shop.
    const load = el("div", "ac-rig");
    const rigArt = el("div", "ac-rigart");
    rigArt.append(portraitOf(helm, suit, 74));
    load.append(rigArt);
    const loadTxt = el("div", "ac-rigtxt");
    loadTxt.append(el("p", "ac-rigname", suit.name));
    const headline = suit.cat || suit.ownHead ? "Own helmet" : helm.name;
    loadTxt.append(el("p", "ac-sub", `${headline} · ${trail.name} · ${pal?.name ?? "No pal"}`));
    const tags = el("div", "ac-rigtags");
    tags.append(el("span", "ac-tagpill", "EQUIPPED"));
    if (s.startShield) tags.append(el("span", "ac-tagpill ac-tagblue", "+1 SHIELD"));
    loadTxt.append(tags);
    load.append(loadTxt);
    if (pal && pal.id !== "none") {
      const { c, ctx } = miniCanvas(40, 40);
      if (ctx) paintPalPreview(ctx, engine.art, pal.id, 20, 20, 36);
      load.append(c);
    }
    box.append(load);
    const tabs = el("div", "ac-cats");
    for (const t of ["suits", "helmets", "trails", "pals", "mods"] as const) {
      const b = el("button", t === engine.shopTab ? "ac-cat on" : "ac-cat", t.toUpperCase());
      b.onclick = () => engine.setShopTab(t);
      tabs.append(b);
    }
    box.append(tabs);
    const scroll = el("div", "ac-sheet-scroll");
    const grid = el("div", "ac-grid");
    if (engine.shopTab === "helmets") {
      // A character whose head is part of its own painting wears no helmet
      // at all, so the shelf is closed rather than misleading — picking one
      // here would have changed nothing you could see.
      const locked = wearsOwnHead(suit);
      if (locked) {
        const note = el("div", "ac-lockednote");
        note.append(
          el("p", "ac-lockedhead", `${suit.name} wears its own helmet`),
          el("p", "ac-sub", "Its head is part of the character. Equip another suit to change helmets."),
        );
        scroll.append(note);
      }
      for (const h of HELMETS) {
        const premium = isIap(h.id);
        const owned = premium ? iapOwned(s, h.id) : s.unlocked.includes(h.id);
        // a matched-set helmet only fits its own suit; on any other it
        // shows as a set piece rather than an option
        const setLocked = !!h.suitOnly && s.equippedSuit !== h.suitOnly;
        const b = el("button", !locked && s.equipped === h.id ? "ac-card on" : "ac-card");
        const setName = h.suitOnly ? (SUITS.find((u) => u.id === h.suitOnly)?.name ?? h.suitOnly) : "";
        b.append(helmCardOf(h, 64), document.createTextNode(
          `${h.name}\n${setLocked ? `${setName.toUpperCase()} ONLY` : owned ? "OWNED" : premium ? "PREMIUM" : h.cost}`));
        if (premium) b.classList.add("ac-premium");
        if (locked || setLocked) b.classList.add("ac-cardoff");
        b.onclick = () => { if (!locked && !setLocked && (!premium || owned)) engine.buyHelmet(h.id); };
        grid.append(b);
      }
    } else if (engine.shopTab === "suits") {
      for (const u of SUITS) {
        const premium = isIap(u.id);
        const open = suitRevealed(s, u.id);
        const owned = premium ? iapOwned(s, u.id) : s.unlockedSuits.includes(u.id);
        const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
        b.append(
          suitCardOf(u, 64),
          document.createTextNode(
            `${u.name}\n${premium ? (owned ? "OWNED" : "PREMIUM")
              : !open ? (STAR_UNLOCKS.suits[u.id] !== undefined ? `\u2605 ${STAR_UNLOCKS.suits[u.id]}` : "LOCKED")
              : owned ? "OWNED" : u.cost}`),
        );
        if (premium) b.classList.add("ac-premium");
        b.onclick = () => { if (!premium || owned) engine.buySuit(u.id); };
        grid.append(b);
      }
    } else if (engine.shopTab === "trails") {
      for (const t of TRAILS) {
        const owned = s.unlockedTrails.includes(t.id);
        const b = el("button", s.equippedTrail === t.id ? "ac-card on" : "ac-card");
        b.append(shopImg(artUrl(`trails/${t.id}.png`), t.name),
                 document.createTextNode(`${t.name}\n${owned ? "OWNED" : t.cost}`));
        b.onclick = () => engine.buyTrail(t.id);
        grid.append(b);
      }
    } else if (engine.shopTab === "pals") {
      for (const p of PALS) {
        const open = palUnlocked(s, p.id);
        const b = el("button", s.equippedPal === p.id ? "ac-card on" : "ac-card");
        const { c, ctx } = miniCanvas(64, 56);
        if (ctx) paintPalPreview(ctx, engine.art, p.id, 32, 28, 48);
        b.append(c);
        b.append(document.createTextNode(`${p.name}\n${open ? p.tag : "LOCKED"}`));
        b.onclick = () => engine.equipPal(p.id);
        grid.append(b);
      }
    } else {
      // Mods are BOUGHT, like everything else on this screen, so they get
      // the same card with the same price on it. They used to be two bare
      // switches parked in the Profile, which read as free settings — the
      // start shield in particular is charged for every single arming.
      const mod = (
        id: string,
        name: string,
        blurb: string,
        cost: number,
        state: string | null,
        pic: HTMLElement,
        hit: () => void,
      ) => {
        const b = el("button", state ? "ac-card ac-modcard on" : "ac-card ac-modcard");
        b.append(pic);
        const txt = el("div", "ac-modtxt");
        txt.append(el("p", "ac-modname", name), el("p", "ac-sub", blurb));
        b.append(txt, el("span", "ac-modprice", state ?? `${cost}`));
        b.onclick = () => hit();
        grid.append(b);
        return b;
      };
      const shieldNut = () => {
        const { c, ctx } = miniCanvas(56, 56);
        if (ctx && engine.art?.shieldnut) drawSpriteOn(ctx, engine.art.shieldnut, 28, 28, 52);
        return c;
      };
      mod("shield", "Start Shield", "Begin the next run already shielded. Charged each time you arm it.",
          MOD_SHIELD_COST, s.startShield ? "ARMED" : null, shieldNut(),
          () => engine.toggleMod("shield"));
      mod("battery", "Shield Battery", "Stack up to three shield charges instead of one. Bought once.",
          MOD_BATTERY_COST, s.battery ? "OWNED" : null, batteryIcon(56),
          () => engine.toggleMod("battery"));

      // Flight mods change how a run FLIES rather than what you survive, so
      // they say ON / OFF rather than OWNED: buying one does not force you
      // to fly with it. They stay locked until LV 30 — a pilot should have
      // flown the game as designed before rewriting how it moves.
      const modsOpen = modsUnlocked(s);
      if (!modsOpen) {
        scroll.append(el("p", "ac-sub ac-modlock",
          `Flight mods unlock at \u2605 ${STAR_UNLOCKS.flightMods}. They change how the game moves — fly it as built first.`));
      }
      for (const m of MODS) {
        const owned = s.purchased.includes(m.id);
        const on = !!s[m.save];
        const b = mod(m.id, m.name, m.desc, m.cost,
            !modsOpen ? `\u2605 ${STAR_UNLOCKS.flightMods}` : on ? "ON" : owned ? "OFF" : null,
            modIcon(m.id, 56),
            () => { if (modsOpen) engine.setMod(m.id); });
        if (!modsOpen) b.classList.add("ac-cardoff");
      }
    }
    scroll.append(grid);
    box.append(scroll, tabbar("hangar"));
    return box;
  }

  // Every rank earns its OWN emblem — a cadet chevron through the
  // acornaut crown — so the Flight Log reads as a ladder of insignia
  // rather than seven identical coins.
  const RANKS: Record<string, { ring: [string, string]; face: string; mark: string }> = {
    CADET:           { ring: ["#cfd8e8", "#7f8ca4"], face: "#39445c", mark: "chevron" },
    PILOT:           { ring: ["#9fd8ff", "#3f7fb8"], face: "#123049", mark: "wings" },
    VOIDFARER:       { ring: ["#c9a6ff", "#6a3fb8"], face: "#2a1550", mark: "orbit" },
    ACE:             { ring: ["#ffe08a", "#c9861f"], face: "#4a3208", mark: "star" },
    "COMET CHASER":  { ring: ["#ffc48a", "#d1621f"], face: "#4c2208", mark: "comet" },
    "EVENT HORIZON": { ring: ["#d0a8ff", "#4a1f8a"], face: "#120424", mark: "hole" },
    ACORNAUT:        { ring: ["#fff0b0", "#b8860b"], face: "#3d2a06", mark: "acorn" },
  };

  function drawRankBadge(ctx: CanvasRenderingContext2D, name: string, px: number) {
    const spec = RANKS[name] ?? RANKS.CADET;
    const c = px / 2;
    const r = px * 0.4;
    const ring = ctx.createLinearGradient(0, c - r, 0, c + r);
    ring.addColorStop(0, spec.ring[0]);
    ring.addColorStop(1, spec.ring[1]);
    ctx.save();
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.face;
    ctx.beginPath();
    ctx.arc(c, c, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = spec.ring[0];
    ctx.lineWidth = Math.max(1, px * 0.03);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.fillStyle = spec.ring[0];
    const u = r * 0.52;
    if (spec.mark === "chevron") {
      for (const dy of [-u * 0.34, u * 0.42]) {
        ctx.beginPath();
        ctx.moveTo(c - u * 0.8, c + dy);
        ctx.lineTo(c, c + dy - u * 0.62);
        ctx.lineTo(c + u * 0.8, c + dy);
        ctx.stroke();
      }
    } else if (spec.mark === "wings") {
      for (const s2 of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.quadraticCurveTo(c + s2 * u * 0.7, c - u * 0.75, c + s2 * u * 1.15, c - u * 0.05);
        ctx.quadraticCurveTo(c + s2 * u * 0.6, c + u * 0.2, c, c + u * 0.12);
        ctx.fill();
      }
    } else if (spec.mark === "orbit") {
      ctx.beginPath();
      ctx.arc(c, c, u * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 1.06, u * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (spec.mark === "star" || spec.mark === "acorn") {
      if (spec.mark === "acorn") {
        ctx.beginPath();
        ctx.moveTo(c, c + u * 0.95);
        ctx.quadraticCurveTo(c - u * 0.78, c + u * 0.1, c - u * 0.62, c - u * 0.3);
        ctx.lineTo(c + u * 0.62, c - u * 0.3);
        ctx.quadraticCurveTo(c + u * 0.78, c + u * 0.1, c, c + u * 0.95);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c, c - u * 0.42, u * 0.78, u * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 ? u * 0.44 : u * 1.02;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const px2 = c + Math.cos(a) * rad;
          const py2 = c + Math.sin(a) * rad;
          i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else if (spec.mark === "comet") {
      ctx.beginPath();
      ctx.arc(c + u * 0.42, c - u * 0.28, u * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c + u * 0.16, c - u * 0.6);
      ctx.lineTo(c - u * 1.05, c + u * 0.75);
      ctx.lineTo(c + u * 0.2, c + u * 0.08);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(c, c, u * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = spec.face;
      ctx.beginPath();
      ctx.arc(c, c, u * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c, c, u * 1.0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function rewardArt(item: (typeof TRACK)[number], px = 52) {
    if (item.kind === "suit" && item.id) {
      const suit = SUITS.find((u) => u.id === item.id);
      if (suit) return suitCardOf(suit, px);
    }
    const { c, ctx } = miniCanvas(px, px);
    const art = engine.art;
    if (!ctx || !art) return c;
    if (item.kind === "pal" && item.id) {
      paintPalPreview(ctx, art, item.id, px / 2, px / 2, px * 0.86);
    } else if (item.kind === "mode") {
      // mode emblems from the exotic planet art: the black hole for Deep
      // Space, the blue vortex for Lost in Space
      const idx = item.name === "Lost in Space" ? 8 : 17;
      drawSpriteOn(ctx, art.planets?.[idx] ?? null, px / 2, px / 2, px * 0.9);
    } else if (item.kind === "mod") {
      drawSpriteOn(ctx, art.shield?.[0] ?? null, px / 2, px / 2, px * 0.82);
    } else if (item.kind === "title") {
      drawRankBadge(ctx, item.name ?? "", px);
    }
    return c;
  }

  // ------------------------------------------------------------ star chart
  // The Flight Log used to live here: an XP meter and a list of things
  // that would eventually happen to you. The Star Chart replaces it with
  // things you can DO — a hundred levels in ten stages, three stars each,
  // and the rewards hung on star totals instead of mileage.

  function starPips(mask: number, size = "") {
    const wrap = el("span", "ac-pips" + (size ? " " + size : ""));
    for (let b = 0; b < 3; b++) {
      wrap.append(el("span", (mask >> b) & 1 ? "ac-pip on" : "ac-pip", "\u2605"));
    }
    return wrap;
  }

  let chartStage = 0;           // which stage panel is open; sticky per visit
  let chartLevel: string | null = null;   // level detail overlay

  function drawLog() {
    const sv = engine.save;
    const stars = sv.stars || {};
    const total = starsOf(sv);

    const box = el("div", "ac-menu");
    const totalPill = el("div", "ac-pill ac-pill-gold");
    totalPill.append(el("span", "ac-pip on", "\u2605"), el("span", "", `${total} / 300`));
    box.append(header("The road ahead", "Star Chart", totalPill));

    const scroll = el("div", "ac-sheet-scroll");

    // default the open panel to the furthest unlocked stage
    if (!chartStage) {
      let open = 1;
      for (const st of STAGES) if (stageUnlocked(st.num, total)) open = st.num;
      chartStage = open;
    }

    for (const st of STAGES) {
      const open = stageUnlocked(st.num, total);
      const card = el("div", open ? "ac-stagecard" : "ac-stagecard locked");
      const head = el("button", "ac-stagehead");
      const ttl = el("div", "ac-stagetitle");
      ttl.append(el("p", "ac-kicker", `CHAPTER ${st.num}`), el("p", "ac-stagename", st.name));
      head.append(ttl);
      const earned = LEVELS.filter((l) => l.stage === st.num)
        .reduce((n, l) => n + countBits(stars[l.id] || 0), 0);
      if (open) {
        head.append(el("span", "ac-stagestars", `\u2605 ${earned}/30`));
        head.onclick = () => { chartStage = chartStage === st.num ? 0 : st.num; render(); };
      } else {
        head.append(el("span", "ac-stagelock", `\u2605 ${st.unlock} TO OPEN`));
      }
      card.append(head);
      if (open && chartStage === st.num) {
        card.append(el("p", "ac-sub ac-stagetag", st.tagline));
        const grid = el("div", "ac-lvlgrid");
        for (const lvl of LEVELS.filter((l) => l.stage === st.num)) {
          const mask = stars[lvl.id] || 0;
          const can = levelUnlocked(lvl, stars, total);
          const b = el("button", can ? "ac-lvlbtn" : "ac-lvlbtn locked");
          b.append(el("span", "ac-lvlnum", String(lvl.n)));
          b.append(starPips(mask, "sm"));
          if (can) b.onclick = () => { chartLevel = lvl.id; render(); };
          grid.append(b);
        }
        card.append(grid);
      }
      scroll.append(card);
    }

    // the reward ladder, folded under the stages: what stars BUY
    const ladder = el("div", "ac-stagecard");
    const lhead = el("button", "ac-stagehead");
    lhead.append(el("p", "ac-stagename", "REWARDS"), el("span", "ac-stagestars", "what stars unlock"));
    lhead.onclick = () => { chartStage = chartStage === -1 ? 0 : -1; render(); };
    ladder.append(lhead);
    if (chartStage === -1) {
      for (const r of STAR_REWARDS) {
        const row = el("div", total >= r.stars ? "ac-roaditem on" : "ac-roaditem future");
        if (r.kind !== "stage") {
          row.append(rewardArt({ lvl: 0, kind: r.kind, id: r.id, name: r.name } as (typeof TRACK)[number]));
        }
        const txt = el("div", "ac-roadtxt");
        txt.append(el("p", "ac-roadlvl", `\u2605 ${r.stars}`));
        txt.append(el("p", "", r.name));
        txt.append(el("p", "ac-sub", r.desc));
        row.append(txt);
        if (total >= r.stars) row.append(el("span", "ac-check", "\u2713"));
        ladder.append(row);
      }
    }
    scroll.append(ladder);
    box.append(scroll, tabbar("log"));

    // level detail: goals, modifiers, and the FLY button
    if (chartLevel) {
      const def = LEVELS.find((l) => l.id === chartLevel);
      if (def) box.append(drawLevelSheet(def, stars[def.id] || 0));
    }
    return box;
  }

  function drawLevelSheet(def: LevelDef, mask: number) {
    const wrap = el("div", "ac-lvlsheet");
    const sheet = el("div", "ac-lvlcard");
    sheet.append(el("p", "ac-kicker", `LEVEL ${def.id} \u00b7 ${ENVS[def.fx.env ?? 0]?.name ?? ""}`));
    sheet.append(el("h2", "ac-lvlname", def.name));
    const mode =
      def.base === "deep" ? "DEEP SPACE RULES" :
      def.base === "lost" ? "LOST IN SPACE RULES" :
      def.base === "arcade" ? "ARCADE TIMELINE" : "";
    const fxs = fxText(def.fx);
    if (mode || fxs.length) {
      const tags = el("div", "ac-lvltags");
      if (mode) tags.append(el("span", "ac-lvltag mode", mode));
      for (const t of fxs) tags.append(el("span", "ac-lvltag", t));
      sheet.append(tags);
    }
    const goals = el("div", "ac-lvlgoals");
    def.goals.forEach((g, i) => {
      const row = el("div", (mask >> i) & 1 ? "ac-goal on" : "ac-goal");
      row.append(el("span", (mask >> i) & 1 ? "ac-pip on" : "ac-pip", "\u2605"));
      row.append(el("span", "", goalText(g, def)));
      goals.append(row);
    });
    sheet.append(goals);
    const fly = el("button", "ac-primary", mask & 1 ? "FLY AGAIN" : "FLY");
    fly.onclick = () => { chartLevel = null; engine.flyLevel(def.id); };
    const back = el("button", "ac-ghost", "BACK");
    back.onclick = () => { chartLevel = null; render(); };
    sheet.append(fly, back);
    wrap.append(sheet);
    wrap.onclick = (e) => { if (e.target === wrap) { chartLevel = null; render(); } };
    return wrap;
  }

  function drawLevelDone(last: NonNullable<typeof engine.world.lastLevel>) {
    const sheet = el("div", "ac-sheet ac-center");
    sheet.append(el("p", "ac-kicker", `LEVEL ${last.def.id} \u00b7 ${last.def.name}`));
    sheet.append(el("h2", "", last.finished ? "LEVEL COMPLETE" : "LOST"));
    const pips = el("div", "ac-bigpips");
    last.met.forEach((ok, i) => {
      const owned = (last.newMask >> i) & 1;
      const p = el("span", ok ? "ac-bigpip earned" : owned ? "ac-bigpip kept" : "ac-bigpip", "\u2605");
      pips.append(p);
    });
    sheet.append(pips);
    const goals = el("div", "ac-lvlgoals");
    last.def.goals.forEach((g, i) => {
      const row = el("div", last.met[i] ? "ac-goal on" : (last.newMask >> i) & 1 ? "ac-goal kept" : "ac-goal");
      row.append(el("span", (last.newMask >> i) & 1 ? "ac-pip on" : "ac-pip", "\u2605"));
      row.append(el("span", "", goalText(g, last.def)));
      goals.append(row);
    });
    sheet.append(goals);
    if (last.gained > 0) sheet.append(el("p", "ac-gold", `+${last.gained} STAR${last.gained > 1 ? "S" : ""} \u00b7 ${last.totalAfter} TOTAL`));

    // anything the new total just paid for gets its moment
    for (const r of STAR_REWARDS) {
      if (r.stars > last.totalBefore && r.stars <= last.totalAfter) {
        sheet.append(el("p", "ac-gold", `UNLOCKED \u2014 ${r.name}`));
      }
    }

    // the next level, if the finish just opened it
    const next = LEVELS.find((l) => l.stage === last.def.stage && l.n === last.def.n + 1)
      ?? LEVELS.find((l) => l.stage === last.def.stage + 1 && l.n === 1);
    const stars = engine.save.stars || {};
    if (last.finished && next && levelUnlocked(next, stars, last.totalAfter)) {
      const go = el("button", "ac-primary", `NEXT \u2014 ${next.id} ${next.name.toUpperCase()}`);
      go.onclick = () => engine.flyLevel(next.id);
      sheet.append(go);
    }
    const retry = el("button", last.finished ? "ac-ghost" : "ac-primary", last.finished ? "FLY IT AGAIN" : "RETRY");
    retry.onclick = () => engine.flyLevel(last.def.id);
    const chart = el("button", "ac-ghost", "STAR CHART");
    chart.onclick = () => engine.open("log");
    sheet.append(retry, chart);
    return sheet;
  }

  // Profile carries everything the Flight Log is no longer about: the
  // lifetime tallies, the per-mode bests, and the flight deck settings.
  // The Shop is where premium content is sold, and it is deliberately NOT
  // the Hangar: the Hangar is for changing what you already own, the Shop
  // for acquiring. Premium items still appear in the Hangar so a loadout
  // reads complete, but the pitch lives here.
  let storeTab: "bundles" | "suits" | "helmets" | "pals" = "bundles";

  // Bundles are priced under the sum of their parts — that IS the pitch, so
  // the saving is stated on the card rather than left to be worked out.
  const BUNDLES: { id: string; name: string; blurb: string; items: string[] }[] = [
    { id: "bundle-founders", name: "Founder's Pack", blurb: "Every premium suit and the helmets cut for them.",
      items: ["catsuit", "gemmie", "sammie", "seraph", "leviathan", "chronarch", "paladin", "princess", "phoenix"] },
    { id: "bundle-suits", name: "Suit Collection", blurb: "All five premium squirrels.",
      items: ["catsuit", "gemmie", "sammie", "seraph", "leviathan"] },
    { id: "bundle-helmets", name: "Helmet Collection", blurb: "The four shaped helmets.",
      items: ["chronarch", "paladin", "princess", "phoenix"] },
  ];

  function drawShop() {
    const s = engine.save;
    const box = el("div", "ac-menu");
    box.append(header("Premium", "Shop", headAside(s.acorns)));

    const tabs = el("div", "ac-cats");
    for (const t of ["bundles", "suits", "helmets", "pals"] as const) {
      const b = el("button", t === storeTab ? "ac-cat on" : "ac-cat", t.toUpperCase());
      b.onclick = () => { storeTab = t; keptScroll = 0; render(); };
      tabs.append(b);
    }
    box.append(tabs);

    const scroll = el("div", "ac-sheet-scroll");
    const grid = el("div", "ac-grid");

    if (storeTab === "bundles") {
      for (const bn of BUNDLES) {
        const owned = bn.items.every((i) => iapOwned(s, i));
        const card = el("button", "ac-card ac-bundle");
        const strip = el("div", "ac-bundlestrip");
        // show what is in it, up to four faces, then a count
        for (const id of bn.items.slice(0, 4)) {
          const suit = SUITS.find((u) => u.id === id);
          const helm = HELMETS.find((h) => h.id === id);
          if (suit) strip.append(suitCardOf(suit, 40));
          else if (helm) strip.append(helmCardOf(helm, 40));
        }
        if (bn.items.length > 4) strip.append(el("span", "ac-bundlemore", `+${bn.items.length - 4}`));
        card.append(strip);
        const txt = el("div", "ac-modtxt");
        txt.append(el("p", "ac-modname", bn.name), el("p", "ac-sub", bn.blurb));
        card.append(txt, el("span", "ac-modprice", owned ? "OWNED" : "PREMIUM"));
        if (owned) card.classList.add("on");
        card.append(el("span", "ac-bundlecount", `${bn.items.length} items`));
        grid.append(card);
      }
    } else if (storeTab === "suits") {
      for (const u of SUITS.filter((x) => isIap(x.id))) {
        const owned = iapOwned(s, u.id);
        const b = el("button", s.equippedSuit === u.id ? "ac-card ac-premium on" : "ac-card ac-premium");
        b.append(suitCardOf(u, 64),
                 document.createTextNode(`${u.name}\n${owned ? "OWNED" : "PREMIUM"}`));
        b.onclick = () => { if (owned) engine.buySuit(u.id); };
        grid.append(b);
      }
    } else if (storeTab === "helmets") {
      for (const h of HELMETS.filter((x) => isIap(x.id))) {
        const owned = iapOwned(s, h.id);
        const b = el("button", s.equipped === h.id ? "ac-card ac-premium on" : "ac-card ac-premium");
        b.append(helmCardOf(h, 64), document.createTextNode(`${h.name}\n${owned ? "OWNED" : "PREMIUM"}`));
        b.onclick = () => { if (owned) engine.buyHelmet(h.id); };
        grid.append(b);
      }
    } else {
      // Pals are earned by flying, not bought. The Shop still lists them so
      // the shelf is not a mystery — each says what unlocks it.
      for (const pl of PALS.filter((x) => x.id !== "none")) {
        const open = palUnlocked(s, pl.id);
        const b = el("button", s.equippedPal === pl.id ? "ac-card on" : "ac-card");
        const { c, ctx } = miniCanvas(64, 56);
        if (ctx) paintPalPreview(ctx, engine.art, pl.id, 32, 28, 48);
        b.append(c, document.createTextNode(`${pl.name}\n${open ? pl.tag : "EARNED BY FLYING"}`));
        if (!open) b.classList.add("ac-cardoff");
        b.onclick = () => { if (open) engine.equipPal(pl.id); };
        grid.append(b);
      }
    }

    scroll.append(grid);
    if (storeTab !== "pals") {
      scroll.append(el("p", "ac-fine", IS_BETA
        ? "Premium items are unlocked for everyone during the beta."
        : "Premium items arrive with the full release."));
    }
    box.append(scroll, tabbar("shop"));
    return box;
  }

  function drawProfile() {
    const s = engine.save;
    const box = el("div", "ac-menu");
    box.append(header("Pilot", "Profile"));
    const scroll = el("div", "ac-sheet-scroll");

    const helm = helmetWornBy(s.equipped, s.equippedSuit);
    const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
    const id = el("div", "ac-idcard");
    const face = el("div", "ac-idface");
    face.append(portraitOf(helm, suit, 58));
    id.append(face);
    const idTxt = el("div", "ac-idtxt");
    idTxt.append(el("p", "ac-idname", "Nutcracker"));
    idTxt.append(el("p", "ac-sub", `\u2605 ${starsOf(s)} \u00b7 ${starTitle(starsOf(s))}`));
    const tags = el("div", "ac-rigtags");
    if (IS_BETA) tags.append(el("span", "ac-tagpill ac-taggold", "BETA PILOT"));
    idTxt.append(tags);
    id.append(idTxt);
    scroll.append(id);

    scroll.append(el("p", "ac-kicker ac-secthead", "Lifetime"));
    const tiles = el("div", "ac-tiles");
    const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString());
    for (const [n, label] of [
      [fmt(s.runs ?? 0), "FLIGHTS"],
      [fmt(s.lifetimeAcorns ?? s.acorns), "ACORNS"],
      [`${s.zonesSeen?.length ?? 0} / ${ENVS.length}`, "ZONES"],
    ] as const) {
      const t = el("div", "ac-tile");
      t.append(el("p", "ac-tilenum", n), el("p", "ac-tilelabel", label));
      tiles.append(t);
    }
    scroll.append(tiles);

    const bests = el("div", "ac-rows");
    for (const [label, v] of [
      ["Best · Normal", s.highScore],
      ["Best · Deep Space", s.deepBest],
      ["Best · Lost in Space", s.lostBest],
      ["Best · Arcade", s.arcadeBest],
      ["Best · Wormhole Run", s.tunnelBest],
    ] as const) {
      const r = el("div", "ac-row");
      r.append(el("span", "", label), el("span", "ac-rowgold", `${v ?? 0}`));
      bests.append(r);
    }
    scroll.append(bests);

    // The start shield and the battery used to sit here as two switches.
    // They are not settings — both cost acorns, and the shield is charged
    // every time it is armed — so they belong on the Hangar's MODS shelf
    // with a price on them, next to everything else you buy.

    scroll.append(el("p", "ac-kicker ac-secthead", "News"));
    const news = el("div", "ac-rows");
    for (const line of NEWS) {
      const r = el("div", "ac-row ac-rownote");
      r.append(el("span", "ac-sub", line));
      news.append(r);
    }
    scroll.append(news, el("p", "ac-fine ac-mid", `${BUILD} · ${GAME_VERSION}`));

    box.append(scroll, tabbar("profile"));
    return box;
  }

  function drawHelp() {
    const box = el("div", "ac-menu");
    box.append(header("Briefing", "How to Fly"));
    const scroll = el("div", "ac-sheet-scroll");

    // the two controls, as two SEPARATE cards — tap and swipe must never
    // read as one combined instruction
    const controls = el("div", "ac-ctrls");
    for (const [glyph, title, sub, note, cls] of [
      ["\u25B2", "TAP", "BOOST UP", "anywhere, any time", "ac-ctrl ac-tap"],
      ["\u25BC", "SWIPE DOWN", "DIVE", "also cancels a bounce", "ac-ctrl ac-swipe"],
    ] as const) {
      const card = el("div", cls);
      card.append(el("div", "ac-glyph", glyph));
      card.append(el("p", "ac-ctrltitle", title));
      card.append(el("p", "ac-ctrlsub", sub));
      card.append(el("p", "ac-fine", note));
      controls.append(card);
    }
    scroll.append(controls);
    scroll.append(el("p", "ac-sub ac-mid", "Glide through the gaps between planets."));
    scroll.append(el("p", "ac-sub ac-mid", "Planets bounce you \u2014 debris ends the run."));

    const item = (art: HTMLElement, name: string, desc: string) => {
      const row = el("div", "ac-helprow");
      row.append(art);
      const t = el("div");
      t.append(el("p", "", name));
      t.append(el("p", "ac-sub", desc));
      row.append(t);
      scroll.append(row);
    };
    const pic = (draw: (ctx: CanvasRenderingContext2D, px: number) => void, px = 40) => {
      const { c, ctx } = miniCanvas(px, px);
      if (ctx) draw(ctx, px);
      return c;
    };
    const spr = (bank: "acorn" | "golden" | "shield") => (ctx: CanvasRenderingContext2D, px: number) =>
      drawSpriteOn(ctx, engine.art?.[bank]?.[0] ?? null, px / 2, px / 2, px * 0.92);
    const one = (pick: "frozen" | "shieldnut") => (ctx: CanvasRenderingContext2D, px: number) =>
      drawSpriteOn(ctx, engine.art?.[pick] ?? null, px / 2, px / 2, px * 0.92);

    item(pic(spr("acorn")), "ACORN", "Currency \u2014 spend it in the hangar.");
    item(pic(one("frozen")), "FREEZE ACORN", `Slows everything for ${PHYS.powerDuration} seconds.`);
    item(pic(one("shieldnut")), "SHIELD ACORN", "Absorbs one debris hit. Rare \u2014 grab it.");
    item(pic(spr("golden")), "GOLDEN ACORN", "Other modes: invulnerable to debris \u2014 planets still bounce.");
    item(pic(spr("golden")), "FLOW ACORN", "Wormhole Run: fills Flow and guarantees at least ×2 score for 8 seconds.");
    item(pic((ctx, px) => {
      const g = ctx.createRadialGradient(px/2, px/2, 1, px/2, px/2, px/2);
      g.addColorStop(0, "#120424"); g.addColorStop(0.6, "#6a3fb8"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px/2, px/2, px*0.46, 0, Math.PI*2); ctx.fill();
    }), "BLACK HOLE", "Warps flight for 15s \u2014 reversed or tilted.");
    item(pic((ctx, px) => {
      const g = ctx.createRadialGradient(px/2, px/2, 1, px/2, px/2, px/2);
      g.addColorStop(0, "#042a24"); g.addColorStop(0.6, "#6ef0d8"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px/2, px/2, px*0.46, 0, Math.PI*2); ctx.fill();
    }), "WORMHOLE", "Lost in Space & Arcade: mirrors your heading.");

    scroll.append(el("p", "ac-sub ac-mid", "DEEP SPACE: space shifts every 10s."));
    scroll.append(el("p", "ac-sub ac-mid", "ARCADE: the original game, in its own hand. Double power-ups, wormhole reversals, and its own soundtrack."));
    scroll.append(el("p", "ac-sub ac-mid", "FREE FLIGHT: catch the 8-bit acorn to slip into the arcade for a stretch — catch another to come home."));
    scroll.append(el("p", "ac-sub ac-mid", "LOST IN SPACE: drift, tilt, wormholes."));
    if (IS_BETA) scroll.append(el("p", "ac-sub ac-mid", "WORMHOLE RUN: tap-only; swipes are ignored. Tap to rise, then gravity pulls you down. Follow changing currents, build Flow, collect Freeze Acorns, and dodge lethal debris. Pals appear cosmetically, while their abilities and flight mods stay off so every score uses the same physics."));
    scroll.append(el("p", "ac-gold ac-mid", "OTHER MODES \u2014 BRING A PAL: each adds a fun modifier."));
    box.append(scroll);

    const replay = el("button", "ac-ghost ac-replay", "REPLAY TUTORIAL");
    replay.onclick = () => engine.replayTutorial();
    scroll.append(replay);

    // The prototype doors are the BETA's: the Spill, the rig editor and
    // Wormhole Run stay one deliberate tap away for testers, and the
    // production page simply never grows them. The pages themselves still
    // exist at their own URLs — this only removes the doors.
    if (IS_BETA) {
      const lab = el("button", "ac-ghost ac-lab", "SURVIVAL TEST MODE");
      lab.onclick = () => { window.location.href = "../lab/spill/"; };
      const rig = el("button", "ac-ghost ac-lab", "RIG EDITOR");
      rig.onclick = () => { window.location.href = "../lab/rig/"; };
      const worm = el("button", "ac-ghost ac-lab", "WORMHOLE RUN");
      worm.onclick = () => engine.fly("tunnel");
      scroll.append(lab, rig, worm, el("p", "ac-fine ac-labnote", "Prototypes \u00b7 not part of the game"));
    }

    // Starting over is a real feature, not a debug door: progression can
    // be flown from zero, in either build, without touching the browser.
    // Two taps, and the armed state disarms on any re-render.
    const reset = el("button", "ac-ghost ac-reset", "START OVER");
    let armed = false;
    reset.onclick = () => {
      if (!armed) {
        armed = true;
        reset.textContent = "ERASE SAVE AND START OVER?";
        reset.classList.add("ac-resetarmed");
        return;
      }
      engine.startOver();
    };
    scroll.append(reset, el("p", "ac-fine ac-labnote ac-resetnote", "Erases this version's pilot, stars and acorns."));
    box.append(tabbar("none"));
    return box;
  }

  engine.subscribe(render);
  render();
  window.addEventListener("resize", () => engine.resize());
}
