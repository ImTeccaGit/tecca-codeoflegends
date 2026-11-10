import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { z, type ZodType } from "zod";
import { AppError } from "@/lib/errors";
import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import {
  liveBoardSchema,
  liveSnapshotSchema,
  overlayPatchSchema,
  overlaySettingsSchema,
  type LiveBoard,
  type LiveSnapshot,
  type OverlayPatch,
  type OverlaySettings,
} from "@/types/live";

/** Emitted by Rust when the live snapshot content changes. */
const LIVE_UPDATE_EVENT = "live-game-update";
/** Emitted by Rust after the overlay settings are saved. */
const OVERLAY_SETTINGS_EVENT = "overlay-settings-updated";
const OVERLAY_WINDOW_LABEL = "overlay";
const BOARD_WINDOW_LABEL = "board";
/** Emitted by Rust when the in-game board changes. */
const BOARD_UPDATE_EVENT = "live-board-update";

/** Live detection talks to the local game client through Rust only. */
export function isLiveAvailable(): boolean {
  return isTauriRuntime();
}

/**
 * True inside the separate overlay window. The label comes from the Tauri
 * window metadata injected at creation (no IPC call).
 */
export function isOverlayWindow(): boolean {
  return currentWindowLabel() === OVERLAY_WINDOW_LABEL;
}

/** True inside the separate in-game board window. */
export function isBoardWindow(): boolean {
  return currentWindowLabel() === BOARD_WINDOW_LABEL;
}

function currentWindowLabel(): unknown {
  if (!isTauriRuntime()) {
    return null;
  }
  const internals: unknown = window.__TAURI_INTERNALS__;
  if (typeof internals !== "object" || internals === null) {
    return null;
  }
  const metadata: unknown = Reflect.get(internals, "metadata");
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }
  const current: unknown = Reflect.get(metadata, "currentWindow");
  if (typeof current !== "object" || current === null) {
    return null;
  }
  return Reflect.get(current, "label");
}

export function getLiveSnapshot(): Promise<LiveSnapshot> {
  return invokeCommand("get_live_snapshot", liveSnapshotSchema);
}

export function setLiveEnabled(enabled: boolean): Promise<LiveSnapshot> {
  return invokeCommand("set_live_enabled", liveSnapshotSchema, { enabled });
}

export function getOverlaySettings(): Promise<OverlaySettings> {
  return invokeCommand("get_overlay_settings", overlaySettingsSchema);
}

export function updateOverlaySettings(
  patch: OverlayPatch,
): Promise<OverlaySettings> {
  const parsed = overlayPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return Promise.reject(
      new AppError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Impostazioni overlay non valide.",
        parsed.error,
      ),
    );
  }
  return invokeCommand("update_overlay_settings", overlaySettingsSchema, {
    patch: parsed.data,
  });
}

async function subscribe<T>(
  event: string,
  schema: ZodType<T>,
  onPayload: (payload: T) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  try {
    return await listen<unknown>(event, (message) => {
      const parsed = schema.safeParse(message.payload);
      if (parsed.success) {
        onPayload(parsed.data);
      }
    });
  } catch (error) {
    throw new AppError(
      "BACKEND_UNAVAILABLE",
      "Impossibile ricevere gli aggiornamenti della partita.",
      error,
    );
  }
}

export function subscribeToLiveUpdates(
  onUpdate: (snapshot: LiveSnapshot) => void,
): Promise<UnlistenFn> {
  return subscribe(LIVE_UPDATE_EVENT, liveSnapshotSchema, onUpdate);
}

export function subscribeToOverlaySettings(
  onUpdate: (settings: OverlaySettings) => void,
): Promise<UnlistenFn> {
  return subscribe(OVERLAY_SETTINGS_EVENT, overlaySettingsSchema, onUpdate);
}

export function getLiveBoard(): Promise<LiveBoard> {
  return invokeCommand("get_live_board", liveBoardSchema);
}

/** Shows or hides the in-game board window; resolves to "open". */
export function toggleLiveBoard(): Promise<boolean> {
  return invokeCommand("toggle_live_board", z.boolean());
}

export function isLiveBoardOpen(): Promise<boolean> {
  return invokeCommand("is_live_board_open", z.boolean());
}

export function subscribeToLiveBoard(onUpdate: (board: LiveBoard) => void): Promise<UnlistenFn> {
  return subscribe(BOARD_UPDATE_EVENT, liveBoardSchema, onUpdate);
}
