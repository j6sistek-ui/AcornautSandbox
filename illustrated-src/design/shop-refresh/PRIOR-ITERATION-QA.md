# Superseded Shop visual review

2026-09-09 [TOOL] These screenshots record the earlier build255 design with generated portraits on individual cards. The owner subsequently requested actual game art on individual/included cards and a custom banner/discount kit for every bundle. They are historical review evidence, **not final acceptance of the revised Shop**.

The Chrome session used `http://127.0.0.1:8774/` at verified CSS viewport 390 × 844 and DPR approximately 1. A fresh origin received the engine's existing +5 daily claim on entry. The Shop still showed 0 acorns, 5 Stardust and no owned premium items throughout the review. No purchase, equip, currency reset, launch or progress action was performed. Chrome's temporary viewport override was reset and the task-owned tab was closed when the owner changed direction.

Completed observations:

- Production Shop, the 1,000 single cards, all four Stardust offers, and the 2,500 trio were visually inspected.
- The trio opened to all three included cards. Porcelain detail showed Sovereign Shell always on; Nacre detail showed its bare head and two tails. Escape returned from Porcelain detail to its included card with focus restored.
- The first off-screen-to-visible trio capture briefly showed a blank hero despite a decoded image. The next interaction showed the image, and the final rebuild/reload reproduced correct visible artwork. The retained `production-offers-390.png` is the successful capture.
- No console warnings/errors were returned by the one log check before the final rebuild. One Chrome screenshot capture and one optional DOM measurement timed out; the subsequent normal screenshots succeeded.

Not completed before the direction changed: Origamist detail, full keyboard cycle, beta route, 320/wide layout, older bundle fixtures, final runtime preservation comparison or live/native store behavior. No fixture page was created. Pricing arithmetic and transaction tests are separate evidence; the browser review made no purchases.

Images retain their original viewport contents. They are listed here so they cannot be mistaken for screenshots of the revised design:

- `production-shop-390.png`
- `production-offers-390.png`
- `production-trio-included-390.png`
- `production-porcelain-detail-390.png`
- `production-nacre-detail-390.png`
