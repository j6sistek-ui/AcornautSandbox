# Armoured squirrel anatomy repair

9 September 2026. Scope: Arcflash, Cinderforge, Groveguard, Cosmic, Sunforged
and Abyssal. Baseline: main `5aeb37c6480e3434fe84830306d50911127e9804`.

The original atlases remain unchanged. The far shin cells for Arcflash,
Cinderforge, Groveguard and Cosmic were painted with toes pointing backwards.
`foot-landmarks.json` records manually inspected heel/toe points in those
original cells and both correctly oriented feet on Sunforged and Abyssal.

`game/rig-limb-fit.ts` statically registers each boot around its knee-to-boot
axis. It gives High Orbit thighs 1.42× breadth and shins 1.48× breadth;
Arcflash uses 1.28× / 1.22× on top of its existing painted calibration. The
bone-axis scale, endpoints and emitter attachment do not move when applying
this fit. Registration never flips between animation frames. The unchanged
paintings preserve materials, buttons, inlays, fur, and colors through motion.

Both controllers now hold bent hind legs with a more tucked squirrel posture.
Arcflash's upper-body, head and tail motion are retained. High Orbit gains a
visible bounded head nod and aft tap recoil, followed by delayed tail recovery.
The new accepted-tap hook keeps the pose and spring rates continuous, reacts
to small refresh taps, and is wired into flight, tutorial playback, Hyper Run
and Flight Studio. Its recoil is separate from existing boost power.

Sunforged's sealed helmet image was intact. The new bare loading portrait
had replaced its helmeted suit-card appearance. Sealed-suit cards now draw
the matching helmet (also correcting Groveguard), and an opaque helmet hides
the underlying bare-head layer so ears cannot peek around the metal shell.
Clear and other selected helmets remain available. No save migration, unlock
change, or permanent helmet lock was introduced.

All heads retain their prior fixed size and registration. All five High Orbit
heads still use the common 36px enclosing circle at a 192px display reference.
Boost palettes, effect geometry, timing, exclusivity and power are retained;
the emitters follow the revised leg poses through the existing joint positions.

## Rebuild and review

Use the container workflow in the repository `AGENTS.md`, or its documented
existing-dependency fallback when Docker is unavailable. No new dependencies.

1. `node illustrated-src/export-sandbox.mjs`
2. `node illustrated-src/review-high-orbit.mjs --write-stills`
3. `node illustrated-src/build-lab.mjs`
4. `node illustrated-src/build-flight-studio.mjs`
5. Run `test-rig-anatomy.mjs`, High Orbit, Arcflash and Flight Studio tests,
   then the full `SHIPPING.md` gates.

`node illustrated-src/review-rig-anatomy.mjs` generates the side-by-side
contacts against the retained `docs/js252` baseline. For historical reruns
after that stamp is pruned, recover it from the baseline commit first.

See [validation](../../illustrated-src/design/rig-repair/VALIDATION.md),
[feet](../../illustrated-src/design/rig-repair/foot-registration.png) and
[poses](../../illustrated-src/design/rig-repair/before-after.png).
