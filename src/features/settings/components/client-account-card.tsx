import { FolderSearch, Gamepad2, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatusDot, type StatusTone } from "@/components/shared/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useClientAccountStatus,
  useSetClientSyncEnabled,
  useSetLeagueInstallPath,
  useSyncFromClient,
} from "@/hooks/use-client-account";
import { getErrorMessage } from "@/lib/errors";
import { isClientAccountAvailable } from "@/services/client-account-service";
import type { ClientState } from "@/types/client-account";

const STATE_LABELS: Record<ClientState, string> = {
  disabled: "Disattivato",
  not_found: "League non trovato",
  not_running: "Client chiuso",
  syncing: "Lettura in corso",
  connected: "Collegato",
  error: "Errore",
};

const STATE_TONES: Record<ClientState, StatusTone> = {
  disabled: "muted",
  not_found: "warning",
  not_running: "warning",
  syncing: "secondary",
  connected: "success",
  error: "danger",
};

const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" });

/**
 * Riot account read automatically from the League client (no API key).
 * Shows exactly what is read and lets the user turn it off.
 */
export function ClientAccountCard() {
  const status = useClientAccountStatus();
  const toggle = useSetClientSyncEnabled();
  const syncNow = useSyncFromClient();
  const setPath = useSetLeagueInstallPath();
  const [pathDraft, setPathDraft] = useState("");
  const data = status.data;

  if (!isClientAccountAvailable()) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 text-[11px] text-muted-foreground">
        Il rilevamento dell'account dal client di League è disponibile solo nell'app desktop.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Gamepad2 className="mt-0.5 size-4 shrink-0 text-secondary" />
          <div>
            <Label htmlFor="client-sync" className="text-xs font-semibold">
              Account automatico dal client di League
            </Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Senza chiave API: quando il client è aperto, l'app legge in sola lettura il tuo account,
              il rank e le ultime 20 partite e li imposta come profilo. Durante una partita riconosce
              anche il tuo Riot ID.
            </p>
          </div>
        </div>
        <Switch
          id="client-sync"
          checked={data?.enabled ?? false}
          disabled={!data || toggle.isPending}
          onCheckedChange={(enabled) =>
            toggle.mutate(enabled, { onError: (error) => toast.error(getErrorMessage(error)) })
          }
        />
      </div>

      {data ? (
        <div className="space-y-2 rounded-lg border border-white/[0.05] bg-black/15 p-3 text-[11px]">
          <p className="flex items-center gap-2 font-medium text-foreground" role="status">
            <StatusDot tone={STATE_TONES[data.state]} pulse={data.state === "syncing"} />
            {STATE_LABELS[data.state]}
            {data.account ? (
              <Link
                to={`/players/${encodeURIComponent(data.account.puuid)}`}
                className="text-secondary hover:underline"
              >
                {data.account.gameName}#{data.account.tagLine} · {data.account.region.toUpperCase()}
              </Link>
            ) : null}
          </p>
          {data.message ? <p className="text-muted-foreground">{data.message}</p> : null}
          {data.lastSyncMs ? (
            <p className="text-muted-foreground">
              Ultima lettura: {dateTime.format(data.lastSyncMs)}
              {data.newMatches > 0 ? ` · ${data.newMatches} partite nuove` : ""}
            </p>
          ) : null}
          {data.detectedRiotId ? (
            <p className="text-muted-foreground">
              Riot ID visto in partita: <span className="text-foreground">{data.detectedRiotId.riotId}</span>
            </p>
          ) : null}
          {data.installPath ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground/80" title={data.installPath}>
              {data.installPath}
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={syncNow.isPending || data?.state === "syncing"}
        onClick={() =>
          syncNow.mutate(undefined, {
            onSuccess: (next) =>
              toast.success(
                next.account
                  ? `Account ${next.account.gameName}#${next.account.tagLine} aggiornato dal client`
                  : "Lettura dal client completata",
              ),
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      >
        {syncNow.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        Leggi ora dal client
      </Button>

      {data?.state === "not_found" || pathDraft ? (
        <form
          className="space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            setPath.mutate(pathDraft, {
              onSuccess: () => {
                setPathDraft("");
                toast.success("Cartella di League salvata");
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            });
          }}
        >
          <Label htmlFor="league-path" className="text-[11px]">
            Cartella di League of Legends
          </Label>
          <div className="flex gap-2">
            <Input
              id="league-path"
              value={pathDraft}
              placeholder="C:\Riot Games\League of Legends"
              onChange={(event) => setPathDraft(event.currentTarget.value)}
            />
            <Button type="submit" size="sm" variant="outline" disabled={!pathDraft || setPath.isPending}>
              <FolderSearch className="size-3.5" />
              Usa
            </Button>
          </div>
        </form>
      ) : null}

      <p className="flex flex-wrap items-center gap-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
        <Badge variant="warning">API non ufficiale</Badge>
        Riot non supporta ufficialmente l'API del client per app di terze parti: può cambiare con un
        aggiornamento. Solo lettura (file <code className="font-mono">lockfile</code> e richieste GET
        locali): niente memoria del gioco, niente modifiche, niente azioni automatiche.
      </p>
    </div>
  );
}
