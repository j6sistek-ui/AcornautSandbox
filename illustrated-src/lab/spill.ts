/**
 * THE SPILL — a proof-of-concept survival mode.
 *
 * An acorn mining rig let go in the next system over. What reached us is a
 * front of rock, cargo and shrapnel travelling one way: at you. There are no
 * gates here and no planets. Stay alive.
 *
 * Deliberately SELF-CONTAINED. It shares the repository's art folder and
 * nothing else — no import from illustrated-src/game, no entry in the main
 * build, its own page under docs/lab/. That is what lets it be judged, kept
 * or deleted without touching a game that is close to shipping, and it is
 * why it is a separate file rather than a fifth branch inside sim.ts.
 *
 * If it graduates, the parts worth keeping are the lunge, the charge/PULSE
 * loop and the spawn director; the rendering would move onto the game's
 * existing art bank instead of loading its own.
 */

const ART = ((window as unknown as { __ACORNAUT_ART__?: string }).__ACORNAUT_ART__ || "/art").replace(/\/$/, "");

// ---------------------------------------------------------------- tuning

const PHYS = {
  gravity: 1250,
  flap: -430,
  dive: 360,
  /** how fast the pilot slides when lunging, and how long the dash lasts.
   *  900 x 0.16s covered 144px of a 210px band — one dash crossed two
   *  thirds of everywhere you are allowed to be, which made the horizontal
   *  axis free rather than a resource. Measure the whole move, not the dash:
   *  the slide-out afterwards carries it half as far again. About a third of
   *  the band, all in. */
  lungeSpeed: 320,
  lungeTime: 0.15,
  lungeCooldown: 0.55,
  /** where the pilot sits when left alone, and how fast a lunge decays back
   *  to it. Slow enough to be a drift rather than a spring — you keep the
   *  ground a lunge won for a few seconds, you do not keep it for free. */
  homeX: 0.22,
  driftHome: 0.55,
  /** The pilot may roam this share of the width. The right edge stops at
   *  half: further forward than that and you can park in front of the field
   *  where pieces have not spread apart yet, which was safer rather than
   *  more dangerous. */
  bandLeft: 0.08,
  bandRight: 0.5,
  /** How long the floor may be touched before it kills. A bounce off the
   *  bottom while recovering from a dive is one or two frames — under 50ms.
   *  Riding it is continuous. 0.25s sits well clear of the first and well
   *  under the second, and the hull glows red from 0.1s so the rule is
   *  visible before it is fatal rather than after. */
  floorGrace: 0.25,
  floorWarn: 0.1,
  pilotR: 15,
  /** how close a piece has to pass to count as a near miss */
  grazeR: 46,
  chargePerGraze: 0.11,
  pulseR: 240,
};

/** Difficulty is one number that climbs; everything else reads off it. */
function intensity(t: number) {
  // Opens gently and keeps climbing rather than plateauing into safety. The
  // first version reached full pressure in 75s and an autopilot could not
  // survive nine, because density is not the only thing that scales — the
  // pieces get faster too, and the two multiply. Eased again after the lunge
  // was cut to a third of its reach: the field had been balanced around a
  // dash that could cross most of the band, and taking that away without
  // touching the ramp halved how long the same bot lasted.
  return Math.min(1, t / 135) * 0.72 + Math.min(1, t / 320) * 0.28;
}

type Kind = "shard" | "tumbler" | "hulk" | "spinner";

type Rock = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: Kind;
  sprite: number;
  spin: number;
  rot: number;
  /** sinusoidal drift, for spinners */
  arc: number;
  arcPhase: number;
  warn: number;
  grazed: boolean;
  dead: boolean;
};

type NutKind = "acorn" | "gold" | "shield";
type Nut = { x: number; y: number; vx: number; vy: number; got: boolean; bob: number; kind: NutKind };

type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; col: string };

type Phase = "ready" | "play" | "over";

export type Spill = ReturnType<typeof makeSpill>;

function makeSpill(W: number, H: number) {
  return {
    W,
    H,
    phase: "ready" as Phase,
    t: 0,
    best: 0,
    pilot: { x: W * 0.22, y: H * 0.45, vy: 0, vx: 0, rot: 0 },
    lunge: 0,
    lungeDir: 0,
    cool: 0,
    rocks: [] as Rock[],
    nuts: [] as Nut[],
    bits: [] as Bit[],
    stars: [] as { x: number; y: number; r: number; a: number; layer: number }[],
    charge: 0,
    pulseFlash: 0,
    combo: 0,
    comboT: 0,
    acorns: 0,
    score: 0,
    grazes: 0,
    surge: 0,
    surgeT: 0,
    banner: "",
    bannerT: 0,
    nextRock: 0,
    nextNut: 2.5,
    nextSpecial: 9,
    shake: 0,
    milestone: 0,
    deadFor: 0,
    flapT: 0,
    floorT: 0,
    shield: 0,
    shieldFlash: 0,
    cause: "" as string,
  };
}

// ---------------------------------------------------------------- world

function initStars(s: Spill) {
  s.stars = Array.from({ length: 190 }, () => {
    const layer = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2;
    return {
      x: Math.random() * s.W,
      y: Math.random() * s.H,
      r: layer === 2 ? 1.5 + Math.random() * 1.2 : layer === 1 ? 0.9 + Math.random() * 0.7 : 0.4 + Math.random() * 0.5,
      a: layer === 2 ? 0.75 + Math.random() * 0.25 : layer === 1 ? 0.45 + Math.random() * 0.3 : 0.2 + Math.random() * 0.25,
      layer,
    };
  });
}

function reset(s: Spill) {
  s.phase = "ready";
  s.t = 0;
  s.pilot = { x: s.W * 0.22, y: s.H * 0.45, vy: 0, vx: 0, rot: 0 };
  s.lunge = 0;
  s.cool = 0;
  s.rocks = [];
  s.nuts = [];
  s.bits = [];
  s.charge = 0;
  s.combo = 0;
  s.comboT = 0;
  s.acorns = 0;
  s.score = 0;
  s.grazes = 0;
  s.surge = 0;
  s.surgeT = 0;
  s.banner = "";
  s.bannerT = 0;
  s.nextRock = 0.6;
  s.nextNut = 2.5;
  s.nextSpecial = 9 + Math.random() * 7;
  s.shake = 0;
  s.milestone = 0;
  s.deadFor = 0;
  s.flapT = 0;
  s.floorT = 0;
  s.shield = 0;
  s.shieldFlash = 0;
  s.cause = "";
}

// ---------------------------------------------------------------- spawning

/**
 * The one rule the brief set: debris must never collide with other debris.
 * Rather than simulate rock-on-rock physics, refuse to spawn a piece whose
 * PATH crosses one already in flight. Two pieces on straight lines only meet
 * if they are close now and closing, so sampling the next few seconds of both
 * paths and rejecting on overlap is exact enough and costs nothing.
 */
function pathClear(s: Spill, cand: Rock) {
  for (const r of s.rocks) {
    if (r.dead) continue;
    for (let k = 0; k <= 12; k++) {
      const t = (k / 12) * 4.5;
      const ax = cand.x + cand.vx * t;
      const ay = cand.y + cand.vy * t + (cand.arc ? Math.sin(cand.arcPhase + t * 1.6) * cand.arc : 0);
      const bx = r.x + r.vx * t;
      const by = r.y + r.vy * t + (r.arc ? Math.sin(r.arcPhase + t * 1.6) * r.arc : 0);
      if (ax < -200 && bx < -200) break;
      const gap = (cand.r + r.r) * 1.35;
      if ((ax - bx) * (ax - bx) + (ay - by) * (ay - by) < gap * gap) return false;
    }
  }
  return true;
}

/** a debris index the player can actually see against deep space */
function readableSprite() {
  for (let i = 0; i < 24; i++) {
    const n = Math.floor(Math.random() * 27);
    if (!UNREADABLE.has(n)) return n;
  }
  return 0;
}

function spawnRock(s: Spill) {
  const I = intensity(s.t);
  const surging = s.surgeT > 0;

  // A hulk is slow, so it OCCUPIES the screen far longer than its share of
  // spawns suggests: at one roll in ten it still outnumbered every other
  // kind on screen, and two of them together sealed the column. Rare, late,
  // smaller, and never more than one at a time.
  const hulks = s.rocks.filter((r) => r.kind === "hulk" && !r.dead).length;
  const mayHulk = s.t > 25 && hulks === 0;
  const roll = Math.random();
  const kind: Kind =
    mayHulk && roll > 0.94 ? "hulk"
      : roll < 0.44 ? "shard"
        : roll < 0.78 ? "tumbler"
          : "spinner";

  const speed =
    (kind === "hulk" ? 145 : kind === "shard" ? 290 : 205) * (0.8 + I * 0.7) * (surging ? 1.12 : 1);
  const r = kind === "hulk" ? 36 + Math.random() * 14 : kind === "shard" ? 11 + Math.random() * 6 : 18 + Math.random() * 10;

  // an angle, but bounded: a piece must still cross the screen rather than
  // clip a corner, or it reads as unfair rather than as chaotic
  const ang = (Math.random() - 0.5) * (kind === "shard" ? 0.5 : 0.34);
  const y = 40 + Math.random() * (s.H - 80);

  const cand: Rock = {
    x: s.W + r + 20,
    y,
    vx: -Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    r,
    kind,
    sprite: readableSprite(),
    spin: (Math.random() - 0.5) * (kind === "tumbler" ? 2.4 : kind === "hulk" ? 0.5 : 1.2),
    rot: Math.random() * Math.PI * 2,
    arc: kind === "spinner" ? 26 + Math.random() * 26 : 0,
    arcPhase: Math.random() * Math.PI * 2,
    warn: kind === "hulk" ? 1.1 : 0,
    grazed: false,
    dead: false,
  };
  if (!pathClear(s, cand)) return false;
  s.rocks.push(cand);
  return true;
}

/** Acorns spill in arcs, so collecting a stream is a line you fly, not a dot. */
function spawnNuts(s: Spill) {
  const n = 4 + Math.floor(Math.random() * 5);
  const y0 = 70 + Math.random() * (s.H - 140);
  const curve = (Math.random() - 0.5) * 150;
  const speed = 190 + intensity(s.t) * 90;
  for (let i = 0; i < n; i++) {
    const f = i / Math.max(1, n - 1);
    s.nuts.push({
      x: s.W + 30 + i * 40,
      y: y0 + Math.sin(f * Math.PI) * curve,
      vx: -speed,
      vy: 0,
      got: false,
      bob: Math.random() * Math.PI * 2,
      kind: "acorn",
    });
  }
}

/**
 * The two things that drift past on their own rather than in a stream.
 * A golden acorn pays double; a shield acorn eats one hit and is rare
 * enough that finding one changes how greedy the next twenty seconds are.
 * They travel slower than the field, so taking one is a decision about
 * where you want to be, not a reflex.
 */
function spawnSpecial(s: Spill) {
  const shield = Math.random() < 0.22;
  s.nuts.push({
    x: s.W + 40,
    y: 80 + Math.random() * (s.H - 160),
    vx: -(150 + intensity(s.t) * 60),
    vy: 0,
    got: false,
    bob: Math.random() * Math.PI * 2,
    kind: shield ? "shield" : "gold",
  });
}

function burst(s: Spill, x: number, y: number, n: number, cols: string[], power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (60 + Math.random() * 230) * power;
    s.bits.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      max: 0.35 + Math.random() * 0.5,
      r: 1.5 + Math.random() * 3.2,
      col: cols[Math.floor(Math.random() * cols.length)],
    });
  }
}

// ---------------------------------------------------------------- input

function flap(s: Spill) {
  if (s.phase === "ready") {
    s.phase = "play";
    s.banner = "SURVIVE";
    s.bannerT = 1.6;
    return;
  }
  if (s.phase !== "play") return;
  s.pilot.vy = PHYS.flap;
  s.flapT = 0.26;
}

function dive(s: Spill) {
  if (s.phase !== "play") return;
  s.pilot.vy = Math.max(s.pilot.vy, PHYS.dive);
}

/**
 * The mode's own control. A short horizontal dash on a cooldown: forward to
 * close on an acorn stream or slip behind a piece that has already committed,
 * back to buy reading time at the cost of the room you have left. It is the
 * only control that trades SPACE rather than height, which is what makes an
 * angled field playable at all.
 */
function doLunge(s: Spill, dir: number) {
  if (s.phase === "ready") { flap(s); return; }
  // FORWARD ONLY. A backward lunge was a free retreat: two of them put the
  // pilot in a corner with the whole field ahead and nothing able to reach
  // it. Forward costs you the safe end of the screen to gain reach, and the
  // drift home is the only way back.
  if (dir < 0 || s.phase !== "play" || s.cool > 0) return;
  s.lunge = PHYS.lungeTime;
  s.lungeDir = 1;
  s.cool = PHYS.lungeCooldown;
  burst(s, s.pilot.x - 14, s.pilot.y, 8, ["#8fd6ff", "#cfefff"], 0.5);
}

/** Spend a full charge meter: everything close enough is shattered. */
function pulse(s: Spill) {
  if (s.phase !== "play" || s.charge < 1) return;
  s.charge = 0;
  s.pulseFlash = 0.45;
  s.shake = 0.5;
  let hit = 0;
  for (const r of s.rocks) {
    if (r.dead) continue;
    const dx = r.x - s.pilot.x;
    const dy = r.y - s.pilot.y;
    if (dx * dx + dy * dy < PHYS.pulseR * PHYS.pulseR) {
      r.dead = true;
      hit++;
      burst(s, r.x, r.y, 16, ["#ffd8a0", "#ff9a5c", "#fff2d8"], 1.2);
    }
  }
  if (hit) {
    s.banner = `PULSE ×${hit}`;
    s.bannerT = 1.1;
  }
}

// ---------------------------------------------------------------- step

function die(s: Spill, cause: string) {
  s.phase = "over";
  s.deadFor = 0;
  s.shake = 1;
  s.cause = cause;
  burst(s, s.pilot.x, s.pilot.y, 34, ["#ffd8a0", "#ff9a5c", "#fff2d8", "#ffffff"], 1.5);
  s.best = Math.max(s.best, Math.floor(s.score));
  saveBest(s.best);
}

function step(s: Spill, dt: number) {
  s.stars.forEach((st) => {
    st.x -= dt * (st.layer === 2 ? 46 : st.layer === 1 ? 22 : 9);
    if (st.x < -3) {
      st.x = s.W + 3;
      st.y = Math.random() * s.H;
    }
  });

  if (s.bannerT > 0) s.bannerT = Math.max(0, s.bannerT - dt);
  if (s.pulseFlash > 0) s.pulseFlash = Math.max(0, s.pulseFlash - dt * 2);
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2.2);

  for (const b of s.bits) {
    b.life += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 1 - dt * 1.6;
    b.vy *= 1 - dt * 1.6;
  }
  s.bits = s.bits.filter((b) => b.life < b.max);

  if (s.phase === "over") {
    s.deadFor += dt;
    for (const r of s.rocks) {
      r.x += r.vx * dt * 0.25;
      r.y += r.vy * dt * 0.25;
    }
    return;
  }
  if (s.phase !== "play") return;

  s.t += dt;
  const I = intensity(s.t);

  // ---- milestones and surges, the two things that make time feel shaped
  const stage = Math.floor(s.t / 30);
  if (stage > s.milestone) {
    s.milestone = stage;
    s.banner = `${stage * 30}s — FIELD THICKENS`;
    s.bannerT = 2;
  }
  s.surge -= dt;
  if (s.surge <= 0 && s.t > 18) {
    s.surge = 26 + Math.random() * 10;
    s.surgeT = 6;
    s.banner = "SURGE";
    s.bannerT = 1.8;
  }
  if (s.surgeT > 0) s.surgeT = Math.max(0, s.surgeT - dt);

  // ---- pilot
  if (s.flapT > 0) s.flapT = Math.max(0, s.flapT - dt);
  if (s.shieldFlash > 0) s.shieldFlash = Math.max(0, s.shieldFlash - dt * 2);
  if (s.cool > 0) s.cool = Math.max(0, s.cool - dt);
  if (s.lunge > 0) {
    s.lunge = Math.max(0, s.lunge - dt);
    s.pilot.vx = s.lungeDir * PHYS.lungeSpeed;
  } else {
    // slides to a stop rather than stopping dead, so a dash has weight
    s.pilot.vx *= 1 - Math.min(1, dt * 8.5);
    // then drifts back to the home lane, slowly. Ground a lunge won is
    // yours for a few seconds, not for the rest of the run.
    const home = s.W * PHYS.homeX;
    if (Math.abs(s.pilot.x - home) > 1) s.pilot.x += (home - s.pilot.x) * Math.min(1, dt * PHYS.driftHome);
  }
  s.pilot.vy += PHYS.gravity * dt;
  s.pilot.y += s.pilot.vy * dt;
  s.pilot.x += s.pilot.vx * dt;

  const lo = s.W * PHYS.bandLeft;
  const hi = s.W * PHYS.bandRight;
  if (s.pilot.x < lo) { s.pilot.x = lo; s.pilot.vx = 0; }
  if (s.pilot.x > hi) { s.pilot.x = hi; s.pilot.vx = 0; }
  s.pilot.rot = Math.max(-0.5, Math.min(0.9, s.pilot.vy / 700)) + s.pilot.vx / 2600;

  // The ceiling is a wall. THE FLOOR IS NOT — riding the bottom was a
  // hiding place, and a survival mode cannot have one. Brushing it is fine;
  // staying on it kills. See PHYS.floorGrace for where the line is and why.
  if (s.pilot.y < 22) { s.pilot.y = 22; s.pilot.vy = Math.max(0, s.pilot.vy); }
  const floorY = s.H - 22;
  if (s.pilot.y > floorY) {
    s.pilot.y = floorY;
    s.pilot.vy = Math.min(0, s.pilot.vy);
    s.floorT += dt;
    if (s.floorT > PHYS.floorGrace) {
      die(s, "GROUNDED");
      return;
    }
  } else if (s.floorT > 0) {
    // forgives quickly once clear, so a bumpy stretch does not accumulate
    s.floorT = Math.max(0, s.floorT - dt * 2.5);
  }

  // ---- spawn director
  s.nextRock -= dt;
  // A hard ceiling on how crowded it may get. Without one the ramp and the
  // surge multiply into fields with no line through them at all.
  const cap = 4 + Math.round(I * 5) + (s.surgeT > 0 ? 2 : 0);
  if (s.nextRock <= 0 && s.rocks.length < cap) {
    const base = 0.78 - I * 0.42;
    s.nextRock = Math.max(0.1, (s.surgeT > 0 ? base * 0.45 : base) * (0.65 + Math.random() * 0.7));
    // a few attempts, because a refused spawn is a path conflict and the
    // next random pick usually clears
    for (let k = 0; k < 6; k++) if (spawnRock(s)) break;
  }
  s.nextNut -= dt;
  if (s.nextNut <= 0) {
    s.nextNut = 4.5 + Math.random() * 4;
    spawnNuts(s);
  }
  s.nextSpecial -= dt;
  if (s.nextSpecial <= 0) {
    s.nextSpecial = 16 + Math.random() * 14;
    spawnSpecial(s);
  }

  // ---- debris
  for (const r of s.rocks) {
    if (r.warn > 0) {
      r.warn = Math.max(0, r.warn - dt);
      continue;                        // a hulk waits offscreen while it warns
    }
    r.x += r.vx * dt;
    r.y += r.vy * dt + (r.arc ? Math.cos(r.arcPhase + s.t * 1.6) * r.arc * dt : 0);
    r.rot += r.spin * dt;
    // Debris flung across deep space does not bounce off the top of the
    // screen. It used to, and a piece you had already read could come back
    // at you from a direction nothing telegraphed. It leaves instead.

    const dx = r.x - s.pilot.x;
    const dy = r.y - s.pilot.y;
    const d2 = dx * dx + dy * dy;
    const kill = r.r + PHYS.pilotR;
    if (d2 < kill * kill) {
      if (s.shield > 0) {
        // a shield eats the piece rather than the pilot
        s.shield--;
        s.shieldFlash = 0.5;
        s.shake = 0.6;
        r.dead = true;
        burst(s, r.x, r.y, 20, ["#9fe8ff", "#cfefff", "#ffffff"], 1.2);
        s.banner = "SHIELD HELD";
        s.bannerT = 1.1;
        continue;
      }
      die(s, "STRUCK");
      return;
    }
    // near miss: only once per piece, and only once it is alongside or past
    const graze = r.r + PHYS.grazeR;
    if (!r.grazed && r.x < s.pilot.x + r.r && d2 < graze * graze) {
      r.grazed = true;
      s.grazes++;
      s.charge = Math.min(1, s.charge + PHYS.chargePerGraze);
      s.score += 6;
      burst(s, s.pilot.x + 10, s.pilot.y, 3, ["#9fe8ff"], 0.4);
    }
  }
  s.rocks = s.rocks.filter((r) => !r.dead && r.x > -r.r - 60 && r.y > -r.r - 80 && r.y < s.H + r.r + 80);

  // ---- acorns
  if (s.comboT > 0) {
    s.comboT = Math.max(0, s.comboT - dt);
    if (s.comboT === 0) s.combo = 0;
  }
  for (const n of s.nuts) {
    if (n.got) continue;
    n.x += n.vx * dt;
    n.bob += dt * 4;
    const dx = n.x - s.pilot.x;
    const dy = n.y + Math.sin(n.bob) * 3 - s.pilot.y;
    if (dx * dx + dy * dy < 30 * 30) {
      n.got = true;
      if (n.kind === "shield") {
        s.shield = Math.min(2, s.shield + 1);
        s.shieldFlash = 0.5;
        s.banner = "SHIELD";
        s.bannerT = 1.3;
        burst(s, n.x, n.y, 14, ["#9fe8ff", "#cfefff"], 0.9);
      } else {
        const mult = n.kind === "gold" ? 2 : 1;
        s.acorns += mult;
        s.combo = Math.min(9, s.combo + 1);
        s.comboT = 2.6;
        s.score += 25 * s.combo * mult;
        s.charge = Math.min(1, s.charge + 0.03);
        if (n.kind === "gold") {
          s.banner = "DOUBLE";
          s.bannerT = 0.9;
        }
        burst(s, n.x, n.y, n.kind === "gold" ? 14 : 7,
              n.kind === "gold" ? ["#ffe9a0", "#ffd76a", "#fff"] : ["#ffd76a", "#fff0b8"], 0.8);
      }
    }
  }
  s.nuts = s.nuts.filter((n) => !n.got && n.x > -40);

  // surviving is worth points on its own, so a cautious run still scores
  s.score += dt * 10 * (1 + I);
}

// ---------------------------------------------------------------- storage

const BEST_KEY = "acornaut_spill_best";
function saveBest(v: number) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode */ }
}
function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY) || 0) || 0; } catch { return 0; }
}

// ---------------------------------------------------------------- art

/**
 * Four of the twenty-seven debris paintings are near-black or deep purple —
 * mean luminance 31 to 58 where the backdrop sits at 12 to 28. Against deep
 * space they are not dark objects, they are invisible ones, and a piece you
 * cannot see is not a piece you can dodge. They are left out of the pool.
 */
const UNREADABLE = new Set([8, 12, 14, 22]);

type Bank = {
  debris: (HTMLImageElement | null)[];
  /** each sprite with a light rim baked behind it, so it separates */
  lit: (HTMLCanvasElement | null)[];
  acorn: HTMLImageElement | null;
  gold: HTMLImageElement | null;
  shieldnut: HTMLImageElement | null;
  idle: (HTMLImageElement | null)[];
  flap: (HTMLImageElement | null)[];
};

function loadImg(src: string) {
  return new Promise<HTMLImageElement | null>((done) => {
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });
}

/**
 * The pilot is the original animated squirrel, not an equipped suit. The
 * suit renders ship BARE-HEADED now — the game paints a helmet over them at
 * draw time from a table this file deliberately does not import — so a suit
 * used here would fly through a debris field with no helmet on. These eight
 * frames still carry their dome, and they animate.
 */
async function loadBank(): Promise<Bank> {
  const [debris, acorn, gold, shieldnut, idle, flap] = await Promise.all([
    Promise.all(Array.from({ length: 27 }, (_, i) => loadImg(`${ART}/debris/${i}.png`))),
    loadImg(`${ART}/acorn/1.png`),
    loadImg(`${ART}/golden/1.png`),
    loadImg(`${ART}/pickups/shieldnut.png`),
    Promise.all([1, 2, 3, 4].map((i) => loadImg(`${ART}/squirrel/idle-${i}.png`))),
    Promise.all([1, 2, 3, 4].map((i) => loadImg(`${ART}/squirrel/flap-${i}.png`))),
  ]);
  return { debris, lit: debris.map(rim), acorn, gold, shieldnut, idle, flap };
}

/**
 * A separation rim, baked once per sprite. The main game does the same thing
 * for exactly this reason — a dark object on a dark sky has no edge — and
 * baking it beats a live shadowBlur, which would cost a blur per rock per
 * frame. Drawn by offsetting the sprite far off-canvas and keeping only the
 * shadow it casts back.
 */
function rim(img: HTMLImageElement | null) {
  if (!img) return null;
  // The pad and the blur both scale with the SPRITE, because the sprite is
  // then scaled down to rock size on draw. A fixed 13px blur on a 256px
  // painting survives as under three pixels on a 50px rock — which is why
  // the first attempt looked like nothing had changed.
  const pad = Math.round(img.width * 0.14);
  const c = document.createElement("canvas");
  c.width = img.width + pad * 2;
  c.height = img.height + pad * 2;
  const cc = c.getContext("2d");
  if (!cc) return null;
  cc.shadowColor = "rgba(170,200,255,0.95)";
  cc.shadowBlur = img.width * 0.075;
  cc.shadowOffsetX = c.width * 2;
  // twice, so the rim has body against a starfield rather than a whisper
  cc.drawImage(img, pad - c.width * 2, pad);
  cc.drawImage(img, pad - c.width * 2, pad);
  cc.shadowColor = "transparent";
  cc.drawImage(img, pad, pad);
  return c;
}

// ---------------------------------------------------------------- draw

function backdrop(ctx: CanvasRenderingContext2D, s: Spill) {
  const { W, H } = s;
  // Deep space, painted rather than photographed: a cold base, two slow
  // nebula pools and a warm bloom from the direction the spill came from,
  // so the field has somewhere it is arriving FROM.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#05060f");
  g.addColorStop(0.55, "#0a0d1e");
  g.addColorStop(1, "#05070f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const drift = s.t * 6;
  const pool = (cx: number, cy: number, rx: number, ry: number, col: string) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / Math.max(rx, ry));
    ctx.translate(-cx, -cy);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  pool(((W * 0.75 - drift * 0.4) % (W * 1.6)) + W * 0.1, H * 0.3, W * 0.7, H * 0.34, "rgba(70,60,160,0.20)");
  pool(((W * 0.2 - drift * 0.25) % (W * 1.6)) + W * 0.1, H * 0.78, W * 0.6, H * 0.28, "rgba(150,50,120,0.13)");
  // the wound the debris is coming out of
  pool(W * 1.02, H * 0.45, W * 0.5, H * 0.6, "rgba(255,140,60,0.10)");

  for (const st of s.stars) {
    ctx.globalAlpha = st.a;
    ctx.fillStyle = st.layer === 2 ? "#eaf2ff" : "#cfe0ff";
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRock(ctx: CanvasRenderingContext2D, bank: Bank, r: Rock) {
  const img = bank.lit[r.sprite % bank.lit.length] ?? bank.debris[r.sprite % bank.debris.length];
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.rot);
  if (img) {
    // the rimmed canvas is RIM larger on every side, so scale to match
    const grow = img.width / Math.max(1, (bank.debris[r.sprite % bank.debris.length]?.width || img.width));
    const d = r.r * 2 * grow;
    ctx.drawImage(img, -d / 2, -d / 2, d, d);
  } else {
    ctx.fillStyle = "#6b6357";
    ctx.beginPath();
    ctx.arc(0, 0, r.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (r.kind === "hulk") {
    // a hulk gets a rim so it reads as the thing you must not be near
    ctx.strokeStyle = "rgba(255,150,90,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawWarning(ctx: CanvasRenderingContext2D, s: Spill, r: Rock) {
  // a hulk announces itself from the edge before it enters. Being killed by
  // something you could not yet see is the one death that is not the
  // player's fault, and this mode has no gates to read ahead by.
  const a = 0.35 + 0.45 * Math.sin(s.t * 14);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = "#ff9a4c";
  ctx.lineWidth = 3;
  const x = s.W - 16;
  ctx.beginPath();
  ctx.moveTo(x, r.y - 16);
  ctx.lineTo(x - 13, r.y);
  ctx.lineTo(x, r.y + 16);
  ctx.stroke();
  ctx.globalAlpha = a * 0.35;
  ctx.fillStyle = "#ff9a4c";
  ctx.fillRect(s.W - 5, r.y - 26, 5, 52);
  ctx.restore();
}

function drawPilot(ctx: CanvasRenderingContext2D, bank: Bank, s: Spill) {
  const size = 78;
  const set = s.flapT > 0 ? bank.flap : bank.idle;
  const img = set[Math.floor(s.t * (s.flapT > 0 ? 16 : 6)) % Math.max(1, set.length)] ?? bank.idle[0];
  ctx.save();
  ctx.translate(s.pilot.x, s.pilot.y);
  ctx.rotate(s.pilot.rot * 0.5);
  // a lunge leaves a ghost behind it, so the dash reads as a dash rather
  // than as the pilot teleporting sideways
  if (s.lunge > 0 && img) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(img, -size / 2 - s.lungeDir * 18, -size / 2, size, size);
    ctx.globalAlpha = 1;
  }
  if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
  else {
    ctx.fillStyle = "#d98f3d";
    ctx.beginPath();
    ctx.arc(0, 0, PHYS.pilotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, s: Spill, bank: Bank) {
  ctx.save();
  if (s.shake > 0) {
    const m = s.shake * 9;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  backdrop(ctx, s);

  for (const n of s.nuts) {
    const y = n.y + Math.sin(n.bob) * 3;
    const special = n.kind !== "acorn";
    const img = n.kind === "shield" ? bank.shieldnut : n.kind === "gold" ? bank.gold : bank.acorn;
    // the two rare ones carry a halo, so they read as worth crossing for
    if (special) {
      const pull = 20 + Math.sin(s.t * 5 + n.bob) * 3;
      const g = ctx.createRadialGradient(n.x, y, 0, n.x, y, pull);
      g.addColorStop(0, n.kind === "shield" ? "rgba(120,225,255,0.55)" : "rgba(255,215,120,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, y, pull, 0, Math.PI * 2);
      ctx.fill();
    }
    const px = special ? 36 : 28;
    if (img) ctx.drawImage(img, n.x - px / 2, y - px / 2, px, px);
    else {
      ctx.fillStyle = n.kind === "shield" ? "#7fe0ff" : "#ffd76a";
      ctx.beginPath();
      ctx.arc(n.x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const r of s.rocks) {
    if (r.warn > 0) drawWarning(ctx, s, r);
    else drawRock(ctx, bank, r);
  }

  // the floor announces itself before it kills
  if (s.floorT > PHYS.floorWarn && s.phase === "play") {
    const f = Math.min(1, (s.floorT - PHYS.floorWarn) / (PHYS.floorGrace - PHYS.floorWarn));
    const g = ctx.createLinearGradient(0, s.H - 90, 0, s.H);
    g.addColorStop(0, "rgba(255,60,60,0)");
    g.addColorStop(1, `rgba(255,60,60,${(0.2 + f * 0.5).toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, s.H - 90, s.W, 90);
  }

  if (s.phase !== "over") {
    drawPilot(ctx, bank, s);
    if (s.shield > 0) {
      ctx.strokeStyle = `rgba(150,230,255,${(0.4 + 0.3 * Math.sin(s.t * 5) + s.shieldFlash).toFixed(2)})`;
      ctx.lineWidth = s.shield > 1 ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(s.pilot.x, s.pilot.y, 32, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  for (const b of s.bits) {
    ctx.globalAlpha = Math.max(0, 1 - b.life / b.max);
    ctx.fillStyle = b.col;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (s.pulseFlash > 0) {
    const g = ctx.createRadialGradient(s.pilot.x, s.pilot.y, 0, s.pilot.x, s.pilot.y, PHYS.pulseR);
    g.addColorStop(0, `rgba(255,225,180,${0.5 * s.pulseFlash})`);
    g.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s.W, s.H);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- boot

export async function bootSpill(root: HTMLElement) {
  // MISSION MODE (beta story integration): the Star Chart hands this page
  // a mission card in the URL — survive `target` seconds; score goals ride
  // along for display. The run writes ONE result record at the end and the
  // game banks the stars when the pilot walks back in. Without params the
  // page is the same free prototype it always was.
  const q = new URLSearchParams(window.location.search);
  const mission = q.get("mission");
  const missionTarget = Math.max(0, Number(q.get("target")) || 0);
  const missionS2 = Number(q.get("s2")) || 0;
  const missionS3 = Number(q.get("s3")) || 0;
  let missionSent = false;
  function sendMissionResult(sp: Spill, finished: boolean) {
    if (!mission || missionSent) return;
    missionSent = true;
    try {
      localStorage.setItem("acornaut_spill_result", JSON.stringify({
        id: mission, finished, score: Math.floor(sp.score), time: Math.floor(sp.t),
      }));
    } catch { /* private mode: the run still played */ }
  }
  root.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.className = "sp-canvas";
  root.append(canvas);
  const ctx = canvas.getContext("2d")!;

  const hud = document.createElement("div");
  hud.className = "sp-hud";
  hud.innerHTML =
    '<div class="sp-top"><span class="sp-time">0.0s</span><span class="sp-score">0</span></div>' +
    '<div class="sp-meters"><div class="sp-charge"><i></i></div><span class="sp-combo"></span></div>' +
    '<div class="sp-banner"></div>' +
    '<div class="sp-card"></div>';
  root.append(hud);
  const $time = hud.querySelector(".sp-time") as HTMLElement;
  const $score = hud.querySelector(".sp-score") as HTMLElement;
  const $charge = hud.querySelector(".sp-charge i") as HTMLElement;
  const $combo = hud.querySelector(".sp-combo") as HTMLElement;
  const $banner = hud.querySelector(".sp-banner") as HTMLElement;
  const $card = hud.querySelector(".sp-card") as HTMLElement;

  const bank = await loadBank();

  const s = makeSpill(390, 760);
  s.best = loadBest();
  initStars(s);
  reset(s);

  function resize() {
    const rect = root.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.W = rect.width;
    s.H = rect.height;
    canvas.width = Math.ceil(s.W * dpr);
    canvas.height = Math.ceil(s.H * dpr);
    canvas.style.width = `${s.W}px`;
    canvas.style.height = `${s.H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars(s);
  }
  resize();
  window.addEventListener("resize", resize);

  // ---- controls. Tap to flap, swipe down to dive, swipe left/right to
  // lunge, two-finger tap (or P) for the pulse.
  let down: { x: number; y: number; t: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const quick = performance.now() - down.t < 400;
    down = null;
    if (s.phase === "over") {
      if (s.deadFor <= 0.6) return;
      if (mission) { window.location.href = "../../beta/"; return; }
      reset(s);
      return;
    }
    if (quick && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) doLunge(s, dx > 0 ? 1 : -1);
    else if (quick && dy > 44 && dy > Math.abs(dx)) dive(s);
    else flap(s);
  });
  canvas.addEventListener("pointercancel", () => { down = null; });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (s.phase === "over" && (e.code === "Space" || e.code === "Enter")) {
      if (s.deadFor <= 0.6) return;
      if (mission) { window.location.href = "../../beta/"; return; }
      reset(s);
      return;
    }
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flap(s); }
    else if (e.code === "ArrowDown") { e.preventDefault(); dive(s); }
    else if (e.code === "ArrowRight") { e.preventDefault(); doLunge(s, 1); }
    else if (e.code === "ArrowLeft") { e.preventDefault(); doLunge(s, -1); }
    else if (e.code === "KeyP") { e.preventDefault(); pulse(s); }
  });

  // an on-screen PULSE button, because a two-finger gesture is not findable
  const pulseBtn = document.createElement("button");
  pulseBtn.className = "sp-pulse";
  pulseBtn.textContent = "PULSE";
  pulseBtn.onclick = (e) => { e.stopPropagation(); pulse(s); };
  root.append(pulseBtn);

  let last = performance.now();
  function loop(now: number) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(s, dt);
    // Mission complete the instant the clock crosses the target — the run
    // ends on a win, not on the crash that was coming eventually.
    if (mission && s.phase === "play" && s.t >= missionTarget) {
      s.phase = "over";
      s.deadFor = 0;
      s.cause = "MISSION COMPLETE";
      s.best = Math.max(s.best, Math.floor(s.score));
      sendMissionResult(s, true);
    }
    if (mission && s.phase === "over" && !missionSent) sendMissionResult(s, false);
    draw(ctx, s, bank);

    $time.textContent = mission && s.phase !== "over"
      ? `${Math.max(0, missionTarget - s.t).toFixed(1)}s`
      : `${s.t.toFixed(1)}s`;
    $score.textContent = `${Math.floor(s.score)}`;
    $charge.style.width = `${(s.charge * 100).toFixed(0)}%`;
    pulseBtn.classList.toggle("ready", s.charge >= 1);
    $combo.textContent = (s.shield > 0 ? "\u25c9".repeat(s.shield) + " " : "") + (s.combo > 1 ? `\u00d7${s.combo}` : "");
    $banner.textContent = s.bannerT > 0 ? s.banner : "";
    $banner.style.opacity = s.bannerT > 0 ? `${Math.min(1, s.bannerT * 1.6)}` : "0";

    if (s.phase === "ready") {
      $card.className = "sp-card show";
      $card.innerHTML =
        `<h1>${mission ? `MISSION ${mission}` : "THE SPILL"}</h1>` +
        `${mission ? `<p class="sp-best">SURVIVE ${missionTarget} SECONDS</p>` : ""}` +
        '<p>A mining rig let go one system over. What reached us is travelling one way.</p>' +
        '<ul><li><b>Tap</b> — thrust</li><li><b>Swipe down</b> — dive</li>' +
        '<li><b>Swipe right</b> — <b>lunge</b> forward, then drift back</li>' +
        '<li><b>PULSE</b> — shatter what is close, once the meter fills</li></ul>' +
        '<p class="sp-fine">Graze debris to charge the meter. Gold acorns pay double; shields are rare. <b>Do not ride the floor.</b></p>' +
        `${s.best ? `<p class="sp-best">BEST ${s.best}</p>` : ""}` +
        '<p class="sp-go">TAP TO LAUNCH</p>';
    } else if (s.phase === "over" && mission) {
      const won = s.cause === "MISSION COMPLETE";
      $card.className = "sp-card show";
      $card.innerHTML =
        `<h1>${won ? "MISSION COMPLETE" : s.cause === "GROUNDED" ? "GROUNDED" : "LOST"}</h1>` +
        `<p class="sp-stat"><b>${Math.floor(s.score)}</b> points</p>` +
        `<p class="sp-sub">Mission ${mission} \u00b7 ${won ? `${missionTarget}s survived` : `${s.t.toFixed(1)}s of ${missionTarget}s`}</p>` +
        `${missionS2 ? `<p class="sp-sub">\u2605 goals: ${missionS2} pts \u00b7 ${missionS3} pts</p>` : ""}` +
        '<p class="sp-go">TAP TO RETURN</p>';
    } else if (s.phase === "over") {
      $card.className = "sp-card show";
      $card.innerHTML =
        `<h1>${s.cause === "GROUNDED" ? "GROUNDED" : "LOST"}</h1>` +
        `<p class="sp-stat"><b>${Math.floor(s.score)}</b> points</p>` +
        `<p class="sp-sub">${s.t.toFixed(1)}s survived · ${s.acorns} acorns · ${s.grazes} grazes</p>` +
        `${s.cause === "GROUNDED" ? '<p class="sp-sub">You cannot ride the floor.</p>' : ""}` +
        `${Math.floor(s.score) >= s.best && s.best > 0 ? '<p class="sp-best">NEW BEST</p>' : `<p class="sp-best">BEST ${s.best}</p>`}` +
        '<p class="sp-go">TAP TO FLY AGAIN</p>';
    } else {
      $card.className = "sp-card";
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  (window as unknown as { __spill?: unknown }).__spill = { s, reset: () => reset(s), pulse: () => pulse(s) };
}
