# Browser review receipt

Reviewed 2026-09-09, completed 22:17 UTC, using Chrome against
`http://127.0.0.1:8773/` and `/lab/premium-pilots/`, art version 254.

**Scope:** the final replacement Nacre flight artwork and the store presentation
present at capture time. The owner subsequently requested pushing this verified character update first,
then implementing new store marketing art, compact cards and an included-item
review flow in a separate Shop enhancement. These screenshots verify the
character-release presentation; that forthcoming change needs its own review.

## Artwork and motion

- Nacre cleaned-master SHA-256:
  `94fe02913c52cfd4f589cab064e83986bdd924f752c05619f494b6b0d403fe9f`.
  Flight-atlas SHA-256:
  `ee3dc1286ece3aebd99e20bc4684dfc6f4e6bb481bccf26f844d31ec3e500ce4`.
- Observed all sixteen frame labels advancing automatically under both Normal
  and Quarter speed, with repeated taps enabled. Two distinct tail roots remain
  visible; both tails sweep, briefly braid, then separate during recovery.
  No detached anatomy, clipped silhouette or added helmet was observed.
- Running lab poses displayed the three custom wakes. Seeking directly to
  frame 8 cleared the previous long trail; no stale trail from the old pose
  remained. Paused frame captures keep Wakes enabled, but the fresh seek state
  has a much shorter wake than an established running state.
- Inspected frame 8 at Enlarged (192) and Game size (52) against light and dark
  backdrops. The three silhouettes and fixed heads remain distinguishable;
  the fine braid/ornament detail is primarily visible when enlarged.
- The automation session's displayed animation clock advanced slower than wall
  time. This review verifies frame progression and appearance, not foreground
  frame rate or real-time cadence. Chrome reported no warning/error logs for
  either the Shop or lab.

## Store and state

The actual Shop CSS viewport measured 390 × 844. Each single suit showed 1,000
Stardust and its correct fixed-head label. The permanent trio offer showed
2,500, a crossed-out 3,000, 17% off, and three items. The initially cramped
mobile card was corrected and recaptured with portraits above readable text.

No purchase, equip action or flight occurred. The temporary preview cart was
cleared. The final session began and ended with 0 acorns, 5 Stardust, no selected
cart items and 0/35 premium items owned. The 5 Stardust came from the app's
automatic daily reward on this fresh localhost origin during an earlier review.
All review tabs were closed and the temporary viewport override was reset.

## Captures

All captures used `fullPage:false`, with no post-capture stitching, cropping,
resizing or annotations. Chrome returned JPEG bytes; these were decoded and
stored as PNG without further lossy compression. Native JPEG copies remain
outside the shipping tree in `.agent/native-browser-receipts/`.

- `nacre-shop-390.png`: final replacement Nacre, helmetless label and 1,000 price.
- `porcelain-shop-390.png`, `origamist-shop-390.png`: unchanged permanent helmets
  and individual prices from the preceding review.
- `trio-shop-390.png`: corrected permanent 2,500 offer, before the newly requested
  marketing-card redesign.
- `browser-frame8-dark.png`, `browser-frame8-light.png`: all three final frame-8
  paintings, Enlarged scale. Lab CSS viewport measured 1186 × 723; the browser
  capture API returned 1171 × 714 pixels, which were retained unchanged.
- `browser-game52-dark.png`, `browser-game52-light.png`: all three at the 52px
  game display setting.
