import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { BoardApp } from "@/features/live/board-view";
import { OverlayApp } from "@/features/live/overlay-view";
import { isBoardWindow, isOverlayWindow } from "@/services/live-service";
import "@/index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Elemento #root non trovato nel documento.");
}

// The separate overlay window loads the same bundle with a minimal tree.
if (isOverlayWindow() || isBoardWindow()) {
  document.documentElement.dataset.window = "overlay";
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    {isOverlayWindow() ? (
      <OverlayApp />
    ) : isBoardWindow() ? (
      <BoardApp />
    ) : (
      <AppProviders>
        <AppRouter />
      </AppProviders>
    )}
  </React.StrictMode>,
);
