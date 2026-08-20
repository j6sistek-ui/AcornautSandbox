import { emptyArt, loadArt } from "./art.js?v=60";
import { sfx, unlockAudio, music } from "./audio.js?v=60";
import { GUIDE_HELM, GUIDE_SUIT, HELMETS, IAP_ITEMS, isIap, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, SUITS, TRAILS, TUT_ARM } from "./catalog.js?v=60";
import { drawHud, drawWorld } from "./draw.js?v=60";
import { batteryUnlocked, deepUnlocked, helmetRevealed, iapOwned, eraseSave, lostUnlocked, modsUnlocked, loadSave, palUnlocked, startShieldUnlocked, suitRevealed, writeSave, } from "./save.js?v=60";
import { levelById, levelUnlocked, totalStars } from "./campaign.js?v=60";
import { dive, flap, initStars, makeWorld, pausePlay, resizeWorld, resetRun, resumePlay, snapshot, updateWorld, } from "./sim.js?v=60";
export async function createEngine(canvas) {
    const raw = canvas.getContext("2d");
    if (!raw)
        throw new Error("no 2d");
    const ctx = raw;
    const save = loadSave();
    const world = makeWorld(360, 640);
    let art = null;
    let raf = 0;
    let last = performance.now();
    let running = false;
    const listeners = new Set();
    const notify = () => listeners.forEach((fn) => fn());
    let shopTab = "helmets";
    const engine = {
        canvas,
        world,
        save,
        art: null,
        shopTab,
        start() {
            if (running)
                return;
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
            // The mode bar refuses a locked chip, but the gate has to live here
            // too: a stale render, a harness, or a bookmark must not launch a
            // mode the save has not earned.
            if (mode === "deep" && !deepUnlocked(save))
                return;
            if (mode === "lost" && !lostUnlocked(save))
                return;
            unlockAudio();
            const needTut = !save.tutorialDone && mode === "fly";
            resetRun(world, save, mode, needTut);
            notify();
        },
        startOver() {
            eraseSave();
            window.location.reload();
        },
        redeemAccessCode(code) {
            if (code.trim() !== "120189")
                return "denied";
            save.purchased = save.purchased || [];
            for (const id of IAP_ITEMS)
                if (!save.purchased.includes(id))
                    save.purchased.push(id);
            writeSave(save);
            notify();
            return "ok";
        },
        flyLevel(id) {
            const def = levelById(id);
            if (!def)
                return false;
            if (!levelUnlocked(def, save.stars || {}, totalStars(save.stars || {})))
                return false;
            unlockAudio();
            // levels never run the tutorial: the chart itself is gated behind
            // having a save, and a first-timer meets the tutorial in endless
            resetRun(world, save, def.base, false, def);
            guideStep("level");
            notify();
            return true;
        },
        open(s) {
            world.screen = s;
            if (s === "title")
                world.tut = null;
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
            // collecting the graduation gift moves the coach to the hangar door
            if (save.guide === "reward")
                save.guide = "hangar";
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
    // The guided path advances only on the act it asked for: equip the gift
    // suit, then the gift helmet, then fly Mission 1. If the helmet is
    // somehow already on when the suit lands, the middle step is skipped
    // rather than demanding a re-equip.
    function guideStep(ev) {
        if (ev === "suit" && save.guide === "hangar" && save.equippedSuit === GUIDE_SUIT) {
            save.guide = save.equipped === GUIDE_HELM ? "levels" : "helmet";
        }
        else if (ev === "helm" && save.guide === "helmet" && save.equipped === GUIDE_HELM) {
            save.guide = "levels";
        }
        else if (ev === "level" && save.guide === "levels") {
            save.guide = "done";
        }
        else
            return;
        writeSave(save);
    }
    function transactHelmet(id) {
        const item = HELMETS.find((h) => h.id === id);
        if (!item)
            return "missing";
        // a matched-set helmet only goes on its own suit
        if (item.suitOnly && save.equippedSuit !== item.suitOnly)
            return "suitOnly";
        if (!helmetRevealed(save, id))
            return "locked";
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
        if (save.acorns < item.cost)
            return "poor";
        save.acorns -= item.cost;
        save.unlocked.push(id);
        save.equipped = id;
        guideStep("helm");
        writeSave(save);
        notify();
        return "buy";
    }
    function transactSuit(id) {
        const item = SUITS.find((h) => h.id === id);
        if (!item)
            return "missing";
        if (!suitRevealed(save, id))
            return "locked";
        if (save.unlockedSuits.includes(id) || (isIap(id) && iapOwned(save, id))) {
            save.equippedSuit = id;
            dropOrphanedHelmet();
            guideStep("suit");
            writeSave(save);
            notify();
            return "equip";
        }
        if (save.acorns < item.cost)
            return "poor";
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
        if (h?.suitOnly && h.suitOnly !== save.equippedSuit)
            save.equipped = "clear";
    }
    function transactTrail(id) {
        const item = TRAILS.find((h) => h.id === id);
        if (!item)
            return "missing";
        if (isIap(id)) {
            if (!iapOwned(save, id))
                return "locked";
            save.equippedTrail = id;
            if (!save.unlockedTrails.includes(id))
                save.unlockedTrails.push(id);
            writeSave(save);
            notify();
            return "equip";
        }
        if (save.unlockedTrails.includes(id)) {
            save.equippedTrail = id;
            writeSave(save);
            notify();
            return "equip";
        }
        if (save.acorns < item.cost)
            return "poor";
        save.acorns -= item.cost;
        save.unlockedTrails.push(id);
        save.equippedTrail = id;
        writeSave(save);
        notify();
        return "buy";
    }
    function transactPal(id) {
        if (!palUnlocked(save, id))
            return "locked";
        if (!save.unlockedPals.includes(id))
            save.unlockedPals.push(id);
        save.equippedPal = id;
        writeSave(save);
        notify();
        return "equip";
    }
    function toggleMod(which) {
        if (which === "shield") {
            if (!startShieldUnlocked(save))
                return "locked";
            if (save.startShield) {
                save.startShield = false;
                writeSave(save);
                notify();
                return "off";
            }
            if (save.acorns < MOD_SHIELD_COST)
                return "poor";
            save.acorns -= MOD_SHIELD_COST;
            save.startShield = true;
            writeSave(save);
            notify();
            return "on";
        }
        if (!batteryUnlocked(save))
            return "locked";
        if (save.battery)
            return "owned";
        if (save.acorns < MOD_BATTERY_COST)
            return "poor";
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
    function setMod(id) {
        const mod = MODS.find((m) => m.id === id);
        if (!mod)
            return "unknown";
        if (!modsUnlocked(save))
            return "locked";
        if (save[mod.save]) {
            save[mod.save] = false;
            writeSave(save);
            notify();
            return "off";
        }
        const owned = save.purchased.includes(mod.id);
        if (!owned) {
            if (save.acorns < mod.cost)
                return "poor";
            save.acorns -= mod.cost;
            save.purchased.push(mod.id);
        }
        save[mod.save] = true;
        if (mod.opposes)
            save[mod.opposes] = false;
        writeSave(save);
        notify();
        return owned ? "on" : "buy";
    }
    function resize() {
        const parent = canvas.parentElement;
        if (!parent)
            return;
        const rect = parent.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const W = Math.min(rect.width, 480);
        const H = rect.height;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        resizeWorld(world, W, H);
        if (!world.stars.length)
            initStars(world);
    }
    let swipe = null;
    function pos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (world.W / rect.width),
            y: (e.clientY - rect.top) * (world.H / rect.height),
        };
    }
    canvas.addEventListener("pointerdown", (e) => {
        if (world.screen !== "play")
            return;
        e.preventDefault();
        const p = pos(e);
        swipe = { y0: p.y, t0: performance.now(), fired: false };
        const ev = flap(world, save);
        if (ev === "flap")
            sfx.flap();
        if (world.tut?.stage === "pal" && world.tut.hold && world.tut.t >= TUT_ARM) {
            world.tut.hold = false;
            world.tut.t = 0;
        }
        notify();
    }, { passive: false });
    canvas.addEventListener("pointermove", (e) => {
        if (!swipe || swipe.fired || world.screen !== "play" || world.flight === "tunnel")
            return;
        const p = pos(e);
        if (performance.now() - swipe.t0 > 320) {
            swipe = null;
            return;
        }
        if (p.y - swipe.y0 >= 34) {
            swipe.fired = true;
            const ev = dive(world);
            if (ev === "dive")
                sfx.dive();
            notify();
        }
    }, { passive: true });
    const end = () => {
        swipe = null;
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    window.addEventListener("keydown", (e) => {
        if (e.code === "Escape") {
            if (world.screen === "play")
                engine.pause();
            else if (world.screen === "pause")
                engine.resume();
            else if (world.screen !== "dead")
                engine.open("title");
            return;
        }
        if (e.code === "Space" || e.code === "ArrowUp") {
            e.preventDefault();
            if (world.screen === "splash")
                engine.open("title");
            else if (world.screen === "title")
                engine.fly("fly");
            else if (world.screen === "pause")
                engine.resume();
            else if (world.screen === "play") {
                const ev = flap(world, save);
                if (ev === "flap")
                    sfx.flap();
            }
            else if (world.screen === "dead" && world.deadTimer > 0.55)
                engine.dismissDead();
            notify();
        }
        if (e.code === "ArrowDown" && world.screen === "play" && world.flight !== "tunnel") {
            const ev = dive(world);
            if (ev === "dive")
                sfx.dive();
            notify();
        }
    });
    function loop(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        const ev = updateWorld(world, save, dt);
        if (ev === "acorn")
            sfx.acorn();
        if (ev === "gold")
            sfx.gold();
        if (ev === "freeze")
            sfx.freeze();
        if (ev === "section")
            sfx.section();
        if (ev === "region")
            sfx.region();
        if (ev === "warning")
            sfx.warning();
        if (ev === "near")
            sfx.near();
        if (ev === "milestone")
            sfx.milestone();
        if (ev === "bounce")
            sfx.bounce();
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
                if (world.screen !== "pause")
                    drawHud(ctx, world);
            }
            else if (art.sky) {
                ctx.drawImage(art.sky, 0, 0, world.W, world.H);
                ctx.fillStyle = "rgba(7,11,22,0.35)";
                ctx.fillRect(0, 0, world.W, world.H);
            }
            else {
                ctx.fillStyle = "#070b16";
                ctx.fillRect(0, 0, world.W, world.H);
            }
        }
        else {
            ctx.fillStyle = "#070b16";
            ctx.fillRect(0, 0, world.W, world.H);
        }
        if (running)
            raf = requestAnimationFrame(loop);
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
        .catch(() => { });
    notify();
    return engine;
}
export { deepUnlocked, lostUnlocked } from "./save.js?v=60";
