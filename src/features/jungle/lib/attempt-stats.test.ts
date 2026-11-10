import { describe, expect, it } from "vitest";
import {
  attemptsForRoute,
  compareAttempts,
  personalBests,
  routeStats,
  segmentDurations,
} from "@/features/jungle/lib/attempt-stats";
import type { CampId, ClearAttempt } from "@/types/jungle";

function attempt(
  id: number,
  routeKey: string,
  camps: CampId[],
  splits: number[],
): ClearAttempt {
  return {
    id,
    routeKey,
    routeName: routeKey,
    side: "blue",
    camps,
    totalMs: splits.at(-1) ?? 0,
    championId: null,
    championName: null,
    createdAt: "2026-11-09T10:00:00.000Z",
    splits: splits.map((splitMs, stepIndex) => ({
      stepIndex,
      campId: camps[stepIndex] ?? "blue-red",
      splitMs,
    })),
  };
}

const CAMPS: CampId[] = ["blue-red", "blue-krugs", "blue-raptors"];
const A = attempt(1, "full", CAMPS, [25_000, 52_000, 80_000]);
const B = attempt(2, "full", CAMPS, [24_000, 53_500, 78_000]);
const C = attempt(3, "full", CAMPS, [23_000, 50_000, 76_500]);
const OTHER = attempt(4, "three", ["blue-red", "blue-blue"], [20_000, 45_000]);

describe("routeStats", () => {
  it("is empty without attempts", () => {
    expect(routeStats([])).toEqual({
      count: 0,
      best: null,
      averageMs: null,
      latest: null,
      improvementMs: null,
    });
  });

  it("computes best, average, latest and improvement", () => {
    const stats = routeStats([C, A, B]);
    expect(stats.count).toBe(3);
    expect(stats.best?.id).toBe(3);
    expect(stats.averageMs).toBe(78_167);
    expect(stats.latest?.id).toBe(3);
    expect(stats.improvementMs).toBe(3_500);
  });

  it("has no improvement with a single attempt", () => {
    expect(routeStats([A]).improvementMs).toBeNull();
  });
});

describe("segments and comparison", () => {
  it("derives per-camp durations from cumulative splits", () => {
    expect(segmentDurations(A)).toEqual([25_000, 27_000, 28_000]);
  });

  it("compares two attempts camp by camp", () => {
    const rows = compareAttempts(A, B);
    expect(rows?.map((row) => row.segmentDeltaMs)).toEqual([-1000, 2500, -3500]);
    expect(rows?.map((row) => row.splitDeltaMs)).toEqual([-1000, 1500, -2000]);
  });

  it("refuses to compare different camp sequences", () => {
    expect(compareAttempts(A, OTHER)).toBeNull();
  });
});

describe("route helpers", () => {
  it("filters one route, oldest first", () => {
    expect(attemptsForRoute([C, OTHER, A], "full").map((a) => a.id)).toEqual([1, 3]);
  });

  it("finds the personal best for every route", () => {
    const bests = personalBests([A, B, C, OTHER]);
    expect(bests.get("full")?.id).toBe(3);
    expect(bests.get("three")?.id).toBe(4);
  });
});
