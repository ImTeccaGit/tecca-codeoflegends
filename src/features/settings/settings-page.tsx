import { useMutation } from "@tanstack/react-query";
import {
  Accessibility,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  Info,
  MonitorCog,
  Moon,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { BackupCard } from "@/features/settings/components/backup-card";
import { ClientAccountCard } from "@/features/settings/components/client-account-card";
import { GlobalStatsCard } from "@/features/settings/components/global-stats-card";
import { RiotKeyCard } from "@/features/settings/components/riot-key-card";
import { StatusDot } from "@/components/shared/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { systemKeys, useSystemSnapshot } from "@/hooks/use-system-snapshot";
import { getErrorMessage } from "@/lib/errors";
import { formatBytes } from "@/lib/utils";
import { queryClient } from "@/lib/query-client";
import { updateSettings } from "@/services/system-service";
import {
  RIOT_REGIONS,
  riotRegionSchema,
  type AppSettings,
  type RiotRegion,
  type SystemSnapshot,
} from "@/types/system";

const LOCAL_TABLES = [
  { key: "champions", label: "Campioni" },
  { key: "matches", label: "Partite" },
  { key: "builds", label: "Build" },
  { key: "rune_pages", label: "Rune" },
] as const;

const DEFAULT_SETTINGS: AppSettings = { region: "euw1", reduceMotion: false };

export function SettingsPage() {
  const { data, isLoading, isError, error, refetch } = useSystemSnapshot();
  // Only the unsaved region choice is local; saved values always come from the
  // backend snapshot, so background refetches never overwrite a pending edit.
  const [regionDraft, setRegionDraft] = useState<RiotRegion | null>(null);

  const isBrowserPreview = data?.runtime === "browser";
  const dbReady = data?.database.state === "ready";
  const saved = data?.settings ?? DEFAULT_SETTINGS;

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (settings) => {
      setRegionDraft(null);
      queryClient.setQueryData<SystemSnapshot>(
        systemKeys.snapshot,
        (previous) => (previous ? { ...previous, settings } : previous),
      );
      void queryClient.invalidateQueries({ queryKey: systemKeys.snapshot });
      toast.success("Preferenze aggiornate");
    },
    onError: () => {
      setRegionDraft(null);
    },
  });

  const region = regionDraft ?? saved.region;
  // While a toggle is being saved, show the requested value; on error the
  // switch falls back to the persisted one.
  const pendingReduceMotion = mutation.isPending
    ? mutation.variables.reduceMotion
    : undefined;
  const reduceMotion = pendingReduceMotion ?? saved.reduceMotion;

  const handleCopyPath = async () => {
    const path = data?.database.path;

    if (!path) {
      return;
    }

    try {
      await navigator.clipboard.writeText(path);
      toast.success("Percorso del database copiato");
    } catch {
      toast.error("Impossibile copiare il percorso negli appunti.");
    }
  };

  const handleCopyLogDirectory = async () => {
    const path = data?.logDirectory;

    if (!path) {
      return;
    }

    try {
      await navigator.clipboard.writeText(path);
      toast.success("Percorso dei log copiato");
    } catch {
      toast.error("Impossibile copiare il percorso negli appunti.");
    }
  };

  const handleReset = () => {
    setRegionDraft(null);
    mutation.mutate(DEFAULT_SETTINGS);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Sistema"
          title="Impostazioni"
          description="Caricamento delle preferenze locali…"
        />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,1fr)]">
          <div className="space-y-5">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Impostazioni"
        description="Preferenze persistenti, diagnostica reale e confini di sicurezza. Le credenziali Riot non transitano mai dal frontend."
        actions={
          <>
            <Badge variant={isBrowserPreview ? "warning" : "success"}>
              <span
                className={`size-1.5 rounded-full ${
                  isBrowserPreview ? "bg-warning" : "bg-success"
                }`}
              />
              {isBrowserPreview ? "Anteprima browser" : "Desktop connesso"}
            </Badge>
            <Badge variant="outline">v{data?.appVersion ?? "—"}</Badge>
          </>
        }
      />

      {isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,1fr)]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/[0.07] text-secondary">
                <Globe2 className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-sm font-semibold">
                  Profilo competitivo
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  La regione viene salvata nel database locale e sarà usata
                  dalle integrazioni Riot quando disponibili.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="riot-region">Regione Riot</Label>
                <div className="relative">
                  <select
                    id="riot-region"
                    value={region}
                    onChange={(event) => {
                      const parsed = riotRegionSchema.safeParse(
                        event.target.value,
                      );
                      if (parsed.success) {
                        setRegionDraft(parsed.data);
                      }
                    }}
                    disabled={isBrowserPreview || mutation.isPending}
                    className="h-10 w-full appearance-none rounded-lg border border-input bg-surface-muted/70 px-3 pr-9 text-sm text-foreground outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {RIOT_REGIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.value})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                  Valori supportati dal contratto backend. La modifica è
                  validata sia in UI sia in Rust.
                </p>
              </div>

              <Button
                onClick={() => mutation.mutate({ region })}
                disabled={
                  isBrowserPreview ||
                  mutation.isPending ||
                  region === data?.settings.region
                }
              >
                <Check className="size-4" />
                {mutation.isPending ? "Salvataggio…" : "Salva regione"}
              </Button>
            </div>

            <Separator className="my-5" />

            <ClientAccountCard />
            <RiotKeyCard region={saved.region} />
          </Card>

          <GlobalStatsCard />

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.07] text-primary">
                <MonitorCog className="size-4.5" />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">
                  Interfaccia
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Le preferenze estetiche sono applicate subito e persistite
                  localmente.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
                <div className="flex items-start gap-3">
                  <Accessibility className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <Label htmlFor="reduce-motion" className="text-xs">
                      Riduci le animazioni
                    </Label>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Disattiva transizioni e animazioni non essenziali. Rispetta
                      anche la preferenza di sistema.
                    </p>
                  </div>
                </div>
                <Switch
                  id="reduce-motion"
                  checked={reduceMotion}
                  onCheckedChange={(checked) => {
                    mutation.mutate({ reduceMotion: checked });
                  }}
                  disabled={isBrowserPreview || mutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
                <div className="flex items-start gap-3">
                  <Moon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold">Tema</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Dark è l'unico tema implementato in Fase 1. Nessun toggle
                      decorativo.
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Dark · fisso</Badge>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground">
                <ShieldCheck className="size-4.5" />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">
                  Privacy e conformità
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Regole permanenti del progetto, verificate in questa fase.
                </p>
              </div>
            </div>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                "Nessuna API key nel frontend o nel repository",
                "Nessun accesso alla memoria del gioco",
                "Nessuna modifica ai file del client",
                "Database SQLite solo locale",
                "Nessuna telemetria in Fase 1",
                "Errori e dati validati ai confini",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-[11px] leading-relaxed text-muted-foreground"
                >
                  <Check className="mt-0.5 size-3 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="eyebrow">Diagnostica</p>
                <h2 className="mt-1 font-display text-sm font-semibold">
                  Database locale
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <StatusDot tone={dbReady ? "success" : "warning"} pulse={dbReady} />
                {dbReady ? "Connesso" : "Non disponibile"}
              </span>
            </div>

            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Database className="size-3.5" />
                  Schema
                </span>
                <span className="font-mono text-[10px] text-foreground">
                  v{data?.database.schemaVersion ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="size-3.5" />
                  Dimensione
                </span>
                <span className="font-mono text-[10px] text-foreground">
                  {data ? formatBytes(data.database.sizeBytes) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Cpu className="size-3.5" />
                  Runtime
                </span>
                <span className="font-mono text-[10px] text-foreground">
                  {data?.runtime ?? "—"}
                </span>
              </div>

              <Separator />

              <div>
                <p className="eyebrow">Percorso file</p>
                <code className="mt-2 block max-h-24 overflow-y-auto break-all rounded-lg border border-white/[0.06] bg-black/25 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {data?.database.path ?? "Non disponibile nell'anteprima browser"}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => void handleCopyPath()}
                  disabled={!data?.database.path}
                >
                  <Copy className="size-3.5" />
                  Copia percorso
                </Button>
              </div>

              <div>
                <p className="eyebrow">Log locali</p>
                <code className="mt-2 block max-h-24 overflow-y-auto break-all rounded-lg border border-white/[0.06] bg-black/25 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {data?.logDirectory ??
                    "Non disponibili nell'anteprima browser"}
                </code>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/70">
                  File ruotati sul dispositivo, mai inviati altrove. Utili per
                  diagnosticare errori del database o dell'interfaccia.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => void handleCopyLogDirectory()}
                  disabled={!data?.logDirectory}
                >
                  <Copy className="size-3.5" />
                  Copia percorso log
                </Button>
              </div>

              <Separator />

              <div>
                <p className="eyebrow">Record locali</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {LOCAL_TABLES.map((table) => (
                    <div
                      key={table.key}
                      className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-2.5"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {table.label}
                      </p>
                      <p className="mt-0.5 font-display text-sm font-semibold">
                        {data?.database.tableCounts[table.key] ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <BackupCard />

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-muted-foreground">
                <Info className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">
                  Informazioni
                </h2>
                <dl className="mt-3 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Applicazione</dt>
                    <dd className="font-mono text-foreground">TECCA CODEOFLEGENDS</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Versione</dt>
                    <dd className="font-mono text-foreground">
                      {data?.appVersion ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Aggiornamenti</dt>
                    <dd className="font-mono text-foreground">Manuali, tramite installer</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Telemetria</dt>
                    <dd className="font-mono text-success">Assente</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/80" lang="en">
                  TECCA CODEOFLEGENDS isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the
                  views or opinions of Riot Games or anyone officially involved in producing or
                  managing Riot Games properties. Riot Games, and all associated properties are
                  trademarks or registered trademarks of Riot Games, Inc.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-destructive/15 p-5">
            <p className="eyebrow">Zona locale</p>
            <h2 className="mt-1 font-display text-sm font-semibold">
              Ripristina preferenze
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Riporta regione e animazioni ai valori predefiniti. Non elimina
              database, build o note.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3 w-full"
              onClick={handleReset}
              disabled={isBrowserPreview || mutation.isPending}
            >
              <RotateCcw className="size-3.5" />
              Ripristina
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
