#!/usr/bin/env node
/** Compare the preserved pre-repair painter/art against the current export.
 * Build first. ACORNAUT_CANVAS may point to an external @napi-rs/canvas;
 * ACORNAUT_FFMPEG / ACORNAUT_FFPROBE may point to installed executables.
 * Both columns receive the same baseline motion state at the same scale.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require(process.env.ACORNAUT_CANVAS || '@napi-rs/canvas');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'illustrated-src/design/arcflash');
const scratch = mkdtempSync(join(tmpdir(), 'arcflash-repair-'));
const baseline = process.env.ACORNAUT_ARCFLASH_BASELINE || '160eb85';
const video = !process.argv.includes('--stills-only');
const ffmpeg = process.env.ACORNAUT_FFMPEG || 'ffmpeg';
const ffprobe = process.env.ACORNAUT_FFPROBE || 'ffprobe';
mkdirSync(output, { recursive: true });
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'Arcflash Review');
const git = path => execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root, maxBuffer: 20 * 1024 * 1024 });
const label = (ctx, text, x, y, size = 20, weight = '400') => {
  ctx.fillStyle = '#182630'; ctx.font = `${weight} ${size}px "Arcflash Review"`; ctx.fillText(text, x, y);
};

try {
  // The controller's constant dependency also comes from the baseline.
  // Strip cache queries only: retain the exact old renderer and its anchors.
  for (const name of ['arcflash', 'arcflash-parts', 'arcflash-motion', 'control-constants']) {
    const source = git(`docs/js/${name}.js`).toString().replace(/(from\s+['"]\.\/[^'"?]+)\?[^'"]+(['"])/g, '$1$2');
    writeFileSync(join(scratch, `${name}.js`), source);
  }
  writeFileSync(join(scratch, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(scratch, 'before.png'), git('docs/art/suits/arcflash/parts.png'));
  const [before, after, M] = await Promise.all([
    import(pathToFileURL(join(scratch, 'arcflash.js')).href),
    import('../docs/js/arcflash.js'),
    import(pathToFileURL(join(scratch, 'arcflash-motion.js')).href),
  ]);
  const [oldAtlas, newAtlas] = await Promise.all([
    loadImage(join(scratch, 'before.png')),
    loadImage(join(root, 'docs/art/suits/arcflash/parts.png')),
  ]);
  const painters = [before, after], arts = [{ suits: {}, arcflash: oldAtlas }, { suits: {}, arcflash: newAtlas }];
  const build = readFileSync(join(root, 'docs/js/catalog.js'), 'utf8').match(/ART_VER\s*=\s*"([^"]+)"/)?.[1] || 'current';
  const cruise = M.createArcflashMotion(), climb = M.createArcflashMotion();
  const descent = M.createArcflashMotion(), contact = M.createArcflashMotion();
  for (let i = 0; i < 120; i++) {
    M.stepArcflash(climb, 1 / 120, -450);
    M.stepArcflash(descent, 1 / 120, 650);
    M.stepArcflash(contact, 1 / 120, -450);
  }
  M.arcflashContact(contact, -1, .9);
  for (let i = 0; i < 12; i++) M.stepArcflash(contact, 1 / 120, -350);

  // One shared transform fits all before/after poses. Per-image box fitting
  // would hide thickness changes and manufacture a different head size.
  const measure = createCanvas(1400, 1400), mc = measure.getContext('2d');
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const state of [cruise, climb, descent, contact]) for (let side = 0; side < 2; side++) {
    mc.clearRect(0, 0, 1400, 1400);
    painters[side].paintArcflash(mc, arts[side], 700, 700, 600, state, undefined, false);
    const pixels = mc.getImageData(0, 0, 1400, 1400).data;
    for (let y = 0; y < 1400; y++) for (let x = 0; x < 1400; x++) if (pixels[(y * 1400 + x) * 4 + 3] > 16) {
      bounds.minX = Math.min(bounds.minX, x - 700); bounds.maxX = Math.max(bounds.maxX, x - 700);
      bounds.minY = Math.min(bounds.minY, y - 700); bounds.maxY = Math.max(bounds.maxY, y - 700);
    }
  }
  assert(Number.isFinite(bounds.minX), 'both painters must produce a visible character');
  function panel(ctx, side, state, x, y, width, height) {
    ctx.fillStyle = '#b9c0c5'; ctx.fillRect(x, y, width, height);
    const factor = Math.min((width - 32) / (bounds.maxX - bounds.minX), (height - 32) / (bounds.maxY - bounds.minY), 1);
    const px = x + width / 2 - (bounds.minX + bounds.maxX) / 2 * factor;
    const py = y + height / 2 - (bounds.minY + bounds.maxY) / 2 * factor;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
    const snapshot = JSON.stringify(state);
    painters[side].paintArcflash(ctx, arts[side], px, py, 600 * factor, state, undefined, false);
    assert.equal(JSON.stringify(state), snapshot, 'a review painter cannot modify approved motion');
    ctx.restore();
  }

  const sheet = createCanvas(1200, 1100), c = sheet.getContext('2d');
  c.fillStyle = '#e6e9ec'; c.fillRect(0, 0, 1200, 1100);
  label(c, 'Arcflash — back and leg repair', 24, 43, 27, '700');
  label(c, 'Before', 24, 87, 23, '700'); label(c, 'Repaired', 612, 87, 23, '700');
  for (const [row, state, title] of [[0, cruise, 'Cruise'], [1, climb, 'Climb']]) {
    const y = 120 + row * 462;
    label(c, title, 24, y - 10, 18); label(c, title, 612, y - 10, 18);
    panel(c, 0, state, 24, y, 564, 432); panel(c, 1, state, 612, y, 564, 432);
  }
  label(c, 'Same motion and scale. Effects hidden so the back and legs remain visible.', 24, 1050, 18);
  label(c, `Before: ${baseline}   ·   Repaired: build ${build}`, 24, 1080, 15);
  writeFileSync(join(output, 'repair-review.png'), sheet.toBuffer('image/png'));

  if (video) {
    const film = createCanvas(1200, 720), fc = film.getContext('2d'), state = M.createArcflashMotion();
    const frames = join(scratch, 'frames'); mkdirSync(frames);
    const taps = new Set([15, 21, 27, 33, 100, 111, 122, 133, 200, 218, 236, 254, 356, 367, 378, 389, 400]);
    let vy = 0, frame = 0;
    for (let tick = 0; tick < 480; tick++) {
      if (taps.has(tick)) { M.arcflashTap(state, Math.max(1, vy + 450)); vy = -450; }
      if (tick === 310) { M.arcflashDive(state); vy = 380; }
      if (tick === 350) { M.arcflashContact(state, -1, .9); vy = -350; }
      vy = Math.min(820, vy + 1300 / 60); M.stepArcflash(state, 1 / 60, vy);
      if (tick % 2) continue;
      fc.fillStyle = '#e6e9ec'; fc.fillRect(0, 0, 1200, 720);
      label(fc, 'Arcflash — back and leg repair', 24, 40, 27, '700');
      label(fc, 'Before', 24, 80, 23, '700'); label(fc, 'Repaired', 612, 80, 23, '700');
      panel(fc, 0, state, 24, 100, 564, 530); panel(fc, 1, state, 612, 100, 564, 530);
      const phase = state.contactAge < .68 ? 'Contact and recovery' : state.phase === 'rise' ? 'Climb' : state.phase === 'dive' ? 'Down swipe' : state.phase === 'fall' ? 'Descent' : 'Settling';
      label(fc, `${(tick / 60).toFixed(1)} s   ·   ${phase}`, 24, 662, 19);
      label(fc, 'Shared 60 Hz motion · 100 / 180 / 300 ms tap groups · effects hidden', 24, 696, 17);
      writeFileSync(join(frames, `${String(frame++).padStart(4, '0')}.png`), film.toBuffer('image/png'));
    }
    const staging = join(output, 'repair-preview.tmp.mp4');
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-framerate', '30',
      '-i', join(frames, '%04d.png'), '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', staging], { stdio: 'inherit' });
    const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,nb_frames:format=duration', '-of', 'json', staging], { encoding: 'utf8' }));
    assert.equal(probe.streams[0].width, 1200); assert.equal(probe.streams[0].height, 720);
    assert.equal(Number(probe.streams[0].nb_frames), 240); assert(Math.abs(Number(probe.format.duration) - 8) < .04);
    renameSync(staging, join(output, 'repair-preview.mp4'));
  }
  console.log(JSON.stringify({ baseline, build, sheet: join(output, 'repair-review.png'),
    ...(video ? { video: join(output, 'repair-preview.mp4'), seconds: 8 } : {}) }));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
