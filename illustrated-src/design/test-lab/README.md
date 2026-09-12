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

- **FLIGHT TEST** - starts the self-flying run (below).
- **Switches, saved on this device** - the worn suit's dials, the same
  builders the pause sheet uses: tap accent, repeat tap, tap shape, tail
  spring (or a note when the suit's tail is painted into its frames), pitch.
- **Flight Lab** - the free-flight sliders (fog, sway, gates, rebound,
  upside down, slow time, free revive).
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
`5-dials.jpg` the worn suit's dials folded out inside the run.

Gates on this change: typecheck, export, `run-tests --skip-heavy` (57 of
58; the one failure is the pre-existing 22-byte Cinderforge fallback
mismatch on Linux, identical on unchanged main), `verify-art.py` (32 QA
groups), platform bridge, `git diff --check`, plus the two new tests.
