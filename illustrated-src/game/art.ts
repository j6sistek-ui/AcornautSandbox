export type ArtBank = {
  ready: boolean;
  squirrelIdle: HTMLImageElement[];
  squirrelFlap: HTMLImageElement[];
  acorn: HTMLImageElement[];
  golden: HTMLImageElement[];
  shield: HTMLImageElement[];
  planets: HTMLImageElement[];
  debris: HTMLImageElement[];
  pals: Record<string, HTMLImageElement>;
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

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

async function many(prefix: string, n: number, start = 1) {
  const out: HTMLImageElement[] = [];
  for (let i = 0; i < n; i++) out.push(await loadImg(`${prefix}${start + i}.png`));
  return out;
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
  const [squirrelIdle, squirrelFlap, acorn, golden, shield, planets, debris, sky, hero, ...palImgs] =
    await Promise.all([
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
  const pals: Record<string, HTMLImageElement> = {};
  palIds.forEach((id, i) => {
    pals[id] = palImgs[i] as HTMLImageElement;
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
    sky: sky as HTMLImageElement | null,
    hero: hero as HTMLImageElement | null,
  };
}
