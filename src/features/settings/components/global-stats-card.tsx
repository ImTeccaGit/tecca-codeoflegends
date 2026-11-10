import { BarChart3, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { StatusDot, type StatusTone } from "@/components/shared/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  useClearGlobalStats,
  useGlobalStatsStatus,
  useUpdateGlobalStatsSettings,
} from "@/hooks/use-global-stats";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import { isGlobalStatsAvailable } from "@/services/global-stats-service";
import {
  SEED_TIERS,
  globalStatsSettingsSchema,
  type CollectorState,
  type GlobalStatsSettings,
  type GlobalStatsStatus,
} from "@/types/global-stats";
import { RIOT_REGIONS } from "@/types/system";

const STATE_LABELS: Record<CollectorState, string> = {
  disabled: "Disattivata",
  idle: "In attesa di nuovi giocatori da leggere",
  collecting: "Raccolta in corso",
  waiting: "Pausa per il limite di richieste",
  error: "Errore",
};

const STATE_TONES: Record<CollectorState, StatusTone> = {
  disabled: "muted",
  idle: "secondary",
  collecting: "success",
  waiting: "warning",
  error: "danger",
};

const numbers = new Intl.NumberFormat("it-IT");

function settingsOf(status: GlobalStatsStatus, change: Partial<GlobalStatsSettings>) {
  return globalStatsSettingsSchema.safeParse({
    enabled: status.enabled,
    platform: status.platform,
    seedTier: status.seedTier,
    ...change,
  });
}

/**
 * Opt-in collection of global champion statistics (runes, items, spells,
 * matchups) with the user's own Riot API key. Explains what is downloaded
 * and lets the user stop it or delete the data at any time.
 */
export function GlobalStatsCard() {
  const status = useGlobalStatsStatus();
  const update = useUpdateGlobalStatsSettings();
  const clear = useClearGlobalStats();
  const [confirmClear, setConfirmClear] = useState(false);
  const data = status.data;
  const location = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);

  // Links from the champion pages point here ("/settings#global-stats").
  useEffect(() => {
    if (location.hash === "#global-stats") {
      cardRef.current?.scrollIntoView({ block: "start" });
    }
  }, [location.hash]);

  const apply = (change: Partial<GlobalStatsSettings>) => {
    if (!data) return;
    const parsed = settingsOf(data, change);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Impostazione non valida.");
      return;
    }
    update.mutate(parsed.data, { onError: (error) => toast.error(getErrorMessage(error)) });
  };

  return (
    <Card id="global-stats" ref={cardRef} className="scroll-mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.07] text-primary">
            <BarChart3 className="size-4.5" />
          </span>
          <div className="min-w-0">
            <Label htmlFor="global-stats-enabled" className="font-display text-sm font-semibold">
              Statistiche globali dei campioni
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Con la tua chiave Riot l'app legge la classifica della fascia scelta (league-v4) e
              scarica le partite classificate Solo/Duo recenti di quei giocatori (match-v5). Da
              queste calcola rune, incantesimi, oggetti e counter più usati per ogni campione.
              Solo API ufficiali, nessun sito di terze parti.
            </p>
          </div>
        </div>
        <Switch
          id="global-stats-enabled"
          checked={data?.enabled ?? false}
          disabled={!data || update.isPending}
          onCheckedChange={(enabled) => apply({ enabled })}
        />
      </div>

      {!isGlobalStatsAvailable() ? (
        <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 text-[11px] text-muted-foreground">
          La raccolta è disponibile solo nell'app desktop.
        </p>
      ) : null}

      {status.isError ? (
        <p className="mt-4 text-[11px] text-destructive" role="alert">
          {getErrorMessage(status.error)}
        </p>
      ) : null}

      {data ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="global-stats-platform" className="text-[11px]">
                Regione delle partite
              </Label>
              <NativeSelect
                id="global-stats-platform"
                value={data.platform}
                disabled={update.isPending}
                onChange={(event) => apply({ platform: event.target.value as GlobalStatsSettings["platform"] })}
              >
                {RIOT_REGIONS.map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.label} ({region.value})
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="global-stats-tier" className="text-[11px]">
                Fascia dei giocatori di partenza
              </Label>
              <NativeSelect
                id="global-stats-tier"
                value={data.seedTier}
                disabled={update.isPending}
                onChange={(event) => apply({ seedTier: event.target.value as GlobalStatsSettings["seedTier"] })}
              >
                {SEED_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-white/[0.05] bg-black/15 p-3 text-[11px]">
            <p className="flex items-center gap-2 font-medium text-foreground" role="status">
              <StatusDot tone={STATE_TONES[data.state]} pulse={data.state === "collecting"} />
              {STATE_LABELS[data.state]}
            </p>
            {!data.keyConfigured ? (
              <p className="text-warning">
                Nessuna chiave API Riot configurata: inseriscila qui sopra per avviare la raccolta.
              </p>
            ) : null}
            {data.message ? <p className="text-muted-foreground">{data.message}</p> : null}
            <p className="text-muted-foreground">
              {numbers.format(data.totalMatches)} partite valide salvate
              {data.sessionMatches > 0 ? ` · ${numbers.format(data.sessionMatches)} in questa sessione` : ""}
              {data.seedPlayers > 0 ? ` · ${numbers.format(data.seedPlayers)} giocatori in classifica` : ""}
            </p>
            {data.patches.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.patches.map((sample) => (
                  <Badge key={sample.patch} variant="outline">
                    Patch {sample.patch}: {numbers.format(sample.matches)}
                  </Badge>
                ))}
              </div>
            ) : null}
            {data.lastFetchedAt ? (
              <p className="text-muted-foreground">
                Ultima partita scaricata: {formatDateTime(data.lastFetchedAt)}
              </p>
            ) : null}
          </div>

          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
            <li>
              Usa circa metà del limite di una chiave di sviluppo (una richiesta ogni 2,5 s), così
              la ricerca dei profili resta disponibile. Funziona solo con l'app aperta.
            </li>
            <li>
              Il rank è verificato solo per il giocatore da cui parte ogni partita; gli altri 9
              partecipanti hanno un rank simile ma non verificato.
            </li>
            <li>Vengono conservate le ultime 3 patch; le partite rifatte (remake) sono escluse.</li>
          </ul>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={clear.isPending || data.totalMatches === 0}
              onClick={() => setConfirmClear(true)}
            >
              {clear.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Elimina dati raccolti
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminare le statistiche globali?</DialogTitle>
            <DialogDescription>
              {`Le ${numbers.format(data?.totalMatches ?? 0)} partite raccolte e le classifiche salvate verranno eliminate definitivamente. Le tue partite e i profili non vengono toccati.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                clear.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmClear(false);
                    toast.success("Statistiche globali eliminate.");
                  },
                  onError: (error) => toast.error(getErrorMessage(error)),
                })
              }
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
