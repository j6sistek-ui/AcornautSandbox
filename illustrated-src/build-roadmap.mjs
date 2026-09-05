// Prints the ENTIRE Star Chart — all 100 levels, goals, modifiers and the
// reward ladder — into ROADMAP.md, straight from campaign.ts. The document
// is generated so it can never drift from the game the way PARITY.md once
// did: change a level and the roadmap follows on the next build.
//
//   node illustrated-src/build-roadmap.mjs
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "roadmap-"));
const compiler = process.env.ACORNAUT_TSC
  ? `${JSON.stringify(process.execPath)} ${JSON.stringify(process.env.ACORNAUT_TSC)}`
  : "npx --yes --package typescript@5.9.2 tsc";
execSync(
  `${compiler} illustrated-src/game/campaign.ts --outDir ${JSON.stringify(tmp)} ` +
    "--module commonjs --target es2020 --skipLibCheck --moduleResolution node --declaration false --strict false",
  { cwd: root, stdio: "inherit" },
);
const mod = await import(pathToFileURL(join(tmp, "campaign.js")).href);
const { STAGES, LEVELS, STAR_REWARDS, goalText, fxText } = mod;

// the reward ladder's stage rows must agree with the stages themselves
for (const st of STAGES) {
  if (st.unlock === 0) continue;
  const row = STAR_REWARDS.find((r) => r.kind === "stage" && r.name.includes(st.name));
  if (!row || row.stars !== st.unlock) {
    throw new Error(`reward ladder disagrees with stage ${st.num} (${st.name}): ${row?.stars} vs ${st.unlock}`);
  }
}

const envName = (() => {
  const cat = readFileSync(join(root, "illustrated-src/game/catalog.ts"), "utf8");
  const names = [...cat.matchAll(/\{ name: "([A-Z ]+)", wash:/g)].map((m) => m[1]);
  return (i) => names[i] ?? `ENV ${i}`;
})();

const MODE = { fly: "Normal", deep: "Deep Space", lost: "Lost in Space", arcade: "Arcade", spill: "The Spill", tunnel: "Wormhole Run", race: "Hyper Run" };

let md = `# The Star Chart — campaign roadmap

*Generated from \`illustrated-src/game/campaign.ts\` by \`build-roadmap.mjs\`.
Do not edit by hand — change the campaign and rebuild.*

One hundred levels in ten chapters. Flight missions end at a golden portal
after their gate count. Level 8 of chapters 2–10 is a Spill mission: survive
the stated number of waves, with an untimed Depot every fifth wave. Three stars per level:

- **★1** finish the route or clear the required waves
- **★2** a collection goal — acorns, golden acorns, or Ore
- **★3** a discipline goal — no bounces, no shields, a tap budget, or no hull hits

Stars are independent and **kept across runs**: a level can be starred one
goal at a time. **Total stars** open chapters and buy the reward ladder —
progression is earned by doing, not by mileage. Endless mode is untouched;
flight mods are disabled inside levels so a star certifies the same flight
for everyone.

**300 stars total.**

## The reward ladder

| ★ | Reward |
|---:|---|
`;
for (const r of STAR_REWARDS) md += `| ${r.stars} | **${r.name}** — ${r.desc} |\n`;

md += `\n## The chapters\n`;
for (const st of STAGES) {
  md += `\n### Chapter ${st.num} — ${st.name}  *(opens at ${st.unlock}★)*\n\n`;
  md += `*${st.tagline}* · Sky: **${envName(st.env)}**\n\n`;
  md += `| # | Level | Base | Gates | Modifiers | ★2 | ★3 |\n|---|---|---|---:|---|---|---|\n`;
  for (const lvl of LEVELS.filter((l) => l.stage === st.num)) {
    const fxs = fxText(lvl.fx).join(", ") || "—";
    md += `| ${lvl.ord} | **${lvl.name}** | ${MODE[lvl.base]} | ${lvl.gates} | ${fxs} | ${goalText(lvl.goals[1], lvl)} | ${goalText(lvl.goals[2], lvl)} |\n`;
  }
}

md += `
## Design notes

- **The portal is an arrival, not an obstacle.** Once the last gate is
  passed the field stops spawning and the portal stands alone in clear sky.
- **Collection goals are never hostage to dice.** Levels with an acorn goal
  guarantee one acorn per gate (\`fx.acornEvery\`), so "collect N" is always
  achievable with room to miss a few.
- **THE BLACKOUT (Chapter 9)** is the strobe idea: the world is lit for the
  half-second after each tap, then fades to black. Taps are sight — which is
  why its tap-budget goals are generous rather than tight.
- **Fog (Chapter 5)** closes a sight circle around the pilot; **turbulence
  (Chapter 7)** exposes the drift dials; **Chapters 6, 8 and the finale** borrow
  the deep-space, lost-in-space and arcade machinery whole.
- **Difficulty ramps three ways at once**, deliberately gently: gate counts
  rise within each chapter, modifiers sharpen across chapters, and the star
  goals tighten. A pilot who only ever takes ★1 can still walk the whole
  chart; the last stages' unlock totals demand roughly two stars a level.
- **Refinement path**: two modes are queued as future chapters once they
  earn a place on the live chart, both flyable today from the Modes sheet.
  **Wormhole Run** lives in the engine as a FlightMode with sections, a
  deterministic seed and its own counters (sections, Flow tier, chains,
  near misses), so a Wormhole chapter's goals write themselves: *reach
  section N* is the portal, *best Flow x3* and *no near-miss spent* are
  the discipline stars. **The Spill** is a wave ladder with a hull and its
  own Ore economy, and the beta chart already flies it as level 8 of every
  chapter from 2: *clear wave N* is the portal, *mine N Ore* and *take no
  hull damage* the stars. New modifiers (mirror-only, tiny-pilot,
  heavy-gravity) are one line each in \`LevelFx\`.
`;

writeFileSync(join(root, "ROADMAP.md"), md);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ROADMAP.md — ${LEVELS.length} levels, ${STAR_REWARDS.length} rewards`);
