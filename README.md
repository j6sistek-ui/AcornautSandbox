# Acornaut Sandbox

Private workshop for the **illustrated rewrite** of [Acornaut](https://github.com/j6sistek-ui/acornaut).

The live painted build is here:

**[sandbox_assets/index.html](sandbox_assets/index.html)**

Same physics and feature set as v1.1.0 / beta (modes, hangar, pals, XP road, warps, tutorial), redrawn with sprite art.

## Play

Open `sandbox_assets/index.html` from any static server (GitHub Pages, `npx serve`, etc.).  
Art lives in `sandbox_assets/art/`. Game modules live in `sandbox_assets/js/`.

The **original canvas game** remains at the repo root (`index.html`) and `beta/`.

## What's in this pass

- Illustrated squirrel, planets, debris, acorns, shields, pals
- Debris **kills**; planets **bounce**; swipe **cancels** a bounce
- Five warp variants, Deep Space chains, Lost in Space tilt/drift
- All 12 helmets, 12 suits (premium overlays), 12 trails, 12 pals
- Hangar, flight log, social (news + records), help, first-flight tutorial
- Start shield + battery mods, XP / titles, pause

## Source

TypeScript engine used by the Grok Build preview:

- `illustrated-src/game/` — sim, draw, catalog, save, audio, engine
- `illustrated-src/Acornaut.tsx` — React overlay UI

Regenerate the standalone from that source:

```
node scripts/export-sandbox.mjs
```

## License

[CC BY-NC 4.0](LICENSE) — same as the live game.
