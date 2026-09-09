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
   - `python3 illustrated-src/verify-art.py` (30 groups; every catalog id must have its still and banks)
   - the harness: `node illustrated-src/run-tests.mjs` (or `npm test`), which runs every `illustrated-src/test-*.mjs` with no skip list. Sixteen of them need `happy-dom` or `@napi-rs/canvas`: `npm install` at the repo root, or the runner reports them SKIPPED and fails. `test-warp` needs about four minutes.
   - `node illustrated-src/test-platform-bridge.mjs`
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

New art follows the existing shape and the tiers pick it up: a pal is a
still plus `<id>-N.png` frames and a `PAL_ANIM` count; a suit is a still
plus `asc/desc` (or `tap`, `loop`) banks registered in `art.ts`.
Owner-authorized articulated kits use their registered atlas and a portrait
rendered by the same painter. For the three premium pilots, source/master or
attachment changes require `export-premium-pilots.mjs`, the sandbox export,
then `review-premium-pilots.mjs` before the lab/Flight Studio builds and gates.
The exact order and retained source receipts are in
[`art-src/premium-pilots/README.md`](art-src/premium-pilots/README.md).
`verify-art.py` fails when a catalog id has no art, so a card can never
point at nothing. The whole `docs/art` tree is 116 MB; an app bundle
ships all of it locally, so the budget above is a web concern and the
app's concern is the 200 MB cellular download line.

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
