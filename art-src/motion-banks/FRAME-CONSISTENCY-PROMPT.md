# Frame-to-frame consistency — the generation prompt and the pixel boundaries

`TEMPLATE.md` says what the eight attitudes are (the pitch ramp).
This file says what must **not change** between them.

Everything below is measured off the shipped banks: the suits the owner
approved on 9 Sep 2026 against the ones the same review called awful. It is
not style guidance — it is the set of numbers that separated the two.

---

## Part 1 — the prompt

Paste this into the generator alongside the character description and the
pose for the frame being drawn.

> **One character, one costume, one camera. Only the pose changes.**
>
> This is frame N of a 16-frame flight sequence of a single character. Every
> frame is the SAME animal in the SAME outfit, photographed by the SAME lens
> at the SAME distance. Treat the previous frame as the ground truth for
> everything except the pose.
>
> **Identical in every frame — no exceptions:**
> - The costume. Every garment, panel, strap, buckle, seam, zip, collar,
>   trim line, badge and marking is present, the same shape, the same size,
>   in the same place on the body. A jacket that is open in one frame is
>   open in all of them. Nothing appears. Nothing disappears. Nothing
>   changes colour, material or count.
> - The character. Same species, same proportions, same fur or skin
>   pattern, same eye shape and colour, same ear shape, same muzzle.
> - The palette. Same hues, same saturation, same value range, same light
>   direction, same rim light, same shadow colour.
> - The scale. The head is the same SIZE in every frame. Do not zoom, dolly,
>   or crop differently between frames. The camera does not move.
>
> **Changes between frames — this is the whole animation:**
> - Body pitch, along the ramp given for this frame.
> - The tail, which does most of the work: a long, continuous, readable arc
>   that carries through the sequence. Neighbouring frames must be one
>   motion caught at two moments, never two separate drawings.
> - Limbs, following the body, secondary to the tail.
>
> **The head is an anchor, not a subject.** It travels on a smooth path and
> holds its size. It must not drift sideways, must not resize, and must not
> jump: no frame may put the head somewhere its two neighbours do not imply.
> If the head is the thing that moves most between two frames, the frame is
> wrong.
>
> **Framing:** transparent background, no ground, no shadow cast on
> anything, no motion blur, no speed lines, no effects, no trail. The
> character alone. Consistent margins — the character occupies the same
> region of the canvas in every frame.

---

## Part 2 — the pixel boundaries

All numbers on the shipped **256 × 256** exported frame. The head circle is
the game's own per-frame `DOME` anchor — the green circles on the review
sheets — which is what the helmet is fitted to.

### What the approved suits do

| suit | verdict | head radius | head x span | worst single-step head jump |
|---|---|---|---|---|
| seraph | "solid flier" | 38, constant | **0–2px** | 14px |
| eclipse | "very good" | 56, constant | **10–15px** | 27px¹ |
| robo | "great" | 45, constant | 3px | 12px |
| bigbooty | "perfect" | 41, constant | 13px | 16px |

¹ eclipse's 27px is `desc-1 → desc-2`, a deliberate pose change at the top
of the dive, not a twitch — it is smooth in context.

### What the rejected suits do

| suit | verdict | head x span | worst single-step head jump |
|---|---|---|---|
| sammie | "twitchies and minimal motion" | **40px** | 22px |
| gemmie | "twitching a lot" | **30px** | 22px |
| iontrim | "a bit steep" | 19px | 30px |
| voidsuit | "massive suit drift" | 20px | 13px |
| ghost | "teetering" | 18px | **66px** |

### The acceptance thresholds

| measure | pass | why |
|---|---|---|
| **head x span** across the bank | **≤ 15px** (6% of canvas width) | every approved suit is at or under this; every rejected one is over |
| **single-step head jump** | **≤ 16px**, or justified as a pose beat | ghost's teeter is one 66px step and nothing else |
| **head radius** | **constant across the bank** | the helmet is fitted with `scale = headRadius * 1.04 / glassRadius`, one radius per bank. A head that resizes leaves the helmet behind. The table can hold a per-frame radius, but no shipped bank uses one — and constant reads better regardless. |
| **tail work** (ink changing far from the head ÷ ink changing near it) | **≥ 2.9×** | seraph 3.92, bigbooty 3.19, eclipse 2.95, robo 2.91 — against frost 0.96, ghost 1.10, voidsuit 1.10, ember 1.13 |
| **head drift** (median non-smooth head motion) | **≤ 6px** | seraph 1.0, robo 2.7, eclipse 5.1, bigbooty 5.6 — against iontrim 19.0, ghost 17.8, voidsuit 14.7, ember 14.7 |
| **costume delta** | zero | owner, 9 Sep: "I see like jackets disappearing and appearing… the suit changing design mid frame is an issue" |

### The one thing that is NOT a defect

Positional wobble is not jitter. Briella's Cat moves more between frames
than anything else in the game and is the stated ideal — *"the motion is
incredible, honestly ideal for standard to replicate against"*, "the jitter
of briella cat makes it cute and wobbly". Frost measures the **cleanest**
frame-to-frame displacement in the roster and was called awful.

So the test is never *how much* changes. It is *what*: the tail and the
body pitch may move as far as the pose demands; the head and the costume
may not.

---

## Part 3 — scoring a delivered sheet

Suits that wear their own head (Cat, Briella's Cat, AcorNut, Volt, Cyber,
Arcflash) carry no `DOME` anchors, so the head measures do not apply to
them. Judge those on costume delta and tail work only.

The head measures need per-frame anchors, which are set by hand in the rig
editor (`docs/lab/rig/`, reachable from Help). Costume delta and tail work
can be read straight off the PNGs.
