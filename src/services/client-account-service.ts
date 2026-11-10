import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { AppError } from "@/lib/errors";
import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import { clientStatusSchema, installPathSchema, type ClientStatus } from "@/types/client-account";

/** Emitted by Rust when the account read from the League client changes. */
const CLIENT_UPDATE_EVENT = "client-account-updated";

export function isClientAccountAvailable(): boolean {
  return isTauriRuntime();
}

export function getClientAccountStatus(): Promise<ClientStatus> {
  return invokeCommand("get_client_account_status", clientStatusSchema);
}

export function setClientSyncEnabled(enabled: boolean): Promise<ClientStatus> {
  return invokeCommand("set_client_sync_enabled", clientStatusSchema, { enabled });
}

/** Reads account, rank and recent games from the open League client now. */
export function syncFromClient(): Promise<ClientStatus> {
  return invokeCommand("sync_from_client", clientStatusSchema);
}

/** Manual League folder; `null` returns to automatic detection. */
export function setLeagueInstallPath(path: string | null): Promise<ClientStatus> {
  if (path !== null) {
    const parsed = installPathSchema.safeParse(path);
    if (!parsed.success) {
      return Promise.reject(
        new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Percorso non valido.", parsed.error),
      );
    }
    return invokeCommand("set_league_install_path", clientStatusSchema, { path: parsed.data });
  }
  return invokeCommand("set_league_install_path", clientStatusSchema, { path: null });
}

export async function subscribeToClientAccount(
  onUpdate: (status: ClientStatus) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  try {
    return await listen<unknown>(CLIENT_UPDATE_EVENT, (event) => {
      const parsed = clientStatusSchema.safeParse(event.payload);
      if (parsed.success) {
        onUpdate(parsed.data);
      }
    });
  } catch (error) {
    throw new AppError("BACKEND_UNAVAILABLE", "Impossibile ricevere gli aggiornamenti dell'account.", error);
  }
}
