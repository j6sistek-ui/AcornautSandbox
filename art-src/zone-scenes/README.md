# Star Map zone painting masters

Three original panoramas made with the built-in image-generation tool for the
approved first Star Map sample. Each master is an RGB PNG at **2172 × 724**.
`illustrated-src/export-sandbox.mjs` copies these original files to
`docs/art/zone-scenes/`; embedded provenance metadata is retained.

The visual references were the game's existing Spill panorama/Depot, zone
skies and planet artwork. Direction: illustrated Acornaut space, painted
material texture, acorn-gold highlights, restrained bloom, readable play lanes
and quiet areas behind UI. No text, UI, logos, ships or new gameplay objects
are painted into these backgrounds.

| File | Palette and composition | Portrait crop |
|---|---|---:|
| `deep-space.png` | Deep indigo/navy, pale moon rims and soft nebula ribbons; open central darkness and depth at the edges | 25% |
| `rust-belt.png` | Worn copper/oxide, warm amber dust, distant wreck fragments and broken orbital forms; keep the central flight lane quiet | 76% |
| `blackout-zone.png` | Slate/navy/charcoal with restrained blue-violet haze, distant dark stone silhouettes and pale moon rims; steady low light | 30% |

Generation prompt briefs for reproducing the direction:

- **Deep Space:** A wide premium painted space-game environment in Acornaut's
  illustrated style, harmonized with the Spill's painted panoramic background.
  Deep indigo/navy space, softly lit cratered moons near the edges, layered
  nebula ribbons, small distant dust, a quiet open flying area. Painted detail
  and atmospheric depth, subtle warm highlights, no graphic overlays or text.
- **Rust Belt:** A wide painted space salvage environment in the same style
  and finish. Oxidized copper, rust, amber and brown; distant curved wrecks,
  broken orbital structures and drifting fragments framing the image. Keep
  the middle calm and uncluttered, with readable silhouettes and dark depth.
  No ship, characters, interface, labels or new interactive objects.
- **Blackout Zone:** A wide painted deep-space environment with constant low
  light. Slate blue, charcoal, muted violet; faint luminous haze, pale moon
  edges and distant dark monolithic silhouettes at the margins. Preserve
  visibility and soft detail with a quiet open lane. No flashes, strobe,
  high-contrast lightning, text, interface or characters.

These are direction briefs; generation is not a deterministic asset build.
Use the committed masters for exact reproduction. Additional stars are drawn
procedurally by the game and map, preserving their existing motion rules.
The same zone family controls the map's planet/debris choices.

The sample's Rust Runner hull and Rust Wake plume are canvas treatments of
the existing modular Spill ship. They introduce no new ship sprite, module,
particle behavior, collision geometry or companion mechanic. Rivet is a
labeled Tinbot-art placeholder in the sample UI.
