import { AlertTriangle, ArrowLeft, Gamepad2, Loader2, RefreshCw, Star, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerMatchRow } from "@/features/players/components/player-match-row";
import { PlayerOverview } from "@/features/players/components/player-overview";
import { RankedCard } from "@/features/players/components/ranked-card";
import { RiotDesktopOnly } from "@/features/players/components/riot-states";
import {
  useDeletePlayerData,
  usePlayerProfile,
  useRemoveProfile,
  useSaveProfile,
  useSetPrimaryProfile,
  useSyncPlayer,
} from "@/hooks/use-riot";
import { useSyncFromClient } from "@/hooks/use-client-account";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import { isRiotAvailable } from "@/services/riot-service";
import { RIOT_REGIONS } from "@/types/system";

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
      <Link to="/players">
        <ArrowLeft className="size-3.5" />
        Player Profiles
      </Link>
    </Button>
  );
}

export function PlayerProfilePage() {
  const { puuid: rawPuuid = "" } = useParams<{ puuid: string }>();
  const puuid = decodeURIComponent(rawPuuid);
  const navigate = useNavigate();
  const query = usePlayerProfile(puuid);
  const sync = useSyncPlayer();
  const clientSync = useSyncFromClient();
  const save = useSaveProfile();
  const remove = useRemoveProfile();
  const setPrimary = useSetPrimaryProfile();
  const deleteData = useDeletePlayerData();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isRiotAvailable()) {
    return (
      <div className="space-y-5">
        <BackLink />
        <RiotDesktopOnly />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-5" aria-hidden="true">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-5">
        <BackLink />
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const profile = query.data;
  if (!profile) {
    return (
      <div className="space-y-5">
        <BackLink />
        <EmptyState
          icon={UserRound}
          title="Profilo non presente"
          description="Questo profilo non è salvato sul dispositivo. Cercalo con il Riot ID per scaricarlo."
        />
      </div>
    );
  }

  const now = new Date(query.dataUpdatedAt);
  const regionLabel = RIOT_REGIONS.find((item) => item.value === profile.region)?.label ?? profile.region;
  const solo = profile.ranked.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
  const flex = profile.ranked.find((entry) => entry.queueType === "RANKED_FLEX_SR");

  return (
    <div className="space-y-5">
      <BackLink />

      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-surface-raised via-surface to-surface-muted p-6 shadow-hero">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          {profile.profileIconUrl ? (
            <img src={profile.profileIconUrl} alt="" className="size-20 rounded-2xl border border-white/15 shadow-xl shadow-black/40" />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-2xl border border-white/10 bg-surface-raised">
              <UserRound className="size-8 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Profilo · {regionLabel}</p>
            <h1 className="mt-1 font-display text-[clamp(1.8rem,3.4vw,2.6rem)] leading-none font-semibold tracking-tight">
              {profile.gameName}
              <span className="text-muted-foreground"> #{profile.tagLine}</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {profile.summonerLevel ? <Badge variant="outline">Livello {profile.summonerLevel}</Badge> : null}
              <Badge variant="secondary">Fonte: {profile.source}</Badge>
              {profile.primary ? (
                <Badge variant="warning">
                  <Star className="fill-current" />
                  Principale
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Profilo {profile.sync.profileSyncedAt ? formatDateTime(profile.sync.profileSyncedAt) : "—"} · Rank{" "}
              {profile.sync.rankedSyncedAt ? formatDateTime(profile.sync.rankedSyncedAt) : "—"} · Partite{" "}
              {profile.sync.matchesSyncedAt ? formatDateTime(profile.sync.matchesSyncedAt) : "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
            {profile.source.includes("Client") ? (
              <Button
                variant="secondary"
                onClick={() =>
                  clientSync.mutate(undefined, {
                    onError: (error) => toast.error(getErrorMessage(error)),
                  })
                }
                disabled={clientSync.isPending}
              >
                {clientSync.isPending ? <Loader2 className="size-4 animate-spin" /> : <Gamepad2 className="size-4" />}
                Leggi dal client
              </Button>
            ) : null}
            <Button onClick={() => sync.mutate({ puuid: profile.puuid, force: true })} disabled={sync.isPending}>
              {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {sync.isPending ? "Aggiornamento…" : "Aggiorna da Riot"}
            </Button>
            {profile.saved ? (
              <>
                {!profile.primary ? (
                  <Button variant="outline" size="sm" onClick={() => setPrimary.mutate(profile.puuid)}>
                    <Star className="size-3.5" />
                    Imposta come principale
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(profile.puuid)}>
                  Rimuovi dai salvati
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => save.mutate(profile.puuid)}>
                <Star className="size-3.5" />
                Salva profilo
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" />
              Elimina dati locali
            </Button>
          </div>
        </div>

        {profile.sync.lastError ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.06] px-3 py-2 text-[11px] text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            Ultimo aggiornamento non riuscito: {profile.sync.lastError} I dati mostrati sono quelli salvati in precedenza.
          </p>
        ) : null}
        {sync.isError ? (
          <div className="mt-4">
            <ErrorState compact title="Aggiornamento non riuscito" message={getErrorMessage(sync.error)} />
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <RankedCard queueType="RANKED_SOLO_5x5" entry={solo} />
        <RankedCard queueType="RANKED_FLEX_SR" entry={flex} />
      </div>

      <Card className="p-5 sm:p-6">
        <p className="eyebrow">Statistiche individuali</p>
        <h2 className="mt-1 mb-4 font-display text-sm font-semibold">Panoramica delle partite recenti</h2>
        <PlayerOverview matches={profile.matches} />
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Match history</p>
            <h2 className="mt-1 font-display text-sm font-semibold">Ultime partite ({profile.matches.length})</h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/matches?player=${encodeURIComponent(profile.puuid)}`}>Filtra per coda</Link>
          </Button>
        </div>
        {profile.matches.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="Nessuna partita salvata"
            description="La Riot API non ha restituito partite recenti per questo account, oppure non è stato ancora aggiornato."
            className="py-8"
          />
        ) : (
          <ul className="space-y-2">
            {profile.matches.map((match) => (
              <PlayerMatchRow key={match.matchId} match={match} now={now} />
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminare i dati locali?</DialogTitle>
            <DialogDescription>
              Verranno cancellati dal dispositivo profilo, rank, collegamenti
              alle partite e le partite non condivise con altri profili salvati.
              Potrai riscaricarli con una nuova ricerca.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteData.isPending}
              onClick={() =>
                deleteData.mutate(profile.puuid, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    navigate("/players");
                  },
                })
              }
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
