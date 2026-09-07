#!/usr/bin/env python3
"""Apply the owner's per-mode star-chart formulas to the live road.

    python3 illustrated-src/road-rules.py

Every mission on the road (illustrated-src/game/beta-campaign-manifest.ts)
whose mode has a rule below gets its gate count and three star goals
rewritten from its road number, and its contract and objective ids
recomputed the way test-star-map checks them (sha256 of the canonical
contract), so earned credit is keyed to the new contract, not the old.

Rules (owner, 7 Sep 2026):
  deep   - gates = road number; stars: finish, acorns 50% of gates,
           planet bounces 15% of gates
  lost   - gates = 60% of the road number; stars: finish, bounces 10% of
           gates, acorns 30% of gates
  arcade - gates = 10 per zone (stage x 10); stars: finish, no shield spent,
           acorns 50% of gates
  fly    - gates = 10 per zone (stage x 10) as a standard starting point; the
           tutorial (road 1) is exempt and keeps its 8; the
           goals are left as authored while the owner tunes each zone by hand
           (see the Free Flight sheet, illustrated-src/design/free-flight-tuning.xlsx)
"""
import hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "illustrated-src/game/beta-campaign-manifest.ts"

def pct(x, share): return max(1, round(x * share + 1e-9))

def rule(row):
    base, ordn, stage = row["base"], row["ord"], row["stage"]
    # THE TUTORIAL IS NOT A ROAD LEVEL (owner: "Dont change level 1! that is
    # the tutorial level"): the first flight keeps its authored 8 gates.
    if ordn == 1 or row.get("fx", {}).get("noFail"):
        return None
    if base == "deep":
        g = ordn
        return g, [{"kind": "finish"}, {"kind": "acorns", "n": pct(g, .5)}, {"kind": "bounces", "n": pct(g, .15)}]
    if base == "lost":
        g = pct(ordn, .6)
        return g, [{"kind": "finish"}, {"kind": "bounces", "n": pct(g, .10)}, {"kind": "acorns", "n": pct(g, .30)}]
    if base == "arcade":
        g = stage * 10
        return g, [{"kind": "finish"}, {"kind": "noShield"}, {"kind": "acorns", "n": pct(g, .5)}]
    if base == "fly":
        return stage * 10, None          # None: keep the authored goals
    return None

def canonical(x):
    if isinstance(x, list): return [canonical(v) for v in x]
    if isinstance(x, dict): return {k: canonical(x[k]) for k in sorted(x)}
    return x
def h(x): return hashlib.sha256(json.dumps(canonical(x), separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()[:16]

def main():
    lines = MANIFEST.read_text(encoding="utf8").split("\n")
    out, changed = [], []
    for line in lines:
        m = re.match(r"^(\s*)(\{.*\}),?\s*$", line)
        if not m: out.append(line); continue
        row = json.loads(m.group(2))
        r = rule(row)
        if not r: out.append(line); continue
        gates, goals = r
        if goals is None: goals = row["goals"]
        if row["gates"] == gates and row["goals"] == goals: out.append(line); continue
        row["gates"], row["goals"] = gates, goals
        if row.get("previousIds"):
            row["contractId"] = h({"base": row["base"], "gates": gates, "fx": row["fx"], "goals": goals, "spillFinish": row.get("spillFinish")})
            row["objectiveIds"] = [f"{row['variantId']}:{row['contractId']}:{i}" for i in range(len(goals))]
        else:
            row["contractId"] = h({"base": row["base"], "target": gates, "goals": goals})
            row["objectiveIds"] = [f"{row.get('variantId', row['id'])}:objective:{h({'base': row['base'], 'target': gates, 'goal': g})}" for g in goals]
        changed.append((row["ord"], row["base"], gates, goals))
        out.append(m.group(1) + json.dumps(row, separators=(",", ":"), ensure_ascii=False) + ",")
    MANIFEST.write_text("\n".join(out), encoding="utf8")
    print(f"{len(changed)} rows rewritten")
    for c in changed: print("  ", c[0], c[1], "gates", c[2], "goals", [g.get("n", g["kind"]) for g in c[3]])
    return 0

if __name__ == "__main__":
    sys.exit(main())
