# The Test Lab (beta only)

Owner, 12 Sep 2026: "make a permanent beta feature ... on beta only, add a
button on the home screen, opens up a menu, put every test feature in
there, the helmet rig editor, everything that's unique to testing. Then add
you self flying simulator in there. 2/4/6/8 auto flap speed. and then some
dials, to tweak it. that way if something's being tested later a toggle can
be added there or i can use the dials to check it. always there always.
beta only."

## Where it is

Home rail, the flask between the leaderboard and the help gear. Gated on
`IS_BETA && platform.devDoors`, the same pair the old PROTOTYPES doors used,
so a native store build never shows it even on the beta page. The
production page has no flask, no sheet and no way to start a Flight Test
(`test-test-lab.mjs`, `test-test-lab-ui.mjs`).

## What is in the sheet

- **FLIGHT TEST** - starts the self-flying run (below). The worn suit's
  dials (tap accent and its strength, repeat tap, tap shape, tail spring,
  pitch) fold out in its dock; they are not on this sheet (owner, 12 Sep
  2026: "you left toggles for the flight editor on the main screen that
  are also in the testers, clean it up"). The pause sheet of an ordinary
  beta free flight keeps them too, with the Flight Lab sliders, as before.
- **Benches** - every page under `docs/lab/`: rig editor, ship bench,
  background test mode, visual audit, the Flight Lab page, High Orbit and
  Premium Pilots. The last four had no door anywhere before this.
- **Reset all dials to stock** - two taps, because it clears numbers the
  owner may not have baked into the tables yet.
- The dev stamp, so a screenshot says which build it is.

The PROTOTYPES doors left the Modes sheet; Modes is modes only now.

## The Flight Test

A free flight that flies itself. `beginFlightTest` in `sim.ts`:

- an empty sky (the opening pairs go, the spawn cursor is pushed out of
  reach), free revive on, a floor that bounces, and a crash that scoops the
  pilot back instead of ending the run;
- an autopilot stepped on the fixed 1/60 tick that calls the real `flap()`,
  so every painter, dial, accent, trail and sound sees an accepted tap;
- patterns: MANUAL, HOVER (one tap every 2V/g = 692 ms, the cadence real
  play settles into), 2/4/6/8 taps a second, PAIRS (two taps 120 ms apart
  then 0.8-1.1 s), STATION (a tap whenever the pilot is below the centre
  line and falling, at most ten a second - stays on screen at any rate).

The dock at the bottom of the run never pauses it:

- readouts every frame: vy, the frame the painter chose (from the
  `__acornautPose` hook, whole-frame banks only), the tap clock, the tail
  spring angle, measured taps/s over the last two seconds;
- transport: 1x, 1/2x, 1/4x (the world clock, so the cadence slows with
  it), HOLD, STEP one tick;
- the worn suit's dials fold out in place; LOADOUT and TEST LAB leave.

Pattern and speed persist under `save.testLab` (sanitised on load). A hold
is never saved. `resetRun` clears the Flight Test, so no other run can
inherit it.

## The accent strength dial (12 Sep, second PR)

Owner, after a frame-by-frame look at Cyber with the accent on and off:
"build a dial, i can barely notice it." What the frames showed: OFF holds
one frozen climb frame for the 200 ms after a tap; ON moves the body
through the same window, but at 3 px of squash and 3 px of nose-up on a
65 px pilot, inside a 20 px frame swap. And Cyber's ignition was invisible
by accident: the glow is drawn in the suit's glow colour, which on Cyber is
its own violet.

So: `save.tapAccentStrength` (0.25..4, 1 = as first shipped), one
multiplier on the ignition radius, the squash and the nose-up, with a
slider and 1x/2x/3x/4x buttons under the TAP ACCENT switch wherever it
appears (Test Lab sheet, Flight Test dock, pause sheet). The ignition now
burns white at the core with the suit glow as the rim, so it reads on every
suit. Reset-all clears it. `tapAccentStrengthFor` in `save.ts` is the one
reader; a live build never draws the accent.

## Adding a test switch later

A global switch is one more panel appended in `wornSuitDials` or the sheet;
a bench is one more line in `LAB_PAGES` in `standalone.ts`. A new autopilot
pattern is one more entry in `FLIGHT_TEST_PATTERNS` and a case in
`stepFlightTest`.

## Receipts

Chromium 390x844 against the exported beta page (stamp 283), Ion worn,
tap accent on. `1-home.jpg` the flask on the rail; `2-sheet.jpg` the Test
Lab; `3-flight-test.jpg` the run on HOVER; `4-six-per-second.jpg` the
autopilot at 6/s (taps/s reads 6.0, pose and tap clock live);
`5-dials.jpg` the worn suit's dials folded out inside the run;
`6-strength-dial.jpg` the accent strength slider and 1x-4x buttons under
the TAP ACCENT switch; `7-ignition-4x-quarter-speed.jpg` four frames 90 ms
apart on Flight at 4x, quarter speed: the white-cored ignition behind the
boots, then the nose-up squeeze, then the settle.

Gates on this change: typecheck, export, `run-tests --skip-heavy` (57 of
58; the one failure is the pre-existing 22-byte Cinderforge fallback
mismatch on Linux, identical on unchanged main), `verify-art.py` (32 QA
groups), platform bridge, `git diff --check`, plus the two new tests.
