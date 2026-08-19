import { emptyArt, loadArt, type ArtBank } from "./art";
import { sfx, unlockAudio, music } from "./audio";
import { HELMETS, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, SUITS, TRAILS, TUT_ARM } from "./catalog";
import { drawHud, drawWorld } from "./draw";
import {
  batteryUnlocked,
  modsUnlocked,
  loadSave,
  palUnlocked,
  startShieldUnlocked,
  suitRevealed,
  writeSave,
  type SaveData,
} from "./save";
import {
  dive,
  flap,
  initStars,
  makeWorld,
  pausePlay,
  resetRun,
  resumePlay,
  snapshot,
  updateWorld,
  type FlightMode,
  type Screen,
  type Snapshot,
  type World,
} from "./sim";

export type ShopTab = "helmets" | "suits" | "trails" | "pals" | "mods";

export type Engine = {
  canvas: HTMLCanvasElement;
  world: World;
  save: SaveData;
  art: ArtBank | null;
  shopTab: ShopTab;
  start: () => void;
  stop: () => void;
  resize: () => void;
  fly: (mode: FlightMode) => void;
  open: (s: Screen) => void;
  buyHelmet: (id: string) => string;
  buySuit: (id: string) => string;
  buyTrail: (id: string) => string;
  equipPal: (id: string) => string;
  toggleMod: (which: "shield" | "battery") => string;
  /** buy a flight mod if unowned, otherwise switch it on or off */
  setMod: (id: string) => string;
  dismissDead: () => void;
  replayTutorial: () => void;
  pause: () => void;
  resume: () => void;
  setShopTab: (t: ShopTab) => void;
  /** settles once the art bank has loaded (or failed to) */
  artReady?: Promise<void>;
  subscribe: (fn: () => void) => () => void;
  snap: () => Snapshot;
};

export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  const raw = canvas.getContext("2d");
  if (!raw) throw new Error("no 2d");
  const ctx = raw;
  const save = loadSave();
  const world = makeWorld(360, 640);
  let art: ArtBank | null = null;
  let raf = 0;
  let last = performance.now();
  let running = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());
  let shopTab: ShopTab = "helmets";

  const engine: Engine = {
    canvas,
    world,
    save,
    art: null,
    shopTab,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    fly(mode) {
      unlockAudio();
      const needTut = !save.tutorialDone && mode === "fly";
      resetRun(world, save, mode, needTut);
      notify();
    },
    open(s) {
      world.screen = s;
      if (s === "title") world.tut = null;
      notify();
    },
    buyHelmet: (id) => transactHelmet(id),
    buySuit: (id) => transactSuit(id),
    buyTrail: (id) => transactTrail(id),
    equipPal: (id) => transactPal(id),
    toggleMod,
    setMod,
    dismissDead() {
      world.screen = "title";
      world.lastRun = null;
      writeSave(save);
      notify();
    },
    replayTutorial() {
      save.tutorialDone = false;
      writeSave(save);
      resetRun(world, save, "fly", true);
      notify();
    },
    pause() {
      pausePlay(world);
      notify();
    },
    resume() {
      resumePlay(world);
      last = performance.now();
      notify();
    },
    setShopTab(t) {
      shopTab = t;
      engine.shopTab = t;
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snap: () => snapshot(world),
  };

  function transactHelmet(id: string) {
    const item = HELMETS.find((h) => h.id === id);
    if (!item) return "missing";
    if (save.unlocked.includes(id)) {
      save.equipped = id;
      writeSave(save);
      notify();
      return "equip";
    }
    if (save.acorns < item.cost) return "poor";
    save.acorns -= item.cost;
    save.unlocked.push(id);
    save.equipped = id;
    writeSave(save);
    notify();
    return "buy";
  }

  function transactSuit(id: string) {
    const item = SUITS.find((h) => h.id === id);
    if (!item) return "missing";
    if (!suitRevealed(save, id)) return "locked";
    if (save.unlockedSuits.includes(id)) {
      save.equippedSuit = id;
      writeSave(save);
      notify();
      return "equip";
    }
    if (save.acorns < item.cost) return "poor";
    save.acorns -= item.cost;
    save.unlockedSuits.push(id);
    save.equippedSuit = id;
    writeSave(save);
    notify();
    return "buy";
  }

  function transactTrail(id: string) {
    const item = TRAILS.find((h) => h.id === id);
    if (!item) return "missing";
    if (save.unlockedTrails.includes(id)) {
      save.equippedTrail = id;
      writeSave(save);
      notify();
      return "equip";
    }
    if (save.acorns < item.cost) return "poor";
    save.acorns -= item.cost;
    save.unlockedTrails.push(id);
    save.equippedTrail = id;
    writeSave(save);
    notify();
    return "buy";
  }

  function transactPal(id: string) {
    if (!palUnlocked(save, id)) return "locked";
    if (!save.unlockedPals.includes(id)) save.unlockedPals.push(id);
    save.equippedPal = id;
    writeSave(save);
    notify();
    return "equip";
  }

  function toggleMod(which: "shield" | "battery") {
    if (which === "shield") {
      if (!startShieldUnlocked(save)) return "locked";
      if (save.startShield) {
        save.startShield = false;
        writeSave(save);
        notify();
        return "off";
      }
      if (save.acorns < MOD_SHIELD_COST) return "poor";
      save.acorns -= MOD_SHIELD_COST;
      save.startShield = true;
      writeSave(save);
      notify();
      return "on";
    }
    if (!batteryUnlocked(save)) return "locked";
    if (save.battery) return "owned";
    if (save.acorns < MOD_BATTERY_COST) return "poor";
    save.acorns -= MOD_BATTERY_COST;
    save.battery = true;
    writeSave(save);
    notify();
    return "buy";
  }

  // A flight mod is bought once and then switched, so one call covers both:
  // if you do not own it this is a purchase, and if you do it is a toggle.
  // Turning one on turns its opposite off — Steady Gates and Rough Air
  // cannot both describe the same run.
  function setMod(id: string) {
    const mod = MODS.find((m) => m.id === id);
    if (!mod) return "unknown";
    if (!modsUnlocked(save)) return "locked";
    if (save[mod.save]) {
      save[mod.save] = false;
      writeSave(save);
      notify();
      return "off";
    }
    const owned = save.purchased.includes(mod.id);
    if (!owned) {
      if (save.acorns < mod.cost) return "poor";
      save.acorns -= mod.cost;
      save.purchased.push(mod.id);
    }
    save[mod.save] = true;
    if (mod.opposes) save[mod.opposes] = false;
    writeSave(save);
    notify();
    return owned ? "on" : "buy";
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = Math.min(rect.width, 480);
    const H = rect.height;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    world.W = W;
    world.H = H;
    if (!world.stars.length) initStars(world);
  }

  let swipe: { y0: number; t0: number; fired: boolean } | null = null;

  function pos(e: PointerEvent | Touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (world.W / rect.width),
      y: (e.clientY - rect.top) * (world.H / rect.height),
    };
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (world.screen !== "play") return;
      e.preventDefault();
      const p = pos(e);
      swipe = { y0: p.y, t0: performance.now(), fired: false };
      const ev = flap(world, save);
      if (ev === "flap") sfx.flap();
      if (world.tut?.stage === "pal" && world.tut.hold && world.tut.t >= TUT_ARM) {
        world.tut.hold = false;
        world.tut.t = 0;
      }
      notify();
    },
    { passive: false },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!swipe || swipe.fired || world.screen !== "play" || world.flight === "tunnel") return;
      const p = pos(e);
      if (performance.now() - swipe.t0 > 320) {
        swipe = null;
        return;
      }
      if (p.y - swipe.y0 >= 34) {
        swipe.fired = true;
        const ev = dive(world);
        if (ev === "dive") sfx.dive();
        notify();
      }
    },
    { passive: true },
  );
  const end = () => {
    swipe = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (world.screen === "play") engine.pause();
      else if (world.screen === "pause") engine.resume();
      else if (world.screen !== "dead") engine.open("title");
      return;
    }
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (world.screen === "splash") engine.open("title");
      else if (world.screen === "title") engine.fly("fly");
      else if (world.screen === "pause") engine.resume();
      else if (world.screen === "play") {
        const ev = flap(world, save);
        if (ev === "flap") sfx.flap();
      } else if (world.screen === "dead" && world.deadTimer > 0.55) engine.dismissDead();
      notify();
    }
    if (e.code === "ArrowDown" && world.screen === "play" && world.flight !== "tunnel") {
      const ev = dive(world);
      if (ev === "dive") sfx.dive();
      notify();
    }
  });
  function loop(now: number) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const ev = updateWorld(world, save, dt);
    if (ev === "acorn") sfx.acorn();
    if (ev === "gold") sfx.gold();
    if (ev === "bounce") sfx.bounce();
    if (ev === "die") {
      writeSave(save);
      sfx.die();
      notify();
    }
    if (ev === "shield") {
      sfx.shield();
      notify();
    }
    if (ev === "shift") {
      sfx.shift();
      notify();
    }
    // The retro soundtrack rides the retro renderer: on for the whole
    // arcade run and for the shifted stretches of Free Flight, off the
    // instant you are back in the illustrated game or out of a live run.
    const inRun = world.screen === "play" || world.screen === "pause";
    music.set(world.retro && inRun);
    ctx.clearRect(0, 0, world.W, world.H);
    if (art) {
      if (world.screen === "play" || world.screen === "dead" || world.screen === "pause") {
        drawWorld(ctx, world, save, art);
        if (world.screen !== "pause") drawHud(ctx, world);
      } else if (art.sky) {
        ctx.drawImage(art.sky, 0, 0, world.W, world.H);
        ctx.fillStyle = "rgba(7,11,22,0.35)";
        ctx.fillRect(0, 0, world.W, world.H);
      } else {
        ctx.fillStyle = "#070b16";
        ctx.fillRect(0, 0, world.W, world.H);
      }
    } else {
      ctx.fillStyle = "#070b16";
      ctx.fillRect(0, 0, world.W, world.H);
    }
    if (running) raf = requestAnimationFrame(loop);
  }

  resize();
  initStars(world);
  // paint from frame one with an empty bank, then swap the real art in as
  // it arrives — and if the whole load fails, the game still runs
  art = emptyArt();
  engine.art = art;
  // The art bank arrives after the engine does, so the loading screen
  // needs its own signal. This resolves either way — a failed load must
  // never leave the app stuck behind a progress bar.
  engine.artReady = loadArt()
    .then((bank) => {
      art = bank;
      engine.art = bank;
      notify();
    })
    .catch(() => {});
  notify();
  return engine;
}

export { deepUnlocked, lostUnlocked } from "./save";
