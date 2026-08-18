import { SKY_RGB, ENVS, HELMETS, PHYS, SUITS, TUT_ARM } from "./catalog.js?v=37";
import { drawTrailPreviewOn, drawPalOn } from "./cosmetics.js?v=37";
import { drawSprite, skyImage } from "./art.js?v=37";
function frameOf(list, t, speed = 6) {
    if (!list.length)
        return null;
    return list[Math.floor(t * speed) % list.length];
}
function liveGapY(p) {
    return p.gapY + Math.sin(p.drift) * p.driftAmp;
}
function applyWarp(ctx, w) {
    const lost = w.flight === "lost";
    const wp = w.warpT > 0 ? 1 - w.warpT : w.warpLeft > 0 || lost ? 1 : 0;
    if (wp <= 0)
        return;
    ctx.translate(w.W / 2, w.H / 2);
    const spin = w.warpT > 0 ? Math.sin(wp * Math.PI) * 2.6 : 0;
    ctx.rotate(w.prevTilt + (w.warpTilt - w.prevTilt) * wp + spin);
    const mFrom = w.prevMirror ? -1 : 1;
    const mTo = w.warpMirror ? -1 : 1;
    ctx.scale(mFrom + (mTo - mFrom) * wp, 1);
    ctx.translate(-w.W / 2, -w.H / 2);
}
function coverDraw(ctx, img, W, H) {
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    const scale = Math.max(W / Math.max(1, sw), H / Math.max(1, sh));
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
/** How bright the sky is right now, across an environment crossfade. */
export function skyLuma(w) {
    const lum = (id) => {
        const c = SKY_RGB[id] ?? [0.1, 0.1, 0.2];
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const a = lum(ENVS[w.envA].sky);
    const b = lum(ENVS[w.envB].sky);
    return a + (b - a) * w.envBlend;
}
function drawBackdrop(ctx, w, art) {
    const { W, H } = w;
    // each environment flies under its own painted sky; shifts crossfade
    const skyA = skyImage(ENVS[w.envA].sky);
    const skyB = skyImage(ENVS[w.envB].sky);
    const painted = skyB ?? skyA;
    if (painted) {
        coverDraw(ctx, skyA ?? painted, W, H);
        if (skyB && skyA && skyB !== skyA && w.envBlend > 0) {
            ctx.globalAlpha = w.envBlend;
            coverDraw(ctx, skyB, W, H);
            ctx.globalAlpha = 1;
        }
        // Readability scrim, scaled to how bright this sky is: a white
        // nebula gets a real veil so gates and debris stay readable against
        // it, a black void barely any. This is what stops the white-on-white
        // blindness without dulling the art everywhere.
        const lum = skyLuma(w);
        const veil = Math.max(0.16, Math.min(0.52, 0.16 + (lum - 0.2) * 0.62));
        ctx.fillStyle = `rgba(7,11,22,${veil.toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
    }
    else if (art.sky) {
        coverDraw(ctx, art.sky, W, H);
        ctx.fillStyle = "rgba(7,11,22,0.28)";
        ctx.fillRect(0, 0, W, H);
    }
    else {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#070b18");
        g.addColorStop(1, "#10182c");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
    const env = ENVS[w.envB];
    const envA = ENVS[w.envA];
    const blend = w.envBlend;
    const wash = env.wash.map((v, i) => envA.wash[i] + (v - envA.wash[i]) * blend);
    ctx.fillStyle = `rgba(${wash[0]},${wash[1]},${wash[2]},${wash[3]})`;
    ctx.beginPath();
    ctx.ellipse(W * 0.68, H * 0.28, W * 0.55, H * 0.28, 0.25, 0, Math.PI * 2);
    ctx.fill();
    const wash2 = env.wash2.map((v, i) => envA.wash2[i] + (v - envA.wash2[i]) * blend);
    ctx.fillStyle = `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${wash2[3]})`;
    ctx.beginPath();
    ctx.ellipse(W * 0.22, H * 0.78, W * 0.45, H * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // the environment owns the WHOLE sky, not two soft pools — a graded
    // full-screen tint makes each 20-gate shift unmistakable
    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.42, wash[3] * 1.9)})`);
    grade.addColorStop(0.55, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.2, wash[3] * 0.9)})`);
    grade.addColorStop(1, `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${Math.min(0.4, wash2[3] * 2.2)})`);
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);
    for (const s of w.stars) {
        ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(s.tw));
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}
export function drawWorld(ctx, w, save, art) {
    const { W, H } = w;
    ctx.save();
    if (w.shake > 0) {
        const mag = w.shake * 10;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    // Sky stays upright. Warp only tilts the playfield (live does the same).
    drawBackdrop(ctx, w, art);
    ctx.save();
    applyWarp(ctx, w);
    // Everything you can hit gets a separation halo keyed to the sky: a
    // dark drop shadow on bright skies, a faint light rim on dark ones.
    // Gates and debris then read as solid objects against any backdrop.
    const halo = skyLuma(w) > 0.42 ? "dark" : "light";
    for (const p of w.planets) {
        const gy = liveGapY(p);
        drawPlanet(ctx, art, p.x, gy - p.gap / 2 - p.r, p.r, p.topKind, halo);
        drawPlanet(ctx, art, p.x, gy + p.gap / 2 + p.r, p.r, p.botKind, halo);
        for (const b of p.blockers) {
            const by = b.y + Math.sin(p.drift) * p.driftAmp;
            const bx = p.x + b.xOff;
            const img = art.debris[b.debris];
            if (img)
                drawSprite(ctx, img, bx, by, b.r * 2, "core", halo);
            else
                drawPlanet(ctx, art, bx, by, b.r, b.kind, halo);
        }
    }
    for (const a of w.pickups) {
        if (a.got)
            continue;
        const y = a.y + Math.sin(a.bob) * 4;
        if (a.kind === "acorn")
            drawSprite(ctx, frameOf(art.acorn, w.time, 5), a.x, y, 28);
        else if (a.kind === "gold")
            drawSprite(ctx, frameOf(art.golden, w.time, 6), a.x, y, 32);
        else if (a.kind === "slow") {
            drawSprite(ctx, frameOf(art.acorn, w.time, 6), a.x, y, 28);
            ctx.strokeStyle = "rgba(110,240,255,0.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(a.x, y, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "rgba(110,240,255,0.35)";
            ctx.beginPath();
            ctx.arc(a.x, y, 20 + Math.sin(w.time * 6) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }
        else if (a.kind === "shield")
            drawSprite(ctx, frameOf(art.shield, w.time, 5), a.x, y, 34);
        else if (a.kind === "hole" || a.kind === "worm") {
            drawVortex(ctx, a.x, y, a.kind === "worm", w.time);
        }
    }
    for (const p of w.particles)
        drawParticle(ctx, p);
    const pal = w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo" || w.tut.stage === "ready")
        ? "buddy"
        : save.equippedPal;
    if (pal && pal !== "none") {
        const bob = Math.sin(w.time * 2.6) * 2;
        paintPal(ctx, art, pal, w.palPos.x, w.palPos.y + bob, 26);
    }
    drawPilot(ctx, w, save, art);
    // The shield and golden rings belong to the PILOT, so they must be
    // drawn inside the warp transform with him. Outside it they were laid
    // down in untransformed screen space, and in Lost in Space — where the
    // world rotates continuously — they drifted off on their own.
    if (w.invulnLeft > 0) {
        ctx.strokeStyle = `rgba(255,208,96,${0.35 + 0.25 * Math.sin(w.time * 10)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 30, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (w.shieldCharges > 0) {
        ctx.strokeStyle = "rgba(122,216,255,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 26, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
}
function drawVortex(ctx, x, y, worm, t) {
    const pulse = 12 + Math.sin(t * 6) * 3;
    const grd = ctx.createRadialGradient(x, y, 2, x, y, pulse + 14);
    grd.addColorStop(0, worm ? "#d8f6ff" : "#1a1028");
    grd.addColorStop(0.45, worm ? "#4ad8ff" : "#6a2a9a");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, pulse + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (worm ? 3 : -2.2));
    ctx.strokeStyle = worm ? "rgba(180,240,255,0.55)" : "rgba(180,90,255,0.45)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 6 + i * 5, i, i + 2.2);
        ctx.stroke();
    }
    ctx.restore();
}
function drawParticle(ctx, p) {
    const t = Math.max(0, p.life / p.max);
    ctx.globalAlpha = t;
    const kind = p.kind || "spark";
    if (kind === "ion") {
        ctx.strokeStyle = t > 0.5 ? "#c8f4ff" : "#3ac0f0";
        ctx.lineWidth = Math.max(0.8, p.r * t);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 9, p.y);
        ctx.stroke();
    }
    else if (kind === "bubble") {
        ctx.strokeStyle = "rgba(170,220,255,0.9)";
        ctx.lineWidth = 1;
        const br = t > 0.25 ? p.r : p.r * (1 + (0.25 - t) * 6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, br, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(200,235,255,0.25)";
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "bloom") {
        ctx.fillStyle = t > 0.5 ? "#f0b8ff" : "#a45cd8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (2 - t), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = t * 0.5;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "comet") {
        const len = 10 + p.r * 3;
        const grad = ctx.createLinearGradient(p.x, p.y, p.x + len, p.y);
        grad.addColorStop(0, "#fff8d0");
        grad.addColorStop(0.4, "#ff9d47");
        grad.addColorStop(1, "rgba(255,64,32,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, p.r * t);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + len, p.y);
        ctx.stroke();
    }
    else if (kind === "cometcore") {
        ctx.fillStyle = "#fff8d0";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "prism") {
        ctx.fillStyle = `hsl(${p.hue || 0} 90% 65%)`;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(((p.hue || 0) * Math.PI) / 180);
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        ctx.restore();
    }
    else if (kind === "plasma") {
        ctx.strokeStyle = "#b45cff";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const seed = p.seed || 1;
        ctx.lineTo(p.x + 8, p.y + Math.sin(seed) * 6);
        ctx.lineTo(p.x + 16, p.y - Math.cos(seed) * 4);
        ctx.stroke();
    }
    else if (kind === "plasmacore") {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "galaxy") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = t * 0.5;
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x - 0.6, p.y - 2.4, 1.2, 4.8);
        ctx.fillRect(p.x - 2.4, p.y - 0.6, 4.8, 1.2);
    }
    else if (kind === "aurora") {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.55;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 2.2, p.r * 0.7, 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "frost") {
        ctx.strokeStyle = "#9fe4ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.r);
        ctx.lineTo(p.x, p.y + p.r);
        ctx.moveTo(p.x - p.r, p.y);
        ctx.lineTo(p.x + p.r, p.y);
        ctx.stroke();
    }
    else if (kind === "voidsmoke") {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.6 - t), 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === "supernova") {
        ctx.fillStyle = t > 0.5 ? "#fff8d0" : t > 0.25 ? "#ff9d47" : "#ff4020";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.4 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
    }
    else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}
function drawPlanet(ctx, art, x, y, r, kind, halo) {
    const img = art.planets[kind % art.planets.length];
    if (img) {
        drawSprite(ctx, img, x, y, r * 2, "core", halo);
        return;
    }
    ctx.fillStyle = "#3a6aa8";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}
function hexRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// Where the glass dome sits in each 256px body render (x, y, radius),
// measured from the paintings themselves. Flight frames key by frame
// name, suit renders by suit id. The equipped helmet paints its
// identity — tinted glass, rim, glow — exactly onto the painted dome.
const DOME = {
    "idle-1": [191, 103, 51],
    "idle-2": [192, 103, 51],
    "idle-3": [192, 102, 53],
    "idle-4": [194, 99, 51],
    "flap-1": [166, 96, 52],
    "flap-2": [164, 93, 50],
    "flap-3": [164, 79, 48],
    "flap-4": [163, 80, 45],
    "suit:iontrim": [199, 97, 46],
    "suit:copper": [195, 97, 51],
    "suit:frost": [197, 96, 49],
    "suit:voidsuit": [192, 97, 50],
    "suit:aurorasuit": [195, 102, 54],
    "suit:ember": [192, 100, 49],
    "suit:stardust": [194, 97, 51],
    "suit:robo": [195, 97, 52],
    "suit:alien": [197, 102, 50],
    "suit:ghost": [191, 99, 49],
    "suit:bigbooty": [194, 86, 51],
};
// Where the GLASS circle sits inside each helmet-only render (x, y, r).
// All twelve helmets have a solo render; the tinted-ring path below
// stays as the fallback for any helmet added later.
const HELM_GLASS = {
    comet: [129, 129, 112],
    "clear": [129, 128, 111],
    "ion": [129, 128, 109],
    "solar": [146, 123, 94],
    "nebula": [129, 129, 112],
    "lunar": [129, 126, 112],
    "void": [125, 128, 108],
    "cherry": [126, 128, 109],
    "royal": [129, 156, 86],
    "aurora": [143, 116, 94],
    "meteor": [143, 116, 94],
    "chrono": [132, 126, 110],
};
// The real helmet art, its glass centre punched translucent once so the
// pilot's face shows through when it is composited onto the head.
const punchedCache = new Map();
function punchedHelm(spr, id) {
    const hit = punchedCache.get(id);
    if (hit)
        return hit;
    const g = HELM_GLASS[id];
    const c = document.createElement("canvas");
    c.width = spr.width;
    c.height = spr.height;
    const cc = c.getContext("2d");
    if (!cc || !g)
        return null;
    cc.drawImage(spr, 0, 0);
    const grad = cc.createRadialGradient(g[0], g[1], g[2] * 0.1, g[0], g[1], g[2] * 0.82);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(0.7, "rgba(0,0,0,0.3)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    cc.globalCompositeOperation = "destination-out";
    cc.fillStyle = grad;
    cc.fillRect(0, 0, c.width, c.height);
    cc.globalCompositeOperation = "source-over";
    punchedCache.set(id, c);
    return c;
}
function paintDome(ctx, body, key, helmet, x, y, size, art) {
    if (helmet.id === "clear")
        return; // the painted dome already reads clear
    const a = DOME[key];
    if (!a)
        return;
    const box = body.box ?? { x: 0, y: 0, w: body.width, h: body.height };
    const scale = size / Math.max(1, Math.max(box.w, box.h));
    const hx = x - (box.w * scale) / 2 + (a[0] - box.x) * scale;
    const hy = y - (box.h * scale) / 2 + (a[1] - box.y) * scale;
    const r = a[2] * scale;
    // the REAL helmet render sits on the head — scaled so its glass circle
    // matches the painted dome exactly
    const helmSpr = art?.helms?.[helmet.id];
    const g = HELM_GLASS[helmet.id];
    if (helmSpr && g) {
        const punched = punchedHelm(helmSpr, helmet.id);
        if (punched) {
            const s2 = (r * 1.04) / g[2];
            ctx.drawImage(punched, hx - g[0] * s2, hy - g[1] * s2, punched.width * s2, punched.height * s2);
            return;
        }
    }
    const v = hexRgb(helmet.visor);
    ctx.save();
    const grad = ctx.createRadialGradient(hx - r * 0.25, hy - r * 0.3, r * 0.2, hx, hy, r);
    grad.addColorStop(0, `rgba(${v.r},${v.g},${v.b},0.08)`);
    grad.addColorStop(0.7, `rgba(${v.r},${v.g},${v.b},0.26)`);
    grad.addColorStop(1, `rgba(${v.r},${v.g},${v.b},0.4)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    if (helmet.glow) {
        ctx.shadowColor = helmet.glow;
        ctx.shadowBlur = r * 0.55;
    }
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.strokeStyle = helmet.rim;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.97, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
function paintIllustrated(ctx, spr, x, y, size, helmet, suit, _t = 0, art, frameKey = "idle-1", sprNext, keyNext, blend = 0, halo = "dark") {
    // the equipped suit IS the body: its painted render replaces the
    // default flight frames, carried by the pilot's motion
    const suited = suit.id !== "flight" ? (art?.suits?.[suit.id] ?? null) : null;
    const body = suited ?? spr;
    if (!body)
        return;
    // frames crossfade instead of hard-switching — the four paintings blend
    // through each other so the cycle reads as motion, not a slideshow
    const f = suited ? 0 : blend;
    if (!suited && sprNext && f > 0.02) {
        const prevA = ctx.globalAlpha;
        ctx.globalAlpha = prevA * (1 - f);
        drawSprite(ctx, body, x, y, size);
        ctx.globalAlpha = prevA * f;
        drawSprite(ctx, sprNext, x, y, size);
        ctx.globalAlpha = prevA;
    }
    else {
        // the pilot's separation follows the sky like everything else — a
        // hardcoded dark halo left dark suits (the Void skin especially)
        // with no edge at all against a dark backdrop
        drawSprite(ctx, body, x, y, size, "box", halo);
    }
    if (suited) {
        paintDome(ctx, body, "suit:" + suit.id, helmet, x, y, size, art);
        return;
    }
    // the dome anchor glides between the two frames' measured positions
    const a1 = DOME[frameKey];
    const a2 = keyNext ? DOME[keyNext] : null;
    if (a1 && a2 && f > 0.02) {
        const mix = [
            a1[0] + (a2[0] - a1[0]) * f,
            a1[1] + (a2[1] - a1[1]) * f,
            a1[2] + (a2[2] - a1[2]) * f,
        ];
        DOME.__mix = mix;
        paintDome(ctx, body, "__mix", helmet, x, y, size, art);
        delete DOME.__mix;
    }
    else {
        paintDome(ctx, body, frameKey, helmet, x, y, size, art);
    }
}
function drawPilot(ctx, w, save, art) {
    const x = w.W * PHYS.squirrelX;
    const y = w.squirrel.y;
    const suit = SUITS.find((s) => s.id === save.equippedSuit) ?? SUITS[0];
    const helm = HELMETS.find((h) => h.id === save.equipped) ?? HELMETS[0];
    // The repainted flap frames are one coherent character, so the tap
    // cycles them again — plus a soft nose-up kick and scale pop for punch.
    const flapping = w.flapBoost > 0;
    const frames = flapping ? art.squirrelFlap : art.squirrelIdle;
    const speed = flapping ? 10 : 5;
    const ft = w.time * speed;
    const idx = frames.length ? Math.floor(ft) % frames.length : 0;
    const nxt = frames.length ? (idx + 1) % frames.length : 0;
    // smoothstep eases the crossfade so each pose still gets its moment
    const fr = ft - Math.floor(ft);
    const blend = fr * fr * (3 - 2 * fr);
    const spr = frames[idx] ?? null;
    const frameKey = (flapping ? "flap-" : "idle-") + (idx + 1);
    const keyNext = (flapping ? "flap-" : "idle-") + (nxt + 1);
    ctx.save();
    ctx.translate(x, y);
    // the sim's real pitch — dives nose down, bounces kick the body over;
    // the old ±6° bank made every impact read as nothing happening
    const bank = w.squirrel.rot * 0.8;
    const kick = Math.min(1, Math.max(0, w.flapBoost) / 0.22);
    ctx.rotate(bank - kick * 0.12);
    const pop = 1 + kick * 0.05;
    ctx.scale(pop, pop);
    // fresh planet bounce: a squash-and-stretch pulse sells the impact
    const sq = Math.max(0, (w.hitCooldown - 0.33) / 0.22);
    if (sq > 0)
        ctx.scale(1 + sq * 0.16, 1 - sq * 0.2);
    paintIllustrated(ctx, spr, 0, 2, 52, helm, suit, w.time, art, frameKey, frames[nxt] ?? null, keyNext, blend, skyLuma(w) > 0.42 ? "dark" : "light");
    ctx.restore();
}
function paintPal(ctx, art, id, x, y, size) {
    const spr = art?.pals?.[id];
    if (spr) {
        // box fit, not core: companions are sidekicks, smaller than the pilot
        drawSprite(ctx, spr, x, y, size);
        return;
    }
    if (id !== "none") {
        // no painted portrait for this companion — the vector renderer from
        // the live game draws it (comet sprite, nebula wisp)
        drawPalOn(ctx, id, x, y, size / 32, performance.now() / 1000);
        return;
    }
    if (id === "none") {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2, y + size * 0.2);
        ctx.lineTo(x + size * 0.2, y - size * 0.2);
        ctx.stroke();
    }
}
export function paintPortrait(ctx, art, helmet, suit, cx, cy, size, _t = 0) {
    const painted = art?.helmets?.[helmet.id];
    if (suit.id === "flight" && painted) {
        // every helmet painting is a hi-res render with its identity baked in
        drawSprite(ctx, painted, cx, cy + 2, size);
        return;
    }
    const body = art?.suits?.[suit.id] ?? art?.squirrelIdle?.[0];
    if (!body)
        return;
    drawSprite(ctx, body, cx, cy + 2, size);
    const key = art?.suits?.[suit.id] ? "suit:" + suit.id : "idle-1";
    paintDome(ctx, body, key, helmet, cx, cy + 2, size, art);
}
export function paintPalPreview(ctx, art, id, cx, cy, size) {
    paintPal(ctx, art, id, cx, cy, size);
}
export function paintTrailPreview(ctx, trail, cx, cy, t = 0) {
    drawTrailPreviewOn(ctx, trail.id, cx, cy, t);
}
/** The vortex that eats the screen while a black hole or wormhole
 *  takes hold — spiral arms winding in, a dark core, a colour bloom.
 *  Purely procedural: no art needed. */
function drawSwirl(ctx, w) {
    const { W, H } = w;
    const t = 1 - w.warpT; // 0 -> 1 over the transition
    const worm = w.warpKind === "worm" || w.flight === "lost";
    const cx = W / 2;
    const cy = H * 0.46;
    const reach = Math.hypot(W, H) * 0.62;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const hue = worm ? [110, 240, 216] : [192, 132, 252];
    ctx.save();
    // colour bloom washing over the sky
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
    bloom.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.55 * ease).toFixed(3)})`);
    bloom.addColorStop(0.55, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.16 * ease).toFixed(3)})`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);
    // spiral arms
    ctx.translate(cx, cy);
    ctx.rotate(t * Math.PI * 2.4 * (worm ? -1 : 1));
    ctx.lineCap = "round";
    for (let a = 0; a < 5; a++) {
        ctx.beginPath();
        const off = (a / 5) * Math.PI * 2;
        for (let k = 0; k <= 42; k++) {
            const f = k / 42;
            const rad = reach * (0.06 + f * 0.95) * (1 - ease * 0.45);
            const ang = off + f * 4.4;
            const px = Math.cos(ang) * rad;
            const py = Math.sin(ang) * rad * 0.92;
            if (k === 0)
                ctx.moveTo(px, py);
            else
                ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.5 * ease).toFixed(3)})`;
        ctx.lineWidth = 2 + 5 * ease;
        ctx.stroke();
    }
    // the core opens up and swallows the middle
    const coreR = reach * 0.30 * ease;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, coreR));
    core.addColorStop(0, `rgba(4,2,10,${(0.96 * ease).toFixed(3)})`);
    core.addColorStop(0.72, `rgba(8,4,20,${(0.7 * ease).toFixed(3)})`);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, coreR), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${(0.5 * ease).toFixed(3)})`;
    ctx.lineWidth = 1.5 + 2 * ease;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, coreR * 1.04), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
export function drawHud(ctx, w) {
    const { W } = w;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 36px Figtree, system-ui";
    ctx.fillText(String(w.score), W / 2, 46);
    if (w.envMsgT > 0) {
        ctx.globalAlpha = Math.min(1, w.envMsgT);
        ctx.fillStyle = "rgba(232,164,74,0.95)";
        ctx.font = "700 12px Figtree, system-ui";
        ctx.fillText(ENVS[w.envB].name, W / 2, 66);
        ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
    ctx.font = "700 14px Figtree, system-ui";
    ctx.fillStyle = "#ffd080";
    ctx.fillText(`${w.runAcorns}`, 36, 28);
    if (w.shieldCharges > 0) {
        for (let i = 0; i < w.shieldCharges; i++) {
            ctx.fillStyle = "rgba(122,216,255,0.9)";
            ctx.beginPath();
            ctx.arc(W - 22 - i * 16, 26, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    // status lines stack instead of colliding — mode line first, then any
    // live power-ups beneath it
    let hudY = 88;
    const hudLine = (text, color) => {
        ctx.textAlign = "center";
        ctx.fillStyle = color;
        ctx.font = "700 13px Figtree, system-ui";
        ctx.fillText(text, W / 2, hudY);
        hudY += 18;
    };
    if (w.warpLeft > 0)
        hudLine((w.flight === "deep" ? "SHIFT  " : "BLACK HOLE  ") + Math.ceil(w.warpLeft) + "s", "#c084fc");
    else if (w.flight === "deep" && w.warpT <= 0)
        hudLine("FIRST SHIFT IN " + Math.ceil(Math.max(0, 10 - w.deepTimer)) + "s", "rgba(192,132,252,0.8)");
    if (w.powerLeft > 0)
        hudLine(`SLOW  ${Math.ceil(w.powerLeft)}s`, "#6ef0ff");
    if (w.invulnLeft > 0)
        hudLine(`GOLD  ${Math.ceil(w.invulnLeft)}s`, "#ffd060");
    if (w.recoveryMsg) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "800 15px Figtree, system-ui";
        ctx.fillText(w.recoveryMsg, W / 2, w.H * 0.22);
    }
    if (w.warpT > 0) {
        drawSwirl(ctx, w);
        ctx.textAlign = "center";
        ctx.fillStyle = w.warpKind === "worm" || w.flight === "lost" ? "#6ef0d8" : "#c084fc";
        ctx.font = "800 22px Figtree, system-ui";
        ctx.fillText(w.warpKind === "worm" || w.flight === "lost" ? "WORMHOLE!" : "BLACK HOLE!", W / 2, w.H * 0.3);
    }
    if (w.ready && !w.tut) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "700 18px Figtree, system-ui";
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(w.time * 4);
        ctx.fillText("TAP TO FLY", W / 2, w.H * 0.38);
        ctx.globalAlpha = 1;
    }
    if (w.tut?.hold) {
        const st = w.tut.stage;
        const title = st === "tap" ? "TAP"
            : st === "tap2" ? "TAP AGAIN"
                : st === "swipe" ? "SWIPE DOWN"
                    : st === "yourturn" ? "YOUR TURN!"
                        : "A COMPANION APPEARS!";
        const body = st === "tap" ? "anywhere — a boost upward"
            : st === "tap2" ? "one more boost — then just watch"
                : st === "swipe" ? "dive back down and make the gap"
                    : st === "yourturn" ? "fly the gaps · grab the acorns"
                        : "The Acorn Buddy reels in nearby acorns.";
        drawPrompt(ctx, w, title, body, st === "swipe" ? w.H * 0.58 : w.H * 0.36);
        if (w.tut.nudge) {
            ctx.fillStyle = "#ffd080";
            ctx.font = "700 13px Figtree, system-ui";
            ctx.textAlign = "center";
            ctx.fillText(w.tut.nudge, W / 2, w.H * 0.68);
        }
    }
    else if (w.tut?.stage === "glide" || w.tut?.stage === "bounce") {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffb84d";
        ctx.font = "800 14px Figtree, system-ui";
        ctx.fillText(w.tut.stage === "bounce" ? "BOING! PLANETS BOUNCE YOU"
            : "PLANET AHEAD — LAND ON IT", W / 2, 86);
    }
    else if (w.tut?.stage === "dive") {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffb84d";
        ctx.font = "800 14px Figtree, system-ui";
        ctx.fillText("MAKE THE GAP", W / 2, 86);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "700 12px Figtree, system-ui";
        ctx.fillText("a tap levels you off", W / 2, 104);
    }
    else if (w.tut?.stage === "gates" || w.tut?.stage === "palDemo") {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(243,239,228,0.8)";
        ctx.font = "700 13px Figtree, system-ui";
        ctx.fillText(w.tut.stage === "gates" ? "FLY THE GAPS  ·  GRAB THE ACORNS" : "WATCH THE MAGNET", W / 2, 86);
    }
    else if (w.tut?.stage === "ready") {
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "800 20px Figtree, system-ui";
        ctx.fillText("YOU'RE READY, PILOT", W / 2, w.H * 0.3);
    }
}
function drawPrompt(ctx, w, title, body, cy) {
    const bw = Math.min(320, w.W - 40);
    const bh = 108;
    ctx.fillStyle = "rgba(12,18,36,0.82)";
    ctx.strokeStyle = "rgba(232,164,74,0.45)";
    ctx.lineWidth = 1.5;
    round(ctx, w.W / 2 - bw / 2, cy - bh / 2, bw, bh, 16);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 16px Figtree, system-ui";
    ctx.fillText(title, w.W / 2, cy - 8);
    ctx.fillStyle = "rgba(243,239,228,0.72)";
    ctx.font = "600 12px Figtree, system-ui";
    ctx.fillText(body, w.W / 2, cy + 16);
    if (w.tut?.hold) {
        const armA = Math.max(0, Math.min(1, (w.tut.t - TUT_ARM) / 0.3));
        if (armA > 0) {
            ctx.globalAlpha = armA * (0.7 + 0.3 * Math.sin(w.time * 4));
            ctx.fillStyle = w.tut.stage === "swipe" ? "#ffb84d" : "#6ef0ff";
            ctx.font = "700 12px Figtree, system-ui";
            ctx.fillText(w.tut.stage === "swipe" ? "try it now"
                : w.tut.stage === "yourturn" ? "tap to begin" : "tap to continue", w.W / 2, cy + 36);
            ctx.globalAlpha = 1;
        }
    }
}
function round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
