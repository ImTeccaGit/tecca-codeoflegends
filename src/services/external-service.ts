import { openUrl } from "@tauri-apps/plugin-opener";
import { AppError } from "@/lib/errors";
import { isTauriRuntime } from "@/lib/tauri";

/** Keep in sync with the opener scope in src-tauri/capabilities/default.json. */
const ALLOWED_ORIGINS = new Set([
  "https://developer.riotgames.com",
  "https://www.riotgames.com",
  "https://www.leagueoflegends.com",
]);

/**
 * Opens allow-listed external links in the user's browser.
 * Arbitrary URLs are rejected to keep the webview sandbox intact.
 */
export async function openExternalUrl(url: string): Promise<void> {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("VALIDATION_ERROR", "URL non valido.");
  }

  if (parsed.protocol !== "https:" || !ALLOWED_ORIGINS.has(parsed.origin)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "L'apertura di questo dominio non è consentita.",
    );
  }

  if (isTauriRuntime()) {
    await openUrl(parsed.toString());
    return;
  }

  window.open(parsed.toString(), "_blank", "noopener,noreferrer");
}
