# Bundle kit pricing

The September 9 Shop revision has **eight real bundles**, each with at least three distinct primary products and a required `kit` in `game/catalog.ts`. Each kit owns its banner path (`shop/<bundle-id>.png`) and an editable integer `discountDust`. The five retained bundles preserve their unowned Shop offers from commit `d296e6bc404aaec14221a8b79186132fb4426dea`. Three new collections each cost 200 Stardust. Individual prices, all 35 ownership IDs, cash offers and grants remain unchanged.

Single items are not bundles. `FIXED_SHOP_SUIT_IDS` keeps Arcflash at 1,850 and Porcelain, Nacre and Origamist at 1,000 each on the individual shelf. These IDs remain in `IAP_ITEMS` independently of bundle membership. The former companion and visor singletons remain individual products through their new collections. Matching suit/helmet slots share one ownership ID; free set wakes and inseparable built-in signature wakes do not inflate the three-product minimum. Built-in wakes must not appear explicitly in a kit's products: validation rejects them because the review UI derives these suit effects automatically, and they cannot be sold separately.

`bundleQuote(bundle, owns)` is the shared contract for cards and both checkout helpers:

| Field | Meaning |
|---|---|
| `retail` | Original individual retail of the complete kit, with shared IDs and free set trails counted once |
| `offer` | `retail - kit.discountDust`, before ownership credit |
| `credit` | Original retail minus the individual retail still unowned |
| `due` | `max(0, offer - credit)`, without rounding after credit |
| `savings` | Configured original kit discount in Stardust |
| `discountPercent` | Original kit discount as a percentage of original retail, rounded to one decimal (trio: 16.7%) |

The displayed bundle discount is separate from ownership credit. Credit reduces the price; it never refunds currency or creates a negative balance. The trio costs 2,500 / 1,500 / 500 when zero / one / two pilots are owned. A completely owned trio is removed from the offers.

Full credit is an intentional change from the pinned baseline: that baseline prorated the trio to 1,670 or 830, and discounted the unowned subtotal for rotating packs. Both `featurePrice` and the older `bundlePrice` now return the same quote. The legacy `dust` and `featuredAtSticker` fields remain as catalog compatibility data; `dust` is not the active checkout price. For example, Circuit's old direct helper asked 750 while the real Shop asked 450; both now ask 450 before ownership credit.

If credit covers the offer while items remain, the UI must keep an explicit two-step zero-cost completion. `due === 0` does not mean already owned. Only `bundleIds(bundle).every(owns)` means there is nothing left to grant. Both engine methods already perform this ownership check before applying the quote, grant the normal `idGrants` list once, and never equip the purchase.

The current kit amounts are:

| Bundle | Retail | Discount | Unowned Shop offer |
|---|---:|---:|---:|
| Premium Pilot Trio | 3,000 | 500 | 2,500 |
| Aurora Pack | 1,170 | 450 | 720 |
| Regalia Pack | 1,620 | 720 | 900 |
| Circuit Pack | 900 | 450 | 450 |
| Critter Pack | 810 | 400 | 410 |
| Cosmic Companions: Magnetar, Baby Alien, Satellite | 270 | 70 | 200 |
| Starlight Companions: Space Puppy, AstraFox, Stopwatch | 270 | 70 | 200 |
| Visor Collection: Amethyst, Ivoryguard, Reactor | 270 | 70 | 200 |

The three new collections cost 200 / 110 / 20 with zero / one / two 90-Stardust products owned. Their 70-Stardust discount is editable in the same way as the retained kits.

The following 15 bundle IDs are intentionally retired: `bundle-arcflash`, `bundle-porcelain`, `bundle-nacre`, `bundle-origamist`, `bundle-magnetar`, `bundle-babyalien`, `bundle-satellite`, `bundle-spacepuppy`, `bundle-astrafox`, `bundle-switchback`, `bundle-amethyst`, `bundle-ivoryguard`, `bundle-reactor`, `bundle-robo`, and `bundle-cyber`. Calling either bundle checkout with these IDs returns `missing`. Saves record product IDs rather than bundle IDs, so existing ownership is retained without a content migration. Circuit still includes the two retired duos' contents; its Cyber purchase also grants Clockwork.

Edit `kit.discountDust` to change a kit's discount. Zero means full retail; an amount equal to retail is a valid 100% discount. Fewer than three distinct primary products, missing kits, a noncanonical banner path, negative/nonfinite/fractional discounts, and discounts exceeding retail throw during catalog import and quote evaluation. The standard tests also require each banner to exist as a valid PNG. Changes to retained defaults should update the intentionally pinned offer expectations with owner authorization, rather than silently rewriting the historical baseline.

The beta test grant is decoupled from bundle count. `save.ts` preserves the historical 12,360 starting-funding floor and 7,510 fallback for an old save without a recorded grant total. `betaDustGrantTarget()` may grow when the actual kit offers plus fixed singles exceed the floor. Previously recorded grants are never reduced; repeat loads do not refill spent currency. Production has no beta funding behavior.

`test-bundle-kits.mjs` compares 416 recorded ownership subsets from the five retained bundles plus all 24 cases for the three new collections: **440 quote cases and 880 engine checkout cases**. It covers the distinct-product minimum, overlapping IDs, free trails, insufficient funds, repeat purchases, persistence, zero-cost completion, editable 100% discounts, retired endpoints, retained individual purchases, and beta fresh/recorded/legacy grant compatibility. `--pricing-only` defers banner-file checks while art is being prepared; the ordinary full-suite invocation requires the assets.
