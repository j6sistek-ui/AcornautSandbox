#!/usr/bin/env node
// Catalog contract for helmet interoperability. The two new costume sets stay
// exclusive; every other new helmet must remain selectable on every suit that
// accepts a helmet.
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

globalThis.window = { __ACORNAUT_BETA__: true };

const root = resolve(import.meta.dirname, "..");
const js = join(mkdtempSync(join(tmpdir(), "acornaut-helmet-contract-")), "js");
cpSync(join(root, "docs", "js"), js, { recursive: true });
writeFileSync(join(js, "package.json"), '{"type":"module"}\n');

const { HELMETS, SUITS, helmetWornBy, wearsOwnHead } =
  await import(pathToFileURL(join(js, "catalog.js")).href);

const interchangeable = [
  "cinderforge", "cosmic", "abyssal", "amethyst", "ivoryguard", "reactor",
];
const exclusive = new Map([
  ["groveguard", "groveguard"],
  ["sunforged", "sunforged"],
]);
const wearableSuits = SUITS.filter((suit) => !wearsOwnHead(suit));

for (const id of interchangeable) {
  const helmet = HELMETS.find((item) => item.id === id);
  assert(helmet, `missing new helmet ${id}`);
  assert(!helmet.suitOnly, `${id} unexpectedly became suit-exclusive`);
  for (const suit of wearableSuits) {
    assert(helmetWornBy(id, suit.id).id === id,
      `${id} fell back instead of fitting ${suit.id}`);
  }
}

for (const [id, owner] of exclusive) {
  const helmet = HELMETS.find((item) => item.id === id);
  assert(helmet?.suitOnly === owner, `${id} lost its ${owner}-only contract`);
  assert(helmetWornBy(id, owner).id === id, `${id} does not equip on ${owner}`);
  for (const suit of wearableSuits.filter((item) => item.id !== owner)) {
    assert(helmetWornBy(id, suit.id).id === "clear",
      `${id} escaped its exclusive set on ${suit.id}`);
  }
}

console.log(
  `PASS: ${interchangeable.length} new helmets fit ${wearableSuits.length} wearable suits; ` +
  `${exclusive.size} new costume helmets remain exclusive`,
);
