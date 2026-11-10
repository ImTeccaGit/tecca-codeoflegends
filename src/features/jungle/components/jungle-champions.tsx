import { MapPinned, Timer, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { LaneIcon } from "@/components/shared/lane-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClearTime } from "@/features/jungle/lib/training-timer";
import { useChampionCatalog } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";
import { isCatalogAvailable } from "@/services/catalog-service";
import type { ClearAttempt } from "@/types/jungle";

interface JungleChampionsProps {
  attempts: ClearAttempt[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/**
 * Champions the user marked with the Jungle lane (Champions page), with their
 * own practice numbers. Selecting one tags the next saved attempts.
 */
export function JungleChampions({ attempts, selectedId, onSelect }: JungleChampionsProps) {
  const { data, isLoading } = useChampionCatalog();

  if (!isCatalogAvailable()) {
    return (
      <p className="text-xs text-muted-foreground">
        Le schede usano il catalogo Data Dragon dell'app desktop.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const junglers = (data?.champions ?? []).filter((champion) =>
    champion.lanes.includes("JUNGLE"),
  );

  if (junglers.length === 0) {
    return (
      <EmptyState
        icon={MapPinned}
        title="Nessun campione con corsia Giungla"
        description="Data Dragon non pubblica le corsie: assegna la Giungla ai tuoi campioni nella pagina Champions e compariranno qui con i tuoi tempi."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/champions?assign=1">
              <LaneIcon lane="JUNGLE" className="size-3.5" />
              Assegna corsie
            </Link>
          </Button>
        }
        className="py-8"
      />
    );
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
      {junglers.map((champion) => {
        const own = attempts.filter((attempt) => attempt.championId === champion.id);
        const best = own.reduce<ClearAttempt | null>(
          (winner, attempt) => (!winner || attempt.totalMs < winner.totalMs ? attempt : winner),
          null,
        );
        const selected = champion.id === selectedId;
        return (
          <li key={champion.id}>
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`${champion.name}: ${own.length} tentativi${best ? `, record ${formatClearTime(best.totalMs)}` : ""}. ${selected ? "Associato ai prossimi tentativi" : "Associa ai prossimi tentativi"}`}
              onClick={() => onSelect(selected ? null : champion.id)}
              className={cn(
                "card-lift flex w-full items-center gap-3 rounded-xl border p-3 text-left",
                selected
                  ? "border-primary/45 bg-primary/[0.1]"
                  : "border-white/[0.06] bg-card",
              )}
            >
              <img
                src={champion.imageUrl}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                className="size-11 rounded-xl border border-white/10 object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {champion.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Timer className="size-3" />
                  {own.length} {own.length === 1 ? "tentativo" : "tentativi"}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-warning tabular-nums">
                  {best ? (
                    <>
                      <Trophy className="size-3" />
                      {formatClearTime(best.totalMs)} · {best.routeName}
                    </>
                  ) : (
                    <span className="text-muted-foreground">nessun record</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
