#!/usr/bin/env node
// ARCADE's power-up rate is twice NORMAL's and no more (owner, 1 Oct 2026:
// "2x max"). It used to double on top of the base rate, which made it 4x.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sim=readFileSync(new URL('./game/sim.ts',import.meta.url),'utf8');
const block=sim.slice(sim.indexOf('const specialMul ='),sim.indexOf('const noShield ='));
assert(block.includes('(w.flight === "fly" ? 0.5 : 1)'),'NORMAL runs at half the base rate');
assert(!block.includes('w.flight === "arcade"'),'ARCADE no longer doubles on top of the base rate: it IS the base rate, 2x NORMAL');
assert(block.includes('hasPal(save, w, "meteorcore") && !bee ? 2 : 1'),'the pal bonus still rides on top');
console.log('arcade specials: ARCADE power-ups are 2x NORMAL, not 4x passed');
