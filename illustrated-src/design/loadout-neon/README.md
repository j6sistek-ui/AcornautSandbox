# Neon galaxy loadout

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

Build255 refreshes the browser module URLs. The export retains the prior
stamped builds under the repository's normal retention policy.

Validation and actual browser screenshots are recorded alongside this file.

## Review and validation

[Visual review](REVIEW.md) compares the original and updated menus and shows
three suit palettes, compact mode, a short phone, landscape and desktop.
The [browser receipt](browser-verification.json) records production and beta
build255 with the real UI in an isolated synthetic save, at 390x844, 320x568,
844x390 and 1440x900. It covers all five tabs, scrolling to the final existing
shop link, suit/helmet/trail/pal equip, the pal-effect switch, ship preview
and reset, shelf/grid selection and live canvas animation. Additional
captures check large balances, keyboard focus, existing premium favorites,
and the unchanged Shop case.
The completed review contains 20 screenshots (including two baseline images)
and 29 interaction checks, with zero page errors or failed art responses.

The export and lab build, TypeScript check, all 32 art QA groups, platform
bridge and bundle checks pass. The final complete harness invocation passed
all 52 tests, with zero failures or skips, on build 255. There is no repository lint command;
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
`ACORNAUT_PLAYWRIGHT` and `ACORNAUT_BROWSER` to existing local installations
when needed. `--baseline` captures the pinned base revision. The browser
script provides a local review server only and makes no remote writes.
