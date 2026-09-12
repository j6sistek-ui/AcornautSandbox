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
// Ember stands for the queue roster (PAINTED_TAP_SUITS): repeat taps cannot
// rewind the gesture. It used to be Robo, until the owner froze Robo and the
// rest of his roster back to rewind (12 Sep 2026) - see test-frozen-roster.
save.equippedSuit = "ember";
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
assert(world.tapAnimDir === 1 && world.tapAnimQueued, "repeat tap must queue without reversing the active gesture");
assert(world.tailV > firstTailV, "repeat tap did not add energy to the live tail spring");

for (let i = 0; i < 12; i++) updateWorld(world, save, 1 / 60);
const secondRecoveryT = world.tapAnimT;
assert(flap(world, save) === "flap", "second repeat tap was rejected");
assert(world.tapAnimT === secondRecoveryT, "second repeat changed the body clock");
assert(world.tapAnimDir === 1 && world.tapAnimQueued, "second repeat must preserve forward playback and coalesce");
assert(world.tapAnimT > 0 && world.tapAnimT < TAP_ANIM_DURATION,
  "recovery did not remain active between taps");

let settleTicks = 0;
while (world.tapAnimT >= 0 && settleTicks < 600) {
  updateWorld(world, save, 1 / 60);
  settleTicks += 1;
}
assert(world.tapAnimT === -1,
  `visual clock did not settle to its idle sentinel: t=${world.tapAnimT}, dir=${world.tapAnimDir}, screen=${world.screen}`);

// THE BETA DIAL: with save.tapRewind on, the same suit rewinds like a frozen
// one - that is how the owner tries the other feel before deciding. And a
// frozen suit rewinds whatever the dial says.
function repeat(suit, tapRewind) {
  const s = defaultSave(); s.equippedSuit = suit; s.tapRewind = tapRewind;
  const w = makeWorld(390, 844); w.screen = "play"; w.ready = false; w.planets = []; w.debris = []; w.invulnLeft = 999;
  assert(flap(w, s) === "flap", `${suit}: first tap`);
  for (let i = 0; i < 10; i++) updateWorld(w, s, 1 / 60);
  assert(flap(w, s) === "flap", `${suit}: repeat tap`);
  return { dir: w.tapAnimDir, queued: w.tapAnimQueued };
}
{
  const r = repeat("ember", true);
  assert(r.dir === -1 && !r.queued, `beta dial on: ember rewinds (dir ${r.dir}, queued ${r.queued})`);
  const f = repeat("eclipse", false), g = repeat("eclipse", true);
  assert(f.dir === -1 && !f.queued && g.dir === -1 && !g.queued, "frozen eclipse rewinds with the dial off and on");
}

console.log(JSON.stringify({
  duration: TAP_ANIM_DURATION,
  firstRepeatAt: Number(firstRecoveryT.toFixed(3)),
  secondRepeatAt: Number(secondRecoveryT.toFixed(3)),
  repeatClockContinuity: "passed",
  completeGestureBeforeReplay: "passed",
  repeatedTailImpulse: "passed",
  exactIdleSentinel: "passed",
}));
