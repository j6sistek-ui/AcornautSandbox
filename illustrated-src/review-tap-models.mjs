#!/usr/bin/env node
// Visual contract harness for the shared tap animation. Renders every active
// suit through shipping drawWorld at a magnified game-scale crop.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(process.argv[2] || join(root, ".tap-model-review"));
const canvasEntry = process.env.ACORNAUT_CANVAS_MODULE;
if (!canvasEntry) throw new Error("Set ACORNAUT_CANVAS_MODULE to @napi-rs/canvas's index.js");
const { createCanvas, Image, loadImage } = await import(pathToFileURL(resolve(canvasEntry)).href);

globalThis.window = { __ACORNAUT_BETA__: true };
globalThis.Image = Image;
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`Unexpected element: ${tag}`);
    return createCanvas(1, 1);
  },
};
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const js = join(mkdtempSync(join(tmpdir(), "acornaut-model-review-js-")), "js");
cpSync(join(root, "docs/js"), js, { recursive: true });
writeFileSync(join(js, "package.json"), '{"type":"module"}\n');
const [{ drawWorld }, { makeWorld, initStars, flap, updateWorld }, { defaultSave }, { SUITS }] =
  await Promise.all([
    import(pathToFileURL(join(js, "draw.js")).href),
    import(pathToFileURL(join(js, "sim.js")).href),
    import(pathToFileURL(join(js, "save.js")).href),
    import(pathToFileURL(join(js, "catalog.js")).href),
  ]);

function measure(img) {
  const c = createCanvas(img.width, img.height);
  const cx = c.getContext("2d");
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, img.width, img.height).data;
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1, sx = 0, sy = 0, sn = 0;
  const solid = [];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const a = data[(y * img.width + x) * 4 + 3];
    if (a < 16) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if (a >= 80) { sx += x; sy += y; sn++; solid.push(x, y); }
  }
  const pad = 2;
  const box = maxX < minX ? { x: 0, y: 0, w: img.width, h: img.height } : {
    x: Math.max(0, minX - pad), y: Math.max(0, minY - pad),
    w: Math.min(img.width, maxX - minX + 1 + pad * 2),
    h: Math.min(img.height, maxY - minY + 1 + pad * 2),
  };
  const coreX = sn ? sx / sn : box.x + box.w / 2;
  const coreY = sn ? sy / sn : box.y + box.h / 2;
  const radii = [];
  for (let i = 0; i < solid.length; i += 2) radii.push(Math.hypot(solid[i] - coreX, solid[i + 1] - coreY));
  radii.sort((a, b) => a - b);
  Object.assign(img, { box, core: radii.length ? Math.max(8, radii[Math.floor(radii.length * 0.8)] * 2) : Math.max(box.w, box.h), coreX, coreY });
  return img;
}

async function sprite(path) { return measure(await loadImage(path)); }
const suitsDir = join(root, "docs/art/suits");
const suits = {}, suitBody = {}, suitTail = {}, suitTap = {};
for (const suit of SUITS) {
  suits[suit.id] = await sprite(join(suitsDir, `${suit.id}.png`));
  suitBody[suit.id] = await sprite(join(suitsDir, `${suit.id}-body.png`));
  suitTail[suit.id] = await sprite(join(suitsDir, `${suit.id}-tail.png`));
  suitTap[suit.id] = await Promise.all(
    Array.from({ length: 16 }, (_, i) => sprite(join(suitsDir, `${suit.id}-tap-${i + 1}.png`))),
  );
}
const eclipseTailTap = await Promise.all(Array.from({ length: 12 }, (_, i) => sprite(join(suitsDir, `eclipse-tail-tap-${i + 1}.png`))));
const sky = await loadImage(join(root, "docs/art/skies/dark6.jpg"));
const art = {
  ready: true, squirrelIdle: [], squirrelFlap: [], acorn: [], golden: [], shield: [],
  planets: [], debris: [], pals: {}, helms: {}, suits, sky, arcadeAcorn: null,
  frozen: null, shieldnut: null, suitTail, suitBody,
  suitTap, suitTapTail: { eclipse: eclipseTailTap },
};

const W = 390, H = 844, FPS = 30, SECONDS = 1.5;
const COLS = 5, ROWS = 4, CELL = 190;
const output = createCanvas(COLS * CELL, ROWS * CELL);
const oc = output.getContext("2d");
const source = createCanvas(W, H);
const states = SUITS.map((suit, index) => {
  const save = defaultSave();
  save.equippedSuit = suit.id;
  save.unlockedSuits.push(suit.id);
  save.equipped = "clear";
  save.equippedPal = "none";
  const world = makeWorld(W, H);
  let seed = 0xAC0A17 + index;
  const priorRandom = Math.random;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  initStars(world);
  Math.random = priorRandom;
  world.screen = "play"; world.ready = false; world.flight = "fly";
  world.squirrel.y = H * 0.53; world.lastSpawnX = W * 4;
  return { suit, save, world };
});

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const taps = new Set([5, 14, 23]);
let drawMs = 0;
let drawCalls = 0;
for (let frame = 0; frame < Math.round(SECONDS * FPS); frame++) {
  if (taps.has(frame)) for (const { world, save } of states) flap(world, save);
  oc.fillStyle = "#0b0d19"; oc.fillRect(0, 0, output.width, output.height);
  for (let i = 0; i < states.length; i++) {
    const { suit, save, world } = states[i];
    world.planets = []; world.debris = []; world.pickups = []; world.invulnLeft = 999;
    const sc = source.getContext("2d"); sc.clearRect(0, 0, W, H);
    const drawStart = performance.now();
    drawWorld(sc, world, save, art);
    drawMs += performance.now() - drawStart;
    drawCalls++;
    const col = i % COLS, row = Math.floor(i / COLS);
    const dx = col * CELL, dy = row * CELL;
    const crop = 92, px = W * 0.18, py = world.squirrel.y;
    oc.drawImage(source, px - crop / 2, py - crop / 2, crop, crop, dx + 10, dy + 24, CELL - 20, CELL - 34);
    oc.fillStyle = "rgba(5,7,16,0.76)"; oc.fillRect(dx, dy, CELL, 25);
    oc.fillStyle = suit.id === "eclipse" ? "#d8b6ff" : "#f3ede3";
    oc.font = "700 13px sans-serif"; oc.fillText(suit.name.toUpperCase(), dx + 9, dy + 17);
  }
  writeFileSync(join(outDir, `frame-${String(frame).padStart(3, "0")}.png`), output.toBuffer("image/png"));
  for (const { world, save } of states) updateWorld(world, save, 1 / FPS);
}
console.log(JSON.stringify({
  outDir, models: SUITS.length, frames: Math.round(SECONDS * FPS), fps: FPS,
  drawCalls, meanDrawMs: Number((drawMs / drawCalls).toFixed(3)),
  desktopCanvasFrameBudgetPct: Number((((drawMs / drawCalls) / (1000 / 60)) * 100).toFixed(1)),
}));
