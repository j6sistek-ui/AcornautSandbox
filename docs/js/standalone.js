import { BUILD, GAME_VERSION, HELMETS, NEWS, PALS, SUITS, TRACK, TRAILS } from "./catalog.js";
import { paintPortrait, paintTrailPreview } from "./draw.js";
import { drawPalPreviewOn } from "./cosmetics.js";
import { createEngine } from "./engine.js";
import { palUnlocked, pilotLevelOf, pilotTitleOf, suitRevealed } from "./save.js";
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
        const nuts = el("div", "ac-chip", `${s.acorns}`);
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
        const nav = el("nav", "ac-dock");
        for (const [label, screen] of [
            ["Hangar", "hangar"],
            ["Log", "log"],
            ["Social", "social"],
            ["Help", "help"],
        ]) {
            const b = el("button", "ac-dockbtn", label);
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
    function portraitOf(helmet, suit, px = 56) {
        const { c, ctx } = miniCanvas(px, px);
        if (ctx && engine.art)
            paintPortrait(ctx, engine.art, helmet, suit, px / 2, px * 0.58, px * 0.78);
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
                drawPalPreviewOn(ctx, pal.id, 20, 22, 0.2);
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
                b.append(portraitOf(h, suit), document.createTextNode(`${h.name}\n${owned ? "OWNED" : h.cost}`));
                b.onclick = () => engine.buyHelmet(h.id);
                grid.append(b);
            }
        }
        else if (engine.shopTab === "suits") {
            for (const u of SUITS) {
                const open = suitRevealed(s, u.id);
                const owned = s.unlockedSuits.includes(u.id);
                const b = el("button", s.equippedSuit === u.id ? "ac-card on" : "ac-card");
                b.append(portraitOf(helm, u), document.createTextNode(`${u.name}\n${!open ? "LOCKED" : owned ? "OWNED" : u.cost}`));
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
                    drawPalPreviewOn(ctx, p.id, 32, 28, 0.2);
                b.append(c, document.createTextNode(`${p.name}\n${open ? p.tag : "LOCKED"}`));
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
    function drawLog() {
        const box = el("div", "ac-sheet");
        box.append(header("Flight Log"));
        const lv = pilotLevelOf(engine.save);
        for (const item of TRACK) {
            const pal = item.kind === "pal" ? PALS.find((p) => p.id === item.id) : null;
            const row = el("div", lv >= item.lvl ? "ac-log on" : "ac-log");
            row.append(el("p", "", `LV ${item.lvl} · ${pal?.name ?? item.name ?? ""}`));
            row.append(el("p", "ac-sub", pal?.desc ?? item.desc ?? ""));
            box.append(row);
        }
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
