#!/usr/bin/env node
// Revision 3 visual-review reference. This is deliberately independent of the
// runtime renderer: Phase B can approve the composition before Phase C copies
// the approved behavior into draw.ts. Every generated frame stays outside the
// repository (OS temp by default).
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const requestedOut = process.argv[2] ? resolve(process.argv[2]) : null;

function isInside(parent, child) {
  const rel = relative(parent, child);
  const sep = process.platform === "win32" ? "\\" : "/";
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

if (requestedOut && isInside(root, requestedOut)) {
  throw new Error("Revision 3 review output must be outside the repository; omit the path to use OS temp.");
}
const outDir = requestedOut ?? mkdtempSync(join(tmpdir(), "acornaut-hyper-run-r3-review-"));
if (existsSync(join(outDir, "manifest.json"))) {
  throw new Error(`Refusing to overwrite existing review evidence in ${outDir}`);
}
mkdirSync(outDir, { recursive: true });

const canvasEntry = process.env.ACORNAUT_CANVAS_MODULE;
if (!canvasEntry) throw new Error("Set ACORNAUT_CANVAS_MODULE to @napi-rs/canvas's index.js");
const { createCanvas, GifEncoder, loadImage } = await import(pathToFileURL(resolve(canvasEntry)).href);

const artRoot = join(root, "docs", "art");
const hyperRoot = join(artRoot, "hyper-run");
const [sky, pilot, acorn, debris, ...portalArt] = await Promise.all([
  loadImage(join(artRoot, "skies", "dark6-wide.jpg")),
  loadImage(join(artRoot, "squirrel", "flap-2.png")),
  loadImage(join(artRoot, "acorn", "1.png")),
  loadImage(join(artRoot, "debris", "6.png")),
  ...[
    "gate-idle-back", "gate-idle-front", "gate-passed-back", "gate-passed-front",
    "gate-missed-back", "gate-missed-front", "entry-mouth", "entry-rim-back",
    "entry-glyphs", "entry-rim-front", "return-back", "return-glyphs", "return-front",
  ].map((id) => loadImage(join(hyperRoot, `${id}.png`))),
]);
const artIds = [
  "gate-idle-back", "gate-idle-front", "gate-passed-back", "gate-passed-front",
  "gate-missed-back", "gate-missed-front", "entry-mouth", "entry-rim-back",
  "entry-glyphs", "entry-rim-front", "return-back", "return-glyphs", "return-front",
];
const art = Object.fromEntries(artIds.map((id, i) => [id, portalArt[i]]));

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const clamp01 = (n) => clamp(n, 0, 1);
const smooth = (n) => { const t = clamp01(n); return t * t * (3 - 2 * t); };
const seg = (tick, start, end) => smooth((tick - start) / Math.max(1, end - start));
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (n, d) => ((n % d) + d) % d;

function camera(W, H) {
  const scale = Math.min(W / 360, H / 640);
  const virtualWidth = Math.min(scale > 0 ? W / scale : 360, 1440);
  const contentWidth = virtualWidth * scale;
  const left = (W - contentWidth) / 2;
  const top = (H - 640 * scale) / 2;
  const pilotLocal = clamp(virtualWidth * 0.2, 96, 288);
  const pilotX = left + pilotLocal * scale;
  return {
    W, H, scale, virtualWidth, contentWidth, contentHeight: 640 * scale,
    left, right: left + contentWidth, top, bottom: top + 640 * scale,
    pilotLocal, pilotX,
    x: (distance) => pilotX + distance * scale,
    y: (canonicalY) => top + canonicalY * scale,
  };
}

function cover(ctx, img, W, H) {
  const sw = img.width;
  const sh = img.height;
  const s = Math.max(W / sw, H / sh);
  ctx.drawImage(img, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
}

function backdrop(ctx, c) {
  cover(ctx, sky, c.W, c.H);
  const g = ctx.createLinearGradient(0, 0, 0, c.H);
  g.addColorStop(0, "rgba(3,8,22,.35)");
  g.addColorStop(.55, "rgba(4,10,24,.18)");
  g.addColorStop(1, "rgba(4,7,17,.48)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.W, c.H);
}

function laneSeed(i, salt) {
  let n = (i * 0x9e3779b1 + salt * 0x85ebca6b + 0x48595233) >>> 0;
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15;
  return (n >>> 0) / 0x100000000;
}

function nearGameplay(x, y, objects) {
  return objects.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + 24);
}

function flow(ctx, c, opts, layer, objects = []) {
  const reduced = !!opts.reduced;
  const counts = reduced ? { far: 12, mid: 8, near: 3 } : { far: 24, mid: 16, near: 8 };
  const count = counts[layer];
  const parallax = layer === "far" ? .18 : layer === "mid" ? .48 : .82;
  const speedNorm = clamp01((opts.speed - 225) / 135);
  const pad = 90 * c.scale;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const seed = laneSeed(i, layer === "far" ? 1 : layer === "mid" ? 2 : 3);
    const span = c.contentWidth + pad * 2;
    const travel = opts.tick * opts.speed * parallax * c.scale / 60;
    const x = c.left - pad + mod(seed * span - travel, span);
    const y0 = c.top + (36 + laneSeed(i, 11) * 568) * c.scale;
    const gatePull = layer === "mid" && !reduced && opts.targetY != null && opts.targetDistance <= 540
      ? lerp(.15, .25, clamp01(1 - opts.targetDistance / 540))
      : 0;
    const targetY = opts.targetY == null ? y0 : c.y(opts.targetY);
    const y = lerp(y0, targetY, gatePull);
    if (layer === "near" && nearGameplay(x, y, objects)) continue;
    const base = layer === "far" ? 8 : layer === "mid" ? 18 : 12;
    const len = (base + speedNorm * (layer === "mid" ? 34 : 20) + seed * 9) * c.scale;
    ctx.strokeStyle = layer === "far"
      ? "rgba(184,215,255,.34)"
      : layer === "mid"
        ? "rgba(80,210,255,.42)"
        : "rgba(210,242,255,.32)";
    ctx.lineWidth = (layer === "far" ? .8 : layer === "mid" ? 1.25 : 1.5) * c.scale;
    ctx.beginPath();
    ctx.moveTo(x + len, y);
    if (gatePull > 0) {
      ctx.quadraticCurveTo(x + len * .45, lerp(y0, targetY, gatePull * .55), x, y);
    } else {
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRegistered(ctx, img, x, y, size, alpha = 1, rotation = 0) {
  if (!img || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp01(alpha);
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function fallbackRing(ctx, x, y, size, layer, state, alpha = 1) {
  const colors = state === "missed" ? ["#a47a50", "#79c9d7"] : state === "passed" ? ["#69f7ee", "#fff0a5"] : ["#65dcff", "#b5a0ff"];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.lineCap = "round";
  const r = size * .365;
  ctx.lineWidth = size * .092;
  ctx.strokeStyle = colors[0];
  ctx.shadowColor = colors[1];
  ctx.shadowBlur = size * .05;
  ctx.beginPath();
  if (layer === "back") ctx.arc(0, 0, r, 0, Math.PI * 2);
  else ctx.arc(0, 0, r, Math.PI * .2, Math.PI * .8);
  ctx.stroke();
  ctx.restore();
}

function membraneBack(ctx, c, x, y, opts) {
  const safe = 38 * c.scale;
  const lens = ctx.createRadialGradient(x - safe * .18, y - safe * .22, safe * .1, x, y, safe);
  lens.addColorStop(0, `rgba(210,250,255,${opts.pending ? .18 : .28})`);
  lens.addColorStop(.68, `rgba(49,181,255,${opts.pending ? .09 : .16})`);
  lens.addColorStop(1, "rgba(19,126,255,0)");
  ctx.fillStyle = lens;
  ctx.beginPath(); ctx.arc(x, y, safe, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = opts.pending ? "rgba(112,221,255,.52)" : "rgba(120,240,255,.78)";
  ctx.lineWidth = Math.max(1, 1.25 * c.scale);
  ctx.beginPath(); ctx.arc(x, y, safe, Math.PI, Math.PI * 2); ctx.stroke();
}

function membraneFront(ctx, c, x, y, opts) {
  const safe = 38 * c.scale;
  ctx.save();
  ctx.strokeStyle = opts.pending ? "rgba(150,237,255,.72)" : "rgba(218,255,255,.92)";
  ctx.lineWidth = Math.max(1.2, 1.8 * c.scale);
  ctx.shadowColor = "rgba(48,194,255,.8)";
  ctx.shadowBlur = 5 * c.scale;
  ctx.beginPath(); ctx.arc(x, y, safe, 0, Math.PI); ctx.stroke();
  ctx.restore();
}

function passShell(ctx, c, pilotY, age, layer) {
  if (age < 0 || age > 26) return;
  const drift = age < 10 ? 0 : lerp(0, 24, clamp01((age - 10) / 8));
  const x = c.pilotX - drift * c.scale;
  const y = c.y(pilotY);
  const expansion = age <= 2 ? .58 : age <= 9 ? lerp(.7, 1.1, (age - 3) / 6) : 1.12;
  const fade = age < 19 ? 1 : 1 - (age - 19) / 7;
  const r = 60 * c.scale * expansion;
  ctx.save();
  ctx.globalAlpha *= clamp01(fade);
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = age <= 2 ? "rgba(235,255,255,.98)" : "rgba(52,202,255,.78)";
  ctx.lineWidth = (age <= 2 ? 4 : 2.2) * c.scale;
  ctx.shadowColor = "#2cc9ff";
  ctx.shadowBlur = 9 * c.scale;
  ctx.beginPath();
  ctx.arc(x, y, r, layer === "back" ? Math.PI : 0, layer === "back" ? Math.PI * 2 : Math.PI);
  ctx.stroke();
  if (layer === "front" && age >= 10 && age <= 18) {
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2 * c.scale;
    for (const dy of [-11, 11]) {
      ctx.beginPath();
      ctx.moveTo(x - r - 8 * c.scale, y + dy * c.scale);
      ctx.lineTo(x - r - 18 * c.scale, y + dy * c.scale);
      ctx.lineTo(x - r - 13 * c.scale, y + (dy - 5) * c.scale);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function missedMembrane(ctx, c, x, y, age, layer) {
  const fade = 1 - clamp01(age / 39);
  const r = 38 * c.scale * lerp(1, .72, clamp01(age / 18));
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = layer === "back" ? "rgba(93,139,161,.6)" : "rgba(210,166,116,.85)";
  ctx.lineWidth = 2 * c.scale;
  ctx.beginPath();
  ctx.arc(x, y, r, layer === "back" ? Math.PI : .08, layer === "back" ? Math.PI * 1.72 : Math.PI * .82);
  ctx.stroke();
  if (layer === "front") {
    ctx.beginPath(); ctx.moveTo(x - 8 * c.scale, y - 24 * c.scale); ctx.lineTo(x + 3 * c.scale, y - 8 * c.scale); ctx.lineTo(x - 5 * c.scale, y + 7 * c.scale); ctx.lineTo(x + 8 * c.scale, y + 25 * c.scale); ctx.stroke();
  }
  ctx.restore();
}

function pilotSprite(ctx, c, x, canonicalY) {
  const size = 62 * c.scale;
  ctx.save();
  ctx.translate(x, c.y(canonicalY));
  ctx.rotate(-.03);
  ctx.shadowColor = "rgba(115,225,255,.65)";
  ctx.shadowBlur = 7 * c.scale;
  ctx.drawImage(pilot, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function objectSprite(ctx, img, x, y, size) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.8)";
  ctx.shadowBlur = 6;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

function director(ctx, c, pilotY, targetY, distance) {
  if (distance <= 160) return;
  const alpha = smooth((distance - 160) / 80);
  const x = c.right - 18;
  const y = clamp(c.y(targetY), c.top + 36, c.bottom - 36);
  const delta = targetY - pilotY;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(2,8,18,.92)";
  ctx.fillStyle = "#a9f5ff";
  ctx.beginPath();
  if (Math.abs(delta) <= 24) {
    ctx.moveTo(0, -7); ctx.lineTo(7, 0); ctx.lineTo(0, 7); ctx.lineTo(-7, 0); ctx.closePath();
  } else if (delta < 0) {
    ctx.moveTo(0, -9); ctx.lineTo(8, 6); ctx.lineTo(-8, 6); ctx.closePath();
  } else {
    ctx.moveTo(0, 9); ctx.lineTo(8, -6); ctx.lineTo(-8, -6); ctx.closePath();
  }
  ctx.stroke(); ctx.fill();
  ctx.strokeStyle = "rgba(38,194,255,.95)"; ctx.lineWidth = 2; ctx.stroke();
  if (Math.abs(delta) > 24) {
    const direction = delta < 0 ? 1 : -1;
    const stem = Math.min(18, 5 + Math.abs(delta) / 32);
    ctx.beginPath(); ctx.moveTo(0, direction * 8); ctx.lineTo(0, direction * (8 + stem)); ctx.stroke();
  }
  ctx.restore();
}

function hud(ctx, c, charge, route = "charging", deltas = []) {
  const x0 = c.W / 2 - 57;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(3,8,18,.72)";
  ctx.fillRect(c.W / 2 - 82, 12, 164, 64);
  ctx.fillStyle = "#fff";
  ctx.font = "800 16px sans-serif";
  ctx.fillText("HYPER RUN", c.W / 2, 31);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = i < Math.ceil(charge / 5) ? "#6ef0d8" : "rgba(255,255,255,.17)";
    ctx.fillRect(x0 + i * 6, 39, 4, 6);
  }
  ctx.fillStyle = route === "ready" ? "#ffe67d" : route === "final" ? "#c8d4e8" : "rgba(255,255,255,.72)";
  ctx.font = "800 9px sans-serif";
  ctx.fillText(route === "ready" ? "WORMHOLE READY" : route === "final" ? "FINAL SPRINT" : `${charge}/100`, c.W / 2, 59);
  ctx.textAlign = "left";
  deltas.forEach((d, i) => {
    ctx.fillStyle = d > 0 ? "#b7fff1" : "#ffc0a0";
    ctx.font = "900 13px sans-serif";
    ctx.fillText(`${d > 0 ? "+" : ""}${d}`, c.pilotX + 34, c.y(320) - 22 + i * 16);
  });
  ctx.restore();
}

function gateScene(W, H, opts = {}) {
  const c = camera(W, H);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const pilotY = opts.pilotY ?? 320;
  const targetY = opts.targetY ?? 144;
  const gateDistance = opts.distance ?? 0;
  const gateX = c.x(gateDistance);
  const gateY = c.y(opts.gateY ?? pilotY);
  const size = 148 * c.scale;
  const state = opts.state ?? "pending";
  const age = opts.age ?? 0;
  const objects = [
    { x: c.x(170), y: c.y(445), r: 34 * c.scale },
    { x: c.x(285), y: c.y(175), r: 26 * c.scale },
    { x: gateX, y: gateY, r: size / 2 },
    { x: c.pilotX, y: c.y(pilotY), r: 38 * c.scale },
  ];
  backdrop(ctx, c);
  flow(ctx, c, { tick: opts.tick ?? 118, speed: opts.speed ?? 360, targetY, targetDistance: opts.targetDistance ?? 450, reduced: opts.reduced }, "far", objects);
  flow(ctx, c, { tick: opts.tick ?? 118, speed: opts.speed ?? 360, targetY, targetDistance: opts.targetDistance ?? 450, reduced: opts.reduced }, "mid", objects);
  const pair = opts.partialArt ? false : true;
  const artState = state === "pending" ? "idle" : state;
  if (pair) drawRegistered(ctx, art[`gate-${artState}-back`], gateX, gateY, size);
  else fallbackRing(ctx, gateX, gateY, size, "back", artState);
  if (state === "pending") membraneBack(ctx, c, gateX, gateY, { pending: true });
  if (state === "passed") passShell(ctx, c, pilotY, age, "back");
  // The ordinary missed painting keeps scrolling with the gate, but its
  // compact decision cue is captured at the pilot plane and decision Y.
  if (state === "missed") missedMembrane(ctx, c, c.pilotX, c.y(opts.gateY ?? pilotY), age, "back");

  objectSprite(ctx, debris, c.x(170), c.y(445), 62 * c.scale);
  objectSprite(ctx, acorn, c.x(285), c.y(175), 28 * c.scale);
  objectSprite(ctx, acorn, c.x(350), c.y(320), 28 * c.scale);
  pilotSprite(ctx, c, c.pilotX, pilotY);
  if (pair) drawRegistered(ctx, art[`gate-${artState}-front`], gateX, gateY, size);
  else fallbackRing(ctx, gateX, gateY, size, "front", artState);
  if (state === "pending") membraneFront(ctx, c, gateX, gateY, { pending: true });
  if (state === "passed") passShell(ctx, c, pilotY, age, "front");
  if (state === "missed") missedMembrane(ctx, c, c.pilotX, c.y(opts.gateY ?? pilotY), age, "front");
  flow(ctx, c, { tick: opts.tick ?? 118, speed: opts.speed ?? 360, targetY, targetDistance: opts.targetDistance ?? 450, reduced: opts.reduced }, "near", objects);
  director(ctx, c, pilotY, targetY, opts.targetDistance ?? 450);
  hud(ctx, c, opts.charge ?? 95, opts.route ?? "charging", opts.deltas ?? []);
  return canvas;
}

function corridorAt(tick, anchorY) {
  const points = [
    [0, anchorY, 144], [45, 248, 126], [90, 204, 96], [135, 408, 108],
    [180, 440, 88], [225, 468, 104], [255, 168, 88], [285, 452, 96],
    [315, 360, 120], [359, 320, 144],
  ];
  const t = clamp(tick, 0, 359);
  let b = 1;
  while (b < points.length && points[b][0] < t) b++;
  const a = Math.max(0, b - 1);
  if (b >= points.length) return { center: points.at(-1)[1], half: points.at(-1)[2] };
  const u = smooth((t - points[a][0]) / Math.max(1, points[b][0] - points[a][0]));
  return { center: lerp(points[a][1], points[b][1], u), half: lerp(points[a][2], points[b][2], u) };
}

function tunnelScene(ctx, c, tick, anchorY, reduced = false, bridgeY = null) {
  // Production keeps the same course sky beneath a translucent corridor tint.
  backdrop(ctx, c);
  const g = ctx.createLinearGradient(c.left, c.top, c.right, c.bottom);
  g.addColorStop(0, "rgba(6,20,45,.54)");
  g.addColorStop(.48, "rgba(18,59,101,.58)");
  g.addColorStop(1, "rgba(5,7,19,.62)");
  ctx.fillStyle = g; ctx.fillRect(c.left, c.top, c.contentWidth, c.contentHeight);
  ctx.save();
  ctx.beginPath(); ctx.rect(c.left, c.top, c.contentWidth, c.contentHeight); ctx.clip();
  ctx.globalCompositeOperation = "screen";
  const count = reduced ? 10 : 22;
  for (let i = 0; i < count; i++) {
    const y = c.top + (28 + laneSeed(i, 31) * 584) * c.scale;
    const x = c.left + mod(laneSeed(i, 32) * c.contentWidth - tick * (5 + i % 3) * c.scale, c.contentWidth + 100) - 50;
    ctx.strokeStyle = i % 4 ? "rgba(79,210,255,.34)" : "rgba(207,242,255,.48)";
    ctx.lineWidth = (1 + i % 2) * c.scale;
    ctx.beginPath(); ctx.moveTo(x + (reduced ? 16 : 58) * c.scale, y); ctx.lineTo(x, y); ctx.stroke();
  }
  ctx.restore();
  const samples = 28;
  const top = [], bottom = [];
  for (let i = 0; i <= samples; i++) {
    const x = c.left + c.contentWidth * (i / samples);
    const viewTick = tick + (i / samples - c.pilotLocal / c.virtualWidth) * 80;
    const geo = corridorAt(viewTick, anchorY);
    const bridgeSpan = Math.max(160, Math.min(360, c.virtualWidth * .32)) * c.scale;
    const bridge = bridgeY == null ? 0 : smooth(1 - Math.abs(x - c.pilotX) / bridgeSpan);
    const center = bridgeY == null ? geo.center : lerp(geo.center, bridgeY, bridge);
    top.push([x, c.y(center - geo.half)]);
    bottom.push([x, c.y(center + geo.half)]);
  }
  ctx.fillStyle = "rgba(2,6,18,.92)";
  ctx.beginPath(); ctx.moveTo(c.left, c.top); top.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(c.right, c.top); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(c.left, c.bottom); bottom.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(c.right, c.bottom); ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const line of [top, bottom]) {
    ctx.strokeStyle = "rgba(88,220,255,.82)"; ctx.lineWidth = 2.2 * c.scale;
    ctx.beginPath(); line.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    ctx.strokeStyle = "rgba(151,105,255,.30)"; ctx.lineWidth = 8 * c.scale;
    ctx.beginPath(); line.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 5; i++) {
    const px = c.x(170 + i * 46 - tick * 4.5);
    const py = c.y(corridorAt(tick + i * 12, anchorY).center);
    if (px > c.left - 20 && px < c.right + 20) objectSprite(ctx, acorn, px, py, 27 * c.scale);
  }
}

function portalLayer(ctx, id, c, y, size, alpha = 1, rotation = 0) {
  drawRegistered(ctx, art[id], c.pilotX, c.y(y), size, alpha, rotation);
}

function coverRadius(c, x, y) {
  return Math.max(
    Math.hypot(x - c.left, y - c.top), Math.hypot(x - c.right, y - c.top),
    Math.hypot(x - c.left, y - c.bottom), Math.hypot(x - c.right, y - c.bottom),
  ) + 8 * c.scale;
}

function entryPortalResidual(ctx, c, y, alpha) {
  if (alpha <= 0) return;
  const size = 148 * c.scale * 2.35;
  portalLayer(ctx, "entry-mouth", c, y, size, alpha * .25);
  portalLayer(ctx, "entry-rim-back", c, y, size * .96, alpha);
  portalLayer(ctx, "entry-glyphs", c, y, size * 1.04, alpha, .47 + (1 - alpha) * .05);
}

function entryPortalResidualFront(ctx, c, y, alpha) {
  if (alpha <= 0) return;
  portalLayer(ctx, "entry-rim-front", c, y, 148 * c.scale * 2.35 * 1.08, alpha);
}

function courseBase(ctx, c, tick = 0, reduced = false) {
  backdrop(ctx, c);
  flow(ctx, c, { tick, speed: 292.5, targetY: 320, targetDistance: 420, reduced }, "far");
  flow(ctx, c, { tick, speed: 292.5, targetY: 320, targetDistance: 420, reduced }, "mid");
}

function transitionScene(W, H, kind, tick, y = 496, reduced = false) {
  const c = camera(W, H);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const portalX = c.pilotX, portalY = c.y(y), ring = 148 * c.scale;
  if (kind === "entry") {
    courseBase(ctx, c, tick, reduced);
    const p = tick <= 5 ? 1
      : tick <= 11 ? lerp(1, 1.25, seg(tick, 6, 11))
        : tick <= 23 ? lerp(1.25, 1.75, seg(tick, 12, 23))
          : tick <= 35 ? lerp(1.75, 2.15, seg(tick, 24, 35))
            : tick <= 43 ? lerp(2.15, 2.35, seg(tick, 36, 43)) : 2.35;
    const portalSize = ring * p;
    const aperture = portalSize * .32;
    const full = coverRadius(c, portalX, portalY);
    const reveal = tick < 36 ? aperture : tick <= 43 ? lerp(aperture, full * .8, seg(tick, 36, 43)) : lerp(full * .8, full, seg(tick, 44, 47));
    const windowAlpha = tick < 6 ? .2
      : tick <= 11 ? lerp(.2, .45, seg(tick, 6, 11))
        : tick <= 23 ? lerp(.45, .75, seg(tick, 12, 23)) : 1;
    ctx.save(); ctx.globalAlpha = windowAlpha; ctx.beginPath(); ctx.arc(portalX, portalY, reveal, 0, Math.PI * 2); ctx.clip(); tunnelScene(ctx, c, 0, y, reduced); ctx.restore();
    const settle = tick < 36 ? 1 : lerp(1, .25, seg(tick, 36, 47));
    portalLayer(ctx, "entry-mouth", c, y, portalSize, seg(tick, 0, 11) * settle);
    portalLayer(ctx, "entry-rim-back", c, y, portalSize * .96);
    portalLayer(ctx, "entry-glyphs", c, y, portalSize * 1.04, lerp(.18, 1, seg(tick, 12, 23)), tick * .01);
    if (!reduced && tick >= 12) {
      ctx.save(); ctx.globalAlpha = 1 - seg(tick, 36, 47); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = "rgba(103,224,255,.48)"; ctx.lineWidth = 1.5 * c.scale;
      for (let i = 0; i < 12; i++) {
        const sy = c.top + laneSeed(i, 45) * c.contentHeight;
        ctx.beginPath(); ctx.moveTo(c.right, sy); ctx.quadraticCurveTo(lerp(c.right, portalX, .62), lerp(sy, portalY, .4), portalX + aperture, portalY); ctx.stroke();
      }
      ctx.restore();
    }
    const offset = tick <= 35 ? 30 * seg(tick, 24, 35) : 30 * (1 - seg(tick, 36, 47));
    pilotSprite(ctx, c, c.pilotX + offset * c.scale, y);
    portalLayer(ctx, "entry-rim-front", c, y, portalSize * 1.08);
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = "rgba(67,210,255,.45)"; ctx.lineWidth = 5 * c.scale; ctx.beginPath(); ctx.arc(portalX, portalY, reveal, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  } else if (kind === "tunnel") {
    tunnelScene(ctx, c, tick, y, reduced);
    const residual = tick <= 5 ? 1 - tick / 6 : 0;
    entryPortalResidual(ctx, c, y, residual);
    pilotSprite(ctx, c, c.pilotX, corridorAt(tick, y).center);
    entryPortalResidualFront(ctx, c, y, residual);
  } else {
    tunnelScene(ctx, c, 359, y, reduced, y);
    const full = coverRadius(c, portalX, portalY);
    const aperture = ring * .32;
    const reveal = tick <= 9 ? lerp(aperture, full, seg(tick, 0, 9)) : full;
    ctx.save(); ctx.beginPath(); ctx.arc(portalX, portalY, reveal, 0, Math.PI * 2); ctx.clip(); courseBase(ctx, c, tick, reduced); ctx.restore();
    const p = tick <= 9 ? lerp(1, 2.15, seg(tick, 0, 9)) : tick <= 23 ? lerp(2.15, 1.3, seg(tick, 10, 23)) : tick <= 31 ? lerp(1.3, 1, seg(tick, 24, 31)) : lerp(1, .9, seg(tick, 32, 35));
    const open = tick <= 9 ? seg(tick, 0, 9) : 1;
    const alpha = open * (tick < 32 ? 1 : 1 - seg(tick, 32, 35));
    portalLayer(ctx, "return-back", c, y, ring * p, alpha);
    portalLayer(ctx, "return-glyphs", c, y, ring * p, alpha, -tick * .012);
    const offset = tick <= 9 ? 30 * seg(tick, 0, 9) : 30 * (1 - seg(tick, 10, 23));
    pilotSprite(ctx, c, c.pilotX + offset * c.scale, y);
    portalLayer(ctx, "return-front", c, y, ring * p, alpha);
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = "rgba(94,220,255,.42)"; ctx.lineWidth = 5 * c.scale; ctx.beginPath(); ctx.arc(portalX, portalY, reveal, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  hud(ctx, c, 100, kind === "entry" || kind === "tunnel" ? "ready" : "charging");
  return canvas;
}

function labelledThumb(source, label, scale = .5) {
  const W = Math.round(source.width * scale);
  const H = Math.round(source.height * scale);
  const canvas = createCanvas(W, H + 24);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#050915"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 24, W, H);
  ctx.fillStyle = "#effaff"; ctx.font = "800 12px sans-serif"; ctx.fillText(label, 8, 16);
  return canvas;
}

function colorVariant(source, mode) {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (mode === "grayscale") {
      const y = Math.round(.2126 * r + .7152 * g + .0722 * b);
      d[i] = y; d[i + 1] = y; d[i + 2] = y;
    } else {
      // Machado-style deuteranopia review transform. This is evidence-only;
      // the game does not alter player color output.
      d[i] = clamp(Math.round(.367 * r + .861 * g - .228 * b), 0, 255);
      d[i + 1] = clamp(Math.round(.280 * r + .673 * g + .047 * b), 0, 255);
      d[i + 2] = clamp(Math.round(-.012 * r + .043 * g + .969 * b), 0, 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function sheet(items, cols, path) {
  const cellW = Math.max(...items.map((i) => i.width));
  const cellH = Math.max(...items.map((i) => i.height));
  const rows = Math.ceil(items.length / cols);
  const canvas = createCanvas(cellW * cols, cellH * rows);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#030611"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  items.forEach((item, i) => ctx.drawImage(item, (i % cols) * cellW, Math.floor(i / cols) * cellH));
  writeFileSync(path, canvas.toBuffer("image/png"));
  return { width: canvas.width, height: canvas.height };
}

function gif(path, frames, delay = 33, scale = .5) {
  const W = Math.round(frames[0].width * scale);
  const H = Math.round(frames[0].height * scale);
  const temp = createCanvas(W, H);
  const ctx = temp.getContext("2d");
  const encoder = new GifEncoder(W, H, { repeat: 0, quality: 12 });
  for (const frame of frames) {
    ctx.clearRect(0, 0, W, H); ctx.drawImage(frame, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    encoder.addFrame(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), W, H, { delay });
  }
  writeFileSync(path, encoder.finish());
}

const outputs = {};
const gatesPath = join(outDir, "phase-b-gates-landscape.png");
outputs.gates = { path: gatesPath, ...sheet([
  labelledThumb(gateScene(844, 390, { state: "pending", distance: 430, gateY: 144, targetY: 144, charge: 95 }), "PENDING + DIRECTOR"),
  labelledThumb(gateScene(844, 390, { state: "passed", age: 0, distance: 0, deltas: [5], charge: 100, route: "ready" }), "PASS AGE 0 / +5"),
  labelledThumb(gateScene(844, 390, { state: "passed", age: 3, distance: -18, charge: 100, route: "ready" }), "PASS AGE 3 SHELL"),
  labelledThumb(gateScene(844, 390, { state: "passed", age: 9, distance: -54, charge: 100, route: "ready" }), "PASS AGE 9 SHELL"),
  labelledThumb(gateScene(844, 390, { state: "passed", age: 18, distance: -108, charge: 95, deltas: [5, -10] }), "PASS + DEBRIS CUES"),
  labelledThumb(gateScene(844, 390, { state: "passed", age: 26, distance: -156, charge: 100, route: "ready" }), "PASS AGE 26 FADE"),
  labelledThumb(gateScene(844, 390, { state: "missed", age: 0, distance: 0, gateY: 220, pilotY: 320 }), "MISS AGE 0 / CAPTURED PLANE"),
  labelledThumb(gateScene(844, 390, { state: "missed", age: 9, distance: -54, gateY: 220, pilotY: 320 }), "MISS AGE 9 / ANCHORED CUE"),
  labelledThumb(gateScene(844, 390, { state: "pending", distance: 180, gateY: 496, targetY: 496, partialArt: true, route: "final", charge: 100 }), "PARTIAL ART -> FULL FALLBACK"),
], 3, gatesPath) };

const motionPath = join(outDir, "phase-b-normal-flow.gif");
const motionFrames = Array.from({ length: 72 }, (_, i) => gateScene(844, 390, {
  state: i < 36 ? "pending" : "passed", age: i - 36, distance: Math.max(-210, 430 - i * 12),
  gateY: i < 36 ? 144 : 320, targetY: i < 36 ? 144 : 496, targetDistance: i < 36 ? 430 - i * 12 : 480,
  tick: i * 2, speed: i < 36 ? 225 : 360, deltas: i === 36 ? [5] : [], charge: i < 36 ? 95 : 100,
}));
gif(motionPath, motionFrames, 33, .5);
outputs.normalFlow = { path: motionPath, frames: motionFrames.length, fps: 30 };

const reducedMotionPath = join(outDir, "phase-b-normal-flow-reduced.gif");
const reducedMotionFrames = Array.from({ length: 72 }, (_, i) => gateScene(844, 390, {
  state: i < 36 ? "pending" : "passed", age: i - 36, distance: Math.max(-210, 430 - i * 12),
  gateY: i < 36 ? 144 : 320, targetY: i < 36 ? 144 : 496, targetDistance: i < 36 ? 430 - i * 12 : 480,
  tick: i * 2, speed: i < 36 ? 225 : 360, reduced: true, deltas: i === 36 ? [5] : [], charge: i < 36 ? 95 : 100,
}));
gif(reducedMotionPath, reducedMotionFrames, 33, .5);
outputs.reducedMotion = { path: reducedMotionPath, frames: reducedMotionFrames.length, fps: 30 };

const entryTicks = [0, 6, 12, 24, 35, 36, 43, 47];
const entryPath = join(outDir, "phase-b-entry-y496.png");
outputs.entry = { path: entryPath, ...sheet([
  ...entryTicks.map((t) => labelledThumb(transitionScene(844, 390, "entry", t, 496), `ENTRY ${t}`)),
  labelledThumb(transitionScene(844, 390, "tunnel", 0, 496), "TUNNEL 0"),
  labelledThumb(transitionScene(844, 390, "tunnel", 5, 496), "TUNNEL 5"),
], 5, entryPath) };

const entryGifPath = join(outDir, "phase-b-entry-to-tunnel.gif");
const entryFrames = [
  ...Array.from({ length: 48 }, (_, t) => transitionScene(844, 390, "entry", t, 496)),
  ...Array.from({ length: 6 }, (_, t) => transitionScene(844, 390, "tunnel", t, 496)),
];
gif(entryGifPath, entryFrames, 17, .5);
outputs.entryClip = { path: entryGifPath, frames: entryFrames.length, fps: 60, sourceTicks: 54 };

const returnTicks = [0, 5, 9, 10, 23, 35];
const returnPath = join(outDir, "phase-b-return-extremes.png");
outputs.return = { path: returnPath, ...sheet([
  ...returnTicks.map((t) => labelledThumb(transitionScene(844, 390, "return", t, 96), `Y96 RETURN ${t}`)),
  ...returnTicks.map((t) => labelledThumb(transitionScene(844, 390, "return", t, 544), `Y544 RETURN ${t}`)),
], 6, returnPath) };

const returnGifPath = join(outDir, "phase-b-return.gif");
const returnFrames = Array.from({ length: 36 }, (_, t) => transitionScene(844, 390, "return", t, 544));
gif(returnGifPath, returnFrames, 17, .5);
outputs.returnClip = { path: returnGifPath, frames: returnFrames.length, fps: 60 };

const accessibilityPath = join(outDir, "phase-b-accessibility-and-density.png");
outputs.accessibility = { path: accessibilityPath, ...sheet([
  labelledThumb(gateScene(844, 390, { state: "pending", distance: 430, gateY: 144, targetY: 144, speed: 360 }), "DEFAULT / CAP SPEED"),
  labelledThumb(gateScene(844, 390, { state: "pending", distance: 430, gateY: 144, targetY: 144, speed: 360, reduced: true }), "REDUCED MOTION"),
  labelledThumb(transitionScene(844, 390, "tunnel", 180, 496), "LOW PINCH + PICKUPS"),
  labelledThumb(transitionScene(844, 390, "tunnel", 255, 496), "BOOST CREST"),
  labelledThumb(transitionScene(844, 390, "tunnel", 285, 496, true), "DROP RECOVERY / REDUCED"),
  labelledThumb(gateScene(844, 390, { state: "passed", age: 18, distance: -100, deltas: [5, -10], speed: 360 }), "DENSE CUE COEXISTENCE"),
], 3, accessibilityPath) };

const colorReviewPath = join(outDir, "phase-b-grayscale-deuteranopia.png");
const colorPass = gateScene(844, 390, { state: "passed", age: 9, distance: -54, charge: 100, route: "ready" });
const colorMiss = gateScene(844, 390, { state: "missed", age: 9, distance: -54, gateY: 220, pilotY: 320 });
outputs.colorReview = { path: colorReviewPath, ...sheet([
  labelledThumb(colorPass, "PASS / DEFAULT"),
  labelledThumb(colorVariant(colorPass, "grayscale"), "PASS / GRAYSCALE"),
  labelledThumb(colorVariant(colorPass, "deuteranopia"), "PASS / DEUTERANOPIA"),
  labelledThumb(colorMiss, "MISS / DEFAULT"),
  labelledThumb(colorVariant(colorMiss, "grayscale"), "MISS / GRAYSCALE"),
  labelledThumb(colorVariant(colorMiss, "deuteranopia"), "MISS / DEUTERANOPIA"),
], 3, colorReviewPath) };

const responsivePath = join(outDir, "phase-b-responsive.png");
const responsive = [
  [360, 640], [390, 844], [844, 390], [1440, 900], [1600, 600],
].map(([W, H]) => labelledThumb(gateScene(W, H, { state: "pending", distance: 430, gateY: 144, targetY: 144 }), `${W}x${H}`, Math.min(.5, 360 / W)));
outputs.responsive = { path: responsivePath, ...sheet(responsive, 3, responsivePath) };

const canonical = camera(360, 640);
if (canonical.scale !== 1 || canonical.left !== 0 || canonical.top !== 0 || canonical.pilotX !== 96) {
  throw new Error(`Canonical camera drifted: ${JSON.stringify(canonical)}`);
}
const landscape = camera(844, 390);
if (landscape.virtualWidth < 1384 || landscape.virtualWidth > 1386 || landscape.pilotLocal < 276 || landscape.pilotLocal > 278) {
  throw new Error(`Landscape camera contract drifted: ${JSON.stringify(landscape)}`);
}

const manifestPath = join(outDir, "manifest.json");
const manifest = {
  generatedFrom: "illustrated-src/review-hyper-run-r3.mjs Phase B reference renderer",
  generatedOutsideRepository: !isInside(root, outDir),
  approvedArtInputs: artIds,
  camera: {
    canonical: { scale: canonical.scale, left: canonical.left, top: canonical.top, pilotX: canonical.pilotX, virtualWidth: canonical.virtualWidth },
    landscape: { scale: landscape.scale, left: landscape.left, top: landscape.top, pilotX: landscape.pilotX, virtualWidth: landscape.virtualWidth },
  },
  outputs,
  visualContracts: [
    "side-view future-to-past flow with no central vanishing point",
    "pass shell remains on the stamped pilot plane and is split behind/in front",
    "partial gate pairs use one procedural full-ring fallback",
    "entry pilot returns to the authority plane at tick 47/tunnel tick 0",
    "return pilot is continuous at ticks 9/10",
    "Y496 entry and Y96/Y544 return extremes are included",
    "reduced motion preserves walls, shell, meter, and director",
  ],
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outDir, manifestPath, outputs, assertions: "passed" })}\n`);
