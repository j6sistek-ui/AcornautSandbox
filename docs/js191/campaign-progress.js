import { LEVELS, STAR_REWARDS, countBits, missionProgressId } from "./campaign.js?v=191";
import { ENVS, IS_BETA, STAR_MAP_LIVE } from "./catalog.js?v=191";
export const barrierId = (after) => ({ 33: "hyper-barrier-1", 66: "hyper-barrier-2", 99: "hyper-barrier-3" }[after]);
export const rewardId = (r) => r.kind === "dust" ? `legacy:dust:${r.stars}` : `legacy:${r.kind}:${r.id ?? r.name}:${r.stars}`;
const clampMask = (n) => typeof n === "number" && Number.isFinite(n) ? n & 7 : 0;
const objectiveIds = (def) => def.objectiveIds ?? def.goals.map((g, i) => `${missionProgressId(def)}:${def.base}:${def.gates}:${i}:${JSON.stringify(g)}`);
const prepared = new WeakMap();
/** Cached older bundles retain unknown fields while writing stars/dustPaidTo.
 * Import their extra credit conservatively when this bundle next loads. */
function carryCompatibilityWrites(save, p) {
    let oldTotal = 0;
    for (const value of Object.values(save.stars ?? {}))
        oldTotal += countBits(clampMask(value));
    p.legacyEntitlementFloor = Math.max(p.legacyEntitlementFloor, Math.min(300, oldTotal));
    for (const def of LEVELS) {
        const mask = clampMask(save.stars?.[def.id]);
        if (!mask)
            continue;
        const id = missionProgressId(def);
        const entry = p.missions[id] ?? (p.missions[id] = {
            objectives: {}, creditFloor: 0, passed: false, legacyMask: mask, legacyUnverified: true,
        });
        if (countBits(mask) > entry.creditFloor)
            entry.legacyUnverified = true;
        entry.creditFloor = Math.max(entry.creditFloor, countBits(mask));
        entry.passed || (entry.passed = !!(mask & 1));
    }
    for (const after of save.raceGates ?? []) {
        const id = barrierId(after);
        if (id && !p.barriers.includes(id))
            p.barriers.push(id);
    }
    for (const reward of STAR_REWARDS)
        if (reward.kind === "dust" && reward.stars <= (save.dustPaidTo || 0)) {
            const id = rewardId(reward);
            if (!p.paidRewards.includes(id))
                p.paidRewards.push(id);
        }
}
/** The two historical ID collisions cannot be dated from an unversioned save.
 * Credit and route passage survive; current checklists need successful replays. */
export function ambiguousLegacy(def) {
    return !!def.previousIds || def.stage >= 2 && def.stage <= 10 && (def.n === 8 || ((IS_BETA || STAR_MAP_LIVE) && def.n === 4));
}
/** Beta can inherit a versioned production save on first visit. The same
 * route position can then contain a different mission, so transfer passage
 * and credit without copying flight checkmarks into Wormhole objectives. */
function carryPageVariants(save, p) {
    for (const def of LEVELS) {
        const id = missionProgressId(def);
        const previous = def.previousIds ?? (def.stage >= 2 && def.n === 4 ? [def.variantId ? def.id : `beta-tunnel-${def.id}`] : []);
        for (const otherId of previous) {
            const source = p.missions[otherId];
            if (!source || otherId === id)
                continue;
            const entry = p.missions[id] ?? (p.missions[id] = { objectives: {}, creditFloor: 0, passed: false, legacyUnverified: true });
            entry.creditFloor = Math.max(entry.creditFloor, Math.min(3, source.creditFloor));
            entry.passed || (entry.passed = source.passed);
        }
    }
}
export function migrateCampaign(save, existing = true, legacyPageUnknown = false) {
    if (save.campaignProgress && prepared.get(save) === save.campaignProgress)
        return save.campaignProgress;
    if (save.campaignProgress?.version === 1) {
        carryCompatibilityWrites(save, save.campaignProgress);
        carryPageVariants(save, save.campaignProgress);
        prepared.set(save, save.campaignProgress);
        return save.campaignProgress;
    }
    const raw = save.stars ?? {};
    const rawTotal = Object.values(raw).reduce((n, m) => n + countBits(clampMask(m)), 0);
    const p = {
        version: 1, missions: {}, barriers: (save.raceGates ?? []).map(barrierId).filter(Boolean),
        paidRewards: STAR_REWARDS.filter(r => r.kind === "dust" && r.stars <= (save.dustPaidTo || 0)).map(rewardId),
        legacyEntitlementFloor: existing ? Math.min(300, Math.max(rawTotal, save.allStars ? 300 : 0)) : 0,
        zoneVisits: [],
    };
    save.campaignProgress = p;
    prepared.set(save, p);
    for (const def of LEVELS) {
        const mask = clampMask(raw[def.id]);
        if (!mask)
            continue;
        const ambiguous = ambiguousLegacy(def) || (legacyPageUnknown && def.stage >= 2 && def.n === 4);
        const entry = { objectives: {}, creditFloor: countBits(mask), passed: !!(mask & 1), legacyMask: mask, legacyUnverified: ambiguous };
        if (!ambiguous)
            objectiveIds(def).forEach((id, i) => { if (mask & (1 << i))
                entry.objectives[id] = true; });
        p.missions[missionProgressId(def)] = entry;
        if (entry.passed && !ambiguous && def.base !== "spill" && def.base !== "tunnel") {
            recordZoneVisit(save, def.fx.env ?? 0);
        }
    }
    for (const name of save.zonesSeen ?? []) {
        const index = ENVS.findIndex(e => e.name === name);
        if (index >= 0)
            recordZoneVisit(save, index);
    }
    return p;
}
export function verifiedMask(save, def) {
    const entry = migrateCampaign(save).missions[missionProgressId(def)];
    return objectiveIds(def).reduce((mask, id, i) => mask | (entry?.objectives[id] ? 1 << i : 0), 0);
}
export function missionCredit(save, def) {
    const entry = migrateCampaign(save).missions[missionProgressId(def)];
    return Math.min(3, Math.max(entry?.creditFloor ?? 0, countBits(verifiedMask(save, def))));
}
export function earnedCampaignStars(save, order = LEVELS) {
    return order.reduce((n, def) => n + missionCredit(save, def), 0);
}
export function routeMasks(save, order = LEVELS) {
    const p = migrateCampaign(save);
    return Object.fromEntries(order.map(def => [def.id, p.missions[missionProgressId(def)]?.passed ? 1 : 0]));
}
/** Caller supplies only goals from a successful run. Old bits are never ORed
 * into the new objective definitions. Keep the old field as a passage bridge. */
export function settleMissionCredit(save, def, mask) {
    const p = migrateCampaign(save);
    const key = missionProgressId(def);
    const entry = p.missions[key] ?? (p.missions[key] = { objectives: {}, creditFloor: 0, passed: false, legacyUnverified: !!def.previousIds });
    const before = missionCredit(save, def);
    objectiveIds(def).forEach((id, i) => { if (mask & (1 << i))
        entry.objectives[id] = true; });
    entry.passed || (entry.passed = !!(mask & 1));
    const verified = verifiedMask(save, def);
    entry.creditFloor = Math.max(entry.creditFloor, countBits(verified));
    save.stars ?? (save.stars = {});
    // The original mask stays opaque if its contract was ambiguous. Its finish
    // bit remains a compatibility bridge for older builds and route passage.
    save.stars[def.id] = entry.legacyUnverified
        ? (save.stars[def.id] || 0) | (entry.passed ? 1 : 0)
        : (save.stars[def.id] || 0) | verified;
    return { verified, gained: missionCredit(save, def) - before };
}
export function recordZoneVisit(save, env) {
    const zone = ENVS[env];
    if (!zone)
        return;
    const id = zone.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    save.zonesSeen ?? (save.zonesSeen = []);
    if (!save.zonesSeen.includes(zone.name))
        save.zonesSeen.push(zone.name);
    const p = save.campaignProgress;
    if (p && !p.zoneVisits.includes(id))
        p.zoneVisits.push(id);
}
/** Retire the separate review page without discarding its earned credit.
 * Keep beta's wallet/receipts; ordinary reward settlement handles eligibility.
 * The original sample slot is retained verbatim as an archive. */
export function importSampleCredit(save, sample) {
    const target = migrateCampaign(save), source = migrateCampaign(sample);
    for (const [id, from] of Object.entries(source.missions)) {
        const to = target.missions[id] ?? (target.missions[id] = { objectives: {}, creditFloor: 0, passed: false });
        Object.assign(to.objectives, from.objectives);
        to.creditFloor = Math.max(to.creditFloor, from.creditFloor);
        to.passed || (to.passed = from.passed);
        to.legacyUnverified || (to.legacyUnverified = from.legacyUnverified);
    }
    target.legacyEntitlementFloor = Math.max(target.legacyEntitlementFloor, source.legacyEntitlementFloor);
    target.barriers = [...new Set([...target.barriers, ...source.barriers])];
    target.zoneVisits = [...new Set([...target.zoneVisits, ...source.zoneVisits])];
    save.raceGates = [...new Set([...(save.raceGates ?? []), ...(sample.raceGates ?? [])])];
    for (const key of ["unlocked", "unlockedPals", "unlockedSuits", "unlockedTrails", "purchased", "zonesSeen"]) {
        if (Array.isArray(sample[key]))
            save[key] = [...new Set([...(save[key] ?? []), ...sample[key]])];
    }
    carryPageVariants(save, target);
}
