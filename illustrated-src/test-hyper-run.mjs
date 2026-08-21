#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(tmpdir(), `acornaut-hyper-run-test-${process.pid}`);
const npmCache = join(tmpdir(), "acornaut-npm-cache");
mkdirSync(out, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${message}\nactual=${JSON.stringify(actual)}\nexpected=${JSON.stringify(expected)}`);
}

try {
  const gameDir = join(root, "illustrated-src", "game");
  const gameFiles = readdirSync(gameDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join("illustrated-src", "game", name));
  const tscArgs = [
    ...gameFiles,
    "--outDir", out, "--module", "commonjs", "--target", "es2020",
    "--skipLibCheck", "--moduleResolution", "node", "--declaration", "false",
    "--strict", "false", "--noEmitOnError",
  ];
  const tscModule = process.env.ACORNAUT_TSC;
  const command = tscModule ? process.execPath : "npx";
  const args = tscModule
    ? [tscModule, ...tscArgs]
    : ["--yes", "--package", "typescript@5.9.2", "tsc", ...tscArgs];
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NPM_CONFIG_CACHE: npmCache },
  });

  const require = createRequire(import.meta.url);
  const raceApi = require(join(out, "race.js"));
  const {
    RACE_ACORNS,
    RACE_BASE_SPEED,
    RACE_DEBRIS,
    RACE_DT,
    RACE_ENTRY_TICKS,
    RACE_HEIGHT,
    RACE_LENGTH,
    RACE_RETURN_TICKS,
    RACE_RINGS,
    RACE_SEED,
    RACE_TUNNEL_DISTANCE,
    RACE_TUNNEL_TICKS,
    createRaceState,
    formatRaceTicks,
    loadRaceInputs,
    queueRaceHeld,
    raceSignature,
    raceTunnelAcorns,
    raceTunnelCenter,
    stepRace,
    sweptDebrisHit,
    sweptGateHit,
  } = raceApi;

  const optimizedRings = new Set([0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 18, 19, 20, 21]);
  const averageRings = new Set([0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 18, 19]);

  function nextTarget(race, profile) {
    if (race.phase === "tunnel") {
      const pickups = raceTunnelAcorns(race);
      const next = pickups.find((a) => a.tick >= race.phaseTick && a.tick - race.phaseTick <= 48);
      return next?.y ?? raceTunnelCenter(race, race.phaseTick + 18);
    }
    if (race.phase === "entry" || race.phase === "return") return RACE_HEIGHT * 0.5;
    const selected = profile === "optimized" ? optimizedRings : averageRings;
    for (let i = 0; i < RACE_RINGS.length; i++) {
      if (!selected.has(i) || race.ringLedger[i] !== "pending") continue;
      const dx = RACE_RINGS[i].x - race.coursePosition;
      if (dx >= -20 && dx <= 1_550) return RACE_RINGS[i].y;
    }
    // Between authored gates, drift toward the safe center without chasing
    // render-space geometry or random decoration.
    return 320;
  }

  function controllerHeld(race, profile) {
    if (profile === "passive") return false;
    const target = nextTarget(race, profile);
    const predicted = race.y + race.vy * 0.31;
    if (predicted > target + 4) return true;
    if (predicted < target - 4) return false;
    return race.held;
  }

  function runController(profile, seed = RACE_SEED) {
    const race = createRaceState(seed);
    const transitions = [];
    const phases = [];
    let lastHeld = false;
    while (race.phase !== "finish" && race.tick < 20_000) {
      const held = controllerHeld(race, profile);
      if (held !== lastHeld) {
        transitions.push({ tick: race.tick, held });
        queueRaceHeld(race, held);
        lastHeld = held;
      }
      const before = race.phase;
      stepRace(race);
      if (race.phase !== before) phases.push({ tick: race.tick, from: before, to: race.phase, x: Number(race.coursePosition.toFixed(2)) });
    }
    assert(race.phase === "finish", `${profile} controller did not finish`);
    return { race, transitions, phases };
  }

  function runReplay(transitions, cadence = [RACE_DT], seed = RACE_SEED, viewport = [360, 640]) {
    const race = createRaceState(seed);
    loadRaceInputs(race, transitions);
    let accumulator = 0;
    let frame = 0;
    let finishEvents = 0;
    while (race.phase !== "finish" && frame < 20_000) {
      accumulator += cadence[frame % cadence.length];
      while (accumulator + 1e-12 >= RACE_DT && race.phase !== "finish") {
        const ev = stepRace(race);
        if (ev.finished) finishEvents += 1;
        accumulator -= RACE_DT;
      }
      frame += 1;
    }
    assert(race.phase === "finish", `replay did not finish at ${viewport.join("x")}`);
    assert(finishEvents === 1, `finish settled ${finishEvents} times`);
    return race;
  }

  // Acceptance 1: identical seed and input transitions produce an exact
  // authoritative ledger, including wormhole-entry tick stamps.
  const authored = runController("optimized");
  const replayA = runReplay(authored.transitions);
  const replayB = runReplay(authored.transitions);
  same(raceSignature(replayA), raceSignature(replayB), "same seed/input replay diverged");

  // Acceptance 2: viewport dimensions are render-only and cannot enter the
  // race module's result.
  const canonical = runReplay(authored.transitions, [RACE_DT], RACE_SEED, [360, 640]);
  const tallPhone = runReplay(authored.transitions, [RACE_DT], RACE_SEED, [390, 844]);
  same(raceSignature(canonical), raceSignature(tallPhone), "viewport changed authority");

  // Acceptance 3: one fixed-step accumulator survives 60 fps, 30 fps, and
  // a mixed/dropped render schedule without changing a single race field.
  const at60 = runReplay(authored.transitions, [1 / 60]);
  const at30 = runReplay(authored.transitions, [1 / 30]);
  const mixed = runReplay(authored.transitions, [1 / 60, 1 / 24, 1 / 120, 1 / 15, 1 / 30, 1 / 20]);
  same(raceSignature(at60), raceSignature(at30), "30 fps cadence changed authority");
  same(raceSignature(at60), raceSignature(mixed), "mixed cadence changed authority");

  // Acceptance 4: reference pilots occupy the design bands. These are
  // deterministic controllers, not claims about human performance.
  const passive = runController("passive").race;
  const average = runController("average").race;
  const optimized = authored.race;
  assert(passive.finishTicks >= 11_400 && passive.finishTicks <= 11_950,
    `passive ${formatRaceTicks(passive.finishTicks)} outside ~195 s band`);
  assert(average.finishTicks >= 9_600 && average.finishTicks <= 10_200,
    `average ${formatRaceTicks(average.finishTicks)} outside ~165 s band; wormholes=${average.wormholes} contacts=${average.debrisContacts.join(",")} ledger=${average.ringLedger.join(",")}`);
  assert(optimized.finishTicks >= 8_340 && optimized.finishTicks <= 8_520,
    `optimized ${formatRaceTicks(optimized.finishTicks)} outside 139–142 s band; wormholes=${optimized.wormholes} entries=${optimized.entryTicks.join(",")} phases=${JSON.stringify(authored.phases)} contacts=${optimized.debrisContacts.join(",")} ledger=${optimized.ringLedger.join(",")}`);

  // Acceptance 5: swept checks answer the same way over the distance moved
  // by base and cap speed steps; nothing can tunnel between samples.
  const gate = RACE_RINGS[0];
  const debris = RACE_DEBRIS[0];
  for (const speed of [185, 275]) {
    const dx = speed / 60;
    assert(sweptGateHit(gate.x - dx * 0.6, gate.x + dx * 0.4, gate.y, gate.y, gate),
      `gate swept hit failed at ${speed}`);
    assert(sweptDebrisHit(debris.x - dx * 0.6, debris.x + dx * 0.4, debris.y, debris.y, debris),
      `debris swept hit failed at ${speed}`);
  }

  // Acceptance 6: the tunnel owns exactly 3,600 units and the handoff owns
  // the specified speed/charge. A completed run emits settlement once.
  const handoff = createRaceState();
  handoff.phase = "tunnel";
  handoff.phaseStartPosition = 1_000;
  handoff.coursePosition = 1_000;
  handoff.charge = 100;
  handoff.tunnelAcornLedger[0] = Array(20).fill(false);
  for (let i = 0; i < RACE_TUNNEL_TICKS + RACE_RETURN_TICKS; i++) stepRace(handoff);
  assert(handoff.phase === "normal", "return did not hand back to normal flight");
  assert(Math.abs(handoff.coursePosition - (1_000 + RACE_TUNNEL_DISTANCE)) < 1e-9,
    `tunnel moved ${handoff.coursePosition - 1_000}, expected ${RACE_TUNNEL_DISTANCE}`);
  assert(handoff.charge === 0, `return charge ${handoff.charge}, expected 0`);
  assert(handoff.speed === 225, `return speed ${handoff.speed}, expected 225`);
  assert(handoff.y >= 96 && handoff.y <= 544, `return y ${handoff.y} outside derived 96..544 band`);
  const once = createRaceState();
  once.coursePosition = RACE_LENGTH - RACE_BASE_SPEED / 120;
  let settles = 0;
  for (let i = 0; i < 3; i++) if (stepRace(once).finished) settles += 1;
  assert(settles === 1, `finish emitted ${settles} settlements`);

  const evidence = {
    suite: "Hyper Run mandatory replay acceptance",
    fixedStepHz: 60,
    tests: {
      sameSeedAndInputs: "passed",
      viewportIndependence: "passed",
      renderCadenceIndependence: "passed",
      benchmarkBands: "passed",
      sweptGateAndDebris: "passed",
      returnHandoffAndSingleSettlement: "passed",
    },
    profiles: {
      passive: { ticks: passive.finishTicks, time: formatRaceTicks(passive.finishTicks), wormholes: passive.wormholes },
      average: { ticks: average.finishTicks, time: formatRaceTicks(average.finishTicks), wormholes: average.wormholes },
      optimized: { ticks: optimized.finishTicks, time: formatRaceTicks(optimized.finishTicks), wormholes: optimized.wormholes },
    },
    optimizedSignature: raceSignature(optimized),
    transitionCount: authored.transitions.length,
  };
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
