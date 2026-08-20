const chapters = [
  { id: 1, title: "Launch Window", subtitle: "Learn the routes", color: "#59c8ff" },
  { id: 2, title: "Shifting Skies", subtitle: "Master the Deep", color: "#62e6b3" },
  { id: 3, title: "Lost Bearings", subtitle: "Fly without a compass", color: "#f2b653" },
  { id: 4, title: "Arcade Echo", subtitle: "Break the timeline", color: "#ff82c7" },
  { id: 5, title: "Event Horizon", subtitle: "The Acornaut trial", color: "#a99be8" }
];

const missions = [
  [1,1,"First Flight","Normal","Reach Gate 10","Collect 3 acorns","Finish without a hit","The first relay is dark. Trace its signal through open sky.","35 XP"],
  [2,1,"Through the Fold","Wormhole","Score 75 in the tunnel","Collect 2 multiplier acorns","Avoid every ripple","A temporary fold offers a faster route to the stranded beacon.","40 XP"],
  [3,1,"Supply Run","Normal","Reach Gate 12","Collect 5 acorns","Keep your shield","The relay needs a fresh acorn charge before it can wake.","45 XP"],
  [4,1,"Riding the Ribbon","Wormhole","Score 110 in the tunnel","Collect 3 multiplier acorns","Avoid every obstacle","The fold twists harder, but its current still leads forward.","50 XP"],
  [5,1,"Debris Drill","Normal","Reach Gate 15","Collect 6 acorns","Finish without a hit","Broken satellite parts crowd the final approach.","55 XP"],
  [6,1,"Beacon Ignition","Normal","Reach Gate 20","Collect 8 acorns","Finish with a shield","Light the first beacon and stabilize the near-space routes.","Tunnel Endless + Bee"],
  [7,2,"First Shift","Deep","Survive the first shift","Collect 4 acorns","Finish without a hit","The second relay drifts between two unstable flight states.","60 XP"],
  [8,2,"Cold Cache","Normal","Reach Gate 18","Collect a Freeze power-up","Finish without using shield","A frozen signal cache holds the coordinates you need.","65 XP"],
  [9,2,"Tight Squeeze","Wormhole","Score 150 in the tunnel","Collect 4 multiplier acorns","Avoid every obstacle","The shortcut narrows as the beacon comes into range.","70 XP"],
  [10,2,"Gravity Lesson","Normal","Reach Gate 22","Collect 7 acorns","Finish without a shield","A clean flight is the only way through the gravity wake.","75 XP"],
  [11,2,"Double Shift","Deep","Survive two shifts","Collect 8 acorns","Finish without a hit","Two overlapping currents guard the relay core.","80 XP"],
  [12,2,"Relay Two","Deep","Reach Gate 20","Collect 10 acorns","Finish with a shield","Hold both skies steady long enough to restart the relay.","Deep Endless + Buddy"],
  [13,3,"Wrong Way Home","Lost","Reach Gate 10","Collect 4 acorns","Finish without a hit","The signal flips your instruments and sends the stars backward.","85 XP"],
  [14,3,"Mirror Run","Lost","Survive the first reversal","Collect 5 acorns","Keep your shield","Trust the route, not the direction of travel.","90 XP"],
  [15,3,"Slitherline","Wormhole","Score 200 in the tunnel","Collect 5 multiplier acorns","Avoid every obstacle","The fold moves like a living ribbon around the lost beacon.","95 XP"],
  [16,3,"Blackout","Normal","Reach Gate 28","Collect 9 acorns","Finish without a hit","The beacon's shadow swallows every familiar landmark.","100 XP"],
  [17,3,"No Compass","Lost","Reach Gate 18","Collect 8 acorns","Finish with a shield","Follow the acorn trail through a full reversal cycle.","105 XP"],
  [18,3,"Restore Signal","Lost","Reach Gate 25","Collect 10 acorns","Finish without a hit","Lock onto the beacon through its final directional storm.","Lost Endless + Void Jelly"],
  [19,4,"Pixel Breach","Arcade","Reach Gate 12","Collect 5 acorns","Finish without a hit","A fractured timeline turns the route into a living arcade.","110 XP"],
  [20,4,"Bonus Current","Arcade","Collect 3 power-ups","Reach Gate 16","Finish with a shield","Power surges reveal a hidden current through the breach.","115 XP"],
  [21,4,"Debris Current","Wormhole","Score 275 in the tunnel","Collect 6 multiplier acorns","Avoid every obstacle","Arcade debris spills into the fastest path forward.","120 XP"],
  [22,4,"Reversal","Arcade","Survive a wormhole reversal","Reach Gate 20","Finish without a hit","The route rewrites itself halfway through the run.","125 XP"],
  [23,4,"Crossfade","Normal","Reach Gate 35","Collect 12 acorns","Finish without a shield","The real sky and its echo overlap around the beacon.","130 XP"],
  [24,4,"Twin Timeline","Arcade","Reach Gate 35","Collect 14 acorns","Finish without a hit","Stabilize both timelines and reconnect the fourth relay.","Arcade Endless + Nova Trail"],
  [25,5,"Long Haul","Normal","Reach Gate 40","Collect 15 acorns","Finish without a hit","The last beacon waits beyond every route you have mastered.","140 XP"],
  [26,5,"Narrowest Passage","Wormhole","Score 350 in the tunnel","Collect 7 multiplier acorns","Avoid every obstacle","The smallest fold is the only passage through the horizon.","145 XP"],
  [27,5,"Chain Reaction","Deep","Reach Gate 35","Collect 14 acorns","Survive three shifts","Each restored beacon now changes the sky around you.","150 XP"],
  [28,5,"Upside Down","Lost","Reach Gate 30","Collect 12 acorns","Finish without a hit","The final signal reverses every rule one last time.","155 XP"],
  [29,5,"One More Run","Arcade","Reach Gate 45","Collect 16 acorns","Finish with a shield","Every timeline converges on one impossible route.","160 XP"],
  [30,5,"The Last Beacon","Acornaut Trial","Complete all three legs","Collect 18 acorns","Finish without a hit","Normal sky, wormhole, and Lost space form one final flight.","Acornaut Crest + Story Complete"]
].map(([id,chapter,title,mode,primary,bonus,mastery,story,reward]) => ({id,chapter,title,mode,primary,bonus,mastery,story,reward}));

const state = {
  view: "journey",
  chapter: 1,
  completed: new Set([1]),
  stars: {1: 2},
  selected: 2,
  runProgress: 0
};

const screen = document.querySelector("#screen");
const sheet = document.querySelector("#sheet");
const runScreen = document.querySelector("#run-screen");

function starString(count, empty = "·") {
  return "★".repeat(count) + empty.repeat(3 - count);
}

function render() {
  document.querySelectorAll(".dock-button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  if (state.view === "journey") renderJourney();
  if (state.view === "endless") renderEndless();
  if (state.view === "rank") renderRank();
  screen.scrollTop = 0;
}

function renderJourney() {
  const chapter = chapters[state.chapter - 1];
  const visible = missions.filter(mission => mission.chapter === state.chapter);
  const totalStars = Object.values(state.stars).reduce((total, value) => total + value, 0);
  screen.innerHTML = `
    <section class="journey-hero">
      <p class="kicker">THE STARWAY · STORY JOURNEY</p>
      <h2>Reconnect the broken sky.</h2>
      <p>Short missions. Clear finish lines. Optional mastery.</p>
      <div class="campaign-count"><b>${totalStars}/90</b><span>MISSION STARS</span></div>
    </section>
    <div class="chapter-strip" aria-label="Campaign chapters">
      ${chapters.map(item => `<button class="chapter-button ${item.id === state.chapter ? "active" : ""}" data-chapter="${item.id}">${String(item.id).padStart(2,"0")} · ${item.title}</button>`).join("")}
    </div>
    <div class="chapter-meta"><div><p class="kicker">CHAPTER ${chapter.id} OF 5</p><h3>${chapter.title}</h3></div><span>${chapter.subtitle}</span></div>
    <div class="mission-map">
      ${visible.map(mission => {
        const complete = state.completed.has(mission.id);
        const current = mission.id === nextMission();
        const locked = mission.id > nextMission();
        const className = complete ? "complete" : current ? "current" : "locked";
        const glyph = complete ? "✓" : locked ? "◇" : mission.id;
        return `<div class="mission-row"><button class="mission-node ${className}" data-mission="${mission.id}" aria-label="Mission ${mission.id}: ${mission.title}">
          <span class="node-orb">${glyph}</span><small>${mission.mode}</small><strong>${mission.title}</strong>
          <span class="node-stars ${locked ? "lock-glyph" : ""}">${locked ? "PREVIEW" : starString(state.stars[mission.id] || 0)}</span>
        </button></div>`;
      }).join("")}
    </div>`;

  screen.querySelectorAll("[data-chapter]").forEach(button => button.addEventListener("click", () => {
    state.chapter = Number(button.dataset.chapter);
    closeSheet();
    renderJourney();
  }));
  screen.querySelectorAll("[data-mission]").forEach(button => button.addEventListener("click", () => openMission(Number(button.dataset.mission))));
}

function renderEndless() {
  const modes = [
    ["Normal","Classic flight. Chase gates, acorns, and a personal best.","OPEN NOW","open","N"],
    ["Wormhole Run","Experimental tunnel survival concept; listed here only to show where it would live.","COMPLETE MISSION 6","exp","W"],
    ["Deep","Two flight states shift underneath every run.","COMPLETE CHAPTER 2","","D"],
    ["Lost","Direction reversals test reaction and route memory.","COMPLETE CHAPTER 3","","L"],
    ["Arcade","A remix of mechanics, bonuses, and timeline breaks.","COMPLETE CHAPTER 4","","A"]
  ];
  screen.innerHTML = `
    <div class="view-head"><p class="kicker">MASTERY · HIGH SCORES</p><h2>Endless Flights</h2><p>Story teaches each route. Endless lets players prove how far they can take it.</p></div>
    <div class="principle-card"><b>No energy meter.</b> Retry immediately. The campaign adds purpose; Endless preserves the original pick-up-and-play loop.</div>
    <div class="mode-list">${modes.map(([name,copy,unlock,type,glyph]) => `<article class="mode-card ${type === "open" ? "open" : ""} ${type === "exp" ? "experimental" : ""}" data-glyph="${glyph}">
      <header><h3>${name}</h3><span class="badge ${type}">${type === "open" ? "READY" : type === "exp" ? "EXPERIMENTAL" : "LOCKED"}</span></header>
      <p>${copy}</p><div class="unlock-line">${type === "open" ? "BEST · <span>42 GATES</span>" : "UNLOCK · <span>" + unlock + "</span>"}</div>
    </article>`).join("")}</div>`;
}

function renderRank() {
  const rewards = [
    [5,"Pilot","Deep-space title","done"],
    [8,"Voidfarer","Current rank","current"],
    [9,"Comet Sprite","New pal",""],
    [10,"Navigator","Profile title",""],
    [12,"Gemmie","Suit reveal",""]
  ];
  screen.innerHTML = `
    <div class="view-head"><p class="kicker">LIFETIME XP · STATUS</p><h2>Pilot Rank</h2><p>Every flight counts here, but rank never blocks the next story mission.</p></div>
    <section class="rank-summary"><div class="rank-summary-row"><div><span>CURRENT TITLE</span><h3>Voidfarer</h3></div><b>1,240 XP</b></div><div class="xp-track"><i></i></div><span>310 XP TO RANK 9 · Earned from Story and Endless</span></section>
    <div class="rank-road">${rewards.map(([level,title,copy,status]) => `<article class="rank-item ${status}"><span class="rank-orb">${level}</span><div><strong>${title}</strong><small>${copy}</small></div><span class="rank-type">${status === "done" ? "OWNED" : status === "current" ? "YOU" : "REWARD"}</span></article>`).join("")}</div>
    <div class="principle-card"><b>Clear vocabulary:</b> “Mission” is campaign progress. “Rank” is lifetime XP. Acorns remain spendable currency.</div>`;
}

function nextMission() {
  for (const mission of missions) if (!state.completed.has(mission.id)) return mission.id;
  return 30;
}

function openMission(id) {
  state.selected = id;
  const mission = missions.find(item => item.id === id);
  const isPreview = id > nextMission();
  sheet.innerHTML = `
    <div class="sheet-handle"></div><button class="sheet-close" aria-label="Close">×</button>
    <span class="mission-label">MISSION ${String(id).padStart(2,"0")} · ${mission.mode.toUpperCase()}</span>
    <h2>${mission.title}</h2><p class="story-copy">${mission.story}</p>
    <div class="objective primary"><span class="objective-icon">✦</span><div><b>COMPLETE · ${mission.primary}</b><span>Unlocks the next mission. The finish portal opens immediately.</span></div></div>
    <div class="objective optional"><span class="objective-icon">★</span><div><b>BONUS · ${mission.bonus}</b><span>Optional second star.</span></div></div>
    <div class="objective optional"><span class="objective-icon">★</span><div><b>MASTERY · ${mission.mastery}</b><span>Optional third star. Never required to progress.</span></div></div>
    <div class="reward-row"><span class="acorn">●</span> FIRST CLEAR REWARD · <b>${mission.reward}</b></div>
    <button class="primary-button play-mission">${isPreview ? "PREVIEW MISSION FLOW" : state.completed.has(id) ? "REPLAY MISSION" : "PLAY MISSION"}</button>
    <button class="secondary-button close-sheet">BACK TO MAP</button>`;
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden","false");
  sheet.querySelector(".sheet-close").addEventListener("click", closeSheet);
  sheet.querySelector(".close-sheet").addEventListener("click", closeSheet);
  sheet.querySelector(".play-mission").addEventListener("click", () => startRun(mission));
}

function closeSheet() {
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden","true");
}

function startRun(mission) {
  closeSheet();
  state.runProgress = 0;
  const streaks = Array.from({length: 12}, (_,index) => `<i class="star-streak" style="top:${13 + (index*7)%70}%;left:${(index*37)%90}px;animation-delay:-${index*.13}s"></i>`).join("");
  runScreen.innerHTML = `<div class="run-world">${streaks}<div class="runner"></div><div class="finish-portal"></div></div>
    <div class="run-hud"><div class="run-hud-top"><span>MISSION ${String(mission.id).padStart(2,"0")}</span><span>OBJECTIVE</span></div><div class="run-progress"><i style="width:0%"></i></div><div class="run-objective">${mission.primary} · <b>0%</b></div></div>
    <div class="run-controls"><button class="primary-button advance-run">SIMULATE PROGRESS</button><button class="secondary-button run-exit">EXIT MISSION</button></div>`;
  runScreen.classList.add("open");
  runScreen.setAttribute("aria-hidden","false");
  runScreen.querySelector(".advance-run").addEventListener("click", () => advanceRun(mission));
  runScreen.querySelector(".run-exit").addEventListener("click", closeRun);
}

function advanceRun(mission) {
  state.runProgress = Math.min(100, state.runProgress + 25);
  runScreen.querySelector(".run-progress i").style.width = `${state.runProgress}%`;
  runScreen.querySelector(".run-objective b").textContent = `${state.runProgress}%`;
  if (state.runProgress >= 75) runScreen.querySelector(".finish-portal").classList.add("show");
  if (state.runProgress === 100) showResults(mission);
}

function showResults(mission) {
  state.completed.add(mission.id);
  state.stars[mission.id] = Math.max(state.stars[mission.id] || 0, 2);
  runScreen.insertAdjacentHTML("beforeend", `<div class="results"><article class="result-card"><p class="kicker">MISSION COMPLETE</p><h2>${mission.title}</h2><div class="result-stars">★★☆</div><p class="reward-pop">Primary + bonus complete<br>Reward earned · <b>${mission.reward}</b></p><button class="primary-button next-mission">CONTINUE TO MISSION ${Math.min(30,mission.id + 1)}</button><button class="secondary-button map-return">BACK TO STAR MAP</button></article></div>`);
  runScreen.querySelector(".next-mission").addEventListener("click", () => {
    closeRun();
    const next = missions.find(item => item.id === Math.min(30, mission.id + 1));
    state.chapter = next.chapter;
    state.view = "journey";
    render();
    openMission(next.id);
  });
  runScreen.querySelector(".map-return").addEventListener("click", () => {
    state.chapter = mission.chapter;
    state.view = "journey";
    closeRun(); render();
  });
}

function closeRun() {
  runScreen.classList.remove("open");
  runScreen.setAttribute("aria-hidden","true");
  runScreen.innerHTML = "";
}

document.querySelectorAll(".dock-button").forEach(button => button.addEventListener("click", () => {
  closeSheet();
  state.view = button.dataset.view;
  render();
}));

render();
setTimeout(() => openMission(2), 450);
