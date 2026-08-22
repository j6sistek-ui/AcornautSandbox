#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
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

function near(actual, expected, epsilon, message) {
  assert(Math.abs(actual - expected) <= epsilon,
    `${message}: actual=${actual}, expected=${expected} +/- ${epsilon}`);
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
  const gestureApi = require(join(out, "race-gesture.js"));
  const viewportApi = require(join(out, "race-viewport.js"));
  const drawApi = require(join(out, "draw.js"));
  const simApi = require(join(out, "sim.js"));
  const campaignApi = require(join(out, "campaign.js"));
  const saveApi = require(join(out, "save.js"));
  const controlApi = require(join(out, "control-constants.js"));
  const {
    RACE_ACORNS,
    RACE_BASE_SPEED,
    RACE_DEBRIS,
    RACE_DT,
    RACE_GATE_CLEARANCE,
    RACE_GATE_MISS_FADE_TICKS,
    RACE_GATE_PASS_FADE_TICKS,
    RACE_HEIGHT,
    RACE_LENGTH,
    RACE_MAX_ACORNS,
    RACE_MAX_SPEED,
    RACE_MAX_WORMHOLES,
    RACE_READY_COPY,
    RACE_RETURN_MARGIN,
    RACE_RETURN_GRACE_TICKS,
    RACE_RETURN_SPEED,
    RACE_RETURN_TICKS,
    RACE_RINGS,
    RACE_SEED,
    RACE_TUNNEL_DISTANCE,
    RACE_TUNNEL_TICKS,
    createRaceState,
    formatRaceTicks,
    loadRaceInputs,
    queueRaceInput,
    raceGrade,
    raceSignature,
    raceTunnelAcorns,
    raceTunnelGeometry,
    raceTunnelMirrored,
    stepRace,
    sweptDebrisHit,
    sweptGateHit,
  } = raceApi;
  const {
    DOUBLE_TAP_MAX_GAP_TICKS,
    DROP_DISTANCE,
    canonicalRaceY,
    createRaceGestureState,
    moveRaceGesture,
    pressRaceGesture,
    releaseRaceGesture,
  } = gestureApi;
  const { raceViewport, raceViewportY } = viewportApi;
  const { HYPER_RUN_GATE_FALLBACK_GEOMETRY, hyperRunGateUsesPaintedPairs } = drawApi;
  const { makeWorld, pausePlay, resetRun, resizeWorld, setRaceInput, updateWorld } = simApi;
  const { PROTOTYPE_RACE_MISSION } = campaignApi;
  const { defaultSave } = saveApi;
  const {
    QUICK_DROP_VY,
    WORMHOLE_HOLD_ACCEL,
    WORMHOLE_MAX_VY,
    WORMHOLE_MIN_VY,
    WORMHOLE_RELEASE_ACCEL,
  } = controlApi;

  const optimizedVisible = new Set([
    ...Array.from({ length: 20 }, (_, i) => i),
    ...Array.from({ length: 20 }, (_, i) => i + 28),
    ...Array.from({ length: 20 }, (_, i) => i + 56),
  ]);
  const averageVisible = new Set([
    ...Array.from({ length: 20 }, (_, i) => i),
    ...Array.from({ length: 20 }, (_, i) => i + 28),
    56, 57, 59, 61, 63, 65, 67, 69,
  ]);

  function firstPendingRing(race, selected) {
    for (let i = 0; i < RACE_RINGS.length; i++) {
      if (selected.has(i) && race.ringLedger[i] === "pending") return { ring: RACE_RINGS[i], index: i };
    }
    return null;
  }

  function nextSelectedRingAfter(race, selected, index) {
    for (let i = index + 1; i < RACE_RINGS.length; i++) {
      if (selected.has(i) && race.ringLedger[i] === "pending") return RACE_RINGS[i];
    }
    return null;
  }

  function nearestUnselectedRing(race, selected, selectedX) {
    for (let i = 0; i < RACE_RINGS.length; i++) {
      const ring = RACE_RINGS[i];
      if (ring.x >= selectedX) return null;
      if (!selected.has(i) && race.ringLedger[i] === "pending" && ring.x >= race.coursePosition) return ring;
    }
    return null;
  }

  function normalTicksToPlane(race, targetX) {
    let x = race.coursePosition;
    let speed = race.speed;
    let grace = race.speedGraceTicks;
    for (let ticks = 1; ticks <= 240; ticks++) {
      if (grace > 0) grace -= 1;
      else speed = Math.max(RACE_BASE_SPEED, speed - 18 * RACE_DT);
      x += speed * RACE_DT;
      if (x >= targetX) return ticks;
    }
    return 240;
  }

  function projectedNormalY(race, ticks, action) {
    let y = race.y;
    let vy = race.vy;
    const acceleration = action === "boost" ? -2_100 : action === "hold" ? -700 : 1_050;
    const minVy = action === "boost" ? -520 : -330;
    for (let i = 0; i < ticks; i++) {
      vy = Math.max(minVy, Math.min(390, vy + acceleration * RACE_DT));
      y += vy * RACE_DT;
      if (y < 16) { y = 16; vy = Math.max(0, vy); }
      if (y > 624) { y = 624; vy = Math.min(0, vy); }
    }
    return y;
  }

  function desiredNormalInput(race, selected, advanced, memory) {
    const next = firstPendingRing(race, selected);
    if (!next) return { held: false, boost: false };
    const following = nextSelectedRingAfter(race, selected, next.index);
    // Tight 360/384-unit reversals need the near aperture edge as runway; the
    // longer ordinary beats remain center targets to preserve miss margin.
    const runwayBias = following && following.x - next.ring.x <= 400
      ? Math.sign(following.y - next.ring.y) * 30
      : 0;
    let targetY = next.ring.y + runwayBias;
    if (next.ring.skill === "redline-high") targetY -= 6;
    let targetX = next.ring.x;

    // A hazard immediately behind a gate must be read as part of that gate's
    // authored line; waiting until the next target would leave too few ticks
    // to clear it (notably d23, 40 units after r65).
    for (const d of RACE_DEBRIS) {
      if (race.debrisLedger[RACE_DEBRIS.indexOf(d)]) continue;
      if (d.x < next.ring.x || d.x > next.ring.x + 120) continue;
      if (Math.abs(targetY - d.y) <= d.r + 46) {
        targetY = next.ring.y + (d.y < next.ring.y ? 30 : -30);
      }
      break;
    }

    const bypass = nearestUnselectedRing(race, selected, targetX);
    if (bypass && bypass.x - race.coursePosition < 260) {
      targetX = bypass.x;
      targetY = bypass.y < RACE_HEIGHT / 2 ? Math.min(544, bypass.y + 90) : Math.max(96, bypass.y - 90);
    }

    for (let i = 0; i < RACE_DEBRIS.length; i++) {
      if (race.debrisLedger[i]) continue;
      const d = RACE_DEBRIS[i];
      if (d.x < race.coursePosition || d.x >= targetX || d.x - race.coursePosition > 210) continue;
      const projected = race.y + race.vy * ((d.x - race.coursePosition) / Math.max(1, race.speed));
      if (Math.abs(projected - d.y) <= d.r + 34) {
        targetX = d.x;
        targetY = d.y < RACE_HEIGHT / 2 ? Math.min(544, d.y + d.r + 54) : Math.max(96, d.y - d.r - 54);
      }
      break;
    }

    const ticks = normalTicksToPlane(race, targetX);
    const seconds = Math.max(RACE_DT, ticks * RACE_DT);
    const desiredVy = Math.max(-520, Math.min(390, (targetY - race.y) / seconds));
    const targetKey = `${targetX}:${targetY}`;
    const releaseEnd = projectedNormalY(race, ticks, "release");
    const plainEnd = projectedNormalY(race, ticks, "hold");
    if (advanced && targetY > race.y && releaseEnd < targetY - 18 && race.vy < 300
        && memory.lastDropTarget !== targetKey) {
      memory.lastDropTarget = targetKey;
      return { held: false, boost: false, drop: true };
    }
    if (race.vy > desiredVy + 22) {
      const boost = advanced && targetY < race.y && (plainEnd > targetY + 18 || desiredVy < -330);
      return { held: true, boost };
    }
    if (race.vy < desiredVy - 22) return { held: false, boost: false };
    return desiredVy < race.vy ? { held: true, boost: false } : { held: false, boost: false };
  }

  function desiredTunnelInput(race, advanced, memory) {
    const lookTick = Math.min(RACE_TUNNEL_TICKS - 1, race.phaseTick + 12);
    const targetY = raceTunnelGeometry(race, lookTick).center;
    const desiredVy = Math.max(-780, Math.min(620, (targetY - race.y) / 0.20));
    if (advanced && targetY - race.y > 95 && race.vy < 260 && race.phaseTick - memory.lastTunnelDrop > 24) {
      memory.lastTunnelDrop = race.phaseTick;
      return { held: false, boost: false, drop: true };
    }
    if (race.vy > desiredVy + 28) return { held: true, boost: advanced && desiredVy < -500 };
    return { held: false, boost: false };
  }

  function sameInputState(race, input) {
    return !input.drop && race.held === input.held && race.boost === input.boost;
  }

  function runController(profile, seed = RACE_SEED) {
    const race = createRaceState(seed);
    const selected = profile === "optimized" ? optimizedVisible : averageVisible;
    // The average benchmark may use the taught skill moves; only the passive
    // completion fixture is required to omit them. Its authored misses and
    // two-cycle route, rather than disabled controls, create the time band.
    const advanced = true;
    const memory = { lastDropTarget: "", lastTunnelDrop: -1000 };
    let normalSpeedSum = 0;
    let normalTicks = 0;
    while (race.phase !== "finish" && race.tick < 12_000) {
      let input = { held: false, boost: false };
      if (race.phase === "normal") input = desiredNormalInput(race, selected, advanced, memory);
      else if (race.phase === "tunnel") input = desiredTunnelInput(race, advanced, memory);
      if (!sameInputState(race, input)) queueRaceInput(race, input);
      if (race.phase === "normal") {
        normalSpeedSum += race.speed;
        normalTicks += 1;
      }
      stepRace(race);
    }
    assert(race.phase === "finish", `${profile} controller did not finish`);
    return {
      race,
      transitions: race.inputs.map((input) => ({ ...input })),
      meanNormalSpeed: normalSpeedSum / normalTicks,
    };
  }

  function realizeSemanticLog(transitions, label) {
    const authority = createRaceState();
    let gesture = createRaceGestureState();
    let ownerSerial = 1_000;
    let rawEvents = 0;
    let qualifyingBoostPresses = 0;
    let swipeDrops = 0;
    const emit = (result, tick, kind) => {
      rawEvents += 1;
      gesture = result.state;
      if (result.input) queueRaceInput(authority, result.input, tick);
      if (kind === "boost-press" && result.input?.boost) qualifyingBoostPresses += 1;
      if (kind === "swipe-move" && result.input?.drop) swipeDrops += 1;
      return result;
    };
    const releaseActive = (tick) => {
      if (gesture.owner !== null) emit(releaseRaceGesture(gesture, gesture.owner), tick, "release");
    };
    const pressFresh = (tick, kind = "press") => {
      const owner = ownerSerial++;
      return { owner, result: emit(pressRaceGesture(gesture, owner, tick, 100), tick, kind) };
    };

    for (const target of transitions) {
      const tick = target.tick;
      if (target.drop) {
        assert(!target.held && !target.boost, `${label} drop target was not atomic release-plus-drop`);
        releaseActive(tick);
        const { owner } = pressFresh(tick, "swipe-press");
        const moved = emit(moveRaceGesture(gesture, owner, tick, 100 + DROP_DISTANCE), tick, "swipe-move");
        assert(moved.input?.drop, `${label} drop at ${tick} was not emitted by a legal swipe`);
        emit(releaseRaceGesture(gesture, owner), tick, "swipe-release");
      } else if (target.boost) {
        releaseActive(tick);
        let pressed = pressFresh(tick, "boost-press");
        if (!pressed.result.input?.boost) {
          emit(releaseRaceGesture(gesture, pressed.owner), tick, "tap-release");
          pressed = pressFresh(tick, "boost-press");
        }
        assert(pressed.result.input?.held && pressed.result.input?.boost,
          `${label} boost at ${tick} was not a qualifying fresh second down`);
      } else if (target.held) {
        if (gesture.owner === null || gesture.boost) {
          releaseActive(tick);
          let pressed = pressFresh(tick);
          if (pressed.result.input?.boost) {
            // The first quick re-press legitimately consumes a remembered tap;
            // lifting it clears the candidate so a fresh plain hold can begin.
            emit(releaseRaceGesture(gesture, pressed.owner), tick, "release");
            pressed = pressFresh(tick);
          }
          assert(pressed.result.input?.held && !pressed.result.input?.boost,
            `${label} plain hold at ${tick} could not be realized by a fresh down`);
        }
      } else {
        releaseActive(tick);
      }
      assert(gesture.held === target.held && gesture.boost === target.boost,
        `${label} raw gesture state disagreed with semantic target at tick ${tick}`);
    }
    same(authority.inputs, transitions, `${label} raw gestures did not reproduce the semantic log`);
    return { transitions: authority.inputs.map((input) => ({ ...input })), rawEvents, qualifyingBoostPresses, swipeDrops };
  }

  function runReplay(transitions, cadence = [RACE_DT], seed = RACE_SEED) {
    const race = createRaceState(seed);
    loadRaceInputs(race, transitions);
    let accumulator = 0;
    let frame = 0;
    let finishEvents = 0;
    let normalSpeedSum = 0;
    let normalTicks = 0;
    while (race.phase !== "finish" && frame < 30_000) {
      accumulator += cadence[frame % cadence.length];
      while (accumulator + 1e-12 >= RACE_DT && race.phase !== "finish") {
        if (race.phase === "normal") {
          normalSpeedSum += race.speed;
          normalTicks += 1;
        }
        const ev = stepRace(race);
        if (ev.finished) finishEvents += 1;
        accumulator -= RACE_DT;
      }
      frame += 1;
    }
    assert(race.phase === "finish", "replay did not finish");
    assert(finishEvents === 1, `finish settled ${finishEvents} times`);
    return { race, meanNormalSpeed: normalSpeedSum / normalTicks };
  }

  function runWorldReplay(transitions, width, height) {
    const world = makeWorld(360, 640);
    const save = defaultSave();
    const stored = new Map();
    const priorLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, String(value)),
      removeItem: (key) => stored.delete(key),
      clear: () => stored.clear(),
      key: (index) => [...stored.keys()][index] ?? null,
      get length() { return stored.size; },
    };
    resetRun(world, save, "fly", false, PROTOTYPE_RACE_MISSION);
    resizeWorld(world, width, height);
    loadRaceInputs(world.race, transitions);
    world.ready = false;
    let steps = 0;
    try {
      while (world.race.phase !== "finish" && steps < 12_000) {
        updateWorld(world, save, RACE_DT);
        steps += 1;
      }
    } finally {
      if (priorLocalStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = priorLocalStorage;
    }
    assert(world.race.phase === "finish" && world.screen === "lvldone",
      `${width}x${height} World replay did not settle exactly once`);
    const viewport = raceViewport(width, height);
    near(world.squirrel.y, raceViewportY(viewport, world.race.y), 1e-9,
      `${width}x${height} presentation did not project canonical pilot Y`);
    near(world.squirrel.vy, world.race.vy * viewport.scale, 1e-9,
      `${width}x${height} presentation did not project canonical pilot velocity`);
    return world.race;
  }

  function countLedger(race, state) {
    return race.ringLedger.filter((entry) => entry === state).length;
  }

  function assertProfile(name, result, range, telemetry) {
    const { race, meanNormalSpeed } = result;
    assert(race.finishTicks >= range[0] && race.finishTicks <= range[1],
      `${name} ${formatRaceTicks(race.finishTicks)} (${race.finishTicks}) outside ${range.join("...")}; `
      + `passed=${countLedger(race, "passed")} cycles=${race.wormholes} debris=${race.debrisContacts.join(",")} `
      + `mean=${meanNormalSpeed.toFixed(3)} entries=${race.entryTicks.join(",")}`);
    if (telemetry.passed) assert(telemetry.passed.includes(countLedger(race, "passed")),
      `${name} passed ${countLedger(race, "passed")}, expected ${telemetry.passed.join(" or ")}`);
    if (telemetry.passedRange) assert(countLedger(race, "passed") >= telemetry.passedRange[0]
      && countLedger(race, "passed") <= telemetry.passedRange[1], `${name} passed-ring telemetry outside band`);
    assert(race.wormholes === telemetry.wormholes, `${name} used ${race.wormholes} wormholes`);
    assert(race.debrisContacts.length >= telemetry.debris[0] && race.debrisContacts.length <= telemetry.debris[1],
      `${name} debris contacts ${race.debrisContacts.length} outside ${telemetry.debris.join("...")}`);
    if (telemetry.mean) assert(meanNormalSpeed >= telemetry.mean[0] && meanNormalSpeed <= telemetry.mean[1],
      `${name} mean normal speed ${meanNormalSpeed.toFixed(3)} outside ${telemetry.mean.join("...")}`);
  }

  function assertAuthoredLayout() {
    assert(RACE_RINGS.length === 84, `expected 84 rings, got ${RACE_RINGS.length}`);
    assert(RACE_DEBRIS.length === 30, `expected 30 debris, got ${RACE_DEBRIS.length}`);
    assert(RACE_ACORNS.length === 42, `expected 42 normal acorns, got ${RACE_ACORNS.length}`);
    const actCounts = (objects) => Array.from({ length: 6 }, (_, act) =>
      objects.filter((object) => object.x >= act * 7_500 && object.x < (act + 1) * 7_500).length);
    same(actCounts(RACE_RINGS), [14, 14, 14, 14, 14, 14], "ring act counts changed");
    same(actCounts(RACE_DEBRIS), [4, 6, 5, 5, 5, 5], "debris act counts changed");
    same(actCounts(RACE_ACORNS), [8, 4, 9, 5, 10, 6], "normal-acorn act counts changed");
    same(RACE_RINGS.map((ring) => ring.id), Array.from({ length: 84 }, (_, i) => `r${String(i + 1).padStart(2, "0")}`),
      "ring ids/order changed");
    same([RACE_RINGS[19].x, RACE_RINGS[47].x, RACE_RINGS[75].x], [10_000, 25_000, 40_000],
      "entry anchors changed");
    same(RACE_RINGS.slice(73, 76).map((r) => [r.x, r.y, r.skill]), [
      [39_232, 496, "redline-low-in"],
      [39_616, 144, "redline-high"],
      [40_000, 496, "redline-low-out"],
    ], "redline exam changed");
    for (let i = 1; i < RACE_RINGS.length; i++) {
      const gap = RACE_RINGS[i].x - RACE_RINGS[i - 1].x;
      assert((gap >= 360 && gap <= 480) || (gap >= 560 && gap <= 700),
        `ring gap r${i}->r${i + 1} is ${gap}`);
    }
    const interactive = [0, ...RACE_RINGS.map((x) => x.x), ...RACE_DEBRIS.map((x) => x.x),
      ...RACE_ACORNS.map((x) => x.x), RACE_LENGTH].sort((a, b) => a - b);
    for (let i = 1; i < interactive.length; i++) {
      assert(interactive[i] - interactive[i - 1] <= 720,
        `interactive gap ${interactive[i - 1]}..${interactive[i]} exceeds 720`);
    }
    for (const [entry, exit] of [[10_000, 14_500], [25_000, 29_500], [40_000, 44_500]]) {
      assert(RACE_ACORNS.every((a) => !(a.x > entry && a.x <= exit)), `normal acorn hidden in ${entry}..${exit}`);
      const firstLive = interactive.find((x) => x > exit);
      assert(firstLive - exit <= 720, `return at ${exit} has ${firstLive - exit}-unit dead gap`);
    }
    // Every authored ring that can legally fill charge is also a possible
    // delayed-recovery entry. Its post-skip return must retain the density
    // contract; objects hidden inside that 4,500-unit span do not count.
    for (const ring of RACE_RINGS.filter((candidate) => candidate.x <= RACE_LENGTH - RACE_TUNNEL_DISTANCE)) {
      const exit = ring.x + RACE_TUNNEL_DISTANCE;
      const firstLive = interactive.find((x) => x > exit);
      assert(firstLive - exit <= 720,
        `delayed return from ${ring.id} at ${exit} has ${firstLive - exit}-unit dead gap`);
    }
  }

  const authoredAverage = runController("average");
  const authoredOptimized = runController("optimized");
  const realizedAverage = realizeSemanticLog(authoredAverage.transitions, "average benchmark");
  const realizedOptimized = realizeSemanticLog(authoredOptimized.transitions, "optimized benchmark");
  same(raceSignature(runReplay(realizedAverage.transitions).race), raceSignature(authoredAverage.race),
    "average raw-gesture realization changed authority");
  same(raceSignature(runReplay(realizedOptimized.transitions).race), raceSignature(authoredOptimized.race),
    "optimized raw-gesture realization changed authority");
  assert(realizedAverage.qualifyingBoostPresses > 0 && realizedOptimized.qualifyingBoostPresses > 0,
    "benchmark raw gesture traces did not contain qualifying boost presses");
  assert(realizedAverage.swipeDrops > 0 && realizedOptimized.swipeDrops > 0,
    "benchmark raw gesture traces did not contain legal swipe drops");

  // Acceptance 1: same semantic log, recognizer boundaries, and merge rules.
  const replayA = runReplay(authoredOptimized.transitions).race;
  const replayB = runReplay(authoredOptimized.transitions).race;
  same(raceSignature(replayA), raceSignature(replayB), "same seed/input replay diverged");
  let gesture = createRaceGestureState();
  let result = pressRaceGesture(gesture, 1, 0, 120); gesture = result.state;
  result = releaseRaceGesture(gesture, 1); gesture = result.state;
  result = pressRaceGesture(gesture, 1, DOUBLE_TAP_MAX_GAP_TICKS, 120);
  assert(result.input?.held && result.input?.boost, "15-tick second down did not boost");
  result = releaseRaceGesture(result.state, 1);
  same(result.input, { held: false, boost: false }, "lift did not clear boost on its tick");
  gesture = createRaceGestureState();
  gesture = releaseRaceGesture(pressRaceGesture(gesture, 1, 0, 120).state, 1).state;
  result = pressRaceGesture(gesture, 1, DOUBLE_TAP_MAX_GAP_TICKS + 1, 120);
  same(result.input, { held: true, boost: false }, "16-tick second down did not degrade to plain hold");
  let swipe = pressRaceGesture(createRaceGestureState(), 7, 20, 100).state;
  result = moveRaceGesture(swipe, 7, 39, 100 + DROP_DISTANCE); swipe = result.state;
  same(result.input, { held: false, boost: false, drop: true }, "inclusive swipe boundary did not emit drop");
  assert(moveRaceGesture(swipe, 7, 39, 160).input === null, "one contact emitted drop twice");
  const merged = createRaceState();
  loadRaceInputs(merged, [
    { tick: 4, held: true, boost: false, drop: true },
    { tick: 4, held: true, boost: true },
  ]);
  same(merged.inputs, [{ tick: 4, held: true, boost: true, drop: true }], "same-tick final state/drop merge changed");
  let rejected = false;
  try { loadRaceInputs(createRaceState(), [{ tick: 0, held: false, boost: true }]); } catch { rejected = true; }
  assert(rejected, "boost=true with held=false was not rejected");

  // Acceptance 2: presentation mapping is render-only and READY freezes time.
  const canonical = runWorldReplay(authoredOptimized.transitions, 360, 640);
  const tallPhone = runWorldReplay(authoredOptimized.transitions, 390, 844);
  same(raceSignature(canonical), raceSignature(tallPhone), "viewport changed authority");
  const canonicalViewport = raceViewport(360, 640);
  same(canonicalViewport, { scale: 1, left: 0, top: 0, contentWidth: 360, contentHeight: 640 },
    "canonical race viewport changed");
  const tallViewport = raceViewport(390, 844);
  near(tallViewport.scale, 13 / 12, 1e-12, "tall-phone race scale changed");
  near(tallViewport.left, 0, 1e-12, "tall-phone race viewport was not horizontally centered");
  near(tallViewport.top, (844 - 640 * 13 / 12) / 2, 1e-12,
    "tall-phone race viewport was not vertically centered");
  near(tallViewport.contentWidth, 390, 1e-12, "tall-phone race content width changed");
  near(tallViewport.contentHeight, 640 * 13 / 12, 1e-12, "tall-phone race content height changed");
  same([
    canonicalRaceY(tallViewport.top, tallViewport.top, tallViewport.contentHeight),
    canonicalRaceY(raceViewportY(tallViewport, 320), tallViewport.top, tallViewport.contentHeight),
    canonicalRaceY(tallViewport.top + tallViewport.contentHeight, tallViewport.top, tallViewport.contentHeight),
  ], [0, 320, 640], "three-argument canonical race Y mapping changed");
  const mappedDropTick = [];
  for (const viewport of [canonicalViewport, tallViewport]) {
    let state = pressRaceGesture(createRaceGestureState(), 2, 40,
      canonicalRaceY(raceViewportY(viewport, 100), viewport.top, viewport.contentHeight)).state;
    const mapped = moveRaceGesture(state, 2, 52,
      canonicalRaceY(raceViewportY(viewport, 100 + DROP_DISTANCE), viewport.top, viewport.contentHeight));
    assert(mapped.input?.drop, `${viewport.contentHeight}px content viewport did not emit canonical drop`);
    mappedDropTick.push(52);
  }
  same(mappedDropTick, [52, 52], "viewport mapping changed semantic drop tick");
  same(RACE_READY_COPY, ["HOLD TO RISE", "DOUBLE-TAP + HOLD TO BOOST", "SWIPE DOWN TO DIVE"],
    "race ready copy changed");
  const projectionWorld = makeWorld(390, 844);
  const projectionSave = defaultSave();
  resetRun(projectionWorld, projectionSave, "fly", false, PROTOTYPE_RACE_MISSION);
  near(projectionWorld.squirrel.y, raceViewportY(tallViewport, projectionWorld.race.y), 1e-9,
    "READY reset did not use the centered race viewport");
  near(projectionWorld.squirrel.vy, 0, 1e-9, "READY reset projected nonzero race velocity");
  projectionWorld.race.y = 144;
  projectionWorld.race.vy = -300;
  resizeWorld(projectionWorld, 844, 390);
  const wideViewport = raceViewport(844, 390);
  near(projectionWorld.squirrel.y, raceViewportY(wideViewport, 144), 1e-9,
    "race resize did not project canonical Y through the uniform viewport");
  near(projectionWorld.squirrel.vy, -300 * wideViewport.scale, 1e-9,
    "race resize did not scale canonical velocity through the uniform viewport");
  const world = makeWorld(360, 640);
  const save = defaultSave();
  resetRun(world, save, "fly", false, PROTOTYPE_RACE_MISSION);
  const frozen = [world.race.tick, world.race.coursePosition, world.race.y];
  for (let i = 0; i < 30; i++) updateWorld(world, save, RACE_DT);
  same([world.race.tick, world.race.coursePosition, world.race.y], frozen, "READY advanced race authority");
  setRaceInput(world, { held: false, boost: false });
  assert(world.ready, "neutral semantic snapshot cleared READY");
  setRaceInput(world, { held: true, boost: false });
  assert(!world.ready && world.race.tick === 0 && world.race.inputs[0].tick === 0,
    "positive semantic input did not launch at tick 0");
  updateWorld(world, save, RACE_DT);
  assert(world.race.tick === 1, "first launched update did not consume authority tick 0");
  pausePlay(world);
  assert(world.screen === "pause", "active race did not enter pause state");
  const pausedAuthority = {
    tick: world.race.tick,
    coursePosition: world.race.coursePosition,
    y: world.race.y,
    signature: raceSignature(world.race),
  };
  for (let frame = 0; frame < 30; frame++) updateWorld(world, save, 0.25);
  same({
    tick: world.race.tick,
    coursePosition: world.race.coursePosition,
    y: world.race.y,
    signature: raceSignature(world.race),
  }, pausedAuthority, "paused/focus-lost presentation time advanced race authority");

  const engineSource = readFileSync(join(root, "illustrated-src", "game", "engine.ts"), "utf8");
  const pauseStart = engineSource.indexOf("    pause() {");
  const pauseEnd = engineSource.indexOf("    resume() {", pauseStart);
  const pauseContract = engineSource.slice(pauseStart, pauseEnd);
  assert(pauseStart >= 0 && pauseEnd > pauseStart
    && pauseContract.includes("if (world.race) raceAccumulator = 0;")
    && pauseContract.includes("pausePlay(world);"),
  "engine pause no longer discards the race accumulator before pausing authority");
  assert(/window\.addEventListener\("blur", \(\) => \{\s*if \(world\.race && world\.screen === "play"\) \{\s*engine\.pause\(\);\s*return;/m.test(engineSource),
    "engine blur no longer routes an active race through pause");
  assert(/document\.addEventListener\("visibilitychange", \(\) => \{\s*if \(document\.hidden\) \{\s*if \(world\.race && world\.screen === "play"\) \{\s*engine\.pause\(\);\s*return;/m.test(engineSource),
    "engine visibility loss no longer routes an active race through pause");

  // Acceptance 3: cadence independence with advanced input present.
  assert(authoredOptimized.transitions.some((input) => input.boost), "optimized fixture has no boost event");
  assert(authoredOptimized.transitions.some((input) => input.drop), "optimized fixture has no drop event");
  const at60 = runReplay(authoredOptimized.transitions, [1 / 60]).race;
  const at30 = runReplay(authoredOptimized.transitions, [1 / 30]).race;
  const mixed = runReplay(authoredOptimized.transitions, [1 / 60, 1 / 24, 1 / 120, 1 / 15, 1 / 30, 1 / 20]).race;
  same(raceSignature(at60), raceSignature(at30), "30 fps cadence changed authority");
  same(raceSignature(at60), raceSignature(mixed), "mixed cadence changed authority");

  // Acceptance 4: layout/routes, profile bands, and redline reachability.
  assertAuthoredLayout();
  const passive = runReplay([]);
  const average = runReplay(authoredAverage.transitions);
  const optimized = runReplay(authoredOptimized.transitions);
  assertProfile("passive", passive, [8_990, 9_010], { passedRange: [0, 0], wormholes: 0, debris: [0, 0] });
  assert(passive.race.boostTicks.length === 0 && passive.race.dropTicks.length === 0,
    "passive fixture emitted an advanced input event");
  assertProfile("average", average, [6_240, 6_720], { passedRange: [44, 50], wormholes: 2, debris: [0, 2], mean: [371, 403] });
  assertProfile("optimized", optimized, [5_400, 5_700], { passed: [60], wormholes: 3, debris: [0, 0] });
  same([raceGrade(passive.race.finishTicks), raceGrade(average.race.finishTicks), raceGrade(optimized.race.finishTicks)],
    [1, 2, 3], "Revision 2 star thresholds do not separate the benchmark fixtures");
  same(optimized.race.ringLedger.map((state, i) => state === "skipped" ? i + 1 : null).filter(Boolean),
    [...Array.from({ length: 8 }, (_, i) => i + 21), ...Array.from({ length: 8 }, (_, i) => i + 49),
      ...Array.from({ length: 8 }, (_, i) => i + 77)], "optimized route skip sets changed");
  same(optimized.race.ringLedger.slice(73, 76), ["passed", "passed", "passed"], "optimized fixture failed named redline gates");
  assert(passive.race.finishTicks - optimized.race.finishTicks >= 2_700,
    "passive-to-optimized separation fell below 45 seconds");

  // Give a plain-control challenger every non-input advantage: perfect
  // teleported gate alignment and no debris. Enumerating every
  // pass/miss subset of r69..r73 identifies routes slow enough for the
  // 330 px/s plain-rise cap to cover the first 276-pixel redline leg. This is
  // an optimistic lower bound: any real advanced-free input path is no faster.
  function optimisticPlainBenchmark(missMask, examDebrisReset) {
    const race = createRaceState();
    race.debrisLedger.fill(true);
    let resetApplied = false;
    while (race.phase !== "finish" && race.tick < 10_000) {
      if (race.phase === "normal") {
        const nextIndex = race.ringLedger.findIndex((state, i) =>
          state === "pending" && RACE_RINGS[i].x >= race.coursePosition);
        if (nextIndex >= 0) {
          const ring = RACE_RINGS[nextIndex];
          race.y = ring.y + (missMask.has(nextIndex) ? 100 : 0);
          race.vy = 0;
        }
      }
      const beforeX = race.coursePosition;
      stepRace(race);
      if (examDebrisReset && !resetApplied && beforeX < RACE_DEBRIS[26].x
          && RACE_DEBRIS[26].x <= race.coursePosition) {
        race.speed = RACE_BASE_SPEED;
        race.speedGraceTicks = 0;
        race.charge = Math.max(0, race.charge - 10);
        resetApplied = true;
      }
    }
    return race;
  }
  function plainChainReachable(firstLegTicks, secondLegTicks) {
    // For a bounded-acceleration double integrator, the Pareto frontier for
    // maximum upward displacement plus maximum exit velocity is bang-bang:
    // hold, then release once. Enumerating every fixed-step switch tick covers
    // every non-dominated plain hold/release history. Start at the most
    // favorable low-gate edge and upward cap; release throughout leg two is
    // the most generous possible descent (overshoot is accepted here), so
    // this deliberately over-approximates advanced-free reachability.
    for (let releaseAt = 0; releaseAt <= firstLegTicks; releaseAt++) {
      let y = 496 - RACE_GATE_CLEARANCE;
      let vy = -330;
      for (let tick = 0; tick < firstLegTicks; tick++) {
        const acceleration = tick < releaseAt ? -700 : 1_050;
        vy = Math.max(-330, Math.min(390, vy + acceleration * RACE_DT));
        y += vy * RACE_DT;
      }
      if (y < 144 - RACE_GATE_CLEARANCE || y > 144 + RACE_GATE_CLEARANCE) continue;
      for (let tick = 0; tick < secondLegTicks; tick++) {
        vy = Math.max(-330, Math.min(390, vy + 1_050 * RACE_DT));
        y += vy * RACE_DT;
      }
      if (y >= 496 - RACE_GATE_CLEARANCE) return true;
    }
    return false;
  }
  const plainBenchmarks = [];
  for (const examDebrisReset of [false, true]) {
    for (let bits = 0; bits < 32; bits++) {
      const misses = new Set(Array.from({ length: 5 }, (_, bit) => bit + 68).filter((_, bit) => bits & (1 << bit)));
      const race = optimisticPlainBenchmark(misses, examDebrisReset);
      const firstLegTicks = race.ringDecisionTicks[74] - race.ringDecisionTicks[73];
      const secondLegTicks = race.ringDecisionTicks[75] - race.ringDecisionTicks[74];
      if (plainChainReachable(firstLegTicks, secondLegTicks)) {
        plainBenchmarks.push({ bits, examDebrisReset, finishTicks: race.finishTicks, firstLegTicks, secondLegTicks });
      }
    }
  }
  assert(plainBenchmarks.length > 0, "advanced-free slowdown search found no plain-feasible redline route");
  const fastestPlainBenchmark = plainBenchmarks.reduce((best, candidate) =>
    candidate.finishTicks < best.finishTicks ? candidate : best);
  assert(fastestPlainBenchmark.finishTicks > 5_700,
    `optimistic advanced-free slowdown stayed in optimized band: ${JSON.stringify(fastestPlainBenchmark)}`);

  const plainTicks = Math.round(384 / RACE_MAX_SPEED / RACE_DT);
  let plainY = 496 - RACE_GATE_CLEARANCE;
  const plainVy = -330;
  for (let i = 0; i < plainTicks; i++) plainY += plainVy * RACE_DT;
  assert(plainTicks === 48 && plainY > 144 + RACE_GATE_CLEARANCE,
    `plain cap path reached high gate: y=${plainY}`);
  let witnessY = 522;
  let witnessVy = -520;
  for (let i = 0; i < 36; i++) {
    witnessVy = Math.max(-520, witnessVy - 2_100 * RACE_DT);
    witnessY += witnessVy * RACE_DT;
  }
  for (let i = 0; i < 12; i++) {
    witnessVy = Math.max(-330, Math.min(390, witnessVy + 1_050 * RACE_DT));
    witnessY += witnessVy * RACE_DT;
  }
  assert(Math.abs(witnessY - 144) <= RACE_GATE_CLEARANCE, `boost witness missed high gate at y=${witnessY}`);
  witnessVy = QUICK_DROP_VY;
  for (let i = 0; i < 48; i++) {
    witnessVy = Math.min(390, witnessVy + 1_050 * RACE_DT);
    witnessY += witnessVy * RACE_DT;
  }
  assert(Math.abs(witnessY - 496) <= RACE_GATE_CLEARANCE, `drop witness missed low gate at y=${witnessY}`);

  // Acceptance 5: swept objects, exact plane, fade clocks, full-ring fallback.
  const gate = RACE_RINGS[0];
  const debris = RACE_DEBRIS[0];
  for (const speed of [RACE_BASE_SPEED, RACE_MAX_SPEED]) {
    const dx = speed * RACE_DT;
    assert(sweptGateHit(gate.x - dx * 0.6, gate.x + dx * 0.4, gate.y, gate.y, gate),
      `gate swept hit failed at ${speed}`);
    assert(sweptDebrisHit(debris.x - dx * 0.6, debris.x + dx * 0.4, debris.y, debris.y, debris),
      `debris swept hit failed at ${speed}`);
  }
  function planeFixture(y, expectedState, duration) {
    const race = createRaceState();
    race.coursePosition = gate.x - 2 * (RACE_MAX_SPEED * RACE_DT);
    race.previousCoursePosition = race.coursePosition;
    race.y = y;
    race.previousY = y;
    race.vy = 0;
    race.speed = RACE_MAX_SPEED;
    race.speedGraceTicks = 3;
    stepRace(race);
    assert(race.ringLedger[0] === "pending" && race.ringDecisionTicks[0] === null, "gate decided before plane");
    const decisionTick = race.tick;
    stepRace(race);
    assert(race.ringDecisionTicks[0] === decisionTick, "decision did not stamp first crossing pre-increment tick");
    const state = race.ringLedger[0];
    assert(state === expectedState, `plane fixture resolved ${state}, expected ${expectedState}`);
    const ageAtDecision = Math.max(0, race.tick - 1 - decisionTick);
    assert(ageAtDecision === 0 && ageAtDecision / duration === 0, "gate fade did not begin at age/blend zero");
    for (let age = 1; age <= duration; age++) {
      stepRace(race);
      assert(race.ringLedger[0] === state && race.ringDecisionTicks[0] === decisionTick,
        `gate decision changed during fade at age ${age}`);
      const observedAge = Math.max(0, race.tick - 1 - decisionTick);
      assert(observedAge === age && Math.min(1, observedAge / duration) === age / duration,
        `${state} fade age ${observedAge} did not match ${age}/${duration}`);
    }
    return state;
  }
  assert(planeFixture(gate.y, "passed", RACE_GATE_PASS_FADE_TICKS) === "passed", "centered plane fixture did not pass");
  assert(planeFixture(gate.y + RACE_GATE_CLEARANCE + 40, "missed", RACE_GATE_MISS_FADE_TICKS) === "missed",
    "offset plane fixture did not miss");
  same([RACE_GATE_PASS_FADE_TICKS, RACE_GATE_MISS_FADE_TICKS], [27, 39], "gate fade durations changed");
  assert(HYPER_RUN_GATE_FALLBACK_GEOMETRY.shape === "full-ring"
    && HYPER_RUN_GATE_FALLBACK_GEOMETRY.backStart === 0
    && HYPER_RUN_GATE_FALLBACK_GEOMETRY.backEnd === Math.PI * 2
    && HYPER_RUN_GATE_FALLBACK_GEOMETRY.frontEnd - HYPER_RUN_GATE_FALLBACK_GEOMETRY.frontStart < Math.PI,
  "procedural fallback is not a complete back ring plus thin front arc");
  for (const state of ["idle", "passed", "missed"]) {
    const required = state === "idle"
      ? ["gate-idle-back", "gate-idle-front"]
      : ["gate-idle-back", "gate-idle-front", `gate-${state}-back`, `gate-${state}-front`];
    for (let mask = 0; mask < 2 ** required.length; mask++) {
      const paintings = Object.fromEntries(required
        .filter((_, index) => (mask & (1 << index)) !== 0)
        .map((key) => [key, {}]));
      const complete = mask === 2 ** required.length - 1;
      assert(hyperRunGateUsesPaintedPairs(paintings, state) === complete,
        `${state} gate pair mask ${mask.toString(2).padStart(required.length, "0")} did not select one composite path`);
    }
  }

  // Acceptance 6: tunnel parity/content/mirroring and exact handoff/settle.
  function oneTunnelTick(input, vy = 0) {
    const race = createRaceState();
    race.phase = "tunnel";
    race.phaseTick = 0;
    race.phaseStartPosition = 1_000;
    race.coursePosition = 1_000;
    race.entryAnchorY = 320;
    race.y = 320;
    race.previousY = 320;
    race.vy = vy;
    race.tunnelAcornLedger[0] = Array(18).fill(false);
    if (input) loadRaceInputs(race, [{ tick: 0, ...input }]);
    stepRace(race);
    return race;
  }
  near(oneTunnelTick({ held: false, boost: false }).vy, WORMHOLE_RELEASE_ACCEL * RACE_DT, 1e-9,
    "race tunnel release acceleration drifted from Wormhole Run");
  near(oneTunnelTick({ held: true, boost: false }).vy, WORMHOLE_HOLD_ACCEL * RACE_DT, 1e-9,
    "race tunnel hold acceleration drifted from Wormhole Run");
  near(oneTunnelTick({ held: true, boost: false }, WORMHOLE_MIN_VY).vy, WORMHOLE_MIN_VY, 1e-9,
    "race tunnel upward clamp drifted");
  near(oneTunnelTick({ held: false, boost: false }, WORMHOLE_MAX_VY).vy, WORMHOLE_MAX_VY, 1e-9,
    "race tunnel downward clamp drifted");
  assert(oneTunnelTick({ held: true, boost: true }).vy < WORMHOLE_HOLD_ACCEL * RACE_DT,
    "tunnel boost was not stronger than plain hold");
  assert(oneTunnelTick({ held: false, boost: false, drop: true }).vy > QUICK_DROP_VY,
    "tunnel drop did not apply before released integration");
  const mirrorBits = [0, 1, 2].map((wormholes) => raceTunnelMirrored({ seed: RACE_SEED, wormholes }));
  assert(new Set(mirrorBits).size === 2, `first three tunnel cycles did not cover both mirrors: ${mirrorBits}`);
  const actualTunnelEntries = [19, 47, 75].map((ringIndex, wormholes) => ({
    wormholes,
    entryAnchorY: RACE_RINGS[ringIndex].y,
  }));
  same(actualTunnelEntries, [
    { wormholes: 0, entryAnchorY: 320 },
    { wormholes: 1, entryAnchorY: 300 },
    { wormholes: 2, entryAnchorY: 496 },
  ], "optimized route's three authority entry anchors changed");
  assert(actualTunnelEntries.every((entry) => raceTunnelAcorns({ seed: RACE_SEED, ...entry }).length === 18),
    "tunnel cycle does not contain exactly 18 authored acorns");
  const canonicalTunnelRewards = raceTunnelAcorns({ seed: RACE_SEED, wormholes: 0, entryAnchorY: 320 }).slice(5);
  same(canonicalTunnelRewards, [
    { tick: 225, y: 480 }, { tick: 229, y: 465 }, { tick: 234, y: 427 }, { tick: 238, y: 379 },
    { tick: 242, y: 327 }, { tick: 246, y: 275 }, { tick: 251, y: 210 }, { tick: 255, y: 156 },
    { tick: 257, y: 156 }, { tick: 264, y: 233 }, { tick: 271, y: 310 }, { tick: 278, y: 387 },
    { tick: 285, y: 464 },
  ], "canonical boost/drop reward line changed");
  const mirroredTunnelRewards = raceTunnelAcorns({ seed: RACE_SEED, wormholes: 2, entryAnchorY: 496 }).slice(5);
  same(mirroredTunnelRewards, [
    { tick: 225, y: 160 }, { tick: 229, y: 175 }, { tick: 234, y: 213 }, { tick: 238, y: 261 },
    { tick: 242, y: 313 }, { tick: 246, y: 365 }, { tick: 251, y: 430 }, { tick: 255, y: 429 },
    { tick: 257, y: 433 }, { tick: 264, y: 407 }, { tick: 271, y: 330 }, { tick: 278, y: 253 },
    { tick: 285, y: 176 },
  ], "mirrored drop/boost line or its two asymmetric cusp overrides changed");

  const tunnelWitnessSchedules = [
    {
      pressTicks: [7, 50, 124, 180], releaseTicks: [21, 71, 150, 198],
      boostPrepTick: 206, boostTick: 221, dropTick: 256, dropFromOwnedContact: false,
    },
    {
      pressTicks: [10, 65, 124, 180], releaseTicks: [30, 80, 150, 198],
      boostPrepTick: 206, boostTick: 221, dropTick: 256, dropFromOwnedContact: false,
    },
    {
      pressTicks: [8, 77, 163, 205], releaseTicks: [30, 124, 181],
      boostPrepTick: 234, boostTick: 249, dropTick: 224, dropFromOwnedContact: true,
    },
  ];

  function runFullTunnelReward(wormholes, entryAnchorY, schedule) {
    const mirrored = raceTunnelMirrored({ seed: RACE_SEED, wormholes });
    const race = createRaceState();
    race.phase = "tunnel";
    race.phaseTick = 0;
    race.phaseStartPosition = 1_000;
    race.coursePosition = 1_000;
    race.entryAnchorY = entryAnchorY;
    race.y = entryAnchorY;
    race.previousY = entryAnchorY;
    race.vy = 0;
    race.wormholes = wormholes;
    race.tunnelAcornLedger[wormholes] = Array(18).fill(false);
    const targets = raceTunnelAcorns(race);
    const targetByTick = new Map(targets.map((acorn, index) => [acorn.tick, { ...acorn, index }]));
    let gesture = createRaceGestureState();
    let ownerSerial = mirrored ? 400 : 300;
    const rawEvents = [];
    const collected = [];
    const trajectory = [];
    let minimumWallClearance = Number.POSITIVE_INFINITY;
    const emit = (result, kind) => {
      gesture = result.state;
      rawEvents.push({ tick: race.tick, kind, input: result.input });
      if (result.input) queueRaceInput(race, result.input);
      return result;
    };
    const press = (kind = "press") => {
      const owner = ownerSerial++;
      return { owner, result: emit(pressRaceGesture(gesture, owner, race.tick, race.y), kind) };
    };
    const release = (kind = "release") => {
      assert(gesture.owner !== null, `phase ${race.phaseTick} had no gesture owner to release`);
      return emit(releaseRaceGesture(gesture, gesture.owner), kind);
    };

    for (let phaseTick = 0; phaseTick <= 285; phaseTick++) {
      if (schedule.pressTicks.includes(phaseTick)) {
        const down = press("plain-press").result;
        same(down.input, { held: true, boost: false }, `phase ${phaseTick} plain hold was not recognizer-realizable`);
      }
      if (schedule.releaseTicks.includes(phaseTick)) release();

      if (phaseTick === schedule.boostPrepTick) {
        const firstTap = press("boost-first-tap");
        same(firstTap.result.input, { held: true, boost: false }, "boost first tap was not plain");
        release("boost-first-release");
      } else if (phaseTick === schedule.boostTick) {
        const secondDown = press("boost-second-down").result;
        same(secondDown.input, { held: true, boost: true }, "boost second down did not qualify at 15 ticks");
      } else if (phaseTick === schedule.dropTick) {
        let swipeOwner = gesture.owner;
        if (schedule.dropFromOwnedContact) {
          assert(swipeOwner !== null && gesture.downY !== null,
            "owned tunnel swipe had no live plain-hold contact");
        } else {
          release("boost-lift");
          swipeOwner = press("drop-press").owner;
        }
        const moved = emit(moveRaceGesture(gesture, swipeOwner, race.tick, gesture.downY + DROP_DISTANCE), "drop-move");
        same(moved.input, { held: false, boost: false, drop: true },
          "tunnel swipe did not emit the atomic drop");
        release("drop-release");
      }

      const before = race.acorns;
      const corridor = raceTunnelGeometry(race, phaseTick);
      stepRace(race);
      minimumWallClearance = Math.min(minimumWallClearance,
        race.y - (corridor.center - corridor.half + 16),
        corridor.center + corridor.half - 16 - race.y);
      const target = targetByTick.get(phaseTick);
      if (target) trajectory.push({ tick: phaseTick, index: target.index, y: Number(race.y.toFixed(3)), target: target.y });
      if (race.acorns > before) collected.push({ tick: phaseTick, y: Number(race.y.toFixed(3)) });
    }
    const maxError = Math.max(...trajectory.map((point) => Math.abs(point.y - point.target)));
    assert(race.acorns === 18 && collected.length === 18 && race.tunnelAcornLedger[wormholes].every(Boolean),
      `${mirrored ? "mirrored" : "unmirrored"} authority route collected ${race.acorns}/18: `
      + `${JSON.stringify({ collected, trajectory, scrapes: race.wallScrapeTicks })}`);
    assert(trajectory.slice(0, 5).every((point) => Math.abs(point.y - point.target) <= 28)
      && trajectory.slice(5).every((point) => Math.abs(point.y - point.target) <= 28),
    `${mirrored ? "mirrored" : "unmirrored"} route did not collect all five center plus 13 advanced acorns`);
    assert(race.wallScrapeTicks.length === 0,
      `${mirrored ? "mirrored" : "unmirrored"} full reward route scraped the corridor`);
    same(race.boostTicks, [schedule.boostTick], "full reward route did not have exactly one qualified boost onset");
    same(race.dropTicks, [schedule.dropTick], "full reward route did not have exactly one legal swipe drop");
    const boostTransitions = race.inputs.filter((input) => input.boost);
    assert(boostTransitions.length === 1 && boostTransitions[0].held,
      "full reward route introduced a direct or repeated mid-hold boost toggle");
    const boostIndex = race.inputs.indexOf(boostTransitions[0]);
    assert(boostIndex > 0 && !race.inputs[boostIndex - 1].held && !race.inputs[boostIndex - 1].boost,
      "full reward boost onset was not preceded by the released first tap");
    return { race, mirrored, entryAnchorY, rawEvents, collected, trajectory, maxError, minimumWallClearance };
  }

  const fullTunnelRewards = actualTunnelEntries.map(({ wormholes, entryAnchorY }, cycle) =>
    runFullTunnelReward(wormholes, entryAnchorY, tunnelWitnessSchedules[cycle]));
  assert(!fullTunnelRewards[0].mirrored && !fullTunnelRewards[1].mirrored && fullTunnelRewards[2].mirrored,
    "actual-entry tunnel reward witnesses did not cover the expected orientation outcomes");
  assert(fullTunnelRewards.every((reward, cycle) => reward.entryAnchorY === actualTunnelEntries[cycle].entryAnchorY
    && reward.race.acorns === 18 && reward.race.wallScrapeTicks.length === 0),
  "one of the three actual entry-anchor cycles failed the full reward route");
  assert(RACE_MAX_WORMHOLES === 3 && RACE_ACORNS.length + RACE_MAX_WORMHOLES * 18 === RACE_MAX_ACORNS
    && RACE_MAX_ACORNS === 96,
  "42 normal pickups plus three individually reachable 18-acorn tunnel sets no longer derive the 96 theoretical content ceiling");
  const ceilingConflict = { ring: RACE_RINGS[66], acorn: RACE_ACORNS[33] };
  assert(ceilingConflict.ring.id === "r67" && ceilingConflict.acorn.id === "a34"
    && ceilingConflict.ring.x === ceilingConflict.acorn.x
    && Math.abs(ceilingConflict.ring.y - ceilingConflict.acorn.y) > RACE_GATE_CLEARANCE + 26,
  "same-plane r67/a34 exclusion no longer proves that 96 is a content ceiling rather than a replay claim");
  const handoff = createRaceState();
  handoff.phase = "tunnel";
  handoff.phaseStartPosition = 1_000;
  handoff.coursePosition = 1_000;
  handoff.entryAnchorY = 320;
  handoff.y = 320;
  handoff.charge = 100;
  handoff.tunnelAcornLedger[0] = Array(18).fill(false);
  for (let i = 0; i < RACE_TUNNEL_TICKS + RACE_RETURN_TICKS; i++) stepRace(handoff);
  assert(handoff.phase === "normal", "return did not hand back to normal flight");
  near(handoff.coursePosition, 1_000 + RACE_TUNNEL_DISTANCE, 1e-9, "tunnel distance changed");
  assert(handoff.charge === 0, `return charge ${handoff.charge}, expected 0`);
  assert(handoff.speed === RACE_RETURN_SPEED, `return speed ${handoff.speed}, expected ${RACE_RETURN_SPEED}`);
  assert(RACE_RETURN_MARGIN === 96 && handoff.y >= 96 && handoff.y <= 544,
    `return y ${handoff.y} outside separately derived 96..544 band`);
  assert(handoff.collisionGraceTicks === RACE_RETURN_GRACE_TICKS + 1,
    `return armed ${handoff.collisionGraceTicks}, expected pre-decrement ${RACE_RETURN_GRACE_TICKS + 1}`);
  function debrisContactsAtGraceStep(stepNumber) {
    const race = createRaceState();
    const target = RACE_DEBRIS[0];
    race.ringLedger.fill("missed");
    race.debrisLedger.fill(true);
    race.debrisLedger[0] = false;
    race.acornLedger.fill(true);
    race.collisionGraceTicks = RACE_RETURN_GRACE_TICKS + 1;
    for (let step = 1; step < stepNumber; step++) stepRace(race);
    race.coursePosition = target.x - RACE_BASE_SPEED * RACE_DT / 2;
    race.speed = RACE_BASE_SPEED;
    race.y = target.y;
    race.vy = 0;
    stepRace(race);
    return race.debrisContacts;
  }
  same(debrisContactsAtGraceStep(21), [], "post-return normal step 21 was not collision-protected");
  same(debrisContactsAtGraceStep(22), [RACE_DEBRIS[0].id], "post-return normal step 22 was not collision-live");
  const once = createRaceState();
  once.coursePosition = RACE_LENGTH - RACE_BASE_SPEED * RACE_DT / 2;
  let settles = 0;
  for (let i = 0; i < 3; i++) if (stepRace(once).finished) settles += 1;
  assert(settles === 1, `finish emitted ${settles} settlements`);

  const evidence = {
    suite: "Hyper Run Revision 2 mandatory replay acceptance",
    fixedStepHz: 60,
    tests: {
      sameSeedAndSemanticInputs: "passed",
      presentationSizeAndReadyFreeze: "passed",
      renderCadenceIndependence: "passed",
      rebasedProfilesAndReachability: "passed",
      sweptObjectsAndGatePlane: "passed",
      tunnelParityAndHandoff: "passed",
    },
    profiles: {
      passive: { ticks: passive.race.finishTicks, time: formatRaceTicks(passive.race.finishTicks), wormholes: passive.race.wormholes },
      average: { ticks: average.race.finishTicks, time: formatRaceTicks(average.race.finishTicks), wormholes: average.race.wormholes,
        passed: countLedger(average.race, "passed"), meanNormalSpeed: Number(average.meanNormalSpeed.toFixed(3)) },
      optimized: { ticks: optimized.race.finishTicks, time: formatRaceTicks(optimized.race.finishTicks), wormholes: optimized.race.wormholes,
        passed: countLedger(optimized.race, "passed"), meanNormalSpeed: Number(optimized.meanNormalSpeed.toFixed(3)) },
    },
    optimizedSignature: raceSignature(optimized.race),
    semanticTransitions: authoredOptimized.transitions.length,
    benchmarkGestureRealization: {
      average: {
        rawEvents: realizedAverage.rawEvents,
        eventsPerSecond: Number((realizedAverage.rawEvents / (average.race.finishTicks / 60)).toFixed(3)),
        qualifyingBoostPresses: realizedAverage.qualifyingBoostPresses,
        swipeDrops: realizedAverage.swipeDrops,
      },
      optimized: {
        rawEvents: realizedOptimized.rawEvents,
        eventsPerSecond: Number((realizedOptimized.rawEvents / (optimized.race.finishTicks / 60)).toFixed(3)),
        qualifyingBoostPresses: realizedOptimized.qualifyingBoostPresses,
        swipeDrops: realizedOptimized.swipeDrops,
      },
    },
    mirrorBits,
    advancedFreeOptimisticLowerBound: fastestPlainBenchmark,
    theoreticalAcornCeilingDerivation: `${RACE_ACORNS.length} + ${RACE_MAX_WORMHOLES} * 18 = ${RACE_MAX_ACORNS}`,
    mirroredCuspOverrides: [{ tick: 255, y: 429 }, { tick: 257, y: 433 }],
    fullTunnelRewards: fullTunnelRewards.map((reward, cycle) => ({
      cycle,
      entryAnchorY: reward.entryAnchorY,
      mirrored: reward.mirrored,
      collected: reward.race.acorns,
      scrapes: reward.race.wallScrapeTicks.length,
      maxError: Number(reward.maxError.toFixed(3)),
      minimumWallClearance: Number(reward.minimumWallClearance.toFixed(3)),
      first: reward.collected[0],
      last: reward.collected[17],
    })),
    returnGrace: { protectedNormalSteps: RACE_RETURN_GRACE_TICKS, firstLiveStep: RACE_RETURN_GRACE_TICKS + 1 },
  };
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
