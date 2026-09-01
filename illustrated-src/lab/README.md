# The Lab

Prototypes. Nothing here is imported by the game and nothing here is in the
main build; the only threads back are the PROTOTYPES doors at the bottom of
the Modes sheet, each a link to a separate page rather than a dependency. A
lab experiment can be kept, reworked or deleted without touching a build
that is close to shipping — that isolation is the point, and it is why
`build-lab.mjs` is separate from `export-sandbox.mjs`.

```bash
node illustrated-src/build-lab.mjs   # -> docs/lab/rig/js and docs/lab/skytest/js
```

---

# THE SPILL — graduated

The debris-field survival prototype that used to live here has been
promoted to a real mode: `illustrated-src/game/spill.ts`, reached from the
Modes sheet like every other way to fly. The lab page, its packer and its
Help door are gone with it. What carried over, what changed, and the tuning
history that used to sit in this file are all in `illustrated-src/SPILL.md`.

---

# THE RIG EDITOR

A fitting bench. It draws heads and helmets exactly the way the game does
and lets you move them with your thumb, then hands the numbers back as
text you can paste into a chat.

```bash
node illustrated-src/build-lab.mjs     # -> docs/lab/rig/js + tables.json
```

Modes → **PROTOTYPES** → **RIG EDITOR** (Help carries the same door on the
live page). Delete-when-frozen, like every lab door.

## What it edits, and what it refuses to edit

Two tables, and only two:

- **DOME** — where each suit's head is, and how big, in that suit's own
  256px canvas. Every helmet-wearing suit in the catalog. The eight
  baked-Clear Flight frames are reviewed separately; custom helmets use
  the bare Flight rig.
- **HELM_GLASS** — where each helmet's glass circle is, and how big, in
  the helmet's own canvas. Every helmet in the catalog, beta included.

That is one triple per suit and one per helmet covering hundreds of
helmet-wearing pairings, and keeping it that way is the whole point. A
per-pair table would be hundreds of entries that every new suit grows by
dozens, and no two of them would ever be checked against each other again.

Both tables are regenerated from `draw.ts`/`catalog.ts` on every
`build-lab.mjs` run — **rebuild the lab whenever the game's tables or art
change**, or the bench opens on stale numbers over stale-cached art and
every number dialed in on it is wrong on arrival. Two catalog flags carry
through: a `suitOnly` helmet only appears paired with its own suit (the
game snaps every other pairing back to Clear, so there is nothing to fit),
and an `opaqueVisor` helmet is drawn unpunched, exactly as the game leaves
it.

So the **EDIT TARGET** switch is the main control, not a detail:

| Target | What moves | What it means |
|---|---|---|
| **HELMET** | that helmet's glass circle | this helmet is wrong on every suit |
| **SUIT HEAD** | that suit's head circle | this suit is wrong under every helmet |
| **THIS PAIR** | a local override | evidence, not a fix — see below |

The views exist to tell those two apart. If one helmet looks wrong on one
suit, switch to **one helmet × all suits**: wrong everywhere means the
helmet's number; wrong on one means that suit's head. **One suit × all
helmets** answers the mirror question. That diagnosis is the work; the
dragging is just how you enter the answer.

## Per-pair overrides

They exist, they are stored, and they are deliberately awkward. An
override never leaves the editor as a value to paste — it comes out in the
report as a comment. Three or more on the same helmet turns on **FOLD**,
which takes their median, converts it into that helmet's own glass numbers
and deletes them. The conversion uses the median head radius of the suits
involved, so it is an estimate; the grid shows you what is left over.

That is the intended use: collect overrides until the pattern is obvious,
fold them, look again.

## Controls

- **Tap a tile to select it, then drag it** — moves the piece under the
  current target. A tile that is not selected lets the page scroll straight
  through it; the first version captured every touch, so on a phone a swipe
  over the grid EDITED a tile instead of scrolling, the list below the fold
  was unreachable, and it read as "there are only 9 suits". The helmet
  follows your finger, so on a 128px tile one pixel of travel is several
  units of the underlying number. That is arithmetic, not a bug.
- **UNDO** — one step per gesture (drag, pad press, wheel burst, key burst),
  thirty deep, ctrl/cmd-Z on desktop. Exists because an accidental
  scroll-drag silently corrupted a number and there was no way back short
  of refitting by hand.
- **Both targets visibly move the helmet.** The suit's painting never moves
  — the helmet is the only thing seated on a number, so it is always what
  travels. The difference is WHICH number you are editing: HELMET edits the
  glass in the helmet's own frame (lands on every suit wearing it), SUIT
  HEAD edits where that suit's head is (the blue ring — lands under every
  helmet on that suit).
- **D-pad / arrow keys** — one *unit* per press, whatever the tile size.
  This is the precision control. Hold to repeat.
- **SIZE ± / pinch / scroll** — 2% a step.
- **ROT ±** — 2° a step, about the glass centre.
- **RINGS** — the head circle the contract is built on, and the dashed
  1.04 seat the helmet is actually scaled to.
- **FADE** — helmet at 45%, to see the face under it.
- Keys: `1` `2` `3` switch target, `[` `]` rotate, `+` `-` size,
  shift+arrow for 5.

## Rotation

`HELM_GLASS` grew an optional fourth number — degrees, about the glass
centre — for the asymmetric shells (crown, halo, horn) that sit level in
their own render but want a tilt on a head. No helmet uses it, so every
entry is still three numbers and the game draws exactly as before. The
editor writes it when you rotate something.

## Getting the work back out

**COPY** opens a sheet with the changes and nothing else — unchanged rows
are not printed, so a fitting session is a short paste rather than a dump
of 45 triples. **COPY VALUES** gives paste-ready TypeScript;
**COPY JSON** gives was/now pairs; **DOWNLOAD** writes a file.

Work is kept in `localStorage` under `acornaut.rig.v1` and survives a
reload, so a session on a phone can be picked up later. **RESET ALL** goes
back to the shipping values. Nothing here can write to the repo, and
nothing here can touch a game save.

## Why it starts from the source

`tables.json` is generated at build time by parsing `DOME` and
`HELM_GLASS` straight out of `draw.ts`, and the suit names and flags out
of `catalog.ts`. The parse throws rather than emitting a partial table —
a bench calibrated against numbers the game does not use would be worse
than no bench. It has already caught itself once: `HELM_GLASS` writes some
keys quoted and some bare, and the first version silently dropped Comet.

## What it does not do

- It does not touch per-suit tail pivots, trims or crops.
- It does not fix art. A helmet that is the wrong shape stays the wrong
  shape; this only decides where it sits and how big it is.
- Catsuit is excluded from the matrix — it wears its own head and the game
  never paints a dome on it.
