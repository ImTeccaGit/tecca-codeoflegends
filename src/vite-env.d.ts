/// <reference types="vite/client" />

interface Window {
  /** Injected by Tauri at runtime. Its presence means the webview is running inside the desktop shell. */
  __TAURI_INTERNALS__?: unknown;
}
