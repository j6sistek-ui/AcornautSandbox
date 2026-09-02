import { ART_VER, BETA_FEATURES, BUILD, ENVS, GAME_VERSION, GUIDE_HELM, GUIDE_SUIT, HELMETS, HELMET_SHELF, SUIT_SHELF, IAP_ITEMS, IS_BETA, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, NEWS, PALS, PHYS, SUITS, TRAILS, helmetWornBy, isIap, wearsOwnHead, BUNDLES, bundleIds, bundlePrice, idDust, SET_TRAIL, SHOP_CYCLE, alaCarteTotal, featurePrice, shopBundles, SHOP_SLOTS, OWN_HEAD_TAG, OWN_HEAD_LINE, DUST_PACKS, DAILY_DUST, DAILY_STREAK_BONUS, DAILY_STREAK_LEN } from "./catalog.js?v=170";
import { paintPortrait, paintTrailPreview, paintPalPreview, paintFlightPreview } from "./draw.js?v=170";
import { drawSprite as drawSpriteOn } from "./art.js?v=170";
import { createEngine } from "./engine.js?v=170";
import { batteryUnlocked, deepUnlocked, helmetRevealed, lostUnlocked, palUnlocked, startShieldUnlocked, suitRevealed, iapOwned, modsUnlocked, starsOf, trailUnlocked, PILOT_NAME_MAX } from "./save.js?v=170";
import { LEVELS, HYPER_RUN_MAX_ACORNS, HYPER_RUN_MISSION, STAGES, STAR_REWARDS, STAR_UNLOCKS, countBits, fxText, goalText, levelUnlocked, stageUnlocked, starTitle, RACE_GATES, nextGate } from "./campaign.js?v=170";
import { formatRaceTicks } from "./race.js?v=170";
import { SPILL, SPILL_LEVELS, SPILL_SHOP, spillExtendPrice, spillPrice } from "./spill.js?v=170";
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
            fired = true;
            b.classList.remove("ac-holding");
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
    // the purple beta chrome: every menu greys toward violet under this flag
    if (BETA_FEATURES)
        document.body.classList.add("ac-beta");
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
        { id: "deep", label: "DEEP SPACE", short: "DEEP", blurb: "Endless back-to-back black holes." },
        { id: "lost", label: "LOST IN SPACE", short: "LOST", blurb: "Space is in control here." },
        { id: "arcade", label: "ARCADE", short: "ARCADE", blurb: "2x power-ups, arcade graphics." },
        { id: "tunnel", label: "WORMHOLE RUN", short: "WORMHOLE", blurb: "Hold to thrust down the corridor." },
        { id: "race", label: "HYPER RUN", short: "HYPER", blurb: "Thread gates. Center the wormhole rings." },
        // THE SPILL graduated from the lab: a wave survival mode with a hull,
        // its own currency and a Depot every fifth wave. Its record is waves.
        { id: "spill", label: "THE SPILL", short: "SPILL", blurb: "Survive the waves. Mine Ore. Buy the next one." },
    ];
    const MODES = ALL_MODES.filter((m) => m.id !== "tunnel" || WORMHOLE_RUN_ON_SHEET);
    /** Start whatever is selected. Hyper Run opens its briefing first - it
     *  teaches two controls the other modes do not use, and that briefing is
     *  the same one the debris field opens. */
    function launchSelected() {
        const m = MODES[selectedMode] ?? MODES[0];
        if (m.id === "race") {
            modesOpen = false;
            hyperRunOpen = true;
            render();
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
    const keepShelves = () => {
        keptRowScroll = [...overlay.querySelectorAll(".ac-shelfrow")].map((r) => r.scrollLeft);
    };
    const restoreShelves = () => {
        [...overlay.querySelectorAll(".ac-shelfrow")].forEach((r, i) => {
            if (keptRowScroll[i])
                r.scrollLeft = keptRowScroll[i];
        });
    };
    const render = () => {
        const snap = engine.snap();
        const prevScroll = overlay.querySelector(".ac-sheet-scroll");
        if (prevScroll)
            keptScroll = prevScroll.scrollTop;
        keepShelves();
        overlay.innerHTML = "";
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
                    return;
                }
                // one button, not two: PULSE fires itself now, at the impact
                const sbar = el("div", "ac-spillbar");
                const lunge = el("button", sp.lungeCharges > 0 ? "ac-lunge" : "ac-lunge spent", "LUNGE ▸▸");
                lunge.onclick = () => engine.spillLunge();
                sbar.append(lunge);
                overlay.append(sbar);
            }
            return;
        }
        if (snap.screen === "pause") {
            const sheet = el("div", "ac-sheet ac-center ac-pausesheet");
            sheet.append(el("h2", "", "PAUSED"), el("p", "ac-sub", engine.world.race ? `TIME ${formatRaceTicks(engine.world.race.tick)}`
                : engine.world.spill ? `WAVE ${engine.world.spill.wave} · ${engine.world.spill.ore} ORE`
                    : `Score ${engine.world.score}`));
            // Mid-run A/B for the motion mappings. They only change how ECLIPSE is
            // drawn, so the row is there when Eclipse is the pilot and nowhere else.
            // Switching from the pause is the whole point: the three read completely
            // differently depending on what you were doing when you paused, and
            // going back to the hangar to change it loses the run you were judging.
            if (engine.save.equippedSuit === "eclipse") {
                const mode = (((engine.save.eclipseMotionMode ?? 2) % 3) + 3) % 3;
                sheet.append(el("p", "ac-sub", "PILOT MOTION"));
                const row = el("div", "ac-modes");
                row.style.gridTemplateColumns = "repeat(3, minmax(0,1fr))";
                ["Shipped", "Rate", "Heading"].forEach((name, i) => {
                    const mb = el("button", i === mode ? "ac-mode on" : "ac-mode", name);
                    mb.onclick = () => engine.setEclipseMotionMode(i);
                    row.append(mb);
                });
                sheet.append(row);
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
                : spill ? (spill.cause === "GROUNDED" ? "GROUNDED" : "LOST TO THE FIELD")
                    : "CRASHED"));
            if (!(BETA_FEATURES && snap.flight !== "tunnel") && !spill) {
                sheet.append(el("p", "", `Score ${snap.dead.score}`));
            }
            if (snap.dead.best && snap.dead.score > 0)
                sheet.append(el("p", "ac-gold", "NEW BEST"));
            if (spill) {
                // THE SPILL's receipt: waves as the headline, then what the run
                // mined and took. Ore stays here - it never reaches the wallet.
                const big = el("div", "ac-crashscore");
                big.append(el("b", "", String(snap.dead.score)), el("span", "", snap.dead.score === 1 ? "WAVE CLEARED" : "WAVES CLEARED"));
                sheet.append(big);
                if (spill.cause === "GROUNDED")
                    sheet.append(el("p", "ac-sub", "You cannot ride the floor."));
                const rows = el("div", "ac-rows ac-crashrows");
                const row = (label, v, gold = false) => {
                    const r = el("div", "ac-row");
                    r.append(el("span", "", label), el("span", gold ? "ac-rowgold" : "ac-rowdim", String(v)));
                    rows.append(r);
                };
                row("Ore mined", spill.oreMined, true);
                row("Hull hits", spill.hits);
                row("Grazes", spill.grazes);
                row("Debris shattered", spill.shattered);
                row("Best wave", engine.save.spillBest ?? 0, true);
                sheet.append(rows);
                // Graduation lands on whichever crash comes first after the
                // tutorial, this one included: the gift is shown where it is given
                if (engine.save.guide === "reward")
                    sheet.append(graduationGift());
                const again = el("button", engine.save.guide === "reward" ? "ac-ghost" : "ac-primary", "FLY AGAIN");
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
            else if (BETA_FEATURES) {
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
            else {
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
                }
                else {
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
            if (sc && keptScroll)
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
                if (keptScroll) {
                    sc.scrollTop = keptScroll;
                }
                else {
                    const cur = sc.querySelector(".ac-mapnode.cur");
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
            if (sc && keptScroll)
                sc.scrollTop = keptScroll;
            return;
        }
        if (snap.screen === "scores") {
            overlay.append(drawScores());
            return;
        }
        if (snap.screen === "help") {
            overlay.append(drawHelp());
        }
    };
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
    const I_EDIT = [
        "M4 20.4h4.2L19 9.6a2.1 2.1 0 0 0 0-3l-1.6-1.6a2.1 2.1 0 0 0-3 0L3.6 15.8z",
        "M13.4 6.2 17.8 10.6",
    ];
    const I_X = ["M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"];
    const I_MAIL = ["M3.4 6.6h17.2v10.8H3.4z", "m3.8 7.2 8.2 6 8.2-6"];
    const I_NUT = ["M6.5 9.5h11l-1.2 7A4 4 0 0 1 12.4 20h-.8a4 4 0 0 1-3.9-3.5z", "M6 6.6h12"];
    const I_GEAR = [
        "M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z",
        "M12 3.2v2.2M12 18.6v2.2M20.8 12h-2.2M5.4 12H3.2M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6M18.2 18.2l-1.6-1.6M7.4 7.4 5.8 5.8",
    ];
    const I_LOCK = ["M6 11h12v9H6z", "M9 11V8a3 3 0 0 1 6 0v3"];
    // Every menu wears the same head: a kicker, the screen's name, and
    // whichever counter that screen is actually about.
    function header(kicker, title, aside) {
        const h = el("header", "ac-menuhead");
        if (BETA_FEATURES) {
            // hub-and-spoke: the beta has no tab bar, so every menu carries
            // its own door back to the hub
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
        }
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
    /** a number that is a PRICE, never a bare integer. A card reading "70"
     *  says nothing about which purse it wants, and next to a card reading
     *  "OWNED" it reads like a score. */
    function costTag(n) {
        const w = el("span", "ac-costtag");
        w.append(icon(I_NUT, 11), el("b", "", n.toLocaleString()));
        return w;
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
        const owned = s.unlockedSuits.includes(u.id) || (isIap(u.id) && iapOwned(s, u.id));
        if (owned)
            return -1;
        const gate = STAR_UNLOCKS.suits[u.id];
        if (gate !== undefined)
            return 1000000 + gate;
        return u.cost;
    }
    function helmRank(h) {
        const s = engine.save;
        const owned = s.unlocked.includes(h.id) || (isIap(h.id) && iapOwned(s, h.id));
        if (owned)
            return -1;
        const gate = STAR_UNLOCKS.helmets[h.id];
        if (gate !== undefined)
            return 1000000 + gate;
        return h.cost;
    }
    function acornPill(n) {
        const pill = el("div", "ac-pill ac-pill-gold");
        pill.append(icon(I_NUT, 13), el("span", "", n.toLocaleString()));
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
    // `active` may be "none": Help is reached from the "?" on any screen, so
    // it belongs to no tab and must not light one up.
    // The coach: one line of guidance, pinned above the tab bar, that only
    // exists while the post-tutorial path is live. It never blocks a tap.
    function coach(text, inline = false) {
        // The coach floats over the screen by default, which is right on the
        // hangar and the level sheet - there is nothing under it that matters.
        // On the hub it was landing directly on the STAR CHART bar it points at,
        // covering that bar's own progress line: the instruction hid its target.
        // Inline puts it in the flow instead, above what it is talking about.
        return el("div", inline ? "ac-coach ac-coach-inline" : "ac-coach", text);
    }
    function tabbar(active) {
        const bar = el("nav", "ac-tabbar");
        const side = (screen, paths, label) => {
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
        if ((g === "hangar" || g === "helmet") && active !== "hangar")
            hangarTab.classList.add("ac-pulse");
        if (g === "levels" && active !== "log")
            levelsTab.classList.add("ac-pulse");
        bar.append(hangarTab, levelsTab, dome, side("profile", I_PILOT, "PROFILE"), side("shop", I_SHOP, "SHOP"));
        return bar;
    }
    // Seven painted rank frames, one per five levels, topping out at 30+.
    function rankTierOf(level) {
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
        for (const [file, type] of [
            ["intro.webm", 'video/webm; codecs="vp9"'],
            ["intro.mp4", 'video/mp4; codecs="avc1.4D401E"'],
        ]) {
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
        launch.onclick = () => launchSelected();
        controls.append(launch);
        // All modes visible at once. A mode the save has not earned stays on
        // the bar — dimmed and inert, so the bar never has a blank slot — and
        // its chip says the star price outright, so the lock is never a mystery.
        const modeOpen = (id) => id === "deep" ? deepUnlocked(s) : id === "lost" ? lostUnlocked(s) : true;
        const modePrice = (id) => id === "deep" ? STAR_UNLOCKS.deep : id === "lost" ? STAR_UNLOCKS.lost : 0;
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
                if (!open)
                    return;
                selectedMode = i;
                render();
            };
            modes.append(b);
        });
        controls.append(modes);
        if (s.guide === "hangar" || s.guide === "helmet") {
            box.append(coach("Your new gear is waiting \u2014 open the HANGAR"));
        }
        else if (s.guide === "levels") {
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
    // THE LEAN EDITOR, open or shut. Purely a view state - the values live in
    // the save - so it resets on reload, which is right: it is an instrument
    // you open to dial something in, not a mode the game sits in.
    let leanEdit = false;
    let hyperRunOpen = false;
    function nextStarReward(stars) {
        // "stage" rows opened a chapter, and chapters are gone - the chart is
        // one linear road now. They still sit in STAR_REWARDS because the
        // roadmap builder checks their thresholds against STAGES, but they
        // grant nothing, so the hub must not advertise one as the next unlock.
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
        acorns.append(icon(I_NUT, 14), el("span", "", s.acorns.toLocaleString()));
        acorns.onclick = () => engine.open("shop");
        // Star Dust sits beside acorns and carries a plus, because the only
        // way to get more is to buy it - so the counter may as well be the
        // door to where you do that.
        const dust = el("button", "ac-hub-iddust");
        dust.setAttribute("aria-label", "Buy Star Dust");
        dust.append(icon(I_DUST, 14, true), el("span", "", s.starDust.toLocaleString()), el("i", "ac-hub-plus", "+"));
        dust.onclick = () => { shopPage = "dust"; engine.open("shop"); };
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
        // line glyphs is not rendered at all while BETA_FEATURES is on.
        const boardBtn = el("button", "ac-hub-sq");
        boardBtn.setAttribute("aria-label", "Leaderboard");
        boardBtn.append(hubIcon("trophy"));
        boardBtn.onclick = () => engine.open("scores");
        const gear = el("button", "ac-hub-sq");
        gear.setAttribute("aria-label", "Settings and help");
        // the owner's painted acorn-gear plate replaces the line glyph
        gear.append(hubIcon("settings", false));
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
        ltxt.append(el("b", "", "FREE FLIGHT"), el("span", "ac-hubsub", "Begin your flight"));
        // WHAT IS ACTUALLY ON. Mods and a pal's effect change how the run plays
        // and were previously invisible from here - you had to remember. One
        // line, named plainly, so nobody launches wondering why the gates are
        // still or the gravity is wrong.
        {
            const on = [];
            for (const m of MODS)
                if (s[m.save])
                    on.push(m.name);
            const palOn = PALS.find((x) => x.id === s.equippedPal);
            // desc, not tag: "MAGNET" is a label, "Magnet Effect" is what the
            // hangar card says and it is the one a pilot has actually read.
            if (palOn && palOn.id !== "none" && !s.noPalFx)
                on.push(`${palOn.name}: ${palOn.desc}`);
            if (on.length) {
                // prefixed, because an unlabelled green line beneath a launch button
                // reads as a slogan rather than as the state of the run
                const line = el("span", "ac-hub-active");
                line.append(el("b", "", "Active Effects: "), el("span", "", on.join(" \u00b7 ")));
                ltxt.append(line);
            }
        }
        launch.append(lic, ltxt);
        launch.onclick = () => launchSelected();
        tiles.append(launch);
        const loadoutTile = tile("t-loadout", portraitOf(helm, suit, 50), "LOADOUT", "Suits & gear", () => engine.open("hangar"), undefined, s.guide === "hangar" || s.guide === "helmet");
        // an equipped pal announces itself on the tile — one green line
        const hubPal = PALS.find((p) => p.id === s.equippedPal);
        if (hubPal && hubPal.id !== "none") {
            loadoutTile.append(el("span", "ac-hubsub ac-hubequip", `${hubPal.name} equipped`));
        }
        const planet = miniCanvas(50, 50);
        if (planet.ctx)
            drawSpriteOn(planet.ctx, engine.art?.planets?.[8] ?? null, 25, 25, 46);
        // no dot: a badge should mean something NEW is inside, and nothing
        // in the mode sheet changes on its own
        tile("t-modes", planet.c, "MODES", "7 ways to fly · Lab", () => { modesOpen = true; render(); });
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
            // the Spill's face is its Ore: the thing the mode is about
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
    // THE DEPOT. The ship has four meters and a purchase fills one: PLATING,
    // SHIELD, THRUSTERS, POWER-UPS - plus a repair and a one-time core. What
    // the run has and what it still needs is the meter, so the sheet never
    // has to be read twice. The shelves are inert for a moment after they
    // appear (the Spill's own arm timer) so a thumb still tapping from the
    // wave cannot buy by accident, and the receipt names what was bought.
    // The clock is the Spill's own; only its span repaints, in place.
    function drawDepot(sp) {
        const wrap = el("div", "ac-lvlsheet");
        const sheet = el("div", "ac-lvlcard ac-depotcard");
        const arming = (sp.depot?.arm ?? 0) > 0;
        if (arming)
            sheet.classList.add("arming");
        const kicker = el("p", "ac-kicker");
        const clock = el("span", "ac-depotclock", `${Math.ceil(sp.depot?.timer ?? 0)}s`);
        kicker.append(el("span", "", `THE SPILL · WAVE ${sp.wave} CLEARED · `), clock);
        sheet.append(kicker);
        const tick = window.setInterval(() => {
            const live = engine.world.spill;
            if (!clock.isConnected || !live?.depot) {
                window.clearInterval(tick);
                return;
            }
            clock.textContent = `${Math.ceil(live.depot.timer)}s`;
        }, 250);
        sheet.append(el("h2", "ac-lvlname", "Depot"));
        const ore = el("div", "ac-depotore");
        ore.append(el("span", "", "ORE TO SPEND"), el("b", "", String(sp.ore)));
        sheet.append(ore);
        sheet.append(el("p", "ac-sub", `Hull ${sp.hull}/${sp.maxHull}`
            + `${sp.shield ? ` · ${sp.shield} shield${sp.shield > 1 ? "s" : ""}` : ""}`
            + `${sp.coreArmed ? " · core armed" : ""}`
            + " · the field returns when the clock runs out."));
        // one row per meter. The description is the NEXT level's, because that
        // is what the price buys; a full meter says so instead
        const row = (what, filled, total, sub) => {
            const shop = SPILL_SHOP[what];
            const price = spillPrice(sp, what);
            const can = price !== null && sp.ore >= price && !arming;
            const b = el("button", `ac-moderow ac-offer ac-upg${price === null ? " full" : can ? "" : " ac-cardoff"}`);
            if (price === null || arming)
                b.disabled = true;
            const t = el("span", "ac-moderowtxt");
            t.append(el("b", "", shop.name));
            const meter = el("span", "ac-upgmeter");
            for (let i = 0; i < total; i++)
                meter.append(el("i", i < filled ? "on" : ""));
            t.append(meter);
            t.append(el("span", "", price === null ? sub : sub));
            b.append(t, el("span", "ac-offerprice", price === null ? "FULL" : `${price} ORE`));
            b.onclick = () => { engine.spillBuy(what); };
            sheet.append(b);
        };
        const next = (what) => sp.up[what] >= SPILL_LEVELS ? `Level ${SPILL_LEVELS} · ${SPILL_SHOP[what].levels[SPILL_LEVELS - 1]}`
            : `Next: ${SPILL_SHOP[what].levels[sp.up[what]]}`;
        row("plating", sp.up.plating, SPILL_LEVELS, next("plating"));
        row("shield", sp.shield, 2, sp.shield >= 2 ? "Two carried, the most the hull holds." : SPILL_SHOP.shield.levels[0]);
        row("thrusters", sp.up.thrusters, SPILL_LEVELS, next("thrusters"));
        row("pulse", sp.up.pulse, SPILL_LEVELS, next("pulse"));
        if (sp.hull < sp.maxHull)
            row("repair", sp.hull, sp.maxHull, `Hull ${sp.hull}/${sp.maxHull} → full.`);
        if (!sp.coreBought)
            row("core", 0, 1, SPILL_SHOP.core.levels[0]);
        if (sp.depot?.bought.length) {
            const names = sp.depot.bought.map((b) => SPILL_SHOP[b].name);
            sheet.append(el("p", "ac-sub ac-depotreceipt", `Bought this stop: ${names.join(", ")}`));
        }
        const act = el("div", "ac-depotact");
        const extend = el("button", "ac-ghost", `+${SPILL.extendSeconds}s · ${spillExtendPrice(sp)} ORE`);
        extend.disabled = arming;
        extend.onclick = () => engine.spillExtend();
        const go = el("button", "ac-primary", "BACK TO THE FIELD");
        go.disabled = arming;
        go.onclick = () => engine.spillLeaveDepot();
        act.append(extend);
        sheet.append(act, go);
        wrap.append(sheet);
        return wrap;
    }
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
    function shopImg(src, alt, px = 64) {
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
        if (!ctx)
            return c;
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
    function modIcon(id, px = 56) {
        const { c, ctx } = miniCanvas(px, px);
        if (!ctx)
            return c;
        const mid = px / 2;
        const gap = px * 0.30;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const disc = (cy) => {
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
    function palCardOf(pl, forShop = false) {
        const s = engine.save;
        const premium = isIap(pl.id);
        const open = premium ? iapOwned(s, pl.id) : palUnlocked(s, pl.id);
        const b = el("button", s.equippedPal === pl.id ? "ac-card ac-palcard on" : "ac-card ac-palcard");
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
        const status = premium ? (open ? "OWNED" : "PREMIUM")
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
        const helm = helmetWornBy(s.equipped, s.equippedSuit);
        const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
        const trail = TRAILS.find((t) => t.id === s.equippedTrail) ?? TRAILS[0];
        const pal = PALS.find((p) => p.id === s.equippedPal);
        const box = el("div", "ac-menu");
        box.append(BETA_FEATURES
            ? header("Suits & gear", "Loadout", headAside(s.acorns))
            : header("Customize your squirrel", "Hangar", headAside(s.acorns)));
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
            const palWorn = PALS.find((x) => x.id === s.equippedPal && x.id !== "none");
            const CASE_W = 344, CASE_H = 236;
            const stage = el("div", "ac-shopcase ac-hangarcase");
            stage.style.setProperty("--case-glow", wornSuit.glow ?? wornSuit.trim ?? "#c4a0ff");
            stage.style.setProperty("--case-lite", wornSuit.suitLite ?? "#8a5ae4");
            stage.style.setProperty("--case-deep", wornSuit.suitDark ?? "#160f34");
            const pane = el("div", "ac-casepane");
            const { c, ctx } = miniCanvas(CASE_W, CASE_H);
            c.className = "ac-tocanvas ac-casecanvas";
            c.setAttribute("role", "img");
            c.setAttribute("aria-label", `${wornSuit.name} in flight`);
            pane.append(el("i", "ac-casebeam"), c, el("i", "ac-casefloor"));
            for (const corner of ["tl", "tr", "bl", "br"]) {
                pane.append(el("i", `ac-casecorner ac-c-${corner}`));
            }
            if (ownHead)
                pane.append(el("span", "ac-tonohelm ac-casetag", OWN_HEAD_TAG));
            stage.append(pane);
            const plate = el("div", "ac-caseplate");
            plate.append(el("span", "ac-caseeyebrow", "EQUIPPED"));
            plate.append(el("b", "", wornSuit.name + (ownHead ? "" : ` \u00b7 ${wornHelm.name}`)));
            plate.append(el("span", "ac-casesub", `${trail.name} \u00b7 ${palWorn?.name ?? "No pal"}`));
            if (s.startShield) {
                const tags = el("div", "ac-rigtags");
                tags.append(el("span", "ac-tagpill ac-tagblue", "+1 SHIELD"));
                plate.append(tags);
            }
            stage.append(plate);
            box.append(stage);
            if (ctx) {
                // the worn suit is usually home already, but a pilot who equips and
                // opens the loadout inside the same second can still beat the load
                engine.wantSuitArt(wornSuit.id);
                if (palWorn)
                    engine.wantPalArt(palWorn.id);
                const t0 = performance.now();
                const tick = () => {
                    if (!c.isConnected)
                        return;
                    const tt = (performance.now() - t0) / 1000;
                    ctx.clearRect(0, 0, CASE_W, CASE_H);
                    // the old pair of branches here tested noPalFx and then did the
                    // same thing either way, so the switch never switched anything
                    if (palWorn)
                        paintPalPreview(ctx, engine.art, palWorn.id, CASE_W - 58, 80, 52);
                    paintFlightPreview(ctx, engine.art, wornSuit, wornHelm, CASE_W / 2 - 14, 128, 158, tt, engine.suitLeanOf(wornSuit.id), leanEdit);
                    requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }
            if (IS_BETA)
                box.append(leanTuner(wornSuit, render));
        }
        const tabs = el("div", "ac-cats");
        for (const t of ["suits", "helmets", "trails", "pals", "mods"]) {
            const b = el("button", t === engine.shopTab ? "ac-cat on" : "ac-cat", t.toUpperCase());
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
                note.append(el("p", "ac-lockedhead", `${suit.name}: ${OWN_HEAD_LINE}`), el("p", "ac-sub", "The helmet is part of the character. Equip another suit to change helmets."));
                scroll.append(note);
            }
            // grouped by what the GLASS does. A suit-locked helmet is not listed
            // at all: it arrives with its suit, and a card that cannot be chosen
            // answers nothing.
            grid.classList.add("ac-shelfcol");
            if (s.shelfGrid)
                grid.classList.add("ac-asgrid");
            for (const sec of HELMET_SHELF) {
                const items = sec.ids
                    .map((id) => HELMETS.find((h) => h.id === id))
                    .filter((h) => !!h && !h.suitOnly)
                    .filter((h) => !isIap(h.id) || iapOwned(s, h.id))
                    .sort((a, bq) => helmRank(a) - helmRank(bq));
                if (!items.length)
                    continue;
                grid.append(el("p", "ac-shelfhead", sec.title));
                const row = el("div", "ac-shelfrow");
                for (const h of items) {
                    const premium = isIap(h.id);
                    const open = helmetRevealed(s, h.id);
                    const owned = premium ? iapOwned(s, h.id) : s.unlocked.includes(h.id);
                    const b = el("button", !locked && s.equipped === h.id ? "ac-card on" : "ac-card");
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
                        tx(b, () => engine.buyHelmet(h.id), h.cost); };
                    row.append(b);
                }
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
                const owned = premium ? iapOwned(s, u.id) : s.unlockedSuits.includes(u.id);
                const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
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
                    nh.title = OWN_HEAD_LINE;
                    b.append(nh);
                }
                // owned premium keeps its bloom; unowned premium never reaches here
                if (premium)
                    markPremium(b, u.glow);
                if (s.guide === "hangar" && u.id === GUIDE_SUIT)
                    b.classList.add("ac-pulse", "ac-guidetarget");
                b.onclick = () => { if (!premium || owned)
                    tx(b, () => engine.buySuit(u.id), u.cost); };
                return b;
            };
            for (const sec of SUIT_SHELF) {
                const items = sec.ids
                    .map((id) => SUITS.find((x) => x.id === id))
                    .filter((u) => !!u)
                    // premium you do not own belongs in the shop, not the wardrobe
                    .filter((u) => !isIap(u.id) || iapOwned(s, u.id))
                    // cheapest first, so the shelf reads as a ladder rather than a
                    // pile. Owned things lead (nothing left to pay), then acorn
                    // prices in order, then star gates by their star price.
                    .sort((a, bq) => suitRank(a) - suitRank(bq));
                if (!items.length)
                    continue;
                grid.append(el("p", "ac-shelfhead", sec.title));
                const row = el("div", "ac-shelfrow");
                // Aurora and Stardust left this shelf for the beta bench (their
                // banks drifted); production shows one placeholder card in their
                // spot so the row reads "more coming", not "two got deleted".
                if (sec.title === "STANDARD" && !SUITS.some((x) => x.id === "aurorasuit")) {
                    const ph = el("div", "ac-card ac-card-soon");
                    ph.append(el("span", "ac-soonmark", "?"));
                    ph.append(el("p", "ac-cardname", "NEW SUITS"));
                    ph.append(el("p", "ac-soonnote", "In the workshop"));
                    row.append(ph);
                }
                for (const u of items) {
                    // on the purchased shelf, a premium suit not yet bought is a door
                    // to the shop, not a dead locked card
                    if (sec.shop && isIap(u.id) && !iapOwned(s, u.id)) {
                        const sq = el("button", "ac-card ac-shopcard");
                        sq.append(el("span", "ac-shopglyph", "+"), document.createTextNode(`${u.name}\nIN THE SHOP`));
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
                    txt.append(el("p", "ac-modname", MOTION_MODES[mode][0]), el("p", "ac-sub", MOTION_MODES[mode][1] + " Tap to cycle."));
                    const sw = el("span", mode > 0 ? "ac-switch on" : "ac-switch");
                    sw.append(el("i", "ac-knob"));
                    alt.append(txt, sw);
                    alt.onclick = () => engine.setEclipseMotionMode(((engine.save.eclipseMotionMode ?? 2) + 1) % 3);
                    grid.append(alt);
                }
            }
        }
        else if (engine.shopTab === "trails") {
            for (const t of TRAILS.filter((x) => !isIap(x.id) || iapOwned(s, x.id))) {
                const premium = isIap(t.id);
                const open = trailUnlocked(s, t.id);
                const b = el("button", s.equippedTrail === t.id ? "ac-card on" : "ac-card");
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
                if (!open)
                    b.classList.add("ac-cardoff");
                b.onclick = () => { if (open)
                    tx(b, () => engine.buyTrail(t.id), t.cost); };
                grid.append(b);
            }
        }
        else if (engine.shopTab === "pals") {
            // Pals carry a sentence, not a two-word tag, so their shelf runs two
            // wide where everything else runs four.
            grid.classList.add("ac-palgrid");
            for (const p of PALS.filter((x) => !isIap(x.id) || iapOwned(s, x.id)))
                grid.append(palCardOf(p));
        }
        else {
            // Mods are BOUGHT, like everything else on this screen, so they get
            // the same card with the same price on it. They used to be two bare
            // switches parked in the Profile, which read as free settings — the
            // start shield in particular is charged for every single arming.
            const mod = (id, name, blurb, cost, state, pic, hit) => {
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
                }
                else {
                    b.append(txt, el("span", "ac-modprice", state ?? `${cost}`));
                }
                b.onclick = () => hit();
                grid.append(b);
                return b;
            };
            // PAL EFFECTS OFF LEADS. It is the only mod that costs nothing and is
            // never gated, so it is the one every pilot can actually use - burying
            // it under two star-gated shield utilities put the free thing third.
            // The flight mods come with it; the shield utilities follow.
            // Flight mods change how a run FLIES rather than what you survive, so
            // they say ON / OFF rather than OWNED: buying one does not force you
            // to fly with it. They stay locked until LV 30 — a pilot should have
            // flown the game as designed before rewriting how it moves.
            const modsOpen = modsUnlocked(s);
            if (!modsOpen) {
                scroll.append(el("p", "ac-sub ac-modlock", `Flight mods unlock at \u2605 ${STAR_UNLOCKS.flightMods}. They change how the game moves — fly it as built first.`));
            }
            for (const m of MODS) {
                const owned = m.always || s.purchased.includes(m.id);
                const on = !!s[m.save];
                // an always-on mod ignores the star gate the others sit behind: it
                // takes something away rather than granting it, so there is nothing
                // to earn first
                const open = m.always || modsOpen;
                const b = mod(m.id, m.name, m.desc, m.always ? 0 : m.cost, !open ? `\u2605 ${STAR_UNLOCKS.flightMods}` : on ? "ON" : owned ? "OFF" : null, modIcon(m.id, 56), () => { if (open)
                    tx(b, () => engine.setMod(m.id), m.always ? undefined : m.cost); });
                if (!open)
                    b.classList.add("ac-cardoff");
            }
            const shieldNut = () => {
                const { c, ctx } = miniCanvas(56, 56);
                if (ctx && engine.art?.shieldnut)
                    drawSpriteOn(ctx, engine.art.shieldnut, 28, 28, 52);
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
            const shieldCard = mod("shield", "Start Shield", "Begin the next run already shielded. Charged each time you arm it.", MOD_SHIELD_COST, !shieldOpen ? `\u2605 ${STAR_UNLOCKS.startShield}` : s.startShield ? "ARMED" : "OFF", shieldNut(), () => { if (shieldOpen)
                tx(shieldCard, () => engine.toggleMod("shield"), MOD_SHIELD_COST); });
            if (!shieldOpen)
                shieldCard.classList.add("ac-cardoff");
            const batteryCard = mod("battery", "Shield Battery", "Stack up to three shield charges instead of one. Bought once.", MOD_BATTERY_COST, !batteryOpen ? `\u2605 ${STAR_UNLOCKS.battery}` : s.battery ? "OWNED" : null, batteryIcon(56), () => { if (batteryOpen)
                tx(batteryCard, () => engine.toggleMod("battery"), MOD_BATTERY_COST); });
            if (!batteryOpen)
                batteryCard.classList.add("ac-cardoff");
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
        shopBanner.onclick = () => { shopPage = "packs"; engine.open("shop"); };
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
        if (!BETA_FEATURES)
            box.append(tabbar("hangar"));
        return box;
    }
    /** THE LEAN TUNER — beta only.
     *
     *  An instrument for FINDING a number, not a setting for players to keep.
     *  The roster is calibrated in SUIT_LEAN now (0.80 climb, 0.30 dive, found
     *  right here), and a live pilot has no reason to meet a panel of
     *  multipliers under their suit - it reads as something they broke.
     *
     *  Built as a named function called from ONE gated line, so
     *  verify_dev_instruments can hold it to the beta page the same way it
     *  holds every other instrument. An inline `if (IS_BETA)` block would have
     *  been invisible to that table and free to drift onto live.
     */
    function leanTuner(wornSuit, render) {
        //
        // How far this suit tips climbing and diving, changed here and seen
        // in the case above at the attitudes that matter: opening it puts the
        // preview into a slow sweep between FULL CLIMB and FULL DIVE, which
        // are the two ends the ordinary tap arc never reaches.
        //
        // It lives in the LOADOUT, beside the suit it belongs to, and not in
        // the pause menu - a dial you meet mid-flight and cannot leave is the
        // exact thing that was removed on 25 Aug and is not coming back. This
        // one is somewhere you go on purpose and can walk away from.
        //
        // The numbers are working values in the save so they survive the
        // reload it takes to fly a change. COPY LEAN hands back the whole
        // table to paste into SUIT_LEAN once one is settled.
        const leanBox = el("div", "ac-leanbox");
        const cur = engine.suitLeanOf(wornSuit.id);
        const deg = (mult, rot) => (rot * 0.8 * mult * 180 / Math.PI).toFixed(0);
        const head = el("button", "ac-leanhead");
        head.append(el("b", "", "LEAN"), el("span", "ac-leanread", `climb ${deg(cur.up, -0.55)}\u00b0 \u00b7 dive ${deg(cur.down, 0.95)}\u00b0`), el("span", "ac-leancaret", leanEdit ? "\u2715" : "EDIT"));
        head.onclick = () => { leanEdit = !leanEdit; render(); };
        leanBox.append(head);
        if (leanEdit) {
            const row = (label, key, rot) => {
                const r = el("div", "ac-leanrow");
                const val = el("span", "ac-leanval", "");
                const paint = () => {
                    const l = engine.suitLeanOf(wornSuit.id);
                    val.textContent = `${l[key].toFixed(2)}  (${deg(l[key], rot)}\u00b0)`;
                };
                const step = (d) => {
                    const l = engine.suitLeanOf(wornSuit.id);
                    engine.setSuitLean(wornSuit.id, key === "up" ? l.up + d : l.up, key === "down" ? l.down + d : l.down);
                    paint();
                };
                const minus = el("button", "ac-leanstep", "\u2212");
                minus.setAttribute("aria-label", `less ${label}`);
                minus.onclick = () => step(-0.05);
                const plus = el("button", "ac-leanstep", "+");
                plus.setAttribute("aria-label", `more ${label}`);
                plus.onclick = () => step(0.05);
                paint();
                r.append(el("span", "ac-leanlabel", label), minus, val, plus);
                return r;
            };
            leanBox.append(row("CLIMB", "up", -0.55), row("DIVE", "down", 0.95));
            const acts = el("div", "ac-leanacts");
            const reset = el("button", "ac-ghost", "RESET");
            reset.onclick = () => { engine.resetSuitLean(wornSuit.id); render(); };
            const copy = el("button", "ac-ghost", "COPY LEAN");
            copy.onclick = () => {
                const text = engine.leanExport();
                const done = () => {
                    copy.textContent = "COPIED";
                    window.setTimeout(() => { copy.textContent = "COPY LEAN"; }, 2000);
                };
                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(text).then(done, () => { copy.textContent = "TAP AGAIN"; });
                }
                else {
                    const ta = document.createElement("textarea");
                    ta.value = text;
                    ta.style.cssText = "position:fixed;left:8px;right:8px;bottom:70px;height:140px;z-index:99";
                    document.body.append(ta);
                    ta.select();
                    try {
                        document.execCommand("copy");
                        done();
                    }
                    catch { /* leave it to copy by hand */ }
                    window.setTimeout(() => ta.remove(), 8000);
                }
            };
            acts.append(reset, copy);
            leanBox.append(acts);
            leanBox.append(el("p", "ac-leannote", "The case sweeps full climb to full dive. 1.00 is what ships."));
        }
        return leanBox;
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
        else if (item.kind === "mod") {
            drawSpriteOn(ctx, art.shield?.[0] ?? null, px / 2, px / 2, px * 0.82);
        }
        else if (item.kind === "title") {
            drawRankBadge(ctx, item.name ?? "", px);
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
    // ONE road, bottom-up: a hundred numbered levels climbing from the
    // first flight at the very bottom of the scroll to the last at the top.
    // No chapters, no tabs, no level names — a planet, a number, and up to
    // three stars each. Star rewards ride a milestone rail down the right
    // edge, level with the mission whose three-star ceiling first covers
    // their price, greyed until banked.
    function fullChart(stars, total) {
        const levels = LEVELS;
        const gatesDone = engine.save.raceGates || [];
        const W = Math.min(460, Math.max(292, window.innerWidth - 32));
        const railW = 78; // the milestone rail owns the right edge
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
            mark.append(rewardArt({ kind: r.kind, id: r.id, name: r.name }, 40));
            mark.append(el("span", "ac-palmarkstar", `\u2605 ${r.stars}`));
            mark.append(el("span", "ac-rmarkname", r.name));
            map.append(mark);
        });
        levels.forEach((lvl, i) => {
            const mask = stars[lvl.id] || 0;
            const can = levelUnlocked(lvl, stars, total, gatesDone);
            const isCur = i === current;
            const done = (mask & 1) === 1;
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
            const arrived = ((stars[`${Math.ceil(g.after / 10)}-${((g.after - 1) % 10) + 1}`] || 0) & 1) === 1;
            const blocking = !done && arrived
                && !RACE_GATES.some((o) => o.after < g.after && !gatesDone.includes(o.after));
            const band = el("div", `ac-debris${done ? " done" : blocking ? " blocking" : " locked"}`);
            band.style.top = `${y}px`;
            band.style.width = `${roadW}px`; // the road only: the rail keeps its lane
            // one sprite, repeated along the line at varying size and tilt so it
            // reads as rubble rather than as a row of identical stamps
            const bank = engine.art?.debris ?? [];
            const spriteIdx = bank.length ? (gi * 9 + 3) % bank.length : 0;
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
            map.append(tag);
        }
        const wrap = el("div", "ac-chartmapwrap");
        wrap.append(map);
        return wrap;
    }
    let chartStage = 0; // which stage panel is open; sticky per visit
    let chartLevel = null; // level detail overlay
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
            for (const st of STAGES)
                if (stageUnlocked(st.num, total))
                    open = st.num;
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
                        row.append(rewardArt({ kind: r.kind, id: r.id, name: r.name }));
                    }
                    const txt = el("div", "ac-roadtxt");
                    txt.append(el("p", "ac-roadlvl", `\u2605 ${r.stars}`));
                    txt.append(el("p", "", r.name));
                    txt.append(el("p", "ac-sub", r.desc));
                    row.append(txt);
                    if (total >= r.stars)
                        row.append(el("span", "ac-check", "\u2713"));
                    ladder.append(row);
                }
            }
            scroll.append(ladder);
        }
        if (BETA_FEATURES) {
            scroll.append(fullChart(stars, total));
        }
        else {
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
                }
                else {
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
                            if (can)
                                b.onclick = () => { chartLevel = lvl.id; render(); };
                            if (sv.guide === "levels" && lvl.id === "1-1")
                                b.classList.add("ac-pulse");
                            grid.append(b);
                        }
                        card.append(grid);
                    }
                }
                scroll.append(card);
            }
        }
        if (sv.guide === "levels")
            box.append(coach("Fly MISSION 1 \u2014 tap level 1, then TAKE FLIGHT"));
        box.append(scroll);
        if (!BETA_FEATURES)
            box.append(tabbar("log"));
        // level detail: goals, modifiers, and the FLY button
        if (chartLevel) {
            const def = LEVELS.find((l) => l.id === chartLevel);
            if (def)
                box.append(drawLevelSheet(def, stars[def.id] || 0));
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
    function drawLevelSheet(def, mask, origin = "chart") {
        const wrap = el("div", "ac-lvlsheet");
        const sheet = el("div", "ac-lvlcard");
        const raceBriefing = def.standalone && def.base === "race";
        if (raceBriefing)
            sheet.classList.add("ac-racecard");
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
        }
        else {
            const place = def.base === "race" ? "HYPER RUN"
                : def.base === "tunnel" ? "WORMHOLE RUN"
                    : def.base === "spill" ? "THE SPILL"
                        : ENVS[def.fx.env ?? 0]?.name ?? "";
            sheet.append(el("p", "ac-kicker", def.standalone
                ? "HYPER RUN · TIME TRIAL"
                : `LEVEL ${def.id} \u00b7 ${place}`));
            sheet.append(el("h2", "ac-lvlname", def.name));
            const mode = def.base === "race" ? "DETERMINISTIC TIME TRIAL" :
                def.base === "deep" ? "DEEP SPACE RULES" :
                    def.base === "lost" ? "LOST IN SPACE RULES" :
                        def.base === "arcade" ? "ARCADE TIMELINE" :
                            def.base === "tunnel" ? "WORMHOLE MISSION" :
                                def.base === "spill" ? "SPILL MISSION" : "";
            const fxs = fxText(def.fx);
            if (mode || fxs.length) {
                const tags = el("div", "ac-lvltags");
                if (mode)
                    tags.append(el("span", "ac-lvltag mode", mode));
                for (const t of fxs)
                    tags.append(el("span", "ac-lvltag", t));
                sheet.append(tags);
            }
        }
        if (raceBriefing) {
            const briefing = el("div", "ac-racebrief");
            const objective = el("section", "ac-racebriefblock ac-raceobjective");
            objective.append(el("h3", "", "OBJECTIVE"), el("p", "", "Thread blue gates to build speed and charge the wormhole. Take shortcuts and reach the finish as fast as possible. Acorns are an optional collection record and do not change your time."));
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
                note.append(el("b", "", `DEBRIS FIELD AFTER LEVEL ${g.after}`), el("span", "", ` \u00b7 finish under ${g.label} to clear it`));
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
                if (origin === "modes")
                    modesOpen = false;
                render();
            }
        };
        const back = el("button", "ac-ghost", "BACK");
        const close = () => {
            chartLevel = null;
            // the sheet is open because a flag says so, and the flag has to be
            // cleared on BOTH routes or closing it from the chart just redraws it
            hyperRunOpen = false;
            if (origin === "modes")
                modesOpen = true;
            render();
        };
        back.onclick = close;
        sheet.append(fly, back);
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
                const g = nextGate(engine.save.raceGates);
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
        sheet.append(el("p", "ac-kicker", `LEVEL ${last.def.id} \u00b7 ${last.def.name}`));
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
    let shopPage = "packs";
    // what the PREVIEW page is currently wearing. Not the save: you are
    // trying premium on, not equipping it, and nothing here is owned.
    let tryOn = { suit: "", helm: "", pal: "" };
    let packOpen = null; // the pack whose contents are open
    let confirmBuy = false; // the pack sheet is asking "are you sure"
    /** set by the engine's arrival-claim so the shop can announce it once */
    let dailyToast = null;
    let revealPack = null; // a pack just bought, being shown off
    let revealPick = null; // the card tapped inside the reveal
    let revealScroll = 0; // where the swipe strip was left
    let editingName = false; // the Profile name is in edit mode
    const PILOT_FALLBACK = "Nutcracker"; // shown until a pilot picks one
    // ==================================================== THE STOREFRONT
    // Beta only. One page, no tabs: the look is worn on the squirrel at the
    // top, the pieces that make it are bought underneath, and the featured
    // pack sits below as the bulk alternative.
    //
    // IS_BETA, not BETA_FEATURES: the feature flag has been on everywhere
    // since the beta set was promoted, so it would put this on the live
    // storefront. This one is genuinely not ready for that.
    let devRollOpen = false;
    let featureOpen = null; // the featured pack, opened
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
        const owns = (i) => iapOwned(s, i);
        const day = shopDayIndex();
        // ONE featured pack, never one already owned outright
        const open = BUNDLES.filter((b) => !bundleIds(b).every(owns));
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
        const suits = dealFrom(suitPool.filter((i) => !helms.includes(i)), SHOP_CYCLE.suits, day * 7 + 1);
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
        // open() already claimed on arrival; collect the payment for the strip
        const claimed = engine.takeDailyClaim();
        if (claimed)
            dailyToast = claimed;
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
            pane.append(el("span", "ac-tonohelm ac-casetag", OWN_HEAD_TAG));
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
                paintFlightPreview(ctx, engine.art, suit, helm, CASE_W / 2 - 14, 128, 158, t);
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
                for (const id of order) {
                    if (!tx(bar, () => engine.buyShopItem(id), idDust(id), "dust"))
                        break;
                    picked.delete(id);
                    bought += 1;
                }
                if (bought)
                    render();
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
        for (const dp of DUST_PACKS) {
            const row = el("button", "ac-card ac-modcard ac-dustrow");
            const face = el("span", "ac-dustface");
            face.append(icon(I_DUST, 30, true));
            row.append(face);
            const t = el("div", "ac-modtxt");
            t.append(el("p", "ac-modname", `${(dp.dust + dp.bonus).toLocaleString()} Star Dust`), el("p", "ac-sub", dp.bonus ? `${dp.dust.toLocaleString()} + ${dp.bonus} bonus` : "Starter handful."));
            row.append(t, el("span", "ac-modprice ac-cashprice", dp.price));
            row.onclick = () => { tx(row, () => engine.buyDust(dp.id)); render(); };
            scroll.append(row);
        }
        scroll.append(codeRow());
        // The rail is unconnected on BOTH pages, so live needs to be told too -
        // just not in the beta's words.
        scroll.append(el("p", "ac-fine", IS_BETA
            ? "The payment rail is not connected yet, so dust is granted during the beta."
            : "Star Dust purchases are not open yet. Everything else on this page works."));
        box.append(scroll);
        // THE CYCLE INSPECTOR SHIPS ON BOTH PAGES. It was gated on beta while
        // the storefront was, but the storefront is the shop on both pages now
        // and the cycle is tuned by watching a real shelf - which is the live
        // one. It stays rolled up to a single line until it is asked for, so
        // it costs a player who never opens it nothing but a row of small type.
        box.append(drawCycleRoll(cy));
        if (featureOpen)
            box.append(drawFeatureSheet(featureOpen));
        if (dailyToast)
            box.append(drawDailyToast(dailyToast));
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
        const owns = (i) => iapOwned(s, i);
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
        bar.append(el("b", "", devRollOpen ? "▾ OFF THE SHELF TODAY" : "▴ OFF THE SHELF TODAY"), el("span", "", `${held.length} in the pack · ${resting.length} resting · ${owned.length} owned`));
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
        group("OWNED", owned, "Bought already, so the shelf never offers it again.");
        wrap.append(panel);
        return wrap;
    }
    function drawShop() {
        // THE STOREFRONT IS THE SHOP NOW, on both pages. It was beta-gated while
        // it was unflown; it has been flown. The tabbed shop below is kept, not
        // deleted, because it is the only written record of what the old screen
        // did - and if something turns out to be missing from the storefront it
        // is rebuilt there, deliberately, rather than recovered from a diff.
        return drawShopBeta();
        const s = engine.save;
        // open() already claimed on arrival; this is where the payment gets
        // picked up and shown. takeDailyClaim clears as it hands over, so a
        // re-render inside the same visit does not raise the popup again.
        const claimed = engine.takeDailyClaim();
        if (claimed)
            dailyToast = claimed;
        const box = el("div", "ac-menu");
        box.append(header("Premium", "Shop", headAside(s.acorns)));
        // NO TYPE TABS. The shop used to re-list suits, helmets and pals - the
        // same art, wired to the same equip calls, that the Loadout already
        // shows. Three tabs of duplicate wardrobe, and on the live page every
        // premium card in them was inert. The shop SELLS. What you own is the
        // Loadout's job.
        const tabs = el("div", "ac-cats");
        for (const t of ["packs", "preview", "dust"]) {
            const b = el("button", t === shopPage ? "ac-cat on" : "ac-cat", t === "packs" ? "PACKS" : t === "preview" ? "PREVIEW" : "STAR DUST");
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
        if (shopPage === "preview") {
            scroll.append(drawTryOn());
            box.append(scroll);
            if (!BETA_FEATURES)
                box.append(tabbar("shop"));
            return box;
        }
        if (shopPage === "packs") {
            // THE DAY'S SHELF, not the whole catalogue. Three packs chosen by the
            // date, the same three all day, a fresh draw tomorrow - and a pack
            // the pilot owns is gone from the pool for good rather than sitting
            // there greyed out. See shopBundles.
            const shelf = shopBundles(Date.now(), (i) => iapOwned(s, i));
            for (const bn of shelf) {
                const card = el("button", "ac-card ac-bundle");
                const strip = el("div", "ac-bundlestrip");
                for (const it of bn.items.slice(0, 4)) {
                    const suit = it.kind === "suit" && SUITS.find((u) => u.id === it.id);
                    const helm = it.kind === "helm" && HELMETS.find((h) => h.id === it.id);
                    if (suit)
                        strip.append(suitCardOf(suit, 40));
                    else if (helm)
                        strip.append(helmCardOf(helm, 40));
                }
                // every slot is one wearable now that the list says what each is -
                // no more counting an id twice because a suit and its helmet share
                const worn = bn.items.length;
                if (worn > 4)
                    strip.append(el("span", "ac-bundlemore", `+${worn - 4}`));
                card.append(strip);
                const txt = el("div", "ac-modtxt");
                txt.append(el("p", "ac-modname", bn.name), el("p", "ac-sub", bn.blurb));
                card.append(txt);
                // what the pack costs THIS pilot: the packs overlap, so anything
                // already owned has come off the price
                const due = bundlePrice(bn, (i) => iapOwned(s, i));
                const price = el("span", "ac-modprice ac-dustprice");
                price.append(icon(I_DUST, 12, true), el("span", "", due.toLocaleString()));
                if (due < bn.dust) {
                    price.append(el("s", "ac-wasprice", bn.dust.toLocaleString()));
                    card.classList.add("ac-partly");
                }
                card.append(price);
                card.append(el("span", "ac-bundlecount", `${worn} items`));
                // Buying used to happen on this tap, which asked a pilot to spend
                // four figures on a strip of four faces and a count. It opens the
                // pack instead; the purchase lives inside, next to the list of what
                // it actually contains.
                card.onclick = () => { packOpen = bn.id; confirmBuy = false; render(); };
                grid.append(card);
            }
            if (!shelf.length) {
                grid.append(el("p", "ac-sub ac-shelfempty", "Every pack on the shelf is yours. The shop restocks tomorrow."));
            }
            else if (shelf.length < SHOP_SLOTS) {
                grid.append(el("p", "ac-sub ac-shelfempty", "That is the shelf for today \u2014 it restocks tomorrow."));
            }
            grid.append(codeRow());
        }
        else {
            for (const pk of DUST_PACKS) {
                const card = el("button", "ac-card ac-bundle ac-dustpack");
                const face = el("div", "ac-dustface");
                face.append(icon(I_DUST, 40, true));
                card.append(face);
                const txt = el("div", "ac-modtxt");
                txt.append(el("p", "ac-modname", `${pk.dust.toLocaleString()} Star Dust`), el("p", "ac-sub", pk.bonus ? `+${pk.bonus} bonus \u2014 ${(pk.dust + pk.bonus).toLocaleString()} total` : "Starter handful."));
                card.append(txt, el("span", "ac-modprice", pk.price));
                card.onclick = () => { tx(card, () => engine.buyDust(pk.id)); };
                grid.append(card);
            }
            scroll.append(grid);
            scroll.append(el("p", "ac-fine", "The payment rail is not connected yet, so packs are granted during the beta."));
            box.append(scroll);
            if (!BETA_FEATURES)
                box.append(tabbar("shop"));
            return box;
        }
        scroll.append(grid);
        if (packOpen)
            box.append(drawPackSheet(packOpen));
        if (revealPack)
            box.append(drawReveal(revealPack));
        if (dailyToast)
            box.append(drawDailyToast(dailyToast));
        // This used to read "premium is unlocked for everyone during the beta",
        // which stopped being true the moment the beta started BUYING packs
        // instead of being handed them.
        scroll.append(el("p", "ac-fine", IS_BETA
            ? "Beta pilots start with enough Star Dust for every pack \u2014 buy them here to test the shop."
            : "Premium items arrive with the full release."));
        box.append(scroll);
        if (!BETA_FEATURES)
            box.append(tabbar("shop"));
        return box;
    }
    /** WHAT YOU JUST GOT. A purchase that closes a sheet and drops you back
     *  on a list never shows you what you bought. Every item arrives as its
     *  own card in a swipeable strip; tapping one offers to put it on there
     *  and then, so the first thing after buying can be wearing it. */
    function drawReveal(id) {
        const s = engine.save;
        const bn = BUNDLES.find((b) => b.id === id);
        if (!bn)
            return el("div", "");
        const close = () => { revealPack = null; revealPick = null; render(); };
        const got = [];
        for (const it of bn.items) {
            const src = it.kind === "suit" ? SUITS : it.kind === "helm" ? HELMETS
                : it.kind === "trail" ? TRAILS : PALS;
            const found = src.find((x) => x.id === it.id);
            if (found)
                got.push({ id: it.id, name: found.name, kind: it.kind });
        }
        const wrap = el("div", "ac-lvlsheet");
        const sheet = el("div", "ac-lvlcard ac-revealcard");
        sheet.append(el("p", "ac-kicker", "ADDED TO YOUR LOADOUT"));
        sheet.append(el("h2", "ac-lvlname", bn.name));
        sheet.append(el("p", "ac-sub", `${got.length} items are yours. Swipe to look through them.`));
        const strip = el("div", "ac-revealstrip");
        // Tapping a card re-renders, and a newly built element starts at scroll
        // 0 - so picking the eighth item threw the strip back to the first. Put
        // it back where the pilot left it, and remember every move they make.
        strip.addEventListener("scroll", () => { revealScroll = strip.scrollLeft; }, { passive: true });
        requestAnimationFrame(() => { strip.scrollLeft = revealScroll; });
        for (const g of got) {
            const key = `${g.kind}:${g.id}`;
            const card = el("button", revealPick === key ? "ac-card ac-revealitem on" : "ac-card ac-revealitem");
            if (g.kind === "suit") {
                const u = SUITS.find((x) => x.id === g.id);
                card.append(suitCardOf(u, 66));
                markPremium(card, u.glow);
            }
            else if (g.kind === "helm") {
                const h = HELMETS.find((x) => x.id === g.id);
                card.append(helmCardOf(h, 66));
                markPremium(card, h.glow);
            }
            else if (g.kind === "trail") {
                const t = TRAILS.find((x) => x.id === g.id);
                const { c, ctx } = miniCanvas(66, 66);
                if (ctx)
                    paintTrailPreview(ctx, t, 33, 33, performance.now() / 1000);
                card.append(c);
                markPremium(card, t.colors[0]);
            }
            else {
                const { c, ctx } = miniCanvas(66, 66);
                if (ctx)
                    paintPalPreview(ctx, engine.art, g.id, 33, 33, 60);
                card.append(c);
                markPremium(card);
            }
            const KIND_LABEL = { suit: "SUIT", helm: "HELMET", trail: "TRAIL", pal: "PAL" };
            card.append(document.createTextNode(`${g.name}\n${KIND_LABEL[g.kind]}`));
            card.onclick = () => { revealPick = revealPick === key ? null : key; render(); };
            strip.append(card);
        }
        sheet.append(strip);
        // the tapped card's offer, named so it is never ambiguous which one
        if (revealPick) {
            const [kind, itemId] = revealPick.split(":");
            const g = got.find((x) => `${x.kind}:${x.id}` === revealPick);
            const worn = kind === "suit" ? s.equippedSuit === itemId
                : kind === "helm" ? s.equipped === itemId
                    : kind === "trail" ? s.equippedTrail === itemId
                        : s.equippedPal === itemId;
            const act = el("button", worn ? "ac-primary ac-revealequip off" : "ac-primary ac-revealequip");
            if (worn) {
                act.textContent = `${g?.name ?? ""} EQUIPPED`;
                act.disabled = true;
            }
            else {
                act.textContent = `EQUIP ${g?.name ?? ""}`;
                act.onclick = () => {
                    tx(act, () => kind === "suit" ? engine.buySuit(itemId)
                        : kind === "helm" ? engine.buyHelmet(itemId)
                            : kind === "trail" ? engine.buyTrail(itemId)
                                : engine.equipPal(itemId));
                    render();
                };
            }
            sheet.append(act);
        }
        else {
            sheet.append(el("p", "ac-fine ac-revealhint", "Tap a card to put it on."));
        }
        const toLoadout = el("button", "ac-primary ac-revealgo", "GO TO LOADOUT");
        toLoadout.onclick = () => { revealPack = null; revealPick = null; engine.open("hangar"); };
        const back = el("button", "ac-ghost", "CLOSE");
        back.onclick = close;
        sheet.append(toLoadout, back);
        wrap.append(sheet);
        wrap.onclick = (e) => { if (e.target === wrap)
            close(); };
        return wrap;
    }
    /** WHAT IS ACTUALLY IN THE PACK. A half-height sheet listing every item
     *  by kind, with the buy sitting under the list rather than under a strip
     *  of four faces and a number. Nobody should have to guess what 20 items
     *  means before spending 1,200 on it. */
    function drawPackSheet(id) {
        const s = engine.save;
        const bn = BUNDLES.find((b) => b.id === id);
        if (!bn)
            return el("div", "");
        const close = () => { packOpen = null; confirmBuy = false; render(); };
        const wrap = el("div", "ac-lvlsheet");
        const sheet = el("div", "ac-lvlcard ac-packcard");
        sheet.append(el("p", "ac-kicker", "PACK"));
        sheet.append(el("h2", "ac-lvlname", bn.name));
        sheet.append(el("p", "ac-sub", bn.blurb));
        // Grouped by kind, because "10 items" tells you nothing about whether
        // the thing you wanted is in there. Each slot now SAYS what it is, so
        // this is a filter rather than four lookups per id hoping exactly one
        // hits - which is what used to report a pack of ten as sixteen.
        const pick = (kind, src) => bn.items.filter((i) => i.kind === kind)
            .map((i) => src.find((x) => x.id === i.id)).filter(Boolean);
        const groups = [
            ["SUITS", pick("suit", SUITS)],
            ["HELMETS", pick("helm", HELMETS)],
            ["TRAILS", pick("trail", TRAILS)],
            ["PALS", pick("pal", PALS)],
        ];
        const listWrap = el("div", "ac-packlist");
        let total = 0;
        for (const [title, items] of groups) {
            if (!items.length)
                continue;
            total += items.length;
            listWrap.append(el("p", "ac-packhead", `${title} \u00b7 ${items.length}`));
            const row = el("div", "ac-packrow");
            for (const it of items) {
                const chip = el("span", "ac-packchip");
                const suit = SUITS.find((u) => u.id === it.id);
                const helm = title === "HELMETS" ? HELMETS.find((h) => h.id === it.id) : null;
                const pal = title === "PALS" ? PALS.find((x) => x.id === it.id) : null;
                if (helm)
                    chip.append(helmCardOf(helm, 34));
                else if (title === "SUITS" && suit)
                    chip.append(suitCardOf(suit, 34));
                else if (pal) {
                    const { c, ctx } = miniCanvas(34, 34);
                    if (ctx)
                        paintPalPreview(ctx, engine.art, pal.id, 17, 17, 30);
                    chip.append(c);
                }
                else {
                    const t = TRAILS.find((x) => x.id === it.id);
                    const { c, ctx } = miniCanvas(34, 34);
                    if (ctx && t)
                        paintTrailPreview(ctx, t, 17, 17, performance.now() / 1000);
                    chip.append(c);
                }
                chip.append(el("span", "", it.name));
                if (iapOwned(s, it.id))
                    chip.classList.add("owned");
                row.append(chip);
            }
            listWrap.append(row);
        }
        sheet.append(listWrap);
        sheet.append(el("p", "ac-fine", `${total} items in this pack.`));
        const owned = bundleIds(bn).every((i) => iapOwned(s, i));
        // what THIS pilot owes: the packs overlap, so anything already in the
        // loadout has come off the price and the button must say so
        const due = bundlePrice(bn, (i) => iapOwned(s, i));
        const already = bn.items.filter((i) => iapOwned(s, i.id)).length;
        if (already && !owned) {
            sheet.append(el("p", "ac-fine ac-packcredit", `${already} of these are already yours \u2014 ${(bn.dust - due).toLocaleString()} Star Dust off.`));
        }
        const buy = el("button", "ac-primary ac-packbuy");
        if (owned) {
            buy.textContent = "OWNED";
            buy.disabled = true;
        }
        else {
            // ONE TAP USED TO SPEND IT. Star Dust is earned and hoarded, so a
            // mis-tap costing 1,200 of it is not something a pilot can undo. The
            // first tap now asks and the second commits. The Star Dust PACKS are
            // deliberately left alone: those cost real money and the platform's
            // own payment sheet is the confirmation, so asking twice would be one
            // dialog too many.
            if (confirmBuy) {
                buy.classList.add("ac-confirming");
                buy.append(el("span", "", "CONFIRM \u00b7 SPEND "), icon(I_DUST, 14, true), el("span", "", due.toLocaleString()));
            }
            else {
                buy.append(el("span", "", "BUY \u00b7 "), icon(I_DUST, 14, true), el("span", "", due.toLocaleString()));
            }
            buy.onclick = () => {
                if (!confirmBuy) {
                    confirmBuy = true;
                    render();
                    return;
                }
                if (tx(buy, () => engine.buyBundle(bn.id), bn.dust, "dust")) {
                    // straight into the reveal: a purchase that just closes a sheet
                    // and returns you to a list never shows you what you bought
                    packOpen = null;
                    revealPack = bn.id;
                    revealPick = null;
                    render();
                }
            };
        }
        const back = el("button", "ac-ghost", confirmBuy ? "NOT YET" : "BACK");
        back.onclick = confirmBuy ? () => { confirmBuy = false; render(); } : close;
        sheet.append(buy, back);
        if (confirmBuy)
            sheet.append(el("p", "ac-fine ac-mid", `This spends ${bn.dust.toLocaleString()} Star Dust. You have ${s.starDust.toLocaleString()}.`));
        wrap.append(sheet);
        wrap.onclick = (e) => { if (e.target === wrap)
            close(); };
        return wrap;
    }
    /** TRY IT ON. The packs page sells; this one shows what you would be
     *  wearing. Three side-scrolling shelves - suits, helmets, pals - holding
     *  only premium content, because everything else is already in the
     *  Loadout and a shop that re-lists the wardrobe is the mistake Wave 0
     *  just deleted.
     *
     *  The stage above them is the game's own renderer, not a portrait: it
     *  runs a real tap-rise-fall cycle so a suit with its own jump shows it.
     *  Robo's articulated tap and Eclipse's impact squash are the whole
     *  reason a still image was not good enough. */
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
    function drawTryOn() {
        const s = engine.save;
        const wrap = el("div", "ac-tryon");
        const suits = SUITS.filter((u) => isIap(u.id));
        const helms = HELMETS.filter((h) => isIap(h.id));
        const pals = PALS.filter((pl) => isIap(pl.id));
        // first run: wear the first of each rather than an empty stage
        if (!tryOn.suit)
            tryOn = { suit: suits[0]?.id ?? "", helm: helms[0]?.id ?? "", pal: pals[0]?.id ?? "" };
        const suit = SUITS.find((u) => u.id === tryOn.suit) ?? suits[0] ?? SUITS[0];
        // a fixed-head suit wears no helmet, so the stage must not paint one
        const ownHead = wearsOwnHead(suit);
        const helm = ownHead
            ? HELMETS[0]
            : (HELMETS.find((h) => h.id === tryOn.helm) ?? helms[0] ?? HELMETS[0]);
        // ---- the stage
        const stage = el("div", "ac-tostage");
        const { c, ctx } = miniCanvas(300, 190);
        c.className = "ac-tocanvas";
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", `${suit.name} preview, flying`);
        stage.append(c);
        const cap = el("div", "ac-tocap");
        cap.append(el("b", "", suit.name + (ownHead ? "" : ` \u00b7 ${helm.name}`)));
        const palDef = PALS.find((x) => x.id === tryOn.pal);
        if (palDef)
            cap.append(el("span", "", `${palDef.name} \u00b7 ${palDef.tag}`));
        stage.append(cap);
        if (ownHead)
            stage.append(el("span", "ac-tonohelm", OWN_HEAD_TAG));
        wrap.append(stage);
        // The stage animates, and nothing else in these menus does, so it owns
        // a frame loop. It stops itself the moment the canvas leaves the
        // document - every re-render replaces it - rather than relying on some
        // other screen to remember to cancel it.
        if (ctx) {
            // The stage shows a suit the pilot has NOT equipped, so nothing has
            // asked for its flight bank: without this it animates only once the
            // background sweep happens to reach it, which for a suit late in the
            // roster is a long wait staring at a rigid sprite.
            engine.wantSuitArt(suit.id);
            if (palDef)
                engine.wantPalArt(palDef.id);
            const t0 = performance.now();
            const tick = () => {
                if (!c.isConnected)
                    return;
                const t = (performance.now() - t0) / 1000;
                ctx.clearRect(0, 0, 300, 190);
                if (palDef)
                    paintPalPreview(ctx, engine.art, palDef.id, 232, 62, 44);
                paintFlightPreview(ctx, engine.art, suit, helm, 132, 104, 108, t);
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }
        // ---- the three shelves, in whichever layout the pilot chose
        wrap.append(shelfToggle());
        if (engine.save.shelfGrid)
            wrap.classList.add("ac-asgrid");
        const shelf = (title, kind, items) => {
            if (!items.length)
                return;
            wrap.append(el("p", "ac-shelfhead", title));
            const row = el("div", "ac-shelfrow");
            for (const it of items) {
                const on = tryOn[kind] === it.id;
                const b = el("button", on ? "ac-card ac-tocard on" : "ac-card ac-tocard");
                if (kind === "suit") {
                    const u = SUITS.find((x) => x.id === it.id);
                    b.append(suitCardOf(u, 56));
                    markPremium(b, u.glow);
                }
                else if (kind === "helm") {
                    const h = HELMETS.find((x) => x.id === it.id);
                    b.append(helmCardOf(h, 56));
                    markPremium(b, h.glow);
                }
                else {
                    const { c: pc, ctx: pctx } = miniCanvas(56, 56);
                    if (pctx)
                        paintPalPreview(pctx, engine.art, it.id, 28, 28, 50);
                    b.append(pc);
                    markPremium(b);
                }
                b.append(document.createTextNode(`${it.name}\n${iapOwned(s, it.id) ? "OWNED" : "IN A PACK"}`));
                b.onclick = () => { tryOn = { ...tryOn, [kind]: it.id }; render(); };
                row.append(b);
            }
            wrap.append(row);
        };
        shelf("SUITS", "suit", suits);
        // hiding the helmet shelf under a fixed-head suit would make the row
        // jump; dimming it says WHY it cannot be used instead
        const helmRow = helms;
        shelf("HELMETS", "helm", helmRow);
        shelf("PALS", "pal", pals);
        if (ownHead)
            wrap.append(el("p", "ac-fine", `${suit.name} has a custom helmet, so changing helmets does nothing on it.`));
        wrap.append(el("p", "ac-fine", "Everything here arrives in a pack. Open PACKS to see which one."));
        return wrap;
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
        const big = el("div", "ac-dailybig");
        big.append(icon(I_DUST, 34, true), el("b", "", `+${t.amount}`));
        sheet.append(big);
        sheet.append(el("h2", "ac-lvlname", "Star Dust collected"));
        sheet.append(el("p", "ac-sub", t.bonus
            ? `Day ${DAILY_STREAK_LEN} paid ${DAILY_DUST} plus the ${DAILY_STREAK_BONUS} streak bonus. Come back tomorrow and the streak starts again.`
            : `Day ${t.streak} of ${DAILY_STREAK_LEN}. Come back tomorrow to keep the streak \u2014 day ${DAILY_STREAK_LEN} pays ${DAILY_STREAK_BONUS} more.`));
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
        left.append(el("p", "ac-sub", st.bonusDay
            ? `Day ${DAILY_STREAK_LEN} \u2014 ${DAILY_DUST} plus the ${DAILY_STREAK_BONUS} streak bonus. Back tomorrow to start again.`
            : `Day ${st.streak} of ${DAILY_STREAK_LEN}. Come back tomorrow \u2014 day ${DAILY_STREAK_LEN} pays ${DAILY_STREAK_BONUS} more.`));
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
        scroll.append(news, el("p", "ac-fine ac-mid", `${BUILD} · ${GAME_VERSION}`));
        box.append(scroll);
        if (!BETA_FEATURES)
            box.append(tabbar("profile"));
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
            { id: "spill", name: "The Spill", best: s.spillBest || 0, unit: "waves" },
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
        // same gate every other screen uses: with BETA_FEATURES on, the dock
        // lives on the title screen alone and these sheets are left by their
        // own back control. Appending it here regardless would give the board a
        // navigation bar nothing else in the app has.
        if (!BETA_FEATURES)
            box.append(tabbar("scores"));
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
        item(pic(spr("acorn")), "ACORN", "Earned by flying \u2014 spend it in the hangar.");
        // TWO currencies, and the difference is the whole point: one is flown
        // for, one is bought. Saying so here is cheaper than letting a pilot
        // work it out from a price they cannot pay.
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
        }), "STAR DUST", "Premium currency \u2014 buys packs. Claim 5 free every day, plus 25 on a seven-day streak.");
        item(pic(one("frozen")), "FREEZE ACORN", `Slows everything for ${PHYS.powerDuration} seconds.`);
        item(pic(one("shieldnut")), "SHIELD ACORN", "Absorbs one debris hit. Rare \u2014 grab it.");
        item(pic(spr("golden")), "GOLDEN ACORN", "Invulnerable to debris \u2014 planets still bounce. In Wormhole Run it is the FLOW ACORN: fills Flow and guarantees at least \u00d72 score for 8 seconds.");
        item(pic((ctx, px) => {
            const g = ctx.createRadialGradient(px / 2, px / 2, 1, px / 2, px / 2, px / 2);
            g.addColorStop(0, "#120424");
            g.addColorStop(0.6, "#6a3fb8");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px / 2, px / 2, px * 0.46, 0, Math.PI * 2);
            ctx.fill();
        }), "BLACK HOLE", "Warps flight for 15s \u2014 reversed or tilted.");
        item(pic((ctx, px) => {
            const g = ctx.createRadialGradient(px / 2, px / 2, 1, px / 2, px / 2, px / 2);
            g.addColorStop(0, "#042a24");
            g.addColorStop(0.6, "#6ef0d8");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px / 2, px / 2, px * 0.46, 0, Math.PI * 2);
            ctx.fill();
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
            const rig = el("button", "ac-ghost ac-lab", "RIG EDITOR");
            rig.onclick = () => { window.location.href = labRoot + "rig/"; };
            const ship = el("button", "ac-ghost ac-lab", "SHIP BENCH");
            ship.onclick = () => { window.location.href = labRoot + "ship/"; };
            const worm = el("button", "ac-ghost ac-lab", "WORMHOLE RUN");
            worm.onclick = () => engine.fly("tunnel");
            scroll.append(rig, ship, worm, el("p", "ac-fine ac-labnote", "Prototypes \u00b7 not part of the game"));
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
        if (!BETA_FEATURES)
            box.append(tabbar("none"));
        return box;
    }
    engine.subscribe(render);
    render();
    window.addEventListener("resize", () => engine.resize());
}
