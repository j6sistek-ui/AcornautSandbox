# Acornaut motion spec — how a suit flies

## Frozen suits rewind; the queue is the owner's call, 12 Sep 2026

The correction below reached the frozen roster (FROZEN_SUITS in draw.ts),
and the owner rejected it there the same day: "a new tap isn't driving
anymore ... take the 8 frozen out. revert it on those." The roster is
fourteen, twelve of them painted; all twelve are off the queue roster and
a repeat tap rewinds their picture as it did when they were approved.
Flight's tail is part of that - its twelve painted tail poses ride the same
clock, so the queue was what stopped it re-kicking under fast taps. The
other twelve painted suits queue by default and carry a beta-only pause
toggle (save.tapRewind) so the owner can decide, suit by suit, which keep
the queue. test-frozen-roster keeps the two lists disjoint.

## Painted-bank repeated-tap correction, 12 Sep 2026

The owner's report concerns banked flight, including Eclipse and Ion, rather
than only the pilot named Flight. All 24 registered ascent/tap/loop suits
complete the active gesture before one coalesced replay. Ascent playback uses
a front-loaded .73 timing curve for visible onset within100ms. Rapid taps therefore
reach every painted pose; release drains the bounded queue. Asc/desc suits
then follow downward velocity, while loop-only critters rest on frame one.
Rising velocity cannot restart a completed climb without a tap. Dive clears
the pending replay; reset clears playback state. Shelf previews retain their
authored cycles. Physics, art, helmet anchors and independent controllers are
unchanged. The roster in control-constants.ts is checked against the shipping
art manifests by test-flight-input.mjs.

## Patriot onset correction, 12 Sep 2026

Patriot (origamist) now plays source frames1,6–16 after a tap, skipping four
near-identical opening crouches. First lift arrives around33ms; the stronger
lift by100ms. All16 source images and explicit-frame access remain intact.
Percy and Envoy retain their full sequence. Flight Studio uses the same order.

## Premium pilot trio — explicit owner selection, 9 Sep 2026

The owner selected Porcelain Paragon with Sovereign Shell (B), always worn;
Nacre Envoy, helmetless by design; and Foldspace Origamist with Facet Shell,
always worn, for new production kits after reviewing the High Orbit rig and
concepts. These three reuse that eleven-part anatomy, fixed 36px head radius
at the 192px reference, continuous controller and suit-specific wake path.
Porcelain and Origamist have integrated shell paintings; Nacre has a bare
head. None accepts an interchangeable helmet overlay. Origamist's folded tail
rotates rigidly, so its painted facets do not bend like fur.

This scoped selection does not authorize new motion art for the five remaining
proposal characters. Sources, measured attachments, deterministic rebuilds and
review boundaries are in [the premium source README](../art-src/premium-pilots/README.md).

## High Orbit cut rigs — explicit owner grant, 9 Sep 2026

12 Sep 2026 correction: these five retarget AcorNut's Flight maneuver banks
and accepted-tap gesture to their existing anatomy. Rise, apex, fall and idle
retain asymmetric limbs; short accepted taps visibly accent them. Tail drag
follows vertical travel and tap recoil, with passive mid/tip lag; it no longer
pumps on an independent sine clock. Head size, bone lengths, atlas art and
exclusive wake power remain fixed. The premium trio's whole-frame playback
and AcorNut's own controller are unchanged. `test-high-orbit-input.mjs`
covers small-tap response and the absence of a repeating tail stroke at
steady velocity. This supersedes the independent rhythm described below.

Cinderforge, Groveguard, Cosmic, Sunforged and Abyssal now use eleven remastered
painted parts each, with original continuous motion and a suit-exclusive
built-in wake. This supersedes the five-suit 7 September sheet grant below.
The owner explicitly requested articulated cuts like AcorNut with independent
motion between AcorNut and Arcflash; their existing art and motion stay intact.

The five share fixed 36px head registration at a 192px reference, constant
bone lengths and a single area-preserving tail painting. Their old 8/8 banks
are retired from the loader. See `art-src/high-orbit/README.md` for source
provenance, extraction, runtime paths and review evidence.

## Natural standard series and approved companions — 9 Sep 2026

The owner requested Ion, Copper, Void, Sammie, Gemmie, Leviathan, Ember,
Frost and Ghost to share natural tail-led flight, using the new Gemmie whip
as guidance without copying Eclipse. Their regenerated 8/8 banks use a
rate-limited pose follower, a common 192px presentation reference and actual
head registration to a 36px radius. Matching neutral portraits prevent
loading/portrait helmet-fit changes. All eight descent poses are enabled.
Their obsolete split rigs are retired; no physics or input timing changes.

Quill, Noodle and Bandit retain their separate 16-frame loop route. The owner
approved a combined sheet's exact motion and explicitly excluded its panda.
Those three are cut from the supplied sheet with fixed scale and margins;
only Quill's erroneous long tail receives a localized generated repair.
See `art-src/natural-flight/README.md` for sources, export, pixel boundaries,
all-helmet coverage and the review record. This supersedes these twelve
characters' earlier art instructions below, not the other frozen suits.

## Cryostar and Verdant — explicit owner grant, 8 Sep 2026

The owner requested these two suits to receive Eclipse's exact motion-frame
sequence and flight mechanics while keeping their own costume features and
colours stable. This supersedes their previous `flight-refresh` banks and the
Eclipse-only heading restriction for these two ids only.

Both now have eight ascent and eight descent whole-character paintings matched
cell by cell to Eclipse. They share its heading smoother, pose curve, frame
indexing, preview arc, 5-degree default pitch and contact response. The existing
physics is unchanged. No new tap, tail-tap, bounce bank or articulated rig is
introduced. Eclipse's paintings remain unchanged.

`art-src/eclipse-motion-transfer/README.md` records the original costume
references, generation prompts, final masters, measured helmet registration,
local colour checks, runtime comparisons and known baseline test failures.
Rebuild these banks with `export-eclipse-motion-transfer.mjs`; the older
`export-flight-refresh.mjs` no longer writes their files.

## Five unreleased suits — explicit owner grant, 7 Sep 2026

Cinderforge, Groveguard, Cosmic, Sunforged and Abyssal receive replacement
eight-frame ascent and eight-frame descent sheets from their static loadout
portraits. This scoped request retires their obsolete tap/rig method. It does
not promote their availability beyond beta. The new paintings articulate
elbows, knees and tails; skull registration keeps the helmet on its flight arc.
Masters, prompts and measurements live in `art-src/beta-flight-refresh`.

## Arcflash — explicit owner grant, 6 Sep 2026

The owner requested this new blue-eyed, dark-carbon squirrel suit and supplied
two stills plus a flight video. They explicitly allowed separated head, arms,
legs and tail driven by an algorithm, and asked to ignore the video's green
color and flip/roll. This grants **Arcflash only** a new articulated backend;
the older general prohibition on new split rigs below does not apply to it.

`arcflash-motion.ts` drives eleven fixed-scale painted pieces in `arcflash.ts`.
Torso attitude follows actual vertical velocity; elbows straighten on ascent,
legs extend after the chest, the head counter-rotates, and three tail springs
retain their momentum. An accepted tap adds pressure without resetting any
pose, joint rate or tail clock. Contact recovery has an independent clock.
The blue wake records recent boot positions in world space, and short wrist
jets use the same forward kinematics as their artwork. No roll, green effect,
physics force or gameplay RNG is introduced.

This suit is a free beta option with its own electrical wake. Its reviewed
source and registration live in `art-src/arcflash`; the eleven rig parts plus
an unused source reference occupy one 1024×768 RGBA atlas. The 256px fallback
is rendered from the same rig. See `design/arcflash/REVIEW.md` for validation.
Vanguard/AcorNut's renderer, source art and animation modules are untouched;
the reported PR #199 correction can proceed independently.

## THE RULE (owner, 26 Aug 2026)

> **Everything gets the default flight treatment unless the owner says there
> is a custom animation, or supplies custom flight sprite sheets. The
> default is Flight. The special ones are given, not derived.**

Read that as a standing rule with two halves, because both matter:

1. **Default is not a fallback, it is the answer.** A suit with no
   owner-supplied sheets is not waiting for art — it is finished. Nobody
   commissions, generates, selects or derives a motion bank for it. There is
   no backlog of suits that "still need" one.
2. **Custom is granted, never inferred.** A suit joins the custom tier
   because the owner said so and handed over sheets. It does not join it
   because its pitch measured well, because a generator was available, or
   because someone thought it looked better. Measurement can *describe* the
   roster; it cannot *promote* into it.

The suits with custom flight animation today are **eclipse, volt, bigbooty,
robo, catsuit** — good as they are, and not to be regenerated, re-selected
or re-indexed. `verify_motion_banks` enforces the tier's membership so it
cannot be widened quietly; changing it takes an owner ruling and a matching
edit to `CUSTOM_FLIGHT_SUITS` in `illustrated-src/verify-art.py`.

**The 24-suit render project this document used to describe was cancelled
under this rule and is not to be revived.** What follows is kept because it
is the measured record of the roster and the recipe for a genuinely new
model authored from scratch — not a work order for anything that ships.

---

**The standard is Flight.** Owner ruling, 25 Aug 2026: a new model must meet
it. A model may keep a path of its own when its *shape* is genuinely
different — Robo and Cyber are the two — but that is a declared exception,
not somewhere a suit drifts to because nobody wrote the standard down.

Splitting a character into parts, or driving it from a motion file, was
considered and **rejected**. It was tried before, the splits were not clean,
and the motion was still bad. It also would not be cheaper: Flight's whole
flight envelope is eight drawn frames, which is *half* what a tap bank costs.

## Three tiers ship today

| tier | how the pose is chosen | suits |
|---|---|---|
| **Velocity-indexed pose bank** | the sim's vertical velocity picks the frame | flight, eclipse, cyber |
| Tap bank | a 1.0s clip on a tap clock | 20 suits |
| Layered rig | body + tail layers, `scale(1 + p*0.052, 1 − p*0.028)` | everything else |

Only the first is the standard. The difference is not frame count — Flight
has **fewer** frames than a tap bank. It is that the pose cannot disagree
with the physics, because the physics *is* the index. A tap bank is a fixed
clip, and in real play the pilot taps again long before it finishes, so the
clip is always showing a moment that is not the moment you are in. The
layered rig is worse again: it squashes the whole body 2.8% vertically,
which is the belly-tuck read — a sticker being pinched, not a body moving.

## The contract

```
v    = smoothMotionVy(vy)          rising → −1…0,  falling → 0…1
bank = v < 0 ? ascFrames : descFrames
idx  = round(|v| × (bank.length − 1))
```

Draw-path priority in `paintIllustrated` is `fullBounce` → `fullMotion` →
`fullTap`, and **`fullMotion` has no time gate**. So a suit that ships
ascent and descent banks will never draw a tap bank, in flight or in the
loadout preview. Flight ships 16 unreachable tap frames (616 KB); Eclipse
ships 28 (1.5 MB). Do not author both.

## What to render

Everything in `ART_SPEC.md` still applies — 1408 × 1408, bare-headed, no
ground plane, no cast shadow. On top of that:

- **Three ascent frames, five descent frames.** The asymmetry is deliberate
  and it is not about importance: the descent is where the arc is slow and
  the eye has time to read it, so it gets the resolution.
- **Frame 1 of each bank is the level pose.** `idx` is 0 whenever `|v|` is
  near zero, so `asc-1` and `desc-1` are what a pilot sees at the top of
  every arc. Measured on Flight they sit at −14.3° and +13.8° of body pitch
  — a 28° flip as the velocity crosses zero. It reads as a flick at the
  apex and the owner's verdict on it is *fine*, so this is a recorded
  property, not a defect. It is also the first thing to look at if a new
  model's motion feels wrong at the top of the arc.
- **A monotonic pitch ramp, accelerating into the dive.** Flight, measured
  as the principal axis of the opaque mass:

  ```
  asc    −14.3°   −16.7°   −23.1°
  desc   +13.8°   +17.5°   +35.8°   +42.6°   +76.3°
  ```

  The climb is a narrow band; the dive opens out. A ramp that is not
  monotonic will read as the pilot twitching, because `idx` walks it in
  both directions continuously.
- **Every frame is a whole character** — body, tail, head, suit, drawn
  together. No layers, no compositing, nothing cut. This is the property
  that makes the tier work and it is the one the parts experiment lost.
- **The same canvas and the same character scale on all eight.** The code
  uses `ascFrames[0].box` as the registration reference for *every* frame in
  *both* banks, so a frame that was re-centred or re-cropped on its own will
  jump. The content bbox is free to change — that is the pose; Flight's runs
  125–154 wide and 120–148 tall — but the canvas and the scale are not.

## The art has to CONTAIN attitude, and most of it does not

This is the acceptance test that decides whether a suit can carry the
standard at all, and it is worth measuring before rendering anything.

Flight's eight frames span **99 degrees** of body pitch, from -23 climbing
to +76 in the dive. That range IS the model - the sim picks a frame by
vertical velocity, so if the frames do not differ in attitude there is
nothing for velocity to pick between.

Measured across every 16-frame tap bank that ships, as the principal axis
of the opaque mass:

| suit | pitch span | carries the model? |
|---|---|---|
| eclipse | 112° | yes |
| volt | 76° | yes |
| robo, bigbooty | 64° | yes |
| **the other 24** | **16-20°** | **no** |

Twenty-four of twenty-eight suits have essentially no attitude in them.
Their tap frames are a FLAP - the body stays rigid and the tail does the
work - which is exactly why they read as a sticker being pinched next to
Flight. Note that Flight's own tap bank spans 18°, flat like the rest: its
asc/desc frames are separate art, authored as attitudes rather than as a
wing-beat.

**So no amount of re-indexing converts them.** A velocity-indexed bank
built from frames that all point the same way is still frames that all
point the same way. Converting them would mean eight new attitude frames
each, and that is the real cost of the standard - not the code.

### What the measurement is, and is not, for

The cliff in that table — 112° down to 36° for five suits, 24° and below for
the other 23 — happens to fall exactly where the owner's custom tier sits.
That is a useful sanity check and nothing more. **The five are custom because
the owner supplied them, not because they measured well**, and a 24th suit
does not earn promotion by scoring 45°. See THE RULE at the top.

Read the table as a description of the roster, then stop.

**The ones with range were candidates to convert for free** - a 3+5 ramp
selected out of their existing sixteen, no new art. Not being done either:
they are among the five that were ruled good as they are, and a selection
is still a change to a flight animation that the owner has flown and
approved. Pitch was only ever a proxy anyway - a frame at -27° may be
mid-wing-beat with the arms somewhere the neighbour's are not, so a ramp
chosen on the number alone can read as jitter.

**Rule for a new model:** render the eight poses to span at least **45°**
of pitch, and aim for Flight's 99. `verify_motion_banks` measures it.

The floor is calibrated, not chosen. The first cut was 60 — "0.6 of
Flight's 99" — and it promptly failed **cyber at 59°**, a suit that ships
and works. The number was wrong, not the suit. The measurements leave an
enormous empty middle: flat banks sit at 16–20 and working ones start at
cyber's 59, with nothing in between. 45 sits in that gap with better than
double the margin either way. It is not a quality bar — it is the line
between "these frames differ" and "these frames are the same pose".

## The head must not change size

**Flight's head radius is 33 px on all eight frames. Spread: 0.0%.**

The head *centre* travels a long way — 15 px across and 50 px down, from
`(174, 88)` on the deepest climb to `(164, 138)` on the steepest dive. The
*radius* never moves at all.

That is the whole reason any of the 20-odd helmets sits correctly at every
attitude. A bank whose head grows and shrinks cannot be fitted by one
scale, and the helmet will breathe against the face across the ramp.
Measure it; do not eyeball it.

## Every frame needs its own dome anchor

Keyed `<id>-asc-<n>` and `<id>-desc-<n>` in `DOME`, one per frame, all eight.

`paintDome` **returns silently on a missing key**. A missing anchor is not a
drifting helmet — it is *no helmet at all*, on that pose only, which is
exactly the kind of fault that survives a casual look at a contact sheet.
`verify_motion_banks` fails the build on it.

## Adding a motion bank

```
# 1. render the 8 poses to the ART_SPEC contract, then key and seat them
#    in the family's framing in ONE resample, same as the still
python3 illustrated-src/key-render.py  ...
# 2. measure the dome anchor on EACH of the eight
python3 illustrated-src/measure-art.py --poses <id>-asc-1..3 <id>-desc-1..5
# 3. paste the eight printed lines into DOME in draw.ts
# 4. add the id to ASC_BANKS / DESC_BANKS in art.ts, and do NOT add it to
#    TAP_BANKS — a motion bank makes a tap bank unreachable
# 5. python3 illustrated-src/verify-art.py     (verify_motion_banks)
# 6. fly it in the loadout preview, then bump ART_VER and re-export
```

## What is not the standard

- **Parts, skeletons, motion files.** Rejected 25 Aug 2026, on the evidence
  that the splits were not clean and the result was still bad — and on the
  arithmetic, which does not favour them at eight frames a suit.
- **A unique path because a model was liked.** Robo and Cyber earn theirs on
  shape. Anything else meets the standard or it is not ready.


## Vanguard flagship — owner grant, 5 September 2026

The owner explicitly requested a new flagship squirrel with custom tap/dive
flight, bounce, shield and a fixed trail, with extra frame/storage budget.
Vanguard is a separate whole-character animation backend in `game/vanguard.ts`.
It does not replace Flight or touch any existing suit's banks or controls.

The owner revised this grant after the phone playtest: tail motion should be
nearly constant, the body should follow up/down travel, and taps should read
as a subtle acceleration/thruster response rather than a jump. The old
pose-hold/1.76s tap controller is retired for Vanguard.

- Sixteen whole-character drawings carry a continuous tail sweep. No pieces
  are split or stretched. Registered head/helmet scale stays fixed.
- A separate heading follows vertical velocity through climb, level flight
  and shallow fall. Only an accepted swipe permits the deeper attitude.
- Tap, gate and contact events never rewind the tail or set the body pose.
  Taps trigger eased thrusters; contacts retain the existing surface dust.
- Cinematic: 1.8s tail loop, 130ms heading response. Beta Continuous: 1.15s
  tail loop, 90ms response. Both keep the tail moving without input.
- Ready screens idle the tail; pause freezes it. Other suits keep their paths.

The active 512px RGBA bank is now 16 MiB decoded and stays equip-only. Original
32-pose source sheets remain archived. Review, source prompts, registration,
rebuild steps and actual short-arc phone-field evidence live in
`design/vanguard/README.md`. Human phone review remains the quality gate.

## The tap-shape and tail-spring dials, 12 Sep 2026

A freeze-vs-today trace of Eclipse (same tap script, every per-tick number)
found physics, tap clock, tail and body angle identical and one difference:
which ascent frame is drawn. At the freeze, velocity picked it; PR #277's
tap-clock ramp picks it now. Owner: "only change eclipse. to try it", then
"give me the dial. let's do this once and for all. forward .1-1 and back
.1-1", then "if it's possible to give a tail springiness". So:

- `TAP_SHAPE` (control-constants): per suit, `"velocity"`, a linear
  `{fwd, back}` in seconds, or absent for the stock ramp. Eclipse is on
  velocity; everything else is stock.
- `TAIL_SPRING`: per suit multipliers on TAIL's stiffness, damping and tap
  kick, for the nine suits with their own tail layer.
- The beta pause sheet carries both as dials (`save.tapShape`,
  `save.tailSpring`), read only on the beta page. The owner reports the
  numbers he lands on and they are baked into the two tables.
- The repeat-tap dial is per suit too (`save.tapRepeat`): REWIND, FINISH
  (PR #277's queue) or RESTART (every tap a fresh gesture). Stock is rewind
  for the frozen roster and finish for the rest.

## The ruling, 12 Sep 2026

After flying the dials: "robot cat big booty volt all stay default rewind.
briellas cat, cyber, eclipse, and everything I don't name otherwise, gets
velocity rewind. Critters, bandit, noodle and quill get velocity restart
[A: restart only]. percy, envoy, patriot, all need something else, its
artwork, its frame work. high orbit ... play well with velocity rewind.
arcflash and acornut are good." Baked: TAP_SHAPE = velocity for all
seventeen ascent-bank suits; PAINTED_TAP_SUITS empty (nobody finishes
live); TAP_REPEAT = restart for the three critters; FROZEN_SUITS = Robo,
Big Booty, Cat, Volt, AcorNut, Arcflash. From the retrofit study: ordinary
flight now steps on the same fixed 1/60 accumulator as Race and Spill; a
held Space key is one tap in flight; and a beta TAP ACCENT switch adds a
167 ms ignition and a body reaction spring that read the accepted tap.
The premium trio is a project of its own.
