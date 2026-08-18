import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  BookOpen,
  CircleHelp,
  Hexagon,
  Pause,
  Rocket,
  Sparkles,
  UserRound,
  Warehouse,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  BUILD,
  GAME_VERSION,
  HELMETS,
  MOD_BATTERY_COST,
  MOD_SHIELD_COST,
  NEWS,
  PAL_LEVELS,
  PALS,
  SUITS,
  SUIT_REVEAL,
  TRACK,
  TRAILS,
  titleForLevel,
  xpCumulative,
} from "@/game/catalog";
import { createEngine, type Engine } from "@/game/engine";
import { paintPortrait, paintTrailPreview, paintPalPreview } from "@/game/draw";
import { artUrl } from "@/game/art";
import {
  batteryUnlocked,
  deepUnlocked,
  lostUnlocked,
  palUnlocked,
  pilotLevelOf,
  pilotTitleOf,
  startShieldUnlocked,
  suitRevealed,
} from "@/game/save";

export function Acornaut() {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [tick, setTick] = useState(0);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let eng: Engine | null = null;
    let unsub = () => {};
    let dead = false;
    void createEngine(canvas).then((e) => {
      if (dead) {
        e.stop();
        return;
      }
      eng = e;
      unsub = e.subscribe(() => setTick((n) => n + 1));
      e.start();
      setEngine(e);
    });
    const onResize = () => eng?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      dead = true;
      window.removeEventListener("resize", onResize);
      unsub();
      eng?.stop();
    };
  }, []);

  useSyncExternalStore(
    (on) => {
      const id = window.setInterval(on, 250);
      return () => window.clearInterval(id);
    },
    () => tick,
    () => 0,
  );

  const save = engine?.save;
  const snap = engine?.snap();
  const screen = snap?.screen ?? "title";
  const playing = screen === "play";

  return (
    <div className="flex h-dvh w-full justify-center bg-void">
      <div ref={host} className="relative h-full w-full max-w-[480px] overflow-hidden bg-ink">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
        {engine && save && snap && !playing && screen !== "dead" && screen !== "pause" && (
          <div className="absolute inset-0 z-10 flex flex-col">
            {screen === "title" && <Title engine={engine} userPending={isPending} userName={user?.displayName} />}
            {screen === "hangar" && <Hangar engine={engine} />}
            {screen === "log" && <FlightLog engine={engine} />}
            {screen === "social" && <Social engine={engine} />}
            {screen === "help" && <Help engine={engine} />}
          </div>
        )}
        {engine && snap?.screen === "dead" && snap.dead && <Death engine={engine} />}
        {engine && screen === "pause" && <PauseMenu engine={engine} />}
        {playing && save && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-start justify-between px-3">
            <div className="flex items-center gap-1.5 text-sm font-bold text-copper">
              <AcornMark />
              {snap?.runAcorns ?? 0}
            </div>
            <button
              type="button"
              onClick={() => engine.pause()}
              className="pointer-events-auto flex size-10 items-center justify-center rounded-xl border border-line bg-panel/80 text-cream backdrop-blur-sm"
              aria-label="Pause"
            >
              <Pause className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AcornMark() {
  return (
    <span className="inline-block h-3.5 w-3.5 rounded-full bg-copper shadow-[inset_-2px_-2px_0_#8a5a18]" />
  );
}

function Title({
  engine,
  userPending,
  userName,
}: {
  engine: Engine;
  userPending: boolean;
  userName?: string | null;
}) {
  const save = engine.save;
  const deep = deepUnlocked(save);
  const lost = lostUnlocked(save);
  return (
    <div className="flex h-full flex-col px-5 pt-6 pb-4">
      <header className="flex items-start justify-between">
        <div>
          <p className="font-display text-[11px] tracking-[0.32em] text-copper uppercase">Illustrated rewrite</p>
          <h1 className="font-display text-[42px] leading-none font-extrabold text-cream">Acornaut</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-copper/40 bg-ink/70 px-3 py-1.5">
          <AcornMark />
          <span className="text-sm font-bold text-copper">{save.acorns}</span>
        </div>
      </header>

      <div className="relative mx-auto mt-3 h-[34%] w-[78%] max-w-[280px]">
        <img
          src="/art/hero.jpg"
          alt=""
          className="h-full w-full object-contain object-center drop-shadow-[0_18px_40px_rgba(232,164,74,0.22)]"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <ModeBtn
          label="FLY"
          sub={`the classic void · best ${save.highScore}`}
          primary
          onClick={() => engine.fly("fly")}
        />
        <ModeBtn
          label="DEEP SPACE"
          sub={deep ? `shifts every 10s · best ${save.deepBest}` : "unlocks at level 5"}
          locked={!deep}
          onClick={() => deep && engine.fly("deep")}
        />
        <ModeBtn
          label="LOST IN SPACE"
          sub={lost ? `tilt, drift, wormholes · best ${save.lostBest}` : "unlocks at level 10"}
          locked={!lost}
          onClick={() => lost && engine.fly("lost")}
        />
      </div>

      <nav className="mt-4 grid grid-cols-4 gap-2">
        <Dock icon={Warehouse} label="Hangar" onClick={() => engine.open("hangar")} />
        <Dock icon={BookOpen} label="Log" onClick={() => engine.open("log")} />
        <Dock icon={UserRound} label="Social" onClick={() => engine.open("social")} />
        <Dock icon={CircleHelp} label="Help" onClick={() => engine.open("help")} />
      </nav>
      <p className="mt-2 text-center text-[10px] tracking-wide text-fog/70">
        {BUILD}
        {userPending ? "" : userName ? ` · ${userName}` : ""}
      </p>
    </div>
  );
}

function ModeBtn({
  label,
  sub,
  primary,
  locked,
  onClick,
}: {
  label: string;
  sub: string;
  primary?: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={
        "flex items-center justify-between rounded-2xl px-4 py-3 text-left " +
        (primary
          ? "bg-ion text-ink shadow-[0_10px_30px_rgba(74,180,255,0.25)]"
          : "border border-line bg-panel text-cream") +
        (locked ? " opacity-45" : "")
      }
    >
      <span>
        <span className="block font-display text-lg font-bold tracking-wide">{label}</span>
        <span className={"block text-[11px] " + (primary ? "text-ink/70" : "text-fog")}>{sub}</span>
      </span>
      <Rocket className="size-5 opacity-80" />
    </button>
  );
}

function Dock({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Warehouse;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-panel py-2.5 text-cream"
    >
      <Icon className="size-5 text-copper" />
      <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
    </button>
  );
}

function Sheet({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-void/92 backdrop-blur-sm">
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-line bg-panel px-3 py-2 text-xs font-bold tracking-wide text-cream"
        >
          BACK
        </button>
        <h2 className="font-display text-2xl font-bold text-cream">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">{children}</div>
    </div>
  );
}

function Hangar({ engine }: { engine: Engine }) {
  const tab = engine.shopTab;
  const save = engine.save;
  const helm = HELMETS.find((h) => h.id === save.equipped);
  const suit = SUITS.find((s) => s.id === save.equippedSuit);
  const trail = TRAILS.find((t) => t.id === save.equippedTrail);
  const pal = PALS.find((p) => p.id === save.equippedPal);
  return (
    <Sheet title="Hangar" onBack={() => engine.open("title")}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-bold text-copper">
          <AcornMark />
          {save.acorns}
        </div>
        <p className="text-[11px] text-fog">
          LV {pilotLevelOf(save)} · {pilotTitleOf(save)}
        </p>
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-panel p-3">
        <Portrait engine={engine} helmet={helm ?? HELMETS[0]} suit={suit ?? SUITS[0]} size={64} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-cream">
            {helm?.name} · {suit?.name}
          </p>
          <p className="truncate text-[11px] text-fog">
            {trail?.name} · {pal?.name}
          </p>
          <div className="mt-1 flex gap-1">
            {(trail?.colors ?? []).slice(0, 3).map((c) => (
              <span key={c} className="h-2 w-5 rounded-full" style={{ background: c }} />
            ))}
          </div>
        </div>
        {pal && <PalMark engine={engine} id={pal.id} size={40} />}
      </div>
      <div className="mb-4 flex shrink-0 flex-wrap gap-1.5">
        {(["helmets", "suits", "trails", "pals", "mods"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => engine.setShopTab(t)}
            className={
              "rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase " +
              (tab === t ? "bg-ion text-ink" : "border border-line bg-panel text-fog")
            }
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "helmets" && (
        <Grid>
          {HELMETS.map((h) => {
            const owned = save.unlocked.includes(h.id);
            const eq = save.equipped === h.id;
            return (
              <Card
                key={h.id}
                name={h.name}
                meta={owned ? (eq ? "EQUIPPED" : "OWNED") : `${h.cost}`}
                active={eq}
                onClick={() => engine.buyHelmet(h.id)}
              >
                <img
                  src={artUrl(`helmets/${h.id}.png`)}
                  alt={h.name}
                  width={56}
                  height={56}
                  className="h-16 w-16 object-contain"
                  draggable={false}
                />
              </Card>
            );
          })}
        </Grid>
      )}
      {tab === "suits" && (
        <Grid>
          {SUITS.map((s) => {
            const revealed = suitRevealed(save, s.id);
            const owned = save.unlockedSuits.includes(s.id);
            const eq = save.equippedSuit === s.id;
            return (
              <Card
                key={s.id}
                name={s.name}
                meta={!revealed ? `LV ${SUIT_REVEAL[s.id]}` : owned ? (eq ? "EQUIPPED" : "OWNED") : `${s.cost}`}
                active={eq}
                locked={!revealed}
                onClick={() => engine.buySuit(s.id)}
              >
                <img
                  src={artUrl(`suits/${s.id}.png`)}
                  alt={s.name}
                  width={56}
                  height={56}
                  className="h-16 w-16 object-contain"
                  draggable={false}
                />
              </Card>
            );
          })}
        </Grid>
      )}
      {tab === "trails" && (
        <Grid>
          {TRAILS.map((t) => {
            const owned = save.unlockedTrails.includes(t.id);
            const eq = save.equippedTrail === t.id;
            return (
              <Card
                key={t.id}
                name={t.name}
                meta={owned ? (eq ? "EQUIPPED" : "OWNED") : `${t.cost}`}
                active={eq}
                onClick={() => engine.buyTrail(t.id)}
              >
                <TrailMark engine={engine} trail={t} />
              </Card>
            );
          })}
        </Grid>
      )}
      {tab === "pals" && (
        <Grid>
          {PALS.map((p) => {
            const open = palUnlocked(save, p.id);
            const eq = save.equippedPal === p.id;
            return (
              <Card
                key={p.id}
                name={p.name}
                meta={!open ? `LV ${PAL_LEVELS[p.id]}` : p.tag}
                active={eq}
                locked={!open}
                onClick={() => engine.equipPal(p.id)}
              >
                {p.id === "none" ? (
                  <PalMark engine={engine} id={p.id} size={48} />
                ) : (
                  <img
                    src={artUrl(`pals/${p.art || p.id}.png`)}
                    alt={p.name}
                    width={80}
                    height={80}
                    className="h-20 w-20 object-contain"
                    draggable={false}
                  />
                )}
              </Card>
            );
          })}
        </Grid>
      )}
      {tab === "mods" && (
        <div className="space-y-3">
          <ModRow
            name="Start Shield"
            desc="Begin the next run with one charge."
            meta={
              !startShieldUnlocked(save)
                ? "LV 3"
                : save.startShield
                  ? "ARMED"
                  : `${MOD_SHIELD_COST}`
            }
            locked={!startShieldUnlocked(save)}
            onClick={() => engine.toggleMod("shield")}
          />
          <ModRow
            name="Shield Battery"
            desc="Hold up to three shield charges."
            meta={!batteryUnlocked(save) ? "LV 8" : save.battery ? "OWNED" : `${MOD_BATTERY_COST}`}
            locked={!batteryUnlocked(save)}
            onClick={() => engine.toggleMod("battery")}
          />
        </div>
      )}
    </Sheet>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

function Card({
  name,
  meta,
  active,
  locked,
  children,
  onClick,
}: {
  name: string;
  meta: string;
  active?: boolean;
  locked?: boolean;
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex min-h-[148px] flex-col items-center justify-end rounded-2xl border px-1.5 pb-2 pt-3 " +
        (active ? "border-ion bg-ion/15" : "border-line bg-panel") +
        (locked ? " opacity-50" : "")
      }
    >
      <span className="mb-1 flex h-16 w-16 shrink-0 items-center justify-center overflow-visible">{children}</span>
      <span className="text-center text-[11px] font-bold text-cream">{name}</span>
      <span className="text-[10px] font-semibold text-copper">{meta}</span>
    </button>
  );
}

function Portrait({
  engine,
  helmet,
  suit,
  size = 56,
}: {
  engine: Engine;
  helmet: (typeof HELMETS)[number];
  suit: (typeof SUITS)[number];
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const art = engine.art;
    if (!c || !art) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    paintPortrait(ctx, art, helmet, suit, size / 2, size / 2, size * 0.88);
  }, [engine.art, helmet, suit, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
}

function TrailMark({ engine, trail }: { engine: Engine; trail: (typeof TRAILS)[number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = 64;
    const h = 36;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    paintTrailPreview(ctx, trail, w * 0.42, h * 0.5, 0.2);
    void engine;
  }, [engine, trail]);
  return <canvas ref={ref} width={64} height={36} className="h-9 w-16" />;
}

function PalMark({ engine, id, size = 48 }: { engine: Engine; id: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    paintPalPreview(ctx, engine.art, id, size / 2, size / 2, size * 0.92);
  }, [engine.art, id, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
}

function ModRow({
  name,
  desc,
  meta,
  locked,
  onClick,
}: {
  name: string;
  desc: string;
  meta: string;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3 text-left"
    >
      <span>
        <span className="block font-bold text-cream">{name}</span>
        <span className="block text-xs text-fog">{desc}</span>
      </span>
      <span className={"text-xs font-bold " + (locked ? "text-fog" : "text-copper")}>{meta}</span>
    </button>
  );
}

function FlightLog({ engine }: { engine: Engine }) {
  const save = engine.save;
  const lv = pilotLevelOf(save);
  const next = xpCumulative(lv + 1);
  const need = Math.max(0, next - save.xp);
  return (
    <Sheet title="Flight Log" onBack={() => engine.open("title")}>
      <div className="mb-4 rounded-2xl border border-line bg-panel p-4">
        <p className="font-display text-sm text-copper">
          LV {lv} · {pilotTitleOf(save)}
        </p>
        <p className="mt-1 text-xs text-fog">{need} XP to next node</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink">
          <div
            className="h-full bg-ion"
            style={{
              width: `${Math.min(100, ((save.xp - xpCumulative(lv)) / Math.max(1, next - xpCumulative(lv))) * 100)}%`,
            }}
          />
        </div>
      </div>
      <ol className="relative space-y-3 border-l border-copper/40 pl-4">
        {TRACK.map((item, i) => {
          const earned = lv >= item.lvl;
          const pal = item.kind === "pal" ? PALS.find((p) => p.id === item.id) : null;
          const name = pal?.name ?? item.name ?? "";
          const desc = pal?.desc ?? item.desc ?? "";
          return (
            <li key={i} className="relative">
              <span
                className={
                  "absolute top-1.5 -left-[21px] h-2.5 w-2.5 rotate-45 " +
                  (earned ? "bg-copper" : "border border-fog bg-ink")
                }
              />
              <div className={"rounded-2xl border p-3 " + (earned ? "border-copper/40 bg-panel" : "border-line bg-ink")}>
                <p className="text-[10px] font-bold tracking-wider text-ion uppercase">
                  LV {item.lvl} · {item.kind}
                </p>
                <div className="flex items-center gap-2">
                  {pal && <PalMark engine={engine} id={pal.id} size={32} />}
                  <p className="font-display text-base font-bold text-cream">{name}</p>
                </div>
                <p className="text-xs text-fog">{desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}

function Social({ engine }: { engine: Engine }) {
  const save = engine.save;
  const lv = pilotLevelOf(save);
  return (
    <Sheet title="Social" onBack={() => engine.open("title")}>
      <div className="rounded-2xl border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <img src="/art/thumbs/squirrel.png" alt="" className="h-14 w-14 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-bold text-cream">
              LV {lv} {pilotTitleOf(save)}
            </p>
            <p className="text-xs text-fog">{save.xp} lifetime XP</p>
          </div>
          <AuthChip />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat k="BEST" v={save.highScore} />
          <Stat k="DEEP" v={save.deepBest} />
          <Stat k="LOST" v={save.lostBest} />
        </div>
        <p className="mt-3 text-sm text-copper">
          <AcornMark /> {save.acorns} banked
        </p>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-[11px] font-bold tracking-wider text-fog uppercase">Connect</p>
        <div className="grid grid-cols-3 gap-2">
          {["X / Twitter", "Discord", "Instagram"].map((n) => (
            <div key={n} className="rounded-2xl border border-line bg-panel px-2 py-3 text-center">
              <p className="text-[11px] font-bold text-cream">{n}</p>
              <p className="text-[9px] text-copper">coming soon</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <p className="text-[11px] font-bold tracking-wider text-fog uppercase">Leaderboards</p>
        <p className="mt-1 text-sm text-cream">Global leaderboards are coming soon.</p>
        <p className="mt-1 text-xs text-fog">Your records stay on this device until then.</p>
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <p className="text-[11px] font-bold tracking-wider text-ion uppercase">News & updates</p>
        <p className="mt-1 text-xs font-bold text-copper">ACORNAUT {GAME_VERSION}</p>
        <ul className="mt-2 space-y-1">
          {NEWS.map((line) => (
            <li key={line} className="text-xs text-cream">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function AuthChip() {
  return (
    <div className="h-9">
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <a href="/login" className="text-xs font-bold tracking-wide text-ion uppercase">
          Sign in
        </a>
      </SignedOut>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-xl bg-ink px-2 py-2">
      <p className="text-[10px] tracking-wider text-fog">{k}</p>
      <p className="font-display text-lg font-bold text-cream">{v}</p>
    </div>
  );
}

function Help({ engine }: { engine: Engine }) {
  return (
    <Sheet title="Help" onBack={() => engine.open("title")}>
      <div className="space-y-3 text-sm text-cream">
        <p className="font-display text-lg font-bold">How to fly</p>
        <HelpLine icon={Rocket} title="TAP" body="A boost upward. Rhythm over spam." />
        <HelpLine icon={Hexagon} title="SWIPE DOWN" body="A fast dive. Also cancels a planet bounce." />
        <HelpLine icon={Sparkles} title="ACORNS" body="Bank them. Cosmetics live in the hangar." />
        <p className="pt-2 text-xs text-fog">
          Slow acorns freeze time. Gold is invulnerable. Shields eat one hit. Planets bounce — they do not kill.
          Debris and falling off-screen do.
        </p>
        <p className="text-xs text-fog">
          Companions change the run. Deep Space chains warps every 10s. Lost in Space tilts, drifts, and mirrors.
        </p>
        <button
          type="button"
          onClick={() => engine.replayTutorial()}
          className="mt-2 w-full rounded-2xl bg-ion py-3 font-bold text-ink"
        >
          REPLAY TUTORIAL
        </button>
      </div>
    </Sheet>
  );
}

function HelpLine({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Rocket;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-panel p-3">
      <Icon className="mt-0.5 size-5 text-copper" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-xs text-fog">{body}</p>
      </div>
    </div>
  );
}

function PauseMenu({ engine }: { engine: Engine }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/70 px-6 text-center backdrop-blur-[2px]">
      <p className="font-display text-3xl font-extrabold text-cream">PAUSED</p>
      <p className="mt-2 text-sm text-fog">Score {engine.world.score}</p>
      <button
        type="button"
        onClick={() => engine.resume()}
        className="mt-6 w-full max-w-[240px] rounded-2xl bg-ion py-3 font-bold text-ink"
      >
        RESUME
      </button>
      <button
        type="button"
        onClick={() => engine.open("title")}
        className="mt-2 w-full max-w-[240px] rounded-2xl border border-line bg-panel py-3 font-bold text-cream"
      >
        ABORT TO TITLE
      </button>
    </div>
  );
}

function Death({ engine }: { engine: Engine }) {
  const dead = engine.snap().dead;
  if (!dead) return null;
  const save = engine.save;
  const shownLv = dead.toLv;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/70 px-6 text-center backdrop-blur-[2px]">
      <p className="font-display text-3xl font-extrabold text-cream">CRASHED</p>
      <p className="mt-3 text-lg text-cream">Score {dead.score}</p>
      <p className="text-copper">+{dead.acorns} acorns</p>
      {dead.best && dead.score > 0 && <p className="mt-1 text-sm font-bold text-ion">NEW BEST</p>}
      <div className="mt-5 w-full max-w-[260px] rounded-2xl border border-line bg-panel p-3">
        <p className="text-[11px] font-bold tracking-wider text-fog uppercase">
          +{dead.xp} XP · LV {shownLv} {titleForLevel(shownLv)}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink">
          <div
            className="h-full bg-copper"
            style={{
              width: `${Math.min(100, ((save.xp - xpCumulative(shownLv)) / Math.max(1, xpCumulative(shownLv + 1) - xpCumulative(shownLv))) * 100)}%`,
            }}
          />
        </div>
        {dead.toLv > dead.fromLv && (
          <p className="mt-2 font-display text-sm font-bold text-ion">PILOT LEVEL {dead.toLv}!</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => engine.dismissDead()}
        className="mt-6 rounded-2xl bg-ion px-8 py-3 font-bold text-ink"
      >
        CONTINUE
      </button>
    </div>
  );
}
