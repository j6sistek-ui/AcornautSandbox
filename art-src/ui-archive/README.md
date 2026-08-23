# UI archive

`pre-promotion/` is the production build as it stood immediately before the
beta feature set was promoted to live at v110 — the classic hub, its stylesheet
and the catalog that gated them. Kept so the old look can be restored without
digging through history.

    art-src/ui-archive/pre-promotion/index.html      the live page and its CSS
    art-src/ui-archive/pre-promotion/standalone.ts   drawHomeClassic and the tab bar
    art-src/ui-archive/pre-promotion/catalog.ts      the flags as they were
    SOURCE-COMMIT.txt                                the commit and version it came from

## Reverting

The classic UI was NOT deleted. `drawHomeClassic()` and every `!BETA_FEATURES`
branch are still in `standalone.ts`, so the whole promotion is one constant:

    export const BETA_FEATURES = true;   // set to IS_BETA to put live back

That restores the classic hub, the old tab bar and the smaller art set in a
single line, with no file surgery. The archive above is the belt to that
braces — it matters only if those branches are later deleted for good.

## What promotion did and did not move

Promoted to live: the redesigned hub, the loadout and modes tiles, all 29
suits and helmets, and all 29 tap banks (live previously loaded five).

Held back deliberately, each on its own flag so either can be released alone:

    HYPER_RUN_ENABLED   the time-trial mode and its art
    STORY_MODE_ENABLED  the wormhole and spill missions on the star chart

Also still beta-only, and deliberately so: the QA unlock that opens every
chapter and level without earning them, and the lab doors.

## The trap this avoided

`SAVE_KEY` derives from `IS_BETA`. Promoting the features by flipping that flag
— the obvious way to do it — would have moved every live player onto the beta
save slot and silently wiped their progress. That is why `BETA_FEATURES` is a
separate constant: `IS_BETA` still means "this is the beta PAGE" and still owns
the save key and the build label; `BETA_FEATURES` owns what gets built.
