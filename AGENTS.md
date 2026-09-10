# Repository checks

## Shop bundle rule

Every `BUNDLES` entry must contain at least three distinct products. Shared
suit/helmet IDs and free wakes do not inflate that count. Single products
belong on the individual shelf, never in the bundle registry.
Every bundle must have a complete kit: a dedicated banner at
`docs/art/shop/<bundle-id>.png`, its source master and creation brief, and
an editable `kit.discountDust` in `game/catalog.ts`. A new bundle without
these assets and pricing is incomplete. Run the standard exporter and the
bundle-kit/Shop checks before creating the PR.

Bundle exteriors show the banner, short name, current price and actual
bundle savings. Put included products and concise bonus counts in the
contents popup. Individual item cards and item previews use actual game
art and painters; generated marketing artwork belongs to bundle banners.

Daily individual stock is selected by `game/shop-cycle.ts`: two suits
(one available fixed-price premium and one cheaper suit, or up to two
cheaper suits when premiums are exhausted), plus two gear slots: a helmet
and PAL, or two helmets. When suit stock is scarce, up to two helmets and
one PAL can fill spare slots; exhausted stock can leave fewer than four.
Use one horizontal row without category filters or a vertical gear rail.
Prefer compatible/coordinated accessories, and never
duplicate a shared suit/helmet ownership ID across cards. The login suits
`raccoon`, `ferret` and `hedgehog`, and their Critter Pack, are excluded from
paid daily offers; their catalog entries and login grants remain intact.
Use date/ownership fixtures in tests rather than assuming all premium
singles are pinned every day. Run `test-shop-cycle.mjs` with the Shop gates.

Use `bundleQuote` for both display and checkout. Credit the full individual
retail already owned, count shared IDs and free wakes once, and clamp the
remaining charge at zero. A zero-cost remainder still requires an explicit
claim; it never creates a currency refund. See
`illustrated-src/design/shop-refresh/PRICING.md` for configuration and tests.

## Build workflow

Use the container workflow by default; do not install system packages on the host.

```sh
docker build -t acornaut-checks .
docker run --rm acornaut-checks
```

The image runs the source export, lab build, typecheck, art gate, complete test
harness and platform bridge check. Keep `.git` in the build context because
historical art regressions read pinned revisions with `git archive`.

When Docker is unavailable, record that limitation and use workspace-local
Node dependencies and an available Python with Pillow/NumPy; no host system
package installation is needed. `ACORNAUT_TSC`, `ACORNAUT_CANVAS` and
`ACORNAUT_HAPPY_DOM` may point to existing package entry files. Read
`SHIPPING.md` for the complete required workflow. There is no lint script;
use typecheck and `git diff --check` alongside the tests.

Flight Studio is a separately launched offline tool under `tools/flight-studio`.
Edit its UI/runtime in `illustrated-src/flight-studio`, then run
`node illustrated-src/build-flight-studio.mjs`. Commit its generated modules
and manifest so the launcher requires only existing Node, with no install or
network. Game painters are generated from source, never edited in the tool.
`node illustrated-src/test-flight-studio.mjs` verifies the standalone runtime,
exports, all model assets and read-only host. The Docker workflow already runs
every test file; use the same documented fallback when Docker is unavailable.

## Scope checklist — post it in chat, every time

Seven tests carry 437 of the harness's 593 seconds. You may skip them with
`node illustrated-src/run-tests.mjs --skip-heavy` when your change cannot
reach what they guard. SHIPPING.md gate 3 says what each one protects, in
plain words; judge by reach, not filename.

The skip is allowed. **Hiding it is not.** When you tell the owner a branch
is ready, paste this in the chat message — not only in the PR body:

```
SCOPE
  changed  <what you touched, in a few words>
  skipped  <heavy tests left out> — <why they cannot be reached>
  ran      tsc · verify-art · platform bridge · <n> tests, <n> passed
```

If you ran everything, say so and the second line reads `skipped  none`.

Two things the owner treats as suspect on sight:

- **A merge recommendation with no checklist.** If nobody says what was
  skipped, assume everything was.
- **A PR merged without being asked.** Ask, and wait. The only exception is
  an explicit instruction for that specific change.

Owner, 10 Sep 2026: "This isn't a government job.. if it ships and breaks,
we will eventually fix and find it." A missed check is recoverable. An
unreported one is not, because nobody knows where to look.
