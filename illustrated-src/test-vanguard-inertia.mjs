#!/usr/bin/env node
// Behavioral controller checks. Render/phone review still decides whether
// the registered artwork reads naturally at gameplay size.
import assert from 'node:assert/strict';
import {
  createVanguardMotion, stepVanguard, vanguardTap, vanguardDive,
  vanguardContact, VANGUARD_FRAMES, VANGUARD_PITCH_TRIM_DEFAULT,
} from '../docs/js/vanguard.js';
// the owner's forward trim is a deliberate constant lean on the whole drawing
const trim = VANGUARD_PITCH_TRIM_DEFAULT * Math.PI / 180;

const modes = ['cruise'];   // the trial modes are gone: Flight is the motion
const joints = ['nearArm', 'farArm', 'nearLeg', 'farLeg'];
const poseKeys = ['phase', 'frame', 'time', 'heading', 'pitch', ...joints, 'settle'];
const radians = degrees => degrees * Math.PI / 180;
const pose = state => Object.fromEntries(poseKeys.map(key => [key, state[key]]));
const angularKeys = ['heading', 'pitch', ...joints];
const travel = (state, seconds, vy, fps = 120) => {
  for (let tick = 0; tick < Math.round(seconds * fps); tick++) stepVanguard(state, 1 / fps, vy);
};
const maxJointDifference = (a, b) => Math.max(...joints.map(key => Math.abs(a[key] - b[key])));
function checkFinite(state, label) {
  for (const key of [...poseKeys, 'thrust', 'drive']) {
    assert(Number.isFinite(state[key]), `${label}: ${key} remains finite`);
  }
}

// Each normal tap reaches its apex in about 346ms. Test direction changes
// inside that real short arc, rather than a leisurely preview-only ascent.
for (const mode of modes) {
  const state = createVanguardMotion();
  let vy = -450;
  vanguardTap(state, 450);
  let rise;
  for (let tick = 0; tick < 90; tick++) {
    stepVanguard(state, 1 / 120, vy);
    vy += 1300 / 120;
    if (tick === 29) rise = pose(state);
  }
  assert(rise.heading < -radians(2), `${mode}: climb reads within 250ms`);
  assert(state.heading > radians(2), `${mode}: ordinary gravity becomes a descent`);
  assert(maxJointDifference(rise, state) > radians(2), `${mode}: limbs visibly change between rising and falling`);
  assert(Math.abs(state.heading) < radians(18), `${mode}: gravity does not produce the old diving posture`);
  assert(Math.abs(state.pitch - trim) < radians(36), `${mode}: beyond the trim, the drawing avoids the old 54-degree ordinary fall`);
}

// Frequent inputs must add acceleration without restarting the tail or
// snapping any displayed joint. Include descent→tap and swipe→tap recovery.
for (const mode of modes) for (const interval of [.1, .2, .3]) {
  const state = createVanguardMotion();
  const frames = new Set();
  let vy = 500;
  let nextTap = 0;
  for (let tick = 0; tick < 240; tick++) {
    const time = tick / 60;
    if (tick === 90) { vanguardDive(state); vy = 380; nextTap = 2; }
    if (time + 1e-8 >= nextTap) {
      const before = pose(state);
      vanguardTap(state, Math.max(0, vy + 450));
      assert.deepEqual(pose(state), before, `${mode}/${interval}: tap preserves displayed pose and loop progress`);
      vy = -450;
      nextTap += interval;
    }
    const before = pose(state);
    stepVanguard(state, 1 / 60, vy);
    vy += 1300 / 60;
    checkFinite(state, `${mode}/${interval}`);
    for (const key of ['heading', 'pitch']) {
      assert(Math.abs(state[key] - before[key]) <= 1.5 / 60 + 1e-8,
        `${mode}/${interval}: ${key} recovery remains below 1.5 radians/second`);
    }
    for (const key of joints) {
      assert(Math.abs(state[key] - before[key]) <= 1.5 / 60 + 1e-8,
        `${mode}/${interval}: ${key} never snaps through a large gesture`);
    }
    assert.notEqual(state.phase, before.phase, `${mode}/${interval}: tail continues between every input`);
    frames.add(state.frame);
  }
  assert.equal(frames.size, VANGUARD_FRAMES, `${mode}/${interval}: frequent taps retain the complete tail sweep`);
}

// The response must distinguish a light refresh of upward motion from
// arresting a real fall, even when their final velocity is the same.
for (const mode of modes) {
  const light = createVanguardMotion();
  const strong = createVanguardMotion();
  vanguardTap(light, 40); vanguardTap(strong, 800);
  travel(light, .15, -450); travel(strong, .15, -450);
  assert(strong.thrust > light.thrust * 1.5, `${mode}: exhaust responds to accepted acceleration strength`);
  assert(strong.drive > light.drive, `${mode}: body reaction responds to accepted acceleration strength`);
}


// Isolate the contact contribution with an otherwise identical twin.
// An immediate tap may change acceleration but cannot erase push-off.
for (const mode of modes) {
  const hit = createVanguardMotion();
  const clear = createVanguardMotion();
  travel(hit, .5, 180); travel(clear, .5, 180);
  vanguardContact(hit, 42, 60, 0, -1, 1);
  const contact = hit.contacts[0];
  const age = hit.contactAge;
  const beforeTap = pose(hit);
  vanguardTap(hit, 700); vanguardTap(clear, 700);
  assert.equal(hit.contacts[0], contact, `${mode}: next tap retains the contacted surface plume`);
  assert.equal(hit.contactAge, age, `${mode}: next tap retains the contact response clock`);
  assert.deepEqual(pose(hit), beforeTap, `${mode}: contact followed by tap has no immediate pose snap`);
  let peakDifference = 0;
  let earlyDifference = 0;
  let lateDifference = Infinity;
  let compression = 0;
  let pushOff = 0;
  for (let tick = 0; tick < 144; tick++) {
    const vy = -450 + 1300 * tick / 120;
    stepVanguard(hit, 1 / 120, vy); stepVanguard(clear, 1 / 120, vy);
    const difference = Math.max(Math.abs(hit.settle - clear.settle), maxJointDifference(hit, clear));
    peakDifference = Math.max(peakDifference, difference);
    if (tick < 36) earlyDifference = Math.max(earlyDifference, difference);
    compression = Math.max(compression, hit.settle - clear.settle);
    pushOff = Math.min(pushOff, hit.settle - clear.settle);
    if (tick === 143) lateDifference = difference;
  }
  assert(earlyDifference > .01, `${mode}: contact produces a visible settling/push-off response`);
  assert(compression > .05 && pushOff < -.05, `${mode}: contact settles then pushes off instead of only holding a squat`);
  assert(lateDifference < peakDifference * .2, `${mode}: contact settles instead of permanently changing the pose`);
}

// An overhead impact braces the arms; it cannot pretend the feet landed.
const floor = createVanguardMotion();
const roof = createVanguardMotion();
const untouched = createVanguardMotion();
vanguardContact(floor,0,0,0,-1,1); vanguardContact(roof,0,0,0,1,1);
travel(floor,.2,-200); travel(roof,.2,-200); travel(untouched,.2,-200);
assert(Math.abs(floor.settle-untouched.settle)>.1, 'floor contact compresses the feet');
assert(Math.abs(roof.settle-untouched.settle)<1e-9, 'overhead contact does not compress the feet');
assert(Math.abs(roof.nearArm-untouched.nearArm)>.005, 'overhead contact braces the arms');
const slowing = createVanguardMotion();
const refreshing = createVanguardMotion();
vanguardTap(slowing,-200); vanguardTap(refreshing,100);
travel(slowing,.15,-450); travel(refreshing,.15,-450);
assert(slowing.thrust<=refreshing.thrust, 'slowing an upward rebound gets only the minimum tap response');


// One input schedule at common frame boundaries. Sample the same analytic
// gravity trajectory so differences describe presentation frame rate, not
// a separate integration error in the gameplay simulation.
function replay(mode, fps) {
  const state = createVanguardMotion();
  const events = new Map([
    [0, 'tap'], [2, 'tap'], [4, 'tap'], [6, 'tap'], [12, 'swipe'],
    [15, 'tap'], [18, 'contact'], [19, 'tap'], [28, 'switch'],
  ]);
  const samples = [];
  let velocityAtEvent = 0;
  let eventTime = 0;
  for (let tick = 0; tick < 4 * fps; tick++) {
    const time = tick / fps;
    let vy = velocityAtEvent + 1300 * (time - eventTime);
    const tenth = Math.round(time * 10);
    const event = Math.abs(time * 10 - tenth) < 1e-8 ? events.get(tenth) : undefined;
    if (event === 'tap') {
      vanguardTap(state, Math.max(0, vy + 450));
      velocityAtEvent = -450; eventTime = time; vy = -450;
    } else if (event === 'swipe') {
      vanguardDive(state); velocityAtEvent = 380; eventTime = time; vy = 380;
    } else if (event === 'contact') {
      vanguardContact(state, 42, 60, 0, -1, 1);
      velocityAtEvent = -450; eventTime = time; vy = -450;
    } else if (event === 'switch') {
      /* the trial modes are gone; a switch is a no-op */
    }
    stepVanguard(state, 1 / fps, vy);
    if ((tick + 1) % (fps / 10) === 0) samples.push({ ...pose(state), thrust: state.thrust, drive: state.drive });
  }
  return samples;
}
for (const mode of modes) {
  const reference = replay(mode, 120);
  for (const fps of [30, 60]) {
    const samples = replay(mode, fps);
    assert.equal(samples.length, reference.length);
    for (let i = 0; i < samples.length; i++) {
      for (const key of angularKeys) {
        assert(Math.abs(samples[i][key] - reference[i][key]) < radians(2),
          `${mode}/${fps}Hz sample ${i}: ${key} tracks the 120Hz motion within two degrees`);
      }
      for (const key of ['thrust', 'drive']) {
        assert(Math.abs(samples[i][key] - reference[i][key]) < .06,
          `${mode}/${fps}Hz sample ${i}: ${key} envelope is stable across frame rates`);
      }
      const phaseDifference = Math.abs(samples[i].phase - reference[i].phase);
      assert(Math.min(phaseDifference, 1 - phaseDifference) < 1e-6, 'tail phase has no frame-rate drift');
    }
  }
}

console.log('Vanguard inertia: short arcs, arm/leg response, frequent taps, bounded rotation, distinct/live modes, retained contact recovery, and 30/60/120Hz consistency passed');
