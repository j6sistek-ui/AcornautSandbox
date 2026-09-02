# Frame fixes: the motion banks, frame by frame

Owner's brief (2 Sep 2026): "seraph animation frozen... again. gemmie is
twitching sizes bad. ghost still has a flash frame that inverts itself and
looks glitchy. cryostar still has a fat frame." Video moments given: ghost at
7.77s, verdant 19.34s, gemmie 32.79s, sammie 34.41s ("sammie's big one").

This is the per-character audit behind that brief, with the exact file for
each bad frame so the redraws can be scoped without guessing. Every number
below was measured off the shipped PNGs (`docs/art/suits/<suit>-<ramp>-<n>.png`,
296x296, transparent) by `illustrated-src/verify-art.py` and the frame
metrics pass: bounding box of the opaque pixels, opaque pixel count ("mass"),
and similarity to the neighbouring frame.

How the banks are used, so the fixes land where the game looks:

- `asc-1` is the LEVEL frame. It is on screen whenever the pilot is neither
  climbing nor diving, which in play is most of the time. `asc-2..8` grade
  a climb, `desc-1..7/8` grade a dive, each ramp read in order by speed.
- Consecutive frames should differ by a small step of attitude and nothing
  else: same character size, same mass, same tail volume. A frame whose
  size or mass jumps against both neighbours is a "twitch" (it pops in and
  out); a frame whose pose is unrelated to both neighbours is a "flash".
- Since this PR the loadout case rolls through the whole bank both ways,
  climb to dive and back, so every one of these frames can be checked in
  the case without flying.

## Fix list (ordered by how visible it is)

| # | File | Measured | What's wrong | Redraw target |
|---|------|----------|--------------|---------------|
| 1 | `sammie-asc-1.png` | 223x178, mass 24.5k vs bank median 15.9k (+53%) | The level frame is half again the size of every other frame. Video 34.41s. Shows most of the time in play. | Same character size and mass as `sammie-asc-2` (204x145, 16.1k), level attitude. |
| 2 | `cryostar-asc-1.png` | 223x187, mass 25.5k vs 19.3k (+32%) | "cryostar still has a fat frame": the level frame again, after desc-1 was dropped. | Match `cryostar-asc-2` (218x171, 20.9k), level attitude. |
| 3 | `verdant-desc-1.png` | 208x186, mass 23.0k vs 15.9k (+44%) | First dive frame is far heavier than the ramp it starts. Video 19.34s. | Match `verdant-desc-2` (203x201, 18.6k) in mass; attitude between level and desc-2. |
| 4 | `verdant-asc-1.png` | 223x183, mass 25.7k vs 20.9k (+27%) | Level frame oversized. | Match `verdant-asc-2` (220x169, 20.9k). |
| 5 | `gemmie-asc-1.png` | 223x177, mass 24.1k vs 18.9k (+26%) | Level frame oversized; the level→dive step then drops to a 167px-wide frame, which is the size twitch. Video 32.79s. | Match `gemmie-asc-2` (219x173, 21.7k). |
| 6 | `gemmie-desc-2.png` | 181x202 between 167x179 and 162x188 | A taller, wider frame in the middle of the dive ramp: pops each time the ramp passes. | Same box as `gemmie-desc-1`/`desc-3` (about 165x185). |
| 7 | `ghost-desc-4.png` (and 5, 6) | 208x210 after `desc-3` 219x170; skew 0.16 → 0.03 in one step | The dive ramp jumps from a horizontal glide to a head-tucked vertical pose with nothing between. Video 7.77s: the "inverting flash". `desc-4..6` are all the tucked pose. | Redraw `desc-4` as a half step between `desc-3` and the current `desc-5`; let `desc-5..7` carry the tuck progressively. |
| 8 | `ghost-desc-8.png` | 222x157 after `desc-7` 211x210; similarity to neighbour 0.61 (lowest in the bank) | The deepest dive frame flattens back out, so the bottom of the dive kicks. | Continue the tuck of `desc-7`, deeper, not flatter. |
| 9 | `seraph-asc-1..3.png`, `seraph-desc-1..6.png` | `asc-1` and `desc-1` are pixel-identical (210x115, 13,456 px); `asc-2/3` and `desc-2..6` differ from them by under 3% | Nine of sixteen frames are the same glide. "Seraph frozen": in play, gentle attitudes never leave this glide, and the wings only open at `asc-4`. | Grade the attitude across the whole ramp: `asc-2/3` should already be lifting toward the `asc-4` wing pose; `desc-2..6` should progress toward the `desc-7` tuck. |
| 10 | `alien2-desc-4.png` | 217x165, mass 20.1k vs 14.7k (+36%); similarity to neighbours 0.51 | A different drawing (heavier, streaked tail) dropped into the ramp. | Match `desc-3`/`desc-5` size and tail treatment. |
| 11 | `alien2-desc-1.png` / `desc-2.png` | 183x164 then 227x141 | The ramp opens with a 12% narrower frame and then a 10% wider one. | Even the widths to about 208 (the `desc-3` box). |
| 12 | `sammie-desc-4.png` | 191x180, mass 16.3k vs 12.4k (+31%) | Heavy frame mid-ramp. | Match `desc-3`/`desc-5` (about 170x175, 13k). |
| 13 | `sammie-desc-*` vs `sammie-asc-*` | dive ramp median 12.4k mass, climb ramp 15.9k | The whole dive ramp is drawn ~20% smaller than the climb ramp, so the level→dive step shrinks the character. | Scale the dive ramp up to the climb ramp's mass. |
| 14 | `cryostar-desc-5.png` | 209x191 between 175x191 and 178x195 | One wide frame mid-ramp. | Match its neighbours' box. |
| 15 | `cryostar-desc-1.png` | 190x169, similarity to `desc-2` 0.67 | Pose step from level to first dive frame is too big after the original desc-1 was dropped. | A half step between `cryostar-asc-1` (fixed) and `desc-2`. |
| 16 | `iontrim-desc-2.png`, `voidsuit-desc-2.png` | flagged by `verify_bank_frame_spread` | Second dive frame drawn larger than the ramp. | Match `desc-1`/`desc-3`. |
| 17 | `seraph-desc-8.png` | 183x172 after 189x166 | Minor: the last dive frame is a small step back in width. | Optional. |

Frames dropped earlier in this branch and no longer loaded: the original
`cryostar/verdant/gemmie/sammie-desc-1.png` (oversized). The banks are 7
dive frames for those four suits; `DESC_BANKS` in `illustrated-src/game/art.ts`
is where the counts live if a redrawn frame brings one back.

## Helmets on the banks

The helmet is a separate layer: the dome is placed per frame from the
`DOME` table in `illustrated-src/game/draw.ts` (`"<suit>-asc-N": [x, y, r]`
or `[x, y, r, rot]`, measured in the 296px frame). Every bank suit has a full
set of anchors except the three that wear their own painted head (cyber,
alien, alien2), so a helmet that floats on a frame is an ANCHOR to
re-measure, not art to redraw, unless the head itself moved in the redraw.

- Any frame redrawn from the list above needs its anchor re-measured
  afterwards: open `docs/lab/rig/`, pick the suit, FRAMES, and drag the dome
  onto the head; LOCK it; export the table.
- Off-family helmet scale (a helmet from one family on another suit) is
  calibrated in `OFF_FAMILY_HELMET_SCALES` in `verify-art.py`; if a helmet
  reads too big or small on a whole suit rather than one frame, that is the
  number to change.

## How to check a fix

1. Drop the PNG in `docs/art/suits/`, same name, 296x296, transparent.
2. `python3 illustrated-src/verify-art.py` runs `verify_bank_frame_spread`:
   it lists any frame more than 12% off its bank in box size, 18% in width,
   or 35% in mass. The frame should fall off the list.
3. Open the loadout case with the suit worn: the case now sweeps the whole
   bank both ways in 3.6s, so a pop or a flash is visible without flying.
