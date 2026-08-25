# Zone spawn planner

`zone-spawn-planner.html` — open it in a browser. No server, no network: it
declares `default-src 'none'; connect-src 'none'` and holds everything it
needs inside itself.

## What it is for

Grading which planets and which debris each zone draws from, and emitting a
patch the catalog can be updated from. It produced the pools now in
`ENVS` in `catalog.ts`.

## What it holds

One `const DATA = {…}` line, about 9.7 MB of it, carrying:

- the 70 planet and debris thumbnails, inlined as `data:` URIs, so the tool
  paints the real assets with nothing to fetch
- each zone's sky, its current pools, and how often each asset is used
- the spawn rules the game actually follows, so the preview is not a guess:
  **the bias pool is favoured 55% of the time, the other 45% is any
  contrast-safe planet, and debris always comes from the zone's own pool**
  (`pickKind` and `pickDebris` in `sim.ts`)

That DATA block is a SNAPSHOT, stamped with the commit and ART_VER it was
built from. It does not follow the repo. Adding a planet, a debris rock or
a zone means regenerating it, or the tool will be grading a roster the game
no longer has.

## Applying what it emits

The tool exports `acornaut.zone-pool-proposal.v1` — a markdown report with
a JSON patch block. Each patch carries the zone's `index`, its `name`, the
`original` pools and the `proposed` ones.

Three things are worth checking before writing any of it in, because a bias
table is silent when it is wrong: a bad index paints an asset nobody chose
and nothing complains.

1. **Match by NAME, not by index alone.** The patch's `index` is a position
   in `ENVS`; assert the name at that position agrees before touching it.
2. **Check every proposed id is in range** — planets `0..PLANET_COUNT-1`,
   debris `0..DEBRIS_COUNT-1`.
3. **Check each patch's `original` still matches the catalog.** If it does
   not, the study was graded against data that has since moved and the
   proposal needs regenerating rather than applying.

## Zones deliberately kept as-is

18 CORAL SHALLOWS · 20 PULSAR FIELD · 21 BLACKOUT ZONE · 22 AURORA CROWN ·
23 RUST BELT — neither study regraded these, and that was the call, not an
oversight: their existing pools are the ones we want. Treat them as settled
rather than pending, and leave them alone unless a later study grades them.
