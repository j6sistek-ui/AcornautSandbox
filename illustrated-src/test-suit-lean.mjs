#!/usr/bin/env node
/** Every suit's lean is its own dial, and 1 is exactly what shipped.
 *
 *  Owner ruling, 26 Aug 2026: "the custom aren't custom pitch, they're
 *  custom animations." Lean and art are separate axes, so all 30 suits
 *  carry a dial - the five with custom frames included.
 *
 *  This lifts the two shipped expressions OUT OF THE BUILT draw.js and
 *  evaluates them, rather than restating them here. A test that re-types
 *  the formula proves the test author can multiply; this one fails if the
 *  expression in the file ever stops reading the dial.
 */
import { readFileSync } from "node:fs";

globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };

const CC = await import("../docs/js/control-constants.js");
const { SUIT_LEAN, suitLean } = CC;

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const DEG = 180 / Math.PI;

// ---- lift the shipped expressions --------------------------------------
const src = readFileSync(new URL("../docs/js/draw.js", import.meta.url), "utf8");
// the two heading-pitch constants are module-local to draw.js, so they are
// read from the same file as the expression that uses them
const rigConst = (name) => {
  const m = src.match(new RegExp(name + String.raw`\s*=\s*\(([\d.]+) \* Math\.PI\) / 180`));
  return m ? (parseFloat(m[1]) * Math.PI) / 180 : NaN;
};
const RIG_PITCH_UP = rigConst("RIG_PITCH_UP");
const RIG_PITCH_DOWN = rigConst("RIG_PITCH_DOWN");
const bankLine = src.match(/let bank = (w\.squirrel\.rot \* bankScale[^;]*);/);
const rigLine = src.match(/rigPitch = (hp < 0 \? hp \* RIG_PITCH_UP[^;]*);/);
ok(Number.isFinite(RIG_PITCH_UP) && Number.isFinite(RIG_PITCH_DOWN),
  "draw.js no longer declares RIG_PITCH_UP/RIG_PITCH_DOWN as a degree literal");
ok(!!bankLine, "draw.js no longer has a recognisable velocity-bank expression");
ok(!!rigLine, "draw.js no longer has a recognisable heading-pitch expression");
if (!bankLine || !rigLine) {
  console.log(JSON.stringify({ suite: "suit lean", failures: fail }, null, 1));
  process.exit(1);
}
ok(/lean\.(up|down)/.test(bankLine[1]),
  `the velocity bank ignores the lean dial: ${bankLine[1]}`);
ok(/rigLean\.(up|down)/.test(rigLine[1]),
  `the heading pitch ignores the lean dial: ${rigLine[1]}`);

const bankOf = new Function("w", "bankScale", "lean", `return ${bankLine[1]};`);
const rigOf = new Function("hp", "RIG_PITCH_UP", "RIG_PITCH_DOWN", "rigLean",
  `return ${rigLine[1]};`);

const bankAt = (rot, lean) => bankOf({ squirrel: { rot } }, 0.8, lean) * DEG;
const rigAt = (hp, lean) => rigOf(hp, RIG_PITCH_UP, RIG_PITCH_DOWN, lean) * DEG;

// ---- 1 IS WHAT SHIPPED -------------------------------------------------
// the whole point of landing the dials at 1 was that the game must not move
// underneath them. These are the pre-change expressions, stated once.
const ONE = { up: 1, down: 1 };
for (const rot of [-0.55, -0.3, 0, 0.4, 0.95]) {
  ok(Math.abs(bankAt(rot, ONE) - rot * 0.8 * DEG) < 1e-9,
    `at rot ${rot} a dial of 1 must reproduce rot*0.8 exactly, got ${bankAt(rot, ONE).toFixed(4)}`);
}
for (const hp of [-1, -0.5, 0.5, 1]) {
  const want = (hp < 0 ? hp * RIG_PITCH_UP : hp * RIG_PITCH_DOWN) * DEG;
  ok(Math.abs(rigAt(hp, ONE) - want) < 1e-9,
    `at hp ${hp} a dial of 1 must reproduce the old heading pitch, got ${rigAt(hp, ONE).toFixed(4)}`);
}
ok(Object.values(SUIT_LEAN).every((l) => l.up === 1 && l.down === 1),
  "the shipped table is no longer all 1s - that is fine, but this assertion " +
  "guards the CLAIM that landing the dials changed nothing, so retire it " +
  "deliberately rather than by accident");

// ---- the dial actually moves the pilot, and only in its own direction ---
for (const [name, lean, rot, want] of [
  ["half the dive", { up: 1, down: 0.5 }, 0.95, 0.95 * 0.8 * 0.5],
  ["dive dial must not touch the climb", { up: 1, down: 0.5 }, -0.55, -0.55 * 0.8],
  ["half the climb", { up: 0.5, down: 1 }, -0.55, -0.55 * 0.8 * 0.5],
  ["climb dial must not touch the dive", { up: 0.5, down: 1 }, 0.95, 0.95 * 0.8],
  ["pinned flat", { up: 0, down: 0 }, 0.95, 0],
]) {
  ok(Math.abs(bankAt(rot, lean) - want * DEG) < 1e-9,
    `${name}: expected ${(want * DEG).toFixed(2)}°, got ${bankAt(rot, lean).toFixed(2)}°`);
}

// ---- every suit has one, and the five custom ones are included ---------
const CUSTOM = ["eclipse", "volt", "bigbooty", "robo", "catsuit"];
for (const id of CUSTOM) {
  ok(SUIT_LEAN[id] !== undefined,
    `${id} has custom ANIMATION, which is not custom PITCH - it still needs a lean dial`);
}
ok(suitLean("no-such-suit").up === 1 && suitLean("no-such-suit").down === 1,
  "an unknown suit should fall back to a neutral dial, not undefined");

// ---- what the roster actually flies at today ---------------------------
const table = Object.keys(SUIT_LEAN).sort().map((id) => {
  const l = suitLean(id);
  return { suit: id, up: l.up, down: l.down,
    climbDeg: +bankAt(-0.55, l).toFixed(1), diveDeg: +bankAt(0.95, l).toFixed(1) };
});

console.log(JSON.stringify({
  suite: "suit lean dials",
  dials: SUIT_LEAN ? Object.keys(SUIT_LEAN).length : 0,
  rigHeadingDeg: { up: +(RIG_PITCH_UP * DEG).toFixed(1), down: +(RIG_PITCH_DOWN * DEG).toFixed(1) },
  atFullDeflection: table.slice(0, 4),
  failures: fail,
}, null, 1));
if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
