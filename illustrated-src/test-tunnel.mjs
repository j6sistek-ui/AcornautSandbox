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
  let debrisSeen = 0;
  let slowestTwoMinuteSpeed = Infinity;
  let widestTwoMinuteGap = 0;
  let wideMotion = 0;
  let wideMotionNodes = 0;
  let tightMotion = 0;
  let tightMotionNodes = 0;

  for (let run = 0; run < 40; run++) {
    let seed = run + 1;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const world = makeWorld(360, 640);
    const save = defaultSave();
    resetRun(world, save, "tunnel", false);
    flap(world, save);
    let framesSinceTap = 0;
    const seenHazards = new Set();
    const seenNodes = new Set();
    let lastDebrisDistance = -Infinity;
    for (let frame = 0; frame < 60 * 180; frame++) {
      const bounds = tunnelBoundsAt(world, world.W * 0.18 + 70);
      const currentBounds = tunnelBoundsAt(world, world.W * 0.18);
      const target = (bounds.top + bounds.bottom) * 0.5;
      const sx = world.W * 0.18;
      const tapAt = Math.min(target + 30, currentBounds.bottom - 25);
      const tapApex = world.squirrel.y - 78;
      if (world.squirrel.y > tapAt && tapApex > currentBounds.top + 24 && world.squirrel.vy > -80 && framesSinceTap >= 7) {
        flap(world, save);
        framesSinceTap = 0;
      }
      const event = updateWorld(world, save, 1 / 60);
      framesSinceTap++;
      for (const h of world.tunnel.hazards) {
        if (!seenHazards.has(h)) {
          seenHazards.add(h);
          debrisSeen++;
          const hb = tunnelBoundsAt(world, h.x);
          const bypass = Math.max(h.y - hb.top, hb.bottom - h.y) - h.r - 16;
          if (bypass < 38) throw new Error(`debris has no safe bypass: ${bypass.toFixed(1)}px`);
          const absoluteDistance = world.distance + h.x;
          if (absoluteDistance - lastDebrisDistance < 800)
            throw new Error(`debris spacing too short: ${(absoluteDistance - lastDebrisDistance).toFixed(1)}px`);
          lastDebrisDistance = absoluteDistance;
        }
      }
      // The endurance controller validates tunnel geometry. Debris is
      // validated separately below so a successful soak cannot depend on
      // a test-only obstacle-routing oracle.
      world.tunnel.hazards = [];
      if (event === "die") throw new Error(
        `tap pilot died in run ${run} at frame ${frame}; y=${world.squirrel.y.toFixed(1)}, ` +
        `target=${target.toFixed(1)}, bounds=${bounds.top.toFixed(1)}..${bounds.bottom.toFixed(1)}`,
      );
      for (let i = 1; i < world.tunnel.nodes.length; i++) {
        const a = world.tunnel.nodes[i - 1];
        const b = world.tunnel.nodes[i];
        const gap = b.bottom - b.top;
        const turn = Math.abs((b.top + b.bottom - a.top - a.bottom) * 0.5);
        minGap = Math.min(minGap, gap);
        maxTurn = Math.max(maxTurn, turn);
        if (!seenNodes.has(b.index)) {
          seenNodes.add(b.index);
          if (gap >= 260) { wideMotion += turn; wideMotionNodes++; }
          if (gap <= 200) { tightMotion += turn; tightMotionNodes++; }
        }
      }
      if (frame === 60 * 120 - 1) {
        const here = tunnelBoundsAt(world, sx);
        slowestTwoMinuteSpeed = Math.min(slowestTwoMinuteSpeed, world.speed);
        widestTwoMinuteGap = Math.max(widestTwoMinuteGap, here.bottom - here.top);
      }
    }
    if (world.score < 400) throw new Error(`distance score did not advance: ${world.score}`);
    scoreTotal += world.score;
  }
  if (slowestTwoMinuteSpeed < 360 || widestTwoMinuteGap > 205)
    throw new Error(`two-minute challenge too low: speed=${slowestTwoMinuteSpeed}, gap=${widestTwoMinuteGap}`);
  if (debrisSeen < 100) throw new Error(`lethal debris spawned too rarely: ${debrisSeen}`);
  const wideAverageTurn = wideMotion / Math.max(1, wideMotionNodes);
  const tightAverageTurn = tightMotion / Math.max(1, tightMotionNodes);
  if (wideAverageTurn < tightAverageTurn * 1.45)
    throw new Error(`slither damping too weak: wide=${wideAverageTurn}, tight=${tightAverageTurn}`);

  Math.random = originalRandom;
  const world = makeWorld(360, 640);
  const save = defaultSave();
  resetRun(world, save, "tunnel", false);
  flap(world, save);
  world.pickups.push({ x: world.W * 0.18 + world.speed / 60, y: world.squirrel.y, got: false, bob: 0, kind: "multiplier" });
  if (updateWorld(world, save, 1 / 60) !== "gold" || world.tunnel.multiplier !== 2)
    throw new Error("multiplier acorn did not activate ×2 scoring");

  const hazardWorld = makeWorld(360, 640);
  const hazardSave = defaultSave();
  resetRun(hazardWorld, hazardSave, "tunnel", false);
  flap(hazardWorld, hazardSave);
  hazardWorld.tunnel.hazards.push({
    x: hazardWorld.W * 0.18 + hazardWorld.speed / 60,
    y: hazardWorld.squirrel.y,
    r: 22,
    side: 0,
    kind: "debris",
    art: 0,
    spin: 1,
  });
  if (updateWorld(hazardWorld, hazardSave, 1 / 60) !== "die")
    throw new Error("center-lane debris was not lethal");
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
    slowestTwoMinuteSpeed: Number(slowestTwoMinuteSpeed.toFixed(2)),
    widestTwoMinuteGap: Number(widestTwoMinuteGap.toFixed(2)),
    debrisSeen,
    wideAverageTurn: Number(wideAverageTurn.toFixed(2)),
    tightAverageTurn: Number(tightAverageTurn.toFixed(2)),
    multiplierAndSaveChecks: "passed",
  }));
} finally {
  rmSync(out, { recursive: true, force: true });
}
