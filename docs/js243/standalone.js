import { suitPitchFor } from "./save.js?v=243";
import { platform } from "./platform.js?v=243";
import { spillAppearance } from "./spill-appearance.js?v=243";
import { trailWornBy, canWearTrail } from "./catalog.js?v=243";
import { PLANNED_STAR_REWARDS } from "./star-map-rewards.js?v=243";
import { addChartScenery } from "./star-map-view.js?v=243";
import { mapDebrisIndex } from "./zone-visuals.js?v=243";
import { missionCredit, verifiedMask, routeMasks, rewardId } from "./campaign-progress.js?v=243";
import { STAR_MAP_PREVIEW, suitPitchDefault, DUST_STICKER } from "./catalog.js?v=243";
import { suitLean } from "./control-constants.js?v=243";
import { CHART_LEVELS, CHART_MAX_STARS, nextLevel, levelAt, reachedGate, SUB_ACORNS } from "./campaign.js?v=243";
import { ART_VER, BUILD, ENVS, GUIDE_HELM, GUIDE_SUIT, HELMETS, HELMET_SHELF, SUIT_SHELF, IAP_ITEMS, IS_BETA, MOD_SHIELD_COST, MODS, NEWS, PALS, PHYS, SUITS, TRAILS, helmetWornBy, isIap, wearsOwnHead, BUNDLES, bundleIds, idDust, SET_TRAIL, SHOP_CYCLE, alaCarteTotal, featurePrice, OWN_HEAD_TAG, OWN_HEAD_LINE, DUST_PACKS, DAILY_DUST, DAILY_STREAK_BONUS, DAILY_STREAK_LEN, BOOSTS, BOOST_IDS } from "./catalog.js?v=243";
import { paintPortrait, paintTrailPreview, paintPalPreview, paintFlightPreview, paintShipPreview } from "./draw.js?v=243";
import { drawSprite as drawSpriteOn } from "./art.js?v=243";
import { createEngine } from "./engine.js?v=243";
import { dualPalUnlocked, equippedPals, deepUnlocked, helmetRevealed, lostUnlocked, palUnlocked, startShieldUnlocked, suitRevealed, starsOf, trailUnlocked, PILOT_NAME_MAX, boostReady, skipEligible, rewardOwned, ownsPremium } from "./save.js?v=243";
import { HYPER_RUN_MAX_ACORNS, HYPER_RUN_MISSION, STAR_REWARDS, STAR_UNLOCKS, countBits, fxText, goalText, levelUnlocked, starTitle, RACE_GATES } from "./campaign.js?v=243";
import { formatRaceTicks } from "./race.js?v=243";
import { SPILL_UTILITIES, SPILL_SPECIALTIES, spillMastery } from "./spill-content.js?v=243";
import { spillBuildFromState, spillBuildOre, spillPreviewState } from "./spill-presentation.js?v=243";
import { createDepotView, drawDepotWorkshop, drawSpillLaunchSetup, drawSpillStarters, drawSpillEnginePicker, drawSpillFlightHelp, drawSpillGuideSheet } from "./spill-workshop.js?v=243";
import { SPILL_SHOP, restoreSpill } from "./spill.js?v=243";
function el(tag, cls = "", text) {
    const n = document.createElement(tag);
    if (cls)
        n.className = cls;
    if (text)
        n.textContent = text;
    return n;
}
/** HOLD, DON'T TAP. A run ends on a tap, and the very next reflex tap
 *  landed on CONTINUE and spent the acorns before the pilot had read the
 *  screen - the owner watched himself buy a continue he never chose. A
 *  deliberate hold cannot be reached by reflex: the button fills while it
 *  is held down and only pays out when the fill completes, and letting go
 *  early costs nothing. Guard the SPEND, not the screen: a timed lockout
 *  would punish a pilot who did read it and wants straight back in.
 *
 *  Keyboard activation fires at once. A click with `detail === 0` came
 *  from Enter or Space, which is already a deliberate act on a device
 *  that has no reflex tap to guard against - and pointer presses never
 *  reach that path, because the pointerdown below cancels the click the
 *  browser would otherwise synthesise. */
function holdToFire(b, ms, fire) {
    let timer = 0;
    let fired = false;
    const stop = () => {
        if (timer) {
            clearTimeout(timer);
            timer = 0;
        }
        b.classList.remove("ac-holding");
    };
    b.style.setProperty("--ac-hold", `${ms}ms`);
    b.addEventListener("pointerdown", (e) => {
        if (fired || timer)
            return;
        e.preventDefault(); // no synthesised click, so the pointer path is hold-only
        b.classList.add("ac-holding");
        timer = window.setTimeout(() => {
            timer = 0;
            b.classList.remove("ac-holding");
            // a render in the meantime replaced this button; the pointer can no
            // longer cancel a detached one, so it must not fire either
            if (!b.isConnected)
                return;
            fired = true;
            fire();
        }, ms);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
        b.addEventListener(ev, stop);
    }
    b.addEventListener("click", (e) => {
        if (e.detail === 0 && !fired) {
            fired = true;
            fire();
        }
    });
}
/** One testable launch seam shared by the Hyper Run briefing CTA and its
 * fixed-step acceptance harness. Hyper Run ships on both pages now, so
 * this is no longer gated - the Modes entry always offers it. */
export function launchHyperRun(flyLevel) {
    return flyLevel(HYPER_RUN_MISSION.id);
}
export async function bootStandalone(root) {
    // WIDESCREEN MODE: the stage sheds its phone cap and the canvas takes
    // the whole window; DOM menus widen with it in landscape.
    document.body.classList.add("ac-wide");
    // the purple beta chrome: every menu greys toward violet
    document.body.classList.add("ac-beta");
    root.innerHTML = "";
    root.className = "ac-root";
    const stage = el("div", "ac-stage");
    const canvas = document.createElement("canvas");
    canvas.className = "ac-canvas";
    const overlay = el("div", "ac-overlay");
    // Held controls must survive HUD/menu re-renders without losing pointer capture.
    const spillControls = el("div", "ac-spillbar ac-spillcontrols");
    spillControls.hidden = true;
    spillControls.setAttribute("role", "group");
    spillControls.setAttribute("aria-label", "Debris Field flight controls");
    // The launch film lives on the STAGE, not in the overlay: render() clears
    // the overlay wholesale on every notify, and a film mounted inside it
    // would restart from frame one each time the engine so much as ticked.
    const filmHost = el("div", "ac-filmhost");
    stage.append(canvas, overlay, spillControls, filmHost);
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
    boot.append(el("p", "ac-fine ac-bootfine", BUILD));
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
    window.__sandbox = engine;
    engine.start();
    // The title picks ONE mode at a time: TAKE FLIGHT launches it, the
    // MODE bar cycles through the five. Selection lives here so it survives
    // a re-render of the title.
    // Specialized runs are deliberately NOT selectable by FREE FLIGHT.
    // WORMHOLE RUN and HYPER RUN are modes proper now, above the divider in
    // the Modes sheet, while external lab tools remain quieter doors.
    // EVERY way to fly is a MODE, and picking one only picks it. The sheet
    // used to launch Wormhole Run on contact while the other four toggled back
    // to the hub, so one row behaved unlike its neighbours and the ribbon
    // above TAKE FLIGHT went stale. One rule now: the sheet selects, TAKE
    // FLIGHT starts, and the only other launch in the game is a Star Chart
    // level starting itself.
    // WORMHOLE RUN IS NOT A MODE OF ITS OWN RIGHT NOW (owner, 2 Sep 2026).
    // The corridor already earns its keep as the WORMHOLE TRANSITION: fly
    // into a wormhole in Lost in Space and you fly the corridor, which is
    // the best thing it does and the place it is actually met. A row on the
    // sheet only offered a second, colder way in.
    //
    // HIDDEN, NOT DELETED, and deliberately so: the "tunnel" flight id, its
    // sim, its controls, its cues, its acceptance harness and the Star Chart
    // missions that fly it are all untouched and still reachable. Only the
    // row is gone, so bringing it back is this one flag and nothing else.
    const WORMHOLE_RUN_ON_SHEET = false;
    const ALL_MODES = [
        { id: "fly", label: "NORMAL", short: "NORMAL", blurb: "Standard gates and power-ups." },
        // THE THREE CORE MODES COME FIRST (owner, 8 Sep 2026: "the three core
        // modes are first. The other three are just mods in a way"). Debris
        // Field keeps its "spill" id everywhere below the label: saves, the
        // leaderboard, the Star Chart rows.
        { id: "spill", label: "DEBRIS FIELD", short: "DEBRIS", blurb: "Wave survival. Upgrade your ship. Survive the dangers of space." },
        { id: "race", label: "HYPER RUN", short: "HYPER", blurb: "Thread gates. Center the wormhole rings." },
        { id: "deep", label: "DEEP SPACE", short: "DEEP", blurb: "Endless back-to-back black holes." },
        { id: "lost", label: "LOST IN SPACE", short: "LOST", blurb: "Space is in control here." },
        { id: "arcade", label: "ARCADE", short: "ARCADE", blurb: "2x power-ups, arcade graphics." },
        { id: "tunnel", label: "WORMHOLE RUN", short: "WORMHOLE", blurb: "Hold to thrust down the corridor." },
    ];
    const MODES = ALL_MODES.filter((m) => m.id !== "tunnel" || WORMHOLE_RUN_ON_SHEET);
    /** Start whatever is selected. Hyper Run opens its briefing first - it
     *  teaches two controls the other modes do not use, and that briefing is
     *  the same one the debris field opens. */
    function launchSelected() {
        const m = MODES[selectedMode] ?? MODES[0];
        if (m.id === "race") {
            // HELP OFF: the briefing is a lesson, and the switch says no lessons.
            // Launch straight from the sheet; the briefing stays one tap away on
            // the chart for anyone who wants to re-read it.
            if (engine.save.helpOff) {
                modesOpen = false;
                if (!launchHyperRun((id) => engine.flyLevel(id)))
                    hyperRunOpen = true;
                render();
                return;
            }
            modesOpen = false;
            hyperRunOpen = true;
            render();
            return;
        }
        if (m.id === "spill" && engine.save.spillSuspended) {
            modesOpen = false;
            engine.spillResume();
            return;
        }
        engine.fly(m.id);
    }
    let selectedMode = 0;
    // BUG: every re-render rebuilt the overlay from scratch, so buying or
    // equipping something near the bottom of the hangar threw you back to
    // the top. Remember where the list was and put it back after the swap.
    // The hangar's sideways shelves have the same problem in the other
    // axis — tapping a card rebuilt every row at its start — so each row's
    // scrollLeft is kept by index and restored after the swap too.
    let keptScroll = 0;
    let keptRowScroll = [];
    let shelfKey = ""; // which tab the kept rows belong to
    let keptScrollKey = ""; // which screen the kept scroll belongs to
    let lastScrollKey = ""; // the screen the last render painted
    let cardFocus = ""; // the Loadout control the keyboard was on
    const keepShelves = () => {
        keptRowScroll = [...overlay.querySelectorAll(".ac-shelfrow")].map((r) => r.scrollLeft);
    };
    const restoreShelves = () => {
        [...overlay.querySelectorAll(".ac-shelfrow")].forEach((r, i) => {
            if (keptRowScroll[i])
                r.scrollLeft = keptRowScroll[i];
        });
    };
    let disposeChart = () => { };
    let throttleOwner = null;
    const throttle = el("button", "ac-throttle");
    const diveButton = el("button", "ac-dive");
    const lungeButton = el("button", "ac-lunge");
    throttle.append(el("b", "", "▲ THROTTLE"), el("span", "", "HOLD TO RISE"));
    diveButton.append(el("b", "", "▼ DIVE"), el("span", "", "TAP TO DESCEND"));
    const lungeStatus = el("span");
    lungeButton.append(el("b", "", "▶ LUNGE"), el("span", "", "FORWARD DASH"), lungeStatus);
    throttle.setAttribute("aria-label", "Throttle: hold to rise, release to fall");
    diveButton.setAttribute("aria-label", "Dive: downward burst");
    for (const b of [throttle, diveButton, lungeButton]) {
        b.addEventListener("keydown", e => { if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Enter")
            e.stopPropagation(); });
        b.addEventListener("keyup", e => { if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Enter")
            e.stopPropagation(); });
        b.addEventListener("contextmenu", e => e.preventDefault());
    }
    const releaseThrottle = () => {
        const owner = throttleOwner;
        throttleOwner = null;
        engine.spillThrottle(false);
        throttle.classList.remove("held");
        throttle.setAttribute("aria-pressed", "false");
        if (typeof owner === "number")
            try {
                throttle.releasePointerCapture(owner);
            }
            catch { /* already cancelled */ }
    };
    throttle.onpointerdown = e => {
        if (throttleOwner !== null || (e.pointerType === "mouse" && e.button !== 0))
            return;
        e.preventDefault();
        throttleOwner = e.pointerId;
        try {
            throttle.setPointerCapture(e.pointerId);
        }
        catch { /* release also watched on window */ }
        engine.spillThrottle(true);
        updateSpillControls();
    };
    const endThrottle = (e) => { if (throttleOwner === e.pointerId)
        releaseThrottle(); };
    throttle.addEventListener("lostpointercapture", endThrottle);
    window.addEventListener("pointerup", endThrottle);
    window.addEventListener("pointercancel", endThrottle);
    throttle.onkeydown = e => {
        if (!["Space", "Enter"].includes(e.code))
            return;
        e.preventDefault();
        if (e.repeat || throttleOwner !== null)
            return;
        throttleOwner = e.code;
        engine.spillThrottle(true);
        updateSpillControls();
    };
    throttle.onkeyup = e => { if (throttleOwner === e.code) {
        e.preventDefault();
        releaseThrottle();
    } };
    throttle.onblur = () => { if (typeof throttleOwner === "string")
        releaseThrottle(); };
    // Click-only assistive input can toggle the same throttle; keyboard/pointer holds suppress their native click.
    throttle.onclick = e => {
        if (e.detail === 0) {
            if (throttleOwner !== null)
                releaseThrottle();
            else {
                throttleOwner = "assistive";
                engine.spillThrottle(true);
                updateSpillControls();
            }
        }
    };
    diveButton.onclick = () => engine.spillDive();
    lungeButton.onclick = () => engine.spillLunge();
    spillControls.append(throttle, diveButton, lungeButton);
    function updateSpillControls() {
        const sp = engine.world.spill;
        const visible = engine.world.screen === "play" && sp && !engine.save.spillButtonsOff
            && ["countdown", "wave", "drain"].includes(sp.phase);
        spillControls.hidden = !visible;
        if (!visible) {
            if (throttleOwner !== null)
                releaseThrottle();
            return;
        }
        const manual = sp.phase !== "countdown" || sp.manual;
        diveButton.disabled = !manual;
        lungeButton.disabled = !manual || sp.lungeCharges <= 0;
        lungeButton.classList.toggle("spent", lungeButton.disabled);
        const cap = sp.up.thrusters >= 2 ? 2 : 1;
        lungeStatus.textContent = sp.lungeCharges ? `${sp.lungeCharges}/${cap} READY` : "RECHARGING";
        lungeButton.setAttribute("aria-label", `Lunge: forward dash, ${sp.lungeCharges} of ${cap} charges ready`);
        throttle.classList.toggle("held", throttleOwner !== null && sp.held);
        throttle.setAttribute("aria-pressed", String(throttleOwner !== null && sp.held));
    }
    const paint = () => {
        disposeChart();
        disposeChart = () => { };
        updateSpillControls();
        const snap = engine.snap();
        const prevScroll = overlay.querySelector(".ac-sheet-scroll");
        // A KEPT SCROLL BELONGS TO THE SCREEN IT CAME FROM (audit, Sep 2026).
        // The capture below runs whatever screen is leaving, and the Shop and
        // the Loadout put it back without ever asking where it came from - so
        // a reward tapped high on a nine-thousand-pixel chart opened the Shop
        // clamped to its bottom, on the real-money rows, instead of at the
        // boost the pilot had just been sent to buy. The scroll now carries
        // the key of the screen it was lifted from and goes back on that one
        // only; a Loadout tab counts as its own screen for the same reason.
        const scrollKey = `${snap.screen}:${engine.shopTab}`;
        if (prevScroll) {
            keptScroll = prevScroll.scrollTop;
            keptScrollKey = lastScrollKey;
        }
        lastScrollKey = scrollKey;
        // a screen that asked to land on the pilot drops the scroll the last
        // screen left behind (the Shop's, after a boost purchase)
        if (landOnPilot) {
            keptScroll = 0;
            landOnPilot = false;
        }
        keepShelves();
        const oldGuide = !!overlay.querySelector(".ac-depotguidecard");
        const depotScroll = overlay.querySelector(".ac-depotcard")?.scrollTop ?? 0;
        const setupScroll = overlay.querySelector(".ac-spillsetup")?.scrollTop ?? 0;
        const setupActive = document.activeElement;
        const setupFocus = setupActive?.dataset.shipStarter ? `[data-ship-starter="${setupActive.dataset.shipStarter}"]`
            : setupActive?.dataset.shipColor ? `[data-ship-color="${setupActive.dataset.shipColor}"]` : "";
        const depotFocus = document.activeElement?.dataset.spillControl;
        if (snap.screen !== "help" && !(snap.screen === "play" && engine.world.spill?.phase === "ready"))
            spillHelpOpen = false;
        // the same trick the Depot has always used, for the Loadout: the card
        // that was just used gets the keyboard back after the rebuild
        cardFocus = document.activeElement?.dataset.focus ?? "";
        overlay.innerHTML = "";
        // an armed boost card asks "are you sure" for THIS visit only: leaving
        // the Shop disarms it, so coming back never spends dust on one tap
        if (snap.screen !== "shop")
            boostConfirm = null;
        // AN OPEN PACK SHEET DOES NOT FOLLOW YOU OUT (audit, Sep 2026). The
        // header arrow - and the Android hardware back that taps it - leaves
        // the Shop with the sheet still flagged open, so every later visit
        // opened on that pack, and on a later cycle day it was still offering
        // yesterday's bundle at the featured half price. It leaves with the
        // screen, the same way the armed boost card does.
        // (the plain pack sheet used to be reset here too - it sits below
        // drawShop's unconditional `return drawShopBeta()` and cannot be opened)
        if (snap.screen !== "shop") {
            featureOpen = null;
            confirmBuy = false;
        }
        if (snap.screen === "play") {
            const bar = el("div", "ac-playbar");
            // A FIRST FLIGHT YOU CAN LEAVE. A tutorial with no exit is a trap for
            // anyone who already knows how to play, or who hits a lesson that is
            // not landing - and the first flight is exactly where a beginner is
            // most likely to be stuck and least likely to know it is skippable.
            // Skipping still hands over the suit and helmet it would have given.
            if (engine.world.tut) {
                // THE FINISH IS A DOOR, NOT A DISMISSAL. Reaching the portal earns
                // the walk to the Loadout, so the last beat replaces SKIP with the
                // way onward - the pilot who flew it should not be offered an exit
                // that reads like giving up.
                if (engine.world.tut.stage === "done") {
                    // lit like every other guided step, because it IS one - the walk
                    // to the Loadout starts here and a flat button read as optional
                    const go = el("button", "ac-primary ac-tutskip ac-pulse ac-guidetarget", "EXIT TO LOADOUT");
                    go.setAttribute("aria-label", "Collect your reward in the Loadout");
                    go.onclick = () => engine.finishTutorial();
                    bar.append(go);
                }
                else {
                    const skip = el("button", "ac-ghost ac-tutskip", "SKIP");
                    skip.setAttribute("aria-label", "Skip the first flight");
                    skip.onclick = () => engine.skipTutorial();
                    bar.append(skip);
                }
            }
            const pause = el("button", "ac-iconbtn", "II");
            pause.onclick = () => engine.pause();
            bar.append(pause);
            overlay.append(bar);
            // THE SPILL's LUNGE button rides the bottom-right corner for anyone
            // who misses the swipe. When the Depot is open it takes the screen.
            const sp = engine.world.spill;
            if (sp) {
                if (sp.phase === "depot") {
                    overlay.append(drawDepot(sp));
                    const depot = overlay.querySelector(".ac-depotcard");
                    const guideChanged = oldGuide !== !!overlay.querySelector(".ac-depotguidecard");
                    if (depot) {
                        depot.scrollTop = guideChanged ? 0 : depotScroll;
                        if (guideChanged) {
                            depot.tabIndex = -1;
                            depot.focus({ preventScroll: true });
                        }
                        else if (depotFocus)
                            overlay.querySelector(`[data-spill-control="${depotFocus}"]`)?.focus({ preventScroll: true });
                    }
                    return;
                }
                if (sp.phase === "ready" && !sp.target) {
                    const setup = drawSpillPrep();
                    overlay.append(setup);
                    setup.scrollTop = setupScroll;
                    if (setupFocus)
                        setup.querySelector(setupFocus)?.focus({ preventScroll: true });
                    if (spillHelpOpen)
                        overlay.append(spillHelpSheet());
                    return;
                }
                if (sp.phase === "docking")
                    return;
                // The persistent button layer handles flight; Pulse fires automatically.
            }
            return;
        }
        if (snap.screen === "pause") {
            const sheet = el("div", "ac-sheet ac-center ac-pausesheet");
            // THE PITCH DIAL (owner: "keep the tool in for all suits, only in
            // beta"): the worn suit's forward lean, tuned mid-flight.
            if (IS_BETA)
                sheet.append(suitPitchDial(engine.world.tutSuit ? "vanguard" : engine.save.equippedSuit));
            // THE FLIGHT LAB (owner, 7 Sep 2026): free flight only, beta only
            if (IS_BETA && engine.world.flight === "fly" && !engine.world.lvl && !engine.world.tut && !engine.world.race && !engine.world.spill)
                sheet.append(flightLab());
            sheet.append(el("h2", "", "PAUSED"), el("p", "ac-sub", engine.world.race ? `TIME ${formatRaceTicks(engine.world.race.tick)}`
                : engine.world.spill ? `WAVE ${engine.world.spill.wave} · ${engine.world.spill.ore} ACORN COINS`
                    : `Score ${engine.world.score}`));
            if (engine.world.spill) {
                const settings = el("section", "ac-spillsettings");
                settings.append(el("h3", "", "Flight controls"));
                const option = (label, detail, on, hit) => {
                    const b = el("button", "ac-spillsetting");
                    b.setAttribute("role", "switch");
                    b.setAttribute("aria-label", label);
                    b.setAttribute("aria-checked", String(on));
                    b.addEventListener("keydown", e => e.stopPropagation());
                    b.addEventListener("keyup", e => e.stopPropagation());
                    const text = el("span");
                    text.append(el("b", "", label), el("small", "", detail));
                    b.append(text, el("strong", "", on ? "ON" : "OFF"));
                    b.onclick = hit;
                    settings.append(b);
                    return b;
                };
                option("On-screen buttons", "Throttle, Dive and Lunge. Gestures also work.", !engine.save.spillButtonsOff, () => engine.setSpillButtonsOff(!engine.save.spillButtonsOff));
                const prompts = option("Instructional prompts", engine.save.helpOff ? "Help is disabled in Settings." : "Control tips and wave lessons. Hazard warnings stay visible.", !engine.save.spillPromptsOff && !engine.save.helpOff, () => engine.setSpillPromptsOff(!engine.save.spillPromptsOff));
                prompts.disabled = !!engine.save.helpOff;
                settings.append(el("p", "ac-sub", "Hold Throttle to rise; release to fall. Dive gives a downward burst. Lunge dashes forward and recharges."));
                sheet.append(settings);
            }
            // THE WAY OUT IS PINNED. With the calibration panel open this sheet runs
            // past 940px on a phone, and .ac-sheet is a fixed-height centred column
            // - so it spilled off BOTH ends and took RESUME with it. You could read
            // every dial and not leave. These two now sit in a sticky footer that
            // cannot scroll away, whatever is above them.
            const act = el("div", "ac-pauseact");
            const resume = el("button", "ac-primary", "RESUME");
            resume.onclick = () => engine.resume();
            const abort = el("button", "ac-ghost", "ABORT TO TITLE");
            abort.onclick = () => engine.open("title");
            // A MISSION CAN START OVER FROM THE PAUSE. Owner's call: a pilot two
            // gates into a ruined three-star attempt should not have to abort to
            // the title and walk the chart back in. Same level, fresh run, no
            // loss recorded - the pause simply becomes the launch.
            if (engine.world.lvl) {
                const restart = el("button", "ac-ghost ac-restart", "RESTART LEVEL");
                restart.onclick = () => engine.restartLevel();
                act.append(resume, restart, abort);
            }
            else
                act.append(resume, abort);
            sheet.append(act);
            overlay.append(sheet);
            return;
        }
        if (snap.screen === "dead" && snap.dead) {
            const sheet = el("div", "ac-sheet ac-center ac-result");
            const spill = snap.flight === "spill" ? engine.world.spill : null;
            sheet.append(el("h2", "", snap.flight === "tunnel" ? "LOST TO THE VOID"
                : spill ? (spill.cause === "GROUNDED" ? "OUT OF HEALTH" : "LOST TO THE FIELD")
                    : "CRASHED"));
            if (snap.flight === "tunnel") {
                sheet.append(el("p", "", `Score ${snap.dead.score}`));
            }
            if (snap.dead.best && snap.dead.score > 0)
                sheet.append(el("p", "ac-gold", "NEW BEST"));
            if (spill) {
                // THE SPILL's receipt: waves as the headline, then what the run
                // mined and took. Acorn Coins stays here - it never reaches the wallet.
                const big = el("div", "ac-crashscore");
                big.append(el("b", "", String(snap.dead.score)), el("span", "", snap.dead.score === 1 ? "WAVE CLEARED" : "WAVES CLEARED"));
                sheet.append(big);
                if (spill.cause === "GROUNDED")
                    sheet.append(el("p", "ac-sub", "You ran out of health at the lower edge."));
                const rows = el("div", "ac-rows ac-crashrows");
                const row = (label, v, gold = false) => {
                    const r = el("div", "ac-row");
                    r.append(el("span", "", label), el("span", gold ? "ac-rowgold" : "ac-rowdim", String(v)));
                    rows.append(r);
                };
                row("Salvage score", Math.floor(spill.score), true);
                row("Acorn Coins mined", spill.oreMined, true);
                row("Contracts completed", spill.contractsDone);
                row("Health hits", spill.hits);
                row("Grazes", spill.grazes);
                row("Debris shattered", spill.shattered);
                row("Best wave", engine.save.spillBest ?? 0, true);
                row("Best salvage score", engine.save.spillRecords?.bestScore ?? 0);
                sheet.append(rows);
                const mastery = spillMastery(engine.save.spillBest);
                sheet.append(el("p", "ac-sub", `LAST RUN · Health upgrades ${spill.up.plating} · Thrusters ${spill.up.thrusters} · Pulse ${spill.up.pulse}`), el("p", "ac-sub", spill.utilities.map(id => SPILL_UTILITIES[id].name).join(" + ") || "Stock utilities"), el("p", "ac-gold", mastery.current.title), el("p", "ac-sub", mastery.next ? `Next: clear wave ${mastery.next.at} for ${mastery.next.title} and a new engine color.` : "Every engine color earned. Beat your best wave."));
                // Graduation lands on whichever crash comes first after the
                // tutorial, this one included: the gift is shown where it is given
                if (engine.save.guide === "reward")
                    sheet.append(graduationGift());
                const again = el("button", engine.save.guide === "reward" ? "ac-ghost" : "ac-primary", "CHOOSE SHIP & FLY AGAIN");
                again.onclick = () => engine.fly("spill");
                const menu = el("button", engine.save.guide === "reward" ? "ac-primary" : "ac-ghost", engine.save.guide === "reward" ? "COLLECT" : "MAIN MENU");
                menu.onclick = () => engine.dismissDead();
                sheet.append(engine.save.guide === "reward" ? menu : again, engine.save.guide === "reward" ? again : menu);
                overlay.append(sheet);
                return;
            }
            if (snap.flight === "tunnel") {
                const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
                sheet.append(el("p", "ac-sub", `${count(snap.dead.acorns, "acorn")} · ${count(snap.dead.sections, "section")}`), el("p", "ac-sub", `Best Flow ×${snap.dead.bestMultiplier} · Best chain ${snap.dead.bestChain} · ${count(snap.dead.nearMisses, "near miss")}`));
            }
            // XP is retired from the player's view — the Star Chart is the
            // ladder now, and stars are earned in levels, not by crashing here
            if (snap.flight === "tunnel") {
                const replay = el("button", "ac-primary", "FLY AGAIN");
                replay.onclick = () => engine.fly("tunnel");
                const go = el("button", "ac-ghost", "CONTINUE");
                go.onclick = () => engine.dismissDead();
                sheet.append(replay, go);
            }
            else {
                // The crash sheet is a receipt now: the run's whole story in
                // rows — gates as the headline, then what happened on the way.
                const d = snap.dead;
                const big = el("div", "ac-crashscore");
                big.append(el("b", "", String(d.score)), el("span", "", d.score === 1 ? "GATE CLEARED" : "GATES CLEARED"));
                sheet.append(big);
                const s = engine.save;
                const hs = snap.flight === "deep" ? s.deepBest
                    : snap.flight === "lost" ? s.lostBest
                        : snap.flight === "arcade" ? (s.arcadeBest ?? 0)
                            : s.highScore;
                const rows = el("div", "ac-rows ac-crashrows");
                const row = (label, v, gold = false) => {
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
                // THE AD SLOT, PAID IN ACORNS FOR NOW - the owner's stand-in for
                // the rewarded revive: 10 acorns to fly on, 50 past gate 100. The
                // wallet already holds this run's acorns (the crash banks before
                // this sheet opens), so a good run usually funds its own continue.
                // Not offered over the graduation gift - a brand-new pilot's first
                // crash is the gear moment, not a paywall.
                if (engine.save.guide !== "reward") {
                    const cost = engine.continueCost();
                    const funds = engine.save.acorns ?? 0;
                    if (funds >= cost) {
                        const cont = el("button", "ac-primary ac-continue ac-holdbtn", `HOLD TO CONTINUE — ${cost} ACORNS`);
                        holdToFire(cont, 550, () => engine.continueRun());
                        sheet.append(cont);
                    }
                    else {
                        sheet.append(el("p", "ac-sub ac-continue-short", `Continue costs ${cost} acorns — you have ${funds}`));
                    }
                }
                const again = el("button", engine.save.guide !== "reward" && (engine.save.acorns ?? 0) >= engine.continueCost() ? "ac-ghost" : "ac-primary", "TRY AGAIN");
                again.onclick = () => engine.fly(snap.flight);
                const menu = el("button", "ac-ghost", engine.save.guide === "reward" ? "COLLECT" : "MAIN MENU");
                menu.onclick = () => engine.dismissDead();
                sheet.append(again, menu);
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
            if (sc && keptScroll && keptScrollKey === scrollKey)
                sc.scrollTop = keptScroll;
            // put the sideways shelves back where they were — but only when the
            // rebuilt rows are the same tab's rows; a fresh tab starts at its front
            const key = `hangar:${engine.shopTab}`;
            if (shelfKey === key)
                restoreShelves();
            shelfKey = key;
            return;
        }
        if (snap.screen === "log") {
            overlay.append(drawLog());
            // land the chart on the level you're ON: the map climbs, so a fresh
            // chapter opens at its locked top unless we scroll to the pilot
            const sc = overlay.querySelector(".ac-sheet-scroll");
            if (sc) {
                if (keptScroll && keptScrollKey === scrollKey) {
                    sc.scrollTop = keptScroll;
                }
                else {
                    const cur = sc.querySelector("[data-blocking-barrier], .ac-mapnode.cur");
                    if (cur)
                        cur.scrollIntoView({ block: "center" });
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
            if (sc && keptScroll && keptScrollKey === scrollKey)
                sc.scrollTop = keptScroll;
            return;
        }
        if (snap.screen === "scores") {
            overlay.append(drawScores());
            return;
        }
        if (snap.screen === "help") {
            overlay.append(drawHelp());
            const sc = overlay.querySelector(".ac-sheet-scroll");
            if (sc && keptScrollKey === scrollKey)
                sc.scrollTop = keptScroll;
            if (spillHelpOpen)
                overlay.append(spillHelpSheet());
        }
    };
    /** WHAT HAS TO HOLD ACROSS THE REBUILD (audit, Sep 2026). The overlay is
     *  wiped on every notify, and the keyboard went with it: a sheet opened
     *  behind ~130 map nodes without ever taking focus, those nodes stayed
     *  tabbable and Enter-able UNDER the open sheet, and every equip on the
     *  Loadout dropped the pilot back to <body>. A sheet is a modal, so the
     *  screen behind it stops answering and its card takes the focus as the
     *  dialog it already looks like. This runs after the paint because every
     *  screen branch returns early from it. */
    const settle = () => {
        // the Depot wears the same sheet class but IS the screen while a run
        // is paused in it, and it already places its own focus - leave it be
        const sheets = overlay.querySelectorAll(".ac-lvlsheet:not(.ac-depotwrap), .ac-spillhelpwrap");
        const top = sheets[sheets.length - 1];
        if (!top) {
            if (cardFocus)
                overlay.querySelector(`[data-focus="${cardFocus}"]`)?.focus({ preventScroll: true });
            return;
        }
        const box = top.parentElement;
        if (box) {
            for (const sib of [...box.children])
                if (sib !== top)
                    sib.setAttribute("aria-hidden", "true");
            // NOT `inert`: the Android shell's hardware back taps the header
            // arrow with .click(), and an inert arrow would answer nothing at
            // all. Taking the page behind out of the tab order does the job the
            // sheet needs without silencing that door.
            for (const f of box.querySelectorAll("button, a[href], input, select, textarea, [tabindex]")) {
                if (!top.contains(f))
                    f.tabIndex = -1;
            }
        }
        const card = top.firstElementChild;
        if (!card)
            return;
        if (!card.getAttribute("role"))
            card.setAttribute("role", "dialog");
        card.setAttribute("aria-modal", "true");
        card.tabIndex = -1;
        card.focus({ preventScroll: true });
    };
    const render = () => { paint(); settle(); };
    const SVG = "http://www.w3.org/2000/svg";
    function icon(d, size = 20, fill = false) {
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", `${size}`);
        svg.setAttribute("height", `${size}`);
        svg.setAttribute("aria-hidden", "true");
        if (fill) {
            svg.setAttribute("fill", "currentColor");
        }
        else {
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
    const I_HELP = [
        "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z",
        "M9.7 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 1.9-2.3 3.3",
        "M12 16.8h.01",
    ];
    // The acorn silhouette.
    const I_ACORN = [
        "M13.5 2.2a.75.75 0 0 1 .5 1.3c-.75.55-1.1 1.1-1.2 1.7 3.9.25 6.8 2.05 6.8 3.6 0 .8-.7 1.45-1.6 1.45H6c-.9 0-1.6-.65-1.6-1.45 0-1.6 2.95-3.4 6.85-3.6.1-1.05.75-1.95 1.9-2.7a.75.75 0 0 1 .35-.3z",
        "M6.2 11.5h11.6c0 4.8-2.05 9.3-5.15 11.4a1 1 0 0 1-1.3 0C8.25 20.8 6.2 16.3 6.2 11.5z",
    ];
    const I_CHEV = ["m9 5 7 7-7 7"];
    const I_BACK = ["m15 5-7 7 7 7"];
    // STAR DUST. Four points, the vertical pair longer than the horizontal
    // and the waist pinched in, so it reads as the cut crystal rather than
    // as the flat five-point star already used for chart progress.
    const I_DUST = ["M12 2.2 13.9 9 20.4 12 13.9 15 12 21.8 10.1 15 3.6 12 10.1 9z"];
    // The Discord wordmark's face, drawn rather than linked so it needs no
    // network round trip and inherits currentColor like every other icon here.
    const I_DISCORD = ["M20.317 4.492a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.492a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.061.061 0 0 0-.031-.03zM8.02 15.278c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"];
    const I_EDIT = [
        "M4 20.4h4.2L19 9.6a2.1 2.1 0 0 0 0-3l-1.6-1.6a2.1 2.1 0 0 0-3 0L3.6 15.8z",
        "M13.4 6.2 17.8 10.6",
    ];
    const I_X = ["M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"];
    const I_MAIL = ["M3.4 6.6h17.2v10.8H3.4z", "m3.8 7.2 8.2 6 8.2-6"];
    // I_NUT (the line-drawn cup) retired 8 Sep 2026: every acorn count now wears acornImg().
    const I_LOCK = ["M6 11h12v9H6z", "M9 11V8a3 3 0 0 1 6 0v3"];
    // Every menu wears the same head: a kicker, the screen's name, and
    // whichever counter that screen is actually about.
    function header(kicker, title, aside) {
        const h = el("header", "ac-menuhead");
        // hub-and-spoke: there is no tab bar, so every menu carries its own
        // door back to the hub
        const back = el("button", "ac-backbtn");
        back.setAttribute("aria-label", "Back to home");
        back.append(icon(I_BACK, 20));
        // THE NEXT STEP IS BEHIND THIS DOOR. Once the pilot is suited up the
        // walk continues on the Star Chart, which lives on the hub - so the
        // way out is the instruction, and it says so instead of sitting there
        // looking like every other back arrow.
        if (engine.save.guide === "levels" && engine.world.screen === "hangar") {
            back.classList.add("ac-pulse", "ac-guidetarget");
        }
        back.onclick = () => engine.open("title");
        h.append(back);
        const t = el("div", "ac-menuheadtext");
        t.append(el("p", "ac-kicker", kicker), el("h2", "ac-menutitle", title));
        h.append(t);
        if (aside)
            h.append(aside);
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
    /** THE ACORN ITSELF (owner, 8 Sep 2026: "we need to use the acorn... The
     *  drawn version, it's very confusing what the number is, or why it's
     *  there. It doesn't align with the game"). The line-drawn cup read as a
     *  bucket next to a number; this is the pickup the pilot has been
     *  catching all run, so the price reads as the thing it costs. */
    let acornIconN = 0;
    function acornImg(px) {
        // THE CURRENCY ACORN (owner's pick, 8 Sep 2026: the warm gold body under
        // a brown scalloped cap - "simple shape, high contrast, recognizable at
        // small sizes"). Drawn as a vector so 13px and 22px are both crisp; the
        // in-run pickup sprite went muddy at price-tag size on the purple cards.
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", `${px}`);
        svg.setAttribute("height", `${px}`);
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("class", "ac-nutimg");
        const uid = `acnut${++acornIconN}`;
        const defs = document.createElementNS(SVG, "defs");
        const grad = (id, stops, x2 = "0", y2 = "1") => {
            const g = document.createElementNS(SVG, "linearGradient");
            g.setAttribute("id", id);
            g.setAttribute("x1", "0");
            g.setAttribute("y1", "0");
            g.setAttribute("x2", x2);
            g.setAttribute("y2", y2);
            for (const [off, col] of stops) {
                const st = document.createElementNS(SVG, "stop");
                st.setAttribute("offset", off);
                st.setAttribute("stop-color", col);
                g.append(st);
            }
            defs.append(g);
        };
        grad(`${uid}b`, [["0", "#ffbe45"], ["0.55", "#f39a1c"], ["1", "#c9660c"]], "0.35", "1");
        grad(`${uid}c`, [["0", "#b0713a"], ["1", "#6a3a12"]]);
        svg.append(defs);
        const path = (d, fill, extra) => {
            const p = document.createElementNS(SVG, "path");
            p.setAttribute("d", d);
            p.setAttribute("fill", fill);
            for (const [k, v] of Object.entries(extra ?? {}))
                p.setAttribute(k, v);
            svg.append(p);
        };
        // body: a plump nut with a soft point; a thin dark edge keeps the
        // orange separate from the gold price tag it usually sits on
        path("M5.2 10.6h13.6c0 5.3-2.6 9.6-6.8 12.3C7.8 20.2 5.2 15.9 5.2 10.6z", `url(#${uid}b)`, { stroke: "rgba(70,30,0,.6)", "stroke-width": "0.9" });
        // body sheen on the left shoulder
        path("M7.6 12.4c.3 3.1 1.8 5.8 4 7.7", "none", { stroke: "rgba(255,240,200,.6)", "stroke-width": "1.4", "stroke-linecap": "round" });
        // cap: the dome and its scalloped brim
        path("M4.4 9.8c0-3.6 3.5-6.2 7.6-6.2s7.6 2.6 7.6 6.2v.4c-.9-.8-1.6-.8-2.5 0-.9-.8-1.6-.8-2.5 0-.9-.8-1.6-.8-2.5 0-.9-.8-1.6-.8-2.5 0-.9-.8-1.6-.8-2.5 0-.9-.8-1.6-.8-2.7 0z", `url(#${uid}c)`, { stroke: "rgba(50,22,0,.55)", "stroke-width": "0.7" });
        // the scales: two rows of little arcs, the texture the owner's icon wears
        path("M6.2 8.2c.9-.8 1.6-.8 2.5 0 .9-.8 1.6-.8 2.5 0 .9-.8 1.6-.8 2.5 0 .9-.8 1.6-.8 2.5 0 .9-.8 1.6-.8 2.4 0M7.6 6.4c.9-.8 1.6-.8 2.5 0 .9-.8 1.6-.8 2.5 0 .9-.8 1.6-.8 2.5 0 .9-.8 1.5-.8 2.3 0", "none", { stroke: "rgba(40,18,0,.4)", "stroke-width": "0.8", "stroke-linecap": "round" });
        path("M6.8 8.1c.5-1.9 2.3-3.2 4.6-3.5", "none", { stroke: "rgba(255,220,170,.4)", "stroke-width": "1", "stroke-linecap": "round" });
        // stem
        path("M10.9 1.4h2.2a.6.6 0 0 1 .6.6v2.5h-3.4V2a.6.6 0 0 1 .6-.6z", "#8a4f1c", { stroke: "rgba(40,18,0,.5)", "stroke-width": "0.6" });
        return svg;
    }
    /** a number that is a PRICE, never a bare integer. A card reading "70"
     *  says nothing about which purse it wants, and next to a card reading
     *  "OWNED" it reads like a score. */
    function costTag(n) {
        const w = el("span", "ac-costtag");
        w.append(acornImg(14), el("b", "", n.toLocaleString()));
        return w;
    }
    /** ONE TAP USED TO SPEND IT (owner, 8 Sep 2026: "tapping it shouldn't
     *  auto unlock it, a pop up, 'Spend X acorns to unlock Y?'... you can
     *  accidentally buy it way too easy"). Every acorn price on the loadout
     *  goes through here: owned or free, the tap equips as before; priced
     *  and affordable, it asks first and the sheet's SPEND commits; priced
     *  and short, the card shakes with the deny line as it always did. */
    let spendAsk = null;
    function spend(card, name, cost, owned, run, verb = "unlock") {
        if (owned || cost <= 0 || engine.save.acorns < cost)
            return tx(card, run, cost);
        spendAsk = { name, cost, run, card, verb };
        render();
        return false;
    }
    function drawSpendSheet() {
        const ask = spendAsk;
        const s = engine.save;
        const close = () => { spendAsk = null; render(); };
        const wrap = el("div", "ac-lvlsheet ac-spendsheet");
        wrap.onclick = (e) => { if (e.target === wrap)
            close(); };
        const sheet = el("div", "ac-lvlcard ac-spendcard");
        sheet.setAttribute("role", "dialog");
        sheet.setAttribute("aria-label", `Spend ${ask.cost} acorns to ${ask.verb} ${ask.name}?`);
        sheet.append(el("p", "ac-kicker", ask.verb.toUpperCase()));
        const q = el("p", "ac-spendask");
        q.append(el("span", "", "Spend "), acornImg(22), el("b", "", ask.cost.toLocaleString()), el("span", "", ` acorns to ${ask.verb} `), el("b", "", ask.name), el("span", "", "?"));
        sheet.append(q);
        const bal = el("p", "ac-sub ac-spendbal");
        bal.append(el("span", "", "You have "), acornImg(13), el("b", "", s.acorns.toLocaleString()), el("span", "", ` · ${(s.acorns - ask.cost).toLocaleString()} after`));
        sheet.append(bal);
        const row = el("div", "ac-spendrow");
        const no = el("button", "ac-ghost", "NOT NOW");
        no.onclick = close;
        const yes = el("button", "ac-primary");
        yes.append(el("span", "", "SPEND "), acornImg(18), el("span", "", ask.cost.toLocaleString()));
        yes.onclick = () => {
            const { card, run, cost } = ask;
            spendAsk = null;
            tx(card, run, cost);
            render();
        };
        row.append(no, yes);
        sheet.append(row);
        wrap.append(sheet);
        return wrap;
    }
    /** The one card "state" that was never a state. A revealed, unowned,
     *  free suit or helmet is a reward sitting there UNCLAIMED - the tap
     *  that reads as "equip" everywhere else is the collection itself.
     *  "EARNED" described the past and asked for nothing; this says what
     *  the tap does, and pulses so the eye finds it in a full shelf. It
     *  leaves the fused name text node so it can carry its own type. */
    function collectTag() {
        return el("span", "ac-collect", "Collect Reward");
    }
    /** Sort key for a shelf. Owned first, then acorn prices ascending, then
     *  star gates ascending far above them - a star gate is a different kind
     *  of price and mixing the two numbers on one axis would read as random. */
    function suitRank(u) {
        const s = engine.save;
        // ACORNUT LEADS (owner, 7 Sep 2026): the flagship heads the standard
        // row whether or not its 500 stars are in, so the goal is always seen.
        if (u.id === "vanguard")
            return -2;
        const owned = s.unlockedSuits.includes(u.id) || (isIap(u.id) && ownsPremium(s, u.id));
        if (owned)
            return -1;
        const gate = STAR_UNLOCKS.suits[u.id];
        if (gate !== undefined)
            return 1000000 + gate;
        return u.cost;
    }
    function helmRank(h) {
        const s = engine.save;
        const owned = s.unlocked.includes(h.id) || (isIap(h.id) && ownsPremium(s, h.id));
        if (owned)
            return -1;
        const gate = STAR_UNLOCKS.helmets[h.id];
        if (gate !== undefined)
            return 1000000 + gate;
        return h.cost;
    }
    function acornPill(n) {
        const pill = el("div", "ac-pill ac-pill-gold");
        pill.append(acornImg(15), el("span", "", n.toLocaleString()));
        return pill;
    }
    function dustPill(n) {
        const pill = el("div", "ac-pill ac-pill-dust");
        pill.append(icon(I_DUST, 13, true), el("span", "", n.toLocaleString()));
        return pill;
    }
    // Five tabs on one bar. HOME is the raised dome in the middle: the
    // biggest target, and glass on every screen because it IS home —
    // the white is its identity, not the current screen's colour.
    /** every menu header carries the same right-hand pair: acorns, then help */
    function headAside(acorns) {
        const wrap = el("div", "ac-headaside");
        wrap.append(acornPill(acorns), dustPill(engine.save.starDust), helpDot());
        return wrap;
    }
    // The coach: one line of guidance, pinned above the tab bar, that only
    // exists while the post-tutorial path is live. It never blocks a tap.
    /** THE SETTINGS, as one list under the hub's gear with Help. Each row is
     *  the whole button, and each knob redraws itself in place rather than
     *  re-rendering the screen - a toggle must not scroll the sheet back to
     *  the top. */
    function settingsRows() {
        const rows = el("div", "ac-rows");
        const row = (label, sub, isOn, flip) => {
            const r = el("button", "ac-row ac-rowbtn ac-setrow");
            const t = el("span", "ac-settxt");
            t.append(el("b", "", label), el("small", "ac-setsub", sub));
            const sw = el("span", isOn() ? "ac-switch on" : "ac-switch");
            sw.append(el("i", "ac-knob"));
            r.setAttribute("role", "switch");
            r.setAttribute("aria-checked", String(isOn()));
            r.append(t, sw);
            r.onclick = () => {
                flip();
                sw.className = isOn() ? "ac-switch on" : "ac-switch";
                r.setAttribute("aria-checked", String(isOn()));
            };
            rows.append(r);
        };
        const sv = () => engine.save;
        row("Music", "The score under menus and flight", () => !sv().musicOff, () => engine.setMusicOff(!sv().musicOff));
        row("Sound effects", "Thrusters, pickups, hits", () => !sv().sfxOff, () => engine.setSfxOff(!sv().sfxOff));
        row("Help prompts", "Coach tips, wave lessons, pre-flight briefing", () => !sv().helpOff, () => engine.setHelpOff(!sv().helpOff));
        row("Menu animation", "Pulses, fades and moving badges", () => !sv().motionOff, () => engine.setMotionOff(!sv().motionOff));
        row("Intro video", "The launch film after TAP TO START", () => !sv().introOff, () => engine.setIntroOff(!sv().introOff));
        return rows;
    }
    // ACORNUT'S PITCH DIAL (owner, 6 Sep 2026: "rotate the entire animation
    // forward about 25 degrees, or give me a dial"). On the pause sheet and
    // under his card in the hangar while he is worn; -5 / +5 degrees a tap,
    // the number shown. Lives in the save so it survives a reload. Goes the
    // moment the owner calls a number.
    // THE FLIGHT LAB. Sliders and switches for the modifiers a mission can
    // carry, felt on a live free flight before they are written into the
    // road. Every dial writes straight into the running world and the beta
    // save, so a change is visible the moment the sheet closes and holds
    // across runs until RESET.
    function flightLab() {
        const lab = engine.save.lab ?? {};
        const panel = el("div", "ac-lab");
        panel.append(el("p", "ac-sub ac-labhead", "FLIGHT LAB · free flight only"));
        const slider = (key, label, min, max, step, base, fmt) => {
            const row = el("div", "ac-labrow");
            const v = typeof lab[key] === "number" ? lab[key] : base;
            const name = el("span", "ac-labname", label);
            const val = el("span", "ac-labval", fmt(v));
            const input = document.createElement("input");
            input.type = "range";
            input.min = String(min);
            input.max = String(max);
            input.step = String(step);
            input.value = String(v);
            input.className = "ac-labslider";
            input.setAttribute("aria-label", label);
            input.oninput = () => { val.textContent = fmt(Number(input.value)); };
            input.onchange = () => { const n = Number(input.value); engine.setLab({ [key]: n === base ? undefined : n }); };
            row.append(name, input, val);
            panel.append(row);
        };
        const pct = (v) => `${Math.round(v * 100)}%`;
        const x = (v) => `${v.toFixed(2)}×`;
        slider("fog", "Fog", 0, 1, 0.05, 0, pct);
        slider("stickChance", "Sticky planets", 0, 1, 0.05, 0, pct);
        slider("driftRate", "Gate sway speed", 0, 3, 0.1, 1, x);
        slider("driftScale", "Gate sway distance", 0, 2.5, 0.1, 1, x);
        slider("gapScale", "Gate opening", 0.6, 1.8, 0.05, 1, x);
        slider("spacing", "Gate distance", 0.6, 1.8, 0.05, 1, x);
        slider("bounceScale", "Planet rebound", 0.3, 2.5, 0.1, 1, x);
        const toggles = el("div", "ac-modes");
        toggles.style.gridTemplateColumns = "repeat(2, minmax(0,1fr))";
        for (const [key, label] of [["upsideDown", "Upside down"], ["tapFreeze", "Tap to slow time"], ["freeRevive", "Unlimited crash recovery"]]) {
            const on = lab[key] === true;
            const b = el("button", on ? "ac-mode on" : "ac-mode", `${label} · ${on ? "ON" : "OFF"}`);
            b.onclick = () => engine.setLab({ [key]: on ? undefined : true });
            toggles.append(b);
        }
        const reset = el("button", "ac-mode", "RESET LAB");
        reset.onclick = () => engine.resetLab();
        toggles.append(reset);
        panel.append(toggles);
        panel.append(el("p", "ac-fine", "Stopwatch as your pal: every tap toggles the slow, like the frozen acorn."));
        return panel;
    }
    function suitPitchDial(suitId) {
        const panel = el("div", "ac-suit-pitch");
        const deg = suitPitchFor(engine.save, suitId);
        const base = suitPitchDefault(suitId);
        const name = (SUITS.find((s) => s.id === suitId)?.name ?? suitId).toUpperCase();
        panel.append(el("p", "ac-sub", `${name} PITCH · ${deg > 0 ? "+" : ""}${deg}° forward`));
        const row = el("div", "ac-modes");
        row.style.gridTemplateColumns = "repeat(5, minmax(0,1fr))";
        for (const [label, d] of [["−5°", -5], ["−1°", -1], [`reset ${base}°`, 0], ["+1°", 1], ["+5°", 5]]) {
            const b = el("button", "ac-mode", label);
            b.onclick = () => engine.setSuitPitch(suitId, d === 0 ? base : deg + d);
            row.append(b);
        }
        panel.append(row);
        return panel;
    }
    function coach(text, inline = false) {
        // HELP OFF means no coach at all. Callers may still tag the element
        // (find-me arrow, pointing-down state); a hidden node takes that
        // harmlessly, so no call site has to know the switch exists.
        if (engine.save.helpOff) {
            const quiet = el("i");
            quiet.hidden = true;
            return quiet;
        }
        // The coach floats over the screen by default, which is right on the
        // hangar and the level sheet - there is nothing under it that matters.
        // On the hub it was landing directly on the STAR CHART bar it points at,
        // covering that bar's own progress line: the instruction hid its target.
        // Inline puts it in the flow instead, above what it is talking about.
        return el("div", inline ? "ac-coach ac-coach-inline" : "ac-coach", text);
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
        box.append(el("p", "ac-fine ac-splash-fine", BUILD));
        box.onclick = () => {
            engine.open("title");
            // INTRO VIDEO OFF skips the film outright; the title is already
            // painted underneath, so there is nothing to dissolve from
            if (!engine.save.introOff)
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
        if (filmShown)
            return;
        filmShown = true;
        const box = el("div", "ac-film");
        const v = document.createElement("video");
        // Two encodes, because no single one plays everywhere: Safari and iOS
        // need H.264 in MP4, and it is the format that matters most for a phone
        // game — but a Chromium built without proprietary codecs (which is what
        // the headless browser this is tested in uses) refuses it outright. The
        // browser takes the first source it can decode.
        // A WIDE WINDOW GETS THE WIDE FILM (owner, 7 Sep 2026): desktops and
        // landscape screens play intro-wide.mp4 over the horizon plate; the
        // portrait film stays behind it as the fallback for a browser that
        // cannot decode H.264. Phones and the app never see the wide file.
        // The wide file is the owner's final cut (8 Sep 2026): 1280x720, H.264
        // High 3.1, and the codecs string says so - a browser reads it to pick
        // a source, so it has to name what the file actually is.
        const wide = window.innerWidth > window.innerHeight;
        const sources = [
            ...(wide ? [["intro-wide.mp4", 'video/mp4; codecs="avc1.64001F"']] : []),
            ["intro.webm", 'video/webm; codecs="vp9"'],
            ["intro.mp4", 'video/mp4; codecs="avc1.4D401E"'],
        ];
        for (const [file, type] of sources) {
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
            if (over)
                return;
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
        const start = window.setTimeout(() => { if (v.paused || !v.currentTime)
            end(); }, 3500);
        const clear = () => { window.clearTimeout(guard); window.clearTimeout(start); };
        v.onended = () => { clear(); end(); };
        v.onerror = () => { clear(); over = true; box.remove(); };
        box.onclick = () => { clear(); end(); };
        requestAnimationFrame(() => box.classList.add("ready"));
        const started = v.play();
        if (started && typeof started.catch === "function")
            started.catch(() => { clear(); end(); });
    }
    // ------------------------------------------------------------- the hub
    // The title screen is a HUB now: the purple key art owns the screen and
    // every destination is one saturated tile, named once. Identity lives in
    // PROFILE, gear lives in LOADOUT, settings and help share the gear
    // button, the Lab rides inside MODES, and the Star Chart bar is the
    // campaign's stars made permanently visible.
    let modesOpen = false;
    // THE LEAN EDITOR, open or shut. Purely a view state - the values live in
    // the save - so it resets on reload, which is right: it is an instrument
    // you open to dial something in, not a mode the game sits in.
    let hyperRunOpen = false;
    // An inspected Depot build stays local. Only the starting utility and engine color are equipped.
    let shipPlan = null;
    const depotView = createDepotView();
    let spillHelpOpen = false;
    function nextStarReward(stars) {
        // "stage" rows opened a chapter, and chapters are gone - the chart is
        // one linear road now. They remain in the compatibility table,
        // but grant nothing, so the hub must
        // not advertise one as the next unlock.
        // The rail already filters them; this had not caught up.
        return STAR_REWARDS.find((r) => r.stars > stars && r.kind !== "stage") ?? null;
    }
    function hubIcon(name, blend = true) {
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
        // THE DAILY SAYS SO HERE (owner, 7 Sep 2026: "a pop up on first log in
        // ON the main menu, showing streak, collect"). Boot banks the dust;
        // the first main menu of the day shows the receipt, once. The shop
        // keeps only the tracker.
        const claimed = engine.takeDailyClaim();
        if (claimed)
            dailyToast = claimed;
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
        // matched to the Star Dust pill so the two currencies read as a pair.
        // No plus: acorns are flown for, not bought, so there is nowhere to
        // send a pilot who wants more of them.
        const acorns = el("button", "ac-hub-idacorns ac-hub-idnut");
        acorns.setAttribute("aria-label", "Shop");
        acorns.append(acornImg(16), el("span", "", s.acorns.toLocaleString()));
        acorns.onclick = () => engine.open("shop");
        // Star Dust sits beside acorns and carries a plus, because the only
        // way to get more is to buy it - so the counter may as well be the
        // door to where you do that.
        const dust = el("button", "ac-hub-iddust");
        dust.setAttribute("aria-label", "Buy Star Dust");
        dust.append(icon(I_DUST, 14, true), el("span", "", s.starDust.toLocaleString()), el("i", "ac-hub-plus", "+"));
        dust.onclick = () => engine.open("shop");
        idcap.append(prof, acorns, dust);
        const shopBtn = el("button", "ac-hub-sq");
        shopBtn.setAttribute("aria-label", "Shop");
        shopBtn.append(hubIcon("gift"));
        // THE ONLY PROMPT THE DAILY GETS. An unclaimed day lights the shop
        // button from behind rather than nagging with a banner; walking in is
        // what claims it, so the glow is both the ask and the whole interaction.
        if (engine.dailyUnseen())
            shopBtn.classList.add("ac-dailyready");
        shopBtn.onclick = () => engine.open("shop");
        // NEXT TO THE SHOP, in the rail, wearing painted art like the gift
        // beside it - this rail speaks in renders, and the dock that speaks in
        // line glyphs is not rendered at all.
        const boardBtn = el("button", "ac-hub-sq");
        boardBtn.setAttribute("aria-label", "Leaderboard");
        boardBtn.append(hubIcon("trophy"));
        boardBtn.onclick = () => engine.open("scores");
        const gear = el("button", "ac-hub-sq");
        gear.setAttribute("aria-label", "Settings and help");
        // THE OWNER'S ACORN-GEAR (8 Sep 2026: "keep in a square background
        // like the leaderboard and shop. current button has white box that
        // disrupts the bar's look"). Same painted-on-dark treatment as the
        // gift and the trophy: screen-blended into the rail's own square.
        gear.append(hubIcon("settings"));
        gear.onclick = () => engine.open("help");
        rail.append(idcap, el("div", "ac-hub-railgap"), shopBtn, boardBtn, gear);
        box.append(rail);
        const mark = el("div", "ac-hub-wordmark");
        mark.append(el("h1", "ac-hub-title", "ACORNAUT"));
        mark.append(el("p", "ac-hub-kicker", "Fly the gaps · Grab the acorns"));
        box.append(mark, el("div", "ac-hub-space"));
        const tiles = el("div", "ac-hub-tiles");
        const tile = (cls, pic, label, sub, hit, dot, pulse) => {
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
            if (pulse)
                b.classList.add("ac-pulse");
            b.onclick = hit;
            tiles.append(b);
            return b;
        };
        // WHILE THE GUIDE IS RUNNING, THE STEP IS THE HERO.
        //
        // The hub's biggest, brightest control said FREE FLIGHT - an endless
        // mode with no progression - while a new pilot was being told to go and
        // wear their new suit, or fly Mission 1. The instruction was a small
        // line at the bottom and the campaign was a status strip under it, so
        // the loudest thing on screen pointed away from the only thing the
        // player had been asked to do. Nothing was broken; the hierarchy was
        // simply upside down for the one pilot who most needs it right.
        //
        // So for the three guided states the step takes the top slot, at hero
        // size, and FREE FLIGHT steps down for the two minutes that lasts.
        const guiding = s.guide === "hangar" || s.guide === "helmet" || s.guide === "levels";
        if (guiding) {
            box.classList.add("ac-guiding");
            const toChart = s.guide === "levels";
            const step = el("button", "ac-hubtile t-guide ac-pulse");
            step.append(el("span", "ac-hub-ribbon", toChart ? "NEXT \u00b7 MISSION 1" : "NEXT \u00b7 YOUR NEW GEAR"));
            const gic = el("span", "ac-hubic");
            if (toChart)
                gic.append(el("span", "ac-hub-stepstar", "\u2605"));
            else
                gic.append(portraitOf(HELMETS.find((h) => h.id === GUIDE_HELM) ?? helm, SUITS.find((u) => u.id === GUIDE_SUIT) ?? suit, 50));
            const gtxt = el("span", "ac-hub-launchtxt");
            gtxt.append(el("b", "", toChart ? "FLY MISSION 1" : "OPEN LOADOUT"), el("span", "ac-hubsub", toChart
                ? "Your first mission on the Star Chart"
                : s.guide === "helmet" ? "Now put on the Ion helmet" : "Put on your new Ion suit"));
            step.append(gic, gtxt);
            step.onclick = () => engine.open(toChart ? "log" : "hangar");
            tiles.append(step);
        }
        // FREE FLIGHT is the endless game; missions live on the Star Chart.
        // The ribbon names the selected mode so launching is never a mystery.
        const launch = el("button", "ac-hubtile t-launch");
        launch.append(el("span", "ac-hub-ribbon", `${MODES[selectedMode].label} SELECTED`));
        const lic = el("span", "ac-hubic");
        lic.append(hubIcon("rocket", false));
        const ltxt = el("span", "ac-hub-launchtxt");
        const spillSelected = MODES[selectedMode].id === "spill";
        const suspended = spillSelected ? s.spillSuspended : null;
        // ONE WORD (owner, 7 Sep 2026: "instead of free flight, just Launch...
        // large and in charge"). The ribbon above names the mode; the line
        // under says what the tap does in it.
        ltxt.append(el("b", "", suspended ? "RESUME" : "LAUNCH"), el("span", "ac-hubsub", suspended ? `Saved at Depot ${suspended.state.wave}` : spillSelected ? "Survive the dangers of space" : "Begin your flight"));
        // WHAT IS ACTUALLY ON. Mods and a pal's effect change how the run plays
        // and were previously invisible from here - you had to remember. One
        // line, named plainly, so nobody launches wondering why the gates are
        // still or the gravity is wrong.
        {
            const on = [];
            for (const m of MODS)
                if (s[m.save])
                    on.push(m.name);
            // desc, not tag: "MAGNET" is a label, "Magnet Effect" is what the
            // hangar card says and it is the one a pilot has actually read.
            // Two seats means two chips (owner, 7 Sep 2026).
            if (!s.noPalFx)
                for (const id of equippedPals(s)) {
                    const palOn = PALS.find((x) => x.id === id);
                    if (palOn)
                        on.push(`${palOn.name} \u00b7 ${palOn.desc}`);
                }
            if (on.length && !spillSelected) {
                // prefixed, because an unlabelled green line beneath a launch button
                // reads as a slogan rather than as the state of the run. One CHIP
                // per effect, so a long description wraps to its own row instead
                // of shoving the whole tile sideways (owner: "scrunches up with
                // too much text").
                const line = el("span", "ac-hub-active");
                line.append(el("b", "", "ACTIVE"));
                for (const t of on)
                    line.append(el("span", "ac-hub-fx", t));
                ltxt.append(line);
            }
        }
        launch.append(lic, ltxt);
        launch.onclick = () => launchSelected();
        tiles.append(launch);
        const loadoutTile = tile("t-loadout", portraitOf(helm, suit, 50), "LOADOUT", "Suits & gear", () => engine.open("hangar"), undefined, s.guide === "hangar" || s.guide === "helmet");
        // an equipped pal announces itself on the tile — one green line
        const hubPals = equippedPals(s).map((id) => PALS.find((p) => p.id === id)?.name).filter(Boolean);
        if (hubPals.length) {
            loadoutTile.append(el("span", "ac-hubsub ac-hubequip", `${hubPals.join(" + ")} equipped`));
        }
        const planet = miniCanvas(50, 50);
        if (planet.ctx)
            drawSpriteOn(planet.ctx, engine.art?.planets?.[8] ?? null, 25, 25, 46);
        // no dot: a badge should mean something NEW is inside, and nothing
        // in the mode sheet changes on its own
        tile("t-modes", planet.c, "MODES", `${MODES.length} ways to fly${IS_BETA && platform.devDoors ? " · Lab" : ""}`, () => { modesOpen = true; render(); });
        box.append(tiles);
        // the Star Chart bar: campaign stars over this route's total, plus what the
        // next handful buys — a second door into the chart
        const stars = starsOf(s);
        const nxt = nextStarReward(stars);
        const bar = el("button", "ac-hub-bar");
        bar.append(el("span", "ac-hub-starbadge", "★"));
        const btxt = el("span", "ac-hub-bartxt");
        btxt.append(el("b", "", nxt ? `STAR CHART · NEXT UNLOCK ★ ${nxt.stars}` : "STAR CHART · COMPLETE"));
        const track = el("span", "ac-hub-track");
        const fill = el("i", "");
        fill.style.width = `${Math.min(100, (stars / CHART_MAX_STARS) * 100)}%`;
        track.append(fill, el("em", "", `${stars} / ${CHART_MAX_STARS}`));
        btxt.append(track);
        bar.append(btxt);
        bar.onclick = () => engine.open("log");
        if (s.guide === "levels")
            bar.classList.add("ac-pulse");
        box.append(bar);
        // NO SECOND LINE. The guided step above is the instruction - it names
        // the destination, says why, and is the thing you press. The old coach
        // pill added a third piece of text for the same message and, being
        // absolutely positioned, landed on top of the STAR CHART bar it was
        // pointing at, covering that bar's own progress line.
        if (modesOpen)
            box.append(drawModeSheet());
        if (hyperRunOpen) {
            box.append(drawLevelSheet(HYPER_RUN_MISSION, hyperRunMask(), "modes"));
        }
        if (dailyToast)
            box.append(drawDailyToast(dailyToast));
        return box;
    }
    // The mode picker: FREE FLIGHT's four rule-sets, with the Lab's
    // lab doors riding at the bottom — one deliberate tap away,
    // exactly as Help used to carry them.
    // Every mode wears a piece of the real game as its face: the painted
    // black hole DEEP SPACE throws at you, the 8-bit acorn ARCADE spawns,
    // a world knocked off its axis for LOST IN SPACE. No new art files —
    // the banks are already decoded and on screen during a flight.
    const MODE_FACE = {
        fly: "rocket", deep: "hole", lost: "tumble", arcade: "arcade",
        // these two joined MODES and had no face, so both rows drew an empty
        // plate. modeIcon already knew how to paint them.
        tunnel: "worm", race: "race",
        spill: "spill",
    };
    function modeIcon(kind, px = 44) {
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
            if (kind === "hole")
                drawSpriteOn(ctx, bank?.holeAnim?.[0] ?? null, px / 2, px / 2, px);
            else if (kind === "worm")
                drawSpriteOn(ctx, bank?.wormAnim?.[0] ?? null, px / 2, px / 2, px);
            else if (kind === "arcade")
                drawSpriteOn(ctx, bank?.arcadeAcorn ?? null, px / 2, px / 2, px * 0.8);
            else if (kind === "race")
                drawSpriteOn(ctx, bank?.hyperRun?.["scout-ship"] ?? bank?.squirrelIdle?.[0] ?? null, px / 2, px / 2, px * 0.94);
            // the Spill's face is its Acorn Coins: the thing the mode is about
            else if (kind === "spill")
                drawSpriteOn(ctx, bank?.ore ?? bank?.debris?.[3] ?? null, px / 2, px / 2, px * 0.9);
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
        if (s.spillSuspended) {
            const resume = el("button", "ac-primary", `RESUME DEBRIS FIELD · DEPOT ${s.spillSuspended.state.wave}`);
            resume.onclick = () => { modesOpen = false; engine.spillResume(); };
            sheet.append(resume);
        }
        const bests = {
            fly: s.highScore, deep: s.deepBest, lost: s.lostBest, arcade: s.arcadeBest ?? 0,
            spill: s.spillBest ?? 0,
        };
        const modeOpen = (id) => id === "deep" ? deepUnlocked(s) : id === "lost" ? lostUnlocked(s) : true;
        const modePrice = (id) => id === "deep" ? STAR_UNLOCKS.deep : id === "lost" ? STAR_UNLOCKS.lost : 0;
        const bestChip = (n) => {
            const c = el("span", "ac-modebest");
            c.append(el("i", "", "BEST"), el("b", "", String(n)));
            return c;
        };
        const gateLockChip = (lvl) => {
            const c = el("span", "ac-modelock");
            c.append(icon(I_LOCK, 12), el("b", "", `LV ${lvl}`));
            return c;
        };
        const lockChip = (n) => {
            const c = el("span", "ac-modelock");
            c.append(icon(I_LOCK, 12), el("b", "", `\u2605 ${n}`));
            return c;
        };
        // one row for every way to fly: face, name, the rule in a sentence,
        // and a chip that is either the record or the price of admission
        const row = (o) => {
            const open = o.open !== false;
            const b = el("button", `ac-moderow ${o.cls}`);
            if (!open)
                b.classList.add("ac-cardoff");
            if (o.selected)
                b.classList.add("on");
            const ic = el("span", "ac-modeic");
            ic.append(modeIcon(o.face));
            if (o.selected)
                ic.append(el("i", "ac-modetick", "\u2713"));
            const t = el("span", "ac-moderowtxt");
            t.append(el("b", "", o.label));
            if (o.blurb)
                t.append(el("span", "", o.blurb));
            b.append(ic, t);
            if (o.aside)
                b.append(o.aside);
            b.onclick = o.hit;
            sheet.append(b);
            return b;
        };
        const firstGate = RACE_GATES[0];
        const raceEarned = IS_BETA || (s.raceGates || []).includes(firstGate.after);
        const raceRec = s.raceRecords?.[HYPER_RUN_MISSION.id];
        MODES.forEach((m, i) => {
            const open = m.id === "race" ? raceEarned : modeOpen(m.id);
            // each mode's chip is its own record, in its own units
            const aside = m.id === "race"
                ? (raceEarned
                    ? (raceRec?.bestFinishTicks ? bestChip(formatRaceTicks(raceRec.bestFinishTicks)) : null)
                    : gateLockChip(firstGate.after))
                : m.id === "tunnel"
                    ? (s.tunnelBest ? bestChip(s.tunnelBest) : null)
                    : open ? bestChip(bests[m.id] ?? 0) : lockChip(modePrice(m.id));
            row({
                cls: `m-${m.id === "tunnel" ? "tunnel" : m.id}`,
                face: MODE_FACE[m.id],
                label: m.label,
                blurb: m.id === "race" && !raceEarned
                    ? `Clear the debris field after level ${firstGate.after} to unlock.`
                    : m.blurb,
                aside,
                open,
                selected: open && i === selectedMode,
                hit: () => {
                    // a locked Hyper Run still answers: it shows the chart where the
                    // field that unlocks it actually is
                    if (!open) {
                        if (m.id === "race") {
                            modesOpen = false;
                            engine.open("log");
                            render();
                        }
                        return;
                    }
                    selectedMode = i;
                    modesOpen = false;
                    render();
                },
            });
        });
        // What remains under the divider really is a lab: utilities, not modes.
        // BETA ONLY (owner, 7 Sep 2026: "rig editor and ship bench need to
        // remove from main app"), and never in a store build (platform.devDoors).
        if (IS_BETA && platform.devDoors) {
            sheet.append(el("p", "ac-modeshead", "PROTOTYPES"));
            const door = (label, hit) => {
                const b = el("button", "ac-moderow ac-modedoor");
                const t = el("span", "ac-moderowtxt");
                t.append(el("b", "", label));
                b.append(t, icon(I_CHEV, 16));
                b.onclick = hit;
                sheet.append(b);
            };
            door("RIG EDITOR", () => { window.location.href = labRootOf() + "rig/"; });
            door("SHIP BENCH", () => { window.location.href = labRootOf() + "ship/"; });
            if (IS_BETA)
                door("BACKGROUND TEST MODE", () => { window.location.href = labRootOf() + "skytest/"; });
        }
        const back = el("button", "ac-primary ac-modeback", "BACK");
        back.onclick = () => { modesOpen = false; render(); };
        sheet.append(back);
        wrap.append(sheet);
        wrap.onclick = (e) => { if (e.target === wrap) {
            modesOpen = false;
            render();
        } };
        return wrap;
    }
    function labRootOf() {
        return IS_BETA ? "../lab/" : "./lab/";
    }
    /** the tutorial's graduation gift, as the crash sheets show it */
    function graduationGift() {
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
        return gift;
    }
    // Shared workshop surfaces keep launch choices and the live Depot consistent.
    function openSpillHelp() { spillHelpOpen = true; render(); }
    function closeSpillHelp() {
        spillHelpOpen = false;
        render();
        overlay.querySelector('[data-spill-control="setup-guide"], [data-spill-briefing]')?.focus({ preventScroll: true });
    }
    function spillHelpSheet() {
        return drawSpillGuideSheet(engine, closeSpillHelp, engine.world.screen === "help" ? "BACK TO HELP" : "BACK TO SHIP");
    }
    function drawSpillPrep() { return drawSpillLaunchSetup(engine, openSpillHelp); }
    function drawDepot(_sp) { return drawDepotWorkshop(engine, depotView, render); }
    function miniCanvas(w, h) {
        const c = document.createElement("canvas");
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.ceil(w * dpr);
        c.height = Math.ceil(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
        const ctx = c.getContext("2d");
        if (ctx)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { c, ctx };
    }
    /** THE STAR. A small toggle riding the corner of a suit, helmet or trail
     *  card (owner, 2 Sep 2026). The card is a <button>, so this is a span
     *  with the button's role rather than a nested button, and it swallows
     *  the press so starring never equips. The FAVOURITES shelf it feeds
     *  only exists while at least one star is lit. */
    function favStar(id) {
        const on = engine.isFavorite(id);
        const star = el("span", on ? "ac-favbtn on" : "ac-favbtn", on ? "\u2605" : "\u2606");
        star.setAttribute("role", "button");
        star.setAttribute("aria-pressed", String(on));
        star.setAttribute("aria-label", on ? "Remove from favourites" : "Add to favourites");
        star.tabIndex = 0;
        const flip = (e) => { e.stopPropagation(); e.preventDefault(); engine.toggleFavorite(id); };
        star.addEventListener("pointerdown", (e) => e.stopPropagation());
        star.addEventListener("click", flip);
        star.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ")
            flip(e); });
        return star;
    }
    /** the FAVOURITES shelf head plus its row, or nothing when no star is lit */
    function favShelf(ids, card) {
        const picked = ids.filter((id) => engine.isFavorite(id));
        if (!picked.length)
            return null;
        const frag = document.createDocumentFragment();
        frag.append(el("p", "ac-shelfhead ac-favhead", "\u2605 FAVOURITES"));
        const row = el("div", "ac-shelfrow");
        for (const id of picked) {
            const c = card(id);
            if (c)
                row.append(c);
        }
        frag.append(row);
        return frag;
    }
    function helmCardOf(helmet, px = 56) {
        // the dedicated helmet render IS the card — no shrunken squirrel
        const spr = engine.art?.helms?.[helmet.id];
        if (!spr)
            return portraitOf(helmet, SUITS[0], px);
        const { c, ctx } = miniCanvas(px, px);
        if (ctx)
            drawSpriteOn(ctx, spr, px / 2, px / 2, px * 0.92);
        return c;
    }
    function suitCardOf(suit, px = 56) {
        // Fit the painted subject's measured bounds instead of shrinking its
        // whole source canvas (whose transparent margins vary from suit to suit).
        const { c, ctx } = miniCanvas(px, px);
        if (ctx)
            drawSpriteOn(ctx, engine.art?.suits?.[suit.id] ?? null, px / 2, px / 2, px * 0.88);
        return c;
    }
    function portraitOf(helmet, suit, px = 56) {
        const { c, ctx } = miniCanvas(px, px);
        if (ctx && engine.art)
            paintPortrait(ctx, engine.art, helmet, suit, px * 0.45, px / 2, px * 0.78);
        return c;
    }
    /** Mark a card premium and tell it WHICH premium it is. Every suit and
     *  helmet already carries a `glow` in catalog.ts and every trail a
     *  palette - data the UI had never once read. Feeding it in here means a
     *  premium card blooms in its own colour instead of twenty identical gold
     *  cards, at the cost of one custom property and no new art. */
    function markPremium(node, hue) {
        node.classList.add("ac-premium");
        if (hue)
            node.style.setProperty("--pg", hue);
    }
    /** the pal in the LOW seat on a stage that is trying one on up high: the
     *  hangar's second companion, unless it is the very one being tried */
    function lowSeatPal(s, high) {
        const low = equippedPals(s)[1] ?? (equippedPals(s)[0] !== high ? equippedPals(s)[0] : undefined);
        return low && low !== high ? low : undefined;
    }
    function palCardOf(pl, forShop = false) {
        const s = engine.save;
        const premium = isIap(pl.id);
        const open = premium ? ownsPremium(s, pl.id) : palUnlocked(s, pl.id);
        // "None" is the empty high seat, never the empty low one
        const seat = s.equippedPal === pl.id ? "HIGH" : pl.id !== "none" && s.equippedPal2 === pl.id ? "LOW" : "";
        const b = el("button", seat ? "ac-card ac-palcard on" : "ac-card ac-palcard");
        // a flying pal reads as flying to a screen reader too (audit, Sep
        // 2026): with one seat open the card carried no words for it at all
        b.setAttribute("aria-pressed", String(!!seat));
        b.dataset.focus = `pal:${pl.id}`;
        if (premium)
            markPremium(b); // pals carry no palette of their own
        if (!open)
            b.classList.add("ac-cardoff");
        b.append(el("p", "ac-palname", pl.name));
        const { c, ctx } = miniCanvas(72, 60);
        if (ctx)
            paintPalPreview(ctx, engine.art, pl.id, 36, 30, 54);
        b.append(c);
        b.append(el("p", "ac-paldesc", pl.desc));
        // The card is NAME, painting, DESCRIPTION. The foot line only exists
        // when it says something the description does not: the star price, the
        // premium state — never a redundant tag.
        // with two seats open, an equipped pal says WHICH it is flying in
        const status = seat && dualPalUnlocked(s) && pl.id !== "none" ? `FLYING ${seat}`
            : premium ? (open ? "OWNED" : "PREMIUM")
                : open ? ""
                    : STAR_UNLOCKS.pals[pl.id] !== undefined ? `\u2605 ${STAR_UNLOCKS.pals[pl.id]}`
                        : forShop ? "EARNED BY FLYING" : "LOCKED";
        if (status)
            b.append(el("p", "ac-palstat", status));
        b.onclick = () => { if (open)
            tx(b, () => engine.equipPal(pl.id)); };
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
        wrap.addEventListener("pointerdown", () => { if (armed)
            wrap.remove(); });
        document.body.append(wrap);
    }
    // WHAT HAPPENED WHEN YOU TAPPED. The engine has always returned a reason -
    // "poor", "locked", "suitOnly", "missing" - and every call site used to
    // discard it. Worse, the engine returns BEFORE notify() on those paths, so
    // there was no re-render either and a refused tap moved nothing at all.
    // One status line, spoken once, plus a shake on the card that was refused
    // so the message is attached to the thing you touched.
    let denyEl = null;
    // "poor" means the same thing whichever purse is short, so the message
    // has to be told WHICH. It used to say acorns unconditionally, which read
    // as nonsense on a pack priced in Star Dust.
    const DENY_TEXT = {
        poor: (c, cur) => {
            const name = cur === "dust" ? "Star Dust" : "acorns";
            return c ? `Not enough ${name} \u2014 ${c.toLocaleString()} needed.` : `Not enough ${name}.`;
        },
        locked: () => "Locked. Earn more stars to open this.",
        suitOnly: () => "This one belongs to another suit.",
        missing: () => "That item is not in this build.",
        unknown: () => "That item is not in this build.",
        owned: () => "Already yours.",
        armed: () => "Already armed — your next run spends it.",
        unavailable: () => "Star Dust packs are sold in the app.",
        clash: () => "Nightglider holds the gates still — it will not fly beside Wisp or AstraFox.",
        // the Star Chart boosts
        hyper: () => "Hyper Run keeps its own record — a Level Skip cannot land there.",
        done: () => "That mission already has three stars.",
        none: () => "No boost held. Buy one in the Shop.",
        currency: () => "Acorn and Star Dust lines pay out on their own as your stars climb.",
    };
    /** a boost's badge, from the owner's art, at any size */
    function boostArt(id, px) {
        const im = document.createElement("img");
        im.src = `${artRootUrl()}/${BOOSTS[id].art}?v=${ART_VER}`;
        im.alt = "";
        im.draggable = false;
        im.width = px;
        im.height = px;
        im.className = "ac-boostart";
        return im;
    }
    const REWARD_KIND = { pal: "PAL", mod: "MOD", mode: "MODE", suit: "SUIT",
        helmet: "HELMET", trail: "TRAIL", title: "TITLE", stage: "CHAPTER", dust: "STAR DUST", acorns: "ACORNS" };
    /** how a real-money purchase ended, in the shop's own status line. "ok"
     *  has no line: the dust badge is the receipt. */
    const DUST_OUTCOME_TEXT = {
        cancelled: "Purchase cancelled. Nothing was charged.",
        failed: "The store did not complete the purchase. If you were charged, RESTORE PURCHASES delivers it.",
        unavailable: "That pack is not on sale right now.",
    };
    function announce(msg) {
        if (!denyEl)
            return;
        // re-set the text even when it repeats, or a second identical refusal
        // is silent to a screen reader
        denyEl.textContent = "";
        denyEl.textContent = msg;
        denyEl.classList.add("on");
    }
    function clearDeny() { if (denyEl) {
        denyEl.textContent = "";
        denyEl.classList.remove("on");
    } }
    /** run a transaction and SAY what happened. Returns true if it went through. */
    function tx(card, run, cost, currency = "acorns") {
        const res = run();
        const explain = DENY_TEXT[res];
        if (!explain) {
            clearDeny();
            return true;
        } // "on"/"off"/"ok" - it worked
        announce(explain(cost, currency));
        card.classList.remove("ac-shake");
        void card.offsetWidth; // restart the animation
        card.classList.add("ac-shake");
        return false;
    }
    function drawHangar() {
        const s = engine.save;
        const shipPick = shipPlan ?? { plating: 0, thrusters: 0, pulse: 0, shield: 0,
            utilities: s.spillStarter ? [s.spillStarter] : [] };
        const previewShip = spillPreviewState(shipPick);
        const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
        const trail = TRAILS.find((t) => t.id === trailWornBy(s.equippedTrail, s.equippedSuit)) ?? TRAILS[0];
        const box = el("div", "ac-menu");
        box.append(header("Suits & gear", "Loadout", headAside(s.acorns)));
        // ONE PILOT, AND IT MOVES. The loadout showed the equipped rig TWICE:
        // a static portrait in a banner, then the animated stage right beneath
        // it. Two pictures of the same squirrel, and the still one held the top
        // of the screen - while the flap is the whole thing that tells two suits
        // apart. So the banner goes and the animation takes the slot, wearing
        // the shop's case: the pilot has already learned to read that frame
        // there, and the name, helmet, trail and pal ride its plate.
        {
            const wornSuit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
            const wornHelm = helmetWornBy(s.equipped, s.equippedSuit);
            const ownHead = wearsOwnHead(wornSuit);
            const palsWorn = equippedPals(s).map((id) => PALS.find((x) => x.id === id)).filter((x) => !!x);
            const CASE_W = 344, CASE_H = 236;
            const stage = el("div", "ac-shopcase ac-hangarcase");
            // A CASE YOU CAN SHRINK (owner, 2 Sep 2026). Browsing a long shelf
            // under a 236px vitrine means scrolling past the pilot every time;
            // a double tap on the case folds it to a strip and the shelves take
            // the room. The state lives in the save so it holds between visits,
            // and the little chevron on the plate says the gesture exists -
            // nothing else on the screen is double-tapped.
            if (!s.heroExpanded)
                stage.classList.add("ac-casecompact");
            let lastTap = 0;
            stage.addEventListener("pointerup", (e) => {
                const now = performance.now();
                if (now - lastTap < 320) {
                    engine.setHeroExpanded(!engine.save.heroExpanded);
                    lastTap = 0;
                }
                else
                    lastTap = now;
                e.preventDefault();
            });
            stage.style.setProperty("--case-glow", wornSuit.glow ?? wornSuit.trim ?? "#c4a0ff");
            stage.style.setProperty("--case-lite", wornSuit.suitLite ?? "#8a5ae4");
            stage.style.setProperty("--case-deep", wornSuit.suitDark ?? "#160f34");
            const pane = el("div", "ac-casepane");
            const { c, ctx } = miniCanvas(CASE_W, CASE_H);
            c.className = "ac-tocanvas ac-casecanvas";
            c.setAttribute("role", "img");
            c.setAttribute("aria-label", engine.shopTab === "ship" ? "Debris Field ship build preview" : `${wornSuit.name} in flight`);
            pane.append(el("i", "ac-casebeam"), c, el("i", "ac-casefloor"));
            for (const corner of ["tl", "tr", "bl", "br"]) {
                pane.append(el("i", `ac-casecorner ac-c-${corner}`));
            }
            if (ownHead)
                pane.append(el("span", "ac-tonohelm ac-casetag", wornSuit.id === "arcflash" ? "INTEGRATED LOOK · CANNOT CHANGE" : OWN_HEAD_TAG));
            stage.append(pane);
            const plate = el("div", "ac-caseplate");
            const fold = el("button", "ac-casefold", s.heroExpanded ? "\u25B4" : "\u25BE");
            fold.setAttribute("aria-label", s.heroExpanded ? "Shrink the preview" : "Expand the preview");
            fold.title = "Double-tap the case, or tap here";
            fold.onclick = (e) => { e.stopPropagation(); engine.setHeroExpanded(!engine.save.heroExpanded); };
            stage.append(fold);
            if (engine.shopTab === "ship") {
                plate.append(el("span", "ac-caseeyebrow", shipPlan ? "DEPOT BUILD PREVIEW" : "NEXT ENDLESS RUN"));
                plate.append(el("b", "", `Health ${previewShip.maxHull} · Shields ${previewShip.shield}`));
                plate.append(el("span", "ac-casesub", `${shipPlan ? previewShip.utilities.map(id => SPILL_UTILITIES[id].name).join(" + ") || "No utilities" : s.spillStarter ? SPILL_UTILITIES[s.spillStarter].name : "No starting utility"} · ${wornSuit.name} aboard`));
            }
            else {
                plate.append(el("span", "ac-caseeyebrow", "EQUIPPED"));
                plate.append(el("b", "", wornSuit.name + (ownHead ? "" : ` \u00b7 ${wornHelm.name}`)));
                plate.append(el("span", "ac-casesub", `${trail.name} \u00b7 ${palsWorn.length ? palsWorn.map((p) => p.name).join(" + ") : "No pal"}`));
            }
            // THE NEXT-RUN SHIELD LIVES ON THE PLATE (owner, 2 Sep 2026: "find a
            // home elsewhere in the loadout, maybe a small button on the
            // animator"). One small control under the name: armed, it is the
            // blue tag it always was; not armed and unlocked, it is the button
            // that arms it for MOD_SHIELD_COST acorns.
            if (engine.shopTab !== "ship" && s.startShield) {
                const tags = el("div", "ac-rigtags");
                tags.append(el("span", "ac-tagpill ac-tagblue", "+1 SHIELD \u00b7 NEXT RUN"));
                plate.append(tags);
            }
            else if (engine.shopTab !== "ship" && startShieldUnlocked(s)) {
                const arm = el("button", "ac-platebtn");
                arm.append(el("span", "", "\u25C8"), el("span", "", `SHIELD NEXT RUN \u00b7 ${MOD_SHIELD_COST}`));
                arm.onclick = (e) => { e.stopPropagation(); spend(arm, "a shield for your next run", MOD_SHIELD_COST, false, () => engine.toggleMod("shield"), "arm"); };
                plate.append(arm);
            }
            stage.append(plate);
            box.append(stage);
            if (ctx) {
                // the worn suit is usually home already, but a pilot who equips and
                // opens the loadout inside the same second can still beat the load
                engine.wantSuitArt(wornSuit.id);
                for (const p of palsWorn)
                    engine.wantPalArt(p.id);
                const t0 = performance.now();
                const tick = () => {
                    if (!c.isConnected)
                        return;
                    const tt = (performance.now() - t0) / 1000;
                    ctx.clearRect(0, 0, CASE_W, CASE_H);
                    // the old pair of branches here tested noPalFx and then did the
                    // same thing either way, so the switch never switched anything
                    if (engine.shopTab === "ship") {
                        paintShipPreview(ctx, engine.art, s, CASE_W / 2, 122, 4.0, tt, shipPick);
                    }
                    else {
                        // high seat over the shoulder, low seat under the tail
                        palsWorn.forEach((p, i) => paintPalPreview(ctx, engine.art, p.id, CASE_W - 58, i === 0 ? 80 : 172, 52));
                        paintFlightPreview(ctx, engine.art, wornSuit, wornHelm, CASE_W / 2 - 14, 128, 158, tt, suitLean(wornSuit.id), false, (suitPitchFor(engine.save, wornSuit.id) * Math.PI) / 180);
                    }
                    requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }
        }
        const tabs = el("div", "ac-cats");
        for (const t of ["suits", "helmets", "trails", "pals", "ship"]) {
            const b = el("button", t === engine.shopTab ? "ac-cat on" : "ac-cat", t.toUpperCase());
            // WHICH TAB IS OPEN WAS A COLOUR AND NOTHING ELSE (audit, Sep 2026):
            // the class said it, so a screen reader heard five identical tabs.
            b.setAttribute("aria-pressed", String(t === engine.shopTab));
            b.dataset.focus = `tab:${t}`;
            if ((s.guide === "hangar" && t === "suits" && engine.shopTab !== "suits") ||
                (s.guide === "helmet" && t === "helmets" && engine.shopTab !== "helmets")) {
                b.classList.add("ac-pulse");
            }
            b.onclick = () => engine.setShopTab(t);
            tabs.append(b);
        }
        box.append(tabs);
        if (engine.shopTab === "suits" || engine.shopTab === "helmets")
            box.append(shelfToggle());
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
                note.append(el("p", "ac-lockedhead", `${suit.name}: ${suit.id === "arcflash" ? "integrated look" : OWN_HEAD_LINE}`), el("p", "ac-sub", suit.id === "arcflash" ? "Arcflash's blue eyes and bare head are part of its look. Equip another suit to change helmets." : "The helmet is part of the character. Equip another suit to change helmets."));
                scroll.append(note);
            }
            // grouped by what the GLASS does. A suit-locked helmet is not listed
            // at all: it arrives with its suit, and a card that cannot be chosen
            // answers nothing.
            grid.classList.add("ac-shelfcol");
            if (s.shelfGrid)
                grid.classList.add("ac-asgrid");
            const helmCard = (h) => {
                const premium = isIap(h.id);
                const open = helmetRevealed(s, h.id);
                const owned = premium ? ownsPremium(s, h.id) : s.unlocked.includes(h.id);
                const b = el("button", !locked && s.equipped === h.id ? "ac-card on" : "ac-card");
                // WORN IS A STATE, NOT A COLOUR (audit, Sep 2026). The card said
                // "OWNED" whether it was on the pilot's head or on the shelf, so
                // the worn one was told apart by a border and nothing else.
                b.setAttribute("aria-pressed", String(!locked && s.equipped === h.id));
                b.dataset.focus = `helm:${h.id}`;
                // A bare integer told the pilot nothing: "70" next to "OWNED"
                // reads as a score, and a free helmet rendered the word "0".
                // State stays in the text node; a real price becomes its own
                // element so it can wear the acorn it is denominated in.
                const claim = !premium && open && !owned && h.cost <= 0;
                const helmState = premium ? (owned ? "OWNED" : "PREMIUM")
                    : !open ? `\u2605 ${STAR_UNLOCKS.helmets[h.id]}`
                        : owned ? "OWNED" : "";
                b.append(helmCardOf(h, 64), document.createTextNode(`${h.name}\n${helmState}`));
                if (claim)
                    b.append(collectTag());
                if (!premium && open && !owned && h.cost > 0)
                    b.append(costTag(h.cost));
                if (premium)
                    markPremium(b, h.glow);
                if (locked || !open)
                    b.classList.add("ac-cardoff");
                if (s.guide === "helmet" && h.id === GUIDE_HELM)
                    b.classList.add("ac-pulse", "ac-guidetarget");
                b.onclick = () => { if (!locked && open && (!premium || owned))
                    spend(b, h.name, h.cost, owned, () => engine.buyHelmet(h.id)); };
                if (open && (!premium || owned))
                    b.append(favStar(h.id));
                return b;
            };
            const helmListed = (h) => !h.suitOnly && (!isIap(h.id) || ownsPremium(s, h.id));
            const favHelms = favShelf(HELMETS.filter(helmListed).map((h) => h.id), (id) => { const h = HELMETS.find((x) => x.id === id); return h ? helmCard(h) : null; });
            if (favHelms)
                grid.append(favHelms);
            // THE SUIT'S OWN HELMET (owner, 2 Sep 2026: "the leviathan helmet is
            // missing"). A suit-locked helmet was never listed anywhere: not on
            // the shelves, because it only fits one suit, and so a pilot who
            // bought the Regalia pack had no way to see - or put on - the
            // helmet that came with Leviathan. While its suit is the one worn,
            // it gets a shelf of its own at the top.
            const ownHelm = HELMETS.find((h) => h.suitOnly === s.equippedSuit && helmetRevealed(s, h.id));
            if (ownHelm && !locked) {
                grid.append(el("p", "ac-shelfhead", `${suit.name.toUpperCase()} HELMET`));
                const row = el("div", "ac-shelfrow");
                row.append(helmCard(ownHelm));
                grid.append(row);
            }
            for (const sec of HELMET_SHELF) {
                const items = sec.ids
                    .map((id) => HELMETS.find((h) => h.id === id))
                    .filter((h) => !!h && helmListed(h))
                    .sort((a, bq) => helmRank(a) - helmRank(bq));
                if (!items.length)
                    continue;
                grid.append(el("p", "ac-shelfhead", sec.title));
                const row = el("div", "ac-shelfrow");
                for (const h of items)
                    row.append(helmCard(h));
                grid.append(row);
            }
        }
        else if (engine.shopTab === "suits") {
            grid.classList.add("ac-shelfcol");
            if (s.shelfGrid)
                grid.classList.add("ac-asgrid");
            const suitCard = (u) => {
                const premium = isIap(u.id);
                const open = suitRevealed(s, u.id);
                const owned = premium ? ownsPremium(s, u.id) : s.unlockedSuits.includes(u.id);
                const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
                // same as the helmets: the worn suit says so out loud (audit)
                b.setAttribute("aria-pressed", String(s.equippedSuit === u.id));
                b.dataset.focus = `suit:${u.id}`;
                const claim = !premium && open && !owned && u.cost <= 0;
                b.append(suitCardOf(u, 64), document.createTextNode(`${u.name}\n${premium ? (owned ? "OWNED" : "PREMIUM")
                    : !open ? (STAR_UNLOCKS.suits[u.id] !== undefined ? `\u2605 ${STAR_UNLOCKS.suits[u.id]}` : "LOCKED")
                        : owned ? "OWNED" : ""}`));
                if (claim)
                    b.append(collectTag());
                if (!premium && open && !owned && u.cost > 0)
                    b.append(costTag(u.cost));
                // a fixed head takes no helmet; the card says so up front
                if (wearsOwnHead(u)) {
                    const nh = el("span", "ac-nohelm");
                    nh.title = u.id === "arcflash" ? "Integrated look · cannot change" : OWN_HEAD_LINE;
                    b.append(nh);
                }
                // owned premium keeps its bloom; unowned premium never reaches here
                if (premium)
                    markPremium(b, u.glow);
                if (s.guide === "hangar" && u.id === GUIDE_SUIT)
                    b.classList.add("ac-pulse", "ac-guidetarget");
                b.onclick = () => { if (!premium || owned)
                    spend(b, u.name, u.cost, owned, () => engine.buySuit(u.id)); };
                if (open && (!premium || owned))
                    b.append(favStar(u.id));
                return b;
            };
            const favSuits = favShelf(SUITS.filter((u) => !isIap(u.id) || ownsPremium(s, u.id)).map((u) => u.id), (id) => { const u = SUITS.find((x) => x.id === id); return u ? suitCard(u) : null; });
            if (favSuits)
                grid.append(favSuits);
            for (const sec of SUIT_SHELF) {
                const items = sec.ids
                    .map((id) => SUITS.find((x) => x.id === id))
                    .filter((u) => !!u)
                    // premium you do not own belongs in the shop, not the wardrobe -
                    // except on the PURCHASED row, where it shows as a door to the
                    // shop so a pilot can see what is for sale (owner, 7 Sep 2026:
                    // "arcflash is only in SHOP")
                    .filter((u) => !isIap(u.id) || ownsPremium(s, u.id))
                    // cheapest first, so the shelf reads as a ladder rather than a
                    // pile. Owned things lead (nothing left to pay), then acorn
                    // prices in order, then star gates by their star price.
                    .sort((a, bq) => suitRank(a) - suitRank(bq));
                // ONE DOOR PER ROW (owner, 7 Sep 2026): the premium suits this row
                // sells that the pilot does not own become a single "in the store"
                // card at the end of the row, not a card apiece.
                const inStore = sec.ids.filter((id) => SUITS.some((x) => x.id === id) && isIap(id) && !ownsPremium(s, id));
                if (!items.length && !inStore.length)
                    continue;
                grid.append(el("p", "ac-shelfhead", sec.title));
                const row = el("div", "ac-shelfrow");
                // Aurora and Stardust left this shelf for the beta bench (their
                // banks drifted); production shows one placeholder card in their
                // spot so the row reads "more coming", not "two got deleted".
                // the "NEW SUITS · In the workshop" placeholder that used to sit here
                // is gone (owner, 7 Sep 2026: "useless")
                for (const u of items)
                    row.append(suitCard(u));
                if (inStore.length) {
                    const sq = el("button", "ac-card ac-shopcard");
                    sq.append(el("span", "ac-shopglyph", "+"), document.createTextNode(`${inStore.length} IN THE STORE`));
                    sq.setAttribute("aria-label", `${inStore.length} suit${inStore.length === 1 ? "" : "s"} in the store`);
                    sq.onclick = () => engine.open("shop");
                    row.append(sq);
                }
                grid.append(row);
            }
        }
        else if (engine.shopTab === "trails") {
            if (s.equippedSuit === "vanguard")
                grid.append(el("p", "ac-sub", "AcorNut carries its own wake. Your previous trail returns when you change suits."));
            if (s.equippedSuit === "arcflash")
                grid.append(el("p", "ac-sub", "Arcflash carries its own blue electrical wake. Your previous trail returns when you change suits."));
            // BUILT-IN WAKES (owner, 7 Sep 2026): AcorNut's and Arcflash's trails
            // are part of the character - no other suit can wear them and they
            // cannot be taken off - so they are listed only while that suit is
            // worn, as one fixed card, and never as a choice for anyone else.
            const builtInOf = (id) => id === "vanguardwake" ? "vanguard" : id === "arcflashwake" ? "arcflash" : null;
            const trailCard = (t) => {
                const premium = isIap(t.id);
                const open = trailUnlocked(s, t.id);
                const compatible = canWearTrail(t.id, s.equippedSuit);
                const builtIn = builtInOf(t.id);
                if (builtIn) {
                    const b = el("button", "ac-card on ac-builtintrail");
                    const { c, ctx } = miniCanvas(64, 56);
                    c.setAttribute("role", "img");
                    c.setAttribute("aria-label", `${t.name} trail preview`);
                    if (ctx)
                        paintTrailPreview(ctx, t, 32, 28, performance.now() / 1000);
                    b.append(c, document.createTextNode(`${t.name}\nBUILT-IN TRAIL`));
                    b.disabled = true;
                    return b;
                }
                const b = el("button", trailWornBy(s.equippedTrail, s.equippedSuit) === t.id ? "ac-card on" : "ac-card");
                // the worn trail says so out loud, not in a border (audit)
                b.setAttribute("aria-pressed", String(trailWornBy(s.equippedTrail, s.equippedSuit) === t.id));
                b.dataset.focus = `trail:${t.id}`;
                const { c, ctx } = miniCanvas(64, 56);
                c.setAttribute("role", "img");
                c.setAttribute("aria-label", `${t.name} trail preview`);
                if (ctx)
                    paintTrailPreview(ctx, t, 32, 28, performance.now() / 1000);
                // A trail has no unclaimed state: unlocking one IS owning it, and
                // the tap only ever equips. "EARNED" was OWNED wearing the wrong
                // word, so it says OWNED - there is no reward here to collect.
                b.append(c, document.createTextNode(`${t.name}\n${open ? "OWNED"
                    : premium ? "PREMIUM"
                        : `\u2605 ${STAR_UNLOCKS.trails[t.id]}`}`));
                if (premium)
                    markPremium(b, t.colors[0]);
                if (!open || !compatible)
                    b.classList.add("ac-cardoff");
                b.disabled = !compatible;
                if (!compatible)
                    b.append(el("span", "ac-sub", t.id === "vanguardwake" ? "AcorNut only" : t.id === "arcflashwake" ? "Arcflash only" : "Change suit to wear"));
                b.onclick = () => { if (open && compatible)
                    tx(b, () => engine.buyTrail(t.id), t.cost); };
                if (open)
                    b.append(favStar(t.id));
                return b;
            };
            const listed = TRAILS.filter((x) => (!isIap(x.id) || ownsPremium(s, x.id)) && (!builtInOf(x.id) || builtInOf(x.id) === s.equippedSuit));
            const favTrails = favShelf(listed.map((t) => t.id), (id) => { const t = TRAILS.find((x) => x.id === id); return t ? trailCard(t) : null; });
            if (favTrails) {
                grid.classList.add("ac-shelfcol");
                grid.append(favTrails);
                grid.append(el("p", "ac-shelfhead", "ALL TRAILS"));
                const row = el("div", "ac-shelfrow");
                for (const t of listed)
                    row.append(trailCard(t));
                grid.append(row);
            }
            else {
                for (const t of listed)
                    grid.append(trailCard(t));
            }
        }
        else if (engine.shopTab === "pals") {
            // Pals carry a sentence, not a two-word tag, so their shelf runs two
            // wide where everything else runs four.
            grid.classList.add("ac-palgrid");
            // PAL EFFECTS OFF lives with the pals (owner, 2 Sep 2026). It is the
            // switch that makes every card below cosmetic, so it sits above them
            // rather than on a tab of its own.
            const fx = el("button", "ac-card ac-modcard ac-palfx" + (s.noPalFx ? " on" : ""));
            const ftxt = el("div", "ac-modtxt");
            ftxt.append(el("p", "ac-modname", "Pal Effects Off"), el("p", "ac-sub", "Fly with any companion for the look alone - none of its effect."));
            const fsw = el("span", s.noPalFx ? "ac-switch on" : "ac-switch");
            fsw.append(el("i", "ac-knob"));
            fx.append(ftxt, fsw);
            // IT IS A SWITCH, SO IT SAYS SO (audit, Sep 2026). It was drawn like
            // the Settings switches but carried none of their state, so the one
            // control that makes every pal cosmetic was a coin-flip for anyone
            // who could not see the knob. Same shape as settingsRows: the state
            // is set on the button and re-stated on the flip.
            fx.setAttribute("role", "switch");
            fx.setAttribute("aria-checked", String(!!s.noPalFx));
            fx.dataset.focus = "mod:noPalFx";
            fx.onclick = () => {
                engine.setMod("noPalFx");
                fx.setAttribute("aria-checked", String(!!engine.save.noPalFx));
            };
            grid.append(fx);
            // TWO SEATS (owner, 7 Sep 2026). One line above the shelf says how
            // the second one works - or what earns it - because a tap that now
            // dismisses a pal instead of doing nothing needs to have been said.
            grid.append(el("p", "ac-palseats", dualPalUnlocked(s)
                ? "TWO SEATS \u00b7 tap a second pal to fly it low \u00b7 tap a flying pal to dismiss it"
                : `SECOND SEAT AT \u2605 ${STAR_UNLOCKS.dualPal} \u00b7 fly two pals at once, effects stacked`));
            for (const p of PALS.filter((x) => !isIap(x.id) || ownsPremium(s, x.id)))
                grid.append(palCardOf(p));
        }
        else if (engine.shopTab === "ship") {
            box.classList.add("ac-shipmenu");
            grid.classList.add("ac-shelfcol", "ac-shipworkshop");
            if (STAR_MAP_PREVIEW) {
                const look = el("section", "ac-shiplaunch");
                look.append(el("p", "ac-kicker", "STAR MAP · APPEARANCE SAMPLE"), el("h3", "", "Rust Belt salvage kit"), el("p", "ac-sub", "Ship appearance only. Your upgrades and utilities stay fitted."));
                const appearance = spillAppearance(s);
                for (const [kind, id, label] of [["finish", "rust-runner", "Rust Runner ship finish"], ["trail", "rust-wake", "Rust Wake exhaust"]]) {
                    const b = el("button", "ac-ghost", `${appearance[kind] === id ? "✓ " : ""}${label}`);
                    b.setAttribute("aria-pressed", String(appearance[kind] === id));
                    b.onclick = () => engine.setSpillAppearance(kind, appearance[kind] === id ? "stock" : id);
                    look.append(b);
                }
                const concept = el("div", "ac-sub");
                const pal = miniCanvas(64, 64);
                if (pal.ctx)
                    paintPalPreview(pal.ctx, engine.art, "tinbot", 32, 32, 52);
                concept.append(pal.c, el("b", "", "Rivet · placeholder concept"), el("p", "", "Tinbot artwork stands in for a future Debris Field-only cosmetic companion. No companion ability or equip option is added by this sample."));
                look.append(concept);
                grid.append(look);
            }
            const launch = el("section", "ac-shiplaunch");
            launch.append(el("p", "ac-kicker", "YOUR NEXT SHIP"), el("h3", "", "Ready for a new run"), el("p", "ac-sub", "Start with 3 health and one free upgrade. Choose one earned utility below; later upgrades are bought during the run."), drawSpillStarters(engine, () => { shipPlan = null; }), drawSpillEnginePicker(engine));
            grid.append(launch);
            const plan = el("div", "ac-shipplanhead");
            plan.append(el("p", "ac-kicker", "DEPOT BUILD PREVIEW"), el("h3", "", "Plan your ship"), el("p", "ac-sub", "Inspect ship upgrades below. Upgrade tiers are purchased during a run; previewing spends nothing."));
            const actions = el("div", "ac-shipactions");
            const reset = el("button", "ac-ghost", "SHOW LAUNCH SHIP");
            reset.onclick = () => { shipPlan = null; render(); };
            actions.append(reset);
            const docked = restoreSpill(s.spillSuspended, 390, 760);
            if (docked) {
                const inspect = el("button", "ac-ghost", `VIEW SAVED BUILD · WAVE ${docked.wave}`);
                inspect.onclick = () => { shipPlan = spillBuildFromState(docked); render(); };
                actions.append(inspect);
            }
            plan.append(actions, el("p", "ac-shipreadout", `${previewShip.maxHull} HEALTH · ${previewShip.up.thrusters >= 2 ? 2 : 1} DASH CHARGE${previewShip.up.thrusters >= 2 ? "S" : ""} · ${previewShip.utilities.length}/2 UTILITIES`), el("p", "ac-sub", `Build from stock: ${spillBuildOre(shipPick, s.spillStarter)} Acorn Coins · tier costs include preceding upgrades`));
            grid.append(plan);
            for (const axis of ["plating", "thrusters", "pulse", "shield"]) {
                const shop = SPILL_SHOP[axis], isShield = axis === "shield";
                grid.append(el("p", "ac-shelfhead", `${shop.name.toUpperCase()} · ${isShield ? "PROTECTION & CANOPY" : axis === "plating" ? "MAX HEALTH" : axis === "thrusters" ? "ENGINE" : "PULSE CONE"}`));
                const row = el("div", "ac-shelfrow");
                for (let tier = 0; tier <= (isShield ? 2 : 3); tier++) {
                    const pick = { ...shipPick, [axis]: tier, specialties: { ...shipPick.specialties } };
                    if (!isShield && tier < 2)
                        pick.specialties[axis] = null;
                    const selected = shipPick[axis] === tier;
                    const b = el("button", `ac-card ac-modcard ac-shipcard${selected ? " on" : ""}`);
                    b.dataset.shipTier = `${axis}-${tier}`;
                    b.setAttribute("aria-pressed", String(selected));
                    const pic = miniCanvas(150, 82);
                    pic.c.setAttribute("aria-hidden", "true");
                    if (pic.ctx)
                        paintShipPreview(pic.ctx, engine.art, s, 93, 44, 1.5, 0, pick);
                    b.append(pic.c);
                    const txt = el("div", "ac-modtxt");
                    const name = tier === 0 ? "Stock" : isShield ? `${tier} shield charge${tier > 1 ? "s" : ""}` : `${shop.name} ${"I".repeat(tier)}`;
                    const effect = !tier ? isShield ? "Open cockpit · no charges." : axis === "plating" ? "3 health." : axis === "thrusters" ? "One dash charge." : "Gold charges the ship; add Pulse I to fire it."
                        : isShield ? "A charge absorbs a hit. The fitted canopy remains after use." : shop.levels[tier - 1];
                    txt.append(el("p", "ac-shiptier", tier ? `TIER ${tier}` : "BASELINE"), el("p", "ac-modname", name), el("p", "ac-sub", effect));
                    const price = !tier ? 0 : isShield ? shop.prices[0] * tier : shop.prices[tier - 1];
                    b.append(txt, el("span", "ac-modprice", !tier ? "STOCK" : isShield ? `${price} ACORN COINS FOR ${tier}` : `${price} ACORN COINS · STEP ${tier}`));
                    b.onclick = () => { shipPlan = pick; render(); };
                    row.append(b);
                }
                grid.append(row);
                if (!isShield) {
                    const specs = el("div", "ac-spilloptions ac-shipspecs");
                    for (const [id, spec] of Object.entries(SPILL_SPECIALTIES).filter(([, spec]) => spec.axis === axis)) {
                        const selected = previewShip.specialties[axis] === id;
                        const b = el("button", `ac-spilloption${selected ? " on" : ""}`);
                        b.disabled = shipPick[axis] < 2;
                        b.dataset.shipSpec = id;
                        b.setAttribute("aria-pressed", String(selected));
                        b.append(el("b", "", spec.name), el("span", "", spec.desc), el("strong", "", shipPick[axis] < 2 ? "REQUIRES TIER II" : selected ? "PREVIEW FITTED · FREE AT DEPOT" : "PREVIEW · FREE AT DEPOT"));
                        b.onclick = () => { shipPlan = { ...shipPick, specialties: { ...shipPick.specialties, [axis]: id } }; render(); };
                        specs.append(b);
                    }
                    grid.append(specs);
                }
            }
            // The utility shelf that sat here duplicated the Starting utility picker
            // above (owner, 7 Sep 2026); the plan previews the starter you chose.
            grid.append(el("p", "ac-shipnote", "DEPOT SERVICES · Restore all health: 30 Acorn Coins · Extra life: 150 Acorn Coins, once per run."));
        }
        scroll.append(grid);
        // Premium left these shelves, so something has to say where it went -
        // and it has to be a control, not a caption. It sits after every tab
        // rather than inside one, because the answer is the same on all of them.
        const shopBanner = el("button", "ac-shopbanner");
        const sbIc = el("span", "ac-shopbanneric");
        sbIc.append(hubIcon("gift"));
        const sbTxt = el("span", "ac-shopbannertxt");
        sbTxt.append(el("b", "", "UNLOCK PREMIUM SETS"), el("span", "", "Suits, helmets, trails and pals \u2014 sold in packs."));
        shopBanner.append(sbIc, sbTxt, el("span", "ac-shopbannergo", "\u203A"));
        shopBanner.onclick = () => engine.open("shop");
        scroll.append(shopBanner);
        // THE INSTRUCTION HAS TO FIND THE THING FOR YOU.
        //
        // Reported, and all three are true at once: the banner said "equip Ion
        // suit" while the Loadout opened on HELMETS; the Ion helmet sits in the
        // SECOND row with no sign you have to scroll to it; and two other cards
        // said COLLECT REWARD, which reads far more like the thing to press
        // than the one you were actually sent for.
        //
        // So the coach is a control now, not a caption. It names the item, and
        // pressing it scrolls that card into the middle of the screen and lights
        // it. Everything else on the shelf dims while a step is live, which is
        // what makes a COLLECT REWARD badge stop competing with the instruction.
        if (s.guide === "hangar" || s.guide === "helmet") {
            const suitStep = s.guide === "hangar";
            box.classList.add("ac-guiding");
            const c = coach(suitStep
                ? "Tap your new ION SUIT to wear it"
                : "Now the ION HELMET \u2014 tap to equip");
            c.classList.add("ac-coachfind");
            const hint = el("i", "ac-coachhint", "tap here to show me");
            c.append(hint);
            // the coach IS the fold. It is `position: sticky; bottom: 10px`, so
            // while there is shelf left to scroll it rides the bottom edge of the
            // visible area, and anything under it is a card you can neither read
            // nor press. Measuring its top beats guessing at a margin, and it
            // costs nothing to clamp to the window in case the shelf column ever
            // runs off the end of the screen.
            // Sticky needs a scrolling ancestor, and it has to be THE one. This
            // looked it up with `box.querySelector(".ac-sheet-scroll")` - which
            // runs before `box.append(scroll)` at the end of this function, so it
            // found nothing, fell back to `box`, and parked the coach ABOVE the
            // shelf (measured: coach 510-575, shelf starting at 579). Sticky never
            // engaged and the coach was a caption again. Append to the column we
            // are holding.
            const host = scroll;
            const foldY = () => Math.min(c.getBoundingClientRect().top, window.innerHeight || 1e9);
            c.onclick = () => {
                const target = box.querySelector(".ac-guidetarget");
                if (!target)
                    return;
                // "centre it" is not good enough on a short phone: the coach is
                // sticky over the bottom of the shelf, so a centred card still had
                // its lower half under the coach and the arrow stayed lit. Scroll
                // by exactly the overlap instead, and the card lands clear.
                const over = target.getBoundingClientRect().bottom - (foldY() - 10);
                if (over > 0)
                    host.scrollBy({ top: over, behavior: "smooth" });
                else
                    target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
                target.classList.add("ac-guideflash");
                window.setTimeout(() => target.classList.remove("ac-guideflash"), 1400);
            };
            host.append(c);
            // SAY IT IS DOWN THERE, WHEN IT IS.
            //
            // The Ion helmet is the FIRST card of the SECOND section - eight clear
            // visors sit above it - so on a phone the step names something that is
            // not on screen and the shelf above looks like the whole shelf. The
            // coach grows an arrow and says which way, but only after MEASURING
            // that the card is actually below the fold: on a tall screen or in
            // grid mode it may be visible already, and an arrow pointing at
            // something in plain sight is worse than none.
            //
            // Measure against what the EYE can see, which is neither of the two
            // things the first cut of this used. `frame.bottom` is the scroll
            // host's LAYOUT bottom, which runs off the end of the screen, so a
            // card at y=752 of a 900px phone measured as "already in view" and
            // the arrow never came. And `seen.top` is the wrong edge: a card
            // whose top has just crept above the fold is still unreadable and
            // untappable. So the question is whether the WHOLE card clears the
            // coach's own top edge.
            const belowFold = () => {
                const target = box.querySelector(".ac-guidetarget");
                if (!target || !c.isConnected)
                    return false;
                const seen = target.getBoundingClientRect();
                return seen.bottom > foldY();
            };
            const arrow = () => {
                const down = belowFold();
                c.classList.toggle("ac-coachdown", down);
                hint.textContent = down ? "scroll down \u2014 or tap here" : "tap here to show me";
            };
            requestAnimationFrame(arrow);
            // and it has to STOP pointing once they get there
            host.addEventListener("scroll", arrow, { passive: true });
        }
        else if (s.guide === "levels") {
            box.append(coach("Suited up! Head back \u2039 and fly Mission 1 on the STAR CHART"));
        }
        box.append(scroll);
        if (spendAsk)
            box.append(drawSpendSheet());
        return box;
    }
    // Every rank earns its OWN emblem — a cadet chevron through the
    // acornaut crown — so the Flight Log reads as a ladder of insignia
    // rather than seven identical coins.
    const RANKS = {
        CADET: { ring: ["#cfd8e8", "#7f8ca4"], face: "#39445c", mark: "chevron" },
        PILOT: { ring: ["#9fd8ff", "#3f7fb8"], face: "#123049", mark: "wings" },
        VOIDFARER: { ring: ["#c9a6ff", "#6a3fb8"], face: "#2a1550", mark: "orbit" },
        ACE: { ring: ["#ffe08a", "#c9861f"], face: "#4a3208", mark: "star" },
        "COMET CHASER": { ring: ["#ffc48a", "#d1621f"], face: "#4c2208", mark: "comet" },
        "EVENT HORIZON": { ring: ["#d0a8ff", "#4a1f8a"], face: "#120424", mark: "hole" },
        ACORNAUT: { ring: ["#fff0b0", "#b8860b"], face: "#3d2a06", mark: "acorn" },
    };
    function drawRankBadge(ctx, name, px) {
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
        }
        else if (spec.mark === "wings") {
            for (const s2 of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(c, c);
                ctx.quadraticCurveTo(c + s2 * u * 0.7, c - u * 0.75, c + s2 * u * 1.15, c - u * 0.05);
                ctx.quadraticCurveTo(c + s2 * u * 0.6, c + u * 0.2, c, c + u * 0.12);
                ctx.fill();
            }
        }
        else if (spec.mark === "orbit") {
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
        }
        else if (spec.mark === "star" || spec.mark === "acorn") {
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
            }
            else {
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
        }
        else if (spec.mark === "comet") {
            ctx.beginPath();
            ctx.arc(c + u * 0.42, c - u * 0.28, u * 0.42, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(c + u * 0.16, c - u * 0.6);
            ctx.lineTo(c - u * 1.05, c + u * 0.75);
            ctx.lineTo(c + u * 0.2, c + u * 0.08);
            ctx.closePath();
            ctx.fill();
        }
        else {
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
    /** The rail feeds this both TRACK entries and STAR_REWARDS rows, and the
     *  two do not share a kind union - callers were casting to TRACK's type to
     *  paper over it, which is exactly why a new "dust" kind type-checked at
     *  the call site and painted nothing here. The parameter now admits what
     *  it is actually given. */
    function rewardArt(item, px = 52) {
        const wrap = el("div", "ac-rewardwithpin");
        wrap.append(rewardArtPicture(item, px));
        return wrap;
    }
    function rewardArtPicture(item, px = 52) {
        if (item.kind === "suit" && item.id) {
            const suit = SUITS.find((u) => u.id === item.id);
            if (suit)
                return suitCardOf(suit, px);
        }
        if (item.kind === "helmet" && item.id) {
            const helm = HELMETS.find((h) => h.id === item.id);
            if (helm)
                return helmCardOf(helm, px);
        }
        if (item.kind === "trail" && item.id) {
            const t = TRAILS.find((x) => x.id === item.id);
            if (t) {
                const { c, ctx } = miniCanvas(px, px);
                if (ctx)
                    paintTrailPreview(ctx, t, px / 2, px / 2, performance.now() / 1000);
                return c;
            }
        }
        const { c, ctx } = miniCanvas(px, px);
        const art = engine.art;
        if (!ctx || !art)
            return c;
        if (item.kind === "pal" && item.id) {
            paintPalPreview(ctx, art, item.id, px / 2, px / 2, px * 0.86);
        }
        else if (item.kind === "mode") {
            // mode emblems from the exotic planet art: the black hole for Deep
            // Space, the blue vortex for Lost in Space
            const idx = item.name === "Lost in Space" ? 8 : 17;
            drawSpriteOn(ctx, art.planets?.[idx] ?? null, px / 2, px / 2, px * 0.9);
        }
        else if (item.kind === "mod" && item.id === "dualpal") {
            // two companions, one high and one low - the reward is the seat
            paintPalPreview(ctx, art, "buddy", px * 0.62, px * 0.34, px * 0.56);
            paintPalPreview(ctx, art, "bee", px * 0.38, px * 0.7, px * 0.56);
        }
        else if (item.kind === "mod") {
            drawSpriteOn(ctx, art.shield?.[0] ?? null, px / 2, px / 2, px * 0.82);
        }
        else if (item.kind === "title") {
            drawRankBadge(ctx, item.name ?? "", px);
        }
        else if (item.kind === "acorns") {
            // the 597-star cargo hold (owner's chart, PR #222): the acorn itself
            drawSpriteOn(ctx, art.acorn?.[0] ?? null, px / 2, px / 2, px * 0.82);
        }
        else if (item.kind === "dust") {
            // the same four-point crystal the counter and the shop use, drawn by
            // hand because the rail paints to canvas rather than mounting an svg
            ctx.save();
            ctx.translate(px / 2, px / 2);
            ctx.scale(px / 24, px / 24);
            const g = ctx.createLinearGradient(0, -10, 0, 10);
            g.addColorStop(0, "#e6dbff");
            g.addColorStop(0.5, "#b494ff");
            g.addColorStop(1, "#6d3fd1");
            ctx.fillStyle = g;
            ctx.shadowColor = "rgba(150,110,255,.9)";
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(0, -9.8);
            ctx.lineTo(1.9, -3);
            ctx.lineTo(8.4, 0);
            ctx.lineTo(1.9, 3);
            ctx.lineTo(0, 9.8);
            ctx.lineTo(-1.9, 3);
            ctx.lineTo(-8.4, 0);
            ctx.lineTo(-1.9, -3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        return c;
    }
    // ------------------------------------------------------------ star chart
    // The Flight Log used to live here: an XP meter and a list of things
    // that would eventually happen to you. The Star Chart replaces it with
    // things you can DO — a hundred levels in ten stages, three stars each,
    // and the rewards hung on star totals instead of mileage.
    function starPips(mask, size = "") {
        const wrap = el("span", "ac-pips" + (size ? " " + size : ""));
        for (let b = 0; b < 3; b++) {
            wrap.append(el("span", (mask >> b) & 1 ? "ac-pip on" : "ac-pip", "\u2605"));
        }
        return wrap;
    }
    function hyperRunMask() {
        const record = engine.save.raceRecords?.[HYPER_RUN_MISSION.id];
        if (!record?.bestFinishTicks)
            return 0;
        return HYPER_RUN_MISSION.goals.reduce((mask, goal, i) => {
            const met = goal.kind === "finish"
                || (goal.kind === "time" && record.bestFinishTicks <= goal.ticks);
            return met ? mask | (1 << i) : mask;
        }, 0);
    }
    // ------------------------------------------------------------ the road
    // ONE road, bottom-up: numbered missions climbing from the
    // first flight at the very bottom of the scroll to the last at the top.
    // No chapters, no tabs, no level names — a planet, a number, and up to
    // three stars each. Star rewards ride a milestone rail down the right
    // edge, level with the mission whose three-star ceiling first covers
    // their price, greyed until banked.
    function fullChart(stars, total) {
        const levels = CHART_LEVELS;
        const gatesDone = engine.save.raceGates || [];
        const W = Math.min(460, Math.max(292, window.innerWidth - 32));
        const railW = 78; // the milestone rail owns the right edge
        const roadW = W - railW;
        const railX = roadW + Math.round(railW / 2);
        const step = 92;
        const H = (STAR_MAP_PREVIEW ? 180 : 70) + (levels.length - 1) * step + 84;
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
        const seg = (pts, bright) => {
            if (pts.length < 2)
                return;
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
        if (split < pos.length)
            seg(pos.slice(Math.max(0, split - 1)), false);
        map.append(svg);
        // EVERY star reward rides the milestone rail down the right edge —
        // pals, trails, mods, suits, helmets, modes, titles — each level with
        // the mission whose three-star ceiling first covers its price, pushed
        // apart just enough that neighbours never overlap. The rail scrolls
        // with the road, so climbing the map walks the reward ladder too.
        const miles = [
            ...STAR_REWARDS.filter((r) => r.kind !== "stage" && r.stars <= levels.length * 3).map(r => ({ ...r, planned: false })),
            ...(STAR_MAP_PREVIEW ? PLANNED_STAR_REWARDS.map(r => ({ ...r, planned: true })) : []),
        ]
            .sort((a, b) => a.stars - b.stars);
        const gap = 112;
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
        const lastEarned = miles.reduce((acc, r, i) => (!r.planned && total >= r.stars ? i : acc), -1);
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
            // a reward opened ahead of its stars with a Star Unlock reads as earned
            const have = !r.planned && (total >= r.stars || rewardOwned(engine.save, r));
            const mark = el("button", r.planned ? "ac-palmark mile planned" : have ? "ac-palmark mile earned" : "ac-palmark mile");
            mark.style.left = `${railX}px`;
            mark.style.top = `${mileY[i]}px`;
            mark.append(r.planned ? proposedRewardArt(r, 40) : rewardArt({ kind: r.kind, id: r.id, name: r.name }, 40));
            mark.append(el("span", "ac-palmarkstar", `\u2605 ${r.stars}`));
            mark.append(el("span", "ac-rmarkname", r.name));
            if (r.planned) {
                mark.dataset.plannedReward = r.id;
                mark.setAttribute("aria-label", `Proposed reward at ${r.stars} stars: ${r.name}. Preview concept.`);
                mark.append(el("span", "ac-concept-label", "CONCEPT"));
                mark.onclick = () => { rewardPreviewAt = r.id ?? "all"; render(); };
            }
            else {
                // every real reward opens its sheet: what it is, how far off it is,
                // and the Star Unlock that skips the wait
                const key = rewardId(r);
                // "yours" only when it really is: a priced rung is revealed, and
                // the Loadout still has a price on it (audit, Sep 2026)
                const due = have ? rewardDue(r) : 0;
                mark.setAttribute("aria-label", `Reward at ${r.stars} stars: ${r.name}${have ? (due ? `, revealed for ${due} acorns` : ", yours") : ""}`);
                mark.onclick = () => { rewardOpen = key; boostNote = null; render(); };
            }
            map.append(mark);
        });
        levels.forEach((lvl, i) => {
            const mask = (1 << missionCredit(engine.save, lvl)) - 1;
            const can = levelUnlocked(lvl, stars, total, gatesDone);
            const isCur = i === current;
            const done = ((stars[lvl.id] || 0) & 1) === 1;
            const node = el("button", "ac-mapnode" + (isCur ? " cur" : done ? " done" : can ? " todo" : " locked"));
            node.style.left = `${pos[i].x}px`;
            node.style.top = `${pos[i].y}px`;
            // Pips used to render on any UNLOCKED level, which in practice meant
            // only the first level of each star-opened chapter - so 11, 21 and 31
            // wore three grey stars and nothing else did. Stars appear when there
            // are stars to show.
            if (mask)
                node.append(starPips(mask, "sm"));
            const px = isCur ? 84 : 62;
            const disc = el("span", "ac-mapdisc");
            disc.style.width = disc.style.height = `${px}px`;
            node.dataset.level = lvl.id;
            node.dataset.order = String(lvl.ord);
            node.setAttribute("aria-label", `Level ${lvl.ord}: ${lvl.name}, ${ENVS[lvl.fx.env ?? 0].name}, ${missionCredit(engine.save, lvl)} stars${!can ? lvl.implemented === false ? ", unavailable" : ", locked" : ""}`);
            node.setAttribute("aria-disabled", String(!can));
            if (isCur) {
                const rider = document.createElement("img");
                rider.src = `${artRootUrl()}/squirrel/idle-1.png?v=${ART_VER}`;
                rider.alt = "";
                rider.className = "ac-maprider";
                disc.append(rider);
            }
            if (!can)
                disc.append(icon(I_LOCK, 20));
            disc.append(el("span", "ac-mapnum", String(i + 1)));
            node.append(disc);
            if (can)
                node.onclick = () => { chartLevel = lvl.id; render(); };
            if (engine.save.guide === "levels" && lvl.id === "1-1")
                node.classList.add("ac-pulse");
            map.append(node);
        });
        // THE DEBRIS FIELDS. A single node was the wrong shape for this: it sat
        // on one point of a nine-thousand-pixel scroll and read as another
        // planet. A field BLOCKS, so it is drawn as one - a line of rubble laid
        // clean across the road at the level it follows. Each gate takes its own
        // debris sprite so the three are told apart at a glance, and the line
        // stops short of the milestone rail so it never buries a reward.
        for (let gi = 0; gi < RACE_GATES.length; gi++) {
            const g = RACE_GATES[gi];
            const i = g.after - 1;
            if (i < 0 || i >= pos.length)
                continue;
            const here = pos[i];
            const beyond = pos[i + 1] ?? { x: here.x, y: here.y - step };
            const y = Math.round((here.y + beyond.y) / 2);
            const done = gatesDone.includes(g.after);
            // A FIELD YOU HAVE NOT REACHED IS NOT YOURS TO CLEAR. "blocking" only
            // meant "first uncleared gate", so on a save with nothing flown the
            // field at 33 was live: a pilot could fly Hyper Run from the chart,
            // beat 2:30, clear the gate and unlock the mode without ever having
            // played a level. It blocks the road at 33, so it opens when you
            // arrive at 33 - which means having finished it.
            const arrived = ((stars[levelAt(g.after)?.id ?? ""] || 0) & 1) === 1;
            const blocking = !done && arrived
                && !RACE_GATES.some((o) => o.after < g.after && !gatesDone.includes(o.after));
            const band = el("div", `ac-debris${done ? " done" : blocking ? " blocking" : " locked"}`);
            band.style.top = `${y}px`;
            band.style.width = `${roadW}px`; // the road only: the rail keeps its lane
            // one sprite, repeated along the line at varying size and tilt so it
            // reads as rubble rather than as a row of identical stamps
            const bank = engine.art?.debris ?? [];
            const spriteIdx = mapDebrisIndex(levels[i].fx.env ?? 0, gi);
            const COUNT = 9;
            for (let k = 0; k < COUNT; k++) {
                const px = 16 + ((k * 7 + gi * 5) % 3) * 5; // 16 / 21 / 26
                const { c, ctx } = miniCanvas(px, px);
                if (ctx && bank.length)
                    drawSpriteOn(ctx, bank[spriteIdx] ?? null, px / 2, px / 2, px);
                const bit = el("span", "ac-debrisbit");
                bit.style.left = `${Math.round((k + 0.5) / COUNT * roadW)}px`;
                bit.style.transform = `translate(-50%,-50%) rotate(${(k * 47 + gi * 23) % 360}deg)`;
                bit.append(c);
                band.append(bit);
            }
            map.append(band);
            // the label rides the line rather than floating beside it
            const tag = el("button", `ac-debristag${done ? " done" : blocking ? " blocking" : " locked"}`);
            tag.style.top = `${y}px`;
            tag.style.left = `${Math.round(roadW / 2)}px`;
            const ship = document.createElement("img");
            ship.src = `${artRootUrl()}/hyper-run/scout-ship.png?v=${ART_VER}`;
            ship.alt = "";
            ship.className = "ac-debrisship";
            tag.append(ship, el("b", "", done ? "CLEAR" : g.label));
            tag.setAttribute("aria-label", done
                ? `Debris field after level ${g.after}: cleared`
                : `Debris field after level ${g.after}. Finish Hyper Run in ${g.label} to pass.`);
            if (blocking || done)
                tag.onclick = () => { hyperRunOpen = true; render(); };
            else
                tag.disabled = true;
            if (!done && !blocking && !arrived) {
                tag.setAttribute("aria-label", `Debris field after level ${g.after}. Reach level ${g.after} to attempt it.`);
            }
            if (blocking)
                tag.dataset.blockingBarrier = "true";
            map.append(tag);
        }
        const end = el("p", "ac-chart-end", current < 0 && levels.every(l => stars[l.id] & 1)
            ? "CURRENT CHART COMPLETE · MORE SKY AHEAD" : "THE ROAD CONTINUES");
        end.style.top = "0px";
        map.append(end);
        disposeChart = addChartScenery(map, levels, pos, step, engine.art);
        const wrap = el("div", "ac-chartmapwrap");
        wrap.append(map);
        return wrap;
    }
    let chartLevel = null; // level detail overlay
    let rewardPreviewAt = null;
    function proposedRewardArt(item, px) {
        if (item.kind === "spill-pal")
            return rewardArt({ kind: "pal", id: "tinbot" }, px);
        if (!item.kind.startsWith("spill-"))
            return rewardArt(item, px);
        const { c, ctx } = miniCanvas(px, px);
        const save = { ...engine.save, spillAppearance: {
                finish: item.id === "rust-runner" ? "rust-runner" : "stock",
                trail: item.id === "rust-wake" ? "rust-wake" : "stock",
            } };
        if (ctx)
            paintShipPreview(ctx, engine.art, save, px * .57, px * .5, px / 80, 0, { plating: 1, thrusters: 1, pulse: 1, shield: 1 });
        return c;
    }
    function drawRewardPreview() {
        const wrap = el("div", "ac-lvlsheet");
        const sheet = el("section", "ac-lvlcard ac-reward-preview");
        sheet.setAttribute("role", "dialog");
        sheet.setAttribute("aria-modal", "true");
        sheet.setAttribute("aria-label", "Proposed Star Map rewards");
        sheet.append(el("p", "ac-kicker", "320–780 STARS · PROPOSED"), el("h2", "", "Reward preview"), el("p", "ac-sub", "Concepts for the expanded road. These rewards are not earnable yet. Your existing rewards stay yours."));
        const close = () => { rewardPreviewAt = null; render(); overlay.querySelector("[data-reward-preview]")?.focus({ preventScroll: true }); };
        const back = el("button", "ac-ghost", "Back to chart");
        back.onclick = close;
        sheet.append(back);
        const grid = el("div", "ac-reward-concepts");
        for (const reward of PLANNED_STAR_REWARDS) {
            const card = el("article", "ac-reward-concept");
            card.dataset.rewardConcept = reward.id;
            const proof = reward.id === "rust-runner" || reward.id === "rust-wake";
            const placeholder = reward.kind.startsWith("spill-") && !proof;
            card.append(proposedRewardArt(reward, 96), el("p", "ac-kicker", `★ ${reward.stars} · PROPOSED`), el("h3", "", reward.name), el("p", "ac-sub", reward.description), el("small", "ac-concept-label", placeholder ? "PLACEHOLDER ART" : proof ? "APPEARANCE SAMPLE" : "PROPOSED REWARD"));
            grid.append(card);
        }
        sheet.append(grid);
        wrap.append(sheet);
        wrap.onclick = event => { if (event.target === wrap)
            close(); };
        wrap.onkeydown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                close();
            }
            else if (event.key === "Tab") {
                event.preventDefault();
                back.focus();
            }
        };
        requestAnimationFrame(() => {
            if (!sheet.isConnected)
                return;
            back.focus({ preventScroll: true });
            if (rewardPreviewAt !== "all")
                [...grid.children].find(c => c.dataset.rewardConcept === rewardPreviewAt)?.scrollIntoView({ block: "nearest" });
        });
        return wrap;
    }
    /** WHAT A RUNG STILL COSTS - which, by rule, is now nothing.
     *
     *  Nine helmet rungs used to REVEAL their helmet for acorns rather than
     *  hand it over, so the rail, the reward sheet and the level-done screen
     *  all said the Void Helmet was yours while the Loadout went on charging
     *  90 for it (audit, Sep 2026). The owner settled it the other way: those
     *  rungs pay acorns instead, the helmets keep their shelf gate at the same
     *  star count, and a rung either grants outright or is not a rung. That
     *  invariant is held by test-star-map, so this answers 0 for every reward
     *  on the road today. It stays because it is the check the Loadout card
     *  itself makes: if a priced item is ever dropped onto a rung again, these
     *  screens say what it costs rather than calling it yours. */
    function rewardDue(r) {
        if (!r.id || isIap(r.id))
            return 0;
        const s = engine.save;
        if (r.kind === "helmet") {
            const h = HELMETS.find((x) => x.id === r.id);
            return h && !s.unlocked.includes(h.id) ? h.cost : 0;
        }
        if (r.kind === "suit") {
            const u = SUITS.find((x) => x.id === r.id);
            return u && !s.unlockedSuits.includes(u.id) ? u.cost : 0;
        }
        return 0;
    }
    /** ONE REWARD ON THE RAIL, opened: what it is, how far off it is, and -
     *  when a Star Unlock is held - the hold that opens it now. */
    function drawRewardSheet(key) {
        const wrap = el("div", "ac-lvlsheet");
        const r = STAR_REWARDS.find((x) => rewardId(x) === key);
        if (!r)
            return wrap;
        const s = engine.save;
        const have = starsOf(s);
        const owned = rewardOwned(s, r);
        const close = () => { rewardOpen = null; boostNote = null; render(); };
        const sheet = el("div", "ac-lvlcard ac-rewardsheet");
        sheet.append(el("p", "ac-kicker", `★ ${r.stars} STARS · ${REWARD_KIND[r.kind] ?? r.kind.toUpperCase()}`));
        const art = el("div", "ac-rewardbig");
        art.append(rewardArt({ kind: r.kind, id: r.id, name: r.name }, 96));
        sheet.append(art, el("h2", "ac-lvlname", r.name), el("p", "ac-sub", r.desc));
        const paidInstead = s.rewardSubs?.[key];
        // a priced rung opens the item on the shelf; it does not buy it
        const due = rewardDue(r);
        sheet.append(el("p", "ac-sub ac-rewardstate", paidInstead
            ? `Already yours — this rung paid ${paidInstead.amount.toLocaleString()} ${paidInstead.kind === "dust" ? "Star Dust" : "acorns"} instead.`
            : owned ? (have >= r.stars
                ? (due > 0 ? `Open in the Loadout — ${due.toLocaleString()} acorns.` : "Yours.")
                : `Yours already. When the road reaches ${r.stars} stars this rung pays ${SUB_ACORNS} acorns instead.`)
                : `${have} of ${r.stars} stars — ${r.stars - have} to go.`));
        const item = r.kind !== "acorns" && r.kind !== "dust" && !!r.id;
        if (!owned && item) {
            if (boostReady(s, "starunlock")) {
                const held = s.boosts.starunlock;
                const b = el("button", "ac-primary ac-holdbtn ac-unlockbtn");
                b.append(boostArt("starunlock", 24), el("span", "", `HOLD TO USE STAR UNLOCK · ${held} HELD`));
                holdToFire(b, 700, () => {
                    const out = engine.useStarUnlock(key);
                    if (out === "ok") {
                        boostNote = null;
                        render();
                        return;
                    }
                    boostNote = DENY_TEXT[out]?.() ?? "That unlock did not land.";
                    render();
                });
                sheet.append(b);
                if (boostNote)
                    sheet.append(el("p", "ac-deny on ac-boostnote", boostNote));
            }
            else {
                const go = el("button", "ac-ghost ac-unlockgo");
                go.append(boostArt("starunlock", 22), el("span", "", `STAR UNLOCK · ${BOOSTS.starunlock.dust} IN THE SHOP`));
                go.onclick = () => { rewardOpen = null; engine.open("shop"); };
                sheet.append(go, el("p", "ac-fine", "Or earn it on the road."));
            }
        }
        const back = el("button", "ac-ghost", "BACK");
        back.onclick = close;
        sheet.append(back);
        wrap.append(sheet);
        wrap.onclick = (e) => { if (e.target === wrap)
            close(); };
        return wrap;
    }
    function drawLog() {
        const sv = engine.save;
        const stars = routeMasks(sv, CHART_LEVELS);
        const total = starsOf(sv);
        const box = el("div", "ac-menu");
        box.classList.add("ac-chartscene", "ac-zone-chart");
        const totalPill = el("div", "ac-pill ac-pill-gold");
        totalPill.append(el("span", "ac-pip on", "\u2605"), el("span", "", `${total} / ${CHART_MAX_STARS}`));
        box.append(header(STAR_MAP_PREVIEW ? "260 missions · all unlocked in beta" : `${CHART_LEVELS.length} missions · the road ahead`, "Star Chart", totalPill));
        const nav = el("div", "ac-chart-nav");
        nav.append(el("span", "ac-current-zone", "DEEP SPACE"));
        const goTo = (id) => {
            const target = id ? [...box.querySelectorAll(".ac-mapnode")].find(n => n.dataset.level === id)
                : box.querySelector("[data-blocking-barrier], .ac-mapnode.cur");
            target?.scrollIntoView({ block: "center", behavior: engine.save.motionOff ? "auto" : "smooth" });
            target?.focus({ preventScroll: true });
        };
        // no find box (owner, 6 Sep 2026: "no searching needed") - the road
        // scrolls, and Return to pilot brings the current mission back
        const pilot = el("button", "ac-ghost", "Return to pilot");
        pilot.onclick = () => goTo();
        nav.append(pilot);
        box.append(nav);
        // A HELD BOOST SAYS WHERE IT GOES. The Shop lands here right after a
        // purchase, and the Profile's USE NOW does too, so the first thing on
        // the chart is what to tap next.
        for (const id of BOOST_IDS) {
            const n = sv.boosts?.[id] ?? 0;
            if (!n)
                continue;
            const arm = el("div", "ac-boostarm");
            arm.append(boostArt(id, 34));
            const t = el("span", "");
            t.append(el("b", "", `${BOOSTS[id].name} · ${n} held`), el("span", "", id === "levelskip" ? "Open a mission and hold LEVEL SKIP." : "Tap a reward on the rail and hold STAR UNLOCK."));
            arm.append(t);
            box.append(arm);
        }
        if (STAR_MAP_PREVIEW) {
            const samples = el("div", "ac-chart-samples");
            const rewards = el("button", "ac-ghost", "Reward preview");
            rewards.dataset.rewardPreview = "true";
            rewards.onclick = () => { rewardPreviewAt = "all"; render(); };
            samples.append(rewards);
            for (const [ord, name] of [[1, "Deep Space"], [101, "Rust Belt"], [241, "Blackout Zone"]]) {
                const b = el("button", "ac-ghost", name);
                b.onclick = () => goTo(levelAt(ord)?.id);
                samples.append(b);
            }
            box.append(samples);
        }
        const scroll = el("div", "ac-sheet-scroll");
        // The rewards ladder left this screen: every reward hangs on the road
        // itself, at the level its stars can first be earned.
        scroll.append(fullChart(stars, total));
        if (sv.guide === "levels")
            box.append(coach("Fly MISSION 1 \u2014 tap level 1, then TAKE FLIGHT"));
        box.append(scroll);
        // level detail: goals, modifiers, and the FLY button
        if (chartLevel) {
            const def = CHART_LEVELS.find((l) => l.id === chartLevel);
            if (def)
                box.append(drawLevelSheet(def, verifiedMask(sv, def)));
        }
        if (STAR_MAP_PREVIEW && rewardPreviewAt)
            box.append(drawRewardPreview());
        if (rewardOpen)
            box.append(drawRewardSheet(rewardOpen));
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
    function drawLevelSheet(def, mask, origin = "chart") {
        const wrap = el("div", "ac-lvlsheet");
        const sheet = el("div", "ac-lvlcard");
        const raceBriefing = def.standalone && def.base === "race";
        if (raceBriefing)
            sheet.classList.add("ac-racecard");
        // Names and zone clues follow the same continuous road on both pages.
        const place = def.base === "race" ? "HYPER RUN"
            : def.base === "tunnel" ? "WORMHOLE RUN"
                : def.base === "spill" ? "DEBRIS FIELD"
                    : ENVS[def.fx.env ?? 0]?.name ?? "";
        sheet.append(el("p", "ac-kicker", def.standalone
            ? "HYPER RUN · TIME TRIAL"
            : `LEVEL ${def.ord} \u00b7 ${place}`));
        sheet.append(el("h2", "ac-lvlname", def.name));
        if (def.challenge)
            sheet.append(el("p", "ac-sub", def.challenge));
        if (def.durationTarget)
            sheet.append(el("p", "ac-sub", `First-pass target: ${def.durationTarget[0]}–${def.durationTarget[1]} seconds of play${def.base === "spill" ? "; Depot time is unlimited" : ""}.`));
        const mode = def.base === "race" ? "DETERMINISTIC TIME TRIAL" :
            def.base === "deep" ? "DEEP SPACE RULES" :
                def.base === "lost" ? "LOST IN SPACE RULES" :
                    def.base === "arcade" ? "ARCADE TIMELINE" :
                        def.base === "tunnel" ? "WORMHOLE MISSION" :
                            def.base === "spill" ? "DEBRIS FIELD MISSION" : "";
        const fxs = fxText(def.fx);
        if (mode || fxs.length) {
            const tags = el("div", "ac-lvltags");
            if (mode)
                tags.append(el("span", "ac-lvltag mode", mode));
            for (const t of fxs)
                tags.append(el("span", "ac-lvltag", t));
            sheet.append(tags);
        }
        if (raceBriefing) {
            const briefing = el("div", "ac-racebrief");
            const objective = el("section", "ac-racebriefblock ac-raceobjective");
            const aims = el("ul", "ac-brieflist");
            for (const line of [
                "Thread blue gates to build speed and charge the wormhole.",
                "Shortcuts save time. Finish fast.",
                "Acorns are an optional collection record and do not change your time.",
            ])
                aims.append(el("li", "", line));
            objective.append(el("h3", "", "OBJECTIVE"), aims);
            const controlRow = (input, action) => {
                const row = el("div", "ac-racecontrol");
                row.append(el("b", "", input), el("span", "", action));
                return row;
            };
            const flight = el("section", "ac-racebriefblock");
            flight.append(el("h3", "", "SPACE FLIGHT"), controlRow("HOLD", "Rise"), controlRow("RELEASE", "Fall"), controlRow("DOUBLE-TAP + HOLD", "Boost climb"), controlRow("SWIPE DOWN", "Dive"));
            const wormhole = el("section", "ac-racebriefblock");
            wormhole.append(el("h3", "", "WORMHOLE"), controlRow("PRESS + DRAG", "Steer up and down"), controlRow("WHITE RING", "Pass through the aperture"), controlRow("CENTER RING", "Perfect connection · faster exit"));
            const controls = el("div", "ac-racecontrols");
            controls.append(flight, wormhole);
            briefing.append(objective, controls);
            sheet.append(briefing);
        }
        if (!def.standalone && missionCredit(engine.save, def) > countBits(mask)) {
            sheet.append(el("p", "ac-sub", `${missionCredit(engine.save, def)} earned stars retained. Earlier mission credit is preserved; the checklist below records these objectives.`));
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
            const g = reachedGate(routeMasks(engine.save), engine.save.raceGates);
            if (g && !IS_BETA) {
                const note = el("p", "ac-sub ac-gatenote");
                note.append(el("b", "", `DEBRIS FIELD AFTER LEVEL ${g.after}`), el("span", "", ` \u00b7 finish in ${g.label} or faster to clear it`));
                sheet.append(note);
            }
            sheet.append(el("p", "ac-sub", "OWN RECORD \u00b7 CAMPAIGN STARS UNCHANGED"));
        }
        // LEVEL SKIP, when one is held: a hold on this button spends it here
        let skip = null;
        if (!def.standalone && boostReady(engine.save, "levelskip") && skipEligible(engine.save, def) === "ok") {
            const held = engine.save.boosts.levelskip;
            skip = el("button", "ac-ghost ac-holdbtn ac-skipbtn");
            skip.append(boostArt("levelskip", 24), el("span", "", `HOLD TO USE LEVEL SKIP · 3 STARS NOW · ${held} HELD`));
            holdToFire(skip, 700, () => {
                const r = engine.useLevelSkip(def.id);
                if (r === "ok") {
                    chartLevel = null;
                    boostNote = null;
                    render();
                    return;
                }
                boostNote = DENY_TEXT[r]?.() ?? "That skip did not land.";
                render();
            });
        }
        const fly = el("button", "ac-primary", def.standalone ? "START RUN" : mask & 1 ? "FLY AGAIN" : "FLY");
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
                if (origin === "modes")
                    modesOpen = false;
                render();
            }
        };
        const back = el("button", "ac-ghost", "BACK");
        const close = () => {
            chartLevel = null;
            boostNote = null;
            // the sheet is open because a flag says so, and the flag has to be
            // cleared on BOTH routes or closing it from the chart just redraws it
            hyperRunOpen = false;
            if (origin === "modes")
                modesOpen = true;
            render();
        };
        back.onclick = close;
        if (raceBriefing) {
            const head = el("header", "ac-briefhead"), title = el("div");
            title.append(sheet.querySelector(".ac-kicker"), sheet.querySelector(".ac-lvlname"));
            back.className = "ac-backbtn";
            back.textContent = "";
            back.append(icon(I_BACK));
            back.setAttribute("aria-label", origin === "modes" ? "Back to Modes" : "Back to Star Chart");
            const help = el("button", "ac-helpdot", "?");
            help.setAttribute("aria-label", "Hyper Run instructions");
            help.onclick = () => {
                const briefing = sheet.querySelector(".ac-racebrief");
                if (briefing) {
                    briefing.tabIndex = -1;
                    briefing.focus({ preventScroll: true });
                    briefing.scrollIntoView({ block: "start" });
                }
            };
            head.append(back, title, help);
            sheet.prepend(head);
            const actions = el("div", "ac-raceactions");
            actions.append(fly);
            sheet.append(actions);
        }
        else
            sheet.append(fly);
        if (skip)
            sheet.append(skip);
        if (boostNote && skip)
            sheet.append(el("p", "ac-deny on ac-boostnote", boostNote));
        if (!raceBriefing)
            sheet.append(back);
        wrap.append(sheet);
        wrap.onclick = (e) => { if (e.target === wrap)
            close(); };
        return wrap;
    }
    function drawLevelDone(last) {
        if (last.def.standalone && last.def.base === "race" && last.raceRecord) {
            const r = last.raceRecord;
            const sheet = el("div", "ac-sheet ac-center");
            sheet.append(el("p", "ac-kicker", "HYPER RUN"));
            sheet.append(el("h2", "", "HYPER RUN"));
            sheet.append(el("p", "ac-kicker", "FINISH"));
            sheet.append(el("h2", "", formatRaceTicks(r.finishTicks)));
            if (r.newBestTime)
                sheet.append(el("p", "ac-gold", "NEW BEST"));
            else
                sheet.append(el("p", "ac-sub", `+${((r.finishTicks - r.bestFinishTicks) / 60).toFixed(3)}`));
            // A cleared field outranks a personal best on this screen: the best
            // is a number, the field is a road that just opened.
            if (r.clearedGate) {
                const won = el("p", "ac-gold ac-gatecleared");
                won.append(el("b", "", "DEBRIS FIELD CLEARED"), el("span", "", ` \u2014 the road past level ${r.clearedGate.after} is open`));
                sheet.append(won);
            }
            else if (!IS_BETA) {
                const g = reachedGate(routeMasks(engine.save), engine.save.raceGates);
                if (g)
                    sheet.append(el("p", "ac-sub", `Debris field after level ${g.after} still holds \u2014 needs ${g.label}.`));
            }
            const pips = el("div", "ac-bigpips");
            last.met.forEach((ok) => pips.append(el("span", ok ? "ac-bigpip earned" : "ac-bigpip", "★")));
            sheet.append(pips);
            const labels = el("div", "ac-lvlgoals");
            last.def.goals.map((goal) => goal.kind === "time"
                ? `≤ ${formatRaceTicks(goal.ticks)}`
                : goal.kind === "finish" ? "FINISH" : goalText(goal, last.def).toUpperCase()).forEach((label, i) => {
                const row = el("div", last.met[i] ? "ac-goal on" : "ac-goal");
                row.append(el("span", last.met[i] ? "ac-pip on" : "ac-pip", "★"), el("span", "", label));
                labels.append(row);
            });
            sheet.append(labels);
            sheet.append(el("p", "", `ACORNS  ${r.acorns} / ${HYPER_RUN_MAX_ACORNS}`));
            sheet.append(el("p", "", `BEST  ${r.bestAcorns}`));
            if (r.newBestAcorns)
                sheet.append(el("p", "ac-gold", "NEW ACORN BEST"));
            sheet.append(el("p", "ac-sub", "OWN RECORD — CAMPAIGN STARS UNCHANGED"));
            const again = el("button", "ac-primary", "RUN AGAIN");
            again.onclick = () => engine.flyLevel(last.def.id);
            const back = el("button", "ac-ghost", "BACK TO LOG");
            back.onclick = () => engine.open("log");
            sheet.append(again, back);
            return sheet;
        }
        const sheet = el("div", "ac-sheet ac-center");
        sheet.append(el("p", "ac-kicker", `LEVEL ${last.def.ord} \u00b7 ${last.def.name}`));
        sheet.append(el("h2", "", last.finished ? "LEVEL COMPLETE" : "LOST"));
        // THE END OF THE WALK. Mission 1 is the last step the guide takes, and
        // finishing it is the moment a new pilot stops being walked anywhere -
        // so it is marked, and it names the two places they can go next rather
        // than dropping them back on a menu with no suggestion.
        if (last.def.id === "1-1" && last.finished && engine.save.guide === "done") {
            const win = el("div", "ac-gear");
            win.append(el("p", "ac-gold ac-gearhead", "TUTORIAL COMPLETE"));
            win.append(el("p", "ac-sub ac-mid", "That is the whole game. Fly more missions on the Star Chart, " +
                "or take FREE FLIGHT as far as you can."));
            sheet.append(win);
        }
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
        if (last.gained > 0)
            sheet.append(el("p", "ac-gold", `+${last.gained} STAR${last.gained > 1 ? "S" : ""} \u00b7 ${last.totalAfter} TOTAL`));
        // anything the new total just paid for gets its moment - and a priced
        // rung says what it actually did, which is open the item on the shelf
        // rather than hand it over (audit, Sep 2026)
        for (const r of STAR_REWARDS) {
            if (r.kind !== "stage" && r.stars > last.totalBefore && r.stars <= last.totalAfter) {
                const due = rewardDue(r);
                sheet.append(el("p", "ac-gold", due > 0
                    ? `OPEN IN THE LOADOUT \u2014 ${r.name} \u00b7 ${due.toLocaleString()} ACORNS`
                    : `UNLOCKED \u2014 ${r.name}`));
            }
        }
        // the next level, if the finish just opened it
        const next = nextLevel(last.def.id);
        const stars = routeMasks(engine.save, CHART_LEVELS);
        if (last.finished && next && levelUnlocked(next, stars, last.totalAfter, engine.save.raceGates)) {
            const go = el("button", "ac-primary", `NEXT \u2014 ${next.ord} ${next.name.toUpperCase()}`);
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
    // what the PREVIEW page is currently wearing. Not the save: you are
    // trying premium on, not equipping it, and nothing here is owned.
    let tryOn = { suit: "", helm: "", pal: "" };
    let confirmBuy = false; // the pack sheet is asking "are you sure"
    /** set by the engine's arrival-claim so the shop can announce it once */
    let dailyToast = null;
    let editingName = false; // the Profile name is in edit mode
    const PILOT_FALLBACK = "Nutcracker"; // shown until a pilot picks one
    // ==================================================== THE STOREFRONT
    // One page, no tabs: the look is worn on the squirrel at the top, the
    // pieces that make it are bought underneath, and the featured pack sits
    // below as the bulk alternative.
    let devRollOpen = false;
    let featureOpen = null; // the featured pack, opened
    // STAR CHART BOOSTS. A boost is bought in the Shop and spent on the
    // chart: a held Level Skip lands on a mission from its sheet, a held Star
    // Unlock on a reward from the rail. Both are hold-to-confirm.
    let boostConfirm = null; // the shop card asking "are you sure"
    let rewardOpen = null; // the reward sheet on the chart, by rewardId
    let boostNote = null; // one line under a boost control that refused
    let landOnPilot = false; // the next chart render scrolls to the pilot
    // THE CART. Tapping a tile INCLUDES it - any combination, in any order -
    // and the bar adds up whatever is in here. Nothing is forced along with
    // anything else; a helmet does not drag its suit onto the stage.
    let picked = new Set();
    function shopDayIndex() {
        return Math.floor(Date.now() / 86400000);
    }
    // A stable deal: the same day always lays out the same shelf, and
    // tomorrow lays out a different one, with no server to ask.
    function dealFrom(pool, n, seed) {
        const a = [...pool];
        let x = (seed * 2654435761) >>> 0;
        for (let i = a.length - 1; i > 0; i--) {
            x = (x * 1103515245 + 12345) >>> 0;
            const j = x % (i + 1);
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a.slice(0, Math.max(0, n));
    }
    /** what the shop is showing today - and what it is deliberately not */
    function shopCycle() {
        const s = engine.save;
        const owns = (i) => ownsPremium(s, i);
        const day = shopDayIndex();
        // ONE featured pack, never one already owned outright
        const open = BUNDLES.filter((b) => !b.fixed && !bundleIds(b).every(owns));
        const feature = open.length ? open[day % open.length] : null;
        // THE CATCH. What the pack holds cannot also be bought singly today.
        // You can put it on the squirrel and look at it; you cannot have it
        // unless you take the pack, or wait for the cycle to hand it over
        // on its own later.
        const held = new Set(feature ? bundleIds(feature) : []);
        const shelfOf = (ids) => ids.filter((i) => !held.has(i) && !owns(i));
        const suitPool = shelfOf(SUITS.filter((u) => isIap(u.id)).map((u) => u.id));
        const helmPool = shelfOf(HELMETS.filter((h) => isIap(h.id)).map((h) => h.id));
        const palPool = shelfOf(PALS.filter((p) => isIap(p.id)).map((p) => p.id));
        // HELMETS ARE DEALT FIRST. A premium helmet always shares its id with a
        // suit, so dealing suits first ate the helmet pool and left the helmet
        // shelf with one tile. Helmets draw from the narrow pool, then suits
        // take what is left - including the three suits that have no helmet of
        // their own, which is exactly what that shelf is for.
        const helms = dealFrom(helmPool, SHOP_CYCLE.helms, day * 13 + 5);
        // A STICKER-PRICED SUIT IS ALWAYS ON THE SHELF (owner, 7 Sep 2026:
        // Arcflash "is an in game purchase"). The daily shuffle can starve an
        // id for weeks, and a suit sold at its own price is not a rotation
        // item - it leads the row every day, and the deal fills in behind it.
        const pinned = suitPool.filter((i) => DUST_STICKER[i] !== undefined && !helms.includes(i));
        const suits = [...pinned, ...dealFrom(suitPool.filter((i) => !helms.includes(i) && !pinned.includes(i)), SHOP_CYCLE.suits, day * 7 + 1)];
        const pals = dealFrom(palPool, SHOP_CYCLE.pals, day * 17 + 9);
        return { day, feature, held, suits, helms, pals, owns };
    }
    /** the price of the look currently on the stage, minus anything owned */
    /** WHAT YOU TICKED IS WHAT YOU BUY.
     *
     *  The bar used to price whatever happened to be standing on the stage,
     *  which meant tapping a helmet had to drag its suit on with it just to
     *  keep the price honest. Selecting and previewing are separate things
     *  now: a tap adds the item to the cart and shows it if it can be shown,
     *  and the total is the sum of the cart in whatever order it was built.
     *
     *  A self-contained suit - one whose helmet cannot be changed - carries
     *  no helmet in its price, which is why it costs 270 and not 360. */
    function cartOf(cy) {
        const ids = [...picked].filter((i) => isIap(i) && !cy.owns(i));
        const dust = ids.reduce((n, i) => n + idDust(i), 0);
        const trails = [...new Set(ids.map((i) => SET_TRAIL[i]).filter(Boolean))];
        return { ids, dust, trails };
    }
    /** is anything currently ON THE STAGE locked inside the featured pack? */
    function heldOnStage(cy) {
        return [tryOn.suit, tryOn.helm, tryOn.pal].filter(Boolean).filter((i) => cy.held.has(i));
    }
    /** name one shop id by what it actually hands over */
    function describeId(id) {
        const u = SUITS.find((x) => x.id === id);
        const h = HELMETS.find((x) => x.id === id);
        const p = PALS.find((x) => x.id === id);
        if (u && h && !wearsOwnHead(u))
            return `${u.name} with its helmet`;
        if (u)
            return u.name;
        if (h)
            return `the ${h.name} helmet`;
        if (p)
            return p.name;
        return id;
    }
    function drawShopBeta() {
        const s = engine.save;
        // the daily is banked at boot and SHOWN on the main menu (drawHome);
        // the shop only carries the streak tracker
        const cy = shopCycle();
        const box = el("div", "ac-menu ac-shopbeta");
        box.append(header("Premium", "Shop", headAside(s.acorns)));
        denyEl = el("p", "ac-deny");
        denyEl.setAttribute("role", "status");
        denyEl.setAttribute("aria-live", "polite");
        box.append(denyEl);
        const scroll = el("div", "ac-sheet-scroll");
        scroll.append(drawDaily());
        // ---- THE STAGE. Everything below re-dresses this.
        const shelved = [...cy.suits, ...cy.helms];
        const heldList = [...cy.held];
        if (!tryOn.suit || (!shelved.includes(tryOn.suit) && !cy.held.has(tryOn.suit) && !cy.owns(tryOn.suit))) {
            const firstSuit = cy.suits[0] ?? heldList.find((i) => SUITS.some((u) => u.id === i)) ?? SUITS[0].id;
            tryOn = {
                suit: firstSuit,
                helm: HELMETS.some((h) => h.id === firstSuit) ? firstSuit : (cy.helms[0] ?? tryOn.helm),
                pal: cy.pals[0] ?? tryOn.pal,
            };
        }
        const suit = SUITS.find((u) => u.id === tryOn.suit) ?? SUITS[0];
        const ownHead = wearsOwnHead(suit);
        const helm = ownHead ? HELMETS[0] : (HELMETS.find((h) => h.id === tryOn.helm) ?? HELMETS[0]);
        const palDef = PALS.find((x) => x.id === tryOn.pal);
        // THE CASE. The stage was a big quiet rectangle, which read as empty
        // space rather than as the thing the page is about. It is a lit display
        // case now: corner brackets, a spotlight, a pedestal the pilot stands
        // over, and a name plate - and the whole case takes its colour from the
        // suit being shown, so changing character re-lights the glass.
        const CASE_W = 344;
        const CASE_H = 236;
        const stage = el("div", "ac-shopcase");
        stage.style.setProperty("--case-glow", suit.glow ?? suit.trim ?? "#c4a0ff");
        stage.style.setProperty("--case-lite", suit.suitLite ?? "#8a5ae4");
        stage.style.setProperty("--case-deep", suit.suitDark ?? "#160f34");
        const pane = el("div", "ac-casepane");
        const { c, ctx } = miniCanvas(CASE_W, CASE_H);
        c.className = "ac-tocanvas ac-casecanvas";
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", `${suit.name} preview, flying`);
        pane.append(el("i", "ac-casebeam"));
        pane.append(c);
        pane.append(el("i", "ac-casefloor"));
        for (const corner of ["tl", "tr", "bl", "br"]) {
            pane.append(el("i", `ac-casecorner ac-c-${corner}`));
        }
        if (ownHead)
            pane.append(el("span", "ac-tonohelm ac-casetag", suit.id === "arcflash" ? "INTEGRATED LOOK · CANNOT CHANGE" : OWN_HEAD_TAG));
        stage.append(pane);
        const plate = el("div", "ac-caseplate");
        plate.append(el("span", "ac-caseeyebrow", "NOW SHOWING"));
        plate.append(el("b", "", suit.name + (ownHead ? "" : ` · ${helm.name}`)));
        if (palDef)
            plate.append(el("span", "ac-casesub", `${palDef.name} · ${palDef.tag}`));
        stage.append(plate);
        // THE CATCH, on the case rather than the bar. The bar is a cart now, so
        // the "you cannot buy this one" message belongs next to the thing being
        // looked at - which is the only place it is true.
        const heldNow = heldOnStage(cy);
        if (heldNow.length) {
            const note = el("div", "ac-caseheld");
            const t = el("span", "ac-caseheldtxt");
            t.append(el("b", "", "IN THE FEATURED PACK"), el("span", "", `${cy.feature?.name ?? "The pack"} — not sold separately today.`));
            const go = el("button", "ac-caseheldgo", "SEE THE PACK");
            go.onclick = () => { featureOpen = cy.feature?.id ?? null; confirmBuy = false; render(); };
            note.append(t, go);
            stage.append(note);
        }
        scroll.append(stage);
        if (ctx) {
            engine.wantSuitArt(suit.id);
            if (palDef)
                engine.wantPalArt(palDef.id);
            const t0 = performance.now();
            const tick = () => {
                if (!c.isConnected)
                    return;
                const t = (performance.now() - t0) / 1000;
                ctx.clearRect(0, 0, CASE_W, CASE_H);
                if (palDef)
                    paintPalPreview(ctx, engine.art, palDef.id, CASE_W - 58, 80, 52);
                const low = lowSeatPal(engine.save, palDef?.id);
                if (low)
                    paintPalPreview(ctx, engine.art, low, CASE_W - 58, 172, 52);
                paintFlightPreview(ctx, engine.art, suit, helm, CASE_W / 2 - 14, 128, 158, t, undefined, false, (suitPitchFor(engine.save, suit.id) * Math.PI) / 180);
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }
        // ---- THE COMBO BAR. Prices exactly what is on the stage.
        const cart = cartOf(cy);
        const bar = el("div", "ac-combobar");
        if (!cart.ids.length) {
            bar.classList.add("ac-cartempty");
            const t = el("span", "ac-combotxt");
            t.append(el("b", "", "NOTHING SELECTED"), el("span", "", "Tap anything below to add it. Pick as many as you like."));
            bar.append(t);
        }
        else {
            const t = el("span", "ac-combotxt");
            t.append(el("b", "", cart.ids.length === 1 ? "1 ITEM SELECTED" : `${cart.ids.length} ITEMS SELECTED`));
            const names = cart.ids.map(describeId);
            const listed = names.length > 1
                ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
                : names[0];
            const trailBit = cart.trails.length === 1
                ? ` ${TRAILS.find((x) => x.id === cart.trails[0])?.name ?? "The trail"} comes free.`
                : cart.trails.length > 1
                    ? ` ${cart.trails.length} trails come free.`
                    : "";
            t.append(el("span", "", `${listed}.${trailBit}`));
            const clear = el("button", "ac-cartclear", "Clear");
            clear.onclick = () => { picked = new Set(); render(); };
            t.append(clear);
            const go = el("button", "ac-primary ac-combobuy");
            go.append(icon(I_DUST, 14, true), el("span", "", cart.dust.toLocaleString()));
            go.onclick = () => {
                // charge the cheap ones first so a short balance still lands
                // something rather than refusing the whole basket
                const order = [...cart.ids].sort((a, b) => idDust(a) - idDust(b));
                let bought = 0;
                let refused = "";
                for (const id of order) {
                    if (!tx(bar, () => engine.buyShopItem(id), idDust(id), "dust")) {
                        refused = denyEl?.textContent ?? "";
                        break;
                    }
                    picked.delete(id);
                    bought += 1;
                }
                // A HALF-BOUGHT BASKET HAS TO SAY SO (audit, Sep 2026). Each
                // success notifies, and a notify re-renders, so the refusal on the
                // item after it was written onto a status line that was thrown
                // away in the same breath: dust dropped, one item stayed ticked,
                // and nothing on screen said why. The line is carried across the
                // rebuild and re-announced, and the rebuilt bar takes the shake.
                if (bought) {
                    render();
                    if (refused) {
                        announce(refused);
                        const rebuilt = overlay.querySelector(".ac-combobar");
                        if (rebuilt) {
                            rebuilt.classList.remove("ac-shake");
                            void rebuilt.offsetWidth;
                            rebuilt.classList.add("ac-shake");
                        }
                    }
                }
            };
            bar.append(t, go);
        }
        scroll.append(bar);
        // ---- THE SHELVES. Today's cycle, and only today's.
        const shelf = (title, kind, ids, note) => {
            if (!ids.length)
                return;
            const head = el("p", "ac-shelfhead ac-shopshelfhead", title);
            if (note)
                head.append(el("span", "ac-shelfnote", note));
            scroll.append(head);
            const row = el("div", "ac-shelfrow");
            for (const id of ids) {
                const on = kind === "pal" ? tryOn.pal === id : (kind === "suit" ? tryOn.suit === id : tryOn.helm === id);
                const b = el("button", on ? "ac-card ac-tocard ac-shoptile on" : "ac-card ac-tocard ac-shoptile");
                if (kind === "suit") {
                    const u = SUITS.find((x) => x.id === id);
                    if (u) {
                        b.append(suitCardOf(u, 60));
                        markPremium(b, u.glow);
                    }
                }
                else if (kind === "helm") {
                    const h = HELMETS.find((x) => x.id === id);
                    if (h) {
                        b.append(helmCardOf(h, 60));
                        markPremium(b, h.glow);
                    }
                }
                else {
                    const { c: pc, ctx: pctx } = miniCanvas(60, 60);
                    if (pctx)
                        paintPalPreview(pctx, engine.art, id, 30, 30, 54);
                    b.append(pc);
                    markPremium(b);
                }
                const name = kind === "suit"
                    ? (SUITS.find((x) => x.id === id)?.name ?? id)
                    : kind === "helm"
                        ? (HELMETS.find((x) => x.id === id)?.name ?? id)
                        : (PALS.find((x) => x.id === id)?.name ?? id);
                b.append(el("span", "ac-tilename", name));
                const owned = cy.owns(id);
                const price = el("span", owned ? "ac-tileprice owned" : "ac-tileprice");
                if (owned)
                    price.append(el("span", "", "OWNED"));
                else
                    price.append(icon(I_DUST, 11, true), el("span", "", idDust(id).toLocaleString()));
                b.append(price);
                if (SET_TRAIL[id] && !owned)
                    b.append(el("span", "ac-tilebonus", "+ TRAIL"));
                // the tick in the corner was the only thing that said "in the
                // cart", and a tick is not readable (audit, Sep 2026)
                b.setAttribute("aria-pressed", String(picked.has(id)));
                if (picked.has(id)) {
                    b.classList.add("on");
                    b.append(el("i", "ac-tickbadge", "\u2713"));
                }
                const showing = kind === "pal" ? tryOn.pal === id
                    : kind === "suit" ? tryOn.suit === id : tryOn.helm === id;
                if (showing)
                    b.classList.add("ac-previewing");
                b.onclick = () => {
                    // ONE TAP INCLUDES IT. Selecting and previewing are separate: the
                    // tile is shown on the stage if the stage can show it, but nothing
                    // else is dragged along to make that work.
                    if (picked.has(id))
                        picked.delete(id);
                    else
                        picked.add(id);
                    if (kind === "pal")
                        tryOn = { ...tryOn, pal: id };
                    else if (kind === "suit")
                        tryOn = { ...tryOn, suit: id };
                    else
                        tryOn = { ...tryOn, helm: id };
                    render();
                };
                row.append(b);
            }
            scroll.append(row);
        };
        shelf("SUITS", "suit", cy.suits, "today");
        shelf("HELMETS", "helm", cy.helms, "today");
        shelf("PALS", "pal", cy.pals, "today");
        scroll.append(el("p", "ac-fine", "The shelf restocks tomorrow. Trails are not sold on their own — they arrive with their set."));
        // ---- STAR CHART BOOSTS (owner, 8 Sep 2026). Bought here, into the
        // account; spent on the Star Chart with a hold. The purchase itself is
        // a two-tap confirm like the packs, and a successful one walks the
        // pilot to the chart with the boost armed.
        scroll.append(el("p", "ac-shelfhead", "STAR CHART BOOSTS"));
        for (const id of BOOST_IDS) {
            const spec = BOOSTS[id];
            const held = s.boosts?.[id] ?? 0;
            const row = el("button", boostConfirm === id ? "ac-card ac-modcard ac-boostcard ac-confirming" : "ac-card ac-modcard ac-boostcard");
            row.append(boostArt(id, 56));
            const t = el("div", "ac-modtxt");
            t.append(el("p", "ac-modname", spec.name), el("p", "ac-sub", spec.blurb));
            if (held)
                t.append(el("p", "ac-sub ac-boostheld", `${held} in your account — spend it on the Star Chart.`));
            row.append(t);
            const pr = el("span", "ac-modprice ac-dustprice");
            const cue = el("span", "", boostConfirm === id ? "CONFIRM " : "");
            pr.append(cue, icon(I_DUST, 13, true), el("span", "", spec.dust.toLocaleString()));
            row.append(pr);
            row.onclick = () => {
                if (boostConfirm !== id) {
                    boostConfirm = id;
                    render();
                    return;
                }
                boostConfirm = null;
                // the chart opens on the pilot, not wherever the shop was scrolled
                if (tx(row, () => engine.buyBoost(id), spec.dust, "dust")) {
                    landOnPilot = true;
                    engine.open("log");
                }
                // A REFUSED CONFIRM HAS TO SAY SOMETHING (audit, Sep 2026). The
                // re-render here rebuilt the shop, and with it an empty status
                // line - so "Not enough Star Dust" was written and thrown away in
                // the same tap and the card simply dropped out of CONFIRM. The
                // pack sheet already only re-renders on success for this reason;
                // this one disarms the live card instead, keeping the line and
                // the shake the pilot is meant to see.
                else {
                    row.classList.remove("ac-confirming");
                    cue.textContent = "";
                }
            };
            scroll.append(row);
        }
        scroll.append(el("p", "ac-fine", "A boost stays in your account until you spend it: open the Star Chart, pick the mission or the reward, and hold to confirm."));
        // ---- THE FEATURED PACK.
        if (cy.feature) {
            const bn = cy.feature;
            const full = alaCarteTotal(bundleIds(bn), cy.owns);
            const due = featurePrice(bn, cy.owns);
            const off = full > 0 ? Math.round((1 - due / full) * 100) : 0;
            scroll.append(el("p", "ac-shelfhead ac-featurehead", "FEATURED PACK"));
            const card = el("button", "ac-card ac-featurecard");
            const strip = el("div", "ac-bundlestrip");
            const faces = bn.items.filter((it) => it.kind === "suit").slice(0, 3);
            for (const it of faces) {
                const u = SUITS.find((x) => x.id === it.id);
                if (u)
                    strip.append(suitCardOf(u, 46));
            }
            if (bn.items.length > faces.length) {
                strip.append(el("span", "ac-bundlemore", `+${bn.items.length - faces.length}`));
            }
            card.append(strip);
            const txt = el("div", "ac-modtxt");
            txt.append(el("p", "ac-modname", bn.name), el("p", "ac-sub", bn.blurb));
            card.append(txt);
            const pr = el("span", "ac-modprice ac-dustprice");
            pr.append(icon(I_DUST, 13, true), el("span", "", due.toLocaleString()));
            if (off > 0)
                pr.append(el("s", "ac-wasprice", full.toLocaleString()));
            card.append(pr);
            if (off > 0)
                card.append(el("span", "ac-featureoff", `${off}% OFF`));
            card.append(el("span", "ac-bundlecount", `${bn.items.length} items`));
            card.onclick = () => { featureOpen = bn.id; confirmBuy = false; render(); };
            scroll.append(card);
            scroll.append(el("p", "ac-fine", "Everything in the pack is off the single shelf while it is featured. It comes back around on its own later."));
        }
        // ---- TOP UP.
        scroll.append(el("p", "ac-shelfhead", "STAR DUST"));
        // while the store's sheet is up every row waits: the one being bought
        // says so, the rest cannot start a second purchase underneath it
        const inFlight = engine.dustPending();
        for (const dp of DUST_PACKS) {
            const row = el("button", "ac-card ac-modcard ac-dustrow");
            const face = el("span", "ac-dustface");
            face.append(icon(I_DUST, 30, true));
            row.append(face);
            const t = el("div", "ac-modtxt");
            t.append(el("p", "ac-modname", `${(dp.dust + dp.bonus).toLocaleString()} Star Dust`), el("p", "ac-sub", dp.bonus ? `${dp.dust.toLocaleString()} + ${dp.bonus} bonus` : "Starter handful."));
            // the STORE's localized price when a shell is answering; the catalog's
            // sticker is only the web page's placeholder. A shell that has not
            // answered yet shows no price and cannot be tapped: a USD sticker in
            // front of a non-US reviewer is a rejection, not a fallback.
            const price = platform.priceOf(dp.id);
            const priced = !!price || !platform.native;
            const waiting = inFlight === dp.id;
            const label = waiting ? "Waiting for the store…" : price ?? (platform.native ? "…" : dp.price);
            row.append(t, el("span", `ac-modprice ac-cashprice${waiting ? " ac-waiting" : ""}`, label));
            if (!priced) {
                row.disabled = true;
                row.setAttribute("aria-label", "Price loading");
            }
            if (inFlight) {
                row.disabled = true;
                if (waiting)
                    row.setAttribute("aria-label", "Purchase in progress");
            }
            row.onclick = () => { if (!priced || inFlight)
                return; tx(row, () => engine.buyDust(dp.id)); render(); };
            scroll.append(row);
        }
        // the store answered while we were away from this list, or just now:
        // a success shows as dust in the badge and needs no words; anything
        // else gets one line so a tap that did nothing is never a mystery
        const outcome = engine.takeDustOutcome();
        if (outcome) {
            const note = DUST_OUTCOME_TEXT[outcome.state];
            if (note)
                announce(note);
            else
                clearDeny();
        }
        if (platform.storeReady) {
            // Apple asks for this button on every storefront, consumables or not
            const restore = el("button", "ac-ghost ac-restore", "RESTORE PURCHASES");
            restore.onclick = () => { void engine.restorePurchases(); };
            scroll.append(restore);
        }
        // the access-code door is a dev door: gone wherever the shell closes them
        if (platform.devDoors)
            scroll.append(codeRow());
        // Say where the money goes. A shell with a store says nothing; the
        // beta says dust is granted; the live web page says the store is
        // the app's.
        if (!platform.storeReady)
            scroll.append(el("p", "ac-fine", IS_BETA
                ? "The payment rail is not connected yet, so dust is granted during the beta."
                : "Star Dust packs are sold in the app. Everything else on this page works."));
        box.append(scroll);
        // THE CYCLE INSPECTOR SHIPS ON BOTH PAGES. It was gated on beta while
        // the storefront was, but the storefront is the shop on both pages now
        // and the cycle is tuned by watching a real shelf - which is the live
        // one. It stays rolled up to a single line until it is asked for, so
        // it costs a player who never opens it nothing but a row of small type.
        box.append(drawCycleRoll(cy));
        // and the sheet only ever shows the pack TODAY is featuring: the
        // featured price belongs to the cycle, not to whatever was open when
        // the day rolled over (audit, Sep 2026)
        if (featureOpen && featureOpen !== cy.feature?.id) {
            featureOpen = null;
            confirmBuy = false;
        }
        if (featureOpen)
            box.append(drawFeatureSheet(featureOpen));
        return box;
    }
    /** THE PACK, OPENED. Every character in it goes on the squirrel — and
     *  none of them is for sale on its own. That IS the offer: you see
     *  exactly what you are missing, and the only door to it is the pack.
     *  The patient get it on the single shelf after it rotates out. */
    function drawFeatureSheet(id) {
        const wrap = el("div", "ac-lvlsheet");
        const bn = BUNDLES.find((b) => b.id === id);
        if (!bn)
            return wrap;
        const s = engine.save;
        const owns = (i) => ownsPremium(s, i);
        const sheet = el("div", "ac-lvlcard ac-featuresheet");
        const full = alaCarteTotal(bundleIds(bn), owns);
        const due = featurePrice(bn, owns);
        const off = full > 0 ? Math.round((1 - due / full) * 100) : 0;
        sheet.append(el("p", "ac-kicker", "FEATURED PACK"), el("h2", "ac-lvlname", bn.name));
        sheet.append(el("p", "ac-sub", bn.blurb));
        const group = (title, kind) => {
            const items = bn.items.filter((it) => it.kind === kind);
            if (!items.length)
                return;
            sheet.append(el("p", "ac-shelfhead", `${title} · ${items.length}`));
            const row = el("div", "ac-shelfrow");
            for (const it of items) {
                const wearable = kind === "suit" || kind === "helm" || kind === "pal";
                const on = kind === "suit" ? tryOn.suit === it.id
                    : kind === "helm" ? tryOn.helm === it.id
                        : kind === "pal" ? tryOn.pal === it.id : false;
                const b = el("button", on ? "ac-card ac-tocard ac-shoptile on" : "ac-card ac-tocard ac-shoptile");
                let name = it.id;
                if (kind === "suit") {
                    const u = SUITS.find((x) => x.id === it.id);
                    if (u) {
                        b.append(suitCardOf(u, 56));
                        name = u.name;
                        markPremium(b, u.glow);
                    }
                }
                else if (kind === "helm") {
                    const h = HELMETS.find((x) => x.id === it.id);
                    if (h) {
                        b.append(helmCardOf(h, 56));
                        name = h.name;
                        markPremium(b, h.glow);
                    }
                }
                else if (kind === "pal") {
                    const { c: pc, ctx: pctx } = miniCanvas(56, 56);
                    if (pctx)
                        paintPalPreview(pctx, engine.art, it.id, 28, 28, 50);
                    b.append(pc);
                    name = PALS.find((x) => x.id === it.id)?.name ?? it.id;
                    markPremium(b);
                }
                else {
                    const t = TRAILS.find((x) => x.id === it.id);
                    const { c: tc, ctx: tctx } = miniCanvas(56, 48);
                    if (tctx && t)
                        paintTrailPreview(tctx, t, 28, 24, performance.now() / 1000);
                    b.append(tc);
                    name = t?.name ?? it.id;
                }
                b.append(el("span", "ac-tilename", name));
                b.append(el("span", owns(it.id) ? "ac-tileprice owned" : "ac-tileprice locked", owns(it.id) ? "OWNED" : "IN THE PACK"));
                if (wearable) {
                    b.onclick = () => {
                        if (kind === "suit") {
                            const matched = bn.items.some((x) => x.kind === "helm" && x.id === it.id);
                            tryOn = { ...tryOn, suit: it.id, helm: matched ? it.id : tryOn.helm };
                        }
                        else if (kind === "helm") {
                            const worn = SUITS.find((u) => u.id === tryOn.suit);
                            const needsHead = !worn || wearsOwnHead(worn);
                            const ownSuit = SUITS.some((u) => u.id === it.id);
                            tryOn = { ...tryOn, helm: it.id, suit: needsHead && ownSuit ? it.id : tryOn.suit };
                        }
                        else
                            tryOn = { ...tryOn, pal: it.id };
                        render();
                    };
                }
                else {
                    b.classList.add("ac-cardoff");
                }
                row.append(b);
            }
            sheet.append(row);
        };
        group("SUITS", "suit");
        group("HELMETS", "helm");
        group("TRAILS", "trail");
        group("PALS", "pal");
        sheet.append(el("p", "ac-fine", "Tap any of them to wear it on the stage. None of it is sold separately while this pack is featured."));
        // the sheet covers the page, so it carries its own status line - the
        // one up in the menu would be announced to nobody
        const sheetDeny = el("p", "ac-deny");
        sheetDeny.setAttribute("role", "status");
        sheetDeny.setAttribute("aria-live", "polite");
        sheet.append(sheetDeny);
        denyEl = sheetDeny;
        const buy = el("button", "ac-primary ac-featurebuy");
        if (due <= 0) {
            buy.textContent = "ALREADY YOURS";
            buy.classList.add("ac-cardoff");
        }
        else {
            buy.append(el("span", "", confirmBuy ? "CONFIRM · SPEND " : "BUY THE PACK · "), icon(I_DUST, 14, true), el("span", "", due.toLocaleString()));
            if (off > 0)
                buy.append(el("s", "ac-wasprice", full.toLocaleString()));
            buy.onclick = () => {
                if (!confirmBuy) {
                    confirmBuy = true;
                    render();
                    return;
                }
                // only re-render on success: a re-render rebuilds the status line,
                // which would wipe the refusal before anyone could read it
                if (tx(buy, () => engine.buyFeature(bn.id), due, "dust")) {
                    featureOpen = null;
                    confirmBuy = false;
                    render();
                }
            };
        }
        sheet.append(buy);
        const back = el("button", "ac-ghost", "BACK");
        back.onclick = () => { featureOpen = null; confirmBuy = false; render(); };
        sheet.append(back);
        wrap.append(sheet);
        wrap.onclick = (e) => { if (e.target === wrap) {
            featureOpen = null;
            confirmBuy = false;
            render();
        } };
        return wrap;
    }
    /** THE CYCLE INSPECTOR. Preproduction only: everything the shop is
     *  holding back today, and why it is holding it. Rolls up to a bar so it
     *  costs one line of screen when it is not wanted. */
    function drawCycleRoll(cy) {
        const wrap = el("div", devRollOpen ? "ac-devroll open" : "ac-devroll");
        const shown = new Set([...cy.suits, ...cy.helms, ...cy.pals]);
        const held = [];
        const resting = [];
        const owned = [];
        for (const id of IAP_ITEMS) {
            if (cy.owns(id))
                owned.push(id);
            else if (cy.held.has(id))
                held.push(id);
            else if (!shown.has(id))
                resting.push(id);
        }
        const bar = el("button", "ac-devbar");
        bar.setAttribute("aria-expanded", String(devRollOpen));
        bar.append(el("b", "", devRollOpen ? "▾ OFF THE SHELF TODAY" : "▴ OFF THE SHELF TODAY"), el("span", "", `${held.length} in the pack · ${resting.length} resting · ${owned.length} of ${IAP_ITEMS.length} premium items owned`));
        bar.onclick = () => { devRollOpen = !devRollOpen; render(); };
        wrap.append(bar);
        if (!devRollOpen)
            return wrap;
        const panel = el("div", "ac-devpanel");
        const nameOf = (id) => {
            const u = SUITS.find((x) => x.id === id);
            const h = HELMETS.find((x) => x.id === id);
            const p = PALS.find((x) => x.id === id);
            const t = TRAILS.find((x) => x.id === id);
            const kinds = [u && "suit", h && "helm", p && "pal", t && "trail"].filter(Boolean).join("+");
            return `${u?.name ?? h?.name ?? p?.name ?? t?.name ?? id} (${kinds})`;
        };
        const group = (title, ids, why) => {
            const g = el("div", "ac-devgroup");
            g.append(el("p", "ac-devhead", `${title} · ${ids.length}`));
            g.append(el("p", "ac-devwhy", why));
            const list = el("div", "ac-devlist");
            if (!ids.length)
                list.append(el("span", "ac-devnone", "none"));
            for (const id of ids) {
                const chip = el("span", "ac-devchip");
                chip.append(el("b", "", nameOf(id)));
                chip.append(el("i", "", `${idDust(id)}`));
                list.append(chip);
            }
            g.append(list);
            panel.append(g);
        };
        panel.append(el("p", "ac-devday", `Cycle day ${cy.day} · seed is the date · shelf: ${cy.suits.length} suits, ${cy.helms.length} helmets, ${cy.pals.length} pal, 0 trails`));
        group("HELD BY THE FEATURED PACK", held, `${cy.feature?.name ?? "no pack"} — not buyable singly until it rotates out.`);
        group("RESTING", resting, "In the pool, not dealt today. Comes back on a future day.");
        group("OWNED", owned, `Bought already, so the shelf never offers it again. Premium ids, not suits: a suit and its helmet share one.`);
        wrap.append(panel);
        return wrap;
    }
    function drawShop() {
        // THE STOREFRONT IS THE SHOP NOW, on both pages. It was beta-gated while
        // it was unflown; it has been flown.
        return drawShopBeta();
    }
    /** THE LAYOUT SWITCH. The grouped shelves side-scroll, which keeps a long
     *  roster short but hides most of it behind a swipe. This flips the same
     *  groupings - same headings, same order, same cards - into a wrapping
     *  grid so a whole group is on screen at once. Purely a view: nothing
     *  about what is listed or how it is sorted changes.
     *
     *  It only appears where there is something to flip. On the trails, pals
     *  and mods tabs there are no groupings, so a switch there would be a
     *  control that does nothing. */
    function shelfToggle() {
        const row = el("div", "ac-viewrow");
        const seg = el("div", "ac-viewseg");
        const mk = (grid, label, title) => {
            const b = el("button", `ac-viewbtn${engine.save.shelfGrid === grid ? " on" : ""}`, label);
            b.title = title;
            b.setAttribute("aria-pressed", String(engine.save.shelfGrid === grid));
            b.onclick = () => { engine.setShelfGrid(grid); render(); };
            return b;
        };
        seg.append(mk(false, "\u2261", "Side-scrolling rows"), mk(true, "\u25a6", "Grid"));
        row.append(seg);
        return row;
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
                if (res === "ok") {
                    foundersOpen = false;
                    foundersMsg = "";
                }
                else if (res === "love") {
                    foundersOpen = false;
                    foundersMsg = "";
                    showLoveNote();
                    render();
                }
                else {
                    foundersMsg = "That code doesn't open this door.";
                    render();
                }
            };
            row.append(input, go);
            wrap.append(row);
            if (foundersMsg)
                wrap.append(el("p", "ac-fine ac-codemsg", foundersMsg));
        }
        return wrap;
    }
    /** THE BADGE TURNS. The daily disc arrived as a 6s render whose badge
     *  slowly zooms - the gold ring grows 1073px to 1137px across the clip -
     *  so it was cut frame by frame against its OWN ring and resampled to one
     *  fixed disc. What ships is a 32-cell sprite sheet, 8 across and 4 down.
     *
     *  Two nested boxes because one element carries one transform: the inner
     *  sheet steps across the columns, the row it sits in steps down the rows,
     *  and the outer box crops a single cell. Both offsets are percentages of
     *  the animated element's own width, so one rule serves the 46px row badge
     *  and the 96px popup badge without knowing either size.
     *
     *  The still disc stays as the box's own background: it is what shows
     *  while the sheet loads, if the sheet never arrives, and for a pilot who
     *  asked their system for less motion. */
    function dustBadge(cls) {
        const box = el("div", `ac-dustbadge ${cls}`);
        box.style.backgroundImage = `url("${artRootUrl()}/ui/dust-badge.png?v=${ART_VER}")`;
        const row = el("div", "ac-dustbadgerow");
        const cells = el("div", "ac-dustbadgecells");
        cells.style.backgroundImage = `url("${artRootUrl()}/ui/dust-badge-anim.webp?v=${ART_VER}")`;
        row.append(cells);
        box.append(row);
        return box;
    }
    /** THE DAILY SAYS SO. Arriving in the shop pays, which is the right
     *  trade - but it paid in silence, so the reward happened to the pilot
     *  rather than for them. This is the only thing in the shop that
     *  interrupts, and it is closed by hand: a reward that vanishes on its
     *  own timer is one a distracted player never saw. */
    function drawDailyToast(t) {
        const close = () => { dailyToast = null; render(); };
        const wrap = el("div", "ac-lvlsheet");
        const sheet = el("div", "ac-lvlcard ac-dailycard");
        sheet.append(dustBadge("ac-dailybadgebig"));
        sheet.append(el("p", "ac-kicker", t.bonus ? "SEVEN DAY STREAK" : "DAILY REWARD"));
        if (t.pack) {
            // THE FIRST FULL WEEK: three critters, painted, not a number
            const trio = el("div", "ac-dailytrio");
            for (const id of ["raccoon", "ferret", "hedgehog"]) {
                const suit = SUITS.find((u) => u.id === id);
                const { c, ctx } = miniCanvas(64, 64);
                if (ctx && suit)
                    paintFlightPreview(ctx, engine.art, suit, helmetWornBy("clear", id), 32, 34, 58, 0, undefined, false, 0);
                trio.append(c);
            }
            sheet.append(trio);
            sheet.append(el("h2", "ac-lvlname", "Critter Pack unlocked"));
            sheet.append(el("p", "ac-sub", `Bandit, Noodle and Quill are yours - a full week of flying. Today also paid ${DAILY_DUST} dust; every seventh day from now pays the ${DAILY_STREAK_BONUS} streak bonus.`));
        }
        else {
            const big = el("div", "ac-dailybig");
            big.append(icon(I_DUST, 34, true), el("b", "", `+${t.amount}`));
            sheet.append(big);
            sheet.append(el("h2", "ac-lvlname", "Star Dust collected"));
            sheet.append(el("p", "ac-sub", t.bonus
                ? `Day ${DAILY_STREAK_LEN} paid ${DAILY_DUST} plus the ${DAILY_STREAK_BONUS} streak bonus. Come back tomorrow and the streak starts again.`
                : `Day ${t.streak} of ${DAILY_STREAK_LEN}. Come back tomorrow to keep the streak \u2014 ${engine.save.streakPackClaimed ? `day ${DAILY_STREAK_LEN} pays ${DAILY_STREAK_BONUS} more` : `day ${DAILY_STREAK_LEN} unlocks the Critter Pack`}.`));
        }
        const pips = el("div", "ac-pips");
        for (let i = 1; i <= DAILY_STREAK_LEN; i++) {
            pips.append(el("i", `ac-pip${i <= t.streak ? " on" : ""}${i === DAILY_STREAK_LEN ? " big" : ""}`));
        }
        sheet.append(pips);
        const ok = el("button", "ac-primary", "NICE");
        ok.onclick = close;
        sheet.append(ok);
        wrap.append(sheet);
        wrap.onclick = (e) => { if (e.target === wrap)
            close(); };
        return wrap;
    }
    /** SIGN IN AND CLAIM. Seven pips, one per day of the streak; the seventh
     *  pays the bonus. The pips are drawn even after claiming so the pilot can
     *  see how far along the week they are rather than only being told. */
    function drawDaily() {
        const st = engine.dailyState();
        const card = el("div", st.claimedToday ? "ac-daily done" : "ac-daily");
        // the badge leads, so the row is recognisable before a word is read
        card.append(dustBadge("ac-dailybadge"));
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
        const packAhead = !engine.save.streakPackClaimed;
        left.append(el("p", "ac-sub", st.bonusDay
            ? (st.pack ? `Day ${DAILY_STREAK_LEN} \u2014 the Critter Pack is yours. Back tomorrow to start again.` : `Day ${DAILY_STREAK_LEN} \u2014 ${DAILY_DUST} plus the ${DAILY_STREAK_BONUS} streak bonus. Back tomorrow to start again.`)
            : `Day ${st.streak} of ${DAILY_STREAK_LEN}. Come back tomorrow \u2014 day ${DAILY_STREAK_LEN} ${packAhead ? "unlocks the Critter Pack: Bandit, Noodle and Quill" : `pays ${DAILY_STREAK_BONUS} more`}.`));
        card.append(left);
        // No button: arriving here already claimed it. This is a receipt and a
        // streak tracker, not a control.
        const got = el("div", "ac-dailygot");
        got.append(icon(I_DUST, 15, true), el("b", "", `+${st.amount}`));
        card.append(got);
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
        // THE PILOT NAMES THEMSELVES. It was hard-coded, which read as a bug the
        // moment anyone looked at it twice. Empty means never chosen, so the
        // fallback shows through without ever being written to the save - a name
        // the player picked and one we picked for them stay different facts.
        const nameRow = el("div", "ac-idnamerow");
        if (editingName) {
            const input = document.createElement("input");
            input.className = "ac-idnameinput";
            input.type = "text";
            // The default goes in as REAL editable text, not a placeholder and not
            // an empty box. A placeholder vanishes the moment you type and leaves
            // nothing to edit down from; a name you can select, trim or keep is a
            // starting point rather than a prompt.
            input.value = s.pilotName || PILOT_FALLBACK;
            input.maxLength = PILOT_NAME_MAX;
            input.setAttribute("aria-label", "Pilot name");
            const commit = () => {
                engine.setPilotName(input.value);
                editingName = false;
                render();
            };
            // Enter commits, Escape abandons - the two keys anyone will try
            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                }
                else if (e.key === "Escape") {
                    e.preventDefault();
                    editingName = false;
                    render();
                }
            };
            const ok = el("button", "ac-idnameok", "SAVE");
            ok.onclick = commit;
            nameRow.append(input, ok);
            // focus after the node is in the document, or the caret goes nowhere
            requestAnimationFrame(() => { input.focus(); input.select(); });
        }
        else {
            const nm = el("p", "ac-idname", s.pilotName || PILOT_FALLBACK);
            const edit = el("button", "ac-idnameedit");
            edit.setAttribute("aria-label", "Change pilot name");
            edit.append(icon(I_EDIT, 15));
            edit.onclick = () => { editingName = true; render(); };
            nameRow.append(nm, edit);
        }
        idTxt.append(nameRow);
        idTxt.append(el("p", "ac-sub", `\u2605 ${starsOf(s)} \u00b7 ${starTitle(starsOf(s))}`));
        const tags = el("div", "ac-rigtags");
        if (IS_BETA)
            tags.append(el("span", "ac-tagpill ac-taggold", "BETA PILOT"));
        idTxt.append(tags);
        id.append(idTxt);
        scroll.append(id);
        scroll.append(el("p", "ac-kicker ac-secthead", "Lifetime"));
        const tiles = el("div", "ac-tiles");
        const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString());
        for (const [n, label] of [
            [fmt(s.runs ?? 0), "FLIGHTS"],
            [fmt(s.lifetimeAcorns ?? s.acorns), "ACORNS"],
            [`${s.zonesSeen?.length ?? 0} / ${ENVS.length}`, "ZONES"],
        ]) {
            const t = el("div", "ac-tile");
            t.append(el("p", "ac-tilenum", n), el("p", "ac-tilelabel", label));
            tiles.append(t);
        }
        scroll.append(tiles);
        // THE INVENTORY (owner, 8 Sep 2026): a bought boost lives in the
        // account, so a closed app or a dropped connection between the Shop
        // and the chart loses nothing. USE NOW walks to the chart, armed.
        if (BOOST_IDS.some((id) => (s.boosts?.[id] ?? 0) > 0)) {
            scroll.append(el("p", "ac-kicker ac-secthead", "Inventory"));
            const inv = el("div", "ac-rows");
            for (const id of BOOST_IDS) {
                const n = s.boosts?.[id] ?? 0;
                if (!n)
                    continue;
                const row = el("div", "ac-row ac-invrow");
                row.append(boostArt(id, 40));
                const t = el("span", "ac-socialtxt");
                t.append(el("b", "", `${BOOSTS[id].name} × ${n}`), el("span", "", BOOSTS[id].blurb));
                const use = el("button", "ac-ghost ac-invuse", "USE NOW");
                use.onclick = () => { landOnPilot = true; engine.open("log"); };
                row.append(t, use);
                inv.append(row);
            }
            scroll.append(inv, el("p", "ac-fine", "Spent on the Star Chart with a hold: a mission for a Level Skip, a reward on the rail for a Star Unlock."));
        }
        // The five per-mode records used to be listed here as well. They live
        // on the mode buttons themselves - fly, deep, lost and arcade read the
        // same save fields this list did, and Wormhole Run the same tunnelBest -
        // so this was a second copy of the same numbers, read in the place they
        // are least useful. A record belongs where you choose the mode.
        // Settings left this screen for the hub's gear button, where they sit
        // with Help.
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
        const x = document.createElement("a");
        x.className = "ac-row ac-rowbtn ac-social";
        x.href = "https://x.com/AcornautGame";
        x.target = "_blank";
        x.rel = "noopener noreferrer";
        const xwrap = el("span", "ac-socialmark ac-markx");
        xwrap.append(icon(I_X, 17, true));
        const xtxt = el("span", "ac-socialtxt");
        xtxt.append(el("b", "", "@AcornautGame"), el("span", "", "Patch notes, new art, and the occasional crash."));
        x.append(xwrap, xtxt, el("span", "ac-socialgo", "\u2197"));
        social.append(x);
        // A mail link rather than a form: there is no backend to post to, and a
        // support address a pilot can copy out of their own mail client beats a
        // box that silently drops what they typed. The subject is prefilled so
        // a report arrives already sorted.
        const mail = document.createElement("a");
        mail.className = "ac-row ac-rowbtn ac-social";
        mail.href = "mailto:acornaut@outlook.com?subject=" + encodeURIComponent("Acornaut — feedback");
        const mwrap = el("span", "ac-socialmark ac-markmail");
        mwrap.append(icon(I_MAIL, 18));
        const mtxt = el("span", "ac-socialtxt");
        mtxt.append(el("b", "", "acornaut@outlook.com"), el("span", "", "Bugs, feedback and feature requests."));
        mail.append(mwrap, mtxt, el("span", "ac-socialgo", "\u2197"));
        social.append(mail);
        scroll.append(social);
        scroll.append(el("p", "ac-kicker ac-secthead", "News"));
        const news = el("div", "ac-rows");
        for (const line of NEWS) {
            const r = el("div", "ac-row ac-rownote");
            r.append(el("span", "ac-sub", line));
            news.append(r);
        }
        scroll.append(news, el("p", "ac-fine ac-mid", BUILD));
        box.append(scroll);
        return box;
    }
    /** THE BOARD. Every mode's best, ranked against each other, with the top
     *  three on the podium the art is already drawing.
     *
     *  It is a PERSONAL board, and it says so on the screen rather than
     *  implying otherwise: there is no server behind this game, so there is
     *  nobody else's score to show. Built to take one later - the rows are a
     *  list of {name, score, rank}, and where that list comes from is the only
     *  thing that has to change.
     */
    function drawScores() {
        const s = engine.save;
        const runs = [
            { id: "fly", name: "Free Flight", best: s.highScore || 0, unit: "gates" },
            { id: "deep", name: "Deep Space", best: s.deepBest || 0, unit: "gates" },
            { id: "lost", name: "Lost in Space", best: s.lostBest || 0, unit: "gates" },
            { id: "arcade", name: "Arcade", best: s.arcadeBest || 0, unit: "gates" },
            { id: "tunnel", name: "Wormhole Run", best: s.tunnelBest || 0, unit: "score" },
            { id: "spill", name: "Debris Field", best: s.spillBest || 0, unit: "waves" },
        ].sort((a, b) => b.best - a.best);
        const box = el("div", "ac-menu");
        box.append(header("Your bests", "Leaderboard", headAside(s.acorns)));
        const scroll = el("div", "ac-sheet-scroll");
        const hero = el("div", "ac-boardhero");
        const img = document.createElement("img");
        img.src = `${artRootUrl()}/ui/trophy.png?v=${ART_VER}`;
        img.alt = "";
        img.width = 176;
        img.height = 176;
        hero.append(img);
        const flown = runs.filter((r) => r.best > 0).length;
        hero.append(el("p", "ac-boardtag", flown === 0 ? "Nothing on the board yet"
            : flown === 1 ? "One mode on the board"
                : `${flown} modes on the board`));
        scroll.append(hero);
        // the platform's own boards - all-time, monthly, friends - when a shell
        // provides them (Game Center on iOS); the web page has only its bests
        if (platform.boardsReady) {
            const global = el("button", "ac-primary ac-boardglobal", "GLOBAL & FRIENDS");
            global.onclick = () => platform.showBoards();
            scroll.append(global);
        }
        scroll.append(el("p", "ac-shelfhead", "BEST RUN, BY MODE"));
        const list = el("div", "ac-boardlist");
        runs.forEach((r, i) => {
            const row = el("div", r.best > 0 && i < 3 ? `ac-boardrow ac-medal${i + 1}` : "ac-boardrow");
            row.append(el("span", "ac-boardpos", r.best > 0 ? String(i + 1) : "\u2014"));
            const t = el("div", "ac-boardtxt");
            t.append(el("b", "", r.name));
            t.append(el("span", "ac-sub", r.best > 0 ? `Best ${r.unit}` : "Not flown yet"));
            row.append(t);
            row.append(el("span", "ac-boardscore", r.best > 0 ? r.best.toLocaleString() : "\u2013"));
            list.append(row);
        });
        scroll.append(list);
        // The one honest sentence. A board with no server behind it is a
        // personal record, and calling it anything else would be a lie the
        // player finds out the moment they look for someone to beat.
        scroll.append(el("p", "ac-fine", "These are your own records. There is no online board yet \u2014 when there is, "
            + "these are the runs that will be sent to it."));
        box.append(scroll);
        return box;
    }
    function drawHelp() {
        const box = el("div", "ac-menu");
        box.append(header("Flight deck", "Settings & Help"));
        const scroll = el("div", "ac-sheet-scroll");
        // music moved here from the Profile — settings and help share the
        // hub's gear button
        scroll.append(el("p", "ac-kicker ac-secthead", "Settings"), settingsRows());
        const spillHelp = drawSpillFlightHelp();
        const briefing = el("button", "ac-ghost ac-replay", "DEBRIS FIELD BRIEFING");
        briefing.dataset.spillBriefing = "";
        briefing.onclick = openSpillHelp;
        spillHelp.append(briefing);
        const fieldSelected = MODES[selectedMode]?.id === "spill";
        if (fieldSelected)
            scroll.append(spillHelp);
        scroll.append(el("p", "ac-kicker ac-secthead", "How to fly"));
        // the two controls, as two SEPARATE cards — tap and swipe must never
        // read as one combined instruction
        const controls = el("div", "ac-ctrls");
        for (const [glyph, title, sub, note, cls] of [
            ["\u25B2", "TAP", "BOOST UP", "anywhere, any time", "ac-ctrl ac-tap"],
            ["\u25BC", "SWIPE DOWN", "DIVE", "also cancels a bounce", "ac-ctrl ac-swipe"],
        ]) {
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
        if (!fieldSelected)
            scroll.append(spillHelp);
        const item = (art, name, desc) => {
            const row = el("div", "ac-helprow");
            row.append(art);
            const t = el("div");
            t.append(el("p", "", name));
            t.append(el("p", "ac-sub", desc));
            row.append(t);
            scroll.append(row);
        };
        const pic = (draw, px = 40) => {
            const { c, ctx } = miniCanvas(px, px);
            if (ctx)
                draw(ctx, px);
            return c;
        };
        const spr = (bank) => (ctx, px) => drawSpriteOn(ctx, engine.art?.[bank]?.[0] ?? null, px / 2, px / 2, px * 0.92);
        const one = (pick) => (ctx, px) => drawSpriteOn(ctx, engine.art?.[pick] ?? null, px / 2, px / 2, px * 0.92);
        item(pic(spr("acorn")), "ACORN", "Fly to earn. Spend in the Loadout.");
        // Keep all three currencies together, before temporary pickups.
        item(pic((ctx, px) => {
            // the help sheet paints to canvas, so the glyph is drawn by hand here
            // from the same proportions as I_DUST rather than inlining an <svg>
            ctx.save();
            ctx.translate(px / 2, px / 2);
            ctx.scale(px / 24, px / 24);
            ctx.fillStyle = "#c9b6ff";
            ctx.beginPath();
            ctx.moveTo(0, -9.8);
            ctx.lineTo(1.9, -3);
            ctx.lineTo(8.4, 0);
            ctx.lineTo(1.9, 3);
            ctx.lineTo(0, 9.8);
            ctx.lineTo(-1.9, 3);
            ctx.lineTo(-8.4, 0);
            ctx.lineTo(-1.9, -3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }), "STAR DUST", "Premium currency. 5 free every day, +25 on day 7.");
        item(pic((ctx, px) => drawSpriteOn(ctx, engine.art?.ore ?? null, px / 2, px / 2, px * 0.92)), "ACORN COINS", "Debris Field's run-only currency. Spend it at the Depot; it resets each run.");
        item(pic(one("frozen")), "FREEZE ACORN", `Slows everything for ${PHYS.powerDuration}s.`);
        item(pic(one("shieldnut")), "SHIELD ACORN", "Blocks one debris hit.");
        item(pic(spr("golden")), "GOLDEN ACORN", "Debris can't hurt you. Planets still bounce.");
        item(pic((ctx, px) => {
            const g = ctx.createRadialGradient(px / 2, px / 2, 1, px / 2, px / 2, px / 2);
            g.addColorStop(0, "#120424");
            g.addColorStop(0.6, "#6a3fb8");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px / 2, px / 2, px * 0.46, 0, Math.PI * 2);
            ctx.fill();
        }), "BLACK HOLE", "15s of warped flight: reversed or tilted.");
        item(pic((ctx, px) => {
            const g = ctx.createRadialGradient(px / 2, px / 2, 1, px / 2, px / 2, px / 2);
            g.addColorStop(0, "#042a24");
            g.addColorStop(0.6, "#6ef0d8");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px / 2, px / 2, px * 0.46, 0, Math.PI * 2);
            ctx.fill();
        }), "WORMHOLE", "Pulls you into a corridor. Hold to rise, release to fall.");
        // The mode blurbs left this screen: every mode describes itself on the
        // MODES sheet now.
        box.append(scroll);
        const replay = el("button", "ac-ghost ac-replay", "REPLAY TUTORIAL");
        replay.onclick = () => engine.replayTutorial();
        scroll.append(replay);
        // the prototype doors live on the beta's MODES sheet only
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
        return box;
    }
    /** ESCAPE CLOSES THE SHEET, NOT THE SCREEN (audit, Sep 2026). Every
     *  sheet closed by its own BACK button or a tap on the backdrop and by
     *  nothing else, while the engine's Escape is a screen-level key: over
     *  an open mission briefing it tore the whole chart down to the hub -
     *  and since the flag that opened the sheet was never touched, walking
     *  back onto the chart re-opened the very same sheet. The topmost sheet
     *  closes the way its own BACK closes it, one press at a time. */
    const closeTopSheet = () => {
        if (spillHelpOpen) {
            closeSpillHelp();
            return true;
        }
        else if (spendAsk)
            spendAsk = null;
        else if (dailyToast)
            dailyToast = null;
        else if (featureOpen) {
            featureOpen = null;
            confirmBuy = false;
        }
        else if (hyperRunOpen) {
            // the briefing's BACK, exactly: opened from the hub it came out of
            // MODES, so MODES is what it goes back to
            hyperRunOpen = false;
            boostNote = null;
            if (engine.world.screen === "title")
                modesOpen = true;
        }
        else if (rewardOpen) {
            rewardOpen = null;
            boostNote = null;
        }
        else if (rewardPreviewAt) {
            rewardPreviewAt = null;
            render();
            overlay.querySelector("[data-reward-preview]")?.focus({ preventScroll: true });
            return true;
        }
        else if (chartLevel) {
            chartLevel = null;
            boostNote = null;
        }
        else if (modesOpen)
            modesOpen = false;
        else
            return false;
        render();
        return true;
    };
    // capture, so this lands before the engine's own window listener and can
    // keep it from leaving the screen underneath
    window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape")
            return;
        const on = document.activeElement;
        // a text field owns its own Escape (the pilot name is edited in one)
        if (on && (on.tagName === "INPUT" || on.tagName === "TEXTAREA"))
            return;
        if (!overlay.querySelector(".ac-lvlsheet:not(.ac-depotwrap), .ac-spillhelpwrap"))
            return;
        if (!closeTopSheet())
            return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, { capture: true });
    engine.subscribe(render);
    render();
    window.addEventListener("resize", () => engine.resize());
}
