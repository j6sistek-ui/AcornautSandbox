# Percy, Envoy and Patriot: Cyber motion transfer

Owner request, 12 September 2026: replace these three pilots' art, frames and
sprites with paintings that follow Cyber's gold standard as closely as their
existing designs allow, and wire each through the same controller and painter.
The scope is `porcelain` (Percy), `nacre` (Envoy) and `origamist` (Patriot).

## Character identity

The retained references in `../premium-flight` establish the costumes:

- Percy wears an integrated ivory Sovereign Shell, opaque navy visor, cobalt
  botanical markings and round blue joints. Four silver paws and one silver
  fur tail remain. The helmet has no exposed muzzle or new tail armor.
- Envoy has an uncovered pale peach/lilac finned head, open purple eyes,
  aubergine clothing with rose-gold piping, ivory bracers and shin guards,
  and two substantial pearl-lilac tails with separate roots and tips.
  The owner's follow-up prioritizes body and tail motion, allowing subtle
  arm and leg movement to keep her stance natural rather than requiring
  identical Cyber limb bends.
- Patriot wears an integrated ivory Facet Shell and opaque angular navy
  visor, stable red/ivory/indigo panels and blue joints. Its single folded
  fan-tail retains the same facets rather than gaining or losing folds.

Cyber's two antennae, luminous fur and costume are not transferred. Prices,
ownership, head policies and each character's signature wake are unchanged.

## Source and export

`references` contains exact, mechanically enlarged Cyber cells and alpha
cutters, generated from the shipping gold-standard images. Each target has
nine individual ascent and nine individual descent source paintings under
`<id>/frames`. The final inputs are selected explicitly by `export.json`;
earlier sheet experiments are not shipping sources.

The exporter keys the retained green matte, samples the complete square
canvas at one constant scale per suit and applies documented registration.
Measured translations move an entire painting. There is no independent
bounding-box fit, rotation, limb deformation or detail repainting in code.
The still is byte-identical to ascent frame 1. A reviewed binary mask divides
that same painting into complementary still body/tail layers.

`geometry.json` records measured head and boot positions in the final 256px
cells. The exporter generates `game/cyber-trio-registration.ts` and a shipping
manifest binding all outputs to source hashes, transforms and masks.
See [TOOLING.md](TOOLING.md) for rebuild commands and metric limitations.

## Runtime

The three suits use `ASC_BANKS`/`DESC_BANKS` with nine cells in each bank and
the same velocity mapping, default repeated-tap policy, lean parameters and
still tail spring as Cyber. Both banks are published only after all 18
256px images load. Flight, preview and portrait calls use the ordinary
full-motion painter; the retired 16-cell premium controller does not intercept
them. The existing material wakes follow the selected painting's boot points.

With complete banks, flight/ready poses are whole painted frames and portraits
draw the neutral still. The split body's tail spring is a loading fallback
when the rig layers are available before both complete banks, as for Cyber.

Cyber's frozen production trace remains the behavior authority. Its live
mode and preview mode are tested separately; prose about a mode must not be
used to silently change Cyber. The three own-head paintings retain their
integrated-shell/helmetless policies and need no interchangeable helmet.

The real-renderer comparison is `/lab/premium-pilots/`. It runs the production
simulation and pilot painter for Cyber and the three replacements, with
tap, dive, pause, reset, frame inspection and multiple display sizes.
Flight Studio also uses the Cyber bank family and velocity profile.

## Acceptance evidence

The owner's final priority is Cyber's visible tail rhythm, ahead of exact
spec alignment. Preserve the direction changes and their frame counts:

| Cyber phase | Cells | Motion to transfer |
| --- | --- | --- |
| Anticipation | ascent1 to3, two transitions | Tail drops/curls into the wind-up. |
| Sweep | ascent3 to7, four transitions | Continuous gather and upward sweep; each cell visibly advances. |
| Follow-through | ascent7 to9, two transitions | Late overshoot/flop completes the arc. |
| Relaxation | descent1 to9 | Tail settles and trails; the steps diminish rather than starting a second whip. |

Review the reset and ascent/descent handover in the actual painter. Source
cell order and velocity-selected playback are both relevant. Envoy retains
the current art's two-tail crossing/unwind within this rhythm; Patriot keeps
its folded fan anatomy. Exact alignment is secondary, not a reason to erase
character-specific motion or introduce abnormal bends.

Structural checks cover alpha, margins, bank completeness, still/layer
identity, source hashes and measured geometry. Motion traces compare actual
controller states to Cyber. Neither proves stable suit details: the independent
visual review must inspect every frame, adjacent transitions, the ascent/dive
seam and gameplay-size playback. A contact sheet or passing proxy metric alone
is insufficient to clear changing motifs, armor, anatomy or tail motion.

The old source files in `../premium-flight` remain historical references.
Both older premium export entry points redirect to the new exporter, so they
cannot restore the retired 16-frame portrait over these replacements.
