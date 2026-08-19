#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(tmpdir(), `acornaut-tunnel-test-${process.pid}`);
mkdirSync(out, { recursive: true });

try {
  execFileSync("npx", [
    "--yes", "--package", "typescript@5.9.2", "tsc", "illustrated-src/game/catalog.ts",
    "illustrated-src/game/save.ts", "illustrated-src/game/sim.ts", "--outDir", out,
    "--module", "commonjs", "--target", "es2020", "--skipLibCheck",
    "--moduleResolution", "node", "--declaration", "false", "--strict", "false", "--noEmitOnError",
  ], { cwd: root, stdio: "inherit" });

  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const require = createRequire(import.meta.url);
  const { flap, makeWorld, resetRun, tunnelBoundsAt, updateWorld } = require(join(out, "sim.js"));
  const { defaultSave } = require(join(out, "save.js"));
  const originalRandom = Math.random;
  let minGap = Infinity;
  let maxTurn = 0;
  let scoreTotal = 0;

  for (let run = 0; run < 40; run++) {
    let seed = run + 1;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const world = makeWorld(360, 640);
    const save = defaultSave();
    resetRun(world, save, "tunnel", false);
    flap(world, save);
    let framesSinceTap = 0;
    for (let frame = 0; frame < 60 * 180; frame++) {
      const bounds = tunnelBoundsAt(world, world.W * 0.18 + 100);
      const target = (bounds.top + bounds.bottom) * 0.5;
      if (world.squirrel.y > target + 44 && world.squirrel.vy > 0 && framesSinceTap >= 7) {
        flap(world, save);
        framesSinceTap = 0;
      }
      const event = updateWorld(world, save, 1 / 60);
      framesSinceTap++;
      if (event === "die") throw new Error(
        `tap pilot died in run ${run} at frame ${frame}; y=${world.squirrel.y.toFixed(1)}, ` +
        `target=${target.toFixed(1)}, bounds=${bounds.top.toFixed(1)}..${bounds.bottom.toFixed(1)}`,
      );
      for (let i = 1; i < world.tunnel.nodes.length; i++) {
        const a = world.tunnel.nodes[i - 1];
        const b = world.tunnel.nodes[i];
        minGap = Math.min(minGap, b.bottom - b.top);
        maxTurn = Math.max(maxTurn, Math.abs((b.top + b.bottom - a.top - a.bottom) * 0.5));
      }
    }
    if (world.score < 400) throw new Error(`distance score did not advance: ${world.score}`);
    scoreTotal += world.score;
  }

  Math.random = originalRandom;
  const world = makeWorld(360, 640);
  const save = defaultSave();
  resetRun(world, save, "tunnel", false);
  flap(world, save);
  world.pickups.push({ x: world.W * 0.18 + world.speed / 60, y: world.squirrel.y, got: false, bob: 0, kind: "multiplier" });
  if (updateWorld(world, save, 1 / 60) !== "gold" || world.tunnel.multiplier !== 2)
    throw new Error("multiplier acorn did not activate ×2 scoring");
  world.runAcorns = 3;
  world.tunnel.scoreFloat = 77;
  world.squirrel.y = 0;
  if (updateWorld(world, save, 1 / 60) !== "die") throw new Error("leaving the tunnel did not end the run");
  if (save.tunnelBest !== 77 || save.highScore !== 0 || save.acorns !== 3)
    throw new Error("tunnel result was not banked independently");

  console.log(JSON.stringify({
    runs: 40,
    simulatedMinutes: 120,
    averageScore: Math.round(scoreTotal / 40),
    minGap: Number(minGap.toFixed(2)),
    maxCenterTurn: Number(maxTurn.toFixed(2)),
    multiplierAndSaveChecks: "passed",
  }));
} finally {
  rmSync(out, { recursive: true, force: true });
}
