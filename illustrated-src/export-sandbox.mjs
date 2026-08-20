#!/usr/bin/env node
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "sandbox_assets");
const catalog = readFileSync(join(root, "illustrated-src/game/catalog.ts"), "utf8");
const ver = (catalog.match(/ART_VER = "([^"]+)"/) || [])[1] || "0";
mkdirSync(join(out, "js"), { recursive: true });
mkdirSync(join(out, "art"), { recursive: true });

execSync(
  [
    "npx tsc",
    "illustrated-src/game/catalog.ts illustrated-src/game/campaign.ts illustrated-src/game/save.ts illustrated-src/game/sim.ts illustrated-src/game/draw.ts",
    "illustrated-src/game/art.ts illustrated-src/game/audio.ts illustrated-src/game/engine.ts illustrated-src/game/standalone.ts",
    "illustrated-src/game/cosmetics.ts",
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
    (_, q, spec, q2) => {
      const file = spec.endsWith(".js") ? spec : `${spec}.js`;
      const bare = file.replace(/\?.*$/, "");
      return `from ${q}${bare}?v=${ver}${q2}`;
    },
  );
  writeFileSync(p, next);
}

const stamped = join(out, `js${ver}`);
rmSync(stamped, { recursive: true, force: true });
cpSync(join(out, "js"), stamped, { recursive: true });

// publish to the GitHub Pages root too: fresh js/, a cache-stamped
// js{ver}/, and the loader import bumped to match
const pages = join(root, "docs");
rmSync(join(pages, "js"), { recursive: true, force: true });
cpSync(join(out, "js"), join(pages, "js"), { recursive: true });
rmSync(join(pages, `js${ver}`), { recursive: true, force: true });
cpSync(join(out, "js"), join(pages, `js${ver}`), { recursive: true });
for (const dir of [root, pages]) {
  const idx = join(dir, dir === pages ? "index.html" : "sandbox_assets/index.html");
  try {
    const html = readFileSync(idx, "utf8");
    writeFileSync(idx, html.replace(/\.\/js\d*\/standalone\.js/g, `./js${ver}/standalone.js`));
  } catch {}
}
console.log(`exported js + js${ver} to sandbox_assets and docs`);
