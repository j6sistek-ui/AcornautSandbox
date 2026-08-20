# Acornaut Sandbox

Illustrated rewrite of [Acornaut](https://github.com/j6sistek-ui/acornaut).
The live game stays in the `acornaut` repo. All illustrated hangar / mode
work lives **here**.

## PLAY HERE

https://j6sistek-ui.github.io/AcornautSandbox/

That is the playable GitHub Pages build. Do **not** open this repo's file
tree as a play link — GitHub will show source code.

## What's in this repo

| | |
|---|---|
| `docs/` | GitHub Pages root. **This is what ships.** Built output plus `art/`. |
| `sandbox_assets/` | Byte-identical copy of the same build, kept in step by `export-sandbox.mjs`. |
| `illustrated-src/` | TypeScript engine and the art pipeline. The only place to edit. |
| `art-src/` | Masters — renders and footage at the size they arrived. Never served. |
| `docs/lab/` | Prototypes, served but not part of the game. See below. |
| `certification/` | Contact sheets from art passes, for reference. |
| `beta/`, root `index.html` | Original canvas copies. Reference only, not built. |

**Nothing under `docs/js*` or `sandbox_assets/js*` is hand-written** — both
are generated. Edit `illustrated-src/` and rebuild.

## Building

```bash
node illustrated-src/export-sandbox.mjs   # the game -> docs/ and sandbox_assets/
node illustrated-src/build-lab.mjs        # the lab  -> docs/lab/{spill,rig}/
node illustrated-src/build-roadmap.mjs    # the campaign -> ROADMAP.md
```

`ART_VER` in `illustrated-src/game/catalog.ts` is the cache-buster: it names
the current stamped output folder (for example, `js53/`) and is appended to
every art URL. **Bump it whenever art changes**, or players keep old sprites.
Older stamped folders may remain for immutable branch previews; the active
`js/` mirror and page loader must always point at the current version.

The illustrated build deliberately runs with **no service worker** — the
page unregisters any it finds. A stale cache on a build that changes this
often costs more than offline play is worth here.

## The lab

Prototypes on their own pages. The game imports none of it; the only way in
is two hidden buttons at the bottom of Help, both marked delete-when-frozen.

- **`docs/lab/spill/`** — THE SPILL, a debris-field survival mode.
- **`docs/lab/rig/`** — the rig editor, a fitting bench for heads and helmets.
- **`docs/lab/visual-audit/`** — all suit/helmet combinations and collision
  art on split light/dark plates.

Design notes for both: `illustrated-src/lab/README.md`.

## Art

- `illustrated-src/ART_SPEC.md` — how to render a new suit or helmet so it
  fits everything else, and the measuring rules that keep it that way.
- `illustrated-src/OPEN_ISSUES.md` — what is known broken, what was fixed and
  why, and the check that catches each class of fault.
- `PARITY.md` — what is matched against the original canvas game.
- `ROADMAP.md` — the Star Chart campaign: all 100 levels, generated from
  `campaign.ts` so it cannot drift.
