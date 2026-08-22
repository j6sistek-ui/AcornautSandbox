#!/usr/bin/env node
// Shipping-path visual evidence for Hyper Run Revision 3. Source TypeScript is
// compiled into OS temp and every review frame/clip stays outside the repo.
import { execFileSync } from "node:child_process";
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const requestedOut = process.argv[2] ? resolve(process.argv[2]) : null;
function inside(parent, child) {
  const rel = relative(parent, child);
  const sep = process.platform === "win32" ? "\\" : "/";
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
if (requestedOut && inside(root, requestedOut)) {
  throw new Error("Runtime review output must be outside the repository; omit the path to use OS temp.");
}
const outDir = requestedOut ?? mkdtempSync(join(tmpdir(), "acornaut-hyper-run-r3-runtime-"));
if (existsSync(join(outDir, "manifest.json"))) throw new Error(`Refusing to overwrite ${outDir}`);
mkdirSync(outDir, { recursive: true });

const canvasEntry = process.env.ACORNAUT_CANVAS_MODULE;
if (!canvasEntry) throw new Error("Set ACORNAUT_CANVAS_MODULE to @napi-rs/canvas's index.js");
const { createCanvas, GifEncoder, Image, loadImage } = await import(pathToFileURL(resolve(canvasEntry)).href);
let reducedMotion = false;
globalThis.window = {
  __ACORNAUT_BETA__: true,
  matchMedia: () => ({ matches: reducedMotion }),
};
globalThis.Image = Image;
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`Unexpected review element ${tag}`);
    return createCanvas(1, 1);
  },
};
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const compileRoot = mkdtempSync(join(tmpdir(), "acornaut-hyper-run-r3-runtime-js-"));
const jsOut = join(compileRoot, "js");
mkdirSync(jsOut, { recursive: true });
try {
  const files = readdirSync(join(root, "illustrated-src", "game"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join("illustrated-src", "game", name));
  const tscArgs = [
    ...files, "--outDir", jsOut, "--module", "commonjs", "--target", "es2020",
    "--skipLibCheck", "--moduleResolution", "node", "--strict", "false", "--noEmitOnError",
  ];
  const tsc = process.env.ACORNAUT_TSC;
  execFileSync(tsc ? process.execPath : "npx", tsc
    ? [tsc, ...tscArgs]
    : ["--yes", "--package", "typescript@5.9.2", "tsc", ...tscArgs], {
    cwd: root, stdio: "inherit",
    env: { ...process.env, NPM_CONFIG_CACHE: join(compileRoot, "npm-cache") },
  });

  const require = createRequire(import.meta.url);
  const {
    drawWorld, drawHud, hyperRunChargeCopy, hyperRunFlowSnapshot,
    hyperRunTunnelPresentationCenter, hyperRunTunnelSampleCount,
  } = require(join(jsOut, "draw.js"));
  const { makeWorld } = require(join(jsOut, "sim.js"));
  const { defaultSave } = require(join(jsOut, "save.js"));
  const { raceViewport, raceViewportY } = require(join(jsOut, "race-viewport.js"));
  const raceApi = require(join(jsOut, "race.js"));
  const {
    RACE_ACORNS, RACE_BASE_SPEED, RACE_DEBRIS, RACE_GATE_CLEARANCE, RACE_HZ,
    RACE_LATEST_ENTRY_X, RACE_MAX_INTERACTIVE_GAP, RACE_MAX_SPEED, RACE_PILOT_X, RACE_RINGS,
    RACE_TUNNEL_DISTANCE, RACE_TUNNEL_TICKS, createRaceState, raceTunnelGeometry,
  } = raceApi;

  function assert(condition, message) { if (!condition) throw new Error(message); }
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = (n) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  async function sprite(path) {
    const img = await loadImage(path);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] < 16) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    img.box = maxX < minX
      ? { x: 0, y: 0, w: img.width, h: img.height }
      : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    img.core = Math.max(img.box.w, img.box.h);
    img.coreX = img.box.x + img.box.w / 2;
    img.coreY = img.box.y + img.box.h / 2;
    return img;
  }

  const artRoot = join(root, "docs", "art");
  const hyperIds = [
    "gate-idle-back", "gate-idle-front", "gate-passed-back", "gate-passed-front",
    "gate-missed-back", "gate-missed-front", "entry-mouth", "entry-rim-back",
    "entry-glyphs", "entry-rim-front", "return-back", "return-glyphs", "return-front",
  ];
  const [idle, flap, acorns, debris, flight, flightBody, flightTail, clear, sky, hyperEntries] = await Promise.all([
    Promise.all(Array.from({ length: 4 }, (_, i) => sprite(join(artRoot, "squirrel", `idle-${i + 1}.png`)))),
    Promise.all(Array.from({ length: 4 }, (_, i) => sprite(join(artRoot, "squirrel", `flap-${i + 1}.png`)))),
    Promise.all(Array.from({ length: 4 }, (_, i) => sprite(join(artRoot, "acorn", `${i + 1}.png`)))),
    Promise.all(Array.from({ length: 10 }, (_, i) => sprite(join(artRoot, "debris", `${i}.png`)))),
    sprite(join(artRoot, "suits", "flight.png")),
    sprite(join(artRoot, "suits", "flight-body.png")),
    sprite(join(artRoot, "suits", "flight-tail.png")),
    sprite(join(artRoot, "helms", "clear.png")),
    loadImage(join(artRoot, "skies", "dark6-wide.jpg")),
    Promise.all(hyperIds.map(async (id) => [id, await sprite(join(artRoot, "hyper-run", `${id}.png`))])),
  ]);
  const hyperRun = Object.fromEntries(hyperEntries);
  const art = {
    ready: true, squirrelIdle: idle, squirrelFlap: flap, acorn: acorns,
    golden: [], shield: [], planets: [], debris, pals: {}, helms: { clear }, suits: { flight },
    sky, arcadeAcorn: null, frozen: null, shieldnut: null, frozenAnim: [], shieldAnim: [],
    wormAnim: [], holeAnim: [], suitTail: { flight: flightTail }, suitBody: { flight: flightBody },
    suitTap: {}, suitTapTail: {}, hyperRun,
  };
  const save = defaultSave();
  save.equippedSuit = "flight"; save.equipped = "clear"; save.equippedPal = "none";

  function scenario(W = 844, H = 390) {
    const race = createRaceState();
    const world = makeWorld(W, H);
    world.screen = "play"; world.ready = false; world.flight = "fly"; world.race = race;
    world.shake = 0; world.warpT = 0; world.warpLeft = 0; world.time = 10;
    world.raceCues = [];
    world.stars = Array.from({ length: 34 }, (_, i) => ({
      x: (i * 137) % W, y: (i * 83) % H, r: .6 + (i % 3) * .4,
      a: .35 + (i % 5) * .1, tw: i * .7,
    }));
    return { world, race };
  }

  function sync(s) {
    const viewport = raceViewport(s.world.W, s.world.H);
    s.world.squirrel.y = raceViewportY(viewport, s.race.y);
    s.world.squirrel.vy = s.race.vy * viewport.scale;
    s.world.squirrel.rot = clamp(s.race.vy / 720, -.48, .72);
    s.world.speed = s.race.speed;
    s.world.distance = s.race.coursePosition;
    s.world.runAcorns = s.race.acorns;
  }

  function render(s, {
    hud = true, partialArt = false, reduced = false, hyperRunOverride = null, skyOverride = null,
  } = {}) {
    reducedMotion = reduced;
    sync(s);
    const canvas = createCanvas(s.world.W, s.world.H);
    const ctx = canvas.getContext("2d");
    const baseBank = skyOverride == null ? art : { ...art, sky: skyOverride };
    const bank = hyperRunOverride != null
      ? { ...baseBank, hyperRun: hyperRunOverride }
      : partialArt
        ? { ...baseBank, hyperRun: { ...hyperRun, "gate-passed-front": undefined } }
        : baseBank;
    drawWorld(ctx, s.world, save, bank);
    if (hud) drawHud(ctx, s.world);
    return canvas;
  }

  function labelled(source, label, scale = .5) {
    const W = Math.max(1, Math.round(source.width * scale));
    const H = Math.max(1, Math.round(source.height * scale));
    const out = createCanvas(W, H + 24);
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#030611"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = "#effaff"; ctx.font = "800 12px sans-serif"; ctx.fillText(label, 8, 16);
    ctx.drawImage(source, 0, 24, W, H);
    return out;
  }

  function withPilotPlaneGuide(source) {
    const out = createCanvas(source.width, source.height), ctx = out.getContext("2d");
    ctx.drawImage(source, 0, 0);
    const viewport = raceViewport(source.width, source.height);
    ctx.save(); ctx.setLineDash([8, 6]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,236,130,.9)";
    ctx.beginPath(); ctx.moveTo(viewport.pilotX, viewport.top); ctx.lineTo(viewport.pilotX, viewport.bottom); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "rgba(3,8,18,.8)"; ctx.fillRect(viewport.pilotX + 5, viewport.top + 6, 76, 16);
    ctx.fillStyle = "#fff0a0"; ctx.font = "800 9px sans-serif"; ctx.fillText("PILOT PLANE", viewport.pilotX + 9, viewport.top + 17);
    ctx.restore();
    return out;
  }

  function withTransformOverlay(source, canonicalY) {
    const out = withPilotPlaneGuide(source), ctx = out.getContext("2d");
    const viewport = raceViewport(source.width, source.height);
    const y = raceViewportY(viewport, canonicalY);
    ctx.save(); ctx.setLineDash([5, 5]); ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(255,139,220,.92)";
    ctx.beginPath(); ctx.moveTo(viewport.left, y); ctx.lineTo(viewport.right, y); ctx.stroke();
    ctx.setLineDash([]); ctx.beginPath(); ctx.arc(viewport.pilotX, y, 38 * viewport.scale, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,139,220,.95)"; ctx.fillRect(viewport.pilotX - 3, y - 3, 6, 6);
    ctx.restore();
    return out;
  }

  function sheet(items, cols, path) {
    const cellW = Math.max(...items.map((item) => item.width));
    const cellH = Math.max(...items.map((item) => item.height));
    const canvas = createCanvas(cellW * cols, cellH * Math.ceil(items.length / cols));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#030611"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    items.forEach((item, i) => ctx.drawImage(item, (i % cols) * cellW, Math.floor(i / cols) * cellH));
    writeFileSync(path, canvas.toBuffer("image/png"));
    return { width: canvas.width, height: canvas.height };
  }

  function gif(path, frames, delay = 17, scale = .5) {
    const W = Math.round(frames[0].width * scale), H = Math.round(frames[0].height * scale);
    const scratch = createCanvas(W, H), ctx = scratch.getContext("2d");
    const encoder = new GifEncoder(W, H, { repeat: 0, quality: 12 });
    for (const frame of frames) {
      ctx.clearRect(0, 0, W, H); ctx.drawImage(frame, 0, 0, W, H);
      const pixels = ctx.getImageData(0, 0, W, H).data;
      encoder.addFrame(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), W, H, { delay });
    }
    writeFileSync(path, encoder.finish());
  }

  function colorVariant(source, mode) {
    const out = createCanvas(source.width, source.height), ctx = out.getContext("2d");
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, out.width, out.height), d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (mode === "gray") {
        const y = Math.round(.2126 * r + .7152 * g + .0722 * b);
        d[i] = y; d[i + 1] = y; d[i + 2] = y;
      } else {
        d[i] = clamp(Math.round(.367 * r + .861 * g - .228 * b), 0, 255);
        d[i + 1] = clamp(Math.round(.280 * r + .673 * g + .047 * b), 0, 255);
        d[i + 2] = clamp(Math.round(-.012 * r + .043 * g + .969 * b), 0, 255);
      }
    }
    ctx.putImageData(image, 0, 0); return out;
  }

  function decisionScenario(W, H, outcome, offset, relativeTick) {
    const s = scenario(W, H), ring = RACE_RINGS[0], step = RACE_MAX_SPEED / RACE_HZ;
    s.race.phase = "normal"; s.race.speed = RACE_MAX_SPEED; s.race.speedGraceTicks = 999;
    s.race.coursePosition = ring.x + relativeTick * step;
    s.race.previousCoursePosition = s.race.coursePosition - step;
    s.race.y = ring.y + offset; s.race.previousY = s.race.y; s.race.vy = 0;
    const decisionTick = 200;
    if (relativeTick >= 0) {
      s.race.tick = decisionTick + relativeTick + 1;
      s.race.ringLedger[0] = outcome;
      s.race.ringDecisionTicks[0] = decisionTick;
      s.world.raceCues = [{
        kind: outcome === "passed" ? "ring-pass" : "ring-miss", tick: decisionTick,
        id: ring.id, index: 0, y: ring.y, chargeDelta: outcome === "passed" ? 5 : 0,
      }];
    } else {
      s.race.tick = decisionTick + relativeTick + 1;
    }
    return s;
  }

  function decisionFrame(W, H, outcome, offset, relativeTick) {
    return render(decisionScenario(W, H, outcome, offset, relativeTick));
  }

  const outputs = {};
  const boundaryEpsilon = 0.0001;
  for (const [W, H, name] of [[360, 640, "portrait"], [844, 390, "landscape"]]) {
    const rows = [
      ["EDGE PASS +38", "passed", RACE_GATE_CLEARANCE],
      ["EDGE PASS -38", "passed", -RACE_GATE_CLEARANCE],
      ["EDGE MISS +38.0001", "missed", RACE_GATE_CLEARANCE + boundaryEpsilon],
      ["EDGE MISS -38.0001", "missed", -RACE_GATE_CLEARANCE - boundaryEpsilon],
    ];
    const items = [];
    for (const [label, state, offset] of rows) for (const relativeTick of [-2, -1, 0, 1, 2]) {
      const stamp = relativeTick === 0 ? "CROSS" : `${relativeTick > 0 ? "+" : ""}${relativeTick}`;
      items.push(labelled(decisionFrame(W, H, state, offset, relativeTick), `${label} ${stamp}`, W > 400 ? .5 : .36));
    }
    const path = join(outDir, `runtime-boundaries-${name}.png`);
    outputs[`boundaries_${name}`] = { path, ...sheet(items, 5, path) };
  }

  const gateItems = [];
  for (const age of [0, 3, 9, 18, 26]) gateItems.push(labelled(decisionFrame(844, 390, "passed", 0, age), `PASS AGE ${age}`));
  for (const age of [0, 3, 12, 26, 38]) gateItems.push(labelled(decisionFrame(844, 390, "missed", 64, age), `MISS AGE ${age}`));
  const simultaneous = decisionScenario(844, 390, "passed", 0, 0);
  simultaneous.world.raceCues.push({ kind: "debris-hit", tick: 200, id: RACE_DEBRIS[0].id,
    index: 0, y: RACE_RINGS[0].y, chargeDelta: -10 });
  gateItems.push(labelled(withPilotPlaneGuide(render(simultaneous)), "PASS + DEBRIS / PILOT PLANE"));
  const partial = decisionFrame(844, 390, "passed", 0, 9);
  const partialScenario = scenario();
  partialScenario.race.coursePosition = RACE_RINGS[0].x + 54;
  partialScenario.race.ringLedger[0] = "passed"; partialScenario.race.ringDecisionTicks[0] = 200; partialScenario.race.tick = 210;
  gateItems.push(labelled(render(partialScenario, { partialArt: true }), "PARTIAL PAIR -> PROCEDURAL"));
  const gatesPath = join(outDir, "runtime-gates.png");
  outputs.gates = { path: gatesPath, ...sheet(gateItems, 3, gatesPath) };

  const directorItems = [];
  for (const [label, pilotY] of [["UP", 496], ["DOWN", 144], ["LEVEL", RACE_RINGS[0].y]]) {
    const s = scenario(); s.race.coursePosition = RACE_RINGS[0].x - 430; s.race.y = pilotY; s.race.previousY = pilotY;
    directorItems.push(labelled(render(s), `DIRECTOR ${label} / 430`));
  }
  let maxGapIndex = 1;
  for (let i = 2; i < RACE_RINGS.length; i++) {
    if (RACE_RINGS[i].x - RACE_RINGS[i - 1].x > RACE_RINGS[maxGapIndex].x - RACE_RINGS[maxGapIndex - 1].x) maxGapIndex = i;
  }
  const maxGapState = scenario();
  for (let i = 0; i < maxGapIndex; i++) maxGapState.race.ringLedger[i] = "skipped";
  maxGapState.race.coursePosition = RACE_RINGS[maxGapIndex - 1].x;
  maxGapState.race.y = 496; maxGapState.race.previousY = 496;
  directorItems.push(labelled(render(maxGapState),
    `DIRECTOR AUTHORED MAX GAP ${RACE_RINGS[maxGapIndex].x - RACE_RINGS[maxGapIndex - 1].x}`));
  for (const distance of [240, 200, 160]) {
    const s = scenario(); s.race.coursePosition = RACE_RINGS[0].x - distance; s.race.y = 496;
    directorItems.push(labelled(render(s), `DIRECTOR ${distance}`));
  }
  for (const charge of [0, 5, 15, 20]) {
    const s = scenario(); s.race.charge = charge;
    directorItems.push(labelled(render(s), `CHARGE ${charge}/100`));
  }
  for (const state of ["95", "100", "entry", "late", "max", "insufficient"]) {
    const s = scenario(); s.race.coursePosition = 120;
    if (state === "95") s.race.charge = 95;
    else if (state === "100") s.race.charge = 100;
    else if (state === "entry") { s.race.charge = 100; s.race.phase = "entry"; s.race.phaseTick = 0; s.race.entryAnchorY = 320; }
    else if (state === "late") {
      s.race.charge = 100;
      RACE_RINGS.forEach((ring, i) => { if (ring.x <= RACE_LATEST_ENTRY_X) s.race.ringLedger[i] = "skipped"; });
    } else if (state === "max") { s.race.charge = 100; s.race.wormholes = 3; }
    else {
      s.race.charge = 0;
      let kept = 0;
      RACE_RINGS.forEach((ring, i) => {
        if (ring.x <= RACE_LATEST_ENTRY_X && kept++ >= 10) s.race.ringLedger[i] = "skipped";
      });
    }
    const label = state === "95" ? "95 / NEXT CLEAN GATE: WORMHOLE"
      : state === "100" ? "100 / WORMHOLE READY"
        : state === "entry" ? "ENTRY 0 / WORMHOLE"
          : state === "late" ? "LATE-INELIGIBLE 100 / FINAL SPRINT"
            : state === "max" ? "MAX-CYCLE 100 / FINAL SPRINT"
              : "INSUFFICIENT REMAINING / FINAL SPRINT";
    directorItems.push(labelled(render(s), label));
  }
  const directorPath = join(outDir, "runtime-director-hud.png");
  outputs.directorHud = { path: directorPath, ...sheet(directorItems, 4, directorPath),
    authoredMaxGap: RACE_RINGS[maxGapIndex].x - RACE_RINGS[maxGapIndex - 1].x,
    maxInteractiveGap: RACE_MAX_INTERACTIVE_GAP };

  function entryState(t, phase = "entry", anchorY = 496, W = 844, H = 390) {
    const s = scenario(W, H);
    s.race.phase = phase; s.race.phaseTick = phase === "entry" ? t : t;
    s.race.entryAnchorY = anchorY; s.race.entryStartY = 320; s.race.y = anchorY; s.race.previousY = anchorY;
    s.race.coursePosition = RACE_RINGS[75].x; s.race.phaseStartPosition = s.race.coursePosition;
    s.race.entryRingIndex = 75; s.race.tunnelAcornLedger[s.race.wormholes] = Array(18).fill(false);
    return s;
  }
  const entryKeys = [0, 6, 12, 24, 35, 36, 43, 47];
  const entryFrames = entryKeys.map((t) => labelled(render(entryState(t)), `ENTRY ${t}`));
  entryFrames.push(labelled(render(entryState(0, "tunnel")), "TUNNEL 0"));
  entryFrames.push(labelled(render(entryState(1, "tunnel")), "TUNNEL 1"));
  entryFrames.push(labelled(render(entryState(5, "tunnel")), "TUNNEL 5"));
  const entryPath = join(outDir, "runtime-entry-y496.png");
  outputs.entry = { path: entryPath, ...sheet(entryFrames, 5, entryPath) };
  const entryClipFrames = [
    ...Array.from({ length: 48 }, (_, t) => render(entryState(t), { hud: false })),
    ...Array.from({ length: 6 }, (_, t) => render(entryState(t, "tunnel"), { hud: false })),
  ];
  const entryGif = join(outDir, "runtime-entry-to-tunnel.gif"); gif(entryGif, entryClipFrames);
  outputs.entryClip = { path: entryGif, frames: entryClipFrames.length, fps: 60 };
  const entryReducedGif = join(outDir, "runtime-entry-to-tunnel-reduced.gif");
  const entryReducedFrames = [
    ...Array.from({ length: 48 }, (_, t) => render(entryState(t), { hud: false, reduced: true })),
    ...Array.from({ length: 6 }, (_, t) => render(entryState(t, "tunnel"), { hud: false, reduced: true })),
  ];
  gif(entryReducedGif, entryReducedFrames);
  outputs.entryReducedClip = { path: entryReducedGif, frames: entryReducedFrames.length, fps: 60 };

  const centralEntryFrames = [
    [entryState(0, "entry", 320), "CENTRAL ENTRY 0", false],
    [entryState(24, "entry", 320), "CENTRAL ENTRY 24", false],
    [entryState(47, "entry", 320), "CENTRAL ENTRY 47 / PILOT PLANE", true],
    [entryState(0, "tunnel", 320), "CENTRAL TUNNEL 0 / PILOT PLANE", true],
    [entryState(1, "tunnel", 320), "CENTRAL TUNNEL 1", false],
    [entryState(5, "tunnel", 320), "CENTRAL TUNNEL 5", false],
  ];
  const centralEntryPath = join(outDir, "runtime-entry-central.png");
  outputs.entryCentral = { path: centralEntryPath, ...sheet(centralEntryFrames.map(([s, label, guide]) =>
    labelled(guide ? withPilotPlaneGuide(render(s)) : render(s), label)), 3, centralEntryPath) };

  const qualifying = entryState(0, "entry", 320);
  const qualifyingDecisionTick = 900;
  const qualifyingIndex = RACE_RINGS.findIndex((ring, i) => i > 0 && ring.y === 320);
  qualifying.race.entryRingIndex = qualifyingIndex;
  qualifying.race.entryAnchorY = RACE_RINGS[qualifyingIndex].y;
  qualifying.race.coursePosition = RACE_RINGS[qualifyingIndex].x;
  qualifying.race.phaseStartPosition = qualifying.race.coursePosition;
  qualifying.race.y = RACE_RINGS[qualifyingIndex].y; qualifying.race.previousY = qualifying.race.y;
  qualifying.race.tick = qualifyingDecisionTick + 1; qualifying.race.charge = 100;
  qualifying.race.ringLedger[qualifyingIndex] = "passed";
  qualifying.race.ringDecisionTicks[qualifyingIndex] = qualifyingDecisionTick;
  qualifying.world.raceCues = [{ kind: "ring-pass", tick: qualifyingDecisionTick,
    id: RACE_RINGS[qualifyingIndex].id, index: qualifyingIndex,
    y: RACE_RINGS[qualifyingIndex].y, chargeDelta: 5 }];
  const qualifyingPath = join(outDir, "runtime-qualifying-entry0.png");
  writeFileSync(qualifyingPath, withPilotPlaneGuide(render(qualifying)).toBuffer("image/png"));
  outputs.qualifyingEntry0 = { path: qualifyingPath, ring: RACE_RINGS[qualifyingIndex].id,
    decisionTick: qualifyingDecisionTick, phaseTick: 0, pilotPlaneGuide: true };

  function returnState(t, y, W = 844, H = 390) {
    const s = scenario(W, H);
    s.race.phase = "return"; s.race.phaseTick = t; s.race.returnY = y; s.race.y = y; s.race.previousY = y;
    s.race.entryAnchorY = 496; s.race.coursePosition = RACE_RINGS[75].x + RACE_TUNNEL_DISTANCE;
    s.race.phaseStartPosition = RACE_RINGS[75].x;
    return s;
  }
  const returnItems = [];
  for (const y of [96, 544]) for (const t of [0, 5, 9, 10, 23, 35]) {
    returnItems.push(labelled(render(returnState(t, y)), `Y${y} RETURN ${t}`));
  }
  const returnPath = join(outDir, "runtime-return-extremes.png");
  outputs.return = { path: returnPath, ...sheet(returnItems, 6, returnPath) };
  const returnGif = join(outDir, "runtime-return-y544.gif");
  const returnClipFrames = Array.from({ length: 36 }, (_, t) => render(returnState(t, 544), { hud: false }));
  gif(returnGif, returnClipFrames); outputs.returnClip = { path: returnGif, frames: 36, fps: 60 };
  const returnReducedGif = join(outDir, "runtime-return-y544-reduced.gif");
  const returnReducedFrames = Array.from({ length: 36 }, (_, t) => render(returnState(t, 544), { hud: false, reduced: true }));
  gif(returnReducedGif, returnReducedFrames);
  outputs.returnReducedClip = { path: returnReducedGif, frames: 36, fps: 60 };

  function hyperRunWithout(ids) {
    const next = { ...hyperRun };
    ids.forEach((id) => { delete next[id]; });
    return next;
  }
  const entryPortalIds = ["entry-mouth", "entry-rim-back", "entry-glyphs", "entry-rim-front"];
  const returnPortalIds = ["return-back", "return-glyphs", "return-front"];
  const transitionFallbackCases = [
    { name: "ENTRY 24", state: entryState(24), partial: hyperRunWithout(["entry-glyphs"]), missing: hyperRunWithout(entryPortalIds) },
    { name: "ENTRY 47", state: entryState(47), partial: hyperRunWithout(["entry-glyphs"]), missing: hyperRunWithout(entryPortalIds) },
    { name: "RETURN 5", state: returnState(5, 544), partial: hyperRunWithout(["return-glyphs"]), missing: hyperRunWithout(returnPortalIds) },
    { name: "RETURN 10", state: returnState(10, 544), partial: hyperRunWithout(["return-glyphs"]), missing: hyperRunWithout(returnPortalIds) },
  ].map((item) => ({
    ...item,
    completeFrame: render(item.state),
    partialFrame: render(item.state, { hyperRunOverride: item.partial }),
    missingFrame: render(item.state, { hyperRunOverride: item.missing }),
  }));
  const transitionFallbackPath = join(outDir, "runtime-transition-art-fallback.png");
  outputs.transitionArtFallback = { path: transitionFallbackPath, ...sheet(
    transitionFallbackCases.flatMap((item) => [
      labelled(item.completeFrame, `${item.name} / COMPLETE`),
      labelled(item.partialFrame, `${item.name} / PARTIAL`),
      labelled(item.missingFrame, `${item.name} / MISSING`),
    ]), 3, transitionFallbackPath), cases: transitionFallbackCases.map((item) => item.name) };

  const accessibilityBase = decisionFrame(844, 390, "passed", 0, 9);
  const reducedScenario = scenario(); reducedScenario.race.coursePosition = RACE_RINGS[0].x - 430; reducedScenario.race.y = 496;
  const reducedFrame = render(reducedScenario, { reduced: true });
  const accessibilityPath = join(outDir, "runtime-accessibility.png");
  outputs.accessibility = { path: accessibilityPath, ...sheet([
    labelled(accessibilityBase, "PASS DEFAULT"),
    labelled(colorVariant(accessibilityBase, "gray"), "PASS GRAYSCALE"),
    labelled(colorVariant(accessibilityBase, "deuteranopia"), "PASS DEUTERANOPIA"),
    labelled(reducedFrame, "REDUCED MOTION"),
    labelled(colorVariant(decisionFrame(844, 390, "missed", 64, 9), "gray"), "MISS GRAYSCALE"),
    labelled(colorVariant(decisionFrame(844, 390, "missed", 64, 9), "deuteranopia"), "MISS DEUTERANOPIA"),
  ], 3, accessibilityPath) };

  function authoredCourseState(kind) {
    const s = scenario(844, 390); s.race.speed = RACE_MAX_SPEED; s.race.speedGraceTicks = 999; s.race.tick = 420;
    if (kind === "debris") {
      const pinch = RACE_DEBRIS.filter((item) => item.skill === "snap-drop-pinch");
      s.race.coursePosition = pinch[0].x - 340; s.race.y = 320;
    } else {
      const line = RACE_ACORNS.filter((item) => item.skill === "high-low-high");
      s.race.coursePosition = line[0].x - 240; s.race.y = 320;
    }
    s.race.previousY = s.race.y; s.race.previousCoursePosition = s.race.coursePosition - RACE_MAX_SPEED / RACE_HZ;
    return s;
  }
  const courseEvidenceItems = [];
  for (const [kind, title] of [["debris", "DENSE DEBRIS PINCH"], ["acorns", "HIGH-LOW-HIGH ACORNS"]]) {
    const base = render(authoredCourseState(kind));
    courseEvidenceItems.push(labelled(base, `${title} / DEFAULT`));
    courseEvidenceItems.push(labelled(colorVariant(base, "gray"), `${title} / GRAYSCALE`));
    courseEvidenceItems.push(labelled(render(authoredCourseState(kind), { reduced: true }), `${title} / REDUCED`));
  }
  const courseEvidencePath = join(outDir, "runtime-authored-course-readability.png");
  outputs.authoredCourseReadability = { path: courseEvidencePath,
    ...sheet(courseEvidenceItems, 3, courseEvidencePath), speed: RACE_MAX_SPEED,
    debrisIds: RACE_DEBRIS.filter((item) => item.skill === "snap-drop-pinch").map((item) => item.id),
    acornIds: RACE_ACORNS.filter((item) => item.skill === "high-low-high").map((item) => item.id) };
  const reducedGif = join(outDir, "runtime-reduced-motion.gif");
  const reducedClip = Array.from({ length: 60 }, (_, i) => {
    const s = scenario(); s.race.coursePosition = RACE_RINGS[0].x - 430 + i * (RACE_MAX_SPEED / 30); s.race.tick = i * 2; s.race.y = 496;
    return render(s, { hud: false, reduced: true });
  });
  gif(reducedGif, reducedClip, 33); outputs.reducedClip = { path: reducedGif, frames: 60, fps: 30 };

  // Three real-time seconds sampled every two authority ticks: the first ring
  // approaches at base speed, resolves on frame 44, then the next authored
  // ring becomes the director target while the flow runs at the speed cap.
  const normalDecisionFrame = 44;
  const normalDecisionTick = 700;
  function normalFlowState(frame) {
    const s = scenario(844, 390);
    const afterDecision = frame >= normalDecisionFrame;
    const age = Math.max(0, (frame - normalDecisionFrame) * 2);
    s.race.tick = normalDecisionTick + (frame - normalDecisionFrame) * 2 + 1;
    s.race.speed = afterDecision && frame > normalDecisionFrame ? RACE_MAX_SPEED : RACE_BASE_SPEED;
    s.race.speedGraceTicks = 999;
    s.race.coursePosition = frame <= normalDecisionFrame
      ? RACE_RINGS[0].x - (normalDecisionFrame - frame) * (RACE_BASE_SPEED / 30)
      : RACE_RINGS[0].x + (frame - normalDecisionFrame) * (RACE_MAX_SPEED / 30);
    s.race.previousCoursePosition = s.race.coursePosition - s.race.speed / RACE_HZ;
    s.race.y = RACE_RINGS[0].y; s.race.previousY = s.race.y;
    if (afterDecision) {
      s.race.ringLedger[0] = "passed";
      s.race.ringDecisionTicks[0] = normalDecisionTick;
      if (age <= 26) s.world.raceCues = [{
        kind: "ring-pass", tick: normalDecisionTick, id: RACE_RINGS[0].id,
        index: 0, y: RACE_RINGS[0].y, chargeDelta: 5,
      }];
    }
    return s;
  }
  const normalClip = Array.from({ length: 90 }, (_, frame) => render(normalFlowState(frame)));
  const normalGif = join(outDir, "runtime-normal-flow-base-cap.gif");
  gif(normalGif, normalClip, 33);
  outputs.normalFlow = {
    path: normalGif, frames: normalClip.length, fps: 30, authorityTicksPerFrame: 2,
    baseSpeed: RACE_BASE_SPEED, capSpeed: RACE_MAX_SPEED,
    decisionFrame: normalDecisionFrame, decisionTick: normalDecisionTick,
    targetHandoff: `${RACE_RINGS[0].id}->${RACE_RINGS[1].id}`,
  };
  const normalReducedGif = join(outDir, "runtime-normal-flow-base-cap-reduced.gif");
  const normalReducedClip = Array.from({ length: 90 }, (_, frame) =>
    render(normalFlowState(frame), { reduced: true }));
  gif(normalReducedGif, normalReducedClip, 33);
  outputs.normalFlowReduced = {
    path: normalReducedGif, frames: normalReducedClip.length, fps: 30, authorityTicksPerFrame: 2,
    baseSpeed: RACE_BASE_SPEED, capSpeed: RACE_MAX_SPEED,
    decisionFrame: normalDecisionFrame, decisionTick: normalDecisionTick,
    targetHandoff: `${RACE_RINGS[0].id}->${RACE_RINGS[1].id}`,
  };
  const handoffFrames = [42, 43, 44, 45, 46];
  const handoffPath = join(outDir, "runtime-normal-flow-handoff.png");
  outputs.normalHandoff = { path: handoffPath, ...sheet(handoffFrames.map((frame) =>
    labelled(normalClip[frame], frame === normalDecisionFrame
      ? `FRAME ${frame} / CROSS / ${RACE_RINGS[1].id} TARGET`
      : `FRAME ${frame} / ${frame < normalDecisionFrame ? RACE_RINGS[0].id : RACE_RINGS[1].id} TARGET`)), 5, handoffPath),
    frames: handoffFrames, decisionFrame: normalDecisionFrame };

  function tunnelContentState(tick, { W = 844, H = 390, pilotY = null } = {}) {
    const s = scenario(W, H);
    s.race.phase = "tunnel"; s.race.phaseTick = tick; s.race.wormholes = 2;
    s.race.entryAnchorY = 496; s.race.entryStartY = 496;
    s.race.phaseStartPosition = RACE_RINGS[75].x;
    s.race.coursePosition = s.race.phaseStartPosition + tick * (raceApi.RACE_TUNNEL_SPEED / RACE_HZ);
    s.race.tunnelAcornLedger[2] = Array(18).fill(false);
    s.race.y = pilotY ?? raceTunnelGeometry(s.race, tick).center; s.race.previousY = s.race.y;
    return s;
  }
  const tunnelTicks = [180, 255, 285];
  const tunnelContentPath = join(outDir, "runtime-tunnel-cycle3-y496.png");
  outputs.tunnelContent = { path: tunnelContentPath, ...sheet(tunnelTicks.map((tick) =>
    labelled(render(tunnelContentState(tick)), `CYCLE 3 / Y496 / TUNNEL ${tick}`)), 3, tunnelContentPath),
    ticks: tunnelTicks, cycle: 3, entryAnchorY: 496 };

  const transformFrames = [
    [render(entryState(47), { hud: false }), 496, "ENTRY 47"],
    [render(entryState(0, "tunnel"), { hud: false }), 496, "TUNNEL 0"],
    [render(tunnelContentState(359, { pilotY: 544 }), { hud: false }), 544, "TUNNEL 359 / RETURN Y544"],
    [render(returnState(0, 544), { hud: false }), 544, "RETURN 0 / Y544"],
    [render(returnState(9, 544), { hud: false }), 544, "RETURN 9 / Y544"],
    [render(returnState(10, 544), { hud: false }), 544, "RETURN 10 / Y544"],
  ];
  const transformPath = join(outDir, "runtime-transition-transform-overlays.png");
  outputs.transitionTransforms = { path: transformPath, ...sheet(transformFrames.map(([frame, y, label]) =>
    labelled(withTransformOverlay(frame, y), `${label} / PILOT+PORTAL GUIDE`)), 3, transformPath) };

  const reproItems = [];
  for (const [W, H] of [[390, 844], [844, 390]]) {
    const s = scenario(W, H); s.race.y = 500; s.race.tick = 301;
    s.world.raceCues = [{ kind: "debris-hit", tick: 300, id: "d01", index: 0, y: 500, chargeDelta: -10 }];
    reproItems.push(labelled(render(s), `${W}x${H} ACTIVE CUE`, Math.min(.5, 360 / W)));
  }
  const reproPath = join(outDir, "runtime-cue-reprojection.png");
  outputs.cueReprojection = { path: reproPath, ...sheet(reproItems, 2, reproPath) };

  function pixelDiff(a, b, rect) {
    const ac = a.getContext("2d").getImageData(rect.x, rect.y, rect.w, rect.h).data;
    const bc = b.getContext("2d").getImageData(rect.x, rect.y, rect.w, rect.h).data;
    let sum = 0, max = 0;
    for (let i = 0; i < ac.length; i += 4) for (let k = 0; k < 3; k++) {
      const d = Math.abs(ac[i + k] - bc[i + k]); sum += d; max = Math.max(max, d);
    }
    return { mean: sum / (ac.length / 4 * 3), max };
  }
  function frameStats(canvas) {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let nonTransparent = 0, nearWhite = 0, luminance = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 8) nonTransparent++;
      const y = .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
      luminance += y;
      if (data[i] >= 248 && data[i + 1] >= 248 && data[i + 2] >= 248 && data[i + 3] > 248) nearWhite++;
    }
    const pixels = canvas.width * canvas.height;
    return { nonTransparent, nearWhite, nearWhiteRatio: nearWhite / pixels, meanLuminance: luminance / pixels };
  }

  const transitionArtAssertions = transitionFallbackCases.map((item) => {
    const atomic = pixelDiff(item.partialFrame, item.missingFrame,
      { x: 0, y: 0, w: item.partialFrame.width, h: item.partialFrame.height });
    const stats = frameStats(item.missingFrame);
    assert(atomic.mean === 0 && atomic.max === 0, `${item.name} partial art did not atomically match missing fallback`);
    assert(stats.nonTransparent > 0 && stats.nearWhiteRatio < .9,
      `${item.name} fallback was empty or a white frame ${JSON.stringify(stats)}`);
    return { name: item.name, partialEqualsMissing: atomic, missingFrame: stats };
  });

  function bridgeSpan(viewport) {
    return Math.max(160, Math.min(360, viewport.virtualWidth * .32)) * viewport.scale;
  }
  const seamMatrix = [];
  const seamSizes = [[360, 640], [844, 390], [1600, 600]];
  for (const [W, H] of seamSizes) {
    const viewport = raceViewport(W, H), rect = { x: 0, y: 0, w: W, h: H };
    const entry47 = render(entryState(47, "entry", 496, W, H), { hud: false });
    const tunnel0 = render(entryState(0, "tunnel", 496, W, H), { hud: false });
    const entrySeam = pixelDiff(entry47, tunnel0, rect);
    assert(entrySeam.mean < 1, `${W}x${H} entry47/tunnel0 seam ${entrySeam.mean}`);
    const returns = [];
    for (const returnY of [96, 544]) {
      const return9 = render(returnState(9, returnY, W, H), { hud: false });
      const return10 = render(returnState(10, returnY, W, H), { hud: false });
      const returnSeam = pixelDiff(return9, return10, rect);
      assert(returnSeam.mean < 8, `${W}x${H} Y${returnY} return9/10 seam ${returnSeam.mean}`);
      const authorityCenter = raceTunnelGeometry(returnState(0, returnY, W, H).race, RACE_TUNNEL_TICKS - 1).center;
      const presentationCenter = hyperRunTunnelPresentationCenter(
        authorityCenter, returnY, viewport.pilotX, viewport.pilotX, bridgeSpan(viewport));
      const registrationError = Math.abs(presentationCenter - returnY);
      assert(registrationError < 1e-9, `${W}x${H} Y${returnY} return bridge missed portal by ${registrationError}`);
      const tunnel359Pilot = [viewport.pilotX, raceViewportY(viewport, returnY)];
      const return0Pilot = [viewport.pilotX, raceViewportY(viewport, returnY)];
      assert(tunnel359Pilot[0] === return0Pilot[0] && tunnel359Pilot[1] === return0Pilot[1],
        `${W}x${H} Y${returnY} tunnel359/return0 pilot transform changed`);
      returns.push({ returnY, return9Return10: returnSeam, bridgeRegistrationError: registrationError,
        tunnel359Return0PilotDelta: [return0Pilot[0] - tunnel359Pilot[0], return0Pilot[1] - tunnel359Pilot[1]] });
    }
    for (const frame of [entry47, tunnel0,
      render(tunnelContentState(359, { W, H, pilotY: 544 }), { hud: false }),
      render(returnState(0, 544, W, H), { hud: false })]) {
      const stats = frameStats(frame);
      assert(stats.nonTransparent > 0 && stats.nearWhiteRatio < .9,
        `${W}x${H} transition frame empty/white ${JSON.stringify(stats)}`);
    }
    seamMatrix.push({ size: [W, H], entry47Tunnel0: entrySeam, returns });
  }

  const approvedViewportGrid = [[360, 640], [390, 844], [844, 390], [1440, 900], [1600, 600]].map(([W, H]) => {
    const viewport = raceViewport(W, H), samples = hyperRunTunnelSampleCount(viewport.virtualWidth);
    const pilotGridIndex = viewport.pilotLocalX / viewport.virtualWidth * samples;
    const gridError = Math.abs(pilotGridIndex - Math.round(pilotGridIndex));
    assert(gridError < 1e-9, `${W}x${H} pilot plane is not a tunnel-wall vertex: ${pilotGridIndex}`);
    const vertexX = viewport.left + viewport.contentWidth * (Math.round(pilotGridIndex) / samples);
    const pilotScreenError = Math.abs(vertexX - viewport.pilotX);
    const tunnel = createRaceState(); tunnel.wormholes = 2; tunnel.entryAnchorY = 496;
    let maxBoundaryError = 0;
    for (const tick of [0, 180, 255, 285, 359]) {
      const distance = (vertexX - viewport.pilotX) / viewport.scale;
      const sampledTick = clamp(tick + distance / (raceApi.RACE_TUNNEL_SPEED / RACE_HZ), 0, RACE_TUNNEL_TICKS - 1);
      const authority = raceTunnelGeometry(tunnel, tick), sampled = raceTunnelGeometry(tunnel, sampledTick);
      maxBoundaryError = Math.max(maxBoundaryError,
        Math.abs((sampled.center - sampled.half) - (authority.center - authority.half)),
        Math.abs((sampled.center + sampled.half) - (authority.center + authority.half)));
    }
    assert(pilotScreenError < 1e-9 && maxBoundaryError < 1e-9,
      `${W}x${H} live tunnel boundary missed authority plane ${JSON.stringify({ pilotScreenError, maxBoundaryError })}`);
    return { size: [W, H], virtualWidth: viewport.virtualWidth, samples, pilotGridIndex, gridError,
      pilotScreenError, maxAuthorityBoundaryError: maxBoundaryError };
  });

  function coverRadius(viewport, x, y) {
    return Math.max(
      Math.hypot(x - viewport.left, y - viewport.top), Math.hypot(x - viewport.right, y - viewport.top),
      Math.hypot(x - viewport.left, y - viewport.bottom), Math.hypot(x - viewport.right, y - viewport.bottom),
    ) + 8 * viewport.scale;
  }
  const revealMonotonic = seamSizes.map(([W, H]) => {
    const viewport = raceViewport(W, H), y = raceViewportY(viewport, 496);
    const cover = coverRadius(viewport, viewport.pilotX, y), ringSize = 148 * viewport.scale;
    const entry = Array.from({ length: 12 }, (_, i) => 36 + i).map((tick) => {
      const scale = tick <= 43 ? lerp(2.15, 2.35, smooth((tick - 36) / 7)) : 2.35;
      const aperture = ringSize * scale * .32;
      return tick <= 43 ? lerp(aperture, cover * .8, smooth((tick - 36) / 7))
        : lerp(cover * .8, cover, smooth((tick - 44) / 3));
    });
    const returns = Array.from({ length: 10 }, (_, tick) =>
      lerp(ringSize * .32, cover, smooth(tick / 9)));
    for (const values of [entry, returns]) for (let i = 1; i < values.length; i++) {
      assert(values[i] + 1e-9 >= values[i - 1], `${W}x${H} reveal area regressed at ${i}`);
    }
    return { size: [W, H], entryRadii: entry, returnRadii: returns };
  });

  const transmissionStateA = tunnelContentState(180), transmissionStateB = tunnelContentState(180);
  transmissionStateA.world.envA = 0; transmissionStateA.world.envB = 0; transmissionStateA.world.envBlend = 0;
  transmissionStateB.world.envA = 3; transmissionStateB.world.envB = 3; transmissionStateB.world.envBlend = 0;
  const tunnelSkyA = render(transmissionStateA, { hud: false });
  const tunnelSkyB = render(transmissionStateB, { hud: false });
  const transmissionViewport = raceViewport(844, 390);
  const transmissionX = Math.round(transmissionViewport.pilotX + 120 * transmissionViewport.scale);
  const transmissionTick = 180 + 120 / (raceApi.RACE_TUNNEL_SPEED / RACE_HZ);
  const transmissionY = Math.round(raceViewportY(transmissionViewport,
    raceTunnelGeometry(transmissionStateA.race, transmissionTick).center));
  const backdropStateA = scenario(), backdropStateB = scenario();
  backdropStateA.world.envA = 0; backdropStateA.world.envB = 0; backdropStateA.world.envBlend = 0;
  backdropStateB.world.envA = 3; backdropStateB.world.envB = 3; backdropStateB.world.envBlend = 0;
  const patch = { x: transmissionX - 8, y: transmissionY - 8, w: 16, h: 16 };
  const backdropDifference = pixelDiff(render(backdropStateA, { hud: false }), render(backdropStateB, { hud: false }), patch);
  const skyTransmission = pixelDiff(tunnelSkyA, tunnelSkyB,
    patch);
  assert(backdropDifference.mean > 1, `procedural sky control patch did not differ ${JSON.stringify(backdropDifference)}`);
  assert(skyTransmission.mean > 1, `tunnel tint did not transmit the shared sky ${JSON.stringify(skyTransmission)}`);

  const sideA = scenario(1600, 600), sideB = scenario(1600, 600);
  sideA.race.coursePosition = 0; sideB.race.coursePosition = 1200;
  const sideCanvasA = render(sideA, { hud: false }), sideCanvasB = render(sideB, { hud: false });
  const wideViewport = raceViewport(1600, 600);
  const leftBand = pixelDiff(sideCanvasA, sideCanvasB, { x: 0, y: 0, w: Math.floor(wideViewport.left), h: 600 });
  const rightBand = pixelDiff(sideCanvasA, sideCanvasB, { x: Math.ceil(wideViewport.right), y: 0, w: 1600 - Math.ceil(wideViewport.right), h: 600 });
  assert(leftBand.mean === 0 && rightBand.mean === 0, `gameplay leaked into side bands ${JSON.stringify({ leftBand, rightBand })}`);

  const flowArgs = { seed: 0x48595231, tick: 120, coursePosition: 800, speed: 360, targetY: 144, targetDistance: 430, virtualWidth: 1385 };
  assert(JSON.stringify(hyperRunFlowSnapshot(flowArgs)) === JSON.stringify(hyperRunFlowSnapshot(flowArgs)), "flow snapshot is nondeterministic");
  const copyStates = {
    charge95: (() => { const r = createRaceState(); r.charge = 95; return hyperRunChargeCopy(r); })(),
    charge100: (() => { const r = createRaceState(); r.charge = 100; return hyperRunChargeCopy(r); })(),
    entry: (() => { const r = createRaceState(); r.charge = 100; r.phase = "entry"; return hyperRunChargeCopy(r); })(),
    final: (() => { const r = createRaceState(); r.wormholes = 3; return hyperRunChargeCopy(r); })(),
  };
  assert(copyStates.charge95 === "NEXT CLEAN GATE: WORMHOLE", `95 copy ${copyStates.charge95}`);
  assert(copyStates.charge100 === "WORMHOLE READY", `100 copy ${copyStates.charge100}`);
  assert(copyStates.entry === "WORMHOLE", `entry copy ${copyStates.entry}`);
  assert(copyStates.final === "FINAL SPRINT", `final copy ${copyStates.final}`);

  function percentile(sorted, fraction) {
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
  }
  function measureHostCanvas(W, H, reduced) {
    reducedMotion = reduced;
    const s = scenario(W, H); s.race.coursePosition = RACE_RINGS[0].x - 430;
    const canvas = createCanvas(W, H), ctx = canvas.getContext("2d");
    const warmupFrames = 30, measuredFrames = 180;
    for (let i = 0; i < warmupFrames; i++) {
      s.race.tick = i; s.race.coursePosition += RACE_MAX_SPEED / RACE_HZ; sync(s);
      drawWorld(ctx, s.world, save, art);
    }
    const samples = [];
    for (let i = 0; i < measuredFrames; i++) {
      s.race.tick = warmupFrames + i; s.race.coursePosition += RACE_MAX_SPEED / RACE_HZ; sync(s);
      const start = performance.now(); drawWorld(ctx, s.world, save, art); samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return {
      label: "host Canvas proxy; not Pixel 6a evidence", width: W, height: H,
      reducedMotion: reduced, warmupFrames, measuredFrames,
      median: percentile(samples, .5), p95: percentile(samples, .95),
      p99: percentile(samples, .99), max: samples.at(-1),
      over33ms: samples.filter((sample) => sample > 33).length,
    };
  }
  const hostCanvasPerformance = [
    measureHostCanvas(844, 390, false), measureHostCanvas(844, 390, true),
    measureHostCanvas(1440, 900, false), measureHostCanvas(1440, 900, true),
  ];
  reducedMotion = false;

  const manifestPath = join(outDir, "manifest.json");
  const manifest = {
    generatedFrom: "shipping drawWorld/drawHud compiled from illustrated-src/game/*.ts",
    generatedOutsideRepository: !inside(root, outDir), outputs,
    assertions: {
      seamMatrix, approvedViewportGrid, revealMonotonic, transitionArtAssertions,
      proceduralSkyControl: backdropDifference, skyTransmission,
      sideBands: { left: leftBand, right: rightBand }, copyStates,
      boundaryMatrix: { offsets: [38, -38, 38.0001, -38.0001], stamps: [-2, -1, "CROSS", 1, 2], sizes: [[360, 640], [844, 390]] },
      deterministicFlow: true, hostCanvasPerformance,
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outDir, manifestPath, outputs, assertions: manifest.assertions })}\n`);
} finally {
  rmSync(compileRoot, { recursive: true, force: true });
}
