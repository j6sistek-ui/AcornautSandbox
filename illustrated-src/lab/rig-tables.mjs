// Pulls the rig editor's starting values out of the SHIPPING source, so
// the tool can never open on numbers the game does not actually use.
// DOME and HELM_GLASS live in draw.ts; the names and the two flags that
// change how a suit is drawn (ownHead/cat, bakedDome) live in catalog.ts.
//
// Parsed rather than imported on purpose: the lab must not link against
// the game's modules, and a build step that quietly diverges from the
// source it claims to mirror is worse than no tool at all.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// `header` is a regex so a type annotation can change — as it did when
// HELM_GLASS grew an optional rotation — without silently emitting an
// empty table. A miss throws; a build that cannot read the source it
// mirrors must not produce a tool that looks like it can.
function block(src, headerRe) {
  const m = src.match(headerRe);
  if (!m) throw new Error(`missing block: ${headerRe}`);
  const header = m[0];
  const i = m.index;
  // a record closes on "};", an array on "];" — take whichever comes first,
  // or the block runs on into whatever is declared next
  const a = src.indexOf("\n};", i);
  const b = src.indexOf("\n];", i);
  const j = Math.min(a < 0 ? Infinity : a, b < 0 ? Infinity : b);
  if (!isFinite(j)) throw new Error(`unterminated block: ${header}`);
  return src.slice(i + header.length, j);
}

// keys in these tables are written both ways — `comet: [...]` and
// `"clear": [...]` — so accept either rather than silently dropping one
function triples(text) {
  const out = {};
  for (const m of text.matchAll(/(?:"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*\[([^\]]+)\]/g)) {
    out[m[1] ?? m[2]] = m[3].split(",").map((n) => Number(n.trim()));
  }
  return out;
}

export function buildTables(root) {
  const draw = readFileSync(join(root, "illustrated-src/game/draw.ts"), "utf8");
  const cat = readFileSync(join(root, "illustrated-src/game/catalog.ts"), "utf8");

  const dome = triples(block(draw, /const DOME[^=]*=\s*\{/));
  const glass = triples(block(draw, /const HELM_GLASS[^=]*=\s*\{/));

  const artVer = (cat.match(/ART_VER\s*=\s*"([^"]+)"/) || [, "1"])[1];

  // one object literal per line in both arrays, so a line scan is exact
  function rows(headerRe) {
    const text = block(cat, headerRe);
    const out = [];
    for (const line of text.split("\n")) {
      const id = line.match(/\{\s*id:\s*"([^"]+)"/);
      if (!id) continue;
      const name = line.match(/name:\s*"([^"]+)"/);
      const suitOnly = line.match(/\bsuitOnly:\s*"([^"]+)"/);
      out.push({
        id: id[1],
        name: name ? name[1] : id[1],
        ownHead: /\b(cat|ownHead):\s*true/.test(line),
        bakedDome: /\bbakedDome:\s*true/.test(line),
        suitOnly: suitOnly ? suitOnly[1] : undefined,
        opaqueVisor: /\bopaqueVisor:\s*true/.test(line),
      });
    }
    return out;
  }

  const suitRows = rows(/export const SUITS[^=]*=\s*\[/);
  const helmRows = rows(/export const HELMETS[^=]*=\s*\[/);

  const suits = [];
  for (const r of suitRows) {
    const key = "suit:" + r.id;
    if (!dome[key]) continue; // a suit with no measured head cannot be seated
    suits.push({
      id: r.id,
      name: r.name,
      key,
      file: `suits/${r.id}.png`,
      dome: dome[key].slice(0, 3),
      ownHead: r.ownHead,
      bakedDome: r.bakedDome,
      frame: false,
    });
  }
  // Flight animation frames retain their baked Clear dome. The shipping
  // renderer uses bare `suits/flight.png` for every custom helmet, so those
  // eight frames no longer form another 160 helmet combinations. They are
  // reviewed as Clear-only animation art in the visual-audit page instead.

  const helmets = helmRows
    .filter((r) => glass[r.id])
    .map((r) => ({
      id: r.id,
      name: r.name,
      file: `helms/${r.id}.png`,
      glass: [glass[r.id][0], glass[r.id][1], glass[r.id][2], glass[r.id][3] || 0],
      // suit-locked helmets never render on any other suit (the game snaps
      // back to Clear), so the editor must not offer those pairings to fit
      suitOnly: r.suitOnly,
      // an opaque visor is never punched — fitting one through a punched
      // hole that the game does not cut would be fitting a lie
      opaqueVisor: r.opaqueVisor || undefined,
    }));

  return { artVer, suits, helmets };
}

export function writeTables(root, outDir) {
  const t = buildTables(root);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "tables.json"), JSON.stringify(t, null, 1));
  return t;
}
