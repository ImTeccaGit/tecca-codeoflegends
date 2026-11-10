import type { CampId, ClearAttempt } from "@/types/jungle";

/** Aggregates over the user's own practice attempts. Nothing else is used. */

export interface RouteStats {
  count: number;
  best: ClearAttempt | null;
  averageMs: number | null;
  latest: ClearAttempt | null;
  /** First attempt total minus latest total (positive = faster now). */
  improvementMs: number | null;
}

/** Attempts of one route, oldest first. */
export function attemptsForRoute(
  attempts: ClearAttempt[],
  routeKey: string,
): ClearAttempt[] {
  return attempts
    .filter((attempt) => attempt.routeKey === routeKey)
    .sort((a, b) => a.id - b.id);
}

export function routeStats(attempts: ClearAttempt[]): RouteStats {
  if (attempts.length === 0) {
    return { count: 0, best: null, averageMs: null, latest: null, improvementMs: null };
  }
  const chronological = [...attempts].sort((a, b) => a.id - b.id);
  const best = chronological.reduce((winner, attempt) =>
    attempt.totalMs < winner.totalMs ? attempt : winner,
  );
  const first = chronological[0];
  const latest = chronological[chronological.length - 1] ?? null;
  const total = chronological.reduce((sum, attempt) => sum + attempt.totalMs, 0);

  return {
    count: chronological.length,
    best,
    averageMs: Math.round(total / chronological.length),
    latest,
    improvementMs:
      first && latest && chronological.length > 1
        ? first.totalMs - latest.totalMs
        : null,
  };
}

/** Time spent on each camp: split minus previous split. */
export function segmentDurations(attempt: ClearAttempt): number[] {
  return attempt.splits.map(
    (split, index) => split.splitMs - (attempt.splits[index - 1]?.splitMs ?? 0),
  );
}

export interface ComparisonRow {
  stepIndex: number;
  campId: CampId;
  aSegmentMs: number;
  bSegmentMs: number;
  /** b − a: negative means B was faster on this camp. */
  segmentDeltaMs: number;
  aSplitMs: number;
  bSplitMs: number;
  splitDeltaMs: number;
}

/**
 * Camp-by-camp comparison. Only attempts with the same camp sequence can be
 * compared step by step; otherwise null.
 */
export function compareAttempts(
  a: ClearAttempt,
  b: ClearAttempt,
): ComparisonRow[] | null {
  const sameRoute =
    a.camps.length === b.camps.length &&
    a.camps.every((camp, index) => camp === b.camps[index]);
  if (!sameRoute) {
    return null;
  }
  const aSegments = segmentDurations(a);
  const bSegments = segmentDurations(b);

  return a.camps.map((campId, index) => {
    const aSegmentMs = aSegments[index] ?? 0;
    const bSegmentMs = bSegments[index] ?? 0;
    const aSplitMs = a.splits[index]?.splitMs ?? 0;
    const bSplitMs = b.splits[index]?.splitMs ?? 0;
    return {
      stepIndex: index,
      campId,
      aSegmentMs,
      bSegmentMs,
      segmentDeltaMs: bSegmentMs - aSegmentMs,
      aSplitMs,
      bSplitMs,
      splitDeltaMs: bSplitMs - aSplitMs,
    };
  });
}

/** Best (fastest) attempt per route key, across all routes. */
export function personalBests(attempts: ClearAttempt[]): Map<string, ClearAttempt> {
  const bests = new Map<string, ClearAttempt>();
  for (const attempt of attempts) {
    const current = bests.get(attempt.routeKey);
    if (!current || attempt.totalMs < current.totalMs) {
      bests.set(attempt.routeKey, attempt);
    }
  }
  return bests;
}
