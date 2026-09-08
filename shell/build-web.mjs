// BUILD THE APP'S WEB FOLDER. Copies the production page out of ../docs
// into ./www, leaving behind everything a store build must not carry:
// the beta page, the lab prototypes, the archived v1x pages and every
// stamped js<N> folder except the live one. Then bundles the adapter
// and points the page's module script at it. Run by every npm script.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const www = join(here, "www");
const cfg = JSON.parse(readFileSync(join(here, "app.config.json"), "utf8"));

const html = readFileSync(join(docs, "index.html"), "utf8");
// the page boots with an inline module script that imports js<N> and
// falls back to js/; the app routes that one import through the adapter
const m = html.match(/<script type="module">(?:(?!<\/script>)[\s\S])*?import\("(\.\/js(\d+)\/standalone\.js)"\)[\s\S]*?<\/script>/);
if (!m) throw new Error("docs/index.html: boot script not found");
const [tag, bundle, stamp] = m;

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
const SKIP = new Set(["beta", "lab", "index.html"]);
for (const name of readdirSync(docs)) {
  if (SKIP.has(name)) continue;
  if (/^js\d+$/.test(name) && name !== `js${stamp}`) continue;
  // the app is portrait-only: the wide film and its plate stay on the web
  cpSync(join(docs, name), join(www, name), { recursive: true, filter: (src) => !/intro-wide\.|film-backdrop-wide\./.test(src) });
}
// the page: same file, module script routed through the adapter
writeFileSync(join(www, "index.html"), html.replace(tag,
  `<script type="module" src="./shell/adapter.js" data-bundle="${bundle}"></script>`));

// the adapter: the shell's plugin ids, then the bundle
mkdirSync(join(www, "shell"), { recursive: true });
writeFileSync(join(here, "adapter", "config.json"), JSON.stringify({
  products: cfg.products, leaderboards: cfg.leaderboards, revenuecat: cfg.revenuecat,
}, null, 2));
execSync(`npx esbuild adapter/adapter.js --bundle --format=esm --target=es2020 --outfile=www/shell/adapter.js --log-level=warning`, { cwd: here, stdio: "inherit" });

const size = (p) => { let n = 0; for (const f of readdirSync(p)) { const q = join(p, f); const s = statSync(q); n += s.isDirectory() ? size(q) : s.size; } return n; };
console.log(`www built from docs (stamp ${stamp}): ${(size(www) / 1048576).toFixed(0)} MB, bundle ${bundle}`);
if (!existsSync(join(www, "fonts", "fonts.css"))) console.warn("WARNING: fonts missing - the page would reach the network");
