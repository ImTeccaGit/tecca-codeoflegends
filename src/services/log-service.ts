import { error as writeErrorLog } from "@tauri-apps/plugin-log";
import { isTauriRuntime } from "@/lib/tauri";

/**
 * Writes a frontend failure to the local log file managed by the Rust backend
 * (tauri-plugin-log). Logs never leave the device. In the browser preview there
 * is no log file, so the console is the only destination.
 */
export async function logFrontendError(
  context: string,
  detail: unknown,
): Promise<void> {
  const message = `[frontend] ${context}: ${describe(detail)}`;

  if (!isTauriRuntime()) {
    console.error(message);
    return;
  }

  try {
    await writeErrorLog(message);
  } catch (logError) {
    // The log itself failed: keep both errors visible in the devtools console.
    console.error(message, logError);
  }
}

function describe(detail: unknown): string {
  if (detail instanceof Error) {
    return detail.stack ?? `${detail.name}: ${detail.message}`;
  }

  if (typeof detail === "string") {
    return detail;
  }

  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}
