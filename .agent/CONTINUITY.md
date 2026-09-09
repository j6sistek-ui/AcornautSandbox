# Premium pilot trio

[PLANS]
- 2026-09-09T21:18Z [USER] Current release uses newly supplied sixteen-frame whole-body sheets for Porcelain, Nacre and Origamist. Remove shadows, repair Porcelain floating boxes, retain custom wakes and fixed heads. Supersedes cut-rig implementation and fitting-kit hold. Update PR252; do not auto merge.
- 2026-09-09T16:46Z [USER] Produce three selected concepts in AcornautSandbox and open a PR: Porcelain Paragon with Sovereign Shell (B) always worn; Nacre Envoy always helmetless; Foldspace Origamist with Facet Shell always worn. Remaining five concepts are proposal cards only; no new generation for them. Do not merge.

[DECISIONS]
- 2026-09-09T21:46Z [USER] Nacre's two tails must have equal length/fullness and cross/loosely intertwine with offset motion. Final selected master visibly interweaves them; motion is authored in complete frames, not independent procedural rigs.
- 2026-09-09T21:46Z [ASSUMPTION] The 2500 trio offer should remain available every day beside 1000 singles; correct rotating-only availability before publication.
- 2026-09-09T21:18Z [USER] Supersedes all earlier pricing: 1000 Stardust individually, 2500 for three-suit bundle. Fitting kit remains off repo for next iteration.
- 2026-09-09T21:18Z [CODE] Integration worktree tmp/premium-sheet-release starts from PR252 head07e64687 and merges current main db92f7c without rewriting history. All merge conflicts resolved; generated output will be rebuilt. Old premium-suits worktree preserved.
- 2026-09-09T16:52Z [USER] Confirmed price: 2500 Stardust each. Supersedes provisional pricing.
- 2026-09-09T16:46Z [TOOL] Isolated branch codex/premium-pilot-trio-20260909 starts at main 85f30e60b8b7568cdd911a9cf888122b47833d83. Existing zone-art checkout has unrelated work and is not modified.
- 2026-09-09T16:46Z [ASSUMPTION] Reuse High Orbit eleven-part anatomy and fixed skull scale. Bake Porcelain/Origamist shells into head art, keep Nacre bare. Origamist uses a rigid articulated folded tail. Three cosmetic Stardust bundles; provisional proposed price 2500 each pending owner response. No real-money price literals.

[PROGRESS]
- 2026-09-09T21:46Z [TOOL] All48 whole frames exported and independently reviewed. Metadata uses fixedhead180,84 and one scale percharacter. Corrected Nacre frames11/12 rear-paw emitters after4x visual measurement. Production/beta/lab/Studio builds, typecheck,32artgroups,bridge,focusedpremium/pricing and full54test harness passed. Final everyday-bundle UI change, fresh browser receipts and final full rerun remain.
- 2026-09-09T21:46Z [TOOL] Latest main83628d29 differs from db92f7c only by bounded pixel-failure reporting in two tests. Adopted and reran both tests successfully; pending merge ancestry will be completed before push. No remote writes or merge authorization.
- 2026-09-09T21:18Z [TOOL] Cleaned all three supplied sheets through image editing; all16 poses per character preserved. Export registration, transparent edge QA, runtime and Studio frame banks, pricing and final build still in progress. Earlier visual/test acceptance below does not apply to this replacement.
- 2026-09-09T16:46Z [TOOL] Docker daemon unavailable; repository-authorized existing-tool fallback selected with no host installations. Root owns new art/export/build/PR; agents own runtime integration, focused validation and proposal-only cards.
- 2026-09-09T17:19Z [CODE] Three new eleven-part masters extracted and fitted to shared High Orbit bones; runtime/save/shop fixed-head policies and included wakes implemented. ART_VER 252; sources, measured attachments, generated atlases/portraits, lab and Flight Studio updated. Five remaining concept cards reuse four original PNGs with matching hashes.

[DISCOVERIES]
- 2026-09-09T16:46Z [CODE] Existing IAP_ITEMS derives from BUNDLES; Arcflash is a fixed single-suit bundle at 1850 Stardust. Existing ownHead labels assume helmets and require specific helmetless copy for Nacre.
- 2026-09-09T17:19Z [TOOL] Chrome rejected an expired Nacre wake ellipse between emission samples; filtering expired points at paint time fixes it. Added strict radius/finite checks at 240 FPS. Green-key fringes require background-connected growth to convergence; final atlases have maximum green excess 22/10/18, with no excess above 25.
- 2026-09-09T17:19Z [TOOL] Windows harness needed file URLs for ESM dependencies/imports and existing TypeScript resolution. Existing Python with SciPy/Pillow/NumPy enabled the complete art gate without installs.

[OUTCOMES]
- 2026-09-09T17:23Z [TOOL] Opened draft PR https://github.com/j6sistek-ui/AcornautSandbox/pull/252. Published implementation commit1fae9c19bc174ec60c3325e385a7c289cdca4d59 matches remote head;149 changed files include only six new shipping art files for the selected trio. PR embeds production/browser evidence and all five existing proposal cards. Open/unmerged; inherited Arcflash gate and owner appearance review remain.
- 2026-09-09T17:19Z [TOOL] Build, full TypeScript, whitespace and platform bridge pass; all32 art groups pass; all trio render/production/beta tests pass. Full harness:49 pass,1 fail,0 skipped. Existing Arcflash exact fallback assertion fails identically at base85f30e60 (25pixels, max channel delta3; unchanged atlas/fallback/render hashes). No Arcflash art or tolerance changed. Draft PR preparation proceeds with this inherited release gate explicitly open; no merge authorized.
- 2026-09-09T17:19Z [TOOL] Actual production Shop reviewed at390x844: all three2500price cards and selected head labels/paintings visible; no console warnings/errors. Live lab reviewed on dark/light backdrops, with continuous animation after the wake repair. Browser receipts retained in design/premium-pilots.
