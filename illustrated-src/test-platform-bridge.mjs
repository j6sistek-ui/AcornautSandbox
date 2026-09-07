// THE PLATFORM BRIDGE IS THE ONLY DOOR OUT. See SHIPPING.md. This test is
// the mechanical half of that rule: the game's TypeScript may not reach
// for browser storage, the network, or a real-money price except in the
// files that own them. A new feature that needs any of those goes through
// platform.ts, so the App Store shell and a future Steam shell keep
// working without a hunt through the codebase.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "game");
const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));

const RULES = [
  // storage: only the bridge touches localStorage
  { re: /\b(localStorage|sessionStorage|indexedDB)\b/, allow: ["platform.ts"], why: "browser storage belongs to platform.ts (platform.storage)" },
  // network: art.ts loads the bundle's own files; nothing else fetches
  { re: /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket/, allow: ["art.ts", "platform.ts"], why: "network calls belong to art.ts (bundle assets) or platform.ts" },
  // money: the catalog's stickers are the web placeholder; nothing else prints a price
  { re: /"\$\d+\.\d\d"|'\$\d+\.\d\d'/, allow: ["catalog.ts"], why: "real-money prices come from platform.priceOf, stickers live in catalog.ts" },
  // stores: the game never imports a store or board SDK
  { re: /@capacitor|storekit|StoreKit|GameKit|gamecenter|steamworks|revenuecat/i, allow: [], why: "SDKs live in the shell, behind window.__acornautPlatform" },
];

let bad = 0;
for (const f of files) {
  const src = readFileSync(join(dir, f), "utf8");
  const lines = src.split("\n");
  for (const rule of RULES) {
    if (rule.allow.includes(f)) continue;
    lines.forEach((line, i) => {
      // comments may talk about these things; code may not use them
      const t = line.trim();
      if (t.startsWith("*") || t.startsWith("/*")) return;   // inside a block comment
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      if (rule.re.test(code)) { bad++; console.log(`${f}:${i + 1}: ${rule.why}\n    ${line.trim()}`); }
    });
  }
}
if (bad) { console.log(`\n${bad} bridge violation(s)`); process.exit(1); }
console.log(`platform bridge: ${files.length} files clean`);
