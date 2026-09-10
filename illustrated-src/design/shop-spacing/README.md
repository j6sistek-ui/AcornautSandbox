# Shop spacing repair

Issue #265 covers headings touching the following image/card and adjoining Stardust purchase cards. Two Shop-only CSS rules change heading clearance from -2px to8px and card separation from0px to10px. The Star Dust label already contained its space. Prices, purchases, saves, gameplay and artwork are unchanged.

PR264 was merged by the owner while PR266 was open. This update integrates that helmet release at main bafe50345707ef22f4607ef4ba2534057643a473, preserves all shipping art, source masters, helmet painters and registration, and rebuilds production/beta/lab/Flight Studio at stamp269. All51 generated game modules differ from current main only in stamp/build time.

## Evidence

Runtime tested: b4e4f079432cb6bb59a203ee1735559fc992fcf3. Final receipt changes only the files in this review folder. The original baseline was reproduced at11a1b88df55ab0664fc413cb07a384ae15e3e704. New production and beta measurements after integration pass at390x844 and320x844:8px heading gaps,10px card gaps, no horizontal overflow or page errors. Disposable synthetic saves were used. These desktop browser checks do not establish native iPhone validation.

[Before measurements](before-measurements.json) / [After measurements](after-measurements.json) / [Beta measurements](beta-after-measurements.json).

| Before | Updated candidate |
| --- | --- |
| ![Before390](before-390-dust.png) | ![After390](after-390-dust.png) |
| ![Before320](before-320-dust.png) | ![After320](after-320-dust.png) |
| ![Feature before](before-390-feature.png) | ![Feature after](after-390-feature.png) |

## Repeat the layout check

Use existing Playwright and browser tooling. Set ACORNAUT_PLAYWRIGHT to the package and ACORNAUT_BROWSER to the Chromium/Edge executable, then run:

```sh
node illustrated-src/design/shop-spacing/browser-check.mjs after
```

The check serves this checkout on a temporary loopback port, opens isolated storage, measures both widths and closes its browser/server. ACORNAUT_REVIEW_BETA=1 checks beta; ACORNAUT_REVIEW_OUTPUT selects an output directory. Before mode records baseline geometry without enforcing repaired distances. This optional browser check is separate from the standard Node harness.

## Validation and status

Docker source/lab/Studio builds, typecheck, all32 art QA groups and the platform bridge test pass. No lint script exists; git diff --check passes. The full harness finishes56 passed,1 failed,0 skipped out of57. The sole failure is the existing High Orbit Cinderforge raster comparison:22 of262144 bytes differ, maximum delta28, first byte64900. This exact failure was independently reproduced on unchanged current main bafe50345707ef22f4607ef4ba2534057643a473 in the same image. See [baseline result](baseline-high-orbit.txt) and [validation](validation.json). The full gate remains nonzero.

The owner marked PR266 ready. This conflict-resolution update preserves that state; no merge or release was performed. Native iPhone validation remains outstanding.
