#!/usr/bin/env node
// Optional visual QA harness for the Eclipse tap trial. It renders through
// the shipping drawWorld path, placing the legacy static-rig response beside
// the articulated body bank at the real 390 x 844 phone viewport.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(process.argv[2] || join(root, ".tap-review"));
const canvasEntry = process.env.ACORNAUT_CANVAS_MODULE;
if (!canvasEntry) throw new Error("Set ACORNAUT_CANVAS_MODULE to @napi-rs/canvas's index.js");

const { createCanvas, Image, loadImage, GlobalFonts } = await import(
  pathToFileURL(resolve(canvasEntry)).href
);

// draw.ts only needs browser canvas creation for cached sprite halos. Skies
// deliberately fall back to art.sky so no browser/network loader is needed.
globalThis.window = { __ACORNAUT_BETA__: true };
globalThis.Image = Image;
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`Unexpected element in review harness: ${tag}`);
    return createCanvas(1, 1);
  },
};
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

// The shipping browser files are ESM but intentionally have no package.json.
// Copy them into a disposable ESM package so Node can exercise exactly the
// exported browser bundle without adding test-only metadata to docs/.
const js = join(mkdtempSync(join(tmpdir(), "acornaut-review-js-")), "js");
cpSync(join(root, "docs/js65"), js, { recursive: true });
writeFileSync(join(js, "package.json"), '{"type":"module"}\n');
const [{ drawWorld }, { makeWorld, initStars, flap, updateWorld }, { defaultSave }] =
  await Promise.all([
    import(pathToFileURL(join(js, "draw.js")).href),
    import(pathToFileURL(join(js, "sim.js")).href),
    import(pathToFileURL(join(js, "save.js")).href),
  ]);

function measure(img) {
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  let sx = 0;
  let sy = 0;
  let sn = 0;
  const solid = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const alpha = data[(y * img.width + x) * 4 + 3];
      if (alpha < 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (alpha >= 80) {
        sx += x;
        sy += y;
        sn += 1;
        solid.push(x, y);
      }
    }
  }
  const pad = 2;
  const box = maxX < minX
    ? { x: 0, y: 0, w: img.width, h: img.height }
    : {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(img.width, maxX - minX + 1 + pad * 2),
        h: Math.min(img.height, maxY - minY + 1 + pad * 2),
      };
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

async function sprite(path) {
  return measure(await loadImage(path));
}

const suits = join(root, "docs/art/suits");
const base = await sprite(join(suits, "eclipse.png"));
const body = await sprite(join(suits, "eclipse-body.png"));
const tail = await sprite(join(suits, "eclipse-tail.png"));
const tap = await Promise.all(
  Array.from({ length: 8 }, (_, i) => sprite(join(suits, `eclipse-tap-${i + 1}.png`))),
);
const tapTail = await Promise.all(
  Array.from({ length: 12 }, (_, i) => sprite(join(suits, `eclipse-tail-tap-${i + 1}.png`))),
);
const sky = await loadImage(join(root, "docs/art/skies/dark6.jpg"));

function artBank(articulated) {
  return {
    ready: true,
    squirrelIdle: [], squirrelFlap: [], acorn: [], golden: [], shield: [],
    planets: [], debris: [], pals: {}, helms: {}, suits: { eclipse: base },
    sky, arcadeAcorn: null, frozen: null, shieldnut: null,
    suitTail: { eclipse: tail }, suitBody: { eclipse: body },
    suitTap: articulated ? { eclipse: tap } : {},
    suitTapTail: articulated ? { eclipse: tapTail } : {},
  };
}

const WIDTH = 390;
const HEIGHT = 844;
const FPS = 30;
const SECONDS = 1.2;
const oldArt = artBank(false);
const trialArt = artBank(true);
const save = defaultSave();
save.equippedSuit = "eclipse";
save.unlockedSuits.push("eclipse");
save.equipped = "clear";
save.equippedPal = "none";

let seed = 0xAC0A17;
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const world = makeWorld(WIDTH, HEIGHT);
initStars(world);
world.screen = "play";
world.ready = false;
world.flight = "fly";
world.squirrel.y = HEIGHT * 0.53;
world.lastSpawnX = WIDTH * 4;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const left = createCanvas(WIDTH, HEIGHT);
const right = createCanvas(WIDTH, HEIGHT);
const result = createCanvas(WIDTH * 2, HEIGHT);
const rc = result.getContext("2d");
const tapFrames = new Set([5, 12]); // 0.167 s and 0.400 s: rapid repeat case.

function label(text, x, accent) {
  rc.fillStyle = "rgba(6, 8, 18, 0.82)";
  rc.fillRect(x, 0, WIDTH, 48);
  rc.fillStyle = accent;
  rc.font = "700 17px sans-serif";
  rc.fillText(text, x + 16, 30);
}

for (let frame = 0; frame < Math.round(SECONDS * FPS); frame++) {
  if (tapFrames.has(frame)) flap(world, save);
  world.planets = [];
  world.pickups = [];

  const lc = left.getContext("2d");
  const rr = right.getContext("2d");
  lc.clearRect(0, 0, WIDTH, HEIGHT);
  rr.clearRect(0, 0, WIDTH, HEIGHT);
  drawWorld(lc, world, save, oldArt);
  drawWorld(rr, world, save, trialArt);

  rc.clearRect(0, 0, result.width, result.height);
  rc.drawImage(left, 0, 0);
  rc.drawImage(right, WIDTH, 0);
  label("CURRENT · STATIC BODY", 0, "#ffb27a");
  label("TRIAL · BODY + 12-FRAME TAIL", WIDTH, "#d8b6ff");
  rc.fillStyle = "rgba(255,255,255,0.18)";
  rc.fillRect(WIDTH - 1, 0, 2, HEIGHT);

  // A moving 3× detail keeps the full viewport honest while making the
  // 52 px gameplay silhouette inspectable in a normal chat/video player.
  const px = WIDTH * 0.18;
  const py = world.squirrel.y;
  const crop = 84;
  const inset = 228;
  for (const [source, x] of [[left, 18], [right, WIDTH + 18]]) {
    const y = HEIGHT - inset - 22;
    rc.fillStyle = "rgba(5, 7, 16, 0.76)";
    rc.fillRect(x - 3, y - 3, inset + 6, inset + 6);
    rc.drawImage(source, px - crop / 2, py - crop / 2, crop, crop, x, y, inset, inset);
    rc.strokeStyle = "rgba(255,255,255,0.52)";
    rc.lineWidth = 2;
    rc.strokeRect(x, y, inset, inset);
    rc.fillStyle = "rgba(5, 7, 16, 0.78)";
    rc.fillRect(x, y + inset - 26, 84, 26);
    rc.fillStyle = "#ffffff";
    rc.font = "700 12px sans-serif";
    rc.fillText("3× DETAIL", x + 9, y + inset - 8);
  }

  const name = `frame-${String(frame).padStart(3, "0")}.png`;
  writeFileSync(join(outDir, name), result.toBuffer("image/png"));
  updateWorld(world, save, 1 / FPS);
}

writeFileSync(join(outDir, "contact.png"), result.toBuffer("image/png"));
console.log(JSON.stringify({ outDir, frames: Math.round(SECONDS * FPS), fps: FPS }));
