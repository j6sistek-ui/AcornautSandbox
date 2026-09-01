# Feature parity — illustrated rewrite

Where the illustrated build stands against the original canvas game
(`index.html` v1.1.0 and `beta/index.html`).

Current build: **v1.2.0-illust**, art **v51**.

The list below stopped being a catch-up list some time ago. Most of what is
here now has no counterpart in the canvas game at all, so it is split into
what was matched and what was added.

## Matched

| Area | Notes |
|---|---|
| Normal / Deep Space / Lost in Space | Yes |
| Planet bounce + bounce-cancel swipe | Yes |
| Debris is lethal; shields absorb | Yes |
| Gold invuln, slow, shield pickups | Yes |
| Black hole / wormhole + 5 warp variants | Render-only tilt / mirror |
| Deep Space chained warps | First shift at 10s, then gates spawn |
| Lost in Space tilt + drift + mirror | Planets spawn; tilt is visual |
| Environments + overdrive after gate 100 | Yes |
| XP, titles, flight log | Yes |
| First-flight tutorial | Simplified staging, not the full computed-gate choreography |
| Social profile, news, coming-soon connect | Yes |
| Start shield consumed only if the run armed it | Yes |
| Trail particle kinds | Yes |

## Added since — no counterpart in the canvas game

| | |
|---|---|
| **Painted art throughout** | 17 suits, 20 helmets, 12 pals, 12 trails, painted skies and planets |
| **Hinged tails** | Every suit's plume is its own layer, spring-driven on tap and dive |
| **Arcade** | A fourth mode: the original game in its own hand, double power-ups, its own soundtrack |
| **Shop tab** | Bundles / suits / helmets / pals, replacing Help in the tab bar |
| **Help is a "?"** | Top of screen, freeing the tab slot; the acorn counter moved beside the profile badge |
| **Flight mods** | 3 of them — Steady Gates, Rough Air, Thrill Seeker. Gated to LV 30 and off in the tutorial |
| **Intro film** | Plays after TAP TO START; the home backdrop is its last frame |
| **9 premium items** | Cat suit plus 8 helmets, behind `IAP_ITEMS` |
| **Suit reveals** | Robo, Alien, Ghost, Big Booty unlock through the level track |
| **Installable** | Manifest and maskable icons |
| **The Star Chart** | 100-level campaign in ten stages: portal finish lines, three stars a level, star-total progression replacing the XP ladder. Replaces the Flight Log tab. See `ROADMAP.md` |
| **Wormhole Run** *(experiment)* | Tap-only tunnel endurance: authored pattern director, Flow multiplier, five palette regions, deterministic seeds. Hidden at the bottom of Help beside the other experiments |
| **The Spill** | A seventh mode, graduated from the lab: wave survival in a debris field with a forward lunge, a graze meter that pays for PULSE, a three-pip hull, Ore that lives and dies inside the run, and a Depot every fifth wave. Twenty authored waves, then endless. See `illustrated-src/SPILL.md` |

## Still thinner, or deliberately different

- **The hangar shows painted sprites, not the procedural astronaut.** That is
  the design now, not a shortfall — the procedural renderer is still there
  and still drives Arcade.
- **Shop is HTML cards**, not the canvas roster cache.
- **No offline service worker, on purpose.** The page unregisters any it
  finds: a stale cache on a build that moves this fast costs more than
  offline play is worth.
- **Flap is a small frame bank plus a squash**, not a full sprite spin.
- **Phoenix has no hinged tail** — its flame cape merges with the plume at
  every threshold, so it draws as one piece.

## Known art faults

Tracked in `illustrated-src/OPEN_ISSUES.md`, which is the live list. The
open one worth knowing here: **Seraph's wing rides with its tail**, because
plume and wing meet with no neck between them for a geometric cut to find.
It needs new art.
