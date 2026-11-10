import { describe, expect, it } from "vitest";
import { formatPercent, playedLanes, ratio, roleName } from "@/features/champions/lib/global-format";
import { championGlobalStatsSchema, globalStatsSettingsSchema, patchFilterSchema } from "@/types/global-stats";

const icon = { id: 8010, name: "Conquistatore", iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/x.png" };

describe("global stats contracts", () => {
  it("accepts a backend payload", () => {
    const parsed = championGlobalStatsSchema.safeParse({
      championId: 54,
      patch: "16.22",
      patches: [{ patch: "16.22", matches: 10 }],
      platforms: ["euw1"],
      seedTiers: ["MASTER_PLUS"],
      totalMatches: 10,
      games: 2,
      wins: 1,
      bans: 0,
      roles: [{ role: "TOP", games: 2, wins: 1 }],
      role: "TOP",
      roleGames: 2,
      roleWins: 1,
      runePages: [
        {
          primaryStyle: icon,
          primaryRunes: [icon],
          secondaryStyle: icon,
          secondaryRunes: [icon],
          shards: [{ id: 5008, name: "Forza adattiva", iconUrl: null }],
          games: 2,
          wins: 1,
        },
      ],
      keystones: [{ icon, games: 2, wins: 1 }],
      summonerSpells: [],
      boots: [],
      coreItems: [],
      strongAgainst: [],
      weakAgainst: [{ championId: 1, key: "Annie", name: "Annie", imageUrl: null, games: 5, wins: 1 }],
      matchupMinGames: 5,
      runeTrees: [{ tree: icon, rows: [[icon]] }],
      shardRows: [[icon]],
      lastFetchedAt: null,
      source: "Riot API (league-v4, match-v5)",
      personal: false,
      skillOrders: [{ priority: ["Q", "E", "W"], sequence: ["Q", "E", "W", "Q"], games: 3, wins: 2 }],
      startBuilds: [{ items: [icon, icon], games: 2, wins: 1 }],
      coreBuilds: [],
      timelineGames: 3,
    });
    expect(parsed.success).toBe(true);
  });

  it("validates filters and settings before invoking Rust", () => {
    expect(patchFilterSchema.safeParse("16.22").success).toBe(true);
    expect(patchFilterSchema.safeParse("ALL").success).toBe(true);
    expect(patchFilterSchema.safeParse("16.22; DROP").success).toBe(false);
    expect(globalStatsSettingsSchema.safeParse({ enabled: true, platform: "euw1", seedTier: "DIAMOND" }).success).toBe(
      true,
    );
    expect(globalStatsSettingsSchema.safeParse({ enabled: true, platform: "xx", seedTier: "DIAMOND" }).success).toBe(
      false,
    );
  });
});

describe("global stats formatting", () => {
  it("never turns a missing sample into 0%", () => {
    expect(ratio(3, 0)).toBeNull();
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(ratio(1, 2))).toMatch(/50,0\s?%/);
    expect(roleName("UTILITY")).toBe("Supporto");
    expect(roleName(null)).toBe("Ruolo non indicato");
  });
});

describe("played lanes", () => {
  it("keeps lanes with at least 15% of the games, most played first", () => {
    expect(
      playedLanes({
        championId: 54,
        games: 20,
        roles: [
          { role: "TOP", games: 14, wins: 7 },
          { role: "MIDDLE", games: 4, wins: 2 },
          { role: "UTILITY", games: 2, wins: 1 },
        ],
      }),
    ).toEqual(["TOP", "MIDDLE"]);
    expect(playedLanes(undefined)).toEqual([]);
  });
});
