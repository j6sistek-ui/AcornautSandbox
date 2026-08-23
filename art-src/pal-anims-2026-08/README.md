# Pal idle animations, August 2026

Twelve pals, uploaded as `sprite-max-px-frames-N-...` folders across the
branches `j6sistek-ui-pals`, `-1` and `-2`. The folders arrive unnamed and
duplicate-suffixed, so each was matched to its pal by colour signature and
then confirmed by eye against the shipped still.

  bee 9 · buddy 25 · clockling 36 · cometsprite 4 · meteorcore 25
  nightglider 16 · nutsack 36 · pocketmoon 25 · prismwing 16
  starpup 25 · ufo 16 · voidjelly 36

`tinbot` (36) and `wisp` (25) followed on branch `j6sistek-ui-pal03`, in
its two top-level `sprite-256px-*` folders - that branch also carries a
copy of art-src, so the pal sheets are the two folders at its ROOT and
nothing under art-src/. All fourteen pals now animate.

Cometsprite's four frames are the outlier. Every other pal got nine to
thirty-six; at four the loop is a stutter rather than a cycle, and it is
worth regenerating when the two missing pals are made.

## How they are built

`illustrated-src/build-pal-anim.py <pal> <folder>` fits a bank to the pal's
SHIPPED STILL - one scale and one offset for the whole bank, taken from the
union of every frame. Fitting per-frame is what makes a character pulse;
the union cannot, because it is the same number for all of them. The pal
therefore does not jump the moment the bank starts playing.

Bank lengths live in `PAL_ANIM` in catalog.ts and are the TRUE lengths - a
nine-frame loop is not resampled up to sixteen, because that only
duplicates renders. `PAL_ANIM_FPS` in draw.ts paces every bank at 12 fps.
