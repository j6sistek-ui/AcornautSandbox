import { emptyArt, loadArt, type ArtBank } from "./art";
import { sfx, unlockAudio, music } from "./audio";
import { GUIDE_HELM, GUIDE_SUIT, HELMETS, IAP_ITEMS, IS_BETA, isIap, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, SUITS, TRAILS, TUT_ARM } from "./catalog";
import { drawHud, drawWorld } from "./draw";
import {
  batteryUnlocked,
  deepUnlocked,
  helmetRevealed,
  iapOwned,
  trailUnlocked,
  eraseSave,
  lostUnlocked,
  modsUnlocked,
  loadSave,
  palUnlocked,
  startShieldUnlocked,
  starsOf,
  suitRevealed,
  writeSave,
  type SaveData,
} from "./save";
import { emptyStats, experimentalRaceById, levelById, levelUnlocked, type LevelDef } from "./campaign";
import {
  dive,
  flap,
  initStars,
  makeWorld,
  settleLevel,
  pausePlay,
  planRaceCueEffects,
  resizeWorld,
  resetRun,
  resumePlay,
  setRaceInput,
  setTunnelHeld,
  snapshot,
  takeRaceCueEffects,
  updateWorld,
  type FlightMode,
  type Screen,
  type Snapshot,
  type World,
} from "./sim";
import {
  canonicalRaceY,
  cancelRaceGesture,
  createRaceGestureState,
  dropRaceGesture,
  moveRaceGesture,
  neutralizeOwnedRaceGesture,
  pressRaceGesture,
  releaseRaceGesture,
  type RaceGestureOwner,
  type RaceGestureResult,
} from "./race-gesture";
import { raceViewport } from "./race-viewport";

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
  /** wipe this build's save slot and reboot into a fresh game */
  startOver: () => void;
  /** the Founder's Pack door — and one more code that is a love letter */
  redeemAccessCode: (code: string) => "ok" | "love" | "denied";
  /** start a Star Chart level; returns false if it is still locked */
  flyLevel: (id: string) => boolean;
  open: (s: Screen) => void;
  buyHelmet: (id: string) => string;
  buySuit: (id: string) => string;
  buyTrail: (id: string) => string;
  equipPal: (id: string) => string;
  toggleMod: (which: "shield" | "battery") => string;
  /** buy a flight mod if unowned, otherwise switch it on or off */
  setMod: (id: string) => string;
  /** the Profile's music switch: silences both score tracks, persisted */
  setMusicOff: (off: boolean) => void;
  /** VOLT's hangar experiment: swap between its two painted jump banks */
  setVoltAltJump: (on: boolean) => void;
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
  // the saved music preference applies before the first frame ever asks
  // for a track, so a switched-off score never blips on at boot
  music.setMuted(!!save.musicOff);
  const world = makeWorld(360, 640);
  let art: ArtBank | null = null;
  let raf = 0;
  let last = performance.now();
  let running = false;
  let raceAccumulator = 0;
  let raceGesture = createRaceGestureState();
  let raceResizeKeyboardReleasePending = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  // A finished Spill mission left its result in the hallway on the way
  // back. Bank it before the first render: stars land, and the pilot
  // walks straight into the result sheet instead of the title.
  try {
    const raw = localStorage.getItem("acornaut_spill_result");
    if (raw) {
      localStorage.removeItem("acornaut_spill_result");
      const r = JSON.parse(raw) as { id?: unknown; finished?: unknown; score?: unknown };
      const def = levelById(String(r.id));
      if (def && def.base === "spill") {
        world.lvl = {
          def,
          stats: { ...emptyStats(), score: Math.max(0, Math.floor(Number(r.score) || 0)) },
          portal: false, strobeT: 0, goldGates: [], spawnOrd: 0,
        };
        settleLevel(world, save, r.finished === true);
      }
    }
  } catch { /* a malformed record is dropped, never fatal */ }
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
      cancelRaceControls();
      setTunnelHeld(world, false);
      swipe = null;
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    fly(mode) {
      // The mode bar refuses a locked chip, but the gate has to live here
      // too: a stale render, a harness, or a bookmark must not launch a
      // mode the save has not earned.
      if (mode === "deep" && !deepUnlocked(save)) return;
      if (mode === "lost" && !lostUnlocked(save)) return;
      unlockAudio();
      const needTut = !save.tutorialDone && mode === "fly";
      resetRun(world, save, mode, needTut);
      resetInputTracking();
      notify();
    },
    startOver() {
      eraseSave();
      window.location.reload();
    },
    redeemAccessCode(code) {
      const entered = code.trim();
      if (entered === "120189") {
        save.purchased = save.purchased || [];
        for (const id of IAP_ITEMS) if (!save.purchased.includes(id)) save.purchased.push(id);
        writeSave(save);
        notify();
        return "ok";
      }
      // Briella's code. The game believes it has every star, all the
      // gates open, and Dad gets to watch her fly whatever she wants.
      if (entered === "033018") {
        save.allStars = true;
        writeSave(save);
        notify();
        return "love";
      }
      return "denied";
    },
    flyLevel(id) {
      const def = levelById(id) ?? (IS_BETA ? experimentalRaceById(id) : null);
      if (!def) return false;
      // starsOf, not the raw tally: Briella's code opens chapters here too
      if (!def.experimental && !levelUnlocked(def, save.stars || {}, starsOf(save))) return false;
      unlockAudio();
      // A SPILL mission lives on the lab page: hand it the mission card
      // and go. It writes one result record at the end, and the boot code
      // banks the stars the moment the pilot is back.
      if (def.base === "spill") {
        const s2 = def.goals[1].kind === "score" ? def.goals[1].n : 0;
        const s3 = def.goals[2].kind === "score" ? def.goals[2].n : 0;
        guideStep("level");
        window.location.href =
          `../lab/spill/?mission=${def.id}&target=${def.gates}&s2=${s2}&s3=${s3}`;
        return true;
      }
      // levels never run the tutorial: the chart itself is gated behind
      // having a save, and a first-timer meets the tutorial in endless.
      // A Wormhole mission flies a FIXED corridor: the seed is the level's
      // ordinal, so mission 3-4 is the same test for every pilot, forever.
      resetRun(world, save, def.base === "race" ? "fly" : def.base, false, def,
        def.base === "tunnel" ? 7000 + def.ord : undefined);
      resetInputTracking();
      raceAccumulator = 0;
      guideStep("level");
      notify();
      return true;
    },
    open(s) {
      if (s !== "play") {
        cancelRaceControls();
        setTunnelHeld(world, false);
        swipe = null;
      }
      world.screen = s;
      if (s === "title") world.tut = null;
      if (s === "title" || s === "log") {
        world.race = null;
        raceAccumulator = 0;
      }
      notify();
    },
    buyHelmet: (id) => transactHelmet(id),
    buySuit: (id) => transactSuit(id),
    buyTrail: (id) => transactTrail(id),
    equipPal: (id) => transactPal(id),
    toggleMod,
    setMod,
    setMusicOff(off) {
      save.musicOff = off;
      writeSave(save);
      music.setMuted(off);
      notify();
    },
    setVoltAltJump(on) {
      save.voltAltJump = on;
      writeSave(save);
      notify();
    },
    dismissDead() {
      world.screen = "title";
      world.lastRun = null;
      // collecting the graduation gift moves the coach to the hangar door
      if (save.guide === "reward") save.guide = "hangar";
      writeSave(save);
      notify();
    },
    replayTutorial() {
      save.tutorialDone = false;
      writeSave(save);
      resetRun(world, save, "fly", true);
      resetInputTracking();
      notify();
    },
    pause() {
      cancelRaceControls();
      setTunnelHeld(world, false);
      swipe = null;
      // A race pause discards the incomplete presentation-frame remainder.
      // Resume starts from the next whole 60 Hz authority step, so focus loss
      // can never leak hidden-tab wall time into the time trial.
      if (world.race) raceAccumulator = 0;
      pausePlay(world);
      notify();
    },
    resume() {
      resumePlay(world);
      raceAccumulator = 0;
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

  // The guided path advances only on the act it asked for: equip the gift
  // suit, then the gift helmet, then fly Mission 1. If the helmet is
  // somehow already on when the suit lands, the middle step is skipped
  // rather than demanding a re-equip.
  function guideStep(ev: "suit" | "helm" | "level") {
    if (ev === "suit" && save.guide === "hangar" && save.equippedSuit === GUIDE_SUIT) {
      save.guide = save.equipped === GUIDE_HELM ? "levels" : "helmet";
    } else if (ev === "helm" && save.guide === "helmet" && save.equipped === GUIDE_HELM) {
      save.guide = "levels";
    } else if (ev === "level" && save.guide === "levels") {
      save.guide = "done";
    } else return;
    writeSave(save);
  }

  function transactHelmet(id: string) {
    const item = HELMETS.find((h) => h.id === id);
    if (!item) return "missing";
    // a matched-set helmet only goes on its own suit
    if (item.suitOnly && save.equippedSuit !== item.suitOnly) return "suitOnly";
    if (!helmetRevealed(save, id)) return "locked";
    // A premium item that is OWNED equips — it never re-enters the buy
    // path, whatever its cost field says. The Cat carried a stale acorn
    // price from before it went premium, and "owned" met "poor".
    if (save.unlocked.includes(id) || (isIap(id) && iapOwned(save, id))) {
      save.equipped = id;
      guideStep("helm");
      writeSave(save);
      notify();
      return "equip";
    }
    if (save.acorns < item.cost) return "poor";
    save.acorns -= item.cost;
    save.unlocked.push(id);
    save.equipped = id;
    guideStep("helm");
    writeSave(save);
    notify();
    return "buy";
  }

  function transactSuit(id: string) {
    const item = SUITS.find((h) => h.id === id);
    if (!item) return "missing";
    if (!suitRevealed(save, id)) return "locked";
    if (save.unlockedSuits.includes(id) || (isIap(id) && iapOwned(save, id))) {
      save.equippedSuit = id;
      dropOrphanedHelmet();
      guideStep("suit");
      writeSave(save);
      notify();
      return "equip";
    }
    if (save.acorns < item.cost) return "poor";
    save.acorns -= item.cost;
    save.unlockedSuits.push(id);
    save.equippedSuit = id;
    dropOrphanedHelmet();
    guideStep("suit");
    writeSave(save);
    notify();
    return "buy";
  }

  // stepping out of a suit takes its matched helmet off with it
  function dropOrphanedHelmet() {
    const h = HELMETS.find((x) => x.id === save.equipped);
    if (h?.suitOnly && h.suitOnly !== save.equippedSuit) save.equipped = "clear";
  }

  function transactTrail(id: string) {
    const item = TRAILS.find((h) => h.id === id);
    if (!item) return "missing";
    // Trails are never bought with acorns any more — a rung on the Star
    // Chart's ladder opens each one, premium ones come with the pack, and
    // an open trail simply equips.
    if (!trailUnlocked(save, id)) return "locked";
    save.equippedTrail = id;
    if (!save.unlockedTrails.includes(id)) save.unlockedTrails.push(id);
    writeSave(save);
    notify();
    return "equip";
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
    const dpr = Math.min(window.devicePixelRatio || 1, world.race ? 2 : 2.5);
    // widescreen everywhere: the play area may take the whole window,
    // capped only at desktop-panorama width
    const W = Math.min(rect.width, 1600);
    const H = rect.height;
    const sizeChanged = W > 0 && H > 0 && (W !== world.W || H !== world.H);
    const ownedRaceResize = sizeChanged && world.race !== null && world.screen === "play"
      && raceGesture.owner !== null;
    if (ownedRaceResize) {
      const owner = raceGesture.owner;
      // Neutralize before pausing so the semantic state is stamped at the
      // current authority tick. The dedicated recognizer path always clears
      // the double-tap/swipe candidate; a duplicate resize sees no owner and
      // therefore cannot append another transition.
      applyRaceGesture(neutralizeOwnedRaceGesture(raceGesture));
      if (owner === "keyboard-rise") raceResizeKeyboardReleasePending = true;
      raceAccumulator = 0;
      swipe = null;
      pausePlay(world);
      if (typeof owner === "number") {
        try { canvas.releasePointerCapture(owner); } catch { /* capture is best-effort */ }
      }
    }
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resizeWorld(world, W, H);
    if (!world.stars.length) initStars(world);
    if (ownedRaceResize) notify();
  }

  let swipe: { y0: number; t0: number; fired: boolean } | null = null;

  function applyRaceGesture(result: RaceGestureResult) {
    raceGesture = result.state;
    if (!result.input) return false;
    const wasReady = world.ready;
    const accepted = setRaceInput(world, result.input);
    if (accepted && wasReady && !world.ready) raceAccumulator = 0;
    return accepted;
  }

  function resetInputTracking() {
    raceGesture = createRaceGestureState();
    raceResizeKeyboardReleasePending = false;
    swipe = null;
  }

  function cancelRaceControls(owner?: RaceGestureOwner) {
    return applyRaceGesture(cancelRaceGesture(raceGesture, owner));
  }

  function pos(e: PointerEvent | Touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (world.W / rect.width),
      y: (e.clientY - rect.top) * (world.H / rect.height),
    };
  }

  function raceInputY(viewY: number) {
    const viewport = raceViewport(world.W, world.H);
    return canonicalRaceY(viewY, viewport.top, viewport.contentHeight);
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (world.screen !== "play") return;
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      const p = pos(e);
      if (world.race) {
        try { canvas.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
        applyRaceGesture(pressRaceGesture(
          raceGesture,
          e.pointerId,
          world.race.tick,
          raceInputY(p.y),
        ));
        notify();
        return;
      }
      swipe = { y0: p.y, t0: performance.now(), fired: false };
      const ev = setTunnelHeld(world, true) ? "flap" : flap(world, save);
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
      if (world.race && world.screen === "play") {
        const p = pos(e);
        const result = moveRaceGesture(
          raceGesture,
          e.pointerId,
          world.race.tick,
          raceInputY(p.y),
        );
        const isDrop = result.input?.drop === true;
        const accepted = applyRaceGesture(result);
        if (isDrop && accepted) {
          sfx.dive();
          notify();
        }
        return;
      }
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
  const end = (e: PointerEvent) => {
    if (raceGesture.owner === e.pointerId) {
      if (e.type === "pointercancel") cancelRaceControls(e.pointerId);
      else applyRaceGesture(releaseRaceGesture(raceGesture, e.pointerId));
      return;
    }
    if (world.race) return;
    setTunnelHeld(world, false);
    swipe = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  // A held thrust is a long-press to the browser: without these, phones
  // answer it with text selection and the copy bubble over the whole HUD.
  canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea")) return;
    e.preventDefault();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (world.screen === "play") engine.pause();
      else if (world.screen === "pause") engine.resume();
      else if (world.screen !== "dead") engine.open("title");
      return;
    }
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      // A key held through an orientation change keeps generating repeat
      // keydowns. It may not auto-resume the paused race or become a new
      // press until the physical key has first been released.
      if (raceResizeKeyboardReleasePending) return;
      if (world.screen === "splash") engine.open("title");
      else if (world.screen === "title") engine.fly("fly");
      else if (world.screen === "pause") engine.resume();
      else if (world.screen === "play") {
        if (world.race) {
          if (!e.repeat) applyRaceGesture(pressRaceGesture(
            raceGesture,
            "keyboard-rise",
            world.race.tick,
            null,
          ));
        } else {
          const ev = setTunnelHeld(world, true) ? "flap" : flap(world, save);
          if (ev === "flap") sfx.flap();
        }
      } else if (world.screen === "dead" && world.deadTimer > 0.55) engine.dismissDead();
      notify();
    }
    if (e.code === "ArrowDown" && world.screen === "play" && world.race) {
      e.preventDefault();
      if (e.repeat) return;
      if (applyRaceGesture(dropRaceGesture(raceGesture))) sfx.dive();
      notify();
    } else if (e.code === "ArrowDown" && world.screen === "play" && world.flight !== "tunnel") {
      const ev = dive(world);
      if (ev === "dive") sfx.dive();
      notify();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      if (raceResizeKeyboardReleasePending) {
        raceResizeKeyboardReleasePending = false;
        return;
      }
      if (raceGesture.owner === "keyboard-rise") {
        applyRaceGesture(releaseRaceGesture(raceGesture, "keyboard-rise"));
      } else if (!world.race) setTunnelHeld(world, false);
    }
  });
  window.addEventListener("blur", () => {
    if (world.race && world.screen === "play") {
      engine.pause();
      return;
    }
    cancelRaceControls();
    setTunnelHeld(world, false);
    swipe = null;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (world.race && world.screen === "play") {
        engine.pause();
        return;
      }
      cancelRaceControls();
      setTunnelHeld(world, false);
      swipe = null;
    }
  });
  function dispatchWorldEvent(ev: string | null) {
    if (ev === "acorn") sfx.acorn();
    if (ev === "gold" || ev === "ring") sfx.gold();
    if (ev === "freeze") sfx.freeze();
    if (ev === "section") sfx.section();
    if (ev === "region") sfx.region();
    if (ev === "warning") sfx.warning();
    if (ev === "near") sfx.near();
    if (ev === "milestone") sfx.milestone();
    if (ev === "bounce") sfx.bounce();
    if (ev === "debris") sfx.bounce();
    if (ev === "die") {
      writeSave(save);
      sfx.die();
      notify();
    }
    if (ev === "shield") {
      sfx.shield();
      notify();
    }
    if (ev === "shift" || ev === "entry" || ev === "return") {
      sfx.shift();
      notify();
    }
  }
  function dispatchRaceCues(cues: Parameters<typeof planRaceCueEffects>[0]) {
    let shouldNotify = false;
    for (const effect of planRaceCueEffects(cues)) {
      if (effect.sfx === "gold") sfx.gold();
      if (effect.sfx === "bounce") sfx.bounce();
      if (effect.sfx === "acorn") sfx.acorn();
      if (effect.sfx === "shift") sfx.shift();
      if (effect.notify) shouldNotify = true;
    }
    if (shouldNotify) notify();
  }
  function loop(now: number) {
    const frameDt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (world.race) {
      raceAccumulator += frameDt;
      while (raceAccumulator + 1e-12 >= 1 / 60) {
        // Race cues are drained after every authority step, not once per
        // render frame. This preserves simultaneous pass/debris feedback and
        // prevents high-refresh rendering from replaying audio side effects.
        updateWorld(world, save, 1 / 60);
        dispatchRaceCues(takeRaceCueEffects(world));
        raceAccumulator -= 1 / 60;
        if (world.screen === "lvldone") break;
      }
    } else {
      raceAccumulator = 0;
      dispatchWorldEvent(updateWorld(world, save, Math.min(0.033, frameDt)));
    }
    // Four scores, one at a time: the chiptune rides the retro renderer
    // (arcade + shifted stretches, exactly as always); the Hyper Run time
    // trial keeps the voyage loop; every other live run gets the upbeat
    // flight instrumental; and everything outside a run — menus, results,
    // the hangar — settles onto the slow menu score.
    const inRun = world.screen === "play" || world.screen === "pause";
    music.set(
      world.retro && inRun ? "cosmos"
        : world.race && inRun ? "voyage"
          : inRun ? "flight"
            : "menu");
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
