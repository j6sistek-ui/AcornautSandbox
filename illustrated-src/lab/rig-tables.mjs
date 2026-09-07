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
    // A suit with no measured head cannot be SEATED - but an own-head suit
    // is still a suit, and a picker that silently drops four of the
    // roster's thirty-one reads as broken. Own-head suits get their tile
    // with a dummy dome the editor never uses; anything else without an
    // anchor stays out, because showing it would invite fitting a helmet
    // the game has nowhere to put.
    if (!dome[key] && !r.ownHead) continue;
    suits.push({
      id: r.id,
      name: r.name,
      key,
      file: `suits/${r.id}.png`,
      dome: dome[key] ? dome[key].slice(0, 4) : [128, 128, 40],
      ownHead: r.ownHead,
      bakedDome: r.bakedDome,
      frame: false,
    });
  }
  // Only the eight original art/squirrel idle/flap paintings retain a
  // baked Clear dome. Flight's current art/suits motion banks are bare
  // headed, so their helmet fit belongs in this editor with every bank.

  // A BANK'S FRAMES ARE SEATABLE ART - every bank, not just the velocity
  // ramps. A Grok-swept suit flies a painted ascent/descent ramp whose
  // head moves frame to frame; Robo, Big Booty and Eclipse tap through
  // painted banks the same way. Each anchored frame is hand-fittable here
  // exactly like a static: the editor already knows a frame tile must not
  // hijack the suit selector, and its COPY report prints the same keys
  // draw.ts uses, so a fitting session pastes straight back into the
  // table. Not hardcoded to a roster: any `<suit>-asc/desc/tap/bounce-N`
  // anchor in DOME earns its tile the moment it lands.
  const KIND_ORDER = ["asc", "desc", "tap", "bounce"];
  const label = (r, sid) => (r ? r.name : sid[0].toUpperCase() + sid.slice(1));
  const frameTiles = Object.keys(dome)
    .map((k) => /^(\w+?)-(asc|desc|tap|bounce)-(\d+)$/.exec(k))
    .filter(Boolean)
    .sort((a, b) => a[1].localeCompare(b[1])
      || KIND_ORDER.indexOf(a[2]) - KIND_ORDER.indexOf(b[2])
      || Number(a[3]) - Number(b[3]));
  for (const [key, sid, kind, n] of frameTiles) {
    suits.push({
      id: key,
      name: `${label(suitRows.find((r) => r.id === sid), sid)} ${kind} ${n}`,
      key,
      file: `suits/${key}.png`,
      // frames keep their 4th value: the pose's helmet rotation
      dome: dome[key].slice(0, 4),
      ownHead: false,
      bakedDome: false,
      frame: true,
    });
  }

  // AN OWN-HEAD BANK IS REVIEWABLE ART TOO. Alien, Alien 2 and Cyber fly
  // painted ramps but never wear a seated helmet, so they have no DOME
  // frame anchors - and the frames view used to show them nothing at all.
  // Their tiles come from the bank REGISTRIES instead (ASC/DESC_BANKS in
  // art.ts), with a dummy dome the editor never uses: an ownHead tile
  // draws the art and the "own head" label and skips the helmet entirely.
  const art = readFileSync(join(root, "illustrated-src/game/art.ts"), "utf8");
  const bankCounts = (name) => {
    const m = art.match(new RegExp(name + "[^{]*\\{([^}]*)\\}"));
    const out = {};
    if (m) for (const b of m[1].matchAll(/(\w+):\s*(\d+)/g)) out[b[1]] = Number(b[2]);
    return out;
  };
  const ascN = bankCounts("ASC_BANKS");
  const descN = bankCounts("DESC_BANKS");
  const tapN = bankCounts("TAP_BANKS");
  const bounceN = bankCounts("BOUNCE_BANKS");
  const ownHeadIds = new Set(suitRows.filter((r) => r.ownHead).map((r) => r.id));
  const ownHeadTile = (sid, kind, i) => ({
    id: `${sid}-${kind}-${i}`,
    name: `${label(suitRows.find((r) => r.id === sid), sid)} ${kind} ${i}`,
    key: `${sid}-${kind}-${i}`,
    file: `suits/${sid}-${kind}-${i}.png`,
    dome: [128, 128, 40],
    ownHead: true,
    bakedDome: false,
    frame: true,
  });
  for (const sid of Object.keys(ascN).sort()) {
    if (!ownHeadIds.has(sid) || !descN[sid]) continue;
    for (const [kind, n] of [["asc", ascN[sid]], ["desc", descN[sid]]]) {
      for (let i = 1; i <= n; i++) suits.push(ownHeadTile(sid, kind, i));
    }
  }
  // Own-head TAP and BOUNCE banks are reviewable the same way - the cat
  // and Volt animate through painted frames no other view shows.
  for (const [reg, kind] of [[tapN, "tap"], [bounceN, "bounce"]]) {
    for (const sid of Object.keys(reg).sort()) {
      if (!ownHeadIds.has(sid)) continue;
      for (let i = 1; i <= reg[sid]; i++) suits.push(ownHeadTile(sid, kind, i));
    }
  }

  // A TAP BANK WITHOUT PER-FRAME ANCHORS STILL WEARS THE HELMET - the game
  // seats it at the suit's single static anchor on every frame (draw.ts
  // falls back to `suit:<id>` when `<id>-tap-N` is absent). Those frames
  // are exactly where seat drift hides, so each one gets a tile seeded
  // from the static anchor: the fitter can SEE the drift frame by frame,
  // and the COPY report mints the per-frame `<id>-tap-N` keys, which
  // draw.ts starts honoring the moment they are pasted into DOME. Suits
  // whose tap anchors already exist (Robo, Big Booty, Eclipse) came in
  // through the DOME scan above and are skipped here.
  for (const sid of Object.keys(tapN).sort()) {
    if (ownHeadIds.has(sid) || dome[`${sid}-tap-1`]) continue;
    const seat = dome["suit:" + sid];
    if (!seat) continue; // no measured head to seed from
    for (let i = 1; i <= tapN[sid]; i++) {
      suits.push({
        id: `${sid}-tap-${i}`,
        name: `${label(suitRows.find((r) => r.id === sid), sid)} tap ${i}`,
        key: `${sid}-tap-${i}`,
        file: `suits/${sid}-tap-${i}.png`,
        dome: seat.slice(0, 4),
        ownHead: false,
        bakedDome: false,
        frame: true,
      });
    }
  }

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
