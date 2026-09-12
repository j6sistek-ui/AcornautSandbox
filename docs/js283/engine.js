import { canWearTrail, builtInTrailSuit, STAR_MAP_PREVIEW, ENV_GATES, palsClash } from "./catalog.js?v=283";
import { platform } from "./platform.js?v=283";
import { beginFlightTest } from "./sim.js?v=283";
import { TAP_SHAPE_MIN, TAP_SHAPE_MAX, TAIL_SPRING_MIN, TAIL_SPRING_MAX } from "./control-constants.js?v=283";
import { isPremiumSuit } from "./high-orbit-config.js?v=283";
import { spillAppearance } from "./spill-appearance.js?v=283";
import { routeMasks, rewardId } from "./campaign-progress.js?v=283";
import { reachedGate } from "./campaign.js?v=283";
import { emptyArt, loadArt, loadPalBank, loadSuitBank, loadSpillScene, loadZoneArt, prefetchArtBanks } from "./art.js?v=283";
import { vanguardDepotEligible } from "./spill-depot-gag.js?v=283";
import { sfx, unlockAudio, music, setSfxMuted } from "./audio.js?v=283";
import { GUIDE_HELM, GUIDE_SUIT, TUTORIAL_SUIT, HELMETS, IAP_ITEMS, PALS, HYPER_RUN_ENABLED, IS_BETA, isIap, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, SUITS, TRAILS, TUT_ARM, BUNDLES, bundleIds, bundlePrice, idDust, idGrants, featurePrice, DUST_PACKS, DAILY_DUST, DAILY_STREAK_BONUS, DAILY_STREAK_LEN } from "./catalog.js?v=283";
import { drawHud, drawWorld, setSpillBackplateHost } from "./draw.js?v=283";
import { setVanguardPitchTrim } from "./vanguard.js?v=283";
import { batteryUnlocked, deepUnlocked, helmetRevealed, trailUnlocked, eraseSave, lostUnlocked, modsUnlocked, loadSave, grantTutorialKit, palUnlocked, startShieldUnlocked, starsOf, suitRevealed, writeSave, cleanPilotName, dualPalUnlocked, } from "./save.js?v=283";
import { hyperRunById, levelById, levelUnlocked, STAR_REWARDS } from "./campaign.js?v=283";
import { dive, envIndexFor, flap, initStars, makeWorld, pausePlay, planRaceCueEffects, resizeWorld, resetRun, resumePlay, reviveCost, reviveRun, setRaceInput, snapshot, takeRaceCueEffects, takeSpillCues, spillBurstUp, updateWorld, } from "./sim.js?v=283";
import { canonicalRaceY, cancelRaceGesture, createRaceGestureState, dropRaceGesture, moveRaceDragGesture, moveRaceGesture, neutralizeOwnedRaceGesture, pressRaceDragGesture, pressRaceGesture, pressRaceKeyboardDragGesture, releaseRaceGesture, } from "./race-gesture.js?v=283";
import { raceViewport } from "./race-viewport.js?v=283";
import { spillBuy, spillLeaveDepot, spillLunge, spillUtility, spillSpecialize, spillTakeContract, spillCheckpoint, restoreSpill } from "./spill.js?v=283";
import { SPILL_UTILITIES, SPILL_ENGINE_COLORS, spillEngineColor } from "./spill-content.js?v=283";
import { bankSpill, suitPitchFor, takeReceipt, buyBoost, skipLevel, unlockReward, ownsPremium, settleStarRewards } from "./save.js?v=283";
export async function createEngine(canvas) {
    // THE SPILL'S BACKPLATE (owner, 5 Sep 2026: "choppy laggy sometimes").
    // draw.ts bakes the Spill's gradient-and-panorama plate once per sector;
    // here it is mounted as an element BEHIND the game canvas, so the
    // backdrop costs the frame nothing - the compositor stacks the two. The
    // sway rides on a transform. Hidden the moment the run is not the Spill;
    // every other mode paints its own opaque sky over the canvas anyway.
    let backplate = null;
    let backplateShown = false;
    let backplateW = 0, backplateH = 0, backplateTf = "";
    setSpillBackplateHost((plate, off, w, h) => {
        const parent = canvas.parentElement;
        if (!parent)
            return false;
        if (backplate !== plate) {
            if (backplate)
                backplate.remove();
            plate.className = "ac-backplate";
            parent.insertBefore(plate, canvas);
            backplate = plate;
            backplateW = backplateH = 0;
            backplateTf = "";
        }
        const st = plate.style;
        if (backplateW !== w || backplateH !== h) {
            st.width = `${w}px`;
            st.height = `${h}px`;
            backplateW = w;
            backplateH = h;
        }
        const tf = `translate3d(${(Math.round(off * 10) / 10).toFixed(1)}px,0,0)`;
        if (tf !== backplateTf) {
            st.transform = tf;
            backplateTf = tf;
        }
        if (!backplateShown) {
            st.display = "";
            backplateShown = true;
        }
        return true;
    });
    const hideBackplate = () => {
        if (backplateShown && backplate) {
            backplate.style.display = "none";
            backplateShown = false;
        }
    };
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
    // The Spill used to live on a lab page and post its mission result back
    // through localStorage for the boot to bank. It flies inside the engine
    // now, so a stale record from that era is simply dropped.
    platform.storage.remove("acornaut_spill_result");
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
            void loadZoneArt(engine.art, world.envB).then(notify);
            resize();
            if (mode === "spill") {
                raceAccumulator = 0;
                last = performance.now();
                save.spillSuspended = null;
                writeSave(save);
                void loadSpillScene(engine.art, save.equippedSuit).then(notify);
            }
            resetInputTracking();
            notify();
        },
        startOver() {
            eraseSave();
            window.location.reload();
        },
        redeemAccessCode(code) {
            // A DEV DOOR, not a store feature. Both codes hand out content for
            // free, which a store build must never do (App Store 3.1.1), so a
            // shell that closes the dev doors closes this one too.
            if (!platform.devDoors)
                return "denied";
            const entered = code.trim();
            // BOTH CODES OPEN THE WHOLE LOADOUT. They used to open different
            // halves of it, which is why each read as a partial unlock: 120189
            // granted IAP_ITEMS and left every STAR-gated suit, helmet, trail
            // and pal locked, while 033018 granted stars and so left the
            // PURCHASED items locked. Every loadout gate in save.ts takes a
            // purchase, a star count, or the id sitting in its own unlocked
            // list, so filling the lists opens all five tabs without touching
            // stars or chart progress.
            const openWholeLoadout = () => {
                const add = (list, ids) => {
                    for (const id of ids)
                        if (!list.includes(id))
                            list.push(id);
                    return list;
                };
                save.purchased = add(save.purchased || [], IAP_ITEMS);
                // AcorNut is the one that made this look half-finished even with
                // the lists filled: migrate strips TUTORIAL_SUIT back out of
                // unlockedSuits unless tutorialSuitEarned says otherwise, and that
                // reads `purchased`, never the list. Without this entry the next
                // save quietly takes him away again.
                add(save.purchased, [TUTORIAL_SUIT]);
                add(save.unlockedSuits, SUITS.map((x) => x.id));
                add(save.unlocked, HELMETS.map((x) => x.id));
                add(save.unlockedTrails, TRAILS.map((x) => x.id));
                add(save.unlockedPals, PALS.map((x) => x.id));
                // The SHIP tab is loadout too; these four read keyUnlocks beside
                // their star gate. `deep` and `lost` are flight MODES rather than
                // loadout, so they stay on the chart where they were put.
                add(save.keyUnlocks, ["flightmods", "startShield", "battery", "dualpal"]);
            };
            if (entered === "120189") {
                openWholeLoadout();
                writeSave(save);
                notify();
                return "ok";
            }
            // Briella's code. Everything the code above opens, plus the stars:
            // the game believes it has every star on the road, all the gates
            // open, and Dad gets to watch her fly whatever she wants. The only
            // difference from 120189 is that this one says so.
            if (entered === "033018") {
                openWholeLoadout();
                save.allStars = true;
                writeSave(save);
                notify();
                return "love";
            }
            return "denied";
        },
        setSpillAppearance(kind, id) {
            if (!STAR_MAP_PREVIEW || !["finish", "trail"].includes(kind))
                return false;
            if (id !== "stock" && id !== (kind === "finish" ? "rust-runner" : "rust-wake"))
                return false;
            save.spillAppearance = { ...spillAppearance(save), [kind]: id };
            writeSave(save);
            notify();
            return true;
        },
        flyLevel(id) {
            const def = levelById(id) ?? (HYPER_RUN_ENABLED ? hyperRunById(id) : null);
            if (!def)
                return false;
            if (def.base === "race" && !IS_BETA && !save.raceGates.includes(33)
                && !reachedGate(routeMasks(save), save.raceGates))
                return false;
            // Actual mission passage opens the road; reward eligibility cannot skip it.
            if (!def.standalone && !levelUnlocked(def, routeMasks(save), starsOf(save), save.raceGates))
                return false;
            unlockAudio();
            // levels never run the tutorial: the chart itself is gated behind
            // having a save, and a first-timer meets the tutorial in endless.
            // A Wormhole mission flies a FIXED corridor: the seed is the level's
            // stored identity seed, so reordering cannot change its corridor.
            // A Spill mission does the same with its wave ladder (see resetRun).
            resetRun(world, save, def.base === "race" ? "fly" : def.base, false, def, def.base === "tunnel" ? def.seed ?? undefined : undefined);
            void loadZoneArt(engine.art, def.fx.env ?? 0).then(notify);
            resize();
            if (def.base === "spill")
                void loadSpillScene(engine.art, save.equippedSuit).then(notify);
            resetInputTracking();
            raceAccumulator = 0;
            guideStep("level");
            notify();
            return true;
        },
        open(s) {
            if (s !== "play") {
                cancelRaceControls();
                swipe = null;
                // Stars are written by the sim, which the engine does not observe.
                // Every route back out of a run passes through here, so this is the
                // one choke point where "you crossed a dust line" can be noticed.
                // settleDust is idempotent, so calling it on every screen change is
                // free when nothing is owed.
                settleDust();
                // THE DAILY IS PAID FOR SHOWING UP, AND SHOWING UP IS OPENING THE
                // GAME (owner, 2 Sep 2026: "just count log in, not store tap").
                // It used to land on arrival at the shop, which quietly made the
                // reward conditional on wanting to spend - a pilot who only ever
                // flew never collected a day of it. The claim moved to boot; the
                // shop keeps the receipt and the streak tracker it always drew.
                // THE GUIDE OPENS THE TAB IT IS TALKING ABOUT. The hub said "put on
                // your new Ion suit" and the Loadout opened on HELMETS, with only a
                // faint pulse on the SUITS pill to say so - so the instruction and
                // the screen disagreed the moment you arrived. Reported exactly
                // that way. Whichever step is live picks the shelf.
                if (s === "hangar") {
                    if (save.guide === "hangar") {
                        shopTab = "suits";
                        engine.shopTab = "suits";
                    }
                    else if (save.guide === "helmet") {
                        shopTab = "helmets";
                        engine.shopTab = "helmets";
                    }
                }
            }
            world.screen = s;
            if (s === "title")
                world.tut = null;
            if (s === "title" || s === "log") {
                world.race = null;
                world.spill = null;
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
        setPilotName(name) {
            const clean = cleanPilotName(name);
            save.pilotName = clean;
            writeSave(save);
            notify();
            return clean;
        },
        wantSuitArt(id) {
            // only against the REAL bank - a load into the placeholder is thrown
            // away with it, yet would still be marked done
            if (art && art.ready)
                void loadSuitBank(art, id);
        },
        wantPalArt(id) {
            if (art && art.ready)
                void loadPalBank(art, id);
        },
        /** LEAVE THE FIRST FLIGHT, keeping everything it would have given you.
         *  A tutorial with no exit is a trap for anyone who already knows how to
         *  play, or who hits a lesson that is not landing - and it hands the
         *  pilot straight to the Loadout, which is where the tutorial was
         *  walking them anyway. */
        skipTutorial() {
            save.tutorialDone = true;
            grantTutorialKit(save);
            // AND JOIN THE GUIDED PATH. Skipping used to leave guide on "pending",
            // which is the state that means "the first flight has not finished
            // yet" - so the walk to the Loadout never started, the shelf never
            // knew which tab to open, and a pilot who skipped was simply dropped
            // somewhere with no next step. The kit has just been handed over;
            // "hangar" is the step that says go and put it on.
            if (save.guide === "pending" || save.guide === "reward")
                save.guide = "hangar";
            writeSave(save);
            world.tut = null;
            this.open("hangar");
        },
        finishTutorial() {
            // The same handoff as skipTutorial, and deliberately so - what the
            // pilot did differs, where they land does not. The kit was granted at
            // the handover; "hangar" is the step that says go and put it on.
            save.tutorialDone = true;
            grantTutorialKit(save);
            if (save.guide === "pending" || save.guide === "reward")
                save.guide = "hangar";
            writeSave(save);
            world.tut = null;
            shopTab = "suits";
            engine.shopTab = "suits";
            this.open("hangar");
        },
        setShelfGrid(on) {
            save.shelfGrid = !!on;
            writeSave(save);
            notify();
        },
        settleDust,
        dailyState,
        claimDaily,
        takeDailyClaim() {
            const p = pendingDaily;
            pendingDaily = null;
            return p;
        },
        /** Is there a daily the pilot has been paid but not yet shown? Boot
         *  banks the dust, so "unclaimed" no longer means anything to a badge;
         *  what is still worth pointing at is the receipt nobody has seen. */
        dailyUnseen: () => pendingDaily !== null,
        buyDust,
        dustPending,
        takeDustOutcome,
        restorePurchases,
        buyBundle,
        buyShopItem,
        buyFeature,
        buyBoost(id) {
            const r = buyBoost(save, id);
            if (r !== "ok")
                return r;
            writeSave(save);
            notify();
            return "ok";
        },
        useLevelSkip(levelId) {
            const def = levelById(levelId);
            if (!def)
                return "missing";
            const r = skipLevel(save, def);
            if (r !== "ok")
                return r;
            writeSave(save);
            // three new stars may cross a currency line; pay it now, not on the
            // next finish
            settleDust();
            notify();
            return "ok";
        },
        useStarUnlock(rewardKey) {
            const r = STAR_REWARDS.find((x) => rewardId(x) === rewardKey);
            if (!r)
                return "missing";
            const out = unlockReward(save, r);
            if (out !== "ok")
                return out;
            writeSave(save);
            notify();
            return "ok";
        },
        setMusicOff(off) {
            save.musicOff = off;
            writeSave(save);
            music.setMuted(off);
            notify();
        },
        setSfxOff(off) {
            save.sfxOff = off;
            writeSave(save);
            setSfxMuted(off);
            notify();
        },
        setHelpOff(off) {
            save.helpOff = off;
            writeSave(save);
            notify();
        },
        setSpillButtonsOff(off) {
            save.spillButtonsOff = off;
            writeSave(save);
            notify();
        },
        setSpillPromptsOff(off) {
            save.spillPromptsOff = off;
            writeSave(save);
            notify();
        },
        setMotionOff(off) {
            save.motionOff = off;
            writeSave(save);
            // the class is what the stylesheet reads; the save is what survives
            document.body.classList.toggle("ac-nomotion", off);
            notify();
        },
        setIntroOff(off) {
            save.introOff = off;
            writeSave(save);
            notify();
        },
        toggleFavorite(id) {
            const list = save.favorites ?? [];
            const on = !list.includes(id);
            save.favorites = on ? [...list, id] : list.filter((x) => x !== id);
            writeSave(save);
            notify();
            return on;
        },
        isFavorite: (id) => (save.favorites ?? []).includes(id),
        setLab(patch) {
            save.lab = { ...(save.lab ?? {}), ...patch };
            for (const k of Object.keys(save.lab))
                if (save.lab[k] === undefined)
                    delete save.lab[k];
            if (IS_BETA && world.flight === "fly" && !world.lvl && !world.tut)
                world.lab = { ...save.lab };
            writeSave(save);
            notify();
        },
        resetLab() {
            save.lab = {};
            if (!world.lvl)
                world.lab = {};
            writeSave(save);
            notify();
        },
        setTapRewind(on) {
            save.tapRewind = on;
            world.tapAnimQueued = false; // a queued replay from the other rule is not owed
            writeSave(save);
            notify();
        },
        setTapAccent(on) {
            save.tapAccent = !!on;
            writeSave(save);
            notify();
        },
        setTapRepeat(suitId, mode) {
            if (!save.tapRepeat)
                save.tapRepeat = {};
            if (mode === null)
                delete save.tapRepeat[suitId];
            else
                save.tapRepeat[suitId] = mode;
            world.tapAnimQueued = false; // a queued replay from the other rule is not owed
            writeSave(save);
            notify();
        },
        setTapShape(suitId, shape) {
            if (!save.tapShape)
                save.tapShape = {};
            if (shape === null)
                delete save.tapShape[suitId];
            else if (shape === "velocity" || shape === "default")
                save.tapShape[suitId] = shape;
            else {
                const c = (n) => Math.max(TAP_SHAPE_MIN, Math.min(TAP_SHAPE_MAX, Math.round(n * 20) / 20));
                save.tapShape[suitId] = { fwd: c(shape.fwd), back: c(shape.back) };
            }
            writeSave(save);
            notify();
        },
        setTailSpring(suitId, spring) {
            if (!save.tailSpring)
                save.tailSpring = {};
            if (spring === null)
                delete save.tailSpring[suitId];
            else {
                const c = (n) => Math.max(TAIL_SPRING_MIN, Math.min(TAIL_SPRING_MAX, Math.round(n * 20) / 20));
                save.tailSpring[suitId] = { stiff: c(spring.stiff), damp: c(spring.damp), kick: c(spring.kick) };
            }
            writeSave(save);
            notify();
        },
        startFlightTest() {
            // the door is beta-and-dev-doors only; the sim refuses outside the
            // beta on its own, this is the store-build half of the gate
            if (!IS_BETA || !platform.devDoors)
                return;
            unlockAudio();
            const pattern = (save.testLab?.pattern ?? "hover");
            if (!beginFlightTest(world, save, pattern))
                return;
            world.timeScale = save.testLab?.speed ?? 1;
            void loadZoneArt(engine.art, world.envB).then(notify);
            resize();
            resetInputTracking();
            raceAccumulator = 0;
            last = performance.now();
            notify();
        },
        setFlightTest(patch) {
            if (!save.testLab)
                save.testLab = {};
            if (patch.pattern) {
                save.testLab.pattern = patch.pattern;
                if (world.flightTest) {
                    world.flightTest.pattern = patch.pattern;
                    world.flightTest.next = 0;
                    world.flightTest.pair = false;
                }
            }
            if (patch.speed !== undefined) {
                const s = Math.max(0, Math.min(1, patch.speed));
                // a hold (0) is a moment, not a setting: the saved speed is what
                // the transport returns to
                if (s > 0)
                    save.testLab.speed = s;
                if (world.flightTest)
                    world.timeScale = s;
            }
            writeSave(save);
            notify();
        },
        flightTestStep() {
            // one authority tick, drained once - a Flight Test is never a race
            // or the Spill, so there are no cue plans to double-dispatch
            if (!world.flightTest || world.screen !== "play" || world.race || world.spill)
                return;
            const ev = updateWorld(world, save, 1 / 60);
            dispatchWorldEvent(ev);
            notify();
        },
        resetTestLab() {
            delete save.tapShape;
            delete save.tapRepeat;
            delete save.tailSpring;
            delete save.suitPitch;
            delete save.testLab;
            save.tapAccent = false;
            save.tapRewind = false;
            save.lab = {};
            if (!world.lvl)
                world.lab = world.flightTest ? { freeRevive: true } : {};
            world.tapAnimQueued = false;
            if (world.flightTest)
                world.timeScale = 1;
            writeSave(save);
            notify();
        },
        setSuitPitch(suitId, deg) {
            if (!save.suitPitch)
                save.suitPitch = {};
            save.suitPitch[suitId] = Math.max(-20, Math.min(45, Math.round(deg)));
            if (suitId === "vanguard")
                setVanguardPitchTrim(save.suitPitch[suitId]);
            writeSave(save);
            notify();
        },
        setHeroExpanded(on) {
            save.heroExpanded = !!on;
            writeSave(save);
            notify();
        },
        restartLevel() {
            const id = world.lvl?.def.id;
            if (!id)
                return false;
            // leave the paused run without settling it as a loss twice: flyLevel
            // resets the world outright, and the pause screen is simply replaced
            return engine.flyLevel(id);
        },
        continueCost() {
            return reviveCost(world);
        },
        continueRun() {
            const ok = reviveRun(world, save);
            if (ok)
                notify();
            return ok;
        },
        spillThrust() {
            if (!world.spill || world.screen !== "play" || save.spillButtonsOff)
                return;
            if (flap(world, save) === "flap")
                sfx.flap();
            notify();
        },
        spillDive() {
            if (!world.spill || world.screen !== "play")
                return;
            if (dive(world, save) === "dive")
                sfx.dive();
            notify();
        },
        spillLunge() {
            if (!world.spill || world.screen !== "play")
                return;
            // on the ready card a lunge is a launch, and a launch has to go
            // through the tap path: that is what clears w.ready, and a run
            // started around it would sit frozen on the countdown forever
            if (world.ready) {
                if (flap(world, save) === "flap")
                    sfx.flap();
                notify();
                return;
            }
            if (spillLunge(world.spill)) {
                sfx.near();
                notify();
            }
        },
        spillBuy(what) {
            if (!world.spill || world.screen !== "play")
                return "closed";
            const r = spillBuy(world.spill, what);
            if (r === "ok")
                sfx.ui();
            else if (r === "poor")
                sfx.warning();
            if (r === "ok")
                checkpointSpill();
            notify();
            return r;
        },
        spillLeaveDepot() {
            if (!world.spill || world.screen !== "play")
                return;
            if (spillLeaveDepot(world.spill)) {
                if (!world.spill.target) {
                    save.spillSuspended = null;
                    writeSave(save);
                }
                sfx.section();
                notify();
            }
        },
        spillUtility(id, replace) {
            if (!world.spill || world.screen !== "play")
                return "closed";
            const result = spillUtility(world.spill, id, replace);
            if (result === "ok") {
                checkpointSpill();
                sfx.ui();
            }
            else
                sfx.warning();
            notify();
            return result;
        },
        spillSpecialize(id) {
            const ok = world.screen === "play" && world.spill && spillSpecialize(world.spill, id);
            if (ok) {
                checkpointSpill();
                sfx.ui();
                notify();
            }
            return !!ok;
        },
        spillContract(id) {
            const ok = world.screen === "play" && world.spill && spillTakeContract(world.spill, id);
            if (ok) {
                checkpointSpill();
                sfx.ui();
                notify();
            }
            return !!ok;
        },
        spillSuspend() {
            if (world.screen !== "play" || !world.spill || !spillCheckpoint(world.spill))
                return false;
            checkpointSpill();
            world.spill = null;
            world.screen = "title";
            resetInputTracking();
            notify();
            return true;
        },
        spillResume() {
            const restored = restoreSpill(save.spillSuspended, world.W, world.H);
            if (!restored)
                return false;
            unlockAudio();
            resetRun(world, save, "spill", false);
            world.spill = restored;
            restored.signal = spillEngineColor(save).color;
            resize();
            void loadSpillScene(engine.art, save.equippedSuit).then(notify);
            world.ready = false;
            world.squirrel.y = restored.pilot.y;
            world.squirrel.vy = 0;
            world.score = restored.cleared;
            save.spillSuspended = spillCheckpoint(restored);
            writeSave(save);
            resetInputTracking();
            raceAccumulator = 0;
            last = performance.now();
            notify();
            return true;
        },
        spillStarter(id) {
            const preparing = world.screen === "play" && world.spill?.phase === "ready" && !world.spill.target;
            if (world.screen !== "hangar" && !preparing)
                return;
            if (id && (!SPILL_UTILITIES[id] || save.spillBest < SPILL_UTILITIES[id].unlock))
                return;
            save.spillStarter = id;
            if (preparing) {
                world.spill.utilities = id ? [id] : [];
                world.spill.ownedUtilities = id ? [id] : [];
            }
            writeSave(save);
            notify();
        },
        setSpillEngineColor(id) {
            const fitting = world.screen === "play" && world.spill && ["ready", "depot"].includes(world.spill.phase);
            const color = SPILL_ENGINE_COLORS.find(c => c.id === id && save.spillBest >= c.at);
            if ((world.screen !== "hangar" && !fitting) || !color)
                return false;
            save.spillEngineColor = id;
            save.spillSignal = id !== "stock";
            if (fitting) {
                world.spill.signal = spillEngineColor(save).color;
                checkpointSpill();
            }
            writeSave(save);
            notify();
            return true;
        },
        dismissDead() {
            world.screen = "title";
            world.lastRun = null;
            world.spill = null;
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
            swipe = null;
            // A race pause discards the incomplete presentation-frame remainder.
            // Resume starts from the next whole 60 Hz authority step, so focus loss
            // can never leak hidden-tab wall time into the time trial.
            if (world.race || world.spill)
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
            // AND MOVE THE SHELF WITH THE STEP. Equipping the suit advances the
            // guide to the helmet, but the pilot is still standing on the SUITS
            // shelf - so the instruction named something that was not on screen
            // and had no target to point at. open() sets the tab on arrival; this
            // is the same rule for a step that advances while already here.
            if (save.guide === "helmet") {
                shopTab = "helmets";
                engine.shopTab = "helmets";
            }
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
        if (isPremiumSuit(save.equippedSuit))
            return "fixedHead";
        // a matched-set helmet only goes on its own suit
        if (item.suitOnly && save.equippedSuit !== item.suitOnly)
            return "suitOnly";
        if (!helmetRevealed(save, id))
            return "locked";
        // A premium item that is OWNED equips — it never re-enters the buy
        // path, whatever its cost field says. The Cat carried a stale acorn
        // price from before it went premium, and "owned" met "poor".
        if (save.unlocked.includes(id) || (isIap(id) && ownsPremium(save, id))) {
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
        // bought, keyed or earned on the road: the same answer the Loadout gives
        if (save.unlockedSuits.includes(id) || (isIap(id) && ownsPremium(save, id))) {
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
    // stepping out of a suit takes its matched helmet off with it - and
    // stepping INTO one puts its matched helmet on. The second half was
    // missing (owner, 2 Sep 2026: "the leviathan helmet is missing"): a
    // suit-locked helmet is on no shelf, so the drop here was the only code
    // that ever touched it, and a pilot who bought the Regalia pack flew
    // Leviathan in a Clear dome with no way to change that. Only a Clear
    // dome or another suit's orphan is replaced; a helmet the pilot chose
    // on purpose stays.
    function dropOrphanedHelmet() {
        // These pilots hide the previous visor without replacing its save choice.
        if (isPremiumSuit(save.equippedSuit))
            return;
        const h = HELMETS.find((x) => x.id === save.equipped);
        if (h?.suitOnly && h.suitOnly !== save.equippedSuit)
            save.equipped = "clear";
        if (save.equipped === "clear") {
            const own = HELMETS.find((x) => x.suitOnly === save.equippedSuit && helmetRevealed(save, x.id));
            if (own)
                save.equipped = own.id;
        }
    }
    function transactTrail(id) {
        const item = TRAILS.find((h) => h.id === id);
        if (!item)
            return "missing";
        // Trails are never bought with acorns any more — a rung on the Star
        // Chart's ladder opens each one, premium ones come with the pack, and
        // an open trail simply equips.
        if (!canWearTrail(id, save.equippedSuit) || !trailUnlocked(save, id))
            return "locked";
        // Fixed wake is presentation, not a replacement for the previous trail.
        if (builtInTrailSuit(id))
            return "equip";
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
        // the sweep usually has this home already; if the player beats it,
        // jump the queue so their pal flies animated rather than still
        if (art && art.ready)
            void loadPalBank(art, id);
        if (!save.unlockedPals.includes(id))
            save.unlockedPals.push(id);
        // TWO SLOTS (owner, 7 Sep 2026, earned at 720 stars). The high slot is
        // the one the game always had; the low slot opens beside it. A tap on
        // a free pal takes the first empty slot, or replaces the low one when
        // both are full. A tap on a pal already flying dismisses it, and a
        // lone companion always climbs to the high slot. "None" clears both.
        if (id === "none") {
            save.equippedPal = "none";
            save.equippedPal2 = "none";
        }
        else if (!dualPalUnlocked(save)) {
            save.equippedPal = id;
            save.equippedPal2 = "none";
        }
        else if (save.equippedPal === id) {
            save.equippedPal = save.equippedPal2;
            save.equippedPal2 = "none";
        }
        else if (save.equippedPal2 === id)
            save.equippedPal2 = "none";
        else if (save.equippedPal === "none")
            save.equippedPal = id;
        else {
            if (palsClash(save.equippedPal, id))
                return "clash";
            save.equippedPal2 = id;
        }
        writeSave(save);
        notify();
        return "equip";
    }
    function toggleMod(which) {
        if (which === "shield") {
            if (!startShieldUnlocked(save))
                return "locked";
            // Armed is armed: the charge is spent by the next run, not by a
            // second tap. A toggle here let a pilot switch it off for nothing
            // and pay again to switch it back on.
            if (save.startShield)
                return "armed";
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
    /** Pay every currency line the pilot has crossed but not yet been paid for.
     *  Idempotent by construction: each reward has a stable ledger id, while
     *  dustPaidTo retains the compatibility watermark used by older bundles.
     *  Called on load and after every finish, so old saves collect their whole
     *  backlog rather than losing it. */
    function settleDust() {
        // the rules live on the save (settleStarRewards) so the harness can
        // prove them; this is the write and the notify
        const paid = settleStarRewards(save);
        if (paid <= 0)
            return 0;
        writeSave(save);
        notify();
        return paid;
    }
    /** How the daily stands right now, without claiming it. */
    /** Bandit, Noodle and Quill: the first full week's prize */
    const STREAK_PACK = ["raccoon", "ferret", "hedgehog"];
    function dailyState() {
        const t = dayNumber(today());
        const last = dayNumber(save.lastDaily);
        const claimedToday = !isNaN(last) && last === t;
        // a streak survives exactly one night. Two nights and it starts over.
        const continues = !isNaN(last) && t - last === 1;
        const nextStreak = claimedToday ? save.dailyStreak : continues ? save.dailyStreak + 1 : 1;
        const wrapped = ((nextStreak - 1) % DAILY_STREAK_LEN) + 1;
        const bonusDay = wrapped === DAILY_STREAK_LEN;
        // THE FIRST FULL WEEK PAYS THE CRITTER PACK (owner, 8 Sep 2026: "the
        // VERY FIRST 7 day streak unlocks Quill, Bandit and Noodle... After
        // that, it's star dust"). The pack replaces that week's dust bonus.
        const pack = bonusDay && !save.streakPackClaimed;
        return {
            claimedToday,
            streak: claimedToday ? ((save.dailyStreak - 1) % DAILY_STREAK_LEN) + 1 : wrapped,
            bonusDay,
            pack,
            amount: DAILY_DUST + (bonusDay && !pack ? DAILY_STREAK_BONUS : 0),
        };
    }
    let pendingDaily = null;
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
        if (st.pack) {
            save.purchased = [...new Set([...(save.purchased || []), ...STREAK_PACK])];
            save.streakPackClaimed = true;
            if (art && art.ready)
                for (const id of STREAK_PACK)
                    void loadSuitBank(art, id);
        }
        pendingDaily = { amount: st.amount, streak: st.streak, bonus: st.bonusDay, pack: st.pack };
        writeSave(save);
        notify();
        return "ok";
    }
    /** REAL MONEY GOES THROUGH THE BRIDGE. With a store adapter (the App
     *  Store shell) the purchase runs there and the dust is granted here on
     *  "ok" - the one place a receipt turns into currency. Without one, the
     *  beta still grants outright so testers can shop; the live web page
     *  refuses, because a pack that grants for free is not a placeholder, it
     *  is a loophole. */
    /** ONE RECEIPT, ONE GRANT. A transaction id the ledger has seen is
     *  ignored; one it has not is paid and recorded. Without an id (the
     *  beta's free grant) it simply pays. */
    function grantDust(pack, transactionId) {
        if (transactionId && !takeReceipt(save, transactionId))
            return false;
        save.starDust += pack.dust + pack.bonus;
        writeSave(save);
        notify();
        return true;
    }
    /** THE PURCHASE THE SHOP IS WAITING ON. While the store sheet is up the
     *  row is disabled and says so; when the store answers, the outcome is
     *  parked here until the shop has shown it, the way takeDailyClaim parks
     *  a daily. A second tap while one is in flight is ignored rather than
     *  opening a second sheet. */
    let dustPurchase = null;
    function buyDust(id) {
        const pack = DUST_PACKS.find((p) => p.id === id);
        if (!pack)
            return "missing";
        if (platform.storeReady) {
            if (dustPurchase?.state === "pending")
                return "pending";
            dustPurchase = { id, state: "pending" };
            notify();
            platform.buyDust(id)
                .then((r) => {
                if (r.result === "ok")
                    grantDust(pack, r.transactionId);
                dustPurchase = { id, state: r.result };
                notify();
            })
                // a store that throws (network gone, sheet dismissed by the OS) is
                // a failed purchase, not an unhandled rejection with a stuck row
                .catch(() => { dustPurchase = { id, state: "failed" }; notify(); });
            return "pending";
        }
        if (IS_BETA) {
            grantDust(pack);
            return "ok";
        }
        return "unavailable";
    }
    function dustPending() { return dustPurchase?.state === "pending" ? dustPurchase.id : null; }
    function takeDustOutcome() {
        if (!dustPurchase || dustPurchase.state === "pending")
            return null;
        const out = dustPurchase;
        dustPurchase = null;
        return out;
    }
    /** WHAT THE STORE STILL OWES. Every consumable on the store's record
     *  that the ledger has not paid: a purchase that finished after the app
     *  was suspended, a child's Ask to Buy approved hours later, a receipt
     *  the store re-delivers on the next launch. Asked at boot, on resume and
     *  after Restore Purchases; idempotent by the ledger. */
    function deliverPending() {
        if (!platform.storeReady)
            return Promise.resolve(0);
        return platform.pendingPurchases().then((list) => {
            let paid = 0;
            for (const p of list) {
                const pack = DUST_PACKS.find((d) => d.id === p.id);
                if (pack && grantDust(pack, p.transactionId))
                    paid++;
            }
            return paid;
        });
    }
    function restorePurchases() {
        return platform.restorePurchases().then(() => deliverPending()).then(() => notify());
    }
    function buyBundle(id) {
        const bn = BUNDLES.find((b) => b.id === id);
        if (!bn)
            return "missing";
        const ids = bundleIds(bn);
        if (ids.every((i) => ownsPremium(save, i)))
            return "owned";
        // Both entry points charge the displayed kit quote, with full retail
        // ownership credit. Zero due can still complete an unowned kit; only
        // the ownership check above means there is nothing left to grant.
        const due = bundlePrice(bn, (i) => ownsPremium(save, i));
        if (save.starDust < due)
            return "poor";
        save.starDust -= due;
        // idGrants, like every other buy (audit, 8 Sep 2026): a pack listing a
        // suit must also hand over the trail painted for it, or the Circuit Pack
        // gives Cyber without the Clockwork wake that the single shelf and the
        // featured pack both include for the same id.
        save.purchased = [...new Set([...(save.purchased || []), ...ids.flatMap((i) => idGrants(i))])];
        writeSave(save);
        notify();
        return "ok";
    }
    // ONE item off the shelf. The id is the ownership atom, so this also
    // covers a set: buying "cryostar" hands over the suit, the helmet that
    // matches it and the trail painted for it, for one price.
    function buyShopItem(id) {
        if (!IAP_ITEMS.includes(id))
            return "missing";
        if (ownsPremium(save, id))
            return "owned";
        const due = idDust(id);
        if (save.starDust < due)
            return "poor";
        save.starDust -= due;
        save.purchased = [...new Set([...(save.purchased || []), ...idGrants(id)])];
        writeSave(save);
        notify();
        return "ok";
    }
    // The same kit quote as direct checkout. Credit is a price reduction,
    // never a currency refund; an explicit zero-due completion still grants
    // the missing contents and their set trails.
    function buyFeature(id) {
        const bn = BUNDLES.find((b) => b.id === id);
        if (!bn)
            return "missing";
        const ids = bundleIds(bn);
        if (ids.every((i) => ownsPremium(save, i)))
            return "owned";
        const due = featurePrice(bn, (i) => ownsPremium(save, i));
        if (save.starDust < due)
            return "poor";
        save.starDust -= due;
        // a pack hands over its trails too, and idGrants folds in any set trail
        // that the pack listed only by its suit
        const grants = ids.flatMap((i) => idGrants(i));
        save.purchased = [...new Set([...(save.purchased || []), ...grants])];
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
        const dpr = Math.min(window.devicePixelRatio || 1, world.race || world.spill ? 2 : renderCap);
        // widescreen everywhere: the play area takes the whole window. The old
        // 1600px cap left a dark bar down the right of a wide monitor (owner,
        // 7 Sep 2026); the cap is now past any desktop, and whatever is left
        // over splits evenly rather than piling up on one side.
        const W = Math.min(rect.width, 3840);
        const H = rect.height;
        // the notch: --sat is env(safe-area-inset-top) on the stage (index.html).
        // window.getComputedStyle, not the bare global: the bare name is not on
        // globalThis outside a real browser, so every harness test that boots the
        // engine threw here (audit, 8 Sep 2026) - which is exactly the six tests
        // that cover engine.ts and standalone.ts at all.
        world.insetTop = parseFloat(window.getComputedStyle(parent).getPropertyValue("--sat")) || 0;
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
        const spillResize = sizeChanged && world.spill !== null && world.screen === "play" && !world.ready;
        if (spillResize) {
            resetInputTracking();
            raceAccumulator = 0;
            pausePlay(world);
        }
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        canvas.style.left = `${Math.max(0, Math.floor((rect.width - W) / 2))}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        resizeWorld(world, W, H);
        if (!world.stars.length)
            initStars(world);
        if (ownedRaceResize || spillResize)
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
        swipe = { owner: e.pointerId, x0: p.x, y0: p.y, t0: performance.now(), fired: false };
        // the field captures the pointer so a swipe that leaves the canvas
        // still lands; its tap is the same flap as everywhere else
        if (world.spill) {
            try {
                canvas.setPointerCapture(e.pointerId);
            }
            catch { /* browser cancelled the pointer */ }
        }
        // A tap is a tap everywhere, the corridor and the debris field
        // included. Hold-to-rise and slide-and-hold were flown against it and
        // retired - see the note in updateTunnel - so nothing intercepts this
        // any more. Hyper Run, the one hold-to-rise mode left, took the
        // race branch above.
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
        if (!swipe || swipe.owner !== e.pointerId || swipe.fired || world.screen !== "play" || world.flight === "tunnel")
            return;
        const p = pos(e);
        if (!world.spill && performance.now() - swipe.t0 > 320) {
            swipe = null;
            return;
        }
        // THE SPILL's swipes: RIGHT is the lunge, UP is the kick skyward, and
        // DOWN falls through to the dive below. Each is read against the
        // other axis so a diagonal goes to whichever way it mostly travelled.
        if (world.spill) {
            const dx = p.x - swipe.x0;
            const dy = p.y - swipe.y0;
            if (dx >= 40 && dx > Math.abs(dy)) {
                swipe.fired = true;
                if (spillLunge(world.spill))
                    sfx.near();
                notify();
                return;
            }
            if (dy <= -34 && -dy > Math.abs(dx)) {
                swipe.fired = true;
                if (spillBurstUp(world))
                    sfx.flap();
                notify();
                return;
            }
        }
        if (p.y - swipe.y0 >= 34) {
            swipe.fired = true;
            const ev = dive(world, save);
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
        // only the finger that owns the field's swipe can end it
        if (world.spill && swipe?.owner !== e.pointerId)
            return;
        swipe = null;
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    // A finger resting on the field is a long-press to the browser: without
    // these, phones answer it with text selection and the copy bubble over
    // the whole HUD.
    canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("selectstart", (e) => {
        const t = e.target;
        if (t?.closest?.("input, textarea"))
            return;
        e.preventDefault();
    });
    const DIVE_KEYS = new Set(["ArrowDown", "KeyS", "ControlLeft", "ControlRight"]);
    window.addEventListener("keydown", (e) => {
        // TYPING IS NOT FLYING. Space is the flap key, and this listener claimed
        // it globally with preventDefault - so pressing space in the pilot-name
        // box inserted nothing and, on the title screen, launched a run that
        // re-rendered the field and threw the typed name away. Any key aimed at
        // a text field belongs to that field. Checked on the focused element
        // rather than the event target so it holds however focus was reached.
        const focused = document.activeElement;
        if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA"
            || focused.isContentEditable)) {
            return;
        }
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
            // a key held down is one tap, never a stream of them - in the field
            // and, since 12 Sep 2026 (tap retrofit study), in ordinary flight too
            if (e.repeat && (world.spill || world.screen === "play"))
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
                    const ev = flap(world, save);
                    if (ev === "flap")
                        sfx.flap();
                }
            }
            else if (world.screen === "dead" && world.deadTimer > 0.55)
                engine.dismissDead();
            notify();
        }
        // DIVE KEYS (owner, 7 Sep 2026: "computer specific controls, like the
        // control key for swipe down"): ArrowDown, S, or either Control key
        if (DIVE_KEYS.has(e.code) && world.screen === "play" && world.race) {
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
        else if (DIVE_KEYS.has(e.code) && world.screen === "play" && world.flight !== "tunnel") {
            if (e.repeat)
                return;
            const ev = dive(world, save);
            if (ev === "dive")
                sfx.dive();
            notify();
        }
        // the Spill's extra keys: right (or D) for the lunge, W for the harder
        // kick skyward. Space is the tap and ArrowDown the dive, as everywhere
        if (world.spill && world.screen === "play" && !e.repeat) {
            if (e.code === "ArrowRight" || e.code === "KeyD") {
                e.preventDefault();
                engine.spillLunge();
            }
            else if (e.code === "KeyW") {
                e.preventDefault();
                if (spillBurstUp(world))
                    sfx.flap();
                notify();
            }
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
        }
        if (DIVE_KEYS.has(e.code)) {
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
        if ((world.race || world.spill) && world.screen === "play") {
            engine.pause();
            return;
        }
        cancelRaceControls();
        swipe = null;
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if ((world.race || world.spill) && world.screen === "play") {
                engine.pause();
                return;
            }
            cancelRaceControls();
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
    // THE SPILL's cues, once per frame. Tap and dive already sounded on the
    // pointer path, so they are skipped here; everything the field does on
    // its own - a hit, a shatter, a wave card, the Depot - sounds here, once
    // per kind per frame, so a PULSE through six rocks is one thud, not six.
    function dispatchSpillCues(cues) {
        if (!cues.length)
            return;
        const spill = world.spill;
        if (spill && cues.some(c => ["dead", "mission"].includes(c))) {
            bankSpill(save, spill, true);
            // AND THE BOARD HEARS ABOUT IT (App Store prep audit, section 2). The
            // "spill" board has been declared and configured since the shell
            // landed, and nothing ever posted to it: only endless free flight
            // reached submitScore (sim.ts). Waves cleared is the Debris Field's
            // own number - it is what the mode is scored on and what spillBest
            // already keeps - and higher is better, so it needs no special board.
            if (spill.cleared > 0)
                platform.submitScore("spill", spill.cleared);
            if (!spill.target)
                save.spillSuspended = null;
            writeSave(save);
        }
        else if (cues.includes("depot"))
            checkpointSpill();
        // one sound per SOUND per frame, not per cue: a hit and the shatter it
        // causes share the hull thud, a Depot-wave clear and its milestone share
        // the fanfare, and neither should play twice
        const sounds = new Set();
        let shouldNotify = false;
        // a graze is deliberately not a re-render: the play overlay is only the
        // two buttons and pause, and "charged" already relights PULSE
        const NOTIFY = ["hit", "hull", "charged", "pulse", "wave", "go", "dock", "depot", "armed",
            "depot-close", "buy", "deny", "respawn", "recharge", "mission", "contract", "dead"];
        // press and burst sound on the pointer path already
        const SOUND = {
            hit: "bounce", shatter: "bounce", ore: "acorn", gold: "gold", shield: "shield", hull: "region",
            graze: "near", pulse: "shift", count: "ui", go: "section", clear: "milestone", milestone: "milestone",
            dock: "region", depot: "region", buy: "ui", deny: "warning", respawn: "shift", surge: "warning",
            warn: "warning", event: "warning", contract: "milestone", mission: "milestone",
        };
        for (const c of new Set(cues)) {
            const snd = SOUND[c];
            if (snd)
                sounds.add(snd);
            if (NOTIFY.includes(c))
                shouldNotify = true;
        }
        for (const snd of sounds)
            sfx[snd]();
        if (shouldNotify)
            notify();
    }
    function checkpointSpill() {
        const spill = world.spill;
        if (!spill || spill.phase !== "depot")
            return;
        if (!spill.target && spill.wave === 20 && save.spillBest < 20)
            spill.firstPass = true;
        bankSpill(save, spill);
        if (!spill.target)
            save.spillSuspended = spillCheckpoint(spill);
        writeSave(save);
    }
    let nextSpillPaint = 0;
    function loop(now) {
        const frameDt = Math.min(0.25, (now - last) / 1000);
        noteFrameCost(now - last);
        last = now;
        if (world.spill) {
            const scene = engine.art.spillScene;
            world.spill.depotGagReady = vanguardDepotEligible(save.equippedSuit, !!save.motionOff, !!scene?.depot && scene?.bear?.length === 36 && !!scene?.vanguardDepot && !!engine.art.spillShip[`hull-${world.spill.up.plating}`]);
            if (save.motionOff && world.spill.depotGag)
                world.spill.depotGag = false;
        }
        // ONE FIXED 1/60 STEP FOR EVERY MODE. Race and Spill always ran here;
        // ordinary flight joined them on 12 Sep 2026 (tap retrofit study). It
        // used to integrate on the frame delta clamped to 33 ms, so a 120 Hz
        // phone and a 60 Hz phone flew slightly different arcs through the same
        // taps. A hitch replays up to the 0.25 s cap.
        // The Flight Test's transport scales the world clock here, ahead of
        // the accumulator, so a half-speed bench still steps whole 1/60 ticks
        // and a hold (0) steps none. Every other run feeds it 1.
        raceAccumulator += frameDt * (world.flightTest && world.screen === "play" ? world.timeScale : 1);
        while (raceAccumulator + 1e-12 >= 1 / 60) {
            // Race cues are drained after every authority step, not once per
            // render frame. This preserves simultaneous pass/debris feedback and
            // prevents high-refresh rendering from replaying audio side effects.
            const ev = updateWorld(world, save, 1 / 60);
            if (world.race)
                dispatchRaceCues(takeRaceCueEffects(world));
            else {
                dispatchWorldEvent(ev);
                dispatchSpillCues(takeSpillCues(world));
            }
            raceAccumulator -= 1 / 60;
            if (world.screen === "lvldone")
                break;
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
        // Keep authority/input at 60 Hz without painting duplicate frames on 120 Hz phones.
        if (world.spill && now + 0.5 < nextSpillPaint) {
            if (running)
                raf = requestAnimationFrame(loop);
            return;
        }
        if (world.spill) {
            // Carry the deadline across frames so 90/144 Hz displays do not fall to 45/48 fps.
            if (nextSpillPaint < now - 100)
                nextSpillPaint = now;
            do {
                nextSpillPaint += 1000 / 60;
            } while (nextSpillPaint <= now + 0.5);
        }
        else
            nextSpillPaint = 0;
        if (!world.spill || world.screen !== "play" && world.screen !== "pause" && world.screen !== "dead")
            hideBackplate();
        ctx.clearRect(0, 0, world.W, world.H);
        if (art) {
            if (world.screen === "play" || world.screen === "dead" || world.screen === "pause") {
                void loadZoneArt(art, world.envA);
                void loadZoneArt(art, world.envB);
                if (!world.lvl && !world.retro && !world.spill && !world.tunnel && !world.race)
                    void loadZoneArt(art, envIndexFor(world, world.score + ENV_GATES));
                drawWorld(ctx, world, save, art);
                if (world.screen !== "pause")
                    drawHud(ctx, world, art, save);
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
    // the roster's flight banks stream in one at a time afterwards. The pal
    // is named here for the same reason the suit is: it is the one the pilot
    // is looking at, so it is the one that must not arrive late.
    // LOGGING IN IS THE ACTION THE DAILY REWARDS, so it is banked here, once,
    // as the engine comes up - not on the walk to a storefront. claimDaily is
    // a no-op for a day already taken, so a reload never pays twice.
    claimDaily();
    // and anything the store still owes from a purchase that finished while
    // the app was away - again whenever the app comes back to the front
    void deliverPending();
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible")
            return;
        // AND THE DAY MAY HAVE TURNED WHILE WE WERE AWAY (audit, 8 Sep 2026).
        // An installed app is resumed far more often than it is launched, so a
        // pilot who never cold-starts was never paid and their streak broke on
        // its own. claimDaily is a no-op for a day already taken.
        claimDaily();
        void deliverPending();
    });
    // the switches that are not read from the save on the fly are applied
    // once here, so a reload lands in the state the pilot left
    setSfxMuted(!!save.sfxOff);
    document.body.classList.toggle("ac-nomotion", !!save.motionOff);
    setVanguardPitchTrim(suitPitchFor(save, "vanguard"));
    // the first flight is flown in AcorNut, so his bank rides the boot load
    // until the tutorial is done
    engine.artReady = loadArt(save.tutorialDone ? [save.equippedSuit] : [save.equippedSuit, TUTORIAL_SUIT], [save.equippedPal, save.equippedPal2])
        .then((bank) => {
        art = bank;
        engine.art = bank;
        void loadZoneArt(bank, world.envB).then(notify);
        if (world.spill)
            void loadSpillScene(bank, save.equippedSuit).then(notify);
        notify();
        prefetchArtBanks(bank);
    })
        .catch(() => { });
    notify();
    return engine;
}
export { deepUnlocked, lostUnlocked } from "./save.js?v=283";
