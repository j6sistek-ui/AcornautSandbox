#!/usr/bin/env node
// Contract test for the interrupt-safe Beta tap recovery. This exercises the
// exported browser bundle, not a parallel test implementation.
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
const js = join(mkdtempSync(join(tmpdir(), "acornaut-tap-contract-")), "js");
cpSync(join(root, "docs", "js"), js, { recursive: true });
writeFileSync(join(js, "package.json"), '{"type":"module"}\n');

const [{ makeWorld, flap, updateWorld }, { defaultSave }, { TAP_ANIM_DURATION }] =
  await Promise.all([
    import(pathToFileURL(join(js, "sim.js")).href),
    import(pathToFileURL(join(js, "save.js")).href),
    import(pathToFileURL(join(js, "catalog.js")).href),
  ]);

const save = defaultSave();
const world = makeWorld(390, 844);
world.screen = "play";
world.ready = false;
// This contract isolates the visual clock from randomly seeded obstacles.
world.planets = [];
world.debris = [];
world.invulnLeft = 999;

assert(flap(world, save) === "flap", "initial tap was rejected");
assert(world.tapAnimT === 0, "initial tap did not start the visual clock");
for (let i = 0; i < 10; i++) updateWorld(world, save, 1 / 60);

const firstRecoveryT = world.tapAnimT;
const firstTailV = world.tailV;
assert(flap(world, save) === "flap", "repeat tap was rejected");
assert(world.tapAnimT === firstRecoveryT, "repeat tap rewound or restarted the body clock");
assert(world.tapAnimDir === -1, "repeat tap did not reverse toward the impulse bookend");
assert(world.tailV > firstTailV, "repeat tap did not add energy to the live tail spring");

for (let i = 0; i < 12; i++) updateWorld(world, save, 1 / 60);
const secondRecoveryT = world.tapAnimT;
assert(flap(world, save) === "flap", "second repeat tap was rejected");
assert(world.tapAnimT === secondRecoveryT, "second repeat changed the body clock");
assert(world.tapAnimDir === -1, "second repeat did not reverse the active beat");
assert(world.tapAnimT > 0 && world.tapAnimT < TAP_ANIM_DURATION,
  "recovery did not remain active between taps");

let settleTicks = 0;
while (world.tapAnimT >= 0 && settleTicks < 600) {
  updateWorld(world, save, 1 / 60);
  settleTicks += 1;
}
assert(world.tapAnimT === -1,
  `visual clock did not settle to its idle sentinel: t=${world.tapAnimT}, dir=${world.tapAnimDir}, screen=${world.screen}`);

console.log(JSON.stringify({
  duration: TAP_ANIM_DURATION,
  firstRepeatAt: Number(firstRecoveryT.toFixed(3)),
  secondRepeatAt: Number(secondRecoveryT.toFixed(3)),
  repeatClockContinuity: "passed",
  interruptibleReverseRecovery: "passed",
  repeatedTailImpulse: "passed",
  exactIdleSentinel: "passed",
}));
