# site-src — the acornaut.io landing page

Source for the marketing page. The game itself is unrelated to this folder:
nothing here ships to `docs/`, and `docs/` never imports from here.

## Pipeline

```
docs/art/  ──prep-assets.py──►  site-src/assets/   (web-sized art)
the game   ──capture/*.py────►  site-src/clips/    (gameplay video)
                    parts/  ──build.py──►  site-dist/
```

### 1. `prep-assets.py` — derive the art

```
python3 site-src/prep-assets.py
```

Reads `docs/art/` and the `SUITS` array in `illustrated-src/game/catalog.ts`,
writes web-sized WebP/JPEG into `assets/`. Re-run whenever the art changes.

`TOY_SUIT` at the top decides which suit flies in the playable strip — it reads
that suit's 16-frame tap bank, so it must be a suit whose bank is finished.

### 2. `capture/` — record gameplay

```
python3 -m http.server 8760 --directory docs &
chromium --headless=new --window-size=430,1223 --remote-debugging-port=9363 \
         --remote-allow-origins='*' --no-sandbox --disable-gpu about:blank &
python3 site-src/capture/capture.py 9363 fly 26 /tmp/m-fly
```

Drives the real game over CDP with an autopilot that lives in the page, on the
game's own frame clock, and records a screencast. `capture.py` flies the ordinary
gate modes (`fly`, `arcade`, `deep`, `lost`); `capture-race.py` flies Hyper Run,
which is press-and-hold and follows the ring course in `rings.json`.

The pilot's three constants — `RISE`, `L`, `MIN` — were tuned by measurement, not
guessed: the value in the file gives 0 deaths and a score of 15 over 26 seconds.
The rule that matters is *don't flap if the rise would carry you into the top
planet*; without it the pilot dies every four seconds.

Frames come out as JPEGs; encode a death-free stretch with ffmpeg into
`clips/mode-*.mp4` at 400px wide, CRF 31.

### 3. `build.py` — assemble

```
python3 site-src/build.py --mode files  --out site-dist/site        # acornaut.io
python3 site-src/build.py --mode inline --out site-dist/page.html   # Artifact preview
```

`files` emits `index.html` + `assets/` + `clips/` + `CNAME`/`robots.txt`/
`sitemap.xml`. `inline` emits one self-contained HTML with every asset as a
`data:` URI — required for Artifacts, whose CSP blocks every external host.

Both modes render the same page; a parity check on visible text confirms it.

## Deploying

Automatic. `.github/workflows/deploy-site.yml` fires on any push to `main` that
touches `site-src/`, rebuilds, and pushes the output to `j6sistek-ui/acornaut`,
which serves acornaut.io from its repo root. Live in about two minutes.

It needs one secret: `ACORNAUT_DEPLOY_TOKEN`, a fine-grained PAT scoped to
`j6sistek-ui/acornaut` alone with *Contents: Read and write*. Nothing else needs
a credential — both repos are public, so the source checkout uses `GITHUB_TOKEN`.

The workflow only writes paths the build owns: `index.html`, `assets/`, `clips/`,
`manifest.webmanifest`, `sw.js`, `robots.txt`, `sitemap.xml`, `CNAME`. It never
touches `arcade/`, `beta/`, `LICENSE`, `README.md` or the root icons, and a guard
step fails the run if the arcade shell or the manifest's `start_url` went missing.

**Do not hand-edit the landing page in the acornaut repo.** Edit here and push;
anything edited there is overwritten on the next deploy.

### Why sw.js is generated

The worker answers assets **cache-first** and never revalidates inside a cache
generation, so the cache NAME is the site's only cache-busting mechanism. It used
to be a hardcoded constant with a comment saying it "MUST change on every
release" — the kind of instruction that gets missed, after which a changed asset
is invisible to every returning visitor forever.

`build.py` now stamps it from a sha256 over everything else it emits. Identical
output keeps the same name, so a no-op redeploy doesn't flush anyone's cache;
any content change produces a new name, and the existing `activate` handler
purges the old generation. `parts/sw.js` is the template — edit that, not the
generated file, and leave `__CACHE_VERSION__` alone.

The page's Play controls point at `https://acornaut.app`, which is this repo's
`docs/` — the two sites stay independent.
