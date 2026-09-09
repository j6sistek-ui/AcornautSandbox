# Loadout appearance review

These are actual browser captures from an isolated test profile with synthetic
equipment ownership. Player saves and the installed game were not accessed.
The supplied reference image guides appearance only; every item, caption and
control shown here comes from the existing game.

The baseline includes premium pilot PR252, merged at
`d296e6bc404aaec14221a8b79186132fb4426dea`. The loadout is rebuilt as256.
All updated screenshots below show the final owner-reviewed feedback01
revision. The owner authorized its merge on 9 September 2026.

| Before | Neon galaxy loadout |
| --- | --- |
| ![Original expanded loadout](baseline-mobile390-expanded.png) | ![Open live preview against the galaxy](feedback-01/mobile390-expanded.png) |

| Verdant | Cryostar | Copper |
| --- | --- | --- |
| ![Green galaxy](feedback-01/mobile390-verdant.png) | ![Blue galaxy](feedback-01/mobile390-cryostar.png) | ![Copper galaxy](feedback-01/mobile390-copper.png) |

The newly merged pilots are preserved and work in the updated loadout:

| Porcelain Paragon | Nacre Envoy | Foldspace Origamist |
| --- | --- | --- |
| ![Porcelain in Loadout](feedback-01/mobile390-porcelain.png) | ![Nacre in Loadout](feedback-01/mobile390-nacre.png) | ![Origamist in Loadout](feedback-01/mobile390-origamist.png) |

The equipped suit colors the nebula artwork around the live preview. Cyan
marks selection; violet frames the existing tabs and controls. Owned premium
cards keep gold styling. The old stage border, corner brackets, spotlight,
pedestal and opaque nameplate no longer appear in the loadout.

The lower browsing panel has an opaque dark background, keeping the galaxy
around the upper character. The existing shield action and armed state sit
beside the brighter shelf/grid toggle. The redundant hero EQUIPPED caption
is removed; the selected card retains its existing indicator.

The five existing tabs remain **Suits, Helmets, Trails, Pals and Ship**. The
existing fold gesture/button, equipment details, favorites, shelf/grid
selector, prices, ownership and shop link remain. No bottom tab bar is added.
Compact mode still follows the saved preference. Three columns and larger
portrait canvases give the existing artwork more space without changing it.

| Compact preview | Short phone |
| --- | --- |
| ![Compact loadout](feedback-01/mobile390-compact.png) | ![320 by 568 loadout](feedback-01/mobile320-expanded.png) |

![Landscape loadout](feedback-01/landscape844-expanded.png)

![Desktop loadout](feedback-01/desktop1440-expanded.png)

See [README](README.md) for implementation boundaries and
[browser verification](feedback-01/browser-verification.json) for measured layouts,
existing-control interactions and browser error results.
