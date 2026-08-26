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
import argparse, base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "site-src")
PARTS, ASSETS, CLIPS = (os.path.join(SRC, d) for d in ("parts", "assets", "clips"))

MIME = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4"}
CLIP_NAMES = ["mode-fly.mp4", "mode-arcade.mp4", "mode-race.mp4", "squad.mp4"]

SITE_URL = "https://acornaut.io"
PLAY_URL = "https://acornaut.app"
DESCRIPTION = ("Fly a squirrel in a spacesuit through the gaps between hand-painted planets. "
               "Tap to flap is the whole control. Free in your browser — no install, no account.")


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
        return "assets/" + name

    def clip(self, name):
        src = os.path.join(CLIPS, name)
        if not os.path.exists(src):
            sys.exit("MISSING CLIP: " + name)
        if self.mode == "inline":
            return data_uri(src)
        self._copy(src, os.path.join(self.out, "clips", name))
        return "clips/" + name

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
<meta property="og:title" content="Acornaut — one tap, thirty suits, a hundred missions">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{site}/">
<meta property="og:image" content="{site}/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Acornaut — one tap, thirty suits, a hundred missions">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{site}/assets/og.jpg">
<meta name="theme-color" content="#080c18">
<link rel="icon" href="assets/favicon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("inline", "files"), default="inline")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    out_dir = args.out if args.mode == "files" else os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    em = Emitter(args.mode, out_dir)

    body = part("body1.part") + part("body2.part")
    body = re.sub(r"\{\{A:([^}]+)\}\}", lambda m: em.asset(m.group(1)), body)
    body = re.sub(r"\{\{V:([^}]+)\}\}", lambda m: m.group(1), body)

    suits = []
    for s in json.load(open(os.path.join(ASSETS, "suits.json"), encoding="utf-8")):
        if os.path.exists(os.path.join(ASSETS, "s-%s.webp" % s["id"])):
            suits.append({"id": s["id"], "name": s["name"], "glow": s["glow"] or "#c9b6ff",
                          "src": em.asset("s-%s.webp" % s["id"])})
    flap = [em.asset("flap-%d.webp" % i) for i in range(1, 17)]
    planets = [em.asset("p-%d.webp" % i) for i in (3, 7, 12, 18, 24, 29)]
    clips = {c: em.clip(c) for c in CLIP_NAMES}

    data = ("<script>window.__SUITS__=%s;window.__FLAP__=%s;window.__PLANETS__=%s;window.__CLIPS__=%s;</script>"
            % (json.dumps(suits), json.dumps(flap), json.dumps(planets), json.dumps(clips)))

    head = "\n".join([part("head.part"), part("head2.part"), part("head3.part")])
    page = "\n".join([head, body, data, part("js.part"), part("toy.part")])

    if args.mode == "inline":
        # the Artifact wrapper supplies <!doctype>/<head>/<body>
        dst = args.out
        open(dst, "w", encoding="utf-8").write(page)
    else:
        meta = HEAD_META.format(desc=DESCRIPTION, site=SITE_URL)
        head_end = page.rfind("</style>") + len("</style>")
        dst = os.path.join(out_dir, "index.html")
        open(dst, "w", encoding="utf-8").write(
            '<!doctype html>\n<html lang="en">\n<head>\n' + meta + page[:head_end]
            + '\n</head>\n<body>\n' + page[head_end:] + '\n</body>\n</html>\n')
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

    size = os.path.getsize(dst)
    print("%s -> %s (%.2f MB)" % (args.mode, dst, size / 1048576))
    print("suits %d  flap %d  planets %d  clips %d" % (len(suits), len(flap), len(planets), len(clips)))
    if args.mode == "files":
        total = sum(os.path.getsize(os.path.join(r, f))
                    for r, _, fs in os.walk(out_dir) for f in fs)
        print("site total %.2f MB" % (total / 1048576))


if __name__ == "__main__":
    main()
