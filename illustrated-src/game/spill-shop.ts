// THE DEPOT SHELF (owner, 3 Nov 2026): utilities and artifacts are one list.
// "Make the artifacts combine with utilities. Not a separate upgrade ... the
// options present only two per depot and cycle, so not always available. And
// equipping a second one only after wave 10."
//
// So every Depot offers TWO new items from one pool, rotating visit to visit.
// Anything already bought this run stays on the shelf to refit free. One slot
// until wave 10, two after. An artifact fills a slot like any utility, and at
// most one artifact is fitted at a time (its effect is a single build state).
//
// The Emergency Brake left the pool: direct steering already stops the ship on
// release, so it no longer did anything a player could feel. The Pulse
// Battery is offered only once Impact pulse is owned, since it does nothing
// without it.
//
// This layer sits above spill.ts / spill-builds.ts: those keep their own
// primitives (and their tests); the engine routes Depot purchases through here.
import { spillChargeCap, type SpillState } from "./spill";
import { SPILL_UTILITIES, type SpillUtility } from "./spill-content";
import { SPILL_ARTIFACTS, SPILL_ARTIFACT_IDS, type SpillArtifactId } from "./spill-builds";

export type SpillShelfItem = { kind: "utility"; id: SpillUtility } | { kind: "artifact"; id: SpillArtifactId };
export const SPILL_ARTIFACT_PRICE = 70;
const SHELF_UTILITIES: SpillUtility[] = ["magnet", "scanner", "capacitor"];

const depotOpen = (s: SpillState) => s.phase === "depot" && !!s.depot && !s.welcome && s.depot.arm <= 0;
export const itemKey = (item: SpillShelfItem) => `${item.kind}:${item.id}`;

export function spillSlotCap(s: SpillState) { return s.wave >= 10 ? 2 : 1; }
export function spillFittedCount(s: SpillState) { return s.utilities.length + (s.combat.build.artifact ? 1 : 0); }

export function spillItemOwned(s: SpillState, item: SpillShelfItem) {
  return item.kind === "utility" ? s.ownedUtilities.includes(item.id) : s.combat.build.owned.includes(item.id);
}
export function spillItemFitted(s: SpillState, item: SpillShelfItem) {
  return item.kind === "utility" ? s.utilities.includes(item.id) : s.combat.build.artifact === item.id;
}
export function spillItemPrice(item: SpillShelfItem) {
  return item.kind === "utility" ? SPILL_UTILITIES[item.id].price : SPILL_ARTIFACT_PRICE;
}
export function spillItemInfo(item: SpillShelfItem) {
  if (item.kind === "utility") { const u = SPILL_UTILITIES[item.id]; return { name: u.name, line: u.guide, detail: u.detail }; }
  const a = SPILL_ARTIFACTS[item.id]; return { name: a.name, line: a.description, detail: a.detail };
}

/** Every item not yet bought this run, in a fixed order. */
function pool(s: SpillState): SpillShelfItem[] {
  const items: SpillShelfItem[] = [];
  for (const id of SHELF_UTILITIES) {
    if (id === "capacitor" && !s.up.pulse) continue;
    items.push({ kind: "utility", id });
  }
  for (const id of SPILL_ARTIFACT_IDS) items.push({ kind: "artifact", id });
  // what this visit bought still counts, so the two offers never reshuffle mid-visit
  const bought = visitLog(s).map(e => itemKey(e.item));
  return items.filter(item => !spillItemOwned(s, item) || bought.includes(itemKey(item)));
}

/** Two new items per Depot. The window advances by two each visit, from a
 *  seed-local start, so the same pair does not come back every time. */
export function spillShelfOffers(s: SpillState): SpillShelfItem[] {
  if (s.welcome) return [];
  const items = pool(s);
  if (items.length <= 2) return items;
  const visit = Math.max(0, Math.floor(s.wave / 5) - 1);
  const start = (((s.seed >>> 0) % items.length) + visit * 2) % items.length;
  return [items[start], items[(start + 1) % items.length]];
}

/** The shelf as shown: this visit's two offers (a purchase stays on its
 *  card so it can be undone). Fitted items are listed separately. */
export function spillShelf(s: SpillState): SpillShelfItem[] {
  return spillShelfOffers(s);
}
/** What is fitted now, utilities first. */
export function spillFittedItems(s: SpillState): SpillShelfItem[] {
  return [...s.utilities.map(id => ({ kind: "utility", id } as SpillShelfItem)),
    ...(s.combat.build.artifact ? [{ kind: "artifact", id: s.combat.build.artifact } as SpillShelfItem] : [])];
}

// UNDO (owner: "unequip back to original slot"). A purchase made on this
// Depot visit can be taken back: the coins return and whatever it replaced
// is fitted again. The log lives beside the live state, not in the save, so
// it ends with the visit.
type VisitEntry = { item: SpillShelfItem; out?: SpillShelfItem; price: number };
const visits = new WeakMap<SpillState, { wave: number; seed: number; entries: VisitEntry[] }>();
function visitLog(s: SpillState): VisitEntry[] {
  const v = visits.get(s);
  return v && v.wave === s.wave && v.seed === s.seed && s.phase === "depot" ? v.entries : [];
}
function logVisit(s: SpillState, entry: VisitEntry) {
  const v = visits.get(s);
  if (v && v.wave === s.wave && v.seed === s.seed) v.entries.push(entry);
  else visits.set(s, { wave: s.wave, seed: s.seed, entries: [entry] });
}
export function spillShelfUndoable(s: SpillState, item: SpillShelfItem) {
  return visitLog(s).some(e => itemKey(e.item) === itemKey(item));
}
export function spillShelfUndo(s: SpillState, item: SpillShelfItem): boolean {
  if (!depotOpen(s)) return false;
  const log = visitLog(s), i = log.findIndex(e => itemKey(e.item) === itemKey(item));
  if (i < 0) return false;
  const [entry] = log.splice(i, 1);
  if (spillItemFitted(s, item)) unfit(s, item);
  if (item.kind === "utility") s.ownedUtilities.splice(s.ownedUtilities.indexOf(item.id), 1);
  else {
    const at = s.combat.build.owned.indexOf(item.id);
    s.combat.build.owned.splice(at, 1); s.combat.build.claimedWaves.splice(at, 1);
  }
  if (entry.out && !spillItemFitted(s, entry.out) && spillFittedCount(s) < Math.max(spillSlotCap(s), spillFittedCount(s) + 1)) fit(s, entry.out);
  s.ore += entry.price;
  s.charge = Math.min(s.charge, spillChargeCap(s));
  s.cues.push("buy");
  return true;
}

function unfit(s: SpillState, item: SpillShelfItem) {
  if (item.kind === "utility") s.utilities.splice(s.utilities.indexOf(item.id), 1);
  else { s.combat.build.artifact = null; s.combat.build.echo = 0; s.combat.build.blasts = []; }
}
function fit(s: SpillState, item: SpillShelfItem) {
  if (item.kind === "utility") s.utilities.push(item.id);
  else { s.combat.build.artifact = item.id; s.combat.build.echo = 0; s.combat.build.blasts = []; }
}

/** Fit, remove, buy-and-fit, or swap one shelf item. `replace` names the
 *  fitted item to take out when every slot is full. */
export function spillShelfAction(s: SpillState, item: SpillShelfItem, replace?: SpillShelfItem):
  "ok" | "poor" | "full" | "closed" {
  if (!depotOpen(s)) return "closed";
  if (spillItemFitted(s, item)) { unfit(s, item); s.charge = Math.min(s.charge, spillChargeCap(s)); s.cues.push("buy"); return "ok"; }
  const owned = spillItemOwned(s, item);
  if (!owned && !spillShelfOffers(s).some(o => itemKey(o) === itemKey(item))) return "closed";
  if (replace && !spillItemFitted(s, replace)) return "closed";
  // only one artifact at a time: fitting a second artifact swaps the first
  const artifactSwap = item.kind === "artifact" && !!s.combat.build.artifact;
  const out = artifactSwap ? { kind: "artifact", id: s.combat.build.artifact! } as SpillShelfItem : replace;
  if (!out && spillFittedCount(s) >= spillSlotCap(s)) return "full";
  const price = owned ? 0 : spillItemPrice(item);
  if (s.ore < price) return "poor";
  s.ore -= price;
  if (!owned) {
    if (item.kind === "utility") s.ownedUtilities.push(item.id);
    else { s.combat.build.owned.push(item.id); s.combat.build.claimedWaves.push(s.wave); }
  }
  if (out) unfit(s, out);
  fit(s, item);
  if (!owned) logVisit(s, { item, out, price });
  s.charge = Math.min(s.charge, spillChargeCap(s));
  s.cues.push("buy");
  return "ok";
}
