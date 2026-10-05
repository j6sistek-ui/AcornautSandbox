# The Lab

Prototypes. Nothing here is imported by the game and nothing here is in the
main build; the only threads back are the doors on the beta Test Lab sheet
(the flask on the Home rail), each a link to a separate page rather than a
dependency. A
lab experiment can be kept, reworked or deleted without touching a build
that is close to shipping — that isolation is the point, and it is why
`build-lab.mjs` is separate from `export-sandbox.mjs`.

```bash
node illustrated-src/build-lab.mjs   # -> docs/lab/rig/js and docs/lab/skytest/js
```

---

# THE SPILL — graduated

The debris-field survival prototype that used to live here has been
promoted to a real mode: `illustrated-src/game/spill.ts`, reached from the
Modes sheet like every other way to fly. The lab page, its packer and its
Help door are gone with it. What carried over, what changed, and the tuning
history that used to sit in this file are all in `illustrated-src/SPILL.md`.

---

# THE RIG EDITOR

A fitting bench. It draws heads and helmets exactly the way the game does
and lets you move them by thumb or by number, then hands the changed rows
back as text to paste into the two tables.

```bash
node illustrated-src/build-lab.mjs     # -> docs/lab/rig/js + tables.json
```

Home → **flask** (Test Lab, beta only) → **RIG EDITOR**. Delete-when-frozen,
like every lab door. Rebuilt 1 Oct 2026 (owner: "clean up the rig editor,
it's so massively messy it's hard to use"): one screen, one job.

## What it edits

Two tables, and only two:

- **DOME** (`draw.ts`) — where each suit's head is and how big, in that
  suit's own 256px canvas: one row for the still and one for every
  animation frame.
- **HELMET_SEATS** (`helmet-fit.ts`) — where each helmet's head cavity is
  and how big, in the helmet's own canvas.

The game scales the cavity onto the head. So the switch at the top is the
only decision: **HEAD · <suit>** edits where this suit's head is (every
helmet follows), **CAVITY · <helmet>** edits where this helmet's cavity is
(every suit that wears it follows). The ring on the big canvas is cyan for
a head edit and pink for a cavity edit, so the colour says what a drag
will move before you drag.

## Why head edits reach every frame by default

The shipping DOME rows for the nineteen animated suits were built from
three family templates, not per-suit measurements, so a suit that sits
wrong sits wrong by the same amount on all of its frames and under every
helmet. **ALL FRAMES** applies one nudge to the still and every bank frame
of the suit at once, which is the fix for that; **THIS FRAME** is the fine
pass afterwards. Both are deltas: a drag, a pad press, a wheel tick and a
typed number all do the same thing to the same rows.

## The screen

- **Suit** and **helmet** pickers. A helmet the suit cannot wear is not
  offered (the game snaps those to Clear). Own-head suits show their art
  with no helmet to seat.
- **FRAMES / SUITS / HELMETS** cycles the strip: every played frame of
  this suit under one helmet; this helmet on every suit; every helmet on
  this one frame (the spot check for an outlier helmet on a freshly fitted
  head). Tap a thumbnail to put it on the big canvas. An amber dot marks
  a thumbnail whose number differs from shipping.
- **Only the frames the game plays are listed.** draw.ts ranks a suit's
  banks - bounce, then a climb/dive ramp, then a loop, then a sixteen-frame
  tap bank - so Flight shows its 3/5 ramp and not the tap bank it also
  carries, and a tap frame on the skip list is not shown either. The table
  generator reads the registries and the ranking out of the source.
- **The big canvas is pinned** above the strip; only the strip scrolls,
  so the preview never leaves the screen and a swipe over the strip can
  only scroll it. **◀ ▶** on the canvas (and `,` `.`) step along whatever
  the strip shows. Drag to move, pinch or wheel to size. **RINGS** shows
  the head circle and, once you have moved it, a dashed amber ring where
  it shipped. **FADE** draws the helmet at 40% so the face shows.
- **D-pad** one table unit per press (hold to repeat), **SIZE** 2% a step,
  **TILT** 1° a step, and the four numbers typed directly.
- **UNDO** one step per gesture, thirty deep. **RESET** puts back the
  shipping number under the switch (the suit's frames in reach, or the
  helmet). **RESET ALL** lives in the COPY sheet behind two taps.
- **COPY** opens the changes: paste-ready rows for the two tables, JSON
  with was/now, or a download. Unchanged rows are not printed.
- Keys: arrows (shift for 5), `+` `-` size, `[` `]` tilt, `z` undo,
  `,` `.` previous/next thumbnail, `h` `c` head/cavity, `a` reach,
  `r` rings, `f` fade.

## It draws what the Loadout draws

`tables.json` is parsed out of `draw.ts`, `helmet-fit.ts`, `catalog.ts`
and `art.ts` at build time, so the bench can never open on numbers the
game does not use. That includes the presentation box: nine suits (the
regenerated standard series, `NATURAL_FLIGHT_SUITS`) are drawn by the game
in one fixed 192px box rather than their alpha box, and the bench now
honours it - before 1 Oct 2026 it measured those nine like the rest and
seated their helmets somewhere the Loadout does not.

Drafts live in `localStorage` under `acornaut.rig.v2`, tagged with the
art build they were dialled against. **A draft is never thrown away**: the
old editor set aside any draft from another build, and that is how a whole
session came out of COPY as "nothing changed yet" on 1 Oct 2026 (the
stamp moved from 296 to 297 under the page). Now a draft from another
build is worn, the toast says which build it came from, and the COPY
sheet repeats it on its first line. The old editor's draft is picked up
once on first load; its THIS PAIR overrides come out as comments. Nothing
here can write to the repo or touch a game save.

Every control carries `touch-action: manipulation`, which is what stops
iOS zooming the page on a double-tap of + or −.

## What it does not do

- No per-pair overrides, locks or folding any more: a pairing that looks
  wrong is either the suit's head or the helmet's cavity, and the two
  views exist to tell which.
- It does not touch per-suit tail pivots, trims or crops.
- It does not fix art. A helmet that is the wrong shape stays the wrong
  shape; this only decides where it sits and how big it is.
