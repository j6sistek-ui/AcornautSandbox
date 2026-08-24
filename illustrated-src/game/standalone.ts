import { xpCumulative, ART_VER, BETA_FEATURES, BUILD, ENVS, GAME_VERSION, GUIDE_HELM, GUIDE_SUIT, HELMETS, HELMET_SHELF, SUIT_SHELF, IAP_ITEMS, HYPER_RUN_ENABLED, IS_BETA, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, NEWS, PALS, PHYS, SUITS, TRACK, TRAILS, helmetWornBy, isIap, wearsOwnHead, BUNDLES, DUST_PACKS, DAILY_DUST, DAILY_STREAK_BONUS, DAILY_STREAK_LEN} from "./catalog";
import { paintPortrait, paintTrailPreview, paintPalPreview } from "./draw";
import { artUrl, drawSprite as drawSpriteOn } from "./art";
import { createEngine } from "./engine";
import { batteryUnlocked, deepUnlocked, helmetRevealed, lostUnlocked, palUnlocked, startShieldUnlocked, suitRevealed, iapOwned, modsUnlocked, starsOf, trailUnlocked } from "./save";
import { LEVELS, HYPER_RUN_MAX_ACORNS, HYPER_RUN_MISSION, STAGES, STAR_REWARDS, STAR_UNLOCKS, countBits, fxText, goalText, levelUnlocked, stageUnlocked, starTitle, type LevelDef, RACE_GATES, gateBefore, nextGate} from "./campaign";
import { formatRaceTicks } from "./race";

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

/** One testable launch seam shared by the Hyper Run briefing CTA and its
 * fixed-step acceptance harness. Hyper Run ships on both pages now, so
 * this is no longer gated - the Modes entry always offers it. */
export function launchHyperRun(flyLevel: (id: string) => boolean) {
  return flyLevel(HYPER_RUN_MISSION.id);
}

export async function bootStandalone(root: HTMLElement) {
  // WIDESCREEN MODE: the stage sheds its phone cap and the canvas takes
  // the whole window; DOM menus widen with it in landscape.
  document.body.classList.add("ac-wide");
  // the purple beta chrome: every menu greys toward violet under this flag
  if (BETA_FEATURES) document.body.classList.add("ac-beta");
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
  shell.src = `${bootArt}/acorn/1.png?v=${ART_VER}`;
  shell.alt = "";
  shell.className = "ac-bootshell";
  const fillBox = el("div", "ac-bootfill");
  fillBox.style.setProperty("--nut", `url("${bootArt}/acorn/1.png?v=${ART_VER}")`);
  const fillImg = document.createElement("img");
  fillImg.src = `${bootArt}/acorn/1.png?v=${ART_VER}`;
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
  // Specialized runs are deliberately NOT selectable by FREE FLIGHT.
  // WORMHOLE RUN and HYPER RUN are modes proper now, above the divider in
  // the Modes sheet, while external lab tools remain quieter doors.
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
  // The hangar's sideways shelves have the same problem in the other
  // axis — tapping a card rebuilt every row at its start — so each row's
  // scrollLeft is kept by index and restored after the swap too.
  let keptScroll = 0;
  let keptRowScroll: number[] = [];
  let shelfKey = "";              // which tab the kept rows belong to
  const keepShelves = () => {
    keptRowScroll = [...overlay.querySelectorAll(".ac-shelfrow")].map((r) => r.scrollLeft);
  };
  const restoreShelves = () => {
    [...overlay.querySelectorAll(".ac-shelfrow")].forEach((r, i) => {
      if (keptRowScroll[i]) r.scrollLeft = keptRowScroll[i];
    });
  };
  const render = () => {
    const snap = engine.snap();
    const prevScroll = overlay.querySelector(".ac-sheet-scroll");
    if (prevScroll) keptScroll = prevScroll.scrollTop;
    keepShelves();
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
      sheet.append(
        el("h2", "", "PAUSED"),
        el("p", "ac-sub", engine.world.race ? `TIME ${formatRaceTicks(engine.world.race.tick)}` : `Score ${engine.world.score}`),
      );
      // Mid-run A/B for the motion mappings. They only change how ECLIPSE is
      // drawn, so the row is there when Eclipse is the pilot and nowhere else.
      // Switching from the pause is the whole point: the three read completely
      // differently depending on what you were doing when you paused, and
      // going back to the hangar to change it loses the run you were judging.
      if (engine.save.equippedSuit === "eclipse") {
        const mode = (((engine.save.eclipseMotionMode ?? 2) % 3) + 3) % 3;
        sheet.append(el("p", "ac-sub", "PILOT MOTION"));
        const row = el("div", "ac-modes");
        (row as HTMLElement).style.gridTemplateColumns = "repeat(3, minmax(0,1fr))";
        ["Shipped", "Rate", "Heading"].forEach((name, i) => {
          const mb = el("button", i === mode ? "ac-mode on" : "ac-mode", name);
          mb.onclick = () => engine.setEclipseMotionMode(i);
          row.append(mb);
        });
        sheet.append(row);
      }
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
      sheet.append(el("h2", "", snap.flight === "tunnel" ? "LOST TO THE VOID" : "CRASHED"));
      if (!(BETA_FEATURES && snap.flight !== "tunnel")) {
        sheet.append(el("p", "", `Score ${snap.dead.score}`));
      }
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
      } else if (BETA_FEATURES) {
        // The crash sheet is a receipt now: the run's whole story in
        // rows — gates as the headline, then what happened on the way.
        const d = snap.dead;
        const big = el("div", "ac-crashscore");
        big.append(el("b", "", String(d.score)),
          el("span", "", d.score === 1 ? "GATE CLEARED" : "GATES CLEARED"));
        sheet.append(big);
        const s = engine.save;
        const hs = snap.flight === "deep" ? s.deepBest
          : snap.flight === "lost" ? s.lostBest
          : snap.flight === "arcade" ? (s.arcadeBest ?? 0)
          : s.highScore;
        const rows = el("div", "ac-rows ac-crashrows");
        const row = (label: string, v: number, gold = false) => {
          const r = el("div", "ac-row");
          r.append(el("span", "", label), el("span", gold ? "ac-rowgold" : "ac-rowdim", String(v)));
          rows.append(r);
        };
        row("Black holes", d.holes ?? 0);
        row("Acorns", d.acorns, true);
        row("Taps", d.taps ?? 0);
        row("Planet bounces", d.bounces ?? 0);
        row("High score", hs, true);
        sheet.append(rows);
        if (engine.save.guide === "reward") {
          const gsuit = SUITS.find((u) => u.id === GUIDE_SUIT);
          const ghelm = HELMETS.find((h) => h.id === GUIDE_HELM);
          const gift = el("div", "ac-gear");
          gift.append(el("p", "ac-gold ac-gearhead", "NEW GEAR UNLOCKED"));
          const grow = el("div", "ac-gearrow");
          if (gsuit) {
            const cell = el("div", "ac-gearcell");
            cell.append(suitCardOf(gsuit, 56), el("p", "ac-sub", `${gsuit.name} Suit`));
            grow.append(cell);
          }
          if (ghelm) {
            const cell = el("div", "ac-gearcell");
            cell.append(helmCardOf(ghelm, 56), el("p", "ac-sub", `${ghelm.name} Helmet`));
            grow.append(cell);
          }
          gift.append(grow, el("p", "ac-sub ac-mid", "Yours, free — waiting in the Loadout."));
          sheet.append(gift);
        }
        const again = el("button", "ac-primary", "TRY AGAIN");
        again.onclick = () => engine.fly(snap.flight);
        const menu = el("button", "ac-ghost", engine.save.guide === "reward" ? "COLLECT" : "MAIN MENU");
        menu.onclick = () => engine.dismissDead();
        sheet.append(again, menu);
      } else {
        if (engine.save.guide === "reward") {
          const gsuit = SUITS.find((u) => u.id === GUIDE_SUIT);
          const ghelm = HELMETS.find((h) => h.id === GUIDE_HELM);
          const gift = el("div", "ac-gear");
          gift.append(el("p", "ac-gold ac-gearhead", "NEW GEAR UNLOCKED"));
          const row = el("div", "ac-gearrow");
          if (gsuit) {
            const cell = el("div", "ac-gearcell");
            cell.append(suitCardOf(gsuit, 56), el("p", "ac-sub", `${gsuit.name} Suit`));
            row.append(cell);
          }
          if (ghelm) {
            const cell = el("div", "ac-gearcell");
            cell.append(helmCardOf(ghelm, 56), el("p", "ac-sub", `${ghelm.name} Helmet`));
            row.append(cell);
          }
          gift.append(row, el("p", "ac-sub ac-mid", "Yours, free \u2014 waiting in the Hangar."));
          sheet.append(gift);
          const go = el("button", "ac-primary", "COLLECT");
          go.onclick = () => engine.dismissDead();
          sheet.append(go);
        } else {
          const go = el("button", "ac-primary", "CONTINUE");
          go.onclick = () => engine.dismissDead();
          sheet.append(go);
        }
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
      overlay.append(BETA_FEATURES ? drawHome() : drawHomeClassic());
      return;
    }
    if (snap.screen === "hangar") {
      overlay.append(drawHangar());
      const sc = overlay.querySelector(".ac-sheet-scroll");
      if (sc && keptScroll) sc.scrollTop = keptScroll;
      // put the sideways shelves back where they were — but only when the
      // rebuilt rows are the same tab's rows; a fresh tab starts at its front
      const key = `hangar:${engine.shopTab}`;
      if (shelfKey === key) restoreShelves();
      shelfKey = key;
      return;
    }
    if (snap.screen === "log") {
      overlay.append(drawLog());
      // land the chart on the level you're ON: the map climbs, so a fresh
      // chapter opens at its locked top unless we scroll to the pilot
      const sc = overlay.querySelector(".ac-sheet-scroll");
      if (sc) {
        if (keptScroll) {
          sc.scrollTop = keptScroll;
        } else {
          const cur = sc.querySelector(".ac-mapnode.cur");
          if (cur) (cur as HTMLElement).scrollIntoView({ block: "center" });
        }
      }
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
  const I_BACK = ["m15 5-7 7 7 7"];
  // STAR DUST. Four points, the vertical pair longer than the horizontal
  // and the waist pinched in, so it reads as the cut crystal rather than
  // as the flat five-point star already used for chart progress.
  const I_DUST = ["M12 2.2 13.9 9 20.4 12 13.9 15 12 21.8 10.1 15 3.6 12 10.1 9z"];
  // The Discord wordmark's face, drawn rather than linked so it needs no
  // network round trip and inherits currentColor like every other icon here.
  const I_DISCORD = ["M20.317 4.492a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.492a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.061.061 0 0 0-.031-.03zM8.02 15.278c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"];
  const I_NUT = ["M6.5 9.5h11l-1.2 7A4 4 0 0 1 12.4 20h-.8a4 4 0 0 1-3.9-3.5z", "M6 6.6h12"];
  const I_GEAR = [
    "M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z",
    "M12 3.2v2.2M12 18.6v2.2M20.8 12h-2.2M5.4 12H3.2M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6M18.2 18.2l-1.6-1.6M7.4 7.4 5.8 5.8",
  ];
  const I_LOCK = ["M6 11h12v9H6z", "M9 11V8a3 3 0 0 1 6 0v3"];

  // Every menu wears the same head: a kicker, the screen's name, and
  // whichever counter that screen is actually about.
  function header(kicker: string, title: string, aside?: HTMLElement) {
    const h = el("header", "ac-menuhead");
    if (BETA_FEATURES) {
      // hub-and-spoke: the beta has no tab bar, so every menu carries
      // its own door back to the hub
      const back = el("button", "ac-backbtn");
      back.setAttribute("aria-label", "Back to home");
      back.append(icon(I_BACK, 20));
      back.onclick = () => engine.open("title");
      h.append(back);
    }
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

  function dustPill(n: number) {
    const pill = el("div", "ac-pill ac-pill-dust");
    pill.append(icon(I_DUST, 13, true), el("span", "", n.toLocaleString()));
    return pill;
  }

  // Five tabs on one bar. HOME is the raised dome in the middle: the
  // biggest target, and glass on every screen because it IS home —
  // the white is its identity, not the current screen's colour.

  /** every menu header carries the same right-hand pair: acorns, then help */
  function headAside(acorns: number) {
    const wrap = el("div", "ac-headaside");
    wrap.append(acornPill(acorns), dustPill(engine.save.starDust), helpDot());
    return wrap;
  }

  // `active` may be "none": Help is reached from the "?" on any screen, so
  // it belongs to no tab and must not light one up.
  // The coach: one line of guidance, pinned above the tab bar, that only
  // exists while the post-tutorial path is live. It never blocks a tap.
  function coach(text: string) {
    return el("div", "ac-coach", text);
  }

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
    const hangarTab = side("hangar", I_HELMET, BETA_FEATURES ? "LOADOUT" : "HANGAR");
    const levelsTab = side("log", I_STAR, "LEVELS");
    const g = engine.save.guide;
    if ((g === "hangar" || g === "helmet") && active !== "hangar") hangarTab.classList.add("ac-pulse");
    if (g === "levels" && active !== "log") levelsTab.classList.add("ac-pulse");
    bar.append(
      hangarTab,
      levelsTab,
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
    const splashArt = window.innerWidth > window.innerHeight
      ? "menu-splash-wide.jpg" : "menu-splash.jpg";
    box.style.backgroundImage = `url("${artRootUrl()}/${splashArt}?v=${ART_VER}")`;
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

  // The LIVE page keeps the shipped title screen while the hub bakes in
  // the beta — same rule as every other experiment in this repo.
  function drawHomeClassic() {
    const s = engine.save;
    const box = el("div", "ac-home");

    // The key art carries the top three quarters and fades out under the
    // controls, so nothing sits on a hard edge.
    const art = el("div", "ac-home-art");
    const homeArt = window.innerWidth > window.innerHeight
      ? "menu-home-wide.jpg" : "menu-home.jpg";
    art.style.backgroundImage = `url("${artRootUrl()}/${homeArt}?v=${ART_VER}")`;
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
    // its chip says the star price outright, so the lock is never a mystery.
    const modeOpen = (id: string) =>
      id === "deep" ? deepUnlocked(s) : id === "lost" ? lostUnlocked(s) : true;
    const modePrice = (id: string) =>
      id === "deep" ? STAR_UNLOCKS.deep : id === "lost" ? STAR_UNLOCKS.lost : 0;
    const modes = el("div", "ac-modes");
    MODES.forEach((m, i) => {
      const open = modeOpen(m.id);
      const b = el("button", i === selectedMode ? "ac-mode on" : "ac-mode");
      b.append(el("span", "", m.short));
      if (!open) {
        b.classList.add("ac-cardoff");
        b.append(el("span", "ac-modeneed", `unlocks at ${modePrice(m.id)} ★`));
      }
      b.onclick = () => {
        if (!open) return;
        selectedMode = i;
        render();
      };
      modes.append(b);
    });
    controls.append(modes);

    if (s.guide === "hangar" || s.guide === "helmet") {
      box.append(coach("Your new gear is waiting \u2014 open the HANGAR"));
    } else if (s.guide === "levels") {
      box.append(coach("Mission 1 is ready \u2014 open LEVELS"));
    }
    box.append(controls, tabbar("title"));
    return box;
  }

  // ------------------------------------------------------------- the hub
  // The title screen is a HUB now: the purple key art owns the screen and
  // every destination is one saturated tile, named once. Identity lives in
  // PROFILE, gear lives in LOADOUT, settings and help share the gear
  // button, the Lab rides inside MODES, and the Star Chart bar is the
  // campaign's stars made permanently visible.
  let modesOpen = false;
  let hyperRunOpen = false;

  function nextStarReward(stars: number) {
    return STAR_REWARDS.find((r) => r.stars > stars) ?? null;
  }

  function hubIcon(name: string, blend = true) {
    const img = document.createElement("img");
    img.src = `${artRootUrl()}/ui/${name}.png?v=${ART_VER}`;
    img.alt = "";
    img.draggable = false;
    img.className = blend ? "ac-hubic-img" : "ac-hubic-art";
    return img;
  }

  function drawHome() {
    const s = engine.save;
    const box = el("div", "ac-hub");

    const art = el("div", "ac-hub-art");
    const hubArt = window.innerWidth > window.innerHeight ? "menu-hub-wide.jpg" : "menu-hub.jpg";
    art.style.backgroundImage = `url("${artRootUrl()}/${hubArt}?v=${ART_VER}")`;
    box.append(art, el("div", "ac-hub-scrim"));

    const helm = helmetWornBy(s.equipped, s.equippedSuit);
    const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];

    // ONE top rail, balanced: the pilot's portrait fused with the acorn
    // meter on the left, the shop and the gear on the right
    const rail = el("div", "ac-hub-rail");
    const idcap = el("div", "ac-hub-id");
    const prof = el("button", "ac-hub-idport");
    prof.setAttribute("aria-label", "Profile");
    prof.append(portraitOf(helm, suit, 34));
    prof.onclick = () => engine.open("profile");
    const acorns = el("button", "ac-hub-idacorns");
    acorns.setAttribute("aria-label", "Shop");
    acorns.append(icon(I_NUT, 15), el("span", "", s.acorns.toLocaleString()));
    acorns.onclick = () => engine.open("shop");
    idcap.append(prof, acorns);
    const shopBtn = el("button", "ac-hub-sq");
    shopBtn.setAttribute("aria-label", "Shop");
    shopBtn.append(hubIcon("gift"));
    shopBtn.onclick = () => engine.open("shop");
    const gear = el("button", "ac-hub-sq");
    gear.setAttribute("aria-label", "Settings and help");
    gear.append(icon(I_GEAR, 22));
    gear.onclick = () => engine.open("help");
    rail.append(idcap, el("div", "ac-hub-railgap"), shopBtn, gear);
    box.append(rail);

    const mark = el("div", "ac-hub-wordmark");
    mark.append(el("h1", "ac-hub-title", "ACORNAUT"));
    mark.append(el("p", "ac-hub-kicker", "Fly the gaps · Grab the acorns"));
    box.append(mark, el("div", "ac-hub-space"));

    const tiles = el("div", "ac-hub-tiles");
    const tile = (
      cls: string,
      pic: HTMLElement,
      label: string,
      sub: string,
      hit: () => void,
      dot?: string,
      pulse?: boolean,
    ) => {
      const b = el("button", `ac-hubtile ${cls}`);
      const ic = el("span", "ac-hubic");
      ic.append(pic);
      b.append(ic, el("b", "", label), el("span", "ac-hubsub", sub));
      if (dot) {
        const d = el("i", "ac-hubdot");
        d.style.background = dot;
        d.style.boxShadow = `0 0 8px ${dot}`;
        b.append(d);
      }
      if (pulse) b.classList.add("ac-pulse");
      b.onclick = hit;
      tiles.append(b);
      return b;
    };

    // FREE FLIGHT is the endless game; missions live on the Star Chart.
    // The ribbon names the selected mode so launching is never a mystery.
    const launch = el("button", "ac-hubtile t-launch");
    launch.append(el("span", "ac-hub-ribbon", `${MODES[selectedMode].label} SELECTED`));
    const lic = el("span", "ac-hubic");
    lic.append(hubIcon("rocket", false));
    const ltxt = el("span", "ac-hub-launchtxt");
    ltxt.append(el("b", "", "FREE FLIGHT"), el("span", "ac-hubsub", "Begin your flight"));
    launch.append(lic, ltxt);
    launch.onclick = () => engine.fly(MODES[selectedMode].id);
    tiles.append(launch);

    const loadoutTile = tile("t-loadout", portraitOf(helm, suit, 50), "LOADOUT", "Suits & gear",
      () => engine.open("hangar"), undefined,
      s.guide === "hangar" || s.guide === "helmet");
    // an equipped pal announces itself on the tile — one green line
    const hubPal = PALS.find((p) => p.id === s.equippedPal);
    if (hubPal && hubPal.id !== "none") {
      loadoutTile.append(el("span", "ac-hubsub ac-hubequip", `${hubPal.name} equipped`));
    }
    const planet = miniCanvas(50, 50);
    if (planet.ctx) drawSpriteOn(planet.ctx, engine.art?.planets?.[8] ?? null, 25, 25, 46);
    // no dot: a badge should mean something NEW is inside, and nothing
    // in the mode sheet changes on its own
    tile("t-modes", planet.c, "MODES", "6 ways to fly · Lab",
      () => { modesOpen = true; render(); });
    box.append(tiles);

    // the Star Chart bar: campaign stars over the 300 total, plus what the
    // next handful buys — a second door into the chart
    const stars = starsOf(s);
    const nxt = nextStarReward(stars);
    const bar = el("button", "ac-hub-bar");
    bar.append(el("span", "ac-hub-starbadge", "★"));
    const btxt = el("span", "ac-hub-bartxt");
    btxt.append(el("b", "", nxt ? `STAR CHART · NEXT UNLOCK ★ ${nxt.stars}` : "STAR CHART · COMPLETE"));
    const track = el("span", "ac-hub-track");
    const fill = el("i", "");
    fill.style.width = `${Math.min(100, (stars / 300) * 100)}%`;
    track.append(fill, el("em", "", `${stars} / 300`));
    btxt.append(track);
    bar.append(btxt);
    bar.onclick = () => engine.open("log");
    if (s.guide === "levels") bar.classList.add("ac-pulse");
    box.append(bar);

    if (s.guide === "hangar" || s.guide === "helmet") {
      box.append(coach("Your new gear is waiting — open LOADOUT"));
    } else if (s.guide === "levels") {
      box.append(coach("Mission 1 is ready — open the STAR CHART"));
    }
    if (modesOpen) box.append(drawModeSheet());
    if (hyperRunOpen) {
      box.append(drawLevelSheet(HYPER_RUN_MISSION, hyperRunMask(), "modes"));
    }
    return box;
  }

  // The mode picker: FREE FLIGHT's four rule-sets, with the Lab's
  // lab doors riding at the bottom — one deliberate tap away,
  // exactly as Help used to carry them.
  // Every mode wears a piece of the real game as its face: the painted
  // black hole DEEP SPACE throws at you, the 8-bit acorn ARCADE spawns,
  // a world knocked off its axis for LOST IN SPACE. No new art files —
  // the banks are already decoded and on screen during a flight.
  const MODE_FACE: Record<string, string> = {
    fly: "rocket", deep: "hole", lost: "tumble", arcade: "arcade",
  };

  function modeIcon(kind: string, px = 44): HTMLElement {
    if (kind === "rocket") {
      const img = document.createElement("img");
      img.src = `${artRootUrl()}/ui/rocket.png?v=${ART_VER}`;
      img.alt = "";
      img.draggable = false;
      img.className = "ac-modeicart";
      return img;
    }
    const { c, ctx } = miniCanvas(px, px);
    const bank = engine.art;
    if (ctx) {
      if (kind === "hole") drawSpriteOn(ctx, bank?.holeAnim?.[0] ?? null, px / 2, px / 2, px);
      else if (kind === "worm") drawSpriteOn(ctx, bank?.wormAnim?.[0] ?? null, px / 2, px / 2, px);
      else if (kind === "arcade") drawSpriteOn(ctx, bank?.arcadeAcorn ?? null, px / 2, px / 2, px * 0.8);
      else if (kind === "race") drawSpriteOn(ctx,
        bank?.hyperRun?.["scout-ship"] ?? bank?.squirrelIdle?.[0] ?? null,
        px / 2, px / 2, px * 0.94);
      else if (kind === "tumble") {
        // LOST IN SPACE flies the pilot, not the other way round: its face
        // is the squirrel going end over end
        ctx.save();
        ctx.translate(px / 2, px / 2);
        ctx.rotate(2.42);
        drawSpriteOn(ctx, bank?.squirrelFlap?.[1] ?? bank?.squirrelIdle?.[0] ?? null, 0, 0, px * 0.86);
        ctx.restore();
      }
    }
    return c;
  }

  // The mode picker: FREE FLIGHT's four rule-sets, each a saturated row in
  // its own hue with its record on the right — then the Lab's
  // doors under a rule, deliberately quieter so they never read as modes.
  function drawModeSheet() {
    const s = engine.save;
    const wrap = el("div", "ac-lvlsheet");
    const sheet = el("div", "ac-lvlcard ac-modecard");
    sheet.append(el("p", "ac-kicker", "FREE FLIGHT"), el("h2", "ac-lvlname", "Modes"));
    const bests: Record<string, number> = {
      fly: s.highScore, deep: s.deepBest, lost: s.lostBest, arcade: s.arcadeBest ?? 0,
    };
    const modeOpen = (id: string) =>
      id === "deep" ? deepUnlocked(s) : id === "lost" ? lostUnlocked(s) : true;
    const modePrice = (id: string) =>
      id === "deep" ? STAR_UNLOCKS.deep : id === "lost" ? STAR_UNLOCKS.lost : 0;

    const bestChip = (n: number | string) => {
      const c = el("span", "ac-modebest");
      c.append(el("i", "", "BEST"), el("b", "", String(n)));
      return c;
    };
    const lockChip = (n: number) => {
      const c = el("span", "ac-modelock");
      c.append(icon(I_LOCK, 12), el("b", "", `\u2605 ${n}`));
      return c;
    };

    // one row for every way to fly: face, name, the rule in a sentence,
    // and a chip that is either the record or the price of admission
    const row = (o: {
      cls: string; face: string; label: string; blurb?: string;
      aside?: HTMLElement | null; open?: boolean; selected?: boolean; hit: () => void;
    }) => {
      const open = o.open !== false;
      const b = el("button", `ac-moderow ${o.cls}`);
      if (!open) b.classList.add("ac-cardoff");
      if (o.selected) b.classList.add("on");
      const ic = el("span", "ac-modeic");
      ic.append(modeIcon(o.face));
      if (o.selected) ic.append(el("i", "ac-modetick", "\u2713"));
      const t = el("span", "ac-moderowtxt");
      t.append(el("b", "", o.label));
      if (o.blurb) t.append(el("span", "", o.blurb));
      b.append(ic, t);
      if (o.aside) b.append(o.aside);
      b.onclick = o.hit;
      sheet.append(b);
      return b;
    };

    MODES.forEach((m, i) => {
      const open = modeOpen(m.id);
      row({
        cls: `m-${m.id}`,
        face: MODE_FACE[m.id],
        label: m.label,
        blurb: m.blurb,
        aside: open ? bestChip(bests[m.id] ?? 0) : lockChip(modePrice(m.id)),
        open,
        selected: open && i === selectedMode,
        hit: () => { if (!open) return; selectedMode = i; modesOpen = false; render(); },
      });
    });

    // HYPER RUN sits with the modes now, not under PROTOTYPES. It has its
    // own art, its own record and its own rules; the only thing the old
    // placement still said about it was that it had not shipped yet.
    {
      // HYPER RUN IS THE FIRST DEBRIS FIELD'S REWARD. Before that it is not
      // a mode you can pick - the only way to fly it is the field itself,
      // from the Star Chart, because that is the run it exists to be. Clear
      // the field at 33 and it becomes yours to fly whenever you like.
      const firstGate = RACE_GATES[0];
      const earned = IS_BETA || (s.raceGates || []).includes(firstGate.after);
      const record = s.raceRecords?.[HYPER_RUN_MISSION.id];
      const lock = el("span", "ac-modelock");
      lock.append(icon(I_LOCK, 12), el("b", "", `LV ${firstGate.after}`));
      row({
        cls: "m-race",
        face: "race",
        label: "HYPER RUN",
        blurb: earned
          ? "Thread gates. Center the wormhole rings."
          : `Clear the debris field after level ${firstGate.after} to unlock.`,
        aside: earned
          ? (record?.bestFinishTicks ? bestChip(formatRaceTicks(record.bestFinishTicks)) : null)
          : lock,
        open: earned,
        // locked, it still answers the tap - by showing the chart where the
        // field actually is, rather than doing nothing
        hit: () => {
          modesOpen = false;
          if (earned) hyperRunOpen = true;
          else engine.open("log");
          render();
        },
      });
    }
    row({
      cls: "m-tunnel",
      face: "worm",
      label: "WORMHOLE RUN",
      blurb: "Hold to thrust down the corridor.",
      aside: s.tunnelBest ? bestChip(s.tunnelBest) : null,
      hit: () => { modesOpen = false; engine.fly("tunnel"); },
    });

    // What remains under the divider really is a lab: utilities, not modes.
    sheet.append(el("p", "ac-modeshead", "PROTOTYPES"));
    const door = (label: string, hit: () => void) => {
      const b = el("button", "ac-moderow ac-modedoor");
      const t = el("span", "ac-moderowtxt");
      t.append(el("b", "", label));
      b.append(t, icon(I_CHEV, 16));
      b.onclick = hit;
      sheet.append(b);
    };
    door("SURVIVAL TEST MODE", () => { window.location.href = labRootOf() + "spill/"; });
    door("RIG EDITOR", () => { window.location.href = labRootOf() + "rig/"; });
    if (IS_BETA) door("BACKGROUND TEST MODE", () => { window.location.href = labRootOf() + "skytest/"; });
    const back = el("button", "ac-primary ac-modeback", "BACK");
    back.onclick = () => { modesOpen = false; render(); };
    sheet.append(back);
    wrap.append(sheet);
    wrap.onclick = (e) => { if (e.target === wrap) { modesOpen = false; render(); } };
    return wrap;
  }

  function labRootOf() {
    return IS_BETA ? "../lab/" : "./lab/";
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

    if (id === "noPalFx") {
      // a companion orb with a line through it: the pal is there, its
      // effect is not
      ctx.fillStyle = "#8fa2c4";
      ctx.beginPath();
      ctx.arc(px * 0.5, mid, px * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#39445c";
      ctx.beginPath();
      ctx.arc(px * 0.5, mid, px * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ff8a8a";
      ctx.lineWidth = Math.max(2, px * 0.075);
      ctx.beginPath();
      ctx.moveTo(px * 0.2, mid + px * 0.3);
      ctx.lineTo(px * 0.8, mid - px * 0.3);
      ctx.stroke();
      return c;
    }

    disc(mid - gap);
    disc(mid + gap);
    ctx.strokeStyle = "#7fe0b0";
    ctx.lineWidth = Math.max(1.5, px * 0.06);
    ctx.beginPath();
    ctx.moveTo(px * 0.12, mid);
    ctx.lineTo(px * 0.88, mid);
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

  /** Mark a card premium and tell it WHICH premium it is. Every suit and
   *  helmet already carries a `glow` in catalog.ts and every trail a
   *  palette - data the UI had never once read. Feeding it in here means a
   *  premium card blooms in its own colour instead of twenty identical gold
   *  cards, at the cost of one custom property and no new art. */
  function markPremium(node: HTMLElement, hue?: string) {
    node.classList.add("ac-premium");
    if (hue) node.style.setProperty("--pg", hue);
  }

  /** An unowned premium card is not something you can use, so it must not
   *  look like something you can use. It dims like every other locked card
   *  and, instead of doing nothing, opens the shop that sells it - the same
   *  "IN THE SHOP" contract the suit shelf already uses. Until now these
   *  rendered bright and swallowed the tap in silence; beta auto-ownership
   *  hid it, and taking that away exposed it. */
  function premiumDoor(node: HTMLElement, name: string) {
    node.classList.add("ac-cardoff");
    // No status line here: opening the shop re-renders, which builds a
    // fresh live region, so anything announced would be wiped in the same
    // frame. Arriving at the shop IS the answer to the tap.
    node.setAttribute("aria-label", `${name} \u2014 sold in a pack. Opens the shop.`);
    node.onclick = () => engine.open("shop");
  }

  function palCardOf(pl: (typeof PALS)[number], forShop = false) {
    const s = engine.save;
    const premium = isIap(pl.id);
    const open = premium ? iapOwned(s, pl.id) : palUnlocked(s, pl.id);
    const b = el("button", s.equippedPal === pl.id ? "ac-card ac-palcard on" : "ac-card ac-palcard");
    if (premium) markPremium(b);   // pals carry no palette of their own
    if (!open) b.classList.add("ac-cardoff");
    if (premium && !open && !forShop) premiumDoor(b, pl.name);
    b.append(el("p", "ac-palname", pl.name));
    const { c, ctx } = miniCanvas(72, 60);
    if (ctx) paintPalPreview(ctx, engine.art, pl.id, 36, 30, 54);
    b.append(c);
    b.append(el("p", "ac-paldesc", pl.desc));
    // The card is NAME, painting, DESCRIPTION. The foot line only exists
    // when it says something the description does not: the star price, the
    // premium state — never a redundant tag.
    const status = premium ? (open ? "OWNED" : "PREMIUM")
      : open ? ""
      : STAR_UNLOCKS.pals[pl.id] !== undefined ? `\u2605 ${STAR_UNLOCKS.pals[pl.id]}`
      : forShop ? "EARNED BY FLYING" : "LOCKED";
    if (status) b.append(el("p", "ac-palstat", status));
    b.onclick = () => { if (open) tx(b, () => engine.equipPal(pl.id)); };
    return b;
  }

  // Briella's screen. Five seconds of hearts, then a tap sends it away.
  function showLoveNote() {
    const wrap = document.createElement("div");
    wrap.className = "ac-love";
    const msg = document.createElement("p");
    msg.className = "ac-lovemsg";
    msg.textContent = "\u2764\uFE0F\u2764\uFE0F\u2764\uFE0F I love you Briella -Dad \u2764\uFE0F\u2764\uFE0F\u2764\uFE0F";
    wrap.append(msg);
    for (let i = 0; i < 26; i++) {
      const h = document.createElement("span");
      h.className = "ac-loveheart";
      h.textContent = ["\u2764\uFE0F", "\u{1F496}", "\u{1F49E}", "\u{1F497}"][i % 4];
      h.style.left = `${4 + Math.random() * 92}%`;
      h.style.animationDelay = `${(Math.random() * 3.4).toFixed(2)}s`;
      h.style.animationDuration = `${(1.6 + Math.random() * 1.4).toFixed(2)}s`;
      h.style.fontSize = `${18 + Math.round(Math.random() * 26)}px`;
      wrap.append(h);
    }
    let armed = false;
    setTimeout(() => {
      armed = true;
      const hint = document.createElement("p");
      hint.className = "ac-lovehint";
      hint.textContent = "tap to continue";
      wrap.append(hint);
    }, 5000);
    wrap.addEventListener("pointerdown", () => { if (armed) wrap.remove(); });
    document.body.append(wrap);
  }

  // WHAT HAPPENED WHEN YOU TAPPED. The engine has always returned a reason -
  // "poor", "locked", "suitOnly", "missing" - and every call site used to
  // discard it. Worse, the engine returns BEFORE notify() on those paths, so
  // there was no re-render either and a refused tap moved nothing at all.
  // One status line, spoken once, plus a shake on the card that was refused
  // so the message is attached to the thing you touched.
  let denyEl: HTMLElement | null = null;
  const DENY_TEXT: Record<string, (cost?: number) => string> = {
    poor: (c) => c ? `Not enough acorns \u2014 ${c} needed.` : "Not enough acorns.",
    locked: () => "Locked. Earn more stars to open this.",
    suitOnly: () => "This one belongs to another suit.",
    missing: () => "That item is not in this build.",
    unknown: () => "That item is not in this build.",
    owned: () => "Already yours.",
  };
  function announce(msg: string) {
    if (!denyEl) return;
    // re-set the text even when it repeats, or a second identical refusal
    // is silent to a screen reader
    denyEl.textContent = "";
    denyEl.textContent = msg;
    denyEl.classList.add("on");
  }
  function clearDeny() { if (denyEl) { denyEl.textContent = ""; denyEl.classList.remove("on"); } }
  /** run a transaction and SAY what happened. Returns true if it went through. */
  function tx(card: HTMLElement, run: () => string, cost?: number) {
    const res = run();
    const explain = DENY_TEXT[res];
    if (!explain) { clearDeny(); return true; }          // "on"/"off"/"ok" - it worked
    announce(explain(cost));
    card.classList.remove("ac-shake");
    void card.offsetWidth;                                // restart the animation
    card.classList.add("ac-shake");
    return false;
  }

  function drawHangar() {
    const s = engine.save;
    const helm = helmetWornBy(s.equipped, s.equippedSuit);
    const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
    const trail = TRAILS.find((t) => t.id === s.equippedTrail) ?? TRAILS[0];
    const pal = PALS.find((p) => p.id === s.equippedPal);
    const box = el("div", "ac-menu");
    box.append(BETA_FEATURES
      ? header("Suits & gear", "Loadout", headAside(s.acorns))
      : header("Customize your squirrel", "Hangar", headAside(s.acorns)));

    // The equipped rig stays pinned above the categories, so the preview
    // is never a mystery while you shop.
    const load = el("div", "ac-rig");
    const rigArt = el("div", "ac-rigart");
    rigArt.append(portraitOf(helm, suit, 100));
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
      if ((s.guide === "hangar" && t === "suits" && engine.shopTab !== "suits") ||
          (s.guide === "helmet" && t === "helmets" && engine.shopTab !== "helmets")) {
        b.classList.add("ac-pulse");
      }
      b.onclick = () => engine.setShopTab(t);
      tabs.append(b);
    }
    box.append(tabs);
    denyEl = el("p", "ac-deny");
    denyEl.setAttribute("role", "status");
    denyEl.setAttribute("aria-live", "polite");
    box.append(denyEl);
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
          el("p", "ac-lockedhead", `${suit.name} has its own head`),
          el("p", "ac-sub", "Its head is part of the character. Equip another suit to change helmets."),
        );
        scroll.append(note);
      }
      // grouped by what the GLASS does. A suit-locked helmet is not listed
      // at all: it arrives with its suit, and a card that cannot be chosen
      // answers nothing.
      grid.classList.add("ac-shelfcol");
      for (const sec of HELMET_SHELF) {
        const items = sec.ids
          .map((id) => HELMETS.find((h) => h.id === id))
          .filter((h): h is (typeof HELMETS)[number] => !!h && !h.suitOnly);
        if (!items.length) continue;
        grid.append(el("p", "ac-shelfhead", sec.title));
        const row = el("div", "ac-shelfrow");
        for (const h of items) {
          const premium = isIap(h.id);
          const open = helmetRevealed(s, h.id);
          const owned = premium ? iapOwned(s, h.id) : s.unlocked.includes(h.id);
          const b = el("button", !locked && s.equipped === h.id ? "ac-card on" : "ac-card");
          b.append(helmCardOf(h, 64), document.createTextNode(
            `${h.name}\n${premium ? (owned ? "OWNED" : "PREMIUM")
              : !open ? `\u2605 ${STAR_UNLOCKS.helmets[h.id]}`
              : owned ? "OWNED" : h.cost}`));
          if (premium) markPremium(b, h.glow);
          if (locked || !open) b.classList.add("ac-cardoff");
          if (premium && !owned && !locked) premiumDoor(b, h.name);
          if (s.guide === "helmet" && h.id === GUIDE_HELM) b.classList.add("ac-pulse");
          b.onclick = () => { if (!locked && open && (!premium || owned)) tx(b, () => engine.buyHelmet(h.id), h.cost); };
          row.append(b);
        }
        grid.append(row);
      }
    } else if (engine.shopTab === "suits") {
      grid.classList.add("ac-shelfcol");
      const suitCard = (u: (typeof SUITS)[number]) => {
        const premium = isIap(u.id);
        const open = suitRevealed(s, u.id);
        const owned = premium ? iapOwned(s, u.id) : s.unlockedSuits.includes(u.id);
        const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
        b.append(
          suitCardOf(u, 64),
          document.createTextNode(
            `${u.name}\n${premium ? (owned ? "OWNED" : "PREMIUM")
              : !open ? (STAR_UNLOCKS.suits[u.id] !== undefined ? `\u2605 ${STAR_UNLOCKS.suits[u.id]}` : "LOCKED")
              : owned ? "OWNED" : u.cost === 0 ? "EARNED" : u.cost}`),
        );
        // a fixed head takes no helmet; the card says so up front
        if (wearsOwnHead(u)) {
          const nh = el("span", "ac-nohelm");
          nh.title = "Wears no helmet";
          b.append(nh);
        }
        if (premium) markPremium(b, u.glow);
        if (s.guide === "hangar" && u.id === GUIDE_SUIT) b.classList.add("ac-pulse");
        b.onclick = () => { if (!premium || owned) tx(b, () => engine.buySuit(u.id), u.cost); };
        if (premium && !owned) premiumDoor(b, u.name);
        return b;
      };
      for (const sec of SUIT_SHELF) {
        const items = sec.ids
          .map((id) => SUITS.find((x) => x.id === id))
          .filter((u): u is (typeof SUITS)[number] => !!u);
        if (!items.length) continue;
        grid.append(el("p", "ac-shelfhead", sec.title));
        const row = el("div", "ac-shelfrow");
        for (const u of items) {
          // on the purchased shelf, a premium suit not yet bought is a door
          // to the shop, not a dead locked card
          if (sec.shop && isIap(u.id) && !iapOwned(s, u.id)) {
            const sq = el("button", "ac-card ac-shopcard");
            sq.append(el("span", "ac-shopglyph", "+"),
              document.createTextNode(`${u.name}\nIN THE SHOP`));
            sq.onclick = () => engine.open("shop");
            row.append(sq);
            continue;
          }
          row.append(suitCard(u));
        }
        grid.append(row);
        // ECLIPSE's experiment rides under its own shelf: while Eclipse is
        // the selected pilot, the section that lists it grows the switch
        // between its three pose mappings so they can be flown back to back.
        if (sec.ids.includes("eclipse") && s.equippedSuit === "eclipse") {
          const MOTION_MODES = [
            ["Motion: Shipped", "Pose maps straight from vertical speed."],
            ["Motion: Rate", "Pose follows how hard you are climbing or falling."],
            ["Motion: Heading", "Body follows the tangent of the flight arc."],
          ];
          const mode = ((s.eclipseMotionMode ?? 2) % 3 + 3) % 3;
          const alt = el("button", "ac-card ac-modcard on");
          const txt = el("div", "ac-modtxt");
          txt.append(el("p", "ac-modname", MOTION_MODES[mode][0]),
            el("p", "ac-sub", MOTION_MODES[mode][1] + " Tap to cycle."));
          const sw = el("span", mode > 0 ? "ac-switch on" : "ac-switch");
          sw.append(el("i", "ac-knob"));
          alt.append(txt, sw);
          alt.onclick = () => engine.setEclipseMotionMode(((engine.save.eclipseMotionMode ?? 2) + 1) % 3);
          grid.append(alt);
        }
      }
    } else if (engine.shopTab === "trails") {
      for (const t of TRAILS) {
        const premium = isIap(t.id);
        const open = trailUnlocked(s, t.id);
        const b = el("button", s.equippedTrail === t.id ? "ac-card on" : "ac-card");
        const { c, ctx } = miniCanvas(64, 56);
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", `${t.name} trail preview`);
        if (ctx) paintTrailPreview(ctx, t, 32, 28, performance.now() / 1000);
        b.append(c, document.createTextNode(
          `${t.name}\n${open ? (premium ? "OWNED" : "EARNED")
            : premium ? "PREMIUM"
            : `\u2605 ${STAR_UNLOCKS.trails[t.id]}`}`));
        if (premium) markPremium(b, t.colors[0]);
        if (!open) b.classList.add("ac-cardoff");
        if (premium && !open) premiumDoor(b, t.name);
        b.onclick = () => { if (open) tx(b, () => engine.buyTrail(t.id), t.cost); };
        grid.append(b);
      }
    } else if (engine.shopTab === "pals") {
      // Pals carry a sentence, not a two-word tag, so their shelf runs two
      // wide where everything else runs four.
      grid.classList.add("ac-palgrid");
      for (const p of PALS) grid.append(palCardOf(p));
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
        // An owned mod is a SWITCH, not a price: the card flips it and the
        // slider shows the state at a glance. Prices and star locks keep
        // their text chip.
        if (state === "ON" || state === "OFF" || state === "ARMED") {
          const sw = el("span", state === "OFF" ? "ac-switch" : "ac-switch on");
          sw.append(el("i", "ac-knob"));
          b.append(txt, sw);
        } else {
          b.append(txt, el("span", "ac-modprice", state ?? `${cost}`));
        }
        b.onclick = () => hit();
        grid.append(b);
        return b;
      };
      const shieldNut = () => {
        const { c, ctx } = miniCanvas(56, 56);
        if (ctx && engine.art?.shieldnut) drawSpriteOn(ctx, engine.art.shieldnut, 28, 28, 52);
        return c;
      };
      // These two sit behind star gates exactly like the flight mods below,
      // but only the MODS loop was dimming its locked cards. So on a fresh
      // save Start Shield rendered as the brightest, most interactive-looking
      // control on the screen and returned "locked" without moving a pixel,
      // and Battery showed its price in the gold reserved for currency to a
      // pilot holding zero acorns. A card that cannot be used has to look
      // like one.
      const shieldOpen = startShieldUnlocked(s);
      const batteryOpen = batteryUnlocked(s);
      const shieldCard = mod("shield", "Start Shield",
          "Begin the next run already shielded. Charged each time you arm it.",
          MOD_SHIELD_COST,
          !shieldOpen ? `\u2605 ${STAR_UNLOCKS.startShield}` : s.startShield ? "ARMED" : "OFF",
          shieldNut(),
          () => { if (shieldOpen) tx(shieldCard, () => engine.toggleMod("shield"), MOD_SHIELD_COST); });
      if (!shieldOpen) shieldCard.classList.add("ac-cardoff");
      const batteryCard = mod("battery", "Shield Battery",
          "Stack up to three shield charges instead of one. Bought once.",
          MOD_BATTERY_COST,
          !batteryOpen ? `\u2605 ${STAR_UNLOCKS.battery}` : s.battery ? "OWNED" : null,
          batteryIcon(56),
          () => { if (batteryOpen) tx(batteryCard, () => engine.toggleMod("battery"), MOD_BATTERY_COST); });
      if (!batteryOpen) batteryCard.classList.add("ac-cardoff");

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
        const owned = m.always || s.purchased.includes(m.id);
        const on = !!s[m.save];
        // an always-on mod ignores the star gate the others sit behind: it
        // takes something away rather than granting it, so there is nothing
        // to earn first
        const open = m.always || modsOpen;
        const b = mod(m.id, m.name, m.desc, m.always ? 0 : m.cost,
            !open ? `\u2605 ${STAR_UNLOCKS.flightMods}` : on ? "ON" : owned ? "OFF" : null,
            modIcon(m.id, 56),
            () => { if (open) tx(b, () => engine.setMod(m.id), m.always ? undefined : m.cost); });
        if (!open) b.classList.add("ac-cardoff");
      }
    }
    scroll.append(grid);
    if (s.guide === "hangar") box.append(coach("Tap your new ION SUIT to wear it"));
    else if (s.guide === "helmet") box.append(coach("Now the ION HELMET \u2014 tap to equip"));
    else if (s.guide === "levels") box.append(coach("Suited up! Mission 1 is ready \u2014 open LEVELS"));
    box.append(scroll);
    if (!BETA_FEATURES) box.append(tabbar("hangar"));
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
    if (item.kind === "helmet" && item.id) {
      const helm = HELMETS.find((h) => h.id === item.id);
      if (helm) return helmCardOf(helm, px);
    }
    if (item.kind === "trail" && item.id) {
      const t = TRAILS.find((x) => x.id === item.id);
      if (t) {
        const { c, ctx } = miniCanvas(px, px);
        if (ctx) paintTrailPreview(ctx, t, px / 2, px / 2, performance.now() / 1000);
        return c;
      }
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

  function hyperRunMask() {
    const record = engine.save.raceRecords?.[HYPER_RUN_MISSION.id];
    if (!record?.bestFinishTicks) return 0;
    return HYPER_RUN_MISSION.goals.reduce((mask, goal, i) => {
      const met = goal.kind === "finish"
        || (goal.kind === "time" && record.bestFinishTicks <= goal.ticks);
      return met ? mask | (1 << i) : mask;
    }, 0);
  }

  // ------------------------------------------------------------ the road
  // ONE road, bottom-up: a hundred numbered levels climbing from the
  // first flight at the very bottom of the scroll to the last at the top.
  // No chapters, no tabs, no level names — a planet, a number, and up to
  // three stars each. Star rewards ride a milestone rail down the right
  // edge, level with the mission whose three-star ceiling first covers
  // their price, greyed until banked.
  function fullChart(stars: Record<string, number>, total: number) {
    const levels = LEVELS;
    const gatesDone = engine.save.raceGates || [];
    const W = Math.min(460, Math.max(292, window.innerWidth - 32));
    const railW = 78;               // the milestone rail owns the right edge
    const roadW = W - railW;
    const railX = roadW + Math.round(railW / 2);
    const step = 92;
    const H = 70 + (levels.length - 1) * step + 84;
    const xs = [0.19, 0.5, 0.81, 0.5];
    const pos = levels.map((_, i) => ({
      x: Math.round(xs[i % 4] * roadW),
      y: H - 62 - i * step,
    }));
    let current = -1;
    for (let i = 0; i < levels.length; i++) {
      if (levelUnlocked(levels[i], stars, total, gatesDone) && !((stars[levels[i].id] || 0) & 1)) {
        current = i;
        break;
      }
    }

    const map = el("div", "ac-chartmap");
    map.style.width = `${W}px`;
    map.style.height = `${H}px`;

    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "ac-mappath");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", `${W}`);
    svg.setAttribute("height", `${H}`);
    const seg = (pts: { x: number; y: number }[], bright: boolean) => {
      if (pts.length < 2) return;
      const line = document.createElementNS(SVG, "polyline");
      line.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", bright ? "#ffce5c" : "#5a6488");
      line.setAttribute("stroke-opacity", bright ? ".8" : ".5");
      line.setAttribute("stroke-width", bright ? "6" : "5");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-dasharray", "0.1 16");
      svg.append(line);
    };
    const firstUndone = levels.findIndex((l) => !((stars[l.id] || 0) & 1));
    const split = firstUndone < 0 ? pos.length : firstUndone + 1;
    seg(pos.slice(0, split), true);
    if (split < pos.length) seg(pos.slice(Math.max(0, split - 1)), false);
    map.append(svg);

    // EVERY star reward rides the milestone rail down the right edge —
    // pals, trails, mods, suits, helmets, modes, titles — each level with
    // the mission whose three-star ceiling first covers its price, pushed
    // apart just enough that neighbours never overlap. The rail scrolls
    // with the road, so climbing the map walks the reward ladder too.
    const miles = STAR_REWARDS.filter((r) => r.kind !== "stage")
      .slice()
      .sort((a, b) => a.stars - b.stars);
    const gap = 88;
    let prevY = H + gap;
    const mileY = miles.map((r) => {
      const li = Math.min(levels.length - 1, Math.max(0, Math.ceil(r.stars / 3) - 1));
      const y = Math.max(50, Math.min(pos[li].y, prevY - gap));
      prevY = y;
      return y;
    });

    const railLine = document.createElementNS(SVG, "line");
    railLine.setAttribute("x1", `${railX}`);
    railLine.setAttribute("y1", "44");
    railLine.setAttribute("x2", `${railX}`);
    railLine.setAttribute("y2", `${H - 40}`);
    railLine.setAttribute("stroke", "#5a6488");
    railLine.setAttribute("stroke-opacity", ".45");
    railLine.setAttribute("stroke-width", "4");
    railLine.setAttribute("stroke-linecap", "round");
    railLine.setAttribute("stroke-dasharray", "0.1 12");
    svg.append(railLine);
    const lastEarned = miles.reduce((acc, r, i) => (total >= r.stars ? i : acc), -1);
    if (lastEarned >= 0) {
      const gold = document.createElementNS(SVG, "line");
      gold.setAttribute("x1", `${railX}`);
      gold.setAttribute("y1", `${H - 40}`);
      gold.setAttribute("x2", `${railX}`);
      gold.setAttribute("y2", `${mileY[lastEarned]}`);
      gold.setAttribute("stroke", "#ffce5c");
      gold.setAttribute("stroke-opacity", ".8");
      gold.setAttribute("stroke-width", "4");
      gold.setAttribute("stroke-linecap", "round");
      gold.setAttribute("stroke-dasharray", "0.1 12");
      svg.append(gold);
    }
    miles.forEach((r, i) => {
      const mark = el("div", total >= r.stars ? "ac-palmark mile earned" : "ac-palmark mile");
      mark.style.left = `${railX}px`;
      mark.style.top = `${mileY[i]}px`;
      mark.append(rewardArt({ lvl: 0, kind: r.kind, id: r.id, name: r.name } as (typeof TRACK)[number], 40));
      mark.append(el("span", "ac-palmarkstar", `\u2605 ${r.stars}`));
      mark.append(el("span", "ac-rmarkname", r.name));
      map.append(mark);
    });

    levels.forEach((lvl, i) => {
      const mask = stars[lvl.id] || 0;
      const can = levelUnlocked(lvl, stars, total, gatesDone);
      const isCur = i === current;
      const done = (mask & 1) === 1;
      const node = el("button",
        "ac-mapnode" + (isCur ? " cur" : done ? " done" : can ? " todo" : " locked"));
      node.style.left = `${pos[i].x}px`;
      node.style.top = `${pos[i].y}px`;
      if (can) node.append(starPips(mask, "sm"));
      const px = isCur ? 84 : 62;
      const { c, ctx } = miniCanvas(px, px);
      const bank = engine.art?.planets ?? [];
      if (ctx && bank.length) {
        drawSpriteOn(ctx, bank[(i * 7) % bank.length] ?? null, px / 2, px / 2, px * 0.94);
      }
      const disc = el("span", "ac-mapdisc");
      disc.append(c);
      if (isCur) {
        const rider = document.createElement("img");
        rider.src = `${artRootUrl()}/squirrel/idle-1.png?v=${ART_VER}`;
        rider.alt = "";
        rider.className = "ac-maprider";
        disc.append(rider);
      }
      if (!can) disc.append(icon(I_LOCK, 20));
      disc.append(el("span", "ac-mapnum", String(i + 1)));
      node.append(disc);
      if (can) node.onclick = () => { chartLevel = lvl.id; render(); };
      if (engine.save.guide === "levels" && lvl.id === "1-1") node.classList.add("ac-pulse");
      map.append(node);
    });

    // THE DEBRIS FIELDS. One node per gate, parked on the road between the
    // level it follows and the next, so the block is visible from a screen
    // away rather than discovered by tapping a locked planet. It wears the
    // scout ship because the ship is what gets you through it.
    for (const g of RACE_GATES) {
      const i = g.after - 1;                  // the level it sits after
      if (i < 0 || i >= pos.length) continue;
      const here = pos[i];
      const beyond = pos[i + 1] ?? { x: here.x, y: here.y - step };
      const done = gatesDone.includes(g.after);
      // blocking only if it is the one actually in the way
      const blocking = !done && !RACE_GATES.some((o) => o.after < g.after && !gatesDone.includes(o.after));
      const node = el("button", `ac-gatenode${done ? " done" : blocking ? " blocking" : " locked"}`);
      node.style.left = `${Math.round((here.x + beyond.x) / 2)}px`;
      node.style.top = `${Math.round((here.y + beyond.y) / 2)}px`;
      const disc = el("span", "ac-gatedisc");
      const ship = document.createElement("img");
      ship.src = `${artRootUrl()}/hyper-run/scout-ship.png?v=${ART_VER}`;
      ship.alt = "";
      ship.className = "ac-gateship";
      disc.append(ship);
      node.append(disc);
      node.append(el("span", "ac-gatelabel", done ? "CLEAR" : g.label));
      node.setAttribute("aria-label", done
        ? `Debris field after level ${g.after}: cleared`
        : `Debris field after level ${g.after}. Finish Hyper Run in ${g.label} to pass.`);
      // Only the field in your way opens. A later one is not a preview you
      // can attempt early; it is simply not your problem yet.
      if (blocking || done) node.onclick = () => { hyperRunOpen = true; render(); };
      else node.disabled = true;
      map.append(node);
    }

    const wrap = el("div", "ac-chartmapwrap");
    wrap.append(map);
    return wrap;
  }

  let chartStage = 0;           // which stage panel is open; sticky per visit
  let chartLevel: string | null = null;   // level detail overlay

  function drawLog() {
    const sv = engine.save;
    const stars = sv.stars || {};
    const total = starsOf(sv);

    const box = el("div", "ac-menu");
    // the chart flies over deep space: one nebula render behind the whole
    // screen, center-cropped by cover so the same image serves portrait
    // and landscape alike
    if (BETA_FEATURES) {
      box.classList.add("ac-chartscene");
      const art = el("div", "ac-chart-art");
      art.style.backgroundImage = `url("${artRootUrl()}/chart-bg.jpg?v=${ART_VER}")`;
      box.append(art, el("div", "ac-chart-scrim"));
    }
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

    // The reward ladder is PINNED at the top of the chart — what stars buy
    // should never be a scroll-to-the-bottom secret. It opens and closes on
    // a tap and stays collapsed by default so the chapters keep the screen.
    // BETA: the rewards ladder left this screen — every reward hangs on
    // the road itself, at the level its stars can first be earned.
    if (!BETA_FEATURES) {
      const ladder = el("div", "ac-stagecard");
      const lhead = el("button", "ac-stagehead");
      lhead.append(el("p", "ac-stagename", "REWARDS"), el("span", "ac-stagestars", chartStage === -1 ? "\u25be what stars unlock" : "\u25b8 what stars unlock"));
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
    }

    if (BETA_FEATURES) {
      scroll.append(fullChart(stars, total));
    } else {
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
          {
            const grid = el("div", "ac-lvlgrid");
            for (const lvl of LEVELS.filter((l) => l.stage === st.num)) {
              const mask = stars[lvl.id] || 0;
              const can = levelUnlocked(lvl, stars, total, engine.save.raceGates);
              const b = el("button", can ? "ac-lvlbtn" : "ac-lvlbtn locked");
              b.append(el("span", "ac-lvlnum", String(lvl.n)));
              b.append(starPips(mask, "sm"));
              if (can) b.onclick = () => { chartLevel = lvl.id; render(); };
              if (sv.guide === "levels" && lvl.id === "1-1") b.classList.add("ac-pulse");
              grid.append(b);
            }
            card.append(grid);
          }
        }
        scroll.append(card);
      }
    }

    if (sv.guide === "levels") box.append(coach("Fly MISSION 1 \u2014 tap level 1, then TAKE FLIGHT"));
    box.append(scroll);
    if (!BETA_FEATURES) box.append(tabbar("log"));

    // level detail: goals, modifiers, and the FLY button
    if (chartLevel) {
      const def = LEVELS.find((l) => l.id === chartLevel);
      if (def) box.append(drawLevelSheet(def, stars[def.id] || 0));
    }
    // THE DEBRIS FIELD'S BRIEFING. The gate nodes live on this screen, but
    // hyperRunOpen was only ever read by the hub - so tapping a field set a
    // flag nothing on the chart looked at, and the one route to Hyper Run
    // before it is unlocked opened nothing at all. It renders here too, and
    // returns to the chart rather than the hub because that is where the
    // tap came from.
    if (hyperRunOpen) {
      box.append(drawLevelSheet(HYPER_RUN_MISSION, hyperRunMask(), "chart"));
    }
    return box;
  }

  function drawLevelSheet(def: LevelDef, mask: number, origin: "chart" | "modes" = "chart") {
    const wrap = el("div", "ac-lvlsheet");
    const sheet = el("div", "ac-lvlcard");
    const raceBriefing = def.standalone && def.base === "race";
    if (raceBriefing) sheet.classList.add("ac-racecard");
    // BETA: a level is a number and its three stars — no name, no place,
    // no modifier tags. The live page keeps the full briefing.
    // This read HYPER_RUN_ENABLED, using it as a stand-in for IS_BETA back
    // when the two were the same value. Promoting Hyper Run to live would
    // therefore have stripped every live level briefing down to "Level 12"
    // as a side effect. It now asks the question it actually means.
    const plain = IS_BETA && !def.standalone;
    if (plain) {
      const gnum = LEVELS.findIndex((l) => l.id === def.id) + 1;
      sheet.append(el("p", "ac-kicker", "STAR CHART"));
      sheet.append(el("h2", "ac-lvlname", `Level ${gnum || def.id}`));
    } else {
    const place = def.base === "race" ? "HYPER RUN"
      : def.base === "tunnel" ? "WORMHOLE RUN"
      : def.base === "spill" ? "THE SPILL"
      : ENVS[def.fx.env ?? 0]?.name ?? "";
    sheet.append(el("p", "ac-kicker", def.standalone
      ? "HYPER RUN · TIME TRIAL"
      : `LEVEL ${def.id} \u00b7 ${place}`));
    sheet.append(el("h2", "ac-lvlname", def.name));
    const mode =
      def.base === "race" ? "DETERMINISTIC TIME TRIAL" :
      def.base === "deep" ? "DEEP SPACE RULES" :
      def.base === "lost" ? "LOST IN SPACE RULES" :
      def.base === "arcade" ? "ARCADE TIMELINE" :
      def.base === "tunnel" ? "WORMHOLE MISSION" :
      def.base === "spill" ? "SPILL MISSION" : "";
    const fxs = fxText(def.fx);
    if (mode || fxs.length) {
      const tags = el("div", "ac-lvltags");
      if (mode) tags.append(el("span", "ac-lvltag mode", mode));
      for (const t of fxs) tags.append(el("span", "ac-lvltag", t));
      sheet.append(tags);
    }
    }
    if (raceBriefing) {
      const briefing = el("div", "ac-racebrief");
      const objective = el("section", "ac-racebriefblock ac-raceobjective");
      objective.append(
        el("h3", "", "OBJECTIVE"),
        el("p", "", "Thread blue gates to build speed and charge the wormhole. Take shortcuts and reach the finish as fast as possible. Acorns are an optional collection record and do not change your time."),
      );
      const controlRow = (input: string, action: string) => {
        const row = el("div", "ac-racecontrol");
        row.append(el("b", "", input), el("span", "", action));
        return row;
      };
      const flight = el("section", "ac-racebriefblock");
      flight.append(
        el("h3", "", "SPACE FLIGHT"),
        controlRow("HOLD", "Rise"),
        controlRow("RELEASE", "Fall"),
        controlRow("DOUBLE-TAP + HOLD", "Boost climb"),
        controlRow("SWIPE DOWN", "Dive"),
      );
      const wormhole = el("section", "ac-racebriefblock");
      wormhole.append(
        el("h3", "", "WORMHOLE"),
        controlRow("PRESS + DRAG", "Steer up and down"),
        controlRow("WHITE RING", "Pass through the aperture"),
        controlRow("CENTER RING", "Perfect connection · faster exit"),
      );
      const controls = el("div", "ac-racecontrols");
      controls.append(flight, wormhole);
      briefing.append(objective, controls);
      sheet.append(briefing);
    }
    const goals = el("div", "ac-lvlgoals");
    def.goals.forEach((g, i) => {
      const row = el("div", (mask >> i) & 1 ? "ac-goal on" : "ac-goal");
      row.append(el("span", (mask >> i) & 1 ? "ac-pip on" : "ac-pip", "\u2605"));
      row.append(el("span", "", goalText(g, def)));
      goals.append(row);
    });
    sheet.append(goals);
    if (def.standalone) {
      // A gate turns this from a time trial into the way past a blocked
      // road, so the briefing has to say WHICH field and WHAT time before
      // the pilot commits to a run rather than after.
      const g = nextGate(engine.save.raceGates);
      if (g && !IS_BETA) {
        const note = el("p", "ac-sub ac-gatenote");
        note.append(el("b", "", `DEBRIS FIELD AFTER LEVEL ${g.after}`),
                    el("span", "", ` \u00b7 finish under ${g.label} to clear it`));
        sheet.append(note);
      }
      sheet.append(el("p", "ac-sub", "OWN RECORD \u00b7 CAMPAIGN STARS UNCHANGED"));
    }
    const fly = el("button", "ac-primary", plain ? "TAKE FLIGHT" : def.standalone ? "START RUN" : mask & 1 ? "FLY AGAIN" : "FLY");
    fly.onclick = () => {
      chartLevel = null;
      hyperRunOpen = false;
      modesOpen = false;
      const launched = def.id === HYPER_RUN_MISSION.id
        ? launchHyperRun((id) => engine.flyLevel(id))
        : engine.flyLevel(def.id);
      // A refused launch must leave the briefing recoverable rather than
      // turning START RUN into another dead control - from the chart as
      // well as from Modes, since the chart is the only route in before
      // the mode is unlocked.
      if (!launched) {
        hyperRunOpen = true;
        if (origin === "modes") modesOpen = false;
        render();
      }
    };
    const back = el("button", "ac-ghost", "BACK");
    const close = () => {
      chartLevel = null;
      // the sheet is open because a flag says so, and the flag has to be
      // cleared on BOTH routes or closing it from the chart just redraws it
      hyperRunOpen = false;
      if (origin === "modes") modesOpen = true;
      render();
    };
    back.onclick = close;
    sheet.append(fly, back);
    wrap.append(sheet);
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    return wrap;
  }

  function drawLevelDone(last: NonNullable<typeof engine.world.lastLevel>) {
    if (last.def.standalone && last.def.base === "race" && last.raceRecord) {
      const r = last.raceRecord;
      const sheet = el("div", "ac-sheet ac-center");
      sheet.append(el("p", "ac-kicker", "HYPER RUN"));
      sheet.append(el("h2", "", "HYPER RUN"));
      sheet.append(el("p", "ac-kicker", "FINISH"));
      sheet.append(el("h2", "", formatRaceTicks(r.finishTicks)));
      if (r.newBestTime) sheet.append(el("p", "ac-gold", "NEW BEST"));
      else sheet.append(el("p", "ac-sub", `+${((r.finishTicks - r.bestFinishTicks) / 60).toFixed(3)}`));
      // A cleared field outranks a personal best on this screen: the best
      // is a number, the field is a road that just opened.
      if (r.clearedGate) {
        const won = el("p", "ac-gold ac-gatecleared");
        won.append(el("b", "", "DEBRIS FIELD CLEARED"),
                   el("span", "", ` \u2014 the road past level ${r.clearedGate.after} is open`));
        sheet.append(won);
      } else if (!IS_BETA) {
        const g = nextGate(engine.save.raceGates);
        if (g) sheet.append(el("p", "ac-sub",
          `Debris field after level ${g.after} still holds \u2014 needs ${g.label}.`));
      }
      const pips = el("div", "ac-bigpips");
      last.met.forEach((ok) => pips.append(el("span", ok ? "ac-bigpip earned" : "ac-bigpip", "★")));
      sheet.append(pips);
      const labels = el("div", "ac-lvlgoals");
      last.def.goals.map((goal) => goal.kind === "time"
        ? `≤ ${formatRaceTicks(goal.ticks)}`
        : goal.kind === "finish" ? "FINISH" : goalText(goal, last.def).toUpperCase()
      ).forEach((label, i) => {
        const row = el("div", last.met[i] ? "ac-goal on" : "ac-goal");
        row.append(el("span", last.met[i] ? "ac-pip on" : "ac-pip", "★"), el("span", "", label));
        labels.append(row);
      });
      sheet.append(labels);
      sheet.append(el("p", "", `ACORNS  ${r.acorns} / ${HYPER_RUN_MAX_ACORNS}`));
      sheet.append(el("p", "", `BEST  ${r.bestAcorns}`));
      if (r.newBestAcorns) sheet.append(el("p", "ac-gold", "NEW ACORN BEST"));
      sheet.append(el("p", "ac-sub", "OWN RECORD — CAMPAIGN STARS UNCHANGED"));
      const again = el("button", "ac-primary", "RUN AGAIN");
      again.onclick = () => engine.flyLevel(last.def.id);
      const back = el("button", "ac-ghost", "BACK TO LOG");
      back.onclick = () => engine.open("log");
      sheet.append(again, back);
      return sheet;
    }
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
    if (last.finished && next && levelUnlocked(next, stars, last.totalAfter, engine.save.raceGates)) {
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

  let foundersOpen = false;
  let foundersMsg = "";

  // THE SHOP HAS TWO PAGES, and they are different KINDS of thing rather
  // than two shelves of the same thing: PACKS spends Star Dust, DUST buys
  // it. Splitting them keeps a real-money purchase from ever sitting one
  // tap away from an in-game one by accident.
  let shopPage: "packs" | "dust" = "packs";

  function drawShop() {
    const s = engine.save;
    const box = el("div", "ac-menu");
    box.append(header("Premium", "Shop", headAside(s.acorns)));

    // NO TYPE TABS. The shop used to re-list suits, helmets and pals - the
    // same art, wired to the same equip calls, that the Loadout already
    // shows. Three tabs of duplicate wardrobe, and on the live page every
    // premium card in them was inert. The shop SELLS. What you own is the
    // Loadout's job.
    const tabs = el("div", "ac-cats");
    for (const t of ["packs", "dust"] as const) {
      const b = el("button", t === shopPage ? "ac-cat on" : "ac-cat",
                   t === "packs" ? "PACKS" : "STAR DUST");
      b.onclick = () => { shopPage = t; keptScroll = 0; render(); };
      tabs.append(b);
    }
    box.append(tabs);

    denyEl = el("p", "ac-deny");
    denyEl.setAttribute("role", "status");
    denyEl.setAttribute("aria-live", "polite");
    box.append(denyEl);

    const scroll = el("div", "ac-sheet-scroll");

    // THE DAILY. It sits above both pages because it is the one thing in
    // here that costs nothing, and burying free currency under a tab is a
    // good way to have nobody find it.
    scroll.append(drawDaily());

    const grid = el("div", "ac-grid");

    if (shopPage === "packs") {
      for (const bn of BUNDLES) {
        const owned = bn.items.every((i) => iapOwned(s, i));
        const card = el("button", "ac-card ac-bundle");
        const strip = el("div", "ac-bundlestrip");
        const seen = new Set<string>();
        for (const id of bn.items) {
          if (seen.has(id)) continue;
          seen.add(id);
          if (seen.size > 4) break;
          const suit = SUITS.find((u) => u.id === id);
          const helm = HELMETS.find((h) => h.id === id);
          if (suit) strip.append(suitCardOf(suit, 40));
          else if (helm) strip.append(helmCardOf(helm, 40));
        }
        // A suit and its helmet SHARE an id in this catalog - owning
        // "cryostar" grants both - so counting distinct ids undercounts what
        // the pilot actually receives. Count the wearables instead.
        const worn = bn.items.reduce((n, id) => n
          + (SUITS.some((u) => u.id === id) ? 1 : 0)
          + (HELMETS.some((h) => h.id === id) ? 1 : 0)
          + (TRAILS.some((t) => t.id === id) ? 1 : 0)
          + (PALS.some((pl) => pl.id === id) ? 1 : 0), 0);
        if (seen.size > 4) strip.append(el("span", "ac-bundlemore", `+${worn - 4}`));
        card.append(strip);
        const txt = el("div", "ac-modtxt");
        txt.append(el("p", "ac-modname", bn.name), el("p", "ac-sub", bn.blurb));
        card.append(txt);
        const price = el("span", "ac-modprice ac-dustprice");
        if (owned) price.textContent = "OWNED";
        else { price.append(icon(I_DUST, 12, true), el("span", "", bn.dust.toLocaleString())); }
        card.append(price);
        if (owned) card.classList.add("on");
        card.append(el("span", "ac-bundlecount", `${worn} items`));
        if (!owned) card.onclick = () => { tx(card, () => engine.buyBundle(bn.id), bn.dust); };
        grid.append(card);
      }
      grid.append(codeRow());
    } else {
      for (const pk of DUST_PACKS) {
        const card = el("button", "ac-card ac-bundle ac-dustpack");
        const face = el("div", "ac-dustface");
        face.append(icon(I_DUST, 40, true));
        card.append(face);
        const txt = el("div", "ac-modtxt");
        txt.append(el("p", "ac-modname", `${pk.dust.toLocaleString()} Star Dust`),
                   el("p", "ac-sub", pk.bonus ? `+${pk.bonus} bonus \u2014 ${(pk.dust + pk.bonus).toLocaleString()} total` : "Starter handful."));
        card.append(txt, el("span", "ac-modprice", pk.price));
        card.onclick = () => { tx(card, () => engine.buyDust(pk.id)); };
        grid.append(card);
      }
      scroll.append(grid);
      scroll.append(el("p", "ac-fine",
        "The payment rail is not connected yet, so packs are granted during the beta."));
      box.append(scroll);
      if (!BETA_FEATURES) box.append(tabbar("shop"));
      return box;
    }

    scroll.append(grid);
    // This used to read "premium is unlocked for everyone during the beta",
    // which stopped being true the moment the beta started BUYING packs
    // instead of being handed them.
    scroll.append(el("p", "ac-fine", IS_BETA
      ? "Beta pilots start with enough Star Dust for every pack \u2014 buy them here to test the shop."
      : "Premium items arrive with the full release."));
    box.append(scroll);
    if (!BETA_FEATURES) box.append(tabbar("shop"));
    return box;
  }

  /** the access-code redeem row, unchanged in behaviour, lifted out so the
   *  pack page reads as a list of packs rather than a list plus a form */
  function codeRow() {
    const wrap = el("div", "ac-coderow-wrap");
    const open = el("button", "ac-codeopen", foundersOpen ? "HIDE ACCESS CODE" : "HAVE AN ACCESS CODE?");
    open.onclick = () => { foundersOpen = !foundersOpen; foundersMsg = ""; render(); };
    wrap.append(open);
    if (foundersOpen) {
      const row = el("div", "ac-coderow");
      const input = document.createElement("input");
      input.type = "tel";
      input.inputMode = "numeric";
      input.placeholder = "ACCESS CODE";
      input.className = "ac-codein";
      const go = el("button", "ac-primary ac-codego", "REDEEM");
      go.onclick = () => {
        const res = engine.redeemAccessCode(input.value);
        if (res === "ok") { foundersOpen = false; foundersMsg = ""; }
        else if (res === "love") { foundersOpen = false; foundersMsg = ""; showLoveNote(); render(); }
        else { foundersMsg = "That code doesn't open this door."; render(); }
      };
      row.append(input, go);
      wrap.append(row);
      if (foundersMsg) wrap.append(el("p", "ac-fine ac-codemsg", foundersMsg));
    }
    return wrap;
  }

  /** SIGN IN AND CLAIM. Seven pips, one per day of the streak; the seventh
   *  pays the bonus. The pips are drawn even after claiming so the pilot can
   *  see how far along the week they are rather than only being told. */
  function drawDaily() {
    const st = engine.dailyState();
    const card = el("div", st.claimedToday ? "ac-daily done" : "ac-daily");
    const left = el("div", "ac-dailytxt");
    left.append(el("p", "ac-modname", "DAILY STAR DUST"));
    const pips = el("div", "ac-pips");
    for (let i = 1; i <= DAILY_STREAK_LEN; i++) {
      const on = i <= st.streak;
      const pip = el("i", `ac-pip${on ? " on" : ""}${i === DAILY_STREAK_LEN ? " big" : ""}`);
      pip.setAttribute("aria-hidden", "true");
      pips.append(pip);
    }
    left.append(pips);
    left.append(el("p", "ac-sub", st.claimedToday
      ? `Claimed. Day ${st.streak} of ${DAILY_STREAK_LEN} \u2014 come back tomorrow.`
      : st.bonusDay
        ? `Day ${DAILY_STREAK_LEN}! Claim ${st.amount} \u2014 ${DAILY_DUST} plus the ${DAILY_STREAK_BONUS} streak bonus.`
        : `Day ${st.streak} of ${DAILY_STREAK_LEN}. Claim ${st.amount}, and ${DAILY_STREAK_BONUS} more on day ${DAILY_STREAK_LEN}.`));
    card.append(left);
    const go = el("button", st.claimedToday ? "ac-primary ac-dailygo off" : "ac-primary ac-dailygo");
    if (st.claimedToday) { go.textContent = "CLAIMED"; go.disabled = true; }
    else { go.append(el("span", "", "CLAIM "), icon(I_DUST, 13, true), el("span", "", `${st.amount}`)); }
    go.onclick = () => {
      if (engine.claimDaily() === "ok") render();
    };
    card.append(go);
    return card;
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

    // The five per-mode records used to be listed here as well. They live
    // on the mode buttons themselves - fly, deep, lost and arcade read the
    // same save fields this list did, and Wormhole Run the same tunnelBest -
    // so this was a second copy of the same numbers, read in the place they
    // are least useful. A record belongs where you choose the mode.

    // BETA: settings left this screen for the hub's gear button, where
    // they sit with Help; the live page keeps Music here for now.
    if (!BETA_FEATURES) {
      scroll.append(el("p", "ac-kicker ac-secthead", "Settings"));
      const settings = el("div", "ac-rows");
      const musicRow = el("button", "ac-row ac-rowbtn");
      musicRow.append(el("span", "", "Music"));
      const musicSw = el("span", s.musicOff ? "ac-switch" : "ac-switch on");
      musicSw.append(el("i", "ac-knob"));
      musicRow.append(musicSw);
      musicRow.onclick = () => {
        engine.setMusicOff(!engine.save.musicOff);
        musicSw.className = engine.save.musicOff ? "ac-switch" : "ac-switch on";
      };
      settings.append(musicRow);
      scroll.append(settings);
    }
    scroll.append(el("p", "ac-kicker ac-secthead", "Community"));
    const social = el("div", "ac-rows");
    // A real anchor rather than a scripted navigation: it middle-clicks,
    // long-presses and opens in a new tab the way a link is expected to.
    // noopener/noreferrer because the destination is outside the game.
    const discord = document.createElement("a");
    discord.className = "ac-row ac-rowbtn ac-social";
    discord.href = "https://discord.gg/xGnCuaSDG";
    discord.target = "_blank";
    discord.rel = "noopener noreferrer";
    const dwrap = el("span", "ac-socialmark");
    dwrap.append(icon(I_DISCORD, 20, true));
    const dtxt = el("span", "ac-socialtxt");
    dtxt.append(el("b", "", "Discord"), el("span", "", "Flight chatter, bug reports, early looks."));
    discord.append(dwrap, dtxt, el("span", "ac-socialgo", "\u2197"));
    social.append(discord);
    scroll.append(social);

    scroll.append(el("p", "ac-kicker ac-secthead", "News"));
    const news = el("div", "ac-rows");
    for (const line of NEWS) {
      const r = el("div", "ac-row ac-rownote");
      r.append(el("span", "ac-sub", line));
      news.append(r);
    }
    scroll.append(news, el("p", "ac-fine ac-mid", `${BUILD} · ${GAME_VERSION}`));

    box.append(scroll);
    if (!BETA_FEATURES) box.append(tabbar("profile"));
    return box;
  }

  function drawHelp() {
    const box = el("div", "ac-menu");
    box.append(BETA_FEATURES ? header("Flight deck", "Settings & Help") : header("Briefing", "How to Fly"));
    const scroll = el("div", "ac-sheet-scroll");

    // BETA: music moved here from the Profile — settings and help share
    // the hub's gear button. The live page keeps Help as the briefing.
    if (BETA_FEATURES) {
      const settings = el("div", "ac-rows");
      const musicRow = el("button", "ac-row ac-rowbtn");
      musicRow.append(el("span", "", "Music"));
      const musicSw = el("span", engine.save.musicOff ? "ac-switch" : "ac-switch on");
      musicSw.append(el("i", "ac-knob"));
      musicRow.append(musicSw);
      musicRow.onclick = () => {
        engine.setMusicOff(!engine.save.musicOff);
        musicSw.className = engine.save.musicOff ? "ac-switch" : "ac-switch on";
      };
      settings.append(musicRow);
      scroll.append(el("p", "ac-kicker ac-secthead", "Settings"), settings);
      scroll.append(el("p", "ac-kicker ac-secthead", "How to fly"));
    }

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

    item(pic(spr("acorn")), "ACORN", "Earned by flying \u2014 spend it in the hangar.");
    // TWO currencies, and the difference is the whole point: one is flown
    // for, one is bought. Saying so here is cheaper than letting a pilot
    // work it out from a price they cannot pay.
    item(pic((ctx: CanvasRenderingContext2D, px: number) => {
      // the help sheet paints to canvas, so the glyph is drawn by hand here
      // from the same proportions as I_DUST rather than inlining an <svg>
      ctx.save();
      ctx.translate(px / 2, px / 2);
      ctx.scale(px / 24, px / 24);
      ctx.fillStyle = "#c9b6ff";
      ctx.beginPath();
      ctx.moveTo(0, -9.8); ctx.lineTo(1.9, -3); ctx.lineTo(8.4, 0);
      ctx.lineTo(1.9, 3);  ctx.lineTo(0, 9.8);  ctx.lineTo(-1.9, 3);
      ctx.lineTo(-8.4, 0); ctx.lineTo(-1.9, -3); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }), "STAR DUST", "Premium currency \u2014 buys packs. Claim 5 free every day, plus 25 on a seven-day streak.");
    item(pic(one("frozen")), "FREEZE ACORN", `Slows everything for ${PHYS.powerDuration} seconds.`);
    item(pic(one("shieldnut")), "SHIELD ACORN", "Absorbs one debris hit. Rare \u2014 grab it.");
    item(pic(spr("golden")), "GOLDEN ACORN", "Invulnerable to debris \u2014 planets still bounce. In Wormhole Run it is the FLOW ACORN: fills Flow and guarantees at least \u00d72 score for 8 seconds.");
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

    // The mode blurbs left the beta's help: every mode describes itself on
    // the MODES sheet now. The live Briefing keeps them — it is still the
    // only place the live page explains the modes.
    if (!BETA_FEATURES) {
      scroll.append(el("p", "ac-sub ac-mid", "DEEP SPACE: space shifts every 10s."));
      scroll.append(el("p", "ac-sub ac-mid", "ARCADE: the original game, in its own hand. Double power-ups, wormhole reversals, and its own soundtrack."));
      scroll.append(el("p", "ac-sub ac-mid", "FREE FLIGHT: catch the 8-bit acorn to slip into the arcade for a stretch — catch another to come home."));
      scroll.append(el("p", "ac-sub ac-mid", "LOST IN SPACE: drift, tilt, wormholes."));
      scroll.append(el("p", "ac-sub ac-mid", BETA_FEATURES
        ? "WORMHOLE RUN: hold to rise and release to fall; swipes are ignored. Follow changing currents, build Flow, collect Freeze Acorns, and dodge lethal debris. Pals appear cosmetically, while their abilities and flight mods stay off so every score uses the same physics."
        : "WORMHOLE RUN: tap-only; swipes are ignored. Tap to rise, then gravity pulls you down. Follow changing currents, build Flow, collect Freeze Acorns, and dodge lethal debris. Pals appear cosmetically, while their abilities and flight mods stay off so every score uses the same physics."));
      scroll.append(el("p", "ac-gold ac-mid", "OTHER MODES \u2014 BRING A PAL: each adds a fun modifier."));
    }
    box.append(scroll);

    const replay = el("button", "ac-ghost ac-replay", "REPLAY TUTORIAL");
    replay.onclick = () => engine.replayTutorial();
    scroll.append(replay);

    // BETA reaches the prototype doors through the MODES sheet on the hub;
    // the live page keeps them here, one deliberate tap away, as before.
    if (!BETA_FEATURES) {
      const labRoot = "./lab/";
      const lab = el("button", "ac-ghost ac-lab", "SURVIVAL TEST MODE");
      lab.onclick = () => { window.location.href = labRoot + "spill/"; };
      const rig = el("button", "ac-ghost ac-lab", "RIG EDITOR");
      rig.onclick = () => { window.location.href = labRoot + "rig/"; };
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
    if (!BETA_FEATURES) box.append(tabbar("none"));
    return box;
  }

  engine.subscribe(render);
  render();
  window.addEventListener("resize", () => engine.resize());
}
