# rig3d prep

Small fixes to a model before `render.mjs` sees it, for rigs Tripo gave the wrong bones.

- `addtail.py in.glb out.glb CUT NB` - a tail skinned to the pelvis (a humanoid rig) gets a real
  NB-bone chain: the pelvis-weighted vertices behind x < CUT, banded by surface distance from the rump.
- `addwings.py in.glb out.glb` - the wings on the back bone (Spine01, above the shoulders) get a
  hinge bone each, `L_Wing` and `R_Wing`, for `--drive L_Wing,R_Wing --flap`.

Seraph (27 Oct 2026):

    python3 addtail.py seraph3d.glb seraph-tail.glb -0.06 5
    python3 addwings.py seraph-tail.glb seraph-rig.glb
    node ../render.mjs seraph-rig.glb --id seraph --head Head --tail Tail_0 \
      --drive L_Wing,R_Wing --flap 90 --tailamp 0.15 --tailrest 175 --bob 8 --frames tap:12,desc:4,asc:0
