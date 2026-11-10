import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import {
  catalogStatusSchema,
  championCatalogSchema,
  championDetailSchema,
  championKeySchema,
  championPreferencesSchema,
  laneSchema,
  syncOutcomeSchema,
  type CatalogStatus,
  type ChampionCatalog,
  type ChampionDetail,
  type ChampionPreferences,
  type Lane,
  type SyncOutcome,
} from "@/types/catalog";

/** Emitted by Rust after a new Data Dragon patch has been imported. */
const CATALOG_UPDATED_EVENT = "catalog-updated";

/** The catalog lives in the desktop SQLite database: no browser fallback. */
export function isCatalogAvailable(): boolean {
  return isTauriRuntime();
}

export function getChampionCatalog(): Promise<ChampionCatalog> {
  return invokeCommand("get_champion_catalog", championCatalogSchema);
}

export function getChampionDetail(key: string): Promise<ChampionDetail | null> {
  const parsed = championKeySchema.safeParse(key);

  if (!parsed.success) {
    // Not a possible Data Dragon id: no request, the page shows "not found".
    return Promise.resolve(null);
  }

  return invokeCommand(
    "get_champion_detail",
    championDetailSchema.nullable(),
    { key: parsed.data },
  );
}

export function getCatalogStatus(): Promise<CatalogStatus> {
  return invokeCommand("get_catalog_status", catalogStatusSchema);
}

export function syncDataDragon(): Promise<SyncOutcome> {
  return invokeCommand("sync_data_dragon", syncOutcomeSchema);
}

export function setChampionFavorite(
  championId: number,
  favorite: boolean,
): Promise<ChampionPreferences> {
  return invokeCommand("set_champion_favorite", championPreferencesSchema, {
    championId,
    favorite,
  });
}

export function setChampionLanes(
  championId: number,
  lanes: Lane[],
): Promise<ChampionPreferences> {
  const parsed = z.array(laneSchema).max(5).safeParse(lanes);
  if (!parsed.success) {
    return Promise.reject(
      new AppError("VALIDATION_ERROR", "Corsie non valide.", parsed.error),
    );
  }
  return invokeCommand("set_champion_lanes", championPreferencesSchema, {
    championId,
    lanes: parsed.data,
  });
}

const versionPayloadSchema = z.string();

/**
 * Calls `onUpdate` with the imported version whenever the backend finishes a
 * Data Dragon import (manual or scheduled). No-op in the browser preview.
 */
export async function subscribeToCatalogUpdates(
  onUpdate: (version: string) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  try {
    return await listen<unknown>(CATALOG_UPDATED_EVENT, (event) => {
      const parsed = versionPayloadSchema.safeParse(event.payload);
      if (parsed.success) {
        onUpdate(parsed.data);
      }
    });
  } catch (error) {
    throw new AppError(
      "BACKEND_UNAVAILABLE",
      "Impossibile ricevere gli aggiornamenti del catalogo.",
      error,
    );
  }
}
