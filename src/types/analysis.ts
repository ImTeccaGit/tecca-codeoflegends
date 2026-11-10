import { z } from "zod";
import { rankedEntrySchema } from "@/types/riot";

/** Contracts of the Rust `analysis` module (stored match-v5 data). */

const urlOrNull = z.string().url().nullable();
const optionalStat = z.number().int().nonnegative().nullable();

export const championRefSchema = z.object({
  championId: z.number().int(),
  championName: z.string().min(1),
  imageUrl: urlOrNull,
});
export type ChampionRef = z.infer<typeof championRefSchema>;

export const analysisItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  imageUrl: urlOrNull,
  completed: z.boolean(),
});
export type AnalysisItem = z.infer<typeof analysisItemSchema>;

const runeSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  iconUrl: urlOrNull,
});
export type AnalysisRune = z.infer<typeof runeSchema>;

export const laneOpponentSchema = z.object({
  champion: championRefSchema,
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  creepScore: z.number().int().nonnegative(),
  goldEarned: z.number().int().nonnegative(),
  visionScore: z.number().int(),
  damageDealt: optionalStat,
  damageTaken: optionalStat,
});
export type LaneOpponent = z.infer<typeof laneOpponentSchema>;

export const analysisMatchSchema = z.object({
  matchId: z.string().min(1),
  queueId: z.number().int(),
  gameMode: z.string().nullable(),
  gameVersion: z.string().nullable(),
  patch: z.string().nullable(),
  playedAt: z.string().min(1),
  durationSeconds: z.number().int().nonnegative(),
  endedEarly: z.boolean(),
  win: z.boolean(),
  champion: championRefSchema,
  teamPosition: z.string().nullable(),
  champLevel: z.number().int().nullable(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  creepScore: z.number().int().nonnegative(),
  goldEarned: z.number().int().nonnegative(),
  visionScore: z.number().int(),
  damageDealt: optionalStat,
  damageTaken: optionalStat,
  teamKills: z.number().int().nonnegative(),
  items: z.array(analysisItemSchema),
  keystone: runeSchema.nullable(),
  secondaryStyle: runeSchema.nullable(),
  opponent: laneOpponentSchema.nullable(),
  allies: z.array(championRefSchema),
  enemies: z.array(championRefSchema),
  bans: z.array(z.number().int()),
});
export type AnalysisMatch = z.infer<typeof analysisMatchSchema>;

export const analysisDatasetSchema = z.object({
  puuid: z.string().min(1),
  gameName: z.string(),
  tagLine: z.string(),
  region: z.string(),
  source: z.string().min(1),
  matchesSyncedAt: z.string().nullable(),
  ranked: z.array(rankedEntrySchema),
  matches: z.array(analysisMatchSchema),
});
export type AnalysisDataset = z.infer<typeof analysisDatasetSchema>;
