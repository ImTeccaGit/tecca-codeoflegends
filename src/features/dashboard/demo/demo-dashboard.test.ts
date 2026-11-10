import { describe, expect, it } from "vitest";
import {
  createDemoDashboard,
  DEMO_SOURCE_LABEL,
} from "@/features/dashboard/demo/demo-dashboard";
import { summarizeMatches } from "@/lib/match-stats";
import { dashboardDataSchema } from "@/types/dashboard";

const NOW = new Date("2026-11-09T12:00:00.000Z");

describe("DEMO dashboard dataset", () => {
  const demo = createDemoDashboard(NOW);

  it("satisfies the same contract future real data must respect", () => {
    expect(dashboardDataSchema.safeParse(demo).success).toBe(true);
  });

  it("is explicitly marked as DEMO everywhere", () => {
    expect(demo.source).toBe("demo");
    expect(demo.sourceLabel).toBe(DEMO_SOURCE_LABEL);
    expect(demo.patch?.version).toBe("DEMO");
    for (const match of demo.matches) {
      expect(match.matchId.startsWith("DEMO-")).toBe(true);
    }
  });

  it("has unique match ids, most recent first, none in the future", () => {
    const ids = demo.matches.map((match) => match.matchId);
    expect(new Set(ids).size).toBe(ids.length);

    const times = demo.matches.map((match) => Date.parse(match.playedAt));
    const sortedDesc = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sortedDesc);
    expect(Math.max(...times)).toBeLessThanOrEqual(NOW.getTime());
  });

  it("keeps fixed content: only timestamps depend on now", () => {
    const later = createDemoDashboard(new Date("2027-01-01T00:00:00.000Z"));
    const strip = (data: typeof demo) =>
      data.matches.map(({ playedAt: _playedAt, ...rest }) => rest);
    expect(strip(later)).toEqual(strip(demo));
  });

  it("derives the card values from the listed matches", () => {
    const summary = summarizeMatches(demo.matches);
    expect(summary.games).toBe(20);
    expect(summary.wins).toBe(13);
    expect(summary.winRate).toBeCloseTo(0.65);
  });
});
