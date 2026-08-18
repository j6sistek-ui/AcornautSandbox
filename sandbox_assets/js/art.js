import { ART_VER } from "./catalog.js?v=13";
export function artBase() {
    const raw = (typeof window !== "undefined" && window.__ACORNAUT_ART__) || "/art";
    return raw.replace(/\/$/, "");
}
export function artUrl(path) {
    const p = path.replace(/^\//, "");
    return `${artBase()}/${p}?v=${ART_VER}`;
}
function loadImg(src) {
    const url = src.includes("?") ? src : `${src}?v=${ART_VER}`;
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(src));
        img.src = url;
    });
}
function measureSprite(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx)
        return { box: { x: 0, y: 0, w, h }, core: Math.max(w, h) };
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let sx = 0;
    let sy = 0;
    let sn = 0;
    const solid = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * 4 + 3];
            if (a < 16)
                continue;
            if (x < minX)
                minX = x;
            if (y < minY)
                minY = y;
            if (x > maxX)
                maxX = x;
            if (y > maxY)
                maxY = y;
            if (a >= 80) {
                sx += x;
                sy += y;
                sn += 1;
                solid.push(x, y);
            }
        }
    }
    if (maxX < minX)
        return { box: { x: 0, y: 0, w, h }, core: Math.max(w, h) };
    const pad = 2;
    const box = {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(w, maxX - minX + 1 + pad * 2),
        h: Math.min(h, maxY - minY + 1 + pad * 2),
    };
    if (!sn)
        return { box, core: Math.max(box.w, box.h) };
    const cx = sx / sn;
    const cy = sy / sn;
    const dists = [];
    for (let i = 0; i < solid.length; i += 2) {
        const dx = solid[i] - cx;
        const dy = solid[i + 1] - cy;
        dists.push(Math.hypot(dx, dy));
    }
    dists.sort((a, b) => a - b);
    const r80 = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.8))];
    return { box, core: Math.max(8, r80 * 2) };
}
function asSprite(img) {
    const s = img;
    const m = measureSprite(img);
    s.box = m.box;
    s.core = m.core;
    return s;
}
async function many(prefix, n, start = 1) {
    const out = [];
    for (let i = 0; i < n; i++)
        out.push(asSprite(await loadImg(`${prefix}${start + i}.png`)));
    return out;
}
export function drawSprite(ctx, spr, x, y, size, fit = "box") {
    if (!spr)
        return;
    const box = spr.box ?? { x: 0, y: 0, w: spr.width, h: spr.height };
    const core = spr.core;
    const dim = fit === "core" && core ? core : Math.max(box.w, box.h);
    const scale = size / Math.max(1, dim);
    const dw = box.w * scale;
    const dh = box.h * scale;
    ctx.drawImage(spr, box.x, box.y, box.w, box.h, x - dw / 2, y - dh / 2, dw, dh);
}
export async function loadArt() {
    const base = artBase();
    const palIds = [
        "bee",
        "buddy",
        "ufo",
        "nutsack",
        "meteorcore",
        "cometsprite",
        "pocketmoon",
        "voidjelly",
        "starpup",
        "tinbot",
        "wisp",
    ];
    const helmIds = [
        "clear",
        "ion",
        "solar",
        "nebula",
        "lunar",
        "void",
        "comet",
        "cherry",
        "royal",
        "aurora",
        "meteor",
        "chrono",
    ];
    const suitIds = [
        "flight",
        "iontrim",
        "copper",
        "frost",
        "voidsuit",
        "aurorasuit",
        "ember",
        "stardust",
        "robo",
        "alien",
        "ghost",
        "bigbooty",
    ];
    const optional = (src) => loadImg(src).catch(() => null);
    async function named(ids, folder, suffix = "", required = false) {
        const out = {};
        await Promise.all(ids.map(async (id) => {
            const src = `${base}/${folder}/${id}${suffix}.png`;
            try {
                out[id] = asSprite(await loadImg(src));
            }
            catch (err) {
                if (required)
                    throw err;
            }
        }));
        return out;
    }
    const [squirrelIdle, squirrelFlap, acorn, golden, shield, planets, debris, sky, hero, pals, helmets, helmOver, suits] = await Promise.all([
        many(`${base}/squirrel/idle-`, 4),
        many(`${base}/squirrel/flap-`, 4),
        many(`${base}/acorn/`, 4),
        many(`${base}/golden/`, 4),
        many(`${base}/shield/`, 4),
        many(`${base}/planets/`, 18, 0),
        many(`${base}/debris/`, 9, 0),
        optional(`${base}/sky.jpg`),
        optional(`${base}/hero.jpg`),
        named(palIds, "cutouts", "", true),
        named(helmIds, "helmets"),
        named(helmIds, "helmets", "-over"),
        named(suitIds, "suits"),
    ]);
    return {
        ready: true,
        squirrelIdle,
        squirrelFlap,
        acorn,
        golden,
        shield,
        planets,
        debris,
        pals,
        helmets,
        helmOver,
        suits,
        sky: sky,
        hero: hero,
    };
}
