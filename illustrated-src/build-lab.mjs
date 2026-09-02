// Builds the lab experiments ONLY. Deliberately separate from
// export-sandbox.mjs: a prototype must not be able to break the shipping
// build, and nothing here is imported by the game.
//
//   node illustrated-src/build-lab.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeTables } from "./lab/rig-tables.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function tsc(entry, outDir) {
  mkdirSync(outDir, { recursive: true });
  const args = [
    entry,
    "--outDir", outDir,
    "--module", "es2020",
    "--target", "es2020",
    "--skipLibCheck",
    "--moduleResolution", "bundler",
    "--declaration", "false",
    "--strict", "false",
  ];
  const tscModule = process.env.ACORNAUT_TSC;
  if (tscModule) {
    execFileSync(process.execPath, [tscModule, ...args], { cwd: root, stdio: "inherit" });
  } else {
    execFileSync("npx", ["tsc", ...args], { cwd: root, stdio: "inherit" });
  }
}

tsc("illustrated-src/lab/rig.ts", join(root, "docs/lab/rig/js"));
tsc("illustrated-src/lab/skytest.ts", join(root, "docs/lab/skytest/js"));
tsc("illustrated-src/lab/ship.ts", join(root, "docs/lab/ship/js"));

// The rig editor opens on the shipping numbers, read straight out of
// draw.ts at build time.
const t = writeTables(root, join(root, "docs/lab/rig"));
console.log(
  "built lab: docs/lab/rig/js, docs/lab/skytest/js, docs/lab/ship/js " +
    `(${t.suits.length} heads, ${t.helmets.length} helmets, art v${t.artVer})`,
);
