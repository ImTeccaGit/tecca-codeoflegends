import type { AnalysisMatch, ChampionRef } from "@/types/analysis";

/** Test-only builder of fictional matches (never used by the app). */

export function champ(id: number, name: string): ChampionRef {
  return { championId: id, championName: name, imageUrl: null };
}

let counter = 0;

export function makeMatch(overrides: Partial<AnalysisMatch> = {}): AnalysisMatch {
  counter += 1;
  return {
    matchId: `TEST_${counter}`,
    queueId: 420,
    gameMode: "CLASSIC",
    gameVersion: "14.23.1.1",
    patch: "14.23",
    playedAt: "2026-11-01T12:00:00.000Z",
    durationSeconds: 1800,
    endedEarly: false,
    win: true,
    champion: champ(1, "Alpha"),
    teamPosition: "MIDDLE",
    champLevel: 15,
    kills: 5,
    deaths: 2,
    assists: 5,
    creepScore: 210,
    goldEarned: 12000,
    visionScore: 20,
    damageDealt: 20000,
    damageTaken: 18000,
    teamKills: 20,
    items: [],
    keystone: null,
    secondaryStyle: null,
    opponent: null,
    allies: [],
    enemies: [],
    bans: [],
    ...overrides,
  };
}
