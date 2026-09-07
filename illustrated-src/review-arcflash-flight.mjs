#!/usr/bin/env node
/** Actual Sim inputs and actual Arcflash painter at normal playback speed.
 * The empty 5000px chamber and following display camera are review fixtures;
 * pilot position/velocity are never reset for presentation. One staged solo
 * planet creates a real simulation contact. No controller pose overrides.
 *
 * Build first, then:
 * ACORNAUT_CANVAS=/path/to/@napi-rs/canvas node illustrated-src/review-arcflash-flight.mjs
 * Requires ffmpeg. Intermediate PNG frames live in the system scratch folder.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { createCanvas, loadImage, Image, GlobalFonts } = require(process.env.ACORNAUT_CANVAS || '@napi-rs/canvas');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'illustrated-src/design/arcflash');
mkdirSync(output, { recursive: true });
const frameDir = mkdtempSync(join(tmpdir(), 'arcflash-flight-'));
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'Arcflash Sans');
globalThis.Image = Image; globalThis.HTMLImageElement = Image;
globalThis.window = { __ACORNAUT_BETA__: true, __ACORNAUT_ART__: join(root, 'docs/art'),
  location: { href: 'http://local/beta/', search: '' }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => createCanvas(1, 1), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const [Sim, Save, Cat, R, M] = await Promise.all([import('../docs/js/sim.js'), import('../docs/js/save.js'),
  import('../docs/js/catalog.js'), import('../docs/js/arcflash.js'), import('../docs/js/arcflash-motion.js')]);
const atlas = await loadImage(join(root, 'docs/art/suits/arcflash/parts.png'));
const art = { suits: {}, arcflash: atlas };
const originalRandom = Math.random;
let randomInVisuals = 0;
function withoutVisualRandom(fn) {
  const previous = Math.random;
  Math.random = () => { randomInVisuals++; throw new Error('Presentation consumed simulation Math.random'); };
  try { return fn(); } finally { Math.random = previous; }
}
function makeRun(suit) {
  const save = Save.defaultSave();
  Object.assign(save, { equippedSuit: suit, equippedTrail: 'ion', tutorialDone: true, guide: 'done' });
  // Deterministic fixture setup only; the two suits may emit different
  // cosmetic particles, so gameplay fields are compared independently.
  Math.random = () => .5;
  let w;
  try { w = Sim.makeWorld(390, 5000); Sim.resetRun(w, save, 'fly', false); }
  finally { Math.random = originalRandom; }
  w.planets = []; w.pickups = []; w.lastSpawnX = 100000; w.warpT = 0;
  return { save, w };
}
const actual = makeRun('arcflash'), reference = makeRun('flight');
const bursts = [{ start: 0, interval: .1, count: 4 }, { start: 2, interval: .18, count: 5 },
  { start: 4, interval: .3, count: 4 }, { start: 6.13, interval: .18, count: 4 }];
const taps = new Map();
for (const b of bursts) for (let i = 0; i < b.count; i++) taps.set(Math.round((b.start + i * b.interval) * 60), b.interval);
const diveTick = Math.round(5.65 * 60), stageTick = Math.round(6.03 * 60);
const equalKeys = ['squirrel', 'run', 'score', 'distance', 'screen', 'ready', 'speed', 'hitCooldown', 'bounceUp'];
const trace = [], events = [], scales = new Map(), anatomyErrors = [];
const film = createCanvas(960, 720), ctx = film.getContext('2d');
const sizes = { enlarged: 300, phone: 52 };
let currentSize = 0, lastTap = -1000, contactTick = -1000, bodyScaleSamples = 0;
const measured = new Proxy(ctx, {
  get(target, key) {
    if (key === 'drawImage') return (...args) => {
      if (args[0] === atlas && args.length === 9 && args[2] === 0 && [0, 256].includes(args[1])) {
        const part = args[1] === 0 ? 'head' : 'torso', m = target.getTransform();
        const xScale = Math.hypot(m.a, m.b), yScale = Math.hypot(m.c, m.d);
        const id = `${currentSize}:${part}`, values = scales.get(id) ?? [];
        values.push(xScale); scales.set(id, values); bodyScaleSamples++;
        assert(Math.abs(xScale - yScale) < 1e-7, `${part} must remain uniformly scaled`);
        assert(Math.abs(m.a * m.c + m.b * m.d) < 1e-7, `${part} must not shear`);
      }
      return target.drawImage(...args);
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
  set(target, key, value) { return Reflect.set(target, key, value, target); },
});
function text(value, x, y, size = 14, color = '#aac1d7', weight = '400') {
  ctx.font = `${weight} ${size}px "Arcflash Sans"`; ctx.fillStyle = color; ctx.fillText(value, x, y);
}
function geometry(s) {
  const l = R.arcflashLandmarks(s.pose), a = R.ARCFLASH_ANATOMY;
  const pairs = [['nearShoulder', 'nearElbow', 'nearArm'], ['farShoulder', 'farElbow', 'farArm'],
    ['nearElbow', 'nearWrist', 'nearForearm'], ['farElbow', 'farWrist', 'farForearm'],
    ['nearHip', 'nearKnee', 'nearThigh'], ['farHip', 'farKnee', 'farThigh'],
    ['nearKnee', 'nearBoot', 'nearShin'], ['farKnee', 'farBoot', 'farShin']];
  const maximum = Math.max(...pairs.map(([from, to, length]) => Math.abs(Math.hypot(l[to][0] - l[from][0], l[to][1] - l[from][1]) - a[length])));
  assert(maximum < 1e-8, 'actual painter landmarks must preserve all eight limb lengths');
  anatomyErrors.push(maximum);
  return l;
}
function paintPilot(x, y, size) {
  currentSize = size;
  const before = structuredClone(actual.w.arcflash);
  const origin = { x: actual.w.W * Cat.PHYS.squirrelX, y: actual.w.squirrel.y, travel: actual.w.distance };
  withoutVisualRandom(() => R.paintArcflash(measured, art, x, y, size, actual.w.arcflash, origin));
  assert.deepEqual(actual.w.arcflash, before, 'rendering may retain private wake history but cannot mutate motion state');
}
function drawPlanetPhone(x, y) {
  for (const p of actual.w.planets) {
    const px = x + p.x - actual.w.W * Cat.PHYS.squirrelX;
    const py = y + p.gapY + p.gap / 2 + p.r - actual.w.squirrel.y;
    if (py < 110 || py > 655 || px < 720 || px > 950) continue;
    const g = ctx.createRadialGradient(px - 12, py - 15, 3, px, py, p.r);
    g.addColorStop(0, '#657b8c'); g.addColorStop(1, '#1c2c3d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#728ea4'; ctx.lineWidth = 1; ctx.stroke();
  }
}

try {
  for (let tick = 0; tick < 480; tick++) {
    const time = tick / 60;
    if (taps.has(tick)) { lastTap = tick; events.push({ tick, time, event: 'tap', requestedCadenceMs: taps.get(tick) * 1000 }); }
    if (tick === diveTick) events.push({ tick, time, event: 'Sim.dive' });
    if (tick === stageTick) events.push({ tick, time, event: 'stage solo planet below existing flight path' });
    for (const run of [actual, reference]) {
      if (tick === stageTick) {
        const r = Cat.PHYS.planetR, gap = 2000, bottomY = run.w.squirrel.y + 57;
        run.w.planets.push({ x: run.w.W * Cat.PHYS.squirrelX + run.w.speed / 60,
          gapY: bottomY - gap / 2 - r, gap, r, topKind: 0, botKind: 0,
          scored: true, solo: true, drift: 0, driftAmp: 0, blockers: [] });
      }
      if (taps.has(tick)) {
        const beforeVy = run.w.squirrel.vy;
        assert.equal(Sim.flap(run.w, run.save), 'flap', 'scheduled tap is accepted by actual simulation');
        assert.equal(run.w.squirrel.vy, Cat.PHYS.flap, 'fixture uses the game\'s normal flap velocity');
        if (run === actual) events.at(-1).acceptedImpulse = beforeVy - run.w.squirrel.vy;
      }
      if (tick === diveTick) Sim.dive(run.w, run.save);
      if (run === actual) {
        const testCopy = structuredClone(run.w.arcflash);
        withoutVisualRandom(() => M.stepArcflash(testCopy, 1 / 60, run.w.squirrel.vy, run.w.ready));
      }
      const sound = Sim.updateWorld(run.w, run.save, 1 / 60);
      assert.equal(run.w.screen, 'play', 'pilot stays inside the tall review chamber without position resets');
      if (run === actual && sound === 'bounce') {
        contactTick = tick; events.push({ tick, time, event: 'real Sim planet collision', y: run.w.squirrel.y,
          reboundVy: run.w.squirrel.vy, contactStrength: run.w.arcflash.contactStrength });
      }
    }
    for (const key of equalKeys) assert.deepEqual(actual.w[key], reference.w[key], `Arcflash and Flight retain identical ${key} at tick ${tick}`);
    const w = actual.w, state = w.arcflash;
    const limbs = geometry(state);
    trace.push({ tick, time: +(time + 1 / 60).toFixed(6), tap: taps.has(tick), y: w.squirrel.y,
      vy: w.squirrel.vy, distance: w.distance, phase: state.phase, pressure: state.pressure,
      pose: { ...state.pose }, rates: { ...state.rates }, tail: M.arcflashTailAngles(state),
      contactAge: state.contactAge, landmarks: limbs });
    if (tick % 2) continue;

    ctx.fillStyle = '#060d18'; ctx.fillRect(0, 0, 960, 720);
    const background = ctx.createRadialGradient(395, 290, 20, 395, 290, 510);
    background.addColorStop(0, '#10243d'); background.addColorStop(1, '#060d18');
    ctx.fillStyle = background; ctx.fillRect(18, 102, 671, 563);
    // Deterministic scenery moves with actual world travel, not Math.random.
    for (let i = 0; i < 48; i++) {
      const x = 30 + ((i * 137.13 - w.distance * .12) % 645 + 645) % 645;
      const y = 116 + ((i * 91.77 - w.squirrel.y * .05) % 523 + 523) % 523;
      ctx.fillStyle = `rgba(147,189,222,${.18 + (i % 4) * .08})`;
      ctx.beginPath(); ctx.arc(x, y, .6 + i % 3 * .3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#1d354d'; ctx.lineWidth = 1;
    ctx.strokeRect(704, 102, 237, 563);
    text('ARCFLASH / FLIGHT MOTION', 26, 36, 26, '#e6f5ff', '700');
    text('Native Canvas motion review · actual flight simulation · normal speed', 26, 64, 14);
    text('Following camera · open review chamber · all body motion stays live', 26, 85, 12, '#7894ac');
    text(`${time.toFixed(2)} / 8.00 s`, 827, 37, 14, '#cae8ff');
    text('ENLARGED', 37, 130, 11, '#72bcf0', '700');
    text('PHONE GAME SCALE', 719, 133, 12, '#72bcf0', '700');
    text('52 canvas pixels', 719, 154, 12, '#a7bbce');
    // Panel clips affect the review canvas only. The complete pilot has
    // generous padding; long history trails cannot obscure review labels.
    ctx.save();ctx.beginPath();ctx.rect(18,102,671,496);ctx.clip();
    paintPilot(386, 279, sizes.enlarged);ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(705,173,235,231);ctx.clip();
    drawPlanetPhone(812, 314); paintPilot(812, 314, sizes.phone);ctx.restore();
    const phase = tick - contactTick < 38 ? 'CONTACT / PUSH-OFF' : state.phase === 'rise' ? 'CLIMB' : state.phase === 'fall' ? 'DESCENT' : state.phase === 'dive' ? 'CONTROLLED DIVE' : 'RELEASE / APEX';
    text(phase, 37, 623, 20, '#bdeaff', '700');
    const active = bursts.find(b => time >= b.start && time < b.start + (b.count - 1) * b.interval + .25);
    const cue = active ? `${Math.round(active.interval * 1000)} ms tap group` : tick >= diveTick && tick < stageTick ? 'Actual down swipe' : 'Hands off / gravity';
    ctx.fillStyle = tick - lastTap < 5 ? '#67e0ff' : '#2a4760'; ctx.beginPath(); ctx.arc(44, 650, 5, 0, Math.PI * 2); ctx.fill();
    text(cue, 58, 655, 14, '#9bc5e2');
    text(`${w.squirrel.vy < 0 ? 'Rising' : 'Falling'}  ${Math.abs(w.squirrel.vy).toFixed(0)} px/s`, 719, 425, 13, '#d3e8f7');
    text(`Body ${state.pose.body.toFixed(0)}°`, 719, 453, 13);
    text('Same live state', 719, 487, 12, '#7f9bb2');
    text('Fixed head size', 719, 512, 12, '#7f9bb2');
    text('Fixed limb lengths', 719, 537, 12, '#7f9bb2');
    text('6.03s: staged planet', 719, 589, 11, '#a9bfce');
    text('Actual collision response', 719, 609, 11, '#a9bfce');
    text('Review fixture, not a device recording. One staged planet; no pilot resets, pose overrides, flips or rolls.', 26, 697, 11, '#829cb2');
    const buffer = film.toBuffer('image/png');
    writeFileSync(join(frameDir, `${String(tick / 2).padStart(4, '0')}.png`), buffer);
    if (tick === 134) writeFileSync(join(output, 'flight-preview.png'), buffer);
  }
  assert(actual.w.run.bounces >= 1, 'staged planet must generate at least one actual simulation bounce');
  assert(trace.some(f => f.vy < -100) && trace.some(f => f.vy > 150), 'film contains true ascent and descent');
  assert.equal(randomInVisuals, 0, 'controller and renderer use no Math.random');
  const scaleReport = Object.fromEntries([...scales].map(([key, values]) => {
    const min = Math.min(...values), max = Math.max(...values);
    // Native Canvas stores transforms with float32 precision; a 2ppm bound
    // tolerates roundoff while detecting even subpixel anatomical breathing.
    assert(max - min < Math.max(1, max) * 2e-6, `${key} scale cannot change during motion (${max - min})`);
    return [key, { samples: values.length, min, max, spread: max - min }];
  }));
  assert(bodyScaleSamples >= 900, 'measure real head and torso drawing transforms throughout both views');
  const encoded = join(frameDir, 'flight-preview.mp4');
  execFileSync(process.env.ACORNAUT_FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30',
    '-i', join(frameDir, '%04d.png'), '-frames:v', '240', '-c:v', 'libx264', '-preset', 'medium',
    '-threads', '2', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', encoded]);
  const probe = JSON.parse(execFileSync(process.env.ACORNAUT_FFPROBE || 'ffprobe', ['-v', 'error',
    '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,duration', '-of', 'json', encoded], { encoding: 'utf8' }));
  assert.equal(probe.streams[0].nb_frames, '240', 'encoded film must contain every rendered review frame');
  assert.equal(Number(probe.streams[0].duration), 8, 'encoded film must play at normal speed for eight seconds');
  copyFileSync(encoded, join(output, 'flight-preview.mp4'));
  const report = { provenance: 'Native Canvas production Arcflash painter with actual 60Hz Sim flight. Following camera in a tall fixture; not browser/device footage.',
    build: Cat.ART_VER, playback: { width: 960, height: 720, simulationHz: 60, fps: 30, seconds: 8, frames: 240, speed: 1 },
    fixture: { width: 390, height: 5000, emptyGeneratedGates: true, stagedSoloPlanetAtSeconds: stageTick / 60,
      contactViaActualSimulation: true, pilotPositionResets: 0, controllerDisplayOverrides: {} },
    physics: Cat.PHYS, bursts, events, equalEveryTick: equalKeys, gameplayEquality: true,
    finalRun: actual.w.run, fixedScale: scaleReport, maxLimbLengthError: Math.max(...anatomyErrors),
    visualMathRandomCalls: randomInVisuals, rendererMutatesMotion: false, trace };
  writeFileSync(join(output, 'flight-trace.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, output, frames: 240, bounces: actual.w.run.bounces,
    gameplayEquality: true, scaleSpreads: Object.fromEntries(Object.entries(scaleReport).map(([key, value]) => [key, value.spread])),
    maxLimbLengthError: report.maxLimbLengthError, visualMathRandomCalls: 0 }));
} finally {
  Math.random = originalRandom;
  if (!process.env.ACORNAUT_KEEP_REVIEW_FRAMES) rmSync(frameDir, { recursive: true, force: true });
}
