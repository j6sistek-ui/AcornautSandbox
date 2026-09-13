// BUILD THE CRAZYGAMES UPLOAD (13 Sep 2026, owner: "publish to crazy
// games"). Copies the production page out of ../docs into
// ./crazygames-dist, leaving behind what a portal must not carry (the
// beta page, the lab, retired js<N> stamps, the GitHub Pages CNAME and
// privacy page), routes the page's module script through the CrazyGames
// adapter, adds the SDK script tag, and zips the folder for the developer
// portal. Then it prints the budget against the portal's limits.
//
//   node shell/build-crazygames.mjs            build + zip
//   node shell/build-crazygames.mjs --no-zip   build only
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const out = join(here, "crazygames-dist");
const zipName = "acornaut-crazygames.zip";

// the portal's published limits (docs.crazygames.com/requirements/technical)
export const LIMITS = { totalMB: 250, files: 1500, initialMB: 50, initialMobileMB: 20, loadSeconds: 10 };

const html = readFileSync(join(docs, "index.html"), "utf8");
const m = html.match(/<script type="module">(?:(?!<\/script>)[\s\S])*?import\("(\.\/js(\d+)\/standalone\.js)"\)[\s\S]*?<\/script>/);
if (!m) throw new Error("docs/index.html: boot script not found");
const [tag, bundle, stamp] = m;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// never in the upload: the beta page, the lab, the Pages hostname, the
// privacy page (the portal has its own), older stamps (no cached HTML can
// ask for them - the zip is one version)
const SKIP = new Set(["beta", "lab", "index.html", "CNAME", "privacy.html", "robots.txt", "sitemap.xml"]);
for (const name of readdirSync(docs)) {
  if (SKIP.has(name)) continue;
  if (/^js\d+$/.test(name) && name !== `js${stamp}`) continue;
  cpSync(join(docs, name), join(out, name), { recursive: true });
}
mkdirSync(join(out, "crazygames"), { recursive: true });
cpSync(join(here, "crazygames", "adapter.js"), join(out, "crazygames", "adapter.js"));

// the page: the SDK first, then the adapter, which loads the bundle
let page = html
  .replace("</head>", `  <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n</head>`)
  .replace(tag, `<script type="module" src="./crazygames/adapter.js" data-bundle="${bundle}" data-crazygames="1"></script>`);
// the portal is not a PWA host: no manifest, no install prompt
page = page.replace(/\s*<link rel="manifest"[^>]*>/, "");
writeFileSync(join(out, "index.html"), page);

// the budget
const walk = (p, acc) => { for (const f of readdirSync(p)) { const q = join(p, f); const s = statSync(q); if (s.isDirectory()) walk(q, acc); else { acc.files++; acc.bytes += s.size; } } return acc; };
const total = walk(out, { files: 0, bytes: 0 });
const mb = (b) => (b / 1048576).toFixed(1);
const problems = [];
if (total.files > LIMITS.files) problems.push(`${total.files} files > ${LIMITS.files} allowed`);
if (total.bytes / 1048576 > LIMITS.totalMB) problems.push(`${mb(total.bytes)} MB > ${LIMITS.totalMB} MB allowed`);
console.log(`crazygames-dist built from docs (stamp ${stamp}): ${total.files} files, ${mb(total.bytes)} MB, bundle ${bundle}`);
console.log(`  limits: ${LIMITS.files} files, ${LIMITS.totalMB} MB total, ${LIMITS.initialMB} MB initial download (${LIMITS.initialMobileMB} MB for the mobile homepage), ${LIMITS.loadSeconds} s load`);
for (const p of problems) console.log(`  OVER BUDGET: ${p}`);
if (!existsSync(join(out, "fonts", "fonts.css"))) console.warn("WARNING: fonts missing - the page would reach the network");

if (!process.argv.includes("--no-zip")) {
  rmSync(join(here, zipName), { force: true });
  execSync(`cd "${out}" && zip -qr "../${zipName}" .`, { stdio: "inherit" });
  console.log(`  zip: shell/${zipName} (${mb(statSync(join(here, zipName)).size)} MB)`);
}
if (problems.length) process.exitCode = 2;
