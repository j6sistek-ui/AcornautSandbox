// Builds the lab experiments ONLY. Deliberately separate from
// export-sandbox.mjs: a prototype must not be able to break the shipping
// build, and nothing here is imported by the game.
//
//   node illustrated-src/build-lab.mjs
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeTables } from "./lab/rig-tables.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function tsc(entry, outDir) {
  mkdirSync(outDir, { recursive: true });
  execSync(
    `npx tsc ${entry} --outDir ${JSON.stringify(outDir)} ` +
      "--module es2020 --target es2020 --skipLibCheck --moduleResolution bundler " +
      "--declaration false --strict false",
    { cwd: root, stdio: "inherit" },
  );
}

tsc("illustrated-src/lab/spill.ts", join(root, "docs/lab/spill/js"));
tsc("illustrated-src/lab/rig.ts", join(root, "docs/lab/rig/js"));

// The rig editor opens on the shipping numbers, read straight out of
// draw.ts at build time.
const t = writeTables(root, join(root, "docs/lab/rig"));
console.log(
  "built lab: docs/lab/spill/js, docs/lab/rig/js " +
    `(${t.suits.length} heads, ${t.helmets.length} helmets, art v${t.artVer})`,
);
