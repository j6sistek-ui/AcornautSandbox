#!/usr/bin/env node
// Visual QA contact sheet for the Eclipse planet-impact trial. Renders the
// shipping drawWorld path at the real 390 x 844 phone viewport.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(process.argv[2] || join(root, ".bounce-review"));
const reboundDir = process.argv[3] === "down" ? 1 : -1;
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

const js = join(mkdtempSync(join(tmpdir(), "acornaut-bounce-review-js-")), "js");
cpSync(join(root, "docs", "js"), js, { recursive: true });
writeFileSync(join(js, "package.json"), '{"type":"module"}\n');
const [{ drawWorld }, { makeWorld, initStars, updateWorld }, { defaultSave }, { PHYS }] =
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
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  let sx = 0, sy = 0, sn = 0;
  const solid = [];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const a = data[(y * img.width + x) * 4 + 3];
    if (a < 16) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if (a >= 80) { sx += x; sy += y; sn += 1; solid.push(x, y); }
  }
  const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const coreX = sn ? sx / sn : box.x + box.w / 2;
  const coreY = sn ? sy / sn : box.y + box.h / 2;
  const radii = [];
  for (let i = 0; i < solid.length; i += 2) {
    radii.push(Math.hypot(solid[i] - coreX, solid[i + 1] - coreY));
  }
  radii.sort((a, b) => a - b);
  const core = radii.length ? Math.max(8, radii[Math.floor(radii.length * 0.8)] * 2) : Math.max(box.w, box.h);
  Object.assign(img, { box, core, coreX, coreY });
  return img;
}

async function sprite(path) { return measure(await loadImage(path)); }
const suits = join(root, "docs/art/suits");
const [base, body, tail, planet, sky] = await Promise.all([
  sprite(join(suits, "eclipse.png")),
  sprite(join(suits, "eclipse-body.png")),
  sprite(join(suits, "eclipse-tail.png")),
  sprite(join(root, "docs/art/planets/0.png")),
  loadImage(join(root, "docs/art/skies/dark6.jpg")),
]);
const art = {
  ready: true,
  squirrelIdle: [], squirrelFlap: [], acorn: [], golden: [], shield: [],
  planets: [planet], debris: [], pals: {}, helms: {}, suits: { eclipse: base },
  sky, arcadeAcorn: null, frozen: null, shieldnut: null,
  suitTail: { eclipse: tail }, suitBody: { eclipse: body },
  suitTap: {}, suitTapTail: {},
};

const W = 390, H = 844, FPS = 30, FRAMES = 12;
const save = defaultSave();
save.equippedSuit = "eclipse";
save.unlockedSuits.push("eclipse");
save.equipped = "clear";
save.equippedPal = "none";
const world = makeWorld(W, H);
initStars(world);
world.screen = "play";
world.ready = false;
world.flight = "fly";
world.squirrel.y = H * 0.5;
world.squirrel.vy = reboundDir < 0 ? 360 : -360;
world.lastSpawnX = 100000;
const sx = W * PHYS.squirrelX;
const planetCenter = world.squirrel.y - reboundDir * 50;
world.planets = [{
  x: sx + 1,
  gapY: reboundDir < 0
    ? planetCenter - PHYS.gapBase / 2 - PHYS.planetR
    : planetCenter + PHYS.gapBase / 2 + PHYS.planetR,
  gap: PHYS.gapBase,
  r: PHYS.planetR,
  topKind: 0,
  botKind: 0,
  scored: false,
  drift: 0,
  driftAmp: 0,
  blockers: [],
}];
let event = null;
for (let i = 0; i < 4 && event !== "bounce"; i++) event = updateWorld(world, save, 1 / 120);
if (event !== "bounce") throw new Error("Review setup did not produce a bounce");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const phone = createCanvas(W, H);
const cell = 216, cols = 4, rows = 3;
const sheet = createCanvas(cell * cols, cell * rows);
const sc = sheet.getContext("2d");
for (let frame = 0; frame < FRAMES; frame++) {
  const pc = phone.getContext("2d");
  pc.clearRect(0, 0, W, H);
  drawWorld(pc, world, save, art);
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  const x = col * cell, y = row * cell;
  const crop = 108;
  sc.fillStyle = "#070b16";
  sc.fillRect(x, y, cell, cell);
  sc.drawImage(phone, sx - crop / 2, world.squirrel.y - crop / 2 + 18,
    crop, crop, x, y, cell, cell);
  sc.fillStyle = "rgba(5,7,16,0.78)";
  sc.fillRect(x, y, 88, 25);
  sc.fillStyle = "#ffffff";
  sc.font = "700 12px sans-serif";
  sc.fillText(`${Math.round((frame / FPS) * 1000)} ms`, x + 9, y + 17);
  sc.strokeStyle = "rgba(255,255,255,0.18)";
  sc.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  updateWorld(world, save, 1 / FPS);
}
const out = join(outDir, `eclipse-planet-impact-${reboundDir < 0 ? "up" : "down"}.png`);
writeFileSync(out, sheet.toBuffer("image/png"));
console.log(JSON.stringify({ out, frames: FRAMES, fps: FPS }));
