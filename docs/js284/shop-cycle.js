import { BUNDLES, DUST_STICKER, HELMETS, PALS, SHOP_CYCLE, SUITS, bundleIds, isIap, wearsOwnHead, } from "./catalog.js?v=284";
const modulo = (n, length) => ((n % length) + length) % length;
/** A date-seeded draw. The inputs are copied; neither catalog nor save is mutated. */
function dealFrom(pool, count, seed) {
    const items = [...pool];
    let state = Math.imul(seed, 2654435761) >>> 0;
    for (let i = items.length - 1; i > 0; i--) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const j = state % (i + 1);
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items.slice(0, Math.max(0, count));
}
/** The complete daily storefront, independent of the engine, clock and save format. */
export function selectShopCycle(day, owns) {
    day = Math.floor(day);
    const excluded = new Set(SHOP_CYCLE.excludedIds);
    const excludedBundles = new Set(SHOP_CYCLE.excludedBundleIds);
    const offers = BUNDLES.filter(b => !excludedBundles.has(b.id)
        && !b.items.some(item => excluded.has(item.id)) && !bundleIds(b).every(owns));
    const open = offers.filter(b => !b.fixed && !b.alwaysAvailable);
    const feature = open.length ? open[modulo(day, open.length)] : null;
    const always = offers.filter(b => b.alwaysAvailable);
    const held = new Set(feature && !feature.keepSingles ? bundleIds(feature) : []);
    const eligible = (id) => isIap(id) && !excluded.has(id) && !held.has(id) && !owns(id);
    const suitPool = SUITS.filter(suit => eligible(suit.id)).map(suit => suit.id);
    const premium = suitPool.filter(id => DUST_STICKER[id] !== undefined);
    const cheaper = suitPool.filter(id => DUST_STICKER[id] === undefined);
    // Rotate one available premium instead of pinning all four every day.
    const suits = premium.length && SHOP_CYCLE.premiumSuits > 0
        ? [premium[modulo(day, premium.length)]] : [];
    suits.push(...dealFrom(cheaper, Math.min(SHOP_CYCLE.suits, SHOP_CYCLE.maxItems) - suits.length, day * 7 + 1));
    // Shared suit/helmet ownership keys appear once. Their matching helmet
    // already comes with the suit, rather than becoming a second cart toggle.
    const selected = new Set(suits);
    const shownSuits = SUITS.filter(suit => selected.has(suit.id));
    const helmPool = HELMETS.filter(helm => eligible(helm.id) && !selected.has(helm.id));
    const helmRank = (id) => {
        const helm = HELMETS.find(item => item.id === id);
        const compatible = shownSuits.some(suit => !wearsOwnHead(suit)
            && (!helm.suitOnly || helm.suitOnly === suit.id));
        const coordinated = BUNDLES.some(bundle => bundle.items.some(item => item.kind === "suit" && selected.has(item.id))
            && bundle.items.some(item => item.kind === "helm" && item.id === id));
        return (compatible ? 2 : 0) + (coordinated ? 1 : 0);
    };
    const gearSlots = Math.max(0, SHOP_CYCLE.maxItems - suits.length);
    const helmCandidates = [];
    for (const rank of [3, 2, 1, 0]) {
        const pool = helmPool.filter(helm => helmRank(helm.id) === rank).map(helm => helm.id);
        helmCandidates.push(...dealFrom(pool, Math.min(SHOP_CYCLE.helms, gearSlots) - helmCandidates.length, day * 13 + 5 + rank));
    }
    const looks = new Set([...suits, ...helmCandidates]);
    const palPool = PALS.filter(pal => eligible(pal.id) && !looks.has(pal.id)).map(pal => pal.id);
    const palMatches = (pal, kind, ids) => BUNDLES.some(bundle => bundle.items.some(item => item.kind === kind && ids.includes(item.id))
        && bundle.items.some(item => item.kind === "pal" && item.id === pal));
    // Match the selected suits first. A helmet's companion must not displace
    // the companion belonging to the main look (for example Robo/Nightglider).
    const suitPals = palPool.filter(id => palMatches(id, "suit", suits));
    const palSlots = Math.min(SHOP_CYCLE.pals, Math.max(0, gearSlots - Math.min(SHOP_CYCLE.minHelms, helmCandidates.length)));
    // Only match helmets that remain when the PAL takes a card. Preserve the
    // compatibility ranking rather than swapping in a lower-ranked helmet.
    const retainedHelms = helmCandidates.slice(0, gearSlots - palSlots);
    const helmPals = palPool.filter(id => palMatches(id, "helm", retainedHelms));
    const matchedPals = suitPals.length ? suitPals : helmPals;
    // Normally the two gear slots are one helmet plus one PAL, or two helmets.
    // Backfill a missing helmet/suit slot with an eligible PAL even on a no-PAL
    // date, while keeping the category limits and never repeating a paid ID.
    const wantPal = matchedPals.length > 0 || modulo(day, 2) !== 0 || helmCandidates.length < gearSlots;
    const pals = dealFrom(matchedPals.length ? matchedPals : palPool, wantPal ? palSlots : 0, day * 17 + 9);
    const helms = helmCandidates.slice(0, gearSlots - pals.length);
    return { day, feature, always, held, excluded, suits, helms, pals, owns };
}
