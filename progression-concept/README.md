# Acornaut Starway progression concept

This folder is a standalone product-design prototype. It does not import, modify, or execute the game engine. It is intentionally separate from both the current game and the experimental Wormhole Run branch.

Open `index.html` to explore the mobile flow. The prototype demonstrates:

- a five-chapter, 30-mission story journey;
- a mission briefing with one required objective and two optional mastery stars;
- an in-run objective HUD, finish portal, and result/reward flow;
- Endless modes as chapter-earned mastery content;
- the existing XP road reframed as Pilot Rank for titles, pals, and cosmetics.

## Product model

| Lane | Player question | Progress | Rewards |
| --- | --- | --- | --- |
| Star Map | What should I do next? | Complete finite missions | Chapters, modes, first-clear rewards |
| Endless | How far can I go? | Personal bests and mastery | XP, acorns, records |
| Pilot Rank | How much have I accomplished overall? | Lifetime XP from every run | Titles, pals, cosmetics, status |

Use “mission” for story progress and “rank” for lifetime XP. Acorns remain spendable currency. This prevents three unrelated meanings from competing for the word “level.”

## Campaign shape

| Chapter | Missions | Teaching focus | Chapter payoff |
| --- | ---: | --- | --- |
| Launch Window | 1–6 | Normal controls, gates, collection, Wormhole trial | Wormhole Endless if the experiment is integrated |
| Shifting Skies | 7–12 | Deep shifts, power-ups, tighter routes | Deep Endless |
| Lost Bearings | 13–18 | Direction reversals and route reading | Lost Endless |
| Arcade Echo | 19–24 | Mixed mechanics and higher tempo | Arcade Endless |
| Event Horizon | 25–30 | Mastery and a final trial | Story completion crest |

The Wormhole references are content-design placeholders only. They do not depend on the experimental implementation.

## Mission rules

1. Completing the primary objective earns one star and unlocks the next mission.
2. Two optional objectives reward collection and mastery. They never block campaign progress.
3. When the primary objective is met, gameplay enters a safe extraction sequence immediately. A player cannot satisfy the requirement and then die before the result is recorded.
4. Target run length is 20–90 seconds. Players can retry instantly; there is no life or energy gate.
5. Story missions use a fixed seed plus a bounded tuning envelope. Endless modes continue using their open-ended generators.
6. Increase at most two difficulty axes between adjacent missions: run length, speed, gap, drift, hazard budget, or modifier complexity.
7. Each sixth mission is a chapter checkpoint with a meaningful unlock.

## Content and difficulty

The second mission intentionally asks for 75 tunnel points rather than 200. A first exposure should teach the control and reach a finish quickly; 200 points belongs in Chapter 3 after the player has learned the mode. Exact values are hypotheses and should be telemetry-tuned.

Recommended launch tuning targets:

- first-try completion: 65–80% for teaching missions;
- checkpoint completion: 35–50% on first try, 70% by the third try;
- optional third star: 10–25% on first clear;
- median mission duration: 35–60 seconds;
- failed-run restart: one tap and under two seconds.

## Implementation outline

Keep mission content data-driven and leave the current Endless generators intact.

```ts
type MissionDefinition = {
  id: number;
  chapter: number;
  mode: "normal" | "deep" | "lost" | "arcade" | "tunnel";
  primary: Objective;
  stars: [Objective, Objective];
  seed: string;
  tuning: {
    speed?: number;
    gap?: number;
    drift?: number;
    hazardBudget?: number;
    powerupRules?: string[];
  };
  rewards: Reward[];
  unlocks?: string[];
};
```

Each mode adapter should emit generic events such as `gatePassed`, `distanceScore`, `acornCollected`, `powerupCollected`, `hazardAvoided`, `warpSurvived`, and `hitTaken`. A mission controller evaluates these events, updates the HUD, and triggers extraction.

Suggested save additions:

```ts
type CampaignSave = {
  campaignVersion: number;
  highestMission: number;
  missionResults: Record<number, {
    bestStars: 0 | 1 | 2 | 3;
    attempts: number;
    bestProgress: number;
  }>;
  chapterRewardsClaimed: number[];
};
```

Do not gate the core story behind the existing XP rank. Preserve current XP, acorn balances, cosmetics, and records through additive save migration. If the Wormhole mode is later integrated, give it a distinct save namespace until its data model is reviewed.

## Delivery phases

1. **Foundation:** Mission definitions, event adapter, objective HUD, result screen, save migration; ship Chapter 1.
2. **Campaign:** Add Chapters 2–4 and move current mode unlocks from XP to chapter completion.
3. **Mastery:** Add Chapter 5, chapter star rewards, daily remix missions, and a multi-leg final trial.

The final multi-leg mission is deliberately phase three. A single-mode checkpoint can stand in for it if transitioning between engines is too costly for the first campaign release.

## Why this model

Mission-driven endless games work when short objectives create a reliable “one more run” decision without removing score chasing. Halfbrick described Jetpack Joyride as launching with levelling through in-game missions, and later highlighted missions, medals, challenges, and collectibles as reasons players kept returning. The Acornaut model applies that loop while keeping its current run modes and collection economy recognizable.

Sources:

- [Halfbrick: Jetpack Joyride release announcement](https://www.halfbrick.com/blog/jetpack-joyride-sep-1st)
- [Halfbrick: 2011 retrospective](https://www.halfbrick.com/blog/jetpack-joyride-ends-2011-with-a-bang)
- [Halfbrick community spotlight on replay motivation](https://www.halfbrick.com/blog/community-spotlight-john-haasl)
