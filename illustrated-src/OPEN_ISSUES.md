# Open issues

What is known unfinished, so it is not rediscovered as a bug — and what was
fixed, with the check that would have caught it sooner. The second half is
longer than the first on purpose: every entry there is a fault that survived
a passing test, and the test is the part worth keeping.

---

# STILL OPEN

## Small things, left alone deliberately

- Phoenix has no rig: its flame cape merges with the tail at every
  threshold, so no cut separates them. It draws as one piece.
- `docs/art/suits/phoenix.png` is orphaned — Phoenix is a HELMET and there
  is no Phoenix suit in `SUITS`. The file is unreferenced.
- Big Booty keeps a few-pixel dark speck near the rump at negative swing
  angles. It is in the SOURCE art (5 enclosed gaps, same count as the
  original render), so it is left alone rather than inventing paint.

The disconnected body pieces noted here previously (bigbooty 306px, sammie
208px, robo 31px) are gone: they were an artefact of the old reseat cut, and
the neck cut leaves none.

## Seraph's wing rides with the tail (open — needs new art)

Seraph's plume and its wing meet with no neck between them, so a geometric
cut cannot separate them: there is no narrow crossing to find. The colour
guard now keeps the wings on the BODY, which is the right side for them,
but it leaves a scatter of small fragments along the wing edge where the
guard's boundary runs through feathers.

Shipping as-is by decision. The real fix is a re-render with the wing and
the tail clearly apart, or a parts-separated Seraph. Anything cleverer in
`neck-cut.py` would be over-fitting one suit.

## The helmet-on-suit matrix has still not been run

Every render is keyed, measured, rigged and on screen, and the hangar reads
clean. What has NOT been done is the full **16 x 20** matrix — the sixteen
helmet-wearing suits against all twenty helmets — nor the eight
flight-animation frames against the same twenty.

The rig editor (`docs/lab/rig/`) is built for exactly this and shows all of
it at once; it is a job of looking, not of tooling.

Tails HAVE now been checked through the full swing range offline, at 0, ±25
and ±43 degrees. What has not happened is watching one in a real run.

`docs/art/suits/phoenix.png` is orphaned — Phoenix is a HELMET, and there
is no Phoenix suit in `SUITS`. The file is unreferenced.

## Video encoding for the native builds

The launch film currently ships the way the web wants it: `intro.webm`
(VP9) and `intro.mp4` (H.264/AVC, Main profile, 720x1270, ~1.7 MB), picked
by the browser from a `<source>` list. That is the right answer for a page
and the wrong answer for a store build.

When this is packaged, each target wants something different:

- **iOS / App Store** — H.264 or HEVC in MP4. The current MP4 already
  qualifies; it should be re-encoded to the device's native resolution
  rather than 720 wide, and `hvc1` HEVC would roughly halve it.
- **Android / Google Play** — VP9 in WebM or H.264 in MP4 both play. AV1
  is supported from Android 10 and is the smallest, but decoding is soft on
  older hardware.
- **Steam** — whatever the wrapper uses. An Electron/CEF wrapper is
  Chromium, so it needs H.264 to be compiled in (many builds are not) or a
  WebM. A native engine wrapper usually wants the raw frames or a Theora /
  VP9 file.

The master is the original upload, `IMG_7042.mov` — 1088x1920, H.264 High,
23.97 fps, 5.9 s, with a quiet ambient audio track. It was removed from the
working tree once the web encodes were made; it is still in git history at
commit `747f65e` and should be the source for every future encode, never
one of the derived files.

The web encode is muted on purpose. The clip's own audio is real but quiet
(RMS 0.028), the menu music plays over it, and muted autoplay is the only
kind every mobile browser starts without asking. A native build has no such
restriction and could carry the audio.


---

# CAUTIONS

## neck-cut.py is NOT idempotent

It seeds itself from the existing split and the existing `TAIL_PIVOT`. Once
the pivots are written back to `draw.ts`, a re-run measures from the new
hinge and can land somewhere else — Seraph moved from [105,138] to [82,80]
that way, on identical art. Always re-cut from the ORIGINAL art and pass
`--hints` at the `draw.ts` those pivots came from.


---

# FIXED — and the check that catches it

## Ghost (fixed v51) — the one input problem no code fixes

Ghost was the last suit still wearing a painted helmet, and its first
bare-headed render could not be cut: it is painted within 12 of the cream
paper, out of 765, so parts of it were literally indistinguishable from the
background and the cut tore a gash through its tail. Not a code problem —
the information was not in the file.

Re-rendered on a **black plate**, which is what that needed, and keys
cleanly. `bakedDome` is off it and its `DOME` is re-measured to
`[195, 96, 50]` — within a pixel of flight's, the same pose in the same
framing, which is the check that matters.

**The rule that came out of it: a pale character needs a black plate, or
transparency.** It is now in `ART_SPEC.md` under what to render.

That `DOME` value is a calibrated estimate rather than a hand fit. The
measure was validated against eleven suits whose numbers are known: it is
systematically off by a constant (+15, +4, +23) with a residual spread of
±4, ±5, ±2.8 px. Good enough to ship, worth finishing in the rig editor.

## The tail fringe (fixed v51) — and why the first fix did not take

Reported: "every single tail bounce has a small fragment of the tip of the
tail not following the tail." Reported fixed once. It was not.

`repair()` moved body blobs **disconnected** from the body. The real defect
is connected: the cut left the tail's whole fur outline — its dark rim and
antialiased skirt — attached at the hip and tracing the plume all the way
round. `audit()` asked the same disconnected-blob question, so it printed
"clean" over eleven broken suits and I believed it.

Measured properly — of the tail beyond 45px of the hinge, what share is the
body still drawing — the shipping art read:

| | |
|---|---|
| bigbooty | 31.0% |
| frost, stardust | 23.9% |
| ember | 23.2% |
| copper | 23.0% |
| voidsuit | 22.1% |
| alien | 21.8% |
| aurorasuit | 20.8% |
| robo | 20.5% |
| iontrim | 18.2% |
| flight | 7.4% |
| everything else | under 1.7% |

At `TAIL.maxA = 0.75` rad — 43°, which a single tap reaches — that is a
second tail hanging in the air.

**Lesson worth keeping:** the audit and the fix shared an assumption, so the
audit could never catch the fix being wrong. An audit must measure the
symptom the player sees, not the mechanism the fix happens to use.

`reseat` measures the symptom. All 17 now read 0.00%, and the resting
composite still reproduces the whole-suit render to within 0.04/255 of mean
alpha.

## Sammie's rig was the wrong art (fixed v51)

`sammie.png` was re-rendered bare-headed; `sammie-tail.png` and
`sammie-body.png` were never re-cut, so in flight she wore a painted-on
dome under the real helmet. Caught by the new audit's lossless check —
tail+body missed 2564px of the whole-suit render, scattered over 53 blobs,
which is the signature of two different paintings rather than a bad cut.

Re-cut with `transfer`. Her hinge moved with the pose: `TAIL_PIVOT.sammie`
is now [128, 166], not [98, 178]. At the old pivot the plume visibly
unhooked from her body at full swing.

## Big Booty (fixed, twice)

The straight seam clipped a wedge of the purple suit and a sliver of the
hind leg into the tail, and they swung away with the plume. The seam colour
guard hands them back: near the hinge, anything that is not the plume's own
colour belongs to the body. Two traps on the way — the tail's five-pixel lip
quietly re-copied the wedge into the tail, and the body's fringe sweep then
deleted the paint the guard had handed back (297 px on Big Booty, 421 on
Seraph). Both are named in the source.

And a third, which is the one that actually shipped a visible defect: the
colour reference is sampled from the plume's BRIGHT outer fur, so deep
shadow inside the plume failed the test and 261 px were punched out of the
middle of the tail. A hole in a swinging tail is about the most visible
thing this rig can produce. Two rules now stop it: anything enclosed by
plume is plume (fill holes, but only where the source has paint, so the
artwork's own transparent gaps survive), and the same fill runs again after
the lip, because subtracting the rejected paint can enclose a gap all over
again. Robo and Gemmie were quietly carrying 30 px and 14 px of the same
fault.

The check that catches this class: count enclosed gaps in the tail layer and
compare against the count in the WHOLE-SUIT render. Anything above the
source's own number is self-inflicted. All seventeen now sit at zero.
