# The Star Chart — campaign roadmap

*Generated from `illustrated-src/game/campaign.ts` by `build-roadmap.mjs`.
Do not edit by hand — change the campaign and rebuild.*

One hundred levels in ten stages. Every level is an ordinary run wearing a
finish line: pass its gate count and a golden portal spawns in clear sky —
fly into it and the level is complete. Three stars per level:

- **★1** reach the portal (the finish itself)
- **★2** a collection goal — acorns or golden acorns
- **★3** a discipline goal — no bounces, no shields, a tap budget

Stars are independent and **kept across runs**: a level can be starred one
goal at a time. **Total stars** open stages and buy the reward ladder —
progression is earned by doing, not by mileage. Endless mode is untouched;
flight mods are disabled inside levels so a star certifies the same flight
for everyone.

**300 stars total.**

## The reward ladder

| ★ | Reward |
|---:|---|
| 3 | **Bee** — Your first wingmate. |
| 6 | **Start Shield** — Arm any run with a shield from the hangar. |
| 10 | **Acorn Buddy** — Pulls nearby acorns to you. |
| 12 | **Stage 2 — NURSERY BLOOM** — The nebula opens. |
| 12 | **Deep Space Flight** — Endless mode: space shifts every 10s. |
| 16 | **Void Jelly** — Softens planet bounces. |
| 21 | **Comet Sprite** — Freeze pickups last twice as long. |
| 27 | **Stage 3 — ICE MOON** — The narrows open. |
| 27 | **Shield Battery** — Carry three shield charges at once. |
| 33 | **Meteor Core** — A tougher travelling companion. |
| 40 | **Lost in Space** — Endless mode: the sky rotates, drifts and mirrors. |
| 45 | **Stage 4 — SOLAR FURNACE** — The heat opens. |
| 45 | **Pocket Moon** — A small steady light. |
| 52 | **UFO** — A burst of slow-time out of every warp. |
| 60 | **Robo Suit** — Full chrome, scanning visor. Now in the shop. |
| 66 | **Stage 5 — MIDNIGHT RUN** — The dark opens. |
| 66 | **Star Pup** — Golden acorns burn twice as long. |
| 75 | **Tin Bot** — Flies without shields, pays double. |
| 84 | **Wisp** — The gates sway to its song. |
| 90 | **Stage 6 — CRYSTAL BELT** — Deep-space levels open. |
| 90 | **Nutsack** — Every acorn counts double. No shields. |
| 100 | **Alien Suit** — The visitor look, antennae included. |
| 117 | **Stage 7 — CRIMSON STORM** — The turbulence opens. |
| 130 | **Ghost Suit** — Spectral tail, cyan-burning eyes. |
| 147 | **Stage 8 — LOST REACHES** — Lost-in-space levels open. |
| 160 | **Big Booty Suit** — Maximum silhouette. Real jiggle. |
| 180 | **Stage 9 — THE BLACKOUT** — Lights out. |
| 180 | **Flight Mods** — Steady Gates, Rough Air and Thrill Seeker unlock in the hangar. |
| 216 | **Stage 10 — EVENT HORIZON** — The last ten. |
| 250 | **GATECRASHER** — A title for the pilots who earn it. |
| 300 | **STARLORD** — Every star in the chart. |

## The stages

### Stage 1 — FLIGHT SCHOOL  *(opens at 0★)*

*Learn the sky before it learns you.* · Sky: **DEEP SPACE**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 1 | **First Solo** | Normal | 8 | GENTLE PACE | Collect 3 acorns | Catch a golden acorn |
| 2 | **Trim the Line** | Normal | 9 | GENTLE PACE | Collect 4 acorns | At most 27 taps |
| 3 | **Clean Approach** | Normal | 10 | GENTLE PACE | Collect 5 acorns | Touch no planet |
| 4 | **Fuel Run** | Normal | 11 | GENTLE PACE | Collect 6 acorns | Catch a golden acorn |
| 5 | **Golden Hourglass** | Normal | 12 | GENTLE PACE | Collect 7 acorns | At most 36 taps |
| 6 | **Steady Hands** | Normal | 13 | GENTLE PACE | Collect 8 acorns | Touch no planet |
| 7 | **Long Glide** | Normal | 14 | GENTLE PACE | Collect 9 acorns | Catch a golden acorn |
| 8 | **Feather Throttle** | Normal | 15 | — | Collect 10 acorns | At most 45 taps |
| 9 | **No Scratches** | Normal | 16 | — | Collect 11 acorns | Touch no planet |
| 10 | **Graduation** | Normal | 17 | — | Collect 12 acorns | Catch a golden acorn |

### Stage 2 — NURSERY BLOOM  *(opens at 12★)*

*The nebula is beautiful and it moves.* · Sky: **NEBULA NURSERY**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 11 | **Bloomfield** | Normal | 12 | SWAYING GATES | Collect 4 acorns | Touch no planet |
| 12 | **Pollen Drift** | Normal | 13 | SWAYING GATES | Collect 4 acorns | Catch a golden acorn |
| 13 | **Cradle Rock** | Normal | 14 | SWAYING GATES | Collect 5 acorns | Spend no shield |
| 14 | **Petal Gap** | Normal | 15 | SWAYING GATES | Collect 5 acorns | Touch no planet |
| 15 | **Slow Waltz** | Normal | 16 | SWAYING GATES | Collect 6 acorns | Catch a golden acorn |
| 16 | **Rooted Deep** | Normal | 17 | SWAYING GATES | Collect 6 acorns | Spend no shield |
| 17 | **Wide Sway** | Normal | 18 | HEAVY SWAY | Collect 7 acorns | Touch no planet |
| 18 | **Nursery Rhyme** | Normal | 19 | HEAVY SWAY | Collect 7 acorns | Catch 2 golden acorns |
| 19 | **Full Bloom** | Normal | 20 | HEAVY SWAY | Collect 8 acorns | Spend no shield |
| 20 | **Seedfall** | Normal | 21 | HEAVY SWAY | Collect 8 acorns | Touch no planet |

### Stage 3 — ICE MOON  *(opens at 27★)*

*Everything narrow, everything bright.* · Sky: **ICE MOON**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 21 | **Thin Ice** | Normal | 14 | SWAYING GATES | Collect 6 acorns | Touch no planet |
| 22 | **Frostbite** | Normal | 15 | SWAYING GATES | Catch 2 golden acorns | At most 39 taps |
| 23 | **Narrows** | Normal | 16 | SWAYING GATES | Collect 7 acorns | Flawless — no bounces, no shields spent |
| 24 | **Crevasse** | Normal | 17 | SWAYING GATES | Catch 2 golden acorns | Touch no planet |
| 25 | **Glacier Line** | Normal | 18 | NARROW GATES, SWAYING GATES | Collect 8 acorns | At most 47 taps |
| 26 | **White Static** | Normal | 19 | NARROW GATES, SWAYING GATES | Catch 2 golden acorns | Flawless — no bounces, no shields spent |
| 27 | **Cold Snap** | Normal | 20 | NARROW GATES, SWAYING GATES | Collect 9 acorns | Touch no planet |
| 28 | **Icicle Alley** | Normal | 21 | NARROW GATES, SWAYING GATES | Catch 2 golden acorns | At most 55 taps |
| 29 | **Pressure Ridge** | Normal | 22 | NARROW GATES, SWAYING GATES | Collect 10 acorns | Flawless — no bounces, no shields spent |
| 30 | **Moonfall** | Normal | 23 | NARROW GATES, SWAYING GATES | Catch 2 golden acorns | Touch no planet |

### Stage 4 — SOLAR FURNACE  *(opens at 45★)*

*The sky burns and the clock runs hot.* · Sky: **SOLAR FURNACE**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 31 | **Kindling** | Normal | 15 | BRISK | Collect 7 acorns | Catch 2 golden acorns |
| 32 | **Slow Roast** | Normal | 16 | BRISK | Collect 7 acorns | Touch no planet |
| 33 | **Heat Shimmer** | Normal | 17 | BRISK | Collect 8 acorns | Spend no shield |
| 34 | **Flare Stack** | Normal | 18 | BRISK | Collect 8 acorns | Catch 2 golden acorns |
| 35 | **Coronal Run** | Normal | 19 | BRISK | Collect 9 acorns | Touch no planet |
| 36 | **Afterburner** | Normal | 20 | FAST FORWARD | Collect 9 acorns | Spend no shield |
| 37 | **Melting Point** | Normal | 21 | FAST FORWARD | Collect 10 acorns | Catch 2 golden acorns |
| 38 | **Solar Wind** | Normal | 22 | FAST FORWARD | Collect 10 acorns | Touch no planet |
| 39 | **White Heat** | Normal | 23 | FAST FORWARD | Collect 11 acorns | Spend no shield |
| 40 | **Out of the Fire** | Normal | 24 | FAST FORWARD | Collect 11 acorns | Catch 2 golden acorns |

### Stage 5 — MIDNIGHT RUN  *(opens at 66★)*

*The dark closes in. Fly by the little you see.* · Sky: **SAPPHIRE ABYSS**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 41 | **Dusk** | Normal | 15 | FOG | Collect 6 acorns | Spend no shield |
| 42 | **Lantern Out** | Normal | 16 | FOG | Collect 6 acorns | Touch no planet |
| 43 | **Narrowed Eyes** | Normal | 17 | FOG | Collect 7 acorns | At most 41 taps |
| 44 | **Deep Water** | Normal | 18 | FOG | Collect 7 acorns | Spend no shield |
| 45 | **Night Current** | Normal | 19 | FOG | Collect 8 acorns | Touch no planet |
| 46 | **Closing Iris** | Normal | 20 | FOG | Collect 8 acorns | At most 48 taps |
| 47 | **Blue Hour** | Normal | 21 | FOG | Collect 9 acorns | Spend no shield |
| 48 | **Half Blind** | Normal | 22 | FOG | Collect 9 acorns | Touch no planet |
| 49 | **Abyssal** | Normal | 23 | HEAVY FOG | Collect 10 acorns | At most 55 taps |
| 50 | **Midnight Proper** | Normal | 24 | HEAVY FOG | Collect 10 acorns | Spend no shield |

### Stage 6 — CRYSTAL BELT  *(opens at 90★)*

*Deep space rules: the sky itself keeps shifting.* · Sky: **CRYSTAL BELT**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 51 | **Facet One** | Deep Space | 12 | — | Collect 5 acorns | Touch no planet |
| 52 | **Refraction** | Deep Space | 13 | — | Collect 5 acorns | Catch 2 golden acorns |
| 53 | **Prism Break** | Deep Space | 14 | — | Collect 6 acorns | Flawless — no bounces, no shields spent |
| 54 | **Lattice** | Deep Space | 15 | — | Collect 6 acorns | Touch no planet |
| 55 | **Inclusion** | Deep Space | 16 | — | Collect 7 acorns | Catch 2 golden acorns |
| 56 | **Cleave Line** | Deep Space | 17 | — | Collect 7 acorns | Flawless — no bounces, no shields spent |
| 57 | **Scatter** | Deep Space | 18 | — | Collect 8 acorns | Touch no planet |
| 58 | **Fracture Zone** | Deep Space | 19 | — | Collect 8 acorns | Catch 2 golden acorns |
| 59 | **Core Sample** | Deep Space | 20 | — | Collect 9 acorns | Flawless — no bounces, no shields spent |
| 60 | **The Jewel** | Deep Space | 21 | — | Collect 9 acorns | Touch no planet |

### Stage 7 — CRIMSON STORM  *(opens at 117★)*

*Turbulence. The gates will not sit still.* · Sky: **CRIMSON STORM**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 61 | **Front Coming In** | Normal | 16 | BRISK, HEAVY SWAY | Collect 8 acorns | Spend no shield |
| 62 | **Squall** | Normal | 17 | BRISK, HEAVY SWAY | Collect 8 acorns | Flawless — no bounces, no shields spent |
| 63 | **Red Ceiling** | Normal | 18 | BRISK, HEAVY SWAY | Collect 9 acorns | Touch no planet |
| 64 | **Gale Gates** | Normal | 19 | BRISK, HEAVY SWAY | Collect 9 acorns | Spend no shield |
| 65 | **Eye Wall** | Normal | 20 | BRISK, HEAVY SWAY | Collect 10 acorns | Flawless — no bounces, no shields spent |
| 66 | **Downdraft** | Normal | 21 | BRISK, HEAVY SWAY | Collect 10 acorns | Touch no planet |
| 67 | **Shear** | Normal | 22 | BRISK, HEAVY SWAY | Collect 11 acorns | Spend no shield |
| 68 | **Thunderhead** | Normal | 23 | BRISK, HEAVY SWAY | Collect 11 acorns | Flawless — no bounces, no shields spent |
| 69 | **Landfall** | Normal | 24 | BRISK, HEAVY SWAY | Collect 12 acorns | Touch no planet |
| 70 | **Stormbreaker** | Normal | 25 | BRISK, HEAVY SWAY | Collect 12 acorns | Spend no shield |

### Stage 8 — LOST REACHES  *(opens at 147★)*

*Lost-in-space rules: tilt, drift, mirror.* · Sky: **VIOLET REALM**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 71 | **Which Way Up** | Lost in Space | 12 | — | Collect 5 acorns | Touch no planet |
| 72 | **Slantwise** | Lost in Space | 13 | — | Collect 5 acorns | Catch 2 golden acorns |
| 73 | **Mirror Left** | Lost in Space | 14 | — | Collect 6 acorns | Spend no shield |
| 74 | **Vertigo** | Lost in Space | 15 | — | Collect 6 acorns | Touch no planet |
| 75 | **Compass Spin** | Lost in Space | 16 | — | Collect 7 acorns | Catch 2 golden acorns |
| 76 | **Wrong Horizon** | Lost in Space | 17 | — | Collect 7 acorns | Spend no shield |
| 77 | **Tumbled** | Lost in Space | 18 | — | Collect 8 acorns | Touch no planet |
| 78 | **Sideways Rain** | Lost in Space | 19 | — | Collect 8 acorns | Catch 2 golden acorns |
| 79 | **The Long Way** | Lost in Space | 20 | — | Collect 9 acorns | Spend no shield |
| 80 | **Found** | Lost in Space | 21 | — | Collect 9 acorns | Touch no planet |

### Stage 9 — THE BLACKOUT  *(opens at 180★)*

*You see for half a second after each tap. Remember the rest.* · Sky: **MONOCHROME VOID**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 81 | **Lights Out** | Normal | 8 | BLACKOUT — lit only after a tap, GENTLE PACE | Collect 3 acorns | Touch no planet |
| 82 | **Afterimage** | Normal | 9 | BLACKOUT — lit only after a tap, GENTLE PACE | Collect 3 acorns | At most 29 taps |
| 83 | **Count the Beats** | Normal | 10 | BLACKOUT — lit only after a tap, GENTLE PACE | Collect 4 acorns | Flawless — no bounces, no shields spent |
| 84 | **Flashbulb** | Normal | 11 | BLACKOUT — lit only after a tap, GENTLE PACE | Collect 4 acorns | Touch no planet |
| 85 | **Dead Reckoning** | Normal | 12 | BLACKOUT — lit only after a tap, GENTLE PACE | Collect 5 acorns | At most 38 taps |
| 86 | **Echo Location** | Normal | 13 | BLACKOUT — lit only after a tap, GENTLE PACE, SWAYING GATES | Collect 5 acorns | Flawless — no bounces, no shields spent |
| 87 | **Blink** | Normal | 14 | BLACKOUT — lit only after a tap, GENTLE PACE, SWAYING GATES | Collect 6 acorns | Touch no planet |
| 88 | **Photograph** | Normal | 15 | BLACKOUT — lit only after a tap, GENTLE PACE, SWAYING GATES | Collect 6 acorns | At most 48 taps |
| 89 | **Total Recall** | Normal | 16 | BLACKOUT — lit only after a tap, GENTLE PACE, SWAYING GATES | Collect 7 acorns | Flawless — no bounces, no shields spent |
| 90 | **Eyes Shut** | Normal | 17 | BLACKOUT — lit only after a tap, GENTLE PACE, SWAYING GATES | Collect 7 acorns | Touch no planet |

### Stage 10 — EVENT HORIZON  *(opens at 216★)*

*Everything the sky has learned, at once.* · Sky: **HYPERVIVID**

| # | Level | Base | Gates | Modifiers | ★2 | ★3 |
|---|---|---|---:|---|---|---|
| 91 | **Old Timeline** | Arcade | 18 | — | Collect 8 acorns | Flawless — no bounces, no shields spent |
| 92 | **8-Bit Heart** | Arcade | 20 | — | Collect 9 acorns | Spend no shield |
| 93 | **Museum Piece** | Arcade | 22 | — | Collect 10 acorns | Touch no planet |
| 94 | **Shifting Ground** | Deep Space | 23 | FOG | Collect 11 acorns | Flawless — no bounces, no shields spent |
| 95 | **Half Light** | Deep Space | 24 | FOG | Collect 12 acorns | Spend no shield |
| 96 | **Triple Shift** | Deep Space | 25 | FOG | Collect 13 acorns | Touch no planet |
| 97 | **Tilted Crown** | Lost in Space | 28 | HEAVY SWAY | Collect 14 acorns | Flawless — no bounces, no shields spent |
| 98 | **Mirrorfall** | Lost in Space | 29 | HEAVY SWAY | Collect 15 acorns | Spend no shield |
| 99 | **Last Reach** | Lost in Space | 30 | HEAVY SWAY | Collect 16 acorns | Touch no planet |
| 100 | **THE HORIZON** | Normal | 30 | BLACKOUT — lit only after a tap, FOG, BRISK, HEAVY SWAY | Collect 17 acorns | Flawless — no bounces, no shields spent |

## Design notes

- **The portal is an arrival, not an obstacle.** Once the last gate is
  passed the field stops spawning and the portal stands alone in clear sky.
- **Collection goals are never hostage to dice.** Levels with an acorn goal
  guarantee one acorn per gate (`fx.acornEvery`), so "collect N" is always
  achievable with room to miss a few.
- **THE BLACKOUT (stage 9)** is the strobe idea: the world is lit for the
  half-second after each tap, then fades to black. Taps are sight — which is
  why its tap-budget goals are generous rather than tight.
- **Fog (stage 5)** closes a sight circle around the pilot; **turbulence
  (stage 7)** exposes the drift dials; **stages 6, 8 and the finale** borrow
  the deep-space, lost-in-space and arcade machinery whole.
- **Difficulty ramps three ways at once**, deliberately gently: gate counts
  rise within each stage, modifiers sharpen across stages, and the star
  goals tighten. A pilot who only ever takes ★1 can still walk the whole
  chart; the last stages' unlock totals demand roughly two stars a level.
- **Refinement path**: the Spill (lab) is the obvious stage 11 once it is
  promoted — its survive-T-seconds shape drops straight into the goal
  system. New modifiers (mirror-only, tiny-pilot, heavy-gravity) are one
  line each in `LevelFx`.
