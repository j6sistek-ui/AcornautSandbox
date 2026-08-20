#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(tmpdir(), `acornaut-tunnel-test-${process.pid}`);
// Some sandboxed runners inherit an unwritable /root/.npm. Keep the test
// self-contained instead of requiring callers to repair their environment.
const npmCache = join(tmpdir(), "acornaut-npm-cache");
const DT = 1 / 60;
const TAP_FLOOR = 7;
const EPS = 1e-6;
const COMBINED_SEEDS = [1, 17, 101];
const TRACK_FRAMES = 60 * 100;
mkdirSync(out, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance,
    `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}

function rounded(n, places = 5) {
  return Number(n.toFixed(places));
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

  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const require = createRequire(import.meta.url);
  const {
    TUNNEL_PATTERNS,
    TUNNEL_REGION_NAMES,
    flap,
    makeWorld,
    resetRun,
    resizeWorld,
    tunnelBoundsAt,
    updateWorld,
  } = require(join(out, "sim.js"));
  const { PHYS } = require(join(out, "catalog.js"));
  const { defaultSave } = require(join(out, "save.js"));

  function startWorld(seed, W = 360, H = 640, save = defaultSave()) {
    const world = makeWorld(W, H);
    resetRun(world, save, "tunnel", false, undefined, seed);
    assert(world.tunnel?.seed === seed, `forced seed was not retained: ${seed}`);
    assert(flap(world, save) === "flap", "first tap did not launch tunnel run");
    return { world, save };
  }

  function centerPilot(world, save, framesSinceTap) {
    const sx = world.W * PHYS.squirrelX;
    const ahead = tunnelBoundsAt(world, sx + 70);
    const here = tunnelBoundsAt(world, sx);
    const target = (ahead.top + ahead.bottom) * 0.5;
    const tapAt = Math.min(target + 30, here.bottom - 25);
    const tapApex = world.squirrel.y - 78;
    if (world.squirrel.y > tapAt && tapApex > here.top + 24 &&
        world.squirrel.vy > -80 && framesSinceTap >= TAP_FLOOR) {
      flap(world, save);
      return 0;
    }
    return framesSinceTap;
  }

  function gameplaySignature(track) {
    return JSON.stringify({
      nodes: track.nodes.map((n) => [
        n.index, rounded(n.x), rounded(n.top), rounded(n.bottom), n.section,
        n.pattern, n.region, n.sectionStart, n.sectionEnd,
      ]),
      hazards: track.hazardDefs.map((h) => [
        rounded(h.x), rounded(h.y), rounded(h.r), h.section, h.pattern, h.side, h.art,
      ]),
      pickups: track.pickupDefs.map((p) => [
        rounded(p.x), rounded(p.y), rounded(p.bob), p.kind, p.section, p.pattern,
      ]),
    });
  }

  /** Generate an absolute-coordinate track with the production generator. */
  function buildTrack(seed, frames = TRACK_FRAMES, W = 360, H = 640) {
    const { world, save } = startWorld(seed, W, H);
    const nodeByIndex = new Map();
    const hazardDefs = [];
    const pickupDefs = [];
    let externalHazards = [];
    let externalSlows = [];
    let framesSinceTap = 0;
    const snapshots = [];
    const regionsSeen = new Set([world.tunnel.activeRegion]);

    const rememberNodes = () => {
      for (const n of world.tunnel.nodes) {
        if (nodeByIndex.has(n.index)) continue;
        nodeByIndex.set(n.index, { ...n, x: world.distance + n.x });
      }
    };
    const rememberHazards = (hazards) => {
      for (const h of hazards) {
        hazardDefs.push({ ...h, x: world.distance + h.x });
        externalHazards.push({ ...h });
      }
    };
    const rememberPickups = (pickups) => {
      for (const p of pickups) {
        pickupDefs.push({
          ...p,
          x: world.distance + p.x,
          section: p.tunnelSection,
          pattern: p.tunnelPattern,
        });
        if (p.kind === "slow") externalSlows.push({ ...p });
      }
    };

    rememberNodes();
    rememberHazards(world.tunnel.hazards);
    rememberPickups(world.pickups);
    world.tunnel.hazards = [];
    world.pickups = [];

    for (let frame = 0; frame < frames; frame++) {
      framesSinceTap = centerPilot(world, save, framesSinceTap);
      const beforeDistance = world.distance;
      const speedPattern = world.tunnel.activePattern;
      const event = updateWorld(world, save, DT);
      framesSinceTap += 1;
      assert(event !== "die", `track builder died: seed=${seed} frame=${frame}`);
      const move = world.distance - beforeDistance;
      for (const h of externalHazards) h.x -= move;
      for (const p of externalSlows) {
        p.x -= move;
        p.bob += DT * 4;
      }
      rememberNodes();
      rememberHazards(world.tunnel.hazards);
      rememberPickups(world.pickups);
      world.tunnel.hazards = [];
      world.pickups = [];
      externalHazards = externalHazards.filter((h) => h.x > -80);
      externalSlows = externalSlows.filter((p) => p.x > -50);
      regionsSeen.add(world.tunnel.activeRegion);
      const sx = W * PHYS.squirrelX;
      snapshots.push({
        beforeDistance,
        distance: world.distance,
        speed: world.speed,
        activePattern: world.tunnel.activePattern,
        speedPattern,
        nextMilestone: world.tunnel.nextMilestone,
        bounds: tunnelBoundsAt(world, sx),
        hazards: externalHazards.map((h) => ({ x: h.x, y: h.y, r: h.r })),
        slows: externalSlows.map((p) => ({ x: p.x, y: p.y + Math.sin(p.bob) * 4 })),
      });
    }
    return {
      seed, W, H, frames, snapshots,
      nodes: [...nodeByIndex.values()].sort((a, b) => a.index - b.index),
      hazardDefs, pickupDefs, regionsSeen,
    };
  }

  function marginAt(y, snapshot, sx) {
    let margin = Math.min(
      y - PHYS.squirrelR - snapshot.bounds.top,
      snapshot.bounds.bottom - y - PHYS.squirrelR,
    );
    for (const h of snapshot.hazards) {
      margin = Math.min(margin,
        Math.hypot(sx - h.x, y - h.y) - PHYS.squirrelR - h.r * 0.65);
    }
    return margin;
  }

  function hitsFreeze(y, snapshot, sx) {
    return snapshot.slows.some((p) =>
      Math.hypot(sx - p.x, y - p.y) <= PHYS.squirrelR + 19);
  }

  function advanceVertical(state, tap, snapshot, sx) {
    let vy = tap ? PHYS.flap : state.vy;
    vy = Math.min(620, vy + PHYS.gravity * DT);
    const y = state.y + vy * DT;
    const margin = marginAt(y, snapshot, sx);
    if (margin <= 0 || hitsFreeze(y, snapshot, sx)) return null;
    return {
      y, vy,
      since: tap ? 1 : Math.min(TAP_FLOOR, state.since + 1),
      margin,
    };
  }

  /** Receding-horizon reachability search with a replayable tap prefix. */
  function solveTrack(track) {
    const BLOCK = 45;
    const HORIZON = 150;
    const MAX_FRONTIER = 1700;
    const sx = track.W * PHYS.squirrelX;
    let current = { y: track.H * 0.5, vy: PHYS.flap, since: 0 };
    const tapFrames = [];
    let smallestFrontier = Infinity;
    let largestFrontier = 0;
    let minimumReplayMargin = Infinity;

    for (let start = 0; start < track.frames; start += BLOCK) {
      let states = [{ ...current, lo: 0, hi: 0, minMargin: Infinity, tailMargin: Infinity }];
      const end = Math.min(track.frames, start + HORIZON);
      for (let frame = start; frame < end; frame++) {
        const local = frame - start;
        const next = new Map();
        for (const state of states) {
          for (let tap = 0; tap <= 1; tap++) {
            if (tap && state.since < TAP_FLOOR) continue;
            const advanced = advanceVertical(state, !!tap, track.snapshots[frame], sx);
            if (!advanced) continue;
            let lo = state.lo;
            let hi = state.hi;
            if (tap && local < BLOCK) {
              if (local < 32) lo = (lo | (1 << local)) >>> 0;
              else hi = (hi | (1 << (local - 32))) >>> 0;
            }
            const candidate = {
              ...advanced, lo, hi,
              minMargin: Math.min(state.minMargin, advanced.margin),
              tailMargin: advanced.margin,
            };
            const key = `${Math.round(candidate.y / 2)},${Math.round(candidate.vy / 20)},${candidate.since}`;
            const previous = next.get(key);
            if (!previous || candidate.minMargin > previous.minMargin + 0.05 ||
                (Math.abs(candidate.minMargin - previous.minMargin) <= 0.05 &&
                 candidate.tailMargin > previous.tailMargin)) next.set(key, candidate);
          }
        }
        states = [...next.values()];
        if (states.length > MAX_FRONTIER) {
          states.sort((a, b) =>
            (b.minMargin + b.tailMargin * 0.08) - (a.minMargin + a.tailMargin * 0.08));
          states.length = MAX_FRONTIER;
        }
        smallestFrontier = Math.min(smallestFrontier, states.length);
        largestFrontier = Math.max(largestFrontier, states.length);
        assert(states.length > 0,
          `no live wall+debris route: seed=${track.seed} frame=${frame}`);
      }
      states.sort((a, b) =>
        (b.minMargin + b.tailMargin * 0.12) - (a.minMargin + a.tailMargin * 0.12));
      const chosen = states[0];
      const count = Math.min(BLOCK, track.frames - start);
      for (let local = 0; local < count; local++) {
        const tap = local < 32
          ? !!(chosen.lo & (1 << local))
          : !!(chosen.hi & (1 << (local - 32)));
        if (tap) tapFrames.push(start + local);
        const next = advanceVertical(current, tap, track.snapshots[start + local], sx);
        assert(next, `chosen route failed its own prefix: seed=${track.seed} frame=${start + local}`);
        minimumReplayMargin = Math.min(minimumReplayMargin, next.margin);
        current = { y: next.y, vy: next.vy, since: next.since };
      }
    }
    return { tapFrames, final: current, smallestFrontier, largestFrontier, minimumReplayMargin };
  }

  function replayTrack(track, solution) {
    const { world, save } = startWorld(track.seed, track.W, track.H);
    const taps = new Set(solution.tapFrames);
    for (let frame = 0; frame < track.frames; frame++) {
      if (taps.has(frame)) flap(world, save);
      const event = updateWorld(world, save, DT);
      assert(event !== "die", `exact production replay died: seed=${track.seed} frame=${frame}`);
      assert(world.powerLeft <= EPS,
        `reachability route collected Freeze unexpectedly: seed=${track.seed} frame=${frame}`);
    }
    close(world.distance, track.snapshots.at(-1).distance, 1e-4,
      `production replay distance diverged for seed ${track.seed}`);
    close(world.squirrel.y, solution.final.y, 1e-4,
      `production replay y diverged for seed ${track.seed}`);
    close(world.squirrel.vy, solution.final.vy, 1e-4,
      `production replay velocity diverged for seed ${track.seed}`);
    return {
      score: world.score,
      sections: world.tunnel.sectionsCleared,
      taps: solution.tapFrames.length,
      minMargin: rounded(solution.minimumReplayMargin, 2),
      frontier: [solution.smallestFrontier, solution.largestFrontier],
    };
  }

  function testPatternContracts(track) {
    const catalog = [
      "launch", "ribbon", "acornArc", "sweep", "breather",
      "squeeze", "ripples", "debrisWeave", "surge",
    ];
    const expectedSections = [
      "launch", "ribbon", "acornArc", "sweep", "breather",
      "squeeze", "ripples", "breather", "debrisWeave", "surge", "breather",
    ];
    assert(JSON.stringify(TUNNEL_PATTERNS) === JSON.stringify(catalog),
      `pattern catalog changed without test contract: ${TUNNEL_PATTERNS.join(",")}`);
    assert(TUNNEL_REGION_NAMES.length === 5, "tunnel must expose five visual regions");
    const sections = new Map();
    for (const node of track.nodes) {
      if (!sections.has(node.section)) sections.set(node.section, []);
      sections.get(node.section).push(node);
    }
    for (let section = 0; section < expectedSections.length; section++) {
      const nodes = sections.get(section);
      assert(nodes?.length, `missing authored section ${section}`);
      assert(nodes.every((n) => n.pattern === expectedSections[section]),
        `section ${section} did not retain pattern ${expectedSections[section]}`);
      assert(nodes.every((n) => n.region === Math.floor(section / 2) % 5),
        `section ${section} has wrong region`);
      assert(nodes.filter((n) => n.sectionStart).length === 1,
        `section ${section} needs one start flag`);
      assert(nodes.filter((n) => n.sectionEnd).length === 1,
        `section ${section} needs one end flag`);
    }
    for (let i = 1; i < track.nodes.length; i++) {
      const a = track.nodes[i - 1];
      const b = track.nodes[i];
      assert(b.index === a.index + 1, `node index discontinuity at ${b.index}`);
      close(b.x - a.x, 56, 1e-4, `node spacing at ${b.index}`);
      const gap = b.bottom - b.top;
      const halfDelta = Math.abs(gap - (a.bottom - a.top)) * 0.5;
      const centerTurn = Math.abs((b.top + b.bottom - a.top - a.bottom) * 0.5);
      assert(Number.isFinite(b.top) && Number.isFinite(b.bottom), `non-finite node ${b.index}`);
      assert(b.top >= 18 - EPS && b.bottom <= track.H - 18 + EPS,
        `node ${b.index} escaped viewport: ${b.top}..${b.bottom}`);
      assert(gap >= PHYS.squirrelR * 2 + 100,
        `node ${b.index} has inadequate corridor: ${gap}`);
      assert(halfDelta <= 8.01, `width changed too abruptly at node ${b.index}: ${halfDelta}`);
      assert(centerTurn <= 9.61, `center changed too abruptly at node ${b.index}: ${centerTurn}`);
    }

    const firstSectionFor = Object.fromEntries(catalog.map((pattern) => {
      const entry = [...sections.entries()].find(([, nodes]) =>
        nodes[0]?.pattern === pattern && nodes.some((n) => n.sectionEnd));
      assert(entry, `no complete section generated for ${pattern}`);
      return [pattern, entry[0]];
    }));
    const byPattern = Object.fromEntries(catalog.map((p) => [p, sections.get(firstSectionFor[p])]));
    const centers = (nodes) => nodes.map((n) => (n.top + n.bottom) * 0.5);
    const gaps = (nodes) => nodes.map((n) => n.bottom - n.top);
    const range = (values) => Math.max(...values) - Math.min(...values);
    const extrema = (values) => {
      let turns = 0;
      let prior = 0;
      for (let i = 1; i < values.length; i++) {
        const sign = Math.sign(values[i] - values[i - 1]);
        if (sign && prior && sign !== prior) turns++;
        if (sign) prior = sign;
      }
      return turns;
    };
    const hazardsFor = (pattern, section = firstSectionFor[pattern]) =>
      track.hazardDefs.filter((h) => h.pattern === pattern && h.section === section);
    const pickupsFor = (pattern, section = firstSectionFor[pattern]) =>
      track.pickupDefs.filter((p) => p.pattern === pattern && p.section === section);

    assert(hazardsFor("launch").length === 0, "launch must be hazard-free");
    assert(range(centers(byPattern.ribbon)) >= 70, "ribbon lacks meaningful lateral travel");
    assert(hazardsFor("ribbon").length === 1, "ribbon must contain one readable hazard");
    assert(pickupsFor("acornArc").filter((p) => p.kind === "acorn").length >= 7,
      "acornArc lacks its collectible trail");
    assert(pickupsFor("acornArc").some((p) => p.kind === "multiplier"),
      "acornArc lacks its multiplier reward");
    assert(Math.abs(centers(byPattern.sweep).at(-1) - centers(byPattern.sweep)[0]) >= 60,
      "sweep lacks directional displacement");
    assert(hazardsFor("breather").length === 0, "breather must be hazard-free");
    assert(Math.min(...gaps(byPattern.breather)) >= Math.min(...gaps(byPattern.ripples)) + 18,
      "breather is not materially wider than ripples");
    assert(range(gaps(byPattern.squeeze)) >= 28, "squeeze does not visibly close and reopen");
    assert(extrema(gaps(byPattern.ripples)) >= 4, "ripples lacks repeated wall pulses");
    const weaveHazards = hazardsFor("debrisWeave");
    const weaveFreeze = pickupsFor("debrisWeave").filter((p) => p.kind === "slow");
    assert(weaveHazards.length === 2, `debrisWeave needs two hazards, got ${weaveHazards.length}`);
    assert(weaveHazards[0].side === -weaveHazards[1].side,
      "debrisWeave hazards must alternate sides");
    assert(weaveFreeze.length === 1 && weaveFreeze[0].x < Math.min(...weaveHazards.map((h) => h.x)),
      "debrisWeave Freeze must precede both hazards");
    assert(range(centers(byPattern.surge)) >= 90, "surge lacks high-amplitude movement");
    assert(hazardsFor("surge").length === 1, "surge must contain one hazard");

    const sortedHazards = [...track.hazardDefs].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sortedHazards.length; i++) {
      const h = sortedHazards[i];
      const node = track.nodes.reduce((best, n) =>
        Math.abs(n.x - h.x) < Math.abs(best.x - h.x) ? n : best, track.nodes[0]);
      const bypass = Math.max(h.y - node.top, node.bottom - h.y) - h.r * 0.65 - PHYS.squirrelR;
      assert(bypass >= 55, `hazard has inadequate bypass: ${bypass.toFixed(1)}px`);
      if (i) assert(h.x - sortedHazards[i - 1].x >= 819.9,
        `hazards too close: ${(h.x - sortedHazards[i - 1].x).toFixed(1)}px`);
    }
    assert([...track.regionsSeen].sort().join(",") === "0,1,2,3,4",
      `not all regions became active: ${[...track.regionsSeen].join(",")}`);
    let surgeFrames = 0;
    for (let i = 0; i < track.snapshots.length; i++) {
      const snapshot = track.snapshots[i];
      const prior = track.snapshots[i - 1];
      const next = track.snapshots[i + 1];
      const stablePattern = prior && next &&
        prior.speedPattern === snapshot.speedPattern &&
        snapshot.speedPattern === next.speedPattern &&
        snapshot.activePattern === snapshot.speedPattern;
      if (stablePattern) {
        const baseSpeed = 220 + Math.min(1, snapshot.beforeDistance / 30000) * 160;
        const expectedSpeed = baseSpeed * (snapshot.speedPattern === "surge" ? 1.08 : 1);
        close(snapshot.speed, expectedSpeed, 0.001, "distance/surge speed progression");
        if (snapshot.speedPattern === "surge") surgeFrames++;
      }
      assert(snapshot.nextMilestone > Math.floor(snapshot.distance / 100),
        `raw-distance milestone stalled at ${snapshot.nextMilestone}`);
    }
    assert(surgeFrames > 0, "surge never activated its speed event");
  }

  function clearOptionalObjects(world) {
    world.tunnel.hazards = [];
    world.pickups = [];
  }

  function putPickup(world, kind) {
    const move = world.speed * DT * (world.powerLeft > 0 ? PHYS.slowFactor : 1);
    world.pickups.push({
      x: world.W * PHYS.squirrelX + move,
      y: world.squirrel.y,
      got: false,
      bob: 0,
      kind,
      tunnelSection: world.tunnel.buildSection,
      tunnelPattern: world.tunnel.buildPattern,
    });
  }

  function testFlowFreezeAndSave() {
    const { world, save } = startWorld(7001);
    clearOptionalObjects(world);
    putPickup(world, "multiplier");
    assert(updateWorld(world, save, DT) === "gold", "multiplier pickup returned wrong event");
    close(world.tunnel.flow, 28, EPS, "multiplier Flow reward");
    close(world.tunnel.multiplierLeft, 8, EPS, "multiplier timer");
    assert(world.tunnel.multiplier === 2 && world.runAcorns === 0,
      "multiplier pickup changed wrong counters");

    clearOptionalObjects(world);
    putPickup(world, "acorn");
    assert(updateWorld(world, save, DT) === "acorn", "regular acorn returned wrong event");
    close(world.tunnel.flow, 32.25, 0.01, "first chained acorn Flow");
    assert(world.tunnel.chain === 1 && world.tunnel.bestChain === 1 && world.runAcorns === 1,
      "regular acorn did not advance chain/currency");

    world.tunnel.flow = 72;
    world.tunnel.multiplierLeft = 0;
    clearOptionalObjects(world);
    updateWorld(world, save, DT);
    assert(world.tunnel.multiplier === 3, "Flow 72 did not activate ×3");
    assert(world.tunnel.bestMultiplier === 3, "best multiplier did not retain ×3");
    world.tunnel.flow = 50;
    world.tunnel.flowGrace = 0;
    world.tunnel.chain = 3;
    clearOptionalObjects(world);
    world.pickups.push({ x: -44, y: world.squirrel.y, got: false, bob: 0, kind: "acorn" });
    updateWorld(world, save, DT);
    assert(world.tunnel.chain === 0, "missed acorn did not reset chain");
    close(world.tunnel.flow, 38 - 3.5 * DT, 0.01, "missed acorn Flow penalty");

    const fakeEnd = {
      ...world.tunnel.nodes.at(-1),
      x: world.W * PHYS.squirrelX + 1,
      sectionEnd: true,
      sectionStart: false,
      cleared: false,
      announced: true,
      index: world.tunnel.nodes.at(-1).index + 10000,
    };
    world.tunnel.nodes.push(fakeEnd);
    const flowBeforeSection = world.tunnel.flow;
    clearOptionalObjects(world);
    updateWorld(world, save, DT);
    close(world.tunnel.flow, flowBeforeSection - 3.5 * DT + 4, 0.01, "section-clear Flow reward");

    const near = startWorld(7002);
    clearOptionalObjects(near.world);
    for (const node of near.world.tunnel.nodes) node.announced = true;
    const nextVy = near.world.squirrel.vy + PHYS.gravity * DT;
    const nextY = near.world.squirrel.y + nextVy * DT;
    const hazardR = 20;
    near.world.tunnel.hazards.push({
      x: near.world.W * PHYS.squirrelX + near.world.speed * DT,
      y: nextY + PHYS.squirrelR + hazardR * 0.65 + 10,
      r: hazardR, side: 1, kind: "debris", art: 0, spin: 1,
      nearMissed: false, warned: true, section: 0, pattern: "launch",
    });
    assert(updateWorld(near.world, near.save, DT) === "near", "near miss returned wrong event");
    assert(near.world.tunnel.nearMisses === 1, "near miss did not count once");
    close(near.world.tunnel.flow, 15, 0.01, "near-miss Flow reward");
    updateWorld(near.world, near.save, DT);
    assert(near.world.tunnel.nearMisses === 1, "near miss counted twice");

    const frozen = startWorld(7101);
    const normal = startWorld(7101);
    clearOptionalObjects(frozen.world);
    clearOptionalObjects(normal.world);
    putPickup(frozen.world, "slow");
    assert(updateWorld(frozen.world, frozen.save, DT) === "freeze", "Freeze returned wrong event");
    updateWorld(normal.world, normal.save, DT);
    close(frozen.world.powerLeft, PHYS.powerDuration, EPS, "Freeze duration");
    close(frozen.world.tunnel.flow, 10, EPS, "Freeze Flow reward");
    const frozenBefore = { d: frozen.world.distance, vy: frozen.world.squirrel.vy };
    const normalBefore = { d: normal.world.distance, vy: normal.world.squirrel.vy };
    clearOptionalObjects(frozen.world);
    clearOptionalObjects(normal.world);
    updateWorld(frozen.world, frozen.save, DT);
    updateWorld(normal.world, normal.save, DT);
    close((frozen.world.distance - frozenBefore.d) / (normal.world.distance - normalBefore.d),
      PHYS.slowFactor, 0.002, "Freeze movement factor");
    close(
      (frozen.world.squirrel.vy - frozenBefore.vy) /
        (normal.world.squirrel.vy - normalBefore.vy),
      PHYS.slowFactor, 0.002, "Freeze gravity factor",
    );

    let sinceTap = 2;
    for (let frame = 0; frame < Math.ceil(PHYS.powerDuration / DT); frame++) {
      clearOptionalObjects(frozen.world);
      sinceTap = centerPilot(frozen.world, frozen.save, sinceTap);
      const event = updateWorld(frozen.world, frozen.save, DT);
      sinceTap++;
      assert(event !== "die", `Freeze duration pilot died at frame ${frame}`);
    }
    close(frozen.world.powerLeft, 0, 1e-5, "Freeze expiration");

    const lethal = startWorld(7102);
    clearOptionalObjects(lethal.world);
    lethal.world.powerLeft = 2;
    const slowDt = DT * PHYS.slowFactor;
    const lethalVy = lethal.world.squirrel.vy + PHYS.gravity * slowDt;
    const lethalY = lethal.world.squirrel.y + lethalVy * slowDt;
    lethal.world.tunnel.hazards.push({
      x: lethal.world.W * PHYS.squirrelX + lethal.world.speed * slowDt,
      y: lethalY, r: 22, side: 0, kind: "debris", art: 0, spin: 1,
      nearMissed: false, warned: true, section: 0, pattern: "launch",
    });
    assert(updateWorld(lethal.world, lethal.save, DT) === "die",
      "Freeze incorrectly prevented lethal debris collision");

    const result = startWorld(7201);
    clearOptionalObjects(result.world);
    result.world.runAcorns = 3;
    result.world.tunnel.scoreFloat = 77;
    result.world.tunnel.flowBest = 88;
    result.world.tunnel.bestChain = 6;
    result.world.tunnel.sectionsCleared = 4;
    result.world.tunnel.nearMisses = 2;
    result.world.tunnel.bestMultiplier = 3;
    result.world.squirrel.y = 0;
    assert(updateWorld(result.world, result.save, DT) === "die", "wall exit did not end run");
    assert(result.save.tunnelBest === 77 && result.save.highScore === 0 && result.save.acorns === 3,
      "tunnel save was not banked independently");
    assert(result.world.lastRun.flowBest === 88 && result.world.lastRun.bestChain === 6 &&
      result.world.lastRun.sections === 4 && result.world.lastRun.nearMisses === 2 &&
      result.world.lastRun.bestMultiplier === 3,
    "tunnel result omitted mastery metrics");
    resetRun(result.world, result.save, "tunnel", false, 7202);
    assert(result.world.tunnel.flow === 0 && result.world.tunnel.chain === 0 &&
      result.world.powerLeft === 0, "new run retained transient tunnel state");
  }

  function testNormalizedLoadouts() {
    const baseSave = defaultSave();
    const modSave = defaultSave();
    modSave.xp = 1_000_000;
    modSave.equippedPal = "nutsack";
    modSave.thrillSeeker = true;
    modSave.startShield = true;
    const base = startWorld(8001, 360, 640, baseSave);
    const modified = startWorld(8001, 360, 640, modSave);
    assert(modified.world.shieldCharges === 0 && !modified.world.startShieldArmed,
      "Tunnel retained a loadout shield");
    let framesSinceTap = 0;
    for (let frame = 0; frame < 120; frame++) {
      clearOptionalObjects(base.world);
      clearOptionalObjects(modified.world);
      const nextSinceTap = centerPilot(base.world, base.save, framesSinceTap);
      if (nextSinceTap === 0 && framesSinceTap >= TAP_FLOOR)
        flap(modified.world, modified.save);
      framesSinceTap = nextSinceTap;
      assert(updateWorld(base.world, base.save, DT) !== "die", "baseline normalization run died");
      assert(updateWorld(modified.world, modified.save, DT) !== "die", "modified normalization run died");
      framesSinceTap++;
      close(modified.world.distance, base.world.distance, 1e-7, "loadout-normalized distance");
      close(modified.world.squirrel.y, base.world.squirrel.y, 1e-7, "loadout-normalized y");
      close(modified.world.squirrel.vy, base.world.squirrel.vy, 1e-7, "loadout-normalized velocity");
    }
    clearOptionalObjects(modified.world);
    putPickup(modified.world, "acorn");
    updateWorld(modified.world, modified.save, DT);
    assert(modified.world.runAcorns === 1, "Nut-Sack modified Tunnel acorn value");
  }

  function testResizePreservation() {
    const { world, save } = startWorld(9001);
    const sx = world.W * PHYS.squirrelX;
    world.tunnel.hazards.push({
      x: sx + 240, y: world.H * 0.42, r: 21, side: -1, kind: "debris",
      art: 0, spin: 1, nearMissed: false, warned: false, section: 0, pattern: "launch",
    });
    world.pickups.push({ x: sx + 170, y: world.H * 0.55, got: false, bob: 0, kind: "acorn" });
    const old = {
      squirrelRatio: world.squirrel.y / world.H,
      hazardDx: world.tunnel.hazards[0].x - sx,
      hazardRatio: world.tunnel.hazards[0].y / world.H,
      pickupDx: world.pickups[0].x - sx,
      pickupRatio: world.pickups[0].y / world.H,
      patternStartCenter: world.tunnel.patternStartCenter,
      patternStartHalf: world.tunnel.patternStartHalf,
      nodes: world.tunnel.nodes.map((node) => ({
        x: node.x - sx,
        top: node.top,
        bottom: node.bottom,
      })),
    };
    resizeWorld(world, 390, 844);
    const largeSx = world.W * PHYS.squirrelX;
    close(world.squirrel.y / world.H, old.squirrelRatio, EPS, "large-resize squirrel lane");
    close(world.tunnel.hazards[0].x - largeSx, old.hazardDx, EPS, "large-resize hazard warning distance");
    close(world.tunnel.hazards[0].y / world.H, old.hazardRatio, EPS, "large-resize hazard lane");
    close(world.pickups[0].x - largeSx, old.pickupDx, EPS, "large-resize pickup distance");
    close(world.pickups[0].y / world.H, old.pickupRatio, EPS, "large-resize pickup lane");
    resizeWorld(world, 360, 640);
    const restoredSx = world.W * PHYS.squirrelX;
    close(world.tunnel.patternStartCenter, old.patternStartCenter, EPS,
      "round-trip pattern start center");
    close(world.tunnel.patternStartHalf, old.patternStartHalf, EPS,
      "round-trip pattern start half-width");
    assert(world.tunnel.nodes.length === old.nodes.length,
      "round-trip resize changed node count");
    world.tunnel.nodes.forEach((node, index) => {
      close(node.x - restoredSx, old.nodes[index].x, EPS,
        `round-trip node ${index} distance`);
      close(node.top, old.nodes[index].top, EPS,
        `round-trip node ${index} top`);
      close(node.bottom, old.nodes[index].bottom, EPS,
        `round-trip node ${index} bottom`);
    });
    resizeWorld(world, 320, 568);
    const smallBounds = tunnelBoundsAt(world, world.W * PHYS.squirrelX);
    assert(world.squirrel.y - PHYS.squirrelR > smallBounds.top &&
      world.squirrel.y + PHYS.squirrelR < smallBounds.bottom,
    "small resize placed squirrel outside corridor");
    assert(updateWorld(world, save, DT) !== "die", "resize caused immediate death");
  }

  const started = performance.now();
  testFlowFreezeAndSave();
  testNormalizedLoadouts();
  testResizePreservation();
  const tracks = [];
  const replayResults = [];
  for (const seed of COMBINED_SEEDS) {
    const track = buildTrack(seed);
    tracks.push(track);
    const solution = solveTrack(track);
    replayResults.push({ seed, ...replayTrack(track, solution) });
  }
  const viewportReplayResults = [];
  for (const [W, H] of [[320, 568], [390, 844]]) {
    const track = buildTrack(29, 60 * 60, W, H);
    const solution = solveTrack(track);
    viewportReplayResults.push({
      viewport: `${W}x${H}`,
      seconds: 60,
      ...replayTrack(track, solution),
    });
  }
  const deterministicTwin = buildTrack(COMBINED_SEEDS[0]);
  assert(gameplaySignature(tracks[0]) === gameplaySignature(deterministicTwin),
    "same forced seed did not generate the same gameplay track");
  assert(gameplaySignature(tracks[0]) !== gameplaySignature(tracks[1]),
    "different forced seeds generated identical gameplay tracks");

  testPatternContracts(tracks[0]);

  const elapsedMs = performance.now() - started;
  console.log(JSON.stringify({
    forcedSeeds: COMBINED_SEEDS,
    exactReplaySecondsPerSeed: TRACK_FRAMES / 60,
    exactReplayResults: replayResults,
    viewportReplayResults,
    patterns: TUNNEL_PATTERNS,
    regions: TUNNEL_REGION_NAMES.length,
    deterministicGeneration: "passed",
    geometryAndPatternContracts: "passed",
    flowFreezeSaveLoadoutResize: "passed",
    runtimeSeconds: rounded(elapsedMs / 1000, 2),
  }));
} finally {
  rmSync(out, { recursive: true, force: true });
}
