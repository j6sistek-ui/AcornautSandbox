#!/usr/bin/env node
// Numerical behavior of the built controller. Actual pixels, attachments,
// anatomical scale and phone frame pacing belong to the renderer review.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PHYS } from '../docs/js/catalog.js';

const A = process.env.ACORNAUT_ARCFLASH_CANDIDATE
  ? await import(pathToFileURL(join(process.env.ACORNAUT_ARCFLASH_CANDIDATE, 'arcflash-motion.js')).href)
  : await import('../docs/js/arcflash-motion.js');
const keys = Object.keys(A.createArcflashMotion().pose);
const tailKeys = ['tailRoot', 'tailMid', 'tailTip', 'tailRootRate', 'tailMidRate', 'tailTipRate'];
const round = n => +n.toFixed(4);
const copy = s => ({ pose: { ...s.pose }, rates: { ...s.rates }, time: s.time,
  ...Object.fromEntries(tailKeys.map(k => [k, s[k]])) });
const finite = s => {
  for (const [key, value] of Object.entries({ ...s.pose, ...s.rates,
    ...Object.fromEntries(tailKeys.map(k => [k, s[k]])), time: s.time, pressure: s.pressure })) {
    assert(Number.isFinite(value), `${key} must remain finite`);
  }
  assert(s.pose.body > -10 && s.pose.body < 100, 'ordinary flight and dives must never roll over');
  assert(Math.abs(s.pose.head) < 60, 'head must retain a readable local attitude');
  assert(s.pressure >= 0 && s.pressure <= 1, 'exhaust intensity must remain bounded');
  const tail = A.arcflashTailAngles(s);
  assert(Math.abs(tail.mid - tail.root) < 21, 'middle tail curvature must stay bounded through reversal');
  assert(Math.abs(tail.tip - tail.mid) < 17, 'tail-tip curvature must stay bounded through reversal');
};
function travel(s, seconds, vy, fps = 120) {
  for (let t = 0; t < seconds - 1e-9;) {
    const dt = Math.min(1 / fps, seconds - t);
    A.stepArcflash(s, dt, vy); finite(s); t += dt;
  }
}

// Hooks may update an input envelope or contact clock, never a displayed pose.
const continuity = A.createArcflashMotion();
travel(continuity, .4, 350);
for (const [name, apply] of [
  ['tap', () => A.arcflashTap(continuity, 750)],
  ['dive', () => A.arcflashDive(continuity)],
  ['contact', () => A.arcflashContact(continuity, -1, 1)],
]) {
  const before = copy(continuity); apply();
  assert.deepEqual(copy(continuity), before, `${name} must preserve positions, rates and continuous time`);
}
const beforeInvalid = structuredClone(continuity);
for (const impulse of [NaN, Infinity, -10, 0]) A.arcflashTap(continuity, impulse);
for (const [dt, vy] of [[0, 0], [-1, 0], [NaN, 0], [1 / 60, NaN]]) A.stepArcflash(continuity, dt, vy);
assert.deepEqual(continuity, beforeInvalid, 'invalid or rejected inputs must leave visual state unchanged');

const light = A.createArcflashMotion(), strong = A.createArcflashMotion();
A.arcflashTap(light, Math.abs(PHYS.flap) * .1);
A.arcflashTap(strong, Math.abs(PHYS.flap) * 1.8);
assert(strong.pressure > light.pressure * 1.6, 'arresting a fall must create a visibly stronger jet pulse');
const pressureAtTap = strong.pressure;
travel(strong, .15, PHYS.flap);
assert(strong.pressure < pressureAtTap && strong.pressure > .1, 'pulse must decay smoothly instead of sticking or disappearing instantly');

// A powered climb has a sustained jet, separate from the short tap accent.
// The pose becoming "cruise" near apex must not prematurely switch it off.
const powered = A.createArcflashMotion();A.arcflashTap(powered, -PHYS.flap);
travel(powered, .25, -100);
assert(powered.boosting && powered.boost > .65, 'jet floor persists through ascent');
travel(powered, .04, -1);
assert(powered.boosting && powered.boost > .65, 'near-apex cruise pose still has upward thrust');
A.stepArcflash(powered, 1/120, 0);
assert(!powered.boosting, 'actual apex releases the booster');
travel(powered, .3, 200);
assert(powered.boost < .025, 'jet fades after apex without relighting in descent');
for(const event of [s=>A.arcflashDive(s),s=>A.arcflashContact(s,-1,1),s=>A.stepArcflash(s,1/60,-450,true)]){
  A.arcflashTap(powered,450);event(powered);assert(!powered.boosting,'dive/contact/ready ends powered ascent');
}

// Actual gravity resolves ascent inside the game's short normal tap window.
const apexSeconds = -PHYS.flap / PHYS.gravity;
const arc = A.createArcflashMotion(), neutral = { ...arc.pose };
A.arcflashTap(arc, -PHYS.flap);
let vy = PHYS.flap, t = 0, rise, apex, fall;
while (t < 1 - 1e-9) {
  const dt = 1 / 120; vy += PHYS.gravity * dt;
  A.stepArcflash(arc, dt, vy); finite(arc); t += dt;
  if (!rise && t >= apexSeconds * .58) rise = { ...arc.pose };
  if (!apex && t >= apexSeconds) apex = { ...arc.pose };
  if (!fall && t >= apexSeconds + .4) fall = { ...arc.pose };
}
assert(rise.body < neutral.body - 20, 'torso must begin a meaningful climb before the normal apex');
assert(rise.nearElbow < neutral.nearElbow - 25, 'arms must streamline during the same short climb');
assert(apex.body > rise.body + 8, 'torso must release its climb posture as velocity crosses zero');
assert(fall.body > neutral.body + 10, 'an untapped fall must become visibly different from cruise');
assert(fall.nearElbow > rise.nearElbow + 25, 'hands must recover from the climb during descent');
assert(rise.head > 8 && fall.head < -4, 'local head motion must counterrotate body attitude changes');

// Repeated taps use accepted delta-v, never a canned impulse. The final
// one-second release requires the same state to recover into a true fall.
const schedules = [];
for (const cadence of [.1, .18, .3]) {
  const s = A.createArcflashMotion(); let vy = 0, nextTap = 0, taps = 0;
  let maxBodyStep = 0, maxJointStep = 0, minimumBody = Infinity;
  const heldArms = [], heldTails = [];
  for (let tick = 0; tick < 720; tick++) {
    const time = tick / 120;
    if (time < 5 && time + 1e-9 >= nextTap) {
      const before = copy(s);
      A.arcflashTap(s, Math.max(1, vy - PHYS.flap));
      assert.deepEqual(copy(s), before, `${cadence}s tap must not rewind a gesture`);
      vy = PHYS.flap; nextTap += cadence; taps++;
    }
    vy += PHYS.gravity / 120;
    const before = { ...s.pose };
    A.stepArcflash(s, 1 / 120, vy); finite(s);
    maxBodyStep = Math.max(maxBodyStep, Math.abs(s.pose.body - before.body));
    maxJointStep = Math.max(maxJointStep, ...keys.filter(k => k !== 'heave').map(k => Math.abs(s.pose[k] - before[k])));
    minimumBody = Math.min(minimumBody, s.pose.body);
    if (time >= 1 && time < 5) { heldArms.push(s.pose.nearArm); heldTails.push(A.arcflashTailAngles(s).tip); }
  }
  assert(maxBodyStep < 2.6 && maxJointStep < 3.6, `${cadence}s taps must keep transitions below snapping speeds`);
  assert(minimumBody < neutral.body - 25, `${cadence}s taps must visibly attain climb`);
  assert(s.pose.body > neutral.body + 12, `${cadence}s schedule must release into descent`);
  const armRange = Math.max(...heldArms) - Math.min(...heldArms);
  const tailRange = Math.max(...heldTails) - Math.min(...heldTails);
  if (cadence <= .1) assert(armRange < 5, 'sustained climb must settle the arms rather than pump on each tap');
  assert(tailRange > .6, 'tail must retain visible secondary motion during a sustained attitude');
  schedules.push({ cadenceMs: cadence * 1000, taps, minBody: round(minimumBody),
    maxBodyStep120Hz: round(maxBodyStep), maxJointStep120Hz: round(maxJointStep),
    heldArmRange: round(armRange), heldTailTipRange: round(tailRange) });
}

// A down-swipe followed by a tap must recover through springs, with no roll.
const recovery = A.createArcflashMotion();
A.arcflashDive(recovery); travel(recovery, .45, PHYS.dive);
const diveBody = recovery.pose.body;
A.arcflashTap(recovery, PHYS.dive - PHYS.flap);
travel(recovery, .3, PHYS.flap);
assert(diveBody > neutral.body + 12 && recovery.pose.body < neutral.body - 20,
  'swipe-to-tap must return from controlled dive to climb without rolling');

// An immediate boost cannot erase an impact. Isolate the contact contribution
// from the otherwise-identical acceleration and ordinary flight transition.
const hit = A.createArcflashMotion(), clear = A.createArcflashMotion();
travel(hit, .4, PHYS.dive); travel(clear, .4, PHYS.dive);
A.arcflashContact(hit, -1, 1);
A.arcflashTap(hit, PHYS.dive - PHYS.flap); A.arcflashTap(clear, PHYS.dive - PHYS.flap);
assert.equal(hit.contactAge, 0, 'tap must preserve the fresh contact clock');
let peakCompression = 0, peakKneeDifference = 0;
for (let i = 0; i < 180; i++) {
  A.stepArcflash(hit, 1 / 120, PHYS.flap); A.stepArcflash(clear, 1 / 120, PHYS.flap);
  peakCompression = Math.max(peakCompression, hit.pose.heave - clear.pose.heave);
  peakKneeDifference = Math.max(peakKneeDifference, Math.abs(hit.pose.nearKnee - clear.pose.nearKnee));
  finite(hit);
}
assert(peakCompression > 1 && peakKneeDifference > 6, 'real contact must retain meaningful body and leg response through tap');
assert(Math.abs(hit.pose.heave - clear.pose.heave) < .2, 'impact must settle back to the same flight state');

// Split ticks at exact input times. This compares display timestep behavior
// without blaming the controller for deliberately quantized input schedules.
const timingEvents = [[0, 'tap'], [.18, 'tap'], [.36, 'tap'], [.66, 'tap'],
  [1.5, 'dive'], [1.9, 'contact'], [1.92, 'tap'], [2.02, 'tap'], [2.12, 'tap']];
function replay(fps) {
  const s = A.createArcflashMotion(); const samples = [];
  let t = 0, vy = 0, event = 0;
  for (let frame = 1; frame <= fps * 3; frame++) {
    const end = frame / fps;
    while (t < end - 1e-9) {
      while (event < timingEvents.length && timingEvents[event][0] <= t + 1e-9) {
        const kind = timingEvents[event++][1];
        if (kind === 'tap') { A.arcflashTap(s, Math.max(1, vy - PHYS.flap)); vy = PHYS.flap; }
        else if (kind === 'dive') { A.arcflashDive(s); vy = PHYS.dive; }
        else { A.arcflashContact(s, -1, .85); vy = PHYS.flap * .8; }
      }
      const next = Math.min(end, timingEvents[event]?.[0] ?? end), dt = next - t;
      vy += PHYS.gravity * dt; A.stepArcflash(s, dt, vy); finite(s); t = next;
    }
    if (frame % (fps / 10) === 0) samples.push(copy(s));
  }
  return samples;
}
const reference = replay(120), timing = [];
for (const fps of [30, 60]) {
  const run = replay(fps); let maxPoseError = 0, maxTailError = 0;
  for (let i = 0; i < run.length; i++) {
    maxPoseError = Math.max(maxPoseError, ...keys.map(k => Math.abs(run[i].pose[k] - reference[i].pose[k])));
    maxTailError = Math.max(maxTailError, ...tailKeys.slice(0, 3).map(k => Math.abs(run[i][k] - reference[i][k])));
  }
  assert(maxPoseError < 1.5 && maxTailError < 1, `${fps}Hz display must retain consistent pose and tail response`);
  timing.push({ fps, maxPoseErrorDegrees: round(maxPoseError), maxTailErrorDegrees: round(maxTailError) });
}

// Preview owns a clock per canvas, preserving independent hangar/portrait
// playback and recovering cleanly if time wraps back to the start.
const previewKey = {}, otherKey = {};
const first = A.arcflashPreview(previewKey, .7);
const firstSnapshot = copy(first);
A.arcflashPreview(otherKey, 4);
assert.deepEqual(copy(first), firstSnapshot, 'another portrait must not advance this preview clock');
assert.equal(A.arcflashPreview(previewKey, .8), first, 'a preview must retain its motion state while time advances');
assert.notEqual(A.arcflashPreview(previewKey, .1), first, 'a rewound preview must start a clean state');
finite(A.arcflashPreview(previewKey, NaN));

console.log(JSON.stringify({ passed: true, target: 'Arcflash built motion controller',
  apexSeconds: round(apexSeconds), shortArc: { riseBody: round(rise.body), apexBody: round(apex.body), fallBody: round(fall.body) },
  eventContinuity: true, pressureRespondsToAcceptedImpulse: true, contactSurvivesTap: true,
  tailCurvatureBounded: true, schedules, timestepComparison: timing,
  anatomicalScale: 'Requires rig geometry and raster verification; not claimed by this controller test.' }));
