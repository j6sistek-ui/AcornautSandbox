// THE RIG EDITOR — a lab tool, not part of the game.
//
// The game seats a helmet on a head with two numbers tables and one line of
// arithmetic. DOME says where each suit's head is and how big, in that
// suit's own 256px canvas. HELM_GLASS says where each helmet's glass circle
// is and how big, in the helmet's own canvas. Everything else follows:
//
//   scale = size / max(box.w, box.h)          // suit sprite, trimmed
//   hx    = x - box.w*scale/2 + (a[0]-box.x)*scale
//   r     = a[2] * scale
//   s2    = r * 1.04 / g[2]
//   helmet drawn at (hx - g[0]*s2, hy - g[1]*s2)
//
// Two tables — one triple per suit and one per helmet, not one per
// pairing. That is deliberate and this editor protects it: you edit the
// SUIT's head or the HELMET's glass, and the fix lands everywhere at once.
// Per-pair overrides exist, but as a DIAGNOSTIC (see foldable() below) —
// if one helmet needs the same nudge on twelve suits, the helmet's number
// is wrong, and the editor says so.
//
// Nothing here writes to the repo. Work is kept in localStorage and comes
// back out as JSON or as paste-ready TypeScript.

type Tri = [number, number, number, number?]; // x, y, r, pose rotation (deg, frames only)
type Glass = [number, number, number, number]; // x, y, r, rotation (deg)
type Delta = [number, number, number, number]; // dx, dy, dScale, dRot

type SuitRow = {
  id: string;
  name: string;
  key: string;      // the DOME key: "suit:flight", "idle-1", ...
  file: string;     // relative to the art root
  dome: Tri;
  ownHead: boolean;
  bakedDome: boolean;
  frame: boolean;
};
type HelmRow = {
  id: string;
  name: string;
  file: string;
  glass: Glass;
  suitOnly?: string;    // locked to one suit; the game snaps to Clear elsewhere
  opaqueVisor?: boolean; // never punched — the visor is meant to hide the face
};

type Tables = { artVer: string; suits: SuitRow[]; helmets: HelmRow[] };

type Box = { x: number; y: number; w: number; h: number };
type Loaded = { img: HTMLImageElement; box: Box };

const STORE = "acornaut.rig.v1";
const ART = () => (window as any).__ACORNAUT_ART__ || "../../art";

// ---------------------------------------------------------------- loading

const bank = new Map<string, Loaded>();

function measure(img: HTMLImageElement): Box {
  // measureSprite from art.ts, to the letter. The trimmed box is what the
  // whole contract is expressed in — measure it differently here and the
  // editor would be a very convincing lie.
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { x: 0, y: 0, w, h };
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return { x: 0, y: 0, w, h };
  const pad = 2;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX - minX + 1 + pad * 2),
    h: Math.min(h, maxY - minY + 1 + pad * 2),
  };
}

function load(file: string, ver: string): Promise<Loaded | null> {
  const hit = bank.get(file);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const rec = { img, box: measure(img) };
      bank.set(file, rec);
      resolve(rec);
    };
    img.onerror = () => resolve(null);
    img.src = `${ART()}/${file}?v=${ver}`;
  });
}

// The helmet with its glass punched translucent, exactly as the game does
// it — otherwise a solid visor hides the very misalignment you are here to
// see, and Clear (which is fully opaque by design) would tell you nothing.
const punched = new Map<string, HTMLCanvasElement>();
const LIGHT_OPAQUE_VISORS = new Set([
  "gemmie", "phoenix", "sammie", "seraph",
  "chronarch", "paladin", "princess",
]);
function punch(rec: Loaded, id: string, g: Glass, opaque = false) {
  const memo = `${id}:${g[2].toFixed(2)}:${g[0].toFixed(1)}:${g[1].toFixed(1)}`;
  const hit = punched.get(memo);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = rec.img.naturalWidth;
  c.height = rec.img.naturalHeight;
  const cc = c.getContext("2d")!;
  cc.drawImage(rec.img, 0, 0);
  // an opaqueVisor helmet is never punched in the game — punching it here
  // would let you fit a face the player never sees
  if (opaque) {
    punched.set(memo, c);
    while (punched.size > 48) punched.delete(punched.keys().next().value as string);
    return c;
  }
  const strong = LIGHT_OPAQUE_VISORS.has(id);
  const grad = cc.createRadialGradient(
    g[0], g[1], g[2] * 0.1,
    g[0], g[1], g[2] * (strong ? 0.88 : 0.82),
  );
  grad.addColorStop(0, `rgba(0,0,0,${strong ? 0.88 : 0.55})`);
  grad.addColorStop(0.7, `rgba(0,0,0,${strong ? 0.62 : 0.3})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  cc.globalCompositeOperation = "destination-out";
  cc.fillStyle = grad;
  cc.fillRect(0, 0, c.width, c.height);
  punched.set(memo, c);
  // each entry is a full-size canvas — a drag mints one per frame, so the
  // cache has to be bounded or a phone runs out of memory mid-fit
  while (punched.size > 48) punched.delete(punched.keys().next().value as string);
  return c;
}

// ------------------------------------------------------------------ state

type Mode = "one" | "suit" | "helm" | "frames" | "all";
type Target = "helm" | "suit" | "pair";
/** Does a SIZE or ROT press move the one tile you picked, or everything
 *  the current view is filtered down to? A recalibration pass is mostly
 *  the second: sixteen frames of one bank all sit a touch too big. */
type Scope = "one" | "view";

const S = {
  tables: null as Tables | null,
  base: null as Tables | null,      // pristine copy, for diffing
  over: {} as Record<string, Delta>,
  mode: "suit" as Mode,
  suit: "flight",
  helm: "clear",
  target: "helm" as Target,
  rings: true,
  ghost: false,
  active: "" as string,             // "suitId|helmId" of the tile being edited
  scope: "one" as Scope,            // what SIZE and ROT reach
  locks: {} as Record<string, true>,
};

// One snapshot per GESTURE (drag, pad press, wheel burst, pinch), so an
// accidental swipe-that-edited is one UNDO away instead of a hand re-fit.
// Whole-table snapshots are a few KB; thirty of them is nothing.
const undoStack: string[] = [];
function checkpoint() {
  if (!S.tables) return;
  undoStack.push(JSON.stringify({
    suits: S.tables.suits.map((s) => [s.key, s.dome]),
    helmets: S.tables.helmets.map((h) => [h.id, h.glass]),
    over: S.over,
  }));
  if (undoStack.length > 30) undoStack.shift();
}
function undo(): boolean {
  const raw = undoStack.pop();
  if (!raw || !S.tables) return false;
  const d = JSON.parse(raw);
  const domes = new Map<string, Tri>(d.suits);
  const glasses = new Map<string, Glass>(d.helmets);
  for (const s of S.tables.suits) { const v = domes.get(s.key); if (v) s.dome = v; }
  for (const h of S.tables.helmets) { const v = glasses.get(h.id); if (v) h.glass = v; }
  S.over = d.over || {};
  punched.clear();
  return true;
}

const pairKey = (s: string, h: string) => `${s}|${h}`;
const suitOf = (id: string) => S.tables!.suits.find((s) => s.id === id)!;
const helmOf = (id: string) => S.tables!.helmets.find((h) => h.id === id)!;

// WHAT A LOCK PROTECTS IS THE NUMBER, NOT THE TILE. A suit's head is one
// number shown under thirty helmets; locking the tile you happen to be
// looking at would leave the same number wide open on the other
// twenty-nine, which is exactly the accident being guarded against - a
// stray drag on the everything page, or a bulk press aimed at the rest of
// the view. So the key names the record the current target writes to, and
// the lock holds wherever that record is reachable.
function lockKey(s: SuitRow, h: HelmRow) {
  return S.target === "suit"
    ? "suit:" + s.key
    : S.target === "pair"
    ? "pair:" + pairKey(s.id, h.id)
    : "helm:" + h.id;
}
const isLocked = (s: SuitRow, h: HelmRow) => !!S.locks[lockKey(s, h)];

function effective(s: SuitRow, h: HelmRow) {
  const ov = S.over[pairKey(s.id, h.id)];
  const a: Tri = ov
    ? [s.dome[0] + ov[0], s.dome[1] + ov[1], s.dome[2] * (1 + ov[2])]
    : [s.dome[0], s.dome[1], s.dome[2]];
  // a motion frame's dome carries its own pose rotation as a 4th value -
  // the game adds it to the glass rot, so the editor previews the same sum
  const rot = h.glass[3] + (s.dome[3] || 0) + (ov ? ov[3] : 0);
  return { a, g: h.glass, rot };
}

function saveLocal() {
  if (!S.tables) return;
  try {
    localStorage.setItem(
      STORE,
      JSON.stringify({
        suits: Object.fromEntries(S.tables.suits.map((s) => [s.key, s.dome])),
        helmets: Object.fromEntries(S.tables.helmets.map((h) => [h.id, h.glass])),
        over: S.over,
        locks: S.locks,
      }),
    );
  } catch {
    /* private mode; the copy button still works */
  }
}

function restoreLocal() {
  if (!S.tables) return;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    // slice(0, 4), not 3: a frame's fourth number is its pose rotation, and
    // truncating here quietly threw away every rotation dialled in the last
    // session the moment the page reloaded.
    for (const s of S.tables.suits) if (d.suits?.[s.key]) s.dome = d.suits[s.key].slice(0, 4);
    for (const h of S.tables.helmets) {
      const g = d.helmets?.[h.id];
      if (g) h.glass = [g[0], g[1], g[2], g[3] || 0];
    }
    S.over = d.over || {};
    S.locks = d.locks || {};
  } catch {
    /* a corrupt draft is not worth a broken page */
  }
}

// ------------------------------------------------------------------ paint

function paintTile(cv: HTMLCanvasElement, s: SuitRow, h: HelmRow, size: number) {
  const ctx = cv.getContext("2d")!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(size * dpr)) {
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const body = bank.get(s.file);
  if (!body) return;
  const draw = size * 0.82;
  const x = size / 2;
  const y = size / 2;
  const box = body.box;
  const scale = draw / Math.max(1, Math.max(box.w, box.h));

  ctx.drawImage(body.img, box.x, box.y, box.w, box.h,
                x - (box.w * scale) / 2, y - (box.h * scale) / 2, box.w * scale, box.h * scale);

  // catsuit brings its own head; the game never paints a dome on it
  if (s.ownHead) {
    label(ctx, "own head — no helmet", size);
    return;
  }
  // Being an animation frame does not imply a painted dome: every suit
  // motion bank is bare-headed and wears Clear through the same seat as
  // other helmets. Only genuinely baked artwork skips the overlay.
  const skip = h.id === "clear" && s.bakedDome;

  const { a, g, rot } = effective(s, h);
  const hx = x - (box.w * scale) / 2 + (a[0] - box.x) * scale;
  const hy = y - (box.h * scale) / 2 + (a[1] - box.y) * scale;
  const r = a[2] * scale;

  // a suit-locked helmet on the wrong suit is a pairing the game refuses —
  // it snaps back to Clear — so there is nothing here to fit
  if (h.suitOnly && h.suitOnly !== s.id) {
    label(ctx, `locked to ${h.suitOnly} — game falls back to Clear`, size);
    return;
  }

  const helm = bank.get(h.file);
  if (helm && !skip) {
    const s2 = (r * 1.04) / g[2];
    const p = punch(helm, h.id, g, h.opaqueVisor === true);
    ctx.save();
    ctx.globalAlpha = S.ghost ? 0.45 : 1;
    if (rot) {
      ctx.translate(hx, hy);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.translate(-hx, -hy);
    }
    ctx.drawImage(p, hx - g[0] * s2, hy - g[1] * s2, p.width * s2, p.height * s2);
    ctx.restore();
  }

  if (S.rings) {
    // the head circle the contract is built on, and the 1.04 seat the
    // helmet is actually scaled to
    ctx.save();
    ctx.strokeStyle = "rgba(110,220,255,.85)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,190,90,.55)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(hx, hy, r * 1.04, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(110,220,255,.9)";
    ctx.fillRect(hx - 3, hy - 0.5, 6, 1);
    ctx.fillRect(hx - 0.5, hy - 3, 1, 6);
    ctx.restore();
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, size: number) {
  ctx.save();
  ctx.fillStyle = "rgba(150,165,200,.75)";
  ctx.font = "600 9px Figtree, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, size / 2, size - 6);
  ctx.restore();
}

// ------------------------------------------------------------------- edit

function nudge(dxScreen: number, dyScreen: number, s: SuitRow, h: HelmRow, scale: number) {
  if (S.target === "suit") {
    s.dome[0] += dxScreen / scale;
    s.dome[1] += dyScreen / scale;
  } else if (S.target === "pair") {
    const k = pairKey(s.id, h.id);
    const ov = (S.over[k] ||= [0, 0, 0, 0]);
    ov[0] += dxScreen / scale;
    ov[1] += dyScreen / scale;
  } else {
    // moving the helmet right means its glass centre sits further LEFT
    // inside its own frame — the drawn origin is (hx - g[0]*s2)
    const { a, g } = effective(s, h);
    const s2 = (a[2] * scale * 1.04) / g[2];
    h.glass[0] -= dxScreen / s2;
    h.glass[1] -= dyScreen / s2;
  }
}

// The D-pad and the arrow keys work in TABLE units, not screen pixels. A
// drag has to follow your finger, which on a 110px tile means one pixel of
// travel is five units of glass — fine for finding the fix, useless for
// landing it. This is the other half of that: one press, one unit, whatever
// the tile is.
function nudgeUnits(dx: number, dy: number, s: SuitRow, h: HelmRow) {
  if (S.target === "suit") {
    s.dome[0] += dx;
    s.dome[1] += dy;
  } else if (S.target === "pair") {
    const k = pairKey(s.id, h.id);
    const ov = (S.over[k] ||= [0, 0, 0, 0]);
    ov[0] += dx;
    ov[1] += dy;
  } else {
    h.glass[0] -= dx;
    h.glass[1] -= dy;
  }
}

function resize(k: number, s: SuitRow, h: HelmRow) {
  if (S.target === "suit") {
    s.dome[2] *= k;
  } else if (S.target === "pair") {
    const key = pairKey(s.id, h.id);
    const ov = (S.over[key] ||= [0, 0, 0, 0]);
    ov[2] = (1 + ov[2]) * k - 1;
  } else {
    // a bigger helmet on the same head means a smaller glass radius
    h.glass[2] /= k;
  }
}

function spin(deg: number, s: SuitRow, h: HelmRow) {
  if (S.target === "pair") {
    const key = pairKey(s.id, h.id);
    const ov = (S.over[key] ||= [0, 0, 0, 0]);
    ov[3] += deg;
  } else if (s.frame) {
    // in the frames view ROT dials THIS FRAME's pose rotation, not the
    // helmet art's - one frame's dive angle must never re-tilt the glass
    // under every suit on the roster
    s.dome[3] = (s.dome[3] || 0) + deg;
  } else {
    h.glass[3] += deg;
  }
}

function resetTile(s: SuitRow, h: HelmRow) {
  const b = S.base!;
  if (S.target === "suit") {
    s.dome = b.suits.find((x) => x.key === s.key)!.dome.slice(0, 4) as Tri;
  } else if (S.target === "pair") {
    delete S.over[pairKey(s.id, h.id)];
  } else {
    h.glass = b.helmets.find((x) => x.id === h.id)!.glass.slice(0, 4) as Glass;
  }
}

// A helmet carrying the same override on many suits is not twenty local
// problems; it is one wrong glass number. Folding the median of its
// overrides into the helmet and clearing them is the fix, and the count is
// the evidence.
function foldable(h: HelmRow) {
  const ds = Object.entries(S.over).filter(([k]) => k.endsWith("|" + h.id));
  return ds.length >= 3 ? ds : null;
}

function fold(h: HelmRow) {
  const ds = foldable(h);
  if (!ds) return 0;
  const med = (xs: number[]) => {
    const a = xs.slice().sort((p, q) => p - q);
    return a[Math.floor(a.length / 2)];
  };
  const dx = med(ds.map(([, v]) => v[0]));
  const dy = med(ds.map(([, v]) => v[1]));
  const dk = med(ds.map(([, v]) => v[2]));
  const dr = med(ds.map(([, v]) => v[3]));

  // An override says "on this suit the helmet wanted to be elsewhere".
  // Re-expressed on the helmet: the seat scale is s2 = r*1.04/g[2], so
  // growing the head by (1+dk) and shrinking the glass by the same factor
  // are the same drawing. The offset converts through that scale —
  // Δorigin = -Δg*s2, so a head nudge of +dx becomes a glass nudge of
  // -dx*g[2]/(r*1.04). r differs per suit, which is precisely why the fold
  // is an ESTIMATE: it uses the median head radius of the suits involved
  // and leaves the residue for you to see in the grid.
  h.glass[2] /= 1 + dk;
  const rMed = med(ds.map(([k]) => suitOf(k.split("|")[0]).dome[2]));
  const conv = h.glass[2] / (rMed * 1.04);
  h.glass[0] -= dx * conv;
  h.glass[1] -= dy * conv;
  h.glass[3] += dr;
  for (const [k] of ds) delete S.over[k];
  punched.clear();
  return ds.length;
}

// -------------------------------------------------------------- reporting

function round(n: number, p = 0) {
  const f = Math.pow(10, p);
  return Math.round(n * f) / f;
}

function changes() {
  const b = S.base!;
  const suits = S.tables!.suits.filter((s) => {
    const o = b.suits.find((x) => x.key === s.key)!;
    return s.dome.some((v, i) => Math.abs(v - o.dome[i]) > 0.5);
  });
  const helmets = S.tables!.helmets.filter((h) => {
    const o = b.helmets.find((x) => x.id === h.id)!;
    return h.glass.some((v, i) => Math.abs(v - o.glass[i]) > 0.5);
  });
  return { suits, helmets, over: S.over };
}

function reportJSON() {
  const c = changes();
  const b = S.base!;
  return JSON.stringify(
    {
      note: "acornaut rig editor — changed values only",
      DOME: Object.fromEntries(
        c.suits.map((s) => [
          s.key,
          {
            was: b.suits.find((x) => x.key === s.key)!.dome,
            now: s.dome.map((v) => round(v)),
          },
        ]),
      ),
      HELM_GLASS: Object.fromEntries(
        c.helmets.map((h) => [
          h.id,
          {
            was: b.helmets.find((x) => x.id === h.id)!.glass.slice(0, h.glass[3] ? 4 : 3),
            now: h.glass.slice(0, h.glass[3] ? 4 : 3).map((v) => round(v, 1)),
          },
        ]),
      ),
      pairOverrides: Object.fromEntries(
        Object.entries(c.over).map(([k, v]) => [k, v.map((n) => round(n, 2))]),
      ),
    },
    null,
    1,
  );
}

function reportTS() {
  const c = changes();
  const out: string[] = [];
  if (c.suits.length) {
    out.push("// draw.ts — DOME");
    for (const s of c.suits) {
      out.push(`  "${s.key}": [${s.dome.map((v) => round(v)).join(", ")}],`);
    }
  }
  if (c.helmets.length) {
    out.push("// draw.ts — HELM_GLASS");
    for (const h of c.helmets) {
      const n = h.glass[3] ? 4 : 3;
      out.push(`  "${h.id}": [${h.glass.slice(0, n).map((v) => round(v, 1)).join(", ")}],`);
    }
  }
  const ov = Object.entries(c.over);
  if (ov.length) {
    out.push(`// ${ov.length} per-pair override(s) — diagnostics, not values to paste:`);
    for (const [k, v] of ov) out.push(`//   ${k}  dx ${round(v[0], 1)}  dy ${round(v[1], 1)}  size ${round(v[2] * 100, 1)}%  rot ${round(v[3], 1)}°`);
  }
  return out.length ? out.join("\n") : "// nothing changed yet";
}

// --------------------------------------------------------------------- UI

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

// press-and-hold repeat: forty taps to move a helmet four pixels is not a
// control, it is a punishment
function hold(btn: HTMLElement, fn: () => void) {
  let t1 = 0;
  let t2 = 0;
  const stop = () => {
    clearTimeout(t1);
    clearInterval(t2);
  };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    checkpoint();
    fn();
    t1 = window.setTimeout(() => {
      t2 = window.setInterval(fn, 55);
    }, 380);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
    btn.addEventListener(ev, stop);
  }
}

export async function bootRig(root: HTMLElement) {
  root.innerHTML = "";
  const loading = el("div", "rg-boot", "loading art…");
  root.append(loading);

  const res = await fetch("./tables.json?v=" + Date.now());
  const tables: Tables = await res.json();
  S.tables = tables;
  S.base = JSON.parse(JSON.stringify(tables));
  restoreLocal();

  // one pass over every sprite up front: measuring is the expensive part
  // and every tile needs the same trimmed boxes
  const files = new Set<string>();
  tables.suits.forEach((s) => files.add(s.file));
  tables.helmets.forEach((h) => files.add(h.file));
  let done = 0;
  await Promise.all(
    [...files].map((f) =>
      load(f, tables.artVer).then(() => {
        done++;
        loading.textContent = `loading art… ${done}/${files.size}`;
      }),
    ),
  );
  loading.remove();

  // ---- chrome
  const bar = el("div", "rg-bar");
  const mkSel = (opts: { v: string; t: string }[], val: string, on: (v: string) => void) => {
    const s = el("select", "rg-sel");
    for (const o of opts) {
      const op = el("option", "", o.t);
      (op as HTMLOptionElement).value = o.v;
      s.append(op);
    }
    (s as HTMLSelectElement).value = val;
    s.onchange = () => on((s as HTMLSelectElement).value);
    return s as HTMLSelectElement;
  };

  const modeSel = mkSel(
    [
      { v: "suit", t: "one suit × all helmets" },
      { v: "helm", t: "one helmet × all suits" },
      { v: "frames", t: "one helmet × animation frames" },
      { v: "one", t: "one × one" },
      { v: "all", t: "everything" },
    ],
    S.mode,
    (v) => {
      S.mode = v as Mode;
      // A FITTING PASS OVER FRAMES EDITS FRAMES. In the frames view the
      // whole point is per-frame numbers, and the HELMET target would make
      // one drag move every tile at once - the owner hit exactly that. So
      // entering the view snaps the target to the frame's own head.
      if (v === "frames") S.target = "suit";
      build();
    },
  );
  const suitSel = mkSel(
    tables.suits.filter((s) => !s.frame).map((s) => ({ v: s.id, t: s.name })),
    S.suit,
    (v) => {
      S.suit = v;
      build();
    },
  );
  const helmSel = mkSel(
    tables.helmets.map((h) => ({ v: h.id, t: h.suitOnly ? `${h.name} (${h.suitOnly} only)` : h.name })),
    S.helm,
    (v) => {
      S.helm = v;
      build();
    },
  );
  bar.append(modeSel, suitSel, helmSel);

  const tbar = el("div", "rg-bar rg-sub");
  const tWrap = el("div", "rg-seg");
  const tBtns: Record<Target, HTMLElement> = {} as any;
  (
    [
      ["helm", "HELMET"],
      ["suit", "SUIT HEAD"],
      ["pair", "THIS PAIR"],
    ] as [Target, string][]
  ).forEach(([v, t]) => {
    const b = el("button", "rg-segb", t);
    b.onclick = () => {
      S.target = v;
      syncTarget();
      paintAll();
    };
    tBtns[v] = b;
    tWrap.append(b);
  });
  const ringsB = el("button", "rg-tog", "RINGS");
  ringsB.onclick = () => {
    S.rings = !S.rings;
    ringsB.classList.toggle("on", S.rings);
    paintAll();
  };
  const ghostB = el("button", "rg-tog", "FADE");
  ghostB.onclick = () => {
    S.ghost = !S.ghost;
    ghostB.classList.toggle("on", S.ghost);
    paintAll();
  };
  tbar.append(tWrap, ringsB, ghostB);
  const hint = el("p", "rg-hint");

  const stage = el("div", "rg-stage");

  // ---- footer: everything the phone needs, because a pinch on a 110px
  // tile is not a control surface
  const foot = el("div", "rg-foot");
  const pad = el("div", "rg-pad");
  const mkPad = (t: string, dx: number, dy: number) => {
    const b = el("button", "rg-pb", t);
    const go = () => withActive((s, h) => nudgeUnits(dx, dy, s, h));
    hold(b, go);
    return b;
  };
  pad.append(
    el("span", ""), mkPad("↑", 0, -1), el("span", ""),
    mkPad("←", -1, 0), el("span", "rg-pc"), mkPad("→", 1, 0),
    el("span", ""), mkPad("↓", 0, 1), el("span", ""),
  );
  // THE SCOPE SWITCH SITS ON TOP OF THE DIALS IT GOVERNS, so there is no
  // guessing what a press is about to reach.
  const scopeB = {} as Record<Scope, HTMLButtonElement>;
  const scopeWrap = el("div", "rg-scope");
  for (const [v, t] of [["one", "SELECTED"], ["view", "ALL IN VIEW"]] as [Scope, string][]) {
    const b = el("button", "rg-sc", t);
    b.onclick = () => {
      S.scope = v;
      syncScope();
    };
    scopeB[v] = b;
    scopeWrap.append(b);
  }
  const dials = el("div", "rg-dials");
  const mkDial = (name: string, minus: () => void, plus: () => void) => {
    const w = el("div", "rg-dial");
    const a = el("button", "rg-pb", "−");
    const b = el("button", "rg-pb", "+");
    hold(a, minus);
    hold(b, plus);
    w.append(a, el("span", "rg-dl", name), b);
    return w;
  };
  dials.append(
    scopeWrap,
    mkDial("SIZE", () => withScope((s, h) => resize(1 / 1.02, s, h)), () => withScope((s, h) => resize(1.02, s, h))),
    mkDial("ROT", () => withScope((s, h) => spin(-2, s, h)), () => withScope((s, h) => spin(2, s, h))),
  );
  const acts = el("div", "rg-acts");
  const undoB = el("button", "rg-act", "UNDO");
  undoB.onclick = () => {
    if (undo()) { paintAll(); flash("undone"); }
    else flash("nothing to undo");
  };
  const resetB = el("button", "rg-act", "RESET");
  resetB.onclick = () => withActive((s, h) => resetTile(s, h));
  const foldB = el("button", "rg-act rg-fold", "FOLD");
  foldB.onclick = () => {
    const h = helmOf(activeHelm());
    const n = fold(h);
    if (n) flash(`folded ${n} overrides into ${h.name}`);
    build();
  };
  const lockB = el("button", "rg-act rg-lock", "LOCK");
  lockB.onclick = () => {
    const t = activeTile();
    if (!t) return;
    const k = lockKey(t.s, t.h);
    const what = S.target === "suit" ? `${t.s.name}'s head`
      : S.target === "pair" ? `${t.s.name} × ${t.h.name}`
      : `${t.h.name}'s glass`;
    if (S.locks[k]) { delete S.locks[k]; flash(`unlocked ${what}`); }
    else { S.locks[k] = true; flash(`locked ${what}`); }
    saveLocal();
    paintAll();
  };
  const copyB = el("button", "rg-act rg-go", "COPY");
  copyB.onclick = () => showReport();
  acts.append(undoB, resetB, lockB, foldB, copyB);
  foot.append(pad, dials, acts);

  const stat = el("div", "rg-stat");
  const toast = el("div", "rg-toast");

  root.append(bar, tbar, hint, stage, stat, foot, toast);

  let toastT = 0;
  function flash(msg: string) {
    toast.textContent = msg;
    toast.classList.add("on");
    clearTimeout(toastT);
    toastT = window.setTimeout(() => toast.classList.remove("on"), 2200);
  }

  function syncTarget() {
    for (const k of Object.keys(tBtns) as Target[]) tBtns[k].classList.toggle("on", S.target === k);
    // On screen BOTH targets move the helmet — the suit's painting never
    // moves, the helmet is the only thing seated on a number. What differs
    // is WHICH number you are editing and how far the fix travels.
    hint.textContent =
      S.target === "helm"
        ? "Tap a tile to select it, then drag. HELMET edits this helmet's own glass number — the fix lands on every suit that wears it."
        : S.target === "suit"
        ? "Tap a tile to select it, then drag. SUIT HEAD edits where this suit's head is — the helmet follows here and under every other helmet. The suit's painting itself never moves; the blue ring is what you are placing."
        : "Tap a tile to select it, then drag. THIS PAIR writes a local override — evidence, not a fix. Three on one helmet and FOLD turns them into the helmet's own number.";
  }

  // ---- tiles
  type Tile = { cv: HTMLCanvasElement; s: SuitRow; h: HelmRow; size: number; wrap: HTMLElement; touchSync?: () => void };
  let tiles: Tile[] = [];

  function pairs(): [SuitRow, HelmRow][] {
    const wearable = tables.suits.filter((s) => !s.ownHead);
    // a suit-locked helmet exists on exactly one suit — every other pairing
    // is one the game refuses, and a grid of refusals is noise, not evidence
    const wears = (s: SuitRow, h: HelmRow) => !h.suitOnly || h.suitOnly === s.id;
    if (S.mode === "one") return [[suitOf(S.suit), helmOf(S.helm)]];
    if (S.mode === "suit")
      return tables.helmets
        .filter((h) => wears(suitOf(S.suit), h))
        .map((h) => [suitOf(S.suit), h] as [SuitRow, HelmRow]);
    if (S.mode === "helm")
      return wearable
        .filter((s) => wears(s, helmOf(S.helm)))
        .map((s) => [s, helmOf(S.helm)] as [SuitRow, HelmRow]);
    // the fitting pass the frame entries exist for: every animation frame
    // in one screen under one helmet, no statics between them. OWN-HEAD
    // frames (Alien, Alien 2, Cyber) join this view too - not to seat a
    // helmet, but because it is the one place every frame of a bank sits
    // side by side for review; their tiles draw the art and the own-head
    // label, nothing to drag.
    // ONE SUIT AT A TIME (owner, 2 Sep 2026: "load one suit, then pick
    // helmet, toggle apply-to-all or just that one, move it, next
    // helmet"). Every frame of every bank in one grid was 528 tiles and
    // unreadable; the suit selector now picks whose frames are shown, and
    // the helmet selector walks the helmets over them. SUIT HEAD writes
    // the frame's own anchor (every helmet follows); THIS PAIR writes an
    // override for this helmet on this frame only.
    if (S.mode === "frames")
      return tables.suits
        .filter((s) => s.frame && s.id.startsWith(S.suit + "-")
          && (s.ownHead || wears(s, helmOf(S.helm))))
        .map((s) => [s, helmOf(S.helm)] as [SuitRow, HelmRow]);
    const out: [SuitRow, HelmRow][] = [];
    for (const s of wearable) for (const h of tables.helmets) if (wears(s, h)) out.push([s, h]);
    return out;
  }

  function build() {
    (modeSel as HTMLSelectElement).value = S.mode;
    (suitSel as HTMLSelectElement).value = S.suit;
    (helmSel as HTMLSelectElement).value = S.helm;
    suitSel.style.display = S.mode === "helm" ? "none" : "";
    helmSel.style.display = S.mode === "suit" ? "none" : "";
    stage.innerHTML = "";
    tiles = [];
    const list = pairs();
    // fit whole columns to the phone rather than letting a fixed tile size
    // leave half a column of dead margin down the side
    const avail = Math.max(240, stage.clientWidth) - 20;
    const cols = S.mode === "all" ? Math.max(3, Math.floor(avail / 110)) : 3;
    const size =
      S.mode === "one" ? Math.min(340, avail) : Math.floor((avail - 8 * (cols - 1)) / cols) - 10;
    stage.className = "rg-stage" + (S.mode === "one" ? " rg-solo" : "");
    stage.style.setProperty("--tile", size + "px");
    for (const [s, h] of list) {
      const wrap = el("div", "rg-tile");
      const cv = el("canvas", "rg-cv") as HTMLCanvasElement;
      cv.style.width = size + "px";
      cv.style.height = size + "px";
      const cap = el("div", "rg-cap", S.mode === "suit" ? h.name : S.mode === "helm" ? s.name : `${s.name} · ${h.name}`);
      wrap.append(cv, cap);
      if (S.over[pairKey(s.id, h.id)]) wrap.classList.add("ov");
      stage.append(wrap);
      const t: Tile = { cv, s, h, size, wrap };
      tiles.push(t);
      wire(t);
    }
    if (!list.some(([s, h]) => pairKey(s.id, h.id) === S.active)) {
      S.active = list.length ? pairKey(list[0][0].id, list[0][1].id) : "";
    }
    syncTarget();
    syncScope();
    paintAll();
  }

  function paintAll() {
    for (const t of tiles) {
      paintTile(t.cv, t.s, t.h, t.size);
      t.wrap.classList.toggle("on", pairKey(t.s.id, t.h.id) === S.active);
      t.wrap.classList.toggle("ov", !!S.over[pairKey(t.s.id, t.h.id)]);
      t.wrap.classList.toggle("lk", isLocked(t.s, t.h));
      t.touchSync?.();
    }
    const s = suitOf(activeSuit());
    const h = helmOf(activeHelm());
    const nOver = Object.keys(S.over).length;
    stat.textContent =
      `${s.name} head [${round(s.dome[0])}, ${round(s.dome[1])}, ${round(s.dome[2])}]   ·   ` +
      `${h.name} glass [${round(h.glass[0], 1)}, ${round(h.glass[1], 1)}, ${round(h.glass[2], 1)}` +
      (h.glass[3] ? `, ${round(h.glass[3], 1)}°` : "") + "]" +
      (nOver ? `   ·   ${nOver} override${nOver > 1 ? "s" : ""}` : "");
    const at = activeTile();
    const held = at ? isLocked(at.s, at.h) : false;
    lockB.textContent = held ? "UNLOCK" : "LOCK";
    lockB.classList.toggle("on", held);
    const fh = foldable(h);
    foldB.style.display = fh ? "" : "none";
    if (fh) foldB.textContent = `FOLD ${fh.length}`;
    saveLocal();
  }

  const activeSuit = () => (S.active ? S.active.split("|")[0] : S.suit);
  const activeHelm = () => (S.active ? S.active.split("|")[1] : S.helm);

  function syncScope() {
    for (const k of ["one", "view"] as Scope[]) scopeB[k].classList.toggle("on", S.scope === k);
  }

  const activeTile = () =>
    tiles.find((x) => pairKey(x.s.id, x.h.id) === S.active) || tiles[0];

  function withActive(fn: (s: SuitRow, h: HelmRow, scale: number) => void) {
    const t = activeTile();
    if (!t) return;
    if (isLocked(t.s, t.h)) { flash("locked — unlock to edit"); return; }
    const body = bank.get(t.s.file);
    if (!body) return;
    const scale = (t.size * 0.82) / Math.max(1, Math.max(body.box.w, body.box.h));
    fn(t.s, t.h, scale);
    paintAll();
  }

  /** SIZE and ROT answer to the scope switch. ONE WRITE PER NUMBER is the
   *  whole trick: in the one-suit view all thirty tiles share a single suit
   *  row, so a naive loop would scale that one head once per helmet on the
   *  roster - thirty compounding multiplies from a single tap. Dedupe by
   *  the record each write lands on, skip what is locked, and say how many
   *  of each actually moved. */
  function withScope(fn: (s: SuitRow, h: HelmRow) => void) {
    if (S.scope === "one") { withActive(fn); return; }
    const seen = new Set<string>();
    let moved = 0;
    let held = 0;
    for (const t of tiles) {
      // an own-head tile wears no helmet, so a glass edit would write nothing
      if (S.target !== "suit" && t.s.ownHead) continue;
      const k = lockKey(t.s, t.h);
      if (seen.has(k)) continue;
      seen.add(k);
      if (S.locks[k]) { held++; continue; }
      fn(t.s, t.h);
      moved++;
    }
    paintAll();
    flash(`${moved} in view${held ? `, ${held} locked` : ""}`);
  }

  // ---- pointer: drag to move, wheel/pinch to size
  function wire(t: Tile) {
    let id = -1;
    let lx = 0;
    let ly = 0;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;

    const scaleOf = () => {
      const body = bank.get(t.s.file)!;
      return (t.size * 0.82) / Math.max(1, Math.max(body.box.w, body.box.h));
    };

    // TAP TO SELECT, DRAG THE SELECTED TILE TO EDIT. The first build let
    // every tile capture every touch (touch-action: none across the board),
    // which on a phone meant a swipe over the grid EDITED instead of
    // scrolling — the list only moved if your finger landed in the 8px gaps.
    // With 24 heads in the one-helmet view, everything below the fold was
    // effectively unreachable, and it read as "there are only 9 suits."
    // Now only the ACTIVE tile owns the gesture; every other tile lets the
    // page scroll straight through it (pan-y), and its first tap selects.
    const syncTouch = () => {
      t.cv.style.touchAction =
        pairKey(t.s.id, t.h.id) === S.active && !isLocked(t.s, t.h) ? "none" : "pan-y";
    };
    t.touchSync = syncTouch;
    syncTouch();
    t.cv.addEventListener("pointerdown", (e) => {
      const wasActive = pairKey(t.s.id, t.h.id) === S.active;
      S.active = pairKey(t.s.id, t.h.id);
      // the tile you touched becomes the selection, so switching view keeps
      // your place instead of dropping you back on Flight × Clear
      if (!t.s.frame) S.suit = t.s.id;
      S.helm = t.h.id;
      (suitSel as HTMLSelectElement).value = S.suit;
      (helmSel as HTMLSelectElement).value = S.helm;
      if (!wasActive) {
        // first tap only selects — the browser keeps the gesture, so a
        // swipe that began on an unselected tile scrolls the grid
        paintAll();
        return;
      }
      // A LOCKED NUMBER STILL SELECTS, so you can read it, copy it and
      // unlock it — it just refuses to move.
      if (isLocked(t.s, t.h)) {
        flash("locked — unlock to edit");
        paintAll();
        return;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) checkpoint();      // one undo step per gesture
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      } else {
        id = e.pointerId;
        lx = e.clientX;
        ly = e.clientY;
      }
      t.cv.setPointerCapture(e.pointerId);
      paintAll();
    });
    t.cv.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 8 && d > 8) {
          resize(d / pinch, t.s, t.h);
          pinch = d;
          paintAll();
        }
        return;
      }
      if (e.pointerId !== id) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      if (dx || dy) {
        nudge(dx, dy, t.s, t.h, scaleOf());
        paintAll();
      }
    });
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (e.pointerId === id) id = -1;
      if (pts.size < 2) pinch = 0;
    };
    t.cv.addEventListener("pointerup", up);
    t.cv.addEventListener("pointercancel", up);
    let wheelAt = 0;
    t.cv.addEventListener(
      "wheel",
      (e) => {
        // the wheel only sizes the SELECTED tile; over anything else it
        // scrolls the grid like a normal page
        if (pairKey(t.s.id, t.h.id) !== S.active) return;
        e.preventDefault();
        const now = performance.now();
        if (now - wheelAt > 500) checkpoint();   // a burst is one gesture
        wheelAt = now;
        resize(e.deltaY < 0 ? 1.03 : 1 / 1.03, t.s, t.h);
        paintAll();
      },
      { passive: false },
    );
  }

  // ---- keyboard, for the desktop pass
  let keyEditAt = 0;
  window.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 5 : 1;
    // a held key repeats — one checkpoint per burst, not per repeat
    const editKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "=", "+", "-", "_", "[", "]"];
    if (editKeys.includes(e.key)) {
      const now = performance.now();
      if (now - keyEditAt > 500) checkpoint();
      keyEditAt = now;
    }
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (map[e.key]) {
      e.preventDefault();
      withActive((s, h) => nudgeUnits(map[e.key][0], map[e.key][1], s, h));
    } else if (e.key === "=" || e.key === "+") {
      withActive((s, h) => resize(1.02, s, h));
    } else if (e.key === "-" || e.key === "_") {
      withActive((s, h) => resize(1 / 1.02, s, h));
    } else if (e.key === "[") {
      withActive((s, h) => spin(-2, s, h));
    } else if (e.key === "]") {
      withActive((s, h) => spin(2, s, h));
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (undo()) withActive(() => {});
    } else if (e.key === "1" || e.key === "2" || e.key === "3") {
      S.target = (["helm", "suit", "pair"] as Target[])[+e.key - 1];
      syncTarget();
    }
  });

  // ---- the report sheet: this is the "save for review" step, and on a
  // phone the realistic route out is the clipboard
  function showReport() {
    const sheet = el("div", "rg-sheet");
    const inner = el("div", "rg-sheetin");
    const ts = reportTS();
    const json = reportJSON();
    inner.append(el("h2", "", "CHANGES"));
    const pre = el("pre", "rg-pre", ts);
    inner.append(pre);
    const row = el("div", "rg-acts");
    const cp = el("button", "rg-act rg-go", "COPY VALUES");
    cp.onclick = async () => {
      await copy(ts);
      flash("copied — paste it into the chat");
    };
    const cj = el("button", "rg-act", "COPY JSON");
    cj.onclick = async () => {
      await copy(json);
      flash("copied JSON");
    };
    const dl = el("button", "rg-act", "DOWNLOAD");
    dl.onclick = () => {
      const b = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "acornaut-rig.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    const clr = el("button", "rg-act rg-danger", "RESET ALL");
    clr.onclick = () => {
      S.tables = JSON.parse(JSON.stringify(S.base));
      S.over = {};
      punched.clear();
      sheet.remove();
      build();
      flash("back to the shipping values");
    };
    const close = el("button", "rg-act", "CLOSE");
    close.onclick = () => sheet.remove();
    row.append(cp, cj, dl, clr, close);
    inner.append(row);
    sheet.append(inner);
    root.append(sheet);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard needs a secure context and a gesture; a selectable
      // textarea is the fallback that works everywhere
      const ta = el("textarea", "rg-ta") as HTMLTextAreaElement;
      ta.value = text;
      root.append(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* leave it selected; the user can copy by hand */
      }
      setTimeout(() => ta.remove(), 200);
    }
  }

  build();
  (window as any).__rig = { S, build, paintAll, reportTS, reportJSON };
}
