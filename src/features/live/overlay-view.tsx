import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import {
  STATUS_LABELS,
  formatGameTime,
  formatKda,
} from "@/features/live/lib/live-format";
import {
  useLiveEventListeners,
  useLiveSnapshot,
  useOverlaySettings,
} from "@/hooks/use-live";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

/**
 * Content of the separate overlay window. Read-only: no buttons, no inputs
 * (in overlay mode the window is click-through and never receives input).
 */
function OverlayContent() {
  useLiveEventListeners();
  const settings = useOverlaySettings();
  const snapshot = useLiveSnapshot();

  const theme = settings.data?.theme ?? "tecca";
  const opacity = settings.data?.opacity ?? 0.92;
  const live = snapshot.data;
  const player = live?.player ?? null;

  return (
    <div
      className={cn(
        `overlay-theme-${theme}`,
        "overlay-surface flex h-full w-full flex-col justify-center gap-1.5 rounded-xl px-3.5 py-2.5 font-sans select-none",
      )}
      style={{ opacity }}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--overlay-muted)]">
        <span>Tecca · Live</span>
        <span>{live ? STATUS_LABELS[live.status] : "…"}</span>
      </div>
      {live?.status === "in_game" && player ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-display text-sm font-semibold">
              {player.championName}
              <span className="ml-1.5 text-xs font-medium text-[var(--overlay-muted)]">
                Lv {player.level}
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums text-[var(--overlay-muted)]">
              {live.game ? formatGameTime(live.game.gameTimeSeconds) : ""}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
            <span>{formatKda(player.kills, player.deaths, player.assists)}</span>
            <span className="text-[var(--overlay-accent)]">
              {player.creepScore} CS
              {player.csPerMinute === null ? "" : ` · ${player.csPerMinute.toFixed(1)}/min`}
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs leading-snug text-[var(--overlay-muted)]">
          {snapshot.isError
            ? "Dati non disponibili: dettaglio nei log."
            : (live?.message ?? "In attesa dei dati…")}
        </p>
      )}
    </div>
  );
}

export function OverlayApp() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <OverlayContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
