import { ChevronDown, Loader2, Search, Star, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RiotDesktopOnly, RiotKeyMissing } from "@/features/players/components/riot-states";
import { useRiotKeyStatus, useSavedProfiles, useSearchPlayer } from "@/hooks/use-riot";
import { useSystemSnapshot } from "@/hooks/use-system-snapshot";
import { getErrorMessage } from "@/lib/errors";
import { formatRank } from "@/lib/match-stats";
import { formatDateTime } from "@/lib/utils";
import { isRiotAvailable } from "@/services/riot-service";
import { riotIdSchema } from "@/types/riot";
import { RIOT_REGIONS, riotRegionSchema, type RiotRegion } from "@/types/system";

function SearchForm({ defaultRegion }: { defaultRegion: RiotRegion }) {
  const navigate = useNavigate();
  const search = useSearchPlayer();
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState<RiotRegion>(defaultRegion);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = riotIdSchema.safeParse(riotId);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Riot ID non valido");
      return;
    }
    setError(null);
    search.mutate(
      { riotId, region },
      { onSuccess: (profile) => navigate(`/players/${encodeURIComponent(profile.puuid)}`) },
    );
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="riot-id" className="text-xs">Riot ID</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="riot-id"
              value={riotId}
              onChange={(event) => setRiotId(event.target.value)}
              placeholder="Nome#TAG"
              className="pl-9"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby="riot-id-help"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="riot-region" className="text-xs">Regione</Label>
          <div className="relative">
            <select
              id="riot-region"
              value={region}
              onChange={(event) => {
                const parsed = riotRegionSchema.safeParse(event.target.value);
                if (parsed.success) setRegion(parsed.data);
              }}
              className="h-10 w-full appearance-none rounded-lg border border-input bg-surface-muted/70 px-3 pr-9 text-sm text-foreground outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              {RIOT_REGIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.value})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <Button type="submit" disabled={search.isPending || riotId.trim() === ""}>
          {search.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {search.isPending ? "Ricerca…" : "Cerca"}
        </Button>
      </div>
      <p id="riot-id-help" className="text-[10px] text-muted-foreground">
        Formato Nome#TAG, come nel client. La prima ricerca scarica profilo, rank
        e ultime 20 partite (circa 25 richieste, rispettando i limiti Riot).
      </p>
      {error ? <p role="alert" className="text-[11px] text-destructive">{error}</p> : null}
      {search.isError ? (
        <ErrorState compact title="Ricerca non riuscita" message={getErrorMessage(search.error)} />
      ) : null}
    </form>
  );
}

export function PlayersPage() {
  const keyStatus = useRiotKeyStatus();
  const saved = useSavedProfiles();
  const snapshot = useSystemSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance · Fase 05"
        title="Player Profiles"
        description="Cerca un account tramite Riot ID e consulta rank, statistiche e partite recuperate dalla Riot API ufficiale. I profili salvati restano sul dispositivo."
        actions={<Badge variant="outline">Fonte: Riot API</Badge>}
      />

      {!isRiotAvailable() ? (
        <RiotDesktopOnly />
      ) : keyStatus.isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : !keyStatus.data?.configured ? (
        <RiotKeyMissing />
      ) : (
        <Card className="p-5 sm:p-6">
          <SearchForm defaultRegion={snapshot.data?.settings.region ?? "euw1"} />
        </Card>
      )}

      {isRiotAvailable() ? (
        <section aria-labelledby="saved-profiles-title">
          <h2 id="saved-profiles-title" className="mb-3 font-display text-sm font-semibold">
            Profili salvati
          </h2>
          {saved.isLoading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : saved.isError ? (
            <ErrorState compact message={getErrorMessage(saved.error)} onRetry={() => void saved.refetch()} />
          ) : !saved.data || saved.data.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="Nessun profilo salvato"
              description="Cerca il tuo Riot ID e salvalo: il primo profilo salvato diventa il principale e alimenta la dashboard con dati reali."
              className="py-8"
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {saved.data.map((profile) => (
                <li key={profile.puuid}>
                  <Link
                    to={`/players/${encodeURIComponent(profile.puuid)}`}
                    className="card-lift flex items-center gap-3 rounded-xl border border-white/[0.06] bg-card p-4 outline-none"
                  >
                    {profile.profileIconUrl ? (
                      <img src={profile.profileIconUrl} alt="" className="size-12 rounded-xl border border-white/10" loading="lazy" />
                    ) : (
                      <span className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-surface-raised">
                        <UserRound className="size-5 text-muted-foreground" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                        {profile.gameName}
                        <span className="text-muted-foreground">#{profile.tagLine}</span>
                        {profile.primary ? <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Profilo principale" /> : null}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {profile.region.toUpperCase()}
                        {profile.summonerLevel ? ` · livello ${profile.summonerLevel}` : ""} ·{" "}
                        {profile.soloQueue
                          ? `${formatRank({ queue: "solo", tier: profile.soloQueue.tier, division: profile.soloQueue.division, leaguePoints: profile.soloQueue.leaguePoints })} ${profile.soloQueue.leaguePoints} LP`
                          : "Solo/Duo non classificato"}
                      </span>
                      <span className="block text-[10px] text-muted-foreground/70">
                        {profile.matchCount} partite in locale
                        {profile.matchesSyncedAt ? ` · aggiornato ${formatDateTime(profile.matchesSyncedAt)}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
