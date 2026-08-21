#!/usr/bin/env node
// Runtime contract for the Beta planet-contact response. This exercises the
// exported browser bundle and verifies both upward and downward rebounds.
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

globalThis.window = { __ACORNAUT_BETA__: true };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const root = resolve(import.meta.dirname, "..");
const js = join(mkdtempSync(join(tmpdir(), "acornaut-bounce-contract-")), "js");
cpSync(join(root, "docs", "js"), js, { recursive: true });
writeFileSync(join(js, "package.json"), '{"type":"module"}\n');

const [{ makeWorld, updateWorld }, { defaultSave }, { BOUNCE_ANIM_DURATION, PHYS }] =
  await Promise.all([
    import(pathToFileURL(join(js, "sim.js")).href),
    import(pathToFileURL(join(js, "save.js")).href),
    import(pathToFileURL(join(js, "catalog.js")).href),
  ]);

const save = defaultSave();

function impact(reboundDir) {
  const world = makeWorld(390, 844);
  const sx = world.W * PHYS.squirrelX;
  const gap = PHYS.gapBase;
  const r = PHYS.planetR;
  const y = world.H * 0.5;
  const planetCenter = y - reboundDir * 50;
  world.screen = "play";
  world.ready = false;
  world.squirrel.y = y;
  world.squirrel.vy = reboundDir < 0 ? 360 : -360;
  world.lastSpawnX = 100000;
  world.planets = [{
    x: sx + 1,
    gapY: reboundDir < 0
      ? planetCenter - gap / 2 - r
      : planetCenter + gap / 2 + r,
    gap,
    r,
    topKind: 0,
    botKind: 0,
    scored: false,
    drift: 0,
    driftAmp: 0,
    blockers: [],
  }];

  let event = null;
  for (let i = 0; i < 4 && event !== "bounce"; i++) {
    event = updateWorld(world, save, 1 / 120);
  }
  assert(event === "bounce", `planet contact did not bounce (${reboundDir})`);
  assert(world.bounceAnimT === 0, `impact clock did not start at contact (${reboundDir})`);
  assert(world.bounceAnimDir === reboundDir, `impact normal was wrong (${reboundDir})`);
  assert(world.bounceAnimStrength >= 0.68 && world.bounceAnimStrength <= 1,
    `impact strength escaped its visual clamp (${reboundDir})`);
  assert(Math.sign(world.tailV) === reboundDir,
    `tail impulse did not oppose the rebound (${reboundDir})`);

  let previous = world.bounceAnimT;
  let steps = 0;
  while (world.bounceAnimT >= 0 && steps < 120) {
    updateWorld(world, save, 1 / 120);
    if (world.bounceAnimT >= 0) {
      assert(world.bounceAnimT > previous, `impact clock stopped or rewound (${reboundDir})`);
      previous = world.bounceAnimT;
    }
    steps += 1;
  }
  assert(world.bounceAnimT === -1, `impact did not return to idle (${reboundDir})`);
  assert(world.bounceAnimDir === 0 && world.bounceAnimStrength === 0,
    `impact state did not clear exactly (${reboundDir})`);
  return steps;
}

const upwardSteps = impact(-1);
const downwardSteps = impact(1);

console.log(JSON.stringify({
  duration: BOUNCE_ANIM_DURATION,
  upwardRebound: "passed",
  downwardRebound: "passed",
  opposingTailImpulse: "passed",
  exactIdleReturn: "passed",
  upwardSteps,
  downwardSteps,
}));
