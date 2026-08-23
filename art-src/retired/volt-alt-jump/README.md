# Volt — alternate jump bank (retired)

Sixteen frames of a second painted jump for Volt, shipped alongside the
primary bank behind a "Test Jump" switch on Volt's hangar card so the two
could be flown back to back.

The A/B is over. Volt flies the primary `volt-tap-*` bank, the switch is
gone, and these frames are no longer loaded or shipped. They are kept
here rather than deleted: the comparison could be worth revisiting, and
re-rendering sixteen frames to ask the same question twice is waste.

To bring them back, restore `volt-tap2-*.png` to `docs/art/suits` and
`sandbox_assets/art/suits`, re-add the `-tap2-` series to the loader in
`illustrated-src/game/art.ts`, and select between the banks in
`paintIllustrated`.
