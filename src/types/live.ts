import { z } from "zod";
import { championGlobalStatsSchema } from "@/types/global-stats";

/** Contracts of the Rust `live` module (Live Client Data API, own data only). */

export const liveStatusSchema = z.enum([
  "disabled",
  "not_running",
  "loading",
  "in_game",
  "error",
]);

export type LiveStatus = z.infer<typeof liveStatusSchema>;

export const liveGameSchema = z.object({
  mode: z.string(),
  mapName: z.string(),
  mapNumber: z.number().int(),
  gameTimeSeconds: z.number().nonnegative(),
});

export const livePlayerSchema = z.object({
  riotId: z.string(),
  championName: z.string(),
  championKey: z.string().nullable(),
  level: z.number().int(),
  team: z.string(),
  position: z.string().nullable(),
  isDead: z.boolean(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  creepScore: z.number().int().nonnegative(),
  wardScore: z.number().nonnegative(),
  csPerMinute: z.number().nonnegative().nullable(),
});

export type LivePlayer = z.infer<typeof livePlayerSchema>;

/** Public scoreboard identity of every player (no items, scores or timers). */
export const rosterEntrySchema = z.object({
  riotId: z.string().nullable(),
  championName: z.string(),
  championKey: z.string().nullable(),
  team: z.string(),
  position: z.string().nullable(),
  isMe: z.boolean(),
  isBot: z.boolean(),
});
export type RosterEntry = z.infer<typeof rosterEntrySchema>;

export const liveSnapshotSchema = z.object({
  status: liveStatusSchema,
  game: liveGameSchema.nullable(),
  player: livePlayerSchema.nullable(),
  roster: z.array(rosterEntrySchema),
  message: z.string().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
});

export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

export const OVERLAY_MODES = ["overlay", "window"] as const;
export const OVERLAY_ANCHORS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export const OVERLAY_THEMES = ["tecca", "minimal", "contrast"] as const;

/** Same limits enforced in Rust (`live/overlay.rs`). */
export const OVERLAY_LIMITS = {
  width: { min: 200, max: 600 },
  height: { min: 80, max: 400 },
  offset: { min: 0, max: 2000 },
  opacity: { min: 0.3, max: 1 },
} as const;

export const overlaySettingsSchema = z.object({
  visible: z.boolean(),
  mode: z.enum(OVERLAY_MODES),
  width: z.number().int().min(OVERLAY_LIMITS.width.min).max(OVERLAY_LIMITS.width.max),
  height: z.number().int().min(OVERLAY_LIMITS.height.min).max(OVERLAY_LIMITS.height.max),
  anchor: z.enum(OVERLAY_ANCHORS),
  offsetX: z.number().int().min(OVERLAY_LIMITS.offset.min).max(OVERLAY_LIMITS.offset.max),
  offsetY: z.number().int().min(OVERLAY_LIMITS.offset.min).max(OVERLAY_LIMITS.offset.max),
  opacity: z.number().min(OVERLAY_LIMITS.opacity.min).max(OVERLAY_LIMITS.opacity.max),
  theme: z.enum(OVERLAY_THEMES),
});

export type OverlaySettings = z.infer<typeof overlaySettingsSchema>;

export const overlayPatchSchema = overlaySettingsSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Nessuna impostazione overlay da aggiornare.",
  });

export type OverlayPatch = z.infer<typeof overlayPatchSchema>;

/* In-game board ------------------------------------------------------------ */

export const rankSummarySchema = z.object({
  tier: z.string(),
  division: z.string().nullable(),
  leaguePoints: z.number().int(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});
export type RankSummary = z.infer<typeof rankSummarySchema>;

export const recentFormSchema = z.object({
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  mainRole: z.string().nullable(),
  championGames: z.number().int().nonnegative(),
  championWins: z.number().int().nonnegative(),
});
export type RecentForm = z.infer<typeof recentFormSchema>;

export const boardPlayerStateSchema = z.enum(["anonymous", "bot", "pending", "ranked", "ready", "error"]);

export const boardPlayerSchema = z.object({
  riotId: z.string().nullable(),
  championName: z.string(),
  championKey: z.string().nullable(),
  championImageUrl: z.string().url().nullable(),
  team: z.string(),
  position: z.string().nullable(),
  isMe: z.boolean(),
  state: boardPlayerStateSchema,
  summonerLevel: z.number().int().nullable(),
  rank: rankSummarySchema.nullable(),
  recent: recentFormSchema.nullable(),
  message: z.string().nullable(),
});
export type BoardPlayer = z.infer<typeof boardPlayerSchema>;

export const liveBoardSchema = z.object({
  active: z.boolean(),
  platform: z.string().nullable(),
  players: z.array(boardPlayerSchema),
  build: championGlobalStatsSchema.nullable(),
  buildChampion: z.string().nullable(),
  message: z.string().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
});
export type LiveBoard = z.infer<typeof liveBoardSchema>;
