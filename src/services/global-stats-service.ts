import { z } from "zod";
import { AppError } from "@/lib/errors";
import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import {
  championGlobalStatsSchema,
  championRolesOverviewSchema,
  globalStatsSettingsSchema,
  globalStatsStatusSchema,
  patchFilterSchema,
  roleSchema,
  type ChampionGlobalStats,
  type ChampionRolesOverview,
  type ChampionStatsFilter,
  type GlobalStatsSettings,
  type GlobalStatsStatus,
} from "@/types/global-stats";

/**
 * Global champion statistics. Collected by the Rust backend with the user's
 * own Riot API key (opt-in); the webview never calls Riot directly.
 */
export function isGlobalStatsAvailable(): boolean {
  return isTauriRuntime();
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", result.error.issues[0]?.message ?? "Dato non valido.", result.error);
  }
  return result.data;
}

export function getGlobalStatsStatus(): Promise<GlobalStatsStatus> {
  return invokeCommand("get_global_stats_status", globalStatsStatusSchema);
}

export async function updateGlobalStatsSettings(settings: GlobalStatsSettings): Promise<GlobalStatsStatus> {
  const valid = parse(globalStatsSettingsSchema, settings);
  return invokeCommand("update_global_stats_settings", globalStatsStatusSchema, valid);
}

/** Deletes every collected match (settings are kept). */
export function clearGlobalStats(): Promise<GlobalStatsStatus> {
  return invokeCommand("clear_global_stats", globalStatsStatusSchema);
}

export async function getChampionGlobalStats(
  championId: number,
  filter: ChampionStatsFilter,
): Promise<ChampionGlobalStats> {
  const id = parse(z.number().int().positive(), championId);
  const patch = filter.patch === null ? null : parse(patchFilterSchema, filter.patch);
  const role = filter.role === null ? null : parse(roleSchema, filter.role);
  return invokeCommand("get_champion_global_stats", championGlobalStatsSchema, {
    championId: id,
    patch,
    role,
  });
}

/** Lanes actually played by each champion (collected + personal matches). */
export function getChampionRoles(): Promise<ChampionRolesOverview> {
  return invokeCommand("get_champion_roles", championRolesOverviewSchema);
}
