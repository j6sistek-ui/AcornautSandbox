# IMPLEMENT — UI harmony (Debris Field + Hyper menus)

**Audience:** coding agent / Jim finishing this in Cursor  
**PR:** docs/ui-harmony on `docs/ui-harmony-proposal` (this folder)  
**Status:** Jim-approved. Open implement PR (or commit on a branch). **Do not merge** until Jim says.

## Outcome
Debris Field (player-facing; internal ids may still say `spill`) Launch → Loadout SHIP → help/tutorial → end-of-run menus, **plus Hyper Run ready/briefing menus**, use the **same hub chrome** as the main game. Copy/Help cleaned up. Landscape clipping fixed. No new mode brand hue.

## Repo / paths (edit these)
| Role | Path |
|------|------|
| Workshop CSS | `illustrated-src/spill-workshop.css` (and built `docs/js*/` if your pipeline requires syncing) |
| Workshop DOM | `illustrated-src/game/spill-workshop.ts` |
| Content / utilities | `illustrated-src/game/spill-content.ts` |
| Hub / Help / Loadout / Hyper wiring | `illustrated-src/game/standalone.ts` |
| Shared hub CSS | `docs/index.html` / `docs/beta/index.html` `<style>` (`.ac-primary`, `.ac-ghost`, `.ac-backbtn`, `.ac-kicker`, `.ac-helpdot`, `.ac-card.on`) |
| Specs in this PR | `docs/ui-harmony/PROPOSAL-PACK.md`, `theme-alignment.md`, `copy-pass.md`, `shared-chrome.md` |
| Visual refs | `docs/ui-harmony/shots/` |

Follow the repo’s normal build/export so beta/docs JS stays in sync if that is how AcornautSandbox ships.

## Canonical chrome (always)
| Control | Class / token |
|---------|----------------|
| Back | `.ac-backbtn` purple `#8a5ae4 → #4a279c` |
| Primary / Launch / Enter depot | `.ac-primary` `#4ab4ff` / ink `#0c1224`, r16, weight 800 |
| Secondary | `.ac-ghost` `#141b30` / border `#2a3454`, r16 |
| Help | `.ac-helpdot` (`?`) — not underlined “Guide” text |
| Kickers | shared `.ac-kicker` (`#e8a44a`, tracking ~`.32em`) — kill lavender overrides |
| Selected ship pickers | hub `.on` / violet `#A99BE8` (not green `.selected` on Loadout SHIP + new-run setup) |
| Titles | Fraunces 800 |
| Chrome labels | UPPERCASE |

**Keep as-is:** hardpoint colors, Throttle/Dive/Lunge functional tints, buy/spend gold, wallet gold, hangar art, Normal flight UI, Modes `.m-spill` tile hue.

## Do in order
### A. Quick wins (CSS + TS chrome) — AGREED
1. `.ac-workshop-launch` → compose/use `.ac-primary`; drop cyan gradient `#87d5ff→#55aeef`, inset shadow, small r12/600/14.
2. `.ac-workshop-exit` → `.ac-ghost` metrics (or `.ac-backbtn` when it is a single back control).
3. Remove lavender / micro-tracking overrides on workshop/setup/guide `.ac-kicker`.
4. `.ac-spillprep` / setup border `#b8a1ff…` → hub `#2a3454`.
5. Replace “Guide” with `.ac-helpdot`; keep open-guide behavior / `data-spillControl="guide"`.
6. UPPERCASE chrome: `MAIN MENU`, `SAVE & EXIT`, `ENTER DEPOT`, `BACK TO DEPOT`, `LAUNCH WAVE N`, launch CTA per `copy-pass.md` §C (`LAND · FREE UPGRADE` or similar — not tutorial-tip voice).
7. Loadout SHIP + new-run starter/engine select → one violet `.on` idiom shared with hub cards. Depot utility `.fitted` green may stay Depot-only if documented in the PR.

### B. Copy / Help — AGREED (`copy-pass.md`)
8. Player-facing **Debris Field** (never Spill in UI strings).
9. Player-facing **Acorn Coins** everywhere listed in copy-pass §A (Help, pause HUD, Guide, aria, contracts, magnet, etc.). Internal `ore` OK.
10. Mode-aware **HOW TO FLY · DEBRIS FIELD** block (add, don’t replace planet HOW TO FLY): HOLD rise · RELEASE fall · LUNGE; one line Depot every 5 waves · Acorn Coins · first upgrade free.
11. Promote ACORN COINS into Help currency cluster (next to ACORN / STAR DUST).
12. Utility names from `SPILL_UTILITIES`; mastery leftover `Spillbreaker` → `Fieldbreaker` or `Salvage Ace`.
13. Hyper ready/briefing: **same chrome classes**; keep race/time fantasy — do **not** paste Debris Field wave/Depot copy onto Hyper sheets.

### C. Landscape clipping — AGREED
14. Loadout SHIP sheet: scroll + safe bottom padding so “Build from stock…” / utilities / engine aren’t clipped.
15. Debris new-run: top padding on `.ac-spillsetup` so “Your next ship” isn’t flush-clipped.

## Explicitly OUT OF SCOPE (do not change)
- GO / first-wave dual-fall teach (`CONTROLS` `release ▼ fall` vs Dive `TAP TO DESCEND`) — pending Jim ticks
- GROUNDED → `OUT OF HEALTH` receipt copy — pending Jim ticks
- Flight-cluster layout redesign (Throttle/Dive/Lunge chrome layout) — Jim iterating separately
- Flight **physics**
- Earlier Depot cadence / free utilities / economy redesign
- Inventing a Debris Field brand color

## Verify
1. Hub home → Modes → Debris Field → Launch → new-run → Depot Guide → Depot → Launch wave → pause/results  
2. Loadout → SHIP  
3. Modes → Hyper Run → ready/briefing sheets  
4. Confirm: purple back, blue primary, shared kickers/type, Debris Field naming, Acorn Coins, no cyan Launch, no “Guide” text link, Normal flight untouched  
5. Landscape: no SHIP bottom clip; no new-run title clip  

## PR hygiene
- Separate **implement** PR from this docs PR preferred (or commit code onto a branch that references #238).  
- PR body: checklist A–C + OUT OF SCOPE list.  
- Link this docs PR: https://github.com/j6sistek-ui/AcornautSandbox/pull/238  
- **Do not merge** until Jim says go.

## Supporting docs in this folder
| File | Use |
|------|-----|
| `PROPOSAL-PACK.md` | Ordered fix list + pending ticks |
| `theme-alignment.md` | Hex/class mismatches + CSS alias table |
| `copy-pass.md` | String table for Acorn Coins / Help / CTAs |
| `shared-chrome.md` | One-page owner rule |
| `shots/comp-quickwins.png` | Before/after chrome intent |
| `shots/theme-map.png` | Token map |

