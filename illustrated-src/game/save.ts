import { STAR_UNLOCKS, totalStars } from "./campaign";
import {
  BETA_UNLOCK_GATES,
  HELMETS,
  LEGACY_KEYS,
  PALS,
  PAL_LEVELS,
  SAVE_KEY,
  SUITS,
  SUIT_REVEAL,
  isIap,
  TRAILS,
  levelForXp,
  titleForLevel,
} from "./catalog";

export type SaveData = {
  highScore: number;
  deepBest: number;
  lostBest: number;
  arcadeBest: number;
  tunnelBest: number;
  purchased: string[];
  acorns: number;
  xp: number;
  startShield: boolean;
  battery: boolean;
  /** flight mods, bought once and kept. See MODS in catalog.ts. */
  steadyGates: boolean;
  roughAir: boolean;
  thrillSeeker: boolean;
  tutorialDone: boolean;
  unlocked: string[];
  equipped: string;
  unlockedSuits: string[];
  equippedSuit: string;
  unlockedTrails: string[];
  equippedTrail: string;
  unlockedPals: string[];
  equippedPal: string;
  // lifetime tallies — the Profile screen's three tiles. These only ever
  // grow; acorns spent in the hangar come off `acorns`, never off these.
  runs: number;
  lifetimeAcorns: number;
  zonesSeen: string[];
  /** Star Chart progress: level id -> 3-bit goal mask. See campaign.ts. */
  stars: Record<string, number>;
};

export function defaultSave(): SaveData {
  return {
    highScore: 0,
    deepBest: 0,
    lostBest: 0,
    arcadeBest: 0,
    tunnelBest: 0,
    purchased: [],
    acorns: 0,
    xp: 0,
    startShield: false,
    battery: false,
    steadyGates: false,
    roughAir: false,
    thrillSeeker: false,
    tutorialDone: false,
    unlocked: ["clear"],
    equipped: "clear",
    unlockedSuits: ["flight"],
    equippedSuit: "flight",
    unlockedTrails: ["sparks"],
    equippedTrail: "sparks",
    unlockedPals: ["none"],
    equippedPal: "none",
    runs: 0,
    lifetimeAcorns: 0,
    zonesSeen: [],
    stars: {},
  };
}

function readRaw(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function loadSave(): SaveData {
  const parsed = readRaw(SAVE_KEY) ?? LEGACY_KEYS.map(readRaw).find(Boolean) ?? null;
  const s: SaveData = { ...defaultSave(), ...(parsed as Partial<SaveData>) };
  if (!s.unlocked?.includes("clear")) s.unlocked = ["clear", ...(s.unlocked || [])];
  if (!s.unlockedSuits?.includes("flight")) s.unlockedSuits = ["flight", ...(s.unlockedSuits || [])];
  if (!s.unlockedTrails?.includes("sparks")) s.unlockedTrails = ["sparks", ...(s.unlockedTrails || [])];
  if (!s.unlockedPals?.includes("none")) s.unlockedPals = ["none", ...(s.unlockedPals || [])];
  if (!HELMETS.some((h) => h.id === s.equipped)) s.equipped = "clear";
  // a matched-set helmet stranded on the wrong suit (saved before the rule
  // existed, or edited by hand) comes off rather than half-fitting
  {
    const h = HELMETS.find((x) => x.id === s.equipped);
    if (h?.suitOnly && h.suitOnly !== s.equippedSuit) s.equipped = "clear";
  }
  if (!SUITS.some((u) => u.id === s.equippedSuit)) s.equippedSuit = "flight";
  if (!TRAILS.some((t) => t.id === s.equippedTrail)) s.equippedTrail = "sparks";
  if (!PALS.some((p) => p.id === s.equippedPal)) s.equippedPal = "none";
  // saves written before the flight mods existed
  for (const k of ["steadyGates", "roughAir", "thrillSeeker"] as const) {
    if (typeof s[k] !== "boolean") s[k] = false;
  }
  // Steady Gates and Rough Air are opposites; a save carrying both is
  // incoherent, and stilling the gates is the safer of the two to honour.
  if (s.steadyGates && s.roughAir) s.roughAir = false;
  // saves written before the lifetime tallies existed
  if (typeof s.runs !== "number") s.runs = 0;
  if (typeof s.lifetimeAcorns !== "number") s.lifetimeAcorns = s.acorns;
  if (!Array.isArray(s.zonesSeen)) s.zonesSeen = [];
  if (!s.stars || typeof s.stars !== "object" || Array.isArray(s.stars)) s.stars = {};
  if (parsed && typeof parsed.xp !== "number") {
    const owned =
      Math.max(0, (s.unlocked?.length || 1) - 1) +
      Math.max(0, (s.unlockedSuits?.length || 1) - 1) +
      Math.max(0, (s.unlockedTrails?.length || 1) - 1) +
      Math.max(0, (s.unlockedPals?.length || 1) - 1);
    s.xp = Math.round(4 * (s.highScore + s.deepBest + s.lostBest) + s.acorns + 200 * owned);
  }
  if (BETA_UNLOCK_GATES && s.acorns < 10000) s.acorns = 10000;
  return s;
}

export function writeSave(s: SaveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}

export function pilotLevelOf(s: SaveData) {
  return levelForXp(s.xp || 0);
}

export function pilotTitleOf(s: SaveData) {
  return titleForLevel(pilotLevelOf(s));
}

export function starsOf(s: SaveData) {
  return totalStars(s.stars || {});
}

// Progression is EARNED BY STARS now — the Star Chart is the ladder. The
// old XP thresholds are kept as an OR so no existing save loses anything
// it already had; they are not shown anywhere any more.
export function palUnlocked(s: SaveData, id: string) {
  if (STAR_UNLOCKS.pals[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.pals[id]) return true;
  return BETA_UNLOCK_GATES || s.unlockedPals.includes(id) || pilotLevelOf(s) >= (PAL_LEVELS[id] || 1);
}

export function suitRevealed(s: SaveData, id: string) {
  if (isIap(id)) return iapOwned(s, id);
  if (STAR_UNLOCKS.suits[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.suits[id]) return true;
  return !SUIT_REVEAL[id] || BETA_UNLOCK_GATES || pilotLevelOf(s) >= SUIT_REVEAL[id];
}

// Premium items are owned only once bought for real money. The beta
// grants them outright so they can be flown and judged before release.
export function iapOwned(s: SaveData, id: string) {
  return BETA_UNLOCK_GATES || (s.purchased || []).includes(id);
}

// Flight mods change how the game FEELS, so they are held back until a
// player has flown enough to have an opinion about it. Deliberately NOT
// bypassed by BETA_UNLOCK_GATES the way cosmetics are: the point of the
// gate is that a new pilot flies the game as designed first. Level 30 is a
// holding position — move MOD_UNLOCK_LEVEL when the curve is tuned.
export const MOD_UNLOCK_LEVEL = 30;
export function modsUnlocked(s: SaveData) {
  // beta opens these now (was held back deliberately; overruled) — the
  // real gate for release is the star threshold
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.flightMods || pilotLevelOf(s) >= MOD_UNLOCK_LEVEL;
}

export function deepUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.deep || pilotLevelOf(s) >= 5;
}

export function lostUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.lost || pilotLevelOf(s) >= 10;
}

export function startShieldUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.startShield || pilotLevelOf(s) >= 3;
}

export function batteryUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.battery || pilotLevelOf(s) >= 8;
}
