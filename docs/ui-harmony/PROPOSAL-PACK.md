# UI consistency — proposal pack (Debris Field + Hyper Run menus)
**Pass scope:** Debris Field Launch → Loadout (SHIP) → help/tutorial → end-of-run, **plus Hyper Run menus** for the same shared chrome feel.  
**Rule:** One shared chrome system. No new mode-specific brand look.  
**Hyper:** In scope for menu/ready/briefing chrome parity (purple back, blue primary, ghost, helpdot, type). Keep Hyper’s race/time fantasy — don’t paste Debris Field wave/Depot copy onto Hyper sheets.

## Owner chrome rule
| Control | Always |
|---------|--------|
| Back | `.ac-backbtn` purple `#8a5ae4→#4a279c` |
| Launch / primary | `.ac-primary` blue `#4ab4ff` |
| Secondary | `.ac-ghost` |
| Help | `.ac-helpdot` |
| Titles | Fraunces 800 |
| Kickers | shared `.ac-kicker` |
| Labels | UPPERCASE |

Hardpoint colors stay (functional). In-run flight-control **layout** is iterating with Jim (nested circle+wings); don’t treat as “leave forever.” See Pending Jim ticks for GO dual-fall + receipt copy.

## Fix list (ordered)
1. `.ac-workshop-launch` → `.ac-primary` (drop cyan gradient)
2. `.ac-workshop-exit` → `.ac-ghost` (or `.ac-backbtn` when it’s back)
3. Lavender kickers → shared `.ac-kicker`
4. Prep border `#b8a1ff` → hub `#2a3454`
5. “Guide” → `.ac-helpdot`
6. UPPERCASE chrome strings
7. Loadout SHIP + setup select → one idiom (prefer hub violet `.on`)
8. Help: Debris Field HOW TO FLY block + ACORN COINS up with currencies (copy-pass.md)

## Shots in `/workspace/ui-audit/`
- main-home, main-modes, debris-open, ship-loadout, debris-help
- comps: comp-quickwins, comp-help, theme-map
- Full plan: theme-alignment.md

## Hyper Run menus (in scope)
Apply the same chrome aliases to Hyper ready/briefing sheets. Keep race/time fantasy distinct from Debris Field wave/Depot language. Player-facing name stays mode-accurate; no Spill wording.

## Live shots (2026-09-08)
- ship-loadout.png — purple back OK; green starter select vs hub
- depot-preflight.png — cyan Enter depot; lavender kicker
- debris-hud.png — flight controls OK to leave; pause square not backbtn

## Landscape clipping (confirmed)
1. Loadout SHIP bottom: Build from stock… cut off — need scroll + safe bottom padding on `.ac-shipworkshop` / sheet scroll.
2. SHIP utilities/engine sections also clip at bottom when scrolled.
3. Engine labels / specialty headers ride edges mid-scroll (clip-3).
4. Debris new-run: “Your next ship” clipped at top of `.ac-spillsetup` — add top padding / avoid flush title.
Portrait + Depot Guide: no clear extra clips found.

## Pending Jim ticks (feel — not chrome)
Per gameplay imagineer / CoS — keep on the index; don’t drop while visuals ship:
1. **GO / first-wave coach — dual-fall teach:** CONTROLS bar says release ▼ fall while Dive says TAP TO DESCEND (two ways to fall). Resolve once flight-cluster layout is locked.
2. **End receipt:** GROUNDED → player-facing **OUT OF HEALTH** (floor death under-teaches today).
Status: **pending Jim ticks** — not blocking shared-chrome visual proposals.
