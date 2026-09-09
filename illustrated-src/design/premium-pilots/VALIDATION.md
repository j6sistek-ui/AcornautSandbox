# Premium pilot supplied-sheet release validation

**New release verification is pending.** The owner authorized the supplied
sixteen complete flight frames per suit, with cast shadows removed and
Porcelain's surrounding boxes cleaned away. This supersedes the rejected
cut-rig implementation and its posture proposals. Prior visual acceptance
and old technical receipts do not validate this new release.

The required head treatments remain Porcelain's always-worn Sovereign Shell
(B), helmetless Nacre Envoy and Origamist's always-worn Facet Shell.
The latest prices are **1,000 Stardust per suit** and **2,500 Stardust for
Premium Pilot Trio**. Each includes its matching exclusive wake. The former
2,500-per-suit decision is superseded.

## Required current evidence

| Area | Required evidence | Status |
| --- | --- | --- |
| Source identity | All three supplied sheets retained, sixteen complete frames each, source/output hashes | Export receipt contains all 48 frames; raw masters and prompts retained |
| Cleanup | Cast shadows and Porcelain boxes removed; full anatomy, costume and head treatment preserved | Final cleaned masters selected for QA; final playback/browser review pending |
| Rendering | Complete-frame playback, source frame order, uniform scale, clean edges, fallback and cockpit crops | Pending |
| Motion | Repeated taps and release cycle at normal/slow speed and actual flight size | Pending |
| Envoy tails | Two comparably sized pearl tails with crossing/overlapping curves and offset authored shapes | Final master selected and static contact inspected; playback review pending |
| Economy | 1,000 singles, 2,500 trio, original singleton ids retained, singles purchasable while trio is featured | Pass: actual production and beta Shop checkouts |
| Ownership | All three suit/wake grants, partial-ownership credit, insufficient funds, repeated purchase and save/reload | Pass: production and beta, all eight ownership subsets |
| Build and gates | Source export, lab/Flight Studio, TypeScript, whitespace, complete art gate, full unskipped harness and platform bridge | Pending final run |
| Browser | Actual 390px production Shop, prices, previews, individual/trio checkout and fresh screenshots | Pending |
| Publication | Final source identity, PR evidence and owner merge decision | Pending |

`test-premium-pricing.mjs` covers both production and beta through the real
storefront and engine. It verifies the featured trio remains exactly 2,500
when unowned, while each pinned single remains 1,000 and can be bought
separately. The existing proportional ownership policy charges 1,670 for
two missing suits or 830 for one; it never charges twice for an owned suit.

The focused pricing test passed against the completed stamp 254 production
and beta builds. It used the real single-item cart and featured-pack checkout,
confirmed all three wake entitlements, and verified save/reload and repeated
purchase protection. The general Shop rotation/cross-pack pricing test also
passed with zero failures. These passes do not claim the final full harness.

The [source/export record](../../../art-src/premium-flight/README.md) links the
48-frame receipt. All frames use the same head anchor (180, 84), with one
constant uniform scale per character. Connected-character extraction retains
tails crossing the nominal source-grid margins. Output padding passes the
8px safety bound; observed minimum margins are 30px for Porcelain, 10px for
Nacre and 15px for Origamist. Maximum measured green excess is 6 in each bank.

## Historical evidence

The rejected cut-rig contacts, registration overlays, regression receipt,
old browser screenshots and Arcflash baseline comparison were removed from
this review folder. Their previous versions remain in Git history and are
not evidence for the supplied-sheet release. The initial Arcflash failure
was addressed on main by deterministic portrait generation; current results
must come from the new full run.

Fresh contacts and browser captures must identify this whole-frame candidate.
Generation of a contact sheet is not visual acceptance; the author must
inspect the actual cleaned assets and playback. Neither an old passing test
nor a repeated art stamp establishes that this source/art state was tested.

## Execution and publication

Follow [SHIPPING.md](../../../SHIPPING.md) and the repository container
workflow. If Docker is unavailable, record use of the authorized existing-tool
fallback and the actual tool versions; no host system packages may be
installed. There is no separate lint script, so record TypeScript and
whitespace checks alongside the art and test gates.

Update the pending rows only with observed results for the final supplied-sheet
candidate. Preserve prior purchase identifiers and saved ownership. Reusable
cut kits and the five remaining concepts stay outside this production scope.
No automatic merge is authorized.
