// Offline texture calibration only. The game still draws the same two
// attachment points with its approved rigid bone transform.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Widen one registered 256×256 shin texture perpendicular to its bone.
 *
 * source: a canvas containing only the shin/boot/paw cell, with alpha.
 * anchors: {a:[x,y], b:[x,y]} in that cell; a is knee, b is boot emitter.
 * gain: fixed calf breadth multiplier, >=1 (default 1.35).
 * options.createCanvas: optional factory (width,height)=>canvas. Otherwise
 *   use ACORNAUT_CANVAS or the normal @napi-rs/canvas package.
 *
 * The along-bone coordinate t is never changed, and the whole bone axis
 * (including a and b) stays fixed. Perpendicular breadth is gain through
 * t=.85, then follows a smoothstep to exactly 1 at t=1.15. The terminal
 * region t>=1.15 is restored byte-for-byte from the original canvas, so
 * paw artwork, padding and registration there do not change.
 *
 * Returns a new 256×256 canvas. No crop, recentering or scale normalization
 * is performed. Throws if the source or result lacks three clear pixels
 * of padding, or if metadata/gain are invalid. Use only in the art exporter;
 * no extra draw calls or deformation run in the game.
 */
export function widenShin(source, { a, b }, gain = 1.35, options = {}) {
  if (source?.width !== 256 || source?.height !== 256) throw new Error('Shin calibration requires a registered 256×256 canvas');
  if (![a, b].every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) {
    throw new Error('Shin calibration requires two finite source anchors');
  }
  if (!Number.isFinite(gain) || gain < 1) throw new Error('Shin breadth gain must be finite and at least 1');
  const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
  if (length2 < 1) throw new Error('Shin source anchors must define a nonzero bone');
  const makeCanvas = options.createCanvas ?? require(process.env.ACORNAUT_CANVAS || '@napi-rs/canvas').createCanvas;
  const output = makeCanvas(256, 256), ctx = output.getContext('2d');
  const sourcePixels = source.getContext('2d').getImageData(0, 0, 256, 256);
  function checkPadding(data, label) {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      if (x >= 3 && x < 253 && y >= 3 && y < 253) continue;
      if (data[(y * 256 + x) * 4 + 3] !== 0) {
        throw new Error(`${label} shin artwork reaches its three-pixel padding at ${x},${y}`);
      }
    }
  }
  checkPadding(sourcePixels.data, 'Original');
  if (gain === 1) { ctx.putImageData(sourcePixels, 0, 0); return output; }

  const along = (x, y) => ((x - a[0]) * dx + (y - a[1]) * dy) / length2;
  function map(x, y) {
    const t = along(x, y), u = clamp((t - .85) / .3, 0, 1);
    const breadth = gain + (1 - gain) * u * u * (3 - 2 * u);
    const axisX = a[0] + t * dx, axisY = a[1] + t * dy;
    return [axisX + (x - axisX) * breadth, axisY + (y - axisY) * breadth];
  }

  // Adjacent triangles share the same mapped vertices. Small clip overlaps
  // hide Canvas edge antialias seams; the image contains no adjacent part.
  // Eight-pixel source spacing keeps the smooth ankle taper well sampled.
  const stride = 33, vertices = [];
  for (let y = 0; y <= 256; y += 8) for (let x = 0; x <= 256; x += 8) {
    vertices.push({ source: [x, y], target: map(x, y) });
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  function triangle(ia, ib, ic) {
    const [sa, sb, sc] = [vertices[ia].source, vertices[ib].source, vertices[ic].source];
    const [ta, tb, tc] = [vertices[ia].target, vertices[ib].target, vertices[ic].target];
    const determinant = (sb[0] - sa[0]) * (sc[1] - sa[1]) - (sc[0] - sa[0]) * (sb[1] - sa[1]);
    const area = (tb[0] - ta[0]) * (tc[1] - ta[1]) - (tc[0] - ta[0]) * (tb[1] - ta[1]);
    if (area <= 0) throw new Error('Shin breadth gain would fold the offline mesh');
    const m00 = ((tb[0] - ta[0]) * (sc[1] - sa[1]) - (tc[0] - ta[0]) * (sb[1] - sa[1])) / determinant;
    const m01 = ((tc[0] - ta[0]) * (sb[0] - sa[0]) - (tb[0] - ta[0]) * (sc[0] - sa[0])) / determinant;
    const m10 = ((tb[1] - ta[1]) * (sc[1] - sa[1]) - (tc[1] - ta[1]) * (sb[1] - sa[1])) / determinant;
    const m11 = ((tc[1] - ta[1]) * (sb[0] - sa[0]) - (tb[1] - ta[1]) * (sc[0] - sa[0])) / determinant;
    const center = [(ta[0] + tb[0] + tc[0]) / 3, (ta[1] + tb[1] + tc[1]) / 3];
    ctx.save(); ctx.beginPath();
    for (const [i, p] of [ta, tb, tc].entries()) {
      const ex = p[0] - center[0], ey = p[1] - center[1], len = Math.max(.001, Math.hypot(ex, ey));
      const x = p[0] + ex / len * .65, y = p[1] + ey / len * .65;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.clip();
    ctx.transform(m00, m10, m01, m11, ta[0] - m00 * sa[0] - m01 * sa[1], ta[1] - m10 * sa[0] - m11 * sa[1]);
    ctx.drawImage(source, 0, 0); ctx.restore();
  }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = y * stride + x;
    triangle(i, i + 1, i + stride + 1); triangle(i, i + stride + 1, i + stride);
  }

  // Identity triangles can still round semitransparent edge pixels. Copy
  // this protected half-plane exactly, including all transparent channels.
  const pixels = ctx.getImageData(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    if (along(x + .5, y + .5) < 1.15) continue;
    const i = (y * 256 + x) * 4;
    for (let ch = 0; ch < 4; ch++) pixels.data[i + ch] = sourcePixels.data[i + ch];
  }
  checkPadding(pixels.data, 'Widened');
  ctx.putImageData(pixels, 0, 0);
  return output;
}
