#!/usr/bin/env node
// Build the game into docs/, which is the GitHub Pages root and the only
// tree that ships.
//
// This used to build into sandbox_assets/ and then COPY everything into
// docs/, leaving two byte-identical trees in the repository - 85 MB of
// duplicate art, a mirror step in every art script, and two QA checks whose
// only job was to confirm the copy still matched the original. Nothing ever
// loaded from sandbox_assets: no page, no manifest, no deploy. It was the
// original output directory from before docs/ existed, kept in step for
// years for nothing. One tree now.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = join(root, "docs");
// Painted zone masters are copied by the same production/beta export.
mkdirSync(join(pages, "art/zone-scenes"), { recursive: true });
for (const id of ["deep-space", "rust-belt", "blackout-zone", "crystal-belt", "hypervivid", "neon-bazaar", "prism-storm", "event-horizon"]) {
  cpSync(join(root, `art-src/zone-scenes/${id}.png`), join(pages, `art/zone-scenes/${id}.png`));
}
const catalog = readFileSync(join(root, "illustrated-src/game/catalog.ts"), "utf8");
const ver = (catalog.match(/ART_VER = "([^"]+)"/) || [])[1] || "0";

const sources = [
  "illustrated-src/game/catalog.ts",
  "illustrated-src/game/campaign.ts",
  "illustrated-src/game/save.ts",
  "illustrated-src/game/sim.ts",
  "illustrated-src/game/draw.ts",
  "illustrated-src/game/art.ts",
  "illustrated-src/game/audio.ts",
  "illustrated-src/game/engine.ts",
  "illustrated-src/game/spill.ts",
  "illustrated-src/game/standalone.ts",
  "illustrated-src/game/cosmetics.ts",
];
rmSync(join(pages, "js"), { recursive: true, force: true });
mkdirSync(join(pages, "js"), { recursive: true });
const tscArgs = [
  ...sources,
  "--outDir", "docs/js",
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
for (const name of readdirSync(join(pages, "js"))) {
  if (!name.endsWith(".js")) continue;
  const p = join(pages, "js", name);
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

// the cache-stamped copy the loader actually imports
const stamped = join(pages, `js${ver}`);
rmSync(stamped, { recursive: true, force: true });
cpSync(join(pages, "js"), stamped, { recursive: true });

// KEEP THE LAST FEW STAMPS. index.html is the one unversioned file we ship,
// so a browser can hold a cached copy of it that names an OLDER js<VER>
// folder. Deleting the previous stamp by hand on every release - which is
// how this repo used to do it - turns every one of those cached pages into
// a 404 and a blank screen. It happened on 2 Sep 2026, and the tell was
// that a private window worked fine.
//
// Pruning belongs here rather than in a human's release checklist: a step
// you have to remember is a step you eventually forget. Keep RETAIN stamps
// (this one plus the previous few) and drop only what is older than that.
const RETAIN = 4;
const stamps = readdirSync(pages)
  .filter((d) => /^js\d+$/.test(d))
  .sort((a, b) => Number(b.slice(2)) - Number(a.slice(2)));
for (const old of stamps.slice(RETAIN)) {
  rmSync(join(pages, old), { recursive: true, force: true });
  console.log(`  pruned stale stamp ${old}`);
}

const idx = join(pages, "index.html");
// \d+, NOT \d*: with a star this also matched the UNVERSIONED "./js/..."
// and rewrote it to the stamped path, which silently collapsed the
// loader's fallback into a second copy of the same failing import - the
// fallback looked present in the source and did nothing in the build.
const zoneCss = readFileSync(join(root, "illustrated-src/star-map.css"), "utf8");
const zoneStyle = `<style id="ac-star-map-css">${zoneCss}</style>`;
let shell = readFileSync(idx, "utf8");
shell = shell.includes('<style id="ac-star-map-css">')
  ? shell.replace(/<style id="ac-star-map-css">[\s\S]*?<\/style>/, zoneStyle)
  : shell.replace("</head>", `${zoneStyle}\n</head>`);
writeFileSync(idx, shell);
writeFileSync(idx, readFileSync(idx, "utf8")
  .replace(/\.\/js\d+\/standalone\.js/g, `./js${ver}/standalone.js`));

// The BETA page: the same document, one flag and one directory deeper.
// Regenerated from the production page on every export so the two can never
// drift. The flag must be set before the module loads - catalog.ts reads it
// at import time - so it rides the same script tag that already runs ahead
// of the loader.
const outDir = join(pages, "beta");
const html = readFileSync(idx, "utf8")
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

const man = JSON.parse(readFileSync(join(pages, "manifest.webmanifest"), "utf8"));
man.name = "Acornaut Beta";
man.short_name = "Acornaut β";
man.start_url = "./";
man.scope = "./";
man.icons = (man.icons || []).map((i) => ({ ...i, src: `../${i.src}` }));
writeFileSync(join(outDir, "manifest.webmanifest"), JSON.stringify(man, null, 2) + "\n");

console.log(`exported js + js${ver} to docs (+ beta page)`);
