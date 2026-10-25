# rig3d — 3D squirrels to game sprite banks

Turns a rigged Tripo model into the game's sprite banks, the same way for every model:
one auto-rig, one set of moves, one camera, one light rig. A new suit made in Tripo is
one command away from a full tap, rise and dive bank with no frame-to-frame drift,
because every frame is the same model in a different pose.

```
cd tools/rig3d && npm install
node render.mjs path/to/model.glb --id pinky --out ../../rig3d-out/pinky
```

| Output | What it is |
|---|---|
| `<id>-tap-1..16.png` | the tap bank, 256 px, the game's size |
| `<id>-asc-1..8.png` | the rise bank: level to a gentle climb |
| `<id>-desc-1..8.png` | the dive bank: level to the dive, tail straight out at frame 8 |
| `hd/…` | the same frames at `--size` (512 default), like `docs/art/suits/hd/` |
| `sheets/<move>.png` | every bank frame of a move on one numbered sheet |
| `preview/<move>.mp4` | each move spread over `--seconds` (2 s), to watch at speed or step through |
| `<id>-rig.glb` | the auto-rigged model with each move as a 2 s clip (Blender: File → Import → glTF, then scrub the timeline) |
| `rig.json` | what the auto-rig found: head, ears, spine, legs, tail, cut faces |

## The model it expects

A Tripo model rigged with Tripo's quadruped auto-rig (Tripo Studio → Rig → export GLB).
Tripo's bone *names* are not trusted: on the first model its "Head" chain was the tail.
`autorig.js` classifies the skeleton by geometry instead:

- **head**: the bone carrying the face (most direct children); its two highest children are the ears/antennae
- **spine**: the bones between the root and the head
- **legs**: the four chains hanging off the spine that reach lowest; front pair = nearer the head
- **tail**: the heaviest remaining chain, plus any leftover chain behind the hips
- **axes**: forward from the tail's mass to the head; lateral = forward × up; every move turns about lateral

If a model fools the classifier, `loadRig(url, { map: { head: '<bone name>' } })` pins the head.

## What the auto-rig fixes in the tail

A Tripo tail gets about five bones down a curl that can turn a full circle, so the curl moves
as a lump. The auto-rig replaces them with a **12-bone chain** down the middle of the real
curl and re-weights the tail to it:

1. distance along the surface from the tail's root, walking only between neighbouring bands
   of Tripo's own weights, so a curl tip sculpted touching the root cannot shortcut
2. joints at the centroid of each slice, each vertex placed by projection onto that chain
3. loose pieces (sprinkles, spikes) ride rigidly on the nearest part of the tail
4. faces where the sculpt fused the curl onto itself are cut, so it can unroll
5. away from the true root every vertex is wholly tail or wholly body, so no skin film
   stretches between tail and back when the tail swings

## The moves (`moves.js`)

Degrees about the lateral axis: + is nose up, limb forward, tail back. Frame 1 of every bank
is the same `LEVEL` pose, so the game can cut between banks.

- **tap** (16, loops): Robo's tail. From the upright plume it sweeps down to straight out
  behind and back up, twice per loop, each joint a beat behind the last (a whip); the body
  bobs once and the legs paddle with it.
- **asc** (8): nose up 22°, paws reach, hind legs trail, the tail eases back and low.
- **desc** (8): nose down 48°, paws forward, the tail travels back until it lies straight
  out behind at frame 8 (`TAIL_STRAIGHT`), the outer third straightening its last hook.

To dial a move in: edit its numbers in `moves.js`, re-run, and watch `preview/<move>.mp4`
or scrub the clip in Blender before anything reaches the app.

## Known limits

- The look is a 3D render, not the painted style of the hand-made suits.
- Banks are not yet wired into the game: helmet registration and the per-frame tables in
  `draw.ts` still need entries for a new id.
- Tuned on one model so far; the classifier and tail rebuild are general, the numbers in
  `moves.js` may need a nudge for very different proportions.
