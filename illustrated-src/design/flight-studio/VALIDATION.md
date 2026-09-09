# Flight Studio validation

9 September 2026. Based on main `4d55b82ae3f99adb2481f506530a51ada646d214`,
including High Orbit PR #248 and tap-bank repair PR #250. Local art stamp 251.
The tool's manifest pins all painter sources and model artwork.

## Scope and build

- 31 catalog models, seven cut rigs, 443 model-art references. All were decoded
  and rendered by the standalone painter, including original helmet placement.
- Generated UI and twelve game dependency modules are committed under
  `tools/flight-studio`. Running requires only existing Node 18+ and a browser;
  no package install or external connection. The loopback host serves local
  tool files and suits/helmets only, rejects non-read methods and traversal,
  and uses a same-origin content policy. A second launch reuses the tool.
- Studio build and syntax checks pass. The standard game export, lab build
  and TypeScript check pass. No lint script is defined; `git diff --check` passes.
- The source game, shipping `docs` and original art are unchanged by this PR.
  Build-time stamps and test-generated receipts were restored after verification.

## Animation and presets

The focused test covers all 31 models, matching JSON export/import replay,
30/60/144 Hz observer cadence, repeat loops and pause. Different upward
velocities select identical tap frames. It checks complete frame traversal,
1.5-second playback, weighted holds, out-and-back return, descent gating,
repeated-tap restart/continue/queue and tap-triggered companion clips.

Independent rig edits change the intended part without changing the head or
the flight physics. Five-point tap and full-velocity curves, body offsets,
rise/fall sensitivity and local settling feed fixed painted parts. Unsupported
versions, missing frames, nonfinite/out-of-range values and invalid event
timing are rejected. Artwork/source changes produce import notices.

`model-review.png` is a contact sheet from the actual standalone renderer,
using each local model at the same flight instant. It is not a UI screenshot.
`browser-preview.png` is a PNG inspection export from the running browser.

## Browser checks

Chrome: editor and linked viewer load the local library. Verified shared pause
at 5.85 seconds, live tail-offset edits while paused, undo, model switching,
frame holds/reordering, changing a cycle to 1.5 seconds, export/reset/restore
through the JSON panel (restored tail offset exactly 18), and reset to defaults.
Reload retained per-model work. The viewer continued with the editor in a
background tab and received changes without reloading.

Desktop editor and viewer inspected; both layouts also inspected at 390×844.
Temporary viewport overrides were removed. No browser console errors in the
final editor check. The pop-out button created a separate viewer window;
the automation screenshot interface stalled on that popup, so visual layout
checks used ordinary browser tabs. The normal launcher opens two browser app
windows on Windows, with a default-browser fallback on other platforms.

The file chooser automation timed out before file selection. Preset download,
JSON validation/replay tests and the browser's pasted-JSON restore were verified;
the native file-selection step is not claimed as browser-verified.

## Full regression comparison

**44 passed, five failed, zero skipped, of 49**. A separate unchanged checkout
of the same main ran **43 passed, five failed, zero skipped, of 48**. The one
added test is Flight Studio. Both checkouts have the same five existing failures:

| Test | Existing failure on both checkouts |
| --- | --- |
| `test-arcflash-render.mjs` | Arcflash fallback/rig pixel equality |
| `test-hyper-run.mjs` | Keyboard repeat after orientation pause |
| `test-platform-bridge.mjs` | Scanner treats existing comment text as storage use |
| `test-spill-render.mjs` | Windows C: path imported as an ESM URL |
| `test-spill-ui.mjs` | Same Windows module-URL failure |

All 32 shipping art groups pass. The Docker daemon was unavailable; checks
used existing workspace dependencies and bundled Python under the repository's
documented fallback. The stock runner additionally exposes its existing
happy-dom Windows-path issue. The complete 49/48 test lists were run using
file-URL dependency overrides, without exclusions; no host packages installed.
The studio-focused test was repeated after final preset/launcher/UI refinements.

This is a tuning tool. Arbitrary user-edited extremes are not visually approved
game poses. Export does not modify gameplay, game saves or repository files;
promoting an approved preset into the game remains a separate reviewed change.
