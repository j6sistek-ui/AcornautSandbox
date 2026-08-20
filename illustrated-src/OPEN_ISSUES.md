# Open issues

Things known to be unfinished, so they are not rediscovered as bugs.

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

## Ghost is the last suit still wearing a painted helmet

The other eleven originals were re-rendered bare-headed and are wired in.
Ghost's replacement cannot be cut: it is painted within 12 of the cream
paper, out of 765, so parts of it are literally indistinguishable from the
background and the cut tears a gash through its tail. That is an input
problem, not a code one — the information is not in the file.

It needs a render on a **black** plate, or with transparency. Until then it
keeps its old art and is flagged `bakedDome: true` in `catalog.ts`, which
is what makes the Clear helmet skip it. Delete that flag the moment a bare
render lands, and re-measure with `measure-art.py suit`.

Renders that arrive with transparency need no keying at all — `key-render.py`
detects that and passes them straight through to a 256px sprite.

## The suit swap has not had its full pass

The eleven new renders are keyed, measured, rigged and on screen, and the
hangar reads clean. What has NOT been done: the 17 x 21 helmet-on-suit
matrix, and a look at each new tail actually swinging in a run. Both were
deferred so the rest could ship. Run them once the Ghost art lands, since
that pass has to be redone anyway.

`docs/art/suits/phoenix.png` is orphaned — Phoenix is a HELMET, and there
is no Phoenix suit in `SUITS`. The file is unreferenced.

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

## Still open

- Three suits (bigbooty 306px, sammie 208px, robo 31px) keep a small
  disconnected piece in the body layer — a hind foot the tail's silhouette
  cut across. It is genuinely body, it stays put correctly, and at the size
  the pilot is actually drawn it is under two pixels. Left alone.
- Phoenix has no rig: its flame cape merges with the tail at every
  threshold, so `cut` cannot separate them. It draws as one piece.
- Ghost still wears a painted helmet and needs a bare-headed render.

## Seraph's wing rides with the tail (open — needs new art)

Seraph's plume and its wing meet with no neck between them, so a geometric
cut cannot separate them: there is no narrow crossing to find. The colour
guard now keeps the wings on the BODY, which is the right side for them,
but it leaves a scatter of small fragments along the wing edge where the
guard's boundary runs through feathers.

Shipping as-is by decision. The real fix is a re-render with the wing and
the tail clearly apart, or a parts-separated Seraph. Anything cleverer in
`neck-cut.py` would be over-fitting one suit.

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

## neck-cut.py is NOT idempotent

It seeds itself from the existing split and the existing `TAIL_PIVOT`. Once
the pivots are written back to `draw.ts`, a re-run measures from the new
hinge and can land somewhere else — Seraph moved from [105,138] to [82,80]
that way, on identical art. Always re-cut from the ORIGINAL art and pass
`--hints` at the `draw.ts` those pivots came from.
