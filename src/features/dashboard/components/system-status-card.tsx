import {
  Database,
  Monitor,
  Radio,
  RefreshCw,
  ShieldAlert,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { StatusDot, type StatusTone } from "@/components/shared/status-dot";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/errors";
import type { SystemSnapshot } from "@/types/system";
import { cn } from "@/lib/utils";

interface SystemStatusCardProps {
  snapshot: SystemSnapshot | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isFetching: boolean;
}

interface StatusRow {
  label: string;
  value: string;
  description: string;
  tone: StatusTone;
  icon: LucideIcon;
}

function buildRows(snapshot: SystemSnapshot | undefined): StatusRow[] {
  const browser = snapshot?.runtime === "browser";
  const dbState = snapshot?.database.state;
  const riotState = snapshot?.riot.state;
  const liveState = snapshot?.liveClient.state;

  return [
    {
      label: "Interfaccia desktop",
      value: browser ? "Anteprima web" : "Attiva",
      description: browser
        ? "Stai visualizzando la UI fuori dal contenitore Tauri."
        : "Webview Tauri 2 collegata al backend locale.",
      tone: browser ? "warning" : "success",
      icon: Monitor,
    },
    {
      label: "Database SQLite",
      value:
        dbState === "ready"
          ? "Connesso"
          : dbState === "error"
            ? "Errore"
            : "Non disponibile",
      description:
        dbState === "ready"
          ? `Schema v${snapshot?.database.schemaVersion ?? 0} · ${snapshot?.database.path ?? "percorso locale"}`
          : "Il database locale viene creato al primo avvio dell'app desktop.",
      tone:
        dbState === "ready"
          ? "success"
          : dbState === "error"
            ? "danger"
            : "warning",
      icon: Database,
    },
    {
      label: "Riot API",
      value:
        riotState === "configured"
          ? "Configurata"
          : riotState === "error"
            ? "Errore"
            : "Non configurata",
      description:
        snapshot?.riot.message ??
        "Nessuna credenziale presente nel client. L'integrazione arriverà lato backend.",
      tone:
        riotState === "configured"
          ? "success"
          : riotState === "error"
            ? "danger"
            : "warning",
      icon: riotState === "error" ? ShieldAlert : Wifi,
    },
    {
      label: "Live Client",
      value:
        liveState === "running"
          ? "Rilevato"
          : liveState === "not_running"
            ? "Non attivo"
            : liveState === "error"
              ? "Errore"
              : liveState === "disabled"
                ? "Disattivato"
                : "Solo app desktop",
      description:
        snapshot?.liveClient.message ??
        "Nessun accesso alla memoria o ai file del gioco. Solo la Live Client Data API locale.",
      tone:
        liveState === "running"
          ? "success"
          : liveState === "error"
            ? "danger"
            : liveState === "not_running"
              ? "warning"
              : "muted",
      icon: Radio,
    },
  ];
}

export function SystemStatusCard({
  snapshot,
  isLoading,
  error,
  onRetry,
  isFetching,
}: SystemStatusCardProps) {
  const rows = buildRows(snapshot);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="eyebrow">Diagnostica</p>
          <h2 className="mt-1 font-display text-sm font-semibold">
            Stato piattaforma
          </h2>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <RefreshCw
            className={cn("size-2.5", isFetching ? "animate-spin" : "")}
          />
          Snapshot
        </Badge>
      </div>

      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-full max-w-[220px]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            compact
            title="Stato non disponibile"
            message={getErrorMessage(error)}
            onRetry={onRetry}
          />
        ) : (
          <ul className="space-y-3.5">
            {rows.map((row) => {
              const Icon = row.icon;

              return (
                <li key={row.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-muted-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {row.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                        <StatusDot tone={row.tone} pulse={row.tone === "success"} />
                        {row.value}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
                      {row.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-white/[0.06] px-5 py-3">
        <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/50 uppercase">
          {snapshot
            ? `Ultimo check · ${new Date(snapshot.generatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : "In attesa del backend…"}
        </p>
      </div>
    </Card>
  );
}
