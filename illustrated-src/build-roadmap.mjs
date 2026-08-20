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
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "roadmap-"));
execSync(
  `npx tsc illustrated-src/game/campaign.ts --outDir ${JSON.stringify(tmp)} ` +
    "--module es2020 --target es2020 --skipLibCheck --moduleResolution bundler --declaration false --strict false",
  { cwd: root, stdio: "inherit" },
);
const mod = await import(join(tmp, "campaign.js"));
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

const MODE = { fly: "Normal", deep: "Deep Space", lost: "Lost in Space", arcade: "Arcade" };

let md = `# The Star Chart — campaign roadmap

*Generated from \`illustrated-src/game/campaign.ts\` by \`build-roadmap.mjs\`.
Do not edit by hand — change the campaign and rebuild.*

One hundred levels in ten chapters. Every level is an ordinary run wearing a
finish line: pass its gate count and a golden portal spawns in clear sky —
fly into it and the level is complete. Three stars per level:

- **★1** reach the portal (the finish itself)
- **★2** a collection goal — acorns or golden acorns
- **★3** a discipline goal — no bounces, no shields, a tap budget

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
- **Refinement path**: two experiments are queued as future chapters once
  they earn promotion, both reachable today from the bottom of Help.
  **Wormhole Run** is the nearer fit — it already lives in the engine as a
  FlightMode with sections, a deterministic seed and its own counters
  (sections, Flow tier, chains, near misses), so a Wormhole chapter's goals
  write themselves: *reach section N* is the portal, *best Flow x3* and
  *no near-miss spent* are the discipline stars. **The Spill** (lab page)
  needs engine integration first; its survive-T-seconds shape drops
  straight into the goal system after that. New modifiers (mirror-only,
  tiny-pilot, heavy-gravity) are one line each in \`LevelFx\`.
`;

writeFileSync(join(root, "ROADMAP.md"), md);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ROADMAP.md — ${LEVELS.length} levels, ${STAR_REWARDS.length} rewards`);
