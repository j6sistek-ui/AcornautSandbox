import { xpCumulative, BUILD, GAME_VERSION, HELMETS, NEWS, PALS, SUITS, TRACK, TRAILS } from "./catalog.js?v=28";
import { paintPortrait, paintTrailPreview, paintPalPreview } from "./draw.js?v=28";
import { artUrl, drawSprite as drawSpriteOn } from "./art.js?v=28";
import { createEngine } from "./engine.js?v=28";
import { palUnlocked, pilotLevelOf, pilotTitleOf, suitRevealed } from "./save.js?v=28";
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
    const engine = await createEngine(canvas);
    // sandbox is a test bed: expose the engine so runs can be driven and
    // certified from a harness (env sweeps, cosmetic matrices, replays)
    window.__sandbox = engine;
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
    function header(title) {
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
        // the live game's bottom bar: four round icons pinned to the bottom
        const ICONS = {
            hangar: '<svg viewBox="0 0 24 24"><path d="M20.5 7.5a4.9 4.9 0 0 1-6.4 4.6L7 19.2a2 2 0 0 1-2.8-2.8l7.1-7.1a4.9 4.9 0 0 1 6-6.1L14.6 6l3.2 3.2 2.5-2.6z"/></svg>',
            log: '<svg viewBox="0 0 24 24"><path d="M6 3v18M6 4h11l-2.5 3.5L17 11H6"/></svg>',
            social: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>',
            help: '<svg viewBox="0 0 24 24"><path d="M8.8 9.2a3.2 3.2 0 1 1 4.9 2.7c-1 .7-1.7 1.2-1.7 2.6"/><circle cx="12" cy="18" r=".6"/></svg>',
        };
        const nav = el("nav", "ac-dock2");
        for (const [label, screen] of [
            ["Hangar", "hangar"],
            ["Log", "log"],
            ["Social", "social"],
            ["Help", "help"],
        ]) {
            const b = el("button", "ac-dockicon");
            const ring = el("span", "ac-ring");
            ring.innerHTML = ICONS[screen];
            b.append(ring, document.createTextNode(label));
            b.onclick = () => engine.open(screen);
            nav.append(b);
        }
        box.append(fly, deep, lost, nav, el("p", "ac-fine", `${BUILD} · ${GAME_VERSION}`));
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
            if (ctx)
                paintPalPreview(ctx, engine.art, pal.id, 20, 20, 36);
            load.append(c);
        }
        box.append(load);
        box.append(el("p", "ac-sub", `${s.acorns} acorns · LV ${pilotLevelOf(s)} ${pilotTitleOf(s)}`));
        const tabs = el("div", "ac-tabs");
        for (const t of ["helmets", "suits", "trails", "pals", "mods"]) {
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
        }
        else if (engine.shopTab === "suits") {
            for (const u of SUITS) {
                const open = suitRevealed(s, u.id);
                const owned = s.unlockedSuits.includes(u.id);
                const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
                b.append(shopImg(artUrl(`suits/${u.id}.png`), u.name), document.createTextNode(`${u.name}\n${!open ? "LOCKED" : owned ? "OWNED" : u.cost}`));
                b.onclick = () => engine.buySuit(u.id);
                grid.append(b);
            }
        }
        else if (engine.shopTab === "trails") {
            for (const t of TRAILS) {
                const owned = s.unlockedTrails.includes(t.id);
                const b = el("button", s.equippedTrail === t.id ? "ac-card on" : "ac-card");
                const { c, ctx } = miniCanvas(64, 36);
                if (ctx)
                    paintTrailPreview(ctx, t, 28, 18, 0.2);
                b.append(c, document.createTextNode(`${t.name}\n${owned ? "OWNED" : t.cost}`));
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
        box.append(scroll);
        return box;
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
            // rank medallion
            const g = ctx.createRadialGradient(px / 2, px / 2, 2, px / 2, px / 2, px / 2);
            g.addColorStop(0, "#ffd98a");
            g.addColorStop(1, "#c9861f");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px / 2, px / 2, px * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#8a5a10";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#5b3a08";
            ctx.font = `900 ${px * 0.34}px Fraunces, serif`;
            ctx.textAlign = "center";
            ctx.fillText((item.name ?? "?").slice(0, 1), px / 2, px / 2 + px * 0.12);
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
        box.append(scroll);
        // land the view on the next reward
        requestAnimationFrame(() => {
            const nxt = road.querySelector(".next");
            if (nxt)
                nxt.scrollIntoView({ block: "center" });
        });
        return box;
    }
    function drawSocial() {
        const s = engine.save;
        const box = el("div", "ac-sheet");
        box.append(header("Social"));
        box.append(el("h3", "", `LV ${pilotLevelOf(s)} ${pilotTitleOf(s)}`));
        box.append(el("p", "ac-sub", `BEST ${s.highScore} · DEEP ${s.deepBest} · LOST ${s.lostBest}`));
        box.append(el("h4", "", "NEWS"));
        for (const line of NEWS)
            box.append(el("p", "ac-sub", line));
        box.append(el("p", "ac-fine", GAME_VERSION));
        return box;
    }
    function drawHelp() {
        const box = el("div", "ac-sheet");
        box.append(header("Help"));
        box.append(el("p", "", "TAP — boost up. SWIPE DOWN — dive / cancel bounce."));
        box.append(el("p", "ac-sub", "Planets bounce. Debris kills. Shields eat one hit. Gold is invulnerable."));
        const replay = el("button", "ac-primary", "REPLAY TUTORIAL");
        replay.onclick = () => engine.replayTutorial();
        box.append(replay);
        return box;
    }
    engine.subscribe(render);
    render();
    window.addEventListener("resize", () => engine.resize());
}
