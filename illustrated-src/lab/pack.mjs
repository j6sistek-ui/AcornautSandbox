// Bakes the lab into ONE self-contained .html — script and every sprite
// inlined as data URIs, no network at all.
//
// Why: the lab lives on a branch, and GitHub Pages only serves main. Without
// this there is no way to actually PLAY a prototype without merging it,
// which is exactly the thing a prototype should not require.
//
//   node illustrated-src/lab/pack.mjs [outfile]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const art = join(root, "docs/art");
const out = process.argv[2] || join(root, "docs/lab/spill/standalone.html");

const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;

const assets = {};
for (let i = 0; i < 27; i++) assets[`debris/${i}.png`] = b64(join(art, `debris/${i}.png`));
for (const n of [1, 2, 3, 4]) {
  assets[`squirrel/idle-${n}.png`] = b64(join(art, `squirrel/idle-${n}.png`));
  assets[`squirrel/flap-${n}.png`] = b64(join(art, `squirrel/flap-${n}.png`));
}
assets["acorn/1.png"] = b64(join(art, "acorn/1.png"));

const page = readFileSync(join(root, "docs/lab/spill/index.html"), "utf8");
const js = readFileSync(join(root, "docs/lab/spill/js/spill.js"), "utf8");

// The module resolves art as `${ART}/name`. Hand it a map instead of a path
// and let a shim swap the lookup, so the source needs no packing branch.
const shim = `
<script>
window.__SPILL_ASSETS__ = ${JSON.stringify(assets)};
window.__ACORNAUT_ART__ = "";
</script>`;

const inlined = js.replace(
  /const ART = [^;]+;/,
  'const ART = "";\nconst PACK = window.__SPILL_ASSETS__ || null;',
).replace(
  /img\.src = src;/,
  'img.src = PACK ? (PACK[src.replace(/^\\/+/, "")] || src) : src;',
);

// The Google Fonts link STAYS. It is the one external host an Artifact's
// CSP admits, and both faces already declare a real fallback stack, so an
// offline copy degrades to Georgia/system-ui instead of silently losing the
// type it was designed with.
const html = page
  .replace(/<title>[^<]*<\/title>/, "<title>The Spill</title>")
  .replace(/<script>\s*\/\/ the lab sits[\s\S]*?<\/script>/, shim)
  .replace(
    /<script type="module">[\s\S]*?<\/script>/,
    `<script type="module">\n${inlined}\nbootSpill(document.getElementById("root"));\n</script>`,
  )
  .replace(/export async function bootSpill/, "async function bootSpill")
  .replace(/export type [^\n]*\n/g, "");

writeFileSync(out, html);
console.log(`packed ${(html.length / 1048576).toFixed(1)} MB -> ${out}`);
