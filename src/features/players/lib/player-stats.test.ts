import { describe, expect, it } from "vitest";
import {
  playerStats,
  rankedWinRate,
  toStatsMatches,
} from "@/features/players/lib/player-stats";
import { queueGroup, queueLabel } from "@/lib/queues";
import { riotApiKeySchema, riotIdSchema, type PlayerMatch } from "@/types/riot";

// Fictional matches shaped like the backend contract.
function match(id: string, extra: Partial<PlayerMatch>): PlayerMatch {
  return {
    matchId: id,
    queueId: 420,
    gameMode: "CLASSIC",
    gameVersion: "1.1.1",
    playedAt: "2026-11-09T10:00:00.000Z",
    durationSeconds: 1800,
    endedEarly: false,
    win: true,
    championId: 9001,
    championName: "Alpha",
    championImageUrl: null,
    kills: 5,
    deaths: 2,
    assists: 7,
    creepScore: 180,
    goldEarned: 10000,
    visionScore: 20,
    champLevel: 15,
    teamPosition: "JUNGLE",
    damageToChampions: 15000,
    items: [],
    keystone: null,
    secondaryStyle: null,
    ...extra,
  };
}

describe("player stats", () => {
  it("excludes remakes from aggregates but counts them", () => {
    const stats = playerStats([
      match("A", { win: true }),
      match("B", { win: false, kills: 1, deaths: 6, assists: 2 }),
      match("C", { endedEarly: true, win: false, durationSeconds: 200 }),
    ]);
    expect(stats.remakes).toBe(1);
    expect(stats.summary.games).toBe(2);
    expect(stats.summary.winRate).toBe(0.5);
    expect(stats.summary.csPerMinute).toBe(6);
  });

  it("never invents a champion name", () => {
    expect(toStatsMatches([match("A", { championName: null, championId: 77 })])[0]?.championName).toBe(
      "Campione 77",
    );
  });

  it("computes ranked win rate only with games", () => {
    const entry = {
      queueType: "RANKED_SOLO_5x5",
      tier: "GOLD",
      division: "II",
      leaguePoints: 10,
      wins: 30,
      losses: 20,
      hotStreak: false,
      fetchedAt: "2026-11-09T10:00:00.000Z",
    };
    expect(rankedWinRate(entry)).toBe(0.6);
    expect(rankedWinRate({ ...entry, wins: 0, losses: 0 })).toBeNull();
  });
});

describe("queues", () => {
  it("labels known queues and falls back to the game mode", () => {
    expect(queueLabel(420, "CLASSIC")).toBe("Classificata Solo/Duo");
    expect(queueLabel(9999, "ARAM")).toBe("ARAM");
    expect(queueLabel(9999, null)).toBe("Coda 9999");
    expect(queueGroup(440)).toBe("flex");
    expect(queueGroup(1700)).toBe("other");
  });
});

describe("input validation", () => {
  it("parses Riot IDs like the backend", () => {
    expect(riotIdSchema.parse(" Tester #EUW ")).toEqual({ gameName: "Tester", tagLine: "EUW" });
    expect(riotIdSchema.parse("Nome con spazi#1234")).toEqual({
      gameName: "Nome con spazi",
      tagLine: "1234",
    });
    expect(riotIdSchema.safeParse("SenzaTag").success).toBe(false);
    expect(riotIdSchema.safeParse("ab#EUW").success).toBe(false);
    expect(riotIdSchema.safeParse("Tester#E").success).toBe(false);
  });

  it("accepts only well-formed API keys", () => {
    expect(riotApiKeySchema.safeParse("RGAPI-00000000-0000-0000-0000-000000000000").success).toBe(true);
    expect(riotApiKeySchema.safeParse("RGAPI-123").success).toBe(false);
  });
});
