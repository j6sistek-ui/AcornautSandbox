# Hyper Run scout ship provenance

`scout-ship-master.png` is the source master for Hyper Run's beta-only player frame. It was generated with the built-in ImageGen workflow on 2026-08-23. The owner-supplied `ACORNAUT SQUIRREL SCOUT SHIP` image was used only as a broad concept reference for an acorn-derived side-view vehicle; its composition, markings, character, and text were explicitly excluded.

The production request was an original empty orthographic scout craft with a large open cockpit, no baked-in pilot, no text or insignia, a midnight-alloy/brass material language, and a transparent field. The built-in output supplied the painted ship but encoded its neutral preview field as opaque pixels. `build_scout_ship.py` deterministically removes only the bright neutral field connected to the canvas edge, which also opens the U-shaped cockpit from above, then registers one 256 × 256 RGBA runtime asset.

The ship remains empty by design. Runtime draws the player's currently equipped squirrel, suit, and helmet in the cockpit before placing the hull over it. If the ship asset does not load, Hyper Run falls back to the unchanged normal pilot renderer.

Build from the repository root:

```powershell
python art-src/hyper-run/build_scout_ship.py
```

Outputs:

- `docs/art/hyper-run/scout-ship.png`
- `sandbox_assets/art/hyper-run/scout-ship.png` (byte-identical mirror)
- `art-src/hyper-run/scout-ship-contact-sheet.png` (review only; never deployed)

No generated JavaScript, save identifier, legacy identifier, or art version is changed by this asset build.
