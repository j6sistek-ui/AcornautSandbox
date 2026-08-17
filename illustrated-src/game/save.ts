import {
  BETA_UNLOCK_GATES,
  HELMETS,
  LEGACY_KEYS,
  PALS,
  PAL_LEVELS,
  SAVE_KEY,
  SUITS,
  SUIT_REVEAL,
  TRAILS,
  levelForXp,
  titleForLevel,
} from "./catalog";

export type SaveData = {
  highScore: number;
  deepBest: number;
  lostBest: number;
  acorns: number;
  xp: number;
  startShield: boolean;
  battery: boolean;
  tutorialDone: boolean;
  unlocked: string[];
  equipped: string;
  unlockedSuits: string[];
  equippedSuit: string;
  unlockedTrails: string[];
  equippedTrail: string;
  unlockedPals: string[];
  equippedPal: string;
};

export function defaultSave(): SaveData {
  return {
    highScore: 0,
    deepBest: 0,
    lostBest: 0,
    acorns: 0,
    xp: 0,
    startShield: false,
    battery: false,
    tutorialDone: false,
    unlocked: ["clear"],
    equipped: "clear",
    unlockedSuits: ["flight"],
    equippedSuit: "flight",
    unlockedTrails: ["sparks"],
    equippedTrail: "sparks",
    unlockedPals: ["none"],
    equippedPal: "none",
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
  if (!SUITS.some((u) => u.id === s.equippedSuit)) s.equippedSuit = "flight";
  if (!TRAILS.some((t) => t.id === s.equippedTrail)) s.equippedTrail = "sparks";
  if (!PALS.some((p) => p.id === s.equippedPal)) s.equippedPal = "none";
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

export function palUnlocked(s: SaveData, id: string) {
  return BETA_UNLOCK_GATES || s.unlockedPals.includes(id) || pilotLevelOf(s) >= (PAL_LEVELS[id] || 1);
}

export function suitRevealed(s: SaveData, id: string) {
  return !SUIT_REVEAL[id] || BETA_UNLOCK_GATES || pilotLevelOf(s) >= SUIT_REVEAL[id];
}

export function deepUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || pilotLevelOf(s) >= 5;
}

export function lostUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || pilotLevelOf(s) >= 10;
}

export function startShieldUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || pilotLevelOf(s) >= 3;
}

export function batteryUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || pilotLevelOf(s) >= 8;
}
