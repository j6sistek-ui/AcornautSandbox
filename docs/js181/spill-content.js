export const SPILL_UTILITIES = {
    magnet: { name: "Salvage Magnet", price: 40, desc: "Draw nearby Ore and Gold toward the ship. Repairs still need a direct pickup.", unlock: 5, icon: "◎" },
    scanner: { name: "Field Scanner", price: 35, desc: "See incoming lanes earlier and retain bright outlines in Blackout.", unlock: 10, icon: "⌁" },
    brake: { name: "Emergency Brake", price: 35, desc: "Automatic boundary recovery once every 12s. Lunges arrest a fast dive.", unlock: 10, icon: "↟" },
    capacitor: { name: "Reserve Capacitor", price: 45, desc: "Bank a second full Pulse charge. Gold never goes to waste below two charges.", unlock: 20, icon: "ϟ" },
};
export const SPILL_UTILITY_IDS = Object.keys(SPILL_UTILITIES);
export const SPILL_SPECIALTIES = {
    brace: { axis: "plating", name: "Impact Bracing", desc: "Half the knockback; 0.4s longer hull recovery." },
    salvage: { axis: "plating", name: "Salvage Armor", desc: "Mining 30 Ore repairs a pip, at most twice per wave." },
    precision: { axis: "thrusters", name: "Precision Jets", desc: "Lunges brake vertical motion; burst strength stays at tier I." },
    sweep: { axis: "thrusters", name: "Wide Sweep", desc: "Lunges clear shards in a wider path, including at tier II." },
    efficient: { axis: "pulse", name: "Efficient Coil", desc: "Gold charges 65% of a Pulse instead of 50%." },
    yield: { axis: "pulse", name: "Salvage Coil", desc: "Shattered debris yields Ore at tier II; tier III yields double." },
};
export function spillContractOffers(wave) {
    const target = 35 + Math.min(40, Math.floor(wave / 5) * 5);
    return [
        { kind: "salvage", name: "Salvage Run", target, reward: 35, desc: `Mine ${target} Ore across the next five waves.` },
        { kind: "clean", name: "Clean Passage", target: 0, reward: 50, desc: "Clear the next five waves without losing a hull pip." },
        { kind: "shards", name: "Clear a Path", target: 8, reward: 45, desc: "Shatter 8 shards across the next five waves. Pulse and Afterburner both count." },
    ];
}
export const SPILL_EVENTS = {
    none: { name: "", hint: "" },
    cargo: { name: "CARGO RUPTURE", hint: "CARGO RUPTURE: marked lanes fill in bursts · salvage follows" },
    vein: { name: "GOLD VEIN", hint: "GOLD VEIN: a rich moving stream · follow it when the lane is clear" },
    lanes: { name: "CONVOY CROSSING", hint: "CONVOY: alternating marked lanes · move through the opening" },
    rig: { name: "RIG BREAKUP", hint: "RIG BREAKUP: successive marked debris sweeps · fly the open corridor" },
};
export const SPILL_SECTORS = [
    { name: "OUTER WRECKAGE", color: "#bd956b", subtitle: "Find your line" },
    { name: "CARGO FIELD", color: "#c99bff", subtitle: "Follow the salvage" },
    { name: "REACTOR DEBRIS", color: "#79dce0", subtitle: "Read the energy" },
    { name: "RIG CORE", color: "#ffb46a", subtitle: "Weather the breakup" },
];
export function spillSector(wave) { return SPILL_SECTORS[Math.min(3, Math.floor((wave - 1) / 5))]; }
export function spillEventFor(wave, seed) {
    if (wave % 20 === 0 || wave === 10)
        return "rig";
    if (wave % 5)
        return "none";
    if (wave === 5)
        return "cargo";
    return ["cargo", "vein", "lanes"][((seed >>> 0) + Math.floor(wave / 5)) % 3];
}
export function spillMastery(best) {
    const tiers = [
        { at: 0, title: "New Arrival", finish: "Stock", color: "#c99bff" },
        { at: 5, title: "Salvager", finish: "Copper Signal", color: "#efb07a" },
        { at: 10, title: "Surveyor", finish: "Cobalt Signal", color: "#79cfff" },
        { at: 20, title: "Spillbreaker", finish: "Corelight Signal", color: "#ffe27a" },
        { at: 30, title: "Deep Diver", finish: "Void Signal", color: "#c1a5ff" },
    ];
    const reached = tiers.filter(t => best >= t.at);
    return { current: reached[reached.length - 1], next: tiers.find(t => t.at > best) ?? null };
}
