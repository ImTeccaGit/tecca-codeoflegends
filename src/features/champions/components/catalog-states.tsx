import { CloudDownload, Loader2, MonitorSmartphone } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalogStatus, useSyncDataDragon } from "@/hooks/use-catalog";
import { formatDateTime } from "@/lib/utils";

/** The catalog lives in the desktop SQLite database. */
export function DesktopOnlyState() {
  return (
    <EmptyState
      icon={MonitorSmartphone}
      title="Disponibile nell'app desktop"
      description="Il catalogo Data Dragon è salvato nel database locale dell'app. Nell'anteprima browser non c'è backend: avvia l'app con npm run desktop:dev."
    />
  );
}

/** No patch imported yet: shows the running import or a manual trigger. */
export function EmptyCatalogState() {
  const { data: status } = useCatalogStatus();
  const sync = useSyncDataDragon();
  const syncing = sync.isPending || status?.syncing === true;
  const failed = status?.lastCheck?.outcome === "failed";

  if (syncing) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.015] px-6 py-14 text-center"
      >
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="font-display text-sm font-semibold text-foreground">
          Importazione dei dati Data Dragon in corso
        </p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Download di campioni, abilità, skin, oggetti e rune della patch
          corrente, poi verifica di integrità. Richiede circa un minuto.
        </p>
      </div>
    );
  }

  return (
    <EmptyState
      icon={CloudDownload}
      title="Nessun dato importato"
      description={
        failed && status?.lastCheck
          ? `L'ultimo tentativo (${formatDateTime(status.lastCheck.checkedAt)}) non è riuscito: controlla la connessione e riprova. Nessun dato viene inventato nel frattempo.`
          : "Il catalogo viene scaricato automaticamente da Riot Data Dragon. Puoi avviare subito l'importazione."
      }
      action={
        <Button size="sm" onClick={() => sync.mutate()}>
          <CloudDownload className="size-4" />
          Importa da Data Dragon
        </Button>
      }
    />
  );
}

export function ChampionGridSkeleton() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-3"
      aria-hidden="true"
    >
      {Array.from({ length: 18 }).map((_, index) => (
        <Skeleton key={index} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}
