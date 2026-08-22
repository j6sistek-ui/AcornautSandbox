# Owner-supplied suit re-renders (2026-08-22)

`big_oo/` and `robot/` are the owner's uploaded frame sets for the Big
Booty and Robo suits (25 and 36 frames, sliced sheets). Shipped as:

- `suits/bigbooty.png`, `suits/robo.png`: frame 0 registered onto the
  OLD static's alpha footprint, so the glide rig reference box and the
  hangar scale are unchanged. The retired statics are kept here as
  `*-old.png`.
- `suits/{id}-tap-1..16.png`: 16-frame full-character tap banks, evenly
  sampled (Big Booty skips frames 4-6 — the fake-helmet gag the owner
  excluded), one shared crop/scale per set so the frames stay mutually
  registered.

The old `-tail`/`-body` rig cuts still paint the glide pose; re-cutting
them from the new renders is a follow-up if the mixed identity shows.
