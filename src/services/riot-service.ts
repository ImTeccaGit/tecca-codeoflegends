import { z } from "zod";
import { AppError } from "@/lib/errors";
import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import {
  keyStatusSchema,
  playerProfileSchema,
  profileSummarySchema,
  riotApiKeySchema,
  riotIdSchema,
  type KeyStatus,
  type PlayerProfile,
  type ProfileSummary,
} from "@/types/riot";
import { riotRegionSchema, type RiotRegion } from "@/types/system";

/**
 * Riot API access goes through the Rust backend only. The webview never sees
 * the API key: it can only send a new one to be stored (write-only).
 */
export function isRiotAvailable(): boolean {
  return isTauriRuntime();
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Dato non valido.",
      result.error,
    );
  }
  return result.data;
}

export function getRiotKeyStatus(): Promise<KeyStatus> {
  return invokeCommand("get_riot_key_status", keyStatusSchema);
}

export async function setRiotApiKey(key: string): Promise<KeyStatus> {
  const valid = parse(riotApiKeySchema, key);
  return invokeCommand("set_riot_api_key", keyStatusSchema, { key: valid });
}

export function clearRiotApiKey(): Promise<KeyStatus> {
  return invokeCommand("clear_riot_api_key", keyStatusSchema);
}

export async function verifyRiotApiKey(region: RiotRegion): Promise<void> {
  await invokeCommand("verify_riot_api_key", z.null(), {
    region: parse(riotRegionSchema, region),
  });
}

export async function searchPlayer(riotId: string, region: RiotRegion): Promise<PlayerProfile> {
  const { gameName, tagLine } = parse(riotIdSchema, riotId);
  return invokeCommand("search_player", playerProfileSchema, {
    gameName,
    tagLine,
    region: parse(riotRegionSchema, region),
  });
}

export function syncPlayer(puuid: string, force: boolean): Promise<PlayerProfile> {
  return invokeCommand("sync_player", playerProfileSchema, { puuid, force });
}

export function getPlayerProfile(puuid: string): Promise<PlayerProfile | null> {
  return invokeCommand("get_player_profile", playerProfileSchema.nullable(), { puuid });
}

export function getPrimaryProfile(): Promise<PlayerProfile | null> {
  return invokeCommand("get_primary_profile", playerProfileSchema.nullable());
}

export function listSavedProfiles(): Promise<ProfileSummary[]> {
  return invokeCommand("list_saved_profiles", z.array(profileSummarySchema));
}

export async function savePlayerProfile(puuid: string, primary: boolean): Promise<void> {
  await invokeCommand("save_player_profile", z.null(), { puuid, primary });
}

export async function removePlayerProfile(puuid: string): Promise<void> {
  await invokeCommand("remove_player_profile", z.null(), { puuid });
}

export async function deletePlayerData(puuid: string): Promise<void> {
  await invokeCommand("delete_player_data", z.null(), { puuid });
}
