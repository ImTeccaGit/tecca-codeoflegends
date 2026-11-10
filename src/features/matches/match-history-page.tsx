import { History, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerMatchRow } from "@/features/players/components/player-match-row";
import { RiotDesktopOnly } from "@/features/players/components/riot-states";
import { usePlayerProfile, useSavedProfiles } from "@/hooks/use-riot";
import { getErrorMessage } from "@/lib/errors";
import { queueGroup, type QueueGroup } from "@/lib/queues";
import { cn } from "@/lib/utils";
import { isRiotAvailable } from "@/services/riot-service";

const FILTERS: ReadonlyArray<{ value: QueueGroup | "all"; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "solo", label: "Solo/Duo" },
  { value: "flex", label: "Flex" },
  { value: "normal", label: "Normali" },
  { value: "aram", label: "ARAM" },
  { value: "other", label: "Altre" },
];

function isFilter(value: string): value is QueueGroup | "all" {
  return FILTERS.some((filter) => filter.value === value);
}

/** Stored match-v5 history of a saved profile, filterable by queue. */
export function MatchHistoryPage() {
  const [params, setParams] = useSearchParams();
  const saved = useSavedProfiles();
  const requested = params.get("player");
  const queueParam = params.get("queue") ?? "all";
  const filter = isFilter(queueParam) ? queueParam : "all";
  const puuid =
    requested ?? saved.data?.find((profile) => profile.primary)?.puuid ?? saved.data?.[0]?.puuid ?? "";
  const profile = usePlayerProfile(puuid);

  const update = (next: { player?: string; queue?: string }) => {
    const search = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") search.set(key, value);
      else search.delete(key);
    }
    setParams(search, { replace: true });
  };

  const matches = (profile.data?.matches ?? []).filter(
    (match) => filter === "all" || queueGroup(match.queueId) === filter,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance · Fase 05"
        title="Match History"
        description="Le partite recuperate dalla Riot API e salvate sul dispositivo, con oggetti, rune e statistiche per ogni partita."
        actions={<Badge variant="outline">Fonte: Riot API match-v5</Badge>}
      />

      {!isRiotAvailable() ? (
        <RiotDesktopOnly />
      ) : saved.isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : saved.isError ? (
        <ErrorState message={getErrorMessage(saved.error)} onRetry={() => void saved.refetch()} />
      ) : !puuid ? (
        <EmptyState
          icon={UserRound}
          title="Nessun profilo salvato"
          description="Cerca e salva il tuo profilo in Player Profiles: qui vedrai la sua cronologia partite."
          action={
            <Button asChild size="sm">
              <Link to="/players">Vai a Player Profiles</Link>
            </Button>
          }
        />
      ) : (
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {saved.data && saved.data.length > 1 ? (
              <div role="radiogroup" aria-label="Profilo" className="flex flex-wrap gap-1.5">
                {saved.data.map((item) => (
                  <button
                    key={item.puuid}
                    type="button"
                    role="radio"
                    aria-checked={item.puuid === puuid}
                    onClick={() => update({ player: item.puuid })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                      item.puuid === puuid
                        ? "border-primary/40 bg-primary/[0.14] text-foreground"
                        : "border-white/[0.07] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.gameName}#{item.tagLine}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold">
                {profile.data ? `${profile.data.gameName}#${profile.data.tagLine}` : ""}
              </p>
            )}
            <div role="radiogroup" aria-label="Coda" className="flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={filter === item.value}
                  onClick={() => update({ queue: item.value })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                    filter === item.value
                      ? "border-primary/40 bg-primary/[0.14] text-foreground"
                      : "border-white/[0.07] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {profile.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : profile.isError ? (
            <ErrorState compact message={getErrorMessage(profile.error)} onRetry={() => void profile.refetch()} />
          ) : matches.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nessuna partita per questo filtro"
              description="Prova un'altra coda o aggiorna il profilo da Player Profiles."
              className="py-8"
            />
          ) : (
            <ul className="space-y-2" aria-label="Partite">
              {matches.map((match) => (
                <PlayerMatchRow key={match.matchId} match={match} now={new Date(profile.dataUpdatedAt)} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
