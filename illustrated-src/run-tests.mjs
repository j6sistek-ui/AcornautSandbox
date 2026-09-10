#!/usr/bin/env node
/** THE HARNESS, AS ONE COMMAND.
 *
 *  SHIPPING.md gate 3 says "every illustrated-src/test-*.mjs". There was no
 *  runner, so everyone wrote their own shell loop - and every loop grew its
 *  own skip list, because sixteen of the tests need `happy-dom` or
 *  `@napi-rs/canvas` and nothing declared them. The result (audit, 8 Sep
 *  2026): 23 of 41 tests ran, and seven of the eighteen that did not were
 *  RED, asserting rules the game had left behind months earlier.
 *
 *  So: one runner, no skip list. A test that cannot run because a dependency
 *  is missing is reported as SKIPPED and the run still fails unless
 *  --allow-skips is passed, which is what a bare checkout uses. Install the
 *  two packages (npm install) and every test runs for real.
 *
 *    node illustrated-src/run-tests.mjs              # all of them, fail on skip
 *    node illustrated-src/run-tests.mjs --allow-skips
 *    node illustrated-src/run-tests.mjs --only spill # substring filter
 *    node illustrated-src/run-tests.mjs --skip-heavy  # the fast 50; see SHIPPING.md gate 3
 *    node illustrated-src/run-tests.mjs --list
 *
 *  Slow by design. Seven tests carry 437 of the 593 seconds; --skip-heavy
 *  leaves those out when the change cannot reach them, which is a call the
 *  caller makes up front and writes down. Nothing is excluded silently.
 */
import { readdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// The two optional packages, and the env overrides the tests already read
// when they are installed somewhere else (a scratch dir, a global store).
const OPTIONAL = [
  { pkg: "happy-dom", env: "ACORNAUT_HAPPY_DOM", entry: "happy-dom/lib/index.js" },
  { pkg: "@napi-rs/canvas", env: "ACORNAUT_CANVAS", entry: "@napi-rs/canvas/index.js" },
];
const require_ = createRequire(join(ROOT, "package.json"));
const env = { ...process.env };
const present = new Set();
for (const o of OPTIONAL) {
  if (env[o.env] && existsSync(env[o.env])) { present.add(o.pkg); continue; }
  try {
    // Locally installed packages resolve from the tests themselves. Injecting
    // a C:\\ path breaks dynamic import on Windows (require accepts it).
    require_.resolve(o.entry);
    delete env[o.env];
    present.add(o.pkg);
  } catch { /* not installed: its tests will report SKIPPED */ }
}

const only = valueOf("--only");

/** THE SEVEN EXPENSIVE ONES: 437s of the suite's 593. Each guards something
 *  specific that has broken before - SHIPPING.md gate 3 says what, in plain
 *  words, so the caller can tell whether their change can reach it.
 *
 *  --skip-heavy leaves them out. It is a JUDGEMENT, made up front and
 *  declared, not an optimisation applied blindly: a diff that could touch
 *  hole spawning, the Wormhole Run, the chart menus, AcorNut, the Shop or
 *  helmet fit runs them. Owner, 10 Sep 2026, on the cost of getting that
 *  call wrong: "if it ships and breaks, we will eventually fix and find it.
 *  Not the end of the world if they miss a check." */
const HEAVY = ["test-warp.mjs", "test-tunnel.mjs", "test-star-map-ui.mjs",
  "test-vanguard-flight.mjs", "test-vanguard-render.mjs",
  "test-shop-visuals.mjs", "test-helmet-animation.mjs"];
const skipHeavy = has("--skip-heavy");

const tests = readdirSync(HERE)
  .filter((f) => /^test-.*\.mjs$/.test(f))
  .filter((f) => !only || f.includes(only))
  .filter((f) => !skipHeavy || !HEAVY.includes(f))
  .sort();


if (has("--list")) { for (const t of tests) console.log(t); process.exit(0); }

if (skipHeavy) {
  console.log(`--skip-heavy: leaving out ${HEAVY.length} tests (about 437s).`);
  console.log(`  ${HEAVY.map((f) => f.replace(/^test-|\.mjs$/g, "")).join(", ")}`);
  console.log("  Say so in the scope checklist, and say why they cannot be reached.\n");
}

const run = (file) => new Promise((done) => {
  const started = Date.now();
  const child = spawn(process.execPath, [join(HERE, file)], { cwd: ROOT, env });
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  child.on("close", (code) => done({ file, code, out, ms: Date.now() - started }));
});

const MISSING = /Cannot find package '(happy-dom|@napi-rs\/canvas)'|ERR_MODULE_NOT_FOUND/;
const pass = [], skip = [], fail = [];
for (const t of tests) {
  const r = await run(t);
  const secs = (r.ms / 1000).toFixed(1);
  if (r.code === 0) { pass.push(t); console.log(`  ok    ${t}  (${secs}s)`); }
  else if (MISSING.test(r.out)) { skip.push(t); console.log(`  SKIP  ${t}  (a dependency is not installed)`); }
  else {
    fail.push({ t, out: r.out });
    console.log(`  FAIL  ${t}  (${secs}s)`);
  }
}

console.log(`\n${pass.length} passed, ${fail.length} failed, ${skip.length} skipped, of ${tests.length}`);
for (const o of OPTIONAL) if (!present.has(o.pkg)) console.log(`  ${o.pkg} is not installed: \`npm install\` at the repo root, or set ${o.env} to its entry file`);
for (const f of fail) {
  console.log(`\n----- ${f.t}\n${f.out.trim().split("\n").slice(-25).join("\n")}`);
}
if (fail.length) process.exit(1);
if (skip.length && !has("--allow-skips")) {
  console.log("\nSkipped tests count as a failure: install the packages above, or pass --allow-skips.");
  process.exit(1);
}
