# High Orbit cut rigs

Owner request, 9 September 2026: remaster and cut every High Orbit suit,
use articulated construction like AcorNut with original motion between
AcorNut and Arcflash, give each its own exclusive built-in wake, and keep
head sizes standardized. This supersedes the five historical 8/8 banks.

## Exact scope

| Suit | Material retained | Exclusive effect |
| --- | --- | --- |
| Cinderforge | Charcoal armor, crimson trim, lava seams | Molten Mantle: turbulent heat filaments and cinders |
| Groveguard | Green leaf armor, aged brass tree fittings | Verdant Slipstream: curling stems, leaves and pollen |
| Cosmic | Violet nebula plating and star highlights | Astral Veil: layered gas clouds, ion threads and stars |
| Sunforged | Bronze/gold armor with solar inlays | Solar Corona: prominence loops and expanding corona arcs |
| Abyssal | Navy/cyan scales and luminous fittings | Abyssal Current: fluid filaments and clear highlighted bubbles |

Original portraits are in `references/`. Each `*-PROMPT.md` records the
generation prompt and any matte-only follow-up. Each `*-parts-master.png`
is the retained 1086×1448 generation. The eleven pieces are head, torso,
two upper arms, two forearms, two thighs, two shins and one tail.

## Extraction and registration

`illustrated-src/export-high-orbit.mjs` mechanically removes the magenta
production background, isolates connected pieces and packs them into eleven
256px cells of a 1024×768 RGBA atlas. The twelfth cell is empty. Matte
decontamination is limited to the silhouette fringe; a further fur-only pass
removes magenta contamination without desaturating Cosmic's pink plating.

`registration.json` retains source bounds, measured attachment points,
packing scales and the head circle. The head circle includes the complete
silhouette and ears, not just the face. All five heads use the same fixed
36px radius at a 192px display reference. Fitting by the moving alpha bounds
is deliberately avoided. Existing helmet glass is fitted to this actual
moving head transform through the same helper as the rest of the game.

Every frame uses these same painted parts. Limb lengths and part scale
are constant; panels, fasteners, fur markings and colors are never repainted,
blended between alternative heads, mirrored or resized per pose. Remastering
changes the source painting once; the resulting design is then fixed.

The tail is one painted surface, with bone-aligned strips receiving delayed
lateral displacement. Each strip retains longitudinal position and width, so
triangle signed area stays constant through the motion and cannot fold.
The tail root is registered at the pelvis, with its ink clear of the skull.

## Motion and effects

`high-orbit-motion.ts` is a separate presentation controller. It observes
accepted vertical velocity, keeps a continuous paddling phase, and adds a
bounded accent after a large upward velocity change. A tap does not reset
the phase or a joint. The chest settles more firmly than the tail; forearms
recover with a small delay. Five bounded profiles vary timing and inertia.
It imports neither AcorNut nor Arcflash motion.

The controller is stepped by normal flight and Hyper Run's respective clocks.
Pause, tutorial holds, shield freezes, warp transitions and stuck states hold
the visual state. No new force, collision rule, reward, save schema or
simulation RNG is introduced.

`high-orbit-effects.ts` retains boot positions in world coordinates for
0.65 seconds. It renders five different material geometries from that private
wake. These do not enter the shop particle emitter. The catalog maps each
wake to one suit only; unlock follows the suit, it is not sold separately,
and equipping it leaves the player's selected shop trail intact.

The active loader requests one atlas per suit, validates its dimensions and
allows retry on failure. A 256px portrait rendered from the same rig is the
loading fallback. Historical ascent/descent images remain in the repository
but are no longer loaded for these five.

## Reproduce

Use the repository container workflow in `AGENTS.md`. When Docker is
unavailable, use the documented existing workspace Node/Python fallback:

1. `node illustrated-src/export-high-orbit.mjs`
2. `node illustrated-src/export-sandbox.mjs`
3. `node illustrated-src/review-high-orbit.mjs --write-stills`
4. `node illustrated-src/build-lab.mjs`
5. `node illustrated-src/test-high-orbit.mjs` and
   `node illustrated-src/test-high-orbit-integration.mjs`
6. Run the full shipping gates in `SHIPPING.md`.

`--write-stills` writes only the five fallback portraits and their shipping
hash receipt. It does not regenerate paintings. Re-run the build after any
source or registration change.

## Review evidence

The interactive review is `docs/lab/high-orbit/index.html`, built from
`illustrated-src/lab/high-orbit.html`. It uses the shipping painter and
controller, offers normal/slow playback, held flight attitudes, helmets and
wake toggles, and exports a browser-rendered snapshot.

`illustrated-src/design/high-orbit/` contains the pose, helmet and effect
contacts, browser-rendered comparison, numerical regression receipt and
validation report. The art was inspected in those contacts and in Chrome
at 390px width. Visual approval of the remastered style remains the owner's
decision; numerical checks do not substitute for that review.
