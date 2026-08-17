# Feature parity — illustrated rewrite

Checked against live `index.html` (v1.1.0) and `beta/index.html`.

## In

| Area | Status |
|---|---|
| Fly / Deep Space / Lost in Space | Yes |
| Helmets, suits, trails, pals, mods | Yes |
| Pal powers (magnet, low grav, 2x nuts, no holes, …) | Yes |
| Planet bounce + bounce-cancel swipe | Yes |
| Debris is lethal; shields absorb | Yes |
| Gold invuln, slow, shield pickups | Yes |
| Black hole / wormhole + 5 warp variants | Yes |
| Deep Space chained warps | Yes |
| Lost in Space tilt + drift + mirror | Yes |
| Environments + overdrive after gate 100 | Yes |
| XP, titles, flight log | Yes |
| First-flight tutorial (beta) | Yes (simplified staging) |
| Social profile, news, coming-soon connect | Yes |
| Start shield consumed only if the run armed it | Yes |
| Trail particle kinds | Yes |

## Still thinner than the original canvas renderer

- Premium suits are sprite + overlay (not full procedural body/tail)
- Shop is HTML cards, not the canvas roster cache
- Tutorial bounce is staged, not the full computed-gate choreography
- No offline service worker on the illustrated build yet
