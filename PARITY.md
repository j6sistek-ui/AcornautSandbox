# Feature parity — illustrated rewrite

Checked against live `index.html` (v1.1.0) and `beta/index.html`.

## In

| Area | Status |
|---|---|
| Fly / Deep Space / Lost in Space | Yes |
| Helmets, suits, trails, pals, mods | Yes — live procedural astronaut / pal / trail |
| Pal powers (magnet, low grav, 2x nuts, no holes, …) | Yes |
| Planet bounce + bounce-cancel swipe | Yes |
| Debris is lethal; shields absorb | Yes |
| Gold invuln, slow, shield pickups | Yes |
| Black hole / wormhole + 5 warp variants | Yes (render-only tilt / mirror) |
| Deep Space chained warps | Yes — first shift at 10s, then gates spawn |
| Lost in Space tilt + drift + mirror | Yes — planets spawn; tilt is visual |
| Environments + overdrive after gate 100 | Yes |
| XP, titles, flight log | Yes |
| First-flight tutorial (beta) | Yes (simplified staging) |
| Social profile, news, coming-soon connect | Yes |
| Start shield consumed only if the run armed it | Yes |
| Trail particle kinds | Yes |

## Still thinner than the original canvas renderer

- Hangar uses illustrated squirrel / pal sprites, not the live procedural astronaut

- Shop is HTML cards, not the canvas roster cache
- Tutorial bounce is staged, not the full computed-gate choreography
- No offline service worker on the illustrated build yet
