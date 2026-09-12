# Flight and High Orbit input response

Fixes #275 and #276. Requested behavior, paraphrased: taps should visibly affect flight animation, and High Orbit should move like AcorNut.

Flight's repeat taps used to reverse a three-frame ascent ramp. At 150ms intervals the pilot stayed on frame1; at300ms it used only frames1 and2 until release. It now completes each gesture and coalesces rapid input into one pending replay. Release drains it; dive/reset clears it. Original frames and helmet anchors are unchanged.

The five High Orbit rigs now retarget AcorNut's Flight locomotion and thrust gesture to their existing anatomy. The tail follows travel and accepted-tap recoil instead of a free-running sine. Short accepted taps visibly move the limbs. Fixed head radius, bone lengths, atlas art, exclusive wakes and premium playback are preserved.

![Actual High Orbit tap and release sequence](high-orbit-taps.gif)

## Focused evidence

- Web/beta, lab, Flight Studio and shell web-package builds and typecheck pass. No lint script; whitespace checked with git diff --check.
- Nine targeted test scripts pass; see validation.json for exact names. New Flight/High Orbit regressions fail on the old behavior and pass on the candidate.
- Flight now reaches frames1,2,3 while tapping at150,300,600 and1200ms. At390x844 DPR2 the real game renders Flight and all five rigs without page errors or overflow.
- High Orbit steady-velocity tail range falls from19.30-22.32 degrees to0; a40px/s accepted tap produces3.41-3.72 degrees of extra hand motion, previously0. Geometry keeps36px heads and constant bones, area-preserving tail strips, no clipping and fully covered joints.
- All3600 premium state samples match unchanged main. AcorNut real-flight and A/B physics coverage pass. Shipping art, masters and website are unchanged; only high-orbit-motion.js and sim.js differ after removing cache stamps from generated modules.

The strict High Orbit fallback PNG comparison retains historical Linux Canvas differences. A diagnostic proved candidate fallback pixels exactly equal main for all five and then completed the remaining rig checks. It did not weaken the shipping assertion. Details and metrics are in high-orbit-render.log and high-orbit-regression.json.

Full unrelated harness and global art/helmet suites were not run. This is a desktop browser at mobile dimensions, not an iPhone test. Motion still needs owner visual review; this draft is not merged or released.

| Flight at mobile width | Cinderforge at mobile width |
|---|---|
| ![Flight](browser-flight-390.png) | ![Cinderforge](browser-cinderforge-390.png) |
