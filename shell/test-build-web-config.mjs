// Exercise the real web builder with a tiny fixture and no external bundler.
// Run with: node shell/test-build-web-config.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const buildSource = readFileSync(join(here, "build-web.mjs"), "utf8");
const tempParent = realpathSync(resolve(tmpdir()));
const fixtureRoot = mkdtempSync(join(tempParent, "acornaut-build-web-config-"));

// Never recursively remove an unchecked computed path, especially on Windows.
function assertSafeFixture() {
  const actual = realpathSync(fixtureRoot);
  assert.equal(dirname(actual), tempParent, "fixture must be directly inside OS temp");
  assert.ok(basename(actual).startsWith("acornaut-build-web-config-"));
}
assertSafeFixture();

// A preload hook intercepts execSync before build-web.mjs imports it. This
// mocks npx/esbuild itself, so no executable, install, network or SDK is used.
const bundlerMock = String.raw`
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
childProcess.execSync = (command, options) => {
  assert.equal(command, "npx esbuild adapter/adapter.js --bundle --format=esm --target=es2020 --outfile=www/shell/adapter.js --log-level=warning", "unexpected external command");
  assert.equal(options.cwd, process.cwd());
  writeFileSync(join(options.cwd, "www", "shell", "adapter.js"), "// mocked bundle; no ads loaded\n");
  writeFileSync(join(options.cwd, "bundler-called.json"), JSON.stringify({ command, cwd: options.cwd }));
  return Buffer.alloc(0);
};
require("node:module").syncBuiltinESMExports();
`;

const admob = {
  testing: false,
  iosAppId: "ca-app-pub-4551315319006015~4154845260",
  androidAppId: "ca-app-pub-3940256099942544~3347511713",
  rewardedIos: "ca-app-pub-4551315319006015/3029465851",
  rewardedAndroid: "ca-app-pub-3940256099942544/5224354917",
  interstitialIos: "ca-app-pub-4551315319006015/6633579655",
  interstitialAndroid: "ca-app-pub-3940256099942544/1033173712",
};

try {
  for (const testing of [false, true]) {
    const scenario = testing ? "test ads" : "release config";
    const fixture = join(fixtureRoot, testing ? "testing" : "release");
    const shell = join(fixture, "shell");
    const docs = join(fixture, "docs");
    for (const directory of [join(shell, "adapter"), join(docs, "js7"), join(docs, "fonts")]) {
      mkdirSync(directory, { recursive: true });
    }
    const config = {
      products: { "dust-250": "PLACEHOLDER_PRODUCT_DUST_250" },
      leaderboards: { fly: "PLACEHOLDER_LEADERBOARD_NORMAL" },
      revenuecat: { iosApiKey: "PLACEHOLDER_REVENUECAT_IOS_KEY" },
      admob: { ...admob, testing },
    };
    writeFileSync(join(shell, "app.config.json"), JSON.stringify(config));
    writeFileSync(join(shell, "build-web.mjs"), buildSource);
    writeFileSync(join(shell, "mock-bundler.cjs"), bundlerMock);
    writeFileSync(join(shell, "adapter", "adapter.js"), "// fixture only\n");
    writeFileSync(join(docs, "index.html"), '<script type="module">import("./js7/standalone.js");</script>');
    writeFileSync(join(docs, "js7", "standalone.js"), "// fixture only\n");
    writeFileSync(join(docs, "fonts", "fonts.css"), "/* fixture only */\n");

    const run = spawnSync(process.execPath, ["--require", join(shell, "mock-bundler.cjs"), join(shell, "build-web.mjs")], {
      cwd: shell,
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    assert.ifError(run.error);
    assert.equal(run.status, 0, `${scenario}: builder failed\n${run.stdout}${run.stderr}`);
    const generated = JSON.parse(readFileSync(join(shell, "adapter", "config.json"), "utf8"));
    assert.deepEqual(generated.admob, config.admob, `${scenario}: generated adapter must retain all AdMob IDs and the explicit testing flag`);
    assert.equal(JSON.parse(readFileSync(join(shell, "bundler-called.json"), "utf8")).cwd, shell);
    console.log(`PASS build-web AdMob propagation: ${scenario} (testing:${testing})`);
  }
} finally {
  assertSafeFixture();
  rmSync(fixtureRoot, { recursive: true, force: true });
}
