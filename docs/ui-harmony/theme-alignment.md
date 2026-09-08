# Debris Field theme alignment — shared chrome token plan

**Goal (owner):** Menus/modes chrome must feel like one app. Same back (purple), same launch/primary (blue), same fonts/sizes. A Debris Field page must not look like a new style.

**Out of scope:** Inventing a Debris Field identity hue/brand (no amber-vs-teal-vs-purple rebrand). Leave Normal flight alone. Functional hardpoint colors, flight control tints, and buy/spend gold may stay.

**Scope:** From Launch click → end of run, plus Loadout **SHIP** tab.

**Sources:** `/workspace/ui-audit/` — `spill-workshop.css`, `index.html` / `beta-index.html` (shared CSS), `spill-workshop.ts`, `standalone.ts`, `repo-audit.md`.

---

## 1. Palette / chrome inventory

### Hub canonical chrome (reuse these)

| Token | Class / rule | Spec |
|-------|----------------|------|
| Back | `.ac-backbtn`, `.ac-modeback` | Purple gradient `#8a5ae4 → #4a279c`, border `rgba(206,186,255,.5)`, white label; backbtn 40×40 r**14**; modeback pill, weight 900 |
| Primary / Launch | `.ac-primary` | Fill `#4ab4ff`, text `#0c1224`, r**16**, weight **800**, **18px**, pad 14×16 |
| Ghost / secondary | `.ac-ghost` | `#141b30` / `#f3efe4`, border `#2a3454`, r**16**, weight **700** |
| Kicker | `.ac-kicker` | `#e8a44a`, tracking **`.32em`**, 11px uppercase; dense menus → `#8b95b0` 9px |
| Help | `.ac-helpdot` | 34×34 circle, `rgba(10,16,32,.72)`, border `rgba(255,255,255,.16)` |
| Selected card | `.ac-card.on` | Border `#A99BE8`, soft violet wash |
| Sheet card | `.ac-lvlcard` | `#101830`, top r**18** |
| Type | Fraunces titles / Figtree UI | Shared already |

Hub tile hues (context only — not Debris chrome): Launch `#2f8fe0`, Loadout `#8a5ae4`, Modes `#eda03c`, Chart `#1db388`. Mode door `.m-spill` uses `#8a5cf0` (near Loadout purple); do **not** invent a replacement brand hue here — Modes row can stay on existing mode-tile language; focus is button/kicker/type parity.

### Debris Field surfaces in scope

| Surface | Builder | Key classes |
|---------|---------|-------------|
| New-run setup | `drawSpillLaunchSetup` | `.ac-spillprep.ac-spillsetup` |
| Depot guide | `drawDepotGuide` | `.ac-depotguidecard` |
| Salvage depot | `drawDepotWorkshop` | `.ac-workshop`, `.ac-workshop-launch/exit/buy/help` |
| Loadout SHIP | `drawHangar` ship tab | `.ac-shiplaunch` + shared starters/engine pickers |
| In-run pause / results | `standalone.ts` | Prefer existing `.ac-primary` / `.ac-ghost` / `.ac-backbtn` |
| Flight HUD / Throttle·Dive·Lunge | `.ac-spillcontrols` | **Leave** functional tints (`#ade9ca` / `#eac0a3` / `#a2ddf5`) |

### Where Debris chrome diverges today (`spill-workshop.css`)

| Concern | Hub | Debris Field workshop |
|---------|-----|------------------------|
| Primary CTA | `.ac-primary` solid `#4ab4ff`, r16, 800/18 | `.ac-workshop-launch` cyan gradient `#87d5ff→#55aeef`, r**12**, 600/**14**, inset+drop shadow |
| Secondary / exit | `.ac-ghost` or purple `.ac-backbtn` | `.ac-workshop-exit` `#182237`, border `#73829d66`, r**10**, 500/**12** |
| Help | `.ac-helpdot` `?` | `.ac-workshop-help` underlined text “Guide” `#c2cce0` |
| Kicker | gold `.32em` | lavender `#c5bdd8` / `#c6b7d9`, tracking **`.08–.09em`** |
| Selected | violet `#A99BE8` `.on` | green `.selected`/`.fitted` `#8be0b5` / `#9be4be`; system gold outline `#ffe091` |
| Prep border | navy card `#2a3454` | legacy `.ac-spillprep` hairline `#b8a1ff50`; setup also `#56617b` |
| Buy / spend | shop gold chips | `.ac-workshop-buy` gold gradient — **OK to keep** (spend dialect, not chrome) |
| Wallet | acorn gold `#ffdf9a` / `#f5d391` | Keep coin icon + gold number (currency, not brand chrome) |

---

## 2. Top 5 concrete mismatches (hex + file/class)

1. **Launch CTA is a second primary** — `.ac-workshop-launch` (`spill-workshop.css`): cyan `#87d5ff→#55aeef`, text `#122a44`, r12, weight 600 / 14px vs hub `.ac-primary` `#4ab4ff` / `#0c1224`, r16, 800 / 18px. Same “leave / go” action, different product skin.

2. **Exit / Main menu is not hub back or ghost** — `.ac-workshop-exit`: bg `#182237`, border `#73829d66`, r10, 12px/500 vs purple `.ac-backbtn` (`#8a5ae4→#4a279c`) or `.ac-ghost` (`#141b30` / `#2a3454`, r16).

3. **Kickers read as another brand** — `.ac-workshop-head .ac-kicker`, `.ac-spillsetup .ac-kicker`, guide kicker: `#c5bdd8` / `#c6b7d9`, tracking `.08–.09em` vs shared `.ac-kicker` `#e8a44a` + `.32em` (`index.html`).

4. **Help control idiom split** — Depot `.ac-workshop-help` underlined “Guide” vs hub circular `.ac-helpdot` (34px). Same “open help” job.

5. **Selected language on shared ship UI** — Loadout SHIP + Depot starters/engine/utilities use green `.selected` / `.fitted` (`#8be0b5`, `#233c37`) while hub Loadout cards use `.ac-card.on` violet `#A99BE8`. Same ship workshop, two select chromes on one app.

*(Honorable mention, not top-5 chrome: casing `Main menu` / `Launch wave N →` vs hub `MAIN MENU` / `TAKE FLIGHT` — copy in `spill-workshop.ts`, fix with UPPERCASE chrome labels.)*

---

## 3. Direction — shared chrome, not a new hue

**Do not** assign Debris Field a new identity color. Owner ask is consistency: one back, one launch, one type scale.

- **Back / leave chrome** → purple hub language (`.ac-backbtn` or `.ac-ghost` + purple back affordance where menus use it).
- **Go / Launch / Enter depot** → `.ac-primary` blue `#4ab4ff`.
- **Kickers / titles / radii / weights** → shared `.ac-kicker`, Fraunces/Figtree sizes already on hub sheets.
- **Keep as-is (not chrome):** hardpoint `--system-color`s, health green, Throttle/Dive/Lunge tints, `.ac-workshop-buy` gold, Acorn Coin glyph/wallet gold, hangar art backdrop.
- **Modes `.m-spill` purple:** leave alone for this pass (mode-tile parity with other doors); do not recolor as a “Debris brand.”

---

## 4. Token plan — classes/vars to change (Launch→run + Loadout SHIP only)

### Alias / compose (preferred over duplicating hex)

| Debris class | Change to | Notes |
|--------------|-----------|--------|
| `.ac-workshop-launch` | Add/compose `.ac-primary`; CSS becomes size modifier only (`min-height`, flex) | Drop cyan gradient, inset shadow, r12, 600/14 → hub fill/text/r16/800/18 (or slightly tighter pad if footer needs it, keep fill identical) |
| `.ac-workshop-exit` (Main menu / Save & exit / Cancel) | Prefer `.ac-ghost`; for “back to hub” use `.ac-backbtn` or purple `.ac-modeback`-equivalent where layout is a single back control | Match r16 / border `#2a3454` / `#141b30` |
| `.ac-workshop-help` | Replace control with `.ac-helpdot` (`?`) | Same open-guide behavior in `spill-workshop.ts` |
| `.ac-workshop-head .ac-kicker`, `.ac-spillsetup .ac-kicker`, `.ac-depotguidecard .ac-kicker` | Defer to shared `.ac-kicker` (remove lavender / micro-tracking overrides) | Dense depot head may use menu grey `#8b95b0` if gold is too loud — still shared rule |
| `.ac-starter-option.selected`, `.ac-engine-color.selected`, `.ac-spilloption.selected` (Loadout SHIP + setup) | Prefer hub `.on` / `#A99BE8` ring **or** keep green only inside Depot fitted utilities — pick **one** for ship pickers shared with Loadout | Highest priority: Loadout SHIP + new-run setup share one select |
| `.ac-spillprep` border | `#b8a1ff50` → hub card border `#2a3454` (or navy hairline) | Stop purple “special sheet” frame |
| `.ac-spillsetup` / `.ac-workshop-card` type | Keep Fraunces h2; bump primary CTA type via `.ac-primary` | Don’t invent parchment-only type scale |

### Leave unchanged

- `.ac-workshop-buy` / `.fitted` buy state (gold spend)
- `[data-system=*]` hardpoint colors
- `.ac-spillcontrols` / `.ac-throttle|.ac-dive|.ac-lunge`
- Normal / Deep / Lost / Arcade flight UI
- Hangar `--workshop-art` backdrop

### Optional `:root` aliases (if exporting shared tokens)

```css
/* document only — values already live on hub classes */
--ac-primary: #4ab4ff;
--ac-primary-ink: #0c1224;
--ac-ghost-bg: #141b30;
--ac-line: #2a3454;
--ac-back-1: #8a5ae4;
--ac-back-2: #4a279c;
--ac-r-btn: 16px;
--ac-kicker: #e8a44a;
```

Workshop rules should **call hub classes**, not re-declare competing fills.

---

## 5. Ordered implementation steps (quick CSS wins first)

1. **CSS — `.ac-workshop-launch` → hub primary**  
   In `spill-workshop.css`: remove cyan gradient/shadow; set fill `#4ab4ff`, text `#0c1224`, `border-radius: 16px`, `font-weight: 800`, `font-size: 16–18px` (or add class `ac-primary` in `spill-workshop.ts` and strip conflicting rules). Applies to new-run, guide Enter/Back, depot Launch.

2. **CSS — `.ac-workshop-exit` → `.ac-ghost` metrics**  
   Match `#141b30` / `#2a3454` / r16 / weight 700. If a single “back” control is shown, use `.ac-backbtn` purple gradient instead of a custom grey pill.

3. **CSS — kill lavender kickers**  
   Delete color/tracking overrides on workshop/setup/guide `.ac-kicker` so shared `#e8a44a` + `.32em` wins (or menu `#8b95b0` on dense depot head only).

4. **CSS — strip special prep border**  
   `.ac-spillprep` / setup: border `#2a3454` (hub card), drop `#b8a1ff50`.

5. **TS — Guide → `.ac-helpdot`**  
   `spill-workshop.ts`: replace “Guide” text button with `?` helpdot; keep `data-spillControl="guide"`.

6. **TS — UPPERCASE chrome labels**  
   `MAIN MENU`, `SAVE & EXIT`, `LAUNCH WAVE N`, `ENTER DEPOT`, `BACK TO DEPOT` (body copy stays sentence case).

7. **CSS — one selected idiom for Loadout SHIP + setup starters/engine**  
   Align `.ac-starter-option.selected` / `.ac-engine-color.selected` with `.ac-card.on` violet `#A99BE8`. Depot utility `.fitted` green can remain Depot-only if documented.

8. **Verify path**  
   Modes → Debris Field → Launch → new-run sheet → Depot guide → Depot → Launch wave → pause/results; plus Loadout → SHIP. Confirm back purple, primary blue, kickers/type match hub; Normal flight untouched.

---

## Reference paths

| Role | Path |
|------|------|
| Workshop CSS | `illustrated-src/spill-workshop.css` (local copy: `ui-audit/spill-workshop.css`) |
| Workshop DOM | `illustrated-src/game/spill-workshop.ts` |
| Hub / Loadout / wiring | `illustrated-src/game/standalone.ts` |
| Shared CSS | `docs/index.html` / `docs/beta/index.html` `<style>` |
| Prior audit | `ui-audit/repo-audit.md` |

*Method: local `/workspace/ui-audit` files only; no clone.*

## Hyper Run note (do not implement this pass)
Jim flagged Hyper Run as the other big gap. This pass does **not** rewrite Hyper. When aliasing shared chrome (`.ac-primary`, `.ac-ghost`, `.ac-backbtn`, `.ac-kicker`, `.ac-helpdot`), re-check the Hyper **ready card** so it keeps consuming the same hub tokens and does not drift to workshop-only classes.
