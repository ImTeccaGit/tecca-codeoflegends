import { z } from "zod";

/**
 * Contracts for the competitive dashboard. Today they are only filled by the
 * DEMO dataset; the future Riot integration (Rust backend) must return the
 * same shapes, validated at the boundary with these schemas.
 */

/** Where a dataset comes from. `demo` data is never persisted or synced. */
export const dataSourceSchema = z.enum(["demo", "riot"]);
export type DataSource = z.infer<typeof dataSourceSchema>;

export const teamPositionSchema = z.enum([
  "TOP",
  "JUNGLE",
  "MIDDLE",
  "BOTTOM",
  "UTILITY",
]);
export type TeamPosition = z.infer<typeof teamPositionSchema>;

export const matchSummarySchema = z.object({
  matchId: z.string().min(1),
  championName: z.string().min(1),
  /** Null when the mode has no positions (ARAM, Arena…). */
  position: teamPositionSchema.nullable(),
  queue: z.string().min(1),
  win: z.boolean(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  creepScore: z.number().int().nonnegative(),
  durationSeconds: z.number().int().positive(),
  /** ISO 8601 UTC. */
  playedAt: z.string().min(1),
});
export type MatchSummary = z.infer<typeof matchSummarySchema>;

export const rankInfoSchema = z.object({
  queue: z.string().min(1),
  tier: z.string().min(1),
  division: z.string().nullable(),
  leaguePoints: z.number().int().nonnegative(),
});
export type RankInfo = z.infer<typeof rankInfoSchema>;

export const patchHighlightSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
});

export const patchInfoSchema = z.object({
  version: z.string().min(1),
  /** ISO 8601 UTC. */
  publishedAt: z.string().min(1),
  highlights: z.array(patchHighlightSchema),
});
export type PatchInfo = z.infer<typeof patchInfoSchema>;

export const dashboardDataSchema = z.object({
  source: dataSourceSchema,
  /** Human-readable origin shown next to the data, e.g. "Dati dimostrativi". */
  sourceLabel: z.string().min(1),
  /** Real data only: "Riot API", "Client League (LCU)" or both. */
  sourceName: z.string().min(1).optional(),
  /** ISO 8601 UTC: when the dataset was produced or retrieved. */
  retrievedAt: z.string().min(1),
  /** Most recent first. */
  matches: z.array(matchSummarySchema),
  rank: rankInfoSchema.nullable(),
  patch: patchInfoSchema.nullable(),
});
export type DashboardData = z.infer<typeof dashboardDataSchema>;
