import {
  Database,
  LineChart,
  Radio,
  Settings2,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import type { ActivityEntry } from "@/types/system";

const activityIcons: Record<ActivityEntry["kind"], LucideIcon> = {
  system: Terminal,
  database: Database,
  riot: Radio,
  analysis: LineChart,
  settings: Settings2,
};

interface ActivityFeedProps {
  entries: ActivityEntry[];
  isLoading: boolean;
  isBrowserPreview: boolean;
  error: unknown;
  onRetry: () => void;
}

export function ActivityFeed({
  entries,
  isLoading,
  isBrowserPreview,
  error,
  onRetry,
}: ActivityFeedProps) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-card">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="eyebrow">Log locale</p>
          <h2 className="mt-1 font-display text-sm font-semibold">
            Attività recenti
          </h2>
        </div>
        <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/50 uppercase">
          solo dispositivo
        </span>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-7 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-32" />
                  <Skeleton className="h-2 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            compact
            title="Attività non disponibile"
            message={getErrorMessage(error)}
            onRetry={onRetry}
          />
        ) : isBrowserPreview ? (
          <EmptyState
            icon={Sparkles}
            title="Backend desktop non connesso"
            description="Avvia l'app con Tauri per leggere il database SQLite locale e registrare l'attività."
            action={
              <Link
                to="/settings"
                className="text-xs font-semibold text-secondary hover:underline"
              >
                Vedi diagnostica
              </Link>
            }
            className="border-0 bg-transparent py-6"
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title="Nessuna attività registrata"
            description="Gli eventi reali dell'app compariranno qui con data e dettaglio."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-1 before:bottom-1 before:left-[13px] before:w-px before:bg-white/[0.07]">
            {entries.map((entry) => {
              const Icon = activityIcons[entry.kind];

              return (
                <li key={entry.id} className="relative flex gap-3">
                  <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-surface-raised text-muted-foreground">
                    <Icon className="size-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {entry.title}
                      </p>
                      <time
                        dateTime={entry.createdAt}
                        className="shrink-0 font-mono text-[9px] text-muted-foreground/50"
                      >
                        {formatDateTime(entry.createdAt)}
                      </time>
                    </div>
                    {entry.detail ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
                        {entry.detail}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
