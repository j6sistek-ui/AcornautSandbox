# Premium pilot production sources

The owner selected exactly three concepts for production on 9 September 2026,
then confirmed **2,500 Stardust per complete cosmetic kit**. These are fixed
single-suit bundles with their own included wakes; no real-money price is
encoded here.

| Runtime id | Character | Required head treatment | Included wake |
| --- | --- | --- | --- |
| `porcelain` | Porcelain Paragon | Sovereign Shell, concept helmet B; always worn | Cobalt Filigree |
| `nacre` | Nacre Envoy | Helmetless by design; no helmet or glass overlay | Pearl Tide |
| `origamist` | Foldspace Origamist | Facet Shell; always worn | Foldspace Ribbon |

Nocturne Atelier, Calibre Meridian, Wayfarer Atlas, Velvet Navigator and
Rivet & Ribbon remain [proposal cards](../../illustrated-src/design/premium-pilots/proposals/README.md)
only. No new production art is authored for those five.

## Retained inputs and deterministic outputs

- `references/` preserves the original concept boards. Alternative helmets
  and the other characters on the shared bonus board are historical context;
  the table above is the production selection.
- `*-PROMPT.md` records each cut-master generation brief. The raw
  `*-parts-master.png` files retain the 1086×1448 chroma-green source paintings,
  before extraction, resampling or registration marks. Retaining them permits
  an extraction correction without regenerating character art.
- `attachments.json` holds the authored source-space joint endpoints and head
  centers. These measurements are retained separately from generated packing
  coordinates so the rig can be rebuilt and its attachment choices reviewed.
- `registration.json` records each master hash, component bounds, packing
  scales, source joints and complete head circle. `atlas-hashes.json` and
  `shipping-hashes.json` record atlas and final portrait bytes respectively.

`illustrated-src/export-premium-pilots.mjs` removes background-connected
chroma green, decontaminates its connected antialias fringe, isolates eleven
painted components and packs a 1024×768 RGBA atlas. Its twelfth 256px cell is
empty. It does not impose the older warm-fur palette mask on silver fur or
lilac skin. The same pass generates `game/premium-parts.ts` and annotated
registration images; these outputs are rebuilt, not hand-edited.

## Shared anatomy and authored heads

Each kit uses the existing High Orbit eleven-part painter: head, torso, two
upper arms, two forearms with hands, two thighs, two shins with boots and one
tail. Parts retain their painted texture and uniform scale between poses.
At the common 192px display reference, the entire head silhouette has radius
36px; shell ear peaks and Nacre's fins count inside that envelope. The fixed
neck-to-hip axis is 62px, near/far arms are 25+23/24+22px, near/far legs are
28+29/27+28px, and the tail attachment axis is 79px.

The Sovereign Shell and Facet Shell are baked into their head paintings.
Nacre's painting is bare. Catalog head policies suppress interchangeable
helmet overlays in flight, previews, fallback portraits and cockpit crops;
the player's prior helmet selection remains stored for another suit.
Porcelain and Nacre use the shared tail deformation. Origamist rotates its
folded tail as one rigid painted surface, preserving its facet geometry.

## Rebuild and review

Use the container workflow in [AGENTS.md](../../AGENTS.md). If Docker is
unavailable, use its documented existing-tool fallback; the exporter and
review scripts accept `ACORNAUT_CANVAS` for the installed canvas entry point.
From the repository root, run these in order when masters or attachments change:

```sh
node illustrated-src/export-premium-pilots.mjs
node illustrated-src/export-sandbox.mjs
node illustrated-src/review-premium-pilots.mjs
node illustrated-src/build-lab.mjs
node illustrated-src/build-flight-studio.mjs
node illustrated-src/test-premium-pilots.mjs
```

The review command always writes all three 256×256 fallback portraits from
the shipping painter, their hashes and `pose-review.png`; it does not generate
new paintings. The focused test runs render, production and beta modes. It
also writes `production-review.png` and `regression.json` for the render mode.
It supplements the full checks in [SHIPPING.md](../../SHIPPING.md).

Inspect `docs/lab/premium-pilots/index.html` through the local web server at
close-up and 52px flight reference, in natural/climb/glide/dive motion, with
wakes and both backdrops. See the [production review notes](../../illustrated-src/design/premium-pilots/README.md).
Numerical geometry and transaction checks do not establish artistic approval
or completion of the full shipping gates.
