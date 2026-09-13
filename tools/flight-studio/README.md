# Flight Studio

A separate offline motion workshop for Acornaut. The editor has a steady close
preview; the second window flies the same model through a repeating tap pattern
over a scrolling sky. No planets, debris, game launch, account or internet.

## Launch

On Windows, double-click **Launch Flight Studio.cmd** at the repository root.
It opens an editor and a flight viewer as separate browser app windows. Resize
or move them to suit your monitors. Keep the small launcher console running;
Ctrl+C stops the local server. Close the two browser windows when finished.

An existing **Node.js 18 or later** and a modern browser are required. The
generated tool is committed: running it does not need npm install, a build,
Docker or a network connection. The local `docs/art` folder must be present.

Other launch options, from the repository root:

```sh
npm run flight-studio
# Or, on macOS/Linux:
sh launch-flight-studio.sh
# Choose another port or open the two URLs yourself:
node tools/flight-studio/launch.mjs --port 8961 --no-open
```

Default URLs: editor `http://127.0.0.1:8960/`, viewer
`http://127.0.0.1:8960/?viewer=1`. The Open flight viewer button opens a separate
window if the browser allows pop-ups. Both windows must use the same browser
profile and port to link. macOS/Linux/default-browser fallback may open tabs;
move the viewer into a separate window or use the button.

## Start tuning

Art 253 includes the repaired Arcflash and High Orbit foot registration,
fuller hind legs and tucked posture. High Orbit's native motion now includes
head nods and stronger tap-driven tail recoil. The Body parts controls tune
on top of that motion. Sunforged and Groveguard's sealed helmets replace the
bare head when selected, so ears do not protrude around the metal shell.
Older presets for these seven rigs still import, with a source-change warning
to prompt a fresh motion review. Their settings are not silently reset.

1. Select a model. All 34 current catalog models are included. Seven use
   articulated cut rigs: AcorNut, Arcflash and the five High Orbit suits.
   Percy, Envoy and Patriot each use Cyber's nine ascent and nine descent
   paintings with the same velocity-driven motion profile.
2. Leave the pattern playing, or pause and scrub to a troublesome moment.
   Changes appear in both windows, including when paused. Step advances 1/60 s;
   playback also offers half and quarter speed.
3. Use **Motion** for whole-model pitch, five-point tap pitch, cycle duration,
   tap progression, retrigger policy and descent entry/settling. Negative
   whole-model pitch points upward.
4. Use **Body parts** for a rig or **Frame banks** for painted animation.
5. Export the preset when satisfied. Import restores the same model, timing,
   curves, tap pattern and view. Save PNG captures a rendered inspection still.

The viewer and editor share a wall-clock transport and deterministic 120 Hz
simulation. Backgrounding a window does not leave it permanently behind.
Changing a motion setting recalculates the same point in the loop, so a paused
comparison updates immediately. Each complete loop restarts the same initial
conditions; the loop boundary intentionally resets position and motion.

Percy, Envoy and Patriot retain their 256px logical frame, registration and
motion at every display size. Enlarged previews request optional 512px source
detail from `docs/art/suits/hd/` when the full frame spans more than 256 physical
canvas pixels. The game and Studio use the same density selection helper.
Normal 52px gameplay does not request this tier at ordinary screen densities.
The still loads one optional image; the game hover rig loads its two layers
together; animation loads and publishes all 18 frames together. A missing or
wrong-sized detail image retains the complete 256px bank and permits a retry
after 30 seconds. These requests never delay normal artwork readiness.

Decoded RGBA detail costs about 1 MiB per image: 18 MiB for an animated suit,
plus at most 3 MiB for its still and hover layers if those surfaces are also
shown. No suit fetches these optional files merely because its normal bank
loaded in the background. The three complete optional tiers total 63 images
and approximately 5.64 MB of PNG data in the current export; actual requests
depend on the enlarged surfaces displayed during that session.

## Cut rigs

The current shipping painters and joint controllers supply the baseline. The
studio never repaints parts, changes bone lengths or resizes heads per pose.
Each part has:

- Rest offset and original-motion amount (1 = original excursion, 0 = replace it).
- Added rise and descent response, with independent settling and tap delay.
- A five-point tap curve from impulse through recovery.
- A five-point velocity curve spanning full rise, half rise, apex, half fall
  and full fall. Use this to shape the transition through the complete arc.

Torso, head, both upper arms/forearms, thighs/shins and three tail controls are
available. AcorNut's middle tail control maps to its authored bend channel;
High Orbit and Arcflash use their middle tail segment. Body float is measured
in source pixels; other local curves use degrees in the painter's joint space.
Whole-model pitch uses the familiar screen direction. Native motion speed
changes the rig's original motion clock without changing the flight path.

High Orbit retains its exact shared 36px head radius at the 192px display
reference. Arcflash and AcorNut retain their existing authored head/helmet.
Guides show High Orbit's measured skull/joints or a frame bank's registration.
Extreme user-authored curves can make anatomy overlap: pause, inspect bare
heads and helmets, and tune accordingly. The tool is an editor, not automatic
approval of every possible pose.

## Painted banks

Cyber, Percy, Envoy and Patriot default to **velocity-driven ascent and
descent**, with rewind on a repeat tap. Their shared profile preserves the
Cyber frame-selection and pitch behavior. Frame order and per-frame pitch
remain editable without changing the underlying flight trajectory.

Other registered tap banks default to **clocked playback after a tap**.
Where the source has only ascent paintings, the studio can play that bank as
a timed tap sequence. It labels that choice explicitly; it does not claim
the current game has been changed to match. The clocked controls include:

- Set a complete cycle to 1.0, 1.5 or any duration from 0.1–5 seconds.
- Tap progression below 1 advances earlier; above 1 builds later.
- Restart, continue, or queue one cycle when a second tap arrives.
- Play straight through, or travel out and back to neutral. Ascent ramps
  default to out-and-back with the turnaround at 62.5% of the cycle, matching
  the tap repair merged in PR #250. Change the turnaround independently.
- Reorder individual frames. Hold weights distribute the cycle's duration;
  a weight of 2 lasts twice as long as a weight of 1 before progression easing.
- Add a pitch offset to each frame without altering its painted pixels.
- Descending velocity, an entry delay, and inertia open the descent bank.
  Optionally finish the tap first. Full-descent velocity and settling control
  how quickly the bank reaches its last frame. At a new tap it returns to the
  tap source. Suits without a descent bank retain their tap/loop art and can
  still use descent pitch.

Companion loop paintings default to a tap-triggered clip and return to the
first frame afterward. A separate continuous-play option is available for
comparison. They also have whole-model tap/velocity pitch controls. Every image is drawn with fixed
canvas registration; the tool does not fit each moving frame to its bounds.

The three replacement pilots each have nine complete 256px ascent paintings
and nine descent paintings. Their current family is the same standard bank
family as Cyber; the older sixteen-frame sheet route is retired. Percy keeps
his Sovereign Shell, Envoy stays helmetless, and Patriot keeps his Facet Shell.
Flight frames remain complete paintings. The game retains separate registered
body/tail layers for its still hover fallback. The shared wake painter uses
the selected frame's measured emitters, and optional display detail preserves
all of these logical coordinates.

## The tap pattern

The default is 13.5 seconds: taps at 0, 1.5, 3.0, then a long fall before taps
at 6.4, 6.9, 7.05, then another gap and taps at 10, 10.5 and 10.65 seconds.
Edit, add or remove events. Gaps let gravity continue. An explicit Dive starts
a quick drop. **Pause freezes the test**, a different operation from waiting.

Tap now / Space records a tap at the current loop time. It takes effect live
and repeats on following loops; Undo removes it. P toggles pause. These keys
are ignored while typing in an input or selecting an option.

Default gravity 300 and lift 300 make long arcs easy to inspect at a 1.5-second
cadence. Use game gravity & lift sets gravity 1300, lift 450, max fall 620 and
quick dive 380. All studio physics are independently tunable. The canonical
flight stage is 900px tall, with position limits at 100 and 800px; velocity
continues at those limits without collision, bounce or death. The display
maps that stage to the available viewer height. No studio physics is applied
to the game.

## Saving and export

Work autosaves separately for each model in this browser, under the tool-only
key `acornaut.flight-studio.v1`. It never reads/writes the production or beta
save. Changing port or browser profile changes the local storage origin; use
Export/Import to move work between them. Undo/redo history is session-only.

Import accepts a JSON file. Alternatively expand **Paste preset JSON**, paste
the text and choose **Restore pasted preset**. Export also puts a copy of the
downloaded JSON in that panel, useful for a quick export/reset/restore check.

An exported JSON includes schema/version, model and rig family, source commit,
painter and asset hashes, all tuning values, frame sequences/holds/pitch, the
complete timed pattern and view. Imports validate finite numeric ranges,
available frames and ordered event times. Changed art/painter hashes produce
an explicit review notice. Invalid imports leave the current session intact.
The obsolete premium cut-rig and sixteen-frame sheet presets have a different
model family and are rejected. This does not change preset compatibility for
the original 31 models.

**Export creates a tuning preset, not a replacement sprite sheet or an
automatic game patch.** See [APPLYING-PRESETS.md](APPLYING-PRESETS.md) for the
runtime contract used when promoting an approved preset into gameplay.

## Development and checks

Edit `illustrated-src/flight-studio/`, then:

```sh
node illustrated-src/build-flight-studio.mjs
node illustrated-src/test-flight-studio.mjs
node illustrated-src/test-cyber-trio-detail.mjs
```

The build uses the repository's existing TypeScript dependency. It emits the
tool UI/runtime, transpiles only the required game painters/controllers, and
extracts model banks/head registrations into a manifest with asset hashes.
It does not build or modify `docs/js*`, artwork or game sources. Rebuild the
tool after relevant art/rig/bank changes, and reload both windows.

The Studio test checks all 34 models, seven cut rigs and the three replacement
Cyber 9/9 banks, including their asset hashes. It verifies deterministic replay
at 30/60/144 Hz, pause/loop behavior, the trio's Cyber controller parity, clocked
tap timing for other banks, descent gates, rapid-tap policies, frame holds,
rig tuning, export/import, malformed presets, local-image rendering and the
read-only loopback host. Every replacement frame is compared pixel for pixel
with its full-canvas painting and shared wake, with effects on and off and no
added helmet or assembled limbs. The separate detail test requires a current
game export too; it checks lazy loading, complete-tier publication, missing and
wrong-sized files, retries, and unchanged logical destinations and controller
state in actual game portraits, previews, live pilots, hover layers and Studio.
`--write-review` also produces the contact sheet in
`illustrated-src/design/flight-studio/`. Use the repository container checks
by default; the documented workspace fallback applies if Docker is unavailable.
