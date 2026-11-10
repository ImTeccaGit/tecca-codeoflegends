import { invoke } from "@tauri-apps/api/core";
import type { ZodType } from "zod";
import { AppError, normalizeError } from "@/lib/errors";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

/**
 * Single gateway between the React app and the Rust backend.
 * Every response is validated at the boundary: no unchecked data reaches the UI.
 */
export async function invokeCommand<T>(
  command: string,
  schema: ZodType<T>,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new AppError(
      "BACKEND_UNAVAILABLE",
      "Il backend desktop non è disponibile in questa anteprima browser.",
    );
  }

  try {
    const response: unknown = await invoke(command, args);
    const parsed = schema.safeParse(response);

    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Il backend ha restituito dati non conformi al contratto atteso.",
        parsed.error,
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw normalizeError(error);
  }
}
