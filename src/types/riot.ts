import { z } from "zod";
import { riotRegionSchema } from "@/types/system";

/** Contracts for `src-tauri/src/riot/dto.rs`. Real Riot API data only. */

export const keyStatusSchema = z.object({
  configured: z.boolean(),
  source: z.enum(["environment", "credential_store"]).nullable(),
  environmentOverrides: z.boolean(),
});
export type KeyStatus = z.infer<typeof keyStatusSchema>;

export const syncStateSchema = z.object({
  profileSyncedAt: z.string().nullable(),
  rankedSyncedAt: z.string().nullable(),
  matchesSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

export const rankedEntrySchema = z.object({
  queueType: z.string().min(1),
  tier: z.string().min(1),
  division: z.string().nullable(),
  leaguePoints: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  hotStreak: z.boolean(),
  fetchedAt: z.string().min(1),
});
export type RankedEntry = z.infer<typeof rankedEntrySchema>;

const runeRefSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  iconUrl: z.string().url().nullable(),
});

export const playerMatchSchema = z.object({
  matchId: z.string().min(1),
  queueId: z.number().int(),
  gameMode: z.string().nullable(),
  gameVersion: z.string().nullable(),
  playedAt: z.string().min(1),
  durationSeconds: z.number().int().nonnegative(),
  endedEarly: z.boolean(),
  win: z.boolean(),
  championId: z.number().int(),
  championName: z.string().nullable(),
  championImageUrl: z.string().url().nullable(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  creepScore: z.number().int().nonnegative(),
  goldEarned: z.number().int().nonnegative(),
  visionScore: z.number().int(),
  champLevel: z.number().int().nullable(),
  teamPosition: z.string().nullable(),
  damageToChampions: z.number().int().nullable(),
  items: z.array(z.object({ id: z.number().int(), imageUrl: z.string().url().nullable() })),
  keystone: runeRefSchema.nullable(),
  secondaryStyle: runeRefSchema.nullable(),
});
export type PlayerMatch = z.infer<typeof playerMatchSchema>;

export const playerProfileSchema = z.object({
  puuid: z.string().min(1),
  gameName: z.string(),
  tagLine: z.string(),
  region: riotRegionSchema,
  summonerLevel: z.number().int().nullable(),
  profileIconUrl: z.string().url().nullable(),
  saved: z.boolean(),
  primary: z.boolean(),
  sync: syncStateSchema,
  ranked: z.array(rankedEntrySchema),
  matches: z.array(playerMatchSchema),
  source: z.string().min(1),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

export const profileSummarySchema = z.object({
  puuid: z.string().min(1),
  gameName: z.string(),
  tagLine: z.string(),
  region: riotRegionSchema,
  summonerLevel: z.number().int().nullable(),
  profileIconUrl: z.string().url().nullable(),
  primary: z.boolean(),
  soloQueue: rankedEntrySchema.nullable(),
  matchCount: z.number().int().nonnegative(),
  matchesSyncedAt: z.string().nullable(),
});
export type ProfileSummary = z.infer<typeof profileSummarySchema>;

/** "Nome#TAG" → parts, with the same rules the backend enforces. */
export const riotIdSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const index = value.lastIndexOf("#");
    if (index < 0) {
      context.addIssue({ code: "custom", message: "Scrivi il Riot ID come Nome#TAG" });
      return z.NEVER;
    }
    const gameName = value.slice(0, index).trim();
    const tagLine = value.slice(index + 1).trim();
    if ([...gameName].length < 3 || [...gameName].length > 16) {
      context.addIssue({ code: "custom", message: "Il nome deve avere da 3 a 16 caratteri" });
      return z.NEVER;
    }
    if (!/^[\p{L}\p{N}]{3,5}$/u.test(tagLine)) {
      context.addIssue({ code: "custom", message: "Il tag deve avere da 3 a 5 lettere o cifre" });
      return z.NEVER;
    }
    return { gameName, tagLine };
  });

/** Development key format issued by the Riot Developer Portal. */
export const riotApiKeySchema = z
  .string()
  .trim()
  .regex(
    /^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Formato atteso: RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  );
