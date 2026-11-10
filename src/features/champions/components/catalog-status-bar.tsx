import { AlertTriangle, Database, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogStatus, useSyncDataDragon } from "@/hooks/use-catalog";
import { formatDateTime } from "@/lib/utils";
import type { PatchSummary } from "@/types/catalog";

interface CatalogStatusBarProps {
  patch: PatchSummary;
}

const OUTCOME_LABELS = {
  up_to_date: "nessuna nuova versione",
  imported: "nuova versione importata",
  failed: "non riuscito",
} as const;

/** Source, version and timestamps of the data on screen, plus manual check. */
export function CatalogStatusBar({ patch }: CatalogStatusBarProps) {
  const { data: status } = useCatalogStatus();
  const sync = useSyncDataDragon();
  const syncing = sync.isPending || status?.syncing === true;
  const lastCheck = status?.lastCheck ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-secondary/20 bg-secondary/[0.07] text-secondary">
          <Database className="size-4" />
        </span>
        <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-foreground">
              Patch {patch.patch}
            </span>
            <span>·</span>
            <span>
              {patch.source} {patch.version} ({patch.language})
            </span>
            <span>·</span>
            <span>
              importata il{" "}
              <time dateTime={patch.importedAt}>
                {formatDateTime(patch.importedAt)}
              </time>
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2">
            {lastCheck ? (
              <span
                className={
                  lastCheck.outcome === "failed" ? "text-warning" : undefined
                }
              >
                {lastCheck.outcome === "failed" ? (
                  <AlertTriangle className="mr-1 inline size-3 align-[-2px]" />
                ) : null}
                Ultimo controllo{" "}
                <time dateTime={lastCheck.checkedAt}>
                  {formatDateTime(lastCheck.checkedAt)}
                </time>
                : {OUTCOME_LABELS[lastCheck.outcome]}
              </span>
            ) : (
              <span>Nessun controllo registrato</span>
            )}
            {status ? (
              <span>
                · controllo automatico ogni {status.checkIntervalHours} ore ·{" "}
                {status.versions.length}{" "}
                {status.versions.length === 1 ? "patch conservata" : "patch conservate"}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {syncing ? (
          <Badge variant="secondary">
            <Loader2 className="animate-spin" />
            Controllo in corso
          </Badge>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => sync.mutate()}
          disabled={syncing}
        >
          <RefreshCw className="size-3.5" />
          Controlla aggiornamenti
        </Button>
      </div>
    </div>
  );
}
