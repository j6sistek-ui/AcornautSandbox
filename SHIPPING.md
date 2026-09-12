# Shipping Acornaut

How a change gets from `illustrated-src/` to the live page, the beta, and
an App Store (or Steam) build without any of them drifting. Every PR
follows this, human or agent authored. It is short on purpose; the checks
it names are mechanical, so following it costs a few minutes and skipping
it costs a release.

## 1. The map

| Layer | File(s) | Owns | Never contains |
|---|---|---|---|
| Catalog | `game/catalog.ts` | every id the game knows: suits, helmets, pals, trails, bundles, dust packs, shelves, `ART_VER`, `GAME_VERSION` | behaviour |
| Rewards | `game/campaign.ts` | the Star Chart, `STAR_REWARDS`, `STAR_UNLOCKS` | UI |
| Save | `game/save.ts` | the save shape, defaults, sanitizing, unlock gates (`*Unlocked`, `*Revealed`) | storage calls (goes through the bridge) |
| Simulation | `game/sim.ts` | the world, spawning, physics, pal effects (`PAL_FX`, `hasPal`), run end | DOM, art loading |
| Painter | `game/draw.ts` | everything drawn to the canvas | game rules |
| Art | `game/art.ts` | which files load, when (eager tiers, idle sweep, `LAZY_SUIT_IDS`, pal banks) | rules about who owns what |
| Engine | `game/engine.ts` | the public API the screens call: equip, buy, fly, settings, receipts | pixels |
| Screens | `game/standalone.ts` | every menu and sheet, built from `engine` | rules (asks `engine`/`save`, never decides) |
| Bridge | `game/platform.ts` | the ONLY door out of the bundle: storage, real money, boards, dev doors | game imports |
| Page | `docs/index.html` | hand-written CSS and the boot shell | anything that belongs in a `.ts` file |

`docs/js*` is generated. `docs/beta/index.html` is generated from
`docs/index.html`. Edit sources, never outputs.

## 2. The platform bridge

`platform.ts` imports nothing and exports one object, `platform`. The
web answers with `localStorage`, "store unavailable" and "no boards". A
shell (Capacitor on iOS, a Steam shell later) sets
`window.__acornautPlatform` **before** the bundle loads and the bridge
adopts whatever members it provides:

```ts
window.__acornautPlatform = {
  kind: "ios",
  storage: { get, set, remove },        // durable, preloaded, synchronous
  store:   { priceOf, buy, restore, pending },   // StoreKit behind it; buy resolves { result, transactionId }
                                        // pending() lists every consumable on record, as game ids
  boards:  { submit, show },            // Game Center behind it
  devDoors: false,
};
```

Rules, enforced by `illustrated-src/test-platform-bridge.mjs`:

- No `localStorage`, `fetch`, price strings or SDK imports anywhere in
  `game/*.ts` except the files that own them. A feature that needs one
  adds a member to the bridge, with a web fallback, in the same PR.
- The game grants currency; the shell only reports that money changed
  hands. `engine.buyDust` is the one place a receipt becomes dust.
- One receipt, one grant. Every transaction id goes through
  `takeReceipt` in `save.ts` (`save.receipts`), so the purchase promise,
  the pending list on resume and Restore Purchases can all hand the game
  the same transaction and it pays once. A purchase that throws is a
  failed purchase the shop reports, never a stuck row.
- A score is posted from `sim.ts` at run end through
  `platform.submitScore`; boards are read in the platform's own UI via
  `platform.showBoards`. The game never renders another player's score
  itself until there is a backend that vouches for it.
- `SAVE_KEY` never changes. A storage move is a migration inside the
  bridge, not a new key.

Adding a member is cheap. Reaching around the bridge is what makes a
later shell expensive, so the test fails the build instead.

## 3. The ritual for every change

1. Edit under `illustrated-src/`. If art or catalog ids changed, bump
   `ART_VER` in `catalog.ts` (one stamp per PR; when merging main, restamp
   above both sides).
2. `node illustrated-src/export-sandbox.mjs` then
   `node illustrated-src/build-lab.mjs`.
3. Gate, all four, before pushing:
   - `npx tsc illustrated-src/game/*.ts illustrated-src/lab/rig.ts --noEmit --module es2015 --target es2020 --skipLibCheck --moduleResolution bundler --strict false`
   - `python3 illustrated-src/verify-art.py` (32 groups; every catalog id must have its still and banks)
   - the harness: `node illustrated-src/run-tests.mjs` (or `npm test`), which runs every `illustrated-src/test-*.mjs` with no skip list. Sixteen of them need `happy-dom` or `@napi-rs/canvas`: `npm install` at the repo root, or the runner reports them SKIPPED and fails.
   - `node illustrated-src/test-platform-bridge.mjs`

   **Seven tests are optional, and you decide up front.** They cost 437 of
   the harness's 593 seconds. Each one guards a specific thing that has
   broken before. Read what it protects; if your change could touch that,
   run it. Otherwise skip it with `--skip-heavy`.

   **`test-warp`** · 159s · *No black hole inside a black hole.* Catching a
   hole opens a stretch, and a hole met while already inside one is scenery
   that looks exactly like the way out. The roll must be off for the whole
   stretch. It broke once because Free Flight counts GATES and every other
   mode counts SECONDS, and the guard only read the counter. Slow because it
   re-flies levels to build a real sample. **Run it if you touched hole or
   warp spawning, gate counting, or level/mode timing.**

   **`test-tunnel`** · 54s · *The Wormhole Run stays flyable.* Tap floor,
   freeze, save, loadout and resize across three seeds, in a spawned
   sandbox. **Run it if you touched the Wormhole Run, the tap floor, or
   run-state save/resume.**

   **`test-star-map-ui`** · 53s · *The Star Chart menus still navigate.*
   Real menu and engine events, zone families, bounded canvases, engine
   access and progression. **Run it if you touched the chart, its rewards,
   zone visuals, or progression unlocks.**

   **`test-vanguard-flight`** · 50s · *AcorNut flies right.* Real canvas
   with real art, no simulated screenshots. **Run it if you touched
   AcorNut's painter, the sim, or his art.**

   **`test-vanguard-render`** · 47s · *AcorNut draws right.* Rapid taps,
   shallow gravity, full swipe, retained dust, crisp opaque poses, A/B
   physics equality across 204 comparison frames. **Run it if you touched
   his painter, the dust, or his art.**

   **`test-shop-visuals`** · 38s · *The Shop shows real product art.* Every
   bundle has a distinct kit banner, item cards use actual game painters,
   the rotation and animated previews hold. **Run it if you touched the
   Shop, bundles, prices, or shop art.**

   **`test-helmet-animation`** · 36s · *Helmets still fit.* Glass and
   fitting compared against a pinned pre-repair revision, so a helmet
   cannot silently drift off a head. **Run it if you touched helmets, heads,
   visors, or the suits they sit on.**

   Judge by REACH, not filename. An `ART_VER` bump touches `catalog.ts` and
   reaches none of these. A menu string touches `standalone.ts` and reaches
   none of these. When genuinely unsure, run it.

   This is deliberately not airtight. Owner, 10 Sep 2026: "if it ships and
   breaks, we will eventually fix and find it. Not the end of the world if
   they miss a check." What is NOT optional is saying which way you called
   it - see the scope checklist in AGENTS.md.

4. Prove it in the browser once, at 390 wide, on the page it changes
   (production or beta). Screens that changed get a screenshot in the PR.
5. PR body: what, why (quote the owner's ask), verified. No model names.

## 4. Art and load budget

Measured on production at stamp 222, 390x844, cold cache:

| Moment | Requests | Transfer |
|---|---:|---:|
| Title screen visible (about 4 s) | 87 | 3.4 MB |
| Idle sweep settled (about 20 s) | 220 | 13.5 MB |

The tiers that keep it there:

- **Boot**: the pilot, pickups, the equipped suit and pals, one sky.
- **Idle sweep**: suit flight banks and helmets, in shelf order, only
  after the title is up. `LAZY_SUIT_IDS` decides what waits.
- **On demand**: a pal's animation bank loads when it is equipped or
  tried on (`loadPalBank`); a suit's bank jumps the queue when equipped
  (`wantSuitArt`).

At art stamp 252, zone planets also load on demand through `loadZoneArt`.
Boot loads Deep Space's five planets; flight and visible Star Chart nodes
request their zone's five planets and two or three debris sprites. The
27 legacy debris sprites remain available for standalone special modes.
The expanded catalog has 134 planet IDs (130 assigned) and 55 debris IDs.
See the [zone production pipeline](art-src/zone-identity/README.md) for
master provenance, deterministic export and the exact exclusive rosters.

Arcflash's loading portrait is also a generated output. The source export
runs `export-arcflash-portrait.mjs` after compiling the live rig, so the
256px fallback stays pixel-identical to the renderer used by that build.

New art follows the existing shape and the tiers pick it up: a pal is a
still plus `<id>-N.png` frames and a `PAL_ANIM` count; a suit is a still
plus `asc/desc` (or `tap`, `loop`) banks registered in `art.ts`.
Owner-authorized articulated kits use their registered atlas and a portrait
rendered by the same painter. Percy, Envoy and Patriot use nine ascent and
nine descent paintings following Cyber's gold-standard poses and controller.
Their sandbox export runs `export-cyber-trio.mjs` to key and register complete
frames, generate head/wake geometry, retain ascent frame one as the fallback,
and split its reviewed still body/tail mask. Both legacy premium exporters
redirect to this entry point.
Rebuild the lab and Flight Studio, then run the full gates and inspect every
cleaned frame and its playback; old cut-rig receipts cannot validate this route.
The production boundaries and retained source receipts are in
[`art-src/cyber-standard-trio/README.md`](art-src/cyber-standard-trio/README.md).
Every Shop bundle requires a dedicated banner and editable kit discount.
`export-shop-art.mjs` runs after compilation, validates the current kit
registry, and exports all eight banners plus the Stardust emblem and backdrop
under `docs/art/shop`. The Shop requests banners for its current offers; individual
cards retain actual runtime assets. Missing banners or invalid discounts
fail the build. Keep source masters, exact briefs and export hashes in
[`art-src/premium-marketing/README.md`](art-src/premium-marketing/README.md).
The [kit pricing rule](illustrated-src/design/shop-refresh/PRICING.md) explains
full individual ownership credit and explicit zero-cost bundle completion.
`verify-art.py` fails when a catalog id has no art, so a card can never
point at nothing. At art stamp 257, `docs/art` totals 149.9 MiB, including
9.59 MiB of Shop graphics. An app bundle ships this art locally; the
historical transfer measurements above describe web loading, not the
current packaged app size.

## 5. Store builds

What a store build changes, and where:

| Concern | Where it lives | Web | App |
|---|---|---|---|
| Save storage | `platform.storage` | localStorage | shell's durable store, preloaded |
| Dust packs | `platform.store` | beta grants, live refuses | StoreKit, prices from the store, Restore Purchases shown |
| Boards | `platform.boards` | local bests only | Game Center: all-time, monthly, friends |
| Prototype doors | `platform.devDoors` | Help sheet | hidden |
| Build line | `BUILD` | "Alpha V1.0.x" | "V1.0.x" |
| Fonts | `docs/fonts/` | local | local |
| Network | none required | | none allowed (review runs offline) |

The shell itself lives in `shell/` (Capacitor, iOS and Android). Its
README is the slow walkthrough for the Apple, Google Play and RevenueCat
accounts; `shell/app.config.json` is the one file that takes the values
they issue, and `npm run configure` stamps them into the native projects.

Release checklist for an app update:

1. `GAME_VERSION` bumped; the marketing version and build number in the
   shell match it.
2. All four gates green on the exact commit being wrapped.
3. Fresh-install run on a device: tutorial, a purchase in the sandbox
   store, Restore Purchases, a board submit, kill and relaunch with the
   save intact, airplane mode boot.
4. Screenshots refreshed if a screen the store shows has changed.

## 6. What is deliberately not here

No coding-style rules, no branching rules beyond "one PR, one stamp, gates
green". The code's comments carry the reasoning for each decision at the
place it is made; this document only says how a change moves.
