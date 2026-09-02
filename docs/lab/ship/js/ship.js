// THE SHIP BENCH. A fitting bench for the Spill ship's swappable parts:
// pick a hull, pick a part, and drag, scale and turn it until it sits.
// Every part carries one transform - offset, scale, rotation - in the
// sprites' own 256px frame, so the JSON this exports is exactly what the
// painter needs to place the part in the game. A part can also carry an
// override for one hull, for the case where a hull's own tail or nose
// differs from the others.
//
// The sprites live in docs/art/spill-ship/; manifest.json names them.
// Not part of the game.
const STORE = "acornaut-ship-bench-v1";
const ID = { dx: 0, dy: 0, scale: 1, rot: 0 };
function el(tag, cls = "", text = "") {
    const n = document.createElement(tag);
    if (cls)
        n.className = cls;
    if (text)
        n.textContent = text;
    return n;
}
const artRoot = () => window.__ACORNAUT_ART__ || "../../art";
async function loadSprite(name) {
    const img = new Image();
    img.src = `${artRoot()}/spill-ship/${name}.png?v=${Date.now()}`;
    await img.decode();
    // the part's own centre of mass in the frame: the pivot for scale and turn
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
            if (d[(y * c.width + x) * 4 + 3] > 40) {
                if (x < x0)
                    x0 = x;
                if (x > x1)
                    x1 = x;
                if (y < y0)
                    y0 = y;
                if (y > y1)
                    y1 = y;
            }
        }
    if (x1 < x0) {
        x0 = y0 = 0;
        x1 = c.width - 1;
        y1 = c.height - 1;
    }
    return { img, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, box: [x0, y0, x1, y1] };
}
export async function bootShip(root) {
    const loading = el("div", "rg-boot", "loading the ship…");
    root.append(loading);
    const man = await (await fetch(`${artRoot()}/spill-ship/manifest.json?v=${Date.now()}`)).json();
    const names = [...man.hulls, ...man.order.flatMap((k) => man.parts[k])];
    const sprites = new Map();
    let done = 0;
    await Promise.all(names.map((n) => loadSprite(n).then((s) => { sprites.set(n, s); loading.textContent = `loading art… ${++done}/${names.length}`; })));
    loading.remove();
    // ---- state
    const S = {
        hull: man.hulls[0],
        level: {}, // per axis: 0 = off, 1..3
        sel: man.order[0], // the axis being edited
        xf: {}, // part name -> transform
        over: {}, // hull -> part -> transform
        onlyHull: false, // edits go to the override for this hull
        step: 1,
        zoom: 1,
        showBox: true,
    };
    for (const k of man.order)
        S.level[k] = 1;
    const restore = () => {
        try {
            const d = JSON.parse(localStorage.getItem(STORE) || "null");
            if (d) {
                S.xf = d.xf || {};
                S.over = d.over || {};
            }
        }
        catch { /* a corrupt draft is not worth a broken page */ }
    };
    const save = () => { try {
        localStorage.setItem(STORE, JSON.stringify({ xf: S.xf, over: S.over }));
    }
    catch { /* private mode */ } };
    restore();
    const partOf = (axis) => S.level[axis] ? man.parts[axis][S.level[axis] - 1] : null;
    const xfFor = (part, hull = S.hull) => S.over[hull]?.[part] ?? S.xf[part] ?? ID;
    const editing = () => {
        var _a, _b, _c, _d;
        const p = partOf(S.sel);
        if (!p)
            return { ...ID };
        if (S.onlyHull) {
            (_a = S.over)[_b = S.hull] ?? (_a[_b] = {});
            (_c = S.over[S.hull])[p] ?? (_c[p] = { ...xfFor(p) });
            return S.over[S.hull][p];
        }
        (_d = S.xf)[p] ?? (_d[p] = { ...ID });
        return S.xf[p];
    };
    // ---- chrome
    const bar = el("div", "rg-bar");
    const mkSel = (opts, val, on) => {
        const s = el("select", "rg-sel");
        for (const o of opts) {
            const op = el("option", "", o.t);
            op.value = o.v;
            s.append(op);
        }
        s.value = val;
        s.onchange = () => on(s.value);
        return s;
    };
    const hullSel = mkSel(man.hulls.map((h) => ({ v: h, t: h })), S.hull, (v) => { S.hull = v; paint(); });
    bar.append(hullSel);
    const seg = el("div", "rg-seg");
    const segBtns = [];
    for (const k of man.order) {
        const b = el("button", "rg-segb", k.toUpperCase());
        b.onclick = () => { S.sel = k; syncChrome(); paint(); };
        segBtns.push(b);
        seg.append(b);
    }
    bar.append(seg);
    const sub = el("div", "rg-bar rg-sub");
    const lvl = el("div", "rg-seg");
    const lvlBtns = [];
    for (let i = 0; i <= 3; i++) {
        const b = el("button", "rg-segb", i ? `L${i}` : "OFF");
        b.onclick = () => { S.level[S.sel] = i; syncChrome(); paint(); };
        lvlBtns.push(b);
        lvl.append(b);
    }
    sub.append(lvl);
    const onlyBtn = el("button", "rg-tog", "THIS HULL ONLY");
    onlyBtn.onclick = () => { S.onlyHull = !S.onlyHull; syncChrome(); paint(); };
    sub.append(onlyBtn);
    const boxBtn = el("button", "rg-tog on", "BOX");
    boxBtn.onclick = () => { S.showBox = !S.showBox; boxBtn.classList.toggle("on", S.showBox); paint(); };
    sub.append(boxBtn);
    const hint = el("div", "rg-hint", "Drag the part to move it. Wheel or pinch to scale, hold ALT to turn. The pad nudges by the step; ± scale, ⟲ ⟳ turn. Numbers are in the 256px sprite frame, so the JSON is what the painter uses. ");
    const rigLink = el("a", "", "rig editor");
    rigLink.href = "../rig/";
    rigLink.style.color = "#8b9bc4";
    const backLink = el("a", "", "back to the game");
    backLink.href = "../../";
    backLink.style.color = "#8b9bc4";
    hint.append(rigLink, " · ", backLink);
    // ---- stage
    const stage = el("div", "rg-stage rg-solo");
    const cv = el("canvas", "rg-cv");
    const ctx = cv.getContext("2d");
    stage.append(cv);
    const stat = el("div", "rg-stat");
    // ---- foot: nudge pad, dials, actions
    const foot = el("div", "rg-foot");
    const pad = el("div", "rg-pad");
    const nudge = (dx, dy) => { const x = editing(); x.dx += dx * S.step; x.dy += dy * S.step; save(); paint(); };
    const padBtn = (t, f) => { const b = el("button", "rg-pb", t); b.onclick = f; return b; };
    const stepBtn = el("button", "rg-pb", "1");
    stepBtn.onclick = () => { S.step = S.step === 1 ? 5 : S.step === 5 ? 0.25 : 1; stepBtn.textContent = String(S.step); };
    pad.append(el("div", "rg-pc"), padBtn("▲", () => nudge(0, -1)), el("div", "rg-pc"), padBtn("◀", () => nudge(-1, 0)), stepBtn, padBtn("▶", () => nudge(1, 0)), el("div", "rg-pc"), padBtn("▼", () => nudge(0, 1)), el("div", "rg-pc"));
    const dials = el("div", "rg-dials");
    const dial = (label, minus, plus) => {
        const d = el("div", "rg-dial");
        const m = el("button", "rg-pb", "−");
        m.onclick = minus;
        const p = el("button", "rg-pb", "+");
        p.onclick = plus;
        d.append(m, el("div", "rg-dl", label), p);
        return d;
    };
    dials.append(dial("SIZE", () => { const x = editing(); x.scale = Math.max(0.2, +(x.scale / 1.02).toFixed(4)); save(); paint(); }, () => { const x = editing(); x.scale = Math.min(4, +(x.scale * 1.02).toFixed(4)); save(); paint(); }), dial("TURN", () => { const x = editing(); x.rot = +(x.rot - (S.step >= 1 ? S.step : 0.25)).toFixed(2); save(); paint(); }, () => { const x = editing(); x.rot = +(x.rot + (S.step >= 1 ? S.step : 0.25)).toFixed(2); save(); paint(); }));
    const acts = el("div", "rg-acts");
    const resetBtn = el("button", "rg-act rg-danger", "RESET PART");
    resetBtn.onclick = () => {
        const p = partOf(S.sel);
        if (!p)
            return;
        if (S.onlyHull)
            delete S.over[S.hull]?.[p];
        else
            delete S.xf[p];
        save();
        paint();
        flash("part back to zero");
    };
    const flightBtn = el("button", "rg-act", "58 PX");
    let flight = false;
    flightBtn.onclick = () => { flight = !flight; flightBtn.classList.toggle("on", flight); paint(); };
    const exportBtn = el("button", "rg-act rg-go", "EXPORT");
    exportBtn.onclick = () => openSheet();
    acts.append(resetBtn, flightBtn, exportBtn);
    foot.append(pad, dials, acts);
    const toast = el("div", "rg-toast");
    let toastT = 0;
    const flash = (t) => { toast.textContent = t; toast.classList.add("on"); clearTimeout(toastT); toastT = window.setTimeout(() => toast.classList.remove("on"), 1400); };
    root.append(bar, sub, hint, stage, stat, foot, toast);
    function syncChrome() {
        segBtns.forEach((b, i) => b.classList.toggle("on", man.order[i] === S.sel));
        lvlBtns.forEach((b, i) => b.classList.toggle("on", S.level[S.sel] === i));
        onlyBtn.classList.toggle("on", S.onlyHull);
    }
    // ---- painting. The frame is the sprites' 256px box, zoomed to the stage
    function frameSize() {
        const w = stage.clientWidth - 20, h = stage.clientHeight - 20;
        return Math.max(160, Math.min(w, h, 900));
    }
    function drawShip(g, size, hull, box) {
        const z = size / 256;
        g.save();
        g.scale(z, z);
        g.drawImage(sprites.get(hull).img, 0, 0);
        for (const axis of man.order) {
            const p = partOf(axis);
            if (!p)
                continue;
            const sp = sprites.get(p);
            const x = xfFor(p, hull);
            g.save();
            g.translate(sp.cx + x.dx, sp.cy + x.dy);
            g.rotate((x.rot * Math.PI) / 180);
            g.scale(x.scale, x.scale);
            g.drawImage(sp.img, -sp.cx, -sp.cy);
            if (box && axis === S.sel) {
                g.strokeStyle = "rgba(120,200,255,.9)";
                g.lineWidth = 1 / (z * x.scale);
                g.setLineDash([4 / (z * x.scale), 3 / (z * x.scale)]);
                g.strokeRect(sp.box[0] - sp.cx, sp.box[1] - sp.cy, sp.box[2] - sp.box[0], sp.box[3] - sp.box[1]);
            }
            g.restore();
        }
        g.restore();
    }
    function paint() {
        const size = frameSize();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(size * dpr);
        cv.height = Math.round(size * dpr);
        cv.style.width = size + "px";
        cv.style.height = size + "px";
        S.zoom = size / 256;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(0, 0, size, size);
        // a faint frame grid, so a nudge is visible against something
        ctx.strokeStyle = "rgba(255,255,255,.05)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 256; i += 32) {
            const q = (i / 256) * size;
            ctx.beginPath();
            ctx.moveTo(q, 0);
            ctx.lineTo(q, size);
            ctx.moveTo(0, q);
            ctx.lineTo(size, q);
            ctx.stroke();
        }
        drawShip(ctx, size, S.hull, S.showBox);
        if (flight) {
            // the ship at the size the Spill flies it, in the corner, on deep space
            const fs = 58, pad = 10;
            ctx.fillStyle = "#07091a";
            ctx.fillRect(size - fs - pad * 2, size - fs - pad * 2, fs + pad * 2, fs + pad * 2);
            ctx.save();
            ctx.translate(size - fs - pad, size - fs - pad);
            ctx.imageSmoothingQuality = "high";
            drawShip(ctx, fs, S.hull, false);
            ctx.restore();
        }
        const p = partOf(S.sel);
        const x = p ? xfFor(p) : ID;
        const ov = p && S.over[S.hull]?.[p] ? " · override for this hull" : "";
        stat.textContent = p ? `${p} on ${S.hull}${ov}   dx ${x.dx.toFixed(2)}  dy ${x.dy.toFixed(2)}  scale ${x.scale.toFixed(3)}  rot ${x.rot.toFixed(2)}°` : `${S.sel}: off`;
    }
    // ---- pointer: drag moves, wheel scales (ALT turns), two fingers pinch
    let drag = null;
    const pts = new Map();
    let pinch = null;
    cv.addEventListener("pointerdown", (e) => {
        cv.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) {
            const x = editing();
            drag = { x: e.clientX, y: e.clientY, dx: x.dx, dy: x.dy };
        }
        else if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            const x = editing();
            pinch = { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x), scale: x.scale, rot: x.rot };
            drag = null;
        }
    });
    cv.addEventListener("pointermove", (e) => {
        if (!pts.has(e.pointerId))
            return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size === 2) {
            const [a, b] = [...pts.values()];
            const x = editing();
            const d = Math.hypot(b.x - a.x, b.y - a.y), an = Math.atan2(b.y - a.y, b.x - a.x);
            x.scale = Math.max(0.2, Math.min(4, +(pinch.scale * (d / pinch.d)).toFixed(4)));
            x.rot = +(pinch.rot + ((an - pinch.a) * 180) / Math.PI).toFixed(2);
            paint();
            return;
        }
        if (drag) {
            const x = editing();
            x.dx = +(drag.dx + (e.clientX - drag.x) / S.zoom).toFixed(2);
            x.dy = +(drag.dy + (e.clientY - drag.y) / S.zoom).toFixed(2);
            paint();
        }
    });
    const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2)
        pinch = null; if (pts.size === 0) {
        drag = null;
        save();
    } };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("wheel", (e) => {
        e.preventDefault();
        const x = editing();
        if (e.altKey)
            x.rot = +(x.rot + (e.deltaY > 0 ? 1 : -1) * (S.step >= 1 ? S.step : 0.25)).toFixed(2);
        else
            x.scale = Math.max(0.2, Math.min(4, +(x.scale * (e.deltaY > 0 ? 1 / 1.03 : 1.03)).toFixed(4)));
        save();
        paint();
    }, { passive: false });
    window.addEventListener("keydown", (e) => {
        if (e.target?.tagName === "TEXTAREA")
            return;
        const k = e.key;
        if (k === "ArrowLeft")
            nudge(-1, 0);
        else if (k === "ArrowRight")
            nudge(1, 0);
        else if (k === "ArrowUp")
            nudge(0, -1);
        else if (k === "ArrowDown")
            nudge(0, 1);
        else
            return;
        e.preventDefault();
    });
    window.addEventListener("resize", paint);
    // ---- export
    const report = () => JSON.stringify({ frame: "spill-ship 256px sprite frame; dx/dy in frame px, rot in degrees, scale about the part's own centre",
        parts: Object.fromEntries(Object.entries(S.xf).map(([k, v]) => [k, { dx: v.dx, dy: v.dy, scale: v.scale, rot: v.rot }])),
        overrides: S.over }, null, 2);
    function openSheet() {
        const json = report();
        const sheet = el("div", "rg-sheet");
        const inner = el("div", "rg-sheetin");
        inner.append(el("h2", "", "Ship transforms"));
        const pre = el("pre", "rg-pre", json);
        inner.append(pre);
        const row = el("div", "rg-acts");
        const cp = el("button", "rg-act rg-go", "COPY JSON");
        cp.onclick = async () => { await copy(json); flash("copied"); };
        const dl = el("button", "rg-act", "DOWNLOAD");
        dl.onclick = () => {
            const b = new Blob([json], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = "spill-ship-transforms.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        };
        const paste = el("button", "rg-act", "PASTE");
        paste.onclick = () => {
            const raw = window.prompt("paste a transforms JSON");
            if (!raw)
                return;
            try {
                const d = JSON.parse(raw);
                S.xf = d.parts || {};
                S.over = d.overrides || {};
                save();
                sheet.remove();
                paint();
                flash("loaded");
            }
            catch {
                flash("not valid JSON");
            }
        };
        const clr = el("button", "rg-act rg-danger", "RESET ALL");
        clr.onclick = () => { S.xf = {}; S.over = {}; save(); sheet.remove(); paint(); flash("every part back to zero"); };
        const close = el("button", "rg-act", "CLOSE");
        close.onclick = () => sheet.remove();
        row.append(cp, dl, paste, clr, close);
        inner.append(row);
        sheet.append(inner);
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
            catch { /* leave it selected */ }
            setTimeout(() => ta.remove(), 200);
        }
    }
    syncChrome();
    paint();
    window.__ship = { S, paint, report };
}
