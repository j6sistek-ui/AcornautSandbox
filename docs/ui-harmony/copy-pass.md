# Copy + Help integration pass

## A. Currency — Acorn Coins

Owner rule (`SPILL_WELCOME_REVIEW.md`): player-facing **Acorn Coins**; internal `ore` stays.

| Location | Current | Proposed |
|----------|---------|----------|
| Help item label | `COINS` | `ACORN COINS` |
| Help desc | Debris Field's currency. Spend it at the Depot. | Keep (already clear) |
| Pause HUD | `WAVE N · N COINS` | `WAVE N · N ACORN COINS` (or `N ◎` if space) |
| Guide header | Collect coins | Collect Acorn Coins |
| Guide objective | Collect N coins. | Collect N Acorn Coins. |
| Guide loss | Coins & upgrades reset. | Acorn Coins & upgrades reset. |
| Wallet aria | N coins | N Acorn Coins |
| Buy aria / need | N coins / more coins needed | Acorn Coins |
| Contract reward chip | +N coins | +N Acorn Coins |
| Magnet desc | nearby coins and gold | nearby Acorn Coins and gold |
| Salvage Armor | Collect 30 coins… | Collect 30 Acorn Coins… |
| Ship preview prices | `N COINS · STEP` | `N ACORN COINS · STEP` (or keep short `COINS` only when icon present — prefer full on first mention) |
| Results | Acorn Coins mined | Keep |

Files: `spill-workshop.ts`, `spill-content.ts`, `standalone.ts` (help label, pause, ship prices).

## B. Utility names — one table

Source of truth: `SPILL_UTILITIES` in `spill-content.ts`. Add optional `short` for guide chips.

| id | name (Title Case) | short (guide) | drop |
|----|-------------------|---------------|------|
| magnet | Salvage Magnet | Magnet | — |
| scanner | Debris Scanner | Scanner | doc “Field Scanner” |
| brake | Emergency Brake | Brake | — |
| capacitor | Pulse Battery | Battery | doc “Reserve Capacitor” |

Guide currently hard-codes Magnet/Scanner/Brake/Battery — pull from content instead (`drawDepotGuide`).

## C. Chrome casing (workshop)

| Current | Proposed |
|---------|----------|
| Main menu | MAIN MENU |
| Save & exit | SAVE & EXIT |
| Land & choose free upgrade → | LAND · FREE UPGRADE (or LAUNCH · FREE UPGRADE) |
| Enter depot → / Back to depot → | ENTER DEPOT / BACK TO DEPOT |
| Launch wave N → | LAUNCH WAVE N |
| Guide | replace with ? helpdot (no text) |

## D. Mastery leftover

`Spillbreaker` (engine color title at wave 20) → **Fieldbreaker** or **Salvage Ace**.

## E. Help / tutorial integration (high impact)

Live beta Help (`drawHelp`):
- HOW TO FLY = TAP BOOST / SWIPE DIVE + planet bounce copy only
- Debris Field controls (Throttle / Dive / Lunge) live only in pause settings + one line on new-run sheet
- `COINS` row exists but sits below fold after ACORN / STAR DUST / pickups — easy to miss
- Beta dropped Modes blurbs from Help (they live on Modes sheet) — OK
- `Help prompts` toggle mentions “pre-flight briefing” but doesn’t teach Debris Field gestures

### Proposal E1 — Mode-aware HOW TO FLY block
When last-selected mode is Debris Field, or always as a second section:

**HOW TO FLY · DEBRIS FIELD**
- HOLD — rise (Throttle)
- RELEASE — fall
- SWIPE / LUNGE — forward dash
- One line: “Depot every 5 waves · spend Acorn Coins · first upgrade free”

Keep planet HOW TO FLY for Normal/etc. Don’t replace — add.

### Proposal E2 — Promote ACORN COINS in Help
Move `ACORN COINS` row up next to ACORN / STAR DUST (currency cluster), not after power-ups. Rename label from COINS.

### Proposal E3 — Depot ? = same language as Help
Depot/new-run helpdot opens guide sheet; guide title “How the Depot works”; first visit still auto-opens once.

### Proposal E4 — Replay tutorial
`REPLAY TUTORIAL` today is planet briefing. Either: (a) mode-aware replay, or (b) second button `DEBRIS FIELD BRIEFING` when mode unlocked.
