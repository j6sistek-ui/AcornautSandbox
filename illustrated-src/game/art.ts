import { DEBRIS_COUNT, PLANET_COUNT, ART_VER } from "./catalog";

export type Box = { x: number; y: number; w: number; h: number };

export type Sprite = HTMLImageElement & { box: Box; core: number };

export type ArtBank = {
  ready: boolean;
  squirrelIdle: Sprite[];
  squirrelFlap: Sprite[];
  acorn: Sprite[];
  golden: Sprite[];
  shield: Sprite[];
  planets: Sprite[];
  debris: Sprite[];
  pals: Record<string, Sprite>;
  helms: Record<string, Sprite>;
  helmets: Record<string, Sprite>;
  helmOver: Record<string, Sprite>;
  suits: Record<string, Sprite>;
  sky: HTMLImageElement | null;
  hero: HTMLImageElement | null;
  arcadeAcorn: Sprite | null;
  frozen: Sprite | null;
  shieldnut: Sprite | null;
};

declare global {
  interface Window {
    __ACORNAUT_ART__?: string;
  }
}

export function artBase() {
  const raw = (typeof window !== "undefined" && window.__ACORNAUT_ART__) || "/art";
  return raw.replace(/\/$/, "");
}

export function artUrl(path: string) {
  const p = path.replace(/^\//, "");
  return `${artBase()}/${p}?v=${ART_VER}`;
}

function loadImg(src: string) {
  const url = src.includes("?") ? src : `${src}?v=${ART_VER}`;
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = url;
  });
}

function measureSprite(img: HTMLImageElement): { box: Box; core: number } {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { box: { x: 0, y: 0, w, h }, core: Math.max(w, h) };
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let sx = 0;
  let sy = 0;
  let sn = 0;
  const solid: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (a >= 80) {
        sx += x;
        sy += y;
        sn += 1;
        solid.push(x, y);
      }
    }
  }
  if (maxX < minX) return { box: { x: 0, y: 0, w, h }, core: Math.max(w, h) };
  const pad = 2;
  const box: Box = {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX - minX + 1 + pad * 2),
    h: Math.min(h, maxY - minY + 1 + pad * 2),
  };
  if (!sn) return { box, core: Math.max(box.w, box.h) };
  const cx = sx / sn;
  const cy = sy / sn;
  const dists: number[] = [];
  for (let i = 0; i < solid.length; i += 2) {
    const dx = solid[i] - cx;
    const dy = solid[i + 1] - cy;
    dists.push(Math.hypot(dx, dy));
  }
  dists.sort((a, b) => a - b);
  const r80 = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.8))];
  return { box, core: Math.max(8, r80 * 2) };
}

function asSprite(img: HTMLImageElement): Sprite {
  const s = img as Sprite;
  const m = measureSprite(img);
  s.box = m.box;
  s.core = m.core;
  return s;
}

// One missing file must never sink the bank: a 404 among sixty-odd
// sprites used to reject loadArt, and the game then drew NOTHING at all.
async function many(prefix: string, n: number, start = 1) {
  const out: Sprite[] = [];
  const loaded = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      loadImg(`${prefix}${start + i}.png?v=${ART_VER}`)
        .then(asSprite)
        .catch(() => null),
    ),
  );
  for (const s of loaded) if (s) out.push(s);
  return out;
}

/** An empty bank the renderer can draw with immediately — every draw
 *  path already null-guards, so the game paints from the first frame
 *  instead of waiting on megabytes of panorama. */
export function emptyArt(): ArtBank {
  return {
    ready: false,
    squirrelIdle: [], squirrelFlap: [], acorn: [], golden: [], shield: [],
    planets: [], debris: [], pals: {}, helms: {}, helmets: {}, helmOver: {},
    suits: {}, sky: null, hero: null, arcadeAcorn: null, frozen: null, shieldnut: null,
  };
}

// Painted skies load ON DEMAND — a run only ever needs the handful of
// environments it flies through, so the first paint is never held up by
// two megabytes of panorama. Until one arrives the gradient stands in.
const skyCache = new Map<string, HTMLImageElement | null>();
export function skyImage(id: string): HTMLImageElement | null {
  const hit = skyCache.get(id);
  if (hit !== undefined) return hit;
  skyCache.set(id, null);
  loadImg(artUrl(`skies/${id}.jpg`))
    .then((img) => skyCache.set(id, img))
    .catch(() => skyCache.set(id, null));
  return null;
}

// A separation halo, baked ONCE per sprite per mode. Doing this with a
// live ctx.shadowBlur cost a blur on every gate and every rock, every
// frame — a phone-framerate killer. Baked, it is one extra drawImage.
const HALO_PAD = 20;
const haloCache = new Map<string, HTMLCanvasElement | null>();
function haloOf(spr: Sprite | HTMLImageElement, mode: "dark" | "light") {
  const key = (spr.src || "") + "|" + mode;
  const hit = haloCache.get(key);
  if (hit !== undefined) return hit;
  const c = document.createElement("canvas");
  c.width = spr.width + HALO_PAD * 2;
  c.height = spr.height + HALO_PAD * 2;
  const cc = c.getContext("2d");
  if (!cc) {
    haloCache.set(key, null);
    return null;
  }
  // one soft pass, not two hard ones: doubled up at 0.9 alpha this read
  // as a drawn ring around every planet rather than separation
  cc.shadowColor = mode === "dark" ? "rgba(5,8,16,0.5)" : "rgba(170,200,255,0.28)";
  cc.shadowBlur = mode === "dark" ? 24 : 16;
  cc.shadowOffsetX = c.width * 2;               // keep only the shadow
  cc.drawImage(spr, HALO_PAD - c.width * 2, HALO_PAD);
  haloCache.set(key, c);
  return c;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spr: Sprite | HTMLImageElement | null | undefined,
  x: number,
  y: number,
  size: number,
  fit: "box" | "core" = "box",
  halo?: "dark" | "light",
) {
  if (!spr) return;
  const box = (spr as Sprite).box ?? { x: 0, y: 0, w: spr.width, h: spr.height };
  const core = (spr as Sprite).core;
  const dim = fit === "core" && core ? core : Math.max(box.w, box.h);
  const scale = size / Math.max(1, dim);
  const dw = box.w * scale;
  const dh = box.h * scale;
  if (halo) {
    const h = haloOf(spr, halo);
    if (h) {
      const m = HALO_PAD * scale;
      ctx.drawImage(
        h, box.x, box.y, box.w + HALO_PAD * 2, box.h + HALO_PAD * 2,
        x - dw / 2 - m, y - dh / 2 - m, dw + m * 2, dh + m * 2,
      );
    }
  }
  ctx.drawImage(spr, box.x, box.y, box.w, box.h, x - dw / 2, y - dh / 2, dw, dh);
}

export async function loadArt(): Promise<ArtBank> {
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
    "catbubble",
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
    "catsuit",
  ];
  const optional = (src: string) => loadImg(src).catch(() => null);

  async function named(ids: string[], folder: string, suffix = "", required = false) {
    const out: Record<string, Sprite> = {};
    await Promise.all(
      ids.map(async (id) => {
        const src = `${base}/${folder}/${id}${suffix}.png?v=${ART_VER}`;
        try {
          out[id] = asSprite(await loadImg(src));
        } catch (err) {
          if (required) throw err;
        }
      }),
    );
    return out;
  }

  const [squirrelIdle, squirrelFlap, acorn, golden, shield, planets, debris, sky, hero, pals, helmets, helmOver, suits, helms, arcadeAcorn, frozen, shieldnut] =
    await Promise.all([
      many(`${base}/squirrel/idle-`, 4),
      many(`${base}/squirrel/flap-`, 4),
      many(`${base}/acorn/`, 4),
      many(`${base}/golden/`, 4),
      many(`${base}/shield/`, 4),
      many(`${base}/planets/`, PLANET_COUNT, 0),
      many(`${base}/debris/`, DEBRIS_COUNT, 0),
      optional(`${base}/sky.jpg`),
      optional(`${base}/hero.jpg`),
      named(palIds, "solo"),
      named(helmIds, "helmets"),
      named(helmIds, "helmets", "-over"),
      named(suitIds, "suits"),
      named(helmIds, "helms"),
      optional(`${base}/acorn/arcade.png?v=${ART_VER}`),
      optional(`${base}/pickups/frozen.png?v=${ART_VER}`),
      optional(`${base}/pickups/shieldnut.png?v=${ART_VER}`),
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
    helms,
    helmets,
    helmOver,
    suits,
    sky: sky as HTMLImageElement | null,
    hero: hero as HTMLImageElement | null,
    arcadeAcorn: arcadeAcorn ? asSprite(arcadeAcorn as HTMLImageElement) : null,
    frozen: frozen ? asSprite(frozen as HTMLImageElement) : null,
    shieldnut: shieldnut ? asSprite(shieldnut as HTMLImageElement) : null,
  };
}

