# CrazyGames release plan

Owner, 13 Sep 2026: "publish to crazy games." This is the audit of the web
build against CrazyGames' published requirements, what the shell PR of the
same day added, and the ordered list of what is left before the upload.
Source of the rules: docs.crazygames.com (requirements/technical, /ads,
/gameplay, /quality, /game-covers; sdk/intro, /video-ads, /game, /data,
/user; resources/basic-launch-metrics), read 13 Sep 2026.

## How the portal works

- The game is **uploaded as a zip** with `index.html` at the root; the
  portal hosts it in an iframe on crazygames.com and in its apps. There is
  no hosted-URL option for a new HTML5 game.
- **Basic Launch** first: the game goes live with only the SDK's gameplay
  events and no ads, for 7 to 21 days and at least 500 plays. The portal
  measures average play time (target 10+ min), day-1 retention (10 to 15 %)
  and conversion (80 % of players still there after one minute).
- **Full Launch** after that: ads through the SDK, the data module for the
  save, the user module if used, full visual QA. Revenue is ad-share only.
  Technical support from the portal opens at 50,000 combined plays.

## Audit: requirement by requirement

Measured on the production page at stamp 290 (Playwright against a local
copy of `docs/`, 390 x 760, cold cache).

| Rule | Limit | Acornaut today | Status |
|---|---|---|---|
| Total upload size | 250 MB | 162 MB built, 159 MB zipped | pass |
| File count | 1,500 files | **1,875** (`art/suits` 730, `art/solo` 546, `art/planets` 134, js 56, the rest) | **over** |
| Initial download | 50 MB (20 MB for the mobile homepage) | 13.8 MB to the title, 22.6 MB by the first run | pass |
| Requests before the title | none stated | 289 requests | risk (cold CDN) |
| Load time | under 10 s | 15 s on the single-threaded local server; unmeasured on the portal | verify |
| External requests | none except the SDK | none: fonts self-hosted, one same-origin fetch (`spill-ship/transforms.json`) | pass |
| Land in gameplay | at most 1 click | title → LAUNCH is 1 click; Debris Field then shows its instructions card and the opening Depot before wave 1 | decision, see below |
| Custom fullscreen button | forbidden | none | pass |
| External links / cross-promotion | forbidden | Discord, X and mail rows on the Pilot screen | fixed: hidden when the bridge says `links: false` |
| Ads | SDK only; mute game audio during an ad; no reward on `adError`; ad-blocker users play normally; rewarded button never on an active gameplay screen; skip and watch buttons equal in size | AdMob adapter exists for the app only; the portal build gets the SDK adapter (this PR); the crash sheet and the shop are not gameplay screens | pass with the adapter |
| Midgame ad cadence | SDK enforces 1 per 3 min; never during play | the interstitial only plays at the crash sheet's exit, every 3rd crash, 120 s gap, after 5 runs | pass |
| Save data | data module, 1 MB per player, copy old localStorage keys once | save goes through `platform.storage`; the adapter maps it to `SDK.data` and migrates `acornaut*` keys | pass |
| Gameplay events | `gameplayStart` on launch, resume, revive; `gameplayStop` on pause, crash, leaving a run | added to the bridge and the engine (this PR) | pass |
| Loading events | `loadingStart` / `loadingStop` around the bundle | adapter | pass |
| Portal mute switch | honour `settings.muteAudio` | adapter listens; the engine's `muteAll` sits over the pilot's own switches | pass |
| Content | PEGI 12, English, original name and assets | cartoon squirrel, English, original | pass |
| Legibility | readable at devicePixelRatio 1 | designed for phones at DPR 2 and 3; needs a desktop pass | verify |
| Chromebook | smooth on 4 GB RAM | unmeasured | verify |
| Desktop landscape | playable in 16:9; portrait games allowed with side bars | the page runs in a wide window today (wide film, letterboxed play) | verify in the preview tool |
| Keyboard | avoid Escape and Ctrl+W for critical actions; AZERTY | Escape pauses and backs out, nothing critical; taps are Space / Up | pass |
| Text selection | `user-select: none` with prefixes | present in `docs/index.html` | pass |
| Page scroll / arrow keys / context menu | must not leak to the page | `portalFixes()` in the adapter | pass |
| Covers | 1920x1080, 800x1200, 800x800; title text only, no borders or badges | none produced | **to do** |
| Preview video | 15 to 20 s, no audio, landscape 1080p and portrait 2:3 both mandatory, static cover as first frame | none produced | **to do** |
| Metadata | description and controls text | draft below | to do |

### The one design decision: what the first click lands in

CrazyGames' reviewers want the first tap to be gameplay. Today the LAUNCH
tile is that one click, but Debris Field then opens its instructions card,
and START RUN docks at the opening Depot for one free upgrade before wave 1.
That is three taps before the first piece of debris moves. Options, for the
owner to pick (none applied):

1. **Portal-only shortcut.** When the bridge names a default mode, LAUNCH
   goes straight to the countdown; the instructions card stays one tap away
   on `?` and the free upgrade is offered at the wave-5 Depot instead. One
   `if (platform.defaultMode)` in `spillTap` / the ready phase.
2. **In-flight lessons.** Replace the card with wave-1-to-3 prompts for
   everyone (the 3D scope's own tutorial rule, see
   `DEBRIS_FIELD_DIRECTION.md`, idea R). Bigger, benefits the app too.
3. Leave it. Risk a "gameplay first" note from QA.

Recommendation: 1 for the portal launch, 2 as the first realignment PR.

## What the shell PR added (13 Sep 2026)

- `illustrated-src/game/platform.ts`: adapter members `gameplay`
  (`start`, `stop`, `happy`), `links`, `defaultMode`, `listen(hooks)`; the
  ads calls take a `started` callback so the game mutes on `adStarted`, not
  on request. Platform gains `gameplayStart/Stop`, `celebrate`, `links`,
  `defaultMode`, `attach`.
- `engine.ts`: gameplay start on `fly`, `flyLevel`, `spillResume`,
  `resume`, `continueRun`, an earned ad continue; stop on `pause`, a crash,
  `spillSuspend` and every `open()` that leaves a run. `muteAll` wraps each
  ad. `sim.ts` celebrates a finished mission and a new personal best.
- `standalone.ts`: the title opens on `platform.defaultMode` when a shell
  names one; the Community rows (Discord, X, mail) render only when
  `platform.links` is true.
- `shell/crazygames/adapter.js`: the SDK adapter (storage, ads, gameplay,
  mute, loading, migration, common fixes). Plain ES module, no bundler.
- `shell/build-crazygames.mjs` (`npm run crazygames` in `shell/`): builds
  `shell/crazygames-dist/` from `docs/` (no beta, lab, CNAME, privacy page
  or old stamps), inserts the SDK script tag, removes the PWA manifest
  link, routes the page through the adapter, prints the budget against the
  limits and zips `shell/acornaut-crazygames.zip`. Exit code 2 while any
  budget is over.
- `illustrated-src/test-crazygames.mjs`: the adapter against a fake SDK
  (init, migration, rewarded earned / dismissed / error, midgame, adblock,
  mute settings, gameplay events) and the engine's gameplay events through
  the real screens.

## Ordered work list

**P0, blocks the upload**

1. **File count: 1,875 → under 1,500.** The two frame banks are the whole
   problem: `art/suits` (730 files, 34 suits) and `art/solo` (546 files, 34
   x 16 solo poses). Pack each suit's frames into one sheet plus a JSON
   index in the exporter and teach `art.ts` to slice it (it already slices
   the Arcflash and High Orbit atlases and the 4x4 solo sheets). Target:
   about 70 files for both banks. Gameplay-neutral, one PR, and the same
   sheets cut the app's boot requests.
2. **Covers and video.** Three stills and two 15 to 20 s silent captures
   (landscape 1080p, portrait 2:3), first frame equal to the still. The
   shop marketing renders and `menu-splash.jpg` are the starting material.
3. **Preview-tool QA pass.** Upload to developer.crazygames.com, run the
   game in the portal's preview at 16:9 desktop, DPR 1, and in the mobile
   frame: load time, legibility, touch, keyboard, the ad demo (local mode
   shows demo ads), save round-trip, adblock on.
4. **The first-click decision** above.

**P1, before Full Launch**

5. **Fewer boot requests.** 289 files before the title. Fold `art/ui`,
   `pickups`, `acorn`, `golden`, `shield` into one or two sheets; load the
   equipped suit only. Aim under 60 requests and 10 MB to the title.
6. **The launch film on desktop.** `intro-wide.mp4` is 13.8 MB and preloads
   on the first tap in a landscape window. On the portal (desktop
   landscape, many players on Chromebooks) default `introOff` on via the
   bridge, or stream a 3 MB cut.
7. **Leaderboards.** CrazyGames has a leaderboard SDK; map it onto the
   bridge's `boards` member so Debris Field's best wave posts.
8. **Metadata text.** Description: "Fly a squirrel through a broken acorn
   mining rig. Survive waves of debris, salvage Ore, and build your ship at
   the Depot every five waves." Controls: "Tap, click or Space to thrust.
   Swipe or Down to dive. Swipe right or D to lunge."

**P2, later**

9. User module: greet a logged-in player by username; nothing gated on it.
10. Banner on the Depot screen only if the numbers say so (5 s minimum on
    screen, at most 2, never during play).

## Upload steps

```
cd shell && npm install && npm run crazygames
# shell/acornaut-crazygames.zip, budget printed; exit 2 while over budget
```

1. developer.crazygames.com → Games → Add game → upload the zip.
2. Fill the description, controls, category (arcade / survival), covers
   and video.
3. Preview tool: play a full Debris Field block to the wave-5 Depot on
   desktop and on the mobile frame; watch the console for 404s.
4. Submit for Basic Launch. Watch the three metrics for a week.
5. Full Launch: ads go live through the SDK (no code change: the adapter
   already asks for them; Basic Launch answers `adsDisabledBasicLaunch`
   and the game shows nothing).

## Not in scope here

The App Store shell, its AdMob ids and TestFlight (`PACKAGING_PLAN.md`)
are untouched. The web page at acornaut.app keeps its links, its NORMAL
default and no ads; only the portal build hands in the adapter.
