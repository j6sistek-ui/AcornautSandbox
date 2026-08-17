#!/usr/bin/env node
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "sandbox_assets");
mkdirSync(join(out, "js"), { recursive: true });
mkdirSync(join(out, "art"), { recursive: true });

execSync(
  [
    "npx tsc",
    "src/game/catalog.ts src/game/save.ts src/game/sim.ts src/game/draw.ts",
    "src/game/art.ts src/game/audio.ts src/game/engine.ts src/game/standalone.ts",
    "--outDir sandbox_assets/js --module es2015 --target es2020",
    "--skipLibCheck --moduleResolution bundler --declaration false --strict false",
  ].join(" "),
  { cwd: root, stdio: "inherit" },
);

for (const name of readdirSync(join(out, "js"))) {
  if (!name.endsWith(".js")) continue;
  const p = join(out, "js", name);
  const next = readFileSync(p, "utf8").replace(
    /from (['"])(\.\/[^'"]+)(\1)/g,
    (_, q, spec, q2) => `from ${q}${spec.endsWith(".js") ? spec : spec + ".js"}${q2}`,
  );
  writeFileSync(p, next);
}

cpSync(join(root, "public/art"), join(out, "art"), { recursive: true });
console.log("exported sandbox_assets");
