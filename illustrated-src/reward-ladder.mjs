#!/usr/bin/env node
// THE REWARD LADDER, GENERATED. Owner, 8 Sep 2026: "Unlock SOMETHING every
// 5 stars... keep each group evenly spaced, so there will be somewhat of a
// pattern. like trail, buddy, helmet (matching upcoming suit IF it does
// match), acorns, star dust, suit. Then repeat."
//
// The 780-star road is cut into 26 blocks of 30 stars. Each block has six
// rungs, five stars apart, in the owner's order: trail, pal, helmet,
// acorns, dust, suit. Every family's items are spread evenly across the
// blocks in their existing quality order; a block that has no item of a
// family pays currency in that slot instead. A helmet that matches a suit
// rides the helmet slot of that suit's block; AcorNut's wake rides the
// trail slot of AcorNut's block. Mode and mod gates keep their own rungs
// (snapped to fives) on top of the pattern. Currency escalates with the
// block, so the far road pays more per rung than the opening.
//
//   node illustrated-src/reward-ladder.mjs          # rewrite campaign.ts
//   node illustrated-src/reward-ladder.mjs --print  # show the plan only
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "game", "campaign.ts");
const src = readFileSync(file, "utf8");

// ---- what exists today, in its current (quality) order -------------------
const begin = src.indexOf("export const STAR_REWARDS: StarReward[] = [");
const end = src.indexOf("\n];", begin) + 3;
const block = src.slice(begin, end);
const rows = [...block.matchAll(/\{ stars: (\d+), kind: "(\w+)", (?:id: "([^"]+)", )?name: "([^"]+)", desc: "([^"]*)"(?:, amount: (\d+))? \}/g)]
  .map((m) => ({ stars: +m[1], kind: m[2], id: m[3], name: m[4], desc: m[5], amount: m[6] ? +m[6] : undefined }))
  .sort((a, b) => a.stars - b.stars);
const by = (kind) => rows.filter((r) => r.kind === kind);
const clean = (d) => d.replace(/\s*Earned at \d+ stars\.?/g, "").replace(/\s*Earned here or available early in the shop\./g, "").replace(/\s*Earned on the Star Chart; also available early in the Regalia Pack\./g, "").replace(/\s*A second chart milestone for the Opal Feather Trail\./, "").trim() || "Earned on the Star Chart.";

// A RUNG NEVER CHARGES (owner, 8 Sep 2026: "remove from star rung ... at
// those star rung replace with acorns for now. might add new asset later to
// replace"). These nine helmet rungs used to REVEAL a helmet the Loadout
// then charged 90-500 acorns for, so the road announced an unlock over a
// price tag. They pay acorns now, at their block's rate, and the helmets
// keep their shelf gate at the same star count - so the rung is what buys
// the thing it puts in the window.
//
// They stay in the POOL, holding the slots they always held, and only what
// gets WRITTEN changes. That is the whole trick: drop them instead and the
// eight surviving helmets re-spread, which walks the Ghost Suit to 60, the
// Cat Suit to 300, AcorNut to 550 and the Chronarch Helmet all the way down
// to 15 stars. Nothing else may move, so nothing else does. test-star-map
// holds the rule for whatever is dropped onto these rungs later.
const PRICED = new Set(["void", "comet", "cherry", "phoenix", "royal", "aurora", "princess", "meteor", "chrono"]);
// their entries as the list carried them, at the stars that fixed their
// order in the pool - the list itself no longer names them
for (const [stars, id, name, desc] of [
  [15, "void", "Void Helmet", "Obsidian glass, gold rim. In the shop."],
  [60, "comet", "Comet Helmet", "Molten amber glass. In the shop."],
  [70, "cherry", "Cherry Helmet", "Rose-tinted glass. In the shop."],
  [120, "phoenix", "Phoenix Helmet", "Firebird glass, ember rim. In the shop."],
  [180, "royal", "Royal Helmet", "Crowned. Obviously. In the shop."],
  [190, "aurora", "Aurora Helmet", "Polar light under glass. In the shop."],
  [300, "princess", "Rose Helmet", "Petal glass, violet rim. In the shop."],
  [540, "meteor", "Meteor Helmet", "Burnished impact glass. In the shop."],
  [560, "chrono", "Chrono Helmet", "Brass clockwork glass. In the shop."],
]) rows.push({ stars, kind: "helmet", id, name, desc });
rows.sort((a, b) => a.stars - b.stars);

const suits = by("suit");
const helmetsAll = by("helmet");
const matched = new Set(helmetsAll.filter((h) => suits.some((s) => s.id === h.id)).map((h) => h.id));
const helmets = helmetsAll.filter((h) => !matched.has(h.id));
const pals = by("pal");
const seen = new Set();
const trailsAll = by("trail").filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));   // one Opal Feather, not two
const trails = trailsAll.filter((t) => t.id !== "vanguardwake");
const gates = [...by("mode"), ...by("mod")];

// ---- the grid --------------------------------------------------------------
// Owner, 8 Sep 2026: "every 5 levels almost, maybe a few extra early on to
// motivate to get going" - at the two stars a level pilots actually earn,
// that is a rung every TEN stars, with extras at 5, 15 and 25 for the
// opening. The rungs are walked in blocks of six, one per kind in the
// owner's order; a family with more items than blocks spills its extras
// into the currency rungs of the same block, so content always outranks
// filler and nothing is ever dropped.
const MAX = 780, STEP = 10, EXTRA = [5, 15, 25];
const slots = [...new Set([...EXTRA, ...Array.from({ length: MAX / STEP }, (_, i) => (i + 1) * STEP)])].sort((a, b) => a - b);
const ORDER = ["trail", "pal", "helmet", "acorns", "dust", "suit"];
const BLOCKS = Math.ceil(slots.length / ORDER.length);
const spread = (items, blocks = BLOCKS) => {
  // first item in the first block, last in the last, even between; a block
  // may hold more than one when a family outnumbers the blocks
  const out = new Map();
  items.forEach((it, k) => {
    const b = items.length === 1 ? 0 : Math.round(k * (blocks - 1) / (items.length - 1));
    (out.get(b) ?? out.set(b, []).get(b)).push(it);
  });
  return out;
};
const suitAt = spread(suits);
const palAt = spread(pals);
const trailAt = spread(trails);
const helmetAt = new Map();
// matched helmets ride their suit's block; the free ones spread over the rest
for (const [b, list] of suitAt) for (const sIt of list) if (matched.has(sIt.id)) (helmetAt.get(b) ?? helmetAt.set(b, []).get(b)).push(helmetsAll.find((h) => h.id === sIt.id));
const freeBlocks = [...Array(BLOCKS).keys()].filter((b) => !helmetAt.has(b));
for (const [i, list] of spread(helmets, freeBlocks.length)) (helmetAt.get(freeBlocks[i]) ?? helmetAt.set(freeBlocks[i], []).get(freeBlocks[i])).push(...list);
const wakeBlock = [...suitAt].find(([, l]) => l.some((s) => s.id === "vanguard"))?.[0];
if (wakeBlock !== undefined) (trailAt.get(wakeBlock) ?? trailAt.set(wakeBlock, []).get(wakeBlock)).unshift(trailsAll.find((t) => t.id === "vanguardwake"));

const acornsFor = (b) => 100 + 70 * b;          // 100 .. ~1,000
const dustFor = (b) => 15 + Math.round(3.5 * b); // 15 .. ~60
const currency = (kind, b) => kind === "acorns"
  ? { kind: "acorns", amount: acornsFor(b), name: `${acornsFor(b).toLocaleString()} Acorns`, desc: "Spending acorns for the hangar." }
  : { kind: "dust", amount: dustFor(b), name: `${dustFor(b)} Star Dust`, desc: "Premium dust for the shop." };
const queues = { trail: trailAt, pal: palAt, helmet: helmetAt, suit: suitAt };
const carry = { trail: [], pal: [], helmet: [], suit: [] };   // a family's extras, carried to the next rung that can take them
const out = [];
slots.forEach((stars, i) => {
  const b = Math.floor(i / ORDER.length), kind = ORDER[i % ORDER.length];
  for (const f of Object.keys(queues)) { const l = queues[f].get(b); if (l && !l.__taken) { carry[f].push(...l); l.__taken = true; } }
  let r = null;
  if (kind in queues) r = carry[kind].shift() ?? null;
  if (!r) {
    // a currency rung, or a family with nothing due: content that spilled
    // over takes it first, filler last
    const f = Object.keys(carry).find((k) => carry[k].length);
    r = f ? carry[f].shift() : currency(kind === "dust" ? "dust" : "acorns", b);
    if (!f && !(kind === "acorns" || kind === "dust")) r = currency(out.filter((x) => x.kind === "acorns").length <= out.filter((x) => x.kind === "dust").length ? "acorns" : "dust", b);
  }
  // BY KIND AND ID, never the id alone: the Comet Booster and the Aurora
  // Ribbon are TRAILS that share their name-ids with these two helmets,
  // and a bare-id test quietly turned both trails into currency.
  if (r.kind === "helmet" && r.id && PRICED.has(r.id)) r = currency("acorns", b);   // the rung buys it; it does not hand it over
  out.push({ ...r, stars, desc: r.desc ? clean(r.desc) : r.desc });
});
// the road ends mid-block, so whatever the last block could not seat joins
// the final rung as a set - the completionist's prize is the biggest one
for (const f of Object.keys(carry)) for (const r0 of carry[f]) { const r = r0.kind === "helmet" && r0.id && PRICED.has(r0.id) ? currency("acorns", BLOCKS - 1) : r0; out.push({ ...r, stars: MAX, desc: r.desc ? clean(r.desc) : r.desc }); }
// the gates keep their own rungs (fives); a currency filler there gives way
const snap = (n) => Math.max(5, Math.round(n / 5) * 5);
for (const g of gates) {
  const stars = snap(g.stars);
  const i = out.findIndex((r) => r.stars === stars && (r.kind === "acorns" || r.kind === "dust"));
  if (i >= 0) out.splice(i, 1);
  out.push({ ...g, stars, desc: clean(g.desc) });
}
out.sort((a, b) => a.stars - b.stars || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

// ---- report ----------------------------------------------------------------
const rungs = new Set(out.map((r) => r.stars));
const fam = (k) => out.filter((r) => r.kind === k).map((r) => r.stars);
const gapOf = (a) => a.slice(1).map((v, i) => v - a[i]);
console.log(`${out.length} rewards on ${rungs.size} rungs (${slots.length} slots)`);
for (const k of ["suit", "helmet", "pal", "trail", "acorns", "dust"]) { const s = fam(k), g = gapOf(s); console.log(`  ${k.padEnd(7)} ${String(s.length).padStart(3)}  first ${s[0]}  last ${s[s.length - 1]}  gap ${Math.min(...g)}-${Math.max(...g)}`); }
console.log(`  dust total ${out.filter((r) => r.kind === "dust").reduce((a, r) => a + r.amount, 0)}, acorns total ${out.filter((r) => r.kind === "acorns").reduce((a, r) => a + r.amount, 0)}`);
console.log(`  gates: ${gates.map((g) => `${g.id} ${snap(g.stars)}`).join(", ")}`);
if (process.argv.includes("--print")) { for (const r of out) console.log(`${String(r.stars).padStart(3)}  ${r.kind.padEnd(7)} ${r.name}`); process.exit(0); }

// ---- write -----------------------------------------------------------------
const line = (r) => `  { stars: ${r.stars}, kind: "${r.kind}", ${r.id ? `id: "${r.id}", ` : ""}name: "${r.name}", desc: "${r.desc}"${r.amount ? `, amount: ${r.amount}` : ""} },`;
const text = `export const STAR_REWARDS: StarReward[] = [\n  // GENERATED by illustrated-src/reward-ladder.mjs - edit the generator, not this list\n${out.map(line).join("\n")}\n];`;
let next = src.slice(0, begin) + text + src.slice(end);
// the gates the save reads directly follow their rungs
for (const g of gates) {
  const key = { deep: "deep", lost: "lost", startShield: "startShield", battery: "battery", flightmods: "flightMods", dualpal: "dualPal" }[g.id];
  if (key) next = next.replace(new RegExp(`(\\n\\s*${key}: )\\d+(,)`), `$1${snap(g.stars)}$2`);
}
writeFileSync(file, next);
console.log("campaign.ts rewritten");
