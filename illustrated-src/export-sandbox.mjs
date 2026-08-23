#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "sandbox_assets");
const catalog = readFileSync(join(root, "illustrated-src/game/catalog.ts"), "utf8");
const ver = (catalog.match(/ART_VER = "([^"]+)"/) || [])[1] || "0";
mkdirSync(join(out, "js"), { recursive: true });
mkdirSync(join(out, "art"), { recursive: true });

const sources = [
  "illustrated-src/game/catalog.ts",
  "illustrated-src/game/campaign.ts",
  "illustrated-src/game/save.ts",
  "illustrated-src/game/sim.ts",
  "illustrated-src/game/draw.ts",
  "illustrated-src/game/art.ts",
  "illustrated-src/game/audio.ts",
  "illustrated-src/game/engine.ts",
  "illustrated-src/game/standalone.ts",
  "illustrated-src/game/cosmetics.ts",
];
const tscArgs = [
  ...sources,
  "--outDir", "sandbox_assets/js",
  "--module", "es2015",
  "--target", "es2020",
  "--skipLibCheck",
  "--moduleResolution", "bundler",
  "--declaration", "false",
  "--strict", "false",
];
const tscModule = process.env.ACORNAUT_TSC;
if (tscModule) {
  execFileSync(process.execPath, [tscModule, ...tscArgs], { cwd: root, stdio: "inherit" });
} else {
  execFileSync("npx", ["tsc", ...tscArgs], { cwd: root, stdio: "inherit" });
}

const buildTime = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
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
  ).replace("__BUILD_TIME__", buildTime);
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

// The BETA page: the same document, one flag and one directory deeper.
// Regenerated from the production page on every export so the two can
// never drift. The flag must be set before the module loads — catalog.ts
// reads it at import time — so it rides the same script tag that already
// runs ahead of the loader.
for (const dir of [root, pages]) {
  const srcIdx = join(dir, dir === pages ? "index.html" : "sandbox_assets/index.html");
  const outDir = join(dir, dir === pages ? "beta" : "sandbox_assets/beta");
  const html = readFileSync(srcIdx, "utf8")
    .replaceAll('"./', '"../')
    .replace(/<title>[^<]*<\/title>/, "<title>Acornaut · Beta</title>")
    // the beta gets its OWN manifest, scoped to /beta/ — pointing at the
    // root manifest made "Add to Home Screen" install the LIVE game
    .replace('href="../manifest.webmanifest"', 'href="./manifest.webmanifest"')
    .replace(
      'window.__ACORNAUT_ART__',
      'window.__ACORNAUT_BETA__ = true;\n    window.__ACORNAUT_ART__',
    );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);

  const rootManifest = join(dir, dir === pages ? "manifest.webmanifest" : "sandbox_assets/manifest.webmanifest");
  const man = JSON.parse(readFileSync(rootManifest, "utf8"));
  man.name = "Acornaut Beta";
  man.short_name = "Acornaut β";
  man.start_url = "./";
  man.scope = "./";
  man.icons = (man.icons || []).map((i) => ({ ...i, src: `../${i.src}` }));
  writeFileSync(join(outDir, "manifest.webmanifest"), JSON.stringify(man, null, 2) + "\n");
}
console.log(`exported js + js${ver} to sandbox_assets and docs (+ beta pages)`);
