export function artBase() {
    const raw = (typeof window !== "undefined" && window.__ACORNAUT_ART__) || "/art";
    return raw.replace(/\/$/, "");
}
function loadImg(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(src));
        img.src = src;
    });
}
async function many(prefix, n, start = 1) {
    const out = [];
    for (let i = 0; i < n; i++)
        out.push(await loadImg(`${prefix}${start + i}.png`));
    return out;
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
    const [squirrelIdle, squirrelFlap, acorn, golden, shield, planets, debris, sky, hero, ...palImgs] = await Promise.all([
        many(`${base}/squirrel/idle-`, 4),
        many(`${base}/squirrel/flap-`, 4),
        many(`${base}/acorn/`, 4),
        many(`${base}/golden/`, 4),
        many(`${base}/shield/`, 4),
        many(`${base}/planets/`, 18, 0),
        many(`${base}/debris/`, 9, 0),
        loadImg(`${base}/sky.jpg`).catch(() => null),
        loadImg(`${base}/hero.jpg`).catch(() => null),
        ...palIds.map((id) => loadImg(`${base}/pals/${id}.png`)),
    ]);
    const pals = {};
    palIds.forEach((id, i) => {
        pals[id] = palImgs[i];
    });
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
        sky: sky,
        hero: hero,
    };
}
