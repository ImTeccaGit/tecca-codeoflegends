import {
  DEFAULT_FILTERS,
  MATCH_LIMITS,
  PERIODS,
  type AnalysisFilters,
} from "@/features/analysis/lib/analysis";
import type { QueueGroup } from "@/lib/queues";

const QUEUES: readonly (QueueGroup | "all")[] = ["all", "solo", "flex", "normal", "aram", "other"];
const ROLE_PATTERN = /^[A-Z]{3,10}$/;
const PATCH_PATTERN = /^\d{1,3}\.\d{1,3}$/;

/** Reads filters from the URL; invalid values fall back to the defaults. */
export function filtersFromParams(params: URLSearchParams): AnalysisFilters {
  const champion = Number(params.get("champion"));
  const role = params.get("role");
  const patch = params.get("patch");
  const queue = params.get("queue");
  const period = params.get("period");
  const limit = params.get("limit");
  return {
    championId: Number.isInteger(champion) && champion > 0 ? champion : null,
    role: role && ROLE_PATTERN.test(role) ? role : null,
    patch: patch && PATCH_PATTERN.test(patch) ? patch : null,
    queue: QUEUES.find((value) => value === queue) ?? DEFAULT_FILTERS.queue,
    period: PERIODS.find((value) => value === period) ?? DEFAULT_FILTERS.period,
    limit: MATCH_LIMITS.find((value) => value === limit) ?? DEFAULT_FILTERS.limit,
  };
}

/** Writes filters into a copy of `params`, omitting default values. */
export function filtersToParams(params: URLSearchParams, filters: AnalysisFilters): URLSearchParams {
  const search = new URLSearchParams(params);
  const entries: [string, string | null][] = [
    ["champion", filters.championId === null ? null : String(filters.championId)],
    ["role", filters.role],
    ["patch", filters.patch],
    ["queue", filters.queue === "all" ? null : filters.queue],
    ["period", filters.period === "all" ? null : filters.period],
    ["limit", filters.limit === "all" ? null : filters.limit],
  ];
  for (const [key, value] of entries) {
    if (value) search.set(key, value);
    else search.delete(key);
  }
  return search;
}
