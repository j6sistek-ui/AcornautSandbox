import { xpCumulative, BUILD, ENVS, GAME_VERSION, HELMETS, NEWS, PALS, PHYS, SUITS, TRACK, TRAILS, isIap } from "./catalog.js?v=50";
import { paintPortrait, paintPalPreview } from "./draw.js?v=50";
import { artUrl, drawSprite as drawSpriteOn } from "./art.js?v=50";
import { createEngine } from "./engine.js?v=50";
import { palUnlocked, pilotLevelOf, pilotTitleOf, suitRevealed, iapOwned } from "./save.js?v=50";
function el(tag, cls = "", text) {
    const n = document.createElement(tag);
    if (cls)
        n.className = cls;
    if (text)
        n.textContent = text;
    return n;
}
export async function bootStandalone(root) {
    root.innerHTML = "";
    root.className = "ac-root";
    const stage = el("div", "ac-stage");
    const canvas = document.createElement("canvas");
    canvas.className = "ac-canvas";
    const overlay = el("div", "ac-overlay");
    stage.append(canvas, overlay);
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
    window.__sandbox = engine;
    engine.start();
    // The title picks ONE mode at a time: TAKE FLIGHT launches it, the
    // MODE bar cycles through the four. Selection lives here so it survives
    // a re-render of the title.
    const MODES = [
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
        if (prevScroll)
            keptScroll = prevScroll.scrollTop;
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
            if (snap.dead.best && snap.dead.score > 0)
                sheet.append(el("p", "ac-gold", "NEW BEST"));
            sheet.append(el("p", "ac-sub", `+${snap.dead.xp} XP · LV ${snap.dead.toLv}`));
            if (snap.dead.toLv > snap.dead.fromLv)
                sheet.append(el("p", "ac-gold", `LEVEL UP — LV ${snap.dead.toLv}!`));
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
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    fill.style.width = `${(toPct * 100).toFixed(1)}%`;
                }));
            }
            const go = el("button", "ac-primary", "CONTINUE");
            go.onclick = () => engine.dismissDead();
            sheet.append(go);
            overlay.append(sheet);
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
            if (sc && keptScroll)
                sc.scrollTop = keptScroll;
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
    const I_PILOT = ["M12 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z", "M5.5 19.5a6.5 6.5 0 0 1 13 0"];
    const I_HELP = [
        "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z",
        "M9.7 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 1.9-2.3 3.3",
        "M12 16.8h.01",
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
    function header(kicker, title, aside) {
        const h = el("header", "ac-menuhead");
        const t = el("div", "ac-menuheadtext");
        t.append(el("p", "ac-kicker", kicker), el("h2", "ac-menutitle", title));
        h.append(t);
        if (aside)
            h.append(aside);
        return h;
    }
    function acornPill(n) {
        const pill = el("div", "ac-pill ac-pill-gold");
        pill.append(icon(I_NUT, 13), el("span", "", n.toLocaleString()));
        return pill;
    }
    // Five tabs on one bar. HOME is the raised dome in the middle: the
    // biggest target, and glass on every screen because it IS home —
    // the white is its identity, not the current screen's colour.
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
        bar.append(side("hangar", I_HELMET, "HANGAR"), side("log", I_ROAD, "LOG"), dome, side("profile", I_PILOT, "PROFILE"), side("help", I_HELP, "HELP"));
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
        box.style.backgroundImage = `url("${artRootUrl()}/menu-splash.jpg")`;
        box.append(el("div", "ac-splash-ink"));
        const stack = el("div", "ac-splash-stack");
        stack.append(el("h1", "ac-splash-title", "ACORNAUT"));
        const tap = el("p", "ac-splash-tap");
        tap.append(icon(I_ACORN, 15, true), el("span", "", "TAP TO START"));
        stack.append(tap);
        box.append(stack);
        box.append(el("p", "ac-fine ac-splash-fine", `${BUILD} · ${GAME_VERSION}`));
        box.onclick = () => engine.open("title");
        return box;
    }
    function drawHome() {
        const s = engine.save;
        const box = el("div", "ac-home");
        // The key art carries the top three quarters and fades out under the
        // controls, so nothing sits on a hard edge.
        const art = el("div", "ac-home-art");
        art.style.backgroundImage = `url("${artRootUrl()}/menu-home.jpg")`;
        box.append(art, el("div", "ac-home-scrim"));
        // Acorns left, level right. Flat pills, not painted plates — the
        // launch screen is the art's, and these only have to be readable.
        const pills = el("div", "ac-home-pills");
        const lv = pilotLevelOf(s);
        const lvPill = el("div", "ac-pill");
        lvPill.append(el("span", "ac-pill-key", "LV"), el("span", "ac-pill-num", `${lv}`));
        pills.append(acornPill(s.acorns), lvPill);
        box.append(pills);
        const title = el("div", "ac-home-titlewrap");
        title.append(el("h1", "ac-home-title", "ACORNAUT"));
        title.append(el("p", "ac-home-kicker", "Fly the gaps \u00b7 Grab the acorns"));
        box.append(title, el("div", "ac-home-gap"));
        const controls = el("div", "ac-controls");
        // The loadout strip is the second door into the Hangar, so the tab
        // icon is never the only way in.
        const helm = HELMETS.find((h) => h.id === s.equipped) ?? HELMETS[0];
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
        // All four modes visible at once — no cycling to reach Arcade.
        const modes = el("div", "ac-modes");
        MODES.forEach((m, i) => {
            const b = el("button", i === selectedMode ? "ac-mode on" : "ac-mode", m.short);
            b.onclick = () => {
                selectedMode = i;
                render();
            };
            modes.append(b);
        });
        controls.append(modes);
        box.append(controls, tabbar("title"));
        return box;
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
    function shopImg(src, alt) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = alt;
        img.draggable = false;
        img.width = 64;
        img.height = 64;
        return img;
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
    function portraitOf(helmet, suit, px = 56) {
        const { c, ctx } = miniCanvas(px, px);
        if (ctx && engine.art)
            paintPortrait(ctx, engine.art, helmet, suit, px / 2, px / 2, px * 0.88);
        return c;
    }
    function drawHangar() {
        const s = engine.save;
        const helm = HELMETS.find((h) => h.id === s.equipped) ?? HELMETS[0];
        const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
        const trail = TRAILS.find((t) => t.id === s.equippedTrail) ?? TRAILS[0];
        const pal = PALS.find((p) => p.id === s.equippedPal);
        const box = el("div", "ac-menu");
        box.append(header("Customize your squirrel", "Hangar", acornPill(s.acorns)));
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
        if (s.startShield)
            tags.append(el("span", "ac-tagpill ac-tagblue", "+1 SHIELD"));
        loadTxt.append(tags);
        load.append(loadTxt);
        if (pal && pal.id !== "none") {
            const { c, ctx } = miniCanvas(40, 40);
            if (ctx)
                paintPalPreview(ctx, engine.art, pal.id, 20, 20, 36);
            load.append(c);
        }
        box.append(load);
        const tabs = el("div", "ac-cats");
        for (const t of ["suits", "helmets", "trails", "pals", "mods"]) {
            const b = el("button", t === engine.shopTab ? "ac-cat on" : "ac-cat", t.toUpperCase());
            b.onclick = () => engine.setShopTab(t);
            tabs.append(b);
        }
        box.append(tabs);
        const scroll = el("div", "ac-sheet-scroll");
        const grid = el("div", "ac-grid");
        if (engine.shopTab === "helmets") {
            for (const h of HELMETS) {
                const premium = isIap(h.id);
                const owned = premium ? iapOwned(s, h.id) : s.unlocked.includes(h.id);
                const b = el("button", s.equipped === h.id ? "ac-card on" : "ac-card");
                b.append(helmCardOf(h, 64), document.createTextNode(`${h.name}\n${owned ? "OWNED" : premium ? "PREMIUM" : h.cost}`));
                if (premium)
                    b.classList.add("ac-premium");
                b.onclick = () => { if (!premium || owned)
                    engine.buyHelmet(h.id); };
                grid.append(b);
            }
        }
        else if (engine.shopTab === "suits") {
            for (const u of SUITS) {
                const premium = isIap(u.id);
                const open = suitRevealed(s, u.id);
                const owned = premium ? iapOwned(s, u.id) : s.unlockedSuits.includes(u.id);
                const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
                b.append(shopImg(artUrl(`suits/${u.id}.png`), u.name), document.createTextNode(`${u.name}\n${premium ? (owned ? "OWNED" : "PREMIUM") : !open ? "LOCKED" : owned ? "OWNED" : u.cost}`));
                if (premium)
                    b.classList.add("ac-premium");
                b.onclick = () => { if (!premium || owned)
                    engine.buySuit(u.id); };
                grid.append(b);
            }
        }
        else if (engine.shopTab === "trails") {
            for (const t of TRAILS) {
                const owned = s.unlockedTrails.includes(t.id);
                const b = el("button", s.equippedTrail === t.id ? "ac-card on" : "ac-card");
                b.append(shopImg(artUrl(`trails/${t.id}.png`), t.name), document.createTextNode(`${t.name}\n${owned ? "OWNED" : t.cost}`));
                b.onclick = () => engine.buyTrail(t.id);
                grid.append(b);
            }
        }
        else if (engine.shopTab === "pals") {
            for (const p of PALS) {
                const open = palUnlocked(s, p.id);
                const b = el("button", s.equippedPal === p.id ? "ac-card on" : "ac-card");
                const { c, ctx } = miniCanvas(64, 56);
                if (ctx)
                    paintPalPreview(ctx, engine.art, p.id, 32, 28, 48);
                b.append(c);
                b.append(document.createTextNode(`${p.name}\n${open ? p.tag : "LOCKED"}`));
                b.onclick = () => engine.equipPal(p.id);
                grid.append(b);
            }
        }
        else {
            const sh = el("button", "ac-ghost", s.startShield ? "Start Shield ARMED" : "Arm Start Shield");
            sh.onclick = () => engine.toggleMod("shield");
            const bat = el("button", "ac-ghost", s.battery ? "Battery OWNED" : "Buy Shield Battery");
            bat.onclick = () => engine.toggleMod("battery");
            scroll.append(sh, bat);
        }
        if (engine.shopTab !== "mods")
            scroll.append(grid);
        box.append(scroll, tabbar("hangar"));
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
    function rewardArt(item, px = 52) {
        const { c, ctx } = miniCanvas(px, px);
        const art = engine.art;
        if (!ctx || !art)
            return c;
        if (item.kind === "pal" && item.id) {
            paintPalPreview(ctx, art, item.id, px / 2, px / 2, px * 0.86);
        }
        else if (item.kind === "suit" && item.id) {
            drawSpriteOn(ctx, art.suits?.[item.id] ?? null, px / 2, px / 2, px * 0.92);
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
        return c;
    }
    function drawLog() {
        const box = el("div", "ac-menu");
        box.append(header("The road ahead", "Flight Log"));
        const sv = engine.save;
        const lv = pilotLevelOf(sv);
        // rank, and how far the next rung is
        const meter = el("div", "ac-rankmeter");
        const row = el("div", "ac-rankrow");
        row.append(el("span", "ac-rankname", `LV ${lv} · ${pilotTitleOf(sv)}`));
        const lo = xpCumulative(lv);
        const hi = xpCumulative(lv + 1);
        row.append(el("span", "ac-sub", `${sv.xp - lo} / ${Math.max(1, hi - lo)} XP`));
        meter.append(row);
        const bar = el("div", "ac-xpbar");
        const fill = el("div", "");
        fill.style.width = `${(Math.max(0, Math.min(1, (sv.xp - lo) / Math.max(1, hi - lo))) * 100).toFixed(1)}%`;
        bar.append(fill);
        meter.append(bar);
        box.append(meter);
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
            }
            else if (!nextMarked) {
                nextMarked = true;
                row.className = "ac-roaditem next";
                const toGo = Math.max(0, xpCumulative(item.lvl) - sv.xp);
                row.append(el("span", "ac-togo", `${toGo} XP TO GO`));
            }
            road.append(row);
        }
        scroll.append(road);
        box.append(scroll, tabbar("log"));
        // land the view on the next reward
        requestAnimationFrame(() => {
            const nxt = road.querySelector(".next");
            if (nxt)
                nxt.scrollIntoView({ block: "center" });
        });
        return box;
    }
    // Profile carries everything the Flight Log is no longer about: the
    // lifetime tallies, the per-mode bests, and the flight deck settings.
    function drawProfile() {
        const s = engine.save;
        const box = el("div", "ac-menu");
        box.append(header("Pilot", "Profile"));
        const scroll = el("div", "ac-sheet-scroll");
        const helm = HELMETS.find((h) => h.id === s.equipped) ?? HELMETS[0];
        const suit = SUITS.find((u) => u.id === s.equippedSuit) ?? SUITS[0];
        const id = el("div", "ac-idcard");
        const face = el("div", "ac-idface");
        face.append(portraitOf(helm, suit, 58));
        id.append(face);
        const idTxt = el("div", "ac-idtxt");
        idTxt.append(el("p", "ac-idname", "Nutcracker"));
        idTxt.append(el("p", "ac-sub", `LV ${pilotLevelOf(s)} ${pilotTitleOf(s)}`));
        const tags = el("div", "ac-rigtags");
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
        const bests = el("div", "ac-rows");
        for (const [label, v] of [
            ["Best · Normal", s.highScore],
            ["Best · Deep Space", s.deepBest],
            ["Best · Lost in Space", s.lostBest],
            ["Best · Arcade", s.arcadeBest],
        ]) {
            const r = el("div", "ac-row");
            r.append(el("span", "", label), el("span", "ac-rowgold", `${v ?? 0}`));
            bests.append(r);
        }
        scroll.append(bests);
        scroll.append(el("p", "ac-kicker ac-secthead", "Flight deck"));
        const deck = el("div", "ac-rows");
        const toggle = (label, on, hit) => {
            const r = el("button", "ac-row ac-rowbtn");
            r.append(el("span", "", label));
            const sw = el("span", on ? "ac-switch on" : "ac-switch");
            sw.append(el("span", "ac-knob"));
            r.append(sw);
            r.onclick = () => {
                hit();
                render();
            };
            deck.append(r);
        };
        toggle("Arm a start shield", !!s.startShield, () => engine.toggleMod("shield"));
        toggle("Shield battery", !!s.battery, () => engine.toggleMod("battery"));
        scroll.append(deck);
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
        item(pic(spr("acorn")), "ACORN", "Currency \u2014 spend it in the hangar.");
        item(pic(one("frozen")), "FREEZE ACORN", `Slows everything for ${PHYS.powerDuration} seconds.`);
        item(pic(one("shieldnut")), "SHIELD ACORN", "Absorbs one debris hit. Rare \u2014 grab it.");
        item(pic(spr("golden")), "GOLDEN ACORN", "Invulnerable to debris \u2014 planets still bounce.");
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
        scroll.append(el("p", "ac-sub ac-mid", "DEEP SPACE: space shifts every 10s."));
        scroll.append(el("p", "ac-sub ac-mid", "ARCADE: the original game, in its own hand. Double power-ups, wormhole reversals, and its own soundtrack."));
        scroll.append(el("p", "ac-sub ac-mid", "FREE FLIGHT: catch the 8-bit acorn to slip into the arcade for a stretch — catch another to come home."));
        scroll.append(el("p", "ac-sub ac-mid", "LOST IN SPACE: drift, tilt, wormholes."));
        scroll.append(el("p", "ac-gold ac-mid", "BRING A PAL: each adds a fun modifier."));
        box.append(scroll);
        const replay = el("button", "ac-ghost ac-replay", "REPLAY TUTORIAL");
        replay.onclick = () => engine.replayTutorial();
        scroll.append(replay);
        box.append(tabbar("help"));
        return box;
    }
    engine.subscribe(render);
    render();
    window.addEventListener("resize", () => engine.resize());
}
