import { describe, expect, it } from "vitest";
import {
  championUsage,
  computeKda,
  formatDuration,
  formatKda,
  formatPercent,
  formatRank,
  formatRelativeTime,
  performanceSeries,
  summarizeMatches,
} from "@/lib/match-stats";
import type { MatchSummary } from "@/types/dashboard";

function match(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: "M-1",
    championName: "Ahri",
    position: "MIDDLE",
    queue: "Classificata Solo/Duo",
    win: true,
    kills: 0,
    deaths: 0,
    assists: 0,
    creepScore: 0,
    durationSeconds: 1800,
    playedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("computeKda", () => {
  it("divides kills + assists by deaths", () => {
    expect(computeKda(6, 3, 9)).toBe(5);
  });

  it("treats zero deaths as one to avoid infinity", () => {
    expect(computeKda(4, 0, 6)).toBe(10);
  });
});

describe("summarizeMatches", () => {
  it("returns nulls without games instead of invented zeros", () => {
    const summary = summarizeMatches([]);
    expect(summary.games).toBe(0);
    expect(summary.winRate).toBeNull();
    expect(summary.kda).toBeNull();
    expect(summary.csPerMinute).toBeNull();
  });

  it("aggregates wins, KDA and CS per minute across matches", () => {
    const summary = summarizeMatches([
      match({ matchId: "A", win: true, kills: 10, deaths: 2, assists: 4, creepScore: 200, durationSeconds: 1200 }),
      match({ matchId: "B", win: false, kills: 2, deaths: 6, assists: 8, creepScore: 100, durationSeconds: 1800 }),
    ]);

    expect(summary.games).toBe(2);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(1);
    expect(summary.winRate).toBe(0.5);
    // (12 + 12) / 8 deaths
    expect(summary.kda).toBe(3);
    // 300 CS over 50 minutes
    expect(summary.csPerMinute).toBe(6);
    expect(summary.avgDurationSeconds).toBe(1500);
  });
});

describe("championUsage", () => {
  it("orders by games, then win rate, then name, with pick share", () => {
    const usage = championUsage([
      match({ matchId: "1", championName: "Viktor", win: false }),
      match({ matchId: "2", championName: "Ahri", win: true }),
      match({ matchId: "3", championName: "Ahri", win: false }),
      match({ matchId: "4", championName: "Orianna", win: true }),
    ]);

    expect(usage.map((item) => item.championName)).toEqual([
      "Ahri",
      "Orianna",
      "Viktor",
    ]);
    expect(usage[0]?.games).toBe(2);
    expect(usage[0]?.winRate).toBe(0.5);
    expect(usage[0]?.pickShare).toBe(0.5);
  });
});

describe("performanceSeries", () => {
  it("is chronological and tracks the cumulative win rate", () => {
    const series = performanceSeries([
      match({ matchId: "new", win: false, playedAt: "2026-11-03T10:00:00.000Z" }),
      match({ matchId: "old", win: true, playedAt: "2026-11-01T10:00:00.000Z" }),
      match({ matchId: "mid", win: true, playedAt: "2026-11-02T10:00:00.000Z" }),
    ]);

    expect(series.map((point) => point.matchId)).toEqual(["old", "mid", "new"]);
    expect(series.map((point) => point.index)).toEqual([1, 2, 3]);
    expect(series.map((point) => Math.round(point.winRatePercent))).toEqual([
      100, 100, 67,
    ]);
  });
});

describe("formatters", () => {
  it("formats missing values as a dash", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatKda(null)).toBe("—");
    expect(formatRank(null)).toBe("—");
  });

  it("formats rank tiers in Italian", () => {
    expect(
      formatRank({ queue: "Solo/Duo", tier: "GOLD", division: "II", leaguePoints: 10 }),
    ).toBe("Oro II");
    expect(
      formatRank({ queue: "Solo/Duo", tier: "MASTER", division: null, leaguePoints: 10 }),
    ).toBe("Maestro");
  });

  it("formats durations as m:ss", () => {
    expect(formatDuration(1745)).toBe("29:05");
  });

  it("formats relative times against a fixed now", () => {
    const now = new Date("2026-11-09T12:00:00.000Z");
    expect(formatRelativeTime("2026-11-09T10:00:00.000Z", now)).toBe(
      "2 ore fa",
    );
    expect(formatRelativeTime("not a date", now)).toBe("Data non disponibile");
  });
});
