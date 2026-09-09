# Neon galaxy loadout

The owner reviewed [the final screenshot revision](feedback-01/README.md)
and authorized merging PR255 on 9 September 2026. The redundant hero
EQUIPPED caption is removed, the existing shield sits beside a brighter
view toggle, and an opaque dark selection surface keeps the galaxy behind
the upper character area. The selected card retains its equipment state.

The loadout keeps its existing content and behavior while adopting cyan and
violet neon controls, gold premium card edges, and an open galaxy backdrop.
The live preview retains its existing canvas painter, equipment details,
companion rendering, expand/shrink control and ship preview.

`illustrated-src/loadout.css` is scoped to `.ac-loadout` and embedded into the
production page by `export-sandbox.mjs`, then copied into the generated beta
page. The equipped suit supplies the background palette in `drawHangar()`.
Two static layers reuse the existing `sky.jpg` and `sky-wide.jpg` artwork with
CSS luminosity blending. Only this decorative artwork is tinted, so the live
pilot's colors remain faithful. The original artwork files are unchanged.

The tabs remain Suits, Helmets, Trails, Pals and Ship. Existing shelf/grid
views, favorites, prices, ownership, unlocks and navigation remain intact.
No screenshot content, additional tabs or bottom navigation were introduced.
The Shop retains its display case and its existing appearance.

The preview remains compact or expanded according to the player's existing
saved preference. Grid view uses three columns to give the art more space.
Premium cards retain a gold inset when the cyan equipped ring is active;
keyboard focus has a separate pale outline. The backdrop adds no animation.

Build256 refreshes the browser module URLs. The export retains the prior
stamped builds under the repository's normal retention policy.

This revision incorporates main `d296e6bc404aaec14221a8b79186132fb4426dea`
after premium pilot PR252 merged. All three new pilots, their authored flight
banks and built-in wakes, the Premium Atelier shelf, fixed-head behavior and
the current Shop offers are retained. [Preservation evidence](preservation.json)
checks every current game source outside the two presentation edits, art
files, existing tests and Flight Studio runtime against that main revision.
The complete catalog matches main after normalizing the build stamp and line endings;
the production shell matches after removing the loadout stylesheet and
normalizing the loader stamp.

Validation and actual browser screenshots are recorded alongside this file.

## Review and validation

[Visual review](REVIEW.md) compares the original and updated menus and shows
three suit palettes, compact mode, a short phone, landscape and desktop.
The [final browser receipt](feedback-01/browser-verification.json) records production and beta
build256 with the real UI in an isolated synthetic save, at 390x844, 320x568,
844x390 and 1440x900. It covers all five tabs, scrolling to the final existing
shop link, suit/helmet/trail/pal equip, the pal-effect switch, ship preview
and reset, shelf/grid selection and live canvas animation. Additional
captures check large balances, keyboard focus, existing premium favorites,
and the unchanged Shop case.
The completed review contains 23 screenshots (including two baseline images)
and 34 checks, with zero page errors or failed art responses. The complete
34-suit, 30-helmet, 28-trail and 21-pal catalogs match current main exactly,
as do control identities, states and action handlers across all five tabs.
Control-order comparison permits only the requested shield relocation.
The relocated shield's cancellation and arming flow also passes, including
its existing cost and the armed tag beside the view toggle.
Porcelain, Nacre and Origamist each retain their fixed-head
policies, built-in trails, remembered prior selections and live animation.

The export, lab and Flight Studio builds, TypeScript check, all 32 art QA groups, platform
bridge and bundle checks pass. The final complete harness invocation passed
all 54 tests, with zero failures or skips, on the final feedback revision,
build 256 ([test log](feedback-01/full-tests.log), [art gate](feedback-01/art-check.log)).
There is no repository lint command;
`git diff --check` passes. All existing art and gameplay/save/progression
sources are unchanged. Pillow prints existing deprecation warnings and art
QA retains its 14 known frame-spread advisories.

Docker Desktop's daemon was unavailable. Following `AGENTS.md`, verification
used existing workspace Node packages, `ACORNAUT_TSC` pointing to their
TypeScript entry, and the bundled Python with the existing SciPy directory
on `PYTHONPATH`. No host packages were installed.

To repeat the browser review, start the local server:

```sh
node illustrated-src/review-loadout-browser.mjs --serve
```

Then run the script without `--serve` from another terminal. Set
`ACORNAUT_QA_OUTPUT` to `illustrated-src/design/loadout-neon/feedback-01/`
to write the final revision's evidence. Set
`ACORNAUT_PLAYWRIGHT` and `ACORNAUT_BROWSER` to existing local installations
when needed. `--baseline` captures the pinned base revision. The browser
script provides a local review server only and makes no remote writes.
