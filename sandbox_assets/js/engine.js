import { emptyArt, loadArt, loadSuitBank, prefetchSuitBanks } from "./art.js?v=130";
import { sfx, unlockAudio, music } from "./audio.js?v=130";
import { GUIDE_HELM, GUIDE_SUIT, HELMETS, IAP_ITEMS, HYPER_RUN_ENABLED, isIap, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, SUITS, TRAILS, TUT_ARM, BUNDLES, DUST_PACKS, DAILY_DUST, DAILY_STREAK_BONUS, DAILY_STREAK_LEN } from "./catalog.js?v=130";
import { drawHud, drawWorld } from "./draw.js?v=130";
import { batteryUnlocked, deepUnlocked, helmetRevealed, iapOwned, trailUnlocked, eraseSave, lostUnlocked, modsUnlocked, loadSave, palUnlocked, startShieldUnlocked, starsOf, suitRevealed, writeSave, } from "./save.js?v=130";
import { emptyStats, experimentalRaceById, levelById, levelUnlocked, STAR_REWARDS } from "./campaign.js?v=130";
import { dive, flap, initStars, makeWorld, settleLevel, pausePlay, planRaceCueEffects, resizeWorld, resetRun, resumePlay, setRaceInput, setTunnelHeld, snapshot, takeRaceCueEffects, updateWorld, } from "./sim.js?v=130";
import { canonicalRaceY, cancelRaceGesture, createRaceGestureState, dropRaceGesture, moveRaceDragGesture, moveRaceGesture, neutralizeOwnedRaceGesture, pressRaceDragGesture, pressRaceGesture, pressRaceKeyboardDragGesture, releaseRaceGesture, } from "./race-gesture.js?v=130";
import { raceViewport } from "./race-viewport.js?v=130";
export async function createEngine(canvas) {
    const raw = canvas.getContext("2d");
    if (!raw)
        throw new Error("no 2d");
    const ctx = raw;
    const save = loadSave();
    // the saved music preference applies before the first frame ever asks
    // for a track, so a switched-off score never blips on at boot
    music.setMuted(!!save.musicOff);
    const world = makeWorld(360, 640);
    let art = null;
    let raf = 0;
    let last = performance.now();
    let running = false;
    let raceAccumulator = 0;
    let raceGesture = createRaceGestureState();
    let raceResizeKeyboardReleasePending = null;
    const listeners = new Set();
    const notify = () => listeners.forEach((fn) => fn());
    // A finished Spill mission left its result in the hallway on the way
    // back. Bank it before the first render: stars land, and the pilot
    // walks straight into the result sheet instead of the title.
    try {
        const raw = localStorage.getItem("acornaut_spill_result");
        if (raw) {
            localStorage.removeItem("acornaut_spill_result");
            const r = JSON.parse(raw);
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
    }
    catch { /* a malformed record is dropped, never fatal */ }
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
            if (mode === "deep" && !deepUnlocked(save))
                return;
            if (mode === "lost" && !lostUnlocked(save))
                return;
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
                for (const id of IAP_ITEMS)
                    if (!save.purchased.includes(id))
                        save.purchased.push(id);
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
            const def = levelById(id) ?? (HYPER_RUN_ENABLED ? experimentalRaceById(id) : null);
            if (!def)
                return false;
            // starsOf, not the raw tally: Briella's code opens chapters here too
            if (!def.experimental && !levelUnlocked(def, save.stars || {}, starsOf(save)))
                return false;
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
            resetRun(world, save, def.base === "race" ? "fly" : def.base, false, def, def.base === "tunnel" ? 7000 + def.ord : undefined);
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
                // Stars are written by the sim, which the engine does not observe.
                // Every route back out of a run passes through here, so this is the
                // one choke point where "you crossed a dust line" can be noticed.
                // settleDust is idempotent, so calling it on every screen change is
                // free when nothing is owed.
                settleDust();
            }
            world.screen = s;
            if (s === "title")
                world.tut = null;
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
        settleDust,
        dailyState,
        claimDaily,
        buyDust,
        buyBundle,
        setMusicOff(off) {
            save.musicOff = off;
            writeSave(save);
            music.setMuted(off);
            notify();
        },
        setEclipseMotionMode(mode) {
            save.eclipseMotionMode = ((mode % 3) + 3) % 3;
            writeSave(save);
            notify();
        },
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
            if (world.race)
                raceAccumulator = 0;
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
        // the background sweep usually has this bank home already; if the
        // player beats it here, jump the queue so their suit flies animated.
        // Only against the REAL bank — a load into the placeholder would be
        // thrown away with it, yet still marked done.
        if (art && art.ready)
            void loadSuitBank(art, id);
        if (save.unlockedSuits.includes(id) || (isIap(id) && iapOwned(save, id)) || (save.purchased || []).includes(id)) {
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
        // Trails are never bought with acorns any more — a rung on the Star
        // Chart's ladder opens each one, premium ones come with the pack, and
        // an open trail simply equips.
        if (!trailUnlocked(save, id))
            return "locked";
        save.equippedTrail = id;
        if (!save.unlockedTrails.includes(id))
            save.unlockedTrails.push(id);
        writeSave(save);
        notify();
        return "equip";
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
    // ------------------------------------------------------------ star dust
    /** today, in the PILOT'S local calendar. Deliberately local rather than
     *  UTC: a daily reward should turn over at the player's midnight, not at
     *  one that lands mid-evening for half the world. */
    function today() {
        const d = new Date();
        const p2 = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }
    function dayNumber(iso) {
        if (!iso)
            return NaN;
        const [y, m, d] = iso.split("-").map(Number);
        return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    }
    /** Pay every dust line the pilot has crossed but not yet been paid for.
     *  Idempotent by construction: dustPaidTo only ever moves forward, so
     *  calling this twice pays once. Called on load and after every finish,
     *  which also means a save from before dust existed collects its whole
     *  backlog rather than losing it. */
    function settleDust() {
        const have = starsOf(save);
        let owed = 0, high = save.dustPaidTo;
        for (const r of STAR_REWARDS) {
            if (r.kind !== "dust" || !r.amount)
                continue;
            if (r.stars <= have && r.stars > save.dustPaidTo) {
                owed += r.amount;
                high = Math.max(high, r.stars);
            }
        }
        if (owed <= 0)
            return 0;
        save.starDust += owed;
        save.dustPaidTo = high;
        writeSave(save);
        notify();
        return owed;
    }
    /** How the daily stands right now, without claiming it. */
    function dailyState() {
        const t = dayNumber(today());
        const last = dayNumber(save.lastDaily);
        const claimedToday = !isNaN(last) && last === t;
        // a streak survives exactly one night. Two nights and it starts over.
        const continues = !isNaN(last) && t - last === 1;
        const nextStreak = claimedToday ? save.dailyStreak : continues ? save.dailyStreak + 1 : 1;
        const wrapped = ((nextStreak - 1) % DAILY_STREAK_LEN) + 1;
        return {
            claimedToday,
            streak: claimedToday ? ((save.dailyStreak - 1) % DAILY_STREAK_LEN) + 1 : wrapped,
            bonusDay: wrapped === DAILY_STREAK_LEN,
            amount: DAILY_DUST + (wrapped === DAILY_STREAK_LEN ? DAILY_STREAK_BONUS : 0),
        };
    }
    function claimDaily() {
        const st = dailyState();
        if (st.claimedToday)
            return "claimed";
        const t = dayNumber(today());
        const last = dayNumber(save.lastDaily);
        // a clock turned BACKWARDS must not re-open a claim already taken
        if (!isNaN(last) && t < last)
            return "claimed";
        save.dailyStreak = !isNaN(last) && t - last === 1 ? save.dailyStreak + 1 : 1;
        save.lastDaily = today();
        save.starDust += st.amount;
        writeSave(save);
        notify();
        return "ok";
    }
    /** The payment rail is not built yet, so a pack GRANTS its dust and says
     *  so plainly. When real billing lands this is the one place it hooks. */
    function buyDust(id) {
        const pack = DUST_PACKS.find((p) => p.id === id);
        if (!pack)
            return "missing";
        save.starDust += pack.dust + pack.bonus;
        writeSave(save);
        notify();
        return "ok";
    }
    function buyBundle(id) {
        const bn = BUNDLES.find((b) => b.id === id);
        if (!bn)
            return "missing";
        if (bn.items.every((i) => (save.purchased || []).includes(i)))
            return "owned";
        if (save.starDust < bn.dust)
            return "poor";
        save.starDust -= bn.dust;
        save.purchased = [...new Set([...(save.purchased || []), ...bn.items])];
        writeSave(save);
        notify();
        return "ok";
    }
    // A flight mod is bought once and then switched, so one call covers both:
    // if you do not own it this is a purchase, and if you do it is a toggle.
    // Turning one on turns its opposite off — Steady Gates and Rough Air
    // cannot both describe the same run.
    function setMod(id) {
        const mod = MODS.find((m) => m.id === id);
        if (!mod)
            return "unknown";
        // an always-on mod is a comfort switch: no star gate, no price, no
        // purchase record. It answers only to the pilot toggling it.
        if (!mod.always && !modsUnlocked(save))
            return "locked";
        if (save[mod.save]) {
            save[mod.save] = false;
            writeSave(save);
            notify();
            return "off";
        }
        const owned = mod.always || save.purchased.includes(mod.id);
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
    // How sharp we are willing to render. A phone reporting devicePixelRatio 3
    // was being drawn at 2.5 and then upscaled by the browser to fill the
    // screen — a fractional resample of every frame, which is most of what
    // read as "fuzzy": on identical glyphs, full-DPR rendering carries about
    // half again as much edge detail.
    //
    // Rendering at 3 is not free (it is 44% more pixels per frame), and the
    // right answer depends on the device, so this is measured rather than
    // assumed. We open at full DPR and, if the first seconds of play cannot
    // hold a frame budget, drop to the old cap ONCE and stay there. It never
    // climbs back: a renderer that renegotiates its own resolution mid-run
    // would be visible every time it changed its mind.
    const RENDER_CAP_HIGH = 3;
    const RENDER_CAP_SAFE = 2.5;
    let renderCap = RENDER_CAP_HIGH;
    let capProbe = [];
    function noteFrameCost(ms) {
        if (!capProbe || world.screen !== "play")
            return;
        capProbe.push(ms);
        if (capProbe.length < 90)
            return;
        // ignore the slowest few: a GC pause or a first-touch decode is not the
        // steady state we are deciding about
        const sorted = capProbe.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        capProbe = null;
        if (median > 20 && renderCap !== RENDER_CAP_SAFE) {
            renderCap = RENDER_CAP_SAFE;
            resize();
        }
    }
    function resize() {
        const parent = canvas.parentElement;
        if (!parent)
            return;
        const rect = parent.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, world.race ? 2 : renderCap);
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
            if (owner === "keyboard-rise" || owner === "keyboard-drop") {
                raceResizeKeyboardReleasePending = owner;
            }
            raceAccumulator = 0;
            swipe = null;
            pausePlay(world);
            if (typeof owner === "number") {
                try {
                    canvas.releasePointerCapture(owner);
                }
                catch { /* capture is best-effort */ }
            }
        }
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        resizeWorld(world, W, H);
        if (!world.stars.length)
            initStars(world);
        if (ownedRaceResize)
            notify();
    }
    let swipe = null;
    function applyRaceGesture(result) {
        raceGesture = result.state;
        if (!result.input)
            return false;
        const wasReady = world.ready;
        const accepted = setRaceInput(world, result.input);
        if (accepted && wasReady && !world.ready)
            raceAccumulator = 0;
        return accepted;
    }
    function resetInputTracking() {
        raceGesture = createRaceGestureState();
        raceResizeKeyboardReleasePending = null;
        swipe = null;
    }
    function cancelRaceControls(owner) {
        return applyRaceGesture(cancelRaceGesture(raceGesture, owner));
    }
    function pos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (world.W / rect.width),
            y: (e.clientY - rect.top) * (world.H / rect.height),
        };
    }
    function raceInputY(viewY) {
        const viewport = raceViewport(world.W, world.H);
        return canonicalRaceY(viewY, viewport.top, viewport.contentHeight);
    }
    canvas.addEventListener("pointerdown", (e) => {
        if (world.screen !== "play")
            return;
        if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0))
            return;
        e.preventDefault();
        const p = pos(e);
        if (world.race) {
            try {
                canvas.setPointerCapture(e.pointerId);
            }
            catch { /* capture is best-effort */ }
            const canonicalY = raceInputY(p.y);
            applyRaceGesture(world.race.phase === "tunnel"
                ? pressRaceDragGesture(raceGesture, e.pointerId, world.race.tick, canonicalY, world.race.y)
                : pressRaceGesture(raceGesture, e.pointerId, world.race.tick, canonicalY));
            notify();
            return;
        }
        swipe = { y0: p.y, t0: performance.now(), fired: false };
        const ev = setTunnelHeld(world, true) ? "flap" : flap(world, save);
        if (ev === "flap")
            sfx.flap();
        if (world.tut?.stage === "pal" && world.tut.hold && world.tut.t >= TUT_ARM) {
            world.tut.hold = false;
            world.tut.t = 0;
        }
        notify();
    }, { passive: false });
    canvas.addEventListener("pointermove", (e) => {
        if (world.race && world.screen === "play") {
            const p = pos(e);
            const canonicalY = raceInputY(p.y);
            const result = world.race.phase === "tunnel"
                ? moveRaceDragGesture(raceGesture, e.pointerId, world.race.tick, canonicalY, world.race.y)
                : moveRaceGesture(raceGesture, e.pointerId, world.race.tick, canonicalY);
            const isDrop = result.input?.drop === true;
            const accepted = applyRaceGesture(result);
            if (isDrop && accepted) {
                sfx.dive();
                notify();
            }
            return;
        }
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
    const end = (e) => {
        if (raceGesture.owner === e.pointerId) {
            if (e.type === "pointercancel")
                cancelRaceControls(e.pointerId);
            else
                applyRaceGesture(releaseRaceGesture(raceGesture, e.pointerId));
            return;
        }
        if (world.race)
            return;
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
        const t = e.target;
        if (t?.closest?.("input, textarea"))
            return;
        e.preventDefault();
    });
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
            // A key held through an orientation change keeps generating repeat
            // keydowns. It may not auto-resume the paused race or become a new
            // press until the physical key has first been released.
            if (raceResizeKeyboardReleasePending)
                return;
            if (world.screen === "splash")
                engine.open("title");
            else if (world.screen === "title")
                engine.fly("fly");
            // A focus/visibility/Escape pause cancels the semantic owner. Ignore an
            // OS repeat from the still-held key; only a fresh physical press resumes.
            else if (world.screen === "pause") {
                if (!e.repeat)
                    engine.resume();
            }
            else if (world.screen === "play") {
                if (world.race) {
                    if (!e.repeat)
                        applyRaceGesture(world.race.phase === "tunnel"
                            ? pressRaceKeyboardDragGesture(raceGesture, "keyboard-rise", world.race.tick, 0)
                            : pressRaceGesture(raceGesture, "keyboard-rise", world.race.tick, null));
                }
                else {
                    const ev = setTunnelHeld(world, true) ? "flap" : flap(world, save);
                    if (ev === "flap")
                        sfx.flap();
                }
            }
            else if (world.screen === "dead" && world.deadTimer > 0.55)
                engine.dismissDead();
            notify();
        }
        if (e.code === "ArrowDown" && world.screen === "play" && world.race) {
            e.preventDefault();
            if (raceResizeKeyboardReleasePending)
                return;
            if (e.repeat)
                return;
            if (world.race.phase === "tunnel") {
                applyRaceGesture(pressRaceKeyboardDragGesture(raceGesture, "keyboard-drop", world.race.tick, 640));
            }
            else if (applyRaceGesture(dropRaceGesture(raceGesture)))
                sfx.dive();
            notify();
        }
        else if (e.code === "ArrowDown" && world.screen === "play" && world.flight !== "tunnel") {
            const ev = dive(world);
            if (ev === "dive")
                sfx.dive();
            notify();
        }
    });
    window.addEventListener("keyup", (e) => {
        if (e.code === "Space" || e.code === "ArrowUp") {
            if (raceResizeKeyboardReleasePending === "keyboard-rise") {
                raceResizeKeyboardReleasePending = null;
                return;
            }
            if (raceGesture.owner === "keyboard-rise") {
                applyRaceGesture(releaseRaceGesture(raceGesture, "keyboard-rise"));
            }
            else if (!world.race)
                setTunnelHeld(world, false);
        }
        if (e.code === "ArrowDown") {
            if (raceResizeKeyboardReleasePending === "keyboard-drop") {
                raceResizeKeyboardReleasePending = null;
                return;
            }
            if (raceGesture.owner === "keyboard-drop") {
                applyRaceGesture(releaseRaceGesture(raceGesture, "keyboard-drop"));
            }
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
    function dispatchWorldEvent(ev) {
        if (ev === "acorn")
            sfx.acorn();
        if (ev === "gold" || ev === "ring")
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
        if (ev === "debris")
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
        if (ev === "shift" || ev === "entry" || ev === "return") {
            sfx.shift();
            notify();
        }
    }
    function dispatchRaceCues(cues) {
        let shouldNotify = false;
        for (const effect of planRaceCueEffects(cues)) {
            if (effect.sfx === "gold")
                sfx.gold();
            if (effect.sfx === "bounce")
                sfx.bounce();
            if (effect.sfx === "acorn")
                sfx.acorn();
            if (effect.sfx === "shift")
                sfx.shift();
            if (effect.notify)
                shouldNotify = true;
        }
        if (shouldNotify)
            notify();
    }
    function loop(now) {
        const frameDt = Math.min(0.25, (now - last) / 1000);
        noteFrameCost(now - last);
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
                if (world.screen === "lvldone")
                    break;
            }
        }
        else {
            raceAccumulator = 0;
            dispatchWorldEvent(updateWorld(world, save, Math.min(0.033, frameDt)));
        }
        // Four scores, one at a time: the chiptune rides the retro renderer
        // (arcade + shifted stretches, exactly as always); the Hyper Run time
        // trial keeps the voyage loop; every other live run gets the upbeat
        // flight instrumental; and everything outside a run — menus, results,
        // the hangar — settles onto the slow menu score.
        const inRun = world.screen === "play" || world.screen === "pause";
        music.set(world.retro && inRun ? "cosmos"
            : world.race && inRun ? "voyage"
                : inRun ? "flight"
                    : "menu");
        ctx.clearRect(0, 0, world.W, world.H);
        if (art) {
            if (world.screen === "play" || world.screen === "dead" || world.screen === "pause") {
                drawWorld(ctx, world, save, art);
                if (world.screen !== "pause")
                    drawHud(ctx, world, art);
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
    // FLIGHT plus whatever the save wears ride the boot load; the rest of
    // the roster's flight banks stream in one suit at a time afterwards.
    engine.artReady = loadArt([save.equippedSuit])
        .then((bank) => {
        art = bank;
        engine.art = bank;
        notify();
        prefetchSuitBanks(bank);
    })
        .catch(() => { });
    notify();
    return engine;
}
export { deepUnlocked, lostUnlocked } from "./save.js?v=130";
