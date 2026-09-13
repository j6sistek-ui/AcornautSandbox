# Premium pilot release review

**Current route: Cyber transfer, 12 September 2026.** The owner requested
replacement 9/9 banks for Percy, Envoy and Patriot with Cyber's controller
and painter. See
[`art-src/cyber-standard-trio`](../../../art-src/cyber-standard-trio/README.md).
The premium comparison lab now calls the production `Sim` and `paintPilot`,
with Cyber beside the three replacements. The sixteen-frame design and
validation record below describe the preceding implementation.

The owner rejected the transfer's enlarged-preview quality. Current repair
evidence belongs in [QUALITY-REVIEW.md](QUALITY-REVIEW.md) and
[QUALITY-VALIDATION.md](QUALITY-VALIDATION.md); the original
[CYBER-REVIEW.md](CYBER-REVIEW.md) and [CYBER-VALIDATION.md](CYBER-VALIDATION.md)
remain historical records. Cyber's tail direction changes,
frame counts, follow-through and settling are the owner's first priority;
exact spec alignment is secondary. Envoy keeps two distinct tails and their
loose crossing/unwind, with modest natural limb movement.

## Historical sixteen-frame release

The owner authorized release of the supplied sixteen complete flight frames
for each of **Porcelain Paragon**, **Nacre Envoy** and **Foldspace Origamist**,
with cast shadows removed and Porcelain's surrounding boxes cleaned away.
This supersedes the rejected cut-rig posture work. Further reusable cut kits
remain off repo for later work.

The preceding Envoy release used the owner-supplied replacement
(attachment `0084A7E8`), preserved as `art-src/premium-flight/nacre-original.jpg`.
The required sequence has two equally substantial pearl tails with distinct
adjacent roots at the back of the rump. Both move: separate relaxed curls,
a sweep into flight, a brief loose braid/crossing, then an unwind to separate
curls. The earlier permanently braided master is superseded. Verify both
roots and tips throughout playback; this is authored frame motion, not a
procedural independent-tail rig. Completed checks are recorded in the release validation.

Porcelain always wears Sovereign Shell (helmet B); Nacre remains helmetless
by design; Origamist always wears Facet Shell. Individual suits cost
**1,000 Stardust each**, or **2,500 Stardust for all three** in Premium Pilot
Trio. Each suit includes its existing signature wake. The bundle and unowned
individual options remain purchasable every day alongside the rotating
featured pack.

The [five remaining proposal cards](proposals/index.html) reuse existing
artwork only. They add no production kits or catalog entries.

## Historical sixteen-frame review boundary

The whole-frame lab is `docs/lab/premium-pilots/index.html`, generated from
`illustrated-src/lab/premium-pilots.html`. It loads the production
`art.premiumFlight` banks and paints through `paintPremiumFlightFrame`.
Select any of the sixteen frames, or use Previous/Next to pause and inspect
it. Play resumes; Tap or Space feeds the shared accepted-tap controller.
Repeat taps queues complete cycles, preserving every authored frame. Normal
and quarter speed, 52px game size, medium/enlarged views, wakes and light/dark
backdrops are available. Each card reports its actual displayed frame and
whether the next cycle is queued.

A direct frame seek clears the previous pose's emitted wake history while
keeping the current review time. Ordinary Pause preserves the actual trail
history so an in-flight result can still be inspected without changing it.

The supplied full-body frames must retain their pose order, squirrel or alien
identity, body proportions, costume and selected head treatment. Inspect all
sixteen cleaned frames per suit at close range and flight size, then inspect
playback through repeated taps and the complete release cycle. Confirm that
shadows and framing boxes are removed without cutting away anatomy or
leaving visible halos.

Check the actual production Shop at 390px width: each individual card must
show 1,000 Stardust, the trio pack must show 2,500 when nothing is owned, and
individual and bundle checkout must remain available on different dates.
Verify fallback portraits and cockpit crops as well as flight and preview
playback.

[VALIDATION.md](VALIDATION.md) tracks that historical release evidence. Implementation
authorization does not by itself certify a generated output or a passing
release gate. No new visual acceptance is recorded until the cleaned
whole-frame assets and their actual playback have been reviewed.

## Historical cut-rig evidence

Earlier static contacts, registration diagrams, browser captures and
the cut-rig regression receipt were removed from the current review folder;
their previous versions remain in Git history. The initial
visual acceptance and subsequent posture assessments were superseded by the
owner's rejection of inward feet, cramped or spread arms and human-like
proportions. They must not be presented as acceptance evidence for the
supplied full-body release.

The reusable cut-master files are historical provenance. Current
production must not load those atlases or apply their limb transforms to the
supplied complete characters. The [source README](../../../art-src/premium-pilots/README.md)
records the current production and pricing boundaries.

Complete the source export, lab/Flight Studio builds and
[SHIPPING.md](../../../SHIPPING.md) checks before updating the PR with fresh
receipts. The PR must remain unmerged until the owner authorizes merging.
