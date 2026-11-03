import type { Engine } from "./engine";
import { SUITS } from "./catalog";
import { SPILL_CONTROL_COLORS } from "./spill-control-art";
import { artUrl } from "./art";
import { spillAppearance } from "./spill-appearance";
import { paintShipPreview, type ShipPick } from "./draw";
import { writeSave } from "./save";
import { SPILL_ENGINE_COLORS, SPILL_UTILITIES, SPILL_UTILITY_IDS, SPILL_SPECIALTIES, SPILL_EVENTS,
  spillEngineColor, spillContractOffers, spillEventFor, type SpillUtility, type SpillSpecialty } from "./spill-content";
import { spillBuildFromState } from "./spill-presentation";
import { SPILL_SHOP, spillPrice, spillContractProgress, type SpillBuyable } from "./spill";
import { SPILL_WEAPONS, spillWeaponPrice, spillWeaponStats, spillAccuracyLabel, type SpillWeaponId } from "./spill-combat";
import { SPILL_ARTIFACTS } from "./spill-builds";
import { spillShelf, spillSlotCap, spillFittedCount, spillFittedItems, spillItemInfo, spillItemFitted, spillItemPrice, spillShelfUndoable, itemKey } from "./spill-shop";
import { SPILL_HAZARDS, SPILL_HAZARD_IDS, spillHazardPlan } from "./spill-hazards";
import { SPILL_CHASSIS, SPILL_WEAPON_MODULES, SPILL_TRIALS } from "./spill-career";
import { SPILL_RISKS, type SpillRiskId } from "./spill-expeditions";
import { spillClimaxWave } from "./spill-climax";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const n = document.createElement(tag); n.className = cls;
  n.textContent = text;
  if (tag === "button") (n as HTMLButtonElement).type = "button";
  return n;
};
type UIState = "available" | "selected" | "locked" | "unaffordable" | "complete" | "arming";
/** Presentation state is separate from disabled: an equipped item remains visibly fitted. */
function uiState(node: HTMLElement, state: UIState) { node.dataset.uiState = state; return node; }
const systems = ["plating", "shield", "thrusters", "pulse"] as const;
type System = typeof systems[number];
const symbols = {
  plating: "M7 2H17L23 8V16L17 22H7L1 16V8ZM8 6V18H16V6Z",
  shield: "M12 2 21 6V12C21 17 17 21 12 23 7 21 3 17 3 12V6Z",
  thrusters: "M12 2C14 8 21 9 20 16 19 23 5 23 4 16 3 12 7 10 7 7 8 10 10 11 10 14 15 11 11 7 12 2Z",
  pulse: "M13 2 4 14H11L10 22 21 9H13Z", core: "M4 10A8 8 0 1 1 5 18M4 3V10H11",
};
function systemIcon(id: keyof typeof symbols) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.classList.add("ac-workshop-icon");
  const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", symbols[id]);
  path.setAttribute("fill", id === "core" ? "none" : "currentColor");
  if (id === "core") { path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "2"); }
  svg.append(path); return svg;
}
function coin() { const im = el("img", "ac-workshop-coin"); im.src = artUrl("pickups/acorn-coin.svg"); im.alt = ""; im.draggable = false; return im; }
export function spillUtilityArt(id: SpillUtility) {
  const im = el("img", "ac-utility-art"); im.src = artUrl(`spill-ship/utilities/${id}.webp`);
  im.alt = ""; im.draggable = false; im.width = im.height = 64; return im;
}
function shipPreview(engine: Engine, pick: ShipPick, height: number, flashAt = -10000, scale = 3.2) {
  const canvas = el("canvas", "ac-workshop-preview"), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 344 * dpr; canvas.height = height * dpr;
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Your selected ship and fitted utilities");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    let last = -Infinity;
    const paint = (now: number) => {
      if (!canvas.isConnected) return;
      const reduced = engine.save.motionOff || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (now - last >= 1000 / 30 - 1) {
        last = now; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, 344, height);
        const flash = Math.max(0, 1 - (now - flashAt) / 700);
        if (flash && !reduced) {
          const glow = ctx.createRadialGradient(180, height * .55, 10, 180, height * .55, 130);
          glow.addColorStop(0, `rgba(130,225,176,${flash * .4})`); glow.addColorStop(1, "rgba(130,225,176,0)");
          ctx.fillStyle = glow; ctx.fillRect(0, 0, 344, height);
        }
        paintShipPreview(ctx, engine.art, engine.save, 189, height * .55, scale, reduced ? 0 : now / 1000, pick);
      }
      if (!reduced) requestAnimationFrame(paint);
    }; requestAnimationFrame(paint);
  }
  return canvas;
}

/** Earned starting utilities are equipped in Loadout. */
export function drawSpillStarters(engine: Engine, onPick = () => {}) {
  const save = engine.save, wrap = el("section", "ac-starting-kit");
  wrap.append(el("h3", "", "Starting utility"), el("p", "ac-workshop-note", "Choose one earned item. Free on every new run."));
  const none = el("button", `ac-starter-none${!save.spillStarter ? " on" : ""}`, !save.spillStarter ? "✓ No starting utility" : "No starting utility");
  none.dataset.shipStarter = "stock"; none.setAttribute("aria-pressed", String(!save.spillStarter));
  uiState(none, !save.spillStarter ? "selected" : "available");
  none.onclick = () => { onPick(); engine.spillStarter(null); }; wrap.append(none);
  const choices = el("div", "ac-starting-options");
  for (const id of SPILL_UTILITY_IDS.filter(u => u !== "brake")) {
    const u = SPILL_UTILITIES[id], earned = save.spillBest >= u.unlock, selected = save.spillStarter === id;
    const b = el("button", `ac-starter-option${selected ? " on" : ""}`), text = el("span", "ac-starter-text");
    b.dataset.shipStarter = id; b.title = u.detail; b.disabled = !earned; b.setAttribute("aria-pressed", String(selected));
    uiState(b, !earned ? "locked" : selected ? "selected" : "available");
    text.append(el("b", "", u.name), el("span", "", id === "capacitor" ? "Extra Pulse charge · needs Impact pulse." : u.desc), el("strong", "", !earned ? `Clear wave ${u.unlock}` : selected ? "✓ Selected for next run" : "Select · free"));
    b.append(spillUtilityArt(id), text); b.onclick = () => { onPick(); engine.spillStarter(id); }; choices.append(b);
  }
  wrap.append(choices); return wrap;
}

/** Earned choices change a tradeoff, not the wave requirements. */
export function drawSpillCareer(engine: Engine) {
  const section = el("section", "ac-career-options"), trial = engine.spillTrial();
  const inRun = engine.world.screen === "play", loadout = inRun ? engine.world.spill!.loadout : engine.save.spillCareer;
  section.setAttribute("aria-label", "Starting ship and weapon module");
  section.append(el("h3", "", "Ship & weapon tuning"),
    el("p", "ac-workshop-note", trial ? "Trial only · your real run is unchanged" : "Unlock by clearing waves · each is a tradeoff"));
  for (const [kind, title, choices, pick] of [
    ["chassis", "Chassis", SPILL_CHASSIS, (id: string) => engine.spillSelectChassis(id as typeof SPILL_CHASSIS[number]["id"])],
    ["module", "Weapon module", SPILL_WEAPON_MODULES, (id: string) => engine.spillSelectWeaponModule(id as typeof SPILL_WEAPON_MODULES[number]["id"])],
  ] as const) {
    const group = el("div", "ac-career-group"); group.setAttribute("role", "group"); group.setAttribute("aria-label", title);
    group.append(el("h4", "", title));
    const grid = el("div", "ac-career-grid");
    for (const choice of choices) {
      const selected = (loadout?.[kind] ?? "standard") === choice.id;
      const earned = !!trial || engine.save.spillBest >= choice.unlock;
      const button = el("button", `ac-career-choice${selected ? " on" : ""}`);
      button.type = "button"; button.dataset.careerChoice = `${kind}-${choice.id}`;
      button.disabled = !earned; button.setAttribute("aria-pressed", String(selected));
      uiState(button, !earned ? "locked" : selected ? "selected" : "available");
      button.append(el("b", "", choice.name), el("span", "", choice.detail),
        el("strong", "", !earned ? `Clear wave ${choice.unlock}` : selected ? "✓ Selected" : "Select · free"));
      button.onclick = () => pick(choice.id); grid.append(button);
    }
    group.append(grid); section.append(group);
  }
  return section;
}
export function drawSpillEnginePicker(engine: Engine) {
  const chosen = spillEngineColor(engine.save), wrap = el("section", "ac-engine-picker"), head = el("div", "ac-workshop-sectionhead");
  head.append(el("h3", "", `Engine color: ${chosen.name}`), el("span", "", "Appearance only")); wrap.append(head);
  const colors = el("div", "ac-engine-colors");
  for (const color of SPILL_ENGINE_COLORS) {
    const selected = color.id === chosen.id, earned = engine.save.spillBest >= color.at;
    const b = el("button", `ac-engine-color${selected ? " on" : ""}`), swatch = el("i", "ac-engine-swatch");
    b.dataset.shipColor = color.id; b.disabled = !earned; b.setAttribute("aria-pressed", String(selected));
    uiState(b, !earned ? "locked" : selected ? "selected" : "available");
    b.setAttribute("aria-label", `${color.name}${selected ? ", selected" : ""}${earned ? "" : `, clear wave ${color.at} to unlock`}`);
    swatch.style.setProperty("--engine-color", color.color); swatch.setAttribute("aria-hidden", "true");
    b.append(swatch, el("span", "", color.name), el("small", "", !earned ? `Wave ${color.at}` : selected ? "✓ Selected" : "Use color"));
    b.onclick = () => engine.setSpillEngineColor(color.id); colors.append(b);
  }
  wrap.append(colors);
  if (spillAppearance(engine.save).trail === "rust-wake") wrap.append(el("p", "ac-workshop-note", "Rust Wake overrides this color with orange. Switch to the standard trail in Loadout to use your color."));
  return wrap;
}
/** THE ONE INSTRUCTIONS SHEET (owner, 10 Sep 2026: "a single instructions
 *  menu should pop up for gameplay mechanics"). It teaches the hand and the
 *  loop, shows the ship the pilot is about to fly, and offers nothing to
 *  choose: the free upgrade waits at the Depot, utilities at wave 5. */
export function drawSpillLaunchSetup(engine: Engine, onGuide: () => void) {
  const save = engine.save, wrap = el("div", "ac-spillprep ac-spillsetup");
  const pilot = SUITS.find(s => s.id === save.equippedSuit)?.name ?? "Pilot";
  const head = el("header", "ac-setup-head"), heading = el("div");
  heading.append(el("p", "ac-kicker", "DEBRIS FIELD · NEW RUN"), el("h2", "", "How to fly"));
  const help = el("button", "ac-helpdot", "?"); help.dataset.spillControl = "setup-guide";
  help.setAttribute("aria-label", "How the Depot works"); help.onclick = onGuide;
  head.append(heading, help); wrap.append(head);
  const body = el("div", "ac-setup-body");
  body.append(flightControlCards(), harderKickNote());
  const loop = el("ol", "ac-setup-loop"); loop.setAttribute("aria-label", "The run");
  for (const [text, withCoin] of [["Survive the waves", false], ["Collect Acorn Coins", true], ["Depot every 5 waves · upgrade your ship · first upgrade free", false]] as const) {
    const step = el("li"); if (withCoin) step.append(coin()); step.append(el("span", "", text)); loop.append(step);
  }
  const stage = el("div", "ac-launch-ship");
  stage.append(shipPreview(engine, { plating: 0, thrusters: 0, pulse: 0, shield: 0, utilities: save.spillStarter ? [save.spillStarter] : [] }, 104, -10000, 2.5), el("b", "ac-launch-pilot", `${pilot} aboard`));
  body.append(loop, stage); wrap.append(body);
  const actions = el("div", "ac-workshop-actions"), back = el("button", "ac-ghost ac-workshop-exit", "MAIN MENU"), go = el("button", "ac-primary ac-workshop-launch", "START RUN");
  back.onclick = () => engine.open("title"); go.dataset.spillControl = "land";
  go.onclick = () => {
    // the briefing has been shown: the save says so, and nothing repeats it
    if (!engine.spillTrial() && !save.spillDepotGuideSeen) { save.spillDepotGuideSeen = true; writeSave(save); }
    engine.spillLunge();
  };
  actions.append(back, go); wrap.append(actions); return wrap;
}

export type DepotView = { key: string; part: System; extras: boolean; specialties: boolean; builds: boolean; forecast: boolean; risk: boolean; guide: boolean; swap: string | null; receipt: string; flashAt: number; openedAt: number; picked: boolean };
export const createDepotView = (): DepotView => ({ key: "", part: "plating", extras: false, specialties: false, builds: false, forecast: false, risk: false, guide: false, swap: null, receipt: "", flashAt: -10000, openedAt: performance.now(), picked: false });
/** THE FREE-PICK NUDGE (owner, 26 Sep 2026: "after a few seconds a pulsing ring
 *  around the free button and arrows to each of the upgraded options to help
 *  prompt a selection pick and clear selection route"). It waits this long
 *  after the pre-flight Depot opens. */
export const DEPOT_HINT_MS = 3000;
function drawDepotGuide(engine: Engine, onClose: () => void, closeLabel: string) {
  const sheet = el("section", "ac-lvlcard ac-depotcard ac-depotguidecard");
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "How the Depot works"); sheet.tabIndex = -1;
  const inRun = engine.world.screen === "play", goal = inRun ? engine.world.lvl?.def.spillFinish : null;
  const objective = engine.spillTrial() ? "Clear this encounter. Trial progress is not saved." : goal ? goal.kind === "ore" ? `Collect ${goal.n} Acorn Coins.` : `Visit ${goal.n} depots.`
    : inRun && engine.world.spill?.target ? `Survive ${engine.world.spill.target} waves.` : "Clear waves. Beat your best.";
  sheet.append(el("p", "ac-kicker", "DEBRIS FIELD · DEPOT GUIDE"), el("h2", "", "How the Depot works"), el("p", "ac-workshop-note", objective));
  const collect = el("div", "ac-guide-collect"), words = el("div");
  words.append(el("h3", "", "Collect Acorn Coins"), el("p", "", "Buy upgrades here. First one free.")); collect.append(coin(), words); sheet.append(collect);
  const effects = el("div", "ac-guide-systems");
  for (const [id, name, effect] of [["plating", "Health", "More health"], ["shield", "Shields", "Block hits"], ["thrusters", "Thrusters", "Sharper steering"], ["pulse", "Pulse", "Charged blast"]] as const) {
    const item = el("div"); item.dataset.system = id; item.append(systemIcon(id), el("b", "", name), el("span", "", effect)); effects.append(item);
  }
  sheet.append(effects, el("p", "ac-guide-services", "Repair · full health   |   Harder waves · bonus coins"));
  // Utilities are the wave-5 shelf, not the first decision: one compact row,
  // art and a short name, after the systems (owner: "not the most important
  // thing to understand").
  const title = el("div", "ac-workshop-sectionhead ac-guide-utilityhead"); title.append(el("h3", "", "Utilities"), el("span", "", "2 new each Depot · 2nd slot after wave 10")); sheet.append(title);
  const kit = el("div", "ac-guide-utilityrow");
  for (const id of SPILL_UTILITY_IDS.filter(u => u !== "brake")) {
    const u = SPILL_UTILITIES[id], item = el("div"); item.dataset.guideUtility = id; item.title = `${u.name} · ${u.guide}`;
    item.append(spillUtilityArt(id), el("b", "", u.short)); kit.append(item);
  }
  sheet.append(kit);
  sheet.append(hazardGuide());
  sheet.append(el("p", "ac-guide-services", "Artifacts show up on the same shelf"));
  const carry = el("div", "ac-guide-carry"), lost = el("div", "ac-guide-loss"), kept = el("div", "ac-guide-keep");
  lost.append(el("h3", "", "Out of lives"), el("p", "", "Wave 1. Acorn Coins, upgrades & artifacts reset."));
  kept.append(el("h3", "", "Unlocks stay"), el("p", "", "Chassis, weapon lens, starting utility, engine color.")); carry.append(lost, kept); sheet.append(carry);
  const enter = el("button", "ac-primary ac-workshop-launch", closeLabel); enter.dataset.spillControl = "enter-depot";
  enter.onclick = onClose;
  sheet.append(enter, el("p", "ac-workshop-note ac-guide-timing", "Depot every 5 waves · No timer")); return sheet;
}

/** Informational replay: reading it changes no run state and no save field. */
export function drawSpillGuideSheet(engine: Engine, onClose: () => void, closeLabel: string) {
  const wrap = el("div", "ac-lvlsheet ac-depotwrap ac-workshop ac-spillhelpwrap");
  wrap.style.setProperty("--workshop-art", `url("${artUrl("spill-scene/workshop.webp")}")`);
  const sheet = drawDepotGuide(engine, onClose, closeLabel);
  sheet.querySelector(".ac-guide-collect")?.before(drawSpillFlightHelp(false));
  wrap.append(sheet);
  wrap.onclick = e => { if (e.target === wrap) onClose(); };
  // Keys read by a modal must not tap or launch the ready ship behind it.
  wrap.onkeydown = e => {
    e.stopPropagation();
    if (e.key === "Tab") { e.preventDefault(); sheet.querySelector("button")?.focus(); }
  };
  wrap.onkeyup = e => e.stopPropagation();
  return wrap;
}

/** The briefing and Help share the current touch and keyboard controls.
 *  Each card wears one of the flight-control tints from SPILL_CONTROL_COLORS
 *  (owner, 10 Sep 2026: help cards match the colours used in Debris Field). */
const FLIGHT_CONTROLS = [
  ["HOLD + DRAG", "Steer · let go to hold", "W / S · ↑ / ↓", "thrust"],
  ["2ND FINGER", "Fire · hold to repeat", "F · Space", "dive"],
  ["FLICK ◀ ▶", "Dodge", "A / D · ← / →", "lunge"],
] as const;
function flightControlCards() {
  const controls = el("div", "ac-spillhelp-controls");
  for (const [input, action, note, pad] of FLIGHT_CONTROLS) {
    const card = el("div", `ac-spillhelp-pad ac-spillhelp-${pad}`);
    const { light, edge } = SPILL_CONTROL_COLORS[pad];
    card.style.setProperty("--pad-light", light);
    card.style.setProperty("--pad-edge", edge);
    card.append(el("b", "", input), el("span", "", action), el("small", "ac-sub", note)); controls.append(card);
  }
  return controls;
}
const harderKickNote = () => el("small", "ac-sub ac-spillhelp-extra", "Hold anywhere to steer · aim assist tracks enemies at your height");

/** The same instructions in Settings & Help and the replayable briefing. */
export function drawSpillFlightHelp(includeHazards = true) {
  const section = el("section", "ac-spillflighthelp");
  section.setAttribute("aria-label", "How to fly · Debris Field");
  section.append(el("p", "ac-kicker ac-secthead", "HOW TO FLY · DEBRIS FIELD"), flightControlCards(), harderKickNote(),
    el("p", "ac-sub", "Depot every 5 waves · spend Acorn Coins · first upgrade free."));
  if (includeHazards) section.append(hazardGuide());
  return section;
}

/** Help's one-glance summary of the run's depth: four rows, one line each. */
export function drawSpillDepthHelp() {
  const list = el("div", "ac-spilldepth");
  for (const [name, line] of [
    ["Weapons", "Rapid Laser or Heavy Cannon · switch free, upgrade at the Depot"],
    ["Patrols", "Pursuers and Flankers shoot back · down them for coins"],
    ["Utilities", "2 new each Depot · artifacts included · 2nd slot after wave 10"],
    ["Routes", "Optional riskier five-wave route · bonus coins if you clear it"],
  ] as const) {
    const row = el("div"); row.append(el("b", "", name), el("span", "", line)); list.append(row);
  }
  return list;
}

/** Shared rule metadata keeps the forecast and field guide aligned with admission. */
export function hazardGuide() {
  const section = el("details", "ac-hazard-guide");
  section.setAttribute("aria-label", "Space hazard field guide");
  section.append(el("summary", "", "Field guide · hazards"));
  for (const id of SPILL_HAZARD_IDS) {
    const spec = SPILL_HAZARDS[id], row = el("div"); row.dataset.hazard = id;
    row.append(el("b", "", `${spec.name} · wave ${spec.unlock}+`), el("p", "", spec.teach.replace(/^[A-Z ]+:\s*/, "").replace(/^./, c => c.toUpperCase())));
    section.append(row);
  }
  const elite = el("div"); elite.dataset.hazard = "warden";
  elite.append(el("b", "", "Warden · every 5th wave from 10"),
    el("p", "", "Leave its warned line; fire while its shield is open."));
  section.append(elite, el("p", "ac-workshop-note", "Every hazard warns first."));
  return section;
}

function hazardForecast(engine: Engine, view: DepotView) {
  const sp = engine.world.spill!, details = el("details", "ac-hazard-forecast");
  const trial = engine.spillTrial();
  const trialSpec = trial ? SPILL_TRIALS.find(item => item.id === trial.id)! : null;
  const end = trialSpec ? Math.min(sp.wave + 5, trialSpec.endWave ?? trialSpec.wave) : sp.wave + 5;
  details.dataset.spillControl = "hazard-forecast"; details.open = view.forecast;
  details.append(el("summary", "", trial ? "Trial forecast" : "Next five waves"));
  details.ontoggle = () => { if (details.isConnected) view.forecast = details.open; };
  const list = el("ol");
  for (let wave = sp.wave + 1; wave <= end; wave++) {
    const plan = spillHazardPlan(wave, sp.seed), event = spillEventFor(wave, sp.seed), row = el("li");
    row.dataset.spillForecastWave = String(wave);
    const names = plan.families.map(id => SPILL_HAZARDS[id].name);
    const label = (event !== "none" ? SPILL_EVENTS[event].name : names.join(" + ") || "Debris & flight practice")
      + (spillClimaxWave(wave) ? " + Warden" : "");
    row.append(el("b", "", `Wave ${wave}`), el("span", "", label));
    const advanced = plan.advanced || (sp.expedition.selected === "volatile"
      && !plan.families.some(id => SPILL_HAZARDS[id].unlock === wave));
    if (plan.families.length && (plan.maxActive > 1 || advanced)) row.append(el("small", "", plan.maxActive > 1 ? "Pairs" : "Advanced"));
    list.append(row);
  }
  details.append(list);
  return details;
}

/** RISK IS ONE QUESTION (owner, 3 Nov 2026: "one line ... a yes or no box,
 *  defaulted to No"). Yes takes the harder route for the next five waves;
 *  the bonus pays only if all five are cleared. */
function difficultyToggle(engine: Engine, view: DepotView, arming: boolean, rerender: () => void) {
  const sp = engine.world.spill!, on = sp.expedition.selected !== "standard", hard = SPILL_RISKS.volatile;
  const row = el("div", "ac-difficulty"); row.dataset.spillControl = "difficulty";
  const text = el("div"); text.append(el("b", "", "Harder next 5 waves?"), el("span", "", `+${hard.reward} coins if you clear them`));
  const choice = el("div", "ac-difficulty-choice"); choice.setAttribute("role", "group"); choice.setAttribute("aria-label", "Increase difficulty for a bonus");
  for (const [label, id] of [["No", "standard"], ["Yes", "volatile"]] as const) {
    const selected = (id === "volatile") === on, b = el("button", selected ? "on" : "", label);
    b.dataset.spillControl = `risk-${id}`; b.disabled = arming; b.setAttribute("aria-pressed", String(selected));
    b.onclick = () => { if (!selected && !engine.spillSelectRisk(id)) { view.receipt = "Unavailable"; rerender(); } };
    choice.append(b);
  }
  row.append(text, choice); return row;
}

export function drawDepotWorkshop(engine: Engine, view: DepotView, rerender: () => void) {
  const sp = engine.world.spill!, key = `${sp.seed}:${sp.wave}`;
  // The guide is behind the "?" only: the instructions sheet before the run
  // already taught the loop, and a Depot that opens a second sheet on
  // arrival hid the free upgrade behind it (owner, 10 Sep 2026).
  if (key !== view.key) Object.assign(view, createDepotView(), { key });
  const wrap = el("div", "ac-lvlsheet ac-depotwrap ac-workshop");
  wrap.style.setProperty("--workshop-art", `url("${artUrl("spill-scene/workshop.webp")}")`);
  if (view.guide) {
    wrap.append(drawDepotGuide(engine, () => { view.guide = false; rerender(); }, "BACK TO DEPOT"));
    return wrap;
  }
  const sheet = el("section", "ac-lvlcard ac-depotcard ac-workshop-card");
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Salvage depot");
  const arming = (sp.depot?.arm ?? 0) > 0;
  // A redraw must not restart the nudge, so its delay is measured from when
  // this Depot opened: negative once the wait is over, which resumes the
  // pulse mid-cycle instead of hiding it again.
  const hinting = !!(sp.welcome && sp.freeUpgrade) && !arming;
  if (hinting) {
    sheet.classList.add("ac-workshop-hinting");
    sheet.style.setProperty("--hint-delay", `${Math.round(DEPOT_HINT_MS - (performance.now() - view.openedAt))}ms`);
  }
  const feedback = (message: string) => { view.receipt = message; view.flashAt = performance.now(); };
  const priceButton = (what: SpillBuyable, label?: string) => {
    const price = spillPrice(sp, what), b = el("button", "ac-workshop-buy"); b.dataset.spillControl = what;
    b.disabled = arming || price === null || price > sp.ore || (!!sp.welcome && (!sp.freeUpgrade || what === "repair" || what === "core"));
    uiState(b, arming ? "arming" : price === null ? "complete" : sp.welcome && (!sp.freeUpgrade || what === "repair" || what === "core")
      ? "locked" : price > sp.ore ? "unaffordable" : "available");
    const text = price === null ? what === "repair" ? "Full health" : what === "core" ? sp.coreArmed ? "Ready" : "Used" : "Full"
      : sp.welcome && !sp.freeUpgrade ? "Next stop" : price === 0 ? "Free" : String(price);
    if (label && price !== null) b.append(el("span", "", label));
    if (price !== null && price > 0 && !sp.welcome) b.append(coin()); b.append(el("span", "", text));
    b.setAttribute("aria-label", `${SPILL_SHOP[what].name}: ${price === null ? "complete" : price === 0 ? "free upgrade" : `${price} Acorn Coins`}`);
    b.onclick = () => {
      feedback(what === "repair" ? "Health restored" : what === "core" ? "Extra life ready" : `${SPILL_SHOP[what].name} upgraded`);
      if (engine.spillBuy(what) !== "ok") { view.receipt = "Upgrade unavailable"; rerender(); }
    }; return b;
  };
  const head = el("header", "ac-workshop-head"), heading = el("div"), tools = el("div", "ac-workshop-headtools"), wallet = el("div", "ac-workshop-wallet");
  const trial = engine.spillTrial();
  heading.append(el("p", "ac-kicker", trial ? "PRACTICE · NO PROGRESS SAVED" : `DEBRIS FIELD · ${sp.welcome ? "PRE-FLIGHT" : `WAVE ${sp.wave} CLEARED`}`),
    el("h2", "", trial ? "Trial loadout" : sp.firstPass ? "First pass complete" : "Salvage depot"));
  wallet.setAttribute("aria-label", `${sp.ore} Acorn Coins`); wallet.append(coin(), el("b", "", String(sp.ore)));
  const guide = el("button", "ac-helpdot", "?"); guide.setAttribute("aria-label", "How the Depot works"); guide.dataset.spillControl = "guide"; guide.onclick = () => { view.guide = true; rerender(); };
  const status = el("div", "ac-workshop-status"), health = el("div", "ac-workshop-health"), healthText = el("span"), healthBar = el("progress");
  status.setAttribute("role", "group"); status.setAttribute("aria-label", "Ship status");
  healthText.append(systemIcon("plating"), el("b", "", "Health"), el("span", "", `${sp.hull} / ${sp.maxHull}`));
  healthBar.max = sp.maxHull; healthBar.value = sp.hull; healthBar.setAttribute("aria-label", `${sp.hull} of ${sp.maxHull} health`); health.append(healthText, healthBar);
  const shields = el("div", "ac-workshop-shields"); shields.append(systemIcon("shield"), el("span", "", `Shields ${sp.shield} / 2`));
  status.append(health, shields); if (!sp.welcome) status.append(priceButton("repair", "Repair"));
  tools.append(wallet, guide); head.append(heading, tools); sheet.append(head);
  if (sp.firstPass && !trial) sheet.append(el("p", "ac-workshop-milestone", "Wave 20 complete. Victory recorded. Keep your ship and fly on."));
  sheet.append(status);
  if (sp.welcome) sheet.append(el("p", "ac-workshop-free", sp.freeUpgrade ? "Choose one free upgrade" : "✓ Upgrade fitted · ready to launch"));
  // Acornaut's Depot is one scrolling card: the systems bay first, then the
  // run's outfitting (weapons, artifacts, routes, forecast, utilities).
  const bay = sheet, outfitting = sheet;
  const stage = el("div", "ac-workshop-stage"); stage.append(shipPreview(engine, spillBuildFromState(sp), 192, view.flashAt));
  // the arrows point at the four options until the pilot taps one of them
  if (hinting && !view.picked) stage.classList.add("ac-workshop-hint-arrows");
  const links = document.createElementNS("http://www.w3.org/2000/svg", "svg"); links.classList.add("ac-workshop-links"); links.setAttribute("viewBox", "0 0 344 192"); links.setAttribute("aria-hidden", "true");
  const paths = { plating: "M 97 36 L 119 36 L 153 85", shield: "M 252 36 L 235 36 L 214 82", thrusters: "M 90 165 L 104 130 L 110 119", pulse: "M 255 164 L 260 138 L 252 121" };
  for (const id of systems) {
    const path = document.createElementNS(links.namespaceURI, "path"); path.setAttribute("d", paths[id]); path.setAttribute("data-system", id); links.append(path);
    const b = el("button", `ac-workshop-system${view.part === id ? " selected" : ""}`); b.dataset.system = id; b.dataset.spillControl = `inspect-${id}`;
    uiState(b, view.part === id ? "selected" : "available");
    b.setAttribute("aria-pressed", String(view.part === id));
    const name = el("span", "ac-workshop-systemname"), price = spillPrice(sp, id);
    name.append(systemIcon(id), el("b", "", SPILL_SHOP[id].name));
    const cost = el("span", "ac-workshop-systemprice", price === null ? "Full" : sp.welcome && !sp.freeUpgrade ? "Next stop" : price === 0 ? "Free" : String(price));
    if (price && !sp.welcome) cost.append(coin()); b.append(name, cost);
    b.onclick = () => { view.part = id; view.specialties = false; view.picked = true; rerender(); }; stage.append(b);
  }
  stage.append(links); bay.append(stage);
  const part = view.part, tier = part === "shield" ? sp.shield : sp.up[part], max = part === "shield" ? 2 : 3;
  const selection = el("section", "ac-workshop-selection"), words = el("div", "ac-workshop-selectiontext"); selection.dataset.system = part;
  words.append(el("h3", "", `${SPILL_SHOP[part].name}${part === "plating" ? " upgrade" : ""}`), el("p", "", part === "shield"
    ? tier >= max ? "Two shields ready" : `Blocks one hit · ${tier} → ${tier + 1} shields`
    : tier >= max ? "Fully upgraded" : part === "plating" ? `Max health ${sp.maxHull} → ${sp.maxHull + 1}` : SPILL_SHOP[part].levels[tier]));
  const take = priceButton(part);
  // the ring marks the one button that fits the free upgrade
  if (hinting) take.classList.add("ac-workshop-hint-ring");
  selection.append(systemIcon(part), words, take); bay.append(selection);
  const price = spillPrice(sp, part);
  if (!sp.welcome && price !== null && price > sp.ore) bay.append(el("p", "ac-workshop-need", `${price - sp.ore} more Acorn Coins needed`));
  if (!sp.welcome && part !== "shield" && tier >= 2) {
    const details = el("details", "ac-workshop-specialties"); details.open = view.specialties; details.append(el("summary", "", "Customize this upgrade · free"));
    details.ontoggle = () => { if (details.isConnected) view.specialties = details.open; };
    const choices = el("div", "ac-spilloptions");
    for (const [id, spec] of Object.entries(SPILL_SPECIALTIES).filter(([, spec]) => spec.axis === part)) {
      const selected = sp.specialties[part] === id, b = el("button", `ac-spilloption${selected ? " selected" : ""}`);
      b.dataset.spillControl = id; b.title = spec.detail; b.disabled = arming; b.setAttribute("aria-pressed", String(selected));
      uiState(b, selected ? "selected" : arming ? "arming" : "available");
      b.append(el("b", "", spec.name), el("span", "", spec.desc), el("strong", "", selected ? "✓ Fitted" : "Fit free"));
      b.onclick = () => { feedback(`${spec.name} fitted`); engine.spillSpecialize(id as SpillSpecialty); }; choices.append(b);
    }
    details.append(choices); bay.append(details);
  }
  // WEAPONS (owner, 3 Nov 2026: "consolidate, all weapons same format"):
  // one card each - name, three numbers, tier pips with the upgrade beside
  // them, and Equip underneath. Either weapon can be upgraded.
  const weapons = el("section", "ac-workshop-weapons"), weaponHead = el("div", "ac-workshop-sectionhead");
  weaponHead.append(el("h3", "", "Weapons"), el("span", "", "Switch free"));
  weapons.append(weaponHead);
  for (const id of Object.keys(SPILL_WEAPONS) as SpillWeaponId[]) {
    const spec = SPILL_WEAPONS[id], level = sp.combat.levels[id], selected = sp.combat.weapon === id;
    const stats = spillWeaponStats(sp, id), rate = 1 / stats.cooldown, wprice = spillWeaponPrice(sp, id);
    const card = el("section", `ac-workshop-weapon${selected ? " fitted" : ""}`); card.dataset.weapon = id;
    uiState(card, selected ? "selected" : "available");
    const statLine = el("p", "ac-weapon-stats");
    for (const [label, value] of [["Rate", `${rate.toFixed(1)}/s`], ["Accuracy", spillAccuracyLabel(stats.aim)], ["DPS", (rate * stats.damage).toFixed(1)]]) {
      const item = el("span"); item.append(el("small", "", label), el("b", "", value)); statLine.append(item);
    }
    const tierRow = el("div", "ac-weapon-tier"), pips = el("div", "ac-weapon-pips");
    pips.setAttribute("aria-label", `Tier ${level} of 3`);
    for (let n = 1; n <= 3; n++) pips.append(el("i", n <= level ? "on" : "", String(n)));
    const upgrade = el("button", "ac-workshop-buy ac-weapon-upgrade"); upgrade.dataset.spillControl = `weapon-upgrade-${id}`;
    upgrade.disabled = arming || wprice === null || wprice > sp.ore;
    uiState(upgrade, arming ? "arming" : wprice === null ? "complete" : wprice > sp.ore ? "unaffordable" : "available");
    upgrade.setAttribute("aria-label", `${spec.name}: ${wprice === null ? "max level" : `upgrade for ${wprice} Acorn Coins`}`);
    if (wprice === null) upgrade.append(el("span", "", "Max"));
    else upgrade.append(el("span", "", "Upgrade"), coin(), el("span", "", String(wprice)));
    upgrade.onclick = () => {
      feedback(`${spec.name} upgraded`);
      if (!engine.spillUpgradeWeapon(id)) { view.receipt = "Upgrade unavailable"; rerender(); }
    };
    tierRow.append(pips, upgrade);
    const fit = el("button", `ac-workshop-buy ac-weapon-equip${selected ? " fitted" : ""}`, selected ? "✓ Equipped" : "Equip");
    fit.dataset.spillControl = `weapon-${id}`;
    fit.setAttribute("aria-pressed", String(selected));
    fit.setAttribute("aria-label", `${spec.name}: ${selected ? "equipped" : "equip free"}`);
    fit.disabled = arming || selected;
    uiState(fit, selected ? "selected" : arming ? "arming" : "available");
    fit.onclick = () => {
      feedback(`${spec.name} equipped`);
      if (!engine.spillSelectWeapon(id)) { view.receipt = "Weapon unavailable"; rerender(); }
    };
    card.title = spec.description;
    const top = el("div", "ac-weapon-top"); top.append(el("h4", "", spec.name), statLine);
    card.append(top, tierRow, fit); weapons.append(card);
  }
  outfitting.append(weapons);
  if (sp.welcome || trial) {
    // folded: the earned sidegrades are a choice for players who want one, not a step
    const tuning = el("details", "ac-career-fold"), loadout = sp.loadout;
    tuning.open = view.builds;
    tuning.ontoggle = () => { if (tuning.isConnected) view.builds = tuning.open; };
    tuning.append(el("summary", "", `Ship tuning · ${SPILL_CHASSIS.find(c => c.id === loadout.chassis)?.name ?? "Scout"} · ${SPILL_WEAPON_MODULES.find(m => m.id === loadout.module)?.name ?? "Standard targeting"}`),
      drawSpillCareer(engine));
    outfitting.append(tuning);
  }
  // THE SHELF (owner, 3 Nov 2026): utilities and artifacts in one list. Only
  // the two new offers show; what is fitted is a one-line note above them.
  // A purchase made this visit can be undone (coins back, old item refitted).
  if (!sp.welcome) {
    const shelf = el("section", "ac-workshop-utilities"), shelfHead = el("div", "ac-workshop-sectionhead");
    const cap = spillSlotCap(sp), used = spillFittedCount(sp);
    shelfHead.append(el("h3", "", "Utilities"), el("span", "", cap < 2 ? "1 slot · 2nd after wave 10" : "2 slots"));
    shelf.append(shelfHead);
    const fittedNow = spillFittedItems(sp), note = el("p", "ac-shelf-fitted");
    note.append(el("b", "", "Fitted: "), el("span", "", fittedNow.length ? fittedNow.map(item => spillItemInfo(item).name).join(" · ") : "nothing yet"));
    shelf.append(note);
    const grid = el("div", "ac-workshop-utilitygrid");
    for (const item of spillShelf(sp)) {
      const info = spillItemInfo(item), key = itemKey(item), fitted = spillItemFitted(sp, item), undo = spillShelfUndoable(sp, item);
      const price = spillItemPrice(item), poor = !undo && sp.ore < price;
      const card = el("article", `ac-workshop-utility${fitted ? " fitted" : ""}${item.kind === "artifact" ? " ac-artifact-item" : ""}`), name = el("div", "ac-workshop-utilityname");
      card.dataset.shelf = key; uiState(card, fitted ? "selected" : poor ? "unaffordable" : "available");
      if (item.kind === "artifact") card.style.setProperty("--artifact-color", SPILL_ARTIFACTS[item.id].color);
      card.title = info.detail;
      if (item.kind === "utility") name.append(spillUtilityArt(item.id)); else name.append(el("span", "ac-artifact-gem", "◆"));
      name.append(el("h4", "", info.name)); card.append(name, el("p", "", info.line));
      // a new artifact always trades places with the fitted one; anything else at the cap asks which slot
      const artifactSwap = !undo && item.kind === "artifact" && !!sp.combat.build.artifact;
      const full = !undo && !artifactSwap && used >= cap;
      const buy = el("button", `ac-workshop-buy${undo ? " fitted" : ""}`); buy.dataset.spillControl = item.kind === "utility" ? item.id : `artifact-${item.id}`;
      buy.disabled = arming || poor;
      uiState(buy, undo ? "selected" : arming ? "arming" : poor ? "unaffordable" : "available");
      buy.setAttribute("aria-label", undo ? `Undo ${info.name}, refund ${price} Acorn Coins` : `${full ? "Swap in" : "Fit"} ${info.name} for ${price} Acorn Coins`);
      if (undo) buy.append(el("span", "", "✓ Fitted · Undo"));
      else buy.append(el("span", "", full || artifactSwap ? "Swap" : "Fit"), coin(), el("span", "", String(price)));
      buy.onclick = () => {
        if (undo) { feedback(`${info.name} undone · coins back`); engine.spillShelfUndo(item); return; }
        if (full) { view.swap = key; rerender(); document.querySelector<HTMLElement>(".ac-workshop-swap button")?.focus(); return; }
        feedback(`${info.name} fitted`); engine.spillShelf(item);
      };
      card.append(buy); grid.append(card);
    }
    if (!grid.childElementCount) grid.append(el("p", "ac-workshop-note", "Nothing new this visit"));
    shelf.append(grid);
    const swapItem = view.swap ? spillShelf(sp).find(item => itemKey(item) === view.swap) : undefined;
    if (swapItem) {
      const swap = el("div", "ac-workshop-swap"); swap.setAttribute("role", "group");
      const swapName = spillItemInfo(swapItem).name;
      swap.append(el("p", "", `Replace which with ${swapName}?`));
      for (const out of fittedNow) {
        const b = el("button", "ac-ghost ac-workshop-secondary", spillItemInfo(out).name); b.dataset.spillControl = `replace-${out.id}`; b.disabled = arming;
        b.onclick = () => { view.swap = null; feedback(`${swapName} fitted`); engine.spillShelf(swapItem, out); };
        swap.append(b);
      }
      const cancel = el("button", "ac-ghost ac-workshop-exit", "CANCEL"); cancel.dataset.spillControl = "cancel-swap";
      cancel.onclick = () => { view.swap = null; rerender(); }; swap.append(cancel); shelf.append(swap);
    }
    outfitting.append(shelf);
  }
  // Extra life and bonus goals left the Depot (owner, 3 Nov 2026): the one
  // optional risk is the Harder yes/no below.
  if (!sp.welcome && sp.wave >= 5 && (!trial || SPILL_TRIALS.find(item => item.id === trial.id)?.endWave)) {
    outfitting.append(difficultyToggle(engine, view, arming, rerender));
  }
  outfitting.append(hazardForecast(engine, view));
  if (sp.contractMessage) outfitting.append(el("p", "ac-workshop-contract", sp.contractMessage));
  const footer = el("footer", "ac-workshop-footer"), actions = el("div", "ac-workshop-actions");
  const receipt = el("p", "ac-workshop-receipt", view.receipt || (trial ? "Practice loadout · changes stay in this trial" : sp.welcome ? "One free upgrade before takeoff"
    : "Take your time · next depot in 5 waves"));
  receipt.setAttribute("aria-live", "polite"); footer.append(receipt);
  if (trial) {
    const exit = el("button", "ac-ghost ac-workshop-exit", "END TRIAL");
    exit.dataset.spillControl = "end-trial"; exit.onclick = () => engine.spillEndTrial(); actions.append(exit);
  } else if (!sp.target) {
    const save = el("button", "ac-ghost ac-workshop-exit", "SAVE & EXIT"); save.disabled = arming; save.dataset.spillControl = "save"; save.onclick = () => engine.spillSuspend(); actions.append(save);
  }
  const go = el("button", "ac-primary ac-workshop-launch", sp.welcome && sp.freeUpgrade ? "CHOOSE FREE UPGRADE" : `LAUNCH WAVE ${sp.welcome ? 1 : sp.wave + 1}`);
  go.disabled = arming || !!(sp.welcome && sp.freeUpgrade); go.dataset.spillControl = "launch"; go.onclick = () => engine.spillLeaveDepot();
  uiState(go, arming ? "arming" : sp.welcome && sp.freeUpgrade ? "locked" : "available");
  actions.append(go); footer.append(actions); sheet.append(footer); wrap.append(sheet); return wrap;
}
