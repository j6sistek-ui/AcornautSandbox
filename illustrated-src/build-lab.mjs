// Builds the lab experiments ONLY. Deliberately separate from
// export-sandbox.mjs: a prototype must not be able to break the shipping
// build, and nothing here is imported by the game.
//
//   node illustrated-src/build-lab.mjs
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs/lab/spill/js");
mkdirSync(out, { recursive: true });

execSync(
  `npx tsc illustrated-src/lab/spill.ts --outDir ${JSON.stringify(out)} ` +
    "--module es2020 --target es2020 --skipLibCheck --moduleResolution bundler " +
    "--declaration false --strict false",
  { cwd: root, stdio: "inherit" },
);

console.log("built lab: docs/lab/spill/js");
