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
