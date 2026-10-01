// THE RIG EDITOR — a fitting bench, not part of the game.
//
// The game seats a helmet on a head with two tables and one line of
// arithmetic. DOME (draw.ts) says where each suit's head is and how big,
// in that suit's own 256px canvas - one row per still and one per
// animation frame. HELMET_SEATS (helmet-fit.ts) says where each helmet's
// head cavity is and how big, in the helmet's own canvas. Then:
//
//   scale = size / max(box.w, box.h)          // the suit's presentation box
//   hx    = x - box.w*scale/2 + (a[0]-box.x)*scale
//   r     = a[2] * scale
//   s2    = r / seat[2]
//   helmet drawn at (hx - seat[0]*s2, hy - seat[1]*s2), turned seat[3]+a[3]
//
// `box` is the trimmed alpha box for most suits and a FIXED 192px box for
// the regenerated standard series (NATURAL_FLIGHT_SUITS in draw.ts); the
// table generator reads both out of the source so the bench draws exactly
// what the Loadout draws.
//
// ONE SCREEN, ONE JOB (owner, 1 Oct 2026: "clean up the rig editor, it's
// so massively messy it's hard to use"). Pick a suit and a helmet. The big
// canvas is the frame you are fitting; the strip under it is every frame
// of that suit (or, flipped, this helmet on every suit). Two things can be
// edited and the switch says which in plain words: this suit's HEAD, or
// this helmet's CAVITY. A head edit reaches every frame of the suit by
// default, because a suit that is wrong is wrong by the same amount on
// all of them (the shipping tables were built from family templates, not
// per-suit measurements); THIS FRAME is the fine pass. Nothing here writes
// to the repo: COPY hands back paste-ready table rows.
const STORE = "acornaut.rig.v2";
const ART = () => window.__ACORNAUT_ART__ || "../../art";
const FRAME_RE = /-(asc|desc|tap|bounce)-(\d+)$/;
const KIND_ORDER = ["asc", "desc", "tap", "bounce"];
// ---------------------------------------------------------------- loading
const bank = new Map();
function measure(img) {
    // measureSprite from art.ts, to the letter: the trimmed box is what the
    // whole contract is expressed in for every suit the game measures.
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx)
        return { x: 0, y: 0, w, h };
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] < 16)
                continue;
            if (x < minX)
                minX = x;
            if (y < minY)
                minY = y;
            if (x > maxX)
                maxX = x;
            if (y > maxY)
                maxY = y;
        }
    }
    if (maxX < minX)
        return { x: 0, y: 0, w, h };
    const pad = 2;
    return {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(w, maxX - minX + 1 + pad * 2),
        h: Math.min(h, maxY - minY + 1 + pad * 2),
    };
}
function load(file, ver) {
    const hit = bank.get(file);
    if (hit)
        return Promise.resolve(hit);
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const rec = { img, box: measure(img) };
            bank.set(file, rec);
            resolve(rec);
        };
        img.onerror = () => resolve(null);
        img.src = `${ART()}/${file}?v=${ver}`;
    });
}
// The helmet with its glass punched translucent, exactly as the game does
// it - a solid visor would hide the very misalignment you are here to see.
const punched = new Map();
const LIGHT_OPAQUE_VISORS = new Set(["gemmie", "phoenix", "sammie", "seraph", "chronarch", "princess"]);
function punch(rec, id, g, opaque) {
    const memo = `${id}:${opaque ? 1 : 0}`;
    const hit = punched.get(memo);
    if (hit)
        return hit;
    const c = document.createElement("canvas");
    c.width = rec.img.naturalWidth;
    c.height = rec.img.naturalHeight;
    const cc = c.getContext("2d");
    cc.drawImage(rec.img, 0, 0);
    if (!opaque) {
        const strong = LIGHT_OPAQUE_VISORS.has(id);
        const grad = cc.createRadialGradient(g[0], g[1], g[2] * 0.1, g[0], g[1], g[2] * (strong ? 0.88 : 0.82));
        grad.addColorStop(0, `rgba(0,0,0,${strong ? 0.88 : 0.55})`);
        grad.addColorStop(0.7, `rgba(0,0,0,${strong ? 0.62 : 0.3})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        cc.globalCompositeOperation = "destination-out";
        cc.fillStyle = grad;
        cc.fillRect(0, 0, c.width, c.height);
    }
    punched.set(memo, c);
    return c;
}
const S = {
    tables: null,
    base: null, // the shipping numbers, for diffing and reset
    suit: "flight", // the suit whose frames the strip shows
    row: "suit:flight", // the DOME key on the big canvas
    helm: "clear",
    target: "head",
    reach: "suit",
    view: "frames",
    rings: true,
    fade: false,
    staleDraft: "",
};
const baseOf = (rowId) => rowId.replace(FRAME_RE, "");
const rowOf = (key) => S.tables.suits.find((s) => s.key === key);
const stillOf = (sid) => S.tables.suits.find((s) => !s.frame && s.id === sid);
const helmOf = (id) => S.tables.helmets.find((h) => h.id === id);
const wears = (s, h) => !h.suitOnly || h.suitOnly === baseOf(s.id);
/** every row of one suit: the still first, then its banks in bank order */
function rowsOfSuit(sid) {
    const rows = S.tables.suits.filter((s) => (s.frame ? baseOf(s.id) === sid : s.id === sid));
    const rank = (s) => {
        if (!s.frame)
            return -1;
        const m = FRAME_RE.exec(s.id);
        return KIND_ORDER.indexOf(m[1]) * 1000 + Number(m[2]);
    };
    return rows.sort((a, b) => rank(a) - rank(b));
}
function frameLabel(s) {
    if (!s.frame)
        return "STILL";
    const m = FRAME_RE.exec(s.id);
    return `${m[1].toUpperCase()} ${m[2]}`;
}
/** the rows a head edit lands on */
function reachRows() {
    const sel = rowOf(S.row);
    if (S.reach === "frame")
        return [sel];
    return rowsOfSuit(baseOf(sel.id)).filter((s) => !s.ownHead);
}
function boxOf(s, rec) {
    return s.box ? { x: s.box[0], y: s.box[1], w: s.box[2], h: s.box[3] } : rec.box;
}
// One snapshot per gesture, thirty deep.
const undoStack = [];
function checkpoint() {
    if (!S.tables)
        return;
    undoStack.push(JSON.stringify({
        suits: S.tables.suits.map((s) => [s.key, s.dome]),
        helmets: S.tables.helmets.map((h) => [h.id, h.seat]),
    }));
    if (undoStack.length > 30)
        undoStack.shift();
}
function undo() {
    const raw = undoStack.pop();
    if (!raw || !S.tables)
        return false;
    const d = JSON.parse(raw);
    const domes = new Map(d.suits);
    const seats = new Map(d.helmets);
    for (const s of S.tables.suits) {
        const v = domes.get(s.key);
        if (v)
            s.dome = v;
    }
    for (const h of S.tables.helmets) {
        const v = seats.get(h.id);
        if (v)
            h.seat = v;
    }
    return true;
}
function saveLocal() {
    if (!S.tables)
        return;
    try {
        localStorage.setItem(STORE, JSON.stringify({
            artVer: S.tables.artVer,
            suits: Object.fromEntries(S.tables.suits.map((s) => [s.key, s.dome])),
            helmets: Object.fromEntries(S.tables.helmets.map((h) => [h.id, h.seat])),
            at: { suit: S.suit, row: S.row, helm: S.helm, target: S.target, reach: S.reach, view: S.view },
        }));
    }
    catch { /* private mode; COPY still works */ }
}
function restoreLocal() {
    if (!S.tables)
        return;
    let raw = null;
    try {
        raw = localStorage.getItem(STORE);
    }
    catch {
        return;
    }
    if (!raw)
        return;
    try {
        const d = JSON.parse(raw);
        // A draft dialled against another art build is set aside, not worn:
        // its numbers would put every helmet somewhere the Loadout does not.
        if (d.artVer !== S.tables.artVer) {
            S.staleDraft = String(d.artVer || "an older build");
            try {
                localStorage.removeItem(STORE);
            }
            catch { /* nothing to clear */ }
            return;
        }
        for (const s of S.tables.suits)
            if (d.suits?.[s.key])
                s.dome = d.suits[s.key].slice(0, 4);
        for (const h of S.tables.helmets) {
            const g = d.helmets?.[h.id];
            if (g)
                h.seat = [g[0], g[1], g[2], g[3] || 0];
        }
        if (d.at) {
            if (S.tables.suits.some((s) => s.key === d.at.row)) {
                S.row = d.at.row;
                S.suit = d.at.suit;
            }
            if (S.tables.helmets.some((h) => h.id === d.at.helm))
                S.helm = d.at.helm;
            if (d.at.target === "cavity")
                S.target = "cavity";
            if (d.at.reach === "frame")
                S.reach = "frame";
            if (d.at.view === "suits")
                S.view = "suits";
        }
    }
    catch { /* a corrupt draft is not worth a broken page */ }
}
function geometry(s, rec, size, draw) {
    const box = boxOf(s, rec);
    const scale = draw / Math.max(1, Math.max(box.w, box.h));
    const ox = size / 2 - (box.w * scale) / 2 - box.x * scale;
    const oy = size / 2 - (box.h * scale) / 2 - box.y * scale;
    return { ox, oy, scale, hx: ox + s.dome[0] * scale, hy: oy + s.dome[1] * scale, r: s.dome[2] * scale };
}
function paint(cv, s, h, size, focus) {
    const ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(size * dpr)) {
        cv.width = Math.round(size * dpr);
        cv.height = Math.round(size * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const rec = bank.get(s.file);
    if (!rec)
        return;
    const g = geometry(s, rec, size, size * (focus ? 0.8 : 0.84));
    ctx.drawImage(rec.img, g.ox, g.oy, rec.img.naturalWidth * g.scale, rec.img.naturalHeight * g.scale);
    if (s.ownHead) {
        note(ctx, "own head · no helmet", size);
        return;
    }
    if (!wears(s, h)) {
        note(ctx, `${h.name} is ${h.suitOnly}-only · game wears Clear`, size);
        return;
    }
    const skip = h.id === "clear" && s.bakedDome;
    const helm = bank.get(h.file);
    const seat = h.seat;
    const rot = seat[3] + (s.dome[3] || 0);
    if (helm && !skip) {
        const s2 = g.r / seat[2];
        const p = punch(helm, h.id, h.glass, h.opaqueVisor === true);
        ctx.save();
        ctx.globalAlpha = S.fade ? 0.4 : 1;
        if (rot) {
            ctx.translate(g.hx, g.hy);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.translate(-g.hx, -g.hy);
        }
        ctx.drawImage(p, g.hx - seat[0] * s2, g.hy - seat[1] * s2, p.width * s2, p.height * s2);
        ctx.restore();
    }
    if (!S.rings)
        return;
    ctx.save();
    // where the number USED to be, so a move reads as a move
    const b = S.base.suits.find((x) => x.key === s.key);
    if (focus && b && (b.dome[0] !== s.dome[0] || b.dome[1] !== s.dome[1] || b.dome[2] !== s.dome[2])) {
        ctx.strokeStyle = "rgba(255,190,90,.6)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(g.ox + b.dome[0] * g.scale, g.oy + b.dome[1] * g.scale, b.dome[2] * g.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    // the head circle: the helmet's cavity is scaled onto exactly this ring
    ctx.strokeStyle = S.target === "head" ? "rgba(110,220,255,.9)" : "rgba(255,120,210,.9)";
    ctx.lineWidth = focus ? 1.5 : 1;
    ctx.beginPath();
    ctx.arc(g.hx, g.hy, g.r, 0, Math.PI * 2);
    ctx.stroke();
    if (focus) {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(g.hx - 5, g.hy - 0.5, 10, 1);
        ctx.fillRect(g.hx - 0.5, g.hy - 5, 1, 10);
    }
    ctx.restore();
}
function note(ctx, text, size) {
    ctx.save();
    ctx.fillStyle = "rgba(150,165,200,.8)";
    ctx.font = `600 ${size > 200 ? 12 : 9}px Figtree, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, size / 2, size - 8);
    ctx.restore();
}
// ------------------------------------------------------------------- edit
// Every edit is a DELTA applied through the reach, so a typed number, a
// drag and a pad press all do the same thing to the same rows.
function moveHead(dx, dy) {
    for (const s of reachRows()) {
        s.dome[0] += dx;
        s.dome[1] += dy;
    }
}
function sizeHead(k) {
    for (const s of reachRows())
        s.dome[2] *= k;
}
function tiltHead(deg) {
    for (const s of reachRows())
        s.dome[3] = (s.dome[3] || 0) + deg;
}
function moveCavity(dx, dy) {
    // moving the helmet right on screen means its cavity sits further LEFT
    // in its own frame: the drawn origin is (hx - seat[0]*s2)
    const h = helmOf(S.helm);
    h.seat[0] -= dx;
    h.seat[1] -= dy;
}
function sizeCavity(k) {
    // a bigger helmet on the same head means a smaller cavity radius
    helmOf(S.helm).seat[2] /= k;
}
function tiltCavity(deg) {
    helmOf(S.helm).seat[3] += deg;
}
// the three verbs, routed by target. dx/dy in TABLE units of the target.
function move(dx, dy) { if (S.target === "head")
    moveHead(dx, dy);
else
    moveCavity(dx, dy); }
function size(k) { if (S.target === "head")
    sizeHead(k);
else
    sizeCavity(k); }
function tilt(deg) { if (S.target === "head")
    tiltHead(deg);
else
    tiltCavity(deg); }
function resetTarget() {
    const b = S.base;
    if (S.target === "cavity") {
        const h = helmOf(S.helm);
        h.seat = b.helmets.find((x) => x.id === h.id).seat.slice(0, 4);
        return `${h.name}'s cavity back to shipping`;
    }
    const rows = reachRows();
    for (const s of rows)
        s.dome = b.suits.find((x) => x.key === s.key).dome.slice(0, 4);
    return rows.length === 1 ? `${frameLabel(rows[0])} back to shipping` : `${rows.length} frames back to shipping`;
}
// -------------------------------------------------------------- reporting
const round = (n, p = 1) => Math.round(n * Math.pow(10, p)) / Math.pow(10, p);
const differs = (a, b) => [0, 1, 2, 3].some((i) => Math.abs((a[i] || 0) - (b[i] || 0)) > 0.05);
const rowChanged = (s) => {
    const o = S.base.suits.find((x) => x.key === s.key);
    if (!differs(s.dome, o.dome))
        return false;
    // A seeded tap frame has no row in draw.ts: the game seats it on the
    // still's anchor. While it still matches the still it is not a change,
    // just the still's number seen on another frame; printing it would mint
    // sixteen identical rows for every suit whose head moved.
    if (s.seeded)
        return differs(s.dome, stillOf(baseOf(s.id)).dome);
    return true;
};
const helmChanged = (h) => {
    const o = S.base.helmets.find((x) => x.id === h.id);
    return [0, 1, 2, 3].some((i) => Math.abs(h.seat[i] - o.seat[i]) > 0.05);
};
function changes() {
    return {
        suits: S.tables.suits.filter(rowChanged),
        helmets: S.tables.helmets.filter(helmChanged),
    };
}
function fmtDome(d) {
    const n = d[3] ? 4 : 3;
    return `[${d.slice(0, n).map((v) => round(v, 2)).join(", ")}]`;
}
function reportTS() {
    const c = changes();
    const out = [];
    if (c.suits.length) {
        out.push("// draw.ts — DOME");
        for (const s of c.suits)
            out.push(`  "${s.key}": ${fmtDome(s.dome)},`);
    }
    if (c.helmets.length) {
        out.push("// helmet-fit.ts — HELMET_SEATS");
        for (const h of c.helmets) {
            const n = h.seat[3] ? 4 : 3;
            out.push(`  ${h.id}: [${h.seat.slice(0, n).map((v) => round(v, 1)).join(",")}],`);
        }
    }
    return out.length ? out.join("\n") : "// nothing changed yet";
}
function reportJSON() {
    const c = changes();
    const b = S.base;
    return JSON.stringify({
        note: "acornaut rig editor — changed values only",
        artVer: S.tables.artVer,
        DOME: Object.fromEntries(c.suits.map((s) => [s.key, {
                was: b.suits.find((x) => x.key === s.key).dome,
                now: s.dome.map((v) => round(v, 2)),
            }])),
        HELMET_SEATS: Object.fromEntries(c.helmets.map((h) => [h.id, {
                was: b.helmets.find((x) => x.id === h.id).seat,
                now: h.seat.map((v) => round(v, 1)),
            }])),
    }, null, 1);
}
// --------------------------------------------------------------------- UI
function el(tag, cls = "", text = "") {
    const n = document.createElement(tag);
    if (cls)
        n.className = cls;
    if (text)
        n.textContent = text;
    return n;
}
// press-and-hold repeat: one checkpoint per press, then a steady repeat
function hold(btn, fn) {
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        checkpoint();
        fn();
        t1 = window.setTimeout(() => { t2 = window.setInterval(fn, 60); }, 380);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"])
        btn.addEventListener(ev, stop);
}
export async function bootRig(root) {
    root.innerHTML = "";
    const loading = el("div", "rg-boot", "loading art…");
    root.append(loading);
    const res = await fetch("./tables.json?v=" + Date.now());
    const tables = await res.json();
    S.tables = tables;
    S.base = JSON.parse(JSON.stringify(tables));
    restoreLocal();
    const files = new Set();
    tables.suits.forEach((s) => files.add(s.file));
    tables.helmets.forEach((h) => files.add(h.file));
    let done = 0;
    await Promise.all([...files].map((f) => load(f, tables.artVer).then(() => {
        done++;
        loading.textContent = `loading art… ${done}/${files.size}`;
    })));
    loading.remove();
    // ---- header: who, wearing what, seen how
    const head = el("div", "rg-head");
    const mkSel = (cls) => el("select", `rg-sel ${cls}`);
    const suitSel = mkSel("rg-suit");
    const helmSel = mkSel("rg-helm");
    const viewB = el("button", "rg-chip", "");
    head.append(suitSel, helmSel, viewB);
    suitSel.onchange = () => { selectSuit(suitSel.value); };
    helmSel.onchange = () => { S.helm = helmSel.value; build(); };
    viewB.onclick = () => { S.view = S.view === "frames" ? "suits" : "frames"; build(); };
    // ---- the switch: what a drag edits, and how far it reaches
    const tbar = el("div", "rg-tbar");
    const tSeg = el("div", "rg-seg");
    const tBtn = {
        head: el("button", "rg-segb", ""),
        cavity: el("button", "rg-segb", ""),
    };
    tBtn.head.onclick = () => { S.target = "head"; sync(); };
    tBtn.cavity.onclick = () => { S.target = "cavity"; sync(); };
    tSeg.append(tBtn.head, tBtn.cavity);
    const rSeg = el("div", "rg-seg rg-reach");
    const rBtn = {
        suit: el("button", "rg-segb", "ALL FRAMES"),
        frame: el("button", "rg-segb", "THIS FRAME"),
    };
    rBtn.suit.onclick = () => { S.reach = "suit"; sync(); };
    rBtn.frame.onclick = () => { S.reach = "frame"; sync(); };
    rSeg.append(rBtn.suit, rBtn.frame);
    tbar.append(tSeg, rSeg);
    const hint = el("p", "rg-hint");
    const hintText = el("span", "");
    const links = el("span", "rg-links", "LAB · ");
    const shipA = el("a", "", "ship");
    shipA.href = "../ship/";
    const backA = el("a", "", "back");
    backA.href = "../../";
    links.append(shipA, " · ", backA);
    hint.append(hintText, links);
    // ---- the stage: one big canvas and the strip
    const main = el("div", "rg-main");
    const focusWrap = el("div", "rg-focus");
    const focus = el("canvas", "rg-fcv");
    const focusCap = el("div", "rg-fcap");
    const toggles = el("div", "rg-toggles");
    const ringsB = el("button", "rg-tog", "RINGS");
    const fadeB = el("button", "rg-tog", "FADE");
    ringsB.onclick = () => { S.rings = !S.rings; sync(); };
    fadeB.onclick = () => { S.fade = !S.fade; sync(); };
    toggles.append(ringsB, fadeB);
    focusWrap.append(focus, focusCap, toggles);
    const strip = el("div", "rg-strip");
    main.append(focusWrap, strip);
    // ---- numbers: the row under the target, typed or nudged
    const nums = el("div", "rg-nums");
    const numIn = {};
    for (const [k, label] of [["x", "X"], ["y", "Y"], ["r", "R"], ["t", "TILT"]]) {
        const w = el("label", "rg-num");
        const i = el("input", "rg-numin");
        i.type = "number";
        i.step = k === "t" ? "0.5" : "0.1";
        i.inputMode = "decimal";
        w.append(el("span", "", label), i);
        nums.append(w);
        numIn[k] = i;
        i.onchange = () => typed(k, Number(i.value));
    }
    // ---- footer: pad, dials, actions
    const foot = el("div", "rg-foot");
    const pad = el("div", "rg-pad");
    const mkPad = (t, dx, dy) => {
        const b = el("button", "rg-pb", t);
        hold(b, () => { move(dx, dy); refresh(); });
        return b;
    };
    pad.append(el("span", ""), mkPad("↑", 0, -1), el("span", ""), mkPad("←", -1, 0), el("span", "rg-pc"), mkPad("→", 1, 0), el("span", ""), mkPad("↓", 0, 1), el("span", ""));
    const dials = el("div", "rg-dials");
    const mkDial = (name, minus, plus) => {
        const w = el("div", "rg-dial");
        const a = el("button", "rg-pb", "−");
        const b = el("button", "rg-pb", "+");
        hold(a, () => { minus(); refresh(); });
        hold(b, () => { plus(); refresh(); });
        w.append(a, el("span", "rg-dl", name), b);
        return w;
    };
    dials.append(mkDial("SIZE", () => size(1 / 1.02), () => size(1.02)), mkDial("TILT", () => tilt(-1), () => tilt(1)));
    const acts = el("div", "rg-acts");
    const undoB = el("button", "rg-act", "UNDO");
    undoB.onclick = () => { if (undo()) {
        refresh();
        flash("undone");
    }
    else
        flash("nothing to undo"); };
    const resetB = el("button", "rg-act", "RESET");
    resetB.onclick = () => { checkpoint(); flash(resetTarget()); refresh(); };
    const copyB = el("button", "rg-act rg-go", "COPY");
    copyB.onclick = () => showReport();
    acts.append(undoB, resetB, copyB);
    foot.append(pad, dials, nums, acts);
    const toast = el("div", "rg-toast");
    root.append(head, tbar, hint, main, foot, toast);
    let toastT = 0;
    function flash(msg) {
        toast.textContent = msg;
        toast.classList.add("on");
        clearTimeout(toastT);
        toastT = window.setTimeout(() => toast.classList.remove("on"), 2200);
    }
    if (S.staleDraft) {
        window.setTimeout(() => flash(`draft from art v${S.staleDraft} set aside — opened on the shipping numbers (v${tables.artVer})`), 400);
    }
    // ---- selection
    function selectSuit(sid) {
        S.suit = sid;
        const rows = rowsOfSuit(sid);
        // keep the same frame position if the new suit has it, else the still
        const want = rowOf(S.row);
        const same = rows.find((r) => frameLabel(r) === frameLabel(want));
        S.row = (same ?? rows[0]).key;
        // a helmet this suit does not wear snaps to Clear, as the game does
        if (!wears(stillOf(sid), helmOf(S.helm)))
            S.helm = "clear";
        build();
    }
    function selectRow(key) {
        S.row = key;
        S.suit = baseOf(rowOf(key).id);
        refresh();
    }
    let thumbs = [];
    let focusSize = 320;
    function stripRows() {
        if (S.view === "suits") {
            return tables.suits.filter((s) => !s.frame && !s.ownHead && wears(s, helmOf(S.helm)));
        }
        return rowsOfSuit(S.suit);
    }
    function build() {
        // pickers
        suitSel.innerHTML = "";
        for (const s of tables.suits.filter((x) => !x.frame)) {
            const o = el("option", "", s.ownHead ? `${s.name} (own head)` : s.name);
            o.value = s.id;
            suitSel.append(o);
        }
        suitSel.value = S.suit;
        helmSel.innerHTML = "";
        const still = stillOf(S.suit);
        for (const h of tables.helmets.filter((x) => wears(still, x))) {
            const o = el("option", "", h.suitOnly ? `${h.name} (${h.suitOnly} only)` : h.name);
            o.value = h.id;
            helmSel.append(o);
        }
        helmSel.value = S.helm;
        viewB.textContent = S.view === "frames" ? "FRAMES" : "SUITS";
        viewB.title = S.view === "frames" ? "showing every frame of this suit — tap for this helmet on every suit" : "showing this helmet on every suit — tap for every frame of this suit";
        // sizes: the big canvas fills the width on a phone, a column on desktop
        const wide = main.clientWidth >= 820;
        focusSize = wide
            ? Math.max(280, Math.min(560, main.clientHeight - 24))
            : Math.max(220, Math.min(460, main.clientWidth - 24, Math.floor(main.clientHeight * 0.55)));
        focus.style.width = focus.style.height = focusSize + "px";
        strip.innerHTML = "";
        thumbs = [];
        const rows = stripRows();
        if (!rows.some((r) => r.key === S.row))
            S.row = rows[0]?.key ?? S.row;
        const tsize = wide ? 104 : 86;
        for (const s of rows) {
            const wrap = el("button", "rg-thumb");
            const cv = el("canvas", "rg-tcv");
            cv.style.width = cv.style.height = tsize + "px";
            wrap.append(cv, el("span", "rg-tcap", S.view === "suits" ? s.name : frameLabel(s)));
            wrap.onclick = () => selectRow(s.key);
            strip.append(wrap);
            thumbs.push({ cv, s, wrap, size: tsize });
        }
        sync();
    }
    function sync() {
        tBtn.head.textContent = `HEAD · ${stillOf(S.suit).name}`;
        tBtn.cavity.textContent = `CAVITY · ${helmOf(S.helm).name}`;
        tBtn.head.classList.toggle("on", S.target === "head");
        tBtn.cavity.classList.toggle("on", S.target === "cavity");
        rSeg.classList.toggle("off", S.target !== "head");
        rBtn.suit.classList.toggle("on", S.reach === "suit");
        rBtn.frame.classList.toggle("on", S.reach === "frame");
        ringsB.classList.toggle("on", S.rings);
        fadeB.classList.toggle("on", S.fade);
        hintText.textContent = S.target === "head"
            ? (S.reach === "suit"
                ? "Drag the big canvas: this suit's head moves on every frame in the strip."
                : "Drag the big canvas: this frame's head only. The other frames stay put.")
            : "Drag the big canvas: this helmet's cavity moves on every suit that wears it.";
        refresh();
    }
    function refresh() {
        const sel = rowOf(S.row);
        const h = helmOf(S.helm);
        paint(focus, sel, h, focusSize, true);
        focusCap.textContent = `${stillOf(baseOf(sel.id)).name} · ${frameLabel(sel)} · ${h.name}`;
        for (const t of thumbs) {
            paint(t.cv, t.s, h, t.size, false);
            t.wrap.classList.toggle("on", t.s.key === S.row);
            t.wrap.classList.toggle("ch", !t.s.ownHead && (S.target === "cavity" ? helmChanged(h) : rowChanged(t.s)));
        }
        // numbers under the target
        const v = S.target === "head" ? sel.dome : h.seat;
        const act = document.activeElement;
        const set = (k, n, p) => { if (act !== numIn[k])
            numIn[k].value = String(round(n, p)); };
        set("x", v[0], 2);
        set("y", v[1], 2);
        set("r", v[2], 2);
        set("t", v[3] || 0, 1);
        nums.classList.toggle("rg-cav", S.target === "cavity");
        const c = changes();
        const n = c.suits.length + c.helmets.length;
        copyB.textContent = n ? `COPY ${n}` : "COPY";
        saveLocal();
    }
    function typed(k, n) {
        if (!isFinite(n)) {
            refresh();
            return;
        }
        const sel = rowOf(S.row);
        const h = helmOf(S.helm);
        const cur = S.target === "head" ? sel.dome : h.seat;
        checkpoint();
        if (S.target === "head") {
            if (k === "x")
                moveHead(n - cur[0], 0);
            else if (k === "y")
                moveHead(0, n - cur[1]);
            else if (k === "r") {
                if (n > 0)
                    sizeHead(n / cur[2]);
            }
            else
                tiltHead(n - (cur[3] || 0));
        }
        else {
            if (k === "x")
                h.seat[0] = n;
            else if (k === "y")
                h.seat[1] = n;
            else if (k === "r") {
                if (n > 0)
                    h.seat[2] = n;
            }
            else
                h.seat[3] = n;
        }
        refresh();
    }
    // ---- the big canvas: drag to move, pinch or wheel to size
    {
        let id = -1, lx = 0, ly = 0, pinch = 0;
        const pts = new Map();
        const unitsPerPx = () => {
            const sel = rowOf(S.row);
            const rec = bank.get(sel.file);
            const g = geometry(sel, rec, focusSize, focusSize * 0.8);
            // head: table units per screen pixel; cavity: helmet units per pixel
            return S.target === "head" ? 1 / g.scale : helmOf(S.helm).seat[2] / g.r;
        };
        focus.addEventListener("pointerdown", (e) => {
            const sel = rowOf(S.row);
            if (sel.ownHead) {
                flash("own head — nothing to seat");
                return;
            }
            if (!wears(sel, helmOf(S.helm))) {
                flash("this suit does not wear that helmet");
                return;
            }
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 1)
                checkpoint();
            if (pts.size === 2) {
                const [a, b] = [...pts.values()];
                pinch = Math.hypot(a.x - b.x, a.y - b.y);
            }
            else {
                id = e.pointerId;
                lx = e.clientX;
                ly = e.clientY;
            }
            focus.setPointerCapture(e.pointerId);
        });
        focus.addEventListener("pointermove", (e) => {
            if (!pts.has(e.pointerId))
                return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 2) {
                const [a, b] = [...pts.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch > 8 && d > 8) {
                    size(d / pinch);
                    pinch = d;
                    refresh();
                }
                return;
            }
            if (e.pointerId !== id)
                return;
            const dx = e.clientX - lx, dy = e.clientY - ly;
            lx = e.clientX;
            ly = e.clientY;
            if (dx || dy) {
                const u = unitsPerPx();
                move(dx * u, dy * u);
                refresh();
            }
        });
        const up = (e) => { pts.delete(e.pointerId); if (e.pointerId === id)
            id = -1; if (pts.size < 2)
            pinch = 0; };
        focus.addEventListener("pointerup", up);
        focus.addEventListener("pointercancel", up);
        let wheelAt = 0;
        focus.addEventListener("wheel", (e) => {
            e.preventDefault();
            const now = performance.now();
            if (now - wheelAt > 500)
                checkpoint();
            wheelAt = now;
            size(e.deltaY < 0 ? 1.02 : 1 / 1.02);
            refresh();
        }, { passive: false });
    }
    // ---- keyboard, for the desktop pass
    let keyAt = 0;
    window.addEventListener("keydown", (e) => {
        const tag = e.target?.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")
            return;
        const step = e.shiftKey ? 5 : 1;
        const edit = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "=", "+", "-", "_", "[", "]"];
        if (edit.includes(e.key)) {
            const now = performance.now();
            if (now - keyAt > 500)
                checkpoint();
            keyAt = now;
            e.preventDefault();
        }
        const arrows = {
            ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
        };
        if (arrows[e.key]) {
            move(arrows[e.key][0], arrows[e.key][1]);
            refresh();
        }
        else if (e.key === "=" || e.key === "+") {
            size(1.02);
            refresh();
        }
        else if (e.key === "-" || e.key === "_") {
            size(1 / 1.02);
            refresh();
        }
        else if (e.key === "[") {
            tilt(-1);
            refresh();
        }
        else if (e.key === "]") {
            tilt(1);
            refresh();
        }
        else if (e.key.toLowerCase() === "z") {
            if (undo()) {
                refresh();
                flash("undone");
            }
        }
        else if (e.key === "," || e.key === ".") {
            const rows = stripRows();
            const i = rows.findIndex((r) => r.key === S.row);
            const j = (i + (e.key === "," ? -1 : 1) + rows.length) % rows.length;
            selectRow(rows[j].key);
        }
        else if (e.key.toLowerCase() === "h") {
            S.target = "head";
            sync();
        }
        else if (e.key.toLowerCase() === "c") {
            S.target = "cavity";
            sync();
        }
        else if (e.key.toLowerCase() === "a") {
            S.reach = S.reach === "suit" ? "frame" : "suit";
            sync();
        }
        else if (e.key.toLowerCase() === "r") {
            S.rings = !S.rings;
            sync();
        }
        else if (e.key.toLowerCase() === "f") {
            S.fade = !S.fade;
            sync();
        }
    });
    let resizeT = 0;
    window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = window.setTimeout(build, 120); });
    // ---- the report sheet: what changed, ready to paste
    function showReport() {
        const sheet = el("div", "rg-sheet");
        const inner = el("div", "rg-sheetin");
        const ts = reportTS();
        const json = reportJSON();
        const c = changes();
        inner.append(el("h2", "", c.suits.length + c.helmets.length ? "CHANGES" : "NOTHING CHANGED YET"));
        inner.append(el("p", "rg-fine", "Paste these rows over the same keys in draw.ts (DOME) and helmet-fit.ts (HELMET_SEATS), or hand them to the chat."));
        inner.append(el("pre", "rg-pre", ts));
        const row = el("div", "rg-acts rg-sheetacts");
        const cp = el("button", "rg-act rg-go", "COPY ROWS");
        cp.onclick = async () => { await copy(ts); flash("copied — paste into the chat"); };
        const cj = el("button", "rg-act", "COPY JSON");
        cj.onclick = async () => { await copy(json); flash("copied JSON"); };
        const dl = el("button", "rg-act", "DOWNLOAD");
        dl.onclick = () => {
            const b = new Blob([json], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = `acornaut-rig-v${tables.artVer}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        };
        // RESET ALL lives here and only here, behind two taps: it is everything
        let armed = 0;
        const clr = el("button", "rg-act rg-danger", "RESET ALL");
        clr.onclick = () => {
            if (!armed) {
                clr.textContent = "SURE? RESET ALL";
                clr.classList.add("on");
                armed = window.setTimeout(() => { armed = 0; clr.textContent = "RESET ALL"; clr.classList.remove("on"); }, 3000);
                return;
            }
            clearTimeout(armed);
            sheet.remove();
            const fresh = JSON.parse(JSON.stringify(S.base));
            for (const s of tables.suits)
                s.dome = fresh.suits.find((x) => x.key === s.key).dome;
            for (const h of tables.helmets)
                h.seat = fresh.helmets.find((x) => x.id === h.id).seat;
            undoStack.length = 0;
            try {
                localStorage.removeItem(STORE);
            }
            catch { /* private mode */ }
            refresh();
            flash("every number back to the shipping values; draft cleared");
        };
        const close = el("button", "rg-act", "CLOSE");
        close.onclick = () => sheet.remove();
        row.append(cp, cj, dl, clr, close);
        inner.append(row);
        sheet.append(inner);
        sheet.onclick = (e) => { if (e.target === sheet)
            sheet.remove(); };
        root.append(sheet);
    }
    async function copy(text) {
        try {
            await navigator.clipboard.writeText(text);
        }
        catch {
            const ta = el("textarea", "rg-ta");
            ta.value = text;
            root.append(ta);
            ta.select();
            try {
                document.execCommand("copy");
            }
            catch { /* left selected */ }
            setTimeout(() => ta.remove(), 200);
        }
    }
    build();
    window.__rig = { S, build, refresh, selectRow, selectSuit, move, size, tilt, reportTS, reportJSON, changes, geometry, bank };
}
