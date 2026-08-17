import { ENVS, HELMETS, PHYS, SUITS, TRAILS } from "./catalog";
import { drawTrailPreviewOn } from "./cosmetics";
import { drawSprite, type ArtBank, type Sprite } from "./art";
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

function drawBackdrop(ctx: CanvasRenderingContext2D, w: World, art: ArtBank) {
  const { W, H } = w;
  if (art.sky) {
    const sw = art.sky.naturalWidth || art.sky.width;
    const sh = art.sky.naturalHeight || art.sky.height;
    const scale = Math.max(W / Math.max(1, sw), H / Math.max(1, sh));
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(art.sky, (W - dw) / 2, (H - dh) / 2, dw, dh);
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
  const wash = env.wash.map((v, i) => envA.wash[i] + (v - envA.wash[i]) * blend) as number[];
  ctx.fillStyle = `rgba(${wash[0]},${wash[1]},${wash[2]},${wash[3]})`;
  ctx.beginPath();
  ctx.ellipse(W * 0.68, H * 0.28, W * 0.55, H * 0.28, 0.25, 0, Math.PI * 2);
  ctx.fill();
  const wash2 = env.wash2.map((v, i) => envA.wash2[i] + (v - envA.wash2[i]) * blend) as number[];
  ctx.fillStyle = `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${wash2[3]})`;
  ctx.beginPath();
  ctx.ellipse(W * 0.22, H * 0.78, W * 0.45, H * 0.22, -0.2, 0, Math.PI * 2);
  ctx.fill();

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
  drawBackdrop(ctx, w, art);

  ctx.save();
  applyWarp(ctx, w);

  for (const p of w.planets) {
    const gy = liveGapY(p);
    drawPlanet(ctx, art, p.x, gy - p.gap / 2 - p.r, p.r, p.topKind);
    drawPlanet(ctx, art, p.x, gy + p.gap / 2 + p.r, p.r, p.botKind);
    for (const b of p.blockers) {
      const by = b.y + Math.sin(p.drift) * p.driftAmp;
      const bx = p.x + b.xOff;
      const img = art.debris[b.debris];
      if (img) drawSprite(ctx, img, bx, by, b.r * 2, "core");
      else drawPlanet(ctx, art, bx, by, b.r, b.kind);
    }
  }

  for (const a of w.pickups) {
    if (a.got) continue;
    const y = a.y + Math.sin(a.bob) * 4;
    if (a.kind === "acorn") drawSprite(ctx, frameOf(art.acorn, w.time, 5), a.x, y, 28);
    else if (a.kind === "gold") drawSprite(ctx, frameOf(art.golden, w.time, 6), a.x, y, 32);
    else if (a.kind === "slow") {
      drawSprite(ctx, frameOf(art.acorn, w.time, 6), a.x, y, 28);
      ctx.strokeStyle = "rgba(110,240,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.x, y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(110,240,255,0.35)";
      ctx.beginPath();
      ctx.arc(a.x, y, 20 + Math.sin(w.time * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.kind === "shield") drawSprite(ctx, frameOf(art.shield, w.time, 5), a.x, y, 34);
    else if (a.kind === "hole" || a.kind === "worm") {
      drawVortex(ctx, a.x, y, a.kind === "worm", w.time);
    }
  }

  for (const p of w.particles) drawParticle(ctx, p);

  const pal =
    w.tut && (w.tut.stage === "pal" || w.tut.stage === "palDemo" || w.tut.stage === "ready")
      ? "buddy"
      : save.equippedPal;
  if (pal && pal !== "none") {
    const bob = Math.sin(w.time * 2.6) * 2;
    paintPal(ctx, art, pal, w.palPos.x, w.palPos.y + bob, 36);
  }

  drawPilot(ctx, w, save, art);
  ctx.restore();
  ctx.restore();

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
}

function drawVortex(ctx: CanvasRenderingContext2D, x: number, y: number, worm: boolean, t: number) {
  const pulse = 12 + Math.sin(t * 6) * 3;
  const grd = ctx.createRadialGradient(x, y, 2, x, y, pulse + 14);
  grd.addColorStop(0, worm ? "#d8f6ff" : "#1a1028");
  grd.addColorStop(0.45, worm ? "#4ad8ff" : "#6a2a9a");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, pulse + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * (worm ? 3 : -2.2));
  ctx.strokeStyle = worm ? "rgba(180,240,255,0.55)" : "rgba(180,90,255,0.45)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 6 + i * 5, i, i + 2.2);
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
) {
  const img = art.planets[kind % art.planets.length];
  if (img) {
    drawSprite(ctx, img, x, y, r * 2, "core");
    return;
  }
  ctx.fillStyle = "#3a6aa8";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Visor glass on idle-1.png (128 source). Overlay stays on the painted helmet. */
const VISOR = { sx: 64, sy: 46, rx: 22, ry: 16 };
const BODY = { sx: 64, sy: 74, rx: 30, ry: 24 };

function spriteLayout(spr: Sprite | HTMLImageElement, x: number, y: number, size: number) {
  const box = (spr as Sprite).box ?? { x: 0, y: 0, w: spr.width, h: spr.height };
  const dim = Math.max(box.w, box.h);
  const scale = size / Math.max(1, dim);
  return {
    scale,
    map(sx: number, sy: number) {
      return {
        x: x - (box.w * scale) / 2 + (sx - box.x) * scale,
        y: y - (box.h * scale) / 2 + (sy - box.y) * scale,
      };
    },
  };
}

let pilotSheet: HTMLCanvasElement | null = null;
function getPilotSheet(px: number) {
  if (!pilotSheet) pilotSheet = document.createElement("canvas");
  if (pilotSheet.width !== px || pilotSheet.height !== px) {
    pilotSheet.width = px;
    pilotSheet.height = px;
  }
  return pilotSheet;
}

function paintIllustrated(
  ctx: CanvasRenderingContext2D,
  spr: Sprite | HTMLImageElement | null | undefined,
  x: number,
  y: number,
  size: number,
  helmet: (typeof HELMETS)[number],
  suit: (typeof SUITS)[number],
) {
  if (!spr) return;
  const pad = Math.ceil(size * 0.18);
  const out = Math.ceil(size + pad * 2);
  const sheet = getPilotSheet(Math.max(8, out));
  const octx = sheet.getContext("2d");
  if (!octx) {
    drawSprite(ctx, spr, x, y, size);
    return;
  }
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, sheet.width, sheet.height);
  const cx = out / 2;
  const cy = out / 2;
  drawSprite(octx, spr, cx, cy, size);
  const lay = spriteLayout(spr, cx, cy, size);
  const visor = lay.map(VISOR.sx, VISOR.sy);
  const body = lay.map(BODY.sx, BODY.sy);
  const vrx = VISOR.rx * lay.scale;
  const vry = VISOR.ry * lay.scale;

  octx.save();
  octx.globalCompositeOperation = "source-atop";
  if (suit.id !== "flight") {
    octx.fillStyle = suit.suit;
    octx.globalAlpha = 0.55;
    octx.beginPath();
    octx.ellipse(body.x, body.y, BODY.rx * lay.scale, BODY.ry * lay.scale, 0, 0, Math.PI * 2);
    octx.fill();
    if (suit.glow) {
      octx.fillStyle = suit.glow;
      octx.globalAlpha = 0.18;
      octx.fill();
    }
  }
  octx.fillStyle = helmet.visor;
  octx.globalAlpha = helmet.id === "clear" ? 0.22 : Math.min(0.82, helmet.tint + 0.52);
  octx.beginPath();
  octx.ellipse(visor.x, visor.y, vrx, vry, 0, 0, Math.PI * 2);
  octx.fill();
  if (helmet.glow) {
    octx.strokeStyle = helmet.glow;
    octx.lineWidth = Math.max(1.2, size * 0.035);
    octx.globalAlpha = 0.8;
    octx.shadowColor = helmet.glow;
    octx.shadowBlur = Math.max(4, size * 0.08);
    octx.beginPath();
    octx.ellipse(visor.x, visor.y, vrx * 1.08, vry * 1.12, 0, 0, Math.PI * 2);
    octx.stroke();
  }
  octx.restore();

  ctx.drawImage(sheet, 0, 0, out, out, x - out / 2, y - out / 2, out, out);
}

function drawPilot(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank) {
  const x = w.W * PHYS.squirrelX;
  const y = w.squirrel.y;
  const suit = SUITS.find((s) => s.id === save.equippedSuit) ?? SUITS[0];
  const helm = HELMETS.find((h) => h.id === save.equipped) ?? HELMETS[0];
  const spr =
    w.flapBoost > 0 ? frameOf(art.squirrelFlap, w.time, 12) : frameOf(art.squirrelIdle, w.time, 5);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(w.squirrel.rot);
  paintIllustrated(ctx, spr, 0, 0, 52, helm, suit);
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
    drawSprite(ctx, spr, x, y, size, "box");
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
  const spr = art?.squirrelIdle?.[0] ?? art?.squirrelIdle?.[0];
  paintIllustrated(ctx, spr, cx, cy, size, helmet, suit);
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
  if (w.powerLeft > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#6ef0ff";
    ctx.font = "700 13px Figtree, system-ui";
    ctx.fillText(`SLOW  ${Math.ceil(w.powerLeft)}s`, W / 2, 88);
  }
  if (w.invulnLeft > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd060";
    ctx.font = "700 13px Figtree, system-ui";
    ctx.fillText(`GOLD  ${Math.ceil(w.invulnLeft)}s`, W / 2, w.powerLeft > 0 ? 106 : 88);
  }
  if (w.recoveryMsg) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 15px Figtree, system-ui";
    ctx.fillText(w.recoveryMsg, W / 2, w.H * 0.22);
  }
  if (w.warpT > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = w.warpKind === "worm" || w.flight === "lost" ? "#6ef0d8" : "#c084fc";
    ctx.font = "800 22px Figtree, system-ui";
    ctx.fillText(w.warpKind === "worm" || w.flight === "lost" ? "WORMHOLE!" : "BLACK HOLE!", W / 2, w.H * 0.3);
  } else if (w.warpLeft > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#c084fc";
    ctx.font = "700 13px Figtree, system-ui";
    ctx.fillText((w.flight === "deep" ? "SHIFT  " : "BLACK HOLE  ") + Math.ceil(w.warpLeft) + "s", W / 2, 92);
  } else if (w.flight === "deep") {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(192,132,252,0.8)";
    ctx.font = "700 12px Figtree, system-ui";
    ctx.fillText("FIRST SHIFT IN " + Math.ceil(Math.max(0, 10 - w.deepTimer)) + "s", W / 2, 92);
  } else if (w.flight === "lost") {
    const pct = Math.round((w.driftFactor - 1) * 100);
    ctx.textAlign = "center";
    ctx.fillStyle = "#6ef0d8";
    ctx.font = "700 12px Figtree, system-ui";
    ctx.fillText("LOST IN SPACE · DRIFT " + (pct >= 0 ? "+" : "") + pct + "%" + (w.warpMirror ? " · REVERSED" : ""), W / 2, 92);
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
    const title =
      w.tut.stage === "tap" || w.tut.stage === "tap2"
        ? w.tut.stage === "tap"
          ? "TAP — boost upward"
          : "TAP AGAIN"
        : w.tut.stage === "swipe"
          ? "SWIPE DOWN — dive"
          : w.tut.stage === "pal"
            ? "A COMPANION APPEARS"
            : "FLY THE GAPS";
    const body =
      w.tut.stage === "swipe"
        ? "Bounced too high! Drag down to make the gap."
        : w.tut.stage === "pal"
          ? "Acorn Buddy reels in nearby nuts."
          : "One tap, one lift.";
    drawPrompt(ctx, w, title, body, w.tut.stage === "swipe" ? w.H * 0.58 : w.H * 0.36);
    if (w.tut.nudge) {
      ctx.fillStyle = "#ffd080";
      ctx.font = "700 13px Figtree, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(w.tut.nudge, W / 2, w.H * 0.68);
    }
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
  const bh = 92;
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
