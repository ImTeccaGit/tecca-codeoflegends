import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { LiveBoardContent } from "@/features/live/components/live-board";
import { useLiveBoard } from "@/hooks/use-live";
import { queryClient } from "@/lib/query-client";

/** Shortcut registered by Rust (`live/window.rs`, BOARD_SHORTCUT). */
export const BOARD_SHORTCUT_LABEL = "Home";

/**
 * Content of the separate in-game board window. Read-only and
 * click-through: no buttons, no inputs.
 */
function BoardContent() {
  const board = useLiveBoard();
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-background/90 p-4 font-sans text-foreground select-none">
      <header className="flex items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold">
          Tecca <span className="text-primary">CodeOfLegends</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">Pannello partita</span>
        </p>
        <p className="text-[11px] text-muted-foreground">{BOARD_SHORTCUT_LABEL} per nascondere / riaprire</p>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {board.data ? (
          <LiveBoardContent board={board.data} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {board.isError ? "Dati non disponibili: dettaglio nei log." : "Caricamento…"}
          </p>
        )}
      </div>
    </div>
  );
}

export function BoardApp() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BoardContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
