#!/usr/bin/env node
// Visual evidence companion for Hyper Run's exact gate-plane decision. This
// compiles source TypeScript into OS temp, renders the shipping drawWorld path,
// and writes review evidence outside the repository. Generated frames are
// deliberately never a source artifact.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const requestedOut = process.argv[2] ? resolve(process.argv[2]) : null;

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel));
}

if (requestedOut && isInside(root, requestedOut)) {
  throw new Error("Review output must be outside the repository; omit the argument to use OS temp.");
}

const outDir = requestedOut ?? mkdtempSync(join(tmpdir(), "acornaut-hyper-run-crossing-frames-"));
const stripPath = join(outDir, "hyper-run-crossing-pass-miss.png");
const manifestPath = join(outDir, "hyper-run-crossing-manifest.json");
if (existsSync(stripPath) || existsSync(manifestPath)) {
  throw new Error(`Refusing to overwrite existing review evidence in ${outDir}`);
}
mkdirSync(outDir, { recursive: true });

const canvasEntry = process.env.ACORNAUT_CANVAS_MODULE;
if (!canvasEntry) {
  throw new Error("Set ACORNAUT_CANVAS_MODULE to @napi-rs/canvas's index.js");
}
const { createCanvas, Image, loadImage } = await import(pathToFileURL(resolve(canvasEntry)).href);

globalThis.window = { __ACORNAUT_BETA__: true };
globalThis.Image = Image;
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`Unexpected element in review harness: ${tag}`);
    return createCanvas(1, 1);
  },
};
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function measureSprite(img) {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  let sx = 0, sy = 0, solidCount = 0;
  const solid = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 16) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (alpha >= 80) {
        sx += x; sy += y; solidCount += 1; solid.push(x, y);
      }
    }
  }
  if (maxX < minX) {
    return { box: { x: 0, y: 0, w: width, h: height }, core: Math.max(width, height), coreX: width / 2, coreY: height / 2 };
  }
  const pad = 2;
  const box = {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(width, maxX - minX + 1 + pad * 2),
    h: Math.min(height, maxY - minY + 1 + pad * 2),
  };
  if (!solidCount) {
    return { box, core: Math.max(box.w, box.h), coreX: box.x + box.w / 2, coreY: box.y + box.h / 2 };
  }
  const coreX = sx / solidCount;
  const coreY = sy / solidCount;
  const distances = [];
  for (let i = 0; i < solid.length; i += 2) {
    distances.push(Math.hypot(solid[i] - coreX, solid[i + 1] - coreY));
  }
  distances.sort((a, b) => a - b);
  const r80 = distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.8))];
  return { box, core: Math.max(8, r80 * 2), coreX, coreY };
}

async function sprite(path) {
  const img = await loadImage(path);
  Object.assign(img, measureSprite(img));
  return img;
}

const compileRoot = mkdtempSync(join(tmpdir(), "acornaut-hyper-run-crossing-js-"));
const jsOut = join(compileRoot, "js");
const npmCache = join(compileRoot, "npm-cache");
mkdirSync(jsOut, { recursive: true });

try {
  const gameDir = join(root, "illustrated-src", "game");
  const gameFiles = readdirSync(gameDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join("illustrated-src", "game", name));
  const tscArgs = [
    ...gameFiles,
    "--outDir", jsOut,
    "--module", "commonjs",
    "--target", "es2020",
    "--skipLibCheck",
    "--moduleResolution", "node",
    "--declaration", "false",
    "--strict", "false",
    "--noEmitOnError",
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
  const { drawWorld } = require(join(jsOut, "draw.js"));
  const { makeWorld } = require(join(jsOut, "sim.js"));
  const { defaultSave } = require(join(jsOut, "save.js"));
  const raceApi = require(join(jsOut, "race.js"));
  const {
    RACE_GATE_APERTURE,
    RACE_GATE_CLEARANCE,
    RACE_GATE_MISS_FADE_TICKS,
    RACE_GATE_PASS_FADE_TICKS,
    RACE_HEIGHT,
    RACE_HZ,
    RACE_MAX_SPEED,
    RACE_PILOT_RADIUS,
    RACE_PILOT_X,
    RACE_RINGS,
    RACE_WIDTH,
    createRaceState,
    stepRace,
  } = raceApi;

  assert(RACE_PILOT_X === 96, `Review contract requires RACE_PILOT_X=96, got ${RACE_PILOT_X}`);
  assert(RACE_RINGS.length > 0, "Review harness needs at least one authored ring");

  const artRoot = join(root, "docs", "art");
  const [idle, flap, flight, flightBody, flightTail, clearHelmet, sky] = await Promise.all([
    Promise.all(Array.from({ length: 4 }, (_, i) => sprite(join(artRoot, "squirrel", `idle-${i + 1}.png`)))),
    Promise.all(Array.from({ length: 4 }, (_, i) => sprite(join(artRoot, "squirrel", `flap-${i + 1}.png`)))),
    sprite(join(artRoot, "suits", "flight.png")),
    sprite(join(artRoot, "suits", "flight-body.png")),
    sprite(join(artRoot, "suits", "flight-tail.png")),
    sprite(join(artRoot, "helms", "clear.png")),
    loadImage(join(artRoot, "sky.jpg")),
  ]);
  const gateIds = [
    "gate-idle-back", "gate-idle-front",
    "gate-passed-back", "gate-passed-front",
    "gate-missed-back", "gate-missed-front",
  ];
  const hyperRun = Object.fromEntries(await Promise.all(gateIds.map(async (id) => [
    id,
    await sprite(join(artRoot, "hyper-run", `${id}.png`)),
  ])));
  const art = {
    ready: true,
    squirrelIdle: idle,
    squirrelFlap: flap,
    acorn: [], golden: [], shield: [], planets: [], debris: [],
    pals: {}, helms: { clear: clearHelmet }, suits: { flight },
    sky,
    arcadeAcorn: null, frozen: null, shieldnut: null,
    suitTail: { flight: flightTail }, suitBody: { flight: flightBody },
    suitTap: {}, suitTapTail: {}, hyperRun,
  };
  const save = defaultSave();
  save.equippedSuit = "flight";
  save.equipped = "clear";
  save.equippedPal = "none";

  const ringIndex = 0;
  const ring = RACE_RINGS[ringIndex];
  const stepDistance = RACE_MAX_SPEED / RACE_HZ;
  const relativeTicks = [-2, -1, 0, 1, 2];

  function makeScenario(expectedState) {
    const race = createRaceState();
    race.tick = 120;
    race.phase = "normal";
    race.phaseTick = 0;
    race.coursePosition = ring.x - stepDistance * 2;
    race.previousCoursePosition = race.coursePosition;
    race.speed = RACE_MAX_SPEED;
    race.speedGraceTicks = 999;
    race.charge = 0;
    race.y = expectedState === "passed"
      ? ring.y
      : ring.y + RACE_GATE_CLEARANCE + 24 <= RACE_HEIGHT - RACE_PILOT_RADIUS
        ? ring.y + RACE_GATE_CLEARANCE + 24
        : ring.y - RACE_GATE_CLEARANCE - 24;
    race.previousY = race.y;
    race.vy = 0;
    const world = makeWorld(RACE_WIDTH, RACE_HEIGHT);
    world.screen = "play";
    world.ready = false;
    world.flight = "fly";
    world.race = race;
    world.shake = 0;
    world.warpT = 0;
    world.warpLeft = 0;
    world.stars = Array.from({ length: 28 }, (_, i) => ({
      x: (i * 137) % RACE_WIDTH,
      y: (i * 83) % RACE_HEIGHT,
      r: 0.6 + (i % 3) * 0.45,
      a: 0.35 + (i % 5) * 0.1,
      tw: i * 0.7,
    }));
    return { race, world, expectedState };
  }

  function syncWorld({ race, world }) {
    world.squirrel.y = race.y;
    world.squirrel.vy = race.vy;
    world.squirrel.rot = Math.max(-0.48, Math.min(0.72, race.vy / 720));
    world.speed = race.speed;
    world.distance = race.coursePosition;
    world.runAcorns = race.acorns;
    world.time = race.tick / RACE_HZ;
  }

  function snapshot(scenario, relativeTick) {
    const { race, expectedState } = scenario;
    const state = race.ringLedger[ringIndex];
    const decisionTick = race.ringDecisionTicks[ringIndex];
    const fadeAge = decisionTick == null ? null : Math.max(0, race.tick - 1 - decisionTick);
    const fadeDuration = state === "passed"
      ? RACE_GATE_PASS_FADE_TICKS
      : state === "missed"
        ? RACE_GATE_MISS_FADE_TICKS
        : null;
    return {
      expectedState,
      relativeTick,
      nextTick: race.tick,
      completedTick: race.tick - 1,
      coursePosition: race.coursePosition,
      ringScreenX: RACE_PILOT_X + ring.x - race.coursePosition,
      pilotX: RACE_PILOT_X,
      pilotY: race.y,
      ringY: ring.y,
      state,
      decisionTick,
      fadeAge,
      fadeDuration,
      fadeBlend: fadeAge == null || fadeDuration == null ? null : Math.min(1, fadeAge / fadeDuration),
    };
  }

  function renderFrame(scenario, evidence) {
    syncWorld(scenario);
    const canvas = createCanvas(RACE_WIDTH, RACE_HEIGHT);
    const ctx = canvas.getContext("2d");
    drawWorld(ctx, scenario.world, save, art);

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(255,74,221,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(RACE_PILOT_X, 0); ctx.lineTo(RACE_PILOT_X, RACE_HEIGHT); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,215,87,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(RACE_PILOT_X, evidence.pilotY, RACE_PILOT_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(91,230,255,.95)";
    ctx.beginPath(); ctx.arc(evidence.ringScreenX, ring.y, RACE_GATE_APERTURE, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(5,8,18,.88)";
    ctx.fillRect(0, 0, RACE_WIDTH, 100);
    ctx.textAlign = "left";
    ctx.fillStyle = evidence.relativeTick === 0 ? "#fff09a" : "#ffffff";
    ctx.font = "800 14px sans-serif";
    const sign = evidence.relativeTick > 0 ? "+" : "";
    ctx.fillText(`${evidence.expectedState.toUpperCase()}  ${sign}${evidence.relativeTick} TICK`, 10, 19);
    ctx.fillStyle = "#c6d4ec";
    ctx.font = "600 11px monospace";
    ctx.fillText(`step=${evidence.completedTick}  course=${evidence.coursePosition.toFixed(3)}`, 10, 39);
    ctx.fillText(`ringX=${evidence.ringScreenX.toFixed(3)}  pilotPlane=${RACE_PILOT_X}`, 10, 56);
    ctx.fillText(`ledger=${evidence.state}  decision=${evidence.decisionTick ?? "--"}`, 10, 73);
    ctx.fillText(`fadeAge=${evidence.fadeAge ?? "--"}  blend=${evidence.fadeBlend?.toFixed(3) ?? "--"}`, 10, 90);
    ctx.restore();
    return canvas;
  }

  function capture(expectedState) {
    const scenario = makeScenario(expectedState);
    const frames = [];
    const evidence = [];
    for (let i = 0; i < relativeTicks.length; i++) {
      if (i > 0) stepRace(scenario.race);
      const frameEvidence = snapshot(scenario, relativeTicks[i]);
      evidence.push(frameEvidence);
      frames.push(renderFrame(scenario, frameEvidence));
    }

    assert(evidence[0].state === "pending" && evidence[0].decisionTick == null,
      `${expectedState}: -2 frame must be pending`);
    assert(evidence[1].state === "pending" && evidence[1].decisionTick == null,
      `${expectedState}: -1 frame must be pending`);
    assert(evidence[2].state === expectedState,
      `${expectedState}: crossing frame resolved as ${evidence[2].state}`);
    assert(evidence[2].decisionTick === evidence[2].completedTick,
      `${expectedState}: crossing must stamp its pre-increment tick`);
    assert(evidence[2].fadeAge === 0, `${expectedState}: crossing fade must start at age zero`);
    assert(Math.abs(evidence[2].ringScreenX - RACE_PILOT_X) < 1e-9,
      `${expectedState}: crossing ring center must equal pilot plane`);
    assert(evidence[3].state === expectedState && evidence[4].state === expectedState,
      `${expectedState}: decision must remain stable after crossing`);
    assert(evidence[3].decisionTick === evidence[2].decisionTick && evidence[4].decisionTick === evidence[2].decisionTick,
      `${expectedState}: decision tick changed after crossing`);
    assert(evidence[3].fadeAge === 1 && evidence[4].fadeAge === 2,
      `${expectedState}: fade age must advance one fixed tick at a time`);
    return { frames, evidence };
  }

  const pass = capture("passed");
  const miss = capture("missed");
  const sheet = createCanvas(RACE_WIDTH * relativeTicks.length, RACE_HEIGHT * 2);
  const sheetCtx = sheet.getContext("2d");
  pass.frames.forEach((frame, i) => sheetCtx.drawImage(frame, i * RACE_WIDTH, 0));
  miss.frames.forEach((frame, i) => sheetCtx.drawImage(frame, i * RACE_WIDTH, RACE_HEIGHT));
  writeFileSync(stripPath, sheet.toBuffer("image/png"));

  const manifest = {
    generatedFrom: "illustrated-src/game/*.ts via temporary CommonJS compile",
    viewport: [RACE_WIDTH, RACE_HEIGHT],
    pilotPlane: RACE_PILOT_X,
    ringId: ring.id,
    ringIndex,
    stepDistance,
    fadeTicks: { passed: RACE_GATE_PASS_FADE_TICKS, missed: RACE_GATE_MISS_FADE_TICKS },
    offsets: relativeTicks,
    pass: pass.evidence,
    miss: miss.evidence,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outDir, stripPath, manifestPath, assertions: "passed" })}\n`);
} finally {
  rmSync(compileRoot, { recursive: true, force: true });
}
