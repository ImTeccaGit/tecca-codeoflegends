import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applyFilters,
  byChampion,
  byRole,
  csPerMinute,
  filterOptions,
  goldPerMinute,
  kda,
  killParticipation,
  provenance,
  summarize,
  timeSeries,
  weeklyResults,
  wilsonInterval,
} from "@/features/analysis/lib/analysis";
import { champ, makeMatch } from "@/features/analysis/lib/fixtures.test-utils";

const NOW = new Date("2026-11-09T12:00:00.000Z");

describe("per-match metrics", () => {
  it("computes KDA with deaths floored at 1", () => {
    expect(kda(5, 2, 5)).toBe(5);
    expect(kda(3, 0, 4)).toBe(7);
    expect(kda(0, 0, 0)).toBe(0);
  });

  it("computes CS/min and gold/min from the duration", () => {
    expect(csPerMinute(makeMatch({ creepScore: 210, durationSeconds: 1800 }))).toBe(7);
    expect(goldPerMinute(makeMatch({ goldEarned: 12000, durationSeconds: 1500 }))).toBe(480);
    expect(csPerMinute(makeMatch({ durationSeconds: 0 }))).toBeNull();
  });

  it("computes kill participation and handles teams without kills", () => {
    expect(killParticipation(makeMatch({ kills: 5, assists: 5, teamKills: 20 }))).toBe(0.5);
    expect(killParticipation(makeMatch({ teamKills: 0 }))).toBeNull();
    // Inconsistent data never exceeds 100%.
    expect(killParticipation(makeMatch({ kills: 10, assists: 20, teamKills: 20 }))).toBe(1);
  });
});

describe("summary", () => {
  it("computes win rate, aggregate KDA and per-minute stats", () => {
    const matches = [
      makeMatch({ win: true, kills: 10, deaths: 2, assists: 4, creepScore: 180, durationSeconds: 1200 }),
      makeMatch({ win: false, kills: 2, deaths: 6, assists: 6, creepScore: 240, durationSeconds: 2400 }),
      makeMatch({ win: true, kills: 3, deaths: 0, assists: 2, creepScore: 300, durationSeconds: 1800 }),
      makeMatch({ win: false, kills: 1, deaths: 4, assists: 0, creepScore: 0, durationSeconds: 1800 }),
    ];
    const summary = summarize(matches);
    expect(summary.games).toBe(4);
    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(2);
    expect(summary.winRate).toBe(0.5);
    // (16 + 12) / 12
    expect(summary.kda).toBeCloseTo(28 / 12, 10);
    // 720 CS over 120 minutes.
    expect(summary.csPerMinute).toBe(6);
    expect(summary.avgKills).toBe(4);
    expect(summary.sufficient).toBe(false);
  });

  it("reports empty data as null, never as zero percent", () => {
    const summary = summarize([]);
    expect(summary.winRate).toBeNull();
    expect(summary.kda).toBeNull();
    expect(summary.csPerMinute).toBeNull();
    expect(summary.interval).toBeNull();
    expect(summary.damageDealt).toEqual({ value: null, count: 0 });
  });

  it("averages optional stats only where Riot returned them", () => {
    const summary = summarize([
      makeMatch({ damageTaken: 10000 }),
      makeMatch({ damageTaken: null }),
      makeMatch({ damageTaken: 20000 }),
    ]);
    expect(summary.damageTaken).toEqual({ value: 15000, count: 2 });
  });

  it("computes kill participation only over matches with team kills", () => {
    const summary = summarize([
      makeMatch({ kills: 4, assists: 6, teamKills: 20 }),
      makeMatch({ kills: 0, assists: 0, teamKills: 0 }),
    ]);
    expect(summary.killParticipation).toEqual({ value: 0.5, count: 1 });
  });
});

describe("wilson interval", () => {
  it("brackets the observed rate and narrows with more games", () => {
    const small = wilsonInterval(3, 5);
    const large = wilsonInterval(300, 500);
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    if (!small || !large) return;
    expect(small.low).toBeLessThan(0.6);
    expect(small.high).toBeGreaterThan(0.6);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
    expect(wilsonInterval(0, 0)).toBeNull();
    const perfect = wilsonInterval(5, 5);
    expect(perfect?.high).toBeLessThanOrEqual(1);
  });
});

describe("filters", () => {
  const matches = [
    makeMatch({ matchId: "A", playedAt: "2026-11-08T10:00:00.000Z", champion: champ(1, "Alpha"), teamPosition: "MIDDLE", patch: "14.23", queueId: 420 }),
    makeMatch({ matchId: "B", playedAt: "2026-11-01T10:00:00.000Z", champion: champ(2, "Beta"), teamPosition: "TOP", patch: "14.22", queueId: 440 }),
    makeMatch({ matchId: "C", playedAt: "2026-09-01T10:00:00.000Z", champion: champ(1, "Alpha"), teamPosition: "MIDDLE", patch: "14.18", queueId: 450 }),
    makeMatch({ matchId: "D", playedAt: "2026-11-09T09:00:00.000Z", champion: champ(1, "Alpha"), teamPosition: null, patch: null, queueId: 420 }),
  ];
  const ids = (filters: Partial<typeof DEFAULT_FILTERS>) =>
    applyFilters(matches, { ...DEFAULT_FILTERS, ...filters }, NOW).map((match) => match.matchId);

  it("returns everything newest first by default", () => {
    expect(ids({})).toEqual(["D", "A", "B", "C"]);
  });

  it("filters by champion, role, patch, queue and period", () => {
    expect(ids({ championId: 1 })).toEqual(["D", "A", "C"]);
    expect(ids({ role: "MIDDLE" })).toEqual(["A", "C"]);
    expect(ids({ patch: "14.22" })).toEqual(["B"]);
    expect(ids({ queue: "aram" })).toEqual(["C"]);
    expect(ids({ queue: "solo" })).toEqual(["D", "A"]);
    expect(ids({ period: "7d" })).toEqual(["D", "A"]);
    expect(ids({ period: "30d" })).toEqual(["D", "A", "B"]);
  });

  it("limits to the newest N after the other filters", () => {
    expect(ids({ limit: "10" })).toHaveLength(4);
    expect(ids({ championId: 1, limit: "10" })).toEqual(["D", "A", "C"]);
    const many = Array.from({ length: 25 }, (_, i) =>
      makeMatch({ playedAt: new Date(NOW.getTime() - i * 3_600_000).toISOString() }),
    );
    expect(applyFilters(many, { ...DEFAULT_FILTERS, limit: "20" }, NOW)).toHaveLength(20);
  });

  it("combines filters and can produce an empty result", () => {
    expect(ids({ championId: 2, role: "MIDDLE" })).toEqual([]);
  });

  it("lists filter options from the data only", () => {
    const options = filterOptions(matches);
    expect(options.champions.map((c) => c.name)).toEqual(["Alpha", "Beta"]);
    expect(options.roles).toEqual(["MIDDLE", "TOP"]);
    expect(options.patches).toEqual(["14.23", "14.22", "14.18"]);
  });
});

describe("grouping and associations", () => {
  const matches = [
    makeMatch({ champion: champ(1, "Alpha"), teamPosition: "MIDDLE", win: true }),
    makeMatch({ champion: champ(1, "Alpha"), teamPosition: "MIDDLE", win: false }),
    makeMatch({ champion: champ(2, "Beta"), teamPosition: "TOP", win: true }),
    makeMatch({ champion: champ(2, "Beta"), teamPosition: null, win: true }),
  ];

  it("associates matches to the champion played", () => {
    const groups = byChampion(matches);
    expect(groups.map((g) => [g.label, g.summary.games, g.summary.winRate])).toEqual([
      ["Beta", 2, 1],
      ["Alpha", 2, 0.5],
    ]);
    expect(groups[0]?.share).toBe(0.5);
  });

  it("groups by role and leaves out matches without a role", () => {
    const groups = byRole(matches);
    expect(groups.map((g) => [g.label, g.summary.games])).toEqual([
      ["Mid", 2],
      ["Top", 1],
    ]);
  });
});

describe("chart series", () => {
  const matches = [
    makeMatch({ playedAt: "2026-11-03T10:00:00.000Z", win: false, kills: 1, deaths: 1, assists: 1 }),
    makeMatch({ playedAt: "2026-11-01T10:00:00.000Z", win: true, kills: 4, deaths: 2, assists: 0, damageDealt: null }),
    makeMatch({ playedAt: "2026-11-10T10:00:00.000Z", win: true, teamKills: 0 }),
  ];

  it("orders points chronologically with cumulative and rolling win rate", () => {
    const series = timeSeries(matches);
    expect(series.map((p) => p.index)).toEqual([1, 2, 3]);
    expect(series.map((p) => p.win)).toEqual([true, false, true]);
    expect(series.map((p) => Math.round(p.winRate))).toEqual([100, 50, 67]);
    expect(series[0]?.kda).toBe(2);
    expect(series[0]?.damagePerMinute).toBeNull();
    expect(series[2]?.killParticipation).toBeNull();
  });

  it("buckets wins and losses per ISO week", () => {
    expect(weeklyResults(matches)).toEqual([
      { week: "2026-10-26", wins: 1, losses: 0 },
      { week: "2026-11-02", wins: 0, losses: 1 },
      { week: "2026-11-09", wins: 1, losses: 0 },
    ]);
  });

  it("describes provenance: source, patches, count and period", () => {
    const info = provenance("Riot API · match-v5", [
      ...matches,
      makeMatch({ patch: "14.21", playedAt: "2026-10-01T10:00:00.000Z" }),
    ]);
    expect(info.games).toBe(4);
    expect(info.patches).toEqual(["14.23", "14.21"]);
    expect(info.from).toBe("2026-10-01T10:00:00.000Z");
    expect(info.to).toBe("2026-11-10T10:00:00.000Z");
    expect(provenance("x", []).from).toBeNull();
  });
});
