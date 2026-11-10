import { describe, expect, it } from "vitest";
import { toDashboardData } from "@/features/dashboard/lib/real-dashboard";
import { dashboardDataSchema } from "@/types/dashboard";
import type { PlayerMatch, PlayerProfile } from "@/types/riot";

// Fictional profile shaped like the backend contract.
function match(id: string, extra: Partial<PlayerMatch> = {}): PlayerMatch {
  return {
    matchId: id,
    queueId: 450,
    gameMode: "ARAM",
    gameVersion: "1.1.1",
    playedAt: "2026-11-09T10:00:00.000Z",
    durationSeconds: 1200,
    endedEarly: false,
    win: true,
    championId: 9001,
    championName: "Alpha",
    championImageUrl: null,
    kills: 10,
    deaths: 5,
    assists: 20,
    creepScore: 40,
    goldEarned: 12000,
    visionScore: 5,
    champLevel: 18,
    teamPosition: "",
    damageToChampions: 30000,
    items: [],
    keystone: null,
    secondaryStyle: null,
    ...extra,
  };
}

function profile(matches: PlayerMatch[], ranked: PlayerProfile["ranked"] = []): PlayerProfile {
  return {
    puuid: "PUUID-TESTER",
    gameName: "Tester",
    tagLine: "TEST",
    region: "euw1",
    summonerLevel: 100,
    profileIconUrl: null,
    saved: true,
    primary: true,
    sync: {
      profileSyncedAt: "2026-11-09T11:00:00.000Z",
      rankedSyncedAt: "2026-11-09T11:00:00.000Z",
      matchesSyncedAt: "2026-11-09T11:00:00.000Z",
      lastError: null,
    },
    ranked,
    matches,
    source: "Riot API",
  };
}

describe("real dashboard data", () => {
  it("is marked as Riot data and satisfies the dashboard contract", () => {
    const data = toDashboardData(
      profile(
        [match("A"), match("B", { endedEarly: true })],
        [
          {
            queueType: "RANKED_SOLO_5x5",
            tier: "GOLD",
            division: "II",
            leaguePoints: 47,
            wins: 3,
            losses: 2,
            hotStreak: false,
            fetchedAt: "2026-11-09T11:00:00.000Z",
          },
        ],
      ),
    );
    expect(dashboardDataSchema.safeParse(data).success).toBe(true);
    expect(data?.source).toBe("riot");
    expect(data?.sourceLabel).toBe("Riot API · Tester#TEST");
    expect(data?.matches.map((m) => m.matchId)).toEqual(["A"]);
    expect(data?.matches[0]?.position).toBeNull();
    expect(data?.matches[0]?.queue).toBe("ARAM");
    expect(data?.rank).toEqual({
      queue: "Classificata Solo/Duo",
      tier: "GOLD",
      division: "II",
      leaguePoints: 47,
    });
  });

  it("returns null without countable matches instead of zeros", () => {
    expect(toDashboardData(profile([]))).toBeNull();
    const fromClient = toDashboardData({
      ...profile([match("C", { endedEarly: false })]),
      source: "Client League (LCU)",
    });
    expect(fromClient?.sourceName).toBe("Client League (LCU)");
    expect(fromClient?.sourceLabel).toBe("Client League (LCU) · Tester#TEST");
    expect(toDashboardData(profile([match("R", { endedEarly: true })]))).toBeNull();
  });
});
