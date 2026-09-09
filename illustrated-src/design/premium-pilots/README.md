# Premium pilot release review

The owner authorized release of the supplied sixteen complete flight frames
for each of **Porcelain Paragon**, **Nacre Envoy** and **Foldspace Origamist**,
with cast shadows removed and Porcelain's surrounding boxes cleaned away.
This supersedes the rejected cut-rig posture work. Further reusable cut kits
remain off repo for later work.

The latest Envoy direction requires two distinct pearl tails with offset
motion authored into those complete frames. Verify both tail silhouettes
and their separate motion through the sequence; do not describe this as a
procedural independent-tail rig.

Porcelain always wears Sovereign Shell (helmet B); Nacre remains helmetless
by design; Origamist always wears Facet Shell. Individual suits cost
**1,000 Stardust each**, or **2,500 Stardust for all three** in Premium Pilot
Trio. Each suit includes its existing signature wake. The individual options
remain purchasable when the trio pack is featured.

The [five remaining proposal cards](proposals/index.html) reuse existing
artwork only. They add no production kits or catalog entries.

## Current review boundary

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
individual checkout must remain available while that pack is featured.
Verify fallback portraits and cockpit crops as well as flight and preview
playback.

[VALIDATION.md](VALIDATION.md) tracks the new release evidence. Implementation
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
