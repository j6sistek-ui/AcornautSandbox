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
  const artSource = readFileSync(join(gameDir, "art.ts"), "utf8");
  assert(artSource.includes('"return-back", "return-front", "return-glyphs", "scout-ship"')
    && artSource.includes("named(HYPER_RUN_ENABLED ? hyperRunIds : [], \"hyper-run\")"),
  "scout ship is not loaded atomically with the beta-gated Hyper Run bank");
  const standaloneSource = readFileSync(join(gameDir, "standalone.ts"), "utf8");
  for (const requiredCopy of [
    "Thread blue gates to build speed and charge the wormhole.",
    "Acorns are an optional collection record and do not change your time.",
    "SPACE FLIGHT", "DOUBLE-TAP + HOLD", "SWIPE DOWN",
    "WORMHOLE", "PRESS + DRAG", "WHITE RING", "CENTER RING",
    "Perfect connection · faster exit",
  ]) {
    assert(standaloneSource.includes(requiredCopy),
      `Hyper Run preflight briefing omitted ${JSON.stringify(requiredCopy)}`);
  }
  assert(standaloneSource.includes('const raceBriefing = def.experimental && def.base === "race"')
    && standaloneSource.includes('def.experimental ? "START RUN"')
    && standaloneSource.includes('`ACORNS  ${r.acorns} / ${PROTOTYPE_RACE_MAX_ACORNS}`')
    && !standaloneSource.includes("THEORETICAL CONTENT CEILING"),
  "Hyper Run briefing or launch CTA is not tied to every experimental race open");
  const docsShell = readFileSync(join(root, "docs", "index.html"), "utf8");
  const sandboxShell = readFileSync(join(root, "sandbox_assets", "index.html"), "utf8");
  assert(docsShell === sandboxShell && docsShell.includes(".ac-lvlcard.ac-racecard")
    && docsShell.includes("max-height: min(94vh, 820px)")
    && docsShell.includes(".ac-racebriefblock h3 { margin: 0 0 8px; font: 900 14px")
    && docsShell.includes(".ac-racecontrol b { color: #a9f5ff; font-size: 14px")
    && docsShell.includes("@media (max-width: 619px), (max-height: 699px)"),
  "mirrored responsive Hyper Run briefing shell changed or is missing its compact layout");
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
    RACE_COURSE_SCALE,
    RACE_DEBRIS,
    RACE_DEBRIS_CHARGE_PENALTY,
    RACE_DT,
    RACE_ENTRY_TICKS,
    RACE_GATE_APERTURE,
    RACE_GATE_CLEARANCE,
    RACE_GATE_MISS_FADE_TICKS,
    RACE_GATE_PASS_FADE_TICKS,
    RACE_HEIGHT,
    RACE_LENGTH,
    RACE_LATEST_ENTRY_X,
    RACE_MAX_ACORNS,
    RACE_MAX_INTERACTIVE_GAP,
    RACE_MAX_SPEED,
    RACE_MAX_WORMHOLES,
    RACE_NORMAL_BOOST_PRESS_VY,
    RACE_NORMAL_PRESS_VY,
    RACE_NORMAL_RELEASE_BRAKE_VY,
    RACE_PILOT_X,
    RACE_PILOT_RADIUS,
    RACE_READY_COPY,
    RACE_RING_CHARGE,
    RACE_RING_SPEED_GAIN,
    RACE_RETURN_MARGIN,
    RACE_RETURN_GRACE_TICKS,
    RACE_RETURN_SPEED,
    RACE_RETURN_TICKS,
    RACE_RINGS,
    RACE_SEED,
    RACE_TUNNEL_DISTANCE,
    RACE_TUNNEL_DRAG_STEP,
    RACE_TUNNEL_DRAG_TRAVERSAL_TICKS,
    RACE_TUNNEL_PERFECT_APERTURE,
    RACE_TUNNEL_PERFECT_CLEARANCE,
    RACE_TUNNEL_QUALITY_SPEED_GAIN,
    RACE_TUNNEL_RING_APERTURE,
    RACE_TUNNEL_RING_CLEARANCE,
    RACE_TUNNEL_RING_TICKS,
    RACE_TUNNEL_SPEED,
    RACE_TUNNEL_TICKS,
    RACE_SPEED_DECAY_PER_SECOND,
    RACE_THREE_STAR_TICKS,
    RACE_TWO_STAR_TICKS,
    createRaceState,
    formatRaceTicks,
    loadRaceInputs,
    queueRaceInput,
    raceGrade,
    raceDecisionAge,
    raceRouteTarget,
    raceSignature,
    raceTunnelFollowerY,
    raceTunnelGeometry,
    raceTunnelMirrored,
    raceTunnelQuality,
    raceTunnelRings,
    stepRace,
    sweptDebrisHit,
    sweptGateHit,
  } = raceApi;
  const {
    DOUBLE_TAP_MAX_GAP_TICKS,
    DROP_DISTANCE,
    cancelRaceGesture,
    canonicalRaceY,
    createRaceGestureState,
    moveRaceGesture,
    moveRaceDragGesture,
    neutralizeOwnedRaceGesture,
    pressRaceDragGesture,
    pressRaceGesture,
    pressRaceKeyboardDragGesture,
    releaseRaceGesture,
  } = gestureApi;
  const { RACE_MAX_VIRTUAL_WIDTH, raceViewport, raceViewportX, raceViewportY } = viewportApi;
  const {
    HYPER_RUN_GATE_FALLBACK_GEOMETRY,
    hyperRunChargeCopy,
    hyperRunGateUsesPaintedPairs,
    hyperRunReadyLines,
    hyperRunShipLayout,
    hyperRunTunnelRingScreenX,
  } = drawApi;
  const {
    makeWorld, pausePlay, planRaceCueEffects, resetRun, resizeWorld, setRaceInput, takeRaceCueEffects, updateWorld,
  } = simApi;
  const { PROTOTYPE_RACE_MISSION } = campaignApi;
  const { defaultSave } = saveApi;
  const {
    QUICK_DROP_VY,
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
      else speed = Math.max(RACE_BASE_SPEED, speed - RACE_SPEED_DECAY_PER_SECOND * RACE_DT);
      x += speed * RACE_DT;
      if (x >= targetX) return ticks;
    }
    return 240;
  }

  function projectedNormalY(race, ticks, action) {
    let y = race.y;
    let vy = race.vy;
    if (action === "boost" && !race.boost) vy = Math.min(vy, RACE_NORMAL_BOOST_PRESS_VY);
    else if (action === "hold" && !race.held) vy = Math.min(vy, RACE_NORMAL_PRESS_VY);
    if (action === "release" && race.held) vy = Math.max(vy, RACE_NORMAL_RELEASE_BRAKE_VY);
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

  const normalActionInput = (action) => ({
    held: action !== "release",
    boost: action === "boost",
  });

  function projectedNormalPlan(race, ticks, first, second, switchTick) {
    let y = race.y;
    let vy = race.vy;
    let held = race.held;
    let boost = race.boost;
    for (let i = 0; i < ticks; i++) {
      const action = i < switchTick ? first : second;
      const nextHeld = action !== "release";
      const nextBoost = action === "boost";
      if (nextBoost && !boost) vy = Math.min(vy, RACE_NORMAL_BOOST_PRESS_VY);
      else if (nextHeld && !held) vy = Math.min(vy, RACE_NORMAL_PRESS_VY);
      if (held && !nextHeld) vy = Math.max(vy, RACE_NORMAL_RELEASE_BRAKE_VY);
      held = nextHeld;
      boost = nextBoost;
      const acceleration = boost ? -2_100 : held ? -700 : 1_050;
      const minVy = boost ? -520 : -330;
      vy = Math.max(minVy, Math.min(390, vy + acceleration * RACE_DT));
      y += vy * RACE_DT;
      if (y < 16) { y = 16; vy = Math.max(0, vy); }
      if (y > 624) { y = 624; vy = Math.min(0, vy); }
    }
    return { y, vy };
  }

  function bestNormalPlan(race, ticks, targetY, advanced) {
    const actions = advanced ? ["release", "hold", "boost"] : ["release", "hold"];
    const current = race.boost ? "boost" : race.held ? "hold" : "release";
    let best = null;
    for (const first of actions) for (const second of actions) {
      for (let switchTick = 1; switchTick <= ticks; switchTick++) {
        const projected = projectedNormalPlan(race, ticks, first, second, switchTick);
        const cost = Math.abs(projected.y - targetY)
          + Math.abs(projected.vy) * 0.012
          + (first === current ? 0 : 2.5)
          + (first === second || switchTick === ticks ? 0 : 1.5);
        if (!best || cost < best.cost) best = { cost, first };
      }
    }
    return normalActionInput(best.first);
  }

  function desiredNormalInput(race, selected, advanced, memory) {
    const next = firstPendingRing(race, selected);
    if (!next) return { held: false, boost: false };
    const following = nextSelectedRingAfter(race, selected, next.index);
    // Tight similarity-scaled reversals need the near aperture edge as runway; the
    // longer ordinary beats remain center targets to preserve miss margin.
    const runwayBias = following && following.x - next.ring.x <= 400 * RACE_COURSE_SCALE
      ? Math.sign(following.y - next.ring.y) * 30
      : 0;
    let targetY = next.ring.y + runwayBias;
    if (next.ring.skill === "redline-high") targetY -= 6;
    let targetX = next.ring.x;

    // A hazard immediately behind a gate must be read as part of that gate's
    // authored line; waiting until the next target would leave too few ticks
    // to clear it (notably d23, now 30 units after r65).
    for (const d of RACE_DEBRIS) {
      if (race.debrisLedger[RACE_DEBRIS.indexOf(d)]) continue;
      if (d.x < next.ring.x || d.x > next.ring.x + 120 * RACE_COURSE_SCALE) continue;
      if (Math.abs(targetY - d.y) <= d.r + 46) {
        targetY = next.ring.y + (d.y < next.ring.y ? 30 : -30);
      }
      break;
    }

    const bypass = nearestUnselectedRing(race, selected, targetX);
    if (bypass && bypass.x - race.coursePosition < 260 * RACE_COURSE_SCALE) {
      targetX = bypass.x;
      targetY = bypass.y < RACE_HEIGHT / 2 ? Math.min(544, bypass.y + 90) : Math.max(96, bypass.y - 90);
    }

    for (let i = 0; i < RACE_DEBRIS.length; i++) {
      if (race.debrisLedger[i]) continue;
      const d = RACE_DEBRIS[i];
      if (d.x < race.coursePosition || d.x >= targetX
          || d.x - race.coursePosition > 210 * RACE_COURSE_SCALE) continue;
      const projected = race.y + race.vy * ((d.x - race.coursePosition) / Math.max(1, race.speed));
      if (Math.abs(projected - d.y) <= d.r + 34) {
        targetX = d.x;
        targetY = d.y < RACE_HEIGHT / 2 ? Math.min(544, d.y + d.r + 54) : Math.max(96, d.y - d.r - 54);
      }
      break;
    }

    const ticks = normalTicksToPlane(race, targetX);
    const targetKey = `${targetX}:${targetY}`;
    const releaseEnd = projectedNormalY(race, ticks, "release");
    const plainEnd = projectedNormalY(race, ticks, "hold");
    if (advanced && targetY > race.y && releaseEnd < targetY - 18 && race.vy < 300
        && memory.lastDropTarget !== targetKey) {
      memory.lastDropTarget = targetKey;
      return { held: false, boost: false, drop: true };
    }
    return bestNormalPlan(race, ticks, targetY, advanced);
  }

  function desiredTunnelInput(race, profile) {
    const rings = raceTunnelRings(race);
    const ledger = race.tunnelRingLedger[race.wormholes] ?? [];
    const nextIndex = rings.findIndex((_, index) => (ledger[index] ?? "pending") === "pending");
    if (nextIndex < 0) return { held: false, boost: false, dragY: null };
    // The average proof clears every outer aperture but centers only 1/5/9.
    // Optimized play tracks all nine centers for the full exit-speed reward.
    const averageOffset = nextIndex === 0 || nextIndex === 4 || nextIndex === 8
      ? 0
      : nextIndex % 2 === 0 ? -20 : 20;
    return {
      held: false,
      boost: false,
      dragY: raceTunnelGeometry(race, race.phaseTick).center
        + (profile === "optimized" ? 0 : averageOffset),
    };
  }

  function sameInputState(race, input) {
    const ownsDragTarget = Object.prototype.hasOwnProperty.call(input, "dragY");
    return !input.drop && race.held === input.held && race.boost === input.boost
      && (!ownsDragTarget || race.tunnelDragY === input.dragY);
  }

  function runController(profile, seed = RACE_SEED) {
    const race = createRaceState(seed);
    const selected = profile === "optimized" ? optimizedVisible : averageVisible;
    // The average benchmark may use the taught skill moves; only the passive
    // completion fixture is required to omit them. Its authored misses and
    // two-cycle route, rather than disabled controls, create the time band.
    const advanced = true;
    const memory = { lastDropTarget: "" };
    let normalSpeedSum = 0;
    let normalTicks = 0;
    while (race.phase !== "finish" && race.tick < 12_000) {
      let input = { held: false, boost: false };
      if (race.phase === "normal") input = desiredNormalInput(race, selected, advanced, memory);
      else if (race.phase === "tunnel") input = desiredTunnelInput(race, profile);
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
    let dragTargets = 0;
    let dragMoves = 0;
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
      if (Object.prototype.hasOwnProperty.call(target, "dragY")) {
        assert(!target.held && !target.boost && !target.drop,
          `${label} tunnel drag target was not isolated from flight controls`);
        if (target.dragY === null) {
          releaseActive(tick);
        } else {
          dragTargets += 1;
          if (gesture.owner === null) {
            const owner = ownerSerial++;
            emit(pressRaceDragGesture(gesture, owner, tick, 0, target.dragY), tick, "drag-press");
          } else {
            assert(typeof gesture.owner === "number", `${label} tunnel drag had a non-pointer owner`);
            const pointerY = gesture.mode === "pointer-drag"
              ? gesture.downY + target.dragY - gesture.dragStartY
              : 0;
            emit(moveRaceDragGesture(gesture, gesture.owner, tick, pointerY, target.dragY), tick, "drag-move");
            dragMoves += 1;
          }
        }
      } else if (target.drop) {
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
    return {
      transitions: authority.inputs.map((input) => ({ ...input })),
      rawEvents,
      qualifyingBoostPresses,
      swipeDrops,
      dragTargets,
      dragMoves,
    };
  }

  function runReplay(transitions, cadence = [RACE_DT], seed = RACE_SEED) {
    const race = createRaceState(seed);
    loadRaceInputs(race, transitions);
    let accumulator = 0;
    let frame = 0;
    let finishEvents = 0;
    const cues = [];
    const effectPlans = [];
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
        cues.push(...ev.cues);
        const effectBuffer = { raceCueEffects: [...ev.cues] };
        const drained = takeRaceCueEffects(effectBuffer);
        effectPlans.push(...planRaceCueEffects(drained));
        assert(takeRaceCueEffects(effectBuffer).length === 0,
          `authority tick ${race.tick - 1} exposed one cue batch more than once`);
        if (ev.finished) finishEvents += 1;
        accumulator -= RACE_DT;
      }
      frame += 1;
    }
    assert(race.phase === "finish", "replay did not finish");
    assert(finishEvents === 1, `finish settled ${finishEvents} times`);
    return { race, cues, effectPlans, meanNormalSpeed: normalSpeedSum / normalTicks };
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
    same([
      RACE_COURSE_SCALE, RACE_LENGTH, RACE_BASE_SPEED, RACE_MAX_SPEED, RACE_RING_SPEED_GAIN,
      RACE_SPEED_DECAY_PER_SECOND, RACE_RETURN_SPEED, RACE_TUNNEL_SPEED, RACE_TUNNEL_DISTANCE,
      RACE_LATEST_ENTRY_X, RACE_MAX_INTERACTIVE_GAP, RACE_ENTRY_TICKS, RACE_TUNNEL_TICKS, RACE_RETURN_TICKS,
    ], [0.75, 33_750, 225, 360, 13.5, 13.5, 292.5, 562.5, 3_375, 30_375, 540, 48, 360, 36],
    "Revision 3 horizontal similarity constants changed");
    assert(RACE_RINGS.length === 84, `expected 84 rings, got ${RACE_RINGS.length}`);
    assert(RACE_DEBRIS.length === 30, `expected 30 debris, got ${RACE_DEBRIS.length}`);
    assert(RACE_ACORNS.length === 42, `expected 42 normal acorns, got ${RACE_ACORNS.length}`);
    const revision2Xs = (encoded) => encoded.trim().split(/\s+/).map(Number);
    const assertScaledXs = (objects, encoded, label) => same(
      objects.map((object) => object.x),
      revision2Xs(encoded).map((x) => x * RACE_COURSE_SCALE),
      `${label} were not the exact 0.75 transform`,
    );
    assertScaledXs(RACE_RINGS, `
      600 1020 1440 1880 2320 2780 3240 3680 4120 4580 5220 5840 6460 7080
      7520 7960 8400 9040 9400 10000 10440 11040 11460 12080 12520 13140 13600 14300
      15000 15440 15880 16340 16780 17420 17860 18520 18960 19640 20100 20740 21180 21860
      22540 22980 23600 24040 24400 25000 25440 26040 26460 27080 27520 28140 28600 29300
      30000 30440 30880 31340 31780 32420 32860 33520 33960 34640 35100 35740 36180 36840
      37540 38160 38840 39232 39616 40000 40440 41040 41460 42080 42520 43140 43600 44300
    `, "ring X coordinates");
    assertScaledXs(RACE_DEBRIS, `
      2500 4700 6120 7320 8240 8720 8840 9520 11800 14120 16200 17600 18800 20400 22000
      22800 23900 25700 27400 29200 30500 32200 34000 35400 37000 37850 38600 40700 42900 44700
    `, "debris X coordinates");
    assertScaledXs(RACE_ACORNS, `
      800 1660 2540 3420 4300 5380 6200 7240 7700 8500 9200 9800 15200 16100
      17000 17800 18600 19400 20300 21200 22100 22848 23232 23616 24200 24800 30200 30900
      31600 32300 33000 33700 34400 35100 36000 37000 37680 38280 38720 39120 39504 39888
    `, "course-acorn X coordinates");
    const ringYs = revision2Xs(`
      320 280 360 240 400 200 440 220 420 260 380 240 430 300
      440 200 380 144 496 320 220 430 180 460 250 440 200 360
      320 270 390 200 450 240 420 180 460 260 400 220 440 300
      420 200 380 160 440 300 220 430 180 460 250 440 200 360
      320 240 420 180 460 220 440 200 480 260 420 180 460 300
      420 260 496 496 144 496 220 430 180 460 250 440 200 360
    `);
    const ringSkills = new Map([
      [17, "launch-boost-ladder"], [18, "snap-drop-in"], [19, "snap-drop-out"],
      [73, "redline-low-in"], [74, "redline-high"], [75, "redline-low-out"],
    ]);
    same(RACE_RINGS.map((ring) => [ring.id, ring.y, ring.tilt, ring.skill ?? null]),
      ringYs.map((y, i) => [`r${String(i + 1).padStart(2, "0")}`, y, 0, ringSkills.get(i) ?? null]),
      "ring Y/tilt/id/skill tuple changed during the horizontal transform");

    const debrisYs = revision2Xs(`
      520 120 500 130 120 250 520 160 500 130 510 130 500 140 520
      500 110 520 120 500 520 120 510 130 500 520 110 120 510 100
    `);
    const debrisRadii = revision2Xs(`
      24 22 25 23 24 25 24 22 25 23 24 22 25 23 24
      24 22 25 23 24 24 22 25 23 24 24 22 25 23 24
    `);
    const debrisSkill = (i) => i === 5 || i === 6
      ? "snap-drop-pinch"
      : i === 26
        ? "exam-brake-proof"
        : null;
    same(RACE_DEBRIS.map((debris) => [debris.id, debris.y, debris.r, debris.art, debris.skill ?? null]),
      debrisYs.map((y, i) => [
        `d${String(i + 1).padStart(2, "0")}`, y, debrisRadii[i], i % 3, debrisSkill(i),
      ]),
      "debris Y/radius/art/id/skill tuple changed during the horizontal transform");

    const acornYs = revision2Xs(`
      320 300 380 220 400 300 420 320 400 220 460 320 320 250
      410 220 440 260 420 240 360 160 480 160 360 280 320 250
      410 190 450 220 430 240 400 300 360 450 496 496 144 496
    `);
    const acornSkill = (i) => i >= 21 && i <= 23
      ? "high-low-high"
      : i >= 38
        ? "redline-reward"
        : null;
    same(RACE_ACORNS.map((acorn) => [acorn.id, acorn.y, acorn.skill ?? null]),
      acornYs.map((y, i) => [`a${String(i + 1).padStart(2, "0")}`, y, acornSkill(i)]),
      "course-acorn Y/id/skill tuple changed during the horizontal transform");
    const actWidth = 7_500 * RACE_COURSE_SCALE;
    const actCounts = (objects) => Array.from({ length: 6 }, (_, act) =>
      objects.filter((object) => object.x >= act * actWidth && object.x < (act + 1) * actWidth).length);
    same(actCounts(RACE_RINGS), [14, 14, 14, 14, 14, 14], "ring act counts changed");
    same(actCounts(RACE_DEBRIS), [4, 6, 5, 5, 5, 5], "debris act counts changed");
    same(actCounts(RACE_ACORNS), [8, 4, 9, 5, 10, 6], "normal-acorn act counts changed");
    same(RACE_RINGS.map((ring) => ring.id), Array.from({ length: 84 }, (_, i) => `r${String(i + 1).padStart(2, "0")}`),
      "ring ids/order changed");
    same([RACE_RINGS[19].x, RACE_RINGS[47].x, RACE_RINGS[75].x], [7_500, 18_750, 30_000],
      "entry anchors changed");
    same(RACE_RINGS.slice(73, 76).map((r) => [r.x, r.y, r.skill]), [
      [29_424, 496, "redline-low-in"],
      [29_712, 144, "redline-high"],
      [30_000, 496, "redline-low-out"],
    ], "redline exam changed");
    same(RACE_ACORNS.slice(38).map((a) => [a.x, a.y, a.skill]), [
      [29_040, 496, "redline-reward"], [29_340, 496, "redline-reward"],
      [29_628, 144, "redline-reward"], [29_916, 496, "redline-reward"],
    ], "redline reward transform changed");
    same(RACE_RINGS.slice(17, 20).map((r) => [r.x, r.y, r.skill]), [
      [6_780, 144, "launch-boost-ladder"], [7_050, 496, "snap-drop-in"],
      [7_500, 320, "snap-drop-out"],
    ], "early boost/drop exam transform changed");
    same(RACE_ACORNS.slice(21, 24).map((a) => [a.x, a.y, a.skill]), [
      [17_136, 160, "high-low-high"], [17_424, 480, "high-low-high"],
      [17_712, 160, "high-low-high"],
    ], "high-low-high transform changed");
    for (let i = 1; i < RACE_RINGS.length; i++) {
      const gap = RACE_RINGS[i].x - RACE_RINGS[i - 1].x;
      assert((gap >= 270 && gap <= 360) || (gap >= 420 && gap <= 525),
        `ring gap r${i}->r${i + 1} is ${gap}`);
    }
    const interactive = [0, ...RACE_RINGS.map((x) => x.x), ...RACE_DEBRIS.map((x) => x.x),
      ...RACE_ACORNS.map((x) => x.x), RACE_LENGTH].sort((a, b) => a - b);
    for (let i = 1; i < interactive.length; i++) {
      assert(interactive[i] - interactive[i - 1] <= RACE_MAX_INTERACTIVE_GAP,
        `interactive gap ${interactive[i - 1]}..${interactive[i]} exceeds ${RACE_MAX_INTERACTIVE_GAP}`);
    }
    const intendedEntries = [[7_500, 10_875], [18_750, 22_125], [30_000, 33_375]];
    const intendedReturnGaps = [];
    for (const [entry, exit] of intendedEntries) {
      assert(RACE_ACORNS.every((a) => !(a.x > entry && a.x <= exit)), `normal acorn hidden in ${entry}..${exit}`);
      const firstLive = interactive.find((x) => x > exit);
      intendedReturnGaps.push(firstLive - exit);
      assert(firstLive - exit <= RACE_MAX_INTERACTIVE_GAP,
        `return at ${exit} has ${firstLive - exit}-unit dead gap`);
    }
    same(intendedReturnGaps, [375, 375, 150], "intended return density transform changed");
    // Every authored ring that can legally fill charge is also a possible
    // delayed-recovery entry. Its post-skip return must retain the density
    // contract; objects hidden inside that 3,375-unit span do not count.
    let worstDelayedReturn = 0;
    for (const ring of RACE_RINGS.filter((candidate) => candidate.x <= RACE_LATEST_ENTRY_X)) {
      const exit = ring.x + RACE_TUNNEL_DISTANCE;
      const firstLive = interactive.find((x) => x > exit);
      worstDelayedReturn = Math.max(worstDelayedReturn, firstLive - exit);
      assert(firstLive - exit <= RACE_MAX_INTERACTIVE_GAP,
        `delayed return from ${ring.id} at ${exit} has ${firstLive - exit}-unit dead gap`);
    }
    assert(RACE_LATEST_ENTRY_X === RACE_LENGTH - RACE_TUNNEL_DISTANCE && worstDelayedReturn === 435,
      `latest-entry/delayed-return transform changed: latest=${RACE_LATEST_ENTRY_X} worst=${worstDelayedReturn}`);
    const largestInteractiveGap = Math.max(...interactive.slice(1).map((x, i) => x - interactive[i]));
    assert(largestInteractiveGap === 525,
      `transformed authored union max gap ${largestInteractiveGap}, expected 525`);
    return { largestInteractiveGap, worstDelayedReturn, intendedReturnGaps };
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
  assert(realizedAverage.dragTargets >= authoredAverage.race.wormholes * RACE_TUNNEL_RING_TICKS.length
    && realizedOptimized.dragTargets >= authoredOptimized.race.wormholes * RACE_TUNNEL_RING_TICKS.length
    && realizedAverage.dragMoves > 0 && realizedOptimized.dragMoves > 0,
  "benchmark raw gesture traces did not cover every entered tunnel's relative drag targets");

  // Acceptance 1: same semantic log, recognizer boundaries, and merge rules.
  const replayRunA = runReplay(authoredOptimized.transitions);
  const replayRunB = runReplay(authoredOptimized.transitions);
  same(raceSignature(replayRunA.race), raceSignature(replayRunB.race), "same seed/input replay diverged");
  same(replayRunA.cues, replayRunB.cues, "same seed/input cue log diverged");
  same(replayRunA.effectPlans, planRaceCueEffects(replayRunA.cues),
    "fixed-step one-shot drains did not plan every producer cue exactly once");
  same(replayRunA.effectPlans, replayRunB.effectPlans, "same seed/input executable effect plan diverged");
  const allCueKindsAtOneTick = [
    { kind: "ring-pass", tick: 7, id: "r01", index: 0, y: 320, chargeDelta: 5 },
    { kind: "ring-miss", tick: 7, id: "r02", index: 1, y: 280, chargeDelta: 0 },
    { kind: "debris-hit", tick: 7, id: "d01", index: 0, y: 520, chargeDelta: -10 },
    { kind: "acorn", tick: 7, id: "a01", index: 0, y: 320, chargeDelta: 0 },
    { kind: "tunnel-ring-pass", tick: 7, id: "w1-g01", index: 0, y: 320, chargeDelta: 0 },
    { kind: "tunnel-ring-perfect", tick: 7, id: "w1-g02", index: 1, y: 320, chargeDelta: 0 },
    { kind: "tunnel-ring-miss", tick: 7, id: "w1-g03", index: 2, y: 320, chargeDelta: 0 },
    { kind: "entry", tick: 7, id: "r20", index: 19, y: 320, chargeDelta: 0 },
    { kind: "return", tick: 7, id: "w1", index: 0, y: 320, chargeDelta: 0 },
    { kind: "finish", tick: 7, id: "prototype-chapter-1", index: -1, y: 320, chargeDelta: 0 },
  ];
  const allCuePlans = planRaceCueEffects(allCueKindsAtOneTick);
  same(allCuePlans.map((effect) => [effect.cue.kind, effect.sfx, effect.notify]), [
    ["ring-pass", "gold", false],
    ["ring-miss", null, false],
    ["debris-hit", "bounce", false],
    ["acorn", "acorn", false],
    ["tunnel-ring-pass", "gold", false],
    ["tunnel-ring-perfect", "gold", false],
    ["tunnel-ring-miss", null, false],
    ["entry", "shift", true],
    ["return", "shift", true],
    ["finish", null, true],
  ], "pure cue-to-SFX plan changed kind mapping or producer order");
  const effectWorld = makeWorld(360, 640);
  effectWorld.raceCueEffects = [...allCueKindsAtOneTick];
  const firstEffectPlans = planRaceCueEffects(takeRaceCueEffects(effectWorld));
  const repeatedEffectPlans = planRaceCueEffects(takeRaceCueEffects(effectWorld));
  same(firstEffectPlans, allCuePlans, "one-shot effect drain changed the executable cue plan");
  same(repeatedEffectPlans, [], "one fixed-step cue batch planned side effects more than once");
  const plannedSfxCounts = firstEffectPlans.reduce((counts, effect) => {
    if (effect.sfx) counts[effect.sfx] = (counts[effect.sfx] ?? 0) + 1;
    return counts;
  }, {});
  same(plannedSfxCounts, { gold: 3, bounce: 1, acorn: 1, shift: 2 },
    "same-tick pass/debris/acorn/entry/return effects were overwritten or duplicated");
  assert(firstEffectPlans.filter((effect) => effect.notify).length === 3,
    "entry/return/finish notification plans were overwritten or duplicated");
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
  let dragGesture = pressRaceDragGesture(createRaceGestureState(), 41, 70, 300, 240);
  same(dragGesture.input, { held: false, boost: false, dragY: 240 },
    "tunnel press snapped to the pointer instead of anchoring at the pilot");
  assert(dragGesture.state.mode === "pointer-drag" && dragGesture.state.downY === 300
    && dragGesture.state.dragStartY === 240, "tunnel press did not retain its relative-drag anchors");
  dragGesture = moveRaceDragGesture(dragGesture.state, 41, 71, 340, 240);
  same(dragGesture.input, { held: false, boost: false, dragY: 280 },
    "relative tunnel move did not preserve the initial pointer-to-pilot offset");
  dragGesture = releaseRaceGesture(dragGesture.state, 41);
  same(dragGesture.input, { held: false, boost: false, dragY: null },
    "tunnel pointer lift did not release its target immediately");
  same(dragGesture.state, createRaceGestureState(), "tunnel pointer lift did not clear its owner");
  const flightAcrossEntry = pressRaceGesture(createRaceGestureState(), 42, 80, 180);
  const convertedDrag = moveRaceDragGesture(flightAcrossEntry.state, 42, 90, 260, 330);
  same(convertedDrag.input, { held: false, boost: false, dragY: 330 },
    "flight contact held across entry did not convert without snapping");
  assert(convertedDrag.state.mode === "pointer-drag" && convertedDrag.state.downY === 260
    && convertedDrag.state.dragStartY === 330, "entry-held contact did not establish fresh tunnel anchors");
  const keyboardDrag = pressRaceKeyboardDragGesture(createRaceGestureState(), "keyboard-rise", 100, 0);
  same(keyboardDrag.input, { held: false, boost: false, dragY: 0 },
    "tunnel keyboard rise did not use the drag target follower");
  same(releaseRaceGesture(keyboardDrag.state, "keyboard-rise").input,
    { held: false, boost: false, dragY: null }, "tunnel keyboard release did not clear its target");
  const cancelledDrag = cancelRaceGesture(
    pressRaceDragGesture(createRaceGestureState(), 43, 101, 400, 300).state,
    43,
  );
  same(cancelledDrag.input, { held: false, boost: false, dragY: null },
    "tunnel pointer cancel did not release its target");
  assert(cancelRaceGesture(cancelledDrag.state, 43).input === null,
    "cleared tunnel pointer emitted a duplicate cancel transition");
  const canonicalDrag = createRaceState();
  queueRaceInput(canonicalDrag, { held: false, boost: false, dragY: -10.2 }, 2);
  queueRaceInput(canonicalDrag, { held: false, boost: false, dragY: 91.6 }, 3);
  queueRaceInput(canonicalDrag, { held: false, boost: false, dragY: 900 }, 4);
  queueRaceInput(canonicalDrag, { held: false, boost: false, dragY: null }, 4);
  same(canonicalDrag.inputs, [
    { tick: 2, held: false, boost: false, dragY: 0 },
    { tick: 3, held: false, boost: false, dragY: 92 },
    { tick: 4, held: false, boost: false, dragY: null },
  ], "drag target canonicalization or same-tick last-writer merge changed");
  const pendingDragDedupe = createRaceState();
  pendingDragDedupe.tunnelDragY = 100;
  queueRaceInput(pendingDragDedupe, { held: false, boost: false, dragY: 200 }, 10);
  queueRaceInput(pendingDragDedupe, { held: true, boost: false }, 11);
  queueRaceInput(pendingDragDedupe, { held: true, boost: false, dragY: 100 }, 12);
  same(pendingDragDedupe.inputs, [
    { tick: 10, held: false, boost: false, dragY: 200 },
    { tick: 11, held: true, boost: false },
    { tick: 12, held: true, boost: false, dragY: 100 },
  ], "held-only pending input hid the effective queued drag target during dedupe");
  for (const freshInput of [
    { held: true, boost: false },
    { held: true, boost: true },
  ]) {
    const consumedBoundaryInput = createRaceState();
    queueRaceInput(consumedBoundaryInput, freshInput, 0);
    stepRace(consumedBoundaryInput);
    assert(consumedBoundaryInput.inputCursor === consumedBoundaryInput.inputs.length,
      "boundary-reset fixture did not consume its initial control");
    // Entry/tunnel handoffs own these resets even when the preceding logged
    // snapshot happened to have the same values as a later fresh press.
    consumedBoundaryInput.held = false;
    consumedBoundaryInput.boost = false;
    queueRaceInput(consumedBoundaryInput, freshInput, consumedBoundaryInput.tick);
    same(consumedBoundaryInput.inputs.slice(-1), [
      { tick: consumedBoundaryInput.tick, ...freshInput },
    ], `consumed ${freshInput.boost ? "boost" : "hold"} history suppressed a fresh post-boundary press`);
  }
  const idleGesture = createRaceGestureState();
  const idleNeutral = neutralizeOwnedRaceGesture(idleGesture);
  assert(idleNeutral.state === idleGesture && idleNeutral.input === null,
    "idle resize neutralization mutated the recognizer");
  for (const owner of [31, "keyboard-rise"]) {
    const owned = pressRaceGesture(createRaceGestureState(), owner, 3, owner === "keyboard-rise" ? null : 120).state;
    const neutral = neutralizeOwnedRaceGesture(owned);
    same(neutral.input, { held: false, boost: false }, `${owner} resize did not emit one neutral transition`);
    same(neutral.state, createRaceGestureState(), `${owner} resize did not clear owner/tap/swipe state`);
    const repeated = neutralizeOwnedRaceGesture(neutral.state);
    assert(repeated.state === neutral.state && repeated.input === null,
      `${owner} resize emitted a duplicate neutral transition`);
    const mergedNeutral = createRaceState();
    queueRaceInput(mergedNeutral, { held: true, boost: false }, 3);
    queueRaceInput(mergedNeutral, neutral.input, 3);
    same(mergedNeutral.inputs, [{ tick: 3, held: false, boost: false }],
      `${owner} same-tick resize neutralization did not merge last-writer-wins`);
  }
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
  const continuousHold = createRaceState(); continuousHold.held = true; continuousHold.vy = 0;
  stepRace(continuousHold);
  const freshHold = createRaceState(); freshHold.vy = 0;
  queueRaceInput(freshHold, { held: true, boost: false }, 0); stepRace(freshHold);
  near(freshHold.vy - continuousHold.vy, RACE_NORMAL_PRESS_VY, 1e-9,
    "fresh plain press did not add its deterministic response edge");
  assert(freshHold.y < continuousHold.y - 3,
    "fresh plain press still lacked a visible first-tick displacement");
  const continuousBoost = createRaceState(); continuousBoost.held = true; continuousBoost.boost = true; continuousBoost.vy = 0;
  stepRace(continuousBoost);
  const freshBoost = createRaceState(); freshBoost.vy = 0;
  queueRaceInput(freshBoost, { held: true, boost: true }, 0); stepRace(freshBoost);
  near(freshBoost.vy - continuousBoost.vy, RACE_NORMAL_BOOST_PRESS_VY, 1e-9,
    "fresh boost did not add its deterministic response edge");
  const alreadyReleased = createRaceState(); alreadyReleased.vy = -330;
  stepRace(alreadyReleased);
  const releasedEdge = createRaceState(); releasedEdge.held = true; releasedEdge.vy = -330;
  queueRaceInput(releasedEdge, { held: false, boost: false }, 0); stepRace(releasedEdge);
  near(releasedEdge.vy,
    RACE_NORMAL_RELEASE_BRAKE_VY + (alreadyReleased.vy - (-330)), 1e-9,
    "release edge did not brake upward carry before continuous fall acceleration");
  const dropWins = createRaceState(); dropWins.held = true; dropWins.boost = true; dropWins.vy = -520;
  queueRaceInput(dropWins, { held: false, boost: false, drop: true }, 0); stepRace(dropWins);
  same([dropWins.vy, dropWins.dropTicks], [390, [0]],
    "same-tick release/drop did not preserve the full dive as last writer");
  const onePress = createRaceState();
  loadRaceInputs(onePress, [{ tick: 0, held: true, boost: false }]);
  stepRace(onePress); stepRace(onePress);
  const repeatedPress = createRaceState();
  loadRaceInputs(repeatedPress, [
    { tick: 0, held: true, boost: false },
    { tick: 1, held: true, boost: false },
  ]);
  stepRace(repeatedPress); stepRace(repeatedPress);
  near(repeatedPress.vy, onePress.vy, 1e-9,
    "repeated held snapshots stacked the fresh-press response edge");
  const mergedEdge = createRaceState();
  queueRaceInput(mergedEdge, { held: true, boost: false }, 0);
  queueRaceInput(mergedEdge, { held: true, boost: true, drop: true }, 0);
  stepRace(mergedEdge);
  same([mergedEdge.vy, mergedEdge.boostTicks, mergedEdge.dropTicks], [345, [0], [0]],
    "same-tick boost/drop merge changed edge order or drop precedence");
  let rejected = false;
  try { loadRaceInputs(createRaceState(), [{ tick: 0, held: false, boost: true }]); } catch { rejected = true; }
  assert(rejected, "boost=true with held=false was not rejected");
  const route = createRaceState();
  same([0, 5, 15, 20, 95, 100].map((charge) => {
    route.charge = charge;
    return raceRouteTarget(route).ringsNeeded;
  }), [20, 19, 17, 16, 1, 1], "charge-to-clean-gates formula changed");
  same([0, 5, 15, 20, 95, 100].map((charge) => {
    route.charge = charge;
    return hyperRunChargeCopy(route);
  }), [
    "CHARGE 0/100", "CHARGE 5/100", "CHARGE 15/100", "CHARGE 20/100",
    "NEXT CLEAN GATE: WORMHOLE", "WORMHOLE READY",
  ], "charge HUD no longer exposes every five-point gain and clean-entry state");
  route.phase = "entry";
  assert(hyperRunChargeCopy(route) === "WORMHOLE", "entry tick 0 did not replace misleading ready copy");
  route.phase = "normal";
  route.charge = 0;
  same(raceRouteTarget(route), {
    nextRingIndex: 0, ringsNeeded: 20, remainingEligible: 77, entryRingIndex: 19,
    entryEligible: true, entryReady: false, nextCleanGateEnters: false, finalRoute: false,
  }, "initial next-ring/entry eligibility changed");
  route.charge = 95;
  same(raceRouteTarget(route), {
    nextRingIndex: 0, ringsNeeded: 1, remainingEligible: 77, entryRingIndex: 0,
    entryEligible: true, entryReady: false, nextCleanGateEnters: true, finalRoute: false,
  }, "95-charge next-clean-gate eligibility changed");
  route.charge = 100;
  same(raceRouteTarget(route), {
    nextRingIndex: 0, ringsNeeded: 1, remainingEligible: 77, entryRingIndex: 0,
    entryEligible: true, entryReady: true, nextCleanGateEnters: true, finalRoute: false,
  }, "full-meter ready eligibility changed");
  const lateRoute = createRaceState();
  lateRoute.charge = 100;
  for (let i = 0; i <= 76; i++) lateRoute.ringLedger[i] = "passed";
  same(raceRouteTarget(lateRoute), {
    nextRingIndex: 77, ringsNeeded: 1, remainingEligible: 0, entryRingIndex: 77,
    entryEligible: false, entryReady: false, nextCleanGateEnters: false, finalRoute: true,
  }, "late-ineligible route still promised an entry");
  assert(hyperRunChargeCopy(lateRoute) === "FINAL SPRINT", "late-ineligible full meter did not show final route");
  const maxCycleRoute = createRaceState();
  maxCycleRoute.charge = 100;
  maxCycleRoute.wormholes = RACE_MAX_WORMHOLES;
  const maxCycleTarget = raceRouteTarget(maxCycleRoute);
  assert(maxCycleTarget.nextRingIndex === 0 && maxCycleTarget.remainingEligible === 77
    && !maxCycleTarget.entryEligible && !maxCycleTarget.entryReady && maxCycleTarget.finalRoute,
  "max-cycle route still promised an entry");
  assert(hyperRunChargeCopy(maxCycleRoute) === "FINAL SPRINT", "max-cycle full meter did not show final route");
  const insufficientRoute = createRaceState();
  insufficientRoute.ringLedger.fill("passed");
  insufficientRoute.ringLedger[76] = "pending";
  const insufficientTarget = raceRouteTarget(insufficientRoute);
  assert(insufficientTarget.ringsNeeded === 20 && insufficientTarget.remainingEligible === 1
    && insufficientTarget.entryRingIndex === null && insufficientTarget.finalRoute,
  "insufficient remaining rings still promised an entry");
  assert(hyperRunChargeCopy(insufficientRoute) === "FINAL SPRINT",
    "insufficient remaining rings did not show final route");
  same([raceDecisionAge(11, 10), raceDecisionAge(12, 10)], [0, 1],
    "pre-increment decision age convention changed");

  // Acceptance 2: presentation mapping is render-only and READY freezes time.
  const requiredViewSizes = [[360, 640], [390, 844], [844, 390], [1_440, 900], [1_600, 600]];
  const viewportReplays = requiredViewSizes.map(([width, height]) => ({
    label: `${width}x${height}`,
    race: runWorldReplay(authoredOptimized.transitions, width, height),
  }));
  const canonical = viewportReplays[0].race;
  for (const replay of viewportReplays.slice(1)) {
    same(raceSignature(canonical), raceSignature(replay.race),
      `${replay.label} viewport changed authority`);
  }
  const canonicalViewport = raceViewport(360, 640);
  same(canonicalViewport, {
    scale: 1,
    left: 0,
    right: 360,
    top: 0,
    bottom: 640,
    contentWidth: 360,
    contentHeight: 640,
    virtualWidth: 360,
    pilotLocalX: 96,
    pilotX: 96,
    originLeft: 0,
  },
    "canonical race viewport changed");
  const tallViewport = raceViewport(390, 844);
  near(tallViewport.scale, 13 / 12, 1e-12, "tall-phone race scale changed");
  near(tallViewport.left, 0, 1e-12, "tall-phone race viewport was not horizontally centered");
  near(tallViewport.top, (844 - 640 * 13 / 12) / 2, 1e-12,
    "tall-phone race viewport was not vertically centered");
  near(tallViewport.contentWidth, 390, 1e-12, "tall-phone race content width changed");
  near(tallViewport.contentHeight, 640 * 13 / 12, 1e-12, "tall-phone race content height changed");
  near(tallViewport.pilotLocalX, 96, 1e-12, "tall-phone canonical pilot landmark changed");
  near(tallViewport.pilotX, 104, 1e-12, "tall-phone pilot plane changed");

  const landscapeViewport = raceViewport(844, 390);
  near(landscapeViewport.scale, 39 / 64, 1e-12, "844x390 race scale changed");
  near(landscapeViewport.virtualWidth, 844 / (39 / 64), 1e-9,
    "844x390 virtual course width changed");
  near(landscapeViewport.left, 0, 1e-12, "844x390 introduced an active-camera side band");
  near(landscapeViewport.right, 844, 1e-12, "844x390 active right edge changed");
  near(landscapeViewport.pilotLocalX, landscapeViewport.virtualWidth * 0.2, 1e-9,
    "844x390 pilot did not use the 20-percent panoramic landmark");
  near(landscapeViewport.pilotX, 844 * 0.2, 1e-9, "844x390 pilot plane changed");

  const desktopViewport = raceViewport(1_440, 900);
  same([
    desktopViewport.scale,
    desktopViewport.virtualWidth,
    desktopViewport.left,
    desktopViewport.right,
    desktopViewport.top,
    desktopViewport.bottom,
    desktopViewport.pilotLocalX,
    desktopViewport.pilotX,
    desktopViewport.originLeft,
  ], [45 / 32, 1_024, 0, 1_440, 0, 900, 204.8, 288, 153],
  "1440x900 panoramic camera changed");

  const cappedViewport = raceViewport(1_600, 600);
  same([
    RACE_MAX_VIRTUAL_WIDTH,
    cappedViewport.scale,
    cappedViewport.virtualWidth,
    cappedViewport.contentWidth,
    cappedViewport.left,
    cappedViewport.right,
    cappedViewport.top,
    cappedViewport.bottom,
    cappedViewport.pilotLocalX,
    cappedViewport.pilotX,
    cappedViewport.originLeft,
  ], [1_440, 15 / 16, 1_440, 1_350, 125, 1_475, 0, 600, 288, 395, 305],
  "1600x600 active-camera cap or side-band inputs changed");

  const requiredViewports = requiredViewSizes.map(([width, height]) => ({
    width,
    height,
    viewport: raceViewport(width, height),
  }));
  for (const { width, height, viewport } of requiredViewports) {
    assert(viewport.left >= 0 && viewport.right <= width && viewport.top >= 0 && viewport.bottom <= height,
      `${width}x${height} active camera escaped its view bounds`);
    near(raceViewportX(viewport, RACE_PILOT_X), viewport.pilotX, 1e-9,
      `${width}x${height} visible gate plane diverged from the pilot plane`);
    near(
      raceViewportX(viewport, RACE_PILOT_X + RACE_GATE_APERTURE) - viewport.pilotX,
      raceViewportY(viewport, 320 + RACE_GATE_APERTURE) - raceViewportY(viewport, 320),
      1e-9,
      `${width}x${height} projection stretched a circular gate`,
    );
    const canonicalLeft = RACE_PILOT_X - viewport.pilotLocalX;
    near(raceViewportX(viewport, canonicalLeft), viewport.left, 1e-9,
      `${width}x${height} active clip left input is not canonical`);
    near(raceViewportX(viewport, canonicalLeft + viewport.virtualWidth), viewport.right, 1e-9,
      `${width}x${height} active clip right input is not canonical`);
    const shipLayout = hyperRunShipLayout(viewport.pilotX, viewport.scale, {
      width: 256,
      height: 256,
      box: { x: 10, y: 52, w: 236, h: 154 },
    });
    near(shipLayout.noseX, viewport.pilotX, 1e-9,
      `${width}x${height} scout ship nose diverged from the gate authority plane`);
    assert(shipLayout.centerX < viewport.pilotX && shipLayout.engineX < shipLayout.centerX,
      `${width}x${height} scout ship body no longer trails its judged nose`);
    assert(shipLayout.cockpitX > shipLayout.engineX && shipLayout.cockpitX < shipLayout.noseX,
      `${width}x${height} live-pilot cockpit escaped the ship silhouette`);
  }
  const portraitLookahead = (canonicalViewport.right - canonicalViewport.pilotX) / canonicalViewport.scale;
  same(portraitLookahead, 264, "portrait future-course lookahead changed");
  for (const viewport of [landscapeViewport, desktopViewport, cappedViewport]) {
    const lookahead = (viewport.right - viewport.pilotX) / viewport.scale;
    assert(lookahead > portraitLookahead,
      `landscape camera did not reveal more future course: ${lookahead} <= ${portraitLookahead}`);
  }
  same([
    canonicalRaceY(tallViewport.top, tallViewport.top, tallViewport.contentHeight),
    canonicalRaceY(raceViewportY(tallViewport, 320), tallViewport.top, tallViewport.contentHeight),
    canonicalRaceY(tallViewport.top + tallViewport.contentHeight, tallViewport.top, tallViewport.contentHeight),
  ], [0, 320, 640], "three-argument canonical race Y mapping changed");
  const mappedDropTick = [];
  for (const { width, height, viewport } of requiredViewports) {
    let state = pressRaceGesture(createRaceGestureState(), 2, 40,
      canonicalRaceY(raceViewportY(viewport, 100), viewport.top, viewport.contentHeight)).state;
    const mapped = moveRaceGesture(state, 2, 52,
      canonicalRaceY(raceViewportY(viewport, 100 + DROP_DISTANCE), viewport.top, viewport.contentHeight));
    assert(mapped.input?.drop, `${width}x${height} viewport did not emit the same 34-canonical-unit drop`);
    mappedDropTick.push(52);
  }
  same(mappedDropTick, requiredViewports.map(() => 52), "viewport mapping changed semantic drop tick");
  const mappedDragTargets = requiredViewports.map(({ viewport }, index) => {
    const owner = 70 + index;
    const pointerStart = canonicalRaceY(raceViewportY(viewport, 200), viewport.top, viewport.contentHeight);
    const pointerEnd = canonicalRaceY(raceViewportY(viewport, 260), viewport.top, viewport.contentHeight);
    const down = pressRaceDragGesture(createRaceGestureState(), owner, 60, pointerStart, 310);
    return moveRaceDragGesture(down.state, owner, 61, pointerEnd, 310).input?.dragY;
  });
  same(mappedDragTargets, requiredViewports.map(() => 370),
    "viewport mapping changed the canonical relative tunnel drag distance");
  same(RACE_READY_COPY, [
    "THREAD GATES · CHARGE SHORTCUTS · FINISH FAST",
    "FLIGHT: HOLD / RELEASE",
    "DOUBLE-TAP + HOLD: BOOST · SWIPE DOWN: DIVE",
    "WORMHOLE: DRAG TO ALIGN · CENTER = FASTER EXIT",
    "PRESS + HOLD TO LAUNCH",
  ],
    "race ready copy changed");
  same(hyperRunReadyLines(360), [
    "THREAD GATES · CHARGE SHORTCUTS", "FINISH FAST", "FLIGHT · HOLD / RELEASE",
    "DOUBLE-TAP + HOLD · BOOST", "SWIPE DOWN · DIVE", "WORMHOLE · DRAG TO ALIGN",
    "CENTER = FASTER EXIT", "PRESS + HOLD TO LAUNCH",
  ], "compact READY panel omitted or merged a taught control");
  same(hyperRunReadyLines(844), RACE_READY_COPY,
    "landscape READY panel did not use the full reminder copy");
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

  const resizePhaseSpecs = [
    { label: "READY", phase: "normal", phaseTick: 0, ready: true, y: 320, vy: 0 },
    { label: "normal", phase: "normal", phaseTick: 37, ready: false, y: 144, vy: -123 },
    { label: "entry", phase: "entry", phaseTick: 17, ready: false, y: 300, vy: 0 },
    { label: "tunnel", phase: "tunnel", phaseTick: 120, ready: false, y: 496, vy: -220 },
    { label: "return", phase: "return", phaseTick: 9, ready: false, y: 200, vy: 0 },
    { label: "finish", phase: "finish", phaseTick: 0, ready: false, y: 320, vy: 0 },
  ];
  function makeResizePhaseWorld(spec) {
    const phaseWorld = makeWorld(360, 640);
    resetRun(phaseWorld, defaultSave(), "fly", false, PROTOTYPE_RACE_MISSION);
    const race = phaseWorld.race;
    phaseWorld.ready = spec.ready;
    phaseWorld.screen = spec.phase === "finish" ? "lvldone" : "play";
    race.phase = spec.phase;
    race.phaseTick = spec.phaseTick;
    race.tick = 180;
    race.coursePosition = spec.phase === "finish" ? RACE_LENGTH : 1_234.5;
    race.previousCoursePosition = race.coursePosition - 3;
    race.phaseStartPosition = 1_000;
    race.y = spec.y;
    race.previousY = spec.y;
    race.vy = spec.vy;
    race.ringLedger[0] = "passed";
    race.ringDecisionTicks[0] = race.tick - 1;
    loadRaceInputs(race, [{ tick: 12, held: true, boost: false }, { tick: 13, held: false, boost: false }]);
    const cue = {
      kind: "ring-pass", tick: race.tick - 1, id: RACE_RINGS[0].id, index: 0,
      y: RACE_RINGS[0].y, chargeDelta: RACE_RING_CHARGE,
    };
    phaseWorld.raceCues = [cue];
    phaseWorld.raceCueEffects = [cue];
    resizeWorld(phaseWorld, 360, 640);
    return phaseWorld;
  }
  for (const spec of resizePhaseSpecs) {
    const phaseWorld = makeResizePhaseWorld(spec);
    const authorityBefore = JSON.stringify(phaseWorld.race);
    const cueBefore = JSON.stringify([phaseWorld.raceCues, phaseWorld.raceCueEffects]);
    const shellBefore = [phaseWorld.ready, phaseWorld.screen];
    for (const { width, height, viewport } of requiredViewports) {
      resizeWorld(phaseWorld, width, height);
      assert(JSON.stringify(phaseWorld.race) === authorityBefore,
        `${spec.label} idle resize to ${width}x${height} mutated authority or the semantic log`);
      assert(JSON.stringify([phaseWorld.raceCues, phaseWorld.raceCueEffects]) === cueBefore,
        `${spec.label} idle resize to ${width}x${height} mutated the active cue`);
      same([phaseWorld.ready, phaseWorld.screen], shellBefore,
        `${spec.label} idle resize to ${width}x${height} changed play state`);
      near(phaseWorld.squirrel.y, raceViewportY(viewport, spec.y), 1e-9,
        `${spec.label} idle resize to ${width}x${height} misprojected live Y`);
      near(phaseWorld.squirrel.vy, spec.vy * viewport.scale, 1e-9,
        `${spec.label} idle resize to ${width}x${height} misprojected live velocity`);
      near(raceViewportY(viewport, phaseWorld.raceCues[0].y),
        viewport.top + RACE_RINGS[0].y * viewport.scale, 1e-9,
        `${spec.label} active cue did not reproject from canonical ring Y at ${width}x${height}`);
    }
  }

  // The browser engine owns pointer capture and the render accumulator. This
  // adapter matrix exercises the same pure sequence it calls—neutralize,
  // stamp/merge one semantic state, pause, then reproject—across every phase.
  for (let phaseIndex = 0; phaseIndex < resizePhaseSpecs.length; phaseIndex++) {
    const spec = resizePhaseSpecs[phaseIndex];
    const resizeOwners = spec.phase === "tunnel"
      ? [1_000 + phaseIndex, "keyboard-rise", "keyboard-drop"]
      : [1_000 + phaseIndex, "keyboard-rise"];
    for (const owner of resizeOwners) {
      const phaseWorld = makeResizePhaseWorld(spec);
      phaseWorld.screen = "play";
      const race = phaseWorld.race;
      const tunnelOwned = spec.phase === "tunnel";
      const sameTick = typeof owner === "number";
      const downTick = sameTick ? race.tick : race.tick - 1;
      const down = tunnelOwned
        ? typeof owner === "number"
          ? pressRaceDragGesture(createRaceGestureState(), owner, downTick, 220, spec.y)
          : pressRaceKeyboardDragGesture(createRaceGestureState(), owner, downTick, spec.y)
        : pressRaceGesture(createRaceGestureState(), owner, downTick,
          typeof owner === "number" ? canonicalRaceY(220, 0, 640) : null);
      const downInput = tunnelOwned
        ? { held: false, boost: false, dragY: spec.y }
        : { held: true, boost: false };
      same(down.input, downInput, `${spec.label}/${owner} did not begin with its phase-owned control`);
      if (spec.ready) setRaceInput(phaseWorld, down.input);
      else queueRaceInput(race, down.input, downTick);
      const tickBeforeNeutral = race.tick;
      const neutral = neutralizeOwnedRaceGesture(down.state);
      const neutralInput = tunnelOwned
        ? { held: false, boost: false, dragY: null }
        : { held: false, boost: false };
      same(neutral.input, neutralInput,
        `${spec.label}/${owner} resize did not emit one neutral state`);
      queueRaceInput(race, neutral.input, race.tick);
      assert(race.tick === tickBeforeNeutral && race.inputs.filter((input) => input.tick === race.tick
        && !input.held && !input.boost && !input.drop
        && (!tunnelOwned || input.dragY === null)).length === 1,
      `${spec.label}/${owner} resize hid a tick or failed to stamp exactly one neutral state`);
      if (sameTick || spec.ready) {
        same(race.inputs.filter((input) => input.tick === race.tick), [
          { tick: race.tick, ...neutralInput },
        ], `${spec.label}/${owner} same-tick neutral state did not replace the owned hold`);
      } else {
        same(race.inputs.slice(-2), [
          { tick: race.tick - 1, ...downInput },
          { tick: race.tick, ...neutralInput },
        ], `${spec.label}/${owner} neutral state did not append after the prior hold`);
      }
      const repeated = neutralizeOwnedRaceGesture(neutral.state);
      assert(repeated.state === neutral.state && repeated.input === null,
        `${spec.label}/${owner} duplicate resize emitted a second neutral state`);
      const oldLift = releaseRaceGesture(neutral.state, owner);
      assert(oldLift.input === null, `${spec.label}/${owner} stale lift emitted a semantic transition`);
      const fresh = tunnelOwned
        ? typeof owner === "number"
          ? pressRaceDragGesture(oldLift.state, owner, race.tick + 1, 220, race.y)
          : pressRaceKeyboardDragGesture(oldLift.state, owner, race.tick + 1, race.y)
        : pressRaceGesture(oldLift.state, owner, race.tick + 1,
          typeof owner === "number" ? 220 : null);
      same(fresh.input, tunnelOwned
        ? { held: false, boost: false, dragY: race.y }
        : { held: true, boost: false },
        `${spec.label}/${owner} did not require a fresh plain press after resize`);
      const authorityAfterNeutral = JSON.stringify(race);
      const target = typeof owner === "number" ? landscapeViewport : cappedViewport;
      pausePlay(phaseWorld);
      resizeWorld(phaseWorld,
        typeof owner === "number" ? 844 : 1_600,
        typeof owner === "number" ? 390 : 600);
      assert(phaseWorld.screen === "pause" && JSON.stringify(race) === authorityAfterNeutral,
        `${spec.label}/${owner} pause/reprojection advanced authority`);
      near(phaseWorld.squirrel.y, raceViewportY(target, race.y), 1e-9,
        `${spec.label}/${owner} owned resize misprojected live Y`);
      near(raceViewportY(target, phaseWorld.raceCues[0].y),
        target.top + RACE_RINGS[0].y * target.scale, 1e-9,
        `${spec.label}/${owner} owned resize misprojected the active cue`);
    }
  }

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
  assert(engineSource.includes("dispatchRaceCues(takeRaceCueEffects(world));")
    && engineSource.includes("for (const effect of planRaceCueEffects(cues))")
    && engineSource.includes('effect.sfx === "gold"')
    && engineSource.includes('effect.sfx === "bounce"')
    && engineSource.includes('effect.sfx === "acorn"')
    && engineSource.includes('effect.sfx === "shift"')
    && engineSource.includes("if (effect.notify) shouldNotify = true;")
    && !engineSource.includes("dispatchWorldEvent(updateWorld(world, save, 1 / 60))"),
  "engine no longer drains and executes every pure cue plan without legacy double-dispatch");
  assert(engineSource.includes("applyRaceGesture(neutralizeOwnedRaceGesture(raceGesture));")
    && engineSource.includes("const ownedRaceResize = sizeChanged")
    && engineSource.includes("if (ownedRaceResize) {")
    && engineSource.includes("raceAccumulator = 0;")
    && engineSource.includes("pausePlay(world);"),
  "owned-contact resize no longer neutralizes input and pauses fixed-step authority");
  const keyboardRepeatGuard = engineSource.indexOf("if (raceResizeKeyboardReleasePending) return;");
  const focusPauseRepeatGuard = engineSource.indexOf('else if (world.screen === "pause") {\n        if (!e.repeat) engine.resume();\n      }',
    keyboardRepeatGuard);
  const racePlayAfterFocusGuard = engineSource.indexOf('else if (world.screen === "play") {',
    focusPauseRepeatGuard);
  assert(engineSource.includes('let raceResizeKeyboardReleasePending: "keyboard-rise" | "keyboard-drop" | null = null;')
    && engineSource.includes('if (owner === "keyboard-rise" || owner === "keyboard-drop") {')
    && engineSource.includes("raceResizeKeyboardReleasePending = owner;")
    && keyboardRepeatGuard >= 0 && focusPauseRepeatGuard > keyboardRepeatGuard
    && engineSource.includes('if (raceResizeKeyboardReleasePending === "keyboard-rise") {\n        raceResizeKeyboardReleasePending = null;\n        return;\n      }')
    && engineSource.includes('if (raceResizeKeyboardReleasePending === "keyboard-drop") {\n        raceResizeKeyboardReleasePending = null;\n        return;\n      }')
    && /function resetInputTracking\(\) \{[\s\S]*?raceResizeKeyboardReleasePending = null;/m.test(engineSource),
  "keyboard repeat can resume an orientation-paused race before physical key release");
  assert(focusPauseRepeatGuard >= 0 && racePlayAfterFocusGuard > focusPauseRepeatGuard,
    "held-key OS repeat can resume a focus/visibility/Escape-paused race without a fresh press");

  // Acceptance 3: cadence independence with advanced input present.
  assert(authoredOptimized.transitions.some((input) => input.boost), "optimized fixture has no boost event");
  assert(authoredOptimized.transitions.some((input) => input.drop), "optimized fixture has no drop event");
  assert(authoredOptimized.transitions.some((input) => typeof input.dragY === "number")
    && authoredOptimized.transitions.some((input) => input.dragY === null),
  "optimized fixture has no tick-stamped tunnel drag target/release events");
  const at60 = runReplay(authoredOptimized.transitions, [1 / 60]);
  const at30 = runReplay(authoredOptimized.transitions, [1 / 30]);
  const at120 = runReplay(authoredOptimized.transitions, [1 / 120]);
  const mixed = runReplay(authoredOptimized.transitions, [1 / 60, 1 / 24, 1 / 120, 1 / 15, 1 / 30, 1 / 20]);
  for (const [label, replay] of [["30 fps", at30], ["120 fps", at120], ["mixed", mixed]]) {
    same(raceSignature(at60.race), raceSignature(replay.race), `${label} cadence changed authority`);
    same(at60.cues, replay.cues, `${label} cadence changed structured cue order`);
    same(at60.effectPlans, replay.effectPlans,
      `${label} cadence changed executable SFX/notification plans`);
    same(replay.effectPlans, planRaceCueEffects(replay.cues),
      `${label} fixed-step drains did not execute each producer cue plan exactly once`);
  }

  // Acceptance 4: layout/routes, profile bands, and redline reachability.
  const layoutEvidence = assertAuthoredLayout();
  const passive = runReplay([]);
  const average = runReplay(authoredAverage.transitions);
  const optimized = runReplay(authoredOptimized.transitions);
  assertProfile("passive", passive, [8_990, 9_010], { passedRange: [0, 0], wormholes: 0, debris: [0, 0] });
  assert(passive.race.boostTicks.length === 0 && passive.race.dropTicks.length === 0,
    "passive fixture emitted an advanced input event");
  assertProfile("average", average, [5_940, 6_000], {
    passedRange: [44, 50], wormholes: 2, debris: [0, 2], mean: [316, 322],
  });
  assertProfile("optimized", optimized, [5_400, 5_700], {
    passed: [60], wormholes: 3, debris: [0, 0], mean: [342, 348],
  });
  same([RACE_TWO_STAR_TICKS, RACE_THREE_STAR_TICKS], [6_900, 5_760],
    "Revision 3 changed the approved star thresholds");
  same([raceGrade(passive.race.finishTicks), raceGrade(average.race.finishTicks), raceGrade(optimized.race.finishTicks)],
    [1, 2, 3], "Revision 3 star thresholds do not separate the benchmark fixtures");
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
        race.charge = Math.max(0, race.charge - RACE_DEBRIS_CHARGE_PENALTY);
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

  const redlineGap = RACE_RINGS[74].x - RACE_RINGS[73].x;
  const plainTicks = Math.round(redlineGap / RACE_MAX_SPEED / RACE_DT);
  assert(redlineGap === 288, `redline similarity gap ${redlineGap}, expected 288`);
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
    const beforePlane = stepRace(race);
    same(beforePlane.cues, [], "gate emitted a cue before its authority plane");
    assert(race.ringLedger[0] === "pending" && race.ringDecisionTicks[0] === null, "gate decided before plane");
    const decisionTick = race.tick;
    const decision = stepRace(race);
    assert(race.ringDecisionTicks[0] === decisionTick, "decision did not stamp first crossing pre-increment tick");
    const state = race.ringLedger[0];
    assert(state === expectedState, `plane fixture resolved ${state}, expected ${expectedState}`);
    same(decision.cues, [{
      kind: state === "passed" ? "ring-pass" : "ring-miss",
      tick: decisionTick,
      id: gate.id,
      index: 0,
      y: gate.y,
      chargeDelta: state === "passed" ? RACE_RING_CHARGE : 0,
    }], `${state} decision cue changed`);
    const ageAtDecision = raceDecisionAge(race.tick, decisionTick);
    assert(ageAtDecision === 0 && ageAtDecision / duration === 0, "gate fade did not begin at age/blend zero");
    for (let age = 1; age <= duration; age++) {
      const later = stepRace(race);
      assert(!later.cues.some((cue) => cue.id === gate.id), `gate ${gate.id} emitted a duplicate decision cue`);
      assert(race.ringLedger[0] === state && race.ringDecisionTicks[0] === decisionTick,
        `gate decision changed during fade at age ${age}`);
      const observedAge = raceDecisionAge(race.tick, decisionTick);
      assert(observedAge === age && Math.min(1, observedAge / duration) === age / duration,
        `${state} fade age ${observedAge} did not match ${age}/${duration}`);
    }
    return state;
  }
  assert(planeFixture(gate.y, "passed", RACE_GATE_PASS_FADE_TICKS) === "passed", "centered plane fixture did not pass");
  assert(planeFixture(gate.y + RACE_GATE_CLEARANCE + 40, "missed", RACE_GATE_MISS_FADE_TICKS) === "missed",
    "offset plane fixture did not miss");
  same([RACE_GATE_PASS_FADE_TICKS, RACE_GATE_MISS_FADE_TICKS], [27, 39], "gate fade durations changed");

  function projectedPlaneMatrix(viewport, viewportLabel, offset, expectedState) {
    const race = createRaceState();
    const dx = RACE_MAX_SPEED * RACE_DT;
    race.ringLedger.fill("missed");
    race.ringLedger[0] = "pending";
    race.debrisLedger.fill(true);
    race.acornLedger.fill(true);
    race.coursePosition = gate.x - 2 * dx;
    race.previousCoursePosition = race.coursePosition;
    race.y = gate.y + offset;
    race.previousY = race.y;
    // Released normal flight adds 17.5 px/s each step. This symmetric initial
    // velocity returns to the exact authored test Y on the crossing step.
    race.vy = -26.25;
    race.speed = RACE_MAX_SPEED;
    race.speedGraceTicks = 5;
    const frames = [{
      frame: -2,
      ledger: race.ringLedger[0],
      decisionTick: race.ringDecisionTicks[0],
      age: null,
      cues: [],
      ringScreenX: raceViewportX(viewport, RACE_PILOT_X + gate.x - race.coursePosition),
    }];
    let decisionCue = null;
    for (const frame of [-1, 0, 1, 2]) {
      const result = stepRace(race);
      const emitted = result.cues.filter((cue) => cue.id === gate.id
        && (cue.kind === "ring-pass" || cue.kind === "ring-miss"));
      if (emitted.length) decisionCue = emitted[0];
      frames.push({
        frame,
        ledger: race.ringLedger[0],
        decisionTick: race.ringDecisionTicks[0],
        age: race.ringDecisionTicks[0] == null
          ? null
          : raceDecisionAge(race.tick, race.ringDecisionTicks[0]),
        cues: emitted.map((cue) => [cue.kind, cue.tick, cue.id, cue.y]),
        ringScreenX: raceViewportX(viewport, RACE_PILOT_X + gate.x - race.coursePosition),
      });
    }
    same(frames.map((frame) => [frame.frame, frame.ledger, frame.decisionTick, frame.age]), [
      [-2, "pending", null, null],
      [-1, "pending", null, null],
      [0, expectedState, 1, 0],
      [1, expectedState, 1, 1],
      [2, expectedState, 1, 2],
    ], `${viewportLabel} offset ${offset} did not stamp exactly on the crossing frame`);
    same(frames.map((frame) => frame.cues.length), [0, 0, 1, 0, 0],
      `${viewportLabel} offset ${offset} emitted a pre-plane or duplicate decision cue`);
    same(frames.map((frame) => Number(((frame.ringScreenX - viewport.pilotX) / viewport.scale).toFixed(9))),
      [2 * dx, dx, 0, -dx, -2 * dx],
      `${viewportLabel} -2..+2 world-ring frames were not registered to the pilot plane`);
    assert(decisionCue?.kind === (expectedState === "passed" ? "ring-pass" : "ring-miss")
      && decisionCue.tick === 1 && decisionCue.y === gate.y,
    `${viewportLabel} offset ${offset} cue did not capture decision tick/id/canonical ring Y`);
    near(raceViewportY(viewport, decisionCue.y), viewport.top + gate.y * viewport.scale, 1e-9,
      `${viewportLabel} offset ${offset} cue did not remain screen-anchored from canonical Y`);
    return frames.map((frame) => [frame.frame, frame.ledger, frame.decisionTick, frame.age, frame.cues]);
  }
  const planeEpsilon = 1e-4;
  const planeCases = [
    { label: "center", offset: 0, state: "passed" },
    { label: "+edge", offset: RACE_GATE_CLEARANCE, state: "passed" },
    { label: "-edge", offset: -RACE_GATE_CLEARANCE, state: "passed" },
    { label: "+epsilon-miss", offset: RACE_GATE_CLEARANCE + planeEpsilon, state: "missed" },
    { label: "-epsilon-miss", offset: -(RACE_GATE_CLEARANCE + planeEpsilon), state: "missed" },
  ];
  for (const testCase of planeCases) {
    const portraitFrames = projectedPlaneMatrix(canonicalViewport, `portrait ${testCase.label}`,
      testCase.offset, testCase.state);
    const landscapeFrames = projectedPlaneMatrix(landscapeViewport, `landscape ${testCase.label}`,
      testCase.offset, testCase.state);
    same(landscapeFrames, portraitFrames,
      `${testCase.label} authority/stamp/age matrix changed between portrait and landscape`);
  }

  function createCoexistRace(charge = 20, includeDebris = true) {
    const race = createRaceState();
    race.coursePosition = 8_845;
    race.previousCoursePosition = race.coursePosition;
    race.y = 460;
    race.previousY = 460;
    race.vy = 0;
    race.speed = 13_000;
    race.speedGraceTicks = 1;
    race.charge = charge;
    race.ringLedger.fill("missed");
    race.ringLedger[23] = "pending";
    race.debrisLedger.fill(true);
    if (includeDebris) race.debrisLedger[8] = false;
    race.acornLedger.fill(true);
    return race;
  }
  const coexist = createCoexistRace();
  const coexistStep = stepRace(coexist);
  const coexistCues = [
    { kind: "ring-pass", tick: 0, id: "r24", index: 23, y: 460, chargeDelta: 5 },
    { kind: "debris-hit", tick: 0, id: "d09", index: 8, y: 500, chargeDelta: -10 },
  ];
  same(coexistStep.cues, coexistCues, "same-tick ring/debris cues did not coexist in authority order");
  assert(coexistStep.sound === "debris" && coexist.charge === 15,
    `legacy sound/final charge changed for same-tick cues: ${coexistStep.sound}/${coexist.charge}`);
  const deniedDirtyEntry = createCoexistRace(95);
  const deniedDirtyStep = stepRace(deniedDirtyEntry);
  same(deniedDirtyStep.cues, coexistCues,
    "qualifying ring/debris step did not preserve both deterministic cues");
  assert(deniedDirtyEntry.phase === "normal" && deniedDirtyEntry.charge === 90
    && deniedDirtyEntry.entryTicks.length === 0 && deniedDirtyStep.sound === "debris"
    && !deniedDirtyStep.cues.some((cue) => cue.kind === "entry"),
  "95 +5 -10 dirty gate entered instead of resolving the net 90 charge");
  const acceptedCleanEntry = createCoexistRace(95, false);
  const acceptedCleanStep = stepRace(acceptedCleanEntry);
  same(acceptedCleanStep.cues, [
    coexistCues[0],
    { kind: "entry", tick: 0, id: "r24", index: 23, y: 460, chargeDelta: 0 },
  ], "clean 95-point qualifying gate did not emit pass then entry");
  assert(acceptedCleanEntry.phase === "entry" && acceptedCleanEntry.charge === 100
    && acceptedCleanEntry.entryTicks.length === 1 && acceptedCleanStep.sound === "entry",
  "clean 95 +5 gate did not enter immediately at authority tick 0");
  const cueWorld = makeWorld(360, 640);
  const cueSave = defaultSave();
  resetRun(cueWorld, cueSave, "fly", false, PROTOTYPE_RACE_MISSION);
  cueWorld.race = createCoexistRace();
  cueWorld.ready = false;
  updateWorld(cueWorld, cueSave, RACE_DT);
  same(takeRaceCueEffects(cueWorld), coexistCues, "sim cue bridge changed producer order");
  same(takeRaceCueEffects(cueWorld), [], "sim cue bridge did not drain exactly once");
  same(cueWorld.raceCues, coexistCues, "bounded presentation history collapsed simultaneous cues");
  pausePlay(cueWorld);
  updateWorld(cueWorld, cueSave, RACE_DT);
  same(takeRaceCueEffects(cueWorld), [], "pause replayed a consumed race cue");
  resetRun(cueWorld, cueSave, "fly", false, PROTOTYPE_RACE_MISSION);
  same([cueWorld.raceCues, cueWorld.raceCueEffects], [[], []], "race reset retained cue history/effects");
  updateWorld(cueWorld, cueSave, RACE_DT);
  same(takeRaceCueEffects(cueWorld), [], "READY replayed a stale race cue");
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

  // Acceptance 6: relative tunnel drag, alignment rings, and exact handoff/settle.
  function makeTunnelRace(wormholes = 0, entryAnchorY = 320) {
    const race = createRaceState();
    race.phase = "tunnel";
    race.phaseTick = 0;
    race.phaseStartPosition = 1_000;
    race.coursePosition = 1_000;
    race.previousCoursePosition = 1_000;
    race.entryAnchorY = entryAnchorY;
    race.y = entryAnchorY;
    race.previousY = entryAnchorY;
    race.vy = 0;
    race.wormholes = wormholes;
    race.tunnelRingLedger[wormholes] = RACE_TUNNEL_RING_TICKS.map(() => "pending");
    race.tunnelRingDecisionTicks[wormholes] = RACE_TUNNEL_RING_TICKS.map(() => null);
    return race;
  }

  same([
    RACE_TUNNEL_DRAG_TRAVERSAL_TICKS,
    RACE_TUNNEL_DRAG_STEP,
    RACE_TUNNEL_RING_APERTURE,
    RACE_TUNNEL_PERFECT_APERTURE,
    RACE_TUNNEL_RING_CLEARANCE,
    RACE_TUNNEL_PERFECT_CLEARANCE,
    RACE_TUNNEL_QUALITY_SPEED_GAIN,
  ], [48, RACE_HEIGHT / 48, 58, 30, 42, 14, 3.75],
  "drag traversal, nested apertures, or exit-speed derivation changed");
  let fullFieldFollower = 0;
  const followerSamples = [];
  for (let step = 1; step <= RACE_TUNNEL_DRAG_TRAVERSAL_TICKS; step++) {
    fullFieldFollower = raceTunnelFollowerY(fullFieldFollower, RACE_HEIGHT);
    if ([1, 22, 48].includes(step)) followerSamples.push([step, fullFieldFollower]);
  }
  near(followerSamples[0][1], RACE_HEIGHT / 48, 1e-9,
    "48-tick follower changed its first response step");
  near(followerSamples[1][1], RACE_HEIGHT * 22 / 48, 1e-9,
    "48-tick follower changed its mid-chase position");
  near(followerSamples[2][1], RACE_HEIGHT, 1e-9,
    "48-tick follower no longer traverses one canonical field exactly");
  same(raceTunnelFollowerY(240, null), 240,
    "released follower did not preserve its current position");
  for (const [width, height] of [[360, 640], [390, 844], [844, 390], [1_440, 900], [1_600, 600]]) {
    const viewport = raceViewport(width, height);
    for (const ringTick of RACE_TUNNEL_RING_TICKS) {
      near(hyperRunTunnelRingScreenX(viewport, ringTick, ringTick + 1), viewport.pilotX, 1e-9,
        `${width}x${height} resolved tunnel ring did not meet the pilot plane on its authority crossing`);
      assert(hyperRunTunnelRingScreenX(viewport, ringTick, ringTick) > viewport.pilotX,
        `${width}x${height} pending tunnel ring reached the pilot plane before authority judged it`);
    }
  }
  const inactiveTunnel = makeTunnelRace();
  inactiveTunnel.vy = -500;
  loadRaceInputs(inactiveTunnel, [{ tick: 0, held: true, boost: true, drop: true }]);
  stepRace(inactiveTunnel);
  same([inactiveTunnel.y, inactiveTunnel.vy, inactiveTunnel.boostTicks, inactiveTunnel.dropTicks],
    [320, 0, [], []], "legacy hold/boost/drop changed tunnel position or telemetry");
  const risingDrag = makeTunnelRace();
  loadRaceInputs(risingDrag, [{ tick: 0, held: false, boost: false, dragY: 500 }]);
  stepRace(risingDrag);
  near(risingDrag.y, 320 + RACE_TUNNEL_DRAG_STEP, 1e-9,
    "active tunnel drag exceeded or undershot its fixed-step traversal cap");
  near(risingDrag.vy, RACE_TUNNEL_DRAG_STEP / RACE_DT, 1e-9,
    "drag-derived presentation velocity changed");
  const preciseDrag = makeTunnelRace();
  loadRaceInputs(preciseDrag, [{ tick: 0, held: false, boost: false, dragY: 330 }]);
  stepRace(preciseDrag);
  same([preciseDrag.y, preciseDrag.vy], [330, 600],
    "nearby tunnel drag target did not settle exactly in one fixed step");
  queueRaceInput(preciseDrag, { held: false, boost: false, dragY: null });
  stepRace(preciseDrag);
  same([preciseDrag.y, preciseDrag.vy, preciseDrag.tunnelDragY], [330, 0, null],
    "released tunnel drag did not hold its last position");
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
  const tunnelSpineTicks = [0, 45, 90, 135, 180, 225, 255, 285, 315, 359];
  same(tunnelSpineTicks.map((tick) => {
    const geometry = raceTunnelGeometry({ seed: RACE_SEED, wormholes: 0, entryAnchorY: 320 }, tick);
    return [tick, geometry.center, geometry.half];
  }), [
    [0, 320, 144], [45, 248, 126], [90, 204, 96], [135, 408, 108], [180, 440, 88],
    [225, 468, 104], [255, 168, 88], [285, 452, 96], [315, 360, 120], [359, 320, 144],
  ], "unmirrored tunnel spine anchors changed");
  same(tunnelSpineTicks.map((tick) => {
    const geometry = raceTunnelGeometry({ seed: RACE_SEED, wormholes: 2, entryAnchorY: 496 }, tick);
    return [tick, geometry.center, geometry.half];
  }), [
    [0, 496, 144], [45, 392, 126], [90, 436, 96], [135, 232, 108], [180, 200, 88],
    [225, 172, 104], [255, 472, 88], [285, 188, 96], [315, 280, 120], [359, 320, 144],
  ], "mirrored tunnel spine no longer preserves entry/exit mouths and reflected interior centers");
  for (const { wormholes, entryAnchorY } of actualTunnelEntries) {
    const ringRace = { seed: RACE_SEED, wormholes, entryAnchorY };
    const rings = raceTunnelRings(ringRace);
    same(rings.map((ring) => ring.tick), [...RACE_TUNNEL_RING_TICKS],
      `cycle ${wormholes} ring cadence changed`);
    rings.forEach((ring, index) => {
      near(ring.y, raceTunnelGeometry(ringRace, ring.tick).center, 1e-12,
        `cycle ${wormholes} ring ${index + 1} left the procedural center path`);
      const geometry = raceTunnelGeometry(ringRace, ring.tick);
      assert(RACE_TUNNEL_RING_APERTURE + RACE_PILOT_RADIUS <= geometry.half,
        `cycle ${wormholes} ring ${index + 1} aperture escaped the corridor`);
    });
  }
  const authoredTunnelTransfers = actualTunnelEntries.flatMap(({ wormholes, entryAnchorY }) => {
    const rings = raceTunnelRings({ seed: RACE_SEED, wormholes, entryAnchorY });
    return rings.slice(1).map((ring, index) => Math.abs(ring.y - rings[index].y));
  });
  const worstTunnelTransfer = Math.max(...authoredTunnelTransfers);
  const worstTransferSteps = Math.ceil(worstTunnelTransfer / RACE_TUNNEL_DRAG_STEP);
  assert(worstTransferSteps <= 22 && RACE_TUNNEL_RING_TICKS[1] - RACE_TUNNEL_RING_TICKS[0] - worstTransferSteps >= 14,
    `slower follower cannot settle the authored ${worstTunnelTransfer}-unit transfer before judging`);

  function judgeFirstTunnelRing(error) {
    const race = makeTunnelRace();
    race.phaseTick = RACE_TUNNEL_RING_TICKS[0];
    const ring = raceTunnelRings(race)[0];
    race.y = ring.y + error;
    race.previousY = race.y;
    race.tick = 500;
    const result = stepRace(race);
    return { outcome: race.tunnelRingLedger[0][0], cue: result.cues[0], decisionTick: race.tunnelRingDecisionTicks[0][0] };
  }
  same([
    judgeFirstTunnelRing(14).outcome,
    judgeFirstTunnelRing(14 + 1e-6).outcome,
    judgeFirstTunnelRing(42).outcome,
    judgeFirstTunnelRing(42 + 1e-6).outcome,
  ], ["perfect", "passed", "passed", "missed"],
  "nested center/outer ring boundary grading changed");
  same([
    judgeFirstTunnelRing(0).cue.kind,
    judgeFirstTunnelRing(20).cue.kind,
    judgeFirstTunnelRing(60).cue.kind,
  ], ["tunnel-ring-perfect", "tunnel-ring-pass", "tunnel-ring-miss"],
  "tunnel ring authority cue kinds changed");
  const firstDecision = judgeFirstTunnelRing(0);
  same([firstDecision.cue.id, firstDecision.cue.index, firstDecision.decisionTick], ["w1-g01", 0, 500],
    "tunnel ring decision did not bind to its exact crossing tick/id");

  const noisyDrag = makeTunnelRace();
  for (let step = 0; step < RACE_TUNNEL_TICKS; step++) {
    const target = raceTunnelGeometry(noisyDrag, noisyDrag.phaseTick).center
      + (step % 4 < 2 ? -12 : 12);
    queueRaceInput(noisyDrag, { held: false, boost: false, dragY: target });
    stepRace(noisyDrag);
  }
  const noisyQuality = raceTunnelQuality(noisyDrag, 0);
  assert(noisyQuality.missed === 0 && noisyQuality.pending === 0 && noisyDrag.wallScrapeTicks.length === 0,
    `bounded thumb-jitter proxy destabilized the slower follower ${JSON.stringify({ noisyQuality, wallScrapes: noisyDrag.wallScrapeTicks })}`);

  function runTunnelAlignment(wormholes, entryAnchorY, offsetForIndex) {
    const race = makeTunnelRace(wormholes, entryAnchorY);
    const cues = [];
    for (let step = 0; step < RACE_TUNNEL_TICKS; step++) {
      const rings = raceTunnelRings(race);
      const nextIndex = rings.findIndex((_, index) => race.tunnelRingLedger[wormholes][index] === "pending");
      if (nextIndex >= 0) {
        queueRaceInput(race, {
          held: false,
          boost: false,
          dragY: raceTunnelGeometry(race, race.phaseTick).center + offsetForIndex(nextIndex),
        });
      }
      cues.push(...stepRace(race).cues);
    }
    const quality = raceTunnelQuality(race, wormholes);
    for (let step = 0; step < RACE_RETURN_TICKS; step++) cues.push(...stepRace(race).cues);
    return { race, quality, cues };
  }
  const perfectAlignments = actualTunnelEntries.map(({ wormholes, entryAnchorY }) =>
    runTunnelAlignment(wormholes, entryAnchorY, () => 0));
  const passAlignment = runTunnelAlignment(0, 320, () => 20);
  const missAlignment = runTunnelAlignment(0, 320, () => 60);
  for (const [cycle, witness] of perfectAlignments.entries()) {
    same(witness.quality, {
      passed: 0, perfect: 9, missed: 0, pending: 0, units: 18, exitSpeed: 360,
    }, `cycle ${cycle} centered ring witness did not earn the full exit-speed reward`);
    assert(witness.race.wallScrapeTicks.length === 0,
      `cycle ${cycle} centered ring witness scraped the procedural corridor`);
    same(witness.cues.filter((cue) => cue.kind === "tunnel-ring-perfect").map((cue) => cue.id),
      RACE_TUNNEL_RING_TICKS.map((_, index) => `w${cycle + 1}-g${String(index + 1).padStart(2, "0")}`),
      `cycle ${cycle} centered ring cue order changed`);
  }
  same(passAlignment.quality, {
    passed: 9, perfect: 0, missed: 0, pending: 0, units: 9, exitSpeed: 326.25,
  }, "outer-ring clear witness did not derive the middle exit speed");
  same(missAlignment.quality, {
    passed: 0, perfect: 0, missed: 9, pending: 0, units: 0, exitSpeed: 292.5,
  }, "all-miss witness did not retain the minimum exit speed");
  same([passAlignment.race.speed, missAlignment.race.speed, perfectAlignments[0].race.speed],
    [326.25, 292.5, 360], "return handoff did not apply the judged alignment quality");
  assert(RACE_MAX_WORMHOLES === 3 && RACE_ACORNS.length === RACE_MAX_ACORNS && RACE_MAX_ACORNS === 42,
    "alignment-only tunnels changed the 42 authored course-pickup ceiling");
  assert([...passAlignment.cues, ...missAlignment.cues, ...perfectAlignments.flatMap((x) => x.cues)]
    .every((cue) => cue.kind !== "acorn"), "alignment-only tunnel emitted a removed acorn reward");
  const ceilingConflict = { ring: RACE_RINGS[66], acorn: RACE_ACORNS[33] };
  assert(ceilingConflict.ring.id === "r67" && ceilingConflict.acorn.id === "a34"
    && ceilingConflict.ring.x === ceilingConflict.acorn.x
    && Math.abs(ceilingConflict.ring.y - ceilingConflict.acorn.y) > RACE_GATE_CLEARANCE + 26,
  "same-plane r67/a34 exclusion changed while removing tunnel acorns");

  const fullPhaseCycle = createRaceState();
  fullPhaseCycle.phase = "entry";
  fullPhaseCycle.phaseTick = 0;
  fullPhaseCycle.coursePosition = 1_000;
  fullPhaseCycle.previousCoursePosition = 1_000;
  fullPhaseCycle.phaseStartPosition = 1_000;
  fullPhaseCycle.entryRingIndex = 0;
  fullPhaseCycle.entryStartY = 320;
  fullPhaseCycle.entryAnchorY = 320;
  fullPhaseCycle.y = 320;
  fullPhaseCycle.previousY = 320;
  fullPhaseCycle.vy = 0;
  fullPhaseCycle.charge = 100;
  for (let step = 0; step < RACE_ENTRY_TICKS - 1; step++) stepRace(fullPhaseCycle);
  same([fullPhaseCycle.phase, fullPhaseCycle.phaseTick, fullPhaseCycle.tick, fullPhaseCycle.coursePosition],
    ["entry", RACE_ENTRY_TICKS - 1, RACE_ENTRY_TICKS - 1, 1_000],
    "entry left its authored phase before step 48");
  const entryHandoff = stepRace(fullPhaseCycle);
  same([
    fullPhaseCycle.phase,
    fullPhaseCycle.phaseTick,
    fullPhaseCycle.tick,
    fullPhaseCycle.coursePosition,
    fullPhaseCycle.phaseStartPosition,
    fullPhaseCycle.charge,
    fullPhaseCycle.tunnelRingLedger[0]?.length,
    fullPhaseCycle.tunnelRingDecisionTicks[0]?.length,
    entryHandoff.finished,
  ], ["tunnel", 0, RACE_ENTRY_TICKS, 1_000, 1_000, 0, 9, 9, false],
  "entry step 48 did not hand off exactly to tunnel tick 0");
  for (let step = 0; step < RACE_TUNNEL_TICKS - 1; step++) stepRace(fullPhaseCycle);
  same([fullPhaseCycle.phase, fullPhaseCycle.phaseTick, fullPhaseCycle.tick],
    ["tunnel", RACE_TUNNEL_TICKS - 1, RACE_ENTRY_TICKS + RACE_TUNNEL_TICKS - 1],
    "tunnel left its authored phase before step 360");
  near(fullPhaseCycle.coursePosition,
    1_000 + RACE_TUNNEL_DISTANCE * ((RACE_TUNNEL_TICKS - 1) / RACE_TUNNEL_TICKS), 1e-9,
    "tunnel course distance was not proportional before its final step");
  const tunnelHandoff = stepRace(fullPhaseCycle);
  same([
    fullPhaseCycle.phase,
    fullPhaseCycle.phaseTick,
    fullPhaseCycle.tick,
    fullPhaseCycle.coursePosition,
    tunnelHandoff.finished,
  ], ["return", 0, RACE_ENTRY_TICKS + RACE_TUNNEL_TICKS, 1_000 + RACE_TUNNEL_DISTANCE, false],
  "tunnel step 360 did not hand off exactly to return tick 0");
  const fullCycleQuality = raceTunnelQuality(fullPhaseCycle, 0);
  assert(fullCycleQuality.pending === 0, "full phase cycle left an alignment ring unjudged");
  for (let step = 0; step < RACE_RETURN_TICKS - 1; step++) stepRace(fullPhaseCycle);
  same([fullPhaseCycle.phase, fullPhaseCycle.phaseTick, fullPhaseCycle.tick, fullPhaseCycle.wormholes],
    ["return", RACE_RETURN_TICKS - 1,
      RACE_ENTRY_TICKS + RACE_TUNNEL_TICKS + RACE_RETURN_TICKS - 1, 0],
    "return left its authored phase before step 36");
  const returnHandoff = stepRace(fullPhaseCycle);
  same([
    fullPhaseCycle.phase,
    fullPhaseCycle.phaseTick,
    fullPhaseCycle.tick,
    fullPhaseCycle.wormholes,
    fullPhaseCycle.speed,
    fullPhaseCycle.collisionGraceTicks,
    returnHandoff.cues.map((cue) => cue.kind),
  ], ["normal", 0, RACE_ENTRY_TICKS + RACE_TUNNEL_TICKS + RACE_RETURN_TICKS,
    1, fullCycleQuality.exitSpeed, RACE_RETURN_GRACE_TICKS + 1, ["return"]],
  "return step 36 did not settle the exact 444-tick cycle once");
  const postSettlement = stepRace(fullPhaseCycle);
  assert(fullPhaseCycle.phase === "normal" && fullPhaseCycle.wormholes === 1
    && !postSettlement.cues.some((cue) => cue.kind === "return"),
  "completed 48/360/36 cycle settled its return more than once");

  const handoff = createRaceState();
  handoff.phase = "tunnel";
  handoff.phaseStartPosition = 1_000;
  handoff.coursePosition = 1_000;
  handoff.entryAnchorY = 320;
  handoff.y = 320;
  handoff.charge = 100;
  const handoffCues = [];
  for (let i = 0; i < RACE_TUNNEL_TICKS; i++) handoffCues.push(...stepRace(handoff).cues);
  const handoffQuality = raceTunnelQuality(handoff, 0);
  for (let i = 0; i < RACE_RETURN_TICKS; i++) handoffCues.push(...stepRace(handoff).cues);
  assert(handoff.phase === "normal", "return did not hand back to normal flight");
  near(handoff.coursePosition, 1_000 + RACE_TUNNEL_DISTANCE, 1e-9, "tunnel distance changed");
  assert(handoff.charge === 0, `return charge ${handoff.charge}, expected 0`);
  assert(handoff.speed === handoffQuality.exitSpeed,
    `return speed ${handoff.speed}, expected judged ${handoffQuality.exitSpeed}`);
  assert(RACE_RETURN_MARGIN === 96 && handoff.y >= 96 && handoff.y <= 544,
    `return y ${handoff.y} outside separately derived 96..544 band`);
  assert(handoff.collisionGraceTicks === RACE_RETURN_GRACE_TICKS + 1,
    `return armed ${handoff.collisionGraceTicks}, expected pre-decrement ${RACE_RETURN_GRACE_TICKS + 1}`);
  same(handoffCues.filter((cue) => cue.kind === "return"), [
    {
      kind: "return", tick: RACE_TUNNEL_TICKS + RACE_RETURN_TICKS - 1,
      id: "w1", index: 0, y: handoff.returnY, chargeDelta: 0,
    },
  ], "return cue changed or emitted more than once");
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
  const finishSteps = [];
  for (let i = 0; i < 3; i++) {
    const result = stepRace(once);
    finishSteps.push(result);
    if (result.finished) settles += 1;
  }
  assert(settles === 1, `finish emitted ${settles} settlements`);
  same(finishSteps.map((result) => result.cues), [[
    { kind: "finish", tick: 0, id: "prototype-chapter-1", index: -1, y: once.y, chargeDelta: 0 },
  ], [], []], "finish cue did not emit exactly once on its authority step");

  const evidence = {
    suite: "Hyper Run wormhole alignment mandatory replay acceptance",
    fixedStepHz: 60,
    tests: {
      sameSeedAndSemanticInputs: "passed",
      presentationSizeAndReadyFreeze: "passed",
      renderCadenceIndependence: "passed",
      similarityProfilesAndReachability: "passed",
      sweptObjectsAndGatePlane: "passed",
      tunnelDragAlignmentAndHandoff: "passed",
    },
    profiles: {
      passive: { ticks: passive.race.finishTicks, time: formatRaceTicks(passive.race.finishTicks), wormholes: passive.race.wormholes },
      average: { ticks: average.race.finishTicks, time: formatRaceTicks(average.race.finishTicks), wormholes: average.race.wormholes,
        passed: countLedger(average.race, "passed"), meanNormalSpeed: Number(average.meanNormalSpeed.toFixed(3)),
        tunnelQuality: average.race.tunnelRingLedger.map((_, cycle) => raceTunnelQuality(average.race, cycle)) },
      optimized: { ticks: optimized.race.finishTicks, time: formatRaceTicks(optimized.race.finishTicks), wormholes: optimized.race.wormholes,
        passed: countLedger(optimized.race, "passed"), meanNormalSpeed: Number(optimized.meanNormalSpeed.toFixed(3)),
        tunnelQuality: optimized.race.tunnelRingLedger.map((_, cycle) => raceTunnelQuality(optimized.race, cycle)) },
    },
    optimizedSignature: raceSignature(optimized.race),
    horizontalSimilarity: {
      scale: RACE_COURSE_SCALE,
      length: RACE_LENGTH,
      speed: [RACE_BASE_SPEED, RACE_MAX_SPEED],
      tunnel: [RACE_TUNNEL_SPEED, RACE_TUNNEL_DISTANCE, RACE_TUNNEL_TICKS],
      latestEntryX: RACE_LATEST_ENTRY_X,
      maxInteractiveGap: RACE_MAX_INTERACTIVE_GAP,
      measuredInteractiveGap: layoutEvidence.largestInteractiveGap,
      measuredDelayedReturnGap: layoutEvidence.worstDelayedReturn,
      intendedReturnGaps: layoutEvidence.intendedReturnGaps,
    },
    presentationMatrix: {
      viewports: requiredViewSizes.map(([width, height]) => `${width}x${height}`),
      phases: resizePhaseSpecs.map((spec) => spec.label),
      ownedInputs: ["flight pointer/touch", "relative tunnel drag", "keyboard-rise", "keyboard-drop"],
    },
    authoredTupleLocks: {
      rings: RACE_RINGS.length,
      debris: RACE_DEBRIS.length,
      courseAcorns: RACE_ACORNS.length,
    },
    gatePlaneMatrix: {
      viewports: ["360x640", "844x390"],
      offsets: planeCases.map((testCase) => testCase.offset),
      frames: [-2, -1, 0, 1, 2],
      epsilon: planeEpsilon,
    },
    structuredCues: {
      optimized: at60.cues.length,
      optimizedEffectPlans: at60.effectPlans.length,
      simultaneousKinds: coexistCues.map((cue) => cue.kind),
      simultaneousDeltas: coexistCues.map((cue) => cue.chargeDelta),
      dirtyQualifyingGate: {
        start: 95,
        final: deniedDirtyEntry.charge,
        phase: deniedDirtyEntry.phase,
        cues: deniedDirtyStep.cues.map((cue) => cue.kind),
      },
      allKindsOneShotPlans: allCuePlans.map((effect) => [effect.cue.kind, effect.sfx, effect.notify]),
      finishEmissions: settles,
    },
    semanticTransitions: authoredOptimized.transitions.length,
    benchmarkGestureRealization: {
      average: {
        rawEvents: realizedAverage.rawEvents,
        eventsPerSecond: Number((realizedAverage.rawEvents / (average.race.finishTicks / 60)).toFixed(3)),
        qualifyingBoostPresses: realizedAverage.qualifyingBoostPresses,
        swipeDrops: realizedAverage.swipeDrops,
        dragTargets: realizedAverage.dragTargets,
        dragMoves: realizedAverage.dragMoves,
      },
      optimized: {
        rawEvents: realizedOptimized.rawEvents,
        eventsPerSecond: Number((realizedOptimized.rawEvents / (optimized.race.finishTicks / 60)).toFixed(3)),
        qualifyingBoostPresses: realizedOptimized.qualifyingBoostPresses,
        swipeDrops: realizedOptimized.swipeDrops,
        dragTargets: realizedOptimized.dragTargets,
        dragMoves: realizedOptimized.dragMoves,
      },
    },
    mirrorBits,
    advancedFreeOptimisticLowerBound: fastestPlainBenchmark,
    courseAcornCeiling: RACE_MAX_ACORNS,
    normalInputEdges: {
      pressVy: RACE_NORMAL_PRESS_VY,
      boostPressVy: RACE_NORMAL_BOOST_PRESS_VY,
      releaseBrakeVy: RACE_NORMAL_RELEASE_BRAKE_VY,
      firstTick: { plain: freshHold.vy, boost: freshBoost.vy, release: releasedEdge.vy },
      dropLastWriterVy: dropWins.vy,
    },
    tunnelDrag: {
      fullHeight: RACE_HEIGHT,
      traversalTicks: RACE_TUNNEL_DRAG_TRAVERSAL_TICKS,
      maximumStep: RACE_TUNNEL_DRAG_STEP,
      followerSamples,
      worstAuthoredTransfer: worstTunnelTransfer,
      worstAuthoredTransferSteps: worstTransferSteps,
      noisyDragQuality: noisyQuality,
      noisyDragWallScrapes: noisyDrag.wallScrapeTicks,
    },
    tunnelAlignment: {
      ringTicks: [...RACE_TUNNEL_RING_TICKS],
      outerAperture: RACE_TUNNEL_RING_APERTURE,
      perfectAperture: RACE_TUNNEL_PERFECT_APERTURE,
      outerClearance: RACE_TUNNEL_RING_CLEARANCE,
      perfectClearance: RACE_TUNNEL_PERFECT_CLEARANCE,
      speedGainPerUnit: RACE_TUNNEL_QUALITY_SPEED_GAIN,
      allMiss: missAlignment.quality,
      allPass: passAlignment.quality,
      allPerfect: perfectAlignments.map((witness) => witness.quality),
    },
    fullPhaseCycle: {
      entryTicks: RACE_ENTRY_TICKS,
      tunnelTicks: RACE_TUNNEL_TICKS,
      returnTicks: RACE_RETURN_TICKS,
      totalTicks: RACE_ENTRY_TICKS + RACE_TUNNEL_TICKS + RACE_RETURN_TICKS,
      quality: fullCycleQuality,
    },
    tunnelSpineTicks,
    tunnelRingEntries: actualTunnelEntries.map((entry) => ({
      ...entry,
      mirrored: raceTunnelMirrored({ seed: RACE_SEED, wormholes: entry.wormholes }),
      rings: raceTunnelRings({ seed: RACE_SEED, ...entry }),
    })),
    returnGrace: { protectedNormalSteps: RACE_RETURN_GRACE_TICKS, firstLiveStep: RACE_RETURN_GRACE_TICKS + 1 },
  };
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
