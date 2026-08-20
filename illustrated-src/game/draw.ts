import {SKY_RGB,  ENVS, HELMETS, PHYS, SUITS, TRAILS, TUT_ARM, skyIdFor, washScale, wearsOwnHead } from "./catalog";
import { drawTrailPreviewOn, drawPalOn, drawAstronautOn } from "./cosmetics";
import { drawSprite, skyImage, type ArtBank, type Sprite } from "./art";
import { retroBackdrop, retroPlanet, retroObstacle, retroAcorn, retroBlocker } from "./retro";
import type { SaveData } from "./save";
import type { Particle, World } from "./sim";

function frameOf<T>(list: T[], t: number, speed = 6) {
  if (!list.length) return null;
  return list[Math.floor(t * speed) % list.length];
}

function liveGapY(p: World["planets"][number]) {
  return p.gapY + Math.sin(p.drift) * p.driftAmp;
}

function applyWarp(ctx: CanvasRenderingContext2D, w: World) {
  const lost = w.flight === "lost";
  const wp = w.warpT > 0 ? 1 - w.warpT : w.warpLeft > 0 || lost ? 1 : 0;
  if (wp <= 0) return;
  ctx.translate(w.W / 2, w.H / 2);
  const spin = w.warpT > 0 ? Math.sin(wp * Math.PI) * 2.6 : 0;
  ctx.rotate(w.prevTilt + (w.warpTilt - w.prevTilt) * wp + spin);
  const mFrom = w.prevMirror ? -1 : 1;
  const mTo = w.warpMirror ? -1 : 1;
  ctx.scale(mFrom + (mTo - mFrom) * wp, 1);
  ctx.translate(-w.W / 2, -w.H / 2);
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const scale = Math.max(W / Math.max(1, sw), H / Math.max(1, sh));
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

/** How bright the sky is right now, across an environment crossfade. */
export function skyLuma(w: World) {
  const lum = (id: keyof typeof SKY_RGB) => {
    const c = SKY_RGB[id] ?? [0.1, 0.1, 0.2];
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const a = lum(skyIdFor(w.flight, w.envA));
  const b = lum(skyIdFor(w.flight, w.envB));
  return a + (b - a) * w.envBlend;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: World, art: ArtBank) {
  const { W, H } = w;
  // each environment flies under its own painted sky; shifts crossfade
  const skyA = skyImage(skyIdFor(w.flight, w.envA));
  const skyB = skyImage(skyIdFor(w.flight, w.envB));
  const painted = skyB ?? skyA;
  if (painted) {
    coverDraw(ctx, skyA ?? painted, W, H);
    if (skyB && skyA && skyB !== skyA && w.envBlend > 0) {
      ctx.globalAlpha = w.envBlend;
      coverDraw(ctx, skyB, W, H);
      ctx.globalAlpha = 1;
    }
    // Readability scrim, scaled to how bright this sky is: a white
    // nebula gets a real veil so gates and debris stay readable against
    // it, a black void barely any. This is what stops the white-on-white
    // blindness without dulling the art everywhere.
    const lum = skyLuma(w);
    // A plate that is already void-dark needs almost no scrim — flooring
    // it at 0.16 only greys out the nebula it was chosen for.
    const floor = Math.min(0.16, lum * 0.8);
    const veil = Math.max(floor, Math.min(0.52, 0.16 + (lum - 0.2) * 0.62));
    ctx.fillStyle = `rgba(7,11,22,${veil.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  } else if (art.sky) {
    coverDraw(ctx, art.sky, W, H);
    ctx.fillStyle = "rgba(7,11,22,0.28)";
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#070b18");
    g.addColorStop(1, "#10182c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const env = ENVS[w.envB];
  const envA = ENVS[w.envA];
  const blend = w.envBlend;
  const ws = washScale(w.flight);
  const wash = env.wash.map((v, i) => (envA.wash[i] + (v - envA.wash[i]) * blend) * (i === 3 ? ws : 1)) as number[];
  ctx.fillStyle = `rgba(${wash[0]},${wash[1]},${wash[2]},${wash[3]})`;
  ctx.beginPath();
  ctx.ellipse(W * 0.68, H * 0.28, W * 0.55, H * 0.28, 0.25, 0, Math.PI * 2);
  ctx.fill();
  const wash2 = env.wash2.map((v, i) => (envA.wash2[i] + (v - envA.wash2[i]) * blend) * (i === 3 ? ws : 1)) as number[];
  ctx.fillStyle = `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${wash2[3]})`;
  ctx.beginPath();
  ctx.ellipse(W * 0.22, H * 0.78, W * 0.45, H * 0.22, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // the environment owns the WHOLE sky, not two soft pools — a graded
  // full-screen tint makes each 20-gate shift unmistakable
  const grade = ctx.createLinearGradient(0, 0, 0, H);
  grade.addColorStop(0, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.42, wash[3] * 1.9)})`);
  grade.addColorStop(0.55, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.2, wash[3] * 0.9)})`);
  grade.addColorStop(1, `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${Math.min(0.4, wash2[3] * 2.2)})`);
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, W, H);

  for (const s of w.stars) {
    ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(s.tw));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawWorld(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank) {
  const { W, H } = w;
  ctx.save();
  if (w.shake > 0) {
    const mag = w.shake * 10;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  // Sky stays upright. Warp only tilts the playfield (live does the same).
  if (w.retro) retroBackdrop(ctx, W, H, w.envA, w.envB, w.envBlend, w.stars);
  else drawBackdrop(ctx, w, art);

  ctx.save();
  applyWarp(ctx, w);

  if (w.retro) {
    drawRetroWorld(ctx, w, save, art);
    ctx.restore();
    ctx.restore();
    return;
  }

  // Everything you can hit gets a separation halo keyed to the sky: a
  // dark drop shadow on bright skies, a faint light rim on dark ones.
  // Gates and debris then read as solid objects against any backdrop.
  const halo: "dark" | "light" = skyLuma(w) > 0.42 ? "dark" : "light";
  for (const p of w.planets) {
    const gy = liveGapY(p);
    drawPlanet(ctx, art, p.x, gy - p.gap / 2 - p.r, p.r, p.topKind, halo);
    drawPlanet(ctx, art, p.x, gy + p.gap / 2 + p.r, p.r, p.botKind, halo);
    for (const b of p.blockers) {
      const by = b.y + Math.sin(p.drift) * p.driftAmp;
      const bx = p.x + b.xOff;
      const img = art.debris[b.debris];
      if (img) drawSprite(ctx, img, bx, by, b.r * 2, "core", halo);
      else drawPlanet(ctx, art, bx, by, b.r, b.kind, halo);
    }
  }

  for (const a of w.pickups) {
    if (a.got) continue;
    const y = a.y + Math.sin(a.bob) * 4;
    if (a.kind === "acorn") drawSprite(ctx, frameOf(art.acorn, w.time, 5), a.x, y, 28);
    else if (a.kind === "gold") drawSprite(ctx, frameOf(art.golden, w.time, 6), a.x, y, 32);
    else if (a.kind === "slow") {
      // the frozen acorn is its own painting now — no ring needed to say
      // what it does, the frost says it
      if (art.frozen) drawSprite(ctx, art.frozen, a.x, y, 32);
      else drawSprite(ctx, frameOf(art.acorn, w.time, 6), a.x, y, 28);
      ctx.strokeStyle = `rgba(150,225,255,${0.28 + 0.16 * Math.sin(w.time * 6)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(a.x, y, 20 + Math.sin(w.time * 6) * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.kind === "shield") {
      if (art.shieldnut) drawSprite(ctx, art.shieldnut, a.x, y, 34);
      else drawSprite(ctx, frameOf(art.shield, w.time, 5), a.x, y, 34);
    }
    else if (a.kind === "hole" || a.kind === "worm") {
      drawVortex(ctx, a.x, y, a.kind === "worm", w.time, a.r ?? 28);
    } else if (a.kind === "retro") {
      drawShiftAcorn(ctx, art, a.x, y, w.time);
    }
  }

  for (const p of w.particles) drawParticle(ctx, p);

  const pal =
    w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo" || w.tut.stage === "ready")
      ? "buddy"
      : save.equippedPal;
  if (pal && pal !== "none") {
    const bob = Math.sin(w.time * 2.6) * 2;
    paintPal(ctx, art, pal, w.palPos.x, w.palPos.y + bob, 26);
  }

  drawPilot(ctx, w, save, art);

  // The shield and golden rings belong to the PILOT, so they must be
  // drawn inside the warp transform with him. Outside it they were laid
  // down in untransformed screen space, and in Lost in Space — where the
  // world rotates continuously — they drifted off on their own.
  if (w.invulnLeft > 0) {
    ctx.strokeStyle = `rgba(255,208,96,${0.35 + 0.25 * Math.sin(w.time * 10)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (w.shieldCharges > 0) {
    ctx.strokeStyle = "rgba(122,216,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

// The other timeline. Same planets in the same places, same rocks with
// the same seeds — only the hand painting them changes. Everything a
// player can touch comes from the identical world objects, so a shift
// never changes what is solid, only what it looks like.
function drawRetroWorld(
  ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank,
) {
  const { W } = w;
  for (const p of w.planets) {
    const gy = liveGapY(p);
    retroPlanet(ctx, p.x, gy - p.gap / 2 - p.r, p.r, p.topKind);
    retroPlanet(ctx, p.x, gy + p.gap / 2 + p.r, p.r, p.botKind);
    for (const b of p.blockers) {
      const by = b.y + Math.sin(p.drift) * p.driftAmp;
      retroObstacle(ctx, p.x + b.xOff, by, { r: b.r, ...retroBlocker(w.envB, b.debris, b.y) });
    }
  }

  for (const a of w.pickups) {
    if (a.got) continue;
    const y = a.y + Math.sin(a.bob) * 4;
    if (a.kind === "retro") {
      drawShiftAcorn(ctx, art, a.x, y, w.time);
      continue;
    }
    const power =
      a.kind === "gold" ? "golden"
        : a.kind === "shield" ? "shield"
          : a.kind === "hole" ? "blackhole"
            : a.kind === "worm" ? "wormhole"
              : a.kind === "slow";
    retroAcorn(ctx, a.x, y, power);
  }

  for (const p of w.particles) drawParticle(ctx, p);

  const pal =
    w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo" || w.tut.stage === "ready")
      ? "buddy"
      : save.equippedPal;
  if (pal && pal !== "none") {
    const bob = Math.sin(w.time * 2.6) * 2;
    // live draws its pals at unit SCALE, not at a pixel size
    drawPalOn(ctx, pal, w.palPos.x, w.palPos.y + bob, 1, w.time);
  }

  const helm = HELMETS.find((h) => h.id === save.equipped) ?? HELMETS[0];
  const suit = SUITS.find((u) => u.id === save.equippedSuit) ?? SUITS[0];
  drawAstronautOn(ctx, W * PHYS.squirrelX, w.squirrel.y, w.squirrel.rot, 1, helm, suit, {
    flame: w.flapBoost > 0 ? w.flapBoost / 0.22 : 0,
    seed: 0,
    shield: w.shieldCharges > 0,
  });
}

// The door itself. Painted in the arcade's own pixels either way, so it
// reads the same from both sides — this is the one object that belongs
// to neither timeline.
function drawShiftAcorn(
  ctx: CanvasRenderingContext2D, art: ArtBank, x: number, y: number, t: number,
) {
  const spr = art.arcadeAcorn;
  const glow = 20 + Math.sin(t * 5) * 4;
  const g = ctx.createRadialGradient(x, y, 2, x, y, glow + 12);
  g.addColorStop(0, "rgba(255,214,96,0.55)");
  g.addColorStop(0.5, "rgba(255,170,40,0.22)");
  g.addColorStop(1, "rgba(255,170,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, glow + 12, 0, Math.PI * 2);
  ctx.fill();
  // the four cardinal sparks from the source art, kept as real pixels
  ctx.fillStyle = "#ffd83f";
  const d = 20 + Math.sin(t * 5) * 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + t * 0.8;
    ctx.fillRect(Math.round(x + Math.cos(a) * d) - 2, Math.round(y + Math.sin(a) * d) - 2, 4, 4);
  }
  if (spr) {
    ctx.imageSmoothingEnabled = false;
    drawSprite(ctx, spr, x, y, 30);
    ctx.imageSmoothingEnabled = true;
  }
}

function drawVortex(
  ctx: CanvasRenderingContext2D, x: number, y: number, worm: boolean, t: number, reach = 28,
) {
  // the swirl fills its reach: a hazard you can see the full width of
  const k = reach / 28;
  const pulse = (12 + Math.sin(t * 6) * 3) * k;
  const grd = ctx.createRadialGradient(x, y, 2 * k, x, y, pulse + 14 * k);
  grd.addColorStop(0, worm ? "#d8f6ff" : "#1a1028");
  grd.addColorStop(0.45, worm ? "#4ad8ff" : "#6a2a9a");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, pulse + 14 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * (worm ? 3 : -2.2));
  ctx.strokeStyle = worm ? "rgba(180,240,255,0.55)" : "rgba(180,90,255,0.45)";
  ctx.lineWidth = 1.4 * Math.max(1, k * 0.7);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, (6 + i * 5) * k, i, i + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const t = Math.max(0, p.life / p.max);
  ctx.globalAlpha = t;
  const kind = p.kind || "spark";
  if (kind === "ion") {
    ctx.strokeStyle = t > 0.5 ? "#c8f4ff" : "#3ac0f0";
    ctx.lineWidth = Math.max(0.8, p.r * t);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 9, p.y);
    ctx.stroke();
  } else if (kind === "bubble") {
    ctx.strokeStyle = "rgba(170,220,255,0.9)";
    ctx.lineWidth = 1;
    const br = t > 0.25 ? p.r : p.r * (1 + (0.25 - t) * 6);
    ctx.beginPath();
    ctx.arc(p.x, p.y, br, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(200,235,255,0.25)";
    ctx.beginPath();
    ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "bloom") {
    ctx.fillStyle = t > 0.5 ? "#f0b8ff" : "#a45cd8";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (2 - t), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = t * 0.5;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "comet") {
    const len = 10 + p.r * 3;
    const grad = ctx.createLinearGradient(p.x, p.y, p.x + len, p.y);
    grad.addColorStop(0, "#fff8d0");
    grad.addColorStop(0.4, "#ff9d47");
    grad.addColorStop(1, "rgba(255,64,32,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1, p.r * t);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + len, p.y);
    ctx.stroke();
  } else if (kind === "cometcore") {
    ctx.fillStyle = "#fff8d0";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "prism") {
    ctx.fillStyle = `hsl(${p.hue || 0} 90% 65%)`;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((p.hue || 0) * Math.PI) / 180);
    ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
    ctx.restore();
  } else if (kind === "plasma") {
    ctx.strokeStyle = "#b45cff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    const seed = p.seed || 1;
    ctx.lineTo(p.x + 8, p.y + Math.sin(seed) * 6);
    ctx.lineTo(p.x + 16, p.y - Math.cos(seed) * 4);
    ctx.stroke();
  } else if (kind === "plasmacore") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "galaxy") {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = t * 0.5;
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.x - 0.6, p.y - 2.4, 1.2, 4.8);
    ctx.fillRect(p.x - 2.4, p.y - 0.6, 4.8, 1.2);
  } else if (kind === "aurora") {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = t * 0.55;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * 2.2, p.r * 0.7, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "frost") {
    ctx.strokeStyle = "#9fe4ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.r);
    ctx.lineTo(p.x, p.y + p.r);
    ctx.moveTo(p.x - p.r, p.y);
    ctx.lineTo(p.x + p.r, p.y);
    ctx.stroke();
  } else if (kind === "voidsmoke") {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = t * 0.35;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1.6 - t), 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "supernova") {
    ctx.fillStyle = t > 0.5 ? "#fff8d0" : t > 0.25 ? "#ff9d47" : "#ff4020";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1.4 - t * 0.4), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  art: ArtBank,
  x: number,
  y: number,
  r: number,
  kind: number,
  halo?: "dark" | "light",
) {
  const img = art.planets[kind % art.planets.length];
  if (img) {
    drawSprite(ctx, img, x, y, r * 2, "core", halo);
    return;
  }
  ctx.fillStyle = "#3a6aa8";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function hexRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Where the glass dome sits in each 256px body render (x, y, radius),
// measured from the paintings themselves. Flight frames key by frame
// name, suit renders by suit id. The equipped helmet paints its
// identity — tinted glass, rim, glow — exactly onto the painted dome.
// Where the painted helmet sits on each body (x, y, r in sprite space).
// Seraph, Leviathan, Gemmie and Sammie ship bare-headed — their art
// carries no helmet of its own.
//
// MEASURED, not assumed. Flight's anchor is the reference: r 51. Every
// other suit's head is found by matching flight's face against it — the
// face is the same drawing in every render, so this works whether the suit
// is orange, chrome, white or green, and it reads straight through a clear
// dome.
//
// The thirteen original suits all measure 48.5-52.5 (median 51), so they
// were already right. The four bare-headed renders are drawn 111-116% of
// that, because a render with no dome and a different tail sweep normalises
// differently into the same 242px box. Assuming one radius for all of them
// is what made the same helmet read huge on one suit and small on the next.
const DOME: Record<string, [number, number, number]> = {
  "idle-1": [191, 103, 51],
  "idle-2": [192, 103, 51],
  "idle-3": [192, 102, 53],
  "idle-4": [194, 99, 51],
  "flap-1": [166, 96, 52],
  "flap-2": [164, 93, 50],
  "flap-3": [164, 79, 48],
  "flap-4": [163, 80, 45],
  // The twelve originals were re-rendered bare-headed, so every one of
  // these was measured again against flight's face. Ghost is the exception
  // and still wears a painted dome -- see bakedDome in catalog.ts.
  "suit:flight": [194, 97, 50],
  "suit:iontrim": [197, 100, 58],
  "suit:copper": [196, 99, 54],
  "suit:frost": [196, 109, 50],
  "suit:voidsuit": [191, 110, 47],
  "suit:aurorasuit": [194, 107, 53],
  "suit:ember": [195, 106, 49],
  "suit:stardust": [194, 107, 52],
  "suit:robo": [194, 105, 50],
  "suit:alien": [193, 112, 54],
  "suit:ghost": [191, 99, 49],
  "suit:bigbooty": [190, 115, 54],
  "suit:catsuit": [212, 86, 50],
  "suit:gemmie": [204, 92, 58],
  "suit:phoenix": [207, 92, 41],
  "suit:sammie": [206, 90, 59],
  "suit:seraph": [204, 85, 57],
  "suit:leviathan": [207, 81, 57],
};

// Where the GLASS circle sits inside each helmet-only render (x, y, r).
// All twelve helmets have a solo render; the tinted-ring path below
// stays as the fallback for any helmet added later.
//
// An optional FOURTH number is a rotation in degrees about the glass
// centre, for the asymmetric shells — a crown, a halo, a horn — that sit
// level in their own render but want a tilt once they are on a head. No
// helmet uses it yet, so every entry below is three numbers and draws
// exactly as it did before the field existed. The rig editor writes it.
const HELM_GLASS: Record<string, [number, number, number] | [number, number, number, number]> = {
  comet: [129, 129, 125],
  "clear": [129, 128, 111],
  "ion": [129, 128, 125],
  "solar": [128, 128, 125],
  "nebula": [129, 129, 125],
  "lunar": [129, 126, 125],
  "void": [125, 128, 125],
  "cherry": [126, 128, 125],
  // Royal wears a crown, so its sphere is scaled down inside the frame
  // and never measured 125 like the bare bubbles. Measured off the art.
  "royal": [124, 156, 98],
  "aurora": [128, 127, 125],
  "meteor": [128, 127, 125],
  "chrono": [132, 126, 125],
  // measured off the corrected art. These renders are three-quarter
  // views, so the visor sits right of frame centre — that offset is real
  // and paintDome relies on it to seat the helmet on the head.
  "gemmie": [128, 128, 104],
  "phoenix": [128, 128, 106],
  "seraph": [125, 151, 110],
  "chronarch": [127, 128, 136],
  "paladin": [130, 144, 115],
  // Princess is a shell with a face opening, not a bubble, so the head does
  // not sit at the shell's centre — it sits behind the opening, back from it
  // by about a fifth of its own radius, because the squirrel's face is
  // forward of its head centre. Centred on the shell it put the whole face
  // behind cream lacquer.
  "princess": [174, 121, 126],
  // Sammie is the plain lacquer dome now, not the horned samurai. Measuring
  // its visor field gave 78, which drew the helmet half again too big — the
  // shell hides most of the sphere's edge, so the visible visor is nothing
  // like the glass radius. Like princess it is a shell with an opening, so
  // its centre sits behind that opening rather than in the middle of the
  // frame; centred, the muzzle hung over the rim on every suit.
  "sammie": [150, 114, 102],
  // Leviathan's visor is deep teal, too dark for a brightness fit to see,
  // so it keeps the family default.
  "leviathan": [134, 126, 85],
};

// The real helmet art, its glass centre punched translucent once so the
// pilot's face shows through when it is composited onto the head.
const punchedCache = new Map<string, HTMLCanvasElement>();
function punchedHelm(spr: Sprite, id: string) {
  const hit = punchedCache.get(id);
  if (hit) return hit;
  const g = HELM_GLASS[id];
  const c = document.createElement("canvas");
  c.width = spr.width;
  c.height = spr.height;
  const cc = c.getContext("2d");
  if (!cc || !g) return null;
  cc.drawImage(spr, 0, 0);
  const grad = cc.createRadialGradient(g[0], g[1], g[2] * 0.1, g[0], g[1], g[2] * 0.82);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.3)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  cc.globalCompositeOperation = "destination-out";
  cc.fillStyle = grad;
  cc.fillRect(0, 0, c.width, c.height);
  cc.globalCompositeOperation = "source-over";
  punchedCache.set(id, c);
  return c;
}

// Where each rigged suit's tail hinges, in its own 256px canvas.
const TAIL_PIVOT: Record<string, [number, number]> = {
  flight: [97, 177],
  iontrim: [98, 178],
  copper: [98, 178],
  frost: [97, 177],
  voidsuit: [97, 178],
  aurorasuit: [99, 178],
  ember: [97, 177],
  stardust: [97, 178],
  robo: [98, 178],
  alien: [96, 177],
  ghost: [98, 178],
  bigbooty: [94, 180],
  catsuit: [96, 179],
  gemmie: [97, 178],
  // Sammie's rig was cut from the OLD helmeted render and never re-cut when
  // she was re-drawn bare-headed, so in flight she wore a painted-on dome
  // under the real one. Re-cut against the current art, her plume meets the
  // hip further forward and higher than the old pose's 98,178 -- at the old
  // pivot the tail visibly unhooked from her body at full swing.
  sammie: [128, 166],
  // Seraph and Leviathan stand rather than fly, so their tail meets the hip
  // higher and further forward than the flying pose's shared 95,179.
  seraph: [101, 173],
  leviathan: [91, 162],
};

// Draw one layer of a rigged suit. Both layers are full-canvas, so they
// are placed against the WHOLE suit's trimmed box — that is what keeps
// tail and body registered to each other however either one is cropped.
function drawRigLayer(
  ctx: CanvasRenderingContext2D,
  layer: Sprite | HTMLImageElement,
  ref: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
  size: number,
  rot = 0,
  pivot?: [number, number],
) {
  const scale = size / Math.max(1, Math.max(ref.w, ref.h));
  // top-left of the full canvas, in screen space
  const ox = x - (ref.w * scale) / 2 - ref.x * scale;
  const oy = y - (ref.h * scale) / 2 - ref.y * scale;
  ctx.save();
  if (rot && pivot) {
    const px = ox + pivot[0] * scale;
    const py = oy + pivot[1] * scale;
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.translate(-px, -py);
  }
  ctx.drawImage(layer, ox, oy, layer.width * scale, layer.height * scale);
  ctx.restore();
}


// Which art still has a helmet painted into it. The eight flight animation
// frames do (they were never re-rendered), and so does any suit flagged
// bakedDome in the catalog. Everything else ships bare-headed and needs a
// helmet drawn on it — including Clear.
function bakedDome(key: string) {
  if (!key.startsWith("suit:")) return true;
  const id = key.slice(5);
  return SUITS.some((u) => u.id === id && u.bakedDome === true);
}

function paintDome(
  ctx: CanvasRenderingContext2D,
  body: Sprite | HTMLImageElement,
  key: string,
  helmet: (typeof HELMETS)[number],
  x: number,
  y: number,
  size: number,
  art?: ArtBank | null,
) {
  // The Clear helmet used to draw nothing at all, because every suit render
  // had a clear dome painted into it. Most are bare-headed now, so Clear has
  // to paint its own — otherwise picking it leaves the pilot in a vacuum
  // bare-faced. Only the art that still carries a dome skips it: the eight
  // flight animation frames, and the suits flagged bakedDome.
  if (helmet.id === "clear" && bakedDome(key)) return;
  const a = DOME[key];
  if (!a) return;
  const box = (body as Sprite).box ?? { x: 0, y: 0, w: body.width, h: body.height };
  const scale = size / Math.max(1, Math.max(box.w, box.h));
  const hx = x - (box.w * scale) / 2 + (a[0] - box.x) * scale;
  const hy = y - (box.h * scale) / 2 + (a[1] - box.y) * scale;
  const r = a[2] * scale;
  // the REAL helmet render sits on the head — scaled so its glass circle
  // matches the painted dome exactly
  const helmSpr = art?.helms?.[helmet.id];
  const g = HELM_GLASS[helmet.id];
  if (helmSpr && g) {
    const punched = punchedHelm(helmSpr, helmet.id);
    if (punched) {
      const s2 = (r * 1.04) / g[2];
      const rot = g[3] || 0;
      if (rot) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.translate(-hx, -hy);
      }
      ctx.drawImage(punched, hx - g[0] * s2, hy - g[1] * s2,
                    punched.width * s2, punched.height * s2);
      if (rot) ctx.restore();
      return;
    }
  }
  const v = hexRgb(helmet.visor);
  ctx.save();
  const grad = ctx.createRadialGradient(hx - r * 0.25, hy - r * 0.3, r * 0.2, hx, hy, r);
  grad.addColorStop(0, `rgba(${v.r},${v.g},${v.b},0.08)`);
  grad.addColorStop(0.7, `rgba(${v.r},${v.g},${v.b},0.26)`);
  grad.addColorStop(1, `rgba(${v.r},${v.g},${v.b},0.4)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  ctx.fill();
  if (helmet.glow) {
    ctx.shadowColor = helmet.glow;
    ctx.shadowBlur = r * 0.55;
  }
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.strokeStyle = helmet.rim;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(hx, hy, r * 0.97, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function paintIllustrated(
  ctx: CanvasRenderingContext2D,
  spr: Sprite | HTMLImageElement | null | undefined,
  x: number,
  y: number,
  size: number,
  helmet: (typeof HELMETS)[number],
  suit: (typeof SUITS)[number],
  _t = 0,
  art?: ArtBank | null,
  frameKey = "idle-1",
  sprNext?: Sprite | HTMLImageElement | null,
  keyNext?: string,
  blend = 0,
  halo: "dark" | "light" = "dark",
  tailRot = 0,
) {
  // the equipped suit IS the body: its painted render replaces the
  // default flight frames, carried by the pilot's motion
  const suited = suit.id !== "flight" ? (art?.suits?.[suit.id] ?? null) : null;
  const body = suited ?? spr;
  if (!body) return;

  // A rigged suit draws as two pieces with the tail hinged, so a tap
  // actually moves something. The tail goes down first — it sits behind
  // the pilot — then the body over it.
  const rigT = suited ? art?.suitTail?.[suit.id] : null;
  const rigB = suited ? art?.suitBody?.[suit.id] : null;
  if (rigT && rigB && suited) {
    const ref = (suited as Sprite).box ?? { x: 0, y: 0, w: suited.width, h: suited.height };
    drawRigLayer(ctx, rigT, ref, x, y, size, tailRot, TAIL_PIVOT[suit.id]);
    drawRigLayer(ctx, rigB, ref, x, y, size);
    if (!wearsOwnHead(suit)) paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
    return;
  }
  // frames crossfade instead of hard-switching — the four paintings blend
  // through each other so the cycle reads as motion, not a slideshow
  const f = suited ? 0 : blend;
  if (!suited && sprNext && f > 0.02) {
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * (1 - f);
    drawSprite(ctx, body, x, y, size);
    ctx.globalAlpha = prevA * f;
    drawSprite(ctx, sprNext, x, y, size);
    ctx.globalAlpha = prevA;
  } else {
    // the pilot's separation follows the sky like everything else — a
    // hardcoded dark halo left dark suits (the Void skin especially)
    // with no edge at all against a dark backdrop
    drawSprite(ctx, body, x, y, size, "box", halo);
  }
  if (suited) {
    if (!wearsOwnHead(suit)) paintDome(ctx, body, "suit:" + suit.id, helmet, x, y, size, art);
    return;
  }
  // the dome anchor glides between the two frames' measured positions
  const a1 = DOME[frameKey];
  const a2 = keyNext ? DOME[keyNext] : null;
  if (a1 && a2 && f > 0.02) {
    const mix: [number, number, number] = [
      a1[0] + (a2[0] - a1[0]) * f,
      a1[1] + (a2[1] - a1[1]) * f,
      a1[2] + (a2[2] - a1[2]) * f,
    ];
    DOME.__mix = mix;
    paintDome(ctx, body, "__mix", helmet, x, y, size, art);
    delete DOME.__mix;
  } else {
    paintDome(ctx, body, frameKey, helmet, x, y, size, art);
  }
}

function drawPilot(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank) {
  const x = w.W * PHYS.squirrelX;
  const y = w.squirrel.y;
  const suit = SUITS.find((s) => s.id === save.equippedSuit) ?? SUITS[0];
  const helm = HELMETS.find((h) => h.id === save.equipped) ?? HELMETS[0];
  // The repainted flap frames are one coherent character, so the tap
  // cycles them again — plus a soft nose-up kick and scale pop for punch.
  const flapping = w.flapBoost > 0;
  const frames = flapping ? art.squirrelFlap : art.squirrelIdle;
  const speed = flapping ? 10 : 5;
  const ft = w.time * speed;
  const idx = frames.length ? Math.floor(ft) % frames.length : 0;
  const nxt = frames.length ? (idx + 1) % frames.length : 0;
  // smoothstep eases the crossfade so each pose still gets its moment
  const fr = ft - Math.floor(ft);
  const blend = fr * fr * (3 - 2 * fr);
  const spr = frames[idx] ?? null;
  const frameKey = (flapping ? "flap-" : "idle-") + (idx + 1);
  const keyNext = (flapping ? "flap-" : "idle-") + (nxt + 1);
  ctx.save();
  ctx.translate(x, y);
  // the sim's real pitch — dives nose down, bounces kick the body over;
  // the old ±6° bank made every impact read as nothing happening
  const bank = w.squirrel.rot * 0.8;
  const kick = Math.min(1, Math.max(0, w.flapBoost) / 0.22);
  ctx.rotate(bank - kick * 0.12);
  const pop = 1 + kick * 0.05;
  ctx.scale(pop, pop);
  // fresh planet bounce: a squash-and-stretch pulse sells the impact
  const sq = Math.max(0, (w.hitCooldown - 0.33) / 0.22);
  if (sq > 0) ctx.scale(1 + sq * 0.16, 1 - sq * 0.2);
  paintIllustrated(ctx, spr, 0, 2, 52, helm, suit, w.time, art, frameKey,
    frames[nxt] ?? null, keyNext, blend, skyLuma(w) > 0.42 ? "dark" : "light", w.tailA);
  ctx.restore();
}

function paintPal(
  ctx: CanvasRenderingContext2D,
  art: ArtBank | null | undefined,
  id: string,
  x: number,
  y: number,
  size: number,
) {
  const spr = art?.pals?.[id];
  if (spr) {
    // box fit, not core: companions are sidekicks, smaller than the pilot
    drawSprite(ctx, spr, x, y, size);
    return;
  }
  if (id !== "none") {
    // no painted portrait for this companion — the vector renderer from
    // the live game draws it (comet sprite, nebula wisp)
    drawPalOn(ctx, id, x, y, size / 32, performance.now() / 1000);
    return;
  }
  if (id === "none") {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - size * 0.2, y + size * 0.2);
    ctx.lineTo(x + size * 0.2, y - size * 0.2);
    ctx.stroke();
  }
}

export function paintPortrait(
  ctx: CanvasRenderingContext2D,
  art: ArtBank | null,
  helmet: (typeof HELMETS)[number],
  suit: (typeof SUITS)[number],
  cx: number,
  cy: number,
  size: number,
  _t = 0,
) {
  // Always paint the PILOT wearing the helmet. Helmet-only art belongs
  // on the helmet cards, which have their own path — short-circuiting
  // here left the Flight suit showing a floating helmet and no squirrel.
  const body = art?.suits?.[suit.id] ?? art?.squirrelIdle?.[0];
  if (!body) return;
  drawSprite(ctx, body, cx, cy + 2, size);
  const key = art?.suits?.[suit.id] ? "suit:" + suit.id : "idle-1";
  if (!wearsOwnHead(suit)) paintDome(ctx, body, key, helmet, cx, cy + 2, size, art);
}

export function paintPalPreview(
  ctx: CanvasRenderingContext2D,
  art: ArtBank | null | undefined,
  id: string,
  cx: number,
  cy: number,
  size: number,
) {
  paintPal(ctx, art, id, cx, cy, size);
}

export function paintTrailPreview(
  ctx: CanvasRenderingContext2D,
  trail: (typeof TRAILS)[number],
  cx: number,
  cy: number,
  t = 0,
) {
  drawTrailPreviewOn(ctx, trail.id, cx, cy, t);
}

/** The vortex that eats the screen while a black hole or wormhole
 *  takes hold — spiral arms winding in, a dark core, a colour bloom.
 *  Purely procedural: no art needed. */
function drawSwirl(ctx: CanvasRenderingContext2D, w: World) {
  const { W, H } = w;
  const t = 1 - w.warpT;                       // 0 -> 1 over the transition
  const worm = w.warpKind === "worm" || w.flight === "lost";
  const cx = W / 2;
  const cy = H * 0.46;
  const reach = Math.hypot(W, H) * 0.62;
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const hue = worm ? [110, 240, 216] : [192, 132, 252];
  ctx.save();
  // colour bloom washing over the sky
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  bloom.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.55 * ease).toFixed(3)})`);
  bloom.addColorStop(0.55, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.16 * ease).toFixed(3)})`);
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);
  // spiral arms
  ctx.translate(cx, cy);
  ctx.rotate(t * Math.PI * 2.4 * (worm ? -1 : 1));
  ctx.lineCap = "round";
  for (let a = 0; a < 5; a++) {
    ctx.beginPath();
    const off = (a / 5) * Math.PI * 2;
    for (let k = 0; k <= 42; k++) {
      const f = k / 42;
      const rad = reach * (0.06 + f * 0.95) * (1 - ease * 0.45);
      const ang = off + f * 4.4;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad * 0.92;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.5 * ease).toFixed(3)})`;
    ctx.lineWidth = 2 + 5 * ease;
    ctx.stroke();
  }
  // the core opens up and swallows the middle
  const coreR = reach * 0.30 * ease;
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, coreR));
  core.addColorStop(0, `rgba(4,2,10,${(0.96 * ease).toFixed(3)})`);
  core.addColorStop(0.72, `rgba(8,4,20,${(0.7 * ease).toFixed(3)})`);
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, coreR), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${(0.5 * ease).toFixed(3)})`;
  ctx.lineWidth = 1.5 + 2 * ease;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, coreR * 1.04), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx: CanvasRenderingContext2D, w: World) {
  const { W } = w;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "800 36px Figtree, system-ui";
  ctx.fillText(String(w.score), W / 2, 46);
  if (w.envMsgT > 0) {
    ctx.globalAlpha = Math.min(1, w.envMsgT);
    ctx.fillStyle = "rgba(232,164,74,0.95)";
    ctx.font = "700 12px Figtree, system-ui";
    ctx.fillText(ENVS[w.envB].name, W / 2, 66);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
  ctx.font = "700 14px Figtree, system-ui";
  ctx.fillStyle = "#ffd080";
  ctx.fillText(`${w.runAcorns}`, 36, 28);
  if (w.shieldCharges > 0) {
    for (let i = 0; i < w.shieldCharges; i++) {
      ctx.fillStyle = "rgba(122,216,255,0.9)";
      ctx.beginPath();
      ctx.arc(W - 22 - i * 16, 26, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // status lines stack instead of colliding — mode line first, then any
  // live power-ups beneath it
  let hudY = 88;
  const hudLine = (text: string, color: string) => {
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.font = "700 13px Figtree, system-ui";
    ctx.fillText(text, W / 2, hudY);
    hudY += 18;
  };
  if (w.warpLeft > 0) hudLine((w.flight === "deep" ? "SHIFT  " : "BLACK HOLE  ") + Math.ceil(w.warpLeft) + "s", "#c084fc");
  else if (w.flight === "deep" && w.warpT <= 0) hudLine("FIRST SHIFT IN " + Math.ceil(Math.max(0, 10 - w.deepTimer)) + "s", "rgba(192,132,252,0.8)");
  if (w.powerLeft > 0) hudLine(`SLOW  ${Math.ceil(w.powerLeft)}s`, "#6ef0ff");
  if (w.invulnLeft > 0) hudLine(`GOLD  ${Math.ceil(w.invulnLeft)}s`, "#ffd060");
  if (w.recoveryMsg) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 15px Figtree, system-ui";
    ctx.fillText(w.recoveryMsg, W / 2, w.H * 0.22);
  }
  if (w.warpT > 0) {
    drawSwirl(ctx, w);
    ctx.textAlign = "center";
    ctx.fillStyle = w.warpKind === "worm" || w.flight === "lost" ? "#6ef0d8" : "#c084fc";
    ctx.font = "800 22px Figtree, system-ui";
    ctx.fillText(
      w.warpKind === "timeline"
        ? "TIMELINE SHIFT!"
        : w.warpKind === "worm" || w.flight === "lost"
          ? "WORMHOLE!"
          : "BLACK HOLE!",
      W / 2, w.H * 0.3,
    );
  }
  if (w.ready && !w.tut) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 18px Figtree, system-ui";
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(w.time * 4);
    ctx.fillText("TAP TO FLY", W / 2, w.H * 0.38);
    ctx.globalAlpha = 1;
  }
  if (w.tut?.hold) {
    const st = w.tut.stage;
    const title =
      st === "tap" ? "TAP"
      : st === "tap2" ? "TAP AGAIN"
      : st === "swipe" ? "SWIPE DOWN"
      : st === "yourturn" ? "YOUR TURN!"
      : "A COMPANION APPEARS!";
    const body =
      st === "tap" ? "anywhere — a boost upward"
      : st === "tap2" ? "one more boost — then just watch"
      : st === "swipe" ? "dive back down and make the gap"
      : st === "yourturn" ? "fly the gaps · grab the acorns"
      : "The Acorn Buddy reels in nearby acorns.";
    drawPrompt(ctx, w, title, body, st === "swipe" ? w.H * 0.58 : w.H * 0.36);
    if (w.tut.nudge) {
      ctx.fillStyle = "#ffd080";
      ctx.font = "700 13px Figtree, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(w.tut.nudge, W / 2, w.H * 0.68);
    }
  } else if (w.tut?.stage === "glide" || w.tut?.stage === "bounce") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb84d";
    ctx.font = "800 14px Figtree, system-ui";
    ctx.fillText(w.tut.stage === "bounce" ? "BOING! PLANETS BOUNCE YOU"
                                          : "PLANET AHEAD — LAND ON IT", W / 2, 86);
  } else if (w.tut?.stage === "dive") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb84d";
    ctx.font = "800 14px Figtree, system-ui";
    ctx.fillText("MAKE THE GAP", W / 2, 86);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "700 12px Figtree, system-ui";
    ctx.fillText("a tap levels you off", W / 2, 104);
  } else if (w.tut?.stage === "gates" || w.tut?.stage === "palDemo") {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(243,239,228,0.8)";
    ctx.font = "700 13px Figtree, system-ui";
    ctx.fillText(w.tut.stage === "gates" ? "FLY THE GAPS  ·  GRAB THE ACORNS" : "WATCH THE MAGNET", W / 2, 86);
  } else if (w.tut?.stage === "ready") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 20px Figtree, system-ui";
    ctx.fillText("YOU'RE READY, PILOT", W / 2, w.H * 0.3);
  }
}

function drawPrompt(ctx: CanvasRenderingContext2D, w: World, title: string, body: string, cy: number) {
  const bw = Math.min(320, w.W - 40);
  const bh = 108;
  ctx.fillStyle = "rgba(12,18,36,0.82)";
  ctx.strokeStyle = "rgba(232,164,74,0.45)";
  ctx.lineWidth = 1.5;
  round(ctx, w.W / 2 - bw / 2, cy - bh / 2, bw, bh, 16);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "800 16px Figtree, system-ui";
  ctx.fillText(title, w.W / 2, cy - 8);
  ctx.fillStyle = "rgba(243,239,228,0.72)";
  ctx.font = "600 12px Figtree, system-ui";
  ctx.fillText(body, w.W / 2, cy + 16);
  if (w.tut?.hold) {
    const armA = Math.max(0, Math.min(1, (w.tut.t - TUT_ARM) / 0.3));
    if (armA > 0) {
      ctx.globalAlpha = armA * (0.7 + 0.3 * Math.sin(w.time * 4));
      ctx.fillStyle = w.tut.stage === "swipe" ? "#ffb84d" : "#6ef0ff";
      ctx.font = "700 12px Figtree, system-ui";
      ctx.fillText(w.tut.stage === "swipe" ? "try it now"
        : w.tut.stage === "yourturn" ? "tap to begin" : "tap to continue", w.W / 2, cy + 36);
      ctx.globalAlpha = 1;
    }
  }
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
