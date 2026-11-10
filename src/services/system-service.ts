import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import { AppError } from "@/lib/errors";
import {
  appSettingsSchema,
  settingsPatchSchema,
  systemSnapshotSchema,
  type AppSettings,
  type SettingsPatch,
  type SystemSnapshot,
} from "@/types/system";

const browserPreviewSnapshot: SystemSnapshot = {
  runtime: "browser",
  appVersion: "0.0.0-web",
  generatedAt: new Date().toISOString(),
  logDirectory: null,
  database: {
    state: "unavailable",
    path: null,
    schemaVersion: 0,
    sizeBytes: 0,
    tableCounts: {},
  },
  riot: {
    state: "not_configured",
    message:
      "Integrazione Riot non configurata. Le credenziali saranno gestite solo dal backend.",
  },
  liveClient: {
    state: "not_implemented",
    message:
      "Rilevamento partita disponibile solo nell'app desktop. Nessun accesso alla memoria o ai file del gioco.",
  },
  settings: {
    region: "euw1",
    reduceMotion: false,
  },
  activity: [],
};

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  if (!isTauriRuntime()) {
    return browserPreviewSnapshot;
  }

  return invokeCommand("get_system_snapshot", systemSnapshotSchema);
}

export async function updateSettings(
  patch: SettingsPatch,
): Promise<AppSettings> {
  const parsedPatch = settingsPatchSchema.safeParse(patch);

  if (!parsedPatch.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le impostazioni inviate non sono valide.",
      parsedPatch.error,
    );
  }

  const validatedPatch = parsedPatch.data;

  if (!isTauriRuntime()) {
    throw new AppError(
      "BACKEND_UNAVAILABLE",
      "Le preferenze possono essere salvate solo nell'app desktop.",
    );
  }

  return invokeCommand("update_settings", appSettingsSchema, {
    patch: validatedPatch,
  });
}
