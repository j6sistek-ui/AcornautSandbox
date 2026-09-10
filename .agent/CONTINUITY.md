# Shop visual refresh

[PLANS]
- 2026-09-09T22:25Z [USER] Enhance the entire Shop after pushing the new characters: harmonize all bundles, small suit marketing cards, Stardust packs/buttons and visual review flow. Use the supplied violet/gold examples, short titles and prices rather than long card copy. Keep all prices/ownership/gameplay unchanged; always PR, never auto merge.

[DECISIONS]
- 2026-09-09T23:00Z [USER] Supersedes20kit registry: no single item is a bundle. Require at least3 distinct products (shared IDs/free wakes cannot inflate count). Keep5existing real packs; replace6companion singletons with2three-pal packs and3visor singletons with1three-visor pack, each200Stardust(retail270, editable70discount). RetireRobo/Cyberduos into existingCircuit; fourfixedsuits stayindividual1850/1000. Preserve35ownershipIDs andbeta12360funding. Only8groupbanners ship; singledraftart archived ignored.
- 2026-09-09T22:50Z [USER] Supersedes generated single-item portraits and proportional ownership pricing: only bundle banners use marketing renders. Every bundle requires a kit with its own banner and editable discount, visible savings, short exterior title/price, and actual contents in popup. Singles and included item cards use the actual game art. Prior individual purchases get full value credit; trio due2500/1500/500 as0/1/2 pilots owned. Zero remainder is an explicit claim, no negative wallet refund. Original unowned Shop prices preserved.
- 2026-09-09T22:25Z [USER] Owner reports character PR252 merged. Verified closed/merged at d296e6bc404aaec14221a8b79186132fb4426dea, with tested head1aec8e5. Shop worktree fast-forwarded to that main; new PR will target main.
- 2026-09-09T22:25Z [CODE] Worktree tmp/shop-visual-refresh, branch codex/shop-visual-refresh-20260909. Preserve character-release worktree and off-repo fitting kit. Existing Node dependencies are a junction; Docker unavailable, authorized existing-tool fallback, no installations.

[PROGRESS]
- 2026-09-09T23:30Z [TOOL] Post-guard full56 tests passed. Main advanced to95aefc52 through owner-merged Loadout PR255; integrating locally and rebuilding above both stamps as257. Source runtime/exporter merged cleanly; regenerated outputs resolve cache-stamp conflicts. No Shop merge or publication yet.
- 2026-09-09T23:24Z [TOOL] Final eight-bundle implementation and ten exported graphics complete. All56tests passed before final signature-wake validation guard; post-guard build/lab/Studio/typecheck/bridge/32artgroups pass and full56rerun is active. Read-only final source review reports no blockers. Actual390px Shop/trio/threepilot and320px Regalia screenshots reviewed; remaining bundle/beta browser receipts underway.
- 2026-09-09T22:38Z [TOOL] Six marketing masters/exported assets complete (3.53 MiB); exact prompts and hashes retained. Shared Shop UI implemented; production/beta/lab/Studio build255 and typecheck/bridge pass. Baseline snapshots cover20bundles/450ownership cases/1606art. Focused tests and Chrome QA ongoing; art gate needs unused UI-class cleanup before final rerun.
- 2026-09-09T22:25Z [TOOL] Three new marketing portraits generated and saved under art-src/premium-marketing with exact prompts. Early scoped premium-card implementation preserved at outputs/shop-enhancement/marketing-ui.patch; root owns art/build/PR, UI agent will expand to all Shop products.

[DISCOVERIES]
- 2026-09-09T23:24Z [CODE] Minimum-product validation now excludes shared IDs, free set trails and built-in signature wakes; listing a built-in wake as a chargeable bundle product throws. All1606 baseline shipping images and35 product ownership IDs are preserved; three new3product collections cost200 each. Beta funding remains12360. No Shop PR yet.
- 2026-09-09T22:25Z [TOOL] Character release passed54 tests,32 art groups and final focused/browser checks. All1606 current shipping art files form the preservation baseline for this Shop-only follow-up. Marketing assets must not replace runtime suits/flight sheets.

[OUTCOMES]
- 2026-09-09T23:36Z [TOOL] Shop implementation verified at8497029/build257 with current main95aefc52 integrated: full56pass/0fail/0skip,32artgroups,typecheck,bridge,lab/Studio and mobile/beta browser receipts. All1606baseline art/35ownershipIDs preserved;8real bundles with full-credit pricing and actual individual previews. Source frozen; final evidence/Shop PR publication follows. No merge authorized.
- 2026-09-09T22:25Z [TOOL] PR252 merged; Shop refresh remains in progress and unverified. No Shop PR or merge yet.

[OUTCOMES]
- 2026-09-10T05:55Z [CODE] Issue #265 candidate adds 8px Shop heading clearance and10px Stardust card separation in two CSS rules; stamp264. Production/beta browser geometry at390/320 passes. Docker builds/typecheck/32 art groups/bridge pass; full harness 55/56 with one known unchanged-base High Orbit raster failure and no skips. Candidate remains unpublished until shipping gate is resolved; evidence in illustrated-src/design/shop-spacing.
- 2026-09-10T06:15Z [USER] Supersedes publication hold above: prepare a draft PR for review with the known baseline test failure disclosed. Runtime checks bind to 53cdbca4606013a1509607dae9360a52122274cd; this follow-up updates documentation only. No merge or release authorized.
- 2026-09-10T06:25:52.128Z [TOOL] Integrated main daad832 and rebuilt stamp266. Runtime 5943d7011da109bc21f39675ca89043d7e7e0042 passes builds/typecheck/32 art groups/bridge and production/beta Shop geometry at390/320. Harness55/56, one identical failure reproduced on unchanged daad832. Final receipt updates review files only and restores unrelated test-generated premium review images. Draft publication authorized; no merge or release.
