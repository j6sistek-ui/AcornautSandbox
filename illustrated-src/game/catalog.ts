export const GAME_VERSION = "v1.2.0-illust";
export const ART_VER = "43";
export const BUILD = `Illustrated · sandbox v${ART_VER}`;
export const SAVE_KEY = "acornaut_illust_v1";
export const LEGACY_KEYS = ["acornaut_beta", "acornaut_v2"];
export const TUT_ARM = 1.25;


export const PHYS = {
  gravity: 1300,
  flap: -450,
  dive: 380,
  bounceCancel: 210,
  squirrelX: 0.18,
  baseSpeed: 165,
  maxSpeed: 280,
  gapBase: 168,
  gapMin: 132,
  planetR: 42,
  powerDuration: 3.5,
  slowFactor: 0.42,
  goldDuration: 10,
  overdriveGate: 100,
  overdriveSpan: 50,
  magnetR: 200,
  squirrelR: 16,
};

export const NEWS = [
  "v14: one painted pal per card. No sheet scraps.",
  "Golden acorns still bounce off planets. Debris phases.",
  "PILOT LEVELS: every run earns XP. Modes, mods, pals",
  "and titles unlock on the FLIGHT LOG.",
  "Debris kills. Planets bounce. Swipe cancels a bounce.",
];


export type Helmet = {
  id: string;
  name: string;
  cost: number;
  visor: string;
  tint: number;
  rim: string;
  trim: string;
  glow: string | null;
  ears?: boolean;
};

export const HELMETS: Helmet[] = [
  { id: "clear", name: "Clear", cost: 0, visor: "#bcd8f4", tint: 0.16, rim: "#cfd8e4", trim: "#8fa0b4", glow: null },
  { id: "ion", name: "Ion", cost: 15, visor: "#4ad8ff", tint: 0.2, rim: "#4ad8ff", trim: "#1b6f92", glow: "#4ad8ff" },
  { id: "solar", name: "Solar", cost: 30, visor: "#ffc46b", tint: 0.2, rim: "#ffb040", trim: "#a86a18", glow: "#ffa32e" },
  { id: "nebula", name: "Nebula", cost: 50, visor: "#c86bff", tint: 0.22, rim: "#e070ff", trim: "#6a2a9a", glow: "#c060ff" },
  { id: "lunar", name: "Lunar", cost: 70, visor: "#d8e2f0", tint: 0.18, rim: "#b6c2d4", trim: "#6f7c8e", glow: "#cfe0ff" },
  { id: "void", name: "Void", cost: 90, visor: "#2a2438", tint: 0.3, rim: "#d4af37", trim: "#1a1622", glow: "#a855f7" },
  { id: "comet", name: "Comet", cost: 120, visor: "#ff8a4a", tint: 0.2, rim: "#ff6a28", trim: "#8a2f0c", glow: "#ff7a30" },
  { id: "cherry", name: "Cherry", cost: 150, visor: "#ff9ec4", tint: 0.2, rim: "#ff8ab0", trim: "#a83a68", glow: "#ff7ab0" },
  { id: "royal", name: "Royal", cost: 200, visor: "#7fe0cf", tint: 0.18, rim: "#d4af37", trim: "#8a6a12", glow: "#ffd76a" },
  { id: "aurora", name: "Aurora", cost: 300, visor: "#4de8b8", tint: 0.18, rim: "#57e6c2", trim: "#1c7a5e", glow: "#5dffd0" },
  { id: "meteor", name: "Meteor", cost: 400, visor: "#c98a4e", tint: 0.2, rim: "#b5713a", trim: "#6e3f18", glow: "#ff9d47" },
  { id: "chrono", name: "Chrono", cost: 500, visor: "#e8d9a8", tint: 0.16, rim: "#c9a94f", trim: "#7a6428", glow: "#ffe27a" },
  { id: "catbubble", name: "Cat Ears", cost: 350, visor: "#cfe0ee", tint: 0.16, rim: "#c8d2dc", trim: "#8a94a0", glow: null, ears: true },
];

export type Suit = {
  id: string;
  name: string;
  cost: number;
  fur: string;
  furDark: string;
  belly: string;
  suit: string;
  suitLite: string;
  suitDark: string;
  trim: string;
  glow: string | null;
  dust: string | null;
  robo?: boolean;
  alien?: boolean;
  ghost?: boolean;
  booty?: boolean;
  cat?: boolean;
};

export const SUITS: Suit[] = [
  { id: "flight", name: "Flight", cost: 0, fur: "#d98f3d", furDark: "#a8641f", belly: "#f7e0bb", suit: "#c8762c", suitLite: "#eda85a", suitDark: "#8a4c14", trim: "#f6cf8a", glow: null, dust: null },
  { id: "iontrim", name: "Ion", cost: 22, fur: "#d98f3d", furDark: "#a8641f", belly: "#f7e0bb", suit: "#1b3f5c", suitLite: "#3d7fa8", suitDark: "#0e2436", trim: "#4ad8ff", glow: "#4ad8ff", dust: "#8fe9ff" },
  { id: "copper", name: "Copper", cost: 48, fur: "#a85f28", furDark: "#663409", belly: "#e6bd83", suit: "#8c4718", suitLite: "#f2ab62", suitDark: "#421f06", trim: "#ffdda8", glow: "#ff8a2a", dust: "#ffb45c" },
  { id: "frost", name: "Frost", cost: 80, fur: "#e2ecf6", furDark: "#a9bccf", belly: "#ffffff", suit: "#6f9dc4", suitLite: "#a9d4ef", suitDark: "#40688a", trim: "#eaf7ff", glow: "#9fe4ff", dust: "#dff5ff" },
  { id: "voidsuit", name: "Void", cost: 180, fur: "#544a63", furDark: "#312a3d", belly: "#8d7fa0", suit: "#241d33", suitLite: "#4f4270", suitDark: "#100c18", trim: "#d4af37", glow: "#b45cff", dust: "#e7b6ff" },
  { id: "aurorasuit", name: "Aurora", cost: 250, fur: "#cf8a3c", furDark: "#9c5f1d", belly: "#f4ddb4", suit: "#0f5c4c", suitLite: "#2fae8f", suitDark: "#073a2f", trim: "#5dffd0", glow: "#5dffd0", dust: "#a8ffe8" },
  { id: "ember", name: "Ember", cost: 325, fur: "#b5722f", furDark: "#7c481a", belly: "#eccb96", suit: "#3a2a26", suitLite: "#7a4a3a", suitDark: "#1e1412", trim: "#ff7a2e", glow: "#ff5a1e", dust: "#ffb066" },
  { id: "stardust", name: "Stardust", cost: 400, fur: "#c8873f", furDark: "#94601f", belly: "#f2dcb2", suit: "#1a2560", suitLite: "#3d4fa8", suitDark: "#0c1233", trim: "#ffd76a", glow: "#8fb8ff", dust: "#fff3b8" },
  { id: "robo", name: "Robo", cost: 500, robo: true, fur: "#9aa6b4", furDark: "#525d6c", belly: "#cfd8e2", suit: "#37414f", suitLite: "#7f93a6", suitDark: "#1d242e", trim: "#35e0ff", glow: "#35e0ff", dust: "#9be8ff" },
  { id: "alien", name: "Alien", cost: 650, alien: true, fur: "#7ed957", furDark: "#3e8a2a", belly: "#d6f7b0", suit: "#2e6b5a", suitLite: "#57b09a", suitDark: "#173a2e", trim: "#c8ff6a", glow: "#7dff4d", dust: "#b6ff8a" },
  { id: "ghost", name: "Ghost", cost: 800, ghost: true, fur: "#dfe9f5", furDark: "#9fb4cf", belly: "#ffffff", suit: "#b9c8e0", suitLite: "#e8f0fb", suitDark: "#7f93b3", trim: "#bfe9ff", glow: "#9fd8ff", dust: "#dff2ff" },
  { id: "bigbooty", name: "Big Booty", cost: 1000, booty: true, fur: "#e09a45", furDark: "#a86a1f", belly: "#ffe9c4", suit: "#8a3fd4", suitLite: "#b876ff", suitDark: "#54258c", trim: "#ffd23f", glow: "#ffb84d", dust: "#ffe08a" },
  { id: "catsuit", name: "Cat", cost: 750, cat: true, fur: "#e0863a", furDark: "#a85a1f", belly: "#f3d5a8", suit: "#d1712a", suitLite: "#f0a256", suitDark: "#8a4413", trim: "#cfd8e0", glow: null, dust: null },
];

export type Trail = { id: string; name: string; cost: number; colors: string[] };

export const TRAILS: Trail[] = [
  { id: "sparks", name: "Rocket Sparks", cost: 0, colors: ["#ffe080", "#ff8030", "#ff4020"] },
  { id: "ion", name: "Ion Stream", cost: 60, colors: ["#b8f4ff", "#4ad8ff", "#1b6f92"] },
  { id: "bubble", name: "Bubble Jets", cost: 90, colors: ["#d8f6ff", "#7ad8ff", "#3aa0c8"] },
  { id: "bloom", name: "Nebula Bloom", cost: 120, colors: ["#ffb0ff", "#c060ff", "#6a2a9a"] },
  { id: "comet", name: "Comet Booster", cost: 200, colors: ["#ffd060", "#ff6a28", "#8a2f0c"] },
  { id: "prism", name: "Prism Shards", cost: 260, colors: ["#ff6ad2", "#6affd2", "#6ad2ff"] },
  { id: "plasma", name: "Plasma Arc", cost: 320, colors: ["#f4e8ff", "#b45cff", "#4a2080"] },
  { id: "galaxy", name: "Galaxy Dust", cost: 400, colors: ["#fff3b8", "#8fb8ff", "#3d4fa8"] },
  { id: "aurora", name: "Aurora Ribbon", cost: 460, colors: ["#5dffd0", "#7fe0cf", "#c86bff"] },
  { id: "frost", name: "Frostbite", cost: 520, colors: ["#eaf7ff", "#9fe4ff", "#6f9dc4"] },
  { id: "voidsmoke", name: "Void Smoke", cost: 580, colors: ["#c8b8e0", "#4f4270", "#241d33"] },
  { id: "supernova", name: "Supernova", cost: 650, colors: ["#fff8d0", "#ff9d47", "#ff4020"] },
];

export type Pal = {
  id: string;
  name: string;
  tag: string;
  desc: string;
  art?: string;
};

export const PALS: Pal[] = [
  { id: "none", name: "None", tag: "SOLO", desc: "Fly solo. The classic run." },
  { id: "bee", name: "Astro Bee", tag: "VANILLA", desc: "Nothing extra spawns. Pure flying.", art: "bee" },
  { id: "buddy", name: "Acorn Buddy", tag: "MAGNET", desc: "Reels in nearby acorns, even behind you.", art: "buddy" },
  { id: "voidjelly", name: "Void Jelly", tag: "SOFT BOUNCE", desc: "Planet bounces are much gentler.", art: "voidjelly" },
  { id: "cometsprite", name: "Comet Sprite", tag: "LONG SLOW", desc: "Slow acorns last twice as long.", art: "cometsprite" },
  { id: "meteorcore", name: "Meteor Core", tag: "2X SPECIALS", desc: "Special acorns appear twice as often.", art: "meteorcore" },
  { id: "pocketmoon", name: "Pocket Moon", tag: "LOW GRAV", desc: "Lighter gravity, floatier flight.", art: "pocketmoon" },
  { id: "ufo", name: "Mini UFO", tag: "WARP SLOW", desc: "Slows time inside black-hole warps.", art: "ufo" },
  { id: "nutsack", name: '"Nut-Sack"', tag: "2X NUTS", desc: "Nuts double. Weak taps, heavy, no shields.", art: "nutsack" },
  { id: "starpup", name: "Star Pup", tag: "LONG GOLD", desc: "Golden acorns last twice as long.", art: "starpup" },
  { id: "tinbot", name: "Tin Bot", tag: "NO HOLES", desc: "No black holes or wormholes. No shields either.", art: "tinbot" },
  { id: "wisp", name: "Nebula Wisp", tag: "GATE DRIFT", desc: "Gates drift up and down — moving targets.", art: "wisp" },
];

// Original imagine sheet (3x4, 400px cells) → these filenames. Never remap by index.
export const PAL_SHEET = {
  bee: "row2 col1 — yellow astro bee",
  buddy: "row3 col1 — acorn with a face",
  voidjelly: "row3 col0 — purple tentacle jelly",
  cometsprite: "row2 col2 — orange comet creature",
  meteorcore: "row1 col0 — lava meteor with a crater face",
  pocketmoon: "row2 col0 — crater moon face",
  ufo: "row0 col2 — classic saucer",
  nutsack: "row1 col2 — burlap sack of acorns",
  starpup: "row1 col1 — yellow star face",
  tinbot: "row0 col1 — rivet robot",
  wisp: "row3 col2 — pink nebula ghost",
} as const;

export type Env = {
  name: string;
  wash: [number, number, number, number];
  wash2: [number, number, number, number];
  planetBias: number[];
  debrisBias: number[];
  sky: SkyId;
};

// Painted sky panoramas. Each carries its MEAN COLOUR, measured from
// the art, and so does every planet and rock. Legibility is then a
// perceptual question, not a brightness one: a pink planet on a green
// sky is perfectly readable at the same brightness, while grey on grey
// is not. sep() answers it, and nothing illegible is ever spawned.
export type SkyId =
  | "indigo" | "ice" | "inferno" | "mono" | "magenta"
  | "verdant" | "ghost" | "neon" | "vortex" | "gold"
  | "dark1" | "dark2" | "dark3" | "dark4" | "dark5" | "dark6" | "dark7"
  | "dark8" | "dark9" | "dark10" | "dark11" | "dark12" | "dark13" | "dark14";
export type RGB = [number, number, number];

export const SKY_RGB: Record<SkyId, RGB> = {
  indigo: [0.11, 0.14, 0.34],
  ice: [0.57, 0.73, 0.83],
  inferno: [0.42, 0.18, 0.11],
  mono: [0.17, 0.17, 0.18],
  magenta: [0.38, 0.20, 0.48],
  verdant: [0.09, 0.33, 0.24],
  ghost: [0.76, 0.76, 0.78],
  neon: [0.23, 0.20, 0.51],
  vortex: [0.09, 0.06, 0.15],
  gold: [0.76, 0.49, 0.14],
  // The fourteen deep-space plates. Every one sits under luma 0.18, so
  // anything painted lands on top of them instead of into them.
  dark1: [0.051, 0.067, 0.134],
  dark2: [0.114, 0.154, 0.236],
  dark3: [0.092, 0.094, 0.112],
  dark4: [0.107, 0.131, 0.176],
  dark5: [0.168, 0.176, 0.184],
  dark6: [0.078, 0.113, 0.165],
  dark7: [0.088, 0.124, 0.185],
  dark8: [0.072, 0.097, 0.187],
  dark9: [0.081, 0.092, 0.162],
  dark10: [0.093, 0.097, 0.099],
  dark11: [0.083, 0.102, 0.216],
  dark12: [0.085, 0.134, 0.212],
  dark13: [0.041, 0.058, 0.127],
  dark14: [0.052, 0.081, 0.139],
};

// Deep Space and Lost in Space fly under the dark plates only — no
// vibrant sky, no jewel-tone grade, just space. Free Flight keeps its
// painted colour zones. A zone still owns ONE plate, so a shift still
// reads as arriving somewhere, and 26 zones spread across 14 skies.
export const DARK_SKIES: SkyId[] = [
  "dark1", "dark2", "dark3", "dark4", "dark5", "dark6", "dark7",
  "dark8", "dark9", "dark10", "dark11", "dark12", "dark13", "dark14",
];

export function skyIdFor(flight: string, envIdx: number): SkyId {
  if (flight === "deep" || flight === "lost")
    return DARK_SKIES[((envIdx % DARK_SKIES.length) + DARK_SKIES.length) % DARK_SKIES.length];
  return ENVS[envIdx].sky;
}

// How much of the environment's colour wash survives. Under the dark
// plates it is dialled right back: the tint still names the zone, but it
// no longer paints the whole void turquoise.
export function washScale(flight: string) {
  return flight === "deep" || flight === "lost" ? 0.45 : 1;
}

export const PLANET_COUNT = 33;
export const DEBRIS_COUNT = 27;

export const PLANET_RGB: RGB[] = [
  [0.34, 0.45, 0.47], [0.68, 0.49, 0.25], [0.63, 0.66, 0.68],
  [0.35, 0.17, 0.12], [0.20, 0.51, 0.50], [0.46, 0.44, 0.43],
  [0.65, 0.42, 0.20], [0.13, 0.31, 0.49], [0.56, 0.29, 0.43],
  [0.25, 0.34, 0.13], [0.39, 0.23, 0.49], [0.18, 0.22, 0.27],
  [0.36, 0.27, 0.18], [0.67, 0.51, 0.58], [0.38, 0.18, 0.11],
  [0.39, 0.54, 0.70], [0.40, 0.19, 0.09], [0.29, 0.16, 0.39],
  [0.30, 0.18, 0.11], [0.33, 0.37, 0.48], [0.14, 0.31, 0.39],
  [0.43, 0.09, 0.13], [0.52, 0.40, 0.75], [0.71, 0.62, 0.57],
  [0.78, 0.74, 0.66], [0.13, 0.16, 0.24], [0.92, 0.65, 0.74],
  [0.15, 0.11, 0.28], [0.24, 0.60, 0.81], [0.16, 0.21, 0.48],
  [0.43, 0.26, 0.64], [0.36, 0.58, 0.69], [0.30, 0.15, 0.09],
];

export const DEBRIS_RGB: RGB[] = [
  [0.27, 0.25, 0.25], [0.30, 0.22, 0.19], [0.63, 0.68, 0.77],
  [0.28, 0.25, 0.23], [0.29, 0.26, 0.24], [0.31, 0.29, 0.28],
  [0.73, 0.54, 0.83], [0.27, 0.22, 0.22], [0.23, 0.22, 0.24],
  [0.54, 0.28, 0.61], [0.33, 0.35, 0.38], [0.57, 0.73, 0.81],
  [0.22, 0.16, 0.15], [0.19, 0.49, 0.75], [0.29, 0.07, 0.09],
  [0.58, 0.38, 0.10], [0.10, 0.25, 0.61], [0.21, 0.32, 0.20],
  [0.33, 0.34, 0.61], [0.40, 0.52, 0.66], [0.60, 0.62, 0.66],
  [0.43, 0.44, 0.45], [0.14, 0.13, 0.27], [0.39, 0.40, 0.55],
  [0.44, 0.49, 0.11], [0.70, 0.51, 0.15], [0.39, 0.23, 0.14],
];

/** Perceptual separation in a luma + opponent-colour space. Luminance
 *  is weighted heaviest because form reads by brightness first, but hue
 *  gets its say — which is what makes pink-on-green legible. Calibrated
 *  against the art: orange-on-orange 0.04, black-on-black 0.13,
 *  white-on-white 0.13, grey-on-white 0.24, green-on-green 0.26 all sit
 *  below the bar; pink-on-green 0.55, blue-on-orange 0.63 and
 *  lava-on-ice 1.14 sit far above it. */
export function sep(a: RGB, b: RGB) {
  const l = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const dL = 2.1 * (l(a) - l(b));
  const dA = a[0] - a[1] - (b[0] - b[1]);
  const dB = a[2] - (a[0] + a[1]) / 2 - (b[2] - (b[0] + b[1]) / 2);
  return Math.sqrt(dL * dL + dA * dA + dB * dB);
}
export const MIN_SEP = 0.3;

export const ENVS: Env[] = [
  { name: "DEEP SPACE", wash: [40, 60, 110, 0.14], wash2: [70, 90, 160, 0.06], planetBias: [0, 2, 15, 1], debrisBias: [1, 6, 26], sky: "indigo" },
  { name: "NEBULA NURSERY", wash: [150, 70, 210, 0.16], wash2: [255, 110, 180, 0.08], planetBias: [4, 9, 20, 28], debrisBias: [11, 2, 20], sky: "magenta" },
  { name: "ICE MOON", wash: [90, 180, 220, 0.12], wash2: [160, 230, 255, 0.06], planetBias: [3, 14, 32, 12], debrisBias: [8, 14, 22], sky: "ice" },
  { name: "SOLAR FURNACE", wash: [255, 120, 40, 0.12], wash2: [255, 80, 60, 0.07], planetBias: [7, 29, 15, 10], debrisBias: [16, 13, 19], sky: "inferno" },
  { name: "CRYSTAL BELT", wash: [140, 220, 255, 0.12], wash2: [200, 140, 255, 0.07], planetBias: [24, 2, 12, 6], debrisBias: [21, 0, 3], sky: "neon" },
  { name: "TIME FRACTURE", wash: [90, 255, 180, 0.1], wash2: [200, 255, 120, 0.05], planetBias: [30, 8, 21, 13], debrisBias: [19, 9, 23], sky: "verdant" },
  { name: "MONOCHROME VOID", wash: [255, 255, 255, 0.08], wash2: [140, 140, 150, 0.05], planetBias: [0, 19, 13, 23], debrisBias: [25, 18, 23], sky: "mono" },
  { name: "EMERALD EXPANSE", wash: [40, 255, 120, 0.12], wash2: [140, 255, 80, 0.06], planetBias: [8, 21, 30, 1], debrisBias: [9, 19, 13], sky: "verdant" },
  { name: "CRIMSON STORM", wash: [220, 40, 50, 0.14], wash2: [120, 10, 20, 0.08], planetBias: [7, 29, 15, 4], debrisBias: [16, 13, 11], sky: "inferno" },
  { name: "SAPPHIRE ABYSS", wash: [20, 50, 180, 0.16], wash2: [10, 20, 80, 0.08], planetBias: [24, 6, 1, 26], debrisBias: [20, 25, 2], sky: "indigo" },
  { name: "VIOLET REALM", wash: [140, 40, 220, 0.14], wash2: [80, 20, 140, 0.08], planetBias: [20, 9, 24, 1], debrisBias: [11, 20, 15], sky: "vortex" },
  { name: "GOLDEN HOUR", wash: [255, 180, 60, 0.12], wash2: [220, 120, 40, 0.07], planetBias: [7, 29, 30, 10], debrisBias: [12, 14, 22], sky: "gold" },
  { name: "SOLAR CORONA", wash: [255, 220, 80, 0.12], wash2: [255, 140, 40, 0.07], planetBias: [29, 27, 32, 7], debrisBias: [22, 12, 16], sky: "gold" },
  { name: "HYPERVIVID", wash: [255, 40, 180, 0.12], wash2: [40, 220, 255, 0.1], planetBias: [24, 2, 5, 12], debrisBias: [21, 10, 5], sky: "neon" },
  { name: "NEON BAZAAR", wash: [255, 40, 160, 0.12], wash2: [40, 255, 200, 0.08], planetBias: [12, 6, 24, 26], debrisBias: [12, 14, 26], sky: "neon" },
  { name: "ALIEN JUNGLE", wash: [40, 160, 60, 0.14], wash2: [20, 80, 40, 0.08], planetBias: [8, 30, 21, 10], debrisBias: [24, 9, 11], sky: "verdant" },
  { name: "ACID SWAMP", wash: [160, 220, 20, 0.12], wash2: [80, 120, 10, 0.07], planetBias: [30, 21, 8, 27], debrisBias: [24, 19, 11], sky: "verdant" },
  { name: "CORAL SHALLOWS", wash: [255, 120, 140, 0.12], wash2: [80, 180, 200, 0.08], planetBias: [4, 28, 20, 15], debrisBias: [13, 11, 16], sky: "magenta" },
  { name: "BONE DESERT", wash: [220, 190, 140, 0.1], wash2: [140, 100, 60, 0.07], planetBias: [29, 7, 27, 32], debrisBias: [22, 12, 14], sky: "gold" },
  { name: "PULSAR FIELD", wash: [180, 210, 255, 0.14], wash2: [80, 90, 200, 0.08], planetBias: [3, 21, 16, 14], debrisBias: [12, 14, 7], sky: "ice" },
  { name: "BLACKOUT ZONE", wash: [60, 70, 110, 0.1], wash2: [30, 34, 60, 0.06], planetBias: [19, 13, 28, 15], debrisBias: [25, 11, 20], sky: "mono" },
  { name: "AURORA CROWN", wash: [60, 255, 190, 0.14], wash2: [140, 120, 255, 0.08], planetBias: [8, 30, 21, 1], debrisBias: [9, 13, 23], sky: "verdant" },
  { name: "RUST BELT", wash: [200, 110, 50, 0.12], wash2: [140, 70, 40, 0.07], planetBias: [7, 29, 15, 4], debrisBias: [16, 19, 11], sky: "inferno" },
  { name: "GHOST NEBULA", wash: [200, 210, 235, 0.09], wash2: [150, 160, 200, 0.06], planetBias: [27, 32, 25, 17], debrisBias: [17, 14, 4], sky: "ghost" },
  { name: "PRISM STORM", wash: [255, 220, 0, 0.12], wash2: [0, 190, 255, 0.1], planetBias: [24, 2, 12, 5], debrisBias: [23, 21, 11], sky: "neon" },
  { name: "EVENT HORIZON", wash: [140, 40, 255, 0.16], wash2: [40, 0, 80, 0.1], planetBias: [20, 28, 24, 15], debrisBias: [11, 20, 15], sky: "vortex" },
];

export const ENV_GATES = 20;

// Free Flight keeps the door to the arcade shut until this gate. The
// crossing is a late-run reward — meeting it on gate two would sell the
// illustrated game short before it has been seen.
export const RETRO_GATE = 100;

export const XP_STEPS = [
  60, 100, 150, 200, 260, 320, 390, 460, 540, 620, 710, 800, 900, 1000, 1110, 1220, 1340, 1460, 1590, 1720, 1860, 2000,
  2150, 2300, 2460, 2620, 2790, 2960, 3140,
];
export const MAX_LEVEL = XP_STEPS.length + 1;

export const TITLES: [number, string][] = [
  [1, "CADET"],
  [5, "PILOT"],
  [10, "VOIDFARER"],
  [15, "ACE"],
  [18, "COMET CHASER"],
  [25, "EVENT HORIZON"],
  [30, "ACORNAUT"],
];

export const PAL_LEVELS: Record<string, number> = {
  none: 1,
  bee: 2,
  buddy: 4,
  voidjelly: 6,
  cometsprite: 7,
  meteorcore: 9,
  pocketmoon: 11,
  ufo: 12,
  starpup: 13,
  tinbot: 14,
  wisp: 15,
  nutsack: 16,
};

// Premium items. These never appear on the level track — no amount of
// flying reveals them — and acorns cannot buy them; they are bought for
// real money. The beta hands them over so they can be played and judged.
export const IAP_ITEMS = ["catsuit", "catbubble"];
export function isIap(id: string) {
  return IAP_ITEMS.includes(id);
}

export const SUIT_REVEAL: Record<string, number> = {
  robo: 12,
  alien: 16,
  ghost: 20,
  bigbooty: 24,
};

export type TrackItem = {
  lvl: number;
  kind: "pal" | "mod" | "mode" | "title" | "suit";
  id?: string;
  name?: string;
  desc?: string;
};

export const TRACK: TrackItem[] = [
  { lvl: 2, kind: "pal", id: "bee" },
  { lvl: 3, kind: "mod", name: "Start Shield", desc: "Arm any run with a shield from the hangar." },
  { lvl: 4, kind: "pal", id: "buddy" },
  { lvl: 5, kind: "mode", name: "Deep Space Flight", desc: "Space itself shifts every 10s. Survive the chain." },
  { lvl: 5, kind: "title", name: "PILOT" },
  { lvl: 6, kind: "pal", id: "voidjelly" },
  { lvl: 7, kind: "pal", id: "cometsprite" },
  { lvl: 8, kind: "mod", name: "Shield Battery", desc: "Carry three shield charges at once." },
  { lvl: 9, kind: "pal", id: "meteorcore" },
  { lvl: 10, kind: "mode", name: "Lost in Space", desc: "The sky rotates, drifts and mirrors." },
  { lvl: 10, kind: "title", name: "VOIDFARER" },
  { lvl: 11, kind: "pal", id: "pocketmoon" },
  { lvl: 12, kind: "pal", id: "ufo" },
  { lvl: 12, kind: "suit", id: "robo", name: "Robo Suit", desc: "Full chrome, scanning visor. Now in the shop." },
  { lvl: 13, kind: "pal", id: "starpup" },
  { lvl: 14, kind: "pal", id: "tinbot" },
  { lvl: 15, kind: "pal", id: "wisp" },
  { lvl: 15, kind: "title", name: "ACE" },
  { lvl: 16, kind: "pal", id: "nutsack" },
  { lvl: 16, kind: "suit", id: "alien", name: "Alien Suit", desc: "The visitor look, antennae included. In the shop." },
  { lvl: 18, kind: "title", name: "COMET CHASER" },
  { lvl: 20, kind: "suit", id: "ghost", name: "Ghost Suit", desc: "Spectral tail, cyan-burning eyes. In the shop." },
  { lvl: 24, kind: "suit", id: "bigbooty", name: "Big Booty Suit", desc: "Maximum silhouette. Real jiggle. In the shop." },
  { lvl: 25, kind: "title", name: "EVENT HORIZON" },
  { lvl: 30, kind: "title", name: "ACORNAUT" },
];

export const MOD_SHIELD_COST = 25;
export const MOD_BATTERY_COST = 500;
export const BETA_UNLOCK_GATES = true;

export function xpCumulative(level: number) {
  let acc = 0;
  for (let i = 0; i < level - 1 && i < XP_STEPS.length; i++) acc += XP_STEPS[i];
  return acc;
}

export function levelForXp(xp: number) {
  let l = 1;
  let acc = 0;
  for (const s of XP_STEPS) {
    if (xp < acc + s) break;
    acc += s;
    l++;
  }
  return l;
}

export function titleForLevel(level: number) {
  let t = "CADET";
  for (const [lv, name] of TITLES) if (level >= lv) t = name;
  return t;
}

export function runXp(score: number, acorns: number, deep: boolean, lost: boolean) {
  let xp = score + acorns;
  if (score >= 25) xp += 10;
  if (score >= 50) xp += 15;
  if (score >= 75) xp += 20;
  if (score >= 100) xp += 25;
  return Math.round(xp * (lost ? 1.5 : deep ? 1.25 : 1));
}
