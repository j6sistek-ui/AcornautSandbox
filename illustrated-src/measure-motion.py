#!/usr/bin/env python3
"""Score a suit's motion bank against the roster the owner approved.

    python3 illustrated-src/measure-motion.py            # every bank
    python3 illustrated-src/measure-motion.py frost ghost # named suits

THIS IS A REPORT, NOT A GATE. It is deliberately not wired into
run-tests.mjs and always exits 0. Owner, 9 Sep 2026: "be careful gating
anything, they aren't changing any character i told you to freeze" - art
mid-regeneration must never be blocked by a number, so this tells you what
it measures and leaves the judgement to a person.

WHAT IT MEASURES, AND WHY THESE TWO NUMBERS

The obvious measure - how much a frame moves from the last one - predicts
NOTHING. Briella's Cat moves more between frames than anything else in the
game and is the owner's stated ideal ("the motion is incredible, honestly
ideal for standard to replicate against"; "the jitter of briella cat makes
it cute and wobbly"). Frost measures the cleanest displacement in the whole
roster and was called awful. So the test is never how much changes. It is
WHAT changes:

  tail work   ink that changes FAR from the head, over ink that changes
              near it. The arc that sells the flight. Cyber was praised
              precisely because "the tail does almost all the work", and
              Eclipse because "the deep tail movement drives its power".

  head drift  the head refusing to sit still, measured as NON-SMOOTH
              motion - the median second difference of the game's own
              per-frame DOME anchor. A deliberate pose change costs
              nothing here because it is smooth; a twitch costs everything.

ONE BAR PER BANK KIND - and getting this wrong is easy. A first pass put
the bar at TAIL >= 2.9 for everything, taken from robo/eclipse/bigbooty.
All three of those are SIXTEEN-FRAME TAP banks. Eclipse's own asc/desc
banks score 1.31 and 1.05, so the bar failed Eclipse - and failed Cryostar
and Verdant, which carry Eclipse's transferred motion and which the owner
had just approved as an exact match. Compared like for like they are fine:
cryostar 1.44 asc against eclipse 1.31 asc.

Measured within each kind, against the 9 Sep verdicts:

  MOTION BANKS (asc/desc) - HEAD DRIFT separates them, cleanly. Scored on
  the suit's WORST bank, because the pilot flies both:
      seraph    1.0px  approved      gemmie     8.2px  awful
      high orb  1.6px  ok-ish        frost      8.3px  awful
      eclipse   5.1px  approved      copper    10.1px  ok-ish
      cryostar  5.4px  approved      sammie    11.1px  awful
      verdant   6.3px  approved      ember     14.7px  awful
      leviathan 6.5px  ok-ish        voidsuit  14.7px  awful
                                     ghost     17.8px  teeter
                                     iontrim   19.0px  ok-ish
    TAIL WORK DOES NOT SEPARATE THEM - gemmie was called awful at 1.44
    while eclipse was approved at 1.31 - so it is reported but not judged.

    ONE HONEST OUTLIER: flight scores 13.2px and is on the frozen roster.
    The bar was NOT widened to let it through. The owner's verdict on it was
    the faintest given to anything on that list - "Just Ok but its base
    level, introductory and free, good" - so the measure and the owner
    agree. A CHECK on flight is a true reading, not a false alarm.

  TAP BANKS (16 frames) - TAIL WORK separates them:
      robo 2.91  eclipse 2.95  bigbooty 3.19, all praised.

LIMITS, STATED PLAINLY. The head measures need per-frame DOME anchors, so
suits that wear their own head - Cat, Briella's Cat, AcorNut, Volt, Cyber,
Arcflash - cannot be scored here at all and are listed as such. New art
has no anchors until someone sets them in the rig editor (docs/lab/rig/,
reachable from Help), so a freshly delivered sheet scores tail work only
until that pass is done. Neither number sees costume consistency - a
jacket appearing and disappearing between frames is invisible to both, and
is still the thing to check by eye.
"""
from __future__ import annotations
from pathlib import Path
import re
import sys

try:
    from PIL import Image
except ImportError:
    raise SystemExit("measure-motion.py needs Pillow: pip install pillow")
try:
    import numpy as np
except ImportError:
    raise SystemExit("measure-motion.py needs numpy: pip install numpy")

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "docs/art/suits"

# The judged number depends on the bank kind; see the note above.
TAP_TAIL_BAR = 2.9      # 16-frame tap banks: ink far from the head / near it
MOTION_DRIFT_BAR = 6.5  # asc/desc banks: px of non-smooth head motion, median


def dome_table() -> dict[tuple[str, str, int], list[float]]:
    """The game's own per-frame head anchors, read from the renderer."""
    src = (ROOT / "illustrated-src/game/draw.ts").read_text()
    out = {}
    for m in re.finditer(r'"([a-z0-9]+)-(asc|desc|tap|loop)-(\d+)":\s*\[([-\d.,\s]+)\]', src):
        out[(m.group(1), m.group(2), int(m.group(3)))] = [float(x) for x in m.group(4).split(",")]
    return out


def frames(sid: str, kind: str) -> list[Path]:
    return sorted(ART.glob(f"{sid}-{kind}-*.png"),
                  key=lambda p: int(re.search(r"-(\d+)\.png$", p.name).group(1)))


def score(sid: str, kind: str, dome) -> dict | None:
    fs = frames(sid, kind)
    if len(fs) < 3:
        return None
    anchors = [dome.get((sid, kind, i + 1)) for i in range(len(fs))]
    if not all(x is not None for x in anchors):
        # NO ANCHORS, NO SCORE. An earlier pass guessed a circle around the
        # ink's centre instead, and the guess was worthless: it put Cyber -
        # praised precisely because "the tail does almost all the work" - at
        # 0.07x, and Quill, called awful, at 11.31x. A number that wrong is
        # worse than no number, so the suit is reported as unscorable.
        return dict(kind=kind, n=len(fs), anchored=False)
    a = [np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)[..., 3] for p in fs]
    have = True

    near = far = 0.0
    H, W = a[0].shape
    yy, xx = np.mgrid[0:H, 0:W]
    for i in range(1, len(a)):
        d = np.abs(a[i] - a[i - 1])
        cx, cy, r = anchors[i][0], anchors[i][1], max(20.0, anchors[i][2])
        m = ((xx - cx) ** 2 + (yy - cy) ** 2) <= (r * 1.8) ** 2
        near += d[m].sum()
        far += d[~m].sum()
    tail = far / max(1.0, near)

    drift = worst = None
    where = ""
    if have:
        P = np.array([[v[0], v[1]] for v in anchors])
        d2 = np.linalg.norm(P[:-2] - 2 * P[1:-1] + P[2:], axis=1)
        drift, worst = float(np.median(d2)), float(np.max(d2))
        where = fs[int(np.argmax(d2)) + 2].name
    return dict(kind=kind, n=len(fs), tail=tail, drift=drift,
                worst=worst, where=where, anchored=have)


def main(argv: list[str]) -> int:
    dome = dome_table()
    pat = re.compile(r"([a-z0-9]+)-(?:asc|desc|tap|loop)-\d+\.png$")
    ids = sorted({m.group(1) for p in ART.glob("*-*-*.png") if (m := pat.match(p.name))})
    if argv:
        want = set(argv)
        for miss in sorted(want - set(ids)):
            print(f"no bank on disk for: {miss}")
        ids = [i for i in ids if i in want]

    motion, taps, unscorable = [], [], []
    for sid in ids:
        # Judged within its own kind: a tap bank is never compared against a
        # motion bank, which is the mistake that failed Eclipse.
        #
        # And judged on its WORST bank, not its best. Taking the better of
        # the two let every awful suit pass on the half that was fine -
        # sammie cleared at 4.6px on its climb while its dive sat at 11.1,
        # voidsuit at 5.7 against 14.7. The pilot flies both, so the suit is
        # only as good as the worse one.
        best = None
        for kind in ("asc", "desc"):
            r = score(sid, kind, dome)
            if r and r.get("anchored") and (best is None or r["drift"] > best["drift"]):
                best = r
        if best:
            motion.append((sid, best))
        t = score(sid, "tap", dome)
        if t and t.get("anchored"):
            taps.append((sid, t))
        if not best and not (t and t.get("anchored")):
            kinds = [k for k in ("asc", "desc", "tap", "loop") if frames(sid, k)]
            if kinds:
                unscorable.append((sid, "/".join(kinds)))

    if motion:
        print(f"\n  MOTION BANKS (asc/desc) — judged on HEAD DRIFT <= {MOTION_DRIFT_BAR}px")
        print(f"  {'suit':<13}{'bank':<6}{'head drift':>12}{'tail':>9}   verdict")
        print("  " + "-" * 64)
        for sid, r in sorted(motion, key=lambda kv: kv[1]["drift"]):
            ok = r["drift"] <= MOTION_DRIFT_BAR
            v = "clears the bar" if ok else f"CHECK — worst {r['worst']:.0f}px at {r['where']}"
            print(f"  {sid:<13}{r['kind']:<6}{r['drift']:>10.1f}px{r['tail']:>8.2f}x   {v}")
        print("  tail is reported, not judged: it does not separate motion banks")
        print("  (gemmie 1.44 was called awful, eclipse 1.31 approved).")

    if taps:
        print(f"\n  TAP BANKS (16 frames) — judged on TAIL WORK >= {TAP_TAIL_BAR}x")
        print(f"  {'suit':<13}{'tail':>9}{'head drift':>13}   verdict")
        print("  " + "-" * 64)
        for sid, r in sorted(taps, key=lambda kv: -kv[1]["tail"]):
            ok = r["tail"] >= TAP_TAIL_BAR
            print(f"  {sid:<13}{r['tail']:>8.2f}x{r['drift']:>11.1f}px   "
                  f"{'clears the bar' if ok else 'CHECK — tail short'}")

    if unscorable:
        print("\n  NOT SCORABLE — no per-frame dome anchors. Either the suit wears its")
        print("  own head (Cat, Briella's Cat, AcorNut, Volt, Cyber, Arcflash) or the")
        print("  anchors have not been set yet in the rig editor (docs/lab/rig/).")
        for sid, kinds in unscorable:
            print(f"    {sid:<13}{kinds}")

    print("\n  Neither number sees COSTUME consistency. A jacket appearing and")
    print("  disappearing between frames is invisible to both — check that by eye.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
