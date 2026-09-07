# Five refreshed flight banks

Copper, Cryostar, Verdant, Sammie and Gemmie were regenerated from their
static loadout paintings at baseline `166b3b8bb2465d09b56d759620408b6672a0689c`.
The `*-reference.png` files are exact copies of those portraits. No previous
flight frame was supplied to ImageGen. The five `*-master.png` sheets and
adjacent prompts are the fresh built-in ImageGen outputs.

Each bank has eight climb and eight dive frames. The first climb painting
also supplies the first dive frame, avoiding a neutral-frame cut. The other
paintings contain articulated limbs and tail movement. Export applies a
uniform transform to each whole painting using skull and pelvis landmarks;
it never cuts a character into parts. The pelvis stays at (122,138), and the
skull radius stays constant within each bank. `landmarks.json` contains the
source measurements, reviewed against eye-template tracking and rendered
helmet overlays. `registration.json` records every resulting transform.

The master backgrounds are removable production mattes, green except for
Verdant's magenta. The first discarded Copper attempt painted a checkerboard
instead of transparency and is not used. `export-flight-refresh.mjs` removes
the mattes and exports 256x256 RGBA. It calibrates warm fur and Verdant's green
material to the unchanged reference, using `flight-reference-colour.mjs`.
These are stable palette baselines, not pose-driven colour effects.

The existing static portraits and split fallback art are unchanged. The
four previously shortened dive banks return to eight frames. Helmet anchors
are remeasured for the new paintings; the old Gemmie/Sammie oversized-frame
exceptions therefore no longer describe these assets. The art QA regions
are frozen from the new registration independently of subsequent helmet edits.

Reproduce with Node, TypeScript and @napi-rs/canvas:

```
node illustrated-src/export-flight-refresh.mjs
node illustrated-src/export-sandbox.mjs
node illustrated-src/review-flight-refresh.mjs
python illustrated-src/verify-art.py
```

`ACORNAUT_CANVAS` and `ACORNAUT_TSC` may point at installed dependencies.
`review/*-runtime.png` and `review/runtime-poses.json` capture the actual
production loadout renderer with Clear and matching helmets. This is native
Canvas renderer verification; it does not claim testing on a physical phone.
The full-frame preview includes deep dive frames outside the current shallow
gameplay range. Bounding-box width naturally varies as a whole character turns;
the scale tests use the skull and tail rather than forcing identical boxes.
