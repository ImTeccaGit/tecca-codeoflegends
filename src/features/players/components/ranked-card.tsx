import { Flame, Trophy } from "lucide-react";
import { rankedWinRate } from "@/features/players/lib/player-stats";
import { formatPercent, formatRank } from "@/lib/match-stats";
import { RANKED_QUEUE_LABELS } from "@/lib/queues";
import { cn } from "@/lib/utils";
import type { RankedEntry } from "@/types/riot";

interface RankedCardProps {
  queueType: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";
  entry: RankedEntry | undefined;
}

/** League-v4 entry for one queue, or an explicit "unranked" state. */
export function RankedCard({ queueType, entry }: RankedCardProps) {
  const winRate = entry ? rankedWinRate(entry) : null;

  return (
    <div
      className={cn(
        "card-lift relative overflow-hidden rounded-2xl border p-5",
        entry ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] via-surface to-surface" : "border-white/[0.06] bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{RANKED_QUEUE_LABELS[queueType]}</p>
        <Trophy className={cn("size-4", entry ? "text-warning" : "text-muted-foreground")} />
      </div>

      {entry ? (
        <>
          <p className="mt-3 font-display text-2xl font-semibold text-foreground">
            {formatRank({ queue: queueType, tier: entry.tier, division: entry.division, leaguePoints: entry.leaguePoints })}
          </p>
          <p className="mt-1 font-mono text-sm text-primary-soft tabular-nums">{entry.leaguePoints} LP</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-2">
              <p className="font-display text-base font-semibold text-success tabular-nums">{entry.wins}</p>
              <p className="text-[10px] text-muted-foreground">Vittorie</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-2">
              <p className="font-display text-base font-semibold text-destructive tabular-nums">{entry.losses}</p>
              <p className="text-[10px] text-muted-foreground">Sconfitte</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-2">
              <p className="font-display text-base font-semibold text-foreground tabular-nums">{formatPercent(winRate)}</p>
              <p className="text-[10px] text-muted-foreground">Win rate</p>
            </div>
          </div>
          {entry.hotStreak ? (
            <p className="mt-3 inline-flex items-center gap-1 text-[10px] text-warning">
              <Flame className="size-3" />
              Serie di vittorie in corso
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-3 font-display text-2xl font-semibold text-muted-foreground/70">Non classificato</p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            La Riot API non restituisce un piazzamento per questa coda nella
            stagione corrente.
          </p>
        </>
      )}
    </div>
  );
}
