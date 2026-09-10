#!/usr/bin/env python3
"""Build the Acornaut landing page.

Two outputs from one source:

    python3 site-src/build.py --mode inline --out site-dist/acornaut-site.html
        One self-contained .html with every asset as a data: URI. This is what
        an Artifact needs - a strict CSP blocks external hosts, so nothing can
        be fetched. Big file, no caching, fine for a preview.

    python3 site-src/build.py --mode files --out site-dist/site
        index.html + assets/ + clips/. This is what a real host wants: assets
        cache independently, video can be range-requested, and the page paints
        long before the last byte arrives.

Run prep-assets.py first - it derives assets/ from docs/art/.
"""
import argparse, base64, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "site-src")
PARTS, ASSETS, CLIPS = (os.path.join(SRC, d) for d in ("parts", "assets", "clips"))

MIME = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4"}
CLIP_NAMES = ["hero.mp4", "worlds.mp4", "mode-fly.mp4", "mode-arcade.mp4",
              "mode-race.mp4", "squad.mp4"]

SITE_URL = "https://acornaut.io"
PLAY_URL = "https://acornaut.app"
DESCRIPTION = ("A free-to-play space adventure with optional in-app purchases, planned for "
               "Apple App Store, Google Play, Steam, and Windows. Try the browser preview.")


def part(n):
    return open(os.path.join(PARTS, n), encoding="utf-8").read()


def data_uri(path):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (MIME[os.path.splitext(path)[1].lower()],
                                      base64.b64encode(f.read()).decode())


class Emitter:
    """Resolves an asset name to whatever the chosen mode wants in the HTML."""

    def __init__(self, mode, out):
        self.mode, self.out = mode, out
        self.copied = set()

    def asset(self, name):
        src = os.path.join(ASSETS, name)
        if not os.path.exists(src):
            sys.exit("MISSING ASSET: " + name)
        if self.mode == "inline":
            return data_uri(src)
        self._copy(src, os.path.join(self.out, "assets", name))
        return "assets/" + name + "?v=" + self._version(src)

    def clip(self, name):
        src = os.path.join(CLIPS, name)
        if not os.path.exists(src):
            sys.exit("MISSING CLIP: " + name)
        if self.mode == "inline":
            return data_uri(src)
        self._copy(src, os.path.join(self.out, "clips", name))
        return "clips/" + name + "?v=" + self._version(src)

    @staticmethod
    def _version(src):
        with open(src, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()[:12]

    def _copy(self, src, dst):
        if dst in self.copied:
            return
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(src, "rb") as a, open(dst, "wb") as b:
            b.write(a.read())
        self.copied.add(dst)


HEAD_META = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{desc}">
<link rel="canonical" href="{site}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Acornaut">
<meta property="og:title" content="Acornaut — A little squirrel. A whole universe.">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{site}/">
<meta property="og:image" content="{site}/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Acornaut — A little squirrel. A whole universe.">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{site}/assets/og.jpg">
<meta name="theme-color" content="#080c18">
<link rel="icon" href="assets/favicon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
"""


def stamp_worker(out_dir):
    """Write sw.js with its cache name derived from everything else emitted.

    The worker answers assets cache-first and never revalidates inside a cache
    generation. Asset URLs also carry content hashes, so an older worker can
    never return an old asset for a new page. Derive the cache name from content
    and worker logic rather than relying on a manual version bump.

    Hashes the worker template and sorted (relative path, bytes) over the output, excluding sw.js
    itself, which would otherwise be circular. Deterministic: identical output
    gives an identical name, so redeploying unchanged content does not flush
    anyone's cache for nothing.
    """
    h = hashlib.sha256(part("sw.js").encode())
    for root, dirs, files in os.walk(out_dir):
        dirs.sort()
        for f in sorted(files):
            if f == "sw.js":
                continue
            full = os.path.join(root, f)
            h.update(os.path.relpath(full, out_dir).replace(os.sep, "/").encode())
            with open(full, "rb") as fh:
                h.update(fh.read())
    version = h.hexdigest()[:12]
    worker = part("sw.js").replace("__CACHE_VERSION__", version)
    if "__CACHE_VERSION__" in worker:
        sys.exit("sw.js: cache version placeholder still present after substitution")
    open(os.path.join(out_dir, "sw.js"), "w", encoding="utf-8").write(worker)
    return version


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("inline", "files"), default="inline")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    out_dir = args.out if args.mode == "files" else os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    em = Emitter(args.mode, out_dir)

    def resolve(name):
        return em.clip(name) if name.endswith(".mp4") else em.asset(name)

    page, css, demo, app = (part(n) for n in ("page.html", "styles.css", "demo.js", "app.js"))
    css = re.sub(r"assets/([\w.-]+)", lambda m: resolve(m.group(1)), css)
    demo = re.sub(r'"assets/([^" ]+)"', lambda m: json.dumps(resolve(m.group(1))), demo)
    # Preserve lazy video data-src names for the in-view loader.
    page = re.sub(r'(?<![\w-])(src|poster|srcset|href)="assets/([^" ]+)"',
                  lambda m: m.group(1) + '="' + resolve(m.group(2)) + '"', page)
    dynamic = re.findall(r"(?:video|poster):'([^']+)'", app)
    dynamic += ["hero.mp4", "worlds.mp4", "squad.mp4", "crew-showcase.mp4"]
    dynamic += re.findall(r'"id": "([^" ]+)"', app)
    dynamic = ["preview-%s.webp" % n if not "." in n else n for n in dynamic]
    media = {name: resolve(name) for name in sorted(set(dynamic))}
    scripts = '<script>window.__ACORNAUT_ASSETS__=' + json.dumps(media) + ';</script>'
    scripts += '<script>' + app + '</script><script>' + demo + '</script>'
    meta = HEAD_META.format(desc=DESCRIPTION, site=SITE_URL)
    if args.mode == "files":
        scripts += "<script>" + part("updates.js") + "</script>"
        meta += ('<link rel="manifest" href="manifest.webmanifest">'
                 '<script>(function(){try{'
                 'if(matchMedia("(display-mode: standalone)").matches||navigator.standalone){'
                 'location.replace("./arcade/");}'
                 '}catch(e){}})();</script>')
    page = page.replace("__SITE_CSS__", css).replace("__SITE_META__", meta).replace("__SITE_SCRIPTS__", scripts)
    if args.mode == "inline":
        page = re.sub(r'(?<![\w-])(href|src)="assets/([^" ]+)"',
                      lambda m: m.group(1) + '="' + resolve(m.group(2)) + '"', page)
        dst = args.out
    else:
        dst = os.path.join(out_dir, "index.html")
    open(dst, "w", encoding="utf-8").write(page)

    if args.mode == "files":
        open(os.path.join(out_dir, "robots.txt"), "w").write(
            "User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n" % SITE_URL)
        open(os.path.join(out_dir, "sitemap.xml"), "w").write(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            '  <url><loc>%s/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n'
            '</urlset>\n' % SITE_URL)
        open(os.path.join(out_dir, "CNAME"), "w").write("acornaut.io\n")
        # referenced from <head> rather than the body, so copy them explicitly
        for extra in ("og.jpg", "favicon-192.png", "apple-touch-icon.png"):
            em.asset(extra)
        # the app shell: the manifest is static, the worker is stamped
        open(os.path.join(out_dir, "manifest.webmanifest"), "w", encoding="utf-8").write(
            part("manifest.webmanifest"))
        stamp_worker(out_dir)

    size = os.path.getsize(dst)
    print("%s -> %s (%.2f MB)" % (args.mode, dst, size / 1048576))
    print("31 selectable suits, 6 gameplay modes, 4 cinematic films")
    if args.mode == "files":
        total = sum(os.path.getsize(os.path.join(r, f))
                    for r, _, fs in os.walk(out_dir) for f in fs)
        print("site total %.2f MB" % (total / 1048576))
        cache = re.search(r"const CACHE = '([^']+)'",
                          open(os.path.join(out_dir, "sw.js"), encoding="utf-8").read())
        print("sw cache   %s" % (cache.group(1) if cache else "?"))


if __name__ == "__main__":
    main()
