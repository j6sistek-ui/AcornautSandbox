import { xpCumulative, BUILD, GAME_VERSION, HELMETS, NEWS, PALS, SUITS, TRACK, TRAILS } from "./catalog";
import { paintPortrait, paintTrailPreview, paintPalPreview } from "./draw";
import { artUrl, drawSprite as drawSpriteOn } from "./art";
import { createEngine } from "./engine";
import { palUnlocked, pilotLevelOf, pilotTitleOf, suitRevealed } from "./save";

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
  stage.append(canvas, overlay);
  root.append(stage);

  const engine = await createEngine(canvas);
  // sandbox is a test bed: expose the engine so runs can be driven and
  // certified from a harness (env sweeps, cosmetic matrices, replays)
  (window as unknown as { __sandbox?: unknown }).__sandbox = engine;
  engine.start();

  const render = () => {
    const snap = engine.snap();
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
      const sheet = el("div", "ac-sheet ac-center");
      sheet.append(el("h2", "", "CRASHED"), el("p", "", `Score ${snap.dead.score}`));
      if (snap.dead.best && snap.dead.score > 0) sheet.append(el("p", "ac-gold", "NEW BEST"));
      sheet.append(el("p", "ac-sub", `+${snap.dead.xp} XP · LV ${snap.dead.toLv}`));
      if (snap.dead.toLv > snap.dead.fromLv) sheet.append(el("p", "ac-gold", `LEVEL UP — LV ${snap.dead.toLv}!`));
      {
        // the run's XP pours into the level meter
        const lo = xpCumulative(snap.dead.toLv);
        const hi = xpCumulative(snap.dead.toLv + 1);
        const span = Math.max(1, hi - lo);
        const fromPct = Math.max(0, Math.min(1, (snap.dead.fromXp - lo) / span));
        const toPct = Math.max(0, Math.min(1, (engine.save.xp - lo) / span));
        const bar = el("div", "ac-xpbar");
        const fill = el("div", "");
        fill.style.width = `${(fromPct * 100).toFixed(1)}%`;
        bar.append(fill);
        sheet.append(bar);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            fill.style.width = `${(toPct * 100).toFixed(1)}%`;
          }),
        );
      }
      const go = el("button", "ac-primary", "CONTINUE");
      go.onclick = () => engine.dismissDead();
      sheet.append(go);
      overlay.append(sheet);
      return;
    }
    if (snap.screen === "title") {
      overlay.append(drawTitle());
      return;
    }
    if (snap.screen === "hangar") {
      overlay.append(drawHangar());
      return;
    }
    if (snap.screen === "log") {
      overlay.append(drawLog());
      return;
    }
    if (snap.screen === "social") {
      overlay.append(drawSocial());
      return;
    }
    if (snap.screen === "help") {
      overlay.append(drawHelp());
    }
  };

  function header(title: string) {
    const h = el("header", "ac-head");
    const back = el("button", "ac-ghost", "BACK");
    back.onclick = () => engine.open("title");
    h.append(back, el("h2", "", title));
    return h;
  }

  function drawTitle() {
    const s = engine.save;
    const box = el("div", "ac-sheet");
    const top = el("div", "ac-row");
    const brand = el("div");
    brand.append(el("p", "ac-kicker", "Illustrated rewrite"), el("h1", "", "Acornaut"));
    const nuts = el("div", "ac-chip");
    const coin = document.createElement("img");
    coin.src = artUrl("acorn/1.png");
    coin.className = "ac-coin";
    coin.alt = "";
    nuts.append(coin, document.createTextNode(`${s.acorns}`));
    top.append(brand, nuts);
    const hero = document.createElement("img");
    hero.src = `${(window.__ACORNAUT_ART__ || "/art").replace(/\/$/, "")}/hero.jpg`;
    hero.className = "ac-hero";
    hero.alt = "";
    box.append(top, hero);
    const fly = el("button", "ac-primary", "FLY");
    fly.onclick = () => engine.fly("fly");
    const deep = el("button", "ac-ghost", "DEEP SPACE");
    deep.onclick = () => engine.fly("deep");
    const lost = el("button", "ac-ghost", "LOST IN SPACE");
    lost.onclick = () => engine.fly("lost");
    const arcade = el("button", "ac-ghost", "ARCADE");
    arcade.onclick = () => engine.fly("arcade");
    // the live game's bottom bar: four round icons pinned to the bottom
    const ICONS: Record<string, string> = {
      hangar:
        '<svg viewBox="0 0 24 24"><path d="M20.5 7.5a4.9 4.9 0 0 1-6.4 4.6L7 19.2a2 2 0 0 1-2.8-2.8l7.1-7.1a4.9 4.9 0 0 1 6-6.1L14.6 6l3.2 3.2 2.5-2.6z"/></svg>',
      log:
        '<svg viewBox="0 0 24 24"><path d="M6 3v18M6 4h11l-2.5 3.5L17 11H6"/></svg>',
      social:
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>',
      help:
        '<svg viewBox="0 0 24 24"><path d="M8.8 9.2a3.2 3.2 0 1 1 4.9 2.7c-1 .7-1.7 1.2-1.7 2.6"/><circle cx="12" cy="18" r=".6"/></svg>',
    };
    const nav = el("nav", "ac-dock2");
    for (const [label, screen] of [
      ["Hangar", "hangar"],
      ["Log", "log"],
      ["Social", "social"],
      ["Help", "help"],
    ] as const) {
      const b = el("button", "ac-dockicon");
      const ring = el("span", "ac-ring");
      ring.innerHTML = ICONS[screen];
      b.append(ring, document.createTextNode(label));
      b.onclick = () => engine.open(screen);
      nav.append(b);
    }
    box.append(fly, deep, lost, arcade, nav, el("p", "ac-fine", `${BUILD} · ${GAME_VERSION}`));
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

  function shopImg(src: string, alt: string) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.draggable = false;
    img.width = 64;
    img.height = 64;
    return img;
  }

  function helmCardOf(helmet: (typeof HELMETS)[number], px = 56) {
    // the dedicated helmet render IS the card — no shrunken squirrel
    const spr = engine.art?.helms?.[helmet.id];
    if (!spr) return portraitOf(helmet, SUITS[0], px);
    const { c, ctx } = miniCanvas(px, px);
    if (ctx) drawSpriteOn(ctx, spr, px / 2, px / 2, px * 0.92);
    return c;
  }

  function portraitOf(helmet: (typeof HELMETS)[number], suit: (typeof SUITS)[number], px = 56) {
    const { c, ctx } = miniCanvas(px, px);
    if (ctx && engine.art) paintPortrait(ctx, engine.art, helmet, suit, px / 2, px / 2, px * 0.88);
    return c;
  }

  function drawHangar() {
    const s = engine.save;
    const helm = HELMETS.find((h) => h.id === s.equipped) ?? HELMETS[0];
    const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
    const trail = TRAILS.find((t) => t.id === s.equippedTrail) ?? TRAILS[0];
    const pal = PALS.find((p) => p.id === s.equippedPal);
    const box = el("div", "ac-sheet");
    box.append(header("Hangar"));
    const load = el("div", "ac-loadout");
    load.append(portraitOf(helm, suit, 64));
    const loadTxt = el("div");
    loadTxt.append(el("p", "", `${helm.name} · ${suit.name}`));
    loadTxt.append(el("p", "ac-sub", `${trail.name} · ${pal?.name ?? "None"}`));
    load.append(loadTxt);
    if (pal) {
      const { c, ctx } = miniCanvas(40, 40);
      if (ctx) paintPalPreview(ctx, engine.art, pal.id, 20, 20, 36);
      load.append(c);
    }
    box.append(load);
    box.append(el("p", "ac-sub", `${s.acorns} acorns · LV ${pilotLevelOf(s)} ${pilotTitleOf(s)}`));
    const tabs = el("div", "ac-tabs");
    for (const t of ["helmets", "suits", "trails", "pals", "mods"] as const) {
      const b = el("button", t === engine.shopTab ? "ac-tab on" : "ac-tab", t);
      b.onclick = () => engine.setShopTab(t);
      tabs.append(b);
    }
    box.append(tabs);
    const scroll = el("div", "ac-sheet-scroll");
    const grid = el("div", "ac-grid");
    if (engine.shopTab === "helmets") {
      for (const h of HELMETS) {
        const owned = s.unlocked.includes(h.id);
        const b = el("button", s.equipped === h.id ? "ac-card on" : "ac-card");
        b.append(helmCardOf(h, 64), document.createTextNode(`${h.name}\n${owned ? "OWNED" : h.cost}`));
        b.onclick = () => engine.buyHelmet(h.id);
        grid.append(b);
      }
    } else if (engine.shopTab === "suits") {
      for (const u of SUITS) {
        const open = suitRevealed(s, u.id);
        const owned = s.unlockedSuits.includes(u.id);
        const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
        b.append(
          shopImg(artUrl(`suits/${u.id}.png`), u.name),
          document.createTextNode(`${u.name}\n${!open ? "LOCKED" : owned ? "OWNED" : u.cost}`),
        );
        b.onclick = () => engine.buySuit(u.id);
        grid.append(b);
      }
    } else if (engine.shopTab === "trails") {
      for (const t of TRAILS) {
        const owned = s.unlockedTrails.includes(t.id);
        const b = el("button", s.equippedTrail === t.id ? "ac-card on" : "ac-card");
        const { c, ctx } = miniCanvas(64, 36);
        if (ctx) paintTrailPreview(ctx, t, 28, 18, 0.2);
        b.append(c, document.createTextNode(`${t.name}\n${owned ? "OWNED" : t.cost}`));
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
      const sh = el("button", "ac-ghost", s.startShield ? "Start Shield ARMED" : "Arm Start Shield");
      sh.onclick = () => engine.toggleMod("shield");
      const bat = el("button", "ac-ghost", s.battery ? "Battery OWNED" : "Buy Shield Battery");
      bat.onclick = () => engine.toggleMod("battery");
      scroll.append(sh, bat);
    }
    if (engine.shopTab !== "mods") scroll.append(grid);
    box.append(scroll);
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
    const { c, ctx } = miniCanvas(px, px);
    const art = engine.art;
    if (!ctx || !art) return c;
    if (item.kind === "pal" && item.id) {
      paintPalPreview(ctx, art, item.id, px / 2, px / 2, px * 0.86);
    } else if (item.kind === "suit" && item.id) {
      drawSpriteOn(ctx, art.suits?.[item.id] ?? null, px / 2, px / 2, px * 0.92);
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

  function drawLog() {
    const box = el("div", "ac-sheet");
    box.append(header("Flight Log"));
    const sv = engine.save;
    const lv = pilotLevelOf(sv);
    box.append(el("p", "ac-sub", `LV ${lv} ${pilotTitleOf(sv)} · ${sv.xp} XP`));
    const scroll = el("div", "ac-sheet-scroll");
    const road = el("div", "ac-road");
    let nextMarked = false;
    for (const item of TRACK) {
      const pal = item.kind === "pal" ? PALS.find((p) => p.id === item.id) : null;
      const earned = lv >= item.lvl;
      let cls = "ac-roaditem" + (earned ? " on" : " future");
      const row = el("div", cls);
      row.append(rewardArt(item));
      const txt = el("div", "ac-roadtxt");
      txt.append(el("p", "ac-roadlvl", `LV ${item.lvl}`));
      txt.append(el("p", "", pal?.name ?? item.name ?? ""));
      txt.append(el("p", "ac-sub", pal?.desc ?? item.desc ?? ""));
      row.append(txt);
      if (earned) {
        row.append(el("span", "ac-check", "\u2713"));
      } else if (!nextMarked) {
        nextMarked = true;
        row.className = "ac-roaditem next";
        const toGo = Math.max(0, xpCumulative(item.lvl) - sv.xp);
        row.append(el("span", "ac-togo", `${toGo} XP TO GO`));
      }
      road.append(row);
    }
    scroll.append(road);
    box.append(scroll);
    // land the view on the next reward
    requestAnimationFrame(() => {
      const nxt = road.querySelector(".next");
      if (nxt) (nxt as HTMLElement).scrollIntoView({ block: "center" });
    });
    return box;
  }

  function drawSocial() {
    const s = engine.save;
    const box = el("div", "ac-sheet");
    box.append(header("Social"));
    box.append(el("h3", "", `LV ${pilotLevelOf(s)} ${pilotTitleOf(s)}`));
    box.append(el("p", "ac-sub", `BEST ${s.highScore} · DEEP ${s.deepBest} · LOST ${s.lostBest} · ARCADE ${s.arcadeBest}`));
    box.append(el("h4", "", "NEWS"));
    for (const line of NEWS) box.append(el("p", "ac-sub", line));
    box.append(el("p", "ac-fine", GAME_VERSION));
    return box;
  }

  function drawHelp() {
    const box = el("div", "ac-sheet");
    box.append(header("How to Play"));
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

    item(pic(spr("acorn")), "ACORN", "Currency \u2014 spend it in the hangar.");
    item(pic(spr("acorn")), "SLOW ACORN", "Slows everything for 6 seconds.");
    item(pic(spr("shield")), "SHIELD ACORN", "Absorbs one debris hit. Rare \u2014 grab it.");
    item(pic(spr("golden")), "GOLDEN ACORN", "Invulnerable to debris \u2014 planets still bounce.");
    item(pic((ctx, px) => {
      const g = ctx.createRadialGradient(px/2, px/2, 1, px/2, px/2, px/2);
      g.addColorStop(0, "#120424"); g.addColorStop(0.6, "#6a3fb8"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px/2, px/2, px*0.46, 0, Math.PI*2); ctx.fill();
    }), "BLACK HOLE", "Warps flight for 15s \u2014 reversed or tilted.");
    item(pic((ctx, px) => {
      const g = ctx.createRadialGradient(px/2, px/2, 1, px/2, px/2, px/2);
      g.addColorStop(0, "#042a24"); g.addColorStop(0.6, "#6ef0d8"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px/2, px/2, px*0.46, 0, Math.PI*2); ctx.fill();
    }), "WORMHOLE", "Lost in Space: mirrors your heading.");

    scroll.append(el("p", "ac-sub ac-mid", "DEEP SPACE: space shifts every 10s."));
    scroll.append(el("p", "ac-sub ac-mid", "ARCADE: catch the 8-bit acorn to shift between the illustrated game and the original. Same flight, other timeline — catch another to come back."));
    scroll.append(el("p", "ac-sub ac-mid", "LOST IN SPACE: drift, tilt, wormholes."));
    scroll.append(el("p", "ac-gold ac-mid", "BRING A PAL: each adds a fun modifier."));
    box.append(scroll);

    const replay = el("button", "ac-primary", "REPLAY TUTORIAL");
    replay.onclick = () => engine.replayTutorial();
    box.append(replay);
    return box;
  }

  engine.subscribe(render);
  render();
  window.addEventListener("resize", () => engine.resize());
}
