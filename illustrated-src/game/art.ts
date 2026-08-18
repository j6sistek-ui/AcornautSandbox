import { ART_VER } from "./catalog";

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

async function many(prefix: string, n: number, start = 1) {
  const out: Sprite[] = [];
  for (let i = 0; i < n; i++)
    out.push(asSprite(await loadImg(`${prefix}${start + i}.png?v=${ART_VER}`)));
  return out;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spr: Sprite | HTMLImageElement | null | undefined,
  x: number,
  y: number,
  size: number,
  fit: "box" | "core" = "box",
) {
  if (!spr) return;
  const box = (spr as Sprite).box ?? { x: 0, y: 0, w: spr.width, h: spr.height };
  const core = (spr as Sprite).core;
  const dim = fit === "core" && core ? core : Math.max(box.w, box.h);
  const scale = size / Math.max(1, dim);
  const dw = box.w * scale;
  const dh = box.h * scale;
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

  const [squirrelIdle, squirrelFlap, acorn, golden, shield, planets, debris, sky, hero, pals, helmets, helmOver, suits, helms] =
    await Promise.all([
      many(`${base}/squirrel/idle-`, 4),
      many(`${base}/squirrel/flap-`, 4),
      many(`${base}/acorn/`, 4),
      many(`${base}/golden/`, 4),
      many(`${base}/shield/`, 4),
      many(`${base}/planets/`, 18, 0),
      many(`${base}/debris/`, 9, 0),
      optional(`${base}/sky.jpg`),
      optional(`${base}/hero.jpg`),
      named(palIds, "solo"),
      named(helmIds, "helmets"),
      named(helmIds, "helmets", "-over"),
      named(suitIds, "suits"),
      named(helmIds, "helms"),
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
  };
}

